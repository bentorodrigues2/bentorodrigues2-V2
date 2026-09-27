import { Fracao, Aviso, ExtratoTransacao } from "../types";

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
        const ownerFirstLast = normOwner.split(" ").filter(w => w.length > 2);

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
        
        // Check owner name matches
        const hasOwnerName = ownerFirstLast.length >= 2 && ownerFirstLast.every(namePart => normDesc.includes(namePart));
        const hasOwnerPartial = ownerFirstLast.some(namePart => normDesc.includes(namePart));

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

        if ((hasFracName || hasPiso) && exactAmountMatch) {
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
        } else if (exactAmountMatch && fracaoAvisos.length > 0) {
          curConfidence = 65;
          curReason = `Valor idêntico à quota pendente da Fração ${f.fracao_nome}, sem referência textual explícita.`;
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
