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
    // (gmail-reader.js -> GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN,
    // âmbito gmail.readonly + gmail.send). É um par de credenciais diferente
    // do usado em "url"/"callback" acima (GMAIL_OAUTH_CLIENT_ID, âmbito
    // completo mail.google.com) — este é que estava sem nenhuma rota ligada,
    // por isso não havia forma nenhuma de gerar um novo refresh_token quando
    // o antigo expirava.
    if (acao === "gmail_auth") {
      const mod = await import("../services/gmail/auth.js");
      return mod.default(req, res);
    }

    if (acao === "gmail_callback") {
      const mod = await import("../services/gmail/callback.js");
      return mod.default(req, res);
    }

    return res.status(400).json({
      ok: false,
      error: "Ação inválida. Use url | callback | autoresponder | gmail_auth | gmail_callback"
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
