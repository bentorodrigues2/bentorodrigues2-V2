export default async function handler(req, res) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  // Health check
  if (req.method === "GET") {
    return res.status(200).json({
      status: "online",
      router: "AI Studio Condomínio Router (Groq Hybrid)",
      groqKeyConfigurada: Boolean(GROQ_API_KEY),
      instrucoes: GROQ_API_KEY
        ? "Pronto para receber chamadas POST de automação de email e autoresponder."
        : "AVISO: Configure a variável GROQ_API_KEY no painel da Vercel."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  if (!GROQ_API_KEY) {
    return res.status(500).json({
      error: "Groq não configurado (API_KEY em falta)"
    });
  }

  const body = req.body || {};
  const email = body.email || {};
  const contexto = body.contexto || {};

  const from = email.from || "";
  const sub = email.subject || "";
  const bodyText = email.bodyText || "";
  const fullText = `${sub} ${bodyText}`.toLowerCase();

  // Filtragem de fornecedores / remetentes automáticos
  const fromLower = from.toLowerCase();
  const isSupplier = [
    "noreply", "no-reply", "mailer-daemon", "postmaster",
    "edp.pt", "galp.com", "galp.pt", "vodafone.pt", "meo.pt", "nos.pt"
  ].some(domain => fromLower.includes(domain));

  if (isSupplier || body.categoria === "fornecedor" || body.categoria === "ignorar") {
    return res.status(200).json({
      subject: null,
      message: null,
      categoria: "ignorar",
      filtrado: true,
      motivoFiltro: "Email de fornecedor ou remetente automático identificado."
    });
  }

  // Classificação heurística
  function classificarHeuristico(texto) {
    if (texto.includes("quota") || texto.includes("comprovativo") || texto.includes("transferencia") || texto.includes("pagamento") || texto.includes("iban")) return "quotas";
    if (texto.includes("barulho") || texto.includes("ruido") || texto.includes("musica") || texto.includes("festa") || texto.includes("vizinho")) return "ruido";
    if (texto.includes("elevador") || texto.includes("avaria") || texto.includes("lampada") || texto.includes("portao") || texto.includes("luz") || texto.includes("bomba")) return "avaria";
    if (texto.includes("assembleia") || texto.includes("reuniao") || texto.includes("ata") || texto.includes("convocatoria")) return "assembleia";
    if (texto.includes("sinistro") || texto.includes("seguro") || texto.includes("apolice") || texto.includes("inundacao") || texto.includes("fuga")) return "seguro";
    if (texto.includes("arrendatario") || texto.includes("inquilino") || texto.includes("arrendado")) return "inquilino";
    if (texto.includes("coproprietario") || texto.includes("segundo titular")) return "coproprietario";
    if (texto.includes("urgente") || texto.includes("emergencia") || texto.includes("fogo") || texto.includes("inundar")) return "urgente";
    if (texto.includes("fatura") || texto.includes("edp") || texto.includes("galp") || texto.includes("vodafone") || texto.includes("recibo de fornecedor")) return "fornecedor";
    return "informacao";
  }

  let categoriaFinal = body.categoria || classificarHeuristico(fullText);

  // Fallback institucional (motor de regras)
  function gerarRespostaFallback(cat, sub, contexto = {}) {
    const nomeProp = contexto.proprietario?.nome
      ? `Exmo(a). Senhor(a) ${contexto.proprietario.nome}`
      : "Estimado(a) Condómino(a)";

    const fracaoDesc = contexto.fracao?.letra ? ` referente à fração ${contexto.fracao.letra}` : "";
    const ibanPredio = contexto.predio?.iban ? ` Para pagamentos, poderá utilizar o IBAN do condomínio: ${contexto.predio.iban}.` : "";
    const subject = `Re: ${sub || "Comunicação ao Condomínio"}`;

    let message = "";

    switch (cat) {
      case "quotas":
        if (contexto.quotas) {
          const estado = contexto.quotas.em_atraso
            ? `em atraso (${contexto.quotas.meses_atraso || "pendente"}) no valor de €${contexto.quotas.valor_atraso || contexto.quotas.valor || "0,00"}`
            : `regularizadas (quota mensal: €${contexto.quotas.valor || "0,00"})`;
          message = `${nomeProp}, acusamos a receção do seu contacto. Informamos que as quotas da sua fração encontram-se ${estado}.${ibanPredio} Agradecemos o envio do respetivo comprovativo de transferência bancária para conciliação.`;
        } else {
          message = `${nomeProp}, informamos que o condomínio se encontra de momento a atualizar os registos no sistema. Agradecemos o envio do respetivo comprovativo de pagamento ou esclarecimento adicional para conferência das contas${fracaoDesc}.${ibanPredio}`;
        }
        break;

      case "ruido":
        message = `${nomeProp}, acusamos a receção da sua comunicação sobre ruído. O condomínio zela pelo cumprimento das regras de descanso e do Regulamento Interno (em especial no período noturno entre as 23h e as 07h). O assunto foi registado e serão encetadas as diligências adequadas.`;
        break;

      case "avaria":
        message = `${nomeProp}, acusamos a receção do reporte de avaria nas partes comuns do edifício. A situação foi encaminhada para a equipa de manutenção técnica para avaliação e intervenção prioritária.`;
        break;

      case "assembleia":
        if (contexto.predio?.assembleia_marcada && contexto.predio?.assembleia_data) {
          message = `${nomeProp}, a próxima Assembleia de Condóminos está agendada para ${contexto.predio.assembleia_data}${contexto.predio.assembleia_hora ? ` às ${contexto.predio.assembleia_hora}` : ""}${contexto.predio.assembleia_local ? ` no ${contexto.predio.assembleia_local}` : ""}. A ata da sessão anterior encontra-se disponível para consulta.`;
        } else {
          message = `${nomeProp}, informamos que a próxima Assembleia de Condóminos será devidamente convocada nos termos do Código Civil com o envio da respetiva ordem de trabalhos.`;
        }
        break;

      case "documentos":
        message = `${nomeProp}, acusamos a receção do seu pedido de documentação. Os documentos solicitados podem ser consultados na área do condómino ou remetidos pela administração após conferência dos registos.`;
        break;

      case "seguro":
        if (contexto.seguros?.apolice) {
          message = `${nomeProp}, relativamente ao seguro do condomínio, a apólice referente ao edifício é a nº ${contexto.seguros.apolice}, contratada junto da ${contexto.seguros.seguradora || "Companhia de Seguros"}, com validade até ${contexto.seguros.validade || "em vigor"}.`;
        } else {
          message = `${nomeProp}, informamos que, de momento, o condomínio não dispõe de registo de apólice de seguro individual arquivada para a respetiva fração no sistema. Caso se trate de sinistro que afete partes comuns, solicitamos o envio de dados complementares.`;
        }
        break;

      case "inquilino":
        message = `Estimado(a) residente, acusamos a receção da sua mensagem e agradecemos o contacto. Esclarecemos que determinadas decisões e alterações sobre a fração dependem de comunicação e anuência direta do respetivo proprietário.`;
        break;

      case "coproprietario":
        message = `${nomeProp}, acusamos a receção do seu contacto na qualidade de coproprietário da fração. Procedemos ao registo da sua comunicação na ficha da fração com a administração.`;
        break;

      case "urgente":
        message = `${nomeProp}, acusamos a receção com prioridade máxima da sua comunicação urgente. Por motivos de segurança, a ocorrência foi encaminhada de imediato. Solicitamos o fecho preventivo das torneiras de corte de água ou gás caso exista perigo iminente.`;
        break;

      case "fornecedor":
      case "ignorar":
        return { subject: null, message: null, categoria: "ignorar" };

      default:
        message = `${nomeProp}, acusamos a receção da sua comunicação. A mesma foi registada e encaminhada para os serviços de gestão do condomínio.`;
        break;
    }

    return { subject, message, categoria: cat };
  }

  // GROQ — motor principal
  async function gerarComGroq(prompt) {
    try {
      const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2
        })
      });

      if (!aiRes.ok) return null;

      const aiJson = await aiRes.json();
      const raw = aiJson?.choices?.[0]?.message?.content;

      if (!raw) return null;

      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // Prompt Groq
  const promptGroq = `
És a Administração do Condomínio em Portugal.
Gera uma resposta formal, cordial e institucional em Português de Portugal.

Categoria: ${categoriaFinal}
Email:
Assunto: ${sub}
Texto: ${bodyText}

Contexto: ${JSON.stringify(contexto)}

Devolve SEMPRE estritamente um JSON no formato:
{
  "subject": "Re: ${sub || "Comunicação ao Condomínio"}",
  "message": "Texto institucional da resposta...",
  "categoria": "${categoriaFinal}"
}
`.trim();

  // Tentar Groq
const respostaGroq = await gerarComGroq(promptGroq);

// Log da resposta do Groq (mesmo que venha null)
console.log("AI Router - Resposta Groq:", respostaGroq);

if (respostaGroq && respostaGroq.subject && respostaGroq.message) {
  console.log("AI Router - Enviando resposta Groq:", {
    subject: respostaGroq.subject,
    message: respostaGroq.message,
    categoria: respostaGroq.categoria || categoriaFinal
  });

  return res.status(200).json({
    subject: respostaGroq.subject,
    message: respostaGroq.message,
    categoria: respostaGroq.categoria || categoriaFinal,
    source: "groq_ai"
  });
}

// Fallback
const fallback = gerarRespostaFallback(categoriaFinal, sub, contexto);

// Log do fallback
console.log("AI Router - Fallback:", fallback);

return res.status(200).json({
  subject: fallback.subject,
  message: fallback.message,
  categoria: fallback.categoria,
  source: "regras_condominio_fallback"
});
