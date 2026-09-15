import {
  OFFICIAL_EMAIL_ROUTER_TEMPLATES,
  AI_STUDIO_ROUTER_LOGO_HTML,
  AI_STUDIO_ROUTER_SIGNATURE_HTML,
  PROMPT_COMPLETO_AI_STUDIO,
  classifyEmailCategory,
  generateCategoryResponse,
  getFallbackCategoryResponse,
  processAutoresponderEmail
} from "../server/geminiService.js";
import { gerarHtmlResposta } from "../server/lib/htmlemail.js";
import { enviarEmailSemAnexo } from "../server/lib/mailer.js";
import { supabase } from "../server/lib/supabaseServer.js";

export default async function handler(req, res) {
  const acao = req.query?.acao || req.body?.acao;

  // SINCRONIZAÇÃO REAL DA CAIXA DE ENTRADA (/api/email?acao=sincronizar-caixa-entrada)
  // O processamento em si já é automático e em tempo real via webhook do
  // Resend (api/webhooks/resend.js) — este botão não "liga" nada que esteja
  // desligado, serve para dar um diagnóstico real e imediato: quantos
  // emails chegaram nas últimas 24h (consulta direta à API do Resend) e
  // quantas pendências há mesmo neste prédio neste momento (respostas de IA
  // por aprovar + movimentos cegos por justificar), em vez de mostrar
  // sempre "0 pendências críticas" sem verificar nada.
  if (acao === "sincronizar-caixa-entrada") {
    try {
      const idPredio = req.method === "GET" ? req.query?.id_predio : req.body?.id_predio;
      const resendApiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY;

      let emailsRecebidos24h = 0;
      let ultimoEmailRecebido = null;
      if (resendApiKey) {
        const resp = await fetch("https://api.resend.com/emails/receiving?limit=50", {
          headers: { Authorization: `Bearer ${resendApiKey}` }
        });
        if (resp.ok) {
          const data = await resp.json();
          const emails = Array.isArray(data?.data) ? data.data : [];
          const agora = Date.now();
          emailsRecebidos24h = emails.filter((e) => agora - new Date(e.created_at).getTime() < 24 * 60 * 60 * 1000).length;
          ultimoEmailRecebido = emails[0]?.created_at || null;
        }
      }

      let respostasPendentes = 0;
      let movimentosPorJustificar = 0;
      if (idPredio) {
        const { count: cResp } = await supabase
          .from("respostas_ia_pendentes")
          .select("id", { count: "exact", head: true })
          .eq("id_predio", idPredio)
          .eq("estado", "PENDENTE");
        respostasPendentes = cResp || 0;

        const { count: cMov } = await supabase
          .from("movimentos")
          .select("id_movimento", { count: "exact", head: true })
          .eq("id_predio", idPredio)
          .eq("is_movimento_cego", true)
          .eq("estado", "Movimento Cego / Por Justificar");
        movimentosPorJustificar = cMov || 0;
      }

      return res.status(200).json({
        ok: true,
        emailsRecebidos24h,
        ultimoEmailRecebido,
        respostasPendentes,
        movimentosPorJustificar,
        totalPendenciasCriticas: respostasPendentes + movimentosPorJustificar
      });
    } catch (err) {
      console.error("[api/email?acao=sincronizar-caixa-entrada] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro ao sincronizar a caixa de entrada" });
    }
  }

  // 0. NOTIFICAÇÃO INSTITUCIONAL SIMPLES, SEM ANEXO (/api/email?acao=notificar)
  // Usado por ações pontuais do admin que não têm documento associado
  // (ex.: pedido/aviso de apólice de seguro em falta ou expirada).
  if (acao === "notificar") {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }
    try {
      const { to, nomeDestinatario, assunto, mensagem } = req.body || {};
      if (!to || !assunto || !mensagem) {
        return res.status(400).json({ error: "to, assunto e mensagem são obrigatórios" });
      }
      const html = gerarHtmlResposta(nomeDestinatario || "Condómino(a)", mensagem);
      const enviado = await enviarEmailSemAnexo({ to, subject: assunto, html });
      if (!enviado) {
        return res.status(502).json({ error: "Falha ao enviar o email via Resend" });
      }
      return res.status(200).json({ ok: true, email_enviado: true });
    } catch (err) {
      console.error("[api/email?acao=notificar] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro ao enviar notificação" });
    }
  }

  // 0.5. COMUNICADO GLOBAL / BROADCAST (/api/email?acao=broadcast)
  // Usado por GestaoComunicacoes.tsx (e pela ADENDA FG-COMM em IAAvancada.tsx)
  // para enviar um comunicado real a todos os destinatários indicados.
  if (acao === "broadcast") {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }
    try {
      const { destinatarios, assunto, mensagem, urgente } = req.body || {};
      if (!Array.isArray(destinatarios) || destinatarios.length === 0 || !assunto || !mensagem) {
        return res.status(400).json({ error: "destinatarios[], assunto e mensagem são obrigatórios" });
      }
      const assuntoFinal = urgente ? `🚨 URGENTE — ${assunto}` : assunto;
      let enviados = 0;
      for (const dest of destinatarios) {
        if (!dest?.email) continue;
        const html = gerarHtmlResposta(dest.nome || "Condómino(a)", mensagem);
        const ok = await enviarEmailSemAnexo({ to: dest.email, subject: assuntoFinal, html });
        if (ok) enviados += 1;
      }
      return res.status(200).json({ ok: true, total_destinatarios: destinatarios.length, total_enviados: enviados });
    } catch (err) {
      console.error("[api/email?acao=broadcast] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro ao enviar comunicado" });
    }
  }

  // 1. TEMPLATES (/api/ai-studio-router/templates -> ?acao=router-templates)
  if (
    acao === "router-templates" ||
    acao === "templates" ||
    req.query?.templates !== undefined ||
    (typeof req.url === "string" && req.url.includes("templates"))
  ) {
    return res.status(200).json({
      status: "ok",
      logotipoHtml: AI_STUDIO_ROUTER_LOGO_HTML,
      assinaturaHtml: AI_STUDIO_ROUTER_SIGNATURE_HTML,
      promptCompleto: PROMPT_COMPLETO_AI_STUDIO,
      templates: OFFICIAL_EMAIL_ROUTER_TEMPLATES
    });
  }

  // 2. AUTORESPONDER (/api/autoresponder -> ?acao=autoresponder)
  if (acao === "autoresponder") {
    if (req.method === "GET") {
      return res.status(200).json({ status: "online", endpoint: "/api/autoresponder" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const result = await processAutoresponderEmail(req.body);
      return res.status(result.status || 200).json(result);
    } catch (err) {
      console.error("[api/email?acao=autoresponder] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro no autoresponder" });
    }
  }

  // 3. CLASSIFICADOR (/api/classificador -> ?acao=classificador)
  if (acao === "classificador") {
    if (req.method === "GET") {
      return res.status(200).json({ status: "online", endpoint: "/api/classificador" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const result = await classifyEmailCategory(req.body);
      return res.status(200).json(result);
    } catch (err) {
      console.error("[api/email?acao=classificador] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro no classificador" });
    }
  }

  // 4. RESPOSTA CATEGORIA (/api/resposta-categoria -> ?acao=resposta-categoria)
  if (acao === "resposta-categoria") {
    if (req.method === "GET") {
      return res.status(200).json({ status: "online", endpoint: "/api/resposta-categoria" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const result = await generateCategoryResponse(req.body);
      return res.status(200).json(result);
    } catch (err) {
      console.error("[api/email?acao=resposta-categoria] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro ao gerar resposta por categoria" });
    }
  }

  // 5. ROUTER GERAL (/api/ai-studio-router -> ?acao=router)
  if (acao === "router" || acao === "ai-studio-router" || !acao) {
    if (req.method === "GET") {
      const hasKey = Boolean(process.env.GEMINI_API_KEY);
      return res.status(200).json({
        status: "online",
        router: "AI Studio Router (Bento Rodrigues Condomínios)",
        geminiKeyConfigurada: hasKey,
        totalCategorias: Object.keys(OFFICIAL_EMAIL_ROUTER_TEMPLATES).length,
        categorias: Object.keys(OFFICIAL_EMAIL_ROUTER_TEMPLATES),
        logotipoUrl: "https://bentorodrigues2.condomanagerai.com/email/20-logotipo.webp",
        instrucoes: "Endpoint pronto para chamadas POST de autoresponder com as 13 categorias e logotipo oficial."
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const body = req.body || {};
      const email = body.email || {};
      const contexto = body.contexto || {};
      let categoria = body.categoria;

      // Se categoria não foi enviada, classificar primeiro
      if (!categoria) {
        const classif = await classifyEmailCategory({
          from: email.from || "",
          subject: email.subject || "",
          bodyText: email.bodyText || ""
        });
        categoria = classif.categoria;
      }

      const result = await generateCategoryResponse({
        categoria,
        email,
        contexto
      });

      return res.status(200).json(result);
    } catch (err) {
      const errStr = String(err?.message || err);
      const isBlocked =
        errStr.includes("API_KEY_SERVICE_BLOCKED") ||
        errStr.includes("UNAUTHENTICATED") ||
        errStr.includes("401");

      console.warn(
        "[api/email?acao=router] Erro no Gemini, acionando contingência:",
        errStr
      );

      const fallbackOutput = getFallbackCategoryResponse(
        req.body?.categoria || "outro",
        req.body?.email?.subject || "",
        req.body?.email?.bodyText || "",
        req.body?.contexto || {}
      );

      return res.status(200).json({
        subject: fallbackOutput.subject,
        message: fallbackOutput.message,
        categoria: fallbackOutput.categoria,
        source: "fallback_contingencia_oficial",
        diagnostico: {
          aviso: isBlocked
            ? "GEMINI_API_KEY com restrições na Google Cloud Console (API_KEY_SERVICE_BLOCKED)."
            : "Resposta gerada pelo motor institucional de 13 categorias oficiais.",
          detalhe: errStr
        }
      });
    }
  }

  return res.status(400).json({
    error: "Ação não especificada ou inválida. Use ?acao=autoresponder|classificador|resposta-categoria|router|router-templates"
  });
}
