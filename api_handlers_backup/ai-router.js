import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // Garantir que req.body existe
    if (!req.body || typeof req.body !== "object") {
      console.error("Router recebeu req.body undefined:", req.body);
      return res.status(400).json({
        error: "Body inválido. Esperado { categoria, id_fracao }"
      });
    }

    const { categoria, id_fracao } = req.body;

    // Validar categoria
    if (!categoria || typeof categoria !== "string") {
      console.error("Categoria inválida:", categoria);
      return res.status(400).json({ error: "Categoria em falta ou inválida" });
    }

    // Validar id_fracao
    if (!id_fracao) {
      console.error("id_fracao inválido:", id_fracao);
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
      return res.status(500).json({
        error: "Erro ao obter dados da fração",
        detalhe: error.message
      });
    }

    // Construção da resposta
    let subject = "";
    let message = "";

    switch (categoria) {
      case "assembleia":
        subject = "Re: Pedido de ata da assembleia";
        message = `Olá,\n\nSegue a ata solicitada referente à assembleia.\n\nCumprimentos,\nAdministração`;
        break;

      case "pagamentos":
        subject = "Re: Informação sobre quotas/pagamentos";
        message = `Olá,\n\nRelativamente ao seu pedido, aqui está a informação sobre quotas.\n\nCumprimentos,\nAdministração`;
        break;

      case "ruido":
        subject = "Re: Situação de ruído";
        message = `Olá,\n\nA situação de ruído foi registada e será analisada.\n\nCumprimentos,\nAdministração`;
        break;

      case "avarias":
        subject = "Re: Avaria reportada";
        message = `Olá,\n\nA avaria foi registada. A administração irá proceder conforme necessário.\n\nCumprimentos,\nAdministração`;
        break;

      default:
        subject = "Re: Pedido recebido";
        message = `Olá,\n\nO seu pedido foi recebido e será tratado.\n\nCumprimentos,\nAdministração`;
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
