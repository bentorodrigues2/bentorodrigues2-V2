import React, { useState, useMemo, useEffect } from "react";
import { jsPDF } from "jspdf";
import { Predio, Fracao, LoggedUser, Conta, Documento, Correspondencia, CorrespondenciaAnexo, Movimento, ProcessoJuridico } from "../types";
import {
  uploadDocumentoToStorage,
  saveDocumentoToSupabase,
  fetchCorrespondenciaFromSupabase,
  saveCorrespondenciaToSupabase,
  fetchProcessosJuridicosFromSupabase,
  saveContaToSupabase,
  saveMovimentoToSupabase,
  registarLogAuditoria
} from "../lib/supabaseService";
import { 
  formatDatePT, 
  addPdfHeaderWithLogo, 
  generateCondominoPwaManualPDF, 
  gerarPdfBoasVindasAdministrador, 
  gerarPdfBoasVindasGestor,
  gerarPdfRegistoFornecedorHomologado,
  gerarCartaoAniversarioCondominoPDF,
  downloadNotaCobrancaPDF,
  gerarConvocatoriaOficialPDF,
  gerarNotificacaoDividaPDF,
  gerarAtaAprovadaOficialPDF,
  gerarParticipacaoSinistroPDF,
  parseValorMonetario
} from "../utils";
import { BIRTHDAY_WATERMARK_BASE64 } from "../assets/birthdayWatermarkBase64";
import { 
  FileText, 
  Mail, 
  Download, 
  Send, 
  CheckCircle2, 
  Edit3, 
  Eye, 
  Copy, 
  Printer, 
  Sparkles, 
  Paperclip, 
  AlertTriangle, 
  Clock, 
  Building2, 
  FileCode, 
  Sliders, 
  ArrowRight,
  RefreshCw,
  FolderDown,
  ShieldCheck,
  Check,
  MessageSquare,
  Smartphone,
  Inbox,
  Reply,
  Euro,
  Link2,
  Loader2,
  Plus,
  X,
  Trash2,
  Scale
} from "lucide-react";
import { triggerSendReaction } from "./SendingReactionModal";

interface CentralDocumentosMinutasProps {
  predio: Predio;
  fracoes: Fracao[];
  loggedUser: LoggedUser;
  contas?: Conta[];
  setContas?: React.Dispatch<React.SetStateAction<Conta[]>>;
  setMovements?: React.Dispatch<React.SetStateAction<Movimento[]>>;
  onOpenArranque?: () => void;
  activeTab?: TabMode;
  onSelectTab?: (tab: TabMode) => void;
  documentos?: Documento[];
  setDocumentos?: React.Dispatch<React.SetStateAction<Documento[]>>;
}

// Nº de ata a partir do qual se dá continuidade ao histórico anterior (a
// gestão anterior já tinha emitido atas até este número) — a primeira ata
// emitida nesta plataforma fica com este valor.
const NUMERO_ATA_INICIAL = 29;

type TabMode = "minutas_oficiais" | "simulador_emails" | "gestao_correspondencia";

export function CentralDocumentosMinutas({
  predio,
  fracoes,
  loggedUser,
  contas = [],
  setContas,
  setMovements,
  onOpenArranque,
  activeTab: activeTabProp,
  onSelectTab,
  documentos = [],
  setDocumentos
}: CentralDocumentosMinutasProps) {
  const podeGerirCorrespondencia = loggedUser.role === "ADMIN" || loggedUser.role === "EMPRESA_GESTORA";
  const [internalTab, setInternalTab] = useState<TabMode>("minutas_oficiais");
  const activeTab = activeTabProp || internalTab;
  const setActiveTab = (tab: TabMode) => {
    setInternalTab(tab);
    if (onSelectTab) onSelectTab(tab);
  };
  const [selectedMinutaId, setSelectedMinutaId] = useState<string>("ata_assembleia");
  const [selectedEmailSimId, setSelectedEmailSimId] = useState<string>("comprovativo_pagamento");

  // Email test target
  const [testEmailRecipient, setTestEmailRecipient] = useState<string>("jcafguerra@hotmail.com");
  const [emailSentStatus, setEmailSentStatus] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // --- GESTÃO DE CORRESPONDÊNCIA CTT ---
  const [correspondencias, setCorrespondencias] = useState<Correspondencia[]>([]);
  const [processosJuridicos, setProcessosJuridicos] = useState<ProcessoJuridico[]>([]);
  const [aCarregarCorrespondencia, setACarregarCorrespondencia] = useState(false);
  const [filtroCorresp, setFiltroCorresp] = useState<"Todas" | "Enviada" | "Recebida">("Todas");
  const [modalCorrespAberto, setModalCorrespAberto] = useState<"nova_carta" | "registar_recebida" | null>(null);
  const [corresRespondendoA, setCorresRespondendoA] = useState<Correspondencia | null>(null);
  const [corresDetalheId, setCorresDetalheId] = useState<string | null>(null);

  // Nova Carta (redação livre, sem modelo pré-definido)
  const [cartaAssunto, setCartaAssunto] = useState("");
  const [cartaDestinatarioNome, setCartaDestinatarioNome] = useState("");
  const [cartaDestinatarioMorada, setCartaDestinatarioMorada] = useState("");
  const [cartaIdFracao, setCartaIdFracao] = useState("");
  const [cartaPontosChave, setCartaPontosChave] = useState("");
  const [cartaConteudo, setCartaConteudo] = useState("");
  const [cartaTipoEnvio, setCartaTipoEnvio] = useState<Correspondencia["tipo_envio"]>("Correio Registado");
  const [cartaIdProcesso, setCartaIdProcesso] = useState("");
  const [aGerarCartaIA, setAGerarCartaIA] = useState(false);
  const [aGuardarCarta, setAGuardarCarta] = useState(false);
  const [cartaFicheiroComprovativo, setCartaFicheiroComprovativo] = useState<File | null>(null);
  const [cartaLancarCusto, setCartaLancarCusto] = useState(false);
  const [cartaCustoValor, setCartaCustoValor] = useState("");
  const [cartaCustoContaId, setCartaCustoContaId] = useState(contas[0]?.id_conta || "");
  const [cartaCustoFatura, setCartaCustoFatura] = useState<File | null>(null);

  // Registar Correspondência Recebida
  const [recebidaAssunto, setRecebidaAssunto] = useState("");
  const [recebidaRemetente, setRecebidaRemetente] = useState("");
  const [recebidaIdFracao, setRecebidaIdFracao] = useState("");
  const [recebidaData, setRecebidaData] = useState(new Date().toISOString().split("T")[0]);
  const [recebidaFicheiro, setRecebidaFicheiro] = useState<File | null>(null);
  const [recebidaIdProcesso, setRecebidaIdProcesso] = useState("");
  const [aGuardarRecebida, setAGuardarRecebida] = useState(false);

  useEffect(() => {
    if (!podeGerirCorrespondencia || !predio?.id_predio) return;
    setACarregarCorrespondencia(true);
    Promise.all([
      fetchCorrespondenciaFromSupabase(predio.id_predio),
      fetchProcessosJuridicosFromSupabase(predio.id_predio)
    ]).then(([corresp, processos]) => {
      setCorrespondencias(corresp || []);
      setProcessosJuridicos(processos || []);
    }).finally(() => setACarregarCorrespondencia(false));
  }, [predio?.id_predio, podeGerirCorrespondencia]);

  const resetFormNovaCarta = () => {
    setCartaAssunto("");
    setCartaDestinatarioNome("");
    setCartaDestinatarioMorada("");
    setCartaIdFracao("");
    setCartaPontosChave("");
    setCartaConteudo("");
    setCartaTipoEnvio("Correio Registado");
    setCartaIdProcesso("");
    setCartaFicheiroComprovativo(null);
    setCartaLancarCusto(false);
    setCartaCustoValor("");
    setCartaCustoFatura(null);
    setCorresRespondendoA(null);
  };

  const handleAbrirNovaCarta = (respondendoA?: Correspondencia) => {
    resetFormNovaCarta();
    if (respondendoA) {
      setCorresRespondendoA(respondendoA);
      setCartaAssunto(`Resposta: ${respondendoA.assunto}`);
      setCartaDestinatarioNome(respondendoA.remetente_nome || "");
      setCartaIdFracao(respondendoA.id_fracao || "");
      setCartaIdProcesso(respondendoA.id_processo_juridico || "");
    }
    setModalCorrespAberto("nova_carta");
  };

  const handleGerarCartaIA = async () => {
    if (!cartaAssunto.trim() || !cartaPontosChave.trim()) {
      alert("Indique o assunto e os pontos-chave da carta para a IA a poder redigir.");
      return;
    }
    setAGerarCartaIA(true);
    try {
      const resp = await fetch("/api/ai?acao=redigir-carta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assunto: cartaAssunto,
          destinatarioNome: cartaDestinatarioNome,
          pontosChave: cartaPontosChave,
          predio: { nome: predio.nome, nif: predio.nif, morada_linha1: predio.morada_linha1 }
        })
      });
      const resultado = await resp.json();
      if (!resp.ok || !resultado.success) throw new Error(resultado?.error || "Falha ao redigir a carta com IA");
      setCartaConteudo(resultado.text);
    } catch (e: any) {
      alert("Erro ao redigir carta com IA: " + e.message);
    } finally {
      setAGerarCartaIA(false);
    }
  };

  const handleGuardarCarta = async (estadoFinal: "Rascunho" | "Enviada") => {
    if (!cartaAssunto.trim() || !cartaConteudo.trim()) {
      alert("Preencha o assunto e o conteúdo da carta (redija manualmente ou use a IA).");
      return;
    }
    if (cartaLancarCusto && (!cartaCustoValor || parseValorMonetario(cartaCustoValor) <= 0 || !cartaCustoContaId)) {
      alert("Indique o valor do custo e a conta bancária a debitar.");
      return;
    }
    setAGuardarCarta(true);
    try {
      const idCorresp = "corresp-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
      const anexos: CorrespondenciaAnexo[] = [];

      if (cartaFicheiroComprovativo) {
        const url = await uploadDocumentoToStorage(cartaFicheiroComprovativo, `correspondencia/${predio.id_predio}/${idCorresp}_comprovativo_${cartaFicheiroComprovativo.name}`);
        if (url) {
          anexos.push({ id_anexo: "anx-" + Date.now(), tipo: "comprovativo_envio", nome: cartaFicheiroComprovativo.name, url, data_upload: new Date().toISOString() });
        }
      }

      let idMovimentoGerado: string | undefined;
      let valorCusto: number | undefined;

      if (cartaLancarCusto) {
        valorCusto = parseValorMonetario(cartaCustoValor);
        if (cartaCustoFatura) {
          const urlFatura = await uploadDocumentoToStorage(cartaCustoFatura, `correspondencia/${predio.id_predio}/${idCorresp}_fatura_${cartaCustoFatura.name}`);
          if (urlFatura) {
            anexos.push({ id_anexo: "anx-" + Date.now() + 1, tipo: "fatura", nome: cartaCustoFatura.name, url: urlFatura, data_upload: new Date().toISOString() });
          }
        }
        const novoMov: Movimento = {
          id_mov: "mov-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
          id_predio: predio.id_predio,
          id_conta: cartaCustoContaId,
          data: new Date().toISOString().split("T")[0],
          tipo: "Despesa",
          valor: valorCusto,
          descricao: `Correspondência CTT: ${cartaAssunto} (${cartaDestinatarioNome || "Destinatário"})`,
          categoria: "Correspondência / Correio",
          fotos: [],
          estado: "Justificado",
          is_movimento_cego: false
        };
        idMovimentoGerado = novoMov.id_mov;

        const contaAlvo = contas.find(c => c.id_conta === cartaCustoContaId);
        if (contaAlvo) {
          const contaAtualizada = { ...contaAlvo, saldo: (contaAlvo.saldo || 0) - valorCusto };
          if (setContas) setContas(prev => prev.map(c => c.id_conta === contaAtualizada.id_conta ? contaAtualizada : c));
          saveContaToSupabase(contaAtualizada).catch(console.error);
        }
        if (setMovements) setMovements(prev => [novoMov, ...prev]);
        saveMovimentoToSupabase(novoMov).catch(console.error);
      }

      const novaCorresp: Correspondencia = {
        id_corresp: idCorresp,
        id_predio: predio.id_predio,
        direcao: "Enviada",
        assunto: cartaAssunto,
        conteudo: cartaConteudo,
        destinatario_nome: cartaDestinatarioNome || undefined,
        destinatario_morada: cartaDestinatarioMorada || undefined,
        id_fracao: cartaIdFracao || undefined,
        tipo_envio: cartaTipoEnvio,
        estado: estadoFinal,
        data_criacao: new Date().toISOString(),
        data_envio: estadoFinal === "Enviada" ? new Date().toISOString().split("T")[0] : undefined,
        anexos,
        id_processo_juridico: cartaIdProcesso || undefined,
        custo: valorCusto,
        id_movimento: idMovimentoGerado,
        autor: loggedUser.nome
      };

      const ok = await saveCorrespondenciaToSupabase(novaCorresp);
      if (!ok) throw new Error("Falha ao guardar a correspondência na base de dados.");

      setCorrespondencias(prev => [novaCorresp, ...prev]);

      // Se esta carta é resposta a uma correspondência recebida, marcá-la como Respondida
      if (corresRespondendoA) {
        const original = { ...corresRespondendoA, estado: "Respondida" as const, resposta_texto: cartaConteudo, data_resposta: new Date().toISOString().split("T")[0] };
        saveCorrespondenciaToSupabase(original).catch(console.error);
        setCorrespondencias(prev => prev.map(c => c.id_corresp === original.id_corresp ? original : c));
      }

      registarLogAuditoria("Correspondência", `${estadoFinal === "Enviada" ? "Enviou" : "Criou rascunho de"} carta: ${cartaAssunto}`, predio.id_predio, loggedUser, cartaDestinatarioNome);
      triggerSendReaction("email", estadoFinal === "Enviada" ? "Carta registada como enviada com sucesso!" : "Rascunho da carta guardado com sucesso!");
      setModalCorrespAberto(null);
      resetFormNovaCarta();
    } catch (e: any) {
      alert("Erro ao guardar a correspondência: " + e.message);
    } finally {
      setAGuardarCarta(false);
    }
  };

  const handleRegistarRecebida = async () => {
    if (!recebidaAssunto.trim() || !recebidaRemetente.trim() || !recebidaFicheiro) {
      alert("Preencha o assunto, o remetente e anexe o documento recebido.");
      return;
    }
    setAGuardarRecebida(true);
    try {
      const idCorresp = "corresp-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
      const url = await uploadDocumentoToStorage(recebidaFicheiro, `correspondencia/${predio.id_predio}/${idCorresp}_recebido_${recebidaFicheiro.name}`);
      if (!url) throw new Error("Falha ao carregar o documento anexado.");

      const anexos: CorrespondenciaAnexo[] = [{ id_anexo: "anx-" + Date.now(), tipo: "documento_recebido", nome: recebidaFicheiro.name, url, data_upload: new Date().toISOString() }];

      const novaCorresp: Correspondencia = {
        id_corresp: idCorresp,
        id_predio: predio.id_predio,
        direcao: "Recebida",
        assunto: recebidaAssunto,
        conteudo: "",
        remetente_nome: recebidaRemetente,
        id_fracao: recebidaIdFracao || undefined,
        estado: "Recebida",
        data_criacao: new Date().toISOString(),
        data_entrega: recebidaData,
        anexos,
        id_processo_juridico: recebidaIdProcesso || undefined,
        autor: loggedUser.nome
      };

      const ok = await saveCorrespondenciaToSupabase(novaCorresp);
      if (!ok) throw new Error("Falha ao guardar a correspondência na base de dados.");

      setCorrespondencias(prev => [novaCorresp, ...prev]);
      registarLogAuditoria("Correspondência", `Registou correspondência recebida: ${recebidaAssunto}`, predio.id_predio, loggedUser, recebidaRemetente);
      triggerSendReaction("email", "Correspondência recebida registada com sucesso!");
      setModalCorrespAberto(null);
      setRecebidaAssunto("");
      setRecebidaRemetente("");
      setRecebidaIdFracao("");
      setRecebidaFicheiro(null);
      setRecebidaIdProcesso("");
    } catch (e: any) {
      alert("Erro ao registar correspondência recebida: " + e.message);
    } finally {
      setAGuardarRecebida(false);
    }
  };

  const handleMarcarComoEntregue = async (corresp: Correspondencia) => {
    const atualizada = { ...corresp, estado: "Entregue" as const, data_entrega: new Date().toISOString().split("T")[0] };
    setCorrespondencias(prev => prev.map(c => c.id_corresp === corresp.id_corresp ? atualizada : c));
    await saveCorrespondenciaToSupabase(atualizada);
  };

  const handleMarcarComoDevolvida = async (corresp: Correspondencia) => {
    const atualizada = { ...corresp, estado: "Devolvida" as const };
    setCorrespondencias(prev => prev.map(c => c.id_corresp === corresp.id_corresp ? atualizada : c));
    await saveCorrespondenciaToSupabase(atualizada);
  };

  const correspondenciasFiltradas = useMemo(() => {
    if (filtroCorresp === "Todas") return correspondencias;
    return correspondencias.filter(c => c.direcao === filtroCorresp);
  }, [correspondencias, filtroCorresp]);

  const ESTADO_CORES: Record<string, string> = {
    "Rascunho": "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700",
    "Enviada": "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
    "Entregue": "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
    "Devolvida": "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
    "Recebida": "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
    "Respondida": "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700"
  };

  // --- MINUTAS STATE (EDITÁVEIS) ---
  // 1. ATA
  const [ataNumero, setAtaNumero] = useState<string>("42");
  const [ataTipo, setAtaTipo] = useState<string>("Assembleia Geral Ordinária");
  const [ataData, setAtaData] = useState<string>("2026-09-15");
  const [ataHora1, setAtaHora1] = useState<string>("20:30");
  const [ataHora2, setAtaHora2] = useState<string>("21:00");
  const [ataLocal, setAtaLocal] = useState<string>("Sala de Condomínio / Videoconferência");
  const [ataQuorum, setAtaQuorum] = useState<string>("780"); // permilagem
  const [ataOrdemTrabalhos, setAtaOrdemTrabalhos] = useState<string>(
    "Ponto Um: Apresentação, discussão e votação das contas do exercício anterior.\n" +
    "Ponto Dois: Apresentação, discussão e aprovação do orçamento previsional para o ano corrente e quotas.\n" +
    "Ponto Três: Obras de manutenção e impermeabilização do terraço comum.\n" +
    "Ponto Quatro: Eleição da Administração do Condomínio."
  );
  const [ataDeliberacoes, setAtaDeliberacoes] = useState<string>(
    "Ponto Um: As contas do exercício foram aprovadas por unanimidade dos presentes.\n" +
    "Ponto Dois: Foi aprovado o orçamento ordinário de 14.500,00€ e quota extraordinária de fundo de reserva.\n" +
    "Ponto Três: Deliberou-se adjudicar a reparação do terraço à empresa 'TecnoObras Lda' pelo valor de 3.200,00€.\n" +
    "Ponto Quatro: Foi reeleita a atual Administração com plenos poderes de gestão."
  );

  // 2. AVISO DE COBRANÇA
  const [avisoFracao, setAvisoFracao] = useState<string>(fracoes[0]?.fracao_nome || "Fração A - 1.º Dto");
  const [avisoProprietario, setAvisoProprietario] = useState<string>(fracoes[0]?.proprietario.nome || "José Carlos Guerra");
  const [avisoMesAno, setAvisoMesAno] = useState<string>("Setembro de 2026");
  const [avisoQuotaOrdinaria, setAvisoQuotaOrdinaria] = useState<string>("45.00");
  const [avisoFundoReserva, setAvisoFundoReserva] = useState<string>("4.50");
  const [avisoQuotaExtra, setAvisoQuotaExtra] = useState<string>("0.00");
  const [avisoDataLimite, setAvisoDataLimite] = useState<string>("2026-09-08");
  const [avisoIban, setAvisoIban] = useState<string>(predio.iban || "PT50 0033 0000 1234 5678 9012 3");
  const [avisoEntidade, setAvisoEntidade] = useState<string>("21234");
  const [avisoReferencia, setAvisoReferencia] = useState<string>("987 654 321");

  // 3. CARTA DE INTERPELAÇÃO DE DÍVIDA
  const [dividaFracao, setDividaFracao] = useState<string>(fracoes[1]?.fracao_nome || "Fração B - 2.º Esq");
  const [dividaProprietario, setDividaProprietario] = useState<string>(fracoes[1]?.proprietario.nome || "António Silva");
  const [dividaMorada, setDividaMorada] = useState<string>("Rua das Flores, N.º 12, 1000-001 Lisboa");
  const [dividaValorTotal, setDividaValorTotal] = useState<string>("247.50");
  const [dividaPeriodos, setDividaPeriodos] = useState<string>("Quotas Ordinárias de Maio, Junho, Julho e Agosto de 2026");
  const [dividaPrazoDias, setDividaPrazoDias] = useState<string>("15");

  // 4. BALANCETE FINANCEIRO
  const [balanceteExercicio, setBalanceteExercicio] = useState<string>("Exercício 2026 (Janeiro a Agosto)");
  const [balanceteTotalReceitas, setBalanceteTotalReceitas] = useState<string>("11.450,00");
  const [balanceteTotalDespesas, setBalanceteTotalDespesas] = useState<string>("8.920,00");
  const [balanceteSaldoOrdem, setBalanceteSaldoOrdem] = useState<string>("2.530,00");
  const [balanceteSaldoReserva, setBalanceteSaldoReserva] = useState<string>("6.850,00");

  // 5. AUTO DE VISTORIA TÉCNICA
  const [vistoriaNumero, setVistoriaNumero] = useState<string>("VIS-2026-09");
  const [vistoriaData, setVistoriaData] = useState<string>("2026-08-28");
  const [vistoriaArea, setVistoriaArea] = useState<string>("Casa das Máquinas do Elevador e Cobertura");
  const [vistoriaTecnico, setVistoriaTecnico] = useState<string>("Eng. Manuel Oliveira (Inspeção Técnica)");
  const [vistoriaAnomalias, setVistoriaAnomalias] = useState<string>(
    "- Detetado ligeiro desgaste nos cabos de tração do Elevador B.\n" +
    "- Grelha de ventilação desobstruída.\n" +
    "- Impermeabilização da caleira norte com sinais de infiltração pontual."
  );
  const [vistoriaRecomendacoes, setVistoriaRecomendacoes] = useState<string>(
    "1. Agendar substituição preventiva de cabos antes da inspeção periódica DGEG.\n" +
    "2. Aplicação de tela betuminosa líquida na caleira norte na próxima semana."
  );

  // --- GERADOR DE PDF ---
  const handleExportarPDFMinuta = () => {
    try {
      const doc = new jsPDF();
      let y = addPdfHeaderWithLogo(doc, predio.nome);

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");

      if (selectedMinutaId === "ata_assembleia") {
        doc.text(`ATA N.º ${ataNumero} - ${ataTipo.toUpperCase()}`, 14, y);
        y += 8;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Edifício: ${predio.nome || "Condomínio"} | NIF: ${predio.nif}`, 14, y);
        y += 6;
        doc.text(`Data: ${ataData} | 1.ª Conv.: ${ataHora1}h | 2.ª Conv.: ${ataHora2}h`, 14, y);
        y += 6;
        doc.text(`Local: ${ataLocal} | Quórum Representado: ${ataQuorum} ‰`, 14, y);
        y += 10;

        doc.setFont("helvetica", "bold");
        doc.text("ORDEM DE TRABALHOS:", 14, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        const linesOT = doc.splitTextToSize(ataOrdemTrabalhos, 180);
        doc.text(linesOT, 14, y);
        y += linesOT.length * 5 + 6;

        doc.setFont("helvetica", "bold");
        doc.text("DELIBERAÇÕES E DECISÕES TOMADAS:", 14, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        const linesDelib = doc.splitTextToSize(ataDeliberacoes, 180);
        doc.text(linesDelib, 14, y);
        y += linesDelib.length * 5 + 12;

        doc.text("A presente ata foi lida, aprovada e vai ser assinada pela Mesa da Assembleia.", 14, y);
        y += 16;
        doc.text("O Presidente da Mesa: _______________________", 14, y);
        doc.text("O Secretário / Administrador: _______________________", 110, y);
      } 
      else if (selectedMinutaId === "aviso_cobranca") {
        doc.text(`NOTA DE COBRANÇA DE QUOTA - ${avisoMesAno.toUpperCase()}`, 14, y);
        y += 8;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Destinatário: ${avisoProprietario}`, 14, y);
        y += 6;
        doc.text(`Fração: ${avisoFracao} | Prédio: ${predio.nome || "Condomínio"}`, 14, y);
        y += 10;

        doc.setFont("helvetica", "bold");
        doc.text("DISCRIMINAÇÃO DE VALORES:", 14, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.text(`- Quota Ordinária: ${avisoQuotaOrdinaria} €`, 14, y); y += 5;
        doc.text(`- Fundo Comum de Reserva: ${avisoFundoReserva} €`, 14, y); y += 5;
        if (parseValorMonetario(avisoQuotaExtra) > 0) {
          doc.text(`- Quota Extraordinária: ${avisoQuotaExtra} €`, 14, y); y += 5;
        }
        const total = (parseValorMonetario(avisoQuotaOrdinaria) + parseValorMonetario(avisoFundoReserva) + parseValorMonetario(avisoQuotaExtra)).toFixed(2);
        doc.setFont("helvetica", "bold");
        doc.text(`TOTAL A PAGAR: ${total} €`, 14, y); y += 10;

        doc.setFont("helvetica", "normal");
        doc.text(`Data Limite de Pagamento: ${avisoDataLimite}`, 14, y); y += 6;
        doc.text(`IBAN para Transferência: ${avisoIban}`, 14, y); y += 6;
        doc.text(`Dados Multibanco (Opcional): Entidade: ${avisoEntidade} | Referência: ${avisoReferencia}`, 14, y); y += 12;
        doc.text("Por favor envie o comprovativo para o email do condomínio para emissão do recibo.", 14, y);
      }
      else if (selectedMinutaId === "carta_divida") {
        doc.text("NOTIFICAÇÃO FORMAL DE DÍVIDA E CONSTITUIÇÃO EM MORA", 14, y);
        y += 8;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Para: ${dividaProprietario}`, 14, y); y += 5;
        doc.text(`Morada: ${dividaMorada}`, 14, y); y += 5;
        doc.text(`Referência: Fração ${dividaFracao} | Valor em Dívida: ${dividaValorTotal} €`, 14, y); y += 10;

        doc.setFont("helvetica", "bold");
        doc.text("EXMO.(A) CONDÓMINO(A),", 14, y); y += 6;
        doc.setFont("helvetica", "normal");
        const corpoDivida = `Vimos por este meio solicitar a regularização do montante de ${dividaValorTotal} €, relativo a ${dividaPeriodos}.\n\nNos termos do Artigo 1424.º-B do Código Civil e Decreto-Lei n.º 268/94, solicita-se o pagamento no prazo impreterível de ${dividaPrazoDias} dias a contar da receção desta missiva.\n\nMais se informa que as atas com deliberação de quotas têm força de título executivo nos termos da lei.`;
        const linesD = doc.splitTextToSize(corpoDivida, 180);
        doc.text(linesD, 14, y); y += linesD.length * 5 + 14;
        doc.text("Com os melhores cumprimentos,\nA Administração do Condomínio", 14, y);
      }
      else if (selectedMinutaId === "balancete_financeiro") {
        doc.text(`BALANCETE FINANCEIRO & MAPA ORÇAMENTAL`, 14, y);
        y += 8;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Período: ${balanceteExercicio}`, 14, y); y += 6;
        doc.text(`Edifício: ${predio.nome || "Condomínio"} | NIF: ${predio.nif}`, 14, y); y += 10;

        doc.setFont("helvetica", "bold");
        doc.text("RESUMO DE TESOURARIA:", 14, y); y += 6;
        doc.setFont("helvetica", "normal");
        doc.text(`- Total de Receitas Cobradas: ${balanceteTotalReceitas} €`, 14, y); y += 5;
        doc.text(`- Total de Despesas Liquidadas: ${balanceteTotalDespesas} €`, 14, y); y += 5;
        doc.text(`- Saldo em Conta à Ordem: ${balanceteSaldoOrdem} €`, 14, y); y += 5;
        doc.text(`- Saldo em Conta Poupança / Fundo de Reserva: ${balanceteSaldoReserva} €`, 14, y); y += 10;
        doc.text("Documento validado pela Administração e sujeito a verificação pelos condóminos.", 14, y);
      }
      else if (selectedMinutaId === "auto_vistoria") {
        doc.text(`AUTO DE VISTORIA TÉCNICA - N.º ${vistoriaNumero}`, 14, y);
        y += 8;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Data da Vistoria: ${vistoriaData} | Técnico: ${vistoriaTecnico}`, 14, y); y += 6;
        doc.text(`Área / Instalação Inspecionada: ${vistoriaArea}`, 14, y); y += 10;

        doc.setFont("helvetica", "bold");
        doc.text("ANOMALIAS / OBSERVAÇÕES DETETADAS:", 14, y); y += 6;
        doc.setFont("helvetica", "normal");
        const linesAnom = doc.splitTextToSize(vistoriaAnomalias, 180);
        doc.text(linesAnom, 14, y); y += linesAnom.length * 5 + 6;

        doc.setFont("helvetica", "bold");
        doc.text("RECOMENDAÇÕES & AÇÕES CORRETIVAS:", 14, y); y += 6;
        doc.setFont("helvetica", "normal");
        const linesRec = doc.splitTextToSize(vistoriaRecomendacoes, 180);
        doc.text(linesRec, 14, y); y += linesRec.length * 5 + 12;

        doc.text("O Técnico Responsável: _______________________", 14, y);
      }

      doc.save(`Minuta_${selectedMinutaId}_${predio.nif}.pdf`);
      triggerSendReaction("email", "PDF Editável descarregado com sucesso!");
    } catch (e: any) {
      alert("Erro ao exportar PDF: " + e.message);
    }
  };

  // --- DISPARAR EMAIL OFICIAL ---
  // Este catálogo mostra o texto exato de cada modelo (corpoTexto, já com
  // De/Para/Assunto/saudação/assinatura) — o botão "Enviar" passa a
  // despachar mesmo esse texto para o endereço de teste via Resend
  // (/api/email?acao=enviar-preview), em vez de só animar um "enviado com
  // sucesso" sem nada por trás.
  const handleDispararEmailSimulado = (tipo: string, assunto: string, corpoTexto: string) => {
    if (!testEmailRecipient || !testEmailRecipient.includes("@")) {
      alert("Indique um endereço de email de teste válido.");
      return;
    }
    triggerSendReaction("email", `A enviar e-mail oficial "${tipo}" para ${testEmailRecipient}...`, async () => {
      const resp = await fetch("/api/email?acao=enviar-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmailRecipient, subject: assunto, texto: corpoTexto })
      });
      const resultado = await resp.json();
      if (!resp.ok || !resultado.ok) throw new Error(resultado?.error || "Falha ao enviar o email de teste");
      setEmailSentStatus(`"${tipo}" enviado a sério para ${testEmailRecipient} em ${new Date().toLocaleTimeString()}`);
    });
  };

  // --- DESCARREGAR ANEXO DO E-MAIL SIMULADO ---
  const handleDescarregarAnexoEmail = async (emailId: string) => {
    try {
      if (emailId === "boas_vindas_condomino") {
        generateCondominoPwaManualPDF(
          fracoes[0]?.proprietario?.nome || "Condómino",
          predio.nome || "Condomínio Edifício Estrela da Barra"
        );
        triggerSendReaction("email", "Manual do Condómino (PDF) descarregado com sucesso!");
      } else if (emailId === "boas_vindas_administrador") {
        gerarPdfBoasVindasAdministrador(
          {
            nome: loggedUser.nome || "Administrador do Condomínio",
            email: testEmailRecipient.includes("@") ? testEmailRecipient : "administracao@condomanagerai.com",
            perfil: "ADMIN",
            tlm: "+351 919 943 465"
          },
          [predio],
          "Condomínio Edifício Estrela da Barra"
        );
        triggerSendReaction("email", "Manual & Credencial de Administrador (PDF) descarregado com sucesso!");
      } else if (emailId === "boas_vindas_gestor") {
        gerarPdfBoasVindasGestor(
          {
            nome: "Gestor de Portfólio / Operacional",
            email: testEmailRecipient.includes("@") ? testEmailRecipient : "gestor@condomanagerai.com",
            perfil: "GESTOR",
            tlm: "+351 919 943 465"
          },
          [predio],
          "Condomínio Edifício Estrela da Barra"
        );
        triggerSendReaction("email", "Manual & Credencial de Gestor (PDF) descarregado com sucesso!");
      } else if (emailId === "boas_vindas_fornecedor") {
        gerarPdfRegistoFornecedorHomologado(
          {
            nome: "Fornecedor / Prestador de Serviços",
            email_contacto: testEmailRecipient.includes("@") ? testEmailRecipient : "fornecedor@empresa.pt"
          },
          predio
        );
        triggerSendReaction("email", "Instruções & Credencial de Fornecedor (PDF) descarregado com sucesso!");
      } else if (emailId === "aniversario_condomino") {
        gerarCartaoAniversarioCondominoPDF(
          "Ana Silva",
          predio.nome || "Condomínio Edifício Estrela da Barra",
          "José Carlos Guerra"
        );
        triggerSendReaction("email", "Cartão Postal de Aniversário (PDF) descarregado com sucesso!");
      } else if (emailId === "convocatoria_assembleia") {
        gerarConvocatoriaOficialPDF(
          predio,
          {
            id_reuniao: "temp-convocatoria-email-9",
            id_predio: predio.id_predio,
            tema: "Assembleia Geral Ordinária de Condóminos",
            data: "15/09/2026",
            hora: "20:30",
            local_reuniao: "Sala de Condomínio / Ligação Zoom",
            ordens_trabalho: "1. Apresentação e votação do Relatório de Contas do exercício transato.\n2. Discussão e aprovação do Orçamento Previsional e Quotas para 2026/2027.\n3. Plano de Manutenção e Conservação de Áreas Comuns.\n4. Eleição / Renovação da Administração.",
            estado: "Agendada",
            isVideoconferencia: true,
            plataformaVideoconferencia: "Zoom / Ligação Online",
            linkVideoconferencia: "https://bentorodrigues2.condomanagerai.com"
          },
          fracoes,
          loggedUser?.nome || "José Carlos Guerra"
        );
        triggerSendReaction("email", "Convocatória Oficial em PDF (Layout & Imagem CondoManager AI) descarregada com sucesso!");
      } else if (emailId === "aviso_cobranca" || emailId === "lembrete_dia05") {
        downloadNotaCobrancaPDF({
          reciboNum: "NC-2026/09-FRA-A",
          dataEmissao: "25/08/2026",
          dataLimite: "08/09/2026",
          buildingName: predio?.nome || "Condomínio Edifício Estrela da Barra",
          buildingAddress: predio?.morada_linha1 || "Rua Bento Rodrigues, 2",
          buildingNif: predio?.nif || "900123456",
          buildingEmail: "edificio.estrela@condomanager.pt",
          buildingIban: "PT50 0035 0123 4567 8901 2344 5",
          proprietarioNome: "Ana Silva",
          proprietarioNif: fracoes[0]?.proprietario?.nif || "221230475",
          fracaoIdent: "Fração A",
          referenciaFracao: (fracoes[0] as any)?.referencia_pagamento || "BR2-FRA-A",
          quotaMensalVal: 45.00,
          fundoReservaVal: 4.50,
          descricaoQuota: "Quota Ordinária de Setembro de 2026",
          tipoDocumento: "NOTA_COBRANCA"
        }, "Aviso_Cobranca_Setembro_2026_Fracao_A.pdf");
        triggerSendReaction("email", "Aviso de Cobrança em PDF (Layout Oficial CondoManager AI) descarregado com sucesso!");
      } else if (emailId === "carta_interpelacao_divida") {
        gerarNotificacaoDividaPDF(
          "Carlos Administrador",
          "Fração B",
          "247,50",
          predio.nome || "Condomínio Edifício Estrela da Barra",
          predio.nif || "900 123 456",
          "PT50 0035 0123 4567 8901 2344 5"
        );
        triggerSendReaction("email", "Notificação Formal de Dívida (PDF com Título Executivo) descarregada com sucesso!");
      } else if (emailId === "envio_ata_aprovada") {
        // Numeração real e persistida: conta quantas atas já foram geradas e
        // arquivadas para este prédio (categoria "Ata Aprovada" no Arquivo
        // Digital) e continua a partir de NUMERO_ATA_INICIAL — antes o
        // número "42"/"30" estava sempre fixo no código, nunca avançava.
        const atasJaArquivadas = documentos.filter(d => d.id_predio === predio.id_predio && d.categoria === "Ata Aprovada").length;
        const numeroAtaReal = String(NUMERO_ATA_INICIAL + atasJaArquivadas + 1);
        const dataHojePT = new Date().toLocaleDateString("pt-PT");

        const doc = gerarAtaAprovadaOficialPDF(
          numeroAtaReal,
          dataHojePT,
          predio.nome || "Condomínio Edifício Estrela da Barra",
          predio.nif || "900 123 456",
          true // devolverDoc — trata-se aqui o descarregar/arquivar em vez da função descarregar sozinha
        );

        if (doc && typeof doc !== "boolean") {
          const pdfBlob = doc.output("blob");
          const nomeFicheiro = `ata_n${numeroAtaReal}_${predio.id_predio}.pdf`;

          // Descarrega já para o utilizador ver, independentemente de o
          // arquivo (Supabase) ter sucesso ou não.
          const link = document.createElement("a");
          link.href = URL.createObjectURL(pdfBlob);
          link.download = nomeFicheiro;
          link.click();
          URL.revokeObjectURL(link.href);

          // Arquiva no Arquivo Digital — é esta gravação que faz o próximo
          // número avançar sozinho, tal como as notas de cobrança já fazem.
          try {
            const ficheiro = new File([pdfBlob], nomeFicheiro, { type: "application/pdf" });
            const caminhoStorage = `${predio.id_predio}/atas/${nomeFicheiro}`;
            const urlArquivado = await uploadDocumentoToStorage(ficheiro, caminhoStorage);
            if (urlArquivado) {
              const novoDoc: Documento = {
                id_doc: `doc-ata-${Date.now()}`,
                id_predio: predio.id_predio,
                nome: `Ata N.º ${numeroAtaReal} Aprovada`,
                tipo: "PDF",
                data_upload: new Date().toISOString().split("T")[0],
                tamanho: `${Math.round(pdfBlob.size / 1024)} KB`,
                categoria: "Ata Aprovada",
                tema: "Atas de Assembleia",
                ano: String(new Date().getFullYear()),
                visibilidade: "Público",
                autor: loggedUser?.nome || "Administração do Condomínio",
                caminho: caminhoStorage
              };
              const okArquivo = await saveDocumentoToSupabase(novoDoc);
              if (okArquivo && setDocumentos) {
                setDocumentos(prev => [novoDoc, ...prev]);
              }
            }
          } catch (errArquivo) {
            console.warn("[CentralDocumentosMinutas] Aviso ao arquivar a ata:", errArquivo);
          }
        }

        triggerSendReaction("email", `Ata N.º ${numeroAtaReal} Aprovada da Assembleia (PDF Oficial) descarregada e arquivada com sucesso!`);
      } else if (emailId === "sinistro_comunicacao") {
        gerarParticipacaoSinistroPDF(
          "SIN-2026-014",
          "847291039",
          "Fidelidade - Companhia de Seguros, S.A.",
          predio.nome || "Condomínio Edifício Estrela da Barra",
          predio.nif || "900 123 456"
        );
        triggerSendReaction("email", "Participação Formal de Sinistro (PDF com Peritagem) descarregada com sucesso!");
      } else if (emailId === "ocorrencia_avaria") {
        triggerSendReaction("mensagem", "Comunicação exclusivamente por mensagem na aplicação (sem anexo de e-mail).");
      } else {
        handleExportarPDFMinuta();
      }
    } catch (e: any) {
      alert("Erro ao descarregar anexo: " + e.message);
    }
  };

  // --- TODOS OS TEMPLATES DE EMAIL DEFINIDOS NA PLATAFORMA ---
  const emailTemplates = useMemo(() => [
    {
      id: "boas_vindas_condomino",
      categoria: "Boas-Vindas & Acessos",
      titulo: "1. Boas-Vindas ao Condómino (Novo Proprietário / Residente)",
      gatilho: "Registo ou aquisição de nova fração / boas-vindas oficiais",
      assunto: "Boas Vindas e Acessos",
      anexoSimulado: "Instrucoes_Site_e_PWA_Condomino.pdf (210 KB)",
      corpoTexto: 
`De: ${(predio as any).email_administracao || (predio as any).email || "administracao@condomanagerai.com"}
Para: ${fracoes[0]?.proprietario?.email || "(Email do condómino)"}
Assunto: Boas Vindas e Acessos

Olá ${fracoes[0]?.proprietario?.nome || "(Nome do condómino)"},

Espero que se encontre bem.
O meu nome é José Carlos Guerra, administrador do nosso prédio e também seu vizinho no 3ºE. Disponibilizo o meu contacto direto (919943465) para qualquer assunto urgente ou questão que possa surgir.
Informo que a sua conta no CondoManager AI foi criada com sucesso. Pode aceder à sua área reservada através do link: https://bentorodrigues2.condomanagerai.com e pode baixar a aplicação AQUI (https://bentorodrigues2.condomanagerai.com).
Através desta plataforma — acessível via computador ou telemóvel — poderá acompanhar toda a atividade do condomínio, consultar documentos, reportar avarias, enviar comprovativos de pagamento e comunicar diretamente comigo. A sua participação ativa é fundamental para a gestão transparente do nosso prédio.

Importante:
    • Pagamentos: No seu perfil, encontrará a sua referência de pagamento personalizada. Por favor, utilize sempre esta referência ao efetuar transferências bancárias para garantir o processamento automático do seu saldo.
    • Instruções: Em anexo, encontrará um breve guia de utilização da plataforma.

Dados de Acesso:
Link: https://bentorodrigues2.condomanagerai.com
Utilizador: ${fracoes[0]?.proprietario?.email || "(Email do condómino)"}
Ativação do Acesso: verifique o seu email — enviámos um link seguro para definir a sua própria palavra-passe.

Qualquer dúvida adicional, estou ao dispor.

Com os meus cumprimentos,

José Carlos Guerra
O Administrador do Condomínio`
    },
    {
      id: "boas_vindas_administrador",
      categoria: "Boas-Vindas & Acessos",
      titulo: "2. Nomeação & Ativação de Acesso - Perfil Administrador",
      gatilho: "Nomeação de novo Administrador do Condomínio / Ativação de Super Admin",
      assunto: "Nomeação & Ativação de Acesso à Gestão - Condomínio Edifício Estrela da Barra",
      anexoSimulado: "Instrucoes_Acesso_Perfil_Administrador.pdf (245 KB)",
      corpoTexto:
`De: ${(predio as any).email_administracao || (predio as any).email || "administracao@condomanagerai.com"}
Para: ${testEmailRecipient.includes("@") ? testEmailRecipient : "administracao@condomanagerai.com"}
Assunto: Nomeação & Ativação de Acesso à Gestão - Condomínio Edifício Estrela da Barra

Exmo.(a) Sr.(a) Administrador do Condomínio,

Confirmamos a sua integração com sucesso no sistema de gestão do Condomínio Edifício Estrela da Barra.

Privilégios e Módulos Ativados:
• Perfil de Acesso: Administrador do Condomínio (Super Admin / Acesso Total)
• Gestão de Tesouraria e Extratos Bancários com Reconciliação IA
• Emissão de Notas de Cobrança e Linhas Multibanco
• Gestão de Sinistros, Seguros e Livro de Vistorias Técnicas
• Assembleia Virtual com Votação em Tempo Real
• Controlo Cadastral & Jurídico: Registo de frações, autos e cobrança coerciva
• Parametrização do Autoresponder e Regras IA do Prédio

Aceda à consola de administração em https://bentorodrigues2.condomanagerai.com utilizando as suas credenciais seguras, pode acompanhar pelo seu telemóvel para baixar a aplicação selecione AQUI (https://bentorodrigues2.condomanagerai.com)

Dados de Acesso:
Link: https://bentorodrigues2.condomanagerai.com
Utilizador: ${testEmailRecipient.includes("@") ? testEmailRecipient : "administracao@condomanagerai.com"}
Ativação do Acesso: verifique o seu email — enviámos um link seguro para definir a sua própria palavra-passe.

Cordiais saudações,
CondoManager AI - Central de Operações`
    },
    {
      id: "boas_vindas_gestor",
      categoria: "Boas-Vindas & Acessos",
      titulo: "3. Nomeação & Ativação de Acesso - Perfil Gestor (Operacional)",
      gatilho: "Atribuição de carteira / integração de Gestor de Portfólio ou Operacional",
      assunto: "Nomeação & Ativação de Acesso à Gestão - Condomínio Edifício Estrela da Barra",
      anexoSimulado: "Instrucoes_Acesso_Perfil_Gestor.pdf (230 KB)",
      corpoTexto:
`De: ${(predio as any).email_administracao || (predio as any).email || "administracao@condomanagerai.com"}
Para: ${testEmailRecipient.includes("@") ? testEmailRecipient : "gestor@condomanagerai.com"}
Assunto: Nomeação & Ativação de Acesso à Gestão - Condomínio Edifício Estrela da Barra

Exmo.(a) Sr.(a) Gestor(a) de Portfólio / Operacional,

Confirmamos a sua integração com sucesso no sistema de gestão do Condomínio Edifício Estrela da Barra.

Privilégios e Módulos Ativados:
• Perfil de Acesso: Gestor de Portfólio / Gestor Operacional
• Gestão Operacional de Ocorrências e Triagem de Avarias
• Supervisão de Limpezas, Equipamentos e Vistorias Técnicas
• Acompanhamento de Fornecedores, Obras e Contratos de Manutenção
• Comunicação Direta com Condóminos, Comunicados e Notificações
• Consulta Documental, Atas e Gestão de Reservas de Espaços Comuns

Aceda à consola de administração em https://bentorodrigues2.condomanagerai.com utilizando as suas credenciais seguras, pode acompanhar pelo seu telemóvel para baixar a aplicação selecione AQUI (https://bentorodrigues2.condomanagerai.com)

Dados de Acesso:
Link: https://bentorodrigues2.condomanagerai.com
Utilizador: ${testEmailRecipient.includes("@") ? testEmailRecipient : "gestor@condomanagerai.com"}
Ativação do Acesso: verifique o seu email — enviámos um link seguro para definir a sua própria palavra-passe.

Cordiais saudações,
CondoManager AI - Central de Operações`
    },
    {
      id: "boas_vindas_fornecedor",
      categoria: "Boas-Vindas & Acessos",
      titulo: "4. Registo de Fornecedor Homologado - Condomínio Edifício Estrela da Barra",
      gatilho: "Credenciação de fornecedor / prestador de serviços homologado",
      assunto: "Registo de Fornecedor Homologado - Condomínio Edifício Estrela da Barra",
      anexoSimulado: "Instrucoes_Acesso_Perfil_Fornecedor.pdf (215 KB)",
      corpoTexto:
`De: ${(predio as any).email_administracao || (predio as any).email || "administracao@condomanagerai.com"}
Para: ${testEmailRecipient.includes("@") ? testEmailRecipient : "fornecedor@empresa.pt"}
Assunto: Registo de Fornecedor Homologado - Condomínio Edifício Estrela da Barra

Exmos. Senhores (nome do fornecedor/prestador de serviço),

Confirmamos a conclusão do registo da vossa empresa no catálogo de fornecedores e prestadores homologados do Condomínio Edifício Estrela da Barra.

Dados Fiscais para Faturação :
• Designação: Condomínio Edifício Estrela da Barra
• NIF: 900123456
• Morada de Faturação: Rua Bento Rodrigues
• E-mail para Envio de Faturas/Recibos: ${(predio as any).email_administracao || (predio as any).email || "administracao@condomanagerai.com"}

Dados de Acesso:
Link: https://bentorodrigues2.condomanagerai.com
Utilizador: ${testEmailRecipient.includes("@") ? testEmailRecipient : "fornecedor@empresa.pt"}
Ativação do Acesso: verifique o seu email — enviámos um link seguro para definir a sua própria palavra-passe.

Atentamente,

José Carlos Guerra
+351 919 943 465
O Administrador do Condominio`
    },
    {
      id: "aniversario_condomino",
      categoria: "Relacionamento & Cordialidade",
      titulo: "5. Felicitações de Aniversário ao Condómino",
      gatilho: "Disparo automático no dia de aniversário do condómino / residente",
      assunto: "🎉 Feliz Aniversário, Ana Silva! - Os votos do seu Condomínio",
      anexoSimulado: "Cartao_Aniversario_Condomino.pdf (185 KB)",
      corpoTexto:
`De: ${(predio as any).email_administracao || (predio as any).email || "administracao@condomanagerai.com"}
Para: ${testEmailRecipient.includes("@") ? testEmailRecipient : "ana.silva@email.pt"}
Assunto: 🎉 Feliz Aniversário, Ana Silva! - Os votos do seu Condomínio

Exmo.(a) Sr.(a) Ana Silva,

Hoje é um dia especial!

A Administração e a equipa  do Condomínio Edifício Estrela da Barra têm o enorme gosto de lhe desejar um Feliz Aniversário, com muita saúde, alegria e realizações pessoais junto de quem mais estima.

Agradecemos o seu contributo diário para a harmonia e bom convívio no nosso edifício.

Parabéns pelo seu dia! 🎂🥂

Com as mais calorosas saudações,

José Carlos Guerra
A Administração do Condomínio 
Edifício Estrela da Barra`
    },
    {
      id: "aviso_cobranca",
      categoria: "Cobranças & Tesouraria",
      titulo: "6. Aviso de Cobrança / Emissão de Quota Mensal (Dia 25)",
      gatilho: "Emissão periódica de quotas com dados bancários e referência (Dia 25)",
      assunto: "Aviso de Pagamento: Quota de Setembro de 2026 - Fração A",
      anexoSimulado: "Aviso_Cobranca_Setembro_2026_Fracao_A.pdf (118 KB)",
      corpoTexto: 
`De: edificio.estrela@condomanager.pt
Para: ${testEmailRecipient.includes("@") ? testEmailRecipient : "jcafguerra@hotmail.com"}
Assunto: Aviso de Pagamento: Quota de Setembro de 2026 - Fração A

Exmo(a). Senhor(a) Ana Silva,

Encontra-se a pagamento a quota de condomínio referente à fração A para o mês de Setembro de 2026.

Resumo dos Valores:
• Quota Ordinária: 45,00 €
• Fundo Comum de Reserva: 4,50 €
• Total a Pagar: 49,50 €
• Data Limite de Pagamento: 08/09/2026

Dados de Pagamento:
• IBAN Oficial: PT50 0035 0123 4567 8901 2344 5
• Descritivo Obrigatório: ${(fracoes[0] as any)?.referencia_pagamento || "BR2-FRA-A"} (referência individual da fração correspondente para cruzamento de dados através da AI)
• E-mail para Envio de Comprovativos: edificio.estrela@condomanager.pt

Envie comprovativo para o email do condomínio ou através da aplicação, após confirmação recebe o recibo de pagamento.

Atenciosamente,

José Carlos Guerra
+351 919 943 465
A Administração do Condomínio
Edifício Estrela da Barra`
    },
    {
      id: "lembrete_dia05",
      categoria: "Cobranças & Tesouraria",
      titulo: "7. Lembrete Cordial de Vencimento de Quota (Dia 05)",
      gatilho: "Disparo automático 3 dias antes do limite de vencimento (Dia 05)",
      assunto: "Lembrete Cordial: Quota de Condomínio com Vencimento a 08/09 - Fração A",
      anexoSimulado: "Aviso_Cobranca_Setembro_2026_Fracao_A.pdf (118 KB)",
      corpoTexto:
`De: edificio.estrela@condomanager.pt
Para: ${testEmailRecipient.includes("@") ? testEmailRecipient : "jcafguerra@hotmail.com"}
Assunto: Lembrete Cordial: Quota de Condomínio com Vencimento a 08/09 - Fração A

Exmo.(a) Sr.(a) Ana Silva,

Lembramos cordialmente que a quota de condomínio relativa à fração A (valor: 49,50 €) atinge a data limite de liquidação no próximo dia 08 de Setembro de 2026.

Caso já tenha efetuado o pagamento nas últimas 24 horas, pedimos que desconsidere este lembrete ou nos envie o respetivo comprovativo.

Dados para Liquidação:
• IBAN Oficial: PT50 0035 0123 4567 8901 2344 5
• Descritivo Obrigatório: ${(fracoes[0] as any)?.referencia_pagamento || "BR2-FRA-A"} (referência individual da fração correspondente para cruzamento de dados através da AI)
• E-mail para Envio de Comprovativos: edificio.estrela@condomanager.pt

Envie comprovativo para o email do condomínio ou através da aplicação.

Atenciosamente,

José Carlos Guerra
+351 919 943 465
A Administração do Condomínio
Edifício Estrela da Barra`
    },
    {
      id: "carta_interpelacao_divida",
      categoria: "Cobranças & Tesouraria",
      titulo: "8. Carta de Interpelação / Notificação de Dívida (Art.º 1424.º-B CC)",
      gatilho: "Quotas com atraso superior a 60 dias / processo pré-judicial",
      assunto: `Carta de Interpelação: Regularização de Quotas em Atraso - Fração B`,
      anexoSimulado: "notificacao_formal_divida_titulo_executivo.pdf (230 KB)",
      corpoTexto:
`Estimado(a) Sr.(a) Carlos Administrador,

Proprietário(a) da Fração B,

Esperamos que este contacto o(a) encontre bem.

Vimos por este meio informar que a conta corrente da sua fração apresenta atualmente um valor pendente de 247,50 €, correspondente às quotas do condomínio dos meses de maio a agosto de 2026.

Com o intuito de mantermos as contas do nosso edifício devidamente regularizadas e em conformidade com o enquadramento legal aplicável (Artigo 1424.º-B do Código Civil e Decreto-Lei n.º 268/94), solicitamos a gentileza de proceder à regularização deste montante no prazo de 15 dias.

Caso prefira, estamos inteiramente disponíveis para analisar em conjunto um acordo de pagamento faseado que seja mais vantajoso e confortável para si.

Se porventura já efetuou este pagamento nos últimos dias, por favor desconsidere este aviso.

Ficamos a aguardar o seu contacto e disponíveis para qualquer esclarecimento.

Com os melhores cumprimentos,

A Administração do Condomínio`
    },
    {
      id: "convocatoria_assembleia",
      categoria: "Assembleias & Deliberações",
      titulo: "9. Convocatória Oficial de Assembleia de Condóminos",
      gatilho: "Convocatória formal ordinária ou extraordinária (DL 268/94)",
      assunto: `CONVOCATÓRIA: Assembleia Geral Ordinária de Condóminos - 15/09/2026`,
      anexoSimulado: "Convocatoria_Assembleia_15-09-2026.pdf (320 KB)",
      corpoTexto: 
`Assunto: CONVOCATÓRIA: Assembleia Geral Ordinária de Condóminos - 15/09/2026

Exmos.(as) Senhores(as) Condóminos(as) do Edifício Edifício Estrela da Barra,

Nos termos da lei, ficam convocados para a Assembleia Geral Ordinária de Condóminos a realizar no próximo dia 15 de Setembro de 2026:

• Data: 15/09/2026
• 1.ª Convocação: 20h30 (com quórum superior a 500‰)
• 2.ª Convocação: 21h00 (com qualquer quórum presente)
• Local: Sala de Condomínio / Ligação Zoom
• Plataforma de Votação Online: https://bentorodrigues2.condomanagerai.com

Ordem de Trabalhos:
1. Apresentação e votação do Relatório de Contas do exercício transato.
2. Discussão e aprovação do Orçamento Previsional e Quotas para 2026/2027.
3. Plano de Manutenção e Conservação de Áreas Comuns.
4. Eleição / Renovação da Administração.

Vai ser publicada na plataforma uma sondagem de presenças.

A Administração do Condomínio`
    },
    {
      id: "envio_ata_aprovada",
      categoria: "Assembleias & Deliberações",
      titulo: "10. Envio da Ata de Assembleia Aprovada & Folha de Presenças",
      gatilho: "Conclusão de assembleia e envio formal da ata (prazo legal de 30 dias)",
      assunto: `Ata N.º 42 da Assembleia Geral de 15/09/2026 - Edifício ${predio.nome || "Bento Rodrigues"}`,
      anexoSimulado: "ata_n42_assinada_mesa.pdf (410 KB)",
      corpoTexto:
`Exmos.(as) Senhores(as) Condóminos(as),

Em cumprimento do disposto no n.º 1 do Artigo 1432.º do Código Civil, remete-se em anexo a cópia integral da Ata N.º 42 respeitante à Assembleia Geral Ordinária realizada a 15 de Setembro de 2026.

Recorda-se aos condóminos não presentes que dispõem do prazo de 90 dias após a receção desta comunicação para, querendo, exercerem o direito de oposição ou comunicação escrita sobre as deliberações tomadas.

O documento encontra-se também permanentemente arquivado no vosso Portal do Condómino.

Com os melhores cumprimentos,
A Mesa da Assembleia & Administração`
    },
    {
      id: "ocorrencia_avaria",
      categoria: "Manutenção & Ocorrências",
      canal: "MENSAGEM" as const,
      titulo: "11. Resposta à Solicitação de Avaria Técnica (Via Mensagem - Sem E-mail)",
      gatilho: "Solicitação / reporte de avaria no PWA (Resposta enviada exclusivamente via mensagem)",
      assunto: `[MENSAGEM NA APLICAÇÃO] Resposta à Solicitação #TCK-2026-089 - Avaria no Portão da Garagem`,
      anexoSimulado: "Sem anexo de e-mail (Histórico integrado no chat da solicitação)",
      corpoTexto:
`[CANAL OFICIAL: RESPOSTA VIA MENSAGEM NA APLICAÇÃO (SEM ENVIO DE E-MAIL)]
Destinatário: ${fracoes[0]?.proprietario.nome || "José Carlos Guerra"} (Fração A - 1º Dto)
Canal: Mensagem interna no Chat & Notificações da Aplicação

Olá ${fracoes[0]?.proprietario.nome || "José Carlos Guerra"},

Agradecemos a sua comunicação. Em resposta à sua solicitação reportada sobre "Avaria no Portão da Garagem", informamos que foi registada e encaminhada no sistema:

• N.º de Solicitação: #TCK-2026-089
• Prioridade: Alta
• Estado: Encaminhado para a empresa técnica 'Portões & Automatismos Lda'
• Intervenção Prevista: Amanhã às 10:30

Acompanhe o estado da intervenção ou envie novas mensagens diretamente através da aplicação.

Atentamente,
Serviços de Manutenção & Administração
Condomínio Edifício Estrela da Barra`
    },
    {
      id: "sinistro_comunicacao",
      categoria: "Manutenção & Ocorrências",
      titulo: "12. Abertura e Declaração de Sinistro à Seguradora",
      gatilho: "Inundação, danos por tempestade, incêndio ou quebra em partes comuns",
      assunto: `Declaração de Sinistro #SIN-2026-014 - Apólice Multirriscos Condomínio ${predio.nome || "Bento Rodrigues"}`,
      anexoSimulado: "participacao_sinistro_peritagem_fotos.pdf (520 KB)",
      corpoTexto:
`Exmos. Senhores do Departamento de Sinistros / Companhia de Seguros Fidelidade,

Vimos por este meio efetuar a participação formal de sinistro ocorrido nas partes comuns do edifício:

• Apólice Multirriscos: N.º 847291039
• Tomador / Condomínio: Condomínio ${predio.nome || "Bento Rodrigues"} (NIF ${predio.nif || "900 123 456"})
• Data do Evento: 28/08/2026
• Natureza: Danos por Água / Rutura na coluna montante do piso 2
• Danos Preliminares Estimados: 1.850,00 €

Juntamos em anexo o relatório fotográfico, auto de vistoria técnica e primeiro orçamento de reparação urgente.

Aguardamos a nomeação do perito avaliador com a maior brevidade.

Atenciosamente,
A Administração do Condomínio`
    }
  ], [fracoes, predio, testEmailRecipient, loggedUser]);

  const activeEmailTemplate = useMemo(() => {
    return emailTemplates.find(t => t.id === selectedEmailSimId) || emailTemplates[0];
  }, [emailTemplates, selectedEmailSimId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 p-5 sm:p-7 rounded-2xl shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <FileText className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  Central de Documentos & Minutas Oficiais
                  <span className="text-xs px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 font-bold rounded-full border border-emerald-500/30">
                    Modelos Editáveis
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                  Minutas oficiais prontas para edição e exportação em PDF, com simulador completo de e-mails institucionais e anexos oficiais.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenArranque && (
              <button
                onClick={onOpenArranque}
                className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-black text-xs transition-all flex items-center space-x-1.5 shadow-md hover:scale-105 cursor-pointer"
              >
                <Sliders className="h-4 w-4 text-emerald-300" />
                <span>Configurar Saldos Iniciais & Dívidas</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab(activeTab === "minutas_oficiais" ? "simulador_emails" : "minutas_oficiais")}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs transition-all flex items-center space-x-1.5 shadow-md cursor-pointer"
            >
              {activeTab === "minutas_oficiais" ? (
                <>
                  <Mail className="h-4 w-4" />
                  <span>Ver Modelos de E-mails ({emailTemplates.length})</span>
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  <span>Ver Minutas Editáveis em PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* TABS DE SELEÇÃO PRINCIPAL */}
        <div className="flex items-center space-x-2 mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={() => setActiveTab("minutas_oficiais")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "minutas_oficiais"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-slate-600 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <FileCode className="h-4 w-4 text-emerald-400" />
            <span>1. Minutas Oficiais em PDF (5 Documentos Editáveis)</span>
          </button>

          <button
            onClick={() => setActiveTab("simulador_emails")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "simulador_emails"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-slate-600 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Mail className="h-4 w-4 text-emerald-400" />
            <span>2. Centro de E-mails & Notificações Oficiais ({emailTemplates.length} Modelos)</span>
          </button>

          {podeGerirCorrespondencia && (
            <button
              onClick={() => setActiveTab("gestao_correspondencia")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === "gestao_correspondencia"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-slate-600 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Inbox className="h-4 w-4 text-emerald-400" />
              <span>3. Gestão de Correspondência ({correspondencias.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: MINUTAS OFICIAIS EDITÁVEIS */}
      {/* ========================================================================= */}
      {activeTab === "minutas_oficiais" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* SIDEBAR SELETOR DE MINUTAS */}
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
              <h3 className="text-xs font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-3">
                Selecione o Documento Oficial
              </h3>
              <div className="space-y-2">
                {[
                  { id: "ata_assembleia", title: "Ata de Assembleia Geral", desc: "Com quórum em permilagem, ordem de trabalhos e deliberações", icon: FileText, tag: "DL 268/94" },
                  { id: "aviso_cobranca", title: "Aviso de Cobrança / Quota", desc: "Com quota ordinária, fundo de reserva e dados bancários", icon: Building2, tag: "Mensal" },
                  { id: "carta_divida", title: "Carta de Notificação de Dívida", desc: "Interpelação formal com força de título executivo", icon: AlertTriangle, tag: "Jurídico" },
                  { id: "balancete_financeiro", title: "Balancete & Mapa Orçamental", desc: "Demonstração de receitas, despesas e saldos bancários", icon: Sliders, tag: "Contas" },
                  { id: "auto_vistoria", title: "Auto de Vistoria Técnica", desc: "Registo de inspeção a elevadores, coberturas e bombas", icon: ShieldCheck, tag: "Manutenção" }
                ].map((doc) => {
                  const Icon = doc.icon;
                  const isSelected = selectedMinutaId === doc.id;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedMinutaId(doc.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-start space-x-3 ${
                        isSelected
                          ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 shadow-xs ring-1 ring-emerald-500"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${isSelected ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{doc.title}</span>
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {doc.tag}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{doc.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleExportarPDFMinuta}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs transition-all flex items-center justify-center space-x-2 shadow-md cursor-pointer hover:scale-[1.02]"
                >
                  <Download className="h-4 w-4" />
                  <span>Descarregar Este Documento em PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* PAINEL DE EDIÇÃO E PREVIEW LIVE DA MINUTA */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-2xl shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Edit3 className="h-4 w-4 text-emerald-500" />
                <h2 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                  Editor do Documento & Campos Oficiais
                </h2>
              </div>
              <button
                onClick={handleExportarPDFMinuta}
                className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-emerald-400 border border-slate-700 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Exportar PDF</span>
              </button>
            </div>

            {/* FORMULÁRIO ESPECÍFICO CONFORME O DOCUMENTO SELECIONADO */}
            {selectedMinutaId === "ata_assembleia" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">N.º da Ata</label>
                    <input
                      type="text"
                      value={ataNumero}
                      onChange={(e) => setAtaNumero(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Tipo de Assembleia</label>
                    <select
                      value={ataTipo}
                      onChange={(e) => setAtaTipo(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    >
                      <option value="Assembleia Geral Ordinária">Assembleia Geral Ordinária</option>
                      <option value="Assembleia Geral Extraordinária">Assembleia Geral Extraordinária</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Data da Reunião</label>
                    <input
                      type="date"
                      value={ataData}
                      onChange={(e) => setAtaData(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Horas (1.ª / 2.ª Conv.)</label>
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="text"
                        value={ataHora1}
                        onChange={(e) => setAtaHora1(e.target.value)}
                        className="w-1/2 px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-center"
                      />
                      <span className="text-slate-600">/</span>
                      <input
                        type="text"
                        value={ataHora2}
                        onChange={(e) => setAtaHora2(e.target.value)}
                        className="w-1/2 px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-center"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Local da Assembleia</label>
                    <input
                      type="text"
                      value={ataLocal}
                      onChange={(e) => setAtaLocal(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Quórum Representado (‰)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={ataQuorum}
                      onChange={(e) => setAtaQuorum(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-black text-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Ordem de Trabalhos</label>
                  <textarea
                    rows={4}
                    value={ataOrdemTrabalhos}
                    onChange={(e) => setAtaOrdemTrabalhos(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Deliberações e Decisões Aprovadas</label>
                  <textarea
                    rows={4}
                    value={ataDeliberacoes}
                    onChange={(e) => setAtaDeliberacoes(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>
            )}

            {selectedMinutaId === "aviso_cobranca" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Fração Destinatária</label>
                    <input
                      type="text"
                      value={avisoFracao}
                      onChange={(e) => setAvisoFracao(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nome do Condómino</label>
                    <input
                      type="text"
                      value={avisoProprietario}
                      onChange={(e) => setAvisoProprietario(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Mês / Ano</label>
                    <input
                      type="text"
                      value={avisoMesAno}
                      onChange={(e) => setAvisoMesAno(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Quota Ord. (€)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={avisoQuotaOrdinaria}
                      onChange={(e) => setAvisoQuotaOrdinaria(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Fundo Reserva (€)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={avisoFundoReserva}
                      onChange={(e) => setAvisoFundoReserva(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Data Limite</label>
                    <input
                      type="date"
                      value={avisoDataLimite}
                      onChange={(e) => setAvisoDataLimite(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">IBAN do Condomínio</label>
                    <input
                      type="text"
                      value={avisoIban}
                      onChange={(e) => setAvisoIban(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Entidade / Referência MB</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={avisoEntidade}
                        onChange={(e) => setAvisoEntidade(e.target.value)}
                        placeholder="Entidade"
                        className="w-1/3 px-2 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                      />
                      <input
                        type="text"
                        value={avisoReferencia}
                        onChange={(e) => setAvisoReferencia(e.target.value)}
                        placeholder="Referência"
                        className="w-2/3 px-2 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedMinutaId === "carta_divida" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Condómino Devedor</label>
                    <input
                      type="text"
                      value={dividaProprietario}
                      onChange={(e) => setDividaProprietario(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Fração</label>
                    <input
                      type="text"
                      value={dividaFracao}
                      onChange={(e) => setDividaFracao(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Morada de Notificação</label>
                    <input
                      type="text"
                      value={dividaMorada}
                      onChange={(e) => setDividaMorada(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Valor em Débito (€)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={dividaValorTotal}
                      onChange={(e) => setDividaValorTotal(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30 font-black text-red-600 dark:text-red-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Períodos / Meses em Atraso</label>
                    <input
                      type="text"
                      value={dividaPeriodos}
                      onChange={(e) => setDividaPeriodos(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Prazo para Pagamento (Dias)</label>
                    <input
                      type="number"
                      value={dividaPrazoDias}
                      onChange={(e) => setDividaPrazoDias(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedMinutaId === "balancete_financeiro" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Designação do Período</label>
                  <input
                    type="text"
                    value={balanceteExercicio}
                    onChange={(e) => setBalanceteExercicio(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1">Total de Receitas (€)</label>
                    <input
                      type="text"
                      value={balanceteTotalReceitas}
                      onChange={(e) => setBalanceteTotalReceitas(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-red-600 dark:text-red-400 uppercase mb-1">Total de Despesas (€)</label>
                    <input
                      type="text"
                      value={balanceteTotalDespesas}
                      onChange={(e) => setBalanceteTotalDespesas(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Saldo Conta à Ordem (€)</label>
                    <input
                      type="text"
                      value={balanceteSaldoOrdem}
                      onChange={(e) => setBalanceteSaldoOrdem(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Saldo Fundo Reserva (€)</label>
                    <input
                      type="text"
                      value={balanceteSaldoReserva}
                      onChange={(e) => setBalanceteSaldoReserva(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedMinutaId === "auto_vistoria" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">N.º da Vistoria</label>
                    <input
                      type="text"
                      value={vistoriaNumero}
                      onChange={(e) => setVistoriaNumero(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Data</label>
                    <input
                      type="date"
                      value={vistoriaData}
                      onChange={(e) => setVistoriaData(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Técnico / Responsável</label>
                    <input
                      type="text"
                      value={vistoriaTecnico}
                      onChange={(e) => setVistoriaTecnico(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Áreas Inspecionadas</label>
                  <input
                    type="text"
                    value={vistoriaArea}
                    onChange={(e) => setVistoriaArea(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Anomalias e Ocorrências</label>
                  <textarea
                    rows={3}
                    value={vistoriaAnomalias}
                    onChange={(e) => setVistoriaAnomalias(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Recomendações e Ações Corretivas</label>
                  <textarea
                    rows={3}
                    value={vistoriaRecomendacoes}
                    onChange={(e) => setVistoriaRecomendacoes(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: SIMULADOR DE E-MAILS & ANEXOS */}
      {/* ========================================================================= */}
      {activeTab === "simulador_emails" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LISTA DOS 6 TEMPLATES */}
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  Templates de E-mail ({emailTemplates.length})
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Pronto a Enviar
                </span>
              </div>

              <div className="space-y-2">
                {emailTemplates.map((template) => {
                  const isSelected = selectedEmailSimId === template.id;
                  return (
                    <button
                      key={template.id}
                      onClick={() => setSelectedEmailSimId(template.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-start space-x-3 ${
                        isSelected
                          ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 shadow-xs ring-1 ring-emerald-500"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${
                        isSelected 
                          ? (template.canal === "MENSAGEM" ? "bg-sky-600 text-white" : "bg-emerald-600 text-white") 
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}>
                        {template.canal === "MENSAGEM" ? (
                          <MessageSquare className="h-4 w-4" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-slate-800 dark:text-white truncate">
                            {template.titulo}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[8.5px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {template.categoria}
                          </span>
                          {template.canal === "MENSAGEM" ? (
                            <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                              Mensagem na App
                            </span>
                          ) : (
                            <span className="text-[9.5px] text-slate-500 dark:text-slate-400 truncate">
                              {template.gatilho}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* TARGET EMAIL CONFIG */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                  Endereço de E-mail de Envio / Destinatário
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="email"
                    value={testEmailRecipient}
                    onChange={(e) => setTestEmailRecipient(e.target.value)}
                    placeholder="ex: admin@condomanagerai.com"
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(testEmailRecipient);
                      setCopySuccess("E-mail copiado!");
                      setTimeout(() => setCopySuccess(null), 2000);
                    }}
                    className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
                    title="Copiar"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                {copySuccess && <p className="text-[10px] text-emerald-500 font-bold">{copySuccess}</p>}
              </div>
            </div>
          </div>

          {/* VISUALIZADOR DO EMAIL E ANEXO */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              {activeEmailTemplate.canal === "MENSAGEM" ? (
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4 text-sky-500" />
                  <h2 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                    Resposta à Solicitação via Mensagem na Aplicação
                  </h2>
                  <span className="hidden sm:inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    Sem Envio de E-mail
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-emerald-500" />
                  <h2 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                    Pré-visualização do E-mail Transacional
                  </h2>
                </div>
              )}

              <button
                onClick={() => {
                  if (activeEmailTemplate.canal === "MENSAGEM") {
                    triggerSendReaction("mensagem", "Mensagem enviada com sucesso para a aplicação do condómino! Não foi disparado e-mail.");
                    setEmailSentStatus("Resposta à solicitação enviada via mensagem interna na aplicação (sem envio de e-mail).");
                    setTimeout(() => setEmailSentStatus(null), 4000);
                  } else {
                    handleDispararEmailSimulado(activeEmailTemplate.titulo, activeEmailTemplate.assunto, activeEmailTemplate.corpoTexto);
                  }
                }}
                className={`px-3.5 py-1.5 rounded-xl text-white text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-md hover:scale-105 ${
                  activeEmailTemplate.canal === "MENSAGEM"
                    ? "bg-sky-600 hover:bg-sky-700 active:bg-sky-800"
                    : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
                }`}
              >
                {activeEmailTemplate.canal === "MENSAGEM" ? (
                  <>
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Enviar Resposta via Mensagem</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Enviar E-mail para {testEmailRecipient}</span>
                  </>
                )}
              </button>
            </div>

            {/* AVISO INFORMATIVO DE CANAL MENSAGEM */}
            {activeEmailTemplate.canal === "MENSAGEM" && (
              <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-xl flex items-center space-x-2.5 text-xs text-sky-900 dark:text-sky-200">
                <Smartphone className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                <div>
                  <span className="font-bold">Regra de Comunicação Definida:</span> Não enviamos e-mail para este efeito. A resposta à solicitação é comunicada <strong>exclusivamente através de mensagem direta na aplicação (PWA/Chat)</strong> ao condómino.
                </div>
              </div>
            )}

            {emailSentStatus && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{emailSentStatus}</span>
                </div>
                <span className="font-bold text-[10px] uppercase">Registado com Sucesso</span>
              </div>
            )}

            {/* CAIXA DE E-MAIL OU MENSAGEM */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 font-sans">
              {activeEmailTemplate.canal === "MENSAGEM" ? (
                <div className="space-y-1.5 text-xs border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center">
                    <span className="w-24 font-bold text-slate-600 uppercase text-[10px]">Canal:</span>
                    <span className="font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" /> Mensagem Interna na Aplicação (Sem Envio de E-mail)
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-24 font-bold text-slate-600 uppercase text-[10px]">Destinatário:</span>
                    <span className="font-bold text-slate-800 dark:text-white">
                      {fracoes[0]?.proprietario.nome || "José Carlos Guerra"} (Fração A - 1º Dto)
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-24 font-bold text-slate-600 uppercase text-[10px]">Solicitação:</span>
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      #TCK-2026-089 (Avaria no Portão da Garagem)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 text-xs border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center">
                    <span className="w-16 font-bold text-slate-600 uppercase text-[10px]">De:</span>
                    <span className="font-bold text-slate-800 dark:text-white">
                      Condomínio {predio.nome || "Edifício Estrela da Barra"} &lt;{(predio as any).email_administracao || (predio as any).email || "administracao@condomanagerai.com"}&gt;
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-16 font-bold text-slate-600 uppercase text-[10px]">Para:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {testEmailRecipient}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-16 font-bold text-slate-600 uppercase text-[10px]">Assunto:</span>
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {activeEmailTemplate.assunto}
                    </span>
                  </div>
                </div>
              )}

              {/* ANEXO EM DESTAQUE OU INDICAÇÃO DE FORMATO */}
              {activeEmailTemplate.canal === "MENSAGEM" ? (
                <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 bg-sky-500/10 text-sky-500 rounded-lg">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-white block">
                        Sem anexo de e-mail
                      </span>
                      <span className="text-[9px] text-slate-600 uppercase font-semibold">Comunicação registada no histórico de mensagens da solicitação</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 px-2.5 py-1 rounded-lg">
                    Canal Mensagem Ativo
                  </span>
                </div>
              ) : activeEmailTemplate.id === "aniversario_condomino" ? (
                <div className="p-2.5 bg-gradient-to-r from-amber-50 to-emerald-50 dark:from-amber-950/20 dark:to-emerald-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-white block flex items-center gap-1.5">
                        Cartão Postal Visual Embebido no E-mail
                        <span className="text-[9px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold uppercase">Personalizado & Intimista</span>
                      </span>
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold">
                        Sem texto burocrático de e-mail • Inclui anexo PDF A5 de alta resolução para guardar
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDescarregarAnexoEmail("aniversario_condomino")}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
                  >
                    <Download className="h-3 w-3" />
                    <span>Baixar PDF A5</span>
                  </button>
                </div>
              ) : (
                <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 bg-red-500/10 text-red-500 rounded-lg">
                      <Paperclip className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-white block">
                        {activeEmailTemplate.anexoSimulado}
                      </span>
                      <span className="text-[9px] text-slate-600 uppercase font-semibold">Documento Oficial CondoManager AI</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDescarregarAnexoEmail(activeEmailTemplate.id)}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 transition-colors flex items-center space-x-1 cursor-pointer"
                  >
                    <Download className="h-3 w-3" />
                    <span>Descarregar Anexo</span>
                  </button>
                </div>
              )}

              {/* CORPO DO E-MAIL: NO CASO DO ANIVERSÁRIO, O POSTAL VISUAL É O PRÓPRIO CORPO DO EMAIL */}
              {activeEmailTemplate.id === "aniversario_condomino" ? (
                <div className="bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 rounded-2xl flex flex-col items-center">
                  {/* Postal com Moldura Dupla Oficial do Anexo */}
                  <div className="w-full max-w-xl bg-white border-2 border-slate-800 shadow-xl p-2.5 relative">
                    <div className="border border-sky-600 p-6 sm:p-8 relative text-center space-y-4">
                      {/* 4 Pontos de Canto Decorativos Oficiais */}
                      <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-sky-600 rounded-full"></div>
                      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-sky-600 rounded-full"></div>
                      <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-sky-600 rounded-full"></div>
                      <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-sky-600 rounded-full"></div>

                      {/* Topo: Nome do Edifício */}
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wider">
                        {predio.nome ? predio.nome.toUpperCase() : "EDIFÍCIO ESTRELA DA BARRA"}
                      </h4>

                      {/* Divisória com Ponto Central */}
                      <div className="relative flex items-center justify-center max-w-xs mx-auto">
                        <div className="w-full border-t border-sky-600"></div>
                        <div className="w-2 h-2 bg-sky-600 rounded-full mx-2 shrink-0"></div>
                        <div className="w-full border-t border-sky-600"></div>
                      </div>

                      {/* Título Principal */}
                      <div className="space-y-1">
                        <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                          FELIZ ANIVERSÁRIO!
                        </h3>
                        <p className="text-[11px] sm:text-xs text-slate-600">
                          Hoje é um dia de celebração muito especial para a nossa comunidade
                        </p>
                      </div>

                      {/* Caixa de Destinatário */}
                      <div className="inline-block px-8 py-2.5 bg-sky-50 border border-sky-600 rounded-lg text-sm sm:text-base font-bold text-slate-900 shadow-xs">
                        Exmo.(a) Sr.(a) {testEmailRecipient.split("@")[0] ? "Ana Silva" : "Ana Silva"},
                      </div>

                      {/* Mensagem de Votos e Cordialidade */}
                      <div className="text-xs sm:text-sm text-slate-800 space-y-2.5 max-w-lg mx-auto leading-relaxed">
                        <p>
                          A Administração e a equipa do <strong>{predio.nome || "Condomínio Edifício Estrela da Barra"}</strong> têm o enorme gosto de lhe desejar um Feliz Aniversário, com muita saúde, alegria e realizações pessoais junto de quem mais estima.
                        </p>
                        <p>
                          Agradecemos o seu contributo diário para a harmonia e bom convívio no nosso edifício.
                        </p>
                      </div>

                      {/* Destaque Parabéns */}
                      <div className="text-sm sm:text-base font-bold text-sky-600 pt-1">
                        Parabéns pelo seu dia!
                      </div>

                      {/* Badge Selo Decorativo */}
                      <div className="inline-block px-4 py-1 bg-slate-100 border border-sky-200 rounded text-[10px] font-bold text-sky-600 uppercase tracking-widest">
                        VOTOS DE FELICIDADES & HARMONIA
                      </div>

                      {/* Despedida e Assinatura */}
                      <div className="pt-2 space-y-1 text-center">
                        <p className="text-xs text-slate-500">Com as mais calorosas saudações,</p>
                        <p className="text-xs sm:text-sm font-bold text-slate-900">José Carlos Guerra</p>
                        <p className="text-xs text-slate-600">A Administração do {predio.nome || "Edifício Estrela da Barra"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Ação de Descarregar Postal PDF */}
                  <div className="pt-4 flex justify-center">
                    <button
                      onClick={() => handleDescarregarAnexoEmail("aniversario_condomino")}
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center space-x-2 cursor-pointer hover:scale-105"
                    >
                      <Download className="h-4 w-4" />
                      <span>Descarregar Postal Oficial (PDF A5)</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* CORPO DO EMAIL TRADICIONAL */
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed font-sans shadow-2xs">
                  {activeEmailTemplate.corpoTexto}
                </div>
              )}
            </div>

            {/* BOTÕES DE AÇÃO RÁPIDA */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                <span>Gatilho: {activeEmailTemplate.gatilho}</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Assunto: ${activeEmailTemplate.assunto}\n\n${activeEmailTemplate.corpoTexto}`
                    );
                    setCopySuccess("Conteúdo do e-mail copiado!");
                    setTimeout(() => setCopySuccess(null), 2000);
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all flex items-center space-x-1 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copiar Texto</span>
                </button>

                <button
                  onClick={() => handleDispararEmailSimulado(activeEmailTemplate.titulo, activeEmailTemplate.assunto, activeEmailTemplate.corpoTexto)}
                  className="px-4 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Testar Envio</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: GESTÃO DE CORRESPONDÊNCIA CTT (ADMIN / GESTOR) */}
      {/* ========================================================================= */}
      {activeTab === "gestao_correspondencia" && podeGerirCorrespondencia && (
        <div className="space-y-5">
          {/* TOOLBAR */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {(["Todas", "Enviada", "Recebida"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFiltroCorresp(f)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    filtroCorresp === f
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setModalCorrespAberto("registar_recebida")}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Inbox className="h-4 w-4" />
                <span>Registar Recebida</span>
              </button>
              <button
                onClick={() => handleAbrirNovaCarta()}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Nova Carta com IA</span>
              </button>
            </div>
          </div>

          {/* LISTA */}
          {aCarregarCorrespondencia ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> A carregar correspondência...
            </div>
          ) : correspondenciasFiltradas.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-10 text-center text-slate-500">
              <Mail className="h-8 w-8 mx-auto mb-2 text-slate-400" />
              Ainda não há correspondência registada{filtroCorresp !== "Todas" ? ` (${filtroCorresp.toLowerCase()})` : ""}.
            </div>
          ) : (
            <div className="space-y-3">
              {correspondenciasFiltradas.map(corresp => {
                const aberta = corresDetalheId === corresp.id_corresp;
                const processoLigado = processosJuridicos.find(p => p.id_processo === corresp.id_processo_juridico);
                return (
                  <div key={corresp.id_corresp} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                    <div
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                      onClick={() => setCorresDetalheId(aberta ? null : corresp.id_corresp)}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span className={`p-2 rounded-xl border ${corresp.direcao === "Enviada" ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400" : "bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400"}`}>
                          {corresp.direcao === "Enviada" ? <Send className="h-4 w-4" /> : <Inbox className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{corresp.assunto}</h4>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${ESTADO_CORES[corresp.estado] || ""}`}>{corresp.estado}</span>
                            {processoLigado && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 flex items-center gap-1">
                                <Scale className="h-3 w-3" /> {processoLigado.id_processo}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {corresp.direcao === "Enviada" ? `Para: ${corresp.destinatario_nome || "—"}` : `De: ${corresp.remetente_nome || "—"}`}
                            {" · "}{formatDatePT(corresp.data_criacao.split("T")[0])}
                            {corresp.custo != null && <> · <Euro className="h-3 w-3 inline" /> {corresp.custo.toFixed(2)}€</>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {corresp.direcao === "Recebida" && corresp.estado !== "Respondida" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAbrirNovaCarta(corresp); }}
                            className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-1 cursor-pointer"
                          >
                            <Reply className="h-3.5 w-3.5" /> Responder
                          </button>
                        )}
                        {corresp.direcao === "Enviada" && corresp.estado === "Enviada" && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMarcarComoEntregue(corresp); }}
                              className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Marcar Entregue
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMarcarComoDevolvida(corresp); }}
                              className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1 cursor-pointer"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" /> Devolvida
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {aberta && (
                      <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
                        {corresp.conteudo && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
                            {corresp.conteudo}
                          </div>
                        )}
                        {corresp.resposta_texto && (
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Resposta ({corresp.data_resposta && formatDatePT(corresp.data_resposta)}):</p>
                            <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                              {corresp.resposta_texto}
                            </div>
                          </div>
                        )}
                        {corresp.anexos.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {corresp.anexos.map(anx => (
                              <a
                                key={anx.id_anexo}
                                href={anx.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                                {anx.tipo === "comprovativo_envio" ? "Comprovativo de Envio" :
                                 anx.tipo === "registo_ctt" ? "Registo CTT" :
                                 anx.tipo === "aviso_rececao" ? "Aviso de Receção" :
                                 anx.tipo === "fatura" ? "Fatura" :
                                 anx.tipo === "documento_recebido" ? "Documento Recebido" : "Resposta"}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* MODAL: NOVA CARTA (REDAÇÃO LIVRE ASSISTIDA POR IA) */}
          {modalCorrespAberto === "nova_carta" && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setModalCorrespAberto(null)}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-500" />
                    {corresRespondendoA ? `Responder a: ${corresRespondendoA.assunto}` : "Nova Carta de Correspondência"}
                  </h3>
                  <button onClick={() => setModalCorrespAberto(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="h-5 w-5" /></button>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-600">Assunto *</label>
                      <input value={cartaAssunto} onChange={e => setCartaAssunto(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg" placeholder="Ex: Notificação de dívida, resposta a reclamação..." />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-600">Destinatário</label>
                      <input value={cartaDestinatarioNome} onChange={e => setCartaDestinatarioNome(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg" placeholder="Nome do destinatário" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-600">Morada</label>
                      <input value={cartaDestinatarioMorada} onChange={e => setCartaDestinatarioMorada(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg" placeholder="Morada de envio" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-600">Fração (opcional)</label>
                      <select value={cartaIdFracao} onChange={e => setCartaIdFracao(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg">
                        <option value="">—</option>
                        {fracoes.map(f => <option key={f.id_fracao} value={f.id_fracao}>{f.fracao_nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-600">Tipo de Envio</label>
                      <select value={cartaTipoEnvio} onChange={e => setCartaTipoEnvio(e.target.value as any)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg">
                        <option>Correio Simples</option>
                        <option>Correio Registado</option>
                        <option>Registado com AR</option>
                        <option>Email</option>
                        <option>Em Mão</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-600 flex items-center gap-1"><Scale className="h-3.5 w-3.5" /> Ligar a Processo Jurídico</label>
                      <select value={cartaIdProcesso} onChange={e => setCartaIdProcesso(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg">
                        <option value="">— Nenhum —</option>
                        {processosJuridicos.map(p => <option key={p.id_processo} value={p.id_processo}>{p.id_processo} — {p.titulo_processo}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-600">Pontos-Chave (a IA redige a carta completa a partir daqui — colocação manual, sem modelo pré-definido)</label>
                    <textarea value={cartaPontosChave} onChange={e => setCartaPontosChave(e.target.value)} rows={3} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg" placeholder="Descreva livremente o que a carta deve dizer..." />
                    <button
                      onClick={handleGerarCartaIA}
                      disabled={aGerarCartaIA}
                      className="mt-2 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      {aGerarCartaIA ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      <span>{aGerarCartaIA ? "A redigir com IA..." : "Redigir Carta com IA"}</span>
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-600">Conteúdo Final da Carta (editável)</label>
                    <textarea value={cartaConteudo} onChange={e => setCartaConteudo(e.target.value)} rows={10} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg font-mono" placeholder="O texto da carta aparece aqui depois de gerado pela IA, ou escreva diretamente..." />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-600 flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> Comprovativo de Envio / Registo CTT (opcional)</label>
                    <input type="file" onChange={e => setCartaFicheiroComprovativo(e.target.files?.[0] || null)} className="w-full mt-1 text-xs" />
                  </div>

                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input type="checkbox" checked={cartaLancarCusto} onChange={e => setCartaLancarCusto(e.target.checked)} />
                      <Euro className="h-3.5 w-3.5" /> Lançar custo desta carta nos movimentos financeiros
                    </label>
                    {cartaLancarCusto && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-500">Valor (€)</label>
                          <input value={cartaCustoValor} onChange={e => setCartaCustoValor(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg" placeholder="0.00" />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-500">Conta a Debitar</label>
                          <select value={cartaCustoContaId} onChange={e => setCartaCustoContaId(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg">
                            {contas.map(c => <option key={c.id_conta} value={c.id_conta}>{c.banco}</option>)}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-bold text-slate-500">Anexar Fatura (opcional — ou reconcilie depois via extrato bancário em Movimentos)</label>
                          <input type="file" onChange={e => setCartaCustoFatura(e.target.files?.[0] || null)} className="w-full mt-1 text-xs" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                  <button onClick={() => handleGuardarCarta("Rascunho")} disabled={aGuardarCarta} className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 cursor-pointer">
                    Guardar Rascunho
                  </button>
                  <button onClick={() => handleGuardarCarta("Enviada")} disabled={aGuardarCarta} className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 flex items-center gap-1.5 cursor-pointer">
                    {aGuardarCarta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Registar como Enviada
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: REGISTAR CORRESPONDÊNCIA RECEBIDA */}
          {modalCorrespAberto === "registar_recebida" && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setModalCorrespAberto(null)}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <Inbox className="h-5 w-5 text-amber-500" /> Registar Correspondência Recebida
                  </h3>
                  <button onClick={() => setModalCorrespAberto(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="h-5 w-5" /></button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-600">Assunto *</label>
                    <input value={recebidaAssunto} onChange={e => setRecebidaAssunto(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-600">Remetente *</label>
                    <input value={recebidaRemetente} onChange={e => setRecebidaRemetente(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-600">Data de Receção</label>
                      <input type="date" value={recebidaData} onChange={e => setRecebidaData(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-600">Fração (opcional)</label>
                      <select value={recebidaIdFracao} onChange={e => setRecebidaIdFracao(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg">
                        <option value="">—</option>
                        {fracoes.map(f => <option key={f.id_fracao} value={f.id_fracao}>{f.fracao_nome}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-600 flex items-center gap-1"><Scale className="h-3.5 w-3.5" /> Ligar a Processo Jurídico</label>
                    <select value={recebidaIdProcesso} onChange={e => setRecebidaIdProcesso(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg">
                      <option value="">— Nenhum —</option>
                      {processosJuridicos.map(p => <option key={p.id_processo} value={p.id_processo}>{p.id_processo} — {p.titulo_processo}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-600 flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> Anexar Documento Recebido *</label>
                    <input type="file" onChange={e => setRecebidaFicheiro(e.target.files?.[0] || null)} className="w-full mt-1 text-xs" />
                  </div>
                </div>
                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                  <button onClick={handleRegistarRecebida} disabled={aGuardarRecebida} className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-60 flex items-center gap-1.5 cursor-pointer">
                    {aGuardarRecebida ? <Loader2 className="h-4 w-4 animate-spin" /> : <Inbox className="h-4 w-4" />}
                    Registar Correspondência
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
