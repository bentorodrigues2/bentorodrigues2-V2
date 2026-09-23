import { supabase } from "./supabaseServer.js";

/**
 * Escolhe a conta bancária certa consoante o tipo de movimento/aviso: Quota
 * Ordinária, Fundo Comum de Reserva e despesas normais usam a conta corrente
 * principal (is_principal); Quota Extraordinária usa a conta de
 * poupança/obras. Mesma regra já usada para escolher o IBAN a mostrar no
 * recibo (ver escolherIbanContaPorTipo em confirmar-pagamento.js,
 * dividir-pagamento-meses.js e server/lib/cronService.js) — aqui devolve o
 * registo da conta inteiro (para termos o id_conta), não só o IBAN.
 */
export function escolherContaPorTipo(contasPredio, tipoReferencia) {
  if (!contasPredio || contasPredio.length === 0) return null;
  const ehExtraordinaria = (tipoReferencia || "").toLowerCase().includes("extra");
  const contaPrincipal = contasPredio.find((c) => c.is_principal);
  const contaSecundaria = contasPredio.find((c) => !c.is_principal);
  if (ehExtraordinaria) return contaSecundaria || contaPrincipal || contasPredio[0];
  return contaPrincipal || contasPredio[0];
}

/**
 * Credita/debita o saldo real de uma conta bancária (delta positivo =
 * entrada, negativo = saída). "contas.saldo" é o valor de verdade mostrado
 * nos KPIs (Conta(s) à Ordem / Total Líquido no Painel de Controlo) — não é
 * recalculado a partir do livro de movimentos, por isso qualquer sítio que
 * confirme uma receita real ou justifique uma despesa real tem de chamar
 * isto explicitamente, ou o saldo mostrado fica parado no valor de arranque.
 */
export async function ajustarSaldoConta(idConta, delta) {
  if (!idConta || !delta) return;
  const { data: conta } = await supabase.from("contas").select("saldo").eq("id_conta", idConta).maybeSingle();
  if (!conta) return;
  const novoSaldo = Math.round(((Number(conta.saldo) || 0) + delta) * 100) / 100;
  await supabase.from("contas").update({ saldo: novoSaldo }).eq("id_conta", idConta);
}
