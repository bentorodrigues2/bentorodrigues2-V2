import React, { useState, useEffect } from "react";
import { Predio, LoggedUser } from "../types";
import { Wrench, Plus, Check, MapPin, Sparkles, Building, Landmark, Trash2, ShieldAlert } from "lucide-react";

interface EquipamentoTecnico {
  id: string;
  nome: string;
  categoria: string;
  andar: string;
  estado: "Excelente" | "Operacional" | "Necessita Manutenção" | "Crítico";
  ultimaInspecao: string;
  frequenciaInspecao: string;
  fabricante?: string;
  detalhes?: string;
}

interface InventarioTecnicoProps {
  predio: Predio;
  loggedUser: LoggedUser;
}

export function InventarioTecnico({ predio, loggedUser }: InventarioTecnicoProps) {
  // Estado limpo para testes com Supabase
  const [equipamentos, setEquipamentos] = useState<EquipamentoTecnico[]>(() => {
    const saved = localStorage.getItem(`inventario_tecnico_${predio.id_predio}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return [];
  });

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem(`inventario_tecnico_${predio.id_predio}`, JSON.stringify(equipamentos));
  }, [equipamentos, predio.id_predio]);

  // Form states to add custom equipment
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("Elevadores");
  const [andar, setAndar] = useState("Piso 0");
  const [estado, setEstado] = useState<EquipamentoTecnico["estado"]>("Operacional");
  const [fabricante, setFabricante] = useState("");
  const [detalhes, setDetalhes] = useState("");

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
      detalhes: detalhes || "Adicionado via painel técnico."
    };

    setEquipamentos([...equipamentos, newEquipment]);
    setNome("");
    setFabricante("");
    setDetalhes("");
    alert(`Equipamento "${nome}" adicionado com sucesso! Aparece automaticamente mapeado na planta técnica do edifício.`);
  };

  const handleRemove = (id: string) => {
    const confirmRemove = confirm("Tem a certeza que deseja remover este equipamento do inventário do prédio?");
    if (confirmRemove) {
      setEquipamentos(equipamentos.filter(e => e.id !== id));
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
            <span className="text-[10px] text-slate-400 uppercase block font-bold">Total Equipamentos</span>
            <span className="text-xl font-bold font-mono">{equipamentos.length}</span>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/40 p-2.5 rounded-lg text-blue-500">
            <Wrench className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase block font-bold">Estado Excelente</span>
            <span className="text-xl font-bold font-mono text-emerald-600">{equipamentos.filter(e => e.estado === "Excelente").length}</span>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg text-emerald-500">
            <Check className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase block font-bold">Em Monitorização</span>
            <span className="text-xl font-bold font-mono text-amber-600">{equipamentos.filter(e => e.estado === "Operacional").length}</span>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg text-amber-500">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase block font-bold">Manutenção / Crítico</span>
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
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Plus className="h-4 w-4 text-emerald-500" />
              Adicionar Equipamento Personalizado
            </h3>
            <p className="text-[11px] text-slate-500">Novos equipamentos aparecem instantaneamente no mapeamento técnico da planta.</p>
          </div>

          <form onSubmit={handleAddCustom} className="space-y-3.5">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Nome do Equipamento / Modelo</label>
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
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Categoria Técnica</label>
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
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Localização (Andar)</label>
                <select
                  value={andar}
                  onChange={e => setAndar(e.target.value)}
                  className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold cursor-pointer"
                >
                  <option value="Piso -2">Piso -2</option>
                  <option value="Piso -1">Piso -1 (Garagem)</option>
                  <option value="Piso 0">Piso 0 (Átrio)</option>
                  <option value="Piso 1">Piso 1</option>
                  <option value="Piso 2">Piso 2</option>
                  <option value="Piso 3">Piso 3</option>
                  <option value="Cobertura">Cobertura</option>
                  <option value="Exterior">Exterior</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Estado de Conservação</label>
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
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Fabricante / Fornecedor</label>
              <input
                type="text"
                value={fabricante}
                onChange={e => setFabricante(e.target.value)}
                placeholder="Ex: Schindler Lda."
                className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Notas Técnicas / Observações</label>
              <textarea
                value={detalhes}
                onChange={e => setDetalhes(e.target.value)}
                placeholder="Ex: Rolamento substituído recentemente. Monitorizar ruído térmico."
                rows={3}
                className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
              />
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
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Building className="h-4 w-4 text-blue-500" />
                Mapa Visual Técnico do Edifício
              </h3>
              <p className="text-[11px] text-slate-500">Mapeamento dinâmico por andar. Os equipamentos customizados são plotados abaixo.</p>
            </div>

            {/* Simulated Floors schematic */}
            <div className="border rounded-xl overflow-hidden bg-slate-950 text-white p-4 space-y-3 font-mono text-xs">
              
              {/* Cobertura */}
              <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex justify-between items-center hover:border-slate-700 transition-colors">
                <span className="font-bold text-slate-400">🏢 COBERTURA / TELHADO:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {equipamentos.filter(e => e.andar.toLowerCase().includes("cobertura") || e.andar.toLowerCase().includes("telhado")).map(e => (
                    <span key={e.id} className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold" title={e.detalhes}>
                      ⚙️ {e.nome.split(" ")[0]}
                    </span>
                  ))}
                  {equipamentos.filter(e => e.andar.toLowerCase().includes("cobertura") || e.andar.toLowerCase().includes("telhado")).length === 0 && (
                    <span className="text-[9px] text-slate-600">Nenhum equipamento</span>
                  )}
                </div>
              </div>

              {/* Pisos intermédios */}
              <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex justify-between items-center hover:border-slate-700 transition-colors">
                <span className="font-bold text-slate-400">🏢 PISOS SUPERIORES (1º ao 3º):</span>
                <div className="flex gap-1.5 flex-wrap">
                  {equipamentos.filter(e => e.andar.includes("Piso 1") || e.andar.includes("Piso 2") || e.andar.includes("Piso 3") || e.andar.includes("Todos")).map(e => (
                    <span key={e.id} className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold" title={e.detalhes}>
                      ⚡ {e.nome.split(" ")[0]}
                    </span>
                  ))}
                </div>
              </div>

              {/* Piso 0 */}
              <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex justify-between items-center hover:border-slate-700 transition-colors">
                <span className="font-bold text-slate-400">🏢 PISO 0 / ÁTRIO & LAZER:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {equipamentos.filter(e => e.andar.includes("Piso 0") || e.andar.toLowerCase().includes("átrio")).map(e => (
                    <span key={e.id} className="bg-purple-500/10 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold" title={e.detalhes}>
                      💧 {e.nome.split(" ")[0]}
                    </span>
                  ))}
                </div>
              </div>

              {/* Garagem & Subterrâneos */}
              <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex justify-between items-center hover:border-slate-700 transition-colors">
                <span className="font-bold text-slate-400">🚗 SUBTERRÂNEOS (Piso -1 ao -2):</span>
                <div className="flex gap-1.5 flex-wrap">
                  {equipamentos.filter(e => e.andar.includes("-1") || e.andar.includes("-2") || e.andar.toLowerCase().includes("garagem")).map(e => (
                    <span key={e.id} className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold" title={e.detalhes}>
                      🔥 {e.nome.split(" ")[0]}
                    </span>
                  ))}
                </div>
              </div>

              {/* Exterior */}
              <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex justify-between items-center hover:border-slate-700 transition-colors">
                <span className="font-bold text-slate-400">🌳 ÁREAS EXTERIORES & PISCINA:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {equipamentos.filter(e => e.andar.toLowerCase().includes("exterior") || e.andar.toLowerCase().includes("jardim")).map(e => (
                    <span key={e.id} className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold" title={e.detalhes}>
                      🏊 {e.nome.split(" ")[0]}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Equipment table list */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Listagem de Equipamentos Registados</h3>
            
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {equipamentos.map(e => (
                <div key={e.id} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:border-slate-350 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] bg-slate-200 dark:bg-slate-850 px-2 rounded font-mono font-bold">ID: {e.id}</span>
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
                    <p className="text-[11px] text-slate-500 font-medium leading-tight">{e.detalhes}</p>
                    
                    <div className="flex gap-3 text-[10px] text-slate-400 pt-1 font-semibold">
                      <span>Piso: <strong className="text-slate-600 dark:text-slate-300">{e.andar}</strong></span>
                      <span>•</span>
                      <span>Fabricante: <strong className="text-slate-600 dark:text-slate-300">{e.fabricante || "N/A"}</strong></span>
                      <span>•</span>
                      <span>Inspecção: <strong className="text-slate-600 dark:text-slate-300">{e.ultimaInspecao} ({e.frequenciaInspecao})</strong></span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemove(e.id)}
                    className="p-1.5 rounded-lg border bg-white dark:bg-slate-900 text-slate-400 hover:text-red-500 hover:border-red-200 shrink-0 self-end sm:self-center cursor-pointer shadow-sm"
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
