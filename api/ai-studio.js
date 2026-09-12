export default async function handler(req, res) {
  const { acao } = req.query;

  try {
    //
    // 1. INBOUND (ai-studio-inbound.js)
    //
    if (acao === "inbound") {
      const mod = await import("./ai-studio-inbound.js");
      return mod.default(req, res);
    }

    //
    // 2. CLASSIFICADOR (ai-studio-classificador.js)
    //
    if (acao === "classificar") {
      const mod = await import("./ai-studio-classificador.js");
      return mod.default(req, res);
    }

    //
    // 3. ROUTER (ai-router.js)
    //
    if (acao === "router") {
      const mod = await import("./ai-router.js");
      return mod.default(req, res);
    }

    //
    // 4. CHAT (ai-assistant/chat.js)
    //
    if (acao === "chat") {
      const mod = await import("./ai-assistant/chat.js");
      return mod.default(req, res);
    }

    return res.status(400).json({
      ok: false,
      error: "Ação inválida. Use inbound | classificar | router | chat"
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
