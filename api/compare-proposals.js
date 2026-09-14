import { generateWithFallback } from "../server/geminiService.ts";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "online", endpoint: "/api/compare-proposals" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { requestDescription, proposals } = req.body || {};
    const prompt = `Como perito em contratação e manutenção de condomínios, analisa e compara as seguintes propostas de orçamento recebidas:
Necessidade / Descrição: ${requestDescription || "Sem descrição"}
Propostas recebidas: ${JSON.stringify(proposals || [])}

Elabora uma matriz comparativa com:
1. Análise de Preço e Relação Custo-Benefício.
2. Prazos de Execução e Garantia dos Trabalhos.
3. Reputação e Conformidade Técnica.
4. Parecer Final e Recomendação fundamentada para a Assembleia de Condóminos.`;

    const responseText = await generateWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    return res.status(200).json({ comparison: responseText });
  } catch (err) {
    console.error("[/api/compare-proposals] Erro:", err);
    return res.status(500).json({ error: err?.message || "Erro ao comparar propostas." });
  }
}
