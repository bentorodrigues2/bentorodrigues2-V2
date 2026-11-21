import React, { useState, useEffect, useMemo, useRef } from "react";
import { Predio, LoggedUser, Fracao } from "../types";
import { Wrench, Plus, Check, Sparkles, Building, Trash2, ShieldAlert, Camera, X, Pencil, CalendarCheck, ClipboardCheck } from "lucide-react";
import { fetchInventarioTecnicoFromSupabase, saveEquipamentoTecnicoToSupabase, deleteEquipamentoTecnicoFromSupabase, registarLogAuditoria } from "../lib/supabaseService";
import { formatDatePT } from "../utils";

// Separação explícita a pedido do administrador (2026-11-21): "Inventário
// Técnico" (este ficheiro) fica reservado ao REGISTO DO EQUIPAMENTO em si —
// identidade, localização, fotografias, nº de série, validades ligadas à
// agenda de lembretes. O REGISTO DAS INSPEÇÕES/VISTORIAS em concreto
// (data, técnico, resultado, custos, fornecedores, documentos — certificado,
// fatura, comprovativo, requerimento) vive à parte em "Inspeções Técnicas"
// (ver InspecoesTecnicas.tsx), que lê e escreve nos MESMOS registos desta
// tabela (historicoVistorias, estado, ultimaInspecao, proximaInspecaoData).
// Antes, as duas coisas viviam no mesmo ecrã e o administrador não
// conseguia perceber onde preencher o quê ("não tem campos para custos...
// temos de ter fichas independentes").

export interface DocumentoVistoria {
  id: string;
  tipo: "certificado" | "fatura" | "comprovativo_pagamento" | "requerimento" | "outro";
  url: string;
  nome: string;
}

export interface HistoricoVistoriaEquipamento {
  id: string;
  // Liga esta entrada às entradas irmãs de OUTROS equipamentos, quando a
  // mesma visita cobriu vários de uma vez (ex: a TKE inspeciona os 2
  // elevadores do prédio na mesma visita, com 1 só fatura e 1 só
  // requerimento à Câmara) — pedido explícito do administrador: "falta a
  // quantidade de equipamentos... custo por cada equipamento e o total...
  // a ser lançado nos movimentos". Sem idGrupo, a vistoria é isolada.
  idGrupo?: string;
  data: string;
  tecnico: string;
  resultado: "Aprovado" | "Aprovado com Reservas" | "Reprovado";
  observacoes?: string;
  numCertificado?: string;
  // Lista aberta de documentos (substitui os antigos campos fixos
  // documentoUrl/documentoNome/comprovativoPagamentoUrl, migrados em
  // 2026-11-21) — pedido explícito: "adicionar vários documentos (faturas,
  // comprovativos de pagamento, requerimento, certificados)".
  documentos?: DocumentoVistoria[];
  id_fornecedor_inspecao?: string;
  fornecedorInspecaoNome?: string;
  id_fornecedor_manutencao?: string;
  fornecedorManutencaoNome?: string;
  // Custo da QUOTA-PARTE deste equipamento nesta inspeção (= custo total
  // quando a vistoria é isolada, ou seja, sem idGrupo).
  custo?: number;
  // Só presente quando idGrupo existe — custo somado de TODOS os
  // equipamentos desta mesma inspeção conjunta, para mostrar "X€ (de Y€
  // totais desta inspeção)".
  custoTotalGrupo?: number;
  id_conta_pagamento?: string;
  id_movimento?: string;
}

export interface EquipamentoTecnico {
  id: string;
  nome: string;
  categoria: string;
  // Nem toda a vistoria é exigida por lei (ex: extintores, elevadores, gás
  // são "inspeção_obrigatoria"; uma vistoria de rotina a um portão
  // automático pode ser só "preventiva", facultativa).
  tipo: "inspeção_obrigatoria" | "preventiva";
  andar: string;
  estado: "Excelente" | "Operacional" | "Necessita Manutenção" | "Crítico";
  ultimaInspecao: string;
  frequenciaInspecao: string;
  fabricante?: string;
  detalhes?: string;
  fotos?: string[];
  entidadeResponsavel?: string;
  baseLegalDgeg?: string;
  // Nº de licença/registo/autorização PERMANENTE deste equipamento (ex: nº
  // DGEG de um elevador concreto) — distinto do nº de certificado de UMA
  // inspeção (esse vive em HistoricoVistoriaEquipamento.numCertificado,
  // porque muda a cada inspeção).
  numLicencaAutorizacao?: string;
  // Nº de série físico do equipamento (ex: nº de série gravado na placa do
  // elevador) — distingue equipamentos iguais entre si (ex: "Elevador 1" e
  // "Elevador 2" do mesmo prédio, cada um com o seu nº de série DGEG
  // próprio).
  numeroSerie?: string;
  // Nº de processo permanente junto da entidade certificadora (Câmara
  // Municipal / DGEG) associado a este equipamento concreto — distinto do
  // nº de certificado de UMA inspeção (esse muda a cada vistoria).
  numProcessoCamara?: string;
  // Validades ligadas à agenda de lembretes — atualizadas automaticamente
  // sempre que se regista uma vistoria em "Inspeções Técnicas".
  proximaInspecaoData?: string;
  diasAlertaAntecedencia?: number;
  alertaEnviadoEm?: string;
  historicoVistorias?: HistoricoVistoriaEquipamento[];
}

interface InventarioTecnicoProps {
  predio: Predio;
  loggedUser: LoggedUser;
  fracoes?: Fracao[];
  // Ponte para o novo menu "Inspeções Técnicas" — onde se regista de facto
  // a vistoria (data, custos, fornecedores, documentos).
  onVerInspecoes?: () => void;
  // Ponte NO SENTIDO INVERSO: o botão "Editar" de um equipamento visto a
  // partir de "Inspeções Técnicas" navega para aqui e pede para abrir
  // logo a edição desse equipamento — pedido explícito do administrador
  // ("estes campos têm de ser editáveis, eliminar etc" a partir do ecrã de
  // Inspeções, sem ter de procurar o equipamento outra vez aqui).
  editEquipamentoId?: string | null;
  onEditEquipamentoHandled?: () => void;
}

export function InventarioTecnico({ predio, loggedUser, fracoes = [], onVerInspecoes, editEquipamentoId, onEditEquipamentoHandled }: InventarioTecnicoProps) {
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
  const [tipo, setTipo] = useState<EquipamentoTecnico["tipo"]>("inspeção_obrigatoria");
  const [andar, setAndar] = useState("");
  const [estado, setEstado] = useState<EquipamentoTecnico["estado"]>("Operacional");
  const [fabricante, setFabricante] = useState("");
  const [detalhes, setDetalhes] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [frequenciaInspecao, setFrequenciaInspecao] = useState("Anual");
  // Data da última inspeção — baseline da agenda de lembretes; a partir da
  // primeira vistoria registada em "Inspeções Técnicas", este valor passa a
  // ser atualizado automaticamente por lá (a vistoria mais recente manda).
  const [ultimaInspecaoInput, setUltimaInspecaoInput] = useState(() => new Date().toISOString().substring(0, 10));
  const [entidadeResponsavel, setEntidadeResponsavel] = useState("");
  const [baseLegalDgeg, setBaseLegalDgeg] = useState("");
  const [numLicencaAutorizacao, setNumLicencaAutorizacao] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [numProcessoCamara, setNumProcessoCamara] = useState("");
  const [diasAlertaAntecedencia, setDiasAlertaAntecedencia] = useState(30);
  // Só usado ao CRIAR (nunca ao editar): nº de equipamentos iguais a criar
  // de uma vez, ex: "2" para um prédio com 2 elevadores — pedido explícito
  // do administrador ("a localização é um equipamento do prédio", cada
  // elevador com a sua própria ficha, histórico e custos, em vez de 1 só
  // registo com um multiplicador artificial). Gera "{nome} 1", "{nome} 2",
  // cada um totalmente independente dali em diante.
  const [numUnidadesCriar, setNumUnidadesCriar] = useState("1");

  const limparFormulario = () => {
    setEditingId(null);
    setNome("");
    setCategoria("Elevadores");
    setTipo("inspeção_obrigatoria");
    setEstado("Operacional");
    setFabricante("");
    setDetalhes("");
    setFotos([]);
    setFrequenciaInspecao("Anual");
    setUltimaInspecaoInput(new Date().toISOString().substring(0, 10));
    setEntidadeResponsavel("");
    setBaseLegalDgeg("");
    setNumLicencaAutorizacao("");
    setNumeroSerie("");
    setNumProcessoCamara("");
    setDiasAlertaAntecedencia(30);
    setNumUnidadesCriar("1");
  };

  const iniciarEdicao = (eq: EquipamentoTecnico) => {
    setEditingId(eq.id);
    setNome(eq.nome);
    setCategoria(eq.categoria);
    setTipo(eq.tipo || "inspeção_obrigatoria");
    setAndar(eq.andar);
    setEstado(eq.estado);
    setFabricante(eq.fabricante || "");
    setDetalhes(eq.detalhes || "");
    setFotos(eq.fotos || []);
    setFrequenciaInspecao(eq.frequenciaInspecao || "Anual");
    setUltimaInspecaoInput(eq.ultimaInspecao || new Date().toISOString().substring(0, 10));
    setEntidadeResponsavel(eq.entidadeResponsavel || "");
    setBaseLegalDgeg(eq.baseLegalDgeg || "");
    setNumLicencaAutorizacao(eq.numLicencaAutorizacao || "");
    setNumeroSerie(eq.numeroSerie || "");
    setNumProcessoCamara(eq.numProcessoCamara || "");
    setDiasAlertaAntecedencia(eq.diasAlertaAntecedencia ?? 30);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Chegada a partir de "Inspeções Técnicas" (botão "Editar Equipamento"
  // nesse ecrã) — abre logo a edição deste equipamento concreto assim que
  // a lista estiver carregada, em vez de obrigar a procurá-lo outra vez.
  useEffect(() => {
    if (!editEquipamentoId) return;
    const eq = equipamentos.find(e => e.id === editEquipamentoId);
    if (eq) {
      iniciarEdicao(eq);
      onEditEquipamentoHandled?.();
    }
  }, [editEquipamentoId, equipamentos]);

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
    // "Geral do Edifício" cobre equipamentos que atravessam vários pisos e
    // não pertencem a 1 só andar (ex: elevador, coluna elétrica geral) —
    // pedido explícito: "localização dos equipamentos por piso ou prédio
    // caso dos elevadores". Fica sempre em 1º lugar, por cima de todos os
    // pisos reais, incluindo no mapa visual técnico abaixo.
    return [
      "Geral do Edifício",
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

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    const existente = editingId ? equipamentos.find(eq => eq.id === editingId) : null;
    const base: Omit<EquipamentoTecnico, "id" | "nome"> = {
      categoria,
      tipo,
      andar,
      estado,
      ultimaInspecao: ultimaInspecaoInput,
      frequenciaInspecao,
      fabricante: fabricante || "Personalizado",
      detalhes: detalhes || "Adicionado via painel técnico.",
      fotos,
      entidadeResponsavel: entidadeResponsavel || undefined,
      baseLegalDgeg: baseLegalDgeg || undefined,
      numLicencaAutorizacao: numLicencaAutorizacao || undefined,
      numeroSerie: numeroSerie || undefined,
      numProcessoCamara: numProcessoCamara || undefined,
      diasAlertaAntecedencia,
      // Nunca apagar o que já foi calculado/registado pelas Inspeções
      // Técnicas só porque se editou um dado de identidade do equipamento.
      proximaInspecaoData: existente?.proximaInspecaoData,
      alertaEnviadoEm: existente?.alertaEnviadoEm,
      historicoVistorias: existente?.historicoVistorias || []
    };

    if (editingId) {
      const equipment: EquipamentoTecnico = { id: editingId, nome, ...base };
      setEquipamentos(prev => prev.map(eq => eq.id === editingId ? equipment : eq));
      const ok = await saveEquipamentoTecnicoToSupabase(predio.id_predio, equipment);
      if (!ok) { alert("❌ Não foi possível gravar as alterações no Supabase."); return; }
      registarLogAuditoria("Manutenção", `Editou "${nome}" no inventário técnico`, predio.id_predio, loggedUser);
      limparFormulario();
      alert(`Equipamento "${nome}" atualizado com sucesso!`);
      return;
    }

    // Nº de Unidades só ao criar — gera N equipamentos NUMERADOS e
    // totalmente independentes (ex: "Elevador 1", "Elevador 2"), cada um
    // com a sua própria localização, histórico de vistorias e custos, em
    // vez de 1 só registo com um multiplicador artificial (pedido
    // explícito do administrador: "a localização é um equipamento do
    // prédio").
    const unidades = Math.max(1, parseInt(numUnidadesCriar, 10) || 1);
    // Cada unidade física tem o seu próprio nº de série (ex: elevador 1 e
    // elevador 2 do mesmo prédio nunca partilham nº de série DGEG) — ao
    // criar várias de uma vez, aceita-os separados por vírgula na mesma
    // ordem; se só houver 1 valor para várias unidades, fica por preencher
    // nas restantes (corrige-se depois em "Editar Equipamento").
    const seriesLista = numeroSerie.split(",").map(s => s.trim());
    const novosEquipamentos: EquipamentoTecnico[] = Array.from({ length: unidades }).map((_, idx) => ({
      id: "eq-custom-" + Date.now() + "-" + idx,
      nome: unidades > 1 ? `${nome.trim()} ${idx + 1}` : nome.trim(),
      ...base,
      numeroSerie: unidades > 1 ? (seriesLista[idx] || undefined) : (numeroSerie || undefined)
    }));

    const resultados = await Promise.all(novosEquipamentos.map(eq => saveEquipamentoTecnicoToSupabase(predio.id_predio, eq)));
    if (resultados.some(r => !r)) {
      alert("❌ Não foi possível gravar o(s) equipamento(s) no Supabase. Tente novamente.");
      return;
    }
    setEquipamentos(prev => [...prev, ...novosEquipamentos]);
    registarLogAuditoria("Manutenção", `Adicionou "${nome}"${unidades > 1 ? ` (${unidades} unidades)` : ""} no inventário técnico`, predio.id_predio, loggedUser);
    limparFormulario();
    alert(unidades > 1
      ? `${unidades} equipamentos adicionados: ${novosEquipamentos.map(eq => eq.nome).join(", ")} — cada um já independente, com o seu próprio histórico de vistorias e custos.`
      : `Equipamento "${nome}" adicionado com sucesso! Aparece automaticamente mapeado na planta técnica do edifício.`);
  };

  const handleRemove = (id: string) => {
    const confirmRemove = confirm("Tem a certeza que deseja remover este equipamento do inventário do prédio? O histórico de inspeções associado também deixa de ficar acessível.");
    if (confirmRemove) {
      setEquipamentos(equipamentos.filter(e => e.id !== id));
      deleteEquipamentoTecnicoFromSupabase(id).catch(console.error);
    }
  };

  // Gera um mapa preventivo inicial a partir do património real do prédio
  // (elevadores, garagem, jardins) — existia na antiga Agenda de
  // Manutenção ("Gerar Agenda Preventiva IA") e foi perdido na unificação
  // (2026-11-18); reposto a pedido do administrador, agora a criar
  // EquipamentoTecnico diretamente aqui. IDs fixos ("ag-ia-N") para nunca
  // duplicar ao clicar 2 vezes.
  const handleGerarMapaPreventivoIA = async () => {
    const checks: EquipamentoTecnico[] = [
      {
        id: "ag-ia-1",
        nome: "Extintores de Incêndio (Certificação Legal)",
        categoria: "Sistema de incêndio",
        tipo: "inspeção_obrigatoria",
        andar: "Geral do Edifício",
        estado: "Operacional",
        ultimaInspecao: new Date().toISOString().substring(0, 10),
        frequenciaInspecao: "Anual"
      },
      {
        id: "ag-ia-2",
        nome: "Inspeção e Limpeza do Telhado / Cobertura",
        categoria: "Portas corta-fogo",
        tipo: "preventiva",
        andar: "Cobertura",
        estado: "Operacional",
        ultimaInspecao: new Date().toISOString().substring(0, 10),
        frequenciaInspecao: "Anual"
      }
    ];

    if (predio.patrimonio?.tem_elevador) {
      const numElevadores = Math.max(1, predio.patrimonio.num_elevadores || 1);
      for (let i = 1; i <= numElevadores; i++) {
        checks.push({
          id: numElevadores > 1 ? `ag-ia-elevador-${i}` : "ag-ia-3",
          nome: numElevadores > 1 ? `Elevador ${i}` : "Elevadores de Passageiros",
          categoria: "Elevadores",
          tipo: "inspeção_obrigatoria",
          andar: "Geral do Edifício",
          estado: "Operacional",
          ultimaInspecao: new Date().toISOString().substring(0, 10),
          frequenciaInspecao: "Bianual"
        });
      }
    }
    if (predio.patrimonio?.tem_garagem) {
      checks.push({
        id: "ag-ia-4",
        nome: "Bombas de Drenagem de Águas Pluviais da Garagem",
        categoria: "Bombas de água",
        tipo: "preventiva",
        andar: "Cave / Garagem",
        estado: "Operacional",
        ultimaInspecao: new Date().toISOString().substring(0, 10),
        frequenciaInspecao: "Semestral"
      });
    }
    if (predio.patrimonio?.tem_jardins) {
      checks.push({
        id: "ag-ia-5",
        nome: "Eletrobombas e Sistema de Rega dos Jardins",
        categoria: "Bombas de água",
        tipo: "preventiva",
        andar: "Exterior",
        estado: "Operacional",
        ultimaInspecao: new Date().toISOString().substring(0, 10),
        frequenciaInspecao: "Trimestral"
      });
    }
    checks.push({
      id: "ag-ia-6",
      nome: "Portas Corta-Fogo e Sinalização de Emergência",
      categoria: "Portas corta-fogo",
      tipo: "inspeção_obrigatoria",
      andar: "Geral do Edifício",
      estado: "Operacional",
      ultimaInspecao: new Date().toISOString().substring(0, 10),
      frequenciaInspecao: "Semestral"
    });
    checks.push({
      id: "ag-ia-7",
      nome: "Quadros de Colunas Elétricas e Caixas Técnicas",
      categoria: "Sistema elétrico",
      tipo: "inspeção_obrigatoria",
      andar: "Geral do Edifício",
      estado: "Operacional",
      ultimaInspecao: new Date().toISOString().substring(0, 10),
      frequenciaInspecao: "Anual"
    });

    const checksNovos = checks.filter(c => !equipamentos.some(eq => eq.id === c.id));
    if (checksNovos.length === 0) {
      alert("O mapa preventivo para este património já foi gerado — nada novo a acrescentar.");
      return;
    }
    const resultados = await Promise.all(checksNovos.map(c => saveEquipamentoTecnicoToSupabase(predio.id_predio, c)));
    if (resultados.some(r => !r)) {
      alert("❌ Não foi possível gravar o mapa preventivo no Supabase. Tente novamente.");
      return;
    }
    setEquipamentos(prev => [...prev, ...checksNovos]);
    registarLogAuditoria("Manutenção", "Gerou o mapa preventivo inicial a partir do património do prédio", predio.id_predio, loggedUser);
    alert(`Mapa preventivo gerado: ${checksNovos.length} equipamento(s) adicionado(s) a partir do património real do prédio.`);
  };

  // Categorias técnicas ajustadas ao património REAL deste prédio — antes
  // era uma lista fixa igual para todos os prédios (incluía "Piscina"/
  // "Spa"/"Ginásio" mesmo sem o prédio ter, e excluía "Elevadores" num
  // prédio que tenha, por exemplo) e não deixava escrever nenhuma
  // categoria fora da lista. Pedido explícito do administrador: "tem de
  // ser ajustável conforme o património do prédio" + poder escrever
  // categorias que não existam na lista.
  const categoriasPatrimonio = useMemo(() => {
    const p = predio.patrimonio;
    // Estruturais — aplicam-se a qualquer edifício multifamiliar,
    // independentemente do património assinalado.
    const base = new Set<string>(["Sistema de incêndio", "Sistema de gás", "Sistema elétrico", "Portas corta-fogo", "Motores"]);
    if (p?.tem_elevador) base.add("Elevadores");
    if (p?.tem_garagem || p?.tem_jardins || p?.tem_piscina) base.add("Bombas de água");
    if (p?.tem_piscina) base.add("Piscina (bombas, filtros, motores)");
    if (p?.tem_spa) base.add("Spa (motores, filtros, aquecimento)");
    if (p?.tem_ginasio) base.add("Ginásio (equipamentos de ginástica)");
    // Categorias já usadas em equipamentos existentes (ex: escritas à mão
    // via "+ Outra" antes) continuam sempre disponíveis, mesmo que não
    // correspondam a nenhum património assinalado.
    equipamentos.forEach(eq => { if (eq.categoria) base.add(eq.categoria); });
    return Array.from(base).sort((a, b) => a.localeCompare(b, "pt-PT"));
  }, [predio.patrimonio, equipamentos]);

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 animate-fadeIn">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">Inventário Técnico</h3>
          <p className="text-[11px] text-slate-600">Registo de equipamentos, localização, fotografias e validades ligadas à agenda de lembretes.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {onVerInspecoes && (
            <button
              onClick={onVerInspecoes}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-slate-700 dark:text-slate-200 font-bold px-4 py-2 rounded-xl text-xs shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <ClipboardCheck className="h-4 w-4 text-emerald-500" />
              <span>Ver Inspeções Técnicas</span>
            </button>
          )}
          <button
            onClick={handleGerarMapaPreventivoIA}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="h-4 w-4" />
            <span>Gerar Mapa Preventivo IA</span>
          </button>
        </div>
      </div>

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

      <div className="space-y-6">

        {/* Ficha de equipamento — a aparecer no TOPO da página (pedido
            explícito do administrador), em largura total, para os campos
            de preenchimento ficarem maiores e mais fáceis de ler. */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
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

          <form onSubmit={handleAddCustom} className="grid grid-cols-1 lg:grid-cols-2 gap-x-5 gap-y-3.5">
            <div className="lg:col-span-2">
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Nome do Equipamento / Modelo</label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Motor do Portão de Garagem Ditec"
                className="w-full border p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Categoria Técnica</label>
              <select
                value={categoriasPatrimonio.includes(categoria) ? categoria : "__outra__"}
                onChange={e => setCategoria(e.target.value === "__outra__" ? "" : e.target.value)}
                className="w-full border p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm font-semibold cursor-pointer"
              >
                {categoriasPatrimonio.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="__outra__">+ Outra categoria (escrever)...</option>
              </select>
              {!categoriasPatrimonio.includes(categoria) && (
                <input
                  type="text"
                  value={categoria}
                  onChange={e => setCategoria(e.target.value)}
                  placeholder="Nome da categoria técnica..."
                  className="w-full border p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm mt-1.5"
                />
              )}
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Tipo de Vistoria</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value as any)}
                className="w-full border p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm font-semibold cursor-pointer"
              >
                <option value="inspeção_obrigatoria">Inspeção Obrigatória (Lei)</option>
                <option value="preventiva">Manutenção Preventiva (Facultativa)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Data da Última Inspeção</label>
              <input
                type="date"
                value={ultimaInspecaoInput}
                onChange={e => setUltimaInspecaoInput(e.target.value)}
                required
                className="w-full border p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Localização (Andar)</label>
              <select
                value={andar}
                onChange={e => setAndar(e.target.value)}
                className="w-full border p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm font-semibold cursor-pointer"
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
                className="w-full border p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm font-semibold cursor-pointer"
              >
                <option value="Excelente">Excelente</option>
                <option value="Operacional">Operacional</option>
                <option value="Necessita Manutenção">Manutenção</option>
                <option value="Crítico">Crítico</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Fabricante / Fornecedor</label>
              <input
                type="text"
                value={fabricante}
                onChange={e => setFabricante(e.target.value)}
                placeholder="Ex: Schindler Lda."
                className="w-full border p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Periodicidade de Inspeção</label>
              <select
                value={frequenciaInspecao}
                onChange={e => setFrequenciaInspecao(e.target.value)}
                className="w-full border p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm font-semibold cursor-pointer"
              >
                <option value="Mensal">Mensal</option>
                <option value="Trimestral">Trimestral</option>
                <option value="Semestral">Semestral</option>
                <option value="Anual">Anual</option>
                <option value="Bianual">Bianual (2 anos)</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Entidade Responsável / Prestador de Serviço</label>
              <input
                type="text"
                value={entidadeResponsavel}
                onChange={e => setEntidadeResponsavel(e.target.value)}
                placeholder="Ex: TKE, Fidelidade, A definir..."
                className="w-full border p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Base Legal / DGEG (Opcional)</label>
              <input
                type="text"
                value={baseLegalDgeg}
                onChange={e => setBaseLegalDgeg(e.target.value)}
                placeholder="Ex: DL 320/2002"
                className="w-full border p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Nº de Licença / Autorização</label>
              <input
                type="text"
                value={numLicencaAutorizacao}
                onChange={e => setNumLicencaAutorizacao(e.target.value)}
                placeholder="Ex: registo DGEG do equipamento"
                className="w-full border p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Nº de Série (Opcional)</label>
              <input
                type="text"
                value={numeroSerie}
                onChange={e => setNumeroSerie(e.target.value)}
                placeholder={!editingId ? "Ex: 50101007 (vírgula se criar várias unidades)" : "Ex: 50101007"}
                className="w-full border p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Nº de Processo (Câmara/DGEG, Opcional)</label>
              <input
                type="text"
                value={numProcessoCamara}
                onChange={e => setNumProcessoCamara(e.target.value)}
                placeholder="Ex: L/2009/52/0"
                className="w-full border p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {!editingId && (
              <div className="lg:col-span-2">
                <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Nº de Unidades a Criar</label>
                <input type="number" min={1} value={numUnidadesCriar} onChange={e => setNumUnidadesCriar(e.target.value)} className="w-full border p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm" />
                <p className="text-[9px] text-slate-600 mt-1">Ex: "2" num prédio com 2 elevadores cria "{nome.trim() || "Elevador"} 1" e "{nome.trim() || "Elevador"} 2" como equipamentos separados e independentes — cada um com a sua própria localização, histórico de vistorias e custos.</p>
              </div>
            )}

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Alertar (dias antes)</label>
              <input
                type="number"
                min={1}
                max={180}
                value={diasAlertaAntecedencia}
                onChange={e => setDiasAlertaAntecedencia(parseInt(e.target.value) || 30)}
                className="w-full border p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Notas Técnicas / Observações</label>
              <textarea
                value={detalhes}
                onChange={e => setDetalhes(e.target.value)}
                placeholder="Ex: Rolamento substituído recentemente. Monitorizar ruído térmico."
                rows={3}
                className="w-full border p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="lg:col-span-2">
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
                className="w-full border border-dashed p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-sm font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:border-emerald-400 hover:text-emerald-600"
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
              className={`lg:col-span-2 w-full text-white font-bold py-2.5 rounded-lg text-sm cursor-pointer shadow flex items-center justify-center gap-1 ${editingId ? "bg-indigo-600 hover:bg-indigo-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
            >
              {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              <span>{editingId ? "Guardar Alterações" : "Inserir no Mapa Técnico"}</span>
            </button>
          </form>
        </div>

        {/* Mapa visual + listagem de equipamentos — abaixo da ficha, também
            em largura total. */}
        <div className="space-y-6">

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
                const emoji = piso === "Geral do Edifício" ? "🏗️" : piso === "Cobertura" ? "🏢" : piso === "Exterior" ? "🌳" : piso.includes("Cave") || piso.includes("Garagem") ? "🚗" : piso.includes("Loja") ? "🏪" : "🏢";
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
                      <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
                        e.tipo === "inspeção_obrigatoria"
                          ? "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400"
                          : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400"
                      }`}>
                        {e.tipo === "inspeção_obrigatoria" ? "Obrigatória (Lei)" : "Facultativa"}
                      </span>
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
                      {e.numLicencaAutorizacao && (
                        <>
                          <span>•</span>
                          <span>Licença: <strong className="text-slate-600 dark:text-slate-300">{e.numLicencaAutorizacao}</strong></span>
                        </>
                      )}
                      {e.numeroSerie && (
                        <>
                          <span>•</span>
                          <span>Nº Série: <strong className="text-slate-600 dark:text-slate-300 font-mono">{e.numeroSerie}</strong></span>
                        </>
                      )}
                      {e.numProcessoCamara && (
                        <>
                          <span>•</span>
                          <span>Processo: <strong className="text-slate-600 dark:text-slate-300 font-mono">{e.numProcessoCamara}</strong></span>
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
                      <p className="text-[9px] text-slate-600 pt-1">
                        {e.historicoVistorias.length} vistoria(s) registada(s) — ver detalhes em "Inspeções Técnicas".
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
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

    </div>
  );
}
