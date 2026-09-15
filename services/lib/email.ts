import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

export async function enviarEmailPDF({ to, assunto, mensagem, pdfBuffer, nome }) {
  const fromEmail = process.env.EMAIL_FROM_ADDRESS || "noreply@condomanagerai.com";
  const fromAddress = fromEmail.includes("<") ? fromEmail : `Condomínio <${fromEmail}>`;

  await resend.emails.send({
    from: fromAddress,
    to,
    subject: assunto,
    html: mensagem,
    attachments: [
      {
        filename: nome,
        content: pdfBuffer.toString("base64")
      }
    ]
  });
}
