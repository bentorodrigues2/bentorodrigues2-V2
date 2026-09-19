import { supabase } from '@/lib/supabaseClient';
import type { Caucao } from '../components/FinanceiroAvancado';
import type { AgendaItem, Intervencao, ObraExtraordinaria } from '../components/GestaoManutencaoIntervencoes';
import type { EquipamentoTecnico } from '../components/InventarioTecnico';
import type { TeamMember } from '../components/MultiCondominio';
import { 
  Predio, 
  Fracao, 
  Proprietario,
  Conta,
  Fornecedor,
  DividaFornecedor,
  PagamentoDivida,
  RevisaoOrcamento,
  Movimento,
  Aviso, 
  Reuniao,
  PontoVotacaoAssembleia,
  Documento, 
  Ocorrencia, 
  Reserva,
  ChaveItem,
  SeguroFracao,
  SeguroPartesComuns,
  SinistroSeguro,
  ProcessoJuridico,
  Comunicado,
  ConversaCondomino,
  MensagemConversa,
  Sondagem,
  VotoSondagem,
  Questionario,
  RespostaQuestionario,
  EmpresaGestoraConfig,
  GestorCarteira,
  RespostaIAPendente,
  ItemPlanoManutencao,
  MuralAviso,
  ReservaEspacoComum
} from "../types";

/**
 * Checks if Supabase credentials are configured and not placeholders
 */
export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
    key &&
    !url.includes("placeholder-project") &&
    !key.includes("placeholder-anon-key")
  );
}

// ============================================================================
// ACESSO A DADOS VIA /api/data (proxy no servidor com service_role)
// ----------------------------------------------------------------------------
// Tabelas migradas para este proxy deixam de estar acessíveis diretamente
// pela anon key (RLS passa a negar por omissão nessas tabelas) — o browser
// só consegue ler/escrever passando por aqui, e este endpoint corre no
// servidor com uma chave que nunca é exposta ao cliente. Ver api/data.js.
// ============================================================================

type Filtro = [string, "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "is", any];

async function dbCall(body: Record<string, unknown>): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    // /api/data exige uma sessão real do Supabase Auth — anexa sempre o
    // token de acesso da sessão atual (ver api/data.js).
    const { data: sessionData } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (sessionData?.session?.access_token) {
      headers["Authorization"] = `Bearer ${sessionData.session.access_token}`;
    }
    const resp = await fetch("/api/data", {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}` };
    return await resp.json();
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function dbSelect(tabela: string, opts: { colunas?: string; filtros?: Filtro[]; order?: { coluna: string; asc?: boolean }; limit?: number } = {}): Promise<any[] | null> {
  const resultado = await dbCall({ tabela, acao: "select", ...opts });
  if (!resultado.ok || !resultado.data) return null;
  return resultado.data;
}

export async function dbInsert(tabela: string, dados: unknown): Promise<boolean> {
  const resultado = await dbCall({ tabela, acao: "insert", dados });
  if (!resultado.ok) console.warn(`[Supabase/data] Insert ${tabela} error:`, resultado.error);
  return resultado.ok;
}

export async function dbUpsert(tabela: string, dados: unknown, opcoesUpsert?: { onConflict?: string }): Promise<boolean> {
  const resultado = await dbCall({ tabela, acao: "upsert", dados, opcoesUpsert });
  if (!resultado.ok) console.warn(`[Supabase/data] Upsert ${tabela} error:`, resultado.error);
  return resultado.ok;
}

export async function dbUpdate(tabela: string, dados: unknown, filtros: Filtro[]): Promise<boolean> {
  const resultado = await dbCall({ tabela, acao: "update", dados, filtros });
  if (!resultado.ok) console.warn(`[Supabase/data] Update ${tabela} error:`, resultado.error);
  return resultado.ok;
}

export async function dbDelete(tabela: string, filtros?: Filtro[], orFiltro?: string): Promise<boolean> {
  const resultado = await dbCall({ tabela, acao: "delete", filtros, orFiltro });
  if (!resultado.ok) console.warn(`[Supabase/data] Delete ${tabela} error:`, resultado.error);
  return resultado.ok;
}

// ============================================================================
// PRÉDIOS
// ============================================================================

export async function fetchPrediosFromSupabase(): Promise<Predio[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("predios");
    if (!data || data.length === 0) return null;

    return data.map((row: any) => ({
      id_predio: row.id_predio,
      nome: row.nome,
      morada_linha1: row.morada_linha1,
      morada_linha2: row.morada_linha2 || null,
      num_porta: row.num_porta || "",
      letra_porta: row.letra_porta || null,
      codigo_postal: row.codigo_postal || "",
      localidade: row.localidade || "",
      nif: row.nif || "",
      patrimonio: row.patrimonio || {
        tem_elevador: false,
        num_elevadores: 0,
        tem_garagem: false,
        tem_piscina: false,
        tem_sala_comum: false,
        tem_arrecadacoes_comuns: false,
        tem_jardins: false,
        tem_churrasqueira: false,
        tem_terraco: false,
        tem_ginasio: false,
        tem_spa: false,
      },
      foto: row.foto || null,
      iban: row.iban || null,
      email: row.email || null,
      email_condominio: row.email_condominio || row.email || null,
      autoresponder_ativo: row.autoresponder_ativo ?? true,
      autoresponder_modo: row.autoresponder_modo || "confirmacao_previa"
    }));
  } catch (err) {
    console.warn("[Supabase] Exception fetching predios:", err);
    return null;
  }
}

export async function savePredioToSupabase(predio: Predio): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("predios", {
    id_predio: predio.id_predio,
    nome: predio.nome,
    morada_linha1: predio.morada_linha1,
    morada_linha2: predio.morada_linha2,
    num_porta: predio.num_porta,
    letra_porta: predio.letra_porta,
    codigo_postal: predio.codigo_postal,
    localidade: predio.localidade,
    nif: predio.nif,
    patrimonio: predio.patrimonio,
    iban: predio.iban,
    email: predio.email,
    email_condominio: predio.email_condominio || predio.email,
    autoresponder_ativo: predio.autoresponder_ativo ?? true,
    autoresponder_modo: predio.autoresponder_modo || "confirmacao_previa",
    foto: predio.foto
  });
}

export async function deletePredioFromSupabase(idPredio: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbDelete("predios", [["id_predio", "eq", idPredio]]);
}

// ============================================================================
// FRAÇÕES
// ============================================================================

export async function fetchFracoesFromSupabase(idPredio?: string): Promise<Fracao[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("fracoes", { filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined });
    if (!data || data.length === 0) return null;

    return data.map((row: any) => ({
      id_fracao: row.id_fracao,
      id_predio: row.id_predio,
      fracao_nome: row.fracao_nome,
      piso: row.piso || "",
      permilagem: Number(row.permilagem) || 0,
      tipologia: row.tipologia || "Habitação",
      tipo_access: row.tipo_access || "Residencial",
      tem_garagem_spot: Boolean(row.tem_garagem_spot),
      tem_arrecadacao_box: Boolean(row.tem_arrecadacao_box),
      is_arrendada: Boolean(row.is_arrendada),
      administrador_interno: row.administrador_interno || "Não",
      notificacao_preferencial: row.notificacao_preferencial || "E-mail",
      proprietario: row.proprietario || { nome: "", nif: "", email: "", tlm: "" },
      proprietarios_adicionais: row.proprietarios_adicionais || [],
      historico_proprietarios: row.historico_proprietarios || [],
      inquilino: row.inquilino || null,
      seguradora: row.seguradora || "",
      apolice_num: row.apolice_num || "",
      apolice_validade: row.apolice_validade || "",
      apolice_doc: row.apolice_doc || undefined,
      referencia_br23e: row.referencia_br23e || undefined,
      solicitacao_email_incendio: row.solicitacao_email_incendio ?? true
    }));
  } catch (err) {
    return null;
  }
}

export async function saveFracaoToSupabase(fracao: Fracao): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("fracoes", {
    id_fracao: fracao.id_fracao,
    id_predio: fracao.id_predio,
    fracao_nome: fracao.fracao_nome,
    piso: fracao.piso,
    permilagem: fracao.permilagem,
    tipologia: fracao.tipologia,
    tipo_access: fracao.tipo_access,
    tem_garagem_spot: fracao.tem_garagem_spot,
    tem_arrecadacao_box: fracao.tem_arrecadacao_box,
    is_arrendada: fracao.is_arrendada,
    proprietario: fracao.proprietario,
    proprietarios_adicionais: fracao.proprietarios_adicionais || [],
    historico_proprietarios: fracao.historico_proprietarios || [],
    inquilino: fracao.inquilino,
    administrador_interno: fracao.administrador_interno,
    notificacao_preferencial: fracao.notificacao_preferencial,
    referencia_br23e: fracao.referencia_br23e,
    seguradora: fracao.seguradora,
    apolice_num: fracao.apolice_num,
    apolice_validade: fracao.apolice_validade,
    apolice_doc: fracao.apolice_doc,
    solicitacao_email_incendio: fracao.solicitacao_email_incendio
  });
}

export async function deleteFracaoFromSupabase(idFracao: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbDelete("fracoes", [["id_fracao", "eq", idFracao]]);
}

export async function saveProprietarioToSupabase(proprietario: Proprietario, idFracao?: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  // If associated with a fraction, update fraction's owner
  if (idFracao) {
    await dbUpdate("fracoes", {
      proprietario: proprietario,
      administrador_interno: proprietario.administrador_interno || "Não",
      notificacao_preferencial: proprietario.notificacao_preferencial || "Digital (E-mail e Mensagens Push)"
    }, [["id_fracao", "eq", idFracao]]);
  }
  // Also try saving to proprietarios table if present (safe no-op if it doesn't exist)
  await dbUpsert("proprietarios", {
    id_proprietario: proprietario.id_proprietario || proprietario.nif,
    id_predio: proprietario.id_predio,
    id_fracao: idFracao || proprietario.id_fracao,
    nome: proprietario.nome,
    nif: proprietario.nif,
    email: proprietario.email,
    tlm: proprietario.tlm,
    iban: proprietario.iban,
    data_nascimento: proprietario.data_nascimento || null,
    administrador_interno: proprietario.administrador_interno,
    notificacao_preferencial: proprietario.notificacao_preferencial
  });
  return true;
}

export async function deleteProprietarioFromSupabase(identifier: string, idFracao?: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  if (idFracao) {
    await dbUpdate("fracoes", { proprietario: null, administrador_interno: "Não" }, [["id_fracao", "eq", idFracao]]);
  }
  await dbDelete("proprietarios", undefined, `id_proprietario.eq.${identifier},nif.eq.${identifier},email.eq.${identifier}`);
  return true;
}

// ============================================================================
// CONTAS BANCÁRIAS DO PRÉDIO / CONDOMÍNIO
// ============================================================================

export async function fetchContasFromSupabase(idPredio?: string): Promise<Conta[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("contas", { filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined });
    if (!data || data.length === 0) return null;

    return data.map((row: any) => ({
      id_conta: row.id_conta,
      id_predio: row.id_predio,
      banco: row.banco,
      iban: row.iban,
      tipo: row.tipo || "Ordem (Gestão Corrente)",
      saldo: Number(row.saldo) || 0,
      balcao: row.balcao || "",
      morada_balcao: row.morada_balcao || "",
      contacto_banco: row.contacto_banco || "",
      gestor_contas: row.gestor_contas || "",
      email_gestor: row.email_gestor || undefined,
      is_principal: Boolean(row.is_principal)
    }));
  } catch (err) {
    return null;
  }
}

export async function saveContaToSupabase(conta: Conta): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("contas", {
    id_conta: conta.id_conta,
    id_predio: conta.id_predio,
    banco: conta.banco,
    iban: conta.iban,
    tipo: conta.tipo,
    saldo: conta.saldo,
    balcao: conta.balcao || null,
    morada_balcao: conta.morada_balcao || null,
    contacto_banco: conta.contacto_banco || null,
    gestor_contas: conta.gestor_contas || null,
    email_gestor: conta.email_gestor || null,
    is_principal: Boolean(conta.is_principal)
  });
}

export async function deleteContaFromSupabase(idConta: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbDelete("contas", [["id_conta", "eq", idConta]]);
}

// ============================================================================
// MOVIMENTOS FINANCEIROS
// ============================================================================

export async function fetchMovimentosFromSupabase(idPredio?: string): Promise<Movimento[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("movimentos", { filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined });
    if (!data || data.length === 0) return null;

    return data.map((row: any) => ({
      id_mov: row.id_movimento,
      id_predio: row.id_predio,
      id_conta: row.id_conta || "",
      data: row.data,
      tipo: row.tipo,
      valor: Number(row.valor),
      descricao: row.descricao,
      categoria: row.categoria,
      fotos: row.fotos || [],
      estado: row.estado || "Confirmado",
      is_movimento_cego: Boolean(row.is_movimento_cego),
      id_fracao: row.fracao_id,
      metodo_pagamento: row.forma_pagamento,
      id_fornecedor: row.id_fornecedor || undefined
    }));
  } catch (err) {
    return null;
  }
}

export async function saveMovimentoToSupabase(mov: Movimento): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("movimentos", {
    id_movimento: mov.id_mov,
    id_predio: mov.id_predio,
    id_conta: mov.id_conta || null,
    data: mov.data,
    tipo: mov.tipo,
    categoria: mov.categoria,
    descricao: mov.descricao,
    valor: mov.valor,
    fracao_id: mov.id_fracao || null,
    forma_pagamento: mov.metodo_pagamento || "Transferência",
    id_fornecedor: mov.id_fornecedor || null
  });
}

// ============================================================================
// UPLOAD DE FICHEIROS PARA O SUPABASE STORAGE
// ============================================================================

export async function uploadDocumentoToStorage(file: File, path: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase.storage
      .from("documentos")
      .upload(path, file, { upsert: true });

    if (error) {
      console.warn("[Supabase Storage] Upload error:", error.message);
      return null;
    }

    // O bucket "documentos" é privado (só leitura para utilizadores
    // autenticados via RLS) — getPublicUrl() devolvia um link que parecia
    // válido mas dava 403 ao ser aberto diretamente (um <a href> normal não
    // carrega o token de sessão). Um URL assinado de longa duração é o que
    // realmente funciona para um documento de arquivo permanente.
    const { data: signedData, error: signError } = await supabase.storage
      .from("documentos")
      .createSignedUrl(data.path, 60 * 60 * 24 * 365 * 10); // 10 anos

    if (signError || !signedData?.signedUrl) {
      console.warn("[Supabase Storage] Erro ao assinar URL:", signError?.message);
      return null;
    }

    return signedData.signedUrl;
  } catch (err) {
    console.warn("[Supabase Storage] Exception:", err);
    return null;
  }
}

// ============================================================================
// PERFIS DE UTILIZADOR & AUTENTICAÇÃO SUPABASE (ÁREA PESSOAL)
// ============================================================================

export interface SupabaseUserProfile {
  id: string;
  email: string;
  nome: string;
  role: "ADMIN" | "GESTOR" | "EMPRESA_GESTORA" | "USER" | "INQUILINO" | "COPROPRIETARIO" | "TECNICO" | "LIMPEZAS" | "CONTABILISTA" | "JURIDICO" | "AUDITOR";
  telefone?: string;
  nif?: string;
  fracao?: string;
  id_predio?: string;
  foto_url?: string;
  ultimo_acesso?: string;
  ativo?: boolean;
}

export async function fetchUserProfile(userId: string): Promise<SupabaseUserProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const data = await dbSelect("profiles", { filtros: [["id", "eq", userId]] });
  if (!data || data.length === 0) return null;
  return data[0] as SupabaseUserProfile;
}

export async function fetchUserProfileByEmail(email: string): Promise<SupabaseUserProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const data = await dbSelect("profiles", { filtros: [["email", "eq", (email || "").trim().toLowerCase()]] });
  if (!data || data.length === 0) return null;
  return data[0] as SupabaseUserProfile;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<SupabaseUserProfile>
): Promise<{ success: boolean; data?: SupabaseUserProfile; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase não configurado" };
  }
  const ok = await dbUpdate("profiles", { ...updates, updated_at: new Date().toISOString() }, [["id", "eq", userId]]);
  return ok ? { success: true } : { success: false, error: "Falha ao atualizar perfil" };
}

export async function fetchAllProfiles(): Promise<SupabaseUserProfile[]> {
  if (!isSupabaseConfigured()) return [];
  const data = await dbSelect("profiles", { order: { coluna: "created_at", asc: false } });
  return (data || []) as SupabaseUserProfile[];
}

// ============================================================================
// EMPRESA GESTORA (CONFIGURAÇÃO INSTITUCIONAL & GESTORES DE CARTEIRA)
// ============================================================================

export async function fetchEmpresaGestoraConfig(): Promise<EmpresaGestoraConfig | null> {
  if (!isSupabaseConfigured()) return null;
  const data = await dbSelect("empresa_gestora_config", { filtros: [["id", "eq", "default"]] });
  if (!data || data.length === 0) return null;
  return data[0] as EmpresaGestoraConfig;
}

export async function saveEmpresaGestoraConfig(config: EmpresaGestoraConfig): Promise<boolean> {
  const { gestores, ...configSemGestores } = config as EmpresaGestoraConfig & { gestores?: GestorCarteira[] };
  return dbUpsert(
    "empresa_gestora_config",
    { ...configSemGestores, id: "default", updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
}

export async function fetchGestoresCarteiraFromSupabase(): Promise<GestorCarteira[]> {
  if (!isSupabaseConfigured()) return [];
  const data = await dbSelect("gestores_carteira", { order: { coluna: "created_at", asc: false } });
  return (data || []) as GestorCarteira[];
}

export async function saveGestorCarteiraToSupabase(gestor: GestorCarteira): Promise<boolean> {
  return dbUpsert("gestores_carteira", gestor, { onConflict: "id_gestor" });
}

export async function deleteGestorCarteiraFromSupabase(idGestor: string): Promise<boolean> {
  return dbDelete("gestores_carteira", [["id_gestor", "eq", idGestor]]);
}

// ============================================================================
// RESPOSTAS DE IA PENDENTES DE CONFIRMAÇÃO (Autoresponder — modo Confirmação Prévia)
// ============================================================================

export async function fetchRespostasIAPendentes(idPredio: string): Promise<RespostaIAPendente[]> {
  if (!isSupabaseConfigured() || !idPredio) return [];
  const data = await dbSelect("respostas_ia_pendentes", {
    filtros: [["id_predio", "eq", idPredio], ["estado", "eq", "PENDENTE"]],
    order: { coluna: "criado_em", asc: false }
  });
  return (data || []) as RespostaIAPendente[];
}

// ============================================================================
// REGISTO DE AUDITORIA (inalterável — só select/insert, ver api/data.js)
// ============================================================================

export interface RegistoAuditoria {
  id: string;
  id_predio?: string | null;
  seccao: string;
  descricao: string;
  detalhes?: string | null;
  usuario?: string | null;
  email_usuario?: string | null;
  role_usuario?: string | null;
  origem?: "web" | "ia" | "cron";
  criado_em: string;
}

export async function fetchRegistoAuditoria(idPredio: string): Promise<RegistoAuditoria[]> {
  if (!isSupabaseConfigured() || !idPredio) return [];
  const data = await dbSelect("auditoria_plataforma", {
    filtros: [["id_predio", "eq", idPredio]],
    order: { coluna: "criado_em", asc: false },
    limit: 300
  });
  return (data || []) as RegistoAuditoria[];
}

export async function registarAuditoria(entry: Omit<RegistoAuditoria, "criado_em">): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbInsert("auditoria_plataforma", { ...entry, origem: entry.origem || "web" });
}

/**
 * Atalho para os módulos que só precisam de registar "quem fez o quê" sem
 * repetir o id/origem em cada sítio — usar em vez de registarAuditoria
 * diretamente sempre que não seja preciso controlar esses detalhes.
 */
export async function registarLogAuditoria(
  seccao: string,
  descricao: string,
  idPredio: string | undefined,
  loggedUser: { nome?: string; email?: string; role?: string } | undefined,
  detalhes?: string
): Promise<boolean> {
  return registarAuditoria({
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    id_predio: idPredio || null,
    seccao,
    descricao,
    detalhes: detalhes || null,
    usuario: loggedUser?.nome || null,
    email_usuario: loggedUser?.email || null,
    role_usuario: loggedUser?.role || null,
    origem: "web"
  });
}

export interface DecisaoIA {
  id_log: number;
  id_predio?: string | null;
  origem: string;
  tipo_documento?: string | null;
  entidade?: string | null;
  referencia?: string | null;
  valor?: number | null;
  id_movimento?: string | null;
  criado_em: string;
}

// ============================================================================
// MODELOS DE EMAIL (só os ligados a envios reais lêem isto — ver
// server/lib/emailTemplates.js, TEMPLATES_LIGADOS_A_ENVIOS_REAIS)
// ============================================================================

export interface EmailTemplateOverride {
  id_predio: string;
  template_id: string;
  subject: string;
  body: string;
}

export async function fetchEmailTemplateOverrides(idPredio: string): Promise<EmailTemplateOverride[]> {
  if (!isSupabaseConfigured() || !idPredio) return [];
  const data = await dbSelect("email_templates", { filtros: [["id_predio", "eq", idPredio]] });
  return (data || []) as EmailTemplateOverride[];
}

export async function saveEmailTemplateOverride(idPredio: string, templateId: string, subject: string, body: string): Promise<boolean> {
  return dbUpsert(
    "email_templates",
    { id_predio: idPredio, template_id: templateId, subject, body, updated_at: new Date().toISOString() },
    { onConflict: "id_predio,template_id" }
  );
}

export async function fetchDecisoesIA(idPredio: string): Promise<DecisaoIA[]> {
  if (!isSupabaseConfigured() || !idPredio) return [];
  const data = await dbSelect("ai_auditoria", {
    filtros: [["id_predio", "eq", idPredio]],
    order: { coluna: "criado_em", asc: false },
    limit: 100
  });
  return (data || []) as DecisaoIA[];
}

// ============================================================================
// GESTÃO DE CHAVES (CLAVICULÁRIO / CHAVEIRO)
// ============================================================================

export async function fetchChavesFromSupabase(idPredio?: string): Promise<ChaveItem[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("gestao_chaves", { filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined });
    if (!data) return null;
    return data.map((row: any) => ({
      id_chave: row.id_chave,
      id_predio: row.id_predio,
      area_nome: row.area_nome || row.local || "",
      local: row.local || row.local_sugerido || row.area_nome || "",
      codigo_chave: row.codigo_chave || "",
      quantidade: row.quantidade !== undefined && row.quantidade !== null ? Number(row.quantidade) : 0,
      no_claviculario: Boolean(row.no_claviculario),
      status: row.status || (row.no_claviculario ? "disponivel" : "entregue"),
      num_chaveiro: row.num_chaveiro || "1",
      local_sugerido: row.local_sugerido || row.local || "",
      observacoes: row.observacoes || "",
      responsavel: row.responsavel || "",
      data_entrega: row.data_entrega || null,
      data_devolucao: row.data_devolucao || null
    }));
  } catch (err) {
    console.warn("[Supabase] Exception fetching chaves:", err);
    return null;
  }
}

export async function saveSingleChaveToSupabase(chave: ChaveItem): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("gestao_chaves", {
    id_chave: chave.id_chave,
    id_predio: chave.id_predio,
    area_nome: chave.area_nome,
    local: chave.local || chave.local_sugerido || chave.area_nome,
    codigo_chave: chave.codigo_chave,
    quantidade: chave.quantidade,
    no_claviculario: chave.no_claviculario,
    status: chave.status || (chave.no_claviculario ? "disponivel" : "entregue"),
    responsavel: chave.responsavel || null,
    data_entrega: chave.data_entrega || null,
    data_devolucao: chave.data_devolucao || null,
    num_chaveiro: chave.num_chaveiro || "1",
    local_sugerido: chave.local_sugerido || chave.local || null,
    observacoes: chave.observacoes || null,
    updated_at: new Date().toISOString()
  });
}

export async function saveChavesToSupabase(chaves: ChaveItem[]): Promise<{ success: boolean; count: number; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, count: 0, error: "Supabase não está configurado." };
  }
  const payload = chaves.map(c => ({
    id_chave: c.id_chave,
    id_predio: c.id_predio,
    area_nome: c.area_nome,
    local: c.local || c.local_sugerido || c.area_nome,
    codigo_chave: c.codigo_chave,
    quantidade: c.quantidade || 1,
    no_claviculario: c.no_claviculario ?? true,
    status: c.status || (c.no_claviculario ? "disponivel" : "entregue"),
    responsavel: c.responsavel || null,
    data_entrega: c.data_entrega || null,
    data_devolucao: c.data_devolucao || null,
    num_chaveiro: c.num_chaveiro || "1",
    local_sugerido: c.local_sugerido || c.local || null,
    observacoes: c.observacoes || null,
    updated_at: new Date().toISOString()
  }));

  const ok = await dbUpsert("gestao_chaves", payload);
  return ok ? { success: true, count: payload.length } : { success: false, count: 0, error: "Falha ao gravar chaves" };
}

export async function deleteChaveFromSupabase(idChave: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbDelete("gestao_chaves", [["id_chave", "eq", idChave]]);
}

// ============================================================================
// SEED INICIAL DE DADOS PARA O SUPABASE
// ============================================================================

export async function seedInitialDataToSupabase(
  initialPredios: Predio[],
  initialFracoes: Fracao[],
  initialContas: Conta[],
  initialFornecedores: Fornecedor[],
  initialAvisos: Aviso[],
  initialMovements: Movimento[],
  initialReunioes: Reuniao[],
  initialDocumentos: Documento[],
  initialOcorrencias: Ocorrencia[]
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: "Supabase não está configurado com chaves válidas no .env" };
  }

  try {
    // 1. Predios
    for (const p of initialPredios) {
      await savePredioToSupabase(p);
    }
    // 2. Fracoes
    for (const f of initialFracoes) {
      await saveFracaoToSupabase(f);
    }
    // 3. Movimentos
    for (const m of initialMovements) {
      await saveMovimentoToSupabase(m);
    }

    return { success: true, message: "Dados iniciais sincronizados com sucesso no Supabase!" };
  } catch (err: any) {
    return { success: false, message: `Erro ao sincronizar: ${err?.message || err}` };
  }
}

// ============================================================================
// SEGUROS DE FRAÇÕES (seguros_fracoes)
// ============================================================================

export async function fetchSegurosFracoesFromSupabase(fracaoIds?: string[]): Promise<SeguroFracao[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("seguros_fracoes", { filtros: fracaoIds && fracaoIds.length > 0 ? [["fracao_id", "in", fracaoIds]] : undefined });
    if (!data) return null;
    return data.map((row: any) => ({
      id: row.id,
      fracao_id: row.fracao_id,
      seguradora: row.seguradora,
      apolice_numero: row.apolice_numero,
      apolice_validade: row.apolice_validade,
      tipo_cobertura: row.tipo_cobertura || "Incêndio e Multirriscos",
      capital_seguro: Number(row.capital_seguro || 0),
      documento_url: row.documento_url || "",
      estado_validacao: row.estado_validacao || "Pendente",
      criado_em: row.criado_em,
      atualizado_em: row.atualizado_em
    }));
  } catch (err) {
    console.warn("[Supabase] Falha ao carregar seguros_fracoes:", err);
    return null;
  }
}

export async function saveSeguroFracaoToSupabase(seguro: SeguroFracao): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase não configurado" };
  const payload = {
    id: seguro.id,
    fracao_id: seguro.fracao_id,
    seguradora: seguro.seguradora,
    apolice_numero: seguro.apolice_numero,
    apolice_validade: seguro.apolice_validade,
    tipo_cobertura: seguro.tipo_cobertura || "Incêndio e Multirriscos",
    capital_seguro: seguro.capital_seguro || 0,
    documento_url: seguro.documento_url || null,
    estado_validacao: seguro.estado_validacao,
    atualizado_em: new Date().toISOString()
  };
  const ok = await dbUpsert("seguros_fracoes", payload);
  return ok ? { success: true } : { success: false, error: "Falha ao gravar seguro de fração" };
}

export async function deleteSeguroFracaoFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbDelete("seguros_fracoes", [["id", "eq", id]]);
}

// ============================================================================
// SEGUROS DE PARTES COMUNS (seguros_partes_comuns)
// ============================================================================

export async function fetchSegurosPartesComunsFromSupabase(condominioId: string): Promise<SeguroPartesComuns[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("seguros_partes_comuns", { filtros: [["condominio_id", "eq", condominioId]] });
    if (!data) return null;
    return data.map((row: any) => ({
      id: row.id,
      condominio_id: row.condominio_id,
      seguradora: row.seguradora,
      apolice_numero: row.apolice_numero,
      apolice_validade: row.apolice_validade,
      tomador_seguro: row.tomador_seguro || "Condomínio do Edifício",
      capital_seguro_edificio: Number(row.capital_seguro_edificio || 0),
      franquia: Number(row.franquia || 0),
      contacto_mediador: row.contacto_mediador || "",
      documento_url: row.documento_url || "",
      estado: row.estado || "Ativo",
      criado_em: row.criado_em,
      atualizado_em: row.atualizado_em
    }));
  } catch (err) {
    console.warn("[Supabase] Falha ao carregar seguros_partes_comuns:", err);
    return null;
  }
}

export async function saveSeguroPartesComunsToSupabase(seguro: SeguroPartesComuns): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase não configurado" };
  const payload = {
    id: seguro.id,
    condominio_id: seguro.condominio_id,
    seguradora: seguro.seguradora,
    apolice_numero: seguro.apolice_numero,
    apolice_validade: seguro.apolice_validade,
    tomador_seguro: seguro.tomador_seguro,
    capital_seguro_edificio: seguro.capital_seguro_edificio || 0,
    franquia: seguro.franquia || 0,
    contacto_mediador: seguro.contacto_mediador,
    documento_url: seguro.documento_url || null,
    estado: seguro.estado,
    atualizado_em: new Date().toISOString()
  };
  const ok = await dbUpsert("seguros_partes_comuns", payload);
  return ok ? { success: true } : { success: false, error: "Falha ao gravar seguro de partes comuns" };
}

export async function deleteSeguroPartesComunsFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbDelete("seguros_partes_comuns", [["id", "eq", id]]);
}

// ============================================================================
// GESTÃO DE SINISTROS (sinistros)
// ============================================================================

export async function fetchSinistrosFromSupabase(idPredio: string): Promise<SinistroSeguro[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("sinistros", { filtros: [["id_predio", "eq", idPredio]] });
    if (!data) return null;
    return data.map((row: any) => ({
      id_sinistro: row.id_sinistro || row.id,
      id_predio: row.id_predio,
      id_fracao: row.id_fracao,
      fracao_nome: row.fracao_nome,
      tipo_sinistro: row.tipo_sinistro,
      data_ocorrencia: row.data_ocorrencia,
      data_participacao: row.data_participacao,
      seguradora: row.seguradora,
      num_apolice: row.num_apolice,
      num_processo_sinistro: row.num_processo_sinistro,
      perito_nome: row.perito_nome,
      perito_contacto: row.perito_contacto,
      data_peritagem: row.data_peritagem,
      descricao_danos: row.descricao_danos,
      valor_estimado_danos: Number(row.valor_estimado_danos || 0),
      valor_indemnizacao_aprovado: row.valor_indemnizacao_aprovado ? Number(row.valor_indemnizacao_aprovado) : undefined,
      franquia_aplicavel: row.franquia_aplicavel ? Number(row.franquia_aplicavel) : undefined,
      estado: row.estado,
      fotos: row.fotos || [],
      relatorios_pdf: row.relatorios_pdf || [],
      observacoes: row.observacoes
    }));
  } catch (err) {
    console.warn("[Supabase] Falha ao carregar sinistros:", err);
    return null;
  }
}

export async function saveSinistroToSupabase(sinistro: SinistroSeguro): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase não configurado" };
  const payload = {
    id_sinistro: sinistro.id_sinistro,
    id_predio: sinistro.id_predio,
    id_fracao: sinistro.id_fracao || null,
    fracao_nome: sinistro.fracao_nome || null,
    tipo_sinistro: sinistro.tipo_sinistro,
    data_ocorrencia: sinistro.data_ocorrencia,
    data_participacao: sinistro.data_participacao,
    seguradora: sinistro.seguradora,
    num_apolice: sinistro.num_apolice,
    num_processo_sinistro: sinistro.num_processo_sinistro,
    perito_nome: sinistro.perito_nome || null,
    perito_contacto: sinistro.perito_contacto || null,
    data_peritagem: sinistro.data_peritagem || null,
    descricao_danos: sinistro.descricao_danos,
    valor_estimado_danos: sinistro.valor_estimado_danos,
    valor_indemnizacao_aprovado: sinistro.valor_indemnizacao_aprovado || null,
    franquia_aplicavel: sinistro.franquia_aplicavel || null,
    estado: sinistro.estado,
    fotos: sinistro.fotos || [],
    relatorios_pdf: sinistro.relatorios_pdf || [],
    observacoes: sinistro.observacoes || null
  };
  const ok = await dbUpsert("sinistros", payload);
  return ok ? { success: true } : { success: false, error: "Falha ao gravar sinistro" };
}

export async function deleteSinistroFromSupabase(idSinistro: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbDelete("sinistros", [["id_sinistro", "eq", idSinistro]]);
}

// ============================================================================
// GESTÃO DE FORNECEDORES & CONTRATOS
// ============================================================================
export async function saveFornecedorToSupabase(forn: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("fornecedores", {
    id_fornecedor: forn.id_fornecedor,
    id_predio: forn.id_predio,
    nome: forn.nome,
    nif: forn.nif,
    iban: forn.iban || null,
    categoria: forn.categoria,
    morada: forn.morada || null,
    contacto: forn.contacto || null,
    pessoa_contacto: forn.pessoa_contacto || null,
    telemovel_direto: forn.telemovel_direto || null,
    email_contacto: forn.email_contacto || null,
    data_nascimento: forn.data_nascimento || null,
    perfis_pwa: forn.perfis_pwa || null,
    pwa_acesso_enviado: forn.pwa_acesso_enviado || false,
    pwa_password_provisoria: forn.pwa_password_provisoria || null,
    referencias_contrato: forn.referencias_contrato || null
  });
}

export async function deleteFornecedorFromSupabase(idFornecedor: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbDelete("fornecedores", [["id_fornecedor", "eq", idFornecedor]]);
}

// A tabela real "contratos" usa titulo/valor_anual_mensal/tipo_contrato/
// data_inicio/estado — nomes diferentes dos que este upsert enviava
// (servico/custo_anual/etc.), e nunca enviava tipo_contrato/data_inicio/
// estado (NOT NULL na tabela), pelo que o upsert falhava sempre em
// silêncio. sla_resposta/penalizacao_atraso/indexacao_preco/
// historico_renovacoes/custo_mensal/documento_nome são colunas reais
// acrescentadas à tabela por não existirem no schema original.
export async function saveContratoToSupabase(contrato: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("contratos", {
    id_contrato: contrato.id_contrato,
    id_predio: contrato.id_predio,
    id_fornecedor: contrato.id_fornecedor,
    tipo_contrato: contrato.tipo_contrato,
    titulo: contrato.servico,
    data_inicio: contrato.data_inicio,
    data_fim: contrato.data_fim,
    valor_anual_mensal: contrato.custo_anual,
    custo_mensal: contrato.custo_mensal,
    renovacao_automatica: contrato.renovacao_automatica,
    estado: contrato.estado || "Ativo",
    alerta_renovacao: contrato.alerta_renovacao,
    alerta_dias_antecedencia: contrato.alerta_dias_antecedencia ?? 60,
    alerta_enviado_em: contrato.alerta_enviado_em || null,
    sla_resposta: contrato.sla_resposta || null,
    penalizacao_atraso: contrato.penalizacao_atraso || null,
    indexacao_preco: contrato.indexacao_preco || null,
    historico_renovacoes: contrato.historico_renovacoes || [],
    documento_nome: contrato.documento_nome || null,
    documento_base64: contrato.documento_base64 || null,
    rescisao: contrato.rescisao || null
  });
}

export async function fetchContratosFromSupabase(idPredio?: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  const data = await dbSelect("contratos", { filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined });
  if (!data) return [];
  return data.map((row: any) => ({
    id_contrato: row.id_contrato,
    id_predio: row.id_predio,
    id_fornecedor: row.id_fornecedor,
    tipo_contrato: row.tipo_contrato,
    servico: row.titulo,
    data_inicio: row.data_inicio,
    data_fim: row.data_fim,
    custo_anual: Number(row.valor_anual_mensal) || 0,
    custo_mensal: Number(row.custo_mensal) || 0,
    renovacao_automatica: Boolean(row.renovacao_automatica),
    estado: row.estado,
    alerta_renovacao: row.alerta_renovacao ?? true,
    alerta_dias_antecedencia: Number(row.alerta_dias_antecedencia) || 60,
    alerta_enviado_em: row.alerta_enviado_em || undefined,
    sla_resposta: row.sla_resposta || undefined,
    penalizacao_atraso: row.penalizacao_atraso || undefined,
    indexacao_preco: row.indexacao_preco || undefined,
    historico_renovacoes: row.historico_renovacoes || [],
    documento_nome: row.documento_nome || undefined,
    documento_base64: row.documento_base64 || undefined,
    rescisao: row.rescisao || undefined
  }));
}

export async function deleteContratoFromSupabase(idContrato: string): Promise<boolean> {
  return dbDelete("contratos", [["id_contrato", "eq", idContrato]]);
}

// ============================================================================
// GESTÃO DE REUNIÕES & ASSEMBLEIAS
// ============================================================================
/**
 * Corrigido: mapeava para colunas que não existem na tabela real
 * ("local", "ata_conteudo", "tipo") — todas as gravações falhavam
 * sempre em silêncio. Além disso, nunca havia nenhum fetch* correspondente,
 * por isso o módulo de Reuniões/Assembleias nunca chegou sequer a tentar
 * ler do Supabase.
 */
export async function fetchReunioesFromSupabase(idPredio?: string): Promise<Reuniao[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("reunioes", { filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined });
    if (!data || data.length === 0) return null;

    return data.map((row: any) => ({
      id_reuniao: row.id_reuniao,
      id_predio: row.id_predio,
      data: row.data,
      hora: row.hora,
      local_reuniao: row.local_reuniao || undefined,
      tema: row.tema,
      ordens_trabalho: row.ordens_trabalho,
      estado: row.estado || "Agendada",
      isVideoconferencia: row.is_videoconferencia ?? undefined,
      linkVideoconferencia: row.link_videoconferencia || undefined,
      plataformaVideoconferencia: row.plataforma_videoconferencia || undefined,
      ata: row.ata || undefined,
      notas_ata: row.notas_ata || undefined,
      folha_presencas: row.folha_presencas || undefined,
      representantes: row.representantes || undefined,
      assinaturas: row.assinaturas || undefined
    }));
  } catch (err) {
    return null;
  }
}

export async function saveReuniaoToSupabase(reuniao: Reuniao): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("reunioes", {
    id_reuniao: reuniao.id_reuniao,
    id_predio: reuniao.id_predio,
    tema: reuniao.tema,
    data: reuniao.data,
    hora: reuniao.hora,
    ordens_trabalho: reuniao.ordens_trabalho,
    local_reuniao: reuniao.local_reuniao || null,
    estado: reuniao.estado || "Agendada",
    is_videoconferencia: reuniao.isVideoconferencia ?? false,
    link_videoconferencia: reuniao.linkVideoconferencia || null,
    plataforma_videoconferencia: reuniao.plataformaVideoconferencia || null,
    ata: reuniao.ata || null,
    notas_ata: reuniao.notas_ata || null,
    folha_presencas: reuniao.folha_presencas || {},
    representantes: reuniao.representantes || {},
    assinaturas: reuniao.assinaturas || []
  });
}

export async function deleteReuniaoFromSupabase(idReuniao: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbDelete("reunioes", [["id_reuniao", "eq", idReuniao]]);
}

// ============================================================================
// PONTOS DE VOTAÇÃO EM ASSEMBLEIA (Votação Virtual)
// ============================================================================
export async function fetchPontosVotacaoFromSupabase(idReuniao: string): Promise<PontoVotacaoAssembleia[] | null> {
  if (!isSupabaseConfigured() || !idReuniao) return null;
  try {
    const data = await dbSelect("pontos_votacao", { filtros: [["id_reuniao", "eq", idReuniao]], order: { coluna: "ordem", asc: true } });
    if (!data || data.length === 0) return null;

    return data.map((row: any) => ({
      id_ponto: row.id_ponto,
      id_reuniao: row.id_reuniao,
      ordem: row.ordem,
      titulo: row.titulo,
      descricao: row.descricao,
      tipo_maioria: row.tipo_maioria,
      estado: row.estado,
      votos: row.votos_fracoes?.votos || [],
      total_favor_permilagem: row.resultado_apurado?.favor,
      total_contra_permilagem: row.resultado_apurado?.contra,
      total_abstencao_permilagem: row.resultado_apurado?.abstencao,
      aprovado: row.resultado_apurado?.aprovado,
      deliberacao_texto: row.resultado_apurado?.deliberacao_texto
    }));
  } catch (err) {
    return null;
  }
}

export async function savePontoVotacaoToSupabase(ponto: PontoVotacaoAssembleia): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("pontos_votacao", {
    id_ponto: ponto.id_ponto,
    id_reuniao: ponto.id_reuniao,
    ordem: ponto.ordem || 1,
    titulo: ponto.titulo,
    descricao: ponto.descricao || "",
    tipo_maioria: ponto.tipo_maioria || "MAIORIA_SIMPLES",
    estado: ponto.estado || "ABERTA",
    votos_fracoes: { votos: ponto.votos || [] },
    resultado_apurado: {
      favor: ponto.total_favor_permilagem ?? 0,
      contra: ponto.total_contra_permilagem ?? 0,
      abstencao: ponto.total_abstencao_permilagem ?? 0,
      aprovado: ponto.aprovado ?? false,
      deliberacao_texto: ponto.deliberacao_texto || null
    }
  });
}

// ============================================================================
// GESTÃO DE OCORRÊNCIAS
// ============================================================================
/**
 * Corrigido: a versão anterior usava colunas (id_ocorrencia, titulo,
 * gravidade, data_abertura) que não existem nem na tabela real do Supabase
 * nem no tipo Ocorrencia do frontend — todas as gravações falhavam sempre
 * em silêncio (o chamador nunca verifica o booleano devolvido).
 */
export async function saveOcorrenciaToSupabase(ocorrencia: Ocorrencia): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("ocorrencias", {
    id_ocorr: ocorrencia.id_ocorr,
    id_predio: ocorrencia.id_predio,
    id_fracao: ocorrencia.id_fracao || null,
    descricao: ocorrencia.descricao,
    data: ocorrencia.data,
    estado: ocorrencia.estado || "Pendente",
    medidas_tomadas: ocorrencia.medidas_tomadas || null,
    fotos: ocorrencia.fotos || [],
    categoria: ocorrencia.categoria || null,
    tecnico_atribuido: ocorrencia.tecnico_atribuido || null
  });
}

export async function fetchOcorrenciasFromSupabase(idPredio?: string): Promise<Ocorrencia[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("ocorrencias", { filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined });
    if (!data || data.length === 0) return null;

    return data.map((row: any) => ({
      id_ocorr: row.id_ocorr,
      id_predio: row.id_predio,
      id_fracao: row.id_fracao || "",
      descricao: row.descricao || "",
      data: row.data || "",
      estado: row.estado || "Pendente",
      medidas_tomadas: row.medidas_tomadas || "",
      fotos: row.fotos || [],
      categoria: row.categoria || undefined,
      tecnico_atribuido: row.tecnico_atribuido || undefined
    }));
  } catch (err) {
    return null;
  }
}

// ============================================================================
// CONFIGURAÇÃO DE QUOTAS & AVISOS
// ============================================================================
export async function saveConfiguracaoQuotasToSupabase(config: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("configuracao_quotas_predio", {
    id_predio: config.id_predio,
    ano_exercicio: config.ano_exercicio || new Date().getFullYear(),
    orcamento_regular: config.orcamento_regular || 0,
    data_limite_regular: config.data_limite_regular || null,
    id_conta_ordinaria: config.id_conta_ordinaria || null,
    orcamento_extra: config.orcamento_extra || 0,
    num_prestacoes_extra: config.num_prestacoes_extra || 1,
    descricao_extra: config.descricao_extra || null,
    data_limite_extra: config.data_limite_extra || null,
    id_conta_extraordinaria: config.id_conta_extraordinaria || null
  });
}

export async function fetchAvisosFromSupabase(idPredio?: string): Promise<Aviso[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("avisos", { filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined });
    if (!data || data.length === 0) return null;

    return data.map((row: any) => ({
      id_aviso: row.id_aviso,
      id_predio: row.id_predio,
      id_fracao: row.id_fracao,
      tipo: row.tipo,
      data: row.data,
      vencimento: row.vencimento,
      descricao: row.descricao,
      valor: Number(row.valor),
      estado: row.estado || "Pendente",
      id_movimento: row.id_movimento || undefined,
      id_conta: row.id_conta || undefined,
      valor_fundo_reserva: row.valor_fundo_reserva !== null && row.valor_fundo_reserva !== undefined ? Number(row.valor_fundo_reserva) : undefined,
      proprietario_nome: row.proprietario_nome || undefined,
      proprietario_nif: row.proprietario_nif || undefined
    }));
  } catch (err) {
    return null;
  }
}

export async function saveAvisosToSupabase(novosAvisos: any[]): Promise<boolean> {
  if (!isSupabaseConfigured() || !novosAvisos.length) return false;
  const payload = novosAvisos.map(a => ({
    id_aviso: a.id_aviso,
    id_predio: a.id_predio,
    id_fracao: a.id_fracao,
    tipo: a.tipo,
    data: a.data,
    vencimento: a.vencimento,
    descricao: a.descricao,
    valor: a.valor,
    estado: a.estado || "Pendente",
    id_movimento: a.id_movimento || null,
    id_conta: a.id_conta || null,
    valor_fundo_reserva: a.valor_fundo_reserva ?? null,
    proprietario_nome: a.proprietario_nome || null,
    proprietario_nif: a.proprietario_nif || null
  }));
  return dbUpsert("avisos", payload);
}

// ============================================================================
// DOCUMENTOS (ARQUIVO DIGITAL)
// ============================================================================
export async function fetchDocumentosFromSupabase(idPredio?: string): Promise<Documento[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("documentos", { filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined });
    if (!data || data.length === 0) return null;

    return data.map((row: any) => ({
      id_doc: row.id_doc,
      id_predio: row.id_predio,
      nome: row.nome,
      tipo: row.tipo,
      data_upload: row.data_upload || row.created_at,
      tamanho: row.tamanho || "",
      categoria: row.categoria || undefined,
      descricao: row.descricao || undefined,
      visibilidade: row.visibilidade || undefined,
      autor: row.autor || undefined,
      tema: row.tema || undefined,
      ano: row.ano != null ? String(row.ano) : undefined,
      url_foto: row.url_foto || undefined,
      relevancia_perfis: row.relevancia_perfis || undefined,
      caminho: row.caminho || undefined,
      sub_pasta: row.sub_pasta || undefined,
      fornecedor: row.fornecedor || undefined,
      arquivado: row.arquivado ?? undefined,
      data_arquivamento: row.data_arquivamento || undefined,
      versao_atual: row.versao_atual != null ? Number(row.versao_atual) : 1,
      versoes: row.versoes || []
    }));
  } catch (err) {
    return null;
  }
}

export async function saveDocumentoToSupabase(doc: Documento): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbInsert("documentos", {
    id_doc: doc.id_doc,
    id_predio: doc.id_predio,
    nome: doc.nome,
    tipo: doc.tipo,
    data_upload: doc.data_upload,
    tamanho: doc.tamanho || null,
    categoria: doc.categoria || null,
    descricao: doc.descricao || null,
    visibilidade: doc.visibilidade || null,
    autor: doc.autor || null,
    tema: doc.tema || null,
    ano: doc.ano || null,
    url_foto: doc.url_foto || null,
    relevancia_perfis: doc.relevancia_perfis || null,
    caminho: doc.caminho || null,
    sub_pasta: doc.sub_pasta || null,
    fornecedor: doc.fornecedor || null,
    arquivado: doc.arquivado ?? null,
    data_arquivamento: doc.data_arquivamento || null,
    versao_atual: doc.versao_atual || 1,
    versoes: doc.versoes || []
  });
}

export async function updateDocumentoMetadataToSupabase(doc: Documento): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpdate("documentos", {
    nome: doc.nome,
    descricao: doc.descricao || null,
    autor: doc.autor || null,
    categoria: doc.categoria || null,
    visibilidade: doc.visibilidade || null,
    ano: doc.ano || null,
    tema: doc.tema || null,
    sub_pasta: doc.sub_pasta || null,
    fornecedor: doc.fornecedor || null,
    arquivado: doc.arquivado ?? null,
    data_arquivamento: doc.data_arquivamento || null,
    versao_atual: doc.versao_atual || 1,
    versoes: doc.versoes || []
  }, [["id_doc", "eq", doc.id_doc]]);
}

export async function deleteDocumentoFromSupabase(idDoc: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbDelete("documentos", [["id_doc", "eq", idDoc]]);
}

// ============================================================================
// RESERVAS DE ESPAÇOS COMUNS
// ============================================================================
export async function fetchReservasFromSupabase(idPredio?: string): Promise<Reserva[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("reservas", { filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined });
    if (!data || data.length === 0) return null;

    return data.map((row: any) => ({
      id_reserva: row.id_reserva,
      id_predio: row.id_predio,
      id_fracao: row.id_fracao || "",
      area_comum: row.area_comum,
      data: row.data,
      hora_inicio: row.hora_inicio,
      hora_fim: row.hora_fim,
      responsavel: row.responsavel || "",
      num_pessoas: Number(row.num_pessoas) || 0,
      estado: row.estado || "Pendente"
    }));
  } catch (err) {
    return null;
  }
}

export async function saveReservaToSupabase(reserva: Reserva): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("reservas", {
    id_reserva: reserva.id_reserva,
    id_predio: reserva.id_predio,
    id_fracao: reserva.id_fracao || null,
    area_comum: reserva.area_comum,
    data: reserva.data,
    hora_inicio: reserva.hora_inicio,
    hora_fim: reserva.hora_fim,
    responsavel: reserva.responsavel,
    num_pessoas: reserva.num_pessoas,
    estado: reserva.estado || "Pendente"
  });
}

export async function deleteReservaFromSupabase(idReserva: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbDelete("reservas", [["id_reserva", "eq", idReserva]]);
}

// ============================================================================
// CAUÇÕES
// ============================================================================
export async function fetchCaucoesFromSupabase(idPredio?: string): Promise<Caucao[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("caucoes", { filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined });
    if (!data || data.length === 0) return null;

    return data.map((row: any) => ({
      id_caucao: row.id_caucao,
      id_predio: row.id_predio,
      id_fracao: row.id_fracao,
      fracao_nome: row.fracao_nome,
      titular: row.titular,
      finalidade: row.finalidade,
      valor: Number(row.valor) || 0,
      data_deposito: row.data_deposito,
      metodo_pagamento: row.metodo_pagamento,
      comprovativo_ref: row.comprovativo_ref || undefined,
      estado: row.estado,
      data_resolucao: row.data_resolucao || undefined,
      comprovativo_devolucao: row.comprovativo_devolucao || undefined,
      justificacao_retencao: row.justificacao_retencao || undefined,
      valor_retido: row.valor_retido != null ? Number(row.valor_retido) : undefined,
      valor_devolvido: row.valor_devolvido != null ? Number(row.valor_devolvido) : undefined
    }));
  } catch (err) {
    return null;
  }
}

export async function saveCaucaoToSupabase(caucao: Caucao): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("caucoes", {
    id_caucao: caucao.id_caucao,
    id_predio: caucao.id_predio,
    id_fracao: caucao.id_fracao,
    fracao_nome: caucao.fracao_nome,
    titular: caucao.titular,
    finalidade: caucao.finalidade,
    valor: caucao.valor,
    data_deposito: caucao.data_deposito,
    metodo_pagamento: caucao.metodo_pagamento,
    comprovativo_ref: caucao.comprovativo_ref || null,
    estado: caucao.estado,
    data_resolucao: caucao.data_resolucao || null,
    comprovativo_devolucao: caucao.comprovativo_devolucao || null,
    justificacao_retencao: caucao.justificacao_retencao || null,
    valor_retido: caucao.valor_retido ?? null,
    valor_devolvido: caucao.valor_devolvido ?? null
  });
}

// ============================================================================
// FORNECEDORES
// ============================================================================
export async function fetchFornecedoresFromSupabase(idPredio?: string): Promise<Fornecedor[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("fornecedores", { filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined });
    if (!data || data.length === 0) return null;

    return data.map((row: any) => ({
      id_fornecedor: row.id_fornecedor,
      id_predio: row.id_predio || idPredio || "",
      nome: row.nome,
      nif: row.nif || "",
      iban: row.iban || undefined,
      categoria: row.categoria || "",
      morada: row.morada || undefined,
      contacto: row.contacto || undefined,
      pessoa_contacto: row.pessoa_contacto || undefined,
      telemovel_direto: row.telemovel_direto || undefined,
      email_contacto: row.email_contacto || row.email || undefined,
      data_nascimento: row.data_nascimento || undefined,
      perfis_pwa: row.perfis_pwa || undefined,
      pwa_acesso_enviado: row.pwa_acesso_enviado || false,
      pwa_password_provisoria: row.pwa_password_provisoria || undefined,
      foto: row.foto || null,
      referencias_contrato: row.referencias_contrato || undefined
    }));
  } catch (err) {
    return null;
  }
}

// ============================================================================
// DÍVIDAS A FORNECEDORES (PASSIVO — faturas recebidas ainda não pagas)
// ============================================================================
export async function fetchDividasFornecedoresFromSupabase(idPredio?: string): Promise<DividaFornecedor[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("dividas_fornecedores", {
      filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined,
      order: { coluna: "created_at", asc: false }
    });
    if (!data) return null;

    return data.map((row: any) => ({
      id_divida: row.id_divida,
      id_predio: row.id_predio,
      id_fornecedor: row.id_fornecedor || undefined,
      fornecedor_nome: row.fornecedor_nome,
      descricao: row.descricao,
      categoria: row.categoria || undefined,
      valor: Number(row.valor) || 0,
      data_emissao: row.data_emissao || undefined,
      data_vencimento: row.data_vencimento || undefined,
      estado: row.estado === "Paga" ? "Paga" : row.estado === "Paga Parcialmente" ? "Paga Parcialmente" : "Pendente",
      valor_pago: Number(row.valor_pago) || 0,
      data_pagamento: row.data_pagamento || undefined,
      id_conta_pagamento: row.id_conta_pagamento || undefined,
      id_movimento_pagamento: row.id_movimento_pagamento || undefined,
      documento_anexo: row.documento_anexo || undefined
    }));
  } catch (err) {
    return null;
  }
}

export async function saveDividaFornecedorToSupabase(divida: DividaFornecedor): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("dividas_fornecedores", {
    id_divida: divida.id_divida,
    id_predio: divida.id_predio,
    id_fornecedor: divida.id_fornecedor || null,
    fornecedor_nome: divida.fornecedor_nome,
    descricao: divida.descricao,
    categoria: divida.categoria || null,
    valor: divida.valor,
    data_emissao: divida.data_emissao || null,
    data_vencimento: divida.data_vencimento || null,
    estado: divida.estado,
    valor_pago: divida.valor_pago || 0,
    data_pagamento: divida.data_pagamento || null,
    id_conta_pagamento: divida.id_conta_pagamento || null,
    id_movimento_pagamento: divida.id_movimento_pagamento || null,
    documento_anexo: divida.documento_anexo || null
  });
}

export async function deleteDividaFornecedorFromSupabase(idDivida: string): Promise<boolean> {
  return dbDelete("dividas_fornecedores", [["id_divida", "eq", idDivida]]);
}

// ============================================================================
// PAGAMENTOS EM TRANCHE DE DÍVIDAS A FORNECEDORES
// ============================================================================
export async function fetchPagamentosDividasFromSupabase(idPredio?: string): Promise<PagamentoDivida[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("pagamentos_dividas_fornecedores", {
      filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined,
      order: { coluna: "created_at", asc: false }
    });
    if (!data) return null;

    return data.map((row: any) => ({
      id_pagamento: row.id_pagamento,
      id_divida: row.id_divida,
      id_predio: row.id_predio,
      id_fornecedor: row.id_fornecedor || undefined,
      valor: Number(row.valor) || 0,
      data: row.data,
      id_conta: row.id_conta,
      id_movimento: row.id_movimento || undefined,
      observacoes: row.observacoes || undefined
    }));
  } catch (err) {
    return null;
  }
}

export async function savePagamentoDividaToSupabase(pagamento: PagamentoDivida): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("pagamentos_dividas_fornecedores", {
    id_pagamento: pagamento.id_pagamento,
    id_divida: pagamento.id_divida,
    id_predio: pagamento.id_predio,
    id_fornecedor: pagamento.id_fornecedor || null,
    valor: pagamento.valor,
    data: pagamento.data,
    id_conta: pagamento.id_conta,
    id_movimento: pagamento.id_movimento || null,
    observacoes: pagamento.observacoes || null
  });
}

export async function deletePagamentoDividaFromSupabase(idPagamento: string): Promise<boolean> {
  return dbDelete("pagamentos_dividas_fornecedores", [["id_pagamento", "eq", idPagamento]]);
}

// ============================================================================
// REVISÕES/ADENDAS AO ORÇAMENTO ANUAL
// ============================================================================
export async function fetchRevisoesOrcamentoFromSupabase(idPredio?: string): Promise<RevisaoOrcamento[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("revisoes_orcamento", {
      filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined,
      order: { coluna: "data_vigencia", asc: false }
    });
    if (!data) return null;
    return data.map((row: any) => ({
      id_revisao: row.id_revisao,
      id_predio: row.id_predio,
      valor: Number(row.valor) || 0,
      data_vigencia: row.data_vigencia,
      aprovado_em_assembleia: Boolean(row.aprovado_em_assembleia),
      motivo: row.motivo || undefined,
      created_at: row.created_at || undefined
    }));
  } catch (err) {
    return null;
  }
}

export async function saveRevisaoOrcamentoToSupabase(revisao: RevisaoOrcamento): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("revisoes_orcamento", {
    id_revisao: revisao.id_revisao,
    id_predio: revisao.id_predio,
    valor: revisao.valor,
    data_vigencia: revisao.data_vigencia,
    aprovado_em_assembleia: revisao.aprovado_em_assembleia,
    motivo: revisao.motivo || null
  });
}

export async function deleteRevisaoOrcamentoFromSupabase(idRevisao: string): Promise<boolean> {
  return dbDelete("revisoes_orcamento", [["id_revisao", "eq", idRevisao]]);
}

/** Devolve o valor da revisão mais recente cuja data_vigencia já passou (ou hoje). */
export function orcamentoVigente(revisoes: RevisaoOrcamento[], dataRef: Date = new Date()): RevisaoOrcamento | null {
  const hojeISO = dataRef.toISOString().split("T")[0];
  const vigentes = revisoes.filter(r => r.data_vigencia <= hojeISO).sort((a, b) => b.data_vigencia.localeCompare(a.data_vigencia));
  return vigentes[0] || null;
}

// ============================================================================
// PROCESSOS JURÍDICOS / CONTENCIOSO
// ============================================================================
export async function fetchProcessosJuridicosFromSupabase(idPredio?: string): Promise<ProcessoJuridico[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("processos_juridicos", { filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined });
    if (!data || data.length === 0) return null;

    return data.map((row: any) => ({
      id_processo: row.id_processo,
      id_predio: row.id_predio,
      id_fracao: row.id_fracao || "",
      fracao_nome: row.fracao_nome || row.id_fracao || "",
      nome_reu: row.nome_reu || "",
      nif_reu: row.nif_reu || "",
      tipo_processo: row.tipo_processo,
      titulo_processo: row.titulo_processo || "",
      descricao_resumo: row.descricao_resumo || "",
      valor_divida_capital: Number(row.valor_divida_capital) || 0,
      valor_juros_mora: Number(row.valor_juros_mora) || 0,
      taxa_juros: Number(row.taxa_juros) || 0,
      custas_processuais_estimadas: Number(row.custas_processuais_estimadas) || 0,
      valor_total_pedido: Number(row.valor_total_pedido) || 0,
      tribunal_competente: row.tribunal_competente || "",
      fase_processual: row.fase_processual,
      data_abertura: row.data_abertura || "",
      data_ultima_atualizacao: row.updated_at ? String(row.updated_at).split("T")[0] : row.data_abertura || "",
      mandatario_responsavel: row.mandatario_responsavel || "",
      provas: row.provas || [],
      historico_tramitacao: row.historico_tramitacao || [],
      pasta_arquivo_digital_nome: row.pasta_arquivo_digital_nome || undefined
    }));
  } catch (err) {
    return null;
  }
}

export async function saveProcessoJuridicoToSupabase(processo: ProcessoJuridico): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("processos_juridicos", {
    id_processo: processo.id_processo,
    id_predio: processo.id_predio,
    id_fracao: processo.id_fracao,
    nome_reu: processo.nome_reu,
    nif_reu: processo.nif_reu,
    tipo_processo: processo.tipo_processo,
    titulo_processo: processo.titulo_processo,
    descricao_resumo: processo.descricao_resumo,
    valor_divida_capital: processo.valor_divida_capital,
    valor_juros_mora: processo.valor_juros_mora,
    taxa_juros: processo.taxa_juros,
    custas_processuais_estimadas: processo.custas_processuais_estimadas,
    valor_total_pedido: processo.valor_total_pedido,
    tribunal_competente: processo.tribunal_competente,
    fase_processual: processo.fase_processual,
    data_abertura: processo.data_abertura,
    mandatario_responsavel: processo.mandatario_responsavel,
    historico_tramitacao: processo.historico_tramitacao,
    provas: processo.provas
  });
}

export async function deleteProcessoJuridicoFromSupabase(idProcesso: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbDelete("processos_juridicos", [["id_processo", "eq", idProcesso]]);
}

// ============================================================================
// MÓDULO DE MENSAGENS & COMUNICAÇÃO (comunicados, chat, sondagens, questionários)
// ============================================================================

export async function fetchComunicadosFromSupabase(idPredio?: string): Promise<Comunicado[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("comunicados", { filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined, order: { coluna: "created_at", asc: false } });
    if (!data) return null;
    return data.map((row: any) => ({
      id_comunicado: row.id_comunicado,
      id_predio: row.id_predio,
      titulo: row.titulo,
      mensagem: row.mensagem,
      urgencia: row.urgencia || "normal",
      autor_nome: row.autor_nome || undefined,
      total_destinatarios: row.total_destinatarios || 0,
      total_enviados: row.total_enviados || 0,
      created_at: row.created_at
    }));
  } catch (err) {
    return null;
  }
}

export async function saveComunicadoToSupabase(comunicado: Comunicado): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("comunicados", {
    id_comunicado: comunicado.id_comunicado,
    id_predio: comunicado.id_predio,
    titulo: comunicado.titulo,
    mensagem: comunicado.mensagem,
    urgencia: comunicado.urgencia,
    autor_nome: comunicado.autor_nome || null,
    total_destinatarios: comunicado.total_destinatarios || 0,
    total_enviados: comunicado.total_enviados || 0
  });
}

export async function fetchConversasFromSupabase(idPredio?: string): Promise<ConversaCondomino[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("conversas", { filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined, order: { coluna: "updated_at", asc: false } });
    if (!data) return null;
    return data.map((row: any) => ({
      id_conversa: row.id_conversa,
      id_predio: row.id_predio,
      id_fracao: row.id_fracao,
      proprietario_nome: row.proprietario_nome || undefined,
      assunto: row.assunto || undefined,
      estado: row.estado || "pendente",
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  } catch (err) {
    return null;
  }
}

export async function saveConversaToSupabase(conversa: ConversaCondomino): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("conversas", {
    id_conversa: conversa.id_conversa,
    id_predio: conversa.id_predio,
    id_fracao: conversa.id_fracao,
    proprietario_nome: conversa.proprietario_nome || null,
    assunto: conversa.assunto || null,
    estado: conversa.estado,
    updated_at: new Date().toISOString()
  });
}

export async function fetchMensagensConversaFromSupabase(idConversa: string): Promise<MensagemConversa[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("mensagens_conversa", { filtros: [["id_conversa", "eq", idConversa]], order: { coluna: "created_at", asc: true } });
    if (!data) return null;
    return data.map((row: any) => ({
      id_mensagem: row.id_mensagem,
      id_conversa: row.id_conversa,
      autor: row.autor,
      texto: row.texto,
      created_at: row.created_at
    }));
  } catch (err) {
    return null;
  }
}

export async function saveMensagemConversaToSupabase(mensagem: MensagemConversa): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbInsert("mensagens_conversa", {
    id_mensagem: mensagem.id_mensagem,
    id_conversa: mensagem.id_conversa,
    autor: mensagem.autor,
    texto: mensagem.texto
  });
}

export async function fetchSondagensFromSupabase(idPredio?: string): Promise<Sondagem[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("sondagens", { colunas: "*, sondagens_votos(*)", filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined, order: { coluna: "created_at", asc: false } });
    if (!data) return null;
    return data.map((row: any) => ({
      id_sondagem: row.id_sondagem,
      id_predio: row.id_predio,
      pergunta: row.pergunta,
      opcoes: row.opcoes || [],
      estado: row.estado || "ativa",
      data_fecho: row.data_fecho || undefined,
      created_at: row.created_at,
      votos: (row.sondagens_votos || []).map((v: any) => ({
        id_voto: v.id_voto,
        id_sondagem: v.id_sondagem,
        id_fracao: v.id_fracao,
        opcao_escolhida: v.opcao_escolhida,
        permilagem: v.permilagem || 0,
        created_at: v.created_at
      }))
    }));
  } catch (err) {
    return null;
  }
}

export async function saveSondagemToSupabase(sondagem: Sondagem): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("sondagens", {
    id_sondagem: sondagem.id_sondagem,
    id_predio: sondagem.id_predio,
    pergunta: sondagem.pergunta,
    opcoes: sondagem.opcoes,
    estado: sondagem.estado,
    data_fecho: sondagem.data_fecho || null
  });
}

export async function saveVotoSondagemToSupabase(voto: VotoSondagem): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("sondagens_votos", {
    id_voto: voto.id_voto,
    id_sondagem: voto.id_sondagem,
    id_fracao: voto.id_fracao,
    opcao_escolhida: voto.opcao_escolhida,
    permilagem: voto.permilagem || 0
  }, { onConflict: "id_sondagem,id_fracao" });
}

export async function fetchQuestionariosFromSupabase(idPredio?: string): Promise<Questionario[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const data = await dbSelect("questionarios", { colunas: "*, questionarios_respostas(*)", filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined, order: { coluna: "created_at", asc: false } });
    if (!data) return null;
    return data.map((row: any) => ({
      id_questionario: row.id_questionario,
      id_predio: row.id_predio,
      titulo: row.titulo,
      descricao: row.descricao || undefined,
      estado: row.estado || "ativo",
      created_at: row.created_at,
      respostas: (row.questionarios_respostas || []).map((r: any) => ({
        id_resposta: r.id_resposta,
        id_questionario: r.id_questionario,
        id_fracao: r.id_fracao,
        resposta_texto: r.resposta_texto || undefined,
        classificacao: r.classificacao || undefined,
        created_at: r.created_at
      }))
    }));
  } catch (err) {
    return null;
  }
}

export async function saveQuestionarioToSupabase(questionario: Questionario): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("questionarios", {
    id_questionario: questionario.id_questionario,
    id_predio: questionario.id_predio,
    titulo: questionario.titulo,
    descricao: questionario.descricao || null,
    estado: questionario.estado
  });
}

export async function saveRespostaQuestionarioToSupabase(resposta: RespostaQuestionario): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("questionarios_respostas", {
    id_resposta: resposta.id_resposta,
    id_questionario: resposta.id_questionario,
    id_fracao: resposta.id_fracao,
    resposta_texto: resposta.resposta_texto || null,
    classificacao: resposta.classificacao || null
  }, { onConflict: "id_questionario,id_fracao" });
}

// ============================================================================
// VALIDADOR DE PEDIDOS DO REGULAMENTO INTERNO POR IA (pedidos_regulamento)
// ============================================================================
export async function savePedidoRegulamentoToSupabase(pedido: {
  id_pedido: string;
  id_predio: string;
  texto_pedido: string;
  decisao: string;
  fundamentacao: string;
  recomendacao_ia: string;
}): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbInsert("pedidos_regulamento", pedido);
}

// ============================================================================
// SCIE (SEGURANÇA CONTRA INCÊNDIO), VISTORIAS & LIMPEZAS
// ============================================================================

export interface EquipamentoSCIERow {
  id: string;
  id_predio: string;
  tipo: string;
  localizacao: string;
  quantidade: number;
  especificacao: string;
  dataUltimaRevisao: string;
  dataValidade: string;
  empresaCertificada: string;
  observacoes?: string;
}

export async function fetchEquipamentosScieFromSupabase(idPredio: string): Promise<EquipamentoSCIERow[]> {
  if (!isSupabaseConfigured() || !idPredio) return [];
  const data = await dbSelect("equipamentos_scie", { filtros: [["id_predio", "eq", idPredio]] });
  return (data || []).map((row: any) => ({
    id: row.id_equipamento,
    id_predio: row.id_predio,
    tipo: row.tipo,
    localizacao: row.localizacao,
    quantidade: row.quantidade ?? 1,
    especificacao: row.especificacao || "",
    dataUltimaRevisao: row.data_ultima_revisao || "",
    dataValidade: row.data_validade || "",
    empresaCertificada: row.empresa_certificada || "",
    observacoes: row.observacoes || undefined
  }));
}

export async function saveEquipamentoScieToSupabase(eq: EquipamentoSCIERow): Promise<boolean> {
  return dbUpsert("equipamentos_scie", {
    id_equipamento: eq.id,
    id_predio: eq.id_predio,
    tipo: eq.tipo,
    localizacao: eq.localizacao,
    quantidade: eq.quantidade,
    especificacao: eq.especificacao,
    data_ultima_revisao: eq.dataUltimaRevisao || null,
    data_validade: eq.dataValidade || null,
    empresa_certificada: eq.empresaCertificada,
    observacoes: eq.observacoes || null,
    updated_at: new Date().toISOString()
  }, { onConflict: "id_equipamento" });
}

export async function deleteEquipamentoScieFromSupabase(id: string): Promise<boolean> {
  return dbDelete("equipamentos_scie", [["id_equipamento", "eq", id]]);
}

export interface VistoriaRow {
  id_vistoria: string;
  id_predio: string;
  data: string;
  tecnico: string;
  local: string;
  anomalia: string;
  gravidade: "Baixa" | "Média" | "Alta";
  fotos: string[];
  estado: "Identificada" | "Em Resolução" | "Resolvida";
  custo_previsto?: number;
  periodicidade?: string;
  impacto_orcamento?: string;
  alerta_automatico?: boolean;
}

export async function fetchVistoriasFromSupabase(idPredio: string): Promise<VistoriaRow[]> {
  if (!isSupabaseConfigured() || !idPredio) return [];
  const data = await dbSelect("vistorias", { filtros: [["id_predio", "eq", idPredio]], order: { coluna: "created_at", asc: false } });
  return (data || []) as VistoriaRow[];
}

export async function saveVistoriaToSupabase(v: VistoriaRow): Promise<boolean> {
  return dbUpsert("vistorias", v, { onConflict: "id_vistoria" });
}

export interface LimpezaRow {
  id_limpeza: string;
  id_predio: string;
  data: string;
  hora: string;
  executor: string;
  areas: string[];
  observacoes?: string;
  fotos?: string[];
}

export async function fetchLimpezasFromSupabase(idPredio: string): Promise<LimpezaRow[]> {
  if (!isSupabaseConfigured() || !idPredio) return [];
  const data = await dbSelect("limpezas", { filtros: [["id_predio", "eq", idPredio]], order: { coluna: "created_at", asc: false } });
  return (data || []) as LimpezaRow[];
}

export async function saveLimpezaToSupabase(l: LimpezaRow): Promise<boolean> {
  return dbInsert("limpezas", l);
}

export interface IncidenciaLimpezaRow {
  id: string;
  id_predio: string;
  data: string;
  hora: string;
  operador?: string;
  local: string;
  descricao: string;
  gravidade: "Baixa" | "Média" | "Alta";
  estado: string;
  foto?: string;
}

export async function fetchIncidenciasLimpezaFromSupabase(idPredio: string): Promise<IncidenciaLimpezaRow[]> {
  if (!isSupabaseConfigured() || !idPredio) return [];
  const data = await dbSelect("incidencias_limpeza", { filtros: [["id_predio", "eq", idPredio]], order: { coluna: "created_at", asc: false } });
  return (data || []) as IncidenciaLimpezaRow[];
}

export async function saveIncidenciaLimpezaToSupabase(inc: IncidenciaLimpezaRow): Promise<boolean> {
  return dbInsert("incidencias_limpeza", inc);
}

// ============================================================================
// NOTIFICAÇÕES PUSH (subscrições reais — ver src/utils/subscribeUser.ts)
// ============================================================================

export async function savePushSubscriptionToSupabase(params: {
  idPredio?: string;
  idFracao?: string;
  userId?: string;
  subscription: PushSubscription;
}): Promise<boolean> {
  const raw = params.subscription.toJSON();
  if (!raw.endpoint) return false;
  return dbUpsert("push_subscriptions", {
    id_predio: params.idPredio || null,
    id_fracao: params.idFracao || null,
    user_id: params.userId || null,
    endpoint: raw.endpoint,
    subscription: raw,
    updated_at: new Date().toISOString()
  }, { onConflict: "endpoint" });
}

export async function deletePushSubscriptionFromSupabase(endpoint: string): Promise<boolean> {
  return dbDelete("push_subscriptions", [["endpoint", "eq", endpoint]]);
}

// ============================================================================
// AGENDA DE VISTORIAS TÉCNICAS (Gestão de Manutenção e Intervenções)
// ============================================================================
export async function fetchAgendaVistoriasFromSupabase(idPredio: string): Promise<AgendaItem[] | null> {
  if (!isSupabaseConfigured() || !idPredio) return null;
  const data = await dbSelect("agenda_vistorias_tecnicas", { filtros: [["id_predio", "eq", idPredio]] });
  if (!data || data.length === 0) return null;
  return data.map((row: any) => ({
    id: row.id,
    equipamento: row.equipamento,
    tipo: row.tipo,
    dataPlaneada: row.data_planeada,
    periodicidade: row.periodicidade,
    estado: row.estado,
    dataVerificacao: row.data_verificacao || undefined,
    tecnico: row.tecnico || undefined,
    relatorio: row.relatorio || undefined,
    avariasEncontradas: row.avarias_encontradas || undefined,
    fotos: row.fotos || [],
    assinatura: row.assinatura || undefined
  }));
}

export async function saveAgendaVistoriaToSupabase(idPredio: string, item: AgendaItem): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("agenda_vistorias_tecnicas", {
    id: item.id,
    id_predio: idPredio,
    equipamento: item.equipamento,
    tipo: item.tipo,
    data_planeada: item.dataPlaneada || null,
    periodicidade: item.periodicidade || null,
    estado: item.estado,
    data_verificacao: item.dataVerificacao || null,
    tecnico: item.tecnico || null,
    relatorio: item.relatorio || null,
    avarias_encontradas: item.avariasEncontradas || null,
    fotos: item.fotos || [],
    assinatura: item.assinatura || null
  });
}

// ============================================================================
// INTERVENÇÕES TÉCNICAS (Gestão de Manutenção e Intervenções)
// ============================================================================
export async function fetchIntervencoesFromSupabase(idPredio: string): Promise<Intervencao[] | null> {
  if (!isSupabaseConfigured() || !idPredio) return null;
  const data = await dbSelect("intervencoes_tecnicas", { filtros: [["id_predio", "eq", idPredio]] });
  if (!data || data.length === 0) return null;
  return data.map((row: any) => ({
    id: row.id,
    descricao: row.descricao,
    id_fracao: row.id_fracao || "common",
    prioridade: row.prioridade,
    fornecedor: row.fornecedor || "",
    custoPrevisto: Number(row.custo_previsto) || 0,
    custoFinal: row.custo_final != null ? Number(row.custo_final) : undefined,
    estado: row.estado,
    relatorioTecnico: row.relatorio_tecnico || undefined,
    dataHoraInicio: row.data_hora_inicio || undefined,
    dataHoraFim: row.data_hora_fim || undefined,
    fotos: row.fotos || [],
    faturaAnexa: row.fatura_anexa || undefined,
    anoExercicio: row.ano_exercicio || "",
    validadoAdmin: Boolean(row.validado_admin),
    id_rfp: row.id_rfp || undefined,
    id_proposta: row.id_proposta || undefined
  }));
}

export async function saveIntervencaoToSupabase(idPredio: string, item: Intervencao): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("intervencoes_tecnicas", {
    id: item.id,
    id_predio: idPredio,
    descricao: item.descricao,
    id_fracao: item.id_fracao || null,
    prioridade: item.prioridade,
    fornecedor: item.fornecedor || null,
    custo_previsto: item.custoPrevisto || 0,
    custo_final: item.custoFinal ?? null,
    estado: item.estado,
    relatorio_tecnico: item.relatorioTecnico || null,
    data_hora_inicio: item.dataHoraInicio || null,
    data_hora_fim: item.dataHoraFim || null,
    fotos: item.fotos || [],
    fatura_anexa: item.faturaAnexa || null,
    ano_exercicio: item.anoExercicio || null,
    validado_admin: Boolean(item.validadoAdmin),
    id_rfp: item.id_rfp || null,
    id_proposta: item.id_proposta || null
  });
}

// ============================================================================
// OBRAS EXTRAORDINÁRIAS (Gestão de Manutenção e Intervenções)
// ============================================================================
export async function fetchObrasExtraFromSupabase(idPredio: string): Promise<ObraExtraordinaria[] | null> {
  if (!isSupabaseConfigured() || !idPredio) return null;
  const data = await dbSelect("obras_extraordinarias", { filtros: [["id_predio", "eq", idPredio]] });
  if (!data || data.length === 0) return null;
  return data.map((row: any) => ({
    id: row.id,
    descricao: row.descricao,
    fornecedorId: row.fornecedor_id || "",
    fornecedorNome: row.fornecedor_nome || "",
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    custoTotal: Number(row.custo_total) || 0,
    necessitaCotaExtra: Boolean(row.necessita_cota_extra),
    mesesFracionamento: Number(row.meses_fracionamento) || 1,
    valoresPorFracao: row.valores_por_fracao || {},
    impactoFundoReserva: Number(row.impacto_fundo_reserva) || 0,
    impactoSaldoAnual: Number(row.impacto_saldo_anual) || 0,
    estado: row.estado,
    orcamentos: row.orcamentos || [],
    documentosArquivados: Boolean(row.documentos_arquivados),
    id_divida: row.id_divida || undefined,
    usaFundoReserva: row.usa_fundo_reserva ?? undefined,
    id_rfp: row.id_rfp || undefined,
    id_proposta: row.id_proposta || undefined
  }));
}

export async function saveObraExtraToSupabase(idPredio: string, item: ObraExtraordinaria): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("obras_extraordinarias", {
    id: item.id,
    id_predio: idPredio,
    descricao: item.descricao,
    fornecedor_id: item.fornecedorId || null,
    fornecedor_nome: item.fornecedorNome || null,
    data_inicio: item.dataInicio || null,
    data_fim: item.dataFim || null,
    custo_total: item.custoTotal || 0,
    necessita_cota_extra: Boolean(item.necessitaCotaExtra),
    meses_fracionamento: item.mesesFracionamento || 1,
    valores_por_fracao: item.valoresPorFracao || {},
    impacto_fundo_reserva: item.impactoFundoReserva || 0,
    impacto_saldo_anual: item.impactoSaldoAnual || 0,
    estado: item.estado,
    orcamentos: item.orcamentos || [],
    documentos_arquivados: Boolean(item.documentosArquivados),
    id_divida: item.id_divida || null,
    usa_fundo_reserva: item.usaFundoReserva ?? null,
    id_rfp: item.id_rfp || null,
    id_proposta: item.id_proposta || null
  });
}

// ============================================================================
// PLANO DE MANUTENÇÃO OBRIGATÓRIA (AgendaManutencao.tsx)
// ============================================================================
export async function fetchPlanoManutencaoFromSupabase(idPredio: string): Promise<ItemPlanoManutencao[] | null> {
  if (!isSupabaseConfigured() || !idPredio) return null;
  const data = await dbSelect("plano_manutencao_obrigatoria", { filtros: [["id_predio", "eq", idPredio]] });
  if (!data || data.length === 0) return null;
  return data.map((row: any) => ({
    id_item: row.id_item,
    id_predio: row.id_predio,
    tipo: row.tipo,
    titulo: row.titulo,
    entidade_responsavel: row.entidade_responsavel || "",
    contacto_entidade: row.contacto_entidade || undefined,
    periodicidade_meses: Number(row.periodicidade_meses) || 12,
    base_legal_dgeg: row.base_legal_dgeg || "",
    ultima_inspecao_data: row.ultima_inspecao_data,
    proxima_inspecao_data: row.proxima_inspecao_data,
    dias_alerta_antecedencia: Number(row.dias_alerta_antecedencia) || 30,
    estado_conformidade: row.estado_conformidade,
    num_certificado_relatorio: row.num_certificado_relatorio || undefined,
    custo_estimado: row.custo_estimado != null ? Number(row.custo_estimado) : undefined,
    historico_vistorias: row.historico_vistorias || []
  }));
}

export async function savePlanoManutencaoItemToSupabase(item: ItemPlanoManutencao): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("plano_manutencao_obrigatoria", {
    id_item: item.id_item,
    id_predio: item.id_predio,
    tipo: item.tipo,
    titulo: item.titulo,
    entidade_responsavel: item.entidade_responsavel || null,
    contacto_entidade: item.contacto_entidade || null,
    periodicidade_meses: item.periodicidade_meses || 12,
    base_legal_dgeg: item.base_legal_dgeg || null,
    ultima_inspecao_data: item.ultima_inspecao_data || null,
    proxima_inspecao_data: item.proxima_inspecao_data || null,
    dias_alerta_antecedencia: item.dias_alerta_antecedencia || 30,
    estado_conformidade: item.estado_conformidade,
    num_certificado_relatorio: item.num_certificado_relatorio || null,
    custo_estimado: item.custo_estimado ?? null,
    historico_vistorias: item.historico_vistorias || []
  });
}

// ============================================================================
// INVENTÁRIO TÉCNICO
// ============================================================================
export async function fetchInventarioTecnicoFromSupabase(idPredio: string): Promise<EquipamentoTecnico[] | null> {
  if (!isSupabaseConfigured() || !idPredio) return null;
  const data = await dbSelect("inventario_tecnico", { filtros: [["id_predio", "eq", idPredio]] });
  if (!data || data.length === 0) return null;
  return data.map((row: any) => ({
    id: row.id,
    nome: row.nome,
    categoria: row.categoria || "",
    andar: row.andar || "",
    estado: row.estado,
    ultimaInspecao: row.ultima_inspecao,
    frequenciaInspecao: row.frequencia_inspecao || "",
    fabricante: row.fabricante || undefined,
    detalhes: row.detalhes || undefined
  }));
}

export async function saveEquipamentoTecnicoToSupabase(idPredio: string, eq: EquipamentoTecnico): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("inventario_tecnico", {
    id: eq.id,
    id_predio: idPredio,
    nome: eq.nome,
    categoria: eq.categoria || null,
    andar: eq.andar || null,
    estado: eq.estado,
    ultima_inspecao: eq.ultimaInspecao || null,
    frequencia_inspecao: eq.frequenciaInspecao || null,
    fabricante: eq.fabricante || null,
    detalhes: eq.detalhes || null
  });
}

export async function deleteEquipamentoTecnicoFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbDelete("inventario_tecnico", [["id", "eq", id]]);
}

// ============================================================================
// MURAL DIGITAL DE AVISOS
// ============================================================================
export async function fetchMuralAvisosFromSupabase(idPredio: string): Promise<MuralAviso[] | null> {
  if (!isSupabaseConfigured() || !idPredio) return null;
  const data = await dbSelect("mural_avisos", { filtros: [["id_predio", "eq", idPredio]] });
  if (!data || data.length === 0) return null;
  return data.map((row: any) => ({
    id_aviso_mural: row.id_aviso_mural,
    id_predio: row.id_predio,
    titulo: row.titulo,
    conteudo: row.conteudo || "",
    autor: row.autor || "",
    tipo: row.tipo,
    data_publicacao: row.data_publicacao,
    data_expiracao: row.data_expiracao || undefined,
    fixado_topo: Boolean(row.fixado_topo),
    anexos_fotos: row.anexos_fotos || [],
    reacoes_gostos: Number(row.reacoes_gostos) || 0
  }));
}

export async function saveMuralAvisoToSupabase(aviso: MuralAviso): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("mural_avisos", {
    id_aviso_mural: aviso.id_aviso_mural,
    id_predio: aviso.id_predio,
    titulo: aviso.titulo,
    conteudo: aviso.conteudo || null,
    autor: aviso.autor || null,
    tipo: aviso.tipo,
    data_publicacao: aviso.data_publicacao || null,
    data_expiracao: aviso.data_expiracao || null,
    fixado_topo: Boolean(aviso.fixado_topo),
    anexos_fotos: aviso.anexos_fotos || [],
    reacoes_gostos: aviso.reacoes_gostos || 0
  });
}

export async function deleteMuralAvisoFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbDelete("mural_avisos", [["id_aviso_mural", "eq", id]]);
}

// ============================================================================
// RESERVAS DE ESPAÇOS (Mural Digital / vista do condómino)
// ============================================================================
export async function fetchReservasEspacosMuralFromSupabase(idPredio: string): Promise<ReservaEspacoComum[] | null> {
  if (!isSupabaseConfigured() || !idPredio) return null;
  const data = await dbSelect("reservas_espacos_mural", { filtros: [["id_predio", "eq", idPredio]] });
  if (!data || data.length === 0) return null;
  return data.map((row: any) => ({
    id_reserva: row.id_reserva,
    id_predio: row.id_predio,
    id_fracao: row.id_fracao || "",
    fracao_nome: row.fracao_nome || "",
    solicitante_nome: row.solicitante_nome || "",
    espaco: row.espaco,
    data_evento: row.data_evento,
    hora_inicio: row.hora_inicio || "",
    hora_fim: row.hora_fim || "",
    finalidade: row.finalidade || "",
    num_pessoas_estimado: Number(row.num_pessoas_estimado) || 0,
    caucao_paga: Boolean(row.caucao_paga),
    valor_caucao: row.valor_caucao != null ? Number(row.valor_caucao) : undefined,
    termo_responsabilidade_aceite: Boolean(row.termo_responsabilidade_aceite),
    estado: row.estado
  }));
}

export async function saveReservaEspacoMuralToSupabase(reserva: ReservaEspacoComum): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("reservas_espacos_mural", {
    id_reserva: reserva.id_reserva,
    id_predio: reserva.id_predio,
    id_fracao: reserva.id_fracao || null,
    fracao_nome: reserva.fracao_nome || null,
    solicitante_nome: reserva.solicitante_nome || null,
    espaco: reserva.espaco,
    data_evento: reserva.data_evento || null,
    hora_inicio: reserva.hora_inicio || null,
    hora_fim: reserva.hora_fim || null,
    finalidade: reserva.finalidade || null,
    num_pessoas_estimado: reserva.num_pessoas_estimado || 0,
    caucao_paga: Boolean(reserva.caucao_paga),
    valor_caucao: reserva.valor_caucao ?? null,
    termo_responsabilidade_aceite: Boolean(reserva.termo_responsabilidade_aceite),
    estado: reserva.estado
  });
}

export async function deleteReservaEspacoMuralFromSupabase(idReserva: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbDelete("reservas_espacos_mural", [["id_reserva", "eq", idReserva]]);
}

// ============================================================================
// EQUIPAS / PRESTADORES DE SERVIÇO (MultiCondominio.tsx)
// ============================================================================
export async function fetchEquipasPrestadoresFromSupabase(idPredio?: string): Promise<TeamMember[] | null> {
  if (!isSupabaseConfigured()) return null;
  const data = await dbSelect("equipas_prestadores", { filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined });
  if (!data || data.length === 0) return null;
  return data.map((row: any) => ({
    id: row.id,
    id_predio: row.id_predio,
    nome: row.nome,
    funcao: row.funcao || "",
    empresa: row.empresa || "",
    telefone: row.telefone || "",
    email: row.email || "",
    status: row.status
  }));
}

export async function saveEquipaPrestadorToSupabase(membro: TeamMember): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("equipas_prestadores", {
    id: membro.id,
    id_predio: membro.id_predio,
    nome: membro.nome,
    funcao: membro.funcao || null,
    empresa: membro.empresa || null,
    telefone: membro.telefone || null,
    email: membro.email || null,
    status: membro.status
  });
}

export async function deleteEquipaPrestadorFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbDelete("equipas_prestadores", [["id", "eq", id]]);
}

// ============================================================================
// PORTAL DE ORÇAMENTOS — CONCURSOS (RFPs) E PROPOSTAS DE FORNECEDORES
// ============================================================================

export async function fetchRfpsFromSupabase(idPredio?: string): Promise<any[] | null> {
  if (!isSupabaseConfigured()) return null;
  const data = await dbSelect("rfps", {
    filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined,
    order: { coluna: "created_at", asc: false }
  });
  if (!data) return null;
  return data.map((row: any) => ({
    id_rfp: row.id_rfp,
    id_predio: row.id_predio,
    titulo: row.titulo,
    categoria: row.categoria || "",
    estimativa: Number(row.estimativa) || 0,
    data_publicacao: row.data_publicacao || "",
    data_limite: row.data_limite || "",
    descricao: row.descricao || "",
    estado: row.estado || "Aberto",
    fornecedor_adjudicado: row.fornecedor_adjudicado || undefined
  }));
}

export async function saveRfpToSupabase(rfp: {
  id_rfp: string; id_predio: string; titulo: string; categoria: string; estimativa: number;
  data_publicacao: string; data_limite: string; descricao: string; estado: string;
  fornecedor_adjudicado?: string; criado_por?: string;
}): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("rfps", {
    id_rfp: rfp.id_rfp,
    id_predio: rfp.id_predio,
    titulo: rfp.titulo,
    categoria: rfp.categoria,
    estimativa: rfp.estimativa,
    data_publicacao: rfp.data_publicacao,
    data_limite: rfp.data_limite,
    descricao: rfp.descricao,
    estado: rfp.estado,
    fornecedor_adjudicado: rfp.fornecedor_adjudicado || null,
    criado_por: rfp.criado_por || null,
    updated_at: new Date().toISOString()
  });
}

export async function fetchPropostasFromSupabase(idRfp: string): Promise<any[] | null> {
  if (!isSupabaseConfigured()) return null;
  const data = await dbSelect("propostas", {
    filtros: [["id_rfp", "eq", idRfp]],
    order: { coluna: "created_at", asc: true }
  });
  if (!data) return null;
  return data.map((row: any) => ({
    id_proposal: row.id_proposal,
    id_rfp: row.id_rfp,
    nome_empresa: row.nome_empresa,
    nif: row.nif || "",
    email: row.email || "",
    contacto: row.contacto || "",
    valor: Number(row.valor) || 0,
    prazo_dias: Number(row.prazo_dias) || 0,
    garantia_anos: Number(row.garantia_anos) || 0,
    descricao_tecnica: row.descricao_tecnica || "",
    ficheiro_nome: row.ficheiro_nome || "",
    ficheiro_caminho: row.ficheiro_caminho || undefined,
    data_submissao: row.data_submissao || "",
    anexos: Array.isArray(row.anexos) ? row.anexos : [],
    estado: row.estado || "Pendente",
    motivo_rejeicao: row.motivo_rejeicao || undefined,
    destino_obra: row.destino_obra || undefined,
    usa_fundo_reserva: row.usa_fundo_reserva ?? undefined,
    id_obra_criada: row.id_obra_criada || undefined
  }));
}

export async function savePropostaToSupabase(proposta: {
  id_proposal: string; id_rfp: string; nome_empresa: string; nif: string; email: string; contacto: string;
  valor: number; prazo_dias: number; garantia_anos: number; descricao_tecnica: string;
  ficheiro_nome: string; ficheiro_caminho?: string; data_submissao: string;
  anexos?: { nome: string; caminho: string }[];
  estado?: string; motivo_rejeicao?: string; destino_obra?: string; usa_fundo_reserva?: boolean; id_obra_criada?: string;
}): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("propostas", {
    id_proposal: proposta.id_proposal,
    id_rfp: proposta.id_rfp,
    nome_empresa: proposta.nome_empresa,
    nif: proposta.nif,
    email: proposta.email,
    contacto: proposta.contacto,
    valor: proposta.valor,
    prazo_dias: proposta.prazo_dias,
    garantia_anos: proposta.garantia_anos,
    descricao_tecnica: proposta.descricao_tecnica,
    ficheiro_nome: proposta.ficheiro_nome,
    ficheiro_caminho: proposta.ficheiro_caminho || null,
    data_submissao: proposta.data_submissao,
    anexos: proposta.anexos || [],
    estado: proposta.estado || "Pendente",
    motivo_rejeicao: proposta.motivo_rejeicao || null,
    destino_obra: proposta.destino_obra || null,
    usa_fundo_reserva: proposta.usa_fundo_reserva ?? null,
    id_obra_criada: proposta.id_obra_criada || null
  });
}

/**
 * Upload do PDF de uma proposta comercial para o bucket privado
 * "documentos" — devolve o caminho no Storage (não um URL público, o
 * bucket é privado), para abrir depois com um URL assinado, tal como o
 * resto do Arquivo Digital (ver /api/documento?acao=descarregar).
 */
export async function uploadPropostaFicheiro(file: File, idRfp: string, idProposal: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const extensao = file.name.includes(".") ? file.name.split(".").pop() : "pdf";
    const caminho = `propostas/${idRfp}/${idProposal}.${extensao}`;
    const { error } = await supabase.storage.from("documentos").upload(caminho, file, { upsert: true });
    if (error) {
      console.warn("[uploadPropostaFicheiro] Erro no upload:", error.message);
      return null;
    }
    return caminho;
  } catch (err) {
    console.warn("[uploadPropostaFicheiro] Exceção:", err);
    return null;
  }
}

/**
 * Upload de VÁRIOS anexos de uma proposta comercial (a proposta em si, mas
 * também fichas técnicas, certificados, seguros, etc.) — devolve a lista
 * dos que ficaram bem gravados, cada um com o nome original e o caminho no
 * Storage. Ficheiros que falhem o upload são simplesmente omitidos da
 * lista devolvida (não interrompem os restantes).
 */
export async function uploadPropostaFicheiros(files: File[], idRfp: string, idProposal: string): Promise<{ nome: string; caminho: string }[]> {
  if (!isSupabaseConfigured() || files.length === 0) return [];
  const resultados = await Promise.all(
    files.map(async (file, idx) => {
      try {
        const extensao = file.name.includes(".") ? file.name.split(".").pop() : "pdf";
        const caminho = `propostas/${idRfp}/${idProposal}-${idx}.${extensao}`;
        const { error } = await supabase.storage.from("documentos").upload(caminho, file, { upsert: true });
        if (error) {
          console.warn("[uploadPropostaFicheiros] Erro no upload de", file.name, ":", error.message);
          return null;
        }
        return { nome: file.name, caminho };
      } catch (err) {
        console.warn("[uploadPropostaFicheiros] Exceção no upload de", file.name, ":", err);
        return null;
      }
    })
  );
  return resultados.filter((r): r is { nome: string; caminho: string } => r !== null);
}

// ============================================================================
// FICHA DE RESIDENTES / INQUILINOS (GestaoFracoes.tsx)
// ============================================================================

export async function fetchResidentesInquilinosFromSupabase(idPredio?: string): Promise<any[] | null> {
  if (!isSupabaseConfigured()) return null;
  const data = await dbSelect("residentes_inquilinos", {
    filtros: idPredio ? [["id_predio", "eq", idPredio]] : undefined,
    order: { coluna: "created_at", asc: false }
  });
  if (!data) return null;
  return data.map((row: any) => ({
    id: row.id_residente,
    id_fracao: row.id_fracao,
    nome: row.nome,
    nif: row.nif || "",
    email: row.email || "",
    telefone: row.telefone || "",
    data_entrada: row.data_entrada || "",
    data_saida: row.data_saida || null,
    contrato_fim: row.contrato_fim || "",
    valor_renda: Number(row.valor_renda) || 0,
    caucao: Number(row.valor_caucao) || 0,
    chaves_entregues: row.chaves_entregues || "",
    estado: row.estado || "Ativo"
  }));
}

export async function saveResidenteInquilinoToSupabase(residente: {
  id: string; id_predio: string; id_fracao: string; nome: string; nif: string; email: string;
  telefone: string; data_entrada: string; data_saida: string | null; contrato_fim?: string;
  valor_renda: number; caucao: number; chaves_entregues: string; estado: string;
}): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("residentes_inquilinos", {
    id_residente: residente.id,
    id_predio: residente.id_predio,
    id_fracao: residente.id_fracao,
    nome: residente.nome,
    nif: residente.nif,
    email: residente.email,
    telefone: residente.telefone,
    data_entrada: residente.data_entrada || null,
    data_saida: residente.data_saida || null,
    contrato_fim: residente.contrato_fim || null,
    valor_renda: residente.valor_renda,
    valor_caucao: residente.caucao,
    chaves_entregues: residente.chaves_entregues,
    estado: residente.estado,
    updated_at: new Date().toISOString()
  }, { onConflict: "id_residente" });
}

