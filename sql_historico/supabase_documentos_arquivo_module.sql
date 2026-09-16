-- Módulo Arquivo Digital (GestaoDocumentos.tsx) — colunas em falta
-- Corre isto no SQL Editor do Supabase do projeto.

-- O código já tentava gravar estes 4 campos ao "arquivar" um documento
-- pela IA (sub-pasta/fornecedor sugeridos, estado de arquivamento e data),
-- mas nenhum deles existia na tabela — por isso a ação nunca persistia,
-- só mudava o ecrã, revertendo ao recarregar a página.
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS sub_pasta TEXT;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS fornecedor TEXT;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT false;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS data_arquivamento DATE;
