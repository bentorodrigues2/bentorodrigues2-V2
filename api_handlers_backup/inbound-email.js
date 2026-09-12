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
// 2. Contexto da fração (Supabase)
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
// 3. HANDLER PRINCIPAL
// -----------------------------
export default async function handler(req, res) {
  try {
    const { from, subject, body } = req.body || {};

    console.log("Inbound recebido:", { from, subject });

    const textoEmail = body?.trim() || "(sem texto)";

    // LIMPAR EMAIL
    const emailLimpo = from
      .replace(/"/g, "")
      .replace(/.*</, "")
      .replace(/>.*/, "")
      .trim();

    // CONTEXTO
    const contexto = await obterContextoDaFracao(emailLimpo);
    console.log("Contexto da fração:", contexto);

    // CLASSIFICAÇÃO
    const categoria = await classificarCategoria(textoEmail);

    // AUTORESPONDER IMEDIATO
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

    // -----------------------------
    // 4. CHAMAR ROUTER INTELIGENTE
    // -----------------------------
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

    const routerData = await routerResp.json();

    // RESPOSTA FINAL INTELIGENTE
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
        subject: routerData.subject,
        html: htmlFinal,
      }),
    });

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("Erro no inbound-email:", err);
    return res.status(500).json({ ok: false });
  }
}
