import { jsPDF } from "jspdf";
import { supabase } from "./supabaseServer.js";
import { gerarHtmlResposta } from "./htmlemail.js";
import { sanitizarSegmentoStorage } from "./storageUtils.js";

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

export async function guardarNoArquivo({ pdfBuffer, ano, tema, tipo, predio, fracao, fluxo, nomeFicheiro }) {
  // Só as pastas passam pelo sanitizador (a Storage API rejeita espaços/acentos
  // na chave) — o nome do ficheiro já vem seguro dos geradores (sem espaços).
  const pastas = [ano, tema, tipo, predio, fracao, fluxo].map(sanitizarSegmentoStorage).join("/");
  const caminho = `${pastas}/${nomeFicheiro}`;

  const { error } = await supabase.storage
    .from("documentos")
    .upload(caminho, pdfBuffer, { contentType: "application/pdf", upsert: true });

  if (error) throw error;
  return caminho;
}

/**
 * "categoria" e "visibilidade" não são cosméticos — o Arquivo Digital
 * (GestaoDocumentos.tsx) usa-os para decidir em que pasta um documento
 * aparece e quem o pode ver (ex.: pasta "Pasta Paga. Quotas", ou os manuais
 * PWA identificados por categoria "Instruções PWA & Desktop"). Omiti-los
 * deixava os documentos gerados aqui a aparecer só por acaso, via
 * correspondência solta ao campo "tipo".
 */
export async function registarDocumento({ caminho, ano, tema, tipo, predio, fracao, fluxo, origem, nomeFicheiro, categoria, visibilidade }) {
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
    categoria: categoria || null,
    visibilidade: visibilidade || null,
    created_at: new Date().toISOString()
  });

  if (error) throw error;
}

/**
 * Envia o PDF por email sempre com o template institucional (logótipo,
 * texto humanizado, assinatura) — nunca um email "nu" com o anexo solto.
 */
export async function enviarEmailPDF({ to, nomeDestinatario, assunto, mensagem, pdfBuffer, nome, cc }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || !to) return;

  const fromEmail = process.env.EMAIL_FROM_ADDRESS || "administracao@condomanagerai.com";
  const fromAddress = fromEmail.includes("<") ? fromEmail : `Condomínio <${fromEmail}>`;

  const html = gerarHtmlResposta(nomeDestinatario || "Condómino(a)", mensagem);

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
    body: JSON.stringify({
      from: fromAddress,
      to: [to],
      ...(cc ? { cc: [cc] } : {}),
      subject: assunto,
      html,
      attachments: [{ filename: nome, content: pdfBuffer.toString("base64") }]
    })
  });

  if (!resp.ok) {
    console.error("[pdfService] Erro ao enviar email:", resp.status, await resp.text());
  }
}

/**
 * Gera o PDF (a partir de texto simples), arquiva-o no Supabase Storage,
 * regista o documento e (se emailDestino for fornecido) envia-o por email
 * com o template institucional. Para documentos com layout legal próprio
 * (ex. recibo oficial via receiptGenerator.js), monta o buffer à parte e
 * usa só guardarNoArquivo/registarDocumento/enviarEmailPDF diretamente.
 */
export async function gerarDocumentoPDF({ conteudo, ano, tema, tipo, predio, fracao, fluxo, emailDestino, nomeDestinatario, nomeFicheiro, categoria, visibilidade }) {
  const pdfBuffer = gerarPDFBuffer(conteudo, tipo);

  const caminho = await guardarNoArquivo({ pdfBuffer, ano, tema, tipo, predio, fracao, fluxo, nomeFicheiro });

  await registarDocumento({ caminho, ano, tema, tipo, predio, fracao, fluxo, origem: "gemini_auto_pdf", nomeFicheiro, categoria, visibilidade: visibilidade || "Público" });

  if (emailDestino) {
    await enviarEmailPDF({
      to: emailDestino,
      nomeDestinatario,
      assunto: `Novo documento: ${tipo}`,
      mensagem: `Segue em anexo o seu documento: <strong>${tipo}</strong>.`,
      pdfBuffer,
      nome: nomeFicheiro
    });
  }

  return { caminho };
}

export default gerarDocumentoPDF;
