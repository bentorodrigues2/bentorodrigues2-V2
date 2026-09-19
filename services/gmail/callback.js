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

  res.send('Gmail ligado com sucesso.');
}

