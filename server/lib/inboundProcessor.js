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
 * Obter contexto da fração/pessoa através do email do remetente.
 *
 * Lê sempre diretamente do JSONB de fracoes.proprietario /
 * proprietarios_adicionais / inquilino — a única cópia destes dados que a
 * app efetivamente mantém atualizada (GestaoFracoes.tsx via
 * saveFracaoToSupabase / saveProprietarioToSupabase). Antes também se
 * consultava uma tabela "proprietarios" paralela e a coluna
 * "fracoes.email", mas nenhuma das duas é escrita de forma fiável (a
 * escrita em "proprietarios" falha sempre por incompatibilidade de tipos
 * com colunas enum/boolean, em silêncio) — o que fazia com que a
 * identificação do remetente falhasse silenciosamente na maior parte dos
 * casos reais.
 */
async function obterContexto(email) {
  try {
    const cleanEmail = extrairEmailLimpo(email).trim().toLowerCase();
    if (!cleanEmail) return null;

    const { data: todasFracoes, error } = await supabase
      .from("fracoes")
      .select("*, predios(*)");

    if (error || !Array.isArray(todasFracoes)) return null;

    for (const fracao of todasFracoes) {
      const candidatos = [
        fracao.proprietario,
        ...(Array.isArray(fracao.proprietarios_adicionais) ? fracao.proprietarios_adicionais : []),
        fracao.inquilino
      ];

      const encontrado = candidatos.find(
        (pessoa) => pessoa?.email && String(pessoa.email).trim().toLowerCase() === cleanEmail
      );

      if (encontrado) {
        return {
          ...fracao,
          fracao: fracao.fracao_nome || fracao.id_fracao || "Fração",
          id_predio: fracao.id_predio || fracao.predios?.id_predio || null,
          nome: encontrado.nome || null,
          id_proprietario: encontrado.nif || null
        };
      }
    }

    return null;
  } catch (e) {
    console.warn("[inboundProcessor] Aviso ao buscar contexto no Supabase:", e?.message || e);
    return null;
  }
}

function limparIban(iban) {
  return String(iban || "").replace(/\s+/g, "").toUpperCase();
}

/**
 * Segunda tentativa de identificação, usada quando o email do remetente não
 * corresponde a nenhum condómino/inquilino registado (ex: um comprovativo
 * chega de uma conta de email pessoal diferente da registada, mas a
 * transferência em si foi feita a partir de uma conta bancária conhecida).
 * Cruza o IBAN do ordenante (extraído do comprovativo por IA multimodal)
 * contra o IBAN principal e as contas bancárias adicionais de cada
 * proprietário/coproprietário de todas as frações.
 */
async function obterContextoPorIban(ibanOrdenante) {
  try {
    const ibanLimpo = limparIban(ibanOrdenante);
    if (!ibanLimpo) return null;

    const { data: todasFracoes, error } = await supabase
      .from("fracoes")
      .select("*, predios(*)");

    if (error || !Array.isArray(todasFracoes)) return null;

    for (const fracao of todasFracoes) {
      const pessoas = [
        fracao.proprietario,
        ...(Array.isArray(fracao.proprietarios_adicionais) ? fracao.proprietarios_adicionais : [])
      ];

      for (const pessoa of pessoas) {
        if (!pessoa) continue;
        const ibansDaPessoa = [
          pessoa.iban,
          ...((pessoa.contas_bancarias_adicionais || []).map((c) => c.iban))
        ].map(limparIban).filter(Boolean);

        if (ibansDaPessoa.includes(ibanLimpo)) {
          return {
            ...fracao,
            fracao: fracao.fracao_nome || fracao.id_fracao || "Fração",
            id_predio: fracao.id_predio || fracao.predios?.id_predio || null,
            nome: pessoa.nome || null,
            id_proprietario: pessoa.nif || null,
            identificado_por: "iban"
          };
        }
      }
    }

    return null;
  } catch (e) {
    console.warn("[inboundProcessor] Aviso ao buscar contexto por IBAN:", e?.message || e);
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
 * Buscar o recibo de quitação mais recente da fração do remetente, para
 * anexar de facto na resposta da categoria "quotas" — antes o template
 * dizia sempre "Enviamos em anexo o recibo" sem nunca ir buscar nenhum
 * ficheiro real (ver server/lib/receiptGenerator.js / api_handlers_backup
 * /confirmar-pagamento.js, que é quem gera e arquiva o recibo oficial).
 */
async function obterReciboMaisRecente(contexto) {
  try {
    if (!contexto?.id_fracao) return null;

    const { data, error } = await supabase
      .from("documentos")
      .select("nome, caminho")
      .eq("fracao", contexto.id_fracao)
      .eq("tema", "Financeiro")
      .eq("tipo", "Recibo")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.caminho) return null;

    const { data: signed, error: errSigned } = await supabase.storage
      .from("documentos")
      .createSignedUrl(data.caminho, 3600);

    if (errSigned || !signed?.signedUrl) return null;

    return { filename: data.nome || "Recibo.pdf", path: signed.signedUrl };
  } catch (e) {
    console.warn("[inboundProcessor] Aviso ao obter recibo mais recente:", e?.message || e);
    return null;
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
        raw_json: dadosExtraidos || null,
        id_predio: contexto?.id_predio || null
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
 * Resolve, num só sítio, tudo o que depende da configuração real feita nas
 * Definições/Empresa Gestora para esta resposta:
 *  - identidade de remetente (nome de apresentação + Reply-To), de acordo
 *    com "Remetente do Autoresponder" (EMPRESA vs. CONDOMINIO). O envio em
 *    si continua a sair do domínio verificado no Resend (EMAIL_FROM_ADDRESS)
 *    — um "from" com domínio arbitrário não verificado seria rejeitado —
 *    mas o nome apresentado e o Reply-To passam a refletir a escolha feita.
 *  - modoAutoresponder do prédio em causa ("confirmacao_previa" vs.
 *    "totalmente_autonomo"), que decide se a resposta da IA sai de imediato
 *    ou fica em fila de aprovação (ver processInboundEmail).
 */
async function obterContextoEnvio(contexto) {
  const fromEmailBase = process.env.EMAIL_FROM_ADDRESS || "administracao@condomanagerai.com";

  let predioRow = null;
  if (contexto?.id_predio) {
    try {
      const { data } = await supabase
        .from("predios")
        .select("nome, email, email_condominio, autoresponder_modo")
        .eq("id_predio", contexto.id_predio)
        .maybeSingle();
      predioRow = data || null;
    } catch (err) {
      console.warn("[inboundProcessor] Aviso ao ler o prédio:", err?.message || err);
    }
  }
  const modoAutoresponder = predioRow?.autoresponder_modo || "confirmacao_previa";

  let modoRemetente = "CONDOMINIO";
  let empresaNome = "CondoManager AI Condomínio";
  let empresaEmail = null;
  try {
    const { data: config } = await supabase
      .from("empresa_gestora_config")
      .select("email_autoresponder_principal, nome_empresa, email_corporativo")
      .eq("id", "default")
      .maybeSingle();
    if (config?.email_autoresponder_principal) modoRemetente = config.email_autoresponder_principal;
    if (config?.nome_empresa) empresaNome = config.nome_empresa;
    if (config?.email_corporativo) empresaEmail = config.email_corporativo;
  } catch (err) {
    console.warn("[inboundProcessor] Aviso ao ler empresa_gestora_config, a assumir modo CONDOMINIO:", err?.message || err);
  }

  if (modoRemetente === "EMPRESA") {
    return {
      fromAddress: `${empresaNome} <${fromEmailBase}>`,
      replyTo: empresaEmail || undefined,
      modoAutoresponder
    };
  }

  // Modo CONDOMINIO (predefinição): nome de apresentação fixo "Condomínio"
  // (consistente com os restantes emails da app), Reply-To do prédio em causa.
  if (predioRow) {
    return {
      fromAddress: `CondoManager AI Condomínio <${fromEmailBase}>`,
      replyTo: predioRow.email || predioRow.email_condominio || undefined,
      modoAutoresponder
    };
  }

  return { fromAddress: `CondoManager AI Condomínio <${fromEmailBase}>`, replyTo: undefined, modoAutoresponder };
}

/**
 * Enviar email via Resend API
 */
export async function enviarEmailResend({ to, subject, html, attachments = [], fromAddress, replyTo }) {
  const resendApiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
  if (!resendApiKey) {
    console.warn("[inboundProcessor] RESEND_API_KEY não configurada. Email ignorado:", { to, subject });
    return false;
  }

  try {
    const fromEmail = process.env.EMAIL_FROM_ADDRESS || "administracao@condomanagerai.com";
    const fromFinal = fromAddress || (fromEmail.includes("<") ? fromEmail : `CondoManager AI Condomínio <${fromEmail}>`);

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
  let contexto = await obterContexto(cleanFrom);

  // 2b. Respeitar a pausa do Sincronizador de Caixa de Entrada & Auto-Responder
  // (toggle "Ligar/Pausar Sincronizador" em Configurações → predios.autoresponder_ativo).
  // Quando pausado para este prédio, não processar nem responder automaticamente.
  if (contexto?.id_predio) {
    try {
      const { data: predioPausa } = await supabase
        .from("predios")
        .select("autoresponder_ativo")
        .eq("id_predio", contexto.id_predio)
        .maybeSingle();
      if (predioPausa && predioPausa.autoresponder_ativo === false) {
        console.log(`[inboundProcessor] Sincronizador pausado para o prédio ${contexto.id_predio}; email de ${cleanFrom} não processado.`);
        return { ok: true, status: 200, autoresponder: false, motivo: "sincronizador_pausado_para_este_predio" };
      }
    } catch (err) {
      console.warn("[inboundProcessor] Aviso ao verificar autoresponder_ativo, a assumir ativo:", err?.message || err);
    }
  }

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
  // (EMPRESA vs. CONDOMINIO) e modo de autoresponder do prédio
  // (confirmacao_previa vs. totalmente_autonomo).
  const { fromAddress, replyTo, modoAutoresponder } = await obterContextoEnvio(contexto);

  // 5. Enviar Autoresponder imediato — mero aviso de receção ("recebemos o
  // seu contacto"), não uma resposta com conteúdo decidido pela IA, por
  // isso sai sempre de imediato mesmo em modo "confirmacao_previa".
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

        // Segunda tentativa de identificar a fração: o email de quem enviou
        // pode não corresponder a nenhum condómino registado, mas o
        // comprovativo em si (extraído por IA) traz o IBAN de quem pagou —
        // cruza-se contra o IBAN principal e as contas adicionais de cada
        // proprietário/coproprietário.
        if (!contexto?.id_fracao && dadosExtraidos?.ordenante_iban) {
          const contextoPorIban = await obterContextoPorIban(dadosExtraidos.ordenante_iban);
          if (contextoPorIban) {
            contexto = contextoPorIban;
            console.log(`[inboundProcessor] Fração identificada pelo IBAN do ordenante (${contexto.fracao}), o email do remetente não correspondia a nenhum condómino registado.`);
          }
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

  // 7.1 Categoria "quotas": ir buscar mesmo o recibo real da fração para
  // anexar — sem isto a resposta afirmava "enviamos em anexo o recibo" sem
  // nunca anexar nada. Sem recibo emitido, a mensagem é corrigida para não
  // afirmar um anexo que não existe.
  if (categoria === "quotas") {
    const reciboReal = await obterReciboMaisRecente(contexto);
    if (reciboReal) {
      anexosParaEnviar.push(reciboReal);
    } else if (aiData?.message) {
      aiData.message = `Ainda não temos nenhum recibo emitido para a sua fração no nosso sistema.<br><br>Assim que o seu pagamento for confirmado pela administração, o recibo oficial de quitação ser-lhe-á enviado automaticamente por email. Se já efetuou o pagamento e ainda não recebeu confirmação, contacte a administração do condomínio.`;
    }
  }

  // 8. Enviar (ou colocar em fila de aprovação) a resposta institucional
  // redigida pela IA, se subject e mensagem tiverem sido gerados. Em modo
  // "confirmacao_previa" (predefinição do prédio), esta é a resposta com
  // conteúdo decidido pela IA — fica pendente até o administrador clicar em
  // "Aprovar" em Definições, em vez de sair sozinha.
  let respostaEnviada = false;
  let respostaPendenteConfirmacao = false;
  if (aiData?.subject && aiData?.message) {
    const htmlInstitucional = gerarHtmlResposta(nomeRemetente, aiData.message);

    if (modoAutoresponder === "confirmacao_previa") {
      try {
        await supabase.from("respostas_ia_pendentes").insert({
          id: `RESP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          id_predio: contexto?.id_predio || null,
          id_fracao: contexto?.id_fracao || null,
          destinatario_email: cleanFrom,
          destinatario_nome: nomeRemetente,
          assunto: aiData.subject,
          mensagem_html: htmlInstitucional,
          categoria,
          from_address: fromAddress,
          reply_to: replyTo || null,
          anexos: anexosParaEnviar
        });
        respostaPendenteConfirmacao = true;
      } catch (err) {
        console.error("[inboundProcessor] Erro ao colocar resposta da IA em fila de aprovação:", err);
      }
    } else {
      respostaEnviada = await enviarEmailResend({
        to: cleanFrom,
        subject: aiData.subject,
        html: htmlInstitucional,
        attachments: anexosParaEnviar,
        fromAddress,
        replyTo
      });
    }
  }

  return {
    ok: true,
    status: 200,
    categoria,
    autoresponder: true,
    respostaEnviada,
    respostaPendenteConfirmacao,
    comprovativoPendente: Boolean(comprovativoRegisto),
    comprovativoIgnoradoDuplicado,
    tipoDocumentoExtraido: dadosExtraidos?.tipo_documento || null,
    contexto: contexto ? { fracao: contexto.fracao, predio: contexto.id_predio } : null
  };
}

export default processInboundEmail;
