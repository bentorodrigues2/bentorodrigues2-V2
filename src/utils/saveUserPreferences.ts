import { NotificationPreferences } from './loadUserPreferences';

export function saveUserPreferences(preferences: NotificationPreferences): NotificationPreferences {
  const updatedPrefs: NotificationPreferences = {
    ...preferences,
    // Critical notifications are mandatory / always enabled
    critical_occurrences: true,
    critical_documents: true,
    critical_assemblies: true,
    updated_at: new Date().toISOString()
  };

  // Guardado apenas neste dispositivo (localStorage) — não sincroniza
  // entre dispositivos do mesmo utilizador. Não existe ainda nenhuma
  // tabela no Supabase para preferências de notificação por categoria.
  const key = `notification_preferences_${updatedPrefs.user_id}`;
  try {
    localStorage.setItem(key, JSON.stringify(updatedPrefs));
    console.log('[WebPush] Preferências guardadas localmente neste dispositivo:', updatedPrefs);
  } catch (err) {
    console.error('[WebPush] Erro ao guardar preferências de notificação:', err);
  }

  return updatedPrefs;
}
