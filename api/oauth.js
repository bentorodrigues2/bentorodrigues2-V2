export default async function handler(req, res) {
  const { acao } = req.query;

  try {
    if (acao === "url") {
      const mod = await import("./oauth-url.js");
      return mod.default(req, res);
    }

    if (acao === "callback") {
      const mod = await import("./oauth-callback.js");
      return mod.default(req, res);
    }

    if (acao === "autoresponder") {
      const mod = await import("./autoresponder-email.js");
      return mod.default(req, res);
    }

    return res.status(400).json({
      ok: false,
      error: "Ação inválida. Use url | callback | autoresponder"
    });

  } catch (err) {
    console.error("Erro no oauth.js:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro no oauth.js",
      detail: err?.message || String(err),
    });
  }
}
