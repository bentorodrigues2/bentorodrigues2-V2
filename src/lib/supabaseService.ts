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
  SinistroSeguro
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
// PRÉDIOS
// ============================================================================

export async function fetchPrediosFromSupabase(): Promise<Predio[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase.from("predios").select("*");
    if (error) {
      console.warn("[Supabase] Error fetching predios:", error.message);
      return null;
    }
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
  try {
    const { error } = await supabase.from("predios").upsert({
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
    if (error) console.warn("[Supabase] Save predio error:", error.message);
    return !error;
  } catch (err) {
    console.warn("[Supabase] Save predio exception:", err);
    return false;
  }
}

export async function deletePredioFromSupabase(idPredio: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from("predios").delete().eq("id_predio", idPredio);
    return !error;
  } catch (err) {
    return false;
  }
}

// ============================================================================
// FRAÇÕES
// ============================================================================

export async function fetchFracoesFromSupabase(idPredio?: string): Promise<Fracao[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    let query = supabase.from("fracoes").select("*");
    if (idPredio) query = query.eq("id_predio", idPredio);
    const { data, error } = await query;
    if (error || !data || data.length === 0) return null;

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
      apolice_validade: row.apolice_validade || ""
    }));
  } catch (err) {
    return null;
  }
}

export async function saveFracaoToSupabase(fracao: Fracao): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from("fracoes").upsert({
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
      seguradora: fracao.seguradora,
      apolice_num: fracao.apolice_num,
      apolice_validade: fracao.apolice_validade,
      apolice_doc: fracao.apolice_doc
    });
    return !error;
  } catch (err) {
    return false;
  }
}

export async function deleteFracaoFromSupabase(idFracao: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from("fracoes").delete().eq("id_fracao", idFracao);
    return !error;
  } catch (err) {
    return false;
  }
}

export async function saveProprietarioToSupabase(proprietario: Proprietario, idFracao?: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    // If associated with a fraction, update fraction's owner
    if (idFracao) {
      await supabase.from("fracoes").update({ 
        proprietario: proprietario,
        administrador_interno: proprietario.administrador_interno || "Não",
        notificacao_preferencial: proprietario.notificacao_preferencial || "Digital (E-mail e Mensagens Push)"
      }).eq("id_fracao", idFracao);
    }
    // Also try saving to proprietarios table if present
    try {
      await supabase.from("proprietarios").upsert({
        id_proprietario: proprietario.id_proprietario || proprietario.nif,
        id_predio: proprietario.id_predio,
        id_fracao: idFracao || proprietario.id_fracao,
        nome: proprietario.nome,
        nif: proprietario.nif,
        email: proprietario.email,
        tlm: proprietario.tlm,
        iban: proprietario.iban,
        administrador_interno: proprietario.administrador_interno,
        notificacao_preferencial: proprietario.notificacao_preferencial
      });
    } catch {
      // Table may not exist yet, which is safe
    }
    return true;
  } catch (err) {
    return false;
  }
}

export async function deleteProprietarioFromSupabase(identifier: string, idFracao?: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    if (idFracao) {
      await supabase.from("fracoes").update({ 
        proprietario: null,
        administrador_interno: "Não"
      }).eq("id_fracao", idFracao);
    }
    try {
      await supabase.from("proprietarios").delete().or(`id_proprietario.eq.${identifier},nif.eq.${identifier},email.eq.${identifier}`);
    } catch {
      // Table may not exist
    }
    return true;
  } catch (err) {
    return false;
  }
}

// ============================================================================
// CONTAS BANCÁRIAS DO PRÉDIO / CONDOMÍNIO
// ============================================================================

export async function fetchContasFromSupabase(idPredio?: string): Promise<Conta[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    let query = supabase.from("contas").select("*");
    if (idPredio) query = query.eq("id_predio", idPredio);
    const { data, error } = await query;
    if (error || !data || data.length === 0) return null;

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
  try {
    const { error } = await supabase.from("contas").upsert({
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
    return !error;
  } catch (err) {
    return false;
  }
}

export async function deleteContaFromSupabase(idConta: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from("contas").delete().eq("id_conta", idConta);
    return !error;
  } catch (err) {
    return false;
  }
}

// ============================================================================
// MOVIMENTOS FINANCEIROS
// ============================================================================

export async function fetchMovimentosFromSupabase(idPredio?: string): Promise<Movimento[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    let query = supabase.from("movimentos").select("*");
    if (idPredio) query = query.eq("id_predio", idPredio);
    const { data, error } = await query;
    if (error || !data || data.length === 0) return null;

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
      id_fracao: row.fracao_id,
      metodo_pagamento: row.forma_pagamento
    }));
  } catch (err) {
    return null;
  }
}

export async function saveMovimentoToSupabase(mov: Movimento): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from("movimentos").upsert({
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
    return !error;
  } catch (err) {
    return false;
  }
}

// ============================================================================
// UPLOAD DE FICHEIROS PARA O SUPABASE STORAGE
// ============================================================================

export async function uploadDocumentoToStorage(file: File, path: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase.storage
      .from("condo_documentos")
      .upload(path, file, { upsert: true });

    if (error) {
      console.warn("[Supabase Storage] Upload error:", error.message);
      return null;
    }

    const { data: publicData } = supabase.storage
      .from("condo_documentos")
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
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.warn("[Supabase Profiles] Error fetching profile:", error.message);
      return null;
    }
    return data as SupabaseUserProfile;
  } catch (err) {
    console.warn("[Supabase Profiles] Exception:", err);
    return null;
  }
}

export async function updateUserProfile(
  userId: string, 
  updates: Partial<SupabaseUserProfile>
): Promise<{ success: boolean; data?: SupabaseUserProfile; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase não configurado" };
  }
  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: data as SupabaseUserProfile };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erro desconhecido" };
  }
}

export async function fetchAllProfiles(): Promise<SupabaseUserProfile[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[Supabase Profiles] Error fetching all:", error.message);
      return [];
    }
    return (data || []) as SupabaseUserProfile[];
  } catch (err) {
    console.warn("[Supabase Profiles] Exception:", err);
    return [];
  }
}

// ============================================================================
// GESTÃO DE CHAVES (CLAVICULÁRIO / CHAVEIRO)
// ============================================================================

export async function fetchChavesFromSupabase(idPredio?: string): Promise<ChaveItem[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    let query = supabase.from("gestao_chaves").select("*");
    if (idPredio) {
      query = query.eq("id_predio", idPredio);
    }
    const { data, error } = await query;
    if (error) {
      console.warn("[Supabase] Error fetching chaves:", error.message);
      return null;
    }
    if (!data) return null;
    return data.map((row: any) => ({
      id_chave: row.id_chave,
      id_predio: row.id_predio,
      area_nome: row.area_nome || row.local || "",
      local: row.local || row.local_sugerido || row.area_nome || "",
      codigo_chave: row.codigo_chave || "",
      quantidade: Number(row.quantidade) || 1,
      no_claviculario: row.no_claviculario ?? (row.status !== "entregue"),
      status: row.status || (row.no_claviculario === false ? "entregue" : "disponivel"),
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
  try {
    const { error } = await supabase.from("gestao_chaves").upsert({
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
    if (error) {
      console.warn("[Supabase] Save chave error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[Supabase] Exception saving chave:", err);
    return false;
  }
}

export async function saveChavesToSupabase(chaves: ChaveItem[]): Promise<{ success: boolean; count: number; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, count: 0, error: "Supabase não está configurado." };
  }
  try {
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

    const { error } = await supabase.from("gestao_chaves").upsert(payload);
    if (error) {
      console.warn("[Supabase] Batch save chaves error:", error.message);
      return { success: false, count: 0, error: error.message };
    }
    return { success: true, count: payload.length };
  } catch (err: any) {
    console.warn("[Supabase] Exception batch saving chaves:", err);
    return { success: false, count: 0, error: err?.message || String(err) };
  }
}

export async function deleteChaveFromSupabase(idChave: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from("gestao_chaves").delete().eq("id_chave", idChave);
    if (error) {
      console.warn("[Supabase] Delete chave error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[Supabase] Exception deleting chave:", err);
    return false;
  }
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
    let query = supabase.from("seguros_fracoes").select("*");
    if (fracaoIds && fracaoIds.length > 0) {
      query = query.in("fracao_id", fracaoIds);
    }
    const { data, error } = await query;
    if (error) {
      console.warn("[Supabase] Tabela seguros_fracoes não disponível ou erro:", error.message);
      return null;
    }
    return (data || []).map((row: any) => ({
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
  try {
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
    const { error } = await supabase.from("seguros_fracoes").upsert(payload);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export async function deleteSeguroFracaoFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from("seguros_fracoes").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

// ============================================================================
// SEGUROS DE PARTES COMUNS (seguros_partes_comuns)
// ============================================================================

export async function fetchSegurosPartesComunsFromSupabase(condominioId: string): Promise<SeguroPartesComuns[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase
      .from("seguros_partes_comuns")
      .select("*")
      .eq("condominio_id", condominioId);
    if (error) {
      console.warn("[Supabase] Tabela seguros_partes_comuns não disponível:", error.message);
      return null;
    }
    return (data || []).map((row: any) => ({
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
  try {
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
    const { error } = await supabase.from("seguros_partes_comuns").upsert(payload);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export async function deleteSeguroPartesComunsFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from("seguros_partes_comuns").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

// ============================================================================
// GESTÃO DE SINISTROS (sinistros)
// ============================================================================

export async function fetchSinistrosFromSupabase(idPredio: string): Promise<SinistroSeguro[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase
      .from("sinistros")
      .select("*")
      .eq("id_predio", idPredio);
    if (error) {
      console.warn("[Supabase] Tabela sinistros não disponível:", error.message);
      return null;
    }
    return (data || []).map((row: any) => ({
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
  try {
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
    const { error } = await supabase.from("sinistros").upsert(payload);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export async function deleteSinistroFromSupabase(idSinistro: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from("sinistros").delete().eq("id_sinistro", idSinistro);
    return !error;
  } catch {
    return false;
  }
}
