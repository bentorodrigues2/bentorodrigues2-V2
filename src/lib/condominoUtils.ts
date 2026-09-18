import { Fracao, LoggedUser } from "../types";

/**
 * Encontra a fração associada a um condómino autenticado (proprietário,
 * coproprietário ou inquilino). Antes só se procurava por
 * `f.proprietario.email === loggedUser.email`, o que funcionava para o
 * proprietário principal mas deixava um coproprietário ou inquilino sem
 * nenhuma fração encontrada (caindo em fallbacks como `fracoes[0]`, que
 * mostraria os dados privados de OUTRA fração). Usa primeiro o id_fracao
 * gravado no perfil (profiles.fracao, definido no convite) — mais fiável
 * do que procurar por email — e só cai para a pesquisa por email como
 * compatibilidade com sessões antigas sem esse campo ainda preenchido.
 */
export function encontrarFracaoDoCondomino(fracoes: Fracao[], loggedUser: LoggedUser): Fracao | undefined {
  if (loggedUser.id_fracao) {
    const porId = fracoes.find(f => f.id_fracao === loggedUser.id_fracao);
    if (porId) return porId;
  }
  const emailLower = (loggedUser.email || "").trim().toLowerCase();
  if (!emailLower) return undefined;
  return fracoes.find(f =>
    f.proprietario?.email?.toLowerCase() === emailLower ||
    (f.proprietarios_adicionais || []).some(p => p.email?.toLowerCase() === emailLower) ||
    f.inquilino?.email?.toLowerCase() === emailLower
  );
}
