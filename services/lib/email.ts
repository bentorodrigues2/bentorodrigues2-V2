import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

export async function enviarEmailPDF({ to, assunto, mensagem, pdfBuffer, nome }) {
  await resend.emails.send({
    from: "noreply@teusistema.com",
    to,
    subject: assunto,
    html: mensagem,
    attachments: [
      {
        filename: nome,
        content: pdfBuffer.toString("base64"),
        type: "application/pdf"
      }
    ]
  });
}
