export default async function handler(req, res) {
  const { tipo } = req.query;

  try {
    if (tipo === "email") {
      const mod = await import("./inbound-email.js");
      return mod.default(req, res);
    }

    if (tipo === "pdf") {
      const mod = await import("./inbound-pdf.js");
      return mod.default(req, res);
    }

    return res.status(400).json({
      ok: false,
      error: "Tipo inválido. Use email | pdf"
    });

  } catch (err) {
    console.error("Erro no inbound.js:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro no inbound.js",
      detail: err?.message || String(err),
    });
  }
}
