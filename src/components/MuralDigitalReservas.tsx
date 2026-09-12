import React, { useState, useEffect } from "react";
import { Predio, Fracao, LoggedUser, MuralAviso, ReservaEspacoComum } from "../types";
import { 
  Megaphone, 
  CalendarCheck, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Pin, 
  Heart, 
  AlertTriangle, 
  Send, 
  Sparkles, 
  Flame, 
  Users, 
  PartyPopper, 
  FileCheck2,
  Bell,
  Trash2
} from "lucide-react";
import { triggerSendReaction } from "./SendingReactionModal";

interface MuralDigitalReservasProps {
  predio: Predio;
  fracoes: Fracao[];
  loggedUser: LoggedUser;
}

export function MuralDigitalReservas({
  predio,
  fracoes,
  loggedUser
}: MuralDigitalReservasProps) {
  const predioFracoes = fracoes.filter(f => f.id_predio === predio.id_predio);
  const [activeTab, setActiveTab] = useState<"mural" | "reservas">("mural");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Mural Notices State - Base limpa sem dados de simulação, com persistência local
  const [avisosMural, setAvisosMural] = useState<MuralAviso[]>(() => {
    try {
      const saved = localStorage.getItem(`condo_mural_${predio.id_predio}`);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [];
  });

  // Space Reservations State - Base limpa sem dados de simulação, com persistência local
  const [reservas, setReservas] = useState<ReservaEspacoComum[]>(() => {
    try {
      const saved = localStorage.getItem(`condo_reservas_${predio.id_predio}`);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(`condo_mural_${predio.id_predio}`, JSON.stringify(avisosMural));
  }, [avisosMural, predio.id_predio]);

  useEffect(() => {
    localStorage.setItem(`condo_reservas_${predio.id_predio}`, JSON.stringify(reservas));
  }, [reservas, predio.id_predio]);

  // New notice form modal
  const [novoAvisoModalOpen, setNovoAvisoModalOpen] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoConteudo, setNovoConteudo] = useState("");
  const [novoTipo, setNovoTipo] = useState<MuralAviso["tipo"]>("INFORMATIVO");
  const [novoFixado, setNovoFixado] = useState(false);

  // New reservation form modal
  const [novaReservaModalOpen, setNovaReservaModalOpen] = useState(false);
  const [resFracaoId, setResFracaoId] = useState(predioFracoes[0]?.id_fracao || "");
  const [resEspaco, setResEspaco] = useState<ReservaEspacoComum["espaco"]>("SALAO_CONDOMINIO");
  const [resData, setResData] = useState(() => new Date().toISOString().split("T")[0]);
  const [resHoraInicio, setResHoraInicio] = useState("10:00");
  const [resHoraFim, setResHoraFim] = useState("18:00");
  const [resFinalidade, setResFinalidade] = useState("");
  const [resPessoas, setResPessoas] = useState(1);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleCriarAviso = (e: React.FormEvent) => {
    e.preventDefault();
    const novo: MuralAviso = {
      id_aviso_mural: `av-mural-${Date.now()}`,
      id_predio: predio.id_predio,
      titulo: novoTitulo,
      conteudo: novoConteudo,
      autor: loggedUser.nome || "Administração do Condomínio",
      tipo: novoTipo,
      data_publicacao: new Date().toISOString().split("T")[0],
      fixado_topo: novoFixado,
      reacoes_gostos: 0
    };

    triggerSendReaction("email", "A publicar novo aviso no Mural Digital", () => {
      setAvisosMural([novo, ...avisosMural]);
      setNovoAvisoModalOpen(false);
      setNovoTitulo("");
      setNovoConteudo("");
      showToast("📢 Aviso publicado no Mural Digital com sucesso!");
    });
  };

  const handleCriarReserva = (e: React.FormEvent) => {
    e.preventDefault();
    const targetFracao = predioFracoes.find(f => f.id_fracao === resFracaoId) || predioFracoes[0];

    const nova: ReservaEspacoComum = {
      id_reserva: `res-${Date.now()}`,
      id_predio: predio.id_predio,
      id_fracao: targetFracao.id_fracao,
      fracao_nome: targetFracao.fracao_nome,
      solicitante_nome: targetFracao.proprietario?.nome || "Condómino",
      espaco: resEspaco,
      data_evento: resData,
      hora_inicio: resHoraInicio,
      hora_fim: resHoraFim,
      finalidade: resFinalidade || "Convívio de Condóminos",
      num_pessoas_estimado: resPessoas,
      caucao_paga: false,
      valor_caucao: 50.00,
      termo_responsabilidade_aceite: true,
      estado: "PENDENTE_APROVACAO"
    };

    setReservas([nova, ...reservas]);
    setNovaReservaModalOpen(false);
    setResFinalidade("");
    showToast("📅 Pedido de reserva submetido com sucesso! Aguarda validação da administração.");
  };

  const handleAprovarReserva = (idReserva: string) => {
    setReservas(prev => prev.map(r => r.id_reserva === idReserva ? { ...r, estado: "CONFIRMADA", caucao_paga: true } : r));
    showToast("✓ Reserva confirmada e caução registada com sucesso!");
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="mural-digital-reservas-view">
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
              <Megaphone className="h-3.5 w-3.5" /> Comunidade & Convivência
            </span>
            <span className="text-xs text-slate-400 font-mono">Portal do Condómino</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Mural Digital de Avisos & Reserva de Espaços Comuns
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Canal transparente de comunicação interna para publicações da administração e agendamento de espaços comuns (Salão do Condomínio, Churrasqueira, Terraço).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 relative z-10">
          <div className="inline-flex rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-1 text-xs shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab("mural")}
              className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === "mural" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
              }`}
            >
              Mural de Avisos ({avisosMural.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("reservas")}
              className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === "reservas" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
              }`}
            >
              Reserva de Espaços ({reservas.length})
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: Mural Digital */}
      {activeTab === "mural" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-emerald-500" />
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                Mural Digital Oficial do Edifício
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setNovoAvisoModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Publicar Novo Comunicado</span>
            </button>
          </div>

          {avisosMural.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Bell className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">Mural Digital Vazio</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Não existem comunicados afixados no mural deste condomínio. Clique em &quot;Publicar Novo Comunicado&quot; para partilhar avisos, regras ou intervenções com os condóminos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {avisosMural.map(aviso => (
                <div 
                  key={aviso.id_aviso_mural}
                  className={`p-5 rounded-3xl border transition-all space-y-3 relative shadow-sm ${
                    aviso.fixado_topo 
                      ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/80 ring-1 ring-emerald-500/20" 
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {aviso.fixado_topo && (
                    <div className="absolute top-4 right-4 flex items-center gap-1 text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md">
                      <Pin className="h-3 w-3 fill-emerald-600" />
                      <span>Fixado</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 font-mono">
                      <span>{aviso.data_publicacao}</span>
                      <span>•</span>
                      <span className="text-emerald-600 font-sans uppercase tracking-wider">{aviso.tipo}</span>
                    </div>
                    <h4 className="font-black text-base text-slate-900 dark:text-white leading-snug pr-16">
                      {aviso.titulo}
                    </h4>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {aviso.conteudo}
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <span className="text-[11px] text-slate-400">Por: <strong>{aviso.autor}</strong></span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAvisosMural(prev => prev.map(a => a.id_aviso_mural === aviso.id_aviso_mural ? { ...a, reacoes_gostos: a.reacoes_gostos + 1 } : a));
                        }}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-500 transition-colors cursor-pointer bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700"
                      >
                        <Heart className="h-3.5 w-3.5 text-red-500" />
                        <span className="font-mono font-bold">{aviso.reacoes_gostos}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Deseja eliminar este comunicado do mural?")) {
                            setAvisosMural(prev => prev.filter(a => a.id_aviso_mural !== aviso.id_aviso_mural));
                          }
                        }}
                        title="Eliminar comunicado"
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer rounded-md"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Reservas de Espaços Comuns */}
      {activeTab === "reservas" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-emerald-500" />
                <span>Gestão de Reservas de Espaços Comuns</span>
              </h3>
              <p className="text-xs text-slate-400">Salão de Festas do Edifício, Churrasqueira & Terraço Comum.</p>
            </div>

            <button
              type="button"
              onClick={() => setNovaReservaModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Reserva</span>
            </button>
          </div>

          {reservas.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CalendarCheck className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">Sem Reservas Agendadas</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Não existem reservas ativas de espaços comuns. Clique em &quot;Nova Reserva&quot; para registar um agendamento do Salão de Festas, Churrasqueira ou Terraço.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reservas.map(reserva => (
                <div 
                  key={reserva.id_reserva}
                  className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-xl">
                        {reserva.espaco === "SALAO_CONDOMINIO" ? <PartyPopper className="h-5 w-5" /> : <Flame className="h-5 w-5" />}
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-slate-900 dark:text-white">
                          {reserva.espaco.replace(/_/g, " ")} • Fração {reserva.fracao_nome} ({reserva.solicitante_nome})
                        </h4>
                        <span className="text-xs text-slate-400 font-mono">
                          Data: {reserva.data_evento} • Horário: {reserva.hora_inicio} às {reserva.hora_fim}
                        </span>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                      reserva.estado === "CONFIRMADA" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}>
                      {reserva.estado === "CONFIRMADA" ? "✓ Confirmada" : "⏳ Pendente Aprovação"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl text-xs font-mono">
                    <div>
                      <span className="text-slate-400 text-[10px] block font-sans">Finalidade do Evento</span>
                      <strong className="text-slate-800 dark:text-slate-200">{reserva.finalidade}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block font-sans">Lotação Prevista</span>
                      <span className="text-slate-700 dark:text-slate-300">{reserva.num_pessoas_estimado} Pessoas</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block font-sans">Caução de Limpeza</span>
                      <strong className={reserva.caucao_paga ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                        {reserva.valor_caucao?.toFixed(2) || "50.00"} € ({reserva.caucao_paga ? "Paga" : "Pendente"})
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    {reserva.estado === "PENDENTE_APROVACAO" ? (
                      <button
                        type="button"
                        onClick={() => handleAprovarReserva(reserva.id_reserva)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Aprovar Reserva & Registar Caução</span>
                      </button>
                    ) : (
                      <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Espaço Reservado e Confirmado</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Deseja cancelar e remover esta reserva?")) {
                          setReservas(prev => prev.filter(r => r.id_reserva !== reserva.id_reserva));
                        }
                      }}
                      title="Cancelar Reserva"
                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer rounded-lg flex items-center gap-1 text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Cancelar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Publicar Aviso */}
      {novoAvisoModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-zoom-in">
            <div className="bg-slate-900 p-5 text-white flex justify-between items-center border-b border-emerald-500/30">
              <h3 className="font-bold text-sm">Publicar Comunicado no Mural Digital</h3>
              <button 
                type="button" 
                onClick={() => setNovoAvisoModalOpen(false)} 
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCriarAviso} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Título do Comunicado</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Intervenção nos Elevadores / Reunião Extraordinária"
                  value={novoTitulo}
                  onChange={e => setNovoTitulo(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Tipo</label>
                  <select
                    value={novoTipo}
                    onChange={e => setNovoTipo(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                  >
                    <option value="INFORMATIVO">Informativo Geral</option>
                    <option value="OBRAS">Obras & Manutenção</option>
                    <option value="REUNIAO">Assembleia / Reunião</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="fixar-topo"
                    checked={novoFixado}
                    onChange={e => setNovoFixado(e.target.checked)}
                    className="h-4 w-4 text-emerald-600 rounded"
                  />
                  <label htmlFor="fixar-topo" className="font-bold text-slate-700 dark:text-slate-300">
                    Fixar no topo do mural
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Texto do Comunicado</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Escreva a mensagem clara para todos os condóminos..."
                  value={novoConteudo}
                  onChange={e => setNovoConteudo(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNovoAvisoModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl cursor-pointer shadow-md"
                >
                  Publicar Aviso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nova Reserva */}
      {novaReservaModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-zoom-in">
            <div className="bg-slate-900 p-5 text-white flex justify-between items-center border-b border-emerald-500/30">
              <h3 className="font-bold text-sm">Agendar Reserva de Espaço Comum</h3>
              <button 
                type="button" 
                onClick={() => setNovaReservaModalOpen(false)} 
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCriarReserva} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Fração Solicitante</label>
                  <select
                    value={resFracaoId}
                    onChange={e => setResFracaoId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                  >
                    {predioFracoes.map(f => (
                      <option key={f.id_fracao} value={f.id_fracao}>
                        Fração {f.fracao_nome} ({f.proprietario?.nome || "Vago"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Espaço Comum</label>
                  <select
                    value={resEspaco}
                    onChange={e => setResEspaco(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                  >
                    <option value="SALAO_CONDOMINIO">Salão do Condomínio</option>
                    <option value="CHURRASQUEIRA">Churrasqueira / Terraço</option>
                    <option value="TERRACO_COMUM">Terraço Superior</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Data</label>
                  <input
                    type="date"
                    required
                    value={resData}
                    onChange={e => setResData(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Início</label>
                  <input
                    type="time"
                    required
                    value={resHoraInicio}
                    onChange={e => setResHoraInicio(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Fim</label>
                  <input
                    type="time"
                    required
                    value={resHoraFim}
                    onChange={e => setResHoraFim(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Finalidade do Evento</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aniversário Infantil / Convívio Familiar"
                  value={resFinalidade}
                  onChange={e => setResFinalidade(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>O solicitante assume a responsabilidade pela limpeza e conservação do espaço após a utilização (Caução de 50€).</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNovaReservaModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl cursor-pointer shadow-md"
                >
                  Confirmar Reserva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
