
import { google } from "googleapis";

export default async function handler(req, res) {
  try {
    const code = req.query.code;

    if (!code) {
      return res.status(400).json({ error: "Código OAuth em falta" });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_OAUTH_CLIENT_ID,
      process.env.GMAIL_OAUTH_CLIENT_SECRET,
      process.env.GMAIL_OAUTH_REDIRECT
    );

    const tokenResponse = await oauth2Client.getToken(code);
    const tokens = tokenResponse?.tokens || {};

    return res.status(200).json({
      refresh_token: tokens.refresh_token || null,
      access_token: tokens.access_token || null
    });

  } catch (err) {
    console.error("Erro no oauth-callback:", err);
    return res.status(500).json({
      error: "Erro no oauth-callback",
      detail: err?.message || String(err)
    });
  }
}


