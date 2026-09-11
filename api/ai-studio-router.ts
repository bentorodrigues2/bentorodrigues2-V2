import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

interface EmailInput {
  from?: string;
  to?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
}

interface ContextoInput {
  proprietario?: { nome?: string; email?: string; [k: string]: any };
  fracao?: { letra?: string; piso?: string; [k: string]: any };
  predio?: { nome?: string; iban?: string; email?: string; email_condominio?: string; [k: string]: any };
  quotas?: { valor?: number; em_atraso?: boolean; meses_atraso?: string | number; valor_atraso?: number; [k: string]: any };
  seguros?: { seguradora?: string; apolice?: string; validade?: string; [k: string]: any };
  [k: string]: any;
}

interface RouterPayload {
  email?: EmailInput;
  contexto?: ContextoInput;
  categoria?: string;
  action?: "classify" | "respond" | "route";
}

// Fallback Heurístico Estrito alinhado com o Regulamento de Condomínios em Portugal
function gerarRespostaFallback(cat: string, sub: string, contexto: ContextoInput = {}) {
  const nomeProp = contexto.proprietario?.nome ? `Exmo(a). Senhor(a) ${contexto.proprietario.nome}` : "Estimado(a) Condómino(a)";
  const fracaoDesc = contexto.fracao?.letra ? ` referente à fração ${contexto.fracao.letra}` : "";
  const ibanPredio = contexto.predio?.iban ? ` Para pagamentos, poderá utilizar o IBAN do condomínio: ${contexto.predio.iban}.` : "";
  const subject = `Re: ${sub || "Comunicação ao Condomínio"}`;

  let message = "";

  switch (cat) {
    case "quotas":
      if (contexto.quotas) {
        const estado = contexto.quotas.em_atraso
          ? `em atraso (${contexto.quotas.meses_atraso || "pendente"}) no valor de €${contexto.quotas.valor_atraso || contexto.quotas.valor || "0,00"}`
          : `regularizadas (quota mensal: €${contexto.quotas.valor || "0,00"})`;
        message = `${nomeProp}, acusamos a receção do seu contacto. Informamos que as quotas da sua fração encontram-se ${estado}.${ibanPredio} Agradecemos o envio do respetivo comprovativo de transferência bancária para conciliação.`;
      } else {
        message = `${nomeProp}, informamos que o condomínio se encontra de momento a atualizar os registos no sistema. Agradecemos o envio do respetivo comprovativo de pagamento ou esclarecimento adicional para conferência das contas${fracaoDesc}.${ibanPredio}`;
      }
      break;

    case "ruido":
      message = `${nomeProp}, acusamos a receção da sua comunicação sobre ruído. O condomínio zela pelo cumprimento das regras de descanso e do Regulamento Interno (em especial no período noturno entre as 23h e as 07h). O assunto foi registado e serão encetadas as diligências adequadas.`;
      break;

    case "avaria":
      message = `${nomeProp}, acusamos a receção do reporte de avaria nas partes comuns do edifício. A situação foi encaminhada para a equipa de manutenção técnica para avaliação e intervenção prioritária.`;
      break;

    case "assembleia":
      if (contexto.predio?.assembleia_marcada && contexto.predio?.assembleia_data) {
        message = `${nomeProp}, a próxima Assembleia de Condóminos está agendada para ${contexto.predio.assembleia_data}${contexto.predio.assembleia_hora ? ` às ${contexto.predio.assembleia_hora}` : ""}${contexto.predio.assembleia_local ? ` no ${contexto.predio.assembleia_local}` : ""}. A ata da sessão anterior encontra-se disponível para consulta.`;
      } else {
        message = `${nomeProp}, informamos que a próxima Assembleia de Condóminos será devidamente convocada nos termos do Código Civil com o envio da respetiva ordem de trabalhos.`;
      }
      break;

    case "documentos":
      message = `${nomeProp}, acusamos a receção do seu pedido de documentação. Os documentos solicitados podem ser consultados na área do condómino ou remetidos pela administração após conferência dos registos.`;
      break;

    case "seguro":
      if (contexto.seguros?.apolice) {
        message = `${nomeProp}, relativamente ao seguro do condomínio, a apólice referente ao edifício é a nº ${contexto.seguros.apolice}, contratada junto da ${contexto.seguros.seguradora || "Companhia de Seguros"}, com validade até ${contexto.seguros.validade || "em vigor"}.`;
      } else {
        message = `${nomeProp}, informamos que, de momento, o condomínio não dispõe de registo de apólice de seguro individual arquivada para a respetiva fração no sistema. Caso se trate de sinistro que afete partes comuns, solicitamos o envio de dados complementares.`;
      }
      break;

    case "inquilino":
      message = `Estimado(a) residente, acusamos a receção da sua mensagem e agradecemos o contacto. Esclarecemos que determinadas decisões e alterações sobre a fração dependem de comunicação e anuência direta do respetivo proprietário.`;
      break;

    case "coproprietario":
      message = `${nomeProp}, acusamos a receção do seu contacto na qualidade de coproprietário da fração. Procedemos ao registo da sua comunicação na ficha da fração com a administração.`;
      break;

    case "urgente":
      message = `${nomeProp}, acusamos a receção com prioridade máxima da sua comunicação urgente. Por motivos de segurança, a ocorrência foi encaminhada de imediato. Solicitamos o fecho preventivo das torneiras de corte de água ou gás caso exista perigo iminente.`;
      break;

    case "fornecedor":
    case "ignorar":
      return { subject: null, message: null, categoria: "ignorar" };

    default:
      message = `${nomeProp}, acusamos a receção da sua comunicação. A mesma foi registada e encaminhada para os serviços de gestão do condomínio.`;
      break;
  }

  return { subject, message, categoria: cat };
}

// Classificação heurística rápida por palavras-chave se Gemini estiver offline ou bloqueado
function classificarHeuristico(texto: string): string {
  const t = texto.toLowerCase();
  if (t.includes("quota") || t.includes("comprovativo") || t.includes("transferencia") || t.includes("pagamento") || t.includes("iban")) return "quotas";
  if (t.includes("barulho") || t.includes("ruido") || t.includes("musica") || t.includes("festa") || t.includes("vizinho")) return "ruido";
  if (t.includes("elevador") || t.includes("avaria") || t.includes("lampada") || t.includes("portao") || t.includes("luz") || t.includes("bomba")) return "avaria";
  if (t.includes("assembleia") || t.includes("reuniao") || t.includes("ata") || t.includes("convocatoria")) return "assembleia";
  if (t.includes("sinistro") || t.includes("seguro") || t.includes("apolice") || t.includes("inundacao") || t.includes("fuga")) return "seguro";
  if (t.includes("arrendatario") || t.includes("inquilino") || t.includes("arrendado")) return "inquilino";
  if (t.includes("coproprietario") || t.includes("segundo titular")) return "coproprietario";
  if (t.includes("urgente") || t.includes("emergencia") || t.includes("fogo") || t.includes("inundar")) return "urgente";
  if (t.includes("fatura") || t.includes("edp") || t.includes("galp") || t.includes("vodafone") || t.includes("recibo de fornecedor")) return "fornecedor";
  return "informacao";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Health check & Diagnostics no GET
  if (req.method === "GET") {
    const hasKey = Boolean(process.env.GEMINI_API_KEY);
    return res.status(200).json({
      status: "online",
      router: "AI Studio Condomínio Router",
      geminiKeyConfigurada: hasKey,
      instrucoes: hasKey
        ? "Pronto para receber chamadas POST de automação de email e autoresponder."
        : "AVISO: Configure a variável GEMINI_API_KEY no painel da Vercel (Project Settings > Environment Variables)."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const body = (req.body || {}) as RouterPayload;
  const email = body.email || {};
  const contexto = body.contexto || {};
  const from = email.from || "";
  const sub = email.subject || "";
  const bodyText = email.bodyText || "";
  const fullText = `${sub} ${bodyText}`;

  // Verificar se é remetente automático / fornecedor antes de qualquer chamada
  const fromLower = from.toLowerCase();
  const isSupplier = [
    "noreply", "no-reply", "mailer-daemon", "postmaster",
    "edp.pt", "galp.com", "galp.pt", "vodafone.pt", "meo.pt", "nos.pt"
  ].some(domain => fromLower.includes(domain));

  if (isSupplier || body.categoria === "fornecedor" || body.categoria === "ignorar") {
    return res.status(200).json({
      subject: null,
      message: null,
      categoria: "ignorar",
      filtrado: true,
      motivoFiltro: "Email de fornecedor ou remetente noreply identificado."
    });
  }

  // Tentar chamar Gemini com fallback defensivo para NUNCA devolver 500
  let categoriaFinal = body.categoria || classificarHeuristico(fullText);
  let geminiErrorDiagnostic: any = null;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const promptClassificar = `És o assistente oficial de condomínios. Analisa o email e classifica numa das categorias: quotas, ruido, avaria, assembleia, documentos, informacao, administracao, condominio, seguro, inquilino, coproprietario, urgente, fornecedor, outro.
Email:
Assunto: ${sub}
De: ${from}
Texto: ${bodyText}

Responde estritamente com o nome da categoria em minúsculas (ex: "quotas").`;

      if (!body.categoria) {
        const catRes = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: [{ role: "user", parts: [{ text: promptClassificar }] }]
        });
        const detected = catRes.text?.trim().toLowerCase();
        if (detected && detected.length < 30) {
          categoriaFinal = detected;
        }
      }

      if (categoriaFinal === "fornecedor" || categoriaFinal === "ignorar") {
        return res.status(200).json({
          subject: null,
          message: null,
          categoria: "ignorar",
          filtrado: true
        });
      }

      // Gerar resposta com Gemini
      const promptResposta = `És a Administração do Condomínio em Portugal.
Gera uma resposta formal, cordial e institucional em Português de Portugal para o seguinte email recebido.
Categoria: ${categoriaFinal}
Email do Condómino: ${sub} - ${bodyText}
Contexto: ${JSON.stringify(contexto)}

Devolve SEMPRE estritamente um JSON no formato:
{
  "subject": "Re: ${sub || "Comunicação ao Condomínio"}",
  "message": "Texto institucional da resposta...",
  "categoria": "${categoriaFinal}"
}`;

      const respModel = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        config: { responseMimeType: "application/json" },
        contents: [{ role: "user", parts: [{ text: promptResposta }] }]
      });

      if (respModel.text) {
        try {
          const parsed = JSON.parse(respModel.text);
          return res.status(200).json({
            subject: parsed.subject || `Re: ${sub}`,
            message: parsed.message || "",
            categoria: parsed.categoria || categoriaFinal,
            source: "gemini_ai"
          });
        } catch {
          // Caso json parse falhe, continuar para fallback
        }
      }
    } catch (err: any) {
      const errStr = String(err?.message || err);
      const isBlocked = errStr.includes("API_KEY_SERVICE_BLOCKED") || errStr.includes("UNAUTHENTICATED") || errStr.includes("401");

      geminiErrorDiagnostic = {
        code: isBlocked ? 401 : 500,
        reason: isBlocked ? "API_KEY_SERVICE_BLOCKED" : "MODEL_ERROR",
        message: isBlocked
          ? "A GEMINI_API_KEY configurada na Vercel está com restrições ativas na Google Cloud Console que bloqueiam o serviço 'generativelanguage.googleapis.com'. Remova as restrições da chave ou crie uma nova em https://aistudio.google.com/app/apikey"
          : errStr
      };
      console.warn("[/api/ai-studio-router] Falha ao contactar Gemini, usando motor de regras de condomínio:", geminiErrorDiagnostic);
    }
  } else {
    geminiErrorDiagnostic = {
      code: 400,
      reason: "API_KEY_MISSING",
      message: "GEMINI_API_KEY não definida nas variáveis de ambiente da Vercel."
    };
  }

  // Fallback garantido: Resposta institucional perfeita pelas regras do condomínio (Nunca crasha com 500!)
  const fallback = gerarRespostaFallback(categoriaFinal, sub, contexto);

  return res.status(200).json({
    subject: fallback.subject,
    message: fallback.message,
    categoria: fallback.categoria,
    source: "regras_condominio_fallback",
    ...(geminiErrorDiagnostic ? { diagnostico_ia: geminiErrorDiagnostic } : {})
  });
}
