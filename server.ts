import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import {
  processAIChat,
  generateWithFallback,
  AIChatPayload,
  processAutoresponderEmail,
  classifyEmailCategory,
  generateCategoryResponse,
  getFallbackCategoryResponse,
  OFFICIAL_EMAIL_ROUTER_TEMPLATES,
  PROMPT_COMPLETO_AI_STUDIO,
  AI_STUDIO_ROUTER_LOGO_HTML,
  AI_STUDIO_ROUTER_SIGNATURE_HTML
} from "./server/geminiService";

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();

  // Allow larger payload for images/base64 uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Bento Rodrigues AI Backend" });
  });

  // 1. AI Assistant Chat (Main Modal)
  app.post("/api/ai-assistant/chat", async (req, res) => {
    try {
      const userRole = (req.headers["x-user-role"] as string) || "ADMIN";
      const userEmail = (req.headers["x-user-email"] as string) || "";
      const payload: AIChatPayload = {
        messages: req.body.messages || [],
        enableWebSearch: req.body.enableWebSearch,
        predioInfo: req.body.predioInfo,
        userRole,
        userEmail
      };

      const result = await processAIChat(payload);
      return res.json(result);
    } catch (err: any) {
      console.error("[/api/ai-assistant/chat] Erro:", err);
      return res.status(500).json({
        error: err.message || "Erro interno ao processar conversa com a IA."
      });
    }
  });

  // 2. Generate Legal Notice / Notificação Jurídica
  app.post("/api/generate-legal-notice", async (req, res) => {
    try {
      const { proprietario, fracao } = req.body;
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

      return res.json({ noticeText: responseText, text: responseText });
    } catch (err: any) {
      console.error("[/api/generate-legal-notice] Erro:", err);
      return res.status(500).json({ error: err.message || "Erro ao gerar notificação legal." });
    }
  });

  // 3. AI Legal Query / Questão Jurídica
  app.post("/api/ai-query", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt não fornecido." });
      }

      const responseText = await generateWithFallback({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: "És um jurista e consultor perito em Direito das Coisas e Regime de Propriedade Horizontal em Portugal (Código Civil e DL 268/2022). Responde de modo rigoroso, citando artigos legais aplicáveis e jurisprudência consolidada sempre que pertinente."
      });

      return res.json({ answer: responseText, reply: responseText });
    } catch (err: any) {
      console.error("[/api/ai-query] Erro:", err);
      return res.status(500).json({ error: err.message || "Erro ao responder à questão jurídica." });
    }
  });

  // 4. Predict Budget / Previsão de Orçamento
  app.post("/api/predict-budget", async (req, res) => {
    try {
      const { predio, fracoes } = req.body;
      const prompt = `Analisa a composição deste edifício em Portugal e propõe uma estimativa realista de orçamento anual com rubricas comuns (eletricidade partes comuns, limpeza, manutenção de elevadores, seguro condomínio, água, gestão, fundo de reserva legal de 10%):
Edifício: ${JSON.stringify(predio || {})}
Número de frações: ${fracoes?.length || 10}

Devolve a análise em formato estruturado com rubricas, valores estimados em Euros e recomendações financeiras para a administração.`;

      const responseText = await generateWithFallback({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });

      return res.json({ prediction: responseText });
    } catch (err: any) {
      console.error("[/api/predict-budget] Erro:", err);
      return res.status(500).json({ error: err.message || "Erro ao prever orçamento." });
    }
  });

  // 5. Predict Reserve Fund / Fundo Comum de Reserva
  app.post("/api/predict-reserve-fund", async (req, res) => {
    try {
      const { movements, saldoAtual } = req.body;
      const prompt = `Analisa a saúde financeira do Fundo Comum de Reserva do condomínio considerando:
- Saldo Atual: ${saldoAtual || 0} €
- Amostra de movimentos recentes: ${JSON.stringify(movements || [])}

Elabora uma análise técnica:
1. Conformidade com o Decreto-Lei 268/94 (obrigação de pelo menos 10% do valor da quota para fundo de reserva).
2. Projeção de solidez para eventuais despesas de conservação extraordinárias (fachadas, telhados, canalizações).
3. Recomendações e percentagem ideal sugerida.`;

      const responseText = await generateWithFallback({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });

      return res.json({ analysis: responseText });
    } catch (err: any) {
      console.error("[/api/predict-reserve-fund] Erro:", err);
      return res.status(500).json({ error: err.message || "Erro ao analisar fundo de reserva." });
    }
  });

  // 6. Compare Proposals / Comparação de Propostas de Fornecedores
  app.post("/api/compare-proposals", async (req, res) => {
    try {
      const { requestDescription, proposals } = req.body;
      const prompt = `Como perito em contratação e manutenção de condomínios, analisa e compara as seguintes propostas de orçamento recebidas:
Necessidade / Descrição: ${requestDescription || "Sem descrição"}
Propostas recebidas: ${JSON.stringify(proposals || [])}

Elabora uma matriz comparativa com:
1. Análise de Preço e Relação Custo-Benefício.
2. Prazos de Execução e Garantia dos Trabalhos.
3. Reputação e Conformidade Técnica.
4. Parecer Final e Recomendação fundamentada para a Assembleia de Condóminos.`;

      const responseText = await generateWithFallback({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });

      return res.json({ comparison: responseText });
    } catch (err: any) {
      console.error("[/api/compare-proposals] Erro:", err);
      return res.status(500).json({ error: err.message || "Erro ao comparar propostas." });
    }
  });

  // 7. Generate Assembly Minutes / Minuta de Ata
  app.post("/api/generate-minutes", async (req, res) => {
    try {
      const body = req.body;
      const prompt = `Redige uma Minuta Oficial de Ata de Assembleia Geral de Condóminos em estrita conformidade com o Artigo 1432.º e 1433.º do Código Civil Português e Decreto-Lei 268/2022:
Tema / Convocatória: ${body.tema || "Assembleia Geral Ordinária"}
Data e Hora: ${body.data || ""} ${body.hora || ""}
Local / Meio: ${body.local || "Instalações do Condomínio"}
Quórum e Participantes: ${JSON.stringify(body.participantes || [])}
Pontos da Ordem de Trabalhos e Deliberações: ${JSON.stringify(body.deliberacoes || body.pontos || [])}

Gera a ata integral com introdução, verificação de quórum, deliberações ponto por ponto com resultados das votações (votos a favor, contra e abstenções com respetiva permilagem), e encerramento formal para assinatura.`;

      const responseText = await generateWithFallback({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });

      return res.json({ minutesText: responseText, ata: responseText });
    } catch (err: any) {
      console.error("[/api/generate-minutes] Erro:", err);
      return res.status(500).json({ error: err.message || "Erro ao gerar minuta de ata." });
    }
  });

  // 8. Parse Import / Importação de dados
  app.post("/api/parse-import", async (req, res) => {
    try {
      const { textContent } = req.body;
      const prompt = `Analisa o seguinte texto que contém dados de frações de um condomínio e extrai um array JSON estrito:
[
  {
    "fracao": "Ex: 1º Dto ou A",
    "piso": "Ex: 1 ou R/C",
    "tipologia": "Ex: T2 ou T3",
    "permilagem": 50,
    "proprietario": "Nome do proprietário",
    "email": "email@exemplo.com",
    "telefone": "912345678",
    "quota_mensal": 45.00
  }
]

Texto para extrair:
${textContent}`;

      const responseText = await generateWithFallback({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        responseMimeType: "application/json"
      });

      try {
        const parsed = JSON.parse(responseText);
        return res.json({ data: parsed });
      } catch {
        return res.json({ raw: responseText });
      }
    } catch (err: any) {
      console.error("[/api/parse-import] Erro:", err);
      return res.status(500).json({ error: err.message || "Erro ao processar importação." });
    }
  });

  // 9. Reconhecer Recibo / Comprovativo
  app.post("/api/reconhecer-recibo", async (req, res) => {
    try {
      const { texto, email } = req.body;
      const prompt = `És o assistente de IA da administração do condomínio.
Analisa a informação deste comprovativo bancário ou e-mail:
${texto || JSON.stringify(email || {})}

Devolve JSON com formato:
{
  "classificacao": { "tipo": "COMPROVATIVO_QUOTA", "confianca": 0.95 },
  "dadosExtraidos": {
    "valorTotal": 0.00,
    "dataDocumento": "AAAA-MM-DD",
    "fracaoIdentificada": "Ex: 2º Dto",
    "nif": "NIF ou null",
    "entidade": "Nome ou Banco",
    "resumo": "Descrição do movimento"
  }
}`;

      const responseText = await generateWithFallback({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        responseMimeType: "application/json"
      });

      try {
        const parsed = JSON.parse(responseText);
        return res.json(parsed);
      } catch {
        return res.json({ raw: responseText });
      }
    } catch (err: any) {
      console.error("[/api/reconhecer-recibo] Erro:", err);
      return res.status(500).json({ error: err.message || "Erro ao reconhecer comprovativo." });
    }
  });

  // 10. Motor de Resposta Automática (Autoresponder) do Condomínio
  app.post("/api/autoresponder", async (req, res) => {
    try {
      const payload = req.body;
      const result = await processAutoresponderEmail(payload);
      return res.json(result);
    } catch (err: any) {
      console.error("[/api/autoresponder] Erro:", err);
      return res.status(500).json({
        error: err.message || "Erro no motor de resposta automática.",
        subject: null,
        message: null,
        categoria: "ignorar"
      });
    }
  });

  // 11. Classificador Oficial de Temas de Emails (Devolve estritamente { "categoria": "..." })
  app.post("/api/classificador", async (req, res) => {
    try {
      const payload = req.body;
      const result = await classifyEmailCategory(payload);
      return res.json(result);
    } catch (err: any) {
      console.error("[/api/classificador] Erro:", err);
      return res.status(500).json({
        categoria: "outro",
        error: err.message || "Erro ao classificar tema do email."
      });
    }
  });

  // 12. Módulo Oficial de Resposta por Categoria (System Prompt de Regras Inteligentes)
  // Devolve estritamente { "subject": "...", "message": "...", "categoria": "..." }
  app.post("/api/resposta-categoria", async (req, res) => {
    try {
      const payload = req.body;
      const result = await generateCategoryResponse(payload);
      return res.json(result);
    } catch (err: any) {
      console.error("[/api/resposta-categoria] Erro:", err);
      return res.status(500).json({
        subject: null,
        message: null,
        categoria: "ignorar",
        error: err.message || "Erro ao gerar resposta por categoria."
      });
    }
  });

  // 13. AI Studio Router (Compatibilidade com Vercel & Automações Externas de Autoresponder)
  app.get("/api/ai-studio-router", (req, res) => {
    const hasKey = Boolean(process.env.GEMINI_API_KEY);
    return res.json({
      status: "online",
      router: "AI Studio Router (Bento Rodrigues Condomínios)",
      geminiKeyConfigurada: hasKey,
      totalCategorias: Object.keys(OFFICIAL_EMAIL_ROUTER_TEMPLATES).length,
      categorias: Object.keys(OFFICIAL_EMAIL_ROUTER_TEMPLATES),
      logotipoUrl: "https://bentorodrigues2.vercel.app/email/20-logotipo.webp",
      instrucoes: "Endpoint pronto para chamadas POST de autoresponder com as 13 categorias e logotipo oficial."
    });
  });

  app.get("/api/ai-studio-router/templates", (req, res) => {
    return res.json({
      status: "ok",
      logotipoHtml: AI_STUDIO_ROUTER_LOGO_HTML,
      assinaturaHtml: AI_STUDIO_ROUTER_SIGNATURE_HTML,
      promptCompleto: PROMPT_COMPLETO_AI_STUDIO,
      templates: OFFICIAL_EMAIL_ROUTER_TEMPLATES
    });
  });

  app.post("/api/ai-studio-router", async (req, res) => {
    try {
      const body = req.body || {};
      const email = body.email || {};
      const contexto = body.contexto || {};
      let categoria = body.categoria;

      // 1. Se categoria não foi enviada, classificar primeiro
      if (!categoria) {
        const classif = await classifyEmailCategory({
          from: email.from || "",
          subject: email.subject || "",
          bodyText: email.bodyText || ""
        });
        categoria = classif.categoria;
      }

      // 2. Gerar resposta por categoria (já possui fallback interno resiliente com logo e assinatura)
      const result = await generateCategoryResponse({
        categoria,
        email,
        contexto
      });

      return res.json(result);
    } catch (err: any) {
      const errStr = String(err?.message || err);
      const isBlocked = errStr.includes("API_KEY_SERVICE_BLOCKED") || errStr.includes("UNAUTHENTICATED") || errStr.includes("401");

      console.warn("[/api/ai-studio-router] Erro no Gemini, acionando resposta institucional de contingência:", errStr);
      
      const fallbackOutput = getFallbackCategoryResponse(
        req.body?.categoria || "outro",
        req.body?.email?.subject || "",
        req.body?.email?.bodyText || "",
        req.body?.contexto || {}
      );

      // Resposta resiliente que NUNCA quebra a automação com 500 e SEMPRE respeita o formato com logotipo
      return res.status(200).json({
        subject: fallbackOutput.subject,
        message: fallbackOutput.message,
        categoria: fallbackOutput.categoria,
        source: "fallback_contingencia_oficial",
        diagnostico: {
          aviso: isBlocked
            ? "GEMINI_API_KEY com restrições na Google Cloud Console (API_KEY_SERVICE_BLOCKED)."
            : "Resposta gerada pelo motor institucional de 13 categorias oficiais.",
          detalhe: errStr
        }
      });
    }
  });

  // Vite middleware for development vs static dist for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Bento Rodrigues] Servidor rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Erro fatal ao iniciar servidor:", err);
  process.exit(1);
});
