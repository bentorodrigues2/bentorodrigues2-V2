export default async function handler(req, res) {
  try {
    // Parsing moderno WHATWG (elimina DEP0169)
    const fullUrl = new URL(req.url, `https://${req.headers.host}`);
    const acao = fullUrl.searchParams.get("acao");

    if (acao === "inbound") {
      const mod = await import("../api_handlers_backup/ai-studio-inbound.js");
      return mod.default(req, res);
    }

    if (acao === "classificar") {
      const mod = await import("../api_handlers_backup/ai-studio-classificador.js");
      return mod.default(req, res);
    }

    if (acao === "router") {
      const mod = await import("../api_handlers_backup/ai-router.js");
      return mod.default(req, res);
    }

    return res.status(400).json({
      ok: false,
      error: "Ação inválida"
    });

  } catch (err) {
    console.error("Erro no ai-studio.js:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro no ai-studio.js",
      detail: err?.message || String(err),
    });
  }
}
