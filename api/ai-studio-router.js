import {
  OFFICIAL_EMAIL_ROUTER_TEMPLATES,
  AI_STUDIO_ROUTER_LOGO_HTML,
  AI_STUDIO_ROUTER_SIGNATURE_HTML,
  PROMPT_COMPLETO_AI_STUDIO,
  classifyEmailCategory,
  generateCategoryResponse,
  getFallbackCategoryResponse
} from "../server/geminiService.ts";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const isTemplates =
      req.query?.templates !== undefined ||
      req.query?.acao === "templates" ||
      req.query?.view === "templates" ||
      (typeof req.url === "string" && req.url.includes("templates"));

    if (isTemplates) {
      return res.status(200).json({
        status: "ok",
        logotipoHtml: AI_STUDIO_ROUTER_LOGO_HTML,
        assinaturaHtml: AI_STUDIO_ROUTER_SIGNATURE_HTML,
        promptCompleto: PROMPT_COMPLETO_AI_STUDIO,
        templates: OFFICIAL_EMAIL_ROUTER_TEMPLATES
      });
    }

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

    // 1. Se categoria não foi enviada, classificar primeiro
    if (!categoria) {
      const classif = await classifyEmailCategory({
        from: email.from || "",
        subject: email.subject || "",
        bodyText: email.bodyText || ""
      });
      categoria = classif.categoria;
    }

    // 2. Gerar resposta por categoria (já possui fallback interno resiliente com logo e assinatura)
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
      "[/api/ai-studio-router] Erro no Gemini, acionando resposta institucional de contingência:",
      errStr
    );

    const fallbackOutput = getFallbackCategoryResponse(
      req.body?.categoria || "outro",
      req.body?.email?.subject || "",
      req.body?.email?.bodyText || "",
      req.body?.contexto || {}
    );

    // Resposta resiliente que NUNCA quebra a automação com 500 e SEMPRE respeita o formato com logotipo
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
