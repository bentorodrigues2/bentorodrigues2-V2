
import { supabase } from "../services/lib/supabaseClient.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const {
      estado,
      fracao,
      valor,
      dataDocumento,
      entidade,
      comprovativoUrl,
      tipo,
      contexto
    } = req.body || {};

    if (!fracao || !valor || !dataDocumento || !comprovativoUrl) {
      return res.status(400).json({ error: "Dados incompletos para lançamento de pagamento." });
    }

    // 1) Referência individual (opcional)
    const referencia =
      contexto?.referencia ||
      contexto?.proprietario?.referencia ||
      contexto?.proprietario?.perfil_bancario?.referencia ||
      null;

    // 2) Perfil bancário (opcional)
    const perfilBancario = contexto?.proprietario?.perfil_bancario || null;

    // 3) Inserir na tabela pagamentos
    const { data, error } = await supabase
      .from("pagamentos")
      .insert({
        estado: estado || "pendente",
        fracao,
        referencia,
        valor,
        data_pagamento: dataDocumento,
        entidade,
        comprovativo_url: comprovativoUrl,
        tipo: tipo || "quota_mensal",
        perfil_bancario: perfilBancario,
        criado_em: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao lançar pagamento:", error);
      return res.status(500).json({ error: "Erro ao lançar pagamento." });
    }

    return res.status(200).json({
      ok: true,
      pagamento: data
    });

  } catch (err) {
    console.error("Erro no /api/lancar-pagamento:", err);
    return res.status(500).json({
      error: "Erro interno",
      detail: err?.message || String(err)
    });
  }
}


