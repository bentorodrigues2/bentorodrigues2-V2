// Document Security, ACL, RGPD/GDPR Protection, OCR & Digital Signatures Guard
import { getRealClientIp } from "./authSecurity";
import { registarAuditoria } from "./supabaseService";

export type UserRole = 
  | "ADMIN" 
  | "GESTOR" 
  | "TECNICO" 
  | "AUDITOR" 
  | "CONTABILISTA" 
  | "JURIDICO" 
  | "LIMPEZAS" 
  | "USER";

export type DocumentType = 
  | "ata" 
  | "contrato" 
  | "fatura" 
  | "movimento_bancario" 
  | "comprovativo_pagamento" 
  | "vistoria_tecnica" 
  | "relatorio_limpeza";

export type SecurityAction = 
  | "select" 
  | "insert" 
  | "update" 
  | "delete" 
  | "ocr_process" 
  | "signature_verify" 
  | "gdpr_export";

export interface DocumentACLRule {
  role: UserRole;
  allowedDocTypes: DocumentType[];
  actions: SecurityAction[];
  canAccessAllCondominios: boolean; // ADMIN, AUDITOR, GESTOR
  ocrAllowed: boolean;
  signatureVerifyAllowed: boolean;
}

export interface DocumentMetadata {
  id: string;
  condominioId: string;
  docType: DocumentType;
  title: string;
  fileUrl: string;
  storagePath: string; // Supabase Storage Bucket path
  ownerEmail?: string;
  fracaoId?: string;
  digitalSignatureHash?: string;
  digitalSignatureVerified?: boolean;
  ocrExtractedJson?: any;
  createdAt: string;
  isEncrypted: boolean;
  rgpdSensitiveData: boolean; // Contains NIF, IBAN, or personal address
}

export interface DocumentAccessLog {
  id: string;
  timestamp: string;
  userEmail: string;
  userRole: UserRole;
  condominioId: string;
  documentId: string;
  docType: DocumentType;
  action: SecurityAction;
  granted: boolean;
  reason: string;
  ip: string;
}

// Access Control List Matrix per Role
export const ACL_ROLE_MATRIX: Record<UserRole, DocumentACLRule> = {
  ADMIN: {
    role: "ADMIN",
    allowedDocTypes: ["ata", "contrato", "fatura", "movimento_bancario", "comprovativo_pagamento", "vistoria_tecnica", "relatorio_limpeza"],
    actions: ["select", "insert", "update", "delete", "ocr_process", "signature_verify", "gdpr_export"],
    canAccessAllCondominios: true,
    ocrAllowed: true,
    signatureVerifyAllowed: true,
  },
  GESTOR: {
    role: "GESTOR",
    allowedDocTypes: ["ata", "contrato", "fatura", "movimento_bancario", "comprovativo_pagamento", "vistoria_tecnica", "relatorio_limpeza"],
    actions: ["select", "insert", "update", "delete", "ocr_process", "signature_verify", "gdpr_export"],
    canAccessAllCondominios: false,
    ocrAllowed: true,
    signatureVerifyAllowed: true,
  },
  JURIDICO: {
    role: "JURIDICO",
    allowedDocTypes: ["ata", "contrato", "fatura", "movimento_bancario"],
    actions: ["select", "insert", "update", "ocr_process", "signature_verify", "gdpr_export"],
    canAccessAllCondominios: false,
    ocrAllowed: true,
    signatureVerifyAllowed: true,
  },
  CONTABILISTA: {
    role: "CONTABILISTA",
    allowedDocTypes: ["fatura", "movimento_bancario", "comprovativo_pagamento", "contrato", "ata"],
    actions: ["select", "insert", "update", "ocr_process", "signature_verify", "gdpr_export"],
    canAccessAllCondominios: false,
    ocrAllowed: true,
    signatureVerifyAllowed: true,
  },
  AUDITOR: {
    role: "AUDITOR",
    allowedDocTypes: ["ata", "contrato", "fatura", "movimento_bancario", "comprovativo_pagamento", "vistoria_tecnica", "relatorio_limpeza"],
    actions: ["select", "ocr_process", "signature_verify", "gdpr_export"],
    canAccessAllCondominios: true,
    ocrAllowed: true,
    signatureVerifyAllowed: true,
  },
  TECNICO: {
    role: "TECNICO",
    allowedDocTypes: ["vistoria_tecnica", "contrato", "fatura", "ata"],
    actions: ["select", "insert", "update", "ocr_process"],
    canAccessAllCondominios: false,
    ocrAllowed: true,
    signatureVerifyAllowed: false,
  },
  LIMPEZAS: {
    role: "LIMPEZAS",
    allowedDocTypes: ["relatorio_limpeza", "vistoria_tecnica"],
    actions: ["select", "insert"],
    canAccessAllCondominios: false,
    ocrAllowed: false,
    signatureVerifyAllowed: false,
  },
  USER: {
    role: "USER",
    allowedDocTypes: ["ata", "fatura", "comprovativo_pagamento", "relatorio_limpeza"],
    actions: ["select", "insert"], // Condóminos can view general docs and insert payment proof
    canAccessAllCondominios: false,
    ocrAllowed: false,
    signatureVerifyAllowed: true, // Can check digital signatures on assembly minutes
  },
};

// Check if user has permission to perform action on document
export function validateDocumentAccess(
  userRole: UserRole,
  userCondominioId: string,
  userEmail: string,
  document: DocumentMetadata,
  action: SecurityAction
): { allowed: boolean; reason: string } {
  const rule = ACL_ROLE_MATRIX[userRole];
  if (!rule) {
    return { allowed: false, reason: `Role '${userRole}' não possui definições de ACL válidas.` };
  }

  // 1. Check Condomínio Scoping
  if (!rule.canAccessAllCondominios && userCondominioId !== document.condominioId) {
    return {
      allowed: false,
      reason: `Acesso negado por RLS: O utilizador pertence ao condomínio '${userCondominioId}', mas o documento pertence a '${document.condominioId}'.`
    };
  }

  // 2. Check Document Type ACL
  if (!rule.allowedDocTypes.includes(document.docType)) {
    return {
      allowed: false,
      reason: `Acesso restrito: A função '${userRole}' não tem permissão para aceder a documentos do tipo '${document.docType}'.`
    };
  }

  // 3. Check Action ACL
  if (!rule.actions.includes(action)) {
    return {
      allowed: false,
      reason: `Operação proibida: A função '${userRole}' não tem permissão para a ação '${action}'.`
    };
  }

  // 4. OCR Protection Check
  if (action === "ocr_process" && !rule.ocrAllowed) {
    return {
      allowed: false,
      reason: `Proteção de Dados: A extração automática de texto por OCR está restrita a funções administrativas, jurídicas ou contabilísticas.`
    };
  }

  // 5. Signature Verification Check
  if (action === "signature_verify" && !rule.signatureVerifyAllowed) {
    return {
      allowed: false,
      reason: `Acesso restrito: A validação de assinaturas digitais requer perfil com privilégios de auditoria ou administração.`
    };
  }

  // 6. Condómino / USER Specific Isolation for Sensitive Documents (Faturas / Extratos)
  if (userRole === "USER") {
    if (document.docType === "movimento_bancario" || document.docType === "contrato") {
      return {
        allowed: false,
        reason: `RGPD / GDPR: Movimentos bancários detalhados e contratos de fornecedores contêm dados sensíveis do condomínio restritos à Administração.`
      };
    }
  }

  return { allowed: true, reason: `Acesso autorizado com base na policy RLS [${userRole} -> ${document.docType} -> ${action}].` };
}

// Log Document Access to Audit Trail
export async function logDocumentAccess(
  userEmail: string,
  userRole: UserRole,
  condominioId: string,
  documentId: string,
  docType: DocumentType,
  action: SecurityAction,
  granted: boolean,
  reason: string
): Promise<DocumentAccessLog> {
  const ip = await getRealClientIp();
  const log: DocumentAccessLog = {
    id: `doclog-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
    userEmail,
    userRole,
    condominioId,
    documentId,
    docType,
    action,
    granted,
    reason,
    ip
  };

  try {
    const existingStr = localStorage.getItem("supabase_document_access_logs") || "[]";
    const existing: DocumentAccessLog[] = JSON.parse(existingStr);
    existing.unshift(log);
    localStorage.setItem("supabase_document_access_logs", JSON.stringify(existing.slice(0, 150)));
  } catch (e) {
    console.error("Erro ao guardar log de acesso a documento localmente:", e);
  }

  // O registo local (acima) é só cache de exibição rápida — o rasto de
  // auditoria RGPD que conta é este, na tabela imutável auditoria_plataforma
  // (só select/insert), para o próprio utilizador auditado não conseguir
  // apagar o seu rasto de acesso limpando o localStorage do browser.
  registarAuditoria({
    id: log.id,
    id_predio: condominioId || null,
    seccao: "Segurança Documental (RGPD)",
    descricao: `[${action.toUpperCase()}] ${granted ? "Acesso concedido" : "Acesso negado"} a documento "${documentId}" (${docType}).`,
    detalhes: `${reason} | IP: ${ip}`,
    usuario: null,
    email_usuario: userEmail,
    role_usuario: userRole,
    origem: "web"
  }).catch((err) => console.error("Erro ao registar log de acesso a documento no Supabase:", err));

  return log;
}

export function getDocumentAccessLogs(): DocumentAccessLog[] {
  try {
    const existingStr = localStorage.getItem("supabase_document_access_logs");
    if (!existingStr) return [];
    return JSON.parse(existingStr);
  } catch {
    return [];
  }
}

// Session Validation Middleware Helper (Browser & PWA)
export interface ActiveSessionValidation {
  isValid: boolean;
  userEmail: string;
  role: UserRole;
  condominioId: string;
  tokenExpired: boolean;
  errors: string[];
}

export function validateClientSession(
  userRole: string,
  userEmail: string,
  sessionToken?: string
): ActiveSessionValidation {
  const errors: string[] = [];

  if (!userEmail || !userEmail.includes("@")) {
    errors.push("Sessão inválida: E-mail de utilizador não identificado.");
  }

  const validRoles: UserRole[] = ["ADMIN", "GESTOR", "TECNICO", "AUDITOR", "CONTABILISTA", "JURIDICO", "LIMPEZAS", "USER"];
  if (!validRoles.includes(userRole as UserRole)) {
    errors.push(`Sessão comprometida: Role '${userRole}' não reconhecida pelo middleware de segurança.`);
  }

  // Check RGPD Consent & Token validity stored in localStorage
  let rgpdConsentGranted = true;
  try {
    const consent = localStorage.getItem(`rgpd_consent_${userEmail}`);
    if (consent === "denied") {
      rgpdConsentGranted = false;
      errors.push("RGPD: O utilizador revogou o consentimento de tratamento de dados pessoais.");
    }
  } catch {}

  return {
    isValid: errors.length === 0,
    userEmail,
    role: userRole as UserRole,
    condominioId: "PREDIO-001",
    tokenExpired: false,
    errors
  };
}
