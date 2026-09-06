import { GoogleGenAI } from "@google/genai";

let genAIClient: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada no ambiente.");
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

const CANDIDATE_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-latest"
];

export async function generateWithFallback(options: {
  contents: any;
  systemInstruction?: string;
  responseMimeType?: string;
}) {
  const ai = getGenAI();
  let lastError: any = null;

  for (const modelName of CANDIDATE_MODELS) {
    // Up to 2 attempts per model if temporary 503
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          config: {
            systemInstruction: options.systemInstruction,
            responseMimeType: options.responseMimeType,
          },
          contents: options.contents,
        });
        if (response && response.text) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err);
        const is503 = errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("UNAVAILABLE");
        
        if (is503 && attempt === 1) {
          // Breve pausa e tenta próximo modelo ou nova tentativa
          await new Promise((resolve) => setTimeout(resolve, 600));
          continue;
        }
        break; // Tentar próximo modelo candidato
      }
    }
  }

  console.error("[GeminiService] Todos os modelos candidatos falharam:", lastError?.message || lastError);
  throw lastError || new Error("Não foi possível obter resposta de nenhum modelo Gemini disponível.");
}

export interface ChatMessageInput {
  role: "user" | "model";
  text: string;
  images?: Array<{
    id?: string;
    name?: string;
    data: string; // base64, with or without data:image/... prefix
    mimeType?: string;
  }>;
  attachments?: Array<{
    id?: string;
    name?: string;
    size?: string;
    content: string;
  }>;
}

export interface AIChatPayload {
  messages: ChatMessageInput[];
  enableWebSearch?: boolean;
  predioInfo?: {
    nome?: string;
    morada?: string;
    nif?: string;
  };
  userRole?: string;
  userEmail?: string;
}

export async function processAIChat(payload: AIChatPayload): Promise<{ reply: string; sources?: Array<{ title: string; uri: string }> }> {
  const { messages, predioInfo, userRole } = payload;

  const predioContext = predioInfo
    ? `Condomínio Ativo: ${predioInfo.nome || "Não especificado"} | Morada: ${predioInfo.morada || "Não especificada"} | NIF: ${predioInfo.nif || "Não especificado"}`
    : "Condomínio não selecionado.";

  const systemInstruction = `És o Assistente de Inteligência Artificial Oficial do sistema Bento Rodrigues (Gestão de Condomínios em Portugal).
O teu utilizador tem a função: ${userRole || "Administrador / Gestor"}.
Contexto Atual: ${predioContext}.

Diretrizes de Atuação:
1. Especialista em Legislação de Propriedade Horizontal Portuguesa (Código Civil Português, Artigos 1414.º a 1438.º-A, Decreto-Lei n.º 268/94 e alterações do Decreto-Lei n.º 268/2022).
2. Auxilia em:
   - Convocatórias e Atas de Assembleias de Condóminos.
   - Notificações de cobrança de quotas em atraso e títulos executivos.
   - Obras urgentes, fundo comum de reserva (mínimo legal de 10%).
   - Regulamento interno do condomínio, partes comuns e direitos/deveres de condóminos.
   - Análise de orçamentos, faturas, relatórios de vistorias e manutenção.
3. Formato Especial para Documentos Oficiais:
   Quando o utilizador pedir para redigir uma carta formal, notificação de dívida, convocatória de assembleia, minuta de ata ou relatório técnico, deves envolver o documento integral na tag:
   [DOCUMENTO_OFICIAL tipo="NOTIFICAÇÃO FORMAL / ATA / CONVOCATÓRIA" titulo="Título do Documento"]
   ... conteúdo formal e completo do documento ...
   [/DOCUMENTO_OFICIAL]
   Isto permite ao sistema gerar automaticamente o ficheiro PDF oficial para impressão.
4. Tom profissional, claro, prestativo e em português de Portugal (pt-PT).`;

  // Format messages into Gemini contents structure
  const formattedContents: any[] = [];

  for (const msg of messages) {
    const role = msg.role === "model" ? "model" : "user";
    const parts: any[] = [];

    // Add attached images if present
    if (msg.images && msg.images.length > 0) {
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
          inlineData: {
            data: base64Clean,
            mimeType: mimeType
          }
        });
      }
    }

    // Add attached document contents
    if (msg.attachments && msg.attachments.length > 0) {
      for (const doc of msg.attachments) {
        parts.push({
          text: `[Conteúdo do Anexo: ${doc.name}]:\n${doc.content}\n---`
        });
      }
    }

    // Add main text
    if (msg.text && msg.text.trim()) {
      parts.push({ text: msg.text });
    } else if (parts.length === 0) {
      parts.push({ text: "Olá!" });
    }

    formattedContents.push({ role, parts });
  }

  const replyText = await generateWithFallback({
    contents: formattedContents,
    systemInstruction
  });

  return { reply: replyText };
}
