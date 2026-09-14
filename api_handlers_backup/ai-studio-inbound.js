import { processInboundEmail } from "../api/lib/inboundProcessor.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "online", handler: "ai-studio-inbound" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const result = await processInboundEmail(req.body);
    return res.status(result.status || 200).json(result);
  } catch (err) {
    console.error("Erro no ai-studio-inbound handler:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro no ai-studio-inbound",
      detail: err?.message || String(err)
    });
  }
}
