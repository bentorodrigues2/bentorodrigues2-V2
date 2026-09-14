import { generateWithFallback } from "../server/geminiService.ts";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "online", endpoint: "/api/reconhecer-recibo" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { texto, email } = req.body || {};
    const prompt = `És o assistente de IA da administração do condomínio.
Analisa a informação deste comprovativo bancário ou e-mail:
${texto || JSON.stringify(email || {})}

Devolve JSON com formato:
{
  "classificacao": { "tipo": "COMPROVATIVO_QUOTA", "confianca": 0.95 },
  "dadosExtraidos": {
    "valorTotal": 0.00,
    "dataDocumento": "AAAA-MM-DD",
    "fracaoIdentificada": "Ex: 2º Dto",
    "nif": "NIF ou null",
    "entidade": "Nome ou Banco",
    "resumo": "Descrição do movimento"
  }
}`;

    const responseText = await generateWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      responseMimeType: "application/json"
    });

    try {
      const parsed = JSON.parse(responseText);
      return res.status(200).json(parsed);
    } catch {
      return res.status(200).json({ raw: responseText });
    }
  } catch (err) {
    console.error("[/api/reconhecer-recibo] Erro:", err);
    return res.status(500).json({ error: err?.message || "Erro ao reconhecer comprovativo." });
  }
}
