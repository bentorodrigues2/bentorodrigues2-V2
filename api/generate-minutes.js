import { generateWithFallback } from "../server/geminiService.ts";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "online", endpoint: "/api/generate-minutes" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const body = req.body || {};
    const prompt = `Redige uma Minuta Oficial de Ata de Assembleia Geral de Condóminos em estrita conformidade com o Artigo 1432.º e 1433.º do Código Civil Português e Decreto-Lei 268/2022.
REGRAS OBRIGATÓRIAS:
- A reunião é presidida e conduzida pelo Administrador do Condomínio, que lavra e assina a ata.
- NÃO incluir nem fazer qualquer menção à figura de "Secretário da Mesa" nem campos para assinatura de secretário.
- A ata é assinada pelo Presidente da Mesa (Administrador) e subscrita pelos condóminos presentes e representados.

Dados da Assembleia:
Tema / Convocatória: ${body.tema || "Assembleia Geral Ordinária"}
Data e Hora: ${body.data || ""} ${body.hora || ""}
Local / Meio: ${body.local || "Instalações do Condomínio"}
Quórum e Participantes: ${JSON.stringify(body.participantes || body.presentes || [])}
Ausentes: ${JSON.stringify(body.ausentes || [])}
Pontos da Ordem de Trabalhos e Deliberações: ${JSON.stringify(body.deliberacoes || body.pontos || body.notas || [])}

Gera a ata integral estruturada com introdução, verificação de quórum por permilagem (1ª e 2ª convocatórias), deliberações ponto por ponto com resultados das votações (votos a favor, contra e abstenções com respetiva permilagem), e encerramento formal assinado pelo Presidente da Mesa.`;

    const responseText = await generateWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    return res.status(200).json({ minutesText: responseText, ata: responseText });
  } catch (err) {
    console.error("[/api/generate-minutes] Erro:", err);
    return res.status(500).json({ error: err?.message || "Erro ao gerar minuta de ata." });
  }
}
