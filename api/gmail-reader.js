import { google } from "googleapis";

export default async function handler(req, res) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      "https://developers.google.com/oauthplayground"
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Buscar emails não lidos
    const list = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
      maxResults: 10
    });

    const messages = list?.data?.messages || [];
    const emails = [];

    for (const msg of messages) {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id
      });

      const payload = full?.data?.payload || {};
      const headers = payload.headers || [];

      const from = headers.find(h => h.name === "From")?.value || "";
      const subject = headers.find(h => h.name === "Subject")?.value || "";

      // Corpo do email
      let body = "";
      if (payload.parts) {
        const part = payload.parts.find(p => p.mimeType === "text/plain");
        if (part?.body?.data) {
          body = Buffer.from(part.body.data, "base64").toString("utf8");
        }
      }

      // Extrair anexos
      const anexos = [];

      if (payload.parts) {
        for (const part of payload.parts) {
          if (part.filename && part.body?.attachmentId) {
            const attachment = await gmail.users.messages.attachments.get({
              userId: "me",
              messageId: msg.id,
              id: part.body.attachmentId
            });

            anexos.push({
              filename: part.filename,
              mimeType: part.mimeType,
              base64: attachment.data.data
            });
          }
        }
      }

      emails.push({
        from,
        subject,
        body,
        anexos
      });

      // Marcar como lido
      await gmail.users.messages.modify({
        userId: "me",
        id: msg.id,
        requestBody: {
          removeLabelIds: ["UNREAD"]
        }
      });
    }

    return res.status(200).json({
      ok: true,
      emails
    });

  } catch (err) {
    console.error("Erro no gmail-reader:", err);
    return res.status(500).json({ error: "Erro no gmail-reader" });
  }
}
