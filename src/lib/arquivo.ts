import { supabase } from "./supabase";

export async function guardarNoArquivo({
  pdfBuffer,
  ano,
  tema,
  tipo,
  predio,
  fracao,
  fluxo,
  nomeFicheiro
}) {
  const caminho = `${ano}/${tema}/${tipo}/${predio}/${fracao}/${fluxo}/${nomeFicheiro}`;

  const { data, error } = await supabase.storage
    .from("documentos")
    .upload(caminho, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true
    });

  if (error) throw error;
  return caminho;
}
