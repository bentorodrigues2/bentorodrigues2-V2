import React, { useState } from "react";
import { Predio, Fracao, Aviso, LoggedUser, EnvioProgramadoItem } from "../types";
import { 
  Send, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  PauseCircle, 
  PlayCircle, 
  BellRing, 
  Mail, 
  FileText, 
  Smartphone, 
  Zap, 
  AlertCircle, 
  Eye, 
  RefreshCw, 
  Sliders, 
  CheckCheck, 
  ShieldCheck 
} from "lucide-react";
import { triggerSendReaction } from "./SendingReactionModal";
import { getPrazoLimiteTexto } from "../utils";

interface EnviosProgramadosProps {
  predio: Predio;
  fracoes: Fracao[];
  avisos?: Aviso[];
  loggedUser: LoggedUser;
}

export function EnviosProgramados({
  predio,
  fracoes,
  avisos = [],
  loggedUser
}: EnviosProgramadosProps) {
  const predioFracoes = fracoes.filter(f => f.id_predio === predio?.id_predio);
  const [filterTipo, setFilterTipo] = useState<"TODOS" | "DIA_25" | "DIA_05" | "PAUSADOS">("TODOS");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<EnvioProgramadoItem | null>(null);

  // Compute transfer code helper
  const computeCode = (piso: string, fracaoNome: string) => {
    const pPart = (predio?.morada_linha1 || "BR2").replace(/\s+/g, "").substring(0, 3).toUpperCase();
    const fPart = fracaoNome.replace(/\s+/g, "").toUpperCase();
    return `${pPart}-F${fPart}`;
  };

  const prazoTextoAtual = getPrazoLimiteTexto("2026-08-25", "2026-09-08");

  // Initial queue of scheduled dispatches
  const [filaEnvios, setFilaEnvios] = useState<EnvioProgramadoItem[]>(() => {
    const initialList: EnvioProgramadoItem[] = [];

    // Dia 25: Emissão das Notas de Cobrança com referência de fração e limite até dia 08 do mês seguinte
    predioFracoes.forEach((f, idx) => {
      const valor = Number((45 * (f.permilagem / 50)).toFixed(2));
      const ref = computeCode(f.piso, f.fracao_nome);

      initialList.push({
        id_envio: `env-25-${f.id_fracao}`,
        id_predio: predio.id_predio,
        id_fracao: f.id_fracao,
        fracao_nome: f.fracao_nome,
        destinatario_nome: f.proprietario?.nome || "Condómino",
        destinatario_email: f.proprietario?.email || "condomino@exemplo.pt",
        destinatario_push_id: `push-token-${f.id_fracao}`,
        tipo_envio: "NOTA_COBRANCA_DIA_25",
        data_programada: "2026-08-25 08:00",
        montante: valor,
        referencia_fracao: ref,
        prazo_limite_texto: prazoTextoAtual,
        canais: {
          email: true,
          push_pwa: true,
          pdf_anexo: true
        },
        estado: "AGENDADO",
        mensagem_preview: `Exmo.(a) Sr.(a) ${f.proprietario?.nome || "Condómino"}, informamos que foi emitida a Nota de Cobrança relativa à Quota de Setembro/2026 no valor de ${valor.toFixed(2)} €. Descritivo Obrigatório: ${ref} (referência individual da fração para cruzamento de dados IA). ${prazoTextoAtual}.`
      });
    });

    // Dia 05: Lembrete Cordial de Vencimento
    predioFracoes.slice(0, 3).forEach((f, idx) => {
      const valor = Number((45 * (f.permilagem / 50)).toFixed(2));
      const ref = computeCode(f.piso, f.fracao_nome);

      initialList.push({
        id_envio: `env-05-${f.id_fracao}`,
        id_predio: predio.id_predio,
        id_fracao: f.id_fracao,
        fracao_nome: f.fracao_nome,
        destinatario_nome: f.proprietario?.nome || "Condómino",
        destinatario_email: f.proprietario?.email || "condomino@exemplo.pt",
        destinatario_push_id: `push-token-${f.id_fracao}`,
        tipo_envio: "LEMBRETE_CORDIAL_DIA_05",
        data_programada: "2026-09-05 10:00",
        montante: valor,
        referencia_fracao: ref,
        prazo_limite_texto: prazoTextoAtual,
        canais: {
          email: true,
          push_pwa: true,
          pdf_anexo: false
        },
        estado: "AGENDADO",
        mensagem_preview: `Lembrete cordial: O pagamento da quota de condomínio (Fração ${f.fracao_nome}) no valor de ${valor.toFixed(2)} € vence no dia 08. Descritivo Obrigatório: ${ref} (referência individual da fração para cruzamento de dados IA). Se já liquidou, por favor desconsidere este aviso.`
      });
    });

    return initialList;
  });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleTogglePausa = (idEnvio: string) => {
    setFilaEnvios(prev => prev.map(item => {
      if (item.id_envio === idEnvio) {
        const novoEstado = item.estado === "PAUSADO_MANUAL" ? "AGENDADO" : "PAUSADO_MANUAL";
        showToast(novoEstado === "PAUSADO_MANUAL" ? "⏸️ Envio colocado em pausa com sucesso." : "▶️ Envio retomado e pronto para disparo automático.");
        return { ...item, estado: novoEstado };
      }
      return item;
    }));
  };

  const handleForcarEnvio = (item: EnvioProgramadoItem) => {
    triggerSendReaction("email", `A forçar disparo manual imediato: ${item.destinatario_nome} (Fração ${item.fracao_nome})`, () => {
      setFilaEnvios(prev => prev.map(i => {
        if (i.id_envio === item.id_envio) {
          return {
            ...i,
            estado: "ENVIADO_SUCESSO",
            data_envio_real: new Date().toISOString().replace("T", " ").substring(0, 19)
          };
        }
        return i;
      }));
      showToast(`🚀 Disparo manual efetuado com sucesso por E-mail & Notificação Push PWA para a Fração ${item.fracao_nome}!`);
    });
  };

  const handleDispararTodosDia25 = () => {
    triggerSendReaction("email", "A disparar todas as Notas de Cobrança do Dia 25", () => {
      setFilaEnvios(prev => prev.map(i => {
        if (i.tipo_envio === "NOTA_COBRANCA_DIA_25" && i.estado !== "PAUSADO_MANUAL") {
          return {
            ...i,
            estado: "ENVIADO_SUCESSO",
            data_envio_real: new Date().toISOString().replace("T", " ").substring(0, 19)
          };
        }
        return i;
      }));
      showToast("🚀 Todas as Notas de Cobrança do Dia 25 foram enviadas com sucesso com PDF e Push PWA!");
    });
  };

  const filteredQueue = filaEnvios.filter(item => {
    if (filterTipo === "DIA_25") return item.tipo_envio === "NOTA_COBRANCA_DIA_25";
    if (filterTipo === "DIA_05") return item.tipo_envio === "LEMBRETE_CORDIAL_DIA_05";
    if (filterTipo === "PAUSADOS") return item.estado === "PAUSADO_MANUAL";
    return true;
  });

  const countAgendados = filaEnvios.filter(i => i.estado === "AGENDADO").length;
  const countEnviados = filaEnvios.filter(i => i.estado === "ENVIADO_SUCESSO").length;
  const countPausados = filaEnvios.filter(i => i.estado === "PAUSADO_MANUAL").length;

  return (
    <div className="space-y-6 animate-fadeIn" id="envios-programados-view">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-500 flex items-center gap-3 animate-fade-in text-xs font-bold">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 p-6 sm:p-7 rounded-3xl text-white shadow-xl border border-emerald-500/30 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Agenda de Notificações
            </span>
            <span className="text-xs text-slate-400 font-mono">Fila & Log de Envios Programados (Scheduler Dashboard)</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Envios Programados
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Painel visual onde a administração monitoriza antecipadamente a lista de e-mails e notificações Push PWA programadas para disparar no <strong>Dia 25</strong> (Emissão de Notas de Cobrança com prazo até dia 08) e no <strong>Dia 5</strong> (Lembretes Cordiais de Vencimento), com controlo individual de pausa ou disparo forçado.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 relative z-10">
          <button
            type="button"
            onClick={handleDispararTodosDia25}
            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs px-4 py-2.5 rounded-2xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <Zap className="h-4 w-4 text-emerald-200" />
            <span>Forçar Disparo Lote Dia 25</span>
          </button>
        </div>
      </div>

      {/* KPI Status Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total em Fila</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{filaEnvios.length}</div>
            <span className="text-[10px] text-slate-500">Notificações preparadas</span>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-black">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Emissão Dia 25</span>
            <div className="text-2xl font-black text-emerald-600 font-mono">
              {filaEnvios.filter(i => i.tipo_envio === "NOTA_COBRANCA_DIA_25").length}
            </div>
            <span className="text-[10px] text-slate-500">Notas de Cobrança c/ PDF</span>
          </div>
          <div className="p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-2xl font-black">
            <Mail className="h-6 w-6" />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Lembrete Dia 5</span>
            <div className="text-2xl font-black text-amber-600 font-mono">
              {filaEnvios.filter(i => i.tipo_envio === "LEMBRETE_CORDIAL_DIA_05").length}
            </div>
            <span className="text-[10px] text-slate-500">Aviso cordial antes do dia 8</span>
          </div>
          <div className="p-3 bg-amber-100 dark:bg-amber-950 text-amber-600 rounded-2xl font-black">
            <BellRing className="h-6 w-6" />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Push PWA Ativo</span>
            <div className="text-2xl font-black text-blue-600 font-mono">100%</div>
            <span className="text-[10px] text-slate-500">App Mobile + E-mail</span>
          </div>
          <div className="p-3 bg-blue-100 dark:bg-blue-950 text-blue-600 rounded-2xl font-black">
            <Smartphone className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Filter & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-emerald-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Filtro de Fila: <strong className="text-emerald-600 dark:text-emerald-400">{filterTipo}</strong> ({filteredQueue.length} itens)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterTipo("TODOS")}
            className={`px-3 py-1 text-xs rounded-lg font-bold cursor-pointer transition-all ${
              filterTipo === "TODOS" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setFilterTipo("DIA_25")}
            className={`px-3 py-1 text-xs rounded-lg font-bold cursor-pointer transition-all ${
              filterTipo === "DIA_25" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
            }`}
          >
            Dia 25 (Cobrança)
          </button>
          <button
            type="button"
            onClick={() => setFilterTipo("DIA_05")}
            className={`px-3 py-1 text-xs rounded-lg font-bold cursor-pointer transition-all ${
              filterTipo === "DIA_05" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
            }`}
          >
            Dia 5 (Lembrete)
          </button>
          <button
            type="button"
            onClick={() => setFilterTipo("PAUSADOS")}
            className={`px-3 py-1 text-xs rounded-lg font-bold cursor-pointer transition-all ${
              filterTipo === "PAUSADOS" ? "bg-slate-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}
          >
            Pausados ({countPausados})
          </button>
        </div>
      </div>

      {/* Main Queue List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {filteredQueue.map(item => {
          const isDia25 = item.tipo_envio === "NOTA_COBRANCA_DIA_25";
          const isPausado = item.estado === "PAUSADO_MANUAL";
          const isEnviado = item.estado === "ENVIADO_SUCESSO";

          return (
            <div 
              key={item.id_envio}
              className={`p-4 sm:p-5 transition-colors ${
                isPausado ? "bg-slate-50/70 dark:bg-slate-950/30 opacity-75" :
                isEnviado ? "bg-emerald-50/20 dark:bg-emerald-950/10" :
                "hover:bg-slate-50/50 dark:hover:bg-slate-850/50"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left Info */}
                <div className="flex items-start gap-3.5">
                  <div className={`p-3 rounded-2xl border shrink-0 ${
                    isEnviado ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                    isPausado ? "bg-slate-200 text-slate-600 border-slate-300" :
                    isDia25 ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                    "bg-amber-50 text-amber-600 border-amber-200"
                  }`}>
                    {isEnviado ? <CheckCheck className="h-5 w-5" /> :
                     isPausado ? <PauseCircle className="h-5 w-5" /> :
                     isDia25 ? <Mail className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        isDia25 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                        "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}>
                        {isDia25 ? "Emissão Dia 25 (Nota de Cobrança)" : "Lembrete Dia 5 (Pré-Vencimento)"}
                      </span>

                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        Fração {item.fracao_nome} • {item.destinatario_nome}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      <span>Ref. IA: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{item.referencia_fracao}</strong></span>
                      <span>•</span>
                      <span>Valor: <strong className="text-slate-900 dark:text-white font-bold">{item.montante.toFixed(2)} €</strong></span>
                      <span>•</span>
                      <span>Disparo: <strong className="text-slate-700 dark:text-slate-300">{item.data_programada}</strong></span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                      "{item.mensagem_preview}"
                    </p>

                    <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-emerald-500" /> E-mail ({item.destinatario_email})</span>
                      <span className="flex items-center gap-1"><Smartphone className="h-3 w-3 text-blue-500" /> Push PWA Mobile</span>
                      {item.canais.pdf_anexo && (
                        <span className="flex items-center gap-1"><FileText className="h-3 w-3 text-red-500" /> PDF Nota de Cobrança</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 self-end lg:self-center">
                  <button
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                    title="Ver Detalhes do Envio"
                  >
                    <Eye className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTogglePausa(item.id_envio)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isPausado 
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" 
                        : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {isPausado ? <PlayCircle className="h-3.5 w-3.5 text-emerald-400" /> : <PauseCircle className="h-3.5 w-3.5 text-amber-500" />}
                    <span>{isPausado ? "Retomar" : "Pausar"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleForcarEnvio(item)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Forçar Envio Agora</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-zoom-in">
            <div className="bg-slate-900 p-5 text-white flex justify-between items-center border-b border-emerald-500/30">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Antevisão do Envio Programado</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setPreviewItem(null)} 
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Destinatário:</span>
                  <strong className="text-slate-900 dark:text-white">{previewItem.destinatario_nome} (Fração {previewItem.fracao_nome})</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">E-mail:</span>
                  <span className="font-mono text-emerald-600 font-bold">{previewItem.destinatario_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Ref. Individual Fração:</span>
                  <span className="font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{previewItem.referencia_fracao}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Montante a Cobrar:</span>
                  <strong className="font-mono text-slate-900 dark:text-white">{previewItem.montante.toFixed(2)} €</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Prazo Limite:</span>
                  <strong className="text-slate-700 dark:text-slate-300">{previewItem.prazo_limite_texto}</strong>
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-300">Corpo do E-mail & Notificação Push:</span>
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                  {previewItem.mensagem_preview}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleForcarEnvio(previewItem);
                    setPreviewItem(null);
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                >
                  <Send className="h-4 w-4" />
                  <span>Enviar Imediatamente</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
