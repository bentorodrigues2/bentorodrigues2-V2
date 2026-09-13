import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // -----------------------------
    // 1. Validar body
    // -----------------------------
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({
        error: "Body inválido. Esperado { categoria, id_fracao }"
      });
    }

    const { categoria, id_fracao } = req.body;

    if (!categoria || typeof categoria !== "string") {
      return res.status(400).json({ error: "Categoria inválida ou em falta" });
    }

    if (!id_fracao) {
      return res.status(400).json({ error: "id_fracao em falta" });
    }

    // -----------------------------
    // 2. Buscar dados da fração
    // -----------------------------
    const { data: fracao, error: fracaoErr } = await supabase
      .from("fracoes")
      .select("id_fracao, id_predio, email, contacto, fracao_nome")
      .eq("id_fracao", id_fracao)
      .single();

    if (fracaoErr || !fracao) {
      console.error("Erro ao obter fração:", fracaoErr);
      return res.status(404).json({
        error: "Fração não encontrada",
        detalhe: fracaoErr?.message || null
      });
    }

    // -----------------------------
    // 3. Construção da resposta
    // -----------------------------
    let subject = "";
    let message = "";
    let categoria_contabilistica = null;

    switch (categoria) {

      case "comprovativo":
        subject = "Re: Comprovativo de pagamento recebido";
        message =
          `Acusamos a receção do comprovativo de pagamento.\n\n` +
          `Após confirmação contabilística, será emitido e enviado o respetivo recibo.`;
        categoria_contabilistica = "Despesas de Condomínio";
        break;

      case "faturas":
        subject = "Re: Fatura de fornecedor recebida";
        message =
          `Agradecemos o envio da fatura.\n\n` +
          `Será validada e encaminhada para processamento contabilístico.`;
        categoria_contabilistica = "Faturas de Fornecedores";
        break;

      case "orcamentos":
        subject = "Re: Orçamento recebido";
        message =
          `Agradecemos o envio do orçamento.\n\n` +
          `A administração irá analisar a proposta e entrará em contacto caso sejam necessários esclarecimentos adicionais.`;
        categoria_contabilistica = "Orçamentos / Propostas";
        break;

      case "assembleia":
        subject = "Re: Pedido de ata da assembleia";
        message = `Segue a ata solicitada referente à assembleia.`;
        categoria_contabilistica = "Assembleia";
        break;

      case "pagamentos":
        subject = "Re: Informação sobre quotas/pagamentos";
        message = `Relativamente ao seu pedido, aqui está a informação sobre quotas.`;
        categoria_contabilistica = "Quotas / Pagamentos";
        break;

      case "ruido":
        subject = "Re: Situação de ruído";
        message = `A situação de ruído foi registada e será analisada pela administração.`;
        categoria_contabilistica = "Ocorrências";
        break;

      case "avarias":
        subject = "Re: Avaria reportada";
        message = `A avaria foi registada. A administração irá proceder conforme necessário.`;
        categoria_contabilistica = "Avarias / Reparações";
        break;

      default:
        subject = "Re: Pedido recebido";
        message = `O seu pedido foi recebido e será tratado pela administração.`;
        categoria_contabilistica = "Geral";
        break;
    }

    // -----------------------------
    // 4. Resposta final
    // -----------------------------
    return res.status(200).json({
      ok: true,
      subject,
      message,
      categoria_contabilistica,
      id_predio: fracao.id_predio,
      email_destino: fracao.email || null,
      contacto_destino: fracao.contacto || null
    });

  } catch (err) {
    console.error("Erro no router:", err);
    return res.status(500).json({
      error: "Erro no router",
      detalhe: err?.message || String(err)
    });
  }
}
