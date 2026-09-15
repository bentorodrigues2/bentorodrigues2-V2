import { supabase } from "./supabaseServer.js";

/**
 * Modelos de email editáveis em Definições que correspondem mesmo a um
 * envio automático real com texto fixo (os restantes 18 ou já têm conteúdo
 * dinâmico gerado por IA — ex. convocatória de assembleia — onde ler um
 * modelo estático seria uma regressão, ou não têm nenhum envio automático
 * real por trás ainda).
 */
export const TEMPLATES_LIGADOS_A_ENVIOS_REAIS = new Set([
  "aviso_cobranca",
  "lembrete_quota",
  "aviso_divida",
  "recibo_pagamento"
]);

/**
 * Vai buscar o modelo personalizado deste prédio, se o administrador tiver
 * editado algum em Definições. Devolve null se nunca foi personalizado —
 * nesse caso o chamador usa o texto por omissão embutido no código.
 */
export async function obterModeloEmail(idPredio, templateId) {
  if (!idPredio || !templateId) return null;
  try {
    const { data, error } = await supabase
      .from("email_templates")
      .select("subject, body")
      .eq("id_predio", idPredio)
      .eq("template_id", templateId)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch (err) {
    console.warn(`[emailTemplates] Aviso ao ler o modelo "${templateId}":`, err?.message || err);
    return null;
  }
}

/**
 * Substitui os placeholders "[Nome]", "[Fração]", etc. pelos valores reais
 * fornecidos — mesma sintaxe usada na pré-visualização em Definições
 * (ConfiguracoesAdministracao.tsx, getTemplatePreview). Um placeholder sem
 * valor correspondente é removido, em vez de aparecer literalmente no email.
 */
export function interpolarModeloEmail(texto, valores) {
  let resultado = texto || "";
  const mapa = {
    Nome: valores.nome,
    "Fração": valores.fracao,
    Valor: valores.valor,
    Data: valores.data,
    "Método": valores.metodo,
    X: valores.x,
    "Assinatura Digital": valores.assinatura || "",
    "Assinatura Original": valores.assinatura || "",
    AQUI: "em anexo"
  };
  for (const [chave, valor] of Object.entries(mapa)) {
    resultado = resultado.replace(new RegExp(`\\[${chave}\\]`, "g"), valor != null ? String(valor) : "");
  }
  return resultado;
}
