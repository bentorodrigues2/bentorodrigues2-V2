import {
  OFFICIAL_EMAIL_ROUTER_TEMPLATES,
  AI_STUDIO_ROUTER_LOGO_HTML,
  AI_STUDIO_ROUTER_SIGNATURE_HTML,
  PROMPT_COMPLETO_AI_STUDIO,
  classifyEmailCategory,
  generateCategoryResponse,
  getFallbackCategoryResponse,
  processAutoresponderEmail
} from "../server/geminiService.js";

export default async function handler(req, res) {
  const acao = req.query?.acao || req.body?.acao;

  // 1. TEMPLATES (/api/ai-studio-router/templates -> ?acao=router-templates)
  if (
    acao === "router-templates" ||
    acao === "templates" ||
    req.query?.templates !== undefined ||
    (typeof req.url === "string" && req.url.includes("templates"))
  ) {
    return res.status(200).json({
      status: "ok",
      logotipoHtml: AI_STUDIO_ROUTER_LOGO_HTML,
      assinaturaHtml: AI_STUDIO_ROUTER_SIGNATURE_HTML,
      promptCompleto: PROMPT_COMPLETO_AI_STUDIO,
      templates: OFFICIAL_EMAIL_ROUTER_TEMPLATES
    });
  }

  // 2. AUTORESPONDER (/api/autoresponder -> ?acao=autoresponder)
  if (acao === "autoresponder") {
    if (req.method === "GET") {
      return res.status(200).json({ status: "online", endpoint: "/api/autoresponder" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const result = await processAutoresponderEmail(req.body);
      return res.status(result.status || 200).json(result);
    } catch (err) {
      console.error("[api/email?acao=autoresponder] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro no autoresponder" });
    }
  }

  // 3. CLASSIFICADOR (/api/classificador -> ?acao=classificador)
  if (acao === "classificador") {
    if (req.method === "GET") {
      return res.status(200).json({ status: "online", endpoint: "/api/classificador" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const result = await classifyEmailCategory(req.body);
      return res.status(200).json(result);
    } catch (err) {
      console.error("[api/email?acao=classificador] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro no classificador" });
    }
  }

  // 4. RESPOSTA CATEGORIA (/api/resposta-categoria -> ?acao=resposta-categoria)
  if (acao === "resposta-categoria") {
    if (req.method === "GET") {
      return res.status(200).json({ status: "online", endpoint: "/api/resposta-categoria" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const result = await generateCategoryResponse(req.body);
      return res.status(200).json(result);
    } catch (err) {
      console.error("[api/email?acao=resposta-categoria] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro ao gerar resposta por categoria" });
    }
  }

  // 5. ROUTER GERAL (/api/ai-studio-router -> ?acao=router)
  if (acao === "router" || acao === "ai-studio-router" || !acao) {
    if (req.method === "GET") {
      const hasKey = Boolean(process.env.GEMINI_API_KEY);
      return res.status(200).json({
        status: "online",
        router: "AI Studio Router (Bento Rodrigues Condomínios)",
        geminiKeyConfigurada: hasKey,
        totalCategorias: Object.keys(OFFICIAL_EMAIL_ROUTER_TEMPLATES).length,
        categorias: Object.keys(OFFICIAL_EMAIL_ROUTER_TEMPLATES),
        logotipoUrl: "https://bentorodrigues2.vercel.app/email/20-logotipo.webp",
        instrucoes: "Endpoint pronto para chamadas POST de autoresponder com as 13 categorias e logotipo oficial."
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const body = req.body || {};
      const email = body.email || {};
      const contexto = body.contexto || {};
      let categoria = body.categoria;

      // Se categoria não foi enviada, classificar primeiro
      if (!categoria) {
        const classif = await classifyEmailCategory({
          from: email.from || "",
          subject: email.subject || "",
          bodyText: email.bodyText || ""
        });
        categoria = classif.categoria;
      }

      const result = await generateCategoryResponse({
        categoria,
        email,
        contexto
      });

      return res.status(200).json(result);
    } catch (err) {
      const errStr = String(err?.message || err);
      const isBlocked =
        errStr.includes("API_KEY_SERVICE_BLOCKED") ||
        errStr.includes("UNAUTHENTICATED") ||
        errStr.includes("401");

      console.warn(
        "[api/email?acao=router] Erro no Gemini, acionando contingência:",
        errStr
      );

      const fallbackOutput = getFallbackCategoryResponse(
        req.body?.categoria || "outro",
        req.body?.email?.subject || "",
        req.body?.email?.bodyText || "",
        req.body?.contexto || {}
      );

      return res.status(200).json({
        subject: fallbackOutput.subject,
        message: fallbackOutput.message,
        categoria: fallbackOutput.categoria,
        source: "fallback_contingencia_oficial",
        diagnostico: {
          aviso: isBlocked
            ? "GEMINI_API_KEY com restrições na Google Cloud Console (API_KEY_SERVICE_BLOCKED)."
            : "Resposta gerada pelo motor institucional de 13 categorias oficiais.",
          detalhe: errStr
        }
      });
    }
  }

  return res.status(400).json({
    error: "Ação não especificada ou inválida. Use ?acao=autoresponder|classificador|resposta-categoria|router|router-templates"
  });
}
