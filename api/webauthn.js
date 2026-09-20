import crypto from "crypto";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from "@simplewebauthn/server";
import { supabase } from "../server/lib/supabaseServer.js";
import { exigirSessaoValida } from "../server/lib/verificarSessao.js";

// Biometria real (WebAuthn) — regista/verifica a chave do autenticador da
// plataforma (Face ID / Touch ID / Windows Hello / impressão digital) do
// próprio dispositivo, guardando só a chave pública na tabela
// public.webauthn_credentials (nunca nenhum dado biométrico em si, que
// nunca sai do dispositivo do utilizador).

const RP_NAME = "CondoManager AI";
const ORIGENS_PERMITIDAS = [
  "https://bentorodrigues2.condomanagerai.com",
  "https://bentorodrigues2.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000"
];

function obterRpIdEOrigin(req) {
  const origin = req.headers.origin || "";
  if (ORIGENS_PERMITIDAS.includes(origin)) {
    return { rpID: new URL(origin).hostname, origin };
  }
  const site = process.env.SITE_URL || "https://bentorodrigues2.condomanagerai.com";
  return { rpID: new URL(site).hostname, origin: site };
}

// O desafio (challenge) do WebAuthn tem de ser validado no passo seguinte
// sem guardar estado nenhum no servidor entre pedidos (ambiente serverless,
// sem sessão fixa) — vai assinado (HMAC) e com validade de 5 minutos,
// reaproveitando a service role key como segredo (já só existe no servidor).
const CHALLENGE_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback-dev-secret";

function assinarChallenge(challenge, extra) {
  const payload = JSON.stringify({ challenge, extra, exp: Date.now() + 5 * 60 * 1000 });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const hmac = crypto.createHmac("sha256", CHALLENGE_SECRET).update(payloadB64).digest("hex");
  return `${payloadB64}.${hmac}`;
}

function verificarChallengeToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payloadB64, hmac] = token.split(".");
  const hmacEsperado = crypto.createHmac("sha256", CHALLENGE_SECRET).update(payloadB64).digest("hex");
  if (hmac !== hmacEsperado) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function registoOpcoes(req, res) {
  const utilizador = await exigirSessaoValida(req, res);
  if (!utilizador) return;
  const { rpID } = obterRpIdEOrigin(req);
  const email = (utilizador.email || "").trim().toLowerCase();

  const { data: existentes } = await supabase
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_email", email);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: email,
    userDisplayName: email,
    attestationType: "none",
    excludeCredentials: (existentes || []).map((c) => ({
      id: c.credential_id,
      transports: c.transports || undefined
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      authenticatorAttachment: "platform"
    }
  });

  const challengeToken = assinarChallenge(options.challenge, { email });
  return res.status(200).json({ ok: true, options, challengeToken });
}

async function registoVerificar(req, res) {
  const utilizador = await exigirSessaoValida(req, res);
  if (!utilizador) return;
  const { origin, rpID } = obterRpIdEOrigin(req);
  const email = (utilizador.email || "").trim().toLowerCase();
  const { response, challengeToken, deviceLabel } = req.body || {};

  const dadosChallenge = verificarChallengeToken(challengeToken);
  if (!dadosChallenge || dadosChallenge.extra?.email !== email) {
    return res.status(400).json({ ok: false, error: "Pedido de registo expirado ou inválido. Tente novamente." });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: dadosChallenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: "Não foi possível verificar a biometria: " + err.message });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ ok: false, error: "Não foi possível verificar a biometria." });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const { error } = await supabase.from("webauthn_credentials").insert({
    user_email: email,
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: response?.response?.transports || null,
    device_type: credentialDeviceType,
    backed_up: credentialBackedUp,
    device_label: (deviceLabel || "").slice(0, 120) || null
  });

  if (error) {
    console.error("[webauthn] Erro ao guardar credencial:", error);
    return res.status(500).json({ ok: false, error: "Não foi possível guardar a credencial biométrica no Supabase." });
  }

  return res.status(200).json({ ok: true, credentialId: credential.id });
}

async function loginOpcoes(req, res) {
  const email = (req.query.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ ok: false, error: "Email é obrigatório." });
  const { rpID } = obterRpIdEOrigin(req);

  const { data: credenciais } = await supabase
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_email", email);

  if (!credenciais || credenciais.length === 0) {
    return res.status(404).json({ ok: false, error: "Não há biometria registada para este email neste dispositivo/servidor." });
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: credenciais.map((c) => ({ id: c.credential_id, transports: c.transports || undefined }))
  });

  const challengeToken = assinarChallenge(options.challenge, { email });
  return res.status(200).json({ ok: true, options, challengeToken });
}

async function loginVerificar(req, res) {
  const { response, challengeToken, email: emailBody } = req.body || {};
  const email = (emailBody || "").trim().toLowerCase();
  const { origin, rpID } = obterRpIdEOrigin(req);

  const dadosChallenge = verificarChallengeToken(challengeToken);
  if (!dadosChallenge || dadosChallenge.extra?.email !== email) {
    return res.status(400).json({ ok: false, error: "Pedido de autenticação expirado ou inválido. Tente novamente." });
  }

  const { data: credencial } = await supabase
    .from("webauthn_credentials")
    .select("*")
    .eq("user_email", email)
    .eq("credential_id", response?.id)
    .maybeSingle();

  if (!credencial) {
    return res.status(400).json({ ok: false, error: "Credencial biométrica não reconhecida." });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: dadosChallenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credencial.credential_id,
        publicKey: Buffer.from(credencial.public_key, "base64url"),
        counter: credencial.counter,
        transports: credencial.transports || undefined
      }
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: "Não foi possível verificar a biometria: " + err.message });
  }

  if (!verification.verified) {
    return res.status(400).json({ ok: false, error: "Não foi possível verificar a biometria." });
  }

  await supabase
    .from("webauthn_credentials")
    .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq("id", credencial.id);

  // A identidade já foi confirmada pela assinatura biométrica verificada
  // acima — gera uma sessão real do Supabase Auth para este utilizador sem
  // pedir a password (mesmo padrão de generateLink já usado em convites e
  // recuperação de password em api/admin.js), devolvendo o hashed_token
  // para o browser trocar por uma sessão real via supabase.auth.verifyOtp.
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error("[webauthn] Erro ao gerar sessão pós-biometria:", linkError);
    return res.status(500).json({ ok: false, error: "Biometria confirmada, mas não foi possível iniciar sessão. Tente com a password." });
  }

  return res.status(200).json({ ok: true, hashedToken: linkData.properties.hashed_token, email });
}

async function listarCredenciais(req, res) {
  const utilizador = await exigirSessaoValida(req, res);
  if (!utilizador) return;
  const email = (utilizador.email || "").trim().toLowerCase();

  const { data, error } = await supabase
    .from("webauthn_credentials")
    .select("id, credential_id, device_label, device_type, created_at, last_used_at")
    .eq("user_email", email)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ ok: false, error: "Não foi possível listar as credenciais." });
  return res.status(200).json({ ok: true, credenciais: data || [] });
}

async function removerCredencial(req, res) {
  const utilizador = await exigirSessaoValida(req, res);
  if (!utilizador) return;
  const email = (utilizador.email || "").trim().toLowerCase();
  const { credentialId } = req.body || {};
  if (!credentialId) return res.status(400).json({ ok: false, error: "credentialId é obrigatório." });

  const { error } = await supabase
    .from("webauthn_credentials")
    .delete()
    .eq("user_email", email)
    .eq("credential_id", credentialId);

  if (error) return res.status(500).json({ ok: false, error: "Não foi possível remover a credencial." });
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  const acao = req.query.acao;
  try {
    if (acao === "registo-opcoes") return await registoOpcoes(req, res);
    if (acao === "registo-verificar") return await registoVerificar(req, res);
    if (acao === "login-opcoes") return await loginOpcoes(req, res);
    if (acao === "login-verificar") return await loginVerificar(req, res);
    if (acao === "listar-credenciais") return await listarCredenciais(req, res);
    if (acao === "remover-credencial") return await removerCredencial(req, res);
    return res.status(400).json({ ok: false, error: "Ação desconhecida." });
  } catch (err) {
    console.error("[webauthn] Erro inesperado:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Erro interno." });
  }
}
