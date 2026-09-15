import { emitirQuotasMensais, enviarLembretesQuotas, avisarQuotasEmMora, enviarFelicitacoesAniversario } from "../server/lib/cronService.js";
import { supabase } from "../server/lib/supabaseServer.js";
import { enviarEmailSemAnexo } from "../server/lib/mailer.js";
import { gerarHtmlResposta } from "../server/lib/htmlemail.js";

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

  if (acao === "convidar") {
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
