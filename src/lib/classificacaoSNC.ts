// Classificação contabilística oficial (Plano de Contas SNC Simplificado
// para Condomínios) — módulo partilhado, sem dependências de React nem do
// browser, para poder ser usado tanto no frontend (src/lib/supabaseService.ts,
// ao gravar um movimento) como no backend (server/lib/inboundProcessor.js,
// ao lançar automaticamente um movimento a partir de um email/extrato),
// através do mesmo bundle esbuild já usado para src/lib/fornecedorMatching.ts.
//
// Antes, esta classificação só existia dentro de ContabilidadeInterna.tsx,
// como uma vista de leitura ("Razão Geral") calculada em cima dos
// movimentos já lançados — nunca gravada no próprio movimento. Pedido
// explícito do administrador: o POC/SNC tem de ser aplicado no momento do
// LANÇAMENTO do movimento, não só mostrado depois numa vista à parte.

export interface PlanoContaSNC {
  codigo: string;
  nome: string;
  tipo: "ATIVO" | "PASSIVO" | "GASTO" | "RENDIMENTO";
  descricao?: string;
}

export interface RegraCategorizacaoSNC {
  palavra_chave: string;
  codigo_conta: string;
}

export const PLANO_CONTAS_SNC_DEFAULT: PlanoContaSNC[] = [
  { codigo: "11", nome: "Caixa Geral de Condomínio", tipo: "ATIVO", descricao: "Fundo físico de maneio em numerário" },
  { codigo: "12", nome: "Depósitos à Ordem", tipo: "ATIVO", descricao: "Contas bancárias correntes do condomínio" },
  { codigo: "13", nome: "Fundo Comum de Reserva", tipo: "ATIVO", descricao: "Conta bancária específica para o FCR" },
  { codigo: "61", nome: "Consumos de Água", tipo: "GASTO", descricao: "Faturas de água das partes comuns" },
  { codigo: "62", nome: "Consumos de Eletricidade", tipo: "GASTO", descricao: "Faturas de eletricidade/luz comum" },
  { codigo: "63", nome: "Manutenção Elevadores", tipo: "GASTO", descricao: "Contratos e assistência técnica de elevadores" },
  { codigo: "64", nome: "Serviços de Limpeza", tipo: "GASTO", descricao: "Salários de limpezas ou faturas de empresas" },
  { codigo: "65", nome: "Seguros de Edifício", tipo: "GASTO", descricao: "Apólices multirrisco comuns" },
  { codigo: "68", nome: "Obras de Conservação", tipo: "GASTO", descricao: "Gastos com pinturas, telhado e reparos" },
  { codigo: "71", nome: "Rendimentos de Quotas", tipo: "RENDIMENTO", descricao: "Contribuições de quotas ordinárias das frações" },
  { codigo: "72", nome: "Rendimentos FCR", tipo: "RENDIMENTO", descricao: "Reforços das frações consignados ao FCR" },
  { codigo: "78", nome: "Rendimentos Extraordinários", tipo: "RENDIMENTO", descricao: "Quotas extra para obras ou indemnizações" }
];

export const REGRAS_SNC_DEFAULT: RegraCategorizacaoSNC[] = [
  { palavra_chave: "epal", codigo_conta: "61" },
  { palavra_chave: "água", codigo_conta: "61" },
  { palavra_chave: "agua", codigo_conta: "61" },
  { palavra_chave: "edp", codigo_conta: "62" },
  { palavra_chave: "iberdrola", codigo_conta: "62" },
  { palavra_chave: "luz", codigo_conta: "62" },
  { palavra_chave: "eletricidade", codigo_conta: "62" },
  { palavra_chave: "electricidade", codigo_conta: "62" },
  { palavra_chave: "gás", codigo_conta: "62" },
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
  { palavra_chave: "fração", codigo_conta: "71" },
  { palavra_chave: "fracao", codigo_conta: "71" },
  { palavra_chave: "condómino", codigo_conta: "71" },
  { palavra_chave: "fcr", codigo_conta: "72" },
  { palavra_chave: "reserva", codigo_conta: "72" }
];

export const CODIGO_CONTA_SNC_FALLBACK_DESPESA = "68"; // Obras de Conservação / Geral
export const CODIGO_CONTA_SNC_FALLBACK_RECEITA = "71"; // Rendimentos de Quotas

/**
 * Devolve o código de conta SNC que corresponde a este movimento, pelas
 * mesmas regras (palavra-chave na descrição) já usadas no testador manual
 * de ContabilidadeInterna.tsx. "tipo" (Receita/Despesa), quando conhecido,
 * restringe as regras candidatas ao tipo de conta compatível — uma Despesa
 * nunca pode cair numa conta RENDIMENTO e vice-versa (bug real já
 * corrigido nesta sessão: "Fração Não Identificada", texto genérico
 * presente em QUALQUER movimento reconhecido por email sem fração
 * associada, fazia uma fatura de fornecedor cair em "Rendimentos de
 * Quotas" só por conter a palavra "fração").
 */
export function classificarPorRegrasSNC(
  descricaoLivre: string,
  tipo: "Receita" | "Despesa" | string | undefined,
  planoContas: PlanoContaSNC[] = PLANO_CONTAS_SNC_DEFAULT,
  regras: RegraCategorizacaoSNC[] = REGRAS_SNC_DEFAULT
): string | null {
  const desc = (descricaoLivre || "").toLowerCase();
  const tipoContaCompativel = tipo === "Receita" ? "RENDIMENTO" : tipo === "Despesa" ? "GASTO" : null;
  const regraEncontrada = regras.find(r => {
    if (!desc.includes(r.palavra_chave.toLowerCase())) return false;
    if (!tipoContaCompativel) return true;
    const contaDaRegra = planoContas.find(c => c.codigo === r.codigo_conta);
    return contaDaRegra?.tipo === tipoContaCompativel;
  });
  if (regraEncontrada) return regraEncontrada.codigo_conta;
  if (tipo === "Receita") return CODIGO_CONTA_SNC_FALLBACK_RECEITA;
  if (tipo === "Despesa") return CODIGO_CONTA_SNC_FALLBACK_DESPESA;
  return null;
}
