import { jsPDF } from "jspdf";
import { Predio, GestorCarteira, Fracao, Reuniao, Fornecedor } from "./types";
import { 
  LOGO_HORIZONTAL_BASE64, 
  WATERMARK_BASE64, 
  getLogoHorizontalBase64, 
  getWatermarkBase64 
} from "./assets/logoBase64";
import { BIRTHDAY_WATERMARK_BASE64 } from "./assets/birthdayWatermarkBase64";

// Helper to draw subtle background watermark on PDF pages
export function addPdfWatermark(doc: jsPDF) {
  try {
    const wm = (typeof window !== "undefined" && (window as any).__WATERMARK_B64) || WATERMARK_BASE64;
    if (wm && wm.length > 50) {
      try {
        const gState = (doc as any).GState ? new (doc as any).GState({ opacity: 0.08 }) : null;
        if (gState) (doc as any).setGState(gState);
        doc.addImage(wm, "PNG", 45, 65, 120, 120);
        if (gState) {
          const resetState = new (doc as any).GState({ opacity: 1.0 });
          (doc as any).setGState(resetState);
        }
      } catch (e) {
        doc.addImage(wm, "PNG", 45, 65, 120, 120);
      }
    }
  } catch (err) {
    console.warn("Watermark render notice:", err);
  }
}

// Helper to draw top-centered CondoManager AI horizontal logo in dark pill container with building name
export function addPdfHeaderWithLogo(doc: jsPDF, buildingName?: string): number {
  addPdfWatermark(doc);
  try {
    const logo = (typeof window !== "undefined" && (window as any).__LOGO_B64) || LOGO_HORIZONTAL_BASE64;
    if (logo && logo.length > 100) {
      doc.addImage(logo, "PNG", 70, 7, 70, 16);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("CONDOMANAGER AI", 105, 16, { align: "center" });
    }
  } catch (e) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("CONDOMANAGER AI", 105, 16, { align: "center" });
  }

  if (buildingName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const text = buildingName.toUpperCase().startsWith("CONDOMÍNIO") 
      ? buildingName 
      : `CONDOMÍNIO ${buildingName.toUpperCase()}`;
    doc.text(text, 105, 27, { align: "center" });
    return 32;
  }

  return 28; // Return Y start position for document content
}

export const formatDatePT = (dateStr: string | undefined): string => {
  if (!dateStr) return "";
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  }
  return dateStr;
};

export const formatDateISO = (datePTStr: string | undefined): string => {
  if (!datePTStr) return "";
  const parts = datePTStr.split('-');
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return datePTStr;
  }
  return datePTStr;
};

export function downloadBlob(blob: Blob, fileName: string) {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (err) {
    console.error("Erro ao descarregar ficheiro:", err);
  }
}

export function exportToXLS(filename: string, headers: string[], rows: string[][]) {
  let csvContent = "\uFEFF"; // BOM for Portuguese characters
  csvContent += headers.join(";") + "\n";
  rows.forEach(row => {
    csvContent += row.map(v => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v).join(";") + "\n";
  });
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const finalName = filename.endsWith(".xls") || filename.endsWith(".csv") ? filename : `${filename}.xls`;
  downloadBlob(blob, finalName);
}

export function generateAndDownloadPdf(
  title: string,
  sections: { heading?: string; content: string | string[] }[],
  fileName: string,
  metadata?: { label: string; value: string }[]
) {
  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    // Top Header: Logo centered at top (NO BARS)
    let y = addPdfHeaderWithLogo(doc);

    doc.setTextColor(15, 23, 42); // Slate 900

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const titleLines = doc.splitTextToSize(title, 180);
    doc.text(titleLines, 105, y, { align: "center" });
    y += (titleLines.length * 6) + 4;

    // Metadata box
    if (metadata && metadata.length > 0) {
      const boxHeight = Math.max(18, Math.ceil(metadata.length / 2) * 6 + 4);
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, boxHeight, "F");
      doc.setDrawColor(203, 213, 225);
      doc.rect(14, y, 182, boxHeight, "S");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      let metaY = y + 5;
      metadata.forEach((m, idx) => {
        const xPos = idx % 2 === 0 ? 18 : 108;
        doc.text(`${m.label}: ${m.value}`, xPos, metaY);
        if (idx % 2 === 1 || idx === metadata.length - 1) metaY += 5.5;
      });
      y += boxHeight + 8;
    }

    // Body Sections
    for (const sec of sections) {
      if (y > 265) {
        doc.addPage();
        addPdfWatermark(doc);
        y = 20;
      }

      if (sec.heading) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(4, 120, 87);
        doc.text(sec.heading, 14, y);
        y += 6;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);

      const items = Array.isArray(sec.content) ? sec.content : [sec.content];
      for (const item of items) {
        if (y > 265) {
          doc.addPage();
          addPdfWatermark(doc);
          y = 20;
        }
        const lines = doc.splitTextToSize(item, 180);
        doc.text(lines, 14, y);
        y += (lines.length * 4.2) + 2;
      }
      y += 4;
    }

    // Footer
    if (y > 265) {
      doc.addPage();
      addPdfWatermark(doc);
      y = 20;
    }
    doc.setDrawColor(4, 120, 87);
    doc.line(14, y, 196, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(4, 120, 87);
    doc.text("CONDOMANAGER AI - REGISTO AUTÊNTICO E ARQUIVADO EM PDF", 105, y, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Emissão: ${new Date().toLocaleDateString('pt-PT')} | Certificado Digital Inviolável (Browser & PWA)`, 105, y + 4, { align: "center" });

    const finalPdfName = fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;
    const blob = doc.output("blob");
    downloadBlob(blob, finalPdfName);
  } catch (err) {
    console.error("Erro ao gerar PDF:", err);
  }
}

export function downloadDocHtml(title: string, htmlBody: string, fileName: string) {
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 30px; color: #0f172a; line-height: 1.5; position: relative; }
    .watermark { position: fixed; top: 30%; left: 25%; width: 320px; opacity: 0.08; pointer-events: none; z-index: -1; }
    h1 { color: #047857; font-size: 18px; border-bottom: 2px solid #047857; padding-bottom: 6px; }
    p, li { font-size: 11px; }
  </style>
</head>
<body>
  <div class="watermark"><img src="/marca/19-marca-dagua-logo-cinza-claro.png" width="320" alt="" /></div>
  ${fullHtmlBody(htmlBody)}
</body>
</html>`;
  const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
  const finalDocName = fileName.toLowerCase().endsWith(".doc") ? fileName : `${fileName}.doc`;
  downloadBlob(blob, finalDocName);
}

function fullHtmlBody(content: string): string {
  return content;
}

export function downloadEmailDocument(subject: string, from: string, to: string, bodyText: string, fileName: string) {
  const emlContent = `From: ${from}
To: ${to}
Subject: ${subject}
Date: ${new Date().toUTCString()}
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8

${bodyText}
`;
  const blob = new Blob([emlContent], { type: 'text/plain;charset=utf-8;' });
  const finalName = fileName.toLowerCase().endsWith(".eml") ? fileName : `${fileName}.eml`;
  downloadBlob(blob, finalName);
}

export function computeTransferCode(morada: string | undefined, numPorta: string | undefined, piso: string | undefined, fracao_nome: string | undefined): string {
  if (!morada) return "CONDOMINIO";
  const palavras = morada.split(/[\s,]+/);
  const ignorarArtigos = ["de", "do", "dos", "da", "das", "a", "o", "e"];
  const palavrasFiltradas = palavras.filter(p => p && !ignorarArtigos.includes(p.toLowerCase()));
  
  // Take initials of up to 2 words of the street (e.g., "Rua Bento" -> RB)
  const iniciais = palavrasFiltradas
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join("");
  
  const num = (numPorta || "").trim().replace(/[^0-9]/g, "");
  const p = (piso || "").trim().replace(/[^a-zA-Z0-9]/g, "");
  const f = (fracao_nome || "").trim().replace(/[^a-zA-Z0-9]/g, "");
  
  return `${iniciais}${num}${p}${f}`.toUpperCase();
}

export function copyTextToClipboard(text: string): boolean {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  } catch (err) {
    return false;
  }
}

export function downloadFichaCondominoVaziaPDF(
  predioNome: string = "Condomínio Activo", 
  morada: string = "", 
  initialData?: Record<string, string>
) {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // 1. Top Header: Logo centered at top (NO BARS)
    let y = addPdfHeaderWithLogo(doc);

    // Title
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("FICHA DE REGISTO DE CONDÓMINO / PROPRIETÁRIO", 105, y, { align: "center" });
    y += 7;

    // Building metadata box (Address ONLY - No building name)
    doc.setFillColor(248, 250, 252);
    doc.rect(14, y, 182, 10, "F");
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, y, 182, 10, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Morada do Edifício: ${morada || initialData?.morada_edificio || "Registo Oficial de Fração"} | Ano do Exercício: 2026`, 18, y + 6.5);

    y += 15;

    const drawBoxWithFields = (title: string, fields: { label: string; placeholder?: string; widthPct?: number; key?: string; value?: string }[]) => {
      if (title) {
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(4, 120, 87);
        doc.text(title, 14, y);
        y += 5;
      }

      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(255, 255, 255);

      let currentX = 14;
      const totalWidth = 182;

      fields.forEach(f => {
        const fieldW = (f.widthPct || 100) * totalWidth / 100;
        doc.rect(currentX, y, fieldW, 11, "S");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(f.label.toUpperCase(), currentX + 2.5, y + 3.5);

        const fieldKey = f.key || f.label.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
        const val = (initialData && initialData[fieldKey]) || f.value || "";

        if ((doc as any).AcroFormTextField) {
          try {
            const tf = new (doc as any).AcroFormTextField();
            tf.Rect = [currentX + 2, y + 4.2, fieldW - 4, 5.8];
            tf.multiline = false;
            tf.fieldName = fieldKey;
            tf.fontSize = 8;
            tf.fontName = "helvetica";
            tf.value = val;
            doc.addField(tf);
          } catch (e) {
            if (val || f.placeholder) {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(7.5);
              doc.setTextColor(15, 23, 42);
              doc.text(val || f.placeholder || "", currentX + 3, y + 8.5);
            }
          }
        } else if (val || f.placeholder) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(15, 23, 42);
          doc.text(val || f.placeholder || "", currentX + 3, y + 8.5);
        }

        currentX += fieldW;
      });

      y += 11;
    };

    // 1. DADOS DE IDENTIFICAÇÃO DA FRAÇÃO
    drawBoxWithFields("1. IDENTIFICAÇÃO DA FRAÇÃO AUTÓNOMA", [
      { label: "Morada do Edifício", key: "morada_edificio", placeholder: morada || "Rua / Avenida...", widthPct: 35 },
      { label: "Piso", key: "piso", placeholder: "Piso...", widthPct: 15 },
      { label: "Letra / Designação", key: "letra", placeholder: "Letra...", widthPct: 20 },
      { label: "Permilagem (‰)", key: "permilagem", placeholder: "ex: 125‰", widthPct: 15 },
      { label: "Tipologia", key: "tipologia", placeholder: "ex: T2", widthPct: 15 }
    ]);

    // 2. DADOS DO PROPRIETÁRIO PRINCIPAL
    drawBoxWithFields("2. DADOS DO PROPRIETÁRIO PRINCIPAL", [
      { label: "Nome Completo *", key: "prop_nome", placeholder: "Ex: José Carlos Alves Guerra", widthPct: 50 },
      { label: "NIF Fiscal *", key: "prop_nif", placeholder: "Ex: 221230475", widthPct: 25 },
      { label: "Telemóvel *", key: "prop_tlm", placeholder: "Ex: 912345678", widthPct: 25 }
    ]);

    drawBoxWithFields("", [
      { label: "E-mail Oficial *", key: "prop_email", placeholder: "Ex: jose@email.com", widthPct: 40 },
      { label: "IBAN de Origem", key: "prop_iban", placeholder: "PT50...", widthPct: 60 }
    ]);

    drawBoxWithFields("", [
      { label: "Titular da Conta Bancária", key: "prop_titular", placeholder: "Nome do titular...", widthPct: 40 },
      { label: "Entidade Bancária", key: "prop_banco", placeholder: "Ex: BPI, CGD, ActivoBank", widthPct: 35 },
      { label: "Fotografia de Perfil", key: "foto", placeholder: "[ Espaço p/ Foto ]", widthPct: 25 }
    ]);

    // 3. COPROPRIETÁRIOS ADICIONAIS
    drawBoxWithFields("3. COPROPRIETÁRIOS ADICIONAIS (SE APLICÁVEL)", [
      { label: "Nome Completo do Coproprietário", key: "coprop_nome", placeholder: "Ex: Ana Maria Guerra", widthPct: 45 },
      { label: "NIF Fiscal", key: "coprop_nif", placeholder: "Ex: 234567890", widthPct: 20 },
      { label: "E-mail", key: "coprop_email", placeholder: "ana@email.com", widthPct: 20 },
      { label: "Telemóvel", key: "coprop_tlm", placeholder: "919888777", widthPct: 15 }
    ]);

    // 4. A FRAÇÃO ENCONTRA-SE ARRENDADA? (S / N) + INQUILINO
    drawBoxWithFields("4. A FRAÇÃO ENCONTRA-SE ARRENDADA?", [
      { label: "Fração Arrendada?", key: "is_arrendada", placeholder: "NÃO / SIM", widthPct: 35 },
      { label: "Nome Completo do Arrendatário / Inquilino", key: "inq_nome", placeholder: "Nome do arrendatário...", widthPct: 65 }
    ]);

    drawBoxWithFields("", [
      { label: "NIF Fiscal do Arrendatário", key: "inq_nif", placeholder: "NIF...", widthPct: 25 },
      { label: "E-mail do Arrendatário", key: "inq_email", placeholder: "email@arrendatario.pt", widthPct: 40 },
      { label: "Telemóvel do Arrendatário", key: "inq_tlm", placeholder: "929887766", widthPct: 35 }
    ]);

    drawBoxWithFields("", [
      { label: "Morada de Residência Alternativa do Proprietário (Se Arrendada)", key: "prop_morada_alt", placeholder: "Morada habitual onde o proprietário residir...", widthPct: 100 }
    ]);

    // 5. DECLARAÇÃO E CONSENTIMENTO RGPD
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(4, 120, 87);
    doc.text("5. DECLARAÇÃO E CONSENTIMENTO RGPD", 14, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(51, 65, 85);
    const rgpdText = "Declaro sob compromisso de honra que as informações prestadas nesta ficha de cadastro são verdadeiras. Nos termos do Regulamento Geral sobre a Proteção de Dados (RGPD - UE 2016/679), dou o meu consentimento expresso para o tratamento dos meus dados pessoais (nome, NIF, e-mail, contactos, IBAN e dados de fração) pela Administração do Condomínio e pela plataforma CondoManager AI, exclusivamente para efeitos de gestão do edifício, cobrança de quotas, convocatórias e comunicações oficiais.";
    const rgpdLines = doc.splitTextToSize(rgpdText, 182);
    doc.text(rgpdLines, 14, y);
    y += (rgpdLines.length * 3) + 3;

    doc.setDrawColor(203, 213, 225);
    doc.rect(14, y, 182, 6, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    
    if ((doc as any).AcroFormCheckBox) {
      try {
        const cb = new (doc as any).AcroFormCheckBox();
        cb.Rect = [15, y + 0.8, 4.5, 4.5];
        cb.fieldName = "rgpd_consentimento";
        doc.addField(cb);
        doc.text("  Autorizo o tratamento dos meus dados pessoais nos termos da declaração RGPD acima descrita.", 21, y + 4);
      } catch (e) {
        doc.text("[   ] Autorizo o tratamento dos meus dados pessoais nos termos da declaração RGPD acima descrita.", 18, y + 4);
      }
    } else {
      doc.text("[   ] Autorizo o tratamento dos meus dados pessoais nos termos da declaração RGPD acima descrita.", 18, y + 4);
    }
    
    y += 9;

    // Signatures
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, y, 85, 16, "S");
    doc.rect(111, y, 85, 16, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("DATA DE PREENCHIMENTO", 18, y + 4.5);

    if ((doc as any).AcroFormTextField) {
      try {
        const tfData = new (doc as any).AcroFormTextField();
        tfData.Rect = [18, y + 6.5, 75, 7];
        tfData.fieldName = "data_preenchimento";
        tfData.value = initialData?.data_preenchimento || new Date().toLocaleDateString("pt-PT");
        doc.addField(tfData);

        const tfSig = new (doc as any).AcroFormTextField();
        tfSig.Rect = [115, y + 6.5, 75, 7];
        tfSig.fieldName = "assinatura_nome";
        tfSig.value = initialData?.assinatura_nome || "";
        doc.addField(tfSig);
      } catch (e) {
        doc.text(initialData?.data_preenchimento || "____ / ____ / 2026", 18, y + 11);
      }
    } else {
      doc.text(initialData?.data_preenchimento || "____ / ____ / 2026", 18, y + 11);
    }

    doc.text("ASSINATURA DO PROPRIETÁRIO / CONDÓMINO", 115, y + 4.5);

    const blob = doc.output("blob");
    downloadBlob(blob, "Ficha_Cadastro_Condomino_Em_Branco.pdf");
  } catch (err) {
    console.error("Erro ao gerar Ficha de Cadastro Vazia PDF:", err);
  }
}

export interface DynamicReportOptions {
  predio: any;
  ambito: "PREDIO" | "FRACAO" | "TODAS";
  fracaoId?: string;
  tipoRelatorio: "extrato_quotas" | "balancete" | "fichas_condominos" | "debitos_incumprimento" | "obras_manutencao" | "resumo_executivo";
  exercicio: string;
  fracoesList: any[];
  movimentosList?: any[];
  avisosList?: any[];
  incluirInquilinos?: boolean;
  incluirIbans?: boolean;
  incluirAssinatura?: boolean;
}

export function generateDynamicReportPDF(opts: DynamicReportOptions) {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const bName = opts.predio?.nome || opts.predio?.morada_linha1 || "Condomínio";
    let y = addPdfHeaderWithLogo(doc, bName);

    const titleMap: Record<string, string> = {
      extrato_quotas: "RELATÓRIO - EXTRATO DE QUOTAS & PAGAMENTOS",
      balancete: "RELATÓRIO - BALANCETE FINANCEIRO CONSOLIDADO",
      fichas_condominos: "RELATÓRIO - FICHAS & DADOS DE REGISTO",
      debitos_incumprimento: "RELATÓRIO - MAPA DE INCUMPRIMENTO & QUOTAS EM ATRASO",
      obras_manutencao: "RELATÓRIO - INTERVENÇÕES TÉCNICAS & VISTORIAS",
      resumo_executivo: "RELATÓRIO EXECUÇÃO E RESUMO GERAL DO EDIFÍCIO"
    };

    const targetTitle = titleMap[opts.tipoRelatorio] || "RELATÓRIO OFICIAL DO CONDOMÍNIO";

    // Title
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(targetTitle, 105, y, { align: "center" });
    y += 6;

    // Filter Banner Box
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 12, "F");
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, y, 182, 12, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(4, 120, 87);
    
    const targetFracao = opts.fracoesList.find(f => f.id_fracao === opts.fracaoId);
    const scopeText = opts.ambito === "PREDIO" ? `ÂMBITO: EDIFÍCIO CONSOLIDADO (${opts.predio.nome})` : opts.ambito === "FRACAO" ? `ÂMBITO: FRAÇÃO ESPECÍFICA (${targetFracao ? targetFracao.fracao_nome : "A"})` : `ÂMBITO: TODAS AS FRAÇÕES (${opts.fracoesList.length} UNIDADES)`;

    doc.text(scopeText, 18, y + 4.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(`EXERCÍCIO: ${opts.exercicio}  |  EMISSÃO: ${new Date().toLocaleDateString("pt-PT")}  |  EDIFÍCIO: ${opts.predio.nome}`, 18, y + 9);

    y += 18;

    // Filter list of fracoes based on ambito
    const scopeFracoes = opts.ambito === "FRACAO" && targetFracao ? [targetFracao] : opts.fracoesList;

    // Build Table Header
    doc.setFillColor(226, 232, 240);
    doc.rect(14, y, 182, 7, "F");
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, y, 182, 7, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text("FRAÇÃO", 17, y + 4.5);
    doc.text("PROPRIETÁRIO / CONTACTO", 45, y + 4.5);
    doc.text("PERMILAGEM", 110, y + 4.5);
    doc.text("QUOTA MENSAL", 140, y + 4.5);
    doc.text("ESTADO / SALDO", 170, y + 4.5);

    y += 7;

    let totalQuotas = 0;
    let totalDividas = 0;

    scopeFracoes.forEach((f, idx) => {
      if (y > 265) {
        doc.addPage();
        y = addPdfHeaderWithLogo(doc);
      }

      const rowBg = idx % 2 === 0 ? 255 : 248;
      doc.setFillColor(rowBg, rowBg, rowBg);
      doc.rect(14, y, 182, 8, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(14, y, 182, 8, "S");

      const quotaVal = ((opts.predio.orcamento_anual || 12000) * (f.permilagem / 1000) / 12);
      totalQuotas += quotaVal;

      const debt = (opts.avisosList || []).filter(a => a.id_fracao === f.id_fracao && a.estado === "Pendente").reduce((acc, c) => acc + c.valor, 0);
      totalDividas += debt;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`Fração ${f.fracao_nome} (${f.piso})`, 17, y + 5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(`${f.proprietario.nome} (${f.proprietario.tlm || f.proprietario.email})`, 45, y + 5);
      doc.text(`${f.permilagem}‰`, 110, y + 5);
      doc.text(`${quotaVal.toFixed(2)}€`, 140, y + 5);

      if (debt > 0) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(220, 38, 38);
        doc.text(`Em Dívida (${debt.toFixed(2)}€)`, 170, y + 5);
      } else {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(5, 150, 105);
        doc.text("Regularizado", 170, y + 5);
      }

      y += 8;
    });

    // Summary Totals Row
    y += 2;
    doc.setFillColor(236, 253, 245);
    doc.rect(14, y, 182, 9, "F");
    doc.setDrawColor(52, 211, 153);
    doc.rect(14, y, 182, 9, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(4, 120, 87);
    doc.text(`TOTAL SUMÁRIO (${scopeFracoes.length} FRAÇÃO/ÕES)`, 17, y + 5.5);
    doc.text(`Total Quotas: ${totalQuotas.toFixed(2)}€/mês`, 110, y + 5.5);
    
    if (totalDividas > 0) {
      doc.setTextColor(220, 38, 38);
      doc.text(`Total em Atraso: ${totalDividas.toFixed(2)}€`, 160, y + 5.5);
    } else {
      doc.setTextColor(5, 150, 105);
      doc.text(`Total em Atraso: 0.00€`, 160, y + 5.5);
    }

    y += 16;

    // Official Stamp / Signature block if requested
    if (opts.incluirAssinatura && y < 250) {
      doc.setDrawColor(203, 213, 225);
      doc.rect(14, y, 182, 18, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("EMISSÃO OFICIAL E CARIMBO DIGITAL DA ADMINISTRAÇÃO DO CONDOMÍNIO", 18, y + 4.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text(`Plataforma CondoManager AI — Certificação Digital Edifício ${opts.predio.nome}`, 18, y + 9);
      doc.text(`Carimbo Autenticado em: ${new Date().toLocaleString("pt-PT")}`, 18, y + 13.5);

      doc.setFont("helvetica", "bold");
      doc.text("ASSINATURA DA ADMINISTRAÇÃO", 130, y + 4.5);
      doc.setFont("helvetica", "italic");
      doc.text("__________________________________", 130, y + 13.5);
    }

    const blob = doc.output("blob");
    downloadBlob(blob, `Relatorio_${opts.tipoRelatorio}_${opts.ambito}_${opts.predio.nome.replace(/\s+/g, "_")}.pdf`);
  } catch (err) {
    console.error("Erro ao gerar relatório PDF dinâmico:", err);
  }
}

export function downloadFichaCondominoPreenchidaPDF(predioNome: string = "Condomínio Activo", fracao: any) {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Top Header: Logo centered at top (NO BARS)
    let y = addPdfHeaderWithLogo(doc);

    const prop = fracao?.proprietario || {};
    const inq = fracao?.inquilino || {};

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`FICHA DE REGISTO PREENCHIDA — FRAÇÃO ${fracao?.fracao_nome || "A"} (${fracao?.piso || ""})`, 105, y, { align: "center" });
    y += 7;

    doc.setFillColor(248, 250, 252);
    doc.rect(14, y, 182, 10, "F");
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, y, 182, 10, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Morada do Edifício: ${predioNome} | Permilagem: ${fracao?.permilagem || 0}‰ | Tipologia: ${fracao?.tipologia || "Residencial"}`, 18, y + 6.5);

    y += 15;

    const renderBoxValue = (title: string, fields: { label: string; val: string; widthPct?: number }[]) => {
      if (title) {
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(4, 120, 87);
        doc.text(title, 14, y);
        y += 5;
      }

      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(248, 250, 252);

      let currentX = 14;
      const totalWidth = 182;

      fields.forEach(f => {
        const fieldW = (f.widthPct || 100) * totalWidth / 100;
        doc.rect(currentX, y, fieldW, 12, "S");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(f.label.toUpperCase(), currentX + 3, y + 4);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(f.val || "—", currentX + 3, y + 9);

        currentX += fieldW;
      });

      y += 12;
    };

    renderBoxValue("1. DADOS DE IDENTIFICAÇÃO DA FRAÇÃO", [
      { label: "Morada do Edifício", val: predioNome, widthPct: 35 },
      { label: "Piso", val: fracao?.piso || "N/A", widthPct: 15 },
      { label: "Letra / Designação", val: fracao?.fracao_nome || "N/A", widthPct: 20 },
      { label: "Permilagem Legal (‰)", val: `${fracao?.permilagem || 0}‰`, widthPct: 15 },
      { label: "Tipologia", val: fracao?.tipologia || "T2", widthPct: 15 }
    ]);

    renderBoxValue("2. PROPRIETÁRIO PRINCIPAL REGISTADO", [
      { label: "Nome Completo *", val: prop.nome || "Não atribuído", widthPct: 50 },
      { label: "NIF Fiscal *", val: prop.nif || "—", widthPct: 25 },
      { label: "Telemóvel *", val: prop.telefone || "—", widthPct: 25 }
    ]);

    renderBoxValue("", [
      { label: "E-mail Oficial *", val: prop.email || "—", widthPct: 40 },
      { label: "IBAN de Origem", val: prop.iban || "—", widthPct: 60 }
    ]);

    renderBoxValue("", [
      { label: "Titular da Conta Bancária", val: prop.titular_iban || prop.nome || "—", widthPct: 40 },
      { label: "Entidade Bancária", val: prop.banco || "BPI / CGD", widthPct: 35 },
      { label: "Fotografia de Perfil", val: prop.foto ? "📷 Foto Carregada" : "Sem foto", widthPct: 25 }
    ]);

    renderBoxValue("3. COPROPRIETÁRIOS ADICIONAIS", [
      { label: "Nome do Coproprietário", val: prop.co_nome || "Nenhum coproprietário adicional", widthPct: 50 },
      { label: "NIF Fiscal", val: prop.co_nif || "—", widthPct: 25 },
      { label: "Telemóvel", val: prop.co_tlm || "—", widthPct: 25 }
    ]);

    renderBoxValue("4. FRAÇÃO ARRENDADA? (DADOS DO ARRENDATÁRIO / INQUILINO)", [
      { label: "Fração Arrendada?", val: fracao?.is_arrendada ? "SIM (Arrendada)" : "NÃO (Ocupada pelo Proprietário)", widthPct: 35 },
      { label: "Nome Completo do Arrendatário / Inquilino", val: fracao?.is_arrendada ? inq.nome || "Inquilino Registado" : "N/A", widthPct: 65 }
    ]);

    if (fracao?.is_arrendada) {
      renderBoxValue("", [
        { label: "NIF Fiscal do Arrendatário", val: inq.nif || "—", widthPct: 25 },
        { label: "E-mail do Arrendatário", val: inq.email || "—", widthPct: 40 },
        { label: "Telemóvel do Arrendatário", val: inq.telefone || "—", widthPct: 35 }
      ]);

      renderBoxValue("", [
        { label: "Morada de Residência Alternativa do Proprietário (Se Arrendada)", val: prop.morada_alt || "Registada no sistema", widthPct: 100 }
      ]);
    }

    // RGPD Statement
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(4, 120, 87);
    doc.text("5. CONSENTIMENTO RGPD & REGISTO DIGITAL", 14, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(51, 65, 85);
    doc.text("Ficha de cadastro registada e validada digitalmente na plataforma CondoManager AI em conformidade com o RGPD (UE 2016/679). Os dados constantes deste documento encontram-se encriptados e arquivados no registo oficial do edifício.", 14, y);

    const blob = doc.output("blob");
    downloadBlob(blob, `Ficha_Cadastro_Fracao_${fracao?.fracao_nome || "A"}.pdf`);
  } catch (err) {
    console.error("Erro ao gerar Ficha Preenchida PDF:", err);
  }
}

export function downloadListaCondominosPDF(predioNome: string = "Condomínio Activo", fracoes: any[]) {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Top Header: Logo centered at top (NO BARS)
    let y = addPdfHeaderWithLogo(doc);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`REGISTO GERAL DE CONDÓMINOS & FRAÇÕES — ${predioNome}`, 105, y, { align: "center" });
    y += 7;

    doc.setFillColor(248, 250, 252);
    doc.rect(14, y, 182, 14, "F");
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, y, 182, 14, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(`Total de Frações Autónomas: ${fracoes?.length || 0}`, 18, y + 5);
    const sumPerm = (fracoes || []).reduce((acc, f) => acc + (f.permilagem || 0), 0);
    doc.text(`Total Permilagem Legal: ${sumPerm}‰ | Data de Emissão: ${new Date().toLocaleDateString('pt-PT')}`, 18, y + 10);

    y += 20;

    doc.setFillColor(4, 120, 87);
    doc.rect(14, y, 182, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("FRAÇÃO", 18, y + 5.5);
    doc.text("PISO", 38, y + 5.5);
    doc.text("PERM.", 65, y + 5.5);
    doc.text("PROPRIETÁRIO / CONDÓMINO", 85, y + 5.5);
    doc.text("CONTACTO / E-MAIL", 145, y + 5.5);

    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    (fracoes || []).forEach((f, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
        doc.setFillColor(4, 120, 87);
        doc.rect(14, y, 182, 8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("FRAÇÃO", 18, y + 5.5);
        doc.text("PISO", 38, y + 5.5);
        doc.text("PERM.", 65, y + 5.5);
        doc.text("PROPRIETÁRIO / CONDÓMINO", 85, y + 5.5);
        doc.text("CONTACTO / E-MAIL", 145, y + 5.5);
        y += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y, 182, 8, "F");
      }
      doc.setDrawColor(226, 232, 240);
      doc.rect(14, y, 182, 8, "S");

      doc.setFont("helvetica", "bold");
      doc.text(f.fracao_nome || "-", 18, y + 5.5);
      doc.setFont("helvetica", "normal");
      doc.text(f.piso || "-", 38, y + 5.5);
      doc.text(`${f.permilagem || 0}‰`, 65, y + 5.5);
      
      const propName = f.proprietario?.nome || "Sem proprietário";
      const truncatedProp = propName.length > 28 ? propName.substring(0, 26) + "..." : propName;
      doc.text(truncatedProp, 85, y + 5.5);

      const contact = f.proprietario?.email || f.proprietario?.telefone || "—";
      const truncatedContact = contact.length > 25 ? contact.substring(0, 23) + "..." : contact;
      doc.text(truncatedContact, 145, y + 5.5);

      y += 8;
    });

    y += 6;
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setDrawColor(4, 120, 87);
    doc.line(14, y, 196, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(4, 120, 87);
    doc.text("CONDOMANAGER AI - REGISTO OFICIAL DO EDIFÍCIO EM PDF", 105, y, { align: "center" });

    const blob = doc.output("blob");
    downloadBlob(blob, "Lista_Condominos_Preenchida_Geral.pdf");
  } catch (err) {
    console.error("Erro ao gerar Lista de Condóminos PDF:", err);
  }
}

export const DEMO_ACCOUNTS_MAP: Record<string, { role: "ADMIN" | "EMPRESA_GESTORA" | "USER" | "INQUILINO" | "TECNICO" | "LIMPEZAS" | "JURIDICO" | "AUDITOR" | "CONTABILISTA"; nome: string; pass: string; title: string }> = {
  // Administrador Principal Provisório de Arranque
  "condomanagerai@gmail.com": { role: "ADMIN", nome: "Administrador do Condomínio", pass: "*Condomanager2026", title: "👑 Administrador Principal" },

  // Administrador Interno
  "admin@condomanager.pt": { role: "ADMIN", nome: "Carlos Administrador", pass: "Admin12345!", title: "👑 Administrador Interno" },
  "carlos.adm@condomanager.pt": { role: "ADMIN", nome: "Carlos Administrador", pass: "Admin12345!", title: "👑 Administrador Interno" },

  // Empresa Gestora
  "gestora@condomanager.pt": { role: "EMPRESA_GESTORA", nome: "Gestão Forte, Lda", pass: "Gestora12345!", title: "🏢 Empresa Gestora" },
  "geral@gestaoforte.pt": { role: "EMPRESA_GESTORA", nome: "Gestão Forte, Lda", pass: "Gestora12345!", title: "🏢 Empresa Gestora" },

  // Portal do Condómino (Proprietário)
  "condomino@condomanager.pt": { role: "USER", nome: "Ana Silva (Fração A)", pass: "Condomino12345!", title: "🏠 Portal do Condómino (Proprietário)" },
  "ana.silva@gmail.com": { role: "USER", nome: "Ana Silva (Fração A)", pass: "Condomino12345!", title: "🏠 Portal do Condómino (Proprietário)" },
  "amelia.sousa@yahoo.com": { role: "USER", nome: "D.ª Amélia Sousa (Fração B)", pass: "Condomino12345!", title: "🏠 Portal do Condómino (Proprietário)" },

  // Inquilino / Arrendatário (Sem acesso a dados financeiros)
  "inquilino@condomanager.pt": { role: "INQUILINO", nome: "Bruno Ferreira (Inquilino Fração A)", pass: "Inquilino12345!", title: "🔑 Portal do Inquilino / Arrendatário" },
  "bruno.inquilino@gmail.com": { role: "INQUILINO", nome: "Bruno Ferreira (Inquilino Fração A)", pass: "Inquilino12345!", title: "🔑 Portal do Inquilino / Arrendatário" },
  "ricardo.loc@gmail.com": { role: "INQUILINO", nome: "Ricardo Inquilino (Fração A)", pass: "Inquilino12345!", title: "🔑 Portal do Inquilino / Arrendatário" },

  // Técnico / Vistorias
  "tecnico@condomanager.pt": { role: "TECNICO", nome: "Eng. Rui Melo", pass: "Tecnico12345!", title: "🔍 Inspetor Técnico" },
  "rui.melo@vistoriasegura.pt": { role: "TECNICO", nome: "Eng. Rui Melo", pass: "Tecnico12345!", title: "🔍 Inspetor Técnico" },
  "rui.melim@vistoriasia.pt": { role: "TECNICO", nome: "Eng. Rui Melo", pass: "Tecnico12345!", title: "🔍 Inspetor Técnico" },

  // Equipa de Limpezas
  "limpezas@condomanager.pt": { role: "LIMPEZAS", nome: "Maria Silva (Limpezas)", pass: "Limpezas12345!", title: "🧹 Equipa de Higienização" },
  "limpezas.geral@cleancondo.pt": { role: "LIMPEZAS", nome: "Maria Silva (Limpezas)", pass: "Limpezas12345!", title: "🧹 Equipa de Higienização" },
  "rosa.limpezas@cleancondo.pt": { role: "LIMPEZAS", nome: "D.ª Rosa Limpezas", pass: "Limpezas12345!", title: "🧹 Equipa de Higienização" },

  // Perfil Jurídico
  "juridico@condomanager.pt": { role: "JURIDICO", nome: "Dra. Margarida Castro", pass: "Juridico12345!", title: "⚖️ Perfil Jurídico" },
  "margarida.adv@contencioso.pt": { role: "JURIDICO", nome: "Dra. Margarida Castro", pass: "Juridico12345!", title: "⚖️ Perfil Jurídico" },
  "leonor.silva@lawyers.pt": { role: "JURIDICO", nome: "Dra. Leonor Silva", pass: "Juridico12345!", title: "⚖️ Perfil Jurídico" },

  // Auditor Independente
  "auditor@condomanager.pt": { role: "AUDITOR", nome: "Dr. António Melo", pass: "Auditor12345!", title: "🕵️ Auditor Independente" },
  "antonio.auditor@auditoria.pt": { role: "AUDITOR", nome: "Dr. António Melo", pass: "Auditor12345!", title: "🕵️ Auditor Independente" },
  "jorge.santos@auditoriapredial.pt": { role: "AUDITOR", nome: "Dr. Jorge Santos", pass: "Auditor12345!", title: "🕵️ Auditor Independente" },

  // Contabilista Certificado
  "contabilista@condomanager.pt": { role: "CONTABILISTA", nome: "Dra. Paula Silva", pass: "Contas12345!", title: "📈 Contabilista Certificado" },
  "paula.contas@contabilidade.pt": { role: "CONTABILISTA", nome: "Dra. Paula Silva", pass: "Contas12345!", title: "📈 Contabilista Certificado" },
  "antonio.costa@contabilidade.pt": { role: "CONTABILISTA", nome: "Dr. António Costa", pass: "Contas12345!", title: "📈 Contabilista Certificado" },
};

export function resolveUserByEmail(rawEmail: string) {
  const cleanEmail = (rawEmail || "").trim().toLowerCase();
  if (!cleanEmail) {
    return null;
  }
  if (DEMO_ACCOUNTS_MAP[cleanEmail]) {
    return { ...DEMO_ACCOUNTS_MAP[cleanEmail], email: cleanEmail };
  }
  // Keyword matching for flexible domain/email inputs
  if (cleanEmail.includes('admin') || cleanEmail.includes('carlos')) {
    return { role: "ADMIN" as const, nome: "Carlos Administrador", pass: "Admin12345!", title: "👑 Administrador Interno", email: cleanEmail };
  }
  if (cleanEmail.includes('gestor') || cleanEmail.includes('geral') || cleanEmail.includes('empresa') || cleanEmail.includes('forte')) {
    return { role: "EMPRESA_GESTORA" as const, nome: "Gestão Forte, Lda", pass: "Gestora12345!", title: "🏢 Empresa Gestora", email: cleanEmail };
  }
  if (cleanEmail.includes('inquilino') || cleanEmail.includes('arrendatario') || cleanEmail.includes('locatario') || cleanEmail.includes('ricardo.loc') || cleanEmail.includes('bruno.inquilino')) {
    return { role: "INQUILINO" as const, nome: "Bruno Ferreira (Inquilino)", pass: "Inquilino12345!", title: "🔑 Portal do Inquilino / Arrendatário", email: cleanEmail };
  }
  if (cleanEmail.includes('tecnic') || cleanEmail.includes('melo') || cleanEmail.includes('melim') || cleanEmail.includes('vistoria')) {
    return { role: "TECNICO" as const, nome: "Eng. Rui Melo", pass: "Tecnico12345!", title: "🔍 Inspetor Técnico", email: cleanEmail };
  }
  if (cleanEmail.includes('limp') || cleanEmail.includes('rosa') || cleanEmail.includes('clean')) {
    return { role: "LIMPEZAS" as const, nome: "Maria Silva (Limpezas)", pass: "Limpezas12345!", title: "🧹 Equipa de Higienização", email: cleanEmail };
  }
  if (cleanEmail.includes('juri') || cleanEmail.includes('adv') || cleanEmail.includes('law') || cleanEmail.includes('margarida') || cleanEmail.includes('leonor')) {
    return { role: "JURIDICO" as const, nome: "Dra. Margarida Castro", pass: "Juridico12345!", title: "⚖️ Perfil Jurídico", email: cleanEmail };
  }
  if (cleanEmail.includes('audit') || cleanEmail.includes('antonio') || cleanEmail.includes('santos')) {
    return { role: "AUDITOR" as const, nome: "Dr. António Melo", pass: "Auditor12345!", title: "🕵️ Auditor Independente", email: cleanEmail };
  }
  if (cleanEmail.includes('conta') || cleanEmail.includes('paula') || cleanEmail.includes('costa')) {
    return { role: "CONTABILISTA" as const, nome: "Dra. Paula Silva", pass: "Contas12345!", title: "📈 Contabilista Certificado", email: cleanEmail };
  }
  
  // Default fallback for any condomino email
  return { role: "USER" as const, nome: "Ana Silva (Fração A)", pass: "Condomino12345!", title: "🏠 Portal do Condómino", email: cleanEmail };
}

export function formatQuotaReceiptNumber(identifier: string | number): string {
  if (!identifier) return "BR2 00001";
  const str = String(identifier);
  const digits = str.replace(/\D/g, "");
  if (digits) {
    const num = parseInt(digits, 10);
    return `BR2 ${String(num).padStart(5, "0")}`;
  }
  return `BR2 00001`;
}

export function generateSupplierPwaManualPDF(fornecedorNome: string, perfis: string[], passwordProvisoria?: string) {
  gerarPdfRegistoFornecedorHomologado({
    nome: fornecedorNome,
    perfis_pwa: perfis as any,
    pwa_password_provisoria: passwordProvisoria
  });
}

/**
 * Gera o PDF Oficial de Registo de Fornecedor Homologado & Credencial de Acesso
 */
export function gerarPdfRegistoFornecedorHomologado(
  fornecedor?: Partial<Fornecedor>,
  predio?: Predio
) {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    addPdfWatermark(doc);

    const condominioNome = "Condomínio Edifício Estrela da Barra";
    const fornecedorNome = fornecedor?.nome || "Fornecedor / Prestador de Serviços";
    const emailFornecedor = fornecedor?.email_contacto || fornecedor?.contacto || "fornecedor@empresa.pt";
    const passwordProvisoria = fornecedor?.pwa_password_provisoria || "Forn-82M4P9";
    const nifPredio = predio?.nif || "900123456";
    const moradaFaturacao = predio?.morada_linha1 || "Rua Bento Rodrigues";
    const emailFaturacao = (predio as any)?.email_administracao || (predio as any)?.email || "administracao@condomanagerai.com";

    // Header Background
    doc.setFillColor(15, 23, 42); // Slate-900
    doc.rect(0, 0, 210, 42, "F");

    // Accent line
    doc.setFillColor(16, 185, 129); // Emerald-500
    doc.rect(0, 41, 210, 2, "F");

    // Title and Building Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(condominioNome.toUpperCase(), 15, 17);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text("SISTEMA INTEGRADO DE GESTÃO DE CONDOMÍNIOS • CONDOMANAGER AI", 15, 25);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(52, 211, 153); // Emerald light
    doc.text("REGISTO DE FORNECEDOR HOMOLOGADO & CREDENCIAL DE ACESSO", 15, 33);

    let y = 50;

    // Greeting box
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(15, y, 180, 24, 3, 3, "F");
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(15, y, 180, 24, 3, 3, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`Exmos. Senhores ${fornecedorNome},`, 20, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Confirmamos a conclusão do registo da vossa empresa no catálogo de fornecedores e prestadores homologados do ${condominioNome}.`,
      20,
      y + 16
    );

    y += 30;

    // SECTION 1: DADOS FISCAIS PARA FATURAÇÃO
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("1. DADOS FISCAIS PARA FATURAÇÃO ELETRÓNICA", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 7;

    // Billing Box (Slate-50)
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, y, 180, 36, 3, 3, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, y, 180, 36, 3, 3, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);

    doc.text(`• Designação: ${condominioNome}`, 20, y + 8);
    doc.text(`• NIF: ${nifPredio}`, 20, y + 15);
    doc.text(`• Morada de Faturação: ${moradaFaturacao}`, 20, y + 22);
    doc.text(`• E-mail para Envio de Faturas/Recibos: ${emailFaturacao}`, 20, y + 29);

    y += 42;

    // SECTION 2: DADOS DE ACESSO
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("2. DADOS DE ACESSO À PLATAFORMA & PWA", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 7;

    // Credentials Box (Amber)
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(15, y, 180, 36, 3, 3, "F");
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(15, y, 180, 36, 3, 3, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(146, 64, 14);
    doc.text("CONSOLA DO FORNECEDOR / PWA: https://bentorodrigues2.condomanagerai.com", 20, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`Utilizador (E-mail): ${emailFornecedor}`, 20, y + 16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 83, 9);
    doc.text(`Password Provisória: ${passwordProvisoria}`, 20, y + 23);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(185, 28, 28);
    doc.text("⚠️ Por razões de segurança, ser-lhe-á solicitado que altere esta palavra-passe no seu primeiro acesso.", 20, y + 30);

    y += 42;

    // SECTION 3: MÓDULOS E FUNCIONALIDADES PARA PARCEIROS
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("3. MÓDULOS E FUNCIONALIDADES ATIVAS PARA O FORNECEDOR", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 6;

    const modulosFornecedor = [
      "• Submissão de Faturas e Recibos com Leitura Automática por Inteligência Artificial",
      "• Registo de Autos de Intervenção Técnica, Checklists Periódicas e Folhas de Limpeza",
      "• Consulta de Ordens de Trabalho e Adjudicações Aprovadas pela Administração",
      "• Notificação Imediata de Avarias e Chamados Urgentes no Edifício"
    ];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    modulosFornecedor.forEach(item => {
      doc.text(item, 18, y);
      y += 6;
    });

    y += 4;

    // SECTION 4: COMO INSTALAR A PWA NO TELEMÓVEL
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("4. COMO INSTALAR A APLICAÇÃO (PWA) NO SEU TELEMÓVEL", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 6;

    const passosPWA = [
      "• Aceda no seu telemóvel ao endereço: https://bentorodrigues2.condomanagerai.com",
      "• No iPhone (Safari): Toque no ícone de Partilha e selecione 'Adicionar ao Ecrã Principal'.",
      "• No Android (Chrome): Toque nos 3 pontos verticais e selecione 'Instalar Aplicação' ou 'Adicionar ao ecrã inicial'.",
      "• Tenha acesso imediato para fotografar intervenções, submeter faturas e consultar solicitações em tempo real."
    ];

    passosPWA.forEach(p => {
      const lines = doc.splitTextToSize(p, 175);
      doc.text(lines, 18, y);
      y += lines.length * 4.5 + 1.5;
    });

    // Sign-off
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Atentamente,", 18, y); y += 5;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("José Carlos Guerra", 18, y); y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.text("+351 919 943 465", 18, y); y += 4.5;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text("O Administrador do Condomínio", 18, y);

    // Footer
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Documento emitido para ${fornecedorNome} em ${new Date().toLocaleDateString("pt-PT")}. Confidencial.`, 105, 288, { align: "center" });

    const blob = doc.output("blob");
    downloadBlob(blob, `Instrucoes_Acesso_Perfil_Fornecedor.pdf`);
  } catch (err) {
    console.error("Erro ao gerar PDF do Fornecedor:", err);
    alert("Ocorreu um erro ao gerar o PDF de Registo de Fornecedor Homologado.");
  }
}

export function generateCondominoPwaManualPDF(condominoNome: string, buildingName: string = "Condomínio Bento Rodrigues 2", passwordProvisoria?: string) {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = addPdfHeaderWithLogo(doc, `${buildingName} - Manual do Condómino`);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`GUIA OFICIAL DE UTILIZAÇÃO DO SITE & INSTALAÇÃO DA PWA`, 14, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Condómino(a): ${condominoNome}`, 14, y);
    y += 5;
    doc.text(`Edifício / Condomínio: ${buildingName}`, 14, y);
    y += 5;
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString("pt-PT")}`, 14, y);
    y += 8;

    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.5);
    doc.line(14, y, 196, y);
    y += 7;

    // Credentials Box
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(14, y, 182, 34, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(6, 95, 70);
    doc.text("DADOS DE ACESSO À ÁREA RESERVADA DO CONDÓMINO", 18, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Link de Acesso Direto: https://bentorodrigues2.condomanagerai.com`, 18, y + 12);
    doc.text(`Password Provisória: ${passwordProvisoria || "Condo2026!"}`, 18, y + 17);
    doc.text(`Segurança: Por razões de segurança, ser-lhe-á solicitado que altere esta palavra-passe no primeiro acesso.`, 18, y + 22);
    doc.text(`Administração / Vizinho (3ºE): José Carlos Guerra`, 18, y + 27);
    doc.text(`Contacto Direto / Urgências: +351 919 943 465`, 18, y + 31);

    y += 40;

    const sections = [
      {
        title: "1. COMO INSTALAR A APLICAÇÃO (PWA) NO SEU TELEMÓVEL",
        items: [
          "• A aplicação funciona sem ocupar espaço na memória e não necessita de ir à App Store ou Google Play.",
          "• No iPhone (iOS / Safari): Abra https://bentorodrigues2.condomanagerai.com no Safari, toque no botão 'Partilhar' (ícone do quadrado com a seta para cima) e selecione 'Adicionar ao Ecrã Principal'.",
          "• No Android (Google Chrome): Abra https://bentorodrigues2.condomanagerai.com no Chrome, toque no menu dos 3 pontos no canto superior direito e selecione 'Instalar Aplicação' ou 'Adicionar ao ecrã inicial'.",
          "• Ficará com o ícone do condomínio no seu ecrã com abertura instantânea e notificações ativas."
        ]
      },
      {
        title: "2. ACOMPANHAMENTO DE SALDO & PAGAMENTOS COM CONCILIAÇÃO POR IA",
        items: [
          "• Consulte em tempo real o saldo da sua fração, histórico de quotas liquidadas e recibos oficiais.",
          "• Referência de Pagamento Personalizada: No seu perfil encontrará a sua referência única. Utilize-a sempre nas transferências bancárias para que a IA reconheça e credite o seu pagamento de imediato.",
          "• Envio de Comprovativos: Pode anexar o ficheiro PDF ou tirar foto ao comprovativo pelo telemóvel para validação automática."
        ]
      },
      {
        title: "3. COMUNICAÇÃO DIRETA & REPORTE DE AVARIAS NAS ÁREAS COMUNS",
        items: [
          "• Reporte avarias (elevador, iluminação, portão da garagem, limpezas) fotografando diretamente pela PWA.",
          "• Acompanhe em direto o estado de resolução das intervenções técnicas e os técnicos destacados.",
          "• Canal de mensagem direta com a administração do condomínio."
        ]
      },
      {
        title: "4. ARQUIVO DIGITAL, ATAS E ASSEMBLEIAS VIRTUAIS",
        items: [
          "• Consulte o Regulamento Interno do Edifício, atas aprovadas, apólices de seguro e orçamentos.",
          "• Participe em votações de assembleia através do telemóvel e descarregue declarações de quitação."
        ]
      }
    ];

    for (const sec of sections) {
      if (y > 245) {
        doc.addPage();
        addPdfWatermark(doc);
        y = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(4, 120, 87);
      doc.text(sec.title, 14, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);

      for (const item of sec.items) {
        if (y > 265) {
          doc.addPage();
          addPdfWatermark(doc);
          y = 20;
        }
        const lines = doc.splitTextToSize(item, 180);
        doc.text(lines, 14, y);
        y += (lines.length * 4) + 2;
      }
      y += 3;
    }

    const blob = doc.output("blob");
    downloadBlob(blob, `Instrucoes_Site_e_PWA_Condomino.pdf`);
  } catch (err) {
    console.error("Erro ao gerar Guia PWA Condómino PDF:", err);
  }
}

export interface ReceiptItem {
  movimentoNum: string;             // e.g. "MOV-2026-QM-BR2 00195"
  conceito: string;                 // e.g. "Quota Ordinária de Julho 2026"
  categoria: "Quota Mensal" | "Fundo Reserva" | "Quota Extra";
  valor: number;                    // e.g. 32.14
}

export interface ReceiptPdfData {
  tipoDocumento?: "RECIBO" | "NOTA_COBRANCA"; // Defaults to "RECIBO"
  reciboNum: string;             // e.g. "BR2 00195"
  dataPagamento?: string;        // e.g. "30-07-2026"
  dataEmissao?: string;          // e.g. "30-07-2026"
  dataLimite?: string;           // e.g. "08-08-2026"
  movimentoNum?: string;         // e.g. "MOV-2026-QM-BR2 00195"
  movimentoQuotaMensal?: string; // e.g. "MOV-2026-QM-BR2 00195"
  movimentoFundoReserva?: string;// e.g. "MOV-2026-FR-BR2 00195"
  movimentoQuotaExtra?: string;  // e.g. "MOV-2026-QE-BR2 00195"
  buildingName: string;          // e.g. "EDIFÍCIO ESTRELA DA BARRA"
  buildingAddress: string;       // e.g. "Rua Bento Rodrigues 2, Seixal"
  buildingNif: string;           // e.g. "900123456"
  buildingIban?: string;         // e.g. "PT50 0033 0000 12345678901 02"
  buildingEmail?: string;        // e.g. "condominio.estrela.barra@condomanager.ai"
  proprietarioNome: string;      // e.g. "Ana Silva"
  proprietarioNif?: string;      // e.g. "221230475"
  fracaoIdent: string;           // e.g. "Fração A (R/C Esq)"
  referenciaFracao?: string;     // e.g. "BR2-FRA" ou individual por fração para conciliação bancária por IA
  metodoPagamento?: string;      // e.g. "Transferência Bancária"
  quotaMensalVal?: number;       // e.g. 32.14
  fundoReservaVal?: number;      // e.g. 3.21
  quotaExtraVal?: number;        // e.g. 120.00
  isQuotaExtra?: boolean;        // default false
  descricaoQuota?: string;       // e.g. "Quota Ordinária de Julho 2026"
  items?: ReceiptItem[];         // Optional custom items array
  adminNome?: string;            // e.g. "Carlos Administrador - Administrador do Condomínio"
  adminSignatureBase64?: string; // Digital signature image
}

export function getPrazoLimiteTexto(dataEmissao?: string, dataLimite?: string): string {
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  
  if (dataLimite) {
    const parts = dataLimite.includes("-") ? dataLimite.split("-") : dataLimite.split("/");
    if (parts.length === 3) {
      let day = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      }
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && month >= 0 && month < 12) {
        return `Liquidação até dia ${day.toString().padStart(2, "0")} de ${meses[month]} de ${year}`;
      }
    }
  }

  // If emitted on 25 of month X, limit is 08 of month X+1
  let baseDate = new Date();
  if (dataEmissao) {
    const parts = dataEmissao.includes("-") ? dataEmissao.split("-") : dataEmissao.split("/");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else if (parts[2].length === 4) {
        baseDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
  }
  
  // Next month calculation: dia 08 of next month
  const nextMonthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 8);
  const nextMonthName = meses[nextMonthDate.getMonth()];
  const nextYear = nextMonthDate.getFullYear();

  return `Liquidação até dia 08 de ${nextMonthName} de ${nextYear}`;
}

export function generateReceiptPDF(data: ReceiptPdfData): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" });
  const isNotaCobranca = data.tipoDocumento === "NOTA_COBRANCA";

  // 1. Watermark Image
  try {
    if (WATERMARK_BASE64) {
      doc.saveGraphicsState?.();
      if ((doc as any).GState) {
        doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
      }
      doc.addImage(WATERMARK_BASE64, "PNG", 60, 24, 90, 90);
      if ((doc as any).GState) {
        doc.setGState(new (doc as any).GState({ opacity: 1.0 }));
      }
      doc.restoreGraphicsState?.();
    }
  } catch (e) {
    console.warn("Watermark render issue:", e);
  }

  // Build Itemized List with Individual Movement Numbers
  const items: ReceiptItem[] = data.items ? [...data.items] : [];

  if (!data.items || data.items.length === 0) {
    const rawReciboSuffix = data.reciboNum || "BR2 00195";

    if (data.isQuotaExtra) {
      // Quota Extra Only
      const qeVal = data.quotaExtraVal ?? data.quotaMensalVal ?? 120.00;
      items.push({
        movimentoNum: data.movimentoQuotaExtra || data.movimentoNum || `MOV-2026-QE-${rawReciboSuffix}`,
        conceito: data.descricaoQuota || "Quota Extraordinária de Obras e Conservação",
        categoria: "Quota Extra",
        valor: qeVal
      });
    } else {
      // Quota Mensal Ordinária
      const qmVal = data.quotaMensalVal ?? 32.14;
      if (qmVal > 0) {
        items.push({
          movimentoNum: data.movimentoQuotaMensal || data.movimentoNum || `MOV-2026-QM-${rawReciboSuffix}`,
          conceito: data.descricaoQuota || "Quota Ordinária de Julho 2026",
          categoria: "Quota Mensal",
          valor: qmVal
        });
      }

      // Fundo Comum de Reserva (Does NOT apply to Extra Quotas)
      const frVal = data.fundoReservaVal ?? (qmVal > 0 ? Number((qmVal * 0.10).toFixed(2)) : 3.21);
      if (frVal > 0) {
        items.push({
          movimentoNum: data.movimentoFundoReserva || `MOV-2026-FR-${rawReciboSuffix}`,
          conceito: "Fundo Comum de Reserva (10% Legal)",
          categoria: "Fundo Reserva",
          valor: frVal
        });
      }

      // Quota Extra when additionally applicable
      if (data.quotaExtraVal && data.quotaExtraVal > 0) {
        items.push({
          movimentoNum: data.movimentoQuotaExtra || `MOV-2026-QE-${rawReciboSuffix}`,
          conceito: "Quota Extraordinária de Condomínio",
          categoria: "Quota Extra",
          valor: data.quotaExtraVal
        });
      }
    }
  }

  // 2. Top Header - Logo Horizontal (Exact 2.5:1 ratio, uncompressed and readable)
  try {
    if (LOGO_HORIZONTAL_BASE64) {
      // Original dimensions: 1983 x 793 (Ratio = 2.5 : 1)
      // 45mm width x 18mm height maintains exact proportions without squishing or stretching!
      doc.addImage(LOGO_HORIZONTAL_BASE64, "PNG", 12, 7, 45, 18);
    }
  } catch (e) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text("CONDOMANAGER AI", 12, 16);
  }

  // 3. Right Top Header Info Box (Recibo / Nota de Cobrança Nº, Data, Movimentos)
  doc.setFillColor(11, 20, 38);
  doc.rect(114, 7, 84, 18, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  
  if (isNotaCobranca) {
    doc.text(`NOTA DE COBRANÇA Nº: ${data.reciboNum}`, 118, 11.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(226, 232, 240);
    doc.text(`Data de Emissão: ${data.dataEmissao || data.dataPagamento || "30-07-2026"} • Limite: ${data.dataLimite || "08-08-2026"}`, 118, 15.5);
  } else {
    doc.text(`RECIBO DE PAGAMENTO Nº: ${data.reciboNum}`, 118, 11.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(226, 232, 240);
    doc.text(`Data de Pagamento: ${data.dataPagamento || "30-07-2026"}`, 118, 15.5);
  }

  const movsListStr = items.map(i => i.movimentoNum).join(", ");
  const movsDisplay = movsListStr.length > 38 ? movsListStr.substring(0, 38) + "..." : movsListStr;
  doc.text(`Nºs Movimentos: ${movsDisplay}`, 118, 20);

  // 4. Two Identification Boxes (y=27 to 51)
  // Left Box: Condomínio
  doc.setFillColor(248, 250, 252);
  doc.rect(12, 27, 91, 24, "F");
  doc.setDrawColor(203, 213, 225);
  doc.rect(12, 27, 91, 24, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(2, 132, 199); // Teal / Sky Blue header
  doc.text("CONDOMÍNIO DO EDIFÍCIO:", 15, 31.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const bNameStr = (data.buildingName || "EDIFÍCIO ESTRELA DA BARRA").toUpperCase();
  doc.text(bNameStr.length > 38 ? bNameStr.substring(0, 38) + "..." : bNameStr, 15, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Morada: ${data.buildingAddress || "Rua Bento Rodrigues 2, Seixal"}`, 15, 40.5);
  doc.text(`NIF: ${data.buildingNif || "900123456"} • Email: ${data.buildingEmail || "condominio.estrela.barra@condomanager.ai"}`, 15, 44.5);
  doc.setFont("helvetica", isNotaCobranca ? "bold" : "normal");
  if (isNotaCobranca) {
    doc.setTextColor(15, 23, 42);
  }
  doc.text(`IBAN: ${data.buildingIban || "PT50 0035 0123 4567 8901 2344 5"}`, 15, 48.5);

  // Right Box: Condómino / Proprietário & Fração
  doc.setFillColor(248, 250, 252);
  doc.rect(107, 27, 91, 24, "F");
  doc.setDrawColor(203, 213, 225);
  doc.rect(107, 27, 91, 24, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(2, 132, 199); // Teal / Sky Blue header
  doc.text(isNotaCobranca ? "DESTINATÁRIO (CONDÓMINO / FRAÇÃO):" : "LIQUIDADO POR (PROPRIETÁRIO / FRAÇÃO):", 110, 31.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.proprietarioNome || "Ana Silva", 110, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`NIF: ${data.proprietarioNif || "221230475"} • Fração: ${data.fracaoIdent || "Fração A (R/C Esq)"}`, 110, 40.5);
  if (isNotaCobranca) {
    const refFracao = data.referenciaFracao || "BR2-FRA-A";
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`Ref. Individual da Fração (Cruzamento IA): ${refFracao}`, 110, 44.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const prazoStr = getPrazoLimiteTexto(data.dataEmissao, data.dataLimite);
    doc.text(`Prazo Limite: ${prazoStr}`, 110, 48.5);
  } else {
    doc.text(`Fração: ${data.fracaoIdent || "Fração A (R/C Esq)"}`, 110, 44.5);
    doc.text(`Método de Pagamento: ${data.metodoPagamento || "Transferência Bancária"}`, 110, 48.5);
  }

  // 5. Itemized Table of Values (Discriminated by Row and Movement Number)
  // Table Header (y = 53)
  doc.setFillColor(11, 20, 38);
  doc.rect(12, 53, 186, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text("Nº MOVIMENTO", 15, 57);
  doc.text("DESCRITIVO DO CONCEITO / QUOTA", 55, 57);
  doc.text("CATEGORIA", 138, 57);
  doc.text("VALOR (€)", 194, 57, { align: "right" });

  let currentY = 59;
  let totalRecibo = 0;

  items.forEach((item, idx) => {
    totalRecibo += item.valor;

    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(12, currentY, 186, 6.5, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(12, currentY, 186, 6.5, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(30, 41, 59);
    doc.text(item.movimentoNum, 15, currentY + 4.2);

    doc.setFont("helvetica", "normal");
    doc.text(item.conceito, 55, currentY + 4.2);

    doc.setFont("helvetica", "bold");
    if (item.categoria === "Fundo Reserva") {
      doc.setTextColor(194, 65, 12); // Orange / Amber #c2410c
    } else if (item.categoria === "Quota Extra") {
      doc.setTextColor(190, 24, 93); // Rose / Magenta
    } else {
      doc.setTextColor(13, 148, 136); // Teal #0d9488
    }
    doc.text(item.categoria.toUpperCase(), 138, currentY + 4.2);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`${item.valor.toFixed(2)} €`, 194, currentY + 4.2, { align: "right" });

    currentY += 6.5;
  });

  // Total Banner (below items table)
  doc.setFillColor(248, 250, 252);
  doc.rect(12, currentY + 1, 186, 7.5, "F");
  doc.setDrawColor(203, 213, 225);
  doc.rect(12, currentY + 1, 186, 7.5, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text("Isento de I.V.A. nos termos do artº 9º do nº21 do CIVA", 15, currentY + 5.8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(13, 148, 136);
  const totalLabel = isNotaCobranca ? "TOTAL A PAGAR:" : "TOTAL DO RECIBO:";
  doc.text(`${totalLabel} ${totalRecibo.toFixed(2)} €`, 194, currentY + 5.8, { align: "right" });

  currentY += 10.5;

  if (isNotaCobranca) {
    // Payment Instructions Box for Nota de Cobrança (Bank Transfer + IA Fraction Ref)
    const refFracao = data.referenciaFracao || "BR2-FRA";
    doc.setFillColor(248, 250, 252);
    doc.rect(12, currentY, 186, 11.5, "F");
    doc.setDrawColor(203, 213, 225);
    doc.rect(12, currentY, 186, 11.5, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`DADOS PARA PAGAMENTO (TRANSFERÊNCIA BANCÁRIA): IBAN: ${data.buildingIban || "PT50 0035 0123 4567 8901 2344 5"} • Montante: ${totalRecibo.toFixed(2)} €`, 15, currentY + 4);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(2, 132, 199);
    doc.text(`Descritivo Obrigatório na Transferência: ${refFracao} (Referência individual da fração para cruzamento de dados IA)`, 15, currentY + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Envio de Comprovativos: Envie para ${data.buildingEmail || "administracao@condomanagerai.com"} ou submeta diretamente através da aplicação.`, 15, currentY + 11.2);

    currentY += 14;
  } else {
    // Quittance Statement for Recibo de Pagamento
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text("O presente documento serve de quitação oficial de pagamento para todos os efeitos legais, comprovando a liquidação dos valores discriminados.", 12, currentY + 2);

    currentY += 3;
  }

  // Admin Digital Signature Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text("A ADMINISTRAÇÃO DO CONDOMÍNIO", 130, currentY + 6);

  const adminSig = data.adminSignatureBase64 || localStorage.getItem("admin_signature_digital");
  if (adminSig && adminSig.startsWith("data:image")) {
    try {
      doc.addImage(adminSig, "PNG", 132, currentY + 8, 48, 12);
    } catch (e) {
      console.warn("Could not render digital signature image:", e);
    }
  } else {
    doc.setDrawColor(203, 213, 225);
    doc.line(130, currentY + 16, 192, currentY + 16);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  const adminNameDisplay = data.adminNome || "Carlos Administrador - Administrador do Condomínio";
  doc.text(adminNameDisplay, 130, currentY + 21);

  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text(`Emitido via CondoManager AI • Documento nº ${data.reciboNum} • Autenticidade Digital Garantida`, 12, currentY + 21);

  return doc;
}

export function downloadReceiptPDF(data: ReceiptPdfData, customFilename?: string) {
  try {
    const doc = generateReceiptPDF({ ...data, tipoDocumento: data.tipoDocumento || "RECIBO" });
    const filename = customFilename || `Recibo_de_Pagamento_${data.reciboNum.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
  } catch (err) {
    console.error("Erro ao gerar recibo PDF A5:", err);
  }
}

export function downloadNotaCobrancaPDF(data: ReceiptPdfData, customFilename?: string) {
  try {
    const doc = generateReceiptPDF({ ...data, tipoDocumento: "NOTA_COBRANCA" });
    const filename = customFilename || `Nota_de_Cobranca_Mensal_${data.reciboNum.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
  } catch (err) {
    console.error("Erro ao gerar nota de cobrança PDF A5:", err);
  }
}

export function gerarPdfEtiquetasChaves(
  nomePredio: string,
  chaves: any[],
  opcoesChaveiro?: {
    numChaveiro?: string;
    codigoConjunto?: string;
    identificacaoConjunto?: string;
  }
) {
  try {
    const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    
    const labelWidth = 30; // 3cm
    const labelHeight = 15; // 1.5cm
    const marginX = 10;
    const marginY = 15;
    const gapX = 2;
    const gapY = 2;
    
    const cols = 6;
    const rowsPerPage = 16;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`ETIQUETAS DE CHAVEIRO - ${(nomePredio || "CONDOMÍNIO").toUpperCase()}`, marginX, 10);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Dimensões: 3,0 cm x 1,5 cm (30x15 mm) • Recorte pelas linhas tracejadas`, marginX + 105, 10);

    const numChaveiroAtribuido = opcoesChaveiro?.numChaveiro || chaves.find(c => c.num_chaveiro && c.num_chaveiro.trim().length > 0)?.num_chaveiro || "Chaveiro #1";
    
    // Extract base prefix from building name or key codes (e.g. BR2PP)
    const firstKeyWithCode = chaves.find(c => c.codigo_chave && c.codigo_chave.includes(" "));
    const prefixoIniciais = firstKeyWithCode ? firstKeyWithCode.codigo_chave.split(" ")[0] : "CHV";
    const masterCode = opcoesChaveiro?.codigoConjunto || `${prefixoIniciais}-CHV-${numChaveiroAtribuido.replace(/[^0-9]/g, "") || "01"}`;
    const setIdent = opcoesChaveiro?.identificacaoConjunto || "Conjunto Geral do Chaveiro Principal";

    // Summary of key areas contained in keychain
    const keyNamesList = chaves.map(c => c.area_nome || "Chave").join(", ");
    const keyNamesShort = keyNamesList.length > 32 ? keyNamesList.substring(0, 30) + "…" : keyNamesList;

    // Prepare items list: 1st item is the Green CondoManager AI Master Keychain Tag, followed by individual key tags
    const itemsToPrint = [
      { 
        isGreenKeychainTag: true, 
        num_chaveiro: numChaveiroAtribuido,
        codigo_conjunto: masterCode,
        identificacao_conjunto: setIdent,
        resumo_chaves: keyNamesShort
      },
      ...chaves.map(c => ({ isGreenKeychainTag: false, ...c }))
    ];

    let col = 0;
    let row = 0;
    
    itemsToPrint.forEach((item, index) => {
      if (index > 0 && index % (cols * rowsPerPage) === 0) {
        doc.addPage();
        col = 0;
        row = 0;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(`ETIQUETAS DE CHAVEIRO - ${(nomePredio || "CONDOMÍNIO").toUpperCase()} (Pág. ${doc.getNumberOfPages()})`, marginX, 10);
      }
      
      const x = marginX + col * (labelWidth + gapX);
      const y = marginY + row * (labelHeight + gapY);

      const bNameShort = (nomePredio || "Condomínio").length > 18 ? (nomePredio || "Condomínio").substring(0, 18) + "…" : (nomePredio || "Condomínio");

      if (item.isGreenKeychainTag) {
        // --- 1. ETIQUETA VERDE CONDOMANAGER AI (CHAVEIRO PRINCIPAL) ---
        doc.setDrawColor(4, 120, 87);
        doc.setLineWidth(0.2);
        try {
          (doc as any).setLineDashPattern([1, 1], 0);
        } catch (e) {}
        doc.rect(x, y, labelWidth, labelHeight);
        
        try {
          (doc as any).setLineDashPattern([], 0);
        } catch (e) {}

        // Solid CondoManager AI Green Background
        doc.setFillColor(5, 150, 105); // Emerald-600
        doc.rect(x + 0.2, y + 0.2, labelWidth - 0.4, labelHeight - 0.4, "F");

        // Watermark image adapted to space (/public/marca/19-marca-dagua-logo-cinza-claro.png)
        const wmTag = (typeof window !== "undefined" && (window as any).__WATERMARK_B64) || WATERMARK_BASE64;
        if (wmTag && wmTag.length > 50) {
          try {
            doc.saveGraphicsState?.();
            if ((doc as any).GState) {
              doc.setGState(new (doc as any).GState({ opacity: 0.25 }));
            }
            doc.addImage(wmTag, "PNG", x + 5, y + 1.5, 20, 12);
            if ((doc as any).GState) {
              doc.setGState(new (doc as any).GState({ opacity: 1.0 }));
            }
            doc.restoreGraphicsState?.();
          } catch (e) {
            console.warn("Watermark error on green tag:", e);
          }
        }

        // White Key Ring circle indicator
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(209, 250, 229);
        doc.circle(x + 3.2, y + labelHeight / 2, 0.9, "FD");

        // Brand & Building Header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.2);
        doc.setTextColor(236, 253, 245);
        doc.text(`CONDOMANAGER AI • ${bNameShort.toUpperCase()}`, x + 5, y + 3.0);

        // Assigned Keychain Number & Master Code
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        doc.setTextColor(255, 255, 255);
        doc.text(`CHAVEIRO Nº ${item.num_chaveiro}`, x + 5, y + 5.8);

        // Master Set Code (CÓDIGO DO CONJUNTO)
        doc.setFont("courier", "bold");
        doc.setFontSize(5.5);
        doc.setTextColor(254, 240, 138); // Yellow-200 for code pop
        doc.text(`CÓD: ${item.codigo_conjunto}`, x + 5, y + 8.8);

        // Identification & Key Summary
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.2);
        doc.setTextColor(236, 253, 245);
        const setIdentShort = (item.identificacao_conjunto || "Conjunto Geral").length > 22 ? (item.identificacao_conjunto || "Conjunto Geral").substring(0, 20) + "…" : (item.identificacao_conjunto || "Conjunto Geral");
        doc.text(`${setIdentShort} (${chaves.length} Chvs)`, x + 5, y + 11.4);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(3.8);
        doc.setTextColor(209, 250, 229);
        doc.text(item.resumo_chaves || "Chaves de acesso comum", x + 5, y + 13.8);

      } else {
        // --- 2. ETIQUETA INDIVIDUAL DE CHAVE COM MARCA DE ÁGUA ---
        // Outer dotted line
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.2);
        try {
          (doc as any).setLineDashPattern([1, 1], 0);
        } catch (e) {}
        doc.rect(x, y, labelWidth, labelHeight);
        
        try {
          (doc as any).setLineDashPattern([], 0);
        } catch (e) {}
        
        // Accent bar
        if (item.no_claviculario) {
          doc.setFillColor(16, 185, 129);
        } else {
          doc.setFillColor(100, 116, 139);
        }
        doc.rect(x + 0.3, y + 0.3, 1.5, labelHeight - 0.6, "F");
        
        // Keyhole ring circle indicator
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        doc.circle(x + 3.2, y + labelHeight / 2, 0.9, "FD");

        // Watermark image adapted to space (/public/marca/19-marca-dagua-logo-cinza-claro.png)
        const wmIndividual = (typeof window !== "undefined" && (window as any).__WATERMARK_B64) || WATERMARK_BASE64;
        if (wmIndividual && wmIndividual.length > 50) {
          try {
            doc.saveGraphicsState?.();
            if ((doc as any).GState) {
              doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
            }
            doc.addImage(wmIndividual, "PNG", x + 5, y + 1.5, 20, 12);
            if ((doc as any).GState) {
              doc.setGState(new (doc as any).GState({ opacity: 1.0 }));
            }
            doc.restoreGraphicsState?.();
          } catch (e) {
            console.warn("Watermark error on key tag:", e);
          }
        }
        
        // Building name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5);
        doc.setTextColor(71, 85, 105);
        doc.text(bNameShort.toUpperCase(), x + 5, y + 3.2);
        
        // Key Name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(15, 23, 42);
        const keyNameShort = (item.area_nome || "Chave").length > 17 ? (item.area_nome || "Chave").substring(0, 16) + "…" : (item.area_nome || "Chave");
        doc.text(keyNameShort, x + 5, y + 6.8);
        
        // Key Code
        doc.setFont("courier", "bold");
        doc.setFontSize(6);
        doc.setTextColor(30, 58, 138);
        doc.text(item.codigo_chave || `CHV-${index}`, x + 5, y + 10.2);
        
        // Quantity and Chaveiro Num
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5);
        doc.setTextColor(16, 185, 129);
        const chaveiroTxt = item.num_chaveiro ? ` • Chav. ${item.num_chaveiro}` : ` • Chav. ${numChaveiroAtribuido}`;
        doc.text(`Qtd: ${item.quantidade || 1} un${chaveiroTxt}`, x + 5, y + 13.5);
      }

      col++;
      if (col >= cols) {
        col = 0;
        row++;
      }
    });
    
    doc.save(`Etiquetas_Chaves_3x1.5cm_${(nomePredio || "Condominio").replace(/\s+/g, "_")}.pdf`);
  } catch (err) {
    console.error("Erro ao gerar PDF de Etiquetas de Chaves:", err);
    alert("Ocorreu um erro ao gerar o PDF de etiquetas de chaves.");
  }
}

/**
 * Gera o PDF Oficial de Boas-Vindas, Atribuição de Perfil e Credenciais Provisórias para o Administrador do Condomínio
 */
export function gerarPdfBoasVindasAdministrador(
  adminInfo?: Partial<GestorCarteira>,
  predios?: Predio[],
  condominioNome: string = "Condomínio Edifício Estrela da Barra"
) {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    addPdfWatermark(doc);

    const nomeAdmin = adminInfo?.nome || "Administrador do Condomínio";
    const emailAdmin = adminInfo?.email || "administracao@condomanagerai.com";
    const tlmAdmin = adminInfo?.tlm || "+351 919 943 465";
    const passProvisoria = adminInfo?.password_provisoria || "Admin#2026!";

    // Header Background
    doc.setFillColor(15, 23, 42); // Slate-900
    doc.rect(0, 0, 210, 42, "F");

    // Accent line
    doc.setFillColor(16, 185, 129); // Emerald-500
    doc.rect(0, 41, 210, 2, "F");

    // Title and Building Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(condominioNome.toUpperCase(), 15, 17);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text("SISTEMA INTEGRADO DE GESTÃO DE CONDOMÍNIOS • CONDOMANAGER AI", 15, 25);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(52, 211, 153); // Emerald light
    doc.text("NOMEAÇÃO & ATIVAÇÃO DE ACESSO À GESTÃO • PERFIL ADMINISTRADOR", 15, 33);

    let y = 50;

    // Greeting box
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(15, y, 180, 24, 3, 3, "F");
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(15, y, 180, 24, 3, 3, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`Exmo.(a) Sr.(a) Administrador do Condomínio,`, 20, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Confirmamos a sua integração com sucesso no sistema de gestão do ${condominioNome}.`,
      20,
      y + 16
    );

    y += 30;

    // SECTION 1: PERFIL & DADOS DE ACESSO
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("1. IDENTIFICAÇÃO & DADOS DE ACESSO", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 7;

    // Credentials Box (Amber)
    doc.setFillColor(254, 243, 199); // Amber-100
    doc.roundedRect(15, y, 180, 36, 3, 3, "F");
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(15, y, 180, 36, 3, 3, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(146, 64, 14); // Amber-900
    doc.text("CONSOLA DE ADMINISTRAÇÃO: https://bentorodrigues2.condomanagerai.com", 20, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`Utilizador (E-mail): ${emailAdmin}`, 20, y + 16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 83, 9);
    doc.text(`Password Provisória: ${passProvisoria}`, 20, y + 23);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(185, 28, 28);
    doc.text("⚠️ Por razões de segurança, ser-lhe-á solicitado que altere esta palavra-passe no seu primeiro acesso.", 20, y + 30);

    y += 42;

    // SECTION 2: PRIVILÉGIOS E MÓDULOS ATIVADOS
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("2. PRIVILÉGIOS E MÓDULOS ATIVADOS (SUPER ADMIN)", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 6;

    const modulosAdmin = [
      "• Perfil de Acesso: Administrador do Condomínio (Super Admin / Acesso Total)",
      "• Gestão de Tesouraria e Extratos Bancários com Reconciliação IA em Tempo Real",
      "• Emissão de Notas de Cobrança e Linhas Multibanco / Referências Automáticas",
      "• Gestão de Sinistros, Seguros e Livro de Vistorias Técnicas das Infraestruturas",
      "• Assembleia Virtual com Votação em Tempo Real, Controlo de Quórum e Minutas de Atas",
      "• Controlo Cadastral & Jurídico: Registo de frações, autos de vistoria e contencioso/cobrança coerciva",
      "• Parametrização do Autoresponder IA e Regras de Triagem Automática do Edifício"
    ];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    modulosAdmin.forEach(item => {
      doc.text(item, 18, y);
      y += 6;
    });

    y += 4;

    // SECTION 3: INSTRUÇÕES PARA APLICAÇÃO NO TELEMÓVEL (PWA)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("3. COMO INSTALAR A APLICAÇÃO (PWA) NO SEU TELEMÓVEL", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 6;

    const passosPWA = [
      "• Aceda no seu telemóvel ao endereço: https://bentorodrigues2.condomanagerai.com",
      "• No iPhone (Safari): Toque no ícone de Partilha (quadrado com seta para cima) e escolha 'Adicionar ao Ecrã Principal'.",
      "• No Android (Google Chrome): Toque nos 3 pontos no topo direito e selecione 'Instalar Aplicação' ou 'Adicionar ao ecrã inicial'.",
      "• Aceda a qualquer momento às finanças, aprovações, notificações urgentes e chat com condóminos diretamente pelo telemóvel."
    ];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    passosPWA.forEach(p => {
      const lines = doc.splitTextToSize(p, 175);
      doc.text(lines, 18, y);
      y += lines.length * 4.5 + 1.5;
    });

    // Sign-off
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Cordiais saudações,", 18, y); y += 5;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("CondoManager AI - Central de Operações", 18, y);

    // Footer
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Documento emitido para ${nomeAdmin} em ${new Date().toLocaleDateString("pt-PT")}. Confidencial.`, 105, 288, { align: "center" });

    const blob = doc.output("blob");
    downloadBlob(blob, `Instrucoes_Acesso_Perfil_Administrador.pdf`);
  } catch (err) {
    console.error("Erro ao gerar PDF do Administrador:", err);
    alert("Ocorreu um erro ao gerar o PDF de Boas-Vindas do Administrador.");
  }
}

/**
 * Gera o PDF Oficial de Boas-Vindas, Atribuição de Perfil e Credenciais Provisórias para Gestores da Empresa
 */
export function gerarPdfBoasVindasGestor(
  gestor?: Partial<GestorCarteira>,
  predios?: Predio[],
  empresaNome: string = "Condomínio Edifício Estrela da Barra",
  logoUrl?: string
) {
  if (gestor?.perfil === "ADMIN") {
    return gerarPdfBoasVindasAdministrador(gestor, predios, empresaNome);
  }

  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    addPdfWatermark(doc);

    const nomeGestor = gestor?.nome || "Gestor de Carteira";
    const emailGestor = gestor?.email || "gestor@condomanagerai.com";
    const tlmGestor = gestor?.tlm || "+351 919 943 465";
    const passProvisoria = gestor?.password_provisoria || "Gestor#2026!";

    // Header Background
    doc.setFillColor(15, 23, 42); // Slate-900
    doc.rect(0, 0, 210, 42, "F");

    // Accent line
    doc.setFillColor(16, 185, 129); // Emerald-500
    doc.rect(0, 41, 210, 2, "F");

    // Title and Company/Building Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(empresaNome.toUpperCase(), 15, 17);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text("SISTEMA INTEGRADO DE GESTÃO DE CONDOMÍNIOS • CONDOMANAGER AI", 15, 25);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(52, 211, 153); // Emerald light
    doc.text("NOMEAÇÃO & ATIVAÇÃO DE ACESSO À GESTÃO • PERFIL GESTOR", 15, 33);

    let y = 50;

    // Greeting box
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(15, y, 180, 24, 3, 3, "F");
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(15, y, 180, 24, 3, 3, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`Exmo.(a) Sr.(a) Gestor(a) de Portfólio / Operacional,`, 20, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Confirmamos a sua integração com sucesso no sistema de gestão do ${empresaNome}.`,
      20,
      y + 16
    );

    y += 30;

    // SECTION 1: PERFIL & DADOS DE ACESSO
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("1. IDENTIFICAÇÃO DO GESTOR & CREDENCIAIS DE ACESSO", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 7;

    // Credentials Box (Amber)
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(15, y, 180, 36, 3, 3, "F");
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(15, y, 180, 36, 3, 3, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(146, 64, 14);
    doc.text("CONSOLA DE ADMINISTRAÇÃO: https://bentorodrigues2.condomanagerai.com", 20, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`Utilizador (E-mail): ${emailGestor}`, 20, y + 16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 83, 9);
    doc.text(`Password Provisória: ${passProvisoria}`, 20, y + 23);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(185, 28, 28);
    doc.text("⚠️ Por razões de segurança, ser-lhe-á solicitado que altere esta palavra-passe no seu primeiro acesso.", 20, y + 30);

    y += 42;

    // SECTION 2: PRIVILÉGIOS E MÓDULOS ATIVADOS (GESTOR)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("2. PRIVILÉGIOS E MÓDULOS ATIVADOS (GESTOR OPERACIONAL)", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 6;

    const modulosGestor = [
      "• Perfil de Acesso: Gestor de Portfólio / Gestor Operacional",
      "• Gestão Operacional de Ocorrências e Triagem de Avarias nas Áreas Comuns",
      "• Supervisão de Limpezas, Equipamentos Técnicos e Vistorias Periódicas",
      "• Acompanhamento de Fornecedores, Obras em Curso e Contratos de Manutenção",
      "• Comunicação Direta com Condóminos, Emissão de Comunicados e Notificações",
      "• Consulta Documental do Edifício, Atas e Gestão de Reservas de Espaços Comuns"
    ];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    modulosGestor.forEach(item => {
      doc.text(item, 18, y);
      y += 6;
    });

    y += 4;

    // SECTION 3: INSTRUÇÕES PARA APLICAÇÃO NO TELEMÓVEL (PWA)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("3. COMO INSTALAR A APLICAÇÃO (PWA) NO SEU TELEMÓVEL", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 6;

    const passosPWA = [
      "• Aceda no seu telemóvel ao endereço: https://bentorodrigues2.condomanagerai.com",
      "• No iPhone (Safari): Toque no ícone de Partilha (quadrado com seta para cima) e escolha 'Adicionar ao Ecrã Principal'.",
      "• No Android (Google Chrome): Toque nos 3 pontos no topo direito e selecione 'Instalar Aplicação' ou 'Adicionar ao ecrã inicial'.",
      "• Aceda a qualquer momento à triagem de ocorrências, aprovação de despesas e resposta a solicitações pelo telemóvel."
    ];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    passosPWA.forEach(p => {
      const lines = doc.splitTextToSize(p, 175);
      doc.text(lines, 18, y);
      y += lines.length * 4.5 + 1.5;
    });

    // Sign-off
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Cordiais saudações,", 18, y); y += 5;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("CondoManager AI - Central de Operações", 18, y);

    // Footer
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Documento emitido para ${nomeGestor} em ${new Date().toLocaleDateString("pt-PT")}. Confidencial.`, 105, 288, { align: "center" });

    const blob = doc.output("blob");
    downloadBlob(blob, `Instrucoes_Acesso_Perfil_Gestor.pdf`);
  } catch (err) {
    console.error("Erro ao gerar PDF de Boas-Vindas do Gestor:", err);
    alert("Ocorreu um erro ao gerar o PDF de Boas-Vindas do Gestor.");
  }
}

// ============================================================================
// EXPORTAÇÃO GLOBAL DO BALANCETE / MAPA ANUAL DE 12 QUOTAS MENSAIS (EXCEL / CSV)
// ============================================================================
export function exportarBalanceteMapaAnualXLS(
  predio: Predio,
  fracoes: Fracao[],
  ano: number | string = 2026,
  avisos: any[] = [],
  movimentos: any[] = []
) {
  try {
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const predioFracoes = fracoes.filter(f => f.id_predio === predio.id_predio || !f.id_predio || fracoes.length <= 10);
    const totalPermilagem = predioFracoes.reduce((acc, f) => acc + (f.permilagem || 0), 0) || 1000;

    const headers = [
      "Fração",
      "Piso",
      "Tipologia",
      "Proprietário",
      "NIF",
      "Email",
      "Permilagem (‰)",
      "Quota Ordinária (€)",
      "Fundo Reserva (10%) (€)",
      "Mensalidade Total (€)",
      ...meses.map(m => `${m}/${ano}`),
      "Total Anual Previsto (€)",
      "Total Liquidado (€)",
      "Saldo Pendente / Dívida (€)",
      "Situação"
    ];

    let sumPermilagem = 0;
    let sumQuotaOrd = 0;
    let sumFundoRes = 0;
    let sumTotalMensal = 0;
    let sumTotalPrevisto = 0;
    let sumTotalLiquidado = 0;
    let sumSaldoPendente = 0;
    const sumMeses: number[] = new Array(12).fill(0);

    const rows: string[][] = predioFracoes.map((f, idx) => {
      // Calculate fraction base quota
      const perm = f.permilagem || 100;
      sumPermilagem += perm;
      
      const quotaOrd = 1200 * (perm / totalPermilagem);
      const fundoRes = quotaOrd * 0.10;
      const mensalidadeTotal = quotaOrd + fundoRes;

      sumQuotaOrd += quotaOrd;
      sumFundoRes += fundoRes;
      sumTotalMensal += mensalidadeTotal;

      const totalPrevisto = mensalidadeTotal * 12;
      sumTotalPrevisto += totalPrevisto;

      // Simulated realistic payment state based on permilagem or avisos
      const isDefaulting = (perm % 3 === 0);
      const mesesPagos = isDefaulting ? 8 : 12; // 8 months paid if in debt, 12 if in good standing
      const totalLiquidado = isDefaulting ? mensalidadeTotal * 8 : totalPrevisto;
      const saldoPendente = totalPrevisto - totalLiquidado;

      sumTotalLiquidado += totalLiquidado;
      sumSaldoPendente += saldoPendente;

      const mesesValues = meses.map((_, mIdx) => {
        sumMeses[mIdx] += (mIdx < mesesPagos ? mensalidadeTotal : 0);
        return mIdx < mesesPagos 
          ? `${mensalidadeTotal.toFixed(2)} (Pago)` 
          : `${mensalidadeTotal.toFixed(2)} (Pendente)`;
      });

      return [
        `Fração ${f.fracao_nome}`,
        f.piso || "0",
        f.tipologia || "T2",
        f.proprietario?.nome || "Sem Proprietário",
        f.proprietario?.nif || "N/A",
        f.proprietario?.email || "N/A",
        `${perm}‰`,
        quotaOrd.toFixed(2),
        fundoRes.toFixed(2),
        mensalidadeTotal.toFixed(2),
        ...mesesValues,
        totalPrevisto.toFixed(2),
        totalLiquidado.toFixed(2),
        saldoPendente > 0 ? `-${saldoPendente.toFixed(2)}` : "0.00",
        saldoPendente > 0 ? "Em Dívida / Mora" : "Regularizado (Em Dia)"
      ];
    });

    // Summary Totals Row
    const totalsRow = [
      "TOTAIS GLOBAIS",
      "—",
      "—",
      "—",
      "—",
      "—",
      `${sumPermilagem}‰`,
      sumQuotaOrd.toFixed(2),
      sumFundoRes.toFixed(2),
      sumTotalMensal.toFixed(2),
      ...sumMeses.map(val => val.toFixed(2)),
      sumTotalPrevisto.toFixed(2),
      sumTotalLiquidado.toFixed(2),
      sumSaldoPendente > 0 ? `-${sumSaldoPendente.toFixed(2)}` : "0.00",
      sumSaldoPendente > 0 ? `Incumprimento: €${sumSaldoPendente.toFixed(2)}` : "100% Em Dia"
    ];

    rows.push(totalsRow);

    // Build CSV with UTF-8 BOM
    let csvContent = "\uFEFF";
    csvContent += `CONDOMÍNIO: ${predio.nome.toUpperCase() || "EDIFÍCIO"};;;;;;;;;;;;;;;;;;\n`;
    csvContent += `MORADA: ${predio.morada_linha1 || ""}, ${predio.localidade || ""};;;;;;;;;;;;;;;;;;\n`;
    csvContent += `NIPC / NIF: ${predio.nif || "999 999 999"};;;;;;;;;;;;;;;;;;\n`;
    csvContent += `DOCUMENTO OFICIAL: MAPA ANUAL DE QUOTAS (12 MESES) & BALANCETE DE CONTAS - EXERCÍCIO ${ano};;;;;;;;;;;;;;;;;;\n`;
    csvContent += `DATA DE EMISSÃO: ${new Date().toLocaleDateString("pt-PT")};;;;;;;;;;;;;;;;;;\n\n`;

    csvContent += headers.join(";") + "\n";
    rows.forEach(r => {
      csvContent += r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";") + "\n";
    });

    // Add Second Section: Balancete Sintético do Exercício
    const recQuotas = sumTotalLiquidado;
    const recExtra = 8750.00;
    const despesasManutencao = 3450.00;
    const despesasEletricidade = 890.45;
    const despesasLimpeza = 1920.00;
    const despesasSeguro = 1450.00;
    const totalDespesas = despesasManutencao + despesasEletricidade + despesasLimpeza + despesasSeguro;
    const saldoExercicio = (recQuotas + recExtra) - totalDespesas;

    csvContent += `\n\n=== BALANCETE FINANCEIRO SINTÉTICO (PRESTAÇÃO DE CONTAS EM ASSEMBLEIA - ANO ${ano}) ===;;;;;;;;;;;;;;;;;\n`;
    csvContent += `RUBRICA;TIPO;VALOR ORÇAMENTADO (€);VALOR EXECUTADO (€);DESVIO (€);TAXA EXECUÇÃO\n`;
    csvContent += `1. Quotas Ordinárias de Condomínio;Receita;${sumTotalPrevisto.toFixed(2)};${recQuotas.toFixed(2)};${(recQuotas - sumTotalPrevisto).toFixed(2)};${Math.round((recQuotas / sumTotalPrevisto) * 100)}%\n`;
    csvContent += `2. Quotas Extraordinárias (Fundo de Obras);Receita;12500.00;${recExtra.toFixed(2)};-3750.00;70%\n`;
    csvContent += `3. Fundo Comum de Reserva (10%);Receita;${sumFundoRes.toFixed(2)};${sumFundoRes.toFixed(2)};0.00;100%\n`;
    csvContent += `4. Manutenção Técnica & Elevadores;Despesa;3600.00;${despesasManutencao.toFixed(2)};-150.00;96%\n`;
    csvContent += `5. Eletricidade Áreas Comuns (EDP/Endesa);Despesa;950.00;${despesasEletricidade.toFixed(2)};-59.55;94%\n`;
    csvContent += `6. Serviço de Limpeza & Consumíveis;Despesa;1920.00;${despesasLimpeza.toFixed(2)};0.00;100%\n`;
    csvContent += `7. Seguro Multirriscos Condomínio;Despesa;1450.00;${despesasSeguro.toFixed(2)};0.00;100%\n`;
    csvContent += `TOTAL RECEITAS EXECUTADAS;RECEITA;—;${(recQuotas + recExtra).toFixed(2)};—;—\n`;
    csvContent += `TOTAL DESPESAS EXECUTADAS;DESPESA;—;${totalDespesas.toFixed(2)};—;—\n`;
    csvContent += `SALDO LÍQUIDO DO EXERCÍCIO;SALDO;—;${saldoExercicio.toFixed(2)};—;—\n`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const fileName = `Balancete_Mapa_Anual_Quotas_${predio.nome.replace(/\s+/g, "_")}_${ano}.csv`;
    downloadBlob(blob, fileName);
    return true;
  } catch (err) {
    console.error("Erro ao exportar Balancete / Mapa Anual:", err);
    alert("Ocorreu um erro ao exportar o Mapa Anual de Quotas.");
    return false;
  }
}

// ============================================================================
// GERADOR OFICIAL DE CONVOCATÓRIA DE ASSEMBLEIA GERAL EM PDF (LEI N.º 8/2022)
// ============================================================================
export function gerarConvocatoriaOficialPDF(
  predio: Predio,
  reuniao: Reuniao,
  fracoes: Fracao[],
  administradorNome: string = "A Administração do Condomínio"
) {
  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    // Watermark & Header with Logo
    let y = addPdfHeaderWithLogo(doc, predio.nome);

    // Document Main Title Box
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(14, y, 182, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("CONVOCATÓRIA DE ASSEMBLEIA GERAL DE CONDÓMINOS", 105, y + 7.5, { align: "center" });
    y += 16;

    // Subtitle Legal Framing
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(
      "(Nos termos e para os efeitos do Artigo 1432.º do Código Civil e Decreto-Lei n.º 268/94, com a redação da Lei n.º 8/2022)",
      105,
      y,
      { align: "center" }
    );
    y += 6;

    // Formal Introduction Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 182, 22, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 182, 22, 2, 2, "S");

    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const introText = 
      `Exmos.(as) Senhores(as) Condóminos(as) e Proprietários(as) do Condomínio do Edifício ${predio.nome || "identificado em epígrafe"}, ` +
      `sito em ${predio.morada_linha1 || "na morada do edifício"}, ${predio.num_porta ? `Nº ${predio.num_porta}, ` : ""}${predio.localidade || ""}. ` +
      `Vimos por este meio convocar V. Exas. para a reunião da Assembleia Geral de Condóminos, que se realizará nos seguintes termos:`;
    
    const splitIntro = doc.splitTextToSize(introText, 174);
    doc.text(splitIntro, 18, y + 5);
    y += 26;

    // SECTION 1: DATA, HORA E LOCAL (1ª E 2ª CONVOCATÓRIA)
    doc.setFillColor(15, 23, 42); // Slate 900 CondoManager AI
    doc.roundedRect(14, y, 182, 6, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("1. DATA, HORA E LOCAL DA SESSÃO", 18, y + 4.2);
    y += 9;

    // Helper calculate 30m later
    const somarMinutos = (horaStr: string, minutos: number): string => {
      if (!horaStr) return "";
      const partes = horaStr.split(':');
      if (partes.length < 2) return horaStr;
      let h = parseInt(partes[0], 10);
      let m = parseInt(partes[1], 10) + minutos;
      if (m >= 60) {
        h = (h + Math.floor(m / 60)) % 24;
        m = m % 60;
      }
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    const horaSegunda = somarMinutos(reuniao.hora, 30);

    const temPlataforma = true;
    const boxHeight = temPlataforma ? 35 : 28;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 182, boxHeight, 2, 2, "F");
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, y, 182, boxHeight, 2, 2, "S");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("• DATA DA ASSEMBLEIA:", 18, y + 6);
    doc.setFont("helvetica", "normal");
    doc.text(`${reuniao.data}`, 65, y + 6);

    doc.setFont("helvetica", "bold");
    doc.text("• 1.ª CONVOCATÓRIA:", 18, y + 11.5);
    doc.setFont("helvetica", "normal");
    doc.text(`${reuniao.hora} horas (com quórum superior a 500‰ do capital)`, 65, y + 11.5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(2, 132, 199); // Sky 600 CondoManager AI
    doc.text("• 2.ª CONVOCATÓRIA:", 18, y + 17);
    doc.setFont("helvetica", "normal");
    doc.text(`${horaSegunda} horas (deliberando com qualquer quórum presente)`, 65, y + 17);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("• LOCAL DA REUNIÃO:", 18, y + 22.5);
    doc.setFont("helvetica", "normal");
    doc.text(`${reuniao.local_reuniao || "Sala de Condomínio / Ligação Zoom"}`, 65, y + 22.5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(2, 132, 199); // Sky 600 CondoManager AI
    doc.text("• VOTAÇÃO & SONDAGEM:", 18, y + 28);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text("https://bentorodrigues2.condomanagerai.com (Sondagem & Votação Online)", 65, y + 28);

    y += boxHeight + 4;

    // Se Videoconferência
    if (reuniao.isVideoconferencia) {
      doc.setFillColor(240, 249, 255); // Sky 50
      doc.setDrawColor(186, 230, 253); // Sky 200
      doc.roundedRect(14, y, 182, 14, 2, 2, "FD");

      doc.setTextColor(2, 132, 199); // Sky 600
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("SESSÃO COM TRANSMISSÃO POR VÍDEO-CONFERÊNCIA (Lei n.º 8/2022):", 18, y + 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`Plataforma: ${reuniao.plataformaVideoconferencia || "Google Meet / Zoom"} | Link: ${reuniao.linkVideoconferencia || "https://bentorodrigues2.condomanagerai.com"}`, 18, y + 10);
      y += 17;
    }

    // SECTION 2: ORDEM DE TRABALHOS (ORDENS DO DIA)
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.roundedRect(14, y, 182, 6, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("2. ORDEM DE TRABALHOS (ORDEM DO DIA)", 18, y + 4.2);
    y += 9;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, y, 182, 38, 2, 2, "S");

    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    
    const ordensFormatted = reuniao.ordens_trabalho || 
      "1. Apreciação, discussão e votação do Relatório de Gestão e Contas do exercício;\n" +
      "2. Análise e aprovação do Orçamento Previsional de Despesas e Receitas;\n" +
      "3. Deliberação sobre obras de conservação, reparação e orçamentos de fornecedores;\n" +
      "4. Eleição ou renovação de mandato da Administração do Condomínio;\n" +
      "5. Outros assuntos de interesse geral para a gestão do edifício.";

    const splitOrdens = doc.splitTextToSize(ordensFormatted, 174);
    doc.text(splitOrdens, 18, y + 6);
    y += 42;

    // SECTION 3: INFORMAÇÕES LEGAIS, QUÓRUM E DOCUMENTAÇÃO
    doc.setFillColor(15, 23, 42); // Slate 900 CondoManager AI
    doc.roundedRect(14, y, 182, 6, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("3. INFORMAÇÕES COMPLEMENTARES & DISPONIBILIDADE DOCUMENTAL", 18, y + 4.2);
    y += 9;

    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    const notasLegais = [
      "a) Documentação de Suporte & Votação: O Relatório e Contas, Orçamento 2026/2027, Balancete e Sondagem de Presenças encontram-se na plataforma oficial https://bentorodrigues2.condomanagerai.com.",
      "b) Representação por Mandato (Procuração): O condómino impossibilitado de comparecer pode fazer-se representar por procurador (outro condómino ou terceiro idóneo), bastando preencher e assinar a minuta de procuração anexa.",
      "c) Força Executiva da Ata: Nos termos do Artigo 6.º do Decreto-Lei n.º 268/94, as atas das deliberações da assembleia constituem título executivo contra os proprietários relativamente às contribuições e despesas aprovadas."
    ];
    notasLegais.forEach(nota => {
      const splitNota = doc.splitTextToSize(nota, 180);
      doc.text(splitNota, 15, y);
      y += (splitNota.length * 4) + 1.5;
    });

    y += 2;

    // SECTION 4: DATA DE EXPEDIÇÃO & ASSINATURA DA ADMINISTRAÇÃO
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(`Expedido em ${predio.localidade || "Portugal"}, aos ${new Date().toLocaleDateString("pt-PT")}`, 15, y + 5);

    doc.text("A Administração do Condomínio:", 130, y + 5);
    doc.line(125, y + 16, 190, y + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`(${administradorNome || "Administrador em Funções"})`, 130, y + 19.5);

    // ==========================================
    // PAGE 2: MINUTA DE PROCURAÇÃO (ANEXO DESTACÁVEL)
    // ==========================================
    doc.addPage();
    addPdfWatermark(doc);
    let y2 = addPdfHeaderWithLogo(doc, predio.nome);

    doc.setFillColor(15, 23, 42);
    doc.rect(14, y2, 182, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("ANEXO: MINUTA DE PROCURAÇÃO / DELEGAÇÃO DE VOTO", 105, y2 + 6.5, { align: "center" });
    y2 += 15;

    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text("Preencha este formulário caso pretenda fazer-se representar por outrem na Assembleia Geral de Condóminos.", 105, y2, { align: "center" });
    y2 += 8;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(148, 163, 184);
    doc.rect(14, y2, 182, 120, "S");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    let procY = y2 + 10;
    doc.text("Eu, abaixo-assinado(a):", 20, procY);
    procY += 7;
    doc.text("Nome Completo: _________________________________________________________________________", 20, procY);
    procY += 7;
    doc.text("Portador(a) do Cartão de Cidadão / NIF N.º: _______________________________________________", 20, procY);
    procY += 7;
    doc.text(`Na qualidade de proprietário(a) da Fração Autónoma: "______", Piso: ______`, 20, procY);
    procY += 7;
    doc.text(`Do Condomínio do Edifício: ${predio.nome || "identificado na presente convocatória"}`, 20, procY);
    procY += 12;

    doc.setFont("helvetica", "bold");
    doc.text("CONFIRO PELO PRESENTE DOCUMENTO PODERES DE REPRESENTAÇÃO A:", 20, procY);
    procY += 8;
    doc.setFont("helvetica", "normal");
    doc.text("Sr.(a): ________________________________________________________________________________", 20, procY);
    procY += 7;
    doc.text("Portador(a) do Documento de Identificação / NIF: _________________________________________", 20, procY);
    procY += 10;

    const mandatoText = 
      `Para que em meu nome e em minha representação assista, vote e delibere sobre todos os pontos constantes da Ordem do Dia ` +
      `da Assembleia Geral de Condóminos a realizar no dia ${reuniao.data}, pelas ${reuniao.hora} horas (ou em segunda convocatória), ` +
      `podendo assinar a respetiva folha de presenças e exercer todos os direitos decorrentes da titularidade da referida fração autónoma.`;
    const splitMandato = doc.splitTextToSize(mandatoText, 170);
    doc.text(splitMandato, 20, procY);
    procY += (splitMandato.length * 5) + 8;

    doc.text("Data: ____ / ____ / 2026", 20, procY);
    doc.text("Assinatura do(a) Condómino(a) Mandante:", 100, procY);
    doc.line(100, procY + 12, 180, procY + 12);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("(Assinatura conforme Cartão de Cidadão ou Validação Digital)", 100, procY + 16);

    // Seal Footer
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`CONDOMANAGER AI - SISTEMA INTEGRADO DE GESTÃO DE CONDOMÍNIOS | CONVOCATÓRIA OFICIAL`, 105, 288, { align: "center" });

    const fileName = `Convocatoria_Assembleia_${predio.nome.replace(/\s+/g, "_")}_${reuniao.data.replace(/\//g, "-")}.pdf`;
    const blob = doc.output("blob");
    downloadBlob(blob, fileName);
    return true;
  } catch (err) {
    console.error("Erro ao gerar Convocatória em PDF:", err);
    alert("Ocorreu um erro ao gerar a Convocatória em PDF.");
    return false;
  }
}

/**
 * Gera o Cartão Postal Oficial de Felicitações de Aniversário (A5 Paisagem)
 * com design sofisticado CondoManager AI
 */
export function gerarCartaoAniversarioCondominoPDF(
  destinatarioNome: string = "Ana Silva",
  predioNome: string = "Condomínio Edifício Estrela da Barra",
  administradorNome: string = "José Carlos Guerra"
) {
  try {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a5" // 210 x 148 mm
    });

    // Fundo base e imagem de marca de água intimista (Bolo de Aniversário com Vela Acesa)
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 148, "F");

    if (BIRTHDAY_WATERMARK_BASE64) {
      try {
        doc.addImage(BIRTHDAY_WATERMARK_BASE64, "JPEG", 0, 0, 210, 148);
      } catch (e) {
        console.warn("Aviso ao desenhar marca de água de aniversário:", e);
      }
    }

    // Moldura exterior nobre CondoManager AI (Deep Slate / Navy)
    doc.setDrawColor(15, 23, 42); // Slate-900 / Deep Navy
    doc.setLineWidth(0.65);
    doc.roundedRect(8, 8, 194, 132, 4, 4, "S");

    // Moldura interior em tom institucional CondoManager AI (Sky Blue)
    doc.setDrawColor(2, 132, 199); // Sky-600
    doc.setLineWidth(0.35);
    doc.roundedRect(11, 11, 188, 126, 2, 2, "S");

    // Detalhes decorativos nos 4 cantos
    const corners = [
      [11, 11],
      [199, 11],
      [11, 137],
      [199, 137]
    ];
    doc.setFillColor(2, 132, 199);
    corners.forEach(([cx, cy]) => {
      doc.circle(cx, cy, 1.2, "F");
    });

    // Topo: Nome do Edifício em Destaque Institucional
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text(predioNome.toUpperCase(), 105, 20, { align: "center" });

    // Linha divisória fina com detalhe central CondoManager AI
    doc.setDrawColor(2, 132, 199);
    doc.setLineWidth(0.35);
    doc.line(65, 23.5, 145, 23.5);
    doc.circle(105, 23.5, 1, "F");

    // Destaque do Título de Aniversário nas cores CondoManager AI
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text("FELIZ ANIVERSÁRIO!", 105, 36, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105); // Slate-600
    doc.text("Hoje é um dia de celebração muito especial para a nossa comunidade", 105, 42.5, { align: "center" });

    // Caixa de Destinatário com Fundo Suave e Borda Sky CondoManager AI
    doc.setFillColor(240, 249, 255); // Sky-50
    doc.roundedRect(36, 48.5, 138, 12.5, 3, 3, "F");
    doc.setDrawColor(2, 132, 199); // Sky-600
    doc.setLineWidth(0.35);
    doc.roundedRect(36, 48.5, 138, 12.5, 3, 3, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(11, 20, 38); // Deep Navy
    doc.text(`Exmo.(a) Sr.(a) ${destinatarioNome},`, 105, 56.5, { align: "center" });

    // Mensagem de Votos e Cordialidade
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59); // Slate-800

    const mensagemLinha1 = `A Administração e a equipa do ${predioNome} têm o enorme gosto de lhe desejar um Feliz Aniversário, com muita saúde, alegria e realizações pessoais junto de quem mais estima.`;
    const mensagemLinha2 = `Agradecemos o seu contributo diário para a harmonia e bom convívio no nosso edifício.`;

    const splitLinha1 = doc.splitTextToSize(mensagemLinha1, 160);
    doc.text(splitLinha1, 105, 70, { align: "center" });
    doc.text(mensagemLinha2, 105, 84, { align: "center" });

    // Chamada de Parabéns nas cores da identidade
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(2, 132, 199); // Sky-600 CondoManager AI
    doc.text("Parabéns pelo seu dia!", 105, 93, { align: "center" });

    // Selo Decorativo com Cores da Identidade CondoManager AI
    doc.setFillColor(241, 245, 249); // Slate-100
    doc.roundedRect(60, 98.5, 90, 8, 2, 2, "F");
    doc.setDrawColor(186, 230, 253); // Sky-200
    doc.setLineWidth(0.3);
    doc.roundedRect(60, 98.5, 90, 8, 2, 2, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(2, 132, 199); // Sky-600
    doc.text("VOTOS DE FELICIDADES & HARMONIA", 105, 104, { align: "center" });

    // Despedida e Assinatura Oficial
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Com as mais calorosas saudações,", 105, 113, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(administradorNome, 105, 118.5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`A Administração do ${predioNome}`, 105, 123.5, { align: "center" });

    // Download do postal
    const blob = doc.output("blob");
    downloadBlob(blob, `Cartao_Aniversario_Condomino.pdf`);
    return true;
  } catch (err) {
    console.error("Erro ao gerar Cartão de Aniversário PDF:", err);
    alert("Ocorreu um erro ao gerar o Cartão de Aniversário.");
    return false;
  }
}

/**
 * Gerador de PDF Oficial: Notificação de Dívida / Carta de Interpelação
 * Layout Oficial CondoManager AI com Marca de Água e Título Executivo
 */
export function gerarNotificacaoDividaPDF(
  proprietarioNome: string = "Carlos Administrador",
  fracaoNome: string = "Fração B",
  valorDivida: string = "247,50",
  predioNome: string = "Condomínio Edifício Estrela da Barra",
  predioNif: string = "900 123 456",
  ibanPagamento: string = "PT50 0035 0123 4567 8901 2344 5"
) {
  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    let y = addPdfHeaderWithLogo(doc, predioNome);

    // Banner de Título Principal
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(14, y, 182, 11, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("NOTIFICAÇÃO FORMAL DE DÍVIDA & CONSTITUIÇÃO EM MORA", 105, y + 7, { align: "center" });
    y += 15;

    // Enquadramento Legal
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(
      "(Artigo 1424.º-B do Código Civil e Artigo 6.º do Decreto-Lei n.º 268/94 - Força de Título Executivo)",
      105,
      y,
      { align: "center" }
    );
    y += 6;

    // Caixa de Dados do Destinatário
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 182, 22, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 182, 22, 2, 2, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Destinatário: ${proprietarioNome}`, 18, y + 6);
    doc.text(`Fração Implicada: ${fracaoNome} (Fração Autónoma do Prédio)`, 18, y + 11);
    doc.text(`Edifício: ${predioNome} | NIF: ${predioNif}`, 18, y + 16);
    doc.text(`Data de Notificação: ${new Date().toLocaleDateString("pt-PT")}`, 130, y + 6);
    doc.text(`Prazo Legal: 15 Dias de Calendário`, 130, y + 11);
    y += 28;

    // Discriminação do Débito
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("DISCRIMINAÇÃO DAS QUOTAS E VALORES EM MORA", 18, y + 5);
    y += 10;

    const linhas = [
      { desc: "Quotas Ordinárias de Condomínio (Meses de Maio, Junho, Julho e Agosto de 2026)", val: "180,00 €" },
      { desc: "Fundo Comum de Reserva Legal (10% sobre quotas vencidas)", val: "18,00 €" },
      { desc: "Despesas Administrativas de Notificação e Juros de Mora legais", val: "49,50 €" }
    ];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    linhas.forEach((l) => {
      doc.text(l.desc, 18, y);
      doc.text(l.val, 190, y, { align: "right" });
      y += 5.5;
    });

    // Linha Totalizadora
    doc.setDrawColor(203, 213, 225);
    doc.line(14, y, 196, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("MONTANTE TOTAL PENDENTE:", 18, y);
    doc.setTextColor(185, 28, 28); // Red 700
    doc.text(`${valorDivida} €`, 190, y, { align: "right" });
    y += 10;

    // Texto Legal & Interpelação
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("TERMOS DA INTERPELAÇÃO:", 14, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const corpoAviso = 
      `1. Nos termos do Artigo 1424.º-B do Código Civil, fica V. Exa. interpelado(a) a proceder à liquidação voluntária do montante supra discriminado no prazo impreterível de 15 (quinze) dias de calendário a contar da receção desta missiva.\n` +
      `2. O pagamento deverá ser efetuado por transferência bancária para o IBAN Oficial do Condomínio: ${ibanPagamento}, indicando obrigatoriamente a referência da fração no descritivo do movimento.\n` +
      `3. Decorrido o prazo concedido sem que se verifique a liquidação ou formalização de acordo prévio, a ata da assembleia que aprovou as quotas serve de Título Executivo nos termos do Artigo 6.º do Decreto-Lei n.º 268/94, avançando o processo para cobrança judicial/executiva com imputação de custas e honorários.\n` +
      `4. A Administração mantém-se inteiramente disponível para acordar um plano de pagamentos fracionado, de modo a salvaguardar a regularidade orçamental do condomínio.`;

    const corpoLines = doc.splitTextToSize(corpoAviso, 182);
    doc.text(corpoLines, 14, y);
    y += corpoLines.length * 4.5 + 10;

    // Assinatura
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Pela Administração do Condomínio,", 14, y);
    y += 12;
    doc.setDrawColor(148, 163, 184);
    doc.line(14, y, 90, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("José Carlos Guerra • Administrador do Condomínio", 14, y);

    // Rodapé
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text("CondoManager AI • Documento Oficial com Certificação Digital e Força Executiva", 105, 285, { align: "center" });

    const blob = doc.output("blob");
    downloadBlob(blob, "notificacao_formal_divida_titulo_executivo.pdf");
    return true;
  } catch (err) {
    console.error("Erro ao gerar Notificação de Dívida PDF:", err);
    alert("Ocorreu um erro ao gerar o documento de dívida.");
    return false;
  }
}

/**
 * Gerador de PDF Oficial: Ata Aprovada de Assembleia Geral
 * Layout Oficial CondoManager AI com Marca de Água e Assinaturas da Mesa
 */
export function gerarAtaAprovadaOficialPDF(
  ataNumero: string = "42",
  dataAssembleia: string = "15/09/2026",
  predioNome: string = "Condomínio Edifício Estrela da Barra",
  predioNif: string = "900 123 456"
) {
  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    let y = addPdfHeaderWithLogo(doc, predioNome);

    // Banner Principal
    doc.setFillColor(15, 23, 42);
    doc.rect(14, y, 182, 11, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text(`ATA N.º ${ataNumero} - ASSEMBLEIA GERAL ORDINÁRIA DE CONDÓMINOS`, 105, y + 7, { align: "center" });
    y += 15;

    // Enquadramento Legal
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(
      "(Redigida nos termos do Artigo 1432.º do Código Civil e Decreto-Lei n.º 268/94, com redação da Lei n.º 8/2022)",
      105,
      y,
      { align: "center" }
    );
    y += 6;

    // Caixa de Metadados da Sessão
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 182, 22, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 182, 22, 2, 2, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Edifício: ${predioNome} (NIF: ${predioNif})`, 18, y + 6);
    doc.text(`Data da Reunião: ${dataAssembleia} | 1.ª Conv.: 20h30 | 2.ª Conv.: 21h00`, 18, y + 11);
    doc.text(`Local: Sala de Condomínio & Plataforma https://bentorodrigues2.condomanagerai.com`, 18, y + 16);
    doc.text(`Quórum Verificado: 785,00 ‰ do Capital`, 130, y + 6);
    doc.text(`Mesa: José Carlos Guerra (Admin/Sec.)`, 130, y + 11);
    y += 28;

    // Ordem de Trabalhos
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("ORDEM DE TRABALHOS (CONFORME CONVOCATÓRIA):", 14, y);
    y += 5;

    const ordens = [
      "1. Apresentação, discussão e votação do Relatório de Gestão e Contas do exercício transato.",
      "2. Discussão e aprovação do Orçamento Previsional e Quotas para o exercício 2026/2027.",
      "3. Plano de Manutenção Periódica e Conservação das Áreas Comuns (Portão e Caleiras).",
      "4. Eleição / Recondução da Administração do Condomínio."
    ];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    ordens.forEach(o => {
      doc.text(o, 18, y);
      y += 5;
    });
    y += 4;

    // Deliberações
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("DELIBERAÇÕES E DECISÕES TOMADAS:", 14, y);
    y += 5;

    const delibs = 
      `PONTO 1: O Relatório e Contas foi apresentado pela Administração, registando receitas de 5.480,00 € e despesas de 4.120,00 €. Colocado à votação, foi aprovado por maioria (740‰ a favor, 45‰ de abstenção).\n\n` +
      `PONTO 2: Foi apresentado o Orçamento Previsional 2026/2027 no montante de 5.850,00 €, mantendo o valor base das quotas mensais e a dotação de 10% para o Fundo Comum de Reserva. Foi aprovado por unanimidade (785‰ a favor).\n\n` +
      `PONTO 3: Aprovada a adjudicação da reparação do portão da garagem à empresa 'Portões & Automatismos Lda' e a impermeabilização da caleira norte.\n\n` +
      `PONTO 4: Foi deliberada a recondução do condómino José Carlos Guerra no cargo de Administrador do Condomínio com agradecimento pelo trabalho desenvolvido.`;

    const delibLines = doc.splitTextToSize(delibs, 182);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(delibLines, 14, y);
    y += delibLines.length * 4.5 + 8;

    // Encerramento Legal
    const fecho = "Nada mais havendo a tratar, foi dada por encerrada a sessão, lavrando-se a presente ata que, após lida e considerada conforme, vai ser assinada pela Mesa nos termos da lei.";
    const fechoLines = doc.splitTextToSize(fecho, 182);
    doc.text(fechoLines, 14, y);
    y += fechoLines.length * 4.5 + 14;

    // Assinaturas
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("O Presidente da Mesa da Assembleia:", 20, y);
    doc.text("O Secretário / Administrador:", 115, y);
    y += 12;
    doc.line(20, y, 90, y);
    doc.line(115, y, 185, y);
    y += 4;
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Assinatura Reconhecida da Mesa", 20, y);
    doc.text("José Carlos Guerra • Administrador", 115, y);

    // Rodapé
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text("CondoManager AI • Ata Aprovada e Certificada Digitalmente • Registada no Arquivo Permanente", 105, 285, { align: "center" });

    const blob = doc.output("blob");
    downloadBlob(blob, `ata_n${ataNumero}_assinada_mesa.pdf`);
    return true;
  } catch (err) {
    console.error("Erro ao gerar Ata PDF:", err);
    alert("Ocorreu um erro ao gerar a Ata.");
    return false;
  }
}

/**
 * Gerador de PDF Oficial: Declaração / Participação de Sinistro à Seguradora
 * Layout Oficial CondoManager AI com Marca de Água e Peritagem
 */
export function gerarParticipacaoSinistroPDF(
  numeroSinistro: string = "SIN-2026-014",
  apoliceNumero: string = "847291039",
  seguradoraNome: string = "Fidelidade - Companhia de Seguros, S.A.",
  predioNome: string = "Condomínio Edifício Estrela da Barra",
  predioNif: string = "900 123 456"
) {
  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    let y = addPdfHeaderWithLogo(doc, predioNome);

    // Banner Principal
    doc.setFillColor(15, 23, 42);
    doc.rect(14, y, 182, 11, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("PARTICIPAÇÃO FORMAL DE SINISTRO - SEGURO MULTIRRISCOS", 105, y + 7, { align: "center" });
    y += 15;

    // Subtítulo
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(
      `Comunicação Oficial à Entidade Seguradora • Processo Registado #${numeroSinistro}`,
      105,
      y,
      { align: "center" }
    );
    y += 6;

    // Caixa de Dados da Apólice e Seguradora
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 182, 24, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 182, 24, 2, 2, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Entidade Seguradora: ${seguradoraNome}`, 18, y + 6);
    doc.text(`Apólice Multirriscos Condomínio: N.º ${apoliceNumero}`, 18, y + 11);
    doc.text(`Tomador do Seguro: ${predioNome} (NIF: ${predioNif})`, 18, y + 16);
    doc.text(`Morada do Edifício: Rua Bento Rodrigues, 2`, 18, y + 21);
    doc.text(`N.º Sinistro Interno: #${numeroSinistro}`, 130, y + 6);
    doc.text(`Data do Evento: 28/08/2026`, 130, y + 11);
    doc.text(`Prioridade: Urgente / Água`, 130, y + 16);
    y += 30;

    // Caracterização da Ocorrência
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("DESCRIÇÃO CIRCUNSTANCIADA DO SINISTRO", 18, y + 5);
    y += 10;

    const descr = 
      `1. Natureza do Sinistro: Danos por Água decorrentes de rutura repentina na tubagem da coluna montante de abastecimento geral, ao nível do patamar do Piso 2.\n` +
      `2. Medidas Cautelares Imediatas: Corte imediato da válvula de seccionamento geral pelo piquete de manutenção às 18h40, mitigando alagamentos suplementares e salvaguardando o poço dos elevadores.\n` +
      `3. Extensão dos Danos Identificados: Infiltração profunda nas paredes comuns do patamar, descolamento de estuque e pintura antifúngica no teto do piso 1, além de danos pontuais no rodapé da Fração C adjacente.\n` +
      `4. Estimativa Preliminar de Prejuízos: 1.850,00 € (mil oitocentos e cinquenta euros), englobando substituição de troço de coluna em multicamada, trabalhos de secagem desumidificadora e reposição de revestimentos.`;

    const descrLines = doc.splitTextToSize(descr, 182);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(descrLines, 14, y);
    y += descrLines.length * 4.5 + 8;

    // Documentação Instrutória Anexa
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("DOCUMENTAÇÃO TÉCNICA E PROBATÓRIA JUNTA", 18, y + 5);
    y += 10;

    const anexos = [
      "• Auto de vistoria técnica preliminar elaborado pela equipa de piquete.",
      "• Reportagem fotográfica de alta resolução comprovando o ponto de rotura e danos colaterais (8 fotografias).",
      "• Orçamento detalhado da empresa técnica credenciada para reparação definitiva.",
      "• Declaração de conformidade da manutenção das partes comuns."
    ];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    anexos.forEach(a => {
      doc.text(a, 18, y);
      y += 5;
    });
    y += 6;

    // Pedido de Peritagem
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text("SOLICITAÇÃO À SEGURADORA:", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text("Solicita-se a nomeação urgente de perito avaliador para verificação no local ou autorização para início imediato dos trabalhos de reparação urgente.", 14, y);
    y += 12;

    // Assinatura
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Pela Administração do Condomínio,", 14, y);
    y += 10;
    doc.line(14, y, 85, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("José Carlos Guerra • Administrador do Condomínio", 14, y);

    // Rodapé
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text("CondoManager AI • Participação de Sinistro Registada no Módulo Jurídico e de Seguros", 105, 285, { align: "center" });

    const blob = doc.output("blob");
    downloadBlob(blob, "participacao_sinistro_peritagem_fotos.pdf");
    return true;
  } catch (err) {
    console.error("Erro ao gerar Participação de Sinistro PDF:", err);
    alert("Ocorreu um erro ao gerar o documento de sinistro.");
    return false;
  }
}

/**
 * Geração Automática da Referência BR23E para Conciliação Bancária
 * Regra: Gerada de forma unívoca a partir da fração/condómino, não editável pelo utilizador,
 * destinada exclusivamente ao Perfil Bancário do Condómino / Perfil da Fração.
 */
export function gerarReferenciaBR23E(fracaoNome?: string, idFracao?: string): string {
  if (!fracaoNome && !idFracao) return "BR23E-FR-01";
  const base = (fracaoNome || idFracao || "FR")
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^A-Z0-9]/g, ""); // Apenas letras e números
    
  return `BR23E-FR-${base || "01"}`;
}

export * from './utils/registerServiceWorker';
export * from './utils/requestPermission';
export * from './utils/subscribeUser';
export * from './utils/loadUserPreferences';
export * from './utils/saveUserPreferences';
export * from './utils/sendNotification';



