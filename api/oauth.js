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
    // âmbito gmail.readonly + gmail.send). O redirect_uri aponta para
    // /api/gmail/callback (ficheiro próprio, único URI já registado nos
    // "URIs de redirecionamento autorizados" do cliente OAuth
    // "bentorodrigues2-oauth" na Google Cloud Console para este par de
    // credenciais) — só o passo inicial fica aqui, fundido com o resto
    // deste dispatcher, porque só o URI de CALLBACK precisa de bater
    // certo com o registado; o início do fluxo pode estar em qualquer rota.
    if (acao === "gmail_auth") {
      const url =
        "https://accounts.google.com/o/oauth2/v2/auth?" +
        new URLSearchParams({
          client_id: process.env.GMAIL_CLIENT_ID,
          redirect_uri: "https://bentorodrigues2.vercel.app/api/gmail/callback",
          response_type: "code",
          scope: [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send"
          ].join(" "),
          access_type: "offline",
          prompt: "consent"
        }).toString();
      return res.redirect(url);
    }

    return res.status(400).json({
      ok: false,
      error: "Ação inválida. Use url | callback | autoresponder | gmail_auth"
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
