import { processAIChat } from "../../server/geminiService.ts";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "online", endpoint: "ai-assistant/chat" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const userRole = req.headers["x-user-role"] || "ADMIN";
    const userEmail = req.headers["x-user-email"] || "";
    const payload = {
      messages: req.body?.messages || [],
      enableWebSearch: req.body?.enableWebSearch,
      predioInfo: req.body?.predioInfo,
      userRole,
      userEmail
    };

    const result = await processAIChat(payload);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[/api/ai-assistant/chat] Erro:", err);
    return res.status(500).json({
      error: err?.message || "Erro interno ao processar conversa com a IA."
    });
  }
}
