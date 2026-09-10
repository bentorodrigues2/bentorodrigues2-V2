import { google } from "googleapis";

export default function handler(req, res) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_OAUTH_CLIENT_ID,
    process.env.GMAIL_OAUTH_CLIENT_SECRET,
    process.env.GMAIL_OAUTH_REDIRECT
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://mail.google.com/"],
  });

  res.status(200).json({ url });
}


