import { gerarDocumentoPDF, guardarNoArquivo, registarDocumento, enviarEmailPDF } from "../server/lib/pdfService.js";
import { generateCondominoPwaManualPDF, gerarPdfRegistoFornecedorHomologado } from "../server/lib/pdfDocs.js";

const TIPOS = {
  convocatoria: { tema: "Assembleias", tipo: "Convocatória", fluxo: "convocatoria", categoria: "Atas & Convocatórias" },
  ata: { tema: "Assembleias", tipo: "Ata", fluxo: "ata", categoria: "Atas & Convocatórias" },
  aviso: { tema: "Avisos", tipo: "Aviso", fluxo: "aviso" },
  recibo: { tema: "Financeiro", tipo: "Recibo", fluxo: "recibo", categoria: "Pasta Paga. Quotas" },
  "carta-n1": { tema: "Comunicações", tipo: "Carta N1", fluxo: "carta_n1" },
  "carta-n2": { tema: "Comunicações", tipo: "Carta N2", fluxo: "carta_n2" },
  "boas-vindas": { tema: "Comunicações", tipo: "Boas-vindas", fluxo: "boas_vindas" },
  "registo-fornecedor": { tema: "Fornecedores", tipo: "Registo de Fornecedor", fluxo: "registo_fornecedor" },
  sinistro: { tema: "Seguros", tipo: "Sinistro", fluxo: "sinistro", categoria: "Seguros & Apólices" },
  scie: { tema: "SCIE", tipo: "Relatório SCIE", fluxo: "scie" }
};

/**
 * "boas-vindas" e "registo-fornecedor" têm documento próprio já desenhado
 * (guia PWA com credenciais / instruções de acesso do fornecedor — ver
 * src/utils.ts) em vez do PDF de texto genérico usado pelos outros tipos.
 */
async function gerarDocumentoEspecial(tipo, config, body) {
  const ano = body.ano || new Date().getFullYear();
  let doc;
  let nomeFicheiro;
  let assunto;
  let mensagem;

  if (tipo === "boas-vindas") {
    doc = generateCondominoPwaManualPDF(body.nome, body.buildingName, body.password, true);
    nomeFicheiro = "Instrucoes_Site_e_PWA_Condomino.pdf";
    assunto = `Bem-vindo(a) ao ${body.buildingName || "Condomínio"} — Acesso à Área do Condómino`;
    mensagem = `É com muito gosto que lhe damos as boas-vindas ao <strong>${body.buildingName || "condomínio"}</strong>. Segue em anexo o guia oficial com os seus dados de acesso à área reservada do condómino e as instruções de instalação da aplicação (PWA) no telemóvel.`;
  } else {
    doc = gerarPdfRegistoFornecedorHomologado(body.fornecedor || {}, body.predioObj || undefined, true);
    nomeFicheiro = "Instrucoes_Acesso_Perfil_Fornecedor.pdf";
    assunto = "Registo como Fornecedor Homologado — Instruções de Acesso";
    mensagem = `O seu registo como fornecedor homologado foi concluído com sucesso. Segue em anexo o documento com as instruções de acesso ao seu perfil.`;
  }

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  const caminho = await guardarNoArquivo({
    pdfBuffer,
    ano,
    tema: config.tema,
    tipo: config.tipo,
    predio: body.predio || "geral",
    fracao: body.fracao || "geral",
    fluxo: config.fluxo,
    nomeFicheiro
  });

  await registarDocumento({
    caminho,
    ano,
    tema: config.tema,
    tipo: config.tipo,
    predio: body.predio || null,
    fracao: body.fracao || null,
    fluxo: config.fluxo,
    origem: `pdf_${tipo.replace(/-/g, "_")}`,
    nomeFicheiro,
    // O Arquivo Digital identifica os manuais/guias PWA por esta categoria
    // (ver GestaoDocumentos.tsx, isManualDoc) — sem isto o guia de
    // boas-vindas não aparecia na pasta certa.
    categoria: tipo === "boas-vindas" ? "Instruções PWA & Desktop" : undefined,
    visibilidade: "Público"
  });

  if (body.email) {
    await enviarEmailPDF({
      to: body.email,
      nomeDestinatario: body.nome || body.fornecedor?.nome,
      assunto,
      mensagem,
      pdfBuffer,
      nome: nomeFicheiro
    });
  }

  return { caminho, email_enviado: Boolean(body.email) };
}

export default async function handler(req, res) {
  const tipo = req.query?.tipo;
  const config = TIPOS[tipo];

  if (req.method === "GET") {
    return res.status(200).json({
      status: "online",
      endpoint: "/api/pdf",
      tiposDisponiveis: Object.keys(TIPOS)
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  if (!config) {
    return res.status(400).json({
      error: `Tipo inválido. Use ?tipo=${Object.keys(TIPOS).join("|")}`
    });
  }

  try {
    const body = req.body || {};

    if (tipo === "boas-vindas" || tipo === "registo-fornecedor") {
      const resultado = await gerarDocumentoEspecial(tipo, config, body);
      return res.status(200).json({ ok: true, ...resultado });
    }

    const resultado = await gerarDocumentoPDF({
      conteudo: body.conteudo,
      ano: body.ano,
      tema: config.tema,
      tipo: config.tipo,
      predio: body.predio,
      fracao: body.fracao,
      fluxo: config.fluxo,
      emailDestino: body.email,
      nomeFicheiro: `${tipo}_${body.ano}.pdf`,
      categoria: config.categoria
    });

    return res.status(200).json({ ok: true, ...resultado });
  } catch (err) {
    console.error(`Erro ao gerar PDF (${tipo}):`, err);
    return res.status(500).json({
      error: "Erro ao gerar documento PDF",
      detail: err?.message || String(err)
    });
  }
}
