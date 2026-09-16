import { gerarDocumentoPDF, guardarNoArquivo, registarDocumento, enviarEmailPDF } from "../server/lib/pdfService.js";
import {
  generateCondominoPwaManualPDF,
  gerarPdfRegistoFornecedorHomologado,
  gerarConvocatoriaOficialPDF,
  gerarNotificacaoDividaPDF,
  gerarAtaAprovadaOficialPDF,
  gerarParticipacaoSinistroPDF,
  gerarTermoAcordoPagamentoPDF,
  gerarNotificacaoObrasIrregularesPDF,
  gerarPdfBoasVindasGestor
} from "../server/lib/pdfDocs.js";

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
  scie: { tema: "SCIE", tipo: "Relatório SCIE", fluxo: "scie" },
  "convocatoria-oficial": { tema: "Assembleias", tipo: "Convocatória", fluxo: "convocatoria_oficial", categoria: "Atas & Convocatórias" },
  "notificacao-divida": { tema: "Comunicações", tipo: "Notificação de Dívida", fluxo: "notificacao_divida" },
  "ata-aprovada": { tema: "Assembleias", tipo: "Ata", fluxo: "ata_aprovada", categoria: "Atas & Convocatórias" },
  "participacao-sinistro": { tema: "Seguros", tipo: "Participação de Sinistro", fluxo: "participacao_sinistro", categoria: "Seguros & Apólices" },
  "termo-acordo-pagamento": { tema: "Contencioso e Ações Judiciais", tipo: "Termo de Acordo de Pagamento", fluxo: "termo_acordo_pagamento", categoria: "Processos Judiciais & Contencioso" },
  "notificacao-obras-irregulares": { tema: "Contencioso e Ações Judiciais", tipo: "Notificação de Obras Irregulares", fluxo: "notificacao_obras_irregulares", categoria: "Processos Judiciais & Contencioso" },
  "boas-vindas-gestor": { tema: "Comunicações", tipo: "Boas-vindas Gestão", fluxo: "boas_vindas_gestao" }
};

const TIPOS_ESPECIAIS = new Set([
  "boas-vindas",
  "registo-fornecedor",
  "convocatoria-oficial",
  "notificacao-divida",
  "ata-aprovada",
  "participacao-sinistro",
  "termo-acordo-pagamento",
  "notificacao-obras-irregulares",
  "boas-vindas-gestor"
]);

/**
 * Estes tipos têm documento próprio já desenhado (layout legal/oficial em
 * src/utils.ts) em vez do PDF de texto genérico usado pelos outros tipos.
 */
function gerarDocEspecial(tipo, body) {
  if (tipo === "boas-vindas") {
    return {
      doc: generateCondominoPwaManualPDF(body.nome, body.buildingName, body.password, true),
      nomeFicheiro: "Instrucoes_Site_e_PWA_Condomino.pdf",
      assunto: `Bem-vindo(a) ao ${body.buildingName || "Condomínio"} — Acesso à Área do Condómino`,
      mensagem: `É com muito gosto que lhe damos as boas-vindas ao <strong>${body.buildingName || "condomínio"}</strong>. Segue em anexo o guia oficial com os seus dados de acesso à área reservada do condómino e as instruções de instalação da aplicação (PWA) no telemóvel.`,
      categoria: "Instruções PWA & Desktop"
    };
  }

  if (tipo === "registo-fornecedor") {
    return {
      doc: gerarPdfRegistoFornecedorHomologado(body.fornecedor || {}, body.predioObj || undefined, true),
      nomeFicheiro: "Instrucoes_Acesso_Perfil_Fornecedor.pdf",
      assunto: "Registo como Fornecedor Homologado — Instruções de Acesso",
      mensagem: `O seu registo como fornecedor homologado foi concluído com sucesso. Segue em anexo o documento com as instruções de acesso ao seu perfil.`
    };
  }

  if (tipo === "convocatoria-oficial") {
    return {
      doc: gerarConvocatoriaOficialPDF(body.predioObj, body.reuniao, body.fracoes || [], body.administradorNome, true),
      nomeFicheiro: `Convocatoria_${(body.reuniao?.data || "assembleia").replace(/\//g, "-")}.pdf`,
      assunto: `Convocatória de Assembleia Geral — ${body.predioObj?.nome || "Condomínio"}`,
      mensagem: `Segue em anexo a convocatória oficial para a Assembleia Geral de Condóminos, nos termos e para os efeitos do Artigo 1432.º do Código Civil.`
    };
  }

  if (tipo === "notificacao-divida") {
    return {
      doc: gerarNotificacaoDividaPDF(body.proprietarioNome, body.fracaoNome, body.valorDivida, body.predioNome, body.predioNif, body.ibanPagamento, true),
      nomeFicheiro: `Notificacao_Divida_${(body.fracaoNome || "fracao").replace(/\s+/g, "_")}.pdf`,
      assunto: `Notificação Formal de Dívida — Fração ${body.fracaoNome || ""}`,
      mensagem: `Segue em anexo notificação formal referente à dívida em aberto da sua fração junto do condomínio.`
    };
  }

  if (tipo === "ata-aprovada") {
    return {
      doc: gerarAtaAprovadaOficialPDF(body.ataNumero, body.dataAssembleia, body.predioNome, body.predioNif, true, body.conteudoReal),
      nomeFicheiro: `Ata_N${body.ataNumero || ""}_Assinada.pdf`,
      assunto: `Ata Aprovada n.º ${body.ataNumero || ""} — ${body.predioNome || "Condomínio"}`,
      mensagem: `Em cumprimento do disposto no n.º 1 do Artigo 1432.º do Código Civil e da Lei n.º 8/2022, remete-se em anexo a cópia integral da ata respeitante à Assembleia Geral realizada a ${body.dataAssembleia || ""}.<br><br>Os condóminos ausentes dispõem do prazo de 90 dias após a receção desta comunicação para exercer o direito de oposição às deliberações tomadas, caso assim o entendam.`
    };
  }

  if (tipo === "participacao-sinistro") {
    return {
      doc: gerarParticipacaoSinistroPDF(body.numeroSinistro, body.apoliceNumero, body.seguradoraNome, body.predioNome, body.predioNif, true),
      nomeFicheiro: `Participacao_Sinistro_${body.numeroSinistro || ""}.pdf`,
      assunto: `Participação Urgente de Sinistro — Apólice n.º ${body.apoliceNumero || ""} — ${body.predioNome || ""}`,
      mensagem: `Vimos por este meio formalizar a participação de sinistro ocorrido nas partes comuns do condomínio. Segue em anexo o auto de vistoria com registo fotográfico para efeitos de marcação de peritagem técnica.`
    };
  }

  if (tipo === "termo-acordo-pagamento") {
    return {
      doc: gerarTermoAcordoPagamentoPDF(body.acordo || {}, true),
      nomeFicheiro: `Termo_Acordo_Pagamento_${(body.acordo?.fracaoNome || "fracao").replace(/\s+/g, "_")}.pdf`,
      assunto: `Termo de Acordo de Pagamento em Prestações — Fração ${body.acordo?.fracaoNome || ""}`,
      mensagem: `Segue em anexo o Termo de Acordo de Pagamento em Prestações relativo à regularização da dívida da sua fração, conforme negociado com a Administração.`
    };
  }

  if (tipo === "notificacao-obras-irregulares") {
    return {
      doc: gerarNotificacaoObrasIrregularesPDF(body.notificacao || {}, true),
      nomeFicheiro: `Notificacao_Obras_Irregulares_${(body.notificacao?.fracaoNome || "fracao").replace(/\s+/g, "_")}.pdf`,
      assunto: `Notificação de Cessação de Obras / Violação do Regulamento — Fração ${body.notificacao?.fracaoNome || ""}`,
      mensagem: `Segue em anexo notificação formal relativa a obras não autorizadas / violação do regulamento interno detetada na sua fração.`
    };
  }

  // boas-vindas-gestor (cobre também Super Admin, quando gestor.perfil === "ADMIN")
  const gestor = body.gestor || {};
  const ehAdmin = gestor.perfil === "ADMIN";
  return {
    doc: gerarPdfBoasVindasGestor(gestor, body.predios || [], body.empresaNome, body.logoUrl, true),
    nomeFicheiro: ehAdmin ? "Instrucoes_Acesso_Perfil_Administrador.pdf" : "Instrucoes_Acesso_Perfil_Gestor.pdf",
    assunto: ehAdmin ? "Nomeação & Ativação de Acesso à Gestão — Administrador" : "Nomeação & Ativação de Acesso à Gestão — Gestor Operacional",
    mensagem: `Foi ativado o seu perfil de acesso à gestão do condomínio. Segue em anexo o documento com as credenciais provisórias e o guia de acesso à plataforma.`
  };
}

async function gerarDocumentoEspecial(tipo, config, body) {
  const ano = body.ano || new Date().getFullYear();
  const { doc, nomeFicheiro, assunto, mensagem, categoria } = gerarDocEspecial(tipo, body);
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
    categoria: categoria || config.categoria,
    visibilidade: "Público"
  });

  // "convocatoria-oficial" vai para todos os condóminos (destinatarios[]);
  // os restantes tipos especiais vão para um único destinatário (email)
  const destinatarios = Array.isArray(body.destinatarios) && body.destinatarios.length
    ? body.destinatarios
    : body.email
      ? [{ email: body.email, nome: body.nome || body.fornecedor?.nome || body.proprietarioNome || body.gestor?.nome || body.seguradoraNome }]
      : [];

  let enviados = 0;
  for (const dest of destinatarios) {
    if (!dest?.email) continue;
    await enviarEmailPDF({
      to: dest.email,
      nomeDestinatario: dest.nome,
      assunto,
      mensagem,
      pdfBuffer,
      nome: nomeFicheiro
    });
    enviados += 1;
  }

  return { caminho, email_enviado: enviados > 0, total_enviados: enviados };
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

    if (TIPOS_ESPECIAIS.has(tipo)) {
      const resultado = await gerarDocumentoEspecial(tipo, config, body);
      return res.status(200).json({ ok: true, ...resultado });
    }

    const resultado = await gerarDocumentoPDF({
      conteudo: body.conteudo,
      ano: body.ano,
      tema: config.tema,
      tipo: config.tipo,
      predio: body.predio,
      predioNome: body.predioNome,
      fracao: body.fracao,
      fluxo: config.fluxo,
      emailDestino: body.email,
      nomeDestinatario: body.nome || body.proprietarioNome,
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
