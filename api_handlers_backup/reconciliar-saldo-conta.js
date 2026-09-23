import { supabase } from "../server/lib/supabaseServer.js";
import { escolherContaPorTipo, ajustarSaldoConta } from "../server/lib/contaSaldo.js";

/**
 * Correção pontual (e sempre segura de repetir) para o histórico de
 * pagamentos confirmados ANTES da correção que passou a creditar o saldo da
 * conta automaticamente em confirmar-pagamento.js/dividir-pagamento-meses.js
 * — sem isto, esses pagamentos antigos ficavam confirmados/com recibo
 * emitido mas nunca refletidos no saldo real mostrado nos KPIs.
 *
 * Idempotente: cada pagamento já reconciliado fica registado em
 * "ai_auditoria" (origem "reconciliacao_saldo_manual") — uma segunda
 * chamada nunca volta a creditar o mesmo pagamento duas vezes, só apanha
 * pagamentos confirmados que ainda não tenham passado por aqui nem pelo
 * fluxo normal de confirmação (já corrigido).
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }
    const { id_predio } = req.body || {};
    if (!id_predio) {
      return res.status(400).json({ error: "id_predio em falta" });
    }

    const { data: fracoesPredio } = await supabase.from("fracoes").select("id_fracao").eq("id_predio", id_predio);
    const idsFracoes = (fracoesPredio || []).map((f) => f.id_fracao);
    if (idsFracoes.length === 0) {
      return res.status(200).json({ ok: true, creditado: 0, quantidade: 0, mensagem: "Este prédio não tem frações registadas." });
    }

    const { data: pagamentosConfirmados } = await supabase
      .from("pagamentos")
      .select("id, valor")
      .in("id_fracao", idsFracoes)
      .eq("estado", "confirmado");

    if (!pagamentosConfirmados?.length) {
      return res.status(200).json({ ok: true, creditado: 0, quantidade: 0, mensagem: "Não há pagamentos confirmados para reconciliar." });
    }

    const { data: jaReconciliados } = await supabase
      .from("ai_auditoria")
      .select("id_pagamento")
      .eq("id_predio", id_predio)
      .eq("origem", "reconciliacao_saldo_manual");
    const idsJaReconciliados = new Set((jaReconciliados || []).map((r) => r.id_pagamento));

    const pendentes = pagamentosConfirmados.filter((p) => !idsJaReconciliados.has(p.id));
    if (pendentes.length === 0) {
      return res.status(200).json({ ok: true, creditado: 0, quantidade: 0, mensagem: "Todos os pagamentos confirmados já estão refletidos no saldo — nada a corrigir." });
    }

    const somaTotal = Math.round(pendentes.reduce((acc, p) => acc + (Number(p.valor) || 0), 0) * 100) / 100;

    const { data: contasPredio } = await supabase.from("contas").select("id_conta, is_principal").eq("id_predio", id_predio);
    const contaAlvo = escolherContaPorTipo(contasPredio, "Quota Ordinária");
    if (!contaAlvo?.id_conta) {
      return res.status(404).json({ error: "Nenhuma conta bancária principal encontrada para este prédio." });
    }

    await ajustarSaldoConta(contaAlvo.id_conta, somaTotal);

    await supabase.from("ai_auditoria").insert(
      pendentes.map((p) => ({
        origem: "reconciliacao_saldo_manual",
        id_pagamento: p.id,
        valor: p.valor,
        id_predio
      }))
    );

    const { data: contaDepois } = await supabase.from("contas").select("saldo").eq("id_conta", contaAlvo.id_conta).maybeSingle();

    return res.status(200).json({
      ok: true,
      creditado: somaTotal,
      quantidade: pendentes.length,
      id_conta: contaAlvo.id_conta,
      saldo_novo: contaDepois?.saldo ?? null
    });
  } catch (err) {
    console.error("Erro em reconciliar-saldo-conta:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
