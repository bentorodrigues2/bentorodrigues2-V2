import React from "react";
import { UserSecuritySubmenu } from "./UserSecuritySubmenu";
import { LoggedUser } from "../types";
import { Shield, X, User } from "lucide-react";
import { ActionIcon } from "./ActionIcon";

interface UserSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  loggedUser: LoggedUser;
  idPredio?: string;
  biometricsEnabled?: boolean;
  setBiometricsEnabled?: (val: boolean) => void;
  isFirstAccessMode?: boolean;
  showTestingBar?: boolean;
  setShowTestingBar?: (val: boolean) => void;
}

export const UserSecurityModal: React.FC<UserSecurityModalProps> = ({
  isOpen,
  onClose,
  loggedUser,
  idPredio,
  biometricsEnabled = false,
  setBiometricsEnabled,
  isFirstAccessMode = false,
  showTestingBar,
  setShowTestingBar
}) => {
  if (!isOpen) return null;

  const isProvisional = isFirstAccessMode || 
    (typeof localStorage !== "undefined" && localStorage.getItem(`provisional_access_${(loggedUser.email || "").toLowerCase()}`) === "true");

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[120] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-2xl bg-slate-950 text-emerald-400 flex items-center justify-center border border-emerald-500/40 p-1 shrink-0 shadow-xs">
              <img src="/estados-acoes/18-seguranca.png" alt="Segurança" className="h-6 w-6 object-contain" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-sm text-white">{loggedUser.nome}</h3>
                <span className="bg-emerald-500/20 text-emerald-300 text-[8px] font-black px-2 py-0.5 rounded-md border border-emerald-500/30">
                  {loggedUser.role}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">{loggedUser.email}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {/* First Access Warning Banner */}
          {isProvisional && (
            <div className="p-3.5 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl space-y-1.5 animate-pulse">
              <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400 font-extrabold text-xs">
                <Shield className="h-4 w-4 shrink-0" />
                <span>Primeiro Acesso Obrigatório: Alteração de Palavra-passe</span>
              </div>
              <p className="text-[10.5px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Bem-vindo ao <strong>CondoManager AI</strong>! Por motivos estritos de segurança e privacidade do condomínio, redefina agora a sua palavra-passe provisória recebida por e-mail.
              </p>
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-850 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-emerald-500" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-[10px]">E-mail Registado no Perfil</span>
                <span className="text-[9px] font-mono text-slate-500">{loggedUser.email}</span>
              </div>
            </div>
            <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-extrabold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              {isProvisional ? "Pendente Redefinição" : "Ativo"}
            </span>
          </div>

          {/* Submenu Expansível de Segurança */}
          <div>
            <h4 className="text-[9.5px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
              Configurações & Submenu de Segurança
            </h4>
            <UserSecuritySubmenu
              userEmail={loggedUser.email}
              userRole={loggedUser.role}
              idPredio={idPredio}
              biometricsEnabled={biometricsEnabled}
              setBiometricsEnabled={setBiometricsEnabled}
              defaultOpen={true}
              isFirstAccessMode={isProvisional}
              showTestingBar={showTestingBar}
              setShowTestingBar={setShowTestingBar}
              onPasswordChangeSuccess={() => {
                onClose();
              }}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl cursor-pointer transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
