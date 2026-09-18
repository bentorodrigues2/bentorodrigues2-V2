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

/**
 * Encontra a fotografia de perfil de quem está autenticado — procura em
 * TODOS os prédios/frações (não só na fração associada ao login) porque um
 * ADMIN é muitas vezes também o proprietário registado de alguma fração
 * (ex: administrador a testar a própria conta), e é essa foto que deve
 * aparecer junto ao nome na barra lateral em vez do ícone genérico da app.
 */
export function encontrarFotoDoUtilizador(fracoes: Fracao[], loggedUser: LoggedUser): string | null {
  const emailLower = (loggedUser.email || "").trim().toLowerCase();
  if (!emailLower) return null;
  for (const f of fracoes) {
    if (f.proprietario?.email?.toLowerCase() === emailLower && f.proprietario.foto) return f.proprietario.foto;
    const co = (f.proprietarios_adicionais || []).find(p => p.email?.toLowerCase() === emailLower && p.foto);
    if (co?.foto) return co.foto;
    if (f.inquilino?.email?.toLowerCase() === emailLower && f.inquilino.foto) return f.inquilino.foto;
  }
  return null;
}
