import React, { useState, useMemo } from "react";
import { Predio, Fracao, Conta, Movimento, Aviso, LoggedUser } from "../types";
import { 
  Sliders, 
  Wallet, 
  Building2, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  UploadCloud, 
  Sparkles, 
  FileSpreadsheet,
  Check,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  DollarSign,
  Layers
} from "lucide-react";
import { triggerSendReaction } from "./SendingReactionModal";

interface ConfiguracaoArranqueSaldosProps {
  predio: Predio;
  fracoes: Fracao[];
  contas: Conta[];
  setContas: React.Dispatch<React.SetStateAction<Conta[]>>;
  movements: Movimento[];
  setMovements: React.Dispatch<React.SetStateAction<Movimento[]>>;
  avisos: Aviso[];
  setAvisos: React.Dispatch<React.SetStateAction<Aviso[]>>;
  loggedUser: LoggedUser;
  onConcluir?: () => void;
}

export interface SaldoInicialFracao {
  id_fracao: string;
  fracao_nome: string;
  proprietario_nome: string;
  tipo_saldo: "REGULARIZADO" | "DIVIDA" | "CREDITO";
  valor_saldo: number;
  meses_atraso: number;
  observacoes: string;
}

export interface MovimentoHistoricoTransitor {
  id: string;
  data: string;
  descricao: string;
  categoria: string;
  tipo: "RECEITA" | "DESPESA";
  valor: number;
  conta: "ORDEM" | "POUPANCA" | "CAIXA";
}

export function ConfiguracaoArranqueSaldos({
  predio,
  fracoes,
  contas,
  setContas,
  movements,
  setMovements,
  avisos,
  setAvisos,
  loggedUser,
  onConcluir
}: ConfiguracaoArranqueSaldosProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);

  // --- PASSO 1: DATA E SALDOS BANCÁRIOS DE ABERTURA ---
  const [dataAbertura, setDataAbertura] = useState<string>("2026-08-01");
  const [saldoOrdem, setSaldoOrdem] = useState<string>("0.00");
  const [saldoPoupanca, setSaldoPoupanca] = useState<string>("0.00");
  const [saldoCaixa, setSaldoCaixa] = useState<string>("0.00");
  const [bancoNome, setBancoNome] = useState<string>("Millennium BCP");
  const [ibanAbertura, setIbanAbertura] = useState<string>(predio.iban || "PT50 0033 0000 1234 5678 9012 3");

  // --- PASSO 2: SALDOS INICIAIS POR FRAÇÃO (DÍVIDAS ANTERIORES) ---
  const predioFracoes = useMemo(() => fracoes.filter(f => f.id_predio === predio.id_predio), [fracoes, predio.id_predio]);

  const [saldosFracoes, setSaldosFracoes] = useState<SaldoInicialFracao[]>(() => {
    return predioFracoes.map((f) => {
      return {
        id_fracao: f.id_fracao,
        fracao_nome: f.fracao_nome,
        proprietario_nome: f.proprietario.nome,
        tipo_saldo: "REGULARIZADO",
        valor_saldo: 0,
        meses_atraso: 0,
        observacoes: ""
      };
    });
  });

  // Atualizador de linha de saldo de fração
  const handleUpdateSaldoFracao = (id_fracao: string, fields: Partial<SaldoInicialFracao>) => {
    setSaldosFracoes(prev => prev.map(s => {
      if (s.id_fracao === id_fracao) {
        const updated = { ...s, ...fields };
        if (updated.tipo_saldo === "REGULARIZADO") {
          updated.valor_saldo = 0;
          updated.meses_atraso = 0;
        }
        return updated;
      }
      return s;
    }));
  };

  // --- PASSO 3: MOVIMENTOS HISTÓRICOS DE TRANSIÇÃO (OPCIONAL) ---
  const [movimentosHistoricos, setMovimentosHistoricos] = useState<MovimentoHistoricoTransitor[]>([]);

  // Form para adicionar movimento histórico
  const [novoHistDesc, setNovoHistDesc] = useState("");
  const [novoHistCat, setNovoHistCat] = useState("Manutenção");
  const [novoHistTipo, setNovoHistTipo] = useState<"RECEITA" | "DESPESA">("DESPESA");
  const [novoHistValor, setNovoHistValor] = useState("");
  const [novoHistData, setNovoHistData] = useState("2026-07-15");

  const handleAddMovimentoHistorico = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoHistDesc || !novoHistValor) return alert("Preencha descrição e valor.");
    const novo: MovimentoHistoricoTransitor = {
      id: "hist-" + (movimentosHistoricos.length + 1),
      data: novoHistData,
      descricao: novoHistDesc,
      categoria: novoHistCat,
      tipo: novoHistTipo,
      valor: parseFloat(novoHistValor) || 0,
      conta: "ORDEM"
    };
    setMovimentosHistoricos([novo, ...movimentosHistoricos]);
    setNovoHistDesc("");
    setNovoHistValor("");
  };

  const handleRemoveMovimentoHistorico = (id: string) => {
    setMovimentosHistoricos(prev => prev.filter(m => m.id !== id));
  };

  // --- TOTAIS CALCULADOS ---
  const totalDividasReceber = useMemo(() => {
    return saldosFracoes
      .filter(s => s.tipo_saldo === "DIVIDA")
      .reduce((acc, curr) => acc + curr.valor_saldo, 0);
  }, [saldosFracoes]);

  const totalCreditosFracoes = useMemo(() => {
    return saldosFracoes
      .filter(s => s.tipo_saldo === "CREDITO")
      .reduce((acc, curr) => acc + curr.valor_saldo, 0);
  }, [saldosFracoes]);

  const totalBancosCaixa = useMemo(() => {
    const ord = parseFloat(saldoOrdem) || 0;
    const poup = parseFloat(saldoPoupanca) || 0;
    const cx = parseFloat(saldoCaixa) || 0;
    return ord + poup + cx;
  }, [saldoOrdem, saldoPoupanca, saldoCaixa]);

  const ativoLiquidoAbertura = useMemo(() => {
    return (totalBancosCaixa + totalDividasReceber) - totalCreditosFracoes;
  }, [totalBancosCaixa, totalDividasReceber, totalCreditosFracoes]);

  // --- FINALIZAR E GRAVAR NA PLATAFORMA ---
  const handleGravarConfiguracaoArranque = () => {
    triggerSendReaction("email", "A inicializar contas bancárias, dívidas e histórico de transição...");

    // 1. Atualizar ou Criar Contas Bancárias
    const contaOrdemId = "conta-ordem-" + predio.id_predio;
    const contaPoupancaId = "conta-poupanca-" + predio.id_predio;

    const novasContas: Conta[] = [
      {
        id_conta: contaOrdemId,
        id_predio: predio.id_predio,
        banco: bancoNome,
        iban: ibanAbertura,
        tipo: "Conta à Ordem",
        saldo: parseFloat(saldoOrdem) || 0,
        is_principal: true
      },
      {
        id_conta: contaPoupancaId,
        id_predio: predio.id_predio,
        banco: bancoNome,
        iban: ibanAbertura.replace("0000", "9999"),
        tipo: "Fundo Comum de Reserva",
        saldo: parseFloat(saldoPoupanca) || 0,
        is_principal: false
      }
    ];

    setContas(novasContas);

    // 2. Criar Avisos de Débito para as Frações com Dívida Inicial
    const novosAvisos: Aviso[] = [];
    saldosFracoes.forEach((sf) => {
      if (sf.tipo_saldo === "DIVIDA" && sf.valor_saldo > 0) {
        novosAvisos.push({
          id_aviso: "aviso-inicial-" + sf.id_fracao,
          id_predio: predio.id_predio,
          id_fracao: sf.id_fracao,
          tipo: "Dívida Anterior / Transição",
          data: dataAbertura,
          vencimento: dataAbertura,
          descricao: `Saldo devedor de transição (${sf.meses_atraso} meses em atraso da administração anterior). ${sf.observacoes}`,
          valor: sf.valor_saldo,
          estado: "Pendente"
        });
      }
    });

    if (novosAvisos.length > 0) {
      setAvisos(prev => [...novosAvisos, ...prev]);
    }

    // 3. Criar Movimentos de Abertura de Saldo
    const novosMovs: Movimento[] = [
      {
        id_mov: "mov-abertura-ordem-" + Date.now(),
        id_predio: predio.id_predio,
        id_conta: contaOrdemId,
        data: dataAbertura,
        tipo: "RECEITA",
        valor: parseFloat(saldoOrdem) || 0,
        descricao: "Saldo Inicial de Abertura / Transição - Conta à Ordem",
        categoria: "Saldo de Abertura"
      },
      {
        id_mov: "mov-abertura-poupanca-" + (Date.now() + 1),
        id_predio: predio.id_predio,
        id_conta: contaPoupancaId,
        data: dataAbertura,
        tipo: "RECEITA",
        valor: parseFloat(saldoPoupanca) || 0,
        descricao: "Saldo Inicial de Abertura / Transição - Fundo Comum de Reserva",
        categoria: "Fundo de Reserva"
      }
    ];

    // Inserir os movimentos históricos configurados
    movimentosHistoricos.forEach((mh, i) => {
      novosMovs.push({
        id_mov: "mov-hist-" + (Date.now() + 2 + i),
        id_predio: predio.id_predio,
        id_conta: contaOrdemId,
        data: mh.data,
        tipo: mh.tipo,
        valor: mh.valor,
        descricao: mh.descricao,
        categoria: mh.categoria
      });
    });

    setMovements(prev => [...novosMovs, ...prev]);

    setTimeout(() => {
      triggerSendReaction("email", "✅ Arranque Inicial do Condomínio configurado e ativado com sucesso!");
      if (onConcluir) onConcluir();
    }, 800);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* BANNER DE CABEÇALHO */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-5 sm:p-7 rounded-2xl shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 shadow-inner">
              <Sliders className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Assistente de Arranque Inicial & Transição de Gestão
                <span className="text-xs px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 font-bold rounded-full border border-emerald-500/30">
                  Balanço de Abertura
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Defina os saldos bancários de abertura, as dívidas transitadas por fração e o histórico inicial de movimentos sem fricção.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 bg-slate-950/60 px-4 py-2 rounded-xl border border-slate-800">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Ativo Líquido de Arranque</span>
              <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">
                {ativoLiquidoAbertura.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €
              </span>
            </div>
          </div>
        </div>

        {/* STEPPER INDICATOR */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-3 mt-6 pt-4 border-t border-slate-800">
          {[
            { step: 1, label: "1. Saldos Bancários", desc: "Contas & Caixa" },
            { step: 2, label: "2. Dívidas por Fração", desc: "Mapa de Transição" },
            { step: 3, label: "3. Movimentos Anteriores", desc: "Histórico Orçamental" },
            { step: 4, label: "4. Balanço & Conclusão", desc: "Ativação do Edifício" }
          ].map((s) => {
            const isActive = currentStep === s.step;
            const isCompleted = currentStep > s.step;
            return (
              <button
                key={s.step}
                onClick={() => setCurrentStep(s.step)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center space-x-2.5 ${
                  isActive
                    ? "bg-emerald-600 text-white font-black border-emerald-500 shadow-md ring-1 ring-emerald-400"
                    : isCompleted
                    ? "bg-slate-900/80 text-emerald-400 border-emerald-500/40"
                    : "bg-slate-950/40 text-slate-400 border-slate-800 hover:bg-slate-900/60"
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isActive ? "bg-white text-emerald-700" : isCompleted ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                }`}>
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : s.step}
                </span>
                <div className="min-w-0">
                  <span className="text-xs font-bold block truncate">{s.label}</span>
                  <span className="text-[9px] opacity-80 block truncate">{s.desc}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PASSO 1: DATA DE TRANSIÇÃO E SALDOS BANCÁRIOS */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                Passo 1: Data de Início & Saldos Iniciais das Contas
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Introduza os montantes reais que transitam da administração anterior ou do extrato bancário oficial.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-300 dark:border-amber-800">
              Ponto Zero de Tesouraria
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Data de Abertura / Transição
              </label>
              <input
                type="date"
                value={dataAbertura}
                onChange={(e) => setDataAbertura(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Instituição Bancária
              </label>
              <input
                type="text"
                value={bancoNome}
                onChange={(e) => setBancoNome(e.target.value)}
                placeholder="Ex: Millennium BCP, CGD, Santander"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                IBAN Oficial da Conta do Condomínio
              </label>
              <input
                type="text"
                value={ibanAbertura}
                onChange={(e) => setIbanAbertura(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-indigo-600 dark:text-indigo-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase">1. Conta à Ordem</span>
                <Wallet className="h-4 w-4 text-indigo-500" />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Saldo disponível para gestão corrente e despesas ordinárias.</p>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={saldoOrdem}
                  onChange={(e) => setSaldoOrdem(e.target.value)}
                  className="w-full pl-3 pr-8 py-2.5 text-sm font-black text-indigo-700 dark:text-indigo-300 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 font-mono"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-indigo-500">€</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase">2. Fundo de Reserva</span>
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Saldo em conta poupança legal (mínimo 10% do orçamento).</p>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={saldoPoupanca}
                  onChange={(e) => setSaldoPoupanca(e.target.value)}
                  className="w-full pl-3 pr-8 py-2.5 text-sm font-black text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 font-mono"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-emerald-500">€</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase">3. Caixa de Numerário</span>
                <DollarSign className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Valores em dinheiro físico na posse da administração.</p>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={saldoCaixa}
                  onChange={(e) => setSaldoCaixa(e.target.value)}
                  className="w-full pl-3 pr-8 py-2.5 text-sm font-black text-amber-700 dark:text-amber-300 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 font-mono"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-amber-500">€</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-all flex items-center space-x-2 shadow-md cursor-pointer hover:scale-105"
            >
              <span>Avançar para Passo 2 (Dívidas por Fração)</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASSO 2: MAPA DE SALDOS INICIAIS POR FRAÇÃO (DÍVIDAS ANTERIORES) */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                Passo 2: Mapa de Saldos Iniciais por Fração
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Indique para cada condómino se tem dívidas transitadas, créditos adiantados ou situação regularizada.
              </p>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <div className="px-3 py-1 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 font-bold">
                Dívidas a Receber: {totalDividasReceber.toFixed(2)} €
              </div>
              <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800 font-bold">
                Créditos: {totalCreditosFracoes.toFixed(2)} €
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] font-extrabold">
                  <th className="p-3">Fração / Condómino</th>
                  <th className="p-3">Estado Inicial</th>
                  <th className="p-3">Valor do Saldo (€)</th>
                  <th className="p-3">Meses em Atraso</th>
                  <th className="p-3">Observações / Detalhe da Transição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {saldosFracoes.map((sf) => {
                  return (
                    <tr key={sf.id_fracao} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-medium">
                        <span className="font-bold text-slate-900 dark:text-white block">{sf.fracao_nome}</span>
                        <span className="text-[10px] text-slate-400">{sf.proprietario_nome}</span>
                      </td>

                      <td className="p-3">
                        <select
                          value={sf.tipo_saldo}
                          onChange={(e) => handleUpdateSaldoFracao(sf.id_fracao, { tipo_saldo: e.target.value as any })}
                          className={`px-2.5 py-1.5 text-xs rounded-xl font-bold border transition-colors ${
                            sf.tipo_saldo === "DIVIDA"
                              ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800"
                              : sf.tipo_saldo === "CREDITO"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                              : "bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <option value="REGULARIZADO">Regularizado (0.00€)</option>
                          <option value="DIVIDA">⚠️ Com Dívida Anterior</option>
                          <option value="CREDITO">✨ Crédito / Adiantado</option>
                        </select>
                      </td>

                      <td className="p-3">
                        {sf.tipo_saldo !== "REGULARIZADO" ? (
                          <div className="relative w-28">
                            <input
                              type="number"
                              step="0.01"
                              value={sf.valor_saldo || ""}
                              onChange={(e) => handleUpdateSaldoFracao(sf.id_fracao, { valor_saldo: parseFloat(e.target.value) || 0 })}
                              className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                            />
                            <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-bold">€</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono font-medium">0,00 €</span>
                        )}
                      </td>

                      <td className="p-3">
                        {sf.tipo_saldo === "DIVIDA" ? (
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={sf.meses_atraso || 1}
                            onChange={(e) => handleUpdateSaldoFracao(sf.id_fracao, { meses_atraso: parseInt(e.target.value) || 1 })}
                            className="w-16 px-2 py-1.5 text-xs text-center font-bold rounded-xl border border-red-300 dark:border-red-800 bg-white dark:bg-slate-950 text-red-600"
                          />
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="p-3">
                        <input
                          type="text"
                          value={sf.observacoes}
                          onChange={(e) => handleUpdateSaldoFracao(sf.id_fracao, { observacoes: e.target.value })}
                          placeholder="Notas da administração anterior..."
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar aos Saldos Bancários</span>
            </button>

            <button
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-all flex items-center space-x-2 shadow-md cursor-pointer hover:scale-105"
            >
              <span>Avançar para Passo 3 (Movimentos Anteriores)</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASSO 3: MOVIMENTOS ANTERIORES & HISTÓRICO ORÇAMENTAL */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                Passo 3: Movimentos Anteriores & Execução do Ano Corrente
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Adicione despesas ou receitas passadas dos últimos meses para que os balancetes anuais fiquem 100% completos.
              </p>
            </div>

            <span className="text-xs font-bold px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800">
              {movimentosHistoricos.length} Movimentos Registados
            </span>
          </div>

          {/* FORMULÁRIO DE ADIÇÃO RÁPIDA */}
          <form onSubmit={handleAddMovimentoHistorico} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data</label>
              <input
                type="date"
                value={novoHistData}
                onChange={(e) => setNovoHistData(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descrição do Movimento</label>
              <input
                type="text"
                placeholder="Ex: Seguro Multirriscos Edifício, Água SMAS"
                value={novoHistDesc}
                onChange={(e) => setNovoHistDesc(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo & Categoria</label>
              <select
                value={novoHistTipo}
                onChange={(e) => setNovoHistTipo(e.target.value as any)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
              >
                <option value="DESPESA">Despesa (-)</option>
                <option value="RECEITA">Receita (+)</option>
              </select>
            </div>
            <div className="flex items-end space-x-2">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Valor (€)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={novoHistValor}
                  onChange={(e) => setNovoHistValor(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </form>

          {/* LISTAGEM DE MOVIMENTOS HISTÓRICOS */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] font-extrabold">
                  <th className="p-2.5">Data</th>
                  <th className="p-2.5">Descrição</th>
                  <th className="p-2.5">Categoria</th>
                  <th className="p-2.5">Tipo</th>
                  <th className="p-2.5 text-right">Valor</th>
                  <th className="p-2.5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {movimentosHistoricos.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-2.5 font-mono text-[11px] text-slate-500">{m.data}</td>
                    <td className="p-2.5 font-bold text-slate-800 dark:text-white">{m.descricao}</td>
                    <td className="p-2.5 text-slate-500">{m.categoria}</td>
                    <td className="p-2.5">
                      <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                        m.tipo === "RECEITA" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                      }`}>
                        {m.tipo}
                      </span>
                    </td>
                    <td className={`p-2.5 text-right font-mono font-bold ${
                      m.tipo === "RECEITA" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"
                    }`}>
                      {m.tipo === "DESPESA" ? "-" : "+"}{m.valor.toFixed(2)} €
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => handleRemoveMovimentoHistorico(m.id)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar às Dívidas</span>
            </button>

            <button
              onClick={() => setCurrentStep(4)}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-all flex items-center space-x-2 shadow-md cursor-pointer hover:scale-105"
            >
              <span>Avançar para Balanço & Conclusão</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASSO 4: BALANÇO CONSOLIDADO & ATIVAÇÃO DEFINITIVA */}
      {/* ========================================================================= */}
      {currentStep === 4 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                Passo 4: Resumo Consolidado do Balanço de Abertura
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Reveja todos os valores antes de ativar a gestão do condomínio no sistema.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-300 dark:border-emerald-800">
              Pronto a Ativar
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Saldo Total Bancos / Caixa</span>
              <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono mt-1 block">
                {totalBancosCaixa.toFixed(2)} €
              </span>
              <span className="text-[9.5px] text-slate-500 mt-1 block">Ordem ({saldoOrdem}€) + Reserva ({saldoPoupanca}€)</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Dívidas Transitadas a Cobrar</span>
              <span className="text-lg font-black text-red-600 dark:text-red-400 font-mono mt-1 block">
                +{totalDividasReceber.toFixed(2)} €
              </span>
              <span className="text-[9.5px] text-slate-500 mt-1 block">
                {saldosFracoes.filter(s => s.tipo_saldo === "DIVIDA").length} frações devedoras
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Créditos de Condóminos</span>
              <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono mt-1 block">
                -{totalCreditosFracoes.toFixed(2)} €
              </span>
              <span className="text-[9.5px] text-slate-500 mt-1 block">
                {saldosFracoes.filter(s => s.tipo_saldo === "CREDITO").length} frações com crédito
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">Ativo Líquido Inicial</span>
              <span className="text-lg font-black text-emerald-700 dark:text-emerald-300 font-mono mt-1 block">
                {ativoLiquidoAbertura.toFixed(2)} €
              </span>
              <span className="text-[9.5px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 block">Património total em gestão</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 text-xs text-slate-700 dark:text-slate-300 space-y-2">
            <h4 className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              O que acontecerá ao gravar:
            </h4>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
              <li>As contas <strong>Conta à Ordem</strong> ({saldoOrdem} €) e <strong>Fundo Comum de Reserva</strong> ({saldoPoupanca} €) serão atualizadas com os saldos exatos.</li>
              <li>Serão criados automaticamente os <strong>Avisos de Cobrança / Dívida de Transição</strong> para as frações devedoras no módulo Financeiro & Contencioso.</li>
              <li>Os {movimentosHistoricos.length} movimentos anteriores ficarão disponíveis em balancetes, extratos e relatórios de auditoria.</li>
            </ul>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setCurrentStep(3)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar aos Movimentos</span>
            </button>

            <button
              onClick={handleGravarConfiguracaoArranque}
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs transition-all flex items-center space-x-2 shadow-lg hover:scale-105 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>Gravar Balanço de Abertura & Ativar Condomínio</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
