import { Fornecedor } from "../types";

/** Remove espaços e maiúsculas/minúsculas para comparar IBANs com segurança. */
function normalizarIban(iban?: string | null): string {
  return (iban || "").replace(/\s+/g, "").toUpperCase();
}

/** Remove acentos, pontuação e sufixos societários comuns (Lda, S.A., Unipessoal)
 *  para comparar nomes de entidades com mais tolerância a pequenas variações
 *  entre o nome registado na ficha do fornecedor e o nome exato que aparece
 *  no extrato/aviso bancário. */
function normalizarNomeEntidade(nome?: string | null): string {
  return (nome || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(lda|unipessoal|s\.?a\.?|comercial|clientes?|portugal)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
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
  metodo: "iban" | "referencia_contrato" | "nome";
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

  const referenciasAlvo = [dados.numero_adc, dados.referencia_credor]
    .filter(Boolean)
    .map(r => String(r).trim());
  if (referenciasAlvo.length > 0) {
    for (const f of fornecedores) {
      const encontrada = (f.referencias_contrato || []).some(rc =>
        referenciasAlvo.some(alvo => alvo.includes(rc.referencia.trim()) || rc.referencia.trim().includes(alvo))
      );
      if (encontrada) return { fornecedor: f, metodo: "referencia_contrato" };
    }
  }

  const nomeAlvo = normalizarNomeEntidade(dados.entidade_credora || dados.entidade || dados.descricao);
  if (nomeAlvo.length >= 4) {
    const porNome = fornecedores.find(f => {
      const nomeFornecedor = normalizarNomeEntidade(f.nome);
      return nomeFornecedor.length >= 4 && (nomeAlvo.includes(nomeFornecedor) || nomeFornecedor.includes(nomeAlvo));
    });
    if (porNome) return { fornecedor: porNome, metodo: "nome" };
  }

  return null;
}
