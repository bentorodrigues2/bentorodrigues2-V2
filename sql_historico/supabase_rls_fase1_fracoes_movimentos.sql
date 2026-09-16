-- FASE 1 de bloqueio de acesso externo — frações, proprietários e movimentos
-- Corre isto no SQL Editor do Supabase do projeto.
--
-- O que isto faz: ativa o Row Level Security nestas 3 tabelas SEM criar
-- nenhuma política de acesso. Em Postgres/Supabase isso significa "negar
-- tudo por omissão" para quem usa a chave pública (anon key) — que é
-- exatamente a chave que está no código do browser e que qualquer pessoa
-- consegue extrair.
--
-- A app deixa de ficar bloqueada porque, a partir de agora, o browser já
-- não fala diretamente com estas 3 tabelas — passa a falar sempre com o
-- novo endpoint /api/data, que corre no servidor da Vercel com uma chave
-- privada (service_role) que nunca é enviada ao browser e que ignora esta
-- restrição por definição do próprio Supabase.
--
-- Resultado prático depois de correr isto: alguém com a anon key do
-- browser (ferramentas de programador, curl, Postman) deixa de conseguir
-- ler ou escrever nestas 3 tabelas. A app continua a funcionar
-- normalmente através do /api/data.

ALTER TABLE public.fracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proprietarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentos ENABLE ROW LEVEL SECURITY;
