import React, { useState, useMemo } from "react";
import { 
  Search, 
  BookOpen, 
  Video, 
  Smartphone, 
  Monitor, 
  Download, 
  CheckCircle2, 
  Play, 
  RotateCcw, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  CreditCard, 
  Building2, 
  Sparkles,
  Users,
  Wrench,
  Scale,
  DollarSign
} from "lucide-react";
import { Documento } from "../types";

interface EnciclopediaPlataformaProps {
  documentos: Documento[];
  onOpenManual?: (doc: Documento) => void;
  userRole?: string;
}

interface TopicoEnciclopedia {
  id: string;
  categoria: "pwa" | "desktop" | "financas" | "predios" | "ia" | "juridico" | "manutencao";
  titulo: string;
  perfilRecomendado: string;
  resumo: string;
  conteudoDetalhado: string[];
  passos?: string[];
  dicaPro?: string;
  videoRelacionadoId?: string;
  manualRelacionadoDocId?: string;
}

export function EnciclopediaPlataforma({ documentos, onOpenManual }: EnciclopediaPlataformaProps) {
  const [termoBusca, setTermoBusca] = useState("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>("todas");
  const [topicoAbertoId, setTopicoAbertoId] = useState<string | null>("topico-pwa-instalacao");
  const [videoAtivoId, setVideoAtivoId] = useState<string>("video-pwa-instalacao");
  const [videoProgresso, setVideoProgresso] = useState<number>(0);
  const [videoReproduzindo, setVideoReproduzindo] = useState<boolean>(false);

  // Lista de Vídeos Demonstrativos Interativos
  const videosDemonstrativos = [
    {
      id: "video-pwa-instalacao",
      titulo: "1. Instalação da PWA no Telemóvel (iOS Safari & Android)",
      duracao: "2:45 min",
      nivel: "Essencial para Todos os Residentes",
      descricao: "Guia visual mostrando como adicionar a aplicação ao ecrã principal do telemóvel com o ícone oficial 'Condomínio', sem necessidade de aceder à App Store ou Google Play.",
      passos: [
        "No iPhone: Abra o Safari, toque no botão de Partilha (ícone com seta para cima) e escolha 'Ecrã principal'.",
        "No Android: Abra o Chrome, clique nos 3 pontos verticais ou no banner que surge no fundo e selecione 'Instalar aplicação'.",
        "O ícone oficial CondoManager AI fica guardado no ecrã como uma app nativa com o nome 'Condomínio'.",
        "Abra o atalho: o ecrã abre em ecrã completo (fullscreen), sem barras de browser e com arranque ultra-rápido."
      ],
      etapasSimuladas: [
        { tempo: 0, titulo: "Aceder ao endereço do condomínio no navegador do telemóvel" },
        { tempo: 25, titulo: "Localizar botão Partilhar / Menu de opções do browser" },
        { tempo: 50, titulo: "Selecionar 'Adicionar ao Ecrã Principal' com nome 'Condomínio'" },
        { tempo: 75, titulo: "Confirmar: ícone oficial verde de 512x512 px gerado no telemóvel" },
        { tempo: 100, titulo: "Concluído: Acesso direto com 1 toque em qualquer lugar!" }
      ]
    },
    {
      id: "video-pwa-condomino",
      titulo: "2. Utilização Diária da PWA pelo Condómino / Inquilino",
      duracao: "3:15 min",
      nivel: "Condóminos e Inquilinos",
      descricao: "Demonstração das tarefas habituais: autenticação inicial com PIN provisório, liquidação de quotas por MB WAY, envio de comprovativo WebP e reporte de avaria na câmara.",
      passos: [
        "Login simples: utilize o seu e-mail e a palavra-passe provisória enviada pela Administração.",
        "Consultar Conta-Corrente: visualize recibos emitidos e quotas a pagamento no ecrã inicial.",
        "Pagamento imediato: gere Referência Multibanco ou toque em 'Pagar com MB WAY' para aprovar no telemóvel.",
        "Reportar anomalia: fotografe uma luz fundida ou infiltração e envie à administração em 10 segundos."
      ],
      etapasSimuladas: [
        { tempo: 0, titulo: "Ecrã inicial do condómino com saldo atual e aviso de quota" },
        { tempo: 25, titulo: "Clique em 'Pagar Quota' e escolha de MB WAY instantâneo" },
        { tempo: 50, titulo: "Fotografia do comprovativo comprimida automaticamente em WebP" },
        { tempo: 75, titulo: "Reporte de avaria com câmara e descrição de áudio/texto" },
        { tempo: 100, titulo: "Notificação de confirmação e recibo arquivado na hora" }
      ]
    },
    {
      id: "video-desktop-admin",
      titulo: "3. Painel de Controlo Desktop para Administradores & Gestores",
      duracao: "4:10 min",
      nivel: "Administradores e Empresas",
      descricao: "Visão geral da gestão no PC: os 13 indicadores em tempo real, importação de extratos bancários, conciliação IA e arquivo documental em pastas automáticas.",
      passos: [
        "Acompanhar os 13 indicadores vitais do prédio num relance (frações, saldo, quotas e obras).",
        "Registo de prédio e frações com cálculo automático de permilagens decimais e por milhar.",
        "Arraste do extrato bancário (PDF ou CSV) para a IA reconciliar receitas e despesas.",
        "Emissão de convocatórias de assembleia e envio simultâneo de e-mails com minuta oficial."
      ],
      etapasSimuladas: [
        { tempo: 0, titulo: "Navegação pelos 13 Indicadores de gestão no Dashboard" },
        { tempo: 30, titulo: "Adicionar condomínio e configurar contas bancárias" },
        { tempo: 60, titulo: "Lançamento de quotas em lote e avisos automáticos" },
        { tempo: 85, titulo: "Arquivo digital categorizado por ano e fornecedor" },
        { tempo: 100, titulo: "Exportação de balancetes e relatórios oficiais em PDF" }
      ]
    }
  ];

  // Base de Conhecimento da Enciclopédia
  const baseTopicos: TopicoEnciclopedia[] = [
    {
      id: "topico-pwa-instalacao",
      categoria: "pwa",
      titulo: "Como Instalar e Configurar o Atalho PWA no Telemóvel",
      perfilRecomendado: "Todos os Perfis (Condómino, Administrador, Prestador)",
      resumo: "Instruções completas para criar o atalho da app no ecrã do telemóvel sem passar pela App Store ou Google Play.",
      conteudoDetalhado: [
        "A aplicação CondoManager AI foi desenvolvida como uma PWA (Progressive Web App) de última geração.",
        "Isso significa que funciona exatamente como uma aplicação nativa descarregada da loja de aplicações, mas sem ocupar espaço desnecessário no telemóvel e com atualizações sempre instantâneas.",
        "O ícone oficial configurado no manifesto tem alta resolução (512x512 píxeis) e suporte para ícones adaptativos (maskable) no Android e iOS."
      ],
      passos: [
        "1. Abra o navegador do seu telemóvel (Safari no iPhone ou Chrome no Android) e aceda ao link do condomínio.",
        "2. No iPhone (Safari): carregue no botão Partilhar (quadrado com seta para cima) na barra inferior e deslize até 'Adicionar ao Ecrã Principal'.",
        "3. No Android (Chrome): carregue nos 3 pontos no canto superior direito e escolha 'Instalar aplicação' ou 'Adicionar ao ecrã inicial'.",
        "4. O nome que surge automaticamente no ícone é 'Condomínio'. Confirme a criação.",
        "5. O ícone oficial CondoManager AI passa a estar disponível no seu ecrã inicial!"
      ],
      dicaPro: "Se tiver dificuldades em encontrar a opção no Safari, certifique-se de que não está no modo de navegação privada.",
      videoRelacionadoId: "video-pwa-instalacao",
      manualRelacionadoDocId: "doc-manual-instalacao-pwa"
    },
    {
      id: "topico-login-pin",
      categoria: "pwa",
      titulo: "Primeiro Acesso com Senha Provisória e Segurança",
      perfilRecomendado: "Condóminos, Inquilinos e Fornecedores",
      resumo: "Como iniciar sessão na plataforma pela primeira vez e definir uma nova palavra-passe segura.",
      conteudoDetalhado: [
        "Quando a administração regista uma fração ou fornecedor, o sistema gera automaticamente uma credencial provisória enviada por e-mail ou notificação.",
        "Ao entrar com a credencial provisória, o sistema solicita imediatamente a criação de uma nova palavra-passe personalizada.",
        "A plataforma suporta biometria (Face ID / Impressão Digital) nos telemóveis compatíveis para entradas subsequentes em 1 segundo."
      ],
      passos: [
        "1. Insira o seu e-mail cadastrado e a palavra-passe provisória recebida.",
        "2. No ecrã de segurança, digite a sua nova palavra-passe de acesso.",
        "3. Se o seu telemóvel tiver leitor de impressão digital ou Face ID, ative o 'Acesso Biométrico' para entrar sem digitar senha."
      ],
      dicaPro: "Nunca partilhe a sua palavra-passe com terceiros. A administração nunca lhe pedirá a sua palavra-passe por telefone.",
      manualRelacionadoDocId: "doc-manual-condomino"
    },
    {
      id: "topico-pagamento-mbway",
      categoria: "financas",
      titulo: "Liquidação de Quotas: MB WAY, Referência Multibanco e Transferência",
      perfilRecomendado: "Condóminos e Inquilinos",
      resumo: "Métodos de liquidação disponíveis no portal e envio instantâneo do comprovativo de pagamento.",
      conteudoDetalhado: [
        "O condomínio disponibiliza métodos modernos de liquidação para facilitar a regularização de quotas ordinárias e extraordinárias.",
        "O pagamento via MB WAY envia um pedido de validação diretamente para a aplicação do seu telemóvel.",
        "As referências Multibanco permitem pagamento no Homebanking ou nas caixas da rede Multibanco com total segurança."
      ],
      passos: [
        "1. Na PWA ou no computador, clique na sua fração e consulte os valores pendentes.",
        "2. Clique em 'Liquidar Quota' e selecione o método pretendido (MB WAY ou Multibanco).",
        "3. Se efetuar por transferência bancária tradicional, utilize o botão 'Enviar Comprovativo' para anexar a foto ou PDF do talão.",
        "4. A inteligência artificial lê os dados do documento e notifica a administração de imediato."
      ],
      dicaPro: "Ao enviar o comprovativo fotográfico pelo telemóvel, a imagem é comprimida automaticamente para WebP para poupar os seus dados móveis.",
      videoRelacionadoId: "video-pwa-condomino",
      manualRelacionadoDocId: "doc-manual-condomino"
    },
    {
      id: "topico-registo-predio-fracoes",
      categoria: "predios",
      titulo: "Como Criar um Prédio, Frações e Permilagens",
      perfilRecomendado: "Administradores e Empresas Gestoras",
      resumo: "Passo a passo para registar o edifício, definir morada, NIF e lançar as frações com permilagem exata.",
      conteudoDetalhado: [
        "O módulo 'Registo de Prédios' permite cadastrar novos edifícios com morada completa, código postal com autopreenchimento de localidade e NIF oficial.",
        "No submenu isolado 'Arranque & Saldos', situado imediatamente a seguir a 'Registos & Património', pode definir as contas bancárias existentes, o saldo de abertura e os saldos devedores ou credores de cada fração.",
        "As frações suportam identificação de letra/andar, permilagem decimal e vinculação dos contactos do proprietário e inquilino."
      ],
      passos: [
        "1. No menu lateral, aceda a 'Registo de Prédio' > 'Registos & Património'.",
        "2. Preencha o nome do condomínio, NIF e morada oficial.",
        "3. Em 'Frações & Permilagens', adicione as frações garantindo que a soma das permilagens totaliza 1000‰.",
        "4. Configure os saldos no submenu 'Arranque & Saldos' (imediatamente a seguir a Registos & Património) antes de iniciar as emissões regulares."
      ],
      dicaPro: "Utilize o botão de importação assistida se tiver os dados das frações numa folha de cálculo Excel ou CSV.",
      videoRelacionadoId: "video-desktop-admin",
      manualRelacionadoDocId: "doc-manual-admin"
    },
    {
      id: "topico-conciliacao-ia",
      categoria: "ia",
      titulo: "Conciliação Bancária Inteligente e Reconhecimento de Faturas",
      perfilRecomendado: "Administradores, Contabilidade e Auditoria",
      resumo: "Como utilizar o motor de IA para correlacionar extratos bancários com quotas pagas e faturas de fornecedores.",
      conteudoDetalhado: [
        "O assistente inteligente de conciliação analisa os movimentos bancários importados e compara montantes, descritivos e datas com as frações e fornecedores registados.",
        "Quando encontra uma correspondência com grau de confiança superior a 90%, sugere a conciliação com 1 clique.",
        "Faturas de fornecedores (como EDP, elevadores ou limpezas) podem ser lidas via OCR para lançamento automático de despesa."
      ],
      passos: [
        "1. Aceda ao módulo 'Finanças' > 'Conciliação Bancária IA'.",
        "2. Arraste o ficheiro de extrato do seu banco.",
        "3. Reveja as sugestões da IA assinaladas a verde.",
        "4. Clique em 'Aprovar Conciliações' para atualizar a conta-corrente das frações e gerar recibos definitivos."
      ],
      dicaPro: "Ficheiros bancários em formato CSV ou PDF oficial dos principais bancos portugueses são interpretados instantaneamente.",
      manualRelacionadoDocId: "doc-manual-contabilidade"
    },
    {
      id: "topico-arquivo-pastas",
      categoria: "desktop",
      titulo: "Estrutura do Arquivo Digital e Pastas Pré-configuradas",
      perfilRecomendado: "Todos os Perfis de Gestão e Auditoria",
      resumo: "Organização documental automática: faturas, apólices de seguro, atas deliberativas e relatórios de contas.",
      conteudoDetalhado: [
        "O Arquivo Digital do CondoManager AI elimina pastas desorganizadas através de 7 categorias estruturadas:",
        "• Recibos e Quotas • Faturas Diversas • Fornecedores & Contratos • Atas & Convocatórias • Seguros & Apólices • Manuais & Guias Operacionais • Obras & Vistorias Técnicas.",
        "Todos os manuais ilustrados oficiais ficam permanentemente na pasta 'Manuais & Guias Operacionais' com acesso direto por perfil."
      ],
      passos: [
        "1. No menu principal, clique em 'Arquivo'.",
        "2. Utilize a barra superior de pesquisa para procurar por palavra-chave, fornecedor ou ano.",
        "3. Clique numa das pastas temáticas para visualizar os documentos classificados.",
        "4. Utilize o botão 'Submeter Documento' para carregar novos ficheiros com arquivamento inteligente por IA."
      ],
      dicaPro: "Ao arrastar um ficheiro, o motor de inteligência artificial lê o título e sugere a pasta e o ano de arquivamento adequados.",
      manualRelacionadoDocId: "doc-manual-completo-passo-a-passo"
    },
    {
      id: "topico-assembleias-virtuais",
      categoria: "juridico",
      titulo: "Convocatórias, Assembleias Virtuais e Minutas Oficiais",
      perfilRecomendado: "Administradores e Gabinete Jurídico",
      resumo: "Convocação legal de assembleias com envio de circulares por correio eletrónico e apuramento de quórum.",
      conteudoDetalhado: [
        "A plataforma cumpre o disposto na legislação em vigor (Decreto-Lei n.º 268/94 com as alterações da Lei n.º 8/2022) relativamente a convocatórias e assembleias de condomínio.",
        "Permite a realização de reuniões presenciais, virtuais ou mistas com videoconferência integrada e votação em tempo real.",
        "A ata é gerada automaticamente com a lista de presenças, permilagens representadas e resultado das deliberações."
      ],
      passos: [
        "1. No módulo 'Assembleias', clique em 'Nova Convocatória'.",
        "2. Indique a data, primeira e segunda convocação, e os pontos da ordem de trabalhos.",
        "3. Carregue em 'Enviar por E-mail' para notificar todos os condóminos com a minuta legal em PDF.",
        "4. No dia da reunião, registe presenças e lance os votos a favor, contra e abstenções."
      ],
      dicaPro: "Pode descarregar minutas de procuração de representação prontas a assinar na Central de Minutas Oficiais.",
      manualRelacionadoDocId: "doc-manual-juridico"
    },
    {
      id: "topico-avarias-limpezas",
      categoria: "manutencao",
      titulo: "Reporte de Avarias, Vistorias Técnicas e Escala de Limpezas",
      perfilRecomendado: "Técnicos de Manutenção, Equipas de Limpeza e Condóminos",
      resumo: "Controlo das intervenções no edifício, checklist diário de higienização e histórico de manutenção preventiva.",
      conteudoDetalhado: [
        "Os condóminos podem reportar avarias no ecrã do telemóvel tirando uma foto direta do problema.",
        "A administração e os técnicos recebem a ocorrência e podem orçamentar e agendar a reparação.",
        "A equipa de limpeza tem uma interface simples com botões grandes na PWA para assinalar a higienização de cada piso e alertar para lâmpadas fundidas."
      ],
      passos: [
        "1. No ecrã 'Manutenção & Obras', consulte a lista de ocorrências abertas.",
        "2. Atribua o técnico ou fornecedor responsável com data estimada de intervenção.",
        "3. Após a conclusão, anexe o relatório fotográfico e a fatura do serviço.",
        "4. No submenu 'Vistorias & Limpezas', aceda ao calendário semanal de higienização do prédio."
      ],
      dicaPro: "Todas as fotografias de anomalias ficam georreferenciadas e indexadas ao histórico do edifício.",
      manualRelacionadoDocId: "doc-manual-tecnico"
    }
  ];

  // Filtro de tópicos por pesquisa e categoria
  const topicosFiltrados = useMemo(() => {
    return baseTopicos.filter(t => {
      const matchCategoria = categoriaSelecionada === "todas" || t.categoria === categoriaSelecionada;
      const busca = termoBusca.trim().toLowerCase();
      const matchBusca = !busca || 
        t.titulo.toLowerCase().includes(busca) ||
        t.resumo.toLowerCase().includes(busca) ||
        t.perfilRecomendado.toLowerCase().includes(busca) ||
        t.conteudoDetalhado.some(c => c.toLowerCase().includes(busca));
      return matchCategoria && matchBusca;
    });
  }, [baseTopicos, categoriaSelecionada, termoBusca]);

  // Vídeo ativo selecionado
  const videoAtivo = useMemo(() => {
    return videosDemonstrativos.find(v => v.id === videoAtivoId) || videosDemonstrativos[0];
  }, [videosDemonstrativos, videoAtivoId]);

  // Simulação de reprodução de vídeo demonstrativo interativo
  const alternarReproducaoVideo = () => {
    if (videoReproduzindo) {
      setVideoReproduzindo(false);
    } else {
      setVideoReproduzindo(true);
      const interval = setInterval(() => {
        setVideoProgresso(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setVideoReproduzindo(false);
            return 100;
          }
          return prev + 25;
        });
      }, 1500);
    }
  };

  const reiniciarVideo = () => {
    setVideoProgresso(0);
    setVideoReproduzindo(false);
  };

  return (
    <div className="space-y-6">
      {/* CABEÇALHO UNIFORMIZADO CONDOMANAGER AI */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-950 text-white p-6 rounded-2xl border border-emerald-500/30 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-xs">
                <Sparkles className="w-3 h-3 text-emerald-300" />
                Enciclopédia Oficial & Central de Conhecimento
              </span>
              <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Desktop PC + Telemóvel PWA
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <BookOpen className="w-6 h-6 text-emerald-400" />
              Enciclopédia de Utilização da Plataforma
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Consulte os manuais ilustrados detalhados por perfil, assista a demonstrações em vídeo sobre instalação da PWA no telemóvel e pesquise respostas instantâneas para qualquer operação do condomínio.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-center min-w-[120px]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Manuais Ilustrados</span>
              <span className="text-lg font-black text-emerald-400">9 Guias</span>
              <span className="text-[9px] text-slate-400 block">Por Perfil de Acesso</span>
            </div>
          </div>
        </div>
      </div>

      {/* BARRA DE PESQUISA GLOBAL DA ENCICLOPÉDIA */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            placeholder="Pesquise na Enciclopédia: Ex: 'instalar pwa', 'como pagar quota', 'registar prédio', 'mb way', 'atas'..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition-all"
          />
          {termoBusca && (
            <button
              onClick={() => setTermoBusca("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded cursor-pointer"
            >
              Limpar
            </button>
          )}
        </div>

        {/* PILLS DE FILTRAGEM POR CATEGORIA */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: "todas", label: "Todos os Tópicos", icon: BookOpen },
            { id: "pwa", label: "📱 PWA & Telemóvel", icon: Smartphone },
            { id: "desktop", label: "💻 Computador & Pastas", icon: Monitor },
            { id: "financas", label: "💰 Quotas & MB WAY", icon: CreditCard },
            { id: "predios", label: "🏢 Prédios & Frações", icon: Building2 },
            { id: "ia", label: "🤖 Conciliação & OCR", icon: Sparkles },
            { id: "juridico", label: "⚖️ Assembleias & Leis", icon: Scale },
            { id: "manutencao", label: "🔧 Avarias & Limpezas", icon: Wrench },
          ].map(cat => {
            const Icon = cat.icon;
            const isAtivo = categoriaSelecionada === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoriaSelecionada(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isAtivo
                    ? "bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-400"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECÇÃO 1: VÍDEOS DEMONSTRATIVOS INTERATIVOS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-xl">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Vídeos Demonstrativos Interativos
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Simulações visuais passo a passo para aprendizagem imediata em computadores e telemóveis
              </p>
            </div>
          </div>

          {/* SELETOR DE VÍDEO */}
          <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
            {videosDemonstrativos.map((v, idx) => (
              <button
                key={v.id}
                onClick={() => {
                  setVideoAtivoId(v.id);
                  setVideoProgresso(0);
                  setVideoReproduzindo(false);
                }}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  videoAtivoId === v.id
                    ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Vídeo {idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* PLAYER INTERATIVO */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* ECRÃ DO VÍDEO SIMULADO */}
          <div className="lg:col-span-7 bg-slate-950 rounded-2xl p-5 border border-slate-800 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[300px]">
            {/* BARRA SUPERIOR DO DISPOSITIVO */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                <span className="font-mono text-[10px] text-slate-400 ml-1">CondoManager Video Player HD</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold">
                {videoAtivo.duracao}
              </span>
            </div>

            {/* CORPO CENTRAL DO VÍDEO COM SIMULAÇÃO VISUAL */}
            <div className="my-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center border-2 border-emerald-500/40 shadow-inner">
                {videoAtivoId.includes("pwa") ? (
                  <Smartphone className="w-8 h-8 text-emerald-400" />
                ) : (
                  <Monitor className="w-8 h-8 text-emerald-400" />
                )}
              </div>

              <div>
                <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest block mb-1">
                  Demonstração em Tempo Real
                </span>
                <h4 className="text-base sm:text-lg font-black text-white px-4">
                  {videoAtivo.titulo}
                </h4>
              </div>

              {/* ETAPA ATUAL DO VÍDEO */}
              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl max-w-md mx-auto">
                <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Etapa Atual em Exibição:</span>
                <p className="text-xs font-bold text-emerald-300">
                  {videoAtivo.etapasSimuladas.find(e => videoProgresso <= e.tempo)?.titulo || videoAtivo.etapasSimuladas[videoAtivo.etapasSimuladas.length - 1].titulo}
                </p>
              </div>
            </div>

            {/* BARRA DE PROGRESSO E CONTROLOS */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${videoProgresso}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={alternarReproducaoVideo}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{videoReproduzindo ? "Em Pausa" : videoProgresso >= 100 ? "Ver de Novo" : "Reproduzir Demonstração"}</span>
                  </button>

                  <button
                    onClick={reiniciarVideo}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                    title="Reiniciar Vídeo"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Reiniciar</span>
                  </button>
                </div>

                <span className="text-[11px] text-slate-400 font-mono">
                  {videoProgresso}% Concluído
                </span>
              </div>
            </div>
          </div>

          {/* PAINEL LATERAL DE PASSOS DO VÍDEO */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-full uppercase">
                {videoAtivo.nivel}
              </span>
              <h4 className="text-sm font-black text-slate-900 dark:text-white mt-1.5">
                Passo a Passo Visual deste Módulo
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {videoAtivo.descricao}
              </p>
            </div>

            <div className="space-y-2">
              {videoAtivo.passos.map((passo, idx) => (
                <div 
                  key={idx} 
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
                    videoProgresso >= (idx + 1) * 25
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                      : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                    videoProgresso >= (idx + 1) * 25
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  }`}>
                    {idx + 1}
                  </span>
                  <p className="leading-relaxed font-medium">{passo}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECÇÃO 2: ARTIGOS DA ENCICLOPÉDIA COM ACCORDION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Tópicos e Manuais Ilustrados ({topicosFiltrados.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500">Clique em qualquer tópico para expandir o guia passo a passo</span>
        </div>

        {topicosFiltrados.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-slate-400 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Nenhum tópico encontrado para a pesquisa</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Tente pesquisar com outros termos como 'PWA', 'Quotas', 'MB WAY', 'Prédio' ou 'Manual'.
            </p>
            <button
              onClick={() => { setTermoBusca(""); setCategoriaSelecionada("todas"); }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shadow transition-all"
            >
              Repor Todos os Tópicos
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {topicosFiltrados.map((topico) => {
              const estaAberto = topicoAbertoId === topico.id;
              const manualDoc = documentos.find(d => d.id_doc === topico.manualRelacionadoDocId);

              return (
                <div
                  key={topico.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all"
                >
                  {/* CABEÇALHO DO TÓPICO (CLICÁVEL) */}
                  <div
                    onClick={() => setTopicoAbertoId(estaAberto ? null : topico.id)}
                    className="p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded">
                          {topico.categoria.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Perfil: <strong>{topico.perfilRecomendado}</strong>
                        </span>
                      </div>

                      <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        {topico.titulo}
                      </h4>

                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {topico.resumo}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {manualDoc && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                          <FileText className="w-3 h-3 text-emerald-600" />
                          Manual Disponível
                        </span>
                      )}
                      <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {estaAberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* CONTEÚDO EXPANSÍVEL DO TÓPICO */}
                  {estaAberto && (
                    <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                      {/* Explicação detalhada */}
                      <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {topico.conteudoDetalhado.map((p, idx) => (
                          <p key={idx}>{p}</p>
                        ))}
                      </div>

                      {/* Lista de passos executáveis */}
                      {topico.passos && topico.passos.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                            Procedimento Passo a Passo:
                          </span>
                          <div className="space-y-1.5">
                            {topico.passos.map((passo, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span className="text-slate-800 dark:text-slate-200 font-medium">{passo}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Dica Profissional */}
                      {topico.dicaPro && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <p><strong>Dica Pro:</strong> {topico.dicaPro}</p>
                        </div>
                      )}

                      {/* Botões de Ação para o Manual Ilustrado Oficial */}
                      {manualDoc && (
                        <div className="pt-2 flex items-center justify-between flex-wrap gap-2 border-t border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {manualDoc.nome}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">({manualDoc.tamanho})</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {onOpenManual && (
                              <button
                                onClick={() => onOpenManual(manualDoc)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow transition-all"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>Abrir Manual Ilustrado</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECÇÃO 3: CATÁLOGO COMPLETO DE MANUAIS ILUSTRADOS POR PERFIL */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="space-y-1">
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              Biblioteca de Manuais
            </span>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-emerald-400" />
              Manuais Ilustrados Oficiais por Perfil de Acesso
            </h3>
            <p className="text-xs text-slate-400">
              Disponíveis para consulta e impressão a qualquer momento no Arquivo Digital
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {documentos
            .filter(d => 
              d.tipo === "Manual Ilustrado" || 
              d.tipo === "Guia Rápido" || 
              d.sub_pasta === "Manuais & Guias Operacionais" ||
              d.categoria === "Manuais & Guias Operacionais"
            )
            .map(manual => (
              <div 
                key={manual.id_doc}
                className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 p-3.5 rounded-xl flex flex-col justify-between gap-3 transition-all group"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
                      {manual.tipo}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{manual.tamanho}</span>
                  </div>

                  <h5 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                    {manual.nome}
                  </h5>

                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {manual.descricao}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    Perfis: {manual.relevancia_perfis?.join(", ") || "Todos"}
                  </span>

                  {onOpenManual && (
                    <button
                      onClick={() => onOpenManual(manual)}
                      className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Visualizar</span>
                      <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
