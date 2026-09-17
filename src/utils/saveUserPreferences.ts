import { NotificationPreferences } from './loadUserPreferences';

/**
 * Grava as preferências de notificação por categoria do utilizador em
 * profiles.notificacoes_preferencias (identificado pelo email) — sincroniza
 * a sério entre dispositivos, em vez de ficar só em localStorage neste.
 *
 * Usa fetch("/api/data") diretamente em vez de importar supabaseService —
 * ver a nota em loadUserPreferences.ts sobre porquê (este ficheiro também é
 * empacotado para o servidor via src/utils.ts, onde importar o cliente
 * Supabase do browser rebenta o arranque).
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
  try {
    const resp = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tabela: "profiles",
        acao: "update",
        dados: { notificacoes_preferencias: preferenciasParaGravar },
        filtros: [["email", "eq", user_id]]
      })
    });
    const resultado = await resp.json();
    if (resultado?.ok) {
      console.log('[WebPush] Preferências gravadas no Supabase (sincronizam entre dispositivos):', updatedPrefs);
    } else {
      console.error('[WebPush] Erro ao gravar preferências de notificação no Supabase:', resultado?.error);
    }
  } catch (err) {
    console.error('[WebPush] Erro ao gravar preferências de notificação no Supabase:', err);
  }

  return updatedPrefs;
}
