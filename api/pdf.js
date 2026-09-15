import { gerarDocumentoPDF } from "../server/lib/pdfService.js";

const TIPOS = {
  convocatoria: { tema: "Assembleias", tipo: "Convocatória", fluxo: "convocatoria" },
  ata: { tema: "Assembleias", tipo: "Ata", fluxo: "ata" },
  aviso: { tema: "Avisos", tipo: "Aviso", fluxo: "aviso" },
  recibo: { tema: "Financeiro", tipo: "Recibo", fluxo: "recibo" },
  "carta-n1": { tema: "Comunicações", tipo: "Carta N1", fluxo: "carta_n1" },
  "carta-n2": { tema: "Comunicações", tipo: "Carta N2", fluxo: "carta_n2" },
  "boas-vindas": { tema: "Comunicações", tipo: "Boas-vindas", fluxo: "boas_vindas" },
  sinistro: { tema: "Seguros", tipo: "Sinistro", fluxo: "sinistro" },
  scie: { tema: "SCIE", tipo: "Relatório SCIE", fluxo: "scie" }
};

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
    const resultado = await gerarDocumentoPDF({
      conteudo: body.conteudo,
      ano: body.ano,
      tema: config.tema,
      tipo: config.tipo,
      predio: body.predio,
      fracao: body.fracao,
      fluxo: config.fluxo,
      emailDestino: body.email,
      nomeFicheiro: `${tipo}_${body.ano}.pdf`
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
