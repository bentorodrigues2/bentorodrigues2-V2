
import { supabase } from "../src/lib/supabaseclient.js";

const FORNECEDOR_PATTERNS = [
  "noreply",
  "no-reply",
  "mailer-daemon",
  "postmaster",
  "@edp.pt",
  "@galp.com",
  "@vodafone.pt",
  "@meo.pt",
  "@nos.pt"
];

function isFornecedor(email) {
  const e = email.toLowerCase();
  return FORNECEDOR_PATTERNS.some((p) => e.includes(p));
}

async function callAiStudio(payload) {
  const response = await fetch(process.env.AI_STUDIO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_STUDIO_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  return await response.json();
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const { from, subject, bodyText } = req.body;

    if (!from || !subject || !bodyText) {
      return res.status(400).json({ error: "Payload inválido" });
    }

    // 1. Filtro anti-fornecedores
    if (isFornecedor(from)) {
      return res.status(200).json({ subject: null, message: null });
    }

    // 2. Buscar proprietário
    const { data: proprietarios } = await supabase
      .from("proprietarios")
      .select("*")
      .eq("email", from)
      .limit(1);

    const proprietario = proprietarios?.[0] || null;

    // 3. Buscar fração e prédio
    let fracao = null;
    let predio = null;

    if (proprietario) {
      const { data: fracoes } = await supabase
        .from("fracoes")
        .select("*")
        .eq("id_fracao", proprietario.id_fracao)
        .limit(1);

      fracao = fracoes?.[0] || null;

      const { data: predios } = await supabase
        .from("predios")
        .select("*")
        .eq("id_predio", proprietario.id_predio)
        .limit(1);

      predio = predios?.[0] || null;
    }

    // 4. Construir contexto
    const contexto = { proprietario, fracao, predio };

    // 5. Chamar AI Studio
    const ai = await callAiStudio({
      email: { from, subject, bodyText },
      contexto
    });

    // 6. Devolver JSON simples para o inbound
    return res.status(200).json({
      subject: ai.subject,
      message: ai.message
    });

  } catch (err) {
    console.error("Erro no autoresponder-email:", err);
    return res.status(500).json({
      error: "Erro no autoresponder-email",
      detail: err?.message || String(err)
    });
  }
}


