import { generateCategoryResponse } from "../server/geminiService.ts";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "online", endpoint: "/api/resposta-categoria" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const payload = req.body || {};
    const result = await generateCategoryResponse(payload);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[/api/resposta-categoria] Erro:", err);
    return res.status(500).json({
      subject: null,
      message: null,
      categoria: "ignorar",
      error: err?.message || "Erro ao gerar resposta por categoria."
    });
  }
}
