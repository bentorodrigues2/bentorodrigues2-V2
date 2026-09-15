import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, html } = req.body;

    const fromEmail = process.env.EMAIL_FROM_ADDRESS || 'no-reply@condomanagerai.com';
    const fromAddress = fromEmail.includes('<') ? fromEmail : `Condomínio <${fromEmail}>`;

    const data = await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error });
  }
}
