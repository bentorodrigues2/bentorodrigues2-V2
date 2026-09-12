export const config = { runtime: "edge" };
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // Health check
  if (req.method === "GET") {
    return res.status(200).json({
      status: "online",
      endpoint: "reconhecer-recibo",
      modelo: "gemini-3.5-flash"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      erro: "GEMINI_API_KEY não configurada nas variáveis de ambiente da Vercel."
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const email = req.body.email || {};
    const documentos = req.body.documentos || [];

    const textoPrincipal =
      req.body.texto ||
      email.bodyText ||
      email.subject ||
      "Analisa este documento/e-mail.";

    // Prompt contabilístico
    const prompt = `
És o assistente de IA da administração do condomínio.
Analisa a informação deste e-mail e os anexos enviados:
- Remetente: ${email.from || "Desconhecido"}
- Assunto: ${email.subject || "Sem assunto"}
- Texto: ${textoPrincipal}

Devolve a análise em formato JSON com:
{
  "classificacao": {
    "tipo": "COMPROVATIVO_QUOTA",
    "confianca": 0.95
  },
  "dadosExtraidos": {
    "valorTotal": 0.00,
    "dataDocumento": "AAAA-MM-DD",
    "fracaoIdentificada": "Ex: 2º Dto",
    "nif": "NIF ou null",
    "entidade": "Nome ou Banco",
    "resumo": "Descrição do movimento"
  }
}
`.trim();

    // Construção correta do array contents
    const contents = [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ];

    // Adicionar anexos
    if (Array.isArray(documentos)) {
      for (const doc of documentos) {
        if (doc.base64 && doc.mimeType) {
          contents.push({
            inlineData: {
              data: doc.base64,
              mimeType: doc.mimeType
            }
          });
        }
      }
    }

    // Executar Gemini
    const result = await model.generateContent({ contents });
    const textoIA = result?.response?.text() || "";

    // Extrair JSON da resposta
    let dadosJson = {};
    try {
      const match = textoIA.match(/\{[\s\S]*\}/);
      dadosJson = match ? JSON.parse(match[0]) : { raw: textoIA };
    } catch {
      dadosJson = { raw: textoIA };
    }

    return res.status(200).json({
      sucesso: true,
      ...dadosJson
    });

  } catch (e) {
    console.error("Erro no processamento da IA:", e);
    return res.status(500).json({
      erro: e?.message || "Erro desconhecido ao invocar o modelo Gemini"
    });
  }
}

