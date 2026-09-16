-- ============================================================================
-- 8 tabelas para módulos que viviam só em localStorage ou memória React,
-- encontradas na auditoria de "o que falta para produção" (para além dos
-- itens já corrigidos: Ocorrências, Reservas, Cauções, Reuniões, Votação).
--
-- GestaoManutencaoIntervencoes.tsx guardava a Agenda de Vistorias, as
-- Intervenções Técnicas e as Obras Extraordinárias só em localStorage
-- (comentário no código: "Local Simulated States"). Ao finalizar uma
-- vistoria ou homologar uma reparação, o código criava movimentos e
-- documentos fictícios com alertas que prometiam "PDF assinado
-- digitalmente e arquivado automaticamente" sem nada disso acontecer.
--
-- AgendaManutencao.tsx (Plano de Manutenção Obrigatória legal — SCIE,
-- água, eletricidade) também só em memória.
--
-- InventarioTecnico.tsx e MuralDigitalReservas.tsx (mural de avisos +
-- reservas de espaços da vista do condómino, distinto do já corrigido
-- GestaoReservas.tsx) só em localStorage — um mural que só existe no
-- browser de quem o cria não é visto por mais ninguém.
--
-- MultiCondominio.tsx (Equipas/Prestadores de Serviço) tinha dados de
-- demonstração fixos com id_predio inventados ("predio-1", "predio-2").
-- ============================================================================

CREATE TABLE IF NOT EXISTS agenda_vistorias_tecnicas (
  id TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL REFERENCES predios(id_predio) ON DELETE CASCADE,
  equipamento TEXT NOT NULL,
  tipo TEXT NOT NULL,
  data_planeada DATE,
  periodicidade TEXT,
  estado TEXT NOT NULL DEFAULT 'Agendado',
  data_verificacao DATE,
  tecnico TEXT,
  relatorio TEXT,
  avarias_encontradas TEXT,
  fotos JSONB DEFAULT '[]',
  assinatura TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intervencoes_tecnicas (
  id TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL REFERENCES predios(id_predio) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  id_fracao TEXT,
  prioridade TEXT NOT NULL DEFAULT 'Média',
  fornecedor TEXT,
  custo_previsto NUMERIC(12,2) DEFAULT 0,
  custo_final NUMERIC(12,2),
  estado TEXT NOT NULL DEFAULT 'Pendente',
  relatorio_tecnico TEXT,
  data_hora_inicio TIMESTAMPTZ,
  data_hora_fim TIMESTAMPTZ,
  fotos JSONB DEFAULT '[]',
  fatura_anexa TEXT,
  ano_exercicio TEXT,
  validado_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS obras_extraordinarias (
  id TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL REFERENCES predios(id_predio) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  fornecedor_id TEXT,
  fornecedor_nome TEXT,
  data_inicio DATE,
  data_fim DATE,
  custo_total NUMERIC(12,2) DEFAULT 0,
  necessita_cota_extra BOOLEAN DEFAULT false,
  meses_fracionamento INTEGER DEFAULT 1,
  valores_por_fracao JSONB DEFAULT '{}',
  impacto_fundo_reserva NUMERIC(12,2) DEFAULT 0,
  impacto_saldo_anual NUMERIC(12,2) DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'Planeada',
  orcamentos JSONB DEFAULT '[]',
  documentos_arquivados BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plano_manutencao_obrigatoria (
  id_item TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL REFERENCES predios(id_predio) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  entidade_responsavel TEXT,
  contacto_entidade TEXT,
  periodicidade_meses INTEGER NOT NULL DEFAULT 12,
  base_legal_dgeg TEXT,
  ultima_inspecao_data DATE,
  proxima_inspecao_data DATE,
  dias_alerta_antecedencia INTEGER DEFAULT 30,
  estado_conformidade TEXT NOT NULL DEFAULT 'CONFORME',
  num_certificado_relatorio TEXT,
  custo_estimado NUMERIC(12,2),
  historico_vistorias JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventario_tecnico (
  id TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL REFERENCES predios(id_predio) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  categoria TEXT,
  andar TEXT,
  estado TEXT NOT NULL DEFAULT 'Operacional',
  ultima_inspecao DATE,
  frequencia_inspecao TEXT,
  fabricante TEXT,
  detalhes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mural_avisos (
  id_aviso_mural TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL REFERENCES predios(id_predio) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  conteudo TEXT,
  autor TEXT,
  tipo TEXT NOT NULL DEFAULT 'INFORMATIVO',
  data_publicacao DATE,
  data_expiracao DATE,
  fixado_topo BOOLEAN DEFAULT false,
  anexos_fotos JSONB DEFAULT '[]',
  reacoes_gostos INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservas_espacos_mural (
  id_reserva TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL REFERENCES predios(id_predio) ON DELETE CASCADE,
  id_fracao TEXT,
  fracao_nome TEXT,
  solicitante_nome TEXT,
  espaco TEXT NOT NULL,
  data_evento DATE,
  hora_inicio TEXT,
  hora_fim TEXT,
  finalidade TEXT,
  num_pessoas_estimado INTEGER,
  caucao_paga BOOLEAN DEFAULT false,
  valor_caucao NUMERIC(12,2),
  termo_responsabilidade_aceite BOOLEAN DEFAULT false,
  estado TEXT NOT NULL DEFAULT 'PENDENTE_APROVACAO',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipas_prestadores (
  id TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL REFERENCES predios(id_predio) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  funcao TEXT,
  empresa TEXT,
  telefone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agenda_vistorias_tecnicas_id_predio_idx ON agenda_vistorias_tecnicas(id_predio);
CREATE INDEX IF NOT EXISTS intervencoes_tecnicas_id_predio_idx ON intervencoes_tecnicas(id_predio);
CREATE INDEX IF NOT EXISTS obras_extraordinarias_id_predio_idx ON obras_extraordinarias(id_predio);
CREATE INDEX IF NOT EXISTS plano_manutencao_obrigatoria_id_predio_idx ON plano_manutencao_obrigatoria(id_predio);
CREATE INDEX IF NOT EXISTS inventario_tecnico_id_predio_idx ON inventario_tecnico(id_predio);
CREATE INDEX IF NOT EXISTS mural_avisos_id_predio_idx ON mural_avisos(id_predio);
CREATE INDEX IF NOT EXISTS reservas_espacos_mural_id_predio_idx ON reservas_espacos_mural(id_predio);
CREATE INDEX IF NOT EXISTS equipas_prestadores_id_predio_idx ON equipas_prestadores(id_predio);

DO $$
DECLARE
  tabela TEXT;
  pol RECORD;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'agenda_vistorias_tecnicas', 'intervencoes_tecnicas', 'obras_extraordinarias',
    'plano_manutencao_obrigatoria', 'inventario_tecnico', 'mural_avisos',
    'reservas_espacos_mural', 'equipas_prestadores'
  ]
  LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tabela LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tabela);
    END LOOP;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabela);
  END LOOP;
END $$;
