export default async function handler(req, res) {
  const code = req.query.code;
  const redirectUri = process.env.GMAIL_OAUTH_REDIRECT;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  const tokens = await resp.json();

  console.log('TOKENS:', tokens);

  // O token só aparecia no log do servidor (inacessível ao administrador
  // sem acesso à consola da Vercel) — mostra-o diretamente na página para
  // poder ser copiado e colado na variável de ambiente GMAIL_REFRESH_TOKEN.
  if (tokens.refresh_token) {
    res.send(
      `<html><body style="font-family: sans-serif; padding: 2rem;">` +
      `<h2>Gmail ligado com sucesso.</h2>` +
      `<p>Copie o novo <strong>refresh_token</strong> abaixo e atualize a variável de ambiente <code>GMAIL_REFRESH_TOKEN</code> na Vercel:</p>` +
      `<pre style="background:#f1f5f9;padding:1rem;border-radius:8px;word-break:break-all;">${tokens.refresh_token}</pre>` +
      `</body></html>`
    );
  } else {
    res.status(400).send(
      `<html><body style="font-family: sans-serif; padding: 2rem;">` +
      `<h2>Não foi devolvido nenhum refresh_token.</h2>` +
      `<pre>${JSON.stringify(tokens, null, 2)}</pre>` +
      `<p>Se já tinha autorizado esta app antes, revogue o acesso em <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a> e tente novamente — a Google só devolve refresh_token na primeira autorização (ou quando o pedido inclui prompt=consent, que já está incluído aqui).</p>` +
      `</body></html>`
    );
  }
}

