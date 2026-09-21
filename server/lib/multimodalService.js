import { generateWithFallback } from "../geminiService.js";
import { supabase } from "./supabaseServer.js";
import { sanitizarSegmentoStorage, sanitizarNomeFicheiro } from "./storageUtils.js";

const PROMPT_EXTRACAO = `
Analisa o(s) documento(s) anexo(s) (comprovativos, faturas, recibos, extratos,
avisos de débito direto). Os anexos podem conter MAIS DE UM DOCUMENTO
FINANCEIRO DISTINTO (ex: dois comprovativos de pagamentos diferentes, ou uma
fatura e um comprovativo separados) — trata cada documento financeiro
distinto como um item à parte. Um documento de várias páginas (ex: um PDF
com 2 páginas do MESMO comprovativo) continua a ser um único item. Ignora
anexos que não sejam documentos financeiros (ex: logótipos, assinaturas,
imagens decorativas).

Para CADA documento financeiro distinto encontrado, extrai:
- entidade (quem emitiu)
- valor_total (número, sem símbolo de moeda)
- data_documento (YYYY-MM-DD)
- referencia (nº fatura, nº recibo, etc.)
- tipo_documento (um de: "comprovativo", "fatura", "recibo", "extrato", "debito_direto")
- categoria_contabilistica (categoria de despesa/receita mais provável)
- ordenante_nome (nome de quem ordenou/pagou a transferência — campo "Cliente" ou "Ordenante", só em comprovativos de transferência bancária; null se não aplicável)
- ordenante_iban (IBAN de quem ordenou/pagou, do campo "Dados do Ordenante"/"IBAN" — remove espaços; null se não aplicável)
- descritivo_transferencia (o texto exato do campo "Descritivo"/"Descritivo para a conta destino"/referência que o ordenante escreveu na transferência — costuma identificar a fração, ex: "1esq"; null se não aplicável)
- entidade_credora (nome da entidade credora/beneficiária, campo "Entidade credora" — só em avisos de débito direto; null se não aplicável)
- iban_credor (IBAN da entidade credora, remove espaços — só em avisos de débito direto; null se não aplicável)
- referencia_credor (o campo "Referência do credor" tal como aparece; null se não aplicável)
- numero_adc (o campo "Número da ADC" — identifica o contrato/cliente específico deste débito direto, é o dado mais fiável para saber a que fornecedor/contrato pertence, já que o IBAN do credor costuma ser partilhado por todos os clientes dessa entidade; null se não aplicável)

Responde em JSON estrito, sem texto à volta, com um ARRAY na base — um
objeto por documento financeiro distinto encontrado (mesmo que só haja um,
devolve ainda assim um array com um único elemento).
`.trim();

/**
 * Chama o Gemini multimodal sobre os anexos (cada um com base64 + mimeType)
 * e devolve um array com os dados estruturados de cada documento financeiro
 * distinto encontrado (normalmente um por anexo, mas pode ser menos se o
 * Gemini agrupar páginas do mesmo documento, ou mais se um único anexo
 * tiver várias faturas digitalizadas juntas).
 */
export async function extrairDadosDocumento(anexos) {
  if (!Array.isArray(anexos) || anexos.length === 0) return [];

  const parts = [
    { text: PROMPT_EXTRACAO },
    ...anexos.map((ax) => ({
      inlineData: { mimeType: ax.mimeType, data: ax.base64 }
    }))
  ];

  const content = await generateWithFallback({
    contents: [{ role: "user", parts }],
    responseMimeType: "application/json"
  });

  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    // Apesar do prompt pedir sempre um array, o Gemini por vezes devolve um
    // único objeto na mesma (sobretudo quando só há mesmo um documento) —
    // todo o código chamador itera sobre um array, por isso embrulha-se
    // sempre um objeto solto, e filtram-se entradas vazias/inválidas.
    const lista = Array.isArray(parsed) ? parsed : [parsed];
    return lista.filter((item) => item && typeof item === "object");
  } catch (e) {
    console.warn("[multimodalService] Resposta do Gemini não é JSON válido:", content);
    return [];
  }
}

const PROMPT_EXTRATO = `
És o assistente financeiro da administração de um condomínio. Foi-te dado um
extrato bancário (documento anexo em PDF/imagem e/ou texto colado de um
ficheiro CSV/Excel/TXT exportado do homebanking). O objetivo é ajudar a
lançar rapidamente o histórico de movimentos de um condomínio na
transição/arranque da gestão, sem erros de transcrição manual.

Extrai TODOS os movimentos/transações que conseguires identificar no
documento, um por linha do extrato (não agregues nem resumas). Para cada
movimento devolve:
- data (formato YYYY-MM-DD; se só houver dia/mês, assume o ano mais plausível pelo contexto do documento)
- descricao (o texto da transação tal como aparece, o mais fiel possível — nome do beneficiário/ordenante, referência, etc.)
- valor (número positivo, sem símbolo de moeda, sem sinal negativo)
- tipo ("Receita" se for uma entrada/crédito na conta, "Despesa" se for uma saída/débito)
- categoria (a categoria de despesa/receita mais provável a partir da descrição, ex: "Manutenção", "Limpeza", "Quotas", "Seguros", "Eletricidade", "Água", "Honorários", "Outro")
- entidade_credora (nome da entidade credora/beneficiária de uma despesa/débito direto, se identificável separadamente da descrição; null se não aplicável)
- iban_credor (IBAN da entidade credora, remove espaços, só se o documento o mostrar explicitamente — ex: avisos de débito direto; null se não aplicável)
- numero_adc (o "Número da ADC"/referência de contrato que identifica este cliente específico junto da entidade credora, ex: em débitos diretos de eletricidade/água/gás — é mais fiável que o IBAN para saber a que fornecedor/contrato pertence, já que o IBAN de uma utility é partilhado por todos os clientes; null se não aplicável)

Ignora linhas que sejam só cabeçalhos, saldos de abertura/fecho ou totais —
extrai apenas movimentos individuais reais.

Responde em JSON estrito, sem texto à volta, no formato:
{ "movimentos": [ { "data": "AAAA-MM-DD", "descricao": "...", "valor": 0.00, "tipo": "Receita", "categoria": "...", "entidade_credora": null, "iban_credor": null, "numero_adc": null } ] }
`.trim();

/**
 * Lê um extrato bancário (PDF/imagem anexados e/ou texto de CSV/Excel/TXT já
 * convertido para texto no cliente) e devolve uma lista de movimentos
 * estruturados, para pré-preencher o Passo 3 (Movimentos Históricos) do
 * Assistente de Arranque em vez de o administrador ter de os transcrever
 * um a um à mão.
 */
export async function extrairMovimentosExtrato({ anexos, textoExtrato }) {
  const parts = [{ text: PROMPT_EXTRATO }];
  if (textoExtrato && String(textoExtrato).trim()) {
    parts.push({ text: `\n--- CONTEÚDO DO FICHEIRO (CSV/Excel/TXT) ---\n${String(textoExtrato).slice(0, 100000)}` });
  }
  if (Array.isArray(anexos)) {
    for (const ax of anexos) {
      if (ax?.base64 && ax?.mimeType) {
        parts.push({ inlineData: { mimeType: ax.mimeType, data: ax.base64 } });
      }
    }
  }
  if (parts.length === 1) return null;

  const content = await generateWithFallback({
    contents: [{ role: "user", parts }],
    responseMimeType: "application/json"
  });

  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    if (!parsed || !Array.isArray(parsed.movimentos)) return null;
    return parsed.movimentos;
  } catch (e) {
    console.warn("[multimodalService] Resposta do Gemini (extrato) não é JSON válido:", content);
    return null;
  }
}

/**
 * Arquiva o ficheiro ORIGINAL recebido (não gerado por nós) no bucket
 * "documentos" e regista-o na tabela documentos, tal como pdfService.js
 * faz para os PDFs gerados — mas aqui para o anexo tal como chegou.
 */
export async function arquivarAnexoOriginal({ buffer, filename, mimeType, ano, mes, tema, tipo, predio, fracao, fornecedor, fluxo, origem, categoria, visibilidade, descricao, subPasta }) {
  const anoSeguro = ano || new Date().getFullYear();
  const nomeSeguro = sanitizarNomeFicheiro(filename);
  // "mes" organiza os Comprovativos de Transferências por ano/mês; "fornecedor"
  // organiza as Faturas de Fornecedor pelo nome do fornecedor em vez de por
  // fração (que não faz sentido para uma fatura, que não pertence a uma
  // fração específica) — ambos opcionais para não quebrar chamadores antigos.
  const segmentos = [anoSeguro, mes, tema, tipo, fornecedor, predio || "geral", fracao || "geral", fluxo]
    .filter(Boolean)
    .map(sanitizarSegmentoStorage);
  const pastas = segmentos.join("/");
  const caminho = `${pastas}/${nomeSeguro}`;

  const { error: errUpload } = await supabase.storage
    .from("documentos")
    .upload(caminho, buffer, { contentType: mimeType || "application/octet-stream", upsert: true });

  if (errUpload) throw errUpload;

  const { error: errInsert } = await supabase.from("documentos").insert({
    id_doc: `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    id_predio: predio || null,
    nome: filename,
    caminho,
    ano: anoSeguro,
    tema,
    tipo,
    predio,
    fracao,
    fornecedor: fornecedor || null,
    sub_pasta: subPasta || fornecedor || null,
    fluxo,
    origem: origem || "email_inbound_anexo",
    categoria: categoria || null,
    visibilidade: visibilidade || null,
    descricao: descricao || null,
    created_at: new Date().toISOString()
  });

  if (errInsert) throw errInsert;

  return caminho;
}
