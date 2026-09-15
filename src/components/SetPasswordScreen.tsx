import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface SetPasswordScreenProps {
  email?: string;
  onDone: () => void;
}

/**
 * Ecrã mostrado quando a pessoa chega à app através de um link de
 * ativação de conta ou de recuperação de password (email enviado por
 * /api/admin?acao=convidar ou pelo "Esqueceu-se da password?" do login).
 * O Supabase já validou o link e criou uma sessão temporária — falta só
 * definir a password definitiva com supabase.auth.updateUser().
 */
export default function SetPasswordScreen({ email, onDone }: SetPasswordScreenProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const criterios = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
  const isValid = Object.values(criterios).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!isValid) {
      setErrorMessage("A palavra-passe tem de cumprir todos os requisitos abaixo.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("As palavras-passe não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMessage(`❌ ${error.message}`);
        return;
      }
      onDone();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center p-3 bg-[#030712]">
      <div className="max-w-[380px] w-full bg-[#0d1424] border border-slate-800 p-5 rounded-2xl shadow-2xl text-slate-100 space-y-4">
        <div className="text-center">
          <h2 className="text-sm font-extrabold tracking-wider text-white uppercase">Defina a sua Palavra-passe</h2>
          {email && <p className="text-[11px] text-slate-400 mt-1">{email}</p>}
        </div>

        {errorMessage && (
          <div className="bg-red-950/80 border border-red-500/60 p-2.5 rounded-xl text-red-200 text-[11px] font-medium">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          <div className="space-y-1">
            <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Nova Palavra-passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#070b14] border border-slate-800 text-xs rounded-xl p-2.5 font-mono text-white focus:outline-none focus:border-emerald-500"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Confirmar Palavra-passe</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#070b14] border border-slate-800 text-xs rounded-xl p-2.5 font-mono text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-[10px] space-y-1">
            <span className={criterios.minLength ? "text-emerald-400 font-bold block" : "text-slate-500 block"}>{criterios.minLength ? "✓" : "○"} Mínimo 8 caracteres</span>
            <span className={criterios.hasUppercase ? "text-emerald-400 font-bold block" : "text-slate-500 block"}>{criterios.hasUppercase ? "✓" : "○"} Uma letra maiúscula</span>
            <span className={criterios.hasLowercase ? "text-emerald-400 font-bold block" : "text-slate-500 block"}>{criterios.hasLowercase ? "✓" : "○"} Uma letra minúscula</span>
            <span className={criterios.hasNumber ? "text-emerald-400 font-bold block" : "text-slate-500 block"}>{criterios.hasNumber ? "✓" : "○"} Um número</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00ff88] hover:bg-[#00cc66] disabled:opacity-60 text-black font-black py-2.5 rounded-xl text-center text-xs tracking-wider uppercase cursor-pointer transition-all shadow-md"
          >
            {loading ? "A gravar..." : "Definir Palavra-passe & Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
