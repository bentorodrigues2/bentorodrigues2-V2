import { generateWithFallback } from "../server/geminiService.ts";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "online", endpoint: "/api/ai-query" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { prompt } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "Prompt não fornecido." });
    }

    const responseText = await generateWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: "És um jurista e consultor perito em Direito das Coisas e Regime de Propriedade Horizontal em Portugal (Código Civil e DL 268/2022). Responde de modo rigoroso, citando artigos legais aplicáveis e jurisprudência consolidada sempre que pertinente."
    });

    return res.status(200).json({ answer: responseText, reply: responseText });
  } catch (err) {
    console.error("[/api/ai-query] Erro:", err);
    return res.status(500).json({ error: err?.message || "Erro ao responder à questão jurídica." });
  }
}
