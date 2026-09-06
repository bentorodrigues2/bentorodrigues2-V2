/**
 * Limpeza de Dados Provisórios
 * Garante que o projeto fique limpo para testes com Supabase,
 * preservando estritamente:
 * 1. Passwords provisórias de teste
 * 2. Painel e configurações de perfis de acesso
 * 3. Instruções e manuais do utilizador (Desktop + PWA)
 */
export function purgeProvisionalDemoData(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // Preservar estritamente senhas provisórias e perfis de acesso
      if (
        key.startsWith("user_password_") ||
        key.startsWith("provisional_access_") ||
        key.startsWith("pwd_reset_epoch_") ||
        key.includes("password") ||
        key.includes("auth") ||
        key.includes("instrucoes") ||
        key.includes("manual") ||
        key === "condomanager_active_session" ||
        key === "admin_signature_digital" ||
        key === "condomanager_theme"
      ) {
        continue;
      }

      // Remover dados provisórios de demonstração
      if (
        key.startsWith("agenda_manutencao_") ||
        key.startsWith("intervencoes_") ||
        key.startsWith("obras_extra_") ||
        key.startsWith("inventario_tecnico_") ||
        key.startsWith("audit_logs_") ||
        key.startsWith("system_activity_logs_") ||
        key.startsWith("votacao_") ||
        key.startsWith("processos_juridicos_") ||
        key.startsWith("ocorrencias_pwa_") ||
        key.startsWith("condo_movements_") ||
        key.startsWith("condo_demo_") ||
        key.startsWith("simulador_")
      ) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.warn("Aviso ao limpar dados provisórios:", err);
  }
}
