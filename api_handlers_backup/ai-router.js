import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({
        error: "Body inválido. Esperado { categoria, id_fracao }"
      });
    }

    const { categoria, id_fracao } = req.body;

    if (!categoria) {
      return res.status(400).json({ error: "Categoria em falta" });
    }

    if (!id_fracao) {
      return res.status(400).json({ error: "id_fracao em falta" });
    }

    // Buscar dados da fração
    const { data: fracao, error } = await supabase
      .from("fracoes")
      .select("email, contacto, fracao_nome")
      .eq("id_fracao", id_fracao)
      .single();

    if (error) {
      console.error("Erro ao obter fração:", error);
      return res.status(500).json({ error: "Erro ao obter dados da fração" });
    }

    let subject = "";
    let message = "";

    switch (categoria) {

      // ✔ Comprovativos / Extratos bancários
      case "comprovativo":
        subject = "Re: Comprovativo de pagamento recebido";
        message =
          `Acusamos a receção do comprovativo de pagamento.\n\n` +
          `Após confirmação contabilística, será emitido e enviado o respetivo recibo.`;
        break;

      // ✔ Faturas de fornecedores
      case "faturas":
        subject = "Re: Fatura de fornecedor recebida";
        message =
          `Agradecemos o envio da fatura.\n\n` +
          `Será validada e encaminhada para processamento contabilístico.`;
        break;

      // ✔ Orçamentos / Propostas
      case "orcamentos":
        subject = "Re: Orçamento recebido";
        message =
          `Agradecemos o envio do orçamento.\n\n` +
          `A administração irá analisar a proposta e entrará em contacto caso sejam necessários esclarecimentos adicionais.`;
        break;

      // ✔ Assembleia / Ata
      case "assembleia":
        subject = "Re: Pedido de ata da assembleia";
        message =
          `Segue a ata solicitada referente à assembleia.`;
        break;

      // ✔ Quotas / Pagamentos
      case "pagamentos":
        subject = "Re: Informação sobre quotas/pagamentos";
        message =
          `Relativamente ao seu pedido, aqui está a informação sobre quotas.`;
        break;

      // ✔ Ruído
      case "ruido":
        subject = "Re: Situação de ruído";
        message =
          `A situação de ruído foi registada e será analisada pela administração.`;
        break;

      // ✔ Avarias
      case "avarias":
        subject = "Re: Avaria reportada";
        message =
          `A avaria foi registada. A administração irá proceder conforme necessário.`;
        break;

      // ✔ Geral
      default:
        subject = "Re: Pedido recebido";
        message =
          `O seu pedido foi recebido e será tratado pela administração.`;
        break;
    }

    return res.status(200).json({
      subject,
      message,
      email_destino: fracao?.email || null,
      contacto_destino: fracao?.contacto || null
    });

  } catch (err) {
    console.error("Erro no router:", err);
    return res.status(500).json({
      error: "Erro no router",
      detalhe: err?.message || String(err)
    });
  }
}
