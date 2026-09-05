import AssistenteIA from "./components/AssistenteIA";
import { Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { ActionIcon } from "./components/ActionIcon";
import { LoggedUser, Predio, Conta, Fornecedor, Fracao, Aviso, Movimento, Reuniao, Documento, Ocorrencia, Reserva, CapacidadeLimite } from "./types";
import { initialPredios, initialContas, initialFornecedores, initialFracoes, initialAvisos, initialMovements, initialReunioes, initialDocumentos, initialOcorrencias } from "./data";
import { PainelControlo } from "./components/PainelControlo";
import { GestaoPredios } from "./components/GestaoPredios";
import { GestaoFracoes } from "./components/GestaoFracoes";
import { GestaoFornecedores } from "./components/GestaoFornecedores";
import { GestaoContas } from "./components/GestaoContas";
import { GestaoEmissao } from "./components/GestaoEmissao";
import { GestaoMovimentos } from "./components/GestaoMovimentos";
import { IAConciliacao } from "./components/IAConciliacao";
import { AgendadorAutomatico } from "./components/AgendadorAutomatico";
import { LeitorAnexosIA } from "./components/LeitorAnexosIA";
import { GestaoAssembleias } from "./components/GestaoAssembleias";
import { GestaoDocumentos } from "./components/GestaoDocumentos";
import { GestaoVistoriasLimpezas } from "./components/GestaoVistoriasLimpezas";
import { IAAvancada } from "./components/IAAvancada";
import { GestaoComunicacoes } from "./components/GestaoComunicacoes";
import { AssistenteImportacao } from "./components/AssistenteImportacao";
import { GestaoReservas } from "./components/GestaoReservas";
import { PortalCondomino } from "./components/PortalCondomino";
import { ContenciosoJuridico } from "./components/ContenciosoJuridico";
import { FinanceiroAvancado } from "./components/FinanceiroAvancado";
import { PortalOrcamentos } from "./components/PortalOrcamentos";
import { DashboardKPIs } from "./components/DashboardKPIs";
import { MultiCondominio } from "./components/MultiCondominio";
import { PWASimulator } from "./components/PWASimulator";
import { FichaEmpresaGestora } from "./components/FichaEmpresaGestora";
import { UserSecurityModal } from "./components/UserSecurityModal";
import { GestaoFundoReserva } from "./components/GestaoFundoReserva";
import { GestaoRelatorios } from "./components/GestaoRelatorios";
import { ContabilidadeInterna } from "./components/ContabilidadeInterna";
import { AuditoriaInterna } from "./components/AuditoriaInterna";
import { GestaoManutencaoIntervencoes } from "./components/GestaoManutencaoIntervencoes";
import { ConfiguracoesAdministracao } from "./components/ConfiguracoesAdministracao";
import { InventarioTecnico } from "./components/InventarioTecnico";
import { EnviosProgramados } from "./components/EnviosProgramados";
import { CentralDocumentosMinutas } from "./components/CentralDocumentosMinutas";
import { ConfiguracaoArranqueSaldos } from "./components/ConfiguracaoArranqueSaldos";
import { AgendaManutencao } from "./components/AgendaManutencao";
import { GestaoSinistrosSeguros } from "./components/GestaoSinistrosSeguros";
import { MuralDigitalReservas } from "./components/MuralDigitalReservas";
import { SecurityAuditModal } from "./components/SecurityAuditModal";
import { SendingReactionModal } from "./components/SendingReactionModal";
import { DraggableAIFloatingButton } from "./components/DraggableAIFloatingButton";
import LayoutTop from "./components/LayoutTop";
import AuthForm from "./components/AuthForm";
import { validatePasswordPolicy, createSecurityLog, INITIAL_USER_SECURITY, UserSecurityState } from "./lib/authSecurity";
import { 
  createNewSession, 
  validateSession, 
  purgeSession, 
  rotateSessionToken, 
  invalidateUserSessions, 
  validateRoleAccess,
  recordUserActivity,
  RoleNavigationMap,
  UserRole,
  IDLE_TIMEOUT_MS,
  isTabAllowedForRole,
  isMenuAllowedForRole
} from "./lib/sessionManager";
import { resolveUserByEmail, DEMO_ACCOUNTS_MAP } from "./utils";
const condoManagerLogo = "/marca/02-versao-horizontal.png";
const logoutIcon = "/estados-acoes/17-desligar.png";
const terminarSessaoIcon = "/estados-acoes/16-terminar-sessao.png";

export default function App() {
  const [predios, setPredios] = useState<Predio[]>(initialPredios);
  const [activePredioId, setActivePredioId] = useState("predio-1");
  const [contas, setContas] = useState<Conta[]>(initialContas);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>(initialFornecedores);
  const [fracoes, setFracoes] = useState<Fracao[]>(initialFracoes);
  const [avisos, setAvisos] = useState<Aviso[]>(initialAvisos);
  const [movements, setMovements] = useState<Movimento[]>(initialMovements);
  const [reunioes, setReunioes] = useState<Reuniao[]>(initialReunioes);
  const [documentos, setDocumentos] = useState<Documento[]>(initialDocumentos);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>(initialOcorrencias);

  // Reservation states
  const [reservas, setReservas] = useState<Reserva[]>([
    {
      id_reserva: "res-1",
      id_predio: "predio-1",
      id_fracao: "frac-1",
      area_comum: "GinÃ¡sio",
      data: "18-07-2026",
      hora_inicio: "08:00",
      hora_fim: "09:30",
      responsavel: "Carlos Administrador",
      num_pessoas: 2
    },
    {
      id_reserva: "res-2",
      id_predio: "predio-1",
      id_fracao: "frac-2",
      area_comum: "Spa",
      data: "18-07-2026",
      hora_inicio: "10:00",
      hora_fim: "12:00",
      responsavel: "Ana Silva",
      num_pessoas: 3
    }
  ]);

  const [capacidades, setCapacidades] = useState<CapacidadeLimite[]>([
    { area_comum: "GinÃ¡sio", limite: 5 },
    { area_comum: "Spa", limite: 8 },
    { area_comum: "SalÃ£o de Festas", limite: 40 },
    { area_comum: "Churrasqueira", limite: 15 }
  ]);

  const [loggedUser, setLoggedUser] = useState<LoggedUser>({
    nome: "Administrador do CondomÃ­nio",
    email: "condomanagerai@gmail.com",
    role: "ADMIN"
  });

  const [browserIsLoggedOut, setBrowserIsLoggedOut] = useState<boolean>(true);
  const [browserEmail, setBrowserEmail] = useState<string>("condomanagerai@gmail.com");
  const [browserPassword, setBrowserPassword] = useState<string>("â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢");
  const [browserSelectedRole, setBrowserSelectedRole] = useState<LoggedUser["role"]>("ADMIN");
  const [browserBiometricScan, setBrowserBiometricScan] = useState<boolean>(false);
  const [browserBiometricProgress, setBrowserBiometricProgress] = useState<number>(0);
  const [browserResetMode, setBrowserResetMode] = useState<boolean>(false);
  const [browserResetSent, setBrowserResetSent] = useState<boolean>(false);
  const [securityModalOpen, setSecurityModalOpen] = useState<boolean>(false);
  const [newResetPassword, setNewResetPassword] = useState<string>("");
  const [confirmResetPassword, setConfirmResetPassword] = useState<string>("");
  const [userSecurityMap, setUserSecurityMap] = useState<Record<string, UserSecurityState>>(INITIAL_USER_SECURITY);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [loginErrorMessage, setLoginErrorMessage] = useState<string>("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
// Cooldown countdown timer effect
useEffect(() => {
  const currentSecState = userSecurityMap[browserEmail] || {
    email: browserEmail,
    failedAttempts: 0,
    cooldownUntil: null,
    cooldownPassed: false,
    postCooldownAttempts: 0,
    isLocked: false,
    mustResetPassword: false,
    passwordHistory: [],
    botChallengeRequired: false,
  };
  
if (currentSecState.cooldownUntil && currentSecState.cooldownUntil > Date.now()) {
  const interval = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((currentSecState.cooldownUntil! - Date.now()) / 1000));
    setCooldownSeconds(remaining);

    if (remaining <= 0) {
      clearInterval(interval);

      setUserSecurityMap(prev => ({
        ...prev,
        [browserEmail]: {
          ...prev[browserEmail],
          cooldownUntil: null,
          cooldownPassed: true,
        }
      }));

      createSecurityLog(
        browserEmail,
        "BOT_CHALLENGE_PASSED",
        "Cooldown de 1 minuto terminado. Concedidas 3 tentativas pós-bloqueio."
      );
    }
  }, 1000);

  return () => clearInterval(interval);

} else {
  setCooldownSeconds(0);
}
}, [browserEmail, userSecurityMap]);

// Automatic Theme detection via prefers-color-scheme
useEffect(() => {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleThemeChange = (e: any) => {
    setTheme(e.matches ? "dark" : "light");
  };

  setTheme(mediaQuery.matches ? "dark" : "light");
  mediaQuery.addEventListener("change", handleThemeChange);

  return () => mediaQuery.removeEventListener("change", handleThemeChange);
}, []);

    const [activeSection, setActiveSection] = useState("painel"); 
  const [userProfileModalOpen, setUserProfileModalOpen] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(true);
  const [openMenuPredios, setOpenMenuPredios] = useState(true);
  const [openMenuFracoes, setOpenMenuFracoes] = useState(false);
  const [openMenuFinanceiro, setOpenMenuFinanceiro] = useState(false);
  const [openMenuLimpezas, setOpenMenuLimpezas] = useState(false);
  const [openMenuVistoriasIntervencoes, setOpenMenuVistoriasIntervencoes] = useState(false);
  const [openMenuJuridico, setOpenMenuJuridico] = useState(false);
  const [openMenuComunicacoes, setOpenMenuComunicacoes] = useState(false);
  const [openMenuConsultoriaIA, setOpenMenuConsultoriaIA] = useState(false);
  const [openMenuFornecedores, setOpenMenuFornecedores] = useState(false);
  const [fornecedoresTab, setFornecedoresTab] = useState<"fornecedores" | "contratos">("fornecedores");
  const [iaInitialTab, setIaInitialTab] = useState<"juridico" | "fundo_reserva" | "orcamentos" | "orcamento_anual_ia" | "cerebro_ia" | "comunicacoes_adenda" | undefined>(undefined); 
  const [viewMode, setViewMode] = useState<"BROWSER" | "PWA">("BROWSER");
  const [brandingColor, setBrandingColor] = useState<string>("emerald");
  const [whiteLabelLogo, setWhiteLabelLogo] = useState<string>(() => {
    return localStorage.getItem("whiteLabelLogo") || "";
  });

  // Layout Dynamic States (Mobile Drawer & Collapsible Central/Sidebar Area)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [simulatorBarCollapsed, setSimulatorBarCollapsed] = useState<boolean>(false);
  const [showTestingBar, setShowTestingBar] = useState<boolean>(() => {
    return localStorage.getItem("condomanager_show_testing_bar") === "true"; // default false for production cleanliness
  });

  // Route state
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    const path = window.location.pathname;
    const hash = window.location.hash;
    if (path === "/aistudio" || hash === "#/aistudio") return "/aistudio";
    if (path === "/dashboard" || hash === "#/dashboard") return "/dashboard";
    return path || "/";
  });

  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path === "/aistudio" || hash === "#/aistudio") setCurrentRoute("/aistudio");
      else if (path === "/dashboard" || hash === "#/dashboard") setCurrentRoute("/dashboard");
      else setCurrentRoute(path || "/");
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, []);

  // Helper function to switch sections and auto-close mobile sidebar drawer
  const selectSection = (section: string) => {
    setActiveSection(section);
    setViewMode("BROWSER");
    setIaInitialTab(undefined);
    setMobileMenuOpen(false);
  };

  // --------------------------------------------------------------------------
  // SESSION MANAGEMENT: IDLE TIMEOUT (30 MIN), HIJACKING & ROLE GUARD
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!loggedUser) return;

    // A. Role Navigation Guard
    const roleAccess = validateRoleAccess(loggedUser.role as UserRole, activeSection);
    if (!roleAccess.allowed) {
      console.warn(`[RoleGuard] Acesso negado Ã  secÃ§Ã£o '${activeSection}' para a funÃ§Ã£o '${loggedUser.role}'. Redirecionando para '${roleAccess.redirectTab}'.`);
      setActiveSection(roleAccess.redirectTab);
    }

    // B. Idle Activity Tracker (10-minute inactivity timeout for site + PWA)
    let lastRecordedActivity = 0;
    const handleUserInteraction = () => {
      const now = Date.now();
      if (now - lastRecordedActivity > 1500) {
        lastRecordedActivity = now;
        recordUserActivity();
      }
    };

    const interactionEvents = ["mousemove", "mousedown", "pointerdown", "click", "keydown", "touchstart", "touchmove", "scroll", "wheel"];
    interactionEvents.forEach(evt => window.addEventListener(evt, handleUserInteraction, { passive: true }));

    // C. Periodic Inactivity Session Check (Checks every 5 seconds)
    const sessionInterval = setInterval(() => {
      const val = validateSession(loggedUser.email, loggedUser.role as UserRole);
      if (!val.valid && val.shouldLogout) {
        handleSecureLogout(val.reason || "SessÃ£o expirada por inatividade.");
      }
    }, 5000);

    // D. Cross-Tab Logout Listener
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "condomanager_active_session" && !e.newValue) {
        handleSecureLogout("SessÃ£o encerrada noutro separador.");
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      interactionEvents.forEach(evt => window.removeEventListener(evt, handleUserInteraction));
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(sessionInterval);
    };
  }, [loggedUser, activeSection]);

  const handleSecureLogout = (reason?: string) => {
    purgeSession();
    setLoggedUser(null);
    setBrowserIsLoggedOut(true);
    setCurrentRoute("/");
    window.history.pushState({}, "", "/");
    if (reason) {
      setLoginErrorMessage(`â„¹ï¸ ${reason}`);
    } else {
      setLoginErrorMessage("SessÃ£o encerrada com sucesso.");
    }
  };

  const getColorClasses = (type: "bg" | "text" | "border" | "hoverBg" | "hoverText" | "bgLight") => {
    switch (brandingColor) {
      case "indigo":
        if (type === "bg") return "bg-indigo-600";
        if (type === "text") return "text-indigo-400";
        if (type === "border") return "border-indigo-600";
        if (type === "hoverBg") return "hover:bg-indigo-850";
        if (type === "hoverText") return "hover:text-indigo-400";
        if (type === "bgLight") return "bg-indigo-500/10";
        return "indigo";
      case "blue":
        if (type === "bg") return "bg-blue-600";
        if (type === "text") return "text-blue-400";
        if (type === "border") return "border-blue-600";
        if (type === "hoverBg") return "hover:bg-blue-800";
        if (type === "hoverText") return "hover:text-blue-400";
        if (type === "bgLight") return "bg-blue-500/10";
        return "blue";
      case "violet":
        if (type === "bg") return "bg-violet-600";
        if (type === "text") return "text-violet-400";
        if (type === "border") return "border-violet-600";
        if (type === "hoverBg") return "hover:bg-violet-800";
        if (type === "hoverText") return "hover:text-violet-400";
        if (type === "bgLight") return "bg-violet-500/10";
        return "violet";
      case "teal":
        if (type === "bg") return "bg-teal-600";
        if (type === "text") return "text-teal-400";
        if (type === "border") return "border-teal-600";
        if (type === "hoverBg") return "hover:bg-teal-850";
        if (type === "hoverText") return "hover:text-teal-400";
        if (type === "bgLight") return "bg-teal-500/10";
        return "teal";
      case "emerald":
      default:
        if (type === "bg") return "bg-emerald-500";
        if (type === "text") return "text-emerald-400";
        if (type === "border") return "border-emerald-500";
        if (type === "hoverBg") return "hover:bg-emerald-700";
        if (type === "hoverText") return "hover:text-emerald-400";
        if (type === "bgLight") return "bg-emerald-500/10";
        return "emerald";
    }
  };

  const handleProfileChange = (role: LoggedUser["role"]) => {
    let email = "carlos.adm@condomanager.pt";
    let nome = "Carlos Administrador";
    let section = "painel";

    if (role === "EMPRESA_GESTORA") {
      email = "contacto@gestaoforte.pt";
      nome = "GestÃ£o Forte AdministraÃ§Ãµes";
      section = "ficha_gestora";
    } else if (role === "USER") {
      email = "ana.silva@gmail.com";
      nome = "Ana Silva (FraÃ§Ã£o A - CondÃ³mino)";
      section = "portal_condomino";
    } else if (role === "INQUILINO") {
      email = "tiago.inquilino@gmail.com";
      nome = "Tiago Rocha (Inquilino FraÃ§Ã£o B)";
      section = "portal_condomino";
    } else if (role === "TECNICO") {
      email = "rui.melo@vistoriasegura.pt";
      nome = "Eng. Rui Melo";
      section = "manutencao_ocorrencias";
    } else if (role === "LIMPEZAS") {
      email = "maria.silva@limpezasestrela.pt";
      nome = "Maria Silva (Limpezas)";
      section = "vistorias_limpezas";
    } else if (role === "JURIDICO") {
      email = "dra.margarida@legalcondo.pt";
      nome = "Dra. Margarida Castro (JurÃ­dico)";
      section = "contencioso_juridico";
    } else if (role === "AUDITOR") {
      email = "antonio.auditor@auditchain.pt";
      nome = "Dr. AntÃ³nio Melo (Auditor)";
      section = "auditoria_interna";
    } else if (role === "CONTABILISTA") {
      email = "paula.contas@tcontabilidade.pt";
      nome = "Dra. Paula Silva (Contabilista)";
      section = "movimentos";
    }

    setLoggedUser({ role, email, nome });
    setActiveSection(section);
    setViewMode("BROWSER");
  }; 
  const [sidebarExpanded, setSidebarExpanded] = useState({
    administracao: true,
    operacoes: true,
    financeiro: true,
    condomino: true,
    documentacao: true,
    juridico: true,
    manutencao: true
  });

  const predioAtivo = predios.find(p => p.id_predio === activePredioId) || predios[0];

  const toggleSidebarSub = (menu: "administracao" | "operacoes" | "financeiro" | "condomino" | "documentacao" | "juridico" | "manutencao") => {
    setSidebarExpanded(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  const handleAddPredio = (novoPredio: Predio) => {
    setPredios([...predios, novoPredio]);
    setActivePredioId(novoPredio.id_predio);
  };

  const handleImportGlobalData = (predioData: Predio, fracoesData: Fracao[], avisosData: Aviso[]) => {
    setPredios(prev => [...prev, predioData]);
    setFracoes(prev => [...prev, ...fracoesData]);
    setAvisos(prev => [...prev, ...avisosData]);
    setActivePredioId(predioData.id_predio);
    setActiveSection("painel"); // Redirect to Dashboard of newly imported building!
  };

  const handleUpdatePredio = (updatedPredio: Predio) => {
    setPredios(predios.map(p => p.id_predio === updatedPredio.id_predio ? updatedPredio : p));
  };

  const handleDeletePredio = (idPredio: string) => {
    if (predios.length <= 1) {
      alert("NÃ£o Ã© possÃ­vel remover o Ãºnico prÃ©dio cadastrado no sistema.");
      return;
    }
    const filtered = predios.filter(p => p.id_predio !== idPredio);
    setPredios(filtered);
    if (activePredioId === idPredio) {
      setActivePredioId(filtered[0].id_predio);
    }
  };

  const handleAddFracao = (novaFracao: Fracao) => {
    setFracoes([...fracoes, novaFracao]);
  };

  const handleUpdateFracoes = (updatedFracoes: Fracao[]) => {
    setFracoes(updatedFracoes);
  };

  const handleAddFornecedor = (novoFornecedor: Fornecedor) => {
    setFornecedores([...fornecedores, novoFornecedor]);
  };

  const handleAddConta = (novaConta: Conta) => {
    let updatedContas = contas.map(c => {
      if (novaConta.is_principal && c.id_predio === novaConta.id_predio) {
        return { ...c, is_principal: false };
      }
      return c;
    });
    // If no other accounts exist for this building, default this first one to principal
    const hasOther = contas.some(c => c.id_predio === novaConta.id_predio);
    if (!hasOther) {
      novaConta.is_principal = true;
    }
    setContas([...updatedContas, novaConta]);
  };

  const handleSetPrincipalConta = (idConta: string) => {
    setContas(contas.map(c => {
      if (c.id_predio === activePredioId) {
        return { ...c, is_principal: c.id_conta === idConta };
      }
      return c;
    }));
  };

  const handleAddReuniao = (novaReuniao: Reuniao) => {
    setReunioes([...reunioes, novaReuniao]);
  };

  const handleAddOcorrencia = (novaOcorrencia: Ocorrencia) => {
    setOcorrencias([novaOcorrencia, ...ocorrencias]);
    // Alarm notification to internal administrators
    const adms = fracoes.filter(f => f.id_predio === activePredioId && f.administrador_interno === "Sim");
    adms.forEach(adm => {
      console.log(`[Alerta Push & E-mail] Enviado para Administrador Interno: ${adm.proprietario.nome} (${adm.proprietario.email}) - Nova ocorrÃªncia registada.`);
    });
    alert(`Alerta PWA disparado! Os Administradores Internos foram notificados por E-mail e Push sobre esta nova ocorrÃªncia.`);
  };

  const handleAddDocumento = (novoDoc: Documento) => {
    setDocumentos([novoDoc, ...documentos]);
  };

  const handleToggleUserRole = () => {
    handleProfileChange(loggedUser.role === "ADMIN" ? "USER" : "ADMIN");
  };

  if (browserIsLoggedOut) {
    const handleLoginFromTop = (emailInput?: string) => {
      const cleanEmail = (emailInput || "condomanagerai@gmail.com").trim().toLowerCase();
      const account = resolveUserByEmail(cleanEmail) || {
        role: "ADMIN" as const,
        nome: "Administrador do CondomÃ­nio",
        email: cleanEmail
      };
      setLoggedUser({ role: account.role, email: account.email, nome: account.nome });
      setBrowserIsLoggedOut(false);
      setCurrentRoute("/dashboard");
      window.history.pushState({}, "", "/dashboard");

      // Auto-open Security Menu on First Access / Provisional Password
      const isProvisional = typeof localStorage !== "undefined" && localStorage.getItem(`provisional_access_${cleanEmail}`) === "true";
      const isPasswordSet = typeof localStorage !== "undefined" && localStorage.getItem(`user_password_set_${cleanEmail}`) === "true";
      if (isProvisional || (!isPasswordSet && account.role === "USER")) {
        setTimeout(() => {
          setUserProfileModalOpen(true);
        }, 400);
      }
    };

    if (currentRoute === "/") {
      return <LayoutTop onLoginSuccess={handleLoginFromTop} />;
    }

    return (
    
    
      <div className={`h-screen w-screen flex flex-col items-center justify-center p-3 transition-all duration-300 ${theme === "dark" ? "bg-[#030712] text-slate-100" : "bg-slate-950 text-slate-100"}`}>
        <AuthForm
          initialEmail={browserEmail}
          initialErrorMessage={loginErrorMessage}
          onLoginSuccess={handleLoginFromTop}
          onOpenSecurityLogs={() => setSecurityModalOpen(true)}
        />
        <SecurityAuditModal
          isOpen={securityModalOpen}
          onClose={() => setSecurityModalOpen(false)}
          currentEmail={browserEmail}
          failedCount={0}
          isLocked={false}
        />
      </div>
    );
  }

  return (
    
    
    <div className={`h-screen w-screen flex overflow-hidden relative transition-all duration-300 ${theme === "dark" ? "bg-[#0b0f19] text-slate-100" : "bg-slate-50 text-slate-800"}`}>
      
      {/* OVERLAY SOMBREADO PARA MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300"
        />
      )}

      {/* BARRA LATERAL (MENU DINÃ‚MICO RECOLHÃVEL E COMPATÃVEL COM MOBILE) */}
      <aside className={`h-full flex flex-col select-none shrink-0 z-30 no-print transition-all duration-300 ${
        theme === "dark" ? "bg-[#030712] text-slate-300 border-r border-slate-900/50" : "bg-slate-900 text-slate-300"
      } ${
        mobileMenuOpen ? "fixed inset-y-0 left-0 w-72 translate-x-0 shadow-2xl z-50" : "fixed inset-y-0 left-0 -translate-x-full md:relative md:translate-x-0"
      } ${
        sidebarCollapsed ? "w-20 md:w-20" : "w-72 md:w-72"
      }`}>
        {/* Area do Logo - Limpa e Sem SobreposiÃ§Ãµes */}
        <div className="w-full border-b border-slate-800 shrink-0 overflow-hidden bg-slate-900/40">
          <div className="w-full h-20 flex items-center justify-center p-2 relative overflow-hidden">
            <div 
              onClick={() => selectSection("painel")}
              className="w-full h-full flex items-center justify-center cursor-pointer hover:opacity-95 transition-all duration-300 overflow-hidden px-1"
              title="Ir para a PÃ¡gina Inicial (Dashboard)"
            >
              <img 
                src={whiteLabelLogo || "/marca/18-versao-horizontal-1.png"} 
                alt="CondoManager AI" 
                className={`w-full h-full object-contain select-none transition-transform duration-300 drop-shadow-xl ${sidebarCollapsed ? "scale-90" : "scale-145 sm:scale-155 max-w-[290px]"}`} 
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>

        {/* Barra Dedicada Inferior para Recolher/Expandir Menu com 07-avancar.png */}
        <div className="w-full bg-slate-950/80 border-b border-slate-800/80 px-2.5 py-1.5 flex items-center justify-between shrink-0">
          {!sidebarCollapsed && (
            <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-slate-400 font-mono truncate pl-1">
              NavegaÃ§Ã£o
            </span>
          )}
          
          <div className={`flex items-center gap-1.5 ${sidebarCollapsed ? "w-full justify-center" : "ml-auto"}`}>
            {/* BotÃ£o Desktop com imagem 07-avancar.png */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex items-center justify-center p-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-all cursor-pointer shrink-0 shadow-md hover:scale-105 active:scale-95"
              title={sidebarCollapsed ? "Expandir Menu Lateral" : "Recolher Menu Lateral"}
            >
              <img 
                src="/estados-acoes/07-avancar.png" 
                alt="Alternar Menu" 
                className={`h-5 w-5 object-contain transition-transform duration-300 ${sidebarCollapsed ? "rotate-0" : "rotate-180"}`} 
              />
            </button>

            {/* Mobile Close Drawer */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden flex items-center justify-center h-7 w-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-all cursor-pointer shrink-0 shadow-xs"
              title="Fechar Menu"
            >
              <i className="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>
        </div>

        {/* Seletor de CondomÃ­nio Ativo */}
        <div className="px-3 py-2 border-b border-slate-800 shrink-0 bg-slate-950/40">
          {!sidebarCollapsed ? (
            <div>
              <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-extrabold font-mono mb-1">
                CondomÃ­nio Ativo
              </label>
              <div className="relative flex items-center">
                <select 
                  value={activePredioId}
                  onChange={(e) => setActivePredioId(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer appearance-none pr-7 font-semibold truncate shadow-inner"
                >
                  {predios.map(p => (
                    <option key={p.id_predio} value={p.id_predio}>{p.nome || `${p.morada_linha1} ${p.num_porta}`}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-slate-400">
                  <i className="fa-solid fa-chevron-down text-[10px]"></i>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 px-1 flex items-center">
                <i className="fa-solid fa-location-dot text-slate-500 mr-1 shrink-0"></i>
                <span className="truncate">{predioAtivo.morada_linha1} {predioAtivo.num_porta}, {predioAtivo.localidade}</span>
              </p>
            </div>
          ) : (
            <div className="flex justify-center py-1" title={`CondomÃ­nio Ativo: ${predioAtivo.nome || predioAtivo.morada_linha1}`}>
              <i className="fa-solid fa-building text-emerald-400 text-base"></i>
            </div>
          )}
        </div>

        {/* NavegaÃ§Ã£o */}
        <nav className="flex-grow px-3 py-4 space-y-1.5 overflow-y-auto">
          
          {/* 1. Dashboard Inicial */}
          <button 
            id="sidebar-item-dashboard"
            onClick={() => selectSection("painel")}
            className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2.5 ${
              activeSection === "painel" 
                ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500" 
                : "text-slate-400 hover:text-white hover:bg-slate-800/30"
            }`}
          >
            <img src="/modulos/53-estatisticas.png" alt="Dashboard" className="w-5 h-5 object-contain shrink-0" />
            <span className={`${sidebarCollapsed ? "lg:hidden" : ""}`}>Dashboard Inicial</span>
          </button>

          {/* 2. Registo de PrÃ©dio (Accordion ExpandÃ­vel) */}
          <div className="space-y-1">
            <button 
              id="sidebar-item-predios"
              onClick={() => {
                setOpenMenuPredios(!openMenuPredios);
                if (!["predios", "predios_cadastro", "predios_chaves", "predios_regras"].includes(activeSection)) {
                  setActiveSection("predios_cadastro");
                }
                setViewMode("BROWSER");
                setIaInitialTab(undefined);
              }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                ["predios", "predios_cadastro", "predios_chaves", "predios_regras"].includes(activeSection) 
                  ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img src="/modulos/01-predio.png" alt="PrÃ©dio" className="w-5 h-5 object-contain shrink-0" />
                <span className={`${sidebarCollapsed ? "lg:hidden" : ""}`}>Registo de PrÃ©dio</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${sidebarCollapsed ? "lg:hidden" : ""} ${openMenuPredios ? "rotate-180" : ""}`}></i>
            </button>

            {openMenuPredios && (
              <div className={`pl-6 space-y-1 border-l-2 border-emerald-500/40 ml-3.5 my-1 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
                <button
                  onClick={() => {
                    setActiveSection("predios_cadastro");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "predios_cadastro" || activeSection === "predios"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/01-predio.png" alt="Registos" className="w-4 h-4 object-contain shrink-0" />
                  <span>Registos & PatrimÃ³nio</span>
                </button>

                {["ADMIN", "EMPRESA_GESTORA", "GESTOR"].includes(loggedUser.role) && (
                  <button
                    onClick={() => {
                      setActiveSection("predios_chaves");
                      setViewMode("BROWSER");
                      setIaInitialTab(undefined);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                      activeSection === "predios_chaves" 
                        ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                        : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                    }`}
                  >
                    <i className="fa-solid fa-key text-amber-400 text-xs"></i>
                    <span>GestÃ£o de Chaves</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setActiveSection("predios_regras");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "predios_regras" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/03-regras-do-predio.png" alt="Regras" className="w-4 h-4 object-contain shrink-0" />
                  <span>Regras & Regulamento (IA)</span>
                </button>
              </div>
            )}
          </div>

          {/* 3. Registo de FraÃ§Ãµes (Accordion) */}
          <div className="space-y-1">
            <button 
              id="sidebar-item-fracoes"
              onClick={() => {
                setOpenMenuFracoes(!openMenuFracoes);
                if (!["fracoes", "fracoes_nova", "fracoes_proprietario", "fracoes_perfis"].includes(activeSection)) {
                  setActiveSection("fracoes");
                }
                setViewMode("BROWSER");
                setIaInitialTab(undefined);
              }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                ["fracoes", "fracoes_nova", "fracoes_proprietario", "fracoes_perfis"].includes(activeSection) 
                  ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img src="/modulos/07-fracao.png" alt="FraÃ§Ãµes" className="w-5 h-5 object-contain shrink-0" />
                <span>Registo de FraÃ§Ãµes</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openMenuFracoes ? "rotate-180" : ""}`}></i>
            </button>

            {openMenuFracoes && (
              <div className="pl-6 space-y-1 border-l-2 border-emerald-500/40 ml-3.5 my-1">
                <button
                  onClick={() => {
                    setActiveSection("fracoes_nova");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "fracoes_nova" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/08-piso.png" alt="Nova FraÃ§Ã£o" className="w-4 h-4 object-contain shrink-0" />
                  <span>Registar Nova FraÃ§Ã£o</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("fracoes_proprietario");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "fracoes_proprietario" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/11-proprietario.png" alt="ProprietÃ¡rio" className="w-4 h-4 object-contain shrink-0" />
                  <span>Registar ProprietÃ¡rio</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("fracoes_perfis");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "fracoes_perfis" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/17-documentos-pessoais.png" alt="Perfis" className="w-4 h-4 object-contain shrink-0" />
                  <span>Perfis de Acesso dos CondÃ³minos</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("gestao_sinistros");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "gestao_sinistros" || activeSection === "fracoes_sinistros"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-shield-halved text-amber-400 text-xs"></i>
                  <span>Seguros & Sinistros</span>
                </button>
              </div>
            )}
          </div>

          {/* 4. Mensagens (Accordion) */}
          <div className="space-y-1">
            <button 
              id="sidebar-item-comunicacao"
              onClick={() => {
                setOpenMenuComunicacoes(!openMenuComunicacoes);
                if (!["comunicacao_broadcast", "comunicacao_chat", "comunicacao_sondagens", "comunicacao_questionarios", "assembleias", "portal_condomino", "agendador_automatico", "agenda_notificacoes", "mural_reservas"].includes(activeSection)) {
                  setActiveSection("comunicacao_broadcast");
                }
                setViewMode("BROWSER");
                setIaInitialTab(undefined);
              }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                ["comunicacao_broadcast", "comunicacao_chat", "comunicacao_sondagens", "comunicacao_questionarios", "portal_condomino", "assembleias", "agendador_automatico", "agenda_notificacoes", "mural_reservas"].includes(activeSection)
                  ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img src="/modulos/73-mensagem-global.png" alt="Mensagens" className="w-5 h-5 object-contain shrink-0" />
                <span>Mensagens</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openMenuComunicacoes ? "rotate-180" : ""}`}></i>
            </button>

            {openMenuComunicacoes && (
              <div className="pl-6 space-y-1 border-l-2 border-emerald-500/40 ml-3.5 my-1">
                <button
                  onClick={() => {
                    setActiveSection("comunicacao_broadcast");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "comunicacao_broadcast" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/73-mensagem-global.png" alt="Comunicados" className="w-4 h-4 object-contain shrink-0" />
                  <span>Comunicados & Avisos (Gerais)</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("comunicacao_chat");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "comunicacao_chat" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/74-mensagem-individual.png" alt="Mensagens Diretas" className="w-4 h-4 object-contain shrink-0" />
                  <span>Mensagens & Inbox (Admin)</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("agenda_notificacoes");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "agenda_notificacoes" || activeSection === "agendador_automatico"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-calendar-check text-emerald-400 text-xs"></i>
                  <span>Agenda de NotificaÃ§Ãµes</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("mural_reservas");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "mural_reservas"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-chalkboard-user text-emerald-400 text-xs"></i>
                  <span>Mural & Reservas</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("portal_condomino");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "portal_condomino" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/75-mensagem.png" alt="Portal CondÃ³mino" className="w-4 h-4 object-contain shrink-0" />
                  <span>Portal & Mensagens CondÃ³mino</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("comunicacao_sondagens");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "comunicacao_sondagens" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/76-sondagem.png" alt="Sondagens" className="w-4 h-4 object-contain shrink-0" />
                  <span>Sondagens & VotaÃ§Ãµes</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("comunicacao_questionarios");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "comunicacao_questionarios" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/77-questionario.png" alt="QuestionÃ¡rios" className="w-4 h-4 object-contain shrink-0" />
                  <span>QuestionÃ¡rios & InquÃ©rito</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("assembleias");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "assembleias" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/80-pdf-de-resultados.png" alt="ReuniÃµes" className="w-4 h-4 object-contain shrink-0" />
                  <span>ReuniÃµes & ConvocatÃ³rias</span>
                </button>
              </div>
            )}
          </div>

          {/* 5. Ãrea Financeira (Accordion) */}
          <div className="space-y-1">
            <button 
              id="sidebar-item-financeiro"
              onClick={() => {
                setOpenMenuFinanceiro(!openMenuFinanceiro);
                if (!["movimentos", "financeiro_recibos", "financeiro_relatorios", "financeiro_extratos", "financeiro_quotas_mensais", "financeiro_quotas_extra"].includes(activeSection)) {
                  setActiveSection("movimentos");
                }
                setViewMode("BROWSER");
                setIaInitialTab(undefined);
              }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                ["movimentos", "financeiro_recibos", "financeiro_relatorios", "financeiro_extratos", "financeiro_quotas_mensais", "financeiro_quotas_extra"].includes(activeSection) 
                  ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img src="/modulos/57-quota.png" alt="Ãrea Financeira" className="w-5 h-5 object-contain shrink-0" />
                <span>Ãrea Financeira</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openMenuFinanceiro ? "rotate-180" : ""}`}></i>
            </button>

            {openMenuFinanceiro && (
              <div className="pl-6 space-y-1 border-l-2 border-emerald-500/40 ml-3.5 my-1">
                <button
                  onClick={() => {
                    setActiveSection("financeiro_recibos");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "financeiro_recibos" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/59-recibo.png" alt="Recibos" className="w-4 h-4 object-contain shrink-0" />
                  <span>EmissÃ£o de Recibos</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("movimentos");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "movimentos" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/63-lista-de-pagamentos.png" alt="Movimentos" className="w-4 h-4 object-contain shrink-0" />
                  <span>Registo de Movimentos</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("financeiro_relatorios");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "financeiro_relatorios" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/25-relatorio.png" alt="RelatÃ³rios" className="w-4 h-4 object-contain shrink-0" />
                  <span>RelatÃ³rios de DÃ­vidas</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("financeiro_extratos");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "financeiro_extratos" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/64-saldo.png" alt="Extrato" className="w-4 h-4 object-contain shrink-0" />
                  <span>Extrato de DÃ­vidas e Saldo</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("conciliacao");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "conciliacao" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/63-lista-de-pagamentos.png" alt="ConciliaÃ§Ã£o" className="w-4 h-4 object-contain shrink-0" />
                  <span>ConciliaÃ§Ã£o BancÃ¡ria (OFX/CSV)</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("ocr_faturas");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "ocr_faturas" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-file-invoice-dollar text-emerald-400 text-xs"></i>
                  <span>Leitor IA de Faturas & Anexos</span>
                </button>
              </div>
            )}
          </div>

          {/* 6. Limpezas (Accordion) */}
          <div className="space-y-1">
            <button 
              id="sidebar-item-limpezas"
              onClick={() => {
                setOpenMenuLimpezas(!openMenuLimpezas);
                if (!["vistorias_limpezas", "limpezas_incidencias"].includes(activeSection)) {
                  setActiveSection("vistorias_limpezas");
                }
                setViewMode("BROWSER");
                setIaInitialTab(undefined);
              }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                ["vistorias_limpezas", "limpezas_incidencias"].includes(activeSection) 
                  ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img src="/modulos/50-limpeza.png" alt="Limpezas" className="w-5 h-5 object-contain shrink-0" />
                <span>Limpezas</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openMenuLimpezas ? "rotate-180" : ""}`}></i>
            </button>

            {openMenuLimpezas && (
              <div className="pl-6 space-y-1 border-l-2 border-emerald-500/40 ml-3.5 my-1">
                <button
                  onClick={() => {
                    setActiveSection("vistorias_limpezas");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "vistorias_limpezas" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/50-limpeza.png" alt="Limpezas" className="w-4 h-4 object-contain shrink-0" />
                  <span>Limpezas & Agendamento</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("limpezas_incidencias");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "limpezas_incidencias" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/52-avaria-encontrada.png" alt="IncidÃªncias" className="w-4 h-4 object-contain shrink-0" />
                  <span>IncidÃªncias (enviadas pelas limpezas)</span>
                </button>
              </div>
            )}
          </div>

          {/* 7. Vistorias & IntervenÃ§Ãµes (Accordion) */}
          <div className="space-y-1">
            <button 
              id="sidebar-item-vistorias-intervencoes"
              onClick={() => {
                setOpenMenuVistoriasIntervencoes(!openMenuVistoriasIntervencoes);
                if (!["manutencao_ocorrencias", "ocorrencias", "limpezas_vistorias", "manutencao_intervencoes", "manutencao_concluidas", "manutencao_agenda", "manutencao_extraordinarias"].includes(activeSection)) {
                  setActiveSection("manutencao_ocorrencias");
                }
                setViewMode("BROWSER");
                setIaInitialTab(undefined);
              }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                ["manutencao_ocorrencias", "ocorrencias", "limpezas_vistorias", "manutencao_intervencoes", "manutencao_concluidas", "manutencao_agenda", "manutencao_extraordinarias"].includes(activeSection)
                  ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img src="/modulos/28-intervencao.png" alt="Vistorias & IntervenÃ§Ãµes" className="w-5 h-5 object-contain shrink-0" />
                <span>Vistorias & IntervenÃ§Ãµes</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openMenuVistoriasIntervencoes ? "rotate-180" : ""}`}></i>
            </button>

            {openMenuVistoriasIntervencoes && (
              <div className="pl-6 space-y-1 border-l-2 border-emerald-500/40 ml-3.5 my-1">
                <button
                  onClick={() => {
                    setActiveSection("manutencao_ocorrencias");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "manutencao_ocorrencias" || activeSection === "ocorrencias" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/29-avaria.png" alt="OcorrÃªncias" className="w-4 h-4 object-contain shrink-0" />
                  <span>OcorrÃªncias</span>
                </button>

                <button
                  onClick={() => {
                    setActiveSection("limpezas_vistorias");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "limpezas_vistorias" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/02-equipamentos-tecnicos.png" alt="Vistoria TÃ©cnica" className="w-4 h-4 object-contain shrink-0" />
                  <span>Vistoria TÃ©cnica</span>
                </button>

                <button
                  onClick={() => {
                    setActiveSection("manutencao_intervencoes");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "manutencao_intervencoes" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/28-intervencao.png" alt="IntervenÃ§Ãµes" className="w-4 h-4 object-contain shrink-0" />
                  <span>IntervenÃ§Ãµes (ReparaÃ§Ãµes)</span>
                </button>

                <button
                  onClick={() => {
                    setActiveSection("manutencao_concluidas");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "manutencao_concluidas" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/39-intervencao-concluida.png" alt="ConcluÃ­das" className="w-4 h-4 object-contain shrink-0" />
                  <span>IntervenÃ§Ãµes ConcluÃ­das</span>
                </button>

                <button
                  onClick={() => {
                    setActiveSection("manutencao_agenda");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "manutencao_agenda" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/30-equipamento.png" alt="Agenda" className="w-4 h-4 object-contain shrink-0" />
                  <span>Agenda de ManutenÃ§Ã£o</span>
                </button>

                <button
                  onClick={() => {
                    setActiveSection("manutencao_extraordinarias");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "manutencao_extraordinarias" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/41-obra.png" alt="Obras" className="w-4 h-4 object-contain shrink-0" />
                  <span>IntervenÃ§Ãµes ExtraordinÃ¡rias (Obras)</span>
                </button>
              </div>
            )}
          </div>

          {/* 8. Fornecedores (Accordion) */}
          <div className="space-y-1">
            <button 
              id="sidebar-item-fornecedores"
              onClick={() => {
                setOpenMenuFornecedores(!openMenuFornecedores);
                if (activeSection !== "fornecedores") {
                  setActiveSection("fornecedores");
                }
                setViewMode("BROWSER");
                setIaInitialTab(undefined);
              }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                activeSection === "fornecedores" 
                  ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img src="/modulos/67-fornecedor.png" alt="Fornecedores" className="w-5 h-5 object-contain shrink-0" />
                <span>Fornecedores</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openMenuFornecedores ? "rotate-180" : ""}`}></i>
            </button>

            {openMenuFornecedores && (
              <div className="pl-6 space-y-1 border-l-2 border-emerald-500/40 ml-3.5 my-1">
                <button
                  onClick={() => {
                    setActiveSection("fornecedores");
                    setFornecedoresTab("fornecedores");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "fornecedores" && fornecedoresTab === "fornecedores" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-handshake text-emerald-400 text-xs"></i>
                  <span>Parceiros registados</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("fornecedores");
                    setFornecedoresTab("contratos");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "fornecedores" && fornecedoresTab === "contratos" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-file-contract text-emerald-400 text-xs"></i>
                  <span>ServiÃ§os contratados</span>
                </button>
              </div>
            )}
          </div>

          {/* 9. ReuniÃµes & ConvocatÃ³rias */}
          <button 
            id="sidebar-item-assembleias"
            onClick={() => {
              setActiveSection("assembleias");
              setViewMode("BROWSER");
              setIaInitialTab(undefined);
            }}
            className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
              activeSection === "assembleias"
                ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500"
                : "text-slate-400 hover:text-white hover:bg-slate-800/30"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <img src="/modulos/80-pdf-de-resultados.png" alt="ReuniÃµes" className="w-5 h-5 object-contain shrink-0" />
              <span>ReuniÃµes & ConvocatÃ³rias</span>
            </div>
            <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-black rounded px-1.5 py-0.5 border border-emerald-500/30">
              IA
            </span>
          </button>

          {/* 10. Ãrea JurÃ­dica (Accordion) */}
          <div className="space-y-1">
            <button 
              id="sidebar-item-juridico-ai"
              onClick={() => {
                setOpenMenuJuridico(!openMenuJuridico);
                if (!["contencioso_juridico", "contencioso_juridico_processos", "contencioso_juridico_nd", "contencioso_juridico_doc_obrig", "contencioso_juridico_cartas", "contencioso_juridico_bni", "contencioso_juridico_regulamento", "contencioso_juridico_estatutos", "contencioso_juridico_ia"].includes(activeSection)) {
                  setActiveSection("contencioso_juridico");
                }
                setViewMode("BROWSER");
                setIaInitialTab(undefined);
              }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                ["contencioso_juridico", "contencioso_juridico_processos", "contencioso_juridico_nd", "contencioso_juridico_doc_obrig", "contencioso_juridico_cartas", "contencioso_juridico_bni", "contencioso_juridico_regulamento", "contencioso_juridico_estatutos", "contencioso_juridico_ia"].includes(activeSection)
                  ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img src="/modulos/23-contrato.png" alt="Ãrea JurÃ­dica" className="w-5 h-5 object-contain shrink-0" />
                <span>Ãrea JurÃ­dica</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openMenuJuridico ? "rotate-180" : ""}`}></i>
            </button>

            {openMenuJuridico && (
              <div className="pl-6 space-y-1 border-l-2 border-emerald-500/40 ml-3.5 my-1">
                <button
                  onClick={() => {
                    setActiveSection("contencioso_juridico");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "contencioso_juridico" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/22-documento-geral.png" alt="Contencioso" className="w-4 h-4 object-contain shrink-0" />
                  <span>Resumo de Contencioso</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("contencioso_juridico_processos");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "contencioso_juridico_processos" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/23-contrato.png" alt="Processos & Provas" className="w-4 h-4 object-contain shrink-0" />
                  <span>Processos & Provas Judiciais</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("contencioso_juridico_nd");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "contencioso_juridico_nd" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/23-contrato.png" alt="Carta de NÃ£o DÃ­vida" className="w-4 h-4 object-contain shrink-0" />
                  <span>Carta de NÃ£o DÃ­vida</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("contencioso_juridico_doc_obrig");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "contencioso_juridico_doc_obrig" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/15-documentos-da-fracao.png" alt="Documentos" className="w-4 h-4 object-contain shrink-0" />
                  <span>Documentos ObrigatÃ³rios</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("contencioso_juridico_cartas");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "contencioso_juridico_cartas" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/60-nota-de-cobranca.png" alt="CobranÃ§a" className="w-4 h-4 object-contain shrink-0" />
                  <span>Carta de CobranÃ§a</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("contencioso_juridico_bni");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "contencioso_juridico_bni" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/23-contrato.png" alt="InjunÃ§Ã£o" className="w-4 h-4 object-contain shrink-0" />
                  <span>InjunÃ§Ã£o Judicial</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("contencioso_juridico_regulamento");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "contencioso_juridico_regulamento" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/03-regras-do-predio.png" alt="Regulamento" className="w-4 h-4 object-contain shrink-0" />
                  <span>Regulamento Interno</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("contencioso_juridico_estatutos");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "contencioso_juridico_estatutos" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/03-regras-do-predio.png" alt="Estatutos" className="w-4 h-4 object-contain shrink-0" />
                  <span>Estatutos do PrÃ©dio</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("contencioso_juridico_ia");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "contencioso_juridico_ia" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/82-automacao.png" alt="Assistente IA" className="w-4 h-4 object-contain shrink-0" />
                  <span>Assistente IA</span>
                </button>
              </div>
            )}
          </div>

          {/* 11. Consultoria IA (Accordion) */}
          <div className="space-y-1">
            <button 
              id="sidebar-item-ia-export"
              onClick={() => {
                setOpenMenuConsultoriaIA(!openMenuConsultoriaIA);
                if (activeSection !== "ia_avancada") {
                  setActiveSection("ia_avancada");
                  setIaInitialTab("orcamento_anual_ia");
                }
                setViewMode("BROWSER");
              }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                activeSection === "ia_avancada"
                  ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img src="/modulos/87-ia-ativa.png" alt="Consultoria IA" className="w-5 h-5 object-contain shrink-0" />
                <span>Consultoria IA</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openMenuConsultoriaIA ? "rotate-180" : ""}`}></i>
            </button>

            {openMenuConsultoriaIA && (
              <div className="pl-6 space-y-1 border-l-2 border-emerald-500/40 ml-3.5 my-1">
                <button
                  onClick={() => {
                    setActiveSection("ia_avancada");
                    setIaInitialTab("orcamento_anual_ia");
                    setViewMode("BROWSER");
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "ia_avancada" && iaInitialTab === "orcamento_anual_ia" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-wand-magic-sparkles text-emerald-400 text-xs"></i>
                  <span>OrÃ§amentos & ProjecÃ§Ãµes</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("ia_avancada");
                    setIaInitialTab("juridico");
                    setViewMode("BROWSER");
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "ia_avancada" && iaInitialTab === "juridico" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-scale-balanced text-emerald-400 text-xs"></i>
                  <span>Assistente JurÃ­dico</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("ia_avancada");
                    setIaInitialTab("fundo_reserva");
                    setViewMode("BROWSER");
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "ia_avancada" && iaInitialTab === "fundo_reserva" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-chart-line text-emerald-400 text-xs"></i>
                  <span>Simulador Fundo Reserva</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("ia_avancada");
                    setIaInitialTab("orcamentos");
                    setViewMode("BROWSER");
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "ia_avancada" && iaInitialTab === "orcamentos" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-handshake-angle text-emerald-400 text-xs"></i>
                  <span>Bolsa de OrÃ§amentos</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("ia_avancada");
                    setIaInitialTab("cerebro_ia");
                    setViewMode("BROWSER");
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "ia_avancada" && iaInitialTab === "cerebro_ia" 
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-brain text-emerald-400 text-xs"></i>
                  <span>Analista IA (DocFG)</span>
                </button>
              </div>
            )}
          </div>

          {/* 12. Minutas Oficiais & E-mails (NOVO) */}
          <button 
            id="sidebar-item-minutas-oficiais"
            onClick={() => {
              setActiveSection("minutas_oficiais");
              setViewMode("BROWSER");
              setIaInitialTab(undefined);
            }}
            className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
              activeSection === "minutas_oficiais" || activeSection === "simulador_emails"
                ? "bg-indigo-600 text-white font-extrabold shadow-sm border border-indigo-500"
                : "text-slate-400 hover:text-white hover:bg-slate-800/30"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <i className="fa-solid fa-file-signature w-5 text-center text-indigo-400 text-sm"></i>
              <span>Minutas & E-mails</span>
            </div>
            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black rounded-full px-1.5 py-0.5 border border-indigo-400/30 shadow-xs flex items-center justify-center min-w-[20px] h-5">
              5 Docs
            </span>
          </button>

          {/* 13. Arranque & Saldos Iniciais (NOVO) */}
          {["ADMIN", "EMPRESA_GESTORA", "GESTOR"].includes(loggedUser.role) && (
            <button 
              id="sidebar-item-arranque-saldos"
              onClick={() => {
                setActiveSection("configuracao_arranque");
                setViewMode("BROWSER");
                setIaInitialTab(undefined);
              }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                activeSection === "configuracao_arranque"
                  ? "bg-amber-500 text-slate-950 font-black shadow-sm border border-amber-400"
                  : "text-amber-400/90 hover:text-amber-300 hover:bg-amber-950/30 border border-amber-900/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <i className="fa-solid fa-sliders w-5 text-center text-amber-400 text-sm"></i>
                <span>Arranque & Saldos</span>
              </div>
              <span className="bg-amber-400/20 text-amber-300 text-[9px] font-black rounded-md px-1.5 py-0.5 border border-amber-400/30">
                TransiÃ§Ã£o
              </span>
            </button>
          )}

          {/* 14. Arquivo */}
          <button 
            id="sidebar-item-arquivo"
            onClick={() => {
              setActiveSection("arquivo");
              setViewMode("BROWSER");
              setIaInitialTab(undefined);
            }}
            className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
              activeSection === "arquivo" || activeSection === "documentos"
                ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500"
                : "text-slate-400 hover:text-white hover:bg-slate-800/30"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <img src="/modulos/27-arquivo-automatico.png" alt="Arquivo" className="w-5 h-5 object-contain shrink-0" />
              <span>Arquivo</span>
            </div>
            <span className="bg-emerald-600/80 text-white text-[10px] font-black rounded-full px-1.5 py-0.5 border border-emerald-400/30 shadow-md flex items-center justify-center min-w-[20px] h-5">
              3
            </span>
          </button>

          {/* 13. Registo Empresa Gestora */}
          {["ADMIN", "EMPRESA_GESTORA"].includes(loggedUser.role) && (
            <button 
              id="sidebar-item-ficha-gestora"
              onClick={() => {
                setActiveSection("ficha_gestora");
                setViewMode("BROWSER");
                setIaInitialTab(undefined);
              }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2.5 ${
                activeSection === "ficha_gestora" 
                  ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              }`}
            >
              <img src="/modulos/17-documentos-pessoais.png" alt="Empresa Gestora" className="w-5 h-5 object-contain shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <i className="fa-solid fa-briefcase w-5 text-center text-emerald-400 text-sm"></i>
              <span>Registo Empresa Gestora</span>
            </button>
          )}

          {/* 14. SeguranÃ§a & Credenciais (Ãšltimo lugar da coluna central/sidebar) */}
          <button 
            id="sidebar-item-seguranca"
            onClick={() => setUserProfileModalOpen(true)}
            className="w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 text-emerald-400 hover:text-white hover:bg-slate-800/40 border border-slate-800/80 hover:border-emerald-500/40 bg-slate-900/60 shadow-xs group"
          >
            <div className="flex items-center gap-2.5">
              <img src="/estados-acoes/18-seguranca.png" alt="SeguranÃ§a" className="w-5 h-5 object-contain shrink-0 group-hover:scale-110 transition-transform" />
              <span className="font-extrabold">SeguranÃ§a & Acessos</span>
            </div>
            <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-black rounded-md px-1.5 py-0.5 border border-emerald-500/30">
              Ativo
            </span>
          </button>

        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 space-y-2">
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">DefiniÃ§Ãµes</span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setTheme(prev => prev === "light" ? "dark" : "light")}
                  className="text-[8px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded px-1 py-0.5 font-bold cursor-pointer flex items-center"
                  title="Alternar Tema de Cores"
                >
                  {theme === "light" ? (
                    <>
                      <i className="fa-solid fa-sun mr-1 text-amber-400"></i> Claro
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-moon mr-1 text-indigo-400"></i> Escuro
                    </>
                  )}
                </button>
                <button 
                  onClick={handleToggleUserRole}
                  className="text-[8px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded px-1 py-0.5 font-bold tracking-tight cursor-pointer"
                >
                  PAPEL
                </button>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
            <div className="flex items-center space-x-2 overflow-hidden">
              <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold border border-slate-700 shrink-0" title={loggedUser.nome}>
                <i className="fa-solid fa-user-shield text-[10px]"></i>
              </div>
              {!sidebarCollapsed && (
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-white truncate leading-tight">{loggedUser.nome}</p>
                  <p className="text-[9px] text-emerald-400 font-bold tracking-tight leading-tight">{loggedUser.role} Mode</p>
                </div>
              )}
            </div>
            <button 
              onClick={() => handleSecureLogout()}
              className="p-1 bg-red-900/80 hover:bg-red-600 active:bg-red-700 active:scale-95 text-white border border-red-600/80 hover:border-red-400 rounded-xl transition-all cursor-pointer shrink-0 shadow-md hover:scale-105 flex items-center justify-center min-w-[32px] min-h-[32px]"
              title="Sair da Conta (Desligar)"
            >
              <img src="/estados-acoes/17-desligar.png" alt="Sair" className="h-5 w-5 object-contain" />
            </button>
          </div>
        </div>
      </aside>

      {/* ÃREA DE TRABALHO PRINCIPAL (ADAPTÃVEL A MOBILE E DESKTOP) */}
      <main className={`flex-1 min-w-0 flex flex-col h-full overflow-hidden relative transition-all duration-300 ${theme === "dark" ? "bg-[#0b0f19]" : "bg-slate-50"}`}>
        {/* Header superior */}
        <header className={`h-16 px-3 sm:px-6 md:px-8 flex items-center justify-between shrink-0 z-10 no-print transition-all duration-300 ${theme === "dark" ? "bg-[#111827] border-b border-slate-800 text-slate-100" : "bg-white border-b border-slate-200 text-slate-800"}`}>
          <div className="flex items-center space-x-2 sm:space-x-3 overflow-hidden pr-2">
            {/* BotÃ£o de Menu Mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-emerald-400 border border-slate-700 flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer shrink-0 shadow-sm"
              title="Abrir / Fechar Menu de NavegaÃ§Ã£o"
            >
              <i className={`fa-solid ${mobileMenuOpen ? "fa-xmark" : "fa-bars"} text-sm`}></i>
              <span className="hidden sm:inline">Menu</span>
            </button>

            <div className="overflow-hidden">
              <h2 className={`text-xs sm:text-base md:text-xl font-bold transition-colors duration-300 truncate ${theme === "dark" ? "text-white" : "text-slate-800"}`}>
                {activeSection === "painel" && "Painel de Controlo"}
                {activeSection === "predios" && "Registo de PrÃ©dio"}
                {(activeSection === "fracoes" || activeSection === "fracoes_nova" || activeSection === "fracoes_proprietario" || activeSection === "fracoes_perfis") && "GestÃ£o de FraÃ§Ãµes, ProprietÃ¡rios & Perfis"}
                {activeSection === "fornecedores" && "Fichas de Fornecedores"}
                {activeSection === "contas" && "Contas BancÃ¡rias do CondomÃ­nio"}
                {activeSection === "emissao" && "EmissÃ£o de Avisos e OrÃ§amentos"}
                {activeSection === "movimentos" && "Registo de Movimentos Financeiros"}
                {activeSection === "financeiro_recibos" && "EmissÃ£o de Recibos Manuais (100% EditÃ¡vel)"}
                {activeSection === "financeiro_relatorios" && "RelatÃ³rios de DÃ­vidas (por CondÃ³mino & Pro CondomÃ­nio)"}
                {activeSection === "financeiro_extratos" && "Extrato de Movimentos e Saldo (VisÃ£o CondÃ³mino)"}
                {activeSection === "financeiro_quotas_mensais" && "Mapa de Quotas Mensais de CondomÃ­nio"}
                {activeSection === "financeiro_quotas_extra" && "Quotas ExtraordinÃ¡rias & Fundos Especiais"}
                {activeSection === "conciliacao" && "Motor de InteligÃªncia Artificial para ConciliaÃ§Ã£o"}
                {activeSection === "assembleias" && "ReuniÃµes e ConvocatÃ³rias (Elaboradas Manualmente ou com AuxÃ­lio de IA)"}
                {activeSection === "reservas" && "Agenda & Reservas de EspaÃ§os Comuns"}
                {(activeSection === "documentos" || activeSection === "arquivo") && "Arquivo Digital (Anos & Temas)"}
                {activeSection === "ocorrencias" && "GestÃ£o de OcorrÃªncias e Avarias"}
                {(activeSection === "vistorias_limpezas" || activeSection === "limpezas_vistorias") && "Limpezas & Vistorias TÃ©cnicas"}
                {activeSection === "ia_avancada" && "Central de InteligÃªncia Artificial AvanÃ§ada"}
                {activeSection === "ia_importacao" && "Assistente de ImportaÃ§Ã£o Global por IA (PDF/XLS)"}
                {activeSection === "contencioso_juridico" && "Resumo de Contencioso & Prazos Legais"}
                {activeSection === "contencioso_juridico_processos" && "ConstituiÃ§Ã£o de Processos Judiciais & Acervo ProbatÃ³rio"}
                {activeSection === "contencioso_juridico_nd" && "Carta de NÃ£o DÃ­vida (Art. 54.Âº-A do DL 268/94)"}
                {activeSection === "contencioso_juridico_doc_obrig" && "Documentos ObrigatÃ³rios do CondomÃ­nio"}
                {activeSection === "contencioso_juridico_cartas" && "Carta de CobranÃ§a (NotificaÃ§Ã£o AR Regimental)"}
                {activeSection === "contencioso_juridico_bni" && "InjunÃ§Ã£o Judicial Civil & Requerimento BNI"}
                {activeSection === "contencioso_juridico_regulamento" && "Regulamento Interno do EdifÃ­cio"}
                {activeSection === "contencioso_juridico_estatutos" && "Estatutos do PrÃ©dio & Propriedade Horizontal"}
                {activeSection === "contencioso_juridico_ia" && "Assistente IA de Contencioso & Minutas Legais"}
                {activeSection === "obras_futuras" && "Obras Futuras & Fundo ExtraordinÃ¡rio"}
                {activeSection === "ficha_gestora" && "Ficha da Empresa Gestora (White-Label)"}
                {activeSection === "portal_condomino" && "Portal do CondÃ³mino & Perfis"}
                {activeSection === "portal_orcamentos" && "Portal de OrÃ§amentos de Fornecedores"}
                {activeSection === "dashboard_kpis" && "Dashboard de KPIs do PrÃ©dio"}
                {activeSection === "multi_condominio" && "Portal Multi-CondomÃ­nio Integrado"}
                {activeSection === "configuracoes_gerais" && "ConfiguraÃ§Ãµes Gerais do CondomÃ­nio"}
                {activeSection === "configuracoes_ia" && "ConfiguraÃ§Ãµes do Assistente IA e E-mail"}
                {activeSection === "configuracoes_notificacoes" && "ConfiguraÃ§Ãµes de NotificaÃ§Ãµes Push & E-mail"}
                {activeSection === "inventario_tecnico" && "InventÃ¡rio TÃ©cnico e Arquitetura do PrÃ©dio"}
                {activeSection === "manutencao_ocorrencias" && "OcorrÃªncias & Avarias Reportadas"}
                {activeSection === "manutencao_agenda" && "Agenda de ManutenÃ§Ã£o & Vistorias"}
                {activeSection === "manutencao_intervencoes" && "IntervenÃ§Ãµes (Pequenas ReparaÃ§Ãµes)"}
                {activeSection === "manutencao_extraordinarias" && "IntervenÃ§Ãµes ExtraordinÃ¡rias (Grandes Obras)"}
                {activeSection === "manutencao_concluidas" && "HistÃ³rico de ManutenÃ§Ãµes ConcluÃ­das"}
                {activeSection === "manutencao_arquivo" && "Arquivo Documental Registado"}
              </h2>
              <p className={`text-[10px] sm:text-xs transition-colors duration-300 truncate ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                Isolamento Multi-PrÃ©dio: {predioAtivo.nome || `${predioAtivo.morada_linha1} ${predioAtivo.num_porta}`}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
            <span className={`hidden sm:inline-block text-[11px] font-mono-custom font-medium px-2 py-0.5 rounded border transition-colors duration-300 ${theme === "dark" ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
              NIF: {predioAtivo.nif}
            </span>
            <div className={`hidden sm:block h-6 w-px transition-colors duration-300 ${theme === "dark" ? "bg-slate-800" : "bg-slate-200"}`}></div>
            <span className={`hidden md:flex text-[11px] ${getColorClasses("bgLight")} ${getColorClasses("text")} font-semibold px-2 py-0.5 rounded border ${getColorClasses("border")} items-center transition-all duration-300`}>
              <span className={`h-1.5 w-1.5 rounded-full ${getColorClasses("bg")} mr-1 animate-pulse`}></span>
              {loggedUser.role === "ADMIN" ? "ðŸ‘‘ Admin" : 
               loggedUser.role === "EMPRESA_GESTORA" ? "ðŸ¢ Gestora" :
               loggedUser.role === "USER" ? "ðŸ  CondÃ³mino" :
               loggedUser.role === "INQUILINO" ? "ðŸ”‘ Inquilino" :
               loggedUser.role === "TECNICO" ? "ðŸ” TÃ©cnico" :
               loggedUser.role === "LIMPEZAS" ? "ðŸ§¹ Limpezas" : 
               loggedUser.role === "JURIDICO" ? "âš–ï¸ JurÃ­dico" :
               loggedUser.role === "AUDITOR" ? "ðŸ•µï¸ Auditor" : "ðŸ“ˆ Contabilista"}
            </span>

            <button
              id="header-btn-logout"
              onClick={() => handleSecureLogout()}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border border-red-500 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-sm hover:scale-105 active:scale-95 shrink-0"
              title="Terminar SessÃ£o (Voltar ao EcrÃ£ Inicial)"
            >
              <img src="/estados-acoes/17-desligar.png" alt="Sair" className="h-5 w-5 object-contain shrink-0" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        {/* PAINEL DE CONTROLO DO SIMULADOR E PERFIS (CONDICIONADO AO MODO DE TESTES ATIVADO NO MENU SEGURANÃ‡A) */}
        {showTestingBar && (
          <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 md:px-8 py-2 md:py-3.5 no-print shrink-0 transition-colors duration-300">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                <span className="text-[10px] font-black tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                  Seletor de Perfil & Simulador PWA (Modo de Teste)
                </span>
              </div>
              
              <button
                onClick={() => setSimulatorBarCollapsed(!simulatorBarCollapsed)}
                className="p-1 px-2.5 text-[10px] font-bold rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border border-slate-300 dark:border-slate-700 shadow-xs"
                title={simulatorBarCollapsed ? "Expandir Seletor de Perfis" : "Recolher Seletor de Perfis"}
              >
                <span>{simulatorBarCollapsed ? "Expandir Painel" : "Recolher Painel"}</span>
                <i className={`fa-solid ${simulatorBarCollapsed ? "fa-chevron-down" : "fa-chevron-up"} text-[9px]`}></i>
              </button>
            </div>

            {!simulatorBarCollapsed && (
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
                {/* View Mode Toggle */}
                <div className="flex items-center space-x-2 bg-white dark:bg-slate-950 p-1 rounded-xl border dark:border-slate-800/80 shadow-sm text-xs">
                  <button
                    onClick={() => setViewMode("BROWSER")}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-colors cursor-pointer ${viewMode === "BROWSER" ? "bg-slate-900 dark:bg-slate-800 text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                  >
                    <i className="fa-solid fa-desktop text-[11px]"></i>
                    <span>ðŸ’» Navegador Web</span>
                  </button>
                  <button
                    onClick={() => setViewMode("PWA")}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-colors cursor-pointer ${viewMode === "PWA" ? `${getColorClasses("bg")} text-white` : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                  >
                    <i className="fa-solid fa-mobile-screen text-[11px]"></i>
                    <span>ðŸ“± Simulador PWA</span>
                  </button>
                </div>

                {/* Profiles selector */}
                <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-slate-950 p-1.5 rounded-xl border dark:border-slate-800/80 shadow-sm text-[10px] font-bold max-w-full overflow-x-auto">
                  <button 
                    onClick={() => handleProfileChange("ADMIN")}
                    className={`px-2 py-1 rounded transition-all cursor-pointer ${loggedUser.role === "ADMIN" ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                    title="Administrador (Empresa Gestora) - Perfil MÃ¡ximo"
                  >
                    ðŸ‘‘ Admin
                  </button>
                  <button 
                    onClick={() => handleProfileChange("EMPRESA_GESTORA")}
                    className={`px-2 py-1 rounded transition-all cursor-pointer ${loggedUser.role === "EMPRESA_GESTORA" ? "bg-violet-600 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                    title="Empresa Gestora - Perfil MÃ¡ximo de Backoffice"
                  >
                    ðŸ¢ Gestora
                  </button>
                  <button 
                    onClick={() => handleProfileChange("USER")}
                    className={`px-2 py-1 rounded transition-all cursor-pointer ${loggedUser.role === "USER" ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                    title="CondÃ³mino (ProprietÃ¡rio) - PWA + Backoffice Limitado"
                  >
                    ðŸ  CondÃ³mino
                  </button>
                  <button 
                    onClick={() => handleProfileChange("INQUILINO")}
                    className={`px-2 py-1 rounded transition-all cursor-pointer ${loggedUser.role === "INQUILINO" ? "bg-amber-600 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                    title="Inquilino / ArrendatÃ¡rio - Sem acesso a dados financeiros"
                  >
                    ðŸ”‘ Inquilino
                  </button>
                  <button 
                    onClick={() => handleProfileChange("TECNICO")}
                    className={`px-2 py-1 rounded transition-all cursor-pointer ${loggedUser.role === "TECNICO" ? "bg-amber-600 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                    title="TÃ©cnico de ManutenÃ§Ã£o - PWA + Backoffice Limitado"
                  >
                    ðŸ” TÃ©cnico
                  </button>
                  <button 
                    onClick={() => handleProfileChange("LIMPEZAS")}
                    className={`px-2 py-1 rounded transition-all cursor-pointer ${loggedUser.role === "LIMPEZAS" ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                    title="Empresa de Limpeza - PWA Limitado"
                  >
                    ðŸ§¹ Limpezas
                  </button>
                  <button 
                    onClick={() => handleProfileChange("JURIDICO")}
                    className={`px-2 py-1 rounded transition-all cursor-pointer ${loggedUser.role === "JURIDICO" ? "bg-red-600 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                    title="Perfil JurÃ­dico - Contencioso e Contratos"
                  >
                    âš–ï¸ JurÃ­dico
                  </button>
                  <button 
                    onClick={() => handleProfileChange("AUDITOR")}
                    className={`px-2 py-1 rounded transition-all cursor-pointer ${loggedUser.role === "AUDITOR" ? "bg-indigo-500 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                    title="Auditor Interno (Opcional) - Apenas Consulta"
                  >
                    ðŸ•µï¸ Auditor
                  </button>
                  <button 
                    onClick={() => handleProfileChange("CONTABILISTA")}
                    className={`px-2 py-1 rounded transition-all cursor-pointer ${loggedUser.role === "CONTABILISTA" ? "bg-rose-500 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                    title="Contabilista (Opcional) - ValidaÃ§Ã£o e Extratos"
                  >
                    ðŸ“ˆ Contabilista
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ConteÃºdo DinÃ¢mico (Responsivo para TelemÃ³veis e Desktops) */}
        <div className="flex-grow p-3 sm:p-5 md:p-8 overflow-y-auto">
          {viewMode === "PWA" ? (
            <PWASimulator 
              predio={predioAtivo}
              fracoes={fracoes}
              setFracoes={setFracoes}
              avisos={avisos}
              setAvisos={setAvisos}
              movements={movements}
              setMovements={setMovements}
              reservas={reservas}
              setReservas={setReservas}
              ocorrencias={ocorrencias}
              setOcorrencias={setOcorrencias}
              documentos={documentos}
              setDocumentos={setDocumentos}
              loggedUser={loggedUser}
              setLoggedUser={setLoggedUser}
              theme={theme}
              contas={contas}
              setContas={setContas}
              fornecedores={fornecedores}
              setFornecedores={setFornecedores}
              reunioes={reunioes}
              setReunioes={setReunioes}
              capacidades={capacidades}
              setCapacidades={setCapacidades}
            />
          ) : (
            <>
              {activeSection === "ficha_gestora" && (
                <FichaEmpresaGestora 
                  predios={predios}
                  loggedUser={loggedUser}
                  onUpdateBrandingColor={setBrandingColor}
                  activeColor={brandingColor}
                  onUpdateBrandingLogo={setWhiteLabelLogo}
                  activeLogo={whiteLabelLogo}
                />
              )}

              {activeSection === "painel" && (
                <PainelControlo 
                  predio={predioAtivo} 
                  contas={contas} 
                  fracoes={fracoes} 
                  movements={movements} 
                  avisos={avisos}
                  ocorrenciasCount={ocorrencias.filter(o => o.id_predio === predioAtivo.id_predio).length}
                  reservasCount={reservas.filter(r => r.id_predio === predioAtivo.id_predio).length}
                  mensagensCount={2}
                  notificacoesCount={6}
                  onSelectSection={selectSection}
                />
              )}

          {["predios", "predios_cadastro", "predios_chaves", "predios_regras"].includes(activeSection) && (
            <GestaoPredios 
              predios={predios} 
              onAddPredio={handleAddPredio} 
              onUpdatePredio={handleUpdatePredio}
              onDeletePredio={handleDeletePredio}
              loggedUser={loggedUser}
              activeSubSection={activeSection}
            />
          )}

          {["fracoes", "fracoes_nova", "fracoes_proprietario", "fracoes_perfis"].includes(activeSection) && (
            <GestaoFracoes 
              predio={predioAtivo} 
              fracoes={fracoes} 
              onAddFracao={handleAddFracao}
              onUpdateFracoes={handleUpdateFracoes}
              loggedUser={loggedUser}
              avisos={avisos}
              setAvisos={setAvisos}
              activeSubSection={activeSection}
            />
          )}

          {activeSection === "fornecedores" && (
            <GestaoFornecedores 
              predio={predioAtivo} 
              fornecedores={fornecedores} 
              onAddFornecedor={handleAddFornecedor}
              loggedUser={loggedUser}
              initialTab={fornecedoresTab}
            />
          )}

          {activeSection === "contas" && (
            <GestaoContas 
              predio={predioAtivo} 
              contas={contas} 
              onAddConta={handleAddConta}
              onSetPrincipalConta={handleSetPrincipalConta}
              onDeleteConta={(id) => setContas(contas.filter(c => c.id_conta !== id))}
              loggedUser={loggedUser}
            />
          )}

          {activeSection === "emissao" && (
            <GestaoEmissao 
              predio={predioAtivo} 
              fracoes={fracoes} 
              avisos={avisos} 
              setAvisos={setAvisos}
              documentos={documentos}
              setDocumentos={setDocumentos}
              loggedUser={loggedUser}
            />
          )}

          {activeSection === "movimentos" && (
            <GestaoMovimentos 
              predio={predioAtivo} 
              contas={contas} 
              movements={movements} 
              setMovements={setMovements}
              loggedUser={loggedUser}
            />
          )}

          {["financeiro_recibos", "financeiro_relatorios", "financeiro_extratos", "financeiro_quotas_mensais", "financeiro_quotas_extra"].includes(activeSection) && (
            <FinanceiroAvancado
              predio={predioAtivo}
              fracoes={fracoes}
              movimentos={movements}
              setDocumentos={setDocumentos}
              loggedUser={loggedUser}
              activeSubSection={activeSection as any}
              initialTab={
                activeSection === "financeiro_recibos" ? "recibos_manuais" :
                activeSection === "financeiro_relatorios" ? "relatorio_dividas" :
                activeSection === "financeiro_extratos" ? "extrato_saldos" :
                activeSection === "financeiro_quotas_mensais" ? "quotas_mensais" :
                activeSection === "financeiro_quotas_extra" ? "quotas_extra" : "recibos_manuais"
              }
            />
          )}

          {activeSection === "fundo_reserva" && (
            <GestaoFundoReserva 
              predio={predioAtivo} 
              loggedUser={loggedUser}
            />
          )}

          {activeSection === "contabilidade_interna" && (
            <ContabilidadeInterna 
              predio={predioAtivo} 
              loggedUser={loggedUser}
              movimentos={movements}
            />
          )}

          {activeSection === "relatorios_automaticos" && (
            <GestaoRelatorios 
              predio={predioAtivo} 
              loggedUser={loggedUser}
              movimentos={movements}
              fracoes={fracoes}
            />
          )}

          {activeSection === "auditoria_interna" && (
            <AuditoriaInterna 
              predio={predioAtivo} 
              loggedUser={loggedUser}
              movimentos={movements}
              fracoes={fracoes}
              documentos={documentos}
              contas={contas}
            />
          )}

          {activeSection === "conciliacao" && (
            <IAConciliacao 
              predio={predioAtivo} 
              fracoes={fracoes}
              avisos={avisos}
              setAvisos={setAvisos}
              movements={movements}
              setMovements={setMovements}
              contas={contas}
              loggedUser={loggedUser}
            />
          )}

          {activeSection === "agendador_automatico" && (
            <AgendadorAutomatico 
              predio={predioAtivo}
              fracoes={fracoes}
              loggedUser={loggedUser}
            />
          )}

          {(activeSection === "agenda_notificacoes" || activeSection === "envios_programados") && (
            <EnviosProgramados 
              predio={predioAtivo}
              fracoes={fracoes}
              avisos={avisos}
              loggedUser={loggedUser}
            />
          )}

          {(activeSection === "gestao_sinistros" || activeSection === "fracoes_sinistros" || activeSection === "seguros_sinistros") && (
            <GestaoSinistrosSeguros 
              predio={predioAtivo}
              fracoes={fracoes}
              loggedUser={loggedUser}
              onUpdateFracoes={handleUpdateFracoes}
            />
          )}

          {activeSection === "agenda_manutencao" && (
            <AgendaManutencao 
              predio={predioAtivo}
              loggedUser={loggedUser}
            />
          )}

          {activeSection === "mural_reservas" && (
            <MuralDigitalReservas 
              predio={predioAtivo}
              fracoes={fracoes}
              loggedUser={loggedUser}
            />
          )}

          {activeSection === "ocr_faturas" && (
            <LeitorAnexosIA 
              predio={predioAtivo}
              fracoes={fracoes}
              fornecedores={fornecedores}
              onMovimentoCriado={(novoMov) => {
                setMovements(prev => [novoMov, ...prev]);
                alert("âœ¨ Despesa/Movimento registado automaticamente pela IA nos Movimentos!");
              }}
            />
          )}

          {activeSection === "assembleias" && (
            <GestaoAssembleias 
              predio={predioAtivo} 
              fracoes={fracoes}
              reunioes={reunioes} 
              onAddReuniao={handleAddReuniao}
              setReunioes={setReunioes}
              loggedUser={loggedUser}
            />
          )}

          {(activeSection === "documentos" || activeSection === "arquivo" || activeSection === "manutencao_arquivo") && (
            <GestaoDocumentos 
              predio={predioAtivo} 
              documentos={documentos} 
              onAddDocumento={handleAddDocumento}
              setDocumentos={setDocumentos}
              loggedUser={loggedUser}
            />
          )}

          {activeSection === "reservas" && (
            <GestaoReservas 
              predio={predioAtivo}
              fracoes={fracoes}
              reservas={reservas}
              setReservas={setReservas}
              capacidades={capacidades}
              setCapacidades={setCapacidades}
              loggedUser={loggedUser}
            />
          )}

          {["manutencao_ocorrencias", "manutencao_agenda", "manutencao_intervencoes", "manutencao_extraordinarias", "manutencao_concluidas"].includes(activeSection) && (
            <GestaoManutencaoIntervencoes 
              predio={predioAtivo} 
              fracoes={fracoes}
              ocorrencias={ocorrencias} 
              setOcorrencias={setOcorrencias}
              movements={movements}
              setMovements={setMovements}
              contas={contas}
              documentos={documentos}
              setDocumentos={setDocumentos}
              fornecedores={fornecedores}
              loggedUser={loggedUser}
              activeSubSection={activeSection}
              setActiveSubSection={setActiveSection}
            />
          )}

          {["vistorias_limpezas", "limpezas_incidencias", "limpezas_vistorias"].includes(activeSection) && (
            <GestaoVistoriasLimpezas 
              predio={predioAtivo}
              loggedUser={loggedUser}
              activeSubSection={activeSection}
            />
          )}

          {activeSection === "ia_avancada" && (
            <IAAvancada 
              predio={predioAtivo}
              fracoes={fracoes}
              avisos={avisos}
              movements={movements}
              fornecedores={fornecedores}
              loggedUser={loggedUser}
              initialTab={iaInitialTab || "orcamento_anual_ia"}
            />
          )}

          {["comunicacao_broadcast", "comunicacao_chat", "comunicacao_sondagens", "comunicacao_questionarios"].includes(activeSection) && (
            <GestaoComunicacoes 
              predio={predioAtivo}
              fracoes={fracoes}
              avisos={avisos}
              setAvisos={setAvisos}
              loggedUser={loggedUser}
              activeSubSection={
                activeSection === "comunicacao_chat" ? "chat" :
                activeSection === "comunicacao_sondagens" ? "sondagens" :
                activeSection === "comunicacao_questionarios" ? "questionarios" : "broadcast"
              }
              onSubSectionChange={(sub) => {
                if (sub === "chat") setActiveSection("comunicacao_chat");
                else if (sub === "sondagens") setActiveSection("comunicacao_sondagens");
                else if (sub === "questionarios") setActiveSection("comunicacao_questionarios");
                else setActiveSection("comunicacao_broadcast");
              }}
            />
          )}

          {activeSection === "ia_importacao" && (
            <AssistenteImportacao 
              onImportComplete={handleImportGlobalData}
              loggedUser={loggedUser}
            />
          )}

          {["configuracoes_gerais", "configuracoes_ia", "configuracoes_notificacoes"].includes(activeSection) && (
            <ConfiguracoesAdministracao 
              predio={predioAtivo}
              loggedUser={loggedUser}
              documentos={documentos}
              movimentos={movements}
              fracoes={fracoes}
              activeSubSection={
                activeSection === "configuracoes_ia" ? "ia" :
                activeSection === "configuracoes_notificacoes" ? "notificacoes" : "gerais"
              }
              setActiveSubSection={(sub) => {
                if (sub === "ia") setActiveSection("configuracoes_ia");
                else if (sub === "notificacoes") setActiveSection("configuracoes_notificacoes");
                else setActiveSection("configuracoes_gerais");
              }}
              onUpdatePredio={handleUpdatePredio}
              onAddDocumento={handleAddDocumento}
            />
          )}

          {activeSection === "inventario_tecnico" && (
            <InventarioTecnico 
              predio={predioAtivo}
              loggedUser={loggedUser}
            />
          )}

          {["contencioso_juridico", "contencioso_juridico_processos", "contencioso_juridico_nd", "contencioso_juridico_doc_obrig", "contencioso_juridico_cartas", "contencioso_juridico_bni", "contencioso_juridico_regulamento", "contencioso_juridico_estatutos", "contencioso_juridico_ia"].includes(activeSection) && (
            <ContenciosoJuridico 
              predio={predioAtivo}
              fracoes={fracoes}
              avisos={avisos}
              loggedUser={loggedUser}
              onAddDocumento={handleAddDocumento}
              initialTab={
                activeSection === "contencioso_juridico_processos" ? "constituicao_processos" :
                activeSection === "contencioso_juridico_nd" ? "carta_nao_divida" :
                activeSection === "contencioso_juridico_doc_obrig" ? "documentos_obrigatorios" :
                activeSection === "contencioso_juridico_cartas" ? "cartasar" :
                activeSection === "contencioso_juridico_bni" ? "injuncÃµes" :
                activeSection === "contencioso_juridico_regulamento" ? "regulamento" :
                activeSection === "contencioso_juridico_estatutos" ? "estatutos" :
                activeSection === "contencioso_juridico_ia" ? "assistente_ia" : "geral"
              }
            />
          )}

          {activeSection === "portal_condomino" && (
            <PortalCondomino 
              predio={predioAtivo}
              fracoes={fracoes}
              onUpdateFracoes={handleUpdateFracoes}
              avisos={avisos}
              setAvisos={setAvisos}
              movements={movements}
              setMovements={setMovements}
              contas={contas}
              loggedUser={loggedUser}
              setLoggedUser={setLoggedUser}
            />
          )}

          {activeSection === "portal_orcamentos" && (
            <PortalOrcamentos 
              predio={predioAtivo}
              fornecedores={fornecedores}
              onAddFornecedor={handleAddFornecedor}
              loggedUser={loggedUser}
            />
          )}

          {activeSection === "dashboard_kpis" && (
            <DashboardKPIs 
              predio={predioAtivo}
              fracoes={fracoes}
              avisos={avisos}
              movimentos={movements}
              reservas={reservas}
              ocorrencias={ocorrencias}
            />
          )}

          {["minutas_oficiais", "simulador_emails", "pasta_provisoria"].includes(activeSection) && (
            <CentralDocumentosMinutas 
              predio={predioAtivo}
              fracoes={fracoes}
              loggedUser={loggedUser}
              contas={contas}
              onOpenArranque={() => setActiveSection("configuracao_arranque")}
            />
          )}

          {["configuracao_arranque", "arranque_saldos", "saldos_iniciais"].includes(activeSection) && (
            <ConfiguracaoArranqueSaldos 
              predio={predioAtivo}
              fracoes={fracoes}
              contas={contas}
              setContas={setContas}
              movements={movements}
              setMovements={setMovements}
              avisos={avisos}
              setAvisos={setAvisos}
              loggedUser={loggedUser}
              onConcluir={() => setActiveSection("painel")}
            />
          )}

          {activeSection === "multi_condominio" && (
            <MultiCondominio 
              predios={predios}
              fracoes={fracoes}
              avisos={avisos}
              movimentos={movements}
              reservas={reservas}
              ocorrencias={ocorrencias}
              contas={contas}
              loggedUser={loggedUser}
              onUpdatePredio={handleUpdatePredio}
            />
          )}
            </>
          )}
        </div>
      </main>

      {/* GLOBAL USER SECURITY MODAL */}
      <UserSecurityModal
        isOpen={userProfileModalOpen}
        onClose={() => setUserProfileModalOpen(false)}
        loggedUser={loggedUser}
        biometricsEnabled={biometricsEnabled}
        setBiometricsEnabled={setBiometricsEnabled}
        showTestingBar={showTestingBar}
        setShowTestingBar={setShowTestingBar}
      />

      {/* GLOBAL SENDING REACTION MODAL */}
      <SendingReactionModal />

           {/* FLOATING DRAGGABLE AI ASSISTANT FOR ADMIN AND GESTOR PROFILES */}
      <DraggableAIFloatingButton
        loggedUser={loggedUser}
        predio={predioAtivo}
        isPWA={false}
      />

    </div>
      );
}
export default App;