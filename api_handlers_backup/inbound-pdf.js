import { supabase } from "../services/lib/supabaseClient.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const { pdfUrl, base64Pdf, origem } = req.body || {};

    if (!pdfUrl && !base64Pdf) {
      return res.status(400).json({ error: "PDF não fornecido." });
    }

    // 1) Enviar PDF ao Gemini 3.1 Flash Lite
    const respostaAI = await fetch(
      `${process.env.AI_STUDIO_ENDPOINT}?key=${process.env.AI_STUDIO_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: "Extrai dados do comprovativo em JSON estrito." },
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: base64Pdf,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!respostaAI.ok) {
      const txt = await respostaAI.text();
      console.error("Erro no Gemini PDF:", txt);
      return res.status(500).json({ error: "Erro ao processar PDF no Gemini" });
    }

    const resultado = await respostaAI.json();

    const content =
      resultado?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text ||
      "{}";

    let parsed;
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch (e) {
      console.error("JSON inválido do Gemini:", content);
      return res.status(500).json({ error: "JSON inválido do Gemini" });
    }

    // 2) Validar dados essenciais
    const fracao = parsed?.referencia || null;
    const valor = parsed?.valor_total || null;

    if (!fracao || !valor) {
      return res.status(400).json({
        error: "Dados insuficientes no PDF (fração/valor).",
      });
    }

    // 3) Obter fração real
    const { data: fracaoRow, error: errF } = await supabase
      .from("fracoes")
      .select("id_fracao, id_predio")
      .eq("fracao_nome", fracao)
      .single();

    if (errF || !fracaoRow) {
      return res.status(400).json({ error: "Fração não encontrada." });
    }

    // 4) Obter proprietário
    const { data: proprietarioRow, error: errP } = await supabase
      .from("proprietarios")
      .select("id_proprietario, referencia")
      .eq("referencia", fracaoRow.id_fracao)
      .single();

    if (errP || !proprietarioRow) {
      return res.status(400).json({ error: "Proprietário não encontrado." });
    }

    // 5) Criar movimento financeiro (dashboard)
    const { data: movimento, error: movErr } = await supabase
      .from("movimentos")
      .insert({
        id_predio: fracaoRow.id_predio,
        id_conta: null, // será preenchido pelo router financeiro
        entidade: parsed.entidade,
        valor: parsed.valor_total,
        data_documento: parsed.data_documento,
        referencia: parsed.referencia,
        tipo_documento: parsed.tipo_documento,
        categoria: parsed.categoria_contabilistica,
        debito_conta: parsed.sugestao_lancamento?.debito?.conta || null,
        debito_valor: parsed.sugestao_lancamento?.debito?.valor || null,
        credito_conta: parsed.sugestao_lancamento?.credito?.conta || null,
        credito_valor: parsed.sugestao_lancamento?.credito?.valor || null,
        raw_json: parsed,
      })
      .select()
      .single();

    if (movErr) {
      console.error("Erro ao gravar movimento:", movErr);
      return res.status(500).json({ error: "Erro ao gravar movimento" });
    }

    // 6) Criar pagamento pendente
    const { data: pagamento, error: errPay } = await supabase
      .from("pagamentos")
      .insert({
        estado: "pendente",
        id_fracao: fracaoRow.id_fracao,
        id_proprietario: proprietarioRow.id_proprietario,
        referencia: proprietarioRow.referencia,
        valor,
        descricao: "quota_mensal",
        comprovativo_url: pdfUrl,
        criado_em: new Date().toISOString(),
      })
      .select()
      .single();

    if (errPay) {
      return res.status(500).json({ error: "Erro ao criar pagamento." });
    }

    return res.status(200).json({
      ok: true,
      pagamento_id: pagamento.id,
      movimento_id: movimento.id,
      analise: parsed,
    });

  } catch (err) {
    console.error("Erro no inbound-pdf:", err);
    return res.status(500).json({
      error: "Erro interno",
      detail: err?.message || String(err),
    });
  }
}
