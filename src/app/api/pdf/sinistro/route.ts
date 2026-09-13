import { gerarDocumentoPDF } from "../_base";

export async function POST(req) {
  const body = await req.json();

  return gerarDocumentoPDF({
    conteudo: body.conteudo,
    ano: body.ano,
    tema: "Seguros",
    tipo: "Sinistro",
    predio: body.predio,
    fracao: body.fracao,
    fluxo: "sinistro",
    emailDestino: body.email,
    nomeFicheiro: "sinistro" + "_" + body.ano + ".pdf"
  });
}
