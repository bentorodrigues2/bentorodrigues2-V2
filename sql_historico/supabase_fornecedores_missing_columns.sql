-- A tabela "fornecedores" já existe no Supabase mas está a faltar-lhe um
-- conjunto de colunas que o resto da aplicação já espera (isolamento por
-- prédio, dados de contacto direto, e acesso PWA do fornecedor) — sem elas,
-- cada gravação de fornecedor estava a falhar em silêncio.
-- Este script é 100% aditivo (ADD COLUMN IF NOT EXISTS): não apaga nem
-- altera nenhum dado existente.

ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS id_predio TEXT,
  ADD COLUMN IF NOT EXISTS pessoa_contacto TEXT,
  ADD COLUMN IF NOT EXISTS telemovel_direto TEXT,
  ADD COLUMN IF NOT EXISTS email_contacto TEXT,
  ADD COLUMN IF NOT EXISTS data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS perfis_pwa JSONB,
  ADD COLUMN IF NOT EXISTS pwa_acesso_enviado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pwa_password_provisoria TEXT;
