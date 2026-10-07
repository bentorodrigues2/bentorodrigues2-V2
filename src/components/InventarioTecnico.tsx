import React, { useState, useEffect, useMemo, useRef } from "react";
import { Predio, LoggedUser, Fracao } from "../types";
import { Wrench, Plus, Check, MapPin, Sparkles, Building, Landmark, Trash2, ShieldAlert, Camera, X } from "lucide-react";
import { fetchInventarioTecnicoFromSupabase, saveEquipamentoTecnicoToSupabase, deleteEquipamentoTecnicoFromSupabase, registarLogAuditoria } from "../lib/supabaseService";

export interface EquipamentoTecnico {
  id: string;
  nome: string;
  categoria: string;
  andar: string;
  estado: "Excelente" | "Operacional" | "Necessita Manutenção" | "Crítico";
  ultimaInspecao: string;
  frequenciaInspecao: string;
  fabricante?: string;
  detalhes?: string;
  fotos?: string[];
}

interface InventarioTecnicoProps {
  predio: Predio;
  loggedUser: LoggedUser;
  fracoes?: Fracao[];
}

export function InventarioTecnico({ predio, loggedUser, fracoes = [] }: InventarioTecnicoProps) {
  // Carregado do Supabase (tabela real inventario_tecnico)
  const [equipamentos, setEquipamentos] = useState<EquipamentoTecnico[]>([]);

  useEffect(() => {
    if (!predio.id_predio) return;
    fetchInventarioTecnicoFromSupabase(predio.id_predio).then(dados => { if (dados) setEquipamentos(dados); });
  }, [predio.id_predio]);

  // Form states to add custom equipment
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("Elevadores");
  const [andar, setAndar] = useState("");
  const [estado, setEstado] = useState<EquipamentoTecnico["estado"]>("Operacional");
  const [fabricante, setFabricante] = useState("");
  const [detalhes, setDetalhes] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  // Pisos reais deste prédio (a partir das frações reais) — antes era uma
  // lista fixa "Piso -2" a "Piso 3", que não correspondia a este edifício
  // (tem lojas no rés-do-chão e frações até ao 5º andar; "Piso 3" era o
  // topo da lista, deixando o 4º e o 5º andar impossíveis de selecionar).
  const pisosReais = useMemo(() => {
    const predioFracoes = fracoes.filter(f => f.id_predio === predio.id_predio);
    const numeros = new Set<number>();
    predioFracoes.forEach(f => {
      const match = (f.piso || "").match(/^(\d+)º/);
      if (match) numeros.add(Number(match[1]));
    });
    const pisosNumerados = Array.from(numeros).sort((a, b) => a - b).map(n => `${n}º Piso`);
    const temLojas = predioFracoes.some(f => (f.piso || "").toLowerCase().includes("loja"));
    return [
      "Cave / Garagem",
      ...(temLojas ? ["Rés-do-Chão (Lojas)"] : []),
      ...pisosNumerados,
      "Cobertura",
      "Exterior"
    ];
  }, [fracoes, predio.id_predio]);

  useEffect(() => {
    if (!andar && pisosReais.length > 0) setAndar(pisosReais[0]);
  }, [pisosReais, andar]);

  // Converte cada fotografia escolhida para base64 comprimido (mesmo
  // padrão já usado noutros ecrãs, ex: avatar do perfil) — várias fotos
  // de uma vez, anexadas à lista já existente.
  const handleFotosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []);
    e.target.value = "";
    files.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 700;
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
          setFotos(prev => [...prev, canvas.toDataURL("image/webp", 0.8)]);
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    const newEquipment: EquipamentoTecnico = {
      id: "eq-custom-" + Date.now(),
      nome,
      categoria,
      andar,
      estado,
      ultimaInspecao: new Date().toISOString().substring(0, 10),
      frequenciaInspecao: "Anual",
      fabricante: fabricante || "Personalizado",
      detalhes: detalhes || "Adicionado via painel técnico.",
      fotos
    };

    setEquipamentos([...equipamentos, newEquipment]);
    saveEquipamentoTecnicoToSupabase(predio.id_predio, newEquipment).catch(console.error);
    registarLogAuditoria("Manutenção", `Adicionou "${nome}" ao inventário técnico`, predio.id_predio, loggedUser);
    setNome("");
    setFabricante("");
    setDetalhes("");
    setFotos([]);
    alert(`Equipamento "${nome}" adicionado com sucesso! Aparece automaticamente mapeado na planta técnica do edifício.`);
  };

  const handleRemove = (id: string) => {
    const confirmRemove = confirm("Tem a certeza que deseja remover este equipamento do inventário do prédio?");
    if (confirmRemove) {
      setEquipamentos(equipamentos.filter(e => e.id !== id));
      deleteEquipamentoTecnicoFromSupabase(id).catch(console.error);
    }
  };

  // Pre-defined categories required in Document D
  const categoriesList = [
    "Elevadores",
    "Bombas de água",
    "Motores",
    "Portas corta-fogo",
    "Sistema de incêndio",
    "Sistema de gás",
    "Sistema elétrico",
    "Piscina (bombas, filtros, motores)",
    "Spa (motores, filtros, aquecimento)",
    "Ginásio (equipamentos de ginástica)"
  ];

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 animate-fadeIn">
      
      {/* Overview stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-600 uppercase block font-bold">Total Equipamentos</span>
            <span className="text-xl font-bold font-mono">{equipamentos.length}</span>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/40 p-2.5 rounded-lg text-blue-500">
            <Wrench className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-600 uppercase block font-bold">Estado Excelente</span>
            <span className="text-xl font-bold font-mono text-emerald-600">{equipamentos.filter(e => e.estado === "Excelente").length}</span>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg text-emerald-500">
            <Check className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-600 uppercase block font-bold">Em Monitorização</span>
            <span className="text-xl font-bold font-mono text-amber-600">{equipamentos.filter(e => e.estado === "Operacional").length}</span>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg text-amber-500">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-600 uppercase block font-bold">Manutenção / Crítico</span>
            <span className="text-xl font-bold font-mono text-red-600">{equipamentos.filter(e => ["Necessita Manutenção", "Crítico"].includes(e.estado)).length}</span>
          </div>
          <div className="bg-red-50 dark:bg-red-950/40 p-2.5 rounded-lg text-red-500">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Add customized equipment */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 h-fit">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
              <Plus className="h-4 w-4 text-emerald-500" />
              Adicionar Equipamento Personalizado
            </h3>
            <p className="text-[11px] text-slate-600">Novos equipamentos aparecem instantaneamente no mapeamento técnico da planta.</p>
          </div>

          <form onSubmit={handleAddCustom} className="space-y-3.5">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Nome do Equipamento / Modelo</label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Motor do Portão de Garagem Ditec"
                className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Categoria Técnica</label>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold cursor-pointer"
              >
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Localização (Andar)</label>
                <select
                  value={andar}
                  onChange={e => setAndar(e.target.value)}
                  className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold cursor-pointer"
                >
                  {pisosReais.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Estado de Conservação</label>
                <select
                  value={estado}
                  onChange={e => setEstado(e.target.value as any)}
                  className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold cursor-pointer"
                >
                  <option value="Excelente">Excelente</option>
                  <option value="Operacional">Operacional</option>
                  <option value="Necessita Manutenção">Manutenção</option>
                  <option value="Crítico">Crítico</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Fabricante / Fornecedor</label>
              <input
                type="text"
                value={fabricante}
                onChange={e => setFabricante(e.target.value)}
                placeholder="Ex: Schindler Lda."
                className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Notas Técnicas / Observações</label>
              <textarea
                value={detalhes}
                onChange={e => setDetalhes(e.target.value)}
                placeholder="Ex: Rolamento substituído recentemente. Monitorizar ruído térmico."
                rows={3}
                className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Fotografias</label>
              <input ref={fotoInputRef} type="file" accept="image/*" multiple capture="environment" onChange={handleFotosChange} className="hidden" />
              <button
                type="button"
                onClick={() => fotoInputRef.current?.click()}
                className="w-full border border-dashed p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:border-emerald-400 hover:text-emerald-600"
              >
                <Camera className="h-4 w-4" />
                <span>{fotos.length > 0 ? `${fotos.length} fotografia(s) anexada(s) — adicionar mais` : "Adicionar Fotografias"}</span>
              </button>
              {fotos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {fotos.map((f, i) => (
                    <div key={i} className="relative h-14 w-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                      <img src={f} className="h-full w-full object-cover" alt="" />
                      <button
                        type="button"
                        onClick={() => setFotos(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity"
                        title="Remover fotografia"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-xs cursor-pointer shadow flex items-center justify-center gap-1"
            >
              <Plus className="h-4 w-4" />
              <span>Inserir no Mapa Técnico</span>
            </button>
          </form>
        </div>

        {/* Right columns: List and interactive building schema */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Planta / Schema visual do Edifício */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Building className="h-4 w-4 text-blue-500" />
                Mapa Visual Técnico do Edifício
              </h3>
              <p className="text-[11px] text-slate-600">Mapeamento dinâmico por andar. Os equipamentos customizados são plotados abaixo.</p>
            </div>

            {/* Simulated Floors schematic — uma linha por piso real deste
                prédio (pisosReais), de cima para baixo, em vez de grupos
                fixos ("1º ao 3º") que já não cobriam os pisos 4º/5º reais
                desta morada. */}
            <div className="border rounded-xl overflow-hidden bg-slate-950 text-white p-4 space-y-3 font-mono text-xs">
              {[...pisosReais].reverse().map(piso => {
                const equipamentosDoPiso = equipamentos.filter(e => e.andar === piso);
                const emoji = piso === "Cobertura" ? "🏢" : piso === "Exterior" ? "🌳" : piso.includes("Cave") || piso.includes("Garagem") ? "🚗" : piso.includes("Loja") ? "🏪" : "🏢";
                return (
                  <div key={piso} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex justify-between items-center hover:border-slate-700 transition-colors">
                    <span className="font-bold text-slate-600">{emoji} {piso.toUpperCase()}:</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {equipamentosDoPiso.map(e => (
                        <span key={e.id} className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold" title={e.detalhes}>
                          ⚙️ {e.nome.split(" ")[0]}
                        </span>
                      ))}
                      {equipamentosDoPiso.length === 0 && (
                        <span className="text-[9px] text-slate-600">Nenhum equipamento</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Equipment table list */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600">Listagem de Equipamentos Registados</h3>
            
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {equipamentos.map(e => (
                <div key={e.id} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:border-slate-300 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] bg-slate-200 dark:bg-slate-800 px-2 rounded font-mono font-bold">ID: {e.id}</span>
                      <span className="text-[10px] bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 px-2 rounded font-bold font-mono">{e.categoria}</span>
                      <span className={`text-[9px] px-2 rounded font-bold uppercase ${
                        e.estado === "Excelente" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400" :
                        e.estado === "Operacional" ? "bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400" :
                        e.estado === "Necessita Manutenção" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400" :
                        "bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400 animate-pulse"
                      }`}>
                        {e.estado}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{e.nome}</h4>
                    <p className="text-[11px] text-slate-600 font-medium leading-tight">{e.detalhes}</p>

                    <div className="flex gap-3 text-[10px] text-slate-600 pt-1 font-semibold">
                      <span>Piso: <strong className="text-slate-600 dark:text-slate-300">{e.andar}</strong></span>
                      <span>•</span>
                      <span>Fabricante: <strong className="text-slate-600 dark:text-slate-300">{e.fabricante || "N/A"}</strong></span>
                      <span>•</span>
                      <span>Inspecção: <strong className="text-slate-600 dark:text-slate-300">{e.ultimaInspecao} ({e.frequenciaInspecao})</strong></span>
                    </div>

                    {e.fotos && e.fotos.length > 0 && (
                      <div className="flex gap-1.5 pt-1">
                        {e.fotos.map((f, i) => (
                          <a key={i} href={f} target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 hover:scale-110 transition-transform">
                            <img src={f} className="h-full w-full object-cover" alt="" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleRemove(e.id)}
                    className="p-1.5 rounded-lg border bg-white dark:bg-slate-900 text-slate-600 hover:text-red-500 hover:border-red-200 shrink-0 self-end sm:self-center cursor-pointer shadow-sm"
                    title="Remover Equipamento"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
