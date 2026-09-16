-- ============================================================================
-- Empresa Gestora: sai do localStorage e passa a ter tabela real no Supabase.
-- Config em linha única (id fixo 'default'); gestores de carteira em tabela
-- própria. Acesso só via /api/data (service_role) — RLS liga sem policies,
-- tal como as restantes tabelas fechadas nesta ronda de segurança.
-- ============================================================================

CREATE TABLE IF NOT EXISTS empresa_gestora_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  nome_empresa TEXT,
  nif TEXT,
  email_corporativo TEXT,
  telefone TEXT,
  website TEXT,
  logo TEXT,
  cor_branding TEXT,
  email_autoresponder_principal TEXT NOT NULL DEFAULT 'CONDOMINIO' CHECK (email_autoresponder_principal IN ('EMPRESA', 'CONDOMINIO')),
  email_gestao_ia TEXT NOT NULL DEFAULT 'CONDOMINIO' CHECK (email_gestao_ia IN ('EMPRESA', 'CONDOMINIO')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gestores_carteira (
  id_gestor TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tlm TEXT,
  email TEXT NOT NULL,
  predios_atribuidos TEXT[] DEFAULT '{}',
  perfil TEXT NOT NULL DEFAULT 'GESTOR' CHECK (perfil IN ('GESTOR', 'ADMIN')),
  status_acesso TEXT NOT NULL DEFAULT 'PENDENTE_PRIMEIRO_ACESSO' CHECK (status_acesso IN ('ATIVO', 'PENDENTE_PRIMEIRO_ACESSO')),
  email_boas_vindas_enviado BOOLEAN DEFAULT false,
  data_atribuicao TIMESTAMPTZ DEFAULT now(),
  foto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fecha o acesso externo direto (anon/authenticated) — só service_role via /api/data.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'empresa_gestora_config' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.empresa_gestora_config', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gestores_carteira' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.gestores_carteira', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE empresa_gestora_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestores_carteira ENABLE ROW LEVEL SECURITY;
