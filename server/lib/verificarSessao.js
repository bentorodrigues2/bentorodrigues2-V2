import { supabase } from "./supabaseServer.js";

/**
 * Valida o token de acesso do Supabase Auth enviado pelo cliente
 * (Authorization: Bearer <access_token>) contra o servidor de autenticação.
 * Devolve o utilizador autenticado, ou null se não houver sessão válida.
 */
export async function obterUtilizadorAutenticado(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

/**
 * Exige uma sessão real e válida — usar no início de qualquer endpoint que
 * leia/escreva dados reais, envie emails reais ou chame a IA. Sem isto,
 * qualquer pessoa na internet sem conta conseguia acionar estas ações.
 * Se não houver sessão válida, já responde 401 e devolve null (o chamador
 * deve then fazer `return` de imediato).
 */
export async function exigirSessaoValida(req, res) {
  const utilizador = await obterUtilizadorAutenticado(req);
  if (!utilizador) {
    res.status(401).json({ error: "Sessão não autenticada." });
    return null;
  }
  return utilizador;
}

/**
 * Como exigirSessaoValida, mas também confirma que o utilizador tem um dos
 * papéis (profiles.role) indicados — para ações sensíveis (ex: convidar
 * novos utilizadores) que não devem estar abertas a qualquer condómino.
 */
export async function exigirSessaoComPapel(req, res, papeisPermitidos) {
  const utilizador = await exigirSessaoValida(req, res);
  if (!utilizador) return null;

  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("email", utilizador.email)
    .maybeSingle();

  if (!perfil || !papeisPermitidos.includes(perfil.role)) {
    res.status(403).json({ error: "Sem permissão para esta ação." });
    return null;
  }
  return utilizador;
}
