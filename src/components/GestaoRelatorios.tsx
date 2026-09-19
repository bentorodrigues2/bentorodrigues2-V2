import React, { useState } from "react";
import { Predio, LoggedUser, Movimento, Fracao, Documento } from "../types";
import { generateAndDownloadPdf, exportarBalanceteMapaAnualXLS } from "../utils";
import { FiltroRelatoriosPDFModal } from "./FiltroRelatoriosPDFModal";
import { registarLogAuditoria } from "../lib/supabaseService";

interface GestaoRelatoriosProps {
  predio: Predio;
  loggedUser: LoggedUser;
  movimentos?: Movimento[];
  fracoes?: Fracao[];
  onAddDocumento?: (doc: Documento) => void;
}

export function GestaoRelatorios({ predio, loggedUser, movimentos = [], fracoes = [], onAddDocumento }: GestaoRelatoriosProps) {
  const [isPublicando, setIsPublicando] = useState(false);
  const [tipoRelatorio, setTipoRelatorio] = useState<"mensal" | "trimestral" | "anual">("mensal");
  const [mesSelecionado, setMesSelecionado] = useState<string>("07");
  const [trimestreSelecionado, setTrimestreSelecionado] = useState<string>("T2");
  const [anoSelecionado, setAnoSelecionado] = useState<string>("2026");
  const [isCompiling, setIsCompiling] = useState(false);
  const [compiledReport, setCompiledReport] = useState<any | null>(null);
  const [isFiltroModalOpen, setIsFiltroModalOpen] = useState(false);

  const handleCompilarRelatorio = () => {
    setIsCompiling(true);
    setCompiledReport(null);

    setTimeout(() => {
      // Compile data
      const filterYear = parseInt(anoSelecionado);

      const filtered = movimentos.filter(m => {
        const parts = m.data.split("-");
        const movYear = parts[0].length === 4 ? parseInt(parts[0]) : parseInt(parts[2]);
        const movMonth = parts[0].length === 4 ? parts[1] : parts[1];
        
        if (movYear !== filterYear) return false;

        if (tipoRelatorio === "mensal") {
          return movMonth === mesSelecionado;
        } else if (tipoRelatorio === "trimestral") {
          const mInt = parseInt(movMonth);
          if (trimestreSelecionado === "T1") return mInt >= 1 && mInt <= 3;
          if (trimestreSelecionado === "T2") return mInt >= 4 && mInt <= 6;
          if (trimestreSelecionado === "T3") return mInt >= 7 && mInt <= 9;
          if (trimestreSelecionado === "T4") return mInt >= 10 && mInt <= 12;
        }
        return true; // Anual
      });

      const totalReceitas = filtered.filter(m => m.tipo === "RECEITA").reduce((acc, curr) => acc + curr.valor, 0);
      const totalDespesas = filtered.filter(m => m.tipo === "DESPESA").reduce((acc, curr) => acc + curr.valor, 0);
      const saldoPeriodo = totalReceitas - totalDespesas;

      // Group by category
      const despesasPorCategoria: { [cat: string]: number } = {};
      filtered.filter(m => m.tipo === "DESPESA").forEach(m => {
        despesasPorCategoria[m.categoria] = (despesasPorCategoria[m.categoria] || 0) + m.valor;
      });

      const periodo = tipoRelatorio === "mensal" ? `${getMonthName(mesSelecionado)} de ${anoSelecionado}` : tipoRelatorio === "trimestral" ? `${trimestreSelecionado} de ${anoSelecionado}` : `Ano de ${anoSelecionado}`;

      setCompiledReport({
        id: `REP-${anoSelecionado}-${tipoRelatorio.slice(0,1).toUpperCase()}-${tipoRelatorio === "mensal" ? mesSelecionado : tipoRelatorio === "trimestral" ? trimestreSelecionado : "CONSOL"}`,
        titulo: `Relatório de Gestão ${tipoRelatorio === "mensal" ? `Mensal - Mes ${mesSelecionado}` : tipoRelatorio === "trimestral" ? `Trimestral - ${trimestreSelecionado}` : "Anual Consolidado"}`,
        periodo,
        dataEmissao: new Date().toLocaleDateString("pt-PT"),
        movimentos: filtered,
        totalReceitas,
        totalDespesas,
        saldoPeriodo,
        resultadoLiquido: saldoPeriodo,
        despesasPorCategoria,
        totalFracoes: fracoes.length
      });

      setIsCompiling(false);
    }, 1200);
  };

  const handlePublicarNoPortal = () => {
    if (!compiledReport || !onAddDocumento) {
      alert("Não é possível publicar: gere primeiro um relatório.");
      return;
    }
    if (compiledReport.movimentos.length === 0) {
      const confirmar = window.confirm(
        "Este período não tem nenhum movimento financeiro registado — o relatório ficaria com Receitas, Despesas e Saldo a 0,00€.\n\nIsto pode significar que ainda não há dados lançados para este período (e não que as contas estão mesmo a zero). Publicar mesmo assim no Portal, visível aos condóminos?"
      );
      if (!confirmar) return;
    }
    setIsPublicando(true);
    const novoDoc: Documento = {
      id_doc: `doc-rel-${Date.now()}`,
      id_predio: predio.id_predio,
      nome: `${compiledReport.titulo}.pdf`,
      tipo: "Relatório de Gestão",
      data_upload: new Date().toISOString().split("T")[0],
      tamanho: "",
      categoria: "Relatórios de Gestão",
      descricao: `Receitas: ${formatCurrency(compiledReport.totalReceitas)} | Despesas: ${formatCurrency(compiledReport.totalDespesas)} | Saldo: ${formatCurrency(compiledReport.saldoPeriodo)}`,
      visibilidade: "Público",
      autor: loggedUser.nome || "Administração",
      tema: "Relatórios de Gestão",
      ano: anoSelecionado
    };
    onAddDocumento(novoDoc);
    registarLogAuditoria("Financeira", `Publicou o relatório "${compiledReport.titulo}" no Portal`, predio.id_predio, loggedUser);
    setIsPublicando(false);
    alert(`Relatório publicado com sucesso no Arquivo Documental — visível aos condóminos em "Relatórios de Gestão".`);
  };

  const formatCurrency = (val: number) => `${val.toFixed(2)}€`;

  const getMonthName = (mStr: string) => {
    const months: { [k: string]: string } = {
      "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril", "05": "Maio", "06": "Junho",
      "07": "Julho", "08": "Agosto", "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro"
    };
    return months[mStr] || mStr;
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="relatorios-module">
      {/* Description header */}
      <div className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10 p-6 rounded-2xl border border-blue-500/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md shrink-0">
            <i className="fa-solid fa-file-invoice-dollar text-xl"></i>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Emissão de Relatórios Financeiros Automáticos</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Compile relatórios de prestação de contas com gráficos agregados e fechos de saldos mensais, trimestrais ou anuais. O sistema consolida os movimentos reais do período e permite publicar o relatório no Arquivo Documental, visível aos condóminos.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              exportarBalanceteMapaAnualXLS(predio, fracoes, parseInt(anoSelecionado) || 2026, [], movimentos);
            }}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 shadow-sm"
            title="Exportar Grelha das 12 Quotas Mensais de todas as Frações num único ficheiro Excel/CSV"
          >
            <img src="/modulos/66-exportacao-financeira.png" alt="Excel" className="h-4 w-4 object-contain" onError={(e) => { e.currentTarget.src = "/marca/18-pdf.png"; }} />
            <span>📊 Mapa Anual 12 Quotas (.XLSX/.CSV)</span>
          </button>
          <button
            type="button"
            onClick={() => setIsFiltroModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 shadow-sm shrink-0"
          >
            <img src="/marca/18-pdf.png" alt="PDF" className="h-4 w-4 object-contain" />
            <span>Filtro Dinâmico PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compilation panel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Gerador de Relatórios</h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Tipo de Prestação de Contas</label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-150">
                {(["mensal", "trimestral", "anual"] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipoRelatorio(t)}
                    className={`py-1.5 text-[10px] font-bold rounded-lg border-none capitalize transition-all cursor-pointer ${
                      tipoRelatorio === t ? "bg-blue-600 text-white shadow-sm" : "bg-transparent text-slate-500 hover:text-slate-850"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {tipoRelatorio === "mensal" && (
              <div className="flex flex-col animate-slideDown">
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Mês de Referência</label>
                <select
                  value={mesSelecionado}
                  onChange={e => setMesSelecionado(e.target.value)}
                  className="border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-blue-500 bg-slate-50/50 cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map(m => (
                    <option key={m} value={m}>{getMonthName(m)}</option>
                  ))}
                </select>
              </div>
            )}

            {tipoRelatorio === "trimestral" && (
              <div className="flex flex-col animate-slideDown">
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Trimestre</label>
                <select
                  value={trimestreSelecionado}
                  onChange={e => setTrimestreSelecionado(e.target.value)}
                  className="border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-blue-500 bg-slate-50/50 cursor-pointer"
                >
                  <option value="T1">1º Trimestre (Jan - Mar)</option>
                  <option value="T2">2º Trimestre (Abr - Jun)</option>
                  <option value="T3">3º Trimestre (Jul - Set)</option>
                  <option value="T4">4º Trimestre (Out - Dez)</option>
                </select>
              </div>
            )}

            <div className="flex flex-col">
              <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Ano Económico</label>
              <select
                value={anoSelecionado}
                onChange={e => setAnoSelecionado(e.target.value)}
                className="border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-blue-500 bg-slate-50/50 cursor-pointer"
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-[10px] text-slate-500 leading-relaxed space-y-1">
              <div className="flex items-center text-slate-700 font-bold uppercase tracking-wide text-[9px] mb-1">
                <i className="fa-solid fa-gears mr-1.5 text-blue-500"></i>Configurações de Automatização
              </div>
              <div className="flex items-center"><i className="fa-solid fa-circle-check text-emerald-600 mr-1.5"></i>Gráficos agregados automáticos</div>
              <div className="flex items-center"><i className="fa-solid fa-circle-check text-emerald-600 mr-1.5"></i>Publicação real no Arquivo Documental</div>
            </div>

            <button
              onClick={handleCompilarRelatorio}
              disabled={isCompiling}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-sm flex items-center justify-center cursor-pointer"
            >
              {isCompiling ? (
                <>
                  <i className="fa-solid fa-circle-notch mr-2 animate-spin"></i> A Compilar Dados...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-rotate-left mr-2"></i> Compilar Relatório e Anexos
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Area for report preview and charts */}
        <div className="lg:col-span-2 space-y-6">
          {!compiledReport ? (
            <div className="bg-slate-50 p-12 rounded-2xl border border-dashed border-slate-200 text-center flex flex-col items-center justify-center space-y-3">
              <div className="text-slate-300 text-3xl"><i className="fa-solid fa-file-contract"></i></div>
              <div className="max-w-md">
                <h4 className="text-xs font-bold text-slate-750">Nenhum relatório compilado no momento</h4>
                <p className="text-[11px] text-slate-450 mt-1 leading-relaxed">
                  Defina o tipo, o mês ou trimestre pretendido no painel esquerdo e clique em "Compilar" para gerar um balanço contábil completo com anotações estatísticas e anexos reconciliados automaticamente.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-fadeIn relative overflow-hidden">
              {/* Marca de Água Subtil */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.06] select-none z-0">
                <img src="/marca/19-marca-dagua-logo-cinza-claro.png" alt="" className="w-80 h-80 object-contain" />
              </div>

              <div className="relative z-10 space-y-6">
                {/* Official Document Branding Header */}
                <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
                  <div className="bg-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-800 shadow-sm inline-flex items-center">
                    <img src="/marca/20-Logotipo Horizontal com fundo.png" alt="CondoManager AI" className="h-7 object-contain" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider block">Documento Oficial de Gestão</span>
                    <span className="text-xs font-bold text-slate-800 block">Condomínio {predio?.nome || predio?.morada_linha1 || "Geral"}</span>
                  </div>
                </div>

              {/* Report header */}
              <div className="flex flex-wrap justify-between items-start gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      CÓDIGO: {compiledReport.id}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-mono">
                      Oficial CondoManager
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-800 mt-2">{compiledReport.titulo}</h3>
                  <p className="text-[11px] text-slate-450 mt-1 flex items-center">
                    <i className="fa-solid fa-building mr-1.5"></i>Condomínio: {predio?.nome || predio?.morada_linha1 || "Geral"} | Emitido em: {compiledReport.dataEmissao}
                  </p>
                </div>
                <div className="flex space-x-2 no-print">
                  <button
                    onClick={() => {
                      generateAndDownloadPdf(
                        compiledReport.titulo,
                        [
                          { heading: "Resumo Executivo Financeiro", content: `Total de Receitas: ${formatCurrency(compiledReport.totalReceitas)}\nTotal de Despesas: ${formatCurrency(compiledReport.totalDespesas)}\nResultado Líquido do Período: ${formatCurrency(compiledReport.resultadoLiquido)}` },
                          { heading: "Despesas por Categoria", content: Object.entries(compiledReport.despesasPorCategoria).map(([cat, val]: any) => `${cat}: ${formatCurrency(val)}`).join("\n") || "Sem despesas registadas neste período." }
                        ],
                        `Relatorio_Financeiro_${predio.nome.replace(/\s+/g, '_')}.pdf`,
                        [{ label: "Edifício", value: predio.nome }, { label: "Período", value: compiledReport.periodo }]
                      );
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-[10px] px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <img src="/marca/18-pdf.png" alt="PDF" className="w-4 h-4 object-contain shrink-0" /> Descarregar PDF
                  </button>
                  <button
                    onClick={handlePublicarNoPortal}
                    disabled={isPublicando}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition-colors shadow-sm cursor-pointer"
                  >
                    <i className="fa-solid fa-file-signature mr-1"></i> {isPublicando ? "A publicar..." : "Publicar no Portal"}
                  </button>
                </div>
              </div>

              {/* Financial Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                  <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider">Total de Receitas</span>
                  <h3 className="text-base font-black text-emerald-950 font-mono mt-1">{formatCurrency(compiledReport.totalReceitas)}</h3>
                  <p className="text-[9px] text-emerald-600 mt-1 leading-tight">Quotas recolhidas e proventos.</p>
                </div>

                <div className="bg-red-50/50 p-4 rounded-xl border border-red-100">
                  <span className="text-[9px] font-bold text-red-800 uppercase tracking-wider">Total de Despesas</span>
                  <h3 className="text-base font-black text-red-950 font-mono mt-1">{formatCurrency(compiledReport.totalDespesas)}</h3>
                  <p className="text-[9px] text-red-600 mt-1 leading-tight">Serviços, contratos e manutenção.</p>
                </div>

                <div className={`p-4 rounded-xl border ${compiledReport.saldoPeriodo >= 0 ? "bg-blue-50/50 border-blue-100 text-blue-950" : "bg-rose-50 border-rose-100 text-rose-950"}`}>
                  <span className="text-[9px] font-bold uppercase tracking-wider">Saldo do Período</span>
                  <h3 className="text-base font-black font-mono mt-1">{formatCurrency(compiledReport.saldoPeriodo)}</h3>
                  <p className="text-[9px] mt-1 leading-tight">{compiledReport.saldoPeriodo >= 0 ? "Resultado operacional líquido positivo." : "Balanço operacional deficitário."}</p>
                </div>
              </div>

              {/* AUTOMATIC GRAPHS SECTION */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200 pb-2">
                  <i className="fa-solid fa-chart-column mr-1 text-blue-500"></i> Gráficos de Repartição de Despesas
                </span>
                
                {Object.keys(compiledReport.despesasPorCategoria).length === 0 ? (
                  <p className="text-xs text-slate-450 py-4 text-center">Nenhuma despesa registada neste período para segmentar.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    {/* Visual Progress bar bars */}
                    <div className="space-y-3">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Despesas por Categoria</span>
                      {Object.entries(compiledReport.despesasPorCategoria).map(([cat, val]: any) => {
                        const pct = compiledReport.totalDespesas > 0 ? (val / compiledReport.totalDespesas) * 100 : 0;
                        return (
                          <div key={cat} className="space-y-1">
                            <div className="flex justify-between text-[11px] font-medium text-slate-700">
                              <span>{cat}</span>
                              <span className="font-mono font-bold">{formatCurrency(val)} ({pct.toFixed(0)}%)</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2">
                              <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* CSS Pie Donut Simulation representation */}
                    <div className="flex flex-col items-center justify-center p-4 border border-slate-200 rounded-lg bg-white">
                      <div className="relative h-24 w-24 rounded-full border-8 border-blue-500 flex items-center justify-center">
                        <div className="text-center">
                          <span className="text-[9px] text-slate-400 uppercase block font-bold tracking-wider">Eficiência</span>
                          <span className="text-xs font-black text-slate-800">
                            {compiledReport.totalReceitas > 0 ? ((1 - compiledReport.totalDespesas / compiledReport.totalReceitas) * 100).toFixed(0) : "100"}%
                          </span>
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-450 mt-3 text-center">
                        Taxa de retenção de capital das receitas de quotas arrecadadas no período de referência.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Transactions list in report */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Detalhe dos Movimentos Consolidados</span>
                <div className="overflow-x-auto border border-slate-150 rounded-xl">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                        <th className="p-3">Data</th>
                        <th className="p-3">Descrição</th>
                        <th className="p-3">Categoria</th>
                        <th className="p-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compiledReport.movimentos.map((m: Movimento) => (
                        <tr key={m.id_mov} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="p-3 font-mono text-slate-500">{m.data}</td>
                          <td className="p-3 font-bold text-slate-750">{m.descricao}</td>
                          <td className="p-3 text-slate-500">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px]">{m.categoria}</span>
                          </td>
                          <td className={`p-3 text-right font-mono font-bold ${m.tipo === "RECEITA" ? "text-emerald-600" : "text-rose-600"}`}>
                            {m.tipo === "RECEITA" ? "+" : "-"}{formatCurrency(m.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal para Filtro Dinâmico de Relatórios PDF */}
      <FiltroRelatoriosPDFModal
        isOpen={isFiltroModalOpen}
        onClose={() => setIsFiltroModalOpen(false)}
        predio={predio}
        fracoes={fracoes}
        movimentos={movimentos}
      />
    </div>
  );
}
