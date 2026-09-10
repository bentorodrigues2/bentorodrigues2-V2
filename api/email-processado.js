import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE
  );

  const { email, documentos, aiResult, resendStatus } = req.body;

  try {
    // 1) Guardar email
    const { data: emailRow, error: emailErr } = await supabase
      .from("emails_recebidos")
      .insert({
        message_id: email.messageId,
        from_email: email.from,
        to_email: email.to,
        subject: email.subject,
        date: email.date,
        body_text: email.bodyText,
        body_html: email.bodyHtml,
        estado_autoresponder: resendStatus,
        resposta_enviada: resendStatus === "SUCCESS",
        predio_id: process.env.PREDIO_ID || "predio-1"
      })
      .select()
      .single();

    if (emailErr) throw emailErr;

    // 2) Guardar anexos
    for (const doc of documentos || []) {
      await supabase.from("emails_anexos").insert({
        email_id: emailRow.id,
        nome: doc.nome,
        mime_type: doc.mimeType,
        base64: doc.base64
      });
    }

    // 3) Guardar resultado da IA
    if (aiResult) {
      await supabase.from("ia_resultados").insert({
        email_id: emailRow.id,
        tipo_documento: aiResult.tipoDocumento || null,
        valor: aiResult.valor || null,
        entidade: aiResult.entidade || null,
        instrucoes: aiResult.instrucoesAutoresponder || aiResult
      });
    }

    // 4) Guardar log
    await supabase.from("emails_logs").insert({
      email_id: emailRow.id,
      log: JSON.stringify(req.body)
    });

    return res.status(200).json({ sucesso: true, emailId: emailRow.id });
  } catch (e) {
    console.error("Erro no endpoint:", e);
    return res.status(500).json({ erro: e.message });
  }
}

