import React, { useState } from "react";
import { Predio, Fracao, Aviso, Movimento, Reserva, Ocorrencia, LoggedUser, Conta } from "../types";
import { defaultEmptyPredio } from "../data";
import { 
  Building2, 
  Users, 
  Settings, 
  Activity, 
  DollarSign, 
  AlertTriangle, 
  Calendar, 
  Wrench, 
  Phone, 
  Mail, 
  ShieldCheck, 
  Clock, 
  Plus, 
  Trash2, 
  Edit3, 
  Briefcase,
  CheckCircle2
} from "lucide-react";
import { formatDatePT } from "../utils";

interface MultiCondominioProps {
  predios: Predio[];
  fracoes: Fracao[];
  avisos: Aviso[];
  movimentos: Movimento[];
  reservas: Reserva[];
  ocorrencias: Ocorrencia[];
  contas: Conta[];
  loggedUser: LoggedUser;
  onUpdatePredio: (updatedPredio: Predio) => void;
}

interface TeamMember {
  id: string;
  id_predio: string;
  nome: string;
  funcao: string; // e.g. "Empresa de Limpeza", "Técnico de Elevadores", "Administrador de Condomínio", "Jardineiro", "Segurança"
  empresa: string;
  telefone: string;
  email: string;
  status: "Ativo" | "Inativo";
}

export function MultiCondominio({
  predios,
  fracoes,
  avisos,
  movimentos,
  reservas,
  ocorrencias,
  contas,
  loggedUser,
  onUpdatePredio
}: MultiCondominioProps) {
  const [activeTab, setActiveTab] = useState<"aggregated" | "teams" | "profiles">("aggregated");
  const [selectedPredioId, setSelectedPredioId] = useState<string>(predios[0]?.id_predio || "");

  // Mocked state for team members that can be added/edited locally
  const [teams, setTeams] = useState<TeamMember[]>([
    {
      id: "t-1",
      id_predio: "predio-1",
      nome: "Sérgio Pinheiro",
      funcao: "Técnico de Elevadores",
      empresa: "Schindler Portugal",
      telefone: "912 345 678",
      email: "sergio.pinheiro@schindler.pt",
      status: "Ativo"
    },
    {
      id: "t-2",
      id_predio: "predio-1",
      nome: "Maria do Carmo",
      funcao: "Empresa de Limpeza",
      empresa: "Brilho Extremo Lda",
      telefone: "934 888 222",
      email: "contacto@brilhoextremo.pt",
      status: "Ativo"
    },
    {
      id: "t-3",
      id_predio: "predio-2",
      nome: "Ana Rodrigues",
      funcao: "Administrador de Condomínio",
      empresa: "CondoManager AI",
      telefone: "911 222 333",
      email: "ana.rodrigues@condomanager.pt",
      status: "Ativo"
    }
  ]);

  // Form for new team member
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [newMember, setNewMember] = useState<Partial<TeamMember>>({
    nome: "",
    funcao: "Empresa de Limpeza",
    empresa: "",
    telefone: "",
    email: "",
    status: "Ativo"
  });

  // Building profiles specifications
  const [profiles, setProfiles] = useState<{
    [predioId: string]: {
      seguroSeguradora: string;
      seguroApolice: string;
      seguroValor: string;
      elevadorEmpresa: string;
      elevadorContrato: string;
      elevadorContacto: string;
      regrasHorarioRuido: string;
      regrasLixo: string;
      areasGinasioCap: number;
      areasSpaCap: number;
    }
  }>({
    "predio-1": {
      seguroSeguradora: "Fidelidade Seguros",
      seguroApolice: "FID-889922-2026",
      seguroValor: "450.000 €",
      elevadorEmpresa: "Schindler Portugal",
      elevadorContrato: "SCH-9921",
      elevadorContacto: "210 999 888",
      regrasHorarioRuido: "22:00 às 08:00 (Lei do Ruído Geral)",
      regrasLixo: "Depósito no contentor exterior entre as 20h e as 22h",
      areasGinasioCap: 5,
      areasSpaCap: 8
    }
  });

  const getProfile = (predioId: string) => {
    return profiles[predioId] || {
      seguroSeguradora: "Não configurada",
      seguroApolice: "Sem apólice",
      seguroValor: "0 €",
      elevadorEmpresa: "Não contratada",
      elevadorContrato: "Sem contrato",
      elevadorContacto: "-",
      regrasHorarioRuido: "22:00 às 08:00",
      regrasLixo: "Depósito nos contentores apropriados",
      areasGinasioCap: 5,
      areasSpaCap: 8
    };
  };

  const handleUpdateProfileField = (predioId: string, field: string, value: any) => {
    setProfiles(prev => ({
      ...prev,
      [predioId]: {
        ...getProfile(predioId),
        [field]: value
      }
    }));
  };

  // 1. CALCULATE AGGREGATED PORTFOLIO METRICS
  const totalPredios = predios.length;
  const totalFracoes = fracoes.length;
  
  // Total Bank accounts balance across all managed buildings
  const totalSaldoConsolidado = contas.reduce((sum, c) => sum + c.saldo, 0);
  
  // Financial metrics
  const totalReceitas = movimentos.filter(m => m.tipo === "Receita").reduce((sum, m) => sum + m.valor, 0);
  const totalDespesas = movimentos.filter(m => m.tipo === "Despesa").reduce((sum, m) => sum + m.valor, 0);
  
  // Pendings
  const totalAvisosPendentes = avisos.filter(a => a.estado === "Pendente");
  const totalDividaConsolidada = totalAvisosPendentes.reduce((sum, a) => sum + a.valor, 0);
  const totalOcorrenciasAtivas = ocorrencias.filter(o => o.estado !== "Resolvido").length;
  const totalReservasPendentes = reservas.filter(r => r.estado === "Pendente").length;

  // Delinquency percentage
  const totalAvisosValor = avisos.reduce((sum, a) => sum + a.valor, 0);
  const taxaIncumprimento = totalAvisosValor > 0 
    ? ((totalDividaConsolidada / totalAvisosValor) * 100).toFixed(1)
    : "0.0";

  // Active Building Object
  const currentPredio = predios.find(p => p.id_predio === selectedPredioId) || predios[0] || defaultEmptyPredio;

  // Submit new team member
  const handleAddTeamMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.nome || !newMember.funcao) {
      alert("Preencha o nome e a função do colaborador!");
      return;
    }
    const novo: TeamMember = {
      id: "t-" + (teams.length + 1),
      id_predio: selectedPredioId,
      nome: newMember.nome,
      funcao: newMember.funcao,
      empresa: newMember.empresa || "-",
      telefone: newMember.telefone || "-",
      email: newMember.email || "-",
      status: (newMember.status as "Ativo" | "Inativo") || "Ativo"
    };

    setTeams([...teams, novo]);
    setNewMember({
      nome: "",
      funcao: "Empresa de Limpeza",
      empresa: "",
      telefone: "",
      email: "",
      status: "Ativo"
    });
    setShowTeamForm(false);
  };

  const handleDeleteTeamMember = (id: string) => {
    if (confirm("Tem a certeza que deseja remover este membro da equipa?")) {
      setTeams(teams.filter(t => t.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center">
            <Building2 className="text-emerald-500 mr-2.5 h-6 w-6" />
            Portal Multi-Condomínio
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Administração centralizada, equipas dedicadas, especificações patrimoniais e dashboards consolidados.
          </p>
        </div>

        {/* CONTROLO DE ABAS */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 self-start md:self-auto">
          <button
            onClick={() => setActiveTab("aggregated")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === "aggregated"
                ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <Activity className="h-3.5 w-3.5 inline mr-1" />
            Dashboards Consolidados
          </button>
          <button
            onClick={() => setActiveTab("teams")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === "teams"
                ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <Users className="h-3.5 w-3.5 inline mr-1" />
            Equipas & Força de Trabalho
          </button>
          <button
            onClick={() => setActiveTab("profiles")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === "profiles"
                ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <Settings className="h-3.5 w-3.5 inline mr-1" />
            Perfis & Regras de Prédios
          </button>
        </div>
      </div>

      {/* --- TAB 1: DASHBOARD CONSOLIDADO DE PORTEFÓLIO --- */}
      {activeTab === "aggregated" && (
        <div className="space-y-6">
          
          {/* CARDS COM METRICAS CONSOLIDADAS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Saldo Consolidado */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Caixa Consolidado</span>
                <p className="text-xl font-bold font-mono text-slate-800 dark:text-white">
                  {totalSaldoConsolidado.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                </p>
                <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full dark:bg-emerald-900/20 dark:text-emerald-400">
                  Todas as Contas
                </span>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>

            {/* Total Cobrado / Emitido */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Receitas de Quotas</span>
                <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  +{totalReceitas.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                </p>
                <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full dark:bg-slate-800 dark:text-slate-400">
                  Despesas: -{totalDespesas.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                </span>
              </div>
              <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600">
                <Activity className="h-5 w-5" />
              </div>
            </div>

            {/* Dívida Consolidada */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dívida / Quotas Pendentes</span>
                <p className="text-xl font-bold font-mono text-red-600 dark:text-red-400">
                  {totalDividaConsolidada.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                </p>
                <span className="text-[9px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full dark:bg-red-900/20 dark:text-red-400">
                  Taxa Incumprimento: {taxaIncumprimento}%
                </span>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>

            {/* Prédios e Frações */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Portefólio Ativo</span>
                <p className="text-xl font-bold text-slate-800 dark:text-white">
                  {totalPredios} Edifícios
                </p>
                <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full dark:bg-indigo-900/20 dark:text-indigo-400">
                  {totalFracoes} Frações Ativas
                </span>
              </div>
              <div className="h-10 w-10 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center text-violet-600">
                <Building2 className="h-5 w-5" />
              </div>
            </div>

          </div>

          {/* ESTADO OPERACIONAL DO PORTEFÓLIO */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Tabela de Prédios e seus sub-saldos / pendências */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Métricas Detalhadas por Edifício</h3>
                <span className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded font-mono">Consolidado</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                      <th className="p-3">Nome do Condomínio</th>
                      <th className="p-3 font-mono">NIF</th>
                      <th className="p-3">Saldos de Caixa</th>
                      <th className="p-3">Quotas Pendentes</th>
                      <th className="p-3">Ocorrências</th>
                      <th className="p-3">Equipa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predios.map(p => {
                      // Calc per building metrics
                      const buildingContas = contas.filter(c => c.id_predio === p.id_predio);
                      const buildingSaldo = buildingContas.reduce((sum, c) => sum + c.saldo, 0);
                      
                      const buildingAvisos = avisos.filter(a => a.id_predio === p.id_predio && a.estado === "Pendente");
                      const buildingDividas = buildingAvisos.reduce((sum, a) => sum + a.valor, 0);
                      
                      const buildingOcorr = ocorrencias.filter(o => o.id_predio === p.id_predio && o.estado !== "Resolvido").length;
                      const buildingTeam = teams.filter(t => t.id_predio === p.id_predio).length;

                      return (
                        <tr key={p.id_predio} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                          <td className="p-3 font-bold text-slate-700 dark:text-slate-300">
                            {p.nome || `${p.morada_linha1}, ${p.num_porta}`}
                          </td>
                          <td className="p-3 font-mono text-slate-500">{p.nif}</td>
                          <td className="p-3 font-semibold font-mono text-slate-800 dark:text-white">
                            {buildingSaldo.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                          </td>
                          <td className="p-3 font-mono text-red-500 font-semibold">
                            {buildingDividas > 0 ? buildingDividas.toLocaleString("pt-PT", { style: "currency", currency: "EUR" }) : "0,00 €"}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${buildingOcorr > 0 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"}`}>
                              {buildingOcorr} ativas
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">
                            {buildingTeam} membros
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Operações centrais pendentes */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Ações e Alertas Centrais</h3>
              
              <div className="space-y-3">
                
                <div className="flex items-start space-x-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900/30">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-red-900 dark:text-red-400">Quotas em Atraso Crítico</span>
                    <p className="text-[10px] text-red-700 dark:text-red-300">Temos {totalAvisosPendentes.length} avisos de liquidação por receber de condóminos.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/30">
                  <Wrench className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-400">Ocorrências Não Resolvidas</span>
                    <p className="text-[10px] text-amber-700 dark:text-amber-300">Estão registadas {totalOcorrenciasAtivas} avarias ou reparações pendentes no portefólio.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                  <Calendar className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-400">Reservas de Espaços Comuns</span>
                    <p className="text-[10px] text-indigo-700 dark:text-indigo-300">Temos {totalReservasPendentes} pedidos de reservas a aguardar aprovação de administrador.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-400">Sistemas do Portefólio</span>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-300">Vistorias preventivas atualizadas. Elevadores e seguros ativos com cobertura integral.</p>
                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>
      )}

      {/* --- TAB 2: EQUIPAS POR CONDOMÍNIO --- */}
      {activeTab === "teams" && (
        <div className="space-y-6">
          
          {/* SELETOR DE PRÉDIO PARA EQUIPA */}
          <div className="bg-slate-100 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Filtrar Equipa por Condomínio</label>
              <select
                value={selectedPredioId}
                onChange={(e) => setSelectedPredioId(e.target.value)}
                className="block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {predios.map(p => (
                  <option key={p.id_predio} value={p.id_predio}>{p.nome || `${p.morada_linha1}, ${p.num_porta}`}</option>
                ))}
              </select>
            </div>

            {loggedUser.role === "ADMIN" && (
              <button
                onClick={() => setShowTeamForm(!showTeamForm)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer self-start md:self-auto transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Adicionar Colaborador / Força de Trabalho</span>
              </button>
            )}
          </div>

          {/* FORMULÁRIO PARA NOVO MEMBRO DA EQUIPA */}
          {showTeamForm && loggedUser.role === "ADMIN" && (
            <form onSubmit={handleAddTeamMember} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl space-y-4 shadow-sm">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center">
                <Briefcase className="h-4 w-4 text-emerald-500 mr-1.5" />
                Registar Colaborador em {currentPredio?.nome || currentPredio?.morada_linha1 || "Condomínio"}
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <label className="text-[10px] font-semibold text-slate-500 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={newMember.nome}
                    onChange={(e) => setNewMember(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: João Baptista"
                    className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white px-3 py-2 text-xs rounded-lg focus:outline-emerald-500"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-semibold text-slate-500 mb-1">Função / Cargo *</label>
                  <select
                    value={newMember.funcao}
                    onChange={(e) => setNewMember(prev => ({ ...prev, funcao: e.target.value }))}
                    className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white px-3 py-2 text-xs rounded-lg focus:outline-emerald-500 cursor-pointer"
                  >
                    <option value="Empresa de Limpeza">Empresa de Limpeza</option>
                    <option value="Técnico de Elevadores">Técnico de Elevadores</option>
                    <option value="Administrador de Condomínio">Administrador de Condomínio</option>
                    <option value="Jardineiro">Jardineiro</option>
                    <option value="Técnico de Manutenção Geral">Técnico de Manutenção Geral</option>
                    <option value="Segurança / Portaria">Segurança / Portaria</option>
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-semibold text-slate-500 mb-1">Empresa Prestadora (Opcional)</label>
                  <input
                    type="text"
                    value={newMember.empresa}
                    onChange={(e) => setNewMember(prev => ({ ...prev, empresa: e.target.value }))}
                    placeholder="Ex: Schindler S.A. ou Particular"
                    className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white px-3 py-2 text-xs rounded-lg focus:outline-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <label className="text-[10px] font-semibold text-slate-500 mb-1">Contacto Telefónico</label>
                  <input
                    type="text"
                    value={newMember.telefone}
                    onChange={(e) => setNewMember(prev => ({ ...prev, telefone: e.target.value }))}
                    placeholder="Ex: 912 345 678"
                    className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white px-3 py-2 text-xs rounded-lg focus:outline-emerald-500 font-mono"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-semibold text-slate-500 mb-1">E-mail Oficial</label>
                  <input
                    type="email"
                    value={newMember.email}
                    onChange={(e) => setNewMember(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Ex: joao.manutencao@gmail.com"
                    className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white px-3 py-2 text-xs rounded-lg focus:outline-emerald-500"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-semibold text-slate-500 mb-1">Estado Operacional</label>
                  <select
                    value={newMember.status}
                    onChange={(e) => setNewMember(prev => ({ ...prev, status: e.target.value as "Ativo" | "Inativo" }))}
                    className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white px-3 py-2 text-xs rounded-lg focus:outline-emerald-500 cursor-pointer"
                  >
                    <option value="Ativo">Ativo / Em Exercício</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Confirmar Registo
                </button>
                <button
                  type="button"
                  onClick={() => setShowTeamForm(false)}
                  className="border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 px-4 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* LISTA DE EQUIPAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.filter(t => t.id_predio === selectedPredioId).length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center col-span-full space-y-2">
                <Users className="h-8 w-8 text-slate-400 mx-auto" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Sem equipa registada neste condomínio</h4>
                <p className="text-[10px] text-slate-400">Adicione prestadores de serviços, técnicos de manutenção ou equipas de limpeza.</p>
              </div>
            ) : (
              teams.filter(t => t.id_predio === selectedPredioId).map(t => (
                <div key={t.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between space-y-4">
                  
                  <div className="space-y-3">
                    
                    {/* Linha topo */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <span className="text-[9px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                          {t.funcao}
                        </span>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white pt-1">{t.nome}</h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase ${t.status === "Ativo" ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                        {t.status}
                      </span>
                    </div>

                    {/* Detalhes de contacto */}
                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <p className="flex items-center text-[11px]">
                        <Briefcase className="h-3.5 w-3.5 mr-1.5 text-slate-400 shrink-0" />
                        <strong>Empresa:</strong> <span className="ml-1 text-slate-800 dark:text-slate-300">{t.empresa}</span>
                      </p>
                      <p className="flex items-center text-[11px]">
                        <Phone className="h-3.5 w-3.5 mr-1.5 text-slate-400 shrink-0" />
                        <strong>Telefone:</strong> <span className="ml-1 text-slate-800 dark:text-slate-300 font-mono">{t.telefone}</span>
                      </p>
                      <p className="flex items-center text-[11px]">
                        <Mail className="h-3.5 w-3.5 mr-1.5 text-slate-400 shrink-0" />
                        <strong>E-mail:</strong> <span className="ml-1 truncate text-slate-800 dark:text-slate-300 font-mono text-[10px]">{t.email}</span>
                      </p>
                    </div>

                  </div>

                  {/* Botão remover */}
                  {loggedUser.role === "ADMIN" && (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDeleteTeamMember(t.id)}
                        className="border border-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-xs active:scale-95 active:ring-2 active:ring-red-400 select-none"
                        title="Eliminar membro da equipa"
                      >
                        <img src="/estados-acoes/14-eliminar.png" alt="Eliminar" className="h-3.5 w-3.5 object-contain" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  )}

                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* --- TAB 3: PERFIS POR PRÉDIO (DETALHES PATRIMONIAIS) --- */}
      {activeTab === "profiles" && (
        <div className="space-y-6">
          
          {/* SELETOR DE PRÉDIO PARA PERFIL */}
          <div className="bg-slate-100 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Selecionar Prédio para Configurar Perfil</label>
            <select
              value={selectedPredioId}
              onChange={(e) => setSelectedPredioId(e.target.value)}
              className="block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              {predios.map(p => (
                <option key={p.id_predio} value={p.id_predio}>{p.nome || `${p.morada_linha1}, ${p.num_porta}`}</option>
              ))}
            </select>
          </div>

          {/* FICHA GERAL E CONFIGURAÇÕES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Secção de Seguros e Manutenção Técnica */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center">
                <ShieldCheck className="h-4.5 w-4.5 text-indigo-500 mr-2" />
                Contratos Oficiais & Seguros
              </h3>

              <div className="space-y-4">
                
                {/* Seguro Multirisco */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-3 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide block">Seguro de Edifício Multirisco</span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[9px] font-semibold text-slate-500 mb-1">Companhia de Seguros</label>
                      <input
                        type="text"
                        disabled={loggedUser.role !== "ADMIN"}
                        value={getProfile(selectedPredioId).seguroSeguradora}
                        onChange={(e) => handleUpdateProfileField(selectedPredioId, "seguroSeguradora", e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-emerald-500 disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-slate-500 mb-1">Número de Apólice</label>
                      <input
                        type="text"
                        disabled={loggedUser.role !== "ADMIN"}
                        value={getProfile(selectedPredioId).seguroApolice}
                        onChange={(e) => handleUpdateProfileField(selectedPredioId, "seguroApolice", e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-emerald-500 disabled:opacity-60 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-semibold text-slate-500 mb-1">Capital Seguro (Edifício Inteiro)</label>
                    <input
                      type="text"
                      disabled={loggedUser.role !== "ADMIN"}
                      value={getProfile(selectedPredioId).seguroValor}
                      onChange={(e) => handleUpdateProfileField(selectedPredioId, "seguroValor", e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-emerald-500 disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Empresa de Manutenção de Elevadores */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-3 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide block">Contrato de Manutenção de Elevadores</span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[9px] font-semibold text-slate-500 mb-1">Empresa Certificada</label>
                      <input
                        type="text"
                        disabled={loggedUser.role !== "ADMIN"}
                        value={getProfile(selectedPredioId).elevadorEmpresa}
                        onChange={(e) => handleUpdateProfileField(selectedPredioId, "elevadorEmpresa", e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-emerald-500 disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-slate-500 mb-1">ID / Código de Contrato</label>
                      <input
                        type="text"
                        disabled={loggedUser.role !== "ADMIN"}
                        value={getProfile(selectedPredioId).elevadorContrato}
                        onChange={(e) => handleUpdateProfileField(selectedPredioId, "elevadorContrato", e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-emerald-500 disabled:opacity-60 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-semibold text-slate-500 mb-1">Contacto Telefónico de Piquete de Emergência (24h/7d)</label>
                    <input
                      type="text"
                      disabled={loggedUser.role !== "ADMIN"}
                      value={getProfile(selectedPredioId).elevadorContacto}
                      onChange={(e) => handleUpdateProfileField(selectedPredioId, "elevadorContacto", e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-emerald-500 disabled:opacity-60 font-mono text-red-600 dark:text-red-400 font-bold"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Secção de Regras e Capacidade de Áreas Comuns */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center">
                <Clock className="h-4.5 w-4.5 text-emerald-500 mr-2" />
                Regras Internas & Capacidades
              </h3>

              <div className="space-y-4">
                
                {/* Horário de Ruído */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Regulamento Geral de Horário de Ruído *</label>
                  <input
                    type="text"
                    disabled={loggedUser.role !== "ADMIN"}
                    value={getProfile(selectedPredioId).regrasHorarioRuido}
                    onChange={(e) => handleUpdateProfileField(selectedPredioId, "regrasHorarioRuido", e.target.value)}
                    placeholder="Ex: 22h às 8h nos dias úteis"
                    className="w-full bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-emerald-500 disabled:opacity-60"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Este limite de som será mostrado a todos os condóminos que criam reservas ou anúncios.</p>
                </div>

                {/* Gestão de Resíduos e Lixo */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Regras de Depósito de Lixo Comum / Recicláveis *</label>
                  <textarea
                    disabled={loggedUser.role !== "ADMIN"}
                    rows={2}
                    value={getProfile(selectedPredioId).regrasLixo}
                    onChange={(e) => handleUpdateProfileField(selectedPredioId, "regrasLixo", e.target.value)}
                    placeholder="Regras do depósito do lixo..."
                    className="w-full bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-emerald-500 disabled:opacity-60"
                  />
                </div>

                {/* Capacidade de Áreas Comuns */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-3 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide block">Capacidade Limite de Reservas de Espaços</span>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-semibold text-slate-500 mb-1">Lotação Ginásio (Pessoas Máx.)</label>
                      <input
                        type="number"
                        min="1"
                        disabled={loggedUser.role !== "ADMIN"}
                        value={getProfile(selectedPredioId).areasGinasioCap}
                        onChange={(e) => handleUpdateProfileField(selectedPredioId, "areasGinasioCap", Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-emerald-500 disabled:opacity-60 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-slate-500 mb-1">Lotação Piscina / Spa (Pessoas Máx.)</label>
                      <input
                        type="number"
                        min="1"
                        disabled={loggedUser.role !== "ADMIN"}
                        value={getProfile(selectedPredioId).areasSpaCap}
                        onChange={(e) => handleUpdateProfileField(selectedPredioId, "areasSpaCap", Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-emerald-500 disabled:opacity-60 font-mono font-bold"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">Restrições ativas para segurança sanitária e de conforto de condóminos.</p>
                </div>

              </div>
            </div>

          </div>

          {/* GUARDAR AVISO SUCESSO */}
          {loggedUser.role === "ADMIN" && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-xl flex items-center space-x-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div className="text-xs text-emerald-800 dark:text-emerald-300">
                Os dados de perfil e regras são **salvos dinamicamente** em memória. Alterações são aplicadas imediatamente para este prédio.
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
