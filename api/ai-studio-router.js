export default async function handler(req, res) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  if (!GROQ_API_KEY) {
    return res.status(500).json({
      error: "Groq não configurado (API_KEY em falta)"
    });
  }

  const payload = req.body;

  if (!payload || !payload.from || !payload.subject || !payload.text) {
    return res.status(400).json({ error: "Payload inválido para o Groq" });
  }

  try {
    const prompt = `
Tu és o motor de resposta automática do condomínio.
Recebes o assunto, o corpo e o remetente de um email e devolves apenas JSON, nunca HTML.

Formato obrigatório:
{
  "subject": "...",
  "message": "..."
}

Se o remetente for fornecedor, sistema automático ou endereço não humano, devolve:
{
  "subject": null,
  "message": null
}

Dados do email recebido:
- Remetente: ${payload.from}
- Assunto: ${payload.subject}
- Corpo:
${payload.text}
    `.trim();

    const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",

        // 🔥 CORREÇÃO OBRIGATÓRIA
        response_format: { type: "json_object" },

        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2
      })
    });

    if (!aiRes.ok) {
      const text = await aiRes.text().catch(() => "");
      return res.status(500).json({
        error: "Falha na chamada ao modelo Groq",
        status: aiRes.status,
        body: text
      });
    }

    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content;

    // 🔥 CORREÇÃO: proteger resposta vazia ou inválida
    if (!raw || typeof raw !== "string") {
      return res.status(500).json({
        error: "Groq devolveu resposta vazia ou inválida",
        raw
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        error: "Resposta do Groq inválida (não é JSON)",
        raw
      });
    }

    return res.status(200).json({
      subject: parsed.subject,
      message: parsed.message
    });

  } catch (err) {
    return res.status(500).json({
      error: "Erro no groq-router",
      detail: err?.message || String(err)
    });
  }
}
