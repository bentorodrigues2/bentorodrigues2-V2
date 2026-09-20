import React, { useEffect, useRef, useState } from "react";
import { Filter } from "lucide-react";

interface ColumnFilterDropdownProps {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

// Filtro por coluna estilo Excel/Outlook: ícone de funil no cabeçalho abre
// uma lista de valores únicos com caixas de seleção (+ pesquisa e
// selecionar/limpar tudo), em vez de um campo de texto livre.
export function ColumnFilterDropdown({ label, options, selected, onChange }: ColumnFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const opcoesUnicas = Array.from(new Set(options));
  const opcoesFiltradas = opcoesUnicas.filter((o) => o.toLowerCase().includes(busca.toLowerCase()));
  const filtroAtivo = selected.size > 0 && selected.size < opcoesUnicas.length;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`inline-flex items-center ml-1 cursor-pointer ${filtroAtivo ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"}`}
        title={`Filtrar por ${label}`}
      >
        <Filter className="w-3 h-3" fill={filtroAtivo ? "currentColor" : "none"} />
      </button>
      {open && (
        <div
          className="absolute z-30 mt-1.5 left-0 w-56 bg-white border border-slate-200 rounded-lg shadow-lg p-2 text-slate-700 normal-case font-normal"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar..."
            className="w-full border border-slate-200 rounded px-2 py-1 text-xs mb-1.5 focus:outline-emerald-500"
          />
          <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-100 mb-1">
            <button type="button" onClick={() => onChange(new Set(opcoesUnicas))} className="text-[10px] text-emerald-600 hover:underline cursor-pointer">
              Selecionar Tudo
            </button>
            <button type="button" onClick={() => onChange(new Set())} className="text-[10px] text-slate-400 hover:underline cursor-pointer">
              Limpar
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {opcoesFiltradas.length === 0 ? (
              <p className="text-[10px] text-slate-400 px-1 py-1">Sem resultados.</p>
            ) : (
              opcoesFiltradas.map((o) => (
                <label key={o} className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-slate-50 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={selected.has(o)}
                    onChange={() => {
                      const next = new Set(selected);
                      if (next.has(o)) next.delete(o);
                      else next.add(o);
                      onChange(next);
                    }}
                    className="cursor-pointer"
                  />
                  <span className="truncate">{o || "(Vazio)"}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
