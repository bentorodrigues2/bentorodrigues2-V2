import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------
// SUPABASE CLIENT
// -----------------------------
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// -----------------------------
// TEST ROUTE
// -----------------------------
app.get("/", (req, res) => {
  res.json({
    status: "Backend online 🚀",
    supabase: "connected",
  });
});

// ------------------------------------------------------
// 🔥 IA DO PROJETO → /api/ia
// ------------------------------------------------------
app.post("/api/ia", async (req, res) => {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const prompt = req.body.prompt;

    const result = await model.generateContent(prompt);

    return res.json({ text: result.response.text() });
  } catch (e: any) {
    console.error("Erro IA /api/ia:", e);
    return res.status(500).json({ erro: e.message });
  }
});

// ------------------------------------------------------
// 🔥 TESTE DA IA → /api/ia/test
// ------------------------------------------------------
app.get("/api/ia/test", (req, res) => {
  res.send("IA online 🚀");
});

// -----------------------------
// EXAMPLE ROUTE: GET USERS
// -----------------------------
app.get("/users", async (req, res) => {
  const { data, error } = await supabase.from("users").select("*");

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// -----------------------------
// EXAMPLE ROUTE: CREATE USER
// -----------------------------
app.post("/users", async (req, res) => {
  const { name, email } = req.body;

  const { data, error } = await supabase
    .from("users")
    .insert([{ name, email }]);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// ------------------------------------------------------
// 🔥 ROUTA REAL DO AI STUDIO → /api/reconhecer-recibo
// ------------------------------------------------------
app.post("/api/reconhecer-recibo", async (req, res) => {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const result = await model.generateContent(req.body.contents);

    return res.json({ text: result.response.text() });
  } catch (e: any) {
    console.error("Erro IA:", e);
    return res.status(500).json({ erro: e.message });
  }
});

// ------------------------------------------------------
// 🔥 ROUTA REAL DO WORKER → /api/email-processado
// ------------------------------------------------------
app.post("/api/email-processado", async (req, res) => {
  try {
    const { email, documentos, aiResult, resendStatus } = req.body;

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
        predio_id: process.env.PREDIO_ID || "predio-1",
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
        base64: doc.base64,
      });
    }

    // 3) Guardar resultado da IA
    if (aiResult) {
      await supabase.from("ia_resultados").insert({
        email_id: emailRow.id,
        tipo_documento: aiResult.tipoDocumento || null,
        valor: aiResult.valor || null,
        entidade: aiResult.entidade || null,
        instrucoes: aiResult.instrucoesAutoresponder || aiResult,
      });
    }

    // 4) Guardar log
    await supabase.from("emails_logs").insert({
      email_id: emailRow.id,
      log: JSON.stringify(req.body),
    });

    return res.status(200).json({ sucesso: true, emailId: emailRow.id });
  } catch (e: any) {
    console.error("Erro no endpoint:", e);
    return res.status(500).json({ erro: e.message });
  }
});

// -----------------------------
// START SERVER
// -----------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
