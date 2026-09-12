export interface Patrimonio {
  tem_elevador: boolean;
  num_elevadores: number;
  tem_garagem: boolean;
  tem_piscina: boolean;
  tem_sala_comum: boolean;
  tem_arrecadacoes_comuns: boolean;
  tem_jardins: boolean;
  tem_churrasqueira: boolean;
  tem_terraco: boolean;
  tem_ginasio: boolean;
  tem_spa: boolean;
  tem_wc_piscina?: boolean;
}

export interface ChaveItem {
  id_chave: string;
  id_predio: string;
  area_nome: string;
  local?: string;
  codigo_chave: string;
  quantidade: number;
  no_claviculario: boolean;
  status?: "disponivel" | "entregue" | "devolvida" | "perdida" | string;
  responsavel?: string;
  data_entrega?: string | null;
  data_devolucao?: string | null;
  num_chaveiro?: string;
  local_sugerido?: string;
  observacoes?: string;
}

export interface Predio {
  id_predio: string;
  nome: string | null;
  morada_linha1: string;
  morada_linha2: string | null;
  num_porta: string;
  letra_porta: string | null;
  codigo_postal: string;
  localidade: string;
  nif: string;
  patrimonio: Patrimonio;
  foto?: string | null;
  iban?: string | null;
  email?: string | null; // E-mail oficial do prédio/condomínio (pré-definido para Autoresponder e IA)
  email_condominio?: string | null;
  autoresponder_ativo?: boolean;
  pisos?: number;
  elevadores?: number;
  garagens?: number;
}

export interface Conta {
  id_conta: string;
  id_predio: string;
  banco: string;
  iban: string;
  tipo: string;
  saldo: number;
  balcao?: string;
  morada_balcao?: string;
  contacto_banco?: string;
  gestor_contas?: string;
  email_gestor?: string;
  is_principal?: boolean;
}

export interface Fornecedor {
  id_fornecedor: string;
  id_predio: string;
  nome: string;
  nif: string;
  iban?: string;
  categoria: string;
  morada?: string;
  contacto?: string;
  pessoa_contacto?: string;
  telemovel_direto?: string;
  email_contacto?: string;
  data_nascimento?: string;
  perfis_pwa?: ("LIMPEZAS" | "TECNICO" | "JURIDICO" | "AUDITOR" | "CONTABILISTA")[];
  pwa_acesso_enviado?: boolean;
  pwa_password_provisoria?: string;
  foto?: string | null;
}

export interface Proprietario {
  id_proprietario?: string;
  id_predio?: string;
  id_fracao?: string;
  fracao_nome?: string;
  nome: string;
  nif: string;
  email: string;
  tlm: string;
  iban?: string;
  titular_conta?: string;
  entidade_bancaria?: string;
  morada_alternativa?: string | null;
  foto?: string | null;
  data_nascimento?: string;
  administrador_interno?: string;
  notificacao_preferencial?: string;
  referencia_br23e?: string;
}

export interface Inquilino {
  nome: string;
  email: string;
  tlm: string;
  nif: string;
  data_nascimento?: string;
  foto?: string | null;
}

export interface Fracao {
  id_fracao: string;
  id_predio: string;
  fracao_nome: string;
  piso: string;
  permilagem: number;
  tipologia: string;
  tipo_access: string;
  tem_garagem_spot: boolean;
  tem_arrecadacao_box: boolean;
  is_arrendada: boolean;
  administrador_interno: string;
  notificacao_preferencial: string;
  referencia_br23e?: string;
  proprietario: Proprietario;
  proprietarios_adicionais?: Proprietario[];
  inquilino: Inquilino | null;
  seguradora?: string;
  apolice_num?: string;
  apolice_validade?: string;
  apolice_doc?: string;
  solicitacao_email_incendio?: boolean;
  quota_mensal?: number;
  divida_total?: number;
}

export interface Aviso {
  id_aviso: string;
  id_predio: string;
  id_fracao: string;
  tipo: string;
  data: string;
  vencimento: string;
  descricao: string;
  valor: number;
  estado: string;
}

export interface Movimento {
  id_mov: string;
  id_predio: string;
  id_conta: string;
  data: string;
  tipo: string;
  valor: number;
  descricao: string;
  categoria: string;
  fotos?: string[];
  estado?: string;
  isMovimentoCego?: boolean;
  id_fracao?: string;
  metodo_pagamento?: string;
  referencia_recibo?: string;
}

export interface ReuniaoAssinatura {
  nome: string;
  fracao?: string;
  img: string; // Base64 data url of signature
  assistiuVideoconferencia?: boolean;
  dataHora?: string;
}

export interface ReuniaoVotoPresenca {
  id_voto: string;
  id_fracao?: string;
  nome: string;
  opcao: "Sim" | "Não" | "Adiar";
  dataHoraLeituraVoto: string;
  leuMensagem: boolean;
}

export interface Reuniao {
  id_reuniao: string;
  id_predio: string;
  data: string;
  hora: string;
  local_reuniao?: string;
  tema: string;
  ordens_trabalho: string;
  estado: string;
  isVideoconferencia?: boolean;
  linkVideoconferencia?: string;
  plataformaVideoconferencia?: string; // "Google Meet" | "Microsoft Teams" | "Zoom" | "Outro"
  sondagemPresencasId?: string;
  votosPresenca?: ReuniaoVotoPresenca[];
  ata?: string; // Generated official meeting minutes text
  notas_ata?: string; // Simple user-provided discussion notes
  folha_presencas?: { [fracaoId: string]: "Presente" | "Ausente" | "Representado" };
  representantes?: { [fracaoId: string]: string }; // Map of fraction ID to proxy representative name
  assinaturas?: ReuniaoAssinatura[];
}

export interface DocumentoVersao {
  id_versao: string;
  versao: number;
  data_upload: string;
  tamanho: string;
  descricao_alteracao: string;
  carregado_por: string;
}

export interface Documento {
  id_doc: string;
  id_predio: string;
  nome: string;
  tipo: string;
  data_upload: string;
  tamanho: string;
  categoria?: string;
  descricao?: string;
  visibilidade?: "Público" | "Administração";
  autor?: string;
  versoes?: DocumentoVersao[];
  tema?: string;
  ano?: string;
  sub_pasta?: string;
  fornecedor?: string;
  arquivado?: boolean;
  data_arquivamento?: string;
  tipo_arquivo?: "documento" | "fotografia";
  url_foto?: string;
  relevancia_perfis?: ("ADMIN" | "EMPRESA_GESTORA" | "USER" | "INQUILINO" | "TECNICO" | "LIMPEZAS" | "JURIDICO" | "AUDITOR" | "CONTABILISTA")[];
}

export interface OcorrenciaFoto {
  name: string;
  preview: string;
  size: string;
}

export interface Ocorrencia {
  id_ocorr: string;
  id_predio: string;
  id_fracao: string;
  descricao: string;
  data: string;
  estado: string;
  medidas_tomadas: string;
  fotos: OcorrenciaFoto[];
  categoria?: string; // e.g. "Canalização", "Eletricidade", "Elevadores", "Infiltrações", "Estrutura", "Serralharia", "Limpeza", "Segurança", "Outros"
  tecnico_atribuido?: string; // Name of assigned technician/company
  classificacao?: string; // e.g. "manutencao" | "intervencao" | "obra"
}

export interface LoggedUser {
  nome: string;
  email: string;
  role: "ADMIN" | "GESTOR" | "EMPRESA_GESTORA" | "USER" | "INQUILINO" | "TECNICO" | "LIMPEZAS" | "JURIDICO" | "AUDITOR" | "CONTABILISTA";
}

export interface Reserva {
  id_reserva: string;
  id_predio: string;
  id_fracao: string;
  area_comum: string; // "Ginásio" | "Spa" | "Salão de Festas" | "Churrasqueira" | "Piscina"
  data: string; // DD-MM-YYYY
  hora_inicio: string; // HH:MM
  hora_fim: string; // HH:MM
  responsavel: string;
  num_pessoas: number;
  estado?: "Pendente" | "Aprovado" | "Rejeitado";
  servicos_adicionais?: string[];
}

export interface CapacidadeLimite {
  area_comum: string;
  limite: number;
}

export interface GestorCarteira {
  id_gestor: string;
  nome: string;
  tlm: string;
  email: string;
  predios_atribuidos: string[]; // IDs dos prédios atribuídos
  perfil: "GESTOR" | "ADMIN"; // "GESTOR" (Gestor de Condomínio) ou "ADMIN" (Administrador Oficial)
  status_acesso: "ATIVO" | "PENDENTE_PRIMEIRO_ACESSO";
  password_provisoria?: string;
  email_boas_vindas_enviado?: boolean;
  data_atribuicao?: string;
  foto?: string;
}

export interface EmpresaGestoraConfig {
  nome_empresa: string;
  nif: string;
  email_corporativo: string;
  telefone: string;
  website?: string;
  logo?: string;
  cor_branding?: string;
  // Configurações estratégicas do Autoresponder e IA
  email_autoresponder_principal: "EMPRESA" | "CONDOMINIO";
  email_gestao_ia: "EMPRESA" | "CONDOMINIO";
  gestores: GestorCarteira[];
}

export interface AuditLogEntry {
  id_log: string;
  id_predio: string;
  usuario: string;
  email: string;
  role: string;
  data_hora: string;
  seccao: string;
  descricao: string;
  valores_anteriores?: string;
  valores_posteriores?: string;
  dispositivo?: string;
  ip?: string;
  status?: string;
}

// ----------------------------------------------------------------------------
// 1. EXTRACTO BANCÁRIO & CONCILIAÇÃO INTELIGENTE (OFX / CSV)
// ----------------------------------------------------------------------------
export interface ExtratoTransacao {
  id_transacao: string;
  data: string;
  tipo: "CREDITO" | "DEBITO";
  valor: number;
  descricao: string;
  ordenante?: string;
  documento_ref?: string;
  banco_origem?: string;
  fracao_sugerida_id?: string | null;
  fracao_sugerida_nome?: string | null;
  confianca_percent: number;
  motivo_correspondencia?: string;
  avisos_pendentes_ids: string[];
  estado_conciliacao: "PENDENTE" | "CONCILIADO" | "IGNORADO";
  recibo_gerado_id?: string;
}

// ----------------------------------------------------------------------------
// 2. RECIBOS OFICIAIS DE QUITAÇÃO COM NUMERAÇÃO SEQUENCIAL
// ----------------------------------------------------------------------------
export interface ReciboQuitacao {
  id_recibo: string; // Ex: REC-2026/0014
  numero_sequencial: number;
  ano: number;
  id_predio: string;
  id_fracao: string;
  nome_condomino: string;
  nif_condomino: string;
  fracao_nome: string;
  permilagem: number;
  data_emissao: string;
  data_pagamento: string;
  metodo_pagamento: "Transferência Bancária" | "Débito Direto" | "Multibanco / MB Way" | "Numerário / Cheque";
  valor_total: number;
  rubricas: {
    descricao: string;
    valor: number;
    tipo: "Quota Ordinária" | "Fundo Comum de Reserva" | "Quota Extraordinária" | "Outro";
  }[];
  iban_predio: string;
  codigo_verificacao_hash: string;
  emitido_por: string;
}

// ----------------------------------------------------------------------------
// 3. AGENDADOR DE LEMBRETES & COBRANÇAS PERIÓDICAS (CRON JOBS)
// ----------------------------------------------------------------------------
export interface CronJobConfig {
  id_job: string;
  id_predio: string;
  titulo: string;
  tipo: "EMISSAO_MENSAL_QUOTAS" | "LEMBRETE_CORDIAL_VENCIMENTO" | "AVISO_MORA_INCUMPRIMENTO" | "FELICITACOES_ANIVERSARIO" | "VISTORIA_PERIODICA";
  frequencia_cron: string; // Ex: "0 8 1 * *" (Todo dia 1 às 08:00)
  descricao_legivel: string;
  ativo: boolean;
  dias_offset?: number; // Ex: 3 dias antes do vencimento
  hora_execucao: string; // Ex: "08:30"
  dia_mes?: number; // Ex: 1 ou 8 ou 15
  enviar_email: boolean;
  enviar_push_pwa: boolean;
  incluir_nota_cobranca_pdf: boolean;
  ultima_execucao?: string;
  proxima_execucao?: string;
  ultimo_status?: "SUCESSO" | "ALERTA" | "ERRO";
  historico_execucoes?: {
    id: string;
    data_hora: string;
    sucesso: boolean;
    itens_processados: number;
    emails_enviados: number;
    detalhes: string;
  }[];
}

// ----------------------------------------------------------------------------
// 4. ASSEMBLEIA VIRTUAL: PONTOS DE VOTAÇÃO EM TEMPO REAL POR PERMILAGEM
// ----------------------------------------------------------------------------
export interface PontoVotacaoAssembleia {
  id_ponto: string;
  id_reuniao: string;
  ordem?: number;
  numero_ordem?: number;
  titulo: string;
  descricao: string;
  tipo_maioria?: "MAIORIA_SIMPLES" | "MAIORIA_QUALIFICADA_2_3" | "UNANIMIDADE";
  tipo_maioria_requerida?: "SIMPLES" | "DOIS_TERCOS" | "UNANIMIDADE"; // 500‰, 667‰ ou 1000‰
  estado?: "ABERTA" | "EM_VOTACAO" | "CONCLUIDA";
  estado_votacao?: "NAO_INICIADA" | "EM_CURSO" | "ENCERRADA";
  votos?: {
    id_fracao: string;
    fracao_nome: string;
    proprietario: string;
    permilagem: number;
    voto: "FAVOR" | "CONTRA" | "ABSTENCAO";
    data_hora: string;
    canal: "PWA_ONLINE" | "PRESENCIAL";
  }[];
  total_favor_permilagem?: number;
  total_contra_permilagem?: number;
  total_abstencao_permilagem?: number;
  aprovado?: boolean;
  deliberacao_texto?: string;
  votos_fracoes?: {
    [id_fracao: string]: {
      sentido_voto: "A_FAVOR" | "CONTRA" | "ABSTENCAO";
      permilagem: number;
      fracao_nome: string;
      votante_nome: string;
      data_hora: string;
      ip_origem?: string;
    };
  };
  resultado_apurado?: {
    total_permilagem_presente: number;
    permilagem_a_favor: number;
    permilagem_contra: number;
    permilagem_abstencao: number;
    percentagem_a_favor_dos_presentes: number;
    aprovado: boolean;
    quorun_atingido: boolean;
    deliberacao_texto: string;
  };
}

// ----------------------------------------------------------------------------
// 5. PROCESSOS JURÍDICOS & CONSTITUIÇÃO DO DOSSIÊ DE PROVAS (ARQUIVO JUDICIAL)
// ----------------------------------------------------------------------------
export type TipoProvaJuridica = 
  | "RECIBO_RECECAO_CARTA_AR" 
  | "PRINT_CONVERSA_WHATSAPP" 
  | "PRINT_EMAIL_COMUNICACAO" 
  | "FOTOGRAFIA_DANO_INFRACAO" 
  | "ATA_ASSEMBLEIA_TITULO_EXECUTIVO" 
  | "EXTRATO_CONTA_CORRENTE_DIVIDA" 
  | "CERTIDAO_REGISTO_PREDIAL" 
  | "OUTRO_COMPROVATIVO";

export interface ProcessoProva {
  id_prova: string;
  id_processo: string;
  tipo: TipoProvaJuridica;
  titulo: string;
  descricao?: string;
  data_documento: string;
  data_adicao: string;
  numero_documento_ordem: number; // Doc. 1, Doc. 2, Doc. 3 para tribunal
  ficheiro_nome: string;
  tamanho: string;
  tipo_ficheiro: "imagem" | "pdf" | "documento";
  url_preview?: string; // Data URL or Image URL
  codigo_rastreio_ctt?: string; // Para avisos de receção CTT
  data_entrega_ctt?: string;
  destinatario?: string;
  observacoes_juridicas?: string;
  arquivado_no_arquivo_digital?: boolean;
}

export interface ProcessoJuridico {
  id_processo: string; // Ex: PROC-2026/001-JUR
  id_predio: string;
  id_fracao: string;
  fracao_nome: string;
  nome_reu: string;
  nif_reu: string;
  tipo_processo: "FALTA_PAGAMENTO_QUOTAS" | "OBRAS_NAO_AUTORIZADAS" | "DANOS_PARTES_COMUNS" | "INCUMPRIMENTO_REGULAMENTO" | "INFILTRACOES_RESPONSABILIDADE" | "OUTRO_LITIGIO";
  titulo_processo: string;
  descricao_resumo: string;
  valor_divida_capital: number;
  valor_juros_mora: number;
  taxa_juros: number;
  custas_processuais_estimadas: number;
  valor_total_pedido: number;
  tribunal_competente: string; // Ex: "Julgado de Paz de Lisboa" | "Balcão Nacional de Injunções (BNI)" | "Tribunal Judicial da Comarca"
  fase_processual: "PRE_CONTENCIOSO_NOTIFICACAO" | "INJUNCAO_BNI" | "ACAO_EXECUTIVA" | "JULGADO_PAZ" | "ACORDO_PAGAMENTO" | "CONCLUIDO_EXTINTO";
  data_abertura: string;
  data_ultima_atualizacao: string;
  mandatario_responsavel: string; // Advogado / Solicitador / Administrador
  provas: ProcessoProva[];
  historico_tramitacao: {
    id_fase: string;
    data_hora: string;
    fase: string;
    descricao: string;
    responsavel: string;
  }[];
  pasta_arquivo_digital_nome?: string;
}

// ----------------------------------------------------------------------------
// 6. GESTÃO DE SINISTROS & APÓLICES DE SEGURO (ART. 1429.º C. CIVIL)
// ----------------------------------------------------------------------------
export interface SinistroSeguro {
  id_sinistro: string;
  id_predio: string;
  id_fracao?: string; // Opcional se for em partes comuns
  fracao_nome?: string;
  tipo_sinistro: "INUNDACAO_AGUA" | "INCENDIO" | "TEMPESTADE_TELHADO" | "DANOS_ELETRICOS" | "RESPONSABILIDADE_CIVIL" | "OUTRO";
  data_ocorrencia: string;
  data_participacao: string;
  seguradora: string;
  num_apolice: string;
  num_processo_sinistro: string;
  perito_nome?: string;
  perito_contacto?: string;
  data_peritagem?: string;
  descricao_danos: string;
  valor_estimado_danos: number;
  valor_indemnizacao_aprovado?: number;
  franquia_aplicavel?: number;
  estado: "PARTICIPADO" | "PERITAGEM_AGENDADA" | "AGUARDA_RELATORIO" | "INDEMNIZACAO_APROVADA" | "REPARACAO_EM_CURSO" | "CONCLUIDO_PAGO" | "RECUSADO";
  fotos?: string[];
  relatorios_pdf?: string[];
  observacoes?: string;
}

// ----------------------------------------------------------------------------
// SEGURO OBRIGATÓRIO DE FRAÇÕES (seguros_fracoes) & PARTES COMUNS (seguros_partes_comuns)
// ----------------------------------------------------------------------------
export interface SeguroFracao {
  id: string; // UUID ou ID único
  fracao_id: string;
  seguradora: string;
  apolice_numero: string;
  apolice_validade: string; // YYYY-MM-DD
  tipo_cobertura?: string; // 'Incêndio e Multirriscos', 'Incêndio Simples', etc.
  capital_seguro?: number;
  documento_url?: string;
  estado_validacao: "Pendente" | "Valido" | "Expirado" | "Recusado";
  criado_em?: string;
  atualizado_em?: string;
}

export interface SeguroPartesComuns {
  id: string; // UUID ou ID único
  condominio_id: string;
  seguradora: string;
  apolice_numero: string;
  apolice_validade: string; // YYYY-MM-DD
  tomador_seguro?: string;
  capital_seguro_edificio?: number;
  franquia?: number;
  contacto_mediador?: string;
  documento_url?: string;
  estado: "Ativo" | "Expirado" | "Cancelado";
  criado_em?: string;
  atualizado_em?: string;
}

// ----------------------------------------------------------------------------
// 7. PLANO PREVENTIVO DE MANUTENÇÃO & INSPEÇÕES OBRIGATÓRIAS (CALENDÁRIO & ALARMES)
// ----------------------------------------------------------------------------
export type TipoInspecaoObrigatoria = 
  | "ELEVADORES_DGEG" 
  | "LIMPEZA_CHAMINES_CONDUTAS" 
  | "RECARGA_EXTINTORES" 
  | "INSPECAO_REDE_GAS" 
  | "LIMPEZA_CISTERNA_BOMBAS" 
  | "SISTEMA_SOLAR_TERMICO" 
  | "PORTAO_GARAGEM_AUTOMATICO" 
  | "COLUNA_SECA_INCENDIO";

export interface ItemPlanoManutencao {
  id_item: string;
  id_predio: string;
  tipo: TipoInspecaoObrigatoria;
  titulo: string;
  entidade_responsavel: string;
  contacto_entidade?: string;
  periodicidade_meses: number; // ex: 12 (anual), 24 (2 anos), 1 (mensal)
  base_legal_dgeg: string;
  ultima_inspecao_data: string;
  proxima_inspecao_data: string;
  dias_alerta_antecedencia: number; // ex: 30 dias
  estado_conformidade: "CONFORME" | "A_EXPIRAR" | "EXPIRADO_ALERTA";
  num_certificado_relatorio?: string;
  custo_estimado?: number;
  historico_vistorias?: {
    id_vistoria: string;
    data: string;
    tecnico: string;
    resultado: "APROVADO_SEM_DEFICIENCIAS" | "APROVADO_COM_RESERVAS" | "REPROVADO";
    observacoes: string;
    documento_url?: string;
  }[];
}

// ----------------------------------------------------------------------------
// 8. FILA & LOG DE ENVIOS PROGRAMADOS (SCHEDULER DASHBOARD)
// ----------------------------------------------------------------------------
export interface EnvioProgramadoItem {
  id_envio: string;
  id_predio: string;
  id_fracao: string;
  fracao_nome: string;
  destinatario_nome: string;
  destinatario_email: string;
  destinatario_push_id?: string;
  tipo_envio: "NOTA_COBRANCA_DIA_25" | "LEMBRETE_CORDIAL_DIA_05" | "AVISO_MORA_DIA_16" | "RECIBO_QUITACAO" | "COMUNICADO_GERAL";
  data_programada: string; // Ex: "2026-08-25 08:00" ou "2026-09-05 10:00"
  montante: number;
  referencia_fracao: string;
  prazo_limite_texto: string; // Ex: "Liquidação até dia 08 de Setembro de 2026"
  canais: {
    email: boolean;
    push_pwa: boolean;
    pdf_anexo: boolean;
  };
  estado: "AGENDADO" | "EM_FILA" | "ENVIADO_SUCESSO" | "PAUSADO_MANUAL" | "ERRO";
  data_envio_real?: string;
  mensagem_preview: string;
}

// ----------------------------------------------------------------------------
// 9. MURAL DIGITAL DE AVISOS & RESERVA DE ESPAÇOS COMUNS
// ----------------------------------------------------------------------------
export interface MuralAviso {
  id_aviso_mural: string;
  id_predio: string;
  titulo: string;
  conteudo: string;
  autor: string;
  tipo: "INFORMATIVO" | "OBRAS" | "REUNIAO" | "URGENTE" | "PERDIDOS_ACHADOS";
  data_publicacao: string;
  data_expiracao?: string;
  fixado_topo: boolean;
  anexos_fotos?: string[];
  reacoes_gostos: number;
}

export interface ReservaEspacoComum {
  id_reserva: string;
  id_predio: string;
  id_fracao: string;
  fracao_nome: string;
  solicitante_nome: string;
  espaco: "SALAO_CONDOMINIO" | "CHURRASQUEIRA" | "TERRACO_COMUM" | "GINASIO" | "PISCINA" | "ZONA_JARDIM";
  data_evento: string;
  hora_inicio: string;
  hora_fim: string;
  finalidade: string;
  num_pessoas_estimado: number;
  caucao_paga: boolean;
  valor_caucao?: number;
  termo_responsabilidade_aceite: boolean;
  estado: "PENDENTE_APROVACAO" | "CONFIRMADA" | "RECUSADA" | "CONCLUIDA";
}


