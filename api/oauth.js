export default async function handler(req, res) {
  const { acao } = req.query;

  try {
    if (acao === "url") {
      const mod = await import("../api_handlers_backup/oauth-url.js");
      return mod.default(req, res);
    }

    if (acao === "callback") {
      const mod = await import("../api_handlers_backup/oauth-callback.js");
      return mod.default(req, res);
    }

    if (acao === "autoresponder") {
      const mod = await import("../api_handlers_backup/autoresponder-email.js");
      return mod.default(req, res);
    }

    // Reautorização do Gmail usado de facto pelo leitor automático
    // (gmail-reader.js) passou a ter rota própria em /api/gmail/auth e
    // /api/gmail/callback — usa exatamente o URI de redirecionamento já
    // registado na Google Cloud Console para o cliente
    // "bentorodrigues2-oauth" (https://bentorodrigues2.vercel.app/api/gmail/callback),
    // em vez de depender de GMAIL_OAUTH_REDIRECT (que aponta para outro
    // URI, não registado para este cliente).

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
