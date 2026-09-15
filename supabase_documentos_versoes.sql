-- Controlo de Versões dos documentos do Arquivo Digital
-- Corre isto no SQL Editor do Supabase do projeto.

ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS versao_atual INTEGER DEFAULT 1;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS versoes JSONB DEFAULT '[]'::jsonb;
