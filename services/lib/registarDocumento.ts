import { supabase } from "./supabase";

export async function registarDocumento({
  caminho,
  ano,
  tema,
  tipo,
  predio,
  fracao,
  fluxo,
  origem
}) {
  const { data, error } = await supabase
    .from("documentos")
    .insert({
      caminho,
      ano,
      tema,
      tipo,
      predio,
      fracao,
      fluxo,
      origem,
      created_at: new Date().toISOString()
    });

  if (error) throw error;

  return data;
}
