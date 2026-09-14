import { classifyEmailCategory } from "../server/geminiService.ts";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "online", endpoint: "/api/classificador" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const payload = req.body || {};
    const result = await classifyEmailCategory(payload);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[/api/classificador] Erro:", err);
    return res.status(500).json({
      categoria: "outro",
      error: err?.message || "Erro ao classificar tema do email."
    });
  }
}
