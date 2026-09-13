ALTER TABLE public.proprietarios ADD COLUMN IF NOT EXISTS fracao_id TEXT;
ALTER TABLE public.inquilinos ADD COLUMN IF NOT EXISTS id_inquilino TEXT;
ALTER TABLE public.inquilinos ADD COLUMN IF NOT EXISTS fracao_id TEXT;
ALTER TABLE public.inquilinos ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE public.inquilinos ADD COLUMN IF NOT EXISTS data_inicio DATE;
ALTER TABLE public.inquilinos ADD COLUMN IF NOT EXISTS data_fim DATE;
ALTER TABLE public.inquilinos ADD COLUMN IF NOT EXISTS contrato_url TEXT;
ALTER TABLE public.inquilinos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

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
