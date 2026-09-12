export const config = { runtime: "edge" };
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

    // 1) Enviar PDF para o AI Studio
    const aiRes = await fetch(process.env.AI_STUDIO_PDF_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_STUDIO_API_KEY}`,
      },
      body: JSON.stringify({
        pdfUrl,
        base64Pdf,
        origem: origem || "upload_pdf"
      }),
    });

    const aiData = await aiRes.json();

    const fracao = aiData?.id_fracao || aiData?.fracao;
    const valor = aiData?.valor || aiData?.valorTotal;

    // 2) Obter fração
    const { data: fracaoRow } = await supabase
      .from("fracoes")
      .select("id_fracao")
      .eq("id_fracao", fracao)
      .single();

    // 3) Obter proprietário
    const { data: proprietarioRow } = await supabase
      .from("proprietarios")
      .select("id_proprietario, referencia")
      .eq("referencia", fracaoRow.id_fracao)
      .single();

    // 4) Criar pagamento pendente
    const { data: pagamento } = await supabase
      .from("pagamentos")
      .insert({
        estado: "pendente",
        id_fracao: fracaoRow.id_fracao,
        id_proprietario: proprietarioRow.id_proprietario,
        referencia: proprietarioRow.referencia,
        valor,
        descricao: "quota_mensal",
        comprovativo_url: pdfUrl,
        criado_em: new Date().toISOString()
      })
      .select()
      .single();

    return res.status(200).json({
      ok: true,
      pagamento_id: pagamento.id
    });

  } catch (err) {
    return res.status(500).json({
      error: "Erro interno",
      detail: err.message
    });
  }
}

