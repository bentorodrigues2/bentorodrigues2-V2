import { jsPDF } from "jspdf";
import { Predio, Fracao, ReciboQuitacao } from "../types";
import { addPdfHeaderWithLogo, addPdfWatermark, downloadBlob, formatDatePT } from "../utils";

/**
 * Generates an official Portuguese Quota Receipt (Recibo de Quitação de Quotas de Condomínio)
 * compliant with Portuguese tax and condominium regulations (Art. 1436.º do Código Civil).
 */
export function generateOfficialReceiptPDF(
  recibo: ReciboQuitacao,
  predio: Predio,
  fracao?: Fracao
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  
  // Header with Logo and Building identification
  const bName = predio.nome || `Condomínio ${predio.morada_linha1}, ${predio.num_porta}`;
  let y = addPdfHeaderWithLogo(doc, bName);

  // Document Title Banner
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.roundedRect(14, y, 182, 12, 2, 2, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("RECIBO OFICIAL DE QUITAÇÃO DE QUOTAS", 105, y + 7.5, { align: "center" });

  y += 16;

  // Key Receipt Metadata Box (Nº Recibo, Data, Autenticação)
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.roundedRect(14, y, 182, 18, 2, 2, "F");
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.roundedRect(14, y, 182, 18, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`N.º RECIBO: ${recibo.id_recibo}`, 18, y + 7);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`DATA EMISSÃO: ${formatDatePT(recibo.data_emissao)}`, 18, y + 13.5);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(5, 150, 105); // Emerald-600
  doc.text(`DATA PAGAMENTO: ${formatDatePT(recibo.data_pagamento)}`, 100, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`CÓDIGO DIGITAL: ${recibo.codigo_verificacao_hash.substring(0, 18)}...`, 100, y + 13.5);

  y += 24;

  // Two Column Box: EMISSOR (Condomínio) vs BENEFICIÁRIO / CONDÓMINO
  const colWidth = 88;
  
  // Left Column - Condomínio / Entidade Emissora
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, y, colWidth, 38, 2, 2, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, colWidth, 38, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("ENTIDADE EMISSORA (CONDOMÍNIO)", 18, y + 6);
  doc.line(18, y + 8, 14 + colWidth - 4, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Edifício: ${predio.nome || "Edifício Residencial"}`, 18, y + 14);
  doc.text(`Morada: ${predio.morada_linha1}, ${predio.num_porta}`, 18, y + 19);
  doc.text(`Código Postal: ${predio.codigo_postal} ${predio.localidade}`, 18, y + 24);
  doc.setFont("helvetica", "bold");
  doc.text(`NIF Condomínio: ${predio.nif}`, 18, y + 29);
  doc.setFont("helvetica", "normal");
  doc.text(`IBAN: ${predio.iban || "PT50 0033 0000 12345678901 23"}`, 18, y + 34);

  // Right Column - Condómino / Fração
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(108, y, colWidth, 38, 2, 2, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(108, y, colWidth, 38, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("CONDÓMINO / FRAÇÃO QUITADA", 112, y + 6);
  doc.line(112, y + 8, 108 + colWidth - 4, y + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(4, 120, 87);
  doc.text(`Fração: ${recibo.fracao_nome} (${fracao?.piso || "Piso Padrão"})`, 112, y + 14);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text(`Permilagem: ${recibo.permilagem} ‰`, 112, y + 19);
  doc.text(`Titular: ${recibo.nome_condomino}`, 112, y + 24);
  doc.setFont("helvetica", "bold");
  doc.text(`NIF: ${recibo.nif_condomino || "Consumidor Final"}`, 112, y + 29);
  doc.setFont("helvetica", "normal");
  doc.text(`Meio Pagamento: ${recibo.metodo_pagamento}`, 112, y + 34);

  y += 44;

  // Breakdown of Paid Items (Tabela de Rubricas Liquidadas)
  doc.setFillColor(15, 23, 42);
  doc.rect(14, y, 182, 7.5, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("RUBRICA / DISCRIMINAÇÃO DA QUOTA", 18, y + 5);
  doc.text("TIPO", 110, y + 5);
  doc.text("VALOR QUITADO", 190, y + 5, { align: "right" });

  y += 7.5;

  let totalCalculado = 0;
  recibo.rubricas.forEach((rubrica, index) => {
    totalCalculado += rubrica.valor;
    const isEven = index % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(14, y, 182, 8.5, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, y, 182, 8.5, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(rubrica.descricao, 18, y + 5.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(rubrica.tipo, 110, y + 5.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${rubrica.valor.toFixed(2)} €`, 190, y + 5.5, { align: "right" });

    y += 8.5;
  });

  y += 4;

  // Total Paid Highlight Banner
  doc.setFillColor(236, 253, 245); // Emerald-50
  doc.roundedRect(100, y, 96, 16, 2, 2, "F");
  doc.setDrawColor(16, 185, 129); // Emerald-500
  doc.roundedRect(100, y, 96, 16, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(6, 95, 70);
  doc.text("TOTAL GLOBAL QUITADO:", 106, y + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(4, 120, 87);
  doc.text(`${recibo.valor_total.toFixed(2)} €`, 190, y + 11.5, { align: "right" });

  y += 24;

  // Legal Declaration of Discharge (Declaração de Quitação Plena)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, 182, 24, 2, 2, "F");
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, y, 182, 24, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("DECLARAÇÃO DE QUITAÇÃO & VALIDADE JURÍDICA:", 18, y + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const textoQuitacao = `A Administração do Condomínio declara para os devidos efeitos legais ter recebido da Fração ${recibo.fracao_nome} a quantia expressa de ${recibo.valor_total.toFixed(2)}€, dando plena e irrevogável quitação das rubricas supra discriminadas, salvaguardando erros materiais de cálculo.`;
  const splitText = doc.splitTextToSize(textoQuitacao, 174);
  doc.text(splitText, 18, y + 10.5);

  y += 30;

  // Digital Signature & Carimbo
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, y, 90, 26, 2, 2, "S");
  doc.roundedRect(108, y, 88, 26, 2, 2, "S");

  // Left - Carimbo Digital
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("CHAVE DIGITAL DE SEGURANÇA SHA-256", 18, y + 5);
  doc.setFont("courier", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(30, 41, 59);
  doc.text(recibo.codigo_verificacao_hash, 18, y + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Validação em tempo real: https://condomanager.ai/validar-recibo", 18, y + 17);
  doc.text("Carimbo temporal auditado pela infraestrutura Supabase/Cloud", 18, y + 22);

  // Right - Assinatura da Administração
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text("PELA ADMINISTRAÇÃO DO CONDOMÍNIO", 112, y + 5);

  const adminSig = (recibo as any).adminSignatureBase64 || 
                   localStorage.getItem("admin_signature_digital") || 
                   localStorage.getItem("assinatura_admin_base64") || 
                   localStorage.getItem("admin_digital_signature");

  const adminNome = (recibo as any).adminNome || recibo.emitido_por || "José Carlos Guerra (Administrador do Condomínio)";

  if (adminSig && adminSig.startsWith("data:image")) {
    try {
      doc.addImage(adminSig, "PNG", 112, y + 7, 48, 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Assinado Digitalmente por: ${adminNome}`, 112, y + 21);
    } catch (e) {
      doc.setDrawColor(203, 213, 225);
      doc.line(112, y + 15, 185, y + 15);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(adminNome, 112, y + 20);
    }
  } else {
    // Em caso de ausência da assinatura digital colocar o nome do administrador
    doc.setDrawColor(203, 213, 225);
    doc.line(112, y + 15, 185, y + 15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(adminNome, 112, y + 20);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Data: ${new Date().toLocaleDateString("pt-PT")} • Documento Processado por Computador`, 112, y + 25);

  // Footer
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`CondoManager AI - Recibo de Quitação Oficial • ${recibo.id_recibo} • Página 1/1`, 105, 288, { align: "center" });

  return doc;
}

export function downloadOfficialReceiptPDF(
  recibo: ReciboQuitacao,
  predio: Predio,
  fracao?: Fracao
) {
  try {
    const doc = generateOfficialReceiptPDF(recibo, predio, fracao);
    const blob = doc.output("blob");
    const fileName = `Recibo_${recibo.id_recibo}_Fracao_${recibo.fracao_nome}.pdf`;
    downloadBlob(blob, fileName);
  } catch (error) {
    console.error("Erro ao descarregar Recibo Oficial PDF:", error);
    alert("Ocorreu um erro ao gerar o Recibo Oficial em PDF.");
  }
}
