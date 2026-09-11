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
  Reserva 
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
