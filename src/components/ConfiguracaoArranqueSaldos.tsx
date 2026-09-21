import React, { useState, useMemo, useEffect } from "react";
import { Predio, Fracao, Conta, Movimento, Aviso, LoggedUser, Documento } from "../types";
import { parseValorMonetario } from "../utils";
import { saveContaToSupabase, saveAvisosToSupabase, deleteAvisoFromSupabase, saveMovimentoToSupabase, registarLogAuditoria, fetchObrasExtraFromSupabase, uploadDocumentoToStorage, saveDocumentoToSupabase, savePredioToSupabase } from "../lib/supabaseService";
import type { ObraExtraordinaria } from "./GestaoManutencaoIntervencoes";
import { 
  Sliders, 
  Wallet, 
  Building2, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  UploadCloud, 
  Sparkles, 
  FileSpreadsheet,
  Check,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  DollarSign,
  Layers,
  Landmark,
  Hammer,
  X,
  Settings2,
  Scale
} from "lucide-react";
import { triggerSendReaction } from "./SendingReactionModal";
import { MoneyInput } from "./MoneyInput";

interface ConfiguracaoArranqueSaldosProps {
  predio: Predio;
  fracoes: Fracao[];
  contas: Conta[];
  setContas: React.Dispatch<React.SetStateAction<Conta[]>>;
  movements: Movimento[];
  setMovements: React.Dispatch<React.SetStateAction<Movimento[]>>;
  avisos: Aviso[];
  setAvisos: React.Dispatch<React.SetStateAction<Aviso[]>>;
  loggedUser: LoggedUser;
  documentos?: Documento[];
  setDocumentos?: React.Dispatch<React.SetStateAction<Documento[]>>;
  onConcluir?: () => void;
  onUpdatePredio?: (predio: Predio) => void;
}

export interface ContaArranqueItem {
  id_conta: string;
  nome: string;
  banco: string;
  iban: string;
  tipo: string;
  categoriaConta: "ORDEM" | "POUPANCA" | "INTERVENCOES" | "CAIXA";
  saldo: number;
  finalidade?: string;
  is_principal?: boolean;
}

// Um período de quota ordinária em dívida — várias entradas por fração
// porque o valor da quota pode ter mudado ao longo do tempo (ex: 45€/mês
// até março, 52€/mês depois). Cada período é dividido automaticamente em
// Quota Ordinária + Fundo de Reserva (mesma regra dos 90%/10% já usada em
// toda a app), e o total é meses em dívida × valor mensal.
export interface DividaQuotaOrdinariaPeriodo {
  id: string;
  data_inicio: string; // "desde"
  valor_quota_mensal: number; // valor total mensal (Ordinária + FCR)
  meses_em_divida: number;
  // Prova documental da dívida transitada (balancete/extrato da
  // administração anterior) — arquivada no Storage real, não só um nome.
  comprovativo?: { nome: string; caminho: string };
}

// Uma quota extraordinária em dívida, ligada (opcionalmente) a uma Obra
// Extraordinária real já registada — transporta o valor calculado na
// adjudicação da obra, discriminado por mês de início/fim de pagamentos.
export interface DividaQuotaExtraItem {
  id: string;
  id_obra?: string;
  descricao: string;
  data_inicio_pagamentos: string;
  data_fim_pagamentos: string;
  valor_mensal: number;
  valor_total: number;
  comprovativo?: { nome: string; caminho: string };
}

export interface SaldoInicialFracao {
  id_fracao: string;
  fracao_nome: string;
  proprietario_nome: string;
  tipo_saldo: "REGULARIZADO" | "DIVIDA" | "CREDITO";
  valor_saldo: number;
  meses_atraso: number;
  observacoes: string;
  // Discriminação real da dívida — substitui o valor único/generalizado.
  // valor_saldo continua a existir e é recalculado automaticamente a
  // partir destas listas, para manter compatível o resto do fluxo
  // (contadores de totais, Ativo Líquido de Arranque).
  dividasQuotasOrdinarias: DividaQuotaOrdinariaPeriodo[];
  dividasQuotasExtras: DividaQuotaExtraItem[];
}

export interface MovimentoHistoricoTransitor {
  id: string;
  data: string;
  descricao: string;
  categoria: string;
  tipo: "RECEITA" | "DESPESA";
  valor: number;
  id_conta: string;
  nome_conta?: string;
}

export function ConfiguracaoArranqueSaldos({
  predio,
  fracoes,
  contas,
  setContas,
  movements,
  setMovements,
  avisos,
  setAvisos,
  loggedUser,
  documentos,
  setDocumentos,
  onConcluir,
  onUpdatePredio
}: ConfiguracaoArranqueSaldosProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);

  // --- PASSO 1: DATA E SALDOS BANCÁRIOS DE ABERTURA (MÚLTIPLAS CONTAS & INTERVENÇÕES) ---
  const [dataAbertura, setDataAbertura] = useState<string>(predio.data_inicio_gestao || "2026-08-01");

  // Antes, a data só era gravada no Supabase quando se completava o
  // assistente inteiro até ao botão final "Concluir" (handleGravarConfiguracaoArranque,
  // passo 4) — se o utilizador só viesse aqui corrigir esta data sem
  // reconfigurar tudo o resto, a alteração nunca chegava a persistir e
  // voltava sempre ao valor antigo num F5. Grava agora de imediato, assim
  // que a data muda, independente do resto do fluxo do assistente.
  const [aGuardarDataAbertura, setAGuardarDataAbertura] = useState(false);
  const handleAlterarDataAbertura = async (novaData: string) => {
    setDataAbertura(novaData);
    if (!novaData) return;
    setAGuardarDataAbertura(true);
    const predioAtualizado: Predio = { ...predio, data_inicio_gestao: novaData };
    const ok = await savePredioToSupabase(predioAtualizado);
    setAGuardarDataAbertura(false);
    if (ok) onUpdatePredio?.(predioAtualizado);
  };

  // Lista dinâmica de contas de arranque
  const [contasArranque, setContasArranque] = useState<ContaArranqueItem[]>(() => {
    const existing = contas.filter(c => c.id_predio === predio.id_predio);
    if (existing.length > 0) {
      return existing.map(c => {
        let cat: "ORDEM" | "POUPANCA" | "INTERVENCOES" | "CAIXA" = "ORDEM";
        const t = (c.tipo || "").toLowerCase();
        if (t.includes("reserva")) cat = "POUPANCA";
        else if (t.includes("interven") || t.includes("obra")) cat = "INTERVENCOES";
        else if (t.includes("caixa")) cat = "CAIXA";

        return {
          id_conta: c.id_conta,
          nome: c.tipo || "Conta Bancária",
          banco: c.banco || "Banco",
          iban: c.iban || predio.iban || "PT50 0000 0000 0000 0000 0000 0",
          tipo: c.tipo || "Conta à Ordem",
          categoriaConta: cat,
          saldo: c.saldo || 0,
          finalidade: cat === "INTERVENCOES" ? "Conta afeta a obras e intervenções" : undefined,
          is_principal: c.is_principal ?? false
        };
      });
    }

    return [];
  });

  // Atualizar campo de uma conta
  const handleUpdateContaArranque = (id_conta: string, fields: Partial<ContaArranqueItem>) => {
    setContasArranque(prev => prev.map(c => {
      if (c.id_conta === id_conta) {
        return { ...c, ...fields };
      }
      return c;
    }));
  };

  // Adicionar nova conta bancária ou de intervenção
  const handleAddNovaConta = (categoria: "INTERVENCOES" | "ORDEM" | "POUPANCA" | "CAIXA") => {
    const timestamp = Date.now();
    const isIntervencao = categoria === "INTERVENCOES";
    const nova: ContaArranqueItem = {
      id_conta: `conta-${categoria.toLowerCase()}-${timestamp}`,
      nome: isIntervencao ? "Conta Intervenções Fachada / Telhado" : categoria === "POUPANCA" ? "Depósito a Prazo / Poupança" : "Conta Adicional Ordem",
      banco: "Millennium BCP",
      iban: (predio.iban || "PT50 0033 0000 1234 5678 9012 3").replace("1234", String(timestamp).slice(-4)),
      tipo: isIntervencao ? "Conta Intervenções & Obras" : categoria === "POUPANCA" ? "Conta Poupança" : "Conta à Ordem",
      categoriaConta: categoria,
      saldo: 0,
      finalidade: isIntervencao ? "Conta dedicada a intervenção estrutural específica no edifício" : "Conta de apoio financeiro",
      is_principal: false
    };
    setContasArranque(prev => [...prev, nova]);
  };

  // Remover conta (exceto a principal)
  const handleRemoveConta = (id_conta: string) => {
    const conta = contasArranque.find(c => c.id_conta === id_conta);
    if (conta?.is_principal) {
      alert("A conta à ordem principal não pode ser removida.");
      return;
    }
    setContasArranque(prev => prev.filter(c => c.id_conta !== id_conta));
  };

  // --- PASSO 2: SALDOS INICIAIS POR FRAÇÃO (DÍVIDAS ANTERIORES) ---
  const predioFracoes = useMemo(() => fracoes.filter(f => f.id_predio === predio.id_predio), [fracoes, predio.id_predio]);

  // Rate de quota mensal por fração — mesma fórmula (permilagem × rate, com
  // o coeficiente real das lojas com acesso direto pelo exterior) já usada
  // em GestaoQuotasOrcamento.tsx para emitir as quotas mensais normais —
  // reaproveitada aqui para pré-preencher a "Quota Mensal Total" na
  // discriminação de dívida, que antes nascia sempre a 0€.
  const COEF_LOJA_EXTERIOR = 0.4528;
  const isLojaExterior = (f: Fracao) => f.tipologia === "Loja Comercial" && (f.tipo_access || "").includes("Exterior");
  const { rateNormal, rateLoja } = useMemo(() => {
    const orcamentoAnual = Number((predio.patrimonio as any)?.orcamento_anual || 0);
    const orcamentoMensal = orcamentoAnual / 12;
    let permilagemLoja = 0;
    predioFracoes.forEach(f => { if (isLojaExterior(f)) permilagemLoja += f.permilagem; });
    const permilagemNormal = 1000 - permilagemLoja;
    const denominador = permilagemNormal + permilagemLoja * COEF_LOJA_EXTERIOR;
    const rN = denominador > 0 ? orcamentoMensal / denominador : 0;
    return { rateNormal: rN, rateLoja: rN * COEF_LOJA_EXTERIOR };
  }, [(predio.patrimonio as any)?.orcamento_anual, predioFracoes]);
  const calcularQuotaMensalFracao = (f: Fracao): number =>
    Math.round(f.permilagem * (isLojaExterior(f) ? rateLoja : rateNormal) * 100) / 100;

  // Meses decorridos entre uma data e hoje (mínimo 1) — usado para
  // pré-preencher "Meses em Dívida" quando a data "Desde" é escolhida ou
  // alterada; o utilizador continua sempre livre para corrigir o valor.
  const diffMesesAteHoje = (dataInicioIso: string): number => {
    const inicio = new Date(dataInicioIso);
    if (isNaN(inicio.getTime())) return 1;
    const hoje = new Date();
    let meses = (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth()) + 1;
    if (hoje.getDate() < inicio.getDate()) meses -= 1;
    return Math.max(1, meses);
  };

  // Reconstrói o estado discriminado (períodos de quota ordinária/extra por
  // fração) a partir dos Avisos "aviso-inicial-*" já gravados no Supabase —
  // sem isto, o estado nascia sempre em branco a cada F5/remontagem deste
  // ecrã, dando a sensação de que a dívida lançada tinha desaparecido,
  // quando na realidade continuava gravada (visível em Contencioso,
  // Dashboard, etc.) só não era relida de volta para este formulário.
  // A discriminação por período não tem coluna própria na BD (evitar DDL) —
  // é recuperada a partir do texto de "descricao", que este próprio
  // ficheiro controla por inteiro (ver construirAvisosDividaFracao acima);
  // se o formato não for reconhecido (aviso mais antigo/manual), cai para
  // um único período que preserva pelo menos o valor total.
  const reconstruirSaldosFracoes = (fs: Fracao[], avisosAtuais: Aviso[]): SaldoInicialFracao[] => {
    return fs.map((f) => {
      const avisosFracao = avisosAtuais.filter(a =>
        a.id_predio === predio.id_predio && a.id_fracao === f.id_fracao && a.id_aviso.startsWith("aviso-inicial-")
      );
      const dividasQuotasOrdinarias: DividaQuotaOrdinariaPeriodo[] = [];
      const dividasQuotasExtras: DividaQuotaExtraItem[] = [];
      let observacoesReconstruidas = "";

      avisosFracao.forEach((a) => {
        const idPeriodo = a.id_aviso.replace("aviso-inicial-", "");
        if (a.tipo === "Quota Ordinária") {
          const m = a.descricao.match(/desde (\d{4}-\d{2}-\d{2}) \((\d+) (?:mês|meses) × ([\d.,]+)€\)\.?\s*(.*)$/);
          if (m) {
            dividasQuotasOrdinarias.push({
              id: idPeriodo,
              data_inicio: m[1],
              meses_em_divida: parseInt(m[2], 10),
              valor_quota_mensal: parseFloat(m[3].replace(",", "."))
            });
            if (m[4]) observacoesReconstruidas = m[4];
          } else {
            dividasQuotasOrdinarias.push({ id: idPeriodo, data_inicio: a.data, meses_em_divida: 1, valor_quota_mensal: a.valor });
          }
        } else if (a.tipo === "Quota Extraordinária") {
          const m = a.descricao.match(/— (.*) \((\d{4}-\d{2}-\d{2}) a (\d{4}-\d{2}-\d{2}), ([\d.,]+)€\/mês\)\.?\s*(.*)$/);
          if (m) {
            dividasQuotasExtras.push({
              id: idPeriodo,
              id_obra: a.id_obra,
              descricao: m[1],
              data_inicio_pagamentos: m[2],
              data_fim_pagamentos: m[3],
              valor_mensal: parseFloat(m[4].replace(",", ".")),
              valor_total: a.valor
            });
            if (m[5]) observacoesReconstruidas = m[5];
          } else {
            dividasQuotasExtras.push({ id: idPeriodo, id_obra: a.id_obra, descricao: a.descricao, data_inicio_pagamentos: a.data, data_fim_pagamentos: a.data, valor_mensal: a.valor, valor_total: a.valor });
          }
        }
      });

      const temDivida = dividasQuotasOrdinarias.length > 0 || dividasQuotasExtras.length > 0;
      const valorSaldo = dividasQuotasOrdinarias.reduce((s, p) => s + p.valor_quota_mensal * p.meses_em_divida, 0)
        + dividasQuotasExtras.reduce((s, e) => s + e.valor_total, 0);

      return {
        id_fracao: f.id_fracao,
        fracao_nome: f.fracao_nome,
        proprietario_nome: f.proprietario.nome,
        tipo_saldo: temDivida ? "DIVIDA" : "REGULARIZADO",
        valor_saldo: Math.round(valorSaldo * 100) / 100,
        meses_atraso: 0,
        observacoes: observacoesReconstruidas,
        dividasQuotasOrdinarias,
        dividasQuotasExtras
      };
    });
  };

  const [saldosFracoes, setSaldosFracoes] = useState<SaldoInicialFracao[]>(() => reconstruirSaldosFracoes(predioFracoes, avisos));

  // Obras Extraordinárias reais já adjudicadas — para ligar uma dívida de
  // quota extra a uma obra concreta em vez de um valor solto sem contexto.
  const [obrasExtra, setObrasExtra] = useState<ObraExtraordinaria[]>([]);
  useEffect(() => {
    fetchObrasExtraFromSupabase(predio.id_predio).then(dados => setObrasExtra(dados || []));
  }, [predio.id_predio]);

  // Fração cujo modal de discriminação de dívidas está aberto
  const [modalDividaFracaoId, setModalDividaFracaoId] = useState<string | null>(null);

  const calcularTotalDivida = (sf: SaldoInicialFracao): number => {
    const totalOrdinarias = (sf.dividasQuotasOrdinarias || []).reduce((soma, p) => soma + p.valor_quota_mensal * p.meses_em_divida, 0);
    const totalExtras = (sf.dividasQuotasExtras || []).reduce((soma, e) => soma + e.valor_total, 0);
    return Math.round((totalOrdinarias + totalExtras) * 100) / 100;
  };

  // Constrói a lista real de Avisos (Quotas Ordinárias + Extra) a partir da
  // discriminação de uma fração — reaproveitado tanto para gravar de
  // imediato ao fechar o modal de dívidas, como no botão final "Concluir"
  // do assistente, para nunca haver duas fórmulas diferentes a divergir.
  // Os ids são estáveis (derivados do id local de cada período/item), para
  // voltar a gravar o mesmo item atualizar em vez de duplicar no Supabase.
  const construirAvisosDividaFracao = (sf: SaldoInicialFracao): Aviso[] => {
    if (sf.tipo_saldo !== "DIVIDA") return [];
    const fracaoRef = predioFracoes.find(f => f.id_fracao === sf.id_fracao);
    const resultado: Aviso[] = [];

    sf.dividasQuotasOrdinarias.forEach((p) => {
      if (p.valor_quota_mensal <= 0 || p.meses_em_divida <= 0) return;
      const valorFCR = Math.round(p.valor_quota_mensal * 0.1 * p.meses_em_divida * 100) / 100;
      const valorTotal = Math.round(p.valor_quota_mensal * p.meses_em_divida * 100) / 100;
      resultado.push({
        id_aviso: `aviso-inicial-${p.id}`,
        id_predio: predio.id_predio,
        id_fracao: sf.id_fracao,
        tipo: "Quota Ordinária",
        data: dataAbertura,
        vencimento: dataAbertura,
        descricao: `Quotas Ordinárias em dívida da administração anterior — desde ${p.data_inicio} (${p.meses_em_divida} ${p.meses_em_divida === 1 ? "mês" : "meses"} × ${p.valor_quota_mensal.toFixed(2)}€). ${sf.observacoes}`.trim(),
        valor: valorTotal,
        valor_fundo_reserva: valorFCR,
        estado: "Pendente",
        proprietario_nome: fracaoRef?.proprietario?.nome,
        proprietario_nif: fracaoRef?.proprietario?.nif
      });
    });

    sf.dividasQuotasExtras.forEach((it) => {
      if (it.valor_total <= 0) return;
      resultado.push({
        id_aviso: `aviso-inicial-${it.id}`,
        id_predio: predio.id_predio,
        id_fracao: sf.id_fracao,
        tipo: "Quota Extraordinária",
        data: dataAbertura,
        vencimento: dataAbertura,
        descricao: `Quota Extraordinária em dívida da administração anterior — ${it.descricao || "Obra"} (${it.data_inicio_pagamentos} a ${it.data_fim_pagamentos}, ${it.valor_mensal.toFixed(2)}€/mês). ${sf.observacoes}`.trim(),
        valor: it.valor_total,
        estado: "Pendente",
        id_obra: it.id_obra || undefined,
        proprietario_nome: fracaoRef?.proprietario?.nome,
        proprietario_nif: fracaoRef?.proprietario?.nif
      });
    });

    return resultado;
  };

  // Grava já no Supabase os avisos da dívida discriminada de uma fração —
  // chamado ao fechar o modal, em vez de depender de chegar ao botão final
  // "Concluir" do assistente (passo 4). Sem isto, fechar o modal com
  // "Concluído" dava a sensação de ter gravado mas nada persistia: os dados
  // só existiam no estado local do formulário, perdidos ao sair do passo 2.
  const [aGravarDividaFracao, setAGravarDividaFracao] = useState(false);
  const persistirDividaFracaoImediatamente = async (id_fracao: string) => {
    const sf = saldosFracoes.find(s => s.id_fracao === id_fracao);
    if (!sf) return;
    const avisosParaGravar = construirAvisosDividaFracao(sf);
    if (avisosParaGravar.length === 0) return;
    setAGravarDividaFracao(true);
    const ok = await saveAvisosToSupabase(avisosParaGravar);
    setAGravarDividaFracao(false);
    if (!ok) {
      alert("❌ Não foi possível gravar a dívida desta fração no Supabase. Verifique a ligação e tente novamente antes de fechar esta janela.");
      return;
    }
    setAvisos(prev => {
      const semAntigos = prev.filter(a => !avisosParaGravar.some(n => n.id_aviso === a.id_aviso));
      return [...semAntigos, ...avisosParaGravar];
    });
  };

  // Atualizador de linha de saldo de fração
  const handleUpdateSaldoFracao = (id_fracao: string, fields: Partial<SaldoInicialFracao>) => {
    setSaldosFracoes(prev => prev.map(s => {
      if (s.id_fracao === id_fracao) {
        const updated = { ...s, ...fields };
        if (updated.tipo_saldo === "REGULARIZADO") {
          updated.valor_saldo = 0;
          updated.meses_atraso = 0;
          updated.dividasQuotasOrdinarias = [];
          updated.dividasQuotasExtras = [];
        }
        return updated;
      }
      return s;
    }));
  };

  // --- Gestão dos itens de dívida discriminados (Quotas Ordinárias) ---
  const handleAddPeriodoQuotaOrdinaria = (id_fracao: string) => {
    const fracaoRef = predioFracoes.find(f => f.id_fracao === id_fracao);
    const novoPeriodo: DividaQuotaOrdinariaPeriodo = {
      id: "qord-" + Date.now(),
      data_inicio: dataAbertura,
      valor_quota_mensal: fracaoRef ? calcularQuotaMensalFracao(fracaoRef) : 0,
      meses_em_divida: diffMesesAteHoje(dataAbertura)
    };
    setSaldosFracoes(prev => prev.map(s => {
      if (s.id_fracao !== id_fracao) return s;
      const updated = { ...s, dividasQuotasOrdinarias: [...s.dividasQuotasOrdinarias, novoPeriodo] };
      updated.valor_saldo = calcularTotalDivida(updated);
      return updated;
    }));
  };

  const handleUpdatePeriodoQuotaOrdinaria = (id_fracao: string, id_periodo: string, fields: Partial<DividaQuotaOrdinariaPeriodo>) => {
    setSaldosFracoes(prev => prev.map(s => {
      if (s.id_fracao !== id_fracao) return s;
      const updated = {
        ...s,
        dividasQuotasOrdinarias: s.dividasQuotasOrdinarias.map(p => {
          if (p.id !== id_periodo) return p;
          const proximo = { ...p, ...fields };
          // A data "Desde" mudou e não foi o próprio campo de meses a ser
          // editado diretamente — recalcula os meses em dívida até hoje,
          // mas o utilizador continua livre para os corrigir a seguir.
          if (fields.data_inicio !== undefined && fields.meses_em_divida === undefined) {
            proximo.meses_em_divida = diffMesesAteHoje(proximo.data_inicio);
          }
          return proximo;
        })
      };
      updated.valor_saldo = calcularTotalDivida(updated);
      return updated;
    }));
  };

  const handleRemovePeriodoQuotaOrdinaria = (id_fracao: string, id_periodo: string) => {
    setSaldosFracoes(prev => prev.map(s => {
      if (s.id_fracao !== id_fracao) return s;
      const updated = { ...s, dividasQuotasOrdinarias: s.dividasQuotasOrdinarias.filter(p => p.id !== id_periodo) };
      updated.valor_saldo = calcularTotalDivida(updated);
      return updated;
    }));
    // Elimina já o aviso real correspondente, caso já tivesse sido gravado
    // numa passagem anterior por este modal — para não ficar órfão.
    const idAvisoReal = `aviso-inicial-${id_periodo}`;
    deleteAvisoFromSupabase(idAvisoReal).catch(console.error);
    setAvisos(prev => prev.filter(a => a.id_aviso !== idAvisoReal));
  };

  // --- Gestão dos itens de dívida discriminados (Quotas Extra / Obras) ---
  const handleAddDividaQuotaExtra = (id_fracao: string) => {
    const novoItem: DividaQuotaExtraItem = {
      id: "qext-" + Date.now(),
      id_obra: undefined,
      descricao: "",
      data_inicio_pagamentos: dataAbertura,
      data_fim_pagamentos: dataAbertura,
      valor_mensal: 0,
      valor_total: 0
    };
    setSaldosFracoes(prev => prev.map(s => {
      if (s.id_fracao !== id_fracao) return s;
      const updated = { ...s, dividasQuotasExtras: [...s.dividasQuotasExtras, novoItem] };
      updated.valor_saldo = calcularTotalDivida(updated);
      return updated;
    }));
  };

  // Ao escolher uma obra real, pré-preenche a descrição e calcula a quota
  // desta fração a partir do custo total da obra e da sua permilagem —
  // reaproveita o valor já calculado na adjudicação, em vez de o admin ter
  // de o voltar a calcular à mão.
  const handleSelecionarObraDividaExtra = (id_fracao: string, id_periodo: string, id_obra: string) => {
    const obra = obrasExtra.find(o => o.id === id_obra);
    const fracao = predioFracoes.find(f => f.id_fracao === id_fracao);
    if (!obra || !fracao) {
      handleUpdateDividaQuotaExtra(id_fracao, id_periodo, { id_obra });
      return;
    }
    const custoFracao = obra.valoresPorFracao?.[id_fracao] ?? (obra.custoTotal * (fracao.permilagem || 0)) / 1000;
    handleUpdateDividaQuotaExtra(id_fracao, id_periodo, {
      id_obra,
      descricao: obra.descricao,
      valor_total: Math.round(custoFracao * 100) / 100
    });
  };

  const handleUpdateDividaQuotaExtra = (id_fracao: string, id_item: string, fields: Partial<DividaQuotaExtraItem>) => {
    setSaldosFracoes(prev => prev.map(s => {
      if (s.id_fracao !== id_fracao) return s;
      const updated = { ...s, dividasQuotasExtras: s.dividasQuotasExtras.map(e => e.id === id_item ? { ...e, ...fields } : e) };
      updated.valor_saldo = calcularTotalDivida(updated);
      return updated;
    }));
  };

  const handleRemoveDividaQuotaExtra = (id_fracao: string, id_item: string) => {
    setSaldosFracoes(prev => prev.map(s => {
      if (s.id_fracao !== id_fracao) return s;
      const updated = { ...s, dividasQuotasExtras: s.dividasQuotasExtras.filter(e => e.id !== id_item) };
      updated.valor_saldo = calcularTotalDivida(updated);
      return updated;
    }));
    const idAvisoReal = `aviso-inicial-${id_item}`;
    deleteAvisoFromSupabase(idAvisoReal).catch(console.error);
    setAvisos(prev => prev.filter(a => a.id_aviso !== idAvisoReal));
  };

  // --- Comprovativo da transição: prova documental de cada dívida (ex:
  // balancete/extrato entregue pela administração anterior) — arquivada a
  // sério no Supabase Storage e no Arquivo Digital, não só um nome de
  // ficheiro solto no formulário.
  const [aArquivarComprovativoId, setAArquivarComprovativoId] = useState<string | null>(null);

  const handleUploadComprovativo = async (
    id_fracao: string,
    tipoItem: "ordinaria" | "extra",
    id_item: string,
    file: File
  ) => {
    setAArquivarComprovativoId(id_item);
    try {
      const fracao = predioFracoes.find(f => f.id_fracao === id_fracao);
      const ano = new Date().getFullYear().toString();
      const caminho = `${ano}/SaldosIniciais/${predio.id_predio}/${id_fracao}/${Date.now()}-${file.name}`;
      const urlReal = await uploadDocumentoToStorage(file, caminho);
      if (!urlReal) {
        alert("Não foi possível carregar o comprovativo para o Supabase Storage.");
        return;
      }
      const comprovativo = { nome: file.name, caminho: urlReal };

      setSaldosFracoes(prev => prev.map(s => {
        if (s.id_fracao !== id_fracao) return s;
        if (tipoItem === "ordinaria") {
          return { ...s, dividasQuotasOrdinarias: s.dividasQuotasOrdinarias.map(p => p.id === id_item ? { ...p, comprovativo } : p) };
        }
        return { ...s, dividasQuotasExtras: s.dividasQuotasExtras.map(e => e.id === id_item ? { ...e, comprovativo } : e) };
      }));

      if (setDocumentos) {
        const novoDoc: Documento = {
          id_doc: "doc-saldo-inicial-" + Date.now(),
          id_predio: predio.id_predio,
          nome: file.name,
          tipo: file.type.includes("pdf") ? "PDF" : "Documento",
          data_upload: new Date().toISOString().split("T")[0],
          tamanho: `${(file.size / 1024).toFixed(0)} KB`,
          categoria: "Financeiro",
          tema: "Saldos Iniciais / Transição",
          sub_pasta: fracao?.fracao_nome || id_fracao,
          descricao: `Comprovativo da dívida transitada — Fração ${fracao?.fracao_nome || id_fracao}`,
          visibilidade: "Administração",
          autor: loggedUser.nome,
          ano,
          caminho: urlReal,
          arquivado: true,
          data_arquivamento: new Date().toISOString().split("T")[0],
          tipo_arquivo: "documento",
          relevancia_perfis: ["ADMIN", "EMPRESA_GESTORA"]
        };
        setDocumentos(prev => [novoDoc, ...prev]);
        saveDocumentoToSupabase(novoDoc).catch(console.error);
      }
    } finally {
      setAArquivarComprovativoId(null);
    }
  };

  // --- PASSO 3: MOVIMENTOS HISTÓRICOS DE TRANSIÇÃO (OPCIONAL) ---
  const [movimentosHistoricos, setMovimentosHistoricos] = useState<MovimentoHistoricoTransitor[]>([]);

  // Form para adicionar movimento histórico
  const [novoHistDesc, setNovoHistDesc] = useState("");
  const [novoHistCat, setNovoHistCat] = useState("Manutenção");
  const [novoHistTipo, setNovoHistTipo] = useState<"RECEITA" | "DESPESA">("DESPESA");
  const [novoHistValor, setNovoHistValor] = useState("");
  const [novoHistData, setNovoHistData] = useState("2026-07-15");
  const [novoHistContaId, setNovoHistContaId] = useState<string>(contasArranque[0]?.id_conta || "");

  const handleAddMovimentoHistorico = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoHistDesc || !novoHistValor) return alert("Preencha descrição e valor.");
    const targetConta = contasArranque.find(c => c.id_conta === novoHistContaId) || contasArranque[0];
    const novo: MovimentoHistoricoTransitor = {
      id: "hist-" + Date.now(),
      data: novoHistData,
      descricao: novoHistDesc,
      categoria: novoHistCat,
      tipo: novoHistTipo,
      valor: parseValorMonetario(novoHistValor),
      id_conta: targetConta ? targetConta.id_conta : "conta-ordem-" + predio.id_predio,
      nome_conta: targetConta ? targetConta.nome : "Conta à Ordem"
    };
    setMovimentosHistoricos([novo, ...movimentosHistoricos]);
    setNovoHistDesc("");
    setNovoHistValor("");
  };

  const handleRemoveMovimentoHistorico = (id: string) => {
    setMovimentosHistoricos(prev => prev.filter(m => m.id !== id));
  };

  // --- ANEXO DE EXTRATO BANCÁRIO & RECONHECIMENTO POR IA ---
  // Em vez de transcrever manualmente cada movimento do período de
  // transição, o administrador pode anexar o extrato bancário real
  // (PDF, foto, Excel, CSV ou TXT exportado do homebanking) e a IA
  // devolve os movimentos já identificados, para rever/corrigir antes
  // de confirmar — tal como já acontece para comprovativos avulsos.
  const [extratoContaId, setExtratoContaId] = useState<string>("");
  const [extratoFicheiros, setExtratoFicheiros] = useState<File[]>([]);
  const [analisandoExtrato, setAnalisandoExtrato] = useState(false);
  const [erroExtrato, setErroExtrato] = useState<string | null>(null);
  const extratoFileRef = React.useRef<HTMLInputElement>(null);

  const lerFicheiroComoBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const lerFicheiroComoTexto = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // Converte uma folha Excel (.xlsx/.xls) para texto tabular simples (CSV),
  // para a IA conseguir ler tal como leria um extrato colado em texto.
  const lerFicheiroExcelComoTexto = async (file: File): Promise<string> => {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    return workbook.SheetNames.map((nomeFolha) => {
      const folha = workbook.Sheets[nomeFolha];
      const csv = XLSX.utils.sheet_to_csv(folha);
      return `--- Folha: ${nomeFolha} ---\n${csv}`;
    }).join("\n\n");
  };

  const handleAnalisarExtratoIA = async () => {
    if (!extratoContaId) {
      setErroExtrato("Selecione primeiro a conta bancária a que este extrato pertence.");
      return;
    }
    if (extratoFicheiros.length === 0) {
      setErroExtrato("Anexe pelo menos um ficheiro (PDF, foto, Excel, CSV ou TXT).");
      return;
    }
    setAnalisandoExtrato(true);
    setErroExtrato(null);
    try {
      const anexos: { base64: string; mimeType: string }[] = [];
      const textosExtrato: string[] = [];

      for (const file of extratoFicheiros) {
        const nomeExt = file.name.toLowerCase();
        if (nomeExt.endsWith(".xlsx") || nomeExt.endsWith(".xls")) {
          textosExtrato.push(await lerFicheiroExcelComoTexto(file));
        } else if (nomeExt.endsWith(".csv") || nomeExt.endsWith(".txt") || file.type === "text/csv" || file.type === "text/plain") {
          textosExtrato.push(await lerFicheiroComoTexto(file));
        } else {
          const base64 = await lerFicheiroComoBase64(file);
          anexos.push({ base64, mimeType: file.type || "application/pdf" });
        }
      }

      const resp = await fetch("/api/ai?acao=extrair-movimentos-historicos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anexos,
          textoExtrato: textosExtrato.length > 0 ? textosExtrato.join("\n\n") : undefined
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data?.error || "Não foi possível analisar o extrato.");
      }

      const contaSelecionada = contasArranque.find(c => c.id_conta === extratoContaId);
      const novosMovimentos: MovimentoHistoricoTransitor[] = (data.movimentos || []).map((m: any, idx: number) => ({
        id: `hist-ia-${Date.now()}-${idx}`,
        data: m.data || new Date().toISOString().split("T")[0],
        descricao: m.descricao || "Movimento sem descrição",
        categoria: m.categoria || "Outro",
        tipo: String(m.tipo || "").toLowerCase().startsWith("rec") ? "RECEITA" : "DESPESA",
        valor: Math.abs(Number(m.valor) || 0),
        id_conta: extratoContaId,
        nome_conta: contaSelecionada?.nome
      }));

      if (novosMovimentos.length === 0) {
        setErroExtrato("A IA não identificou nenhum movimento neste ficheiro. Pode lançá-los manualmente abaixo.");
      } else {
        setMovimentosHistoricos(prev => [...novosMovimentos, ...prev]);
        setExtratoFicheiros([]);
        if (extratoFileRef.current) extratoFileRef.current.value = "";
      }
    } catch (err: any) {
      setErroExtrato(err?.message || "Erro ao analisar o extrato.");
    } finally {
      setAnalisandoExtrato(false);
    }
  };

  // --- TOTAIS E CONTADORES CALCULADOS DINAMICAMENTE ---
  const totalBancosCaixa = useMemo(() => {
    return contasArranque.reduce((acc, curr) => acc + (Number(curr.saldo) || 0), 0);
  }, [contasArranque]);

  const totalOrdem = useMemo(() => {
    return contasArranque
      .filter(c => c.categoriaConta === "ORDEM")
      .reduce((acc, curr) => acc + (Number(curr.saldo) || 0), 0);
  }, [contasArranque]);

  const totalReserva = useMemo(() => {
    return contasArranque
      .filter(c => c.categoriaConta === "POUPANCA")
      .reduce((acc, curr) => acc + (Number(curr.saldo) || 0), 0);
  }, [contasArranque]);

  const totalIntervencoes = useMemo(() => {
    return contasArranque
      .filter(c => c.categoriaConta === "INTERVENCOES")
      .reduce((acc, curr) => acc + (Number(curr.saldo) || 0), 0);
  }, [contasArranque]);

  const totalCaixa = useMemo(() => {
    return contasArranque
      .filter(c => c.categoriaConta === "CAIXA")
      .reduce((acc, curr) => acc + (Number(curr.saldo) || 0), 0);
  }, [contasArranque]);

  const totalDividasReceber = useMemo(() => {
    return saldosFracoes
      .filter(s => s.tipo_saldo === "DIVIDA")
      .reduce((acc, curr) => acc + curr.valor_saldo, 0);
  }, [saldosFracoes]);

  const totalCreditosFracoes = useMemo(() => {
    return saldosFracoes
      .filter(s => s.tipo_saldo === "CREDITO")
      .reduce((acc, curr) => acc + curr.valor_saldo, 0);
  }, [saldosFracoes]);

  const ativoLiquidoAbertura = useMemo(() => {
    return (totalBancosCaixa + totalDividasReceber) - totalCreditosFracoes;
  }, [totalBancosCaixa, totalDividasReceber, totalCreditosFracoes]);

  // --- FINALIZAR E GRAVAR NA PLATAFORMA ---
  const handleGravarConfiguracaoArranque = () => {
    triggerSendReaction("email", "A inicializar todas as contas bancárias, saldos de intervenção e mapa de arranque...");

    // 0. Gravar a Data Oficial de Abertura/Transição como a data de início
    // de gestão do prédio — o cron mensal de emissão de quotas passa a
    // respeitá-la, nunca gerando quotas de meses anteriores a este arranque.
    if (dataAbertura && dataAbertura !== predio.data_inicio_gestao) {
      const predioAtualizado: Predio = { ...predio, data_inicio_gestao: dataAbertura };
      savePredioToSupabase(predioAtualizado).catch(console.error);
      onUpdatePredio?.(predioAtualizado);
    }

    // 1. Criar ou Atualizar todas as contas configuradas
    const novasContas: Conta[] = contasArranque.map(ca => ({
      id_conta: ca.id_conta,
      id_predio: predio.id_predio,
      banco: ca.banco,
      iban: ca.iban,
      tipo: ca.tipo,
      saldo: Number(ca.saldo) || 0,
      is_principal: ca.is_principal ?? false
    }));

    setContas(novasContas);
    novasContas.forEach(c => saveContaToSupabase(c).catch(console.error));

    // 2. Criar Avisos de Débito reais e discriminados para as Frações com
    // Dívida Inicial — reaproveita construirAvisosDividaFracao (mesma
    // função usada ao gravar de imediato ao fechar o modal de dívidas),
    // para nunca haver duas fórmulas a divergir. Sendo avisos reais (estado
    // "Pendente"), entram automaticamente nos cálculos de dívida pendente
    // já usados em Contencioso Jurídico, Dashboard e Relatórios.
    const novosAvisos: Aviso[] = [];
    saldosFracoes.forEach((sf) => {
      if (sf.tipo_saldo !== "DIVIDA") return;
      const avisosFracao = construirAvisosDividaFracao(sf);
      if (avisosFracao.length > 0) {
        novosAvisos.push(...avisosFracao);
        return;
      }
      // Compatibilidade: fração marcada como DIVIDA mas sem nenhum item
      // discriminado (admin não chegou a abrir o modal) — mantém o
      // comportamento anterior como resguardo, para não perder o registo.
      if (sf.valor_saldo > 0) {
        const fracaoRef = predioFracoes.find(f => f.id_fracao === sf.id_fracao);
        novosAvisos.push({
          id_aviso: "aviso-inicial-" + sf.id_fracao,
          id_predio: predio.id_predio,
          id_fracao: sf.id_fracao,
          tipo: "Dívida Anterior / Transição",
          data: dataAbertura,
          vencimento: dataAbertura,
          descricao: `Saldo devedor de transição (${sf.meses_atraso} meses em atraso da administração anterior). ${sf.observacoes}`,
          valor: sf.valor_saldo,
          estado: "Pendente",
          proprietario_nome: fracaoRef?.proprietario?.nome,
          proprietario_nif: fracaoRef?.proprietario?.nif
        });
      }
    });

    if (novosAvisos.length > 0) {
      setAvisos(prev => [...novosAvisos, ...prev]);
      saveAvisosToSupabase(novosAvisos).catch(console.error);
    }

    // 3. Criar Movimentos de Abertura de Saldo para cada conta
    const novosMovs: Movimento[] = contasArranque.map((ca, idx) => ({
      id_mov: `mov-abertura-${ca.id_conta}-${Date.now() + idx}`,
      id_predio: predio.id_predio,
      id_conta: ca.id_conta,
      data: dataAbertura,
      tipo: "RECEITA",
      valor: Number(ca.saldo) || 0,
      descricao: `Saldo Inicial de Abertura / Transição - ${ca.nome}`,
      categoria: ca.categoriaConta === "POUPANCA" 
        ? "Fundo de Reserva" 
        : ca.categoriaConta === "INTERVENCOES"
        ? "Quotas Extraordinárias / Intervenções"
        : "Saldo de Abertura"
    }));

    // Inserir os movimentos históricos configurados
    movimentosHistoricos.forEach((mh, i) => {
      novosMovs.push({
        id_mov: "mov-hist-" + (Date.now() + 100 + i),
        id_predio: predio.id_predio,
        id_conta: mh.id_conta || contasArranque[0]?.id_conta,
        data: mh.data,
        tipo: mh.tipo,
        valor: mh.valor,
        descricao: mh.descricao,
        categoria: mh.categoria
      });
    });

    setMovements(prev => [...novosMovs, ...prev]);
    novosMovs.forEach(m => saveMovimentoToSupabase(m).catch(console.error));
    registarLogAuditoria(
      "Financeira",
      "Configurou o arranque inicial do condomínio (contas, saldos e dívidas transitadas)",
      predio.id_predio,
      loggedUser,
      `${novasContas.length} contas, ${novosAvisos.length} avisos de dívida, ${novosMovs.length} movimentos de abertura`
    );

    setTimeout(() => {
      triggerSendReaction("email", "✅ Arranque Inicial e Contas (incluindo Contas de Intervenção) configuradas com sucesso!");
      if (onConcluir) onConcluir();
    }, 800);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* BANNER DE CABEÇALHO */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-5 sm:p-7 rounded-2xl shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 shadow-inner">
              <Sliders className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Assistente de Arranque Inicial & Transição de Gestão
                <span className="text-xs px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 font-bold rounded-full border border-emerald-500/30">
                  Balanço de Abertura
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Defina os saldos bancários de abertura, as dívidas transitadas por fração e o histórico inicial de movimentos sem fricção.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 bg-slate-950/60 px-4 py-2 rounded-xl border border-slate-800">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Ativo Líquido de Arranque</span>
              <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">
                {ativoLiquidoAbertura.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €
              </span>
            </div>
          </div>
        </div>

        {/* STEPPER INDICATOR */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-3 mt-6 pt-4 border-t border-slate-800">
          {[
            { step: 1, label: "1. Saldos Bancários", desc: "Contas & Caixa" },
            { step: 2, label: "2. Dívidas por Fração", desc: "Mapa de Transição" },
            { step: 3, label: "3. Movimentos Anteriores", desc: "Histórico Orçamental" },
            { step: 4, label: "4. Balanço & Conclusão", desc: "Ativação do Edifício" }
          ].map((s) => {
            const isActive = currentStep === s.step;
            const isCompleted = currentStep > s.step;
            return (
              <button
                key={s.step}
                onClick={() => setCurrentStep(s.step)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center space-x-2.5 ${
                  isActive
                    ? "bg-emerald-600 text-white font-black border-emerald-500 shadow-md ring-1 ring-emerald-400"
                    : isCompleted
                    ? "bg-slate-900/80 text-emerald-400 border-emerald-500/40"
                    : "bg-slate-950/40 text-slate-400 border-slate-800 hover:bg-slate-900/60"
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isActive ? "bg-white text-emerald-700" : isCompleted ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                }`}>
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : s.step}
                </span>
                <div className="min-w-0">
                  <span className="text-xs font-bold block truncate">{s.label}</span>
                  <span className="text-[9px] opacity-80 block truncate">{s.desc}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PASSO 1: DATA DE TRANSIÇÃO E SALDOS BANCÁRIOS (MULTI-CONTA & INTERVENÇÕES) */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-500" />
                Passo 1: Data de Início & Saldos Iniciais das Contas
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure todas as contas bancárias (Conta à Ordem, Fundo de Reserva / Depósito a Prazo e Contas específicas de Intervenção/Obras). Pode adicionar tantas contas quantas as existentes no condomínio.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-300 dark:border-emerald-800">
                {contasArranque.length} Contas Ativas
              </span>
            </div>
          </div>

          {/* DATA GERAL DE ARRANQUE */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Data Oficial de Abertura / Transição
              </label>
              <input
                type="date"
                value={dataAbertura}
                onChange={(e) => handleAlterarDataAbertura(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Data do extrato de transição ou início de mandato.{" "}
                {aGuardarDataAbertura ? "A guardar…" : predio.data_inicio_gestao === dataAbertura ? "✓ Guardada." : ""}
              </span>
            </div>

            <div className="sm:col-span-2 flex flex-col justify-center">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Regras de Gestão Multi-Conta CondoManager
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                As contas abertas para intervenções ou obras ficam segregadas no balancete e são debitadas exclusivamente para as respetivas despesas de reparação. Os contadores abaixo adaptam-se em tempo real a todas as contas adicionadas.
              </p>
            </div>
          </div>

          {/* CONTADORES DE SALDOS ADAPTATIVOS — Intervenções & Caixa só aparecem
              se houver mesmo contas desse tipo (hoje em dia raramente há caixa
              de numerário, é tudo eletrónico) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Bancos & Caixa</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                {totalBancosCaixa.toFixed(2)} €
              </span>
              <span className="text-[9.5px] text-slate-500 mt-0.5 block">{contasArranque.length} contas somadas</span>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40">
              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase block">Conta(s) à Ordem</span>
              <span className="text-base font-black text-indigo-700 dark:text-indigo-300 font-mono mt-0.5 block">
                {totalOrdem.toFixed(2)} €
              </span>
              <span className="text-[9.5px] text-slate-500 mt-0.5 block">Gestão corrente</span>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block">Fundo de Reserva</span>
              <span className="text-base font-black text-emerald-700 dark:text-emerald-300 font-mono mt-0.5 block">
                {totalReserva.toFixed(2)} €
              </span>
              <span className="text-[9.5px] text-slate-500 mt-0.5 block">FCR legal (Art. 4º)</span>
            </div>

            {contasArranque.some(c => c.categoriaConta === "INTERVENCOES") && (
              <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase block">Intervenções & Obras</span>
                <span className="text-base font-black text-amber-700 dark:text-amber-300 font-mono mt-0.5 block">
                  {totalIntervencoes.toFixed(2)} €
                </span>
                <span className="text-[9.5px] text-slate-500 mt-0.5 block">Contas de intervenção</span>
              </div>
            )}

            {contasArranque.some(c => c.categoriaConta === "CAIXA") && (
              <div className="p-3.5 rounded-xl bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Caixa de Numerário</span>
                <span className="text-base font-black text-slate-700 dark:text-slate-200 font-mono mt-0.5 block">
                  {totalCaixa.toFixed(2)} €
                </span>
                <span className="text-[9.5px] text-slate-500 mt-0.5 block">Dinheiro físico</span>
              </div>
            )}
          </div>

          {/* LISTA EDITÁVEL DE TODAS AS CONTAS DO CONDOMÍNIO */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Landmark className="h-4 w-4 text-emerald-500" />
                Discriminação de Contas Bancárias & de Intervenção
              </h3>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleAddNovaConta("POUPANCA")}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/50 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Depósito a Prazo / Fundo de Reserva</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddNovaConta("INTERVENCOES")}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700/50 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Conta Intervenções / Obras</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddNovaConta("ORDEM")}
                  className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700/50 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Outra Conta à Ordem</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contasArranque.length === 0 ? (
                <div className="col-span-1 md:col-span-2 p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Sem Contas Bancárias de Arranque Ativas</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                      Adicione as contas oficiais do condomínio (Conta à Ordem, FCR, etc.) para definir os respetivos saldos de abertura.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddNovaConta("ORDEM")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Adicionar Conta à Ordem</span>
                  </button>
                </div>
              ) : (
                contasArranque.map((conta) => {
                const isIntervencao = conta.categoriaConta === "INTERVENCOES";
                const isPoupanca = conta.categoriaConta === "POUPANCA";
                const isCaixa = conta.categoriaConta === "CAIXA";

                return (
                  <div 
                    key={conta.id_conta}
                    className={`p-4 rounded-2xl border transition-all ${
                      isIntervencao
                        ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60"
                        : isPoupanca
                        ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60"
                        : isCaixa
                        ? "bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800"
                        : "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`p-2 rounded-xl text-xs font-bold ${
                          isIntervencao
                            ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                            : isPoupanca
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                            : isCaixa
                            ? "bg-slate-500/20 text-slate-700 dark:text-slate-300"
                            : "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                        }`}>
                          {isIntervencao ? <Hammer className="h-4 w-4" /> : isPoupanca ? <ShieldCheck className="h-4 w-4" /> : isCaixa ? <DollarSign className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                        </span>
                        <div>
                          <input
                            type="text"
                            value={conta.nome}
                            onChange={(e) => handleUpdateContaArranque(conta.id_conta, { nome: e.target.value })}
                            className="text-xs font-black text-slate-800 dark:text-white bg-transparent border-b border-transparent hover:border-slate-400 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 rounded px-1 py-0.5 w-full"
                          />
                          <span className="text-[10px] text-slate-400 block px-1">
                            {conta.is_principal ? "Conta Principal à Ordem" : isIntervencao ? "Conta Afeta a Obras / Intervenções" : conta.tipo}
                          </span>
                        </div>
                      </div>

                      {!conta.is_principal && (
                        <button
                          type="button"
                          onClick={() => handleRemoveConta(conta.id_conta)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar esta conta"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Banco / Entidade</label>
                        <input
                          type="text"
                          value={conta.banco}
                          onChange={(e) => handleUpdateContaArranque(conta.id_conta, { banco: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Saldo de Abertura (€)</label>
                        <div className="relative">
                          <MoneyInput
                            value={conta.saldo}
                            onChange={(valor) => handleUpdateContaArranque(conta.id_conta, { saldo: valor })}
                            placeholder="0,00"
                            className="w-full pl-2.5 pr-6 py-1.5 text-xs font-black font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          />
                          <span className="absolute right-2.5 top-1.5 text-xs font-bold text-slate-400">€</span>
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">IBAN / Identificador de Conta</label>
                        <input
                          type="text"
                          value={conta.iban}
                          onChange={(e) => handleUpdateContaArranque(conta.id_conta, { iban: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[11px]"
                        />
                      </div>

                      {conta.finalidade !== undefined && (
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Finalidade / Obra Específica</label>
                          <input
                            type="text"
                            value={conta.finalidade}
                            onChange={(e) => handleUpdateContaArranque(conta.id_conta, { finalidade: e.target.value })}
                            placeholder="Ex: Intervenção na fachada norte, substituição da caldeira..."
                            className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              }))}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all flex items-center space-x-2 shadow-md cursor-pointer hover:scale-105"
            >
              <span>Avançar para Passo 2 (Dívidas por Fração)</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASSO 2: MAPA DE SALDOS INICIAIS POR FRAÇÃO (DÍVIDAS ANTERIORES) */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                Passo 2: Mapa de Saldos Iniciais por Fração
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Indique para cada condómino se tem dívidas transitadas, créditos adiantados ou situação regularizada.
              </p>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <div className="px-3 py-1 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 font-bold">
                Dívidas a Receber: {totalDividasReceber.toFixed(2)} €
              </div>
              <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800 font-bold">
                Créditos: {totalCreditosFracoes.toFixed(2)} €
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] font-extrabold">
                  <th className="p-3">Fração / Condómino</th>
                  <th className="p-3">Estado Inicial</th>
                  <th className="p-3">Valor do Saldo (€)</th>
                  <th className="p-3">Discriminação da Dívida</th>
                  <th className="p-3">Observações / Detalhe da Transição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {saldosFracoes.map((sf) => {
                  const temDetalhe = sf.dividasQuotasOrdinarias.length > 0 || sf.dividasQuotasExtras.length > 0;
                  return (
                    <tr key={sf.id_fracao} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-medium">
                        <span className="font-bold text-slate-900 dark:text-white block">{sf.fracao_nome}</span>
                        <span className="text-[10px] text-slate-400">{sf.proprietario_nome}</span>
                      </td>

                      <td className="p-3">
                        <select
                          value={sf.tipo_saldo}
                          onChange={(e) => {
                            const novoTipo = e.target.value as SaldoInicialFracao["tipo_saldo"];
                            handleUpdateSaldoFracao(sf.id_fracao, { tipo_saldo: novoTipo });
                            if (novoTipo === "DIVIDA") setModalDividaFracaoId(sf.id_fracao);
                          }}
                          className={`px-2.5 py-1.5 text-xs rounded-xl font-bold border transition-colors ${
                            sf.tipo_saldo === "DIVIDA"
                              ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800"
                              : sf.tipo_saldo === "CREDITO"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                              : "bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <option value="REGULARIZADO">Regularizado (0.00€)</option>
                          <option value="DIVIDA">⚠️ Com Dívida Anterior</option>
                          <option value="CREDITO">✨ Crédito / Adiantado</option>
                        </select>
                      </td>

                      <td className="p-3">
                        {sf.tipo_saldo === "CREDITO" ? (
                          <div className="relative w-28">
                            <MoneyInput
                              value={sf.valor_saldo}
                              onChange={(valor) => handleUpdateSaldoFracao(sf.id_fracao, { valor_saldo: valor })}
                              className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                            />
                            <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-bold">€</span>
                          </div>
                        ) : sf.tipo_saldo === "DIVIDA" ? (
                          <span className="font-mono font-black text-red-600 dark:text-red-400">{sf.valor_saldo.toFixed(2)} €</span>
                        ) : (
                          <span className="text-slate-400 font-mono font-medium">0,00 €</span>
                        )}
                      </td>

                      <td className="p-3">
                        {sf.tipo_saldo === "DIVIDA" ? (
                          <button
                            type="button"
                            onClick={() => setModalDividaFracaoId(sf.id_fracao)}
                            className={`px-2.5 py-1.5 text-[11px] rounded-xl font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                              temDetalhe
                                ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800"
                                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 animate-pulse"
                            }`}
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                            {temDetalhe
                              ? `${sf.dividasQuotasOrdinarias.length + sf.dividasQuotasExtras.length} dívida(s) — Editar`
                              : "Configurar Dívidas"}
                          </button>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="p-3">
                        <input
                          type="text"
                          value={sf.observacoes}
                          onChange={(e) => handleUpdateSaldoFracao(sf.id_fracao, { observacoes: e.target.value })}
                          placeholder="Notas da administração anterior..."
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
            <Scale className="h-3 w-3" />
            Cada dívida configurada aqui gera avisos reais por fração — aparecem automaticamente em Financeiro (Emissão de Quotas) e são cruzados com a área Jurídica (Contencioso) para eventuais processos, tal como qualquer outra quota em atraso.
          </p>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar aos Saldos Bancários</span>
            </button>

            <button
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all flex items-center space-x-2 shadow-md cursor-pointer hover:scale-105"
            >
              <span>Avançar para Passo 3 (Movimentos Anteriores)</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: DISCRIMINAÇÃO DE DÍVIDAS DA FRAÇÃO — em vez de um valor
          generalizado, permite compor a dívida real a partir de Quotas
          Ordinárias (vários períodos, porque o valor pode ter oscilado) e
          Quotas Extraordinárias (ligadas a obras reais adjudicadas), cada
          item totalmente editável e eliminável. */}
      {modalDividaFracaoId && (() => {
        const sf = saldosFracoes.find(s => s.id_fracao === modalDividaFracaoId);
        if (!sf) return null;
        const obrasComCotaExtra = obrasExtra.filter(o => o.necessitaCotaExtra);
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[88vh] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
              <div className="bg-slate-900 dark:bg-slate-950 px-6 py-4 text-white flex justify-between items-center shrink-0">
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Scale className="h-4 w-4 text-red-400" />
                    Discriminação da Dívida — Fração {sf.fracao_nome}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">{sf.proprietario_nome} · Total: <strong className="text-red-400">{sf.valor_saldo.toFixed(2)} €</strong></p>
                </div>
                <button onClick={() => setModalDividaFracaoId(null)} className="text-slate-300 hover:text-white cursor-pointer p-1">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5 space-y-6 overflow-y-auto">
                {/* DÍVIDA 1: QUOTAS ORDINÁRIAS MENSAIS */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Wallet className="h-4 w-4 text-indigo-500" />
                      Dívida 1 — Quotas Ordinárias Mensais
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleAddPeriodoQuotaOrdinaria(sf.id_fracao)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700/50 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" /> Adicionar Período
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">Pode adicionar vários períodos se o valor da quota mudou ao longo do tempo (ex: um valor até certa data, outro depois).</p>

                  {sf.dividasQuotasOrdinarias.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic py-2">Sem períodos de quota ordinária em dívida.</p>
                  ) : (
                    <div className="space-y-2">
                      {sf.dividasQuotasOrdinarias.map((p) => {
                        const valorFCR = Math.round(p.valor_quota_mensal * 0.1 * 100) / 100;
                        const valorOrdinaria = Math.round((p.valor_quota_mensal - valorFCR) * 100) / 100;
                        const totalPeriodo = Math.round(p.valor_quota_mensal * p.meses_em_divida * 100) / 100;
                        return (
                          <div key={p.id} className="p-3 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-end">
                            <div className="col-span-2 sm:col-span-1">
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Desde</label>
                              <input
                                type="date"
                                value={p.data_inicio}
                                onChange={(e) => handleUpdatePeriodoQuotaOrdinaria(sf.id_fracao, p.id, { data_inicio: e.target.value })}
                                className="w-full px-2 py-1.5 text-[11px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Quota Mensal Total</label>
                              <MoneyInput
                                value={p.valor_quota_mensal}
                                onChange={(valor) => handleUpdatePeriodoQuotaOrdinaria(sf.id_fracao, p.id, { valor_quota_mensal: valor })}
                                placeholder="0,00"
                                className="w-full px-2 py-1.5 text-[11px] font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Meses em Dívida</label>
                              <input
                                type="number"
                                min="1"
                                max="120"
                                value={p.meses_em_divida || 1}
                                onChange={(e) => handleUpdatePeriodoQuotaOrdinaria(sf.id_fracao, p.id, { meses_em_divida: parseInt(e.target.value) || 1 })}
                                className="w-full px-2 py-1.5 text-[11px] text-center font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Ordinária / FCR</label>
                              <p className="text-[10px] font-mono text-slate-600 dark:text-slate-300 leading-tight">{valorOrdinaria.toFixed(2)}€ + {valorFCR.toFixed(2)}€</p>
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Total</label>
                                <p className="text-xs font-mono font-black text-red-600 dark:text-red-400">{totalPeriodo.toFixed(2)}€</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemovePeriodoQuotaOrdinaria(sf.id_fracao, p.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer shrink-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="col-span-2 sm:col-span-5 pt-1.5 border-t border-indigo-200/60 dark:border-indigo-900/40 flex items-center gap-2">
                              <label className={`text-[10px] font-bold px-2 py-1 rounded cursor-pointer border flex items-center gap-1 ${aArquivarComprovativoId === p.id ? "bg-slate-100 text-slate-400 border-slate-200" : "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700 hover:bg-indigo-50"}`}>
                                <UploadCloud className="h-3 w-3" />
                                {aArquivarComprovativoId === p.id ? "A arquivar..." : "Anexar Comprovativo"}
                                <input
                                  type="file"
                                  className="hidden"
                                  disabled={aArquivarComprovativoId === p.id}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleUploadComprovativo(sf.id_fracao, "ordinaria", p.id, file);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                              {p.comprovativo && (
                                <a href={p.comprovativo.caminho} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-600 hover:underline flex items-center gap-1 truncate">
                                  <CheckCircle2 className="h-3 w-3 shrink-0" /> {p.comprovativo.nome}
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* DÍVIDA 2: QUOTAS EXTRAORDINÁRIAS (OBRAS) */}
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Hammer className="h-4 w-4 text-amber-500" />
                      Dívida 2 — Quotas Extraordinárias (Obras)
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleAddDividaQuotaExtra(sf.id_fracao)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700/50 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" /> Adicionar Dívida de Obra
                    </button>
                  </div>

                  {sf.dividasQuotasExtras.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic py-2">Sem quotas extraordinárias em dívida.</p>
                  ) : (
                    <div className="space-y-2">
                      {sf.dividasQuotasExtras.map((it) => (
                        <div key={it.id} className="p-3 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Obra Adjudicada</label>
                              <select
                                value={it.id_obra || ""}
                                onChange={(e) => handleSelecionarObraDividaExtra(sf.id_fracao, it.id, e.target.value)}
                                className="w-full px-2 py-1.5 text-[11px] rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-950 font-bold"
                              >
                                <option value="">— Sem ligação a obra (valor manual) —</option>
                                {obrasComCotaExtra.map(o => (
                                  <option key={o.id} value={o.id}>{o.descricao} ({o.custoTotal.toFixed(2)}€)</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Descrição</label>
                              <input
                                type="text"
                                value={it.descricao}
                                onChange={(e) => handleUpdateDividaQuotaExtra(sf.id_fracao, it.id, { descricao: e.target.value })}
                                placeholder="Ex: Reparação do telhado"
                                className="w-full px-2 py-1.5 text-[11px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-end">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Início Pagamentos</label>
                              <input
                                type="date"
                                value={it.data_inicio_pagamentos}
                                onChange={(e) => handleUpdateDividaQuotaExtra(sf.id_fracao, it.id, { data_inicio_pagamentos: e.target.value })}
                                className="w-full px-2 py-1.5 text-[11px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Fim Pagamentos</label>
                              <input
                                type="date"
                                value={it.data_fim_pagamentos}
                                onChange={(e) => handleUpdateDividaQuotaExtra(sf.id_fracao, it.id, { data_fim_pagamentos: e.target.value })}
                                className="w-full px-2 py-1.5 text-[11px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Valor Mensal</label>
                              <MoneyInput
                                value={it.valor_mensal}
                                onChange={(valor) => handleUpdateDividaQuotaExtra(sf.id_fracao, it.id, { valor_mensal: valor })}
                                placeholder="0,00"
                                className="w-full px-2 py-1.5 text-[11px] font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Valor Total</label>
                              <MoneyInput
                                value={it.valor_total}
                                onChange={(valor) => handleUpdateDividaQuotaExtra(sf.id_fracao, it.id, { valor_total: valor })}
                                placeholder="0,00"
                                className="w-full px-2 py-1.5 text-[11px] font-mono font-black text-red-600 dark:text-red-400 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveDividaQuotaExtra(sf.id_fracao, it.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer shrink-0 justify-self-end"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="pt-1.5 border-t border-amber-200/60 dark:border-amber-900/40 flex items-center gap-2">
                            <label className={`text-[10px] font-bold px-2 py-1 rounded cursor-pointer border flex items-center gap-1 ${aArquivarComprovativoId === it.id ? "bg-slate-100 text-slate-400 border-slate-200" : "bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50"}`}>
                              <UploadCloud className="h-3 w-3" />
                              {aArquivarComprovativoId === it.id ? "A arquivar..." : "Anexar Comprovativo"}
                              <input
                                type="file"
                                className="hidden"
                                disabled={aArquivarComprovativoId === it.id}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadComprovativo(sf.id_fracao, "extra", it.id, file);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            {it.comprovativo && (
                              <a href={it.comprovativo.caminho} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-600 hover:underline flex items-center gap-1 truncate">
                                <CheckCircle2 className="h-3 w-3 shrink-0" /> {it.comprovativo.nome}
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-950/60">
                <span className="text-xs text-slate-500">
                  Total desta fração: <strong className="text-red-600 dark:text-red-400 font-mono">{sf.valor_saldo.toFixed(2)} €</strong>
                </span>
                <button
                  disabled={aGravarDividaFracao}
                  onClick={async () => {
                    await persistirDividaFracaoImediatamente(sf.id_fracao);
                    setModalDividaFracaoId(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-xs transition-all cursor-pointer"
                >
                  {aGravarDividaFracao ? "A gravar..." : "Gravar e Fechar"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* PASSO 3: MOVIMENTOS ANTERIORES & HISTÓRICO ORÇAMENTAL */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                Passo 3: Movimentos Anteriores & Execução do Ano Corrente
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Adicione despesas ou receitas passadas e selecione a respetiva conta (Ordem, Reserva ou Conta de Intervenção) para que os balancetes fiquem 100% integrados.
              </p>
            </div>

            <span className="text-xs font-bold px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800">
              {movimentosHistoricos.length} Movimentos Registados
            </span>
          </div>

          {/* ANEXO DE EXTRATO BANCÁRIO & RECONHECIMENTO POR IA */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-300">Anexar Extrato Bancário & Reconhecer com IA</h3>
            </div>
            <p className="text-xs text-indigo-700/80 dark:text-indigo-300/70">
              Em vez de escrever cada movimento à mão, anexe o extrato bancário do período de transição (PDF, foto, Excel, CSV ou TXT exportado do homebanking) — a IA identifica os movimentos e pré-preenche a lista abaixo para reveres e corrigires antes de confirmar.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase mb-1">Conta a que pertence este extrato *</label>
                <select
                  value={extratoContaId}
                  onChange={(e) => setExtratoContaId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 font-bold"
                >
                  <option value="">— Selecione a conta —</option>
                  {contasArranque.map(c => (
                    <option key={c.id_conta} value={c.id_conta}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase mb-1">Ficheiro(s) do Extrato</label>
                <input
                  ref={extratoFileRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.txt,.xlsx,.xls"
                  onChange={(e) => setExtratoFicheiros(Array.from(e.target.files || []))}
                  className="w-full text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:font-bold file:cursor-pointer file:text-xs cursor-pointer text-indigo-800 dark:text-indigo-200"
                />
                {extratoFicheiros.length > 0 && (
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 block">{extratoFicheiros.length} ficheiro(s) selecionado(s)</span>
                )}
              </div>
            </div>

            {erroExtrato && (
              <p className="text-[10px] text-red-600 dark:text-red-400 font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {erroExtrato}</p>
            )}

            <button
              type="button"
              onClick={handleAnalisarExtratoIA}
              disabled={analisandoExtrato}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer flex items-center gap-2"
            >
              <UploadCloud className="h-4 w-4" />
              <span>{analisandoExtrato ? "A analisar com IA..." : "Analisar Extrato com IA"}</span>
            </button>
          </div>

          {/* FORMULÁRIO DE ADIÇÃO RÁPIDA (MANUAL) */}
          <form onSubmit={handleAddMovimentoHistorico} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-6 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data</label>
              <input
                type="date"
                value={novoHistData}
                onChange={(e) => setNovoHistData(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descrição do Movimento</label>
              <input
                type="text"
                placeholder="Ex: Seguro Multirriscos, Água SMAS, Obras Fachada"
                value={novoHistDesc}
                onChange={(e) => setNovoHistDesc(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Conta Afetada</label>
              <select
                value={novoHistContaId}
                onChange={(e) => setNovoHistContaId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
              >
                {contasArranque.map(c => (
                  <option key={c.id_conta} value={c.id_conta}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo</label>
              <select
                value={novoHistTipo}
                onChange={(e) => setNovoHistTipo(e.target.value as any)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
              >
                <option value="DESPESA">Despesa (-)</option>
                <option value="RECEITA">Receita (+)</option>
              </select>
            </div>
            <div className="flex items-end space-x-2">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Valor (€)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={novoHistValor}
                  onChange={(e) => setNovoHistValor(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </form>

          {/* LISTAGEM DE MOVIMENTOS HISTÓRICOS */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] font-extrabold">
                  <th className="p-2.5">Data</th>
                  <th className="p-2.5">Descrição</th>
                  <th className="p-2.5">Conta</th>
                  <th className="p-2.5">Categoria</th>
                  <th className="p-2.5">Tipo</th>
                  <th className="p-2.5 text-right">Valor</th>
                  <th className="p-2.5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {movimentosHistoricos.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-2.5 font-mono text-[11px] text-slate-500">{m.data}</td>
                    <td className="p-2.5 font-bold text-slate-800 dark:text-white">{m.descricao}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-300 font-medium">{m.nome_conta || "Conta Geral"}</td>
                    <td className="p-2.5 text-slate-500">{m.categoria}</td>
                    <td className="p-2.5">
                      <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                        m.tipo === "RECEITA" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                      }`}>
                        {m.tipo}
                      </span>
                    </td>
                    <td className={`p-2.5 text-right font-mono font-bold ${
                      m.tipo === "RECEITA" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"
                    }`}>
                      {m.tipo === "DESPESA" ? "-" : "+"}{m.valor.toFixed(2)} €
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => handleRemoveMovimentoHistorico(m.id)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar às Dívidas</span>
            </button>

            <button
              onClick={() => setCurrentStep(4)}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all flex items-center space-x-2 shadow-md cursor-pointer hover:scale-105"
            >
              <span>Avançar para Balanço & Conclusão</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASSO 4: BALANÇO CONSOLIDADO & ATIVAÇÃO DEFINITIVA */}
      {/* ========================================================================= */}
      {currentStep === 4 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                Passo 4: Resumo Consolidado do Balanço de Abertura
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Reveja todos os valores das {contasArranque.length} contas configuradas antes de ativar a gestão do condomínio no sistema.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-300 dark:border-emerald-800">
              Pronto a Ativar
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Saldo Total em Bancos / Caixa</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1 block">
                {totalBancosCaixa.toFixed(2)} €
              </span>
              <span className="text-[9.5px] text-slate-500 mt-1 block">{contasArranque.length} contas discriminadas</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Dívidas Transitadas a Cobrar</span>
              <span className="text-lg font-black text-red-600 dark:text-red-400 font-mono mt-1 block">
                +{totalDividasReceber.toFixed(2)} €
              </span>
              <span className="text-[9.5px] text-slate-500 mt-1 block">
                {saldosFracoes.filter(s => s.tipo_saldo === "DIVIDA").length} frações devedoras
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Créditos de Condóminos</span>
              <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono mt-1 block">
                -{totalCreditosFracoes.toFixed(2)} €
              </span>
              <span className="text-[9.5px] text-slate-500 mt-1 block">
                {saldosFracoes.filter(s => s.tipo_saldo === "CREDITO").length} frações com crédito
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">Ativo Líquido Inicial</span>
              <span className="text-lg font-black text-emerald-700 dark:text-emerald-300 font-mono mt-1 block">
                {ativoLiquidoAbertura.toFixed(2)} €
              </span>
              <span className="text-[9.5px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 block">Património total em gestão</span>
            </div>
          </div>

          {/* DISCRIMINAÇÃO DETALHADA DAS CONTAS NO RESUMO */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase mb-2 flex items-center gap-2">
              <Landmark className="h-4 w-4 text-emerald-500" />
              Contas que serão integradas na Tesouraria:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {contasArranque.map(c => (
                <div key={c.id_conta} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <span className="font-bold text-slate-900 dark:text-white block truncate">{c.nome}</span>
                    <span className="text-[10px] text-slate-400 block truncate">{c.banco} • {c.tipo}</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs shrink-0">
                    {Number(c.saldo).toFixed(2)} €
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs text-slate-700 dark:text-slate-300 space-y-2">
            <h4 className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              O que acontecerá ao gravar:
            </h4>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
              <li>Todas as <strong>{contasArranque.length} contas bancárias e de intervenção</strong> serão criadas e disponibilizadas para movimentos, transferências e lançamentos de receitas e despesas.</li>
              <li>Serão criados automaticamente os <strong>Avisos de Cobrança / Dívida de Transição</strong> para as frações devedoras no módulo Financeiro & Contencioso.</li>
              <li>Os {movimentosHistoricos.length} movimentos anteriores ficarão disponíveis em balancetes, extratos e relatórios de auditoria.</li>
            </ul>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setCurrentStep(3)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar aos Movimentos</span>
            </button>

            <button
              onClick={handleGravarConfiguracaoArranque}
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs transition-all flex items-center space-x-2 shadow-lg hover:scale-105 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>Gravar Balanço de Abertura & Ativar Condomínio</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
