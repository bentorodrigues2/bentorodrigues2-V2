import { generateWithFallback } from "../server/geminiService.ts";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "online", endpoint: "/api/predict-budget" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { predio, fracoes } = req.body || {};
    const prompt = `Analisa a composição deste edifício em Portugal e propõe uma estimativa realista de orçamento anual com rubricas comuns (eletricidade partes comuns, limpeza, manutenção de elevadores, seguro condomínio, água, gestão, fundo de reserva legal de 10%):
Edifício: ${JSON.stringify(predio || {})}
Número de frações: ${fracoes?.length || 10}

Devolve a análise em formato estruturado com rubricas, valores estimados em Euros e recomendações financeiras para a administração.`;

    const responseText = await generateWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    return res.status(200).json({ prediction: responseText });
  } catch (err) {
    console.error("[/api/predict-budget] Erro:", err);
    return res.status(500).json({ error: err?.message || "Erro ao prever orçamento." });
  }
}
