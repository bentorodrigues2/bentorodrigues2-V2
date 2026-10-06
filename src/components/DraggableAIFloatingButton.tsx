import React, { useState } from "react";
import { motion } from "motion/react";
import { LoggedUser, Predio, Fracao, Aviso, Conta } from "../types";
import { AIAssistantModal } from "./AIAssistantModal";

interface DraggableAIFloatingButtonProps {
  loggedUser: LoggedUser;
  predio: Predio;
  fracoes?: Fracao[];
  avisos?: Aviso[];
  contas?: Conta[];
  /** Optional container constraint ref or custom class */
  className?: string;
  /** Flag to indicate if rendering inside PWA viewport */
  isPWA?: boolean;
}

export function DraggableAIFloatingButton({
  loggedUser,
  predio,
  fracoes = [],
  avisos = [],
  contas = [],
  className = "",
  isPWA = false
}: DraggableAIFloatingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Role Gate: strictly for ADMIN, GESTOR and EMPRESA_GESTORA
  const isAllowedRole = 
    loggedUser?.role === "ADMIN" || 
    loggedUser?.role === "GESTOR" || 
    loggedUser?.role === "EMPRESA_GESTORA";

  if (!isAllowedRole) {
    return null;
  }

  return (
    <>
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.1}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => {
          // small delay so drag end does not trigger onClick
          setTimeout(() => setIsDragging(false), 150);
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className={`fixed z-[90] cursor-grab active:cursor-grabbing select-none ${
          isPWA 
            ? "bottom-20 right-4" 
            : "bottom-6 right-6"
        } ${className}`}
        style={{ touchAction: "none" }}
        title="Assistente Gemini IA Ativa • Arraste para mover ou clique para abrir"
      >
        <button
          type="button"
          id="btn-gemini-ia-ativa-floating"
          onClick={() => {
            if (!isDragging) {
              setIsOpen(true);
            }
          }}
          className="group relative flex items-center justify-center h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-slate-900 border-2 border-emerald-400/80 shadow-2xl shadow-emerald-950/80 hover:border-emerald-300 hover:shadow-emerald-500/40 transition-all p-1.5 backdrop-blur-lg focus:outline-none"
        >
          {/* Animated Ambient Pulse Ring */}
          <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 opacity-40 group-hover:opacity-80 blur-md transition-all animate-pulse pointer-events-none" />

          {/* Active Status Badge */}
          <span className="absolute -top-0.5 -right-0.5 z-10 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900 shadow-sm"></span>
          </span>

          {/* Assistant Image (Only Image) */}
          <div className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-slate-950">
            <img
              src="/modulos/87-ia-ativa.png"
              alt="Assistente IA Ativa"
              className="w-full h-full object-contain p-1 transform group-hover:scale-110 transition-transform duration-300 pointer-events-none drop-shadow-md"
              onError={(e) => {
                // Fallback in case of path issue
                (e.target as HTMLImageElement).src = "/public/modulos/87-ia-ativa.png";
              }}
            />
          </div>
        </button>
      </motion.div>

      {/* MODAL / GEMINI INTERFACE */}
      <AIAssistantModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        loggedUser={loggedUser}
        predio={predio}
        fracoes={fracoes}
        avisos={avisos}
        contas={contas}
      />
    </>
  );
}
