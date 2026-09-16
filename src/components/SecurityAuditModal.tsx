import { useState, useEffect } from "react";
import { getSecurityLogs, SecurityLog } from "../lib/authSecurity";
import { getDocumentAccessLogs, DocumentAccessLog, ACL_ROLE_MATRIX } from "../lib/documentSecurity";

interface SecurityAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string;
  failedCount: number;
  isLocked: boolean;
}

export function SecurityAuditModal({
  isOpen,
  onClose,
  currentEmail,
  failedCount,
  isLocked,
}: SecurityAuditModalProps) {
  const [activeTab, setActiveTab] = useState<"auth" | "rls" | "acl" | "doclogs">("auth");
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [docLogs, setDocLogs] = useState<DocumentAccessLog[]>([]);

  useEffect(() => {
    if (isOpen) {
      setLogs(getSecurityLogs());
      setDocLogs(getDocumentAccessLogs());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] flex flex-col text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
              <i className="fa-solid fa-shield-halved text-base"></i>
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>Supabase RGPD & Protection Engine</span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full uppercase font-bold">
                  RLS Ativo
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Row Level Security, Proteção de Documentos, ACL por Role e Auditoria RGPD
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-base"></i>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 border-b border-slate-800 pb-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab("auth")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === "auth" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-slate-400 hover:text-white"}`}
          >
            🔒 Autenticação & Brute Force
          </button>
          <button
            onClick={() => setActiveTab("rls")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === "rls" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-slate-400 hover:text-white"}`}
          >
            🛡️ Policies RLS por Tabela
          </button>
          <button
            onClick={() => setActiveTab("acl")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === "acl" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-slate-400 hover:text-white"}`}
          >
            📋 Matriz ACL por Role
          </button>
          <button
            onClick={() => setActiveTab("doclogs")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === "doclogs" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-slate-400 hover:text-white"}`}
          >
            📄 Logs Acesso a Documentos
          </button>
        </div>

        {/* Current Security Snapshot */}
        <div className="grid grid-cols-3 gap-2.5 bg-slate-950 border border-slate-800/80 p-3 rounded-xl text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Sessão / Perfil Ativo</span>
            <span className="font-mono text-emerald-400 font-bold truncate block">{currentEmail}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Segurança Brute Force</span>
            <span className={`font-bold ${failedCount > 0 ? "text-amber-400" : "text-slate-300"}`}>
              {failedCount} tentativa(s) falhada(s)
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Proteção de Dados RGPD</span>
            <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded-md inline-block mt-0.5 ${isLocked ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"}`}>
              {isLocked ? "🔒 Bloqueado (Reset Obrigatório)" : "✅ Conforme RGPD (Artº 25 / 32)"}
            </span>
          </div>
        </div>

        {/* TAB CONTENT 1: AUTH LOGS */}
        {activeTab === "auth" && (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
            <div className="flex justify-between items-center text-[10px] uppercase font-extrabold text-slate-400 px-1 pt-1">
              <span>Registo de Eventos Recentes (auditoria_plataforma)</span>
              <span>Total: {logs.length} logs</span>
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Sem registos de segurança gravados.
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-950/70 border border-slate-800/60 rounded-xl p-3 flex flex-col space-y-1 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-extrabold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      log.eventType === "LOGIN_SUCCESS" ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30" :
                      log.eventType === "ACCOUNT_LOCKED_BRUTE_FORCE" ? "bg-red-950 text-red-400 border border-red-500/30" :
                      log.eventType === "COOLDOWN_ACTIVATED" ? "bg-amber-950 text-amber-400 border border-amber-500/30" :
                      "bg-blue-950 text-blue-400 border border-blue-500/30"
                    }`}>
                      {log.eventType}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-medium pt-0.5">
                    {log.details}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-800/40">
                    <span>E-mail: {log.userEmail}</span>
                    <span>IP: {log.ip}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB CONTENT 2: RLS POLICIES */}
        {activeTab === "rls" && (
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
            <div className="bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-xl text-[11px] text-emerald-300 space-y-1">
              <div className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                <i className="fa-solid fa-lock"></i>
                <span>Status de Row Level Security (RLS) no Supabase Engine</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[10px]">
                Todas as tabelas abaixo têm <strong>ALTER TABLE ... ENABLE ROW LEVEL SECURITY</strong> aplicado e as suas policies removidas — o único acesso possível é através deste servidor, autenticado com a <code>service_role key</code>, nunca exposta ao browser. O acesso direto com a chave pública (anon) é estruturalmente bloqueado para todas estas tabelas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { name: "predios", policy: "Só via proxy /api/data com service_role" },
                { name: "fracoes", policy: "Só via proxy /api/data com service_role" },
                { name: "proprietarios", policy: "Só via proxy /api/data com service_role" },
                { name: "contas", policy: "Só via proxy /api/data com service_role" },
                { name: "movimentos", policy: "Só via proxy /api/data com service_role" },
                { name: "avisos", policy: "Só via proxy /api/data com service_role" },
                { name: "documentos", policy: "Só via proxy /api/data com service_role" },
                { name: "ocorrencias", policy: "Só via proxy /api/data com service_role" },
                { name: "reservas", policy: "Só via proxy /api/data com service_role" },
                { name: "fornecedores", policy: "Só via proxy /api/data com service_role" },
                { name: "contratos", policy: "Só via proxy /api/data com service_role" },
                { name: "reunioes", policy: "Só via proxy /api/data com service_role" },
                { name: "auditoria_plataforma", policy: "Só leitura e inserção — sem update/delete, nem pelo servidor" },
                { name: "ai_auditoria", policy: "Só leitura e inserção — sem update/delete, nem pelo servidor" },
                { name: "seguros_fracoes / sinistros", policy: "Só via proxy /api/data com service_role" },
                { name: "push_subscriptions", policy: "Só via proxy /api/data com service_role" },
              ].map((t) => (
                <div key={t.name} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-emerald-400 font-bold text-xs">{t.name}</span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold uppercase">
                      RLS Ativo
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-snug">{t.policy}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB CONTENT 3: ACL ROLE MATRIX */}
        {activeTab === "acl" && (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
            <div className="text-[10px] uppercase font-extrabold text-slate-400 px-1 pt-1">
              Matriz de Controlo de Acesso por Perfil (Access Control List - ACL)
            </div>

            <div className="space-y-2">
              {Object.entries(ACL_ROLE_MATRIX).map(([roleName, rule]) => (
                <div key={roleName} className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-white text-xs uppercase tracking-wider bg-slate-800 px-2.5 py-1 rounded-lg">
                      Role: {roleName}
                    </span>
                    <div className="flex items-center space-x-2 text-[10px]">
                      <span className={rule.ocrAllowed ? "text-emerald-400 font-bold" : "text-slate-500"}>
                        OCR: {rule.ocrAllowed ? "✅ Permitido" : "❌ Proibido"}
                      </span>
                      <span className={rule.signatureVerifyAllowed ? "text-emerald-400 font-bold" : "text-slate-500"}>
                        Assinaturas: {rule.signatureVerifyAllowed ? "✅ Valida" : "❌ Sem Acesso"}
                      </span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-300 space-y-1 pt-1">
                    <div>
                      <strong className="text-slate-400">Documentos Permitidos:</strong>{" "}
                      <span className="text-slate-200">{rule.allowedDocTypes.join(", ")}</span>
                    </div>
                    <div>
                      <strong className="text-slate-400">Ações Permitidas:</strong>{" "}
                      <span className="text-emerald-300">{rule.actions.join(", ")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB CONTENT 4: DOCUMENT ACCESS LOGS */}
        {activeTab === "doclogs" && (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
            <div className="flex justify-between items-center text-[10px] uppercase font-extrabold text-slate-400 px-1 pt-1">
              <span>Logs de Acesso a Documentos, OCR e Assinaturas (Conformidade RGPD)</span>
              <span>Total: {docLogs.length} registo(s)</span>
            </div>

            {docLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Sem registos de acesso a documentos gravados.
              </div>
            ) : (
              docLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-950/70 border border-slate-800/60 rounded-xl p-3 flex flex-col space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`font-extrabold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        log.granted ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30" : "bg-red-950 text-red-400 border border-red-500/30"
                      }`}>
                        {log.action}
                      </span>
                      <span className="text-[10px] font-bold text-slate-300 uppercase">
                        [{log.docType}]
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-medium pt-0.5">
                    {log.reason}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-800/40">
                    <span>Utilizador: {log.userEmail} ({log.userRole})</span>
                    <span>Condomínio: {log.condominioId}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
          <span className="text-[10px] text-slate-500">
            Engine de Proteção RGPD/GDPR, ACL & Row Level Security Supabase Ativo
          </span>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Fechar Painel de Segurança
          </button>
        </div>

      </div>
    </div>
  );
}

