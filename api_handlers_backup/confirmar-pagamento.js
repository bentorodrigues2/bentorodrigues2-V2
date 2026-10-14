import { createHash } from "crypto";
import { supabase } from "../server/lib/supabaseServer.js";
import { guardarNoArquivo, registarDocumento, enviarEmailPDF } from "../server/lib/pdfService.js";
import { generateOfficialReceiptPDF, nomeFicheiroRecibo } from "../server/lib/receiptGenerator.js";
import { derivarPrefixoEdificio } from "../server/lib/reciboUtils.js";
import { obterModeloEmail, interpolarModeloEmail } from "../server/lib/emailTemplates.js";
import { escolherContaPorTipo, ajustarSaldoConta } from "../server/lib/contaSaldo.js";

// Escolhe o IBAN certo consoante o tipo de aviso: Quota Ordinária e Fundo
// Comum de Reserva usam a conta corrente principal (is_principal), Quota
// Extraordinária usa a conta de poupança/obras — mesma lógica que
// escolherIbanContaPorTipo em src/utils.ts e server/lib/cronService.js.
function escolherIbanContaPorTipo(contas, tipoAviso) {
  if (!contas || contas.length === 0) return "";
  const ehExtraordinaria = (tipoAviso || "").toLowerCase().includes("extra");
  const contaPrincipal = contas.find((c) => c.is_principal);
  const contaSecundaria = contas.find((c) => !c.is_principal);
  if (ehExtraordinaria) return (contaSecundaria || contaPrincipal || contas[0])?.iban || "";
  return (contaPrincipal || contas[0])?.iban || "";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    // avisos_ids (opcional): quando o chamador (ex: aprovarPagamentoCondomino
    // em GestaoMovimentos.tsx) já sabe exatamente quais avisos este pagamento
    // fecha — 1 ou vários meses/prestações de uma vez — e já os marcou "Pago"
    // antes de chamar este endpoint. Nesse caso o recibo é montado com 1
    // linha por aviso real (mês/tipo/valor certos) em vez de adivinhar sempre
    // "Quota Ordinária + 10% Fundo de Reserva", e o passo 2.1 abaixo (que
    // tentava adivinhar o aviso a marcar) fica desligado, para não criar um
    // aviso-fantasma duplicado a repetir o que o chamador já fez.
    // vencimento_alvo (opcional): quando o chamador sabe que este pagamento é
    // um ADIANTAMENTO (ex: mês seguinte, cuja nota de cobrança ainda nem foi
    // emitida — só sai no dia 25 do mês anterior) e já perguntou ao
    // administrador a que mês se refere, em vez de a "2.1" abaixo assumir
    // sempre a data real da transferência bancária (que cai no mês ATUAL, não
    // no mês a que o pagamento se destina — confirmado em produção: um
    // adiantamento de Novembro ficava registado como se fosse a quota de
    // Outubro, duplicando essa coluna no Mapa de Pagamentos e deixando
    // Novembro por registar).
    const { id_pagamento, avisos_ids: avisosIdsFechados, vencimento_alvo: vencimentoAlvo } = req.body || {};
    if (!id_pagamento) {
      return res.status(400).json({ error: "id_pagamento em falta" });
    }

    // 0) Impede confirmar duas vezes o mesmo pagamento (ex: duplo clique) —
    // sem isto o saldo da conta seria creditado outra vez a mais abaixo.
    const { data: pagamentoAntes } = await supabase
      .from("pagamentos")
      .select("estado")
      .eq("id", id_pagamento)
      .maybeSingle();
    if (!pagamentoAntes) {
      return res.status(404).json({ error: "Pagamento não encontrado" });
    }
    if (pagamentoAntes.estado === "confirmado") {
      return res.status(400).json({ error: "Este pagamento já foi confirmado anteriormente." });
    }

    // 1) Confirmar pagamento
    const { data: pagamento, error: errPag } = await supabase
      .from("pagamentos")
      .update({ estado: "confirmado", confirmado_em: new Date().toISOString() })
      .eq("id", id_pagamento)
      .select()
      .single();

    if (errPag || !pagamento) {
      return res.status(404).json({ error: "Pagamento não encontrado", detail: errPag?.message });
    }

    // 1.1) Resolver também o movimento ligado a este pagamento (criado pelo
    // mesmo email automático — ver server/lib/inboundProcessor.js, que grava
    // a marca "[pagamento:<id>]" na descrição por não haver FK entre as duas
    // tabelas). Sem isto, o movimento fica "Por Justificar" para sempre
    // mesmo depois do pagamento estar confirmado.
    // movimentoLigadoId: guardado para se poder ligar id_movimento aos
    // avisos fechados no passo 2.1 abaixo — sem isto, um aviso marcado
    // "Pago" automaticamente nunca ficava rastreável até ao movimento
    // bancário real que o liquidou.
    let movimentoLigadoId = null;
    try {
      const { data: movsLigados } = await supabase
        .from("movimentos")
        .update({
          estado: "Justificado",
          estado_conciliacao: "CONCILIADO",
          is_movimento_cego: false
        })
        .ilike("descricao", `%[pagamento:${id_pagamento}]%`)
        .select("id_movimento");
      movimentoLigadoId = movsLigados?.[0]?.id_movimento || null;
    } catch (errMovLink) {
      console.warn("[confirmar-pagamento] Aviso ao atualizar movimento ligado:", errMovLink?.message || errMovLink);
    }

    // 2) Buscar proprietário e fração separadamente (sem depender de relações
    // embutidas do PostgREST, que exigem FKs registadas na cache do schema).
    // A tabela "proprietarios" tem registos com formatos de id inconsistentes
    // (ex: "prop-<nif>" vs "<nif>" cru) e nem sempre existe uma linha ligada
    // a este pagamento (id_proprietario pode ficar null nalguns fluxos) — por
    // isso o JSON fracoes.proprietario, que é a cópia que a app efetivamente
    // mantém sempre atualizada (ver o mesmo raciocínio em
    // server/lib/inboundProcessor.js/obterContexto), é a fonte principal do
    // nome/email/NIF; a tabela "proprietarios" fica só como resguardo.
    const [{ data: proprietario }, { data: fracao }] = await Promise.all([
      pagamento.id_proprietario
        ? supabase.from("proprietarios").select("nome, email, nif").eq("id_proprietario", pagamento.id_proprietario).maybeSingle()
        : Promise.resolve({ data: null }),
      pagamento.id_fracao
        ? supabase.from("fracoes").select("fracao_nome, id_predio, piso, permilagem, proprietario").eq("id_fracao", pagamento.id_fracao).maybeSingle()
        : Promise.resolve({ data: null })
    ]);

    const { data: predio } = fracao?.id_predio
      ? await supabase.from("predios").select("*").eq("id_predio", fracao.id_predio).maybeSingle()
      : { data: null };

    const { data: contasPredio } = fracao?.id_predio
      ? await supabase.from("contas").select("id_conta, iban, is_principal").eq("id_predio", fracao.id_predio)
      : { data: [] };

    // Rede de segurança: se o movimento ligado a este pagamento nunca tinha
    // ficado com "id_conta" atribuído (ex: a lista de contas do prédio
    // falhou no momento em que o email chegou), preenche-o agora que se tem
    // a certeza da conta certa — sem isto o movimento nunca aparecia em
    // nenhuma análise financeira por conta (Relatórios, Auditoria Interna),
    // só no total geral. Confirmado em produção: 19 movimentos reais assim,
    // 1.054,73€ de receitas "invisíveis" por conta.
    try {
      const contaAlvoBackfill = escolherContaPorTipo(contasPredio, "Quota Ordinária");
      if (contaAlvoBackfill?.id_conta) {
        await supabase
          .from("movimentos")
          .update({ id_conta: contaAlvoBackfill.id_conta })
          .ilike("descricao", `%[pagamento:${id_pagamento}]%`)
          .is("id_conta", null);
      }
    } catch (errContaBackfill) {
      console.warn("[confirmar-pagamento] Aviso ao preencher id_conta em falta:", errContaBackfill?.message || errContaBackfill);
    }

    // "NA" é o valor usado em toda a app para um condómino que recusou
    // fornecer o email (ver GestaoFracoes.tsx) — não é um endereço válido
    // para tentar enviar, conta como "sem email" tal como null/vazio.
    const emailValido = (valor) => {
      const v = (valor || "").trim();
      return v && v.toUpperCase() !== "NA" && /\S+@\S+\.\S+/.test(v) ? v : null;
    };

    const proprietarioFracao = fracao?.proprietario;
    const nomeDestinatario = proprietarioFracao?.nome || proprietario?.nome || pagamento.entidade || "Condómino(a)";
    const emailDestinatario = emailValido(proprietarioFracao?.email) || emailValido(proprietario?.email);
    const nifDestinatario = proprietarioFracao?.nif || proprietario?.nif || "";
    const fracaoNome = fracao?.fracao_nome || pagamento.fracao || "Fração";
    const ano = new Date(pagamento.data_pagamento || pagamento.criado_em || Date.now()).getFullYear();

    // 2.1) Marcar como "Pago" o aviso (nota de cobrança) correspondente a
    // este pagamento, para o Mapa de Pagamentos e os lembretes de mora (ver
    // server/lib/cronService.js) refletirem que já foi liquidado. Escolhe
    // sempre o aviso PENDENTE individual mais antigo cujo valor bate certo
    // com o que foi pago (nunca "o resto de um grupo" — avisos retroativos
    // partilham data de emissão, "data" nunca é o mês real, ver vencimento).
    //
    // Se não existir NENHUM aviso pendente que bata certo (ex: a fração
    // nunca chegou a ter nota emitida para este mês — aconteceu com várias
    // frações de teste), o pagamento ficava confirmado e o recibo enviado,
    // mas nada aparecia no Mapa de Pagamentos nem no histórico de avisos,
    // como se tivesse desaparecido. Cria-se agora, nesse caso, um aviso já
    // "Pago" com o mês do próprio pagamento, para nunca ficar por registar.
    // avisosAutoFechados / valorAdiantamentoSemAviso: preenchidos abaixo
    // quando o pagamento fecha mais do que 1 aviso de uma só vez — usados no
    // passo 2.3/3 para o recibo sair discriminado por mês, tal como já
    // acontecia quando o chamador passava avisos_ids explicitamente.
    let avisosAutoFechados = [];
    let valorAdiantamentoSemAviso = 0;
    try {
      if (pagamento.id_fracao && !(avisosIdsFechados && avisosIdsFechados.length)) {
        const valorPago = Number(pagamento.valor || 0);
        const { data: pendentesAvisos } = await supabase
          .from("avisos")
          .select("*")
          .eq("id_fracao", pagamento.id_fracao)
          .eq("estado", "Pendente");

        const ordenados = [...(pendentesAvisos || [])].sort(
          (a, b) => new Date(a.vencimento || a.data).getTime() - new Date(b.vencimento || b.data).getTime()
        );
        let avisoAlvo = ordenados.find((a) => Math.abs(Number(a.valor || 0) - valorPago) < 0.05);

        // Rede de segurança: quando o valor lido do comprovativo não bate
        // certo com NENHUM aviso pendente (ex: a IA somou por engano uma
        // comissão bancária ao valor da transferência — bug real confirmado:
        // 29.57€ lido como 30.61€), o código antigo criava sempre um aviso
        // NOVO com esse valor errado, duplicando o mês — a fração ficava com
        // 2 avisos de outubro (um pendente com o valor certo, outro "Pago"
        // com o valor errado), e o Mapa de Pagamentos passava a mostrar o
        // valor errado nesse mês mesmo depois de corrigido o movimento em si.
        // Antes de desistir e criar um aviso novo, tenta por isso encontrar o
        // aviso pendente do MESMO MÊS (Quota Ordinária, vencimento no mesmo
        // mês/ano do pagamento) — o valor desse aviso, não o lido do
        // comprovativo, é que é a fonte da verdade sobre quanto a fração
        // deve nesse mês.
        if (!avisoAlvo) {
          const mesPagamento = (pagamento.data_pagamento || new Date().toISOString()).slice(0, 7);
          avisoAlvo = ordenados.find(
            (a) => a.tipo === "Quota Ordinária" && (a.vencimento || a.data || "").slice(0, 7) === mesPagamento
          );
          if (avisoAlvo) {
            console.warn(
              `[confirmar-pagamento] Valor do comprovativo (${valorPago}€) não bate certo com nenhum aviso pendente — associado por mês ao aviso ${avisoAlvo.id_aviso} (valor real: ${avisoAlvo.valor}€). Revisão manual recomendada.`
            );
          }
        }

        // Terceira tentativa — pagamento de uma só vez que cobre VÁRIOS
        // meses em atraso (ex: condómino salda 5, 10, 12 meses juntos numa
        // transferência). Sem isto, nenhum aviso real fechava — o pagamento
        // ficava confirmado mas nenhum mês desaparecia do Mapa de
        // Pagamentos, obrigando sempre a correção manual (confirmado em
        // produção, repetidamente). Soma os avisos de Quota Ordinária
        // pendentes, do mais antigo ao mais recente, enquanto a soma
        // acumulada não ultrapassar o valor pago (margem de 0.05€) — fecha
        // todos os que cabem inteiros; o que sobrar (se houver) fica
        // registado como adiantamento explícito no recibo, nunca absorvido
        // às cegas num mês que ainda nem foi emitido.
        if (!avisoAlvo) {
          const pendentesOrdinarias = ordenados.filter((a) => a.tipo === "Quota Ordinária");
          let acumulado = 0;
          const candidatos = [];
          for (const a of pendentesOrdinarias) {
            const valorAviso = Number(a.valor || 0);
            if (acumulado + valorAviso > valorPago + 0.05) break;
            candidatos.push(a);
            acumulado += valorAviso;
          }
          // Só aceita esta via quando de facto fecha mais do que 1 mês (1 mês
          // só já seria apanhado pelas tentativas acima) — fechar só 1 de
          // vários candidatos seria mais provável ser coincidência do que a
          // intenção real do pagamento.
          if (candidatos.length >= 2) {
            avisosAutoFechados = candidatos;
            valorAdiantamentoSemAviso = Math.round((valorPago - acumulado) * 100) / 100;
            console.warn(
              `[confirmar-pagamento] Pagamento de ${valorPago}€ não bate certo com nenhum aviso isolado — fechados automaticamente ${candidatos.length} avisos pendentes (${acumulado.toFixed(2)}€)${valorAdiantamentoSemAviso > 0.004 ? `, com ${valorAdiantamentoSemAviso.toFixed(2)}€ por aplicar em meses futuros` : ""}.`
            );
          }
        }

        // Se este pagamento já foi dividido em N meses (ver dividir-pagamento-meses.js),
        // já existem avisos "aviso-dividido-<id_pagamento>-*" a representá-lo —
        // criar aqui mais um aviso avulso duplicaria o valor.
        const { data: jaDivididoEm } = await supabase
          .from("avisos")
          .select("id_aviso")
          .ilike("id_aviso", `aviso-dividido-${pagamento.id}-%`)
          .limit(1);

        if (avisoAlvo) {
          await supabase.from("avisos").update({
            estado: "Pago",
            valor_pago: Number(avisoAlvo.valor || 0),
            id_movimento: movimentoLigadoId
          }).eq("id_aviso", avisoAlvo.id_aviso);
        } else if (avisosAutoFechados.length) {
          for (const a of avisosAutoFechados) {
            await supabase.from("avisos").update({
              estado: "Pago",
              valor_pago: Number(a.valor || 0),
              id_movimento: movimentoLigadoId
            }).eq("id_aviso", a.id_aviso);
          }
        } else if (!jaDivididoEm?.length) {
          const dataRef = vencimentoAlvo || pagamento.data_pagamento || new Date().toISOString().split("T")[0];
          const sufixoAdiantamento = vencimentoAlvo ? ` — adiantamento de ${new Date(`${vencimentoAlvo}T00:00:00`).toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}.` : "";
          await supabase.from("avisos").insert({
            id_aviso: `aviso-confirmado-${pagamento.id}`,
            id_predio: fracao?.id_predio || null,
            id_fracao: pagamento.id_fracao,
            tipo: "Quota Ordinária",
            data: dataRef,
            vencimento: dataRef,
            descricao: `Quota Ordinária — pagamento confirmado (${pagamento.entidade || "Transferência Bancária"}).${sufixoAdiantamento}`,
            valor: valorPago,
            valor_fundo_reserva: Math.round(valorPago * 0.10 * 100) / 100,
            estado: "Pago",
            valor_pago: valorPago,
            id_movimento: movimentoLigadoId,
            proprietario_nome: nomeDestinatario,
            proprietario_nif: nifDestinatario
          });
        }
      }
    } catch (errAvisos) {
      console.warn("[confirmar-pagamento] Aviso ao atualizar avisos ligados:", errAvisos?.message || errAvisos);
    }

    // 2.2) Creditar o saldo real da conta bancária — sem isto, confirmar um
    // pagamento nunca refletia a entrada de dinheiro nos KPIs "Conta(s) à
    // Ordem"/"Total Líquido" do Painel de Controlo (ficavam sempre parados
    // no valor de arranque, apesar de haver pagamentos confirmados a mais).
    //
    // Salta este passo quando o chamador já indicou avisos_ids
    // (aprovarPagamentoCondomino, no Assistente de Extração de Extratos) —
    // esse fluxo já credita o saldo da CONTA CERTA diretamente (a conta do
    // separador/extrato ativo) antes de chamar este endpoint; creditar aqui
    // outra vez duplicava o valor E usava sempre a conta "Quota Ordinária"
    // fixa, mesmo quando o pagamento era de Quota Extraordinária numa conta
    // diferente (bug confirmado: inflacionava o saldo a dobrar na conta
    // errada). Continua ativo para o outro fluxo (confirmarPagamentoEEnviarRecibo,
    // comprovativos "Pagamentos por Confirmar"), que nunca credita o saldo
    // antecipadamente.
    if (!(avisosIdsFechados && avisosIdsFechados.length)) {
      try {
        const contaAlvo = escolherContaPorTipo(contasPredio, "Quota Ordinária");
        if (contaAlvo?.id_conta) {
          await ajustarSaldoConta(contaAlvo.id_conta, Number(pagamento.valor || 0));
        }
      } catch (errSaldo) {
        console.warn("[confirmar-pagamento] Aviso ao creditar saldo da conta:", errSaldo?.message || errSaldo);
      }
    }

    // 2.3) Se o chamador indicou exatamente quais avisos este pagamento
    // fecha, busca-os reais — servem para montar o recibo com 1 linha por
    // mês/prestação (ver ponto 3) em vez de adivinhar a rubrica. Sem
    // indicação explícita, usa os avisos que o passo 2.1 já tiver fechado
    // automaticamente (pagamento de vários meses de uma vez).
    let avisosFechadosReais = [];
    if (avisosIdsFechados && avisosIdsFechados.length) {
      const { data: avisosReais } = await supabase
        .from("avisos")
        .select("*")
        .in("id_aviso", avisosIdsFechados)
        .order("vencimento", { ascending: true });
      avisosFechadosReais = avisosReais || [];
    } else if (avisosAutoFechados.length) {
      avisosFechadosReais = avisosAutoFechados;
    }
    // Tipo de quota deste pagamento (Ordinária vs Extraordinária) — decide a
    // conta/IBAN certos no recibo. Sem avisos reais associados, mantém-se
    // sempre "Quota Ordinária" (comportamento anterior, para o fluxo de
    // comprovativos por email que não passa avisos_ids).
    const tipoQuotaPagamento = avisosFechadosReais[0]?.tipo || "Quota Ordinária";

    // 3) Montar e gerar o recibo oficial (mesmo template legal usado no
    // frontend em src/utils/receiptGenerator.ts — compilado para
    // server/lib/receiptGenerator.js no build). Numeração: prefixo do
    // edifício + sequencial de 5 dígitos, ex. "BR2 00195".
    const hash = createHash("sha256").update(`${pagamento.id}-${pagamento.valor}-${pagamento.confirmado_em}`).digest("hex");
    const prefixoEdificio = derivarPrefixoEdificio(predio?.nome);

    const { count: totalConfirmados } = await supabase
      .from("pagamentos")
      .select("id", { count: "exact", head: true })
      .eq("estado", "confirmado");

    const sequencial = String(totalConfirmados || 1).padStart(5, "0");
    const idRecibo = `${prefixoEdificio} ${sequencial}`;

    const recibo = {
      id_recibo: idRecibo,
      numero_sequencial: totalConfirmados || 1,
      ano,
      id_predio: fracao?.id_predio || "",
      id_fracao: pagamento.id_fracao || "",
      nome_condomino: nomeDestinatario,
      nif_condomino: nifDestinatario,
      fracao_nome: fracaoNome,
      permilagem: fracao?.permilagem || 0,
      data_emissao: new Date().toISOString().split("T")[0],
      data_pagamento: pagamento.data_pagamento || new Date().toISOString().split("T")[0],
      // "entidade" é o banco que emitiu o comprovativo (ver
      // multimodalService.js), nunca o nome do condómino — mostra-se aqui,
      // junto do método, nunca em nome_condomino.
      metodo_pagamento: pagamento.entidade ? `Transferência Bancária — ${pagamento.entidade}` : "Transferência Bancária",
      valor_total: Number(pagamento.valor || 0),
      // Se há avisos reais associados (ver 2.3), 1 linha por mês/prestação
      // realmente fechado por este pagamento — cobre o pedido explícito de
      // "1 só recibo pelo total pago, discriminado por mês", em vez de
      // vários recibos ou de uma divisão inventada. Sem avisos associados
      // (fluxo antigo de comprovativo por email), mantém a divisão legal
      // mínima de 10% para o Fundo Comum de Reserva (DL 268/94, Art. 4.º).
      rubricas: avisosFechadosReais.length
        ? [
            ...avisosFechadosReais.flatMap((a) => {
              const valorTotalAviso = Number(a.valor || 0);
              const valorFcr = Number(a.valor_fundo_reserva || 0);
              // Avisos de Quota Ordinária guardam a Quota + o FCR juntos num
              // só registo (valor_fundo_reserva é só a parcela dentro de
              // "valor") — sem isto, o recibo saía com 1 linha combinada
              // ("Ordinária + Fundo de Reserva"), diferente da nota de
              // cobrança do mesmo mês, que já sai sempre discriminada em 2
              // linhas. Discrimina sempre aqui também, para nunca haver
              // divergência entre os dois documentos.
              if (valorFcr > 0 && valorFcr < valorTotalAviso) {
                const valorOrdinaria = Math.round((valorTotalAviso - valorFcr) * 100) / 100;
                const periodo = String(a.descricao || "").match(/-\s*([a-zàâãéêíóôõúç]+\s*\/\s*\d{4})\s*$/i)?.[1]?.trim();
                const sufixoPeriodo = periodo ? ` - ${periodo}` : "";
                return [
                  { descricao: `Quota de Condomínio Ordinária${sufixoPeriodo}`, valor: valorOrdinaria, tipo: a.tipo },
                  { descricao: `Fundo Comum de Reserva (FCR)${sufixoPeriodo}`, valor: valorFcr, tipo: "Fundo Comum de Reserva" }
                ];
              }
              return [{ descricao: a.descricao || `${a.tipo} — vencimento ${a.vencimento || a.data}`, valor: valorTotalAviso, tipo: a.tipo }];
            }),
            // Sobra do pagamento que não corresponde a nenhum aviso ainda
            // emitido (ex: meses futuros cuja nota de cobrança só sai no dia
            // 25 do mês anterior) — mostrado sempre como linha própria e
            // explícita, nunca absorvido silenciosamente num mês ao calhas.
            ...(valorAdiantamentoSemAviso > 0.004
              ? [{ descricao: "Adiantamento para aplicar em meses futuros (ainda não emitidos)", valor: valorAdiantamentoSemAviso, tipo: "Quota Ordinária" }]
              : [])
          ]
        : (() => {
            const total = Number(pagamento.valor || 0);
            const valorReserva = Math.round(total * 0.10 * 100) / 100;
            const valorQuota = Math.round((total - valorReserva) * 100) / 100;
            return [
              { descricao: pagamento.descricao || "Quota de Condomínio", valor: valorQuota, tipo: "Quota Ordinária" },
              { descricao: "Fundo Comum de Reserva (10% legal)", valor: valorReserva, tipo: "Fundo Comum de Reserva" }
            ];
          })(),
      iban_predio: escolherIbanContaPorTipo(contasPredio, tipoQuotaPagamento) || predio?.iban || "",
      codigo_verificacao_hash: hash,
      emitido_por: "José Carlos Guerra (Administrador do Condomínio)",
      // A assinatura é guardada em predios.patrimonio.assinatura_admin_base64
      // (ver src/components/GestaoFracoes.tsx) — se não existir, o gerador
      // do recibo já trata graciosamente (imprime só o nome do administrador).
      adminSignatureBase64: predio?.patrimonio?.assinatura_admin_base64 || "sem-assinatura-digital"
    };

    const predioParaRecibo = predio || { id_predio: recibo.id_predio, nome: "Condomínio", morada_linha1: "", num_porta: "", codigo_postal: "", localidade: "", nif: "" };

    const doc = generateOfficialReceiptPDF(recibo, predioParaRecibo, fracao || {});
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const nomeFicheiro = nomeFicheiroRecibo(recibo);

    const caminho = await guardarNoArquivo({
      pdfBuffer,
      ano,
      tema: "Financeiro",
      tipo: "Recibo",
      predio: fracao?.id_predio || "geral",
      fracao: pagamento.id_fracao || "geral",
      fluxo: "recibo_pos_confirmacao",
      nomeFicheiro
    });

    await registarDocumento({
      caminho,
      ano,
      tema: "Financeiro",
      tipo: "Recibo",
      predio: fracao?.id_predio || null,
      fracao: pagamento.id_fracao || null,
      fluxo: "recibo_pos_confirmacao",
      origem: "confirmacao_pagamento",
      nomeFicheiro,
      categoria: "Pasta Paga. Quotas",
      visibilidade: "Público"
    });

    if (emailDestinatario) {
      const modeloRecibo = await obterModeloEmail(fracao?.id_predio, "recibo_pagamento");
      const valoresRecibo = {
        nome: nomeDestinatario,
        fracao: fracaoNome,
        valor: `${recibo.valor_total.toFixed(2)} €`,
        data: new Date(recibo.data_pagamento).toLocaleDateString("pt-PT"),
        metodo: recibo.metodo_pagamento
      };

      await enviarEmailPDF({
        to: emailDestinatario,
        nomeDestinatario,
        assunto: modeloRecibo
          ? interpolarModeloEmail(modeloRecibo.subject, valoresRecibo)
          : `Recibo de Pagamento — ${fracaoNome}`,
        mensagem: modeloRecibo
          ? interpolarModeloEmail(modeloRecibo.body, valoresRecibo).replace(/\n/g, "<br>")
          : `Segue em anexo o recibo de pagamento referente à fração <strong>${fracaoNome}</strong>, no valor de <strong>${recibo.valor_total.toFixed(2)} €</strong>.`,
        pdfBuffer,
        nome: nomeFicheiro
      });
    }

    return res.status(200).json({
      status: "ok",
      pagamento_confirmado: pagamento.id,
      recibo_caminho: caminho,
      email_enviado: Boolean(emailDestinatario)
    });
  } catch (e) {
    console.error("Erro em confirmar-pagamento:", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
