export default async function handler(req, res) {
  const { acao } = req.query;

  try {
    if (acao === "lancar") {
      const mod = await import("../api_handlers_backup/lancar-pagamento.js");
      return mod.default(req, res);
    }

    if (acao === "confirmar") {
      const mod = await import("../api_handlers_backup/confirmar-pagamento.js");
      return mod.default(req, res);
    }

    return res.status(400).json({
      ok: false,
      error: "Ação inválida. Use lancar | confirmar"
    });

  } catch (err) {
    console.error("Erro no pagamento.js:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro no pagamento.js",
      detail: err?.message || String(err),
    });
  }
}
