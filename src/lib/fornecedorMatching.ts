import { Fornecedor } from "../types";

/** Remove espaços e maiúsculas/minúsculas para comparar IBANs com segurança. */
function normalizarIban(iban?: string | null): string {
  return (iban || "").replace(/\s+/g, "").toUpperCase();
}

/** Remove acentos, pontuação e sufixos societários comuns (Lda, S.A., Unipessoal)
 *  para comparar nomes de entidades com mais tolerância a pequenas variações
 *  entre o nome registado na ficha do fornecedor e o nome exato que aparece
 *  no extrato/aviso bancário. Substitui pontuação por espaço (em vez de a
 *  remover) para preservar a separação entre palavras — necessário para o
 *  cruzamento por palavra/frase inteira em contemFraseInteira, que de outra
 *  forma nunca teria fronteiras nenhumas para comparar num texto todo colado.
 */
function normalizarNomeEntidade(nome?: string | null): string {
  return (nome || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(lda|unipessoal|s\.?a\.?|comercial|clientes?|portugal)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Verifica se "frase" aparece em "texto" como sequência de palavras inteira,
 * delimitada por espaços/início/fim — nunca como substring solta dentro de
 * outra palavra. Mesma proteção já aplicada ao cruzamento bancário de
 * frações (bankStatementParser.ts, contemPalavraInteira) — sem isto, um
 * nome curto de fornecedor podia "aparecer" dentro de texto sem relação
 * nenhuma, tal como aconteceu com códigos de fração de 1 letra.
 */
function contemFraseInteira(texto: string, frase: string): boolean {
  if (!frase) return false;
  const escapada = frase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escapada}(\\s|$)`).test(texto);
}

export interface DadosParaCruzamentoFornecedor {
  iban_credor?: string | null;
  numero_adc?: string | null;
  referencia_credor?: string | null;
  entidade_credora?: string | null;
  entidade?: string | null;
  descricao?: string | null;
}

export interface ResultadoCruzamentoFornecedor {
  fornecedor: Fornecedor;
  metodo: "iban" | "referencia_contrato" | "nome" | "palavra_chave";
}

/**
 * Tenta identificar a que fornecedor já registado pertence um movimento
 * extraído de um extrato/aviso bancário — pela ordem de fiabilidade real:
 * 1) IBAN do credor (exato, mas só distingue fornecedores diferentes — não
 *    distingue contratos diferentes com a mesma utility, que partilham IBAN)
 * 2) Referência de contrato/ADC guardada na ficha do fornecedor (o dado mais
 *    fiável para débitos diretos de utilities, onde o IBAN é partilhado por
 *    milhares de clientes)
 * 3) Nome da entidade, por aproximação (ignora acentos/pontuação/sufixos)
 * 4) Palavra-chave configurada na ficha do fornecedor, contida na descrição
 *    do movimento — para custos sem IBAN nem nome de entidade fiável (ex:
 *    "Imposto de Selo", "Comissão", associados ao próprio banco)
 * Devolve null se não houver nenhuma correspondência com confiança
 * suficiente — nesse caso a associação deve ficar pendente para escolha
 * manual do administrador, nunca adivinhada.
 */
export function cruzarMovimentoComFornecedor(
  fornecedores: Fornecedor[],
  dados: DadosParaCruzamentoFornecedor
): ResultadoCruzamentoFornecedor | null {
  const ibanCredor = normalizarIban(dados.iban_credor);
  if (ibanCredor) {
    const porIban = fornecedores.find(f => normalizarIban(f.iban) === ibanCredor);
    if (porIban) return { fornecedor: porIban, metodo: "iban" };
  }

  // Mínimo de 4 caracteres antes de aceitar como substring de uma referência
  // mais longa — uma referência curta de mais (ex: "12") apareceria dentro
  // de quase qualquer número de conta/contrato mais longo por coincidência.
  const referenciasAlvo = [dados.numero_adc, dados.referencia_credor]
    .filter(Boolean)
    .map(r => String(r).trim())
    .filter(r => r.length >= 4);
  if (referenciasAlvo.length > 0) {
    for (const f of fornecedores) {
      const encontrada = (f.referencias_contrato || []).some(rc => {
        const refFornecedor = rc.referencia.trim();
        if (refFornecedor.length < 4) return false;
        return referenciasAlvo.some(alvo => alvo.includes(refFornecedor) || refFornecedor.includes(alvo));
      });
      if (encontrada) return { fornecedor: f, metodo: "referencia_contrato" };
    }
  }

  const nomeAlvo = normalizarNomeEntidade(dados.entidade_credora || dados.entidade || dados.descricao);
  if (nomeAlvo.length >= 4) {
    const porNome = fornecedores.find(f => {
      const nomeFornecedor = normalizarNomeEntidade(f.nome);
      if (nomeFornecedor.length < 4) return false;
      return contemFraseInteira(nomeAlvo, nomeFornecedor) || contemFraseInteira(nomeFornecedor, nomeAlvo);
    });
    if (porNome) return { fornecedor: porNome, metodo: "nome" };
  }

  const descricaoAlvo = normalizarNomeEntidade(dados.descricao || dados.entidade_credora || dados.entidade);
  if (descricaoAlvo.length >= 3) {
    const porPalavraChave = fornecedores.find(f =>
      (f.palavras_chave || []).some(pc => {
        const pcNorm = normalizarNomeEntidade(pc);
        return pcNorm.length >= 3 && contemFraseInteira(descricaoAlvo, pcNorm);
      })
    );
    if (porPalavraChave) return { fornecedor: porPalavraChave, metodo: "palavra_chave" };
  }

  return null;
}
