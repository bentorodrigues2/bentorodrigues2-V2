import { supabase } from "../server/lib/supabaseServer.js";
import { calcularQuotaMensalFracao } from "../server/lib/inboundProcessor.js";

/**
 * Recalcula a deteção "MESES_DETECTADOS" de um pagamento — chamado depois
 * de corrigir manualmente a fração no "Detalhe do Movimento Reconhecido".
 * A deteção original só corre quando o email chega (precisa da fração já
 * identificada para saber a quota mensal); corrigir a fração à posteriori
 * não recalculava nada, por isso um pagamento de vários meses nunca
 * ganhava a opção "Dividir em N recibos mensais" depois de corrigido.
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }
    const { id_pagamento } = req.body || {};
    if (!id_pagamento) {
      return res.status(400).json({ error: "id_pagamento em falta" });
    }

    const { data: pagamento, error: errPag } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("id", id_pagamento)
      .maybeSingle();
    if (errPag || !pagamento) {
      return res.status(404).json({ error: "Pagamento não encontrado", detail: errPag?.message });
    }
    if (!pagamento.id_fracao) {
      return res.status(400).json({ error: "Este pagamento ainda não tem fração identificada." });
    }

    const { data: fracao } = await supabase
      .from("fracoes")
      .select("id_predio")
      .eq("id_fracao", pagamento.id_fracao)
      .maybeSingle();
    if (!fracao?.id_predio) {
      return res.status(404).json({ error: "Fração não encontrada." });
    }

    const quotaMensal = await calcularQuotaMensalFracao(fracao.id_predio, pagamento.id_fracao);
    let mesesDetectados = null;
    if (quotaMensal && quotaMensal > 0) {
      const razao = Number(pagamento.valor || 0) / quotaMensal;
      const razaoArredondada = Math.round(razao);
      if (razaoArredondada >= 2 && razaoArredondada <= 24 && Math.abs(razao - razaoArredondada) < 0.05) {
        mesesDetectados = razaoArredondada;
      }
    }

    const novaDescricao = mesesDetectados ? `MESES_DETECTADOS:${mesesDetectados}|QUOTA:${quotaMensal.toFixed(2)}` : null;
    await supabase.from("pagamentos").update({ descricao: novaDescricao }).eq("id", id_pagamento);

    return res.status(200).json({ ok: true, mesesDetectados, quotaMensal });
  } catch (err) {
    console.error("Erro em recalcular-meses-pagamento:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
