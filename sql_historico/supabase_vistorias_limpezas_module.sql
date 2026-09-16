-- ============================================================================
-- SCIE, Vistorias e Limpezas: o ecrã inteiro (GestaoVistoriasLimpezas.tsx)
-- não estava ligado ao Supabase. Equipamentos SCIE viviam em localStorage
-- (perdiam-se ao limpar o browser, não sincronizavam entre dispositivos);
-- Vistorias, Limpezas e Incidências de Limpeza viviam em estado React puro
-- (nem localStorage — perdiam-se ao recarregar a página).
--
-- A tabela equipamentos_scie já existia (só precisava de ser lida/escrita).
-- Vistorias, Limpezas e Incidências de Limpeza são tabelas novas.
-- ============================================================================

CREATE TABLE IF NOT EXISTS vistorias (
  id_vistoria TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL,
  data DATE NOT NULL,
  tecnico TEXT NOT NULL,
  local TEXT NOT NULL,
  anomalia TEXT NOT NULL,
  gravidade TEXT NOT NULL DEFAULT 'Média' CHECK (gravidade IN ('Baixa', 'Média', 'Alta')),
  fotos JSONB DEFAULT '[]',
  estado TEXT NOT NULL DEFAULT 'Identificada' CHECK (estado IN ('Identificada', 'Em Resolução', 'Resolvida')),
  custo_previsto NUMERIC(10,2),
  periodicidade TEXT,
  impacto_orcamento TEXT,
  alerta_automatico BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS limpezas (
  id_limpeza TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL,
  data TEXT NOT NULL,
  hora TEXT NOT NULL,
  executor TEXT NOT NULL,
  areas JSONB DEFAULT '[]',
  observacoes TEXT,
  fotos JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incidencias_limpeza (
  id TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL,
  data TEXT NOT NULL,
  hora TEXT NOT NULL,
  operador TEXT,
  local TEXT NOT NULL,
  descricao TEXT NOT NULL,
  gravidade TEXT NOT NULL DEFAULT 'Baixa' CHECK (gravidade IN ('Baixa', 'Média', 'Alta')),
  estado TEXT NOT NULL DEFAULT 'Pendente',
  foto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fecha o acesso externo direto — só service_role via /api/data.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vistorias' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.vistorias', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'limpezas' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.limpezas', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'incidencias_limpeza' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.incidencias_limpeza', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'equipamentos_scie' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.equipamentos_scie', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE vistorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE limpezas ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidencias_limpeza ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipamentos_scie ENABLE ROW LEVEL SECURITY;
