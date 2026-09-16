-- ============================================================================
-- Modo "Confirmação Prévia" do Autoresponder: até agora era uma opção só de
-- interface (localStorage), nunca lida pelo backend — a resposta da IA saía
-- sempre de imediato, em qualquer um dos 2 modos. Passa a ser uma coluna real
-- em predios (é uma escolha por prédio) e a resposta da IA, quando o modo é
-- "confirmacao_previa", fica em fila de aprovação em vez de sair sozinha.
-- ============================================================================

ALTER TABLE predios
  ADD COLUMN IF NOT EXISTS autoresponder_modo TEXT NOT NULL DEFAULT 'confirmacao_previa'
  CHECK (autoresponder_modo IN ('confirmacao_previa', 'totalmente_autonomo'));

CREATE TABLE IF NOT EXISTS respostas_ia_pendentes (
  id TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL,
  id_fracao TEXT,
  destinatario_email TEXT NOT NULL,
  destinatario_nome TEXT,
  assunto TEXT NOT NULL,
  mensagem_html TEXT NOT NULL,
  categoria TEXT,
  from_address TEXT,
  reply_to TEXT,
  anexos JSONB DEFAULT '[]',
  estado TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (estado IN ('PENDENTE', 'ENVIADA', 'REJEITADA')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolvido_em TIMESTAMPTZ
);

-- Fecha o acesso externo direto — só service_role via /api/data e /api/admin.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'respostas_ia_pendentes' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.respostas_ia_pendentes', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE respostas_ia_pendentes ENABLE ROW LEVEL SECURITY;
