import { gerarPDF } from "@/lib/pdf";
import { guardarNoArquivo } from "@/lib/arquivo";
import { registarDocumento } from "@/lib/registarDocumento";
import { enviarEmailPDF } from "@/lib/email";

export async function gerarDocumentoPDF({
  conteudo,
  ano,
  tema,
  tipo,
  predio,
  fracao,
  fluxo,
  emailDestino,
  nomeFicheiro
}) {
  const pdfBuffer = await gerarPDF(conteudo);

  const caminho = await guardarNoArquivo({
    pdfBuffer,
    ano,
    tema,
    tipo,
    predio,
    fracao,
    fluxo,
    nomeFicheiro
  });

  await registarDocumento({
    caminho,
    ano,
    tema,
    tipo,
    predio,
    fracao,
    fluxo,
    origem: "gemini_auto_pdf"
  });

  if (emailDestino) {
    await enviarEmailPDF({
      to: emailDestino,
      assunto: `Novo documento: ${tipo}`,
      mensagem: "<p>Segue em anexo o documento.</p>",
      pdfBuffer,
      nome: nomeFicheiro
    });
  }

  return { caminho };
}
