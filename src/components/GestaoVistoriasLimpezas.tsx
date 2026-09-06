import React, { useState, useRef } from "react";
import { Predio, LoggedUser } from "../types";
import { formatDatePT, exportToXLS } from "../utils";

interface GestaoVistoriasLimpezasProps {
  predio: Predio;
  loggedUser: LoggedUser;
  activeSubSection?: string;
  initialTab?: "vistorias" | "limpezas" | "placa" | "custos";
}

export interface Vistoria {
  id_vistoria: string;
  id_predio: string;
  data: string;
  tecnico: string;
  local: string;
  anomalia: string;
  gravidade: "Baixa" | "Média" | "Alta";
  fotos: string[]; // Base64 data URLs
  estado: "Identificada" | "Em Resolução" | "Resolvida";
  custo_previsto?: number;
  periodicidade?: "Pontual" | "Mensal" | "Trimestral" | "Semestral" | "Anual" | "Bienal";
  impacto_orcamento?: "Baixo" | "Médio" | "Alto";
  alerta_automatico?: boolean;
}

export interface Limpeza {
  id_limpeza: string;
  id_predio: string;
  data: string; // DD-MM-AAAA
  hora: string; // HH:MM
  executor: string;
  areas: string[];
  observacoes: string;
  fotos?: string[];
}

export function GestaoVistoriasLimpezas({ predio, loggedUser, activeSubSection, initialTab }: GestaoVistoriasLimpezasProps) {
  // State for simulated active role inside this component
  const [activeProfile, setActiveProfile] = useState<"ADMIN" | "TECNICO" | "LIMPEZAS">("ADMIN");

  // Tabs
  const [activeTab, setActiveTab] = useState<"vistorias" | "limpezas" | "incidencias" | "placa" | "custos">("limpezas");

  // Sync with activeSubSection or initialTab
  React.useEffect(() => {
    if (activeSubSection === "limpezas_incidencias") {
      setActiveTab("incidencias");
    } else if (activeSubSection === "limpezas_vistorias" || activeSubSection === "vistorias") {
      setActiveTab("vistorias");
    } else if (activeSubSection === "vistorias_limpezas" || activeSubSection === "limpezas") {
      setActiveTab("limpezas");
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [activeSubSection, initialTab]);

  // Sync with global loggedUser role
  React.useEffect(() => {
    if (loggedUser.role === "TECNICO") {
      setActiveProfile("TECNICO");
      setActiveTab("vistorias");
    } else if (loggedUser.role === "LIMPEZAS") {
      setActiveProfile("LIMPEZAS");
      setActiveTab("limpezas");
    } else if (loggedUser.role === "ADMIN" || loggedUser.role === "EMPRESA_GESTORA") {
      setActiveProfile("ADMIN");
    }
  }, [loggedUser.role]);

  // Limpeza Cost and Forecasting states
  const [limpezaCustoMensal, setLimpezaCustoMensal] = useState("160");
  const [orcamentoGeralLimpeza, setOrcamentoGeralLimpeza] = useState("5000");
  const [taxaInflacaoPrevisao, setTaxaInflacaoPrevisao] = useState("4.2");

  // Incidências enviadas pela equipa de limpezas
  const [incidenciasLimpeza, setIncidenciasLimpeza] = useState([
    {
      id: "INC-101",
      data: new Date().toLocaleDateString("pt-PT"),
      hora: "09:30",
      operador: "Maria Silva (Limpezas Estrela Lda.)",
      local: "Hall de Entrada & Elevador de Serviço",
      descricao: "Lâmpada do hall principal a piscar e mancha de humidade detetada na parede junto às caixas de correio durante a lavagem.",
      gravidade: "Média",
      estado: "Pendente",
      foto: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80"
    },
    {
      id: "INC-102",
      data: new Date(Date.now() - 86400000 * 2).toLocaleDateString("pt-PT"),
      hora: "11:15",
      operador: "José Santos (Limpezas Estrela Lda.)",
      local: "Piso -1 (Acesso Garagens)",
      descricao: "Sacos de lixo acumulados indevidamente fora da lixeira comum e fecho da porta da casa da lixeira encravado.",
      gravidade: "Alta",
      estado: "Em Análise",
      foto: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=600&q=80"
    }
  ]);

  const [incLocal, setIncLocal] = useState("");
  const [incDescricao, setIncDescricao] = useState("");
  const [incGravidade, setIncGravidade] = useState<"Baixa" | "Média" | "Alta">("Média");
  const [incFotoUrl, setIncFotoUrl] = useState("");

  // Historical Mock Data (pre-populated)
  const [vistorias, setVistorias] = useState<Vistoria[]>([
    {
      id_vistoria: "vist-1",
      id_predio: "predio-1",
      data: "2026-07-10",
      tecnico: "Eng. Rui Melo (Inspetor Técnico)",
      local: "Garagem - Piso -1",
      anomalia: "Fissura estrutural de tração com ligeira infiltração de humidade ativa na junta de dilatação.",
      gravidade: "Alta",
      fotos: [
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='150' viewBox='0 0 200 150'><rect width='100%' height='100%' fill='%23fee2e2'/><text x='50%' y='50%' font-family='sans-serif' font-size='12' fill='%23991b1b' dominant-baseline='middle' text-anchor='middle'>Infiltração Junta Dilatação</text></svg>"
      ],
      estado: "Identificada",
      custo_previsto: 1450,
      periodicidade: "Bienal",
      impacto_orcamento: "Médio",
      alerta_automatico: true
    },
    {
      id_vistoria: "vist-2",
      id_predio: "predio-1",
      data: "2026-07-08",
      tecnico: "Eng. Rui Melo (Inspetor Técnico)",
      local: "Cobertura / Telhado",
      anomalia: "Obstrução de caleira de escoamento de águas pluviais por acumulação de folhagem e detritos.",
      gravidade: "Média",
      fotos: [
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='150' viewBox='0 0 200 150'><rect width='100%' height='100%' fill='%23fef3c7'/><text x='50%' y='50%' font-family='sans-serif' font-size='12' fill='%2392400e' dominant-baseline='middle' text-anchor='middle'>Caleira Obstruída</text></svg>"
      ],
      estado: "Em Resolução",
      custo_previsto: 380,
      periodicidade: "Semestral",
      impacto_orcamento: "Baixo",
      alerta_automatico: true
    },
    {
      id_vistoria: "vist-3",
      id_predio: "predio-1",
      data: "2026-06-15",
      tecnico: "António Costa (Técnico Elevadores)",
      local: "Cabine Elevador Principal",
      anomalia: "Lâmpada indicadora de piso fundida e ligeiro ruído de atrito no fecho mecânico de portas.",
      gravidade: "Baixa",
      fotos: [],
      estado: "Resolvida",
      custo_previsto: 45,
      periodicidade: "Pontual",
      impacto_orcamento: "Baixo",
      alerta_automatico: false
    }
  ]);

  const [limpezas, setLimpezas] = useState<Limpeza[]>([
    {
      id_limpeza: "limp-1",
      id_predio: "predio-1",
      data: "14-07-2026",
      hora: "08:30",
      executor: "Limpezas Estrela Lda. (Maria Silva)",
      areas: ["Átrio de Entrada", "Elevador", "Escadaria Central", "Corredores de Frações"],
      observacoes: "Higienização completa dos corrimãos com álcool, aspiração do átrio e desinfeção da cabine do elevador."
    },
    {
      id_limpeza: "limp-2",
      id_predio: "predio-1",
      data: "10-07-2026",
      hora: "14:00",
      executor: "Limpezas Estrela Lda. (Maria Silva)",
      areas: ["Átrio de Entrada", "Elevador", "Garagem - Entrada", "Contentores Lixo"],
      observacoes: "Lavagem do chão da garagem junto ao portão e lavagem profunda dos contentores de resíduos sólidos."
    },
    {
      id_limpeza: "limp-3",
      id_predio: "predio-1",
      data: "07-07-2026",
      hora: "09:00",
      executor: "Limpezas Estrela Lda. (Joana Ramos)",
      areas: ["Átrio de Entrada", "Elevador", "Escadaria Central"],
      observacoes: "Serviço semanal padrão concluído sem qualquer ocorrência reportada nas áreas comuns."
    }
  ]);

  // Vistorias Form State
  const [vData, setVData] = useState("");
  const [vTecnico, setVTecnico] = useState("");
  const [vLocal, setVLocal] = useState("");
  const [vAnomalia, setVAnomalia] = useState("");
  const [vGravidade, setVGravidade] = useState<"Baixa" | "Média" | "Alta">("Média");
  const [vCustoPrevisto, setVCustoPrevisto] = useState("");
  const [vPeriodicidade, setVPeriodicidade] = useState<"Pontual" | "Mensal" | "Trimestral" | "Semestral" | "Anual" | "Bienal">("Anual");
  const [vImpactoOrcamento, setVImpactoOrcamento] = useState<"Baixo" | "Médio" | "Alto">("Baixo");
  const [vAlertaAutomatico, setVAlertaAutomatico] = useState(true);
  const [vFotos, setVFotos] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Limpezas Form State
  const [lData, setLData] = useState(new Date().toLocaleDateString("pt-PT").replace(/\//g, "-"));
  const [lHora, setLHora] = useState("08:00");
  const [lExecutor, setLExecutor] = useState("");
  const [lAreas, setLAreas] = useState<string[]>([]);
  const [lObservacoes, setLObservacoes] = useState("");
  const [lFotos, setLFotos] = useState<string[]>([]);
  const lFileInputRef = useRef<HTMLInputElement>(null);

  const areasDisponiveis = [
    "Átrio de Entrada",
    "Elevador",
    "Escadaria Central",
    "Corredores de Frações",
    "Garagem",
    "Piscina / Logradouro",
    "Salão de Condomínio",
    "Jardins Externos",
    "Contentores Lixo"
  ];

  const currentBuildingVistorias = vistorias.filter(v => v.id_predio === predio.id_predio);
  const currentBuildingLimpezas = limpezas.filter(l => l.id_predio === predio.id_predio);

  // DRAG & DROP FOR PHOTOS
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      Array.from(e.dataTransfer.files).forEach((file: any) => {
        procesarFoto(file);
      });
    }
  };

  const fileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      Array.from(e.target.files).forEach((file: any) => {
        procesarFoto(file);
      });
    }
  };

  const procesarFoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (ctx) {
            // Cap at max width 800px to avoid memory waste
            const maxW = 800;
            let w = img.width;
            let h = img.height;
            if (w > maxW) {
              h = Math.round((h * maxW) / w);
              w = maxW;
            }
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);
            const webpUrl = canvas.toDataURL("image/webp", 0.8);
            setVFotos(prev => [...prev, webpUrl]);
          } else {
            setVFotos(prev => [...prev, event.target!.result as string]);
          }
        };
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  const removerFoto = (index: number) => {
    setVFotos(prev => prev.filter((_, i) => i !== index));
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const procesarFotoLimpeza = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const maxW = 800;
            let w = img.width;
            let h = img.height;
            if (w > maxW) {
              h = Math.round((h * maxW) / w);
              w = maxW;
            }
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);
            const webpUrl = canvas.toDataURL("image/webp", 0.8);
            setLFotos(prev => [...prev, webpUrl]);
          } else {
            setLFotos(prev => [...prev, event.target!.result as string]);
          }
        };
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  const removerFotoLimpeza = (index: number) => {
    setLFotos(prev => prev.filter((_, i) => i !== index));
  };

  const triggerLFileInput = () => {
    lFileInputRef.current?.click();
  };

  const lFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      Array.from(e.target.files).forEach((file: any) => {
        procesarFotoLimpeza(file);
      });
    }
  };

  // SUBMIT VISTORIA
  const handleSubmeterVistoria = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeProfile === "LIMPEZAS") {
      alert("Apenas Administradores ou Técnicos de Vistoria credenciados podem registar anomalias.");
      return;
    }
    if (!vData || !vTecnico || !vLocal || !vAnomalia) {
      alert("Por favor, preencha todos os campos obrigatórios (*).");
      return;
    }

    const novaVist: Vistoria = {
      id_vistoria: "vist-" + (vistorias.length + 1),
      id_predio: predio.id_predio,
      data: vData,
      tecnico: vTecnico,
      local: vLocal,
      anomalia: vAnomalia,
      gravidade: vGravidade,
      fotos: vFotos,
      estado: "Identificada",
      custo_previsto: vCustoPrevisto ? parseFloat(vCustoPrevisto) : undefined,
      periodicidade: vPeriodicidade,
      impacto_orcamento: vImpactoOrcamento,
      alerta_automatico: vAlertaAutomatico
    };

    setVistorias([novaVist, ...vistorias]);
    alert("Vistoria técnica registada com sucesso! Anomalia adicionada ao cadastro e alertas automáticos programados.");
    
    // Reset form
    setVData("");
    setVTecnico("");
    setVLocal("");
    setVAnomalia("");
    setVGravidade("Média");
    setVCustoPrevisto("");
    setVPeriodicidade("Anual");
    setVImpactoOrcamento("Baixo");
    setVAlertaAutomatico(true);
    setVFotos([]);
  };

  // SUBMIT LIMPEZA
  const handleSubmeterLimpeza = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeProfile === "TECNICO") {
      alert("Apenas Administradores ou Empresas de Limpezas autorizadas podem registar execuções de limpeza.");
      return;
    }
    if (!lData || !lHora || !lExecutor || lAreas.length === 0) {
      alert("Por favor, preencha a data, hora, nome do executor e selecione pelo menos uma área limpa (*).");
      return;
    }

    const obrigatorias = ["Átrio de Entrada", "Elevador", "Contentores Lixo"];
    const faltantes = obrigatorias.filter(a => !lAreas.includes(a));

    const novaLimp: Limpeza = {
      id_limpeza: "limp-" + (limpezas.length + 1),
      id_predio: predio.id_predio,
      data: lData,
      hora: lHora,
      executor: lExecutor,
      areas: lAreas,
      observacoes: lObservacoes,
      fotos: lFotos
    };

    setLimpezas([novaLimp, ...limpezas]);

    if (faltantes.length > 0) {
      // Trigger automatic non-compliance alert
      const novaInc = {
        id: "INC-AUTO-" + (incidenciasLimpeza.length + 100),
        data: lData,
        hora: lHora,
        operador: lExecutor,
        local: "Áreas Críticas (" + faltantes.join(", ") + ")",
        descricao: `⚠️ ALERTA AUTOMÁTICO DE INCUMPRIMENTO: O serviço de limpeza registado omitiu as seguintes áreas obrigatórias do condomínio: ${faltantes.join(", ")}.`,
        gravidade: "Alta" as const,
        estado: "Pendente" as const,
        foto: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80"
      };
      setIncidenciasLimpeza(prev => [novaInc, ...prev]);
      alert(`⚠️ Execução registada, MAS gerou um Alerta Automático de Incumprimento para o Gestor! Áreas obrigatórias não limpas: ${faltantes.join(", ")}`);
    } else {
      alert("✨ Execução de Limpeza registada com 100% de conformidade! Folha digital atualizada e fotos otimizadas em WebP.");
    }

    // Reset
    setLHora("08:00");
    setLExecutor("");
    setLAreas([]);
    setLObservacoes("");
    setLFotos([]);
  };

  const toggleAreaLimpeza = (area: string) => {
    setLAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  const alterarEstadoVistoria = (id: string, novoEstado: "Identificada" | "Em Resolução" | "Resolvida") => {
    setVistorias(vistorias.map(v => v.id_vistoria === id ? { ...v, estado: novoEstado } : v));
  };

  // EXPORT VISTORIAS TO XLS
  const exportarVistoriasXLS = () => {
    const headers = ["ID", "Data", "Técnico / Inspetor", "Compartimento / Local", "Anomalia Identificada", "Nível Gravidade", "Estado"];
    const rows = currentBuildingVistorias.map(v => [
      v.id_vistoria,
      formatDatePT(v.data),
      v.tecnico,
      v.local,
      v.anomalia,
      v.gravidade,
      v.estado
    ]);
    exportToXLS(`Relatorio_Vistorias_${predio.nome?.replace(/\s+/g, "_")}`, headers, rows);
  };

  // EXPORT LIMPEZAS TO XLS
  const exportarLimpezasXLS = () => {
    const headers = ["ID", "Data (DD-MM-AAAA)", "Hora (HH:MM)", "Empresa / Operador", "Áreas Higienizadas", "Observações do Serviço"];
    const rows = currentBuildingLimpezas.map(l => [
      l.id_limpeza,
      l.data,
      l.hora,
      l.executor,
      l.areas.join(", "),
      l.observacoes
    ]);
    exportToXLS(`Relatorio_Higienizacao_Limpezas_${predio.nome?.replace(/\s+/g, "_")}`, headers, rows);
  };

  // PRINT VISTORIAS PDF
  const imprimirVistoriasPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return alert("Por favor, permita pop-ups para imprimir.");

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório Geral de Vistorias e Anomalias</title>
          <style>
            body { font-family: sans-serif; color: #334155; padding: 40px; font-size: 12px; line-height: 1.5; }
            h2 { border-bottom: 2px solid #0f172a; padding-bottom: 8px; color: #0f172a; }
            .info-predio { margin-bottom: 20px; font-size: 11px; color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { background-color: #f8fafc; font-weight: bold; }
            .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
            .Alta { background-color: #fee2e2; color: #991b1b; }
            .Média { background-color: #fef3c7; color: #92400e; }
            .Baixa { background-color: #dbeafe; color: #1e40af; }
          </style>
        </head>
        <body>
          <h2>RELATÓRIO GERAL DE VISTORIAS E DETEÇÃO DE ANOMALIAS</h2>
          <div class="info-predio">
            <strong>Edifício:</strong> ${predio?.nome || "Condomínio"}<br/>
            <strong>Morada:</strong> ${predio?.morada_linha1 || ""}, ${predio?.num_porta || ""} - ${predio?.localidade || ""}<br/>
            <strong>Data de Emissão:</strong> ${new Date().toLocaleDateString("pt-PT")}
          </div>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Técnico</th>
                <th>Local</th>
                <th>Anomalia</th>
                <th>Gravidade</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${currentBuildingVistorias.map(v => `
                <tr>
                  <td>${formatDatePT(v.data)}</td>
                  <td>${v.tecnico}</td>
                  <td>${v.local}</td>
                  <td>${v.anomalia}</td>
                  <td><span class="badge ${v.gravidade}">${v.gravidade}</span></td>
                  <td><strong>${v.estado}</strong></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // PRINT LIMPEZAS PDF
  const imprimirLimpezasPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return alert("Por favor, permita pop-ups para imprimir.");

    printWindow.document.write(`
      <html>
        <head>
          <title>Livro de Registos de Limpeza das Áreas Comuns</title>
          <style>
            body { font-family: sans-serif; color: #334155; padding: 40px; font-size: 12px; line-height: 1.5; }
            h2 { border-bottom: 2px solid #0f172a; padding-bottom: 8px; color: #0f172a; }
            .info-predio { margin-bottom: 20px; font-size: 11px; color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { background-color: #f8fafc; font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>LIVRO DE REGISTO DIGITAL DE HIGIENIZAÇÕES E LIMPEZAS</h2>
          <div class="info-predio">
            <strong>Edifício:</strong> ${predio?.nome || "Condomínio"}<br/>
            <strong>Morada:</strong> ${predio?.morada_linha1 || ""}, ${predio?.num_porta || ""} - ${predio?.localidade || ""}<br/>
            <strong>Registo de Auditoria PWA - Emitido em:</strong> ${new Date().toLocaleDateString("pt-PT")}
          </div>
          <table>
            <thead>
              <tr>
                <th>Data de Execução</th>
                <th>Hora</th>
                <th>Operador / Responsável</th>
                <th>Áreas Higienizadas</th>
                <th>Observações e Notas</th>
              </tr>
            </thead>
            <tbody>
              ${currentBuildingLimpezas.map(l => `
                <tr>
                  <td>${l.data}</td>
                  <td>${l.hora}</td>
                  <td>${l.executor}</td>
                  <td>${l.areas.join(", ")}</td>
                  <td>${l.observacoes || "Sem ocorrências"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* SIMULATED ROLE SWITCHER CARD */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 no-print">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 border border-emerald-500/35">
            <i className="fa-solid fa-users-gear text-lg animate-pulse"></i>
          </div>
          <div>
            <h3 className="text-sm font-bold">Consola de Perfis e Acreditações PWA</h3>
            <p className="text-[11px] text-slate-400">Simule o acesso de agentes externos de manutenção e limpeza para testar as permissões.</p>
          </div>
        </div>
        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => { setActiveProfile("ADMIN"); if (activeTab === "vistorias") {} }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeProfile === "ADMIN" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
          >
            <i className="fa-solid fa-user-shield mr-1.5"></i>Administrador
          </button>
          <button
            onClick={() => { setActiveProfile("TECNICO"); setActiveTab("vistorias"); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeProfile === "TECNICO" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
          >
            <i className="fa-solid fa-helmet-safety mr-1.5"></i>Técnico Vistorias
          </button>
          <button
            onClick={() => { setActiveProfile("LIMPEZAS"); setActiveTab("limpezas"); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeProfile === "LIMPEZAS" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
          >
            <i className="fa-solid fa-broom-ball mr-1.5"></i>Empresa Limpezas
          </button>
        </div>
      </div>

      {/* REMOVED TOP TABS IN FAVOR OF CENTRAL EXPANDABLE MENU */}

      {/* TAB CONTENT: VISTORIAS */}
      {activeTab === "vistorias" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Planificação Anual de Vistorias Técnicas por IA */}
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <span className="p-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg text-xs">
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                  </span>
                  <span>Planificação Anual de Vistorias Técnicas</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Plano automatizado ajustado à tipologia do condomínio ({predio.nome}): Elevadores, SCIE, Garagem, Bombas de Águas, Cobertura, Coluna Elétrica e Gás.
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => alert(`📋 Planificação Anual de Vistorias de 2026 para ${predio.nome} exportada em PDF!`)}
                  title="Exportar PDF"
                  className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-xs"
                >
                  <img src="/modulos/80-pdf-de-resultados.png" alt="PDF" className="h-6 w-6 object-contain" onError={(e) => { e.currentTarget.src = "/modulos/25-relatorio.png"; }} />
                </button>
              </div>
            </div>

            {/* AI Technical Inspection Matrix Table */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <th className="p-3">Equipamento / Sistema</th>
                    <th className="p-3">Legislação / Norma</th>
                    <th className="p-3 text-center">Periodicidade</th>
                    <th className="p-3 text-center">Meses Previstos 2026</th>
                    <th className="p-3">Entidade Reguladora</th>
                    <th className="p-3 text-center">Estado do Agendamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                      Elevadores (Ascensores & Plataformas)
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[11px]">DL nº 320/2002 (EMIE)</td>
                    <td className="p-3 text-center font-bold text-blue-600">Mensal / Anual</td>
                    <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-400">Jan, Mar, Mai, Jul, Set, Nov</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">Empresa de Manutenção de Elevadores (EMIE)</td>
                    <td className="p-3 text-center">
                      <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">✓ Agendado</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                      SCIE (Extintores, Carretéis & Iluminação Emergência)
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[11px]">DL nº 220/2008 (ANPC)</td>
                    <td className="p-3 text-center font-bold text-blue-600">Semestral</td>
                    <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-400">Março & Setembro</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">Técnico Certificado ANPC</td>
                    <td className="p-3 text-center">
                      <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">✓ Agendado</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                      Instalação de Gás Natural & Coluna Montante
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[11px]">Lei nº 63/2018 (Inspect.)</td>
                    <td className="p-3 text-center font-bold text-blue-600">Bienal (5 em 5 anos)</td>
                    <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-400">Maio 2026</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">Entidade Inspetora de Gás (EIG)</td>
                    <td className="p-3 text-center">
                      <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-bold">Pendente Inspeção</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                      Grupo Bordo de Bombas de Águas e Sobpressão
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[11px]">Norma Técnica Hidráulica</td>
                    <td className="p-3 text-center font-bold text-blue-600">Trimestral</td>
                    <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-400">Fev, Mai, Ago, Nov</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">Empresa de Eletromecânica</td>
                    <td className="p-3 text-center">
                      <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">✓ Agendado</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                      Inspeção de Cobertura, Telhado & Algerozes
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[11px]">Manutenção Preventiva</td>
                    <td className="p-3 text-center font-bold text-blue-600">Semestral (Pré-Inverno)</td>
                    <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-400">Abril & Outubro</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">Equipa Técnica Interna / Alpinista do Edifício</td>
                    <td className="p-3 text-center">
                      <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">✓ Agendado</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form to report Vistoria (Visible to Admin or Técnico) */}
          <div className="lg:col-span-1 space-y-4 no-print">
            {activeProfile === "LIMPEZAS" ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs space-y-2">
                <p className="font-bold"><i className="fa-solid fa-lock mr-1.5"></i>Formulário Bloqueado</p>
                <p>O perfil de "Empresa de Limpezas" não dispõe de habilitação regulamentar para registar relatórios de vistorias técnicas e identificar anomalias estruturais.</p>
                <p className="font-semibold text-amber-700">Alterne para "Administrador" ou "Técnico Vistorias" acima para registar.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmeterVistoria} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800">Lançar Relatório de Vistoria</h3>
                
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Data da Vistoria *</label>
                  <input
                    type="date"
                    required
                    value={vData}
                    onChange={e => setVData(e.target.value)}
                    className="border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-blue-500 bg-slate-50/50"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Técnico / Inspetor Responsável *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Eng. Rui Melo (Inspetor)"
                    value={vTecnico}
                    onChange={e => setVTecnico(e.target.value)}
                    className="border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-blue-500 bg-slate-50/50"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Compartimento / Local *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Garagem Piso -1 ou Escadas"
                    value={vLocal}
                    onChange={e => setVLocal(e.target.value)}
                    className="border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-blue-500 bg-slate-50/50"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Descrição Detalhada da Anomalia *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Especifique o problema mecânico, elétrico ou estrutural verificado no local..."
                    value={vAnomalia}
                    onChange={e => setVAnomalia(e.target.value)}
                    className="border border-slate-200 p-3 text-xs rounded-lg focus:outline-blue-500 bg-slate-50/50"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Classificação de Gravidade *</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {(["Baixa", "Média", "Alta"] as const).map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setVGravidade(g)}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          vGravidade === g
                            ? g === "Alta"
                              ? "bg-red-500 text-white border-red-500 shadow-sm"
                              : g === "Média"
                              ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                              : "bg-blue-500 text-white border-blue-500 shadow-sm"
                            : "bg-slate-50 text-slate-500 hover:bg-slate-100 border-slate-200"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custo, Periodicidade, Impacto e Alertas */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Custo Previsto (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 250"
                      value={vCustoPrevisto}
                      onChange={e => setVCustoPrevisto(e.target.value)}
                      className="border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-blue-500 bg-slate-50/50 font-mono"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Periodicidade</label>
                    <select
                      value={vPeriodicidade}
                      onChange={e => setVPeriodicidade(e.target.value as any)}
                      className="border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-blue-500 bg-slate-50/50 cursor-pointer"
                    >
                      <option value="Pontual">Pontual</option>
                      <option value="Mensal">Mensal</option>
                      <option value="Trimestral">Trimestral</option>
                      <option value="Semestral">Semestral</option>
                      <option value="Anual">Anual</option>
                      <option value="Bienal">Bienal</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Impacto Orçamental</label>
                    <select
                      value={vImpactoOrcamento}
                      onChange={e => setVImpactoOrcamento(e.target.value as any)}
                      className="border border-slate-200 px-2.5 py-1.5 text-[11px] rounded-lg focus:outline-blue-500 bg-white cursor-pointer"
                    >
                      <option value="Baixo">Baixo (Até 500€)</option>
                      <option value="Médio">Médio (500€-2000€)</option>
                      <option value="Alto">Alto (+2000€)</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-center items-start pl-2">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={vAlertaAutomatico}
                        onChange={e => setVAlertaAutomatico(e.target.checked)}
                        className="mr-2 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                      />
                      <span>Notificar Alerta</span>
                    </label>
                    <span className="text-[8px] text-slate-450 block mt-1">Alerta email/PWA a cada ciclo</span>
                  </div>
                </div>

                {/* FILE UPLOAD COMPONENT FOR PHOTOGRAPHS */}
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Evidências Fotográficas (Auto-WebP)</label>
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={triggerFileInput}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-1 ${
                      dragActive ? "border-blue-500 bg-blue-50/50" : "border-slate-200 hover:border-blue-400 hover:bg-slate-50/50"
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={fileSelected}
                      multiple
                      accept="image/*"
                      className="hidden"
                    />
                    <div className="text-slate-400 text-lg"><i className="fa-solid fa-cloud-arrow-up"></i></div>
                    <span className="text-[10px] font-bold text-slate-600">Arraste ou clique para carregar imagens</span>
                    <span className="text-[9px] text-slate-400">Compresão e conversão WebP ativa na PWA</span>
                  </div>

                  {/* Thumbnail gallery preview */}
                  {vFotos.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mt-3 p-2 bg-slate-50 rounded-xl border border-slate-150">
                      {vFotos.map((img, i) => (
                        <div key={i} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-square bg-white">
                          <img src={img} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removerFoto(i)}
                            className="absolute top-0.5 right-0.5 bg-red-600 text-white text-[9px] h-4 w-4 rounded-full flex items-center justify-center opacity-90 hover:bg-red-700"
                          >
                            <i className="fa-solid fa-times"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                >
                  <i className="fa-solid fa-check mr-2"></i>Registar Vistoria e Alertas
                </button>
              </form>
            )}
          </div>

          {/* Vistorias List & Records (Visible to everyone) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center no-print">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Registo de Anomalias Ativas</h4>
              <div className="flex space-x-2">
                <button
                  onClick={exportarVistoriasXLS}
                  title="Exportar Excel"
                  className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-xs"
                >
                  <img src="/modulos/66-exportacao-financeira.png" alt="Excel" className="h-6 w-6 object-contain" onError={(e) => { e.currentTarget.src = "/modulos/26-exportacao.png"; }} />
                </button>
                <button
                  onClick={imprimirVistoriasPDF}
                  title="Exportar PDF"
                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-xs"
                >
                  <img src="/marca/18-pdf.png" alt="PDF" className="h-6 w-6 object-contain" onError={(e) => { e.currentTarget.src = "/modulos/80-pdf-de-resultados.png"; }} />
                </button>
              </div>
            </div>

            {currentBuildingVistorias.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                Nenhuma anomalia identificada no condomínio de momento.
              </div>
            ) : (
              <div className="space-y-4">
                {currentBuildingVistorias.map(v => (
                  <div key={v.id_vistoria} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex flex-wrap justify-between items-start gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full border ${
                            v.gravidade === "Alta"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : v.gravidade === "Média"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}>
                            Gravidade: {v.gravidade}
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-mono">
                            ID: {v.id_vistoria}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 mt-1.5 flex items-center">
                          <i className="fa-solid fa-location-crosshairs text-slate-400 mr-2 text-xs"></i>
                          {v.local}
                        </h4>
                      </div>

                      <div className="flex items-center space-x-2 no-print">
                        <select
                          value={v.estado}
                          disabled={activeProfile === "LIMPEZAS"}
                          onChange={e => alterarEstadoVistoria(v.id_vistoria, e.target.value as any)}
                          className={`text-xs font-bold rounded-lg border px-2 py-1 focus:outline-none cursor-pointer ${
                            v.estado === "Resolvida"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : v.estado === "Em Resolução"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          <option value="Identificada">Identificada</option>
                          <option value="Em Resolução">Em Resolução</option>
                          <option value="Resolvida">✓ Resolvida</option>
                        </select>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed font-medium">{v.anomalia}</p>

                    {/* Parâmetros Backoffice da Inspeção */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-150 text-[11px] font-medium text-slate-600">
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Custo Previsto</span>
                        <span className="font-mono text-slate-800 font-bold">{v.custo_previsto !== undefined ? `${v.custo_previsto.toFixed(2)}€` : "—"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Periodicidade</span>
                        <span className="text-slate-800 font-semibold">{v.periodicidade || "Pontual"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Impacto Orçamental</span>
                        <span className={`font-semibold ${
                          v.impacto_orcamento === "Alto" ? "text-red-600 font-black" : v.impacto_orcamento === "Médio" ? "text-amber-600" : "text-emerald-600"
                        }`}>{v.impacto_orcamento || "Baixo"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Notificação Ciclo</span>
                        <span className="flex items-center text-slate-800 font-semibold">
                          {v.alerta_automatico ? (
                            <>
                              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full mr-1 animate-pulse"></span>
                              <i className="fa-solid fa-bell text-blue-500 mr-1"></i> Ativo
                            </>
                          ) : (
                            <>
                              <span className="h-1.5 w-1.5 bg-slate-300 rounded-full mr-1"></span>
                              Inativo
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {v.fotos.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Evidências Fotográficas</span>
                        <div className="flex space-x-2 overflow-x-auto py-1">
                          {v.fotos.map((img, index) => (
                            <div key={index} className="h-16 w-24 rounded-lg overflow-hidden border border-slate-200 shrink-0 shadow-sm">
                              <img src={img} alt="Evidência" className="h-full w-full object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 pt-2 border-t border-slate-50">
                      <span className="flex items-center"><i className="fa-solid fa-calendar mr-1.5"></i>Registado: {formatDatePT(v.data)}</span>
                      <span className="flex items-center"><i className="fa-solid fa-user-check mr-1.5"></i>Vistoriador: {v.tecnico}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* TAB CONTENT: LIMPEZAS */}
      {activeTab === "limpezas" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Form to report Limpeza (Visible to Admin or Empresa de Limpezas) */}
          <div className="lg:col-span-1 space-y-4 no-print">
            {activeProfile === "TECNICO" ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs space-y-2">
                <p className="font-bold"><i className="fa-solid fa-lock mr-1.5"></i>Formulário Bloqueado</p>
                <p>O perfil de "Técnico de Vistorias" não dispõe de habilitação para registar execuções de higienização e limpezas das áreas comuns.</p>
                <p className="font-semibold text-amber-700">Alterne para "Administrador" ou "Empresa Limpezas" acima para registar.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmeterLimpeza} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800">Registo de Higienização Comum</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Data (DD-MM-AAAA) *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 14-07-2026"
                      value={lData}
                      onChange={e => setLData(e.target.value)}
                      className="border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-indigo-500 bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Hora (HH:MM) *</label>
                    <input
                      type="time"
                      required
                      value={lHora}
                      onChange={e => setLHora(e.target.value)}
                      className="border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-indigo-500 bg-slate-50/50"
                    />
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Nome do Operador / Executor *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Limpezas Estrela Lda. (Maria)"
                    value={lExecutor}
                    onChange={e => setLExecutor(e.target.value)}
                    className="border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-indigo-500 bg-slate-50/50"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Áreas Intervencionadas *</label>
                  <div className="grid grid-cols-2 gap-2 mt-1 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-150">
                    {areasDisponiveis.map(area => {
                      const isSelected = lAreas.includes(area);
                      return (
                        <button
                          key={area}
                          type="button"
                          onClick={() => toggleAreaLimpeza(area)}
                          className={`px-2 py-1 text-[10px] font-semibold rounded-lg text-left border transition-all flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? "bg-indigo-50 text-indigo-700 border-indigo-400 font-bold"
                              : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <span className="truncate">{area}</span>
                          {isSelected && <i className="fa-solid fa-check text-[8px] text-indigo-600"></i>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Observações do Serviço</label>
                  <textarea
                    rows={2}
                    placeholder="Líquidos utilizados, estado dos contentores de lixo, ou recados especiais para a Administração..."
                    value={lObservacoes}
                    onChange={e => setLObservacoes(e.target.value)}
                    className="border border-slate-200 p-2.5 text-xs rounded-lg focus:outline-indigo-500 bg-slate-50/50"
                  />
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Evidências Fotográficas (WebP Auto-Compress)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => lFileInputRef.current?.click()}
                      className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-[10px] font-bold py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <i className="fa-solid fa-image"></i>
                      Galeria / Ficheiro
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cameraInput = document.createElement("input");
                        cameraInput.type = "file";
                        cameraInput.accept = "image/*";
                        cameraInput.capture = "environment";
                        cameraInput.onchange = (e: any) => {
                          if (e.target.files && e.target.files[0]) {
                            procesarFotoLimpeza(e.target.files[0]);
                          }
                        };
                        cameraInput.click();
                      }}
                      className="bg-indigo-50 hover:bg-indigo-105 border border-indigo-200 text-indigo-700 text-[10px] font-bold py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <i className="fa-solid fa-camera"></i>
                      Câmara Direta
                    </button>
                  </div>
                  <input
                    type="file"
                    ref={lFileInputRef}
                    onChange={lFileSelected}
                    multiple
                    accept="image/*"
                    className="hidden"
                  />

                  {/* Limpeza photos preview */}
                  {lFotos.length > 0 && (
                    <div className="grid grid-cols-4 gap-1.5 p-1.5 bg-slate-50 rounded-xl border border-slate-150">
                      {lFotos.map((img, i) => (
                        <div key={i} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-square bg-white">
                          <img src={img} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removerFotoLimpeza(i)}
                            className="absolute top-0.5 right-0.5 bg-red-600 text-white text-[8px] h-3.5 w-3.5 rounded-full flex items-center justify-center opacity-90 hover:bg-red-700"
                          >
                            <i className="fa-solid fa-times text-[7px]"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                >
                  <i className="fa-solid fa-broom-ball mr-2"></i>Publicar Registo Digital
                </button>
              </form>
            )}
          </div>

          {/* Historical Logs & Table (Visible to everyone) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center no-print">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-sans">Caderno de Higienizações Digital</h4>
              <div className="flex space-x-2">
                <button
                  onClick={exportarLimpezasXLS}
                  title="Exportar Excel"
                  className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-xs"
                >
                  <img src="/modulos/66-exportacao-financeira.png" alt="Excel" className="h-6 w-6 object-contain" onError={(e) => { e.currentTarget.src = "/modulos/26-exportacao.png"; }} />
                </button>
                <button
                  onClick={imprimirLimpezasPDF}
                  title="Exportar PDF"
                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-xs"
                >
                  <img src="/marca/18-pdf.png" alt="PDF" className="h-6 w-6 object-contain" onError={(e) => { e.currentTarget.src = "/modulos/80-pdf-de-resultados.png"; }} />
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th className="p-3">Data e Hora</th>
                    <th className="p-3">Empresa / Executor</th>
                    <th className="p-3">Áreas Higienizadas</th>
                    <th className="p-3">Observações / Recados</th>
                  </tr>
                </thead>
                <tbody>
                  {currentBuildingLimpezas.map(l => (
                    <tr key={l.id_limpeza} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{l.data}</div>
                        <div className="text-[10px] text-slate-400 font-medium font-mono-custom flex items-center"><i className="fa-solid fa-clock mr-1"></i>{l.hora}</div>
                      </td>
                      <td className="p-3 font-semibold text-slate-700">{l.executor}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {l.areas.map(area => (
                            <span key={area} className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold border border-indigo-100">
                              {area}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-slate-500 text-[11px] leading-relaxed italic">{l.observacoes || "Serviço padrão realizado com sucesso."}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: INCIDÊNCIAS ENVIADAS PELAS LIMPEZAS */}
      {activeTab === "incidencias" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & New Incident Form */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-amber-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-2 border-b border-amber-100 pb-3">
                <span className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <i className="fa-solid fa-circle-exclamation text-base"></i>
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-800">Registar Nova Incidência</h3>
                  <p className="text-[11px] text-slate-500">Reporte anomalias detetadas durante o serviço de limpeza</p>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!incLocal || !incDescricao) {
                    alert("Preencha o local e a descrição da incidência!");
                    return;
                  }
                  const nova: any = {
                    id: `INC-${100 + incidenciasLimpeza.length + 1}`,
                    data: new Date().toLocaleDateString("pt-PT"),
                    hora: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
                    operador: loggedUser.nome || "Equipa de Limpezas",
                    local: incLocal,
                    descricao: incDescricao,
                    gravidade: incGravidade,
                    estado: "Pendente",
                    foto: incFotoUrl || "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80"
                  };
                  setIncidenciasLimpeza([nova, ...incidenciasLimpeza]);
                  setIncLocal("");
                  setIncDescricao("");
                  setIncFotoUrl("");
                  alert("Incidência registada e enviada para a Administração!");
                }}
                className="space-y-3"
              >
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 block mb-1">Local / Compartimento *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Hall do Piso 3, Escadas Garagem -1..."
                    value={incLocal}
                    onChange={(e) => setIncLocal(e.target.value)}
                    className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-amber-500 bg-slate-50/50 font-medium"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 block mb-1">Nível de Gravidade</label>
                  <select
                    value={incGravidade}
                    onChange={(e) => setIncGravidade(e.target.value as any)}
                    className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-amber-500 bg-white font-bold text-slate-700 cursor-pointer"
                  >
                    <option value="Baixa">🟢 Baixa (Manchas leves, sujidade atípica)</option>
                    <option value="Média">🟡 Média (Lâmpada fundida, fecho estragado)</option>
                    <option value="Alta">🔴 Alta (Infiltração ativa, porta arrombada/lixo ilegal)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 block mb-1">Descrição Detalhada *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Descreva a anomalia ou problema verificado..."
                    value={incDescricao}
                    onChange={(e) => setIncDescricao(e.target.value)}
                    className="w-full border border-slate-200 p-3 text-xs rounded-xl focus:outline-amber-500 bg-slate-50/50 font-medium"
                  ></textarea>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 block mb-1">URL da Fotografia / Evidência (Opcional)</label>
                  <input
                    type="url"
                    placeholder="https://exemplo.com/foto.jpg"
                    value={incFotoUrl}
                    onChange={(e) => setIncFotoUrl(e.target.value)}
                    className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-amber-500 bg-slate-50/50 font-medium"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs transition-colors shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-paper-plane"></i>
                  <span>Enviar Incidência à Administração</span>
                </button>
              </form>
            </div>

            {/* List of Incidências */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <i className="fa-solid fa-list-check text-amber-500"></i>
                  <span>Histórico de Incidências Enviadas pelas Limpezas ({incidenciasLimpeza.length})</span>
                </h4>
              </div>

              {incidenciasLimpeza.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                  Sem incidências reportadas pela equipa de limpezas até ao momento.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {incidenciasLimpeza.map((inc) => (
                    <div key={inc.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-amber-300 transition-all space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                            inc.gravidade === "Alta" ? "bg-red-50 text-red-700 border-red-200" :
                            inc.gravidade === "Média" ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-blue-50 text-blue-700 border-blue-200"
                          }`}>
                            Gravidade: {inc.gravidade}
                          </span>
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
                            {inc.id}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={inc.estado}
                            onChange={(e) => {
                              const nov = e.target.value;
                              setIncidenciasLimpeza(prev => prev.map(item => item.id === inc.id ? { ...item, estado: nov as any } : item));
                            }}
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg border cursor-pointer ${
                              inc.estado === "Resolvida" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              inc.estado === "Em Análise" ? "bg-blue-50 text-blue-700 border-blue-200" :
                              "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            <option value="Pendente">Pendente</option>
                            <option value="Em Análise">Em Análise</option>
                            <option value="Resolvida">✓ Resolvida</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                          <i className="fa-solid fa-location-dot text-amber-500"></i>
                          {inc.local}
                        </h4>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{inc.descricao}</p>
                      </div>

                      {inc.foto && (
                        <div className="pt-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Fotografia da Evidência</span>
                          <img src={inc.foto} alt="Evidência" className="h-28 w-48 object-cover rounded-xl border border-slate-200 shadow-sm" />
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-50 font-medium">
                        <span>Reportado por: <strong className="text-slate-700">{inc.operador}</strong></span>
                        <span>{inc.data} às {inc.hora}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: VIRTUAL TABLOID LOBBY TABLET */}
      {activeTab === "placa" && (
        <div className="flex flex-col items-center justify-center py-6 animate-fadeIn">
          {/* Tablet Display Container */}
          <div className="w-full max-w-2xl bg-white rounded-3xl border-8 border-slate-800 shadow-2xl overflow-hidden relative">
            {/* Front Camera Dot */}
            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-slate-900 z-10"></div>
            
            {/* Tablet Content */}
            <div className="bg-slate-950 text-slate-100 p-6 min-h-[500px] flex flex-col justify-between font-sans">
              
              {/* Tablet Header */}
              <div className="border-b border-slate-800 pb-4 flex justify-between items-start">
                <div>
                  <span className="bg-emerald-500 text-slate-950 font-extrabold text-[9px] uppercase px-2 py-0.5 rounded-full font-sans tracking-wider">
                    Placa de Limpeza Digital • CondoManager AI
                  </span>
                  <h3 className="text-lg font-extrabold text-white tracking-tight mt-1">{predio?.nome || "Edifício de Habitação"}</h3>
                  <p className="text-[10px] text-slate-400 font-medium">{predio?.morada_linha1 || ""}, {predio?.num_porta || ""} • {predio?.localidade || ""}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-white font-mono-custom">{new Date().toLocaleTimeString("pt-PT", {hour: "2-digit", minute:"2-digit"})}</div>
                  <div className="text-[9px] text-slate-400 font-semibold font-mono-custom">{new Date().toLocaleDateString("pt-PT")}</div>
                </div>
              </div>

              {/* Tablet Body: Current Digital Cleans (Substituting the wall paper sheet) */}
              <div className="my-6 flex-grow space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Últimas Execuções de Higienização</h4>
                  <span className="text-[9px] text-emerald-400 font-bold flex items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                    Tablet Online & Auditável
                  </span>
                </div>

                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {currentBuildingLimpezas.slice(0, 4).map((l, i) => (
                    <div key={l.id_limpeza} className="bg-slate-900 border border-slate-800/80 p-3.5 rounded-xl flex justify-between items-start">
                      <div className="space-y-1.5 flex-grow pr-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-black text-white">{l.executor}</span>
                          <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 px-1.5 py-0.5 rounded font-extrabold">
                            Executada com Sucesso
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {l.areas.map(a => (
                            <span key={a} className="text-[8px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-semibold">
                              {a}
                            </span>
                          ))}
                        </div>
                        {l.observacoes && (
                          <p className="text-[10px] text-slate-400 italic font-medium leading-relaxed">
                            "{l.observacoes}"
                          </p>
                        )}
                      </div>
                      
                      <div className="text-right shrink-0 border-l border-slate-800 pl-3">
                        <p className="text-xs font-black text-emerald-400">{l.data}</p>
                        <p className="text-[10px] text-slate-500 font-mono-custom mt-0.5">{l.hora} H</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tablet Footer: QR Code and instructions */}
              <div className="border-t border-slate-800 pt-4 flex justify-between items-center bg-slate-950">
                <div className="flex items-center space-x-3">
                  {/* Digital QR Code Placeholder styled with extreme polish */}
                  <div className="h-14 w-14 bg-white p-1 rounded-lg shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900 fill-current">
                      <rect x="0" y="0" width="25" height="25" />
                      <rect x="5" y="5" width="15" height="15" fill="white" />
                      <rect x="75" y="0" width="25" height="25" />
                      <rect x="80" y="5" width="15" height="15" fill="white" />
                      <rect x="0" y="75" width="25" height="25" />
                      <rect x="5" y="80" width="15" height="15" fill="white" />
                      {/* Random QR noise */}
                      <rect x="35" y="10" width="10" height="10" />
                      <rect x="50" y="20" width="10" height="15" />
                      <rect x="30" y="45" width="15" height="10" />
                      <rect x="55" y="45" width="10" height="20" />
                      <rect x="40" y="75" width="15" height="15" />
                      <rect x="65" y="75" width="5" height="10" />
                      <rect x="85" y="40" width="10" height="10" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="text-[11px] font-black text-white">Quadro de Avisos Sem Papel</h5>
                    <p className="text-[9px] text-slate-400 leading-relaxed max-w-xs">
                      Este painel digital de condomínio substitui os antigos papéis afixados na entrada do prédio. Aponte a câmara do telemóvel para auditar todo o histórico e reportar falhas.
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[8px] uppercase font-bold text-slate-600 block">Certificado por</span>
                  <span className="text-[10px] font-black text-emerald-400">CondoManager AI PWA</span>
                </div>
              </div>

            </div>
          </div>
          
          <p className="text-xs text-slate-400 mt-4 font-medium flex items-center max-w-lg text-center">
            <i className="fa-solid fa-circle-info text-slate-400 mr-2"></i>
            Esta visualização simula de forma fidedigna o e-screen de 10 polegadas afixado no átrio de entrada do edifício. Os dados são sincronizados sem fios em tempo real com o servidor.
          </p>
        </div>
      )}

      {/* TAB CONTENT: CUSTOS DE LIMPEZA */}
      {activeTab === "custos" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-fadeIn">
          <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3">
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <i className="fa-solid fa-hand-holding-hand text-sm"></i>
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Análise Financeira e Previsão de Custos de Limpeza</h3>
              <p className="text-xs text-slate-400">Controle o custo mensal e anual dos serviços de higienização, avalie o impacto no orçamento e faça previsões de aumentos automáticos.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Inputs Panel */}
            <div className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-2">Parâmetros Financeiros</h4>
              
              <div className="flex flex-col">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Custo Mensal da Limpeza (€) *</label>
                <input 
                  type="number"
                  step="0.01"
                  value={limpezaCustoMensal}
                  onChange={e => setLimpezaCustoMensal(e.target.value)}
                  className="border border-slate-200 bg-white px-3 py-2 text-xs rounded-lg font-mono focus:outline-amber-500"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Orçamento de Referência do Condomínio (€) *</label>
                <input 
                  type="number"
                  value={orcamentoGeralLimpeza}
                  onChange={e => setOrcamentoGeralLimpeza(e.target.value)}
                  className="border border-slate-200 bg-white px-3 py-2 text-xs rounded-lg font-mono focus:outline-amber-500"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Previsão de Aumento Anual / Inflação (%) *</label>
                <input 
                  type="number"
                  step="0.1"
                  value={taxaInflacaoPrevisao}
                  onChange={e => setTaxaInflacaoPrevisao(e.target.value)}
                  className="border border-slate-200 bg-white px-3 py-2 text-xs rounded-lg font-mono focus:outline-amber-500"
                />
              </div>
            </div>

            {/* Calculations & Impact Cards */}
            <div className="grid grid-cols-1 gap-4 md:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-150 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-[9px] font-bold uppercase block">Custo Mensal Padrão</span>
                    <h3 className="text-lg font-black text-slate-800 font-mono mt-0.5">{(Number(limpezaCustoMensal) || 0).toFixed(2)}€</h3>
                  </div>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs"><i className="fa-solid fa-calendar-day"></i></div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-150 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-[9px] font-bold uppercase block">Custo Anual Total</span>
                    <h3 className="text-lg font-black text-slate-800 font-mono mt-0.5">{((Number(limpezaCustoMensal) || 0) * 12).toFixed(2)}€</h3>
                  </div>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs"><i className="fa-solid fa-coins"></i></div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-150 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-[9px] font-bold uppercase block">Impacto no Orçamento</span>
                    <h3 className="text-lg font-black text-slate-800 font-mono mt-0.5">
                      {(((Number(limpezaCustoMensal) || 0) * 12 / (Number(orcamentoGeralLimpeza) || 5000)) * 100).toFixed(1)}%
                    </h3>
                  </div>
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg text-xs"><i className="fa-solid fa-chart-pie"></i></div>
                </div>
              </div>

              {/* Progress representation bar */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Impacto Visual no Orçamento Geral do Prédio</span>
                  <div className="w-full bg-slate-200 rounded-full h-2.5 mt-2 overflow-hidden relative">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        ((Number(limpezaCustoMensal) || 0) * 12 / (Number(orcamentoGeralLimpeza) || 5000)) * 100 > 35 
                          ? "bg-red-500" 
                          : ((Number(limpezaCustoMensal) || 0) * 12 / (Number(orcamentoGeralLimpeza) || 5000)) * 100 > 15 
                          ? "bg-amber-500" 
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, ((Number(limpezaCustoMensal) || 0) * 12 / (Number(orcamentoGeralLimpeza) || 5000)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2 font-mono">
                  <span>Mínimo (0%)</span>
                  <span className="font-bold text-slate-650">Consumo Geral: {(((Number(limpezaCustoMensal) || 0) * 12 / (Number(orcamentoGeralLimpeza) || 5000)) * 100).toFixed(1)}%</span>
                  <span>Máximo Recomendado (25%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Forecasting Table & Visual Graph Representation */}
          <div className="border-t border-slate-100 pt-5 space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-800">Previsão Multianual de Aumentos de Custos de Limpeza</h4>
              <p className="text-xs text-slate-400">Simule o comportamento dos encargos com higienização nos próximos 3 anos com base na taxa de inflação de {taxaInflacaoPrevisao}%.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Table forecast */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <th className="p-3">Ano de Vigência</th>
                      <th className="p-3 text-right">Custo Mensal Estimado</th>
                      <th className="p-3 text-right">Custo Anual Estimado</th>
                      <th className="p-3 text-right">Aumento Acumulado (€)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1, 2, 3].map(offset => {
                      const baseMensal = Number(limpezaCustoMensal) || 0;
                      const rate = (Number(taxaInflacaoPrevisao) || 0) / 100;
                      const yearVal = new Date().getFullYear() + offset;
                      
                      const forecastedMensal = baseMensal * Math.pow(1 + rate, offset);
                      const forecastedAnual = forecastedMensal * 12;
                      const increaseTotal = forecastedAnual - (baseMensal * 12);

                      return (
                        <tr key={offset} className={`border-b border-slate-100 hover:bg-slate-50/50 ${offset === 0 ? "font-bold bg-amber-50/20 text-slate-900" : "text-slate-600"}`}>
                          <td className="p-3 flex items-center space-x-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${offset === 0 ? "bg-amber-500" : "bg-slate-400"}`}></span>
                            <span>{offset === 0 ? "Ano Corrente" : `Ano +${offset}`} ({yearVal})</span>
                          </td>
                          <td className="p-3 text-right font-mono font-semibold">{forecastedMensal.toFixed(2)}€</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-800">{forecastedAnual.toFixed(2)}€</td>
                          <td className="p-3 text-right font-mono text-amber-600 font-extrabold">{offset === 0 ? "—" : `+${increaseTotal.toFixed(2)}€`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Visual forecast bar charts CSS only */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-2">Projeção Gráfica do Encargo Anual</h4>
                  
                  <div className="flex justify-around items-end h-32 pt-4">
                    {[0, 1, 2, 3].map(offset => {
                      const baseAnual = (Number(limpezaCustoMensal) || 0) * 12;
                      const rate = (Number(taxaInflacaoPrevisao) || 0) / 100;
                      const yearVal = new Date().getFullYear() + offset;
                      
                      const forecastedAnual = baseAnual * Math.pow(1 + rate, offset);
                      // percentage height normalized to max of 3000
                      const heightPercent = Math.min(100, Math.max(10, (forecastedAnual / 4000) * 100));

                      return (
                        <div key={offset} className="flex flex-col items-center space-y-2 w-1/4">
                          <span className="text-[10px] font-mono font-bold text-slate-700">{forecastedAnual.toFixed(0)}€</span>
                          <div 
                            className={`w-8 rounded-t-md transition-all shadow-sm ${offset === 0 ? "bg-amber-500" : "bg-amber-600/60"}`}
                            style={{ height: `${heightPercent}px` }}
                          ></div>
                          <span className="text-[9px] text-slate-400 font-bold">{yearVal}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <p className="text-[9px] text-slate-400 leading-relaxed text-center mt-3">
                  A projeção assume capitalização anual de taxas composta e estabilidade contratual. Recomenda-se prever provisões orçamentais no Fundo de Reserva.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
