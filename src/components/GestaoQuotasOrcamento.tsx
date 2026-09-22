import React, { useEffect, useMemo, useState } from "react";
import {
  Calculator,
  Landmark,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Download,
  CreditCard,
  Layers,
  Save,
  FileSignature
} from "lucide-react";
import { Predio, Fracao, Aviso, LoggedUser, Documento, RevisaoOrcamento, Conta, Movimento, Reuniao } from "../types";
import type { ObraExtraordinaria } from "./GestaoManutencaoIntervencoes";
import { jsPDF } from "jspdf";
import { formatDatePT, formatQuotaReceiptNumber, parseValorMonetario, escolherIbanContaPorTipo, gerarReferenciaBR23E, exportarBalanceteMapaAnualXLS, exportToXLS } from "../utils";
import { downloadOfficialReceiptPDF } from "../utils/receiptGenerator";
import { MoneyInput } from "./MoneyInput";
import { AccordionSection } from "./AccordionSection";
import { ColumnFilterDropdown } from "./ColumnFilterDropdown";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  dbUpdate,
  dbDelete,
  saveAvisosToSupabase,
  saveContaToSupabase,
  saveMovimentoToSupabase,
  registarLogAuditoria,
  fetchRevisoesOrcamentoFromSupabase,
  saveRevisaoOrcamentoToSupabase,
  deleteRevisaoOrcamentoFromSupabase,
  orcamentoVigente,
  saveConfiguracaoQuotasToSupabase,
  fetchObrasExtraFromSupabase
} from "../lib/supabaseService";

interface GestaoQuotasOrcamentoProps {
  predio: Predio;
  fracoes: Fracao[];
  avisos: Aviso[];
  setAvisos: React.Dispatch<React.SetStateAction<Aviso[]>>;
  contas: Conta[];
  setContas: React.Dispatch<React.SetStateAction<Conta[]>>;
  movements: Movimento[];
  setMovements: React.Dispatch<React.SetStateAction<Movimento[]>>;
  documentos?: Documento[];
  setDocumentos?: React.Dispatch<React.SetStateAction<Documento[]>>;
  loggedUser: LoggedUser;
  reunioes?: Reuniao[];
}

// Fusão de "Cálculo e Emissão de Quotas" (CalculoQuotas.tsx) + "Emissão de
// Avisos e Orçamentos" (GestaoEmissao.tsx) num único ecrã por acordeão — os
// dois ficheiros originais ficam intactos no repositório (nada foi apagado),
// só deixam de ser usados no menu, que passa a apontar só para aqui.
export function GestaoQuotasOrcamento({
  predio,
  fracoes,
  avisos,
  setAvisos,
  contas,
  setContas,
  movements,
  setMovements,
  documentos,
  setDocumentos,
  loggedUser,
  reunioes = []
}: GestaoQuotasOrcamentoProps) {
  const predioFracoes = useMemo(() => fracoes.filter((f) => f.id_predio === predio.id_predio), [fracoes, predio.id_predio]);
  const predioContas = useMemo(() => contas.filter((c) => c.id_predio === predio.id_predio), [contas, predio.id_predio]);
  const predioAvisos = useMemo(() => avisos.filter((a) => a.id_predio === predio.id_predio), [avisos, predio.id_predio]);

  const totalPermilagem = useMemo(
    () => predioFracoes.reduce((acc, curr) => acc + (Number(curr.permilagem) || 0), 0),
    [predioFracoes]
  );

  // ===========================================================================
  // BLOCO 1 — Orçamento Anual & Adendas (de GestaoEmissao.tsx)
  // ===========================================================================
  const atasEmitidas = reunioes.filter(r => r.id_predio === predio.id_predio && (r.numero_ata || r.ata)).sort((a, b) => b.data.localeCompare(a.data));
  const [orcamentoAnual, setOrcamentoAnual] = useState(() => {
    const guardado = (predio.patrimonio as any)?.orcamento_anual;
    return guardado ? String(guardado) : "";
  });
  const [mes, setMes] = useState("Janeiro");
  const [anoEmissao, setAnoEmissao] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    const guardado = (predio.patrimonio as any)?.orcamento_anual;
    setOrcamentoAnual(guardado ? String(guardado) : "");
  }, [predio.id_predio]);

  const persistirOrcamentoNoSupabase = async (valor: number) => {
    if (!isSupabaseConfigured) return;
    try {
      await dbUpdate("predios", { patrimonio: { ...(predio.patrimonio || {}), orcamento_anual: valor } }, [["id_predio", "eq", predio.id_predio]]);
    } catch (err) {
      console.warn("[Supabase] Erro ao guardar orçamento anual:", err);
    }
  };

  const [revisoesOrcamento, setRevisoesOrcamento] = useState<RevisaoOrcamento[]>([]);
  const [novaRevisaoValor, setNovaRevisaoValor] = useState("");
  const [novaRevisaoData, setNovaRevisaoData] = useState(() => new Date().toISOString().split("T")[0]);
  const [novaRevisaoAssembleia, setNovaRevisaoAssembleia] = useState(false);
  const [novaRevisaoMotivo, setNovaRevisaoMotivo] = useState("");
  const [novaRevisaoAtaId, setNovaRevisaoAtaId] = useState("");

  useEffect(() => {
    fetchRevisoesOrcamentoFromSupabase(predio.id_predio).then(r => setRevisoesOrcamento(r || []));
  }, [predio.id_predio]);

  const revisaoEmVigor = orcamentoVigente(revisoesOrcamento);

  const handleAddRevisaoOrcamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedUser.role !== "ADMIN" && loggedUser.role !== "EMPRESA_GESTORA") {
      return alert("Apenas administradores podem registar revisões ao orçamento!");
    }
    if (!novaRevisaoValor || !novaRevisaoData) return alert("Preencha o novo valor e a data de vigência.");
    const novoValorRevisao = parseValorMonetario(novaRevisaoValor);
    if (novoValorRevisao <= 0) return alert("Indique um valor válido para a revisão do orçamento.");

    const ataSelecionada = atasEmitidas.find(r => r.id_reuniao === novaRevisaoAtaId);
    const motivoFinal = ataSelecionada
      ? `Ata ${ataSelecionada.numero_ata || "s/nº"} — ${ataSelecionada.tema} (${formatDatePT(ataSelecionada.data)})${novaRevisaoMotivo ? ` — ${novaRevisaoMotivo}` : ""}`
      : (novaRevisaoMotivo || undefined);

    const nova: RevisaoOrcamento = {
      id_revisao: "rev-" + Date.now(),
      id_predio: predio.id_predio,
      valor: novoValorRevisao,
      data_vigencia: novaRevisaoData,
      aprovado_em_assembleia: novaRevisaoAssembleia || Boolean(ataSelecionada),
      motivo: motivoFinal,
      id_reuniao_ata: ataSelecionada?.id_reuniao || undefined
    };
    const ok = await saveRevisaoOrcamentoToSupabase(nova);
    if (!ok) return alert("❌ Não foi possível gravar a revisão no Supabase. Tente novamente.");

    const novaLista = [nova, ...revisoesOrcamento];
    setRevisoesOrcamento(novaLista);
    registarLogAuditoria("Financeira", "Registou uma revisão ao orçamento anual", predio.id_predio, loggedUser, `Novo valor: ${nova.valor.toFixed(2)} € a partir de ${formatDatePT(nova.data_vigencia)}`);

    const maisRecenteVigente = orcamentoVigente(novaLista);
    if (maisRecenteVigente && maisRecenteVigente.id_revisao === nova.id_revisao) {
      setOrcamentoAnual(String(nova.valor));
      await persistirOrcamentoNoSupabase(nova.valor);
    }

    setNovaRevisaoValor("");
    setNovaRevisaoMotivo("");
    setNovaRevisaoAssembleia(false);
    setNovaRevisaoAtaId("");
    alert(
      maisRecenteVigente?.id_revisao === nova.id_revisao
        ? "✅ Revisão registada e já aplicada — o orçamento anual em vigor foi atualizado."
        : "✅ Revisão registada — entra em vigor automaticamente em " + formatDatePT(nova.data_vigencia) + "."
    );
  };

  const handleRemoverRevisaoOrcamento = async (revisao: RevisaoOrcamento) => {
    if (!window.confirm(`Eliminar a revisão de ${revisao.valor.toFixed(2)} € (vigência ${formatDatePT(revisao.data_vigencia)})?`)) return;
    const ok = await deleteRevisaoOrcamentoFromSupabase(revisao.id_revisao);
    if (!ok) return alert("❌ Não foi possível eliminar a revisão no Supabase.");
    setRevisoesOrcamento(prev => prev.filter(r => r.id_revisao !== revisao.id_revisao));
  };

  const MESES_INDEX: Record<string, number> = {
    "Janeiro": 0, "Fevereiro": 1, "Março": 2, "Abril": 3, "Maio": 4, "Junho": 5,
    "Julho": 6, "Agosto": 7, "Setembro": 8, "Outubro": 9, "Novembro": 10, "Dezembro": 11
  };

  // Coeficiente real das lojas com acesso direto pelo exterior — ver nota
  // histórica original em GestaoEmissao.tsx (reverse-engineered a partir do
  // quadro de quotas real da gestora anterior, confirmado pelo administrador).
  const COEF_LOJA_EXTERIOR = 0.4528;
  const isLojaExterior = (f: Fracao) => f.tipologia === "Loja Comercial" && (f.tipo_access || "").includes("Exterior");

  const gerarOrcamentoMensal = (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedUser.role !== 'ADMIN' && loggedUser.role !== 'EMPRESA_GESTORA') {
      return alert("Apenas administradores podem emitir quotas!");
    }
    if (!orcamentoAnual) return alert("Preencha o Orçamento Anual!");
    const orcamentoAnualNum = parseValorMonetario(orcamentoAnual);
    if (orcamentoAnualNum <= 0) return alert("Indique um valor válido para o Orçamento Anual!");
    const anoNum = parseInt(anoEmissao, 10);
    if (!anoNum || anoNum < 2000) return alert("Indique um ano de emissão válido!");

    persistirOrcamentoNoSupabase(orcamentoAnualNum);

    const d = new Date();
    const dataDoc = d.toISOString().split('T')[0];
    const mesIdx = MESES_INDEX[mes] ?? 0;
    const vencimento = `${anoNum}-${String(mesIdx + 1).padStart(2, "0")}-08`;
    const orcamentoMensal = orcamentoAnualNum / 12;

    let permilagemLoja = 0;
    predioFracoes.forEach(f => {
      if (isLojaExterior(f)) permilagemLoja += f.permilagem;
    });
    const permilagemNormal = 1000 - permilagemLoja;
    const denominador = permilagemNormal + permilagemLoja * COEF_LOJA_EXTERIOR;
    const rateNormal = denominador > 0 ? orcamentoMensal / denominador : 0;
    const rateLoja = rateNormal * COEF_LOJA_EXTERIOR;

    const novosAvisos: Aviso[] = [];
    predioFracoes.forEach(f => {
      const orcamentoMensalProporcional = f.permilagem * (isLojaExterior(f) ? rateLoja : rateNormal);

      const valorOrdinario = Math.round((orcamentoMensalProporcional * 0.9) * 100) / 100;
      const valorFCR = Math.round((orcamentoMensalProporcional * 0.1) * 100) / 100;
      const valorTotal = Math.round((valorOrdinario + valorFCR) * 100) / 100;

      const idAviso = "av-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000);

      novosAvisos.push({
        id_aviso: idAviso,
        id_predio: predio.id_predio,
        id_fracao: f.id_fracao,
        tipo: "Quota Ordinária",
        data: dataDoc,
        vencimento,
        descricao: `Quota de Condomínio (Ordinária + Fundo de Reserva) - ${mes} / ${anoNum}`,
        valor: valorTotal,
        valor_fundo_reserva: valorFCR,
        estado: "Pendente",
        proprietario_nome: f.proprietario?.nome,
        proprietario_nif: f.proprietario?.nif
      });
    });

    setAvisos([...avisos, ...novosAvisos]);
    saveAvisosToSupabase(novosAvisos).catch(console.error);
    registarLogAuditoria(
      "Financeira",
      `Emitiu ${novosAvisos.length} notas de cobrança (Quota + FCR juntos) - ${mes}/${anoNum}`,
      predio.id_predio,
      loggedUser
    );

    if (setDocumentos) {
      const novosDocs: Documento[] = novosAvisos.map(a => {
        const frac = fracoes.find(f => f.id_fracao === a.id_fracao);
        return {
          id_doc: "doc-nc-" + a.id_aviso,
          id_predio: predio.id_predio,
          nome: `Nota_Cobranca_${a.id_aviso.toUpperCase()}_Fracao_${frac?.fracao_nome || "A"}.pdf`,
          tipo: "Nota de Cobrança",
          data_upload: dataDoc,
          tamanho: "280 KB",
          categoria: "Pasta Paga. Quotas",
          sub_pasta: "Notas de cobrança",
          descricao: `Nota de cobrança para ${a.descricao} - Fração ${frac?.fracao_nome}`,
          visibilidade: "Público",
          autor: loggedUser.nome || "Administração",
          tema: "Pasta Paga. Quotas",
          ano: dataDoc.substring(0, 4),
          tipo_arquivo: "documento",
          relevancia_perfis: ["ADMIN", "EMPRESA_GESTORA", "USER", "CONTABILISTA"]
        };
      });
      setDocumentos(prev => [...prev, ...novosDocs]);
    }

    alert("Foram gerados e emitidos com sucesso os avisos de cobrança para todas as frações! Arquivados na Pasta Paga. Quotas.");
  };

  // ===========================================================================
  // BLOCO 2 — Cálculo de Quotas por Fração (de CalculoQuotas.tsx)
  // ===========================================================================
  const orcamentoRegular = String(Math.round(((Number((predio.patrimonio as any)?.orcamento_anual) || 0) / 12) * 100) / 100);
  const [dataLimiteRegular, setDataLimiteRegular] = useState<string>(() => {
    const d = new Date();
    d.setDate(8);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  });
  const [contaOrdinariaId, setContaOrdinariaId] = useState<string>(() => {
    const ord = predioContas.find((c) => c.tipo === "Ordem" || c.tipo === "DO" || c.is_principal);
    return ord ? ord.id_conta : predioContas[0]?.id_conta || "";
  });

  const [orcamentoExtra, setOrcamentoExtra] = useState<string>("");
  const [numPrestacoesExtra, setNumPrestacoesExtra] = useState<number>(1);
  // Data de início do pagamento das prestações da quota extraordinária —
  // antes não existia nenhuma, só uma "data limite" solta, e o sistema só
  // chegava a criar UM aviso rotulado "(1/N)" mesmo quando N > 1 (as
  // prestações 2..N nunca eram geradas). A data final deixa de ser
  // escolhida à parte — é sempre a data de início + N meses, calculada
  // automaticamente (ver dataLimiteExtraCalculada mais abaixo).
  const [dataInicioExtra, setDataInicioExtra] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [descricaoExtra, setDescricaoExtra] = useState<string>("");

  const [obrasExtra, setObrasExtra] = useState<ObraExtraordinaria[]>([]);
  const [obraSelecionadaId, setObraSelecionadaId] = useState<string>("");
  useEffect(() => {
    fetchObrasExtraFromSupabase(predio.id_predio).then((dados) => setObrasExtra(dados || []));
  }, [predio.id_predio]);
  const obrasAdjudicadasParaQuota = obrasExtra.filter((o) => o.necessitaCotaExtra && !!o.id_divida);
  const obraSelecionada = obrasAdjudicadasParaQuota.find((o) => o.id === obraSelecionadaId) || null;

  const handleSelecionarObra = (id: string) => {
    setObraSelecionadaId(id);
    if (!id) return;
    const obra = obrasAdjudicadasParaQuota.find((o) => o.id === id);
    if (!obra) return;
    setDescricaoExtra(`${obra.descricao} — ${obra.fornecedorNome}`);
    setOrcamentoExtra(String(obra.custoTotal));
    if (obra.mesesFracionamento && obra.mesesFracionamento > 0) {
      setNumPrestacoesExtra(obra.mesesFracionamento);
    }
  };
  const [contaExtraId, setContaExtraId] = useState<string>(() => {
    const fcr = predioContas.find(
      (c) => c.tipo === "Poupanca" || c.tipo === "Fundo de Reserva" || c.descricao?.toLowerCase().includes("reserva")
    );
    return fcr ? fcr.id_conta : predioContas[0]?.id_conta || "";
  });

  const [sucessoEmissao, setSucessoEmissao] = useState<string | null>(null);

  const contaOrdinariaSel = useMemo(
    () => predioContas.find((c) => c.id_conta === contaOrdinariaId) || predioContas[0],
    [predioContas, contaOrdinariaId]
  );

  const contaExtraSel = useMemo(
    () => predioContas.find((c) => c.id_conta === contaExtraId) || predioContas[1] || predioContas[0],
    [predioContas, contaExtraId]
  );

  const extVal = parseValorMonetario(orcamentoExtra) || 0;
  const extraPorMesTotal = extVal / (numPrestacoesExtra || 1);
  // Data limite = data de início + (N prestações - 1) meses, ou seja, o mês
  // de vencimento da ÚLTIMA prestação. Deixou de ser escolhida à parte.
  const dataLimiteExtraCalculada = useMemo(() => {
    const inicio = new Date(dataInicioExtra);
    if (isNaN(inicio.getTime())) return "";
    const fim = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + Math.max(0, (numPrestacoesExtra || 1) - 1), inicio.getUTCDate()));
    return fim.toISOString().split("T")[0];
  }, [dataInicioExtra, numPrestacoesExtra]);

  const { rateNormalOrdinaria, rateLojaOrdinaria } = useMemo(() => {
    let permilagemLoja = 0;
    predioFracoes.forEach((f) => { if (isLojaExterior(f)) permilagemLoja += f.permilagem; });
    const permilagemNormal = 1000 - permilagemLoja;
    const denominador = permilagemNormal + permilagemLoja * COEF_LOJA_EXTERIOR;
    const rN = denominador > 0 ? (Number(orcamentoRegular) || 0) / denominador : 0;
    return { rateNormalOrdinaria: rN, rateLojaOrdinaria: rN * COEF_LOJA_EXTERIOR };
  }, [predioFracoes, orcamentoRegular]);

  const calcularQuotaOrdinaria = (f: Fracao) => f.permilagem * (isLojaExterior(f) ? rateLojaOrdinaria : rateNormalOrdinaria);

  const handleEmitirQuotasEmLote = () => {
    if (totalPermilagem !== 1000) {
      alert(
        "Atenção: A soma das permilagens é de " +
          totalPermilagem +
          "‰ (deve somar 1000‰ para conformidade com o Código Civil). Pode emitir com caráter provisório ou retificar nas Frações."
      );
    }

    if (!setAvisos) {
      alert("Sistema de avisos não disponível de momento.");
      return;
    }

    if (extVal <= 0) {
      alert("Por favor defina um orçamento extraordinário superior a 0€!");
      return;
    }

    const d = new Date();
    const dataEmissao = d.toISOString().split("T")[0];
    const inicio = new Date(dataInicioExtra);
    const novosAvisos: Aviso[] = [];
    const numPrestacoes = Math.max(1, numPrestacoesExtra || 1);

    // Antes, era criado sempre UM único aviso por fração rotulado "(1/N)",
    // mesmo com N prestações configuradas — as prestações 2..N nunca eram
    // lançadas, e por isso nunca cobradas. Gera agora mesmo as N
    // prestações, uma por mês a partir da data de início.
    predioFracoes.forEach((f) => {
      if (extVal <= 0) return;
      const valorExtraMensal = Math.round((extraPorMesTotal * (f.permilagem / 1000)) * 100) / 100;
      for (let i = 0; i < numPrestacoes; i++) {
        const vencimentoPrestacao = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + i, inicio.getUTCDate()))
          .toISOString().split("T")[0];
        novosAvisos.push({
          id_aviso: `av-ext-${Date.now()}-${f.id_fracao}-${i}`,
          id_predio: predio.id_predio,
          id_fracao: f.id_fracao,
          tipo: "Quota Extraordinária",
          data: dataEmissao,
          vencimento: vencimentoPrestacao,
          descricao: `Quota Extraordinária (${i + 1}/${numPrestacoes}): ${descricaoExtra} (IBAN: ${contaExtraSel?.iban || "FCR"})`,
          valor: valorExtraMensal,
          estado: "Pendente",
          id_obra: obraSelecionadaId || undefined,
          proprietario_nome: f.proprietario?.nome,
          proprietario_nif: f.proprietario?.nif,
        });
      }
    });

    setAvisos((prev) => [...novosAvisos, ...prev]);

    saveConfiguracaoQuotasToSupabase({
      id_predio: predio.id_predio,
      ano_exercicio: new Date().getFullYear(),
      orcamento_regular: Number(orcamentoRegular) || 0,
      data_limite_regular: dataLimiteRegular,
      id_conta_ordinaria: contaOrdinariaId,
      orcamento_extra: extVal,
      num_prestacoes_extra: numPrestacoesExtra,
      descricao_extra: descricaoExtra,
      data_inicio_extra: dataInicioExtra,
      data_limite_extra: dataLimiteExtraCalculada,
      id_conta_extraordinaria: contaExtraId
    }).catch(console.error);

    saveAvisosToSupabase(novosAvisos).catch(console.error);

    registarLogAuditoria(
      "Financeira",
      `Emitiu ${novosAvisos.length} avisos de quota extraordinária em lote`,
      predio.id_predio,
      loggedUser,
      `Extra: ${extVal}€`
    );

    if (extVal > 0) {
      const destinatarios = predioFracoes
        .filter(f => f.proprietario?.email)
        .map(f => ({ email: f.proprietario.email, nome: f.proprietario.nome }));
      if (destinatarios.length > 0) {
        fetch("/api/email?acao=broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destinatarios,
            assunto: `Aviso de Quota Extraordinária — ${descricaoExtra || predio.nome}`,
            mensagem: `Foi emitida uma quota extraordinária: <strong>${descricaoExtra}</strong>.<br><br>A liquidar em ${numPrestacoesExtra} prestação(ões) mensal(is), de ${new Date(dataInicioExtra).toLocaleDateString("pt-PT")} a ${new Date(dataLimiteExtraCalculada).toLocaleDateString("pt-PT")}.<br><br>Consulte o valor correspondente à sua fração na plataforma.`
          })
        }).catch(console.error);
      }
    }

    setSucessoEmissao(
      `Emitidos com sucesso ${novosAvisos.length} avisos e guardada configuração no Supabase interligada às contas (${contaOrdinariaSel?.banco || "Conta Principal"} / ${contaExtraSel?.banco || "Conta FCR"}).`
    );
    setTimeout(() => setSucessoEmissao(null), 7000);
  };

  const handleExportarPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 28, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text("MAPA DE CÁLCULO E REPARTIÇÃO DE QUOTAS", 14, 13);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(203, 213, 225);
      doc.text(
        `${predio.nome.toUpperCase()} • NIF: ${predio.nif || "N/A"} • ${new Date().toLocaleDateString("pt-PT")}`,
        14,
        21
      );

      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Parâmetros Orçamentais & Contas Bancárias de Crédito", 14, 38);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.text(`• Orçamento Ordinário Mensal: ${Number(orcamentoRegular).toFixed(2)} €`, 14, 45);
      doc.text(`• Conta de Crédito (Ordinárias): ${contaOrdinariaSel?.banco || "Geral"} - IBAN: ${contaOrdinariaSel?.iban || "N/A"}`, 14, 50);
      doc.text(`• Data Limite Pagamento Ordinárias: ${dataLimiteRegular}`, 14, 55);

      doc.text(`• Orçamento Extraordinário: ${parseValorMonetario(orcamentoExtra).toFixed(2)} € (${numPrestacoesExtra} prestações de ${extraPorMesTotal.toFixed(2)} €/mês)`, 14, 62);
      doc.text(`• Finalidade: ${descricaoExtra}`, 14, 67);
      doc.text(`• Conta de Crédito (Extraordinárias): ${contaExtraSel?.banco || "FCR"} - IBAN: ${contaExtraSel?.iban || "N/A"}`, 14, 72);

      doc.setDrawColor(226, 232, 240);
      doc.line(14, 77, pageWidth - 14, 77);

      let y = 85;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, pageWidth - 28, 8, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text("FRAÇÃO", 16, y + 5.5);
      doc.text("CONDÓMINO", 45, y + 5.5);
      doc.text("PERM.", 95, y + 5.5);
      doc.text("Q. ORDINÁRIA", 115, y + 5.5);
      doc.text("Q. EXTRAORD.", 145, y + 5.5);
      doc.text("TOTAL / MÊS", 175, y + 5.5);

      y += 10;
      doc.setFont("helvetica", "normal");

      predioFracoes.forEach((f) => {
        const regShare = calcularQuotaOrdinaria(f);
        const extShare = extraPorMesTotal * (f.permilagem / 1000);
        const totalShare = regShare + extShare;

        doc.text(`Fração ${f.fracao_nome}`, 16, y);
        doc.text((f.proprietario?.nome || "Vago").substring(0, 25), 45, y);
        doc.text(`${f.permilagem}‰`, 95, y);
        doc.text(`${regShare.toFixed(2)} €`, 115, y);
        doc.text(`${extShare.toFixed(2)} €`, 145, y);
        doc.setFont("helvetica", "bold");
        doc.text(`${totalShare.toFixed(2)} €`, 175, y);
        doc.setFont("helvetica", "normal");

        y += 7;
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      });

      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Emitido pela Administração do Condomínio ${predio.nome} • Software de Gestão Certificado`,
        14,
        285
      );

      doc.save(`Mapa_Calculo_Quotas_${predio.nome.replace(/\s+/g, "_")}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Erro ao exportar PDF do Mapa de Quotas.");
    }
  };

  // Filtro estilo Excel da Discriminação por Fração — conjunto vazio até à
  // primeira sincronização representa "tudo selecionado" (ver useEffect).
  const fracaoNomesUnicos = useMemo(() => Array.from(new Set(predioFracoes.map(f => f.fracao_nome))), [predioFracoes]);
  const condominoNomesUnicos = useMemo(() => Array.from(new Set(predioFracoes.map(f => f.proprietario?.nome || "Sem Proprietário"))), [predioFracoes]);
  const [filtroFracoesDiscrim, setFiltroFracoesDiscrim] = useState<Set<string>>(new Set());
  const [filtroCondominosDiscrim, setFiltroCondominosDiscrim] = useState<Set<string>>(new Set());

  useEffect(() => {
    setFiltroFracoesDiscrim(prev => (prev.size === 0 ? new Set(fracaoNomesUnicos) : prev));
  }, [fracaoNomesUnicos.join("|")]);
  useEffect(() => {
    setFiltroCondominosDiscrim(prev => (prev.size === 0 ? new Set(condominoNomesUnicos) : prev));
  }, [condominoNomesUnicos.join("|")]);

  const predioFracoesFiltradas = predioFracoes.filter(
    f => filtroFracoesDiscrim.has(f.fracao_nome) && filtroCondominosDiscrim.has(f.proprietario?.nome || "Sem Proprietário")
  );

  // ===========================================================================
  // BLOCO 3 — Avisos de Cobrança Emitidos (de GestaoEmissao.tsx)
  // ===========================================================================
  const [selectedAviso, setSelectedAviso] = useState<Aviso | null>(null);
  const [docType, setDocType] = useState<"RECIBO" | "NOTA_COBRANCA">("NOTA_COBRANCA");

  const [customIban, setCustomIban] = useState("");
  const [customDataLimite, setCustomDataLimite] = useState("");
  const [customDataPagamento, setCustomDataPagamento] = useState("");
  const [customQuotaMensal, setCustomQuotaMensal] = useState<number>(0);
  const [customQuotaExtra, setCustomQuotaExtra] = useState<number>(0);
  const [customDescritivo, setCustomDescritivo] = useState("");
  const [customCondomino, setCustomCondomino] = useState("");
  const [customNrecibo, setCustomNrecibo] = useState("");
  const [pagamentoContaId, setPagamentoContaId] = useState("");
  const [aRegistarPagamento, setARegistarPagamento] = useState(false);
  const [pagamentoValorInput, setPagamentoValorInput] = useState("");

  const [editingAviso, setEditingAviso] = useState<Aviso | null>(null);
  const [editValorTotal, setEditValorTotal] = useState("");
  const [editValorFCR, setEditValorFCR] = useState("");
  const [editVencimento, setEditVencimento] = useState("");
  const [editDescricao, setEditDescricao] = useState("");

  const abrirDocumento = (aviso: Aviso, tipoInicial: "RECIBO" | "NOTA_COBRANCA") => {
    const frac = fracoes.find(f => f.id_fracao === aviso.id_fracao);

    const hash = aviso.id_aviso.toUpperCase();
    const nRec = formatQuotaReceiptNumber(hash.replace("AV-", ""));

    setSelectedAviso(aviso);
    setDocType(tipoInicial);
    setCustomIban(predio.iban || "PT50 0033 0000 12345678901 23");
    setCustomDataLimite(aviso.vencimento);
    setCustomDataPagamento(aviso.data);

    if (aviso.tipo.includes("Ordinária")) {
      setCustomQuotaMensal(aviso.valor);
      setCustomQuotaExtra(0);
    } else if (aviso.tipo.includes("Extraordinária") || aviso.tipo.includes("Extra")) {
      setCustomQuotaMensal(0);
      setCustomQuotaExtra(aviso.valor);
    } else {
      setCustomQuotaMensal(aviso.valor);
      setCustomQuotaExtra(0);
    }

    setCustomDescritivo(aviso.descricao);
    setCustomCondomino(frac?.proprietario?.nome || "Condómino Registado");
    setCustomNrecibo(nRec);
  };

  const abrirEdicaoAviso = (aviso: Aviso) => {
    setEditingAviso(aviso);
    setEditValorTotal(String(aviso.valor));
    setEditValorFCR(aviso.valor_fundo_reserva !== undefined ? String(aviso.valor_fundo_reserva) : "");
    setEditVencimento(aviso.vencimento);
    setEditDescricao(aviso.descricao);
  };

  const guardarEdicaoAviso = () => {
    if (!editingAviso) return;
    const novoValor = parseValorMonetario(editValorTotal);
    if (novoValor <= 0) return alert("Indique um valor total válido.");
    const novoValorFCR = editValorFCR ? parseValorMonetario(editValorFCR) : undefined;
    if (novoValorFCR !== undefined && novoValorFCR >= novoValor) {
      return alert("O valor do Fundo de Reserva tem de ser menor do que o valor total.");
    }

    const atualizacao: Partial<Aviso> = {
      valor: novoValor,
      valor_fundo_reserva: novoValorFCR,
      vencimento: editVencimento,
      descricao: editDescricao
    };
    setAvisos(prev => prev.map(a => a.id_aviso === editingAviso.id_aviso ? { ...a, ...atualizacao } : a));
    dbUpdate("avisos", { ...atualizacao, valor_fundo_reserva: novoValorFCR ?? null }, [["id_aviso", "eq", editingAviso.id_aviso]]).catch(console.error);
    registarLogAuditoria("Financeira", `Editou o aviso ${editingAviso.id_aviso}`, predio.id_predio, loggedUser, `Novo valor: ${novoValor.toFixed(2)}€`);
    setEditingAviso(null);
  };

  const eliminarAviso = (aviso: Aviso) => {
    if (aviso.id_movimento) {
      alert("Este aviso já tem um depósito real registado na Tesouraria — não pode ser eliminado. Se foi um erro, corrija o movimento diretamente em Movimentos & Tesouraria.");
      return;
    }
    if (!window.confirm(`Eliminar o aviso ${aviso.id_aviso.toUpperCase()} (${aviso.valor.toFixed(2)}€)? Esta ação não pode ser desfeita.`)) return;
    setAvisos(prev => prev.filter(a => a.id_aviso !== aviso.id_aviso));
    dbDelete("avisos", [["id_aviso", "eq", aviso.id_aviso]]).catch(console.error);
    registarLogAuditoria("Financeira", `Eliminou o aviso ${aviso.id_aviso}`, predio.id_predio, loggedUser, `${aviso.valor.toFixed(2)}€`);
  };

  const alterarEstadoAviso = (id: string, novoEstado: string) => {
    setAvisos(prev => prev.map(a => a.id_aviso === id ? { ...a, estado: novoEstado } : a));
    if (selectedAviso && selectedAviso.id_aviso === id) {
      setSelectedAviso(prev => prev ? { ...prev, estado: novoEstado } : null);
    }
    dbUpdate("avisos", { estado: novoEstado }, [["id_aviso", "eq", id]]).catch(console.error);
    registarLogAuditoria("Financeira", `Alterou o estado do aviso ${id} para "${novoEstado}"`, predio.id_predio, loggedUser);
  };

  const handleMarcarPagoComMovimento = async (aviso: Aviso, idConta: string, valorInformado: number) => {
    if (!idConta) {
      alert("Selecione a conta bancária onde o valor foi recebido antes de marcar como pago.");
      return;
    }
    const contaAlvo = contas.find(c => c.id_conta === idConta);
    if (!contaAlvo) {
      alert("Conta bancária inválida.");
      return;
    }
    const saldoDevedor = Math.round((aviso.valor - (aviso.valor_pago || 0)) * 100) / 100;
    if (valorInformado <= 0 || valorInformado > saldoDevedor + 0.01) {
      alert(`Indique um valor entre 0,01€ e o saldo em dívida (${saldoDevedor.toFixed(2)}€).`);
      return;
    }

    const frac = fracoes.find(f => f.id_fracao === aviso.id_fracao);
    const ehQuitacaoTotal = valorInformado >= saldoDevedor - 0.01;
    const novoMovimento: Movimento = {
      id_mov: "mov-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      id_predio: predio.id_predio,
      id_conta: idConta,
      id_fracao: aviso.id_fracao,
      data: customDataPagamento || new Date().toISOString().split("T")[0],
      tipo: "Receita",
      valor: valorInformado,
      descricao: `${aviso.tipo || "Quota"} — Fração ${frac?.fracao_nome || aviso.id_fracao} (Aviso ${aviso.id_aviso})${ehQuitacaoTotal ? "" : " (tranche)"}`,
      categoria: (aviso.tipo || "").toLowerCase().includes("extra") ? "Quota Extraordinária" : "Quota Mensal",
      estado: "Justificado",
      metodo_pagamento: "Transferência Bancária"
    };

    const contaAtualizada: Conta = { ...contaAlvo, saldo: (contaAlvo.saldo || 0) + valorInformado };
    setContas(prev => prev.map(c => c.id_conta === idConta ? contaAtualizada : c));
    saveContaToSupabase(contaAtualizada).catch(console.error);

    setMovements(prev => [novoMovimento, ...prev]);
    saveMovimentoToSupabase(novoMovimento).catch(console.error);

    const novoValorPago = Math.round(((aviso.valor_pago || 0) + valorInformado) * 100) / 100;
    const atualizacaoAviso = {
      // "avisos.estado" só aceita "Pendente"/"Pago" (check constraint) — um
      // pagamento parcial fica "Pendente" na mesma; valor_pago (abaixo) é
      // quem regista quanto já foi pago, sem precisar de um 3º estado.
      estado: ehQuitacaoTotal ? "Pago" : "Pendente",
      valor_pago: novoValorPago,
      id_movimento: novoMovimento.id_mov,
      id_conta: idConta
    };
    setAvisos(prev => prev.map(a => a.id_aviso === aviso.id_aviso ? { ...a, ...atualizacaoAviso } : a));
    if (selectedAviso && selectedAviso.id_aviso === aviso.id_aviso) {
      setSelectedAviso(prev => prev ? { ...prev, ...atualizacaoAviso } : null);
    }
    dbUpdate("avisos", atualizacaoAviso, [["id_aviso", "eq", aviso.id_aviso]]).catch(console.error);
    registarLogAuditoria(
      "Financeira",
      ehQuitacaoTotal ? `Liquidou o aviso ${aviso.id_aviso}` : `Registou um pagamento parcial do aviso ${aviso.id_aviso}`,
      predio.id_predio,
      loggedUser,
      `${valorInformado.toFixed(2)}€ via ${contaAlvo.banco}${ehQuitacaoTotal ? "" : ` — saldo em dívida: ${(saldoDevedor - valorInformado).toFixed(2)}€`}`
    );

    setARegistarPagamento(false);
    setPagamentoContaId("");
    setPagamentoValorInput("");
  };

  const fecharModal = () => {
    setSelectedAviso(null);
  };

  const handleDownloadDocumentoOficial = () => {
    if (!selectedAviso) return;
    const frac = fracoes.find(f => f.id_fracao === selectedAviso.id_fracao);
    const isExtra = selectedAviso.tipo.toLowerCase().includes("extra");
    const temFCR = typeof selectedAviso.valor_fundo_reserva === "number" && selectedAviso.valor_fundo_reserva > 0;

    const rubricas: import("../types").ReciboQuitacao["rubricas"] = [];
    if (temFCR) {
      const valorOrdinaria = Math.round((selectedAviso.valor - (selectedAviso.valor_fundo_reserva || 0)) * 100) / 100;
      rubricas.push({ descricao: "Quota de Condomínio Ordinária", valor: valorOrdinaria, tipo: "Quota Ordinária" });
      rubricas.push({ descricao: "Fundo Comum de Reserva (FCR)", valor: selectedAviso.valor_fundo_reserva || 0, tipo: "Fundo Comum de Reserva" });
    } else if (isExtra) {
      rubricas.push({ descricao: customDescritivo || selectedAviso.descricao, valor: selectedAviso.valor, tipo: "Quota Extraordinária" });
    } else {
      rubricas.push({ descricao: customDescritivo || selectedAviso.descricao, valor: selectedAviso.valor, tipo: "Quota Ordinária" });
    }

    const recNumStr = customNrecibo || formatQuotaReceiptNumber(selectedAviso.id_aviso.toUpperCase().replace("AV-", ""));
    const dtPag = customDataPagamento || selectedAviso.data || new Date().toISOString().split("T")[0];
    const dtEmissao = selectedAviso.data || dtPag;

    downloadOfficialReceiptPDF(
      {
        id_recibo: recNumStr,
        tipoDocumento: docType === "RECIBO" ? "recibo" : "nota_cobranca",
        numero_sequencial: 1,
        ano: Number(dtPag.substring(0, 4)) || new Date().getFullYear(),
        id_predio: predio.id_predio,
        id_fracao: selectedAviso.id_fracao,
        nome_condomino: customCondomino || selectedAviso.proprietario_nome || frac?.proprietario?.nome || "Condómino Registado",
        nif_condomino: selectedAviso.proprietario_nif || frac?.proprietario?.nif || "",
        fracao_nome: frac?.fracao_nome || "",
        permilagem: frac?.permilagem || 0,
        data_emissao: dtEmissao,
        data_pagamento: dtPag,
        metodo_pagamento: "Transferência Bancária",
        valor_total: selectedAviso.valor,
        rubricas,
        iban_predio: customIban || escolherIbanContaPorTipo(contas, selectedAviso.tipo) || predio.iban || "",
        codigo_verificacao_hash: selectedAviso.id_aviso.toUpperCase(),
        emitido_por: loggedUser.nome || "Administração do Condomínio",
        adminNome: loggedUser.nome ? `${loggedUser.nome} (Administração)` : "Administração do Condomínio",
        adminSignatureBase64: localStorage.getItem("admin_signature_digital") || undefined
      },
      predio,
      frac
    );

    if (setDocumentos) {
      const isRecibo = docType === "RECIBO";
      setDocumentos(prev => [
        ...prev,
        {
          id_doc: "doc-" + (isRecibo ? "rec-" : "nc-") + Math.floor(10000 + Math.random() * 90000),
          id_predio: predio.id_predio,
          nome: `${isRecibo ? "Recibo" : "Nota_Cobranca"}_${recNumStr.replace(/[^a-zA-Z0-9_-]/g, "_")}_Fracao_${frac?.fracao_nome || "A"}.pdf`,
          tipo: isRecibo ? "Recibo" : "Nota de Cobrança",
          data_upload: dtPag,
          tamanho: "220 KB",
          categoria: "Pasta Paga. Quotas",
          sub_pasta: isRecibo ? "Recibos" : "Notas de cobrança",
          descricao: `${isRecibo ? "Recibo" : "Nota de cobrança"} nº ${recNumStr} - Fração ${frac?.fracao_nome || "A"} - ${customDescritivo || selectedAviso.descricao}`,
          visibilidade: "Público",
          autor: loggedUser.nome || "Administração",
          tema: "Pasta Paga. Quotas",
          ano: dtPag.substring(0, 4),
          tipo_arquivo: "documento",
          relevancia_perfis: ["ADMIN", "EMPRESA_GESTORA", "USER", "CONTABILISTA"]
        }
      ]);
    }
  };

  // Filtro estilo Excel dos Avisos Emitidos
  const avisosTiposUnicos = useMemo(() => Array.from(new Set(predioAvisos.map(a => a.tipo))), [predioAvisos]);
  const avisosEstadosUnicos = useMemo(() => Array.from(new Set(predioAvisos.map(a => a.estado))), [predioAvisos]);
  const avisosFracoesUnicas = useMemo(() => Array.from(new Set(predioAvisos.map(a => fracoes.find(f => f.id_fracao === a.id_fracao)?.fracao_nome || "?"))), [predioAvisos, fracoes]);
  const [filtroTiposAvisos, setFiltroTiposAvisos] = useState<Set<string>>(new Set());
  const [filtroEstadosAvisos, setFiltroEstadosAvisos] = useState<Set<string>>(new Set());
  const [filtroFracoesAvisos, setFiltroFracoesAvisos] = useState<Set<string>>(new Set());

  useEffect(() => {
    setFiltroTiposAvisos(prev => (prev.size === 0 ? new Set(avisosTiposUnicos) : prev));
  }, [avisosTiposUnicos.join("|")]);
  useEffect(() => {
    setFiltroEstadosAvisos(prev => (prev.size === 0 ? new Set(avisosEstadosUnicos) : prev));
  }, [avisosEstadosUnicos.join("|")]);
  useEffect(() => {
    setFiltroFracoesAvisos(prev => (prev.size === 0 ? new Set(avisosFracoesUnicas) : prev));
  }, [avisosFracoesUnicas.join("|")]);

  // Pesquisa livre — id do aviso, descrição, fração ou nome do condómino,
  // para além dos filtros de coluna (mais rápida do que abrir o filtro de
  // cada coluna quando só se procura um termo, ex: "julho" ou "guerra").
  const [pesquisaAvisos, setPesquisaAvisos] = useState("");

  const predioAvisosFiltrados = predioAvisos.filter(a => {
    const frac = fracoes.find(f => f.id_fracao === a.id_fracao);
    const nomeFracao = frac?.fracao_nome || "?";
    if (!filtroTiposAvisos.has(a.tipo) || !filtroEstadosAvisos.has(a.estado) || !filtroFracoesAvisos.has(nomeFracao)) return false;
    const termo = pesquisaAvisos.trim().toLowerCase();
    if (!termo) return true;
    const alvo = `${a.id_aviso} ${a.descricao} ${nomeFracao} ${frac?.proprietario?.nome || ""}`.toLowerCase();
    return alvo.includes(termo);
  });

  const exportarAvisosXLS = () => {
    const headers = ["Doc ID", "Fração", "Condómino", "Data", "Vencimento", "Descrição", "Tipo", "Valor (€)", "Estado"];
    const rows = predioAvisosFiltrados.map(a => {
      const frac = fracoes.find(f => f.id_fracao === a.id_fracao);
      return [
        a.id_aviso.toUpperCase(),
        frac?.fracao_nome || "?",
        frac?.proprietario?.nome || "",
        formatDatePT(a.data),
        formatDatePT(a.vencimento),
        a.descricao,
        a.tipo,
        a.valor.toFixed(2),
        a.estado
      ];
    });
    exportToXLS(`Avisos_Cobranca_${predio.nome.replace(/\s+/g, "_")}`, headers, rows);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header Principal do Módulo */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold mb-2 border border-emerald-200">
            <Calculator className="w-3.5 h-3.5" />
            <span>Módulo Financeiro Oficial</span>
          </div>
          <h2 className="text-xl font-black text-slate-900">Quotas & Orçamento Anual</h2>
          <p className="text-xs text-slate-500 mt-1">
            Orçamento anual e adendas, cálculo e emissão de quotas (ordinárias e extraordinárias) e avisos de cobrança já emitidos — tudo interligado às contas bancárias do edifício. Clique em cada secção para abrir.
          </p>
        </div>
      </div>

      {/* Banner de Validação de Permilagem Legal — sempre visível, é o alerta jurídico mais importante do módulo */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          totalPermilagem === 1000
            ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
            : "bg-amber-50/80 border-amber-200 text-amber-900"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg shrink-0 ${totalPermilagem === 1000 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {totalPermilagem === 1000 ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider">
              {totalPermilagem === 1000 ? "Integridade Jurídica Conforme (Art. 1418.º do Código Civil)" : "Aviso de Permilagem do Edifício"}
            </h4>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {totalPermilagem === 1000
                ? "A soma das permilagens totaliza exatamente 1000‰ legais. A partilha de encargos é estritamente proporcional."
                : `A soma das frações é de ${totalPermilagem}‰. Recomenda-se retificar para 1000‰ para validade fiscal plena.`}
            </p>
          </div>
        </div>
        <span className="font-mono font-black text-sm px-3 py-1 bg-white rounded-lg border border-slate-200 shadow-xs shrink-0">
          {totalPermilagem}‰ / 1000‰
        </span>
      </div>

      {sucessoEmissao && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-xl flex items-center gap-3 animate-fadeIn shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-xs font-bold">{sucessoEmissao}</p>
        </div>
      )}

      {/* SECÇÃO 1 — ORÇAMENTO ANUAL & ADENDAS */}
      {(loggedUser.role === 'ADMIN' || loggedUser.role === 'EMPRESA_GESTORA') && (
        <AccordionSection
          title="1. Orçamento Anual & Adendas"
          subtitle="Define o orçamento anual em vigor, regista revisões aprovadas em assembleia e emite as quotas mensais em lote"
          icon={<FileSignature className="w-4 h-4" />}
        >
          <form onSubmit={gerarOrcamentoMensal} className="space-y-4 no-print">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 mb-1">Orçamento Geral Anual (€) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={orcamentoAnual}
                  onChange={e => setOrcamentoAnual(e.target.value)}
                  placeholder="Ex: 5000"
                  className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 mb-1">Mês de Emissão *</label>
                <select value={mes} onChange={e => setMes(e.target.value)} className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white">
                  <option value="Janeiro">Janeiro</option>
                  <option value="Fevereiro">Fevereiro</option>
                  <option value="Março">Março</option>
                  <option value="Abril">Abril</option>
                  <option value="Maio">Maio</option>
                  <option value="Junho">Junho</option>
                  <option value="Julho">Julho</option>
                  <option value="Agosto">Agosto</option>
                  <option value="Setembro">Setembro</option>
                  <option value="Outubro">Outubro</option>
                  <option value="Novembro">Novembro</option>
                  <option value="Dezembro">Dezembro</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 mb-1">Ano de Emissão *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={anoEmissao}
                  onChange={e => setAnoEmissao(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                  placeholder={String(new Date().getFullYear())}
                  className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono"
                />
              </div>
            </div>
            <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors cursor-pointer flex items-center space-x-2">
              <i className="fa-solid fa-paper-plane"></i>
              <span>Emitir Quotas em Lote Proporcional</span>
            </button>
          </form>

          <div className="border-t border-slate-100 pt-4 space-y-4">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <i className="fa-solid fa-file-signature text-sm"></i>
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Adendas & Revisões ao Orçamento Anual</h3>
                <p className="text-xs text-slate-500">Regista uma revisão aprovada em assembleia a meio do ano (mantém o histórico do valor anterior, entra em vigor sozinha na data indicada).</p>
              </div>
            </div>

            {revisaoEmVigor && (
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-800">
                <strong>Em vigor desde {formatDatePT(revisaoEmVigor.data_vigencia)}:</strong> {revisaoEmVigor.valor.toFixed(2)} € /ano
                {revisaoEmVigor.aprovado_em_assembleia ? " (aprovado em assembleia)" : ""}
                {revisaoEmVigor.motivo ? ` — ${revisaoEmVigor.motivo}` : ""}
              </div>
            )}

            <form onSubmit={handleAddRevisaoOrcamento} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 mb-1">Novo Valor Anual (€) *</label>
                <input type="text" inputMode="decimal" value={novaRevisaoValor} onChange={e => setNovaRevisaoValor(e.target.value)} placeholder="Ex: 12000" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono" />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 mb-1">Vigência a partir de *</label>
                <input type="date" value={novaRevisaoData} onChange={e => setNovaRevisaoData(e.target.value)} className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 mb-1">Ata da Decisão</label>
                <select
                  value={novaRevisaoAtaId}
                  onChange={e => setNovaRevisaoAtaId(e.target.value)}
                  className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white"
                >
                  <option value="">— Sem ata associada —</option>
                  {atasEmitidas.map(r => (
                    <option key={r.id_reuniao} value={r.id_reuniao}>
                      Ata {r.numero_ata || "s/nº"} — {r.tema} ({formatDatePT(r.data)})
                    </option>
                  ))}
                </select>
                {atasEmitidas.length === 0 && (
                  <span className="text-[10px] text-amber-600 mt-0.5">Nenhuma ata emitida ainda em Assembleias — pode continuar sem associar.</span>
                )}
                <input
                  type="text"
                  value={novaRevisaoMotivo}
                  onChange={e => setNovaRevisaoMotivo(e.target.value)}
                  placeholder="Nota adicional (opcional)"
                  className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 mt-1.5"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={novaRevisaoAssembleia} onChange={e => setNovaRevisaoAssembleia(e.target.checked)} className="cursor-pointer" />
                  Aprovado em assembleia
                </label>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0">
                  Registar Revisão
                </button>
              </div>
            </form>

            {revisoesOrcamento.length > 0 && (
              <div className="overflow-x-auto border border-slate-150 rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="p-2.5">Vigência</th>
                      <th className="p-2.5 text-right">Valor Anual</th>
                      <th className="p-2.5">Motivo</th>
                      <th className="p-2.5 text-center">Assembleia</th>
                      <th className="p-2.5 text-center">Estado</th>
                      <th className="p-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {revisoesOrcamento.map(r => (
                      <tr key={r.id_revisao} className={`border-b border-slate-100 hover:bg-slate-50/50 ${r.id_revisao === revisaoEmVigor?.id_revisao ? "bg-indigo-50/40" : ""}`}>
                        <td className="p-2.5 font-mono text-slate-600">{formatDatePT(r.data_vigencia)}</td>
                        <td className="p-2.5 text-right font-bold font-mono text-slate-800">{r.valor.toFixed(2)} €</td>
                        <td className="p-2.5 text-slate-500">{r.motivo || "—"}</td>
                        <td className="p-2.5 text-center">{r.aprovado_em_assembleia ? "✅" : "—"}</td>
                        <td className="p-2.5 text-center">
                          {r.id_revisao === revisaoEmVigor?.id_revisao ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold">Em Vigor</span>
                          ) : r.data_vigencia > new Date().toISOString().split("T")[0] ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold">Agendada</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold">Histórico</span>
                          )}
                        </td>
                        <td className="p-2.5 text-right">
                          {loggedUser.role === "ADMIN" && (
                            <button onClick={() => handleRemoverRevisaoOrcamento(r)} className="text-slate-400 hover:text-red-500 cursor-pointer" title="Eliminar">
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </AccordionSection>
      )}

      {/* SECÇÃO 2 — CÁLCULO DE QUOTAS POR FRAÇÃO */}
      <AccordionSection
        title="2. Cálculo de Quotas por Fração"
        subtitle={`Repartição proporcional pela permilagem, quotas extraordinárias (obras/FCR) e discriminação das ${predioFracoes.length} frações`}
        icon={<Calculator className="w-4 h-4" />}
        badge={
          loggedUser.role === "ADMIN" && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleExportarPDF(); }}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-300"
            >
              <Download className="w-3 h-3 text-slate-600" />
              <span>Mapa PDF</span>
            </button>
          )
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Quotas Ordinárias Mensais</h3>
                  <p className="text-[10px] text-slate-400">Despesas correntes (limpeza, eletricidade, elevadores, seguro)</p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">Corrente</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Orçamento Mensal Global (€)</label>
                <input
                  type="number"
                  value={orcamentoRegular}
                  readOnly
                  disabled
                  title="Valor real em vigor, vindo do Orçamento Anual definido acima — não editável aqui para nunca duplicar a emissão automática mensal (dia 25)."
                  className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl bg-slate-100 font-mono font-bold text-slate-500 cursor-not-allowed"
                />
                <p className="text-[9.5px] text-slate-400 mt-1">Vem do Orçamento Anual (secção 1 acima). A quota ordinária é sempre emitida automaticamente no dia 25 — aqui só se emite a extraordinária.</p>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Dia Limite de Pagamento Mensal</label>
                <input
                  type="date"
                  value={dataLimiteRegular}
                  onChange={(e) => setDataLimiteRegular(e.target.value)}
                  className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-emerald-500 bg-white font-medium"
                />
              </div>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Conta Bancária de Destino (Ordinárias)</span>
                </label>
                <span className="text-[9px] font-bold text-slate-500">{predioContas.length} Contas Registadas</span>
              </div>
              {predioContas.length === 0 ? (
                <p className="text-xs text-amber-700 font-medium">Nenhuma conta bancária registada para este condomínio. Vá ao menu "Contas Bancárias" para registar.</p>
              ) : (
                <select
                  value={contaOrdinariaId}
                  onChange={(e) => setContaOrdinariaId(e.target.value)}
                  className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl bg-white font-bold text-slate-800 cursor-pointer focus:outline-emerald-500"
                >
                  {predioContas.map((c) => (
                    <option key={c.id_conta} value={c.id_conta}>
                      {c.banco} • {c.descricao || c.tipo} ({c.saldo_atual?.toFixed(2) || 0} €)
                    </option>
                  ))}
                </select>
              )}
              {contaOrdinariaSel && (
                <div className="pt-1 flex flex-wrap items-center justify-between text-[11px] text-slate-600">
                  <span className="font-mono font-semibold">IBAN: {contaOrdinariaSel.iban}</span>
                  <span className="font-bold text-emerald-700">Saldo: {contaOrdinariaSel.saldo_atual?.toFixed(2) || 0} €</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Quotas Extraordinárias (Obras / FCR)</h3>
                  <p className="text-[10px] text-slate-400">Encargos com conservação excecional e obras deliberadas em assembleia</p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-sky-100 text-sky-800 rounded">Extraordinária</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Valor Total Orçado (€)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={orcamentoExtra}
                  onChange={(e) => setOrcamentoExtra(e.target.value)}
                  className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-sky-500 bg-white font-mono font-bold"
                  placeholder="Ex: 5000"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">N.º de Prestações</label>
                <select
                  value={numPrestacoesExtra}
                  onChange={(e) => setNumPrestacoesExtra(Number(e.target.value))}
                  className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-sky-500 bg-white font-bold"
                >
                  <option value={1}>1x (Pagamento Único)</option>
                  <option value={2}>2x Prestações</option>
                  <option value={3}>3x Prestações</option>
                  <option value={5}>5x Prestações</option>
                  <option value={6}>6x Prestações</option>
                  <option value={10}>10x Prestações</option>
                  <option value={12}>12x Prestações</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Data de Início do Pagamento</label>
                <input
                  type="date"
                  value={dataInicioExtra}
                  onChange={(e) => setDataInicioExtra(e.target.value)}
                  className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-sky-500 bg-white font-medium"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {numPrestacoesExtra > 1
                    ? `Última prestação em ${new Date(dataLimiteExtraCalculada).toLocaleDateString("pt-PT")} (${numPrestacoesExtra} meses a partir daqui).`
                    : "Pagamento único, sem prestações seguintes."}
                </span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Obra Adjudicada</label>
              <select
                value={obraSelecionadaId}
                onChange={(e) => handleSelecionarObra(e.target.value)}
                className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-sky-500 bg-white font-bold text-slate-800 cursor-pointer"
              >
                <option value="">-- Sem obra ligada (finalidade livre, ex: reforço geral do FCR) --</option>
                {obrasAdjudicadasParaQuota.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.descricao} — {o.fornecedorNome} ({o.custoTotal.toFixed(2)} €) [{o.estado}]
                  </option>
                ))}
              </select>
              {obrasAdjudicadasParaQuota.length === 0 && (
                <p className="text-[10px] text-slate-400 mt-1">Nenhuma obra adjudicada a pedir quota extra de momento (Obras & Contratação → Obras Adjudicadas & Execução).</p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Finalidade / Descrição {obraSelecionada && <span className="text-sky-600 normal-case font-medium">(preenchida a partir da obra selecionada, pode ajustar)</span>}
              </label>
              <input
                type="text"
                value={descricaoExtra}
                onChange={(e) => setDescricaoExtra(e.target.value)}
                className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-sky-500 bg-white font-medium text-slate-800"
                placeholder="Ex: Impermeabilização da cobertura e reparação de caleiras"
              />
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-sky-600" />
                  <span>Conta Bancária de Destino (FCR / Obras)</span>
                </label>
                <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">{extraPorMesTotal.toFixed(2)} €/mês total</span>
              </div>
              {predioContas.length === 0 ? (
                <p className="text-xs text-amber-700 font-medium">Sem conta bancária registada para afetação extraordinária.</p>
              ) : (
                <select
                  value={contaExtraId}
                  onChange={(e) => setContaExtraId(e.target.value)}
                  className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl bg-white font-bold text-slate-800 cursor-pointer focus:outline-sky-500"
                >
                  {predioContas.map((c) => (
                    <option key={c.id_conta} value={c.id_conta}>
                      {c.banco} • {c.descricao || c.tipo} ({c.saldo_atual?.toFixed(2) || 0} €)
                    </option>
                  ))}
                </select>
              )}
              {contaExtraSel && (
                <div className="pt-1 flex flex-wrap items-center justify-between text-[11px] text-slate-600">
                  <span className="font-mono font-semibold">IBAN: {contaExtraSel.iban}</span>
                  <span className="font-bold text-sky-700">Saldo: {contaExtraSel.saldo_atual?.toFixed(2) || 0} €</span>
                </div>
              )}
            </div>

            {loggedUser.role === "ADMIN" && (
              <button
                type="button"
                id="btn-guardar-quotas-supabase"
                onClick={handleEmitirQuotasEmLote}
                disabled={(parseValorMonetario(orcamentoExtra) || 0) <= 0}
                title={(parseValorMonetario(orcamentoExtra) || 0) <= 0 ? "Define um Orçamento Extraordinário para emitir — a quota ordinária é sempre automática (dia 25)." : undefined}
                className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Emitir Quota Extraordinária</span>
              </button>
            )}
          </div>
        </div>

        {/* Discriminação por Fração — sub-secção também em acordeão, dado ser
            a tabela mais longa do módulo (uma linha por fração) */}
        <AccordionSection
          title={`Discriminação das Quotas por Fração (${predioFracoes.length} Frações)`}
          subtitle="Cálculo proporcional exato pela permilagem, associado ao IBAN de crédito e referência de pagamento"
          icon={<FileText className="w-4 h-4" />}
          badge={
            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
              {predioFracoes.length === 0 ? "0.00" : ((Number(orcamentoRegular) || 0) + extraPorMesTotal).toFixed(2)} €/mês
            </span>
          }
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => exportarBalanceteMapaAnualXLS(predio, predioFracoesFiltradas, new Date().getFullYear(), avisos)}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              title="Descarregar grelha das 12 quotas mensais das frações visíveis em Excel/CSV para entregar em Assembleia"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exportar Mapa Anual (XLS)</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="p-3">
                    <span className="inline-flex items-center">Fração / Piso <ColumnFilterDropdown label="Fração" options={fracaoNomesUnicos} selected={filtroFracoesDiscrim} onChange={setFiltroFracoesDiscrim} /></span>
                  </th>
                  <th className="p-3">
                    <span className="inline-flex items-center">Condómino <ColumnFilterDropdown label="Condómino" options={condominoNomesUnicos} selected={filtroCondominosDiscrim} onChange={setFiltroCondominosDiscrim} /></span>
                  </th>
                  <th className="p-3 text-center">Permilagem</th>
                  <th className="p-3 text-right">Quota Ordinária</th>
                  <th className="p-3 text-right">Fundo de Reserva</th>
                  <th className="p-3 text-right">Quota Extra (1/{numPrestacoesExtra})</th>
                  <th className="p-3 text-right font-black">Total a Pagar</th>
                  <th className="p-3">Conta / IBAN Crédito</th>
                  <th className="p-3 text-center">Referência Pagamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {predioFracoesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      {predioFracoes.length === 0 ? "Nenhuma fração registada neste condomínio." : "Nenhuma fração corresponde ao filtro selecionado."}
                    </td>
                  </tr>
                ) : (
                  predioFracoesFiltradas.map((f) => {
                    const quotaTotal = calcularQuotaOrdinaria(f);
                    const quotaOrdinariaPart = Math.round(quotaTotal * 0.9 * 100) / 100;
                    const quotaFCRPart = Math.round(quotaTotal * 0.1 * 100) / 100;
                    const extShare = extraPorMesTotal * (f.permilagem / 1000);
                    const totalShare = quotaOrdinariaPart + quotaFCRPart + extShare;
                    const referenciaReal = f.referencia_br23e || f.proprietario?.referencia_br23e || gerarReferenciaBR23E(f.fracao_nome, f.id_fracao);
                    const referenciaExtra = `EXT23E-FR-${(f.fracao_nome || f.id_fracao || "").toString().trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]/g, "") || "01"}`;

                    return (
                      <tr key={f.id_fracao} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3">
                          <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-mono">Fração {f.fracao_nome}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">{f.piso}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-800">{f.proprietario?.nome || "Sem Proprietário"}</span>
                          {f.proprietario?.email && (
                            <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">{f.proprietario.email}</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-700">{f.permilagem}‰</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">{quotaOrdinariaPart.toFixed(2)} €</td>
                        <td className="p-3 text-right font-mono font-bold text-amber-700">{quotaFCRPart.toFixed(2)} €</td>
                        <td className="p-3 text-right font-mono font-bold text-sky-700">{extShare.toFixed(2)} €</td>
                        <td className="p-3 text-right font-mono font-black text-slate-900 bg-slate-50/70 text-sm">{totalShare.toFixed(2)} €</td>
                        <td className="p-3">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-slate-700 font-bold block truncate max-w-[180px]">{contaOrdinariaSel?.banco || "Conta Geral"}</span>
                            <span className="text-[9px] font-mono text-slate-500 block truncate max-w-[180px]">{contaOrdinariaSel?.iban || "PT50..."}</span>
                            {extVal > 0 && contaExtraSel?.id_conta !== contaOrdinariaSel?.id_conta && (
                              <>
                                <span className="text-[9px] text-sky-700 font-bold block truncate max-w-[180px] pt-1">Extra: {contaExtraSel?.banco || "Conta Geral"}</span>
                                <span className="text-[9px] font-mono text-sky-500 block truncate max-w-[180px]">{contaExtraSel?.iban || "PT50..."}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="space-y-1">
                            <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200 block">{referenciaReal}</span>
                            {extVal > 0 && (
                              <span className="font-mono text-[9px] font-bold bg-sky-50 text-sky-700 px-2 py-1 rounded border border-sky-200 block" title="Referência própria da quota extraordinária">{referenciaExtra}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {predioFracoesFiltradas.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300 text-slate-800">
                    <td colSpan={2} className="p-3 uppercase text-[10px] tracking-wider">Total ({predioFracoesFiltradas.length === predioFracoes.length ? "Global" : "Filtrado"})</td>
                    <td className="p-3 text-center font-mono font-black">{predioFracoesFiltradas.reduce((acc, f) => acc + (Number(f.permilagem) || 0), 0)}‰</td>
                    <td className="p-3 text-right font-mono font-black text-emerald-800">
                      {predioFracoesFiltradas.reduce((acc, f) => acc + Math.round(calcularQuotaOrdinaria(f) * 0.9 * 100) / 100, 0).toFixed(2)} €
                    </td>
                    <td className="p-3 text-right font-mono font-black text-amber-800">
                      {predioFracoesFiltradas.reduce((acc, f) => acc + Math.round(calcularQuotaOrdinaria(f) * 0.1 * 100) / 100, 0).toFixed(2)} €
                    </td>
                    <td className="p-3 text-right font-mono font-black text-sky-800">
                      {predioFracoesFiltradas.reduce((acc, f) => acc + extraPorMesTotal * (f.permilagem / 1000), 0).toFixed(2)} €
                    </td>
                    <td className="p-3 text-right font-mono font-black text-slate-950 text-sm">
                      {predioFracoesFiltradas.reduce((acc, f) => {
                        const qt = calcularQuotaOrdinaria(f);
                        return acc + Math.round(qt * 0.9 * 100) / 100 + Math.round(qt * 0.1 * 100) / 100 + extraPorMesTotal * (f.permilagem / 1000);
                      }, 0).toFixed(2)} €
                    </td>
                    <td colSpan={2} className="p-3 text-right text-[10px] text-slate-500">Calculado e interligado com as contas bancárias</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </AccordionSection>
      </AccordionSection>

      {/* SECÇÃO 3 — AVISOS DE COBRANÇA EMITIDOS */}
      <AccordionSection
        title="3. Avisos de Cobrança Emitidos"
        subtitle="Notas de cobrança e recibos já emitidos — gerar documentos, editar ou eliminar"
        icon={<FileText className="w-4 h-4" />}
        badge={<span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full">Total: {predioAvisos.length} docs</span>}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="relative w-full sm:max-w-xs">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]"></i>
            <input
              type="text"
              value={pesquisaAvisos}
              onChange={(e) => setPesquisaAvisos(e.target.value)}
              placeholder="Pesquisar por ID, fração, condómino ou descrição..."
              className="w-full border border-slate-200 pl-8 pr-3 py-1.5 text-xs rounded-lg focus:outline-emerald-500 bg-white"
            />
          </div>
          <button
            type="button"
            onClick={exportarAvisosXLS}
            className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
            title="Descarregar a lista filtrada em Excel/CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar ({predioAvisosFiltrados.length})</span>
          </button>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[480px] border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <th className="p-3">Doc ID</th>
                <th className="p-3"><span className="inline-flex items-center">Fração <ColumnFilterDropdown label="Fração" options={avisosFracoesUnicas} selected={filtroFracoesAvisos} onChange={setFiltroFracoesAvisos} /></span></th>
                <th className="p-3">Data</th>
                <th className="p-3">Vencimento</th>
                <th className="p-3">Descrição do Aviso</th>
                <th className="p-3"><span className="inline-flex items-center">Tipo <ColumnFilterDropdown label="Tipo" options={avisosTiposUnicos} selected={filtroTiposAvisos} onChange={setFiltroTiposAvisos} /></span></th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-center"><span className="inline-flex items-center justify-center">Estado <ColumnFilterDropdown label="Estado" options={avisosEstadosUnicos} selected={filtroEstadosAvisos} onChange={setFiltroEstadosAvisos} /></span></th>
                <th className="p-3 text-center no-print">Gerar Docs</th>
              </tr>
            </thead>
            <tbody>
              {predioAvisosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-400 italic">
                    {predioAvisos.length === 0 ? "Nenhum aviso emitido para este condomínio." : "Nenhum aviso corresponde ao filtro selecionado."}
                  </td>
                </tr>
              ) : (
                predioAvisosFiltrados.map(a => {
                  const frac = fracoes.find(f => f.id_fracao === a.id_fracao);
                  return (
                    <tr key={a.id_aviso} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="p-3 font-mono text-indigo-600 font-bold">{a.id_aviso.toUpperCase()}</td>
                      <td className="p-3 font-bold text-slate-800">Fração {frac?.fracao_nome || "?"} ({frac?.piso || "N/A"})</td>
                      <td className="p-3 font-mono">{formatDatePT(a.data)}</td>
                      <td className="p-3 font-mono">{formatDatePT(a.vencimento)}</td>
                      <td className="p-3 text-slate-600">{a.descricao}</td>
                      <td className="p-3">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                          a.tipo === 'Quota Ordinária'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : a.tipo.includes('Extra')
                            ? 'bg-amber-50 text-amber-700 border-amber-100'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                        }`}>
                          {a.tipo}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold font-mono">{a.valor.toFixed(2)}€</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          a.estado === 'Pago'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : (a.valor_pago || 0) > 0
                            ? 'bg-sky-50 text-sky-700 border border-sky-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {a.estado === 'Pago' ? 'Pago' : (a.valor_pago || 0) > 0 ? 'Paga Parcialmente' : a.estado}
                        </span>
                      </td>
                      <td className="p-3 text-center no-print">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button onClick={() => abrirDocumento(a, "NOTA_COBRANCA")} title="Nota de Cobrança" className="p-1 px-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 text-slate-600 rounded text-[10px] font-bold cursor-pointer transition-colors">
                            <i className="fa-solid fa-file-invoice mr-1"></i> Nota
                          </button>
                          <button onClick={() => abrirDocumento(a, "RECIBO")} title="Emitir Recibo Oficial" className="p-1 px-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 border border-slate-200 text-slate-600 rounded text-[10px] font-bold cursor-pointer transition-colors">
                            <i className="fa-solid fa-receipt mr-1"></i> Recibo
                          </button>
                          <button onClick={() => abrirEdicaoAviso(a)} title="Editar Aviso" className="p-1 px-2 bg-slate-100 hover:bg-amber-50 hover:text-amber-600 border border-slate-200 text-slate-600 rounded text-[10px] font-bold cursor-pointer transition-colors">
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          <button onClick={() => eliminarAviso(a)} title="Eliminar Aviso" className="p-1 px-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 border border-slate-200 text-slate-600 rounded text-[10px] font-bold cursor-pointer transition-colors">
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AccordionSection>

      {/* DOCUMENT GENERATOR MODAL */}
      {selectedAviso && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto no-print">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl w-full max-w-5xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row h-[90vh] max-h-[800px] overflow-hidden">
            <div className="w-full md:w-80 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between overflow-y-auto shrink-0">
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Editor do Documento</h3>
                  <button onClick={fecharModal} className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer">
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tipo de Documento</label>
                  <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-slate-100 dark:bg-slate-900 rounded-lg">
                    <button type="button" onClick={() => setDocType("NOTA_COBRANCA")} className={`py-1 text-[10px] font-bold rounded-md transition-all ${docType === "NOTA_COBRANCA" ? "bg-indigo-600 text-white shadow" : "text-slate-500 hover:text-slate-700"}`}>
                      Nota Cobrança
                    </button>
                    <button type="button" onClick={() => setDocType("RECIBO")} className={`py-1 text-[10px] font-bold rounded-md transition-all ${docType === "RECIBO" ? "bg-emerald-600 text-white shadow" : "text-slate-500 hover:text-slate-700"}`}>
                      Recibo Pago
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Condómino / Proprietário</label>
                  <input type="text" value={customCondomino} onChange={e => setCustomCondomino(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2.5 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white font-medium" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Descritivo Oficial</label>
                  <textarea rows={2} value={customDescritivo} onChange={e => setCustomDescritivo(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs p-2.5 rounded-lg focus:outline-indigo-500 dark:text-white font-medium" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Quota Mensal (€)</label>
                    <MoneyInput value={customQuotaMensal} onChange={setCustomQuotaMensal} className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Quota Extra (€)</label>
                    <MoneyInput value={customQuotaExtra} onChange={setCustomQuotaExtra} className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white font-mono" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">IBAN do Prédio</label>
                  <input
                    type="text"
                    value={customIban}
                    onChange={e => setCustomIban(e.target.value)}
                    placeholder={selectedAviso ? `Automático: ${escolherIbanContaPorTipo(contas, selectedAviso.tipo) || predio.iban || "—"}` : "Automático conforme o tipo de aviso"}
                    className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2.5 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white font-mono"
                  />
                </div>

                {docType === "RECIBO" ? (
                  <div className="grid grid-cols-1 gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Data de Liquidação</label>
                      <input type="date" value={customDataPagamento} onChange={e => setCustomDataPagamento(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nº Recibo</label>
                      <input type="text" value={customNrecibo} onChange={e => setCustomNrecibo(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2.5 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white font-mono" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Data Limite de Pagamento</label>
                    <input type="date" value={customDataLimite} onChange={e => setCustomDataLimite(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white" />
                  </div>
                )}

                <div className="space-y-1 pt-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Estado do Aviso Global</label>
                  <div className="flex space-x-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedAviso.id_movimento && !confirm("Este aviso já tem um depósito real registado na Tesouraria. Marcar como Pendente NÃO apaga esse movimento nem o saldo já creditado — se foi um erro, corrija/elimine o movimento diretamente em Movimentos & Tesouraria. Continuar?")) {
                          return;
                        }
                        setARegistarPagamento(false);
                        alterarEstadoAviso(selectedAviso.id_aviso, "Pendente");
                      }}
                      className={`flex-1 py-1 text-[9px] font-extrabold rounded-md border ${selectedAviso.estado === "Pendente" ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-slate-50 border-slate-200 text-slate-400"}`}
                    >
                      Marcar Pendente
                    </button>
                    <button
                      type="button"
                      disabled={selectedAviso.estado === "Pago"}
                      onClick={() => {
                        const saldoDevedor = Math.round((selectedAviso.valor - (selectedAviso.valor_pago || 0)) * 100) / 100;
                        setPagamentoValorInput(saldoDevedor.toFixed(2).replace(".", ","));
                        setARegistarPagamento(true);
                      }}
                      className={`flex-1 py-1 text-[9px] font-extrabold rounded-md border disabled:cursor-not-allowed ${selectedAviso.estado === "Pago" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-slate-50 border-slate-200 text-slate-400"}`}
                    >
                      Marcar Pago
                    </button>
                  </div>
                  {selectedAviso.estado === "Pago" && selectedAviso.id_movimento && (
                    <p className="text-[9px] text-emerald-600 dark:text-emerald-400 pt-0.5">
                      <i className="fa-solid fa-check-circle mr-1"></i>Depósito registado na Tesouraria ({movements.find(m => m.id_mov === selectedAviso.id_movimento)?.categoria || "Movimento"})
                    </p>
                  )}
                  {selectedAviso.estado === "Pendente" && (selectedAviso.valor_pago || 0) > 0 && (
                    <p className="text-[9px] text-amber-600 dark:text-amber-400 pt-0.5">
                      <i className="fa-solid fa-hourglass-half mr-1"></i>Pago {((selectedAviso.valor_pago || 0)).toFixed(2)}€ de {selectedAviso.valor.toFixed(2)}€ — falta {(selectedAviso.valor - (selectedAviso.valor_pago || 0)).toFixed(2)}€
                    </p>
                  )}

                  {aRegistarPagamento && (
                    <div className="mt-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-lg space-y-2">
                      <label className="text-[9px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">Conta Bancária de Entrada *</label>
                      <select value={pagamentoContaId} onChange={e => setPagamentoContaId(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] px-2 py-1.5 rounded-lg focus:outline-emerald-500 dark:text-white">
                        <option value="">Selecione a conta...</option>
                        {predioContas.map(c => (
                          <option key={c.id_conta} value={c.id_conta}>{c.banco} ({c.tipo}) - Saldo: {c.saldo?.toFixed(2)}€</option>
                        ))}
                      </select>
                      <label className="text-[9px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                        Valor Recebido Agora (€) * — em dívida: {(selectedAviso.valor - (selectedAviso.valor_pago || 0)).toFixed(2)}€
                      </label>
                      <input type="text" inputMode="decimal" value={pagamentoValorInput} onChange={e => setPagamentoValorInput(e.target.value)} placeholder="0,00" className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] px-2 py-1.5 rounded-lg focus:outline-emerald-500 dark:text-white" />
                      <p className="text-[8px] text-emerald-700 dark:text-emerald-400">Pode indicar um valor inferior ao total em dívida para registar um pagamento parcial (o aviso fica "Paga Parcialmente" até liquidar o resto).</p>
                      <div className="flex space-x-1.5">
                        <button type="button" onClick={() => { setARegistarPagamento(false); setPagamentoContaId(""); setPagamentoValorInput(""); }} className="flex-1 py-1 text-[9px] font-extrabold rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
                          Cancelar
                        </button>
                        <button type="button" onClick={() => handleMarcarPagoComMovimento(selectedAviso, pagamentoContaId, parseValorMonetario(pagamentoValorInput))} className="flex-1 py-1 text-[9px] font-extrabold rounded-md border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700">
                          Confirmar Recebimento
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                <button type="button" onClick={handleDownloadDocumentoOficial} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-md">
                  <i className="fa-solid fa-file-pdf"></i>
                  <span>Descarregar PDF Oficial (A5)</span>
                </button>
                <button type="button" onClick={fecharModal} className="w-full bg-slate-100 text-slate-600 font-bold py-2 rounded-xl text-xs hover:bg-slate-200 transition-colors cursor-pointer">
                  Voltar à Lista
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 dark:bg-slate-900/40 p-6 md:p-10 overflow-y-auto flex flex-col items-center">
              <div className="w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-5">
                <div className="text-center space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pré-visualização de Dados</p>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase">
                    {docType === "RECIBO" ? `Recibo Nº ${customNrecibo}` : "Nota de Cobrança"}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Fração {fracoes.find(f => f.id_fracao === selectedAviso.id_fracao)?.fracao_nome || "?"} — {customCondomino}
                  </p>
                </div>

                <div className="space-y-2">
                  {(() => {
                    const temFCR = typeof selectedAviso.valor_fundo_reserva === "number" && (selectedAviso.valor_fundo_reserva || 0) > 0;
                    const isExtra = selectedAviso.tipo.toLowerCase().includes("extra");
                    const linhas: { label: string; valor: number }[] = temFCR
                      ? [
                          { label: "Quota de Condomínio Ordinária", valor: Math.round((selectedAviso.valor - (selectedAviso.valor_fundo_reserva || 0)) * 100) / 100 },
                          { label: "Fundo Comum de Reserva (FCR)", valor: selectedAviso.valor_fundo_reserva || 0 }
                        ]
                      : [{ label: isExtra ? "Quota Extraordinária" : "Quota de Condomínio", valor: selectedAviso.valor }];
                    return linhas.map((l, i) => (
                      <div key={i} className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 dark:text-slate-300">{l.label}</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-white">{l.valor.toFixed(2)} €</span>
                      </div>
                    ));
                  })()}
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">Total</span>
                  <span className="font-mono font-black text-emerald-600 text-base">{selectedAviso.valor.toFixed(2)} €</span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg p-3 text-[10px] text-slate-500 dark:text-slate-400 space-y-1">
                  <p><strong className="text-slate-700 dark:text-slate-300">Emissão:</strong> {formatDatePT(selectedAviso.data)}</p>
                  <p><strong className="text-slate-700 dark:text-slate-300">{docType === "RECIBO" ? "Data de Liquidação" : "Limite de Pagamento"}:</strong> {formatDatePT(docType === "RECIBO" ? customDataPagamento : customDataLimite)}</p>
                  <p><strong className="text-slate-700 dark:text-slate-300">IBAN:</strong> {customIban || escolherIbanContaPorTipo(contas, selectedAviso.tipo) || predio.iban || "—"}</p>
                </div>

                <p className="text-[9px] text-slate-400 text-center leading-relaxed">
                  Isto é apenas um resumo dos dados. O documento oficial (PDF em A5, com marca de água, numeração e assinatura da administração) é gerado no botão "Descarregar PDF Oficial" ao lado.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR AVISO */}
      {editingAviso && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="text-sm font-bold">Editar Aviso {editingAviso.id_aviso.toUpperCase()}</h3>
              <button onClick={() => setEditingAviso(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Descrição</label>
                <input type="text" value={editDescricao} onChange={e => setEditDescricao(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Valor Total (€) *</label>
                  <input type="text" inputMode="decimal" value={editValorTotal} onChange={e => setEditValorTotal(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg text-xs font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Fundo de Reserva (€)</label>
                  <input type="text" inputMode="decimal" placeholder="Sem FCR" value={editValorFCR} onChange={e => setEditValorFCR(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg text-xs font-mono" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Vencimento</label>
                <input type="date" value={editVencimento} onChange={e => setEditVencimento(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg text-xs" />
              </div>
              <div className="flex space-x-2 pt-2">
                <button type="button" onClick={() => setEditingAviso(null)} className="flex-1 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="button" onClick={guardarEdicaoAviso} className="flex-1 py-2 text-xs font-bold rounded-lg border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer">
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
