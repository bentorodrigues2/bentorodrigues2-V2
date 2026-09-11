-- ============================================================================
-- SCRIPT DE ATUALIZAÇÃO E CORREÇÃO DAS TABELAS SUPABASE (POSTGRESQL)
-- Condomínio & Gestão Predial - CondoManager
-- ============================================================================
-- Execute este script no SQL Editor do seu dashboard Supabase para criar
-- ou atualizar as tabelas de Prédios, Contas Bancárias, Frações, Proprietários,
-- Co-proprietários e Inquilinos.

-- 1. TABELA DE PRÉDIOS (Garante colunas bancárias e de contacto)
CREATE TABLE IF NOT EXISTS predios (
  id_predio TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  morada_linha1 TEXT NOT NULL,
  morada_linha2 TEXT,
  num_porta TEXT,
  letra_porta TEXT,
  codigo_postal TEXT,
  localidade TEXT,
  nif TEXT,
  patrimonio JSONB DEFAULT '{}'::jsonb,
  foto TEXT,
  iban TEXT,
  email TEXT,
  email_condominio TEXT,
  autoresponder_ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar colunas se já existir a tabela predios
ALTER TABLE predios ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE predios ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE predios ADD COLUMN IF NOT EXISTS email_condominio TEXT;
ALTER TABLE predios ADD COLUMN IF NOT EXISTS autoresponder_ativo BOOLEAN DEFAULT true;
ALTER TABLE predios ADD COLUMN IF NOT EXISTS foto TEXT;

-- 2. TABELA DE CONTAS BANCÁRIAS DO CONDOMÍNIO (Interligada à Área Financeira e Quotas)
CREATE TABLE IF NOT EXISTS contas (
  id_conta TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL REFERENCES predios(id_predio) ON DELETE CASCADE,
  banco TEXT NOT NULL,
  iban TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Ordem (Gestão Corrente)', -- 'Ordem', 'Poupança / Fundo de Reserva'
  saldo NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  balcao TEXT,
  morada_balcao TEXT,
  contacto_banco TEXT,
  gestor_contas TEXT,
  email_gestor TEXT,
  is_principal BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contas_predio ON contas(id_predio);

-- 3. TABELA DE FRAÇÕES
CREATE TABLE IF NOT EXISTS fracoes (
  id_fracao TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL REFERENCES predios(id_predio) ON DELETE CASCADE,
  fracao_nome TEXT NOT NULL,
  piso TEXT,
  permilagem NUMERIC(7,2) NOT NULL DEFAULT 0,
  tipologia TEXT DEFAULT 'T2',
  tipo_access TEXT DEFAULT 'Acesso Comum pelas Escadas',
  tem_garagem_spot BOOLEAN DEFAULT false,
  tem_arrecadacao_box BOOLEAN DEFAULT false,
  is_arrendada BOOLEAN DEFAULT false,
  administrador_interno TEXT DEFAULT 'Não',
  notificacao_preferencial TEXT DEFAULT 'Digital (E-mail e Mensagens Push)',
  proprietario JSONB DEFAULT '{}'::jsonb,
  proprietarios_adicionais JSONB DEFAULT '[]'::jsonb,
  inquilino JSONB,
  seguradora TEXT,
  apolice_num TEXT,
  apolice_validade TEXT,
  apolice_doc TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fracoes_predio ON fracoes(id_predio);

-- Adicionar colunas se já existir a tabela fracoes
ALTER TABLE fracoes ADD COLUMN IF NOT EXISTS proprietarios_adicionais JSONB DEFAULT '[]'::jsonb;
ALTER TABLE fracoes ADD COLUMN IF NOT EXISTS inquilino JSONB;
ALTER TABLE fracoes ADD COLUMN IF NOT EXISTS seguradora TEXT;
ALTER TABLE fracoes ADD COLUMN IF NOT EXISTS apolice_num TEXT;
ALTER TABLE fracoes ADD COLUMN IF NOT EXISTS apolice_validade TEXT;
ALTER TABLE fracoes ADD COLUMN IF NOT EXISTS apolice_doc TEXT;

-- 4. TABELA DE PROPRIETÁRIOS (Normalizada para consultas diretas e envio de felicitações)
CREATE TABLE IF NOT EXISTS proprietarios (
  id_proprietario TEXT PRIMARY KEY,
  id_predio TEXT REFERENCES predios(id_predio) ON DELETE CASCADE,
  id_fracao TEXT REFERENCES fracoes(id_fracao) ON DELETE SET NULL,
  fracao_nome TEXT,
  nome TEXT NOT NULL,
  nif VARCHAR(20),
  email TEXT,
  tlm TEXT,
  iban TEXT,
  titular_conta TEXT,
  entidade_bancaria TEXT,
  morada_alternativa TEXT,
  foto TEXT,
  data_nascimento DATE, -- Essencial para felicitações automáticas e postais de aniversário
  administrador_interno TEXT DEFAULT 'Não',
  notificacao_preferencial TEXT DEFAULT 'Digital (E-mail e Mensagens Push)',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proprietarios_predio ON proprietarios(id_predio);
CREATE INDEX IF NOT EXISTS idx_proprietarios_nif ON proprietarios(nif);
CREATE INDEX IF NOT EXISTS idx_proprietarios_aniversario ON proprietarios(data_nascimento);

-- 5. TABELA DE CO-PROPRIETÁRIOS (Opcional - suporte relacional adicional)
CREATE TABLE IF NOT EXISTS co_proprietarios (
  id_coproprietario TEXT PRIMARY KEY,
  id_proprietario_principal TEXT REFERENCES proprietarios(id_proprietario) ON DELETE CASCADE,
  id_fracao TEXT REFERENCES fracoes(id_fracao) ON DELETE CASCADE,
  id_predio TEXT REFERENCES predios(id_predio) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  nif VARCHAR(20),
  email TEXT,
  tlm TEXT,
  iban TEXT,
  parentesco TEXT, -- ex: Cônjuge, Filho, Co-herdeiro, Sócio
  percentagem_quota NUMERIC(5,2) DEFAULT 50.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABELA DE INQUILINOS / CONTRATOS DE ARRENDAMENTO (Gestão de Residentes)
CREATE TABLE IF NOT EXISTS inquilinos (
  id_inquilino TEXT PRIMARY KEY,
  id_fracao TEXT NOT NULL REFERENCES fracoes(id_fracao) ON DELETE CASCADE,
  id_predio TEXT NOT NULL REFERENCES predios(id_predio) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  nif VARCHAR(20),
  email TEXT,
  tlm TEXT,
  data_nascimento DATE,
  data_inicio_contrato DATE,
  data_fim_contrato DATE,
  valor_renda NUMERIC(10,2),
  contacto_emergencia TEXT,
  foto TEXT,
  documento_contrato TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquilinos_fracao ON inquilinos(id_fracao);

-- 7. TABELA DE EQUIPAMENTOS SCIE (Segurança Contra Incêndios em Edifícios - Módulo Manutenção)
CREATE TABLE IF NOT EXISTS equipamentos_scie (
  id TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL REFERENCES predios(id_predio) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'Extintor ABC', 'Carretel / BIA', 'Central Detetor Incêndio', etc.
  localizacao TEXT NOT NULL,
  quantidade INTEGER DEFAULT 1,
  especificacao TEXT,
  data_instalacao DATE,
  data_ultima_revisao DATE NOT NULL,
  data_validade DATE NOT NULL,
  empresa_certificada TEXT,
  numero_certificado TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scie_predio ON equipamentos_scie(id_predio);
CREATE INDEX IF NOT EXISTS idx_scie_validade ON equipamentos_scie(data_validade);

-- FIM DO SCRIPT DE ATUALIZAÇÃO SUPABASE
