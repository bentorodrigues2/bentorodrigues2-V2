export default async function handler(req, res) {
  try {
    // Parsing moderno WHATWG (elimina DEP0169)
    const fullUrl = new URL(req.url, `https://${req.headers.host}`);
    const acao = fullUrl.searchParams.get("acao");

    // 1. INBOUND (email recebido → autoresponder + institucional)
    if (acao === "inbound") {
      const mod = await import("../api_handlers_backup/ai-studio-inbound.js");
      return mod.default(req, res);
    }

    // 2. CLASSIFICADOR (texto → categoria)
    if (acao === "classificar") {
      const mod = await import("./classificador.js");
      return mod.default(req, res);
    }

    // 3. ROUTER (categoria + contexto → resposta institucional)
    if (acao === "router") {
      const mod = await import("./ai-studio-router.js");
      return mod.default(req, res);
    }

    // 4. MULTIMODAL (PDFs, imagens, anexos → AI Studio → lançamentos contabilísticos)
    if (acao === "multimodal") {
      const mod = await import("../api_handlers_backup/ai-studio-multimodal.js");
      return mod.default(req, res);
    }

    // 5. Ação inválida
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
