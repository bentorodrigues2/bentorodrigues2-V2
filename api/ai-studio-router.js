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

Considera como fornecedores ou emails automáticos:
- emails que contenham: noreply, no-reply, do-not-reply, donotreply, automated, mailer-daemon, postmaster
- newsletters, campanhas, marketing, promoções
- domínios de fornecedores conhecidos (EDP, GALP, Vodafone, MEO, NOS, seguradoras, empresas de manutenção)

Analisa o email recebido e identifica:
- tema (quotas, ruído, avarias, assembleias, documentos, pedidos gerais)
- urgência
- tom do remetente
- intenção (informar, reclamar, pedir ajuda, solicitar documentos)

Estilo da resposta:
- profissional, cordial, clara, objetiva
- sem HTML, sem imagens, sem markdown, sem emojis

Estrutura do campo "message":
1. Agradecimento pela mensagem
2. Confirmação de receção
3. Resposta contextual ao tema identificado
4. Informação adicional relevante (se aplicável)
5. Encerramento cordial

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
        model: "llama-3.1-70b-specdec",
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
