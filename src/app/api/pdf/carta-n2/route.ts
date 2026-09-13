import { gerarDocumentoPDF } from "../_base";

export async function POST(req) {
  const body = await req.json();

  return gerarDocumentoPDF({
    conteudo: body.conteudo,
    ano: body.ano,
    tema: "Comunicações",
    tipo: "Carta N2",
    predio: body.predio,
    fracao: body.fracao,
    fluxo: "carta_n2",
    emailDestino: body.email,
    nomeFicheiro: "carta-n2" + "_" + body.ano + ".pdf"
  });
}
