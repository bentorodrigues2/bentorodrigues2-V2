import { gerarDocumentoPDF } from "../_base";

export async function POST(req) {
  const body = await req.json();

  return gerarDocumentoPDF({
    conteudo: body.conteudo,
    ano: body.ano,
    tema: "Avisos",
    tipo: "Aviso",
    predio: body.predio,
    fracao: body.fracao,
    fluxo: "aviso",
    emailDestino: body.email,
    nomeFicheiro: "aviso" + "_" + body.ano + ".pdf"
  });
}
