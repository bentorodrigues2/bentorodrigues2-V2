// Início da reautorização do Gmail (GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET,
// usado de facto por api/gmail-reader.js). O redirect_uri fica fixo aqui
// em vez de vir de GMAIL_OAUTH_REDIRECT — tem de corresponder exatamente
// a um dos "URIs de redirecionamento autorizados" já registados na Google
// Cloud Console para este cliente OAuth (bentorodrigues2-oauth), e este é
// o único desses URIs com um ficheiro real a responder-lhe.
const REDIRECT_URI = "https://bentorodrigues2.vercel.app/api/gmail/callback";

export default function handler(req, res) {
  const clientId = process.env.GMAIL_CLIENT_ID;

  const url =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send"
      ].join(" "),
      access_type: "offline",
      prompt: "consent"
    }).toString();

  res.redirect(url);
}
