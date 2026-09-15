-- FASE 2 de bloqueio de acesso externo — todas as restantes tabelas
-- Corre isto no SQL Editor do Supabase do projeto.
--
-- Mesmo princípio da Fase 1: ativa o RLS sem políticas de acesso, o que
-- nega por omissão qualquer pedido feito com a chave pública (anon key).
-- Todo o código da app já foi migrado para passar sempre pelo endpoint
-- /api/data (chave privada, nunca exposta ao browser) — confirma isso
-- primeiro testando a app normalmente antes de correr esta SQL, tal como
-- fizemos na Fase 1.

ALTER TABLE public.predios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos_juridicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_chaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sondagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sondagens_votos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionarios_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seguros_fracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seguros_partes_comuns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sinistros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunioes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracao_quotas_predio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_regulamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residentes_inquilinos ENABLE ROW LEVEL SECURITY;

-- Limpar qualquer política antiga permissiva que possa existir nestas
-- tabelas (o mesmo problema que encontrámos em "fracoes" na Fase 1) —
-- corre isto para TODAS, por segurança, mesmo nas que parecem já bem.
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
  tabelas TEXT[] := ARRAY[
    'predios','contas','avisos','documentos','ocorrencias','reservas',
    'fornecedores','processos_juridicos','gestao_chaves','comunicados',
    'sondagens','sondagens_votos','questionarios','questionarios_respostas',
    'seguros_fracoes','seguros_partes_comuns','sinistros','contratos',
    'reunioes','configuracao_quotas_predio','pedidos_regulamento',
    'residentes_inquilinos','proprietarios','movimentos'
  ];
BEGIN
  FOREACH tbl IN ARRAY tabelas LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------
-- CASO ESPECIAL: conversas e mensagens_conversa
-- ----------------------------------------------------------------------
-- Estas duas tabelas alimentam o chat em tempo real (Supabase Realtime),
-- que continua a usar a chave pública para a ligação — isso é normal e
-- seguro para este propósito, mas a leitura em tempo real via Realtime
-- respeita sempre as políticas RLS da tabela. Por isso, ao contrário das
-- restantes, aqui deixamos uma política de LEITURA aberta (o conteúdo de
-- uma conversa é menos sensível do que NIFs/IBANs/saldos) mas continuamos
-- a bloquear escrita direta — criar, editar ou apagar mensagens continua
-- a exigir passar pelo /api/data.
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_conversa ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversas'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversas', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mensagens_conversa'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.mensagens_conversa', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "leitura_publica_conversas" ON public.conversas FOR SELECT USING (true);
CREATE POLICY "leitura_publica_mensagens_conversa" ON public.mensagens_conversa FOR SELECT USING (true);
