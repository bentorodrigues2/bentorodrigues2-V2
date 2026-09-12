import { supabase } from "../services/lib/supabaseClient.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const { email, subject, anexos } = req.body || {};

    if (!email || !anexos || !Array.isArray(anexos) || anexos.length === 0) {
      console.error("Payload multimodal inválido:", req.body);
      return res.status(400).json({ error: "Payload multimodal inválido" });
    }

    const prompt = `
      Analisa os documentos anexos (comprovativos, faturas, recibos, extratos).
      Extrai:
      - entidade (quem emitiu)
      - valor total
      - data do documento
      - referência (nº fatura, nº recibo, etc.)
      - tipo de documento (fatura, recibo, transferência, extrato, etc.)
      - categoria contabilística
      - sugestão de lançamento contabilístico (contas débito/crédito)
      Responde em JSON estrito.
    `;

    const respostaAI = await fetch(process.env.AI_STUDIO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.AI_STUDIO_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Analisa estes anexos." }
        ]
      })
    });

    if (!respostaAI.ok) {
      const txt = await respostaAI.text();
      console.error("Erro ao chamar AI Studio multimodal:", txt);
      return res.status(500).json({ error: "Erro no AI Studio multimodal" });
    }

    const resultado = await respostaAI.json();

    const { data: movimento, error: movErr } = await supabase
      .from("movimentos")
      .insert({
        email,
        subject,
        entidade: resultado.entidade,
        valor: resultado.valor,
        data_documento: resultado.data,
        referencia: resultado.referencia,
        tipo_documento: resultado.tipo_documento,
        categoria: resultado.categoria,
        lancamento_debito: resultado.lancamento?.debito || null,
        lancamento_credito: resultado.lancamento?.credito || null,
        lancamento_descricao: resultado.lancamento?.descricao || null,
        raw_json: resultado,
      })
      .select()
      .single();

    if (movErr) {
      console.error("Erro ao gravar movimento:", movErr);
      return res.status(500).json({ error: "Erro ao gravar movimento" });
    }

    const anexosReg = anexos.map((ax) => ({
      email,
      movimento_id: movimento.id,
      filename: ax.filename,
      mime_type: ax.mimeType,
    }));

    const { error: anexErr } = await supabase
      .from("anexos_processados")
      .insert(anexosReg);

    if (anexErr) {
      console.error("Erro ao gravar anexos_processados:", anexErr);
    }

    return res.status(200).json({
      ok: true,
      movimento,
      analise: resultado,
    });

  } catch (err) {
    console.error("Erro no ai-studio-multimodal:", err);
    return res.status(500).json({
      error: "Erro no ai-studio-multimodal",
      detail: err?.message || String(err),
    });
  }
}
