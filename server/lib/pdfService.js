import { jsPDF } from "jspdf";
import { supabase } from "./supabaseServer.js";
import { gerarHtmlResposta } from "./htmlemail.js";
import { sanitizarSegmentoStorage } from "./storageUtils.js";
import { addPdfHeaderWithLogo } from "./pdfDocs.js";

/**
 * Gera um PDF real a partir de texto simples (jsPDF funciona em Node sem
 * DOM/canvas para texto). O Gemini gera texto, não PDFs binários — por
 * isso a geração do ficheiro em si é sempre feita aqui. Usa o mesmo
 * cabeçalho de marca (logótipo CondoManager AI centrado + nome do prédio)
 * dos restantes documentos oficiais, gerado a partir de src/utils.ts.
 */
function gerarPDFBuffer(conteudo, titulo, predioNome) {
  // "mm" (não "pt") porque addPdfHeaderWithLogo desenha o logótipo e o
  // nome do prédio com coordenadas fixas assumindo uma página A4 de 210mm.
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const marginX = 14;
  const marginBottom = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;
  const lineHeight = 5.5;
  const marginTop = addPdfHeaderWithLogo(doc, predioNome) + 4;

  let y = marginTop;

  if (titulo) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(titulo, marginX, y);
    y += lineHeight * 1.6;
  }

  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

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
export async function gerarDocumentoPDF({ conteudo, ano, tema, tipo, predio, predioNome, fracao, fluxo, emailDestino, nomeDestinatario, nomeFicheiro, categoria, visibilidade }) {
  // Identificador único do documento — sem isto, o email genérico "Novo
  // documento: X" não permitia ao destinatário referenciar/localizar o
  // documento específico (ex. em caso de reclamação sobre o seu conteúdo).
  const anoRef = ano || new Date().getFullYear();
  const idDocumento = `${String(tipo || "DOC").toUpperCase().replace(/\s+/g, "-").normalize("NFD").replace(/[̀-ͯ]/g, "")}-${anoRef}-${String(Date.now()).slice(-5)}`;

  const pdfBuffer = gerarPDFBuffer(conteudo, `${tipo} — Documento Nº ${idDocumento}`, predioNome);

  const caminho = await guardarNoArquivo({ pdfBuffer, ano, tema, tipo, predio, fracao, fluxo, nomeFicheiro });

  await registarDocumento({ caminho, ano, tema, tipo, predio, fracao, fluxo, origem: "gemini_auto_pdf", nomeFicheiro, categoria, visibilidade: visibilidade || "Público" });

  if (emailDestino) {
    const saudacaoNome = nomeDestinatario || "Condómino(a)";
    const notaSigla = /\bSCIE\b/i.test(tipo || "")
      ? " (SCIE = Segurança Contra Incêndio em Edifícios)"
      : "";
    await enviarEmailPDF({
      to: emailDestino,
      nomeDestinatario,
      assunto: `Novo documento: ${tipo} (Nº ${idDocumento})`,
      mensagem: `Caro(a) <strong>${saudacaoNome}</strong>, segue em anexo o seu documento <strong>${tipo}</strong>${notaSigla}, identificado com o número <strong>${idDocumento}</strong>.`,
      pdfBuffer,
      nome: nomeFicheiro
    });
  }

  return { caminho };
}

export default gerarDocumentoPDF;
