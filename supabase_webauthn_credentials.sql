-- Biometria real (WebAuthn) — tabela para guardar as chaves públicas dos
-- autenticadores de plataforma (Face ID / Touch ID / Windows Hello /
-- impressão digital) registados por cada utilizador. Nunca guarda nenhum
-- dado biométrico em si — só a chave pública, que nunca sai do dispositivo
-- do utilizador; a impressão digital/rosto nunca chega ao servidor.
--
-- Corre isto uma vez no SQL Editor do Supabase (Project → SQL Editor).
-- Necessário porque a role usada pela app não tem permissão para criar
-- tabelas novas (DDL) — só para ler/escrever registos nas tabelas existentes.

CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[],
  device_type text,
  backed_up boolean DEFAULT false,
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_email ON public.webauthn_credentials (user_email);

ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

-- A app só acede a esta tabela através do servidor (service role, que
-- ignora RLS), nunca diretamente do browser — por isso não é preciso
-- nenhuma policy adicional para o anon/authenticated key.
