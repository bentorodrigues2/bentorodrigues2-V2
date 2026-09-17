import { NotificationPreferences } from './loadUserPreferences';
import { dbUpdate } from "../lib/supabaseService";

/**
 * Grava as preferências de notificação por categoria do utilizador em
 * profiles.notificacoes_preferencias (identificado pelo email) — sincroniza
 * a sério entre dispositivos, em vez de ficar só em localStorage neste.
 */
export async function saveUserPreferences(preferences: NotificationPreferences): Promise<NotificationPreferences> {
  const updatedPrefs: NotificationPreferences = {
    ...preferences,
    // As notificações críticas são sempre obrigatórias
    critical_occurrences: true,
    critical_documents: true,
    critical_assemblies: true,
    updated_at: new Date().toISOString()
  };

  if (!updatedPrefs.user_id || updatedPrefs.user_id === 'user-default') {
    console.warn('[WebPush] Sem email de utilizador válido — preferências não gravadas.');
    return updatedPrefs;
  }

  const { user_id, ...preferenciasParaGravar } = updatedPrefs;
  const ok = await dbUpdate(
    "profiles",
    { notificacoes_preferencias: preferenciasParaGravar },
    [["email", "eq", user_id]]
  );

  if (ok) {
    console.log('[WebPush] Preferências gravadas no Supabase (sincronizam entre dispositivos):', updatedPrefs);
  } else {
    console.error('[WebPush] Erro ao gravar preferências de notificação no Supabase.');
  }

  return updatedPrefs;
}
