-- ============================================================================
-- Modelos de email: editar um modelo em Definições não mudava o texto
-- realmente enviado — viviam só no localStorage e os fluxos reais (cron de
-- quotas, confirmação de pagamento) usavam texto fixo escrito no código,
-- sem ler estes modelos.
--
-- Dos 22 modelos, só 4 correspondem a fluxos reais de envio automático com
-- texto fixo genuíno (os restantes ou já têm conteúdo dinâmico gerado por
-- IA — ex. convocatória de assembleia — onde ler um modelo estático seria
-- pior, ou não têm nenhum envio automático real por trás ainda): Aviso de
-- Cobrança, Lembrete de Quota, Aviso de Dívida Acumulada e Recibo de
-- Pagamento. Só esses passam a ser lidos pelo backend.
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id_predio TEXT NOT NULL,
  template_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id_predio, template_id)
);

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_templates' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.email_templates', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
