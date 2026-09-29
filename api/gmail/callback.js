// Callback da reautorização do Gmail — tem de usar exatamente o mesmo
// redirect_uri que api/gmail/auth.js enviou no pedido inicial.
const REDIRECT_URI = "https://bentorodrigues2.vercel.app/api/gmail/callback";

export default async function handler(req, res) {
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
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code"
    })
  });

  const tokens = await resp.json();

  console.log("[api/gmail/callback] TOKENS:", tokens);

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
