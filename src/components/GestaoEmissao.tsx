import React, { useState, useEffect } from "react";
import { Predio, Fracao, Aviso, LoggedUser, Documento, RevisaoOrcamento, Conta, Movimento } from "../types";
import { formatDatePT, generateAndDownloadPdf, formatQuotaReceiptNumber, downloadReceiptPDF, gerarReferenciaBR23E, parseValorMonetario } from "../utils";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  dbUpdate,
  saveAvisosToSupabase,
  saveContaToSupabase,
  saveMovimentoToSupabase,
  registarLogAuditoria,
  fetchRevisoesOrcamentoFromSupabase,
  saveRevisaoOrcamentoToSupabase,
  deleteRevisaoOrcamentoFromSupabase,
  orcamentoVigente
} from "../lib/supabaseService";

interface GestaoEmissaoProps {
  predio: Predio;
  fracoes: Fracao[];
  avisos: Aviso[];
  setAvisos: React.Dispatch<React.SetStateAction<Aviso[]>>;
  contas: Conta[];
  setContas: React.Dispatch<React.SetStateAction<Conta[]>>;
  movements: Movimento[];
  setMovements: React.Dispatch<React.SetStateAction<Movimento[]>>;
  documentos?: Documento[];
  setDocumentos?: React.Dispatch<React.SetStateAction<Documento[]>>;
  loggedUser: LoggedUser;
}

export function GestaoEmissao({ predio, fracoes, avisos, setAvisos, contas, setContas, movements, setMovements, documentos, setDocumentos, loggedUser }: GestaoEmissaoProps) {
  const [orcamentoAnual, setOrcamentoAnual] = useState(() => {
    const guardado = (predio.patrimonio as any)?.orcamento_anual;
    return guardado ? String(guardado) : "";
  });
  const [mes, setMes] = useState("Janeiro");

  // O orçamento anual também é necessário no servidor (emissão automática de
  // quotas no dia 25 via cron — ver server/lib/cronService.js), por isso é
  // guardado em predios.patrimonio, tal como a assinatura do administrador.
  useEffect(() => {
    const guardado = (predio.patrimonio as any)?.orcamento_anual;
    setOrcamentoAnual(guardado ? String(guardado) : "");
  }, [predio.id_predio]);

  const persistirOrcamentoNoSupabase = async (valor: number) => {
    if (!isSupabaseConfigured) return;
    try {
      await dbUpdate("predios", { patrimonio: { ...(predio.patrimonio || {}), orcamento_anual: valor } }, [["id_predio", "eq", predio.id_predio]]);
    } catch (err) {
      console.warn("[Supabase] Erro ao guardar orçamento anual:", err);
    }
  };

  // Histórico de adendas/revisões ao orçamento anual — permite registar que
  // a partir de uma certa data (ex: aprovada em assembleia a meio do ano)
  // passa a vigorar um novo valor, sem perder o histórico do anterior. A
  // sincronização diária (server/lib/cronService.js) aplica sozinha a
  // revisão certa quando a sua data de vigência chega; ao gravar uma
  // revisão já em vigor hoje, aplica-se de imediato aqui também.
  const [revisoesOrcamento, setRevisoesOrcamento] = useState<RevisaoOrcamento[]>([]);
  const [novaRevisaoValor, setNovaRevisaoValor] = useState("");
  const [novaRevisaoData, setNovaRevisaoData] = useState(() => new Date().toISOString().split("T")[0]);
  const [novaRevisaoAssembleia, setNovaRevisaoAssembleia] = useState(false);
  const [novaRevisaoMotivo, setNovaRevisaoMotivo] = useState("");

  useEffect(() => {
    fetchRevisoesOrcamentoFromSupabase(predio.id_predio).then(r => setRevisoesOrcamento(r || []));
  }, [predio.id_predio]);

  const revisaoEmVigor = orcamentoVigente(revisoesOrcamento);

  const handleAddRevisaoOrcamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedUser.role !== "ADMIN" && loggedUser.role !== "EMPRESA_GESTORA") {
      return alert("Apenas administradores podem registar revisões ao orçamento!");
    }
    if (!novaRevisaoValor || !novaRevisaoData) return alert("Preencha o novo valor e a data de vigência.");
    const novoValorRevisao = parseValorMonetario(novaRevisaoValor);
    if (novoValorRevisao <= 0) return alert("Indique um valor válido para a revisão do orçamento.");

    const nova: RevisaoOrcamento = {
      id_revisao: "rev-" + Date.now(),
      id_predio: predio.id_predio,
      valor: novoValorRevisao,
      data_vigencia: novaRevisaoData,
      aprovado_em_assembleia: novaRevisaoAssembleia,
      motivo: novaRevisaoMotivo || undefined
    };
    const ok = await saveRevisaoOrcamentoToSupabase(nova);
    if (!ok) return alert("❌ Não foi possível gravar a revisão no Supabase. Tente novamente.");

    const novaLista = [nova, ...revisoesOrcamento];
    setRevisoesOrcamento(novaLista);
    registarLogAuditoria("Financeira", "Registou uma revisão ao orçamento anual", predio.id_predio, loggedUser, `Novo valor: ${nova.valor.toFixed(2)} € a partir de ${formatDatePT(nova.data_vigencia)}`);

    // Se a revisão já entra em vigor hoje (ou no passado), aplica de imediato
    // em vez de esperar pela sincronização diária do cron.
    const maisRecenteVigente = orcamentoVigente(novaLista);
    if (maisRecenteVigente && maisRecenteVigente.id_revisao === nova.id_revisao) {
      setOrcamentoAnual(String(nova.valor));
      await persistirOrcamentoNoSupabase(nova.valor);
    }

    setNovaRevisaoValor("");
    setNovaRevisaoMotivo("");
    setNovaRevisaoAssembleia(false);
    alert(
      maisRecenteVigente?.id_revisao === nova.id_revisao
        ? "✅ Revisão registada e já aplicada — o orçamento anual em vigor foi atualizado."
        : "✅ Revisão registada — entra em vigor automaticamente em " + formatDatePT(nova.data_vigencia) + "."
    );
  };

  const handleRemoverRevisaoOrcamento = async (revisao: RevisaoOrcamento) => {
    if (!window.confirm(`Eliminar a revisão de ${revisao.valor.toFixed(2)} € (vigência ${formatDatePT(revisao.data_vigencia)})?`)) return;
    const ok = await deleteRevisaoOrcamentoFromSupabase(revisao.id_revisao);
    if (!ok) return alert("❌ Não foi possível eliminar a revisão no Supabase.");
    setRevisoesOrcamento(prev => prev.filter(r => r.id_revisao !== revisao.id_revisao));
  };

  // Document Viewer modal states
  const [selectedAviso, setSelectedAviso] = useState<Aviso | null>(null);
  const [docType, setDocType] = useState<"RECIBO" | "NOTA_COBRANCA">("NOTA_COBRANCA");
  
  // Customization states for the generated document
  const [customIban, setCustomIban] = useState(predio.iban || "PT50 0033 0000 12345678901 23");
  const [customDataLimite, setCustomDataLimite] = useState("");
  const [customDataPagamento, setCustomDataPagamento] = useState("");
  const [customQuotaMensal, setCustomQuotaMensal] = useState<number>(0);
  const [customQuotaExtra, setCustomQuotaExtra] = useState<number>(0);
  const [customDescritivo, setCustomDescritivo] = useState("");
  const [customCondomino, setCustomCondomino] = useState("");
  const [customNrecibo, setCustomNrecibo] = useState("");
  const [pagamentoContaId, setPagamentoContaId] = useState("");
  const [aRegistarPagamento, setARegistarPagamento] = useState(false);

  const predioFracoes = fracoes.filter(f => f.id_predio === predio.id_predio);
  const predioAvisos = avisos.filter(a => a.id_predio === predio.id_predio);
  const predioContas = contas.filter(c => c.id_predio === predio.id_predio);

  const selectedFracaoObj = selectedAviso ? fracoes.find(f => f.id_fracao === selectedAviso.id_fracao) : null;
  const referenciaBR23EOficial = selectedFracaoObj?.referencia_br23e || selectedFracaoObj?.proprietario?.referencia_br23e || (selectedFracaoObj ? gerarReferenciaBR23E(selectedFracaoObj.fracao_nome, selectedFracaoObj.id_fracao) : "BR23E-FR-01");

  const gerarOrcamentoMensal = (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedUser.role !== 'ADMIN' && loggedUser.role !== 'EMPRESA_GESTORA') {
      return alert("Apenas administradores podem emitir quotas!");
    }
    if (!orcamentoAnual) return alert("Preencha o Orçamento Anual!");
    const orcamentoAnualNum = parseValorMonetario(orcamentoAnual);
    if (orcamentoAnualNum <= 0) return alert("Indique um valor válido para o Orçamento Anual!");

    persistirOrcamentoNoSupabase(orcamentoAnualNum);

    const novosAvisos: Aviso[] = [];
    const d = new Date();
    const dataDoc = d.toISOString().split('T')[0];

    predioFracoes.forEach(f => {
      const isShopExempt = f.tipologia === "Loja Comercial" && f.tipo_access.includes("Exterior");
      let fatorIsencao = 1.0;
      if (isShopExempt) fatorIsencao = 0.4; // 60% de desconto legal

      const orcamentoMensalProporcional = (orcamentoAnualNum / 12) * (f.permilagem / 1000) * fatorIsencao;
      const valorOrdinario = Math.round((orcamentoMensalProporcional * 0.9) * 100) / 100;
      const valorFCR = Math.round((orcamentoMensalProporcional * 0.1) * 100) / 100;

      const idOrdinario = "av-" + Math.floor(10000 + Math.random() * 90000);
      const idFCR = "av-" + Math.floor(10000 + Math.random() * 90000);

      novosAvisos.push({
        id_aviso: idOrdinario,
        id_predio: predio.id_predio,
        id_fracao: f.id_fracao,
        tipo: "Cota Ordinária",
        data: dataDoc,
        vencimento: "2026-08-15",
        descricao: `Quota de Condomínio Ordinária - ${mes} / 2026`,
        valor: valorOrdinario,
        estado: "Pendente"
      });

      novosAvisos.push({
        id_aviso: idFCR,
        id_predio: predio.id_predio,
        id_fracao: f.id_fracao,
        tipo: "Fundo de Reserva",
        data: dataDoc,
        vencimento: "2026-08-15",
        descricao: `Quota do Fundo Comum de Reserva (FCR) - ${mes} / 2026`,
        valor: valorFCR,
        estado: "Pendente"
      });
    });

    setAvisos([...avisos, ...novosAvisos]);
    saveAvisosToSupabase(novosAvisos).catch(console.error);
    registarLogAuditoria(
      "Financeira",
      `Emitiu ${novosAvisos.length} notas de cobrança (Quotas + FCR) - ${mes}/2026`,
      predio.id_predio,
      loggedUser
    );

    if (setDocumentos) {
      const novosDocs: Documento[] = novosAvisos.map(a => {
        const frac = fracoes.find(f => f.id_fracao === a.id_fracao);
        return {
          id_doc: "doc-nc-" + a.id_aviso,
          id_predio: predio.id_predio,
          nome: `Nota_Cobranca_${a.id_aviso.toUpperCase()}_Fracao_${frac?.fracao_nome || "A"}.pdf`,
          tipo: "Nota de Cobrança",
          data_upload: dataDoc,
          tamanho: "280 KB",
          categoria: "Pasta Paga. Quotas",
          sub_pasta: "Notas de cobrança",
          descricao: `Nota de cobrança para ${a.descricao} - Fração ${frac?.fracao_nome}`,
          visibilidade: "Público",
          autor: loggedUser.nome || "Administração",
          tema: "Pasta Paga. Quotas",
          ano: dataDoc.substring(0, 4),
          tipo_arquivo: "documento",
          relevancia_perfis: ["ADMIN", "EMPRESA_GESTORA", "USER", "CONTABILISTA"]
        };
      });
      setDocumentos(prev => [...prev, ...novosDocs]);
    }

    alert("Foram gerados e emitidos com sucesso os avisos de cobrança 'Q' para todas as frações! Arquivados na Pasta Paga. Quotas.");
  };

  const abrirDocumento = (aviso: Aviso, tipoInicial: "RECIBO" | "NOTA_COBRANCA") => {
    const frac = fracoes.find(f => f.id_fracao === aviso.id_fracao);
    const codPostal = predio.codigo_postal;
    
    // Auto-generate receipt number
    const hash = aviso.id_aviso.toUpperCase();
    const nRec = formatQuotaReceiptNumber(hash.replace("AV-", ""));

    setSelectedAviso(aviso);
    setDocType(tipoInicial);
    setCustomIban(predio.iban || "PT50 0033 0000 12345678901 23");
    setCustomDataLimite(aviso.vencimento);
    setCustomDataPagamento(aviso.data);
    
    if (aviso.tipo.includes("Ordinária")) {
      setCustomQuotaMensal(aviso.valor);
      setCustomQuotaExtra(0);
    } else if (aviso.tipo.includes("Extraordinária") || aviso.tipo.includes("Extra")) {
      setCustomQuotaMensal(0);
      setCustomQuotaExtra(aviso.valor);
    } else {
      setCustomQuotaMensal(aviso.valor);
      setCustomQuotaExtra(0);
    }

    setCustomDescritivo(aviso.descricao);
    setCustomCondomino(frac?.proprietario?.nome || "Condómino Registado");
    setCustomNrecibo(nRec);
  };

  const alterarEstadoAviso = (id: string, novoEstado: string) => {
    setAvisos(prev => prev.map(a => a.id_aviso === id ? { ...a, estado: novoEstado } : a));
    if (selectedAviso && selectedAviso.id_aviso === id) {
      setSelectedAviso(prev => prev ? { ...prev, estado: novoEstado } : null);
    }
    dbUpdate("avisos", { estado: novoEstado }, [["id_aviso", "eq", id]]).catch(console.error);
    registarLogAuditoria("Financeira", `Alterou o estado do aviso ${id} para "${novoEstado}"`, predio.id_predio, loggedUser);
  };

  // Regista o depósito real do condómino ao marcar um aviso como pago —
  // antes "Marcar Pago" só mudava um estado (sem criar nenhum movimento
  // bancário nem tocar no saldo de conta nenhuma), por isso o recibo gerado
  // mostrava referências de movimento (MOV-...) completamente fabricadas,
  // que não correspondiam a nada na Tesouraria. Agora cria um Movimento real
  // ligado à fração e à conta escolhida, e credita mesmo o saldo dessa conta.
  const handleMarcarPagoComMovimento = async (aviso: Aviso, idConta: string) => {
    if (!idConta) {
      alert("Selecione a conta bancária onde o valor foi recebido antes de marcar como pago.");
      return;
    }
    const contaAlvo = contas.find(c => c.id_conta === idConta);
    if (!contaAlvo) {
      alert("Conta bancária inválida.");
      return;
    }

    const frac = fracoes.find(f => f.id_fracao === aviso.id_fracao);
    const novoMovimento: Movimento = {
      id_mov: "mov-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      id_predio: predio.id_predio,
      id_conta: idConta,
      id_fracao: aviso.id_fracao,
      data: customDataPagamento || new Date().toISOString().split("T")[0],
      tipo: "Receita",
      valor: aviso.valor,
      descricao: `${aviso.tipo || "Quota"} — Fração ${frac?.fracao_nome || aviso.id_fracao} (Aviso ${aviso.id_aviso})`,
      categoria: (aviso.tipo || "").toLowerCase().includes("extra") ? "Quota Extraordinária" : "Quota Mensal",
      estado: "Justificado",
      metodo_pagamento: "Transferência Bancária"
    };

    const contaAtualizada: Conta = { ...contaAlvo, saldo: (contaAlvo.saldo || 0) + aviso.valor };
    setContas(prev => prev.map(c => c.id_conta === idConta ? contaAtualizada : c));
    saveContaToSupabase(contaAtualizada).catch(console.error);

    setMovements(prev => [novoMovimento, ...prev]);
    saveMovimentoToSupabase(novoMovimento).catch(console.error);

    const atualizacaoAviso = { estado: "Paga", id_movimento: novoMovimento.id_mov, id_conta: idConta };
    setAvisos(prev => prev.map(a => a.id_aviso === aviso.id_aviso ? { ...a, ...atualizacaoAviso } : a));
    if (selectedAviso && selectedAviso.id_aviso === aviso.id_aviso) {
      setSelectedAviso(prev => prev ? { ...prev, ...atualizacaoAviso } : null);
    }
    dbUpdate("avisos", atualizacaoAviso, [["id_aviso", "eq", aviso.id_aviso]]).catch(console.error);
    registarLogAuditoria("Financeira", `Registou o recebimento do aviso ${aviso.id_aviso} na conta ${contaAlvo.banco}`, predio.id_predio, loggedUser, `${aviso.valor.toFixed(2)}€`);

    setARegistarPagamento(false);
    setPagamentoContaId("");
  };

  const fecharModal = () => {
    setSelectedAviso(null);
  };

  const handleExportReceiptA5 = () => {
    if (!selectedAviso) return;
    const frac = fracoes.find(f => f.id_fracao === selectedAviso.id_fracao);
    const avisoHash = selectedAviso.id_aviso.toUpperCase().replace("AV-", "");
    const isExtra = selectedAviso.tipo.includes("Extra");

    const fallbackRecNum = formatQuotaReceiptNumber(Math.floor(1000 + Math.random() * 9000));
    const recNumStr = customNrecibo || fallbackRecNum;
    const dtPag = customDataPagamento || selectedAviso.data || new Date().toISOString().split("T")[0];

    // Usa a referência do Movimento REAL criado ao "Marcar Pago" (se existir)
    // em vez de fabricar códigos MOV-... que não correspondem a nada na
    // Tesouraria — só cai no fallback gerado se o aviso ainda não tiver
    // sido processado por handleMarcarPagoComMovimento (ex: recibo emitido
    // manualmente antes do registo do depósito).
    const refMovimentoReal = selectedAviso.id_movimento;
    downloadReceiptPDF({
      reciboNum: recNumStr,
      dataPagamento: dtPag,
      movimentoQuotaMensal: refMovimentoReal || `MOV-${new Date().getFullYear()}-QM-${avisoHash}`,
      movimentoFundoReserva: refMovimentoReal || `MOV-${new Date().getFullYear()}-FR-${avisoHash}`,
      movimentoQuotaExtra: refMovimentoReal || `MOV-${new Date().getFullYear()}-QE-${avisoHash}`,
      buildingName: predio?.nome || "Condomínio",
      buildingAddress: `${predio?.morada_linha1 || ""} ${predio?.num_porta || ""}, ${predio?.localidade || ""}`,
      buildingNif: predio?.nif || "—",
      proprietarioNome: customCondomino || frac?.proprietario?.nome || "Condómino Registado",
      proprietarioNif: frac?.proprietario?.nif || "—",
      fracaoIdent: `Fração ${frac?.fracao_nome || frac?.id_fracao || "A"} (${frac?.piso || "Piso 1"})`,
      referenciaFracao: referenciaBR23EOficial,
      metodoPagamento: "Transferência Bancária",
      quotaMensalVal: isExtra ? 0 : customQuotaMensal,
      fundoReservaVal: isExtra ? 0 : Number((customQuotaMensal * 0.10).toFixed(2)),
      quotaExtraVal: isExtra ? customQuotaExtra || selectedAviso.valor : 0,
      isQuotaExtra: isExtra,
      descricaoQuota: customDescritivo,
      adminNome: loggedUser.nome ? `${loggedUser.nome} (Administração)` : "Administração do Condomínio",
      adminSignatureBase64: localStorage.getItem("admin_signature_digital") || undefined
    });

    if (setDocumentos) {
      const subFolder = isExtra ? "Recibos Quotas extra" : "Recibos";
      const docAno = dtPag.substring(0, 4);

      setDocumentos(prev => [
        ...prev,
        {
          id_doc: "doc-rec-" + Math.floor(10000 + Math.random() * 90000),
          id_predio: predio.id_predio,
          nome: `Recibo_${recNumStr.replace(/[^a-zA-Z0-9_-]/g, "_")}_Fracao_${frac?.fracao_nome || "A"}.pdf`,
          tipo: isExtra ? "Recibo Quotas extra" : "Recibo",
          data_upload: dtPag,
          tamanho: "320 KB",
          categoria: "Pasta Paga. Quotas",
          sub_pasta: subFolder,
          descricao: `Recibo nº ${recNumStr} - Fração ${frac?.fracao_nome || "A"} - ${customDescritivo || "Pagamento de Quota"}`,
          visibilidade: "Público",
          autor: loggedUser.nome || "Administração",
          tema: "Pasta Paga. Quotas",
          ano: docAno,
          tipo_arquivo: "documento",
          relevancia_perfis: ["ADMIN", "EMPRESA_GESTORA", "USER", "CONTABILISTA"]
        }
      ]);
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById("printable-document-container");
    if (!printContent) return;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      if (selectedAviso) {
        generateAndDownloadPdf(
          `${docType === "RECIBO" ? "RECIBO" : "AVISO DE COBRANÇA DE QUOTA"} - Fração ${selectedAviso.fracao_nome}`,
          [
            { heading: "Discriminação da Liquidação", content: `Aviso nº: ${selectedAviso.id_aviso}\nFração: ${selectedAviso.fracao_nome}\nValor: ${selectedAviso.valor.toFixed(2)} €\nPeríodo: ${selectedAviso.mes_referencia || "Quotas do Condomínio"}\nEstado: ${selectedAviso.pago ? "LIQUIDADO / QUITADO" : "PENDENTE DE PAGAMENTO"}` },
            { heading: "Dados para Pagamento (Transferência Bancária)", content: `IBAN do Condomínio: ${customIban || predio.iban || "PT50 0033 0000 12345678901 02"}\nReferência Obrigatória no Descritivo (IA): ${referenciaBR23EOficial}` }
          ],
          `${docType}_${selectedAviso.fracao_nome}_${selectedAviso.id_aviso}.pdf`,
          [{ label: "Edifício", value: predio.nome }, { label: "Data de Emissão", value: formatDatePT(selectedAviso.data_emissao) }]
        );
      }
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${docType === "RECIBO" ? "Recibo" : "Nota de Cobrança"} - ${predio.nome}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
            body { 
              font-family: 'Inter', system-ui, -apple-system, sans-serif; 
              color: #1A1A1A; 
              padding: 40px; 
              font-size: 11px; 
              line-height: 1.5; 
              background: #fff; 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact; 
            }
            .flex { display: flex; }
            .flex-col { display: flex; flex-direction: column; }
            .justify-between { justify-content: space-between; }
            .justify-center { justify-content: center; }
            .items-center { align-items: center; }
            .items-end { align-items: flex-end; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .text-justify { text-align: justify; }
            .border-b { border-bottom: 1px solid #1A1A1A; }
            .border-b-2 { border-bottom: 2px solid #1A1A1A; }
            .border-t { border-top: 1px solid #1A1A1A; }
            .border-2 { border: 2px solid #1A1A1A; }
            .border-dashed { border-style: dashed; }
            .border-slate-100 { border-color: #f1f5f9; }
            .border-slate-200 { border-color: #e2e8f0; }
            .pb-4 { padding-bottom: 16px; }
            .pb-5 { padding-bottom: 20px; }
            .pt-4 { padding-top: 16px; }
            .pt-6 { padding-top: 24px; }
            .pt-8 { padding-top: 32px; }
            .mt-1 { margin-top: 4px; }
            .mt-1\\.5 { margin-top: 6px; }
            .mt-2 { margin-top: 8px; }
            .mt-6 { margin-top: 24px; }
            .mt-8 { margin-top: 32px; }
            .mt-12 { margin-top: 48px; }
            .mb-2 { margin-bottom: 8px; }
            .mb-6 { margin-bottom: 24px; }
            .grid { display: grid; }
            .grid-cols-2 { grid-template-cols: 1fr 1fr; }
            .gap-4 { gap: 16px; }
            .gap-6 { gap: 24px; }
            .font-bold { font-weight: 700; }
            .font-black { font-weight: 900; }
            .text-sm { font-size: 13px; }
            .text-lg { font-size: 18px; }
            .text-xl { font-size: 20px; }
            .text-xs { font-size: 10px; }
            .text-slate-400 { color: #555555; }
            .text-slate-500 { color: #333333; }
            .text-emerald-600 { color: #047857; }
            .text-emerald-700 { color: #065f46; }
            .text-indigo-700 { color: #4338ca; }
            .text-red-600 { color: #b91c1c; }
            .bg-slate-50 { background-color: #f8fafc; }
            .bg-emerald-50\\/30 { background-color: rgba(209, 250, 229, 0.3); }
            .p-2 { padding: 8px; }
            .p-3 { padding: 12px; }
            .p-4 { padding: 16px; }
            .p-5 { padding: 20px; }
            .px-5 { padding-left: 20px; padding-right: 20px; }
            .py-3 { padding-top: 12px; padding-bottom: 12px; }
            .rounded-xl { border-radius: 12px; }
            .border { border: 1px solid #1A1A1A; }
            .w-full { width: 100%; }
            .w-28 { width: 112px; }
            .max-w-sm { max-w: 384px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; color: #1A1A1A; }
            th { border-bottom: 2px solid #1A1A1A; font-weight: 700; color: #1A1A1A; font-size: 10px; text-transform: uppercase; }
            .font-mono { font-family: 'JetBrains Mono', monospace; }
            .relative { position: relative; }
            .absolute { position: absolute; }
            .top-1\\/2 { top: 50%; }
            .left-1\\/2 { left: 50%; }
            .pointer-events-none { pointer-events: none; }
            .opacity-10 { opacity: 0.11; }
            .space-y-1 > * + * { margin-top: 4px; }
            .space-y-3 > * + * { margin-top: 12px; }
            .space-y-4 > * + * { margin-top: 16px; }
            .break-all { word-break: break-all; }
            .leading-none { line-height: 1; }
            .leading-relaxed { line-height: 1.625; }
            .tracking-tight { tracking-tight: -0.025em; }
            .tracking-wider { tracking-wider: 0.05em; }
            .uppercase { text-transform: uppercase; }
            .watermark-container {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-30deg);
              opacity: 0.11;
              pointer-events: none;
              text-align: center;
              z-index: 0;
              width: 100%;
            }
            .watermark-text {
              font-size: 72px;
              font-weight: 900;
              letter-spacing: 12px;
              color: #1A1A1A;
            }
          </style>
        </head>
        <body>
          <div style="position: relative; min-height: 100%;">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {(loggedUser.role === 'ADMIN' || loggedUser.role === 'EMPRESA_GESTORA') && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 no-print">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <i className="fa-solid fa-file-signature text-sm"></i>
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Adendas & Revisões ao Orçamento Anual</h3>
              <p className="text-xs text-slate-500">Regista uma revisão aprovada em assembleia a meio do ano (mantém o histórico do valor anterior, entra em vigor sozinha na data indicada).</p>
            </div>
          </div>

          {revisaoEmVigor && (
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-800">
              <strong>Em vigor desde {formatDatePT(revisaoEmVigor.data_vigencia)}:</strong> {revisaoEmVigor.valor.toFixed(2)} € /ano
              {revisaoEmVigor.aprovado_em_assembleia ? " (aprovado em assembleia)" : ""}
              {revisaoEmVigor.motivo ? ` — ${revisaoEmVigor.motivo}` : ""}
            </div>
          )}

          <form onSubmit={handleAddRevisaoOrcamento} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Novo Valor Anual (€) *</label>
              <input type="text" inputMode="decimal" value={novaRevisaoValor} onChange={e => setNovaRevisaoValor(e.target.value)} placeholder="Ex: 12000" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono" />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Vigência a partir de *</label>
              <input type="date" value={novaRevisaoData} onChange={e => setNovaRevisaoData(e.target.value)} className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Motivo / Ata</label>
              <input type="text" value={novaRevisaoMotivo} onChange={e => setNovaRevisaoMotivo(e.target.value)} placeholder="Ex: Ata da AG de 12/06" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                <input type="checkbox" checked={novaRevisaoAssembleia} onChange={e => setNovaRevisaoAssembleia(e.target.checked)} className="cursor-pointer" />
                Aprovado em assembleia
              </label>
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0">
                Registar Revisão
              </button>
            </div>
          </form>

          {revisoesOrcamento.length > 0 && (
            <div className="overflow-x-auto border border-slate-150 rounded-xl">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="p-2.5">Vigência</th>
                    <th className="p-2.5 text-right">Valor Anual</th>
                    <th className="p-2.5">Motivo</th>
                    <th className="p-2.5 text-center">Assembleia</th>
                    <th className="p-2.5 text-center">Estado</th>
                    <th className="p-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {revisoesOrcamento.map(r => (
                    <tr key={r.id_revisao} className={`border-b border-slate-100 hover:bg-slate-50/50 ${r.id_revisao === revisaoEmVigor?.id_revisao ? "bg-indigo-50/40" : ""}`}>
                      <td className="p-2.5 font-mono text-slate-600">{formatDatePT(r.data_vigencia)}</td>
                      <td className="p-2.5 text-right font-bold font-mono text-slate-800">{r.valor.toFixed(2)} €</td>
                      <td className="p-2.5 text-slate-500">{r.motivo || "—"}</td>
                      <td className="p-2.5 text-center">{r.aprovado_em_assembleia ? "✅" : "—"}</td>
                      <td className="p-2.5 text-center">
                        {r.id_revisao === revisaoEmVigor?.id_revisao ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold">Em Vigor</span>
                        ) : r.data_vigencia > new Date().toISOString().split("T")[0] ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold">Agendada</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold">Histórico</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right">
                        {loggedUser.role === "ADMIN" && (
                          <button onClick={() => handleRemoverRevisaoOrcamento(r)} className="text-slate-400 hover:text-red-500 cursor-pointer" title="Eliminar">
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {loggedUser.role === 'ADMIN' || loggedUser.role === 'EMPRESA_GESTORA' ? (
        <form onSubmit={gerarOrcamentoMensal} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 no-print">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <i className="fa-solid fa-calculator text-sm"></i>
            </span>
            <h3 className="text-sm font-bold text-slate-800">Calcular & Lançar Quotas Mensais ("Q" Docs)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Orçamento Geral Anual (€) *</label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={orcamentoAnual}
                onChange={e => setOrcamentoAnual(e.target.value)}
                placeholder="Ex: 5000"
                className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Mês de Emissão *</label>
              <select 
                value={mes} 
                onChange={e => setMes(e.target.value)} 
                className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white"
              >
                <option value="Janeiro">Janeiro</option>
                <option value="Fevereiro">Fevereiro</option>
                <option value="Março">Março</option>
                <option value="Abril">Abril</option>
                <option value="Maio">Maio</option>
                <option value="Junho">Junho</option>
                <option value="Julho">Julho</option>
                <option value="Agosto">Agosto</option>
                <option value="Setembro">Setembro</option>
                <option value="Outubro">Outubro</option>
                <option value="Novembro">Novembro</option>
                <option value="Dezembro">Dezembro</option>
              </select>
            </div>
          </div>
          <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors cursor-pointer flex items-center space-x-2">
            <i className="fa-solid fa-paper-plane"></i>
            <span>Emitir "Q" em Lote Proporcional</span>
          </button>
        </form>
      ) : null}

      {/* Lista de Documentos Q */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Avisos de Cobrança Emitidos ("Q" Documentos)</h4>
          <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full">
            Total: {predioAvisos.length} docs
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <th className="p-3">Doc ID</th>
                <th className="p-3">Fração</th>
                <th className="p-3">Data</th>
                <th className="p-3">Vencimento</th>
                <th className="p-3">Descrição do Aviso</th>
                <th className="p-3">Tipo</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-center no-print">Gerar Docs</th>
              </tr>
            </thead>
            <tbody>
              {predioAvisos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-400 italic">
                    Nenhum aviso emitido para este condomínio.
                  </td>
                </tr>
              ) : (
                predioAvisos.map(a => {
                  const frac = fracoes.find(f => f.id_fracao === a.id_fracao);
                  return (
                    <tr key={a.id_aviso} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="p-3 font-mono text-indigo-600 font-bold">{a.id_aviso.toUpperCase()}</td>
                      <td className="p-3 font-bold text-slate-800">
                        Fração {frac?.fracao_nome || "?"} ({frac?.piso || "N/A"})
                      </td>
                      <td className="p-3 font-mono">{formatDatePT(a.data)}</td>
                      <td className="p-3 font-mono">{formatDatePT(a.vencimento)}</td>
                      <td className="p-3 text-slate-600">{a.descricao}</td>
                      <td className="p-3">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                          a.tipo === 'Cota Ordinária' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : a.tipo.includes('Extra') 
                            ? 'bg-amber-50 text-amber-700 border-amber-100' 
                            : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                        }`}>
                          {a.tipo}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold font-mono">{a.valor.toFixed(2)}€</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          a.estado === 'Paga' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {a.estado}
                        </span>
                      </td>
                      <td className="p-3 text-center no-print">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => abrirDocumento(a, "NOTA_COBRANCA")}
                            title="Nota de Cobrança"
                            className="p-1 px-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 text-slate-600 rounded text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            <i className="fa-solid fa-file-invoice mr-1"></i> Nota
                          </button>
                          <button
                            onClick={() => abrirDocumento(a, "RECIBO")}
                            title="Emitir Recibo Oficial"
                            className="p-1 px-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 border border-slate-200 text-slate-600 rounded text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            <i className="fa-solid fa-receipt mr-1"></i> Recibo
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DOCUMENT GENERATOR MODAL */}
      {selectedAviso && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto no-print">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl w-full max-w-5xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row h-[90vh] max-h-[800px] overflow-hidden">
            
            {/* Left sidebar: Editor / Adjustments */}
            <div className="w-full md:w-80 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between overflow-y-auto shrink-0">
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Editor do Documento</h3>
                  <button 
                    onClick={fecharModal}
                    className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tipo de Documento</label>
                  <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-slate-100 dark:bg-slate-900 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setDocType("NOTA_COBRANCA")}
                      className={`py-1 text-[10px] font-bold rounded-md transition-all ${
                        docType === "NOTA_COBRANCA" 
                          ? "bg-indigo-600 text-white shadow" 
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Nota Cobrança
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocType("RECIBO")}
                      className={`py-1 text-[10px] font-bold rounded-md transition-all ${
                        docType === "RECIBO" 
                          ? "bg-emerald-600 text-white shadow" 
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Recibo Pago
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Condómino / Proprietário</label>
                  <input
                    type="text"
                    value={customCondomino}
                    onChange={e => setCustomCondomino(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2.5 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Descritivo Oficial</label>
                  <textarea
                    rows={2}
                    value={customDescritivo}
                    onChange={e => setCustomDescritivo(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs p-2.5 rounded-lg focus:outline-indigo-500 dark:text-white font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Quota Mensal (€)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={customQuotaMensal}
                      onChange={e => setCustomQuotaMensal(parseValorMonetario(e.target.value))}
                      className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Quota Extra (€)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={customQuotaExtra}
                      onChange={e => setCustomQuotaExtra(parseValorMonetario(e.target.value))}
                      className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">IBAN do Prédio</label>
                  <input
                    type="text"
                    value={customIban}
                    onChange={e => setCustomIban(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2.5 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white font-mono"
                  />
                </div>

                {docType === "RECIBO" ? (
                  <div className="grid grid-cols-1 gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Data de Liquidação</label>
                      <input
                        type="date"
                        value={customDataPagamento}
                        onChange={e => setCustomDataPagamento(e.target.value)}
                        className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nº Recibo</label>
                      <input
                        type="text"
                        value={customNrecibo}
                        onChange={e => setCustomNrecibo(e.target.value)}
                        className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2.5 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Data Limite de Pagamento</label>
                    <input
                      type="date"
                      value={customDataLimite}
                      onChange={e => setCustomDataLimite(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white"
                    />
                  </div>
                )}

                <div className="space-y-1 pt-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Estado do Aviso Global</label>
                  <div className="flex space-x-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedAviso.id_movimento && !confirm("Este aviso já tem um depósito real registado na Tesouraria. Marcar como Pendente NÃO apaga esse movimento nem o saldo já creditado — se foi um erro, corrija/elimine o movimento diretamente em Movimentos & Tesouraria. Continuar?")) {
                          return;
                        }
                        setARegistarPagamento(false);
                        alterarEstadoAviso(selectedAviso.id_aviso, "Pendente");
                      }}
                      className={`flex-1 py-1 text-[9px] font-extrabold rounded-md border ${
                        selectedAviso.estado === "Pendente"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-slate-50 border-slate-200 text-slate-400"
                      }`}
                    >
                      Marcar Pendente
                    </button>
                    <button
                      type="button"
                      disabled={selectedAviso.estado === "Paga"}
                      onClick={() => setARegistarPagamento(true)}
                      className={`flex-1 py-1 text-[9px] font-extrabold rounded-md border disabled:cursor-not-allowed ${
                        selectedAviso.estado === "Paga"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "bg-slate-50 border-slate-200 text-slate-400"
                      }`}
                    >
                      Marcar Pago
                    </button>
                  </div>
                  {selectedAviso.estado === "Paga" && selectedAviso.id_movimento && (
                    <p className="text-[9px] text-emerald-600 dark:text-emerald-400 pt-0.5">
                      <i className="fa-solid fa-check-circle mr-1"></i>Depósito registado na Tesouraria ({movements.find(m => m.id_mov === selectedAviso.id_movimento)?.categoria || "Movimento"})
                    </p>
                  )}

                  {aRegistarPagamento && (
                    <div className="mt-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-lg space-y-2">
                      <label className="text-[9px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">Conta Bancária de Entrada *</label>
                      <select
                        value={pagamentoContaId}
                        onChange={e => setPagamentoContaId(e.target.value)}
                        className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] px-2 py-1.5 rounded-lg focus:outline-emerald-500 dark:text-white"
                      >
                        <option value="">Selecione a conta...</option>
                        {predioContas.map(c => (
                          <option key={c.id_conta} value={c.id_conta}>{c.banco} ({c.tipo}) - Saldo: {c.saldo?.toFixed(2)}€</option>
                        ))}
                      </select>
                      <div className="flex space-x-1.5">
                        <button
                          type="button"
                          onClick={() => { setARegistarPagamento(false); setPagamentoContaId(""); }}
                          className="flex-1 py-1 text-[9px] font-extrabold rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarcarPagoComMovimento(selectedAviso, pagamentoContaId)}
                          className="flex-1 py-1 text-[9px] font-extrabold rounded-md border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Confirmar Recebimento
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                {docType === "RECIBO" && (
                  <button
                    type="button"
                    onClick={handleExportReceiptA5}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-md"
                  >
                    <i className="fa-solid fa-file-pdf"></i>
                    <span>Gerar Recibo Oficial (A5 Horizontal)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-slate-850 transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <i className="fa-solid fa-print"></i>
                  <span>Imprimir A4 / Exportar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={fecharModal}
                  className="w-full bg-slate-100 text-slate-600 font-bold py-2 rounded-xl text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Voltar à Lista
                </button>
              </div>
            </div>

            {/* Right side: Interactive A4 sheet preview */}
            <div className="flex-1 bg-slate-200 dark:bg-slate-900/40 p-4 md:p-8 overflow-y-auto flex justify-center items-start">
              <div 
                id="printable-document-container"
                className="bg-white text-slate-900 p-8 md:p-12 w-full max-w-[21cm] min-h-[29.7cm] shadow-xl rounded-xl border border-slate-300 relative text-xs leading-relaxed overflow-hidden"
                style={{ color: "#1A1A1A" }}
              >
                
                {/* 1. Official Watermark (centered behind content) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.10] pointer-events-none text-center select-none z-0">
                  <img src="/marca/19-marca-dagua-logo-cinza-claro.png" alt="Watermark" className="w-96 h-96 object-contain" />
                </div>

                <div className="relative z-10 space-y-6">
                  {/* 2. Cabeçalho Institucional (padrão oficial) */}
                  <div className="flex justify-between items-center border-b-2 border-[#1A1A1A] pb-4">
                    <div className="flex items-center space-x-3">
                      <img src="/marca/20-Logotipo Horizontal com fundo.png" alt="CondoManager AI" className="h-12 object-contain" />
                    </div>
                    
                    <div className="text-right font-sans text-[9px] text-slate-500 space-y-0.5 leading-tight">
                      <p className="font-extrabold uppercase text-[#1A1A1A]">CONDOMANAGER AI — ADMINISTRAÇÃO LEGAL</p>
                      <p>Avenida da República, Nº 1000, 1050-191 Lisboa</p>
                      <p className="font-mono">NIF: 512 345 678 • Registo Comercial de Lisboa</p>
                      <p>Email: suporte@condomanager.ai • Tel: +351 210 000 000</p>
                    </div>
                  </div>

                  {/* 3. Título do Documento */}
                  <div className="text-center py-2">
                    <h2 className="text-lg font-black uppercase tracking-widest border-b border-dashed border-slate-300 pb-1.5 inline-block min-w-[280px]">
                      {docType === "RECIBO" ? `RECIBO Nº ${customNrecibo}` : "AVISO DE DÉBITO / NOTA DE COBRANÇA"}
                    </h2>
                    <p className="text-[8px] text-slate-400 font-mono mt-1">CÓDIGO DIGITAL: {selectedAviso.id_aviso.toUpperCase()}-{Date.now().toString().slice(-4)}</p>
                  </div>

                  {/* 4. Identificação do Condómino */}
                  <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Destinatário da Fração</span>
                      <p className="text-[11px] font-black uppercase text-[#1A1A1A]">Exmo(a) Sr(a):</p>
                      <p className="text-xs font-bold text-slate-800">{customCondomino}</p>
                      <p className="text-[9px] text-slate-500 mt-1">
                        Fração Autónoma: <strong className="text-[#1A1A1A]">{fracoes.find(f => f.id_fracao === selectedAviso.id_fracao)?.fracao_nome || "?"}</strong> 
                        &nbsp;({fracoes.find(f => f.id_fracao === selectedAviso.id_fracao)?.piso || "N/A"})
                      </p>
                      <p className="text-[9px] text-slate-500">
                        Morada do Edifício: {predio?.morada_linha1 || ""}, {predio?.localidade || ""}
                      </p>
                    </div>
                    
                    <div className="text-right space-y-1">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dados de Emissão</span>
                      <p className="text-[9px] text-slate-600"><strong>Contribuinte NIF:</strong> {fracoes.find(f => f.id_fracao === selectedAviso.id_fracao)?.proprietario?.nif || "999999990"}</p>
                      <p className="text-[9px] text-slate-600"><strong>Data de Emissão:</strong> {formatDatePT(selectedAviso.data)}</p>
                      {docType === "RECIBO" ? (
                        <p className="text-[9px] text-slate-600"><strong>Data de Liquidação:</strong> <span className="font-bold text-emerald-600">{formatDatePT(customDataPagamento)}</span></p>
                      ) : (
                        <p className="text-[9px] text-slate-600"><strong>Limite de Pagamento:</strong> <span className="font-bold text-red-600">{formatDatePT(customDataLimite)}</span></p>
                      )}
                      <p className="text-[9px] text-slate-500"><strong>Permilagem Legal:</strong> {fracoes.find(f => f.id_fracao === selectedAviso.id_fracao)?.permilagem || 0}‰</p>
                    </div>
                  </div>

                  {/* 5. Texto Institucional / Corpo do Documento */}
                  <div className="text-justify text-[10px] text-slate-700 leading-relaxed">
                    {docType === "RECIBO" ? (
                      <p>
                        Vimos por este meio confirmar e emitir quitação oficial de que <strong>Recebemos de V. Ex.ª</strong>, na qualidade de titular responsável pela fração autónoma acima identificada, o respetivo pagamento do montante abaixo discriminado, para os devidos efeitos de regularização financeira de conta corrente de condomínio:
                      </p>
                    ) : (
                      <p>
                        Vimos por este meio informar que se encontram em pagamento as quotas de condomínio a seguir discriminadas perante o respetivo edifício, pelo que agradecemos que proceda ao respetivo pagamento voluntário por uma das seguintes vias disponibilizadas:
                      </p>
                    )}
                  </div>

                  {/* 6. Tabela Oficial (Layout Híbrido, linhas finas, cabeçalho limpo, texto #1A1A1A, alinhamento esq / val dir) */}
                  <div>
                    <table className="w-full text-left text-[10px] border-collapse">
                      <thead>
                        <tr className="border-b-2 border-[#1A1A1A]">
                          {docType === "RECIBO" ? (
                            <>
                              <th className="py-2 text-[#1A1A1A] font-bold uppercase tracking-wider">Documento / Código</th>
                              <th className="py-2 text-[#1A1A1A] font-bold uppercase tracking-wider">Emissão</th>
                              <th className="py-2 text-[#1A1A1A] font-bold uppercase tracking-wider">Vencimento</th>
                              <th className="py-2 text-[#1A1A1A] font-bold uppercase tracking-wider">Fração</th>
                              <th className="py-2 text-[#1A1A1A] font-bold uppercase tracking-wider">Descrição do Lançamento</th>
                              <th className="py-2 text-right text-[#1A1A1A] font-bold uppercase tracking-wider">Recebido (€)</th>
                            </>
                          ) : (
                            <>
                              <th className="py-2 text-[#1A1A1A] font-bold uppercase tracking-wider">Fração (Piso + Letra)</th>
                              <th className="py-2 text-[#1A1A1A] font-bold uppercase tracking-wider">Documento</th>
                              <th className="py-2 text-[#1A1A1A] font-bold uppercase tracking-wider">Descrição do Lançamento</th>
                              <th className="py-2 text-[#1A1A1A] font-bold uppercase tracking-wider">Emissão</th>
                              <th className="py-2 text-[#1A1A1A] font-bold uppercase tracking-wider">Vencimento</th>
                              <th className="py-2 text-right text-[#1A1A1A] font-bold uppercase tracking-wider">Valor (€)</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-200">
                          {docType === "RECIBO" ? (
                            <>
                              <td className="py-3 font-mono font-bold text-[#1A1A1A]">{customNrecibo}</td>
                              <td className="py-3 font-mono text-slate-600">{formatDatePT(selectedAviso.data)}</td>
                              <td className="py-3 font-mono text-slate-600">{formatDatePT(selectedAviso.vencimento)}</td>
                              <td className="py-3 font-bold text-slate-800">Fração {fracoes.find(f => f.id_fracao === selectedAviso.id_fracao)?.fracao_nome || "?"}</td>
                              <td className="py-3">
                                <span className="font-bold text-slate-800 block">{selectedAviso.tipo}</span>
                                <span className="text-slate-500 block text-[9px] mt-0.5">{customDescritivo}</span>
                              </td>
                              <td className="py-3 text-right font-mono font-bold text-[#1A1A1A]">
                                {(customQuotaMensal + customQuotaExtra).toFixed(2)} €
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 font-bold text-slate-800">
                                Fração {fracoes.find(f => f.id_fracao === selectedAviso.id_fracao)?.fracao_nome || "?"} ({fracoes.find(f => f.id_fracao === selectedAviso.id_fracao)?.piso || "N/A"})
                              </td>
                              <td className="py-3 font-mono font-bold text-indigo-700">AV-{selectedAviso.id_aviso.toUpperCase()}</td>
                              <td className="py-3">
                                <span className="font-bold text-slate-800 block">{selectedAviso.tipo}</span>
                                <span className="text-slate-500 block text-[9px] mt-0.5">{customDescritivo}</span>
                              </td>
                              <td className="py-3 font-mono text-slate-600">{formatDatePT(selectedAviso.data)}</td>
                              <td className="py-3 font-mono text-slate-600">{formatDatePT(customDataLimite)}</td>
                              <td className="py-3 text-right font-mono font-bold text-[#1A1A1A]">
                                {(customQuotaMensal + customQuotaExtra).toFixed(2)} €
                              </td>
                            </>
                          )}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 7. Bloco de Totais (Total em Débito ou Total Pago) */}
                  <div className="flex justify-end pt-2">
                    <div className="text-right border-t border-[#1A1A1A] pt-1.5 w-60">
                      <p className="text-[12px] font-black uppercase text-[#1A1A1A]">
                        {docType === "RECIBO" ? "Total Recebido:" : "Total em Débito:"} &nbsp;
                        <span className="font-mono text-[14px] text-indigo-700">{(customQuotaMensal + customQuotaExtra).toFixed(2)} €</span>
                      </p>
                    </div>
                  </div>

                  {/* 8. Nota Legal (IVA) */}
                  <div className="text-left py-1 text-[8.5px] text-slate-500 border-t border-dashed border-slate-200">
                    <p className="font-semibold">Nota Legal: Isento de IVA nos termos do art.º 9.º, nº 21 do Código do Imposto sobre o Valor Acrescentado (CIVA).</p>
                  </div>

                  {/* 9. Observação ao Condómino (se aplicável) */}
                  <div className="bg-amber-50/50 border border-amber-200/60 p-3 rounded-lg text-[9px] text-amber-900 leading-normal">
                    {docType === "RECIBO" ? (
                      <p><strong>Observação de Quitação:</strong> Este recibo oficial comprova a entrada de capitais na tesouraria do condomínio para quitação do débito acima citado, servindo de legítima prova de regularidade fiscal perante o edifício.</p>
                    ) : (
                      <p><strong>Observação ao Condómino:</strong> Caso algum dos valores acima indicados já tenha sido liquidado, agradecemos que nos faça chegar o respetivo comprovativo bancário por e-mail. Favor indicar o código de referência BR23E no descritivo da sua transferência.</p>
                    )}
                  </div>

                  {/* 10. Canais de Pagamento (se nota de cobrança) */}
                  {docType === "NOTA_COBRANCA" && (
                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">a) Transferência bancária para o IBAN:</span>
                        <span className="font-mono font-bold text-slate-800 text-[10px] block mt-0.5 select-all">{customIban}</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">b) Depósito ou Identificação BR23E (Perfil Bancário da Fração):</span>
                        <span className="font-mono font-bold text-emerald-800 text-[10px] block mt-0.5 select-all">{referenciaBR23EOficial}</span>
                      </div>
                    </div>
                  )}

                  {/* 11. Assinatura Digital (padrão oficial) */}
                  <div className="pt-6 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-center md:text-left space-y-1">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Validação Jurídica de Ativos</span>
                      <p className="text-[10px] font-extrabold text-[#1A1A1A] uppercase">A Administração do Condomínio</p>
                      <p className="text-[8px] text-slate-500 font-medium">CondoManager AI, Lda. • Assinatura Certificada</p>
                      <p className="text-[7.5px] text-emerald-600 uppercase font-black tracking-widest mt-1">✓ Assinatura Digital Ativa • Autoridade Digital de Lisboa</p>
                    </div>

                    <div className="flex items-center space-x-3.5 bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                      <div className="h-10 w-10 bg-white border border-slate-300 flex items-center justify-center font-black text-slate-800 text-[8px] p-1 select-none">
                        {/* Simulation of a real security verification QR Code */}
                        <div className="grid grid-cols-4 gap-0.5 w-full h-full">
                          {[...Array(16)].map((_, i) => (
                            <div key={i} className={`rounded-xs ${i % 3 === 0 || i % 7 === 0 ? "bg-[#1A1A1A]" : "bg-transparent"}`} />
                          ))}
                        </div>
                      </div>
                      <div className="leading-tight text-[8px] text-slate-500 font-mono">
                        <p className="font-bold text-[#1A1A1A]">SECURE VERIFY QR</p>
                        <p>Código: LEG-HASH-SHA256</p>
                        <p className="text-[7px] text-indigo-600 font-bold">✓ Documento Autêntico</p>
                      </div>
                    </div>
                  </div>

                  {/* 12. Rodapé Institucional (padrão oficial) */}
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-[7.5px] text-slate-400 font-mono leading-none">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold uppercase tracking-wider">CondoManager AI</span>
                      <span>— Gestão Inteligente de Condomínios</span>
                    </div>
                    <div className="text-right">
                      <span>Documento gerado automaticamente pelo sistema • Versão Oficial 3.2</span>
                    </div>
                  </div>

                </div>

              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
