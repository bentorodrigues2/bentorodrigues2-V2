import {
  processAIChat,
  generateWithFallback
} from "../server/geminiService.js";
import { extrairDadosDocumento, extrairMovimentosExtrato } from "../server/lib/multimodalService.js";
import { exigirSessaoValida } from "../server/lib/verificarSessao.js";

export default async function handler(req, res) {
  const acao = req.query?.acao || req.body?.acao;

  // Todas as ações reais deste endpoint (chamadas ao Gemini, com custo real)
  // exigem sessão válida — os GETs de "status: online" de cada ação
  // continuam públicos (não fazem nenhum trabalho real).
  if (req.method === "POST") {
    const utilizador = await exigirSessaoValida(req, res);
    if (!utilizador) return;
  }

  // 1. CHAT COM IA (/api/ai-assistant/chat -> ?acao=chat)
  if (acao === "chat" || acao === "ai-assistant/chat") {
    if (req.method === "GET") {
      return res.status(200).json({ status: "online", endpoint: "ai-assistant/chat" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const userRole = req.headers["x-user-role"] || "ADMIN";
      const userEmail = req.headers["x-user-email"] || "";
      const payload = {
        messages: req.body?.messages || [],
        enableWebSearch: req.body?.enableWebSearch,
        predioInfo: req.body?.predioInfo,
        userRole,
        userEmail
      };

      const result = await processAIChat(payload);
      return res.status(200).json(result);
    } catch (err) {
      console.error("[api/ai?acao=chat] Erro:", err);
      return res.status(500).json({
        error: err?.message || "Erro interno ao processar conversa com a IA."
      });
    }
  }

  // 2. NOTIFICAÇÃO LEGAL DE COBRANÇA (/api/generate-legal-notice -> ?acao=generate-legal-notice)
  if (acao === "generate-legal-notice") {
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
      console.error("[api/ai?acao=generate-legal-notice] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro ao gerar notificação legal." });
    }
  }

  // 3. CONSULTA JURÍDICA (/api/ai-query -> ?acao=ai-query)
  if (acao === "ai-query") {
    if (req.method === "GET") {
      return res.status(200).json({ status: "online", endpoint: "/api/ai-query" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const { prompt } = req.body || {};
      if (!prompt) {
        return res.status(400).json({ error: "Prompt não fornecido." });
      }

      const responseText = await generateWithFallback({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: "És um jurista e consultor perito em Direito das Coisas e Regime de Propriedade Horizontal em Portugal (Código Civil e DL 268/2022). Responde de modo rigoroso, citando artigos legais aplicáveis e jurisprudência consolidada sempre que pertinente."
      });

      return res.status(200).json({ answer: responseText, reply: responseText });
    } catch (err) {
      console.error("[api/ai?acao=ai-query] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro ao responder à questão jurídica." });
    }
  }

  // 3b. RESUMO EXECUTIVO DO PAINEL DE CONTROLO (?acao=resumo-painel)
  if (acao === "resumo-painel") {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const { predioNome, saldoCaixa, fundoReserva, quotasEmAtraso, ocorrenciasAbertas, totalFracoes } = req.body || {};

      const prompt = `Gera um resumo executivo curto (máx. 6 linhas, em português de Portugal) para a administração do condomínio "${predioNome || "Edifício"}", com base nestes dados reais:
- Saldo de caixa atual: ${Number(saldoCaixa || 0).toFixed(2)} €
- Fundo de reserva: ${Number(fundoReserva || 0).toFixed(2)} €
- Frações com quotas em atraso: ${Array.isArray(quotasEmAtraso) ? quotasEmAtraso.length : 0} de ${totalFracoes || 0}
${Array.isArray(quotasEmAtraso) && quotasEmAtraso.length > 0 ? quotasEmAtraso.map(q => `  • Fração ${q.fracao}: ${Number(q.valor).toFixed(2)} € em atraso`).join("\n") : ""}
- Ocorrências abertas: ${ocorrenciasAbertas || 0}

Escreve em tom profissional e direto, destacando apenas o que exige atenção da administração. Não inventes dados que não constam acima.`;

      const responseText = await generateWithFallback({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: "És um assistente de gestão de condomínios em Portugal. Resumes dados financeiros e operacionais reais de forma clara e objetiva, sem inventar factos."
      });

      return res.status(200).json({ resumo: responseText });
    } catch (err) {
      console.error("[api/ai?acao=resumo-painel] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro ao gerar o resumo executivo." });
    }
  }

  // 4. PREVISÃO ORÇAMENTAL (/api/predict-budget -> ?acao=predict-budget)
  if (acao === "predict-budget") {
    if (req.method === "GET") {
      return res.status(200).json({ status: "online", endpoint: "/api/predict-budget" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const { predio, fracoes } = req.body || {};
      const prompt = `Analisa a composição deste edifício em Portugal e propõe uma estimativa realista de orçamento anual com rubricas comuns (eletricidade partes comuns, limpeza, manutenção de elevadores, seguro condomínio, água, gestão, fundo de reserva legal de 10%):
Edifício: ${JSON.stringify(predio || {})}
Número de frações: ${fracoes?.length || 10}

Devolve a análise em formato estruturado com rubricas, valores estimados em Euros e recomendações financeiras para a administração.`;

      const responseText = await generateWithFallback({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });

      return res.status(200).json({ prediction: responseText });
    } catch (err) {
      console.error("[api/ai?acao=predict-budget] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro ao prever orçamento." });
    }
  }

  // 5. FUNDO DE RESERVA (/api/predict-reserve-fund -> ?acao=predict-reserve-fund)
  if (acao === "predict-reserve-fund") {
    if (req.method === "GET") {
      return res.status(200).json({ status: "online", endpoint: "/api/predict-reserve-fund" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const { movements, saldoAtual } = req.body || {};
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

      return res.status(200).json({ analysis: responseText });
    } catch (err) {
      console.error("[api/ai?acao=predict-reserve-fund] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro ao analisar fundo de reserva." });
    }
  }

  // 6. COMPARAÇÃO DE PROPOSTAS (/api/compare-proposals -> ?acao=compare-proposals)
  if (acao === "compare-proposals") {
    if (req.method === "GET") {
      return res.status(200).json({ status: "online", endpoint: "/api/compare-proposals" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const { requestDescription, proposals } = req.body || {};
      if (!Array.isArray(proposals) || proposals.length < 2) {
        return res.status(400).json({ error: "São necessárias pelo menos 2 propostas para comparar." });
      }

      const nomesFornecedores = proposals.map(p => p.name || "Fornecedor");
      const prompt = `Como perito em contratação e manutenção de condomínios, analisa e compara as seguintes propostas de orçamento recebidas:
Necessidade / Descrição: ${requestDescription || "Sem descrição"}
Propostas recebidas (nome, NIF, valor, prazo, garantia, descrição técnica): ${JSON.stringify(proposals)}

Devolve APENAS um objeto JSON estrito com esta forma exata, sem texto fora do JSON:
{
  "comparisonMatrix": [
    { "criterion": "Preço", "supplierA": "resumo curto", "supplierB": "resumo curto", "winner": "nome do fornecedor vencedor neste critério" },
    { "criterion": "Prazo de Execução", "supplierA": "...", "supplierB": "...", "winner": "..." },
    { "criterion": "Garantia", "supplierA": "...", "supplierB": "...", "winner": "..." },
    { "criterion": "Conformidade Técnica", "supplierA": "...", "supplierB": "...", "winner": "..." }
  ],
  "analysis": {
    ${nomesFornecedores.map(n => `"${n}": { "pros": ["..."], "cons": ["..."], "score": 0 }`).join(",\n    ")}
  },
  "recommendation": "Parecer final fundamentado, com recomendação de adjudicação para a Assembleia de Condóminos."
}
Usa exatamente os nomes dos fornecedores fornecidos como chaves em "analysis". "score" é de 0 a 100. Se houver mais de 2 propostas, inclui todas nas colunas do comparisonMatrix (supplierA, supplierB, supplierC, ...) e em "analysis". Nunca inventes dados que não estejam nas propostas fornecidas.`;

      const responseText = await generateWithFallback({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        responseMimeType: "application/json"
      });

      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        const match = responseText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("A IA não devolveu um JSON válido.");
        result = JSON.parse(match[0]);
      }

      return res.status(200).json(result);
    } catch (err) {
      console.error("[api/ai?acao=compare-proposals] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro ao comparar propostas." });
    }
  }

  // 7. MINUTA DE ATA (/api/generate-minutes -> ?acao=generate-minutes)
  if (acao === "generate-minutes") {
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
      console.error("[api/ai?acao=generate-minutes] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro ao gerar minuta de ata." });
    }
  }

  // 8. PARSE DE IMPORTAÇÃO (/api/parse-import -> ?acao=parse-import)
  if (acao === "parse-import") {
    if (req.method === "GET") {
      return res.status(200).json({ status: "online", endpoint: "/api/parse-import" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const { textContent } = req.body || {};
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
        return res.status(200).json({ data: parsed });
      } catch {
        return res.status(200).json({ raw: responseText });
      }
    } catch (err) {
      console.error("[api/ai?acao=parse-import] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro ao processar importação." });
    }
  }

  // 9. RECONHECER RECIBO / COMPROVATIVO (/api/reconhecer-recibo -> ?acao=reconhecer-recibo)
  if (acao === "reconhecer-recibo") {
    if (req.method === "GET") {
      return res.status(200).json({ status: "online", endpoint: "/api/reconhecer-recibo" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const { texto, email } = req.body || {};
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
        return res.status(200).json(parsed);
      } catch {
        return res.status(200).json({ raw: responseText });
      }
    } catch (err) {
      console.error("[api/ai?acao=reconhecer-recibo] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro ao reconhecer comprovativo." });
    }
  }

  // 9.5. RECONHECER ANEXO REAL POR IA MULTIMODAL (?acao=reconhecer-anexo)
  // Usado por LeitorAnexosIA.tsx — lê mesmo o ficheiro (imagem/PDF) enviado,
  // ao contrário de "reconhecer-recibo" acima, que só analisa texto.
  // Reaproveita extrairDadosDocumento, o mesmo motor já usado para anexos
  // recebidos por email (server/lib/inboundProcessor.js).
  if (acao === "reconhecer-anexo") {
    if (req.method === "GET") {
      return res.status(200).json({ status: "online", endpoint: "/api/ai?acao=reconhecer-anexo" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const { base64, mimeType } = req.body || {};
      if (!base64 || !mimeType) {
        return res.status(400).json({ error: "base64 e mimeType são obrigatórios" });
      }

      const dados = await extrairDadosDocumento([{ base64, mimeType }]);
      if (!dados) {
        return res.status(502).json({ error: "A IA não conseguiu extrair dados deste documento." });
      }

      return res.status(200).json({ ok: true, dados });
    } catch (err) {
      console.error("[api/ai?acao=reconhecer-anexo] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro ao reconhecer o anexo." });
    }
  }

  // 9.6. EXTRAIR MOVIMENTOS DE UM EXTRATO BANCÁRIO (?acao=extrair-movimentos-historicos)
  // Usado pelo Assistente de Arranque (Passo 3) — lê um extrato bancário
  // (PDF/foto e/ou texto de CSV/Excel/TXT já convertido para texto no
  // cliente) e devolve uma lista de movimentos para pré-preencher o
  // histórico de transição, em vez do administrador ter de os transcrever
  // um a um à mão.
  if (acao === "extrair-movimentos-historicos") {
    if (req.method === "GET") {
      return res.status(200).json({ status: "online", endpoint: "/api/ai?acao=extrair-movimentos-historicos" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const { anexos, textoExtrato } = req.body || {};
      if ((!anexos || anexos.length === 0) && !textoExtrato) {
        return res.status(400).json({ error: "Envie pelo menos um anexo (PDF/imagem) ou o texto de um ficheiro CSV/Excel/TXT." });
      }

      const movimentos = await extrairMovimentosExtrato({ anexos, textoExtrato });
      if (!movimentos) {
        return res.status(502).json({ error: "A IA não conseguiu identificar movimentos neste extrato. Verifique o ficheiro ou lance os movimentos manualmente." });
      }

      return res.status(200).json({ ok: true, movimentos });
    } catch (err) {
      console.error("[api/ai?acao=extrair-movimentos-historicos] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro ao extrair movimentos do extrato." });
    }
  }

  // 9.6. RECONHECER APÓLICE DE SEGURO POR IA MULTIMODAL (?acao=reconhecer-apolice)
  // Usado por GestaoSinistrosSeguros.tsx — antes chamava um SDK Gemini
  // client-side com uma VITE_GEMINI_API_KEY que não existe em lado nenhum
  // (falhava sempre) e só descrevia à IA o nome/tamanho do ficheiro, nunca
  // o conteúdo real. Lê agora mesmo o documento, como reconhecer-anexo.
  if (acao === "reconhecer-apolice") {
    if (req.method === "GET") {
      return res.status(200).json({ status: "online", endpoint: "/api/ai?acao=reconhecer-apolice" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const { base64, mimeType } = req.body || {};
      if (!base64 || !mimeType) {
        return res.status(400).json({ error: "base64 e mimeType são obrigatórios" });
      }

      const prompt = `És um sistema de OCR e extração documental de apólices de seguro obrigatório de condomínio em Portugal.
Analisa o documento em anexo (a imagem/PDF real da apólice) e extrai os dados reais nele contidos.
Devolve APENAS JSON estrito com as chaves:
{
  "seguradora": "Nome real da companhia de seguros indicado no documento",
  "apolice_numero": "Número de apólice real indicado no documento",
  "apolice_validade": "Data de validade/renovação no formato YYYY-MM-DD",
  "tipo_cobertura": "Tipo de cobertura indicado (ex: Incêndio e Multirriscos)",
  "capital_seguro": 0,
  "franquia": 0,
  "resumo": "Breve resumo real do que consta no documento"
}
Se algum campo não constar no documento, usa null nesse campo. Nunca inventes valores que não constem no documento.`;

      const rawResponse = await generateWithFallback({
        contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }],
        responseMimeType: "application/json"
      });

      let dados = null;
      try {
        dados = JSON.parse(rawResponse);
      } catch {
        const match = rawResponse.match(/\{[\s\S]*\}/);
        if (match) dados = JSON.parse(match[0]);
      }

      if (!dados) {
        return res.status(502).json({ error: "A IA não conseguiu extrair dados deste documento." });
      }
      return res.status(200).json({ ok: true, dados });
    } catch (err) {
      console.error("[api/ai?acao=reconhecer-apolice] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro ao reconhecer a apólice." });
    }
  }

  // 10. HUMANIZAR CONVOCATÓRIA (/api/humanize-convocatoria -> ?acao=humanize-convocatoria)
  if (acao === "humanize-convocatoria") {
    if (req.method === "GET") {
      return res.status(200).json({ status: "online", endpoint: "/api/humanize-convocatoria" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const {
        tema,
        data,
        hora,
        horaSegunda,
        local,
        ordensTrabalho,
        isVideoconferencia,
        plataformaVideo,
        linkVideo,
        predio
      } = req.body || {};

      const prompt = `És um especialista em gestão de comunidades e comunicação para condomínios em Portugal.
A tua missão é reescrever a seguinte Convocatória de Assembleia de Condóminos com uma forte capacidade analítica e de uma forma profundamente HUMANA, calorosa, clara e envolvente, sem perder a validade e solenidade jurídica necessária (Código Civil Art. 1431.º e 1432.º).

DADOS DA CONVOCATÓRIA:
- Edifício: ${predio?.nome || "Condomínio"} (${predio?.morada_linha1 || ""}, ${predio?.localidade || ""})
- Tema: ${tema || "Assembleia Geral de Condóminos"}
- 1ª Convocatória: ${data || ""} às ${hora || ""} horas
- 2ª Convocatória (Código Civil): ${data || ""} às ${horaSegunda || "30 minutos depois"} horas
- Local: ${local || "Instalações do Condomínio"}
${isVideoconferencia ? `- Modalidade Mista / Vídeo: ${plataformaVideo || "Videoconferência"} com link ${linkVideo || ""}` : "- Modalidade: Presencial"}
- Ordem de Trabalhos Bruta:
${ordensTrabalho || "1. Contas; 2. Orçamento; 3. Assuntos Gerais."}

DIRETRIZES DE ESTILO E CAPACIDADE ANALÍTICA:
1. Linguagem Humana e Acolhedora: Fala para vizinhos e proprietários com empatia, transparência e respeito pelo tempo e património de cada um.
2. Capacidade Analítica: Para cada ponto da ordem de trabalhos, faz um breve enquadramento analítico explicando sucintamente PORQUE é importante a decisão para a valorização, segurança ou boa convivência no condomínio (ex.: aprovação de contas dá transparência; orçamentos preparam o edifício; obras garantem a durabilidade).
3. Facilidade de Participação: Reforça que a opinião de todos é essencial. Explica com simplicidade como quem não puder comparecer pessoalmente pode emitir procuração a outro condómino ou aceder online/PWA.
4. Menção às 1ª e 2ª Convocatórias clara e pedagógica (explicando porque existem as duas horas).
5. Sondagem de Presenças: Relembra amavelmente para assinalarem presenças para antecipar o quórum.
6. ASSINATURA OBRIGATÓRIA (sem menções comerciais ou marcas de terceiros):
Com os meus cumprimentos,

[Assinatura Digital]
 O Administrador do Condomínio

Devolve apenas o texto da convocatória pronto a enviar por email aos condóminos.`.trim();

      const responseText = await generateWithFallback({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });

      return res.status(200).json({ text: responseText, success: true });
    } catch (err) {
      console.error("[api/ai?acao=humanize-convocatoria] Erro:", err);
      return res.status(500).json({
        error: err?.message || "Erro ao humanizar convocatória com IA.",
        success: false
      });
    }
  }

  // VALIDADOR DE PEDIDOS DO REGULAMENTO INTERNO (/api/ai?acao=validar-regulamento)
  if (acao === "validar-regulamento") {
    if (req.method === "GET") {
      return res.status(200).json({ status: "online", endpoint: "/api/ai?acao=validar-regulamento" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    try {
      const { regras, pedidoTexto } = req.body || {};
      if (!pedidoTexto) {
        return res.status(400).json({ error: "pedidoTexto é obrigatório." });
      }

      const prompt = `És o motor de validação de pedidos informais de condóminos de um condomínio em Portugal, à luz do Regulamento Interno do edifício e da lei da propriedade horizontal (Código Civil, artigos 1414.º a 1438.º-A).

Regulamento Interno em vigor neste edifício:
${JSON.stringify(regras || {}, null, 2)}

Pedido submetido pelo condómino:
"${pedidoTexto}"

Analisa o pedido face ao regulamento e à lei aplicável e devolve APENAS um JSON estrito com este formato exato:
{
  "decisao": "Aprovado" | "Aprovado com Condições" | "Rejeitado",
  "fundamentacao": "Explicação clara e fundamentada citando o regulamento interno e/ou artigos legais aplicáveis",
  "recomendacaoIA": "Recomendação prática para a administração sobre como proceder"
}`;

      const responseText = await generateWithFallback({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        responseMimeType: "application/json"
      });

      try {
        const parsed = JSON.parse(responseText);
        return res.status(200).json(parsed);
      } catch {
        return res.status(200).json({
          decisao: "Aprovado com Condições",
          fundamentacao: responseText,
          recomendacaoIA: "Reveja manualmente — a resposta da IA não veio em formato estruturado."
        });
      }
    } catch (err) {
      console.error("[api/ai?acao=validar-regulamento] Erro:", err);
      return res.status(500).json({ error: err?.message || "Erro ao validar pedido com IA." });
    }
  }

  // Se nenhuma ação válida foi especificada
  if (req.method === "GET") {
    return res.status(200).json({
      status: "online",
      dispatcher: "api/ai",
      acoesDisponiveis: [
        "chat",
        "generate-legal-notice",
        "ai-query",
        "predict-budget",
        "predict-reserve-fund",
        "compare-proposals",
        "generate-minutes",
        "parse-import",
        "reconhecer-recibo",
        "reconhecer-anexo",
        "extrair-movimentos-historicos",
        "humanize-convocatoria",
        "validar-regulamento"
      ]
    });
  }

  return res.status(400).json({
    error: "Ação não especificada ou inválida. Use ?acao=chat|generate-legal-notice|ai-query|predict-budget|predict-reserve-fund|compare-proposals|generate-minutes|parse-import|reconhecer-recibo|reconhecer-anexo|extrair-movimentos-historicos|humanize-convocatoria|validar-regulamento"
  });
}
