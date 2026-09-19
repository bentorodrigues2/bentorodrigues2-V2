import { createClient } from '@supabase/supabase-js';

// Captura o hash da URL tal como o browser o recebeu, ANTES do createClient()
// abaixo (com detectSessionInUrl) o processar e limpar da barra de endereço —
// é a única forma fiável de saber depois se a pessoa chegou por um link de
// convite/recuperação de password expirado ou inválido, porque nesse caso o
// Supabase nunca dispara nenhum evento de sessão (SIGNED_IN/PASSWORD_RECOVERY),
// só deixa o erro na própria URL.
export const authRedirectHashAtLoad = typeof window !== "undefined" ? window.location.hash : "";

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawKey &&
  !rawUrl.includes("placeholder-project") &&
  !rawKey.includes("placeholder-anon-key")
);

const supabaseUrl = (rawUrl || '').trim() || 'https://placeholder-project.supabase.co';
const supabaseKey = (rawKey || '').trim() || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);


