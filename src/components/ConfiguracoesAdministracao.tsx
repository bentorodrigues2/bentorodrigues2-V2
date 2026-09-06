import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import { Predio, LoggedUser, Documento, Movimento, Fracao } from "../types";
import { downloadBlob, exportToXLS, addPdfHeaderWithLogo } from "../utils";
import { triggerSendReaction } from "./SendingReactionModal";
import { 
  Settings, Mail, Shield, Bell, ListTodo, FileDown, CheckCircle, 
  AlertTriangle, Play, RefreshCw, FileText, Check, Database, Sparkles, Trash2, ArrowRight
} from "lucide-react";

interface AuditLogEntry {
  id: string;
  timestamp: string;
  seccao: "Financeira" | "Documental" | "Perfis" | "Upload/Download" | "IA" | "Validação" | "Exportação" | "Intervenção" | "Ocorrência" | "Configuração";
  descricao: string;
  usuario: string;
  detalhes?: string;
}

export interface EmailTemplate {
  id: string;
  category: string;
  number: number;
  title: string;
  subject: string;
  body: string;
}

export const INITIAL_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "aviso_cobranca",
    category: "I. FINANÇAS",
    number: 1,
    title: "Aviso de Cobrança – Quota Mensal",
    subject: "Aviso de Cobrança – Quota Mensal",
    body: `Olá [Nome],

Informamos que se encontra disponível o Aviso de Cobrança referente à quota mensal do condomínio.

Detalhes: • Fração: [Fração] • Valor: [Valor] • Data de emissão: [Data] • Data limite de pagamento: [Data]

Pode consultar o documento AQUI.

Nota: Isento de IVA nos termos do art.º 9.º, nº 21 do CIVA.

Com os meus cumprimentos, [Assinatura Digital] O Administrador do Condomínio

Powered by CondoManager AI (logotipo monocromático discreto)`
  },
  {
    id: "recibo_pagamento",
    category: "I. FINANÇAS",
    number: 2,
    title: "Recibo de Pagamento",
    subject: "Recibo de Pagamento – Condomínio",
    body: `Olá [Nome],

Confirmamos a receção do pagamento referente à quota do condomínio.

Detalhes: • Fração: [Fração] • Valor pago: [Valor] • Data de pagamento: [Data] • Método: [Método]

O recibo oficial encontra-se disponível AQUI.

Com os meus cumprimentos, [Assinatura Digital] O Administrador do Condomínio

Powered by CondoManager AI`
  },
  {
    id: "aviso_divida",
    category: "I. FINANÇAS",
    number: 3,
    title: "Aviso de Dívida Acumulada",
    subject: "Aviso de Dívida Acumulada – Condomínio",
    body: `Olá [Nome],

Verificamos que existem valores em atraso referentes às quotas do condomínio.

Resumo da dívida: • Meses em atraso: [X] • Valor total: [Valor]

Pode consultar o documento detalhado AQUI.

Com os meus cumprimentos, [Assinatura Digital] O Administrador do Condomínio

Powered by CondoManager AI`
  },
  {
    id: "declaracao_divida",
    category: "II. DOCUMENTOS OFICIAIS",
    number: 4,
    title: "Declaração de Dívida",
    subject: "Declaração de Dívida – Condomínio",
    body: `Olá [Nome],

Segue em anexo a Declaração de Dívida referente à sua fração, emitida pela Administração.

O documento oficial encontra-se disponível AQUI.

Com os meus cumprimentos, [Assinatura Digital] O Administrador do Condomínio

Powered by CondoManager AI`
  },
  {
    id: "declaracao_nao_divida",
    category: "II. DOCUMENTOS OFICIAIS",
    number: 5,
    title: "Declaração de Não Dívida",
    subject: "Declaração de Não Dívida – Condomínio",
    body: `Olá [Nome],

Segue em anexo a Declaração de Não Dívida referente à sua fração.

Pode consultar o documento oficial AQUI.

Com os meus cumprimentos, [Assinatura Original] O Administrador do Condomínio

Powered by CondoManager AI`
  },
  {
    id: "declaracao_escritura",
    category: "II. DOCUMENTOS OFICIAIS",
    number: 6,
    title: "Declaração para Escritura",
    subject: "Declaração para Escritura – Condomínio",
    body: `Olá [Nome],

Segue em anexo a Declaração para Escritura da sua fração, com assinatura digital e QR de verificação.

O documento encontra-se disponível AQUI.

Com os meus cumprimentos, [Assinatura Digital] O Administrador do Condomínio

Powered by CondoManager AI`
  },
  {
    id: "confirmacao_reserva",
    category: "III. ESPAÇOS COMUNS",
    number: 7,
    title: "Confirmação de Reserva",
    subject: "Confirmação de Reserva – Espaço Comum",
    body: `Olá [Nome],

A sua reserva foi confirmada.

Detalhes: • Espaço: [Espaço] • Data: [Data] • Horário: [Horário] • Extras selecionados: [Lista]

O comprovativo encontra-se disponível AQUI.

Com os meus cumprimentos, [Assinatura Digital] O Administrador do Condomínio

Powered by CondoManager AI`
  },
  {
    id: "cancelamento_reserva",
    category: "III. ESPAÇOS COMUNS",
    number: 8,
    title: "Cancelamento de Reserva",
    subject: "Cancelamento de Reserva – Espaço Comum",
    body: `Olá [Nome],

A sua reserva foi cancelada.

Motivo: [Motivo]

Pode consultar o documento associado AQUI.

Com os meus cumprimentos, [Assinatura Digital] O Administrador do Condomínio

Powered by CondoManager AI`
  },
  {
    id: "convocatoria_assembleia",
    category: "IV. ASSEMBLEIAS",
    number: 9,
    title: "Convocatória – Assembleia de Condóminos",
    subject: "Convocatória – Assembleia de Condóminos",
    body: `Olá [Nome],

A assembleia de condóminos foi agendada.

Data: [Data] Local: [Local] Ordem de trabalhos: [Lista]

A convocatória oficial encontra-se disponível AQUI.

Com os meus cumprimentos, [Assinatura Digital] O Administrador do Condomínio

Powered by CondoManager AI`
  },
  {
    id: "recuperacao_password",
    category: "V. SISTEMA (apenas os essenciais)",
    number: 10,
    title: "Recuperação de Password",
    subject: "Recuperação de Acesso – Condomínio",
    body: `Olá [Nome],

Foi solicitado um pedido de recuperação de acesso. Clique AQUI para definir uma nova password.

Com os meus cumprimentos, O Administrador do Condomínio

Powered by CondoManager AI`
  },
  {
    id: "confirmacao_conta",
    category: "V. SISTEMA (apenas os essenciais)",
    number: 11,
    title: "Confirmação de Conta",
    subject: "Confirmação de Conta – Condomínio",
    body: `Olá [Nome],

A sua conta foi criada com sucesso. Pode aceder à sua área pessoal AQUI.

Com os meus cumprimentos, O Administrador do Condomínio

Powered by CondoManager AI`
  }
];

interface ConfiguracoesAdministracaoProps {
  predio: Predio;
  onUpdatePredio?: (updated: Predio) => void;
  loggedUser: LoggedUser;
  documentos: Documento[];
  movimentos: Movimento[];
  fracoes: Fracao[];
  activeSubSection: "gerais" | "ia" | "notificacoes" | "logs" | "exportacao";
  setActiveSubSection: (sub: any) => void;
  onAddDocumento?: (novoDoc: Documento) => void;
}

export function ConfiguracoesAdministracao({
  predio,
  onUpdatePredio,
  loggedUser,
  documentos,
  movimentos,
  fracoes,
  activeSubSection,
  setActiveSubSection,
  onAddDocumento
}: ConfiguracoesAdministracaoProps) {
  
  // State for general settings
  const [nomePredio, setNomePredio] = useState(predio.nome || "");
  const [morada, setMorada] = useState(predio.morada_linha1 || "");
  const [numPorta, setNumPorta] = useState(predio.num_porta || "");
  const [localidade, setLocalidade] = useState(predio.localidade || "");
  const [nif, setNif] = useState(predio.nif || "");

  // State for AI configuration (email)
  const [adminEmail, setAdminEmail] = useState(() => {
    return localStorage.getItem(`admin_email_ia_${predio.id_predio}`) || "CPSN_RuaBentoRodrigues8@gmail.com";
  });
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  // Sincronizador de Caixa de Entrada & Autoresponder
  const [syncEmailActive, setSyncEmailActive] = useState<boolean>(() => {
    const saved = localStorage.getItem(`sync_email_active_${predio.id_predio}`);
    return saved !== null ? saved === "true" : true;
  });

  const [autoresponderMode, setAutoresponderMode] = useState<"confirmacao_previa" | "totalmente_autonomo">(() => {
    const saved = localStorage.getItem(`autoresponder_mode_${predio.id_predio}`);
    return (saved as any) || "confirmacao_previa";
  });

  const [syncInterval, setSyncInterval] = useState<string>(() => {
    return localStorage.getItem(`sync_interval_${predio.id_predio}`) || "5";
  });

  const [autoArchiveActive, setAutoArchiveActive] = useState(true);
  const [autoNotifyActive, setAutoNotifyActive] = useState(true);
  const [autoSendReceiptAfterConfirm, setAutoSendReceiptAfterConfirm] = useState(true);

  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(() => {
    return localStorage.getItem(`last_sync_time_${predio.id_predio}`) || "Hoje às " + new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  });

  const [simulationState, setSimulationState] = useState<{
    status: "idle" | "reading" | "recognized" | "confirmed";
    docName?: string;
    fracao?: string;
    valor?: number;
    condomino?: string;
  }>({ status: "idle" });

  // States for notifications
  const [notifOcorrencia, setNotifOcorrencia] = useState(true);
  const [notifFinanceiro, setNotifFinanceiro] = useState(true);
  const [notifVistorias, setNotifVistorias] = useState(true);
  const [notifCanalEmail, setNotifCanalEmail] = useState(true);
  const [notifCanalPush, setNotifCanalPush] = useState(true);
  const [notifCanalSMS, setNotifCanalSMS] = useState(true);

  // Activity logs state (limpo para testes com Supabase)
  const [logs, setLogs] = useState<AuditLogEntry[]>(() => {
    const saved = localStorage.getItem(`system_activity_logs_${predio.id_predio}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return [];
  });

  const [logSearch, setLogSearch] = useState("");
  const [logFilter, setLogFilter] = useState<string>("Todas");

  // Sub-tabs for Configurações de IA & Email
  const [iaActiveSubTab, setIaActiveSubTab] = useState<"modelos" | "config">("modelos");

  // Email Templates State with Persistence
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>(() => {
    const saved = localStorage.getItem(`condomanager_email_templates_${predio.id_predio}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return INITIAL_EMAIL_TEMPLATES;
  });

  // Selected template state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("aviso_cobranca");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("All");
  
  // States for the active editing template
  const activeTemplate = emailTemplates.find(t => t.id === selectedTemplateId) || emailTemplates[0];
  const [editedSubject, setEditedSubject] = useState(activeTemplate?.subject || "");
  const [editedBody, setEditedBody] = useState(activeTemplate?.body || "");
  const [previewFractionId, setPreviewFractionId] = useState(fracoes[0]?.id_fracao || "fr-1");

  // Update editor values when selected template changes
  useEffect(() => {
    if (activeTemplate) {
      setEditedSubject(activeTemplate.subject);
      setEditedBody(activeTemplate.body);
    }
  }, [selectedTemplateId]);

  // Method to save template changes
  const handleSaveTemplate = () => {
    const updated = emailTemplates.map(t => {
      if (t.id === selectedTemplateId) {
        return { ...t, subject: editedSubject, body: editedBody };
      }
      return t;
    });
    setEmailTemplates(updated);
    localStorage.setItem(`condomanager_email_templates_${predio.id_predio}`, JSON.stringify(updated));
    addLog("Configuração", "Atualização de Modelo de Email", `Modelo editado: ${activeTemplate?.title}`);
    alert(`Modelo de e-mail "${activeTemplate?.title}" atualizado com sucesso!`);
  };

  // Method to reset template changes
  const handleResetTemplate = () => {
    const original = INITIAL_EMAIL_TEMPLATES.find(t => t.id === selectedTemplateId);
    if (original) {
      setEditedSubject(original.subject);
      setEditedBody(original.body);
      const updated = emailTemplates.map(t => {
        if (t.id === selectedTemplateId) {
          return { ...t, subject: original.subject, body: original.body };
        }
        return t;
      });
      setEmailTemplates(updated);
      localStorage.setItem(`condomanager_email_templates_${predio.id_predio}`, JSON.stringify(updated));
      addLog("Configuração", "Restauro de Modelo de Email", `Modelo restaurado: ${activeTemplate?.title}`);
      alert(`Modelo "${activeTemplate?.title}" restaurado para o padrão oficial!`);
    }
  };

  // Method to simulate send
  const handleSimulateSend = () => {
    const fraction = fracoes.find(f => f.id_fracao === previewFractionId) || fracoes[0];
    const targetName = fraction ? fraction.proprietario.nome : "Condómino";
    const targetEmail = fraction ? fraction.proprietario.email : "condomino@email.com";
    
    addLog("IA", `Simulação de Envio de Email`, `Enviado "${activeTemplate?.title}" para ${targetName} (${targetEmail})`);
    triggerSendReaction("email", `E-mail para ${targetName} (${targetEmail})`);
  };

  // Save logs to localStorage on change
  useEffect(() => {
    localStorage.setItem(`system_activity_logs_${predio.id_predio}`, JSON.stringify(logs));
  }, [logs, predio.id_predio]);

  // Method to insert logs
  const addLog = (seccao: AuditLogEntry["seccao"], descricao: string, detalhes?: string) => {
    const newEntry: AuditLogEntry = {
      id: "act-" + Date.now(),
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      seccao,
      descricao,
      usuario: loggedUser.nome,
      detalhes
    };
    setLogs(prev => [newEntry, ...prev]);
  };

  const getTemplatePreview = (subject: string, body: string, fractionId: string) => {
    const fraction = (fracoes.find(f => f.id_fracao === fractionId) || fracoes[0]) as any;
    
    let renderedSubject = subject;
    let renderedBody = body;
    
    // Replace standard placeholders
    const replacements: Record<string, string> = {
      "\\[Nome\\]": fraction?.proprietario?.nome || "Condómino",
      "\\[Fração\\]": fraction?.fracao_nome || "A",
      "\\[Valor\\]": "54,20 €",
      "\\[Data\\]": "19/07/2026",
      "\\[Método\\]": "Multibanco (Entidade: 21800, Referência: 123 456 789)",
      "\\[X\\]": "3 meses",
      "\\[Espaço\\]": "Sala de Condomínio",
      "\\[Horário\\]": "14:00 - 18:00",
      "\\[Extras selecionados\\]": "Limpeza extra (15,00 €)",
      "\\[Lista\\]": "• Limpeza e manutenção\n• Pintura do hall",
      "\\[Motivo\\]": "Cancelamento solicitado pelo condómino por motivos imprevistos.",
      "\\[Local\\]": `Morada do Prédio (${predio.morada_linha1}, Nº ${predio.num_porta || ""}, ${predio.localidade})`,
      "\\[Assinatura Digital\\]": "🔒 Assinado Digitalmente por CondoManager Admin Key",
      "AQUI": "👉 [CLIQUE AQUI PARA ACEDER]"
    };
    
    Object.entries(replacements).forEach(([placeholder, val]) => {
      const regex = new RegExp(placeholder, "g");
      renderedSubject = renderedSubject.replace(regex, val);
      renderedBody = renderedBody.replace(regex, val);
    });
    
    return { subject: renderedSubject, body: renderedBody, recipient: fraction.proprietario || { nome: "Condómino", email: "condomino@email.com" } };
  };

  // Validate IA Administration Email according to strict rules in DOCUMENTO D
  const handleSaveEmailIA = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);

    // Rule 1: Must be a valid email structure
    if (!adminEmail.includes("@") || !adminEmail.includes(".")) {
      setEmailError("O email inserido não é válido. Deve conter um '@' e um domínio.");
      return;
    }

    const localPart = adminEmail.split("@")[0];

    // Rule 2: No accents (sem acentos)
    const hasAccents = /[áàâãéèêíóòôõúùûç]/i.test(adminEmail);
    if (hasAccents) {
      setEmailError("Regra Violada: O email não pode conter acentos (sem acentos).");
      return;
    }

    // Rule 3: No spaces (sem espaços)
    if (adminEmail.includes(" ")) {
      setEmailError("Regra Violada: O email não pode conter espaços (sem espaços).");
      return;
    }

    // Rule 4: Number of building/street at the end of the local part (número do prédio no final)
    const matchesEndWithNum = /[0-9]$/.test(localPart);
    if (!matchesEndWithNum) {
      setEmailError("Regra Violada: O email deve terminar com o número do prédio/porta antes do @ (ex: BentoRodrigesPP2@gmail.com).");
      return;
    }

    // If validations pass
    localStorage.setItem(`admin_email_ia_${predio.id_predio}`, adminEmail);
    setEmailSuccess("Email da Administração para integração de IA configurado e homologado com sucesso!");
    addLog("Configuração", "Atualização do email de integração com a IA", `Novo email oficial registado: ${adminEmail}`);
  };

  const handleToggleSyncEmail = (active: boolean) => {
    setSyncEmailActive(active);
    localStorage.setItem(`sync_email_active_${predio.id_predio}`, String(active));
    addLog("IA", "Sincronizador de Caixa de Entrada", active ? "Sincronização de e-mails ativada." : "Sincronização de e-mails pausada.");
  };

  const handleSelectAutoresponderMode = (mode: "confirmacao_previa" | "totalmente_autonomo") => {
    setAutoresponderMode(mode);
    localStorage.setItem(`autoresponder_mode_${predio.id_predio}`, mode);
    addLog("IA", "Modo Auto-Responder", `Configurado para: ${mode === "confirmacao_previa" ? "Confirmação Prévia pelo Administrador" : "Totalmente Autónomo"}`);
  };

  const handleSyncNow = () => {
    setIsSyncingNow(true);
    setTimeout(() => {
      const nowStr = "Hoje às " + new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(nowStr);
      localStorage.setItem(`last_sync_time_${predio.id_predio}`, nowStr);
      setIsSyncingNow(false);
      addLog("IA", "Varredura da Caixa de Entrada", "Caixa de correio sincronizada com sucesso. 0 pendências críticas.");
      alert("✅ Sincronização concluída! A caixa de entrada está em dia e a IA está a monitorizar novas faturas e comprovativos.");
    }, 1200);
  };

  const handleRunSimulation = () => {
    setSimulationState({ status: "reading" });
    setTimeout(() => {
      setSimulationState({
        status: "recognized",
        docName: "Comprovativo_Transf_Quota_Setembro.pdf",
        fracao: fracoes[0]?.id_fracao || "Fração A",
        valor: 45.00,
        condomino: fracoes[0]?.proprietario?.nome || "Maria Silva"
      });
      addLog("IA", "Leitura de Comprovativo por E-mail", `Documento recebido para a fração ${fracoes[0]?.id_fracao || "A"}: 45,00 €. Aguarda confirmação.`);
    }, 1200);
  };

  const handleConfirmSimulation = () => {
    if (onAddDocumento && simulationState.docName) {
      onAddDocumento({
        id_doc: `doc-recibo-${Date.now()}`,
        id_predio: predio.id_predio,
        nome: `Recibo de Quota - ${simulationState.fracao}`,
        tipo: "PDF",
        tamanho: "124 KB",
        data_upload: new Date().toISOString().split("T")[0],
        categoria: "Recibos",
        tema: "Contabilidade",
        sub_pasta: "Recibos e Quotas",
        visibilidade: "Público",
        arquivado: true
      });
    }
    setSimulationState({ ...simulationState, status: "confirmed" });
    addLog("Financeira", "Confirmação de Pagamento & Emissão de Recibo", `Recibo oficial emitido e enviado automaticamente por e-mail para ${simulationState.condomino}.`);
    alert(`🎉 Pagamento confirmado com sucesso! O Recibo Oficial foi arquivado e enviado por e-mail para ${simulationState.condomino}.`);
  };

  // Handle general settings submission
  const handleSaveGerais = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdatePredio) {
      const updated = {
        ...predio,
        nome: nomePredio,
        morada_linha1: morada,
        num_porta: numPorta,
        localidade: localidade,
        nif: nif
      };
      onUpdatePredio(updated);
      alert("Configurações Gerais gravadas e atualizadas com sucesso!");
      addLog("Configuração", "Gravação de parâmetros gerais do condomínio", `NIF: ${nif}, Nome: ${nomePredio}`);
    }
  };

  // Exportação Inteligente backup
  const handleExportBackup = (type: "total" | "parcial", filter?: string) => {
    const backupData = {
      sistema: "CondoManager AI Platform 2026",
      tipo_backup: type,
      modulo_filtro: filter || "Todos os Módulos",
      data_exportacao: new Date().toISOString(),
      predio: predio,
      frações_total: fracoes.length,
      documentos_total: documentos.length,
      movimentos_total: movimentos.length,
      fraçoes: fracoes,
      movimentos: movimentos,
      logs_auditoria: logs
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    downloadBlob(blob, `CondoManager_Backup_${type}_${predio.id_predio}_${Date.now()}.json`);
    addLog("Exportação", `Exportação de Backup (${type.toUpperCase()})`, `Ficheiros exportados: ${filter || "Todos"}`);
  };

  // Exportação Manual Editável / PDF
  const handleExportManualDocument = (format: "pdf" | "doc") => {
    const title = `Manual Completo de Perfis, Menus e Funcionalidades - CondoManager AI`;
    const contentHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #1e293b; line-height: 1.6; }
          h1 { color: #047857; font-size: 20px; border-bottom: 2px solid #047857; padding-bottom: 8px; }
          h2 { color: #0f172a; font-size: 15px; margin-top: 24px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
          p, li { font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          th { background-color: #f1f5f9; font-weight: bold; color: #0f172a; }
          .badge { background-color: #d1fae5; color: #065f46; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
          .header-box { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h1 style="margin:0 0 8px 0;">🛡️ CONDOMANAGER AI - MANUAL DE PERFIS, MENUS & CAPACIDADES</h1>
          <p style="margin:0;"><strong>Prédio:</strong> ${predio.nome} | <strong>Data de Emissão:</strong> ${new Date().toLocaleDateString('pt-PT')} | <strong>Versão:</strong> Platform 2026.1 (Web Browser & PWA)</p>
        </div>

        <h2>1. ESTRUTURA DE MENUS E SUB-MENUS (COLUNA CENTRAL WEBSITE & PWA)</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Menu Principal (Coluna Central)</th>
              <th>Sub-menus Dinâmicos Integrados</th>
              <th>Finalidade & Ações Disponíveis</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td><strong>🏢 Prédio & Frações</strong></td>
              <td>• Gestão do Prédio & Regras<br>• Gestão de Frações & Residentes<br>• Portal de Condóminos & Inquilinos</td>
              <td>Registo de frações, permilagens, identificação de condóminos, inquilinos, envio de convites e regulamento do prédio.</td>
            </tr>
            <tr>
              <td>2</td>
              <td><strong>💰 Finanças & Contas</strong></td>
              <td>• Saldos & Extrato de Movimentos<br>• Contas Bancárias do Condomínio<br>• Emissão de Quotas & Recibos<br>• Fundo de Reserva Comum<br>• Conciliação Bancária com IA</td>
              <td>Controlo financeiro total, extratos de conta bancária, emissão de quotas com referência MB/MBWAY, gestão de poupança e reconciliação automática de extratos via IA.</td>
            </tr>
            <tr>
              <td>3</td>
              <td><strong>🏗️ Manutenção & Obras</strong></td>
              <td>• Gestão de Ocorrências & Avarias<br>• Agenda de Intervenções Técnicas<br>• Gestão de Obras Extraordinárias<br>• Vistorias Técnicas & Relatórios de Limpeza</td>
              <td>Registo de avarias com fotografias WebP, agendamento de técnicos, controlo de orçamentos de obras e folhas de vistoria/limpeza digital.</td>
            </tr>
            <tr>
              <td>4</td>
              <td><strong>📁 Arquivo Digital</strong></td>
              <td>• Arquivo Organizado (Anos / Temas / Fornecedor)<br>• Auditoria Interna & Relatórios</td>
              <td>Repositório inteligente de documentos, atas, faturas, contratos e relatórios com botão de arquivamento com confirmação da IA.</td>
            </tr>
            <tr>
              <td>5</td>
              <td><strong>⚖️ Assembleias & Legal</strong></td>
              <td>• Gestão & Organização de Assembleias<br>• Contencioso Jurídico & Litígios<br>• Consultadoria Legal & Regulamento</td>
              <td>Convocatórias, lavratura automática de atas com IA, acompanhamento de dívidas em contencioso (ex: Fração D) e pareceres jurídicos.</td>
            </tr>
            <tr>
              <td>6</td>
              <td><strong>📢 Comunicação & IA</strong></td>
              <td>• Alerta Push Geral & Avisos<br>• Central de Inteligência Artificial Avançada</td>
              <td>Envio de notificações push para telemóveis, minutas de emails, assistente virtual inteligente para responder a questões do prédio.</td>
            </tr>
            <tr>
              <td>7</td>
              <td><strong>🛠️ Fornecedores & Orçamentos</strong></td>
              <td>• Fichas de Fornecedores & Contratos<br>• Portal de Orçamentos de Fornecedores</td>
              <td>Base de dados de empresas prestadoras de serviço, contratos de manutenção e consultas ao mercado para novos orçamentos.</td>
            </tr>
            <tr>
              <td>8</td>
              <td><strong>📝 Aprovações & Agenda</strong></td>
              <td>• Gestão & Aprovação de Reservas<br>• Emissão & Validação de Recibos</td>
              <td>Validação de reservas de salão de festas/churrasqueira feitas por condóminos e conferência de recibos emitidos.</td>
            </tr>
            <tr>
              <td>9</td>
              <td><strong>⚙️ Empresa Gestora & Parâmetros</strong></td>
              <td>• Ficha da Empresa Gestora (White-Label)<br>• Configurações Gerais do Condomínio<br>• Configurações de IA & Notificações Push</td>
              <td>Personalização da marca (logótipo e cores), parâmetros de cálculo, templates de email e logs de auditoria inalterável.</td>
            </tr>
          </tbody>
        </table>

        <h2>2. MATRIZ DE ATRIBUIÇÃO DE FUNÇÕES POR PERFIL (BROWSER E PWA)</h2>
        <table>
          <thead>
            <tr>
              <th>Perfil Utilizador</th>
              <th>Acesso Browser (Website Desktop)</th>
              <th>Acesso PWA (Aplicação Mobile)</th>
              <th>Permissões & Restrições</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>🛡️ Administrador / Empresa Gestora</strong></td>
              <td>Acesso total aos 9 menus centrais, painéis financeiros, arquivo digital, parametrização e auditoria.</td>
              <td>Dashboard bento de 9 cartões principais com abertura de sub-menus popups. Acesso total a todas as vertentes.</td>
              <td><span class="badge">Acesso Total</span> Leitura, escrita, edição, eliminação, exportação e aprovação.</td>
            </tr>
            <tr>
              <td><strong>🏠 Condómino / Inquilino</strong></td>
              <td>Consulta de frações próprias, saldo pendente, atas públicas, avisos gerais, pedido de reservas e reporte de avarias.</td>
              <td>Ecrã simplificado com saldo pessoal, quotas pendentes/pagas, botão MB WAY, reporte rápido de defeitos e reservas.</td>
              <td><span class="badge" style="background:#e0f2fe;color:#0369a1;">Restrito Pessoal</span> Apenas visualiza os seus dados, documentos públicos do condomínio e as suas frações.</td>
            </tr>
            <tr>
              <td><strong>🔧 Técnico de Manutenção</strong></td>
              <td>Gestão de ocorrências, vistorias técnicas, checklists de equipamentos e histórico de intervenções.</td>
              <td>Cards dedicados: Vistoria Checklist, Captura de Fotos, Histórico de Vistorias e Reporte de Defeito.</td>
              <td><span class="badge" style="background:#fef3c7;color:#92400e;">Especializado</span> Focado estritamente em manutenção, vistorias e relatórios técnicos.</td>
            </tr>
            <tr>
              <td><strong>🧼 Equipa de Limpezas</strong></td>
              <td>Registo de higienização de áreas comuns, folha digital e reporte de anomalias encontradas.</td>
              <td>Cards dedicados: Folha Digital de Limpeza, Inspeção de Áreas e Reporte de Avaria.</td>
              <td><span class="badge" style="background:#fef3c7;color:#92400e;">Especializado</span> Focado estritamente nas tarefas de higienização e conservação de halls.</td>
            </tr>
            <tr>
              <td><strong>⚖️ Apoio Jurídico</strong></td>
              <td>Módulo de Contencioso, cobrança extrajudicial/judicial de quotas em atraso, redação de regulamentos e pareceres.</td>
              <td>Cards dedicados: Contencioso & Litígios e Consultadoria Legal.</td>
              <td><span class="badge" style="background:#f3e8ff;color:#6b21a8;">Jurídico</span> Acesso a dados de devedores, atas, minutas e regulamento interno.</td>
            </tr>
            <tr>
              <td><strong>🔎 Auditor Externo</strong></td>
              <td>Consulta de extratos bancários, validação de faturas, verificação de conciliação e inserção de pareceres de auditoria.</td>
              <td>Cards dedicados: Relatórios de Auditoria e Inserção de Parecer Oficial.</td>
              <td><span class="badge" style="background:#f1f5f9;color:#334155;">Auditoria</span> Leitura financeira integral e emissão de pareceres oficiais.</td>
            </tr>
            <tr>
              <td><strong>📊 Contabilista</strong></td>
              <td>Gestão de contas bancárias, lançamento de despesas/faturas, emissão de recibos e balancetes.</td>
              <td>Cards dedicados: Saldos Bancários, Extratos & Conciliação e Lançamento de Faturas.</td>
              <td><span class="badge" style="background:#ecfdf5;color:#047857;">Financeiro</span> Operação de contas, lançamentos e conciliação contabilística.</td>
            </tr>
          </tbody>
        </table>

        <h2>3. RECURSOS INOVADORES & FUNCIONALIDADES IMPLEMENTADAS</h2>
        <ul>
          <li><strong>Assinatura Digital de Atas via PWA (Ativo):</strong> Recolha de assinaturas digitais diretamente no ecrã tátil do telemóvel dos condóminos para validação jurídica instantânea de atas.</li>
          <li><strong>Leitura OCR de Faturas por IA (Ativo):</strong> Leitura ótica de faturas com extração automática de NIF, Valor, Fornecedor e Data de Vencimento, com arquivamento no Arquivo Digital e lançamento automático nos Movimentos Financeiros após confirmação.</li>
          <li><strong>Notificações Web Push PWA (Ativo):</strong> Notificações em tempo real enviadas diretamente para o dispositivo móvel do utilizador para lembretes de quotas, avisos e convocatórias de assembleia.</li>
        </ul>
      </body>
      </html>
    `;

    if (format === "doc") {
      const blob = new Blob(['\ufeff', contentHtml], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Manual_Perfis_e_Menus_CondoManager_${predio.nome.replace(/\s+/g, '_')}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // Direct binary PDF generation via jsPDF for Adobe Acrobat Reader compatibility
      try {
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4"
        });

        let y = addPdfHeaderWithLogo(pdf);
        pdf.setTextColor(15, 23, 42);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.text(`Manual de Perfis, Menus e Capacidades - ${predio.nome}`, 14, y);
        y += 8;

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10.5);
        pdf.setTextColor(4, 120, 87);
        pdf.text("1. ESTRUTURA DOS MENUS OPERACIONAIS", 14, y);
        y += 6;

        const menusList = [
          "1. Prédio & Frações: Gestão do Prédio, Regras, Frações & Residentes, Inquilinos, Regulamento.",
          "2. Finanças & Contas: Saldos, Movimentos, Contas Bancárias, Quotas & MB WAY, Fundo de Reserva, Conciliação IA.",
          "3. Manutenção & Obras: Ocorrências, Avarias, Agenda Técnica, Obras Extraordinárias, Vistorias & Limpeza.",
          "4. Arquivo Digital: Instruções PWA & Desktop, Anos, Temas, Fornecedor, Auditoria Interna & Relatórios.",
          "5. Assembleias & Legal: Organização de Assembleias, Atas com IA, Assinatura Digital PWA, Contencioso & Litígios.",
          "6. Comunicação & IA: Alerta Push Geral, Avisos e Central de Inteligência Artificial Avançada.",
          "7. Fornecedores & Orçamentos: Fichas de Fornecedores, Contratos de Manutenção e Portal de Orçamentos.",
          "8. Aprovações & Agenda: Aprovação de Reservas de Espaços Comuns e Validação de Recibos.",
          "9. Empresa Gestora & Parâmetros: White-Label, Configurações Gerais, Configurações de IA e Logs de Auditoria."
        ];

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(15, 23, 42);

        for (const item of menusList) {
          if (y > 270) { pdf.addPage(); y = 20; }
          const lines = pdf.splitTextToSize(item, 180);
          pdf.text(lines, 14, y);
          y += (lines.length * 4) + 2;
        }

        y += 4;
        if (y > 270) { pdf.addPage(); y = 20; }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10.5);
        pdf.setTextColor(4, 120, 87);
        pdf.text("2. PERFIS E NÍVEIS DE PERMISSÃO", 14, y);
        y += 6;

        const perfisList = [
          "• Administrador / Empresa Gestora: Controlo total, parametrização, white-label, aprovações.",
          "• Condómino / Inquilino: Consulta de frações, liquidação de quotas por MB WAY, atas e votações.",
          "• Técnico de Manutenção: Vistorias técnicas, checklists e registo de intervenções.",
          "• Equipa de Limpezas: Folha digital de limpeza e registo de ocorrências.",
          "• Apoio Jurídico: Gestão de contencioso, minutas de atas e pareceres.",
          "• Auditor Externo: Leitura financeira integral e pareceres de auditoria.",
          "• Contabilista: Gestão de contas bancárias, faturas e lançamentos."
        ];

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(15, 23, 42);

        for (const item of perfisList) {
          if (y > 270) { pdf.addPage(); y = 20; }
          const lines = pdf.splitTextToSize(item, 180);
          pdf.text(lines, 14, y);
          y += (lines.length * 4) + 2;
        }

        // Footer
        if (y > 265) { pdf.addPage(); y = 20; }
        pdf.setDrawColor(4, 120, 87);
        pdf.line(14, y, 196, y);
        y += 5;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(4, 120, 87);
        pdf.text("CONDOMANAGER AI - REGISTO CERTIFICADO E AUTENTICADO EM PDF", 105, y, { align: "center" });

        pdf.save(`Manual_Perfis_e_Menus_CondoManager_${predio.nome.replace(/\s+/g, '_')}_Oficial.pdf`);
      } catch (err) {
        console.error("Erro ao gerar PDF:", err);
      }
    }
  };

  return (
    <div className="space-y-6 text-slate-850 dark:text-slate-100 animate-fadeIn">
      
      {/* Tab Navigation header */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1.5 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveSubSection("gerais")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubSection === "gerais" 
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" 
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>Configurações Gerais</span>
        </button>

        <button
          onClick={() => setActiveSubSection("ia")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubSection === "ia" 
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" 
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <Mail className="h-4 w-4" />
          <span>Configurações de IA & Email</span>
        </button>

        <button
          onClick={() => setActiveSubSection("notificacoes")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubSection === "notificacoes" 
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" 
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <Bell className="h-4 w-4" />
          <span>Notificações</span>
        </button>

        <button
          onClick={() => setActiveSubSection("logs")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubSection === "logs" 
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" 
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <ListTodo className="h-4 w-4" />
          <span>Log de Sistema</span>
        </button>

        <button
          onClick={() => setActiveSubSection("exportacao")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubSection === "exportacao" 
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" 
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <FileDown className="h-4 w-4" />
          <span>Exportação & Backup</span>
        </button>
      </div>

      {/* ---------------- 1. CONFIGURAÇÕES GERAIS ---------------- */}
      {activeSubSection === "gerais" && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          {/* Banner de Acesso Direto ao Manual de Perfis, Menus e Capacidades */}
          <div className="bg-emerald-500/10 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded uppercase">Manual de Documentação</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Formato Editável & PDF</span>
              </div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">📖 Manual de Perfis, Menus e Matriz de Capacidades</h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">Descarregue o documento oficial com a estrutura de menus e permissões detalhada de todos os perfis do sistema.</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleExportManualDocument("doc")}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-lg text-xs cursor-pointer shadow flex items-center gap-1.5 transition-all"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>DOC Editável</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportManualDocument("pdf")}
                className="bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 font-bold px-3 py-2 rounded-lg text-xs cursor-pointer shadow flex items-center gap-1.5 transition-all"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span>PDF Oficial</span>
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Ficha Técnica e Definições do Edifício</h3>
            <p className="text-xs text-slate-500">Parâmetros operacionais e morada oficial do condomínio isolado no servidor.</p>
          </div>

          <form onSubmit={handleSaveGerais} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Nome do Condomínio</label>
                <input
                  type="text"
                  value={nomePredio}
                  onChange={e => setNomePredio(e.target.value)}
                  className="w-full border p-2.5 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Número de Contribuinte (NIF)</label>
                <input
                  type="text"
                  value={nif}
                  onChange={e => setNif(e.target.value)}
                  className="w-full border p-2.5 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Morada Principal</label>
                <input
                  type="text"
                  value={morada}
                  onChange={e => setMorada(e.target.value)}
                  className="w-full border p-2.5 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Número / Bloco</label>
                <input
                  type="text"
                  value={numPorta}
                  onChange={e => setNumPorta(e.target.value)}
                  className="w-full border p-2.5 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Localidade / Cidade</label>
                <input
                  type="text"
                  value={localidade}
                  onChange={e => setLocalidade(e.target.value)}
                  className="w-full border p-2.5 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-850 flex items-center justify-end gap-3">
              {loggedUser?.role === "ADMIN" && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Tem a certeza que deseja eliminar o prédio "${predio.nome}" do sistema?`)) {
                      const stored = localStorage.getItem("condo_predios");
                      if (stored) {
                        try {
                          const list = JSON.parse(stored);
                          const updated = list.filter((p: any) => p.id_predio !== predio.id_predio);
                          localStorage.setItem("condo_predios", JSON.stringify(updated));
                        } catch (err) {}
                      }
                      alert(`O prédio "${predio.nome}" foi removido com sucesso.`);
                      window.location.reload();
                    }
                  }}
                  className="border-2 border-red-500 bg-red-50 hover:bg-red-100 active:bg-red-200 active:scale-95 text-red-700 dark:text-red-300 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs hover:shadow-md active:ring-2 active:ring-red-400 select-none flex items-center gap-2"
                  title="Eliminar este prédio do sistema"
                >
                  <img src="/estados-acoes/14-eliminar.png" alt="Eliminar" className="h-5 w-5 object-contain" />
                  <span>Eliminar</span>
                </button>
              )}

              <button
                type="submit"
                className="border-2 border-emerald-500 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-md hover:shadow-lg active:ring-2 active:ring-emerald-400 select-none flex items-center gap-2"
                title="Gravar dados do prédio no sistema Condomanager AI"
              >
                <img src="/estados-acoes/12-adicionar.png" alt="Gravar" className="h-5 w-5 object-contain" />
                <span>Gravar</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------- 2. CONFIGURAÇÕES DE IA & EMAIL (LAYOUT CONDIO-MANAGER OFICIAL) ---------------- */}
      {activeSubSection === "ia" && (
        <div className="space-y-6">
          {/* Header Banner Oficial CondoManager */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm text-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">Central de IA & Automatização de E-mails</h3>
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Ativo</span>
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Gestão de modelos de e-mail oficiais com preenchimento dinâmico, caixa postal inteligente e integração do assistente IA.</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">

          {/* Sub-tabs switch */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 pb-px no-print">
            <button
              onClick={() => setIaActiveSubTab("modelos")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all border-b-2 cursor-pointer ${
                iaActiveSubTab === "modelos"
                  ? "border-emerald-500 bg-emerald-50/40 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/20"
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Modelos de E-mail Oficiais (11 Templates)</span>
            </button>
            <button
              onClick={() => setIaActiveSubTab("config")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all border-b-2 cursor-pointer ${
                iaActiveSubTab === "config"
                  ? "border-emerald-500 bg-emerald-50/40 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/20"
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Caixa de Entrada & Integração IA</span>
            </button>
          </div>

          {/* SUB-TAB 1: MODELOS DE EMAIL OFICIAIS */}
          {iaActiveSubTab === "modelos" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-4 rounded-xl text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                <p className="font-bold text-emerald-700 dark:text-emerald-400 mb-1">📢 Homologação de Modelos — Versão Oficial CondoManager AI</p>
                Os 11 modelos de e-mail abaixo cumprem rigorosamente os regulamentos de notificação do condomínio. Pode personalizar o assunto e o corpo de texto, mantendo as chaves dinâmicas entre parênteses retos (ex: <code className="bg-emerald-100 dark:bg-slate-900 px-1 py-0.5 rounded text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">[Nome]</code>, <code className="bg-emerald-100 dark:bg-slate-900 px-1 py-0.5 rounded text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">[Fração]</code>) para preenchimento dinâmico.
              </div>

              {/* Filter Categorias */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-print">
                {["All", "I. FINANÇAS", "II. DOCUMENTOS OFICIAIS", "III. ESPAÇOS COMUNS", "IV. ASSEMBLEIAS", "V. SISTEMA"].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      selectedCategoryFilter === cat
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750"
                    }`}
                  >
                    {cat === "All" ? "Todos os Modelos" : cat.replace(" (apenas os essenciais)", "")}
                  </button>
                ))}
              </div>

              {/* Grid layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left side: templates list */}
                <div className="lg:col-span-4 space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {emailTemplates
                    .filter(t => selectedCategoryFilter === "All" || t.category.startsWith(selectedCategoryFilter))
                    .map(t => {
                      const isSelected = t.id === selectedTemplateId;
                      return (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTemplateId(t.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 dark:border-emerald-500 ring-1 ring-emerald-500"
                              : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-850"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                              {t.number}
                            </span>
                            <div className="flex-grow min-w-0">
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{t.title}</h4>
                              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{t.category.replace(" (apenas os essenciais)", "")}</p>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 truncate font-mono">
                            Assunto: {t.subject}
                          </p>
                        </div>
                      );
                    })}
                </div>

                {/* Right side: Editor and Real-Time Preview */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* Editor section */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-850 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          Modelo {activeTemplate?.number} • {activeTemplate?.category}
                        </span>
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                          {activeTemplate?.title}
                        </h4>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleResetTemplate}
                          className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-250 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-750 transition-colors cursor-pointer"
                        >
                          Restaurar Original PDF
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveTemplate}
                          className="border-2 border-emerald-500 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 text-white text-[11px] font-bold px-4 py-1.5 rounded-xl shadow transition-all cursor-pointer flex items-center gap-1.5 active:ring-2 active:ring-emerald-400 select-none"
                        >
                          <img src="/estados-acoes/12-adicionar.png" alt="Gravar" className="h-3.5 w-3.5 object-contain" />
                          <span>Gravar</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Assunto do E-mail</label>
                        <input
                          type="text"
                          value={editedSubject}
                          onChange={e => setEditedSubject(e.target.value)}
                          className="w-full border dark:border-slate-800 p-2.5 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Corpo do E-mail (Texto)</label>
                        <textarea
                          rows={11}
                          value={editedBody}
                          onChange={e => setEditedBody(e.target.value)}
                          className="w-full border dark:border-slate-800 p-3 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-sans leading-relaxed focus:outline-none focus:border-purple-500 font-medium"
                        />
                      </div>
                    </div>

                    {/* Placeholders Guide */}
                    <div className="bg-white dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1.5">Variáveis Disponíveis neste Template:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {["[Nome]", "[Fração]", "[Valor]", "[Data]", "[Método]", "[X]", "[Espaço]", "[Horário]", "[Extras selecionados]", "[Lista]", "[Motivo]", "[Local]", "[Assinatura Digital]", "AQUI"].map(variable => {
                          const isIncluded = editedBody.includes(variable) || editedSubject.includes(variable);
                          return (
                            <span
                              key={variable}
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded transition-all ${
                                isIncluded
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40"
                                  : "bg-slate-100 text-slate-400 border border-transparent dark:bg-slate-800 dark:text-slate-500"
                              }`}
                              title={isIncluded ? "Usado no template" : "Não usado"}
                            >
                              {variable}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Real-time Email Preview */}
                  <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-850 overflow-hidden shadow-md">
                    <div className="bg-slate-50 dark:bg-slate-900 p-3 border-b border-slate-200 dark:border-slate-850 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                        <span className="text-[10px] font-extrabold text-slate-400 ml-1.5 uppercase tracking-wider">Visualização do Cliente de E-mail (Inbox)</span>
                      </div>
                      
                      {/* Interactive Fraction selector */}
                      <div className="flex items-center gap-1.5 no-print">
                        <label className="text-[10px] font-bold text-slate-500">Testar Fração:</label>
                        <select
                          value={previewFractionId}
                          onChange={e => setPreviewFractionId(e.target.value)}
                          className="bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 text-[11px] font-bold border rounded p-1"
                        >
                          {fracoes.map(f => (
                            <option key={f.id_fracao} value={f.id_fracao}>
                              {f.fracao_nome} — {f.proprietario.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Email headers */}
                      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 pb-3 border-b border-slate-100 dark:border-slate-850">
                        <p><strong className="text-slate-700 dark:text-slate-300">De:</strong> portal@condomanager.pt</p>
                        <p>
                          <strong className="text-slate-700 dark:text-slate-300">Para:</strong>{" "}
                          {getTemplatePreview(editedSubject, editedBody, previewFractionId).recipient.email}
                        </p>
                        <p>
                          <strong className="text-slate-700 dark:text-slate-300">Assunto:</strong>{" "}
                          <span className="text-slate-800 dark:text-slate-100 font-bold">
                            {getTemplatePreview(editedSubject, editedBody, previewFractionId).subject}
                          </span>
                        </p>
                      </div>

                      {/* Rendered Body */}
                      <div className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed min-h-[150px] p-2 bg-slate-50/50 dark:bg-slate-950/30 rounded-lg">
                        {getTemplatePreview(editedSubject, editedBody, previewFractionId).body}
                      </div>

                      {/* Simulate send footer button */}
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-850 flex justify-end no-print">
                        <button
                          type="button"
                          onClick={handleSimulateSend}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-4 py-2 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <i className="fa-solid fa-paper-plane text-[10px]"></i>
                          <span>Disparar Simulação para {getTemplatePreview(editedSubject, editedBody, previewFractionId).recipient.nome}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 2: ORIGINAL EMAIL CONFIGURATION & AUTORESPONDER */}
          {iaActiveSubTab === "config" && (
            <div className="space-y-6 max-w-4xl animate-fadeIn">
              
              {/* 1. PAINEL DE CONTROLO DO AUTO-RESPONDER & SINCRONIZADOR */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm text-slate-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl shadow-sm">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                        <span>Sincronizador da Caixa de Entrada & Auto-Responder</span>
                        <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30">
                          {syncEmailActive ? "● Ativo & Monitorizado" : "○ Pausado"}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        Processamento inteligente de faturas, recibos e comprovativos recebidos no e-mail do condomínio.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSyncNow}
                      disabled={isSyncingNow || !syncEmailActive}
                      className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 text-emerald-400 ${isSyncingNow ? "animate-spin" : ""}`} />
                      <span>{isSyncingNow ? "A sincronizar..." : "Sincronizar Agora"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleSyncEmail(!syncEmailActive)}
                      className={`text-xs font-extrabold px-3 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        syncEmailActive
                          ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      {syncEmailActive ? "Sincronizador Ligado" : "Ligar Sincronizador"}
                    </button>
                  </div>
                </div>

                {/* Sincronizador Status Bar */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Frequência de Varredura</span>
                      <strong className="text-slate-200 font-mono">
                        {syncInterval === "5" ? "A cada 5 minutos" : syncInterval === "15" ? "A cada 15 minutos" : "Webhook em Tempo Real"}
                      </strong>
                    </div>
                    <select
                      value={syncInterval}
                      onChange={(e) => {
                        setSyncInterval(e.target.value);
                        localStorage.setItem(`sync_interval_${predio.id_predio}`, e.target.value);
                      }}
                      className="text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1 font-bold text-slate-200"
                    >
                      <option value="5">5 min</option>
                      <option value="15">15 min</option>
                      <option value="webhook">Webhook Instantâneo</option>
                    </select>
                  </div>

                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Última Sincronização</span>
                      <span className="text-slate-200 font-semibold">{lastSyncTime}</span>
                    </div>
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                  </div>

                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Caixa de Correio Conectada</span>
                      <span className="text-emerald-400 font-mono font-bold truncate max-w-[150px] inline-block" title={adminEmail}>
                        {adminEmail}
                      </span>
                    </div>
                    <Mail className="h-4 w-4 text-emerald-400 shrink-0" />
                  </div>
                </div>

                {/* 2. SELETOR DE MODO AUTO-RESPONDER */}
                <div className="pt-2 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Modo de Operação do Auto-Responder:
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Modo 1: Confirmação Prévia (Recomendado) */}
                    <div
                      onClick={() => handleSelectAutoresponderMode("confirmacao_previa")}
                      className={`p-4 rounded-xl border cursor-pointer transition-all relative ${
                        autoresponderMode === "confirmacao_previa"
                          ? "bg-slate-950 border-emerald-500 ring-1 ring-emerald-500/40 shadow-sm"
                          : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="autoresponder_mode"
                            checked={autoresponderMode === "confirmacao_previa"}
                            onChange={() => handleSelectAutoresponderMode("confirmacao_previa")}
                            className="text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                          />
                          <h5 className="text-xs font-bold text-white">
                            Auto-Responder com Confirmação Prévia
                          </h5>
                        </div>
                        <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-black px-1.5 py-0.5 rounded border border-emerald-500/30">
                          RECOMENDADO
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                        A IA reconhece o documento anexo (fatura/recibo), lança o movimento na conta-corrente como <strong>Pendente de Confirmação</strong> e guarda a cópia no Arquivo Digital. O recibo oficial é disparado ao condómino assim que o administrador clica em <strong>"Confirmar"</strong>.
                      </p>
                    </div>

                    {/* Modo 2: Totalmente Autónomo */}
                    <div
                      onClick={() => handleSelectAutoresponderMode("totalmente_autonomo")}
                      className={`p-4 rounded-xl border cursor-pointer transition-all relative ${
                        autoresponderMode === "totalmente_autonomo"
                          ? "bg-slate-950 border-emerald-500 ring-1 ring-emerald-500/40 shadow-sm"
                          : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="autoresponder_mode"
                            checked={autoresponderMode === "totalmente_autonomo"}
                            onChange={() => handleSelectAutoresponderMode("totalmente_autonomo")}
                            className="text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                          />
                          <h5 className="text-xs font-bold text-white">
                            Auto-Responder 100% Autónomo
                          </h5>
                        </div>
                        <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-black px-1.5 py-0.5 rounded border border-emerald-500/30">
                          DIRETO
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                        A IA reconcilia o pagamento bancário e emite de imediato o recibo oficial por e-mail para o condómino sem requerer intervenção humana prévia.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Fluxo Automático Ativo */}
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[11px] uppercase font-black text-slate-400 tracking-wider block mb-2">
                    Ações Executadas Automaticamente pela IA no Recebimento de E-mail:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="text-slate-300 font-medium text-[11px]">Lançar movimento contabilístico</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="text-slate-300 font-medium text-[11px]">Guardar anexo no Arquivo Digital</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="text-slate-300 font-medium text-[11px]">Notificar painel da administração</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="text-slate-300 font-medium text-[11px]">Enviar Recibo (Template #2)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* 2. CONFIGURAÇÃO DO EMAIL OFICIAL (DOCUMENTO D) */}
              <form onSubmit={handleSaveEmailIA} className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850 space-y-2.5">
                  <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-tight flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-emerald-500" />
                    Regras de Validação Estrutural Obrigatórias (DOCUMENTO D):
                  </h4>
                  <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 pl-5 list-disc font-medium">
                    <li><strong className="text-slate-700 dark:text-slate-300">Sem acentos:</strong> O endereço não pode conter caracteres acentuados.</li>
                    <li><strong className="text-slate-700 dark:text-slate-300">Sem espaços:</strong> Não deve haver qualquer espaço em branco.</li>
                    <li><strong className="text-slate-700 dark:text-slate-300">Localidade abreviada:</strong> O endereço de email deve conter a localidade de forma resumida (Ex: PP2, LIS).</li>
                    <li><strong className="text-slate-700 dark:text-slate-300">Número do prédio no final:</strong> A parte local do email deve obrigatoriamente terminar com o número do edifício/rua (Ex: BentoRodrigesPP2).</li>
                    <li><strong className="text-slate-700 dark:text-slate-300">Nome da rua completo:</strong> Nome integral do arruamento no endereço.</li>
                  </ul>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded border border-emerald-100 dark:border-emerald-900/40 mt-1">
                    <strong>Exemplo Recomendado:</strong> BentoRodrigesPP2@gmail.com ou CPSN_BentoRodrigesPP2@gmail.com
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Email Oficial de Integração IA</label>
                  <div className="flex gap-2 max-w-md">
                    <input
                      type="text"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      placeholder="Ex: BentoRodrigesPP2@gmail.com"
                      className="flex-grow border p-2.5 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                      required
                    />
                    <button
                      type="submit"
                      className="border-2 border-emerald-500 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shadow transition-all flex items-center gap-1.5 active:ring-2 active:ring-emerald-400 select-none"
                    >
                      <img src="/estados-acoes/12-adicionar.png" alt="Gravar" className="h-3.5 w-3.5 object-contain" />
                      <span>Gravar</span>
                    </button>
                  </div>
                  
                  {emailError && (
                    <p className="text-[11px] text-red-500 font-bold flex items-center gap-1 bg-red-50 dark:bg-red-950/10 p-2.5 rounded border border-red-200 dark:border-red-900/30 max-w-md">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>{emailError}</span>
                    </p>
                  )}

                  {emailSuccess && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/10 p-2.5 rounded border border-emerald-200 dark:border-emerald-900/30 max-w-md">
                      <Check className="h-4 w-4" />
                      <span>{emailSuccess}</span>
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-850">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">Âmbito de Leitura Inteligente do Email:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {[
                      { label: "Ler e reconciliar Faturas", desc: "Varre faturas de fornecedores anexas no email." },
                      { label: "Ler Extratos Bancários", desc: "Integra extratos oficiais enviados pelos bancos." },
                      { label: "Ler Comprovativos de Quotas", desc: "Interpreta ficheiros PDF e imagens webp de pagamentos." },
                      { label: "Ler Documentação Legal", desc: "Certidões judiciais, regulamentos e regulamentação." },
                      { label: "Ler Relatórios Técnicos", desc: "Resultados de assistência técnica e testes." },
                      { label: "Ler Relatórios de Inspeções", desc: "Certificações anuais de elevadores, gás e incêndio." },
                      { label: "Ler Comunicações de Fornecedores", desc: "Orçamentos e propostas comerciais no corpo de texto." },
                      { label: "Documentos de Condóminos", desc: "Cartas de representação, procurações de assembleias." },
                      { label: "Documentos de Técnicos", desc: "Dossiers de vistoria e termos de responsabilidade." },
                      { label: "Documentos de Limpeza", desc: "Relatórios operacionais de higienização do edifício." }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-950">
                        <div className="bg-emerald-100 dark:bg-emerald-950/40 p-1 rounded text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                          <Check className="h-3 w-3" />
                        </div>
                        <div>
                          <strong className="text-slate-800 dark:text-slate-200 block text-[11px]">{item.label}</strong>
                          <span className="text-slate-500 dark:text-slate-400 text-[10px] font-medium">{item.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/10 p-3 rounded-lg border border-amber-200/40 mt-4 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    <span><strong>Nota Crítica:</strong> A Inteligência Artificial NÃO organiza o Gmail externo. A IA lê a caixa de correio e organiza e cataloga tudo de forma unificada e automática dentro da plataforma CondoManager AI!</span>
                  </div>
                </div>
              </form>
            </div>
          )}
          </div>
        </div>
      )}

      {/* ---------------- 3. NOTIFICAÇÕES ---------------- */}
      {activeSubSection === "notificacoes" && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Configuração de Alertas e Notificações</h3>
            <p className="text-xs text-slate-500">Defina quais eventos despoletam alertas push e e-mails aos condóminos e técnicos.</p>
          </div>

          <div className="space-y-4 max-w-2xl">
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-400">Eventos do Sistema</h4>
              
              <div className="flex justify-between items-center p-3 rounded-xl border bg-slate-50 dark:bg-slate-950 text-xs">
                <div>
                  <span className="font-bold block text-slate-800 dark:text-slate-200">Novas Ocorrências & Avarias</span>
                  <span className="text-[11px] text-slate-500">Alertar administração e técnicos quando um condómino cria uma avaria.</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifOcorrencia}
                  onChange={e => setNotifOcorrencia(e.target.checked)}
                  className="h-4 w-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl border bg-slate-50 dark:bg-slate-950 text-xs">
                <div>
                  <span className="font-bold block text-slate-800 dark:text-slate-200">Reconciliação e Emissão Financeira</span>
                  <span className="text-[11px] text-slate-500">Notificar condóminos sobre nova quota disponível e recibos emitidos automaticamente.</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifFinanceiro}
                  onChange={e => setNotifFinanceiro(e.target.checked)}
                  className="h-4 w-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl border bg-slate-50 dark:bg-slate-950 text-xs">
                <div>
                  <span className="font-bold block text-slate-800 dark:text-slate-200">Vistorias Técnicas & Inspeções</span>
                  <span className="text-[11px] text-slate-500">Alertar com antecedência sobre inspeções regulamentares de gás e elevador planeadas.</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifVistorias}
                  onChange={e => setNotifVistorias(e.target.checked)}
                  className="h-4 w-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-150 dark:border-slate-850 space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-400">Canais de Difusão Ativos</h4>

              <div className="flex justify-between items-center p-3 rounded-xl border bg-slate-50 dark:bg-slate-950 text-xs">
                <div>
                  <span className="font-bold block text-slate-800 dark:text-slate-200">Correio Eletrónico (E-mail)</span>
                  <span className="text-[11px] text-slate-500">Notificações por email via servidor smtp integrado da administração.</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifCanalEmail}
                  onChange={e => setNotifCanalEmail(e.target.checked)}
                  className="h-4 w-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl border bg-slate-50 dark:bg-slate-950 text-xs">
                <div>
                  <span className="font-bold block text-slate-800 dark:text-slate-200">Mensagens Push PWA</span>
                  <span className="text-[11px] text-slate-500">Alertas em tempo real no telemóvel dos condóminos através da PWA instalada.</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifCanalPush}
                  onChange={e => setNotifCanalPush(e.target.checked)}
                  className="h-4 w-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl border bg-slate-50 dark:bg-slate-950 text-xs">
                <div>
                  <span className="font-bold block text-slate-800 dark:text-slate-200">Alertas de SMS Administrativos (Opcional)</span>
                  <span className="text-[11px] text-slate-500">Envio de sms para convocações urgentes de assembleias.</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifCanalSMS}
                  onChange={e => setNotifCanalSMS(e.target.checked)}
                  className="h-4 w-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => alert("Canais de Notificação gravados com sucesso!")}
                className="border-2 border-emerald-500 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 text-white font-bold py-2 px-4 rounded-xl text-xs cursor-pointer shadow transition-all flex items-center gap-1.5 active:ring-2 active:ring-emerald-400 select-none"
              >
                <img src="/estados-acoes/12-adicionar.png" alt="Gravar" className="h-4 w-4 object-contain" />
                <span>Gravar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 4. LOG DE SISTEMA (REGISTO DE ATIVIDADE) ---------------- */}
      {activeSubSection === "logs" && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Log de Sistema (Registo Integral de Atividade)</h3>
              <p className="text-xs text-slate-500">Histórico detalhado e inalterável de auditoria contínua, alterações e intervenções da IA.</p>
            </div>

            <button
              onClick={() => {
                const clearOk = confirm("Tem a certeza que deseja limpar o registo de logs simulados de auditoria local?");
                if (clearOk) {
                  setLogs([]);
                  localStorage.removeItem(`system_activity_logs_${predio.id_predio}`);
                }
              }}
              className="text-[10px] text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 px-2.5 py-1.5 rounded-lg border border-red-200 font-bold cursor-pointer"
            >
              Limpar Registo
            </button>
          </div>

          {/* Search filters */}
          <div className="flex gap-2.5 flex-wrap text-xs font-semibold">
            <input
              type="text"
              value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
              placeholder="Pesquisar por descrição, utilizador ou detalhes..."
              className="flex-grow min-w-[240px] border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            />
            
            <select
              value={logFilter}
              onChange={e => setLogFilter(e.target.value)}
              className="border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 cursor-pointer"
            >
              <option value="Todas">Todas as Secções</option>
              <option value="Financeira">Alterações Financeiras</option>
              <option value="Documental">Alterações Documentais</option>
              <option value="Perfis">Alterações de Perfis</option>
              <option value="Upload/Download">Uploads e Downloads</option>
              <option value="IA">Ações da IA</option>
              <option value="Validação">Validações</option>
              <option value="Exportação">Exportações</option>
              <option value="Intervenção">Intervenções</option>
              <option value="Ocorrência">Ocorrências</option>
              <option value="Configuração">Configurações Alteradas</option>
            </select>
          </div>

          {/* Logs Output Table */}
          <div className="border rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-900 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <th className="p-3 w-36">Data / Hora</th>
                  <th className="p-3 w-32">Secção</th>
                  <th className="p-3">Operação / Descrição</th>
                  <th className="p-3 w-44">Utilizador / Autor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-850 font-medium">
                {logs
                  .filter(l => {
                    const matchesSearch = 
                      l.descricao.toLowerCase().includes(logSearch.toLowerCase()) || 
                      l.usuario.toLowerCase().includes(logSearch.toLowerCase()) ||
                      (l.detalhes && l.detalhes.toLowerCase().includes(logSearch.toLowerCase()));
                    const matchesFilter = logFilter === "Todas" || l.seccao === logFilter;
                    return matchesSearch && matchesFilter;
                  })
                  .map(l => (
                    <tr key={l.id} className="hover:bg-white dark:hover:bg-slate-900 transition-colors">
                      <td className="p-3 text-[10px] font-mono text-slate-500">{l.timestamp}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          l.seccao === "Financeira" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20" :
                          l.seccao === "Documental" ? "bg-blue-50 text-blue-800 dark:bg-blue-950/20" :
                          l.seccao === "Perfis" ? "bg-purple-50 text-purple-800 dark:bg-purple-950/20" :
                          l.seccao === "Upload/Download" ? "bg-amber-50 text-amber-800 dark:bg-amber-950/20" :
                          l.seccao === "IA" ? "bg-pink-50 text-pink-800 dark:bg-pink-950/20 animate-pulse" :
                          l.seccao === "Validação" ? "bg-teal-50 text-teal-800 dark:bg-teal-950/20" :
                          l.seccao === "Exportação" ? "bg-orange-50 text-orange-800 dark:bg-orange-950/20" :
                          l.seccao === "Intervenção" ? "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/20" :
                          l.seccao === "Ocorrência" ? "bg-red-50 text-red-800 dark:bg-red-950/20" :
                          "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                        }`}>
                          {l.seccao}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-slate-800 dark:text-slate-100 font-bold block">{l.descricao}</span>
                        {l.detalhes && <span className="text-[10px] text-slate-500 block font-normal leading-tight mt-0.5">{l.detalhes}</span>}
                      </td>
                      <td className="p-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                        {l.usuario}
                      </td>
                    </tr>
                  ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400 font-semibold">Nenhum registo de atividade encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- 5. EXPORTAÇÃO & BACKUP ---------------- */}
      {activeSubSection === "exportacao" && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Exportação e Backups de Segurança</h3>
            <p className="text-xs text-slate-500">Efetue cópias de segurança instantâneas, parciais ou automáticas e garanta a custódia total dos seus dados.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Intelligent ZIP box */}
            <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border space-y-4">
              <div className="space-y-1">
                <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded uppercase">Backup Total</span>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Exportação Integral (.ZIP Inteligente)</h4>
                <p className="text-xs text-slate-500">Descarrega um ficheiro compactado estruturado contendo toda a informação do condomínio.</p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border text-[11px] text-slate-600 dark:text-slate-400 font-medium space-y-1">
                <strong className="text-slate-700 dark:text-slate-300 block mb-1">Ficheiros incluídos no ZIP:</strong>
                <p>• Documentação Completa (PDFs do Arquivo)</p>
                <p>• Fichas de Condóminos & Frações (Excel/JSON)</p>
                <p>• Fichas de Fornecedores & Contratos</p>
                <p>• Extratos Financeiros e Saldos (Movimentos)</p>
                <p>• Dossiers de Engenharia Técnica (Vistorias)</p>
                <p>• Atas e Convocatórias de Assembleias</p>
                <p>• Histórico de Auditoria Interna e IA</p>
              </div>

              <button
                onClick={() => handleExportBackup("total")}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs cursor-pointer shadow flex items-center justify-center gap-1.5"
              >
                <FileDown className="h-4 w-4" />
                <span>Descarregar ZIP Inteligente Total</span>
              </button>
            </div>

            {/* Partial Export box */}
            <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border space-y-4">
              <div className="space-y-1">
                <span className="text-[9px] bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded uppercase">Backup Parcial</span>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Exportação por Categorias Específicas</h4>
                <p className="text-xs text-slate-500">Efetue downloads parcelados de bases de dados do condomínio.</p>
              </div>

              <div className="space-y-2">
                {[
                  { label: "Documentação & Arquivo", filter: "Documentos e Pastas" },
                  { label: "Relatórios Financeiros & Contas", filter: "Financeiro e Contabilidade" },
                  { label: "Fichas de Condóminos & Frações", filter: "Condóminos e Frações" },
                  { label: "Registo de Manutenção & Obras", filter: "Manutenção e Obras" },
                  { label: "Auditoria Interna & Configurações", filter: "Auditoria" }
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2.5 rounded-lg border bg-white dark:bg-slate-900 text-xs font-semibold">
                    <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                    <button
                      onClick={() => handleExportBackup("parcial", item.filter)}
                      className="text-blue-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Exportar</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Automated Export box */}
            <div className="md:col-span-2 bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border space-y-4">
              <div className="space-y-1">
                <span className="text-[9px] bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 font-bold px-2 py-0.5 rounded uppercase">Automação de Backups</span>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Configuração de Exportações Automáticas (Opcional)</h4>
                <p className="text-xs text-slate-500">Programe o CondoManager para enviar relatórios periódicos.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border space-y-2.5">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked id="auto_mensal" className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer" />
                    <label htmlFor="auto_mensal" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">Envio Mensal por Email</label>
                  </div>
                  <p className="text-[11px] text-slate-500 pl-6 leading-normal">
                    Envia de forma automática no dia 1 de cada mês o extrato financeiro e o dossier de ocorrências resolvidas para o email oficial da administração.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border space-y-2.5">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked id="auto_anual" className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer" />
                    <label htmlFor="auto_anual" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">Envio Anual para Auditoria</label>
                  </div>
                  <p className="text-[11px] text-slate-500 pl-6 leading-normal">
                    Envia o encerramento de contas anual, o log completo de auditoria inalterável e as faturas homologadas para o email da comissão técnica externa de auditoria.
                  </p>
                </div>
              </div>
            </div>

            {/* Manual de Perfis, Menus e Funções Export (DOC / PDF) */}
            <div className="md:col-span-2 bg-emerald-500/10 dark:bg-emerald-950/30 p-5 rounded-2xl border border-emerald-500/30 space-y-4">
              <div className="space-y-1">
                <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded uppercase">Documentação Oficial</span>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Manual de Perfis, Menus & Matriz de Capacidades (PDF / DOC Editável)</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">Descarregue o documento formal completo com a estrutura hierárquica de menus e atribuição de funções Browser/PWA por perfil.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={() => handleExportManualDocument("doc")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer shadow flex items-center gap-2 transition-all"
                >
                  <FileText className="h-4 w-4" />
                  <span>Descarregar DOC Editável (.doc)</span>
                </button>

                <button
                  onClick={() => handleExportManualDocument("pdf")}
                  className="bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer shadow flex items-center gap-2 transition-all"
                >
                  <FileDown className="h-4 w-4" />
                  <span>Gerar & Imprimir PDF Oficial</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
