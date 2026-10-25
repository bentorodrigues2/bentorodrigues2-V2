import { ajustarSaldoConta } from "../server/lib/contaSaldo.js";
import { supabase } from "../server/lib/supabaseServer.js";

/**
 * Ajuste de saldo de conta bancária centralizado no servidor — único ponto
 * de escrita real em "contas.saldo" a partir de agora.
 *
 * Bug crítico confirmado em auditoria: mais de 10 sítios no frontend
 * recalculavam o novo saldo em JavaScript (saldo em memória + delta) e
 * gravavam o valor absoluto via upsert — nenhum deles passava pela função
 * atómica já corrigida em server/lib/contaSaldo.js. Uma aba aberta há
 * horas, com o saldo da conta desatualizado em memória (o estado React só
 * é reconciliado ao abrir a app, ao voltar a ficar visível, ou a cada 60s
 * enquanto visível), ao lançar qualquer movimento gravava um saldo
 * calculado a partir de dados já velhos — apagando silenciosamente créditos
 * ou débitos reais entretanto feitos por outra via (confirmado em produção
 * real: 111,04€ de um condómino perdidos desta forma).
 *
 * Esta rota substitui esse padrão: o cliente nunca mais calcula nem grava o
 * saldo diretamente — só pede um ajuste relativo (delta) e recebe de volta
 * o saldo real já atualizado, calculado atomicamente pela base de dados.
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }
    const { id_conta, delta } = req.body || {};
    if (!id_conta || typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ error: "id_conta e delta (número diferente de 0) são obrigatórios." });
    }

    await ajustarSaldoConta(id_conta, delta);

    const { data: conta, error } = await supabase.from("contas").select("*").eq("id_conta", id_conta).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!conta) return res.status(404).json({ error: "Conta não encontrada." });

    return res.status(200).json({ ok: true, conta });
  } catch (err) {
    console.error("Erro em api/contas:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
