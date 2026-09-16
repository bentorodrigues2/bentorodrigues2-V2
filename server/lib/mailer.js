/**
 * Envio de email institucional (logótipo + assinatura) sem PDF anexo —
 * partilhado entre o cron (lembretes/avisos de mora) e ações pontuais do
 * admin que não têm documento associado (ex.: notificações de apólice).
 */
export async function enviarEmailSemAnexo({ to, subject, html }) {
  const resendApiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
  if (!resendApiKey || !to) return false;

  const fromEmail = process.env.EMAIL_FROM_ADDRESS || "administracao@condomanagerai.com";
  const fromAddress = fromEmail.includes("<") ? fromEmail : `Condomínio <${fromEmail}>`;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
      body: JSON.stringify({ from: fromAddress, to: [to], subject, html })
    });
    if (!resp.ok) {
      console.error("[mailer] Erro Resend:", resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[mailer] Falha ao enviar email:", err);
    return false;
  }
}

export default { enviarEmailSemAnexo };
