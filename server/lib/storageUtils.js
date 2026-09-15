/**
 * Sanitiza um segmento de caminho para o Supabase Storage — a API rejeita
 * chaves com espaços/acentos ("Invalid Key"), mas os valores legíveis usados
 * nos registos da tabela `documentos` (tema/tipo, ex. "Nota de Cobrança",
 * "Fatura de Fornecedor") mantêm-se sem alteração nos próprios registos;
 * só o caminho de armazenamento passa por aqui.
 */
export function sanitizarSegmentoStorage(valor) {
  const semAcentos = String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const limpo = semAcentos.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return limpo || "geral";
}

/**
 * Sanitiza um nome de ficheiro para a Storage API, preservando a extensão
 * (necessário para anexos recebidos por email, cujo nome original pode ter
 * espaços/acentos — ex. "comprovativo setembro.pdf").
 */
export function sanitizarNomeFicheiro(nomeOriginal) {
  const nome = String(nomeOriginal ?? "documento");
  const pontoFinal = nome.lastIndexOf(".");
  if (pontoFinal <= 0) return sanitizarSegmentoStorage(nome);
  const base = sanitizarSegmentoStorage(nome.slice(0, pontoFinal));
  const extensao = nome.slice(pontoFinal + 1).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return extensao ? `${base}.${extensao}` : base;
}

export default { sanitizarSegmentoStorage, sanitizarNomeFicheiro };
