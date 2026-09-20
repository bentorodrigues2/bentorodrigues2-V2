import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

interface AccordionSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

// Secção retrátil (acordeão) reutilizável — usada para transformar ecrãs
// estáticos com tudo sempre visível (obrigando a scroll infinito) em blocos
// que abrem/fecham conforme selecionados, mantendo tudo fechado por omissão.
export function AccordionSection({ title, subtitle, icon, badge, defaultOpen = false, children }: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 p-5 cursor-pointer hover:bg-slate-50/60 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">{icon}</div>}
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800 truncate">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {badge}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-slate-100 space-y-4 animate-fadeIn">
          {children}
        </div>
      )}
    </div>
  );
}
