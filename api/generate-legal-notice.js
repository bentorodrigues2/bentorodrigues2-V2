import { generateWithFallback } from "../server/geminiService.ts";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "online", endpoint: "/api/generate-legal-notice" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { proprietario, fracao } = req.body || {};
    const prompt = `Como advogado especialista em Direito de Condomínios em Portugal (Código Civil artigos 1414.º a 1438.º-A e Decreto-Lei 268/2022), redige uma Notificação Formal de Cobrança Extrajudicial de Quotas de Condomínio em Atraso com força de interpelação e aviso de constituição de título executivo.

Dados do Devedor e da Fração:
- Nome do Condómino / Proprietário: ${proprietario?.nome || "Exmo.(a) Senhor(a)"}
- Morada / Contacto: ${proprietario?.email || ""} ${proprietario?.telefone || ""}
- Fração: ${fracao?.fracao || "Fração"} (Piso: ${fracao?.piso || ""}, Tipologia: ${fracao?.tipologia || ""})
- Quota Mensal: ${fracao?.quota_mensal || 0} €
- Valor Total em Dívida: ${fracao?.divida_total || fracao?.quota_mensal || 0} €

Redige o documento formal e estruturado com:
1. Identificação da Administração do Condomínio.
2. Descrição pormenorizada da mora e fundamentação legal (art. 1424.º e 1434.º do Código Civil, e art. 6.º do Decreto-Lei 268/94).
3. Prazo improrrogável de 15 dias para liquidação ou acordo de pagamento.
4. Advertência expressa de instauração de competente Ação Executiva caso não haja regularização.
5. Menção de que a Ata da Assembleia de Condóminos constitui Título Executivo nos termos da lei.`;

    const responseText = await generateWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    return res.status(200).json({ noticeText: responseText, text: responseText });
  } catch (err) {
    console.error("[/api/generate-legal-notice] Erro:", err);
    return res.status(500).json({ error: err?.message || "Erro ao gerar notificação legal." });
  }
}
