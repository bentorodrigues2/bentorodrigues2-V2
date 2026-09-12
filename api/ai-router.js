export default async function handler(req, res) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  // Health check
  if (req.method === "GET") {
    return res.status(200).json({
      status: "online",
      router: "AI Studio Condomínio Router (Groq Hybrid + Actions)",
      groqKeyConfigurada: Boolean(GROQ_API_KEY)
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  if (!GROQ_API_KEY) {
    return res.status(500).json({
      error: "Groq não configurado (API_KEY em falta)"
    });
  }

  const body = req.body || {};
  const email = body.email || {};
  const contexto = body.contexto || {};

  const from = email.from || "";
  const sub = email.subject || "";
  const bodyText = email.bodyText || "";
  const fullText = `${sub} ${bodyText}`.toLowerCase();

  // Filtragem de fornecedores / remetentes automáticos
  const fromLower = from.toLowerCase();
  const isSupplier = [
    "noreply", "no-reply", "mailer-daemon", "postmaster",
    "edp.pt", "galp.com", "galp.pt", "vodafone.pt", "meo.pt", "nos.pt"
  ].some(domain => fromLower.includes(domain));

  if (isSupplier) {
    return res.status(200).json({
      subject: null,
      message: null,
      categoria: "ignorar",
      filtrado: true
    });
  }

  // Classificação heurística
  function classificarHeuristico(texto) {
    if (texto.includes("comprovativo") || texto.includes("transferencia")) return "COMPROVATIVO_QUOTA";
    if (texto.includes("quota") || texto.includes("pagamento")) return "QUOTAS";
    if (texto.includes("barulho") || texto.includes("ruido")) return "RUIDO";
    if (texto.includes("elevador") || texto.includes("avaria")) return "AVARIA";
    if (texto.includes("assembleia") || texto.includes("ata")) return "ASSEMBLEIA";
    if (texto.includes("seguro") || texto.includes("sinistro")) return "SEGURO";
    return "INFORMACAO";
  }

  let categoriaFinal = body.categoria || classificarHeuristico(fullText);

  // GROQ — motor principal
  async function gerarComGroq(prompt) {
    try {
      const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2
        })
      });

      if (!aiRes.ok) return null;

      const aiJson = await aiRes.json();
      const raw = aiJson?.choices?.[0]?.message?.content;

      if (!raw) return null;

      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // Prompt Groq com suporte para ações e ficheiros
  const promptGroq = `
És a Administração do Condomínio em Portugal.
Gera uma resposta formal, cordial e institucional em Português de Portugal.

Categoria: ${categoriaFinal}
Assunto: ${sub}
Texto: ${bodyText}

Contexto: ${JSON.stringify(contexto)}

IMPORTANTE:
Devolve SEMPRE estritamente um JSON no formato:

{
  "subject": "Assunto do email",
  "message": "Texto institucional",
  "categoria": "${categoriaFinal}",

  // AÇÃO OPCIONAL
  "acao": "gerar_recibo_pdf" | "anexar_documentos" | "gerar_boas_vindas" | "gerar_carta_cobranca" | "gerar_aniversario" | "nenhuma",

  // FICHEIRO OPCIONAL
  "ficheiro": {
    "filename": "nome.pdf",
    "url": "https://..."
  },

  // LISTA DE DOCUMENTOS OPCIONAL
  "documentos": [
    { "filename": "doc1.pdf", "url": "https://..." },
    { "filename": "doc2.pdf", "url": "https://..." }
  ]
}
`.trim();

  const respostaGroq = await gerarComGroq(promptGroq);

  console.log("AI Router - Resposta Groq:", respostaGroq);

  if (respostaGroq && respostaGroq.subject && respostaGroq.message) {
    return res.status(200).json({
      subject: respostaGroq.subject,
      message: respostaGroq.message,
      categoria: respostaGroq.categoria || categoriaFinal,
      acao: respostaGroq.acao || "nenhuma",
      ficheiro: respostaGroq.ficheiro || null,
      documentos: respostaGroq.documentos || [],
      source: "groq_ai"
    });
  }

  // Fallback institucional
  return res.status(200).json({
    subject: `Re: ${sub}`,
    message: "A administração acusa a receção da sua comunicação.",
    categoria: categoriaFinal,
    acao: "nenhuma",
    ficheiro: null,
    documentos: [],
    source: "fallback"
  });
}
