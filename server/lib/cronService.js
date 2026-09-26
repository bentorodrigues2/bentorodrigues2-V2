import { jsPDF } from "jspdf";
import { supabase } from "./supabaseServer.js";
import { generateOfficialReceiptPDF, nomeFicheiroRecibo } from "./receiptGenerator.js";
import { guardarNoArquivo, registarDocumento, enviarEmailPDF } from "./pdfService.js";
import { gerarHtmlResposta, gerarHtmlAniversario } from "./htmlemail.js";
import { derivarPrefixoEdificio } from "./reciboUtils.js";
import { enviarEmailSemAnexo } from "./mailer.js";
import { obterModeloEmail, interpolarModeloEmail } from "./emailTemplates.js";

/**
 * Guarda de "já executado hoje" — protege contra envios duplicados quando o
 * endpoint /api/cron é chamado mais do que uma vez no mesmo dia (cron externo
 * mal configurado, novo trigger a testar o worker, retry, etc.). Usa a
 * tabela ai_auditoria como registo leve (origem + referencia + dia).
 */
async function jaExecutadoHoje(origem, referencia) {
  if (!referencia) return false;
  const hojeISO = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("ai_auditoria")
    .select("id_log")
    .eq("origem", origem)
    .eq("referencia", referencia)
    .gte("criado_em", `${hojeISO}T00:00:00`)
    .limit(1);
  return Boolean(data && data.length);
}

async function marcarExecutadoHoje(origem, referencia, entidade, idPredio) {
  try {
    await supabase.from("ai_auditoria").insert({ origem, referencia, entidade: entidade || null, id_predio: idPredio || null });
  } catch (err) {
    console.warn(`[cronService] Aviso ao marcar "${origem}" como executado:`, err?.message || err);
  }
}

// Todas as datas deste ficheiro são calculadas em UTC (getUTCFullYear/
// getUTCMonth/getUTCDate, Date.UTC) em vez do calendário local do processo
// Node — evita que a construção de datas via new Date(ano, mes, dia) e o
// .toISOString() subsequente desloquem um dia (o cron corre num servidor
// cuja timezone não é garantidamente a de Portugal).
function isoDate(ano, mesIndex0, dia) {
  const m = String(mesIndex0 + 1).padStart(2, "0");
  const d = String(dia).padStart(2, "0");
  return `${ano}-${m}-${d}`;
}

function nomeMesUTC(ano, mesIndex0) {
  return new Date(Date.UTC(ano, mesIndex0, 1)).toLocaleDateString("pt-PT", { month: "long", timeZone: "UTC" });
}

function ultimoDiaMesUTC(ano, mesIndex0) {
  return new Date(Date.UTC(ano, mesIndex0 + 1, 0)).getUTCDate();
}

/** Devolve [inicioMes, fimMes] (YYYY-MM-DD) do mês corrente, em UTC. */
function limitesMesAtualUTC(hoje) {
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth();
  return [isoDate(ano, mes, 1), isoDate(ano, mes, ultimoDiaMesUTC(ano, mes))];
}

function formatarDataPT(iso) {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}-${mes}-${ano}`;
}

async function obterPredios() {
  const { data, error } = await supabase.from("predios").select("*");
  if (error) {
    console.error("[cronService] Erro ao obter prédios:", error.message);
    return [];
  }
  return data || [];
}

async function obterFracoesDoPredio(id_predio) {
  const { data } = await supabase.from("fracoes").select("*").eq("id_predio", id_predio);
  return data || [];
}

// Lê sempre diretamente do JSONB de fracoes.proprietario — a mesma fonte de
// verdade já usada em server/lib/inboundProcessor.js (obterContexto). A
// tabela "proprietarios" paralela não é fiável: o upsert a partir do
// frontend falhava sempre por incompatibilidade de tipos com colunas
// enum/boolean (corrigido em src/lib/supabaseService.ts, mas manter aqui a
// dependência da tabela paralela continuava frágil a uma futura regressão
// do mesmo tipo) — o que fazia a emissão automática de quotas (dia 25) e a
// emissão retroativa nunca encontrarem o email de nenhum proprietário real.
async function obterProprietarioDaFracao(id_fracao) {
  const { data } = await supabase.from("fracoes").select("proprietario").eq("id_fracao", id_fracao).maybeSingle();
  return data?.proprietario || null;
}

// Coeficiente real das lojas com acesso direto pelo exterior — NÃO é uma
// isenção legal fixa (a lei, art.º 1424º CC, só isenta especificamente
// despesas de ascensor). Este valor (45,28%) foi reverse-engineered a partir
// do quadro de quotas real historicamente praticado neste condomínio
// (confirmado com o administrador, bate a 1 cêntimo ou exato em 17 de 17
// frações) — ver a mesma lógica em GestaoEmissao.tsx. Extraído para função
// partilhada entre emitirQuotasMensais (dia 25) e emitirNotasEmAtrasoFracao
// (emissão retroativa ao registar um proprietário) para as duas fórmulas
// nunca poderem divergir uma da outra.
const COEF_LOJA_EXTERIOR = 0.4528;
function calcularRatesPredio(predio, fracoes) {
  const orcamentoAnual = Number(predio.patrimonio?.orcamento_anual || 0);
  const orcamentoMensal = orcamentoAnual / 12;
  const isLojaExterior = (fr) => fr.tipologia === "Loja Comercial" && (fr.tipo_access || "").includes("Exterior");
  let permilagemLoja = 0;
  fracoes.forEach((fr) => { if (isLojaExterior(fr)) permilagemLoja += fr.permilagem; });
  const permilagemNormal = 1000 - permilagemLoja;
  const denominador = permilagemNormal + permilagemLoja * COEF_LOJA_EXTERIOR;
  const rateNormal = denominador > 0 ? orcamentoMensal / denominador : 0;
  const rateLoja = rateNormal * COEF_LOJA_EXTERIOR;
  return { orcamentoAnual, isLojaExterior, rateNormal, rateLoja };
}

// Escolhe o IBAN certo consoante o tipo de aviso: Quota Ordinária e Fundo
// Comum de Reserva usam a conta corrente principal (is_principal), Quota
// Extraordinária usa a conta de poupança/obras — mesma lógica que
// escolherIbanContaPorTipo em src/utils.ts (não pode ser importada
// diretamente aqui, mundo TS/frontend vs. JS/backend), sincronizadas para
// nunca divergirem.
function escolherIbanContaPorTipo(contas, tipoAviso) {
  if (!contas || contas.length === 0) return "";
  const ehExtraordinaria = (tipoAviso || "").toLowerCase().includes("extra");
  const contaPrincipal = contas.find((c) => c.is_principal);
  const contaSecundaria = contas.find((c) => !c.is_principal);
  if (ehExtraordinaria) return (contaSecundaria || contaPrincipal || contas[0])?.iban || "";
  return (contaPrincipal || contas[0])?.iban || "";
}

async function obterContasDoPredio(id_predio) {
  const { data } = await supabase.from("contas").select("iban, is_principal").eq("id_predio", id_predio);
  return data || [];
}

/** Existe já uma nota de cobrança (aviso "Quota Ordinária") desta fração com vencimento nesse mês? */
async function existeNotaCobrancaMes(id_fracao, anoRef, mesIndex0) {
  const inicioMes = isoDate(anoRef, mesIndex0, 1);
  const fimMes = isoDate(anoRef, mesIndex0, ultimoDiaMesUTC(anoRef, mesIndex0));
  const { data } = await supabase
    .from("avisos")
    .select("id_aviso")
    .eq("id_fracao", id_fracao)
    .eq("tipo", "Quota Ordinária")
    .gte("vencimento", inicioMes)
    .lte("vencimento", fimMes)
    .limit(1);
  return Boolean(data && data.length);
}

/**
 * Há uma prestação de "Quota Extraordinária" (já criada de uma vez só ao
 * configurar-se em GestaoQuotasOrcamento.tsx, uma por mês) com vencimento
 * neste mês de referência, ainda não paga? Devolve o aviso, para a nota de
 * cobrança deste mês poder incluí-la — junto com a Ordinária se a conta
 * bancária for a mesma, ou numa nota à parte se for diferente.
 */
async function obterExtraordinariaPendenteDoMes(id_fracao, anoRef, mesIndex0) {
  const inicioMes = isoDate(anoRef, mesIndex0, 1);
  const fimMes = isoDate(anoRef, mesIndex0, ultimoDiaMesUTC(anoRef, mesIndex0));
  const { data } = await supabase
    .from("avisos")
    .select("*")
    .eq("id_fracao", id_fracao)
    .eq("tipo", "Quota Extraordinária")
    .eq("estado", "Pendente")
    .gte("vencimento", inicioMes)
    .lte("vencimento", fimMes)
    .limit(1)
    .maybeSingle();
  return data || null;
}

/**
 * Cria o aviso "Quota Ordinária" de UM mês de referência para UMA fração e,
 * se houver email do proprietário, gera o PDF da nota de cobrança, arquiva-o
 * e envia-o por email — exatamente a mesma lógica por-fração que
 * emitirQuotasMensais usava inline, extraída para poder ser reutilizada pela
 * emissão retroativa (emitirNotasEmAtrasoFracao) sem duplicar a fórmula.
 */
async function emitirNotaCobrancaFracaoMes({ predio, f, proprietario, rates, anoRef, mesIndex0, prefixoEdificio, fluxo, contas, extraordinariaMesma }) {
  const mesRefLabel = nomeMesUTC(anoRef, mesIndex0);
  const hojeUTC = new Date();
  const dataEmissao = isoDate(hojeUTC.getUTCFullYear(), hojeUTC.getUTCMonth(), hojeUTC.getUTCDate());
  const vencimento = isoDate(anoRef, mesIndex0, 8);

  const orcamentoMensalProporcional = f.permilagem * (rates.isLojaExterior(f) ? rates.rateLoja : rates.rateNormal);
  const valorOrdinario = Math.round(orcamentoMensalProporcional * 0.9 * 100) / 100;
  const valorFCR = Math.round(orcamentoMensalProporcional * 0.1 * 100) / 100;
  const valorTotal = Math.round((valorOrdinario + valorFCR) * 100) / 100;

  const idAviso = `av-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const { error: errAv } = await supabase.from("avisos").insert([
    {
      id_aviso: idAviso,
      id_predio: predio.id_predio,
      id_fracao: f.id_fracao,
      tipo: "Quota Ordinária",
      data: dataEmissao,
      vencimento,
      descricao: `Quota de Condomínio (Ordinária + Fundo de Reserva) - ${mesRefLabel} / ${anoRef}`,
      valor: valorTotal,
      valor_fundo_reserva: valorFCR,
      estado: "Pendente",
      proprietario_nome: proprietario?.nome || null,
      proprietario_nif: proprietario?.nif || null
    }
  ]);

  if (errAv) {
    console.warn(`[cronService] Erro ao criar aviso de ${mesRefLabel}/${anoRef} da fração ${f.fracao_nome}:`, errAv.message);
    return { ok: false };
  }

  if (!proprietario?.email) return { ok: true, emailEnviado: false };

  const { count: totalNotas } = await supabase
    .from("avisos")
    .select("id_aviso", { count: "exact", head: true })
    .eq("tipo", "Quota Ordinária");

  const sequencial = String(totalNotas || 1).padStart(5, "0");
  const idNota = `${prefixoEdificio} ${sequencial}`;

  // extraordinariaMesma: aviso "Quota Extraordinária" pendente deste mês, só
  // passado aqui pelo chamador quando a conta bancária da extraordinária é a
  // MESMA da ordinária — nesse caso entra como rubrica extra na MESMA
  // nota/recibo (só no documento impresso — o registo do aviso extraordinário
  // continua separado na BD, com o seu próprio valor e estado de pagamento)
  // em vez de gerar um documento à parte (ver emitirQuotasMensais).
  const rubricas = [
    { descricao: `Quota de Condomínio Ordinária - ${mesRefLabel} / ${anoRef}`, valor: valorOrdinario, tipo: "Quota Ordinária" },
    { descricao: `Fundo Comum de Reserva (FCR) - ${mesRefLabel} / ${anoRef}`, valor: valorFCR, tipo: "Fundo Comum de Reserva" }
  ];
  if (extraordinariaMesma) {
    rubricas.push({ descricao: extraordinariaMesma.descricao || `Quota Extraordinária - ${mesRefLabel} / ${anoRef}`, valor: extraordinariaMesma.valor, tipo: "Quota Extraordinária" });
  }
  const valorTotalNota = Math.round(rubricas.reduce((s, r) => s + r.valor, 0) * 100) / 100;

  const nota = {
    id_recibo: idNota,
    tipoDocumento: "nota_cobranca",
    numero_sequencial: totalNotas || 1,
    ano: anoRef,
    id_predio: predio.id_predio,
    id_fracao: f.id_fracao,
    nome_condomino: proprietario.nome,
    nif_condomino: proprietario.nif || "",
    fracao_nome: f.fracao_nome,
    permilagem: f.permilagem,
    data_emissao: dataEmissao,
    data_pagamento: vencimento,
    metodo_pagamento: "Transferência Bancária",
    valor_total: valorTotalNota,
    rubricas,
    iban_predio: escolherIbanContaPorTipo(contas, "Quota Ordinária") || predio.iban || "",
    emitido_por: "Administração do Condomínio",
    adminSignatureBase64: predio.patrimonio?.assinatura_admin_base64 || "sem-assinatura-digital"
  };

  const doc = generateOfficialReceiptPDF(nota, predio, f);
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const nomeFicheiro = nomeFicheiroRecibo(nota);

  const caminho = await guardarNoArquivo({
    pdfBuffer,
    ano: anoRef,
    tema: "Financeiro",
    tipo: "Nota de Cobrança",
    predio: predio.id_predio,
    fracao: f.id_fracao,
    fluxo: fluxo || "emissao_quotas_mensal",
    nomeFicheiro
  });

  await registarDocumento({
    caminho,
    ano: anoRef,
    tema: "Financeiro",
    tipo: "Nota de Cobrança",
    predio: predio.id_predio,
    fracao: f.id_fracao,
    fluxo: fluxo || "emissao_quotas_mensal",
    origem: "cron_emissao_quotas",
    nomeFicheiro,
    categoria: "Pasta Paga. Quotas",
    visibilidade: "Público"
  });

  const modeloCobranca = await obterModeloEmail(predio.id_predio, "aviso_cobranca");
  const valoresCobranca = {
    nome: proprietario.nome,
    fracao: f.fracao_nome,
    valor: `${valorTotalNota.toFixed(2)} €`,
    data: formatarDataPT(vencimento)
  };

  const ehRetroativa = fluxo === "emissao_quotas_retroativa";
  const notaTextoExtra = extraordinariaMesma ? " Este valor inclui também a prestação da quota extraordinária deste mês, discriminada em separado na nota." : "";
  const emailEnviado = await enviarEmailPDF({
    to: proprietario.email,
    nomeDestinatario: proprietario.nome,
    assunto: modeloCobranca
      ? interpolarModeloEmail(modeloCobranca.subject, valoresCobranca)
      : `Nota de Cobrança — Quota de ${mesRefLabel} / ${anoRef} — Fração ${f.fracao_nome}`,
    mensagem: modeloCobranca
      ? interpolarModeloEmail(modeloCobranca.body, valoresCobranca).replace(/\n/g, "<br>")
      : `Segue em anexo a nota de cobrança referente à quota de condomínio de <strong>${mesRefLabel} de ${anoRef}</strong>, no valor de <strong>${valorTotalNota.toFixed(2)} €</strong>, com vencimento a <strong>${formatarDataPT(vencimento)}</strong>.${notaTextoExtra}${ehRetroativa ? " Esta nota refere-se a um mês anterior ao seu registo na plataforma, emitida agora retroativamente desde o início de atividade da administração." : ""}<br><br>Assim que o pagamento for confirmado pela administração, receberá o respetivo recibo de pagamento oficial. Para um rápido cruzamento de dados, envie o comprovativo do pagamento para o email <strong>bentorodrgues2@gmail.com</strong>.`,
    pdfBuffer,
    nome: nomeFicheiro
  });

  return { ok: true, emailEnviado };
}

/**
 * Emite a nota de cobrança de UMA prestação de "Quota Extraordinária" JÁ
 * EXISTENTE (criada de uma vez só ao configurar-se em
 * GestaoQuotasOrcamento.tsx), à parte da nota da Quota Ordinária — usada
 * quando as duas usam contas bancárias diferentes, caso em que não podem
 * ser combinadas na mesma nota/recibo (ver emitirQuotasMensais). Não cria
 * nenhum aviso novo, só gera e envia o documento do que já existe.
 */
async function emitirNotaExtraordinariaSeparada({ predio, f, proprietario, avisoExtra, prefixoEdificio, contas }) {
  if (!proprietario?.email) return { ok: true, emailEnviado: false };

  const { count: totalNotas } = await supabase
    .from("avisos")
    .select("id_aviso", { count: "exact", head: true })
    .eq("tipo", "Quota Extraordinária");

  const sequencial = String(totalNotas || 1).padStart(5, "0");
  const idNota = `${prefixoEdificio} ${sequencial}`;
  const dataEmissaoHoje = new Date().toISOString().split("T")[0];

  const nota = {
    id_recibo: idNota,
    tipoDocumento: "nota_cobranca",
    numero_sequencial: totalNotas || 1,
    ano: new Date(avisoExtra.vencimento).getUTCFullYear(),
    id_predio: predio.id_predio,
    id_fracao: f.id_fracao,
    nome_condomino: proprietario.nome,
    nif_condomino: proprietario.nif || "",
    fracao_nome: f.fracao_nome,
    permilagem: f.permilagem,
    data_emissao: dataEmissaoHoje,
    data_pagamento: avisoExtra.vencimento,
    metodo_pagamento: "Transferência Bancária",
    valor_total: avisoExtra.valor,
    rubricas: [{ descricao: avisoExtra.descricao, valor: avisoExtra.valor, tipo: "Quota Extraordinária" }],
    iban_predio: escolherIbanContaPorTipo(contas, "Quota Extraordinária") || predio.iban || "",
    emitido_por: "Administração do Condomínio",
    adminSignatureBase64: predio.patrimonio?.assinatura_admin_base64 || "sem-assinatura-digital"
  };

  const doc = generateOfficialReceiptPDF(nota, predio, f);
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const nomeFicheiro = nomeFicheiroRecibo(nota);

  const caminho = await guardarNoArquivo({
    pdfBuffer,
    ano: nota.ano,
    tema: "Financeiro",
    tipo: "Nota de Cobrança",
    predio: predio.id_predio,
    fracao: f.id_fracao,
    fluxo: "emissao_quota_extraordinaria",
    nomeFicheiro
  });

  await registarDocumento({
    caminho,
    ano: nota.ano,
    tema: "Financeiro",
    tipo: "Nota de Cobrança",
    predio: predio.id_predio,
    fracao: f.id_fracao,
    fluxo: "emissao_quota_extraordinaria",
    origem: "cron_emissao_quotas",
    nomeFicheiro,
    categoria: "Pasta Paga. Quotas",
    visibilidade: "Público"
  });

  const modeloCobranca = await obterModeloEmail(predio.id_predio, "aviso_cobranca");
  const valoresCobranca = {
    nome: proprietario.nome,
    fracao: f.fracao_nome,
    valor: `${avisoExtra.valor.toFixed(2)} €`,
    data: formatarDataPT(avisoExtra.vencimento)
  };

  const emailEnviado = await enviarEmailPDF({
    to: proprietario.email,
    nomeDestinatario: proprietario.nome,
    assunto: modeloCobranca
      ? interpolarModeloEmail(modeloCobranca.subject, valoresCobranca)
      : `Nota de Cobrança — Quota Extraordinária — Fração ${f.fracao_nome}`,
    mensagem: modeloCobranca
      ? interpolarModeloEmail(modeloCobranca.body, valoresCobranca).replace(/\n/g, "<br>")
      : `Segue em anexo a nota de cobrança referente à quota extraordinária (${avisoExtra.descricao}), no valor de <strong>${avisoExtra.valor.toFixed(2)} €</strong>, com vencimento a <strong>${formatarDataPT(avisoExtra.vencimento)}</strong>.<br><br>Assim que o pagamento for confirmado pela administração, receberá o respetivo recibo de pagamento oficial. Para um rápido cruzamento de dados, envie o comprovativo do pagamento para o email <strong>bentorodrgues2@gmail.com</strong>.`,
    pdfBuffer,
    nome: nomeFicheiro
  });

  return { ok: true, emailEnviado };
}

/**
 * Reenvia a nota de cobrança de UM aviso "Quota Ordinária" JÁ EXISTENTE,
 * com os valores atuais desse aviso (sem criar/alterar nenhum aviso) — usada
 * para corrigir e reenviar notas que tinham saído com um valor errado
 * (ex: bug de permilagem), depois de o aviso já ter sido corrigido na base
 * de dados. O assunto e o corpo do email deixam explícito que se trata de
 * uma correção a uma nota anteriormente enviada.
 */
export async function reenviarNotaCobrancaCorrigida(id_predio, aviso) {
  const { data: predio } = await supabase.from("predios").select("*").eq("id_predio", id_predio).maybeSingle();
  if (!predio) return { ok: false, error: "Prédio não encontrado." };

  const { data: f } = await supabase.from("fracoes").select("*").eq("id_fracao", aviso.id_fracao).maybeSingle();
  if (!f) return { ok: false, error: "Fração não encontrada." };

  const proprietario = await obterProprietarioDaFracao(aviso.id_fracao);
  if (!proprietario?.email) return { ok: false, error: "Fração sem email de proprietário." };

  const contas = await obterContasDoPredio(id_predio);
  const prefixoEdificio = derivarPrefixoEdificio(predio.nome);

  const [anoRef, mesNum] = aviso.vencimento.split("-").map((n) => parseInt(n, 10));
  const mesIndex0 = mesNum - 1;
  const mesRefLabel = nomeMesUTC(anoRef, mesIndex0);
  const hojeUTC = new Date();
  const dataEmissao = isoDate(hojeUTC.getUTCFullYear(), hojeUTC.getUTCMonth(), hojeUTC.getUTCDate());

  const valorFCR = Number(aviso.valor_fundo_reserva || 0);
  const valorTotal = Number(aviso.valor || 0);
  const valorOrdinario = Math.round((valorTotal - valorFCR) * 100) / 100;

  const { count: totalNotas } = await supabase
    .from("avisos")
    .select("id_aviso", { count: "exact", head: true })
    .eq("tipo", "Quota Ordinária");
  const sequencial = String(totalNotas || 1).padStart(5, "0");
  const idNota = `${prefixoEdificio} ${sequencial}`;

  const nota = {
    id_recibo: idNota,
    tipoDocumento: "nota_cobranca",
    numero_sequencial: totalNotas || 1,
    ano: anoRef,
    id_predio: predio.id_predio,
    id_fracao: f.id_fracao,
    nome_condomino: proprietario.nome,
    nif_condomino: proprietario.nif || "",
    fracao_nome: f.fracao_nome,
    permilagem: f.permilagem,
    data_emissao: dataEmissao,
    data_pagamento: aviso.vencimento,
    metodo_pagamento: "Transferência Bancária",
    valor_total: valorTotal,
    rubricas: [
      { descricao: `Quota de Condomínio Ordinária - ${mesRefLabel} / ${anoRef}`, valor: valorOrdinario, tipo: "Quota Ordinária" },
      { descricao: `Fundo Comum de Reserva (FCR) - ${mesRefLabel} / ${anoRef}`, valor: valorFCR, tipo: "Fundo Comum de Reserva" }
    ],
    iban_predio: escolherIbanContaPorTipo(contas, "Quota Ordinária") || predio.iban || "",
    emitido_por: "Administração do Condomínio",
    adminSignatureBase64: predio.patrimonio?.assinatura_admin_base64 || "sem-assinatura-digital"
  };

  const doc = generateOfficialReceiptPDF(nota, predio, f);
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const nomeFicheiro = nomeFicheiroRecibo(nota);

  const caminho = await guardarNoArquivo({
    pdfBuffer,
    ano: anoRef,
    tema: "Financeiro",
    tipo: "Nota de Cobrança",
    predio: predio.id_predio,
    fracao: f.id_fracao,
    fluxo: "correcao_quotas",
    nomeFicheiro
  });

  await registarDocumento({
    caminho,
    ano: anoRef,
    tema: "Financeiro",
    tipo: "Nota de Cobrança",
    predio: predio.id_predio,
    fracao: f.id_fracao,
    fluxo: "correcao_quotas",
    origem: "correcao_manual_permilagem",
    nomeFicheiro,
    categoria: "Pasta Paga. Quotas",
    visibilidade: "Público"
  });

  const emailEnviado = await enviarEmailPDF({
    to: proprietario.email,
    nomeDestinatario: proprietario.nome,
    assunto: `Correção — Nota de Cobrança — Quota de ${mesRefLabel} / ${anoRef} — Fração ${f.fracao_nome}`,
    mensagem: `Pedimos desculpa pelo incómodo: a nota de cobrança da quota de <strong>${mesRefLabel} de ${anoRef}</strong> que lhe foi enviada anteriormente continha um valor incorreto, devido a um erro técnico na permilagem da fração. Segue em anexo a nota corrigida, com o valor certo de <strong>${valorTotal.toFixed(2)} €</strong>, com vencimento a <strong>${formatarDataPT(aviso.vencimento)}</strong>.<br><br>Esta nota substitui a anteriormente enviada — desconsidere o valor antigo. Assim que o pagamento for confirmado pela administração, receberá o respetivo recibo de pagamento oficial.`,
    pdfBuffer,
    nome: nomeFicheiro
  });

  return { ok: true, emailEnviado };
}

/**
 * Emite retroativamente, para UMA fração, todas as notas de cobrança mensais
 * em falta desde o início de atividade da administração (mesInicioISO, por
 * omissão 01/06/2026) até ao mês corrente — disparado a partir do frontend
 * logo que o proprietário dessa fração é registado pela primeira vez (ver
 * GestaoFracoes.tsx / api/pagamento.js?acao=emitir-notas-atraso). Idempotente
 * por mês: se já existir um aviso "Quota Ordinária" com vencimento nesse mês
 * para a fração, salta-o (não duplica).
 */
export async function emitirNotasEmAtrasoFracao(id_predio, id_fracao, mesInicioISO = "2026-06-01") {
  const { data: predio } = await supabase.from("predios").select("*").eq("id_predio", id_predio).maybeSingle();
  if (!predio) return { ok: false, error: "Prédio não encontrado." };

  const orcamentoAnual = Number(predio.patrimonio?.orcamento_anual || 0);
  if (!orcamentoAnual) return { ok: false, error: "Prédio sem orçamento anual definido — não é possível calcular o valor da quota." };

  const fracoes = await obterFracoesDoPredio(id_predio);
  const f = fracoes.find((fr) => fr.id_fracao === id_fracao);
  if (!f) return { ok: false, error: "Fração não encontrada." };

  const proprietario = await obterProprietarioDaFracao(id_fracao);
  const rates = calcularRatesPredio(predio, fracoes);
  const prefixoEdificio = derivarPrefixoEdificio(predio.nome);
  const contas = await obterContasDoPredio(id_predio);

  const [anoInicio, mesInicio] = mesInicioISO.split("-").map((n) => parseInt(n, 10));
  const hoje = new Date();
  const anoFim = hoje.getUTCFullYear();
  const mesFim = hoje.getUTCMonth() + 1; // mês corrente, 1-indexado

  let emitidas = 0;
  let jaExistiam = 0;
  let ano = anoInicio;
  let mes = mesInicio; // 1-indexado

  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    const mesIndex0 = mes - 1;
    try {
      const jaExiste = await existeNotaCobrancaMes(id_fracao, ano, mesIndex0);
      if (jaExiste) {
        jaExistiam += 1;
      } else {
        const resultado = await emitirNotaCobrancaFracaoMes({
          predio,
          f,
          proprietario,
          rates,
          anoRef: ano,
          mesIndex0,
          prefixoEdificio,
          fluxo: "emissao_quotas_retroativa",
          contas
        });
        if (resultado.ok) emitidas += 1;
      }
    } catch (errMes) {
      console.error(`[cronService] Erro ao emitir nota retroativa de ${mes}/${ano} da fração ${f.fracao_nome}:`, errMes);
    }
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }

  return { ok: true, id_fracao, fracao_nome: f.fracao_nome, mesesEmitidos: emitidas, mesesJaExistentes: jaExistiam };
}

/**
 * Todos os dias: se algum prédio tiver uma adenda/revisão ao orçamento anual
 * (tabela revisoes_orcamento) cuja data de vigência já chegou e que ainda não
 * foi aplicada, atualiza predios.patrimonio.orcamento_anual para esse valor.
 * É esta sincronização diária que faz uma revisão agendada para uma data
 * futura (ex: "a partir de 1 de julho") entrar mesmo em vigor sozinha nessa
 * data, sem o administrador ter de voltar a mexer em nada — o cálculo de
 * quotas e a emissão automática do dia 25 continuam só a ler
 * patrimonio.orcamento_anual, agora sempre com o valor certo.
 */
export async function sincronizarOrcamentosVigentes() {
  const hojeISO = new Date().toISOString().split("T")[0];
  const predios = await obterPredios();
  const resultados = [];

  for (const predio of predios) {
    const { data: revisoes } = await supabase
      .from("revisoes_orcamento")
      .select("*")
      .eq("id_predio", predio.id_predio)
      .lte("data_vigencia", hojeISO)
      .order("data_vigencia", { ascending: false })
      .limit(1);

    const revisaoVigente = (revisoes || [])[0];
    if (!revisaoVigente) continue;

    const valorAtual = Number(predio.patrimonio?.orcamento_anual || 0);
    if (Number(revisaoVigente.valor) === valorAtual) continue;

    await supabase
      .from("predios")
      .update({ patrimonio: { ...(predio.patrimonio || {}), orcamento_anual: Number(revisaoVigente.valor) } })
      .eq("id_predio", predio.id_predio);

    resultados.push({ id_predio: predio.id_predio, novo_orcamento: revisaoVigente.valor, data_vigencia: revisaoVigente.data_vigencia });
  }

  return { job: "SINCRONIZAR_ORCAMENTOS_VIGENTES", prédios_atualizados: resultados.length, detalhe: resultados };
}

/**
 * Todos os dias: percorre os contratos de fornecedores ativos de todos os
 * prédios e, para cada um, calcula quantos dias faltam até data_fim:
 *  - Já passou (dias <= 0) e tem renovação automática ligada: renova +1 ano
 *    sozinho, tal como o botão manual "Renovar" faz, e avisa a
 *    administração por email.
 *  - Já passou e NÃO tem renovação automática: marca o contrato como
 *    "Expirado" e arquiva-o em Arquivo → Fornecedores → "Contratos
 *    Rescindidos / Não Renovados", para não ficar simplesmente esquecido.
 *  - Ainda não chegou mas está dentro do prazo de alerta configurado por
 *    contrato (alerta_dias_antecedencia — 30/60/90/120 dias, escolhido em
 *    Fornecedores → Contratos): envia um único email de aviso à
 *    administração (alerta_enviado_em evita repetir todos os dias) a avisar
 *    que o contrato está a aproximar-se do fim.
 * Antes disto, o campo "alerta_renovacao" existia mas nunca era realmente
 * usado para enviar nada — era só um badge visual calculado a partir de uma
 * data "hoje" fixa no código, por isso nunca funcionava passada essa data.
 */
export async function processarContratosFornecedores() {
  const hojeISO = new Date().toISOString().split("T")[0];
  const predios = await obterPredios();
  const resultado = { renovados: 0, expirados: 0, alertas_enviados: 0, detalhe: [] };

  for (const predio of predios) {
    const { data: contratos } = await supabase
      .from("contratos")
      .select("*")
      .eq("id_predio", predio.id_predio)
      .eq("estado", "Ativo");
    if (!contratos || contratos.length === 0) continue;

    const { data: fornecedoresPredio } = await supabase
      .from("fornecedores")
      .select("id_fornecedor, nome")
      .eq("id_predio", predio.id_predio);
    const nomeFornecedor = (idFornecedor) =>
      (fornecedoresPredio || []).find((f) => f.id_fornecedor === idFornecedor)?.nome || "Fornecedor";

    // Destinatários administrativos: os que gerem este prédio especificamente
    // e os que não têm id_predio definido (administradores globais).
    const { data: admins } = await supabase
      .from("profiles")
      .select("email, nome")
      .in("role", ["ADMIN", "EMPRESA_GESTORA", "GESTOR"])
      .or(`id_predio.eq.${predio.id_predio},id_predio.is.null`);
    const destinatarios = (admins || []).filter((a) => a.email);
    if (destinatarios.length === 0) continue;

    for (const c of contratos) {
      const nomeForn = nomeFornecedor(c.id_fornecedor);
      const diasRestantes = Math.ceil((new Date(c.data_fim).getTime() - new Date(hojeISO).getTime()) / 86400000);

      if (diasRestantes <= 0) {
        if (c.renovacao_automatica) {
          const parts = String(c.data_fim).split("-");
          const anoSeguinte = (parseInt(parts[0], 10) || new Date().getFullYear()) + 1;
          const novaDataFim = `${anoSeguinte}-${parts[1] || "12"}-${parts[2] || "31"}`;
          const logMsg = `Renovado automaticamente pelo sistema em ${new Date().toLocaleDateString("pt-PT")} para ${novaDataFim}`;

          await supabase
            .from("contratos")
            .update({
              data_fim: novaDataFim,
              alerta_enviado_em: null,
              historico_renovacoes: [logMsg, ...(c.historico_renovacoes || [])]
            })
            .eq("id_contrato", c.id_contrato);
          resultado.renovados += 1;
          resultado.detalhe.push({ id_contrato: c.id_contrato, acao: "renovado", nova_data_fim: novaDataFim });

          const html = gerarHtmlResposta(
            "Administração",
            `O contrato "${c.titulo}" com <strong>${nomeForn}</strong> (${predio.nome}) tinha renovação automática ativa e foi renovado por mais um ano, até <strong>${novaDataFim}</strong>.`
          );
          for (const dest of destinatarios) {
            await enviarEmailSemAnexo({ to: dest.email, subject: `Contrato renovado automaticamente — ${nomeForn}`, html }).catch(() => {});
          }
        } else {
          const logMsg = `Expirado sem renovação em ${new Date().toLocaleDateString("pt-PT")}`;
          await supabase
            .from("contratos")
            .update({
              estado: "Expirado",
              historico_renovacoes: [logMsg, ...(c.historico_renovacoes || [])]
            })
            .eq("id_contrato", c.id_contrato);
          resultado.expirados += 1;
          resultado.detalhe.push({ id_contrato: c.id_contrato, acao: "expirado" });

          try {
            await registarDocumento({
              ano: String(new Date().getFullYear()),
              tema: "Fornecedores",
              tipo: "Contrato Expirado",
              predio: predio.id_predio,
              fracao: null,
              fluxo: "contrato_expirado",
              origem: "cron_processar_contratos_fornecedores",
              nomeFicheiro: `Contrato_${c.titulo || c.id_contrato}_${nomeForn}.pdf`,
              categoria: "Contratos Rescindidos / Não Renovados",
              subPasta: nomeForn,
              fornecedor: nomeForn,
              visibilidade: "Administração"
            });
          } catch (err) {
            console.warn("[cronService] Aviso ao arquivar contrato expirado:", err?.message || err);
          }

          const html = gerarHtmlResposta(
            "Administração",
            `O contrato "${c.titulo}" com <strong>${nomeForn}</strong> (${predio.nome}) chegou à data de fim (${c.data_fim}) sem renovação automática ativa e foi marcado como <strong>Expirado</strong>. Se ainda for necessário, renove-o manualmente ou celebre um novo contrato em Fornecedores → Contratos.`
          );
          for (const dest of destinatarios) {
            await enviarEmailSemAnexo({ to: dest.email, subject: `Contrato expirou sem renovação — ${nomeForn}`, html }).catch(() => {});
          }
        }
        continue;
      }

      const prazoAlerta = Number(c.alerta_dias_antecedencia) || 60;
      if (diasRestantes <= prazoAlerta && !c.alerta_enviado_em) {
        await supabase.from("contratos").update({ alerta_enviado_em: hojeISO }).eq("id_contrato", c.id_contrato);
        resultado.alertas_enviados += 1;
        resultado.detalhe.push({ id_contrato: c.id_contrato, acao: "alerta", dias_restantes: diasRestantes });

        const html = gerarHtmlResposta(
          "Administração",
          `O contrato "${c.titulo}" com <strong>${nomeForn}</strong> (${predio.nome}) termina em <strong>${diasRestantes} dias</strong> (${c.data_fim}).${c.renovacao_automatica ? " Tem renovação automática ativa — será renovado sozinho quando chegar a data." : " Não tem renovação automática — decida se renova, rescinde ou deixa expirar."}`
        );
        for (const dest of destinatarios) {
          await enviarEmailSemAnexo({ to: dest.email, subject: `Contrato a vencer em ${diasRestantes} dias — ${nomeForn}`, html }).catch(() => {});
        }
      }
    }
  }

  return { job: "PROCESSAR_CONTRATOS_FORNECEDORES", ...resultado };
}

/**
 * Dia 25: emite a nota de cobrança das quotas do mês seguinte para todas as
 * frações de todos os prédios (Quota Ordinária + 10% Fundo Comum de Reserva,
 * DL 268/94). Cria os avisos ("Pendente") e envia a nota de cobrança por
 * email — o recibo de quitação só é emitido depois da confirmação manual do
 * pagamento pelo administrador (ver api_handlers_backup/confirmar-pagamento.js).
 */
export async function emitirQuotasMensais() {
  const predios = await obterPredios();
  const resultados = [];
  const hoje = new Date();
  let anoRef = hoje.getUTCFullYear();
  let mesRef = hoje.getUTCMonth() + 1; // mês seguinte, ainda 0-indexado após o +1 abaixo
  if (mesRef > 11) {
    mesRef = 0;
    anoRef += 1;
  }

  for (const predio of predios) {
    const orcamentoAnual = Number(predio.patrimonio?.orcamento_anual || 0);
    if (!orcamentoAnual) {
      console.log(`[cronService] Prédio "${predio.nome}" sem orçamento anual definido — a saltar emissão de quotas.`);
      continue;
    }

    // Não emitir quotas de meses anteriores ao início real da gestão deste
    // prédio (definido no Assistente de Arranque Inicial) — sem isto, um
    // prédio cuja gestão só arranca numa data futura já começava a receber
    // quotas mensais automáticas assim que tivesse orçamento configurado,
    // independentemente de a atividade ainda não ter começado.
    const dataInicioGestao = predio.patrimonio?.data_inicio_gestao;
    if (dataInicioGestao) {
      const inicioGestao = new Date(dataInicioGestao);
      if (!isNaN(inicioGestao.getTime())) {
        const inicioDoMesAFaturar = new Date(Date.UTC(anoRef, mesRef, 1));
        const inicioDoMesDeGestao = new Date(Date.UTC(inicioGestao.getUTCFullYear(), inicioGestao.getUTCMonth(), 1));
        if (inicioDoMesAFaturar < inicioDoMesDeGestao) {
          console.log(`[cronService] Prédio "${predio.nome}" ainda não iniciou gestão (início: ${dataInicioGestao}) — a saltar emissão de quotas de ${mesRef + 1}/${anoRef}.`);
          continue;
        }
      }
    }

    const fracoes = await obterFracoesDoPredio(predio.id_predio);
    const prefixoEdificio = derivarPrefixoEdificio(predio.nome);
    const rates = calcularRatesPredio(predio, fracoes);
    const contas = await obterContasDoPredio(predio.id_predio);
    const mesIndex0 = mesRef;

    for (const f of fracoes) {
      try {
        if (await jaExecutadoHoje("cron_emissao_quotas", f.id_fracao)) {
          console.log(`[cronService] Fração ${f.fracao_nome} já teve a quota emitida hoje — a saltar.`);
          continue;
        }

        // Buscado antes de criar o aviso para poder gravar logo a
        // "fotografia" do proprietário (nome/NIF) no momento da emissão —
        // sem isto, reabrir um aviso antigo depois de uma Transferência de
        // Propriedade mostrava sempre o proprietário ATUAL da fração.
        const proprietario = await obterProprietarioDaFracao(f.id_fracao);

        // Há alguma prestação de Quota Extraordinária desta fração a vencer
        // no mesmo mês (já criadas de uma vez só ao configurar-se em
        // GestaoQuotasOrcamento.tsx)? Se a conta bancária for a mesma da
        // Ordinária, entra como rubrica extra na MESMA nota/recibo; se for
        // diferente, é emitida uma nota à parte, só para essa prestação —
        // exatamente o mesmo fluxo (nota de cobrança + recibo) das quotas
        // ordinárias, como pedido.
        const avisoExtraDoMes = await obterExtraordinariaPendenteDoMes(f.id_fracao, anoRef, mesIndex0);
        const contasIguais = avisoExtraDoMes
          && escolherIbanContaPorTipo(contas, "Quota Ordinária") === escolherIbanContaPorTipo(contas, "Quota Extraordinária");

        const resultado = await emitirNotaCobrancaFracaoMes({
          predio,
          f,
          proprietario,
          rates,
          anoRef,
          mesIndex0,
          prefixoEdificio,
          fluxo: "emissao_quotas_mensal",
          contas,
          extraordinariaMesma: contasIguais ? avisoExtraDoMes : undefined
        });

        if (!resultado.ok) continue;

        if (avisoExtraDoMes && !contasIguais) {
          try {
            await emitirNotaExtraordinariaSeparada({ predio, f, proprietario, avisoExtra: avisoExtraDoMes, prefixoEdificio, contas });
          } catch (errExtra) {
            console.error(`[cronService] Erro ao emitir nota extraordinária separada da fração ${f.fracao_nome}:`, errExtra);
          }
        }

        await marcarExecutadoHoje("cron_emissao_quotas", f.id_fracao, f.fracao_nome, predio.id_predio);
        if (proprietario?.email) {
          resultados.push({ predio: predio.nome, fracao: f.fracao_nome, email: proprietario.email });
        }
      } catch (errFracao) {
        console.error(`[cronService] Erro ao emitir quota da fração ${f.fracao_nome}:`, errFracao);
      }
    }
  }

  return { job: "emitirQuotasMensais", total: resultados.length, resultados };
}

/**
 * Dia 5: lembrete de pagamento — envia apenas às frações cuja quota do mês a
 * decorrer ainda esteja "Pendente" (avisos.estado). Sem anexo.
 */
export async function enviarLembretesQuotas() {
  const hoje = new Date();
  const [inicioMes, fimMes] = limitesMesAtualUTC(hoje);

  const { data: avisosPendentes, error } = await supabase
    .from("avisos")
    .select("*")
    .eq("tipo", "Quota Ordinária")
    .eq("estado", "Pendente")
    .gte("data", inicioMes)
    .lte("data", fimMes);

  if (error || !avisosPendentes) {
    if (error) console.error("[cronService] Erro ao obter avisos pendentes:", error.message);
    return { job: "enviarLembretesQuotas", total: 0, resultados: [] };
  }

  const resultados = [];
  for (const aviso of avisosPendentes) {
    try {
      if (await jaExecutadoHoje("cron_lembrete_quotas", aviso.id_fracao)) continue;

      const [{ data: fracao }, proprietario] = await Promise.all([
        supabase.from("fracoes").select("fracao_nome").eq("id_fracao", aviso.id_fracao).maybeSingle(),
        obterProprietarioDaFracao(aviso.id_fracao)
      ]);
      if (!proprietario?.email) continue;

      const fracaoNome = fracao?.fracao_nome || aviso.id_fracao;

      const modeloLembrete = await obterModeloEmail(aviso.id_predio, "lembrete_quota");
      const valoresLembrete = {
        nome: proprietario.nome,
        fracao: fracaoNome,
        valor: `${Number(aviso.valor).toFixed(2)} €`,
        data: formatarDataPT(aviso.vencimento),
        metodo: "Transferência Bancária"
      };

      const assuntoLembrete = modeloLembrete
        ? interpolarModeloEmail(modeloLembrete.subject, valoresLembrete)
        : `Lembrete: Quota de Condomínio por Regularizar — Fração ${fracaoNome}`;
      const corpoLembrete = modeloLembrete
        ? interpolarModeloEmail(modeloLembrete.body, valoresLembrete).replace(/\n/g, "<br>")
        : `Relembramos que a quota de condomínio referente à fração <strong>${fracaoNome}</strong>, no valor de <strong>${Number(aviso.valor).toFixed(2)} €</strong>, se encontra ainda por regularizar, com vencimento a <strong>${formatarDataPT(aviso.vencimento)}</strong>.<br><br>Se já efetuou o pagamento, pode ignorar esta mensagem — basta enviar o comprovativo para o email <strong>bentorodrgues2@gmail.com</strong> de forma a que seja validado pela administração e o respetivo recibo lhe seja enviado.`;

      const html = gerarHtmlResposta(proprietario.nome, corpoLembrete);

      const enviado = await enviarEmailSemAnexo({
        to: proprietario.email,
        subject: assuntoLembrete,
        html
      });

      if (enviado) {
        await marcarExecutadoHoje("cron_lembrete_quotas", aviso.id_fracao, fracaoNome, aviso.id_predio);
        resultados.push({ fracao: fracaoNome, email: proprietario.email });
      }
    } catch (errAviso) {
      console.error("[cronService] Erro ao enviar lembrete:", errAviso);
    }
  }

  return { job: "enviarLembretesQuotas", total: resultados.length, resultados };
}

/**
 * Dia 16: aviso de mora — tom mais formal, para quem continua "Pendente"
 * depois do lembrete do dia 5. Não altera o estado do aviso (teria de
 * continuar "Pendente" para a dívida ser corretamente contabilizada em toda
 * a app — GestaoMovimentos, ContenciosoJuridico, DashboardKPIs, etc.).
 */
export async function avisarQuotasEmMora() {
  const hoje = new Date();
  const [inicioMes, fimMes] = limitesMesAtualUTC(hoje);

  const { data: avisosPendentes, error } = await supabase
    .from("avisos")
    .select("*")
    .eq("tipo", "Quota Ordinária")
    .eq("estado", "Pendente")
    .gte("data", inicioMes)
    .lte("data", fimMes);

  if (error || !avisosPendentes) {
    if (error) console.error("[cronService] Erro ao obter avisos em mora:", error.message);
    return { job: "avisarQuotasEmMora", total: 0, resultados: [] };
  }

  const resultados = [];
  for (const aviso of avisosPendentes) {
    try {
      if (await jaExecutadoHoje("cron_aviso_mora", aviso.id_fracao)) continue;

      const [{ data: fracao }, proprietario] = await Promise.all([
        supabase.from("fracoes").select("fracao_nome").eq("id_fracao", aviso.id_fracao).maybeSingle(),
        obterProprietarioDaFracao(aviso.id_fracao)
      ]);
      if (!proprietario?.email) continue;

      const fracaoNome = fracao?.fracao_nome || aviso.id_fracao;

      const { count: mesesEmAtraso } = await supabase
        .from("avisos")
        .select("id_aviso", { count: "exact", head: true })
        .eq("id_fracao", aviso.id_fracao)
        .eq("tipo", "Quota Ordinária")
        .eq("estado", "Pendente");

      const modeloMora = await obterModeloEmail(aviso.id_predio, "aviso_divida");
      const valoresMora = {
        nome: proprietario.nome,
        fracao: fracaoNome,
        valor: `${Number(aviso.valor).toFixed(2)} €`,
        data: formatarDataPT(aviso.vencimento),
        x: `${mesesEmAtraso || 1} mês(es)`
      };

      const assuntoMora = modeloMora
        ? interpolarModeloEmail(modeloMora.subject, valoresMora)
        : `Aviso de Mora — Quota de Condomínio em Atraso — Fração ${fracaoNome}`;
      const corpoMora = modeloMora
        ? interpolarModeloEmail(modeloMora.body, valoresMora).replace(/\n/g, "<br>")
        : `A quota de condomínio referente à fração <strong>${fracaoNome}</strong>, no valor de <strong>${Number(aviso.valor).toFixed(2)} €</strong>, encontra-se em mora — o prazo de vencimento (<strong>${formatarDataPT(aviso.vencimento)}</strong>) já foi ultrapassado.<br><br>Solicitamos a regularização o mais breve possível, de forma a evitar o agravamento da dívida nos termos regulamentares. Caso já tenha efetuado o pagamento, agradecemos o envio do comprovativo para o email <strong>bentorodrgues2@gmail.com</strong>.`;

      const html = gerarHtmlResposta(proprietario.nome, corpoMora);

      const enviado = await enviarEmailSemAnexo({
        to: proprietario.email,
        subject: assuntoMora,
        html
      });

      if (enviado) {
        await marcarExecutadoHoje("cron_aviso_mora", aviso.id_fracao, fracaoNome, aviso.id_predio);
        resultados.push({ fracao: fracaoNome, email: proprietario.email });
      }
    } catch (errAviso) {
      console.error("[cronService] Erro ao enviar aviso de mora:", errAviso);
    }
  }

  return { job: "avisarQuotasEmMora", total: resultados.length, resultados };
}

/**
 * Diário: felicitações de aniversário — compara mês/dia de
 * proprietarios.data_nascimento com a data de hoje.
 */
export async function enviarFelicitacoesAniversario() {
  const hoje = new Date();
  const mesHoje = hoje.getUTCMonth() + 1;
  const diaHoje = hoje.getUTCDate();

  const { data: proprietarios, error } = await supabase
    .from("proprietarios")
    .select("*")
    .not("data_nascimento", "is", null);

  if (error || !proprietarios) {
    if (error) console.error("[cronService] Erro ao obter proprietários para aniversários:", error.message);
    return { job: "enviarFelicitacoesAniversario", total: 0, resultados: [] };
  }

  const aniversariantes = proprietarios.filter((p) => {
    const partes = String(p.data_nascimento).split("-");
    if (partes.length !== 3) return false;
    const [, mes, dia] = partes;
    return Number(mes) === mesHoje && Number(dia) === diaHoje;
  });

  const resultados = [];
  for (const proprietario of aniversariantes) {
    try {
      if (!proprietario.email) continue;
      if (await jaExecutadoHoje("cron_aniversario", proprietario.id_proprietario)) continue;

      const { data: predio } = proprietario.id_predio
        ? await supabase.from("predios").select("nome, patrimonio").eq("id_predio", proprietario.id_predio).maybeSingle()
        : { data: null };

      // O postal é o próprio corpo do email (não faz sentido como PDF em
      // anexo) e leva a assinatura digital real do administrador quando
      // existir — ver src/components/GestaoFracoes.tsx.
      const html = gerarHtmlAniversario({
        nome: proprietario.nome,
        predioNome: predio?.nome || "Condomínio",
        adminNome: predio?.patrimonio?.nome_administrador || "José Carlos Guerra",
        adminSignatureBase64: predio?.patrimonio?.assinatura_admin_base64 || null
      });

      const enviado = await enviarEmailSemAnexo({
        to: proprietario.email,
        subject: `Feliz Aniversário, ${proprietario.nome}! 🎉`,
        html
      });

      if (enviado) {
        await marcarExecutadoHoje("cron_aniversario", proprietario.id_proprietario, proprietario.nome, proprietario.id_predio);
        resultados.push({ proprietario: proprietario.nome, email: proprietario.email });
      }
    } catch (errAniv) {
      console.error("[cronService] Erro ao enviar felicitação de aniversário:", errAniv);
    }
  }

  return { job: "enviarFelicitacoesAniversario", total: resultados.length, resultados };
}

/**
 * Diário: arquiva automaticamente conversas de mensagens sem atividade há
 * mais de 7 dias (respondidas ou não) — gera um PDF com o histórico
 * completo, arquiva-o no Arquivo Digital (Mensagens, organizado por
 * ano/fração) e remove a conversa das tabelas ativas (conversas/
 * mensagens_conversa), para a caixa de entrada da Administração não ficar
 * a acumular indefinidamente.
 */
export async function arquivarConversasAntigas() {
  const limiteISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: conversas, error: errConv } = await supabase
    .from("conversas")
    .select("*")
    .lt("updated_at", limiteISO);

  if (errConv) {
    console.error("[cronService] Erro ao obter conversas para arquivar:", errConv.message);
    return { job: "arquivarConversasAntigas", total: 0, resultados: [] };
  }

  const resultados = [];
  for (const conversa of conversas || []) {
    try {
      const { data: mensagens } = await supabase
        .from("mensagens_conversa")
        .select("*")
        .eq("id_conversa", conversa.id_conversa)
        .order("created_at", { ascending: true });

      const { data: fracao } = await supabase
        .from("fracoes")
        .select("fracao_nome")
        .eq("id_fracao", conversa.id_fracao)
        .maybeSingle();
      const fracaoNome = fracao?.fracao_nome || conversa.id_fracao;
      const ano = new Date(conversa.created_at || Date.now()).getFullYear();

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`HISTÓRICO DE MENSAGENS — Fração ${fracaoNome}`, 105, 18, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Condómino: ${conversa.proprietario_nome || "—"} | Assunto: ${conversa.assunto || "—"}`, 15, 27);
      doc.text(`Arquivado automaticamente em ${new Date().toLocaleDateString("pt-PT")} (sem atividade há mais de 7 dias)`, 15, 32);

      let y = 42;
      doc.setFontSize(8.5);
      for (const m of mensagens || []) {
        if (y > 275) { doc.addPage(); y = 20; }
        const autor = m.autor === "administracao" ? "Administração" : (conversa.proprietario_nome || "Condómino");
        const dataHora = m.created_at ? new Date(m.created_at).toLocaleString("pt-PT") : "";
        doc.setFont("helvetica", "bold");
        doc.text(`${autor} (${dataHora}):`, 15, y);
        y += 4.5;
        doc.setFont("helvetica", "normal");
        const linhas = doc.splitTextToSize(m.texto || "", 180);
        doc.text(linhas, 15, y);
        y += linhas.length * 4.2 + 3;
      }

      const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
      const nomeFicheiro = `Mensagens_${fracaoNome}_${conversa.id_conversa}.pdf`;

      const caminho = await guardarNoArquivo({
        pdfBuffer,
        ano,
        tema: "Mensagens",
        tipo: "Histórico de Conversa",
        predio: conversa.id_predio,
        fracao: conversa.id_fracao,
        fluxo: "arquivamento_mensagens",
        nomeFicheiro
      });

      await registarDocumento({
        caminho,
        ano,
        tema: "Mensagens",
        tipo: "Histórico de Conversa",
        predio: conversa.id_predio,
        fracao: conversa.id_fracao,
        fluxo: "arquivamento_mensagens",
        origem: "cron_arquivar_mensagens",
        nomeFicheiro,
        categoria: "Mensagens Arquivadas",
        visibilidade: "Administração"
      });

      await supabase.from("mensagens_conversa").delete().eq("id_conversa", conversa.id_conversa);
      await supabase.from("conversas").delete().eq("id_conversa", conversa.id_conversa);

      resultados.push({ id_conversa: conversa.id_conversa, fracao: fracaoNome, mensagens: (mensagens || []).length });
    } catch (errConversa) {
      console.error(`[cronService] Erro ao arquivar conversa ${conversa.id_conversa}:`, errConversa);
    }
  }

  return { job: "arquivarConversasAntigas", total: resultados.length, resultados };
}

/**
 * Envio único (não recorrente) das notas de cobrança de outubro/2026 com o
 * valor da nova quotização, só para quem ainda não pagou esse mês — pedido
 * explícito do administrador para correr uma vez, às 8h30, depois de a
 * revisão de quotas ter sido aplicada. Título obrigatoriamente com
 * "correção nova Quota mensal", conforme pedido. Idempotente por fração
 * (jaExecutadoHoje) para não duplicar em caso de novo disparo no mesmo dia.
 */
export async function enviarNotasCorrecaoNovaQuota(id_predio, vencimentoISO) {
  const { data: predio } = await supabase.from("predios").select("*").eq("id_predio", id_predio).maybeSingle();
  if (!predio) return { job: "enviarNotasCorrecaoNovaQuota", total: 0, resultados: [], error: "Prédio não encontrado." };

  const { data: avisosPendentes, error } = await supabase
    .from("avisos")
    .select("*")
    .eq("id_predio", id_predio)
    .eq("tipo", "Quota Ordinária")
    .eq("estado", "Pendente")
    .eq("vencimento", vencimentoISO)
    .not("descricao", "ilike", "Diferença de Quota%");

  if (error || !avisosPendentes) {
    if (error) console.error("[cronService] Erro ao obter avisos de outubro:", error.message);
    return { job: "enviarNotasCorrecaoNovaQuota", total: 0, resultados: [] };
  }

  const contas = await obterContasDoPredio(id_predio);
  const prefixoEdificio = derivarPrefixoEdificio(predio.nome);
  const [anoRef, mesNum] = vencimentoISO.split("-").map((n) => parseInt(n, 10));
  const mesRefLabel = nomeMesUTC(anoRef, mesNum - 1);
  const hojeUTC = new Date();
  const dataEmissao = isoDate(hojeUTC.getUTCFullYear(), hojeUTC.getUTCMonth(), hojeUTC.getUTCDate());

  const resultados = [];
  for (const aviso of avisosPendentes) {
    try {
      if (await jaExecutadoHoje("cron_correcao_nova_quota", aviso.id_fracao)) continue;

      const { data: f } = await supabase.from("fracoes").select("*").eq("id_fracao", aviso.id_fracao).maybeSingle();
      if (!f) continue;
      const proprietario = await obterProprietarioDaFracao(aviso.id_fracao);
      if (!proprietario?.email) continue;

      const valorFCR = Number(aviso.valor_fundo_reserva || 0);
      const valorTotal = Number(aviso.valor || 0);
      const valorOrdinario = Math.round((valorTotal - valorFCR) * 100) / 100;

      const { count: totalNotas } = await supabase
        .from("avisos")
        .select("id_aviso", { count: "exact", head: true })
        .eq("tipo", "Quota Ordinária");
      const sequencial = String(totalNotas || 1).padStart(5, "0");

      const nota = {
        id_recibo: `${prefixoEdificio} ${sequencial}`,
        tipoDocumento: "nota_cobranca",
        numero_sequencial: totalNotas || 1,
        ano: anoRef,
        id_predio: predio.id_predio,
        id_fracao: f.id_fracao,
        nome_condomino: proprietario.nome,
        nif_condomino: proprietario.nif || "",
        fracao_nome: f.fracao_nome,
        permilagem: f.permilagem,
        data_emissao: dataEmissao,
        data_pagamento: aviso.vencimento,
        metodo_pagamento: "Transferência Bancária",
        valor_total: valorTotal,
        rubricas: [
          { descricao: `Quota de Condomínio Ordinária - ${mesRefLabel} / ${anoRef}`, valor: valorOrdinario, tipo: "Quota Ordinária" },
          { descricao: `Fundo Comum de Reserva (FCR) - ${mesRefLabel} / ${anoRef}`, valor: valorFCR, tipo: "Fundo Comum de Reserva" }
        ],
        iban_predio: escolherIbanContaPorTipo(contas, "Quota Ordinária") || predio.iban || "",
        emitido_por: "Administração do Condomínio",
        adminSignatureBase64: predio.patrimonio?.assinatura_admin_base64 || "sem-assinatura-digital"
      };

      const doc = generateOfficialReceiptPDF(nota, predio, f);
      const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
      const nomeFicheiro = nomeFicheiroRecibo(nota);

      const caminho = await guardarNoArquivo({
        pdfBuffer, ano: anoRef, tema: "Financeiro", tipo: "Nota de Cobrança",
        predio: predio.id_predio, fracao: f.id_fracao, fluxo: "correcao_nova_quota", nomeFicheiro
      });
      await registarDocumento({
        caminho, ano: anoRef, tema: "Financeiro", tipo: "Nota de Cobrança",
        predio: predio.id_predio, fracao: f.id_fracao, fluxo: "correcao_nova_quota",
        origem: "correcao_nova_quota_mensal", nomeFicheiro, categoria: "Pasta Paga. Quotas", visibilidade: "Público"
      });

      const emailEnviado = await enviarEmailPDF({
        to: proprietario.email,
        nomeDestinatario: proprietario.nome,
        assunto: `Correção Nova Quota Mensal — ${mesRefLabel} / ${anoRef} — Fração ${f.fracao_nome}`,
        mensagem: `Na sequência da revisão de quotas aprovada, a quota de condomínio da fração <strong>${f.fracao_nome}</strong> foi atualizada a partir deste mês. Segue em anexo a nota de cobrança corrigida de <strong>${mesRefLabel} de ${anoRef}</strong>, no novo valor de <strong>${valorTotal.toFixed(2)} €</strong>, com vencimento a <strong>${formatarDataPT(aviso.vencimento)}</strong>.<br><br>Assim que o pagamento for confirmado pela administração, receberá o respetivo recibo oficial.`,
        pdfBuffer,
        nome: nomeFicheiro
      });

      if (emailEnviado) {
        await marcarExecutadoHoje("cron_correcao_nova_quota", aviso.id_fracao, f.fracao_nome, id_predio);
        resultados.push({ fracao: f.fracao_nome, email: proprietario.email, valor: valorTotal });
      }
    } catch (errAviso) {
      console.error("[cronService] Erro ao enviar correção de nova quota:", errAviso);
    }
  }

  return { job: "enviarNotasCorrecaoNovaQuota", total: resultados.length, resultados };
}

export default {
  emitirQuotasMensais,
  emitirNotasEmAtrasoFracao,
  reenviarNotaCobrancaCorrigida,
  enviarNotasCorrecaoNovaQuota,
  arquivarConversasAntigas,
  enviarLembretesQuotas,
  avisarQuotasEmMora,
  enviarFelicitacoesAniversario
};
