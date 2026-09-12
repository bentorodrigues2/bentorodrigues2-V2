export const config = { runtime: "edge" };
import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "online",
      endpoint: "ai-assistant/chat"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY não configurada nas variáveis de ambiente."
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const { messages, predioInfo } = req.body || {};
    const userRole = req.headers["x-user-role"] || "ADMIN";

    const predioContext = predioInfo
      ? `Condomínio: ${predioInfo.nome || ""} | Morada: ${predioInfo.morada || ""} | NIF: ${predioInfo.nif || ""}`
      : "Condomínio não especificado.";

    const systemInstruction = `
És o Assistente de Inteligência Artificial Oficial do sistema Bento Rodrigues (Gestão de Condomínios em Portugal).
O teu utilizador tem a função: ${userRole}.
Contexto Atual: ${predioContext}.

Diretrizes:
1. Especialista em Legislação de Propriedade Horizontal Portuguesa (Código Civil Artigos 1414.º a 1438.º-A e Decreto-Lei n.º 268/2022).
2. Quando solicitado a redigir uma notificação formal, ata, convocatória ou relatório, deves envolver o documento na tag:
   [DOCUMENTO_OFICIAL tipo="NOTIFICAÇÃO / ATA / CONVOCATÓRIA" titulo="Título"]
   ... conteúdo ...
   [/DOCUMENTO_OFICIAL]
3. Responde de forma cordial, rigorosa e em português de Portugal (pt-PT).
`.trim();

    // Construção correta dos conteúdos
    const formattedContents = [];

    if (Array.isArray(messages)) {
      for (const msg of messages) {
        const role = msg.role === "model" ? "model" : "user";
        const parts = [];

        // Imagens
        if (Array.isArray(msg.images)) {
          for (const img of msg.images) {
            let base64Clean = img.data;
            let mimeType = img.mimeType || "image/jpeg";

            if (base64Clean.includes(",")) {
              const split = base64Clean.split(",");
              const mimeMatch = split[0].match(/:(.*?);/);
              if (mimeMatch) mimeType = mimeMatch[1];
              base64Clean = split[1];
            }

            parts.push({
              inlineData: { data: base64Clean, mimeType }
            });
          }
        }

        // Anexos
        if (Array.isArray(msg.attachments)) {
          for (const doc of msg.attachments) {
            parts.push({
              text: `[Anexo ${doc.name}]:\n${doc.content}\n---`
            });
          }
        }

        // Texto
        if (msg.text && msg.text.trim()) {
          parts.push({ text: msg.text });
        } else if (parts.length === 0) {
          parts.push({ text: "Olá!" });
        }

        formattedContents.push({ role, parts });
      }
    }

    // Modelos candidatos
    const candidateModels = [
      "gemini-3.1-flash-lite",
      "gemini-3.8-flash",
      "gemini-flash-latest"
    ];

    let replyText = "";
    let lastErr = null;

    // Tentativas com fallback
    for (const modelName of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            config: { systemInstruction },
            contents: formattedContents
          });

          if (response && response.text) {
            replyText = response.text;
            break;
          }
        } catch (err) {
          lastErr = err;
          const errMsg = String(err?.message || err);

          if ((errMsg.includes("503") || errMsg.includes("high demand")) && attempt === 1) {
            await new Promise((r) => setTimeout(r, 600));
            continue;
          }

          break;
        }
      }

      if (replyText) break;
    }

    if (!replyText) {
      throw lastErr || new Error("Sem resposta dos modelos Gemini.");
    }

    return res.status(200).json({ reply: replyText });

  } catch (err) {
    console.error("Erro na API ai-assistant/chat:", err);
    return res.status(500).json({
      error: err?.message || "Erro ao comunicar com o Gemini."
    });
  }
}

