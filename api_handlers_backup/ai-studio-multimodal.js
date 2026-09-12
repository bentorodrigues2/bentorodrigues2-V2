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

    const parts = [
      { text: prompt },
      ...anexos.map((ax) => ({
        inlineData: {
          mimeType: ax.mimeType,
          data: ax.base64,
        },
      })),
    ];

    const respostaAI = await fetch(
      `${process.env.AI_STUDIO_ENDPOINT}?key=${process.env.AI_STUDIO_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts,
            },
          ],
        }),
      }
    );

    if (!respostaAI.ok) {
      const txt = await respostaAI.text();
      console.error("Erro ao chamar Gemini multimodal:", txt);
      return res.status(500).json({ error: "Erro no Gemini multimodal" });
    }

    const resultado = await respostaAI.json();

    const content =
      resultado?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text ||
      "{}";

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("Falha a fazer JSON.parse ao conteúdo do Gemini:", content);
      return res.status(500).json({ error: "Resposta do Gemini não é JSON válido" });
    }

    const { data: movimento, error: movErr } = await supabase
      .from("movimentos")
      .insert({
        email,
        subject,
        entidade: parsed.entidade,
        valor: parsed.valor,
        data_documento: parsed.data,
        referencia: parsed.referencia,
        tipo_documento: parsed.tipo_documento,
        categoria: parsed.categoria,
        lancamento_debito: parsed.lancamento?.debito || null,
        lancamento_credito: parsed.lancamento?.credito || null,
        lancamento_descricao: parsed.lancamento?.descricao || null,
        raw_json: parsed,
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
      analise: parsed,
    });
  } catch (err) {
    console.error("Erro no multimodal:", err);
    return res.status(500).json({
      error: "Erro no multimodal",
      detail: err?.message || String(err),
    });
  }
}
