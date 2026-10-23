import React, { useState, useEffect, useMemo, useRef } from "react";
import { Predio, LoggedUser, Fracao } from "../types";
import { Wrench, Plus, Check, MapPin, Sparkles, Building, Landmark, Trash2, ShieldAlert, Camera, X, Pencil, CalendarCheck, FileText, Paperclip, Bell } from "lucide-react";
import { fetchInventarioTecnicoFromSupabase, saveEquipamentoTecnicoToSupabase, deleteEquipamentoTecnicoFromSupabase, registarLogAuditoria, uploadDocumentoToStorage } from "../lib/supabaseService";
import { formatDatePT } from "../utils";

export interface HistoricoVistoriaEquipamento {
  id: string;
  data: string;
  tecnico: string;
  resultado: "Aprovado" | "Aprovado com Reservas" | "Reprovado";
  observacoes?: string;
  documentoUrl?: string;
  documentoNome?: string;
}

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
  // Unificação com o antigo "Plano de Manutenção Obrigatória" (2026-10-22,
  // pedido explícito do administrador: um só ecrã, sem duplicação) — uma
  // vistoria (agendada ou avulsa) atualiza sempre ultimaInspecao e agenda
  // automaticamente proximaInspecaoData, para o cron poder alertar antes do
  // vencimento (ver alertarInspecoesEquipamentosAVencer em cronService.js).
  entidadeResponsavel?: string;
  baseLegalDgeg?: string;
  numCertificadoRelatorio?: string;
  proximaInspecaoData?: string;
  diasAlertaAntecedencia?: number;
  alertaEnviadoEm?: string;
  historicoVistorias?: HistoricoVistoriaEquipamento[];
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

  // Form states to add custom equipment — reutilizado também para Editar
  // (ver editingId/iniciarEdicao): quando definido, handleAddCustom
  // atualiza em vez de criar.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("Elevadores");
  const [andar, setAndar] = useState("");
  const [estado, setEstado] = useState<EquipamentoTecnico["estado"]>("Operacional");
  const [fabricante, setFabricante] = useState("");
  const [detalhes, setDetalhes] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [frequenciaInspecao, setFrequenciaInspecao] = useState("Anual");
  const [entidadeResponsavel, setEntidadeResponsavel] = useState("");
  const [baseLegalDgeg, setBaseLegalDgeg] = useState("");
  const [diasAlertaAntecedencia, setDiasAlertaAntecedencia] = useState(30);

  // Converte o rótulo de periodicidade (igual ao já usado em toda a app,
  // ex: contratos de fornecedores) no número de meses correspondente, para
  // calcular a próxima inspeção automaticamente a seguir a cada vistoria.
  const periodicidadeParaMeses = (freq: string): number => {
    const f = freq.toLowerCase();
    if (f.includes("mensal")) return 1;
    if (f.includes("trimestral")) return 3;
    if (f.includes("semestral")) return 6;
    if (f.includes("bianual") || f.includes("2 anos")) return 24;
    return 12; // Anual, por omissão
  };

  const calcularProximaInspecao = (dataBase: string, freq: string): string => {
    const d = new Date(dataBase);
    d.setMonth(d.getMonth() + periodicidadeParaMeses(freq));
    return d.toISOString().split("T")[0];
  };

  const limparFormulario = () => {
    setEditingId(null);
    setNome("");
    setCategoria("Elevadores");
    setEstado("Operacional");
    setFabricante("");
    setDetalhes("");
    setFotos([]);
    setFrequenciaInspecao("Anual");
    setEntidadeResponsavel("");
    setBaseLegalDgeg("");
    setDiasAlertaAntecedencia(30);
  };

  const iniciarEdicao = (eq: EquipamentoTecnico) => {
    setEditingId(eq.id);
    setNome(eq.nome);
    setCategoria(eq.categoria);
    setAndar(eq.andar);
    setEstado(eq.estado);
    setFabricante(eq.fabricante || "");
    setDetalhes(eq.detalhes || "");
    setFotos(eq.fotos || []);
    setFrequenciaInspecao(eq.frequenciaInspecao || "Anual");
    setEntidadeResponsavel(eq.entidadeResponsavel || "");
    setBaseLegalDgeg(eq.baseLegalDgeg || "");
    setDiasAlertaAntecedencia(eq.diasAlertaAntecedencia ?? 30);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- Registar Vistoria (agendada ou avulsa) ---
  // Atualiza logo a validade (ultimaInspecao) e agenda automaticamente a
  // próxima inspeção, para o alerta de antecedência (cron) saber quando
  // disparar — pedido explícito do administrador: "se houve uma revisão
  // tem de acertar logo a validade... e programar a próxima inspeção".
  const [vistoriaTargetId, setVistoriaTargetId] = useState<string | null>(null);
  // Quando definido, o modal passa a EDITAR esta entrada já gravada do
  // histórico em vez de criar uma nova — antes não havia forma nenhuma de
  // corrigir uma vistoria já registada (ex: relatório do técnico anexado
  // por engano, dados errados).
  const [vistoriaEditId, setVistoriaEditId] = useState<string | null>(null);
  const [vistoriaData, setVistoriaData] = useState(() => new Date().toISOString().split("T")[0]);
  const [vistoriaTecnico, setVistoriaTecnico] = useState("");
  const [vistoriaResultado, setVistoriaResultado] = useState<HistoricoVistoriaEquipamento["resultado"]>("Aprovado");
  const [vistoriaObservacoes, setVistoriaObservacoes] = useState("");
  const [vistoriaDocFile, setVistoriaDocFile] = useState<File | null>(null);
  // Documento já existente (só relevante em edição) e se o administrador
  // pediu para o remover sem escolher um novo — sem isto não havia forma de
  // remover um anexo errado, só de o substituir.
  const [vistoriaDocExistente, setVistoriaDocExistente] = useState<{ url: string; nome?: string } | null>(null);
  const [vistoriaDocRemovido, setVistoriaDocRemovido] = useState(false);
  const [aGravarVistoria, setAGravarVistoria] = useState(false);
  const vistoriaDocInputRef = useRef<HTMLInputElement>(null);

  const abrirRegistarVistoria = (eq: EquipamentoTecnico) => {
    setVistoriaTargetId(eq.id);
    setVistoriaEditId(null);
    setVistoriaData(new Date().toISOString().split("T")[0]);
    setVistoriaTecnico("");
    setVistoriaResultado("Aprovado");
    setVistoriaObservacoes("");
    setVistoriaDocFile(null);
    setVistoriaDocExistente(null);
    setVistoriaDocRemovido(false);
  };

  const iniciarEdicaoVistoria = (eq: EquipamentoTecnico, v: HistoricoVistoriaEquipamento) => {
    setVistoriaTargetId(eq.id);
    setVistoriaEditId(v.id);
    setVistoriaData(v.data);
    setVistoriaTecnico(v.tecnico === "Não identificado" ? "" : v.tecnico);
    setVistoriaResultado(v.resultado);
    setVistoriaObservacoes(v.observacoes || "");
    setVistoriaDocFile(null);
    setVistoriaDocExistente(v.documentoUrl ? { url: v.documentoUrl, nome: v.documentoNome } : null);
    setVistoriaDocRemovido(false);
  };

  const handleGravarVistoria = async (e: React.FormEvent) => {
    e.preventDefault();
    const eqAlvo = equipamentos.find(eq => eq.id === vistoriaTargetId);
    if (!eqAlvo) return;
    setAGravarVistoria(true);
    try {
      let documentoUrl: string | undefined;
      let documentoNome: string | undefined;
      if (vistoriaDocFile) {
        const caminho = `inventario_tecnico/${predio.id_predio}/${eqAlvo.id}/${Date.now()}-${vistoriaDocFile.name}`;
        documentoUrl = (await uploadDocumentoToStorage(vistoriaDocFile, caminho)) || undefined;
        if (!documentoUrl) {
          alert("❌ Não foi possível carregar o documento comprovativo. Tente novamente.");
          setAGravarVistoria(false);
          return;
        }
        documentoNome = vistoriaDocFile.name;
      } else if (vistoriaEditId && !vistoriaDocRemovido && vistoriaDocExistente) {
        // Em edição, sem ficheiro novo escolhido e sem pedido de remoção —
        // mantém o documento já anexado em vez de o apagar silenciosamente.
        documentoUrl = vistoriaDocExistente.url;
        documentoNome = vistoriaDocExistente.nome;
      }

      const entradaVistoria: HistoricoVistoriaEquipamento = {
        id: vistoriaEditId || `vist-${Date.now()}`,
        data: vistoriaData,
        tecnico: vistoriaTecnico || "Não identificado",
        resultado: vistoriaResultado,
        observacoes: vistoriaObservacoes || undefined,
        documentoUrl,
        documentoNome
      };

      const historicoAtualizado = vistoriaEditId
        ? (eqAlvo.historicoVistorias || []).map(v => v.id === vistoriaEditId ? entradaVistoria : v)
        : [entradaVistoria, ...(eqAlvo.historicoVistorias || [])];

      // A validade/estado do equipamento refletem sempre a vistoria mais
      // RECENTE por data (não a última gravada) — importante em edição,
      // onde corrigir a data de uma entrada antiga não pode mudar a
      // validade atual se já houver uma vistoria mais recente no histórico.
      const maisRecente = [...historicoAtualizado].sort((a, b) => b.data.localeCompare(a.data))[0];
      const novoEstado: EquipamentoTecnico["estado"] =
        maisRecente.resultado === "Reprovado" ? "Crítico" :
        maisRecente.resultado === "Aprovado com Reservas" ? "Necessita Manutenção" :
        "Operacional";
      const proximaInspecao = calcularProximaInspecao(maisRecente.data, eqAlvo.frequenciaInspecao || "Anual");

      const equipamentoAtualizado: EquipamentoTecnico = {
        ...eqAlvo,
        estado: novoEstado,
        ultimaInspecao: maisRecente.data,
        proximaInspecaoData: proximaInspecao,
        // Reposto a undefined sempre que a próxima inspeção muda, para o
        // cron poder voltar a alertar no novo ciclo.
        alertaEnviadoEm: undefined,
        historicoVistorias: historicoAtualizado
      };

      const ok = await saveEquipamentoTecnicoToSupabase(predio.id_predio, equipamentoAtualizado);
      if (!ok) {
        alert("❌ Não foi possível gravar a vistoria. Tente novamente.");
        return;
      }
      setEquipamentos(prev => prev.map(eq => eq.id === eqAlvo.id ? equipamentoAtualizado : eq));
      registarLogAuditoria("Manutenção", `${vistoriaEditId ? "Editou" : "Registou"} vistoria de "${eqAlvo.nome}" (${vistoriaResultado}) — próxima inspeção agendada para ${formatDatePT(proximaInspecao)}`, predio.id_predio, loggedUser, vistoriaObservacoes || undefined);
      setVistoriaTargetId(null);
      setVistoriaEditId(null);
      alert(vistoriaEditId
        ? `✅ Vistoria atualizada! Validade e próxima inspeção recalculadas para ${formatDatePT(proximaInspecao)}.`
        : `✅ Vistoria registada! Validade atualizada e próxima inspeção agendada para ${formatDatePT(proximaInspecao)}.`);
    } finally {
      setAGravarVistoria(false);
    }
  };

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

    const existente = editingId ? equipamentos.find(eq => eq.id === editingId) : null;
    const equipment: EquipamentoTecnico = {
      id: editingId || "eq-custom-" + Date.now(),
      nome,
      categoria,
      andar,
      estado,
      ultimaInspecao: existente?.ultimaInspecao || new Date().toISOString().substring(0, 10),
      frequenciaInspecao,
      fabricante: fabricante || "Personalizado",
      detalhes: detalhes || "Adicionado via painel técnico.",
      fotos,
      entidadeResponsavel: entidadeResponsavel || undefined,
      baseLegalDgeg: baseLegalDgeg || undefined,
      diasAlertaAntecedencia,
      proximaInspecaoData: existente?.proximaInspecaoData,
      alertaEnviadoEm: existente?.alertaEnviadoEm,
      historicoVistorias: existente?.historicoVistorias || []
    };

    if (editingId) {
      setEquipamentos(prev => prev.map(eq => eq.id === editingId ? equipment : eq));
    } else {
      setEquipamentos(prev => [...prev, equipment]);
    }
    saveEquipamentoTecnicoToSupabase(predio.id_predio, equipment).catch(console.error);
    registarLogAuditoria("Manutenção", `${editingId ? "Editou" : "Adicionou"} "${nome}" no inventário técnico`, predio.id_predio, loggedUser);
    const eraEdicao = !!editingId;
    limparFormulario();
    alert(eraEdicao ? `Equipamento "${nome}" atualizado com sucesso!` : `Equipamento "${nome}" adicionado com sucesso! Aparece automaticamente mapeado na planta técnica do edifício.`);
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
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                {editingId ? <Pencil className="h-4 w-4 text-indigo-500" /> : <Plus className="h-4 w-4 text-emerald-500" />}
                {editingId ? "Editar Equipamento" : "Adicionar Equipamento Personalizado"}
              </h3>
              <p className="text-[11px] text-slate-600">{editingId ? "A corrigir um equipamento já registado." : "Novos equipamentos aparecem instantaneamente no mapeamento técnico da planta."}</p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={limparFormulario}
                className="text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg cursor-pointer shrink-0"
              >
                Cancelar
              </button>
            )}
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

            <div className="grid grid-cols-2 gap-2">
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
                <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Periodicidade de Inspeção</label>
                <select
                  value={frequenciaInspecao}
                  onChange={e => setFrequenciaInspecao(e.target.value)}
                  className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold cursor-pointer"
                >
                  <option value="Mensal">Mensal</option>
                  <option value="Trimestral">Trimestral</option>
                  <option value="Semestral">Semestral</option>
                  <option value="Anual">Anual</option>
                  <option value="Bianual">Bianual (2 anos)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Entidade Responsável / Prestador de Serviço</label>
              <input
                type="text"
                value={entidadeResponsavel}
                onChange={e => setEntidadeResponsavel(e.target.value)}
                placeholder="Ex: TKE, Fidelidade, A definir..."
                className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Base Legal / DGEG (Opcional)</label>
                <input
                  type="text"
                  value={baseLegalDgeg}
                  onChange={e => setBaseLegalDgeg(e.target.value)}
                  placeholder="Ex: DL 320/2002"
                  className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Alertar (dias antes)</label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={diasAlertaAntecedencia}
                  onChange={e => setDiasAlertaAntecedencia(parseInt(e.target.value) || 30)}
                  className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
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
              {/* Sem "capture" — isso forçava o telemóvel a abrir SEMPRE a
                  câmara diretamente, sem dar a escolher a galeria/ficheiros
                  já existentes (bug real reportado: "só abre a máquina
                  fotográfica"). Sem o atributo, o próprio telemóvel mostra
                  as duas opções. */}
              <input ref={fotoInputRef} type="file" accept="image/*" multiple onChange={handleFotosChange} className="hidden" />
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
                        aria-label="Remover fotografia"
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
              className={`w-full text-white font-bold py-2 rounded-lg text-xs cursor-pointer shadow flex items-center justify-center gap-1 ${editingId ? "bg-indigo-600 hover:bg-indigo-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
            >
              {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              <span>{editingId ? "Guardar Alterações" : "Inserir no Mapa Técnico"}</span>
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

                    <div className="flex gap-3 text-[10px] text-slate-600 pt-1 font-semibold flex-wrap">
                      <span>Piso: <strong className="text-slate-600 dark:text-slate-300">{e.andar}</strong></span>
                      <span>•</span>
                      <span>Fabricante: <strong className="text-slate-600 dark:text-slate-300">{e.fabricante || "N/A"}</strong></span>
                      <span>•</span>
                      <span>Última inspeção: <strong className="text-slate-600 dark:text-slate-300">{e.ultimaInspecao || "Nunca"} ({e.frequenciaInspecao})</strong></span>
                      {e.entidadeResponsavel && (
                        <>
                          <span>•</span>
                          <span>Entidade: <strong className="text-slate-600 dark:text-slate-300">{e.entidadeResponsavel}</strong></span>
                        </>
                      )}
                    </div>

                    {e.proximaInspecaoData && (() => {
                      const diasRestantes = Math.ceil((new Date(e.proximaInspecaoData).getTime() - Date.now()) / 86400000);
                      const prazo = e.diasAlertaAntecedencia ?? 30;
                      const aVencer = diasRestantes <= prazo;
                      return (
                        <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg border ${
                          diasRestantes < 0 ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400" :
                          aVencer ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400" :
                          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400"
                        }`}>
                          <CalendarCheck className="h-3 w-3" />
                          {diasRestantes < 0
                            ? `Inspeção vencida há ${Math.abs(diasRestantes)} dias (${formatDatePT(e.proximaInspecaoData)})`
                            : `Próxima inspeção: ${formatDatePT(e.proximaInspecaoData)} (${diasRestantes} dias)`}
                        </div>
                      );
                    })()}

                    {e.fotos && e.fotos.length > 0 && (
                      <div className="flex gap-1.5 pt-1">
                        {e.fotos.map((f, i) => (
                          <a key={i} href={f} target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 hover:scale-110 transition-transform">
                            <img src={f} className="h-full w-full object-cover" alt="" />
                          </a>
                        ))}
                      </div>
                    )}

                    {e.historicoVistorias && e.historicoVistorias.length > 0 && (
                      <div className="pt-1.5 space-y-1 border-t border-slate-200 dark:border-slate-800 mt-1.5">
                        <span className="text-[9px] font-bold text-slate-600 uppercase block">Histórico de Vistorias ({e.historicoVistorias.length})</span>
                        {e.historicoVistorias.slice(0, 3).map(v => (
                          <div key={v.id} className="flex items-center gap-1.5 text-[10px] flex-wrap">
                            <span className="text-slate-600 dark:text-slate-400">{formatDatePT(v.data)}</span>
                            <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                              v.resultado === "Aprovado" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" :
                              v.resultado === "Aprovado com Reservas" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" :
                              "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                            }`}>{v.resultado}</span>
                            <span className="text-slate-600 dark:text-slate-400">— {v.tecnico}</span>
                            {v.documentoUrl && (
                              <a href={v.documentoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-bold flex items-center gap-0.5">
                                <Paperclip className="h-2.5 w-2.5" /> comprovativo
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => iniciarEdicaoVistoria(e, v)}
                              title="Editar esta vistoria"
                              aria-label="Editar esta vistoria"
                              className="text-slate-600 hover:text-indigo-600 active:text-indigo-700 active:scale-90 transition-all cursor-pointer"
                            >
                              <Pencil className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => abrirRegistarVistoria(e)}
                      className="p-1.5 rounded-lg border bg-white dark:bg-slate-900 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 active:border-emerald-400 active:bg-emerald-50 active:scale-95 transition-all cursor-pointer shadow-sm"
                      title="Registar Vistoria"
                      aria-label="Registar Vistoria"
                    >
                      <CalendarCheck className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => iniciarEdicao(e)}
                      className="p-1.5 rounded-lg border bg-white dark:bg-slate-900 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 active:border-indigo-400 active:bg-indigo-50 active:scale-95 transition-all cursor-pointer shadow-sm"
                      title="Editar Equipamento"
                      aria-label="Editar Equipamento"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleRemove(e.id)}
                      className="p-1.5 rounded-lg border bg-white dark:bg-slate-900 text-slate-600 hover:text-red-500 hover:border-red-200 active:border-red-400 active:bg-red-50 active:scale-95 transition-all cursor-pointer shadow-sm"
                      title="Remover Equipamento"
                      aria-label="Remover Equipamento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Modal: Registar Vistoria (agendada ou avulsa) */}
      {vistoriaTargetId && (() => {
        const eqAlvo = equipamentos.find(eq => eq.id === vistoriaTargetId);
        if (!eqAlvo) return null;
        return (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-emerald-500" /> {vistoriaEditId ? "Editar Vistoria" : "Registar Vistoria"}
                  </h3>
                  <p className="text-[11px] text-slate-600">{eqAlvo.nome} — {eqAlvo.categoria}</p>
                </div>
                <button
                  onClick={() => { setVistoriaTargetId(null); setVistoriaEditId(null); }}
                  className="p-1.5 text-slate-600 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title="Fechar"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleGravarVistoria} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Data da Vistoria</label>
                    <input
                      type="date"
                      value={vistoriaData}
                      onChange={e => setVistoriaData(e.target.value)}
                      required
                      className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Resultado</label>
                    <select
                      value={vistoriaResultado}
                      onChange={e => setVistoriaResultado(e.target.value as any)}
                      className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold cursor-pointer"
                    >
                      <option value="Aprovado">Aprovado</option>
                      <option value="Aprovado com Reservas">Aprovado com Reservas</option>
                      <option value="Reprovado">Reprovado</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Técnico / Entidade que Realizou</label>
                  <input
                    type="text"
                    value={vistoriaTecnico}
                    onChange={e => setVistoriaTecnico(e.target.value)}
                    placeholder="Ex: João Silva (TKE)"
                    className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Observações</label>
                  <textarea
                    value={vistoriaObservacoes}
                    onChange={e => setVistoriaObservacoes(e.target.value)}
                    rows={3}
                    placeholder="Observações técnicas da vistoria..."
                    className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Documento Comprovativo (Opcional)</label>
                  {/* Documento já anexado (só em edição) — antes não havia
                      nenhuma forma de o remover, só de o substituir por um
                      novo. Pedido explícito: documento errado/formato não
                      reconhecido tem de poder ser removido. */}
                  {vistoriaEditId && vistoriaDocExistente && !vistoriaDocRemovido && !vistoriaDocFile && (
                    <div className="flex items-center justify-between gap-2 mb-1.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-lg px-2.5 py-1.5">
                      <a href={vistoriaDocExistente.url} target="_blank" rel="noopener noreferrer" className="text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1.5 truncate">
                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{vistoriaDocExistente.nome || "Documento atual"}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setVistoriaDocRemovido(true)}
                        title="Remover este documento"
                        aria-label="Remover este documento"
                        className="text-red-600 hover:text-red-700 active:scale-90 transition-all cursor-pointer shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {vistoriaEditId && vistoriaDocRemovido && (
                    <div className="flex items-center justify-between gap-2 mb-1.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg px-2.5 py-1.5">
                      <span className="text-red-700 dark:text-red-400 text-[11px] font-semibold">Documento marcado para remoção ao gravar.</span>
                      <button
                        type="button"
                        onClick={() => setVistoriaDocRemovido(false)}
                        className="text-[10px] text-slate-600 hover:underline cursor-pointer shrink-0"
                      >
                        Desfazer
                      </button>
                    </div>
                  )}
                  <input ref={vistoriaDocInputRef} type="file" accept=".pdf,image/*" onChange={e => setVistoriaDocFile(e.target.files?.[0] || null)} className="hidden" />
                  <button
                    type="button"
                    onClick={() => vistoriaDocInputRef.current?.click()}
                    className="w-full border border-dashed p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:border-emerald-400 hover:text-emerald-600"
                  >
                    <Paperclip className="h-4 w-4" />
                    <span>{vistoriaDocFile ? vistoriaDocFile.name : vistoriaDocExistente && !vistoriaDocRemovido ? "Substituir Comprovativo (PDF/Foto)" : "Anexar Comprovativo (PDF/Foto)"}</span>
                  </button>
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl p-2.5 text-[10px] text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 shrink-0" />
                  <span>A gravar, a validade é atualizada e a próxima inspeção fica agendada automaticamente para <strong>{formatDatePT(calcularProximaInspecao(vistoriaData, eqAlvo.frequenciaInspecao || "Anual"))}</strong> ({eqAlvo.frequenciaInspecao || "Anual"}), com alerta {eqAlvo.diasAlertaAntecedencia ?? 30} dias antes.</span>
                </div>

                <button
                  type="submit"
                  disabled={aGravarVistoria}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-2 rounded-lg text-xs cursor-pointer shadow flex items-center justify-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>{aGravarVistoria ? "A gravar..." : vistoriaEditId ? "Guardar Alterações" : "Concluir Vistoria"}</span>
                </button>
              </form>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
