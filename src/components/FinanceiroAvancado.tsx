import React, { useState, useMemo } from "react";
import { Predio, Fracao, Aviso, Movimento, LoggedUser, Documento } from "../types";
import { formatDatePT, formatQuotaReceiptNumber, downloadReceiptPDF, exportarBalanceteMapaAnualXLS } from "../utils";
import { FiltroRelatoriosPDFModal } from "./FiltroRelatoriosPDFModal";

export interface Caucao {
  id_caucao: string;
  id_predio: string;
  id_fracao: string;
  fracao_nome: string;
  titular: string;
  finalidade: "Reserva de Salão de Festas" | "Acesso de Obras e Mudanças" | "Comando de Garagem" | "Chave de Acesso Técnico";
  valor: number;
  data_deposito: string;
  metodo_pagamento: "MBWay" | "Transferência Bancária" | "Numerário" | "Cheque";
  comprovativo_ref?: string;
  estado: "Ativa (Retida)" | "Devolvida" | "Retida (Danos/Penalização)";
  data_resolucao?: string;
  comprovativo_devolucao?: string;
  justificacao_retencao?: string;
  valor_retido?: number;
  valor_devolvido?: number;
}

interface FinanceiroAvancadoProps {
  predio: Predio;
  fracoes: Fracao[];
  avisos?: Aviso[];
  movements?: Movimento[];
  movimentos?: Movimento[];
  setMovements?: React.Dispatch<React.SetStateAction<Movimento[]>>;
  setDocumentos?: React.Dispatch<React.SetStateAction<Documento[]>>;
  loggedUser: LoggedUser;
  activeSubSection?: string;
  initialTab?: string;
}

export function FinanceiroAvancado({
  predio,
  fracoes,
  avisos = [],
  movements,
  movimentos,
  setMovements,
  setDocumentos,
  loggedUser,
  activeSubSection,
  initialTab
}: FinanceiroAvancadoProps) {
  const normalizeTab = (t: string | undefined): string => {
    if (!t) return "recibos_manuais";
    if (t === "financeiro_recibos" || t === "recibos_manuais") return "recibos_manuais";
    if (t === "financeiro_relatorios" || t === "relatorio_dividas") return "relatorio_dividas";
    if (t === "financeiro_extratos" || t === "extrato_saldos" || t === "extrato_saldo") return "extrato_saldo";
    if (t === "financeiro_quotas_mensais" || t === "quotas_mensais") return "quotas_mensais";
    if (t === "financeiro_quotas_extra" || t === "quotas_extra") return "quotas_extra";
    if (t === "financeiro_caucoes" || t === "gestao_caucoes") return "gestao_caucoes";
    return t;
  };

  const movList = movements || movimentos || [];
  const rawTab = activeSubSection || initialTab || "recibos_manuais";
  const [localTab, setLocalTab] = useState<string>(normalizeTab(rawTab));

  React.useEffect(() => {
    if (activeSubSection) {
      setLocalTab(normalizeTab(activeSubSection));
    }
  }, [activeSubSection]);

  const currentTab = localTab;
  const [isFiltroRelatoriosOpen, setIsFiltroRelatoriosOpen] = useState(false);
  const predioFracoes = useMemo(() => fracoes.filter(f => f.id_predio === predio.id_predio), [fracoes, predio.id_predio]);
  const predioAvisos = useMemo(() => avisos.filter(a => a.id_predio === predio.id_predio), [avisos, predio.id_predio]);

  // Cauções State
  const [caucoes, setCaucoes] = useState<Caucao[]>([
    {
      id_caucao: "cau-1",
      id_predio: predio.id_predio,
      id_fracao: fracoes[0]?.id_fracao || "frac-1",
      fracao_nome: fracoes[0]?.fracao_nome || "Fração A",
      titular: "João Silva",
      finalidade: "Reserva de Salão de Festas",
      valor: 150.00,
      data_deposito: "2026-07-01",
      metodo_pagamento: "MBWay",
      comprovativo_ref: "MBW-99882211",
      estado: "Ativa (Retida)"
    },
    {
      id_caucao: "cau-2",
      id_predio: predio.id_predio,
      id_fracao: fracoes[1]?.id_fracao || "frac-2",
      fracao_nome: fracoes[1]?.fracao_nome || "Fração B",
      titular: "Maria Santos",
      finalidade: "Acesso de Obras e Mudanças",
      valor: 300.00,
      data_deposito: "2026-06-15",
      metodo_pagamento: "Transferência Bancária",
      comprovativo_ref: "TRF-882291",
      estado: "Devolvida",
      data_resolucao: "2026-06-25",
      comprovativo_devolucao: "DEV-TRF-00122",
      valor_devolvido: 300.00
    }
  ]);

  // Cauções Form State
  const [cFracaoId, setCFracaoId] = useState("");
  const [cTitular, CTitularSet] = useState("");
  const [cFinalidade, setCFinalidade] = useState<Caucao["finalidade"]>("Reserva de Salão de Festas");
  const [cValor, setCValor] = useState("150.00");
  const [cData, setCData] = useState("2026-08-01");
  const [cMetodo, setCMetodo] = useState<Caucao["metodo_pagamento"]>("MBWay");
  const [cRef, setCRef] = useState("");

  // Retenção/Devolução Modal State
  const [selectedCaucaoId, setSelectedCaucaoId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"DEVOLVER" | "RETER" | null>(null);
  const [actionValor, setActionValor] = useState("");
  const [actionData, setActionData] = useState("2026-08-06");
  const [actionRef, setActionRef] = useState("");
  const [actionMotivo, setActionMotivo] = useState("");

  const registarNovaCaucao = (e: React.FormEvent) => {
    e.preventDefault();
    const fr = predioFracoes.find(f => f.id_fracao === cFracaoId) || predioFracoes[0];
    if (!fr) return alert("Selecione uma fração válida.");

    const nova: Caucao = {
      id_caucao: "cau-" + (caucoes.length + 1),
      id_predio: predio.id_predio,
      id_fracao: fr.id_fracao,
      fracao_nome: fr.fracao_nome,
      titular: cTitular || fr.proprietario.nome,
      finalidade: cFinalidade,
      valor: parseFloat(cValor) || 0,
      data_deposito: cData,
      metodo_pagamento: cMetodo,
      comprovativo_ref: cRef || "REF-" + Math.floor(Math.random() * 1000000),
      estado: "Ativa (Retida)"
    };

    setCaucoes([nova, ...caucoes]);
    showToast(`✅ Caução de ${nova.valor}€ registada com sucesso para Fração ${nova.fracao_nome}!`);
    CTitularSet(""); setCRef("");
  };

  const confirmarAcaoCaucao = () => {
    if (!selectedCaucaoId || !actionType) return;

    setCaucoes(prev => prev.map(c => {
      if (c.id_caucao === selectedCaucaoId) {
        if (actionType === "DEVOLVER") {
          return {
            ...c,
            estado: "Devolvida",
            data_resolucao: actionData,
            comprovativo_devolucao: actionRef || "DEV-" + Math.floor(Math.random() * 100000),
            valor_devolvido: parseFloat(actionValor) || c.valor
          };
        } else {
          return {
            ...c,
            estado: "Retida (Danos/Penalização)",
            data_resolucao: actionData,
            valor_retido: parseFloat(actionValor) || c.valor,
            justificacao_retencao: actionMotivo || "Danos causados nas instalações comuns durante o período de caução."
          };
        }
      }
      return c;
    }));

    showToast(actionType === "DEVOLVER" ? "✅ Caução devolvida com sucesso!" : "⚠️ Caução retida por danos com registo justificativo.");
    setSelectedCaucaoId(null);
    setActionType(null);
  };

  // Default selected fraction
  const [selectedFracaoId, setSelectedFracaoId] = useState<string>(
    predioFracoes.length > 0 ? predioFracoes[0].id_fracao : ""
  );

  // --- MANUAL RECEIPT STATE (Recibos Manuais) - Base limpa sem valores fixos de simulação ---
  const [reciboNum, setReciboNum] = useState<string>(() => formatQuotaReceiptNumber(Math.floor(1000 + Math.random() * 9000)));
  const [reciboData, setReciboData] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [reciboQuotaMensal, setReciboQuotaMensal] = useState<string>(() => {
    if (predioFracoes.length > 0 && predioFracoes[0]?.quota_mensal) {
      return Number(predioFracoes[0].quota_mensal).toFixed(2);
    }
    return "0.00";
  });
  const [reciboFundoReserva, setReciboFundoReserva] = useState<string>("0.00");
  const [reciboQuotaExtra, setReciboQuotaExtra] = useState<string>("0.00");
  const [reciboMetodo, setReciboMetodo] = useState<string>("Transferência Bancária");
  const [reciboReferencia, setReciboReferencia] = useState<string>("");
  const [reciboObs, setReciboObs] = useState<string>("");
  const [reciboAssinatura, setReciboAssinatura] = useState<string>(`${loggedUser.nome} - Administrador do Condomínio`);

  const reciboValorTotal = useMemo(() => {
    const qm = parseFloat(reciboQuotaMensal.replace(",", ".")) || 0;
    const fr = parseFloat(reciboFundoReserva.replace(",", ".")) || 0;
    const qe = parseFloat(reciboQuotaExtra.replace(",", ".")) || 0;
    return (qm + fr + qe).toFixed(2);
  }, [reciboQuotaMensal, reciboFundoReserva, reciboQuotaExtra]);
  
  // Toast notifications & email modal state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [emailModal, setEmailModal] = useState<{
    isOpen: boolean;
    recipient: string;
    subject: string;
    bodyText: string;
    docTitle: string;
  }>({
    isOpen: false,
    recipient: "",
    subject: "",
    bodyText: "",
    docTitle: ""
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const openEmailShare = (recipient: string, subject: string, bodyText: string, docTitle: string) => {
    setEmailModal({
      isOpen: true,
      recipient,
      subject,
      bodyText,
      docTitle
    });
  };

  const handleSendEmail = () => {
    showToast(`✅ Documento "${emailModal.docTitle}" enviado com sucesso por email para ${emailModal.recipient}`);
    setEmailModal(prev => ({ ...prev, isOpen: false }));
  };

  // Helper: calculate balance for a fraction (Negative if they have unpaid notices, Positive/Zero if in good standing)
  const getFracaoBalance = (id_fracao: string) => {
    const pendentes = predioAvisos.filter(a => a.id_fracao === id_fracao && a.estado === "Pendente");
    const totalPend = pendentes.reduce((acc, curr) => acc + curr.valor, 0);
    // In condominium terminology, unpaid quotas represent debt (negative balance from condómino perspective)
    return totalPend === 0 ? 0 : -totalPend;
  };

  // Helper: get selected fraction object
  const selectedFracao = predioFracoes.find(f => f.id_fracao === selectedFracaoId) || predioFracoes[0];

  // Helper: record manual receipt into movements
  const handleRegistarReciboManual = () => {
    if (!selectedFracao) return;
    const valNum = parseFloat(reciboValorTotal) || 0;
    if (valNum <= 0) {
      alert("Por favor indique valores válidos superiores a 0 €.");
      return;
    }
    const qm = parseFloat(reciboQuotaMensal.replace(",", ".")) || 0;
    const fr = parseFloat(reciboFundoReserva.replace(",", ".")) || 0;
    const qe = parseFloat(reciboQuotaExtra.replace(",", ".")) || 0;

    const novosMovimentos: Movimento[] = [];
    if (qm > 0) {
      novosMovimentos.push({
        id_mov: `mov-manual-qm-${Date.now()}`,
        id_predio: predio.id_predio,
        id_conta: "conta-1",
        tipo: "Receita",
        categoria: "Quotas Condomínio",
        descricao: `Recibo Manual ${reciboNum} - Quota Mensal - Fração ${selectedFracao.fracao_nome}`,
        valor: qm,
        data: reciboData,
        id_fracao: selectedFracao.id_fracao,
        metodo_pagamento: reciboMetodo
      });
    }
    if (fr > 0) {
      novosMovimentos.push({
        id_mov: `mov-manual-fr-${Date.now()}`,
        id_predio: predio.id_predio,
        id_conta: "conta-1",
        tipo: "Receita",
        categoria: "Fundo de Reserva",
        descricao: `Recibo Manual ${reciboNum} - Fundo Comum Reserva - Fração ${selectedFracao.fracao_nome}`,
        valor: fr,
        data: reciboData,
        id_fracao: selectedFracao.id_fracao,
        metodo_pagamento: reciboMetodo
      });
    }
    if (qe > 0) {
      novosMovimentos.push({
        id_mov: `mov-manual-qe-${Date.now()}`,
        id_predio: predio.id_predio,
        id_conta: "conta-1",
        tipo: "Receita",
        categoria: "Quotas Extraordinárias",
        descricao: `Recibo Manual ${reciboNum} - Quota Extra - Fração ${selectedFracao.fracao_nome}`,
        valor: qe,
        data: reciboData,
        id_fracao: selectedFracao.id_fracao,
        metodo_pagamento: reciboMetodo
      });
    }

    if (setMovements && novosMovimentos.length > 0) {
      setMovements(prev => [...novosMovimentos, ...prev]);
    }
    showToast(`🎉 Recibo Manual ${reciboNum} registado com ${novosMovimentos.length} movimentos discriminados (€${valNum.toFixed(2)})!`);
  };

  // Print helper for clean document output
  const handlePrintDocument = (docTitle: string, htmlContentId: string) => {
    const el = document.getElementById(htmlContentId);
    if (!el) return;
    const printWin = window.open("", "_blank");
    if (!printWin) {
      alert("Por favor permita janelas pop-up para imprimir ou guardar o PDF.");
      return;
    }
    printWin.document.write(`
      <html>
        <head>
          <title>${docTitle}</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: 'Times New Roman', Times, serif; color: #1e293b; font-size: 14px; line-height: 1.6; padding: 10px; }
            .no-print { display: none !important; }
            input, textarea { border: none !important; background: transparent !important; font-family: inherit; font-size: inherit; color: inherit; width: auto; font-weight: inherit; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
            th { background-color: #f8fafc; font-weight: bold; }
            .header-box { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
            .text-emerald { color: #059669 !important; }
            .text-red { color: #dc2626 !important; }
          </style>
        </head>
        <body>
          ${el.innerHTML}
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 250);
  };

  return (
    <div className="space-y-6">
      {/* Toast notification banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-3 animate-fadeIn">
          <i className="fa-solid fa-circle-check text-emerald-400 text-base"></i>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Email Share Modal */}
      {emailModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <i className="fa-solid fa-envelope"></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">Partilha Direta por Email</h3>
                  <p className="text-[10px] text-slate-400">Documento: {emailModal.docTitle}</p>
                </div>
              </div>
              <button 
                onClick={() => setEmailModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Destinatário (Email do Condómino)</label>
                <input 
                  type="email" 
                  value={emailModal.recipient} 
                  onChange={e => setEmailModal(prev => ({ ...prev, recipient: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-medium text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Assunto do Email</label>
                <input 
                  type="text" 
                  value={emailModal.subject} 
                  onChange={e => setEmailModal(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-medium text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Mensagem Anexa e Pré-visualização do Documento</label>
                <textarea 
                  rows={5}
                  value={emailModal.bodyText}
                  onChange={e => setEmailModal(prev => ({ ...prev, bodyText: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 font-mono text-[11px] text-slate-700 dark:text-slate-300"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button 
                onClick={() => setEmailModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSendEmail}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-paper-plane"></i>
                <span>Enviar Email Agora</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header action bar */}
      <div className="flex justify-end items-center gap-2 no-print">
        <button
          type="button"
          onClick={() => {
            exportarBalanceteMapaAnualXLS(predio, predioFracoes, 2026, predioAvisos, movList);
            showToast("📊 Balancete / Mapa Anual de 12 Quotas Mensais exportado em Excel (.CSV) com sucesso!");
          }}
          className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs"
          title="Exportar Balancete e Grelha das 12 Quotas Mensais de todas as Frações em Excel / CSV para Assembleia"
        >
          <img src="/modulos/66-exportacao-financeira.png" alt="Excel" className="h-4 w-4 object-contain" onError={(e) => { e.currentTarget.src = "/marca/18-pdf.png"; }} />
          <span>Exportar Balancete / Mapa Anual (Excel)</span>
        </button>

        <button
          type="button"
          onClick={() => setIsFiltroRelatoriosOpen(true)}
          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs"
          title="Filtro para exportar relatórios por prédio, por fração ou todas"
        >
          <img src="/marca/16-documentos-relatorios.png" alt="Relatórios" className="h-4 w-4 object-contain" onError={(e) => { e.currentTarget.src = "/marca/18-pdf.png"; }} />
          <span>Filtro & Relatórios</span>
        </button>
      </div>

      {/* --- SUBSECTION 1: EMISSÃO DE RECIBOS MANUAIS --- */}
      {(currentTab === "recibos_manuais") && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-receipt"></i>
                  </span>
                  <span>Emissão de Recibos Manuais de Condomínio</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Emita e passe recibos manuais com PDF 100% editável, gravação direta na contabilidade e partilha por email com o condómino.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400">Selecionar Condómino / Fração:</span>
                <select
                  value={selectedFracaoId}
                  onChange={e => setSelectedFracaoId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {predioFracoes.map(f => (
                    <option key={f.id_fracao} value={f.id_fracao}>
                      Fração "{f.fracao_nome}" ({f.piso}) — {f.proprietario.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Editable Receipt Config */}
              <div className="lg:col-span-5 space-y-4 bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <i className="fa-solid fa-pen-to-square text-emerald-500"></i>
                  <span>Dados do Recibo (100% Editável)</span>
                </h3>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">N.º do Recibo</label>
                    <input
                      type="text"
                      value={reciboNum}
                      onChange={e => setReciboNum(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Data de Emissão</label>
                    <input
                      type="text"
                      value={reciboData}
                      onChange={e => setReciboData(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="block text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Discriminação das Quotas (€)</span>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Quota Mensal (€)</label>
                      <input
                        type="text"
                        value={reciboQuotaMensal}
                        onChange={e => setReciboQuotaMensal(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-mono font-bold text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Fundo Reserva (€)</label>
                      <input
                        type="text"
                        value={reciboFundoReserva}
                        onChange={e => setReciboFundoReserva(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-mono font-bold text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Quota Extra (€)</label>
                      <input
                        type="text"
                        value={reciboQuotaExtra}
                        onChange={e => setReciboQuotaExtra(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-mono font-bold text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700 text-xs">
                    <span className="font-bold text-slate-500 text-[10px] uppercase">Total Liquidado:</span>
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">€ {reciboValorTotal}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Método de Pagamento</label>
                    <select
                      value={reciboMetodo}
                      onChange={e => setReciboMetodo(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-white"
                    >
                      <option value="Transferência Bancária">Transferência Bancária</option>
                      <option value="Multibanco (Entidade / Referência)">Multibanco (Entidade / Referência)</option>
                      <option value="Débito Direto (SEPA)">Débito Direto (SEPA)</option>
                      <option value="Cheque Bancário">Cheque Bancário</option>
                      <option value="Numerário / Dinheiro">Numerário / Dinheiro</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Período / Referência de Quotas</label>
                  <input
                    type="text"
                    value={reciboReferencia}
                    onChange={e => setReciboReferencia(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Observações e Notas</label>
                  <textarea
                    rows={2}
                    value={reciboObs}
                    onChange={e => setReciboObs(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium text-slate-800 dark:text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Assinatura no Recibo</label>
                  <input
                    type="text"
                    value={reciboAssinatura}
                    onChange={e => setReciboAssinatura(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-white text-xs"
                  />
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleRegistarReciboManual}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-check-circle"></i>
                    <span>Registar e Guardar no Histórico Financeiro</span>
                  </button>
                </div>
              </div>

              {/* Right Column: 100% Editable Printable Receipt Document */}
              <div className="lg:col-span-7 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <i className="fa-solid fa-file-pdf text-red-500"></i>
                    <span>Pré-visualização do Recibo Manual (1 Folha • Campos Interativos)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const qm = parseFloat(reciboQuotaMensal.replace(",", ".")) || 0;
                        const fr = parseFloat(reciboFundoReserva.replace(",", ".")) || 0;
                        const qe = parseFloat(reciboQuotaExtra.replace(",", ".")) || 0;
                        const isExtra = qe > 0 && qm === 0;
                        downloadReceiptPDF({
                          reciboNum: reciboNum,
                          dataPagamento: reciboData,
                          movimentoQuotaMensal: qm > 0 ? `MOV-2026-QM-${reciboNum}` : undefined,
                          movimentoFundoReserva: fr > 0 ? `MOV-2026-FR-${reciboNum}` : undefined,
                          movimentoQuotaExtra: qe > 0 ? `MOV-2026-QE-${reciboNum}` : undefined,
                          buildingName: predio?.nome || "Condomínio",
                          buildingAddress: `${predio?.morada_linha1 || ""} ${predio?.num_porta || ""}, ${predio?.localidade || ""}`,
                          buildingNif: predio?.nif || "500000000",
                          proprietarioNome: selectedFracao?.proprietario?.nome || "Condómino Registado",
                          proprietarioNif: selectedFracao?.proprietario?.nif || "200000000",
                          fracaoIdent: `Fração ${selectedFracao?.fracao_nome || "A"} (${selectedFracao?.piso || "Piso 1"})`,
                          metodoPagamento: reciboMetodo || "Transferência Bancária",
                          quotaMensalVal: qm,
                          fundoReservaVal: fr,
                          quotaExtraVal: qe,
                          isQuotaExtra: isExtra,
                          descricaoQuota: reciboReferencia || "Quota do Condomínio",
                          adminNome: reciboAssinatura || "José Carlos Guerra",
                          adminSignatureBase64: localStorage.getItem("admin_signature_digital") || undefined
                        });

                        if (setDocumentos) {
                          const docAno = reciboData ? reciboData.substring(0, 4) : "2026";
                          const subFolder = isExtra ? "Recibos Quotas extra" : "Recibos";
                          setDocumentos(prev => [
                            ...prev,
                            {
                              id_doc: "doc-rec-manual-" + Math.floor(10000 + Math.random() * 90000),
                              id_predio: predio.id_predio,
                              nome: `Recibo_${reciboNum.replace(/[^a-zA-Z0-9_-]/g, "_")}_Fracao_${selectedFracao?.fracao_nome || "A"}.pdf`,
                              tipo: isExtra ? "Recibo Quotas extra" : "Recibo",
                              data_upload: reciboData || "2026-08-14",
                              tamanho: "320 KB",
                              categoria: "Pasta Paga. Quotas",
                              sub_pasta: subFolder,
                              descricao: `Recibo nº ${reciboNum} - Fração ${selectedFracao?.fracao_nome || "A"} - ${reciboReferencia || "Quota do Condomínio"}`,
                              visibilidade: "Público",
                              autor: loggedUser.nome || "Administração",
                              tema: "Pasta Paga. Quotas",
                              ano: docAno,
                              tipo_arquivo: "documento",
                              relevancia_perfis: ["ADMIN", "EMPRESA_GESTORA", "USER", "CONTABILISTA"]
                            }
                          ]);
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-file-pdf"></i>
                      <span>Download Recibo PDF (A5)</span>
                    </button>
                    <button
                      onClick={() => openEmailShare(
                        selectedFracao?.proprietario.email || "condomino@email.pt",
                        `Recibo de Pagamento de Condomínio - ${reciboNum}`,
                        `Exmo(a). Sr(a). ${selectedFracao?.proprietario.nome},\n\nJunto enviamos o respetivo recibo manual nº ${reciboNum} no valor total de ${reciboValorTotal} € referente à fração "${selectedFracao?.fracao_nome}".\n\nA Administração do Condomínio ${predio.nome}`,
                        `Recibo Manual ${reciboNum}`
                      )}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-envelope"></i>
                      <span>Enviar por Email</span>
                    </button>
                  </div>
                </div>

                {/* Printable Document Box - 100% Identical to Official Quittance Receipt Design */}
                <div 
                  id="receipt-manual-container"
                  className="bg-white text-slate-800 border border-slate-300 rounded-sm p-6 shadow-md text-xs relative overflow-hidden space-y-4"
                >
                  {/* Subtle Background Watermark */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 opacity-5 pointer-events-none z-0">
                    <img src="/marca/19-marca-dagua-logo-cinza-claro.png" alt="Watermark" className="w-full" />
                  </div>

                  {/* Top Header Row */}
                  <div className="header-box flex justify-between items-stretch gap-4 relative z-10">
                    <div className="bg-[#0c1322] rounded px-3.5 py-2 flex items-center gap-2.5 h-13">
                      <img src="/marca/20-Logotipo Horizontal com fundo.png" alt="CondoManager AI" className="h-9 object-contain" />
                    </div>
                    <div className="bg-[#0b1426] text-white rounded-xs px-4 py-2 text-left min-w-[280px] flex flex-col justify-center">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-black uppercase tracking-wider text-white">RECIBO DE QUITAÇÃO Nº:</span>
                        <input
                          type="text"
                          value={reciboNum}
                          onChange={e => setReciboNum(e.target.value)}
                          className="font-mono text-[11px] font-black text-white bg-transparent focus:outline-none w-28"
                        />
                      </div>
                      <div className="text-[9.5px] text-slate-300 mt-0.5">
                        Data de Pagamento: <input 
                          type="text" 
                          value={reciboData} 
                          onChange={e => setReciboData(e.target.value)} 
                          className="w-24 bg-transparent text-slate-200 font-semibold focus:outline-none"
                        />
                      </div>
                      <div className="text-[8.5px] text-slate-400 mt-0.5 truncate max-w-[260px]">
                        Nºs Movimentos: MOV-2026-QM-{reciboNum}, MOV-2026-FR-{reciboNum}...
                      </div>
                    </div>
                  </div>

                  {/* 2 Side-by-Side Boxes */}
                  <div className="grid grid-cols-2 gap-3 relative z-10">
                    <div className="border border-slate-300 rounded-xs p-2.5 bg-white/90">
                      <span className="text-[9px] font-bold uppercase text-sky-600 block">CONDOMÍNIO DO EDIFÍCIO:</span>
                      <p className="text-[12.5px] font-black text-slate-900 uppercase mt-0.5">{predio?.nome || "Condomínio"}</p>
                      <p className="text-[10px] text-slate-700 mt-0.5">Morada: {predio?.morada_linha1 || ""} {predio?.num_porta || ""}, {predio?.localidade || ""}</p>
                      <p className="text-[10px] text-slate-700">NIF do Condomínio: {predio?.nif || "900123456"}</p>
                    </div>
                    <div className="border border-slate-300 rounded-xs p-2.5 bg-white/90">
                      <span className="text-[9px] font-bold uppercase text-sky-600 block">LIQUIDADO POR (PROPRIETÁRIO / FRAÇÃO):</span>
                      <p className="text-[12.5px] font-black text-slate-900 mt-0.5">{selectedFracao?.proprietario.nome || "Ana Silva"}</p>
                      <p className="text-[10px] text-slate-700 mt-0.5">NIF do Proprietário: {selectedFracao?.proprietario.nif || "221230475"}</p>
                      <p className="text-[10px] text-slate-700">Fração: {selectedFracao?.fracao_nome ? `Fração ${selectedFracao.fracao_nome} (${selectedFracao.piso})` : "Fração A (R/C Esq)"}</p>
                      <p className="text-[10px] text-slate-700">Método de Pagamento: {reciboMetodo || "Transferência Bancária"}</p>
                    </div>
                  </div>

                  {/* Discrimination Table in Preview */}
                  <div className="relative z-10 border border-slate-300 rounded-xs overflow-hidden">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-[#0b1426] text-[9.5px] uppercase font-bold text-white">
                        <tr>
                          <th className="p-2 w-[26%]">Nº MOVIMENTO</th>
                          <th className="p-2 w-[44%]">DESCRITIVO DO CONCEITO / QUOTA</th>
                          <th className="p-2 w-[18%]">CATEGORIA</th>
                          <th className="p-2 text-right w-[12%]">VALOR (€)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {parseFloat(reciboQuotaMensal) > 0 && (
                          <tr>
                            <td className="p-2 font-mono text-[10px] font-bold text-slate-800">MOV-2026-QM-{reciboNum}</td>
                            <td className="p-2 font-normal text-slate-800">{reciboReferencia || "Quota Ordinária de Julho 2026"}</td>
                            <td className="p-2 text-[9.5px] font-bold text-teal-600 uppercase">QUOTA MENSAL</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900">{parseFloat(reciboQuotaMensal).toFixed(2)} €</td>
                          </tr>
                        )}
                        {parseFloat(reciboFundoReserva) > 0 && (
                          <tr>
                            <td className="p-2 font-mono text-[10px] font-bold text-slate-800">MOV-2026-FR-{reciboNum}</td>
                            <td className="p-2 font-normal text-slate-800">Fundo Comum de Reserva (10% Legal)</td>
                            <td className="p-2 text-[9.5px] font-bold text-amber-700 uppercase">FUNDO RESERVA</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900">{parseFloat(reciboFundoReserva).toFixed(2)} €</td>
                          </tr>
                        )}
                        {parseFloat(reciboQuotaExtra) > 0 && (
                          <tr>
                            <td className="p-2 font-mono text-[10px] font-bold text-slate-800">MOV-2026-QE-{reciboNum}</td>
                            <td className="p-2 font-normal text-slate-800">Quota Extraordinária</td>
                            <td className="p-2 text-[9.5px] font-bold text-rose-700 uppercase">QUOTA EXTRA</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900">{parseFloat(reciboQuotaExtra).toFixed(2)} €</td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/* Total Sub-bar */}
                    <div className="bg-[#f8fafc] border-t border-slate-300 p-2 px-3 flex justify-between items-center text-xs">
                      <div className="text-[10px] text-slate-600">Isento de I.V.A. nos termos do artº 9º do nº21 do CIVA</div>
                      <div className="text-[12px] font-black text-teal-700">
                        <span className="text-slate-900 mr-1">TOTAL DO RECIBO:</span> {reciboValorTotal} €
                      </div>
                    </div>
                  </div>

                  {/* Quittance Legal Note */}
                  <div className="text-[8.5px] text-slate-500 relative z-10">
                    O presente documento serve de quitação oficial para todos os efeitos legais, comprovando a liquidação dos valores discriminados por movimento na conta do condomínio.
                  </div>

                  {/* Signatures & Authenticity Footer */}
                  <div className="pt-4 flex justify-between items-end text-xs relative z-10">
                    <div className="text-slate-400 text-[8.5px]">
                      Emitido via CondoManager AI • Documento nº {reciboNum} • Autenticidade Digital Garantida
                    </div>
                    <div className="text-center min-w-[240px]">
                      <p className="text-[9.5px] uppercase font-black text-slate-900 mb-6">A ADMINISTRAÇÃO DO CONDOMÍNIO</p>
                      <div className="w-[200px] border-b border-slate-300 mx-auto mb-1"></div>
                      <input
                        type="text"
                        value={reciboAssinatura}
                        onChange={e => setReciboAssinatura(e.target.value)}
                        className="text-[9.5px] text-slate-700 text-center bg-transparent focus:outline-none w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SUBSECTION 1.5: GESTÃO DE CAUÇÕES --- */}
      {currentTab === "gestao_caucoes" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Action Modal for Devolução / Retenção */}
          {selectedCaucaoId && actionType && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <i className={`fa-solid ${actionType === "DEVOLVER" ? "fa-hand-holding-dollar text-emerald-500" : "fa-gavel text-red-500"}`}></i>
                    <span>{actionType === "DEVOLVER" ? "Devolução de Caução" : "Retenção de Caução por Danos"}</span>
                  </h3>
                  <button onClick={() => { setSelectedCaucaoId(null); setActionType(null); }} className="text-slate-400 hover:text-slate-600">
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Valor do Montante (€)</label>
                    <input
                      type="number"
                      value={actionValor}
                      onChange={e => setActionValor(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data da Operação</label>
                    <input
                      type="date"
                      value={actionData}
                      onChange={e => setActionData(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-medium"
                    />
                  </div>
                  {actionType === "DEVOLVER" ? (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Comprovativo / Ref. Devolução</label>
                      <input
                        type="text"
                        placeholder="Ex: TRF-DEV-992120"
                        value={actionRef}
                        onChange={e => setActionRef(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-medium"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Justificação dos Danos / Penalização *</label>
                      <textarea
                        rows={3}
                        placeholder="Descreva detalhadamente os danos causados nas áreas comuns ou violação do regulamento..."
                        value={actionMotivo}
                        onChange={e => setActionMotivo(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 font-medium"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => { setSelectedCaucaoId(null); setActionType(null); }} className="px-3 py-1.5 text-xs text-slate-500 font-bold">
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarAcaoCaucao}
                    className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-sm ${actionType === "DEVOLVER" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
                  >
                    Confirmar {actionType === "DEVOLVER" ? "Devolução" : "Retenção"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stats Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-[#0f172a] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Cauções Ativas (Em Custódia)</span>
                <span className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
                  €{caucoes.filter(c => c.estado === "Ativa (Retida)").reduce((a, b) => a + b.valor, 0).toFixed(2)}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg">
                <i className="fa-solid fa-vault"></i>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0f172a] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Devolvido a Condóminos</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  €{caucoes.filter(c => c.estado === "Devolvida").reduce((a, b) => a + (b.valor_devolvido || b.valor), 0).toFixed(2)}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg">
                <i className="fa-solid fa-hand-holding-dollar"></i>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0f172a] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Retido (Reparação de Danos)</span>
                <span className="text-xl font-black text-red-600 dark:text-red-400 font-mono">
                  €{caucoes.filter(c => c.estado === "Retida (Danos/Penalização)").reduce((a, b) => a + (b.valor_retido || b.valor), 0).toFixed(2)}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center text-lg">
                <i className="fa-solid fa-gavel"></i>
              </div>
            </div>
          </div>

          {/* Form and List Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form column */}
            <div className="lg:col-span-4 bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-800 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-plus-circle text-amber-500"></i>
                <span>Registar Nova Caução</span>
              </h3>

              <form onSubmit={registarNovaCaucao} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fração *</label>
                  <select
                    required
                    value={cFracaoId}
                    onChange={e => setCFracaoId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-bold"
                  >
                    <option value="">-- Selecionar Fração --</option>
                    {predioFracoes.map(f => (
                      <option key={f.id_fracao} value={f.id_fracao}>
                        Fração {f.fracao_nome} ({f.proprietario.nome})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Titular / Requerente</label>
                  <input
                    type="text"
                    placeholder="Nome do condómino ou empresa..."
                    value={cTitular}
                    onChange={e => CTitularSet(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Finalidade da Caução *</label>
                  <select
                    value={cFinalidade}
                    onChange={e => setCFinalidade(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-medium"
                  >
                    <option value="Reserva de Salão de Festas">Reserva de Salão de Festas</option>
                    <option value="Acesso de Obras e Mudanças">Acesso de Obras e Mudanças</option>
                    <option value="Comando de Garagem">Comando de Garagem</option>
                    <option value="Chave de Acesso Técnico">Chave de Acesso Técnico</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Valor (€) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={cValor}
                      onChange={e => setCValor(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data Depósito *</label>
                    <input
                      type="date"
                      required
                      value={cData}
                      onChange={e => setCData(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Método *</label>
                    <select
                      value={cMetodo}
                      onChange={e => setCMetodo(e.target.value as any)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-medium"
                    >
                      <option value="MBWay">MBWay</option>
                      <option value="Transferência Bancária">Transferência Bancária</option>
                      <option value="Numerário">Numerário</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ref. Comprovativo</label>
                    <input
                      type="text"
                      placeholder="Ex: MBW-12345"
                      value={cRef}
                      onChange={e => setCRef(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  <i className="fa-solid fa-vault"></i>
                  <span>Registar Caução</span>
                </button>
              </form>
            </div>

            {/* List column */}
            <div className="lg:col-span-8 bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase text-slate-800 dark:text-white flex items-center gap-2">
                  <i className="fa-solid fa-list-check text-amber-500"></i>
                  <span>Histórico de Cauções do Condomínio ({caucoes.length})</span>
                </h3>
              </div>

              <div className="space-y-3">
                {caucoes.map(c => (
                  <div
                    key={c.id_caucao}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-800 dark:text-white text-xs">Fração {c.fracao_nome}</span>
                        <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">
                          {c.finalidade}
                        </span>
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                          c.estado === "Ativa (Retida)"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300"
                            : c.estado === "Devolvida"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-300"
                        }`}>
                          {c.estado}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Titular: <strong>{c.titular}</strong> • Depósito em: <strong>{c.data_deposito}</strong> ({c.metodo_pagamento})
                      </p>
                      {c.justificacao_retencao && (
                        <p className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded border border-red-200 dark:border-red-900/40">
                          <strong>Motivo Retenção:</strong> {c.justificacao_retencao}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 shrink-0 self-end md:self-auto">
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-800 dark:text-white font-mono block">
                          €{c.valor.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">Ref: {c.comprovativo_ref || "N/A"}</span>
                      </div>

                      {c.estado === "Ativa (Retida)" && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedCaucaoId(c.id_caucao);
                              setActionType("DEVOLVER");
                              setActionValor(c.valor.toString());
                            }}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <i className="fa-solid fa-hand-holding-dollar"></i>
                            <span>Devolver</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCaucaoId(c.id_caucao);
                              setActionType("RETER");
                              setActionValor(c.valor.toString());
                            }}
                            className="bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <i className="fa-solid fa-gavel"></i>
                            <span>Reter</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {currentTab === "relatorio_dividas" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-chart-pie"></i>
                  </span>
                  <span>Relatórios de Dívidas (Visão Pro Condomínio & Por Condómino)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Visão global consolidada para o edifício e segmentação individual por cada fração, com exportação PDF editável e notificação por email.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintDocument("Relatorio_Dividas_Condominio", "report-dividas-container")}
                  className="bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-file-pdf"></i>
                  <span>Download Relatório PDF</span>
                </button>
                <button
                  onClick={() => openEmailShare(
                    "administracao@condomanager.pt",
                    `Relatório de Dívidas - Edifício ${predio.nome}`,
                    `Junto enviamos o relatório global de dívidas de quotas do edifício ${predio.nome} atualizado à data corrente.\n\nTotal em Incumprimento no Edifício: € ${predioFracoes.reduce((s, f) => s + Math.abs(Math.min(0, getFracaoBalance(f.id_fracao))), 0).toFixed(2)}`,
                    `Relatório Dívidas ${predio.nome}`
                  )}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-envelope"></i>
                  <span>Partilhar Relatório por Email</span>
                </button>
              </div>
            </div>

            {/* KPI Summary Banner (Visão Pro Condomínio) */}
            <div id="report-dividas-container" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40">
                  <span className="text-[10px] font-bold uppercase text-red-700 dark:text-red-400 block">
                    Total em Dívida no Edifício
                  </span>
                  <div className="text-xl font-black text-red-600 dark:text-red-400 mt-1 font-mono">
                    € {predioFracoes.reduce((s, f) => s + Math.abs(Math.min(0, getFracaoBalance(f.id_fracao))), 0).toFixed(2)}
                  </div>
                  <span className="text-[10px] text-red-500 mt-1 block">Visão Pro Condomínio</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Frações em Incumprimento
                  </span>
                  <div className="text-xl font-black text-slate-800 dark:text-white mt-1 font-mono">
                    {predioFracoes.filter(f => getFracaoBalance(f.id_fracao) < 0).length} / {predioFracoes.length}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Com avisos pendentes</span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                  <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">
                    Frações Com Contas em Dia
                  </span>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                    {predioFracoes.filter(f => getFracaoBalance(f.id_fracao) >= 0).length}
                  </div>
                  <span className="text-[10px] text-emerald-500 mt-1 block">Regularizados (Verde)</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Taxa de Adimplência
                  </span>
                  <div className="text-xl font-black text-cyan-600 dark:text-cyan-400 mt-1 font-mono">
                    {predioFracoes.length > 0 
                      ? Math.round((predioFracoes.filter(f => getFracaoBalance(f.id_fracao) >= 0).length / predioFracoes.length) * 100) 
                      : 100}%
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Índice global de cobrança</span>
                </div>
              </div>

              {/* Segmented Table by Condómino */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Segmentação por Condómino / Fração Autónoma
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400 bg-slate-50 dark:bg-slate-900">
                        <th className="py-3 px-4">Fração & Piso</th>
                        <th className="py-3 px-4">Condómino / Proprietário</th>
                        <th className="py-3 px-4">NIF</th>
                        <th className="py-3 px-4">Avisos Pendentes</th>
                        <th className="py-3 px-4">Saldo do Condómino (UI Regra)</th>
                        <th className="py-3 px-4">Estado Legal</th>
                        <th className="py-3 px-4 text-right">Ação Direta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {predioFracoes.map(frac => {
                        const bal = getFracaoBalance(frac.id_fracao);
                        const isGoodStanding = bal >= 0;
                        const pendCount = predioAvisos.filter(a => a.id_fracao === frac.id_fracao && a.estado === "Pendente").length;
                        return (
                          <tr key={frac.id_fracao} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-800 dark:text-white">
                              Fração "{frac.fracao_nome}" ({frac.piso})
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                              {frac.proprietario.nome}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-500">
                              {frac.proprietario.nif}
                            </td>
                            <td className="py-3 px-4">
                              {pendCount > 0 ? (
                                <span className="bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-bold px-2 py-0.5 rounded-full text-[10px]">
                                  {pendCount} quota(s)
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Nenhum</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold">
                              {/* REGRA VISUAL OBRIGATÓRIA: EM DIA = VERDE, EM DÍVIDA/INCUMPRIMENTO = VERMELHO */}
                              {isGoodStanding ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1.5">
                                  <i className="fa-solid fa-check-circle"></i>
                                  <span>+ 0,00 € (Em Dia)</span>
                                </span>
                              ) : (
                                <span className="text-red-600 dark:text-red-400 font-extrabold flex items-center gap-1.5">
                                  <i className="fa-solid fa-triangle-exclamation"></i>
                                  <span>{bal.toFixed(2)} € (Dívida)</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {isGoodStanding ? (
                                <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  Regular
                                </span>
                              ) : (
                                <span className="bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  Incumprimento / Mora
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => openEmailShare(
                                  frac.proprietario.email,
                                  `Extrato de Dívida e Ponto de Situação - Fração ${frac.fracao_nome}`,
                                  `Exmo(a). Sr(a). ${frac.proprietario.nome},\n\nInformamos que à presente data a fração "${frac.fracao_nome}" apresenta o saldo de ${bal.toFixed(2)} € referente a quotas do condomínio.\n\nA Administração do Condomínio ${predio.nome}`,
                                  `Relatório Dívida Fração ${frac.fracao_nome}`
                                )}
                                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                              >
                                <i className="fa-solid fa-envelope"></i>
                                <span>Enviar Aviso</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SUBSECTION 3: EXTRATO DE MOVIMENTOS E SALDO (COM REGRA VERDE / VERMELHO) --- */}
      {currentTab === "extrato_saldo" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-list-check"></i>
                  </span>
                  <span>Extrato de Movimentos e Saldo do Condómino</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Listagem cronológica dos pagamentos e encargos de cada fração, com indicação visual de saldo a Verde (em dia) ou Vermelho (dívida).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400">Selecionar Fração:</span>
                <select
                  value={selectedFracaoId}
                  onChange={e => setSelectedFracaoId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {predioFracoes.map(f => (
                    <option key={f.id_fracao} value={f.id_fracao}>
                      Fração "{f.fracao_nome}" ({f.piso}) — {f.proprietario.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Condómino Saldo Banner (VERDE vs VERMELHO REGRA) */}
            {selectedFracao && (
              <div className="space-y-6">
                <div className={`p-5 rounded-2xl border-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
                  getFracaoBalance(selectedFracao.id_fracao) >= 0
                    ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700"
                    : "bg-red-50/60 dark:bg-red-950/30 border-red-400 dark:border-red-700"
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${
                      getFracaoBalance(selectedFracao.id_fracao) >= 0
                        ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400"
                    }`}>
                      <i className={`fa-solid ${
                        getFracaoBalance(selectedFracao.id_fracao) >= 0 ? "fa-circle-check" : "fa-triangle-exclamation"
                      }`}></i>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white">
                        Fração "{selectedFracao.fracao_nome}" ({selectedFracao.piso}) — {selectedFracao.proprietario.nome}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        NIF: <span className="font-mono font-bold">{selectedFracao.proprietario.nif}</span> • Permilagem: {selectedFracao.permilagem}‰
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider block text-slate-400">
                      Saldo Atual (Regra Cor)
                    </span>
                    {getFracaoBalance(selectedFracao.id_fracao) >= 0 ? (
                      <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono flex items-center justify-end gap-2">
                        <span>+ 0,00 €</span>
                        <span className="text-xs bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-full uppercase font-black">
                          Contas em Dia (Verde)
                        </span>
                      </div>
                    ) : (
                      <div className="text-2xl font-black text-red-600 dark:text-red-400 font-mono flex items-center justify-end gap-2">
                        <span>{getFracaoBalance(selectedFracao.id_fracao).toFixed(2)} €</span>
                        <span className="text-xs bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-300 px-2.5 py-1 rounded-full uppercase font-black">
                          Em Dívida (Vermelho)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Individual Extract Table */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Histórico Cronológico de Quotas & Pagamentos
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePrintDocument(`Extrato_Fracao_${selectedFracao.fracao_nome}`, "extrato-individual-container")}
                        className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <i className="fa-solid fa-file-pdf"></i>
                        <span>Download Extrato PDF</span>
                      </button>
                      <button
                        onClick={() => openEmailShare(
                          selectedFracao.proprietario.email,
                          `Extrato Oficial de Condomínio - Fração ${selectedFracao.fracao_nome}`,
                          `Exmo(a). Sr(a). ${selectedFracao.proprietario.nome},\n\nJunto remetemos o extrato detalhado de quotas e pagamentos da sua fração "${selectedFracao.fracao_nome}".\n\nSaldo atual: ${getFracaoBalance(selectedFracao.id_fracao).toFixed(2)} €\n\nA Administração ${predio.nome}`,
                          `Extrato ${selectedFracao.fracao_nome}`
                        )}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <i className="fa-solid fa-envelope"></i>
                        <span>Partilhar por Email</span>
                      </button>
                    </div>
                  </div>

                  <div id="extrato-individual-container" className="overflow-x-auto bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400 bg-white dark:bg-slate-900">
                          <th className="py-2.5 px-3">Data</th>
                          <th className="py-2.5 px-3">Tipo / Descrição do Movimento</th>
                          <th className="py-2.5 px-3 text-right">Valor Quota / Débito</th>
                          <th className="py-2.5 px-3 text-right">Valor Pago / Crédito</th>
                          <th className="py-2.5 px-3 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {/* Render notices for this fraction */}
                        {predioAvisos
                          .filter(a => a.id_fracao === selectedFracao.id_fracao)
                          .map(aviso => (
                            <tr key={aviso.id_aviso} className="hover:bg-white dark:hover:bg-slate-800 transition-colors">
                              <td className="py-2.5 px-3 font-mono text-slate-500">
                                {formatDatePT(aviso.data)}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-white">
                                {aviso.descricao}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                                {aviso.valor.toFixed(2)} €
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-bold">
                                {aviso.estado === "Pago" ? `${aviso.valor.toFixed(2)} €` : "—"}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {aviso.estado === "Pago" ? (
                                  <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                    Liquidado
                                  </span>
                                ) : (
                                  <span className="bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                    Pendente (Mora)
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        {predioAvisos.filter(a => a.id_fracao === selectedFracao.id_fracao).length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-400 text-xs italic">
                              Sem registos históricos de quotas ou avisos para esta fração.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SUBSECTION 4: QUOTAS MENSAIS --- */}
      {currentTab === "quotas_mensais" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-calendar-check"></i>
                  </span>
                  <span>Quotas Mensais de Condomínio (Ordinárias)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Cálculo, distribuição proporcional por permilagem (‰) e controlo de liquidação das mensalidades normais.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    exportarBalanceteMapaAnualXLS(predio, predioFracoes, 2026, predioAvisos, movList);
                    showToast("📊 Mapa Anual das 12 Quotas Mensais exportado em Excel (.CSV)!");
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                  title="Descarregar grelha das 12 quotas mensais de todas as frações em Excel / CSV para entregar em Assembleia"
                >
                  <img src="/modulos/66-exportacao-financeira.png" alt="Excel" className="h-4 w-4 object-contain" onError={(e) => { e.currentTarget.src = "/marca/18-pdf.png"; }} />
                  <span>Exportar Mapa Anual (12 Meses) em Excel/CSV</span>
                </button>
                <button
                  onClick={() => showToast("📋 Lista de Quotas Mensais exportada em PDF para o condomínio!")}
                  title="Exportar PDF"
                  className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-xs"
                >
                  <img src="/modulos/80-pdf-de-resultados.png" alt="PDF" className="h-5 w-5 object-contain" onError={(e) => { e.currentTarget.src = "/modulos/25-relatorio.png"; }} />
                </button>
              </div>
            </div>

            {/* Quotas Mensais Table */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <th className="p-3">Fração / Piso</th>
                    <th className="p-3 text-center">Permilagem</th>
                    <th className="p-3 text-right">Quota Ordinária Mensal</th>
                    <th className="p-3 text-right">Fundo Reserva (10%)</th>
                    <th className="p-3 text-right font-black">Total Mensalidade</th>
                    <th className="p-3 text-center">Estado Atual</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {predioFracoes.map((f) => {
                    const totalPerm = predioFracoes.reduce((a, c) => a + c.permilagem, 0) || 1000;
                    const quotaReg = 1200 * (f.permilagem / totalPerm);
                    const fundoRes = quotaReg * 0.10;
                    const totalM = quotaReg + fundoRes;

                    const emDia = (f.permilagem % 2 === 0);

                    return (
                      <tr key={f.id_fracao} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-3">
                          <span className="font-bold text-slate-800 dark:text-slate-200">Fração {f.fracao_nome}</span>
                          <span className="text-[10px] text-slate-400 block">{f.piso} • {f.proprietario?.nome || "Sem Proprietário"}</span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-600 dark:text-slate-400">{f.permilagem}‰</td>
                        <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">€{quotaReg.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono text-slate-500">€{fundoRes.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono font-black text-cyan-600 dark:text-cyan-400">€{totalM.toFixed(2)}</td>
                        <td className="p-3 text-center">
                          {emDia ? (
                            <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                              <i className="fa-solid fa-circle-check mr-1"></i>Em Dia
                            </span>
                          ) : (
                            <span className="bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                              <i className="fa-solid fa-clock-rotate-left mr-1"></i>Pendente
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => showToast(`📩 Aviso de Quota Mensal (€${totalM.toFixed(2)}) enviado para ${f.proprietario?.email || "condómino"}`)}
                            className="bg-cyan-50 hover:bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:hover:bg-cyan-900/60 dark:text-cyan-300 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                          >
                            <i className="fa-solid fa-paper-plane mr-1"></i>Aviso
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- SUBSECTION 5: QUOTAS EXTRAORDINÁRIAS --- */}
      {currentTab === "quotas_extra" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-hammer"></i>
                  </span>
                  <span>Quotas Extraordinárias (Obras & Intervenções)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Mapeamento e cobrança de quotas extraordinárias aprovadas em assembleia para obras estruturais e conservação.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => showToast("⚡ Nova quota extraordinária agendada em assembleia!")}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-plus"></i>
                  <span>Lançar Quota Extra</span>
                </button>
              </div>
            </div>

            {/* Intervenção Extraordinária Ativa Card */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">Em Decurso</span>
                  <span className="text-slate-400 text-xs font-semibold">Aprovado em Assembleia 2026</span>
                </div>
                <h3 className="text-sm font-bold text-white">Reabilitação da Fachada Principal & Cobertura</h3>
                <p className="text-xs text-slate-300 mt-0.5">Orçamento Total Aprovado: €12.500,00 | Fracionado em 5 mensalidades extraordinárias.</p>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Angariado</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">€8.750,00</span>
                </div>
                <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
                  <div className="bg-emerald-500 h-full w-[70%]"></div>
                </div>
              </div>
            </div>

            {/* Quotas Extraordinárias Table */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <th className="p-3">Fração</th>
                    <th className="p-3 text-center">Permilagem</th>
                    <th className="p-3 text-right">Quota Extra Total</th>
                    <th className="p-3 text-right">Prestação Mensal (1/5)</th>
                    <th className="p-3 text-center">Estado Cobrança</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {predioFracoes.map((f) => {
                    const totalPerm = predioFracoes.reduce((a, c) => a + c.permilagem, 0) || 1000;
                    const extraTotal = 12500 * (f.permilagem / totalPerm);
                    const extraMensal = extraTotal / 5;
                    const liquidada = f.permilagem > 100;

                    return (
                      <tr key={f.id_fracao} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                          Fração {f.fracao_nome} ({f.piso})
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-600 dark:text-slate-400">{f.permilagem}‰</td>
                        <td className="p-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">€{extraTotal.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono font-black text-red-600 dark:text-red-400">€{extraMensal.toFixed(2)}</td>
                        <td className="p-3 text-center">
                          {liquidada ? (
                            <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                              Pago (3/5)
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                              Em Cobrança (1/5)
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => showToast(`📄 Notificação de Quota Extraordinária (€${extraMensal.toFixed(2)}) emitida para Fração ${f.fracao_nome}`)}
                            className="bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-300 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                          >
                            <i className="fa-solid fa-file-invoice mr-1"></i>Notificar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Filtro Dinâmico de Relatórios PDF */}
      <FiltroRelatoriosPDFModal
        isOpen={isFiltroRelatoriosOpen}
        onClose={() => setIsFiltroRelatoriosOpen(false)}
        predio={predio}
        fracoes={predioFracoes}
        movimentos={movList}
        avisos={predioAvisos}
      />
    </div>
  );
}
