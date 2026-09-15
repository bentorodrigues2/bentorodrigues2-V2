import { supabase } from "../server/lib/supabaseServer.js";

/**
 * Proxy único e genérico para todo o acesso a dados do Supabase que hoje
 * corre no browser com a chave pública (anon key) — que qualquer pessoa
 * consegue extrair do bundle JS e usar diretamente contra a REST API do
 * Supabase, sem passar pela app, contornando toda a proteção de perfis.
 *
 * Este endpoint corre no servidor com a service_role key (nunca exposta ao
 * browser). Assim que uma tabela está migrada para passar por aqui, a
 * política RLS dessa tabela passa a negar por omissão o acesso via anon
 * key — a única porta de entrada nos dados passa a ser este ficheiro.
 *
 * Só tabelas explicitamente listadas em TABELAS_PERMITIDAS são acessíveis,
 * para não se tornar um proxy SQL genérico para qualquer tabela.
 */

const TABELAS_PERMITIDAS = new Set([
  "predios",
  "fracoes",
  "proprietarios",
  "contas",
  "movimentos",
  "avisos",
  "documentos",
  "ocorrencias",
  "reservas",
  "fornecedores",
  "processos_juridicos",
  "gestao_chaves",
  "comunicados",
  "conversas",
  "mensagens_conversa",
  "sondagens",
  "sondagens_votos",
  "questionarios",
  "questionarios_respostas",
  "residentes_inquilinos",
  "pedidos_regulamento",
  "seguros_fracoes",
  "seguros_partes_comuns",
  "sinistros",
  "contratos",
  "reunioes",
  "configuracao_quotas_predio",
  "profiles",
  "empresa_gestora_config",
  "gestores_carteira",
  "respostas_ia_pendentes",
  "auditoria_plataforma",
  "ai_auditoria"
]);

// Registos de auditoria: só select e insert, mesmo por este proxy — para
// serem mesmo inalteráveis, não só "sem botão para editar na interface".
const TABELAS_SO_LEITURA_E_INSERCAO = new Set(["auditoria_plataforma", "ai_auditoria"]);

const OPERADORES_PERMITIDOS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "in", "is"]);

function aplicarFiltros(query, filtros) {
  for (const filtro of filtros || []) {
    const [coluna, operador, valor] = filtro;
    if (!OPERADORES_PERMITIDOS.has(operador)) continue;
    query = query[operador](coluna, valor);
  }
  return query;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { tabela, acao, colunas, filtros, orFiltro, order, limit, dados, opcoesUpsert } = req.body || {};

    if (!tabela || !TABELAS_PERMITIDAS.has(tabela)) {
      return res.status(400).json({ error: "Tabela inválida ou não permitida" });
    }

    if (TABELAS_SO_LEITURA_E_INSERCAO.has(tabela) && !["select", "insert"].includes(acao)) {
      return res.status(403).json({ error: "Esta tabela é um registo de auditoria — só permite leitura e inserção, nunca alteração nem eliminação." });
    }

    if (acao === "select") {
      let query = supabase.from(tabela).select(colunas || "*");
      query = aplicarFiltros(query, filtros);
      if (order?.coluna) query = query.order(order.coluna, { ascending: order.asc !== false });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) return res.status(200).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, data });
    }

    if (acao === "insert") {
      const { data, error } = await supabase.from(tabela).insert(dados).select();
      if (error) return res.status(200).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, data });
    }

    if (acao === "upsert") {
      const { data, error } = await supabase.from(tabela).upsert(dados, opcoesUpsert || undefined).select();
      if (error) return res.status(200).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, data });
    }

    if (acao === "update") {
      let query = supabase.from(tabela).update(dados);
      query = aplicarFiltros(query, filtros);
      const { data, error } = await query.select();
      if (error) return res.status(200).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, data });
    }

    if (acao === "delete") {
      let query = supabase.from(tabela).delete();
      query = aplicarFiltros(query, filtros);
      if (orFiltro) query = query.or(orFiltro);
      const { error } = await query;
      if (error) return res.status(200).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Ação inválida. Use select|insert|upsert|update|delete" });
  } catch (err) {
    console.error("Erro em /api/data:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
