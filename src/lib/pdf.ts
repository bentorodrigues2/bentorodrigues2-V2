import { jsPDF } from "jspdf";

/**
 * Gera um PDF real a partir de texto simples (jsPDF funciona em Node sem
 * DOM/canvas para texto). O Gemini gera texto, não PDFs binários — por
 * isso a geração do ficheiro em si é sempre feita aqui, nunca pelo Gemini.
 */
export async function gerarPDF(conteudo: string, titulo?: string): Promise<Buffer> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const marginX = 48;
  const marginTop = 56;
  const marginBottom = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;
  const lineHeight = 16;

  let y = marginTop;

  if (titulo) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(titulo, marginX, y);
    y += lineHeight * 1.5;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const paragrafos = String(conteudo || "").split(/\n+/);

  for (const paragrafo of paragrafos) {
    if (!paragrafo.trim()) {
      y += lineHeight * 0.5;
      continue;
    }

    const linhas: string[] = doc.splitTextToSize(paragrafo, maxWidth);
    for (const linha of linhas) {
      if (y > pageHeight - marginBottom) {
        doc.addPage();
        y = marginTop;
      }
      doc.text(linha, marginX, y);
      y += lineHeight;
    }
    y += lineHeight * 0.5;
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
