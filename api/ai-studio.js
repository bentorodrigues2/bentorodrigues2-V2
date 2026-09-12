export default async function handler(req, res) {
  const { acao } = req.query;

  try {
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
