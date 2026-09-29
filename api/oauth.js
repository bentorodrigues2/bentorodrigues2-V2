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
    // âmbito gmail.readonly + gmail.send). O redirect_uri fica fixo aqui
    // (em vez de vir de GMAIL_OAUTH_REDIRECT, que aponta para outro
    // cliente) — tem de corresponder exatamente a um URI registado nos
    // "URIs de redirecionamento autorizados" do cliente OAuth
    // "bentorodrigues2-oauth" na Google Cloud Console. Existe como acao=
    // dentro deste ficheiro (em vez de api/gmail/auth.js e
    // api/gmail/callback.js separados) porque o plano Hobby da Vercel
    // limita o projeto a 12 funções serverless — o projeto já estava no
    // limite exato, e 2 ficheiros novos partiam o deploy.
    const GMAIL_REDIRECT_URI = "https://bentorodrigues2.vercel.app/api/oauth?acao=gmail_callback";

    if (acao === "gmail_auth") {
      const url =
        "https://accounts.google.com/o/oauth2/v2/auth?" +
        new URLSearchParams({
          client_id: process.env.GMAIL_CLIENT_ID,
          redirect_uri: GMAIL_REDIRECT_URI,
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

    if (acao === "gmail_callback") {
      const code = req.query.code;
      if (!code) {
        return res.status(400).send("Código OAuth em falta (o pedido não veio da Google).");
      }

      const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GMAIL_CLIENT_ID,
          client_secret: process.env.GMAIL_CLIENT_SECRET,
          redirect_uri: GMAIL_REDIRECT_URI,
          grant_type: "authorization_code"
        })
      });
      const tokens = await resp.json();
      console.log("[api/oauth?acao=gmail_callback] TOKENS:", tokens);

      if (tokens.refresh_token) {
        return res.status(200).send(
          `<html><body style="font-family: sans-serif; padding: 2rem;">` +
          `<h2>Gmail ligado com sucesso.</h2>` +
          `<p>Copie o novo <strong>refresh_token</strong> abaixo e atualize a variável de ambiente <code>GMAIL_REFRESH_TOKEN</code> na Vercel:</p>` +
          `<pre style="background:#f1f5f9;padding:1rem;border-radius:8px;word-break:break-all;">${tokens.refresh_token}</pre>` +
          `</body></html>`
        );
      }
      return res.status(400).send(
        `<html><body style="font-family: sans-serif; padding: 2rem;">` +
        `<h2>Não foi devolvido nenhum refresh_token.</h2>` +
        `<pre>${JSON.stringify(tokens, null, 2)}</pre>` +
        `<p>Se já tinha autorizado esta app antes, revogue o acesso em <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a> e tente novamente.</p>` +
        `</body></html>`
      );
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
