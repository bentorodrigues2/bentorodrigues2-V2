import { jsPDF } from "jspdf";
import { supabase } from "./supabaseServer.js";

/**
 * Gera um PDF real a partir de texto simples (jsPDF funciona em Node sem
 * DOM/canvas para texto). O Gemini gera texto, não PDFs binários — por
 * isso a geração do ficheiro em si é sempre feita aqui.
 */
function gerarPDFBuffer(conteudo, titulo) {
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

    const linhas = doc.splitTextToSize(paragrafo, maxWidth);
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

  return Buffer.from(doc.output("arraybuffer"));
}

async function guardarNoArquivo({ pdfBuffer, ano, tema, tipo, predio, fracao, fluxo, nomeFicheiro }) {
  const caminho = `${ano}/${tema}/${tipo}/${predio}/${fracao}/${fluxo}/${nomeFicheiro}`;

  const { error } = await supabase.storage
    .from("documentos")
    .upload(caminho, pdfBuffer, { contentType: "application/pdf", upsert: true });

  if (error) throw error;
  return caminho;
}

async function registarDocumento({ caminho, ano, tema, tipo, predio, fracao, fluxo, origem, nomeFicheiro }) {
  const { error } = await supabase.from("documentos").insert({
    id_doc: `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    id_predio: predio,
    nome: nomeFicheiro,
    caminho,
    ano,
    tema,
    tipo,
    predio,
    fracao,
    fluxo,
    origem,
    created_at: new Date().toISOString()
  });

  if (error) throw error;
}

async function enviarEmailPDF({ to, assunto, mensagem, pdfBuffer, nome }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || !to) return;

  const fromEmail = process.env.EMAIL_FROM_ADDRESS || "administracao@condomanagerai.com";
  const fromAddress = fromEmail.includes("<") ? fromEmail : `Condomínio <${fromEmail}>`;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
    body: JSON.stringify({
      from: fromAddress,
      to: [to],
      subject: assunto,
      html: mensagem,
      attachments: [{ filename: nome, content: pdfBuffer.toString("base64") }]
    })
  });

  if (!resp.ok) {
    console.error("[pdfService] Erro ao enviar email:", resp.status, await resp.text());
  }
}

/**
 * Gera o PDF, arquiva-o no Supabase Storage, regista o documento e (se
 * emailDestino for fornecido) envia-o por email.
 */
export async function gerarDocumentoPDF({ conteudo, ano, tema, tipo, predio, fracao, fluxo, emailDestino, nomeFicheiro }) {
  const pdfBuffer = gerarPDFBuffer(conteudo, tipo);

  const caminho = await guardarNoArquivo({ pdfBuffer, ano, tema, tipo, predio, fracao, fluxo, nomeFicheiro });

  await registarDocumento({ caminho, ano, tema, tipo, predio, fracao, fluxo, origem: "gemini_auto_pdf", nomeFicheiro });

  if (emailDestino) {
    await enviarEmailPDF({
      to: emailDestino,
      assunto: `Novo documento: ${tipo}`,
      mensagem: `<p>Segue em anexo o documento: <strong>${tipo}</strong>.</p>`,
      pdfBuffer,
      nome: nomeFicheiro
    });
  }

  return { caminho };
}

export default gerarDocumentoPDF;
