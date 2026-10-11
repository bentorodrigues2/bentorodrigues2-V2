// src/lib/classificacaoSNC.ts
var PLANO_CONTAS_SNC_DEFAULT = [
  { codigo: "11", nome: "Caixa Geral de Condom\xEDnio", tipo: "ATIVO", descricao: "Fundo f\xEDsico de maneio em numer\xE1rio" },
  { codigo: "12", nome: "Dep\xF3sitos \xE0 Ordem", tipo: "ATIVO", descricao: "Contas banc\xE1rias correntes do condom\xEDnio" },
  { codigo: "13", nome: "Fundo Comum de Reserva", tipo: "ATIVO", descricao: "Conta banc\xE1ria espec\xEDfica para o FCR" },
  { codigo: "61", nome: "Consumos de \xC1gua", tipo: "GASTO", descricao: "Faturas de \xE1gua das partes comuns" },
  { codigo: "62", nome: "Consumos de Eletricidade", tipo: "GASTO", descricao: "Faturas de eletricidade/luz comum" },
  { codigo: "63", nome: "Manuten\xE7\xE3o Elevadores", tipo: "GASTO", descricao: "Contratos e assist\xEAncia t\xE9cnica de elevadores" },
  { codigo: "64", nome: "Servi\xE7os de Limpeza", tipo: "GASTO", descricao: "Sal\xE1rios de limpezas ou faturas de empresas" },
  { codigo: "65", nome: "Seguros de Edif\xEDcio", tipo: "GASTO", descricao: "Ap\xF3lices multirrisco comuns" },
  { codigo: "68", nome: "Obras de Conserva\xE7\xE3o", tipo: "GASTO", descricao: "Gastos com pinturas, telhado e reparos" },
  { codigo: "71", nome: "Rendimentos de Quotas", tipo: "RENDIMENTO", descricao: "Contribui\xE7\xF5es de quotas ordin\xE1rias das fra\xE7\xF5es" },
  { codigo: "72", nome: "Rendimentos FCR", tipo: "RENDIMENTO", descricao: "Refor\xE7os das fra\xE7\xF5es consignados ao FCR" },
  { codigo: "78", nome: "Rendimentos Extraordin\xE1rios", tipo: "RENDIMENTO", descricao: "Quotas extra para obras ou indemniza\xE7\xF5es" }
];
var REGRAS_SNC_DEFAULT = [
  { palavra_chave: "epal", codigo_conta: "61" },
  { palavra_chave: "\xE1gua", codigo_conta: "61" },
  { palavra_chave: "agua", codigo_conta: "61" },
  { palavra_chave: "edp", codigo_conta: "62" },
  { palavra_chave: "iberdrola", codigo_conta: "62" },
  { palavra_chave: "luz", codigo_conta: "62" },
  { palavra_chave: "eletricidade", codigo_conta: "62" },
  { palavra_chave: "electricidade", codigo_conta: "62" },
  { palavra_chave: "g\xE1s", codigo_conta: "62" },
  { palavra_chave: "elevador", codigo_conta: "63" },
  { palavra_chave: "otis", codigo_conta: "63" },
  { palavra_chave: "schindler", codigo_conta: "63" },
  { palavra_chave: "kone", codigo_conta: "63" },
  { palavra_chave: "limp", codigo_conta: "64" },
  { palavra_chave: "estrela", codigo_conta: "64" },
  { palavra_chave: "higienizacao", codigo_conta: "64" },
  { palavra_chave: "seguro", codigo_conta: "65" },
  { palavra_chave: "fidelidade", codigo_conta: "65" },
  { palavra_chave: "apolice", codigo_conta: "65" },
  { palavra_chave: "allianz", codigo_conta: "65" },
  { palavra_chave: "quota", codigo_conta: "71" },
  { palavra_chave: "fra\xE7\xE3o", codigo_conta: "71" },
  { palavra_chave: "fracao", codigo_conta: "71" },
  { palavra_chave: "cond\xF3mino", codigo_conta: "71" },
  { palavra_chave: "fcr", codigo_conta: "72" },
  { palavra_chave: "reserva", codigo_conta: "72" }
];
var CODIGO_CONTA_SNC_FALLBACK_DESPESA = "68";
var CODIGO_CONTA_SNC_FALLBACK_RECEITA = "71";
function classificarPorRegrasSNC(descricaoLivre, tipo, planoContas = PLANO_CONTAS_SNC_DEFAULT, regras = REGRAS_SNC_DEFAULT) {
  const desc = (descricaoLivre || "").toLowerCase();
  const tipoContaCompativel = tipo === "Receita" ? "RENDIMENTO" : tipo === "Despesa" ? "GASTO" : null;
  const regraEncontrada = regras.find((r) => {
    if (!desc.includes(r.palavra_chave.toLowerCase())) return false;
    if (!tipoContaCompativel) return true;
    const contaDaRegra = planoContas.find((c) => c.codigo === r.codigo_conta);
    return contaDaRegra?.tipo === tipoContaCompativel;
  });
  if (regraEncontrada) return regraEncontrada.codigo_conta;
  if (tipo === "Receita") return CODIGO_CONTA_SNC_FALLBACK_RECEITA;
  if (tipo === "Despesa") return CODIGO_CONTA_SNC_FALLBACK_DESPESA;
  return null;
}
export {
  CODIGO_CONTA_SNC_FALLBACK_DESPESA,
  CODIGO_CONTA_SNC_FALLBACK_RECEITA,
  PLANO_CONTAS_SNC_DEFAULT,
  REGRAS_SNC_DEFAULT,
  classificarPorRegrasSNC
};
