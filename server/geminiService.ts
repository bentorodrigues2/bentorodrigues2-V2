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
        const isBlocked = errMsg.includes("API_KEY_SERVICE_BLOCKED") || errMsg.includes("UNAUTHENTICATED") || errMsg.includes("401");
        if (isBlocked) {
          console.error(
            "[GeminiService] ERRO DE AUTENTICAÇÃO: API_KEY_SERVICE_BLOCKED detectado. A chave GEMINI_API_KEY está com restrições de API na Google Cloud Console que bloqueiam o serviço generativelanguage.googleapis.com."
          );
          break; // Não adianta tentar outros modelos com a mesma chave bloqueada
        }
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

export interface AutoresponderEmailPayload {
  from?: string;
  subject?: string;
  bodyText?: string;
}

export interface AutoresponderContexto {
  proprietario?: Record<string, any> | null;
  fracao?: Record<string, any> | null;
  predio?: Record<string, any> | null;
  quotas?: Record<string, any> | null;
  seguros?: Record<string, any> | null;
  tipoRemetente?: "proprietario" | "inquilino" | "coproprietario" | "fornecedor" | "outro";
  [key: string]: any;
}

export interface AutoresponderInput {
  email?: AutoresponderEmailPayload;
  contexto?: AutoresponderContexto;
  // Legacy / Flat format support
  sender?: string;
  subject?: string;
  body?: string;
  predioNome?: string;
}

export type AutoresponderCategoria =
  | "quotas"
  | "ruido"
  | "avaria"
  | "assembleia"
  | "documentos"
  | "informacao"
  | "administracao"
  | "condominio"
  | "seguro"
  | "inquilino"
  | "coproprietario"
  | "fornecedor"
  | "urgente"
  | "outro"
  | "ignorar";

export interface AutoresponderOutput {
  subject: string | null;
  message: string | null;
  categoria: AutoresponderCategoria | string;
  filtrado?: boolean;
  motivoFiltro?: string;
}

/**
 * Remove formatações proibidas: HTML, markdown e emojis.
 */
export function cleanAutoresponderText(text: string): string {
  if (!text) return "";
  return text
    .replace(/<[^>]*>/g, "") // remove tags HTML
    .replace(/[*_~`#\[\]]/g, "") // remove caracteres de markdown
    .replace(/[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{1F1E0}-\u{1F1FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu, "") // remove emojis
    .trim();
}

/**
 * Motor Oficial de Resposta Automática do Condomínio (Autoresponder).
 * Analisa e-mails recebidos, classifica a categoria e responde institucionalmente
 * com base no contexto do condomínio em formato JSON estrito: { subject, message, categoria }.
 */
export async function processAutoresponderEmail(input: AutoresponderInput): Promise<AutoresponderOutput> {
  const emailFrom = (input.email?.from || input.sender || "").toLowerCase().trim();
  const emailSubject = (input.email?.subject || input.subject || "").trim();
  const emailBody = (input.email?.bodyText || input.body || "").trim();
  const contexto = input.contexto || {
    proprietario: null,
    fracao: null,
    predio: input.predioNome ? { nome: input.predioNome } : null,
    quotas: null,
    seguros: null
  };

  // 1. Verificação algorítmica rigorosa de remetente automático ou fornecedor
  const automaticKeywords = [
    "noreply", "no-reply", "do-not-reply", "donotreply",
    "automated", "mailer-daemon", "postmaster", "bounce",
    "newsletter", "news@", "marketing", "campanhas", "promocoes", "promo@"
  ];

  const supplierDomains = [
    "edp.pt", "edp.com", "galp.pt", "galp.com", "vodafone.pt", "meo.pt", "nos.pt",
    "nowo.pt", "digi.pt", "iberdrola.pt", "iberdrola.es", "tkelevadores.com", "tke.com",
    "thyssenkrupp.com", "schindler.com", "otis.com", "kone.com", "fidelidade.pt",
    "tranquilidade.pt", "allianz.pt", "zurich.com", "generali.pt", "ageas.pt", "mapfre.pt"
  ];

  const hasAutoKeyword = automaticKeywords.some((kw) => emailFrom.includes(kw));
  const isSupplierDomain = supplierDomains.some((dom) => emailFrom.endsWith(`@${dom}`) || emailFrom.includes(`@${dom}`) || emailFrom.includes(`.${dom}`));

  if (hasAutoKeyword || isSupplierDomain) {
    return {
      subject: null,
      message: null,
      categoria: "ignorar",
      filtrado: true,
      motivoFiltro: hasAutoKeyword
        ? "Remetente identificado como sistema automático / noreply."
        : "Remetente identificado como fornecedor conhecido / entidade externa."
    };
  }

  // 2. Sistema de IA com regras oficiais do Autoresponder
  const systemInstruction = `És o autoresponder oficial do condomínio. A tua função é analisar emails recebidos, interpretar o tema, usar o contexto fornecido pelo backend (proprietário, fração, prédio, quotas, seguros, regras) e devolver uma resposta profissional em formato JSON.

NUNCA devolves HTML.  
NUNCA devolves imagens.  
NUNCA envias anexos.  
NUNCA inventas dados que não estão no contexto.  
NUNCA respondes a fornecedores ou emails automáticos.

A tua saída é SEMPRE:

{
  "subject": "...",
  "message": "...",
  "categoria": "..."
}

Se não houver resposta adequada, devolves:

{
  "subject": null,
  "message": null,
  "categoria": "ignorar"
}

---

# 1. CONTEXTO RECEBIDO DO BACKEND

O backend envia-te:

{
  "email": {
    "from": "...",
    "subject": "...",
    "bodyText": "..."
  },
  "contexto": {
    "proprietario": {...},
    "fracao": {...},
    "predio": {...},
    "quotas": {...},
    "seguros": {...}
  }
}

Usa APENAS estes dados.  
Se um campo não existir, assume que não está disponível.

---

# 2. CLASSIFICAÇÃO DE TEMA (CATEGORIA)
Identifica o tema do email. As categorias possíveis são:
- "quotas"
- "ruido"
- "avaria"
- "assembleia"
- "documentos"
- "informacao"
- "administracao"
- "condominio"
- "seguro"
- "inquilino"
- "coproprietario"
- "fornecedor"
- "urgente"
- "outro"

Se o email for de fornecedor ou automático, devolve categoria "ignorar".

---

# 3. REGRAS DE RESPOSTA

## 3.1. Se o remetente for proprietário
- Usa o nome do proprietário.
- Usa dados da fração.
- Usa dados do prédio.
- Responde de forma institucional e clara.

## 3.2. Se for inquilino
- Responde com cortesia.
- Indica que certas decisões dependem do proprietário.

## 3.3. Se for coproprietário
- Responde como proprietário, mas indica que é coproprietário quando relevante.

## 3.4. Se for fornecedor ou email automático
DEVOLVES:

{
  "subject": null,
  "message": null,
  "categoria": "ignorar"
}

## 3.5. Se o email for sobre quotas
- Usa dados reais das quotas (se existirem).
- Se não existirem, responde com instruções gerais.

## 3.6. Se for sobre ruído
- Responde com regras do condomínio.
- Mantém tom neutro e institucional.

## 3.7. Se for sobre assembleias
- Usa dados do prédio (se existir data marcada).
- Se não existir, informa que será comunicado.

## 3.8. Se for sobre avarias
- Pede detalhes.
- Indica procedimentos.

## 3.9. Se for sobre documentos
- Indica como obter documentos do condomínio.

---

# 4. TOM E ESTILO

- Profissional
- Institucional
- Claro
- Sem HTML
- Sem emojis
- Sem anexos
- Sem linguagem emocional
- Sem informalidade excessiva

---

# 5. FORMATO FINAL DA RESPOSTA

DEVOLVES SEMPRE:

{
  "subject": "Assunto da resposta",
  "message": "Texto da resposta em formato simples",
  "categoria": "tema_identificado"
}

Se não houver resposta:

{
  "subject": null,
  "message": null,
  "categoria": "ignorar"
}`;

  const userPrompt = JSON.stringify(
    {
      email: {
        from: emailFrom || "condomino@exemplo.pt",
        subject: emailSubject || "(sem assunto)",
        bodyText: emailBody || "(sem corpo de mensagem)"
      },
      contexto: contexto
    },
    null,
    2
  );

  try {
    const rawResponse = await generateWithFallback({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction,
      responseMimeType: "application/json"
    });

    let parsed: any = null;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      const match = rawResponse.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }

    if (!parsed) {
      return {
        subject: `Re: ${emailSubject || "Contacto com a Administração"}`,
        message: "Acusamos a receção da sua mensagem. O assunto foi registado e será analisado pela administração do condomínio com a devida brevidade.",
        categoria: "informacao"
      };
    }

    // Limpar resíduos de markdown, HTML ou emojis caso surjam
    const cleanMessage = cleanAutoresponderText(parsed.message || "");

    const categoria: AutoresponderCategoria = parsed.categoria || (parsed.subject === null ? "ignorar" : "outro");

    if (categoria === "ignorar" || parsed.subject === null || parsed.message === null) {
      return {
        subject: null,
        message: null,
        categoria: "ignorar"
      };
    }

    return {
      subject: parsed.subject || `Re: ${emailSubject || "Comunicação ao Condomínio"}`,
      message: cleanMessage || null,
      categoria: categoria
    };
  } catch (err: any) {
    console.error("[processAutoresponderEmail] Erro ao invocar Gemini:", err);

    // Fallback contextual algorítmico rigoroso
    const combined = (emailSubject + " " + emailBody).toLowerCase();
    let categoria: AutoresponderCategoria = "outro";
    let fallbackSubject = `Re: ${emailSubject || "Contacto com o Condomínio"}`;
    let fallbackMessage = "Acusamos a receção da sua mensagem, a qual foi registada pelos serviços do condomínio e merecerá a devida análise pela administração.";

    if (combined.includes("quota") || combined.includes("pagamento") || combined.includes("comprovativo") || combined.includes("transferencia")) {
      categoria = "quotas";
      fallbackSubject = `Re: ${emailSubject || "Comprovativo de Pagamento de Quotas"}`;
      fallbackMessage = "Agradecemos o envio do comprovativo de pagamento. Confirmamos a sua receção e informamos que o documento será conferido na reconciliação bancária corrente do condomínio.";
    } else if (combined.includes("avaria") || combined.includes("elevador") || combined.includes("luz") || combined.includes("porta") || combined.includes("portao") || combined.includes("portão")) {
      categoria = "avaria";
      fallbackSubject = `Re: ${emailSubject || "Registo de Avaria nas Partes Comuns"}`;
      fallbackMessage = "Agradecemos a sua comunicação e confirmamos a receção do reporte de avaria. A ocorrência foi registada e encaminhada de imediato para a assistência técnica responsável.";
    } else if (combined.includes("ruido") || combined.includes("ruído") || combined.includes("barulho") || combined.includes("conflito") || combined.includes("vizinho")) {
      categoria = "ruido";
      fallbackSubject = `Re: ${emailSubject || "Comunicação sobre Ruído"}`;
      fallbackMessage = "Agradecemos a sua exposição e confirmamos a sua receção. A situação descrita será analisada pela administração em conformidade com o regulamento do condomínio e a legislação em vigor.";
    } else if (combined.includes("ata") || combined.includes("assembleia") || combined.includes("convocatoria") || combined.includes("convocatória")) {
      categoria = "assembleia";
      fallbackSubject = `Re: ${emailSubject || "Informação sobre Assembleia Geral"}`;
      fallbackMessage = "Agradecemos o seu contacto. Informamos que a documentação e convocatória relativas à assembleia geral serão remetidas dentro dos prazos legais estipulados.";
    } else if (combined.includes("documento") || combined.includes("declaracao") || combined.includes("declaração") || combined.includes("seguro")) {
      categoria = combined.includes("seguro") ? "seguro" : "documentos";
      fallbackSubject = `Re: ${emailSubject || "Pedido de Documentação"}`;
      fallbackMessage = "Acusamos a receção do seu pedido de documentação. O mesmo será processado pelos serviços administrativos nos procedimentos e prazos habituais.";
    }

    return {
      subject: fallbackSubject,
      message: fallbackMessage,
      categoria: categoria
    };
  }
}

/**
 * AI STUDIO — CLASSIFICADOR DE TEMAS (SYSTEM PROMPT)
 * System Prompt oficial com regras estritas de identificação de tema.
 */
export const CLASSIFICADOR_TEMAS_SYSTEM_PROMPT = `A tua função é identificar o tema principal de um email recebido pelo condomínio. 
Recebes o seguinte JSON:

{
  "email": {
    "from": "...",
    "subject": "...",
    "bodyText": "..."
  }
}

A tua saída é SEMPRE:

{
  "categoria": "..."
}

NUNCA devolves texto fora do JSON.
NUNCA escreves explicações.
NUNCA escreves HTML.
NUNCA escreves mensagens.

Apenas devolves a categoria.

---

# 1. CATEGORIAS POSSÍVEIS

- "quotas"
- "ruido"
- "avaria"
- "assembleia"
- "documentos"
- "informacao"
- "administracao"
- "condominio"
- "seguro"
- "inquilino"
- "coproprietario"
- "urgente"
- "fornecedor"
- "outro"

---

# 2. REGRAS DE CLASSIFICAÇÃO

## 2.1. QUOTAS
Palavras-chave:
- quota
- pagamento
- mensalidade
- condominio em atraso
- recibo
- comprovativo
- transferência

## 2.2. RUÍDO
Palavras-chave:
- barulho
- ruido
- vizinho
- festas
- incomodo
- perturbação
- silêncio

## 2.3. AVARIA
Palavras-chave:
- avaria
- problema
- elevador
- porta
- infiltração
- água
- luz
- eletricidade
- reparação

## 2.4. ASSEMBLEIA
Palavras-chave:
- assembleia
- reunião
- ata
- convocatória
- votação

## 2.5. DOCUMENTOS
Palavras-chave:
- documento
- contrato
- ata
- regulamento
- seguro
- certidão
- declaração

## 2.6. INFORMAÇÃO
Quando o email pede:
- esclarecimento
- informação geral
- dúvida
- pergunta sem tema específico

## 2.7. ADMINISTRAÇÃO
Palavras-chave:
- administração
- gestor
- empresa
- contacto da administração

## 2.8. CONDOMÍNIO
Palavras-chave:
- prédio
- condomínio
- regras
- regulamento

## 2.9. SEGURO
Palavras-chave:
- apólice
- seguradora
- seguro
- validade
- sinistro

## 2.10. INQUILINO
Palavras-chave:
- arrendamento
- inquilino
- contrato de arrendamento

## 2.11. COPROPRIETÁRIO
Palavras-chave:
- coproprietário
- comproprietário
- segundo proprietário

## 2.12. URGENTE
Palavras-chave:
- urgente
- emergência
- imediatamente
- perigo
- risco

## 2.13. FORNECEDOR
Se o email vier de:
- empresas
- newsletters
- noreply
- no-reply
- mailer-daemon
- postmaster
- edp.pt
- galp.com
- vodafone.pt
- meo.pt
- nos.pt

DEVOLVES:
{
  "categoria": "fornecedor"
}

## 2.14. OUTRO
Se não encaixar em nenhuma categoria acima:
{
  "categoria": "outro"
}

---

# 3. FORMATO FINAL

DEVOLVES SEMPRE:

{
  "categoria": "..."
}`;

export interface ClassifyEmailInput {
  email?: {
    from?: string;
    subject?: string;
    bodyText?: string;
  };
  from?: string;
  subject?: string;
  bodyText?: string;
}

export type ClassificadorCategoria =
  | "quotas"
  | "ruido"
  | "avaria"
  | "assembleia"
  | "documentos"
  | "informacao"
  | "administracao"
  | "condominio"
  | "seguro"
  | "inquilino"
  | "coproprietario"
  | "urgente"
  | "fornecedor"
  | "outro";

export interface ClassifyEmailOutput {
  categoria: ClassificadorCategoria | string;
}

/**
 * Classificador Oficial de Temas de Emails do Condomínio.
 * Aplica o System Prompt estrito e devolve SEMPRE { "categoria": "..." }.
 */
export async function classifyEmailCategory(input: ClassifyEmailInput): Promise<ClassifyEmailOutput> {
  const from = (input.email?.from || input.from || "").trim();
  const subject = (input.email?.subject || input.subject || "").trim();
  const bodyText = (input.email?.bodyText || input.bodyText || "").trim();

  const fromLower = from.toLowerCase();

  // Verificação direta de regra 2.13 para fornecedor
  const supplierIndicators = [
    "noreply", "no-reply", "mailer-daemon", "postmaster",
    "edp.pt", "galp.com", "galp.pt", "vodafone.pt", "meo.pt", "nos.pt"
  ];
  if (supplierIndicators.some(ind => fromLower.includes(ind))) {
    return { categoria: "fornecedor" };
  }

  const userPayload = JSON.stringify(
    {
      email: {
        from,
        subject,
        bodyText
      }
    },
    null,
    2
  );

  try {
    const rawResponse = await generateWithFallback({
      contents: [{ role: "user", parts: [{ text: userPayload }] }],
      systemInstruction: CLASSIFICADOR_TEMAS_SYSTEM_PROMPT,
      responseMimeType: "application/json"
    });

    let parsed: any = null;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      const match = rawResponse.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }

    if (parsed && typeof parsed.categoria === "string") {
      return { categoria: parsed.categoria.trim().toLowerCase() };
    }
  } catch (err) {
    console.error("[classifyEmailCategory] Erro na chamada ao Gemini:", err);
  }

  // Fallback heurístico em estrito alinhamento com a secção 2 do System Prompt
  const text = (subject + " " + bodyText).toLowerCase();

  if (text.includes("urgente") || text.includes("emergência") || text.includes("emergencia") || text.includes("imediatamente") || text.includes("perigo") || text.includes("risco")) {
    return { categoria: "urgente" };
  }
  if (text.includes("quota") || text.includes("pagamento") || text.includes("mensalidade") || text.includes("condominio em atraso") || text.includes("recibo") || text.includes("comprovativo") || text.includes("transferência") || text.includes("transferencia")) {
    return { categoria: "quotas" };
  }
  if (text.includes("barulho") || text.includes("ruido") || text.includes("ruído") || text.includes("vizinho") || text.includes("festas") || text.includes("incomodo") || text.includes("incómodo") || text.includes("perturbação") || text.includes("perturbacao") || text.includes("silêncio") || text.includes("silencio")) {
    return { categoria: "ruido" };
  }
  if (text.includes("avaria") || text.includes("problema") || text.includes("elevador") || text.includes("porta") || text.includes("infiltração") || text.includes("infiltracao") || text.includes("água") || text.includes("agua") || text.includes("luz") || text.includes("eletricidade") || text.includes("reparação") || text.includes("reparacao")) {
    return { categoria: "avaria" };
  }
  if (text.includes("assembleia") || text.includes("reunião") || text.includes("reuniao") || text.includes("convocatória") || text.includes("convocatoria") || text.includes("votação") || text.includes("votacao")) {
    return { categoria: "assembleia" };
  }
  if (text.includes("documento") || text.includes("contrato") || text.includes("ata") || text.includes("certidão") || text.includes("certidao") || text.includes("declaração") || text.includes("declaracao")) {
    return { categoria: "documentos" };
  }
  if (text.includes("apólice") || text.includes("apolice") || text.includes("seguradora") || text.includes("seguro") || text.includes("validade") || text.includes("sinistro")) {
    return { categoria: "seguro" };
  }
  if (text.includes("arrendamento") || text.includes("inquilino") || text.includes("contrato de arrendamento")) {
    return { categoria: "inquilino" };
  }
  if (text.includes("coproprietário") || text.includes("coproprietario") || text.includes("comproprietário") || text.includes("comproprietario") || text.includes("segundo proprietário") || text.includes("segundo proprietario")) {
    return { categoria: "coproprietario" };
  }
  if (text.includes("administração") || text.includes("administracao") || text.includes("gestor") || text.includes("empresa") || text.includes("contacto da administração") || text.includes("contacto da administracao")) {
    return { categoria: "administracao" };
  }
  if (text.includes("prédio") || text.includes("predio") || text.includes("condomínio") || text.includes("condominio") || text.includes("regras") || text.includes("regulamento")) {
    return { categoria: "condominio" };
  }
  if (text.includes("esclarecimento") || text.includes("informação") || text.includes("informacao") || text.includes("dúvida") || text.includes("duvida") || text.includes("pergunta")) {
    return { categoria: "informacao" };
  }

  return { categoria: "outro" };
}

/**
 * AI STUDIO — REGRAS INTELIGENTES POR CATEGORIA (SYSTEM PROMPT)
 * System Prompt do módulo de resposta por categoria.
 */
export const REGRAS_INTELIGENTES_CATEGORIA_SYSTEM_PROMPT = `A tua função é gerar respostas profissionais e institucionais para emails recebidos pelo condomínio, com base na categoria identificada pelo classificador e no contexto fornecido pelo backend.

Recebes:

{
  "categoria": "...",
  "email": {
    "from": "...",
    "subject": "...",
    "bodyText": "..."
  },
  "contexto": {
    "proprietario": {...},
    "fracao": {...},
    "predio": {...},
    "quotas": {...},
    "seguros": {...}
  }
}

A tua saída é SEMPRE:

{
  "subject": "...",
  "message": "...",
  "categoria": "..."
}

NUNCA devolves HTML.
NUNCA devolves anexos.
NUNCA devolves imagens.
NUNCA inventas dados que não estão no contexto.
NUNCA escreves fora do JSON.

---

# 1. REGRAS POR CATEGORIA

## 1.1. QUOTAS
Se existir contexto de quotas:
- Indica valores, meses, estado (pago / em atraso).
- Indica IBAN do prédio se existir.
- Responde com clareza e tom institucional.

Se NÃO existir contexto de quotas:
- Indica que o condomínio está a atualizar o sistema.
- Pede comprovativo ou esclarecimento.

## 1.2. RUÍDO
- Agradece o contacto.
- Indica regras de silêncio do prédio (se existirem).
- Indica que o condomínio irá comunicar ao responsável.
- Mantém tom neutro e institucional.

## 1.3. AVARIA
- Pede detalhes (local, hora, tipo de avaria).
- Indica procedimentos do condomínio.
- Se existir empresa contratada, menciona.
- Mantém tom profissional.

## 1.4. ASSEMBLEIA
Se existir assembleia marcada:
- Indica data, hora e local.
- Indica se existe ata disponível.

Se NÃO existir:
- Indica que será convocada conforme legislação.

## 1.5. DOCUMENTOS
- Indica como obter documentos (atas, regulamentos, seguros).
- Se existir seguro no contexto, menciona apólice e validade.
- Mantém tom formal.

## 1.6. INFORMAÇÃO
- Responde à dúvida de forma clara.
- Se não houver dados suficientes, pede esclarecimento adicional.

## 1.7. ADMINISTRAÇÃO
- Indica contacto da administração (se existir no contexto).
- Mantém tom institucional.

## 1.8. CONDOMÍNIO
- Responde sobre regras gerais.
- Indica regulamento (se existir).
- Mantém tom neutro.

## 1.9. SEGURO
Se existir seguro no contexto:
- Indica seguradora, número de apólice e validade.

Se NÃO existir:
- Indica que o condomínio não tem registo de seguro para a fração.

## 1.10. INQUILINO
- Responde com cortesia.
- Indica que certas decisões dependem do proprietário.
- Mantém tom neutro.

## 1.11. COPROPRIETÁRIO
- Responde como proprietário.
- Indica que é coproprietário quando relevante.

## 1.12. URGENTE
- Prioriza resposta imediata.
- Pede detalhes.
- Indica procedimentos de segurança.
- Mantém tom firme e institucional.

## 1.13. FORNECEDOR
DEVOLVES:

{
  "subject": null,
  "message": null,
  "categoria": "ignorar"
}

## 1.14. OUTRO
- Responde de forma geral.
- Pede esclarecimento adicional.

---

# 2. TOM E ESTILO

- Profissional
- Institucional
- Claro
- Sem HTML
- Sem emojis
- Sem anexos
- Sem informalidade excessiva

---

# 3. FORMATO FINAL

DEVOLVES SEMPRE:

{
  "subject": "Assunto da resposta",
  "message": "Texto da resposta",
  "categoria": "categoria_recebida"
}`;

export interface CategoryResponseInput {
  categoria: string;
  email: {
    from?: string;
    subject?: string;
    bodyText?: string;
  };
  contexto?: {
    proprietario?: any;
    fracao?: any;
    predio?: any;
    quotas?: any;
    seguros?: any;
    [key: string]: any;
  };
}

/**
 * Módulo de Resposta por Categoria (Regras Inteligentes).
 * Gera respostas estritamente em conformidade com as regras por categoria e o contexto do condomínio.
 */
export async function generateCategoryResponse(input: CategoryResponseInput): Promise<AutoresponderOutput> {
  const cat = (input.categoria || "outro").toLowerCase().trim();
  const from = (input.email?.from || "").trim();
  const sub = (input.email?.subject || "").trim();
  const body = (input.email?.bodyText || "").trim();
  const contexto = input.contexto || {};

  // 1. Regra 1.13: Fornecedor e emails automáticos devolvem categoria "ignorar"
  if (cat === "fornecedor" || cat === "ignorar") {
    return {
      subject: null,
      message: null,
      categoria: "ignorar",
      filtrado: true,
      motivoFiltro: "Email identificado como fornecedor ou automático."
    };
  }

  const fromLower = from.toLowerCase();
  const supplierIndicators = [
    "noreply", "no-reply", "mailer-daemon", "postmaster",
    "edp.pt", "galp.com", "galp.pt", "vodafone.pt", "meo.pt", "nos.pt"
  ];
  if (supplierIndicators.some(ind => fromLower.includes(ind))) {
    return {
      subject: null,
      message: null,
      categoria: "ignorar",
      filtrado: true,
      motivoFiltro: "Remetente identificado como fornecedor ou noreply."
    };
  }

  // 2. Chamada ao Gemini com o System Prompt das Regras Inteligentes
  const payload = JSON.stringify(
    {
      categoria: cat,
      email: {
        from,
        subject: sub,
        bodyText: body
      },
      contexto
    },
    null,
    2
  );

  try {
    const rawResponse = await generateWithFallback({
      contents: [{ role: "user", parts: [{ text: payload }] }],
      systemInstruction: REGRAS_INTELIGENTES_CATEGORIA_SYSTEM_PROMPT,
      responseMimeType: "application/json"
    });

    let parsed: any = null;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      const match = rawResponse.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }

    if (parsed) {
      if (parsed.categoria === "ignorar" || (parsed.subject === null && parsed.message === null)) {
        return {
          subject: null,
          message: null,
          categoria: "ignorar"
        };
      }

      const cleanMessage = cleanAutoresponderText(parsed.message || "");
      return {
        subject: parsed.subject ? String(parsed.subject).trim() : `Re: ${sub || "Comunicação Condomínio"}`,
        message: cleanMessage,
        categoria: parsed.categoria ? String(parsed.categoria).trim() : cat
      };
    }
  } catch (err) {
    console.error("[generateCategoryResponse] Erro no modelo:", err);
  }

  // 3. Fallback Heurístico estrito por categoria
  return getFallbackCategoryResponse(cat, sub, body, contexto);
}

/**
 * Fallback heurístico em estrito alinhamento com a secção 1 do System Prompt.
 */
function getFallbackCategoryResponse(cat: string, sub: string, body: string, contexto: any): AutoresponderOutput {
  const nomeProp = contexto.proprietario?.nome ? `Exmo(a). Senhor(a) ${contexto.proprietario.nome}` : "Estimado(a) Condómino(a)";
  const fracaoDesc = contexto.fracao?.letra ? ` referente à fração ${contexto.fracao.letra}` : "";
  const ibanPredio = contexto.predio?.iban ? ` Para pagamentos, poderá utilizar o IBAN do condomínio: ${contexto.predio.iban}.` : "";

  let subject = `Re: ${sub || "Comunicação ao Condomínio"}`;
  let message = "";

  switch (cat) {
    case "quotas":
      if (contexto.quotas) {
        const estado = contexto.quotas.em_atraso ? `em atraso (${contexto.quotas.meses_atraso || "meses pendentes"}) no valor de €${contexto.quotas.valor_atraso || contexto.quotas.valor || "0,00"}` : `regularizadas (quota mensal: €${contexto.quotas.valor || "0,00"})`;
        message = `${nomeProp}, acusamos a receção do seu contacto. Informamos que as quotas da sua fração encontram-se ${estado}.${ibanPredio} Agradecemos o envio do respetivo comprovativo de transferência bancária para conciliação.`;
      } else {
        message = `${nomeProp}, informamos que o condomínio se encontra de momento a atualizar os registos no sistema. Agradecemos o envio do respetivo comprovativo de pagamento ou esclarecimento adicional para conferência das contas${fracaoDesc}.${ibanPredio}`;
      }
      break;

    case "ruido":
      message = `${nomeProp}, agradecemos o seu contacto. Informamos que a sua comunicação relativa a ruído nas partes comuns ou frações vizinhas foi registada. O condomínio irá comunicar com o responsável em estrito cumprimento das regras de silêncio e do regulamento do edifício.`;
      break;

    case "avaria":
      message = `${nomeProp}, acusamos a receção do reporte de avaria. Solicitamos, se possível, a indicação de detalhes adicionais (local exato, hora e tipologia do problema) para acionamento imediato. Informamos que os procedimentos do condomínio foram despoletados e o técnico de manutenção contratado será notificado para intervenção.`;
      break;

    case "assembleia":
      if (contexto.predio?.assembleia_marcada) {
        message = `${nomeProp}, informamos que a próxima assembleia geral encontra-se agendada para o dia ${contexto.predio.assembleia_data || "a anunciar"}, às ${contexto.predio.assembleia_hora || "20:30"} no local ${contexto.predio.assembleia_local || "sala de reuniões do condomínio"}. A ata da última assembleia encontra-se igualmente disponível para consulta.`;
      } else {
        message = `${nomeProp}, informamos que a assembleia geral ordinária será convocada dentro dos prazos estipulados pela legislação aplicável, acompanhada da respetiva ordem de trabalhos e convocatória formal.`;
      }
      break;

    case "documentos":
      if (contexto.seguros?.apolice) {
        message = `${nomeProp}, acusamos o seu pedido de documentação. Os documentos oficiais (atas e regulamento) encontram-se arquivados e disponíveis na pasta do condomínio. Mais informamos que o seguro multirriscos do condomínio tem a apólice nº ${contexto.seguros.apolice} (${contexto.seguros.seguradora || "Seguradora"}) com validade até ${contexto.seguros.validade || "em vigor"}.`;
      } else {
        message = `${nomeProp}, acusamos a receção do seu pedido de documentos (atas, regulamento ou declarações). O mesmo será emitido pelos serviços administrativos do condomínio nos prazos e procedimentos habituais.`;
      }
      break;

    case "informacao":
      message = `${nomeProp}, acusamos a receção da sua questão e agradecemos o contacto. A sua dúvida foi registada pelos serviços do condomínio. Caso necessite de elementos mais específicos, solicitamos o envio de esclarecimento adicional.`;
      break;

    case "administracao":
      const contactoAdmin = contexto.predio?.email || contexto.predio?.email_condominio || "administracao@condomanager.pt";
      message = `${nomeProp}, agradecemos o seu contacto dirigido à administração do condomínio. Para qualquer questão operacional ou agendamento direto com o gestor do edifício, poderá contactar através do correio eletrónico ${contactoAdmin}.`;
      break;

    case "condominio":
      message = `${nomeProp}, acusamos a receção da sua comunicação referente às regras do edifício. O uso das partes comuns e a convivência no prédio regem-se pelas normas estabelecidas no Regulamento Interno do Condomínio.`;
      break;

    case "seguro":
      if (contexto.seguros?.apolice) {
        message = `${nomeProp}, relativamente ao seguro do condomínio, informamos que a apólice referente ao edifício é a nº ${contexto.seguros.apolice}, contratada junto da ${contexto.seguros.seguradora || "Seguradora Oficial"}, com validade até ${contexto.seguros.validade || "em vigor"}.`;
      } else {
        message = `${nomeProp}, informamos que, de momento, o condomínio não dispõe de registo de apólice de seguro individual arquivada para a respetiva fração no sistema. Caso se trate de sinistro que afete partes comuns, solicitamos o envio de dados complementares.`;
      }
      break;

    case "inquilino":
      message = `Estimado(a) residente, acusamos a receção da sua mensagem e agradecemos o contacto. Tomámos nota da situação transmitida e esclarecemos com cortesia que determinadas decisões e alterações sobre a fração dependem de comunicação e anuência direta do respetivo proprietário.`;
      break;

    case "coproprietario":
      message = `${nomeProp}, acusamos a receção do seu contacto na qualidade de coproprietário da fração. Procedemos ao registo da sua comunicação na ficha da fração com a administração do condomínio.`;
      break;

    case "urgente":
      message = `${nomeProp}, acusamos a receção com prioridade máxima da sua comunicação urgente. Por motivos de segurança, a ocorrência foi encaminhada de imediato. Solicitamos o envio urgente de detalhes da localização no edifício e, em caso de perigo iminente (fuga de água ou gás), solicitamos o fecho preventivo das respetivas torneiras de corte de segurança.`;
      break;

    case "fornecedor":
    case "ignorar":
      return {
        subject: null,
        message: null,
        categoria: "ignorar"
      };

    default:
      message = `${nomeProp}, acusamos a receção da sua comunicação. A mesma foi registada e encaminhada para apreciação dos serviços de gestão do condomínio. Caso necessário, solicitamos esclarecimento adicional.`;
      break;
  }

  return {
    subject,
    message,
    categoria: cat
  };
}


