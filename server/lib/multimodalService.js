import { generateWithFallback } from "../geminiService.js";
import { supabase } from "./supabaseServer.js";
import { sanitizarSegmentoStorage, sanitizarNomeFicheiro } from "./storageUtils.js";

const PROMPT_EXTRACAO = `
Analisa o(s) documento(s) anexo(s) (comprovativos, faturas, recibos, extratos).
Extrai:
- entidade (quem emitiu)
- valor_total (número, sem símbolo de moeda)
- data_documento (YYYY-MM-DD)
- referencia (nº fatura, nº recibo, etc.)
- tipo_documento (um de: "comprovativo", "fatura", "recibo", "extrato")
- categoria_contabilistica (categoria de despesa/receita mais provável)
- ordenante_nome (nome de quem ordenou/pagou a transferência — campo "Cliente" ou "Ordenante", só em comprovativos de transferência bancária; null se não aplicável)
- ordenante_iban (IBAN de quem ordenou/pagou, do campo "Dados do Ordenante"/"IBAN" — remove espaços; null se não aplicável)
- descritivo_transferencia (o texto exato do campo "Descritivo"/"Descritivo para a conta destino"/referência que o ordenante escreveu na transferência — costuma identificar a fração, ex: "1esq"; null se não aplicável)
Responde em JSON estrito, sem texto à volta.
`.trim();

/**
 * Chama o Gemini multimodal sobre os anexos (cada um com base64 + mimeType)
 * e devolve os dados estruturados extraídos.
 */
export async function extrairDadosDocumento(anexos) {
  if (!Array.isArray(anexos) || anexos.length === 0) return null;

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
    return typeof content === "string" ? JSON.parse(content) : content;
  } catch (e) {
    console.warn("[multimodalService] Resposta do Gemini não é JSON válido:", content);
    return null;
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

Ignora linhas que sejam só cabeçalhos, saldos de abertura/fecho ou totais —
extrai apenas movimentos individuais reais.

Responde em JSON estrito, sem texto à volta, no formato:
{ "movimentos": [ { "data": "AAAA-MM-DD", "descricao": "...", "valor": 0.00, "tipo": "Receita", "categoria": "..." } ] }
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
export async function arquivarAnexoOriginal({ buffer, filename, mimeType, ano, tema, tipo, predio, fracao, fluxo, origem, categoria, visibilidade, descricao }) {
  const anoSeguro = ano || new Date().getFullYear();
  const nomeSeguro = sanitizarNomeFicheiro(filename);
  const pastas = [anoSeguro, tema, tipo, predio || "geral", fracao || "geral", fluxo]
    .map(sanitizarSegmentoStorage)
    .join("/");
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
