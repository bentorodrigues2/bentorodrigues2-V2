import { Fracao, Aviso, ExtratoTransacao } from "../types";
import { gerarReferenciaBR23EExtra } from "../utils";

/**
 * Normalizes text for robust matching (removes accents, lowercase, extra spaces).
 */
export function normalizeBankText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses OFX (Open Financial Exchange) format commonly exported by Portuguese banks.
 */
export function parseOFXContent(ofxText: string): Array<{
  data: string;
  tipo: "CREDITO" | "DEBITO";
  valor: number;
  descricao: string;
  fitid?: string;
  memo?: string;
}> {
  const transactions: Array<{
    data: string;
    tipo: "CREDITO" | "DEBITO";
    valor: number;
    descricao: string;
    fitid?: string;
    memo?: string;
  }> = [];

  // Match all <STMTTRN> blocks
  const stmttrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;

  while ((match = stmttrnRegex.exec(ofxText)) !== null) {
    const block = match[1];

    const trntypeMatch = block.match(/<TRNTYPE>([^\r\n<]+)/i);
    const dtpostedMatch = block.match(/<DTPOSTED>([^\r\n<]+)/i);
    const trnamtMatch = block.match(/<TRNAMT>([^\r\n<]+)/i);
    const fitidMatch = block.match(/<FITID>([^\r\n<]+)/i);
    const nameMatch = block.match(/<NAME>([^\r\n<]+)/i);
    const memoMatch = block.match(/<MEMO>([^\r\n<]+)/i);

    const rawAmt = trnamtMatch ? parseFloat(trnamtMatch[1].trim().replace(",", ".")) : 0;
    const rawDate = dtpostedMatch ? dtpostedMatch[1].trim() : "";
    
    // Parse OFX date format YYYYMMDD or YYYYMMDDHHMMSS
    let isoDate = new Date().toISOString().split("T")[0];
    if (rawDate.length >= 8) {
      const yyyy = rawDate.substring(0, 4);
      const mm = rawDate.substring(4, 6);
      const dd = rawDate.substring(6, 8);
      isoDate = `${yyyy}-${mm}-${dd}`;
    }

    const name = nameMatch ? nameMatch[1].trim() : "";
    const memo = memoMatch ? memoMatch[1].trim() : "";
    const fullDesc = [name, memo].filter(Boolean).join(" - ") || "Transação Bancária OFX";
    const tipo = rawAmt >= 0 ? "CREDITO" : "DEBITO";

    transactions.push({
      data: isoDate,
      tipo,
      valor: Math.abs(rawAmt),
      descricao: fullDesc,
      fitid: fitidMatch ? fitidMatch[1].trim() : undefined,
      memo
    });
  }

  return transactions;
}

/**
 * Parses CSV/TXT bank exports (supporting delimiter ; , \t, European amounts 1.250,50€ or 45.00).
 */
export function parseCSVContent(csvText: string): Array<{
  data: string;
  tipo: "CREDITO" | "DEBITO";
  valor: number;
  descricao: string;
}> {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Determine delimiter from first few lines
  const firstLine = lines[0];
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  
  const delimiter = semiCount >= commaCount && semiCount >= tabCount ? ";" : tabCount >= commaCount ? "\t" : ",";

  const transactions: Array<{
    data: string;
    tipo: "CREDITO" | "DEBITO";
    valor: number;
    descricao: string;
  }> = [];

  // Skip headers or introductory lines
  let startIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const l = lines[i].toLowerCase();
    if (l.includes("data") || l.includes("descri") || l.includes("movimento") || l.includes("valor") || l.includes("montante") || l.includes("credito")) {
      startIdx = i + 1;
      break;
    }
  }

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith("#") || line.toLowerCase().includes("saldo final") || line.toLowerCase().includes("saldo inicial")) continue;

    const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ""));
    if (cols.length < 2) continue;

    // Detect date column (e.g. DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY)
    let dateStr = "";
    let descStr = "";
    let valor = 0;
    let tipo: "CREDITO" | "DEBITO" = "CREDITO";

    for (let c = 0; c < cols.length; c++) {
      const colVal = cols[c];
      
      // Match dates like 02/05/2026 or 2026-05-02 or 02-05-2026
      const dateMatch = colVal.match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{2,4})$/);
      if (dateMatch && !dateStr) {
        if (dateMatch[1].length === 4) {
          dateStr = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
        } else {
          dateStr = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
        }
        continue;
      }

      // Match numeric amounts like 46,13 or -145.50 or 46.13 EUR
      const cleanNumStr = colVal.replace(/EUR|€/gi, "").replace(/\s/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".");
      const parsedNum = parseFloat(cleanNumStr);
      if (!isNaN(parsedNum) && (cleanNumStr.includes(".") || Math.abs(parsedNum) > 0.01) && valor === 0) {
        valor = Math.abs(parsedNum);
        tipo = parsedNum < 0 ? "DEBITO" : "CREDITO";
        continue;
      }

      // Collect textual descriptions
      if (colVal.length > descStr.length && isNaN(Number(colVal))) {
        descStr = colVal;
      }
    }

    if (dateStr && valor > 0) {
      transactions.push({
        data: dateStr,
        tipo,
        valor,
        descricao: descStr || "Movimento Bancário"
      });
    }
  }

  return transactions;
}

/**
 * Escolhe, do conjunto de avisos pendentes de UMA fração (já ordenados do
 * mais antigo para o mais recente), quais é que o valor efetivamente
 * transferido cobre — mês a mês, a começar sempre pelo mais antigo em
 * dívida. Antes disto, qualquer pagamento reconhecido marcava TODOS os
 * avisos pendentes da fração como "Pago" de uma só vez, mesmo quando o
 * condómino só tinha pago 1 mês e havia 3 em aberto — bug confirmado em
 * produção (o Mapa de Pagamentos mostrava meses futuros como pagos sem
 * nunca terem sido). Se o valor pago não corresponder exatamente à soma de
 * um ou mais meses consecutivos mais antigos (tolerância de 5 cêntimos),
 * devolve uma lista vazia — mais vale pedir confirmação manual ao
 * administrador (que meses este pagamento cobre) do que arriscar fechar o
 * mês errado.
 */
export function selecionarAvisosCobertosPeloValor(fracaoAvisosOrdenados: Aviso[], valorPago: number): Aviso[] {
  let acumulado = 0;
  const selecionados: Aviso[] = [];
  for (const aviso of fracaoAvisosOrdenados) {
    const proximoAcumulado = Math.round((acumulado + aviso.valor) * 100) / 100;
    if (proximoAcumulado - valorPago > 0.05) break;
    selecionados.push(aviso);
    acumulado = proximoAcumulado;
    if (Math.abs(acumulado - valorPago) < 0.05) break;
  }
  return Math.abs(acumulado - valorPago) < 0.05 ? selecionados : [];
}

/**
 * Verifica se "agulha" aparece em "palheiro" como PALAVRA inteira, delimitada
 * por espaços/início/fim — nunca como substring solta. Sem isto, uma fração
 * de código curto (ex: "E") "aparecia" dentro de qualquer texto que tivesse
 * essa letra lá por dentro (ex: "JOSE CARLOS ALVES GUERRA" contém "e" em
 * "jose" e em "alves") — bug confirmado em produção: uma transferência do
 * próprio José Carlos Alves Guerra (fração K) foi cruzada com confiança 99%
 * contra a Fração E, só porque "E" é uma substring de "jose"/"alves".
 */
function contemPalavraInteira(texto: string, palavra: string): boolean {
  if (!palavra) return false;
  const escapada = palavra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escapada}(\\s|$)`).test(texto);
}

/**
 * Intelligent Matching Engine:
 * Cross-references raw bank transactions against pending condo notices (Avisos) and Fractions.
 */
export function matchBankTransactions(
  rawTransactions: Array<{
    data: string;
    tipo: "CREDITO" | "DEBITO";
    valor: number;
    descricao: string;
  }>,
  fracoes: Fracao[],
  avisosPendentes: Aviso[]
): ExtratoTransacao[] {
  return rawTransactions.map((tx, idx) => {
    const normDesc = normalizeBankText(tx.descricao);
    let matchedFracao: Fracao | null = null;
    let confidence = 0;
    let matchReason = "";
    let associatedAvisos: string[] = [];

    // Only credits are quotas payments
    if (tx.tipo === "CREDITO") {
      // 1. Look for direct fraction name or code (e.g. "rc esq", "3 dto", "fracao a", "rb23e")
      for (const f of fracoes) {
        const normFrac = normalizeBankText(f.fracao_nome);
        const normPiso = normalizeBankText(f.piso);
        const normOwner = normalizeBankText(f.proprietario?.nome || "");
        // Nomes de todos os coproprietários registados da fração — tanto os
        // coproprietários "a sério" (fracao.proprietarios_adicionais, com
        // ficha própria em Gestão de Frações) como titulares de contas
        // bancárias adicionais do proprietário principal (ex: cônjuge que
        // transfere a partir da sua própria conta). Sem isto, uma
        // transferência feita por qualquer um destes nunca era reconhecida,
        // mesmo já estando registado na fração. Cada nome é verificado
        // SEPARADAMENTE (nunca misturando palavras de nomes de pessoas
        // diferentes no mesmo "every"), senão exigir as palavras de dois
        // nomes em simultâneo tornava hasOwnerName impossível de bater
        // certo quando só uma das pessoas transfere de cada vez.
        const normCoproprietarios = (f.proprietarios_adicionais || [])
          .map(p => normalizeBankText(p.nome || ""))
          .filter(Boolean);
        const normContasAdicionais = (f.proprietario?.contas_bancarias_adicionais || [])
          .map(c => normalizeBankText(c.titular || ""))
          .filter(Boolean);
        const titularesCandidatos = [normOwner, ...normCoproprietarios, ...normContasAdicionais].filter(Boolean);
        // Maior prefixo CONTÍGUO de cada nome (a partir do primeiro
        // carácter) encontrado no descritivo — cobre nomes cortados pelo
        // banco por limite de caracteres, mesmo a meio de uma palavra (ex:
        // "Teixeira" -> "Te"). Exige corresponder a partir do INÍCIO do
        // nome, nunca uma palavra qualquer solta a meio — bug confirmado em
        // produção: "Cristina" (de "Tânia Cristina ...") deu match com a
        // Fração B só por causa da proprietária "Cristina Cavaquinho"
        // partilhar esse primeiro nome, e "Pereira" (de "Catia Alexandra
        // PEREIRA Teixeira Palma") deu match com a Fração A só por causa de
        // "Maria Irene PEREIRA Bilreiro" partilhar esse apelido — nomes e
        // apelidos comuns nunca chegam sozinhos para identificar ninguém.
        const prefixoContiguoMaisLongo = (nomeCompleto: string): number => {
          for (let len = nomeCompleto.length; len >= 6; len--) {
            if (normDesc.includes(nomeCompleto.slice(0, len))) return len;
          }
          return 0;
        };
        const prefixosPorTitular = titularesCandidatos.map(nome => ({ nome, prefixo: prefixoContiguoMaisLongo(nome) }));

        // Check exact fraction code match (e.g., "3º Dto" -> "3 dto", "RC Esq" -> "rc esq")
        // — como palavra inteira, nunca substring solta (ver contemPalavraInteira).
        //
        // Exige pelo menos 2 caracteres: um código de fração de 1 letra só
        // (ex: "A", "E", "O" — há prédios com frações A a P) continua a
        // aparecer sozinho como token dentro da própria notação bancária
        // portuguesa de transferências — "TRF. P/O <nome>" normaliza para
        // "trf p o <nome>", em que "o" surge sempre como palavra isolada
        // (o próprio "Por Ordem"), mesmo com a verificação por palavra
        // inteira. Bug confirmado em produção: 3 condóminos diferentes
        // (Tânia Cristina Mateus, Sofia Alexandra Santos Moura, André
        // Filipe) foram todos cruzados com 99% de confiança contra a mesma
        // Fração O, só por causa do "P/O" do início de cada descrição — não
        // tinha nada a ver com a fração real de nenhum deles. Um código de
        // 1 letra nunca é suficientemente específico para servir de sinal
        // fiável sozinho; a correspondência por nome do proprietário
        // (hasOwnerName/hasOwnerPartial, abaixo) é que decide nesses casos.
        const hasFracName = normFrac.length > 1 && contemPalavraInteira(normDesc, normFrac);
        const hasPiso = normPiso.length > 1 && contemPalavraInteira(normDesc, normPiso);

        // Check owner (or additional co-owner) name matches — cada titular
        // candidato é testado à vez; basta UM deles bater certo sozinho.
        // "Completo" exige o prefixo contíguo cobrir o nome quase todo
        // (tolera só 1 carácter de folga, ex: um espaço a mais); "parcial"
        // exige pelo menos ~15 caracteres contíguos desde o início do nome
        // — o suficiente para cobrir nomes cortados pelo banco, mas nunca
        // um único nome próprio ou apelido comum partilhado por acaso com
        // outro proprietário.
        const hasOwnerName = prefixosPorTitular.some(({ nome, prefixo }) => nome.length >= 6 && prefixo >= nome.length - 1);
        const hasOwnerPartial = prefixosPorTitular.some(({ prefixo }) => prefixo >= 15);

        // Referência individual da fração (ex: "BR23E-FR-K") — quando o
        // condómino a inclui no descritivo da transferência, é o sinal mais
        // fiável de todos: única por fração, sem ambiguidade nenhuma com
        // nomes ou notação bancária (ao contrário do código de fração de 1
        // letra ou de nomes parciais). Comparada como substring solta (não
        // "palavra inteira") porque o normalizeBankText remove os hífens —
        // "BR23E-FR-K" e "BR23EFRK" tornam-se ambos "br23e fr k"/"br23efrk"
        // consoante o condómino escrever com ou sem espaços, e a referência
        // já é suficientemente longa/específica para não dar falsos positivos.
        const normReferencia = normalizeBankText(f.referencia_br23e || "");
        const hasReferencia = normReferencia.length > 4 && normDesc.replace(/\s+/g, "").includes(normReferencia.replace(/\s+/g, ""));

        // Referência própria da Quota Extraordinária (ex: "BR23E-EXT-K") —
        // distinta da referência da Quota Ordinária acima; não fica
        // guardada na fração porque é gerada sempre da mesma forma
        // determinística, tal como o próprio fallback já usado para
        // referencia_br23e quando a fração ainda não a tem persistida.
        const normReferenciaExtra = normalizeBankText(gerarReferenciaBR23EExtra(f.fracao_nome, f.id_fracao));
        const hasReferenciaExtra = normDesc.replace(/\s+/g, "").includes(normReferenciaExtra.replace(/\s+/g, ""));

        // Find pending avisos for this fraction — do mais antigo (vencimento)
        // para o mais recente, para o pagamento fechar sempre os meses em
        // atraso há mais tempo primeiro.
        const fracaoAvisos = avisosPendentes
          .filter(a => a.id_fracao === f.id_fracao)
          .sort((a, b) => (a.vencimento || a.data).localeCompare(b.vencimento || b.data));
        const avisosCobertosPeloValor = selecionarAvisosCobertosPeloValor(fracaoAvisos, tx.valor);
        // exactAmountMatch só é true quando o valor pago corresponde MESMO à
        // soma de 1 ou mais meses consecutivos mais antigos — nunca por
        // coincidência com o total de todos os avisos pendentes somados
        // (esse caso só é resolvido manualmente, ver curConfidence = 80 abaixo).
        const exactAmountMatch = avisosCobertosPeloValor.length > 0;

        let curConfidence = 0;
        let curReason = "";

        if (hasReferencia || hasReferenciaExtra) {
          // Referência individual encontrada — identifica a fração sem
          // ambiguidade nenhuma, independentemente de o valor bater certo
          // ou não com algum mês em aberto (pode ser um pagamento
          // adiantado, ou de um valor que ainda não foi emitido em aviso).
          curConfidence = 100;
          curReason = hasReferenciaExtra
            ? `Referência da Quota Extraordinária (${gerarReferenciaBR23EExtra(f.fracao_nome, f.id_fracao)}) encontrada no descritivo — correspondência inequívoca.`
            : `Referência individual da fração (${f.referencia_br23e}) encontrada no descritivo — correspondência inequívoca.`;
        } else if ((hasFracName || hasPiso) && exactAmountMatch) {
          curConfidence = 99;
          curReason = `Correspondência total de Fração (${f.fracao_nome}) e Valor exato da quota (${tx.valor.toFixed(2)}€).`;
        } else if (hasOwnerName && exactAmountMatch) {
          curConfidence = 95;
          curReason = `Nome do Proprietário (${f.proprietario?.nome}) e Valor da quota (${tx.valor.toFixed(2)}€) correspondentes.`;
        } else if ((hasFracName || hasPiso) && !exactAmountMatch && fracaoAvisos.length > 0) {
          curConfidence = 80;
          curReason = `Fração (${f.fracao_nome}) identificada no descritivo, mas o valor não bate certo com nenhuma combinação de meses em aberto — escolhe à mão que mês(es) este pagamento cobre.`;
        } else if (hasOwnerPartial && exactAmountMatch) {
          curConfidence = 85;
          curReason = `Apelido do condómino e valor da quota (${tx.valor.toFixed(2)}€) coincidentes.`;
        } else if (hasOwnerName && !exactAmountMatch) {
          // Nome do proprietário/coproprietário encontrado por inteiro (sinal
          // tão forte como o código da fração) — mantém-se mesmo sem avisos
          // pendentes para esta fração (ex: pagamento adiantado, ou de um
          // valor que ainda não foi emitido em aviso nenhum). Antes exigia
          // sempre fracaoAvisos.length > 0, o que fazia o nome bater certo
          // sem efeito nenhum (confiança 0) sempre que a fração certa já
          // estava com tudo pago — e nesse caso, uma fração COMPLETAMENTE
          // diferente (sem nenhuma relação com o nome) podia ganhar só por
          // coincidência de valor (ver o ramo final, "Valor idêntico").
          curConfidence = 75;
          curReason = `Nome do Proprietário/Coproprietário (${f.proprietario?.nome}) identificado no descritivo${fracaoAvisos.length > 0 ? ", mas o valor não bate certo com nenhuma combinação de meses em aberto" : " — esta fração não tem avisos pendentes neste momento (pode ser um pagamento adiantado)"} — escolhe à mão como aplicar este pagamento.`;
        } else if (hasOwnerPartial && !exactAmountMatch) {
          // Mesma lógica do ramo anterior, mas para um nome só PARCIALMENTE
          // reconhecido (ex: apelido cortado pelo banco por limite de
          // caracteres, "...POMBO" em vez de "...POMBO DE SOUSA") — sinal
          // mais fraco do que o nome completo, mas ainda assim muito mais
          // fiável do que nenhum nome nenhum (ver ramo final).
          curConfidence = 55;
          curReason = `Nome parcial do Proprietário/Coproprietário (${f.proprietario?.nome}) identificado no descritivo (pode estar cortado pelo banco) — confirma a fração antes de aprovar.`;
        } else if (exactAmountMatch && fracaoAvisos.length > 0) {
          // Sinal mais fraco de todos — nenhuma referência nem nome bate
          // certo, só o valor coincide com uma quota pendente de ALGUMA
          // fração. Muito comum dar falsos positivos depois de uma revisão
          // de orçamento (várias frações passam a ter o mesmo valor
          // arredondado) — fica sempre abaixo do limiar de auto-confirmação,
          // nunca pré-seleciona uma fração sozinho sem o administrador
          // confirmar à mão.
          curConfidence = 45;
          curReason = `Valor idêntico à quota pendente da Fração ${f.fracao_nome}, sem nenhuma referência textual nem nome a confirmar — pode ser coincidência, confirma antes de aprovar.`;
        }

        if (curConfidence > confidence) {
          confidence = curConfidence;
          matchedFracao = f;
          matchReason = curReason;
          // Só entram aqui os avisos que o valor pago realmente cobre (ver
          // selecionarAvisosCobertosPeloValor) — no caso de confiança 80 (fração
          // identificada mas valor ambíguo) fica vazio de propósito, para o
          // administrador escolher à mão na UI em vez de se arriscar a marcar
          // o mês errado como pago.
          associatedAvisos = avisosCobertosPeloValor.map(a => a.id_aviso);
        }
      }
    } else {
      confidence = 50;
      matchReason = "Movimento de Débito (Despesa bancária ou pagamento a fornecedor).";
    }

    return {
      id_transacao: `tx-bank-${idx + 1}-${Date.now().toString(36)}`,
      data: tx.data,
      tipo: tx.tipo,
      valor: tx.valor,
      descricao: tx.descricao,
      fracao_sugerida_id: matchedFracao?.id_fracao || null,
      fracao_sugerida_nome: matchedFracao?.fracao_nome || null,
      confianca_percent: confidence,
      motivo_correspondencia: matchReason || "Pendente de validação manual pela administração",
      avisos_pendentes_ids: associatedAvisos,
      estado_conciliacao: "PENDENTE"
    };
  });
}
