import React, { useMemo } from "react";
import { Predio, Conta, Fracao, Movimento, Aviso } from "../types";
import { exportToXLS } from "../utils";
import { 
  Building, DoorOpen, Users, FileText, Hammer, Brush, 
  Wallet, Truck, MessageSquare, Brain, Sparkles, 
  AlertTriangle, BarChart2
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

interface PainelControloProps {
  predio: Predio;
  predios?: Predio[];
  contas: Conta[];
  fracoes: Fracao[];
  movements: Movimento[];
  avisos: Aviso[];
  documentosCount?: number;
  fornecedoresCount?: number;
  obrasCount?: number;
  limpezasCount?: number;
  alertasJuridicosCount?: number;
  sondagensCount?: number;
  ocorrenciasCount?: number;
  reservasCount?: number;
  mensagensCount?: number;
  notificacoesCount?: number;
  onSelectSection?: (section: string) => void;
}

export function PainelControlo({ 
  predio, 
  predios = [],
  contas, 
  fracoes, 
  movements, 
  avisos,
  documentosCount = 0,
  fornecedoresCount = 0,
  obrasCount = 0,
  limpezasCount = 0,
  alertasJuridicosCount = 0,
  sondagensCount = 0,
  ocorrenciasCount = 0,
  reservasCount = 0,
  mensagensCount = 0,
  notificacoesCount = 0,
  onSelectSection
}: PainelControloProps) {

  // Global list references derived from props
  const predioFracoes = fracoes.filter(f => f.id_predio === predio?.id_predio);
  const predioMovements = movements.filter(m => m.id_predio === predio?.id_predio);
  const predioAvisos = avisos.filter(a => a.id_predio === predio?.id_predio);

  // Dynamic buildings count (0 if empty or provisional temporary placeholder)
  const totalPrediosReais = predios.filter(p => p.id_predio && p.id_predio !== "predio-temp").length;

  // Calculate dynamic stats
  const totalFundoReserva = predioMovements
    .filter(m => m.categoria === "Fundo de Reserva")
    .reduce((acc, curr) => acc + (curr.tipo === "Receita" || curr.tipo === "RECEITA" ? curr.valor : -curr.valor), 0);

  const totalSaldoCaixa = predioMovements
    .reduce((acc, curr) => acc + (curr.tipo === "Receita" || curr.tipo === "RECEITA" ? curr.valor : -curr.valor), 0);

  // Gráfico inicial dinâmico gerado conforme os saldos vs despesas reais do prédio (a zero se sem movimentos)
  const chartData = useMemo(() => {
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const baseMeses = meses.slice(0, 7).map((mesNome, index) => ({
      name: mesNome,
      mesIndex: index,
      Receitas: 0,
      Despesas: 0,
      Saldo: 0
    }));

    if (!predioMovements || predioMovements.length === 0) {
      return baseMeses;
    }

    predioMovements.forEach(m => {
      const dataRaw = m.data || (m as any).data_movimento;
      if (!dataRaw) return;
      const dataObj = new Date(dataRaw);
      if (isNaN(dataObj.getTime())) return;

      const mesIdx = dataObj.getMonth();
      if (mesIdx >= 0 && mesIdx < 7) {
        const val = Number(m.valor) || 0;
        const tipoNorm = String(m.tipo || "").toUpperCase();
        if (tipoNorm === "RECEITA" || tipoNorm === "ENTRADA" || tipoNorm === "QUOTA") {
          baseMeses[mesIdx].Receitas += val;
        } else if (tipoNorm === "DESPESA" || tipoNorm === "SAIDA") {
          baseMeses[mesIdx].Despesas += val;
        }
      }
    });

    let acumulado = 0;
    baseMeses.forEach(item => {
      acumulado += (item.Receitas - item.Despesas);
      item.Saldo = acumulado;
    });

    return baseMeses;
  }, [predioMovements]);

  return (
    <div className="space-y-6">
      {/* 13 MANDATORY INDICATORS (FROM DOCUMENT I, PAGE 2 & 3) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-[#333] uppercase tracking-wider">Módulo de Administração: Os 13 Indicadores Ativos</h4>
          <span className="text-[10px] text-slate-400 font-medium">Clique em qualquer indicador para navegar para o módulo</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {[
            { 
              name: "Prédios Ativos", 
              val: totalPrediosReais === 1 ? "1 Edifício" : `${totalPrediosReais} Edifícios`, 
              icon: "/modulos/01-predio.png", 
              section: "predios" 
            },
            { 
              name: "Condóminos", 
              val: `${predioFracoes.length} Frações`, 
              icon: "/modulos/07-fracao.png", 
              section: "fracoes" 
            },
            { 
              name: "Inquilinos", 
              val: `${predioFracoes.filter(f => f.is_arrendada).length} Ativos`, 
              icon: "/modulos/12-inquilino.png", 
              section: "fracoes_perfis" 
            },
            { 
              name: "Intervenções", 
              val: `${ocorrenciasCount} Registadas`, 
              icon: "/modulos/28-intervencao.png", 
              section: "manutencao_intervencoes" 
            },
            { 
              name: "Obras Gerais", 
              val: obrasCount === 1 ? "1 Ativa" : `${obrasCount} Ativas`, 
              icon: "/modulos/41-obra.png", 
              section: "manutencao_extraordinarias" 
            },
            { 
              name: "Escala Limpeza", 
              val: limpezasCount === 1 ? "1 Área" : `${limpezasCount} Áreas`, 
              icon: "/modulos/50-limpeza.png", 
              section: "vistorias_limpezas" 
            },
            { 
              name: "Documentos IA", 
              val: `${documentosCount} Arquivados`, 
              icon: "/modulos/27-arquivo-automatico.png", 
              section: "documentos" 
            },
            { 
              name: "Cobranças", 
              val: `${predioAvisos.filter(a => a.estado === 'Pendente').length} Pendentes`, 
              icon: "/modulos/60-nota-de-cobranca.png", 
              section: "financeiro_relatorios" 
            },
            { 
              name: "Alertas Jurídicos", 
              val: alertasJuridicosCount === 1 ? "1 Ativo" : `${alertasJuridicosCount} Ativos`, 
              icon: "/modulos/23-contrato.png", 
              section: "contencioso_juridico" 
            },
            { 
              name: "Contratos Fornecedores", 
              val: fornecedoresCount === 1 ? "1 Ativo" : `${fornecedoresCount} Ativos`, 
              icon: "/modulos/67-fornecedor.png", 
              section: "fornecedores" 
            },
            { 
              name: "Sondagens IA", 
              val: sondagensCount === 1 ? "1 Ativa" : `${sondagensCount} Ativas`, 
              icon: "/modulos/76-sondagem.png", 
              section: "comunicacao_sondagens" 
            },
            { 
              name: "Fundo Reserva", 
              val: `${totalFundoReserva.toLocaleString("pt-PT")} €`, 
              icon: "/modulos/64-saldo.png", 
              section: "financeiro_extratos" 
            },
            { 
              name: "Saldo em Caixa", 
              val: `${totalSaldoCaixa.toLocaleString("pt-PT")} €`, 
              icon: "/modulos/57-quota.png", 
              section: "movimentos" 
            }
          ].map((ind, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectSection?.(ind.section)}
              className="w-full h-[115px] bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#064E3B] border border-[#A7F3D0] rounded-2xl flex flex-col items-center justify-between text-center p-2.5 relative select-none hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-xs"
            >
              <img src={ind.icon} alt={ind.name} className="h-9 w-9 object-contain mb-0.5 shrink-0 rounded-lg drop-shadow-xs" />
              <div className="flex flex-col items-center leading-none">
                <span className="text-[10px] font-black text-[#064E3B] leading-tight block truncate max-w-full text-center uppercase tracking-tight">{ind.name}</span>
              </div>
              <span className="bg-white/95 text-[#064E3B] border border-[#6EE7B7] text-[8.5px] font-black px-2.5 py-0.5 rounded-full shadow-xs uppercase tracking-wider truncate max-w-[92%] leading-none">
                {ind.val}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Destaques de Arranque & Pasta Provisória */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          onClick={() => onSelectSection?.("configuracao_arranque")}
          className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/40 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-amber-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-sm group-hover:scale-105 transition-transform">
              <i className="fa-solid fa-sliders text-lg"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-slate-800 group-hover:text-amber-700 transition-colors">Arranque & Saldos Iniciais</h4>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full">Transição</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Defina o balanço de abertura bancário, dívidas/créditos de frações e histórico.</p>
            </div>
          </div>
          <i className="fa-solid fa-arrow-right text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all"></i>
        </div>

        <div 
          onClick={() => onSelectSection?.("minutas_oficiais")}
          className="bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-300/40 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-sm group-hover:scale-105 transition-transform">
              <i className="fa-solid fa-file-signature text-lg"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-slate-800 group-hover:text-indigo-700 transition-colors">Minutas Oficiais & Simulador de E-mails</h4>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-indigo-200 text-indigo-900 rounded-full">5 PDFs Editáveis</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Descarregue exemplares em PDF ou simule os envios automáticos para o seu e-mail.</p>
            </div>
          </div>
          <i className="fa-solid fa-arrow-right text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all"></i>
        </div>
      </div>

      {/* Main Row: Chart + IA Alerts Side-by-Side to eliminate extra scrolling */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">Transparência Orçamental e Fluxo de Caixa</h3>
                {predioMovements.length === 0 ? (
                  <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                    Base a Zero (Sem Movimentos)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {predioMovements.length} Movimento{predioMovements.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {predioMovements.length === 0
                  ? "O gráfico inicia a zero e reflete automaticamente os saldos e despesas reais lançados no prédio."
                  : "Receitas de quotas vs. despesas de manutenção calculadas conforme os saldos do prédio."}
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-200 self-start sm:self-auto">
              Ano {new Date().getFullYear()}
            </span>
          </div>
          <div className="h-52 text-xs font-bold">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(v) => `${v}€`} />
                <Tooltip formatter={(value: any) => [`${Number(value).toLocaleString("pt-PT")} €`, ""]} />
                <Legend />
                <Area type="monotone" name="Receitas" dataKey="Receitas" stroke="#10b981" fillOpacity={1} fill="url(#colorRec)" strokeWidth={2} />
                <Area type="monotone" name="Despesas" dataKey="Despesas" stroke="#ef4444" fillOpacity={1} fill="url(#colorDes)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* IA Assistente & Alerts (Immediately visible, no artificial scroll barrier) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between min-h-[250px]">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center justify-between">
              <span>IA Assistente Automático</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">Reconciliação e alertas pendentes de validação.</p>
            
            <div className="space-y-3">
              <div className="flex items-start space-x-2 text-xs bg-amber-50 border border-amber-100 p-2.5 rounded-lg text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <div>
                  <span className="font-bold block">Quotas em Atraso</span>
                  <span>A fração D possui 3 quotas em falta. Cobrança extrajudicial recomendada.</span>
                </div>
              </div>
              <div className="flex items-start space-x-2 text-xs bg-indigo-50 border border-indigo-100 p-2.5 rounded-lg text-indigo-800">
                <Brain className="h-4 w-4 shrink-0 text-indigo-500 mt-0.5" />
                <div>
                  <span className="font-bold block">Análise de Contratos</span>
                  <span>O contrato de Limpeza expira em 30 dias. IA sugere rever o reajuste de 2%.</span>
                </div>
              </div>
            </div>
          </div>
          <button 
            onClick={() => alert("Resumo IA gerado e enviado para a caixa de correio da administração.")}
            className="mt-4 w-full bg-[#1A1A1A] hover:bg-[#333] text-white font-bold py-2 rounded-lg text-xs cursor-pointer flex items-center justify-center space-x-1.5 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>Gerar Relatório de IA</span>
          </button>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Transações e Movimentos de Caixa</h3>
            <p className="text-xs text-slate-400">Lançamentos confirmados e reconciliados recentemente.</p>
          </div>
          <button 
            onClick={() => exportToXLS("Saldos_Movimentos", ["Data", "Tipo", "Descricao", "Valor"], predioMovements.map(m=>[m.data, m.tipo, m.descricao, m.valor.toString()]))} 
            title="Exportar Excel"
            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-xs"
          >
            <img src="/modulos/66-exportacao-financeira.png" alt="Excel" className="h-6 w-6 object-contain" onError={(e) => { e.currentTarget.src = "/modulos/26-exportacao.png"; }} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-150 text-slate-400 font-bold">
                <th className="py-2">Data</th>
                <th className="py-2">Tipo</th>
                <th className="py-2">Descrição</th>
                <th className="py-2">Categoria</th>
                <th className="py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {predioMovements.slice(0, 5).map((m) => (
                <tr key={m.id_mov} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="py-2.5 font-mono text-slate-500">{m.data}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                      m.tipo === "Receita" || m.tipo === "RECEITA" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                    }`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td className="py-2.5 font-medium text-slate-700">{m.descricao}</td>
                  <td className="py-2.5 text-slate-500">{m.categoria}</td>
                  <td className={`py-2.5 text-right font-bold ${
                    m.tipo === "Receita" || m.tipo === "RECEITA" ? "text-emerald-600" : "text-red-600"
                  }`}>
                    {m.tipo === "Receita" || m.tipo === "RECEITA" ? "+" : "-"}{m.valor.toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
