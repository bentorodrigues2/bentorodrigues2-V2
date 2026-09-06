import React, { useState } from "react";
import { Shield, Lock, Fingerprint, Volume2, VolumeX, Bell, Smartphone, Mail, MessageSquare, Check, ChevronDown, ChevronUp, Play } from "lucide-react";
import { ActionIcon } from "./ActionIcon";
import { playNotificationTone } from "../lib/soundService";
import { createSecurityLog } from "../lib/authSecurity";

interface UserSecuritySubmenuProps {
  userEmail: string;
  userRole: string;
  biometricsEnabled?: boolean;
  setBiometricsEnabled?: (val: boolean) => void;
  setSimulatingScan?: (val: boolean) => void;
  setSimulatingScanProgress?: React.Dispatch<React.SetStateAction<number>>;
  className?: string;
  defaultOpen?: boolean;
  isFirstAccessMode?: boolean;
  onPasswordChangeSuccess?: () => void;
  showTestingBar?: boolean;
  setShowTestingBar?: (val: boolean) => void;
}

export const UserSecuritySubmenu: React.FC<UserSecuritySubmenuProps> = ({
  userEmail,
  userRole,
  biometricsEnabled = false,
  setBiometricsEnabled,
  setSimulatingScan,
  setSimulatingScanProgress,
  className = "",
  defaultOpen = false,
  isFirstAccessMode = false,
  onPasswordChangeSuccess,
  showTestingBar,
  setShowTestingBar
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen || isFirstAccessMode);

  // Redefinição de Password
  const [currentPass, setCurrentPass] = useState<string>("");
  const [newPass, setNewPass] = useState<string>("");
  const [confirmPass, setConfirmPass] = useState<string>("");
  const [passMsg, setPassMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Gestão de Som e Vibração
  const [soundAppEnabled, setSoundAppEnabled] = useState<boolean>(true);
  const [vibrationEnabled, setVibrationEnabled] = useState<boolean>(true);

  // Som da Notificação
  const [selectedNotificationSound, setSelectedNotificationSound] = useState<string>("CondoManager Padronizado");

  // Tipos de Notificação & Edição
  const [pushEnabled, setPushEnabled] = useState<boolean>(true);
  const [emailEnabled, setEmailEnabled] = useState<boolean>(true);
  const [smsEnabled, setSmsEnabled] = useState<boolean>(true);
  const [popupEnabled, setPopupEnabled] = useState<boolean>(true);

  const [contactEmail, setContactEmail] = useState<string>(userEmail || "usuario@condomanager.pt");
  const [contactSms, setContactSms] = useState<string>("+351 912 345 678");
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);

  // Play synthetic tone preview for notification sounds
  const handleTestSound = (soundName?: string) => {
    const tone = soundName || selectedNotificationSound;
    if (!soundAppEnabled) {
      alert("O Som da Aplicação está desativado. Ative-o para escutar as notificações.");
      return;
    }
    playNotificationTone(tone, 0.4);
    if (vibrationEnabled && typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch (e) {}
    }
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);

    if (!newPass || newPass.length < 8) {
      setPassMsg({ type: "error", text: "A nova password deve conter pelo menos 8 caracteres!" });
      return;
    }
    if (!/[A-Z]/.test(newPass)) {
      setPassMsg({ type: "error", text: "A password deve conter pelo menos 1 letra maiúscula (A-Z)!" });
      return;
    }
    if (!/[a-z]/.test(newPass)) {
      setPassMsg({ type: "error", text: "A password deve conter pelo menos 1 letra minúscula (a-z)!" });
      return;
    }
    if (!/[0-9]/.test(newPass)) {
      setPassMsg({ type: "error", text: "A password deve conter pelo menos 1 dígito numérico (0-9)!" });
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPass)) {
      setPassMsg({ type: "error", text: "A password deve conter pelo menos 1 símbolo especial (!@#$%...)!" });
      return;
    }
    if (newPass !== confirmPass) {
      setPassMsg({ type: "error", text: "A confirmação da password não coincide com a nova password!" });
      return;
    }

    createSecurityLog(userEmail, "PASSWORD_RESET_SUCCESS", "Password alterada com sucesso pelo utilizador.");
    localStorage.removeItem(`provisional_access_${(userEmail || "").toLowerCase()}`);
    localStorage.setItem(`user_password_set_${(userEmail || "").toLowerCase()}`, "true");

    setPassMsg({ type: "success", text: "✅ Password alterada com sucesso! Critérios de segurança validados." });
    setCurrentPass("");
    setNewPass("");
    setConfirmPass("");

    if (onPasswordChangeSuccess) {
      setTimeout(() => {
        onPasswordChangeSuccess();
      }, 1200);
    }
  };

  const handleToggleBiometrics = () => {
    if (setBiometricsEnabled && setSimulatingScan && setSimulatingScanProgress) {
      if (!biometricsEnabled) {
        setSimulatingScan(true);
        setSimulatingScanProgress(0);
        const interval = setInterval(() => {
          setSimulatingScanProgress(p => {
            if (p >= 100) {
              clearInterval(interval);
              setBiometricsEnabled(true);
              setTimeout(() => {
                setSimulatingScan(false);
                alert("Dados biométricos registados e ativados com sucesso!");
              }, 600);
              return 100;
            }
            return p + 25;
          });
        }, 150);
      } else {
        setBiometricsEnabled(false);
        alert("Acesso biométrico desativado com sucesso.");
      }
    } else {
      alert(biometricsEnabled ? "Biometria desativada." : "Biometria ativada com sucesso no perfil!");
    }
  };

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    setNotifyMsg("Preferências de notificação e contactos guardados com sucesso!");
    setTimeout(() => setNotifyMsg(null), 3000);
  };

  return (
    <div className={`border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs transition-all ${className}`}>
      {/* Accordion Header Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3.5 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-white flex items-center justify-between cursor-pointer transition-all hover:brightness-110"
      >
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-xl bg-slate-950 text-emerald-400 flex items-center justify-center border border-emerald-500/40 p-1 shrink-0 shadow-xs">
            <img src="/estados-acoes/18-seguranca.png" alt="Segurança" className="h-5 w-5 object-contain" />
          </div>
          <div className="text-left">
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xs tracking-tight block">Segurança</span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[8px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-widest">
                Submenu
              </span>
            </div>
            <span className="text-[9px] text-slate-400 block">Password, Biometria, Sons e Notificações</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-emerald-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expandable Content Panel */}
      {isOpen && (
        <div className="p-4 space-y-5 text-xs border-t border-slate-100 dark:border-slate-800 animate-fade-in">
          
          {/* 1. REDEFINIÇÃO DE PASSWORD */}
          <div className="space-y-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2 text-slate-800 dark:text-white font-extrabold text-[11px] uppercase tracking-wider">
              <Lock className="h-3.5 w-3.5 text-emerald-500" />
              <span>1. Redefinição de Password</span>
            </div>

            {passMsg && (
              <div className={`p-2 rounded-lg text-[10px] font-bold ${passMsg.type === "success" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200" : "bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200"}`}>
                {passMsg.text}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-2">
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Password Atual</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-xl text-slate-800 dark:text-white text-[10px] focus:outline-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Nova Password</label>
                  <input
                    type="password"
                    placeholder="Mínimo 8 carateres"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-xl text-slate-800 dark:text-white text-[10px] focus:outline-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Confirmar Password</label>
                  <input
                    type="password"
                    placeholder="Repita a password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-xl text-slate-800 dark:text-white text-[10px] focus:outline-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-xs"
              >
                Atualizar Password de Acesso
              </button>
            </form>
          </div>

          {/* 2. ATIVAÇÃO DOS DADOS BIOMÉTRICOS */}
          <div className="space-y-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2 text-slate-800 dark:text-white font-extrabold text-[11px] uppercase tracking-wider">
              <Fingerprint className="h-3.5 w-3.5 text-emerald-500" />
              <span>2. Ativação de Dados Biométricos</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <Fingerprint className="h-4.5 w-4.5" />
                </div>
                <div className="text-left">
                  <span className="font-extrabold text-[10px] text-slate-800 dark:text-white block">Face ID / Touch ID / Biometria</span>
                  <span className="text-[8px] text-slate-400">Autenticação rápida e encriptada no dispositivo</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleBiometrics}
                className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  biometricsEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-800"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                    biometricsEnabled ? "translate-x-4.5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 3. GESTÃO DE SOM E VIBRAÇÃO */}
          <div className="space-y-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2 text-slate-800 dark:text-white font-extrabold text-[11px] uppercase tracking-wider">
              <Volume2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>3. Gestão de Som e Vibração</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Som do App */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {soundAppEnabled ? <Volume2 className="h-3.5 w-3.5 text-emerald-500" /> : <VolumeX className="h-3.5 w-3.5 text-slate-400" />}
                  <span className="font-extrabold text-[9.5px] text-slate-700 dark:text-slate-300">Som da Aplicação</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSoundAppEnabled(!soundAppEnabled)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    soundAppEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-800"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ${soundAppEnabled ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>

              {/* Vibração Hática */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Smartphone className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="font-extrabold text-[9.5px] text-slate-700 dark:text-slate-300">Vibração / Resposta Tátil</span>
                </div>
                <button
                  type="button"
                  onClick={() => setVibrationEnabled(!vibrationEnabled)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    vibrationEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-800"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ${vibrationEnabled ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            </div>
          </div>

          {/* 4. SOM DA NOTIFICAÇÃO */}
          <div className="space-y-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-800 dark:text-white font-extrabold text-[11px] uppercase tracking-wider">
                <Bell className="h-3.5 w-3.5 text-emerald-500" />
                <span>4. Som da Notificação</span>
              </div>
              <button
                type="button"
                onClick={() => handleTestSound()}
                className="text-[9px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-lg font-extrabold flex items-center space-x-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 cursor-pointer transition-colors"
              >
                <Play className="h-2.5 w-2.5" />
                <span>Testar Som</span>
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl space-y-1.5">
              <label className="text-[9px] font-bold text-slate-400 uppercase block">Selecione o Tom de Alerta</label>
              <select
                value={selectedNotificationSound}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedNotificationSound(val);
                  handleTestSound(val);
                }}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-lg text-[10px] font-bold text-slate-800 dark:text-white focus:outline-emerald-500 cursor-pointer"
              >
                <option value="CondoManager Padronizado">🔔 CondoManager Padronizado (Recomendado)</option>
                <option value="Melodia Suave">🎵 Melodia Suave (Gentle Chime)</option>
                <option value="Alerta Cristalino">⚡ Alerta Cristalino (Crystal Tone)</option>
                <option value="Sino Clássico">🏛️ Sino Clássico (Church Bell)</option>
                <option value="Silencioso">🔕 Silencioso (Sem Som)</option>
              </select>
            </div>
          </div>

          {/* 5. TIPO DE NOTIFICAÇÃO (COM EDIÇÃO DE CANAIS & CONTACTOS) */}
          <div className="space-y-2.5">
            <div className="flex items-center space-x-2 text-slate-800 dark:text-white font-extrabold text-[11px] uppercase tracking-wider">
              <Mail className="h-3.5 w-3.5 text-emerald-500" />
              <span>5. Tipo de Notificação (Canais & Edição)</span>
            </div>

            {notifyMsg && (
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 text-[10px] font-bold">
                {notifyMsg}
              </div>
            )}

            <form onSubmit={handleSaveNotifications} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Push */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="h-3.5 w-3.5 text-emerald-500" />
                    <div>
                      <span className="font-extrabold text-[9.5px] text-slate-700 dark:text-slate-300 block">Notificações Push</span>
                      <span className="text-[8px] text-slate-400">Dispositivo móvel</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPushEnabled(!pushEnabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      pushEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-800"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ${pushEnabled ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </div>

                {/* Pop-up In-App */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bell className="h-3.5 w-3.5 text-emerald-500" />
                    <div>
                      <span className="font-extrabold text-[9.5px] text-slate-700 dark:text-slate-300 block">Alertas Pop-up</span>
                      <span className="text-[8px] text-slate-400">Avisos urgentes na tela</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPopupEnabled(!popupEnabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      popupEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-800"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ${popupEnabled ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </div>
              </div>

              {/* Email Notification Channel & Editable Field */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Mail className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="font-extrabold text-[10px] text-slate-800 dark:text-white">Notificações por E-mail</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmailEnabled(!emailEnabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      emailEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-800"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ${emailEnabled ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </div>

                {emailEnabled && (
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">E-mail para Receber Alertas</label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-lg text-[10px] font-bold text-slate-800 dark:text-white focus:outline-emerald-500"
                    />
                  </div>
                )}
              </div>

              {/* SMS Notification Channel & Editable Field */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="font-extrabold text-[10px] text-slate-800 dark:text-white">Notificações por SMS / Urgência</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSmsEnabled(!smsEnabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      smsEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-800"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ${smsEnabled ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </div>

                {smsEnabled && (
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Telemóvel de Receção SMS</label>
                    <input
                      type="text"
                      value={contactSms}
                      onChange={(e) => setContactSms(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-lg text-[10px] font-bold text-slate-800 dark:text-white focus:outline-emerald-500"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <img src="/estados-acoes/04-concluido.png" alt="Guardar" className="h-4 w-4 object-contain inline-block" />
                <span>Guardar Preferências de Notificação</span>
              </button>
            </form>
          </div>

        </div>
      )}
    </div>
  );
};
