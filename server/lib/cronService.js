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

async function obterProprietarioDaFracao(id_fracao) {
  const { data } = await supabase.from("proprietarios").select("*").eq("id_fracao", id_fracao).maybeSingle();
  return data || null;
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
        if (await jaExecutadoHoje("cron_emissao_quotas", f.id_fracao)) {
          console.log(`[cronService] Fração ${f.fracao_nome} já teve a quota emitida hoje — a saltar.`);
          continue;
        }

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
          nomeFicheiro,
          categoria: "Pasta Paga. Quotas",
          visibilidade: "Público"
        });

        // Usa o modelo "Aviso de Cobrança" editado em Definições, se existir
        // (senão mantém o texto por omissão abaixo).
        const modeloCobranca = await obterModeloEmail(predio.id_predio, "aviso_cobranca");
        const valoresCobranca = {
          nome: proprietario.nome,
          fracao: f.fracao_nome,
          valor: `${valorTotal.toFixed(2)} €`,
          data: formatarDataPT(vencimento)
        };

        await enviarEmailPDF({
          to: proprietario.email,
          nomeDestinatario: proprietario.nome,
          assunto: modeloCobranca
            ? interpolarModeloEmail(modeloCobranca.subject, valoresCobranca)
            : `Nota de Cobrança — Quota de ${mesRefLabel} / ${anoRef} — Fração ${f.fracao_nome}`,
          mensagem: modeloCobranca
            ? interpolarModeloEmail(modeloCobranca.body, valoresCobranca).replace(/\n/g, "<br>")
            : `Segue em anexo a nota de cobrança referente à quota de condomínio de <strong>${mesRefLabel} de ${anoRef}</strong>, no valor de <strong>${valorTotal.toFixed(2)} €</strong>, com vencimento a <strong>${formatarDataPT(vencimento)}</strong>.<br><br>Assim que o pagamento for confirmado pela administração, receberá o respetivo recibo de quitação oficial. Para um rápido cruzamento de dados, envie o comprovativo do pagamento para o email <strong>bentorodrgues2@gmail.com</strong>.`,
          pdfBuffer,
          nome: nomeFicheiro
        });

        await marcarExecutadoHoje("cron_emissao_quotas", f.id_fracao, f.fracao_nome, predio.id_predio);
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

export default {
  emitirQuotasMensais,
  enviarLembretesQuotas,
  avisarQuotasEmMora,
  enviarFelicitacoesAniversario
};
