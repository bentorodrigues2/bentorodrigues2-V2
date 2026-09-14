import { generateWithFallback } from "../server/geminiService.ts";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "online", endpoint: "/api/predict-reserve-fund" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { movements, saldoAtual } = req.body || {};
    const prompt = `Analisa a saúde financeira do Fundo Comum de Reserva do condomínio considerando:
- Saldo Atual: ${saldoAtual || 0} €
- Amostra de movimentos recentes: ${JSON.stringify(movements || [])}

Elabora uma análise técnica:
1. Conformidade com o Decreto-Lei 268/94 (obrigação de pelo menos 10% do valor da quota para fundo de reserva).
2. Projeção de solidez para eventuais despesas de conservação extraordinárias (fachadas, telhados, canalizações).
3. Recomendações e percentagem ideal sugerida.`;

    const responseText = await generateWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    return res.status(200).json({ analysis: responseText });
  } catch (err) {
    console.error("[/api/predict-reserve-fund] Erro:", err);
    return res.status(500).json({ error: err?.message || "Erro ao analisar fundo de reserva." });
  }
}
