import { supabase } from "../services/lib/supabaseClient.js";
import { gerarHtmlAutoresponder, gerarHtmlResposta } from "../services/lib/htmlemail.js";

// -----------------------------
// 1. Classificador LOCAL (sem AI Studio)
// -----------------------------
async function classificarCategoria(texto) {
  try {
    const lower = texto.toLowerCase();

    if (lower.includes("ata") || lower.includes("assembleia")) return "assembleia";
    if (lower.includes("quota") || lower.includes("pagamento")) return "pagamentos";
    if (lower.includes("ruído") || lower.includes("barulho")) return "ruido";
    if (lower.includes("avaria") || lower.includes("reparação")) return "avarias";

    return "geral";
  } catch (e) {
    console.error("Erro no classificarCategoria:", e);
    return "geral";
  }
}

// -----------------------------
// 2. Contexto da fração (Supabase)
// -----------------------------
async function obterContextoDaFracao(email) {
  try {
    const { data, error } = await supabase
      .from("fracoes")
      .select("id_fracao, id_predio, fracao_nome, email, contacto")
      .eq("email", email)
      .single();

    if (error) {
      console.error("Erro ao obter contexto da fração:", error);
      return null;
    }

    return data || null;
  } catch (e) {
    console.error("Erro no obterContextoDaFracao:", e);
    return null;
  }
}

// -----------------------------
// 3. Router LOCAL (sem AI Studio)
// -----------------------------
async function routerLocal(categoria, contexto) {
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

  return {
    subject,
    message,
    email_destino: contexto?.email || null,
    contacto_destino: contexto?.contacto || null,
  };
}

// -----------------------------
// 4. Anexos automáticos (tabela documentos)
// -----------------------------
async function obterAnexosDaFracao(id_predio) {
  try {
    const { data, error } = await supabase
      .from("documentos")
      .select("nome, url_foto")
      .eq("id_predio", id_predio);

    if (error || !data) {
      console.error("Erro ao obter anexos:", error);
      return [];
    }

    return data.map((doc) => ({
      filename: doc.nome,
      path: doc.url_foto,
    }));
  } catch (e) {
    console.error("Erro no obterAnexosDaFracao:", e);
    return [];
  }
}

// -----------------------------
// 5. HANDLER PRINCIPAL (SEM AI STUDIO)
// -----------------------------
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const { from, subject, body } = req.body || {};

    if (!from || !subject) {
      console.error("Payload inválido:", req.body);
      return res.status(400).json({ error: "Payload inválido" });
    }

    const textoEmail =
      body && String(body).trim().length > 0
        ? body
        : "(sem texto — email contém apenas anexos ou conteúdo não textual)";

    console.log("Inbound recebido:", { from, subject });

    // 1. Filtro anti‑fornecedores / noreply
    const remetente = from.toLowerCase();
    const bloqueados = [
      "noreply", "no-reply", "do-not-reply", "donotreply",
      "automated", "mailer-daemon", "postmaster",
      "newsletter", "marketing", "promo", "campaign",
      "edp.pt", "galp.com", "vodafone.pt", "meo.pt", "nos.pt",
      "seguradora", "sotecnisol", "conduril",
    ];

    if (bloqueados.some((b) => remetente.includes(b))) {
      console.log("Email ignorado:", from);
      return res.status(200).json({ ok: true, autoresponder: false });
    }

    // 2. Classificar categoria LOCAL
    const categoriaClassificada = await classificarCategoria(textoEmail);
    console.log("Categoria classificada:", categoriaClassificada);

    // 3. Obter contexto da fração
    const contexto = await obterContextoDaFracao(from);
    console.log("Contexto da fração:", contexto);

    // 4. Router LOCAL
    const routerData = await routerLocal(categoriaClassificada, contexto);

    // 5. Nome do remetente
    const nomeRemetente =
      contexto?.fracao_nome ||
      from?.split("@")[0] ||
      "Condómino";

    // 6. AUTORESPONDER
    const htmlAutoresponder = gerarHtmlAutoresponder(nomeRemetente);

    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Condomínio <administracao@condomanagerai.com>",
          to: from,
          subject: "Recebemos o seu contacto",
          html: htmlAutoresponder,
        }),
      });
      console.log("Autoresponder enviado para:", from);
    } catch (e) {
      console.error("Erro ao enviar autoresponder:", e);
    }

    // 7. RESPOSTA INSTITUCIONAL
    const htmlFinal = gerarHtmlResposta(nomeRemetente, routerData.message);

    let anexos = [];

    if (contexto?.id_predio) {
      const docsPredio = await obterAnexosDaFracao(contexto.id_predio);
      anexos.push(...docsPredio);
    }

    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Condomínio <administracao@condomanagerai.com>",
          to: from,
          subject: routerData.subject || subject,
          html: htmlFinal,
          attachments: anexos,
        }),
      });
      console.log("Email institucional enviado para:", from);
    } catch (e) {
      console.error("Erro ao enviar email institucional:", e);
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("Erro no ai-studio-inbound:", err);
    return res.status(500).json({
      error: "Erro no ai-studio-inbound",
      detail: err?.message || String(err),
    });
  }
}
