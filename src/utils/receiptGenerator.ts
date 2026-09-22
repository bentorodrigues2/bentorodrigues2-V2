import { jsPDF } from "jspdf";
import { Predio, Fracao, ReciboQuitacao } from "../types";
import { downloadBlob } from "../utils";
import { LOGO_HORIZONTAL_BASE64, WATERMARK_BASE64 } from "../assets/logoBase64";

const COR_DARK_SLATE: [number, number, number] = [11, 20, 38]; // #0B1426
const COR_TEAL: [number, number, number] = [13, 148, 136]; // #0D9488
const COR_AMBAR: [number, number, number] = [194, 65, 12]; // #C2410C
const COR_MAGENTA: [number, number, number] = [190, 24, 93]; // #BE185D
const COR_SLATE_BORDA: [number, number, number] = [160, 172, 190]; // um pouco mais escuro que #CBD5E1, para as molduras não ficarem impercetíveis

function formatDataPT(iso?: string): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}-${mes}-${ano}`;
}

/** Deriva o prefixo do edifício (ex.: "BR2") e o sequencial (ex.: "00195") de id_recibo ("BR2 00195") */
function partirReciboNum(idRecibo: string): { prefixo: string; sequencial: string } {
  const partes = idRecibo.trim().split(/\s+/);
  if (partes.length >= 2) {
    return { prefixo: partes[0], sequencial: partes.slice(1).join(" ") };
  }
  return { prefixo: idRecibo, sequencial: "" };
}

function categoriaRubrica(tipo: string): { sigla: string; label: string; cor: [number, number, number] } {
  if (tipo === "Quota Ordinária") return { sigla: "QM", label: "QUOTA MENSAL", cor: COR_TEAL };
  if (tipo === "Fundo Comum de Reserva") return { sigla: "FR", label: "FUNDO RESERVA", cor: COR_AMBAR };
  if (tipo === "Quota Extraordinária") return { sigla: "QE", label: "QUOTA EXTRA", cor: COR_MAGENTA };
  return { sigla: "OT", label: "OUTRO", cor: [100, 116, 139] };
}

/**
 * Gera o Recibo de Pagamento (ou Nota de Cobrança) oficial em A5 paisagem,
 * conforme especificação institucional: numeração BR2 00195, movimentos
 * MOV-2026-QM/FR/QE-<num>, marca de água a 8%, e as menções legais
 * obrigatórias (isenção de IVA, quitação, DL 268/94).
 */
export function generateOfficialReceiptPDF(
  recibo: ReciboQuitacao,
  predio: Predio,
  fracao?: Fracao
): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 148mm
  const tipoDocumento: "recibo" | "nota_cobranca" = (recibo as any).tipoDocumento || "recibo";
  const { prefixo, sequencial } = partirReciboNum(recibo.id_recibo);

  // Marca de água central, opacidade 8%
  try {
    const wm = WATERMARK_BASE64;
    if (wm && wm.length > 50) {
      const gState = (doc as any).GState ? new (doc as any).GState({ opacity: 0.08 }) : null;
      if (gState) (doc as any).setGState(gState);
      doc.addImage(wm, "PNG", pageWidth / 2 - 40, pageHeight / 2 - 40, 80, 80);
      if (gState) (doc as any).setGState(new (doc as any).GState({ opacity: 1.0 }));
    }
  } catch {
    // marca de água é só decorativa, nunca deve impedir a geração do documento
  }

  // Logótipo principal (2.5:1, 45x18mm) — topo esquerdo
  try {
    if (LOGO_HORIZONTAL_BASE64 && LOGO_HORIZONTAL_BASE64.length > 100) {
      doc.addImage(LOGO_HORIZONTAL_BASE64, "PNG", 12, 7, 45, 18);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("CondoManager AI", 12, 16);
    }
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("CondoManager AI", 12, 16);
  }

  // Bloco superior direito (fundo dark slate)
  const blocoX = 118;
  const blocoW = pageWidth - blocoX - 12;
  doc.setFillColor(...COR_DARK_SLATE);
  doc.roundedRect(blocoX, 7, blocoW, 20, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  const tituloDoc = tipoDocumento === "nota_cobranca" ? `NOTA DE COBRANÇA Nº: ${recibo.id_recibo}` : `RECIBO DE PAGAMENTO Nº: ${recibo.id_recibo}`;
  doc.text(tituloDoc, blocoX + 4, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Data de Pagamento: ${formatDataPT(recibo.data_pagamento)}`, blocoX + 4, 18.5);

  const numerosMovimentos = recibo.rubricas
    .map((r) => `MOV-${recibo.ano}-${categoriaRubrica(r.tipo).sigla}-${recibo.id_recibo}`)
    .join(", ");
  const numerosMovimentosCurto = numerosMovimentos.length > 46 ? `${numerosMovimentos.slice(0, 43)}...` : numerosMovimentos;
  doc.setFontSize(6.5);
  doc.text(`Nºs Movimentos: ${numerosMovimentosCurto}`, blocoX + 4, 23.5);

  let y = 34;

  // Duas caixas: Condomínio (emissor) e Liquidado por (condómino) — a caixa
  // do condómino tem de conter obrigatoriamente Nome, Morada, Fração, NIF,
  // Referência e Método de Pagamento, por isso ambas as caixas são um pouco
  // mais altas do que a versão anterior (que só tinha 4 linhas).
  const colW = (pageWidth - 24 - 6) / 2;
  const boxH = 36;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(12, y, colW, boxH, 2, 2, "F");
  doc.setDrawColor(...COR_SLATE_BORDA);
  doc.roundedRect(12, y, colW, boxH, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COR_TEAL);
  doc.text("CONDOMÍNIO DO EDIFÍCIO:", 15, y + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text((predio.nome || "Condomínio").toUpperCase(), 15, y + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Morada: ${predio.morada_linha1 || ""}${predio.num_porta ? `, ${predio.num_porta}` : ""}, ${predio.localidade || ""}`, 15, y + 16);
  doc.text(`NIF: ${predio.nif || ""} • Email: ${predio.email_condominio || predio.email || ""}`, 15, y + 20.5);
  doc.text(`IBAN: ${recibo.iban_predio || predio.iban || "—"}`, 15, y + 25);

  const col2X = 12 + colW + 6;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(col2X, y, colW, boxH, 2, 2, "F");
  doc.setDrawColor(...COR_SLATE_BORDA);
  doc.roundedRect(col2X, y, colW, boxH, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COR_TEAL);
  // "Liquidado por" só se aplica ao Recibo (pagamento já confirmado) — a
  // Nota de Cobrança é uma identificação de quem deve pagar, o valor ainda
  // não foi liquidado.
  doc.text(tipoDocumento === "recibo" ? "LIQUIDADO POR (PROPRIETÁRIO / FRAÇÃO):" : "PROPRIETÁRIO / FRAÇÃO:", col2X + 3, y + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(recibo.nome_condomino, col2X + 3, y + 11);

  const moradaCondomino =
    (recibo as any).morada_condomino ||
    `${predio.morada_linha1 || ""}${predio.num_porta ? `, ${predio.num_porta}` : ""}, ${predio.codigo_postal ? `${predio.codigo_postal} ` : ""}${predio.localidade || ""}`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Morada: ${moradaCondomino}`, col2X + 3, y + 15.5);
  doc.text(`Fração: ${recibo.fracao_nome}${fracao?.piso ? ` (${fracao.piso})` : ""}`, col2X + 3, y + 19.5);
  doc.text(`NIF: ${recibo.nif_condomino || "—"}`, col2X + 3, y + 23.5);
  // Referência individual da fração, usada pelo motor de IA para conciliação automática via extrato
  doc.text(`Referência: ${prefixo}-FRA-${recibo.fracao_nome}`, col2X + 3, y + 27.5);
  // Na Nota de Cobrança o valor ainda não foi pago, por isso não faz
  // sentido afirmar um "Método de Pagamento" (dá a entender que já foi
  // pago dessa forma) — mostra antes o valor que falta pagar. Só o Recibo,
  // que confirma um pagamento já ocorrido, mostra o método usado.
  doc.text(
    tipoDocumento === "recibo"
      ? `Método de Pagamento: ${recibo.metodo_pagamento}`
      : `Valor a Pagar: ${recibo.valor_total.toFixed(2)} €`,
    col2X + 3,
    y + 31.5
  );

  y += boxH + 6;

  // Tabela de rubricas
  const tableW = pageWidth - 24;
  doc.setFillColor(...COR_DARK_SLATE);
  doc.rect(12, y, tableW, 6.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text("Nº MOVIMENTO", 15, y + 4.3);
  doc.text("DESCRITIVO DO CONCEITO / QUOTA", 62, y + 4.3);
  doc.text("CATEGORIA", 140, y + 4.3);
  doc.text("VALOR (€)", pageWidth - 15, y + 4.3, { align: "right" });

  y += 6.5;

  recibo.rubricas.forEach((rubrica, index) => {
    const cat = categoriaRubrica(rubrica.tipo);
    const numeroMovimento = `MOV-${recibo.ano}-${cat.sigla}-${recibo.id_recibo}`;
    const isEven = index % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(12, y, tableW, 7, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.3);
    doc.setTextColor(15, 23, 42);
    doc.text(numeroMovimento, 15, y + 4.5);

    doc.text(rubrica.descricao, 62, y + 4.5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...cat.cor);
    doc.text(cat.label, 140, y + 4.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(`${rubrica.valor.toFixed(2)} €`, pageWidth - 15, y + 4.5, { align: "right" });

    y += 7;
  });

  // Isenção de IVA + Total
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(80, 94, 115);
  doc.text("Isento de I.V.A. nos termos do artº 9º do nº21 do CIVA", 15, y + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COR_TEAL);
  doc.text(`TOTAL DO RECIBO: ${recibo.valor_total.toFixed(2)} €`, pageWidth - 15, y + 5.5, { align: "right" });

  y += 10;

  // Declaração de quitação — só se aplica ao Recibo (comprovativo legal de
  // pagamento); a Nota de Cobrança é meramente informativa, ainda não houve
  // pagamento confirmado, por isso não pode ter esta menção.
  if (tipoDocumento === "recibo") {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.3);
    doc.setTextColor(71, 85, 105);
    doc.text(
      "O presente documento serve de comprovativo oficial de pagamento para todos os efeitos legais, comprovando a liquidação dos valores discriminados.",
      15,
      y + 4
    );
    y += 10;
  } else {
    y += 4;
  }

  // Assinatura
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text("A ADMINISTRAÇÃO DO CONDOMÍNIO", pageWidth - 15, y, { align: "right" });

  const adminSig = (recibo as any).adminSignatureBase64;
  const adminNome = (recibo as any).adminNome || recibo.emitido_por || "José Carlos Guerra (Administrador do Condomínio)";

  if (adminSig && typeof adminSig === "string" && adminSig.startsWith("data:image")) {
    try {
      doc.addImage(adminSig, "PNG", pageWidth - 55, y + 2, 40, 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text(`Assinado Digitalmente: ${adminNome}`, pageWidth - 15, y + 14, { align: "right" });
    } catch {
      doc.setDrawColor(...COR_SLATE_BORDA);
      doc.line(pageWidth - 60, y + 8, pageWidth - 15, y + 8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(30, 41, 59);
      doc.text(adminNome, pageWidth - 15, y + 12, { align: "right" });
    }
  } else {
    doc.setDrawColor(...COR_SLATE_BORDA);
    doc.line(pageWidth - 60, y + 8, pageWidth - 15, y + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(30, 41, 59);
    doc.text(adminNome, pageWidth - 15, y + 12, { align: "right" });
  }

  // Rodapé de autenticidade
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8);
  doc.setTextColor(115, 128, 148);
  doc.text(
    `Emitido via CondoManager AI • Documento nº ${recibo.id_recibo} • Autenticidade Digital Garantida`,
    12,
    pageHeight - 5
  );

  return doc;
}

/** Nome de ficheiro normalizado conforme o tipo de documento (recibo vs nota de cobrança) */
export function nomeFicheiroRecibo(recibo: ReciboQuitacao): string {
  const tipoDocumento: "recibo" | "nota_cobranca" = (recibo as any).tipoDocumento || "recibo";
  const idSeguro = recibo.id_recibo.replace(/\s+/g, "_");
  return tipoDocumento === "nota_cobranca"
    ? `Nota_de_Cobranca_Mensal_${idSeguro}.pdf`
    : `Recibo_de_Pagamento_${idSeguro}.pdf`;
}

export function downloadOfficialReceiptPDF(
  recibo: ReciboQuitacao,
  predio: Predio,
  fracao?: Fracao
) {
  try {
    const doc = generateOfficialReceiptPDF(recibo, predio, fracao);
    const blob = doc.output("blob");
    downloadBlob(blob, nomeFicheiroRecibo(recibo));
  } catch (error) {
    console.error("Erro ao descarregar Recibo Oficial PDF:", error);
    alert("Ocorreu um erro ao gerar o Recibo Oficial em PDF.");
  }
}
