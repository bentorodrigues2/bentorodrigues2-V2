/**
 * Preferência de acessibilidade do próprio condómino: "prefiro ser
 * contactado só por texto/chat" (surdo/mudo ou dificuldade auditiva) —
 * gravada em profiles.prefere_contacto_texto, identificado pelo email,
 * mesmo padrão de loadUserPreferences.ts/saveUserPreferences.ts. É uma
 * escolha pessoal, editável a qualquer momento pela própria pessoa nas
 * Definições de Perfil — nunca fixada pela administração no registo.
 *
 * Usa fetch("/api/data") diretamente (não importa supabaseService) pelo
 * mesmo motivo de loadUserPreferences.ts: este ficheiro é reexportado por
 * src/utils.ts, também empacotado para o servidor, onde importar o
 * cliente Supabase do browser rebenta o arranque.
 */
export async function loadPrefereContactoTexto(email: string): Promise<boolean> {
  if (!email) return false;
  try {
    const resp = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tabela: "profiles",
        acao: "select",
        colunas: "prefere_contacto_texto",
        filtros: [["email", "eq", email]],
        limit: 1
      })
    });
    const resultado = await resp.json();
    return Boolean(resultado?.ok && resultado.data?.[0]?.prefere_contacto_texto);
  } catch (err) {
    console.error("[Acessibilidade] Erro ao carregar preferência de contacto:", err);
    return false;
  }
}

export async function savePrefereContactoTexto(email: string, valor: boolean): Promise<boolean> {
  if (!email) return false;
  try {
    const resp = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tabela: "profiles",
        acao: "update",
        dados: { prefere_contacto_texto: valor },
        filtros: [["email", "eq", email]]
      })
    });
    const resultado = await resp.json();
    return Boolean(resultado?.ok);
  } catch (err) {
    console.error("[Acessibilidade] Erro ao gravar preferência de contacto:", err);
    return false;
  }
}
