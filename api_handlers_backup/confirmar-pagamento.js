import { createHash } from "crypto";
import { supabase } from "../server/lib/supabaseServer.js";
import { guardarNoArquivo, registarDocumento, enviarEmailPDF } from "../server/lib/pdfService.js";
import { generateOfficialReceiptPDF } from "../server/lib/receiptGenerator.js";

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

    const nomeDestinatario = proprietario?.nome || pagamento.entidade || "Condómino(a)";
    const emailDestinatario = proprietario?.email || null;
    const fracaoNome = fracao?.fracao_nome || pagamento.fracao || "Fração";
    const ano = new Date(pagamento.data_pagamento || pagamento.criado_em || Date.now()).getFullYear();

    // 3) Montar e gerar o recibo oficial (mesmo template legal usado no
    // frontend em src/utils/receiptGenerator.ts — compilado para
    // server/lib/receiptGenerator.js no build)
    const hash = createHash("sha256").update(`${pagamento.id}-${pagamento.valor}-${pagamento.confirmado_em}`).digest("hex");

    const recibo = {
      id_recibo: `REC-${ano}/${String(pagamento.id).slice(0, 8)}`,
      numero_sequencial: 1,
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
      iban_predio: predio?.iban || "",
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
    const nomeFicheiro = `recibo_${pagamento.id}.pdf`;

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
      nomeFicheiro
    });

    if (emailDestinatario) {
      await enviarEmailPDF({
        to: emailDestinatario,
        nomeDestinatario,
        assunto: `Recibo de Quitação — ${fracaoNome}`,
        mensagem: `Segue em anexo o recibo oficial de quitação referente à fração <strong>${fracaoNome}</strong>, no valor de <strong>${recibo.valor_total.toFixed(2)} €</strong>.`,
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
