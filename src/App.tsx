import { Shield, PanelLeftClose, PanelLeftOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useCallback, Fragment } from "react";
import { ActionIcon } from "./components/ActionIcon";
import { LoggedUser, Predio, Conta, Fornecedor, Fracao, Aviso, Movimento, Reuniao, Documento, Ocorrencia, Reserva, CapacidadeLimite } from "./types";
import { initialPredios, initialContas, initialFornecedores, initialFracoes, initialAvisos, initialMovements, initialReunioes, initialDocumentos, initialOcorrencias, defaultEmptyPredio } from "./data";
import { isSupabaseConfigured, fetchUserProfileByEmail } from "./lib/supabaseService";
import { supabase, authRedirectHashAtLoad } from "./lib/supabaseClient";
import { encontrarFotoDoUtilizador } from "./lib/condominoUtils";
import { ordenarFracoesPorNome } from "./utils";
import {
  fetchPrediosFromSupabase,
  fetchFracoesFromSupabase,
  fetchContasFromSupabase,
  fetchMovimentosFromSupabase,
  fetchAvisosFromSupabase,
  fetchDocumentosFromSupabase,
  fetchOcorrenciasFromSupabase,
  fetchReservasFromSupabase,
  fetchFornecedoresFromSupabase,
  saveDocumentoToSupabase,
  saveOcorrenciaToSupabase,
  saveReservaToSupabase,
  saveContaToSupabase,
  fetchReunioesFromSupabase,
  saveReuniaoToSupabase,
  savePredioToSupabase,
  saveFracaoToSupabase,
  saveAvisosToSupabase,
  fetchObrasExtraFromSupabase,
  fetchLimpezasFromSupabase,
  fetchProcessosJuridicosFromSupabase,
  fetchSondagensFromSupabase,
  fetchConversasFromSupabase,
  fetchDividasFornecedoresFromSupabase
} from "./lib/supabaseService";
import { PainelControlo } from "./components/PainelControlo";
import { GestaoPredios } from "./components/GestaoPredios";
import { GestaoFracoes } from "./components/GestaoFracoes";
import { GestaoFornecedores } from "./components/GestaoFornecedores";
import { GestaoContas } from "./components/GestaoContas";
import { GestaoQuotasOrcamento } from "./components/GestaoQuotasOrcamento";
import { GestaoMovimentos } from "./components/GestaoMovimentos";
import { AgendadorAutomatico } from "./components/AgendadorAutomatico";
import { LeitorAnexosIA } from "./components/LeitorAnexosIA";
import { GestaoAssembleias } from "./components/GestaoAssembleias";
import { GestaoDocumentos } from "./components/GestaoDocumentos";
import { GestaoVistoriasLimpezas } from "./components/GestaoVistoriasLimpezas";
import { IAAvancada } from "./components/IAAvancada";
import { GestaoComunicacoes } from "./components/GestaoComunicacoes";
import { AssistenteImportacao } from "./components/AssistenteImportacao";
import { ClassificadorDocumentos } from "./components/ClassificadorDocumentos";
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
import SetPasswordScreen from "./components/SetPasswordScreen";
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
const condoManagerLogo = "/marca/02-versao-horizontal.webp";
const logoutIcon = "/estados-acoes/17-desligar.png";
const terminarSessaoIcon = "/estados-acoes/16-terminar-sessao.png";

export default function App() {
  const [predios, setPredios] = useState<Predio[]>(initialPredios);
  const [activePredioId, setActivePredioId] = useState("");
  const [contas, setContas] = useState<Conta[]>(initialContas);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>(initialFornecedores);
  const [fracoes, setFracoes] = useState<Fracao[]>(() => ordenarFracoesPorNome(initialFracoes));
  const [avisos, setAvisos] = useState<Aviso[]>(initialAvisos);
  const [movements, setMovements] = useState<Movimento[]>(initialMovements);
  const [reunioes, setReunioes] = useState<Reuniao[]>(initialReunioes);
  const [documentos, setDocumentos] = useState<Documento[]>(initialDocumentos);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>(initialOcorrencias);

  // Reservation states (Base limpa para início de produção)
  const [reservas, setReservas] = useState<Reserva[]>([]);

  // Carregamento inicial dos dados reais do Supabase — sem isto, a app
  // corria sempre sobre os dados de demonstração estáticos definidos em
  // ./data, mesmo com o Supabase configurado, e nada do que é criado
  // automaticamente pelo backend (pagamentos, movimentos, avisos, notas de
  // cobrança, etc.) alguma vez chegava a aparecer no ecrã do administrador.
  // Cada fetch* devolve null se o Supabase não estiver configurado ou se a

  // Deteta chegada através de um link de convite/recuperação de password e
  // mostra o ecrã de "Definir Palavra-passe" em vez do login/dashboard normal.
  // Dois casos reais que faltavam aqui (o link "ia para a página inicial"
  // sem explicação nenhuma):
  // 1) Convites de PRIMEIRO acesso (type=invite, gerados em api/admin.js)
  //    autenticam a sessão mas o Supabase JS dispara SIGNED_IN, não
  //    PASSWORD_RECOVERY — este último só existe para type=recovery. Sem
  //    verificar o "type" na própria URL, um convite novo nunca acionava
  //    o ecrã de definir password.
  // 2) Um link expirado ou já usado nunca dispara nenhum evento de sessão —
  //    o Supabase só deixa "#error=access_denied&error_code=otp_expired..."
  //    na própria URL, que precisa de ser lido explicitamente.
  useEffect(() => {
    const hashInicial = authRedirectHashAtLoad || "";
    if (hashInicial.includes("error=") && (hashInicial.includes("otp_expired") || hashInicial.includes("access_denied") || hashInicial.includes("type=invite") || hashInicial.includes("type=recovery"))) {
      setLoginErrorMessage("Este link de acesso expirou ou já foi utilizado. Peça à administração do condomínio para reenviar o convite ou use a opção \"Esqueci-me da password\".");
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const hashDaSessao = authRedirectHashAtLoad || "";
      const chegouPorConviteOuRecuperacao = hashDaSessao.includes("type=invite") || hashDaSessao.includes("type=recovery");
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && chegouPorConviteOuRecuperacao)) {
        setNeedsPasswordSetup({ email: session?.user?.email || undefined });
      }
    });
    return () => { authListener?.subscription?.unsubscribe(); };
  }, []);

  // tabela ainda estiver vazia — nesse caso os dados de demonstração
  // mantêm-se, para a app nunca ficar em branco.
  const [browserIsLoggedOut, setBrowserIsLoggedOut] = useState<boolean>(true);

  // Indicador visível de atualização — antes a atualização automática dos
  // dados só era percetível no Dashboard de KPIs (o único ecrã com um botão
  // próprio); passa a estar sempre visível no cabeçalho, em qualquer ecrã.
  const [ultimaAtualizacaoGlobal, setUltimaAtualizacaoGlobal] = useState<Date>(new Date());
  const [aAtualizarGlobal, setAAtualizarGlobal] = useState<boolean>(false);

  const carregarDadosReais = useCallback(async () => {
    setAAtualizarGlobal(true);
    const [
      prediosReais,
      fracoesReais,
      contasReais,
      movimentosReais,
      avisosReais,
      documentosReais,
      ocorrenciasReais,
      reservasReais,
      fornecedoresReais,
      reunioesReais
    ] = await Promise.all([
      fetchPrediosFromSupabase(),
      fetchFracoesFromSupabase(),
      fetchContasFromSupabase(),
      fetchMovimentosFromSupabase(),
      fetchAvisosFromSupabase(),
      fetchDocumentosFromSupabase(),
      fetchOcorrenciasFromSupabase(),
      fetchReservasFromSupabase(),
      fetchFornecedoresFromSupabase(),
      fetchReunioesFromSupabase()
    ]);

    if (prediosReais) setPredios(prediosReais);
    if (fracoesReais) setFracoes(ordenarFracoesPorNome(fracoesReais));
    if (contasReais) setContas(contasReais);
    if (movimentosReais) setMovements(movimentosReais);
    if (avisosReais) setAvisos(avisosReais);
    if (documentosReais) setDocumentos(documentosReais);
    if (ocorrenciasReais) setOcorrencias(ocorrenciasReais);
    if (reservasReais) setReservas(reservasReais);
    if (fornecedoresReais) setFornecedores(fornecedoresReais);
    if (reunioesReais) setReunioes(reunioesReais);
    setUltimaAtualizacaoGlobal(new Date());
    setAAtualizarGlobal(false);
  }, []);

  useEffect(() => {
    // Só faz sentido carregar dados reais do condomínio depois de haver
    // sessão — antes disso (ecrã de login), /api/data exige autenticação
    // (ver api/data.js) e estas chamadas falhavam sempre com 401.
    if (!isSupabaseConfigured() || browserIsLoggedOut) return;

    carregarDadosReais();

    // Antes, dados criados noutro separador/dispositivo (ex: telemóvel) só
    // apareciam depois de fechar e reabrir o separador — a lista só era
    // pedida uma vez, ao entrar. Passa a atualizar-se sozinha sempre que se
    // volta a este separador (troca de app, ecrã bloqueado, outro separador).
    const aoVoltarAoSeparador = () => {
      if (document.visibilityState === "visible") {
        carregarDadosReais();
      }
    };
    document.addEventListener("visibilitychange", aoVoltarAoSeparador);

    // E também sozinha em intervalos regulares, com o separador aberto — sem
    // isto, qualquer ecrã da app (não só o Dashboard de KPIs) só mostrava
    // dados novos (emails reconhecidos, pagamentos, avisos, etc.) depois de
    // um F5 ou sair/entrar manual, o que não é prático num painel pensado
    // para ficar aberto no ecrã. 60s chega para se sentir "ao vivo" sem
    // sobrecarregar o Supabase com pedidos constantes.
    const intervaloAtualizacao = setInterval(() => {
      if (document.visibilityState === "visible") {
        carregarDadosReais();
      }
    }, 60000);

    return () => {
      document.removeEventListener("visibilitychange", aoVoltarAoSeparador);
      clearInterval(intervaloAtualizacao);
    };
  }, [browserIsLoggedOut, carregarDadosReais]);

  const [capacidades, setCapacidades] = useState<CapacidadeLimite[]>([
    { area_comum: "Ginásio", limite: 5 },
    { area_comum: "Spa", limite: 8 },
    { area_comum: "Salão de Festas", limite: 40 },
    { area_comum: "Churrasqueira", limite: 15 }
  ]);

  const [loggedUser, setLoggedUser] = useState<LoggedUser>({
    nome: "Administrador do Condomínio",
    email: "condomanagerai@gmail.com",
    role: "ADMIN"
  });

  const [needsPasswordSetup, setNeedsPasswordSetup] = useState<{ email?: string } | null>(null);
  const [browserEmail, setBrowserEmail] = useState<string>("");
  const [browserPassword, setBrowserPassword] = useState<string>("");
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
          // Transition to cooldownPassed = true
          setUserSecurityMap(prev => ({
            ...prev,
            [browserEmail]: {
              ...prev[browserEmail],
              cooldownUntil: null,
              cooldownPassed: true,
            }
          }));
          createSecurityLog(browserEmail, "BOT_CHALLENGE_PASSED", "Cooldown de 1 minuto terminado. Concedidas 3 tentativas pós-bloqueio.");
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

  // Update HTML class when theme state changes
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const [activeSection, setActiveSection] = useState("painel");
  // Grupo do menu principal (prefixo antes do primeiro "_") — usado como key
  // do painel de conteúdo para forçar o React a desmontar/remontar tudo o
  // que estiver aberto (seleções, painéis expandidos, modais locais) sempre
  // que se muda de menu principal na coluna central, mas SEM reiniciar nada
  // ao navegar entre sub-secções do mesmo módulo (ex: "fracoes_nova" ↔
  // "fracoes_perfis" continuam no mesmo grupo "fracoes").
  const grupoMenuPrincipal = activeSection.split("_")[0];
  const [userProfileModalOpen, setUserProfileModalOpen] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(true);
  const [openMenuPredios, setOpenMenuPredios] = useState(false);
  const [openMenuFracoes, setOpenMenuFracoes] = useState(false);
  const [openMenuFinanceiro, setOpenMenuFinanceiro] = useState(false);
  const [openMenuLimpezas, setOpenMenuLimpezas] = useState(false);
  const [openMenuVistoriasIntervencoes, setOpenMenuVistoriasIntervencoes] = useState(false);
  const [openMenuJuridico, setOpenMenuJuridico] = useState(false);
  const [openMenuComunicacoes, setOpenMenuComunicacoes] = useState(false);
  const [openMenuConsultoriaIA, setOpenMenuConsultoriaIA] = useState(false);
  const [openMenuFornecedores, setOpenMenuFornecedores] = useState(false);
  const [openMenuObras, setOpenMenuObras] = useState(false);
  const [openMenuConfiguracoesIA, setOpenMenuConfiguracoesIA] = useState(false);
  const [fornecedoresTab, setFornecedoresTab] = useState<"fornecedores" | "contratos" | "dividas">("fornecedores");
  const [iaInitialTab, setIaInitialTab] = useState<"juridico" | "orcamento_anual_ia" | "cerebro_ia" | undefined>(undefined);
  const [viewMode, setViewMode] = useState<"BROWSER" | "PWA">("BROWSER");
  // Nenhum sítio da app alguma vez chamava setViewMode("PWA") — a vista PWA
  // (PWASimulator/PWACondominoView, com o Perfil do Condómino, o IBAN da
  // fração, etc.) era por isso inatingível em produção. A escolha certa
  // (confirmada pelo utilizador) não depende do papel de quem entra — toda a
  // gente entra pelo Painel de Administração por defeito, em qualquer
  // dispositivo; é só no telemóvel que a app PWA se aplica automaticamente.
  useEffect(() => {
    const ehTelemovel = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
    setViewMode(ehTelemovel ? "PWA" : "BROWSER");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedUser?.email]);
  const [brandingColor, setBrandingColorState] = useState<string>(() => {
    return localStorage.getItem("brandingColor") || "emerald";
  });
  const setBrandingColor = (color: string) => {
    setBrandingColorState(color);
    localStorage.setItem("brandingColor", color);
  };
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

  // Sincronização automática para manter aberto o menu Registo de Prédios quando uma das suas secções está ativa
  useEffect(() => {
    if (["predios", "predios_cadastro", "predios_chaves", "predios_regras"].includes(activeSection)) {
      setOpenMenuPredios(true);
    }
  }, [activeSection]);

  // Sincronização automática para manter aberto o menu Área Financeira quando uma das suas secções está ativa
  useEffect(() => {
    if (["quotas_orcamento", "movimentos", "financeiro_recibos", "financeiro_relatorios", "relatorios_automaticos", "contabilidade_interna", "financeiro_extratos", "financeiro_mapa_pagamentos", "conciliacao", "ocr_faturas", "configuracao_arranque", "arranque_saldos", "saldos_iniciais", "contas", "fundo_reserva"].includes(activeSection)) {
      setOpenMenuFinanceiro(true);
    }
  }, [activeSection]);

  // Sincronização automática para manter aberto o menu Configurações IA & E-mail quando uma das suas secções está ativa
  useEffect(() => {
    if (["configuracoes_gerais", "configuracoes_templates", "configuracoes_ia", "configuracoes_notificacoes", "configuracoes_logs", "configuracoes_exportacao"].includes(activeSection)) {
      setOpenMenuConfiguracoesIA(true);
    }
  }, [activeSection]);

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
      console.warn(`[RoleGuard] Acesso negado à secção '${activeSection}' para a função '${loggedUser.role}'. Redirecionando para '${roleAccess.redirectTab}'.`);
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
        handleSecureLogout(val.reason || "Sessão expirada por inatividade.");
      }
    }, 5000);

    // D. Cross-Tab Logout Listener
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "condomanager_active_session" && !e.newValue) {
        handleSecureLogout("Sessão encerrada noutro separador.");
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
    supabase.auth.signOut().catch(() => {});
    purgeSession();
    setLoggedUser(null);
    setBrowserIsLoggedOut(true);
    setCurrentRoute("/");
    window.history.pushState({}, "", "/");
    if (reason) {
      setLoginErrorMessage(`ℹ️ ${reason}`);
    } else {
      setLoginErrorMessage("Sessão encerrada com sucesso.");
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

  const [sidebarExpanded, setSidebarExpanded] = useState({
    administracao: true,
    operacoes: true,
    financeiro: true,
    condomino: true,
    documentacao: true,
    juridico: true,
    manutencao: true
  });

  const predioAtivo = predios.find(p => p.id_predio === activePredioId) || predios[0] || defaultEmptyPredio;

  // Contagens reais para os indicadores do painel de administração que antes
  // estavam sempre fixos a 0 (obras, limpezas, alertas jurídicos, sondagens
  // e mensagens) — pedidas apenas para o prédio ativo em vez de todos os
  // prédios, porque é o único que o PainelControlo mostra de cada vez.
  const [obrasAtivasCount, setObrasAtivasCount] = useState<number>(0);
  const [limpezaAreasCount, setLimpezaAreasCount] = useState<number>(0);
  const [alertasJuridicosAtivosCount, setAlertasJuridicosAtivosCount] = useState<number>(0);
  const [sondagensAtivasCount, setSondagensAtivasCount] = useState<number>(0);
  const [mensagensPendentesCount, setMensagensPendentesCount] = useState<number>(0);
  const [dividasFornecedoresPendentesValor, setDividasFornecedoresPendentesValor] = useState<number>(0);

  useEffect(() => {
    const idPredio = predioAtivo?.id_predio;
    // Só recarrega quando se está mesmo no Dashboard — evita repetir estes
    // 6 pedidos ao Supabase em todos os cliques de navegação da app.
    if (activeSection !== "painel") return;
    if (!isSupabaseConfigured() || browserIsLoggedOut || !idPredio || idPredio === "predio-temp") {
      setObrasAtivasCount(0);
      setLimpezaAreasCount(0);
      setAlertasJuridicosAtivosCount(0);
      setSondagensAtivasCount(0);
      setMensagensPendentesCount(0);
      setDividasFornecedoresPendentesValor(0);
      return;
    }
    (async () => {
      const [obrasReais, limpezasReais, juridicosReais, sondagensReais, conversasReais, dividasReais] = await Promise.all([
        fetchObrasExtraFromSupabase(idPredio),
        fetchLimpezasFromSupabase(idPredio),
        fetchProcessosJuridicosFromSupabase(idPredio),
        fetchSondagensFromSupabase(idPredio),
        fetchConversasFromSupabase(idPredio),
        fetchDividasFornecedoresFromSupabase(idPredio)
      ]);
      setObrasAtivasCount((obrasReais || []).filter(o => o.estado !== "Concluída").length);
      const areasUnicas = new Set<string>();
      (limpezasReais || []).forEach(l => (l.areas || []).forEach(a => areasUnicas.add(a)));
      setLimpezaAreasCount(areasUnicas.size);
      setAlertasJuridicosAtivosCount((juridicosReais || []).filter(p => p.fase_processual !== "CONCLUIDO_EXTINTO").length);
      setSondagensAtivasCount((sondagensReais || []).filter(s => s.estado === "ativa").length);
      setMensagensPendentesCount((conversasReais || []).filter(c => c.estado === "pendente").length);
      setDividasFornecedoresPendentesValor((dividasReais || [])
        .filter(d => d.estado === "Pendente" || d.estado === "Paga Parcialmente")
        .reduce((acc, d) => acc + ((Number(d.valor) || 0) - (Number(d.valor_pago) || 0)), 0));
    })();
    // Corrido também sempre que se volta ao Dashboard — antes só corria
    // uma vez por prédio/login, por isso o cartão "Mensagens" (e os
    // outros: Obras, Limpeza, Alertas Jurídicos, Sondagens, Dívidas)
    // ficavam com a contagem congelada no momento em que o dashboard
    // carregou pela primeira vez, mesmo depois de responder a mensagens,
    // fechar sondagens, etc. noutro ecrã.
  }, [predioAtivo?.id_predio, browserIsLoggedOut, activeSection]);

  const toggleSidebarSub = (menu: "administracao" | "operacoes" | "financeiro" | "condomino" | "documentacao" | "juridico" | "manutencao") => {
    setSidebarExpanded(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  const handleAddPredio = (novoPredio: Predio) => {
    setPredios([...predios, novoPredio]);
    setActivePredioId(novoPredio.id_predio);
  };

  const handleImportGlobalData = async (predioData: Predio, fracoesData: Fracao[], avisosData: Aviso[]) => {
    setPredios(prev => [...prev, predioData]);
    setFracoes(prev => ordenarFracoesPorNome([...prev, ...fracoesData]));
    setAvisos(prev => [...prev, ...avisosData]);
    setActivePredioId(predioData.id_predio);
    setActiveSection("painel"); // Redirect to Dashboard of newly imported building!

    // O Assistente de Importação constrói o prédio/frações/dívidas de
    // transição só em memória — sem isto, a migração inteira desaparecia
    // ao atualizar a página.
    const okPredio = await savePredioToSupabase(predioData);
    const resultadosFracoes = await Promise.all(fracoesData.map(f => saveFracaoToSupabase(f)));
    const okAvisos = avisosData.length ? await saveAvisosToSupabase(avisosData) : true;

    if (!okPredio || resultadosFracoes.some(ok => !ok) || !okAvisos) {
      console.error("[handleImportGlobalData] Falha ao gravar a migração no Supabase", { okPredio, resultadosFracoes, okAvisos });
      alert("⚠️ A migração foi importada mas houve um erro ao gravar alguns dados no Supabase. Verifique o prédio, as frações e os avisos de transição.");
    }
  };

  const handleUpdatePredio = (updatedPredio: Predio) => {
    setPredios(predios.map(p => p.id_predio === updatedPredio.id_predio ? updatedPredio : p));
  };

  const handleDeletePredio = (idPredio: string) => {
    if (predios.length <= 1) {
      alert("Não é possível remover o único prédio cadastrado no sistema.");
      return;
    }
    const filtered = predios.filter(p => p.id_predio !== idPredio);
    setPredios(filtered);
    if (activePredioId === idPredio) {
      setActivePredioId(filtered[0].id_predio);
    }
  };

  const handleAddFracao = (novaFracao: Fracao) => {
    setFracoes(ordenarFracoesPorNome([...fracoes, novaFracao]));
  };

  const handleUpdateFracoes = (updatedFracoes: Fracao[]) => {
    setFracoes(ordenarFracoesPorNome(updatedFracoes));
  };

  const handleAddFornecedor = (novoFornecedor: Fornecedor) => {
    setFornecedores(prev => prev.some(f => f.id_fornecedor === novoFornecedor.id_fornecedor)
      ? prev.map(f => f.id_fornecedor === novoFornecedor.id_fornecedor ? novoFornecedor : f)
      : [...prev, novoFornecedor]);
  };

  const handleRemoveFornecedor = (idFornecedor: string) => {
    setFornecedores(prev => prev.filter(f => f.id_fornecedor !== idFornecedor));
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

  const handleUpdateConta = (contaAtualizada: Conta) => {
    setContas(contas.map(c => {
      if (contaAtualizada.is_principal && c.id_predio === contaAtualizada.id_predio && c.id_conta !== contaAtualizada.id_conta) {
        return { ...c, is_principal: false };
      }
      return c.id_conta === contaAtualizada.id_conta ? contaAtualizada : c;
    }));
  };

  const handleSetPrincipalConta = (idConta: string) => {
    const contasAtualizadas = contas
      .filter(c => c.id_predio === activePredioId)
      .map(c => ({ ...c, is_principal: c.id_conta === idConta }));
    setContas(contas.map(c => {
      if (c.id_predio === activePredioId) {
        return { ...c, is_principal: c.id_conta === idConta };
      }
      return c;
    }));
    contasAtualizadas.forEach(c => saveContaToSupabase(c).catch(console.error));
  };

  // Devolve o resultado real da gravação (antes era "fire-and-forget": o
  // ecrã mostrava sempre sucesso mesmo que o Supabase recusasse o registo,
  // e a convocatória/reunião desaparecia silenciosamente ao recarregar a
  // página, sem nenhum aviso ao administrador).
  const handleAddReuniao = async (novaReuniao: Reuniao): Promise<boolean> => {
    setReunioes([...reunioes, novaReuniao]);
    const ok = await saveReuniaoToSupabase(novaReuniao);
    if (!ok) console.error("[handleAddReuniao] Falha ao gravar reunião no Supabase:", novaReuniao.id_reuniao);
    return ok;
  };

  const handleAddOcorrencia = (novaOcorrencia: Ocorrencia) => {
    setOcorrencias([novaOcorrencia, ...ocorrencias]);
    saveOcorrenciaToSupabase(novaOcorrencia).catch(console.error);

    // Alarm notification to internal administrators
    const adms = fracoes.filter(f => f.id_predio === activePredioId && f.administrador_interno === "Sim");
    adms.forEach(adm => {
      if (!adm.proprietario.email) return;
      fetch("/api/email?acao=notificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: adm.proprietario.email,
          nomeDestinatario: adm.proprietario.nome,
          assunto: `Nova Ocorrência Registada — ${novaOcorrencia.categoria || "Condomínio"}`,
          mensagem: `Foi registada uma nova ocorrência no condomínio.<br><br><strong>Descrição:</strong> ${novaOcorrencia.descricao}<br><strong>Data:</strong> ${novaOcorrencia.data}`
        })
      }).catch(console.error);
    });
    fetch("/api/admin?acao=enviar-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_predio: activePredioId,
        title: "🚨 Nova Ocorrência",
        body: novaOcorrencia.descricao
      })
    }).catch(() => {});

    alert(`Alerta PWA disparado! Os Administradores Internos foram notificados por E-mail e Push sobre esta nova ocorrência.`);
  };

  const handleAddDocumento = (novoDoc: Documento) => {
    setDocumentos([novoDoc, ...documentos]);
    saveDocumentoToSupabase(novoDoc).catch(console.error);
  };


  if (needsPasswordSetup) {
    return (
      <SetPasswordScreen
        email={needsPasswordSetup.email}
        onDone={async () => {
          const cleanEmail = (needsPasswordSetup.email || "").trim().toLowerCase();
          setNeedsPasswordSetup(null);
          const perfil = cleanEmail ? await fetchUserProfileByEmail(cleanEmail) : null;
          if (perfil) {
            setLoggedUser({ role: perfil.role, email: perfil.email || cleanEmail, nome: perfil.nome || cleanEmail, id_fracao: perfil.fracao, id_predio: perfil.id_predio });
          } else if (cleanEmail) {
            setLoggedUser({ role: "USER", email: cleanEmail, nome: cleanEmail });
          }
          setBrowserIsLoggedOut(false);
          setCurrentRoute("/dashboard");
          window.history.pushState({}, "", "/dashboard");
        }}
      />
    );
  }

  if (browserIsLoggedOut) {
    const handleLoginFromTop = async (emailInput?: string) => {
      const cleanEmail = (emailInput || "").trim().toLowerCase();
      if (!cleanEmail) return;

      const perfil = await fetchUserProfileByEmail(cleanEmail);
      if (!perfil) {
        // Sessão real do Supabase Auth existe, mas ainda não tem perfil
        // (ex.: conta acabada de ativar) — entra como condómino por
        // omissão; o administrador pode ajustar o perfil depois.
        setLoggedUser({ role: "USER", email: cleanEmail, nome: cleanEmail });
      } else {
        setLoggedUser({
          role: perfil.role,
          email: perfil.email || cleanEmail,
          nome: perfil.nome || cleanEmail,
          id_fracao: perfil.fracao,
          id_predio: perfil.id_predio
        });
      }

      setBrowserIsLoggedOut(false);
      setCurrentRoute("/dashboard");
      window.history.pushState({}, "", "/dashboard");
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

      {/* BARRA LATERAL (MENU DINÂMICO RECOLHÍVEL E COMPATÍVEL COM MOBILE) —
          só faz sentido no modo de administração (Browser); a vista PWA já
          tem a sua própria navegação própria (barra inferior de separadores),
          pensada para ecrã de telemóvel. Mostrá-la também aos papéis não-
          gestão (condóminos, inquilinos, prestadores, etc.) expunha
          navegação e secções de administração que não lhes pertencem. */}
      {viewMode === "BROWSER" && (
      <aside className={`h-full flex flex-col select-none shrink-0 z-30 no-print transition-all duration-300 ${
        theme === "dark" ? "bg-[#030712] text-slate-300 border-r border-slate-900/50" : "bg-slate-900 text-slate-300"
      } ${
        mobileMenuOpen ? "fixed inset-y-0 left-0 w-72 translate-x-0 shadow-2xl z-50" : "fixed inset-y-0 left-0 -translate-x-full md:relative md:translate-x-0"
      } ${
        sidebarCollapsed ? "w-20 md:w-20" : "w-72 md:w-72"
      }`}>
        {/* Area do Logo - Limpa e Sem Sobreposições */}
        <div className="w-full border-b border-slate-800 shrink-0 overflow-hidden bg-slate-900/40">
          <div className="w-full h-20 flex items-center justify-center p-2 relative overflow-hidden">
            <div 
              onClick={() => selectSection("painel")}
              className="w-full h-full flex items-center justify-center cursor-pointer hover:opacity-95 transition-all duration-300 overflow-hidden px-1"
              title="Ir para a Página Inicial (Dashboard)"
            >
              <img 
                src={sidebarCollapsed ? "/marca/21-icone-sem-moldura.png" : (whiteLabelLogo || "/marca/18-versao-horizontal-1.webp")}
                alt="CondoManager AI" 
                className={`w-full h-full object-contain select-none transition-transform duration-300 drop-shadow-xl ${sidebarCollapsed ? "max-h-12 max-w-12 p-1" : "scale-145 sm:scale-155 max-w-[290px]"}`} 
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>

        {/* Barra Dedicada Inferior para Recolher/Expandir Menu com 07-avancar.png */}
        <div className="w-full bg-slate-950/80 border-b border-slate-800/80 px-2.5 py-1.5 flex items-center justify-between shrink-0">
          {!sidebarCollapsed && (
            <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-slate-400 font-mono truncate pl-1">
              Navegação
            </span>
          )}
          
          <div className={`flex items-center gap-1.5 ${sidebarCollapsed ? "w-full justify-center" : "ml-auto"}`}>
            {/* Botão Desktop para recolher/expandir coluna central com simbologia associada */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition-all cursor-pointer shrink-0 shadow-md hover:scale-105 active:scale-95 group"
              title={sidebarCollapsed ? "Expandir Menu de Operações (Coluna Central)" : "Recolher Menu de Operações (Coluna Central)"}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              ) : (
                <PanelLeftClose className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              )}
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

        {/* Seletor de Condomínio Ativo */}
        <div className="px-3 py-2 border-b border-slate-800 shrink-0 bg-slate-950/40">
          {!sidebarCollapsed ? (
            <div>
              <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-extrabold font-mono mb-1">
                Condomínio Ativo
              </label>
              <div className="relative flex items-center">
                <select 
                  value={activePredioId}
                  onChange={(e) => setActivePredioId(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer appearance-none pr-7 font-semibold truncate shadow-inner"
                >
                  {predios.length === 0 ? (
                    <option value="">Aguardando Condomínio (Base Limpa / Supabase)</option>
                  ) : (
                    predios.map(p => (
                      <option key={p.id_predio} value={p.id_predio}>{p.nome || `${p.morada_linha1} ${p.num_porta}`}</option>
                    ))
                  )}
                </select>
                <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-slate-400">
                  <i className="fa-solid fa-chevron-down text-[10px]"></i>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 px-1 flex items-center">
                <i className="fa-solid fa-location-dot text-slate-500 mr-1 shrink-0"></i>
                <span className="truncate">
                  {predioAtivo?.id_predio !== "predio-temp" && predioAtivo?.morada_linha1
                    ? `${predioAtivo.morada_linha1} ${predioAtivo.num_porta || ""}, ${predioAtivo.localidade || ""}`
                    : "Sem condomínio registado (Base Limpa)"}
                </span>
              </p>
            </div>
          ) : (
            <div className="flex justify-center py-1" title={`Condomínio Ativo: ${predioAtivo?.nome || predioAtivo?.morada_linha1 || "Base Limpa"}`}>
              <i className="fa-solid fa-building text-emerald-400 text-base"></i>
            </div>
          )}
        </div>

        {/* Navegação */}
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

          {/* 1b. Dashboard de KPIs (detalhe do prédio ativo) */}
          <button
            id="sidebar-item-dashboard-kpis"
            onClick={() => {
              setActiveSection("dashboard_kpis");
              setViewMode("BROWSER");
              setIaInitialTab(undefined);
            }}
            className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2.5 ${
              activeSection === "dashboard_kpis"
                ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500"
                : "text-slate-400 hover:text-white hover:bg-slate-800/30"
            }`}
          >
            <i className="fa-solid fa-chart-line text-emerald-400 text-sm w-5 text-center shrink-0"></i>
            <span className={`${sidebarCollapsed ? "lg:hidden" : ""}`}>Dashboard de KPIs</span>
          </button>

          {/* 1c. Portal Multi-Condomínio (portefólio de vários prédios) */}
          {["ADMIN", "EMPRESA_GESTORA", "GESTOR"].includes(loggedUser.role) && (
            <button
              id="sidebar-item-multi-condominio"
              onClick={() => {
                setActiveSection("multi_condominio");
                setViewMode("BROWSER");
                setIaInitialTab(undefined);
              }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2.5 ${
                activeSection === "multi_condominio"
                  ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              }`}
            >
              <i className="fa-solid fa-city text-emerald-400 text-sm w-5 text-center shrink-0"></i>
              <span className={`${sidebarCollapsed ? "lg:hidden" : ""}`}>Portal Multi-Condomínio</span>
            </button>
          )}

          {/* 2. Registo de Prédio (Accordion Expandível) */}
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
                <img src="/modulos/01-predio.png" alt="Prédio" className="w-5 h-5 object-contain shrink-0" />
                <span className={`${sidebarCollapsed ? "lg:hidden" : ""}`}>Registo de Prédio</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${sidebarCollapsed ? "lg:hidden" : ""} ${openMenuPredios ? "rotate-180" : ""}`}></i>
            </button>

            {openMenuPredios && (
              <div className={`pl-6 space-y-1 border-l-2 border-emerald-500/40 ml-3.5 my-1 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
                <button
                  id="submenu-predios-registos"
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
                  <span>Registos & Património</span>
                </button>

                {["ADMIN", "EMPRESA_GESTORA", "GESTOR"].includes(loggedUser.role) && (
                  <button
                    id="submenu-predios-chaves"
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
                    <span>Gestão de Chaves</span>
                  </button>
                )}

                <button
                  id="submenu-predios-regras"
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

          {/* 3. Registo de Frações (Accordion) */}
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
                <img src="/modulos/07-fracao.png" alt="Frações" className="w-5 h-5 object-contain shrink-0" />
                <span>Registo de Frações</span>
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
                  <img src="/modulos/08-piso.png" alt="Nova Fração" className="w-4 h-4 object-contain shrink-0" />
                  <span>Registar Nova Fração</span>
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
                  <img src="/modulos/11-proprietario.png" alt="Proprietário" className="w-4 h-4 object-contain shrink-0" />
                  <span>Registar Proprietário</span>
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
                  <span>Perfis de Acesso dos Condóminos</span>
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
                if (!["comunicacao_broadcast", "comunicacao_chat", "comunicacao_sondagens", "comunicacao_questionarios", "assembleias", "portal_condomino", "agendador_automatico", "agenda_notificacoes", "mural_reservas", "reservas"].includes(activeSection)) {
                  setActiveSection("comunicacao_broadcast");
                }
                setViewMode("BROWSER");
                setIaInitialTab(undefined);
              }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                ["comunicacao_broadcast", "comunicacao_chat", "comunicacao_sondagens", "comunicacao_questionarios", "portal_condomino", "assembleias", "agendador_automatico", "agenda_notificacoes", "mural_reservas", "reservas"].includes(activeSection)
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
                  <span>Agenda de Notificações</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("agendador_automatico");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "agendador_automatico"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-clock-rotate-left text-emerald-400 text-xs"></i>
                  <span>Agendador Automático de Jobs</span>
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
                {/* Só faz sentido reservar espaços comuns que o prédio
                    realmente tenha registados — antes o botão aparecia
                    sempre, mesmo em prédios sem nenhum espaço reservável. */}
                {Boolean(
                  (predioAtivo?.patrimonio as any)?.tem_piscina ||
                  (predioAtivo?.patrimonio as any)?.tem_ginasio ||
                  (predioAtivo?.patrimonio as any)?.tem_spa ||
                  (predioAtivo?.patrimonio as any)?.tem_sala_comum ||
                  (predioAtivo?.patrimonio as any)?.tem_churrasqueira ||
                  (predioAtivo?.patrimonio as any)?.tem_terraco
                ) && (
                  <button
                    onClick={() => {
                      setActiveSection("reservas");
                      setViewMode("BROWSER");
                      setIaInitialTab(undefined);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                      activeSection === "reservas"
                        ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                    }`}
                  >
                    <i className="fa-solid fa-calendar-days text-emerald-400 text-xs"></i>
                    <span>Gestão de Reservas de Espaços</span>
                  </button>
                )}
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
                  <img src="/modulos/75-mensagem.png" alt="Portal Condómino" className="w-4 h-4 object-contain shrink-0" />
                  <span>Portal & Mensagens Condómino</span>
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
                  <span>Sondagens & Votações</span>
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
                  <img src="/modulos/77-questionario.png" alt="Questionários" className="w-4 h-4 object-contain shrink-0" />
                  <span>Questionários & Inquérito</span>
                </button>
                {/* "Reuniões & Convocatórias" removido daqui — estava duplicado
                    (mesmo rótulo, mesmo ícone, mesmo destino) com o item de
                    topo "9. Reuniões & Convocatórias", que fica como único
                    acesso a esta secção. */}
              </div>
            )}
          </div>

          {/* 5. Área Financeira (Accordion) */}
          <div className="space-y-1">
            <button 
              id="sidebar-item-financeiro"
              onClick={() => {
                setOpenMenuFinanceiro(!openMenuFinanceiro);
                if (!["quotas_orcamento", "movimentos", "financeiro_recibos", "financeiro_relatorios", "relatorios_automaticos", "contabilidade_interna", "financeiro_extratos", "financeiro_mapa_pagamentos", "conciliacao", "ocr_faturas", "configuracao_arranque", "arranque_saldos", "contas", "fundo_reserva"].includes(activeSection)) {
                  setActiveSection("configuracao_arranque");
                }
                setViewMode("BROWSER");
                setIaInitialTab(undefined);
              }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                ["quotas_orcamento", "movimentos", "financeiro_recibos", "financeiro_relatorios", "relatorios_automaticos", "contabilidade_interna", "financeiro_extratos", "financeiro_mapa_pagamentos", "conciliacao", "ocr_faturas", "configuracao_arranque", "arranque_saldos", "contas", "fundo_reserva"].includes(activeSection) 
                  ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img src="/modulos/57-quota.png" alt="Área Financeira" className="w-5 h-5 object-contain shrink-0" />
                <span>Área Financeira</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openMenuFinanceiro ? "rotate-180" : ""}`}></i>
            </button>

            {openMenuFinanceiro && (
              <div className="pl-6 space-y-1 border-l-2 border-emerald-500/40 ml-3.5 my-1">
                {/* --- CONFIGURAÇÃO --- */}
                <span className="block px-3 pt-1.5 pb-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500">Configuração</span>
                {["ADMIN", "EMPRESA_GESTORA", "GESTOR"].includes(loggedUser.role) && (
                  <button
                    id="submenu-financeiro-arranque"
                    onClick={() => {
                      setActiveSection("configuracao_arranque");
                      setViewMode("BROWSER");
                      setIaInitialTab(undefined);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      activeSection === "configuracao_arranque" || activeSection === "predios_arranque" || activeSection === "arranque_saldos" || activeSection === "saldos_iniciais"
                        ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <i className="fa-solid fa-sliders text-emerald-400 text-xs shrink-0"></i>
                      <span className="truncate">Arranque & Saldos Iniciais</span>
                    </div>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-black rounded px-1.5 py-0.5 border border-emerald-400/30 shrink-0">
                      Transição
                    </span>
                  </button>
                )}
                <button
                  id="submenu-financeiro-emissao"
                  onClick={() => {
                    setActiveSection("quotas_orcamento");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "quotas_orcamento"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <img src="/modulos/62-calculadora.png" alt="Quotas & Orçamento Anual" className="w-4 h-4 object-contain shrink-0" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                  <span>Quotas & Orçamento Anual</span>
                </button>
                {/* Antes sem nenhum botão em lado nenhum que lá levasse —
                    GestaoContas.tsx estava completamente órfão. */}
                <button
                  id="submenu-financeiro-contas"
                  onClick={() => {
                    setActiveSection("contas");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "contas"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-building-columns text-emerald-400 text-xs"></i>
                  <span>Contas Bancárias</span>
                </button>

                <button
                  onClick={() => {
                    setActiveSection("ia_avancada");
                    setIaInitialTab("orcamento_anual_ia");
                    setViewMode("BROWSER");
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    activeSection === "ia_avancada" && iaInitialTab === "orcamento_anual_ia"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <i className="fa-solid fa-wand-magic-sparkles text-emerald-400 text-xs shrink-0"></i>
                    <span className="truncate">Previsão Orçamental (IA)</span>
                  </div>
                  <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-bold rounded px-1.5 py-0.5 border border-emerald-400/30 shrink-0">
                    IA
                  </span>
                </button>
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
                  <span>Emissão de Recibos</span>
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
                  <img src="/modulos/25-relatorio.png" alt="Relatórios" className="w-4 h-4 object-contain shrink-0" />
                  <span>Relatórios de Dívidas</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("relatorios_automaticos");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "relatorios_automaticos"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-file-invoice-dollar text-emerald-400 text-xs"></i>
                  <span>Relatórios Financeiros (Prestação de Contas)</span>
                </button>

                {/* --- MOVIMENTOS --- */}
                <span className="block px-3 pt-2.5 pb-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500">Movimentos</span>
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
                <button
                  onClick={() => {
                    setActiveSection("fornecedores");
                    setFornecedoresTab("dividas");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "fornecedores" && fornecedoresTab === "dividas"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-file-invoice-dollar text-emerald-400 text-xs"></i>
                  <span>Dívidas a Fornecedores</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("contabilidade_interna");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "contabilidade_interna"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-calculator text-emerald-400 text-xs"></i>
                  <span>Contabilidade Interna</span>
                </button>

                {/* --- FUNDO DE RESERVA --- */}
                <span className="block px-3 pt-2.5 pb-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500">Fundo de Reserva</span>
                {/* Antes só se chegava aqui por um separador de "IA Avançada"
                    que continha uma versão duplicada com dados inventados —
                    ver commit anterior. Esta é a ferramenta real, ligada ao
                    saldo verdadeiro das contas do tipo Poupança/Reserva. */}
                <button
                  onClick={() => {
                    setActiveSection("fundo_reserva");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "fundo_reserva"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-piggy-bank text-emerald-400 text-xs"></i>
                  <span>Fundo de Reserva</span>
                </button>

                {/* --- EXTRATOS --- */}
                <span className="block px-3 pt-2.5 pb-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500">Extratos</span>
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
                  <span>Extrato de Dívidas e Saldo</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("financeiro_mapa_pagamentos");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "financeiro_mapa_pagamentos"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-table-cells text-emerald-400 text-xs"></i>
                  <span>Mapa de Pagamentos</span>
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
                  <img src="/modulos/52-avaria-encontrada.png" alt="Incidências" className="w-4 h-4 object-contain shrink-0" />
                  <span>Incidências (enviadas pelas limpezas)</span>
                </button>
              </div>
            )}
          </div>

          {/* 7. Manutenção (Accordion) */}
          <div className="space-y-1">
            <button 
              id="sidebar-item-manutencao"
              onClick={() => {
                setOpenMenuVistoriasIntervencoes(!openMenuVistoriasIntervencoes);
                if (!["manutencao_ocorrencias", "ocorrencias", "limpezas_vistorias", "manutencao_intervencoes", "manutencao_concluidas", "manutencao_agenda", "agenda_manutencao", "inventario_tecnico"].includes(activeSection)) {
                  setActiveSection("manutencao_ocorrencias");
                }
                setViewMode("BROWSER");
                setIaInitialTab(undefined);
              }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                ["manutencao_ocorrencias", "ocorrencias", "limpezas_vistorias", "manutencao_intervencoes", "manutencao_concluidas", "manutencao_agenda", "agenda_manutencao", "inventario_tecnico"].includes(activeSection)
                  ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img src="/modulos/28-intervencao.png" alt="Manutenção" className="w-5 h-5 object-contain shrink-0" />
                <span>Manutenção</span>
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
                  <img src="/modulos/29-avaria.png" alt="Ocorrências" className="w-4 h-4 object-contain shrink-0" />
                  <span>Ocorrências</span>
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
                  <img src="/modulos/02-equipamentos-tecnicos.png" alt="Vistoria Técnica" className="w-4 h-4 object-contain shrink-0" />
                  <span>Vistoria Técnica</span>
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
                  <img src="/modulos/28-intervencao.png" alt="Intervenções" className="w-4 h-4 object-contain shrink-0" />
                  <span>Intervenções (Reparações)</span>
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
                  <img src="/modulos/39-intervencao-concluida.png" alt="Concluídas" className="w-4 h-4 object-contain shrink-0" />
                  <span>Intervenções Concluídas</span>
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
                  <span>Agenda de Manutenção</span>
                </button>

                {/* "Intervenções Extraordinárias (Obras)" saiu daqui — vivia
                    separada do Portal de Orçamentos apesar de serem passos
                    do mesmo processo (orçamento → adjudicação → obra).
                    Passa a viver só no novo menu "Obras & Contratação". */}
                <button
                  onClick={() => {
                    setActiveSection("agenda_manutencao");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "agenda_manutencao"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-clipboard-list text-emerald-400 text-xs"></i>
                  <span>Plano de Manutenção Obrigatória</span>
                </button>

                <button
                  onClick={() => {
                    setActiveSection("inventario_tecnico");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "inventario_tecnico"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-boxes-stacked text-emerald-400 text-xs"></i>
                  <span>Inventário Técnico & Arquitetura</span>
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
                  <span>Serviços contratados</span>
                </button>
                {/* "Dívidas a Fornecedores" deixou de aparecer aqui — é dinheiro
                    e passivo real do prédio, por isso só faz sentido viver na
                    área Financeira (onde continua acessível), em vez de estar
                    também aqui, a confundir onde é a "casa" da funcionalidade.
                    "Portal de Orçamentos (RFPs)" também saiu daqui — ver o
                    novo menu "Obras & Contratação". */}
              </div>
            )}
          </div>

          {/* 8b. Obras & Contratação (Accordion) — junta num só sítio todo o
              ciclo de vida de uma obra extraordinária: pedir orçamentos
              (RFP), rever propostas, adjudicar, e acompanhar a obra em
              execução. Antes vivia partido entre "Fornecedores" (Portal de
              Orçamentos) e "Manutenção" (Obras), sem nenhuma ligação visível
              entre os dois apesar de já partilharem dados reais (id_rfp/
              id_proposta na Obra criada ao adjudicar). */}
          <div className="space-y-1">
            <button
              id="sidebar-item-obras-contratacao"
              onClick={() => {
                setOpenMenuObras(!openMenuObras);
                if (!["portal_orcamentos", "manutencao_extraordinarias"].includes(activeSection)) {
                  setActiveSection("portal_orcamentos");
                }
                setViewMode("BROWSER");
                setIaInitialTab(undefined);
              }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                ["portal_orcamentos", "manutencao_extraordinarias"].includes(activeSection)
                  ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img src="/modulos/41-obra.png" alt="Obras & Contratação" className="w-5 h-5 object-contain shrink-0" />
                <span>Obras & Contratação</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openMenuObras ? "rotate-180" : ""}`}></i>
            </button>

            {openMenuObras && (
              <div className="pl-6 space-y-1 border-l-2 border-emerald-500/40 ml-3.5 my-1">
                <button
                  onClick={() => {
                    setActiveSection("portal_orcamentos");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "portal_orcamentos"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-file-invoice text-emerald-400 text-xs"></i>
                  <span>1. Concursos & Orçamentos (RFPs)</span>
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
                  <span>2. Obras Adjudicadas & Execução</span>
                </button>
              </div>
            )}
          </div>

          {/* 9. Reuniões & Convocatórias */}
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
              <img src="/modulos/80-pdf-de-resultados.png" alt="Reuniões" className="w-5 h-5 object-contain shrink-0" />
              <span>Reuniões & Convocatórias</span>
            </div>
            <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-black rounded px-1.5 py-0.5 border border-emerald-500/30">
              IA
            </span>
          </button>

          {/* 10. Área Jurídica (Accordion) */}
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
                <img src="/modulos/23-contrato.png" alt="Área Jurídica" className="w-5 h-5 object-contain shrink-0" />
                <span>Área Jurídica</span>
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
                  <img src="/modulos/23-contrato.png" alt="Carta de Não Dívida" className="w-4 h-4 object-contain shrink-0" />
                  <span>Carta de Não Dívida</span>
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
                  <span>Documentos Obrigatórios</span>
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
                  <img src="/modulos/60-nota-de-cobranca.png" alt="Cobrança" className="w-4 h-4 object-contain shrink-0" />
                  <span>Carta de Cobrança</span>
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
                  <img src="/modulos/23-contrato.png" alt="Injunção" className="w-4 h-4 object-contain shrink-0" />
                  <span>Injunção Judicial</span>
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
                  <span>Estatutos do Prédio</span>
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
                {/* "Orçamentos & Projecções" saiu daqui — vivia num menu
                    completamente separado (Consultoria IA) do resto do
                    cálculo de quotas (Financeiro → Cobrança), o que tornava
                    confuso encontrar tudo o que tem a ver com quotas/
                    orçamento. Passa a viver só em Financeiro → Cobrança →
                    "Previsão Orçamental (IA)", ao lado de Cálculo de Quotas
                    e Orçamento Anual & Emissão. */}
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
                  <span>Assistente Jurídico</span>
                </button>
                {/* "Simulador Fundo Reserva" saiu daqui — apontava para um
                    separador (ia_avancada + fundo_reserva) que continha uma
                    versão duplicada e com dados inventados (saldo fixo de
                    2150€, despesas fictícias mês a mês). A ferramenta real,
                    já ligada ao saldo verdadeiro das contas, vive agora só
                    em Financeiro → Fundo de Reserva.
                    "Bolsa de Orçamentos" saiu daqui pela mesma razão — era
                    uma segunda versão com pedidos e propostas de
                    fornecedores 100% inventados, mesmo chamando a IA real
                    de comparação sobre esses dados falsos. O Portal de
                    Orçamentos real (concursos e propostas gravados no
                    Supabase) vive agora só em Fornecedores → Portal de
                    Orçamentos. */}
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
                <button
                  onClick={() => {
                    setActiveSection("ia_importacao");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "ia_importacao"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-file-import text-emerald-400 text-xs"></i>
                  <span>Assistente de Importação (PDF/XLS)</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection("ia_classificador");
                    setViewMode("BROWSER");
                    setIaInitialTab(undefined);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-2 ${
                    activeSection === "ia_classificador"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400 pl-2.5"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <i className="fa-solid fa-shuffle text-emerald-400 text-xs"></i>
                  <span>Classificador de Documentos</span>
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
                ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500"
                : "text-slate-400 hover:text-white hover:bg-slate-800/30"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <i className="fa-solid fa-file-signature w-5 text-center text-emerald-400 text-sm"></i>
              <span>Minutas & E-mails</span>
            </div>
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black rounded-full px-1.5 py-0.5 border border-emerald-400/30 shadow-xs flex items-center justify-center min-w-[20px] h-5">
              5 Docs
            </span>
          </button>

          {/* Arquivo */}
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

          {/* Configurações IA & E-mail (Acordeão Oficial CondoManager) */}
          {["ADMIN", "EMPRESA_GESTORA", "GESTOR"].includes(loggedUser.role) && (
            <div className="space-y-1">
              <button 
                id="sidebar-item-config-ia"
                onClick={() => {
                  setOpenMenuConfiguracoesIA(!openMenuConfiguracoesIA);
                  if (!["configuracoes_ia", "configuracoes_templates", "configuracoes_notificacoes", "configuracoes_logs", "configuracoes_exportacao"].includes(activeSection)) {
                    setActiveSection("configuracoes_ia");
                  }
                  setViewMode("BROWSER");
                  setIaInitialTab(undefined);
                }}
                className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                  ["configuracoes_gerais", "configuracoes_templates", "configuracoes_ia", "configuracoes_notificacoes", "configuracoes_logs", "configuracoes_exportacao"].includes(activeSection)
                    ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500" 
                    : "text-emerald-300 hover:text-white hover:bg-slate-800/30"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <img src="/modulos/82-automacao.png" alt="Configurações IA" className="w-5 h-5 object-contain shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  <i className="fa-solid fa-envelope-circle-check w-5 text-center text-emerald-400 text-sm"></i>
                  <span className={`${sidebarCollapsed ? "lg:hidden" : ""} truncate`}>Configurações IA & E-mail</span>
                </div>
                <div className={`flex items-center gap-1.5 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
                  <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-black rounded px-1.5 py-0.5 border border-emerald-400/30 shrink-0">
                    5 Módulos
                  </span>
                  <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openMenuConfiguracoesIA ? "rotate-180" : ""}`}></i>
                </div>
              </button>

              {openMenuConfiguracoesIA && (
                <div className={`pl-6 space-y-1 border-l-2 border-emerald-500/40 ml-3.5 my-1 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
                  {/* 1. Assistente IA & Motor */}
                  <button
                    id="submenu-config-ia"
                    onClick={() => {
                      setActiveSection("configuracoes_ia");
                      setViewMode("BROWSER");
                      setIaInitialTab(undefined);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      activeSection === "configuracoes_ia"
                        ? "bg-emerald-500/25 text-emerald-200 font-bold border-l-2 border-emerald-400 pl-2.5" 
                        : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <img src="/modulos/87-ia-ativa.png" alt="IA" className="w-4 h-4 object-contain shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      <span className="truncate">Assistente IA & Motor</span>
                    </div>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[8px] font-bold rounded px-1 py-0.5 border border-emerald-400/30 shrink-0">
                      Motor Ativo
                    </span>
                  </button>

                  {/* 2. Modelos de E-mail */}
                  <button
                    id="submenu-config-templates"
                    onClick={() => {
                      setActiveSection("configuracoes_templates");
                      setViewMode("BROWSER");
                      setIaInitialTab(undefined);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      activeSection === "configuracoes_templates"
                        ? "bg-emerald-500/25 text-emerald-200 font-bold border-l-2 border-emerald-400 pl-2.5" 
                        : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <img src="/modulos/22-documento-geral.png" alt="Templates" className="w-4 h-4 object-contain shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      <span className="truncate">Modelos de E-mail</span>
                    </div>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[8px] font-bold rounded px-1 py-0.5 border border-emerald-400/30 shrink-0">
                      Oficiais
                    </span>
                  </button>

                  {/* 3. Notificações & Canais */}
                  <button
                    id="submenu-config-notificacoes"
                    onClick={() => {
                      setActiveSection("configuracoes_notificacoes");
                      setViewMode("BROWSER");
                      setIaInitialTab(undefined);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      activeSection === "configuracoes_notificacoes"
                        ? "bg-emerald-500/25 text-emerald-200 font-bold border-l-2 border-emerald-400 pl-2.5" 
                        : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <img src="/modulos/20-notificacoes-condomino-2.png" alt="Notificações" className="w-4 h-4 object-contain shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      <span className="truncate">Notificações & Canais</span>
                    </div>
                    <span className="bg-blue-500/20 text-blue-300 text-[8px] font-bold rounded px-1 py-0.5 border border-blue-400/30 shrink-0">
                      Canais
                    </span>
                  </button>

                  {/* 4. Log de Sistema */}
                  <button
                    id="submenu-config-logs"
                    onClick={() => {
                      setActiveSection("configuracoes_logs");
                      setViewMode("BROWSER");
                      setIaInitialTab(undefined);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      activeSection === "configuracoes_logs"
                        ? "bg-emerald-500/25 text-emerald-200 font-bold border-l-2 border-emerald-400 pl-2.5" 
                        : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <img src="/modulos/86-logs.png" alt="Logs" className="w-4 h-4 object-contain shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      <span className="truncate">Log de Sistema</span>
                    </div>
                    <span className="bg-amber-500/20 text-amber-300 text-[8px] font-bold rounded px-1 py-0.5 border border-amber-400/30 shrink-0">
                      Auditoria
                    </span>
                  </button>

                  {/* 5. Exportação & Backups */}
                  <button
                    id="submenu-config-exportacao"
                    onClick={() => {
                      setActiveSection("configuracoes_exportacao");
                      setViewMode("BROWSER");
                      setIaInitialTab(undefined);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      activeSection === "configuracoes_exportacao"
                        ? "bg-emerald-500/25 text-emerald-200 font-bold border-l-2 border-emerald-400 pl-2.5" 
                        : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <img src="/modulos/26-exportacao.png" alt="Exportação" className="w-4 h-4 object-contain shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      <span className="truncate">Exportação & Backups</span>
                    </div>
                    <span className="bg-teal-500/20 text-teal-300 text-[8px] font-bold rounded px-1 py-0.5 border border-teal-400/30 shrink-0">
                      Segurança
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 13b. Auditoria Interna — antes só era possível chegar aqui uma
              vez, trocando o perfil de demonstração para "AUDITOR" (o
              redireciona automaticamente), sem nenhum botão para lá voltar
              depois de sair. */}
          {["ADMIN", "EMPRESA_GESTORA", "GESTOR", "AUDITOR"].includes(loggedUser.role) && (
            <button
              id="sidebar-item-auditoria-interna"
              onClick={() => {
                setActiveSection("auditoria_interna");
                setViewMode("BROWSER");
                setIaInitialTab(undefined);
              }}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2.5 ${
                activeSection === "auditoria_interna"
                  ? "bg-emerald-600 text-white font-extrabold shadow-sm border border-emerald-500"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/30"
              }`}
            >
              <i className="fa-solid fa-magnifying-glass-chart text-emerald-400 text-sm w-5 text-center shrink-0"></i>
              <span className={`${sidebarCollapsed ? "lg:hidden" : ""}`}>Auditoria Interna</span>
            </button>
          )}

          {/* 14. Segurança & Credenciais (Último lugar da coluna central/sidebar) */}
          <button 
            id="sidebar-item-seguranca"
            onClick={() => setUserProfileModalOpen(true)}
            className="w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-between gap-2.5 text-emerald-400 hover:text-white hover:bg-slate-800/40 border border-slate-800/80 hover:border-emerald-500/40 bg-slate-900/60 shadow-xs group"
          >
            <div className="flex items-center gap-2.5">
              <img src="/estados-acoes/18-seguranca.png" alt="Segurança" className="w-5 h-5 object-contain shrink-0 group-hover:scale-110 transition-transform" />
              <span className="font-extrabold">Segurança & Acessos</span>
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
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Definições</span>
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
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
            <div className="flex items-center space-x-2 overflow-hidden">
              <div className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0 overflow-hidden" title={loggedUser.nome}>
                {(() => {
                  // Antes mostrava sempre o ícone genérico da app — procura
                  // a fotografia real de quem está autenticado (proprietário,
                  // coproprietário, inquilino ou um admin que também seja
                  // proprietário registado de alguma fração).
                  const fotoUtilizador = encontrarFotoDoUtilizador(fracoes, loggedUser);
                  return fotoUtilizador ? (
                    <img src={fotoUtilizador} alt={loggedUser.nome} className="h-full w-full object-cover" />
                  ) : (
                    <img src="/marca/21-icone-sem-moldura.png" alt="CondoManager App Icon" className="h-full w-full object-contain p-0.5" />
                  );
                })()}
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
      )}

      {/* ÁREA DE TRABALHO PRINCIPAL (ADAPTÁVEL A MOBILE E DESKTOP) */}
      <main className={`flex-1 min-w-0 flex flex-col h-full overflow-hidden relative transition-all duration-300 ${theme === "dark" ? "bg-[#0b0f19]" : "bg-slate-50"}`}>
        {/* Header superior — mantido sempre visível mesmo na vista PWA:
            é aqui que fica o botão real de terminar sessão
            (handleSecureLogout). O "Sair" dentro do PWASimulator é só um
            estado local do simulador, não termina a sessão real — sem esta
            barra, um condómino ficava sem forma nenhuma de sair da conta. */}
        <header className={`h-16 px-3 sm:px-6 md:px-8 flex items-center justify-between shrink-0 z-10 no-print transition-all duration-300 ${theme === "dark" ? "bg-[#111827] border-b border-slate-800 text-slate-100" : "bg-white border-b border-slate-200 text-slate-800"}`}>
          <div className="flex items-center space-x-2 sm:space-x-3 overflow-hidden pr-2">
            {/* Botão de Menu Mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-emerald-400 border border-slate-700 flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer shrink-0 shadow-sm"
              title="Abrir / Fechar Menu de Navegação"
            >
              <i className={`fa-solid ${mobileMenuOpen ? "fa-xmark" : "fa-bars"} text-sm`}></i>
              <span className="hidden sm:inline">Menu</span>
            </button>

            {/* Botão Desktop para expandir/recolher coluna central no topo */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex items-center justify-center h-8 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shrink-0 shadow-xs gap-1.5 text-xs font-bold"
              title={sidebarCollapsed ? "Expandir Menu de Operações (Coluna Central)" : "Recolher Menu de Operações (Coluna Central)"}
            >
              {sidebarCollapsed ? (
                <>
                  <PanelLeftOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Expandir Menu</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Recolher Menu</span>
                </>
              )}
            </button>

            <div className="overflow-hidden">
              <h2 className={`text-xs sm:text-base md:text-xl font-bold transition-colors duration-300 truncate ${theme === "dark" ? "text-white" : "text-slate-800"}`}>
                {activeSection === "painel" && "Painel de Controlo"}
                {activeSection === "predios" && "Registo de Prédio"}
                {(activeSection === "fracoes" || activeSection === "fracoes_nova" || activeSection === "fracoes_proprietario" || activeSection === "fracoes_perfis") && "Gestão de Frações, Proprietários & Perfis"}
                {activeSection === "fornecedores" && "Fichas de Fornecedores"}
                {activeSection === "contas" && "Contas Bancárias do Condomínio"}
                {activeSection === "quotas_orcamento" && "Quotas & Orçamento Anual"}
                {activeSection === "movimentos" && "Registo de Movimentos Financeiros"}
                {activeSection === "financeiro_recibos" && "Emissão de Recibos Manuais (100% Editável)"}
                {activeSection === "financeiro_relatorios" && "Relatórios de Dívidas (por Condómino & Pro Condomínio)"}
                {activeSection === "financeiro_mapa_pagamentos" && "Mapa de Pagamentos por Fração & Mês"}
                {activeSection === "relatorios_automaticos" && "Relatórios Financeiros (Prestação de Contas)"}
                {activeSection === "contabilidade_interna" && "Contabilidade Interna"}
                {activeSection === "agenda_manutencao" && "Plano de Manutenção Obrigatória"}
                {activeSection === "auditoria_interna" && "Auditoria Interna"}
                {activeSection === "agendador_automatico" && "Agendador Automático de Jobs"}
                {activeSection === "financeiro_extratos" && "Extrato de Movimentos e Saldo (Visão Condómino)"}
                {activeSection === "conciliacao" && "Motor de Inteligência Artificial para Conciliação"}
                {activeSection === "assembleias" && "Reuniões e Convocatórias (Elaboradas Manualmente ou com Auxílio de IA)"}
                {activeSection === "reservas" && "Agenda & Reservas de Espaços Comuns"}
                {(activeSection === "documentos" || activeSection === "arquivo") && "Arquivo Digital (Anos & Temas)"}
                {activeSection === "ocorrencias" && "Gestão de Ocorrências e Avarias"}
                {(activeSection === "vistorias_limpezas" || activeSection === "limpezas_vistorias") && "Manutenção • Vistorias & Higienização"}
                {activeSection === "ia_avancada" && "Central de Inteligência Artificial Avançada"}
                {activeSection === "ia_importacao" && "Assistente de Importação Global por IA (PDF/XLS)"}
                {activeSection === "ia_classificador" && "Classificador Geral de Documentos por IA"}
                {activeSection === "contencioso_juridico" && "Resumo de Contencioso & Prazos Legais"}
                {activeSection === "contencioso_juridico_processos" && "Constituição de Processos Judiciais & Acervo Probatório"}
                {activeSection === "contencioso_juridico_nd" && "Carta de Não Dívida (Art. 54.º-A do DL 268/94)"}
                {activeSection === "contencioso_juridico_doc_obrig" && "Documentos Obrigatórios do Condomínio"}
                {activeSection === "contencioso_juridico_cartas" && "Carta de Cobrança (Notificação AR Regimental)"}
                {activeSection === "contencioso_juridico_bni" && "Injunção Judicial Civil & Requerimento BNI"}
                {activeSection === "contencioso_juridico_regulamento" && "Regulamento Interno do Edifício"}
                {activeSection === "contencioso_juridico_estatutos" && "Estatutos do Prédio & Propriedade Horizontal"}
                {activeSection === "contencioso_juridico_ia" && "Assistente IA de Contencioso & Minutas Legais"}
                {activeSection === "obras_futuras" && "Obras Futuras & Fundo Extraordinário"}
                {activeSection === "ficha_gestora" && "Ficha da Empresa Gestora (White-Label)"}
                {activeSection === "portal_condomino" && "Portal do Condómino & Perfis"}
                {activeSection === "portal_orcamentos" && "Concursos de Obras & Portal de Orçamentos"}
                {activeSection === "dashboard_kpis" && "Dashboard de KPIs do Prédio"}
                {activeSection === "multi_condominio" && "Portal Multi-Condomínio Integrado"}
                {activeSection === "configuracoes_gerais" && "Configurações Gerais do Edifício"}
                {activeSection === "configuracoes_templates" && "Modelos Oficiais de E-mail & Notificações"}
                {activeSection === "configuracoes_ia" && "Configurações do Assistente IA e Autoresponder"}
                {activeSection === "configuracoes_notificacoes" && "Configurações de Notificações & Canais"}
                {activeSection === "configuracoes_logs" && "Registo de Atividade & Log de Sistema"}
                {activeSection === "configuracoes_exportacao" && "Exportação Global de Dados & Backups"}
                {activeSection === "inventario_tecnico" && "Inventário Técnico e Arquitetura do Prédio"}
                {activeSection === "manutencao_ocorrencias" && "Ocorrências & Avarias Reportadas"}
                {activeSection === "manutencao_agenda" && "Agenda de Manutenção & Vistorias"}
                {activeSection === "manutencao_intervencoes" && "Intervenções (Pequenas Reparações)"}
                {activeSection === "manutencao_extraordinarias" && "Intervenções Extraordinárias (Grandes Obras)"}
                {activeSection === "manutencao_concluidas" && "Histórico de Manutenções Concluídas"}
                {activeSection === "manutencao_arquivo" && "Arquivo Documental Registado"}
              </h2>
              <p className={`text-[10px] sm:text-xs transition-colors duration-300 truncate ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                Isolamento Multi-Prédio: {predioAtivo?.id_predio !== "predio-temp" && (predioAtivo?.nome || predioAtivo?.morada_linha1) ? (predioAtivo.nome || `${predioAtivo.morada_linha1} ${predioAtivo.num_porta || ""}`) : "Base Limpa (Aguardando Dados)"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
            <span className={`hidden sm:inline-block text-[11px] font-mono-custom font-medium px-2 py-0.5 rounded border transition-colors duration-300 ${theme === "dark" ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
              NIF: {predioAtivo?.id_predio !== "predio-temp" ? predioAtivo?.nif : "---"}
            </span>
            <div className={`hidden sm:block h-6 w-px transition-colors duration-300 ${theme === "dark" ? "bg-slate-800" : "bg-slate-200"}`}></div>
            <button
              type="button"
              onClick={() => carregarDadosReais()}
              disabled={aAtualizarGlobal}
              title="Atualizar dados agora"
              className={`hidden lg:flex items-center gap-1.5 text-[11px] font-mono-custom px-2 py-0.5 rounded border transition-colors duration-300 disabled:opacity-60 cursor-pointer ${theme === "dark" ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700" : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"}`}
            >
              <i className={`fa-solid fa-rotate ${aAtualizarGlobal ? "animate-spin" : ""}`}></i>
              <span>{aAtualizarGlobal ? "A atualizar…" : `Atualizado às ${ultimaAtualizacaoGlobal.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`}</span>
            </button>
            <div className={`hidden lg:block h-6 w-px transition-colors duration-300 ${theme === "dark" ? "bg-slate-800" : "bg-slate-200"}`}></div>
            <span className={`hidden md:flex text-[11px] ${getColorClasses("bgLight")} ${getColorClasses("text")} font-semibold px-2 py-0.5 rounded border ${getColorClasses("border")} items-center transition-all duration-300`}>
              <span className={`h-1.5 w-1.5 rounded-full ${getColorClasses("bg")} mr-1 animate-pulse`}></span>
              {loggedUser.role === "ADMIN" ? "👑 Admin" : 
               loggedUser.role === "EMPRESA_GESTORA" ? "🏢 Gestora" :
               loggedUser.role === "USER" ? "🏠 Condómino" :
               loggedUser.role === "INQUILINO" ? "🔑 Inquilino" :
               loggedUser.role === "TECNICO" ? "🔍 Técnico" :
               loggedUser.role === "LIMPEZAS" ? "🧹 Limpezas" : 
               loggedUser.role === "JURIDICO" ? "⚖️ Jurídico" :
               loggedUser.role === "AUDITOR" ? "🕵️ Auditor" : "📈 Contabilista"}
            </span>

            <button
              id="header-btn-logout"
              onClick={() => handleSecureLogout()}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border border-red-500 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-sm hover:scale-105 active:scale-95 shrink-0"
              title="Terminar Sessão (Voltar ao Ecrã Inicial)"
            >
              <img src="/estados-acoes/17-desligar.png" alt="Sair" className="h-5 w-5 object-contain shrink-0" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        {/* Conteúdo Dinâmico (Responsivo para Telemóveis e Desktops) */}
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
            <Fragment key={grupoMenuPrincipal}>
              {activeSection === "ficha_gestora" && (
                <FichaEmpresaGestora
                  predios={predios}
                  fracoes={fracoes}
                  avisos={avisos}
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
                  predios={predios}
                  contas={contas} 
                  fracoes={fracoes} 
                  movements={movements} 
                  avisos={avisos}
                  documentosCount={predioAtivo?.id_predio && predioAtivo.id_predio !== "predio-temp" ? documentos.filter(d => d.id_predio === predioAtivo.id_predio).length : 0}
                  fornecedoresCount={predioAtivo?.id_predio && predioAtivo.id_predio !== "predio-temp" ? fornecedores.filter(f => f.id_predio === predioAtivo.id_predio).length : 0}
                  obrasCount={obrasAtivasCount}
                  limpezasCount={limpezaAreasCount}
                  alertasJuridicosCount={alertasJuridicosAtivosCount}
                  sondagensCount={sondagensAtivasCount}
                  ocorrenciasCount={predioAtivo?.id_predio && predioAtivo.id_predio !== "predio-temp" ? ocorrencias.filter(o => o.id_predio === predioAtivo.id_predio).length : 0}
                  reservasCount={predioAtivo?.id_predio && predioAtivo.id_predio !== "predio-temp" ? reservas.filter(r => r.id_predio === predioAtivo.id_predio).length : 0}
                  mensagensCount={mensagensPendentesCount}
                  notificacoesCount={0}
                  dividasPendentesValor={dividasFornecedoresPendentesValor}
                  onSelectSection={selectSection}
                  isAdmin={["ADMIN", "EMPRESA_GESTORA", "GESTOR"].includes(loggedUser.role)}
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
              documentos={documentos}
              setDocumentos={setDocumentos}
            />
          )}

          {activeSection === "fornecedores" && (
            <GestaoFornecedores
              predio={predioAtivo}
              fornecedores={fornecedores}
              onAddFornecedor={handleAddFornecedor}
              onRemoveFornecedor={handleRemoveFornecedor}
              loggedUser={loggedUser}
              initialTab={fornecedoresTab}
              contas={contas}
              setContas={setContas}
              movements={movements}
              setMovements={setMovements}
            />
          )}

          {activeSection === "contas" && (
            <GestaoContas 
              predio={predioAtivo} 
              contas={contas} 
              onAddConta={handleAddConta}
              onUpdateConta={handleUpdateConta}
              onSetPrincipalConta={handleSetPrincipalConta}
              onDeleteConta={(id) => setContas(contas.filter(c => c.id_conta !== id))}
              loggedUser={loggedUser}
            />
          )}

          {activeSection === "quotas_orcamento" && (
            <GestaoQuotasOrcamento
              predio={predioAtivo}
              fracoes={fracoes}
              avisos={avisos}
              setAvisos={setAvisos}
              contas={contas}
              setContas={setContas}
              movements={movements}
              setMovements={setMovements}
              documentos={documentos}
              setDocumentos={setDocumentos}
              loggedUser={loggedUser}
              reunioes={reunioes}
            />
          )}

          {activeSection === "movimentos" && (
            <GestaoMovimentos
              predio={predioAtivo}
              contas={contas}
              movements={movements}
              setMovements={setMovements}
              fracoes={fracoes}
              avisos={avisos}
              setAvisos={setAvisos}
              fornecedores={fornecedores}
              setFornecedores={setFornecedores}
              loggedUser={loggedUser}
            />
          )}

          {["financeiro_recibos", "financeiro_relatorios", "financeiro_extratos", "financeiro_mapa_pagamentos"].includes(activeSection) && (
            <FinanceiroAvancado
              predio={predioAtivo}
              fracoes={fracoes}
              avisos={avisos}
              contas={contas}
              movimentos={movements}
              setDocumentos={setDocumentos}
              loggedUser={loggedUser}
              activeSubSection={activeSection as any}
              initialTab={
                activeSection === "financeiro_recibos" ? "recibos_manuais" :
                activeSection === "financeiro_relatorios" ? "relatorio_dividas" :
                activeSection === "financeiro_extratos" ? "extrato_saldos" :
                activeSection === "financeiro_mapa_pagamentos" ? "mapa_pagamentos" : "recibos_manuais"
              }
            />
          )}

          {activeSection === "fundo_reserva" && (
            <GestaoFundoReserva
              predio={predioAtivo}
              loggedUser={loggedUser}
              contas={contas}
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
              avisos={avisos}
              onAddDocumento={handleAddDocumento}
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
                alert("✨ Despesa/Movimento registado automaticamente pela IA nos Movimentos!");
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
              onAddDocumento={handleAddDocumento}
              documentos={documentos}
              avisos={avisos}
              movements={movements}
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

          {activeSection === "ia_classificador" && (
            <ClassificadorDocumentos
              predio={predioAtivo}
              fracoes={fracoes}
              contas={contas}
              setContas={setContas}
              movements={movements}
              setMovements={setMovements}
              documentos={documentos}
              setDocumentos={setDocumentos}
              loggedUser={loggedUser}
              onNavigate={(secao) => { setActiveSection(secao); setViewMode("BROWSER"); }}
            />
          )}

          {["configuracoes_gerais", "configuracoes_templates", "configuracoes_ia", "configuracoes_notificacoes", "configuracoes_logs", "configuracoes_exportacao"].includes(activeSection) && (
            <ConfiguracoesAdministracao 
              predio={predioAtivo}
              predios={predios}
              loggedUser={loggedUser}
              documentos={documentos}
              movimentos={movements}
              fracoes={fracoes}
              activeSubSection={
                activeSection === "configuracoes_templates" ? "templates" :
                activeSection === "configuracoes_ia" ? "ia" :
                activeSection === "configuracoes_notificacoes" ? "notificacoes" :
                activeSection === "configuracoes_logs" ? "logs" :
                activeSection === "configuracoes_exportacao" ? "exportacao" :
                "gerais"
              }
              setActiveSubSection={(sub) => {
                if (sub === "templates") setActiveSection("configuracoes_templates");
                else if (sub === "ia") setActiveSection("configuracoes_ia");
                else if (sub === "notificacoes") setActiveSection("configuracoes_notificacoes");
                else if (sub === "logs") setActiveSection("configuracoes_logs");
                else if (sub === "exportacao") setActiveSection("configuracoes_exportacao");
                else setActiveSection("configuracoes_gerais");
              }}
              onUpdatePredio={handleUpdatePredio}
              onDeletePredio={handleDeletePredio}
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
                activeSection === "contencioso_juridico_bni" ? "injuncões" :
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
              setContas={setContas}
              loggedUser={loggedUser}
              setLoggedUser={setLoggedUser}
            />
          )}

          {activeSection === "portal_orcamentos" && (
            <PortalOrcamentos
              predio={predioAtivo}
              fracoes={fracoes}
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
              documentos={documentos}
              setDocumentos={setDocumentos}
              activeTab={activeSection === "simulador_emails" ? "simulador_emails" : "minutas_oficiais"}
              onSelectTab={(tab) => setActiveSection(tab)}
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
              documentos={documentos}
              setDocumentos={setDocumentos}
              onConcluir={() => setActiveSection("painel")}
              onUpdatePredio={handleUpdatePredio}
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
            </Fragment>
          )}
        </div>
      </main>

      {/* GLOBAL USER SECURITY MODAL */}
      <UserSecurityModal
        isOpen={userProfileModalOpen}
        onClose={() => setUserProfileModalOpen(false)}
        loggedUser={loggedUser}
        idPredio={predioAtivo?.id_predio}
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
