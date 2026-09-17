import { emitirQuotasMensais, enviarLembretesQuotas, avisarQuotasEmMora, enviarFelicitacoesAniversario } from "../server/lib/cronService.js";
import { supabase } from "../server/lib/supabaseServer.js";
import { enviarEmailSemAnexo } from "../server/lib/mailer.js";
import { gerarHtmlResposta } from "../server/lib/htmlemail.js";
import { enviarEmailResend } from "../server/lib/inboundProcessor.js";
import { exigirSessaoValida, exigirSessaoComPapel } from "../server/lib/verificarSessao.js";
import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:administracao@condomanagerai.com";
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const JOBS = {
  EMISSAO_MENSAL_QUOTAS: emitirQuotasMensais,
  LEMBRETE_CORDIAL_VENCIMENTO: enviarLembretesQuotas,
  AVISO_MORA_INCUMPRIMENTO: avisarQuotasEmMora,
  FELICITACOES_ANIVERSARIO: enviarFelicitacoesAniversario
};

const SITE_URL = process.env.SITE_URL || "https://bentorodrigues2.condomanagerai.com";

/**
 * Cria (ou reconvida) um acesso real à plataforma: gera um utilizador real
 * no Supabase Auth e devolve um link de ativação para a pessoa definir a
 * sua própria password — substitui o padrão antigo de gerar uma "password
 * provisória" e mostrá-la num PDF/alerta (nunca deve ir texto simples de
 * password para lado nenhum).
 */
async function convidarUtilizador({ email, nome, role, id_predio, id_fracao }) {
  const emailLimpo = (email || "").trim().toLowerCase();
  if (!emailLimpo || !role) {
    throw new Error("email e role são obrigatórios");
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "invite",
    email: emailLimpo,
    options: {
      data: { nome: nome || "", role },
      redirectTo: SITE_URL
    }
  });

  if (error) {
    // Se o utilizador já existir (reenvio de convite), gera antes um link de recuperação de password.
    if (String(error.message || "").toLowerCase().includes("already been registered") || error.code === "email_exists") {
      const { data: recData, error: recError } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email: emailLimpo,
        options: { redirectTo: SITE_URL }
      });
      if (recError) throw new Error(recError.message);
      await atualizarPerfil({ id: recData.user?.id, email: emailLimpo, nome, role, id_predio, id_fracao });
      return { actionLink: recData.action_link, reenvio: true };
    }
    throw new Error(error.message);
  }

  await atualizarPerfil({ id: data.user?.id, email: emailLimpo, nome, role, id_predio, id_fracao });
  return { actionLink: data.action_link, reenvio: false };
}

/**
 * Pedido de "Esqueceu-se da password?" feito pelo próprio utilizador no
 * login. Em vez de deixar o supabase.auth.resetPasswordForEmail (chamado
 * diretamente do browser) disparar o email genérico e em inglês do próprio
 * Supabase, geramos o link aqui no servidor e enviamos nós o email, com a
 * mesma marca/idioma dos restantes emails da app. Devolve sempre sucesso,
 * exista ou não a conta, para não revelar a terceiros que emails têm conta.
 */
async function pedirRecuperacaoPassword({ email }) {
  const emailLimpo = (email || "").trim().toLowerCase();
  if (!emailLimpo) throw new Error("email é obrigatório");

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: emailLimpo,
    options: { redirectTo: SITE_URL }
  });

  if (error) {
    console.warn("[recuperar-password] Não foi possível gerar o link:", error.message);
    return { enviado: false };
  }

  const actionLink = data.action_link;
  const mensagem =
    `Recebemos um pedido para redefinir a palavra-passe da sua conta no CondoManager AI.<br><br>Para escolher uma nova palavra-passe, clique no botão abaixo:<br><br>` +
    `<a href="${actionLink}" style="display:inline-block;background-color:#0f766e;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Redefinir Palavra-passe</a><br><br>` +
    `Se o botão não funcionar, copie e cole este link no navegador:<br>${actionLink}<br><br>Se não pediu esta alteração, pode ignorar este email com segurança — a sua palavra-passe atual mantém-se inalterada.`;

  const html = gerarHtmlResposta("Utilizador(a)", mensagem);
  const enviado = await enviarEmailSemAnexo({ to: emailLimpo, subject: "Redefinição de Palavra-passe — CondoManager AI", html });
  return { enviado };
}

async function atualizarPerfil({ id, email, nome, role, id_predio, id_fracao }) {
  if (!id) return;
  await supabase.from("profiles").upsert({
    id,
    email,
    nome: nome || null,
    role,
    id_predio: id_predio || null,
    fracao: id_fracao || null,
    ativo: true
  });
}

/**
 * Disparo manual, a partir da app, dos mesmos jobs que o /api/cron corre
 * automaticamente todos os dias (ver AgendadorAutomatico.tsx e
 * EnviosProgramados.tsx — "executar agora" / "forçar disparo"). Distinto de
 * /api/cron (que exige CRON_SECRET, por ser acionado por um worker externo);
 * este é só para o admin, já autenticado na app, forçar um job na hora.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const acao = req.query?.acao;

  // "recuperar-password" tem de continuar acessível sem sessão — é chamado
  // a partir do ecrã de login, antes de existir qualquer sessão. Todas as
  // outras ações (aprovar/rejeitar respostas de IA, enviar push, convidar
  // novos utilizadores, forçar jobs internos) exigem sessão válida.
  if (acao !== "recuperar-password") {
    const utilizador = await exigirSessaoValida(req, res);
    if (!utilizador) return;
  }

  if (acao === "aprovar-resposta-ia") {
    try {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: "id é obrigatório" });

      const { data: resposta, error: errFetch } = await supabase
        .from("respostas_ia_pendentes")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (errFetch || !resposta) return res.status(404).json({ error: "Resposta pendente não encontrada" });
      if (resposta.estado !== "PENDENTE") return res.status(400).json({ error: "Esta resposta já foi resolvida" });

      const enviado = await enviarEmailResend({
        to: resposta.destinatario_email,
        subject: resposta.assunto,
        html: resposta.mensagem_html,
        attachments: resposta.anexos || [],
        fromAddress: resposta.from_address,
        replyTo: resposta.reply_to || undefined
      });

      if (enviado) {
        await supabase
          .from("respostas_ia_pendentes")
          .update({ estado: "ENVIADA", resolvido_em: new Date().toISOString() })
          .eq("id", id);
      }

      return res.status(200).json({ ok: true, enviado });
    } catch (err) {
      console.error("Erro em /api/admin?acao=aprovar-resposta-ia:", err);
      return res.status(500).json({ error: err?.message || String(err) });
    }
  }

  if (acao === "rejeitar-resposta-ia") {
    try {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: "id é obrigatório" });
      await supabase
        .from("respostas_ia_pendentes")
        .update({ estado: "REJEITADA", resolvido_em: new Date().toISOString() })
        .eq("id", id)
        .eq("estado", "PENDENTE");
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("Erro em /api/admin?acao=rejeitar-resposta-ia:", err);
      return res.status(500).json({ error: err?.message || String(err) });
    }
  }

  if (acao === "enviar-push") {
    try {
      if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        return res.status(500).json({ error: "Chaves VAPID não configuradas no servidor." });
      }
      const { id_predio, id_fracao, title, body, url, categoria } = req.body || {};
      if (!id_predio || !title || !body) {
        return res.status(400).json({ error: "id_predio, title e body são obrigatórios" });
      }

      let query = supabase.from("push_subscriptions").select("id, endpoint, subscription, user_id").eq("id_predio", id_predio);
      if (id_fracao) query = query.eq("id_fracao", id_fracao);
      let { data: subs, error: errSubs } = await query;
      if (errSubs) throw new Error(errSubs.message);

      // Categorias opcionais respeitam a preferência do utilizador
      // (profiles.notificacoes_preferencias) — categorias críticas (ou sem
      // categoria indicada, para compatibilidade com envios mais antigos)
      // são sempre enviadas a todos os subscritos.
      let bloqueadosPorPreferencia = 0;
      if (categoria && categoria.startsWith("optional_")) {
        const emails = (subs || []).map((s) => s.user_id).filter(Boolean);
        if (emails.length > 0) {
          const { data: perfis } = await supabase
            .from("profiles")
            .select("email, notificacoes_preferencias")
            .in("email", emails);
          const desativados = new Set(
            (perfis || [])
              .filter((p) => p.notificacoes_preferencias?.[categoria] === false)
              .map((p) => p.email)
          );
          const totalAntes = (subs || []).length;
          subs = (subs || []).filter((s) => !s.user_id || !desativados.has(s.user_id));
          bloqueadosPorPreferencia = totalAntes - subs.length;
        }
      }

      const payload = JSON.stringify({ title, body, url: url || "/" });
      let enviados = 0;
      let expirados = 0;

      for (const row of subs || []) {
        try {
          await webpush.sendNotification(row.subscription, payload);
          enviados += 1;
        } catch (err) {
          // 404/410 = subscrição já não existe do lado do browser/fornecedor
          // de push — deixa de fazer sentido guardá-la, limpa-se sozinha.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", row.id);
            expirados += 1;
          } else {
            console.warn("[api/admin?acao=enviar-push] Falha ao enviar para uma subscrição:", err?.message || err);
          }
        }
      }

      return res.status(200).json({ ok: true, total_subscricoes: (subs || []).length, enviados, expirados_removidas: expirados, bloqueados_por_preferencia: bloqueadosPorPreferencia });
    } catch (err) {
      console.error("Erro em /api/admin?acao=enviar-push:", err);
      return res.status(500).json({ error: err?.message || "Erro ao enviar notificações push" });
    }
  }

  if (acao === "recuperar-password") {
    try {
      const { email } = req.body || {};
      await pedirRecuperacaoPassword({ email });
      // Resposta sempre igual, exista ou não a conta (evita enumeração de emails).
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("Erro em /api/admin?acao=recuperar-password:", err);
      return res.status(200).json({ ok: true });
    }
  }

  if (acao === "convidar") {
    // Quem convida escolhe o "role" do novo utilizador (podendo ser
    // "ADMIN") — sem esta verificação, qualquer conta autenticada, mesmo a
    // de um condómino comum, conseguia convidar-se a si própria como
    // administrador.
    const chamador = await exigirSessaoComPapel(req, res, ["ADMIN", "GESTOR", "EMPRESA_GESTORA"]);
    if (!chamador) return;

    try {
      const { email, nome, role, id_predio, id_fracao, assunto, mensagem } = req.body || {};
      const { actionLink, reenvio } = await convidarUtilizador({ email, nome, role, id_predio, id_fracao });

      const assuntoFinal = assunto || (reenvio ? "Recuperação de Acesso — CondoManager AI" : "Bem-vindo(a) ao CondoManager AI — Ative o seu Acesso");
      const mensagemFinal = mensagem ||
        `Foi criado o seu acesso à plataforma CondoManager AI.<br><br>Para ${reenvio ? "recuperar o seu acesso" : "ativar a sua conta"} e definir a sua palavra-passe, clique no botão abaixo:<br><br>` +
        `<a href="${actionLink}" style="display:inline-block;background-color:#0f766e;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">${reenvio ? "Recuperar Acesso" : "Ativar a Minha Conta"}</a><br><br>` +
        `Se o botão não funcionar, copie e cole este link no navegador:<br>${actionLink}<br><br>Este link é pessoal e intransmissível.`;

      const html = gerarHtmlResposta(nome || "Utilizador(a)", mensagemFinal);
      const enviado = await enviarEmailSemAnexo({ to: email, subject: assuntoFinal, html });

      return res.status(200).json({ ok: true, email_enviado: enviado, reenvio });
    } catch (err) {
      console.error("Erro em /api/admin?acao=convidar:", err);
      return res.status(500).json({ error: err?.message || String(err) });
    }
  }

  try {
    const { job } = req.body || {};
    const fn = JOBS[job];
    if (!fn) {
      return res.status(400).json({ error: `Job inválido. Use: ${Object.keys(JOBS).join(", ")}` });
    }

    const resultado = await fn();
    return res.status(200).json({ ok: true, ...resultado });
  } catch (err) {
    console.error("Erro em /api/admin (forçar job):", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
