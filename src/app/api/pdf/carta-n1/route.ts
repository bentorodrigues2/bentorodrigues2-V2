import { gerarDocumentoPDF } from "../_base";

export async function POST(req) {
  const body = await req.json();

  return gerarDocumentoPDF({
    conteudo: body.conteudo,
    ano: body.ano,
    tema: "Comunicações",
    tipo: "Carta N1",
    predio: body.predio,
    fracao: body.fracao,
    fluxo: "carta_n1",
    emailDestino: body.email,
    nomeFicheiro: "carta-n1" + "_" + body.ano + ".pdf"
  });
}
