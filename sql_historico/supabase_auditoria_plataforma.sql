-- ============================================================================
-- Registo de Auditoria: até agora só existia em localStorage (2 cópias
-- paralelas e independentes, uma em Definições e outra em Auditoria Interna),
-- apesar do texto na interface prometer "Auditoria Inalterável" — incluía
-- até um botão "Limpar Registo" que apagava tudo com 1 clique, e um
-- formulário para inserir manualmente entradas fabricadas (com IP e
-- dispositivo sempre fixos, "192.168.1.100" / "Chrome 128"). A tabela real
-- ai_auditoria já existia, mas só regista decisões automáticas da IA
-- (emails processados, jobs de cron) — não é usada como registo de
-- atividade geral, e nunca tinha o prédio associado.
-- ============================================================================

-- Nova tabela real, partilhada entre dispositivos, para o registo de
-- atividade (alterações de configuração, ações do administrador).
CREATE TABLE IF NOT EXISTS auditoria_plataforma (
  id TEXT PRIMARY KEY,
  id_predio TEXT,
  seccao TEXT NOT NULL,
  descricao TEXT NOT NULL,
  detalhes TEXT,
  usuario TEXT,
  email_usuario TEXT,
  role_usuario TEXT,
  origem TEXT NOT NULL DEFAULT 'web' CHECK (origem IN ('web', 'ia', 'cron')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Liga o prédio às decisões automáticas já registadas em ai_auditoria
-- (antes não existia, impossibilitando filtrar por prédio).
ALTER TABLE ai_auditoria ADD COLUMN IF NOT EXISTS id_predio TEXT;

-- Fecha o acesso externo direto — só service_role via /api/data.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'auditoria_plataforma' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.auditoria_plataforma', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE auditoria_plataforma ENABLE ROW LEVEL SECURITY;

-- Nota: api/data.js recusa explicitamente qualquer "update"/"delete"/"upsert"
-- para auditoria_plataforma e ai_auditoria — só select e insert são
-- possíveis, mesmo pelo próprio proxy, para o registo ser mesmo inalterável
-- (não só "não tem botão para apagar na interface").
