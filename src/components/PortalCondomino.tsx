import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { 
  X, 
  Send, 
  Paperclip, 
  Smile, 
  Mic, 
  Volume2, 
  Play, 
  Pause, 
  FileText, 
  Camera, 
  Image as ImageIcon, 
  Check, 
  CheckCheck, 
  Shield, 
  FileCheck,
  FileSpreadsheet,
  AlertTriangle,
  Cake,
  Mail,
  Upload
} from "lucide-react";
import { Predio, Fracao, LoggedUser, Aviso, Conta, Movimento } from "../types";
import { UserSecuritySubmenu } from "./UserSecuritySubmenu";
import { generateCondominoPwaManualPDF } from "../utils";
import { triggerSendReaction } from "./SendingReactionModal";
import { playVoiceNoteSimulation } from "../lib/soundService";

// Inner Interfaces
export interface MensagemAdministracao {
  id: string;
  id_fracao: string;
  nome_remetente: string;
  assunto: string;
  mensagem: string;
  data: string;
  anexoWebP: string | null;
  audioUrl?: string | null;
  audioDuration?: number;
  estado: "Pendente" | "Respondida";
  respostaAdmin?: string;
  dataResposta?: string;
}

export interface ComprovativoSubmetido {
  id: string;
  id_fracao: string;
  id_aviso: string;
  nome_fracao: string;
  valorOriginal: number;
  dataOriginal: string;
  ibanOriginal: string;
  referenciaOriginal: string;
  descricaoOriginal: string;
  anexoWebP: string;
  // Extracted values
  valorExtraido: number;
  dataExtraida: string;
  ibanExtraido: string;
  referenciaExtraida: string;
  identificadoPor: "Referência" | "IBAN (Regra Automática)" | "Manual";
  // User corrections
  descricaoCorrigida: string;
  estado: "Pendente" | "Confirmado" | "Rejeitado";
  dataSubmissao: string;
  reciboGerado?: string;
}

interface PortalCondominoProps {
  predio: Predio;
  fracoes: Fracao[];
  onUpdateFracoes: (updated: Fracao[]) => void;
  avisos: Aviso[];
  setAvisos: React.Dispatch<React.SetStateAction<Aviso[]>>;
  movements: Movimento[];
  setMovements: React.Dispatch<React.SetStateAction<Movimento[]>>;
  contas: Conta[];
  loggedUser: LoggedUser;
  setLoggedUser: (user: LoggedUser) => void;
}

export function PortalCondomino({
  predio,
  fracoes,
  onUpdateFracoes,
  avisos,
  setAvisos,
  movements,
  setMovements,
  contas,
  loggedUser,
  setLoggedUser,
}: PortalCondominoProps) {
  // Navigation inside Portal
  const [activeTab, setActiveTab] = useState<"portal" | "backoffice">("portal");
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(true);

  // Local State representing PWA messages, payment proofs, and credentials
  const [mensagens, setMensagens] = useState<MensagemAdministracao[]>([
    {
      id: "msg-1",
      id_fracao: "frac-1",
      nome_remetente: "Ana Silva (Fração A)",
      assunto: "Avaria no Elevador Principal",
      mensagem: "Olá, o elevador principal está a fazer um ruído estranho desde ontem à noite. Podem verificar por favor?",
      data: "14-07-2026 18:30",
      anexoWebP: null,
      estado: "Respondida",
      respostaAdmin: "Obrigado pelo aviso, Ana. Já agendámos uma vistoria de urgência com a OTIS para amanhã de manhã.",
      dataResposta: "14-07-2026 19:15",
    },
  ]);

  const [comprovativos, setComprovativos] = useState<ComprovativoSubmetido[]>([
    {
      id: "comp-1",
      id_fracao: "frac-1",
      nome_fracao: "A",
      id_aviso: "aviso-1",
      valorOriginal: 120,
      dataOriginal: "12-07-2026",
      ibanOriginal: "PT50 0035 0999 8888 7777 6666 5",
      referenciaOriginal: "",
      descricaoOriginal: "Fatura Quota Julho",
      anexoWebP: "data:image/webp;base64,UklGRiQAAABXRUJQVlA4TBAAAAAvAAAAAFAIAnQ=",
      valorExtraido: 120,
      dataExtraida: "12-07-2026",
      ibanExtraido: "PT50 0035 0999 8888 7777 6666 5",
      referenciaExtraida: "",
      identificadoPor: "IBAN (Regra Automática)",
      descricaoCorrigida: "Quota de Julho Fração A - Confirmada",
      estado: "Pendente",
      dataSubmissao: "12-07-2026 10:25",
    },
  ]);

  // Credentials and Security State
  const [tempPassMap, setTempPassMap] = useState<{ [fracaoId: string]: string }>({
    "frac-1": "Cnd-X3y9B",
    "frac-2": "Cnd-W1z7A",
  });
  const [pwaSentMsg, setPwaSentMsg] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryStatus, setRecoveryStatus] = useState("");
  const [biometricsActive, setBiometricsActive] = useState(false);
  const [biometricModalOpen, setBiometricModalOpen] = useState(false);
  const [biometricProgress, setBiometricProgress] = useState(0);
  const [biometricSuccess, setBiometricSuccess] = useState(false);

  // Profile Edit State
  const [editedNome, setEditedNome] = useState("");
  const [editedEmail, setEditedEmail] = useState("");
  const [editedTlm, setEditedTlm] = useState("");
  const [editedNif, setEditedNif] = useState("");
  const [editedIban, setEditedIban] = useState("");
  const [editedTitular, setEditedTitular] = useState("");
  const [editedBanco, setEditedBanco] = useState("");
  const [editedBirthday, setEditedBirthday] = useState("1989-10-15");
  const [profileSuccessMsg, setProfileSuccessMsg] = useState("");

  // Add Message Modal/State & WhatsApp Chat Engine
  const [msgDrawerOpen, setMsgDrawerOpen] = useState(false);
  const [newMsgAssunto, setNewMsgAssunto] = useState("");
  const [newMsgTexto, setNewMsgTexto] = useState("");
  const [newMsgAnexo, setNewMsgAnexo] = useState<string | null>(null);
  const [anexoSizeOriginal, setAnexoSizeOriginal] = useState<string>("");
  const [anexoSizeWebP, setAnexoSizeWebP] = useState<string>("");
  const [msgSending, setMsgSending] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [msgDocAttachment, setMsgDocAttachment] = useState<{ name: string; size: string } | null>(null);

  // Add Payment Modal/State
  const [payAvisoId, setPayAvisoId] = useState<string>("");
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [paymentFile, setPaymentFile] = useState<string | null>(null);
  const [paymentOriginalSize, setPaymentOriginalSize] = useState<string>("");
  const [paymentWebPSize, setPaymentWebPSize] = useState<string>("");
  const [extractionLoading, setExtractionLoading] = useState(false);
  const [extractedValue, setExtractedValue] = useState<number>(0);
  const [extractedDate, setExtractedDate] = useState<string>("");
  const [extractedIban, setExtractedIban] = useState<string>("");
  const [extractedRef, setExtractedRef] = useState<string>("");
  const [extractedIdType, setExtractedIdType] = useState<"Referência" | "IBAN (Regra Automática)" | "Manual">("Manual");
  const [payerFractionName, setPayerFractionName] = useState<string>("");
  const [payerFractionId, setPayerFractionId] = useState<string>("");
  const [userDescCorrection, setUserDescCorrection] = useState("");

  // Backoffice Responses
  const [adminReplyTexts, setAdminReplyTexts] = useState<{ [msgId: string]: string }>({});

  // Birthday modal
  const [birthdayModalOpen, setBirthdayModalOpen] = useState(false);
  const [welcomeMailModal, setWelcomeMailModal] = useState<{ fracao: Fracao; pass: string } | null>(null);

  // Refs
  const profileFileRef = useRef<HTMLInputElement>(null);
  const msgFileRef = useRef<HTMLInputElement>(null);
  const msgDocInputRef = useRef<HTMLInputElement>(null);
  const msgCameraInputRef = useRef<HTMLInputElement>(null);
  const payFileRef = useRef<HTMLInputElement>(null);

  // Sync edited fields with loggedUser
  useEffect(() => {
    // Find active fraction matching the user
    const userFracao = fracoes.find((f) => f.proprietario.email === loggedUser.email);
    if (userFracao) {
      setEditedNome(userFracao.proprietario.nome);
      setEditedEmail(userFracao.proprietario.email);
      setEditedTlm(userFracao.proprietario.tlm);
      setEditedNif(userFracao.proprietario.nif);
      setEditedIban(userFracao.proprietario.iban || "");
      setEditedTitular(userFracao.proprietario.titular_conta || "");
      setEditedBanco(userFracao.proprietario.entidade_bancaria || "");
    } else {
      setEditedNome(loggedUser.nome);
      setEditedEmail(loggedUser.email);
    }
  }, [loggedUser, fracoes]);

  // Set default active tab to portal view
  useEffect(() => {
    setActiveTab("portal");
  }, []);

  // Convert base64 and compress to WebP helper
  const convertToWebP = (
    file: File,
    callback: (base64Webp: string, originalSizeKb: string, webpSizeKb: string) => void
  ) => {
    const originalSize = (file.size / 1024).toFixed(1) + " KB";
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const maxDim = 800; // Resize for speed/efficiency
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        ctx?.drawImage(img, 0, 0, w, h);
        const webpData = canvas.toDataURL("image/webp", 0.7);
        // Estimate WebP size from base64 string
        const webpSize = Math.round((webpData.length * 3) / 4 / 1024).toFixed(1) + " KB";
        callback(webpData, originalSize, webpSize);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Profile WebP Update
  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    convertToWebP(file, (webpUrl) => {
      // Update local state and current fraction photo
      const updatedFracoes = fracoes.map((f) => {
        if (f.proprietario.email === loggedUser.email) {
          return {
            ...f,
            proprietario: { ...f.proprietario, foto: webpUrl },
          };
        }
        return f;
      });
      onUpdateFracoes(updatedFracoes);
      setProfileSuccessMsg("Foto de perfil atualizada e otimizada em WebP!");
      setTimeout(() => setProfileSuccessMsg(""), 4000);
    });
  };

  // Submit Profile Changes (except address)
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedNome || !editedEmail || !editedNif) {
      alert("Por favor, preencha os campos obrigatórios (Nome, E-mail, NIF).");
      return;
    }

    const updated = fracoes.map((f) => {
      if (f.proprietario.email === loggedUser.email) {
        return {
          ...f,
          proprietario: {
            ...f.proprietario,
            nome: editedNome,
            email: editedEmail,
            tlm: editedTlm,
            nif: editedNif,
            iban: editedIban,
            titular_conta: editedTitular,
            entidade_bancaria: editedBanco,
          },
        };
      }
      return f;
    });

    onUpdateFracoes(updated);
    setLoggedUser({
      ...loggedUser,
      nome: editedNome,
      email: editedEmail,
    });

    setProfileSuccessMsg("Dados pessoais guardados com sucesso! A morada mantém-se inalterada.");
    setTimeout(() => setProfileSuccessMsg(""), 4000);
  };

  // Password temporary trigger
  const triggerTempPassword = (fracaoId: string) => {
    const randomPass = "Cnd-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    setTempPassMap((prev) => ({ ...prev, [fracaoId]: randomPass }));
    alert(`Uma nova password provisória foi gerada automaticamente: ${randomPass}`);
  };

  // Welcome Email Dialog
  const triggerWelcomeEmail = (fracao: Fracao) => {
    const pass = tempPassMap[fracao.id_fracao] || "Cnd-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    if (!tempPassMap[fracao.id_fracao]) {
      setTempPassMap((prev) => ({ ...prev, [fracao.id_fracao]: pass }));
    }
    setWelcomeMailModal({ fracao, pass });
  };

  // Password Recovery Simulator
  const handlePasswordRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail) return;
    const cleanEmail = recoveryEmail.trim().toLowerCase();
    const targetFracao = fracoes.find((f) => f.proprietario.email.toLowerCase() === cleanEmail);

    if (!targetFracao) {
      setRecoveryStatus("E-mail não encontrado no sistema deste condomínio.");
      return;
    }

    const newTemp = "Cnd-R" + Math.random().toString(36).substring(2, 7).toUpperCase();
    setTempPassMap((prev) => ({ ...prev, [targetFracao.id_fracao]: newTemp }));
    setRecoveryStatus(
      `Sucesso! E-mail de Recuperação de Acesso – Condomínio enviado para ${cleanEmail} contendo o link seguro para definir a sua nova password.`
    );
    setRecoveryEmail("");
    setTimeout(() => setRecoveryStatus(""), 8000);
  };

  // Biometric authentication flow
  const handleToggleBiometrics = () => {
    if (!biometricsActive) {
      // Activating
      setBiometricProgress(0);
      setBiometricSuccess(false);
      setBiometricModalOpen(true);
      const interval = setInterval(() => {
        setBiometricProgress((p) => {
          if (p >= 100) {
            clearInterval(interval);
            setBiometricSuccess(true);
            setTimeout(() => {
              setBiometricModalOpen(false);
              setBiometricsActive(true);
            }, 1500);
            return 100;
          }
          return p + 10;
        });
      }, 150);
    } else {
      setBiometricsActive(false);
      alert("Acesso biométrico desativado.");
    }
  };

  // Simulate Biometric login
  const simulateBiometricLogin = () => {
    setBiometricProgress(0);
    setBiometricSuccess(false);
    setBiometricModalOpen(true);
    const interval = setInterval(() => {
      setBiometricProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setBiometricSuccess(true);
          setTimeout(() => {
            setBiometricModalOpen(false);
            alert(`Sessão iniciada com sucesso via biometria! Bem-vindo, ${loggedUser.nome}.`);
          }, 1500);
          return 100;
        }
        return p + 20;
      });
    }, 100);
  };

  // Send PWA Link Simulator
  const handleSendPwaLink = () => {
    setPwaSentMsg(true);
    setTimeout(() => setPwaSentMsg(false), 5000);
  };

  // Birthday simulation
  const simulateBirthdayEmail = () => {
    setBirthdayModalOpen(true);
  };

  // Timer effect for voice recording
  useEffect(() => {
    let interval: any;
    if (isRecordingAudio) {
      interval = setInterval(() => {
        setRecordingTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingTimer(0);
    }
    return () => clearInterval(interval);
  }, [isRecordingAudio]);

  const handleToggleVoiceRecording = () => {
    if (isRecordingAudio) {
      // Stop recording and save audio note
      setIsRecordingAudio(false);
      const fakeAudio = "data:audio/mp3;base64,voice_note_" + Date.now();
      setRecordedAudioUrl(fakeAudio);
    } else {
      setRecordedAudioUrl(null);
      setIsRecordingAudio(true);
      setRecordingTimer(0);
    }
  };

  const handleCancelVoiceRecording = () => {
    setIsRecordingAudio(false);
    setRecordingTimer(0);
    setRecordedAudioUrl(null);
  };

  const handlePlayVoiceAudio = (msgId: string) => {
    if (playingAudioId === msgId) {
      setPlayingAudioId(null);
    } else {
      setPlayingAudioId(msgId);
      playVoiceNoteSimulation(4, () => setPlayingAudioId(null));
    }
  };

  const handleDocumentAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeStr = (file.size / 1024).toFixed(1) + " KB";
    setMsgDocAttachment({ name: file.name, size: sizeStr });
    if (!newMsgTexto) {
      setNewMsgTexto(`📎 [Documento: ${file.name}]`);
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    convertToWebP(file, (webpUrl, origSize, webpSize) => {
      setNewMsgAnexo(webpUrl);
      setAnexoSizeOriginal(origSize);
      setAnexoSizeWebP(webpSize);
      if (!newMsgTexto) {
        setNewMsgTexto(`📸 [Fotografia da Câmara: ${file.name}]`);
      }
    });
  };

  // Contact Drawer / WhatsApp Chat submit
  const handleSendMsgToAdmin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMsgTexto && !newMsgAnexo && !recordedAudioUrl && !msgDocAttachment) {
      alert("Por favor, escreva uma mensagem, anexe uma fotografia/documento ou grave uma mensagem de voz.");
      return;
    }
    
    triggerSendReaction("mensagem", "A Enviar Mensagem à Administração...", () => {
      const userFracao = fracoes.find((f) => f.proprietario.email === loggedUser.email);
      const isVoice = !!recordedAudioUrl;
      const docLabel = msgDocAttachment ? ` 📄 (${msgDocAttachment.name})` : "";
      const novaMsg: MensagemAdministracao = {
        id: "msg-" + Date.now(),
        id_fracao: userFracao?.id_fracao || "frac-1",
        nome_remetente: `${loggedUser.nome} (Fração ${userFracao?.fracao_nome || "A"})`,
        assunto: newMsgAssunto || (isVoice ? "Mensagem de Voz" : "Mensagem Direta" + docLabel),
        mensagem: newMsgTexto || (isVoice ? `🎙️ Nota de voz (${recordingTimer || 4}s)` : msgDocAttachment ? `📎 Documento anexo: ${msgDocAttachment.name}` : "Fotografia anexada"),
        data: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
        anexoWebP: newMsgAnexo,
        audioUrl: recordedAudioUrl,
        audioDuration: recordingTimer || 4,
        estado: "Pendente",
      };

      setMensagens((prev) => [...prev, novaMsg]);
      setNewMsgAssunto("");
      setNewMsgTexto("");
      setNewMsgAnexo(null);
      setMsgDocAttachment(null);
      setRecordedAudioUrl(null);
      setIsRecordingAudio(false);
      setRecordingTimer(0);
      setIsEmojiPickerOpen(false);
      setIsAttachmentMenuOpen(false);
      setAnexoSizeOriginal("");
      setAnexoSizeWebP("");
    });
  };

  // Attachment upload for message (WebP converted)
  const handleMessageAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    convertToWebP(file, (webpUrl, origSize, webpSize) => {
      setNewMsgAnexo(webpUrl);
      setAnexoSizeOriginal(origSize);
      setAnexoSizeWebP(webpSize);
    });
  };

  // Quota payment proof upload & AI extraction
  const initiatePaymentProof = (aviso: Aviso) => {
    setPayAvisoId(aviso.id_aviso);
    setPaymentFile(null);
    setPaymentOriginalSize("");
    setPaymentWebPSize("");
    setExtractedValue(0);
    setExtractedDate("");
    setExtractedIban("");
    setExtractedRef("");
    setUserDescCorrection("");
    setPayModalOpen(true);
  };

  const handlePaymentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    convertToWebP(file, (webpUrl, origSize, webpSize) => {
      setPaymentFile(webpUrl);
      setPaymentOriginalSize(origSize);
      setPaymentWebPSize(webpSize);
      runAIExtraction(webpUrl);
    });
  };

  // AI Extraction Simulator
  const runAIExtraction = (webpBase64: string) => {
    setExtractionLoading(true);

    setTimeout(() => {
      // Find current user's fraction to test IBAN matching rule
      const userFracao = fracoes.find((f) => f.proprietario.email === loggedUser.email) || fracoes[0];
      const targetAviso = avisos.find((a) => a.id_aviso === payAvisoId);

      // Simulate extraction
      const mockValue = targetAviso?.valor || 120.0;
      const mockDate = new Date().toLocaleDateString("pt-PT").replace(/\//g, "-");
      // Use user's real IBAN to trigger "regra: se não houver referência -> identificar pelo IBAN"
      const mockIban = userFracao.proprietario.iban || "PT50 0035 0999 8888 7777 6666 5";
      const mockRef = ""; // intentionally blank to test the rule!

      setExtractedValue(mockValue);
      setExtractedDate(mockDate);
      setExtractedIban(mockIban);
      setExtractedRef(mockRef);

      // Rule Check: No reference -> identify by IBAN
      if (!mockRef) {
        const matchingFracao = fracoes.find(
          (f) =>
            f.proprietario.iban?.replace(/\s/g, "") === mockIban.replace(/\s/g, "") ||
            f.inquilino?.nif === userFracao.inquilino?.nif
        );
        if (matchingFracao) {
          setExtractedIdType("IBAN (Regra Automática)");
          setPayerFractionName(matchingFracao.fracao_nome);
          setPayerFractionId(matchingFracao.id_fracao);
        } else {
          setExtractedIdType("Manual");
        }
      } else {
        setExtractedIdType("Referência");
      }

      setUserDescCorrection(`Pagamento da Quota Ref ${targetAviso?.descricao || "Julho"}`);
      setExtractionLoading(false);
    }, 2000);
  };

  // Submit payment proof
  const handleSendPaymentProof = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentFile || !extractedValue) {
      alert("Por favor, envie o ficheiro de comprovativo e aguarde a extração por IA.");
      return;
    }

    const userFracao = fracoes.find((f) => f.proprietario.email === loggedUser.email) || fracoes[0];
    const novoComp: ComprovativoSubmetido = {
      id: "comp-" + (comprovativos.length + 1),
      id_fracao: payerFractionId || userFracao.id_fracao,
      nome_fracao: payerFractionName || userFracao.fracao_nome,
      id_aviso: payAvisoId,
      valorOriginal: extractedValue,
      dataOriginal: extractedDate,
      ibanOriginal: extractedIban,
      referenciaOriginal: extractedRef,
      descricaoOriginal: `Envio do comprovativo da fração ${userFracao.fracao_nome}`,
      anexoWebP: paymentFile,
      valorExtraido: extractedValue,
      dataExtraida: extractedDate,
      ibanExtraido: extractedIban,
      referenciaExtraida: extractedRef,
      identificadoPor: extractedIdType,
      descricaoCorrigida: userDescCorrection,
      estado: "Pendente",
      dataSubmissao: new Date().toLocaleString("pt-PT"),
    };

    setComprovativos((prev) => [novoComp, ...prev]);
    setPayModalOpen(false);
    alert(
      "Comprovativo submetido com sucesso! O Administrador irá agora validar e conciliar."
    );
  };

  // Backoffice admin actions
  const handleConfirmPayment = (comp: ComprovativoSubmetido) => {
    // 1. Mark Aviso as Pago
    const updatedAvisos = avisos.map((a) => {
      if (a.id_aviso === comp.id_aviso) {
        return { ...a, estado: "Pago" };
      }
      return a;
    });
    setAvisos(updatedAvisos);

    // 2. Add New Movimento (Receita)
    const principalConta = contas.find((c) => c.is_principal && c.id_predio === predio.id_predio) || contas[0];
    const numRecibo = `REC-2026-${Math.floor(Math.random() * 900) + 100}`;
    const novoMov: Movimento = {
      id_mov: "mov-" + (movements.length + 1),
      id_predio: predio.id_predio,
      id_conta: principalConta?.id_conta || "cta-1",
      data: new Date().toLocaleDateString("pt-PT").replace(/\//g, "-"),
      tipo: "Receita",
      valor: comp.valorExtraido,
      descricao: `Liquidação Quota - Fração ${comp.nome_fracao} (${numRecibo})`,
      categoria: "Quotas de Condomínio",
      estado: "Conciliado",
    };
    setMovements((prev) => [...prev, novoMov]);

    // 3. Update Comprovativo state
    setComprovativos((prev) =>
      prev.map((c) => (c.id === comp.id ? { ...c, estado: "Confirmado", reciboGerado: numRecibo } : c))
    );

    alert(
      `Pagamento Confirmado! O recibo oficial ${numRecibo} foi gerado automaticamente para a Fração ${comp.nome_fracao}.`
    );
  };

  const handleRejectPayment = (compId: string) => {
    setComprovativos((prev) =>
      prev.map((c) => (c.id === compId ? { ...c, estado: "Rejeitado" } : c))
    );
    alert("O comprovativo foi rejeitado. O condómino será alertado na PWA.");
  };

  // Admin reply to messages
  const handleSendAdminReply = (msgId: string) => {
    const replyText = adminReplyTexts[msgId];
    if (!replyText) return;

    setMensagens((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              estado: "Respondida",
              respostaAdmin: replyText,
              dataResposta: new Date().toLocaleString("pt-PT"),
            }
          : m
      )
    );

    setAdminReplyTexts((prev) => ({ ...prev, [msgId]: "" }));
    alert("Resposta enviada com sucesso para o condómino!");
  };

  // Billing schedule simulation: Day 25
  const simulateDay25Billing = () => {
    const dataEmissao = "25-07-2026";
    const dataVencimento = "05-08-2026";
    const novasQuotas: Aviso[] = fracoes
      .filter((f) => f.id_predio === predio.id_predio)
      .map((f, index) => {
        const valorQuota = Math.round(f.permilagem * 0.4); // Proportional quota based on permilage
        return {
          id_aviso: `aviso-auto-${Date.now()}-${index}`,
          id_predio: predio.id_predio,
          id_fracao: f.id_fracao,
          tipo: "Quota de Condomínio",
          data: dataEmissao,
          vencimento: dataVencimento,
          descricao: `Quota Ordinária de Agosto de 2026 (Fração ${f.fracao_nome})`,
          valor: valorQuota,
          estado: "Pendente",
        };
      });

    setAvisos((prev) => [...prev, ...novasQuotas]);
    alert(
      `Faturação Automática do Dia 25 Concluída!\nForam geradas ${novasQuotas.length} novas notas de cobrança para todas as frações relativas ao mês seguinte (Agosto).`
    );
  };

  // Unpaid Quota reminders simulator: Day 5, 10, 15
  const simulateRemindersTrigger = () => {
    const quotasAtraso = avisos.filter(
      (a) => a.id_predio === predio.id_predio && a.estado === "Pendente"
    );
    quotasAtraso.forEach((a) => {
      const fracao = fracoes.find((f) => f.id_fracao === a.id_fracao);
      if (fracao) {
        console.log(
          `[Notificação Remetente Automático] Alerta de atraso enviado para ${fracao.proprietario.nome} (${fracao.proprietario.email}) - Aviso: ${a.descricao}, Valor: ${a.valor}€.`
        );
      }
    });

    alert(
      `Roteamento de Lembretes dos Dias 5, 10, 15 Ativado!\nForam disparados ${quotasAtraso.length} alertas automáticos por E-mail e Push PWA para todos os condóminos com quotas em atraso.`
    );
  };

  // Active User Fraction
  const activeUserFracao = fracoes.find((f) => f.proprietario.email === loggedUser.email);
  const activeUserAvisos = avisos.filter(
    (a) => a.id_fracao === activeUserFracao?.id_fracao && a.id_predio === predio.id_predio
  );

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-4">
        <div className="flex space-x-2">
          {loggedUser.role === "ADMIN" ? (
            <button
              onClick={() => setActiveTab("backoffice")}
              className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${
                activeTab === "backoffice"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              <i className="fa-solid fa-laptop-code mr-1.5"></i> Backoffice de Controlo
            </button>
          ) : (
            <button
              onClick={() => setActiveTab("portal")}
              className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${
                activeTab === "portal"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              <i className="fa-solid fa-home mr-1.5"></i> Portal do Condómino (PWA)
            </button>
          )}

          {/* Tester toggle so they can inspect both sides easily */}
          <button
            onClick={() => setActiveTab(activeTab === "portal" ? "backoffice" : "portal")}
            className="px-3 py-2 text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Alternar vista apenas para simulação do motor"
          >
            <i className="fa-solid fa-arrows-rotate mr-1"></i> Simular Outra Vista ({activeTab === "portal" ? "Backoffice" : "Portal"})
          </button>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleSendPwaLink}
            className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold px-3 py-1.5 rounded-lg text-xs hover:bg-emerald-100 transition-all cursor-pointer"
          >
            <i className="fa-solid fa-share-nodes mr-1.5"></i> Enviar link da PWA
          </button>
          <button
            onClick={simulateBirthdayEmail}
            className="bg-purple-50 border border-purple-200 text-purple-700 font-semibold px-3 py-1.5 rounded-lg text-xs hover:bg-purple-100 transition-all cursor-pointer"
          >
            <i className="fa-solid fa-cake-candles mr-1.5"></i> Simular Aniversário
          </button>
        </div>
      </div>

      {pwaSentMsg && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-lg text-emerald-800 text-xs font-medium animate-fade-in flex items-center shadow-sm">
          <i className="fa-solid fa-check-circle mr-2 text-emerald-500 text-sm"></i>
          <span>
            PWA link de instalação enviado com sucesso! O condómino recebeu instruções via SMS e E-mail de download direto.
          </span>
        </div>
      )}

      {/* --- PORTAL DO CONDÓMINO (PWA SCREEN) --- */}
      {activeTab === "portal" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Col 1: Condómino Card & Profile */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-8 text-white relative">
                <div className="flex items-center space-x-4">
                  <div className="h-16 w-16 rounded-full bg-slate-100/10 border-2 border-white/40 flex items-center justify-center text-white overflow-hidden relative group shrink-0">
                    {activeUserFracao?.proprietario.foto ? (
                      <img src={activeUserFracao.proprietario.foto} alt="Perfil" className="h-full w-full object-cover" />
                    ) : (
                      <i className="fa-solid fa-user text-3xl"></i>
                    )}
                    <button
                      onClick={() => profileFileRef.current?.click()}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] font-bold"
                    >
                      Alterar
                    </button>
                  </div>
                  <input
                    type="file"
                    ref={profileFileRef}
                    onChange={handleProfilePhotoChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{loggedUser.nome}</h3>
                    <p className="text-emerald-200 text-xs font-semibold uppercase tracking-wider">
                      Fração {activeUserFracao?.fracao_nome || "A"} • {activeUserFracao?.piso || "R/C Esq"}
                    </p>
                    <p className="text-emerald-100 text-[10px] mt-1 font-mono-custom">
                      Permilagem: {activeUserFracao?.permilagem || 150}‰
                    </p>
                  </div>
                </div>

                {/* Biometrics button */}
                <div className="mt-6 pt-4 border-t border-white/20 flex justify-between items-center">
                  <span className="text-xs text-emerald-100 flex items-center">
                    <i className="fa-solid fa-fingerprint mr-1.5 text-sm"></i> Acesso Biométrico
                  </span>
                  <div className="flex items-center space-x-2">
                    {biometricsActive && (
                      <button
                        onClick={simulateBiometricLogin}
                        className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[10px] font-bold px-2 py-1 rounded"
                      >
                        Autenticar
                      </button>
                    )}
                    <button
                      onClick={handleToggleBiometrics}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                        biometricsActive ? "bg-emerald-400" : "bg-white/20"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                          biometricsActive ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Personal Data Form (Address is Read-only) */}
              <div className="p-6">
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Dados do Perfil</h4>
                  
                  {profileSuccessMsg && (
                    <div className="bg-emerald-50 text-emerald-800 p-2.5 rounded text-xs font-medium">
                      {profileSuccessMsg}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Nome Completo *</label>
                      <input
                        type="text"
                        value={editedNome}
                        onChange={(e) => setEditedNome(e.target.value)}
                        className="border border-slate-200 px-3 py-1.5 text-xs rounded-lg focus:outline-emerald-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">E-mail de Login *</label>
                      <input
                        type="email"
                        value={editedEmail}
                        onChange={(e) => setEditedEmail(e.target.value)}
                        className="border border-slate-200 px-3 py-1.5 text-xs rounded-lg focus:outline-emerald-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Telemóvel</label>
                      <input
                        type="text"
                        value={editedTlm}
                        onChange={(e) => setEditedTlm(e.target.value)}
                        className="border border-slate-200 px-3 py-1.5 text-xs rounded-lg focus:outline-emerald-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">NIF *</label>
                      <input
                        type="text"
                        value={editedNif}
                        onChange={(e) => setEditedNif(e.target.value)}
                        className="border border-slate-200 px-3 py-1.5 text-xs rounded-lg focus:outline-emerald-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Aniversário</label>
                      <input
                        type="date"
                        value={editedBirthday}
                        onChange={(e) => setEditedBirthday(e.target.value)}
                        className="border border-slate-200 px-3 py-1.5 text-xs rounded-lg focus:outline-emerald-500"
                      />
                    </div>

                    <div className="flex flex-col col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">IBAN de Cobrança</label>
                      <input
                        type="text"
                        value={editedIban}
                        onChange={(e) => setEditedIban(e.target.value)}
                        className="border border-slate-200 px-3 py-1.5 text-xs rounded-lg focus:outline-emerald-500 font-mono-custom"
                        placeholder="PT50..."
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Titular da Conta</label>
                      <input
                        type="text"
                        value={editedTitular}
                        onChange={(e) => setEditedTitular(e.target.value)}
                        className="border border-slate-200 px-3 py-1.5 text-xs rounded-lg focus:outline-emerald-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Entidade Bancária</label>
                      <input
                        type="text"
                        value={editedBanco}
                        onChange={(e) => setEditedBanco(e.target.value)}
                        className="border border-slate-200 px-3 py-1.5 text-xs rounded-lg focus:outline-emerald-500"
                      />
                    </div>

                    {/* Address - Strictly read-only ("exceto morada") */}
                    <div className="flex flex-col col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center">
                        Morada do Prédio (Bloqueado) <i className="fa-solid fa-lock ml-1 text-slate-400"></i>
                      </label>
                      <input
                        type="text"
                        value={`${predio?.morada_linha1 || ""}, ${predio?.num_porta || ""}`}
                        disabled
                        className="bg-slate-50 border border-slate-100 text-slate-400 px-3 py-1.5 text-xs rounded-lg cursor-not-allowed font-medium"
                      />
                      <span className="text-[9px] text-slate-400 mt-0.5">
                        A alteração da morada requer submissão de escritura à administração.
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Guardar Alterações do Perfil
                  </button>
                </form>

                {/* Submenu Expansível de Segurança */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <UserSecuritySubmenu
                    userEmail={editedEmail || loggedUser.email}
                    userRole={loggedUser.role}
                    biometricsEnabled={biometricsEnabled}
                    setBiometricsEnabled={setBiometricsEnabled}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Col 2: Active Quotas & Payments with IA */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Password recovery block inside portal */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold uppercase text-slate-800 mb-3 flex items-center">
                <i className="fa-solid fa-key mr-2 text-emerald-600"></i> Recuperação de Password de Acesso
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Caso se tenha esquecido da sua senha da PWA, insira o seu e-mail cadastrado para gerar uma senha provisória automática imediata.
              </p>
              <form onSubmit={handlePasswordRecovery} className="flex gap-2">
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="Seu e-mail cadastrado (Ex: ana.silva@gmail.com)"
                  className="flex-grow border border-slate-200 px-3 py-1.5 text-xs rounded-lg focus:outline-emerald-500"
                />
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Recuperar
                </button>
              </form>
              {recoveryStatus && (
                <p className={`text-xs font-semibold mt-3 ${recoveryStatus.includes("Sucesso") ? "text-emerald-700" : "text-red-600"}`}>
                  {recoveryStatus}
                </p>
              )}
            </div>

            {/* Quotas / Avisos */}
            {loggedUser.role === "INQUILINO" ? (
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-5 text-amber-900 shadow-sm flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                  <Shield className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900 mb-1">
                    Perfil de Inquilino - Restrição de Dados Financeiros
                  </h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Como Inquilino, não tem acesso aos extratos de conta-corrente, avisos de cobrança de quotas ou comprovativos financeiros da fração. A gestão financeira e a liquidação de quotas cabem exclusivamente ao proprietário da fração e à administração do condomínio.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold uppercase text-slate-800 flex items-center">
                      <i className="fa-solid fa-file-invoice-dollar mr-2 text-emerald-600"></i> Avisos & Quotas Pendentes
                    </h3>
                    <span className="text-[10px] bg-amber-50 text-amber-700 font-bold border border-amber-200 px-2 py-0.5 rounded-full">
                      Fração {activeUserFracao?.fracao_nome || "A"}
                    </span>
                  </div>

                  {activeUserAvisos.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      Não possui quotas pendentes neste prédio. Bom trabalho!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeUserAvisos.map((aviso) => (
                        <div
                          key={aviso.id_aviso}
                          className="border border-slate-100 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50/40 hover:bg-slate-50 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-800 text-xs">{aviso.descricao}</span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                  aviso.estado === "Pago"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {aviso.estado}
                              </span>
                            </div>
                            <div className="flex items-center space-x-4 text-[10px] text-slate-500">
                              <span>Emissão: {aviso.data}</span>
                              <span className="text-red-500 font-medium">Vencimento: {aviso.vencimento}</span>
                            </div>
                          </div>
                          <div className="mt-3 md:mt-0 flex items-center space-x-4">
                            <span className="text-base font-bold text-slate-900 font-mono-custom">
                              {aviso.valor.toFixed(2)} €
                            </span>
                            {aviso.estado !== "Pago" && (
                              <button
                                onClick={() => initiatePaymentProof(aviso)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer shadow-sm"
                              >
                                <i className="fa-solid fa-upload mr-1.5"></i> Liquidar por IA
                              </button>
                            )}
                            {aviso.estado === "Pago" && (
                              <span className="text-emerald-600 text-xs font-bold flex items-center">
                                <i className="fa-solid fa-circle-check mr-1 text-sm"></i> Recibo Gerado
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submissions & Receipt History */}
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold uppercase text-slate-800 mb-4 flex items-center">
                    <i className="fa-solid fa-clock-rotate-left mr-2 text-emerald-600"></i> Histórico de Comprovativos & Recibos Emitidos
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[9px] tracking-wider">
                          <th className="py-2.5">Submissão</th>
                          <th className="py-2.5">Fração</th>
                          <th className="py-2.5">Valor Extraído</th>
                          <th className="py-2.5">IBAN de Envio</th>
                          <th className="py-2.5">Estado</th>
                          <th className="py-2.5 text-right">Recibo Oficial</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {comprovativos
                          .filter((c) => c.id_fracao === activeUserFracao?.id_fracao)
                          .map((comp) => (
                            <tr key={comp.id} className="hover:bg-slate-50/50">
                              <td className="py-3 font-medium text-slate-800">{comp.dataSubmissao}</td>
                              <td className="py-3 font-bold text-slate-600">Fração {comp.nome_fracao}</td>
                              <td className="py-3 font-bold text-slate-900 font-mono-custom">{comp.valorExtraido.toFixed(2)} €</td>
                              <td className="py-3 font-mono-custom text-slate-500 text-[10px]">{comp.ibanExtraido}</td>
                              <td className="py-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    comp.estado === "Confirmado"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                      : comp.estado === "Rejeitado"
                                      ? "bg-red-50 text-red-700 border border-red-100"
                                      : "bg-amber-50 text-amber-700 border border-amber-100"
                                  }`}
                                >
                                  {comp.estado}
                                </span>
                              </td>
                              <td className="py-3 text-right">
                                {comp.reciboGerado ? (
                                  <button
                                    onClick={() =>
                                      alert(`--- RECIBO OFICIAL ---\nNúmero: ${comp.reciboGerado}\nFração: ${comp.nome_fracao}\nValor: ${comp.valorExtraido}€\nEstado: Liquidado e Conciliado por IA`)
                                    }
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded text-[10px] transition-colors"
                                  >
                                    <i className="fa-solid fa-file-pdf mr-1 text-red-500"></i> {comp.reciboGerado}
                                  </button>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">A aguardar validação</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Messaging Inbox / Feed inside Portal */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold uppercase text-slate-800 mb-4 flex items-center">
                <i className="fa-solid fa-message mr-2 text-emerald-600"></i> Suas Mensagens à Administração
              </h3>
              
              <div className="space-y-4">
                {mensagens
                  .filter((m) => m.id_fracao === activeUserFracao?.id_fracao)
                  .map((m) => (
                    <div key={m.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/20">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-slate-800 text-xs">{m.assunto}</span>
                          <p className="text-[10px] text-slate-400">{m.data}</p>
                        </div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            m.estado === "Respondida"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : "bg-amber-50 text-amber-700 border border-amber-100"
                          }`}
                        >
                          {m.estado}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2 bg-white p-2.5 rounded border border-slate-100">
                        {m.mensagem}
                      </p>
                      {m.anexoWebP && (
                        <div className="mt-2 text-[10px] text-slate-500 font-semibold flex items-center">
                          <i className="fa-solid fa-paperclip mr-1 text-emerald-500"></i> Ficheiro ou fotografia em anexo
                        </div>
                      )}

                      {m.respostaAdmin && (
                        <div className="mt-3 pl-4 border-l-2 border-emerald-500 bg-emerald-50/30 p-3 rounded">
                          <div className="flex justify-between text-[10px] font-bold text-emerald-800">
                            <span>Administração</span>
                            <span>{m.dataResposta}</span>
                          </div>
                          <p className="text-xs text-emerald-900 mt-1">{m.respostaAdmin}</p>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- BACKOFFICE ADMIN PANEL --- */}
      {activeTab === "backoffice" && (
        <div className="space-y-6">
          {/* Quick Simulation Job Tools */}
          <div className="bg-slate-900 rounded-xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-12 -translate-y-6">
              <i className="fa-solid fa-clock text-[200px]"></i>
            </div>
            <h3 className="text-base font-bold uppercase mb-2 flex items-center text-emerald-400">
              <i className="fa-solid fa-gears mr-2"></i> Simulador de Rotinas de Faturação & Cobrança por IA
            </h3>
            <p className="text-xs text-slate-300 mb-4 max-w-2xl">
              Execute tarefas agendadas automáticas que simulam o comportamento real de envio de notas de cobrança no dia 25 e o disparo inteligente de lembretes estruturados em datas cruciais.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={simulateDay25Billing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition-all cursor-pointer flex items-center shadow-sm"
              >
                <i className="fa-solid fa-calendar-check mr-2"></i> Executar Faturação Dia 25 (Automatizada)
              </button>
              <button
                onClick={simulateRemindersTrigger}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold px-4 py-2 rounded-lg text-xs transition-all cursor-pointer flex items-center"
              >
                <i className="fa-solid fa-bell mr-2 text-yellow-400"></i> Disparar Lembretes de Atraso (Dias 5, 10, 15)
              </button>
            </div>
          </div>

          {/* Pending Proofs Verification */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold uppercase text-slate-800 mb-4 flex items-center">
              <i className="fa-solid fa-list-check mr-2 text-slate-700"></i> Comprovativos de Quotas Pendentes de Conciliação
            </h3>

            {comprovativos.filter((c) => c.estado === "Pendente").length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                Excelente! Não existem comprovativos de pagamentos pendentes de aprovação neste prédio.
              </div>
            ) : (
              <div className="space-y-4">
                {comprovativos
                  .filter((c) => c.estado === "Pendente")
                  .map((comp) => (
                    <div
                      key={comp.id}
                      className="border border-slate-100 rounded-xl p-5 bg-slate-50/50 flex flex-col xl:flex-row justify-between items-start gap-4"
                    >
                      <div className="flex flex-col md:flex-row gap-4 items-start">
                        {/* WebP Attachment simulation preview */}
                        <div className="h-28 w-28 bg-slate-200 rounded-lg flex flex-col items-center justify-center border border-slate-300 p-2 shrink-0 overflow-hidden text-center relative">
                          <i className="fa-solid fa-file-image text-slate-400 text-3xl mb-1"></i>
                          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">COMPROVATIVO</span>
                          <span className="text-[7px] text-emerald-600 font-semibold block bg-emerald-50 border border-emerald-100 rounded px-1 mt-1">Documento Anexado</span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-sm">Fração {comp.nome_fracao}</span>
                            <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
                              Identificado por: {comp.identificadoPor}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                            <div className="text-slate-500">
                              Valor Extraído por IA:{" "}
                              <strong className="text-slate-800 font-mono-custom">{comp.valorExtraido.toFixed(2)} €</strong>
                            </div>
                            <div className="text-slate-500">
                              Data Extraída: <strong className="text-slate-800">{comp.dataExtraida}</strong>
                            </div>
                            <div className="text-slate-500">
                              IBAN Extraído: <strong className="text-slate-800 font-mono-custom text-[10px]">{comp.ibanExtraido}</strong>
                            </div>
                            <div className="text-slate-500">
                              Referência Detetada: <strong className="text-slate-800">{comp.referenciaExtraida || "N/A (Identificado por IBAN)"}</strong>
                            </div>
                          </div>

                          <div className="text-xs bg-white p-2.5 rounded border border-slate-100 text-slate-600">
                            <strong>Descrição do Condómino:</strong> {comp.descricaoCorrigida}
                          </div>
                        </div>
                      </div>

                      <div className="flex xl:flex-col gap-2 shrink-0 w-full xl:w-auto">
                        <button
                          onClick={() => handleConfirmPayment(comp)}
                          className="flex-grow bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer shadow-sm flex items-center justify-center"
                        >
                          <i className="fa-solid fa-check mr-1.5"></i> Confirmar & Emitir Recibo
                        </button>
                        <button
                          onClick={() => handleRejectPayment(comp.id)}
                          className="flex-grow bg-white hover:bg-red-50 border border-red-200 text-red-600 font-bold py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center"
                        >
                          <i className="fa-solid fa-trash-can mr-1.5"></i> Rejeitar Comprovativo
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Perfis de Acesso & Welcome E-mail */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold uppercase text-slate-800 mb-4 flex items-center">
              <i className="fa-solid fa-users-gear mr-2 text-slate-700"></i> Perfis de Acesso dos Condóminos & Portabilidade
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[9px] tracking-wider">
                    <th className="py-2.5">Fração</th>
                    <th className="py-2.5">Piso</th>
                    <th className="py-2.5">Proprietário</th>
                    <th className="py-2.5">E-mail Cadastrado</th>
                    <th className="py-2.5">Password Provisória</th>
                    <th className="py-2.5 text-right">Ações de Segurança</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fracoes
                    .filter((f) => f.id_predio === predio.id_predio)
                    .map((frac) => (
                      <tr key={frac.id_fracao} className="hover:bg-slate-50/50">
                        <td className="py-3 font-bold text-slate-900">Fração {frac.fracao_nome}</td>
                        <td className="py-3 text-slate-500">{frac.piso}</td>
                        <td className="py-3 font-medium text-slate-800">{frac.proprietario.nome}</td>
                        <td className="py-3 font-mono-custom text-slate-600">{frac.proprietario.email}</td>
                        <td className="py-3 font-mono-custom font-bold text-indigo-600">
                          {tempPassMap[frac.id_fracao] || "Não Atribuída"}
                        </td>
                        <td className="py-3 text-right space-x-1.5">
                          <button
                            onClick={() => triggerTempPassword(frac.id_fracao)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-1 rounded text-[10px] transition-colors"
                          >
                            <i className="fa-solid fa-arrows-rotate mr-1"></i> Nova Pass
                          </button>
                          <button
                            onClick={() => triggerWelcomeEmail(frac)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded text-[10px] transition-colors"
                          >
                            <i className="fa-solid fa-paper-plane mr-1"></i> Boas-Vindas
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Admin Backoffice messaging inbox */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold uppercase text-slate-800 mb-4 flex items-center">
              <i className="fa-solid fa-envelope-open-text mr-2 text-slate-700"></i> Caixa de Mensagens dos Condóminos
            </h3>

            <div className="space-y-4">
              {mensagens.map((msg) => (
                <div key={msg.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/40 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-800 text-xs">Assunto: {msg.assunto}</span>
                      <p className="text-[10px] text-slate-400">
                        De: {msg.nome_remetente} • Recebido em: {msg.data}
                      </p>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        msg.estado === "Respondida"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : "bg-amber-50 text-amber-700 border border-amber-100"
                      }`}
                    >
                      {msg.estado}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 bg-white p-3 rounded border border-slate-100">
                    {msg.mensagem}
                  </p>

                  {msg.anexoWebP && (
                    <div className="text-[10px] text-slate-500 font-bold flex items-center">
                      <i className="fa-solid fa-image mr-1 text-emerald-500"></i> Anexo WebP Detetado
                    </div>
                  )}

                  {msg.respostaAdmin ? (
                    <div className="pl-4 border-l-2 border-emerald-500 bg-emerald-50/40 p-3 rounded">
                      <span className="text-[10px] font-bold text-emerald-800 block">Sua resposta:</span>
                      <p className="text-xs text-emerald-950 mt-1">{msg.respostaAdmin}</p>
                      <span className="text-[9px] text-slate-400 mt-0.5 block">{msg.dataResposta}</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={adminReplyTexts[msg.id] || ""}
                        onChange={(e) =>
                          setAdminReplyTexts((prev) => ({ ...prev, [msg.id]: e.target.value }))
                        }
                        placeholder="Escreva a resposta para o condómino..."
                        className="flex-grow border border-slate-200 px-3 py-1.5 text-xs rounded-lg focus:outline-emerald-500"
                      />
                      <button
                        onClick={() => handleSendAdminReply(msg.id)}
                        className="bg-slate-950 hover:bg-slate-800 text-white font-bold px-4 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        Responder
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- DRAGGABLE FLOATING CONTACT BUTTON (FAB) --- */}
      {loggedUser.role === "USER" && (
        <>
          <motion.div
            drag
            dragMomentum={false}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setMsgDrawerOpen(true)}
            className="fixed bottom-6 right-6 z-40 cursor-grab active:cursor-grabbing select-none"
            title="Contactar Administração (Deslocável)"
          >
            <div className="relative w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xl flex items-center justify-center border-2 border-white ring-4 ring-emerald-600/20 transition-colors">
              <img
                src="/modulos/75-mensagem.png"
                alt="Mensagens"
                className="w-8 h-8 object-contain pointer-events-none drop-shadow-sm"
              />
              <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-black border-2 border-white shadow-md animate-pulse">
                {mensagens.filter((m) => m.estado === "Pendente" || m.respostaAdmin).length || 1}
              </span>
            </div>
          </motion.div>

          {/* WHATSAPP-STYLE DIRECT CHAT MODAL */}
          {msgDrawerOpen && (
            <div 
              onClick={(e) => {
                if (e.target === e.currentTarget) setMsgDrawerOpen(false);
              }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            >
              <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: 40, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.96 }}
                className="w-full max-w-lg bg-[#EFEAE2] dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[85vh] sm:h-[650px] border border-slate-300 dark:border-slate-800 relative"
              >
                {/* WhatsApp Header */}
                <div className="bg-[#075E54] text-white px-4 py-3 flex items-center justify-between shadow-md shrink-0">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-emerald-800 flex items-center justify-center border border-white/30 overflow-hidden shadow-inner">
                        <img src="/modulos/01-predio.png" alt="Condomínio" className="w-7 h-7 object-contain" />
                      </div>
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#075E54] rounded-full"></span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold leading-tight">Administração do Condomínio</h3>
                      <p className="text-[10.5px] text-emerald-100 flex items-center gap-1 font-medium">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Online • Resposta habitual em minutos
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setMsgDrawerOpen(false)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-full font-black text-xs border border-white/30 transition-all cursor-pointer shadow-md"
                      title="Sair e Fechar Canal de Mensagens"
                      aria-label="Sair / Fechar"
                    >
                      <X className="h-4 w-4 stroke-[2.5]" />
                      <span>Sair</span>
                    </button>
                  </div>
                </div>

                {/* WhatsApp Chat Body */}
                <div className="flex-grow p-4 overflow-y-auto space-y-3 bg-[#EFEAE2] dark:bg-[#0b141a]">
                  <div className="text-center my-1">
                    <span className="bg-white/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-3 py-1 rounded-full shadow-xs uppercase tracking-wider">
                      Canal Oficial de Mensagens & Suporte
                    </span>
                  </div>

                  {mensagens.map((msg) => {
                    const isUser = msg.nome_remetente.includes(loggedUser.nome) || msg.id_fracao === "frac-1";
                    return (
                      <React.Fragment key={msg.id}>
                        {/* User Message Bubble */}
                        <div className="flex justify-end">
                          <div className="max-w-[85%] bg-[#D9FDD3] dark:bg-[#005c4b] text-slate-900 dark:text-slate-100 rounded-2xl rounded-tr-xs p-3 shadow-xs border border-emerald-200/50 space-y-2">
                            {msg.assunto && msg.assunto !== "Mensagem Direta" && msg.assunto !== "Mensagem de Voz" && (
                              <div className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border-b border-emerald-300/40 pb-1">
                                {msg.assunto}
                              </div>
                            )}

                            {/* Voice Audio Note Player */}
                            {msg.audioUrl ? (
                              <div className="flex items-center gap-2.5 bg-white/60 dark:bg-black/20 p-2 rounded-xl border border-emerald-300/50">
                                <button
                                  type="button"
                                  onClick={() => handlePlayVoiceAudio(msg.id)}
                                  className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs cursor-pointer transition-transform active:scale-90"
                                >
                                  {playingAudioId === msg.id ? (
                                    <Pause className="h-3.5 w-3.5 fill-current" />
                                  ) : (
                                    <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                                  )}
                                </button>
                                <div className="flex-grow space-y-1">
                                  <div className="flex items-center gap-1">
                                    {[30, 60, 40, 80, 50, 90, 70, 40, 60, 85, 45, 75, 35].map((h, i) => (
                                      <span
                                        key={i}
                                        className={`w-1 rounded-full transition-all ${
                                          playingAudioId === msg.id
                                            ? "bg-emerald-600 animate-pulse"
                                            : "bg-slate-400 dark:bg-slate-500"
                                        }`}
                                        style={{ height: `${(h * 16) / 100}px` }}
                                      ></span>
                                    ))}
                                  </div>
                                  <div className="flex justify-between text-[9px] text-slate-500 font-mono-custom">
                                    <span>{playingAudioId === msg.id ? "A reproduzir..." : "0:0" + (msg.audioDuration || 5)}</span>
                                    <span>🎙️ Áudio de Voz</span>
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            {/* Attached Photo */}
                            {msg.anexoWebP && (
                              <div className="rounded-xl overflow-hidden border border-emerald-300/40 bg-white">
                                <img src={msg.anexoWebP} alt="Anexo" className="max-h-48 w-full object-cover" />
                              </div>
                            )}

                            {/* Text Message */}
                            {msg.mensagem && !msg.audioUrl && (
                              <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.mensagem}</p>
                            )}

                            <div className="flex items-center justify-end space-x-1 text-[9.5px] text-slate-500 dark:text-emerald-200/70 font-mono-custom">
                              <span>{msg.data}</span>
                              <CheckCheck className="h-3.5 w-3.5 text-blue-500 inline ml-1" />
                            </div>
                          </div>
                        </div>

                        {/* Admin Reply Bubble */}
                        {msg.respostaAdmin && (
                          <div className="flex justify-start">
                            <div className="max-w-[85%] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl rounded-tl-xs p-3 shadow-xs border border-slate-200 dark:border-slate-700 space-y-1.5">
                              <div className="text-[10px] font-bold text-[#075E54] dark:text-emerald-400 flex items-center gap-1">
                                <Shield className="h-3 w-3 text-emerald-600 inline mr-1" /> Administração do Condomínio
                              </div>
                              <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.respostaAdmin}</p>
                              <div className="text-right text-[9.5px] text-slate-400 font-mono-custom">
                                {msg.dataResposta || msg.data}
                              </div>
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Previews of attached Photo, Document or Audio Note */}
                {(newMsgAnexo || msgDocAttachment || recordedAudioUrl) && (
                  <div className="bg-white dark:bg-slate-850 px-4 py-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    {newMsgAnexo && (
                      <div className="flex items-center gap-2">
                        <img src={newMsgAnexo} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-slate-200" />
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Fotografia anexada (.webp)</span>
                      </div>
                    )}
                    {msgDocAttachment && (
                      <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-lg">
                        <FileText className="h-4 w-4 text-indigo-600" />
                        <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200">{msgDocAttachment.name} ({msgDocAttachment.size})</span>
                      </div>
                    )}
                    {recordedAudioUrl && (
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                        <Volume2 className="h-4 w-4 text-emerald-600" />
                        <span>Mensagem de voz pronta ({recordingTimer || 4}s)</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setNewMsgAnexo(null);
                        setMsgDocAttachment(null);
                        setRecordedAudioUrl(null);
                      }}
                      className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 cursor-pointer"
                    >
                      Remover ✕
                    </button>
                  </div>
                )}

                {/* EMOJI PICKER POPOVER */}
                {isEmojiPickerOpen && (
                  <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-2.5 shadow-2xl z-20 animate-fade-in">
                    <div className="flex justify-between items-center pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Selecionar Emoji</span>
                      <button 
                        type="button" 
                        onClick={() => setIsEmojiPickerOpen(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-8 gap-2 text-lg">
                      {["😊", "👍", "🏢", "🔑", "🚪", "💡", "🔧", "⚠️", "📄", "💶", "⏱️", "📋", "🤝", "📢", "🚨", "💧", "🛠️", "🚗", "📦", "🧹", "✨", "🔒", "✅", "❌"].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setNewMsgTexto((prev) => prev + emoji);
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

                {/* ATTACHMENT MENU POPOVER */}
                {isAttachmentMenuOpen && (
                  <div className="absolute bottom-16 left-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-2xl shadow-2xl z-30 animate-fade-in space-y-1.5 min-w-[220px]">
                    <div className="flex justify-between items-center pb-1 mb-1 border-b border-slate-100 dark:border-slate-800 px-1">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Anexar Ficheiro</span>
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
                        msgDocInputRef.current?.click();
                      }}
                      className="w-full flex items-center space-x-2.5 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-left cursor-pointer transition-colors"
                    >
                      <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs block">Documento / PDF</span>
                        <span className="text-[8px] text-slate-400">PDF, Word, Excel, TXT</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAttachmentMenuOpen(false);
                        msgCameraInputRef.current?.click();
                      }}
                      className="w-full flex items-center space-x-2.5 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-left cursor-pointer transition-colors"
                    >
                      <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
                        <Camera className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs block">Tirar Fotografia (Câmara)</span>
                        <span className="text-[8px] text-slate-400">Acesso à câmara do PC/Telemóvel</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAttachmentMenuOpen(false);
                        msgFileRef.current?.click();
                      }}
                      className="w-full flex items-center space-x-2.5 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-left cursor-pointer transition-colors"
                    >
                      <div className="p-1.5 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-lg">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs block">Galeria de Fotos</span>
                        <span className="text-[8px] text-slate-400">Compressão .WEBP imediata</span>
                      </div>
                    </button>
                  </div>
                )}

                {/* Hidden File Inputs */}
                <input
                  type="file"
                  ref={msgFileRef}
                  onChange={handleMessageAttachmentChange}
                  accept="image/*"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={msgDocInputRef}
                  onChange={handleDocumentAttachmentChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={msgCameraInputRef}
                  onChange={handleCameraCapture}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />

                {/* WhatsApp Chat Footer / Input Bar */}
                <div className="bg-[#F0F2F5] dark:bg-slate-850 p-2.5 sm:p-3 border-t border-slate-300 dark:border-slate-800 shrink-0">
                  {isRecordingAudio ? (
                    <div className="flex items-center justify-between bg-white dark:bg-slate-800 px-4 py-2.5 rounded-full border border-red-200 shadow-xs">
                      <div className="flex items-center gap-2 text-red-600 font-bold text-xs">
                        <span className="w-3 h-3 rounded-full bg-red-600 animate-ping"></span>
                        <span>A gravar áudio: 00:0{recordingTimer}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCancelVoiceRecording}
                          className="px-3 py-1 text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleToggleVoiceRecording}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-full text-xs font-bold cursor-pointer"
                        >
                          Guardar Nota
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSendMsgToAdmin} className="flex items-center gap-2">
                      {/* Attach Clip Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsAttachmentMenuOpen(!isAttachmentMenuOpen);
                          setIsEmojiPickerOpen(false);
                        }}
                        className={`p-2.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                          isAttachmentMenuOpen || newMsgAnexo || msgDocAttachment
                            ? "bg-emerald-600 text-white"
                            : "text-slate-500 hover:text-emerald-700 hover:bg-slate-200 dark:hover:bg-slate-750"
                        }`}
                        title="Anexar documento, fotografia ou aceder à câmara (Clip)"
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>

                      {/* Emoji Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsEmojiPickerOpen(!isEmojiPickerOpen);
                          setIsAttachmentMenuOpen(false);
                        }}
                        className={`p-2.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                          isEmojiPickerOpen
                            ? "bg-amber-500 text-white"
                            : "text-amber-500 hover:text-amber-600 hover:bg-slate-200 dark:hover:bg-slate-750"
                        }`}
                        title="Inserir Emoji"
                      >
                        <Smile className="h-4 w-4" />
                      </button>

                      {/* Text Input */}
                      <input
                        type="text"
                        value={newMsgTexto}
                        onChange={(e) => setNewMsgTexto(e.target.value)}
                        placeholder="Escreva uma mensagem à administração..."
                        className="flex-grow bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-100 placeholder-slate-400"
                      />

                      {/* Voice Audio Record Button */}
                      <button
                        type="button"
                        onClick={handleToggleVoiceRecording}
                        className="p-2.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-200 dark:hover:bg-slate-750 rounded-full transition-colors cursor-pointer shrink-0"
                        title="Gravar Mensagem de Áudio (Nota de Voz)"
                      >
                        <Mic className="h-4 w-4" />
                      </button>

                      {/* Send Button */}
                      <button
                        type="submit"
                        disabled={msgSending || (!newMsgTexto && !newMsgAnexo && !recordedAudioUrl && !msgDocAttachment)}
                        className="w-10 h-10 bg-[#075E54] hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-full flex items-center justify-center shrink-0 shadow-md transition-all cursor-pointer disabled:cursor-not-allowed"
                        title="Enviar Mensagem"
                      >
                        <Send className="h-4 w-4 text-white" />
                      </button>
                    </form>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </>
      )}

      {/* --- PAYMENT PROOF UPLOAD MODAL --- */}
      {payModalOpen && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setPayModalOpen(false);
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="bg-slate-900 px-6 py-4 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider text-emerald-400">Liquidação por Inteligência Artificial</h3>
                <p className="text-[10px] text-slate-300">Carregue o comprovativo e deixe o nosso motor extrair os dados</p>
              </div>
              <button 
                type="button"
                onClick={() => setPayModalOpen(false)} 
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-red-600 active:scale-95 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-700 hover:border-red-500"
                title="Fechar e Sair"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
                <span>Sair</span>
              </button>
            </div>

            <form onSubmit={handleSendPaymentProof} className="p-6 space-y-4">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Selecionar Imagem do Comprovativo</label>
                <div
                  className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => payFileRef.current?.click()}
                >
                  <i className="fa-solid fa-file-invoice text-emerald-500 text-3xl mb-2"></i>
                  <p className="text-xs text-slate-700 font-semibold">Selecione o ficheiro PDF, JPG ou PNG do banco</p>
                  <p className="text-[9px] text-slate-400 mt-1">O ficheiro será otimizado e lido automaticamente pelo motor IA</p>
                  <input
                    type="file"
                    ref={payFileRef}
                    onChange={handlePaymentFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>

              {paymentFile && (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[10px] text-slate-600 flex items-center justify-between">
                  <span className="font-semibold text-emerald-700">
                    Ficheiro Otimizado ({paymentOriginalSize})
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">DOCUMENTO CARREGADO</span>
                </div>
              )}

              {extractionLoading && (
                <div className="flex flex-col items-center justify-center py-6 space-y-2">
                  <div className="h-8 w-8 rounded-full border-4 border-emerald-500/10 border-t-emerald-500 animate-spin"></div>
                  <p className="text-xs font-semibold text-slate-700">A processar comprovativo com motor IA...</p>
                  <p className="text-[10px] text-slate-400">Extraindo valor, data, IBAN e regras regulamentares</p>
                </div>
              )}

              {paymentFile && !extractionLoading && extractedValue > 0 && (
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 space-y-3">
                  <h4 className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center">
                    <i className="fa-solid fa-microchip mr-1.5"></i> Dados Extraídos com Sucesso pela IA
                  </h4>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-white p-2 rounded border border-slate-100">
                      <span className="text-[9px] text-slate-400 block uppercase">VALOR EXTRAÍDO</span>
                      <strong className="text-slate-900 font-mono-custom">{extractedValue.toFixed(2)} €</strong>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-100">
                      <span className="text-[9px] text-slate-400 block uppercase">DATA EXTRAÍDA</span>
                      <strong className="text-slate-900">{extractedDate}</strong>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-100 col-span-2">
                      <span className="text-[9px] text-slate-400 block uppercase">IBAN DETECTADO</span>
                      <strong className="text-slate-900 font-mono-custom text-[10px]">{extractedIban}</strong>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-100 col-span-2">
                      <span className="text-[9px] text-slate-400 block uppercase">MÉTODO DE IDENTIFICAÇÃO DO PAGADOR</span>
                      <span className="bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                        {extractedIdType} (Identificado para a Fração {payerFractionName || "A"})
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Corrigir ou Adicionar Descrição (Condómino)
                    </label>
                    <input
                      type="text"
                      value={userDescCorrection}
                      onChange={(e) => setUserDescCorrection(e.target.value)}
                      className="border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-emerald-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="flex-grow bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!paymentFile || extractionLoading}
                  className="flex-grow bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer shadow-md disabled:bg-slate-300"
                >
                  Submeter à Administração
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- BIRTHDAY SIMULATION EMAIL DIALOG --- */}
      {/* --- BIRTHDAY EMAIL SIMULATION DIALOG --- */}
      {birthdayModalOpen && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setBirthdayModalOpen(false);
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-zoom-in border border-purple-200">
            <div className="bg-purple-950 px-6 py-4 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <i className="fa-solid fa-cake-candles text-purple-400 text-lg"></i>
                <div>
                  <h3 className="font-bold text-sm uppercase">Simulador de E-mail de Aniversário</h3>
                  <p className="text-[10px] text-purple-200">Envio automatizado com base na data de nascimento</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setBirthdayModalOpen(false)} 
                className="flex items-center gap-1 px-2.5 py-1 bg-purple-900/80 hover:bg-red-600 active:scale-95 text-purple-200 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer border border-purple-800"
                title="Fechar e Sair"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
                <span>Sair</span>
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto relative">
              <div className="border border-purple-100 bg-purple-50/40 rounded-xl p-5 text-xs text-purple-950 space-y-4 relative overflow-hidden">
                {/* Background Watermark */}
                <img 
                  src="/marca/19-marca-dagua-logo-cinza-claro.png" 
                  alt="Watermark" 
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 object-contain opacity-10 pointer-events-none" 
                />

                {/* Central Top Logo Header */}
                <div className="text-center pb-2 border-b border-purple-200/80">
                  <img 
                    src="/marca/20-Logotipo Horizontal com fundo.png" 
                    alt="CondoManager AI" 
                    className="h-10 mx-auto object-contain drop-shadow-xs" 
                  />
                  <p className="text-[9px] font-bold text-purple-900 uppercase tracking-widest mt-1">Comunicação Oficial de Aniversário</p>
                </div>

                <div className="space-y-1 text-slate-700 font-sans">
                  <p><strong>De:</strong> {(predio as any).email_administracao || (predio as any).email || "administracao@condomanager.pt"}</p>
                  <p><strong>Para:</strong> {loggedUser.email}</p>
                  <p><strong>Assunto:</strong> 🎂 Parabéns pelo seu Aniversário, {loggedUser.nome}! 🎉</p>
                </div>
                <hr className="border-purple-200/80" />

                <div className="space-y-3 text-slate-700 font-sans leading-relaxed relative z-10">
                  <p>Estimado(a) condómino(a) <strong>{loggedUser.nome}</strong>,</p>
                  <p>Em nome da Administração do seu condomínio, desejamos-lhe um excelente dia de aniversário, repleto de felicidade, saúde e harmonia!</p>
                  
                  <div className="pt-3 border-t border-purple-200/80 space-y-1 font-sans">
                    <p className="text-slate-700 text-xs">Com os meus cumprimentos,</p>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="bg-purple-100 text-purple-900 text-[9px] font-mono font-bold px-2 py-0.5 rounded border border-purple-300 inline-flex items-center gap-1">
                        <i className="fa-solid fa-shield-halved text-purple-700"></i> [Assinatura Digital Validada]
                      </span>
                    </div>
                    <p className="text-slate-900 text-xs font-bold mt-1">José Carlos Guerra</p>
                    <p className="text-slate-600 text-[11px]">Administrador do Condominio</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  const targetName = loggedUser.nome;
                  setBirthdayModalOpen(false);
                  triggerSendReaction("email", `E-mail de Aniversário para ${targetName}`);
                }}
                className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer shadow-md text-center"
              >
                Confirmar Envio Automático Simulador
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- WELCOME EMAIL SIMULATION DIALOG --- */}
      {welcomeMailModal && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setWelcomeMailModal(null);
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-zoom-in border border-emerald-200">
            <div className="bg-slate-900 px-6 py-4 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <i className="fa-solid fa-paper-plane text-emerald-400 text-lg"></i>
                <div>
                  <h3 className="font-bold text-sm uppercase">Simulador de E-mail de Boas-Vindas</h3>
                  <p className="text-[10px] text-slate-300">Instruções de portabilidade para novos condóminos</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setWelcomeMailModal(null)} 
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-red-600 active:scale-95 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-700 hover:border-red-500"
                title="Fechar e Sair"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
                <span>Sair</span>
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto relative">
              <div className="border border-emerald-100 bg-emerald-50/30 rounded-xl p-5 text-xs text-slate-800 space-y-4 relative overflow-hidden">
                {/* Background Watermark */}
                <img 
                  src="/marca/19-marca-dagua-logo-cinza-claro.png" 
                  alt="Watermark" 
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 object-contain opacity-10 pointer-events-none" 
                />

                {/* Central Top Logo Header */}
                <div className="text-center pb-2 border-b border-emerald-200/80">
                  <img 
                    src="/marca/20-Logotipo Horizontal com fundo.png" 
                    alt="CondoManager AI" 
                    className="h-10 mx-auto object-contain drop-shadow-xs" 
                  />
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Comunicação Oficial de Boas-Vindas</p>
                </div>

                <div className="space-y-1 text-slate-700 font-sans">
                  <p><strong>De:</strong> {(predio as any).email_administracao || (predio as any).email || "administracao@condomanagerai.com"}</p>
                  <p><strong>Para:</strong> {welcomeMailModal.fracao.proprietario.email}</p>
                  <p><strong>Assunto:</strong> Boas Vindas e Acessos</p>
                </div>
                <hr className="border-emerald-200/80" />

                <div className="space-y-3 text-slate-700 font-sans leading-relaxed relative z-10 text-xs">
                  <p>Olá <strong>{welcomeMailModal.fracao.proprietario.nome}</strong>,</p>
                  <p>Espero que se encontre bem.</p>
                  <p>O meu nome é José Carlos Guerra, administrador do nosso prédio e também seu vizinho no 3ºE. Disponibilizo o meu contacto direto (<strong>919943465</strong>) para qualquer assunto urgente ou questão que possa surgir.</p>
                  <p>Informo que a sua conta no CondoManager AI foi criada com sucesso. Pode aceder à sua área reservada através do link: <a href="https://bentorodrigues2.condomanagerai.com" target="_blank" rel="noreferrer" className="text-emerald-600 font-bold underline">https://bentorodrigues2.condomanagerai.com</a> e pode baixar a aplicação <a href="https://bentorodrigues2.condomanagerai.com" target="_blank" rel="noreferrer" className="text-emerald-600 font-bold underline">AQUI</a> (Link para baixar/instalar PWA).</p>
                  <p>Através desta plataforma — acessível via computador ou telemóvel — poderá acompanhar toda a atividade do condomínio, consultar documentos, reportar avarias, enviar comprovativos de pagamento e comunicar diretamente comigo. A sua participação ativa é fundamental para a gestão transparente do nosso prédio.</p>
                  
                  <div className="bg-white/80 backdrop-blur-xs border border-slate-200 p-3 rounded-lg space-y-1.5 text-[11px]">
                    <p className="font-bold text-slate-900 uppercase text-[10px]">Importante:</p>
                    <p className="pl-2">• <strong>Pagamentos:</strong> No seu perfil, encontrará a sua referência de pagamento personalizada. Por favor, utilize sempre esta referência ao efetuar transferências bancárias para garantir o processamento automático do seu saldo.</p>
                    <p className="pl-2">• <strong>Instruções:</strong> Em anexo, encontrará um breve guia de utilização da plataforma.</p>
                  </div>

                  {/* Attachment indicator box */}
                  <div className="bg-emerald-50 border border-emerald-300 p-2.5 rounded-lg flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-[11px] text-emerald-950">
                      <i className="fa-solid fa-file-pdf text-red-500 text-lg shrink-0"></i>
                      <span>Anexo (PDF): <strong>Instrucoes_Site_e_PWA_Condomino.pdf</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => generateCondominoPwaManualPDF(welcomeMailModal.fracao.proprietario.nome, predio.nome, welcomeMailModal.pass)}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] px-2.5 py-1 rounded transition-colors cursor-pointer shrink-0"
                    >
                      Descarregar PDF Anexo
                    </button>
                  </div>

                  <div className="bg-white/80 backdrop-blur-xs border border-slate-200 p-3 rounded-lg font-mono-custom text-[11px] text-slate-800 space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dados de Acesso:</p>
                    <p><strong>Link:</strong> <a href="https://bentorodrigues2.condomanagerai.com" target="_blank" rel="noreferrer" className="text-emerald-600 underline font-semibold">https://bentorodrigues2.condomanagerai.com</a></p>
                    <p><strong>Utilizador:</strong> {welcomeMailModal.fracao.proprietario.email}</p>
                    <p className="text-indigo-600 font-bold"><strong>Password Provisória:</strong> {welcomeMailModal.pass}</p>
                    <p className="text-[10px] text-slate-500 font-sans italic pt-1">(Por razões de segurança, ser-lhe-á solicitado que altere esta palavra-passe no seu primeiro acesso.)</p>
                  </div>

                  <p>Qualquer dúvida adicional, estou ao dispor.</p>

                  {/* Signature Section */}
                  <div className="pt-3 border-t border-slate-200 space-y-1">
                    <p className="text-slate-700 text-xs">Com os meus cumprimentos,</p>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-300 inline-flex items-center gap-1">
                        <i className="fa-solid fa-shield-halved text-emerald-600"></i> [Assinatura Digital Validada]
                      </span>
                    </div>
                    <p className="text-slate-900 text-xs font-bold mt-1">José Carlos Guerra</p>
                    <p className="text-slate-600 text-[11px]">O Administrador do Condomínio ({predio.nome})</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  generateCondominoPwaManualPDF(welcomeMailModal.fracao.proprietario.nome, predio.nome, welcomeMailModal.pass);
                  const recipientEmail = welcomeMailModal.fracao.proprietario.email;
                  setWelcomeMailModal(null);
                  triggerSendReaction("email", `E-mail de Boas-Vindas para ${recipientEmail}`);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition-colors cursor-pointer shadow-md text-center"
              >
                enviar Email Boas Vindas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TouchID/FaceID Simulation Modal */}
      {biometricModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[#0b1329] border border-slate-800 rounded-2xl shadow-2xl p-6 text-center space-y-6 animate-zoom-in">
            <div className="flex flex-col items-center">
              <div className="h-20 w-20 rounded-full border border-slate-800 bg-[#070b19] flex items-center justify-center text-emerald-400 text-4xl relative overflow-hidden">
                <i className="fa-solid fa-fingerprint animate-pulse"></i>
                <div className="absolute inset-x-0 bottom-0 bg-emerald-500/20" style={{ height: `${biometricProgress}%` }}></div>
              </div>
              <h3 className="text-white font-bold text-sm mt-4 uppercase tracking-wider">Acesso Biométrico Seguro</h3>
              <p className="text-[10px] text-slate-400 mt-1">A digitalizar FaceID / TouchID...</p>
            </div>

            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full transition-all duration-150" style={{ width: `${biometricProgress}%` }}></div>
            </div>

            {biometricSuccess ? (
              <div className="text-emerald-400 text-xs font-bold flex items-center justify-center">
                <i className="fa-solid fa-circle-check mr-1.5 text-base"></i> Biometria Reconhecida!
              </div>
            ) : (
              <span className="text-slate-500 text-[10px]">Mantenha o dedo no leitor ou olhe para a câmara</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
