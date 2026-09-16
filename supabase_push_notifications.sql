-- ============================================================================
-- Notificações Push: a chave VAPID usada era uma "demo key" adulterada
-- (nunca válida), e quando a subscrição real falhava, o código devolvia uma
-- subscrição totalmente inventada, dando a ilusão de sucesso. O "envio" só
-- mostrava uma notificação local no próprio dispositivo aberto, nunca
-- chegava à rede. A tabela push_subscriptions já existia, mas nada no
-- código a lia nem escrevia.
--
-- Chaves VAPID reais já geradas e configuradas (.env local + Vercel).
-- Esta migração só acrescenta o índice único que faltava para a subscrição
-- poder ser atualizada em vez de duplicada a cada novo pedido do mesmo
-- dispositivo, e fecha o acesso externo direto.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx ON push_subscriptions(endpoint);

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'push_subscriptions' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.push_subscriptions', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
