-- FASE 3 de bloqueio de acesso externo — tabela profiles
-- Corre isto no SQL Editor do Supabase do projeto.
--
-- Esta tabela já tinha uma política antiga com um erro de recursão
-- infinita, que a deixava inacessível mesmo à app. Como o perfil de cada
-- utilizador passa agora a ser lido/escrito sempre através do /api/data
-- (à semelhança de todas as outras tabelas), fechamos aqui da mesma forma.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;
