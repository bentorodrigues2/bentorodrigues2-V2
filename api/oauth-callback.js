import { google } from "googleapis";

export default async function handler(req, res) {
  const code = req.query.code;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_OAUTH_CLIENT_ID,
    process.env.GMAIL_OAUTH_CLIENT_SECRET,
    process.env.GMAIL_OAUTH_REDIRECT
  );

  const { tokens } = await oauth2Client.getToken(code);

  res.status(200).json({
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
  });
}


