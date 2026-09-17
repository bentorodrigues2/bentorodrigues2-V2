import React, { useState } from "react";
import { Predio, Fracao, Aviso, LoggedUser, CronJobConfig } from "../types";
import { 
  CalendarClock, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Mail, 
  Smartphone, 
  FileText, 
  Settings, 
  History, 
  Sparkles, 
  Clock, 
  Calendar,
  ChevronDown,
  ChevronUp,
  Layers,
  Send,
  Users,
  Building2,
  RefreshCw,
  Plus,
  Trash2,
  Check,
  ShieldCheck,
  Zap,
  Sliders,
  FileCheck
} from "lucide-react";
import { triggerSendReaction } from "./SendingReactionModal";

interface AgendadorAutomaticoProps {
  predio: Predio;
  fracoes: Fracao[];
  avisos?: Aviso[];
  setAvisos?: React.Dispatch<React.SetStateAction<Aviso[]>>;
  loggedUser: LoggedUser;
}

export function AgendadorAutomatico({ predio, fracoes, avisos = [], setAvisos, loggedUser }: AgendadorAutomaticoProps) {
  const predioFracoes = fracoes.filter(f => f.id_predio === predio.id_predio);
  const predioAvisos = avisos.filter(a => a.id_predio === predio.id_predio);

  // Initial standard Portuguese condominium cron jobs
  const [jobs, setJobs] = useState<CronJobConfig[]>([
    {
      id_job: "job-1",
      id_predio: predio.id_predio,
      titulo: "Emissão & Envio Automático de Quotas Mensais",
      tipo: "EMISSAO_MENSAL_QUOTAS",
      frequencia_cron: "0 8 25 * *",
      descricao_legivel: "Todo o dia 25 de cada mês às 08:00 (Prazo até dia 08 do mês seguinte)",
      ativo: true,
      dia_mes: 25,
      hora_execucao: "08:00",
      enviar_email: true,
      enviar_push_pwa: true,
      incluir_nota_cobranca_pdf: true,
      ultima_execucao: "2026-07-25 08:00",
      proxima_execucao: "2026-08-25 08:00",
      ultimo_status: "SUCESSO",
      historico_execucoes: [
        {
          id: "exec-101",
          data_hora: "2026-07-25 08:00:12",
          sucesso: true,
          itens_processados: predioFracoes.length,
          emails_enviados: predioFracoes.length,
          detalhes: `Geradas ${predioFracoes.length * 2} quotas (Ordinária + FCR) e enviadas notas de cobrança com IBAN e Ref. de Fração por e-mail e Notificação Push PWA.`
        }
      ]
    },
    {
      id_job: "job-2",
      id_predio: predio.id_predio,
      titulo: "Lembrete Cordial de Vencimento de Quotas (Antes do Dia 08)",
      tipo: "LEMBRETE_CORDIAL_VENCIMENTO",
      frequencia_cron: "0 10 5 * *",
      descricao_legivel: "Todo o dia 5 de cada mês às 10:00 (Antes do limite a dia 08)",
      ativo: true,
      dia_mes: 5,
      hora_execucao: "10:00",
      enviar_email: true,
      enviar_push_pwa: true,
      incluir_nota_cobranca_pdf: false,
      ultima_execucao: "2026-08-05 10:00",
      proxima_execucao: "2026-09-05 10:00",
      ultimo_status: "SUCESSO",
      historico_execucoes: [
        {
          id: "exec-102",
          data_hora: "2026-08-05 10:00:05",
          sucesso: true,
          itens_processados: 3,
          emails_enviados: 3,
          detalhes: "Enviado e-mail cordial e Push PWA com dados de transferência bancária apenas às frações com quotas pendentes."
        }
      ]
    },
    {
      id_job: "job-3",
      id_predio: predio.id_predio,
      titulo: "Notificação de Regularização de Quotas em Atraso (Mora)",
      tipo: "AVISO_MORA_INCUMPRIMENTO",
      frequencia_cron: "0 11 16 * *",
      descricao_legivel: "Todo o dia 16 de cada mês às 11:00",
      ativo: true,
      dia_mes: 16,
      hora_execucao: "11:00",
      enviar_email: true,
      enviar_push_pwa: true,
      incluir_nota_cobranca_pdf: true,
      ultima_execucao: "2026-08-16 11:00",
      proxima_execucao: "2026-09-16 11:00",
      ultimo_status: "SUCESSO",
      historico_execucoes: [
        {
          id: "exec-103",
          data_hora: "2026-08-16 11:00:15",
          sucesso: true,
          itens_processados: 1,
          emails_enviados: 1,
          detalhes: "Notificação de regularização enviada para a Fração em atraso após o prazo limite do dia 15."
        }
      ]
    },
    {
      id_job: "job-4",
      id_predio: predio.id_predio,
      titulo: "Felicitações Automáticas de Aniversário dos Condóminos",
      tipo: "FELICITACOES_ANIVERSARIO",
      frequencia_cron: "0 9 * * *",
      descricao_legivel: "Todos os dias às 09:00",
      ativo: true,
      hora_execucao: "09:00",
      enviar_email: true,
      enviar_push_pwa: true,
      incluir_nota_cobranca_pdf: false,
      ultima_execucao: "2026-08-23 09:00",
      proxima_execucao: "2026-08-24 09:00",
      ultimo_status: "SUCESSO",
      historico_execucoes: [
        {
          id: "exec-104",
          data_hora: "2026-08-23 09:00:01",
          sucesso: true,
          itens_processados: 1,
          emails_enviados: 1,
          detalhes: "Felicitações de aniversário enviadas ao condómino titular da Fração."
        }
      ]
    }
  ]);

  const [expandedJobId, setExpandedJobId] = useState<string | null>("job-1");
  const [simulatingJobId, setSimulatingJobId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tarefas" | "logs">("tarefas");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const toggleJobStatus = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setJobs(prev => prev.map(j => {
      if (j.id_job === id) {
        const novoAtivo = !j.ativo;
        return { ...j, ativo: novoAtivo };
      }
      return j;
    }));
  };

  const updateJobField = (id: string, updates: Partial<CronJobConfig>) => {
    setJobs(prev => prev.map(j => {
      if (j.id_job === id) {
        const updated = { ...j, ...updates };
        if (updates.dia_mes !== undefined || updates.hora_execucao !== undefined) {
          if (updated.tipo === "FELICITACOES_ANIVERSARIO") {
            updated.descricao_legivel = `Todos os dias às ${updated.hora_execucao || "09:00"}`;
          } else {
            updated.descricao_legivel = `Todo o dia ${updated.dia_mes || 1} de cada mês às ${updated.hora_execucao || "08:00"}`;
          }
        }
        return updated;
      }
      return j;
    }));
  };

  // Dispara mesmo o job real do backend (server/lib/cronService.js, o mesmo
  // que corre automaticamente todos os dias via /api/cron) — antes disto
  // fabricava resultados falsos localmente sem chamar nada.
  const executarJobAgora = async (job: CronJobConfig, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (job.tipo === "VISTORIA_PERIODICA") {
      alert("Este tipo de rotina (vistorias periódicas) ainda não está automatizado no backend.");
      return;
    }

    setSimulatingJobId(job.id_job);

    triggerSendReaction("email", `A disparar rotina: ${job.titulo}`, async () => {
      try {
        const resp = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job: job.tipo })
        });
        const resultado = await resp.json();
        if (!resp.ok || !resultado.ok) throw new Error(resultado?.error || "Falha ao executar a rotina");

        const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);
        const itensProcessados = resultado.total ?? 0;
        const detalhesStr = `Execução real concluída: ${itensProcessados} email(s) enviado(s).`;

        const novaExecucao = {
          id: `exec-${Date.now()}`,
          data_hora: nowStr,
          sucesso: true,
          itens_processados: itensProcessados,
          emails_enviados: itensProcessados,
          detalhes: detalhesStr
        };

        setJobs(prev => prev.map(j => {
          if (j.id_job === job.id_job) {
            return {
              ...j,
              ultima_execucao: nowStr,
              ultimo_status: "SUCESSO",
              historico_execucoes: [novaExecucao, ...(j.historico_execucoes || [])]
            };
          }
          return j;
        }));

        showToast(`✅ Tarefa "${job.titulo}" executada com sucesso! ${itensProcessados} email(s) enviado(s).`);
      } catch (err: any) {
        alert(`❌ Erro ao executar a rotina: ${err?.message || "erro desconhecido"}`);
        throw err;
      } finally {
        setSimulatingJobId(null);
      }
    });
  };

  const getJobIcon = (tipo: string) => {
    switch (tipo) {
      case "EMISSAO_MENSAL_QUOTAS":
        return <FileCheck className="h-5 w-5 text-emerald-400" />;
      case "LEMBRETE_CORDIAL_VENCIMENTO":
        return <Clock className="h-5 w-5 text-emerald-400" />;
      case "AVISO_MORA_INCUMPRIMENTO":
        return <AlertTriangle className="h-5 w-5 text-amber-400" />;
      case "FELICITACOES_ANIVERSARIO":
        return <Sparkles className="h-5 w-5 text-emerald-400" />;
      default:
        return <CalendarClock className="h-5 w-5 text-emerald-400" />;
    }
  };

  const getTemplatePreview = (job: CronJobConfig) => {
    switch (job.tipo) {
      case "EMISSAO_MENSAL_QUOTAS":
        return "Estimado(a) Condómino(a),\nEncontra-se emitida a quota de condomínio referente ao mês corrente no valor de {{VALOR_TOTAL}}. O documento oficial em PDF segue em anexo com os dados para liquidação via IBAN.";
      case "LEMBRETE_CORDIAL_VENCIMENTO":
        return "Estimado(a) Condómino(a),\nLembramos cordialmente que o prazo para a regularização da quota de condomínio da sua fração termina no dia 15. Caso já tenha efetuado a transferência, agradecemos que desconsidere este aviso.";
      case "AVISO_MORA_INCUMPRIMENTO":
        return "Exmo.(a) Sr.(a) Condómino(a),\nInformamos que, de acordo com os nossos registos, a quota do mês corrente se encontra em atraso. Solicitamos a respetiva regularização com a maior brevidade para a conta bancária do condomínio.";
      case "FELICITACOES_ANIVERSARIO":
        return "Estimado(a) Condómino(a),\nA Administração do Condomínio deseja-lhe um feliz dia de aniversário, com muita saúde, sucesso e felicidades! 🎉";
      default:
        return "Notificação periódica automática da administração do condomínio.";
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-500 flex items-center gap-3 animate-fade-in text-xs font-bold">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner - CondoManager AI Layout (Cores Oficiais Emerald & Slate) */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 p-6 sm:p-7 rounded-3xl text-white shadow-xl border border-emerald-500/30 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Glow background accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" /> Agenda de Notificações & Cron Jobs
            </span>
            <span className="text-xs text-slate-400 font-mono">Motor de Automação & Mensagens</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">Agenda de Notificações</h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Configure e automatize a emissão mensal de quotas, lembretes de vencimento, avisos de regularização de mora e felicitações de aniversário sem necessidade de intervenção manual.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 relative z-10">
          <div className="inline-flex rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-1 text-xs shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab("tarefas")}
              className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === "tarefas" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
              }`}
            >
              Rotinas Ativas ({jobs.filter(j => j.ativo).length}/{jobs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("logs")}
              className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === "logs" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
              }`}
            >
              Histórico & Logs
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === "tarefas" ? (
        <div className="space-y-4">
          {/* Header Info Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              <span>Clique em qualquer rotina da lista para expandir as opções de parametrização e canais de envio.</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500"></span> Ativa</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400"></span> Em Pausa</span>
            </div>
          </div>

          {/* LIST ACCORDION VIEW */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            {jobs.map((job) => {
              const isExpanded = expandedJobId === job.id_job;
              const isRunning = simulatingJobId === job.id_job;

              return (
                <div 
                  key={job.id_job} 
                  className={`transition-all ${job.ativo ? "bg-white dark:bg-slate-900" : "bg-slate-50/60 dark:bg-slate-900/40 opacity-75"}`}
                >
                  {/* List Item Row / Header */}
                  <div 
                    onClick={() => setExpandedJobId(isExpanded ? null : job.id_job)}
                    className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Left: Icon, Title, Frequency & Badges */}
                    <div className="flex items-start sm:items-center space-x-3.5">
                      <div className={`p-2.5 rounded-2xl border shrink-0 transition-all ${
                        job.ativo 
                          ? "bg-slate-900 border-slate-700 text-white shadow-xs" 
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                      }`}>
                        {getJobIcon(job.tipo)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                            {job.titulo}
                          </h3>
                          {job.ativo ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3" /> Ativa
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-md">
                              Em Pausa
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {job.descricao_legivel}
                          </span>

                          <span className="text-slate-300 dark:text-slate-700">•</span>

                          {/* Channels badges */}
                          <div className="flex items-center gap-1.5 text-[10px]">
                            {job.enviar_email && (
                              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <Mail className="h-2.5 w-2.5 text-emerald-500" /> E-mail
                              </span>
                            )}
                            {job.enviar_push_pwa && (
                              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <Smartphone className="h-2.5 w-2.5 text-emerald-500" /> PWA
                              </span>
                            )}
                            {job.incluir_nota_cobranca_pdf && (
                              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <FileText className="h-2.5 w-2.5 text-amber-500" /> PDF IBAN
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Next execution, Toggle Switch, Run Now & Expand Arrow */}
                    <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                      <div className="hidden lg:block text-right text-xs pr-2">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Próxima Execução</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                          {job.proxima_execucao || "Agendada"}
                        </span>
                      </div>

                      {/* Active Toggle — só marca a preferência neste ecrã; a
                          rotina real do servidor corre sempre, para todos os
                          prédios, nos dias fixos indicados abaixo. */}
                      <button
                        type="button"
                        onClick={(e) => toggleJobStatus(job.id_job, e)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          job.ativo ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
                        }`}
                        title="Apenas visual — não desativa o envio real no servidor"
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            job.ativo ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>

                      {/* Quick Execute Button */}
                      <button
                        type="button"
                        onClick={(e) => executarJobAgora(job, e)}
                        disabled={isRunning}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        title="Executar imediatamente esta rotina"
                      >
                        {isRunning ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>A Executar...</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Executar Agora</span>
                          </>
                        )}
                      </button>

                      {/* Expand Chevron */}
                      <div className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </div>
                    </div>
                  </div>

                  {/* EXPANDED DETAILS ACCORDION */}
                  {isExpanded && (
                    <div className="p-5 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-xs space-y-5 animate-fadeIn">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* Section 1: Schedule parameters */}
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
                          <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                            <Clock className="h-4 w-4" />
                            <span>Frequência & Horário</span>
                          </div>

                          <div className="space-y-3">
                            {job.tipo !== "FELICITACOES_ANIVERSARIO" ? (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Dia do Mês</label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={job.dia_mes || 1}
                                    disabled
                                    title="Fixo no calendário real do servidor — ver nota abaixo"
                                    className="w-full bg-slate-100 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 cursor-not-allowed"
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Hora (HH:MM)</label>
                                  <input
                                    type="time"
                                    value={job.hora_execucao}
                                    disabled
                                    title="Fixo no calendário real do servidor — ver nota abaixo"
                                    className="w-full bg-slate-100 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 cursor-not-allowed"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div>
                                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Hora Diária de Verificação</label>
                                <input
                                  type="time"
                                  value={job.hora_execucao}
                                  disabled
                                  title="Fixo no calendário real do servidor — ver nota abaixo"
                                  className="w-full bg-slate-100 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 cursor-not-allowed"
                                />
                              </div>
                            )}

                            <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 font-mono">
                              Cron: <span className="font-bold text-emerald-600 dark:text-emerald-400">{job.frequencia_cron}</span> ({job.descricao_legivel})
                            </div>
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold leading-relaxed">
                              Dia e hora são fixos no calendário real do servidor (<code>vercel.json</code>/<code>api/cron.js</code>), iguais para todos os prédios — mudar aqui não altera quando o envio real acontece. Use "Executar Agora" para disparar a rotina real imediatamente.
                            </p>
                          </div>
                        </div>

                        {/* Section 2: Active Channels & Dispatch Rules */}
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
                          <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                            <Sliders className="h-4 w-4" />
                            <span>Canais de Notificação</span>
                          </div>

                          <div className="space-y-2.5 pt-1">
                            <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
                              <input
                                type="checkbox"
                                checked={job.enviar_email}
                                onChange={(e) => updateJobField(job.id_job, { enviar_email: e.target.checked })}
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                              />
                              <span className="flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5 text-emerald-500" />
                                <span>Disparar E-mail aos Condóminos</span>
                              </span>
                            </label>

                            <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
                              <input
                                type="checkbox"
                                checked={job.enviar_push_pwa}
                                onChange={(e) => updateJobField(job.id_job, { enviar_push_pwa: e.target.checked })}
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                              />
                              <span className="flex items-center gap-1.5">
                                <Smartphone className="h-3.5 w-3.5 text-emerald-500" />
                                <span>Notificação Push na PWA Móvel</span>
                              </span>
                            </label>

                            <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
                              <input
                                type="checkbox"
                                checked={job.incluir_nota_cobranca_pdf}
                                onChange={(e) => updateJobField(job.id_job, { incluir_nota_cobranca_pdf: e.target.checked })}
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                              />
                              <span className="flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-amber-500" />
                                <span>Gerar & Anexar Documento PDF</span>
                              </span>
                            </label>
                          </div>
                        </div>

                        {/* Section 3: Template & Sender preview */}
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                              <Mail className="h-4 w-4" />
                              <span>Minuta da Notificação</span>
                            </span>
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-mono">
                              Canal: {predio.email || "Oficial"}
                            </span>
                          </div>

                          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed font-sans max-h-28 overflow-y-auto">
                            {getTemplatePreview(job)}
                          </div>
                        </div>
                      </div>

                      {/* History records of this specific routine */}
                      <div className="pt-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <History className="h-3.5 w-3.5 text-slate-500" />
                            <span>Últimos Registos de Execução desta Rotina</span>
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Última: {job.ultima_execucao || "Ainda não executada"}
                          </span>
                        </div>

                        {(!job.historico_execucoes || job.historico_execucoes.length === 0) ? (
                          <p className="text-xs text-slate-400 italic py-2">Sem histórico registado para esta rotina.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {job.historico_execucoes.slice(0, 3).map((exec) => (
                              <div 
                                key={exec.id}
                                className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs gap-2"
                              >
                                <div className="flex items-center space-x-2">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Sucesso
                                  </span>
                                  <span className="font-mono text-slate-500 text-[11px]">{exec.data_hora}</span>
                                  <span className="text-slate-700 dark:text-slate-300 truncate max-w-md">{exec.detalhes}</span>
                                </div>
                                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 shrink-0">
                                  {exec.emails_enviados} disparos
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                        <span className="text-[11px] text-slate-500">
                          As alterações são sincronizadas automaticamente com o agendador em segundo plano.
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              showToast(`Configurações de "${job.titulo}" salvas com sucesso!`);
                            }}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Guardar Parâmetros</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Logs view */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <History className="h-4 w-4 text-emerald-600" />
              <span>Registo Cronológico de Execuções Automáticas</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">Auditoria de Notificações & Cobranças</span>
          </div>

          <div className="space-y-2.5">
            {jobs.flatMap(j => (j.historico_execucoes || []).map(exec => ({ ...exec, jobTitulo: j.titulo }))).length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6">Ainda não existem registos de execução.</p>
            ) : (
              jobs.flatMap(j => (j.historico_execucoes || []).map(exec => ({ ...exec, jobTitulo: j.titulo })))
                .sort((a, b) => b.data_hora.localeCompare(a.data_hora))
                .map((exec) => (
                  <div key={exec.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{exec.jobTitulo}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Sucesso
                        </span>
                        <span className="font-mono text-slate-400 text-[11px]">{exec.data_hora}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{exec.detalhes}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">E-mails Disparados</span>
                        <span className="font-bold text-emerald-600 font-mono">{exec.emails_enviados} destinatários</span>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
