import React, { useState, useRef, useEffect } from "react";
import { Predio, Fracao, Ocorrencia, Movimento, Conta, Documento, LoggedUser, Fornecedor, OcorrenciaFoto } from "../types";
import { formatDatePT, exportToXLS } from "../utils";
import { motion, AnimatePresence } from "motion/react";
import { 
  Wrench, Calendar, TriangleAlert, Hammer, CheckSquare, FolderArchive, 
  Plus, Upload, ShieldAlert, Check, RefreshCw, Sparkles, Send, 
  Clock, FileDown, Eye, FileText, Landmark, User, FileSpreadsheet, Play
} from "lucide-react";

interface GestaoManutencaoIntervencoesProps {
  predio: Predio;
  fracoes: Fracao[];
  ocorrencias: Ocorrencia[];
  setOcorrencias: React.Dispatch<React.SetStateAction<Ocorrencia[]>>;
  movements: Movimento[];
  setMovements: React.Dispatch<React.SetStateAction<Movimento[]>>;
  contas: Conta[];
  documentos: Documento[];
  setDocumentos: React.Dispatch<React.SetStateAction<Documento[]>>;
  fornecedores: Fornecedor[];
  loggedUser: LoggedUser;
  activeSubSection: string;
  setActiveSubSection: (sub: string) => void;
}

// Internal structures for Agenda and Intervencoes
export interface AgendaItem {
  id: string;
  equipamento: string;
  tipo: "preventiva" | "inspeção_obrigatoria";
  dataPlaneada: string;
  periodicidade: string;
  estado: "Agendado" | "Verificado" | "Não Verificado";
  dataVerificacao?: string;
  tecnico?: string;
  relatorio?: string;
  avariasEncontradas?: string;
  fotos?: string[];
  assinatura?: string;
}

export interface Intervencao {
  id: string;
  descricao: string;
  id_fracao: string; // "common" or fraction ID
  prioridade: "Baixa" | "Média" | "Alta";
  fornecedor: string;
  custoPrevisto: number;
  custoFinal?: number;
  estado: "Pendente" | "Em Curso" | "Concluída";
  relatorioTecnico?: string;
  dataHoraInicio?: string;
  dataHoraFim?: string;
  fotos?: string[];
  faturaAnexa?: string;
  anoExercicio: string;
  validadoAdmin: boolean;
}

export interface ObraExtraordinaria {
  id: string;
  descricao: string;
  fornecedorId: string;
  fornecedorNome: string;
  dataInicio: string;
  dataFim: string;
  custoTotal: number;
  necessitaCotaExtra: boolean;
  mesesFracionamento: number; // 3, 6, 9, 12, 18, 24
  valoresPorFracao: { [fracaoId: string]: number };
  impactoFundoReserva: number;
  impactoSaldoAnual: number;
  estado: "Planeada" | "Em Curso" | "Concluída";
  orcamentos: string[]; // names/links
  documentosArquivados: boolean;
}

export function GestaoManutencaoIntervencoes({
  predio,
  fracoes,
  ocorrencias,
  setOcorrencias,
  movements,
  setMovements,
  contas,
  documentos,
  setDocumentos,
  fornecedores,
  loggedUser,
  activeSubSection,
  setActiveSubSection
}: GestaoManutencaoIntervencoesProps) {

  // Local Simulated States for Vistorias (Agenda) and Intervencoes/Obras
  const [agenda, setAgenda] = useState<AgendaItem[]>(() => {
    const saved = localStorage.getItem(`agenda_manutencao_${predio.id_predio}`);
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [intervencoes, setIntervencoes] = useState<Intervencao[]>(() => {
    const saved = localStorage.getItem(`intervencoes_${predio.id_predio}`);
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [obrasExtra, setObrasExtra] = useState<ObraExtraordinaria[]>(() => {
    const saved = localStorage.getItem(`obras_extra_${predio.id_predio}`);
    if (saved) return JSON.parse(saved);
    return [];
  });

  // Persist states
  useEffect(() => {
    localStorage.setItem(`agenda_manutencao_${predio.id_predio}`, JSON.stringify(agenda));
  }, [agenda, predio.id_predio]);

  useEffect(() => {
    localStorage.setItem(`intervencoes_${predio.id_predio}`, JSON.stringify(intervencoes));
  }, [intervencoes, predio.id_predio]);

  useEffect(() => {
    localStorage.setItem(`obras_extra_${predio.id_predio}`, JSON.stringify(obrasExtra));
  }, [obrasExtra, predio.id_predio]);

  // Selected Profile for Testing maintenance flow
  const [activeProfile, setActiveProfile] = useState<LoggedUser["role"]>(loggedUser.role);
  useEffect(() => {
    setActiveProfile(loggedUser.role);
  }, [loggedUser.role]);

  // State maps for sections and forms
  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedTheme, setSelectedTheme] = useState("Todos");

  // Ocorrência Form State
  const [ocFracao, setOcFracao] = useState("common");
  const [ocCategoria, setOcCategoria] = useState("Infiltrações & Canalização");
  const [ocDescricao, setOcDescricao] = useState("");
  const [ocPrioridade, setOcPrioridade] = useState<"Baixa" | "Média" | "Alta">("Média");
  const [ocFotos, setOcFotos] = useState<OcorrenciaFoto[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin Dispatch State for Ocorrencia
  const [dispatchOcorrId, setDispatchOcorrId] = useState<string | null>(null);
  const [dispClassificacao, setDispClassificacao] = useState<"manutencao" | "intervencao" | "obra">("intervencao");
  const [dispTecnico, setDispTecnico] = useState("");
  const [dispPrioridade, setDispPrioridade] = useState<"Baixa" | "Média" | "Alta">("Média");
  const [dispNotas, setDispNotas] = useState("");

  // Technician Update State
  const [techOcorrId, setTechOcorrId] = useState<string | null>(null);
  const [techReport, setTechReport] = useState("");
  const [techFotos, setTechFotos] = useState<string[]>([]);
  const [techSign, setTechSign] = useState("");

  // Agenda Checklist Checklist states
  const [checkItemId, setCheckItemId] = useState<string | null>(null);
  const [checkStatus, setCheckStatus] = useState<"Verificado" | "Não Verificado">("Verificado");
  const [checkReport, setCheckReport] = useState("");
  const [checkAvarias, setCheckAvarias] = useState("");
  const [checkSign, setCheckSign] = useState("");

  // Creating Small Repair (Intervencao) State
  const [showNewIntForm, setShowNewIntForm] = useState(false);
  const [newIntDesc, setNewIntDesc] = useState("");
  const [newIntFracao, setNewIntFracao] = useState("common");
  const [newIntPrioridade, setNewIntPrioridade] = useState<"Baixa" | "Média" | "Alta">("Média");
  const [newIntForn, setNewIntForn] = useState("");
  const [newIntCusto, setNewIntCusto] = useState("");

  // Small Repair Tech Executing State
  const [execIntId, setExecIntId] = useState<string | null>(null);
  const [execReport, setExecReport] = useState("");
  const [execFotos, setExecFotos] = useState<string[]>([]);

  // Small Repair Admin Validate State
  const [valIntId, setValIntId] = useState<string | null>(null);
  const [valFatura, setValFatura] = useState("Fatura_Servico_Manutencao_Emitida.pdf");
  const [valCustoFinal, setValCustoFinal] = useState("");

  // Verification states for Tarefas Concluídas view
  const [selectedTaskToVerify, setSelectedTaskToVerify] = useState<string | null>(null);
  const [verifyCost, setVerifyCost] = useState("");
  const [verifyAdminReport, setVerifyAdminReport] = useState("");
  const [verifyAnexo, setVerifyAnexo] = useState("");

  // Creating Extraordinary Work (Obra Grande) State
  const [showNewObraForm, setShowNewObraForm] = useState(false);
  const [newObraDesc, setNewObraDesc] = useState("");
  const [newObraForn, setNewObraForn] = useState("");
  const [newObraCusto, setNewObraCusto] = useState("");
  const [newObraNecessitaCota, setNewObraNecessitaCota] = useState(true);
  const [newObraMeses, setNewObraMeses] = useState<number>(12);
  const [newObraInicio, setNewObraInicio] = useState("");
  const [newObraFim, setNewObraFim] = useState("");

  // Calculation display for IA prediction
  const [iaPreviewTotal, setIaPreviewTotal] = useState<number>(0);
  const [iaBreakdown, setIaBreakdown] = useState<any>(null);

  // Trigger auto calculating whenever form values update
  useEffect(() => {
    const cost = parseFloat(newObraCusto) || 0;
    if (cost <= 0) {
      setIaBreakdown(null);
      return;
    }

    // IA Suggestion engine based on permilagem
    const suggestValPerFraction: { [key: string]: number } = {};
    fracoes.forEach(f => {
      // Fraction pays based on its permilagem (value = total_cost * permilagem / 1000)
      suggestValPerFraction[f.id_fracao] = (cost * f.permilagem) / 1000;
    });

    // Recommend legal/recommended reserve funds impact (e.g. 10% or remaining from reserve fund)
    const reserveImpact = Math.min(cost * 0.2, 5000); // suggest taking 20% max 5000€ from FR
    const outstandingQuotaCost = cost - reserveImpact;

    setIaBreakdown({
      total: cost,
      reserveImpact,
      outstandingQuotaCost,
      byFraction: suggestValPerFraction,
      monthlyBreakdown: [3, 6, 9, 12, 18, 24].reduce((acc: any, m) => {
        acc[m] = outstandingQuotaCost / m;
        return acc;
      }, {})
    });
  }, [newObraCusto, fracoes]);

  // Utility to handle local image WebP simulator
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, isOcorr = true) => {
    const files = e.target.files ? (Array.from(e.target.files) as File[]) : [];
    files.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const webpSimulated = event.target?.result as string;
        if (isOcorr) {
          setOcFotos(prev => [
            ...prev,
            {
              name: file.name.split(".")[0] + ".webp",
              preview: webpSimulated,
              size: `${Math.round((webpSimulated.length * 3) / 4 / 1024)} KB`
            }
          ]);
        } else {
          setTechFotos(prev => [...prev, webpSimulated]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Submeter Ocorrência (PWA / Condómino)
  const handleSubmeterOcorrencia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ocDescricao.trim()) {
      alert("Por favor, descreva a avaria.");
      return;
    }

    const nova: Ocorrencia = {
      id_ocorr: "oc-" + (ocorrencias.length + 1),
      id_predio: predio.id_predio,
      id_fracao: ocFracao,
      descricao: `[Prioridade: ${ocPrioridade}] ` + ocDescricao,
      data: new Date().toISOString().split("T")[0],
      estado: "A aguardar",
      medidas_tomadas: "",
      fotos: ocFotos,
      categoria: ocCategoria,
      tecnico_atribuido: "Não atribuído"
    };

    setOcorrencias([nova, ...ocorrencias]);
    setOcDescricao("");
    setOcFotos([]);
    alert("Ocorrência reportada com sucesso e enviada para a administração!");
  };

  // Administration dispatches Ocorrência
  const handleDispatchOcorr = (id: string) => {
    const updated = ocorrencias.map(o => {
      if (o.id_ocorr === id) {
        return {
          ...o,
          estado: "Em Reparação",
          tecnico_atribuido: dispTecnico || "Técnico Geral",
          classificacao: dispClassificacao,
          medidas_tomadas: `[Classificação: ${dispClassificacao.toUpperCase()}] Despachado com prioridade ${dispPrioridade}. Notas: ${dispNotas}`
        };
      }
      return o;
    });

    setOcorrencias(updated);

    // If classified as maintenance or repair, auto-create a small repair (Intervencao)
    if (dispClassificacao === "manutencao" || dispClassificacao === "intervencao") {
      const targetOcorr = ocorrencias.find(o => o.id_ocorr === id);
      const novaInt: Intervencao = {
        id: "int-" + (intervencoes.length + 1),
        descricao: `[Origem ${id}] ` + (targetOcorr?.descricao || ""),
        id_fracao: targetOcorr?.id_fracao || "common",
        prioridade: dispPrioridade,
        fornecedor: dispTecnico || "Técnico de Turno",
        custoPrevisto: dispClassificacao === "manutencao" ? 50 : 120,
        estado: "Pendente",
        anoExercicio: new Date().getFullYear().toString(),
        validadoAdmin: false
      };
      setIntervencoes([novaInt, ...intervencoes]);
    } else if (dispClassificacao === "obra") {
      // If classified as Obra, auto-create Extraordinary Work
      const targetOcorr = ocorrencias.find(o => o.id_ocorr === id);
      const fornObj = fornecedores[0] || { id_fornecedor: "forn-auto", nome: dispTecnico || "Empreiteiro" };
      const novaObra: ObraExtraordinaria = {
        id: "obr-" + (obrasExtra.length + 1),
        descricao: `[Origem ${id}] OBRAS: ` + (targetOcorr?.descricao || ""),
        fornecedorId: fornObj.id_fornecedor,
        fornecedorNome: fornObj.nome,
        dataInicio: new Date().toISOString().split("T")[0],
        dataFim: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 30 days after
        custoTotal: 3500,
        necessitaCotaExtra: true,
        mesesFracionamento: 6,
        valoresPorFracao: {},
        impactoFundoReserva: 500,
        impactoSaldoAnual: -3000,
        estado: "Planeada",
        orcamentos: ["Orcamento_Preliminar_Automático.pdf"],
        documentosArquivados: false
      };
      setObrasExtra([novaObra, ...obrasExtra]);
    }

    setDispatchOcorrId(null);
    setDispTecnico("");
    setDispNotas("");
    alert("Ocorrência classificada e distribuída automaticamente no fluxo técnico!");
  };

  // Technician Completes Ocorrência
  const handleTechCompleteOcorr = (id: string) => {
    const targetOcorr = ocorrencias.find(o => o.id_ocorr === id);
    if (!targetOcorr) return;

    // Determine classification from targetOcorr or fallback
    const classificacao = targetOcorr.classificacao || "intervencao";

    const updated = ocorrencias.map(o => {
      if (o.id_ocorr === id) {
        return {
          ...o,
          estado: "Concluída",
          medidas_tomadas: o.medidas_tomadas + `\n[RELATÓRIO TÉCNICO]: ${techReport}. Concluído às ${new Date().toLocaleString()}.`
        };
      }
      return o;
    });

    setOcorrencias(updated);

    // Mover automaticamente com base na classificação
    if (classificacao === "intervencao") {
      // Pequena reparação → mover automaticamente para Intervenções (Pequenas Reparações)
      const novaInt: Intervencao = {
        id: "int-completed-" + id,
        descricao: `[Ocorrência Resolvida ${id}] ` + targetOcorr.descricao,
        id_fracao: targetOcorr.id_fracao || "common",
        prioridade: "Média",
        fornecedor: targetOcorr.tecnico_atribuido || "Técnico Geral",
        custoPrevisto: 120,
        custoFinal: 120,
        estado: "Concluída",
        relatorioTecnico: techReport,
        dataHoraInicio: new Date().toLocaleString(),
        dataHoraFim: new Date().toLocaleString(),
        anoExercicio: new Date().getFullYear().toString(),
        validadoAdmin: false // Needs validation by admin
      };
      setIntervencoes(prev => {
        const filtered = prev.filter(i => !i.descricao.includes(`[Origem ${id}]`));
        return [novaInt, ...filtered];
      });

    } else if (classificacao === "manutencao") {
      // Vistoria → mover automaticamente para Agenda de Manutenção
      const novaAgenda: AgendaItem = {
        id: "ag-completed-" + id,
        equipamento: `Vistoria Ocorrência: ` + targetOcorr.descricao,
        tipo: "preventiva",
        dataPlaneada: new Date().toISOString().split("T")[0],
        periodicidade: "Pontual",
        estado: "Verificado",
        dataVerificacao: new Date().toISOString().split("T")[0],
        tecnico: targetOcorr.tecnico_atribuido || "Técnico Geral",
        relatorio: techReport,
        assinatura: techSign || "Assinatura Eletrónica"
      };
      setAgenda(prev => [novaAgenda, ...prev]);

    } else if (classificacao === "obra") {
      // Obra → mover automaticamente para Intervenções Extraordinárias
      const valuesByFraction: { [key: string]: number } = {};
      fracoes.forEach(f => {
        valuesByFraction[f.id_fracao] = (4500 * f.permilagem) / 1000;
      });
      const novaObra: ObraExtraordinaria = {
        id: "obr-completed-" + id,
        descricao: `[Ocorrência Resolvida ${id}] Obras: ` + targetOcorr.descricao,
        fornecedorId: "forn-auto",
        fornecedorNome: targetOcorr.tecnico_atribuido || "Técnico Geral",
        dataInicio: new Date().toISOString().split("T")[0],
        dataFim: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        custoTotal: 4500,
        necessitaCotaExtra: true,
        mesesFracionamento: 6,
        valoresPorFracao: valuesByFraction,
        impactoFundoReserva: 900,
        impactoSaldoAnual: -3600,
        estado: "Concluída",
        orcamentos: [`Orcamento_Ocorrência_${id}.pdf`],
        documentosArquivados: true
      };
      setObrasExtra(prev => {
        const filtered = prev.filter(o => !o.descricao.includes(`[Origem ${id}]`));
        return [novaObra, ...filtered];
      });
    }

    // Auto-create document archive entry of this technical intervention
    const novoDoc: Documento = {
      id_doc: "doc-" + (documentos.length + 1),
      id_predio: predio.id_predio,
      nome: `Relatorio_Tecnico_Ocorrencia_${id}.pdf`,
      tipo: "PDF",
      data_upload: new Date().toISOString().split("T")[0],
      tamanho: "320 KB",
      categoria: "Manutenção",
      descricao: `Relatório Técnico de resolução de ocorrência ${id}: ${techReport}`,
      visibilidade: "Público",
      autor: loggedUser.nome,
      ano: new Date().getFullYear().toString(),
      tema: "Manutenção"
    };
    setDocumentos([novoDoc, ...documentos]);

    setTechOcorrId(null);
    setTechReport("");
    alert("Tarefa marcada como concluída! Relatório técnico submetido, movido para a secção correspondente e arquivado automaticamente.");
  };

  // Generating Smart Preventive Maintenance Agenda
  const handleGerarAgendaIA = () => {
    // Generate checks custom to building's equipment
    const checks: AgendaItem[] = [
      {
        id: "ag-ia-1",
        equipamento: "Extintores de Incêndio (Certificação Legal)",
        tipo: "inspeção_obrigatoria",
        dataPlaneada: "2026-08-10",
        periodicidade: "Anual",
        estado: "Agendado"
      },
      {
        id: "ag-ia-2",
        equipamento: "Inspeção e Limpeza do Telhado / Cobertura",
        tipo: "preventiva",
        dataPlaneada: "2026-10-12",
        periodicidade: "Anual",
        estado: "Agendado"
      }
    ];

    if (predio.patrimonio.tem_elevador) {
      checks.push({
        id: "ag-ia-3",
        equipamento: `Elevadores de Passageiros (Total: ${predio.patrimonio.num_elevadores})`,
        tipo: "inspeção_obrigatoria",
        dataPlaneada: "2026-08-25",
        periodicidade: "Mensal",
        estado: "Agendado"
      });
    }
    if (predio.patrimonio.tem_garagem) {
      checks.push({
        id: "ag-ia-4",
        equipamento: "Bombas de Drenagem de Águas Pluviais da Garagem",
        tipo: "preventiva",
        dataPlaneada: "2026-09-15",
        periodicidade: "Semestral",
        estado: "Agendado"
      });
    }
    if (predio.patrimonio.tem_jardins) {
      checks.push({
        id: "ag-ia-5",
        equipamento: "Eletrobombas e Sistema de Rega dos Jardins",
        tipo: "preventiva",
        dataPlaneada: "2026-08-20",
        periodicidade: "Trimestral",
        estado: "Agendado"
      });
    }

    // Always add Fire Doors and Technical Cabinets
    checks.push({
      id: "ag-ia-6",
      equipamento: "Portas Corta-Fogo e Sinalização de Emergência",
      tipo: "inspeção_obrigatoria",
      dataPlaneada: "2026-08-18",
      periodicidade: "Semestral",
      estado: "Agendado"
    });
    checks.push({
      id: "ag-ia-7",
      equipamento: "Quadros de Colunas Elétricas e Caixas Técnicas",
      tipo: "inspeção_obrigatoria",
      dataPlaneada: "2026-11-05",
      periodicidade: "Anual",
      estado: "Agendado"
    });

    setAgenda([...agenda, ...checks]);
    alert("IA analisou o património do prédio e gerou a agenda preventiva ideal de vistorias técnicas obrigatórias!");
  };

  // Technician signs off an Agenda item
  const handleCheckAgendaItem = (id: string) => {
    const updated = agenda.map(item => {
      if (item.id === id) {
        return {
          ...item,
          estado: checkStatus,
          dataVerificacao: new Date().toISOString().split("T")[0],
          tecnico: loggedUser.nome,
          relatorio: checkReport,
          avariasEncontradas: checkAvarias,
          assinatura: checkSign || "Assinado Digitalmente"
        };
      }
      return item;
    });

    setAgenda(updated);

    // If an anomaly/avaria was found, auto-report an occurrence!
    if (checkAvarias.trim()) {
      const targetItem = agenda.find(i => i.id === id);
      const novaOc: Ocorrencia = {
        id_ocorr: "oc-" + (ocorrencias.length + 1),
        id_predio: predio.id_predio,
        id_fracao: "common",
        descricao: `[AVARIA DETETADA NA VISTORIA DE ${targetItem?.equipamento}]: ${checkAvarias}`,
        data: new Date().toISOString().split("T")[0],
        estado: "A aguardar",
        medidas_tomadas: "",
        fotos: [],
        categoria: "Outros",
        tecnico_atribuido: loggedUser.nome
      };
      setOcorrencias(prev => [novaOc, ...prev]);
    }

    // Generate IA automatic PDF report & archive
    const targetItem = agenda.find(i => i.id === id);
    const docId = "doc-vist-" + Date.now();
    const novoDoc: Documento = {
      id_doc: docId,
      id_predio: predio.id_predio,
      nome: `Relatorio_Vistoria_${id}_${Date.now()}.pdf`,
      tipo: "PDF",
      data_upload: new Date().toISOString().split("T")[0],
      tamanho: "410 KB",
      categoria: "Manutenção",
      descricao: `Relatório de Inspeção Preventiva - ${targetItem?.equipamento}. Resultado: ${checkStatus}. Observações: ${checkReport}`,
      visibilidade: "Público",
      autor: loggedUser.nome,
      ano: new Date().getFullYear().toString(),
      tema: "Manutenção"
    };
    setDocumentos(prev => [novoDoc, ...prev]);

    setCheckItemId(null);
    setCheckReport("");
    setCheckAvarias("");
    setCheckSign("");
    alert("Vistoria registada! Relatório técnico em PDF assinado digitalmente e arquivado automaticamente.");
  };

  // Create Small Repair (Intervencao)
  const handleCreateIntervencao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIntDesc.trim()) return;

    const nova: Intervencao = {
      id: "int-" + (intervencoes.length + 1),
      descricao: newIntDesc,
      id_fracao: newIntFracao,
      prioridade: newIntPrioridade,
      fornecedor: newIntForn || "Fornecedor Local",
      custoPrevisto: parseFloat(newIntCusto) || 0,
      estado: "Pendente",
      anoExercicio: new Date().getFullYear().toString(),
      validadoAdmin: false
    };

    setIntervencoes([nova, ...intervencoes]);
    setNewIntDesc("");
    setNewIntForn("");
    setNewIntCusto("");
    setShowNewIntForm(false);
    alert("Ordem de reparação criada e distribuída ao técnico responsável!");
  };

  // Technician Completes Small Repair (Intervencao)
  const handleTechCompleteIntervencao = (id: string) => {
    const updated = intervencoes.map(i => {
      if (i.id === id) {
        return {
          ...i,
          estado: "Concluída" as const,
          dataHoraFim: new Date().toLocaleString(),
          relatorioTecnico: execReport,
          fotos: execFotos
        };
      }
      return i;
    });

    setIntervencoes(updated);
    setExecIntId(null);
    setExecReport("");
    setExecFotos([]);
    alert("Intervenção concluída com sucesso pelo técnico!");
  };

  // Admin Validates Small Repair (Intervencao), post financial movement and archives docs
  const handleAdminValidateIntervencao = (id: string) => {
    const finalCost = parseFloat(valCustoFinal) || 0;
    const target = intervencoes.find(i => i.id === id);
    if (!target) return;

    const updated = intervencoes.map(i => {
      if (i.id === id) {
        return {
          ...i,
          custoFinal: finalCost > 0 ? finalCost : i.custoPrevisto,
          validadoAdmin: true,
          faturaAnexa: valFatura
        };
      }
      return i;
    });

    setIntervencoes(updated);

    // Launch automatically in movements
    const lancamentoCusto = finalCost > 0 ? finalCost : target.custoPrevisto;
    const novoMov: Movimento = {
      id_mov: "mov-int-" + Date.now(),
      id_predio: predio.id_predio,
      id_conta: contas[0]?.id_conta || "cnt-1",
      data: new Date().toISOString().split("T")[0],
      tipo: "DESPESA",
      valor: lancamentoCusto,
      descricao: `[DESPESA MANUTENÇÃO] ${target.descricao} - ${target.fornecedor}`,
      categoria: "Manutenção",
      fotos: []
    };
    setMovements([novoMov, ...movements]);

    // Create automatic Document Archive entry
    const novoDoc: Documento = {
      id_doc: "doc-int-" + Date.now(),
      id_predio: predio.id_predio,
      nome: valFatura || `Fatura_Intervencao_${id}.pdf`,
      tipo: "PDF",
      data_upload: new Date().toISOString().split("T")[0],
      tamanho: "520 KB",
      categoria: "Manutenção",
      descricao: `Dossier Técnico + Fatura da Intervenção ${id}: ${target.descricao}`,
      visibilidade: "Administração",
      autor: loggedUser.nome,
      ano: new Date().getFullYear().toString(),
      tema: "Manutenção"
    };
    setDocumentos([novoDoc, ...documentos]);

    setValIntId(null);
    setValCustoFinal("");
    alert("Intervenção validada! Fatura anexada, despesa lançada na contabilidade e dossier guardado no arquivo.");
  };

  // Admin verifies / homologates a completed task inside Tarefas Concluídas view
  const handleVerifyTaskAdmin = (taskId: string, orig: string) => {
    if (orig === "reparacao") {
      const costNum = parseFloat(verifyCost) || 0;
      const target = intervencoes.find(i => i.id === taskId);
      if (!target) return;

      const updated = intervencoes.map(i => {
        if (i.id === taskId) {
          return {
            ...i,
            custoFinal: costNum > 0 ? costNum : i.custoPrevisto,
            validadoAdmin: true,
            faturaAnexa: verifyAnexo || "Fatura_Manutencao_Registada.pdf",
            relatorioTecnico: i.relatorioTecnico || "Reparação concluída com sucesso.",
            relatorioAdmin: verifyAdminReport || "Homologado pela administração do condomínio."
          };
        }
        return i;
      });
      setIntervencoes(updated);

      // Launch despesa in movements automatically
      const lancamentoCusto = costNum > 0 ? costNum : target.custoPrevisto;
      const novoMov: Movimento = {
        id_mov: "mov-int-" + Date.now(),
        id_predio: predio.id_predio,
        id_conta: contas[0]?.id_conta || "cnt-1",
        data: new Date().toISOString().split("T")[0],
        tipo: "DESPESA",
        valor: lancamentoCusto,
        descricao: `[HOMOLOGAÇÃO MANUTENÇÃO] ${target.descricao} - ${target.fornecedor}`,
        categoria: "Manutenção",
        fotos: []
      };
      setMovements([novoMov, ...movements]);

      // Archive document
      const novoDoc: Documento = {
        id_doc: "doc-int-homologated-" + Date.now(),
        id_predio: predio.id_predio,
        nome: verifyAnexo || `Fatura_Intervencao_${taskId}.pdf`,
        tipo: "PDF",
        data_upload: new Date().toISOString().split("T")[0],
        tamanho: "520 KB",
        categoria: "Manutenção",
        descricao: `Fatura e Relatório de Homologação Administrativa: ${verifyAdminReport || target.descricao}`,
        visibilidade: "Administração",
        autor: loggedUser.nome,
        ano: new Date().getFullYear().toString(),
        tema: "Manutenção"
      };
      setDocumentos([novoDoc, ...documentos]);
    } else {
      alert("Esta tarefa já se encontra validada ou não requer validação de custos.");
    }

    setSelectedTaskToVerify(null);
    setVerifyCost("");
    setVerifyAdminReport("");
    setVerifyAnexo("");
    alert("Homologação registada com sucesso! Contabilidade e Arquivo Documental atualizados.");
  };

  // Create Extraordinary Work (Obra Grande)
  const handleCreateObraExtra = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newObraDesc.trim() || !newObraCusto) return;

    const cost = parseFloat(newObraCusto) || 0;
    const valuesByFraction: { [key: string]: number } = {};
    fracoes.forEach(f => {
      valuesByFraction[f.id_fracao] = (cost * f.permilagem) / 1000;
    });

    const nova: ObraExtraordinaria = {
      id: "obr-" + (obrasExtra.length + 1),
      descricao: newObraDesc,
      fornecedorId: "forn-custom",
      fornecedorNome: newObraForn || "Empreiteiro Geral",
      dataInicio: newObraInicio || new Date().toISOString().split("T")[0],
      dataFim: newObraFim || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      custoTotal: cost,
      necessitaCotaExtra: newObraNecessitaCota,
      mesesFracionamento: newObraMeses,
      valoresPorFracao: valuesByFraction,
      impactoFundoReserva: cost * 0.1, // recommended legal reserve fund contribution
      impactoSaldoAnual: -cost,
      estado: "Planeada",
      orcamentos: ["Orcamento_Principal_Obra_Validado.pdf"],
      documentosArquivados: false
    };

    setObrasExtra([nova, ...obrasExtra]);
    setShowNewObraForm(false);
    setNewObraDesc("");
    setNewObraForn("");
    setNewObraCusto("");
    alert("Intervenção Extraordinária (Obra Grande) adicionada com plano financeiro de permilagem!");
  };

  // Confirm Extraordinary Work & launch quota + automatic archive
  const handleConfirmarObraExtra = (id: string) => {
    const updated = obrasExtra.map(o => {
      if (o.id === id) {
        return {
          ...o,
          estado: "Em Curso" as const,
          documentosArquivados: true
        };
      }
      return o;
    });

    setObrasExtra(updated);
    const target = obrasExtra.find(o => o.id === id);
    if (!target) return;

    // Post to movements automatically as Despesa
    const novoMov: Movimento = {
      id_mov: "mov-obr-" + Date.now(),
      id_predio: predio.id_predio,
      id_conta: contas[0]?.id_conta || "cnt-1",
      data: new Date().toISOString().split("T")[0],
      tipo: "DESPESA",
      valor: target.custoTotal,
      descricao: `[OBRA EXTRAORDINÁRIA] ${target.descricao} - Fornecedor: ${target.fornecedorNome}`,
      categoria: "Obras",
      fotos: []
    };
    setMovements([novoMov, ...movements]);

    // Auto-archive in extraordinary works
    const novoDoc: Documento = {
      id_doc: "doc-obr-" + Date.now(),
      id_predio: predio.id_predio,
      nome: `Plano_Obra_Extraordinaria_${id}.pdf`,
      tipo: "PDF",
      data_upload: new Date().toISOString().split("T")[0],
      tamanho: "1.2 MB",
      categoria: "Intervenções Extraordinárias",
      descricao: `Dossier de Adjudicação + Orçamentos para Obra: ${target.descricao}`,
      visibilidade: "Público",
      autor: loggedUser.nome,
      ano: new Date().getFullYear().toString(),
      tema: "Obras"
    };
    setDocumentos([novoDoc, ...documentos]);

    alert("Obra adjudicada! Lançamento de despesa extraordinária efetuado e plano arquivado.");
  };

  // Admin verifies & signs off a completed task
  const handleVerifyCompletedTask = (id: string, isInt = true) => {
    if (isInt) {
      setIntervencoes(intervencoes.map(i => i.id === id ? { ...i, validadoAdmin: true } : i));
    } else {
      setObrasExtra(obrasExtra.map(o => o.id === id ? { ...o, estado: "Concluída" } : o));
    }
    alert("Trabalho verificado e homologado pela administração com sucesso!");
  };

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100">
      
      {/* Simulation Console Card */}
      <div className="bg-slate-950 text-white p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 no-print">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-full bg-violet-500/15 flex items-center justify-center text-violet-400 border border-violet-500/35">
            <Wrench className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-sans">Acreditações & Consola de Fluxos</h3>
            <p className="text-[11px] text-slate-450">Simule perfis técnicos ou condóminos para testar os fluxos integrados de manutenção.</p>
          </div>
        </div>
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 gap-1">
          {(["ADMIN", "TECNICO", "USER"] as const).map(role => (
            <button
              key={role}
              onClick={() => setActiveProfile(role)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeProfile === role 
                  ? "bg-violet-600 text-white shadow-md font-extrabold" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {role === "ADMIN" ? "👑 Admin" : role === "TECNICO" ? "🔍 Técnico" : "🏠 Condómino"}
            </button>
          ))}
        </div>
      </div>

      {/* REMOVED SUB-MENU TABS IN FAVOR OF CENTRAL EXPANDABLE MENU */}

      {/* ----------------- 1. OCORRÊNCIAS WORKFLOW ----------------- */}
      {activeSubSection === "manutencao_ocorrencias" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          
          {/* Condómino (PWA) Side Form */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-amber-500" />
                Reportar Avaria ou Ocorrência
              </h3>
              
              <form onSubmit={handleSubmeterOcorrencia} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Local / Fração Relacionada</label>
                  <select
                    value={ocFracao}
                    onChange={e => setOcFracao(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 text-xs rounded-lg focus:outline-none"
                  >
                    <option value="common">Áreas Comuns do Edifício</option>
                    {fracoes.map(f => (
                      <option key={f.id_fracao} value={f.id_fracao}>{f.fracao_nome} ({f.proprietario.nome})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Categoria</label>
                  <select
                    value={ocCategoria}
                    onChange={e => setOcCategoria(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 text-xs rounded-lg focus:outline-none"
                  >
                    <option value="Infiltrações & Canalização">Infiltrações & Canalização</option>
                    <option value="Eletricidade & Iluminação">Eletricidade & Iluminação</option>
                    <option value="Elevadores & Escadas">Elevadores & Escadas</option>
                    <option value="Estrutural & Alvenaria">Estrutural & Alvenaria</option>
                    <option value="Limpeza & Jardinagem">Limpeza & Jardinagem</option>
                    <option value="Segurança & Incêndios">Segurança & Incêndios</option>
                    <option value="Outros">Outros Equipamentos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Prioridade</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {(["Baixa", "Média", "Alta"] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setOcPrioridade(p)}
                        className={`py-1 rounded-md text-xs font-bold border cursor-pointer ${
                          ocPrioridade === p
                            ? p === "Alta" ? "bg-red-550 text-white border-red-500 bg-red-600" : p === "Média" ? "bg-amber-500 text-white border-amber-500" : "bg-blue-500 text-white border-blue-500"
                            : "bg-slate-50 dark:bg-slate-950 text-slate-500 hover:bg-slate-100 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Descrição Detalhada</label>
                  <textarea
                    rows={3}
                    value={ocDescricao}
                    onChange={e => setOcDescricao(e.target.value)}
                    placeholder="Descreva o problema verificado com precisão..."
                    className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg focus:outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Evidências Fotográficas</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-3 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950"
                  >
                    <Upload className="h-4 w-4 mx-auto text-slate-400 mb-1" />
                    <span className="text-[10px] text-slate-500 font-medium">Anexar ou tirar foto</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, true)}
                      className="hidden"
                    />
                  </div>

                  {ocFotos.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {ocFotos.map((f, idx) => (
                        <div key={idx} className="relative rounded overflow-hidden aspect-square border">
                          <img src={f.preview} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Submeter Avaria</span>
                </button>
              </form>
            </div>
          </div>

          {/* Ocorrências List - Admin Backoffice and Technicians */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Linha de Entrada de Ocorrências</h4>
            
            {ocorrencias.filter(o => o.id_predio === predio.id_predio).length === 0 ? (
              <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border text-center text-slate-400 text-xs">
                Nenhuma ocorrência registada para este edifício.
              </div>
            ) : (
              <div className="space-y-3">
                {ocorrencias.filter(o => o.id_predio === predio.id_predio).map(o => {
                  const isAssignedToMe = activeProfile === "TECNICO" && (o.tecnico_atribuido === "Eng. Rui Melo" || o.tecnico_atribuido?.includes("Rui"));
                  return (
                    <div key={o.id_ocorr} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative space-y-3">
                      
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] bg-slate-100 dark:bg-slate-950 font-mono font-bold px-1.5 py-0.5 rounded">ID: {o.id_ocorr}</span>
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded">{o.categoria || "Geral"}</span>
                            <span className="text-[10px] bg-slate-150 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-bold">
                              {o.id_fracao === "common" ? "Área Comum" : "Fração " + fracoes.find(f => f.id_fracao === o.id_fracao)?.fracao_nome}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-medium">Reportado em: {formatDatePT(o.data)}</p>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold border ${
                          o.estado === "Concluída" 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30" 
                            : o.estado === "Em Reparação"
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30"
                            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30"
                        }`}>
                          {o.estado}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{o.descricao}</p>

                      <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-800 text-xs gap-2">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <User className="h-3.5 w-3.5" />
                          <span>Técnico Responsável: <strong className="text-slate-700 dark:text-slate-300">{o.tecnico_atribuido || "Não Atribuído"}</strong></span>
                        </div>

                        <div className="flex gap-2">
                          {/* Admin Dispatch button */}
                          {(activeProfile === "ADMIN" || activeProfile === "EMPRESA_GESTORA") && o.estado !== "Concluída" && (
                            <button
                              onClick={() => {
                                setDispatchOcorrId(o.id_ocorr);
                                setDispTecnico(o.tecnico_atribuido || "");
                              }}
                              className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-bold px-2.5 py-1 rounded-lg text-xs cursor-pointer flex items-center gap-1"
                            >
                              <Wrench className="h-3 w-3" />
                              <span>Classificar & Despachar</span>
                            </button>
                          )}

                          {/* Technician workspace button */}
                          {o.estado !== "Concluída" && (activeProfile === "TECNICO" || activeProfile === "ADMIN" || activeProfile === "EMPRESA_GESTORA") && (
                            <button
                              onClick={() => setTechOcorrId(o.id_ocorr)}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded-lg text-xs cursor-pointer flex items-center gap-1"
                            >
                              <Play className="h-3 w-3" />
                              <span>Intervenção Técnica</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {o.medidas_tomadas && (
                        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border text-xs text-slate-600 dark:text-slate-400 font-medium whitespace-pre-line">
                          <strong>Histórico de Medidas:</strong><br />
                          {o.medidas_tomadas}
                        </div>
                      )}

                      {/* Photo preview */}
                      {o.fotos && o.fotos.length > 0 && (
                        <div className="flex gap-2 pt-1">
                          {o.fotos.map((img, idx) => (
                            <div key={idx} className="relative rounded overflow-hidden h-12 w-16 border">
                              <img src={img.preview} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Admin Dispatch Panel */}
                      {dispatchOcorrId === o.id_ocorr && (
                        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border mt-3 space-y-3">
                          <h5 className="text-xs font-bold uppercase text-slate-500">Despacho de Ocorrência</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Classificação Operacional</label>
                              <select
                                value={dispClassificacao}
                                onChange={e => setDispClassificacao(e.target.value as any)}
                                className="w-full border p-2 rounded bg-white dark:bg-slate-900 focus:outline-none"
                              >
                                <option value="manutencao">Manutenção Preventiva</option>
                                <option value="intervencao">Intervenção (Pequena Reparação)</option>
                                <option value="obra">Intervenção Extraordinária (Obra Grande)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Atribuir Técnico / Empresa</label>
                              <input
                                type="text"
                                value={dispTecnico}
                                onChange={e => setDispTecnico(e.target.value)}
                                placeholder="Nome do técnico ou fornecedor..."
                                className="w-full border p-2 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Prioridade</label>
                              <select
                                value={dispPrioridade}
                                onChange={e => setDispPrioridade(e.target.value as any)}
                                className="w-full border p-2 rounded bg-white dark:bg-slate-900"
                              >
                                <option value="Baixa">Baixa</option>
                                <option value="Média">Média</option>
                                <option value="Alta">Alta</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Notas de Despacho</label>
                              <input
                                type="text"
                                value={dispNotas}
                                onChange={e => setDispNotas(e.target.value)}
                                placeholder="Notas internas adicionais..."
                                className="w-full border p-2 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDispatchOcorr(o.id_ocorr)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded text-xs cursor-pointer"
                            >
                              Confirmar & Enviar
                            </button>
                            <button
                              onClick={() => setDispatchOcorrId(null)}
                              className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-1.5 px-4 rounded text-xs cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Technician Workspace Panel */}
                      {techOcorrId === o.id_ocorr && (
                        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border mt-3 space-y-3">
                          <h5 className="text-xs font-bold uppercase text-slate-500">Workspace do Técnico</h5>
                          
                          <div className="text-xs space-y-2">
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Relatório Técnico da Intervenção</label>
                              <textarea
                                value={techReport}
                                onChange={e => setTechReport(e.target.value)}
                                placeholder="Descreva os passos dados, materiais e resolução do problema..."
                                className="w-full border p-2.5 rounded bg-white dark:bg-slate-900"
                                rows={2}
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Assinatura Digital (Simulado)</label>
                              <input
                                type="text"
                                value={techSign}
                                onChange={e => setTechSign(e.target.value)}
                                placeholder="Escreva o seu nome completo para assinar..."
                                className="w-full border p-2 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleTechCompleteOcorr(o.id_ocorr)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded text-xs cursor-pointer"
                            >
                              Marcar como Resolvido & Assinar
                            </button>
                            <button
                              onClick={() => setTechOcorrId(null)}
                              className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-1.5 px-4 rounded text-xs cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------- 2. AGENDA DE MANUTENÇÃO (VISTORIAS TÉCNICAS) ----------------- */}
      {activeSubSection === "manutencao_agenda" && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Inspeções & Manutenção Preventiva</h3>
              <p className="text-xs text-slate-500">Agenda anual de vistorias técnicas regulamentares e verificações de equipamentos do edifício.</p>
            </div>

            <button
              onClick={handleGerarAgendaIA}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              <span>Gerar Agenda Preventiva IA</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              {agenda.map(item => (
                <div key={item.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded font-mono font-bold">ID: {item.id}</span>
                        <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
                          item.tipo === "inspeção_obrigatoria" 
                            ? "bg-red-50 text-red-700 dark:bg-red-950/20" 
                            : "bg-blue-50 text-blue-700 dark:bg-blue-950/20"
                        }`}>
                          {item.tipo === "inspeção_obrigatoria" ? "Inspeção Obrigatória (Lei)" : "Manutenção Preventiva"}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.equipamento}</h4>
                    </div>

                    <span className={`text-xs px-2.5 py-1 rounded-full border font-bold ${
                      item.estado === "Verificado"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : item.estado === "Não Verificado"
                        ? "bg-rose-50 text-rose-800 border-rose-200"
                        : "bg-amber-50 text-amber-800 border-amber-200 animate-pulse"
                    }`}>
                      {item.estado}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-850 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <div>
                      <span className="text-[9px] block text-slate-400 uppercase font-bold">Data Planeada</span>
                      <span>{formatDatePT(item.dataPlaneada)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] block text-slate-400 uppercase font-bold">Periodicidade</span>
                      <span>{item.periodicidade}</span>
                    </div>
                    <div>
                      <span className="text-[9px] block text-slate-400 uppercase font-bold">Última Verificação</span>
                      <span>{item.dataVerificacao ? formatDatePT(item.dataVerificacao) : "Pendente"}</span>
                    </div>
                  </div>

                  {item.estado === "Agendado" && (activeProfile === "TECNICO" || activeProfile === "ADMIN" || activeProfile === "EMPRESA_GESTORA") && (
                    <div className="pt-2">
                      <button
                        onClick={() => setCheckItemId(item.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs cursor-pointer flex items-center gap-1"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Realizar Inspeção Técnica</span>
                      </button>
                    </div>
                  )}

                  {/* Checklist signoff overlay panel */}
                  {checkItemId === item.id && (
                    <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-xl border mt-3 space-y-3">
                      <h5 className="text-xs font-bold uppercase text-slate-500">Checklist da Vistoria</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Estado de Verificação</label>
                          <select
                            value={checkStatus}
                            onChange={e => setCheckStatus(e.target.value as any)}
                            className="w-full border p-2 rounded bg-white dark:bg-slate-900"
                          >
                            <option value="Verificado">Verificado (Conforme)</option>
                            <option value="Não Verificado">Não Verificado / Com Anomalia</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Avarias / Problemas Encontrados</label>
                          <input
                            type="text"
                            value={checkAvarias}
                            onChange={e => setCheckAvarias(e.target.value)}
                            placeholder="Deixe em branco se estiver tudo em conformidade..."
                            className="w-full border p-2 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Descrição / Notas Técnicas</label>
                          <textarea
                            value={checkReport}
                            onChange={e => setCheckReport(e.target.value)}
                            placeholder="Escreva as observações completas dos testes efetuados..."
                            className="w-full border p-2 rounded bg-white dark:bg-slate-900"
                            rows={2}
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Assinatura Digital Técnico Responsável</label>
                          <input
                            type="text"
                            value={checkSign}
                            onChange={e => setCheckSign(e.target.value)}
                            placeholder="Insira o seu nome completo..."
                            className="w-full border p-2 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCheckAgendaItem(item.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded text-xs cursor-pointer"
                        >
                          Concluir e Emitir PDF de Inspeção IA
                        </button>
                        <button
                          onClick={() => setCheckItemId(null)}
                          className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-1.5 px-4 rounded text-xs cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {item.estado !== "Agendado" && (
                    <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg text-xs space-y-1">
                      <p className="font-bold text-slate-600 dark:text-slate-400">Verificação efetuada por {item.tecnico}:</p>
                      <p className="italic text-slate-500 font-medium">{item.relatorio || "Em conformidade."}</p>
                      {item.avariasEncontradas && (
                        <p className="text-red-600 dark:text-red-400 font-bold">Avaria detetada: {item.avariasEncontradas}</p>
                      )}
                      <p className="text-[10px] text-slate-400">Dossier técnico arquivado e assinado por: {item.assinatura}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Smart info column */}
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300 space-y-3">
                <h4 className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" />
                  Alertas Automáticos de Validades
                </h4>
                <ul className="space-y-2 font-medium">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 bg-red-600 rounded-full animate-ping"></span>
                    <span>Validade Extintores: <strong className="text-red-600 dark:text-red-400 font-black">Expira em 30 dias</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 bg-amber-500 rounded-full"></span>
                    <span>Inspecção Elevadores: Programada para breve</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 bg-slate-300 rounded-full"></span>
                    <span>Inspeção Bombas: Conforme</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- 3. INTERVENÇÕES (PEQUENAS REPARAÇÕES) ----------------- */}
      {activeSubSection === "manutencao_intervencoes" && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Registo de Pequenas Reparações</h3>
              <p className="text-xs text-slate-500">Gestão e acompanhamento de intervenções de manutenção do edifício.</p>
            </div>

            <button
              onClick={() => setShowNewIntForm(!showNewIntForm)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md cursor-pointer flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              <span>Lançar Intervenção</span>
            </button>
          </div>

          {showNewIntForm && (
            <form onSubmit={handleCreateIntervencao} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border text-xs space-y-3 max-w-2xl">
              <h4 className="font-bold uppercase text-slate-600">Criar Ordem de Reparação</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Descrição do Trabalho</label>
                  <input
                    type="text"
                    required
                    value={newIntDesc}
                    onChange={e => setNewIntDesc(e.target.value)}
                    placeholder="Ex: Reparar trinco elétrico do portão..."
                    className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Fração / Local Comum</label>
                  <select
                    value={newIntFracao}
                    onChange={e => setNewIntFracao(e.target.value)}
                    className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="common">Áreas Comuns</option>
                    {fracoes.map(f => (
                      <option key={f.id_fracao} value={f.id_fracao}>{f.fracao_nome} ({f.proprietario.nome})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Prioridade</label>
                  <select
                    value={newIntPrioridade}
                    onChange={e => setNewIntPrioridade(e.target.value as any)}
                    className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Fornecedor / Técnico</label>
                  <input
                    type="text"
                    value={newIntForn}
                    onChange={e => setNewIntForn(e.target.value)}
                    placeholder="Nome do fornecedor atribuído..."
                    className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Custo Estimado / Previsto (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newIntCusto}
                    onChange={e => setNewIntCusto(e.target.value)}
                    placeholder="Ex: 120"
                    className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded text-xs cursor-pointer">
                  Confirmar Ordem
                </button>
                <button type="button" onClick={() => setShowNewIntForm(false)} className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-1.5 px-4 rounded text-xs cursor-pointer">
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {intervencoes.filter(i => i.estado !== "Concluída").map(i => (
              <div key={i.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded font-mono font-bold">ID: {i.id}</span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">Reparação</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{i.descricao}</h4>
                  </div>

                  <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2 py-1 rounded-full font-bold">
                    {i.estado}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-850 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="text-[9px] block text-slate-400 uppercase font-bold">Local</span>
                    <span>{i.id_fracao === "common" ? "Área Comum" : "Fração " + fracoes.find(f => f.id_fracao === i.id_fracao)?.fracao_nome}</span>
                  </div>
                  <div>
                    <span className="text-[9px] block text-slate-400 uppercase font-bold">Prioridade</span>
                    <span className={i.prioridade === "Alta" ? "text-red-600" : "text-slate-700 dark:text-slate-300"}>{i.prioridade}</span>
                  </div>
                  <div>
                    <span className="text-[9px] block text-slate-400 uppercase font-bold">Fornecedor Atribuído</span>
                    <span>{i.fornecedor}</span>
                  </div>
                  <div>
                    <span className="text-[9px] block text-slate-400 uppercase font-bold">Orçamento Estimado</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{i.custoPrevisto.toFixed(2)}€</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {/* Technician executes small repair */}
                  {i.estado === "Pendente" && (activeProfile === "TECNICO" || activeProfile === "ADMIN" || activeProfile === "EMPRESA_GESTORA") && (
                    <button
                      onClick={() => setExecIntId(i.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs cursor-pointer flex items-center gap-1"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Iniciar Trabalho Técnico</span>
                    </button>
                  )}

                  {/* Admin Validates Completed work */}
                  {i.estado === "Concluída" && !i.validadoAdmin && (activeProfile === "ADMIN" || activeProfile === "EMPRESA_GESTORA" || activeProfile === "PRESIDENTE") && (
                    <button
                      onClick={() => setValIntId(i.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs cursor-pointer flex items-center gap-1"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      <span>Validar & Lançar Despesa</span>
                    </button>
                  )}
                </div>

                {/* Technician complete panel overlay */}
                {execIntId === i.id && (
                  <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-xl border mt-3 space-y-3">
                    <h5 className="text-xs font-bold uppercase text-slate-500">Concluir Ordem de Serviço</h5>
                    <div className="text-xs space-y-2">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Notas Técnicas e Descritivo</label>
                        <textarea
                          value={execReport}
                          onChange={e => setExecReport(e.target.value)}
                          placeholder="Relate os serviços efetuados no local..."
                          className="w-full border p-2 rounded bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTechCompleteIntervencao(i.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded text-xs cursor-pointer"
                      >
                        Submeter como Executado
                      </button>
                      <button
                        onClick={() => setExecIntId(null)}
                        className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-1.5 px-4 rounded text-xs cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Admin validating panel overlay */}
                {valIntId === i.id && (
                  <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-xl border mt-3 space-y-3">
                    <h5 className="text-xs font-bold uppercase text-slate-500">Validação Administrativa</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Custo Final do Trabalho (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={valCustoFinal}
                          onChange={e => setValCustoFinal(e.target.value)}
                          placeholder={i.custoPrevisto.toString()}
                          className="w-full border p-2 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Nome da Fatura a Anexar</label>
                        <input
                          type="text"
                          value={valFatura}
                          onChange={e => setValFatura(e.target.value)}
                          placeholder="Fatura_Servico_Manutencao_Emitida.pdf"
                          className="w-full border p-2 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAdminValidateIntervencao(i.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded text-xs cursor-pointer"
                      >
                        Aprovar Trabalho & Lançar Movimento
                      </button>
                      <button
                        onClick={() => setValIntId(null)}
                        className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-1.5 px-4 rounded text-xs cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ----------------- 4. INTERVENÇÕES EXTRAORDINÁRIAS (OBRAS GRANDES) ----------------- */}
      {activeSubSection === "manutencao_extraordinarias" && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Intervenções Extraordinárias (Obras Grandes)</h3>
              <p className="text-xs text-slate-500">Planeamento técnico, cálculo inteligente de quotas extraordinárias e orçamentos de grande escala.</p>
            </div>

            <button
              onClick={() => setShowNewObraForm(!showNewObraForm)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md cursor-pointer flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              <span>Planear Nova Obra</span>
            </button>
          </div>

          {showNewObraForm && (
            <form onSubmit={handleCreateObraExtra} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border text-xs space-y-4 max-w-4xl">
              <h4 className="font-bold uppercase text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Hammer className="h-4 w-4 text-purple-600" />
                Dossier de Planeamento de Obra Grande
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Descrição Detalhada do Projeto</label>
                  <input
                    type="text"
                    required
                    value={newObraDesc}
                    onChange={e => setNewObraDesc(e.target.value)}
                    placeholder="Ex: Pintura Geral e Impermeabilização da Fachada..."
                    className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Empreiteiro / Fornecedor</label>
                  <input
                    type="text"
                    value={newObraForn}
                    onChange={e => setNewObraForn(e.target.value)}
                    placeholder="Ex: Pinturas do Norte, Lda."
                    className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Custo Total Previsto (€)</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={newObraCusto}
                    onChange={e => setNewObraCusto(e.target.value)}
                    placeholder="Ex: 12500"
                    className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Data Início</label>
                  <input
                    type="date"
                    value={newObraInicio}
                    onChange={e => setNewObraInicio(e.target.value)}
                    className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Data Conclusão</label>
                  <input
                    type="date"
                    value={newObraFim}
                    onChange={e => setNewObraFim(e.target.value)}
                    className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-xl border border-purple-150 text-xs">
                <label className="flex items-center gap-2 mb-2 font-bold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newObraNecessitaCota}
                    onChange={e => setNewObraNecessitaCota(e.target.checked)}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4"
                  />
                  <span>Requer Lançamento de Quota Extraordinária?</span>
                </label>
                
                {newObraNecessitaCota && (
                  <div className="space-y-3 pt-2 pl-6 border-l-2 border-purple-200">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Fracionamento Recomendado (Meses)</label>
                      <select
                        value={newObraMeses}
                        onChange={e => setNewObraMeses(parseInt(e.target.value))}
                        className="border p-1.5 rounded bg-white dark:bg-slate-900"
                      >
                        <option value={3}>3 meses</option>
                        <option value={6}>6 meses</option>
                        <option value={9}>9 meses</option>
                        <option value={12}>12 meses</option>
                        <option value={18}>18 meses</option>
                        <option value={24}>24 meses</option>
                      </select>
                    </div>

                    {/* IA Prediction and Simulator Display */}
                    {iaBreakdown && (
                      <div className="space-y-2 text-slate-700 dark:text-slate-300 font-medium">
                        <p className="font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1 text-[11px]">
                          <Sparkles className="h-4 w-4 text-purple-600" />
                          Sugestão Automática de Quotas Extraordinárias (IA Predictor)
                        </p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white dark:bg-slate-950 p-3 rounded-lg border">
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase block">Impacto Fundo Reserva</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{iaBreakdown.reserveImpact.toFixed(2)}€</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase block">Financiamento por Quotas</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{iaBreakdown.outstandingQuotaCost.toFixed(2)}€</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase block">Quota Mensal Global ({newObraMeses}m)</span>
                            <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{iaBreakdown.monthlyBreakdown[newObraMeses].toFixed(2)}€/mês</span>
                          </div>
                        </div>

                        <div className="pt-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Sugestão de Repartição por Fração (Permilagem)</span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900 rounded border">
                            {fracoes.map(f => {
                              const share = iaBreakdown.byFraction[f.id_fracao] || 0;
                              const monthlyShare = share / newObraMeses;
                              return (
                                <div key={f.id_fracao} className="p-1.5 bg-white dark:bg-slate-950 border rounded text-[10px]">
                                  <span className="font-bold text-slate-600 dark:text-slate-400 block">{f.fracao_nome} ({f.permilagem}‰)</span>
                                  <span className="font-mono font-bold block">Total: {share.toFixed(2)}€</span>
                                  <span className="font-mono text-slate-500">Mensal: {monthlyShare.toFixed(2)}€</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1.5 px-4 rounded text-xs cursor-pointer">
                  Aprovar Dossier de Planeamento
                </button>
                <button type="button" onClick={() => setShowNewObraForm(false)} className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-1.5 px-4 rounded text-xs cursor-pointer">
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {obrasExtra.map(o => (
              <div key={o.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative space-y-4">
                
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded font-mono font-bold">ID: {o.id}</span>
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/30 px-2 py-0.5 rounded">Obra Grande Extraordinária</span>
                    </div>
                    <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">{o.descricao}</h4>
                  </div>

                  <span className={`text-xs px-2.5 py-1 rounded-full border font-bold ${
                    o.estado === "Concluída"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : o.estado === "Em Curso"
                      ? "bg-blue-50 text-blue-800 border-blue-200 animate-pulse"
                      : "bg-purple-50 text-purple-800 border-purple-200"
                  }`}>
                    {o.estado}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-850 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="text-[9px] block text-slate-400 uppercase font-bold">Fornecedor / Empreiteiro</span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold">{o.fornecedorNome}</span>
                  </div>
                  <div>
                    <span className="text-[9px] block text-slate-400 uppercase font-bold">Custo Total Adjudicado</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-black">{o.custoTotal.toLocaleString()}€</span>
                  </div>
                  <div>
                    <span className="text-[9px] block text-slate-400 uppercase font-bold">Data Início</span>
                    <span>{formatDatePT(o.dataInicio)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] block text-slate-400 uppercase font-bold">Data Fim Estimada</span>
                    <span>{formatDatePT(o.dataFim)}</span>
                  </div>
                </div>

                {o.necessitaCotaExtra && (
                  <div className="border-l-4 border-purple-500 pl-4 space-y-2">
                    <p className="font-bold text-xs text-purple-700 dark:text-purple-400">Plano de Financiamento de Quotas Extraordinárias ({o.mesesFracionamento} Meses):</p>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                      {fracoes.map(f => {
                        const costPerFrac = (o.custoTotal * f.permilagem) / 1000;
                        const monthlyVal = costPerFrac / o.mesesFracionamento;
                        return (
                          <div key={f.id_fracao} className="p-2 bg-slate-50 dark:bg-slate-950 rounded border text-[10px] font-medium">
                            <span className="font-bold text-slate-600 dark:text-slate-400 block">{f.fracao_nome}</span>
                            <span className="font-mono block">Total: {costPerFrac.toFixed(1)}€</span>
                            <span className="font-mono font-bold text-purple-600">Mensal: {monthlyVal.toFixed(1)}€</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {o.estado === "Planeada" && (activeProfile === "ADMIN" || activeProfile === "EMPRESA_GESTORA" || activeProfile === "PRESIDENTE") && (
                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => handleConfirmarObraExtra(o.id)}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-xl text-xs cursor-pointer shadow flex items-center gap-1"
                    >
                      <Check className="h-4 w-4" />
                      <span>Confirmar Adjudicação & Lançar Despesa</span>
                    </button>
                  </div>
                )}

                {o.estado === "Em Curso" && (activeProfile === "ADMIN" || activeProfile === "EMPRESA_GESTORA" || activeProfile === "PRESIDENTE") && (
                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => handleVerifyCompletedTask(o.id, false)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs cursor-pointer shadow flex items-center gap-1"
                    >
                      <CheckSquare className="h-4 w-4" />
                      <span>Homologar e Fechar Obra</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ----------------- 5. TAREFAS CONCLUÍDAS ----------------- */}
      {activeSubSection === "manutencao_concluidas" && (() => {
        // Build the aggregated list of all completed tasks
        const allConcluidas: {
          id: string;
          origem: "reparacao" | "ocorrencia" | "vistoria" | "obra";
          titulo: string;
          fornecedor: string;
          custo: number | string;
          dataConclusao: string;
          relatorioTecnico: string;
          relatorioAdmin: string;
          anexos: string[];
          fotos: { name: string; preview: string; size: string }[];
          validada: boolean;
          rawItem: any;
        }[] = [];

        // 1. Intervenções (Pequenas Reparações) concluídas
        intervencoes.forEach(i => {
          if (i.estado === "Concluída") {
            allConcluidas.push({
              id: i.id,
              origem: "reparacao",
              titulo: i.descricao,
              fornecedor: i.fornecedor,
              custo: i.custoFinal !== undefined ? i.custoFinal : i.custoPrevisto,
              dataConclusao: i.dataHoraFim || "Recente",
              relatorioTecnico: i.relatorioTecnico || "Reparação técnica finalizada no local.",
              relatorioAdmin: i.validadoAdmin 
                ? i.relatorioAdmin || "Homologado pela administração. Despesa lançada no extrato." 
                : "Pendente de verificação e homologação administrativa.",
              anexos: i.faturaAnexa ? [i.faturaAnexa] : ["Dossier_Geral_Intervencao.pdf"],
              fotos: [],
              validada: !!i.validadoAdmin,
              rawItem: i
            });
          }
        });

        // 2. Ocorrências concluídas
        ocorrencias.forEach(o => {
          if (o.estado === "Concluída") {
            allConcluidas.push({
              id: o.id_ocorr,
              origem: "ocorrencia",
              titulo: `Ocorrência Resolvida: ${o.descricao}`,
              fornecedor: o.tecnico_atribuido || "Técnico de Turno",
              custo: "Incluído no Contrato de Manutenção",
              dataConclusao: o.data || "Recentemente",
              relatorioTecnico: o.medidas_tomadas || "Procedimento de assistência executado.",
              relatorioAdmin: "Finalizado pelo departamento técnico e registado.",
              anexos: [`Relatorio_Tecnico_Ocorrencia_${o.id_ocorr}.pdf`],
              fotos: o.fotos || [],
              validada: true,
              rawItem: o
            });
          }
        });

        // 3. Agenda de vistorias técnicas concluídas/verificadas
        agenda.forEach(item => {
          if (item.estado === "Verificado" || item.estado === "Não Verificado") {
            allConcluidas.push({
              id: item.id,
              origem: "vistoria",
              titulo: `Vistoria Preventiva: ${item.equipamento}`,
              fornecedor: item.tecnico || "Empresa de Inspeções",
              custo: "Avença Preventiva Anual / Isento",
              dataConclusao: item.dataVerificacao || item.dataPlaneada,
              relatorioTecnico: item.relatorio || "Inspeção e ensaios regulamentares em conformidade.",
              relatorioAdmin: `Certificado de inspeção homologado digitalmente por: ${item.assinatura}`,
              anexos: [`Relatorio_Vistoria_${item.id}.pdf`],
              fotos: [],
              validada: true,
              rawItem: item
            });
          }
        });

        // 4. Obras Extraordinárias concluídas
        obrasExtra.forEach(o => {
          if (o.estado === "Concluída") {
            allConcluidas.push({
              id: o.id,
              origem: "obra",
              titulo: `Obra Extraordinária Concluída: ${o.descricao}`,
              fornecedor: o.fornecedorNome,
              custo: o.custoTotal,
              dataConclusao: o.dataFim,
              relatorioTecnico: "Trabalhos gerais de reabilitação estrutural finalizados e homologados.",
              relatorioAdmin: "Dossier e pagamentos de permilagem organizados e cobrados.",
              anexos: o.orcamentos || ["Auto_Recepcao_Obra.pdf"],
              fotos: [],
              validada: true,
              rawItem: o
            });
          }
        });

        return (
          <div className="space-y-4 animate-fadeIn text-slate-800 dark:text-slate-100">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Histórico de Tarefas Concluídas</h3>
              <p className="text-xs text-slate-500">Histórico de vistorias, pequenas reparações e intervenções extraordinárias homologadas.</p>
            </div>

            {allConcluidas.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border text-center text-slate-400 text-xs">
                Nenhuma tarefa concluída ou registada de momento neste edifício.
              </div>
            ) : (
              <div className="space-y-4">
                {allConcluidas.map(task => (
                  <div 
                    key={`${task.origem}-${task.id}`} 
                    className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded font-mono font-bold">ID: {task.id}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            task.origem === "reparacao" ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" :
                            task.origem === "ocorrencia" ? "text-amber-600 bg-amber-50 dark:bg-amber-950/30" :
                            task.origem === "vistoria" ? "text-blue-600 bg-blue-50 dark:bg-blue-950/30" :
                            "text-purple-600 bg-purple-50 dark:bg-purple-950/30"
                          }`}>
                            {task.origem === "reparacao" ? "Reparação Resolvida" :
                             task.origem === "ocorrencia" ? "Ocorrência Fechada" :
                             task.origem === "vistoria" ? "Vistoria Efetuada" :
                             "Obra Concluída"}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{task.titulo}</h4>
                      </div>

                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                        task.validada 
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20" 
                          : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 animate-pulse"
                      }`}>
                        {task.validada ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Homologada / Verificada</span>
                          </>
                        ) : (
                          <>
                            <TriangleAlert className="h-3.5 w-3.5 text-amber-500" />
                            <span>Pendente de Verificação</span>
                          </>
                        )}
                      </span>
                    </div>

                    {/* Meta Fields Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-150 dark:border-slate-850 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <div>
                        <span className="text-[9px] block text-slate-400 uppercase font-bold">Fornecedor / Técnico</span>
                        <span className="text-slate-800 dark:text-slate-200 font-bold">{task.fornecedor}</span>
                      </div>
                      <div>
                        <span className="text-[9px] block text-slate-400 uppercase font-bold">Custos</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                          {typeof task.custo === "number" ? `${task.custo.toFixed(2)}€` : task.custo}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] block text-slate-400 uppercase font-bold">Data Conclusão</span>
                        <span>{task.dataConclusao}</span>
                      </div>
                      <div>
                        <span className="text-[9px] block text-slate-400 uppercase font-bold">Anexos / Documentos</span>
                        <span className="truncate block font-mono text-[10px] text-slate-700 dark:text-slate-300">
                          {task.anexos.join(", ") || "Dossier Geral"}
                        </span>
                      </div>
                    </div>

                    {/* Reports and Technical Feedback */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                      <div className="bg-slate-50 dark:bg-slate-950/55 p-3 rounded-xl border border-slate-100 dark:border-slate-850 space-y-1">
                        <strong className="text-[10px] uppercase text-slate-400 block font-bold">Relatório Técnico de Execução</strong>
                        <p className="text-slate-600 dark:text-slate-300 text-xs whitespace-pre-wrap">{task.relatorioTecnico}</p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-950/55 p-3 rounded-xl border border-slate-100 dark:border-slate-850 space-y-1">
                        <strong className="text-[10px] uppercase text-slate-400 block font-bold">Relatório & Homologação da Administração</strong>
                        <p className="text-slate-600 dark:text-slate-300 text-xs whitespace-pre-wrap">{task.relatorioAdmin}</p>
                      </div>
                    </div>

                    {/* Photos list if any */}
                    {task.fotos && task.fotos.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Fotografias & Evidências</span>
                        <div className="flex gap-2">
                          {task.fotos.map((f, idx) => (
                            <div key={idx} className="relative rounded overflow-hidden h-12 w-16 border bg-slate-100">
                              <img src={f.preview} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Verification Panel Trigger for Admins */}
                    {!task.validada && (activeProfile === "ADMIN" || activeProfile === "EMPRESA_GESTORA" || activeProfile === "PRESIDENTE") && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-850">
                        {selectedTaskToVerify === task.id ? (
                          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                            <h5 className="text-xs font-extrabold uppercase text-slate-500">Painel de Homologação da Tarefa #{task.id}</h5>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              <div>
                                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Custo Adjudicado Final (€)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={verifyCost}
                                  onChange={e => setVerifyCost(e.target.value)}
                                  placeholder={typeof task.custo === "number" ? task.custo.toString() : "120"}
                                  className="w-full border p-2 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Nome da Fatura a Anexar</label>
                                <input
                                  type="text"
                                  value={verifyAnexo}
                                  onChange={e => setVerifyAnexo(e.target.value)}
                                  placeholder="Fatura_Servico_Manutencao_Emitida.pdf"
                                  className="w-full border p-2 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Relatório da Administração</label>
                                <input
                                  type="text"
                                  value={verifyAdminReport}
                                  onChange={e => setVerifyAdminReport(e.target.value)}
                                  placeholder="Trabalho verificado e homologado em conformidade."
                                  className="w-full border p-2 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                                />
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleVerifyTaskAdmin(task.id, task.origem)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded text-xs cursor-pointer shadow flex items-center gap-1"
                              >
                                <Check className="h-4 w-4" />
                                <span>Verificar & Validar Contabilidade</span>
                              </button>
                              <button
                                onClick={() => setSelectedTaskToVerify(null)}
                                className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-1.5 px-4 rounded text-xs cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedTaskToVerify(task.id);
                              setVerifyCost(typeof task.custo === "number" ? task.custo.toString() : "");
                              setVerifyAdminReport("Trabalho verificado e homologado em conformidade pela administração.");
                              setVerifyAnexo(`Fatura_${task.origem}_${task.id}.pdf`);
                            }}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-2 px-4 rounded-xl text-xs cursor-pointer shadow flex items-center gap-1"
                          >
                            <CheckSquare className="h-4 w-4" />
                            <span>Verificar & Homologar Tarefa</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ----------------- 6. ARQUIVO DOCUMENTAL REGISTADO ----------------- */}
      {activeSubSection === "manutencao_arquivo" && (
        <div className="space-y-4 animate-fadeIn text-slate-800 dark:text-slate-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Arquivo Documental Registado</h3>
              <p className="text-xs text-slate-500">Repositório estruturado de orçamentos, faturas, relatórios de vistorias e documentos legais do condomínio.</p>
            </div>
            
            <div className="flex gap-2">
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="border p-2 rounded-xl text-xs bg-white dark:bg-slate-900"
              >
                <option value="2026">Exercício 2026</option>
                <option value="2027">Exercício 2027</option>
              </select>

              <select
                value={selectedTheme}
                onChange={e => setSelectedTheme(e.target.value)}
                className="border p-2 rounded-xl text-xs bg-white dark:bg-slate-900"
              >
                <option value="Todos">Todos os Temas</option>
                <option value="Manutenção">Manutenção</option>
                <option value="Custos Fixos">Custos Fixos</option>
                <option value="Intervenções Extraordinárias">Intervenções Extraordinárias</option>
                <option value="Seguros">Seguros</option>
                <option value="Serviços">Serviços</option>
                <option value="Obras">Obras</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Visual Folders Panel */}
            <div className="md:col-span-1 space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Estrutura de Pastas ({selectedYear})</span>
              <div className="space-y-1">
                {["Manutenção", "Custos Fixos", "Intervenções Extraordinárias", "Seguros", "Serviços", "Obras", "Assistências", "Orçamentos", "Relatórios", "Outros"].map(theme => (
                  <button
                    key={theme}
                    onClick={() => setSelectedTheme(theme)}
                    className={`w-full text-left p-2.5 text-xs font-bold rounded-lg flex items-center justify-between transition-all cursor-pointer ${
                      selectedTheme === theme 
                        ? "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-extrabold" 
                        : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-950"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <FolderArchive className="h-4 w-4 text-amber-500" />
                      <span className="truncate max-w-[130px]">{theme}</span>
                    </span>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-950 px-1.5 py-0.5 rounded shrink-0">
                      {documentos.filter(d => d.id_predio === predio.id_predio && d.categoria === theme).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Documents List */}
            <div className="md:col-span-3 space-y-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Documentos Encontrados</span>
              
              {documentos.filter(d => {
                const matchesPredio = d.id_predio === predio.id_predio;
                const matchesTheme = selectedTheme === "Todos" || d.categoria === selectedTheme;
                const matchesYear = !d.ano || d.ano === selectedYear;
                return matchesPredio && matchesTheme && matchesYear;
              }).length === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border text-center text-slate-400 text-xs">
                  Nenhum documento arquivado nesta pasta para o Exercício {selectedYear}.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {documentos.filter(d => {
                    const matchesPredio = d.id_predio === predio.id_predio;
                    const matchesTheme = selectedTheme === "Todos" || d.categoria === selectedTheme;
                    const matchesYear = !d.ano || d.ano === selectedYear;
                    return matchesPredio && matchesTheme && matchesYear;
                  }).map(d => {
                    // Build illustrative links based on document ID or static defaults to guarantee compliance
                    const origem = (d as any).origem || "Administração";
                    const movFinanceiro = (d as any).id_mov || `mov-${d.id_doc.split("-")[1] || "391"}`;
                    const relatorioMensal = (d as any).relatorio_id || `rel-mensal-${selectedYear}-${new Date(d.data_upload).getMonth() + 1}`;
                    const auditoriaId = `aud-${d.id_doc.split("-")[2] || "082"}`;
                    const anexoFicheiro = d.nome;

                    return (
                      <div 
                        key={d.id_doc} 
                        className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-slate-350 dark:hover:border-slate-750 transition-all space-y-3"
                      >
                        <div className="space-y-2 overflow-hidden">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <FileText className="h-5 w-5 text-red-500 shrink-0" />
                              <h5 className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{d.nome}</h5>
                            </div>
                            <span className="text-[8px] bg-slate-100 dark:bg-slate-950 px-1.5 rounded font-bold font-mono">ID: {d.id_doc}</span>
                          </div>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium line-clamp-2">{d.descricao || "Sem descrição registada..."}</p>

                          {/* Metadata fields requested */}
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-semibold pt-1 border-t border-dashed border-slate-100 dark:border-slate-850">
                            <div>Data: <span className="text-slate-600 dark:text-slate-300">{formatDatePT(d.data_upload)}</span></div>
                            <div>Categoria: <span className="text-slate-600 dark:text-slate-300">{d.categoria || "Outros"}</span></div>
                            <div>Origem: <span className="text-slate-600 dark:text-slate-300">{origem}</span></div>
                            <div>Anexo Principal: <span className="text-slate-600 dark:text-slate-300 truncate block font-mono">{anexoFicheiro}</span></div>
                            <div className="col-span-2 space-y-0.5">
                              <div className="flex justify-between">
                                <span>Mov. Financeiro:</span>
                                <span className="text-blue-500 font-mono hover:underline cursor-pointer">#{movFinanceiro}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Relatório Mensal:</span>
                                <span className="text-purple-500 font-mono hover:underline cursor-pointer">#{relatorioMensal}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Módulo Auditoria:</span>
                                <span className="text-emerald-500 font-mono hover:underline cursor-pointer">#{auditoriaId} (Auditado)</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-850">
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span>{d.tamanho}</span>
                            <span>•</span>
                            <span className="font-bold text-slate-500">{d.visibilidade || "Público"}</span>
                          </div>

                          <button
                            onClick={() => alert(`A descarregar ${d.nome} do servidor CondoManager AI...`)}
                            className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 border p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-800 cursor-pointer shadow-sm shrink-0"
                            title="Descarregar Documento"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
