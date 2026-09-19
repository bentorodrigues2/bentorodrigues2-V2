import React, { useState } from "react";
import { Predio, Fracao, LoggedUser, Reserva, CapacidadeLimite } from "../types";
import { formatDatePT, formatDateISO, parseValorMonetario } from "../utils";
import { saveReservaToSupabase, deleteReservaFromSupabase, registarLogAuditoria } from "../lib/supabaseService";

interface GestaoReservasProps {
  predio: Predio;
  fracoes: Fracao[];
  reservas: Reserva[];
  setReservas: React.Dispatch<React.SetStateAction<Reserva[]>>;
  capacidades: CapacidadeLimite[];
  setCapacidades: React.Dispatch<React.SetStateAction<CapacidadeLimite[]>>;
  loggedUser: LoggedUser;
}

const COMMON_AREAS = [
  { key: "Ginásio", name: "Ginásio Comum", icon: "fa-dumbbell", defaultLimit: 5 },
  { key: "Spa", name: "Piscina & Spa", icon: "fa-hot-tub-person", defaultLimit: 8 },
  { key: "Salão de Festas", name: "Salão de Festas", icon: "fa-champagne-glasses", defaultLimit: 40 },
  { key: "Churrasqueira", name: "Churrasqueira / BBQ", icon: "fa-fire-burner", defaultLimit: 15 }
];

const AMENITIES_BY_AREA: Record<string, string[]> = {
  "Ginásio": ["Acesso a Balneário Privado", "Toalhas Individuais de Treino", "Acesso a Virtual Trainer (IA)"],
  "Spa": ["Acesso Exclusivo a Sauna", "Kit Roupão e Toalha", "Sessão de Massagem Rápida"],
  "Salão de Festas": ["Sistema de Som Bluetooth JBL", "Projetor Digital Full HD", "Limpeza Profissional Pós-Evento", "Mesas e Cadeiras Extra"],
  "Churrasqueira": ["Saco de Carvão Vegetal", "Kit de Grelhas em Inox", "Utensílios de Cozinha para Grelhar"]
};

interface RegrasEspaco {
  area_comum: string;
  requer_aprovacao: boolean;
  duracao_maxima_horas: number;
  caucao: number;
  apenas_dias_uteis: boolean;
}

export function GestaoReservas({
  predio,
  fracoes,
  reservas,
  setReservas,
  capacidades,
  setCapacidades,
  loggedUser
}: GestaoReservasProps) {
  // Navigation tabs inside Reservas
  const [activeSubTab, setActiveSubTab] = useState<"regras" | "agenda" | "aprovacao" | "historico">("agenda");

  // Form states
  const [areaComum, setAreaComum] = useState("Ginásio");
  const [idFracao, setIdFracao] = useState("");
  const [data, setData] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [numPessoas, setNumPessoas] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [servicosEscolhidos, setServicosEscolhidos] = useState<string[]>([]);

  // Booking rules state
  const [regras, setRegras] = useState<RegrasEspaco[]>([
    { area_comum: "Ginásio", requer_aprovacao: false, duracao_maxima_horas: 2, caucao: 0, apenas_dias_uteis: false },
    { area_comum: "Spa", requer_aprovacao: true, duracao_maxima_horas: 1, caucao: 10, apenas_dias_uteis: false },
    { area_comum: "Salão de Festas", requer_aprovacao: true, duracao_maxima_horas: 8, caucao: 100, apenas_dias_uteis: false },
    { area_comum: "Churrasqueira", requer_aprovacao: false, duracao_maxima_horas: 4, caucao: 20, apenas_dias_uteis: false }
  ]);

  // Filter to current building
  const predioFracoes = fracoes.filter(f => f.id_predio === predio.id_predio);
  
  // Current local date anchor is 2026-07-15
  const anchorDateStr = "2026-07-15";

  // Filter reservations based on active sub tab
  const getFilteredReservas = () => {
    const base = reservas.filter(r => r.id_predio === predio.id_predio);
    
    if (activeSubTab === "aprovacao") {
      return base.filter(r => r.estado === "Pendente");
    }
    
    if (activeSubTab === "historico") {
      // Past dates or non-approved
      return base.filter(r => {
        const isPast = compareDates(r.data, anchorDateStr) < 0;
        return isPast || r.estado === "Rejeitado";
      });
    }

    if (activeSubTab === "agenda") {
      // Future dates that are approved (or default approved)
      return base.filter(r => {
        const isFutureOrToday = compareDates(r.data, anchorDateStr) >= 0;
        const isApproved = r.estado === "Aprovado" || !r.estado;
        return isFutureOrToday && isApproved;
      });
    }

    return base;
  };

  // Date comparator (format DD-MM-YYYY compared with YYYY-MM-DD or standard parse)
  const compareDates = (datePT: string, dateAnchorISO: string) => {
    // datePT is e.g. "18-07-2026" -> split to "2026-07-18"
    const parts = datePT.split("-");
    if (parts.length !== 3) return 0;
    const datePT_ISO = `${parts[2]}-${parts[1]}-${parts[0]}`;
    return datePT_ISO.localeCompare(dateAnchorISO);
  };

  // Set limits local display states
  const getCapacidadeLimit = (area: string) => {
    const found = capacidades.find(c => c.area_comum === area);
    if (found) return found.limite;
    const defaultVal = COMMON_AREAS.find(a => a.key === area)?.defaultLimit || 10;
    return defaultVal;
  };

  const getRegraForArea = (area: string) => {
    return regras.find(r => r.area_comum === area) || {
      area_comum: area,
      requer_aprovacao: false,
      duracao_maxima_horas: 3,
      caucao: 0,
      apenas_dias_uteis: false
    };
  };

  const handleUpdateLimit = (area: string, novoLimite: number) => {
    if (loggedUser.role !== "ADMIN") {
      return alert("Apenas administradores podem alterar as regras de capacidade limite!");
    }
    const exist = capacidades.some(c => c.area_comum === area);
    if (exist) {
      setCapacidades(prev => prev.map(c => c.area_comum === area ? { ...c, limite: novoLimite } : c));
    } else {
      setCapacidades(prev => [...prev, { area_comum: area, limite: novoLimite }]);
    }
  };

  const handleUpdateRegra = (area: string, key: keyof RegrasEspaco, value: any) => {
    if (loggedUser.role !== "ADMIN") {
      return alert("Apenas administradores podem alterar as regras regulamentares!");
    }
    setRegras(prev => prev.map(r => r.area_comum === area ? { ...r, [key]: value } : r));
  };

  const submeterReserva = (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaComum || !idFracao || !data || !horaInicio || !horaFim || !numPessoas) {
      return alert("Por favor preencha todos os campos obrigatórios (*)");
    }

    const numPessoasNum = Number(numPessoas);
    if (numPessoasNum <= 0) {
      return alert("O número de pessoas tem de ser maior que zero!");
    }

    // Capacity Limit Validation check
    const maxLimit = getCapacidadeLimit(areaComum);
    if (numPessoasNum > maxLimit) {
      return alert(
        `Impossível realizar reserva! A capacidade máxima configurada para o espaço "${areaComum}" é de ${maxLimit} pessoas. O seu pedido de reserva (${numPessoasNum} pessoas) excede este limite de segurança regulamentar.`
      );
    }

    // Rules validation: duration
    const rule = getRegraForArea(areaComum);
    const [startH, startM] = horaInicio.split(":").map(Number);
    const [endH, endM] = horaFim.split(":").map(Number);
    const durHours = (endH + endM / 60) - (startH + startM / 60);
    if (durHours <= 0) {
      return alert("A hora de fim tem de ser posterior à hora de início!");
    }
    if (durHours > rule.duracao_maxima_horas) {
      return alert(
        `Impossível reservar! A regra regulamentar para o espaço "${areaComum}" estipula um limite de duração máxima de ${rule.duracao_maxima_horas} horas por utilização.`
      );
    }

    // Rules validation: weekday check
    if (rule.apenas_dias_uteis) {
      const d = new Date(data);
      const day = d.getDay(); // 0 is Sunday, 6 is Saturday
      if (day === 0 || day === 6) {
        return alert(
          `Impossível reservar! A regra regulamentar para o espaço "${areaComum}" dita utilização exclusiva em dias úteis (Segunda a Sexta-feira).`
        );
      }
    }

    // Overlap validation (for the same day and overlapping time)
    const formattedDate = formatDatePT(data);
    const predioReservas = reservas.filter(r => r.id_predio === predio.id_predio && (r.estado === "Aprovado" || !r.estado));
    const hasOverlap = predioReservas.some(r => {
      if (r.area_comum !== areaComum || r.data !== formattedDate) return false;
      return (horaInicio < r.hora_fim) && (horaFim > r.hora_inicio);
    });

    if (hasOverlap && (areaComum === "Salão de Festas" || areaComum === "Churrasqueira")) {
      return alert(
        `Conflito de Horário! O espaço "${areaComum}" já se encontra reservado e aprovado para outro condómino no dia ${formattedDate} dentro do horário selecionado.`
      );
    }

    const matchingFrac = predioFracoes.find(f => f.id_fracao === idFracao);
    const finalResponsavel = responsavel || matchingFrac?.proprietario.nome || "Morador";

    // Determine initial status based on rules and role
    // Admins bypass approval, or if rule does not require approval
    const needsApproval = rule.requer_aprovacao && loggedUser.role !== "ADMIN";
    const initialStatus = needsApproval ? "Pendente" : "Aprovado";

    const nova: Reserva = {
      id_reserva: "res-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      id_predio: predio.id_predio,
      id_fracao: idFracao,
      area_comum: areaComum,
      data: formattedDate,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      responsavel: finalResponsavel,
      num_pessoas: numPessoasNum,
      estado: initialStatus,
      servicos_adicionais: servicosEscolhidos
    };

    setReservas([...reservas, nova]);
    saveReservaToSupabase(nova).catch(console.error);
    registarLogAuditoria("Reservas", `Criou uma reserva para "${areaComum}"`, predio.id_predio, loggedUser, `${formattedDate} ${horaInicio}-${horaFim}`);

    if (needsApproval) {
      alert(`O seu pedido de reserva para o espaço "${areaComum}" foi submetido com sucesso! Como este espaço requer aprovação regulamentar, a reserva aguarda validação por parte da Administração.`);
      setActiveSubTab("aprovacao");
    } else {
      alert(`Reserva no espaço "${areaComum}" registada e aprovada com sucesso!`);
      setActiveSubTab("agenda");
    }
    
    // Clear form
    setData("");
    setHoraInicio("");
    setHoraFim("");
    setNumPessoas("");
    setResponsavel("");
    setServicosEscolhidos([]);
  };

  const enviarEmailReserva = async (reserva: Reserva, aprovado: boolean, motivo?: string) => {
    const frac = predioFracoes.find(f => f.id_fracao === reserva.id_fracao);
    const email = frac?.proprietario?.email;
    if (!email) return;
    try {
      await fetch("/api/email?acao=notificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          nomeDestinatario: frac?.proprietario?.nome || reserva.responsavel,
          assunto: aprovado
            ? `Reserva Confirmada — ${reserva.area_comum} em ${reserva.data}`
            : `Reserva Não Aprovada — ${reserva.area_comum} em ${reserva.data}`,
          mensagem: aprovado
            ? `A sua reserva do espaço <strong>${reserva.area_comum}</strong> no dia <strong>${reserva.data}</strong>, entre as ${reserva.hora_inicio} e as ${reserva.hora_fim}, foi confirmada pela Administração.`
            : `A sua reserva do espaço <strong>${reserva.area_comum}</strong> no dia <strong>${reserva.data}</strong> não foi aprovada.<br><br><strong>Motivo:</strong> ${motivo || "Não especificado."}`
        })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveReserva = (id: string) => {
    if (loggedUser.role !== "ADMIN") return alert("Apenas administradores podem aprovar reservas!");
    const alvo = reservas.find(r => r.id_reserva === id);
    setReservas(prev => prev.map(r => r.id_reserva === id ? { ...r, estado: "Aprovado" } : r));
    if (alvo) {
      const atualizada = { ...alvo, estado: "Aprovado" as const };
      saveReservaToSupabase(atualizada).catch(console.error);
      registarLogAuditoria("Reservas", `Aprovou a reserva de "${alvo.area_comum}"`, predio.id_predio, loggedUser);
      enviarEmailReserva(atualizada, true);
    }
    alert("Reserva aprovada com sucesso! O condómino foi notificado.");
  };

  const handleRejectReserva = (id: string) => {
    if (loggedUser.role !== "ADMIN") return alert("Apenas administradores podem rejeitar reservas!");
    const motivo = prompt("Indique o motivo da rejeição regulamentar:", "Conflito regulamentar ou falta de depósito de caução");
    if (motivo === null) return; // cancel
    const alvo = reservas.find(r => r.id_reserva === id);
    setReservas(prev => prev.map(r => r.id_reserva === id ? { ...r, estado: "Rejeitado" } : r));
    if (alvo) {
      const atualizada = { ...alvo, estado: "Rejeitado" as const };
      saveReservaToSupabase(atualizada).catch(console.error);
      registarLogAuditoria("Reservas", `Rejeitou a reserva de "${alvo.area_comum}"`, predio.id_predio, loggedUser, motivo);
      enviarEmailReserva(atualizada, false, motivo);
    }
    alert(`Reserva rejeitada. Motivo comunicado: "${motivo}".`);
  };

  const eliminarReserva = (id: string) => {
    const conf = confirm("Deseja realmente cancelar/remover esta reserva?");
    if (conf) {
      const alvo = reservas.find(r => r.id_reserva === id);
      setReservas(prev => prev.filter(r => r.id_reserva !== id));
      deleteReservaFromSupabase(id).catch(console.error);
      if (alvo) {
        registarLogAuditoria("Reservas", `Eliminou a reserva de "${alvo.area_comum}"`, predio.id_predio, loggedUser);
        if (alvo.estado === "Aprovado") {
          enviarEmailReserva(alvo, false, "A reserva foi cancelada pela Administração.");
        }
      }
    }
  };

  const getValidationError = () => {
    if (!idFracao) return "Selecione a Fração Solicitante";
    if (!data) return "Selecione a Data da Reserva";
    if (!horaInicio || !horaFim) return "Insira as Horas de Início e Fim";

    const numP = Number(numPessoas);
    if (isNaN(numP) || numP <= 0) return "Número de pessoas inválido";

    const maxLimit = getCapacidadeLimit(areaComum);
    if (numP > maxLimit) {
      return `Lotação máxima de ${maxLimit} pessoas excedida`;
    }

    const rule = getRegraForArea(areaComum);
    const [startH, startM] = horaInicio.split(":").map(Number);
    const [endH, endM] = horaFim.split(":").map(Number);
    const durHours = (endH + endM / 60) - (startH + startM / 60);
    if (durHours <= 0) {
      return "Hora de fim deve ser posterior à de início";
    }
    if (durHours > rule.duracao_maxima_horas) {
      return `Duração máxima de ${rule.duracao_maxima_horas} horas excedida`;
    }

    if (rule.apenas_dias_uteis) {
      const d = new Date(data);
      const day = d.getDay(); // 0 is Sunday, 6 is Saturday
      if (day === 0 || day === 6) {
        return "Disponível apenas em dias úteis";
      }
    }

    return null; // Valid!
  };

  const validationError = getValidationError();

  return (
    <div className="space-y-6">
      {/* Header and Summary */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center">
            <i className="fa-solid fa-hotel text-emerald-500 mr-2.5"></i>
            Gestão de Espaços Comuns & Reservas (Piscina, Ginásio, Spa, BBQ)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gestão inteligente de agendamentos, regras regulamentares de segurança, aprovação prévia de eventos e histórico do condomínio.
          </p>
        </div>

        {/* Tab switch navigation */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shrink-0">
          <button
            onClick={() => setActiveSubTab("agenda")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeSubTab === "agenda"
                ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <i className="fa-regular fa-calendar-days mr-1.5"></i> Agenda de Reservas
          </button>
          
          <button
            onClick={() => setActiveSubTab("regras")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeSubTab === "regras"
                ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <i className="fa-solid fa-gavel mr-1.5"></i> Regras Regulamentares
          </button>

          <button
            onClick={() => setActiveSubTab("aprovacao")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all relative cursor-pointer ${
              activeSubTab === "aprovacao"
                ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <i className="fa-solid fa-circle-check mr-1.5"></i> Pedidos Pendentes
            {reservas.filter(r => r.id_predio === predio.id_predio && r.estado === "Pendente").length > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white font-bold h-4 w-4 rounded-full text-[9px] flex items-center justify-center animate-bounce">
                {reservas.filter(r => r.id_predio === predio.id_predio && r.estado === "Pendente").length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab("historico")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeSubTab === "historico"
                ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <i className="fa-solid fa-clock-rotate-left mr-1.5"></i> Histórico
          </button>
        </div>
      </div>

      {/* RENDER ACTIVE TAB */}

      {/* --- REGRAS REGULAMENTARES TAB --- */}
      {activeSubTab === "regras" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-5">
            <div className="bg-white dark:bg-[#0f172a] p-6 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center">
                <i className="fa-solid fa-sliders text-emerald-500 mr-2"></i>
                Capacidades de Segurança
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Configure os limites máximos de lotação simultânea autorizada por razões sanitárias e de segurança.
              </p>

              <div className="space-y-4 pt-2">
                {COMMON_AREAS.map(area => {
                  const currentLimit = getCapacidadeLimit(area.key);
                  return (
                    <div key={area.key} className="p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-800/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div className="h-7 w-7 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                            <i className={`fa-solid ${area.icon} text-xs`}></i>
                          </div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{area.name}</span>
                        </div>
                        <span className="text-xs font-mono-custom font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 rounded">
                          Máx: {currentLimit} pax
                        </span>
                      </div>

                      {loggedUser.role === "ADMIN" ? (
                        <div className="flex items-center space-x-2 pt-1">
                          <input 
                            type="range" 
                            min="1" 
                            max={area.key === "Salão de Festas" ? "100" : "30"} 
                            value={currentLimit}
                            onChange={(e) => handleUpdateLimit(area.key, Number(e.target.value))}
                            className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg"
                          />
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic">
                          Apenas administradores podem ajustar capacidades.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white dark:bg-[#0f172a] p-6 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center">
                <i className="fa-solid fa-scale-balanced text-emerald-500 mr-2"></i>
                Regulamento Específico de Utilização
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Configure os parâmetros que as reservas devem obedecer para garantir uma coabitação saudável no edifício.
              </p>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {COMMON_AREAS.map(area => {
                  const rule = getRegraForArea(area.key);
                  return (
                    <div key={area.key} className="py-4 first:pt-0 last:pb-0 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <i className={`fa-solid ${area.icon} text-slate-400 text-xs`}></i>
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{area.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">Regras regulamentares</p>
                      </div>

                      <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="flex flex-col">
                          <label className="text-[10px] uppercase font-bold text-slate-400">Aprovação Prévia</label>
                          <select
                            value={rule.requer_aprovacao ? "true" : "false"}
                            disabled={loggedUser.role !== "ADMIN"}
                            onChange={e => handleUpdateRegra(area.key, "requer_aprovacao", e.target.value === "true")}
                            className="mt-1 border border-slate-200 dark:border-slate-800 px-2 py-1 text-xs rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                          >
                            <option value="false">Isento</option>
                            <option value="true">Requerida</option>
                          </select>
                        </div>

                        <div className="flex flex-col">
                          <label className="text-[10px] uppercase font-bold text-slate-400">Duração Max (h)</label>
                          <input
                            type="number"
                            min="1"
                            max="24"
                            value={rule.duracao_maxima_horas}
                            disabled={loggedUser.role !== "ADMIN"}
                            onChange={e => handleUpdateRegra(area.key, "duracao_maxima_horas", Number(e.target.value))}
                            className="mt-1 border border-slate-200 dark:border-slate-800 px-2 py-1 text-xs rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-mono-custom"
                          />
                        </div>

                        <div className="flex flex-col">
                          <label className="text-[10px] uppercase font-bold text-slate-400">Caução Requerida (€)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={rule.caucao}
                            disabled={loggedUser.role !== "ADMIN"}
                            onChange={e => handleUpdateRegra(area.key, "caucao", parseValorMonetario(e.target.value))}
                            className="mt-1 border border-slate-200 dark:border-slate-800 px-2 py-1 text-xs rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-mono-custom"
                          />
                        </div>

                        <div className="flex flex-col">
                          <label className="text-[10px] uppercase font-bold text-slate-400">Dias Úteis Apenas</label>
                          <select
                            value={rule.apenas_dias_uteis ? "true" : "false"}
                            disabled={loggedUser.role !== "ADMIN"}
                            onChange={e => handleUpdateRegra(area.key, "apenas_dias_uteis", e.target.value === "true")}
                            className="mt-1 border border-slate-200 dark:border-slate-800 px-2 py-1 text-xs rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                          >
                            <option value="false">Livre</option>
                            <option value="true">Sim</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- AGENDA & FORM TAB --- */}
      {activeSubTab === "agenda" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Reservation Request Form */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-[#0f172a] p-6 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm space-y-4 sticky top-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center">
                <i className="fa-solid fa-calendar-plus text-emerald-500 mr-2"></i>
                Agendar Espaço Comum
              </h3>
              <p className="text-xs text-slate-400">
                Selecione o espaço comum pretendido e insira os dados necessários de utilização.
              </p>

              <form onSubmit={submeterReserva} className="space-y-4">
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Espaço Comum Pretendido *</label>
                  <select 
                    value={areaComum} 
                    onChange={e => {
                      setAreaComum(e.target.value);
                      setServicosEscolhidos([]);
                    }} 
                    className="border border-slate-200 dark:border-slate-800 p-2.5 text-xs rounded-lg bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200"
                  >
                    {COMMON_AREAS.map(a => (
                      <option key={a.key} value={a.key}>{a.name} (Lotação: {getCapacidadeLimit(a.key)} pax)</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Fração Solicitante *</label>
                  <select 
                    value={idFracao} 
                    onChange={e => {
                      setIdFracao(e.target.value);
                      const frac = predioFracoes.find(f => f.id_fracao === e.target.value);
                      if (frac) setResponsavel(frac.proprietario.nome);
                    }}
                    className="border border-slate-200 dark:border-slate-800 p-2.5 text-xs rounded-lg bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200"
                  >
                    <option value="">-- Selecione a Fração --</option>
                    {predioFracoes.map(f => (
                      <option key={f.id_fracao} value={f.id_fracao}>Fração {f.fracao_nome} - {f.proprietario.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Data da Reserva *</label>
                  <input 
                    type="date" 
                    value={data} 
                    onChange={e => setData(e.target.value)} 
                    className="border border-slate-200 dark:border-slate-800 p-2.5 text-xs rounded-lg bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200 font-mono-custom"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Hora de Início *</label>
                    <input 
                      type="time" 
                      value={horaInicio} 
                      onChange={e => setHoraInicio(e.target.value)} 
                      className="border border-slate-200 dark:border-slate-800 p-2 text-xs rounded-lg bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200 font-mono-custom"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Hora de Fim *</label>
                    <input 
                      type="time" 
                      value={horaFim} 
                      onChange={e => setHoraFim(e.target.value)} 
                      className="border border-slate-200 dark:border-slate-800 p-2 text-xs rounded-lg bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200 font-mono-custom"
                    />
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Número de Pessoas em simultâneo *</label>
                  <input 
                    type="number" 
                    min="1" 
                    placeholder="Ex: 3"
                    value={numPessoas} 
                    onChange={e => setNumPessoas(e.target.value)} 
                    className="border border-slate-200 dark:border-slate-800 p-2.5 text-xs rounded-lg bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200 font-mono-custom"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Responsável / Condómino</label>
                  <input 
                    type="text" 
                    placeholder="Nome do utente"
                    value={responsavel} 
                    onChange={e => setResponsavel(e.target.value)} 
                    className="border border-slate-200 dark:border-slate-800 p-2.5 text-xs rounded-lg bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200"
                  />
                </div>

                {/* SERVICES MULTI-CHOICE */}
                <div className="flex flex-col space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Equipamentos / Serviços Extras (Escolha Múltipla)</label>
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg space-y-2">
                    {(AMENITIES_BY_AREA[areaComum] || []).map(item => {
                      const isChecked = servicosEscolhidos.includes(item);
                      return (
                        <label key={item} className="flex items-center space-x-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setServicosEscolhidos(prev => prev.filter(x => x !== item));
                              } else {
                                setServicosEscolhidos(prev => [...prev, item]);
                              }
                            }}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer accent-emerald-500"
                          />
                          <span>{item}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* RULES VISUAL DISPLAY CARD */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Regras de Utilização ({areaComum}):</h4>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 dark:text-slate-300">
                    <div className="flex items-center space-x-1">
                      <span className="font-bold text-slate-400">Lotação:</span>
                      <span className="font-semibold text-emerald-600">{getCapacidadeLimit(areaComum)} pax</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="font-bold text-slate-400">Aprovação:</span>
                      <span className="font-semibold text-amber-600">{getRegraForArea(areaComum).requer_aprovacao ? "Necessária" : "Automática"}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="font-bold text-slate-400">Duração Máx:</span>
                      <span className="font-semibold">{getRegraForArea(areaComum).duracao_maxima_horas} horas</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="font-bold text-slate-400">Caução:</span>
                      <span className="font-semibold">{getRegraForArea(areaComum).caucao > 0 ? `${getRegraForArea(areaComum).caucao} €` : "Isento"}</span>
                    </div>
                  </div>
                  {getRegraForArea(areaComum).apenas_dias_uteis && (
                    <p className="text-[9px] text-red-500 font-bold mt-1">⚠️ Apenas disponível em dias úteis!</p>
                  )}
                </div>

                {/* CONDITIONAL SUBMIT RESERVA BUTTON */}
                <button 
                  type="submit" 
                  disabled={validationError !== null}
                  className={`px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer w-full flex items-center justify-center shadow-sm ${
                    validationError 
                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/35 cursor-not-allowed" 
                      : "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500"
                  }`}
                >
                  {validationError ? (
                    <>
                      <i className="fa-solid fa-triangle-exclamation mr-2"></i> {validationError}
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-calendar-check mr-2"></i> Submeter Reserva & Confirmar Segurança
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Agenda List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-[#0f172a] p-6 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center">
                  <i className="fa-solid fa-table-list text-emerald-500 mr-2"></i>
                  Agenda de Utilização (Futuras e Aprovadas)
                </h3>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full font-mono-custom font-bold">
                  {getFilteredReservas().length} Ativas
                </span>
              </div>

              {getFilteredReservas().length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <i className="fa-regular fa-calendar text-4xl text-slate-300"></i>
                  <p className="text-xs">Não existem reservas agendadas pendentes de realização.</p>
                </div>
              ) : (
                <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                        <th className="p-3">Espaço Comum</th>
                        <th className="p-3">Data & Horário</th>
                        <th className="p-3">Fração / Responsável</th>
                        <th className="p-3 text-center">Utentes</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {getFilteredReservas().map(r => {
                        const area = COMMON_AREAS.find(a => a.key === r.area_comum);
                        const matchingFrac = fracoes.find(f => f.id_fracao === r.id_fracao);
                        const rule = getRegraForArea(r.area_comum);
                        return (
                          <tr key={r.id_reserva} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 text-slate-700 dark:text-slate-300">
                            <td className="p-3 font-semibold flex items-center space-x-2">
                              <div className="h-6 w-6 rounded-md bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                <i className={`fa-solid ${area?.icon || "fa-calendar"}`}></i>
                              </div>
                              <span>{r.area_comum}</span>
                            </td>
                            <td className="p-3 font-mono-custom">
                              <p className="font-semibold text-slate-900 dark:text-slate-100">{r.data}</p>
                              <p className="text-[10px] text-slate-400">{r.hora_inicio}h às {r.hora_fim}h</p>
                            </td>
                            <td className="p-3">
                              <p className="font-semibold text-slate-800 dark:text-slate-200">Fração {matchingFrac?.fracao_nome || "N/A"}</p>
                              <p className="text-[10px] text-slate-400">{r.responsavel}</p>
                              {r.servicos_adicionais && r.servicos_adicionais.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {r.servicos_adicionais.map(svc => (
                                    <span key={svc} className="text-[8px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1 py-0.5 rounded font-bold">
                                      📦 {svc}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono-custom bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                {r.num_pessoas} pax
                              </span>
                              {rule.caucao > 0 && (
                                <p className="text-[9px] text-amber-500 font-semibold mt-1">Caução: {rule.caucao}€</p>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <button 
                                onClick={() => eliminarReserva(r.id_reserva)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 p-1.5 rounded transition-colors cursor-pointer"
                                title="Cancelar Reserva"
                              >
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- PEDIDOS PENDENTES TAB (APROVAÇÃO) --- */}
      {activeSubTab === "aprovacao" && (
        <div className="bg-white dark:bg-[#0f172a] p-6 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center">
              <i className="fa-solid fa-circle-question text-amber-500 mr-2"></i>
              Controlo de Aprovação de Reservas Pendentes (Administração)
            </h3>
            <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold px-3 py-1 rounded text-xs">
              {getFilteredReservas().length} em espera
            </span>
          </div>

          {getFilteredReservas().length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <i className="fa-solid fa-circle-check text-4xl text-emerald-500"></i>
              <p className="text-xs">Não existem pedidos de reserva pendentes de aprovação.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getFilteredReservas().map(r => {
                const area = COMMON_AREAS.find(a => a.key === r.area_comum);
                const matchingFrac = fracoes.find(f => f.id_fracao === r.id_fracao);
                const rule = getRegraForArea(r.area_comum);
                return (
                  <div key={r.id_reserva} className="border border-slate-150 dark:border-slate-800 rounded-xl p-5 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col justify-between space-y-4 shadow-sm">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center space-x-2">
                          <i className={`fa-solid ${area?.icon || "fa-calendar"} text-emerald-500`}></i>
                          <span>{r.area_comum}</span>
                        </span>
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded">
                          PENDENTE DE APROVAÇÃO
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Fração / Condómino</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">Fração {matchingFrac?.fracao_nome || "N/A"}</p>
                          <p className="text-slate-400 text-[10px]">{r.responsavel}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Data & Horário</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 font-mono-custom">{r.data}</p>
                          <p className="text-slate-400 text-[10px] font-mono-custom">{r.hora_inicio}h às {r.hora_fim}h</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Lotação Planeada</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200 font-mono-custom">{r.num_pessoas} pessoas</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Caução Regulamentar</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200 font-mono-custom">
                            {rule.caucao > 0 ? `${rule.caucao} €` : "Isento"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      {loggedUser.role === "ADMIN" ? (
                        <>
                          <button
                            onClick={() => handleApproveReserva(r.id_reserva)}
                            className="flex-grow bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded text-xs transition-colors cursor-pointer"
                          >
                            <i className="fa-solid fa-check mr-1.5"></i> Aprovar Reserva
                          </button>
                          <button
                            onClick={() => handleRejectReserva(r.id_reserva)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 font-bold py-1.5 px-3 rounded text-xs border border-red-200 transition-colors cursor-pointer"
                          >
                            <i className="fa-solid fa-times mr-1.5"></i> Rejeitar
                          </button>
                        </>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic text-center w-full">
                          Apenas utilizadores com perfil ADMIN podem validar ou aprovar reservas.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- HISTÓRICO DE RESERVAS TAB --- */}
      {activeSubTab === "historico" && (
        <div className="bg-white dark:bg-[#0f172a] p-6 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center">
              <i className="fa-solid fa-history text-slate-500 mr-2"></i>
              Histórico Geral de Utilizações Passadas & Canceladas
            </h3>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full font-mono-custom font-bold">
              {getFilteredReservas().length} Registos
            </span>
          </div>

          {getFilteredReservas().length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-12">
              Não existem registos arquivados no histórico deste prédio.
            </p>
          ) : (
            <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                    <th className="p-3">Espaço Comum</th>
                    <th className="p-3">Data & Horário</th>
                    <th className="p-3">Fração / Responsável</th>
                    <th className="p-3 text-center">Utentes</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {getFilteredReservas().map(r => {
                    const area = COMMON_AREAS.find(a => a.key === r.area_comum);
                    const matchingFrac = fracoes.find(f => f.id_fracao === r.id_fracao);
                    return (
                      <tr key={r.id_reserva} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 text-slate-700 dark:text-slate-300">
                        <td className="p-3 font-semibold flex items-center space-x-2">
                          <i className={`fa-solid ${area?.icon || "fa-calendar"} text-slate-400`}></i>
                          <span>{r.area_comum}</span>
                        </td>
                        <td className="p-3 font-mono-custom">
                          <p className="font-semibold">{r.data}</p>
                          <p className="text-[10px] text-slate-400">{r.hora_inicio}h às {r.hora_fim}h</p>
                        </td>
                        <td className="p-3">
                          <p className="font-semibold">Fração {matchingFrac?.fracao_nome || "N/A"}</p>
                          <p className="text-[10px] text-slate-400">{r.responsavel}</p>
                        </td>
                        <td className="p-3 text-center font-mono-custom">
                          {r.num_pessoas} pax
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              r.estado === "Aprovado" || !r.estado
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : r.estado === "Rejeitado"
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {r.estado || "Aprovado"}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button 
                            onClick={() => {
                              if (confirm("Deseja eliminar definitivamente este registo histórico?")) {
                                setReservas(prev => prev.filter(item => item.id_reserva !== r.id_reserva));
                                deleteReservaFromSupabase(r.id_reserva).catch(console.error);
                              }
                            }}
                            className="p-1.5 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-300 rounded-lg transition-all cursor-pointer active:scale-90 active:ring-2 active:ring-red-400 select-none"
                            title="Eliminar do Arquivo"
                          >
                            <img src="/estados-acoes/14-eliminar.png" alt="Eliminar" className="h-3.5 w-3.5 object-contain" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
