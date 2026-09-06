import React, { useState, useEffect } from "react";
import { Predio, LoggedUser, GestorCarteira, EmpresaGestoraConfig } from "../types";
import { initialGestoresCarteira, initialEmpresaGestoraConfig } from "../data";
import { gerarPdfBoasVindasGestor } from "../utils";
import { 
  Building2, 
  Users, 
  Palette, 
  ShieldAlert, 
  Briefcase, 
  TrendingUp, 
  DollarSign, 
  FileText, 
  Camera, 
  Plus, 
  Check, 
  Mail, 
  Bot, 
  Phone, 
  Shield, 
  UserCheck, 
  Send, 
  Download, 
  Key, 
  Lock, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Info,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from "recharts";

interface FichaEmpresaGestoraProps {
  predios: Predio[];
  loggedUser: LoggedUser;
  onUpdateBrandingColor?: (color: string) => void;
  activeColor?: string;
  onUpdateBrandingLogo?: (logoUrl: string) => void;
  activeLogo?: string;
}

export function FichaEmpresaGestora({
  predios,
  loggedUser,
  onUpdateBrandingColor,
  activeColor = "emerald",
  onUpdateBrandingLogo,
  activeLogo
}: FichaEmpresaGestoraProps) {
  // Configurações da Empresa Gestora
  const [empresaConfig, setEmpresaConfig] = useState<EmpresaGestoraConfig>(() => {
    const saved = localStorage.getItem("condo_empresa_gestora_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return initialEmpresaGestoraConfig;
  });

  const [gestores, setGestores] = useState<GestorCarteira[]>(() => {
    const saved = localStorage.getItem("condo_gestores_carteira");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return initialGestoresCarteira;
  });

  // Guardar no localStorage
  useEffect(() => {
    localStorage.setItem("condo_empresa_gestora_config", JSON.stringify(empresaConfig));
  }, [empresaConfig]);

  useEffect(() => {
    localStorage.setItem("condo_gestores_carteira", JSON.stringify(gestores));
  }, [gestores]);

  // Modal para Criar / Editar Gestor
  const [isGestorModalOpen, setIsGestorModalOpen] = useState(false);
  const [editingGestorId, setEditingGestorId] = useState<string | null>(null);
  const [modalNome, setModalNome] = useState("");
  const [modalTlm, setModalTlm] = useState("");
  const [modalEmail, setModalEmail] = useState("");
  const [modalPerfil, setModalPerfil] = useState<"GESTOR" | "ADMIN">("GESTOR");
  const [modalPredios, setModalPredios] = useState<string[]>([]);
  const [modalPasswordProvisoria, setModalPasswordProvisoria] = useState("");
  const [modalGerarPdfAgora, setModalGerarPdfAgora] = useState(true);

  // Logo WebP
  const [gestoraLogo, setGestoraLogo] = useState<string>(() => {
    return activeLogo || localStorage.getItem("whiteLabelLogo") || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%23059669'/><text x='50%' y='55%' font-family='sans-serif' font-size='24' font-weight='black' fill='%23ffffff' dominant-baseline='middle' text-anchor='middle'>GF</text></svg>";
  });

  const [isDragging, setIsDragging] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ tipo: "success" | "info"; texto: string } | null>(null);

  useEffect(() => {
    if (activeLogo) {
      setGestoraLogo(activeLogo);
    }
  }, [activeLogo]);

  const showNotification = (texto: string, tipo: "success" | "info" = "success") => {
    setFeedbackMsg({ tipo, texto });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const handleLogoFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Por favor selecione um ficheiro de imagem válido (WebP, PNG, JPG).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_WIDTH = 800;

        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        const webpUrl = canvas.toDataURL("image/webp", 0.85);

        setGestoraLogo(webpUrl);
        localStorage.setItem("whiteLabelLogo", webpUrl);
        if (onUpdateBrandingLogo) {
          onUpdateBrandingLogo(webpUrl);
        }
        showNotification("Logótipo institucional atualizado com sucesso!");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleLogoFile(e.dataTransfer.files[0]);
    }
  };

  // Cores de branding
  const brandingColors = [
    { id: "emerald", name: "Esmeralda", class: "bg-emerald-600 hover:bg-emerald-700" },
    { id: "indigo", name: "Índigo", class: "bg-indigo-600 hover:bg-indigo-700" },
    { id: "blue", name: "Azul Clássico", class: "bg-blue-600 hover:bg-blue-700" },
    { id: "violet", name: "Violeta", class: "bg-violet-600 hover:bg-violet-700" },
    { id: "teal", name: "Teal", class: "bg-teal-600 hover:bg-teal-700" }
  ];

  // Abrir Modal de Gestor
  const abrirModalNovoGestor = () => {
    setEditingGestorId(null);
    setModalNome("");
    setModalTlm("");
    setModalEmail("");
    setModalPerfil("GESTOR");
    setModalPredios(predios.map(p => p.id_predio)); // Por defeito seleciona todos
    setModalPasswordProvisoria(`Gestor#${Math.floor(1000 + Math.random() * 9000)}!`);
    setModalGerarPdfAgora(true);
    setIsGestorModalOpen(true);
  };

  const abrirModalEditarGestor = (g: GestorCarteira) => {
    setEditingGestorId(g.id_gestor);
    setModalNome(g.nome);
    setModalTlm(g.tlm);
    setModalEmail(g.email);
    setModalPerfil(g.perfil);
    setModalPredios(g.predios_atribuidos || []);
    setModalPasswordProvisoria(g.password_provisoria || `Gestor#${Math.floor(1000 + Math.random() * 9000)}!`);
    setModalGerarPdfAgora(false);
    setIsGestorModalOpen(true);
  };

  const toggleModalPredio = (idPredio: string) => {
    if (modalPredios.includes(idPredio)) {
      setModalPredios(modalPredios.filter(id => id !== idPredio));
    } else {
      setModalPredios([...modalPredios, idPredio]);
    }
  };

  const salvarGestor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalNome.trim() || !modalEmail.trim()) {
      alert("Por favor preencha o Nome e o E-mail direto do gestor.");
      return;
    }

    if (editingGestorId) {
      // Editar
      const atualizados = gestores.map(g => {
        if (g.id_gestor === editingGestorId) {
          return {
            ...g,
            nome: modalNome.trim(),
            tlm: modalTlm.trim(),
            email: modalEmail.trim(),
            perfil: modalPerfil,
            predios_atribuidos: modalPredios,
            password_provisoria: modalPasswordProvisoria
          };
        }
        return g;
      });
      setGestores(atualizados);
      showNotification(`Gestor "${modalNome}" atualizado com sucesso!`);
    } else {
      // Criar Novo
      const novoGestor: GestorCarteira = {
        id_gestor: "gestor-" + Date.now(),
        nome: modalNome.trim(),
        tlm: modalTlm.trim() || "—",
        email: modalEmail.trim(),
        perfil: modalPerfil,
        predios_atribuidos: modalPredios,
        status_acesso: "PENDENTE_PRIMEIRO_ACESSO",
        password_provisoria: modalPasswordProvisoria,
        email_boas_vindas_enviado: modalGerarPdfAgora,
        data_atribuicao: new Date().toISOString().split("T")[0],
        foto: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
      };

      // Guardar a regra de que no primeiro login obrigatoriamente altera a password
      localStorage.setItem(`force_password_change_${novoGestor.email}`, "true");

      setGestores([...gestores, novoGestor]);

      if (modalGerarPdfAgora) {
        gerarPdfBoasVindasGestor(novoGestor, predios, empresaConfig.nome_empresa, gestoraLogo);
        const docName = novoGestor.perfil === "ADMIN" ? "Instrucoes_Acesso_Perfil_Administrador.pdf" : "Instrucoes_Acesso_Perfil_Gestor.pdf";
        showNotification(`Colaborador adicionado! E-mail de Ativação enviado e ${docName} descarregado com sucesso.`);
      } else {
        showNotification(`Colaborador "${novoGestor.nome}" registado com sucesso!`);
      }
    }

    setIsGestorModalOpen(false);
  };

  const handleEnviarEmailBoasVindas = (gestor: GestorCarteira) => {
    // Registar obrigação de alterar a password no 1º acesso
    localStorage.setItem(`force_password_change_${gestor.email}`, "true");

    // Gerar o PDF Oficial
    gerarPdfBoasVindasGestor(gestor, predios, empresaConfig.nome_empresa, gestoraLogo);

    // Atualizar estado
    const atualizados = gestores.map(g => {
      if (g.id_gestor === gestor.id_gestor) {
        return {
          ...g,
          email_boas_vindas_enviado: true,
          status_acesso: "PENDENTE_PRIMEIRO_ACESSO" as const
        };
      }
      return g;
    });
    setGestores(atualizados);

    const docName = gestor.perfil === "ADMIN" ? "Instrucoes_Acesso_Perfil_Administrador.pdf" : "Instrucoes_Acesso_Perfil_Gestor.pdf";
    showNotification(
      `E-mail de Ativação enviado para ${gestor.email}! O documento oficial "${docName}" com a senha provisória "${gestor.password_provisoria || "Admin#2026!"}" foi descarregado.`
    );
  };

  const handleRemoverGestor = (idGestor: string) => {
    const gestor = gestores.find(g => g.id_gestor === idGestor);
    if (!gestor) return;
    if (confirm(`Tem a certeza de que deseja remover o gestor ${gestor.nome}?`)) {
      setGestores(gestores.filter(g => g.id_gestor !== idGestor));
      showNotification(`Gestor ${gestor.nome} removido.`, "info");
    }
  };

  // KPIs
  const totalPrediosCount = predios.length;
  const totalFracoesCount = totalPrediosCount * 12;
  const totalFaturacaoMensal = totalPrediosCount * 2450;
  const totalFaturacaoEmAtraso = totalPrediosCount * 450;
  const totalTaxaInadimplencia = ((totalFaturacaoEmAtraso / totalFaturacaoMensal) * 100).toFixed(1);

  const globalFinancialHistory = [
    { mes: "Jan", Receita: 4800 * totalPrediosCount, Despesa: 3200 * totalPrediosCount, Extraordinario: 500 * totalPrediosCount },
    { mes: "Fev", Receita: 4900 * totalPrediosCount, Despesa: 3400 * totalPrediosCount, Extraordinario: 800 * totalPrediosCount },
    { mes: "Mar", Receita: 5100 * totalPrediosCount, Despesa: 4100 * totalPrediosCount, Extraordinario: 1200 * totalPrediosCount },
    { mes: "Abr", Receita: 5200 * totalPrediosCount, Despesa: 3800 * totalPrediosCount, Extraordinario: 1500 * totalPrediosCount },
    { mes: "Mai", Receita: 5400 * totalPrediosCount, Despesa: 3900 * totalPrediosCount, Extraordinario: 900 * totalPrediosCount },
    { mes: "Jun", Receita: 5600 * totalPrediosCount, Despesa: 4200 * totalPrediosCount, Extraordinario: 2400 * totalPrediosCount },
    { mes: "Jul", Receita: 5800 * totalPrediosCount, Despesa: 4000 * totalPrediosCount, Extraordinario: 1800 * totalPrediosCount }
  ];

  const portfolioDistribution = [
    { name: "Prédios Residenciais", value: Math.max(1, Math.ceil(totalPrediosCount * 0.7)), color: "#10b981" },
    { name: "Prédios Comerciais/Mistos", value: Math.max(1, Math.ceil(totalPrediosCount * 0.3)), color: "#3b82f6" }
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* Toast Notification */}
      {feedbackMsg && (
        <div className={`p-4 rounded-2xl shadow-lg border flex items-center justify-between gap-3 animate-fade-in ${
          feedbackMsg.tipo === "success" 
            ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-100" 
            : "bg-blue-950/90 border-blue-500/50 text-blue-100"
        }`}>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{feedbackMsg.texto}</span>
          </div>
          <button 
            onClick={() => setFeedbackMsg(null)}
            className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* GLOBAL SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm flex items-center space-x-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Prédios Administrados</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white font-mono">{totalPrediosCount}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm flex items-center space-x-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Frações Totais</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white font-mono">{totalFracoesCount}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm flex items-center space-x-4">
          <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Faturação de Portfolio</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white font-mono">{(totalFaturacaoMensal).toLocaleString()} €<span className="text-xs font-medium text-slate-400">/mês</span></span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm flex items-center space-x-4">
          <div className="h-12 w-12 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Inadimplência Global</span>
            <span className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">{totalTaxaInadimplencia} %</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECÇÃO ESTRATÉGICA 1: CONFIGURAÇÃO DE AUTORESPONDER & IA NA EMPRESA GESTORA */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white p-6 sm:p-8 rounded-3xl border border-emerald-500/30 shadow-xl space-y-6 relative overflow-hidden">
        {/* Glow background accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Motor Google AI Studio & Gemini
              </span>
              <span className="text-xs text-slate-400 font-mono">Regras Globais de E-mail</span>
            </div>
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Bot className="h-6 w-6 text-emerald-400" />
              <span>Configuração do Autoresponder & Triagem Inteligente por IA</span>
            </h3>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Defina as diretrizes centrais sobre a gestão de caixas de correio da empresa gestora vs. caixas individuais de cada condomínio. A IA adaptará as assinaturas, a leitura dos históricos de frações e as respostas automáticas conforme a sua seleção.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PERGUNTA 1: QUAL O EMAIL PRINCIPAL A USAR NO AUTORESPONDER */}
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
                <Mail className="h-4 w-4" />
                <span>Pergunta 1 • Remetente do Autoresponder</span>
              </div>
              <h4 className="text-sm font-bold text-white leading-snug">
                Qual o e-mail principal a usar no Autoresponder de respostas automáticas aos condóminos?
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Determina o endereço de remetente e a assinatura institucional presente nos e-mails automáticos emitidos pelo sistema (ex: confirmações de pagamentos, avisos de corte e recibos).
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {/* Opção A: E-mail da Empresa */}
              <label 
                onClick={() => setEmpresaConfig(prev => ({ ...prev, email_autoresponder_principal: "EMPRESA" }))}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  empresaConfig.email_autoresponder_principal === "EMPRESA"
                    ? "bg-emerald-950/60 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/50"
                    : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <input 
                  type="radio" 
                  name="email_autoresponder" 
                  checked={empresaConfig.email_autoresponder_principal === "EMPRESA"}
                  onChange={() => {}}
                  className="mt-1 h-4 w-4 text-emerald-500 border-slate-700 focus:ring-emerald-500"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-xs block text-emerald-300">
                    🏢 E-mail Corporativo da Empresa Gestora
                  </span>
                  <span className="text-[10.5px] text-slate-300 block font-mono">
                    {empresaConfig.email_corporativo || "contacto@gestaoforte.pt"}
                  </span>
                  <span className="text-[9.5px] text-slate-400 block">
                    Centraliza todas as respostas sob a marca da empresa gestora.
                  </span>
                </div>
              </label>

              {/* Opção B: E-mail de Cada Prédio */}
              <label 
                onClick={() => setEmpresaConfig(prev => ({ ...prev, email_autoresponder_principal: "CONDOMINIO" }))}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  empresaConfig.email_autoresponder_principal === "CONDOMINIO"
                    ? "bg-emerald-950/60 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/50"
                    : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <input 
                  type="radio" 
                  name="email_autoresponder" 
                  checked={empresaConfig.email_autoresponder_principal === "CONDOMINIO"}
                  onChange={() => {}}
                  className="mt-1 h-4 w-4 text-emerald-500 border-slate-700 focus:ring-emerald-500"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-xs block text-emerald-300">
                    🏘️ E-mail Dedicado de Cada Prédio / Condomínio (Recomendado)
                  </span>
                  <span className="text-[10.5px] text-slate-300 block font-mono">
                    ex: edificio.estrela@condomanager.pt
                  </span>
                  <span className="text-[9.5px] text-slate-400 block">
                    Respostas saem personalizadas com a identidade de cada edifício individual.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* PERGUNTA 2: QUAL O EMAIL A SER GERIDO PELA IA */}
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
                <Bot className="h-4 w-4" />
                <span>Pergunta 2 • Fonte de Informação da IA</span>
              </div>
              <h4 className="text-sm font-bold text-white leading-snug">
                Qual a caixa de e-mail a ser monitorizada e gerida pela IA para busca de informação?
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Define onde o modelo de IA do AI Studio vai ler mensagens de condóminos, consultar o histórico da fração e extrair ocorrências automaticamente.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {/* Opção A: Caixa Central da Empresa */}
              <label 
                onClick={() => setEmpresaConfig(prev => ({ ...prev, email_gestao_ia: "EMPRESA" }))}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  empresaConfig.email_gestao_ia === "EMPRESA"
                    ? "bg-emerald-950/60 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/50"
                    : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <input 
                  type="radio" 
                  name="email_gestao_ia" 
                  checked={empresaConfig.email_gestao_ia === "EMPRESA"}
                  onChange={() => {}}
                  className="mt-1 h-4 w-4 text-emerald-500 border-slate-700 focus:ring-emerald-500"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-xs block text-emerald-300">
                    📥 Caixa de Entrada Global da Empresa Gestora
                  </span>
                  <span className="text-[9.5px] text-slate-400 block">
                    A IA tria todos os e-mails recebidos centralmente e associa automaticamente ao respetivo prédio por NIF, morada ou fração mencionada.
                  </span>
                </div>
              </label>

              {/* Opção B: Caixas Individuais de Cada Condomínio */}
              <label 
                onClick={() => setEmpresaConfig(prev => ({ ...prev, email_gestao_ia: "CONDOMINIO" }))}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  empresaConfig.email_gestao_ia === "CONDOMINIO"
                    ? "bg-emerald-950/60 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/50"
                    : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <input 
                  type="radio" 
                  name="email_gestao_ia" 
                  checked={empresaConfig.email_gestao_ia === "CONDOMINIO"}
                  onChange={() => {}}
                  className="mt-1 h-4 w-4 text-emerald-500 border-slate-700 focus:ring-emerald-500"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-xs block text-emerald-300">
                    📫 Caixas de Correio Individuais por Prédio (Recomendado)
                  </span>
                  <span className="text-[9.5px] text-slate-400 block">
                    A IA processa o canal direto de cada prédio registado, garantindo isolamento de contexto e respostas ultra-precisas para os condóminos.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Resumo da Configuração Atual */}
        <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              Configuração Ativa: Remetente Autoresponder no modo <strong className="text-white font-mono uppercase">{empresaConfig.email_autoresponder_principal}</strong> e Leitura IA no modo <strong className="text-white font-mono uppercase">{empresaConfig.email_gestao_ia}</strong>.
            </span>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-1 rounded-lg shrink-0">
            ✓ Pronto para Render / Supabase / Vercel
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECÇÃO 2: GESTÃO DE GESTORES DE CARTEIRA DA EMPRESA GESTORA */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center space-x-2">
                <Users className="h-5 w-5 text-emerald-600" />
                <span>Gestores de Carteira da Empresa Gestora</span>
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Registo de gestores, atribuição de prédios, seleção de perfil (Gestor vs. Administrador) e emissão de e-mails de boas-vindas com PDF e password provisória.
            </p>
          </div>

          <button
            type="button"
            onClick={abrirModalNovoGestor}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center space-x-2 shrink-0 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar Novo Gestor</span>
          </button>
        </div>

        {/* Banner de Contactos Globais Disponíveis aos Condóminos */}
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200">
          <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <strong className="block font-bold">Contactos Visíveis para Todos os Condóminos:</strong>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              O Nome, E-mail direto e Telemóvel (TLM) de cada gestor ficam automaticamente integrados no Portal do Condómino e na PWA Mobile dos prédios atribuídos, permitindo contacto imediato em caso de emergência ou dúvidas de gestão.
            </p>
          </div>
        </div>

        {/* Tabela de Gestores de Carteira */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider text-[10px]">
                  <th className="py-3 px-4">Gestor / Colaborador</th>
                  <th className="py-3 px-4">Telemóvel Direto</th>
                  <th className="py-3 px-4">E-mail Direto</th>
                  <th className="py-3 px-4">Prédios Atribuídos</th>
                  <th className="py-3 px-4">Perfil Atribuído</th>
                  <th className="py-3 px-4">Estado do Acesso</th>
                  <th className="py-3 px-4 text-right">Ações & Boas-Vindas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {gestores.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Nenhum gestor registado na empresa gestora. Clique no botão acima para adicionar.
                    </td>
                  </tr>
                ) : (
                  gestores.map((gestor) => {
                    const prediosAssociados = predios.filter(p => gestor.predios_atribuidos.includes(p.id_predio));

                    return (
                      <tr key={gestor.id_gestor} className="hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition-colors">
                        {/* Nome & Foto */}
                        <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">
                          <div className="flex items-center space-x-3">
                            {gestor.foto ? (
                              <img 
                                src={gestor.foto} 
                                alt={gestor.nome} 
                                className="h-9 w-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0" 
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="h-9 w-9 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                                {gestor.nome.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <span className="block font-bold text-slate-800 dark:text-white">{gestor.nome}</span>
                              <span className="text-[9px] text-slate-400 font-mono">ID: {gestor.id_gestor}</span>
                            </div>
                          </div>
                        </td>

                        {/* Telemóvel */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                          <a href={`tel:${gestor.tlm}`} className="hover:text-emerald-600 flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-emerald-500" />
                            <span>{gestor.tlm}</span>
                          </a>
                        </td>

                        {/* E-mail Direto */}
                        <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                          <a href={`mailto:${gestor.email}`} className="hover:text-emerald-600 flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            <span>{gestor.email}</span>
                          </a>
                        </td>

                        {/* Prédios Atribuídos */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {prediosAssociados.length === 0 ? (
                              <span className="text-[10px] text-slate-400 italic">Nenhum</span>
                            ) : (
                              prediosAssociados.map(p => (
                                <span 
                                  key={p.id_predio}
                                  className="text-[9.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 truncate"
                                  title={p?.nome || p?.morada_linha1 || ""}
                                >
                                  {p?.nome || p?.morada_linha1 || "Sem morada"}
                                </span>
                              ))
                            )}
                          </div>
                        </td>

                        {/* Perfil Atribuído */}
                        <td className="py-3.5 px-4">
                          {gestor.perfil === "ADMIN" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 px-2.5 py-1 rounded-lg">
                              <Shield className="h-3 w-3" /> Administrador
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 px-2.5 py-1 rounded-lg">
                              <Briefcase className="h-3 w-3" /> Gestor
                            </span>
                          )}
                        </td>

                        {/* Estado do Acesso & Password Provisória */}
                        <td className="py-3.5 px-4">
                          {gestor.status_acesso === "PENDENTE_PRIMEIRO_ACESSO" ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 text-[9.5px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 px-2 py-0.5 rounded-full">
                                <Lock className="h-2.5 w-2.5" /> Pendente 1º Acesso
                              </span>
                              <span className="text-[9px] text-red-600 dark:text-red-400 block font-semibold">
                                *Troca de senha obrigatória
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200 px-2 py-0.5 rounded-full">
                              <Check className="h-2.5 w-2.5" /> Acesso Ativo
                            </span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* Botão Enviar E-mail Boas-Vindas + PDF */}
                            <button
                              type="button"
                              onClick={() => handleEnviarEmailBoasVindas(gestor)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold transition-all shadow-xs cursor-pointer flex items-center space-x-1"
                              title="Enviar E-mail de Boas-Vindas com PDF explicativo e credenciais"
                            >
                              <Send className="h-3 w-3" />
                              <span>Boas-Vindas (PDF)</span>
                            </button>

                            {/* Botão Editar */}
                            <button
                              type="button"
                              onClick={() => abrirModalEditarGestor(gestor)}
                              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Editar dados do gestor"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>

                            {/* Botão Remover */}
                            <button
                              type="button"
                              onClick={() => handleRemoverGestor(gestor.id_gestor)}
                              className="bg-red-50 dark:bg-red-950/40 hover:bg-red-600 text-red-600 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer border border-red-200 dark:border-red-800/40"
                              title="Remover gestor"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECÇÃO 3: BRANDING & IDENTIDADE VISUAL WHITE-LABEL & DADOS DA EMPRESA */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* EDIT PROFILE & WHITE LABEL BRANDING */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 rounded-2xl shadow-sm lg:col-span-2 space-y-5">
          <div className="border-b border-slate-100 dark:border-slate-800/60 pb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center">
              <Palette className="h-4.5 w-4.5 mr-2 text-amber-500" /> Branding & Identidade Visual (White-Label)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Logo webp simulated preview */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`space-y-2 text-center border-2 p-4 rounded-xl transition-colors duration-200 ${
                isDragging 
                  ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20" 
                  : "border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20"
              }`}
            >
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Logótipo da Empresa</span>
              <div className="h-24 w-24 rounded-2xl mx-auto overflow-hidden shadow-sm flex items-center justify-center border bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-800">
                <img src={gestoraLogo} alt="Gestora Logo" className="object-contain h-full w-full max-h-full max-w-full p-1" referrerPolicy="no-referrer" />
              </div>
              
              <div className="pt-1">
                <label 
                  htmlFor="gestora-logo-input" 
                  className="inline-flex text-[10px] bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold px-3 py-1.5 rounded-lg items-center space-x-1 cursor-pointer border dark:border-slate-700 transition-colors"
                >
                  <Camera className="h-3 w-3 mr-1" /> 
                  <span>Selecionar Imagem</span>
                </label>
                <input 
                  id="gestora-logo-input"
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleLogoFile(e.target.files[0]);
                    }
                  }}
                />
                <p className="text-[8px] text-slate-400 mt-1.5">Arraste a imagem aqui ou clique para procurar (WebP, PNG, JPG)</p>
              </div>
            </div>

            {/* Profile fields */}
            <div className="md:col-span-2 space-y-3.5">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Nome da Empresa Gestora</label>
                  <input 
                    type="text" 
                    value={empresaConfig.nome_empresa}
                    onChange={e => setEmpresaConfig(prev => ({ ...prev, nome_empresa: e.target.value }))}
                    className="border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-2 text-xs rounded-lg dark:text-white"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">NIF Coletivo</label>
                  <input 
                    type="text" 
                    value={empresaConfig.nif}
                    onChange={e => setEmpresaConfig(prev => ({ ...prev, nif: e.target.value }))}
                    className="border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-2 text-xs rounded-lg dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">E-mail Corporativo</label>
                  <input 
                    type="email" 
                    value={empresaConfig.email_corporativo}
                    onChange={e => setEmpresaConfig(prev => ({ ...prev, email_corporativo: e.target.value }))}
                    className="border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-2 text-xs rounded-lg dark:text-white font-mono"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Telefone de Apoio</label>
                  <input 
                    type="text" 
                    value={empresaConfig.telefone}
                    onChange={e => setEmpresaConfig(prev => ({ ...prev, telefone: e.target.value }))}
                    className="border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-2 text-xs rounded-lg dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Color theme chooser (white label live colors) */}
          <div className="border-t border-slate-100 dark:border-slate-850 pt-4 space-y-3">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Esquema de Cores do Portal de Marca (Branding)</span>
            <div className="flex flex-wrap gap-3">
              {brandingColors.map((color) => (
                <button
                  key={color.id}
                  onClick={() => onUpdateBrandingColor && onUpdateBrandingColor(color.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold text-white flex items-center space-x-2 transition-all cursor-pointer ${color.class} ${activeColor === color.id ? "ring-4 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900 scale-105" : "opacity-80 hover:opacity-100"}`}
                >
                  {activeColor === color.id && <Check className="h-3.5 w-3.5" />}
                  <span>{color.name}</span>
                </button>
              ))}
            </div>
            <p className="text-[9px] text-slate-400 italic">Ao selecionar uma cor, o CondoManager adapta automaticamente todo o portal do administrador e dos condóminos com as cores institucionais da Empresa Gestora.</p>
          </div>
        </div>

        {/* EVOLUÇÃO GRÁFICA DO PORTFOLIO */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800/60 pb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center">
              <Briefcase className="h-4.5 w-4.5 mr-2 text-emerald-500" /> Segmentação de Portfólio
            </h3>
          </div>
          <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={portfolioDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {portfolioDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 pt-1 text-xs">
            {portfolioDistribution.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="flex items-center text-slate-600 dark:text-slate-400 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full mr-2 block" style={{ backgroundColor: item.color }}></span>
                  {item.name}
                </span>
                <span className="font-bold text-slate-800 dark:text-white font-mono">{item.value} Prédios</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CRIAR / EDITAR GESTOR DE CARTEIRA */}
      {/* ========================================================================= */}
      {isGestorModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full p-6 sm:p-7 space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    {editingGestorId ? "Editar Gestor de Carteira" : "Adicionar Novo Gestor à Empresa"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Defina os dados, perfil e prédios atribuídos ao colaborador.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGestorModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={salvarGestor} className="space-y-4">
              {/* Nome Completo */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Nome Completo *
                </label>
                <input 
                  type="text" 
                  required
                  value={modalNome}
                  onChange={e => setModalNome(e.target.value)}
                  placeholder="Ex: Dra. Teresa Santos"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-xs rounded-xl text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Telemóvel e E-mail direto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Telemóvel Direto (TLM) *
                  </label>
                  <input 
                    type="text" 
                    required
                    value={modalTlm}
                    onChange={e => setModalTlm(e.target.value)}
                    placeholder="Ex: 912 345 678"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-xs rounded-xl text-slate-800 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[9px] text-slate-400 block">Ficará visível para os condóminos</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    E-mail Direto *
                  </label>
                  <input 
                    type="email" 
                    required
                    value={modalEmail}
                    onChange={e => setModalEmail(e.target.value)}
                    placeholder="Ex: teresa.s@gestaoforte.pt"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-xs rounded-xl text-slate-800 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* SELEÇÃO DO PERFIL A ATRIBUIR */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Perfil de Acesso a Atribuir:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Opção GESTOR */}
                  <label 
                    onClick={() => setModalPerfil("GESTOR")}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      modalPerfil === "GESTOR"
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-slate-900 dark:text-white ring-1 ring-emerald-500"
                        : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      checked={modalPerfil === "GESTOR"}
                      onChange={() => setModalPerfil("GESTOR")}
                      className="mt-0.5 h-4 w-4 text-emerald-600 rounded border-slate-300 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs block text-emerald-700 dark:text-emerald-300">
                        💼 Gestor de Portfólio
                      </span>
                      <span className="text-[9.5px] text-slate-500 block leading-tight">
                        Gestão operacional, ocorrências, vistorias e atendimento aos residentes.
                      </span>
                    </div>
                  </label>

                  {/* Opção ADMIN */}
                  <label 
                    onClick={() => setModalPerfil("ADMIN")}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      modalPerfil === "ADMIN"
                        ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-slate-900 dark:text-white ring-1 ring-amber-500"
                        : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      checked={modalPerfil === "ADMIN"}
                      onChange={() => setModalPerfil("ADMIN")}
                      className="mt-0.5 h-4 w-4 text-amber-600 rounded border-slate-300 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs block text-amber-700 dark:text-amber-300">
                        👑 Administrador
                      </span>
                      <span className="text-[9.5px] text-slate-500 block leading-tight">
                        Acesso total financeiro, atas, contencioso e regras do prédio.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* PRÉDIOS ATRIBUÍDOS */}
              <div className="space-y-2 pt-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Prédios Atribuídos à Carteira ({modalPredios.length}/{predios.length}):
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (modalPredios.length === predios.length) setModalPredios([]);
                      else setModalPredios(predios.map(p => p.id_predio));
                    }}
                    className="text-[10px] text-emerald-600 font-bold hover:underline"
                  >
                    {modalPredios.length === predios.length ? "Desmarcar Todos" : "Selecionar Todos"}
                  </button>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                  {predios.map(p => {
                    const isChecked = modalPredios.includes(p.id_predio);
                    return (
                      <label 
                        key={p.id_predio}
                        className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                          isChecked ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-semibold" : "hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleModalPredio(p.id_predio)}
                          className="h-3.5 w-3.5 text-emerald-600 rounded border-slate-300 cursor-pointer"
                        />
                        <span className="truncate">{p?.nome || `${p?.morada_linha1 || ""}, Nº ${p?.num_porta || ""}`}</span>
                        {p.email && <span className="text-[9px] text-slate-400 font-mono ml-auto truncate">({p.email})</span>}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* CREDENCIAIS PROVISÓRIAS & AVISO 1º ACESSO */}
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-amber-600" />
                    Password Provisória de Acesso
                  </span>
                  <button
                    type="button"
                    onClick={() => setModalPasswordProvisoria(`Gestor#${Math.floor(1000 + Math.random() * 9000)}!`)}
                    className="text-[10px] text-amber-800 dark:text-amber-300 underline font-bold"
                  >
                    Gerar Nova
                  </button>
                </div>
                <input 
                  type="text" 
                  value={modalPasswordProvisoria}
                  onChange={e => setModalPasswordProvisoria(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 px-3 py-1.5 text-xs font-mono font-bold text-amber-950 dark:text-amber-200 rounded-lg"
                />
                <p className="text-[9.5px] text-amber-800 dark:text-amber-300 leading-snug">
                  ⚠️ <strong>Regra de Segurança:</strong> No primeiro login, o sistema exigirá obrigatoriamente a substituição desta senha provisória por uma nova senha confidencial.
                </p>
              </div>

              {/* Checkbox para gerar PDF de Boas-Vindas */}
              {!editingGestorId && (
                <label className="flex items-center gap-2.5 p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-xl cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={modalGerarPdfAgora}
                    onChange={e => setModalGerarPdfAgora(e.target.checked)}
                    className="h-4 w-4 text-emerald-600 rounded border-slate-300 cursor-pointer"
                  />
                  <span className="text-xs text-emerald-900 dark:text-emerald-200 font-semibold">
                    Gerar e descarregar automaticamente o PDF de Boas-Vindas com manual do perfil e credenciais
                  </span>
                </label>
              )}

              {/* Botões de Ação */}
              <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGestorModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
                >
                  {editingGestorId ? "Guardar Alterações" : "Concluir Registo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
