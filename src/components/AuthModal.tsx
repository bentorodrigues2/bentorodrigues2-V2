import React from "react";
import AuthForm from "./AuthForm";

interface AuthModalProps {
  onClose: () => void;
  onLoginSuccess?: (email: string) => void;
  onOpenSecurityLogs?: () => void;
}

export default function AuthModal({ onClose, onLoginSuccess, onOpenSecurityLogs }: AuthModalProps) {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 bg-slate-800 hover:bg-slate-700 text-slate-600 hover:text-white h-8 w-8 rounded-full border border-slate-700 flex items-center justify-center font-bold text-sm shadow-lg transition-colors cursor-pointer"
          title="Fechar Portal"
        >
          ✕
        </button>

        <AuthForm 
          onLoginSuccess={(email) => {
            if (onLoginSuccess) {
              onLoginSuccess(email);
            }
          }}
          onOpenSecurityLogs={onOpenSecurityLogs}
        />
      </div>
    </div>
  );
}
