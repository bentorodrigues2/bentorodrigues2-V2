import { gerarDocumentoPDF } from "../_base";

export async function POST(req) {
  const body = await req.json();

  return gerarDocumentoPDF({
    conteudo: body.conteudo,
    ano: body.ano,
    tema: "Assembleias",
    tipo: "Convocatória",
    predio: body.predio,
    fracao: body.fracao,
    fluxo: "convocatoria",
    emailDestino: body.email,
    nomeFicheiro: "convocatoria" + "_" + body.ano + ".pdf"
  });
}
