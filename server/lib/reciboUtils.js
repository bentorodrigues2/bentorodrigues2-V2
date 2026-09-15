const STOPWORDS_PREFIXO = ["rua", "edifício", "edificio", "condomínio", "condominio", "do", "da", "de", "dos", "das", "e"];

/** Deriva um prefixo curto do edifício (ex.: "Rua Bento Rodrigues 2" -> "BR2") */
export function derivarPrefixoEdificio(nomePredio) {
  const nomeLimpo = (nomePredio || "").replace(/\(.*?\)/g, "").trim();
  const digitos = (nomeLimpo.match(/\d+/) || [""])[0];
  const semDigitos = nomeLimpo.replace(/\d+/g, "").trim();
  const iniciais = semDigitos
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS_PREFIXO.includes(w.toLowerCase()))
    .map((w) => w[0].toUpperCase())
    .join("");
  return (iniciais || "COND") + digitos;
}

export default { derivarPrefixoEdificio };
