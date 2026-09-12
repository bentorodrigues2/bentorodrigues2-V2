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
 * Remove formatações indesejadas de markdown/código, preservando a estrutura HTML oficial (com logotipo e assinaturas).
 */
export function cleanAutoresponderText(text: string): string {
  if (!text) return "";
  // Se for uma resposta em formato HTML (com logo <div>, <img> ou <br>), preservar a formatação HTML
  if (text.includes("<div") || text.includes("<br") || text.includes("<img")) {
    return text
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }
  return text
    .replace(/<[^>]*>/g, "") // remove tags HTML não autorizadas
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
 * Logotipo oficial obrigatório no início de TODAS as mensagens do AI Studio Router.
 */
export const AI_STUDIO_ROUTER_LOGO_HTML = `<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp"
       alt="CondoManager AI"
       style="width:240px;opacity:0.95;" />
</div>`;

/**
 * Assinatura oficial da administração do condomínio.
 */
export const AI_STUDIO_ROUTER_SIGNATURE_HTML = `<br><br>
Com os meus cumprimentos,
<br>A administração do condomínio
<br>José Carlos Guerra
<br>📞 919 943 465
<br>✉️ bentorodrgues2@gmail.com`;

/**
 * Monta o email completo em HTML com o logotipo no topo, saudação personalizada, corpo e assinatura.
 */
export function buildOfficialEmailMessage(corpo: string, nomeDestinatario?: string): string {
  const nome = (nomeDestinatario && nomeDestinatario.trim()) ? nomeDestinatario.trim() : "${nome}";
  return `${AI_STUDIO_ROUTER_LOGO_HTML}

Exmo. Sr./Sra. ${nome},
<br><br>
${corpo}
${AI_STUDIO_ROUTER_SIGNATURE_HTML}`;
}

export interface OfficialEmailRouterTemplate {
  numero: number;
  id: string;
  categoriaLabel: string;
  subject: string;
  corpo: string;
  exemploCompleto: string;
}

/**
 * As 13 categorias oficiais com assuntos e textos validados.
 */
export const OFFICIAL_EMAIL_ROUTER_TEMPLATES: Record<string, OfficialEmailRouterTemplate> = {
  ruido: {
    numero: 1,
    id: "ruido",
    categoriaLabel: "Barulho / Ruído",
    subject: "Registo de ocorrência de ruído",
    corpo: `Registámos a sua comunicação referente a ruído proveniente de outra fração. A administração irá contactar os intervenientes e reforçar o cumprimento das regras de convivência previstas no Regulamento Interno.<br><br>Caso o ruído persista, agradecemos que nos informe para podermos atuar de forma mais célere.`,
    exemploCompleto: buildOfficialEmailMessage(
      `Registámos a sua comunicação referente a ruído proveniente de outra fração. A administração irá contactar os intervenientes e reforçar o cumprimento das regras de convivência previstas no Regulamento Interno.<br><br>Caso o ruído persista, agradecemos que nos informe para podermos atuar de forma mais célere.`
    )
  },
  iluminacao: {
    numero: 2,
    id: "iluminacao",
    categoriaLabel: "Lâmpadas avariadas / Iluminação",
    subject: "Intervenção agendada — iluminação comum",
    corpo: `Agradecemos o seu alerta sobre a lâmpada avariada. A administração já registou a ocorrência e irá solicitar a substituição ao técnico responsável.<br><br>Assim que a intervenção estiver concluída, enviaremos nova comunicação.`,
    exemploCompleto: buildOfficialEmailMessage(
      `Agradecemos o seu alerta sobre a lâmpada avariada. A administração já registou a ocorrência e irá solicitar a substituição ao técnico responsável.<br><br>Assim que a intervenção estiver concluída, enviaremos nova comunicação.`
    )
  },
  infiltracoes: {
    numero: 3,
    id: "infiltracoes",
    categoriaLabel: "Infiltrações / Humidades",
    subject: "Registo de infiltração — encaminhamento técnico",
    corpo: `Registámos a situação de infiltração descrita. A administração irá encaminhar o caso para avaliação técnica, de forma a identificar a origem e definir a intervenção necessária.<br><br>Entraremos em contacto assim que tivermos o relatório inicial.`,
    exemploCompleto: buildOfficialEmailMessage(
      `Registámos a situação de infiltração descrita. A administração irá encaminhar o caso para avaliação técnica, de forma a identificar a origem e definir a intervenção necessária.<br><br>Entraremos em contacto assim que tivermos o relatório inicial.`
    )
  },
  portao: {
    numero: 4,
    id: "portao",
    categoriaLabel: "Portão da garagem / Avarias mecânicas",
    subject: "Avaria no portão — intervenção programada",
    corpo: `Agradecemos o seu contacto. A avaria no portão da garagem foi registada e será encaminhada para o técnico habitual.<br><br>Informaremos assim que a deslocação estiver confirmada.`,
    exemploCompleto: buildOfficialEmailMessage(
      `Agradecemos o seu contacto. A avaria no portão da garagem foi registada e será encaminhada para o técnico habitual.<br><br>Informaremos assim que a deslocação estiver confirmada.`
    )
  },
  elevador: {
    numero: 5,
    id: "elevador",
    categoriaLabel: "Elevador (CORRIGIDO)",
    subject: "Avaria no elevador — comunicação à manutenção",
    corpo: `A administração agradece o alerta. A avaria do elevador vai ser comunicada à empresa de manutenção, que irá deslocar-se ao edifício com brevidade.<br><br>Partilharemos atualização assim que possível.`,
    exemploCompleto: buildOfficialEmailMessage(
      `A administração agradece o alerta. A avaria do elevador vai ser comunicada à empresa de manutenção, que irá deslocar-se ao edifício com brevidade.<br><br>Partilharemos atualização assim que possível.`
    )
  },
  atas: {
    numero: 6,
    id: "atas",
    categoriaLabel: "Pedidos de atas (CORRIGIDO)",
    subject: "Envio da ata solicitada",
    corpo: `Conforme solicitado, enviamos em anexo a ata da última assembleia.<br><br>Caso necessite de esclarecimentos adicionais estamos ao seu dispor. Relembramos que poderá consultar todas as atas e outros documentos no menu “Arquivo” da aplicação do condomínio.`,
    exemploCompleto: buildOfficialEmailMessage(
      `Conforme solicitado, enviamos em anexo a ata da última assembleia.<br><br>Caso necessite de esclarecimentos adicionais estamos ao seu dispor. Relembramos que poderá consultar todas as atas e outros documentos no menu “Arquivo” da aplicação do condomínio.`
    )
  },
  documentos: {
    numero: 7,
    id: "documentos",
    categoriaLabel: "Documentos (regulamento, seguro, contratos)",
    subject: "Documentação solicitada",
    corpo: `A documentação solicitada segue em anexo. Caso necessite de outros documentos ou versões atualizadas, poderá solicitar diretamente por esta via.`,
    exemploCompleto: buildOfficialEmailMessage(
      `A documentação solicitada segue em anexo. Caso necessite de outros documentos ou versões atualizadas, poderá solicitar diretamente por esta via.`
    )
  },
  quotas: {
    numero: 8,
    id: "quotas",
    categoriaLabel: "Recibos / Quotas / Pagamentos (CORRIGIDO)",
    subject: "Envio de recibo / informação de quotas",
    corpo: `Enviamos em anexo o recibo solicitado.<br><br>Se necessitar de histórico de pagamentos ou de informação sobre quotas em curso, poderá consultar a aplicação do condomínio.`,
    exemploCompleto: buildOfficialEmailMessage(
      `Enviamos em anexo o recibo solicitado.<br><br>Se necessitar de histórico de pagamentos ou de informação sobre quotas em curso, poderá consultar a aplicação do condomínio.`
    )
  },
  reclamacoes: {
    numero: 9,
    id: "reclamacoes",
    categoriaLabel: "Reclamações",
    subject: "Registo de reclamação",
    corpo: `Registámos a sua reclamação. A administração do condomínio está a analisar a situação com a devida atenção de forma a tomar as diligências cabíveis.<br><br>Entraremos em contacto logo que existam desenvolvimentos.`,
    exemploCompleto: buildOfficialEmailMessage(
      `Registámos a sua reclamação. A administração do condomínio está a analisar a situação com a devida atenção de forma a tomar as diligências cabíveis.<br><br>Entraremos em contacto logo que existam desenvolvimentos.`
    )
  },
  sugestoes: {
    numero: 10,
    id: "sugestoes",
    categoriaLabel: "Sugestões",
    subject: "Agradecimento pela sugestão",
    corpo: `Agradecemos a sua sugestão. Todas as propostas dos condóminos são fundamentais para a melhoria contínua da gestão do nosso edifício. A mesma será avaliada pela administração e, se pertinente, levada a discussão na próxima assembleia de condóminos.`,
    exemploCompleto: buildOfficialEmailMessage(
      `Agradecemos a sua sugestão. Todas as propostas dos condóminos são fundamentais para a melhoria contínua da gestão do nosso edifício. A mesma será avaliada pela administração e, se pertinente, levada a discussão na próxima assembleia de condóminos.`
    )
  },
  reuniao: {
    numero: 11,
    id: "reuniao",
    categoriaLabel: "Pedidos de reunião",
    subject: "Pedido de reunião — confirmação",
    corpo: `Registámos o seu pedido de reunião com a administração do condomínio. Entraremos em contacto brevemente para coordenar uma data e horário mutuamente convenientes.`,
    exemploCompleto: buildOfficialEmailMessage(
      `Registámos o seu pedido de reunião com a administração do condomínio. Entraremos em contacto brevemente para coordenar uma data e horário mutuamente convenientes.`
    )
  },
  limpeza: {
    numero: 12,
    id: "limpeza",
    categoriaLabel: "Limpeza",
    subject: "Registo de ocorrência — limpeza",
    corpo: `Agradecemos o seu alerta referente à limpeza das partes comuns. A ocorrência foi registada e encaminhada de imediato para a equipa responsável pelo serviço de limpeza do edifício.`,
    exemploCompleto: buildOfficialEmailMessage(
      `Agradecemos o seu alerta referente à limpeza das partes comuns. A ocorrência foi registada e encaminhada de imediato para a equipa responsável pelo serviço de limpeza do edifício.`
    )
  },
  vizinhanca: {
    numero: 13,
    id: "vizinhanca",
    categoriaLabel: "Problemas de vizinhança",
    subject: "Registo de ocorrência entre vizinhos",
    corpo: `Registámos a sua comunicação relativa a desacordo ou incómodo entre vizinhos. A administração irá abordar a situação com discrição e apelar ao bom senso e ao estrito cumprimento do Regulamento Interno do Condomínio.`,
    exemploCompleto: buildOfficialEmailMessage(
      `Registámos a sua comunicação relativa a desacordo ou incómodo entre vizinhos. A administração irá abordar a situação com discrição e apelar ao bom senso e ao estrito cumprimento do Regulamento Interno do Condomínio.`
    )
  }
};

/**
 * PROMPT COMPLETO FORMATADO PRONTO A COPIAR PARA O GOOGLE AI STUDIO
 */
export const PROMPT_COMPLETO_AI_STUDIO = `⭐ LOGOTIPO PARA TODOS OS EMAILS (AI Studio Router)
Cola isto no início de TODAS as mensagens:
html
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp"
       alt="CondoManager AI"
       style="width:240px;opacity:0.95;" />
</div>

⭐ PROMPT COMPLETO PARA COLAR NO AI STUDIO (TODAS AS CATEGORIAS)
Organizado, limpo, pronto a colar.

🟦 1. Barulho / Ruído
subject: Registo de ocorrência de ruído
message:
html
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Registámos a sua comunicação referente a ruído proveniente de outra fração. A administração irá contactar os intervenientes e reforçar o cumprimento das regras de convivência previstas no Regulamento Interno.
<br><br>
Caso o ruído persista, agradecemos que nos informe para podermos atuar de forma mais célere.
<br><br>
Com os meus cumprimentos,
<br>A administração do condomínio
<br>José Carlos Guerra
<br>📞 919 943 465
<br>✉️ bentorodrgues2@gmail.com

🟦 2. Lâmpadas avariadas / Iluminação
subject: Intervenção agendada — iluminação comum
message:
html
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Agradecemos o seu alerta sobre a lâmpada avariada. A administração já registou a ocorrência e irá solicitar a substituição ao técnico responsável.
<br><br>
Assim que a intervenção estiver concluída, enviaremos nova comunicação.
<br><br>
Com os meus cumprimentos,
<br>A administração do condomínio
<br>José Carlos Guerra
<br>📞 919 943 465
<br>✉️ bentorodrgues2@gmail.com

🟦 3. Infiltrações / Humidades
subject: Registo de infiltração — encaminhamento técnico
message:
html
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Registámos a situação de infiltração descrita. A administração irá encaminhar o caso para avaliação técnica, de forma a identificar a origem e definir a intervenção necessária.
<br><br>
Entraremos em contacto assim que tivermos o relatório inicial.
<br><br>
Com os meus cumprimentos,
<br>A administração do condomínio
<br>José Carlos Guerra
<br>📞 919 943 465
<br>✉️ bentorodrgues2@gmail.com

🟦 4. Portão da garagem / Avarias mecânicas
subject: Avaria no portão — intervenção programada
message:
html
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Agradecemos o seu contacto. A avaria no portão da garagem foi registada e será encaminhada para o técnico habitual.
<br><br>
Informaremos assim que a deslocação estiver confirmada.
<br><br>
Com os meus cumprimentos,
<br>A administração do condomínio
<br>José Carlos Guerra
<br>📞 919 943 465
<br>✉️ bentorodrgues2@gmail.com

🟦 5. Elevador (CORRIGIDO)
subject: Avaria no elevador — comunicação à manutenção
message:
html
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
A administração agradece o alerta. A avaria do elevador vai ser comunicada à empresa de manutenção, que irá deslocar-se ao edifício com brevidade.
<br><br>
Partilharemos atualização assim que possível.
<br><br>
Com os meus cumprimentos,
<br>A administração do condomínio
<br>José Carlos Guerra
<br>📞 919 943 465
<br>✉️ bentorodrgues2@gmail.com

🟦 6. Pedidos de atas (CORRIGIDO)
subject: Envio da ata solicitada
message:
html
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Conforme solicitado, enviamos em anexo a ata da última assembleia.
<br><br>
Caso necessite de esclarecimentos adicionais estamos ao seu dispor. Relembramos que poderá consultar todas as atas e outros documentos no menu “Arquivo” da aplicação do condomínio.
<br><br>
Com os meus cumprimentos,
<br>A administração do condomínio
<br>José Carlos Guerra
<br>📞 919 943 465
<br>✉️ bentorodrgues2@gmail.com

🟦 7. Documentos (regulamento, seguro, contratos)
subject: Documentação solicitada
message:
html
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
A documentação solicitada segue em anexo. Caso necessite de outros documentos ou versões atualizadas, poderá solicitar diretamente por esta via.
<br><br>
Com os meus cumprimentos,
<br>A administração do condomínio
<br>José Carlos Guerra
<br>📞 919 943 465
<br>✉️ bentorodrgues2@gmail.com

🟦 8. Recibos / Quotas / Pagamentos (CORRIGIDO)
subject: Envio de recibo / informação de quotas
message:
html
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Enviamos em anexo o recibo solicitado.
<br><br>
Se necessitar de histórico de pagamentos ou de informação sobre quotas em curso, poderá consultar a aplicação do condomínio.
<br><br>
Com os meus cumprimentos,
<br>A administração do condomínio
<br>José Carlos Guerra
<br>📞 919 943 465
<br>✉️ bentorodrgues2@gmail.com

🟦 9. Reclamações
subject: Registo de reclamação
message:
html
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Registámos a sua reclamação. A administração do condomínio está a analisar a situação com a devida atenção de forma a tomar as diligências cabíveis.
<br><br>
Entraremos em contacto logo que existam desenvolvimentos.
<br><br>
Com os meus cumprimentos,
<br>A administração do condomínio
<br>José Carlos Guerra
<br>📞 919 943 465
<br>✉️ bentorodrgues2@gmail.com

🟦 10. Sugestões
subject: Agradecimento pela sugestão
message:
html
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Agradecemos a sua sugestão. Todas as propostas dos condóminos são fundamentais para a melhoria contínua da gestão do nosso edifício. A mesma será avaliada pela administração e, se pertinente, levada a discussão na próxima assembleia de condóminos.
<br><br>
Com os meus cumprimentos,
<br>A administração do condomínio
<br>José Carlos Guerra
<br>📞 919 943 465
<br>✉️ bentorodrgues2@gmail.com

🟦 11. Pedidos de reunião
subject: Pedido de reunião — confirmação
message:
html
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Registámos o seu pedido de reunião com a administração do condomínio. Entraremos em contacto brevemente para coordenar uma data e horário mutuamente convenientes.
<br><br>
Com os meus cumprimentos,
<br>A administração do condomínio
<br>José Carlos Guerra
<br>📞 919 943 465
<br>✉️ bentorodrgues2@gmail.com

🟦 12. Limpeza
subject: Registo de ocorrência — limpeza
message:
html
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Agradecemos o seu alerta referente à limpeza das partes comuns. A ocorrência foi registada e encaminhada de imediato para a equipa responsável pelo serviço de limpeza do edifício.
<br><br>
Com os meus cumprimentos,
<br>A administração do condomínio
<br>José Carlos Guerra
<br>📞 919 943 465
<br>✉️ bentorodrgues2@gmail.com

🟦 13. Problemas de vizinhança
subject: Registo de ocorrência entre vizinhos
message:
html
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Registámos a sua comunicação relativa a desacordo ou incómodo entre vizinhos. A administração irá abordar a situação com discrição e apelar ao bom senso e ao estrito cumprimento do Regulamento Interno do Condomínio.
<br><br>
Com os meus cumprimentos,
<br>A administração do condomínio
<br>José Carlos Guerra
<br>📞 919 943 465
<br>✉️ bentorodrgues2@gmail.com`;

/**
 * AI STUDIO — CLASSIFICADOR DE TEMAS (SYSTEM PROMPT)
 * System Prompt oficial com regras estritas de identificação entre as 13 categorias oficiais.
 */
export const CLASSIFICADOR_TEMAS_SYSTEM_PROMPT = `A tua função é identificar o tema principal de um email recebido pelo condomínio entre as 13 categorias oficiais:
1. "ruido" (Barulho / Ruído)
2. "iluminacao" (Lâmpadas avariadas / Iluminação)
3. "infiltracoes" (Infiltrações / Humidades)
4. "portao" (Portão da garagem / Avarias mecânicas)
5. "elevador" (Elevador)
6. "atas" (Pedidos de atas)
7. "documentos" (Documentos - regulamento, seguro, contratos)
8. "quotas" (Recibos / Quotas / Pagamentos)
9. "reclamacoes" (Reclamações)
10. "sugestoes" (Sugestões)
11. "reuniao" (Pedidos de reunião)
12. "limpeza" (Limpeza)
13. "vizinhanca" (Problemas de vizinhança)
Outras: "fornecedor" (faturas ou noreply de empresas) ou "outro".

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
Apenas devolves a categoria correspondente.`;

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
  | "ruido"
  | "iluminacao"
  | "infiltracoes"
  | "portao"
  | "elevador"
  | "atas"
  | "documentos"
  | "quotas"
  | "reclamacoes"
  | "sugestoes"
  | "reuniao"
  | "limpeza"
  | "vizinhanca"
  | "avaria"
  | "assembleia"
  | "informacao"
  | "administracao"
  | "condominio"
  | "seguro"
  | "fornecedor"
  | "outro";

export interface ClassifyEmailOutput {
  categoria: ClassificadorCategoria | string;
}

/**
 * Normaliza qualquer chave ou sinónimo para uma das 13 categorias oficiais.
 */
export function normalizeCategoryKey(rawCat: string): string {
  const c = (rawCat || "").toLowerCase().trim();
  if (c === "ruido" || c === "barulho" || c.includes("ruído")) return "ruido";
  if (c === "iluminacao" || c === "lampada" || c === "lampadas" || c.includes("iluminaç") || c.includes("lâmpada")) return "iluminacao";
  if (c === "infiltracoes" || c === "infiltracao" || c === "humidade" || c === "humidades" || c.includes("infiltraç")) return "infiltracoes";
  if (c === "portao" || c.includes("portão") || c.includes("garagem")) return "portao";
  if (c === "elevador" || c === "ascensor") return "elevador";
  if (c === "atas" || c === "ata" || c.includes("pedidos_de_atas")) return "atas";
  if (c === "documentos" || c === "documento" || c === "seguro" || c === "contratos") return "documentos";
  if (c === "quotas" || c === "recibos" || c === "recibo" || c === "pagamento" || c === "pagamentos") return "quotas";
  if (c === "reclamacoes" || c === "reclamacao" || c.includes("reclamaç") || c === "queixa") return "reclamacoes";
  if (c === "sugestoes" || c === "sugestao" || c.includes("sugest")) return "sugestoes";
  if (c === "reuniao" || c === "reunioes" || c.includes("reuniã")) return "reuniao";
  if (c === "limpeza" || c === "lixo" || c === "sujidade") return "limpeza";
  if (c === "vizinhanca" || c.includes("vizinhan") || c === "vizinho" || c === "vizinhos") return "vizinhanca";
  if (c === "fornecedor" || c === "ignorar") return "fornecedor";
  return c || "outro";
}

/**
 * Classificador Oficial de Temas de Emails do Condomínio.
 */
export async function classifyEmailCategory(input: ClassifyEmailInput): Promise<ClassifyEmailOutput> {
  const from = (input.email?.from || input.from || "").trim();
  const subject = (input.email?.subject || input.subject || "").trim();
  const bodyText = (input.email?.bodyText || input.bodyText || "").trim();

  const fromLower = from.toLowerCase();

  // Verificação de fornecedores e noreply
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
      return { categoria: normalizeCategoryKey(parsed.categoria) };
    }
  } catch (err) {
    console.error("[classifyEmailCategory] Erro na chamada ao Gemini:", err);
  }

  // Fallback heurístico inteligente para as 13 categorias
  const text = (subject + " " + bodyText).toLowerCase();

  if (text.includes("barulho") || text.includes("ruido") || text.includes("ruído") || text.includes("música") || text.includes("som alto") || text.includes("festa")) {
    return { categoria: "ruido" };
  }
  if (text.includes("lâmpada") || text.includes("lampada") || text.includes("luz") || text.includes("iluminação") || text.includes("iluminacao") || text.includes("fundida") || text.includes("escuro")) {
    return { categoria: "iluminacao" };
  }
  if (text.includes("infiltração") || text.includes("infiltracao") || text.includes("humidade") || text.includes("humidades") || text.includes("teto") || text.includes("mancha de água") || text.includes("pingo")) {
    return { categoria: "infiltracoes" };
  }
  if (text.includes("portão") || text.includes("portao") || text.includes("garagem") || text.includes("comando") || text.includes("fecho do portão")) {
    return { categoria: "portao" };
  }
  if (text.includes("elevador") || text.includes("ascensor") || text.includes("preso no elevador")) {
    return { categoria: "elevador" };
  }
  if (text.includes("ata") || text.includes("atas") || text.includes("cópia da ata") || text.includes("envio de ata")) {
    return { categoria: "atas" };
  }
  if (text.includes("recibo") || text.includes("recibos") || text.includes("quota") || text.includes("quotas") || text.includes("pagamento") || text.includes("transferência") || text.includes("transferencia") || text.includes("iban")) {
    return { categoria: "quotas" };
  }
  if (text.includes("reclamação") || text.includes("reclamacao") || text.includes("queixa") || text.includes("protesto") || text.includes("descontentamento")) {
    return { categoria: "reclamacoes" };
  }
  if (text.includes("sugestão") || text.includes("sugestao") || text.includes("ideia") || text.includes("proposta de melhoria")) {
    return { categoria: "sugestoes" };
  }
  if (text.includes("reunião") || text.includes("reuniao") || text.includes("falar com a administração") || text.includes("pedido de reunião") || text.includes("agendamento")) {
    return { categoria: "reuniao" };
  }
  if (text.includes("limpeza") || text.includes("sujo") || text.includes("sujidade") || text.includes("lixo") || text.includes("hall sujo") || text.includes("escadas sujas")) {
    return { categoria: "limpeza" };
  }
  if (text.includes("vizinho") || text.includes("vizinhos") || text.includes("vizinhança") || text.includes("vizinhanca") || text.includes("conflito") || text.includes("desacordo")) {
    return { categoria: "vizinhanca" };
  }
  if (text.includes("documento") || text.includes("regulamento") || text.includes("seguro") || text.includes("apólice") || text.includes("apolice") || text.includes("contrato") || text.includes("certidão")) {
    return { categoria: "documentos" };
  }

  return { categoria: "outro" };
}

/**
 * AI STUDIO — REGRAS INTELIGENTES POR CATEGORIA (SYSTEM PROMPT)
 * Instruções oficiais integrando o logotipo e as 13 categorias exatas.
 */
export const REGRAS_INTELIGENTES_CATEGORIA_SYSTEM_PROMPT = `A tua função é gerar respostas profissionais e institucionais para emails recebidos pelo condomínio, com base no prompt oficial e nas 13 categorias estipuladas.

⭐ REGRA CRÍTICA DE LOGOTIPO:
Todas as mensagens DEVEM começar obrigatoriamente pelo HTML:
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

⭐ REGRA CRÍTICA DE ASSINATURA:
Todas as mensagens DEVEM terminar obrigatoriamente por:
<br><br>
Com os meus cumprimentos,
<br>A administração do condomínio
<br>José Carlos Guerra
<br>📞 919 943 465
<br>✉️ bentorodrgues2@gmail.com

AS 13 CATEGORIAS OFICIAIS:
1. "ruido": subject "Registo de ocorrência de ruído"
2. "iluminacao": subject "Intervenção agendada — iluminação comum"
3. "infiltracoes": subject "Registo de infiltração — encaminhamento técnico"
4. "portao": subject "Avaria no portão — intervenção programada"
5. "elevador": subject "Avaria no elevador — comunicação à manutenção"
6. "atas": subject "Envio da ata solicitada"
7. "documentos": subject "Documentação solicitada"
8. "quotas": subject "Envio de recibo / informação de quotas"
9. "reclamacoes": subject "Registo de reclamação"
10. "sugestoes": subject "Agradecimento pela sugestão"
11. "reuniao": subject "Pedido de reunião — confirmação"
12. "limpeza": subject "Registo de ocorrência — limpeza"
13. "vizinhanca": subject "Registo de ocorrência entre vizinhos"

DEVOLVES SEMPRE EM JSON ESTRITO:
{
  "subject": "Assunto da categoria",
  "message": "Mensagem formatada em HTML com logo, Exmo. Sr./Sra. \${nome}, texto e assinatura",
  "categoria": "categoria"
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
  const normalizedCat = normalizeCategoryKey(input.categoria || "outro");
  const from = (input.email?.from || "").trim();
  const sub = (input.email?.subject || "").trim();
  const body = (input.email?.bodyText || "").trim();
  const contexto = input.contexto || {};

  // Fornecedor e emails automáticos devolvem categoria "ignorar"
  if (normalizedCat === "fornecedor" || normalizedCat === "ignorar") {
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

  // Se corresponder exatamente a uma das 13 categorias oficiais, fornecer diretamente o modelo oficial com substituição de nome
  const nome = (contexto.proprietario?.nome && String(contexto.proprietario.nome).trim())
    ? String(contexto.proprietario.nome).trim()
    : (from ? from.split("@")[0].replace(/[._-]/g, " ") : "Condómino(a)");

  const template = OFFICIAL_EMAIL_ROUTER_TEMPLATES[normalizedCat];
  if (template) {
    const fullMessage = buildOfficialEmailMessage(template.corpo, nome);
    return {
      subject: template.subject,
      message: fullMessage,
      categoria: normalizedCat
    };
  }

  // Fallback geral com logotipo e assinatura
  return getFallbackCategoryResponse(normalizedCat, sub, body, contexto);
}

/**
 * Fallback heurístico em estrito alinhamento com a secção 1 do System Prompt.
 */
export function getFallbackCategoryResponse(cat: string, sub: string, body: string, contexto: any): AutoresponderOutput {
  const normalizedCat = normalizeCategoryKey(cat);
  const nomeProp = contexto.proprietario?.nome ? String(contexto.proprietario.nome).trim() : "Condómino(a)";

  const template = OFFICIAL_EMAIL_ROUTER_TEMPLATES[normalizedCat];
  if (template) {
    return {
      subject: template.subject,
      message: buildOfficialEmailMessage(template.corpo, nomeProp),
      categoria: normalizedCat
    };
  }

  if (normalizedCat === "fornecedor" || normalizedCat === "ignorar") {
    return {
      subject: null,
      message: null,
      categoria: "ignorar"
    };
  }

  const corpoDefault = `Acusamos a receção da sua comunicação. A administração do condomínio registou o seu contacto e procederá à devida apreciação com a máxima brevidade.<br><br>Caso sejam necessários esclarecimentos complementares, entraremos em contacto.`;
  return {
    subject: `Re: ${sub || "Comunicação ao Condomínio"}`,
    message: buildOfficialEmailMessage(corpoDefault, nomeProp),
    categoria: normalizedCat || "outro"
  };
}



