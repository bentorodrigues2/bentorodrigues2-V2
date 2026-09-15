-- Corrige o "fracoes" da Fase 1: já tinha o RLS ligado, mas existia uma
-- política antiga a permitir acesso público de leitura, que continuava a
-- deixar passar a chave pública mesmo com o RLS ativado. Isto remove
-- qualquer política existente nessa tabela (a app já não precisa de
-- nenhuma, porque passa sempre pelo /api/data com a chave privada).

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fracoes'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.fracoes', pol.policyname);
  END LOOP;
END $$;
