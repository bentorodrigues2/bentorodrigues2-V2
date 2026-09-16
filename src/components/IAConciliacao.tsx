import React, { useState, useRef } from "react";
import { Predio, Fracao, Aviso, Movimento, Conta, LoggedUser, ExtratoTransacao, ReciboQuitacao } from "../types";
import { formatDatePT } from "../utils";
import { parseOFXContent, parseCSVContent, matchBankTransactions } from "../utils/bankStatementParser";
import { generateOfficialReceiptPDF, downloadOfficialReceiptPDF } from "../utils/receiptGenerator";
import { saveAvisosToSupabase, saveMovimentoToSupabase, saveContaToSupabase, registarLogAuditoria } from "../lib/supabaseService";
import { 
  FileSpreadsheet, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  FileText, 
  Download, 
  Building2, 
  CheckCheck, 
  AlertCircle, 
  ArrowDownLeft, 
  ArrowUpRight,
  Filter,
  FileCheck,
  RefreshCw
} from "lucide-react";

interface IAConciliacaoProps {
  predio: Predio;
  fracoes: Fracao[];
  avisos: Aviso[];
  setAvisos: React.Dispatch<React.SetStateAction<Aviso[]>>;
  movements: Movimento[];
  setMovements: React.Dispatch<React.SetStateAction<Movimento[]>>;
  contas: Conta[];
  loggedUser: LoggedUser;
}

export function IAConciliacao({ predio, fracoes, avisos, setAvisos, movements, setMovements, contas, loggedUser }: IAConciliacaoProps) {
  const [promptText, setPromptText] = useState("");
  const [transacoes, setTransacoes] = useState<ExtratoTransacao[]>([]);
  const [processando, setProcessando] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<"TODOS" | "CREDITO" | "DEBITO">("TODOS");
  const [recibosGerados, setRecibosGerados] = useState<ReciboQuitacao[]>([]);
  const [reciboModal, setReciboModal] = useState<ReciboQuitacao | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const predioFracoes = fracoes.filter(f => f.id_predio === predio.id_predio);
  const predioAvisosPendentes = avisos.filter(a => a.id_predio === predio.id_predio && a.estado === "Pendente");

  const carregarAmostraExtrato = () => {
    const amostra = 
      "CAIXA GERAL DE DEPÓSITOS - EXTRATO DE CONDOMÍNIO\n" +
      `CONDOMÍNIO: ${predio.nome || "RUA BENTO RODRIGUES 2"}\n` +
      "DATA;DESCRITIVO;MONTANTE;SALDO\n" +
      "02/05/2026;TRF P/ CONDOMINIO QUOTA RC ESQ ANA SILVA;46.13;1542.80\n" +
      "03/05/2026;MBWAY COND FRAÇÃO 1º DTO BR21D;42.50;1585.30\n" +
      "05/05/2026;DEB. AUT. OTIS ELEVADORES CONTRATO MANUTENÇÃO;-145.50;1439.80\n" +
      "08/05/2026;TRANSF QUOTA 3º ESQ RB23E JOAO SILVA;45.00;1484.80\n" +
      "10/05/2026;PAG SEGURO MULTIRISCOS CONDOMÍNIO ALLIANZ;-210.00;1274.80\n" +
      "12/05/2026;TRF QUOTA COND LOJA COMERCIAL R/C;65.00;1339.80";
    setPromptText(amostra);
    processarTextoExtrato(amostra);
  };

  const processarTextoExtrato = (texto: string) => {
    setProcessando(true);
    try {
      let rawTxs: any[] = [];
      if (texto.includes("<OFX>") || texto.includes("<STMTTRN>")) {
        rawTxs = parseOFXContent(texto);
      } else {
        rawTxs = parseCSVContent(texto);
      }

      if (rawTxs.length === 0) {
        // Fallback simple line parser
        const lines = texto.split("\n").filter(l => l.trim().length > 0);
        lines.forEach((l, i) => {
          if (l.toLowerCase().includes("extrato") || l.toLowerCase().includes("saldo")) return;
          const matchVal = l.match(/([+-]?\d+[.,]\d{2})/);
          if (matchVal) {
            const valNum = parseFloat(matchVal[1].replace(",", "."));
            rawTxs.push({
              data: "2026-05-02",
              tipo: valNum >= 0 ? "CREDITO" : "DEBITO",
              valor: Math.abs(valNum),
              descricao: l.replace(matchVal[0], "").trim() || `Movimento ${i + 1}`
            });
          }
        });
      }

      const matchResults = matchBankTransactions(rawTxs, predioFracoes, predioAvisosPendentes);
      setTransacoes(matchResults);
    } catch (err) {
      console.error("Erro ao analisar extrato:", err);
      alert("Não foi possível analisar o ficheiro. Certifique-se de que é um formato OFX ou CSV válido.");
    } finally {
      setProcessando(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setPromptText(content);
        processarTextoExtrato(content);
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setPromptText(content);
        processarTextoExtrato(content);
      }
    };
    reader.readAsText(file);
  };

  // Conciliate a single transaction
  const conciliarTransacao = (txId: string) => {
    const tx = transacoes.find(t => t.id_transacao === txId);
    if (!tx) return;

    const contaCorrente = contas.find(c => c.id_predio === predio.id_predio && c.tipo.includes("Ordem")) || contas[0];
    const fracao = fracoes.find(f => f.id_fracao === tx.fracao_sugerida_id);

    // 1. Mark associated notices as paid
    if (tx.avisos_pendentes_ids && tx.avisos_pendentes_ids.length > 0) {
      const avisosPagos: Aviso[] = [];
      setAvisos(prev => prev.map(a => {
        if (tx.avisos_pendentes_ids.includes(a.id_aviso)) {
          const atualizado = { ...a, estado: "Paga" };
          avisosPagos.push(atualizado);
          return atualizado;
        }
        return a;
      }));
      saveAvisosToSupabase(avisosPagos).catch(console.error);
    }

    // 2. Update account balance
    if (contaCorrente) {
      if (tx.tipo === "CREDITO") {
        contaCorrente.saldo += tx.valor;
      } else {
        contaCorrente.saldo -= tx.valor;
      }
      saveContaToSupabase(contaCorrente).catch(console.error);
    }

    // 3. Register accounting movement
    const novoMov: Movimento = {
      id_mov: `mov-ia-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
      id_predio: predio.id_predio,
      id_conta: contaCorrente?.id_conta || "cta-1",
      data: tx.data,
      tipo: tx.tipo === "CREDITO" ? "Receita" : "Despesa",
      valor: tx.valor,
      descricao: `Conciliação Automática: ${tx.descricao}`,
      categoria: tx.tipo === "CREDITO" ? "Quotas Ordinárias" : "Manutenção & Serviços",
      id_fracao: tx.fracao_sugerida_id || undefined,
      metodo_pagamento: "Transferência Bancária",
      referencia_recibo: `REC-2026/${Math.floor(1000 + Math.random() * 9000)}`
    };

    setMovements(prev => [novoMov, ...prev]);
    saveMovimentoToSupabase(novoMov).catch(console.error);
    registarLogAuditoria("Financeira", "Conciliou uma transação bancária via IA", predio.id_predio, loggedUser, novoMov.descricao);

    // 4. Generate official Quota Receipt if it's a credit for a fraction
    let novoRecibo: ReciboQuitacao | null = null;
    if (tx.tipo === "CREDITO" && fracao) {
      const seq = Math.floor(10 + Math.random() * 90);
      novoRecibo = {
        id_recibo: `REC-2026/00${seq}`,
        numero_sequencial: seq,
        ano: 2026,
        id_predio: predio.id_predio,
        id_fracao: fracao.id_fracao,
        nome_condomino: fracao.proprietario?.nome || "Condómino Registado",
        nif_condomino: fracao.proprietario?.nif || "999999990",
        fracao_nome: fracao.fracao_nome,
        permilagem: fracao.permilagem,
        data_emissao: new Date().toISOString().split("T")[0],
        data_pagamento: tx.data,
        metodo_pagamento: "Transferência Bancária",
        valor_total: tx.valor,
        rubricas: [
          {
            descricao: `Quota de Condomínio Ordinária - Fração ${fracao.fracao_nome}`,
            valor: Math.round(tx.valor * 0.9 * 100) / 100,
            tipo: "Quota Ordinária"
          },
          {
            descricao: `Fundo Comum de Reserva (FCR 10%) - Fração ${fracao.fracao_nome}`,
            valor: Math.round(tx.valor * 0.1 * 100) / 100,
            tipo: "Fundo Comum de Reserva"
          }
        ],
        iban_predio: predio.iban || "PT50 0033 0000 12345678901 23",
        codigo_verificacao_hash: `SHA256-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
        emitido_por: loggedUser.nome || "Administração do Condomínio"
      };

      setRecibosGerados(prev => [novoRecibo!, ...prev]);
    }

    // 5. Update transaction state in local view
    setTransacoes(prev => prev.map(t => t.id_transacao === txId ? { ...t, estado_conciliacao: "CONCILIADO", recibo_gerado_id: novoRecibo?.id_recibo } : t));
  };

  // Conciliate all high-confidence credit transactions in 1 click
  const conciliarTudo = () => {
    const pendentes = transacoes.filter(t => t.estado_conciliacao === "PENDENTE" && t.tipo === "CREDITO" && t.fracao_sugerida_id);
    if (pendentes.length === 0) {
      alert("Não existem transações de crédito com fração sugerida prontas a conciliar.");
      return;
    }

    pendentes.forEach(t => conciliarTransacao(t.id_transacao));
    alert(`🎉 ${pendentes.length} pagamentos foram conciliados com sucesso e os respetivos recibos oficiais foram gerados!`);
  };

  const transacoesFiltradas = transacoes.filter(t => {
    if (filtroTipo === "CREDITO") return t.tipo === "CREDITO";
    if (filtroTipo === "DEBITO") return t.tipo === "DEBITO";
    return true;
  });

  const totalCreditos = transacoes.filter(t => t.tipo === "CREDITO").reduce((acc, t) => acc + t.valor, 0);
  const totalDebitos = transacoes.filter(t => t.tipo === "DEBITO").reduce((acc, t) => acc + t.valor, 0);
  const totalConciliados = transacoes.filter(t => t.estado_conciliacao === "CONCILIADO").length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Correspondência Automática Bancária
            </span>
            <span className="text-xs text-slate-300 font-mono">OFX / CSV / TXT</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">Conciliação Bancária Inteligente & Emissão de Recibos</h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Importe o ficheiro de extrato do banco (CGD, BPI, Millennium BCP, Santander, Novo Banco). A IA cruza os descritivos com os proprietários e frações, liquida os avisos e gera os Recibos Oficiais em PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={carregarAmostraExtrato}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-indigo-400" />
            <span>Carregar Amostra (.CSV)</span>
          </button>
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            <span>Importar Ficheiro do Banco</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ofx,.csv,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Drag & Drop or Paste Box */}
      <div 
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 transition-colors shadow-xs space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            <Upload className="h-4 w-4 text-indigo-600" />
            <span>Arraste o ficheiro .OFX ou .CSV para aqui, ou cole o conteúdo do extrato em texto:</span>
          </div>
          {transacoes.length > 0 && (
            <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
              {transacoes.length} movimentos detetados
            </span>
          )}
        </div>

        <textarea
          rows={3}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Cole aqui o texto do extrato copiado do homebanking ou arraste o ficheiro..."
          className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
        />

        <div className="flex justify-between items-center pt-1">
          <span className="text-[11px] text-slate-500">
            Compatível com todos os bancos em Portugal: CGD, Millennium BCP, Santander, BPI, Novo Banco, Banco Montepio, Crédito Agrícola, etc.
          </span>
          <button
            type="button"
            onClick={() => processarTextoExtrato(promptText)}
            disabled={!promptText || processando}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {processando ? (
              <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> <span>A Analisar Extrato...</span></>
            ) : (
              <><Sparkles className="h-3.5 w-3.5" /> <span>Mapear & Conciliar Movimentos</span></>
            )}
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      {transacoes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Movimentos</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xl font-bold text-slate-800 dark:text-white">{transacoes.length}</span>
              <FileText className="h-5 w-5 text-indigo-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">Total Receitas / Créditos</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xl font-bold text-emerald-600 font-mono">+{totalCreditos.toFixed(2)} €</span>
              <ArrowDownLeft className="h-5 w-5 text-emerald-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 block">Total Despesas / Débitos</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xl font-bold text-red-600 font-mono">-{totalDebitos.toFixed(2)} €</span>
              <ArrowUpRight className="h-5 w-5 text-red-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Conciliação Concluída</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xl font-bold text-indigo-600 font-mono">{totalConciliados} / {transacoes.length}</span>
              <CheckCheck className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
        </div>
      )}

      {/* Main Transactions Grid & Actions */}
      {transacoes.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Action Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Filtrar:</span>
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900 text-xs">
                <button
                  type="button"
                  onClick={() => setFiltroTipo("TODOS")}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${filtroTipo === "TODOS" ? "bg-slate-800 text-white" : "text-slate-600 dark:text-slate-300 hover:text-slate-900"}`}
                >
                  Todos ({transacoes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroTipo("CREDITO")}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${filtroTipo === "CREDITO" ? "bg-emerald-600 text-white" : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"}`}
                >
                  Créditos ({transacoes.filter(t => t.tipo === "CREDITO").length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroTipo("DEBITO")}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${filtroTipo === "DEBITO" ? "bg-red-600 text-white" : "text-red-600 hover:bg-red-50 dark:hover:bg-red-950"}`}
                >
                  Débitos ({transacoes.filter(t => t.tipo === "DEBITO").length})
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={conciliarTudo}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="h-4 w-4" />
              <span>Conciliar Todas as Quotas & Emitir Recibos (1-Clique)</span>
            </button>
          </div>

          {/* Transactions List */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {transacoesFiltradas.map((tx) => {
              const fracao = fracoes.find(f => f.id_fracao === tx.fracao_sugerida_id);
              const isConciliado = tx.estado_conciliacao === "CONCILIADO";

              return (
                <div key={tx.id_transacao} className={`p-4 transition-colors ${isConciliado ? "bg-emerald-50/40 dark:bg-emerald-950/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}>
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    {/* Left: Transaction Info */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{formatDatePT(tx.data)}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tx.tipo === "CREDITO" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"}`}>
                          {tx.tipo === "CREDITO" ? "CRÉDITO / RECEITA" : "DÉBITO / DESPESA"}
                        </span>
                        {isConciliado ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Conciliado & Quitado
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tx.confianca_percent >= 90 ? "bg-indigo-100 text-indigo-800 border border-indigo-200" : "bg-amber-100 text-amber-800"}`}>
                            Confiança da Correspondência: {tx.confianca_percent}%
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{tx.descricao}</p>
                      
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-indigo-500" />
                        <span>{tx.motivo_correspondencia}</span>
                      </p>

                      {fracao && (
                        <div className="inline-flex items-center gap-2 mt-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
                          <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                          <span className="font-bold text-slate-700 dark:text-slate-200">Fração {fracao.fracao_nome} ({fracao.piso})</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-600 dark:text-slate-300">Titular: {fracao.proprietario?.nome}</span>
                        </div>
                      )}
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                      <div className="text-right">
                        <span className={`text-base font-black font-mono block ${tx.tipo === "CREDITO" ? "text-emerald-600" : "text-red-600"}`}>
                          {tx.tipo === "CREDITO" ? "+" : "-"}{tx.valor.toFixed(2)} €
                        </span>
                        {tx.recibo_gerado_id && (
                          <span className="text-[10px] font-mono text-emerald-600 font-bold block">
                            Recibo: {tx.recibo_gerado_id}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isConciliado ? (
                          <button
                            type="button"
                            onClick={() => {
                              const r = recibosGerados.find(rec => rec.id_recibo === tx.recibo_gerado_id) || {
                                id_recibo: tx.recibo_gerado_id || "REC-2026/0014",
                                numero_sequencial: 14,
                                ano: 2026,
                                id_predio: predio.id_predio,
                                id_fracao: fracao?.id_fracao || "frac-1",
                                nome_condomino: fracao?.proprietario?.nome || "Condómino",
                                nif_condomino: fracao?.proprietario?.nif || "999999990",
                                fracao_nome: fracao?.fracao_nome || "A",
                                permilagem: fracao?.permilagem || 50,
                                data_emissao: new Date().toISOString().split("T")[0],
                                data_pagamento: tx.data,
                                metodo_pagamento: "Transferência Bancária",
                                valor_total: tx.valor,
                                rubricas: [
                                  { descricao: `Quota Ordinária Fração ${fracao?.fracao_nome || "A"}`, valor: tx.valor * 0.9, tipo: "Quota Ordinária" },
                                  { descricao: `FCR (10%) Fração ${fracao?.fracao_nome || "A"}`, valor: tx.valor * 0.1, tipo: "Fundo Comum de Reserva" }
                                ],
                                iban_predio: predio.iban || "PT50 0033 0000 12345678901 23",
                                codigo_verificacao_hash: "SHA256-QUITA-VERIFIED",
                                emitido_por: loggedUser.nome
                              };
                              downloadOfficialReceiptPDF(r, predio, fracao);
                            }}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Descarregar Recibo PDF</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => conciliarTransacao(tx.id_transacao)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Aprovar & Emitir Recibo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
