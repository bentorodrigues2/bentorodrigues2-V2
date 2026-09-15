import { createHash } from "crypto";
import { supabase } from "./supabaseServer.js";
import { gerarHtmlAutoresponder, gerarHtmlResposta } from "./htmlemail.js";
import { classifyEmailCategory, generateCategoryResponse } from "../geminiService.js";
import { extrairDadosDocumento, arquivarAnexoOriginal } from "./multimodalService.js";

/**
 * Filtro de remetentes automatizados e newsletters/spam.
 * NOTA: não bloquear domínios de fornecedores reais (EDP, Galp, Vodafone,
 * seguradoras, empreiteiros, etc.) — são precisamente quem envia as
 * faturas/comprovativos que o motor de OCR deve processar. Um bloqueio
 * anterior aqui estava a descartar em silêncio faturas reais destes
 * fornecedores antes de sequer chegarem à extração por IA.
 */
const FORNECEDORES_E_NOREPLY = [
  "noreply",
  "no-reply",
  "do-not-reply",
  "donotreply",
  "automated",
  "mailer-daemon",
  "postmaster",
  "newsletter",
  "marketing",
  "promo",
  "campaign"
];

function isBloqueado(email) {
  const e = (email || "").toLowerCase();
  return FORNECEDORES_E_NOREPLY.some((termo) => e.includes(termo));
}

function extrairEmailLimpo(fromStr) {
  if (!fromStr) return "";
  const match = fromStr.match(/<([^>]+)>/);
  return match ? match[1].trim() : fromStr.trim();
}

/**
 * Obter contexto da fração ou proprietário através do email
 */
async function obterContexto(email) {
  try {
    const cleanEmail = extrairEmailLimpo(email);

    // 1. Procurar diretamente na tabela proprietarios (é lá que vive o nome real)
    const { data: prop, error: errProp } = await supabase
      .from("proprietarios")
      .select("*, fracoes(*)")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (prop && !errProp) {
      return {
        ...prop,
        fracao: prop.fracoes?.fracao_nome || prop.fracao || prop.id_fracao || "Fração",
        id_predio: prop.id_predio || prop.fracoes?.id_predio || null,
        nome: prop.nome || null
      };
    }

    // 2. Procurar na tabela fracoes (a tabela fracoes não tem coluna de nome do
    // proprietário — se encontrarmos a fração pelo email, vamos ainda buscar o
    // nome à proprietarios pela fracao_id, para não devolver nome vazio)
    const { data: fracao, error: errFracao } = await supabase
      .from("fracoes")
      .select("*, predios(*)")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (fracao && !errFracao) {
      let nomeProprietario = null;
      try {
        const { data: propDaFracao } = await supabase
          .from("proprietarios")
          .select("nome")
          .eq("fracao_id", fracao.id_fracao)
          .maybeSingle();
        nomeProprietario = propDaFracao?.nome || null;
      } catch {
        // sem proprietário associado a esta fração, segue sem nome
      }

      return {
        ...fracao,
        fracao: fracao.fracao_nome || fracao.id_fracao || "Fração",
        id_predio: fracao.id_predio || fracao.predios?.id || null,
        nome: nomeProprietario
      };
    }

    return null;
  } catch (e) {
    console.warn("[inboundProcessor] Aviso ao buscar contexto no Supabase:", e?.message || e);
    return null;
  }
}

/**
 * Buscar documentos gerais do condomínio para anexar
 */
async function obterAnexosDoPredio(id_predio) {
  try {
    if (!id_predio) return [];
    const { data, error } = await supabase
      .from("documentos")
      .select("nome, url_foto")
      .eq("id_predio", id_predio);

    if (error || !data) return [];

    return data
      .filter((doc) => doc.url_foto)
      .map((doc) => ({
        filename: doc.nome || "documento.pdf",
        path: doc.url_foto
      }));
  } catch (e) {
    console.warn("[inboundProcessor] Aviso ao obter anexos do condomínio:", e?.message || e);
    return [];
  }
}

/**
 * Lançar comprovativo pendente diretamente em pagamentos e movimentos
 * Mantém conformidade com o frontend (GestaoMovimentos.tsx / GestaoPagamentos.tsx)
 */
async function registarComprovativoPendente({ categoria, dadosExtraidos, contexto, comprovativoUrl, remetenteEmail, fileHash }) {
  try {
    const tipoDocumento = (dadosExtraidos?.tipo_documento || "").toLowerCase();
    const isComprovativo =
      categoria === "quotas" ||
      ["comprovativo", "fatura", "recibo", "extrato"].includes(tipoDocumento) ||
      (dadosExtraidos?.valor_total > 0);

    if (!isComprovativo) return null;

    const isFatura = tipoDocumento === "fatura";
    const valorExtraido = dadosExtraidos?.valor_total || null;
    const dataExtraida = dadosExtraidos?.data_documento || new Date().toISOString().split("T")[0];
    const entidadeExtraida = dadosExtraidos?.entidade || null;
    const fracaoNome = contexto?.fracao || contexto?.fracao_nome || "Fração Não Identificada";

    // Faturas de fornecedor são despesa; comprovativos/recibos de condómino são receita
    const tipoMovimento = isFatura ? "Despesa" : "Receita";
    const categoriaMovimento = dadosExtraidos?.categoria_contabilistica || (isFatura ? "Fornecedores" : "Quotas");

    // 1. Inserir em pagamentos (estado: 'pendente') — só faz sentido para receitas de condómino
    // "referencia" é NOT NULL sem default na tabela real, e "origem" tem um
    // CHECK constraint que só aceita um conjunto fechado de valores (não
    // inclui "email_inbound") — por isso gera-se uma referência própria e
    // omite-se "origem" (fica NULL, o que o constraint aceita).
    let pagamento = null;
    if (!isFatura) {
      const referenciaGerada = `EMAIL-${Date.now().toString(36).toUpperCase()}`;
      const { data, error: errPag } = await supabase
        .from("pagamentos")
        .insert({
          referencia: referenciaGerada,
          estado: "pendente",
          fracao: fracaoNome,
          id_fracao: contexto?.id_fracao || contexto?.id || null,
          id_proprietario: contexto?.id_proprietario || contexto?.id || null,
          valor: valorExtraido,
          data_pagamento: dataExtraida,
          entidade: entidadeExtraida,
          comprovativo_url: comprovativoUrl || null,
          tipo: "quota_mensal",
          criado_em: new Date().toISOString()
        })
        .select()
        .maybeSingle();
      pagamento = data;
      if (errPag) {
        console.warn("[inboundProcessor] Aviso ao inserir pagamento pendente:", errPag.message);
      }
    }

    // 2. Inserir em movimentos (estado: 'Movimento Cego / Por Justificar', is_movimento_cego: true, estado_conciliacao: 'PENDENTE')
    // "id_movimento" é a PK (text) e não tem default — tem de ser gerado aqui.
    const idMovimentoGerado = `MOV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { data: movimento, error: errMov } = await supabase
      .from("movimentos")
      .insert({
        id_movimento: idMovimentoGerado,
        id_predio: contexto?.id_predio || null,
        fracao_id: contexto?.id_fracao || null,
        descricao: `${entidadeExtraida || (isFatura ? "Fatura de fornecedor" : "Comprovativo")} via Email (${fracaoNome} - ${extrairEmailLimpo(remetenteEmail)})${pagamento?.id ? ` [pagamento:${pagamento.id}]` : ""}`,
        valor: valorExtraido || 0,
        tipo: tipoMovimento,
        categoria: categoriaMovimento,
        data: dataExtraida,
        estado: "Movimento Cego / Por Justificar",
        is_movimento_cego: true,
        estado_conciliacao: "PENDENTE",
        comprovativo_url: comprovativoUrl || null,
        origem: "email_inbound"
      })
      .select()
      .maybeSingle();

    if (errMov) {
      console.warn("[inboundProcessor] Aviso ao inserir movimento pendente:", errMov.message);
    }

    // 3. Log de auditoria (liga movimento + pagamento pelo mesmo evento, guarda o hash para deteção de duplicados)
    try {
      await supabase.from("ai_auditoria").insert({
        origem: "email_inbound",
        tipo_documento: tipoDocumento || null,
        entidade: entidadeExtraida,
        referencia: dadosExtraidos?.referencia || null,
        valor: valorExtraido,
        file_hash: fileHash || null,
        id_movimento: movimento?.id_movimento || null,
        id_pagamento: pagamento?.id || null,
        raw_json: dadosExtraidos || null
      });
    } catch (errAud) {
      console.warn("[inboundProcessor] Aviso ao gravar ai_auditoria:", errAud?.message || errAud);
    }

    return { pagamento, movimento };
  } catch (err) {
    console.error("[inboundProcessor] Erro ao registar comprovativo pendente:", err);
    return null;
  }
}

/**
 * Resolve a identidade de remetente (nome de apresentação + Reply-To) a usar
 * na resposta ao condómino, de acordo com a escolha em Empresa Gestora →
 * "Remetente do Autoresponder" (EMPRESA vs. CONDOMINIO). O envio em si
 * continua a sair do domínio verificado no Resend (EMAIL_FROM_ADDRESS) —
 * um "from" com um domínio arbitrário não verificado seria rejeitado pelo
 * Resend — mas o nome apresentado e o Reply-To (para onde vão as respostas
 * do condómino) passam a refletir mesmo a escolha feita nas Definições, em
 * vez de ser sempre a mesma caixa genérica independentemente do que lá está
 * configurado.
 */
async function resolverRemetente(contexto) {
  const fromEmailBase = process.env.EMAIL_FROM_ADDRESS || "administracao@condomanagerai.com";

  let modo = "CONDOMINIO";
  let empresaNome = "CondoManager AI Condomínio";
  let empresaEmail = null;
  try {
    const { data: config } = await supabase
      .from("empresa_gestora_config")
      .select("email_autoresponder_principal, nome_empresa, email_corporativo")
      .eq("id", "default")
      .maybeSingle();
    if (config?.email_autoresponder_principal) modo = config.email_autoresponder_principal;
    if (config?.nome_empresa) empresaNome = config.nome_empresa;
    if (config?.email_corporativo) empresaEmail = config.email_corporativo;
  } catch (err) {
    console.warn("[inboundProcessor] Aviso ao ler empresa_gestora_config, a assumir modo CONDOMINIO:", err?.message || err);
  }

  if (modo === "EMPRESA") {
    return {
      fromAddress: `${empresaNome} <${fromEmailBase}>`,
      replyTo: empresaEmail || undefined
    };
  }

  // Modo CONDOMINIO (predefinição): usa o nome e o email do prédio em causa.
  if (contexto?.id_predio) {
    try {
      const { data: predio } = await supabase
        .from("predios")
        .select("nome, email, email_condominio")
        .eq("id_predio", contexto.id_predio)
        .maybeSingle();
      if (predio) {
        return {
          fromAddress: `${predio.nome || "Condomínio"} <${fromEmailBase}>`,
          replyTo: predio.email || predio.email_condominio || undefined
        };
      }
    } catch (err) {
      console.warn("[inboundProcessor] Aviso ao ler o prédio para remetente, a usar identidade genérica:", err?.message || err);
    }
  }

  return { fromAddress: `Condomínio <${fromEmailBase}>`, replyTo: undefined };
}

/**
 * Enviar email via Resend API
 */
async function enviarEmailResend({ to, subject, html, attachments = [], fromAddress, replyTo }) {
  const resendApiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
  if (!resendApiKey) {
    console.warn("[inboundProcessor] RESEND_API_KEY não configurada. Email ignorado:", { to, subject });
    return false;
  }

  try {
    const fromEmail = process.env.EMAIL_FROM_ADDRESS || "administracao@condomanagerai.com";
    const fromFinal = fromAddress || (fromEmail.includes("<") ? fromEmail : `Condomínio <${fromEmail}>`);

    const payload = {
      from: fromFinal,
      to: [to],
      subject,
      html
    };

    if (replyTo) {
      payload.reply_to = replyTo;
    }

    if (Array.isArray(attachments) && attachments.length > 0) {
      payload.attachments = attachments;
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("[inboundProcessor] Resend API devolveu erro:", resp.status, errBody);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[inboundProcessor] Falha ao enviar email via Resend:", err);
    return false;
  }
}

/**
 * O webhook `email.received` do Resend só envia metadados (from, subject,
 * lista de anexos com nome/tipo) — nunca o corpo do email nem o conteúdo
 * dos anexos. É preciso ir buscar isso à API depois de receber o webhook.
 * https://resend.com/docs/api-reference/emails/retrieve-received-email
 */
async function obterConteudoCompleto(emailId) {
  const resendApiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
  if (!emailId || !resendApiKey) return null;

  try {
    const resp = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${resendApiKey}` }
    });

    if (!resp.ok) {
      console.warn("[inboundProcessor] Falha ao obter email completo:", resp.status, await resp.text());
      return null;
    }

    return await resp.json();
  } catch (err) {
    console.warn("[inboundProcessor] Erro ao obter email completo:", err?.message || err);
    return null;
  }
}

/**
 * Vai buscar o conteúdo binário real de um anexo (o webhook e o "email
 * completo" só dão metadados — nome, tipo, id). Dois passos:
 * 1) pedir o download_url assinado; 2) descarregar o ficheiro em si.
 * https://resend.com/docs/api-reference/emails/retrieve-received-email-attachment
 */
async function obterConteudoAnexo(emailId, attachmentId) {
  const resendApiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
  if (!emailId || !attachmentId || !resendApiKey) return null;

  try {
    const meta = await fetch(
      `https://api.resend.com/emails/receiving/${emailId}/attachments/${attachmentId}`,
      { headers: { Authorization: `Bearer ${resendApiKey}` } }
    );
    if (!meta.ok) return null;
    const metaJson = await meta.json();
    if (!metaJson?.download_url) return null;

    const ficheiro = await fetch(metaJson.download_url);
    if (!ficheiro.ok) return null;

    const arrayBuffer = await ficheiro.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      filename: metaJson.filename || "anexo",
      mimeType: metaJson.content_type || "application/octet-stream",
      buffer,
      base64: buffer.toString("base64"),
      hash: createHash("sha256").update(buffer).digest("hex")
    };
  } catch (err) {
    console.warn("[inboundProcessor] Erro ao obter conteúdo do anexo:", err?.message || err);
    return null;
  }
}

/**
 * Verifica se algum destes hashes já foi processado antes (evita lançar
 * o mesmo comprovativo duas vezes se o Resend reentregar o webhook).
 */
async function algumHashJaProcessado(hashes) {
  if (!hashes.length) return false;
  try {
    const { data } = await supabase
      .from("ai_auditoria")
      .select("file_hash")
      .in("file_hash", hashes)
      .limit(1);
    return Boolean(data && data.length > 0);
  } catch {
    return false;
  }
}

function htmlParaTexto(html) {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Processador Central Inbound de Emails (Resend Webhook & API)
 */
export async function processInboundEmail(payload) {
  const isRealResendWebhook = payload?.type === "email.received" && payload?.data?.email_id;
  const webhookData = payload?.data || payload;

  let from = webhookData?.from || payload?.from || "";
  let subject = webhookData?.subject || payload?.subject || "(Sem assunto)";
  let body = webhookData?.text || webhookData?.body || payload?.body || payload?.bodyText || "";
  let attachments = webhookData?.attachments || payload?.attachments || [];

  // Payload real do Resend: ir buscar o corpo e a lista completa de anexos
  if (isRealResendWebhook) {
    const completo = await obterConteudoCompleto(webhookData.email_id);
    if (completo) {
      from = completo.from || from;
      subject = completo.subject || subject;
      body = completo.text || htmlParaTexto(completo.html) || body;
      attachments = completo.attachments || attachments;
    } else {
      console.warn("[inboundProcessor] Não foi possível obter o corpo completo do email; a processar só com metadados.");
    }
  }

  if (!from) {
    return { ok: false, status: 400, error: "Remetente ('from') é obrigatório." };
  }

  // 1. Filtro anti-fornecedores e no-reply
  if (isBloqueado(from)) {
    console.log("[inboundProcessor] Email descartado (fornecedor/noreply):", from);
    return { ok: true, status: 200, autoresponder: false, motivo: "fornecedor_ou_noreply" };
  }

  const cleanFrom = extrairEmailLimpo(from);
  const textoEmail = (body && String(body).trim()) || "(Email recebido sem texto no corpo)";

  console.log(`[inboundProcessor] A processar email de ${cleanFrom} | Assunto: ${subject}`);

  // 2. Obter contexto da fração/proprietário no Supabase
  const contexto = await obterContexto(cleanFrom);

  // 3. Classificar categoria com IA (in-process)
  let categoria = "outro";
  try {
    const classif = await classifyEmailCategory({
      from: cleanFrom,
      subject,
      bodyText: textoEmail
    });
    categoria = classif.categoria || "outro";
  } catch (err) {
    console.warn("[inboundProcessor] Aviso na classificação IA, assumindo 'outro':", err);
  }

  // 4. Gerar resposta inteligente por categoria com IA e templates oficiais (in-process)
  let aiData = null;
  try {
    aiData = await generateCategoryResponse({
      categoria,
      email: { from: cleanFrom, subject, bodyText: textoEmail },
      contexto
    });
  } catch (err) {
    console.error("[inboundProcessor] Erro ao gerar resposta por categoria:", err);
  }

  const nomeRemetente = contexto?.nome || contexto?.proprietario || cleanFrom.split("@")[0] || "Condómino";

  // Identidade de remetente conforme configurado em Empresa Gestora
  // (EMPRESA vs. CONDOMINIO) — a mesma para o autoresponder imediato e para
  // a resposta institucional abaixo.
  const { fromAddress, replyTo } = await resolverRemetente(contexto);

  // 5. Enviar Autoresponder imediato
  const htmlAutoresponder = gerarHtmlAutoresponder(nomeRemetente);
  await enviarEmailResend({
    to: cleanFrom,
    subject: `Recebemos o seu contacto - ${subject}`,
    html: htmlAutoresponder,
    fromAddress,
    replyTo
  });

  // 6. Preparar Anexos da resposta institucional
  let anexosParaEnviar = [];

  if (aiData?.ficheiro?.url) {
    anexosParaEnviar.push({
      filename: aiData.ficheiro.filename || "documento.pdf",
      path: aiData.ficheiro.url
    });
  }

  if (Array.isArray(aiData?.documentos)) {
    for (const doc of aiData.documentos) {
      if (doc.url || doc.path) {
        anexosParaEnviar.push({
          filename: doc.filename || "documento.pdf",
          path: doc.url || doc.path
        });
      }
    }
  }

  if (aiData?.acao === "anexar_documentos" && contexto?.id_predio) {
    const docsPredio = await obterAnexosDoPredio(contexto.id_predio);
    anexosParaEnviar.push(...docsPredio);
  }

  // 7. Ler o conteúdo real dos anexos (até 3, para não disparar demasiadas
  // chamadas) e extrair dados estruturados via IA multimodal — lançamento
  // pendente em pagamentos/movimentos, e arquivo automático se for fatura
  let comprovativoUrl = null;
  let dadosExtraidos = null;
  let comprovativoRegisto = null;
  let comprovativoIgnoradoDuplicado = false;

  if (isRealResendWebhook && Array.isArray(attachments) && attachments.length > 0) {
    const anexosComConteudo = [];
    for (const anexo of attachments.slice(0, 3)) {
      const conteudo = await obterConteudoAnexo(webhookData.email_id, anexo.id);
      if (conteudo) anexosComConteudo.push(conteudo);
    }

    if (anexosComConteudo.length > 0) {
      const hashes = anexosComConteudo.map((a) => a.hash);
      comprovativoIgnoradoDuplicado = await algumHashJaProcessado(hashes);

      if (!comprovativoIgnoradoDuplicado) {
        try {
          dadosExtraidos = await extrairDadosDocumento(
            anexosComConteudo.map((a) => ({ mimeType: a.mimeType, base64: a.base64 }))
          );
        } catch (err) {
          console.warn("[inboundProcessor] Aviso na extração multimodal:", err?.message || err);
        }

        const principal = anexosComConteudo[0];
        comprovativoUrl = principal.filename;

        // Arquiva o ficheiro original no Arquivo Digital para qualquer tipo de
        // documento financeiro reconhecido (fatura, comprovativo, recibo,
        // extrato) — antes só faturas eram arquivadas, perdendo o ficheiro
        // original de comprovativos/recibos processados.
        const tipoDocLower = (dadosExtraidos?.tipo_documento || "").toLowerCase();
        const TIPOS_ARQUIVAVEIS = { fatura: "Fatura de Fornecedor", comprovativo: "Comprovativo de Pagamento", recibo: "Recibo", extrato: "Extrato Bancário" };
        if (TIPOS_ARQUIVAVEIS[tipoDocLower]) {
          try {
            const caminhoArquivo = await arquivarAnexoOriginal({
              buffer: principal.buffer,
              filename: principal.filename,
              mimeType: principal.mimeType,
              ano: new Date().getFullYear(),
              tema: "Faturas & Recibos",
              tipo: TIPOS_ARQUIVAVEIS[tipoDocLower],
              predio: contexto?.id_predio || null,
              fracao: contexto?.fracao || null,
              fluxo: `${tipoDocLower}_email_inbound`
            });
            comprovativoUrl = caminhoArquivo;
          } catch (errArquivo) {
            console.warn("[inboundProcessor] Aviso ao arquivar documento:", errArquivo?.message || errArquivo);
          }
        }

        comprovativoRegisto = await registarComprovativoPendente({
          categoria,
          dadosExtraidos,
          contexto,
          comprovativoUrl,
          remetenteEmail: cleanFrom,
          fileHash: principal.hash
        });
      } else {
        console.log("[inboundProcessor] Anexo já processado anteriormente (hash duplicado) — a ignorar novo lançamento.");
      }
    }
  } else if (categoria === "quotas") {
    // Sem anexo mas categoria sugere comprovativo — regista pendente sem dados extraídos
    comprovativoRegisto = await registarComprovativoPendente({
      categoria,
      dadosExtraidos: null,
      contexto,
      comprovativoUrl: null,
      remetenteEmail: cleanFrom
    });
  }

  // 8. Enviar resposta institucional se subject e mensagem forem fornecidos
  if (aiData?.subject && aiData?.message) {
    const htmlInstitucional = gerarHtmlResposta(nomeRemetente, aiData.message);
    await enviarEmailResend({
      to: cleanFrom,
      subject: aiData.subject,
      html: htmlInstitucional,
      attachments: anexosParaEnviar,
      fromAddress,
      replyTo
    });
  }

  return {
    ok: true,
    status: 200,
    categoria,
    autoresponder: true,
    respostaEnviada: Boolean(aiData?.subject && aiData?.message),
    comprovativoPendente: Boolean(comprovativoRegisto),
    comprovativoIgnoradoDuplicado,
    tipoDocumentoExtraido: dadosExtraidos?.tipo_documento || null,
    contexto: contexto ? { fracao: contexto.fracao, predio: contexto.id_predio } : null
  };
}

export default processInboundEmail;
