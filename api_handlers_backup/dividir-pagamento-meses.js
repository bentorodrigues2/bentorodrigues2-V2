import { createHash } from "crypto";
import { supabase } from "../server/lib/supabaseServer.js";
import { guardarNoArquivo, registarDocumento, enviarEmailPDF } from "../server/lib/pdfService.js";
import { generateOfficialReceiptPDF, nomeFicheiroRecibo } from "../server/lib/receiptGenerator.js";
import { derivarPrefixoEdificio } from "../server/lib/reciboUtils.js";
import { obterModeloEmail, interpolarModeloEmail } from "../server/lib/emailTemplates.js";

// Mesma lógica de escolha de IBAN já usada em confirmar-pagamento.js e
// server/lib/cronService.js — Quota Ordinária/FCR usa a conta corrente
// principal, Quota Extraordinária usa a de poupança/obras.
function escolherIbanContaPorTipo(contas, tipoAviso) {
  if (!contas || contas.length === 0) return "";
  const ehExtraordinaria = (tipoAviso || "").toLowerCase().includes("extra");
  const contaPrincipal = contas.find((c) => c.is_principal);
  const contaSecundaria = contas.find((c) => !c.is_principal);
  if (ehExtraordinaria) return (contaSecundaria || contaPrincipal || contas[0])?.iban || "";
  return (contaPrincipal || contas[0])?.iban || "";
}

/**
 * Divide um único comprovativo (uma transação bancária real) que cobre
 * vários meses de quota adiantados numa fração — ex: fração paga 10€/mês
 * mas envia de uma vez um comprovativo de 120€ referente ao ano inteiro.
 * Em vez de criar N pagamentos/movimentos para uma única entrada de
 * dinheiro (o que duplicaria o valor na conciliação bancária), mantém o
 * pagamento e o movimento originais como UM só (a transação real), cria N
 * avisos "Quota Ordinária" já Liquidados (um por mês consecutivo) e emite
 * um único recibo com uma rubrica por mês — o gerador de PDF já suporta
 * uma lista de rubricas, por isso não precisa de nenhum template novo.
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const { id_pagamento, num_meses, mes_inicio } = req.body || {};
    if (!id_pagamento || !num_meses || Number(num_meses) < 2 || !mes_inicio) {
      return res.status(400).json({ error: "id_pagamento, num_meses (mínimo 2) e mes_inicio (AAAA-MM) são obrigatórios." });
    }
    const numMeses = Number(num_meses);

    const { data: pagamento, error: errPag } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("id", id_pagamento)
      .maybeSingle();
    if (errPag || !pagamento) {
      return res.status(404).json({ error: "Pagamento não encontrado", detail: errPag?.message });
    }
    if (pagamento.estado === "confirmado") {
      return res.status(400).json({ error: "Este pagamento já foi confirmado anteriormente." });
    }
    if (!pagamento.id_fracao) {
      return res.status(400).json({ error: "Este pagamento não está associado a nenhuma fração." });
    }

    const { data: fracao } = await supabase
      .from("fracoes")
      .select("fracao_nome, id_predio, piso, permilagem, proprietario")
      .eq("id_fracao", pagamento.id_fracao)
      .maybeSingle();
    if (!fracao?.id_predio) {
      return res.status(404).json({ error: "Fração não encontrada." });
    }

    const [{ data: predio }, { data: contasPredio }] = await Promise.all([
      supabase.from("predios").select("*").eq("id_predio", fracao.id_predio).maybeSingle(),
      supabase.from("contas").select("iban, is_principal").eq("id_predio", fracao.id_predio)
    ]);

    // "NA" é o valor usado em toda a app para um condómino que recusou
    // fornecer o email — não é um endereço válido para tentar enviar.
    const emailValidoDivisao = (valor) => {
      const v = (valor || "").trim();
      return v && v.toUpperCase() !== "NA" && /\S+@\S+\.\S+/.test(v) ? v : null;
    };

    const proprietarioNome = fracao.proprietario?.nome || pagamento.entidade || "Condómino(a)";
    const proprietarioEmail = emailValidoDivisao(fracao.proprietario?.email);
    const proprietarioNif = fracao.proprietario?.nif || "";
    const fracaoNome = fracao.fracao_nome || pagamento.fracao || "Fração";

    const valorTotal = Number(pagamento.valor || 0);
    // O último mês absorve o resto do arredondamento, para a soma das
    // rubricas bater sempre certo com o valor total do comprovativo.
    const valorMensalBase = Math.floor((valorTotal / numMeses) * 100) / 100;
    const resto = Math.round((valorTotal - valorMensalBase * numMeses) * 100) / 100;

    const [anoIni, mesIni] = mes_inicio.split("-").map(Number);
    if (!anoIni || !mesIni) {
      return res.status(400).json({ error: "mes_inicio inválido — use o formato AAAA-MM." });
    }

    const rubricas = [];
    const novosAvisos = [];
    for (let i = 0; i < numMeses; i++) {
      const valorMes = i === numMeses - 1 ? Math.round((valorMensalBase + resto) * 100) / 100 : valorMensalBase;
      const dataMes = new Date(Date.UTC(anoIni, mesIni - 1 + i, 1));
      const isoMes = dataMes.toISOString().split("T")[0];
      const valorFCR = Math.round(valorMes * 0.10 * 100) / 100;
      const valorQuota = Math.round((valorMes - valorFCR) * 100) / 100;
      const nomeMes = dataMes.toLocaleDateString("pt-PT", { month: "long", year: "numeric", timeZone: "UTC" });

      rubricas.push({ descricao: `Quota Ordinária — ${nomeMes}`, valor: valorQuota, tipo: "Quota Ordinária" });
      rubricas.push({ descricao: `Fundo Comum de Reserva — ${nomeMes}`, valor: valorFCR, tipo: "Fundo Comum de Reserva" });

      novosAvisos.push({
        id_aviso: `aviso-dividido-${id_pagamento}-${i}`,
        id_predio: fracao.id_predio,
        id_fracao: pagamento.id_fracao,
        tipo: "Quota Ordinária",
        data: isoMes,
        vencimento: isoMes,
        descricao: `Quota Ordinária paga adiantadamente — ${nomeMes} (comprovativo único de ${valorTotal.toFixed(2)}€ dividido em ${numMeses} meses).`,
        valor: valorMes,
        valor_fundo_reserva: valorFCR,
        // "avisos.estado" tem um check constraint na base de dados que só
        // aceita "Pendente"/"Pago" — "Liquidado"/"Paga" são sempre
        // rejeitados (silenciosamente, se o erro não for verificado).
        estado: "Pago",
        proprietario_nome: proprietarioNome,
        proprietario_nif: proprietarioNif
      });
    }

    const { error: errAvisos } = await supabase.from("avisos").upsert(novosAvisos, { onConflict: "id_aviso" });
    if (errAvisos) {
      return res.status(500).json({ error: "Erro ao gravar os avisos mensais", detail: errAvisos.message });
    }

    // Se a fração tiver uma dívida de arranque ("administração anterior")
    // pendente, os meses agora pagos podem já estar incluídos nesse valor
    // global — sem isto, a dívida de arranque ficava por saldar na mesma
    // depois deste pagamento, fazendo a fração parecer que deve a dobrar
    // (aconteceu de facto com a Fração J: 141,40€ divididos em 4 meses,
    // mas os 212,10€ de dívida de arranque continuavam intactos).
    try {
      const { data: dividasArranque } = await supabase
        .from("avisos")
        .select("id_aviso, valor, descricao")
        .eq("id_fracao", pagamento.id_fracao)
        .eq("estado", "Pendente")
        .ilike("descricao", "%administração anterior%");

      for (const divida of dividasArranque || []) {
        const valorAReduzir = Math.min(Number(divida.valor) || 0, valorTotal);
        if (valorAReduzir <= 0) continue;
        const novoValor = Math.round(((Number(divida.valor) || 0) - valorAReduzir) * 100) / 100;
        if (novoValor <= 0.01) {
          await supabase.from("avisos").update({ estado: "Pago" }).eq("id_aviso", divida.id_aviso);
        } else {
          await supabase
            .from("avisos")
            .update({
              valor: novoValor,
              valor_fundo_reserva: Math.round(novoValor * 0.10 * 100) / 100,
              descricao: `${divida.descricao} (reduzido em ${valorAReduzir.toFixed(2)}€ por um pagamento de ${numMeses} meses confirmado em ${new Date().toLocaleDateString("pt-PT")}.)`
            })
            .eq("id_aviso", divida.id_aviso);
        }
      }
    } catch (errDivida) {
      console.warn("[dividir-pagamento-meses] Aviso ao reconciliar dívida de arranque:", errDivida?.message || errDivida);
    }

    // Confirma o pagamento original (é UMA transação bancária real) e
    // liga o movimento já existente como justificado — nunca se criam N
    // pagamentos/movimentos para uma única entrada de dinheiro.
    await supabase.from("pagamentos").update({ estado: "confirmado", confirmado_em: new Date().toISOString() }).eq("id", id_pagamento);
    try {
      await supabase
        .from("movimentos")
        .update({ estado: "Justificado", estado_conciliacao: "CONCILIADO", is_movimento_cego: false })
        .ilike("descricao", `%[pagamento:${id_pagamento}]%`);
    } catch (errMovLink) {
      console.warn("[dividir-pagamento-meses] Aviso ao atualizar movimento ligado:", errMovLink?.message || errMovLink);
    }

    const hash = createHash("sha256").update(`${id_pagamento}-dividido-${numMeses}-${Date.now()}`).digest("hex");
    const prefixoEdificio = derivarPrefixoEdificio(predio?.nome);
    const { count: totalConfirmados } = await supabase
      .from("pagamentos")
      .select("id", { count: "exact", head: true })
      .eq("estado", "confirmado");
    const sequencial = String(totalConfirmados || 1).padStart(5, "0");
    const idRecibo = `${prefixoEdificio} ${sequencial}`;

    const recibo = {
      id_recibo: idRecibo,
      numero_sequencial: totalConfirmados || 1,
      ano: anoIni,
      id_predio: fracao.id_predio,
      id_fracao: pagamento.id_fracao,
      nome_condomino: proprietarioNome,
      nif_condomino: proprietarioNif,
      fracao_nome: fracaoNome,
      permilagem: fracao.permilagem || 0,
      data_emissao: new Date().toISOString().split("T")[0],
      data_pagamento: pagamento.data_pagamento || new Date().toISOString().split("T")[0],
      metodo_pagamento: pagamento.entidade ? `Transferência Bancária — ${pagamento.entidade}` : "Transferência Bancária",
      valor_total: valorTotal,
      rubricas,
      iban_predio: escolherIbanContaPorTipo(contasPredio, "Quota Ordinária") || predio?.iban || "",
      codigo_verificacao_hash: hash,
      emitido_por: "José Carlos Guerra (Administrador do Condomínio)",
      adminSignatureBase64: predio?.patrimonio?.assinatura_admin_base64 || "sem-assinatura-digital"
    };

    const predioParaRecibo = predio || { id_predio: recibo.id_predio, nome: "Condomínio", morada_linha1: "", num_porta: "", codigo_postal: "", localidade: "", nif: "" };

    const doc = generateOfficialReceiptPDF(recibo, predioParaRecibo, fracao);
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const nomeFicheiro = nomeFicheiroRecibo(recibo);

    const caminho = await guardarNoArquivo({
      pdfBuffer,
      ano: anoIni,
      tema: "Financeiro",
      tipo: "Recibo",
      predio: fracao.id_predio,
      fracao: pagamento.id_fracao,
      fluxo: "recibo_pos_divisao_meses",
      nomeFicheiro
    });

    await registarDocumento({
      caminho,
      ano: anoIni,
      tema: "Financeiro",
      tipo: "Recibo",
      predio: fracao.id_predio,
      fracao: pagamento.id_fracao,
      fluxo: "recibo_pos_divisao_meses",
      origem: "divisao_pagamento_meses",
      nomeFicheiro,
      categoria: "Pasta Paga. Quotas",
      visibilidade: "Público"
    });

    let emailEnviado = false;
    if (proprietarioEmail) {
      const modeloRecibo = await obterModeloEmail(fracao.id_predio, "recibo_pagamento");
      const valoresRecibo = {
        nome: proprietarioNome,
        fracao: fracaoNome,
        valor: `${valorTotal.toFixed(2)} €`,
        data: new Date(recibo.data_pagamento).toLocaleDateString("pt-PT"),
        metodo: recibo.metodo_pagamento
      };
      emailEnviado = await enviarEmailPDF({
        to: proprietarioEmail,
        nomeDestinatario: proprietarioNome,
        assunto: modeloRecibo
          ? interpolarModeloEmail(modeloRecibo.subject, valoresRecibo)
          : `Recibo de Pagamento (${numMeses} meses) — ${fracaoNome}`,
        mensagem: modeloRecibo
          ? interpolarModeloEmail(modeloRecibo.body, valoresRecibo).replace(/\n/g, "<br>")
          : `Segue em anexo o recibo de pagamento referente à fração <strong>${fracaoNome}</strong>, no valor total de <strong>${valorTotal.toFixed(2)} €</strong>, correspondente a <strong>${numMeses} meses</strong> de quota.`,
        pdfBuffer,
        nome: nomeFicheiro
      });
    }

    return res.status(200).json({
      status: "ok",
      meses_criados: numMeses,
      recibo_caminho: caminho,
      email_enviado: emailEnviado
    });
  } catch (e) {
    console.error("Erro em dividir-pagamento-meses:", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
