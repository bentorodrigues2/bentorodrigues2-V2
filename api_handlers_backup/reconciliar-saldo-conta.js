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
      .select("id, valor, id_fracao")
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

    // Também não creditar um pagamento que já tenha um movimento real
    // ligado a uma conta (id_conta preenchido) — descoberto ao investigar
    // um pedido do administrador: vários pagamentos confirmados já tinham
    // sido corretamente creditados via o movimento bancário criado na
    // confirmação (com [pagamento:<id>] na descrição e id_conta já
    // definido), mas nunca tinham passado por "ai_auditoria" com esta
    // origem — este botão voltava a creditar o mesmo dinheiro uma segunda
    // vez. Só é seguro reconciliar aqui pagamentos cujo movimento (se
    // existir) ainda não está ligado a nenhuma conta real.
    const { data: movimentosComPagamento } = await supabase
      .from("movimentos")
      .select("id_conta, descricao")
      .eq("id_predio", id_predio)
      .not("id_conta", "is", null);
    const idsPagamentoJaCreditados = new Set(
      (movimentosComPagamento || [])
        .map((m) => (m.descricao || "").match(/\[pagamento:([a-f0-9-]+)\]/i)?.[1])
        .filter(Boolean)
    );

    const pendentes = pagamentosConfirmados.filter(
      (p) => !idsJaReconciliados.has(p.id) && !idsPagamentoJaCreditados.has(p.id)
    );
    if (pendentes.length === 0) {
      return res.status(200).json({ ok: true, creditado: 0, quantidade: 0, mensagem: "Todos os pagamentos confirmados já estão refletidos no saldo — nada a corrigir." });
    }

    const { data: contasPredio } = await supabase.from("contas").select("id_conta, is_principal").eq("id_predio", id_predio);
    if (!contasPredio?.length) {
      return res.status(404).json({ error: "Nenhuma conta bancária encontrada para este prédio." });
    }

    // Em vez de somar tudo numa única conta "adivinhada" por omissão (Quota
    // Ordinária), cada pagamento pendente é cruzado com os avisos reais da
    // sua própria fração (por valor, mesma tolerância de 0.05€ já usada em
    // confirmar-pagamento.js) para descobrir o seu tipo verdadeiro — Quota
    // Ordinária e Extraordinária têm contas diferentes, por isso um prédio
    // com 2 contas ficava com dinheiro de obras creditado na conta corrente.
    const avisosPorFracao = new Map();
    async function avisosDaFracao(id_fracao) {
      if (!avisosPorFracao.has(id_fracao)) {
        const { data } = await supabase.from("avisos").select("tipo, valor").eq("id_fracao", id_fracao);
        avisosPorFracao.set(id_fracao, data || []);
      }
      return avisosPorFracao.get(id_fracao);
    }

    const deltaPorConta = new Map();
    const detalhePorPagamento = [];
    for (const p of pendentes) {
      const valor = Number(p.valor) || 0;
      const avisos = p.id_fracao ? await avisosDaFracao(p.id_fracao) : [];
      const avisoCorrespondente = avisos.find((a) => Math.abs(Number(a.valor || 0) - valor) < 0.05);
      const tipoReal = avisoCorrespondente?.tipo || "Quota Ordinária";
      const contaAlvo = escolherContaPorTipo(contasPredio, tipoReal);
      if (!contaAlvo?.id_conta) continue;
      deltaPorConta.set(contaAlvo.id_conta, Math.round(((deltaPorConta.get(contaAlvo.id_conta) || 0) + valor) * 100) / 100);
      detalhePorPagamento.push({ id: p.id, valor, tipo: tipoReal, id_conta: contaAlvo.id_conta });
    }

    for (const [id_conta, delta] of deltaPorConta) {
      await ajustarSaldoConta(id_conta, delta);
    }

    await supabase.from("ai_auditoria").insert(
      pendentes.map((p) => ({
        origem: "reconciliacao_saldo_manual",
        id_pagamento: p.id,
        valor: p.valor,
        id_predio
      }))
    );

    const { data: contasDepois } = await supabase
      .from("contas")
      .select("id_conta, saldo")
      .in("id_conta", [...deltaPorConta.keys()]);

    const somaTotal = Math.round([...deltaPorConta.values()].reduce((acc, v) => acc + v, 0) * 100) / 100;

    return res.status(200).json({
      ok: true,
      creditado: somaTotal,
      quantidade: pendentes.length,
      por_conta: detalhePorPagamento,
      saldos_novos: contasDepois || []
    });
  } catch (err) {
    console.error("Erro em reconciliar-saldo-conta:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
