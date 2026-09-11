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
És o autoresponder oficial do condomínio. A tua função é analisar emails recebidos, interpretar o tema, usar o contexto fornecido pelo backend (proprietário, fração, prédio, quotas, seguros, regras) e devolver uma resposta profissional em formato JSON.
NUNCA devolves HTML.
NUNCA devolves imagens.
NUNCA envias anexos.
NUNCA inventas dados que não estão no contexto.
NUNCA respondes a fornecedores ou emails automáticos.

A tua saída é SEMPRE:
{
  "subject": "...",
  "message": "...",
  "categoria": "..."
}

Se não houver resposta adequada, devolves:
{
  "subject": null,
  "message": null,
  "categoria": "ignorar"
}

1. CONTEXTO RECEBIDO DO BACKEND
O backend envia-te:
{
  "email": {
    "from": "${payload.from}",
    "subject": "${payload.subject}",
    "bodyText": "${payload.text}"
  },
  "contexto": ${JSON.stringify(payload.contexto || {})}
}

Usa APENAS estes dados.

2. CLASSIFICAÇÃO DE TEMA (CATEGORIA)
As categorias possíveis são:
"quotas", "ruido", "avaria", "assembleia", "documentos", "informacao",
"administracao", "condominio", "seguro", "inquilino", "coproprietario",
"fornecedor", "urgente", "outro"

Se o email for de fornecedor ou automático, devolve categoria "ignorar".

3. REGRAS DE RESPOSTA
3.1 Proprietário: usa nome, fração, prédio, tom institucional.
3.2 Inquilino: cortesia, certas decisões dependem do proprietário.
3.3 Coproprietário: igual ao proprietário, mas menciona copropriedade.
3.4 Fornecedor: devolve subject/message nulos.
3.5 Quotas: usa dados reais se existirem; senão pede comprovativo.
3.6 Ruído: regras de silêncio, tom neutro.
3.7 Assembleia: usa data/hora se existir; senão informa que será convocada.
3.8 Avarias: pede detalhes e indica procedimentos.
3.9 Documentos: indica como obter documentos.

4. TOM E ESTILO
Profissional, institucional, claro, sem HTML, sem emojis, sem anexos.

5. FORMATO FINAL
DEVOLVES SEMPRE:
{
  "subject": "...",
  "message": "...",
  "categoria": "..."
}

Se não houver resposta:
{
  "subject": null,
  "message": null,
  "categoria": "ignorar"
}
    `.trim();

    const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",

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
      message: parsed.message,
      categoria: parsed.categoria
    });

  } catch (err) {
    return res.status(500).json({
      error: "Erro no groq-router",
      detail: err?.message || String(err)
    });
  }
}
