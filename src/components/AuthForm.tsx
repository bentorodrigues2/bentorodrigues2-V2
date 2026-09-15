import React, { useState, useEffect } from "react";
import { supabase } from '@/lib/supabaseClient';
import { createSecurityLog } from "../lib/authSecurity";

interface AuthFormProps {
  initialEmail?: string;
  initialErrorMessage?: string;
  onLoginSuccess: (email: string) => void;
  onOpenSecurityLogs?: () => void;
}

export default function AuthForm({
  initialEmail = "",
  initialErrorMessage = "",
  onLoginSuccess,
  onOpenSecurityLogs,
}: AuthFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState(initialErrorMessage);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    if (initialErrorMessage) {
      setErrorMessage(initialErrorMessage);
    }
  }, [initialErrorMessage]);

  const handleStandardLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage("Por favor, introduza o e-mail de utilizador.");
      return;
    }
    if (!password) {
      setErrorMessage("Por favor, introduza a palavra-passe.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error || !data?.user) {
        const msg = error?.message === "Invalid login credentials"
          ? "❌ Email ou palavra-passe incorretos."
          : `❌ ${error?.message || "Não foi possível iniciar sessão."}`;
        setErrorMessage(msg);
        createSecurityLog(cleanEmail, "LOGIN_FAILED", error?.message || "Credenciais inválidas.");
        return;
      }

      createSecurityLog(cleanEmail, "LOGIN_SUCCESS", "Login efetuado com sucesso via Supabase Auth.");
      onLoginSuccess(data.user.email || cleanEmail);
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarEmailRecuperacao = async () => {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) {
      alert("Por favor introduza o seu e-mail!");
      return;
    }
    setSendingReset(true);
    try {
      // Passa pelo nosso próprio endpoint (que gera o link e envia o email
      // via Resend, em português e com a marca da app) em vez de deixar o
      // supabase.auth.resetPasswordForEmail disparar o email genérico do
      // Supabase (em inglês, remetente "Supabase Auth").
      await fetch("/api/admin?acao=recuperar-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail })
      });
      createSecurityLog(cleanEmail, "PASSWORD_RESET_REQUESTED", "Pedido de e-mail de redefinição de palavra-passe enviado.");
      setResetSent(true);
    } catch (err) {
      alert("Não foi possível enviar o email de recuperação. Tente novamente.");
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="max-w-[380px] w-full bg-[#0d1424] border border-slate-800 p-5 rounded-2xl shadow-2xl backdrop-blur-xl text-center space-y-3 relative overflow-hidden text-slate-100">

      {/* Top Logo */}
      <div className="flex flex-col items-center justify-center pt-1">
        <div className="h-16 sm:h-20 w-full flex items-center justify-center overflow-visible my-1">
          <img
            src="/marca/02-versao-horizontal.png"
            alt="CondoManager AI"
            className="h-14 sm:h-18 w-auto max-w-[280px] object-contain select-none drop-shadow-2xl"
            referrerPolicy="no-referrer"
            onError={(e) => {
              // Fallback logo if image loading fails
              (e.target as HTMLElement).style.display = "none";
            }}
          />
        </div>
        <div className="mt-2">
          <h2 className="text-sm font-extrabold tracking-wider text-white uppercase font-sans">
            {resetMode ? "Recuperação de Acesso" : "PORTAL DE AUTENTICAÇÃO"}
          </h2>
        </div>
      </div>

      {/* ERROR / INFO MESSAGE ALERT BANNER */}
      {errorMessage && (
        <div className="bg-red-950/80 border border-red-500/60 p-2.5 rounded-xl text-red-200 text-[11px] font-medium text-left flex items-start justify-between gap-2">
          <div className="flex items-start space-x-1.5">
            <span className="text-red-400 font-bold shrink-0">ℹ️</span>
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage("")}
            className="text-red-400 hover:text-white shrink-0 ml-1 font-bold"
            title="Fechar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {resetMode ? (
        /* PASSWORD RESET MODE */
        <div className="space-y-2.5 text-left pt-0.5">
          {resetSent ? (
            <div className="bg-emerald-950/70 border border-emerald-500/50 p-3 rounded-xl space-y-2 text-center">
              <div className="h-8 w-8 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-sm font-bold">
                ✓
              </div>
              <h4 className="text-xs font-bold text-emerald-300">E-mail de Recuperação Enviado!</h4>
              <p className="text-[10px] text-slate-300 leading-normal">
                Enviámos um link seguro de redefinição de password para: <strong className="text-white font-mono">{email}</strong>.
                Abra o email e siga o link para definir uma nova palavra-passe.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">
                  E-mail da Conta
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="utilizador@condomanager.pt"
                    className="w-full bg-slate-950 border border-slate-800 text-xs rounded-lg p-2 pl-8 font-medium text-white focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute left-2.5 top-2.5 text-slate-500 text-xs">✉</span>
                </div>
              </div>

              <button
                type="button"
                disabled={sendingReset}
                onClick={handleEnviarEmailRecuperacao}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-slate-950 font-black py-2 rounded-lg text-xs tracking-wider uppercase cursor-pointer transition-all shadow-md flex items-center justify-center space-x-1.5"
              >
                <span>{sendingReset ? "A enviar..." : "Enviar E-mail de Recuperação"}</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setResetMode(false);
              setResetSent(false);
            }}
            className="w-full text-center text-[11px] text-slate-400 hover:text-white pt-1 block cursor-pointer transition-colors"
          >
            ← Voltar ao Login
          </button>
        </div>
      ) : (
        /* NORMAL LOGIN FORM */
        <form onSubmit={handleStandardLogin} className="space-y-3 text-left pt-0.5">
          {/* Email Field */}
          <div className="space-y-1">
            <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">
              E-MAIL DE UTILIZADOR
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMessage("");
                }}
                placeholder="o.seu.email@exemplo.com"
                className="w-full bg-[#070b14] border border-slate-800 text-xs rounded-xl p-2.5 pl-8 font-medium text-white focus:outline-none focus:border-emerald-500 transition-all"
              />
              <span className="absolute left-2.5 top-2.5 text-slate-500 text-xs">✉</span>
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">
                PALAVRA-PASSE
              </label>
              <button
                type="button"
                onClick={() => {
                  setResetMode(true);
                  setResetSent(false);
                }}
                className="text-[9px] text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer transition-colors"
              >
                Esqueceu-se da password?
              </button>
            </div>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMessage("");
                }}
                placeholder="••••••••"
                className="w-full bg-[#070b14] border border-slate-800 text-xs rounded-xl p-2.5 pl-8 font-mono text-white focus:outline-none focus:border-emerald-500 transition-all"
              />
              <span className="absolute left-2.5 top-2.5 text-slate-500 text-xs">🔒</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-1 space-y-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00ff88] hover:bg-[#00cc66] active:scale-98 text-black font-black py-2.5 rounded-xl text-center text-xs tracking-wider uppercase cursor-pointer transition-all shadow-md flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{loading ? "A verificar..." : "➔] ENTRAR"}</span>
            </button>

            {onOpenSecurityLogs && (
              <div className="flex justify-end items-center pt-2 border-t border-slate-800/80 text-[9px]">
                <button
                  type="button"
                  onClick={onOpenSecurityLogs}
                  className="text-blue-400 hover:text-blue-300 font-medium cursor-pointer transition-colors flex items-center space-x-1"
                >
                  <span>🛡 Registo de Acessos (local)</span>
                </button>
              </div>
            )}
          </div>
        </form>
      )}

      <div className="pt-3 border-t border-slate-800/80 flex justify-between items-center text-[9px] text-slate-500 font-mono">
        <span>SECURE SUPABASE AUTH</span>
        <span>CondoManager AI © 2026</span>
      </div>
    </div>
  );
}
