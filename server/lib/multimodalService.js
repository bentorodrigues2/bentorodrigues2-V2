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
