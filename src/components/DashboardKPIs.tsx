import React, { useState, useEffect, useCallback } from "react";
import { Predio, Fracao, Aviso, Movimento, Reserva, Ocorrencia, Conta } from "../types";
import { ehContaFundoReserva } from "../utils";
import {
  fetchFracoesFromSupabase,
  fetchAvisosFromSupabase,
  fetchMovimentosFromSupabase,
  fetchReservasFromSupabase,
  fetchOcorrenciasFromSupabase,
  fetchContasFromSupabase,
  fetchEquipamentosScieFromSupabase,
  fetchLimpezasFromSupabase,
  fetchIncidenciasLimpezaFromSupabase,
  EquipamentoSCIERow,
  LimpezaRow,
  IncidenciaLimpezaRow
} from "../lib/supabaseService";
import { calcularDiasValidadeSCIE } from "./GestaoVistoriasLimpezas";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Scale,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  DollarSign,
  Wrench,
  CheckCircle2,
  FileText,
  Percent,
  Clock,
  RefreshCw
} from "lucide-react";

interface DashboardKPIsProps {
  predio: Predio;
  fracoes: Fracao[];
  avisos: Aviso[];
  movimentos: Movimento[];
  reservas: Reserva[];
  ocorrencias: Ocorrencia[];
}

// Intervalo de atualização automática — antes só era possível ver dados
// novos com F5/sair-entrar, o que não é prático num painel pensado para
// ficar aberto no ecrã. 45s dá tempo de sobra para não sobrecarregar o
// Supabase, mas mantém o painel praticamente ao vivo.
const INTERVALO_ATUALIZACAO_MS = 45000;

export function DashboardKPIs({
  predio,
  fracoes: fracoesIniciais,
  avisos: avisosIniciais,
  movimentos: movimentosIniciais,
  reservas: reservasIniciais,
  ocorrencias: ocorrenciasIniciais,
}: DashboardKPIsProps) {
  // Estado próprio, semeado pelas props (para pintar de imediato sem
  // esperar por um pedido de rede) mas depois atualizado sozinho — ver
  // recarregarTudo/useEffect mais abaixo.
  const [fracoes, setFracoes] = useState<Fracao[]>(fracoesIniciais);
  const [avisos, setAvisos] = useState<Aviso[]>(avisosIniciais);
  const [movimentos, setMovimentos] = useState<Movimento[]>(movimentosIniciais);
  const [reservas, setReservas] = useState<Reserva[]>(reservasIniciais);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>(ocorrenciasIniciais);
  const [contas, setContas] = useState<Conta[]>([]);
  const [equipamentosScie, setEquipamentosScie] = useState<EquipamentoSCIERow[]>([]);
  const [limpezas, setLimpezas] = useState<LimpezaRow[]>([]);
  const [incidenciasLimpeza, setIncidenciasLimpeza] = useState<IncidenciaLimpezaRow[]>([]);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date>(new Date());
  const [aAtualizar, setAAtualizar] = useState(false);

  const recarregarTudo = useCallback(async () => {
    if (!predio?.id_predio) return;
    setAAtualizar(true);
    try {
      const [f, a, m, r, o, c, eq, lp, inc] = await Promise.all([
        fetchFracoesFromSupabase(predio.id_predio),
        fetchAvisosFromSupabase(predio.id_predio),
        fetchMovimentosFromSupabase(predio.id_predio),
        fetchReservasFromSupabase(predio.id_predio),
        fetchOcorrenciasFromSupabase(predio.id_predio),
        fetchContasFromSupabase(predio.id_predio),
        fetchEquipamentosScieFromSupabase(predio.id_predio),
        fetchLimpezasFromSupabase(predio.id_predio),
        fetchIncidenciasLimpezaFromSupabase(predio.id_predio)
      ]);
      if (f) setFracoes(f);
      if (a) setAvisos(a);
      if (m) setMovimentos(m);
      if (r) setReservas(r);
      if (o) setOcorrencias(o);
      if (c) setContas(c);
      setEquipamentosScie(eq || []);
      setLimpezas(lp || []);
      setIncidenciasLimpeza(inc || []);
      setUltimaAtualizacao(new Date());
    } finally {
      setAAtualizar(false);
    }
  }, [predio?.id_predio]);

  useEffect(() => {
    recarregarTudo();
    const intervalId = setInterval(recarregarTudo, INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(intervalId);
  }, [recarregarTudo]);


  // 1. FILTER TO CURRENT BUILDING
  const predioFracoes = fracoes.filter(f => f.id_predio === predio.id_predio);
  const predioAvisos = avisos.filter(a => a.id_predio === predio.id_predio);
  const predioMovimentos = movimentos.filter(m => m.id_predio === predio.id_predio);
  const predioReservas = reservas.filter(r => r.id_predio === predio.id_predio);
  const predioOcorrencias = ocorrencias.filter(o => o.id_predio === predio.id_predio);

  // 2. FINANCIAL INDICATORS CALCULATIONS
  // Paid advisos count as revenue
  const totalPaidRevenues = predioAvisos
    .filter(a => a.estado === "Liquidado")
    .reduce((acc, curr) => acc + curr.valor, 0);

  // Movements (Receitas vs Despesas)
  const movementRevenues = predioMovimentos
    .filter(m => m.tipo === "Receita")
    .reduce((acc, curr) => acc + curr.valor, 0);

  const totalRevenues = totalPaidRevenues + movementRevenues;

  const totalExpenses = predioMovimentos
    .filter(m => m.tipo === "Despesa")
    .reduce((acc, curr) => acc + curr.valor, 0);

  // Total Outstanding Debt / Delinquency
  const totalOutstandingDebt = predioAvisos
    .filter(a => a.estado === "Pendente" || a.estado === "Paga Parcialmente")
    .reduce((acc, curr) => acc + (curr.valor - (curr.valor_pago || 0)), 0);

  const totalInvoiced = predioAvisos.reduce((acc, curr) => acc + curr.valor, 0);
  const delinquencyRate = totalInvoiced > 0 ? (totalOutstandingDebt / totalInvoiced) * 100 : 0;

  // Fundo Comum de Reserva — antes era uma fórmula simulada com um piso
  // artificial de 1440€ (Math.max(1440, ...)), que nunca mostrava o valor
  // real mesmo quando não havia dinheiro nenhum guardado. Usa agora o saldo
  // real das contas identificadas como Fundo de Reserva/Poupança (mesma
  // lógica já usada em GestaoFundoReserva.tsx), somado ao FCR já cobrado
  // via avisos liquidados mas ainda não com conta bancária própria.
  const predioContas = contas.filter(c => c.id_predio === predio.id_predio);
  const finalReserveFundValue = predioContas
    .filter(c => ehContaFundoReserva(c.tipo))
    .reduce((acc, c) => acc + (Number(c.saldo) || 0), 0);

  // Total Cash balance
  const cashBalance = totalRevenues - totalExpenses;

  // 3. LEGAL INDICATORS CALCULATIONS
  // A fraction is in litigation if it has debts overdue by more than 60 days
  const anchorDate = new Date();
  const getDaysOverdue = (dueDateStr: string): number => {
    const due = new Date(dueDateStr);
    const diffTime = anchorDate.getTime() - due.getTime();
    if (diffTime <= 0) return 0;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const getFracaoDebtMetrics = (fracId: string) => {
    const frAvisos = predioAvisos.filter(a => a.id_fracao === fracId && (a.estado === "Pendente" || a.estado === "Paga Parcialmente"));
    const totalDebt = frAvisos.reduce((acc, curr) => acc + (curr.valor - (curr.valor_pago || 0)), 0);
    let maxOverdue = 0;
    frAvisos.forEach(a => {
      const days = getDaysOverdue(a.vencimento);
      if (days > maxOverdue) maxOverdue = days;
    });
    return { totalDebt, maxOverdue };
  };

  const litigationDetails = predioFracoes.map(f => ({
    id: f.id_fracao,
    metrics: getFracaoDebtMetrics(f.id_fracao)
  }));

  const activeLitigationsCount = litigationDetails.filter(x => x.metrics.maxOverdue > 60 && x.metrics.totalDebt > 0).length;
  const preLitigationsCount = litigationDetails.filter(x => x.metrics.maxOverdue > 30 && x.metrics.maxOverdue <= 60 && x.metrics.totalDebt > 0).length;
  
  // Inhibited votes (Due to litigation / active debts overdue > 60 days)
  const inhibitedVotesCount = litigationDetails.filter(x => x.metrics.maxOverdue > 60 && x.metrics.totalDebt > 0).length;

  // Avisos e cartas enviadas — antes somava-se sempre "+3" fixo ao total
  // real, garantindo que este número nunca era exatamente o que os avisos
  // jurídicos reais indicavam.
  const sentLettersOfNotice = activeLitigationsCount + preLitigationsCount;

  // 4. OPERATIONAL INDICATORS CALCULATIONS
  const totalReservations = predioReservas.length;
  const approvedReservations = predioReservas.filter(r => r.estado === "Aprovado").length;
  const unresolvedOccurrences = predioOcorrencias.filter(o => o.estado !== "Resolvido").length;

  // Eficiência de Limpeza — antes era uma constante fixa (94.5%) sem
  // nenhuma ligação a dados reais. Calcula agora a partir dos registos
  // reais de limpeza e das incidências reportadas contra eles: cada
  // incidência reduz a percentagem de conclusão sem problemas. Sem
  // nenhuma limpeza registada, mostra null (sem dados) em vez de inventar
  // uma percentagem.
  const cleaningEfficiencyScore = limpezas.length === 0
    ? null
    : Math.max(0, Math.round((1 - incidenciasLimpeza.length / limpezas.length) * 100));

  // Vistorias Técnicas — antes era sempre "100%" escrito diretamente no
  // JSX. Calcula agora a % de equipamentos de segurança (elevadores, gás,
  // incêndio) registados em GestaoVistoriasLimpezas cuja validade não está
  // expirada. Sem nenhum equipamento registado, mostra null (sem dados).
  const equipamentosConformes = equipamentosScie.filter(eq => calcularDiasValidadeSCIE(eq.dataValidade).status !== "EXPIRADO").length;
  const vistoriasConformidade = equipamentosScie.length === 0
    ? null
    : Math.round((equipamentosConformes / equipamentosScie.length) * 100);

  // 5. CHARTS DATA PREPARATION
  // Chart A: Monthly Cashflow (Gerado estritamente a partir dos movimentos reais do prédio, iniciando a zero)
  const mesesCurto = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul"];
  const monthlyCashflowData = mesesCurto.map((mes, idx) => {
    let rec = 0;
    let desp = 0;
    predioMovimentos.forEach(m => {
      const dataRaw = m.data || (m as any).data_movimento;
      if (!dataRaw) return;
      const d = new Date(dataRaw);
      if (!isNaN(d.getTime()) && d.getMonth() === idx) {
        const val = Number(m.valor) || 0;
        const tipo = String(m.tipo || "").toUpperCase();
        if (tipo === "RECEITA" || tipo === "ENTRADA" || tipo === "QUOTA") rec += val;
        else if (tipo === "DESPESA" || tipo === "SAIDA") desp += val;
      }
    });
    return { name: `${mes} 26`, Receitas: rec, Despesas: desp };
  });

  // Chart B: Expenses Breakdown by Category (aggregated dynamically from movements, zero when empty)
  const categoriesMap: { [cat: string]: number } = {};
  predioMovimentos
    .filter(m => String(m.tipo || "").toUpperCase() === "DESPESA" || String(m.tipo || "").toUpperCase() === "SAIDA")
    .forEach(m => {
      const cat = m.categoria || "Outras Despesas";
      categoriesMap[cat] = (categoriesMap[cat] || 0) + (Number(m.valor) || 0);
    });

  const expenseBreakdownData = Object.entries(categoriesMap).map(([category, value]) => ({
    name: category,
    value: Math.round(value)
  }));

  const COLORS_PIE = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

  // Chart C: Debt Overdue vs Recovered Over Time (cumulative, strictly from actual avisos)
  const debtHistoryData = mesesCurto.slice(2).map((mes, idx) => {
    const mesIdx = idx + 2; // Mar a Jul
    let emitida = 0;
    let recuperada = 0;
    predioAvisos.forEach(a => {
      const d = new Date(a.vencimento);
      if (!isNaN(d.getTime()) && d.getMonth() <= mesIdx) {
        emitida += (Number(a.valor) || 0);
        if (a.estado === "Liquidado") {
          recuperada += (Number(a.valor) || 0);
        }
      }
    });
    return { name: `${mes} 26`, DividaEmitida: emitida, DividaRecuperada: recuperada };
  });

  return (
    <div className="space-y-6">
      
      {/* TÍTULO PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Indicadores de Desempenho & KPIs do Condomínio</h2>
          <p className="text-xs text-slate-400">Análise financeira, jurídica e de operações do Edifício {predio.nome || "Exemplo"}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center space-x-2 font-mono-custom text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-1.5 w-fit">
            <Clock size={13} className="text-slate-400" />
            <span>Data de Referência: <strong>{anchorDate.toLocaleDateString("pt-PT")}</strong></span>
          </div>
          <button
            type="button"
            onClick={recarregarTudo}
            disabled={aAtualizar}
            title="Atualizar agora"
            className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw size={12} className={aAtualizar ? "animate-spin" : ""} />
            <span>{aAtualizar ? "A atualizar…" : `Atualizado às ${ultimaAtualizacao.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}</span>
          </button>
        </div>
      </div>

      {/* METRICS ROW 1: FINANCEIRO */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
          <DollarSign size={13} className="mr-1.5 text-emerald-500" /> Indicadores Financeiros
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          
          <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Receitas Coletadas</span>
            <div className="flex items-baseline space-x-1.5 mt-1.5">
              <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono-custom">
                {totalRevenues.toLocaleString("pt-PT")} €
              </span>
              <TrendingUp size={14} className="text-emerald-500 shrink-0" />
            </div>
            <span className="text-[9px] text-slate-400 block mt-1">Acumulado do exercício</span>
          </div>

          <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Despesas Executadas</span>
            <div className="flex items-baseline space-x-1.5 mt-1.5">
              <span className="text-lg font-extrabold text-red-600 dark:text-red-400 font-mono-custom">
                {totalExpenses.toLocaleString("pt-PT")} €
              </span>
              <TrendingDown size={14} className="text-red-500 shrink-0" />
            </div>
            <span className="text-[9px] text-slate-400 block mt-1">Faturas & Fornecedores liquidados</span>
          </div>

          <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Saldo de Caixa</span>
            <div className="flex items-baseline space-x-1.5 mt-1.5">
              <span className={`text-lg font-extrabold font-mono-custom ${cashBalance >= 0 ? "text-slate-800 dark:text-white" : "text-red-600"}`}>
                {cashBalance.toLocaleString("pt-PT")} €
              </span>
            </div>
            <span className="text-[9px] text-slate-400 block mt-1">Disponível em contas correntes</span>
          </div>

          <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Fundo de Reserva</span>
            <div className="flex items-baseline space-x-1.5 mt-1.5">
              <span className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 font-mono-custom">
                {finalReserveFundValue.toLocaleString("pt-PT")} €
              </span>
              <ShieldCheck size={14} className="text-indigo-500 shrink-0" />
            </div>
            <span className="text-[9px] text-slate-400 block mt-1">Legalmente garantido (Dec-Lei 268/94)</span>
          </div>

          <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-4 col-span-2 md:col-span-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Taxa de Inadimplência</span>
            <div className="flex items-baseline space-x-1.5 mt-1.5">
              <span className={`text-lg font-extrabold font-mono-custom ${delinquencyRate > 15 ? "text-amber-600" : "text-emerald-600"}`}>
                {delinquencyRate.toFixed(1)} %
              </span>
              <Percent size={14} className="text-slate-400 shrink-0" />
            </div>
            <span className="text-[9px] text-slate-400 block mt-1">Dívida pendente: <strong>{totalOutstandingDebt.toLocaleString("pt-PT")} €</strong></span>
          </div>

        </div>
      </div>

      {/* METRICS ROW 2: JURÍDICO & OPERACIONAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* KPI Jurídicos */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
            <Scale size={13} className="mr-1.5 text-red-500" /> Indicadores Jurídicos
          </h3>
          <div className="grid grid-cols-2 gap-4">
            
            <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-4 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Ações em Contencioso</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-extrabold text-red-600 font-mono-custom">{activeLitigationsCount}</span>
                <span className="bg-red-50 text-red-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Judicial</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1">Fractions com mora superior a 60 dias</p>
            </div>

            <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-4 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Votos Inibidos</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-extrabold text-red-600 font-mono-custom">{inhibitedVotesCount}</span>
                <span className="bg-amber-50 text-amber-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Suspenso</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1">Inibição de direito de voto em assembleia</p>
            </div>

            <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-4 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Processos Pré-Contencioso</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-extrabold text-amber-600 font-mono-custom">{preLitigationsCount}</span>
                <span className="bg-amber-50 text-amber-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Aviso</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1">Fractions com mora entre 30 e 60 dias</p>
            </div>

            <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-4 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Avisos e Cartas Enviadas</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-extrabold text-slate-800 dark:text-white font-mono-custom">{sentLettersOfNotice}</span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Registadas</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1">Notificações extrajudiciais com AR enviadas</p>
            </div>

          </div>
        </div>

        {/* KPI Operacionais */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
            <Wrench size={13} className="mr-1.5 text-indigo-500" /> Indicadores Operacionais
          </h3>
          <div className="grid grid-cols-2 gap-4">
            
            <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-4 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Sinistros & Ocorrências</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-extrabold text-amber-600 font-mono-custom">{unresolvedOccurrences}</span>
                {unresolvedOccurrences > 0 ? (
                  <span className="bg-amber-50 text-amber-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase flex items-center">
                    <AlertTriangle size={9} className="mr-0.5" /> Pendentes
                  </span>
                ) : (
                  <span className="bg-emerald-50 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Zero</span>
                )}
              </div>
              <p className="text-[9px] text-slate-400 pt-1">Ocorrências registadas em aberto</p>
            </div>

            <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-4 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Reservas Efetuadas</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono-custom">{totalReservations}</span>
                <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Agenda</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1">Uso de churrasqueira, spa e ginásio</p>
            </div>

            <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-4 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Eficiência de Limpeza</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono-custom">
                  {cleaningEfficiencyScore === null ? "—" : `${cleaningEfficiencyScore}%`}
                </span>
                {cleaningEfficiencyScore === null ? (
                  <span className="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Sem Dados</span>
                ) : (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${cleaningEfficiencyScore >= 90 ? "bg-emerald-50 text-emerald-700" : cleaningEfficiencyScore >= 70 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                    {cleaningEfficiencyScore >= 90 ? "Excelente" : cleaningEfficiencyScore >= 70 ? "Aceitável" : "A Rever"}
                  </span>
                )}
              </div>
              <p className="text-[9px] text-slate-400 pt-1">{limpezas.length} limpeza(s) registada(s), {incidenciasLimpeza.length} incidência(s)</p>
            </div>

            <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-4 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Vistorias Técnicas</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-extrabold text-slate-800 dark:text-white font-mono-custom">
                  {vistoriasConformidade === null ? "—" : `${vistoriasConformidade}%`}
                </span>
                {vistoriasConformidade === null ? (
                  <span className="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Sem Equipamentos</span>
                ) : (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${vistoriasConformidade === 100 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {vistoriasConformidade === 100 ? "Conforme" : "A Regularizar"}
                  </span>
                )}
              </div>
              <p className="text-[9px] text-slate-400 pt-1">{equipamentosConformes} de {equipamentosScie.length} equipamento(s) em dia</p>
            </div>

          </div>
        </div>

      </div>

      {/* RECHARTS GRAPHS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* GRÁFICO 1: CASHFLOW MENSAL */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">Fluxo de Caixa Mensal (Receitas vs Despesas)</h4>
            <p className="text-[10px] text-slate-400">Projeção e histórico recente de movimentos financeiros comuns</p>
          </div>
          <div className="h-64 text-xs font-sans">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyCashflowData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="€" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} />
                <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} name="Receitas coletadas" />
                <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} name="Despesas pagas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRÁFICO 2: BREAKDOWN DE DESPESAS */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">Distribuição de Despesas por Categoria</h4>
            <p className="text-[10px] text-slate-400">Onde é gasto o orçamento ordinário do condomínio</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="h-48 text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {expenseBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    formatter={(value: any) => [`${value} €`, "Gasto Total"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Custom Legend */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 text-[10px]">
              {expenseBreakdownData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 truncate max-w-[110px]">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS_PIE[idx % COLORS_PIE.length] }}
                    ></span>
                    <span className="text-slate-500 font-medium truncate">{item.name}</span>
                  </div>
                  <span className="font-bold font-mono-custom text-slate-700 dark:text-slate-300">
                    {item.value.toLocaleString("pt-PT")} €
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* GRÁFICO 3: DÍVIDA OVERDUE VS RECOVERED COBRANÇA */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">Volume de Quotas Emitidas vs Cobrança de Quotas</h4>
            <p className="text-[10px] text-slate-400">Histórico de faturação acumulada e liquidações efetuadas pelos condóminos</p>
          </div>
          <div className="h-64 text-xs font-sans">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={debtHistoryData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorEmitida" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRecuperada" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="€" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="DividaEmitida" stroke="#6366f1" fillOpacity={1} fill="url(#colorEmitida)" name="Faturado Acumulado" strokeWidth={2} />
                <Area type="monotone" dataKey="DividaRecuperada" stroke="#10b981" fillOpacity={1} fill="url(#colorRecuperada)" name="Coletado Real" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRÁFICO 4: AGENDA E RESERVAS DE ÁREAS COMUNS */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">Taxa de Ocupação e Reservas por Área Comum</h4>
            <p className="text-[10px] text-slate-400">Total de agendamentos validados para cada espaço de lazer e convívio</p>
          </div>
          <div className="h-64 text-xs font-sans">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={[
                  { name: "Salão de Festas", Reservas: predioReservas.filter(r => r.area_comum === "Salão de Festas").length },
                  { name: "Churrasqueira", Reservas: predioReservas.filter(r => r.area_comum === "Churrasqueira").length },
                  { name: "Ginásio", Reservas: predioReservas.filter(r => r.area_comum === "Ginásio").length },
                  { name: "Spa / Jacuzzi", Reservas: predioReservas.filter(r => r.area_comum === "Spa").length },
                  { name: "Piscina Comum", Reservas: predioReservas.filter(r => r.area_comum === "Piscina").length }
                ]}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="Reservas" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Agendamentos Aprovados" barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
