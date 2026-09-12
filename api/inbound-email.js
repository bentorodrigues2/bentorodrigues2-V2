import { supabase } from "../services/lib/supabaseClient.js";
import { gerarHtmlAutoresponder, gerarHtmlResposta } from "../services/lib/htmlemail.js";

// -----------------------------
// 1. Classificador via AI Studio Classificador
// -----------------------------
async function classificarCategoria(texto) {
  try {
    const resposta = await fetch(process.env.AI_STUDIO_CLASSIFICADOR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_STUDIO_API_KEY}`,
      },
      body: JSON.stringify({ texto }),
    });

    if (!resposta.ok) {
      const errText = await resposta.text().catch(() => "");
      console.error("Classificador AI Studio falhou:", errText);
      return null;
    }

    const data = await resposta.json();
    return data?.categoria || null;
  } catch (e) {
    console.error("Erro no classificarCategoria:", e);
    return null;
  }
}

// -----------------------------
// 2. Contexto da fração (Supabase)
// -----------------------------
async function obterContextoDaFracao(email) {
  try {
    const { data, error } = await supabase
      .from("fracoes")
      .select("*")
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
// 3. Anexos automáticos (tabela documentos)
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
// 4. OPÇÃO B — Lançamento pendente de comprovativos
// -----------------------------
async function lancarComprovativoPendente(aiData, contexto, comprovativoUrl) {
  try {
    if (aiData?.categoria !== "COMPROVATIVO_QUOTA") return;

    await fetch(process.env.LANCAR_PAGAMENTO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estado: "pendente",
        fracao: contexto?.fracao || contexto?.id_fracao || null,
        valor: aiData?.dadosExtraidos?.valorTotal || null,
        dataDocumento: aiData?.dadosExtraidos?.dataDocumento || null,
        entidade: aiData?.dadosExtraidos?.entidade || null,
        comprovativoUrl,
      }),
    });
  } catch (e) {
    console.error("Erro ao lançar comprovativo pendente:", e);
  }
}

// -----------------------------
// 5. HANDLER PRINCIPAL
// -----------------------------
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const { from, subject, body } = req.body || {};

    if (!from || !subject) {
      console.error("Payload inválido (sem from ou subject):", req.body);
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
      console.log("Email ignorado (fornecedor/noreply):", from);
      return res.status(200).json({ ok: true, autoresponder: false });
    }

    // 2. Classificar categoria
    const categoriaClassificada = await classificarCategoria(textoEmail);
    console.log("Categoria classificada:", categoriaClassificada);

    // 3. Obter contexto da fração
    const contexto = await obterContextoDaFracao(from);
    console.log("Contexto da fração:", contexto?.id_predio || null);

    // 4. Enviar para o Router (AI Studio Router)
    const aiRes = await fetch(process.env.AI_STUDIO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_STUDIO_API_KEY}`,
      },
      body: JSON.stringify({
        email: { from, subject, bodyText: textoEmail },
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
    console.log("AI Router - Resposta:", aiData);

    // 5. Nome do remetente
    const nomeRemetente =
      contexto?.nome ||
      from?.split("@")[0] ||
      "Condómino";

    //
    // 6. AUTORESPONDER
    //
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
      console.error("Erro ao enviar autoresponder via Resend:", e);
    }

    //
    // 7. RESPOSTA INSTITUCIONAL
    //
    if (!aiData.subject || !aiData.message) {
      console.log("AI Router devolveu subject/message nulos → só autoresponder enviado.");
      return res.status(200).json({ ok: true, autoresponder: true });
    }

    const htmlFinal = gerarHtmlResposta(nomeRemetente, aiData.message);

    //
    // 8. ANEXOS DO AI STUDIO (PDFs, documentos, recibos, etc.)
    //
    let anexos = [];

    // 8.1 — Ficheiro único (ex: recibo PDF)
    if (aiData.ficheiro?.url) {
      anexos.push({
        filename: aiData.ficheiro.filename || "documento.pdf",
        path: aiData.ficheiro.url,
      });
    }

    // 8.2 — Lista de documentos
    if (Array.isArray(aiData.documentos)) {
      aiData.documentos.forEach((doc) => {
        anexos.push({
          filename: doc.filename || "documento.pdf",
          path: doc.url,
        });
      });
    }

    // 8.3 — Documentos automáticos da fração
    if (aiData.acao === "anexar_documentos" && contexto?.id_predio) {
      const docsPredio = await obterAnexosDaFracao(contexto.id_predio);
      anexos.push(...docsPredio);
    }

    //
    // 9. OPÇÃO B — Lançamento pendente de comprovativos
    //
    const comprovativoUrl = anexos?.[0]?.path || null;
    await lancarComprovativoPendente(aiData, contexto, comprovativoUrl);

    //
    // 10. Enviar email institucional via Resend
    //
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
          subject: aiData.subject || subject,
          html: htmlFinal,
          attachments: anexos,
        }),
      });
      console.log("Email institucional enviado para:", from);
    } catch (e) {
      console.error("Erro ao enviar email institucional via Resend:", e);
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
