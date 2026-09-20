import { startRegistration, startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { supabase } from "@/lib/supabaseClient";

export { browserSupportsWebAuthn };

/**
 * Regista a biometria (Face ID / Touch ID / Windows Hello / impressão
 * digital) deste dispositivo para o utilizador com sessão ativa. Requer uma
 * sessão real do Supabase Auth (o endpoint exige-a) — chamado a partir do
 * toggle "Ativação de Dados Biométricos" em Definições de Segurança.
 */
export async function registarBiometriaNesteDispositivo(): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { ok: false, error: "Sessão expirada — inicie sessão novamente." };

  const respOpcoes = await fetch("/api/admin?acao=webauthn-registo-opcoes", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }
  });
  const dadosOpcoes = await respOpcoes.json();
  if (!respOpcoes.ok || !dadosOpcoes.ok) {
    return { ok: false, error: dadosOpcoes.error || "Não foi possível iniciar o registo biométrico." };
  }

  const attestationResponse = await startRegistration({ optionsJSON: dadosOpcoes.options });

  const respVerificar = await fetch("/api/admin?acao=webauthn-registo-verificar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({
      response: attestationResponse,
      challengeToken: dadosOpcoes.challengeToken,
      deviceLabel: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 120) : undefined
    })
  });
  const dadosVerificar = await respVerificar.json();
  if (!respVerificar.ok || !dadosVerificar.ok) {
    return { ok: false, error: dadosVerificar.error || "Não foi possível confirmar a biometria." };
  }

  if (dadosVerificar.credentialId) {
    try {
      localStorage.setItem("webauthn_credential_id", dadosVerificar.credentialId);
    } catch {}
  }
  return { ok: true };
}

/**
 * Remove a credencial biométrica registada neste dispositivo (desativação
 * real, não só visual) — usada quando o toggle passa a desligado.
 */
export async function removerBiometriaNesteDispositivo(): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { ok: false, error: "Sessão expirada." };

  let credentialId: string | null = null;
  try {
    credentialId = localStorage.getItem("webauthn_credential_id");
  } catch {}
  if (!credentialId) return { ok: true };

  const resp = await fetch("/api/admin?acao=webauthn-remover-credencial", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ credentialId })
  });
  const dados = await resp.json();
  if (resp.ok && dados.ok) {
    try { localStorage.removeItem("webauthn_credential_id"); } catch {}
  }
  return { ok: resp.ok && dados.ok, error: dados.error };
}

/**
 * Login sem password: confirma a biometria do dispositivo e troca a
 * verificação por uma sessão real do Supabase Auth. Usado pelo botão
 * "Entrar com Biometria" no ecrã de autenticação.
 */
export async function loginComBiometria(email: string): Promise<{ ok: boolean; error?: string; cancelado?: boolean }> {
  const emailLimpo = (email || "").trim().toLowerCase();
  if (!emailLimpo) return { ok: false, error: "Indique o seu email para continuar com biometria." };

  const respOpcoes = await fetch("/api/admin?acao=webauthn-login-opcoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailLimpo })
  });
  const dadosOpcoes = await respOpcoes.json();
  if (!respOpcoes.ok || !dadosOpcoes.ok) {
    return { ok: false, error: dadosOpcoes.error || "Sem biometria registada para este email neste dispositivo." };
  }

  let authResponse;
  try {
    authResponse = await startAuthentication({ optionsJSON: dadosOpcoes.options });
  } catch (err: any) {
    if (err?.name === "NotAllowedError") return { ok: false, cancelado: true };
    return { ok: false, error: err?.message || "Não foi possível ler a biometria." };
  }

  const respVerificar = await fetch("/api/admin?acao=webauthn-login-verificar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response: authResponse, challengeToken: dadosOpcoes.challengeToken, email: emailLimpo })
  });
  const dadosVerificar = await respVerificar.json();
  if (!respVerificar.ok || !dadosVerificar.ok) {
    return { ok: false, error: dadosVerificar.error || "Não foi possível confirmar a biometria." };
  }

  const { error: otpError } = await supabase.auth.verifyOtp({
    email: emailLimpo,
    token: dadosVerificar.hashedToken,
    type: "magiclink"
  });
  if (otpError) return { ok: false, error: "Biometria confirmada, mas não foi possível iniciar sessão: " + otpError.message };

  return { ok: true };
}
