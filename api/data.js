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
 *
 * IMPORTANTE (corrigido nesta revisão): até aqui, este proxy só verificava
 * que existia uma sessão válida — não verificava o PAPEL do utilizador nem
 * a que PRÉDIO pertence. Como corre com a service_role key (que ignora
 * RLS), isto significava que qualquer conta autenticada, mesmo um
 * coproprietário ou inquilino recém-criado, conseguia ler ou escrever
 * diretamente em QUALQUER tabela permitida de QUALQUER prédio — incluindo,
 * em teoria, escrever "profiles" para se auto-promover a ADMIN, ou apagar
 * dívidas/movimentos de outro condomínio. Ver as duas camadas de defesa
 * abaixo.
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
  "ai_auditoria",
  "email_templates",
  "equipamentos_scie",
  "vistorias",
  "limpezas",
  "incidencias_limpeza",
  "push_subscriptions",
  "caucoes",
  "pontos_votacao",
  "agenda_vistorias_tecnicas",
  "intervencoes_tecnicas",
  "obras_extraordinarias",
  "plano_manutencao_obrigatoria",
  "inventario_tecnico",
  "mural_avisos",
  "reservas_espacos_mural",
  "equipas_prestadores",
  "rfps",
  "propostas",
  "dividas_fornecedores",
  "revisoes_orcamento",
  "pagamentos_dividas_fornecedores",
  "pagamentos"
]);

// Registos de auditoria: só select e insert, mesmo por este proxy — para
// serem mesmo inalteráveis, não só "sem botão para editar na interface".
const TABELAS_SO_LEITURA_E_INSERCAO = new Set(["auditoria_plataforma", "ai_auditoria"]);

// Papéis de gestão — mantêm o comportamento de sempre (acesso total, sem
// restrição extra). Todos os outros papéis (USER, INQUILINO,
// COPROPRIETARIO, TECNICO, LIMPEZAS, JURIDICO, AUDITOR, CONTABILISTA) ficam
// sujeitos às duas camadas de defesa abaixo.
const PAPEIS_GESTAO = new Set(["ADMIN", "EMPRESA_GESTORA", "GESTOR"]);

// Camada 1 — Tabelas nucleares (financeiro, identidade/perfis, configuração
// da plataforma): nunca escritas por um papel que não seja de gestão, seja
// qual for o id_predio. Não existe hoje nenhum fluxo legítimo de um
// condómino, inquilino ou perfil PWA de fornecedor escrever diretamente
// nestas tabelas — só a UI de administração o faz.
const TABELAS_ESCRITA_SO_GESTAO = new Set([
  "profiles",
  "predios",
  "fracoes",
  "proprietarios",
  "contas",
  "movimentos",
  "dividas_fornecedores",
  "pagamentos_dividas_fornecedores",
  "pagamentos",
  "revisoes_orcamento",
  "configuracao_quotas_predio",
  "contratos",
  "fornecedores",
  "empresa_gestora_config",
  "gestores_carteira",
  "email_templates",
  "equipas_prestadores",
  "rfps",
  "propostas"
]);

// Leitura dos registos de auditoria: só gestão + AUDITOR (é o único papel
// cuja função é precisamente rever este histórico).
const TABELAS_LEITURA_SO_GESTAO_OU_AUDITOR = new Set(["auditoria_plataforma", "ai_auditoria"]);

// Camada 2 — Isolamento multi-condomínio: tabelas com id_predio próprio, em
// que um papel que não seja de gestão só pode ler/escrever linhas do SEU
// PRÓPRIO prédio (perfis.id_predio). O filtro é sempre imposto pelo
// servidor a partir do perfil autenticado — nunca a partir do que o
// cliente envia — para um pedido forjado não conseguir contornar isto.
const TABELAS_COM_ID_PREDIO = new Set([
  "predios", "fracoes", "proprietarios", "contas", "movimentos", "avisos",
  "documentos", "ocorrencias", "reservas", "fornecedores",
  "processos_juridicos", "gestao_chaves", "comunicados", "conversas",
  "sondagens", "residentes_inquilinos", "pedidos_regulamento", "sinistros",
  "contratos", "reunioes", "configuracao_quotas_predio", "profiles",
  "respostas_ia_pendentes", "auditoria_plataforma", "ai_auditoria",
  "email_templates", "equipamentos_scie", "vistorias", "limpezas",
  "incidencias_limpeza", "push_subscriptions", "caucoes", "pontos_votacao",
  "agenda_vistorias_tecnicas", "intervencoes_tecnicas",
  "obras_extraordinarias", "plano_manutencao_obrigatoria",
  "inventario_tecnico", "mural_avisos", "reservas_espacos_mural",
  "equipas_prestadores", "rfps", "dividas_fornecedores",
  "revisoes_orcamento", "pagamentos_dividas_fornecedores", "questionarios"
]);

// Tabelas sem id_predio próprio, mas com id_fracao — isoladas pela fração
// do próprio utilizador em vez do prédio inteiro.
// "pagamentos" (comprovativos de condóminos) não tem id_predio próprio, só
// id_fracao — ver fetchPagamentosPendentesInfoFromSupabase em
// supabaseService.ts. Hoje só é lida/escrita por este proxy em ecrãs de
// gestão (papel de gestão ignora esta isolação de qualquer forma), mas
// entra aqui pela mesma defesa em profundidade das restantes tabelas.
const TABELAS_COM_ID_FRACAO = new Set(["sondagens_votos", "questionarios_respostas", "pagamentos"]);

// Tabelas cuja coluna de isolamento tem um nome diferente do habitual
// (id_predio/id_fracao) — mapeadas explicitamente para o nome real.
const NOME_COLUNA_ISOLAMENTO_PERSONALIZADO = {
  seguros_partes_comuns: "predio_id",
  seguros_fracoes: "fracao_id"
};
const TABELAS_COM_PREDIO_PERSONALIZADO = new Set(["seguros_partes_comuns"]);
const TABELAS_COM_FRACAO_PERSONALIZADO = new Set(["seguros_fracoes"]);

// mensagens_conversa não tem id_predio/id_fracao próprio — só id_conversa,
// que segue sempre o padrão determinístico "conv-<id_fracao>" (ver
// encontrarFracaoDoCondomino/PortalCondomino.tsx, onde este ID é gerado).
// Em vez de uma subconsulta a "conversas", isola-se diretamente pelo
// id_conversa esperado para a fração do próprio utilizador.

const OPERADORES_PERMITIDOS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "in", "is"]);

function aplicarFiltros(query, filtros) {
  for (const filtro of filtros || []) {
    const [coluna, operador, valor] = filtro;
    if (!OPERADORES_PERMITIDOS.has(operador)) continue;
    query = query[operador](coluna, valor);
  }
  return query;
}

/** Devolve {coluna, valor} do isolamento a aplicar para este utilizador
 * nesta tabela, ou null se a tabela não tiver coluna de isolamento (não
 * bloqueia — só não acrescenta filtro extra). */
function colunaIsolamento(tabela, perfil) {
  if (tabela === "mensagens_conversa") return { coluna: "id_conversa", valor: perfil.fracao ? `conv-${perfil.fracao}` : null };
  if (TABELAS_COM_PREDIO_PERSONALIZADO.has(tabela)) return { coluna: NOME_COLUNA_ISOLAMENTO_PERSONALIZADO[tabela], valor: perfil.id_predio || null };
  if (TABELAS_COM_FRACAO_PERSONALIZADO.has(tabela)) return { coluna: NOME_COLUNA_ISOLAMENTO_PERSONALIZADO[tabela], valor: perfil.fracao || null };
  if (TABELAS_COM_ID_PREDIO.has(tabela)) return { coluna: "id_predio", valor: perfil.id_predio || null };
  if (TABELAS_COM_ID_FRACAO.has(tabela)) return { coluna: "id_fracao", valor: perfil.fracao || null };
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Exige uma sessão real e válida do Supabase Auth. Sem isto, este proxy
  // (que corre com a service_role key, sem RLS) ficava acessível a qualquer
  // pessoa na internet sem conta nenhuma — bastava chamar /api/data
  // diretamente para ler ou escrever todos os dados de todas as tabelas
  // permitidas. auth.getUser() valida o token de acesso do utilizador
  // contra o servidor de autenticação do Supabase.
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Sessão não autenticada." });
  }
  let utilizadorAutenticado;
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return res.status(401).json({ error: "Sessão inválida ou expirada." });
    }
    utilizadorAutenticado = authData.user;
  } catch (err) {
    console.error("Erro ao validar sessão em /api/data:", err);
    return res.status(401).json({ error: "Não foi possível validar a sessão." });
  }

  // Perfil (papel + prédio + fração) do utilizador autenticado — é a partir
  // DAQUI, nunca do que o cliente envia no pedido, que se decide o que ele
  // pode ver/alterar.
  const { data: perfil } = await supabase
    .from("profiles")
    .select("role, id_predio, fracao")
    .eq("email", utilizadorAutenticado.email)
    .maybeSingle();
  const perfilChamador = perfil || { role: null, id_predio: null, fracao: null };
  const ehGestao = PAPEIS_GESTAO.has(perfilChamador.role);

  try {
    const { tabela, acao, colunas, filtros, orFiltro, order, limit, dados, opcoesUpsert } = req.body || {};

    if (!tabela || !TABELAS_PERMITIDAS.has(tabela)) {
      return res.status(400).json({ error: "Tabela inválida ou não permitida" });
    }

    if (TABELAS_SO_LEITURA_E_INSERCAO.has(tabela) && !["select", "insert"].includes(acao)) {
      return res.status(403).json({ error: "Esta tabela é um registo de auditoria — só permite leitura e inserção, nunca alteração nem eliminação." });
    }

    if (!ehGestao) {
      if (TABELAS_LEITURA_SO_GESTAO_OU_AUDITOR.has(tabela) && acao === "select" && perfilChamador.role !== "AUDITOR") {
        return res.status(403).json({ error: "Sem permissão para consultar registos de auditoria." });
      }
      if (TABELAS_ESCRITA_SO_GESTAO.has(tabela) && acao !== "select") {
        return res.status(403).json({ error: "Sem permissão para esta operação nesta tabela." });
      }
    }

    const isolamento = ehGestao ? null : colunaIsolamento(tabela, perfilChamador);

    if (acao === "select") {
      let query = supabase.from(tabela).select(colunas || "*");
      query = aplicarFiltros(query, filtros);
      // Imposto sempre depois dos filtros do cliente — como são todos
      // combinados com AND, um pedido a tentar ler outro prédio nunca
      // consegue alargar o resultado, só recebe menos (ou nada).
      if (isolamento) query = query.eq(isolamento.coluna, isolamento.valor);
      if (order?.coluna) query = query.order(order.coluna, { ascending: order.asc !== false });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) return res.status(200).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, data });
    }

    // Para insert/upsert, cada linha do payload tem de pertencer ao mesmo
    // prédio/fração do utilizador — em vez de confiar cegamente no
    // id_predio que o cliente envie.
    if ((acao === "insert" || acao === "upsert") && isolamento) {
      const linhas = Array.isArray(dados) ? dados : [dados];
      const linhaForaDoIsolamento = linhas.some((linha) => linha && linha[isolamento.coluna] !== isolamento.valor);
      if (linhaForaDoIsolamento) {
        return res.status(403).json({ error: `Não é permitido gravar dados fora do seu próprio ${isolamento.coluna === "id_predio" ? "prédio" : "fração"}.` });
      }
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
      // Também aqui: não deixar um "update" mudar a própria coluna de
      // isolamento para outro prédio/fração (ex: tentar "mudar" uma
      // ocorrência de prédio através do payload em vez do filtro).
      if (isolamento && dados && dados[isolamento.coluna] !== undefined && dados[isolamento.coluna] !== isolamento.valor) {
        return res.status(403).json({ error: `Não é permitido mover dados para fora do seu próprio ${isolamento.coluna === "id_predio" ? "prédio" : "fração"}.` });
      }
      let query = supabase.from(tabela).update(dados);
      query = aplicarFiltros(query, filtros);
      if (isolamento) query = query.eq(isolamento.coluna, isolamento.valor);
      const { data, error } = await query.select();
      if (error) return res.status(200).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, data });
    }

    if (acao === "delete") {
      let query = supabase.from(tabela).delete();
      query = aplicarFiltros(query, filtros);
      if (isolamento) query = query.eq(isolamento.coluna, isolamento.valor);
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
