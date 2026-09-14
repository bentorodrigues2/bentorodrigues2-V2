-- ============================================================================
-- SCRIPT DE RECONCILIAÇÃO DE SCHEMA SUPABASE + RESET DE DADOS
-- Condomínio & Gestão Predial - Bento Rodrigues2
-- ============================================================================
-- Este ficheiro foi corrigido depois de inspecionar a estrutura REAL das
-- tabelas (via schema OpenAPI do PostgREST), não a partir de suposições.
-- A maioria das tabelas já existia com nomes de colunas diferentes dos que
-- o código da app espera — este script só ACRESCENTA as colunas em falta
-- (ADD COLUMN IF NOT EXISTS), nunca remove nem renomeia nada existente.
--
-- PARTE 1: correções aditivas às tabelas já existentes
-- PARTE 2: cria as 2 tabelas que confirmámos não existirem
--          (anexos_processados, push_subscriptions)
-- PARTE 3: recria as views derivadas (já compatíveis com o schema real)
-- PARTE 4: TRUNCATE de TODAS as tabelas (apaga todos os dados atuais)
--          *** SECÇÃO DESTRUTIVA, CONFIRMADA EXPLICITAMENTE PELO UTILIZADOR ***
-- ============================================================================


-- ============================================================================
-- PARTE 1: CORREÇÕES ADITIVAS ÀS TABELAS EXISTENTES
-- (predios, profiles, gestao_chaves, seguros_fracoes e pagamentos já estão
--  conformes com o que o código precisa — não precisam de alterações)
-- ============================================================================

-- contas
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS morada_balcao TEXT;
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS contacto_banco TEXT;
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS email_gestor TEXT;

-- fracoes
ALTER TABLE public.fracoes ADD COLUMN IF NOT EXISTS is_arrendada BOOLEAN DEFAULT false;
ALTER TABLE public.fracoes ADD COLUMN IF NOT EXISTS administrador_interno TEXT DEFAULT 'Não';
ALTER TABLE public.fracoes ADD COLUMN IF NOT EXISTS notificacao_preferencial TEXT DEFAULT 'Digital (E-mail e Mensagens Push)';
ALTER TABLE public.fracoes ADD COLUMN IF NOT EXISTS proprietario JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.fracoes ADD COLUMN IF NOT EXISTS proprietarios_adicionais JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.fracoes ADD COLUMN IF NOT EXISTS inquilino JSONB;
ALTER TABLE public.fracoes ADD COLUMN IF NOT EXISTS seguradora TEXT;
ALTER TABLE public.fracoes ADD COLUMN IF NOT EXISTS apolice_num TEXT;
ALTER TABLE public.fracoes ADD COLUMN IF NOT EXISTS apolice_validade TEXT;
ALTER TABLE public.fracoes ADD COLUMN IF NOT EXISTS apolice_doc TEXT;

-- proprietarios: faltava mesmo a coluna id_predio (causa do erro 42703)
ALTER TABLE public.proprietarios ADD COLUMN IF NOT EXISTS id_predio TEXT REFERENCES public.predios(id_predio) ON DELETE SET NULL;
ALTER TABLE public.proprietarios ADD COLUMN IF NOT EXISTS id_fracao TEXT REFERENCES public.fracoes(id_fracao) ON DELETE SET NULL;
ALTER TABLE public.proprietarios ADD COLUMN IF NOT EXISTS fracao_nome TEXT;

-- co_proprietarios (nome real da PK é id_co_proprietario, com underscore)
ALTER TABLE public.co_proprietarios ADD COLUMN IF NOT EXISTS id_proprietario_principal TEXT REFERENCES public.proprietarios(id_proprietario) ON DELETE CASCADE;
ALTER TABLE public.co_proprietarios ADD COLUMN IF NOT EXISTS id_predio TEXT REFERENCES public.predios(id_predio) ON DELETE CASCADE;
ALTER TABLE public.co_proprietarios ADD COLUMN IF NOT EXISTS nif VARCHAR(20);
ALTER TABLE public.co_proprietarios ADD COLUMN IF NOT EXISTS tlm TEXT;
ALTER TABLE public.co_proprietarios ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE public.co_proprietarios ADD COLUMN IF NOT EXISTS parentesco TEXT;
ALTER TABLE public.co_proprietarios ADD COLUMN IF NOT EXISTS percentagem_quota NUMERIC(5,2) DEFAULT 50.00;

-- inquilinos
ALTER TABLE public.inquilinos ADD COLUMN IF NOT EXISTS id_predio TEXT REFERENCES public.predios(id_predio) ON DELETE CASCADE;
ALTER TABLE public.inquilinos ADD COLUMN IF NOT EXISTS data_inicio_contrato DATE;
ALTER TABLE public.inquilinos ADD COLUMN IF NOT EXISTS data_fim_contrato DATE;
ALTER TABLE public.inquilinos ADD COLUMN IF NOT EXISTS valor_renda NUMERIC(10,2);
ALTER TABLE public.inquilinos ADD COLUMN IF NOT EXISTS contacto_emergencia TEXT;
ALTER TABLE public.inquilinos ADD COLUMN IF NOT EXISTS documento_contrato TEXT;

-- equipamentos_scie
ALTER TABLE public.equipamentos_scie ADD COLUMN IF NOT EXISTS quantidade INTEGER DEFAULT 1;
ALTER TABLE public.equipamentos_scie ADD COLUMN IF NOT EXISTS especificacao TEXT;
ALTER TABLE public.equipamentos_scie ADD COLUMN IF NOT EXISTS data_instalacao DATE;
ALTER TABLE public.equipamentos_scie ADD COLUMN IF NOT EXISTS data_ultima_revisao DATE;
ALTER TABLE public.equipamentos_scie ADD COLUMN IF NOT EXISTS data_validade DATE;
ALTER TABLE public.equipamentos_scie ADD COLUMN IF NOT EXISTS empresa_certificada TEXT;
ALTER TABLE public.equipamentos_scie ADD COLUMN IF NOT EXISTS numero_certificado TEXT;
ALTER TABLE public.equipamentos_scie ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE public.equipamentos_scie ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- movimentos: colunas usadas pelo estado "pendente de validação" das automações
ALTER TABLE public.movimentos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Confirmado';
ALTER TABLE public.movimentos ADD COLUMN IF NOT EXISTS estado_conciliacao TEXT DEFAULT 'CONCILIADO'; -- 'PENDENTE' | 'CONCILIADO' | 'IGNORADO'
ALTER TABLE public.movimentos ADD COLUMN IF NOT EXISTS is_movimento_cego BOOLEAN DEFAULT false; -- snake_case: nomes de coluna em Postgres não preservam maiúsculas sem aspas
ALTER TABLE public.movimentos ADD COLUMN IF NOT EXISTS fotos JSONB DEFAULT '[]'::jsonb;

-- documentos: colunas usadas por src/lib/registarDocumento.ts (coexistem com as já existentes)
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS caminho TEXT;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS ano INTEGER;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS tema TEXT;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS predio TEXT;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS fracao TEXT;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS fluxo TEXT;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS origem TEXT;

-- seguros_partes_comuns: código usa "condominio_id", tabela real usa "predio_id"
ALTER TABLE public.seguros_partes_comuns ADD COLUMN IF NOT EXISTS condominio_id TEXT REFERENCES public.predios(id_predio) ON DELETE CASCADE;

-- sinistros: colunas usadas por src/lib/supabaseService.ts (coexistem com as já existentes)
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS fracao_nome TEXT;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS tipo_sinistro TEXT;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS data_participacao DATE;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS num_apolice TEXT;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS num_processo_sinistro TEXT;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS perito_nome TEXT;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS perito_contacto TEXT;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS data_peritagem DATE;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS descricao_danos TEXT;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS valor_estimado_danos NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS valor_indemnizacao_aprovado NUMERIC(12,2);
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS franquia_aplicavel NUMERIC(12,2);
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS fotos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS relatorios_pdf JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- ai_auditoria (a PK real chama-se id_log, e já existe — só falta o hash)
ALTER TABLE public.ai_auditoria ADD COLUMN IF NOT EXISTS file_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_auditoria_file_hash ON public.ai_auditoria(file_hash);


-- ============================================================================
-- PARTE 2: TABELAS CONFIRMADAS EM FALTA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.anexos_processados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  movimento_id TEXT REFERENCES public.movimentos(id_movimento) ON DELETE SET NULL,
  filename TEXT,
  mime_type TEXT,
  file_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anexos_file_hash ON public.anexos_processados(file_hash);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_predio TEXT REFERENCES public.predios(id_predio) ON DELETE CASCADE,
  id_fracao TEXT REFERENCES public.fracoes(id_fracao) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subs_fracao ON public.push_subscriptions(id_fracao);


-- ============================================================================
-- PARTE 3: VIEWS DERIVADAS (já compatíveis com os nomes reais confirmados)
-- ============================================================================

DROP VIEW IF EXISTS public.v_pagamentos_estado;
CREATE VIEW public.v_pagamentos_estado AS
SELECT estado, COUNT(*) AS total_pagamentos, SUM(valor) AS total_valor
FROM public.pagamentos GROUP BY estado;

DROP VIEW IF EXISTS public.v_proprietarios;
CREATE VIEW public.v_proprietarios AS
SELECT p.id_proprietario, p.fracao_id, f.fracao_nome, p.nome, p.email,
       p.data_nascimento, p.iban, p.nif, p.created_at
FROM public.proprietarios p
LEFT JOIN public.fracoes f ON f.id_fracao = p.fracao_id;

DROP VIEW IF EXISTS public.v_inquilinos;
CREATE VIEW public.v_inquilinos AS
SELECT i.id_inquilino, i.fracao_id, f.fracao_nome, i.nome, i.email,
       i.telefone, i.data_inicio, i.data_fim, i.contrato_url, i.created_at
FROM public.inquilinos i
LEFT JOIN public.fracoes f ON f.id_fracao = i.fracao_id;


-- ============================================================================
-- PARTE 4: *** SECÇÃO DESTRUTIVA *** — esvazia TODAS as tabelas acima
-- Confirmado explicitamente pelo utilizador: apagar todos os dados atuais
-- (incluindo prédios/frações/proprietários já inseridos) para começar com
-- as tabelas vazias. RESTART IDENTITY CASCADE trata das dependências de FK
-- automaticamente. NÃO apaga a estrutura das tabelas, só as linhas.
-- ============================================================================

TRUNCATE TABLE
  public.push_subscriptions,
  public.ai_auditoria,
  public.anexos_processados,
  public.pagamentos,
  public.documentos,
  public.sinistros,
  public.seguros_partes_comuns,
  public.seguros_fracoes,
  public.gestao_chaves,
  public.profiles,
  public.movimentos,
  public.equipamentos_scie,
  public.inquilinos,
  public.co_proprietarios,
  public.proprietarios,
  public.fracoes,
  public.contas,
  public.predios
RESTART IDENTITY CASCADE;

-- ============================================================================
-- FIM
-- ============================================================================
