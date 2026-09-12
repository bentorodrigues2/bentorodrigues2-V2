export const config = { runtime: "edge" };
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CONDOMANAGER_API_SECRET = process.env.CONDOMANAGER_API_SECRET;

const resend = new Resend(RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body;

    if (!body || !body.email || !body.email.to || !body.documentosReconhecidos || !body.documentosReconhecidos.length) {
      return res.status(400).json({ error: "Payload inválido para autoresponder" });
    }

    if (!body.secret || body.secret !== CONDOMANAGER_API_SECRET) {
      return res.status(401).json({ error: "API secret inválida" });
    }

    const resumo = body.documentosReconhecidos
      .map((d) => `• ${d.nome} (${d.mimeType})\n${d.resultado}\n`)
      .join("\n");

    await resend.emails.send({
      from: body.email.from,
      to: body.email.to,
      subject: `Documentos processados – Prédio ${body.predioId}`,
      text: `Foram processados os seguintes documentos:\n\n${resumo}`,
    });

    return res.status(200).json({ success: true });

  } catch (e) {
    console.error("Erro em /api/autoresponder:", e);
    return res.status(500).json({ error: "Erro interno no autoresponder" });
  }
}

