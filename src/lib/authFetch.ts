import { supabase } from "./supabaseClient";

/**
 * Intercepta globalmente todas as chamadas fetch("/api/...") feitas em
 * qualquer parte da app, anexando o token de sessão real do Supabase Auth
 * (Authorization: Bearer <access_token>).
 *
 * Instalado uma única vez no arranque (main.tsx) em vez de editar
 * individualmente as dezenas de pontos da app que já chamam estes
 * endpoints diretamente com fetch() — garante que nenhum fica esquecido,
 * agora ou em código futuro, sem o token que os endpoints do servidor
 * (api/pdf.js, api/ai.js, api/email.js, api/admin.js, api/pagamento.js,
 * api/documento.js) passaram a exigir.
 *
 * Nunca envia o token para pedidos a outras origens (Google Fonts, Resend,
 * cdnjs, etc.) — só para caminhos relativos que começam por "/api/".
 */
export function installAuthFetchInterceptor() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const isApiRequest = url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`);

    if (!isApiRequest) {
      return originalFetch(input, init);
    }

    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        const headers = new Headers(init?.headers || (typeof input !== "string" && !(input instanceof URL) ? input.headers : undefined));
        if (!headers.has("Authorization")) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        return originalFetch(input, { ...init, headers });
      }
    } catch {
      // Sem sessão disponível — segue sem o cabeçalho, o endpoint decide
      // se essa ação em concreto pode ou não ser pública (ex: recuperar-password).
    }

    return originalFetch(input, init);
  };
}
