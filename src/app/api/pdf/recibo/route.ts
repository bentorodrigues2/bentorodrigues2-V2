import { gerarDocumentoPDF } from "../_base";

export async function POST(req) {
  const body = await req.json();

  return gerarDocumentoPDF({
    conteudo: body.conteudo,
    ano: body.ano,
    tema: "Financeiro",
    tipo: "Recibo",
    predio: body.predio,
    fracao: body.fracao,
    fluxo: "recibo",
    emailDestino: body.email,
    nomeFicheiro: "recibo" + "_" + body.ano + ".pdf"
  });
}
