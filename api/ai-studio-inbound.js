import { supabase } from "../services/lib/supabaseClient.js";
import { gerarHtmlAutoresponder, gerarHtmlResposta } from "../services/lib/htmlemail.js";

// -----------------------------
// 1. Classificador via AI Studio Classificador
// -----------------------------
async function classificarCategoria(texto) {
  const resposta = await fetch(process.env.AI_STUDIO_CLASSIFICADOR_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_STUDIO_API_KEY}`,
    },
    body: JSON.stringify({ texto }),
  });

  const data = await resposta.json();
  return data?.categoria || null;
}

// -----------------------------
// 2. Contexto da fração (Supabase)
// -----------------------------
async function obterContextoDaFracao(email) {
  const { data } = await supabase
    .from("fracoes")
    .select("*")
    .eq("email", email)
    .single();

  return data || null;
}

// -----------------------------
// 3. Anexos automáticos (tabela documentos)
// -----------------------------
async function obterAnexosDaFracao(id_predio) {
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
}

// -----------------------------
// 4. HANDLER PRINCIPAL
// -----------------------------
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const { from, subject, body } = req.body;

    if (!from || !subject || !body) {
      return res.status(400).json({ error: "Payload inválido" });
    }

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
      console.log("Email ignorado (fornecedor/noreply):", from);
      return res.status(200).json({ ok: true, autoresponder: false });
    }

    // 2. Classificar categoria
    const categoriaClassificada = await classificarCategoria(body);

    // 3. Obter contexto da fração
    const contexto = await obterContextoDaFracao(from);

    // 4. Enviar para o Router (AI Studio Router)
    const aiRes = await fetch(process.env.AI_STUDIO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_STUDIO_API_KEY}`,
      },
      body: JSON.stringify({
        email: {
          from,
          subject,
          bodyText: body,
        },
        categoria: categoriaClassificada,
        contexto,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      console.error("Erro no router AI Studio:", errText);
      return res.status(500).json({ error: "Erro no router AI Studio" });
    }

    const aiData = await aiRes.json();

    // 5. Nome do remetente
    const nomeRemetente =
      contexto?.nome ||
      from?.split("@")[0] ||
      "Condómino";

    //
    // 6. PRIMEIRO EMAIL → AUTORESPONDER
    //
    const htmlAutoresponder = gerarHtmlAutoresponder(nomeRemetente);

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
        html: htmlAutoresponder
      }),
    });

    //
    // 7. SEGUNDO EMAIL → RESPOSTA INSTITUCIONAL (AI ROUTER)
    //

    // Se o AI Router falhar, não envia o institucional
    if (!aiData.subject || !aiData.message) {
      console.log("AI Router devolveu subject/message nulos → só autoresponder enviado.");
      return res.status(200).json({ ok: true, autoresponder: true });
    }

    const htmlFinal = gerarHtmlResposta(nomeRemetente, aiData.message);

    // 8. Anexos automáticos
    let anexos = [];
    if (aiData.acao === "anexar_documentos" && contexto?.id_predio) {
      anexos = await obterAnexosDaFracao(contexto.id_predio);
    }

    // 9. Enviar email institucional via Resend
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Condomínio <administracao@condomanagerai.com>",
        to: from,
        subject: aiData.subject || subject,
        html: htmlFinal,
        attachments: anexos
      }),
    });

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("Erro no ai-studio-inbound:", err);
    return res.status(500).json({
      error: "Erro no ai-studio-inbound",
      detail: err?.message || String(err),
    });
  }
}
