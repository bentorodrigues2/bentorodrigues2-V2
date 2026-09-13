import { gerarDocumentoPDF } from "../_base";

export async function POST(req) {
  const body = await req.json();

  return gerarDocumentoPDF({
    conteudo: body.conteudo,
    ano: body.ano,
    tema: "SCIE",
    tipo: "Relatório SCIE",
    predio: body.predio,
    fracao: body.fracao,
    fluxo: "scie",
    emailDestino: body.email,
    nomeFicheiro: "scie" + "_" + body.ano + ".pdf"
  });
}
