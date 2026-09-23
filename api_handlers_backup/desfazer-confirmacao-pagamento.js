import { supabase } from "../server/lib/supabaseServer.js";
import { escolherContaPorTipo, ajustarSaldoConta } from "../server/lib/contaSaldo.js";

/**
 * Reverte a confirmação de um pagamento: volta a marcar o pagamento como
 * "pendente", devolve o movimento a "Movimento Cego / Por Justificar" e
 * desfaz o(s) aviso(s) que tinham ficado marcados "Pago" por causa desta
 * confirmação — para o admin poder corrigir e voltar a confirmar (ex:
 * dividir corretamente em N meses, corrigir a fração, ou perceber que nem
 * sequer era uma quota normal). Não apaga nada que já existisse antes
 * (avisos regulares voltam só a "Pendente"); só elimina os avisos que
 * tinham sido criados especificamente por esta confirmação
 * ("aviso-confirmado-<id>" ou "aviso-dividido-<id>-N").
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
    if (pagamento.estado !== "confirmado") {
      return res.status(400).json({ error: "Este pagamento não está confirmado — nada para reverter." });
    }

    const resumo = { avisosApagados: [], avisosRevertidos: [] };

    // 1) Avisos criados só por causa desta confirmação (lump avulso ou
    // divisão em N meses) — apagam-se por completo, não faz sentido
    // deixá-los como "Pendente" porque nunca foram uma nota real emitida.
    const { data: avisosDaConfirmacao } = await supabase
      .from("avisos")
      .select("id_aviso")
      .or(`id_aviso.eq.aviso-confirmado-${id_pagamento},id_aviso.ilike.aviso-dividido-${id_pagamento}-%`);

    if (avisosDaConfirmacao?.length) {
      const ids = avisosDaConfirmacao.map((a) => a.id_aviso);
      await supabase.from("avisos").delete().in("id_aviso", ids);
      resumo.avisosApagados = ids;
    } else {
      // 2) Caso contrário, foi um aviso regular já existente que ficou
      // marcado "Pago" — encontra-o pelo valor (mesma fração, mesmo valor)
      // e devolve-o a "Pendente", sem o apagar.
      const { data: candidatos } = await supabase
        .from("avisos")
        .select("id_aviso, valor")
        .eq("id_fracao", pagamento.id_fracao)
        .eq("estado", "Pago");
      const alvo = (candidatos || []).find((a) => Math.abs(Number(a.valor || 0) - Number(pagamento.valor || 0)) < 0.05);
      if (alvo) {
        await supabase.from("avisos").update({ estado: "Pendente" }).eq("id_aviso", alvo.id_aviso);
        resumo.avisosRevertidos = [alvo.id_aviso];
      }
    }

    // 2.1) Reverte o crédito feito na conta bancária quando este pagamento
    // foi confirmado (ver confirmar-pagamento.js/dividir-pagamento-meses.js)
    // — usa a mesma regra de escolha de conta (determinística, dá sempre o
    // mesmo resultado para a mesma fração/tipo), para debitar exatamente a
    // conta que tinha sido creditada.
    try {
      if (pagamento.id_fracao) {
        const { data: fracaoDoPagamento } = await supabase
          .from("fracoes")
          .select("id_predio")
          .eq("id_fracao", pagamento.id_fracao)
          .maybeSingle();
        if (fracaoDoPagamento?.id_predio) {
          const { data: contasPredio } = await supabase
            .from("contas")
            .select("id_conta, is_principal")
            .eq("id_predio", fracaoDoPagamento.id_predio);
          const contaAlvo = escolherContaPorTipo(contasPredio, "Quota Ordinária");
          if (contaAlvo?.id_conta) {
            await ajustarSaldoConta(contaAlvo.id_conta, -Number(pagamento.valor || 0));
          }
        }
      }
    } catch (errSaldo) {
      console.warn("[desfazer-confirmacao-pagamento] Aviso ao debitar saldo da conta:", errSaldo?.message || errSaldo);
    }

    // 3) Pagamento volta a pendente
    await supabase.from("pagamentos").update({ estado: "pendente", confirmado_em: null }).eq("id", id_pagamento);

    // 4) Movimento volta a "por justificar"
    await supabase
      .from("movimentos")
      .update({ estado: "Movimento Cego / Por Justificar", estado_conciliacao: "PENDENTE", is_movimento_cego: true })
      .ilike("descricao", `%[pagamento:${id_pagamento}]%`);

    return res.status(200).json({ ok: true, ...resumo });
  } catch (err) {
    console.error("Erro em desfazer-confirmacao-pagamento:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
