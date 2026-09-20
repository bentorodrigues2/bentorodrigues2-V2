import crypto from "crypto";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from "@simplewebauthn/server";
import { emitirQuotasMensais, enviarLembretesQuotas, avisarQuotasEmMora, enviarFelicitacoesAniversario } from "../server/lib/cronService.js";
import { supabase } from "../server/lib/supabaseServer.js";
import { enviarEmailSemAnexo } from "../server/lib/mailer.js";
import { gerarHtmlResposta } from "../server/lib/htmlemail.js";
import { enviarEmailResend } from "../server/lib/inboundProcessor.js";
import { exigirSessaoValida, exigirSessaoComPapel } from "../server/lib/verificarSessao.js";
import webpush from "web-push";

// --- Biometria real (WebAuthn) — fundido aqui (era api/webauthn.js) para
// não ultrapassar o limite de 12 Serverless Functions do plano Hobby da
// Vercel (cada ficheiro em /api conta como uma função). ---
const RP_NAME = "CondoManager AI";
const ORIGENS_PERMITIDAS_WEBAUTHN = [
  "https://bentorodrigues2.condomanagerai.com",
  "https://bentorodrigues2.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000"
];

function obterRpIdEOriginWebAuthn(req) {
  const origin = req.headers.origin || "";
  if (ORIGENS_PERMITIDAS_WEBAUTHN.includes(origin)) {
    return { rpID: new URL(origin).hostname, origin };
  }
  const site = process.env.SITE_URL || "https://bentorodrigues2.condomanagerai.com";
  return { rpID: new URL(site).hostname, origin: site };
}

// O desafio (challenge) do WebAuthn vai assinado (HMAC) e com validade de 5
// minutos, sem guardar estado nenhum no servidor entre pedidos (ambiente
// serverless) — reaproveita a service role key como segredo (só existe no servidor).
const CHALLENGE_SECRET_WEBAUTHN = process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback-dev-secret";

function assinarChallengeWebAuthn(challenge, extra) {
  const payload = JSON.stringify({ challenge, extra, exp: Date.now() + 5 * 60 * 1000 });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const hmac = crypto.createHmac("sha256", CHALLENGE_SECRET_WEBAUTHN).update(payloadB64).digest("hex");
  return `${payloadB64}.${hmac}`;
}

function verificarChallengeTokenWebAuthn(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payloadB64, hmac] = token.split(".");
  const hmacEsperado = crypto.createHmac("sha256", CHALLENGE_SECRET_WEBAUTHN).update(payloadB64).digest("hex");
  if (hmac !== hmacEsperado) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

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
      if (!recData.properties?.action_link) throw new Error("generateLink (recovery) não devolveu action_link.");
      await atualizarPerfil({ id: recData.user?.id, email: emailLimpo, nome, role, id_predio, id_fracao });
      return { actionLink: recData.properties.action_link, reenvio: true };
    }
    throw new Error(error.message);
  }

  if (!data.properties?.action_link) throw new Error("generateLink (invite) não devolveu action_link.");
  await atualizarPerfil({ id: data.user?.id, email: emailLimpo, nome, role, id_predio, id_fracao });
  return { actionLink: data.properties.action_link, reenvio: false };
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

  const actionLink = data.properties?.action_link;
  if (!actionLink) {
    console.error("[recuperar-password] generateLink não devolveu action_link — email NÃO enviado para evitar um link partido.");
    return { enviado: false };
  }
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

  // "recuperar-password" e o login por biometria (webauthn-login-opcoes/
  // -verificar) têm de continuar acessíveis sem sessão — são chamados a
  // partir do próprio ecrã de login, antes de existir qualquer sessão.
  // Todas as outras ações exigem sessão válida.
  const acoesSemSessao = ["recuperar-password", "webauthn-login-opcoes", "webauthn-login-verificar"];
  if (!acoesSemSessao.includes(acao)) {
    const utilizador = await exigirSessaoValida(req, res);
    if (!utilizador) return;
  }

  if (acao === "aprovar-resposta-ia") {
    // Só quem gere a plataforma pode decidir enviar (ou não) um email
    // redigido pela IA em nome do condomínio — sem isto, qualquer conta
    // autenticada, mesmo um condómino comum, conseguia aprovar o envio de
    // qualquer resposta pendente de qualquer prédio.
    const chamador = await exigirSessaoComPapel(req, res, ["ADMIN", "GESTOR", "EMPRESA_GESTORA"]);
    if (!chamador) return;
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
    const chamador = await exigirSessaoComPapel(req, res, ["ADMIN", "GESTOR", "EMPRESA_GESTORA"]);
    if (!chamador) return;
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
    // Disparar uma notificação push para todo um prédio (ou fração) é uma
    // ação de comunicação em massa — só gestão pode acionar, não qualquer
    // conta autenticada.
    const chamador = await exigirSessaoComPapel(req, res, ["ADMIN", "GESTOR", "EMPRESA_GESTORA"]);
    if (!chamador) return;
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

  // Envia só às subscrições marcadas como Administração (push_subscriptions.
  // is_admin = true) — separado de "enviar-push" porque esse filtra por
  // id_predio/id_fracao sem distinguir administrador de condómino, o que
  // notificaria por engano todos os condóminos sobre algo dirigido só ao
  // admin (ex: mensagem nova de outro condómino). Aberto a qualquer sessão
  // válida — é o próprio condómino que aciona isto ao enviar a sua mensagem.
  if (acao === "enviar-push-admin") {
    const chamador = await exigirSessaoValida(req, res);
    if (!chamador) return;
    try {
      if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        return res.status(500).json({ error: "Chaves VAPID não configuradas no servidor." });
      }
      const { id_predio, title, body, url } = req.body || {};
      if (!id_predio || !title || !body) {
        return res.status(400).json({ error: "id_predio, title e body são obrigatórios" });
      }

      const { data: subs, error: errSubs } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, subscription")
        .eq("id_predio", id_predio)
        .eq("is_admin", true);
      if (errSubs) throw new Error(errSubs.message);

      const payload = JSON.stringify({ title, body, url: url || "/" });
      let enviados = 0;
      let expirados = 0;

      for (const row of subs || []) {
        try {
          await webpush.sendNotification(row.subscription, payload);
          enviados += 1;
        } catch (err) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", row.id);
            expirados += 1;
          } else {
            console.warn("[api/admin?acao=enviar-push-admin] Falha ao enviar para uma subscrição:", err?.message || err);
          }
        }
      }

      return res.status(200).json({ ok: true, total_subscricoes: (subs || []).length, enviados, expirados_removidas: expirados });
    } catch (err) {
      console.error("Erro em /api/admin?acao=enviar-push-admin:", err);
      return res.status(500).json({ error: err?.message || "Erro ao enviar notificações push ao administrador" });
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

  if (acao === "webauthn-registo-opcoes") {
    const utilizador = await exigirSessaoValida(req, res);
    if (!utilizador) return;
    try {
      const { rpID } = obterRpIdEOriginWebAuthn(req);
      const email = (utilizador.email || "").trim().toLowerCase();

      const { data: existentes } = await supabase
        .from("webauthn_credentials")
        .select("credential_id, transports")
        .eq("user_email", email);

      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID,
        userName: email,
        userDisplayName: email,
        attestationType: "none",
        excludeCredentials: (existentes || []).map((c) => ({
          id: c.credential_id,
          transports: c.transports || undefined
        })),
        // "discouraged" (em vez de "preferred") evita que o Android/Chrome
        // ofereça criar uma passkey sincronizada no Google Password Manager
        // ou usar uma chave de segurança externa — com "platform" +
        // "discouraged" + userVerification "required" o pedido do sistema
        // vai direto ao Face ID/Touch ID/impressão digital DESTE aparelho.
        authenticatorSelection: {
          residentKey: "discouraged",
          requireResidentKey: false,
          userVerification: "required",
          authenticatorAttachment: "platform"
        }
      });

      const challengeToken = assinarChallengeWebAuthn(options.challenge, { email });
      return res.status(200).json({ ok: true, options, challengeToken });
    } catch (err) {
      console.error("Erro em /api/admin?acao=webauthn-registo-opcoes:", err);
      return res.status(500).json({ ok: false, error: err?.message || "Erro interno." });
    }
  }

  if (acao === "webauthn-registo-verificar") {
    const utilizador = await exigirSessaoValida(req, res);
    if (!utilizador) return;
    try {
      const { origin, rpID } = obterRpIdEOriginWebAuthn(req);
      const email = (utilizador.email || "").trim().toLowerCase();
      const { response, challengeToken, deviceLabel } = req.body || {};

      const dadosChallenge = verificarChallengeTokenWebAuthn(challengeToken);
      if (!dadosChallenge || dadosChallenge.extra?.email !== email) {
        return res.status(400).json({ ok: false, error: "Pedido de registo expirado ou inválido. Tente novamente." });
      }

      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response,
          expectedChallenge: dadosChallenge.challenge,
          expectedOrigin: origin,
          expectedRPID: rpID
        });
      } catch (errVerify) {
        return res.status(400).json({ ok: false, error: "Não foi possível verificar a biometria: " + errVerify.message });
      }

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ ok: false, error: "Não foi possível verificar a biometria." });
      }

      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      const { error } = await supabase.from("webauthn_credentials").insert({
        user_email: email,
        credential_id: credential.id,
        public_key: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: response?.response?.transports || null,
        device_type: credentialDeviceType,
        backed_up: credentialBackedUp,
        device_label: (deviceLabel || "").slice(0, 120) || null
      });

      if (error) {
        console.error("[webauthn] Erro ao guardar credencial:", error);
        return res.status(500).json({ ok: false, error: "Não foi possível guardar a credencial biométrica no Supabase." });
      }

      return res.status(200).json({ ok: true, credentialId: credential.id });
    } catch (err) {
      console.error("Erro em /api/admin?acao=webauthn-registo-verificar:", err);
      return res.status(500).json({ ok: false, error: err?.message || "Erro interno." });
    }
  }

  if (acao === "webauthn-login-opcoes") {
    try {
      const email = ((req.body || {}).email || "").trim().toLowerCase();
      if (!email) return res.status(400).json({ ok: false, error: "Email é obrigatório." });
      const { rpID } = obterRpIdEOriginWebAuthn(req);

      const { data: credenciais } = await supabase
        .from("webauthn_credentials")
        .select("credential_id, transports")
        .eq("user_email", email);

      if (!credenciais || credenciais.length === 0) {
        return res.status(404).json({ ok: false, error: "Não há biometria registada para este email neste dispositivo/servidor." });
      }

      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: "required",
        allowCredentials: credenciais.map((c) => ({ id: c.credential_id, transports: c.transports || undefined }))
      });

      const challengeToken = assinarChallengeWebAuthn(options.challenge, { email });
      return res.status(200).json({ ok: true, options, challengeToken });
    } catch (err) {
      console.error("Erro em /api/admin?acao=webauthn-login-opcoes:", err);
      return res.status(500).json({ ok: false, error: err?.message || "Erro interno." });
    }
  }

  if (acao === "webauthn-login-verificar") {
    try {
      const { response, challengeToken, email: emailBody } = req.body || {};
      const email = (emailBody || "").trim().toLowerCase();
      const { origin, rpID } = obterRpIdEOriginWebAuthn(req);

      const dadosChallenge = verificarChallengeTokenWebAuthn(challengeToken);
      if (!dadosChallenge || dadosChallenge.extra?.email !== email) {
        return res.status(400).json({ ok: false, error: "Pedido de autenticação expirado ou inválido. Tente novamente." });
      }

      const { data: credencial } = await supabase
        .from("webauthn_credentials")
        .select("*")
        .eq("user_email", email)
        .eq("credential_id", response?.id)
        .maybeSingle();

      if (!credencial) {
        return res.status(400).json({ ok: false, error: "Credencial biométrica não reconhecida." });
      }

      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response,
          expectedChallenge: dadosChallenge.challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          credential: {
            id: credencial.credential_id,
            publicKey: Buffer.from(credencial.public_key, "base64url"),
            counter: credencial.counter,
            transports: credencial.transports || undefined
          }
        });
      } catch (errVerify) {
        return res.status(400).json({ ok: false, error: "Não foi possível verificar a biometria: " + errVerify.message });
      }

      if (!verification.verified) {
        return res.status(400).json({ ok: false, error: "Não foi possível verificar a biometria." });
      }

      await supabase
        .from("webauthn_credentials")
        .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
        .eq("id", credencial.id);

      // A identidade já foi confirmada pela assinatura biométrica verificada
      // acima — gera uma sessão real do Supabase Auth sem pedir a password
      // (mesmo padrão de generateLink já usado em "convidar"/"recuperar-password").
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email
      });

      if (linkError || !linkData?.properties?.hashed_token) {
        console.error("[webauthn] Erro ao gerar sessão pós-biometria:", linkError);
        return res.status(500).json({ ok: false, error: "Biometria confirmada, mas não foi possível iniciar sessão. Tente com a password." });
      }

      return res.status(200).json({ ok: true, hashedToken: linkData.properties.hashed_token, email });
    } catch (err) {
      console.error("Erro em /api/admin?acao=webauthn-login-verificar:", err);
      return res.status(500).json({ ok: false, error: err?.message || "Erro interno." });
    }
  }

  if (acao === "webauthn-listar-credenciais") {
    const utilizador = await exigirSessaoValida(req, res);
    if (!utilizador) return;
    try {
      const email = (utilizador.email || "").trim().toLowerCase();
      const { data, error } = await supabase
        .from("webauthn_credentials")
        .select("id, credential_id, device_label, device_type, created_at, last_used_at")
        .eq("user_email", email)
        .order("created_at", { ascending: false });

      if (error) return res.status(500).json({ ok: false, error: "Não foi possível listar as credenciais." });
      return res.status(200).json({ ok: true, credenciais: data || [] });
    } catch (err) {
      console.error("Erro em /api/admin?acao=webauthn-listar-credenciais:", err);
      return res.status(500).json({ ok: false, error: err?.message || "Erro interno." });
    }
  }

  if (acao === "webauthn-remover-credencial") {
    const utilizador = await exigirSessaoValida(req, res);
    if (!utilizador) return;
    try {
      const email = (utilizador.email || "").trim().toLowerCase();
      const { credentialId } = req.body || {};
      if (!credentialId) return res.status(400).json({ ok: false, error: "credentialId é obrigatório." });

      const { error } = await supabase
        .from("webauthn_credentials")
        .delete()
        .eq("user_email", email)
        .eq("credential_id", credentialId);

      if (error) return res.status(500).json({ ok: false, error: "Não foi possível remover a credencial." });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("Erro em /api/admin?acao=webauthn-remover-credencial:", err);
      return res.status(500).json({ ok: false, error: err?.message || "Erro interno." });
    }
  }

  // Disparo manual de um job interno (emissão de quotas, avisos de mora,
  // felicitações...) afeta a plataforma inteira — nunca deve ficar aberto
  // a qualquer conta autenticada, só a quem gere.
  const chamadorJob = await exigirSessaoComPapel(req, res, ["ADMIN", "GESTOR", "EMPRESA_GESTORA"]);
  if (!chamadorJob) return;

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
