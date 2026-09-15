import { supabase } from "./supabaseServer.js";
import { generateOfficialReceiptPDF, nomeFicheiroRecibo } from "./receiptGenerator.js";
import { guardarNoArquivo, registarDocumento, enviarEmailPDF } from "./pdfService.js";
import { gerarHtmlResposta } from "./htmlemail.js";
import { gerarCartaoAniversarioCondominoPDF } from "./pdfDocs.js";
import { derivarPrefixoEdificio } from "./reciboUtils.js";

/**
 * Envia um email institucional (logótipo + assinatura) sem PDF anexo — usado
 * pelos lembretes/avisos de mora, que não têm documento associado.
 */
async function enviarEmailSemAnexo({ to, subject, html }) {
  const resendApiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
  if (!resendApiKey || !to) return false;

  const fromEmail = process.env.EMAIL_FROM_ADDRESS || "administracao@condomanagerai.com";
  const fromAddress = fromEmail.includes("<") ? fromEmail : `Condomínio <${fromEmail}>`;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
      body: JSON.stringify({ from: fromAddress, to: [to], subject, html })
    });
    if (!resp.ok) {
      console.error("[cronService] Erro Resend:", resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[cronService] Falha ao enviar email:", err);
    return false;
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

async function obterProprietarioDaFracao(id_fracao) {
  const { data } = await supabase.from("proprietarios").select("*").eq("id_fracao", id_fracao).maybeSingle();
  return data || null;
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
  const mesRefLabel = nomeMesUTC(anoRef, mesRef);
  const dataEmissao = isoDate(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  const vencimento = isoDate(anoRef, mesRef, 8);

  for (const predio of predios) {
    const orcamentoAnual = Number(predio.patrimonio?.orcamento_anual || 0);
    if (!orcamentoAnual) {
      console.log(`[cronService] Prédio "${predio.nome}" sem orçamento anual definido — a saltar emissão de quotas.`);
      continue;
    }

    const fracoes = await obterFracoesDoPredio(predio.id_predio);
    const prefixoEdificio = derivarPrefixoEdificio(predio.nome);

    for (const f of fracoes) {
      try {
        const isShopExempt = f.tipologia === "Loja Comercial" && (f.tipo_access || "").includes("Exterior");
        const fatorIsencao = isShopExempt ? 0.4 : 1.0;
        const orcamentoMensalProporcional = (orcamentoAnual / 12) * (f.permilagem / 1000) * fatorIsencao;
        const valorOrdinario = Math.round(orcamentoMensalProporcional * 0.9 * 100) / 100;
        const valorFCR = Math.round(orcamentoMensalProporcional * 0.1 * 100) / 100;
        const valorTotal = Math.round((valorOrdinario + valorFCR) * 100) / 100;

        const idOrdinario = `av-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const idFCR = `av-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        const { error: errAv } = await supabase.from("avisos").insert([
          {
            id_aviso: idOrdinario,
            id_predio: predio.id_predio,
            id_fracao: f.id_fracao,
            tipo: "Quota Ordinária",
            data: dataEmissao,
            vencimento,
            descricao: `Quota de Condomínio Ordinária - ${mesRefLabel} / ${anoRef}`,
            valor: valorOrdinario,
            estado: "Pendente"
          },
          {
            id_aviso: idFCR,
            id_predio: predio.id_predio,
            id_fracao: f.id_fracao,
            tipo: "Fundo de Reserva",
            data: dataEmissao,
            vencimento,
            descricao: `Quota do Fundo Comum de Reserva (FCR) - ${mesRefLabel} / ${anoRef}`,
            valor: valorFCR,
            estado: "Pendente"
          }
        ]);

        if (errAv) {
          console.warn(`[cronService] Erro ao criar avisos da fração ${f.fracao_nome}:`, errAv.message);
          continue;
        }

        const proprietario = await obterProprietarioDaFracao(f.id_fracao);
        if (!proprietario?.email) continue;

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
          data_pagamento: vencimento,
          metodo_pagamento: "Transferência Bancária",
          valor_total: valorTotal,
          rubricas: [
            { descricao: `Quota de Condomínio Ordinária - ${mesRefLabel} / ${anoRef}`, valor: valorOrdinario, tipo: "Quota Ordinária" },
            { descricao: `Fundo Comum de Reserva (FCR) - ${mesRefLabel} / ${anoRef}`, valor: valorFCR, tipo: "Fundo Comum de Reserva" }
          ],
          iban_predio: predio.iban || "",
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
          fluxo: "emissao_quotas_mensal",
          nomeFicheiro
        });

        await registarDocumento({
          caminho,
          ano: anoRef,
          tema: "Financeiro",
          tipo: "Nota de Cobrança",
          predio: predio.id_predio,
          fracao: f.id_fracao,
          fluxo: "emissao_quotas_mensal",
          origem: "cron_emissao_quotas",
          nomeFicheiro
        });

        await enviarEmailPDF({
          to: proprietario.email,
          nomeDestinatario: proprietario.nome,
          assunto: `Nota de Cobrança — Quota de ${mesRefLabel} / ${anoRef} — Fração ${f.fracao_nome}`,
          mensagem: `Segue em anexo a nota de cobrança referente à quota de condomínio de <strong>${mesRefLabel} de ${anoRef}</strong>, no valor de <strong>${valorTotal.toFixed(2)} €</strong>, com vencimento a <strong>${formatarDataPT(vencimento)}</strong>.<br><br>Assim que o pagamento for confirmado pela administração, receberá o respetivo recibo de quitação oficial.`,
          pdfBuffer,
          nome: nomeFicheiro
        });

        resultados.push({ predio: predio.nome, fracao: f.fracao_nome, email: proprietario.email, valor: valorTotal });
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
      const [{ data: fracao }, proprietario] = await Promise.all([
        supabase.from("fracoes").select("fracao_nome").eq("id_fracao", aviso.id_fracao).maybeSingle(),
        obterProprietarioDaFracao(aviso.id_fracao)
      ]);
      if (!proprietario?.email) continue;

      const fracaoNome = fracao?.fracao_nome || aviso.id_fracao;
      const html = gerarHtmlResposta(
        proprietario.nome,
        `Relembramos que a quota de condomínio referente à fração <strong>${fracaoNome}</strong>, no valor de <strong>${Number(aviso.valor).toFixed(2)} €</strong>, se encontra ainda por regularizar, com vencimento a <strong>${formatarDataPT(aviso.vencimento)}</strong>.<br><br>Se já efetuou o pagamento, pode ignorar esta mensagem — basta enviar o comprovativo por email para que seja validado pela administração e o respetivo recibo lhe seja enviado.`
      );

      const enviado = await enviarEmailSemAnexo({
        to: proprietario.email,
        subject: `Lembrete: Quota de Condomínio por Regularizar — Fração ${fracaoNome}`,
        html
      });

      if (enviado) resultados.push({ fracao: fracaoNome, email: proprietario.email });
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
      const [{ data: fracao }, proprietario] = await Promise.all([
        supabase.from("fracoes").select("fracao_nome").eq("id_fracao", aviso.id_fracao).maybeSingle(),
        obterProprietarioDaFracao(aviso.id_fracao)
      ]);
      if (!proprietario?.email) continue;

      const fracaoNome = fracao?.fracao_nome || aviso.id_fracao;
      const html = gerarHtmlResposta(
        proprietario.nome,
        `A quota de condomínio referente à fração <strong>${fracaoNome}</strong>, no valor de <strong>${Number(aviso.valor).toFixed(2)} €</strong>, encontra-se em mora — o prazo de vencimento (<strong>${formatarDataPT(aviso.vencimento)}</strong>) já foi ultrapassado.<br><br>Solicitamos a regularização o mais breve possível, de forma a evitar o agravamento da dívida nos termos regulamentares. Caso já tenha efetuado o pagamento, agradecemos o envio do comprovativo por email.`
      );

      const enviado = await enviarEmailSemAnexo({
        to: proprietario.email,
        subject: `Aviso de Mora — Quota de Condomínio em Atraso — Fração ${fracaoNome}`,
        html
      });

      if (enviado) resultados.push({ fracao: fracaoNome, email: proprietario.email });
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

      const { data: predio } = proprietario.id_predio
        ? await supabase.from("predios").select("nome").eq("id_predio", proprietario.id_predio).maybeSingle()
        : { data: null };

      const doc = gerarCartaoAniversarioCondominoPDF(proprietario.nome, predio?.nome || "Condomínio", "Administração do Condomínio", true);
      const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
      const nomeFicheiro = "Cartao_Aniversario_Condomino.pdf";

      await enviarEmailPDF({
        to: proprietario.email,
        nomeDestinatario: proprietario.nome,
        assunto: "Feliz Aniversário! 🎉 — A Administração do Condomínio",
        mensagem: `Toda a Administração do condomínio deseja-lhe um Feliz Aniversário! Segue em anexo um pequeno postal de felicitações.`,
        pdfBuffer,
        nome: nomeFicheiro
      });

      resultados.push({ proprietario: proprietario.nome, email: proprietario.email });
    } catch (errAniv) {
      console.error("[cronService] Erro ao enviar felicitação de aniversário:", errAniv);
    }
  }

  return { job: "enviarFelicitacoesAniversario", total: resultados.length, resultados };
}

export default {
  emitirQuotasMensais,
  enviarLembretesQuotas,
  avisarQuotasEmMora,
  enviarFelicitacoesAniversario
};
