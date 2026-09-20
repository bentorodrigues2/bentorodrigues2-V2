import { createHash } from "crypto";
import { supabase } from "../server/lib/supabaseServer.js";
import { guardarNoArquivo, registarDocumento, enviarEmailPDF } from "../server/lib/pdfService.js";
import { generateOfficialReceiptPDF, nomeFicheiroRecibo } from "../server/lib/receiptGenerator.js";
import { derivarPrefixoEdificio } from "../server/lib/reciboUtils.js";
import { obterModeloEmail, interpolarModeloEmail } from "../server/lib/emailTemplates.js";

// Escolhe o IBAN certo consoante o tipo de aviso: Quota Ordinária e Fundo
// Comum de Reserva usam a conta corrente principal (is_principal), Quota
// Extraordinária usa a conta de poupança/obras — mesma lógica que
// escolherIbanContaPorTipo em src/utils.ts e server/lib/cronService.js.
function escolherIbanContaPorTipo(contas, tipoAviso) {
  if (!contas || contas.length === 0) return "";
  const ehExtraordinaria = (tipoAviso || "").toLowerCase().includes("extra");
  const contaPrincipal = contas.find((c) => c.is_principal);
  const contaSecundaria = contas.find((c) => !c.is_principal);
  if (ehExtraordinaria) return (contaSecundaria || contaPrincipal || contas[0])?.iban || "";
  return (contaPrincipal || contas[0])?.iban || "";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const { id_pagamento } = req.body || {};
    if (!id_pagamento) {
      return res.status(400).json({ error: "id_pagamento em falta" });
    }

    // 1) Confirmar pagamento
    const { data: pagamento, error: errPag } = await supabase
      .from("pagamentos")
      .update({ estado: "confirmado", confirmado_em: new Date().toISOString() })
      .eq("id", id_pagamento)
      .select()
      .single();

    if (errPag || !pagamento) {
      return res.status(404).json({ error: "Pagamento não encontrado", detail: errPag?.message });
    }

    // 1.1) Resolver também o movimento ligado a este pagamento (criado pelo
    // mesmo email automático — ver server/lib/inboundProcessor.js, que grava
    // a marca "[pagamento:<id>]" na descrição por não haver FK entre as duas
    // tabelas). Sem isto, o movimento fica "Por Justificar" para sempre
    // mesmo depois do pagamento estar confirmado.
    try {
      await supabase
        .from("movimentos")
        .update({
          estado: "Justificado",
          estado_conciliacao: "CONCILIADO",
          is_movimento_cego: false
        })
        .ilike("descricao", `%[pagamento:${id_pagamento}]%`);
    } catch (errMovLink) {
      console.warn("[confirmar-pagamento] Aviso ao atualizar movimento ligado:", errMovLink?.message || errMovLink);
    }

    // 1.2) Marcar como "Pago" o(s) aviso(s) (nota de cobrança) correspondentes
    // a este pagamento, para que os emails automáticos de lembrete/mora (ver
    // server/lib/cronService.js) deixem de ser enviados a quem já pagou. Os
    // avisos são criados aos pares (Quota Ordinária + Fundo de Reserva) com a
    // mesma data de emissão — agrupa por data e escolhe o grupo pendente cuja
    // soma bate certo com o valor pago; sem correspondência exata, assume o
    // grupo pendente mais antigo (aviso é uma tabela sem FK direta para
    // pagamentos, tal como os movimentos).
    try {
      if (pagamento.id_fracao) {
        const { data: pendentesAvisos } = await supabase
          .from("avisos")
          .select("*")
          .eq("id_fracao", pagamento.id_fracao)
          .eq("estado", "Pendente")
          .order("data", { ascending: true });

        if (pendentesAvisos?.length) {
          const grupos = {};
          for (const av of pendentesAvisos) {
            (grupos[av.data] = grupos[av.data] || []).push(av);
          }
          const chavesOrdenadas = Object.keys(grupos).sort();
          const valorPago = Number(pagamento.valor || 0);
          let grupoAlvo = chavesOrdenadas
            .map((k) => grupos[k])
            .find((g) => Math.abs(g.reduce((s, a) => s + Number(a.valor || 0), 0) - valorPago) < 0.05);
          if (!grupoAlvo) grupoAlvo = grupos[chavesOrdenadas[0]];

          if (grupoAlvo?.length) {
            await supabase
              .from("avisos")
              .update({ estado: "Pago" })
              .in("id_aviso", grupoAlvo.map((a) => a.id_aviso));
          }
        }
      }
    } catch (errAvisos) {
      console.warn("[confirmar-pagamento] Aviso ao atualizar avisos ligados:", errAvisos?.message || errAvisos);
    }

    // 2) Buscar proprietário e fração separadamente (sem depender de relações
    // embutidas do PostgREST, que exigem FKs registadas na cache do schema)
    const [{ data: proprietario }, { data: fracao }] = await Promise.all([
      pagamento.id_proprietario
        ? supabase.from("proprietarios").select("nome, email, nif").eq("id_proprietario", pagamento.id_proprietario).maybeSingle()
        : Promise.resolve({ data: null }),
      pagamento.id_fracao
        ? supabase.from("fracoes").select("fracao_nome, id_predio, piso, permilagem").eq("id_fracao", pagamento.id_fracao).maybeSingle()
        : Promise.resolve({ data: null })
    ]);

    const { data: predio } = fracao?.id_predio
      ? await supabase.from("predios").select("*").eq("id_predio", fracao.id_predio).maybeSingle()
      : { data: null };

    const { data: contasPredio } = fracao?.id_predio
      ? await supabase.from("contas").select("iban, is_principal").eq("id_predio", fracao.id_predio)
      : { data: [] };

    const nomeDestinatario = proprietario?.nome || pagamento.entidade || "Condómino(a)";
    const emailDestinatario = proprietario?.email || null;
    const fracaoNome = fracao?.fracao_nome || pagamento.fracao || "Fração";
    const ano = new Date(pagamento.data_pagamento || pagamento.criado_em || Date.now()).getFullYear();

    // 3) Montar e gerar o recibo oficial (mesmo template legal usado no
    // frontend em src/utils/receiptGenerator.ts — compilado para
    // server/lib/receiptGenerator.js no build). Numeração: prefixo do
    // edifício + sequencial de 5 dígitos, ex. "BR2 00195".
    const hash = createHash("sha256").update(`${pagamento.id}-${pagamento.valor}-${pagamento.confirmado_em}`).digest("hex");
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
      ano,
      id_predio: fracao?.id_predio || "",
      id_fracao: pagamento.id_fracao || "",
      nome_condomino: nomeDestinatario,
      nif_condomino: proprietario?.nif || "",
      fracao_nome: fracaoNome,
      permilagem: fracao?.permilagem || 0,
      data_emissao: new Date().toISOString().split("T")[0],
      data_pagamento: pagamento.data_pagamento || new Date().toISOString().split("T")[0],
      metodo_pagamento: "Transferência Bancária",
      valor_total: Number(pagamento.valor || 0),
      // Divisão legal mínima (DL 268/94, Art. 4.º): 10% do valor da quota
      // reverte obrigatoriamente para o Fundo Comum de Reserva.
      rubricas: (() => {
        const total = Number(pagamento.valor || 0);
        const valorReserva = Math.round(total * 0.10 * 100) / 100;
        const valorQuota = Math.round((total - valorReserva) * 100) / 100;
        return [
          { descricao: pagamento.descricao || "Quota de Condomínio", valor: valorQuota, tipo: "Quota Ordinária" },
          { descricao: "Fundo Comum de Reserva (10% legal)", valor: valorReserva, tipo: "Fundo Comum de Reserva" }
        ];
      })(),
      iban_predio: escolherIbanContaPorTipo(contasPredio, "Quota Ordinária") || predio?.iban || "",
      codigo_verificacao_hash: hash,
      emitido_por: "José Carlos Guerra (Administrador do Condomínio)",
      // A assinatura é guardada em predios.patrimonio.assinatura_admin_base64
      // (ver src/components/GestaoFracoes.tsx) — se não existir, o gerador
      // do recibo já trata graciosamente (imprime só o nome do administrador).
      adminSignatureBase64: predio?.patrimonio?.assinatura_admin_base64 || "sem-assinatura-digital"
    };

    const predioParaRecibo = predio || { id_predio: recibo.id_predio, nome: "Condomínio", morada_linha1: "", num_porta: "", codigo_postal: "", localidade: "", nif: "" };

    const doc = generateOfficialReceiptPDF(recibo, predioParaRecibo, fracao || {});
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const nomeFicheiro = nomeFicheiroRecibo(recibo);

    const caminho = await guardarNoArquivo({
      pdfBuffer,
      ano,
      tema: "Financeiro",
      tipo: "Recibo",
      predio: fracao?.id_predio || "geral",
      fracao: pagamento.id_fracao || "geral",
      fluxo: "recibo_pos_confirmacao",
      nomeFicheiro
    });

    await registarDocumento({
      caminho,
      ano,
      tema: "Financeiro",
      tipo: "Recibo",
      predio: fracao?.id_predio || null,
      fracao: pagamento.id_fracao || null,
      fluxo: "recibo_pos_confirmacao",
      origem: "confirmacao_pagamento",
      nomeFicheiro,
      categoria: "Pasta Paga. Quotas",
      visibilidade: "Público"
    });

    if (emailDestinatario) {
      const modeloRecibo = await obterModeloEmail(fracao?.id_predio, "recibo_pagamento");
      const valoresRecibo = {
        nome: nomeDestinatario,
        fracao: fracaoNome,
        valor: `${recibo.valor_total.toFixed(2)} €`,
        data: new Date(recibo.data_pagamento).toLocaleDateString("pt-PT"),
        metodo: recibo.metodo_pagamento
      };

      await enviarEmailPDF({
        to: emailDestinatario,
        nomeDestinatario,
        assunto: modeloRecibo
          ? interpolarModeloEmail(modeloRecibo.subject, valoresRecibo)
          : `Recibo de Pagamento — ${fracaoNome}`,
        mensagem: modeloRecibo
          ? interpolarModeloEmail(modeloRecibo.body, valoresRecibo).replace(/\n/g, "<br>")
          : `Segue em anexo o recibo de pagamento referente à fração <strong>${fracaoNome}</strong>, no valor de <strong>${recibo.valor_total.toFixed(2)} €</strong>.`,
        pdfBuffer,
        nome: nomeFicheiro
      });
    }

    return res.status(200).json({
      status: "ok",
      pagamento_confirmado: pagamento.id,
      recibo_caminho: caminho,
      email_enviado: Boolean(emailDestinatario)
    });
  } catch (e) {
    console.error("Erro em confirmar-pagamento:", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
