import { processInboundEmail } from "../../server/lib/inboundProcessor.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "online",
      endpoint: "/api/webhooks/resend",
      description: "Webhook oficial para receção e processamento automático de emails com IA."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await processInboundEmail(req.body);
    return res.status(result.status || 200).json(result);
  } catch (err) {
    console.error("Erro no webhook /api/webhooks/resend:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro no processamento do webhook",
      detail: err?.message || String(err)
    });
  }
}
