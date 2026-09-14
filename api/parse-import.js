import { generateWithFallback } from "../server/geminiService.ts";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "online", endpoint: "/api/parse-import" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { textContent } = req.body || {};
    const prompt = `Analisa o seguinte texto que contém dados de frações de um condomínio e extrai um array JSON estrito:
[
  {
    "fracao": "Ex: 1º Dto ou A",
    "piso": "Ex: 1 ou R/C",
    "tipologia": "Ex: T2 ou T3",
    "permilagem": 50,
    "proprietario": "Nome do proprietário",
    "email": "email@exemplo.com",
    "telefone": "912345678",
    "quota_mensal": 45.00
  }
]

Texto para extrair:
${textContent}`;

    const responseText = await generateWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      responseMimeType: "application/json"
    });

    try {
      const parsed = JSON.parse(responseText);
      return res.status(200).json({ data: parsed });
    } catch {
      return res.status(200).json({ raw: responseText });
    }
  } catch (err) {
    console.error("[/api/parse-import] Erro:", err);
    return res.status(500).json({ error: err?.message || "Erro ao processar importação." });
  }
}
