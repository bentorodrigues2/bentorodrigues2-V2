import { gerarDocumentoPDF } from "../_base";

export async function POST(req) {
  const body = await req.json();

  return gerarDocumentoPDF({
    conteudo: body.conteudo,
    ano: body.ano,
    tema: "Assembleias",
    tipo: "Ata",
    predio: body.predio,
    fracao: body.fracao,
    fluxo: "ata",
    emailDestino: body.email,
    nomeFicheiro: "ata" + "_" + body.ano + ".pdf"
  });
}
