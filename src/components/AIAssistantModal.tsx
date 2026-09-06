import React, { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Globe, 
  Copy, 
  Check, 
  FileText, 
  Download, 
  X, 
  ExternalLink,
  Paperclip,
  Sparkles,
  RefreshCw,
  Printer,
  Maximize2,
  Minimize2,
  Zap
} from "lucide-react";
import { LoggedUser, Predio } from "../types";
import { jsPDF } from "jspdf";

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  loggedUser: LoggedUser;
  predio: Predio;
}

interface AttachedImage {
  id: string;
  name: string;
  data: string; // base64
  mimeType: string;
}

interface AttachedDoc {
  id: string;
  name: string;
  size: string;
  content: string;
}

interface DocumentArtifact {
  title: string;
  type: string;
  content: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  images?: AttachedImage[];
  attachments?: AttachedDoc[];
  sources?: Array<{ title: string; uri: string }>;
  documentArtifact?: DocumentArtifact;
  timestamp: string;
}

export function AIAssistantModal({ isOpen, onClose, loggedUser, predio }: AIAssistantModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: "welcome-1",
        role: "model",
        text: `Olá ${loggedUser.nome} bem vindo!\nComo posso colaborar consigo?`,
        timestamp: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
      }
    ];
  });

  const [inputText, setInputText] = useState("");
  const enableWebSearch = true; // Pesquisa web sempre ativa
  const [isLoading, setIsLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Attached files state before sending
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [attachedDocs, setAttachedDocs] = useState<AttachedDoc[]>([]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputText]);

  if (!isOpen) return null;

  // Extract document tags from AI response if present
  const extractDocumentArtifact = (text: string): { cleanText: string; artifact?: DocumentArtifact } => {
    const docRegex = /\[DOCUMENTO_OFICIAL(?:\s+tipo="([^"]*)")?(?:\s+titulo="([^"]*)")?\]([\s\S]*?)\[\/DOCUMENTO_OFICIAL\]/i;
    const match = text.match(docRegex);

    if (match) {
      const type = match[1] || "DOCUMENTO OFICIAL";
      const title = match[2] || "Documento do Condomínio";
      const content = match[3].trim();
      const cleanText = text.replace(docRegex, "").trim();

      return {
        cleanText: cleanText || "Elaborei o documento oficial solicitado conforme as especificações legais:",
        artifact: { title, type, content }
      };
    }

    // Secondary heuristic: if the message starts with formal header structure or contains a complete letter/report
    if (text.includes("CONDOMÍNIO DO EDIFÍCIO") || text.includes("NOTIFICAÇÃO FORMAL") || text.includes("RELATÓRIO DE VISTORIA")) {
      const lines = text.split("\n");
      const titleLine = lines.find(l => l.toUpperCase().includes("NOTIFICAÇÃO") || l.toUpperCase().includes("RELATÓRIO") || l.toUpperCase().includes("CARTA") || l.toUpperCase().includes("CONVOCATÓRIA")) || "Documento Emitido";
      return {
        cleanText: text,
        artifact: {
          title: titleLine.replace(/[\*#]/g, "").trim(),
          type: "DOCUMENTO OFICIAL",
          content: text
        }
      };
    }

    return { cleanText: text };
  };

  // Handle Unified Upload (Photos, PDFs, Docs, TXT, Excel)
  const handleUnifiedUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    (Array.from(files) as File[]).forEach((file: File) => {
      if (file.type.startsWith("image/")) {
        // Read as image base64
        const reader = new FileReader();
        reader.onload = () => {
          const base64Data = reader.result as string;
          setAttachedImages((prev) => [
            ...prev,
            {
              id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: file.name,
              data: base64Data,
              mimeType: file.type
            }
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        // Read as document/text
        const reader = new FileReader();
        reader.onload = () => {
          const content = typeof reader.result === "string" ? reader.result : `[Ficheiro carregado: ${file.name}]`;
          setAttachedDocs((prev) => [
            ...prev,
            {
              id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: file.name,
              size: `${(file.size / 1024).toFixed(1)} KB`,
              content: content.substring(0, 10000)
            }
          ]);
        };
        reader.readAsText(file);
      }
    });

    e.target.value = "";
  };

  // Send Message to Gemini
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputText).trim();
    const currentImages = [...attachedImages];
    const currentDocs = [...attachedDocs];

    if ((!textToSend && currentImages.length === 0 && currentDocs.length === 0) || isLoading) {
      return;
    }

    const userMsgId = `user-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMsgId,
      role: "user",
      text: textToSend || (currentImages.length > 0 ? "Analise a(s) fotografia(s) em anexo." : "Analise o(s) documento(s) em anexo."),
      images: currentImages.length > 0 ? currentImages : undefined,
      attachments: currentDocs.length > 0 ? currentDocs : undefined,
      timestamp: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
    };

    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInputText("");
    setAttachedImages([]);
    setAttachedDocs([]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai-assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": loggedUser.role,
          "x-user-email": loggedUser.email,
          "x-condominio-id": predio.id_predio
        },
        body: JSON.stringify({
          messages: updatedHistory.map((m) => ({
            role: m.role,
            text: m.text,
            images: m.images,
            attachments: m.attachments
          })),
          enableWebSearch,
          predioInfo: {
            nome: predio?.nome || "Condomínio",
            morada: `${predio?.morada_linha1 || ""}, Nº ${predio?.num_porta || ""}, ${predio?.localidade || ""}`,
            nif: predio?.nif || ""
          }
        })
      });

      const data = await response.json();
      if (data.reply) {
        const { cleanText, artifact } = extractDocumentArtifact(data.reply);
        setMessages((prev) => [
          ...prev,
          {
            id: `model-${Date.now()}`,
            role: "model",
            text: cleanText,
            sources: data.sources || [],
            documentArtifact: artifact,
            timestamp: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
          }
        ]);
      } else {
        throw new Error(data.error || "Sem resposta do servidor Gemini.");
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `model-err-${Date.now()}`,
          role: "model",
          text: `⚠️ Não foi possível obter resposta no momento: ${err.message || "Erro de ligação"}.`,
          timestamp: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export PDF with jsPDF
  const handleExportPDF = (docArtifact: DocumentArtifact) => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "normal");

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(predio.nome || "CONDOMÍNIO DO EDIFÍCIO", 14, 18);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${predio.morada_linha1 || ""}, ${predio.localidade || ""} | NIF: ${predio.nif || ""}`,
      14,
      24
    );
    doc.line(14, 27, 196, 27);

    // Title
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text((docArtifact.title || "DOCUMENTO OFICIAL").toUpperCase(), 14, 35);

    // Content
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const splitText = doc.splitTextToSize(docArtifact.content, 180);
    doc.text(splitText, 14, 43);

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Documento emitido por Gemini IA Ativa • Página ${i} de ${pageCount}`, 14, 288);
    }

    doc.save(`${(docArtifact.title || "documento").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
  };

  const handlePrint = (content: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Documento Oficial - ${predio.nome}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #111; line-height: 1.6; }
            h1 { font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 20px; }
            pre { white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 13px; }
          </style>
        </head>
        <body>
          <h1>${predio.nome} - Documento Oficial</h1>
          <pre>${content}</pre>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const quickPrompts = [
    {
      label: "🔊 Notificação de Ruído",
      prompt: "Redige uma notificação formal de ruído excessivo em período noturno para a fração 3º Esq, citando o Regulamento Geral do Ruído (DL 9/2007) e o Regulamento do Edifício."
    },
    {
      label: "⚖️ Cobrança de Quotas",
      prompt: "Elabora uma interpelação formal para regularização de quotas em atraso (valor 240€, 4 meses em débito), estipulando prazo de 15 dias antes de avançar para contencioso judicial com força de título executivo."
    },
    {
      label: "🚧 Aviso de Obras",
      prompt: "Redige um aviso à comunidade de condóminos sobre obras urgentes de substituição da coluna de água no dia 25 entre as 09h e as 14h com corte temporário."
    },
    {
      label: "🔍 Pesquisa Web Lei 8/2022",
      prompt: "Pesquisa na web e resume as principais alterações introduzidas pela Lei n.º 8/2022 relativamente a quóruns de assembleia, atas digitais e poderes do administrador."
    },
    {
      label: "📊 Relatório de Vistoria",
      prompt: "Elabora um relatório executivo de vistoria às áreas comuns (telhado, iluminação de emergência e escadas) apontando anomalias e prioridades de intervenção."
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-fade-in">
      <div 
        className={`bg-slate-900 border border-slate-750 w-full rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 transition-all duration-300 ${
          isFullScreen 
            ? "h-full max-h-full max-w-full rounded-none" 
            : "max-w-5xl h-[92vh] max-h-[850px]"
        }`}
      >
        {/* ==================================================================== */}
        {/* GEMINI TOP HEADER */}
        {/* ==================================================================== */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Assistant Avatar Image (Replaces robot icon) */}
            <div className="relative h-11 w-11 rounded-xl bg-slate-900 border border-emerald-500/40 p-1 flex items-center justify-center shadow-lg shadow-emerald-950/60 overflow-hidden shrink-0">
              <img
                src="/modulos/87-ia-ativa.png"
                alt="Gemini IA Ativa"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/public/modulos/87-ia-ativa.png";
                }}
              />
              <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border border-slate-950"></span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white flex items-center gap-1.5">
                  Gemini IA Ativa
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-semibold">
                    Gemini 3.7 Flash
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <span className="text-slate-300 font-medium">{predio.nome || "Condomínio"}</span>
                <span>•</span>
                <span>{loggedUser.nome} ({loggedUser.role})</span>
              </p>
            </div>
          </div>

          {/* Action buttons on header */}
          <div className="flex items-center gap-2">
            {/* Clear Chat */}
            <button
              type="button"
              id="btn-gemini-clear-chat"
              onClick={() => {
                if (confirm("Deseja iniciar uma nova conversa com o Gemini?")) {
                  setMessages([
                    {
                      id: `welcome-${Date.now()}`,
                      role: "model",
                      text: `Olá ${loggedUser.nome} bem vindo!\nComo posso colaborar consigo?`,
                      timestamp: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
                    }
                  ]);
                }
              }}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
              title="Nova Conversa / Limpar"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            {/* Full Screen Toggle */}
            <button
              type="button"
              id="btn-gemini-fullscreen"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors hidden sm:block"
              title={isFullScreen ? "Reduzir Janela" : "Ecrã Inteiro"}
            >
              {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              id="btn-gemini-close"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-colors"
              title="Fechar Assistente"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* GEMINI CHAT MESSAGES STREAM */}
        {/* ==================================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 sm:gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {/* Model Avatar on left */}
              {msg.role === "model" && (
                <div className="h-9 w-9 rounded-xl bg-slate-950 border border-emerald-500/40 p-1 flex items-center justify-center shrink-0 shadow-md">
                  <img
                    src="/modulos/87-ia-ativa.png"
                    alt="IA Ativa"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/public/modulos/87-ia-ativa.png";
                    }}
                  />
                </div>
              )}

              {/* Message Bubble Content */}
              <div
                className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 sm:p-5 text-sm leading-relaxed shadow-lg ${
                  msg.role === "user"
                    ? "bg-emerald-600 text-white rounded-tr-none"
                    : "bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-tl-none"
                }`}
              >
                {/* Attached Images Sent by User */}
                {msg.images && msg.images.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {msg.images.map((img) => (
                      <div
                        key={img.id}
                        className="relative rounded-xl overflow-hidden border border-white/20 max-w-[200px] max-h-[160px] bg-black/40"
                      >
                        <img
                          src={img.data}
                          alt={img.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[10px] text-white truncate">
                          📷 {img.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Attached Docs Sent by User */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {msg.attachments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2 bg-black/30 border border-white/20 px-3 py-1.5 rounded-xl text-xs"
                      >
                        <Paperclip className="h-3.5 w-3.5 text-emerald-300" />
                        <span className="font-semibold">{doc.name}</span>
                        <span className="text-[10px] opacity-70">({doc.size})</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Text body */}
                <div className="whitespace-pre-wrap select-text font-sans">
                  {msg.text}
                </div>

                {/* DOCUMENT ARTIFACT CARD (Emitted Official Document) */}
                {msg.documentArtifact && (
                  <div className="mt-4 bg-slate-950/90 border border-emerald-500/50 rounded-xl p-4 shadow-xl text-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div>
                          <h4 className="font-bold text-xs sm:text-sm text-white">
                            {msg.documentArtifact.title}
                          </h4>
                          <span className="text-[10px] text-emerald-400 font-mono uppercase">
                            {msg.documentArtifact.type} • Pronto para Emissão Oficial
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.documentArtifact!.content, `doc-${msg.id}`)}
                          className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          title="Copiar texto do documento"
                        >
                          {copiedId === `doc-${msg.id}` ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          <span className="hidden sm:inline">
                            {copiedId === `doc-${msg.id}` ? "Copiado" : "Copiar"}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePrint(msg.documentArtifact!.content)}
                          className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          title="Imprimir Documento"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Imprimir</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExportPDF(msg.documentArtifact!)}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all cursor-pointer"
                          title="Descarregar PDF Oficial"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Descarregar PDF</span>
                        </button>
                      </div>
                    </div>

                    {/* Document preview snippet */}
                    <div className="mt-3 max-h-56 overflow-y-auto bg-slate-900/90 border border-slate-800/80 rounded-lg p-3 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {msg.documentArtifact.content}
                    </div>
                  </div>
                )}

                {/* Grounding Web Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-700/60 text-xs">
                    <span className="font-semibold text-blue-400 flex items-center gap-1.5 mb-1.5">
                      <Globe className="h-3.5 w-3.5" />
                      Fontes e Jurisprudência Web Investigada:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((s, idx) => (
                        <a
                          key={idx}
                          href={s.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-slate-900/90 hover:bg-slate-950 text-blue-300 hover:text-blue-200 px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1 text-[11px] transition-colors"
                        >
                          <span className="truncate max-w-[180px]">{s.title}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer bar */}
                <div className="mt-2.5 flex items-center justify-between text-[11px] opacity-70">
                  <span>{msg.timestamp}</span>
                  {msg.role === "model" && (
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.text, msg.id)}
                      className="hover:text-white flex items-center gap-1 text-slate-300 transition-colors"
                      title="Copiar mensagem"
                    >
                      {copiedId === msg.id ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span>{copiedId === msg.id ? "Copiado" : "Copiar"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* User Avatar on right */}
              {msg.role === "user" && (
                <div className="h-9 w-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-md">
                  {loggedUser.nome.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 items-start animate-fade-in">
              <div className="h-9 w-9 rounded-xl bg-slate-950 border border-emerald-500/40 p-1 flex items-center justify-center shrink-0">
                <img
                  src="/modulos/87-ia-ativa.png"
                  alt="IA Ativa"
                  className="w-full h-full object-contain animate-pulse"
                />
              </div>
              <div className="bg-slate-800/90 border border-slate-700 rounded-2xl rounded-tl-none p-4 text-xs text-emerald-300 flex items-center gap-2.5 shadow-md">
                <Sparkles className="h-4 w-4 animate-spin text-emerald-400" />
                <span>O Gemini está a analisar o pedido, a investigar a legislação e a formular a resposta...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ==================================================================== */}
        {/* GEMINI BOTTOM INPUT BAR & ATTACHMENT TRAY */}
        {/* ==================================================================== */}
        <div className="bg-slate-950 p-3 sm:p-4 border-t border-slate-800 shrink-0">
          
          {/* Quick Prompt Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
              <Zap className="h-3 w-3 text-amber-400" /> Sugestões:
            </span>
            {quickPrompts.map((item, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSendMessage(item.prompt)}
                disabled={isLoading}
                className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-full border border-slate-800 hover:border-emerald-500/40 shrink-0 transition-all cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Pending Attachments Preview Tray */}
          {(attachedImages.length > 0 || attachedDocs.length > 0) && (
            <div className="flex flex-wrap gap-2 mb-2.5 p-2 bg-slate-900/90 rounded-xl border border-slate-800 animate-fade-in">
              {attachedImages.map((img) => (
                <div
                  key={img.id}
                  className="relative group rounded-lg overflow-hidden border border-emerald-500/50 w-16 h-16 bg-black"
                >
                  <img src={img.data} alt={img.name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setAttachedImages((prev) => prev.filter((i) => i.id !== img.id))}
                    className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 opacity-90 hover:opacity-100"
                    title="Remover fotografia"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {attachedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-1.5 bg-slate-800 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs"
                >
                  <Paperclip className="h-3 w-3 text-emerald-400" />
                  <span className="truncate max-w-[120px]">{doc.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachedDocs((prev) => prev.filter((d) => d.id !== doc.id))}
                    className="text-slate-400 hover:text-red-400 ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Traditional Gemini Style Input Box */}
          <div className="relative flex items-end gap-2 bg-slate-900 border border-slate-750 focus-within:border-emerald-500/80 rounded-2xl p-2 sm:p-2.5 shadow-inner transition-colors">
            
            {/* Hidden Unified File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUnifiedUpload}
              accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.odt"
              multiple
              className="hidden"
            />

            {/* Upload Action Button (Single Clip Icon for all formats & photos) */}
            <div className="flex items-center gap-1 pb-1">
              <button
                type="button"
                id="btn-gemini-attach-file"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Anexar Ficheiros, Documentos ou Fotografias"
              >
                <Paperclip className="h-5 w-5" />
              </button>
            </div>

            {/* Multiline Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Escreva uma mensagem, solicite um parecer, minuta ou relatório ao Gemini..."
              className="flex-1 bg-transparent text-slate-100 text-sm focus:outline-none resize-none py-1.5 px-1 max-h-[160px] placeholder:text-slate-500"
            />

            {/* Send Button */}
            <div className="pb-0.5">
              <button
                type="button"
                id="btn-gemini-send-message"
                onClick={() => handleSendMessage()}
                disabled={(!inputText.trim() && attachedImages.length === 0 && attachedDocs.length === 0) || isLoading}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-bold p-2.5 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center"
                title="Enviar ao Gemini"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Subtext info */}
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 px-1">
            <span>O Gemini pode pesquisar na web em tempo real e emitir minutas oficiais em PDF.</span>
            <span>Shift + Enter para nova linha</span>
          </div>
        </div>

      </div>
    </div>
  );
}
