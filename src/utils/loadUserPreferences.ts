import { dbSelect } from "../lib/supabaseService";

export interface NotificationPreferences {
  user_id: string;
  critical_occurrences: boolean;
  critical_documents: boolean;
  critical_assemblies: boolean;
  optional_finances: boolean;
  optional_reservations: boolean;
  optional_cleaning: boolean;
  optional_general: boolean;
  updated_at: string;
}

export function getDefaultNotificationPreferences(userId: string = 'user-default'): NotificationPreferences {
  return {
    user_id: userId,
    critical_occurrences: true,
    critical_documents: true,
    critical_assemblies: true,
    optional_finances: false,
    optional_reservations: false,
    optional_cleaning: false,
    optional_general: false,
    updated_at: new Date().toISOString()
  };
}

/**
 * Carrega as preferências de notificação por categoria do utilizador,
 * reais e sincronizadas entre dispositivos: gravadas em profiles.notificacoes_preferencias
 * (identificado pelo email, tal como o resto da app faz para condóminos/proprietários).
 * Antes ficavam só em localStorage, sem sincronizar entre dispositivos.
 */
export async function loadUserPreferences(userId: string = 'user-default'): Promise<NotificationPreferences> {
  const defaults = getDefaultNotificationPreferences(userId);
  if (!userId || userId === 'user-default') return defaults;

  try {
    const rows = await dbSelect("profiles", {
      colunas: "notificacoes_preferencias",
      filtros: [["email", "eq", userId]],
      limit: 1
    });
    const gravadas = rows?.[0]?.notificacoes_preferencias;
    if (gravadas && typeof gravadas === "object") {
      return {
        ...defaults,
        ...gravadas,
        user_id: userId,
        // As notificações críticas são sempre obrigatórias
        critical_occurrences: true,
        critical_documents: true,
        critical_assemblies: true
      };
    }
  } catch (err) {
    console.error('[WebPush] Erro ao carregar preferências de notificação do Supabase:', err);
  }
  return defaults;
}
