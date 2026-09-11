import { createClient } from '@supabase/supabase-js';

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


