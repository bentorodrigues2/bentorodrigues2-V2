import { processAutoresponderEmail } from "../server/geminiService.ts";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "online", endpoint: "/api/autoresponder" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const payload = req.body || {};
    const result = await processAutoresponderEmail(payload);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[/api/autoresponder] Erro:", err);
    return res.status(500).json({
      error: err?.message || "Erro no motor de resposta automática.",
      subject: null,
      message: null,
      categoria: "ignorar"
    });
  }
}
