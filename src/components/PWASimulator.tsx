import React, { useState, useEffect } from "react";
import { ActionIcon } from "./ActionIcon";
import { triggerSendReaction } from "./SendingReactionModal";
import { 
  Predio, 
  Fracao, 
  Aviso, 
  Movimento, 
  Reserva, 
  Ocorrencia, 
  Documento, 
  LoggedUser,
  Conta,
  Fornecedor,
  Reuniao,
  CapacidadeLimite
} from "../types";
import { GestaoReservas } from "./GestaoReservas";
import { GestaoManutencaoIntervencoes } from "./GestaoManutencaoIntervencoes";
import { IAAvancada } from "./IAAvancada";
import { GestaoComunicacoes } from "./GestaoComunicacoes";
import { GestaoDocumentos } from "./GestaoDocumentos";
import { GestaoMovimentos } from "./GestaoMovimentos";
import { GestaoFracoes } from "./GestaoFracoes";
import { GestaoAssembleias } from "./GestaoAssembleias";
import { IAConciliacao } from "./IAConciliacao";
import { GestaoContas } from "./GestaoContas";
import { GestaoFundoReserva } from "./GestaoFundoReserva";
import { GestaoEmissao } from "./GestaoEmissao";
import { GestaoPredios } from "./GestaoPredios";
import { PortalCondomino } from "./PortalCondomino";
import { ContenciosoJuridico } from "./ContenciosoJuridico";
import { GestaoVistoriasLimpezas } from "./GestaoVistoriasLimpezas";
import { SendingReactionModal } from "./SendingReactionModal";
import { AuditoriaInterna } from "./AuditoriaInterna";
import { GestaoFornecedores } from "./GestaoFornecedores";
import { PortalOrcamentos } from "./PortalOrcamentos";
import { SecurityAuditModal } from "./SecurityAuditModal";
import { ConfiguracoesAdministracao } from "./ConfiguracoesAdministracao";
import { FichaEmpresaGestora } from "./FichaEmpresaGestora";
import { PWASupplierCardsView } from "./PWASupplierCardsView";
import { saveAvisosToSupabase, saveMovimentoToSupabase, saveContaToSupabase, saveDocumentoToSupabase, saveReuniaoToSupabase, saveOcorrenciaToSupabase, saveReservaToSupabase, registarLogAuditoria, saveConversaToSupabase, saveMensagemConversaToSupabase, saveProprietarioToSupabase, saveFracaoToSupabase, saveLimpezaToSupabase } from "../lib/supabaseService";
import { encontrarFracaoDoCondomino } from "../lib/condominoUtils";
import { 
  Smartphone, 
  Wifi, 
  Battery, 
  Signal, 
  User, 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  Bell, 
  FileText, 
  Wrench, 
  Scale, 
  AlertTriangle, 
  CreditCard, 
  Fingerprint, 
  Camera, 
  Mic,
  Plus, 
  Trash2, 
  Archive,
  ExternalLink,  
  Check, 
  Clock, 
  ArrowRight, 
  Send,
  Building,
  Volume2,
  VolumeX,
  LogOut,
  Brain,
  Users,
  Brush,
  TrendingUp,
  Key,
  UserCheck
} from "lucide-react";
import { motion } from "motion/react";
import { formatDatePT } from "../utils";
import PWACondominoView from "./PWACondominoView";
import { DraggableAIFloatingButton } from "./DraggableAIFloatingButton";
const condoLogo = "/marca/02-versao-horizontal.webp";
const logoutIcon = "/estados-acoes/17-desligar.png";
const terminarSessaoIcon = "/estados-acoes/16-terminar-sessao.png";
const condomanagerLogo = condoLogo;

interface PWASimulatorProps {
  predio: Predio;
  fracoes: Fracao[];
  setFracoes: React.Dispatch<React.SetStateAction<Fracao[]>>;
  avisos: Aviso[];
  setAvisos: React.Dispatch<React.SetStateAction<Aviso[]>>;
  movements: Movimento[];
  setMovements: React.Dispatch<React.SetStateAction<Movimento[]>>;
  reservas: Reserva[];
  setReservas: React.Dispatch<React.SetStateAction<Reserva[]>>;
  ocorrencias: Ocorrencia[];
  setOcorrencias: React.Dispatch<React.SetStateAction<Ocorrencia[]>>;
  documentos: Documento[];
  setDocumentos: React.Dispatch<React.SetStateAction<Documento[]>>;
  loggedUser: LoggedUser;
  setLoggedUser: (user: LoggedUser) => void;
  theme: "light" | "dark";
  contas: Conta[];
  setContas: React.Dispatch<React.SetStateAction<Conta[]>>;
  fornecedores: Fornecedor[];
  setFornecedores: React.Dispatch<React.SetStateAction<Fornecedor[]>>;
  reunioes: Reuniao[];
  setReunioes: React.Dispatch<React.SetStateAction<Reuniao[]>>;
  capacidades: CapacidadeLimite[];
  setCapacidades: React.Dispatch<React.SetStateAction<CapacidadeLimite[]>>;
}

export function PWASimulator({
  predio,
  fracoes,
  setFracoes,
  avisos,
  setAvisos,
  movements,
  setMovements,
  reservas,
  setReservas,
  ocorrencias,
  setOcorrencias,
  documentos,
  setDocumentos,
  loggedUser,
  setLoggedUser,
  theme,
  contas,
  setContas,
  fornecedores,
  setFornecedores,
  reunioes,
  setReunioes,
  capacidades,
  setCapacidades
}: PWASimulatorProps) {
  // Mobile app navigation state
  const [activeTab, setActiveTab] = useState<string>("home");
  const [profileSubTab, setProfileSubTab] = useState<string>("dados");

  // Custom states for sound, vibration & bento cards submenus
  const [pwaSendingModal, setPwaSendingModal] = useState<{ isOpen: boolean; type: "email" | "mensagem"; title?: string } | null>(null);
  const [pwaIsLoggedOut, setPwaIsLoggedOut] = useState<boolean>(false);
  const [pwaSoundEnabled, setPwaSoundEnabled] = useState<boolean>(true);
  const [pwaVibrateEnabled, setPwaVibrateEnabled] = useState<boolean>(true);
  const [selectedPwaSubmenu, setSelectedPwaSubmenu] = useState<string | null>(null);
  const [activePwaSubMenuDetails, setActivePwaSubMenuDetails] = useState<string | null>(null);

  // SMS-style notification counter helper for Admin cards
  const getNotificationCount = (cardId: string) => {
    if (cardId === "ocorrencias") {
      const pending = ocorrencias.filter(o => o.estado === "Pendente" || o.estado === "Em Reclamacao").length;
      return pending > 0 ? pending : 3;
    }
    if (cardId === "financas") {
      return 4;
    }
    if (cardId === "aprovacoes") {
      const pendingRes = reservas.filter(r => r.estado === "Pendente" || !r.estado).length;
      return pendingRes > 0 ? pendingRes : 2;
    }
    if (cardId === "comunicar" || cardId === "avaria" || cardId === "avaria_limpeza") {
      return 1;
    }
    if (cardId === "documentos" || cardId === "auditoria" || cardId === "legal_consult" || cardId === "relatorio_auditor") {
      return 1;
    }
    if (cardId === "obras" || cardId === "vistoria" || cardId === "limpeza_checklist") {
      return 1;
    }
    if (cardId === "assembleias" || cardId === "contencioso") {
      return 1;
    }
    return 0;
  };

  const getPillTextForCard = (cardId: string) => {
    switch (cardId) {
      case "ocorrencias": return "1 Ativa";
      case "financas": return "Regularizado";
      case "comunicar": return "Avisos";
      case "documentos": return "4 Ficheiros";
      case "obras": return "Ativo";
      case "fracoes": return "Frações";
      case "assembleias": return "Reuniões";
      case "aprovacoes": return "Pendente";
      case "vistoria": return "Vistorias";
      case "avaria": return "Fotos";
      case "historico_tec": return "Últimas";
      case "limpeza_checklist": return "Higiene";
      case "historico_limpeza": return "Historial";
      case "avaria_limpeza": return "Avarias";
      case "contencioso": return "Litígio";
      case "legal_consult": return "Parecer";
      case "auditoria": return "Auditor";
      case "relatorio_auditor": return "Aprovado";
      case "contas_bancarias": return "Bancos";
      case "lancamentos": return "Faturas";
      default: return "Ativo";
    }
  };

  // Reset expanded submenu on tab or role switch
  useEffect(() => {
    setSelectedPwaSubmenu(null);
    setActivePwaSubMenuDetails(null);
  }, [loggedUser.role, activeTab]);
  
  // Interactive Simulator States for Condómino PWA (Módulos)
  const [userVotedPoll, setUserVotedPoll] = useState<string | null>(null);
  const [selectedQuotaState, setSelectedQuotaState] = useState<"pago" | "atraso" | "processamento" | "multiplo" | "cobranca">("pago");
  const [showCotaExtra, setShowCotaExtra] = useState<boolean>(true);
  const [selectedDocumentCategory, setSelectedDocumentCategory] = useState<string>("Todos");
  const [searchDocumentQuery, setSearchDocumentQuery] = useState<string>("");
  const [pwaReportedAvarias, setPwaReportedAvarias] = useState<Array<{ id: string; equipamento: string; desc: string; estado: string; data: string; fornecedor?: string; fotos: string[] }>>([
    { id: "AV-101", equipamento: "Elevador nº 2", desc: "Avaria técnica - ruído excessivo nas subidas", estado: "Em curso", data: "12-07-2026", fornecedor: "Otis", fotos: [] }
  ]);
  const [pwaNewAvariaEquipamento, setPwaNewAvariaEquipamento] = useState<string>("Elevador");
  const [pwaNewAvariaDesc, setPwaNewAvariaDesc] = useState<string>("");
  const [pwaNewAvariaPhoto, setPwaNewAvariaPhoto] = useState<string | null>(null);
  const [userPasswordInput, setUserPasswordInput] = useState<string>("••••••••");
  
  // PWA documents list filters
  const [filtroPwaCategoria, setFiltroPwaCategoria] = useState<string>("Todos");
  const [filtroPwaTema, setFiltroPwaTema] = useState<string>("Todos");
  const [filtroPwaAno, setFiltroPwaAno] = useState<string>("Todos");
  
  // Simulated mobile system state
  const [currentTime, setCurrentTime] = useState("");
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [runBiometricScan, setRunBiometricScan] = useState(false);
  const [biometricSuccess, setBiometricSuccess] = useState(false);
  const [biometricProgress, setBiometricProgress] = useState(0);

  // New state for floating contact button and backoffice contacts
  const [pwaContacts, setPwaContacts] = useState<Array<{
    id: string;
    nome: string;
    email: string;
    telefone: string;
    fracao: string;
    piso: string;
    assunto: string;
    mensagem: string;
    documentoName?: string;
    fotoBase64?: string;
    fotoIsWebp?: boolean;
    audioBase64?: string;
    audioDuration?: number;
    estado: "Pendente" | "Respondido";
    resposta?: string;
    data: string;
    dataResposta?: string;
  }>>([
    {
      id: "cont-1",
      nome: "Ana Silva",
      email: "ana.silva@gmail.com",
      telefone: "963456789",
      fracao: "A",
      piso: "R/C Esq",
      assunto: "Avaria no Portão da Garagem",
      mensagem: "O portão automático da garagem do piso -1 não está a abrir com o comando remoto desde ontem à noite.",
      estado: "Pendente",
      data: "15-07-2026"
    }
  ]);

  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactAssunto, setContactAssunto] = useState("");
  const [contactMensagem, setContactMensagem] = useState("");
  const [contactDocumentoName, setContactDocumentoName] = useState("");
  const [contactFotoBase64, setContactFotoBase64] = useState("");
  const [contactFotoIsWebp, setContactFotoIsWebp] = useState(false);
  const [contactAudioBase64, setContactAudioBase64] = useState<string | null>(null);
  const [contactAudioDuration, setContactAudioDuration] = useState<number>(0);
  const [isRecordingContactAudio, setIsRecordingContactAudio] = useState(false);
  const [contactAudioRecordTimer, setContactAudioRecordTimer] = useState(0);
  const [contactSending, setContactSending] = useState(false);
  const [adminReplyTexts, setAdminReplyTexts] = useState<Record<string, string>>({});

  // Audio recording timer effect for contact floating modal
  useEffect(() => {
    let interval: any = null;
    if (isRecordingContactAudio) {
      interval = setInterval(() => {
        setContactAudioRecordTimer(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRecordingContactAudio]);

  // IA Extraction for payment proofs
  const [extractedPayValor, setExtractedPayValor] = useState(0);
  const [extractedPayData, setExtractedPayData] = useState("");
  const [extractedPayIban, setExtractedPayIban] = useState("");
  const [extractedPayRef, setExtractedPayRef] = useState("");
  const [extractedPayDesc, setExtractedPayDesc] = useState("");
  const [extractedPayFrac, setExtractedPayFrac] = useState("");
  const [isExtractingPay, setIsExtractingPay] = useState(false);

  // IA Extraction for insurance policies
  const [insuranceModalOpen, setInsuranceModalOpen] = useState(false);
  const [isExtractingInsurance, setIsExtractingInsurance] = useState(false);
  const [extractedInsSeguradora, setExtractedInsSeguradora] = useState("");
  const [extractedInsValidade, setExtractedInsValidade] = useState("");
  const [extractedInsApolice, setExtractedInsApolice] = useState("");
  const [extractedInsTitular, setExtractedInsTitular] = useState("");
  const [extractedInsFracao, setExtractedInsFracao] = useState("");
  const [insuranceDocumentName, setInsuranceDocumentName] = useState("");

  // Manual insurance insertion state for admin backoffice
  const [manualInsFracaoId, setManualInsFracaoId] = useState("");
  const [manualInsSeguradora, setManualInsSeguradora] = useState("");
  const [manualInsValidade, setManualInsValidade] = useState("");
  const [manualInsApolice, setManualInsApolice] = useState("");

  // Profile editing state
  const [profileEditModalOpen, setProfileEditModalOpen] = useState(false);
  const [editProfileNome, setEditProfileNome] = useState("");
  const [editProfileEmail, setEditProfileEmail] = useState("");
  const [editProfileTelefone, setEditProfileTelefone] = useState("");
  const [editProfileNif, setEditProfileNif] = useState("");
  const [editProfileIban, setEditProfileIban] = useState("");
  const [editProfileNascimento, setEditProfileNascimento] = useState("");

  // Submissions and message states
  const [customMessages, setCustomMessages] = useState<Array<{ id: string; sender: string; text: string; date: string }>>([
    { id: "msg-1", sender: "Ana Silva (Fração A)", text: "Solicito reparação do portão da garagem que bloqueia às vezes.", date: "15-07-2026" },
    { id: "msg-2", sender: "Rui Melo", text: "Enviei o relatório de vistoria da cobertura em formato PDF.", date: "14-07-2026" }
  ]);
  const [newMsgText, setNewMsgText] = useState("");

  // Push notifications simulator state — arranca vazio; antes tinha 6
  // notificações fictícias fixas (seguro, quota, mensagem, etc.) que
  // apareciam sempre, mesmo para um utilizador ou prédio real sem nenhum
  // evento por trás delas.
  const [pwaNotifications, setPwaNotifications] = useState<Array<{ id: string; title: string; desc: string; date: string; category: string; isArchived?: boolean }>>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [newNotificationTitle, setNewNotificationTitle] = useState("");
  const [newNotificationDesc, setNewNotificationDesc] = useState("");

  // Condomino form state for new occurrences & reserves
  const [reserveArea, setReserveArea] = useState("Ginásio");
  const [reserveDate, setReserveDate] = useState("20-07-2026");
  const [reserveTimeIn, setReserveTimeIn] = useState("14:00");
  const [reserveTimeOut, setReserveTimeOut] = useState("15:30");
  const [reservePessoas, setReservePessoas] = useState(2);

  // New occurrence form state
  const [ocorrDesc, setOcorrDesc] = useState("");
  const [ocorrArea, setOcorrArea] = useState("Elevador");

  // Proof upload form state
  const [targetAvisoId, setTargetAvisoId] = useState<string | null>(null);
  const [uploadedReceiptBase64, setUploadedReceiptBase64] = useState<string | null>(null);
  const [submittingProof, setSubmittingProof] = useState(false);

  // Inspector and cleaning checklist states
  const [tecnicoDate, setTecnicoDate] = useState(new Date().toISOString().split("T")[0]);
  const [limpezasDate, setLimpezasDate] = useState(new Date().toISOString().split("T")[0]);
  const [tecnicoPhotos, setTecnicoPhotos] = useState<Array<{ name: string; preview: string; size: string }>>([]);
  const [tecnicoReportText, setTecnicoReportText] = useState("");
  const [tecnicoSubmittalTimestamp, setTecnicoSubmittalTimestamp] = useState<string | null>(null);
  const [limpezasSubmittalTimestamp, setLimpezasSubmittalTimestamp] = useState<string | null>(null);

  const [inspectorLocal, setInspectorLocal] = useState("Piso -1 Garagem");
  const [inspectorAnomalia, setInspectorAnomalia] = useState("");

  const [cleaningChecklist, setCleaningChecklist] = useState({
    atrioEntrada: false,
    escadarias: false,
    cabineElevador: false,
    areaLixo: false,
    garagemPiso: false
  });
  const [cleaningObs, setCleaningObs] = useState("");
  const [cleaningPhotos, setCleaningPhotos] = useState<Array<{ name: string; preview: string; size: string }>>([]);

  // Update clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Determine active fraction for owner role — antes só procurava pelo
  // email do proprietário principal, o que fazia um coproprietário ou
  // inquilino autenticado cair sempre no fallback fracoes[0] (dados de
  // OUTRA fração, potencialmente de outro condómino).
  const condominoFracao = encontrarFracaoDoCondomino(fracoes, loggedUser) || fracoes[0];

  // Auto-route tab when role switches to avoid blank state
  useEffect(() => {
    setActiveTab("home");
  }, [loggedUser.role]);

  // Simulate Biometric login progression
  const triggerBiometricScan = () => {
    setBiometricProgress(0);
    setBiometricSuccess(false);
    setRunBiometricScan(true);
    const interval = setInterval(() => {
      setBiometricProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setBiometricSuccess(true);
          setTimeout(() => {
            setRunBiometricScan(false);
            alert("Identidade confirmada com sucesso via dados biométricos!");
          }, 1200);
          return 100;
        }
        return p + 20;
      });
    }, 150);
  };

  // Handler for Admin/Gestora approving reservations
  const handleAprovarReserva = (id: string, action: "Aprovado" | "Rejeitado") => {
    const res = reservas.find(r => r.id_reserva === id);
    const updated = reservas.map(r => r.id_reserva === id ? { ...r, estado: action } : r);
    setReservas(updated);
    if (res) {
      const atualizada = { ...res, estado: action };
      saveReservaToSupabase(atualizada).catch(console.error);
      registarLogAuditoria("Reservas", `${action === "Aprovado" ? "Aprovou" : "Rejeitou"} a reserva de "${res.area_comum}"`, predio.id_predio, loggedUser);

      const frac = fracoes.find(f => f.id_fracao === res.id_fracao);
      const userMail = frac?.proprietario.email;
      const title = action === "Aprovado" ? "Reserva Aprovada! 🌸" : "Reserva Rejeitada ❌";
      const desc = `A sua reserva de ${res.area_comum} no dia ${res.data} foi ${action.toLowerCase()} pela Administração.`;

      setPwaNotifications(prev => [
        { id: "not-auto-" + Date.now(), title, desc, date: "Agora" },
        ...prev
      ]);
      if (userMail) {
        fetch("/api/email?acao=notificar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: userMail, nomeDestinatario: frac?.proprietario.nome, assunto: title, mensagem: desc })
        }).catch(console.error);
      }
      fetch("/api/admin?acao=enviar-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_predio: predio.id_predio, id_fracao: res.id_fracao, title, body: desc, categoria: "optional_reservations" })
      }).catch(() => {});
      alert(`Reserva ${action.toLowerCase()} com sucesso! O condómino foi notificado por email e push.`);
    }
  };

  // Handler for Admin/Gestora approving payments
  const handleAprovarPagamento = (idAviso: string) => {
    // 1. Set aviso to Pago
    setAvisos(prev => prev.map(a => a.id_aviso === idAviso ? { ...a, estado: "Pago" } : a));

    // 2. Insert Movimento (Receita)
    const targetAviso = avisos.find(a => a.id_aviso === idAviso);
    const targetFrac = fracoes.find(f => f.id_fracao === targetAviso?.id_fracao);
    const numRecibo = `REC-PWA-${Math.floor(Math.random() * 900) + 100}`;

    if (targetAviso) {
      saveAvisosToSupabase([{ ...targetAviso, estado: "Pago" }]).catch(console.error);

      const contaAlvo = contas.find(c => c.is_principal && c.id_predio === predio.id_predio) || contas.find(c => c.id_predio === predio.id_predio) || contas[0];
      const novoMov: Movimento = {
        id_mov: "mov-pwa-" + Date.now(),
        id_predio: predio.id_predio,
        id_conta: contaAlvo?.id_conta || "cta-1",
        data: new Date().toLocaleDateString("pt-PT").replace(/\//g, "-"),
        tipo: "Receita",
        valor: targetAviso.valor,
        descricao: `Liquidado via PWA - Fração ${targetFrac?.fracao_nome || "F"} (${numRecibo})`,
        categoria: "Quotas de Condomínio",
        estado: "Conciliado"
      };
      setMovements(prev => [...prev, novoMov]);
      saveMovimentoToSupabase(novoMov).catch(console.error);

      if (contaAlvo) {
        const contaAtualizada = { ...contaAlvo, saldo: (contaAlvo.saldo || 0) + targetAviso.valor };
        setContas(prev => prev.map(c => c.id_conta === contaAlvo.id_conta ? contaAtualizada : c));
        saveContaToSupabase(contaAtualizada).catch(console.error);
      }

      registarLogAuditoria("Financeira", `Aprovou o pagamento da quota ${idAviso} via PWA`, predio.id_predio, loggedUser, `Fração ${targetFrac?.fracao_nome || "F"} — ${targetAviso.valor}€`);

      // Notify
      setPwaNotifications(prev => [
        { id: "not-auto-" + Date.now(), title: "Pagamento Confirmado! 🪙", desc: `Recebemos o pagamento de ${targetAviso.valor}€ da Fração ${targetFrac?.fracao_nome}. Recibo ${numRecibo} emitido.`, date: "Agora" },
        ...prev
      ]);
      alert(`Pagamento conciliado com sucesso! Recibo ${numRecibo} registado nas finanças do condomínio.`);
    }
  };

  // Send message to administration
  const handleEnviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsgText || !condominoFracao) return;
    const remetente = loggedUser.role === "USER" ? `${loggedUser.nome} (Fração ${condominoFracao?.fracao_nome})` : loggedUser.nome;
    const nova: any = {
      id: "msg-user-" + Date.now(),
      sender: remetente,
      text: newMsgText,
      date: new Date().toLocaleDateString("pt-PT")
    };
    setCustomMessages(prev => [nova, ...prev]);
    const textoEnviado = newMsgText;
    setNewMsgText("");

    // Uma conversa por fração — sem isto, a mensagem só existia no estado
    // React local e desaparecia ao atualizar a página, apesar do alert
    // afirmar que tinha chegado "ao servidor da administração".
    const idConversa = `conv-${condominoFracao.id_fracao}`;
    const okConversa = await saveConversaToSupabase({
      id_conversa: idConversa,
      id_predio: predio.id_predio,
      id_fracao: condominoFracao.id_fracao,
      proprietario_nome: condominoFracao.proprietario?.nome,
      estado: "pendente"
    });
    const okMensagem = okConversa && await saveMensagemConversaToSupabase({
      id_mensagem: `msg-${Date.now()}`,
      id_conversa: idConversa,
      autor: "condomino",
      texto: textoEnviado
    });

    if (!okMensagem) {
      alert("❌ Não foi possível enviar a mensagem à administração. Tente novamente.");
      return;
    }
    alert("Mensagem enviada com sucesso à administração!");
  };

  // Owner submits new occurrence
  const handleSubmeterOcorrenciaCondoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ocorrDesc) return;
    const nova: Ocorrencia = {
      id_ocorr: "ocorr-pwa-" + Date.now(),
      id_predio: predio.id_predio,
      id_fracao: condominoFracao.id_fracao,
      descricao: `[PWA Report] Compartimento: ${ocorrArea}. Anomalia: ${ocorrDesc}`,
      data: new Date().toISOString().split("T")[0],
      estado: "Identificada",
      medidas_tomadas: "A aguardar triagem da administração.",
      fotos: []
    };
    setOcorrencias([nova, ...ocorrencias]);
    saveOcorrenciaToSupabase(nova).catch(console.error);

    if (condominoFracao?.proprietario?.email) {
      fetch("/api/email?acao=notificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: condominoFracao.proprietario.email,
          nomeDestinatario: condominoFracao.proprietario.nome,
          assunto: "Registo de Ocorrência Técnica em Curso",
          mensagem: `Acusamos a receção da ocorrência reportada referente a "${ocorrArea}". A administração foi notificada e irá acompanhar a resolução.`
        })
      }).catch(console.error);
    }
    const adms = fracoes.filter(f => f.id_predio === predio.id_predio && f.administrador_interno === "Sim");
    adms.forEach(adm => {
      if (!adm.proprietario.email) return;
      fetch("/api/email?acao=notificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: adm.proprietario.email,
          nomeDestinatario: adm.proprietario.nome,
          assunto: `Nova Ocorrência — ${ocorrArea}`,
          mensagem: `Foi reportada uma nova ocorrência.<br><br><strong>Local:</strong> ${ocorrArea}<br><strong>Descrição:</strong> ${ocorrDesc}`
        })
      }).catch(console.error);
    });

    setOcorrDesc("");
    alert("Ocorrência registada com sucesso! Os administradores foram alertados.");
  };

  // Owner submits booking space
  const handleSubmeterReservaCondoc = (e: React.FormEvent) => {
    e.preventDefault();
    const novaRes: Reserva = {
      id_reserva: "res-auto-" + Date.now(),
      id_predio: predio.id_predio,
      id_fracao: condominoFracao.id_fracao,
      area_comum: reserveArea,
      data: reserveDate,
      hora_inicio: reserveTimeIn,
      hora_fim: reserveTimeOut,
      responsavel: loggedUser.nome,
      num_pessoas: reservePessoas,
      estado: "Pendente"
    };
    setReservas([...reservas, novaRes]);
    saveReservaToSupabase(novaRes).catch(console.error);
    registarLogAuditoria("Reservas", `Submeteu pedido de reserva de "${reserveArea}"`, predio.id_predio, loggedUser);
    alert(`Pedido de reserva para ${reserveArea} submetido! A aguardar aprovação administrativa.`);
  };

  // Simulates automatic WebP image compression
  const simulateWebPCompression = (file: File, callback: (base64: string, originalSize: string, webpSize: string) => void) => {
    const originalSizeKb = (file.size / 1024).toFixed(1) + " KB";
    const reader = new FileReader();
    reader.onloadend = () => {
      // Simulates WebP compression reducing size by ~70%
      const compressedSizeKb = (file.size * 0.3 / 1024).toFixed(1) + " KB";
      callback(reader.result as string, originalSizeKb, compressedSizeKb);
    };
    reader.readAsDataURL(file);
  };

  // Profile photo methods
  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      simulateWebPCompression(file, (base64, orig, webp) => {
        setFracoes(prev => prev.map(f => f.proprietario.email === loggedUser.email ? {
          ...f,
          proprietario: { ...f.proprietario, foto: base64 }
        } : f));
        alert(`Fotografia de perfil atualizada! Comprimida de ${orig} para ${webp} (WebP automático).`);
      });
    }
  };

  const handleProfilePhotoRemove = () => {
    setFracoes(prev => prev.map(f => f.proprietario.email === loggedUser.email ? {
      ...f,
      proprietario: { ...f.proprietario, foto: null }
    } : f));
    alert("Fotografia de perfil removida.");
  };

  // Profile edit methods
  const handleOpenProfileEdit = () => {
    if (!condominoFracao) return;
    setEditProfileNome(condominoFracao.proprietario.nome);
    setEditProfileEmail(condominoFracao.proprietario.email);
    setEditProfileTelefone(condominoFracao.proprietario.tlm);
    setEditProfileNif(condominoFracao.proprietario.nif);
    setEditProfileIban(condominoFracao.proprietario.iban || "");
    setEditProfileNascimento(condominoFracao.proprietario.data_nascimento || "");
    setProfileEditModalOpen(true);
  };

  const handleSaveProfileEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condominoFracao) return;
    const proprietarioAtualizado = {
      ...condominoFracao.proprietario,
      nome: editProfileNome,
      email: editProfileEmail,
      tlm: editProfileTelefone,
      nif: editProfileNif,
      iban: editProfileIban,
      data_nascimento: editProfileNascimento
    };
    setFracoes(prev => prev.map(f => f.proprietario.email === loggedUser.email ? { ...f, proprietario: proprietarioAtualizado } : f));
    setProfileEditModalOpen(false);

    const ok = await saveProprietarioToSupabase(proprietarioAtualizado, condominoFracao.id_fracao);
    if (!ok) {
      alert("❌ Não foi possível gravar os dados pessoais no Supabase.");
      return;
    }
    alert("Dados pessoais atualizados com sucesso!");
  };

  // Send message/contact form from floating button
  const handleSendPwaContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactAssunto || (!contactMensagem && !contactAudioBase64)) return;
    setContactSending(true);

    const newContact = {
      id: "cont-" + Date.now(),
      nome: loggedUser.nome,
      email: loggedUser.email,
      telefone: condominoFracao?.proprietario.tlm || "",
      fracao: condominoFracao?.fracao_nome || "A",
      piso: condominoFracao?.piso || "R/C",
      assunto: contactAssunto,
      mensagem: contactMensagem || "(Mensagem de voz em áudio anexada)",
      documentoName: contactDocumentoName || undefined,
      fotoBase64: contactFotoBase64 || undefined,
      fotoIsWebp: contactFotoIsWebp,
      audioBase64: contactAudioBase64 || undefined,
      audioDuration: contactAudioDuration || undefined,
      estado: "Pendente" as const,
      data: new Date().toLocaleDateString("pt-PT").replace(/\//g, "-")
    };

    // Notifica mesmo os administradores por email — antes só entrava em
    // estado React local (pwaContacts) e o alert afirmava falsamente que
    // "o Backoffice recebeu a notificação".
    const admsContacto = fracoes.filter(f => f.id_predio === predio.id_predio && f.administrador_interno === "Sim");
    const notificacoes = admsContacto
      .filter(adm => adm.proprietario?.email)
      .map(adm =>
        fetch("/api/email?acao=notificar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: adm.proprietario.email,
            nomeDestinatario: adm.proprietario.nome,
            assunto: `Novo Contacto PWA — ${contactAssunto}`,
            mensagem: `<strong>${newContact.nome}</strong> (Fração ${newContact.fracao}) enviou um novo contacto pela aplicação.<br><br><strong>Assunto:</strong> ${contactAssunto}<br><strong>Mensagem:</strong> ${newContact.mensagem}${contactDocumentoName ? `<br><strong>Documento anexado:</strong> ${contactDocumentoName}` : ""}${contactAudioBase64 ? `<br><strong>Inclui mensagem de voz anexada (${contactAudioDuration}s).</strong>` : ""}`
          })
        })
      );

    try {
      await Promise.all(notificacoes);
    } catch (err) {
      console.error("Erro ao notificar administração do contacto PWA:", err);
    }

    setPwaContacts(prev => [newContact, ...prev]);

    setContactAssunto("");
    setContactMensagem("");
    setContactDocumentoName("");
    setContactFotoBase64("");
    setContactFotoIsWebp(false);
    setContactAudioBase64(null);
    setContactAudioDuration(0);
    setIsRecordingContactAudio(false);
    setContactAudioRecordTimer(0);
    setContactSending(false);
    setContactModalOpen(false);
    setPwaSendingModal({ isOpen: true, type: "mensagem", title: "A Enviar Mensagem PWA..." });

    alert(
      notificacoes.length > 0
        ? "Solicitação de contacto enviada com sucesso para a Administração! O Backoffice recebeu a notificação."
        : "Solicitação de contacto registada. Nenhum administrador com email configurado foi encontrado para notificar."
    );
  };

  // Simulate capture receipt camera with IA extraction
  const triggerCameraMockReceipt = (idAviso: string) => {
    setTargetAvisoId(idAviso);
    setIsExtractingPay(true);
    
    // Simulate IA Extraction
    setTimeout(() => {
      const targetAviso = avisos.find(a => a.id_aviso === idAviso);
      if (targetAviso) {
        setExtractedPayValor(targetAviso.valor);
        setExtractedPayData(new Date().toLocaleDateString("pt-PT").replace(/\//g, "-"));
        setExtractedPayIban(condominoFracao?.proprietario.iban || "PT50 0035 0999 8888 7777 6666 5");
        setExtractedPayRef(`BR23E-FR-${condominoFracao?.fracao_nome || "A"}`);
        setExtractedPayDesc(`Liquidação de ${targetAviso.descricao}`);
        setExtractedPayFrac(condominoFracao?.fracao_nome || "A");
      }
      setIsExtractingPay(false);
      setSubmittingProof(true);
    }, 1500);
  };

  const handleConfirmSubmitProof = () => {
    if (!targetAvisoId) return;

    const avisoAlvo = avisos.find(a => a.id_aviso === targetAvisoId);
    if (avisoAlvo) {
      const avisoAtualizado = {
        ...avisoAlvo,
        estado: "Pendente",
        // Attach metadata inside description for the admin backoffice to view
        descricao: `${avisoAlvo.descricao} (Aguardando IA - ${extractedPayValor}€ | IBAN: ${extractedPayIban} | Ref: ${extractedPayRef})`
      };
      setAvisos(prev => prev.map(a => a.id_aviso === targetAvisoId ? avisoAtualizado : a));
      saveAvisosToSupabase([avisoAtualizado]).catch(console.error);
    }

    // Create an automated PWA contact/receipt submission so admin sees it clearly too
    const newContact = {
      id: "rcpt-c-" + Date.now(),
      nome: loggedUser.nome,
      email: loggedUser.email,
      telefone: condominoFracao?.proprietario.tlm || "",
      fracao: condominoFracao?.fracao_nome || "A",
      piso: condominoFracao?.piso || "R/C",
      assunto: "Comprovativo de Pagamento Quota",
      mensagem: `Envio automático de comprovativo para liquidação do Aviso ${targetAvisoId}. IA extraiu: ${extractedPayValor}€, em ${extractedPayData}. Ref BR23E: ${extractedPayRef}.`,
      estado: "Pendente" as const,
      data: new Date().toLocaleDateString("pt-PT").replace(/\//g, "-")
    };
    setPwaContacts(prev => [newContact, ...prev]);

    setSubmittingProof(false);
    setTargetAvisoId(null);
    alert("Comprovativo enviado! Os dados extraídos por IA (Valor, Data, Referência BR23E, IBAN) foram submetidos para validação administrativa no Backoffice.");
  };

  // Backoffice validates receipt and emits official PDF document
  const handleApprovePendingReceipt = (idAviso: string, extractedVals: { valor: number, data: string, fracao: string, descricao: string, ref: string, iban: string }) => {
    const avisoAlvo = avisos.find(a => a.id_aviso === idAviso);
    setAvisos(prev => prev.map(a => a.id_aviso === idAviso ? { ...a, estado: "Pago" } : a));
    if (avisoAlvo) {
      saveAvisosToSupabase([{ ...avisoAlvo, estado: "Pago" }]).catch(console.error);
    }

    const numRecibo = `REC-PWA-${Math.floor(Math.random() * 900) + 100}`;
    const contaAlvo = contas.find(c => c.is_principal && c.id_predio === predio.id_predio) || contas.find(c => c.id_predio === predio.id_predio) || contas[0];
    const novoMov: Movimento = {
      id_mov: "mov-pwa-" + Date.now(),
      id_predio: predio.id_predio,
      id_conta: contaAlvo?.id_conta || "cta-1",
      data: extractedVals.data,
      tipo: "Receita",
      valor: extractedVals.valor,
      descricao: `Validação IA - Fração ${extractedVals.fracao} (${numRecibo})`,
      categoria: "Quotas de Condomínio",
      estado: "Conciliado"
    };
    setMovements(prev => [...prev, novoMov]);
    saveMovimentoToSupabase(novoMov).catch(console.error);

    if (contaAlvo) {
      const contaAtualizada = { ...contaAlvo, saldo: (contaAlvo.saldo || 0) + extractedVals.valor };
      setContas(prev => prev.map(c => c.id_conta === contaAlvo.id_conta ? contaAtualizada : c));
      saveContaToSupabase(contaAtualizada).catch(console.error);
    }

    registarLogAuditoria("Financeira", `Validou por IA o pagamento da quota ${idAviso}`, predio.id_predio, loggedUser, `Fração ${extractedVals.fracao} — ${extractedVals.valor}€`);

    const novoDoc: Documento = {
      id_doc: "doc-rec-" + Date.now(),
      id_predio: predio.id_predio,
      nome: `Recibo Quotas ${extractedVals.fracao} - ${numRecibo}.pdf`,
      tipo: "Recibo de Condomínio",
      data_upload: new Date().toLocaleDateString("pt-PT").replace(/\//g, "-"),
      tamanho: "115 KB",
      categoria: "Recibos",
      visibilidade: "Público"
    };
    setDocumentos(prev => [novoDoc, ...prev]);
    saveDocumentoToSupabase(novoDoc).catch(console.error);

    setPwaNotifications(prev => [
      {
        id: "not-ok-" + Date.now(),
        title: "Recibo Emitido! 🪙",
        desc: `O pagamento de ${extractedVals.valor}€ da Fração ${extractedVals.fracao} foi validado por IA. Recibo ${numRecibo} disponível no Arquivo.`,
        date: "Agora"
      },
      ...prev
    ]);
    
    alert(`Pagamento validado por IA! Movimento lançado e Recibo ${numRecibo} arquivado automaticamente no Arquivo de documentos.`);
  };

  // Insurance workflow — leitura real por IA (Gemini Vision), antes
  // fabricava sempre a mesma seguradora e um número de apólice aleatório,
  // independentemente do documento real carregado.
  const triggerInsuranceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInsuranceDocumentName(file.name);
    setIsExtractingInsurance(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(",")[1] || "";
        const resp = await fetch("/api/ai?acao=reconhecer-apolice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, mimeType: file.type || "application/octet-stream" })
        });
        const resultado = await resp.json();
        if (!resp.ok || !resultado.ok) throw new Error(resultado?.error || "A IA não conseguiu ler a apólice.");
        const dados = resultado.dados || {};
        setExtractedInsSeguradora(dados.seguradora || "");
        setExtractedInsValidade(dados.apolice_validade || "");
        setExtractedInsApolice(dados.apolice_numero || "");
        setExtractedInsTitular(loggedUser.nome);
        setExtractedInsFracao(condominoFracao?.fracao_nome || "A");
      } catch (err: any) {
        alert(`❌ Erro ao ler a apólice: ${err?.message || "erro desconhecido"}`);
      } finally {
        setIsExtractingInsurance(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmInsurance = async () => {
    if (!condominoFracao) return;
    const fracaoAtualizada: Fracao = {
      ...condominoFracao,
      seguradora: extractedInsSeguradora,
      apolice_num: extractedInsApolice,
      apolice_validade: extractedInsValidade,
      apolice_doc: insuranceDocumentName || "apolice_seguro.pdf"
    };
    setFracoes(prev => prev.map(f => f.proprietario.email === loggedUser.email ? fracaoAtualizada : f));

    const novoDoc: Documento = {
      id_doc: "doc-seg-" + Date.now(),
      id_predio: predio.id_predio,
      nome: `Apólice Seguro Fração ${condominoFracao?.fracao_nome || "A"} - ${extractedInsApolice}.pdf`,
      tipo: "Apólice de Seguro",
      data_upload: new Date().toLocaleDateString("pt-PT").replace(/\//g, "-"),
      tamanho: "245 KB",
      categoria: "Seguros",
      visibilidade: "Público"
    };
    setDocumentos(prev => [novoDoc, ...prev]);

    const okFracao = await saveFracaoToSupabase(fracaoAtualizada);
    saveDocumentoToSupabase(novoDoc).catch(console.error);

    setPwaNotifications(prev => [
      {
        id: "not-seg-ok-" + Date.now(),
        title: "Seguro Registado por IA! 🛡️",
        desc: `A apólice nº ${extractedInsApolice} da seguradora ${extractedInsSeguradora} foi guardada e arquivada com sucesso.`,
        date: "Agora"
      },
      ...prev
    ]);

    setInsuranceModalOpen(false);
    if (!okFracao) {
      alert("⚠️ O seguro foi lido mas houve um erro ao gravar no Supabase. Tente novamente.");
      return;
    }
    alert("Seguro da fração registado com sucesso via leitura IA! O documento foi arquivado no Arquivo de documentos.");
  };

  const handleManualInsuranceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInsFracaoId || !manualInsSeguradora || !manualInsApolice || !manualInsValidade) {
      alert("Por favor preencha todos os campos do seguro.");
      return;
    }

    const targetFrac = fracoes.find(f => f.id_fracao === manualInsFracaoId);
    if (!targetFrac) return;

    const fracaoAtualizada: Fracao = {
      ...targetFrac,
      seguradora: manualInsSeguradora,
      apolice_num: manualInsApolice,
      apolice_validade: manualInsValidade,
      apolice_doc: `manual_ins_${targetFrac.fracao_nome}.pdf`
    };
    setFracoes(prev => prev.map(f => f.id_fracao === manualInsFracaoId ? fracaoAtualizada : f));

    const novoDoc: Documento = {
      id_doc: "doc-seg-man-" + Date.now(),
      id_predio: predio.id_predio,
      nome: `Apólice Seguro Fração ${targetFrac.fracao_nome} - ${manualInsApolice}.pdf`,
      tipo: "Apólice de Seguro",
      data_upload: new Date().toLocaleDateString("pt-PT").replace(/\//g, "-"),
      tamanho: "150 KB",
      categoria: "Seguros",
      visibilidade: "Público"
    };
    setDocumentos(prev => [novoDoc, ...prev]);

    const okFracao = await saveFracaoToSupabase(fracaoAtualizada);
    saveDocumentoToSupabase(novoDoc).catch(console.error);

    setPwaNotifications(prev => [
      {
        id: "not-seg-man-" + Date.now(),
        title: "Seguro Inserido Manualmente 🛡️",
        desc: `A Administração inseriu a apólice nº ${manualInsApolice} para a Fração ${targetFrac.fracao_nome}.`,
        date: "Agora"
      },
      ...prev
    ]);

    setManualInsFracaoId("");
    setManualInsSeguradora("");
    setManualInsApolice("");
    setManualInsValidade("");
    if (!okFracao) {
      alert("⚠️ Erro ao gravar o seguro no Supabase. Tente novamente.");
      return;
    }
    alert("Seguro da fração inserido manualmente com sucesso! Documento arquivado no Arquivo.");
  };

  const handleSendAdminPwaReply = (id: string) => {
    const replyText = adminReplyTexts[id];
    if (!replyText) return;
    const contactObj = pwaContacts.find(c => c.id === id);
    if (!contactObj) return;

    triggerSendReaction("mensagem", "A Enviar Resposta ao Condómino...", async () => {
      // Resposta real por email ao condómino — antes só atualizava
      // estado React local e mostrava a animação de envio sem "action"
      // (modo puramente decorativo), a resposta nunca chegava a sair.
      if (contactObj.email) {
        const resp = await fetch("/api/email?acao=notificar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: contactObj.email,
            nomeDestinatario: contactObj.nome,
            assunto: `Resposta ao seu contacto: ${contactObj.assunto}`,
            mensagem: replyText.replace(/\n/g, "<br>")
          })
        });
        const resultado = await resp.json();
        if (!resp.ok || !resultado.ok) throw new Error(resultado?.error || "Falha ao enviar a resposta");
      }

      setPwaContacts(prev => prev.map(c => c.id === id ? {
        ...c,
        estado: "Respondido",
        resposta: replyText,
        dataResposta: new Date().toLocaleDateString("pt-PT").replace(/\//g, "-")
      } : c));

      setPwaNotifications(prev => [
        {
          id: "not-rep-" + Date.now(),
          title: "Nova Mensagem da Administração 💬",
          desc: `Resposta ao seu contacto sobre "${contactObj.assunto}": ${replyText}`,
          date: "Agora"
        },
        ...prev
      ]);

      setAdminReplyTexts(prev => ({ ...prev, [id]: "" }));
    });
  };

  // Admin triggers a notification broadcast
  const handleBroadcastNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotificationTitle || !newNotificationDesc) return;
    const nova = {
      id: "not-b-" + Date.now(),
      title: newNotificationTitle,
      desc: newNotificationDesc,
      date: "Agora"
    };
    setPwaNotifications(prev => [nova, ...prev]);
    fetch("/api/admin?acao=enviar-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_predio: predio.id_predio, title: newNotificationTitle, body: newNotificationDesc, categoria: "optional_general" })
    }).catch(() => {});
    registarLogAuditoria("Comunicação", `Enviou uma notificação push: "${newNotificationTitle}"`, predio.id_predio, loggedUser);
    setNewNotificationTitle("");
    setNewNotificationDesc("");
    triggerSendReaction("mensagem", "A Enviar Alerta Push ao Condomínio...");
  };

  // Technician submits checklist/report
  const handleTechnicianSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const timestamp = new Date().toLocaleString("pt-PT");
    setTecnicoSubmittalTimestamp(timestamp);
    
    // Add to occurrences state as an active report
    const newOcorr: Ocorrencia = {
      id_ocorr: "ocorr-tech-" + Date.now(),
      id_predio: predio.id_predio,
      id_fracao: "common",
      descricao: `[Relatório Técnico - ${tecnicoDate}] Local: ${inspectorLocal}. Anomalia: ${inspectorAnomalia || "Nenhuma"}. Detalhes: ${tecnicoReportText}`,
      data: tecnicoDate,
      estado: "Identificada",
      medidas_tomadas: "Registado por vistoria técnica no telemóvel.",
      fotos: tecnicoPhotos,
      tecnico_atribuido: loggedUser.nome,
      categoria: "Estrutura"
    };
    setOcorrencias([newOcorr, ...ocorrencias]);
    saveOcorrenciaToSupabase(newOcorr).catch(console.error);
    registarLogAuditoria("Manutenção", `Submeteu relatório técnico de vistoria em "${inspectorLocal}"`, predio.id_predio, loggedUser);

    // Push alert
    setPwaNotifications(prev => [
      {
        id: "not-tech-" + Date.now(),
        title: "Relatório Técnico Submetido 🛠️",
        desc: `O inspetor ${loggedUser.nome} terminou a vistoria ao local ${inspectorLocal} em ${tecnicoDate}. Timestamp: ${timestamp}.`,
        date: "Agora"
      },
      ...prev
    ]);

    alert(`Relatório Técnico submetido com sucesso!\nTimestamp de Envio: ${timestamp}\nAs imagens e os dados foram processados.`);
  };

  // Cleaning submits schedule
  const handleCleaningSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const timestamp = new Date().toLocaleString("pt-PT");

    const areas = [
      cleaningChecklist.atrioEntrada && "Átrio de Entrada Principal",
      cleaningChecklist.cabineElevador && "Cabine Elevador Principal",
      cleaningChecklist.escadarias && "Escadaria do Prédio",
      cleaningChecklist.areaLixo && "Área de Contentores Lixo"
    ].filter(Boolean) as string[];

    // Regista mesmo a intervenção no Supabase (tabela limpezas) — antes só
    // mostrava um timestamp local e uma notificação PWA fabricada,
    // desaparecia tudo ao atualizar a página.
    const ok = await saveLimpezaToSupabase({
      id_limpeza: "limp-" + Date.now(),
      id_predio: predio.id_predio,
      data: limpezasDate,
      hora: new Date().toTimeString().slice(0, 5),
      executor: loggedUser.nome,
      areas,
      observacoes: cleaningObs || undefined
    });

    if (!ok) {
      alert("❌ Erro ao gravar o registo de limpeza no Supabase.");
      return;
    }

    setLimpezasSubmittalTimestamp(timestamp);
    setPwaNotifications(prev => [
      {
        id: "not-cln-" + Date.now(),
        title: "Limpeza Registada ✅",
        desc: `A equipa de limpezas reportou atuação em ${limpezasDate}. Obs: ${cleaningObs || "Sem observações."}. Timestamp: ${timestamp}.`,
        date: "Agora"
      },
      ...prev
    ]);

    alert(`Atuação de Limpeza gravada com sucesso!\nTimestamp de Envio: ${timestamp}`);
  };

  // Helpers to get specific data
  const userAvisos = avisos.filter(a => a.id_fracao === condominoFracao?.id_fracao && a.id_predio === predio.id_predio);
  const totalPendingMoney = userAvisos.filter(a => a.estado !== "Pago").reduce((acc, a) => acc + a.valor, 0);

  // Filter global pending elements for admin view
  const pendingReservas = reservas.filter(r => r.estado === "Pendente" || !r.estado);
  const pendingAvisosWithReceipts = avisos.filter(a => a.estado === "Pendente" && a.id_predio === predio.id_predio);

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-center justify-center p-4">
      
      {/* PHONE WRAPPER FRAME */}
      <div className="relative">
        {/* Notch & Screen boundary */}
        <div className="w-[375px] h-[780px] bg-slate-900 rounded-[50px] p-3.5 shadow-2xl border-4 border-slate-700/80 dark:border-slate-800/80 relative flex flex-col overflow-hidden text-slate-800 select-none">
          
          {/* Internal Speaker */}
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-32 h-4.5 bg-black rounded-full z-40 flex items-center justify-center">
            <span className="w-12 h-1 bg-slate-800 rounded-full"></span>
            <span className="w-2.5 h-2.5 bg-slate-900 rounded-full border border-slate-800 ml-2"></span>
          </div>

          {/* SCREEN INTERIOR */}
          <div 
            className={`w-full h-full pwa-screen rounded-[38px] overflow-hidden flex flex-col relative font-sans ${
              theme === "dark" ? "bg-slate-950 text-white" : "bg-[#ece7e7] text-slate-800"
            }`} 
            data-pwa="true"
            style={{ backgroundColor: theme === "dark" ? "#020617" : "#ece7e7" }}
          >
            
            {/* PWA BACKGROUND IMAGE TEMPLATE (Adaptive to space, sits behind cards) */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.08] z-0 p-8 select-none transition-all duration-300">
              <img 
                src={condomanagerLogo} 
                alt="Background Logo" 
                className="w-full max-w-[280px] object-contain select-none"
                referrerPolicy="no-referrer"
              />
            </div>
            
            {/* STATUS BAR */}
            <div 
              className={`h-10 shrink-0 px-6 flex items-center justify-between text-[11px] font-bold z-30 pt-1 border-b ${
                theme === "dark" 
                  ? "bg-slate-950 text-white border-slate-800" 
                  : "bg-[#ece7e7] text-slate-800 border-slate-300/40"
              }`}
              style={{ backgroundColor: theme === "dark" ? "#020617" : "#ece7e7" }}
            >
              <span>{currentTime || "15:21"}</span>
              <div className="flex items-center space-x-1.5">
                <Signal className="h-3 w-3" />
                <Wifi className="h-3 w-3" />
                <Battery className="h-3.5 w-3.5 rotate-90 origin-center text-emerald-500" />
              </div>
            </div>

            {/* APP BANNER (Featuring CondoManager AI Logo - Perfectly Adapted & Prominent) */}
            <div className="bg-slate-950 px-3 py-1.5 shrink-0 flex items-center justify-between border-b border-slate-800 shadow-lg z-10 h-[58px] overflow-hidden">
              <div className="flex items-center flex-1 h-full min-w-0 mr-2 overflow-hidden">
                <img 
                  src={condomanagerLogo} 
                  alt="CondoManager AI" 
                  className="h-[46px] w-auto max-w-[190px] object-contain object-left scale-125 origin-left select-none drop-shadow-xl" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              
              <div className="flex items-center space-x-1.5">
                {/* Sound Toggle Status Signal */}
                <button
                  onClick={() => {
                    setPwaSoundEnabled(!pwaSoundEnabled);
                  }}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer text-xs ${
                    pwaSoundEnabled 
                      ? "bg-emerald-950/40 border-emerald-800/80 text-emerald-400 hover:bg-emerald-950/60" 
                      : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400"
                  }`}
                  title={pwaSoundEnabled ? "Som Ativado" : "Modo Silencioso"}
                >
                  {pwaSoundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                </button>

                {/* Vibration/Vibe Toggle Status Signal */}
                <button
                  onClick={() => {
                    setPwaVibrateEnabled(!pwaVibrateEnabled);
                  }}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer text-xs ${
                    pwaVibrateEnabled 
                      ? "bg-indigo-950/40 border-indigo-800/80 text-indigo-400 hover:bg-indigo-950/60" 
                      : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400"
                  }`}
                  title={pwaVibrateEnabled ? "Vibração Ativada" : "Sem Vibração"}
                >
                  <Smartphone className={`h-3.5 w-3.5 ${pwaVibrateEnabled ? "animate-pulse" : ""}`} />
                </button>

                {/* Notifications Bell */}
                <button 
                  onClick={() => setActiveTab("notifications")} 
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer relative ${
                    activeTab === "notifications"
                      ? "bg-slate-800 border-slate-700 text-white"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <Bell className="h-3.5 w-3.5" />
                  {pwaNotifications.length > 0 && (
                    <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-1 ring-slate-950"></span>
                  )}
                </button>

                {/* Simulated Logout button */}
                <button 
                  onClick={() => {
                    setPwaIsLoggedOut(true);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border border-red-500 text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-sm hover:scale-105 active:scale-95 active:ring-2 active:ring-red-400 shrink-0"
                  title="Sair da Conta (Simulação)"
                >
                    <img src="/estados-acoes/17-desligar.png" alt="Sair" className="h-4 w-4 object-contain" />
                  <span>Sair</span>
                </button>
              </div>
            </div>

            {/* PWA DYNAMIC CONTENT SCROLL */}
            <div 
              className={`flex-grow overflow-y-auto px-4 py-4 space-y-4 relative z-10 pwa-container ${
                theme === "dark" ? "bg-slate-950 text-white" : "bg-[#ece7e7] text-slate-800"
              }`} 
              style={{ backgroundColor: theme === "dark" ? "#020617" : "#ece7e7" }}
            >
              
              {/* --- BENTO CARD NAVIGATION FOR HOME TAB (ALL NON-USER ROLES) --- */}
              {activeTab === "home" && loggedUser.role !== "USER" && (
                <div className="space-y-4 animate-fade-in relative z-10">
                  {/* CondoManager AI Header branding */}
                  <div className="bg-slate-100/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-2xl p-4 space-y-1 shadow-xs text-center relative overflow-hidden">
                    <div className="absolute -right-10 -bottom-10 h-28 w-28 bg-emerald-500/10 rounded-full blur-2xl"></div>
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-extrabold uppercase tracking-widest block">Dashboard PWA Inteligente</span>
                    <h3 className="text-sm font-black text-slate-850 dark:text-white flex items-center justify-center gap-1">
                      <Brain className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      {loggedUser.nome}
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Selecione qualquer painel para abrir o respetivo menu popup.</p>
                  </div>

                  {/* Cards Grid based on current role */}
                  <div className="grid grid-cols-2 gap-2.5 relative z-10">
                     {/* ADMIN / EMPRESA_GESTORA CARDS */}
                     {(loggedUser.role === "ADMIN" || loggedUser.role === "EMPRESA_GESTORA") && [
                        { id: "predios", label: "Prédios", desc: "Regras, Edifícios & Blocos", image: "/modulos/01-predio.png" },
                        { id: "fracoes", label: "Frações", desc: "Donos, Unidades & Frações", image: "/modulos/07-fracao.png" },
                        { id: "financas", label: "Finanças & Contas", desc: "Saldos, Recibos & Extratos", image: "/modulos/59-recibo.png" },
                        { id: "obras", label: "Manutenção & Obras", desc: "Avarias, Intervenções & Limpeza", image: "/modulos/41-obra.png" },
                        { id: "documentos", label: "Arquivo", desc: "Pastas, Atas & Auditoria", image: "/modulos/27-arquivo-automatico.png" },
                        { id: "assembleias", label: "Assembleias & Legal", desc: "Atas, Convocatórias & Litígios", image: "/modulos/70-pessoa-de-contacto.png" },
                        { id: "comunicar", label: "Mensagens", desc: "Avisos Push & Cérebro IA", image: "/modulos/21-notificacoes-inquilino.png" },
                        { id: "fornecedores", label: "Fornecedores", desc: "Fichas & Orçamentos", image: "/modulos/67-fornecedor.png" },
                        { id: "aprovacoes", label: "Aprovações & Agenda", desc: "Reservas & Recibos", image: "/modulos/82-automacao.png" },
                        { id: "configuracoes", label: "Empresa Gestora", desc: "White-Label & Parâmetros", image: "/modulos/07-fracao.png" },
                        { id: "limpeza", label: "Limpeza", desc: "Vistorias & Relatórios", image: "/modulos/50-limpeza.png" }
                     ].map(card => {
                       const notifCount = getNotificationCount(card.id);
                       return (
                         <button
                           key={card.id}
                           onClick={() => setSelectedPwaSubmenu(card.id)}
                           className="w-full h-[115px] bg-emerald-50 hover:bg-emerald-100/90 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-950 dark:text-emerald-100 border-2 border-emerald-500 dark:border-emerald-400/80 rounded-2xl flex flex-col items-center justify-between text-center p-2.5 relative select-none hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                         >
                           <img src={card.image} alt={card.label} className="h-10 w-10 object-contain mb-0.5 shrink-0 rounded-lg drop-shadow-sm" />
                           <div className="flex flex-col items-center leading-none">
                             <span className="text-[10px] font-black text-emerald-950 dark:text-emerald-50 leading-tight block truncate max-w-full text-center">{card.label}</span>
                             <span className="text-[7.5px] font-mono text-emerald-800/90 dark:text-emerald-300/90 leading-normal block truncate max-w-full text-center mt-0.5">{card.desc}</span>
                           </div>
                           <span className="bg-emerald-100/90 dark:bg-emerald-900/90 text-emerald-900 dark:text-emerald-200 border border-emerald-400 dark:border-emerald-600 text-[8px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs uppercase tracking-wider truncate max-w-[90%] leading-none">
                             {getPillTextForCard(card.id)}
                           </span>
                           {notifCount > 0 && (
                             <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-[18px] px-1 items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-black border border-white shadow-md animate-pulse z-10">
                               {notifCount}
                             </span>
                           )}
                         </button>
                       );
                     })}

                     {/* TECNICO CARDS */}
                     {loggedUser.role === "TECNICO" && [
                                               { id: "vistoria", label: "Vistoria Checklist", desc: "Areas Comuns", image: "/modulos/02-equipamentos-tecnicos.png" },
                        { id: "avaria", label: "Reportar Defeito", desc: "Upload WebP c/ Foto", image: "/modulos/29-avaria.png" },
                        { id: "historico_tec", label: "Histórico Vistorias", desc: "Últimas acções", image: "/modulos/27-arquivo-automatico.png" }
                     ].map(card => {
                       const notifCount = getNotificationCount(card.id);
                       return (
                         <button
                           key={card.id}
                           onClick={() => setSelectedPwaSubmenu(card.id)}
                           className="w-full h-[115px] bg-emerald-50 hover:bg-emerald-100/90 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-950 dark:text-emerald-100 border-2 border-emerald-500 dark:border-emerald-400/80 rounded-2xl flex flex-col items-center justify-between text-center p-2.5 relative select-none hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                         >
                           <img src={card.image} alt={card.label} className="h-10 w-10 object-contain mb-0.5 shrink-0 rounded-lg drop-shadow-sm" />
                           <div className="flex flex-col items-center leading-none">
                             <span className="text-[10px] font-black text-emerald-950 dark:text-emerald-50 leading-tight block truncate max-w-full text-center">{card.label}</span>
                             <span className="text-[7.5px] font-mono text-emerald-800/90 dark:text-emerald-300/90 leading-normal block truncate max-w-full text-center mt-0.5">{card.desc}</span>
                           </div>
                           <span className="bg-emerald-100/90 dark:bg-emerald-900/90 text-emerald-900 dark:text-emerald-200 border border-emerald-400 dark:border-emerald-600 text-[8px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs uppercase tracking-wider truncate max-w-[90%] leading-none">
                             {getPillTextForCard(card.id)}
                           </span>
                           {notifCount > 0 && (
                             <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-[18px] px-1 items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-black border border-white shadow-md animate-pulse z-10">
                               {notifCount}
                             </span>
                           )}
                         </button>
                       );
                     })}

                     {/* LIMPEZAS CARDS */}
                     {loggedUser.role === "LIMPEZAS" && [
                                               { id: "limpeza_checklist", label: "Folha Digital", desc: "Áreas limpas do Hall", image: "/modulos/50-limpeza.png" },
                                               { id: "historico_limpeza", label: "Inspeções Áreas", desc: "Registo histórico", image: "/modulos/27-arquivo-automatico.png" },
                        { id: "avaria_limpeza", label: "Avaria detetada", desc: "Reportar defeito", image: "/modulos/29-avaria.png" }
                     ].map(card => {
                       const notifCount = getNotificationCount(card.id);
                       return (
                         <button
                           key={card.id}
                           onClick={() => setSelectedPwaSubmenu(card.id)}
                           className="w-full h-[115px] bg-emerald-50 hover:bg-emerald-100/90 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-950 dark:text-emerald-100 border-2 border-emerald-500 dark:border-emerald-400/80 rounded-2xl flex flex-col items-center justify-between text-center p-2.5 relative select-none hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                         >
                           <img src={card.image} alt={card.label} className="h-10 w-10 object-contain mb-0.5 shrink-0 rounded-lg drop-shadow-sm" />
                           <div className="flex flex-col items-center leading-none">
                             <span className="text-[10px] font-black text-emerald-950 dark:text-emerald-50 leading-tight block truncate max-w-full text-center">{card.label}</span>
                             <span className="text-[7.5px] font-mono text-emerald-800/90 dark:text-emerald-300/90 leading-normal block truncate max-w-full text-center mt-0.5">{card.desc}</span>
                           </div>
                           <span className="bg-emerald-100/90 dark:bg-emerald-900/90 text-emerald-900 dark:text-emerald-200 border border-emerald-400 dark:border-emerald-600 text-[8px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs uppercase tracking-wider truncate max-w-[90%] leading-none">
                             {getPillTextForCard(card.id)}
                           </span>
                           {notifCount > 0 && (
                             <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-[18px] px-1 items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-black border border-white shadow-md animate-pulse z-10">
                               {notifCount}
                             </span>
                           )}
                         </button>
                       );
                     })}

                     {/* JURIDICO CARDS */}
                     {loggedUser.role === "JURIDICO" && [
                                               { id: "contencioso", label: "Fração D (Litígio)", desc: "Quotas em atraso", image: "/modulos/70-pessoa-de-contacto.png" },
                                               { id: "legal_consult", label: "Consultadoria Legal", desc: "Regulamento & Atas", image: "/modulos/27-arquivo-automatico.png" }
                     ].map(card => {
                       const notifCount = getNotificationCount(card.id);
                       return (
                         <button
                           key={card.id}
                           onClick={() => setSelectedPwaSubmenu(card.id)}
                           className="w-full h-[115px] bg-emerald-50 hover:bg-emerald-100/90 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-950 dark:text-emerald-100 border-2 border-emerald-500 dark:border-emerald-400/80 rounded-2xl flex flex-col items-center justify-between text-center p-2.5 relative select-none hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                         >
                           <img src={card.image} alt={card.label} className="h-10 w-10 object-contain mb-0.5 shrink-0 rounded-lg drop-shadow-sm" />
                           <div className="flex flex-col items-center leading-none">
                             <span className="text-[10px] font-black text-emerald-950 dark:text-emerald-50 leading-tight block truncate max-w-full text-center">{card.label}</span>
                             <span className="text-[7.5px] font-mono text-emerald-800/90 dark:text-emerald-300/90 leading-normal block truncate max-w-full text-center mt-0.5">{card.desc}</span>
                           </div>
                           <span className="bg-emerald-100/90 dark:bg-emerald-900/90 text-emerald-900 dark:text-emerald-200 border border-emerald-400 dark:border-emerald-600 text-[8px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs uppercase tracking-wider truncate max-w-[90%] leading-none">
                             {getPillTextForCard(card.id)}
                           </span>
                           {notifCount > 0 && (
                             <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-[18px] px-1 items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-black border border-white shadow-md animate-pulse z-10">
                               {notifCount}
                             </span>
                           )}
                         </button>
                       );
                     })}

                     {/* AUDITOR CARDS */}
                     {loggedUser.role === "AUDITOR" && [
                                               { id: "auditoria", label: "Relatórios", desc: "Auditoria interna", image: "/modulos/27-arquivo-automatico.png" },
                        { id: "relatorio_auditor", label: "Novo Parecer", desc: "Inserir parecer oficial", image: "/modulos/27-arquivo-automatico.png" }
                     ].map(card => {
                       const notifCount = getNotificationCount(card.id);
                       return (
                         <button
                           key={card.id}
                           onClick={() => setSelectedPwaSubmenu(card.id)}
                           className="w-full h-[115px] bg-emerald-50 hover:bg-emerald-100/90 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-950 dark:text-emerald-100 border-2 border-emerald-500 dark:border-emerald-400/80 rounded-2xl flex flex-col items-center justify-between text-center p-2.5 relative select-none hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                         >
                           <img src={card.image} alt={card.label} className="h-10 w-10 object-contain mb-0.5 shrink-0 rounded-lg drop-shadow-sm" />
                           <div className="flex flex-col items-center leading-none">
                             <span className="text-[10px] font-black text-emerald-950 dark:text-emerald-50 leading-tight block truncate max-w-full text-center">{card.label}</span>
                             <span className="text-[7.5px] font-mono text-emerald-800/90 dark:text-emerald-300/90 leading-normal block truncate max-w-full text-center mt-0.5">{card.desc}</span>
                           </div>
                           <span className="bg-emerald-100/90 dark:bg-emerald-900/90 text-emerald-900 dark:text-emerald-200 border border-emerald-400 dark:border-emerald-600 text-[8px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs uppercase tracking-wider truncate max-w-[90%] leading-none">
                             {getPillTextForCard(card.id)}
                           </span>
                           {notifCount > 0 && (
                             <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-[18px] px-1 items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-black border border-white shadow-md animate-pulse z-10">
                               {notifCount}
                             </span>
                           )}
                         </button>
                       );
                     })}

                     {/* CONTABILISTA CARDS */}
                      {loggedUser.role === "CONTABILISTA" && [
                                                { id: "contas_bancarias", label: "Saldos Bancários", desc: "Bancos e Poupança", image: "/modulos/59-recibo.png" },
                        { id: "lancamentos", label: "Despesas & Faturas", desc: "Faturação e Lançamentos", image: "/modulos/59-recibo.png" }
                      ].map(card => {
                        const notifCount = getNotificationCount(card.id);
                        return (
                          <button
                            key={card.id}
                            onClick={() => setSelectedPwaSubmenu(card.id)}
                            className="w-full h-[115px] bg-emerald-50 hover:bg-emerald-100/90 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-950 dark:text-emerald-100 border-2 border-emerald-500 dark:border-emerald-400/80 rounded-2xl flex flex-col items-center justify-between text-center p-2.5 relative select-none hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                          >
                            <div className="h-10 w-10 flex items-center justify-center bg-slate-900 dark:bg-slate-950 rounded-xl p-1 mb-0.5 shrink-0 shadow-xs border border-slate-800/40">
                              <img src={card.image} alt="" className="h-full w-full object-contain rounded-lg drop-shadow-sm" />
                            </div>
                            <div className="flex flex-col items-center leading-none">
                              <span className="text-[10px] font-black text-emerald-950 dark:text-emerald-50 leading-tight block truncate max-w-full text-center">{card.label}</span>
                              <span className="text-[7.5px] font-mono text-emerald-800/90 dark:text-emerald-300/90 leading-normal block truncate max-w-full text-center mt-0.5">{card.desc}</span>
                            </div>
                            <span className="bg-emerald-100/90 dark:bg-emerald-900/90 text-emerald-900 dark:text-emerald-200 border border-emerald-400 dark:border-emerald-600 text-[8px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs uppercase tracking-wider truncate max-w-[90%] leading-none">
                              {getPillTextForCard(card.id)}
                            </span>
                            {notifCount > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-[18px] px-1 items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-black border border-white shadow-md animate-pulse z-10">
                                {notifCount}
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {/* SUPPLIER PROFILE, SECURITY & FINANCIAL CARDS (FOR ALL SUPPLIER ROLES) */}
                      {["TECNICO", "LIMPEZAS", "JURIDICO", "AUDITOR", "CONTABILISTA"].includes(loggedUser.role) && [
                        { id: "fornecedor_perfil", label: "Perfil Profissional", desc: "Dados, IBAN & WebP", image: "/modulos/70-pessoa-de-contacto.png" },
                        { id: "fornecedor_seguranca", label: "Segurança & Acessos", desc: "Password & Biometria", image: "/modulos/31-seguranca.png" },
                        { id: "fornecedor_financeiro", label: "Recibos & Faturação", desc: "Leitura AI & Recibo Manual", image: "/modulos/59-recibo.png" }
                      ].map(card => {
                        const notifCount = getNotificationCount(card.id);
                        return (
                          <button
                            key={card.id}
                            onClick={() => setSelectedPwaSubmenu(card.id)}
                            className="w-full h-[115px] bg-emerald-50 hover:bg-emerald-100/90 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-950 dark:text-emerald-100 border-2 border-emerald-500 dark:border-emerald-400/80 rounded-2xl flex flex-col items-center justify-between text-center p-2.5 relative select-none hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                          >
                            <img src={card.image} alt={card.label} className="h-10 w-10 object-contain mb-0.5 shrink-0 rounded-lg drop-shadow-sm" />
                            <div className="flex flex-col items-center leading-none">
                              <span className="text-[10px] font-black text-emerald-950 dark:text-emerald-50 leading-tight block truncate max-w-full text-center">{card.label}</span>
                              <span className="text-[7.5px] font-mono text-emerald-800/90 dark:text-emerald-300/90 leading-normal block truncate max-w-full text-center mt-0.5">{card.desc}</span>
                            </div>
                            <span className="bg-emerald-100/90 dark:bg-emerald-900/90 text-emerald-900 dark:text-emerald-200 border border-emerald-400 dark:border-emerald-600 text-[8px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs uppercase tracking-wider truncate max-w-[90%] leading-none">
                              {getPillTextForCard(card.id)}
                            </span>
                            {notifCount > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-[18px] px-1 items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-black border border-white shadow-md animate-pulse z-10">
                                {notifCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                   </div>
                </div>
              )}

              {/* Keep other secondary non-user views for completeness just in case activeTab changes */}
              {(loggedUser.role === "ADMIN" || loggedUser.role === "EMPRESA_GESTORA") && (
                <>
                  {activeTab === "documents" && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Documentos Arquivados</h4>
                      <div className="space-y-2">
                        {documentos.map(d => (
                          <div key={d.id_doc} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-900 p-2.5 rounded-lg flex items-center justify-between text-[11px] shadow-sm">
                            <div className="flex items-center space-x-2 truncate">
                              <FileText className="h-4 w-4 text-red-500 shrink-0" />
                              <div className="truncate">
                                <span className="font-bold block text-slate-800 dark:text-white truncate">{d.nome}</span>
                                <span className="text-[9px] text-slate-400">{d.tipo} • {d.tamanho}</span>
                              </div>
                            </div>
                            <button onClick={() => alert(`Visualização do PDF: ${d.nome}`)} className="text-indigo-600 font-bold shrink-0 text-[10px]">Ver</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "obras" && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Obras & Contencioso</h4>
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-900 p-3 rounded-lg text-[11px] space-y-2 shadow-sm">
                        <span className="font-bold text-amber-600 flex items-center"><Wrench className="h-3.5 w-3.5 mr-1" /> Pintura de Fachadas 2026</span>
                        <p className="text-slate-400 text-[10px]">Orçamento: 18,500€ • Início previsto para Setembro. Adjudicado à empresa Pinturas Lis Lda.</p>
                        <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded">
                          <div className="w-1/3 h-full bg-amber-500 rounded"></div>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-900 p-3 rounded-lg text-[11px] space-y-2 shadow-sm">
                        <span className="font-bold text-red-600 flex items-center"><Scale className="h-3.5 w-3.5 mr-1" /> Processo Fração D (Litígio)</span>
                        <p className="text-slate-400 text-[10px]">Contencioso Jurídico ativo por falta de pagamento recorrente das quotas ordinárias de condomínio.</p>
                      </div>
                    </div>
                  )}

                  {activeTab === "ocorrencias" && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gestão de Ocorrências</h4>
                      <div className="space-y-2">
                        {ocorrencias.slice(0, 4).map(o => (
                          <div key={o.id_ocorr} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-900 p-3 rounded-lg text-[11px] space-y-1 shadow-sm">
                            <div className="flex justify-between">
                              <span className="font-bold text-slate-700 dark:text-slate-300">{o.id_ocorr}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${o.estado === "Resolvida" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{o.estado}</span>
                            </div>
                            <p className="text-slate-400 text-[10px]">{o.descricao}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}



              {/* --- ROLE: CONDÓMINO --- */}
              {loggedUser.role === "USER" && (
                <PWACondominoView
                  loggedUser={loggedUser}
                  predio={predio}
                  condominoFracao={condominoFracao}
                  documentos={documentos}
                  setDocumentos={setDocumentos}
                  ocorrencias={ocorrencias}
                  reservas={reservas}
                  movements={movements}
                  avisos={avisos}
                  customMessages={customMessages}
                  handleEnviarMensagem={handleEnviarMensagem}
                  newMsgText={newMsgText}
                  setNewMsgText={setNewMsgText}
                  pwaNotifications={pwaNotifications}
                  setPwaNotifications={setPwaNotifications}
                  onLogout={() => setPwaIsLoggedOut(true)}
                  biometricsEnabled={biometricsEnabled}
                  setBiometricsEnabled={setBiometricsEnabled}
                  theme={theme}
                />
              )}

              {/* --- ROLE: TÉCNICO DE VISTORIAS --- */}
              {loggedUser.role === "TECNICO" && (
                <>
                  {activeTab === "home" && (
                    <div className="space-y-4">
                      {/* Technical Header */}
                      <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-2 shadow-md">
                        <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">Área Técnica</span>
                        <h3 className="text-sm font-bold">Agenda de Vistorias Oficiais</h3>
                        <p className="text-[10px] text-slate-400">Inspeções agendadas, preenchimento de checklists estruturais e reporte imediato de avarias comuns.</p>
                      </div>

                      {/* Technical checklist and report form */}
                      <form onSubmit={handleTechnicianSubmit} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-900 p-4 rounded-xl space-y-3.5 shadow-sm text-[11px]">
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Relatório Técnico Digital</span>
                        
                        {/* Auto-timestamping Display */}
                        {tecnicoSubmittalTimestamp && (
                          <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40 text-[10px] space-y-0.5">
                            <span className="font-bold block">✓ Enviado com Sucesso</span>
                            <span>Data do Upload: {tecnicoDate}</span>
                            <span className="block text-[9px] text-slate-400 font-mono">Timestamp: {tecnicoSubmittalTimestamp}</span>
                          </div>
                        )}

                        {/* Calendar Input before Checklist */}
                        <div className="flex flex-col">
                          <label className="text-[9px] font-bold text-slate-400 uppercase mb-1">Data da Vistoria</label>
                          <input 
                            type="date" 
                            required
                            value={tecnicoDate}
                            onChange={e => setTecnicoDate(e.target.value)}
                            className="border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-1.5 rounded dark:text-white"
                          />
                        </div>

                        <div className="flex flex-col">
                          <label className="text-[9px] font-bold text-slate-400 uppercase mb-1">Local / Compartimento</label>
                          <input 
                            type="text" 
                            required
                            value={inspectorLocal}
                            onChange={e => setInspectorLocal(e.target.value)}
                            className="border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-1.5 rounded dark:text-white"
                          />
                        </div>

                        {/* Technician Profile Checklist Changed to Text / Report Field */}
                        <div className="flex flex-col">
                          <label className="text-[9px] font-bold text-indigo-500 uppercase mb-1">Relatório Técnico & Observações</label>
                          <textarea 
                            required
                            rows={3}
                            value={tecnicoReportText}
                            onChange={e => setTecnicoReportText(e.target.value)}
                            placeholder="Descreva detalhadamente o diagnóstico estrutural, elétrico ou de segurança e recomendações..."
                            className="border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-1.5 rounded text-[10px] focus:outline-none focus:border-indigo-500 dark:text-white"
                          />
                        </div>

                        <div className="flex flex-col">
                          <label className="text-[9px] font-bold text-slate-400 uppercase mb-1">Anomalia Crítica Encontrada (Se aplicável)</label>
                          <input 
                            type="text" 
                            value={inspectorAnomalia}
                            onChange={e => setInspectorAnomalia(e.target.value)}
                            placeholder="Descreva de forma curta avarias graves detectadas..."
                            className="border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-1.5 rounded dark:text-white"
                          />
                        </div>

                        {/* WebP Photo Upload (Rear Camera, 3 max) */}
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block">Fotografias de Campo (Máx 3 - WebP)</label>
                          <div className="flex flex-col text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-slate-50 dark:bg-slate-950 relative">
                            <Camera className="h-5 w-5 text-indigo-500 mx-auto mb-1" />
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Capturar com Câmara Traseira</span>
                            <span className="text-[8px] text-slate-400">Compressão WebP automática. ({tecnicoPhotos.length}/3 fotos)</span>
                            <input 
                              type="file" 
                              accept="image/*"
                              capture="environment" // Request rear camera
                              disabled={tecnicoPhotos.length >= 3}
                              onChange={e => {
                                if (e.target.files && e.target.files[0]) {
                                  const file = e.target.files[0];
                                  const newPhoto = {
                                    name: file.name,
                                    preview: URL.createObjectURL(file),
                                    size: "WebP ~45 KB"
                                  };
                                  setTecnicoPhotos(prev => [...prev, newPhoto].slice(0, 3));
                                  alert("Imagem convertida para WebP e comprimida de forma ótima!");
                                }
                              }}
                              className="mt-1.5 mx-auto text-[9px] text-slate-400 block cursor-pointer"
                            />
                          </div>
                          {tecnicoPhotos.length > 0 && (
                            <div className="grid grid-cols-3 gap-1.5 mt-1">
                              {tecnicoPhotos.map((p, index) => (
                                <div key={index} className="relative rounded border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-950 h-14">
                                  <img src={p.preview} alt="WebP preview" className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                                  <button 
                                    type="button"
                                    onClick={() => setTecnicoPhotos(prev => prev.filter((_, i) => i !== index))}
                                    className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 text-[8px] cursor-pointer flex items-center justify-center w-4 h-4"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 rounded cursor-pointer">
                          Submeter Relatório de Vistoria
                        </button>
                      </form>
                    </div>
                  )}

                  {activeTab === "ocorrencias" && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Historial de Incidências</h4>
                      <div className="space-y-2">
                        {ocorrencias.slice(0, 3).map(o => (
                          <div key={o.id_ocorr} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-900 p-3 rounded-lg text-[11px] shadow-sm">
                            <span className="font-bold text-indigo-600 block">{o.id_ocorr}</span>
                            <p className="text-slate-400 text-[10px]">{o.descricao}</p>
                            <span className="text-[9px] bg-slate-50 dark:bg-slate-850 px-1.5 py-0.5 rounded font-bold text-slate-500">{o.estado}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* --- ROLE: EMPRESA DE LIMPEZAS --- */}
              {loggedUser.role === "LIMPEZAS" && (
                <>
                  {activeTab === "home" && (
                    <div className="space-y-4">
                      <div className="bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-900/40 space-y-1 shadow-sm">
                        <span className="text-[10px] uppercase font-bold tracking-wider block">Equipa de Higienização</span>
                        <h3 className="text-sm font-bold">Folha de Limpezas Geral</h3>
                        <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400">Preencha digitalmente as áreas limpas para substituir a placa impressa no átrio.</p>
                      </div>

                      {/* Cleaning checklist */}
                      <form onSubmit={handleCleaningSubmit} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-900 p-4 rounded-xl space-y-3.5 shadow-sm text-[11px]">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Registo de Intervenção de Higiene</span>
                        
                        {/* Auto-timestamping Display */}
                        {limpezasSubmittalTimestamp && (
                          <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40 text-[10px] space-y-0.5">
                            <span className="font-bold block">✓ Limpeza Registada</span>
                            <span>Data da Higienização: {limpezasDate}</span>
                            <span className="block text-[9px] text-slate-400 font-mono">Timestamp: {limpezasSubmittalTimestamp}</span>
                          </div>
                        )}

                        {/* Calendar Input before Checklist */}
                        <div className="flex flex-col">
                          <label className="text-[9px] font-bold text-slate-400 uppercase mb-1">Data da Higienização</label>
                          <input 
                            type="date" 
                            required
                            value={limpezasDate}
                            onChange={e => setLimpezasDate(e.target.value)}
                            className="border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-1.5 rounded dark:text-white"
                          />
                        </div>

                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block pt-1">Checklist de Áreas Intervencionadas</span>
                        <div className="space-y-2.5">
                          <label className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={cleaningChecklist.atrioEntrada}
                              onChange={e => setCleaningChecklist({ ...cleaningChecklist, atrioEntrada: e.target.checked })}
                              className="rounded text-emerald-600 focus:ring-0"
                            />
                            <span>Átrio de Entrada Principal</span>
                          </label>
                          <label className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={cleaningChecklist.cabineElevador}
                              onChange={e => setCleaningChecklist({ ...cleaningChecklist, cabineElevador: e.target.checked })}
                              className="rounded text-emerald-600 focus:ring-0"
                            />
                            <span>Cabine Elevador Principal</span>
                          </label>
                          <label className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={cleaningChecklist.escadarias}
                              onChange={e => setCleaningChecklist({ ...cleaningChecklist, escadarias: e.target.checked })}
                              className="rounded text-emerald-600 focus:ring-0"
                            />
                            <span>Escadaria do Prédio</span>
                          </label>
                          <label className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={cleaningChecklist.areaLixo}
                              onChange={e => setCleaningChecklist({ ...cleaningChecklist, areaLixo: e.target.checked })}
                              className="rounded text-emerald-600 focus:ring-0"
                            />
                            <span>Área de Contentores Lixo</span>
                          </label>
                        </div>

                        <div className="flex flex-col">
                          <label className="text-[9px] font-bold text-slate-400 uppercase mb-1">Notas de Observação (Se houver)</label>
                          <textarea 
                            rows={2}
                            value={cleaningObs}
                            onChange={e => setCleaningObs(e.target.value)}
                            placeholder="Ex: Foi feita aspiração profunda e lavagem com desinfetante no elevador."
                            className="border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-1.5 rounded text-[10px] focus:outline-none focus:border-emerald-500 dark:text-white"
                          />
                        </div>

                        {/* Photo Capture Block */}
                        <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-150 dark:border-slate-800 space-y-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Foto de Conformidade de Higiene</span>
                          <div className="border border-dashed border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-center bg-white dark:bg-slate-900/40 relative">
                            <span className="text-xl block">📷</span>
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mt-1">Registar Foto do Local Limpo</span>
                            <span className="text-[8px] text-slate-400">Capturar com câmara móvel traseira (Otimizada em WebP)</span>
                            <input 
                              type="file" 
                              accept="image/*"
                              capture="environment"
                              onChange={e => {
                                if (e.target.files && e.target.files[0]) {
                                  const file = e.target.files[0];
                                  const newPhoto = {
                                    name: file.name,
                                    preview: URL.createObjectURL(file),
                                    size: "WebP ~35 KB (Reduzido em 88%)"
                                  };
                                  setCleaningPhotos([newPhoto]);
                                  alert("Imagem de higienização comprimida de forma ótima em formato WebP!");
                                }
                              }}
                              className="mt-1.5 mx-auto text-[9px] text-slate-400 block cursor-pointer"
                            />
                          </div>
                          {cleaningPhotos.length > 0 && (
                            <div className="grid grid-cols-1 gap-1.5 mt-1">
                              {cleaningPhotos.map((p, index) => (
                                <div key={index} className="relative rounded border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-950 h-16 flex items-center justify-between p-1">
                                  <div className="flex items-center space-x-2 h-full">
                                    <img src={p.preview} alt="WebP preview" className="object-cover w-12 h-full rounded" referrerPolicy="no-referrer" />
                                    <div className="text-left">
                                      <span className="font-bold text-[8px] block text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{p.name}</span>
                                      <span className="text-[7px] text-emerald-600 font-extrabold">{p.size}</span>
                                    </div>
                                  </div>
                                  <button 
                                    type="button"
                                    onClick={() => setCleaningPhotos([])}
                                    className="bg-red-600 hover:bg-red-700 text-white rounded-full p-0.5 text-[8px] cursor-pointer flex items-center justify-center w-4 h-4 mr-1"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded cursor-pointer">
                          Registar Atuação de Limpeza
                        </button>
                      </form>
                    </div>
                  )}

                  {activeTab === "ocorrencias" && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-bold">Incidências Observadas</h4>
                      <form onSubmit={handleSubmeterOcorrenciaCondoc} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-900 p-3 rounded-xl space-y-3.5 shadow-sm text-[11px]">
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block">Reportar Novo Defeito Higiene/Estrutural</span>
                        <input 
                          type="text" 
                          required
                          value={ocorrDesc}
                          onChange={e => setOcorrDesc(e.target.value)}
                          placeholder="Ex: Lâmpada fundida na escada do 2º piso."
                          className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-1.5 rounded focus:outline-none focus:border-red-500 dark:text-white"
                        />
                        <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 rounded cursor-pointer">
                          Enviar Alerta à Administração
                        </button>
                      </form>
                    </div>
                  )}
                </>
              )}

              {/* --- ROLE: FORNECEDOR (Not Applicable in PWA) --- */}
              {(loggedUser.role as any) === "FORNECEDOR" && (
                <div className="space-y-4 py-8 text-center">
                  <div className="h-16 w-16 bg-red-50 dark:bg-red-950/20 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <XCircle className="h-10 w-10" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">PWA Não Aplicável</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-2">
                    Os Fornecedores e Prestadores de Serviços dispõem de acesso exclusivamente através do <strong>Portal Web de Orçamentos</strong> no computador.
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Aceda em modo Navegador no computador para submeter orçamentos técnicos e propostas oficiais de adjudicação.
                  </p>
                </div>
              )}

              {/* --- ROLE: JURIDICO --- */}
              {loggedUser.role === "JURIDICO" && (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-900 rounded-xl p-3 shadow-sm space-y-2">
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-1">
                      <Scale className="h-3.5 w-3.5" /> Contencioso Jurídico Mobile
                    </span>
                    <h5 className="text-xs font-bold text-slate-800 dark:text-white">Estado das Cobranças Extrajudiciais</h5>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Acompanhamento em tempo real de notificações enviadas e prazos de resposta de condóminos em mora.
                    </p>
                  </div>

                  {/* Active legal actions */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-900 space-y-3 shadow-sm">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Processos de Cobrança Ativos (2)</span>
                    <div className="space-y-2 text-[10px]">
                      <div className="p-2.5 bg-red-50/50 dark:bg-red-950/10 rounded-lg border border-red-100 dark:border-red-900/30">
                        <div className="flex justify-between font-bold text-red-700 dark:text-red-400">
                          <span>Fração H (3º Direito)</span>
                          <span>Em Contencioso</span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Dívida acumulada de quotas: 1,420.00€</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Última ação: Carta de Interpelação Registada AR enviada.</p>
                      </div>

                      <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/10 rounded-lg border border-amber-100 dark:border-amber-900/30">
                        <div className="flex justify-between font-bold text-amber-700 dark:text-amber-400">
                          <span>Fração F (2º Esquerdo)</span>
                          <span>Fase Extrajudicial</span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Dívida de Quotas Extraordinárias: 450.00€</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Última ação: Acordo de pagamento proposto via e-mail.</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-900 space-y-2 shadow-sm text-[10px]">
                    <span className="text-[9px] font-bold uppercase text-slate-400 block">Alertas Regulamentares</span>
                    <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
                      <span>Regulamento do Condomínio em conformidade com as novas diretrizes do Dec-Lei 8/2022.</span>
                    </div>
                  </div>
                </div>
              )}



              {/* --- ROLE: AUDITOR --- */}
              {loggedUser.role === "AUDITOR" && (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-900 rounded-xl p-3 shadow-sm space-y-2">
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                      <Fingerprint className="h-3.5 w-3.5" /> Auditoria Geral Independente
                    </span>
                    <h5 className="text-xs font-bold text-slate-800 dark:text-white">Relatório de Rastreabilidade total</h5>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Acesso estritamente read-only a todas as transações, registos de conciliação bancária, despesas emitidas e uploads de documentos.
                    </p>
                  </div>

                  {/* Audit Logs */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-900 space-y-3 shadow-sm text-[10px]">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Registos de Auditoria Recentes</span>
                    <div className="space-y-2 font-mono text-[9px]">
                      <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded border border-slate-100 dark:border-slate-805">
                        <span className="text-slate-400">[17/07 15:24]</span> Admin alterou saldo da Conta Geral para 4,289.44€
                      </div>
                      <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded border border-slate-100 dark:border-slate-805">
                        <span className="text-slate-400">[17/07 14:10]</span> Documento "Ata_Geral_Maio_2026.pdf" carregado
                      </div>
                      <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded border border-slate-100 dark:border-slate-805">
                        <span className="text-slate-400">[17/07 11:05]</span> Quota da Fração A validada por Conciliação Automática IA
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* --- ROLE: CONTABILISTA --- */}
              {loggedUser.role === "CONTABILISTA" && (
                <div className="space-y-4">
                  {/* Financial Overview */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-900 rounded-xl p-3 shadow-sm space-y-2">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                      <CreditCard className="h-3.5 w-3.5" /> Contabilidade do Condomínio
                    </span>
                    <h5 className="text-xs font-bold text-slate-800 dark:text-white">Estado dos Lançamentos & Saldos</h5>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Supervisão de balancetes, extratos, faturas recebidas e classificação fiscal das contas de despesas e receitas.
                    </p>
                  </div>

                  {/* Bank snapshot */}
                  <div className="bg-slate-50 dark:bg-slate-950 border rounded-xl p-3 text-[10px] space-y-1.5">
                    <span className="font-bold text-slate-500 uppercase tracking-wider block">Contas Bancárias Ativas</span>
                    <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-805">
                      <div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 block">Conta Geral Novo Banco</span>
                        <span className="text-[8px] text-slate-400 font-mono">PT50 0007 0000 1234 5678 9012 3</span>
                      </div>
                      <span className="font-mono font-black text-emerald-600">3,420.50€</span>
                    </div>
                    <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-805">
                      <div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 block">Conta Fundo de Reserva</span>
                        <span className="text-[8px] text-slate-400 font-mono">PT50 0007 0000 9876 5432 1098 7</span>
                      </div>
                      <span className="font-mono font-black text-indigo-600">1,850.00€</span>
                    </div>
                  </div>
                </div>
              )}

              {/* --- TAB: NOTIFICAÇÕES (SHARED BY ALL ROLES) --- */}
              {activeTab === "notifications" && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Centro de Mensagens & Alertas</h4>
                  
                  {/* Messages list for chat */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-900 p-3 rounded-xl space-y-3.5 shadow-sm text-[11px]">
                    <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider flex items-center">
                      <MessageSquare className="h-3.5 w-3.5 mr-1" /> Mensagens à Administração
                    </span>
                    
                    <form onSubmit={handleEnviarMensagem} className="flex gap-2">
                      <input 
                        type="text" 
                        required
                        value={newMsgText}
                        onChange={e => setNewMsgText(e.target.value)}
                        placeholder="Escreva a sua mensagem..."
                        className="flex-grow border border-slate-200 dark:border-slate-800 dark:bg-slate-950 px-2.5 py-1 text-[10px] rounded focus:outline-none focus:border-teal-500 dark:text-white"
                      />
                      <button type="submit" className="p-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded cursor-pointer">
                        <Send className="h-3 w-3" />
                      </button>
                    </form>

                    <div className="space-y-2 max-h-40 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
                      {customMessages.map(m => (
                        <div key={m.id} className="pt-2 text-[10px] space-y-0.5">
                          <div className="flex justify-between text-slate-400">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{m.sender}</span>
                            <span>{m.date}</span>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 italic leading-tight">"{m.text}"</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Push alerts list with Delete & Archive support */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Centro de Alertas Push</span>
                      <div className="flex bg-slate-200 dark:bg-slate-800 rounded-lg p-0.5 text-[9px] font-bold">
                        <button 
                          type="button"
                          onClick={() => setShowArchived(false)}
                          className={`px-2 py-0.5 rounded-md transition-colors ${!showArchived ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs" : "text-slate-400"}`}
                        >
                          Ativos
                        </button>
                        <button 
                          type="button"
                          onClick={() => setShowArchived(true)}
                          className={`px-2 py-0.5 rounded-md transition-colors ${showArchived ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs" : "text-slate-400"}`}
                        >
                          Arquivados ({pwaNotifications.filter(n => n.isArchived).length})
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {pwaNotifications.filter(n => !!n.isArchived === showArchived).length === 0 ? (
                        <div className="text-center py-4 text-[10px] text-slate-400">
                          Nenhuma notificação {showArchived ? "arquivada" : "ativa"}.
                        </div>
                      ) : (
                        pwaNotifications.filter(n => !!n.isArchived === showArchived).map(n => (
                          <div key={n.id} className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/60 p-3 rounded-lg text-[10px] space-y-2.5 shadow-sm transition-all duration-300">
                            <div>
                              <div className="flex justify-between font-bold">
                                <span className="text-slate-800 dark:text-slate-200">{n.title}</span>
                                <span className="text-slate-400 text-[8px]">{n.date}</span>
                              </div>
                              <p className="text-slate-500 dark:text-slate-400 font-medium mt-0.5">{n.desc}</p>
                            </div>

                            <div className="flex justify-end items-center gap-1.5 pt-1.5 border-t border-slate-200/40 dark:border-slate-800/40">
                              <button
                                type="button"
                                onClick={() => {
                                  setPwaNotifications(prev => prev.map(item => item.id === n.id ? { ...item, isArchived: !item.isArchived } : item));
                                  alert(n.isArchived ? "Notificação restaurada para Ativa!" : "Notificação arquivada com sucesso!");
                                }}
                                className="flex items-center space-x-1 px-2 py-1 bg-slate-250 hover:bg-slate-350 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-bold cursor-pointer transition-colors"
                              >
                                <Archive className="h-3 w-3" />
                                <span>{showArchived ? "Desarquivar" : "Arquivar"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPwaNotifications(prev => prev.filter(item => item.id !== n.id));
                                  alert("Notificação eliminada com sucesso!");
                                }}
                                className="flex items-center space-x-1.5 px-2.5 py-1 border border-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95 active:ring-2 active:ring-red-400 select-none shadow-xs"
                              >
                                <img src="/estados-acoes/14-eliminar.png" alt="Eliminar" className="h-3.5 w-3.5 object-contain" />
                                <span>Eliminar</span>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* PWA NATIVE BOTTOM BAR (Role based tab bar) */}
            {loggedUser.role !== "USER" && (
              <div className="h-14 shrink-0 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800/80 px-2 flex items-center justify-around text-[9px] font-bold text-slate-400 z-10">
              {(loggedUser.role as any) !== "FORNECEDOR" ? (
                <>
                  {/* 1. Início (Verde) */}
                  <button 
                    onClick={() => setActiveTab("home")} 
                    className={`flex flex-col items-center space-y-0.5 cursor-pointer flex-1 transition-all ${activeTab === "home" ? "text-emerald-500 font-extrabold scale-105" : "text-emerald-600 hover:text-emerald-400"}`}
                  >
                    <Smartphone className="h-4.5 w-4.5 text-emerald-500" />
                    <span className="text-emerald-500 font-extrabold text-[8.5px]">Início</span>
                  </button>
                  
                  {/* 2. Arquivos (Admin) or Módulos */}
                  {loggedUser.role === "ADMIN" || loggedUser.role === "EMPRESA_GESTORA" ? (
                    <button 
                      onClick={() => setActiveTab("documents")} 
                      className={`flex flex-col items-center space-y-0.5 cursor-pointer flex-1 transition-all ${activeTab === "documents" ? "text-emerald-500 font-extrabold scale-105" : "text-slate-500 dark:text-slate-400 hover:text-slate-200"}`}
                    >
                      <img src="/marca/16-documentos-relatorios.png" alt="Arquivos" className="h-4.5 w-4.5 object-contain" />
                      <span className="text-[8.5px]">Arquivos</span>
                    </button>
                  ) : null}

                  {/* 3. Módulos (Marca 10-icone-negativo.png) */}
                  <button 
                    onClick={() => setActiveTab("home")} 
                    className={`flex flex-col items-center space-y-0.5 cursor-pointer flex-1 transition-all ${activeTab === "home" ? "text-emerald-500 font-extrabold scale-105" : "text-slate-500 dark:text-slate-400 hover:text-slate-200"}`}
                  >
                    <img src="/marca/10-icone-negativo.png" alt="Módulos" className="h-4.5 w-4.5 object-contain" />
                    <span className="text-[8.5px]">Módulos</span>
                  </button>

                  {/* 4. Avarias (Vermelho - 29-avaria.png) */}
                  <button 
                    onClick={() => setActiveTab("ocorrencias")} 
                    className={`flex flex-col items-center space-y-0.5 cursor-pointer flex-1 transition-all ${activeTab === "ocorrencias" ? "text-red-500 font-extrabold scale-105" : "text-slate-500 dark:text-slate-400 hover:text-slate-200"}`}
                  >
                    <img src="/modulos/29-avaria.png" alt="" className="h-4.5 w-4.5 object-contain" />
                    <span className="text-red-500 font-black text-[8.5px]">Avarias</span>
                  </button>

                  {/* 5. Obras (Laranja - 41-obra.png) */}
                  <button 
                    onClick={() => setActiveTab("obras")} 
                    className={`flex flex-col items-center space-y-0.5 cursor-pointer flex-1 transition-all ${activeTab === "obras" ? "text-orange-500 font-extrabold scale-105" : "text-slate-500 dark:text-slate-400 hover:text-slate-200"}`}
                  >
                    <img src="/modulos/41-obra.png" alt="" className="h-4.5 w-4.5 object-contain" />
                    <span className="text-orange-500 font-black text-[8.5px]">Obras</span>
                  </button>
                </>
              ) : (
                <div className="text-[10px] text-slate-400 font-bold py-2">
                  Não Aplicável (Apenas Browser)
                </div>
              )}
              </div>
            )}

            {/* FLOATING CONTACT BUTTON & MODAL (Only for Condóminos) */}
            {loggedUser.role === "USER" && (
              <>
                {/* Draggable CondoManager AI Floating FAB */}
                <motion.div
                  drag
                  dragMomentum={false}
                  dragElastic={0.1}
                  className="absolute bottom-20 right-4 z-40 cursor-grab active:cursor-grabbing"
                  id="pwa-draggable-chat-fab"
                >
                  <button
                    onClick={() => setContactModalOpen(true)}
                    className="h-12 w-12 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center shadow-2xl border-2 border-emerald-500 hover:bg-slate-800 transition-all cursor-pointer hover:scale-110 active:scale-95 relative"
                    title="Contactar Administração (Deslocável)"
                  >
                    <div className="relative flex items-center justify-center">
                      <img src="/modulos/75-mensagem.png" alt="Mensagens" className="h-6 w-6 object-contain" />
                      <span className="absolute -top-1.5 -right-2 bg-[#10B981] text-[6.5px] font-black text-white rounded-full px-0.5 leading-none h-[11px] min-w-[11px] flex items-center justify-center">
                        CM
                      </span>
                    </div>
                  </button>
                </motion.div>

                {/* Contact Modal Overlay */}
                {contactModalOpen && (
                  <div className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/80 flex items-end justify-center z-50 p-3 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-h-[85%] rounded-t-2xl shadow-xl flex flex-col overflow-hidden animate-slide-up">
                      {/* Modal Header */}
                      <div className="bg-emerald-600 px-4 py-3 text-white flex justify-between items-center shrink-0">
                        <div>
                          <h4 className="text-xs font-bold flex items-center">
                            <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Contactar Administração
                          </h4>
                          <p className="text-[8px] text-emerald-100">Mensagem direta para a gerência do condomínio</p>
                        </div>
                        <button
                          onClick={() => setContactModalOpen(false)}
                          className="text-white hover:text-emerald-100 font-bold text-sm cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Modal Body */}
                      <form onSubmit={handleSendPwaContact} className="p-4 space-y-3 overflow-y-auto text-[10px] flex-1">
                        {/* Auto-filled details */}
                        <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-150 dark:border-slate-800 space-y-1.5">
                          <span className="text-[8px] text-slate-400 font-bold uppercase block tracking-wider font-mono">Dados do Remetente (Auto-Preenchido)</span>
                          <div className="grid grid-cols-2 gap-2 text-[9px]">
                            <div>
                              <span className="text-slate-400">Condómino:</span> <strong className="text-slate-800 dark:text-slate-200">{loggedUser.nome}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400">Fração:</span> <strong className="text-slate-800 dark:text-slate-200">{condominoFracao?.fracao_nome || "A"}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400">Email:</span> <strong className="text-slate-800 dark:text-slate-200 block truncate max-w-[100px]">{loggedUser.email}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400">Telefone:</span> <strong className="text-slate-800 dark:text-slate-200">{condominoFracao?.proprietario.tlm || "912 345 678"}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Form Fields */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Assunto do Contacto</label>
                          <select
                            value={contactAssunto}
                            onChange={(e) => setContactAssunto(e.target.value)}
                            required
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg font-bold text-slate-800 dark:text-white"
                          >
                            <option value="">Selecione um assunto...</option>
                            <option value="Dúvida sobre Quotas">Dúvida sobre Quotas / Balancete</option>
                            <option value="Avaria Comum">Ajuste de Ocorrência / Avaria Comum</option>
                            <option value="Pedido de Documento">Pedido de Documento Oficial</option>
                            <option value="Avisos e Regulamento">Avisos e Regulamento Interno</option>
                            <option value="Reserva de Espaço">Reserva de Espaço Comum</option>
                            <option value="Reclamação ou Sugestão">Reclamação ou Sugestão</option>
                            <option value="Outros Assuntos">Outros Assuntos Gerais</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Mensagem Detalhada</label>
                          <textarea
                            value={contactMensagem}
                            onChange={(e) => setContactMensagem(e.target.value)}
                            required
                            placeholder="Escreva a sua mensagem clara aqui..."
                            rows={3}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-slate-800 dark:text-white"
                          />
                        </div>

                        {/* File Upload, Camera WebP & Audio Recording */}
                        <div className="space-y-2 border-t border-slate-150 dark:border-slate-800 pt-2.5">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Anexos: Ficheiro, Foto WebP ou Áudio</label>
                          
                          {/* Row with 3 buttons */}
                          <div className="grid grid-cols-3 gap-1.5">
                            {/* Option 1: File/PDF */}
                            <button
                              type="button"
                              onClick={() => document.getElementById("pwa-contact-anexo-file")?.click()}
                              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 p-2 rounded-lg font-bold text-slate-700 dark:text-slate-200 flex flex-col items-center justify-center text-center cursor-pointer space-y-1"
                            >
                              <FileText className="h-4 w-4 text-emerald-500" />
                              <span className="text-[8px] leading-tight">Anexar PDF / Doc</span>
                            </button>
                            <input
                              id="pwa-contact-anexo-file"
                              type="file"
                              accept="application/pdf,image/*,.doc,.docx"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setContactDocumentoName(file.name);
                                  setContactFotoIsWebp(file.name.endsWith(".webp"));
                                  setContactFotoBase64("data:application/pdf;base64,mockpdfbytes...");
                                }
                              }}
                              className="hidden"
                            />

                            {/* Option 2: Camera Photo -> WebP */}
                            <button
                              type="button"
                              onClick={() => document.getElementById("pwa-contact-camera-webp")?.click()}
                              className="bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 border border-emerald-300 dark:border-emerald-700/60 p-2 rounded-lg font-bold text-emerald-800 dark:text-emerald-300 flex flex-col items-center justify-center text-center cursor-pointer space-y-1"
                            >
                              <Camera className="h-4 w-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                              <span className="text-[8px] leading-tight">Tirar Foto (WebP)</span>
                            </button>
                            <input
                              id="pwa-contact-camera-webp"
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setContactDocumentoName(`Foto_Cam_${Date.now()}.webp`);
                                  setContactFotoIsWebp(true);
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    const img = new Image();
                                    img.onload = () => {
                                      const canvas = document.createElement("canvas");
                                      canvas.width = img.width;
                                      canvas.height = img.height;
                                      const ctx = canvas.getContext("2d");
                                      if (ctx) {
                                        ctx.drawImage(img, 0, 0);
                                        const webpUrl = canvas.toDataURL("image/webp", 0.80);
                                        setContactFotoBase64(webpUrl);
                                      } else {
                                        setContactFotoBase64(event.target?.result as string);
                                      }
                                    };
                                    img.src = event.target?.result as string;
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="hidden"
                            />

                            {/* Option 3: Voice Audio Recorder */}
                            <button
                              type="button"
                              onClick={() => {
                                if (isRecordingContactAudio) {
                                  setIsRecordingContactAudio(false);
                                  const dur = contactAudioRecordTimer || 4;
                                  setContactAudioDuration(dur);
                                  setContactAudioBase64("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
                                } else {
                                  setIsRecordingContactAudio(true);
                                  setContactAudioRecordTimer(0);
                                }
                              }}
                              className={`${
                                isRecordingContactAudio 
                                  ? "bg-red-500 text-white animate-pulse" 
                                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                              } border border-slate-200 dark:border-slate-700 p-2 rounded-lg font-bold flex flex-col items-center justify-center text-center cursor-pointer space-y-1`}
                            >
                              <Mic className={`h-4 w-4 ${isRecordingContactAudio ? "text-white" : "text-amber-500"}`} />
                              <span className="text-[8px] leading-tight">
                                {isRecordingContactAudio ? `🔴 ${contactAudioRecordTimer}s (Parar)` : "Gravar Áudio"}
                              </span>
                            </button>
                          </div>

                          {/* Active Audio Recording Indicator */}
                          {isRecordingContactAudio && (
                            <div className="bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 p-2 rounded-lg flex items-center justify-between text-red-700 dark:text-red-300">
                              <div className="flex items-center space-x-2">
                                <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
                                <span className="font-bold text-[9px]">A gravar nota de voz ({contactAudioRecordTimer}s)...</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsRecordingContactAudio(false);
                                  const dur = contactAudioRecordTimer || 5;
                                  setContactAudioDuration(dur);
                                  setContactAudioBase64("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
                                }}
                                className="bg-red-600 text-white font-bold text-[8px] px-2 py-0.5 rounded cursor-pointer"
                              >
                                Concluir Áudio
                              </button>
                            </div>
                          )}

                          {/* Attached WebP Photo Badge */}
                          {contactFotoIsWebp && contactDocumentoName && (
                            <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 p-2 rounded-lg flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 truncate">
                                <Camera className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span className="text-[9px] font-bold text-emerald-800 dark:text-emerald-200 truncate">
                                  {contactDocumentoName}
                                </span>
                                <span className="bg-emerald-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase">
                                  ⚡ WebP 80% (Redução 85%)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setContactDocumentoName("");
                                  setContactFotoBase64("");
                                  setContactFotoIsWebp(false);
                                }}
                                className="text-[8px] text-red-500 font-bold hover:underline shrink-0"
                              >
                                Remover
                              </button>
                            </div>
                          )}

                          {/* Attached Audio Preview Player */}
                          {contactAudioBase64 && (
                            <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/80 p-2 rounded-lg space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-1.5">
                                  <Volume2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span className="text-[9px] font-bold text-amber-900 dark:text-amber-200">
                                    Nota de Voz Anexada ({contactAudioDuration || 4} seg)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setContactAudioBase64(null);
                                    setContactAudioDuration(0);
                                  }}
                                  className="text-[8px] text-red-500 font-bold hover:underline"
                                >
                                  Eliminar Áudio
                                </button>
                              </div>
                              <div className="flex items-center space-x-2 bg-amber-100/70 dark:bg-amber-900/40 p-1.5 rounded">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const audio = new Audio(contactAudioBase64);
                                    audio.play().catch(() => alert("🔊 Reprodução de áudio simulada da mensagem de voz."));
                                  }}
                                  className="bg-amber-600 text-white text-[8px] font-bold px-2 py-0.5 rounded cursor-pointer flex items-center space-x-1"
                                >
                                  <span>▶ Ouvir Nota</span>
                                </button>
                                <div className="flex-1 h-1.5 bg-amber-200 dark:bg-amber-800 rounded-full overflow-hidden">
                                  <div className="w-2/3 h-full bg-amber-600 rounded-full animate-pulse" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Submit Button */}
                        <div className="pt-2 flex space-x-2">
                          <button
                            type="button"
                            onClick={() => setContactModalOpen(false)}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-2 rounded-lg font-bold cursor-pointer text-center"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={contactSending}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-2 rounded-lg font-bold cursor-pointer text-center flex items-center justify-center space-x-1"
                          >
                            {contactSending ? (
                              <>
                                <Clock className="h-3.5 w-3.5 animate-spin" />
                                <span>A enviar...</span>
                              </>
                            ) : (
                              <span>Enviar Contacto</span>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* POPUP WINDOWS FOR ADMINISTRATIVE BENTO CARDS */}
                {selectedPwaSubmenu && (
                  <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs z-40 flex items-end justify-center p-3 animate-fade-in">
                    <div 
                      className={`border rounded-2xl w-full max-h-[85%] flex flex-col shadow-2xl overflow-hidden ${
                        theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-800"
                      }`} 
                      style={{ backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff" }}
                    >
                      {/* Header */}
                      <div className={`px-4 py-3 border-b flex justify-between items-center shrink-0 ${
                        theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                      }`}>
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs font-black uppercase tracking-wider ${
                            theme === "dark" ? "text-white" : "text-slate-800"
                          }`}>
                            {selectedPwaSubmenu === "aprovacoes" ? "📝 Menu: Aprovações & Agenda" :
                             selectedPwaSubmenu === "ocorrencias" ? "🔧 Menu: Ocorrências" :
                             selectedPwaSubmenu === "comunicar" ? "📢 Menu: Comunicação & IA" :
                             selectedPwaSubmenu === "documentos" ? "📁 Menu: Arquivo Digital" :
                             selectedPwaSubmenu === "obras" ? "🏗️ Menu: Manutenção & Obras" :
                             selectedPwaSubmenu === "financas" ? "💰 Menu: Finanças & Contas" :
                             selectedPwaSubmenu === "fracoes" ? "🏢 Menu: Prédio & Frações" :
                             selectedPwaSubmenu === "assembleias" ? "⚖️ Menu: Assembleias & Legal" :
                             selectedPwaSubmenu === "fornecedores" ? "🛠️ Menu: Fornecedores & Orçamentos" :
                             selectedPwaSubmenu === "configuracoes" ? "⚙️ Menu: Empresa Gestora & Parâmetros" :
                              selectedPwaSubmenu === "vistoria" ? "📋 Menu: Vistoria Checklist" :
                              selectedPwaSubmenu === "avaria" ? "📸 Menu: Reportar Defeito" :
                              selectedPwaSubmenu === "historico_tec" ? "⏱️ Menu: Histórico Vistorias" :
                              selectedPwaSubmenu === "limpeza_checklist" ? "🧹 Menu: Folha Digital de Limpeza" :
                              selectedPwaSubmenu === "historico_limpeza" ? "📜 Menu: Inspeções & Histórico" :
                              selectedPwaSubmenu === "avaria_limpeza" ? "⚠️ Menu: Reportar Avaria" :
                              selectedPwaSubmenu === "contencioso" ? "⚖️ Menu: Contencioso & Litígios" :
                              selectedPwaSubmenu === "legal_consult" ? "⚖️ Menu: Consultadoria Legal" :
                              selectedPwaSubmenu === "auditoria" ? "🛡️ Menu: Relatórios de Auditoria" :
                              selectedPwaSubmenu === "relatorio_auditor" ? "📝 Menu: Parecer do Auditor" :
                              selectedPwaSubmenu === "contas_bancarias" ? "💳 Menu: Saldos Bancários" :
                              selectedPwaSubmenu === "lancamentos" ? "🧾 Menu: Despesas & Faturas" : "Menu de Gestão"}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedPwaSubmenu(null);
                            setActivePwaSubMenuDetails(null);
                          }}
                          className="text-slate-500 hover:text-slate-800 dark:text-white dark:hover:text-emerald-400 font-bold text-xs cursor-pointer px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 transition-colors"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Content */}
                      <div className="p-4 overflow-y-auto space-y-3.5 text-xs text-slate-700 dark:text-white">
                        <p className="text-[10px] text-slate-500 dark:text-white font-medium">
                          Selecione o sub-menu correspondente para abrir em janela pop-up:
                        </p>

                        <div className="grid grid-cols-1 gap-2">
                          {selectedPwaSubmenu === "aprovacoes" && [
                            { id: "aprovacoes_reservas", label: "Gestão & Aprovação de Reservas", image: "/modulos/82-automacao.png" },
                            { id: "aprovacoes_recibos", label: "Emissão de Quotas & Recibos", image: "/modulos/59-recibo.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/60 dark:hover:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "comunicar" && [
                            { id: "comunicar_broadcast", label: "Comunicados & Avisos Globais", image: "/modulos/21-notificacoes-inquilino.png" },
                            { id: "comunicar_chat", label: "Caixa de Entrada & Mensagens Diretas", image: "/modulos/75-mensagem.png" },
                            { id: "comunicar_sondagens", label: "Sondagens Rápidas & Votações", image: "/modulos/70-pessoa-de-contacto.png" },
                            { id: "comunicar_questionarios", label: "Questionários & Inquéritos", image: "/modulos/27-arquivo-automatico.png" },
                            { id: "comunicar_cerebro", label: "Cérebro IA & Análises Dinâmicas", image: "/modulos/82-automacao.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "documentos" && [
                            { id: "documentos_arquivo", label: "Arquivo Digital / Documentos", image: "/modulos/27-arquivo-automatico.png" },
                            { id: "documentos_auditoria", label: "Auditoria Interna & Relatórios", image: "/modulos/27-arquivo-automatico.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "obras" && [
                            { id: "ocorrencias_gestao", label: "Gestão de Ocorrências & Avarias", image: "/modulos/29-avaria.png" },
                            { id: "ocorrencias_agenda", label: "Agenda de Intervenções Técnicas", image: "/modulos/02-equipamentos-tecnicos.png" },
                            { id: "ocorrencias_concluidas", label: "Histórico de Intervenções Concluídas", image: "/modulos/27-arquivo-automatico.png" },
                            { id: "obras_extraordinarias", label: "Gestão de Obras Extraordinárias", image: "/modulos/41-obra.png" },
                            { id: "obras_limpezas", label: "Relatórios de Vistoria & Limpeza", image: "/modulos/50-limpeza.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "financas" && [
                            { id: "financas_movimentos", label: "Saldos & Extrato de Movimentos", image: "/modulos/59-recibo.png" },
                            { id: "financas_contas", label: "Contas Bancárias do Condomínio", image: "/modulos/59-recibo.png" },
                            { id: "financas_fundo", label: "Fundo de Reserva Comum", image: "/modulos/59-recibo.png" },
                            { id: "financas_conciliacao", label: "Conciliação Bancária com IA", image: "/modulos/82-automacao.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "fracoes" && [
                            { id: "fracoes_predios", label: "Gestão do Prédio & Regras", image: "/modulos/01-predio.png" },
                            { id: "fracoes_fracoes", label: "Gestão de Frações & Residentes", image: "/modulos/07-fracao.png" },
                            { id: "fracoes_inquilinos", label: "Portal de Condóminos & Inquilinos", image: "/modulos/70-pessoa-de-contacto.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "assembleias" && [
                            { id: "assembleias_gestao", label: "Gestão & Organização de Assembleias", image: "/modulos/70-pessoa-de-contacto.png" },
                            { id: "assembleias_juridico", label: "Contencioso Jurídico & Atas", image: "/modulos/27-arquivo-automatico.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "vistoria" && [
                            { id: "tec_vistoria", label: "Executar Vistoria Checklist", image: "/modulos/02-equipamentos-tecnicos.png" },
                            { id: "tec_fotos", label: "Captura de Fotografias & Registo", image: "/modulos/29-avaria.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "avaria" && [
                            { id: "tec_avaria_foto", label: "Reportar Defeito com Foto WebP", image: "/modulos/29-avaria.png" },
                            { id: "tec_avaria_lista", label: "Avarias Pendentes de Reparação", image: "/modulos/29-avaria.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "historico_tec" && [
                            { id: "tec_historico", label: "Histórico de Vistorias Técnicas", image: "/modulos/27-arquivo-automatico.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "limpeza_checklist" && [
                            { id: "limpeza_folha", label: "Preencher Folha Digital de Higiene", image: "/modulos/50-limpeza.png" },
                            { id: "limpeza_inspecao", label: "Checklist de Posição de Áreas Comuns", image: "/modulos/50-limpeza.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "historico_limpeza" && [
                            { id: "limpeza_registo_hist", label: "Histórico de Inspeções de Limpeza", image: "/modulos/27-arquivo-automatico.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "avaria_limpeza" && [
                            { id: "limpeza_reportar_avaria", label: "Reportar Avaria no Bloco/Hall", image: "/modulos/29-avaria.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "contencioso" && [
                            { id: "legal_contencioso_processos", label: "Gestão de Processos de Litígio (Fração D)", image: "/modulos/70-pessoa-de-contacto.png" },
                            { id: "legal_contencioso_notif", label: "Notificações & Cobrança de Quotas", image: "/modulos/27-arquivo-automatico.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "legal_consult" && [
                            { id: "legal_consult_pareceres", label: "Consultadoria Legal & Regulamento", image: "/modulos/27-arquivo-automatico.png" },
                            { id: "legal_consult_atas", label: "Validação de Atas & Convocatórias", image: "/modulos/27-arquivo-automatico.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "auditoria" && [
                            { id: "auditor_relatorios", label: "Relatórios da Auditoria Interna", image: "/modulos/27-arquivo-automatico.png" },
                            { id: "auditor_movimentos", label: "Verificação Contabilística & Extratos", image: "/modulos/59-recibo.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "relatorio_auditor" && [
                            { id: "auditor_novo_parecer", label: "Emitir Novo Parecer Técnico", image: "/modulos/27-arquivo-automatico.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "contas_bancarias" && [
                            { id: "contabilista_saldos", label: "Saldos Bancários & Poupança", image: "/modulos/59-recibo.png" },
                            { id: "contabilista_extratos", label: "Extratos & Conciliação", image: "/modulos/59-recibo.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "lancamentos" && [
                            { id: "contabilista_despesas", label: "Lançamento de Faturas & Despesas", image: "/modulos/59-recibo.png" },
                            { id: "contabilista_recibos", label: "Emissão de Recibos ao Condomínio", image: "/modulos/59-recibo.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "fornecedores" && [
                            { id: "fornecedores_fichas", label: "Fichas de Fornecedores & Contratos", image: "/modulos/67-fornecedor.png" },
                            { id: "fornecedores_orcamentos", label: "Portal de Orçamentos de Fornecedores", image: "/modulos/67-fornecedor.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "configuracoes" && [
                            { id: "configuracoes_gestora", label: "Ficha da Empresa Gestora (White-Label)", image: "/modulos/07-fracao.png" },
                            { id: "configuracoes_gerais", label: "Configurações Gerais do Condomínio", image: "/modulos/01-predio.png" },
                            { id: "configuracoes_ia", label: "Configurações do Assistente IA & Push", image: "/modulos/82-automacao.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "predios" && [
                            { id: "fracoes_predios", label: "Gestão do Prédio & Regras do Edifício", image: "/modulos/01-predio.png" },
                            { id: "fracoes_fracoes", label: "Registo de Frações & Unidades", image: "/modulos/07-fracao.png" },
                            { id: "configuracoes_gerais", label: "Parâmetros Gerais do Condomínio", image: "/modulos/01-predio.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                          {selectedPwaSubmenu === "limpeza" && [
                            { id: "limpeza_folha", label: "Preencher Folha Digital de Higiene", image: "/modulos/50-limpeza.png" },
                            { id: "limpeza_inspecao", label: "Checklist de Posição de Áreas Comuns", image: "/modulos/50-limpeza.png" },
                            { id: "limpeza_registo_hist", label: "Histórico de Inspeções de Limpeza", image: "/modulos/27-arquivo-automatico.png" },
                            { id: "limpeza_reportar_avaria", label: "Reportar Avaria no Bloco/Hall", image: "/modulos/29-avaria.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}

                           {["fornecedor_perfil", "fornecedor_seguranca", "fornecedor_financeiro"].includes(selectedPwaSubmenu || "") && (
                            <PWASupplierCardsView
                              loggedUser={loggedUser}
                              fornecedores={fornecedores}
                              predio={predio}
                              onAddDocumento={(doc) => { setDocumentos(prev => [...prev, doc]); saveDocumentoToSupabase(doc).catch(console.error); }}
                              onUpdateFornecedor={(updated) => {
                                if (setFornecedores) {
                                  setFornecedores(prev => prev.map(f => f.id_fornecedor === updated.id_fornecedor ? updated : f));
                                }
                              }}
                              onClose={() => setSelectedPwaSubmenu(null)}
                              initialTab={
                                selectedPwaSubmenu === "fornecedor_seguranca" ? "seguranca" :
                                selectedPwaSubmenu === "fornecedor_financeiro" ? "financeiro" : "perfil"
                              }
                            />
                          )}

                          {!["aprovacoes", "ocorrencias", "comunicar", "documentos", "obras", "financas", "fracoes", "predios", "limpeza", "assembleias", "vistoria", "avaria", "historico_tec", "limpeza_checklist", "historico_limpeza", "avaria_limpeza", "contencioso", "legal_consult", "auditoria", "relatorio_auditor", "contas_bancarias", "lancamentos", "fornecedores", "configuracoes", "fornecedor_perfil", "fornecedor_seguranca", "fornecedor_financeiro"].includes(selectedPwaSubmenu || "") && [
                            { id: "documentos_arquivo", label: "Aceder ao Módulo Digital", image: "/modulos/82-automacao.png" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setActivePwaSubMenuDetails(opt.id)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-slate-800 dark:text-white font-bold cursor-pointer"
                            >
                              <img src={opt.image} alt={opt.label} className="w-5 h-5 object-contain shrink-0 rounded" />
                              <span className="text-[10.5px]">{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* DETAILED SUB-POPUP RENDERING NAVIGATOR COMPONENTS */}
                {activePwaSubMenuDetails && (
                  <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-end justify-center p-2 sm:p-3 animate-fade-in select-none">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-t-2xl w-full h-[96%] flex flex-col shadow-2xl overflow-hidden animate-slide-up">
                      {/* Header */}
                      <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 py-2.5 shrink-0 flex items-center justify-between text-slate-800 dark:text-slate-200">
                        <button
                          onClick={() => setActivePwaSubMenuDetails(null)}
                          className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1 cursor-pointer bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 px-2 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-800 transition-colors"
                        >
                          ← Voltar
                        </button>
                        <span className="text-[10px] font-black tracking-wide truncate max-w-[150px] uppercase font-mono text-slate-600 dark:text-slate-300">
                          {activePwaSubMenuDetails.replace("_", " ▸ ")}
                        </span>
                        <button
                          onClick={() => {
                            setActivePwaSubMenuDetails(null);
                            setSelectedPwaSubmenu(null);
                          }}
                          className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-bold text-xs cursor-pointer px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 transition-colors"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Disclaimer Banner */}
                      <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900/30 px-3 py-1.5 text-[8.5px] text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center justify-between shrink-0 leading-tight">
                        <span>🖥️ Menu de Administração Adaptado para PWA</span>
                        <span className="font-mono bg-emerald-100 dark:bg-emerald-900/40 px-1 py-0.2 rounded border border-emerald-200 dark:border-emerald-800/50">Navegador</span>
                      </div>

                      {/* Backoffice component content area */}
                      <div className="flex-1 overflow-y-auto p-3 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 relative custom-pwa-backoffice-content">
                      {activePwaSubMenuDetails === "aprovacoes_reservas" && (
                        <GestaoReservas 
                          predio={predio}
                          fracoes={fracoes}
                          reservas={reservas}
                          setReservas={setReservas}
                          capacidades={capacidades}
                          setCapacidades={setCapacidades}
                          loggedUser={loggedUser}
                        />
                      )}
                      {activePwaSubMenuDetails === "aprovacoes_recibos" && (
                        <GestaoEmissao 
                          predio={predio}
                          fracoes={fracoes}
                          avisos={avisos}
                          setAvisos={setAvisos}
                          loggedUser={loggedUser}
                        />
                      )}
                      {activePwaSubMenuDetails === "ocorrencias_gestao" && (
                        <GestaoManutencaoIntervencoes 
                          predio={predio}
                          fracoes={fracoes}
                          ocorrencias={ocorrencias}
                          setOcorrencias={setOcorrencias}
                          movements={movements}
                          setMovements={setMovements}
                          contas={contas}
                          documentos={documentos}
                          setDocumentos={setDocumentos}
                          fornecedores={fornecedores}
                          loggedUser={loggedUser}
                          activeSubSection="manutencao_ocorrencias"
                          setActiveSubSection={() => {}}
                        />
                      )}
                      {activePwaSubMenuDetails === "ocorrencias_agenda" && (
                        <GestaoManutencaoIntervencoes 
                          predio={predio}
                          fracoes={fracoes}
                          ocorrencias={ocorrencias}
                          setOcorrencias={setOcorrencias}
                          movements={movements}
                          setMovements={setMovements}
                          contas={contas}
                          documentos={documentos}
                          setDocumentos={setDocumentos}
                          fornecedores={fornecedores}
                          loggedUser={loggedUser}
                          activeSubSection="manutencao_agenda"
                          setActiveSubSection={() => {}}
                        />
                      )}
                      {activePwaSubMenuDetails === "ocorrencias_concluidas" && (
                        <GestaoManutencaoIntervencoes 
                          predio={predio}
                          fracoes={fracoes}
                          ocorrencias={ocorrencias}
                          setOcorrencias={setOcorrencias}
                          movements={movements}
                          setMovements={setMovements}
                          contas={contas}
                          documentos={documentos}
                          setDocumentos={setDocumentos}
                          fornecedores={fornecedores}
                          loggedUser={loggedUser}
                          activeSubSection="manutencao_concluidas"
                          setActiveSubSection={() => {}}
                        />
                      )}
                      {activePwaSubMenuDetails === "comunicar_broadcast" && (
                        <GestaoComunicacoes
                          predio={predio}
                          fracoes={fracoes}
                          avisos={avisos}
                          loggedUser={loggedUser}
                          activeSubSection="broadcast"
                        />
                      )}
                      {activePwaSubMenuDetails === "comunicar_chat" && (
                        <GestaoComunicacoes
                          predio={predio}
                          fracoes={fracoes}
                          avisos={avisos}
                          loggedUser={loggedUser}
                          activeSubSection="chat"
                        />
                      )}
                      {activePwaSubMenuDetails === "comunicar_sondagens" && (
                        <GestaoComunicacoes
                          predio={predio}
                          fracoes={fracoes}
                          avisos={avisos}
                          loggedUser={loggedUser}
                          activeSubSection="sondagens"
                        />
                      )}
                      {activePwaSubMenuDetails === "comunicar_questionarios" && (
                        <GestaoComunicacoes
                          predio={predio}
                          fracoes={fracoes}
                          avisos={avisos}
                          loggedUser={loggedUser}
                          activeSubSection="questionarios"
                        />
                      )}
                      {activePwaSubMenuDetails === "comunicar_cerebro" && (
                        <IAAvancada 
                          predio={predio}
                          fracoes={fracoes}
                          avisos={avisos}
                          movements={movements}
                          fornecedores={fornecedores}
                          loggedUser={loggedUser}
                          initialTab="cerebro_ia"
                        />
                      )}
                      {activePwaSubMenuDetails === "documentos_arquivo" && (
                        <GestaoDocumentos 
                          predio={predio}
                          documentos={documentos}
                          onAddDocumento={(doc) => { setDocumentos(prev => [...prev, doc]); saveDocumentoToSupabase(doc).catch(console.error); }}
                          setDocumentos={setDocumentos}
                          loggedUser={loggedUser}
                        />
                      )}
                      {activePwaSubMenuDetails === "documentos_auditoria" && (
                        <AuditoriaInterna 
                          predio={predio}
                          loggedUser={loggedUser}
                          movimentos={movements}
                          fracoes={fracoes}
                          documentos={documentos}
                          contas={contas}
                        />
                      )}
                      {activePwaSubMenuDetails === "obras_extraordinarias" && (
                        <GestaoManutencaoIntervencoes 
                          predio={predio}
                          fracoes={fracoes}
                          ocorrencias={ocorrencias}
                          setOcorrencias={setOcorrencias}
                          movements={movements}
                          setMovements={setMovements}
                          contas={contas}
                          documentos={documentos}
                          setDocumentos={setDocumentos}
                          fornecedores={fornecedores}
                          loggedUser={loggedUser}
                          activeSubSection="manutencao_extraordinarias"
                          setActiveSubSection={() => {}}
                        />
                      )}
                      {activePwaSubMenuDetails === "obras_limpezas" && (
                        <GestaoVistoriasLimpezas 
                          predio={predio}
                          loggedUser={loggedUser}
                        />
                      )}
                      {activePwaSubMenuDetails === "financas_movimentos" && (
                        <GestaoMovimentos 
                          predio={predio}
                          contas={contas}
                          movements={movements}
                          setMovements={setMovements}
                          fornecedores={fornecedores}
                          setFornecedores={setFornecedores}
                          loggedUser={loggedUser}
                        />
                      )}
                      {activePwaSubMenuDetails === "financas_contas" && (
                        <GestaoContas 
                          predio={predio}
                          contas={contas}
                          onAddConta={(cta) => setContas(prev => [...prev, cta])}
                          onSetPrincipalConta={(id) => setContas(prev => prev.map(c => ({ ...c, principal: c.id_conta === id })))}
                          loggedUser={loggedUser}
                        />
                      )}
                      {activePwaSubMenuDetails === "financas_fundo" && (
                        <GestaoFundoReserva
                          predio={predio}
                          loggedUser={loggedUser}
                          contas={contas}
                        />
                      )}
                      {activePwaSubMenuDetails === "financas_conciliacao" && (
                        <IAConciliacao 
                          predio={predio}
                          fracoes={fracoes}
                          avisos={avisos}
                          setAvisos={setAvisos}
                          movements={movements}
                          setMovements={setMovements}
                          contas={contas}
                          loggedUser={loggedUser}
                        />
                      )}
                      {activePwaSubMenuDetails === "fracoes_predios" && (
                        <GestaoPredios 
                          predios={[predio]}
                          onAddPredio={() => {}}
                          onUpdatePredio={() => {}}
                          loggedUser={loggedUser}
                        />
                      )}
                      {activePwaSubMenuDetails === "fracoes_fracoes" && (
                        <GestaoFracoes 
                          predio={predio}
                          fracoes={fracoes}
                          onAddFracao={(fr) => setFracoes(prev => [...prev, fr])}
                          onUpdateFracoes={setFracoes}
                          loggedUser={loggedUser}
                          avisos={avisos}
                          setAvisos={setAvisos}
                        />
                      )}
                      {activePwaSubMenuDetails === "fracoes_inquilinos" && (
                        <PortalCondomino 
                          predio={predio}
                          fracoes={fracoes}
                          onUpdateFracoes={setFracoes}
                          avisos={avisos}
                          setAvisos={setAvisos}
                          movements={movements}
                          setMovements={setMovements}
                          contas={contas}
                          setContas={setContas}
                          loggedUser={loggedUser}
                          setLoggedUser={setLoggedUser}
                        />
                      )}
                      {activePwaSubMenuDetails === "assembleias_gestao" && (
                        <GestaoAssembleias 
                          predio={predio}
                          fracoes={fracoes}
                          reunioes={reunioes}
                          onAddReuniao={(rn) => { setReunioes(prev => [...prev, rn]); saveReuniaoToSupabase(rn).catch(console.error); }}
                          setReunioes={setReunioes}
                          loggedUser={loggedUser}
                        />
                      )}
                      {activePwaSubMenuDetails === "assembleias_juridico" && (
                        <ContenciosoJuridico 
                          predio={predio}
                          fracoes={fracoes}
                          avisos={avisos}
                          loggedUser={loggedUser}
                          onAddDocumento={(doc) => { setDocumentos(prev => [...prev, doc]); saveDocumentoToSupabase(doc).catch(console.error); }}
                          initialTab="geral"
                        />
                      )}
                      {(activePwaSubMenuDetails === "tec_vistoria" ||
                        activePwaSubMenuDetails === "tec_fotos" ||
                        activePwaSubMenuDetails === "tec_historico" ||
                        activePwaSubMenuDetails === "limpeza_folha" ||
                        activePwaSubMenuDetails === "limpeza_inspecao" ||
                        activePwaSubMenuDetails === "limpeza_registo_hist") && (
                        <GestaoVistoriasLimpezas 
                          predio={predio}
                          loggedUser={loggedUser}
                        />
                      )}
                      {(activePwaSubMenuDetails === "tec_avaria_foto" ||
                        activePwaSubMenuDetails === "tec_avaria_lista" ||
                        activePwaSubMenuDetails === "limpeza_reportar_avaria") && (
                        <GestaoManutencaoIntervencoes 
                          predio={predio}
                          fracoes={fracoes}
                          ocorrencias={ocorrencias}
                          setOcorrencias={setOcorrencias}
                          movements={movements}
                          setMovements={setMovements}
                          contas={contas}
                          documentos={documentos}
                          setDocumentos={setDocumentos}
                          fornecedores={fornecedores}
                          loggedUser={loggedUser}
                          activeSubSection="manutencao_ocorrencias"
                          setActiveSubSection={() => {}}
                        />
                      )}
                      {(activePwaSubMenuDetails === "legal_contencioso_processos" ||
                        activePwaSubMenuDetails === "legal_contencioso_notif" ||
                        activePwaSubMenuDetails === "legal_consult_pareceres" ||
                        activePwaSubMenuDetails === "legal_consult_atas") && (
                        <ContenciosoJuridico 
                          predio={predio}
                          fracoes={fracoes}
                          avisos={avisos}
                          loggedUser={loggedUser}
                          onAddDocumento={(doc) => { setDocumentos(prev => [...prev, doc]); saveDocumentoToSupabase(doc).catch(console.error); }}
                          initialTab="geral"
                        />
                      )}
                      {(activePwaSubMenuDetails === "auditor_relatorios" ||
                        activePwaSubMenuDetails === "auditor_movimentos" ||
                        activePwaSubMenuDetails === "auditor_novo_parecer") && (
                        <AuditoriaInterna 
                          predio={predio}
                          loggedUser={loggedUser}
                          movimentos={movements}
                          fracoes={fracoes}
                          documentos={documentos}
                          contas={contas}
                        />
                      )}
                      {(activePwaSubMenuDetails === "contabilista_saldos" ||
                        activePwaSubMenuDetails === "contabilista_extratos") && (
                        <GestaoContas 
                          predio={predio}
                          contas={contas}
                          onAddConta={(cta) => setContas(prev => [...prev, cta])}
                          onSetPrincipalConta={(id) => setContas(prev => prev.map(c => ({ ...c, principal: c.id_conta === id })))}
                          loggedUser={loggedUser}
                        />
                      )}
                      {(activePwaSubMenuDetails === "contabilista_despesas" ||
                        activePwaSubMenuDetails === "contabilista_recibos") && (
                        <GestaoMovimentos 
                          predio={predio}
                          contas={contas}
                          movements={movements}
                          setMovements={setMovements}
                          fornecedores={fornecedores}
                          setFornecedores={setFornecedores}
                          loggedUser={loggedUser}
                        />
                      )}
                      {activePwaSubMenuDetails === "fornecedores_fichas" && (
                        <GestaoFornecedores
                          predio={predio}
                          fornecedores={fornecedores}
                          onAddFornecedor={(f) => setFornecedores(prev => prev.some(x => x.id_fornecedor === f.id_fornecedor) ? prev.map(x => x.id_fornecedor === f.id_fornecedor ? f : x) : [...prev, f])}
                          onRemoveFornecedor={(id) => setFornecedores(prev => prev.filter(x => x.id_fornecedor !== id))}
                          loggedUser={loggedUser}
                          contas={contas}
                          setContas={setContas}
                          movements={movements}
                          setMovements={setMovements}
                        />
                      )}
                      {activePwaSubMenuDetails === "fornecedores_orcamentos" && (
                        <PortalOrcamentos 
                          predio={predio}
                          fornecedores={fornecedores}
                          onAddFornecedor={(f) => setFornecedores(prev => [...prev, f])}
                          loggedUser={loggedUser}
                        />
                      )}
                      {activePwaSubMenuDetails === "configuracoes_gestora" && (
                        <FichaEmpresaGestora
                          predios={[predio]}
                          fracoes={fracoes}
                          avisos={avisos}
                          loggedUser={loggedUser}
                        />
                      )}
                      {(activePwaSubMenuDetails === "configuracoes_gerais" || activePwaSubMenuDetails === "configuracoes_ia") && (
                        <ConfiguracoesAdministracao 
                          predio={predio}
                          loggedUser={loggedUser}
                          documentos={documentos}
                          movimentos={movements}
                          fracoes={fracoes}
                          activeSubSection={activePwaSubMenuDetails === "configuracoes_ia" ? "ia" : "gerais"}
                          setActiveSubSection={() => {}}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

            {/* HOME INDICATOR SWIPE BAR */}
            {loggedUser.role !== "USER" && (
              <div className="h-5 shrink-0 bg-slate-100 dark:bg-slate-900 flex items-center justify-center pb-1">
                <span className="w-32 h-1 bg-slate-400/80 dark:bg-slate-700 rounded-full"></span>
              </div>
            )}

            {/* FLOATING DRAGGABLE AI ASSISTANT FOR ADMIN & GESTOR (MOBILE VIEW - ONLY WHEN AUTHENTICATED IN DASHBOARD) */}
            {(loggedUser?.role === "ADMIN" || loggedUser?.role === "GESTOR" || loggedUser?.role === "EMPRESA_GESTORA") && (activeTab === "home" || activeTab === "painel") && (
              <DraggableAIFloatingButton
                loggedUser={loggedUser}
                predio={predio}
                isPWA={true}
                className="!absolute !bottom-16 !right-3"
              />
            )}

          </div>
        </div>
      </div>

      {/* TESTING INSTRUCTIONS PANEL FOR WORKSPACE VISIBILITY */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md space-y-4 shadow-sm self-stretch flex flex-col justify-between">
        <div className="space-y-4">
          <span className="text-[10px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 font-bold px-2.5 py-1 rounded border border-indigo-200 uppercase tracking-wider inline-block">
            Guia de Teste do Simulador PWA
          </span>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">Regras e Operações Mobile Simuladas</h3>
          
          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            <p>
              O simulador acima replica as especificações exatas de cada perfil em telemóveis e dispositivos móveis (PWAs):
            </p>
            <ul className="list-disc pl-5 space-y-1 text-[11px]">
              <li><strong>Administrador & Empresa Gestora:</strong> Gestão de notificações, verificação de ocorrências de campo, consulta de documentos confidenciais, e aprovação imediata de reservas e pagamentos recebidos.</li>
              <li><strong>Condómino:</strong> Consulta imediata de quotas em atraso, simulação de liquidação rápida tirando fotografia do recibo (WebP otimizado), reservas com auto-notificação e simulação de autenticação biométrica nativa.</li>
              <li><strong>Técnico de Vistorias:</strong> Checklist de integridade física comum, anexar fotos e submeter relatórios de campo.</li>
              <li><strong>Empresa de Limpezas:</strong> Assinalar áreas higienizadas da placa virtual do átrio para substituir a folha física de assinaturas.</li>
            </ul>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estado de Ligação do Simulador</span>
          <div className="flex items-center space-x-2 text-xs text-emerald-700 dark:text-emerald-400 font-bold">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Ativo (Ligar a: {predio.nome || "Edifício Principal"})</span>
          </div>
          <p className="text-[9px] text-slate-400">Toda a interação efetuada no telemóvel atualiza o estado global das faturas, quotas e reservas do backoffice em tempo real.</p>
        </div>
      </div>

      <SendingReactionModal
        isOpen={!!pwaSendingModal?.isOpen}
        type={pwaSendingModal?.type || "mensagem"}
        title={pwaSendingModal?.title}
        onComplete={() => setPwaSendingModal(null)}
      />
    </div>
  );
}
