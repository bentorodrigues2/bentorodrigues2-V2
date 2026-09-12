import { supabase } from "../services/lib/supabaseClient.js";
import { gerarHtmlAutoresponder, gerarHtmlResposta } from "../services/lib/htmlemail.js";

// -----------------------------
// 1. Classificador LOCAL
// -----------------------------
async function classificarCategoria(texto) {
  try {
    const lower = texto.toLowerCase();

    if (lower.includes("ata") || lower.includes("assembleia")) return "assembleia";
    if (lower.includes("quota") || lower.includes("pagamento")) return "pagamentos";
    if (lower.includes("ruído") || lower.includes("barulho")) return "ruido";
    if (lower.includes("avaria") || lower.includes("reparação")) return "avarias";

    return "geral";
  } catch {
    return "geral";
  }
}

// -----------------------------
// 2. Contexto da fração
// -----------------------------
async function obterContextoDaFracao(email) {
  try {
    const { data } = await supabase
      .from("fracoes")
      .select("id_fracao, id_predio, fracao_nome, email, contacto")
      .eq("email", email)
      .single();

    return data || null;
  } catch {
    return null;
  }
}

// -----------------------------
// 3. Router LOCAL (fallback)
// -----------------------------
function routerLocal(categoria) {
  switch (categoria) {
    case "assembleia":
      return {
        subject: "Re: Pedido de ata da assembleia",
        message: `Olá,\n\nSegue a ata solicitada referente à assembleia.\n\nCumprimentos,\nAdministração`
      };

    case "pagamentos":
      return {
        subject: "Re: Informação sobre quotas/pagamentos",
        message: `Olá,\n\nRelativamente ao seu pedido, aqui está a informação sobre quotas.\n\nCumprimentos,\nAdministração`
      };

    case "ruido":
      return {
        subject: "Re: Situação de ruído",
        message: `Olá,\n\nA situação de ruído foi registada e será analisada.\n\nCumprimentos,\nAdministração`
      };

    case "avarias":
      return {
        subject: "Re: Avaria reportada",
        message: `Olá,\n\nA avaria foi registada. A administração irá proceder conforme necessário.\n\nCumprimentos,\nAdministração`
      };

    default:
      return {
        subject: "Re: Pedido recebido",
        message: `Olá,\n\nO seu pedido foi recebido e será tratado.\n\nCumprimentos,\nAdministração`
      };
  }
}

// -----------------------------
// 4. Handler principal
// -----------------------------
export default async function handler(req, res) {
  try {
    const { from, subject, body } = req.body || {};

    const textoEmail = body?.trim() || "(sem texto)";
    const emailLimpo = from.replace(/"/g, "").replace(/.*</, "").replace(/>.*/, "").trim();

    // 1. Autoresponder imediato
    const contexto = await obterContextoDaFracao(emailLimpo);
    const nomeRemetente =
      contexto?.fracao_nome ||
      emailLimpo.split("@")[0] ||
      "Condómino";

    const htmlAutoresponder = gerarHtmlAutoresponder(nomeRemetente);

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Condomínio <administracao@condomanagerai.com>",
        to: emailLimpo,
        subject: "Recebemos o seu contacto",
        html: htmlAutoresponder,
      }),
    });

    // 2. Classificação
    const categoria = await classificarCategoria(textoEmail);

    // 3. Router inteligente
    let routerData;
    try {
      const routerResp = await fetch(
        "https://bentorodrigues2.vercel.app/api/ai-studio?acao=router",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoria,
            id_fracao: contexto?.id_fracao || null
          })
        }
      );

      routerData = await routerResp.json();
    } catch {
      routerData = routerLocal(categoria);
    }

    // 4. Resposta final inteligente
    const htmlFinal = gerarHtmlResposta(nomeRemetente, routerData.message);

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Condomínio <administracao@condomanagerai.com>",
        to: emailLimpo,
        subject: routerData.subject || subject,
        html: htmlFinal,
      }),
    });

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("Erro no ai-studio-inbound:", err);
    return res.status(500).json({ ok: false });
  }
}
