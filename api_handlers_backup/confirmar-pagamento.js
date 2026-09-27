import { createHash } from "crypto";
import { supabase } from "../server/lib/supabaseServer.js";
import { guardarNoArquivo, registarDocumento, enviarEmailPDF } from "../server/lib/pdfService.js";
import { generateOfficialReceiptPDF, nomeFicheiroRecibo } from "../server/lib/receiptGenerator.js";
import { derivarPrefixoEdificio } from "../server/lib/reciboUtils.js";
import { obterModeloEmail, interpolarModeloEmail } from "../server/lib/emailTemplates.js";
import { escolherContaPorTipo, ajustarSaldoConta } from "../server/lib/contaSaldo.js";

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

    // avisos_ids (opcional): quando o chamador (ex: aprovarPagamentoCondomino
    // em GestaoMovimentos.tsx) já sabe exatamente quais avisos este pagamento
    // fecha — 1 ou vários meses/prestações de uma vez — e já os marcou "Pago"
    // antes de chamar este endpoint. Nesse caso o recibo é montado com 1
    // linha por aviso real (mês/tipo/valor certos) em vez de adivinhar sempre
    // "Quota Ordinária + 10% Fundo de Reserva", e o passo 2.1 abaixo (que
    // tentava adivinhar o aviso a marcar) fica desligado, para não criar um
    // aviso-fantasma duplicado a repetir o que o chamador já fez.
    const { id_pagamento, avisos_ids: avisosIdsFechados } = req.body || {};
    if (!id_pagamento) {
      return res.status(400).json({ error: "id_pagamento em falta" });
    }

    // 0) Impede confirmar duas vezes o mesmo pagamento (ex: duplo clique) —
    // sem isto o saldo da conta seria creditado outra vez a mais abaixo.
    const { data: pagamentoAntes } = await supabase
      .from("pagamentos")
      .select("estado")
      .eq("id", id_pagamento)
      .maybeSingle();
    if (!pagamentoAntes) {
      return res.status(404).json({ error: "Pagamento não encontrado" });
    }
    if (pagamentoAntes.estado === "confirmado") {
      return res.status(400).json({ error: "Este pagamento já foi confirmado anteriormente." });
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

    // 2) Buscar proprietário e fração separadamente (sem depender de relações
    // embutidas do PostgREST, que exigem FKs registadas na cache do schema).
    // A tabela "proprietarios" tem registos com formatos de id inconsistentes
    // (ex: "prop-<nif>" vs "<nif>" cru) e nem sempre existe uma linha ligada
    // a este pagamento (id_proprietario pode ficar null nalguns fluxos) — por
    // isso o JSON fracoes.proprietario, que é a cópia que a app efetivamente
    // mantém sempre atualizada (ver o mesmo raciocínio em
    // server/lib/inboundProcessor.js/obterContexto), é a fonte principal do
    // nome/email/NIF; a tabela "proprietarios" fica só como resguardo.
    const [{ data: proprietario }, { data: fracao }] = await Promise.all([
      pagamento.id_proprietario
        ? supabase.from("proprietarios").select("nome, email, nif").eq("id_proprietario", pagamento.id_proprietario).maybeSingle()
        : Promise.resolve({ data: null }),
      pagamento.id_fracao
        ? supabase.from("fracoes").select("fracao_nome, id_predio, piso, permilagem, proprietario").eq("id_fracao", pagamento.id_fracao).maybeSingle()
        : Promise.resolve({ data: null })
    ]);

    const { data: predio } = fracao?.id_predio
      ? await supabase.from("predios").select("*").eq("id_predio", fracao.id_predio).maybeSingle()
      : { data: null };

    const { data: contasPredio } = fracao?.id_predio
      ? await supabase.from("contas").select("id_conta, iban, is_principal").eq("id_predio", fracao.id_predio)
      : { data: [] };

    // "NA" é o valor usado em toda a app para um condómino que recusou
    // fornecer o email (ver GestaoFracoes.tsx) — não é um endereço válido
    // para tentar enviar, conta como "sem email" tal como null/vazio.
    const emailValido = (valor) => {
      const v = (valor || "").trim();
      return v && v.toUpperCase() !== "NA" && /\S+@\S+\.\S+/.test(v) ? v : null;
    };

    const proprietarioFracao = fracao?.proprietario;
    const nomeDestinatario = proprietarioFracao?.nome || proprietario?.nome || pagamento.entidade || "Condómino(a)";
    const emailDestinatario = emailValido(proprietarioFracao?.email) || emailValido(proprietario?.email);
    const nifDestinatario = proprietarioFracao?.nif || proprietario?.nif || "";
    const fracaoNome = fracao?.fracao_nome || pagamento.fracao || "Fração";
    const ano = new Date(pagamento.data_pagamento || pagamento.criado_em || Date.now()).getFullYear();

    // 2.1) Marcar como "Pago" o aviso (nota de cobrança) correspondente a
    // este pagamento, para o Mapa de Pagamentos e os lembretes de mora (ver
    // server/lib/cronService.js) refletirem que já foi liquidado. Escolhe
    // sempre o aviso PENDENTE individual mais antigo cujo valor bate certo
    // com o que foi pago (nunca "o resto de um grupo" — avisos retroativos
    // partilham data de emissão, "data" nunca é o mês real, ver vencimento).
    //
    // Se não existir NENHUM aviso pendente que bata certo (ex: a fração
    // nunca chegou a ter nota emitida para este mês — aconteceu com várias
    // frações de teste), o pagamento ficava confirmado e o recibo enviado,
    // mas nada aparecia no Mapa de Pagamentos nem no histórico de avisos,
    // como se tivesse desaparecido. Cria-se agora, nesse caso, um aviso já
    // "Pago" com o mês do próprio pagamento, para nunca ficar por registar.
    try {
      if (pagamento.id_fracao && !(avisosIdsFechados && avisosIdsFechados.length)) {
        const valorPago = Number(pagamento.valor || 0);
        const { data: pendentesAvisos } = await supabase
          .from("avisos")
          .select("*")
          .eq("id_fracao", pagamento.id_fracao)
          .eq("estado", "Pendente");

        const ordenados = [...(pendentesAvisos || [])].sort(
          (a, b) => new Date(a.vencimento || a.data).getTime() - new Date(b.vencimento || b.data).getTime()
        );
        const avisoAlvo = ordenados.find((a) => Math.abs(Number(a.valor || 0) - valorPago) < 0.05);

        // Se este pagamento já foi dividido em N meses (ver dividir-pagamento-meses.js),
        // já existem avisos "aviso-dividido-<id_pagamento>-*" a representá-lo —
        // criar aqui mais um aviso avulso duplicaria o valor.
        const { data: jaDivididoEm } = await supabase
          .from("avisos")
          .select("id_aviso")
          .ilike("id_aviso", `aviso-dividido-${pagamento.id}-%`)
          .limit(1);

        if (avisoAlvo) {
          await supabase.from("avisos").update({ estado: "Pago" }).eq("id_aviso", avisoAlvo.id_aviso);
        } else if (!jaDivididoEm?.length) {
          const dataRef = pagamento.data_pagamento || new Date().toISOString().split("T")[0];
          await supabase.from("avisos").insert({
            id_aviso: `aviso-confirmado-${pagamento.id}`,
            id_predio: fracao?.id_predio || null,
            id_fracao: pagamento.id_fracao,
            tipo: "Quota Ordinária",
            data: dataRef,
            vencimento: dataRef,
            descricao: `Quota Ordinária — pagamento confirmado (${pagamento.entidade || "Transferência Bancária"}).`,
            valor: valorPago,
            valor_fundo_reserva: Math.round(valorPago * 0.10 * 100) / 100,
            estado: "Pago",
            proprietario_nome: nomeDestinatario,
            proprietario_nif: nifDestinatario
          });
        }
      }
    } catch (errAvisos) {
      console.warn("[confirmar-pagamento] Aviso ao atualizar avisos ligados:", errAvisos?.message || errAvisos);
    }

    // 2.2) Creditar o saldo real da conta bancária — sem isto, confirmar um
    // pagamento nunca refletia a entrada de dinheiro nos KPIs "Conta(s) à
    // Ordem"/"Total Líquido" do Painel de Controlo (ficavam sempre parados
    // no valor de arranque, apesar de haver pagamentos confirmados a mais).
    //
    // Salta este passo quando o chamador já indicou avisos_ids
    // (aprovarPagamentoCondomino, no Assistente de Extração de Extratos) —
    // esse fluxo já credita o saldo da CONTA CERTA diretamente (a conta do
    // separador/extrato ativo) antes de chamar este endpoint; creditar aqui
    // outra vez duplicava o valor E usava sempre a conta "Quota Ordinária"
    // fixa, mesmo quando o pagamento era de Quota Extraordinária numa conta
    // diferente (bug confirmado: inflacionava o saldo a dobrar na conta
    // errada). Continua ativo para o outro fluxo (confirmarPagamentoEEnviarRecibo,
    // comprovativos "Pagamentos por Confirmar"), que nunca credita o saldo
    // antecipadamente.
    if (!(avisosIdsFechados && avisosIdsFechados.length)) {
      try {
        const contaAlvo = escolherContaPorTipo(contasPredio, "Quota Ordinária");
        if (contaAlvo?.id_conta) {
          await ajustarSaldoConta(contaAlvo.id_conta, Number(pagamento.valor || 0));
        }
      } catch (errSaldo) {
        console.warn("[confirmar-pagamento] Aviso ao creditar saldo da conta:", errSaldo?.message || errSaldo);
      }
    }

    // 2.3) Se o chamador indicou exatamente quais avisos este pagamento
    // fecha, busca-os reais — servem para montar o recibo com 1 linha por
    // mês/prestação (ver ponto 3) em vez de adivinhar a rubrica.
    let avisosFechadosReais = [];
    if (avisosIdsFechados && avisosIdsFechados.length) {
      const { data: avisosReais } = await supabase
        .from("avisos")
        .select("*")
        .in("id_aviso", avisosIdsFechados)
        .order("vencimento", { ascending: true });
      avisosFechadosReais = avisosReais || [];
    }
    // Tipo de quota deste pagamento (Ordinária vs Extraordinária) — decide a
    // conta/IBAN certos no recibo. Sem avisos reais associados, mantém-se
    // sempre "Quota Ordinária" (comportamento anterior, para o fluxo de
    // comprovativos por email que não passa avisos_ids).
    const tipoQuotaPagamento = avisosFechadosReais[0]?.tipo || "Quota Ordinária";

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
      nif_condomino: nifDestinatario,
      fracao_nome: fracaoNome,
      permilagem: fracao?.permilagem || 0,
      data_emissao: new Date().toISOString().split("T")[0],
      data_pagamento: pagamento.data_pagamento || new Date().toISOString().split("T")[0],
      // "entidade" é o banco que emitiu o comprovativo (ver
      // multimodalService.js), nunca o nome do condómino — mostra-se aqui,
      // junto do método, nunca em nome_condomino.
      metodo_pagamento: pagamento.entidade ? `Transferência Bancária — ${pagamento.entidade}` : "Transferência Bancária",
      valor_total: Number(pagamento.valor || 0),
      // Se há avisos reais associados (ver 2.3), 1 linha por mês/prestação
      // realmente fechado por este pagamento — cobre o pedido explícito de
      // "1 só recibo pelo total pago, discriminado por mês", em vez de
      // vários recibos ou de uma divisão inventada. Sem avisos associados
      // (fluxo antigo de comprovativo por email), mantém a divisão legal
      // mínima de 10% para o Fundo Comum de Reserva (DL 268/94, Art. 4.º).
      rubricas: avisosFechadosReais.length
        ? avisosFechadosReais.map((a) => ({ descricao: a.descricao || `${a.tipo} — vencimento ${a.vencimento || a.data}`, valor: Number(a.valor || 0), tipo: a.tipo }))
        : (() => {
            const total = Number(pagamento.valor || 0);
            const valorReserva = Math.round(total * 0.10 * 100) / 100;
            const valorQuota = Math.round((total - valorReserva) * 100) / 100;
            return [
              { descricao: pagamento.descricao || "Quota de Condomínio", valor: valorQuota, tipo: "Quota Ordinária" },
              { descricao: "Fundo Comum de Reserva (10% legal)", valor: valorReserva, tipo: "Fundo Comum de Reserva" }
            ];
          })(),
      iban_predio: escolherIbanContaPorTipo(contasPredio, tipoQuotaPagamento) || predio?.iban || "",
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
