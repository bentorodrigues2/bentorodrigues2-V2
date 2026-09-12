import React, { useState } from "react";
import { Predio, LoggedUser, ItemPlanoManutencao, TipoInspecaoObrigatoria } from "../types";
import { 
  Wrench, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  ShieldCheck, 
  Building2, 
  Plus, 
  Upload, 
  Send, 
  Bell, 
  Flame, 
  Droplets, 
  Zap, 
  Sun, 
  FileCheck, 
  ChevronRight, 
  Sliders, 
  Layers 
} from "lucide-react";
import { triggerSendReaction } from "./SendingReactionModal";

interface AgendaManutencaoProps {
  predio: Predio;
  loggedUser: LoggedUser;
}

export function AgendaManutencao({ predio, loggedUser }: AgendaManutencaoProps) {
  const [activeTab, setActiveTab] = useState<"checklist" | "calendario" | "novo_registo">("checklist");
  const [filterStatus, setFilterStatus] = useState<"TODOS" | "CONFORME" | "A_EXPIRAR" | "EXPIRADO_ALERTA">("TODOS");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Maintenance plan items - Base limpa sem dados de simulação
  const [itensManutencao, setItensManutencao] = useState<ItemPlanoManutencao[]>([]);

  // Modal / Form states for new inspection registration
  const [selectedItemForAction, setSelectedItemForAction] = useState<ItemPlanoManutencao | null>(null);
  const [actionModalType, setActionModalType] = useState<"registar_vistoria" | "solicitar_proposta" | null>(null);
  const [novaDataVistoria, setNovaDataVistoria] = useState<string>(new Date().toISOString().split("T")[0]);
  const [novoTecnico, setNovoTecnico] = useState<string>("");
  const [novoNumCertificado, setNovoNumCertificado] = useState<string>("");
  const [novasObservacoes, setNovasObservacoes] = useState<string>("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const getTipoIcon = (tipo: TipoInspecaoObrigatoria) => {
    switch (tipo) {
      case "ELEVADORES_DGEG":
        return <Building2 className="h-5 w-5 text-emerald-400" />;
      case "LIMPEZA_CHAMINES_CONDUTAS":
        return <Flame className="h-5 w-5 text-amber-400" />;
      case "RECARGA_EXTINTORES":
        return <ShieldCheck className="h-5 w-5 text-red-400" />;
      case "INSPECAO_REDE_GAS":
        return <Zap className="h-5 w-5 text-yellow-400" />;
      case "LIMPEZA_CISTERNA_BOMBAS":
        return <Droplets className="h-5 w-5 text-sky-400" />;
      case "SISTEMA_SOLAR_TERMICO":
        return <Sun className="h-5 w-5 text-amber-300" />;
      case "PORTAO_GARAGEM_AUTOMATICO":
        return <Wrench className="h-5 w-5 text-indigo-400" />;
      default:
        return <FileCheck className="h-5 w-5 text-emerald-400" />;
    }
  };

  const filteredItems = itensManutencao.filter(item => {
    if (filterStatus === "TODOS") return true;
    return item.estado_conformidade === filterStatus;
  });

  const countAlertas = itensManutencao.filter(i => i.estado_conformidade === "EXPIRADO_ALERTA").length;
  const countAExpirar = itensManutencao.filter(i => i.estado_conformidade === "A_EXPIRAR").length;
  const countConformes = itensManutencao.filter(i => i.estado_conformidade === "CONFORME").length;

  const handleSalvarVistoria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAction) return;

    triggerSendReaction("email", `A registar vistoria técnica: ${selectedItemForAction.titulo}`, () => {
      // Calculate next date based on periodicity
      const vistDate = new Date(novaDataVistoria);
      const nextDate = new Date(vistDate);
      nextDate.setMonth(nextDate.getMonth() + selectedItemForAction.periodicidade_meses);
      const proximaDataStr = nextDate.toISOString().split("T")[0];

      const novaVistoria = {
        id_vistoria: `vist-${Date.now()}`,
        data: novaDataVistoria,
        tecnico: novoTecnico || "Técnico Credenciado",
        resultado: "APROVADO_SEM_DEFICIENCIAS" as const,
        observacoes: novasObservacoes || "Vistoria concluída com sucesso e em conformidade legal."
      };

      setItensManutencao(prev => prev.map(item => {
        if (item.id_item === selectedItemForAction.id_item) {
          return {
            ...item,
            ultima_inspecao_data: novaDataVistoria,
            proxima_inspecao_data: proximaDataStr,
            estado_conformidade: "CONFORME",
            num_certificado_relatorio: novoNumCertificado || item.num_certificado_relatorio,
            historico_vistorias: [novaVistoria, ...(item.historico_vistorias || [])]
          };
        }
        return item;
      }));

      setActionModalType(null);
      setSelectedItemForAction(null);
      setNovoTecnico("");
      setNovoNumCertificado("");
      setNovasObservacoes("");
      showToast(`✅ Vistoria registada com sucesso! Próxima data agendada para ${proximaDataStr}.`);
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="agenda-manutencao-view">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-500 flex items-center gap-3 animate-fade-in text-xs font-bold">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 p-6 sm:p-7 rounded-3xl text-white shadow-xl border border-emerald-500/30 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5" /> Agenda de Manutenção
            </span>
            <span className="text-xs text-slate-400 font-mono">Plano Preventivo & Vistorias Obrigatórias</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Plano Preventivo de Manutenção e Vistorias (Checklist do Edifício)
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Calendário técnico com alarmes automáticos para inspeções obrigatórias por lei: Elevadores (DGEG/EMA), Limpeza de Chaminés e Condutas de Fumo, Recarga de Extintores (SCIE), Rede de Gás e Desinfeção de Cisternas.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 relative z-10">
          <div className="inline-flex rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-1 text-xs shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab("checklist")}
              className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === "checklist" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
              }`}
            >
              Checklist & Alarmes ({itensManutencao.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("calendario")}
              className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === "calendario" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
              }`}
            >
              Linha Temporal & Vencimentos
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards / Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div 
          onClick={() => setFilterStatus(filterStatus === "EXPIRADO_ALERTA" ? "TODOS" : "EXPIRADO_ALERTA")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            filterStatus === "EXPIRADO_ALERTA" 
              ? "bg-red-50 dark:bg-red-950/60 border-red-500 ring-2 ring-red-500/20" 
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-red-400"
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Vistorias Expiradas / Em Alerta
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{countAlertas}</div>
            <span className="text-[10px] text-slate-400">Requer intervenção imediata da administração</span>
          </div>
          <div className="p-3 bg-red-100 dark:bg-red-900/40 text-red-600 rounded-2xl font-black">
            <Bell className="h-6 w-6" />
          </div>
        </div>

        <div 
          onClick={() => setFilterStatus(filterStatus === "A_EXPIRAR" ? "TODOS" : "A_EXPIRAR")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            filterStatus === "A_EXPIRAR" 
              ? "bg-amber-50 dark:bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/20" 
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-400"
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Clock className="h-3 w-3" /> A Expirar em &lt;45 Dias
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{countAExpirar}</div>
            <span className="text-[10px] text-slate-400">Agendamentos preventivos recomendados</span>
          </div>
          <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-2xl font-black">
            <Calendar className="h-6 w-6" />
          </div>
        </div>

        <div 
          onClick={() => setFilterStatus(filterStatus === "CONFORME" ? "TODOS" : "CONFORME")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            filterStatus === "CONFORME" 
              ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/20" 
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-400"
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Em Plena Conformidade Legal
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{countConformes}</div>
            <span className="text-[10px] text-slate-400">Certificados válidos e relatórios arquivados</span>
          </div>
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 rounded-2xl font-black">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Main Tab: Checklist of Building Items */}
      {activeTab === "checklist" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Filtro Ativo: <strong className="text-emerald-600 dark:text-emerald-400">{filterStatus}</strong> ({filteredItems.length} itens)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterStatus("TODOS")}
                className={`px-3 py-1 text-xs rounded-lg font-bold cursor-pointer transition-all ${
                  filterStatus === "TODOS" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("EXPIRADO_ALERTA")}
                className={`px-3 py-1 text-xs rounded-lg font-bold cursor-pointer transition-all ${
                  filterStatus === "EXPIRADO_ALERTA" ? "bg-red-600 text-white" : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                }`}
              >
                Expirados ({countAlertas})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("A_EXPIRAR")}
                className={`px-3 py-1 text-xs rounded-lg font-bold cursor-pointer transition-all ${
                  filterStatus === "A_EXPIRAR" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                }`}
              >
                A Expirar ({countAExpirar})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("CONFORME")}
                className={`px-3 py-1 text-xs rounded-lg font-bold cursor-pointer transition-all ${
                  filterStatus === "CONFORME" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                }`}
              >
                Conformes ({countConformes})
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">Sem Planos ou Vistorias Registadas</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Não existem itens de inspeção obrigatória registados para este filtro no edifício. Utilize o botão &quot;Adicionar Manutenção&quot; ou configure os equipamentos técnicos (elevadores, extintores, condutas).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems.map(item => {
              const isExpirado = item.estado_conformidade === "EXPIRADO_ALERTA";
              const isAExpirar = item.estado_conformidade === "A_EXPIRAR";

              return (
                <div 
                  key={item.id_item}
                  className={`p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-4 shadow-sm ${
                    isExpirado 
                      ? "bg-red-50/40 dark:bg-red-950/20 border-red-300 dark:border-red-800/80" 
                      : isAExpirar 
                        ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/80" 
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl border shrink-0 ${
                          isExpirado ? "bg-red-100 text-red-700 border-red-200" :
                          isAExpirar ? "bg-amber-100 text-amber-700 border-amber-200" :
                          "bg-slate-100 dark:bg-slate-800 text-emerald-500 border-slate-200 dark:border-slate-700"
                        }`}>
                          {getTipoIcon(item.tipo)}
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-slate-900 dark:text-white leading-tight">
                            {item.titulo}
                          </h3>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            Base Legal: {item.base_legal_dgeg}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 border ${
                        isExpirado 
                          ? "bg-red-600 text-white border-red-700 animate-pulse" 
                          : isAExpirar 
                            ? "bg-amber-500 text-white border-amber-600" 
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                      }`}>
                        {isExpirado ? "⚠️ Expirado" : isAExpirar ? "⏳ A Expirar" : "✓ Conforme"}
                      </span>
                    </div>

                    {/* Inspection Details Box */}
                    <div className="bg-slate-50 dark:bg-slate-950/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 space-y-2 text-xs">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-400 text-[10px] font-bold block">Última Inspeção</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.ultima_inspecao_data}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] font-bold block">Próxima Obrigatória</span>
                          <span className={`font-mono font-black ${isExpirado ? "text-red-600" : isAExpirar ? "text-amber-600" : "text-emerald-600"}`}>
                            {item.proxima_inspecao_data}
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-2 flex flex-col gap-1 text-[11px]">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Entidade Responsável:</span>
                          <strong className="text-slate-800 dark:text-slate-200 font-semibold">{item.entidade_responsavel}</strong>
                        </div>
                        {item.contacto_entidade && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Contacto / Marcação:</span>
                            <span className="font-mono text-emerald-600 font-bold">{item.contacto_entidade}</span>
                          </div>
                        )}
                        {item.num_certificado_relatorio && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Nº Certificado / DGEG:</span>
                            <span className="font-mono text-slate-700 dark:text-slate-300 font-bold bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                              {item.num_certificado_relatorio}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItemForAction(item);
                        setActionModalType("registar_vistoria");
                      }}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Registar Nova Vistoria</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerSendReaction("email", `A solicitar proposta técnica a ${item.entidade_responsavel}`, () => {
                          showToast(`📧 Solicitação de proposta enviada com sucesso para ${item.entidade_responsavel}!`);
                        });
                      }}
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer"
                      title="Pedir Orçamento / Agendar Intervenção"
                    >
                      <Send className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Pedir Proposta</span>
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>
      )}

      {/* Secondary Tab: Timeline & Calendar View */}
      {activeTab === "calendario" && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-500" />
              <span>Cronograma Anual de Vistorias & Manutenção Periódica</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">Ano 2026 - 2027</span>
          </div>

          <div className="space-y-3">
            {itensManutencao
              .sort((a, b) => new Date(a.proxima_inspecao_data).getTime() - new Date(b.proxima_inspecao_data).getTime())
              .map(item => (
                <div 
                  key={item.id_item} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="font-mono text-xs font-black bg-slate-900 text-white dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1.5 rounded-xl text-center min-w-[90px]">
                      {item.proxima_inspecao_data}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">{item.titulo}</h4>
                      <p className="text-xs text-slate-400">{item.entidade_responsavel} • Periodicidade: {item.periodicidade_meses} meses</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                      Est. {item.custo_estimado?.toFixed(2) || "150.00"} €
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItemForAction(item);
                        setActionModalType("registar_vistoria");
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Anotar Vistoria
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Action Modal: Registar Nova Vistoria */}
      {actionModalType === "registar_vistoria" && selectedItemForAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-zoom-in">
            <div className="bg-slate-900 p-5 text-white flex justify-between items-center border-b border-emerald-500/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  {getTipoIcon(selectedItemForAction.tipo)}
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">Registo de Vistoria / Inspeção Técnica</h3>
                  <span className="text-xs text-slate-300">{selectedItemForAction.titulo}</span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setActionModalType(null)} 
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarVistoria} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Data da Realização</label>
                  <input
                    type="date"
                    required
                    value={novaDataVistoria}
                    onChange={e => setNovaDataVistoria(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Nº Certificado / Relatório</label>
                  <input
                    type="text"
                    placeholder="Ex: CERT-2026/001-DGEG"
                    value={novoNumCertificado}
                    onChange={e => setNovoNumCertificado(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Técnico / Empresa Inspetora</label>
                <input
                  type="text"
                  placeholder="Ex: Eng. Manuel Silva (ISQ / EMA Certificada)"
                  value={novoTecnico}
                  onChange={e => setNovoTecnico(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Parecer & Observações Técnicas</label>
                <textarea
                  rows={3}
                  placeholder="Ex: Instalação aprovada sem reservas. Próxima inspeção agendada com base na periodicidade legal."
                  value={novasObservacoes}
                  onChange={e => setNovasObservacoes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-200">
                ℹ️ Ao guardar este registo, a conformidade legal deste item passará a <strong>CONFORME</strong> e a próxima data será automaticamente calculada para daqui a {selectedItemForAction.periodicidade_meses} meses.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModalType(null)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl cursor-pointer shadow-md transition-all"
                >
                  Guardar Vistoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
