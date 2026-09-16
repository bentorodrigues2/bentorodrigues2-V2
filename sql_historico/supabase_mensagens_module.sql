-- Módulo de Mensagens & Comunicação Multicanal (comunicados, chat, sondagens, questionários)
-- Corre isto no SQL Editor do Supabase do projeto.

-- 1. COMUNICADOS (broadcast unidirecional admin -> todas as frações)
CREATE TABLE IF NOT EXISTS public.comunicados (
  id_comunicado TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  urgencia TEXT NOT NULL DEFAULT 'normal', -- 'normal' | 'urgente'
  autor_nome TEXT,
  total_destinatarios INTEGER DEFAULT 0,
  total_enviados INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comunicados_predio ON public.comunicados(id_predio, created_at DESC);

-- 2. CONVERSAS (thread de chat condómino <-> administração, por fração)
CREATE TABLE IF NOT EXISTS public.conversas (
  id_conversa TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL,
  id_fracao TEXT NOT NULL,
  proprietario_nome TEXT,
  assunto TEXT,
  estado TEXT NOT NULL DEFAULT 'pendente', -- 'pendente' | 'arquivada'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversas_predio ON public.conversas(id_predio, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversas_fracao ON public.conversas(id_fracao);

-- 3. MENSAGENS_CONVERSA (mensagens individuais dentro de uma conversa)
CREATE TABLE IF NOT EXISTS public.mensagens_conversa (
  id_mensagem TEXT PRIMARY KEY,
  id_conversa TEXT NOT NULL REFERENCES public.conversas(id_conversa) ON DELETE CASCADE,
  autor TEXT NOT NULL, -- 'condomino' | 'administracao'
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON public.mensagens_conversa(id_conversa, created_at ASC);

-- 4. SONDAGENS (consultas rápidas / preparação de assembleia)
CREATE TABLE IF NOT EXISTS public.sondagens (
  id_sondagem TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL,
  pergunta TEXT NOT NULL,
  opcoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  estado TEXT NOT NULL DEFAULT 'ativa', -- 'ativa' | 'fechada'
  data_fecho DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sondagens_predio ON public.sondagens(id_predio, created_at DESC);

-- 5. SONDAGENS_VOTOS (um voto por fração, ponderado por permilagem)
CREATE TABLE IF NOT EXISTS public.sondagens_votos (
  id_voto TEXT PRIMARY KEY,
  id_sondagem TEXT NOT NULL REFERENCES public.sondagens(id_sondagem) ON DELETE CASCADE,
  id_fracao TEXT NOT NULL,
  opcao_escolhida TEXT NOT NULL,
  permilagem NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id_sondagem, id_fracao)
);

-- 6. QUESTIONARIOS (inquéritos de satisfação estruturados)
CREATE TABLE IF NOT EXISTS public.questionarios (
  id_questionario TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  estado TEXT NOT NULL DEFAULT 'ativo', -- 'ativo' | 'encerrado'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_questionarios_predio ON public.questionarios(id_predio, created_at DESC);

-- 7. QUESTIONARIOS_RESPOSTAS (uma resposta por fração)
CREATE TABLE IF NOT EXISTS public.questionarios_respostas (
  id_resposta TEXT PRIMARY KEY,
  id_questionario TEXT NOT NULL REFERENCES public.questionarios(id_questionario) ON DELETE CASCADE,
  id_fracao TEXT NOT NULL,
  resposta_texto TEXT,
  classificacao INTEGER, -- 1-5, opcional (satisfação)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id_questionario, id_fracao)
);

-- Ativar Realtime (chat em tempo real e listas ao vivo)
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_conversa;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas;
