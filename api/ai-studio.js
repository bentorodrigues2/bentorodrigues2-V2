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

    // 2. CLASSIFICADOR LOCAL (texto → categoria)
    if (acao === "classificar") {
      // Endpoint oficial no servidor Express /api/classificador
      const response = await fetch("http://127.0.0.1:3000/api/classificador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body || {})
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // 3. ROUTER LOCAL (categoria + contexto → resposta institucional)
    if (acao === "router") {
      // Endpoint oficial no servidor Express /api/ai-studio-router
      const response = await fetch("http://127.0.0.1:3000/api/ai-studio-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body || {})
      });
      const data = await response.json();
      return res.status(response.status).json(data);
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
