export default function handler(req, res) {
  const redirectUri = process.env.GMAIL_OAUTH_REDIRECT;
  const clientId = process.env.GMAIL_CLIENT_ID;

  const url =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send'
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent'
    }).toString();

  res.redirect(url);
}

