import { supabase } from "./supabaseServer.js";
import { gerarHtmlAutoresponder, gerarHtmlResposta } from "./htmlemail.js";
import { classifyEmailCategory, generateCategoryResponse } from "../geminiService.ts";

/**
 * Filtro de remetentes automatizados, newsletters e fornecedores
 */
const FORNECEDORES_E_NOREPLY = [
  "noreply",
  "no-reply",
  "do-not-reply",
  "donotreply",
  "automated",
  "mailer-daemon",
  "postmaster",
  "newsletter",
  "marketing",
  "promo",
  "campaign",
  "edp.pt",
  "galp.com",
  "galp.pt",
  "vodafone.pt",
  "meo.pt",
  "nos.pt",
  "seguradora",
  "sotecnisol",
  "conduril"
];

function isBloqueado(email) {
  const e = (email || "").toLowerCase();
  return FORNECEDORES_E_NOREPLY.some((termo) => e.includes(termo));
}

function extrairEmailLimpo(fromStr) {
  if (!fromStr) return "";
  const match = fromStr.match(/<([^>]+)>/);
  return match ? match[1].trim() : fromStr.trim();
}

/**
 * Obter contexto da fração ou proprietário através do email
 */
async function obterContexto(email) {
  try {
    const cleanEmail = extrairEmailLimpo(email);

    // 1. Procurar na tabela fracoes
    const { data: fracao, error: errFracao } = await supabase
      .from("fracoes")
      .select("*, predios(*)")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (fracao && !errFracao) {
      return {
        ...fracao,
        fracao: fracao.fracao || fracao.fracao_nome || fracao.id_fracao || "Fração",
        id_predio: fracao.id_predio || fracao.predios?.id || null,
        nome: fracao.proprietario || fracao.nome || null
      };
    }

    // 2. Procurar na tabela proprietarios
    const { data: prop, error: errProp } = await supabase
      .from("proprietarios")
      .select("*, fracoes(*)")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (prop && !errProp) {
      return {
        ...prop,
        fracao: prop.fracoes?.fracao_nome || prop.fracao || prop.id_fracao || "Fração",
        id_predio: prop.id_predio || prop.fracoes?.id_predio || null,
        nome: prop.nome || null
      };
    }

    return null;
  } catch (e) {
    console.warn("[inboundProcessor] Aviso ao buscar contexto no Supabase:", e?.message || e);
    return null;
  }
}

/**
 * Buscar documentos gerais do condomínio para anexar
 */
async function obterAnexosDoPredio(id_predio) {
  try {
    if (!id_predio) return [];
    const { data, error } = await supabase
      .from("documentos")
      .select("nome, url_foto")
      .eq("id_predio", id_predio);

    if (error || !data) return [];

    return data
      .filter((doc) => doc.url_foto)
      .map((doc) => ({
        filename: doc.nome || "documento.pdf",
        path: doc.url_foto
      }));
  } catch (e) {
    console.warn("[inboundProcessor] Aviso ao obter anexos do condomínio:", e?.message || e);
    return [];
  }
}

/**
 * Lançar comprovativo pendente diretamente em pagamentos e movimentos
 * Mantém conformidade com o frontend (GestaoMovimentos.tsx / GestaoPagamentos.tsx)
 */
async function registarComprovativoPendente({ aiData, contexto, comprovativoUrl, remetenteEmail }) {
  try {
    const isComprovativo =
      aiData?.categoria === "quotas" ||
      aiData?.dadosExtraidos?.valorTotal > 0 ||
      (aiData?.acao && aiData.acao.includes("comprovativo"));

    if (!isComprovativo) return null;

    const valorExtraido = aiData?.dadosExtraidos?.valorTotal || null;
    const dataExtraida = aiData?.dadosExtraidos?.dataDocumento || new Date().toISOString().split("T")[0];
    const entidadeExtraida = aiData?.dadosExtraidos?.entidade || null;
    const fracaoNome = contexto?.fracao || contexto?.fracao_nome || "Fração Não Identificada";

    // 1. Inserir em pagamentos (estado: 'pendente')
    const { data: pagamento, error: errPag } = await supabase
      .from("pagamentos")
      .insert({
        estado: "pendente",
        fracao: fracaoNome,
        id_fracao: contexto?.id_fracao || contexto?.id || null,
        id_proprietario: contexto?.id_proprietario || contexto?.id || null,
        valor: valorExtraido,
        data_pagamento: dataExtraida,
        entidade: entidadeExtraida,
        comprovativo_url: comprovativoUrl || null,
        tipo: "quota_mensal",
        origem: "email_inbound",
        criado_em: new Date().toISOString()
      })
      .select()
      .maybeSingle();

    if (errPag) {
      console.warn("[inboundProcessor] Aviso ao inserir pagamento pendente:", errPag.message);
    }

    // 2. Inserir em movimentos (estado: 'Movimento Cego / Por Justificar', is_movimento_cego: true, estado_conciliacao: 'PENDENTE')
    const { data: movimento, error: errMov } = await supabase
      .from("movimentos")
      .insert({
        id_predio: contexto?.id_predio || null,
        descricao: `Comprovativo Quota via Email (${fracaoNome} - ${extrairEmailLimpo(remetenteEmail)})`,
        valor: valorExtraido || 0,
        tipo: "Receita",
        categoria: "Quotas",
        data: dataExtraida,
        estado: "Movimento Cego / Por Justificar",
        is_movimento_cego: true,
        estado_conciliacao: "PENDENTE",
        comprovativo_url: comprovativoUrl || null,
        origem: "email_inbound"
      })
      .select()
      .maybeSingle();

    if (errMov) {
      console.warn("[inboundProcessor] Aviso ao inserir movimento pendente:", errMov.message);
    }

    return { pagamento, movimento };
  } catch (err) {
    console.error("[inboundProcessor] Erro ao registar comprovativo pendente:", err);
    return null;
  }
}

/**
 * Enviar email via Resend API
 */
async function enviarEmailResend({ to, subject, html, attachments = [] }) {
  const resendApiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
  if (!resendApiKey) {
    console.warn("[inboundProcessor] RESEND_API_KEY não configurada. Email ignorado:", { to, subject });
    return false;
  }

  try {
    const payload = {
      from: process.env.EMAIL_FROM_ADDRESS || "Condomínio <administracao@condomanagerai.com>",
      to: [to],
      subject,
      html
    };

    if (Array.isArray(attachments) && attachments.length > 0) {
      payload.attachments = attachments;
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("[inboundProcessor] Resend API devolveu erro:", resp.status, errBody);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[inboundProcessor] Falha ao enviar email via Resend:", err);
    return false;
  }
}

/**
 * O webhook `email.received` do Resend só envia metadados (from, subject,
 * lista de anexos com nome/tipo) — nunca o corpo do email nem o conteúdo
 * dos anexos. É preciso ir buscar isso à API depois de receber o webhook.
 * https://resend.com/docs/api-reference/emails/retrieve-received-email
 */
async function obterConteudoCompleto(emailId) {
  const resendApiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
  if (!emailId || !resendApiKey) return null;

  try {
    const resp = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${resendApiKey}` }
    });

    if (!resp.ok) {
      console.warn("[inboundProcessor] Falha ao obter email completo:", resp.status, await resp.text());
      return null;
    }

    return await resp.json();
  } catch (err) {
    console.warn("[inboundProcessor] Erro ao obter email completo:", err?.message || err);
    return null;
  }
}

function htmlParaTexto(html) {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Processador Central Inbound de Emails (Resend Webhook & API)
 */
export async function processInboundEmail(payload) {
  const isRealResendWebhook = payload?.type === "email.received" && payload?.data?.email_id;
  const webhookData = payload?.data || payload;

  let from = webhookData?.from || payload?.from || "";
  let subject = webhookData?.subject || payload?.subject || "(Sem assunto)";
  let body = webhookData?.text || webhookData?.body || payload?.body || payload?.bodyText || "";
  let attachments = webhookData?.attachments || payload?.attachments || [];

  // Payload real do Resend: ir buscar o corpo e a lista completa de anexos
  if (isRealResendWebhook) {
    const completo = await obterConteudoCompleto(webhookData.email_id);
    if (completo) {
      from = completo.from || from;
      subject = completo.subject || subject;
      body = completo.text || htmlParaTexto(completo.html) || body;
      attachments = completo.attachments || attachments;
    } else {
      console.warn("[inboundProcessor] Não foi possível obter o corpo completo do email; a processar só com metadados.");
    }
  }

  if (!from) {
    return { ok: false, status: 400, error: "Remetente ('from') é obrigatório." };
  }

  // 1. Filtro anti-fornecedores e no-reply
  if (isBloqueado(from)) {
    console.log("[inboundProcessor] Email descartado (fornecedor/noreply):", from);
    return { ok: true, status: 200, autoresponder: false, motivo: "fornecedor_ou_noreply" };
  }

  const cleanFrom = extrairEmailLimpo(from);
  const textoEmail = (body && String(body).trim()) || "(Email recebido sem texto no corpo)";

  console.log(`[inboundProcessor] A processar email de ${cleanFrom} | Assunto: ${subject}`);

  // 2. Obter contexto da fração/proprietário no Supabase
  const contexto = await obterContexto(cleanFrom);

  // 3. Classificar categoria com IA (in-process)
  let categoria = "outro";
  try {
    const classif = await classifyEmailCategory({
      from: cleanFrom,
      subject,
      bodyText: textoEmail
    });
    categoria = classif.categoria || "outro";
  } catch (err) {
    console.warn("[inboundProcessor] Aviso na classificação IA, assumindo 'outro':", err);
  }

  // 4. Gerar resposta inteligente por categoria com IA e templates oficiais (in-process)
  let aiData = null;
  try {
    aiData = await generateCategoryResponse({
      categoria,
      email: { from: cleanFrom, subject, bodyText: textoEmail },
      contexto
    });
  } catch (err) {
    console.error("[inboundProcessor] Erro ao gerar resposta por categoria:", err);
  }

  const nomeRemetente = contexto?.nome || contexto?.proprietario || cleanFrom.split("@")[0] || "Condómino";

  // 5. Enviar Autoresponder imediato
  const htmlAutoresponder = gerarHtmlAutoresponder(nomeRemetente);
  await enviarEmailResend({
    to: cleanFrom,
    subject: `Recebemos o seu contacto - ${subject}`,
    html: htmlAutoresponder
  });

  // 6. Preparar Anexos da resposta institucional
  let anexosParaEnviar = [];

  if (aiData?.ficheiro?.url) {
    anexosParaEnviar.push({
      filename: aiData.ficheiro.filename || "documento.pdf",
      path: aiData.ficheiro.url
    });
  }

  if (Array.isArray(aiData?.documentos)) {
    for (const doc of aiData.documentos) {
      if (doc.url || doc.path) {
        anexosParaEnviar.push({
          filename: doc.filename || "documento.pdf",
          path: doc.url || doc.path
        });
      }
    }
  }

  if (aiData?.acao === "anexar_documentos" && contexto?.id_predio) {
    const docsPredio = await obterAnexosDoPredio(contexto.id_predio);
    anexosParaEnviar.push(...docsPredio);
  }

  // 7. Lançamento pendente de comprovativos (directo em pagamentos e movimentos)
  let comprovativoUrl = null;
  if (Array.isArray(attachments) && attachments.length > 0) {
    comprovativoUrl = attachments[0]?.url || attachments[0]?.path || null;
  }
  if (!comprovativoUrl && anexosParaEnviar.length > 0) {
    comprovativoUrl = anexosParaEnviar[0]?.path || null;
  }

  const comprovativoRegisto = await registarComprovativoPendente({
    aiData,
    contexto,
    comprovativoUrl,
    remetenteEmail: cleanFrom
  });

  // 8. Enviar resposta institucional se subject e mensagem forem fornecidos
  if (aiData?.subject && aiData?.message) {
    const htmlInstitucional = gerarHtmlResposta(nomeRemetente, aiData.message);
    await enviarEmailResend({
      to: cleanFrom,
      subject: aiData.subject,
      html: htmlInstitucional,
      attachments: anexosParaEnviar
    });
  }

  return {
    ok: true,
    status: 200,
    categoria,
    autoresponder: true,
    respostaEnviada: Boolean(aiData?.subject && aiData?.message),
    comprovativoPendente: Boolean(comprovativoRegisto),
    contexto: contexto ? { fracao: contexto.fracao, predio: contexto.id_predio } : null
  };
}

export default processInboundEmail;
