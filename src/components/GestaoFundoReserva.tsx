import React, { useState, useEffect } from "react";
import { Predio, LoggedUser, Conta } from "../types";

interface GestaoFundoReservaProps {
  predio: Predio;
  loggedUser: LoggedUser;
  contas: Conta[];
}

export function GestaoFundoReserva({ predio, loggedUser, contas }: GestaoFundoReservaProps) {
  // Saldo real da conta do Fundo Comum de Reserva (FCR) do prédio ativo —
  // antes eram sempre os mesmos números fixos (750€ com um comentário no
  // código a admitir "Starts below the minimum to trigger the alert!"),
  // independentemente do prédio selecionado.
  const contaFCR = contas.find(c => c.id_predio === predio.id_predio && (c.tipo.includes("FCR") || c.tipo.includes("Reserva")));
  const saldoRealFCR = contaFCR?.saldo || 0;
  const orcamentoRealAnual = (predio.patrimonio as any)?.orcamento_anual || 0;

  // Financial parameters — pré-preenchidos com dados reais, mas continuam
  // editáveis: esta é uma ferramenta de simulação/projeção, não um relatório.
  const [orcamentoAnual, setOrcamentoAnual] = useState<number>(orcamentoRealAnual || 8500);
  const [saldoAtualFCR, setSaldoAtualFCR] = useState<number>(saldoRealFCR);
  const [contribuicaoMensalExtra, setContribuicaoMensalExtra] = useState<number>(50);
  const [idadePredio, setIdadePredio] = useState<"recente" | "medio" | "antigo" | "historico">("medio");

  useEffect(() => {
    setOrcamentoAnual(orcamentoRealAnual || 8500);
    setSaldoAtualFCR(saldoRealFCR);
  }, [predio.id_predio, orcamentoRealAnual, saldoRealFCR]);

  // Legal Minimum: 10% of annual budget (Artigo 4º do Decreto-Lei n.º 268/94)
  const fundoMinimoLegal = orcamentoAnual * 0.1;

  // Recommended Fund: base of 10% + age modifier
  // Recente (<5 anos): +2%, Médio (5-15 anos): +5%, Antigo (15-30 anos): +10%, Histórico (>30 anos): +15%
  const getAgeModifier = () => {
    switch (idadePredio) {
      case "recente": return 0.02;
      case "medio": return 0.05;
      case "antigo": return 0.10;
      case "historico": return 0.15;
    }
  };

  const fundoRecomendado = orcamentoAnual * (0.1 + getAgeModifier());
  const percentagemAtualLegal = (saldoAtualFCR / fundoMinimoLegal) * 100;
  const isAbaixoDoMinimo = saldoAtualFCR < fundoMinimoLegal;
  const isAbaixoDoRecomendado = saldoAtualFCR < fundoRecomendado;

  // Yearly projection for the next 5 years
  const projectionYears = 5;
  const generateProjection = () => {
    const data = [];
    let currentBalance = saldoAtualFCR;
    const yearlyContribution = contribuicaoMensalExtra * 12;

    for (let i = 0; i <= projectionYears; i++) {
      const year = new Date().getFullYear() + i;
      if (i > 0) {
        currentBalance += yearlyContribution;
      }
      data.push({
        ano: year,
        saldo: currentBalance,
        percentagemLegal: (currentBalance / fundoMinimoLegal) * 100,
        isAbaixo: currentBalance < fundoMinimoLegal
      });
    }
    return data;
  };

  const projecoes = generateProjection();

  return (
    <div className="space-y-6 animate-fadeIn" id="fundo-reserva-module">
      {/* Page Description Header */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-indigo-500/10 p-6 rounded-2xl border border-emerald-500/15">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-md">
            <i className="fa-solid fa-piggy-bank text-xl"></i>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Cálculo e Planeamento do Fundo Comum de Reserva</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              De acordo com o <strong>Artigo 4.º do Decreto-Lei n.º 268/94, de 25 de outubro</strong>, é obrigatória a constituição de um fundo comum de reserva para custear as despesas de conservação do edifício. O montante mínimo legal é de <strong>10% do orçamento anual aprovado</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Alertas Automáticos */}
      {isAbaixoDoMinimo ? (
        <div className="bg-red-50 border border-red-200 text-red-950 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg text-sm shrink-0">
              <i className="fa-solid fa-circle-exclamation"></i>
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-red-800">⚠️ ALERTA GRAVE: Fundo de Reserva abaixo do Limite Mínimo Legal</h4>
              <p className="text-xs text-red-700 font-medium mt-0.5">
                O saldo atual de <strong className="font-mono">{saldoAtualFCR.toFixed(2)}€</strong> está abaixo do mínimo legal obrigatório por lei (<strong className="font-mono">{fundoMinimoLegal.toFixed(2)}€</strong>). O condomínio encontra-se em incumprimento regulamentar.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setSaldoAtualFCR(fundoMinimoLegal + 500)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] px-3.5 py-2 rounded-lg transition-all shadow-sm shrink-0 cursor-pointer"
          >
            <i className="fa-solid fa-hand-holding-dollar mr-1"></i> Corrigir com Reforço
          </button>
        </div>
      ) : isAbaixoDoRecomendado ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-950 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg text-sm shrink-0">
              <i className="fa-solid fa-circle-info"></i>
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-800">💡 ALERTA PREVENTIVO: Abaixo das Práticas Recomendadas</h4>
              <p className="text-xs text-amber-700 font-medium mt-0.5">
                O saldo cumpre o limite legal obrigatório de 10%, mas está abaixo dos <strong className="font-mono">{fundoRecomendado.toFixed(2)}€</strong> recomendados para edifícios da idade selecionada para prevenir intervenções extraordinárias inesperadas.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setContribuicaoMensalExtra(prev => prev + 25)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition-all shadow-sm shrink-0 cursor-pointer"
          >
            Aumentar Quota de FCR
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-5 rounded-2xl flex items-start space-x-3">
          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg text-sm shrink-0">
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800">✓ SAÚDE FINANCEIRA EXCELENTE</h4>
            <p className="text-xs text-emerald-700 font-medium mt-0.5">
              O fundo de reserva está saudável! O saldo atual de <strong className="font-mono">{saldoAtualFCR.toFixed(2)}€</strong> excede o mínimo legal obrigatório e as diretrizes recomendadas de segurança financeira para o edifício.
            </p>
          </div>
        </div>
      )}

      {/* Main Parameters and Calculations Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Setup parameters */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Parâmetros do Condomínio</h4>
          
          <div className="flex flex-col">
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Orçamento Geral Anual aprovado (€) *</label>
            <input 
              type="number"
              value={orcamentoAnual}
              onChange={e => setOrcamentoAnual(Math.max(0, parseFloat(e.target.value) || 0))}
              className="border border-slate-200 px-3 py-2 text-xs rounded-lg font-mono focus:outline-emerald-500 bg-slate-50/50"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Saldo Atual do FCR (€) *</label>
            <input 
              type="number"
              value={saldoAtualFCR}
              onChange={e => setSaldoAtualFCR(Math.max(0, parseFloat(e.target.value) || 0))}
              className="border border-slate-200 px-3 py-2 text-xs rounded-lg font-mono focus:outline-emerald-500 bg-slate-50/50"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Idade/Estado do Edifício</label>
            <select
              value={idadePredio}
              onChange={e => setIdadePredio(e.target.value as any)}
              className="border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-emerald-500 bg-slate-50/50 cursor-pointer"
            >
              <option value="recente">Recente / Novo (&lt; 5 anos - Recomendado: 12% do Orçamento)</option>
              <option value="medio">Médio (5 a 15 anos - Recomendado: 15% do Orçamento)</option>
              <option value="antigo">Antigo (15 a 30 anos - Recomendado: 20% do Orçamento)</option>
              <option value="historico">Histórico / Requer Intervenções (&gt; 30 anos - Recomendado: 25%)</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Poupança / Reforço Mensal (€)</label>
            <input 
              type="number"
              value={contribuicaoMensalExtra}
              onChange={e => setContribuicaoMensalExtra(Math.max(0, parseFloat(e.target.value) || 0))}
              className="border border-slate-200 px-3 py-2 text-xs rounded-lg font-mono focus:outline-emerald-500 bg-slate-50/50"
            />
            <p className="text-[9px] text-slate-400 mt-1">Reforço adicional arrecadado através das quotas mensais regulares das frações.</p>
          </div>
        </div>

        {/* Right column: Main calculations cards & summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-slate-400 text-[9px] font-bold uppercase block tracking-wider">Fundo Mínimo Legal</span>
                <span className="text-[9px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold uppercase tracking-wide mt-1 inline-block">Mínimo 10% (DL 268/94)</span>
                <h3 className="text-xl font-black text-slate-800 font-mono mt-2">{fundoMinimoLegal.toFixed(2)}€</h3>
              </div>
              <p className="text-[10px] text-slate-450 mt-2 leading-tight border-t border-slate-100 pt-2">Montante abaixo do qual o condomínio fica sujeito a infração legal.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-slate-400 text-[9px] font-bold uppercase block tracking-wider">Fundo Recomendado</span>
                <span className="text-[9px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-bold uppercase tracking-wide mt-1 inline-block">Adequado a {(getAgeModifier() * 100 + 10).toFixed(0)}%</span>
                <h3 className="text-xl font-black text-slate-800 font-mono mt-2">{fundoRecomendado.toFixed(2)}€</h3>
              </div>
              <p className="text-[10px] text-slate-450 mt-2 leading-tight border-t border-slate-100 pt-2">Meta prudencial para garantir reparações estruturais, pintura e elevadores.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-slate-400 text-[9px] font-bold uppercase block tracking-wider">Taxa de Cobertura</span>
                <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wide mt-1 inline-block ${isAbaixoDoMinimo ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                  {isAbaixoDoMinimo ? "Crítico" : "Conforme"}
                </span>
                <h3 className="text-xl font-black text-slate-800 font-mono mt-2">{percentagemAtualLegal.toFixed(1)}%</h3>
              </div>
              <p className="text-[10px] text-slate-450 mt-2 leading-tight border-t border-slate-100 pt-2">Percentagem do saldo disponível atual sobre o limite legal obrigatório.</p>
            </div>
          </div>

          {/* Progress gauge chart CSS-only */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700">Progresso Geral do FCR face ao Alvo</span>
              <span className="font-mono text-slate-500 font-bold">{saldoAtualFCR.toFixed(0)}€ de {fundoRecomendado.toFixed(0)}€</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden relative">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  isAbaixoDoMinimo ? "bg-red-500" : isAbaixoDoRecomendado ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, (saldoAtualFCR / fundoRecomendado) * 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              <span>0%</span>
              <span className="text-red-500">Mínimo Legal ({fundoMinimoLegal.toFixed(0)}€)</span>
              <span className="text-indigo-600">Recomendado ({fundoRecomendado.toFixed(0)}€)</span>
              <span>Excedente</span>
            </div>
          </div>
        </div>
      </div>

      {/* Projeção Multianual do Fundo */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Projeção Multianual do Fundo de Reserva</h4>
          <p className="text-xs text-slate-500 mt-1">
            Simulação da evolução do saldo nos próximos 5 anos, assumindo uma poupança regular de <strong className="font-mono">{(contribuicaoMensalExtra * 12).toFixed(2)}€/ano</strong> (sem considerar despesas imprevistas).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Table */}
          <div className="overflow-x-auto border border-slate-150 rounded-xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <th className="p-3">Ano</th>
                  <th className="p-3 text-right">Saldo Estimado</th>
                  <th className="p-3 text-right">% do Limite Legal</th>
                  <th className="p-3 text-center">Estado Regulamentar</th>
                </tr>
              </thead>
              <tbody>
                {projecoes.map((p, idx) => (
                  <tr key={p.ano} className={`border-b border-slate-100 hover:bg-slate-50/50 ${idx === 0 ? "bg-slate-50/30 text-slate-950 font-semibold" : "text-slate-600"}`}>
                    <td className="p-3 font-bold">{p.ano} {idx === 0 ? "(Corrente)" : ""}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-800">{p.saldo.toFixed(2)}€</td>
                    <td className="p-3 text-right font-mono text-indigo-600 font-semibold">{p.percentagemLegal.toFixed(0)}%</td>
                    <td className="p-3 text-center">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        p.isAbaixo 
                          ? "bg-red-50 text-red-600 border border-red-150" 
                          : p.saldo >= fundoRecomendado
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-150"
                          : "bg-amber-50 text-amber-600 border border-amber-150"
                      }`}>
                        {p.isAbaixo ? "Abaixo do Mínimo" : p.saldo >= fundoRecomendado ? "Excelente" : "Cumpre Mínimo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bar charts projection (CSS-only bento component) */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200 pb-2">Projeção Gráfica do Saldo FCR</span>
              <div className="flex justify-around items-end h-32 pt-4">
                {projecoes.map((p, idx) => {
                  // Normalize height percentage
                  const maxPossible = Math.max(...projecoes.map(x => x.saldo));
                  const heightPercent = maxPossible > 0 ? (p.saldo / maxPossible) * 100 : 10;

                  return (
                    <div key={p.ano} className="flex flex-col items-center space-y-1.5 w-1/6">
                      <span className="text-[9px] font-mono font-bold text-slate-700">{p.saldo.toFixed(0)}€</span>
                      <div 
                        className={`w-6 rounded-t-md transition-all shadow-sm ${
                          p.isAbaixo 
                            ? "bg-red-500" 
                            : p.saldo >= fundoRecomendado
                            ? "bg-emerald-500"
                            : "bg-amber-500"
                        }`}
                        style={{ height: `${Math.max(12, heightPercent)}px` }}
                      ></div>
                      <span className="text-[9px] font-black text-slate-400">{p.ano}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-[9px] text-slate-400 leading-normal text-center mt-3">
              * A projeção considera depósitos de reforços mensais cumulativos consistentes de {contribuicaoMensalExtra}€ sem deduções para obras.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
