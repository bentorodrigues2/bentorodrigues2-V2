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
 *
 * Usa a função Postgres "ajustar_saldo_conta_atomico" (UPDATE ... SET saldo =
 * saldo + delta num único passo) em vez de ler e depois escrever aqui em
 * JS — bug real confirmado em produção: duas confirmações de pagamento a
 * poucos segundos de intervalo liam o mesmo saldo de partida antes de
 * qualquer uma das duas ter gravado a sua própria soma, e a segunda
 * gravação apagava o crédito da primeira (clássica condição de corrida
 * "leitura-depois-escrita"). A base de dados serializa sozinha um UPDATE
 * relativo ao próprio valor da coluna, eliminando a janela de corrida.
 */
export async function ajustarSaldoConta(idConta, delta) {
  if (!idConta || !delta) return;
  const { error } = await supabase.rpc("ajustar_saldo_conta_atomico", { p_id_conta: idConta, p_delta: delta });
  if (error) {
    console.error("[contaSaldo] Erro ao ajustar saldo atomicamente:", error.message);
  }
}
