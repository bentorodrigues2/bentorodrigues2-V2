import { processInboundEmail } from "../server/lib/inboundProcessor.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "online", handler: "inbound-email" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const result = await processInboundEmail(req.body);
    return res.status(result.status || 200).json(result);
  } catch (err) {
    console.error("Erro no inbound-email handler:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro no inbound-email",
      detail: err?.message || String(err)
    });
  }
}
