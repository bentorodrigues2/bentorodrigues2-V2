import { Predio, Conta, Fornecedor, Fracao, Aviso, Movimento, Reuniao, Documento, Ocorrencia, GestorCarteira, EmpresaGestoraConfig, ProcessoJuridico, ProcessoProva } from "./types";

export const cpLookup: Record<string, string> = {
  "2840-124": "Seixal",
  "2775-245": "Parede",
  "1000-001": "Lisboa",
  "4000-001": "Porto",
  "8000-001": "Faro",
  "2780-001": "Oeiras",
  "2845-351": "Amora"
};

export const defaultEmptyPredio: Predio = {
  id_predio: "predio-temp",
  nome: "Nenhum Condomínio Selecionado",
  morada_linha1: "Sem morada configurada",
  morada_linha2: null,
  num_porta: "",
  letra_porta: null,
  codigo_postal: "0000-000",
  localidade: "Geral",
  nif: "999999990",
  patrimonio: {
    tem_elevador: false,
    num_elevadores: 0,
    tem_garagem: false,
    tem_piscina: false,
    tem_sala_comum: false,
    tem_arrecadacoes_comuns: false,
    tem_jardins: false,
    tem_churrasqueira: false,
    tem_terraco: false,
    tem_ginasio: false,
    tem_spa: false,
  },
  email_condominio: "administracao@condomanager.ai",
  email: "administracao@condomanager.ai",
  autoresponder_ativo: false,
};

export const initialPredios: Predio[] = [];

export const initialContas: Conta[] = [];

export const initialFornecedores: Fornecedor[] = [];

export const initialFracoes: Fracao[] = [];

export const initialAvisos: Aviso[] = [];

export const initialMovements: Movimento[] = [];

export const initialReunioes: Reuniao[] = [];

export const initialDocumentos: Documento[] = [
  {
    id_doc: "doc-manual-completo-passo-a-passo",
    id_predio: "predio-1",
    nome: "00_Manual_Ilustrado_Guia_Completo_Plataforma_Passo_a_Passo.pdf",
    tipo: "Manual Ilustrado",
    data_upload: "2026-05-01",
    tamanho: "1.4 MB",
    categoria: "Instruções PWA & Desktop",
    sub_pasta: "05. Manuais & Guias Operacionais",
    descricao: "Manual Oficial Ilustrado Completo: Guia explicativo passo-a-passo e detalhado de todos os menus da aplicação CondoManager AI (1. Dashboard & KPIs; 2. Prédios & Arquitetura; 3. Frações & Condóminos; 4. Gestão Financeira & Quotas; 5. Conciliação Bancária IA; 6. Assembleias & Atas; 7. Vistorias & Limpezas; 8. Fornecedores & Contratos; 9. Contencioso & Prazos Legais; 10. Arquivo Digital em Pastas Pré-configuradas; 11. PWA Telemóvel).",
    visibilidade: "Público",
    autor: "CondoManager AI",
    tema: "Instruções PWA & Desktop",
    ano: "2026",
    tipo_arquivo: "documento",
    relevancia_perfis: ["ADMIN", "EMPRESA_GESTORA", "USER", "INQUILINO", "TECNICO", "LIMPEZAS", "JURIDICO", "AUDITOR", "CONTABILISTA"]
  },
  {
    id_doc: "doc-manual-condomino",
    id_predio: "predio-1",
    nome: "01_Manual_Ilustrado_Condomino_Residente_Desktop_PWA.pdf",
    tipo: "Manual Ilustrado",
    data_upload: "2026-05-01",
    tamanho: "850 KB",
    categoria: "Instruções PWA & Desktop",
    sub_pasta: "Instruções PWA & Desktop",
    descricao: "Manual Oficial Ilustrado para Condóminos, Proprietários e Inquilinos (Desktop + Telemóvel PWA). Guia passo-a-passo visual adaptado a todas as idades: acesso com password provisória, liquidação de quotas (MB WAY / Referência), envio de comprovativo por fotografia WebP, consulta de atas, votação em assembleias virtuais, marcação de reservas e reporte de avarias.",
    visibilidade: "Público",
    autor: "Administração do Condomínio",
    tema: "Instruções PWA & Desktop",
    ano: "2026",
    tipo_arquivo: "documento",
    relevancia_perfis: ["USER", "INQUILINO", "ADMIN", "EMPRESA_GESTORA"]
  },
  {
    id_doc: "doc-manual-admin",
    id_predio: "predio-1",
    nome: "02_Manual_Ilustrado_Administrador_Edificio_Desktop_PWA.pdf",
    tipo: "Manual Ilustrado",
    data_upload: "2026-05-01",
    tamanho: "980 KB",
    categoria: "Instruções PWA & Desktop",
    sub_pasta: "Instruções PWA & Desktop",
    descricao: "Manual Oficial Ilustrado para Administradores de Edifício (Desktop + Telemóvel PWA). Gestão completa de contas bancárias, emissão e cobrança de quotas, conciliação inteligente por IA, aprovação de orçamentos, convocatórias e envio de circulares por e-mail e push notification.",
    visibilidade: "Público",
    autor: "Administração do Condomínio",
    tema: "Instruções PWA & Desktop",
    ano: "2026",
    tipo_arquivo: "documento",
    relevancia_perfis: ["ADMIN", "EMPRESA_GESTORA"]
  },
  {
    id_doc: "doc-manual-empresa",
    id_predio: "predio-1",
    nome: "03_Manual_Ilustrado_Empresa_Gestora_Desktop_PWA.pdf",
    tipo: "Manual Ilustrado",
    data_upload: "2026-05-01",
    tamanho: "1.1 MB",
    categoria: "Instruções PWA & Desktop",
    sub_pasta: "Instruções PWA & Desktop",
    descricao: "Manual Oficial Ilustrado para Empresas de Gestão de Condomínios (Desktop + Telemóvel PWA). Gestão de carteiras multi-edifício, personalização de logótipo e marca (White-Label), ativação de sincronizador de caixa postal e motor de auto-responder IA de faturas e comprovativos.",
    visibilidade: "Público",
    autor: "CondoManager AI Core",
    tema: "Instruções PWA & Desktop",
    ano: "2026",
    tipo_arquivo: "documento",
    relevancia_perfis: ["EMPRESA_GESTORA", "ADMIN"]
  },
  {
    id_doc: "doc-manual-tecnico",
    id_predio: "predio-1",
    nome: "04_Manual_Ilustrado_Prestador_Tecnico_Desktop_PWA.pdf",
    tipo: "Manual Ilustrado",
    data_upload: "2026-05-01",
    tamanho: "760 KB",
    categoria: "Instruções PWA & Desktop",
    sub_pasta: "Instruções PWA & Desktop",
    descricao: "Manual Oficial Ilustrado para Prestadores Técnicos e Fornecedores (Desktop + Telemóvel PWA). Acesso rápido no telemóvel com password provisória, leitura de ordens de serviço, diagnóstico com câmara fotográfica WebP e envio de orçamentos e relatórios técnicos.",
    visibilidade: "Público",
    autor: "Gabinete Técnico",
    tema: "Instruções PWA & Desktop",
    ano: "2026",
    tipo_arquivo: "documento",
    relevancia_perfis: ["TECNICO", "ADMIN", "EMPRESA_GESTORA"]
  },
  {
    id_doc: "doc-manual-limpezas",
    id_predio: "predio-1",
    nome: "05_Manual_Ilustrado_Equipa_Limpeza_Desktop_PWA.pdf",
    tipo: "Manual Ilustrado",
    data_upload: "2026-05-01",
    tamanho: "680 KB",
    categoria: "Instruções PWA & Desktop",
    sub_pasta: "Instruções PWA & Desktop",
    descricao: "Manual Oficial Ilustrado para Equipas de Limpeza e Higienização (Desktop + Telemóvel PWA). Desenhado para uso simples e intuitivo com botões grandes: checklist de higienização por piso, confirmação com 1 toque no ecrã e alerta de lâmpadas fundidas ou vidros partidos.",
    visibilidade: "Público",
    autor: "Coordenação de Serviços",
    tema: "Instruções PWA & Desktop",
    ano: "2026",
    tipo_arquivo: "documento",
    relevancia_perfis: ["LIMPEZAS", "ADMIN", "EMPRESA_GESTORA"]
  },
  {
    id_doc: "doc-manual-juridico",
    id_predio: "predio-1",
    nome: "06_Manual_Ilustrado_Gabinete_Juridico_Desktop_PWA.pdf",
    tipo: "Manual Ilustrado",
    data_upload: "2026-05-01",
    tamanho: "890 KB",
    categoria: "Instruções PWA & Desktop",
    sub_pasta: "Instruções PWA & Desktop",
    descricao: "Manual Oficial Ilustrado para Gabinetes Jurídicos e Advogados (Desktop + Telemóvel PWA). Acompanhamento do contencioso, extração de certidões de dívida com força executiva (Art. 1424.º-A do Código Civil), arquivo de correspondência registada e atas deliberativas.",
    visibilidade: "Público",
    autor: "Departamento Jurídico",
    tema: "Instruções PWA & Desktop",
    ano: "2026",
    tipo_arquivo: "documento",
    relevancia_perfis: ["JURIDICO", "ADMIN", "EMPRESA_GESTORA"]
  },
  {
    id_doc: "doc-manual-contabilidade",
    id_predio: "predio-1",
    nome: "07_Manual_Ilustrado_Contabilidade_Auditoria_Desktop_PWA.pdf",
    tipo: "Manual Ilustrado",
    data_upload: "2026-05-01",
    tamanho: "940 KB",
    categoria: "Instruções PWA & Desktop",
    sub_pasta: "Instruções PWA & Desktop",
    descricao: "Manual Oficial Ilustrado para Contabilidade e Auditoria (Desktop + Telemóvel PWA). Balancetes analíticos, conciliação do Fundo Comum de Reserva (FCR), mapas fiscais, log imutável de operações financeiras e exportação para software contabilístico.",
    visibilidade: "Público",
    autor: "Auditoria & Finanças",
    tema: "Instruções PWA & Desktop",
    ano: "2026",
    tipo_arquivo: "documento",
    relevancia_perfis: ["CONTABILISTA", "AUDITOR", "ADMIN"]
  },
  {
    id_doc: "doc-manual-instalacao-pwa",
    id_predio: "predio-1",
    nome: "08_Guia_Visual_Instalacao_PWA_Telemovel.pdf",
    tipo: "Guia Rápido",
    data_upload: "2026-05-01",
    tamanho: "520 KB",
    categoria: "Instruções PWA & Desktop",
    sub_pasta: "Instruções PWA & Desktop",
    descricao: "Guia Visual Ilustrado de Instalação Rápida no Telemóvel (iPhone / Safari e Android / Chrome). Instruções com figuras grandes e linguagem simples para residentes e condóminos de todas as idades adicionarem o ícone à página inicial sem precisar de App Store.",
    visibilidade: "Público",
    autor: "Suporte Técnico",
    tema: "Instruções PWA & Desktop",
    ano: "2026",
    tipo_arquivo: "documento",
    relevancia_perfis: ["USER", "INQUILINO", "ADMIN", "EMPRESA_GESTORA", "TECNICO", "LIMPEZAS", "JURIDICO", "AUDITOR", "CONTABILISTA"]
  }
];

export const initialOcorrencias: Ocorrencia[] = [];

export const initialGestoresCarteira: GestorCarteira[] = [];

export const initialEmpresaGestoraConfig: EmpresaGestoraConfig = {
  nome_empresa: "",
  nif: "",
  email_corporativo: "",
  telefone: "",
  website: "",
  email_autoresponder_principal: "CONDOMINIO",
  email_gestao_ia: "CONDOMINIO",
  gestores: []
};

export const processosJudiciaisIniciais: ProcessoJuridico[] = [];


