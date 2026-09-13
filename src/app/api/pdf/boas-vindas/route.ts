import { gerarDocumentoPDF } from "../_base";

export async function POST(req) {
  const body = await req.json();

  return gerarDocumentoPDF({
    conteudo: body.conteudo,
    ano: body.ano,
    tema: "Comunicações",
    tipo: "Boas-vindas",
    predio: body.predio,
    fracao: body.fracao,
    fluxo: "boas_vindas",
    emailDestino: body.email,
    nomeFicheiro: "boas-vindas" + "_" + body.ano + ".pdf"
  });
}
