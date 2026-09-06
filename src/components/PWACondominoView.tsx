import React, { useState, useEffect, useRef } from "react";
import { ActionIcon } from "./ActionIcon";
const logoutIcon = "/estados-acoes/17-desligar.png";
const terminarSessaoIcon = "/estados-acoes/16-terminar-sessao.png";
import { motion } from "motion/react";
import { 
  LoggedUser, 
  Predio, 
  Documento, 
  Ocorrencia, 
  Reserva, 
  Movimento, 
  Aviso 
} from "../types";
import { generateAndDownloadPdf, downloadEmailDocument, exportToXLS, downloadBlob } from "../utils";
import { GestaoDocumentos } from "./GestaoDocumentos";
import { UserSecuritySubmenu } from "./UserSecuritySubmenu";
import { DraggableAIFloatingButton } from "./DraggableAIFloatingButton";
import { playVoiceNoteSimulation } from "../lib/soundService";
import { 
  Smartphone, 
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
  Volume2,
  Mic,
  Plus, 
  Brush, 
  Trash2, 
  Archive, 
  Check, 
  Clock, 
  ArrowRight, 
  Send, 
  Building,
  Info,
  Search,
  Copy,
  ChevronRight,
  ShieldAlert,
  HelpCircle,
  Vote,
  Download,
  Eye,
  SlidersHorizontal,
  ThumbsUp,
  Star,
  RefreshCw,
  Lock,
  Paperclip,
  Smile,
  File,
  Image,
  Play,
  Pause,
  X
} from "lucide-react";

interface PWACondominoViewProps {
  loggedUser: LoggedUser;
  predio: Predio;
  condominoFracao: any;
  documentos: Documento[];
  setDocumentos?: React.Dispatch<React.SetStateAction<Documento[]>>;
  ocorrencias: Ocorrencia[];
  reservas: Reserva[];
  movements: Movimento[];
  avisos: Aviso[];
  customMessages: any[];
  handleEnviarMensagem: (e: React.FormEvent) => void;
  newMsgText: string;
  setNewMsgText: (t: string) => void;
  pwaNotifications: any[];
  setPwaNotifications: React.Dispatch<React.SetStateAction<any[]>>;
  onLogout?: () => void;
  biometricsEnabled?: boolean;
  setBiometricsEnabled?: (b: boolean) => void;
  theme?: "light" | "dark";
}

export default function PWACondominoView({
  loggedUser,
  predio,
  condominoFracao,
  documentos,
  setDocumentos,
  ocorrencias,
  reservas,
  movements,
  avisos,
  customMessages,
  handleEnviarMensagem,
  newMsgText,
  setNewMsgText,
  pwaNotifications,
  setPwaNotifications,
  onLogout,
  biometricsEnabled = false,
  setBiometricsEnabled,
  theme = "light"
}: PWACondominoViewProps) {
  // Mobile app navigation: handles both bottom quick tabs and the 10 modules
  const [activeTab, setActiveTab] = useState<string>("home");

  // Local biometric simulation states
  const [simulatingScan, setSimulatingScan] = useState(false);
  const [simulatingScanProgress, setSimulatingScanProgress] = useState(0);

  // Dynamic States for PWA Requirements
  const [hasUnreadMessages, setHasUnreadMessages] = useState(true);
  const [selectedSubmenu, setSelectedSubmenu] = useState<string | null>(null);
  const [activePwaModal, setActivePwaModal] = useState<string | null>(null);

  // Audio recording, attachments & emojis states for chat
  const [isRecordingChatAudio, setIsRecordingChatAudio] = useState(false);
  const [chatAudioTimer, setChatAudioTimer] = useState(0);
  const [chatAudioData, setChatAudioData] = useState<string | null>(null);
  const [chatPhotoWebp, setChatPhotoWebp] = useState<string | null>(null);
  const [chatPhotoName, setChatPhotoName] = useState<string | null>(null);
  const [chatDocAttachment, setChatDocAttachment] = useState<{ name: string; size: string } | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  useEffect(() => {
    let interval: any = null;
    if (isRecordingChatAudio) {
      interval = setInterval(() => {
        setChatAudioTimer(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRecordingChatAudio]);
  const [closedNotifs, setClosedNotifs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("pwa_closed_notifications");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const allNotifs = [
    { id: "notif-elevador", type: "amber", text: "Intervenção técnica aberta: Elevador nº 2" },
    { id: "notif-sondagem", type: "indigo", text: "Nova sondagem disponível sobre o Prédio" },
    { id: "notif-higiene", type: "emerald", text: "Higiene Semanal Concluída com sucesso" },
  ];

  const activeNotifs = allNotifs.filter(n => !closedNotifs.includes(n.id));

  const closeNotif = (id: string) => {
    const updated = [...closedNotifs, id];
    setClosedNotifs(updated);
    try {
      localStorage.setItem("pwa_closed_notifications", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // State managers for interactive simulations
  const [votedPoll, setVotedPoll] = useState<string | null>(null);
  const [votosSimulados, setVotosSimulados] = useState({ sim: 8, nao: 3, adiar: 1 });
  const [quotaState, setQuotaState] = useState<"pago" | "atraso" | "processamento" | "multiplo" | "cobranca">("pago");
  const [hasScrolled, setHasScrolled] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [simulateExtraQuota, setSimulateExtraQuota] = useState<boolean>(true);
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentCategory, setDocumentCategory] = useState("Todos");
  const [selectedDocPreview, setSelectedDocPreview] = useState<Documento | null>(null);

  const getNotificationCount = (cardId: string) => {
    if (cardId === "ocorrencias") return 1;
    if (cardId === "financas") return quotaState === 'atraso' ? 1 : 0;
    if (cardId === "comunicacoes") return hasUnreadMessages ? 1 : 0;
    if (cardId === "documentos") return 0;
    if (cardId === "reservas_limpezas") return 0;
    if (cardId === "limpezas") return 0;
    if (cardId === "fornecedores") return 0;
    if (cardId === "sondagens") return votedPoll ? 0 : 1;
    if (cardId === "obras") return 0;
    return 0;
  };

  const getPillTextForCard = (cardId: string) => {
    switch (cardId) {
      case "ocorrencias": return "1 Ativa";
      case "financas": return quotaState === 'atraso' ? "1 Atraso" : "Regularizado";
      case "comunicacoes": return hasUnreadMessages ? "+1 Nova" : "Sem Alertas";
      case "documentos": return "4 Ficheiros";
      case "reservas_limpezas": return "Ativo";
      case "limpezas": return "Relatórios";
      case "fornecedores": return "Ativos";
      case "sondagens": return votedPoll ? "Votado" : "1 Ativa";
      case "obras": return "Histórico";
      default: return "Ativo";
    }
  };

  // Módulo 3 - Intervenções States
  const [intervencoesList, setIntervencoesList] = useState<Array<{
    id: string;
    equipamento: string;
    descricao: string;
    estado: "Pendente" | "Em curso" | "Concluido";
    data: string;
    fornecedor: string;
    foto?: string;
  }>>([
    { id: "INT-001", equipamento: "Elevador nº 2", descricao: "Avaria técnica - ruído excessivo nas subidas", estado: "Em curso", data: "12/07/2026", fornecedor: "Otis Portugal Lda" },
    { id: "INT-002", equipamento: "Portão Garagem", descricao: "Substituição de molas e afinação mecânica", estado: "Concluido", data: "05/06/2026", fornecedor: "Portas & Motores Lda" },
  ]);
  const [newIntervEquipamento, setNewIntervEquipamento] = useState("Elevador");
  const [newIntervDesc, setNewIntervDesc] = useState("");
  const [newIntervPhoto, setNewIntervPhoto] = useState<string | null>(null);
  const [newIntervPhotoName, setNewIntervPhotoName] = useState("");

  // Módulo 5 - Limpezas Rating State
  const [cleaningRatings, setCleaningRatings] = useState<Record<string, number>>({});
  const [cleaningComments, setCleaningComments] = useState<Record<string, string>>({});
  const [limpezasHistorico, setLimpezasHistorico] = useState([
    { id: "LIMP-03", data: "12/07/2026", hora: "10:32", tecnico: "Maria Santos", avariaDetetada: "Porta do ginásio não fecha", estado: "Concluído" },
    { id: "LIMP-02", data: "08/07/2026", hora: "09:15", tecnico: "Carla Pires", avariaDetetada: "Nenhuma", estado: "Concluído" },
    { id: "LIMP-01", data: "01/07/2026", hora: "14:00", tecnico: "Maria Santos", avariaDetetada: "Lâmpada fundida no átrio", estado: "Concluído" }
  ]);

  // Módulo 6 - Financeiro States
  const [comprovativoUpload, setComprovativoUpload] = useState<string | null>(null);
  const [comprovativoFileName, setComprovativoFileName] = useState("");
  const [comprovativoExtracting, setComprovativoExtracting] = useState(false);
  const [comprovativoExtractedData, setComprovativoExtractedData] = useState<any | null>(null);
  const [financeiroMovimentos, setFinanceiroMovimentos] = useState<Array<{
    id: string;
    tipo: "Quota Ordinária" | "Cota Extraordinária" | "Comprovativo Enviado";
    data: string;
    descricao: string;
    valor: number;
    estado: "Pago" | "Pendente" | "Processado" | "Em atraso";
    referencia?: string;
  }>>([
    { id: "MOV-302", tipo: "Quota Ordinária", data: "01/07/2026", descricao: "Quota Mensal - Fração 3ºE (Julho 2026)", valor: 45.00, estado: "Pago", referencia: "RB23E" },
    { id: "MOV-301", tipo: "Cota Extraordinária", data: "15/06/2026", descricao: "Pintura das fachadas e escadas - Prestação 1/1", valor: 35.00, estado: "Pago", referencia: "RB23E_PINTURA" },
    { id: "MOV-300", tipo: "Quota Ordinária", data: "01/06/2026", descricao: "Quota Mensal - Fração 3ºE (Junho 2026)", valor: 45.00, estado: "Pago", referencia: "RB23E" }
  ]);

  // Módulo 10 - Perfil States
  const [perfilNome, setPerfilNome] = useState(loggedUser.nome || "João Silva");
  const [perfilEmail, setPerfilEmail] = useState(loggedUser.email || "joao.silva@gmail.com");
  const [perfilTlm, setPerfilTlm] = useState("912 345 678");
  const [perfilNif, setPerfilNif] = useState("245 889 112");
  const [perfilNascimento, setPerfilNascimento] = useState("15/04/1988");
  const perfilMorada = "Rua Bento Rodrigues, nº 23, 3º Esquerdo, 1200-112 Lisboa";
  const [perfilIban, setPerfilIban] = useState("PT50 0033 0000 1234 5678 9012 3");
  const [perfilBanco, setPerfilBanco] = useState("Banco Montepio");
  const [perfilIbanTitular, setPerfilIbanTitular] = useState("João Silva");
  const [perfilAvatar, setPerfilAvatar] = useState<string | null>(null);
  const [perfilPassword, setPerfilPassword] = useState("••••••••");
  const [perfilShowPassModal, setPerfilShowPassModal] = useState(false);
  const [perfilNewPass, setPerfilNewPass] = useState("");

  // Helper Rule B1: 1ª letra de cada nome da rua + número + piso + letra(s) -> Exemplo: RB23E
  const generateFractionRef = () => {
    const street = "Rua Bento Rodrigues";
    const num = "23";
    const floor = "3";
    const letter = "E";
    
    // Split street and filter short words
    const words = street.split(/\s+/).filter(w => w.length > 2 && !["dos", "das", "para"].includes(w.toLowerCase()));
    const streetLetters = words.slice(0, 2).map(w => w.charAt(0).toUpperCase()).join(""); // RB
    return `${streetLetters}${num}${floor}${letter}`; // RB23E
  };

  const fractionRef = generateFractionRef();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
          // Converter automaticamente para .WEBP (comprimido e otimizado)
          const webpDataUrl = canvas.toDataURL("image/webp", 0.8);
          setPerfilAvatar(webpDataUrl);
          alert("Sucesso! A fotografia foi carregada e convertida automaticamente para o formato moderno .WEBP.");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Estados para reserva de espaços nos modais pop-up
  const [bookingSpace, setBookingSpace] = useState("Salão de Festas");
  const [bookingDate, setBookingDate] = useState("2026-07-25");
  const [bookingTime, setBookingTime] = useState("14:00 - 18:00");
  const [bookingGuests, setBookingGuests] = useState(15);

  // Handle mock vote
  const handleVote = (opcao: string) => {
    setVotedPoll(opcao);
    if (opcao === "Sim") {
      setVotosSimulados(p => ({ ...p, sim: p.sim + 1 }));
    } else if (opcao === "Não") {
      setVotosSimulados(p => ({ ...p, nao: p.nao + 1 }));
    } else {
      setVotosSimulados(p => ({ ...p, adiar: p.adiar + 1 }));
    }
    alert(`Voto "${opcao}" submetido com sucesso!`);
  };

  // Handle reporting avaria (Módulo 3)
  const handleReportAvaria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIntervDesc) {
      alert("Por favor escreva uma descrição.");
      return;
    }
    const newId = `INT-${Math.floor(Math.random() * 900) + 100}`;
    const newRecord = {
      id: newId,
      equipamento: newIntervEquipamento,
      descricao: newIntervDesc,
      estado: "Pendente" as const,
      data: new Date().toLocaleDateString("pt-PT"),
      fornecedor: "Aguardando triagem da administração",
      foto: newIntervPhoto || undefined
    };

    setIntervencoesList(prev => [newRecord, ...prev]);
    
    // Automatically add to global notifications
    const newNotif = {
      id: `NOT-${Date.now()}`,
      title: "Intervenção Aberta",
      desc: `Registou uma nova avaria em "${newIntervEquipamento}".`,
      date: "Hoje",
      isArchived: false
    };
    setPwaNotifications(prev => [newNotif, ...prev]);

    alert("Avaria reportada com sucesso! A administração foi notificada.");
    setNewIntervDesc("");
    setNewIntervPhoto(null);
    setNewIntervPhotoName("");
    setActiveTab("intervencoes");
  };

  // Touch Signature Pad States & Handlers for PWA Assembleia Atas
  const [signingAtaTarget, setSigningAtaTarget] = useState<any | null>(null);
  const pwaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingPwa, setIsDrawingPwa] = useState(false);
  const [hasSignaturePwa, setHasSignaturePwa] = useState(false);

  const startDrawingPwa = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = pwaCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setIsDrawingPwa(true);
    setHasSignaturePwa(true);
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#10b981";
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const drawPwa = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingPwa) return;
    const canvas = pwaCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawingPwa = () => {
    setIsDrawingPwa(false);
  };

  const clearPwaCanvas = () => {
    const canvas = pwaCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignaturePwa(false);
    }
  };

  const confirmPwaSignature = () => {
    if (!hasSignaturePwa) {
      alert("Por favor desenhe a sua assinatura no quadro tátil antes de confirmar!");
      return;
    }
    
    setPwaNotifications(prev => [{
      id: `NOT-${Date.now()}`,
      title: "Ata Assinada Digitalmente",
      desc: `Assinou e autenticou digitalmente a Ata ${signingAtaTarget?.id || 'ATA-056'} no ecrã tátil!`,
      date: "Hoje",
      isArchived: false
    }, ...prev]);

    alert(`✓ Assinatura Digital de ${loggedUser.nome} autenticada com sucesso! O documento foi assinado, carimbado com hora oficial e arquivado.`);
    setSigningAtaTarget(null);
    setActivePwaModal(null);
  };

  // Handle Comprovativo upload and mock IA extraction (Módulo 6)
  const handleComprovativoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setComprovativoFileName(file.name);
      setComprovativoExtracting(true);
      
      // Simulate real-time IA extraction
      setTimeout(() => {
        setComprovativoUpload("data:application/pdf;base64,mockextracted");
        setComprovativoExtractedData({
          valor: 45.00,
          data: new Date().toLocaleDateString("pt-PT"),
          referencia: fractionRef,
          ibanOrigem: "PT50 9876 5432 1098 7654 3210 9",
          classificacao: "Quota Ordinária - Julho 2026",
          sugestaoLancamento: "Lançamento múltiplo sugerido: Liquidar Quota Ordinária Julho (45.00€). Estado atualizado para PAGO.",
          ajusteFuturo: "Ajuste automático de cobranças futuras detetado pela IA."
        });
        setComprovativoExtracting(false);
        alert("A IA leu e digitalizou o documento com sucesso!");
      }, 1500);
    }
  };

  // Submit Comprovativo and update movements
  const handleConfirmComprovativo = () => {
    if (!comprovativoExtractedData) return;

    const newMov = {
      id: `MOV-${Math.floor(Math.random() * 900) + 310}`,
      tipo: "Comprovativo Enviado" as const,
      data: comprovativoExtractedData.data,
      descricao: `Comprovativo Submetido: ${comprovativoExtractedData.classificacao}`,
      valor: comprovativoExtractedData.valor,
      estado: "Processado" as const,
      referencia: comprovativoExtractedData.referencia
    };

    setFinanceiroMovimentos(prev => [newMov, ...prev]);
    setQuotaState("pago");
    
    // Add notification
    const newNotif = {
      id: `NOT-${Date.now()}`,
      title: "Comprovativo Validado",
      desc: "Comprovativo de pagamento lido pela IA e validado pela administração.",
      date: "Hoje",
      isArchived: false
    };
    setPwaNotifications(prev => [newNotif, ...prev]);

    alert("Pagamento processado e quota liquidada com sucesso em tempo real!");
    setComprovativoUpload(null);
    setComprovativoFileName("");
    setComprovativoExtractedData(null);
  };

  // Copy text helper
  const handleCopyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copiado para a área de transferência!`);
  };

  return (
    <div 
      className={`flex flex-col h-full font-sans relative z-10 pwa-screen ${
        theme === "dark" ? "bg-slate-950 text-white" : "bg-[#ece7e7] text-slate-800"
      }`} 
      data-pwa="true"
      style={{ backgroundColor: theme === "dark" ? "#020617" : "#ece7e7" }}
    >
      
      {/* BODY PANEL (SCROLLABLE CONTENT AREA) */}
      <div 
        onScroll={(e) => {
          if (e.currentTarget.scrollTop > 30) {
            setHasScrolled(true);
          }
        }}
        className={`flex-1 overflow-y-auto px-4 py-3 space-y-3 relative pwa-container ${
          theme === "dark" ? "bg-slate-950 text-white" : "bg-[#ece7e7] text-slate-800"
        }`} 
        style={{ backgroundColor: theme === "dark" ? "#020617" : "#ece7e7" }}
      >

        {/* ========================================== */}
        {activeTab === "home" && (
          <div className="space-y-3.5 animate-fade-in" id="pwa-modulo-dashboard">
            {/* Welcome banner & Fraction info */}
            <div className="bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-xl p-3 shadow-sm relative overflow-hidden flex justify-between items-center">
              <div className="space-y-0.5">
                <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider block">Condomínio Activo PWA</span>
                <h2 className="text-xs font-black tracking-tight">Olá, {perfilNome}</h2>
                <span className="bg-slate-200 dark:bg-slate-800 text-[8px] px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 inline-block font-mono text-slate-700 dark:text-slate-300">Fração 3ºE</span>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => {
                    if (onLogout) {
                      onLogout();
                    } else {
                      alert("Sessão Terminada (Sair)");
                    }
                  }} 
                  className="px-2.5 py-1 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border border-red-500 text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-sm hover:scale-105 active:scale-95 active:ring-2 active:ring-red-400 shrink-0"
                  title="Sair / Terminar Sessão"
                >
                    <img src="/estados-acoes/17-desligar.png" alt="Sair" className="h-4 w-4 object-contain" />
                  <span>Sair</span>
                </button>
              </div>
            </div>

            {/* STATEFUL CLOSEABLE NOTIFICATIONS - Conforme as Regras Finais */}
            {activeNotifs.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-extrabold text-rose-500 uppercase tracking-widest block">
                    🔔 Alertas & Notificações Ativos
                  </span>
                  <span className="text-[7px] text-slate-400 uppercase font-bold">Deslize para a direita para fechar</span>
                </div>
                <div className="space-y-1.5 text-[10px] overflow-hidden">
                  {activeNotifs.map((notif) => (
                    <motion.div 
                      key={notif.id} 
                      drag="x"
                      dragConstraints={{ left: 0, right: 300 }}
                      onDragEnd={(event, info) => {
                        if (info.offset.x > 100) {
                          closeNotif(notif.id);
                        }
                      }}
                      className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-850 cursor-grab active:cursor-grabbing touch-none select-none"
                    >
                      <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          notif.type === "amber" ? "bg-amber-500" :
                          notif.type === "indigo" ? "bg-indigo-500" : "bg-emerald-500"
                        }`}></span>
                        <span className="font-medium">{notif.text}</span>
                      </div>
                      <button 
                        onClick={() => closeNotif(notif.id)}
                        className="text-slate-400 hover:text-rose-500 font-black text-xs cursor-pointer px-1 z-10"
                        title="Marcar como lida e fechar permanentemente"
                      >
                        ✕
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* SQUARE CARDS BENTO GRID - UNIFORM DIMENSIONS AND DARKER GREEN DISPLAY */}
            <div className="space-y-2">
              <span className="text-[9px] font-extrabold text-[#333] dark:text-white uppercase tracking-widest block">
                📋 Painel do Condómino (Cards de Estado)
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: "ocorrencias", label: "Ocorrências", desc: "Avarias & Apoio", image: "/modulos/29-avaria.png" },
                  { id: "financas", label: "Finanças", desc: "4.8k€ / 15.2k€", image: "/modulos/59-recibo.png" },
                  { id: "comunicacoes", label: "Comunicados", desc: "Canal Interno & Avisos", image: "/modulos/21-notificacoes-inquilino.png" },
                  { id: "documentos", label: "Arquivo Digital", desc: "Ficheiros & Fotos", image: "/modulos/27-arquivo-automatico.png" },
                  { id: "reservas_limpezas", label: "Reservas", desc: "Áreas Comuns", image: "/modulos/82-automacao.png" },
                  { id: "limpezas", label: "Limpezas", desc: "Relatórios de Higiene", image: "/modulos/50-limpeza.png" },
                  { id: "fornecedores", label: "Fornecedores", desc: "Prestadores Ativos", image: "/modulos/67-fornecedor.png" },
                  { id: "sondagens", label: "Sondagens", desc: "Decisões e Votos", image: "/modulos/70-pessoa-de-contacto.png" },
                  { id: "obras", label: "Obras", desc: "Melhorias Prédio", image: "/modulos/41-obra.png" }
                ].filter(card => !(loggedUser.role === "INQUILINO" && card.id === "financas")).map(card => {
                  const notifCount = getNotificationCount(card.id);
                  return (
                    <button
                      key={card.id}
                      onClick={() => setSelectedSubmenu(selectedSubmenu === card.id ? null : card.id)}
                      className={`w-full h-[115px] bg-emerald-50 hover:bg-emerald-100/90 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-950 dark:text-emerald-100 border-2 border-emerald-500 dark:border-emerald-400/80 rounded-2xl flex flex-col items-center justify-between text-center p-2.5 relative select-none hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-sm ${
                        selectedSubmenu === card.id ? "ring-2 ring-emerald-600 border-emerald-600 shadow-md" : ""
                      }`}
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
              </div>
            </div>

            {/* INTERACTIVE SUBMENUS ON CLICK (CARDS ABREM SUBMENUS CORRESPONDENTES COMO JANELA POP UP SOBREPOSTA NO ECRÃ PRINCIPAL) */}
            {selectedSubmenu && (
              <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white text-slate-800 p-5 rounded-2xl shadow-2xl border border-slate-200 space-y-4 max-w-xs w-full text-[11px]" style={{ backgroundColor: "#ffffff" }}
                >
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="font-black uppercase tracking-wider text-emerald-600 text-[10px] flex items-center">
                      ✨ Opções: {selectedSubmenu.replace("_", " ").toUpperCase()}
                    </span>
                    <button 
                      onClick={() => setSelectedSubmenu(null)}
                      className="text-slate-400 hover:text-white font-bold text-xs p-1 cursor-pointer"
                    >
                      Fechar ✕
                    </button>
                  </div>

                  {selectedSubmenu === "ocorrencias" && (
                    <div className="space-y-3">
                      <p className="text-slate-300 text-[10px] leading-relaxed">Tem uma avaria a reportar no seu prédio? Utilize os botões abaixo:</p>
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => { setActivePwaModal("reportar_avaria"); setSelectedSubmenu(null); }} 
                          className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2.5 rounded-xl text-center cursor-pointer transition-colors"
                        >
                          ⚠️ Reportar Nova Avaria
                        </button>
                        <button 
                          onClick={() => { setActivePwaModal("ver_intervencoes"); setSelectedSubmenu(null); }} 
                          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-center border border-slate-700 cursor-pointer transition-colors"
                        >
                          Ver Intervenções em Curso
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedSubmenu === "financas" && (
                    <div className="space-y-3">
                      <p className="text-slate-300 text-[10px] leading-relaxed">Consulte o extrato ou faça o envio de comprovativos de pagamento:</p>
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => { setActivePwaModal("enviar_comprovativo"); setSelectedSubmenu(null); }} 
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-2.5 rounded-xl text-center cursor-pointer transition-colors"
                        >
                          📊 Enviar Comprovativo MB
                        </button>
                        <button 
                          onClick={() => { setActivePwaModal("consultar_referencias"); setSelectedSubmenu(null); }} 
                          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-center border border-slate-700 cursor-pointer transition-colors"
                        >
                          Consultar Referências
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedSubmenu === "comunicacoes" && (
                    <div className="space-y-3">
                      <p className="text-slate-300 text-[10px] leading-relaxed">Central de Comunicação Integrada com a Empresa Gestora:</p>
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => { setActivePwaModal("chat_admin"); setSelectedSubmenu(null); setHasUnreadMessages(false); }} 
                          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-black py-2.5 rounded-xl text-center cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs"
                        >
                          <i className="fa-solid fa-comments"></i>
                          <span>Caixa Inbox & Chat Direto</span>
                        </button>
                        <button 
                          onClick={() => { setActivePwaModal("responder_sondagem"); setSelectedSubmenu(null); }} 
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-center cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs"
                        >
                          <i className="fa-solid fa-square-poll-horizontal"></i>
                          <span>Sondagens & Questionários</span>
                        </button>
                        <button 
                          onClick={() => { setActivePwaModal("contactos_emergencia"); setSelectedSubmenu(null); }} 
                          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-center border border-slate-700 cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs"
                        >
                          <i className="fa-solid fa-phone-volume text-red-400"></i>
                          <span>Contactos de Emergência</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedSubmenu === "documentos" && (
                    <div className="space-y-3">
                      <p className="text-slate-300 text-[10px] leading-relaxed">Aceda à sua Biblioteca Documental IA inteligente:</p>
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => { setDocumentCategory("Todos"); setActivePwaModal("arquivo_completo"); setSelectedSubmenu(null); }} 
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-2.5 rounded-xl text-center cursor-pointer transition-colors"
                        >
                          📂 Abrir Arquivo Completo
                        </button>
                        <button 
                          onClick={() => { setDocumentCategory("Pendentes"); setActivePwaModal("atas_pendentes"); setSelectedSubmenu(null); }} 
                          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-center border border-slate-700 cursor-pointer transition-colors"
                        >
                          Ver Atas Pendentes
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedSubmenu === "reservas_limpezas" && (
                    <div className="space-y-3">
                      <p className="text-slate-300 text-[10px] leading-relaxed">Faça reservas de espaços comuns ou consulte as tarefas de limpeza:</p>
                      <div className="flex flex-col gap-2">
                        {(predio as any).tem_espacos_comuns !== false ? (
                          <button 
                            onClick={() => { setActivePwaModal("reservar_espaco"); setSelectedSubmenu(null); }} 
                            className="w-full bg-teal-500 hover:bg-teal-600 text-slate-950 font-black py-2.5 rounded-xl text-center cursor-pointer transition-colors"
                          >
                            📅 Reservar Espaço Comum
                          </button>
                        ) : (
                          <button 
                            onClick={() => { setActivePwaModal("ver_limpezas"); setSelectedSubmenu(null); }} 
                            className="w-full bg-teal-500 hover:bg-teal-600 text-slate-950 font-black py-2.5 rounded-xl text-center cursor-pointer transition-colors"
                          >
                            🧼 Ver Escala de Limpeza
                          </button>
                        )}
                        <button 
                          onClick={() => { setActivePwaModal("avaliar_servico"); setSelectedSubmenu(null); }} 
                          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-center border border-slate-700 cursor-pointer transition-colors"
                        >
                          Avaliar Serviço Recente
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedSubmenu === "sondagens" && (
                    <div className="space-y-3">
                      <p className="text-slate-300 text-[10px] leading-relaxed">Participe nas decisões coletivas respondendo às sondagens:</p>
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => { setActivePwaModal("responder_sondagem"); setSelectedSubmenu(null); }} 
                          className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2.5 rounded-xl text-center cursor-pointer transition-colors"
                        >
                          🗳️ Responder Sondagens Ativas
                        </button>
                        <button 
                          onClick={() => { setActivePwaModal("estatisticas_sondagem"); setSelectedSubmenu(null); }} 
                          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-center border border-slate-700 cursor-pointer transition-colors"
                        >
                          Consultar Estatísticas
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedSubmenu === "obras" && (
                    <div className="space-y-3">
                      <p className="text-slate-300 text-[10px] leading-relaxed">Acompanhe as obras extraordinárias aprovadas e planeadas:</p>
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => { setActivePwaModal("obras_curso"); setSelectedSubmenu(null); }} 
                          className="w-full bg-purple-500 hover:bg-purple-600 text-white font-black py-2.5 rounded-xl text-center cursor-pointer transition-colors"
                        >
                          🔨 Acompanhar Obras em Curso
                        </button>
                        <button 
                          onClick={() => { setActivePwaModal("plano_plurianual"); setSelectedSubmenu(null); }} 
                          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-center border border-slate-700 cursor-pointer transition-colors"
                        >
                          Ver Plano Plurianual
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedSubmenu === "limpezas" && (
                    <div className="space-y-3">
                      <p className="text-slate-300 text-[10px] leading-relaxed">Consulte os relatórios e escalas ou avalie o serviço de higienização:</p>
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => { setActivePwaModal("ver_limpezas"); setSelectedSubmenu(null); }} 
                          className="w-full bg-teal-500 hover:bg-teal-600 text-slate-950 font-black py-2.5 rounded-xl text-center cursor-pointer transition-colors"
                        >
                          🧼 Escala de Limpezas & Relatório
                        </button>
                        <button 
                          onClick={() => { setActivePwaModal("avaliar_servico"); setSelectedSubmenu(null); }} 
                          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-center border border-slate-700 cursor-pointer transition-colors"
                        >
                          ⭐ Avaliar Serviço de Limpezas
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedSubmenu === "fornecedores" && (
                    <div className="space-y-3">
                      <p className="text-slate-300 text-[10px] leading-relaxed">Contatos e fichas técnicas dos parceiros ativos no prédio:</p>
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => { setActivePwaModal("contactos_emergencia"); setSelectedSubmenu(null); }} 
                          className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-black py-2.5 rounded-xl text-center cursor-pointer transition-colors"
                        >
                          📞 Contatos de Emergência & Técnicos
                        </button>
                        <button 
                          onClick={() => {
                            alert("Lista de Fornecedores Ativos:\n- Otis Elevadores: 800 200 100\n- CleanCondo Lda: 210 333 444\n- ElectroMelo Assistência: 910 444 555");
                            setSelectedSubmenu(null);
                          }} 
                          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-center border border-slate-700 cursor-pointer transition-colors"
                        >
                          📋 Ver Fichas de Fornecedores
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* MÓDULO 2 — DOCUMENTOS (Biblioteca Documental & Arquivo) */}
        {/* ========================================== */}
        {(activeTab === "documentos" || activeTab === "arquivo") && (
          <div className="space-y-4 animate-fade-in" id="pwa-modulo-documentos">
            <GestaoDocumentos
              predio={predio}
              documentos={documentos}
              onAddDocumento={(doc) => setDocumentos(prev => [...prev, doc])}
              setDocumentos={setDocumentos}
              loggedUser={loggedUser}
            />
          </div>
        )}
        {false && activeTab === "documentos" && (
          <div className="space-y-4 animate-fade-in" id="pwa-modulo-documentos">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black tracking-tight text-slate-800 dark:text-white">📂 Arquivo de Documentos</h3>
              </div>
              <span className="text-[8px] bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-extrabold px-2 py-0.5 rounded uppercase font-mono">IA Organizer Active</span>
            </div>

            {/* Smart Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input 
                type="text"
                placeholder="Pesquisa inteligente de faturas, atas..."
                value={documentSearch}
                onChange={e => setDocumentSearch(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 pl-8.5 pr-3 py-1.5 text-[10px] rounded-lg focus:outline-none focus:border-emerald-500 dark:text-white font-medium"
              />
            </div>

            {/* Quick Categories Filter */}
            <div className="flex space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-[9px] font-bold">
              {["Todos", "Fração", "Prédio", "Regulamentos", "Seguros", "Contratos", "Faturas"].map(cat => (
                <button
                  key={cat}
                  onClick={() => setDocumentCategory(cat)}
                  className={`px-2.5 py-1 shrink-0 rounded-full border transition-all cursor-pointer ${
                    documentCategory === cat 
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" 
                      : "bg-white dark:bg-slate-900 text-slate-500 border-slate-150 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-850"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* IA Folders Visualization */}
            <div className="bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100/40 dark:border-indigo-900/20 p-2.5 rounded-xl space-y-1.5">
              <span className="text-[8px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">
                🤖 Pastas Organizadas por IA
              </span>
              <div className="grid grid-cols-3 gap-2 text-[9px] font-bold text-slate-600 dark:text-white">
                <div className="p-1.5 bg-white dark:bg-slate-900 border border-indigo-50 dark:border-slate-800 rounded-lg text-center flex flex-col items-center justify-center space-y-1">
                  <span className="text-base">📁</span>
                  <span className="text-[8px] truncate max-w-[60px] block">Frações</span>
                  <span className="text-[7px] text-slate-400">2 ficheiros</span>
                </div>
                <div className="p-1.5 bg-white dark:bg-slate-900 border border-indigo-50 dark:border-slate-800 rounded-lg text-center flex flex-col items-center justify-center space-y-1">
                  <span className="text-base">📁</span>
                  <span className="text-[8px] truncate max-w-[60px] block">Condomínio</span>
                  <span className="text-[7px] text-slate-400">6 ficheiros</span>
                </div>
                <div className="p-1.5 bg-white dark:bg-slate-900 border border-indigo-50 dark:border-slate-800 rounded-lg text-center flex flex-col items-center justify-center space-y-1">
                  <span className="text-base">📁</span>
                  <span className="text-[8px] truncate max-w-[60px] block">Faturas</span>
                  <span className="text-[7px] text-slate-400">24 faturas</span>
                </div>
              </div>
            </div>

             {/* List of Documents */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Documentos Oficiais</span>
                <button
                  onClick={() => {
                    const filteredDocs = documentos
                      .filter(doc => 
                        documentCategory === "Todos" || 
                        doc.categoria?.toLowerCase() === documentCategory.toLowerCase() || 
                        (documentCategory === "Fração" && doc.categoria === "Privado") || 
                        (documentCategory === "Prédio" && doc.categoria === "Público") ||
                        (documentCategory === "Biblioteca" && (doc.categoria === "Público" || doc.categoria?.toLowerCase() === "regulamentos" || doc.categoria?.toLowerCase() === "contratos" || doc.categoria?.toLowerCase() === "atas" || doc.categoria?.toLowerCase() === "seguros"))
                      )
                      .filter(doc => doc.nome.toLowerCase().includes(documentSearch.toLowerCase()));
                    
                    if (selectedDocIds.length === filteredDocs.length) {
                      setSelectedDocIds([]);
                    } else {
                      setSelectedDocIds(filteredDocs.map(d => d.id_doc));
                    }
                  }}
                  className="text-[8px] text-indigo-600 dark:text-indigo-400 hover:underline font-extrabold cursor-pointer"
                >
                  {selectedDocIds.length > 0 ? "Limpar Seleção" : "Selecionar Todos"}
                </button>
              </div>

              {/* Batch Action Bar */}
              {selectedDocIds.length > 0 && (
                <div className="bg-indigo-600 text-white p-2 rounded-lg flex items-center justify-between text-[9px] font-bold shadow animate-slide-up">
                  <span>{selectedDocIds.length} documento(s) selecionado(s)</span>
                  <div className="flex space-x-1.5">
                    <button
                      onClick={() => {
                        const selectedDocs = documentos.filter(d => selectedDocIds.includes(d.id_doc));
                        const docListText = selectedDocs.map(d => `• ${d.nome} (${d.categoria || "Geral"}) - Envio: ${d.data_upload}`).join("\n");
                        generateAndDownloadPdf(
                          "Pacote Consolidado de Documentos do Condomínio",
                          [{ heading: "Lista de Documentos Selecionados", content: docListText || "Todos os documentos registados no arquivo digital." }],
                          `Pacote_Documentos_${predio.nome.replace(/\s+/g, '_')}.pdf`,
                          [{ label: "Edifício", value: predio.nome }, { label: "Total Ficheiros", value: `${selectedDocs.length}` }]
                        );
                        setSelectedDocIds([]);
                      }}
                      className="bg-indigo-700 hover:bg-indigo-800 text-white px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="h-2.5 w-2.5" /> Descarregar PDF/ZIP
                    </button>
                    <button
                      onClick={() => {
                        const selectedDocs = documentos.filter(d => selectedDocIds.includes(d.id_doc));
                        const body = `Exmo.(a) Condómino(a),\n\nSegue em anexo a documentação selecionada do condomínio ${predio.nome}:\n\n` +
                          selectedDocs.map(d => `- ${d.nome} (${d.data_upload})`).join("\n") +
                          "\n\nCom os melhores cumprimentos,\nAdministração do Condomínio";
                        downloadEmailDocument(
                          `Documentos do Condomínio ${predio.nome}`,
                          "administracao@condomanager.ai",
                          perfilEmail || "condomino@condomanager.ai",
                          body,
                          `Documentos_${predio.nome.replace(/\s+/g, '_')}.eml`
                        );
                        setSelectedDocIds([]);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                    >
                      ✉️ Exportar Email
                    </button>
                  </div>
                </div>
              )}
              
              {documentos.length === 0 ? (
                <div className="text-center py-8 text-[10px] text-slate-400 italic">
                  Nenhum documento encontrado.
                </div>
              ) : (
                documentos
                  .filter(doc => 
                    documentCategory === "Todos" || 
                    doc.categoria?.toLowerCase() === documentCategory.toLowerCase() || 
                    (documentCategory === "Fração" && doc.categoria === "Privado") || 
                    (documentCategory === "Prédio" && doc.categoria === "Público") ||
                    (documentCategory === "Biblioteca" && (doc.categoria === "Público" || doc.categoria?.toLowerCase() === "regulamentos" || doc.categoria?.toLowerCase() === "contratos" || doc.categoria?.toLowerCase() === "atas" || doc.categoria?.toLowerCase() === "seguros"))
                  )
                  .filter(doc => doc.nome.toLowerCase().includes(documentSearch.toLowerCase()))
                  .map(doc => (
                    <div key={doc.id_doc} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-2.5 rounded-lg shadow-xs flex items-center justify-between text-[10px] gap-2">
                      <div className="flex items-center space-x-2.5 truncate">
                        <input 
                          type="checkbox"
                          checked={selectedDocIds.includes(doc.id_doc)}
                          onChange={() => {
                            setSelectedDocIds(prev => 
                              prev.includes(doc.id_doc) 
                                ? prev.filter(id => id !== doc.id_doc) 
                                : [...prev, doc.id_doc]
                            );
                          }}
                          className="rounded text-emerald-600 border-slate-300 dark:border-slate-700 focus:ring-0 cursor-pointer h-3.5 w-3.5 shrink-0"
                        />
                        <span className="text-lg">📄</span>
                        <div className="truncate">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">{doc.nome}</span>
                          <span className="text-[8px] text-slate-400 uppercase font-bold">{doc.categoria || doc.tipo} • Ano {doc.data_upload.split("-")[0] || "N/A"}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0 font-bold">
                        <button 
                          id={`pwa-view-doc-${doc.id_doc}`}
                          onClick={() => {
                            setSelectedDocPreview(doc);
                            alert(`A abrir visualizador inteligente para: ${doc.nome}`);
                          }}
                          className="p-1 text-slate-500 hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400 cursor-pointer"
                          title="Visualização Online"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          id={`pwa-download-doc-${doc.id_doc}`}
                          onClick={() => generateAndDownloadPdf(
                            doc.nome,
                            [{ heading: "Descrição do Documento", content: doc.descricao || "Ficheiro oficial do condomínio registado no arquivo digital." }],
                            doc.nome,
                            [{ label: "Condomínio", value: predio.nome }, { label: "Data Upload", value: doc.data_upload }, { label: "Categoria", value: doc.categoria || doc.tipo || "Geral" }]
                          )}
                          className="p-1 text-slate-500 hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400 cursor-pointer"
                          title="Fazer Download PDF"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Online Visualization Simulation Drawer */}
            {selectedDocPreview && (
              <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-end justify-center p-3 animate-fade-in">
                <div className="bg-white dark:bg-slate-900 w-full max-h-[85%] rounded-t-2xl shadow-xl flex flex-col overflow-hidden text-[10px]">
                  <div className="bg-indigo-600 p-3 text-white flex justify-between items-center">
                    <div>
                      <span className="text-[8px] uppercase font-bold text-indigo-200">Visualizador PWA Integrado</span>
                      <h4 className="font-black text-xs truncate max-w-[200px]">{selectedDocPreview.nome}</h4>
                    </div>
                    <button 
                      onClick={() => setSelectedDocPreview(null)}
                      className="font-black text-xs text-white hover:text-indigo-100 cursor-pointer"
                    >
                      Fechar ✕
                    </button>
                  </div>
                  <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-150 dark:border-slate-800 flex justify-between">
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">Emitido por</span>
                        <strong className="text-slate-800 dark:text-slate-200">Administração / Gestora</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">Data de Envio</span>
                        <strong className="text-slate-800 dark:text-slate-200">{selectedDocPreview.data_upload}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">Assinado Digitalmente</span>
                        <strong className="text-emerald-600 flex items-center"><Check className="h-2.5 w-2.5 mr-0.5" /> Sim</strong>
                      </div>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-850 p-3 rounded-lg bg-white dark:bg-slate-950 font-serif leading-normal text-[11px] text-slate-600 dark:text-white whitespace-pre-wrap min-h-[140px] select-none shadow-inner">
                      [CONTEÚDO DO DOCUMENTO SIMULADO EM TEMPO REAL]
                      {"\n\n"}
                      Considerando os estatutos do condomínio Activo correspondente ao edifício situado na Rua Bento Rodrigues nº 23, declara-se a validade do relatório documental em anexo para homologação e fecho do exercício.
                      {"\n\n"}
                      Todos os condóminos foram notificados eletronicamente através dos canais digitais e canais PWA autorizados pelo AI Studio.
                    </div>

                    <button
                      onClick={() => {
                        generateAndDownloadPdf(
                          selectedDocPreview.nome,
                          [{ 
                            heading: "Conteúdo Integral do Documento", 
                            content: `Considerando os estatutos do condomínio Activo correspondente ao edifício situado em ${predio?.morada_linha1 || ""}, declara-se a validade do relatório documental para homologação e fecho do exercício.\n\nTodos os condóminos foram notificados eletronicamente através dos canais digitais PWA.` 
                          }],
                          selectedDocPreview.nome,
                          [{ label: "Edifício", value: predio?.nome || "Condomínio" }, { label: "Data de Envio", value: selectedDocPreview.data_upload }]
                        );
                        setSelectedDocPreview(null);
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 rounded-lg text-center cursor-pointer transition-colors"
                    >
                      Exportar e Descarregar PDF Oficial
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* MÓDULO 3 — INTERVENÇÕES (Ocorrências) */}
        {/* ========================================== */}
        {activeTab === "intervencoes" && (
          <div className="space-y-4 animate-fade-in" id="pwa-modulo-intervencoes">
            <div>
              <h3 className="text-sm font-black tracking-tight text-slate-800 dark:text-white">🔧 Intervenções & Avarias</h3>
            </div>

            {/* List of active and finished interventions */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registo de Ocorrências</span>
              
              <div className="space-y-2.5">
                {intervencoesList.map(interv => (
                  <div key={interv.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl shadow-xs space-y-2 text-[10px]">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[8px] text-slate-400 font-extrabold block uppercase tracking-wider font-mono">{interv.id} • {interv.data}</span>
                        <h4 className="font-extrabold text-slate-800 dark:text-slate-200">{interv.equipamento}</h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                        interv.estado === "Pendente" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20" :
                        interv.estado === "Em curso" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/20" :
                        "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20"
                      }`}>
                        {interv.estado}
                      </span>
                    </div>

                    <p className="text-slate-500 leading-tight">"{interv.descricao}"</p>
                    
                    <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 dark:border-slate-850/60 text-[9px]">
                      <span className="text-slate-400">Técnico/Fornecedor: <strong className="text-slate-600 dark:text-slate-300">{interv.fornecedor}</strong></span>
                      <button 
                        onClick={() => alert(`Historial da intervenção ${interv.id}:\n- Abertura: ${interv.data}\n- Estado atual: ${interv.estado}\n- Responsável: ${interv.fornecedor}`)}
                        className="text-emerald-600 hover:underline cursor-pointer font-bold"
                      >
                        Acompanhar Estado
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Report Avaria form */}
            <form onSubmit={handleReportAvaria} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3.5 rounded-xl shadow-sm space-y-3 text-[10px]">
              <span className="text-[10px] font-extrabold text-rose-500 uppercase tracking-widest block">
                🚨 Reportar Nova Avaria / Anomalia
              </span>
              
              <div className="space-y-1">
                <label className="font-bold text-slate-500 uppercase text-[8px]">Selecione o Equipamento / Área</label>
                <select
                  value={newIntervEquipamento}
                  onChange={e => setNewIntervEquipamento(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-lg font-bold text-slate-800 dark:text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="Elevador">Elevador do Edifício</option>
                  <option value="Portão da Garagem">Portão Principal de Garagem</option>
                  <option value="Bomba de Água">Grupo de Bombas de Água</option>
                  <option value="Iluminação Comum">Iluminação de Patamar / Escadas</option>
                  <option value="Limpeza / Higiene">Problema de Limpeza / Higiene</option>
                  <option value="Outros">Outras Situações Gerais</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-500 uppercase text-[8px]">Descrição Detalhada do Problema</label>
                <textarea
                  required
                  rows={2.5}
                  value={newIntervDesc}
                  onChange={e => setNewIntervDesc(e.target.value)}
                  placeholder="Ex: Lâmpada fundida no teto do 2º andar esquerdo..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>

              {/* Photos capture simulation */}
              <div className="space-y-2">
                <label className="font-bold text-slate-500 uppercase text-[8px] block">Anexar Fotografia (Opcional)</label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewIntervPhoto("data:image/webp;base64,mockphoto");
                      setNewIntervPhotoName("avaria_foto_campo.webp");
                      alert("Câmara ativada. Foto comprimida para WebP (Redução de 85% no tráfego de dados móveis)!");
                    }}
                    className="flex items-center space-x-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Capturar Foto</span>
                  </button>
                  <span className="text-[9px] text-slate-400 italic">
                    {newIntervPhotoName || "Sem anexo fotográfico"}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-2 rounded-lg text-center cursor-pointer transition-colors uppercase text-[9px] shadow-xs"
              >
                Submeter e Enviar Notificação Push
              </button>
            </form>
          </div>
        )}

        {/* ========================================== */}
        {/* MÓDULO 4 — OBRAS */}
        {/* ========================================== */}
        {activeTab === "obras" && (
          <div className="space-y-4 animate-fade-in" id="pwa-modulo-obras">
            <div>
              <h3 className="text-sm font-black tracking-tight text-slate-800 dark:text-white">🏗️ Obras Planeadas & em Curso</h3>
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estado de Obras Ativas</span>
              
              {/* Painting escadas */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl shadow-xs space-y-2 text-[10px]">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[8px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 px-2 py-0.5 rounded font-bold uppercase">Adjudicada</span>
                    <h4 className="font-extrabold text-slate-800 dark:text-slate-200 mt-1">Pintura e Tratamento de Escadas</h4>
                  </div>
                  <span className="font-bold text-indigo-600 font-mono">18,500.00 €</span>
                </div>
                <p className="text-slate-500 leading-tight">Previsão de arranque em Agosto 2026. Orçamentos aprovados na Assembleia Geral de Maio de 2026.</p>
                
                <div className="pt-2 border-t border-slate-100 dark:border-slate-850/60 flex justify-between text-[9px] text-slate-400 font-bold">
                  <span>Fiscalização: IA Técnico</span>
                  <button 
                    onClick={() => generateAndDownloadPdf(
                      "Caderno de Encargos e Orçamentos - Pintura de Escadas",
                      [{ heading: "Memória Descritiva & Propostas Adjudicadas", content: "Documentação oficial de concursos de empreitada, cadernos de encargos de lavagem e tinta impermeável, e orçamentos apresentados pelas empresas qualificadas." }],
                      "Orcamentos_Memoria_Descritiva_Pintura.pdf",
                      [{ label: "Edifício", value: predio.nome }, { label: "Valor Adjudicado", value: "18,500.00 €" }]
                    )}
                    className="text-indigo-600 hover:underline cursor-pointer"
                  >
                    Ver Orçamentos (3 docs)
                  </button>
                </div>
              </div>

              {/* Roof restoration */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl shadow-xs space-y-2 text-[10px]">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[8px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 px-2 py-0.5 rounded font-bold uppercase">Concluída</span>
                    <h4 className="font-extrabold text-slate-800 dark:text-slate-200 mt-1">Impermeabilização do Telhado / Cobertura</h4>
                  </div>
                  <span className="font-bold text-slate-400 font-mono">9,820.00 €</span>
                </div>
                <p className="text-slate-500 leading-tight">Concluída em Fevereiro de 2026. Garantia total da obra ativa até Fevereiro de 2031.</p>
                
                <div className="pt-2 border-t border-slate-100 dark:border-slate-850/60 flex justify-between text-[9px] text-slate-400 font-bold">
                  <span>Garantia: 5 Anos</span>
                  <button 
                    onClick={() => generateAndDownloadPdf(
                      "Auto de Receção Final e Vistoria de Estanquicidade",
                      [{ heading: "Relatório de Receção de Obra", content: "Atestado técnico de conformidade dos trabalhos de impermeabilização da cobertura, testes de estanquicidade e apólice de garantia de 5 anos fornecida pela empreiteira." }],
                      "Auto_Rececao_Final_Telhado.pdf",
                      [{ label: "Edifício", value: predio.nome }, { label: "Garantia", value: "Até Fev/2031" }]
                    )}
                    className="text-emerald-600 hover:underline cursor-pointer"
                  >
                    Ver Relatório Final
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* MÓDULO 5 — LIMPEZAS */}
        {/* ========================================== */}
        {activeTab === "limpezas" && (
          <div className="space-y-4 animate-fade-in" id="pwa-modulo-limpezas">
            <div>
              <h3 className="text-sm font-black tracking-tight text-slate-800 dark:text-white">🧹 Higiene & Limpezas</h3>
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Histórico de Higienização</span>
              
              <div className="space-y-2.5">
                {limpezasHistorico.map(limp => (
                  <div key={limp.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl shadow-xs space-y-2 text-[10px]">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-400 uppercase tracking-wider text-[8px] font-mono">{limp.id} • {limp.data} às {limp.hora}</span>
                      <span className="text-emerald-600 flex items-center"><CheckCircle className="h-3 w-3 mr-0.5" /> {limp.estado}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 leading-tight">
                      <div>
                        <span className="text-[8px] text-slate-400 uppercase block font-bold">Técnico Responsável</span>
                        <strong className="text-slate-700 dark:text-slate-300">{limp.tecnico}</strong>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 uppercase block font-bold">Anomalias Detetadas</span>
                        <strong className={limp.avariaDetetada !== "Nenhuma" ? "text-red-600" : "text-emerald-600"}>
                          {limp.avariaDetetada}
                        </strong>
                      </div>
                    </div>

                    {/* Interactive ratings inside simulator */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-850/60 space-y-1.5">
                      <span className="text-[8px] font-bold text-slate-400 uppercase block">Avalie a qualidade do serviço</span>
                      <div className="flex items-center justify-between">
                        <div className="flex space-x-1">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button
                              key={star}
                              onClick={() => {
                                setCleaningRatings(prev => ({ ...prev, [limp.id]: star }));
                                alert(`Avaliou este serviço com ${star} estrelas! Obrigado.`);
                              }}
                              className="cursor-pointer"
                            >
                              <Star className={`h-4 w-4 ${
                                (cleaningRatings[limp.id] || 0) >= star ? "text-amber-500 fill-amber-500" : "text-slate-300 dark:text-slate-700"
                              }`} />
                            </button>
                          ))}
                        </div>
                        <span className="text-[8px] text-slate-400 font-bold">
                          {cleaningRatings[limp.id] ? "Obrigado!" : "Por avaliar"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* MÓDULO 6 — FINANCEIRO (VERSÃO FINAL INTEGRADA) */}
        {/* ========================================== */}
        {activeTab === "financeiro" && (
          <div className="space-y-4 animate-fade-in" id="pwa-modulo-financeiro">
            <div>
              <h3 className="text-sm font-black tracking-tight text-slate-800 dark:text-white">💳 Painel Financeiro Integrado</h3>
            </div>

            {/* SECTION 1: PAINEL FINANCEIRO DINÂMICO (8.1) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3.5 rounded-xl shadow-md space-y-3 text-[10px]">
              <span className="text-[9px] font-extrabold text-teal-600 uppercase tracking-widest block">8.1 Painel Financeiro Dinâmico</span>
              
              {/* 8.1.1 IBAN do Prédio */}
              <div className="space-y-1 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850/60">
                <div className="flex justify-between items-center">
                  <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider block">8.1.1 IBAN do Prédio</span>
                  <button 
                    onClick={() => handleCopyToClipboard("PT50 0007 0000 1234 5678 9012 3", "IBAN")}
                    className="flex items-center space-x-1 text-teal-600 hover:text-teal-700 font-bold text-[8px] cursor-pointer"
                  >
                    <Copy className="h-2.5 w-2.5" />
                    <span>Copiar IBAN</span>
                  </button>
                </div>
                <strong className="text-slate-800 dark:text-slate-200 block font-mono text-[9px] tracking-tight">PT50 0007 0000 1234 5678 9012 3</strong>
                <p className="text-[8px] text-slate-400">Utilize este IBAN para pagamento das quotas ordinárias mensais por transferência.</p>
              </div>

              {/* 8.1.2 Referência Individual */}
              <div className="space-y-1 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850/60">
                <div className="flex justify-between items-center">
                  <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider block">8.1.2 Referência Individual da Fração</span>
                  <button 
                    onClick={() => handleCopyToClipboard(fractionRef, "Referência")}
                    className="flex items-center space-x-1 text-teal-600 hover:text-teal-700 font-bold text-[8px] cursor-pointer"
                  >
                    <Copy className="h-2.5 w-2.5" />
                    <span>Copiar Referência</span>
                  </button>
                </div>
                <strong className="text-indigo-600 font-mono text-[11px] block tracking-widest">{fractionRef}</strong>
                <p className="text-[8px] text-slate-400">Regra de extração automática: 1ª letra de cada nome da rua + nº + piso + letra (Ex: RB23E).</p>
              </div>

              {/* 8.1.3 Estado da Quota do Mês & Selector interativo */}
              <div className="space-y-2">
                <label className="font-bold text-slate-500 uppercase text-[8px] block">8.1.3 Estado da Quota do Mês (Simulação Interativa)</label>
                
                <div className="grid grid-cols-2 gap-1.5 text-[8px] font-bold">
                  {[
                    { key: "pago", label: "✔ Pago (Julho)", color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
                    { key: "atraso", label: "❗ Em Atraso", color: "bg-red-50 text-red-700 border-red-100" },
                    { key: "processamento", label: "⏳ Em Processamento", color: "bg-amber-50 text-amber-700 border-amber-100" },
                    { key: "multiplo", label: "⚠️ Múltiplo Detetado", color: "bg-purple-50 text-purple-700 border-purple-100" },
                    { key: "cobranca", label: "📅 Cobrança (Dia 25)", color: "bg-blue-50 text-blue-700 border-blue-100" }
                  ].map(item => (
                    <button
                      key={item.key}
                      onClick={() => setQuotaState(item.key as any)}
                      className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                        quotaState === item.key 
                          ? `${item.color} border-2 ring-1 ring-offset-1 ring-slate-400` 
                          : "bg-white dark:bg-slate-900 text-slate-500 border-slate-150 dark:border-slate-800"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Dinamic message according to selected state */}
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 text-[9px] text-slate-500 font-medium">
                  {quotaState === "pago" && "A sua cota ordinária referente ao mês de Julho de 2026 encontra-se integralmente LIQUIDADA. Obrigado!"}
                  {quotaState === "atraso" && "Atenção: Existe 1 quota em atraso (45.00€). Por favor efetue a transferência e envie o comprovativo no painel abaixo."}
                  {quotaState === "processamento" && "O seu comprovativo de transferência encontra-se pendente de validação pela administração técnica."}
                  {quotaState === "multiplo" && "Alerta: Pagamento múltiplo detetado pela IA. Foram identificados múltiplos depósitos sob a mesma referência de forma acumulada."}
                  {quotaState === "cobranca" && "Próxima cobrança programada por débito direto para o dia 25 de Julho de 2026. Garanta fundos suficientes."}
                </div>
              </div>

              {/* 8.1.4 Cota Extraordinária Simulação */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[8px] font-extrabold text-indigo-500 uppercase tracking-wider block">8.1.4 Quota Extraordinária Ativa</span>
                  <div className="flex items-center space-x-1.5 text-[8px] font-bold text-slate-400">
                    <input 
                      type="checkbox" 
                      id="sim-extra-check" 
                      checked={simulateExtraQuota} 
                      onChange={e => setSimulateExtraQuota(e.target.checked)}
                      className="rounded accent-emerald-500 shrink-0 cursor-pointer"
                    />
                    <label htmlFor="sim-extra-check" className="cursor-pointer">Exibir Quota Extra</label>
                  </div>
                </div>

                {simulateExtraQuota && (
                  <div className="bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 p-2.5 rounded-lg space-y-2">
                    <div className="flex justify-between font-bold text-[9px]">
                      <span className="text-indigo-800 dark:text-indigo-300">🛡️ Pintura das Fachadas e Escadas</span>
                      <span className="text-indigo-600 font-mono">35.00 € / prestação</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[8px] leading-relaxed">
                      <div>
                        <span className="text-slate-400 block font-bold">IBAN da Obra</span>
                        <div className="flex items-center space-x-1 font-mono font-bold text-slate-700 dark:text-slate-300">
                          <span className="truncate max-w-[80px]">PT50 1111 2222...</span>
                          <button 
                            onClick={() => handleCopyToClipboard("PT50 1111 2222 3333 4444 5555 6", "IBAN da Obra")}
                            className="text-indigo-600 hover:underline cursor-pointer"
                          >
                            Copiar
                          </button>
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-bold">Referência da Obra</span>
                        <div className="flex items-center space-x-1 font-mono font-bold text-slate-700 dark:text-slate-300">
                          <span>{fractionRef}_PINTURA</span>
                          <button 
                            onClick={() => handleCopyToClipboard(`${fractionRef}_PINTURA`, "Referência da Obra")}
                            className="text-indigo-600 hover:underline cursor-pointer"
                          >
                            Copiar
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="text-[8px] text-indigo-500 font-bold flex justify-between items-center">
                      <span>Prazo Limite: 15/08/2026</span>
                      <span className="bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded uppercase tracking-wider text-[7px]">Aviso Automático da IA 🤖</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 2: MOVIMENTOS FINANCEIROS (8.2) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3.5 rounded-xl shadow-sm space-y-3 text-[10px]">
              <span className="text-[9px] font-extrabold text-teal-600 uppercase tracking-widest block">8.2 Movimentos Financeiros Recentes</span>
              
              <div className="space-y-2">
                {financeiroMovimentos.map(mov => (
                  <div key={mov.id} className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-850/60 flex justify-between items-center">
                    <div>
                      <div className="flex items-center space-x-1 text-[8px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">
                        <span>{mov.id}</span>
                        <span>•</span>
                        <span>{mov.data}</span>
                      </div>
                      <span className="font-bold text-slate-700 dark:text-slate-200 block mt-0.5">{mov.descricao}</span>
                      {mov.referencia && <span className="text-[7px] text-slate-400 font-mono uppercase font-bold">Ref: {mov.referencia}</span>}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-black text-slate-800 dark:text-white block">{mov.valor.toFixed(2)} €</span>
                      <span className={`text-[8px] font-extrabold uppercase ${
                        mov.estado === "Pago" || mov.estado === "Processado" ? "text-emerald-600" : "text-amber-500"
                      }`}>{mov.estado}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 3: ENVIO DE COMPROVATIVOS (8.3) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3.5 rounded-xl shadow-sm space-y-3 text-[10px]">
              <span className="text-[9px] font-extrabold text-teal-600 uppercase tracking-widest block">8.3 Envio de Comprovativos (Leitura IA)</span>
              
              <p className="text-[9px] text-slate-400 leading-normal">
                Submeta o talão de transferência ou PDF bancário. A IA efetuará a leitura ótica em tempo real para liquidação automática de quotas.
              </p>

              {/* Simulated camera dropzone */}
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center space-y-2 bg-slate-50/50 dark:bg-slate-950/20 relative">
                {comprovativoExtracting ? (
                  <div className="py-4 space-y-2 flex flex-col items-center">
                    <RefreshCw className="h-6 w-6 text-indigo-500 animate-spin" />
                    <span className="font-bold text-slate-700 dark:text-slate-300">A IA está a analisar o documento...</span>
                    <span className="text-[8px] text-slate-400 font-mono">OCR & Validação de Referência Ativa</span>
                  </div>
                ) : comprovativoExtractedData ? (
                  <div className="text-left space-y-3">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded border border-emerald-100 text-[9px] font-extrabold text-emerald-700 flex items-center space-x-1">
                      <Check className="h-3.5 w-3.5" />
                      <span>Ficheiro "{comprovativoFileName}" analisado com sucesso!</span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-lg space-y-1.5 text-[9px]">
                      <span className="font-extrabold uppercase text-slate-400 text-[8px] block tracking-wider">Leitura IA do Comprovativo</span>
                      <div className="grid grid-cols-2 gap-2 text-[9px] font-semibold">
                        <div>Valor Lido: <strong className="font-mono text-slate-800 dark:text-white">{comprovativoExtractedData.valor.toFixed(2)} €</strong></div>
                        <div>Referência: <strong className="font-mono text-indigo-600">{comprovativoExtractedData.referencia}</strong></div>
                        <div className="col-span-2">Classificação: <strong className="text-emerald-600">{comprovativoExtractedData.classificacao}</strong></div>
                        <div className="col-span-2 text-indigo-600 text-[8px] leading-tight">💡 {comprovativoExtractedData.sugestaoLancamento}</div>
                        <div className="col-span-2 text-slate-400 text-[8px] leading-tight font-medium italic">ℹ️ {comprovativoExtractedData.ajusteFuturo}</div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setComprovativoUpload(null);
                          setComprovativoExtractedData(null);
                        }}
                        className="flex-1 text-center py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-250 font-bold rounded-lg cursor-pointer"
                      >
                        Limpar
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmComprovativo}
                        className="flex-1 text-center py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg cursor-pointer transition-colors"
                      >
                        Confirmar Quota
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 space-y-2">
                    <span className="text-3xl block">📄</span>
                    <button
                      type="button"
                      onClick={() => document.getElementById("pwa-comprovativo-file")?.click()}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-bold cursor-pointer transition-colors"
                    >
                      Selecionar Comprovativo
                    </button>
                    <p className="text-[8px] text-slate-400 leading-tight">Arraste ficheiro PDF ou tire fotografia do talão</p>
                    <input 
                      id="pwa-comprovativo-file" 
                      type="file" 
                      accept="image/*,application/pdf" 
                      onChange={handleComprovativoUpload} 
                      className="hidden" 
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* MÓDULO 7 — REGRAS DO PRÉDIO */}
        {/* ========================================== */}
        {activeTab === "regras" && (
          <div className="space-y-4 animate-fade-in" id="pwa-modulo-regras">
            <div>
              <h3 className="text-sm font-black tracking-tight text-slate-800 dark:text-white">📋 Regras & Regulamentos</h3>
            </div>

            <div className="space-y-3.5 text-[10px]">
              {/* Regulamento Interno Accordion style */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl shadow-xs space-y-2">
                <span className="text-[9px] font-extrabold text-teal-600 uppercase tracking-widest block">Regulamento Interno Escrito</span>
                <p className="text-slate-500 leading-relaxed font-medium">
                  De acordo com a Ata de Assembleia Geral, as normas de ruído estipulam silêncio obrigatório entre as <strong className="text-slate-700 dark:text-slate-200">22h00 e as 08h00</strong>. Quaisquer obras particulares de condóminos só podem decorrer em dias úteis das 09h00 às 18h00.
                </p>
              </div>

              {/* Capacidade máxima dos espaços */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl shadow-xs space-y-2">
                <span className="text-[9px] font-extrabold text-teal-600 uppercase tracking-widest block">Capacidade Máxima de Espaços Comuns</span>
                <div className="grid grid-cols-2 gap-2 text-[9px] font-bold">
                  <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[7px] uppercase">Salão de Festas</span>
                    <span className="text-slate-700 dark:text-slate-300">Máx. 40 Pessoas</span>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[7px] uppercase">Ginásio Comum</span>
                    <span className="text-slate-700 dark:text-slate-300">Máx. 5 Pessoas</span>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[7px] uppercase">Elevadores</span>
                    <span className="text-slate-700 dark:text-slate-300">Máx. 4 Pessoas</span>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[7px] uppercase">Parque Infantil</span>
                    <span className="text-slate-700 dark:text-slate-300">Máx. 12 Crianças</span>
                  </div>
                </div>
              </div>

              {/* Normas Legais */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl shadow-xs space-y-2">
                <span className="text-[9px] font-extrabold text-teal-600 uppercase tracking-widest block">Segurança & Convivência</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-500 font-medium">
                  <li>Proibido depositar lixo doméstico ou entulho nas áreas comuns e patamares de escadas.</li>
                  <li>As chaves e códigos de entrada de garagem são de cariz estritamente confidencial.</li>
                  <li>Uso obrigatório de trela para animais domésticos no interior do átrio comum.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* MÓDULO 8 — MENSAGENS */}
        {/* ========================================== */}
        {activeTab === "mensagens" && (
          <div className="space-y-4 animate-fade-in" id="pwa-modulo-mensagens">
            <div>
              <h3 className="text-sm font-black tracking-tight text-slate-800 dark:text-white">💬 Comunicações à Administração</h3>
            </div>

            {/* Chat Box Interface */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl shadow-sm flex flex-col space-y-3 text-[10px]">
              <span className="text-[9px] font-extrabold text-teal-600 uppercase tracking-widest block">Conversação da Fração 3ºE</span>
              
              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-850/60 space-y-1">
                  <div className="flex justify-between font-bold text-slate-400 text-[8px]">
                    <span>Administração</span>
                    <span>12/07 16:15</span>
                  </div>
                  <p className="text-slate-600 dark:text-white leading-normal">
                    "Boa tarde Sr. João, informamos que a equipa de vistorias já reportou a anomalia na porta do ginásio. O fornecedor técnico foi adjudicado para verificação esta quarta-feira."
                  </p>
                  <span className="text-[8px] uppercase tracking-wider font-extrabold text-emerald-600 flex items-center">
                    <Check className="h-2.5 w-2.5 mr-0.5" /> Lida
                  </span>
                </div>

                <div className="p-2 bg-teal-50/50 dark:bg-teal-950/10 rounded-lg border border-teal-50 dark:border-teal-950/40 space-y-1 text-right">
                  <div className="flex justify-between font-bold text-teal-600 text-[8px] flex-row-reverse">
                    <span>Você (3ºE)</span>
                    <span>12/07 14:10</span>
                  </div>
                  <p className="text-teal-900 dark:text-teal-300 leading-normal italic">
                    "Detetei que a porta do ginásio no piso -1 não está a fechar corretamente após as limpezas. Podem mandar verificar?"
                  </p>
                </div>
              </div>

              {/* Form integration */}
              <form onSubmit={handleEnviarMensagem} className="flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-2 shrink-0">
                <input 
                  type="text" 
                  required
                  value={newMsgText}
                  onChange={e => setNewMsgText(e.target.value)}
                  placeholder="Escreva ao gestor do prédio..."
                  className="flex-grow bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-[10px] rounded focus:outline-none focus:border-teal-500 dark:text-white"
                />
                <button type="submit" className="p-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded cursor-pointer transition-colors shrink-0">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === "sondagens" && (
          <div className="space-y-4 animate-fade-in" id="pwa-modulo-sondagens">
            <div>
              <h3 className="text-sm font-black tracking-tight text-slate-800 dark:text-white">🗳️ Sondagens & Opiniões</h3>
            </div>

            {/* Active Poll card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3.5 rounded-xl shadow-sm space-y-3 text-[10px]">
              <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-widest block">Sondagem Ativa do Edifício</span>
              
              {votedPoll ? (
                <div className="flex flex-col items-center justify-center py-5 text-slate-400 text-center">
                  <Check className="h-5 w-5 text-emerald-500 mb-1.5 animate-bounce" />
                  <span className="text-[9px] font-extrabold text-slate-800 dark:text-slate-100">O seu voto foi registado com sucesso!</span>
                  <span className="text-[8px] text-slate-400 mt-0.5">A sondagem ativa foi movida para o "Arquivo de Sondagens" abaixo.</span>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-800 dark:text-white text-xs">Concorda com a pintura das escadas em tom cinza claro?</h4>
                    <p className="text-slate-400 text-[9px]">A pintura irá cobrir os desgastes atuais. Custos cobertos pelo fundo de reserva extraordinário adjudicado.</p>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <button 
                      onClick={() => handleVote("Sim")}
                      className="w-full text-left p-2 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-950 dark:hover:bg-indigo-950/20 border border-slate-150 dark:border-slate-850 rounded-lg font-bold flex justify-between items-center cursor-pointer transition-all"
                    >
                      <span>Sim, concordo inteiramente</span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                    <button 
                      onClick={() => handleVote("Não")}
                      className="w-full text-left p-2 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-950 dark:hover:bg-indigo-950/20 border border-slate-150 dark:border-slate-850 rounded-lg font-bold flex justify-between items-center cursor-pointer transition-all"
                    >
                      <span>Não, prefiro manter o tom atual</span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                    <button 
                      onClick={() => handleVote("Adiar")}
                      className="w-full text-left p-2 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-950 dark:hover:bg-indigo-950/20 border border-slate-150 dark:border-slate-850 rounded-lg font-bold flex justify-between items-center cursor-pointer transition-all"
                    >
                      <span>Adiar decisão para próxima assembleia</span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Arquivo de Sondagens */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3.5 rounded-xl shadow-xs space-y-3 text-[10px]">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">📂 Arquivo de Sondagens</span>
              
              {votedPoll && (
                <div className="p-3 bg-indigo-50/45 dark:bg-indigo-950/10 rounded-lg border border-indigo-100 dark:border-indigo-950/30 space-y-2.5">
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-slate-850 dark:text-slate-100">Concorda com a pintura das escadas em tom cinza claro?</h5>
                    <span className="text-[8px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-extrabold uppercase">Votado por si (Votou: "{votedPoll}")</span>
                  </div>

                  {/* Render beautiful chart results */}
                  <div className="space-y-2 pt-1">
                    {/* SIM */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] font-bold">
                        <span>Sim</span>
                        <span>{Math.round((votosSimulados.sim / (votosSimulados.sim + votosSimulados.nao + votosSimulados.adiar)) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full transition-all duration-500" 
                          style={{ width: `${(votosSimulados.sim / (votosSimulados.sim + votosSimulados.nao + votosSimulados.adiar)) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* NAO */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] font-bold">
                        <span>Não</span>
                        <span>{Math.round((votosSimulados.nao / (votosSimulados.sim + votosSimulados.nao + votosSimulados.adiar)) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-slate-400 h-full transition-all duration-500" 
                          style={{ width: `${(votosSimulados.nao / (votosSimulados.sim + votosSimulados.nao + votosSimulados.adiar)) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* ADIAR */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] font-bold">
                        <span>Adiar</span>
                        <span>{Math.round((votosSimulados.adiar / (votosSimulados.sim + votosSimulados.nao + votosSimulados.adiar)) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-slate-300 h-full transition-all duration-500" 
                          style={{ width: `${(votosSimulados.adiar / (votosSimulados.sim + votosSimulados.nao + votosSimulados.adiar)) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-[7px] text-slate-400 text-center font-bold pt-1">
                      Total de votos registados: {votosSimulados.sim + votosSimulados.nao + votosSimulados.adiar} frações
                    </div>
                  </div>
                </div>
              )}

              <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 flex justify-between items-center">
                <div>
                  <h5 className="font-bold text-slate-700 dark:text-slate-300">Câmara de Segurança Garagem</h5>
                  <span className="text-[8px] text-slate-400">Março 2026 • 12 Votos</span>
                </div>
                <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 px-2 py-0.5 rounded font-extrabold uppercase">Aprovado (72%)</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* MÓDULO 8 — MENSAGENS E CHAT COM A ADMINISTRAÇÃO */}
        {/* ========================================== */}
        {activeTab === "mensagens" && (
          <div className="space-y-4 animate-fade-in" id="pwa-modulo-mensagens">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black tracking-tight text-slate-800 dark:text-white">💬 Mensagens & Atendimento</h3>
                <span className="text-[9px] text-slate-400">Canal direto com a administração e piquete</span>
              </div>
              <span className="text-[8.5px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-extrabold px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                Online
              </span>
            </div>

            {/* Quick Contact Cards */}
            <div className="grid grid-cols-2 gap-2 text-[9px]">
              <button 
                type="button"
                onClick={() => setActivePwaModal("contactos_emergencia")}
                className="p-2.5 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl text-left hover:border-red-400 cursor-pointer transition-all space-y-0.5"
              >
                <span className="font-black text-red-600 dark:text-red-400 block uppercase tracking-wider text-[8px]">🚨 Piquete Urgente</span>
                <p className="text-slate-600 dark:text-slate-300 font-bold">24h Assistência Técnica</p>
              </button>

              <button 
                type="button"
                onClick={() => {
                  setNewMsgText("Assunto: Pedido de esclarecimento sobre a ata da última assembleia.");
                }}
                className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl text-left hover:border-indigo-400 cursor-pointer transition-all space-y-0.5"
              >
                <span className="font-black text-indigo-600 dark:text-indigo-400 block uppercase tracking-wider text-[8px]">📋 Modelo Rápido</span>
                <p className="text-slate-600 dark:text-slate-300 font-bold">Pedir Esclarecimento</p>
              </button>
            </div>

            {/* Main Chat Box Container */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-3 relative">
              <div className="h-64 bg-slate-50 dark:bg-slate-950/70 border border-slate-150 dark:border-slate-850 rounded-2xl p-3 space-y-2.5 overflow-y-auto">
                {/* Admin Message */}
                <div className="p-2.5 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-750 space-y-1 max-w-[85%] shadow-xs">
                  <div className="flex justify-between font-bold text-slate-400 text-[8px]">
                    <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">🏢 Administração do Condomínio</span>
                    <span>Hoje 16:15</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 leading-normal text-[10px]">
                    Boa tarde Sr. João, informamos que a equipa de vistorias já reportou a anomalia na porta do ginásio. O fornecedor técnico foi adjudicado para verificação esta quarta-feira.
                  </p>
                </div>

                {/* Resident Message */}
                <div className="p-2.5 bg-emerald-600 text-white rounded-2xl space-y-1 ml-auto max-w-[85%] shadow-xs">
                  <div className="flex justify-between font-bold text-emerald-100 text-[8px] flex-row-reverse">
                    <span>Você (3ºE)</span>
                    <span>Hoje 14:10</span>
                  </div>
                  <p className="text-white leading-normal text-[10px]">
                    Detetei que a porta do ginásio no piso -1 não está a fechar corretamente após as limpezas. Podem mandar verificar?
                  </p>
                </div>

                {/* Dynamic messages */}
                {customMessages.map((msg, idx) => {
                  const isAudio = typeof msg === "string" && msg.includes("[Nota de voz");
                  const isPhoto = typeof msg === "string" && msg.includes("[Fotografia");
                  const isDoc = typeof msg === "string" && msg.includes("[Documento");
                  const msgId = `tab-msg-${idx}`;
                  const isPlaying = playingAudioId === msgId;

                  return (
                    <div key={idx} className="p-2.5 bg-emerald-600 text-white rounded-2xl space-y-1 ml-auto max-w-[88%] shadow-xs animate-fade-in">
                      <div className="flex justify-between font-bold text-emerald-100 text-[8px] flex-row-reverse">
                        <span>Você (3ºE)</span>
                        <span>Agora</span>
                      </div>

                      {isAudio ? (
                        <div className="flex items-center justify-end space-x-2 bg-emerald-700/80 p-2 rounded-xl text-left">
                          <button
                            type="button"
                            onClick={() => {
                              if (isPlaying) {
                                setPlayingAudioId(null);
                              } else {
                                setPlayingAudioId(msgId);
                                playVoiceNoteSimulation(4, () => setPlayingAudioId(null));
                              }
                            }}
                            className="h-7 w-7 rounded-full bg-white text-emerald-700 flex items-center justify-center cursor-pointer transition-transform active:scale-95 shrink-0 shadow-sm"
                            title={isPlaying ? "Pausar" : "Ouvir Nota de Voz"}
                          >
                            {isPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />}
                          </button>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center space-x-0.5">
                              {[30, 70, 45, 90, 60, 40, 85, 50, 75, 35, 65, 80, 55, 45].map((h, i) => (
                                <span
                                  key={i}
                                  className={`w-1 rounded-full transition-all duration-300 ${
                                    isPlaying ? "bg-white animate-pulse" : "bg-emerald-300"
                                  }`}
                                  style={{ height: `${Math.max(4, h * 0.16)}px` }}
                                />
                              ))}
                            </div>
                            <div className="flex justify-between text-[7.5px] font-mono text-emerald-100">
                              <span>{isPlaying ? "A reproduzir áudio..." : "Nota de voz"}</span>
                              <span>0:04</span>
                            </div>
                          </div>
                        </div>
                      ) : isPhoto ? (
                        <div className="space-y-1 text-left">
                          <div className="bg-emerald-700/60 p-1.5 rounded-xl overflow-hidden flex items-center justify-center max-h-36">
                            <img 
                              src="/estados-acoes/04-guardar.png" 
                              alt="Fotografia Anexada" 
                              className="max-h-28 object-contain rounded-lg"
                            />
                          </div>
                          <span className="text-[8.5px] text-emerald-100 font-bold block text-right">{msg}</span>
                        </div>
                      ) : isDoc ? (
                        <div className="bg-emerald-700/80 p-2 rounded-xl flex items-center space-x-2 text-left">
                          <File className="h-4 w-4 text-white shrink-0" />
                          <div className="truncate flex-1">
                            <span className="text-[9px] font-bold text-white block truncate">{msg.replace("📎 ", "")}</span>
                            <span className="text-[7.5px] text-emerald-200">Documento PDF/Anexo verificado</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-white leading-normal text-[10px]">{msg}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Previews of attached items */}
              {(chatPhotoWebp || chatAudioData || chatDocAttachment) && (
                <div className="flex flex-wrap items-center gap-2">
                  {chatPhotoWebp && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 px-2 py-1 rounded-xl text-[9px] flex items-center gap-1.5 text-emerald-700 dark:text-emerald-200 shadow-xs">
                      <Camera className="h-3 w-3 text-emerald-500" />
                      <span className="font-bold truncate max-w-[120px]">{chatPhotoName || "Foto_Camara.webp"}</span>
                      <button 
                        type="button" 
                        onClick={() => { setChatPhotoWebp(null); setChatPhotoName(null); }} 
                        className="text-red-500 hover:text-red-700 font-bold ml-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {chatDocAttachment && (
                    <div className="bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-300 dark:border-indigo-700 px-2 py-1 rounded-xl text-[9px] flex items-center gap-1.5 text-indigo-700 dark:text-indigo-200 shadow-xs">
                      <File className="h-3 w-3 text-indigo-500" />
                      <span className="font-bold truncate max-w-[120px]">{chatDocAttachment.name} ({chatDocAttachment.size})</span>
                      <button 
                        type="button" 
                        onClick={() => setChatDocAttachment(null)} 
                        className="text-red-500 hover:text-red-700 font-bold ml-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {chatAudioData && (
                    <div className="bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 px-2 py-1 rounded-xl text-[9px] flex items-center gap-1.5 text-amber-700 dark:text-amber-200 shadow-xs">
                      <Volume2 className="h-3 w-3 text-amber-500" />
                      <span className="font-bold">Gravação de Voz ({chatAudioTimer || 4}s)</span>
                      <button 
                        type="button" 
                        onClick={() => { setChatAudioData(null); setChatAudioTimer(0); }} 
                        className="text-red-500 hover:text-red-700 font-bold ml-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* EMOJI PICKER POPOVER FOR TAB */}
              {isEmojiPickerOpen && (
                <div className="absolute bottom-16 left-3 right-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-2xl shadow-2xl z-50 animate-fade-in">
                  <div className="flex justify-between items-center pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-white">Selecionar Emoji</span>
                    <button 
                      type="button" 
                      onClick={() => setIsEmojiPickerOpen(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-8 gap-1.5 text-base">
                    {["😊", "👍", "🏢", "🔑", "🚪", "💡", "🔧", "⚠️", "📄", "💶", "⏱️", "📋", "🤝", "📢", "🚨", "💧", "🛠️", "🚗", "📦", "🧹", "✨", "🔒", "✅", "❌"].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setNewMsgText(newMsgText + emoji);
                          setIsEmojiPickerOpen(false);
                        }}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-center cursor-pointer transition-transform hover:scale-125"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ATTACHMENT MENU POPOVER FOR TAB */}
              {isAttachmentMenuOpen && (
                <div className="absolute bottom-16 left-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-2xl shadow-2xl z-50 animate-fade-in space-y-1 min-w-[200px]">
                  <div className="flex justify-between items-center pb-1 mb-1 border-b border-slate-100 dark:border-slate-800 px-1">
                    <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-white">Anexar Ficheiro</span>
                    <button 
                      type="button" 
                      onClick={() => setIsAttachmentMenuOpen(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAttachmentMenuOpen(false);
                      document.getElementById("pwa-chat-doc-input")?.click();
                    }}
                    className="w-full flex items-center space-x-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-left cursor-pointer transition-colors"
                  >
                    <div className="p-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
                      <File className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-[9.5px] block">Documento / PDF</span>
                      <span className="text-[7.5px] text-slate-400">PDF, Word, Excel, TXT</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAttachmentMenuOpen(false);
                      document.getElementById("pwa-chat-camera-input")?.click();
                    }}
                    className="w-full flex items-center space-x-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-left cursor-pointer transition-colors"
                  >
                    <div className="p-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
                      <Camera className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-[9.5px] block">Tirar Fotografia (Câmara)</span>
                      <span className="text-[7.5px] text-slate-400">Acesso à câmara móvel/PC</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAttachmentMenuOpen(false);
                      document.getElementById("pwa-chat-photo-input")?.click();
                    }}
                    className="w-full flex items-center space-x-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-left cursor-pointer transition-colors"
                  >
                    <div className="p-1 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-lg">
                      <Image className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-[9.5px] block">Galeria de Fotos</span>
                      <span className="text-[7.5px] text-slate-400">Compressão .WEBP imediata</span>
                    </div>
                  </button>
                </div>
              )}

              {/* Chat Input Form */}
              <form 
                onSubmit={(e) => { 
                  if (chatAudioData && !newMsgText) {
                    setNewMsgText(`🎙️ [Nota de voz de ${chatAudioTimer || 4}s]`);
                  }
                  handleEnviarMensagem(e);
                  setChatAudioData(null);
                  setChatPhotoWebp(null);
                  setChatPhotoName(null);
                  setChatDocAttachment(null);
                  setIsEmojiPickerOpen(false);
                  setIsAttachmentMenuOpen(false);
                }} 
                className="flex items-center gap-1.5 pt-2 border-t border-slate-150 dark:border-slate-800"
              >
                {/* CLIP BUTTON */}
                <button
                  type="button"
                  onClick={() => {
                    setIsAttachmentMenuOpen(!isAttachmentMenuOpen);
                    setIsEmojiPickerOpen(false);
                  }}
                  className={`p-2 rounded-xl cursor-pointer transition-colors shrink-0 ${
                    isAttachmentMenuOpen || chatPhotoWebp || chatDocAttachment
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                  title="Anexar documento, fotografia ou aceder à câmara (Clip)"
                >
                  <Paperclip className="h-4 w-4" />
                </button>

                {/* EMOJI BUTTON */}
                <button
                  type="button"
                  onClick={() => {
                    setIsEmojiPickerOpen(!isEmojiPickerOpen);
                    setIsAttachmentMenuOpen(false);
                  }}
                  className={`p-2 rounded-xl cursor-pointer transition-colors shrink-0 ${
                    isEmojiPickerOpen
                      ? "bg-amber-500 text-white shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-500"
                  }`}
                  title="Inserir Emoji"
                >
                  <Smile className="h-4 w-4" />
                </button>

                {/* MIC AUDIO VOICE NOTE RECORDER */}
                <button
                  type="button"
                  onClick={() => {
                    if (isRecordingChatAudio) {
                      setIsRecordingChatAudio(false);
                      setChatAudioData("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
                      if (!newMsgText) setNewMsgText(`🎙️ [Nota de voz de ${chatAudioTimer || 4}s]`);
                    } else {
                      setIsRecordingChatAudio(true);
                      setChatAudioTimer(0);
                    }
                  }}
                  className={`p-2 ${
                    isRecordingChatAudio 
                      ? "bg-red-600 text-white animate-pulse" 
                      : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400"
                  } rounded-xl cursor-pointer transition-colors shrink-0`}
                  title={isRecordingChatAudio ? "Parar gravação de voz" : "Gravar mensagem de áudio (Nota de Voz)"}
                >
                  <Mic className="h-4 w-4" />
                </button>

                {/* TEXT INPUT */}
                <input 
                  type="text" 
                  required={!chatAudioData && !chatPhotoWebp && !chatDocAttachment}
                  value={newMsgText}
                  onChange={e => setNewMsgText(e.target.value)}
                  placeholder={
                    isRecordingChatAudio 
                      ? `🔴 A gravar áudio (${chatAudioTimer}s)... clique no microfone para parar` 
                      : "Escreva ao gestor do prédio..."
                  }
                  className="flex-grow bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-white font-medium"
                />

                {/* ENVIAR MENSAGEM BUTTON */}
                <button 
                  type="submit" 
                  className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl cursor-pointer transition-all active:scale-95 shadow-md flex items-center justify-center shrink-0"
                  title="Enviar Mensagem"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* MÓDULO 10 — PERFIL DO CONDÓMINO */}
        {/* ========================================== */}
        {activeTab === "perfil" && (
          <div className="space-y-4 animate-fade-in" id="pwa-modulo-perfil">
            <div>
              <h3 className="text-sm font-black tracking-tight text-slate-800 dark:text-white">👤 Perfil do Condómino</h3>
            </div>

            {/* Profile fields */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl shadow-sm space-y-3.5 text-[10px]">
              <div className="flex items-center space-x-3.5 pb-3 border-b border-slate-100 dark:border-slate-850">
                <div className="relative group">
                  <div className="h-12 w-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-inner overflow-hidden border-2 border-emerald-500 relative">
                    {perfilAvatar ? (
                      <img src={perfilAvatar} alt="Avatar" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span>
                        {perfilNome ? perfilNome.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "JS"}
                      </span>
                    )}
                    <label htmlFor="pwa-avatar-file-upload" className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[7px] text-white font-extrabold cursor-pointer transition-opacity">
                      EDITAR
                    </label>
                  </div>
                  <input
                    type="file"
                    id="pwa-avatar-file-upload"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 dark:text-white text-xs">{perfilNome}</h4>
                  <span className="text-[8px] text-slate-400 uppercase font-extrabold">3º Andar Esquerdo • Entrada: 12/07/2026</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <div>
                  <span className="text-slate-400 block text-[8px] uppercase font-bold">Nome do Condómino</span>
                  <input
                    type="text"
                    value={perfilNome}
                    onChange={e => setPerfilNome(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-lg font-bold text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <span className="text-slate-400 block text-[8px] uppercase font-bold">Email de Registo</span>
                  <input
                    type="email"
                    value={perfilEmail}
                    onChange={e => setPerfilEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-lg font-bold text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <span className="text-slate-400 block text-[8px] uppercase font-bold">Telefone Móvel</span>
                  <input
                    type="text"
                    value={perfilTlm}
                    onChange={e => setPerfilTlm(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-lg font-bold text-slate-800 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block text-[8px] uppercase font-bold">Contribuinte (NIF)</span>
                    <input
                      type="text"
                      value={perfilNif}
                      onChange={e => setPerfilNif(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-lg font-bold text-slate-800 dark:text-white text-[10px]"
                    />
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[8px] uppercase font-bold">Data de Nascimento</span>
                    <input
                      type="text"
                      value={perfilNascimento}
                      onChange={e => setPerfilNascimento(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-lg font-bold text-slate-800 dark:text-white text-[10px]"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[8px] uppercase font-bold">Morada (Não Editável)</span>
                  <div className="w-full bg-slate-100 dark:bg-slate-500/10 border border-slate-200 dark:border-slate-900 p-2 rounded-lg font-bold text-slate-500 dark:text-white cursor-not-allowed select-none">
                    {perfilMorada}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-850 space-y-2">
                  <span className="text-emerald-500 font-extrabold text-[9px] uppercase tracking-wide block">💳 Dados Bancários</span>
                  
                  <div>
                    <span className="text-slate-400 block text-[8px] uppercase font-bold">IBAN</span>
                    <input
                      type="text"
                      value={perfilIban}
                      onChange={e => setPerfilIban(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-lg font-bold text-slate-800 dark:text-white text-[10px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 block text-[8px] uppercase font-bold">Entidade Bancária</span>
                      <input
                        type="text"
                        value={perfilBanco}
                        onChange={e => setPerfilBanco(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-lg font-bold text-slate-800 dark:text-white text-[10px]"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[8px] uppercase font-bold">Titular da Conta</span>
                      <input
                        type="text"
                        value={perfilIbanTitular}
                        onChange={e => setPerfilIbanTitular(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-lg font-bold text-slate-800 dark:text-white text-[10px]"
                      />
                    </div>
                  </div>
                </div>

                {/* 🛡️ SUBMENU EXPANSÍVEL DE SEGURANÇA */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <UserSecuritySubmenu
                    userEmail={perfilEmail}
                    userRole={loggedUser.role}
                    biometricsEnabled={biometricsEnabled}
                    setBiometricsEnabled={setBiometricsEnabled}
                    setSimulatingScan={setSimulatingScan}
                    setSimulatingScanProgress={setSimulatingScanProgress}
                  />
                </div>

              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-850 flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => alert("Dados de contacto e bancários atualizados com sucesso no sistema!")}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2 rounded-lg text-center cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                  >
                    <img src="/estados-acoes/04-concluido.png" alt="Guardar" className="h-4 w-4 object-contain inline-block" />
                    <span>Guardar Perfil</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPerfilShowPassModal(true)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2 rounded-lg text-center cursor-pointer transition-colors"
                  >
                    Alterar Password
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onLogout) {
                      onLogout();
                    } else {
                      alert("A terminar sessão...");
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-2xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs border border-red-500 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md hover:scale-102 active:scale-95 active:ring-2 active:ring-red-400"
                >
                    <img src="/estados-acoes/17-desligar.png" alt="Terminar Sessão" className="h-5 w-5 object-contain" />
                  <span>Terminar Sessão</span>
                </button>
              </div>
            </div>

            {/* Password simulation modal */}
            {perfilShowPassModal && (
              <div className="fixed inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 w-full max-w-xs space-y-3.5 text-[10px]">
                  <h4 className="font-extrabold text-xs text-slate-800 dark:text-white flex items-center">
                    <Lock className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> Segurança da Conta
                  </h4>
                  <div className="space-y-1">
                    <label className="text-slate-400 block text-[8px] uppercase font-bold">Nova Password de Acesso</label>
                    <input
                      type="password"
                      placeholder="Mínimo 8 caracteres"
                      value={perfilNewPass}
                      onChange={e => setPerfilNewPass(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-lg text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPerfilShowPassModal(false)}
                      className="flex-1 bg-slate-100 text-slate-700 font-bold py-1.5 rounded cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (perfilNewPass.length < 8) {
                          alert("A password deve ter pelo menos 8 caracteres!");
                          return;
                        }
                        setPerfilPassword(perfilNewPass);
                        setPerfilShowPassModal(false);
                        alert("A sua password de acesso foi atualizada com sucesso!");
                      }}
                      className="flex-1 bg-emerald-600 text-white font-extrabold py-1.5 rounded cursor-pointer"
                    >
                      Alterar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* MÓDULO LAUNCHER / HUB (10 Módulos Grid Selector) */}
        {/* ========================================== */}
        {activeTab === "modules_hub" && (
          <div className="space-y-4 animate-fade-in" id="pwa-modulo-hub">
            <div className="text-center pb-2">
              <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold px-2.5 py-1 rounded border border-emerald-100 uppercase tracking-widest inline-block mb-1.5">
                PWA Condómino Activo
              </span>
              <h3 className="text-sm font-black text-slate-800 dark:text-white">Selecione o Serviço do Condomínio</h3>
              <p className="text-[9px] text-slate-400">Serviços digitais totalmente integrados e certificados pelo AI Studio</p>
            </div>

            {/* 10 Modules Beautiful Bento Grid Layout */}
            <div className="grid grid-cols-2 gap-3 text-[10px]">
              
              {/* Módulo 1 */}
              <button 
                id="pwa-hub-link-home"
                onClick={() => setActiveTab("home")}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl shadow-xs hover:border-emerald-500 hover:scale-[1.02] transition-all text-left space-y-1.5 cursor-pointer"
              >
                <div className="flex justify-between items-center">
                  <Smartphone className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">Dashboard</span>
                  <span className="text-[8px] text-slate-400">Estado geral do prédio e resumo</span>
                </div>
              </button>

              {/* Módulo 2 */}
              <button 
                id="pwa-hub-link-docs"
                onClick={() => setActiveTab("documentos")}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl shadow-xs hover:border-emerald-500 hover:scale-[1.02] transition-all text-left space-y-1.5 cursor-pointer"
              >
                <div className="flex justify-between items-center">
                  <FileText className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">Arquivo</span>
                  <span className="text-[8px] text-slate-400">Arquivo digital de documentos e faturas</span>
                </div>
              </button>

              {/* Módulo 3 */}
              <button 
                id="pwa-hub-link-interv"
                onClick={() => setActiveTab("intervencoes")}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl shadow-xs hover:border-emerald-500 hover:scale-[1.02] transition-all text-left space-y-1.5 cursor-pointer"
              >
                <div className="flex justify-between items-center">
                  <Wrench className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">Intervenções</span>
                  <span className="text-[8px] text-slate-400">Reportar e seguir avarias</span>
                </div>
              </button>

              {/* Módulo 4 */}
              <button 
                id="pwa-hub-link-obras"
                onClick={() => setActiveTab("obras")}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl shadow-xs hover:border-emerald-500 hover:scale-[1.02] transition-all text-left space-y-1.5 cursor-pointer"
              >
                <div className="flex justify-between items-center">
                  <Building className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">Obras</span>
                  <span className="text-[8px] text-slate-400">Prazos e orçamentos</span>
                </div>
              </button>

              {/* Módulo 5 */}
              <button 
                id="pwa-hub-link-limp"
                onClick={() => setActiveTab("limpezas")}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl shadow-xs hover:border-emerald-500 hover:scale-[1.02] transition-all text-left space-y-1.5 cursor-pointer"
              >
                <div className="flex justify-between items-center">
                  <Brush className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">Limpezas</span>
                  <span className="text-[8px] text-slate-400">Placa virtual e relatórios</span>
                </div>
              </button>

              {/* Módulo 6 */}
              <button 
                id="pwa-hub-link-fin"
                onClick={() => setActiveTab("financeiro")}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl shadow-xs hover:border-emerald-500 hover:scale-[1.02] transition-all text-left space-y-1.5 cursor-pointer border-emerald-500/30"
              >
                <div className="flex justify-between items-center">
                  <CreditCard className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">Financeiro</span>
                  <span className="text-[8px] text-slate-400">IBAN, Quotas, Comprovativos IA</span>
                </div>
              </button>

              {/* Módulo 7 */}
              <button 
                id="pwa-hub-link-regras"
                onClick={() => setActiveTab("regras")}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl shadow-xs hover:border-emerald-500 hover:scale-[1.02] transition-all text-left space-y-1.5 cursor-pointer"
              >
                <div className="flex justify-between items-center">
                  <Scale className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">Regras do Prédio</span>
                  <span className="text-[8px] text-slate-400">Silêncio e regulamentos comuns</span>
                </div>
              </button>

              {/* Módulo 8 */}
              <button 
                id="pwa-hub-link-chat"
                onClick={() => setActiveTab("mensagens")}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl shadow-xs hover:border-emerald-500 hover:scale-[1.02] transition-all text-left space-y-1.5 cursor-pointer"
              >
                <div className="flex justify-between items-center">
                  <MessageSquare className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">Mensagens</span>
                  <span className="text-[8px] text-slate-400">Contacto com a administração</span>
                </div>
              </button>

              {/* Módulo 9 */}
              <button 
                id="pwa-hub-link-sond"
                onClick={() => setActiveTab("sondagens")}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl shadow-xs hover:border-emerald-500 hover:scale-[1.02] transition-all text-left space-y-1.5 cursor-pointer"
              >
                <div className="flex justify-between items-center">
                  <Vote className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">Sondagens</span>
                  <span className="text-[8px] text-slate-400">Votações rápidas e questionários</span>
                </div>
              </button>

              {/* Módulo 10 */}
              <button 
                id="pwa-hub-link-perf"
                onClick={() => setActiveTab("perfil")}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl shadow-xs hover:border-emerald-500 hover:scale-[1.02] transition-all text-left space-y-1.5 cursor-pointer"
              >
                <div className="flex justify-between items-center">
                  <User className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">Perfil</span>
                  <span className="text-[8px] text-slate-400">Contactos e alterações de acesso</span>
                </div>
              </button>

            </div>
          </div>
        )}

        {/* Floating Alertas do Prédio after first scroll */}
        {hasScrolled && activeTab === "home" && (
          <div className="fixed bottom-16 left-4 right-4 mx-auto max-w-sm bg-amber-50 dark:bg-amber-950 border-2 border-amber-300 dark:border-amber-800 p-2.5 rounded-xl shadow-xl flex items-start space-x-2 text-[10px] z-40">
            <span className="text-sm">⚠️</span>
            <div className="flex-1 space-y-0.5 text-left">
              <span className="font-extrabold text-amber-800 dark:text-amber-300 block">Alerta Importante (Detetado Scroll)</span>
              <p className="text-slate-700 dark:text-slate-300 leading-normal">
                Nota: A manutenção técnica do Elevador n.º 2 decorrerá dia 19/07 entre as 14h-16h. O elevador estará indisponível nesse período.
              </p>
            </div>
            <button 
              onClick={() => setHasScrolled(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer font-black text-xs shrink-0"
            >
              ✕
            </button>
          </div>
        )}

      </div>



      {/* SECONDARY BOTTOM NAVIGATION BAR (Reorganized Former BARRA SUPERIOR dinâmica) */}
      {activeTab !== "home" && ["regras", "obras", "sondagens", "documentos", "mensagens", "financeiro"].includes(activeTab) && (
        <div className="bg-white dark:bg-slate-900 border-t border-b border-slate-200 dark:border-slate-800/80 px-3 py-2 shrink-0 shadow-xs z-10">
          {/* If we are on common spaces / regras tab */}
          {activeTab === "regras" && (
          <div className="flex justify-around text-[9px] font-bold text-[#555] dark:text-white py-0.5">
            <button onClick={() => alert("Reservas de Espaços Comuns")} className="flex items-center space-x-1 hover:text-[#1A1A1A] dark:hover:text-white">
              <Clock className="h-3.5 w-3.5 text-[#1A1A1A]" /> <span className="text-[#1A1A1A] dark:text-slate-200">Reservar</span>
            </button>
            <span className="text-slate-300">|</span>
            <button onClick={() => alert("Regras de Utilização Gerais")} className="flex items-center space-x-1 hover:text-[#1A1A1A] dark:hover:text-white">
              <FileText className="h-3.5 w-3.5" /> <span>Regras</span>
            </button>
            <span className="text-slate-300">|</span>
            <button onClick={() => alert("Agenda de Ocupação Atualizada")} className="flex items-center space-x-1 hover:text-[#1A1A1A] dark:hover:text-white">
              <Clock className="h-3.5 w-3.5" /> <span>Agenda</span>
            </button>
          </div>
        )}

        {/* If we are on obras tab */}
        {activeTab === "obras" && (
          <div className="flex justify-around text-[9px] font-bold text-[#555] dark:text-white py-0.5">
            <button onClick={() => alert("Obras Ativas em Curso no Prédio")} className="flex items-center space-x-1 hover:text-[#1A1A1A] dark:hover:text-white">
              <Wrench className="h-3.5 w-3.5 text-[#1A1A1A]" /> <span className="text-[#1A1A1A] dark:text-slate-200">Obras em Curso</span>
            </button>
            <span className="text-slate-300">|</span>
            <button onClick={() => alert("Histórico de Obras Concluídas")} className="flex items-center space-x-1 hover:text-[#1A1A1A] dark:hover:text-white">
              <FileText className="h-3.5 w-3.5" /> <span>Histórico</span>
            </button>
          </div>
        )}

        {/* If we are on sondagens tab */}
        {activeTab === "sondagens" && (
          <div className="flex justify-around text-[9px] font-bold text-[#555] dark:text-white py-0.5">
            <button onClick={() => alert("Sondagens Ativas para Votação")} className="flex items-center space-x-1 hover:text-[#1A1A1A] dark:hover:text-white">
              <Vote className="h-3.5 w-3.5 text-[#1A1A1A]" /> <span className="text-[#1A1A1A] dark:text-slate-200">Ativas</span>
            </button>
            <span className="text-slate-300">|</span>
            <button onClick={() => alert("Resultados das Sondagens Encerradas")} className="flex items-center space-x-1 hover:text-[#1A1A1A] dark:hover:text-white">
              <FileText className="h-3.5 w-3.5" /> <span>Resultados</span>
            </button>
          </div>
        )}

        {/* If we are on documentos tab */}
        {activeTab === "documentos" && (
          <div className="flex justify-around text-[9px] font-bold text-[#555] dark:text-white py-0.5 w-full">
            <button onClick={() => setDocumentCategory("Pendentes")} className={`flex items-center space-x-1 ${documentCategory === 'Pendentes' ? 'text-[#1A1A1A] dark:text-white font-black' : 'hover:text-[#1A1A1A]'}`}>
              <Clock className="h-3.5 w-3.5" /> <span>Pendentes</span>
            </button>
            <span className="text-slate-300">|</span>
            <button onClick={() => setDocumentCategory("Todos")} className={`flex items-center space-x-1 ${documentCategory === 'Todos' ? 'text-[#1A1A1A] dark:text-white font-black' : 'hover:text-[#1A1A1A]'}`}>
              <FileText className="h-3.5 w-3.5" /> <span>Todos</span>
            </button>
            <span className="text-slate-300">|</span>
            <button onClick={() => setDocumentCategory("Biblioteca")} className={`flex items-center space-x-1 ${documentCategory === 'Biblioteca' ? 'text-[#1A1A1A] dark:text-white font-black' : 'hover:text-[#1A1A1A]'}`}>
              <Archive className="h-3.5 w-3.5" /> <span>Biblioteca Documental</span>
            </button>
          </div>
        )}

        {/* If we are on messages/contacts tab */}
        {activeTab === "mensagens" && (
          <div className="flex justify-around text-[9px] font-bold text-[#555] dark:text-white py-0.5">
            <button onClick={() => alert("Contacto Direto com a Administração")} className="flex items-center space-x-1 hover:text-[#1A1A1A] dark:hover:text-white">
              <MessageSquare className="h-3.5 w-3.5 text-[#1A1A1A]" /> <span className="text-[#1A1A1A] dark:text-slate-200">Mensagens</span>
            </button>
            <span className="text-slate-300">|</span>
            <button onClick={() => alert("Contactos de Emergência do Prédio")} className="flex items-center space-x-1 hover:text-[#1A1A1A] dark:hover:text-white">
              <Smartphone className="h-3.5 w-3.5" /> <span>Emergência</span>
            </button>
          </div>
        )}

        {/* If we are on financeiro tab */}
        {activeTab === "financeiro" && (
          <div className="flex justify-around text-[9px] font-bold text-[#555] dark:text-white py-0.5">
            <button onClick={() => setQuotaState("pago")} className="flex items-center space-x-1 hover:text-[#1A1A1A] dark:hover:text-white">
              <CheckCircle className="h-3.5 w-3.5 text-[#1A1A1A]" /> <span className="text-[#1A1A1A] dark:text-slate-200">Quotas Liquidadas</span>
            </button>
            <span className="text-slate-300">|</span>
            <button onClick={() => setQuotaState("atraso")} className="flex items-center space-x-1 hover:text-[#1A1A1A] dark:hover:text-white">
              <AlertTriangle className="h-3.5 w-3.5" /> <span>Em Atraso</span>
            </button>
          </div>
        )}
        </div>
      )}

        {/* SECONDARY ACTION POPUPS BASED ON THE PWA SUBMENU SELECTION (PREVENT SCROLLING) */}
        {activePwaModal && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setActivePwaModal(null);
            }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[100] flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden text-[11px]" style={{ backgroundColor: "#ffffff" }}
            >
              {/* Header */}
              <div className="bg-slate-100 p-3.5 border-b border-slate-200 flex justify-between items-center shrink-0">
                <span className="font-black uppercase tracking-wider text-emerald-600 text-[10px] flex items-center gap-1.5 truncate max-w-[210px]">
                  {activePwaModal === "reportar_avaria" && "🚨 Reportar Ocorrência"}
                  {activePwaModal === "ver_intervencoes" && "🔧 Intervenções Ativas"}
                  {activePwaModal === "enviar_comprovativo" && "📄 Submissão de Comprovativo"}
                  {activePwaModal === "consultar_referencias" && "💳 Referências de Pagamento"}
                  {activePwaModal === "chat_admin" && "💬 Chat com a Administração"}
                  {activePwaModal === "contactos_emergencia" && "📞 Contactos de Emergência"}
                  {activePwaModal === "arquivo_completo" && "📂 Biblioteca de Documentos"}
                  {activePwaModal === "atas_pendentes" && "✍️ Atas por Assinar"}
                  {activePwaModal === "reservar_espaco" && "📅 Reservar Espaço Comum"}
                  {activePwaModal === "ver_limpezas" && "🧼 Escala de Limpezas"}
                  {activePwaModal === "avaliar_servico" && "⭐ Avaliação de Serviço"}
                  {activePwaModal === "responder_sondagem" && "🗳️ Responder à Sondagem"}
                  {activePwaModal === "estatisticas_sondagem" && "📊 Resultados da Sondagem"}
                  {activePwaModal === "obras_curso" && "🏗️ Obras em Curso"}
                  {activePwaModal === "plano_plurianual" && "📅 Plano Plurianual (2026-2030)"}
                </span>
                <button
                  type="button"
                  onClick={() => setActivePwaModal(null)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black text-xs rounded-lg transition-all cursor-pointer shadow-sm border border-red-500 shrink-0"
                  title="Sair / Fechar Modal"
                  aria-label="Sair / Fechar"
                >
                  <X className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Sair</span>
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-4 overflow-y-auto space-y-4 flex-1">
                {activePwaModal === "reportar_avaria" && (
                  <form onSubmit={(e) => { handleReportAvaria(e); setActivePwaModal(null); }} className="space-y-3">
                    <p className="text-[10px] text-slate-300">Reporte problemas em espaços ou equipamentos comuns do prédio.</p>
                    <div className="space-y-1">
                      <label className="font-extrabold uppercase text-[8px] text-slate-400 block">Equipamento / Área</label>
                      <select
                        value={newIntervEquipamento}
                        onChange={e => setNewIntervEquipamento(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 p-2 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="Elevador">Elevador do Edifício</option>
                        <option value="Portão da Garagem">Portão Principal de Garagem</option>
                        <option value="Bomba de Água">Grupo de Bombas de Água</option>
                        <option value="Iluminação Comum">Iluminação de Patamar / Escadas</option>
                        <option value="Limpeza / Higiene">Problema de Limpeza / Higiene</option>
                        <option value="Outros">Outras Situações Gerais</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-extrabold uppercase text-[8px] text-slate-400 block">Descrição Detalhada</label>
                      <textarea
                        required
                        rows={3}
                        value={newIntervDesc}
                        onChange={e => setNewIntervDesc(e.target.value)}
                        placeholder="Ex: Lâmpada fundida no patamar do 3º andar..."
                        className="w-full bg-slate-800 border border-slate-700 p-2 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-extrabold uppercase text-[8px] text-slate-400 block">Fotografia de Evidência</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNewIntervPhoto("data:image/webp;base64,mockphoto");
                            setNewIntervPhotoName("avaria_foto_condominio.webp");
                            alert("Câmara ativada! Fotografia comprimida automaticamente para formato .WEBP.");
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 rounded-lg font-bold"
                        >
                          <Camera className="h-3 w-3 text-emerald-400" />
                          <span>Tirar Foto (.WEBP)</span>
                        </button>
                        <span className="text-[9px] text-slate-400 italic truncate max-w-[120px]">
                          {newIntervPhotoName || "Nenhum ficheiro"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-slate-950 font-black py-2.5 rounded-xl text-center uppercase tracking-wider text-[9px] cursor-pointer mt-2 transition-colors"
                    >
                      Submeter Ocorrência
                    </button>
                  </form>
                )}

                {activePwaModal === "ver_intervencoes" && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-slate-300">Lista de intervenções e vistorias registadas no seu prédio:</p>
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                      {intervencoesList.map(interv => (
                        <div key={interv.id} className="bg-slate-850 border border-slate-800 p-3 rounded-xl space-y-1.5">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[8px] font-mono text-slate-400 font-extrabold">{interv.id} • {interv.data}</span>
                              <h4 className="font-extrabold text-white text-[11px]">{interv.equipamento}</h4>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[7px] font-extrabold uppercase ${
                              interv.estado === "Pendente" ? "bg-amber-950/40 text-amber-400 border border-amber-900/30" :
                              interv.estado === "Em curso" ? "bg-blue-950/40 text-blue-400 border border-blue-900/30" :
                              "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30"
                            }`}>
                              {interv.estado}
                            </span>
                          </div>
                          <p className="text-slate-300 leading-normal text-[10px]">"{interv.descricao}"</p>
                          <div className="text-[8px] text-slate-400 border-t border-slate-800/60 pt-1 flex justify-between">
                            <span>Técnico: <strong className="text-slate-300">{interv.fornecedor}</strong></span>
                            <button
                              onClick={() => alert(`Detalhes:\nID: ${interv.id}\nEquipamento: ${interv.equipamento}\nEstado: ${interv.estado}\nFornecedor Adjudicado: ${interv.fornecedor}`)}
                              className="text-emerald-400 hover:underline"
                            >
                              Ver Histórico
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activePwaModal === "enviar_comprovativo" && (
                  <div className="space-y-3 text-[10px]">
                    <p className="text-slate-300">Envie o ficheiro de pagamento das quotas ordinárias para validação automática com a nossa IA inteligente.</p>
                    
                    <div className="border-2 border-dashed border-slate-700 bg-slate-950/20 rounded-xl p-5 text-center relative space-y-2">
                      {comprovativoExtracting ? (
                        <div className="py-4 space-y-2 flex flex-col items-center">
                          <RefreshCw className="h-6 w-6 text-emerald-400 animate-spin" />
                          <span className="font-bold text-slate-200">A processar comprovativo com IA...</span>
                          <span className="text-[7px] font-mono text-slate-400">Extração ótica inteligente ativa</span>
                        </div>
                      ) : comprovativoExtractedData ? (
                        <div className="text-left space-y-3">
                          <div className="p-2 bg-emerald-950/40 border border-emerald-900/30 text-[9px] text-emerald-400 rounded-lg flex items-center gap-1">
                            <Check className="h-3 w-3 shrink-0" />
                            <span>Leitura efetuada! "{comprovativoFileName}"</span>
                          </div>
                          <div className="bg-slate-850 p-2.5 rounded-lg border border-slate-800 space-y-1">
                            <div className="flex justify-between font-mono">
                              <span className="text-slate-400 text-[8px]">VALOR EXTRAÍDO:</span>
                              <strong className="text-white text-[11px]">{comprovativoExtractedData.valor.toFixed(2)} €</strong>
                            </div>
                            <div className="flex justify-between font-mono">
                              <span className="text-slate-400 text-[8px]">REFERÊNCIA:</span>
                              <strong className="text-indigo-400">{comprovativoExtractedData.referencia}</strong>
                            </div>
                            <div className="text-slate-400 text-[8px] mt-1 border-t border-slate-800 pt-1 leading-normal">
                              💡 <strong className="text-slate-350">{comprovativoExtractedData.sugestaoLancamento}</strong>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setComprovativoUpload(null);
                                setComprovativoExtractedData(null);
                              }}
                              className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold"
                            >
                              Voltar a Enviar
                            </button>
                            <button
                              onClick={() => {
                                handleConfirmComprovativo();
                                setActivePwaModal(null);
                              }}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-slate-950 font-black rounded-lg transition-colors"
                            >
                              Confirmar e Liquidar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 space-y-2">
                          <span className="text-3xl block">📄</span>
                          <button
                            type="button"
                            onClick={() => document.getElementById("pwa-popup-comprovativo")?.click()}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-lg cursor-pointer animate-pulse"
                          >
                            Selecionar Comprovativo
                          </button>
                          <p className="text-[8px] text-slate-400">Suporta PDFs bancários ou fotos do talão de multibanco</p>
                          <input 
                            id="pwa-popup-comprovativo" 
                            type="file" 
                            accept="image/*,application/pdf" 
                            onChange={handleComprovativoUpload} 
                            className="hidden" 
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activePwaModal === "consultar_referencias" && (
                  <div className="space-y-3.5 text-[10px]">
                    <p className="text-slate-300">Registo de contas e referências bancárias para pagamento de quotas:</p>
                    
                    {/* IBAN do Prédio */}
                    <div className="bg-slate-850 p-3 rounded-xl border border-slate-800 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] uppercase tracking-wider text-slate-400 font-extrabold">IBAN para Transferência</span>
                        <button 
                          onClick={() => handleCopyToClipboard("PT50 0007 0000 1234 5678 9012 3", "IBAN")}
                          className="text-emerald-400 hover:underline font-bold text-[8px]"
                        >
                          Copiar IBAN
                        </button>
                      </div>
                      <strong className="text-white block font-mono text-[10px]">PT50 0007 0000 1234 5678 9012 3</strong>
                      <span className="text-[8px] text-slate-400 block">Banco de Destino: Banco Montepio (Condomínio do Edifício)</span>
                    </div>

                    {/* Referência Individual */}
                    <div className="bg-slate-850 p-3 rounded-xl border border-slate-800 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] uppercase tracking-wider text-slate-400 font-extrabold">Referência da Fração</span>
                        <button 
                          onClick={() => handleCopyToClipboard(fractionRef, "Referência")}
                          className="text-emerald-400 hover:underline font-bold text-[8px]"
                        >
                          Copiar Ref
                        </button>
                      </div>
                      <strong className="text-emerald-400 font-mono text-xs block tracking-widest">{fractionRef}</strong>
                      <span className="text-[8px] text-slate-400 block">Identificador individual gerado automaticamente pela IA para a Fração 3ºE.</span>
                    </div>

                    {/* Quota Extraordinária */}
                    {simulateExtraQuota && (
                      <div className="bg-indigo-950/20 border border-indigo-900/40 p-3 rounded-xl space-y-2">
                        <div className="flex justify-between font-bold">
                          <span className="text-indigo-300">🔨 Pintura de Fachadas (Quota Extra)</span>
                          <span className="text-white font-mono">35.00 €</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[8px] leading-relaxed">
                          <div>
                            <span className="text-slate-400 block">IBAN Obra</span>
                            <div className="flex items-center gap-1 font-mono text-slate-300">
                              <span className="truncate max-w-[70px]">PT50 1111...</span>
                              <button onClick={() => handleCopyToClipboard("PT50 1111 2222 3333 4444 5555 6", "IBAN da Obra")} className="text-emerald-400">Copiar</button>
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Referência Obra</span>
                            <div className="flex items-center gap-1 font-mono text-slate-300">
                              <span>{fractionRef}_PINTURA</span>
                              <button onClick={() => handleCopyToClipboard(`${fractionRef}_PINTURA`, "Referência da Obra")} className="text-emerald-400">Copiar</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activePwaModal === "chat_admin" && (
                  <div className="space-y-3 text-[10px] flex flex-col h-[52vh] relative">
                    <div className="flex justify-between items-center shrink-0">
                      <p className="text-slate-300">Comunique diretamente com a administração em tempo real.</p>
                      <span className="text-[8px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
                        Admin Online
                      </span>
                    </div>
                    
                    <div className="flex-grow bg-slate-950/40 border border-slate-800 rounded-2xl p-3 space-y-2.5 overflow-y-auto min-h-[160px]">
                      {/* Admin greeting */}
                      <div className="p-2.5 bg-slate-850 rounded-2xl border border-slate-800 space-y-1 max-w-[85%]">
                        <div className="flex justify-between font-bold text-slate-400 text-[8px]">
                          <span className="text-emerald-400 font-extrabold">🏢 Administração do Prédio</span>
                          <span>Hoje 16:15</span>
                        </div>
                        <p className="text-slate-200 leading-normal">
                          Boa tarde Sr. João, informamos que a equipa de vistorias já reportou a anomalia na porta do ginásio. O técnico foi adjudicado para verificação esta quarta-feira.
                        </p>
                      </div>

                      {/* User sample message */}
                      <div className="p-2.5 bg-emerald-950/30 rounded-2xl border border-emerald-800/40 text-right space-y-1 ml-auto max-w-[85%]">
                        <div className="flex justify-between font-bold text-emerald-400 text-[8px] flex-row-reverse">
                          <span className="font-extrabold">Você (3ºE)</span>
                          <span>Hoje 14:10</span>
                        </div>
                        <p className="text-slate-200 leading-normal">
                          Detetei que a porta do ginásio no piso -1 não está a fechar corretamente após as limpezas. Podem mandar verificar?
                        </p>
                      </div>

                      {/* Dynamic Custom Messages */}
                      {customMessages.map((msg, idx) => {
                        const isAudio = typeof msg === "string" && msg.includes("[Nota de voz");
                        const isPhoto = typeof msg === "string" && msg.includes("[Fotografia");
                        const isDoc = typeof msg === "string" && msg.includes("[Documento");
                        const msgId = `msg-${idx}`;
                        const isPlaying = playingAudioId === msgId;

                        return (
                          <div key={idx} className="p-2.5 bg-emerald-950/30 rounded-2xl border border-emerald-800/40 text-right space-y-1.5 ml-auto max-w-[88%] animate-fade-in">
                            <div className="flex justify-between font-bold text-emerald-400 text-[8px] flex-row-reverse">
                              <span className="font-extrabold">Você (3ºE)</span>
                              <span>Agora</span>
                            </div>

                            {/* Voice Note Player Bubble */}
                            {isAudio ? (
                              <div className="flex items-center justify-end space-x-2 bg-slate-900/80 p-2 rounded-xl border border-emerald-800/40 text-left">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isPlaying) {
                                      setPlayingAudioId(null);
                                    } else {
                                      setPlayingAudioId(msgId);
                                      playVoiceNoteSimulation(4, () => setPlayingAudioId(null));
                                    }
                                  }}
                                  className="h-7 w-7 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center cursor-pointer transition-transform active:scale-95 shrink-0"
                                  title={isPlaying ? "Pausar" : "Ouvir Nota de Voz"}
                                >
                                  {isPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />}
                                </button>
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center space-x-0.5">
                                    {[30, 70, 45, 90, 60, 40, 85, 50, 75, 35, 65, 80, 55, 45].map((h, i) => (
                                      <span
                                        key={i}
                                        className={`w-1 rounded-full transition-all duration-300 ${
                                          isPlaying ? "bg-emerald-400 animate-pulse" : "bg-slate-600"
                                        }`}
                                        style={{ height: `${Math.max(4, h * 0.16)}px` }}
                                      />
                                    ))}
                                  </div>
                                  <div className="flex justify-between text-[7.5px] font-mono text-slate-400">
                                    <span>{isPlaying ? "A reproduzir áudio..." : "Nota de voz"}</span>
                                    <span>0:04</span>
                                  </div>
                                </div>
                              </div>
                            ) : isPhoto ? (
                              <div className="space-y-1 text-left">
                                <div className="bg-slate-900 p-1.5 rounded-xl border border-slate-700 overflow-hidden flex items-center justify-center max-h-36">
                                  <img 
                                    src="/estados-acoes/04-guardar.png" 
                                    alt="Fotografia Anexada" 
                                    className="max-h-28 object-contain rounded-lg"
                                  />
                                </div>
                                <span className="text-[8.5px] text-emerald-300 font-bold block text-right">{msg}</span>
                              </div>
                            ) : isDoc ? (
                              <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-700 flex items-center space-x-2 text-left">
                                <File className="h-4 w-4 text-emerald-400 shrink-0" />
                                <div className="truncate flex-1">
                                  <span className="text-[9px] font-bold text-white block truncate">{msg.replace("📎 ", "")}</span>
                                  <span className="text-[7.5px] text-slate-400">Documento PDF/Anexo verificado</span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-slate-200 leading-normal">{msg}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Previews of attached Photo (WebP), Document or Audio Voice Note */}
                    {(chatPhotoWebp || chatAudioData || chatDocAttachment) && (
                      <div className="flex flex-wrap items-center gap-2 px-1">
                        {chatPhotoWebp && (
                          <div className="bg-emerald-950/90 border border-emerald-500/50 px-2 py-1 rounded-xl text-[9px] flex items-center gap-1.5 text-emerald-200 shadow-sm animate-fade-in">
                            <Camera className="h-3 w-3 text-emerald-400" />
                            <span className="font-bold truncate max-w-[120px]">{chatPhotoName || "Foto_Camara.webp"}</span>
                            <button 
                              type="button" 
                              onClick={() => { setChatPhotoWebp(null); setChatPhotoName(null); }} 
                              className="text-red-400 hover:text-red-300 font-bold ml-1 cursor-pointer"
                              title="Remover fotografia"
                            >
                              ✕
                            </button>
                          </div>
                        )}

                        {chatDocAttachment && (
                          <div className="bg-indigo-950/90 border border-indigo-500/50 px-2 py-1 rounded-xl text-[9px] flex items-center gap-1.5 text-indigo-200 shadow-sm animate-fade-in">
                            <File className="h-3 w-3 text-indigo-400" />
                            <span className="font-bold truncate max-w-[120px]">{chatDocAttachment.name} ({chatDocAttachment.size})</span>
                            <button 
                              type="button" 
                              onClick={() => setChatDocAttachment(null)} 
                              className="text-red-400 hover:text-red-300 font-bold ml-1 cursor-pointer"
                              title="Remover anexo"
                            >
                              ✕
                            </button>
                          </div>
                        )}

                        {chatAudioData && (
                          <div className="bg-amber-950/90 border border-amber-500/50 px-2 py-1 rounded-xl text-[9px] flex items-center gap-1.5 text-amber-200 shadow-sm animate-fade-in">
                            <Volume2 className="h-3 w-3 text-amber-400" />
                            <span className="font-bold">Gravação de Voz ({chatAudioTimer || 4}s)</span>
                            <button 
                              type="button" 
                              onClick={() => { setChatAudioData(null); setChatAudioTimer(0); }} 
                              className="text-red-400 hover:text-red-300 font-bold ml-1 cursor-pointer"
                              title="Eliminar gravação"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* EMOJI PICKER POPOVER */}
                    {isEmojiPickerOpen && (
                      <div className="absolute bottom-14 left-2 right-2 bg-slate-900 border border-slate-750 p-2.5 rounded-2xl shadow-2xl z-50 animate-fade-in">
                        <div className="flex justify-between items-center pb-1.5 mb-1.5 border-b border-slate-800">
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Selecionar Emoji</span>
                          <button 
                            type="button" 
                            onClick={() => setIsEmojiPickerOpen(false)}
                            className="text-slate-400 hover:text-white text-xs cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="grid grid-cols-8 gap-1.5 text-base">
                          {["😊", "👍", "🏢", "🔑", "🚪", "💡", "🔧", "⚠️", "📄", "💶", "⏱️", "📋", "🤝", "📢", "🚨", "💧", "🛠️", "🚗", "📦", "🧹", "✨", "🔒", "✅", "❌"].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                setNewMsgText(newMsgText + emoji);
                                setIsEmojiPickerOpen(false);
                              }}
                              className="p-1 hover:bg-slate-800 rounded-lg text-center cursor-pointer transition-transform hover:scale-125"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ATTACHMENT / CLIP ACTION MENU POPOVER */}
                    {isAttachmentMenuOpen && (
                      <div className="absolute bottom-14 left-2 bg-slate-900 border border-slate-750 p-2 rounded-2xl shadow-2xl z-50 animate-fade-in space-y-1 min-w-[190px]">
                        <div className="flex justify-between items-center pb-1 mb-1 border-b border-slate-800 px-1">
                          <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-slate-400">Anexar Ficheiro</span>
                          <button 
                            type="button" 
                            onClick={() => setIsAttachmentMenuOpen(false)}
                            className="text-slate-400 hover:text-white text-xs cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Option 1: Document */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAttachmentMenuOpen(false);
                            document.getElementById("pwa-chat-doc-input")?.click();
                          }}
                          className="w-full flex items-center space-x-2 p-2 hover:bg-slate-800 text-slate-200 rounded-xl text-left cursor-pointer transition-colors"
                        >
                          <div className="p-1 bg-indigo-500/20 text-indigo-400 rounded-lg">
                            <File className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-[9.5px] block">Documento / PDF</span>
                            <span className="text-[7.5px] text-slate-400">PDF, Word, Excel, TXT</span>
                          </div>
                        </button>

                        {/* Option 2: Camera photo */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAttachmentMenuOpen(false);
                            document.getElementById("pwa-chat-camera-input")?.click();
                          }}
                          className="w-full flex items-center space-x-2 p-2 hover:bg-slate-800 text-slate-200 rounded-xl text-left cursor-pointer transition-colors"
                        >
                          <div className="p-1 bg-emerald-500/20 text-emerald-400 rounded-lg">
                            <Camera className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-[9.5px] block">Tirar Fotografia (Câmara)</span>
                            <span className="text-[7.5px] text-slate-400">Acesso à câmara móvel/PC</span>
                          </div>
                        </button>

                        {/* Option 3: Gallery Image */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAttachmentMenuOpen(false);
                            document.getElementById("pwa-chat-photo-input")?.click();
                          }}
                          className="w-full flex items-center space-x-2 p-2 hover:bg-slate-800 text-slate-200 rounded-xl text-left cursor-pointer transition-colors"
                        >
                          <div className="p-1 bg-amber-500/20 text-amber-400 rounded-lg">
                            <Image className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-[9.5px] block">Galeria de Fotos</span>
                            <span className="text-[7.5px] text-slate-400">Compressão .WEBP imediata</span>
                          </div>
                        </button>
                      </div>
                    )}

                    {/* HIDDEN FILE INPUTS */}
                    {/* 1. Document Input */}
                    <input
                      id="pwa-chat-doc-input"
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const sizeStr = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)}MB` : `${Math.round(file.size / 1024)}KB`;
                          setChatDocAttachment({ name: file.name, size: sizeStr });
                          if (!newMsgText) setNewMsgText(`📎 [Documento Anexo: ${file.name}]`);
                        }
                      }}
                      className="hidden"
                    />

                    {/* 2. Direct Camera Input */}
                    <input
                      id="pwa-chat-camera-input"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setChatPhotoWebp("data:image/webp;base64,mockwebpchatbytes...");
                          setChatPhotoName(`Camera_${file.name || "foto.webp"}`);
                          if (!newMsgText) setNewMsgText("📷 [Fotografia da Câmara em Anexo]");
                        }
                      }}
                      className="hidden"
                    />

                    {/* 3. Gallery Input */}
                    <input
                      id="pwa-chat-photo-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setChatPhotoWebp("data:image/webp;base64,mockwebpchatbytes...");
                          setChatPhotoName(file.name || "imagem.webp");
                          if (!newMsgText) setNewMsgText("🖼️ [Imagem da Galeria em Anexo]");
                        }
                      }}
                      className="hidden"
                    />

                    {/* CHAT INPUT BAR WITH CLIP, EMOJIS, MIC AND SEND BUTTON */}
                    <form 
                      onSubmit={(e) => { 
                        if (chatAudioData && !newMsgText) {
                          setNewMsgText(`🎙️ [Nota de voz de ${chatAudioTimer || 4}s]`);
                        }
                        handleEnviarMensagem(e);
                        setChatAudioData(null);
                        setChatPhotoWebp(null);
                        setChatPhotoName(null);
                        setChatDocAttachment(null);
                        setIsEmojiPickerOpen(false);
                        setIsAttachmentMenuOpen(false);
                      }} 
                      className="flex items-center gap-1.5 shrink-0 pt-2 border-t border-slate-800"
                    >
                      {/* CLIP BUTTON (Anexos / Documentos / Foto com câmara) */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsAttachmentMenuOpen(!isAttachmentMenuOpen);
                          setIsEmojiPickerOpen(false);
                        }}
                        className={`p-2 rounded-xl cursor-pointer transition-colors shrink-0 ${
                          isAttachmentMenuOpen || chatPhotoWebp || chatDocAttachment
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                        }`}
                        title="Anexar documento, fotografia ou aceder à câmara (Clip)"
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>

                      {/* EMOJI BUTTON */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsEmojiPickerOpen(!isEmojiPickerOpen);
                          setIsAttachmentMenuOpen(false);
                        }}
                        className={`p-2 rounded-xl cursor-pointer transition-colors shrink-0 ${
                          isEmojiPickerOpen
                            ? "bg-amber-500 text-slate-950 shadow-xs"
                            : "bg-slate-800 hover:bg-slate-700 text-amber-400"
                        }`}
                        title="Inserir Emoji"
                      >
                        <Smile className="h-4 w-4" />
                      </button>

                      {/* MIC AUDIO VOICE NOTE RECORDER */}
                      <button
                        type="button"
                        onClick={() => {
                          if (isRecordingChatAudio) {
                            setIsRecordingChatAudio(false);
                            setChatAudioData("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
                            if (!newMsgText) setNewMsgText(`🎙️ [Nota de voz de ${chatAudioTimer || 4}s]`);
                          } else {
                            setIsRecordingChatAudio(true);
                            setChatAudioTimer(0);
                          }
                        }}
                        className={`p-2 ${
                          isRecordingChatAudio 
                            ? "bg-red-600 text-white animate-pulse" 
                            : "bg-slate-800 hover:bg-slate-700 text-emerald-400"
                        } rounded-xl cursor-pointer transition-colors shrink-0`}
                        title={isRecordingChatAudio ? "Parar gravação de voz" : "Gravar mensagem de áudio (Nota de Voz)"}
                      >
                        <Mic className="h-4 w-4" />
                      </button>

                      {/* TEXT INPUT */}
                      <input 
                        type="text" 
                        required={!chatAudioData && !chatPhotoWebp && !chatDocAttachment}
                        value={newMsgText}
                        onChange={e => setNewMsgText(e.target.value)}
                        placeholder={
                          isRecordingChatAudio 
                            ? `🔴 A gravar áudio (${chatAudioTimer}s)... clique no microfone para parar` 
                            : "Escreva ao gestor do prédio..."
                        }
                        className="flex-grow bg-slate-850 border border-slate-750 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500 text-white font-medium shadow-inner"
                      />

                      {/* ENVIAR MENSAGEM BUTTON (Explicit Icon & Tooltip) */}
                      <button 
                        type="submit" 
                        className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-xl cursor-pointer transition-all active:scale-95 shadow-md flex items-center justify-center shrink-0"
                        title="Enviar Mensagem"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                )}

                {activePwaModal === "contactos_emergencia" && (
                  <div className="space-y-3.5 text-[10px]">
                    <p className="text-slate-300">Lista de piquetes e contactos urgentes de assistência ao condomínio:</p>
                    
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                      {[
                        { servico: "Piquete de Elevadores (Otis)", num: "808 20 20 20", desc: "Avarias em cabines ou pessoas presas" },
                        { servico: "Canalizador Técnico do Prédio", num: "912 345 678", desc: "Ruturas de água, inundações ou torneiras de corte" },
                        { servico: "Piquete Geral de Eletricidade", num: "800 234 567", desc: "Falta de luz no hall, patamares ou garagem" },
                        { servico: "Portões Automáticos (Assistência)", num: "933 888 111", desc: "Bloqueio ou descarrilamento do portão garagem" },
                        { servico: "Administração CondoManager AI", num: "210 111 222", desc: "Assuntos gerais urgentes e dúvidas técnicas" }
                      ].map((cont, idx) => (
                        <div key={idx} className="bg-slate-850 border border-slate-800 p-2.5 rounded-xl flex justify-between items-center gap-2">
                          <div className="space-y-1 truncate">
                            <h4 className="font-extrabold text-white text-[10.5px] truncate">{cont.servico}</h4>
                            <span className="text-[8px] text-slate-400 block truncate">{cont.desc}</span>
                            <strong className="text-emerald-400 font-mono text-[9.5px]">{cont.num}</strong>
                          </div>
                          <button
                            onClick={() => alert(`A simular chamada para piquete de emergência:\n${cont.servico}: ${cont.num}`)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-slate-950 rounded-lg font-black text-[9px] uppercase cursor-pointer shrink-0"
                          >
                            Ligar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activePwaModal === "arquivo_completo" && (
                  <div className="space-y-3.5 text-[10px]">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="Pesquisa inteligente de faturas, atas..."
                        value={documentSearch}
                        onChange={e => setDocumentSearch(e.target.value)}
                        className="w-full bg-slate-850 border border-slate-750 pl-8 pr-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500 text-white"
                      />
                    </div>

                    <div className="flex space-x-1 overflow-x-auto pb-1 text-[8.5px] font-bold">
                      {["Todos", "Fração", "Prédio", "Regulamentos", "Seguros", "Contratos", "Faturas"].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setDocumentCategory(cat as any)}
                          className={`px-2.5 py-1 rounded-full cursor-pointer shrink-0 transition-colors ${
                            documentCategory === cat ? "bg-emerald-500 text-slate-950 font-black" : "bg-slate-800 hover:bg-slate-750 text-slate-300"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                      {documentos
                        .filter(doc => 
                          documentCategory === "Todos" || 
                          doc.categoria?.toLowerCase() === documentCategory.toLowerCase() || 
                          (documentCategory === "Fração" && doc.categoria === "Privado") || 
                          (documentCategory === "Prédio" && doc.categoria === "Público") ||
                          (documentCategory === "Biblioteca" && (doc.categoria === "Público" || doc.categoria?.toLowerCase() === "regulamentos"))
                        )
                        .filter(doc => doc.nome.toLowerCase().includes(documentSearch.toLowerCase()))
                        .map(doc => (
                          <div key={doc.id_doc} className="bg-slate-850 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-base shrink-0">📄</span>
                              <div className="truncate">
                                <span className="font-bold text-white block truncate text-[10.5px]">{doc.nome}</span>
                                <span className="text-[8px] text-slate-400 font-mono uppercase">{doc.categoria || doc.tipo} • {doc.data_upload}</span>
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0 font-bold">
                              <button 
                                onClick={() => {
                                  setSelectedDocPreview(doc);
                                  alert(`A abrir visualizador de IA para: ${doc.nome}`);
                                }}
                                className="p-1 text-slate-400 hover:text-emerald-400 cursor-pointer"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button 
                                onClick={() => generateAndDownloadPdf(
                                  doc.nome,
                                  [{ heading: "Conteúdo do Documento", content: doc.descricao || "Ficheiro oficial do condomínio registado no arquivo digital." }],
                                  doc.nome,
                                  [{ label: "Condomínio", value: predio.nome }, { label: "Data Upload", value: doc.data_upload }]
                                )}
                                className="p-1 text-slate-400 hover:text-emerald-400 cursor-pointer"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {activePwaModal === "atas_pendentes" && (
                  <div className="space-y-3.5 text-[10px]">
                    <p className="text-slate-300">As seguintes atas de assembleia aguardam a sua leitura e assinatura digital para validação jurídica do condomínio:</p>
                    
                    <div className="space-y-2.5">
                      {[
                        { id: "ATA-056", nome: "Ata Assembleia Geral de Maio 2026", data: "15/05/2026", estado: "Pendente de Assinatura" }
                      ].map((ata, idx) => (
                        <div key={idx} className="bg-slate-850 border border-slate-800 p-3 rounded-xl space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[8px] font-mono text-slate-400 font-extrabold">{ata.id} • {ata.data}</span>
                              <h4 className="font-extrabold text-white text-[10.5px]">{ata.nome}</h4>
                            </div>
                            <span className="px-1.5 py-0.5 rounded text-[7px] font-bold bg-amber-950 text-amber-400 border border-amber-900/30 uppercase">{ata.estado}</span>
                          </div>
                          <p className="text-slate-400 leading-normal text-[9px]">Deliberações aprovadas: Orçamento da pintura das fachadas por votação maioritária qualificada.</p>
                          <div className="flex gap-2 pt-1 border-t border-slate-800/60">
                            <button
                              onClick={() => generateAndDownloadPdf(
                                ata.nome,
                                [{ heading: "Deliberações da Assembleia", content: "Ata aprovada com contagem de votos por permilagem. Deliberações sobre orçamentos de obras e manutenção geral do condomínio." }],
                                `${ata.id}_${ata.nome.replace(/\s+/g, '_')}.pdf`,
                                [{ label: "Condomínio", value: predio.nome }, { label: "Data", value: ata.data }]
                              )}
                              className="flex-grow py-1.5 bg-slate-800 hover:bg-slate-750 text-white rounded-lg font-bold cursor-pointer"
                            >
                              Ler Ata
                            </button>
                            <button
                              onClick={() => setSigningAtaTarget(ata)}
                              className="flex-grow py-1.5 bg-emerald-600 hover:bg-emerald-700 text-slate-950 font-black rounded-lg uppercase text-[8.5px] cursor-pointer shadow flex items-center justify-center gap-1"
                            >
                              ✍️ Assinar com Quadro Tátil
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activePwaModal === "reservar_espaco" && (
                  <div className="space-y-3.5 text-[10px]">
                    <p className="text-slate-300">Efetue a reserva de espaços comuns do prédio diretamente na PWA:</p>
                    
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="font-extrabold uppercase text-[8px] text-slate-400 block">Selecione o Espaço</label>
                        <select
                          value={bookingSpace}
                          onChange={e => setBookingSpace(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 p-2 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="Salão de Festas">Salão de Festas Comum (Piso 0)</option>
                          <option value="Ginásio Comum">Ginásio Comum do Prédio (Piso -1)</option>
                          <option value="Churrasqueira Coletiva">Churrasqueira Exterior & Jardim</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="font-extrabold uppercase text-[8px] text-slate-400 block">Data da Reserva</label>
                        <input
                          type="date"
                          value={bookingDate}
                          onChange={e => setBookingDate(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 p-2 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-extrabold uppercase text-[8px] text-slate-400 block">Período Horário</label>
                        <select
                          value={bookingTime}
                          onChange={e => setBookingTime(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 p-2 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="09:00 - 13:00">Manhã (09:00 - 13:00)</option>
                          <option value="14:00 - 18:00">Tarde (14:00 - 18:00)</option>
                          <option value="19:00 - 23:00">Noite (19:00 - 23:00)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="font-extrabold uppercase text-[8px] text-slate-400 block">Nº Estimado de Convidados</label>
                        <input
                          type="number"
                          min={1}
                          max={40}
                          value={bookingGuests}
                          onChange={e => setBookingGuests(parseInt(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-700 p-2 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        alert(`Reserva efetuada com sucesso!\nEspaço: ${bookingSpace}\nData: ${bookingDate}\nHorário: ${bookingTime}\nNº Estimado de Convidados: ${bookingGuests}\n\nA sua reserva está ativa e autorizada pela IA de gestão!`);
                        setPwaNotifications(prev => [{
                          id: `NOT-${Date.now()}`,
                          title: "Espaço Reservado",
                          desc: `Reservou o espaço "${bookingSpace}" para ${bookingDate}.`,
                          date: "Hoje",
                          isArchived: false
                        }, ...prev]);
                        setActivePwaModal(null);
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-slate-950 font-black py-2.5 rounded-xl uppercase tracking-wider text-[9px] cursor-pointer mt-1"
                    >
                      📅 Confirmar Reserva de Espaço
                    </button>
                  </div>
                )}

                {activePwaModal === "ver_limpezas" && (
                  <div className="space-y-3.5 text-[10px]">
                    <p className="text-slate-300">Consulte a escala e o histórico de higiene e limpezas efetuadas no seu prédio:</p>
                    
                    <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                      {limpezasHistorico.map(limp => (
                        <div key={limp.id} className="bg-slate-850 border border-slate-800 p-3 rounded-xl space-y-2">
                          <div className="flex justify-between font-bold">
                            <span className="text-slate-400 uppercase text-[8px] font-mono">{limp.id} • {limp.data} às {limp.hora}</span>
                            <span className="text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> {limp.estado}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[9px] leading-tight text-slate-300">
                            <div>Técnico: <strong className="text-white block mt-0.5">{limp.tecnico}</strong></div>
                            <div>Anomalias: <strong className={`block mt-0.5 ${limp.avariaDetetada !== "Nenhuma" ? "text-rose-400 font-bold" : "text-emerald-400"}`}>{limp.avariaDetetada}</strong></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activePwaModal === "avaliar_servico" && (
                  <div className="space-y-3.5 text-[10px]">
                    <p className="text-slate-300">Avalie a qualidade dos serviços de higienização das áreas comuns ou manutenções realizadas recentemente:</p>
                    
                    <div className="space-y-2.5">
                      {limpezasHistorico.slice(0, 2).map(limp => (
                        <div key={limp.id} className="bg-slate-850 border border-slate-800 p-3 rounded-xl space-y-2">
                          <div className="flex justify-between text-slate-400 font-bold text-[8px]">
                            <span>{limp.id} • {limp.data}</span>
                            <span className="text-slate-300">Responsável: {limp.tecnico}</span>
                          </div>
                          <h4 className="font-extrabold text-white text-[10.5px]">Limpeza Geral de Escadas e Elevadores</h4>
                          
                          <div className="flex items-center justify-between pt-1.5 border-t border-slate-800">
                            <div className="flex space-x-1">
                              {[1, 2, 3, 4, 5].map(star => (
                                <button
                                  key={star}
                                  onClick={() => {
                                    setCleaningRatings(prev => ({ ...prev, [limp.id]: star }));
                                    alert(`Avaliou este serviço com ${star} estrelas! Obrigado.`);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Star className={`h-4 w-4 ${
                                    (cleaningRatings[limp.id] || 0) >= star ? "text-amber-400 fill-amber-400" : "text-slate-600 hover:text-slate-400"
                                  }`} />
                                </button>
                              ))}
                            </div>
                            <span className="font-extrabold text-emerald-400 text-[8px] uppercase">
                              {cleaningRatings[limp.id] ? "✓ Avaliado" : "Avaliar"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activePwaModal === "responder_sondagem" && (
                  <div className="space-y-3.5 text-[10px]">
                    <p className="text-slate-300">Responda à sondagem do seu edifício. O seu voto é registado de forma encriptada na PWA.</p>
                    
                    <div className="bg-slate-850 border border-slate-800 p-3.5 rounded-xl space-y-3">
                      {votedPoll ? (
                        <div className="flex flex-col items-center justify-center py-4 text-center">
                          <CheckCircle className="h-6 w-6 text-emerald-400 mb-2 animate-bounce" />
                          <span className="font-extrabold text-white">Voto registado com sucesso!</span>
                          <span className="text-[8.5px] text-slate-400 mt-1">Obrigado pelo seu contributo para as decisões comunitárias.</span>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <h4 className="font-black text-white text-xs leading-snug">Concorda com a pintura das escadas em tom cinza claro?</h4>
                            <p className="text-slate-400 text-[8.5px]">A pintura irá cobrir os desgastes atuais. Custos cobertos pelo fundo de reserva extraordinário.</p>
                          </div>
                          <div className="space-y-2 pt-1.5">
                            {[
                              { key: "Sim", text: "Sim, concordo inteiramente" },
                              { key: "Não", text: "Não, prefiro manter o tom atual" },
                              { key: "Adiar", text: "Adiar decisão para próxima assembleia" }
                            ].map(opt => (
                              <button
                                key={opt.key}
                                onClick={() => handleVote(opt.key)}
                                className="w-full text-left p-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 rounded-xl font-bold flex justify-between items-center transition-all cursor-pointer"
                              >
                                <span>{opt.text}</span>
                                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {activePwaModal === "estatisticas_sondagem" && (
                  <div className="space-y-3.5 text-[10px]">
                    <p className="text-slate-300">Consulte os resultados interativos das sondagens do condomínio em tempo real:</p>
                    
                    <div className="bg-slate-850 border border-slate-800 p-3.5 rounded-xl space-y-3">
                      <div className="space-y-1">
                        <span className="text-[8px] bg-emerald-950 text-emerald-400 font-extrabold uppercase px-1.5 py-0.5 rounded border border-emerald-900/30">Deliberação Ativa</span>
                        <h4 className="font-extrabold text-white text-[11px] mt-1">Pintura das escadas interiores em tom cinza claro?</h4>
                      </div>

                      <div className="space-y-2.5 pt-1.5">
                        {/* Sim */}
                        <div className="space-y-1">
                          <div className="flex justify-between font-bold text-[9px]">
                            <span>Sim, concordo inteiramente</span>
                            <span className="font-mono text-emerald-400">{(votosSimulados.sim / (votosSimulados.sim + votosSimulados.nao + votosSimulados.adiar) * 100).toFixed(1)}% ({votosSimulados.sim} votos)</span>
                          </div>
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${(votosSimulados.sim / (votosSimulados.sim + votosSimulados.nao + votosSimulados.adiar) * 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Não */}
                        <div className="space-y-1">
                          <div className="flex justify-between font-bold text-[9px]">
                            <span>Não, prefiro manter o tom atual</span>
                            <span className="font-mono text-rose-450">{(votosSimulados.nao / (votosSimulados.sim + votosSimulados.nao + votosSimulados.adiar) * 100).toFixed(1)}% ({votosSimulados.nao} votos)</span>
                          </div>
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${(votosSimulados.nao / (votosSimulados.sim + votosSimulados.nao + votosSimulados.adiar) * 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Adiar */}
                        <div className="space-y-1">
                          <div className="flex justify-between font-bold text-[9px]">
                            <span>Adiar decisão para próxima assembleia</span>
                            <span className="font-mono text-amber-400">{(votosSimulados.adiar / (votosSimulados.sim + votosSimulados.nao + votosSimulados.adiar) * 100).toFixed(1)}% ({votosSimulados.adiar} votos)</span>
                          </div>
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${(votosSimulados.adiar / (votosSimulados.sim + votosSimulados.nao + votosSimulados.adiar) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <span className="text-[7.5px] text-slate-400 font-mono uppercase font-bold text-center block pt-1 border-t border-slate-800">Total de Frações Votantes: {votosSimulados.sim + votosSimulados.nao + votosSimulados.adiar} (Quorum: 100%)</span>
                    </div>
                  </div>
                )}

                {activePwaModal === "obras_curso" && (
                  <div className="space-y-3.5 text-[10px]">
                    <p className="text-slate-300">Acompanhe as intervenções extraordinárias em andamento ou recentemente concluídas:</p>
                    
                    <div className="space-y-3">
                      {/* Obra de Pintura */}
                      <div className="bg-slate-850 border border-slate-800 p-3.5 rounded-xl space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[8px] bg-indigo-950 text-indigo-400 border border-indigo-900/30 px-2 py-0.5 rounded font-extrabold uppercase">Adjudicada</span>
                            <h4 className="font-extrabold text-white mt-1 text-[11px]">Pintura e Tratamento de Escadas</h4>
                          </div>
                          <span className="font-bold text-indigo-400 font-mono">18,500.00 €</span>
                        </div>
                        <p className="text-slate-450 leading-relaxed text-[9.5px]">Previsão de arranque em Agosto 2026. Orçamentos aprovados na Assembleia Geral de Maio de 2026.</p>
                        <div className="pt-2 border-t border-slate-800 flex justify-between text-[8px] text-slate-400 font-bold">
                          <span>Fiscalização: IA Técnico</span>
                          <button 
                            onClick={() => generateAndDownloadPdf(
                              "Caderno de Encargos e Orçamentos - Pintura de Escadas",
                              [{ heading: "Memória Descritiva & Propostas Adjudicadas", content: "Documentação oficial de concursos de empreitada, cadernos de encargos de lavagem e tinta impermeável, e orçamentos apresentados pelas empresas qualificadas." }],
                              "Orcamentos_Memoria_Descritiva_Pintura.pdf",
                              [{ label: "Edifício", value: predio.nome }, { label: "Valor Adjudicado", value: "18,500.00 €" }]
                            )}
                            className="text-emerald-400 hover:underline cursor-pointer"
                          >
                            Ver Documentos (3)
                          </button>
                        </div>
                      </div>

                      {/* Obra de Cobertura */}
                      <div className="bg-slate-850 border border-slate-800 p-3.5 rounded-xl space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[8px] bg-emerald-950 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded font-extrabold uppercase font-mono">Concluída</span>
                            <h4 className="font-extrabold text-white mt-1 text-[11px]">Impermeabilização do Telhado / Cobertura</h4>
                          </div>
                          <span className="font-bold text-slate-500 font-mono">9,820.00 €</span>
                        </div>
                        <p className="text-slate-450 leading-relaxed text-[9.5px]">Concluída em Fevereiro de 2026. Garantia total da obra ativa até Fevereiro de 2031.</p>
                        <div className="pt-2 border-t border-slate-800 flex justify-between text-[8px] text-slate-400 font-bold">
                          <span>Garantia: 5 Anos</span>
                          <button 
                            onClick={() => generateAndDownloadPdf(
                              "Auto de Receção Final e Vistoria de Estanquicidade",
                              [{ heading: "Relatório de Receção de Obra", content: "Atestado técnico de conformidade dos trabalhos de impermeabilização da cobertura, testes de estanquicidade e apólice de garantia de 5 anos fornecida pela empreiteira." }],
                              "Auto_Rececao_Final_Telhado.pdf",
                              [{ label: "Edifício", value: predio.nome }, { label: "Garantia", value: "Até Fev/2031" }]
                            )}
                            className="text-emerald-400 hover:underline cursor-pointer"
                          >
                            Ver Relatório Final
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activePwaModal === "plano_plurianual" && (
                  <div className="space-y-3.5 text-[10px]">
                    <p className="text-slate-300">Calendário de Investimentos & Plano Plurianual (2026-2030) aprovado em assembleia geral:</p>
                    
                    <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                      {[
                        { ano: "2026", obra: "Pintura Geral de Fachadas", custo: "18,500.00 €", status: "Adjudicado", prioridade: "Alta" },
                        { ano: "2027", obra: "Instalação de Painéis Fotovoltaicos Comuns", custo: "12,000.00 €", status: "Planeado", prioridade: "Média" },
                        { ano: "2028", obra: "Substituição de Cabos dos Elevadores", custo: "6,500.00 €", status: "Planeado", prioridade: "Alta" },
                        { ano: "2029", obra: "Modernização das Garagens e Postos de Carregamento", custo: "14,500.00 €", status: "Planeado", prioridade: "Baixa" },
                        { ano: "2030", obra: "Reparação e Isolamento Térmico de Varandas", custo: "9,000.00 €", status: "Estudo", prioridade: "Média" }
                      ].map((item, idx) => (
                        <div key={idx} className="bg-slate-850 border border-slate-800 p-3 rounded-xl space-y-1.5">
                          <div className="flex justify-between font-mono">
                            <span className="text-emerald-400 font-black text-[11px]">Ano {item.ano}</span>
                            <span className="text-slate-400">{item.custo}</span>
                          </div>
                          <h4 className="font-extrabold text-white text-[10.5px]">{item.obra}</h4>
                          <div className="flex justify-between items-center text-[8px] pt-1 border-t border-slate-800/60 text-slate-400">
                            <span>Estado: <strong className="text-slate-200">{item.status}</strong></span>
                            <span>Prioridade: <strong className={item.prioridade === "Alta" ? "text-rose-450" : item.prioridade === "Média" ? "text-amber-400" : "text-emerald-400"}>{item.prioridade}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

      {/* PWA NATIVE BOTTOM NAVIGATION BAR (Specially customized for 5 key views with CondoManager AI colors) */}
      <div className="h-14 shrink-0 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800/80 px-2 flex items-center justify-around text-[9px] font-bold text-slate-500 dark:text-white z-10">
        
        {/* 1. Início (Verde condomanagerai) */}
        <button 
          id="pwa-bottom-nav-home"
          onClick={() => setActiveTab("home")} 
          className={`flex flex-col items-center space-y-0.5 cursor-pointer flex-1 py-1 transition-all ${
            activeTab === "home" ? "text-emerald-500 font-extrabold scale-105" : "text-emerald-600 hover:text-emerald-400"
          }`}
        >
          <Smartphone className="h-4.5 w-4.5 text-emerald-500" />
          <span className="text-emerald-500 font-extrabold text-[8.5px]">Início</span>
        </button>

        {/* 2. Módulos Hub (10-icone-negativo.png) */}
        <button 
          id="pwa-bottom-nav-hub"
          onClick={() => setActiveTab("modules_hub")} 
          className={`flex flex-col items-center space-y-0.5 cursor-pointer flex-1 py-1 transition-all ${
            activeTab === "modules_hub" ? "scale-105 text-emerald-500 font-extrabold" : "text-slate-500 dark:text-white hover:text-emerald-500"
          }`}
        >
          <img src="/marca/10-icone-negativo.png" alt="Módulos" className="h-5 w-5 object-contain" />
          <span className="text-[8.5px] font-extrabold text-slate-700 dark:text-slate-300">Módulos</span>
        </button>

        {/* 3. Avarias (Símbolo a vermelho - 29-avaria.png) */}
        <button 
          id="pwa-bottom-nav-interventions"
          onClick={() => setActiveTab("intervencoes")} 
          className={`flex flex-col items-center space-y-0.5 cursor-pointer flex-1 py-1 transition-all ${
            activeTab === "intervencoes" 
              ? "text-red-500 font-extrabold scale-105" 
              : "text-slate-500 dark:text-white hover:text-red-500"
          }`}
        >
          <img src="/modulos/29-avaria.png" alt="" className="h-4.5 w-4.5 object-contain" />
          <span className="text-[8.5px] text-red-500 font-black">Avarias</span>
        </button>

        {/* 4. Obras (Símbolo a laranja - 41-obra.png) */}
        <button 
          id="pwa-bottom-nav-obras"
          onClick={() => setActiveTab("obras")} 
          className={`flex flex-col items-center space-y-0.5 cursor-pointer flex-1 py-1 transition-all ${
            activeTab === "obras" 
              ? "text-orange-500 font-extrabold scale-105" 
              : "text-slate-500 dark:text-white hover:text-orange-500"
          }`}
        >
          <img src="/modulos/41-obra.png" alt="" className="h-4.5 w-4.5 object-contain" />
          <span className="text-[8.5px] text-orange-500 font-black">Obras</span>
        </button>

        {/* 5. Perfil */}
        <button 
          id="pwa-bottom-nav-profile"
          onClick={() => setActiveTab("perfil")} 
          className={`flex flex-col items-center space-y-0.5 cursor-pointer flex-1 py-1 transition-all ${
            activeTab === "perfil" ? "text-emerald-500 font-extrabold scale-105" : "text-slate-500 dark:text-white hover:text-emerald-500"
          }`}
        >
          <User className="h-4.5 w-4.5" />
          <span className="text-[8.5px]">Perfil</span>
        </button>

      </div>

      {/* LOCAL BIOMETRIC SCANNING OVERLAY */}
      {simulatingScan && (
        <div className="fixed inset-0 bg-slate-950/90 z-[110] flex flex-col items-center justify-center p-6 text-white text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6 max-w-xs w-full"
          >
            <div className="relative flex items-center justify-center h-24 w-24 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-slate-800 animate-ping"></div>
              <div className="absolute inset-2 rounded-full border-2 border-emerald-500/30"></div>
              <Fingerprint className="h-12 w-12 text-emerald-400 animate-pulse" />
            </div>
            
            <div className="space-y-1">
              <h4 className="font-extrabold text-sm uppercase tracking-wider text-emerald-400">A Registar Biometria</h4>
              <p className="text-[10px] text-slate-400 leading-normal">
                A efetuar varredura segura de sensor Face ID ou Touch ID...
              </p>
            </div>
            
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full transition-all duration-200" style={{ width: `${simulatingScanProgress}%` }}></div>
            </div>
            <span className="text-[9px] font-mono text-emerald-400 font-bold">{simulatingScanProgress}%</span>
          </motion.div>
        </div>
      )}

      {/* TOUCH CANVAS SIGNATURE MODAL FOR PWA ATAS */}
      {signingAtaTarget && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setSigningAtaTarget(null);
          }}
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[105] flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 max-w-sm w-full space-y-3.5 text-white shadow-2xl animate-fade-in"
          >
            <div className="flex justify-between items-start border-b border-slate-800 pb-2.5">
              <div>
                <span className="text-[8px] font-mono font-bold text-emerald-400 uppercase tracking-widest block">Recolha de Assinatura Tátil PWA</span>
                <h3 className="font-extrabold text-xs text-white leading-tight">{signingAtaTarget.nome || "Ata de Assembleia"}</h3>
              </div>
              <button 
                type="button"
                onClick={() => setSigningAtaTarget(null)}
                className="flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
                title="Sair / Fechar"
                aria-label="Sair / Fechar"
              >
                <X className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Sair</span>
              </button>
            </div>

            <p className="text-[9.5px] text-slate-300 leading-normal">
              Utilize o dedo ou caneta stylus para desenhar a sua assinatura no quadro abaixo. A assinatura será autenticada e vinculada à fração <strong>{condominoFracao?.fracao_nome || "3º Esq."}</strong>.
            </p>

            {/* Interactive Touch Canvas */}
            <div className="border-2 border-dashed border-emerald-500/40 rounded-xl bg-slate-950 p-2 relative overflow-hidden">
              <span className="absolute top-1.5 left-2.5 text-[8px] font-mono text-emerald-400/60 uppercase tracking-wider select-none pointer-events-none">
                ✍️ Quadro Tátil • Desenhe a sua assinatura
              </span>
              <canvas
                ref={pwaCanvasRef}
                width={320}
                height={150}
                className="w-full h-[150px] bg-slate-950 block cursor-crosshair touch-none rounded-lg"
                onMouseDown={startDrawingPwa}
                onMouseMove={drawPwa}
                onMouseUp={stopDrawingPwa}
                onMouseLeave={stopDrawingPwa}
                onTouchStart={startDrawingPwa}
                onTouchMove={drawPwa}
                onTouchEnd={stopDrawingPwa}
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={clearPwaCanvas}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-[10px] cursor-pointer"
              >
                Limpar Quadro
              </button>
              <button
                type="button"
                onClick={confirmPwaSignature}
                className="flex-1 py-2.5 border-2 border-emerald-500 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-md active:ring-2 active:ring-emerald-400 select-none flex items-center justify-center gap-2"
              >
                <img src="/estados-acoes/12-adicionar.png" alt="Gravar" className="h-4 w-4 object-contain" />
                <span>Gravar</span>
              </button>
            </div>
          </div>
        </div>
      )}



      {/* SWIPE HOME INDICATOR BOTTOM BAR */}
      <div className="h-4 shrink-0 bg-slate-100 dark:bg-slate-900 flex items-center justify-center pb-1">
        <span className="w-24 h-1 bg-slate-300 dark:bg-slate-800 rounded-full"></span>
      </div>

    </div>
  );
}
