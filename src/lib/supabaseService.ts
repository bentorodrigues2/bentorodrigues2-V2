import { supabase } from '@/lib/supabaseClient';
import { 
  Predio, 
  Fracao, 
  Proprietario,
  Conta, 
  Fornecedor, 
  Movimento, 
  Aviso, 
  Reuniao, 
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
  RespostaQuestionario
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
    const resp = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      autoresponder_ativo: row.autoresponder_ativo ?? true
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
      metodo_pagamento: row.forma_pagamento
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
    forma_pagamento: mov.metodo_pagamento || "Transferência"
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

    const { data: publicData } = supabase.storage
      .from("documentos")
      .getPublicUrl(data.path);

    return publicData.publicUrl;
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
  role: "ADMIN" | "GESTOR" | "EMPRESA_GESTORA" | "USER" | "TECNICO" | "LIMPEZAS" | "CONTABILISTA" | "JURIDICO" | "AUDITOR";
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
    pwa_password_provisoria: forn.pwa_password_provisoria || null
  });
}

export async function deleteFornecedorFromSupabase(idFornecedor: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbDelete("fornecedores", [["id_fornecedor", "eq", idFornecedor]]);
}

export async function saveContratoToSupabase(contrato: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("contratos", {
    id_contrato: contrato.id_contrato,
    id_predio: contrato.id_predio,
    id_fornecedor: contrato.id_fornecedor,
    servico: contrato.servico,
    custo_mensal: contrato.custo_mensal,
    custo_anual: contrato.custo_anual,
    renovacao_automatica: contrato.renovacao_automatica,
    data_fim: contrato.data_fim,
    alerta_renovacao: contrato.alerta_renovacao,
    sla_resposta: contrato.sla_resposta || null,
    penalizacao_atraso: contrato.penalizacao_atraso || null,
    indexacao_preco: contrato.indexacao_preco || null,
    documento_nome: contrato.documento_nome || null
  });
}

// ============================================================================
// GESTÃO DE REUNIÕES & ASSEMBLEIAS
// ============================================================================
export async function saveReuniaoToSupabase(reuniao: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  return dbUpsert("reunioes", {
    id_reuniao: reuniao.id_reuniao,
    id_predio: reuniao.id_predio,
    tema: reuniao.tema,
    data: reuniao.data,
    hora: reuniao.hora,
    ordens_trabalho: reuniao.ordens_trabalho,
    local: reuniao.local || null,
    estado: reuniao.estado || "Agendada",
    ata_conteudo: reuniao.ata_conteudo || null,
    tipo: reuniao.tipo || "Ordinária"
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
      estado: row.estado || "Pendente"
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
    estado: a.estado || "Pendente"
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

// ============================================================================
// FORNECEDORES
// ============================================================================
// A tabela real "fornecedores" ainda não tem as colunas id_predio,
// pessoa_contacto, telemovel_direto, email_contacto, data_nascimento,
// perfis_pwa, pwa_acesso_enviado, pwa_password_provisoria — ver
// supabase_fornecedores_missing_columns.sql para as adicionar (ALTER TABLE
// aditivo). Até essa migração ser aplicada, estes campos ficam undefined
// nos dados lidos e as gravações desses campos são ignoradas pelo Supabase
// (mas o resto do fornecedor grava-se e lê-se normalmente).
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
      foto: row.foto || null
    }));
  } catch (err) {
    return null;
  }
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

