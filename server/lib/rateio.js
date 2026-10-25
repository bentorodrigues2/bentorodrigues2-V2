// Fórmula de rateio do orçamento anual por fração (permilagem × rate), com
// um coeficiente real para lojas comerciais com acesso direto pelo exterior
// — estas não têm, na prática, nenhuma isenção legal fixa (a lei, art.º
// 1424º CC, só isenta especificamente despesas de ascensor). Este valor
// (45,28%) foi reverse-engineered a partir do quadro de quotas real
// historicamente praticado neste condomínio (confirmado com o
// administrador, bate a 1 cêntimo ou exato em 17 de 17 frações).
//
// Fonte única no lado do servidor — antes existiam 2 cópias idênticas
// (cronService.js, inboundProcessor.js), sem divergência ativa entre elas,
// mas uma alteração futura à fórmula numa cópia e esquecida na outra
// criaria uma divergência real (quota emitida ≠ quota prevista no
// simulador). O lado do cliente (GestaoQuotasOrcamento.tsx, GestaoEmissao.tsx,
// ConfiguracaoArranqueSaldos.tsx) mantém as suas próprias cópias — mundos
// TS/frontend vs. JS/backend não partilham módulos diretamente.
export const COEF_LOJA_EXTERIOR = 0.4528;

export function isLojaExterior(fr) {
  return fr.tipologia === "Loja Comercial" && (fr.tipo_access || "").includes("Exterior");
}

export function calcularRatesPredio(predio, fracoes) {
  const orcamentoAnual = Number(predio.patrimonio?.orcamento_anual || 0);
  const orcamentoMensal = orcamentoAnual / 12;
  let permilagemLoja = 0;
  fracoes.forEach((fr) => { if (isLojaExterior(fr)) permilagemLoja += fr.permilagem; });
  const permilagemNormal = 1000 - permilagemLoja;
  const denominador = permilagemNormal + permilagemLoja * COEF_LOJA_EXTERIOR;
  const rateNormal = denominador > 0 ? orcamentoMensal / denominador : 0;
  const rateLoja = rateNormal * COEF_LOJA_EXTERIOR;
  return { orcamentoAnual, isLojaExterior, rateNormal, rateLoja };
}
