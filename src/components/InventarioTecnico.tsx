import React, { useState, useEffect, useMemo, useRef } from "react";
import { Predio, LoggedUser, Fracao, Movimento, Conta, Fornecedor } from "../types";
import { Wrench, Plus, Check, MapPin, Sparkles, Building, Landmark, Trash2, ShieldAlert, Camera, X, Pencil, CalendarCheck, FileText, Paperclip, Bell, Upload } from "lucide-react";
import { fetchInventarioTecnicoFromSupabase, saveEquipamentoTecnicoToSupabase, deleteEquipamentoTecnicoFromSupabase, registarLogAuditoria, uploadDocumentoToStorage, saveMovimentoToSupabase, ajustarSaldoContaReal } from "../lib/supabaseService";
import { formatDatePT, parseValorMonetario } from "../utils";

export interface HistoricoVistoriaEquipamento {
  id: string;
  data: string;
  tecnico: string;
  resultado: "Aprovado" | "Aprovado com Reservas" | "Reprovado";
  observacoes?: string;
  documentoUrl?: string;
  documentoNome?: string;
  // Reformulação 2026-11-18 (pedido explícito do administrador: "falta a
  // data da inspeção" junto do custo/fatura) — o custo de uma inspeção
  // obrigatória por lei está sempre ligado a UM evento com UMA data real,
  // nunca solto ao nível do equipamento. Entidade oficial de inspeção e
  // empresa de manutenção que acompanha são 2 papéis distintos; o custo
  // sai sempre da conta do prédio, nunca repartido pelas frações.
  numCertificado?: string;
  id_fornecedor_inspecao?: string;
  fornecedorInspecaoNome?: string;
  id_fornecedor_manutencao?: string;
  fornecedorManutencaoNome?: string;
  custo?: number;
  id_conta_pagamento?: string;
  id_movimento?: string;
  comprovativoPagamentoUrl?: string;
}

export interface EquipamentoTecnico {
  id: string;
  nome: string;
  categoria: string;
  // Distinção perdida na unificação com a antiga Agenda de Manutenção
  // (2026-11-18) e reposta a pedido explícito do administrador — nem toda
  // a vistoria é exigida por lei (ex: extintores, elevadores, gás são
  // "inspeção_obrigatoria"; uma vistoria de rotina a um portão automático
  // pode ser só "preventiva", facultativa).
  tipo: "inspeção_obrigatoria" | "preventiva";
  andar: string;
  estado: "Excelente" | "Operacional" | "Necessita Manutenção" | "Crítico";
  ultimaInspecao: string;
  frequenciaInspecao: string;
  fabricante?: string;
  detalhes?: string;
  fotos?: string[];
  // Unificação com o antigo "Plano de Manutenção Obrigatória" (2026-10-22,
  // pedido explícito do administrador: um só ecrã, sem duplicação) — uma
  // vistoria (agendada ou avulsa) atualiza sempre ultimaInspecao e agenda
  // automaticamente proximaInspecaoData, para o cron poder alertar antes do
  // vencimento (ver alertarInspecoesEquipamentosAVencer em cronService.js).
  entidadeResponsavel?: string;
  baseLegalDgeg?: string;
  // Nº de licença/registo/autorização PERMANENTE deste equipamento (ex: nº
  // DGEG de um elevador concreto) — distinto do nº de certificado de UMA
  // inspeção (esse vive em HistoricoVistoriaEquipamento.numCertificado,
  // porque muda a cada inspeção).
  numLicencaAutorizacao?: string;
  proximaInspecaoData?: string;
  diasAlertaAntecedencia?: number;
  alertaEnviadoEm?: string;
  historicoVistorias?: HistoricoVistoriaEquipamento[];
}

interface InventarioTecnicoProps {
  predio: Predio;
  loggedUser: LoggedUser;
  fracoes?: Fracao[];
  // Unificação com a antiga Agenda de Manutenção — precisos para ligar
  // fornecedores reais, lançar o custo como movimento real e debitar a
  // conta bancária do prédio. Em falta (ex: vista PWA do técnico), as
  // secções financeiras ficam simplesmente sem opções para escolher.
  movements?: Movimento[];
  setMovements?: React.Dispatch<React.SetStateAction<Movimento[]>>;
  contas?: Conta[];
  fornecedores?: Fornecedor[];
}

export function InventarioTecnico({ predio, loggedUser, fracoes = [], movements = [], setMovements, contas = [], fornecedores = [] }: InventarioTecnicoProps) {
  // Carregado do Supabase (tabela real inventario_tecnico)
  const [equipamentos, setEquipamentos] = useState<EquipamentoTecnico[]>([]);

  useEffect(() => {
    if (!predio.id_predio) return;
    fetchInventarioTecnicoFromSupabase(predio.id_predio).then(dados => { if (dados) setEquipamentos(dados); });
  }, [predio.id_predio]);

  // Form states to add custom equipment — reutilizado também para Editar
  // (ver editingId/iniciarEdicao): quando definido, handleAddCustom
  // atualiza em vez de criar.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("Elevadores");
  const [tipo, setTipo] = useState<EquipamentoTecnico["tipo"]>("inspeção_obrigatoria");
  const [andar, setAndar] = useState("");
  const [estado, setEstado] = useState<EquipamentoTecnico["estado"]>("Operacional");
  const [fabricante, setFabricante] = useState("");
  const [detalhes, setDetalhes] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [frequenciaInspecao, setFrequenciaInspecao] = useState("Anual");
  const [entidadeResponsavel, setEntidadeResponsavel] = useState("");
  const [baseLegalDgeg, setBaseLegalDgeg] = useState("");
  const [numLicencaAutorizacao, setNumLicencaAutorizacao] = useState("");
  const [diasAlertaAntecedencia, setDiasAlertaAntecedencia] = useState(30);
  // Só usado ao CRIAR (nunca ao editar): nº de equipamentos iguais a criar
  // de uma vez, ex: "2" para um prédio com 2 elevadores — pedido explícito
  // do administrador ("a localização é um equipamento do prédio", cada
  // elevador com a sua própria ficha, histórico e custos, em vez de 1 só
  // registo com um multiplicador artificial). Gera "{nome} 1", "{nome} 2",
  // cada um totalmente independente dali em diante.
  const [numUnidadesCriar, setNumUnidadesCriar] = useState("1");

  // Converte o rótulo de periodicidade (igual ao já usado em toda a app,
  // ex: contratos de fornecedores) no número de meses correspondente, para
  // calcular a próxima inspeção automaticamente a seguir a cada vistoria.
  const periodicidadeParaMeses = (freq: string): number => {
    const f = freq.toLowerCase();
    if (f.includes("mensal")) return 1;
    if (f.includes("trimestral")) return 3;
    if (f.includes("semestral")) return 6;
    if (f.includes("bianual") || f.includes("2 anos")) return 24;
    return 12; // Anual, por omissão
  };

  const calcularProximaInspecao = (dataBase: string, freq: string): string => {
    const d = new Date(dataBase);
    d.setMonth(d.getMonth() + periodicidadeParaMeses(freq));
    return d.toISOString().split("T")[0];
  };

  const limparFormulario = () => {
    setEditingId(null);
    setNome("");
    setCategoria("Elevadores");
    setTipo("inspeção_obrigatoria");
    setEstado("Operacional");
    setFabricante("");
    setDetalhes("");
    setFotos([]);
    setFrequenciaInspecao("Anual");
    setEntidadeResponsavel("");
    setBaseLegalDgeg("");
    setNumLicencaAutorizacao("");
    setDiasAlertaAntecedencia(30);
    setNumUnidadesCriar("1");
  };

  const iniciarEdicao = (eq: EquipamentoTecnico) => {
    setEditingId(eq.id);
    setNome(eq.nome);
    setCategoria(eq.categoria);
    setTipo(eq.tipo || "inspeção_obrigatoria");
    setAndar(eq.andar);
    setEstado(eq.estado);
    setFabricante(eq.fabricante || "");
    setDetalhes(eq.detalhes || "");
    setFotos(eq.fotos || []);
    setFrequenciaInspecao(eq.frequenciaInspecao || "Anual");
    setEntidadeResponsavel(eq.entidadeResponsavel || "");
    setBaseLegalDgeg(eq.baseLegalDgeg || "");
    setNumLicencaAutorizacao(eq.numLicencaAutorizacao || "");
    setDiasAlertaAntecedencia(eq.diasAlertaAntecedencia ?? 30);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- Registar Vistoria (agendada ou avulsa) ---
  // Atualiza logo a validade (ultimaInspecao) e agenda automaticamente a
  // próxima inspeção, para o alerta de antecedência (cron) saber quando
  // disparar — pedido explícito do administrador: "se houve uma revisão
  // tem de acertar logo a validade... e programar a próxima inspeção".
  const [vistoriaTargetId, setVistoriaTargetId] = useState<string | null>(null);
  // Quando definido, o modal passa a EDITAR esta entrada já gravada do
  // histórico em vez de criar uma nova — antes não havia forma nenhuma de
  // corrigir uma vistoria já registada (ex: relatório do técnico anexado
  // por engano, dados errados).
  const [vistoriaEditId, setVistoriaEditId] = useState<string | null>(null);
  const [vistoriaData, setVistoriaData] = useState(() => new Date().toISOString().split("T")[0]);
  const [vistoriaTecnico, setVistoriaTecnico] = useState("");
  const [vistoriaResultado, setVistoriaResultado] = useState<HistoricoVistoriaEquipamento["resultado"]>("Aprovado");
  const [vistoriaObservacoes, setVistoriaObservacoes] = useState("");
  const [vistoriaDocFile, setVistoriaDocFile] = useState<File | null>(null);
  // Documento já existente (só relevante em edição) e se o administrador
  // pediu para o remover sem escolher um novo — sem isto não havia forma de
  // remover um anexo errado, só de o substituir.
  const [vistoriaDocExistente, setVistoriaDocExistente] = useState<{ url: string; nome?: string } | null>(null);
  const [vistoriaDocRemovido, setVistoriaDocRemovido] = useState(false);
  const [aGravarVistoria, setAGravarVistoria] = useState(false);
  const vistoriaDocInputRef = useRef<HTMLInputElement>(null);
  // Custo desta inspeção concreta — ligado à mesma data da vistoria
  // (pedido explícito: "falta a data da inspeção" junto do custo/fatura).
  const [vistoriaNumCertificado, setVistoriaNumCertificado] = useState("");
  const [vistoriaFornInspecaoId, setVistoriaFornInspecaoId] = useState("");
  const [vistoriaFornInspecaoNome, setVistoriaFornInspecaoNome] = useState("");
  const [vistoriaFornManutencaoId, setVistoriaFornManutencaoId] = useState("");
  const [vistoriaFornManutencaoNome, setVistoriaFornManutencaoNome] = useState("");
  const [vistoriaCusto, setVistoriaCusto] = useState("");
  const [vistoriaContaPagamento, setVistoriaContaPagamento] = useState("");
  const [vistoriaIdMovimentoExistente, setVistoriaIdMovimentoExistente] = useState<string | undefined>(undefined);
  const [vistoriaFaturaFile, setVistoriaFaturaFile] = useState<File | null>(null);
  const [vistoriaFaturaExistente, setVistoriaFaturaExistente] = useState<string | null>(null);
  const [vistoriaFaturaRemovida, setVistoriaFaturaRemovida] = useState(false);
  const vistoriaFaturaInputRef = useRef<HTMLInputElement>(null);

  const abrirRegistarVistoria = (eq: EquipamentoTecnico) => {
    setVistoriaTargetId(eq.id);
    setVistoriaEditId(null);
    setVistoriaData(new Date().toISOString().split("T")[0]);
    setVistoriaTecnico("");
    setVistoriaResultado("Aprovado");
    setVistoriaObservacoes("");
    setVistoriaDocFile(null);
    setVistoriaDocExistente(null);
    setVistoriaDocRemovido(false);
    setVistoriaNumCertificado("");
    // Pré-preenche com os últimos fornecedores/conta usados neste
    // equipamento (costumam repetir-se de inspeção para inspeção), mas o
    // custo fica sempre em branco — nunca presumir que custou o mesmo.
    const ultimaVistoria = (eq.historicoVistorias || [])[0];
    setVistoriaFornInspecaoId(ultimaVistoria?.id_fornecedor_inspecao || "");
    setVistoriaFornInspecaoNome(ultimaVistoria?.id_fornecedor_inspecao ? "" : (ultimaVistoria?.fornecedorInspecaoNome || ""));
    setVistoriaFornManutencaoId(ultimaVistoria?.id_fornecedor_manutencao || "");
    setVistoriaFornManutencaoNome(ultimaVistoria?.id_fornecedor_manutencao ? "" : (ultimaVistoria?.fornecedorManutencaoNome || ""));
    setVistoriaCusto("");
    setVistoriaContaPagamento(ultimaVistoria?.id_conta_pagamento || "");
    setVistoriaIdMovimentoExistente(undefined);
    setVistoriaFaturaFile(null);
    setVistoriaFaturaExistente(null);
    setVistoriaFaturaRemovida(false);
  };

  const iniciarEdicaoVistoria = (eq: EquipamentoTecnico, v: HistoricoVistoriaEquipamento) => {
    setVistoriaTargetId(eq.id);
    setVistoriaEditId(v.id);
    setVistoriaData(v.data);
    setVistoriaTecnico(v.tecnico === "Não identificado" ? "" : v.tecnico);
    setVistoriaResultado(v.resultado);
    setVistoriaObservacoes(v.observacoes || "");
    setVistoriaDocFile(null);
    setVistoriaDocExistente(v.documentoUrl ? { url: v.documentoUrl, nome: v.documentoNome } : null);
    setVistoriaDocRemovido(false);
    setVistoriaNumCertificado(v.numCertificado || "");
    setVistoriaFornInspecaoId(v.id_fornecedor_inspecao || "");
    setVistoriaFornInspecaoNome(v.id_fornecedor_inspecao ? "" : (v.fornecedorInspecaoNome || ""));
    setVistoriaFornManutencaoId(v.id_fornecedor_manutencao || "");
    setVistoriaFornManutencaoNome(v.id_fornecedor_manutencao ? "" : (v.fornecedorManutencaoNome || ""));
    setVistoriaCusto(v.custo != null ? String(v.custo) : "");
    setVistoriaContaPagamento(v.id_conta_pagamento || "");
    setVistoriaIdMovimentoExistente(v.id_movimento);
    setVistoriaFaturaFile(null);
    setVistoriaFaturaExistente(v.comprovativoPagamentoUrl || null);
    setVistoriaFaturaRemovida(false);
  };

  // Categoria SNC sugerida a partir do nome/categoria do equipamento —
  // mesma lógica já usada na antiga Agenda de Manutenção, agora unificada
  // aqui. Cai sempre em "Manutenção" genérico quando não reconhece nada.
  const categoriaSugeridaSNC = (eq: EquipamentoTecnico): string => {
    const t = `${eq.nome} ${eq.categoria}`.toLowerCase();
    if (/elevador/.test(t)) return "Manutenção de Elevadores";
    if (/extintor|corta-fogo|inc[êe]ndio|sinaliza[çc][ãa]o de emerg[êe]ncia/.test(t)) return "Segurança Contra Incêndio";
    if (/g[áa]s|conduta/.test(t)) return "Inspeção de Gás";
    if (/bomba|drenagem|[áa]guas pluviais/.test(t)) return "Manutenção de Bombas";
    if (/jardim|rega|eletrobomba/.test(t)) return "Manutenção de Jardins";
    if (/quadro el[ée]tric|coluna el[ée]trica|caixa t[ée]cnica/.test(t)) return "Manutenção Elétrica";
    if (/telhado|cobertura/.test(t)) return "Manutenção de Cobertura";
    return "Manutenção";
  };

  const handleGravarVistoria = async (e: React.FormEvent) => {
    e.preventDefault();
    const eqAlvo = equipamentos.find(eq => eq.id === vistoriaTargetId);
    if (!eqAlvo) return;
    setAGravarVistoria(true);
    try {
      let documentoUrl: string | undefined;
      let documentoNome: string | undefined;
      if (vistoriaDocFile) {
        const caminho = `inventario_tecnico/${predio.id_predio}/${eqAlvo.id}/certificado-${Date.now()}-${vistoriaDocFile.name}`;
        documentoUrl = (await uploadDocumentoToStorage(vistoriaDocFile, caminho)) || undefined;
        if (!documentoUrl) {
          alert("❌ Não foi possível carregar o documento comprovativo. Tente novamente.");
          setAGravarVistoria(false);
          return;
        }
        documentoNome = vistoriaDocFile.name;
      } else if (vistoriaEditId && !vistoriaDocRemovido && vistoriaDocExistente) {
        // Em edição, sem ficheiro novo escolhido e sem pedido de remoção —
        // mantém o documento já anexado em vez de o apagar silenciosamente.
        documentoUrl = vistoriaDocExistente.url;
        documentoNome = vistoriaDocExistente.nome;
      }

      // Fatura/comprovativo de pagamento — distinto do certificado de
      // inspeção acima (podem ser o mesmo PDF ou 2 ficheiros diferentes).
      let comprovativoPagamentoUrl: string | undefined;
      if (vistoriaFaturaFile) {
        const caminho = `inventario_tecnico/${predio.id_predio}/${eqAlvo.id}/fatura-${Date.now()}-${vistoriaFaturaFile.name}`;
        comprovativoPagamentoUrl = (await uploadDocumentoToStorage(vistoriaFaturaFile, caminho)) || undefined;
        if (!comprovativoPagamentoUrl) {
          alert("❌ Não foi possível carregar a fatura/comprovativo. Tente novamente.");
          setAGravarVistoria(false);
          return;
        }
      } else if (vistoriaEditId && !vistoriaFaturaRemovida && vistoriaFaturaExistente) {
        comprovativoPagamentoUrl = vistoriaFaturaExistente;
      }

      const fornecedorInspecaoReal = fornecedores.find(f => f.id_fornecedor === vistoriaFornInspecaoId);
      const fornecedorManutencaoReal = fornecedores.find(f => f.id_fornecedor === vistoriaFornManutencaoId);
      const custoNum = vistoriaCusto ? parseValorMonetario(vistoriaCusto) : undefined;

      // Lança o custo real desta inspeção como movimento de Despesa na
      // conta bancária do prédio — nunca repartido pelas frações. Só uma
      // vez por vistoria (idempotente): se já tinha um movimento lançado,
      // não volta a lançar, só atualiza os restantes dados.
      let idMovimentoFinal = vistoriaIdMovimentoExistente;
      if (!idMovimentoFinal && custoNum && custoNum > 0 && vistoriaContaPagamento) {
        if (!setMovements) {
          alert("Sistema de movimentos não disponível de momento — a vistoria foi gravada sem lançar o custo.");
        } else {
          const contaAlvo = contas.find(c => c.id_conta === vistoriaContaPagamento);
          if (!contaAlvo) {
            alert("Conta de pagamento não encontrada — a vistoria foi gravada sem lançar o custo.");
          } else {
            const entidade = fornecedorInspecaoReal?.nome || vistoriaFornInspecaoNome.trim() || fornecedorManutencaoReal?.nome || vistoriaFornManutencaoNome.trim() || "Entidade de Inspeção";
            const nomeManutencao = fornecedorManutencaoReal?.nome || vistoriaFornManutencaoNome.trim();
            const novoMov: Movimento = {
              id_mov: "mov-inv-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
              id_predio: predio.id_predio,
              id_conta: contaAlvo.id_conta,
              data: vistoriaData,
              tipo: "Despesa",
              valor: custoNum,
              descricao: `${eqAlvo.nome} — ${entidade}${nomeManutencao && nomeManutencao !== entidade ? ` (acompanhado por ${nomeManutencao})` : ""} — inspeção de ${formatDatePT(vistoriaData)}`,
              categoria: categoriaSugeridaSNC(eqAlvo),
              estado: "Pago",
              is_movimento_cego: false,
              id_fornecedor: fornecedorInspecaoReal?.id_fornecedor,
              comprovativo_url: comprovativoPagamentoUrl
            };
            const okMov = await saveMovimentoToSupabase(novoMov);
            if (!okMov) {
              alert("❌ Não foi possível gravar o movimento do custo. A vistoria foi gravada, mas o custo NÃO ficou lançado — tente lançá-lo outra vez ao editar esta vistoria.");
            } else {
              setMovements(prev => [novoMov, ...prev]);
              await ajustarSaldoContaReal(contaAlvo.id_conta, -novoMov.valor);
              idMovimentoFinal = novoMov.id_mov;
            }
          }
        }
      }

      const entradaVistoria: HistoricoVistoriaEquipamento = {
        id: vistoriaEditId || `vist-${Date.now()}`,
        data: vistoriaData,
        tecnico: vistoriaTecnico || "Não identificado",
        resultado: vistoriaResultado,
        observacoes: vistoriaObservacoes || undefined,
        documentoUrl,
        documentoNome,
        numCertificado: vistoriaNumCertificado || undefined,
        id_fornecedor_inspecao: fornecedorInspecaoReal?.id_fornecedor,
        fornecedorInspecaoNome: fornecedorInspecaoReal?.nome || vistoriaFornInspecaoNome.trim() || undefined,
        id_fornecedor_manutencao: fornecedorManutencaoReal?.id_fornecedor,
        fornecedorManutencaoNome: fornecedorManutencaoReal?.nome || vistoriaFornManutencaoNome.trim() || undefined,
        custo: custoNum,
        id_conta_pagamento: vistoriaContaPagamento || undefined,
        id_movimento: idMovimentoFinal,
        comprovativoPagamentoUrl
      };

      const historicoAtualizado = vistoriaEditId
        ? (eqAlvo.historicoVistorias || []).map(v => v.id === vistoriaEditId ? entradaVistoria : v)
        : [entradaVistoria, ...(eqAlvo.historicoVistorias || [])];

      // A validade/estado do equipamento refletem sempre a vistoria mais
      // RECENTE por data (não a última gravada) — importante em edição,
      // onde corrigir a data de uma entrada antiga não pode mudar a
      // validade atual se já houver uma vistoria mais recente no histórico.
      const maisRecente = [...historicoAtualizado].sort((a, b) => b.data.localeCompare(a.data))[0];
      const novoEstado: EquipamentoTecnico["estado"] =
        maisRecente.resultado === "Reprovado" ? "Crítico" :
        maisRecente.resultado === "Aprovado com Reservas" ? "Necessita Manutenção" :
        "Operacional";
      const proximaInspecao = calcularProximaInspecao(maisRecente.data, eqAlvo.frequenciaInspecao || "Anual");

      const equipamentoAtualizado: EquipamentoTecnico = {
        ...eqAlvo,
        estado: novoEstado,
        ultimaInspecao: maisRecente.data,
        proximaInspecaoData: proximaInspecao,
        // Reposto a undefined sempre que a próxima inspeção muda, para o
        // cron poder voltar a alertar no novo ciclo.
        alertaEnviadoEm: undefined,
        historicoVistorias: historicoAtualizado
      };

      const ok = await saveEquipamentoTecnicoToSupabase(predio.id_predio, equipamentoAtualizado);
      if (!ok) {
        alert("❌ Não foi possível gravar a vistoria. Tente novamente.");
        return;
      }
      setEquipamentos(prev => prev.map(eq => eq.id === eqAlvo.id ? equipamentoAtualizado : eq));
      registarLogAuditoria("Manutenção", `${vistoriaEditId ? "Editou" : "Registou"} vistoria de "${eqAlvo.nome}" (${vistoriaResultado})${custoNum ? ` — custo ${custoNum.toFixed(2)}€` : ""} — próxima inspeção agendada para ${formatDatePT(proximaInspecao)}`, predio.id_predio, loggedUser, vistoriaObservacoes || undefined);
      setVistoriaTargetId(null);
      setVistoriaEditId(null);
      alert(vistoriaEditId
        ? `✅ Vistoria atualizada! Validade e próxima inspeção recalculadas para ${formatDatePT(proximaInspecao)}.`
        : `✅ Vistoria registada!${idMovimentoFinal ? ` Custo de ${custoNum!.toFixed(2)}€ lançado na conta.` : ""} Validade atualizada e próxima inspeção agendada para ${formatDatePT(proximaInspecao)}.`);
    } finally {
      setAGravarVistoria(false);
    }
  };

  // Pisos reais deste prédio (a partir das frações reais) — antes era uma
  // lista fixa "Piso -2" a "Piso 3", que não correspondia a este edifício
  // (tem lojas no rés-do-chão e frações até ao 5º andar; "Piso 3" era o
  // topo da lista, deixando o 4º e o 5º andar impossíveis de selecionar).
  const pisosReais = useMemo(() => {
    const predioFracoes = fracoes.filter(f => f.id_predio === predio.id_predio);
    const numeros = new Set<number>();
    predioFracoes.forEach(f => {
      const match = (f.piso || "").match(/^(\d+)º/);
      if (match) numeros.add(Number(match[1]));
    });
    const pisosNumerados = Array.from(numeros).sort((a, b) => a - b).map(n => `${n}º Piso`);
    const temLojas = predioFracoes.some(f => (f.piso || "").toLowerCase().includes("loja"));
    return [
      "Cave / Garagem",
      ...(temLojas ? ["Rés-do-Chão (Lojas)"] : []),
      ...pisosNumerados,
      "Cobertura",
      "Exterior"
    ];
  }, [fracoes, predio.id_predio]);

  useEffect(() => {
    if (!andar && pisosReais.length > 0) setAndar(pisosReais[0]);
  }, [pisosReais, andar]);

  // Converte cada fotografia escolhida para base64 comprimido (mesmo
  // padrão já usado noutros ecrãs, ex: avatar do perfil) — várias fotos
  // de uma vez, anexadas à lista já existente.
  const handleFotosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []);
    e.target.value = "";
    files.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 700;
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
          setFotos(prev => [...prev, canvas.toDataURL("image/webp", 0.8)]);
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    const existente = editingId ? equipamentos.find(eq => eq.id === editingId) : null;
    const base: Omit<EquipamentoTecnico, "id" | "nome"> = {
      categoria,
      tipo,
      andar,
      estado,
      ultimaInspecao: existente?.ultimaInspecao || new Date().toISOString().substring(0, 10),
      frequenciaInspecao,
      fabricante: fabricante || "Personalizado",
      detalhes: detalhes || "Adicionado via painel técnico.",
      fotos,
      entidadeResponsavel: entidadeResponsavel || undefined,
      baseLegalDgeg: baseLegalDgeg || undefined,
      numLicencaAutorizacao: numLicencaAutorizacao || undefined,
      diasAlertaAntecedencia,
      proximaInspecaoData: existente?.proximaInspecaoData,
      alertaEnviadoEm: existente?.alertaEnviadoEm,
      historicoVistorias: existente?.historicoVistorias || []
    };

    if (editingId) {
      const equipment: EquipamentoTecnico = { id: editingId, nome, ...base };
      setEquipamentos(prev => prev.map(eq => eq.id === editingId ? equipment : eq));
      const ok = await saveEquipamentoTecnicoToSupabase(predio.id_predio, equipment);
      if (!ok) { alert("❌ Não foi possível gravar as alterações no Supabase."); return; }
      registarLogAuditoria("Manutenção", `Editou "${nome}" no inventário técnico`, predio.id_predio, loggedUser);
      limparFormulario();
      alert(`Equipamento "${nome}" atualizado com sucesso!`);
      return;
    }

    // Nº de Unidades só ao criar — gera N equipamentos NUMERADOS e
    // totalmente independentes (ex: "Elevador 1", "Elevador 2"), cada um
    // com a sua própria localização, histórico de vistorias e custos, em
    // vez de 1 só registo com um multiplicador artificial (pedido
    // explícito do administrador: "a localização é um equipamento do
    // prédio").
    const unidades = Math.max(1, parseInt(numUnidadesCriar, 10) || 1);
    const novosEquipamentos: EquipamentoTecnico[] = Array.from({ length: unidades }).map((_, idx) => ({
      id: "eq-custom-" + Date.now() + "-" + idx,
      nome: unidades > 1 ? `${nome.trim()} ${idx + 1}` : nome.trim(),
      ...base
    }));

    const resultados = await Promise.all(novosEquipamentos.map(eq => saveEquipamentoTecnicoToSupabase(predio.id_predio, eq)));
    if (resultados.some(r => !r)) {
      alert("❌ Não foi possível gravar o(s) equipamento(s) no Supabase. Tente novamente.");
      return;
    }
    setEquipamentos(prev => [...prev, ...novosEquipamentos]);
    registarLogAuditoria("Manutenção", `Adicionou "${nome}"${unidades > 1 ? ` (${unidades} unidades)` : ""} no inventário técnico`, predio.id_predio, loggedUser);
    limparFormulario();
    alert(unidades > 1
      ? `${unidades} equipamentos adicionados: ${novosEquipamentos.map(eq => eq.nome).join(", ")} — cada um já independente, com o seu próprio histórico de vistorias e custos.`
      : `Equipamento "${nome}" adicionado com sucesso! Aparece automaticamente mapeado na planta técnica do edifício.`);
  };

  const handleRemove = (id: string) => {
    const confirmRemove = confirm("Tem a certeza que deseja remover este equipamento do inventário do prédio?");
    if (confirmRemove) {
      setEquipamentos(equipamentos.filter(e => e.id !== id));
      deleteEquipamentoTecnicoFromSupabase(id).catch(console.error);
    }
  };

  // Gera um mapa preventivo inicial a partir do património real do prédio
  // (elevadores, garagem, jardins) — existia na antiga Agenda de
  // Manutenção ("Gerar Agenda Preventiva IA") e foi perdido na unificação
  // (2026-11-18); reposto a pedido do administrador, agora a criar
  // EquipamentoTecnico diretamente aqui. IDs fixos ("ag-ia-N") para nunca
  // duplicar ao clicar 2 vezes.
  const handleGerarMapaPreventivoIA = async () => {
    const checks: EquipamentoTecnico[] = [
      {
        id: "ag-ia-1",
        nome: "Extintores de Incêndio (Certificação Legal)",
        categoria: "Sistema de incêndio",
        tipo: "inspeção_obrigatoria",
        andar: "Geral do Edifício",
        estado: "Operacional",
        ultimaInspecao: new Date().toISOString().substring(0, 10),
        frequenciaInspecao: "Anual"
      },
      {
        id: "ag-ia-2",
        nome: "Inspeção e Limpeza do Telhado / Cobertura",
        categoria: "Portas corta-fogo",
        tipo: "preventiva",
        andar: "Cobertura",
        estado: "Operacional",
        ultimaInspecao: new Date().toISOString().substring(0, 10),
        frequenciaInspecao: "Anual"
      }
    ];

    if (predio.patrimonio?.tem_elevador) {
      const numElevadores = Math.max(1, predio.patrimonio.num_elevadores || 1);
      for (let i = 1; i <= numElevadores; i++) {
        checks.push({
          id: numElevadores > 1 ? `ag-ia-elevador-${i}` : "ag-ia-3",
          nome: numElevadores > 1 ? `Elevador ${i}` : "Elevadores de Passageiros",
          categoria: "Elevadores",
          tipo: "inspeção_obrigatoria",
          andar: "Geral do Edifício",
          estado: "Operacional",
          ultimaInspecao: new Date().toISOString().substring(0, 10),
          frequenciaInspecao: "Bianual"
        });
      }
    }
    if (predio.patrimonio?.tem_garagem) {
      checks.push({
        id: "ag-ia-4",
        nome: "Bombas de Drenagem de Águas Pluviais da Garagem",
        categoria: "Bombas de água",
        tipo: "preventiva",
        andar: "Cave / Garagem",
        estado: "Operacional",
        ultimaInspecao: new Date().toISOString().substring(0, 10),
        frequenciaInspecao: "Semestral"
      });
    }
    if (predio.patrimonio?.tem_jardins) {
      checks.push({
        id: "ag-ia-5",
        nome: "Eletrobombas e Sistema de Rega dos Jardins",
        categoria: "Bombas de água",
        tipo: "preventiva",
        andar: "Exterior",
        estado: "Operacional",
        ultimaInspecao: new Date().toISOString().substring(0, 10),
        frequenciaInspecao: "Trimestral"
      });
    }
    checks.push({
      id: "ag-ia-6",
      nome: "Portas Corta-Fogo e Sinalização de Emergência",
      categoria: "Portas corta-fogo",
      tipo: "inspeção_obrigatoria",
      andar: "Geral do Edifício",
      estado: "Operacional",
      ultimaInspecao: new Date().toISOString().substring(0, 10),
      frequenciaInspecao: "Semestral"
    });
    checks.push({
      id: "ag-ia-7",
      nome: "Quadros de Colunas Elétricas e Caixas Técnicas",
      categoria: "Sistema elétrico",
      tipo: "inspeção_obrigatoria",
      andar: "Geral do Edifício",
      estado: "Operacional",
      ultimaInspecao: new Date().toISOString().substring(0, 10),
      frequenciaInspecao: "Anual"
    });

    const checksNovos = checks.filter(c => !equipamentos.some(eq => eq.id === c.id));
    if (checksNovos.length === 0) {
      alert("O mapa preventivo para este património já foi gerado — nada novo a acrescentar.");
      return;
    }
    const resultados = await Promise.all(checksNovos.map(c => saveEquipamentoTecnicoToSupabase(predio.id_predio, c)));
    if (resultados.some(r => !r)) {
      alert("❌ Não foi possível gravar o mapa preventivo no Supabase. Tente novamente.");
      return;
    }
    setEquipamentos(prev => [...prev, ...checksNovos]);
    registarLogAuditoria("Manutenção", "Gerou o mapa preventivo inicial a partir do património do prédio", predio.id_predio, loggedUser);
    alert(`Mapa preventivo gerado: ${checksNovos.length} equipamento(s) adicionado(s) a partir do património real do prédio.`);
  };

  // Pre-defined categories required in Document D
  const categoriesList = [
    "Elevadores",
    "Bombas de água",
    "Motores",
    "Portas corta-fogo",
    "Sistema de incêndio",
    "Sistema de gás",
    "Sistema elétrico",
    "Piscina (bombas, filtros, motores)",
    "Spa (motores, filtros, aquecimento)",
    "Ginásio (equipamentos de ginástica)"
  ];

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 animate-fadeIn">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">Inventário Técnico & Vistorias</h3>
          <p className="text-[11px] text-slate-600">Equipamentos, inspeções obrigatórias por lei e manutenção preventiva do edifício.</p>
        </div>
        <button
          onClick={handleGerarMapaPreventivoIA}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <Sparkles className="h-4 w-4" />
          <span>Gerar Mapa Preventivo IA</span>
        </button>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-600 uppercase block font-bold">Total Equipamentos</span>
            <span className="text-xl font-bold font-mono">{equipamentos.length}</span>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/40 p-2.5 rounded-lg text-blue-500">
            <Wrench className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-600 uppercase block font-bold">Estado Excelente</span>
            <span className="text-xl font-bold font-mono text-emerald-600">{equipamentos.filter(e => e.estado === "Excelente").length}</span>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg text-emerald-500">
            <Check className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-600 uppercase block font-bold">Em Monitorização</span>
            <span className="text-xl font-bold font-mono text-amber-600">{equipamentos.filter(e => e.estado === "Operacional").length}</span>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg text-amber-500">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-600 uppercase block font-bold">Manutenção / Crítico</span>
            <span className="text-xl font-bold font-mono text-red-600">{equipamentos.filter(e => ["Necessita Manutenção", "Crítico"].includes(e.estado)).length}</span>
          </div>
          <div className="bg-red-50 dark:bg-red-950/40 p-2.5 rounded-lg text-red-500">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Add customized equipment */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 h-fit">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                {editingId ? <Pencil className="h-4 w-4 text-indigo-500" /> : <Plus className="h-4 w-4 text-emerald-500" />}
                {editingId ? "Editar Equipamento" : "Adicionar Equipamento Personalizado"}
              </h3>
              <p className="text-[11px] text-slate-600">{editingId ? "A corrigir um equipamento já registado." : "Novos equipamentos aparecem instantaneamente no mapeamento técnico da planta."}</p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={limparFormulario}
                className="text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg cursor-pointer shrink-0"
              >
                Cancelar
              </button>
            )}
          </div>

          <form onSubmit={handleAddCustom} className="space-y-3.5">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Nome do Equipamento / Modelo</label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Motor do Portão de Garagem Ditec"
                className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Categoria Técnica</label>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold cursor-pointer"
              >
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Tipo de Vistoria</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value as any)}
                className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold cursor-pointer"
              >
                <option value="inspeção_obrigatoria">Inspeção Obrigatória (Lei)</option>
                <option value="preventiva">Manutenção Preventiva (Facultativa)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Localização (Andar)</label>
                <select
                  value={andar}
                  onChange={e => setAndar(e.target.value)}
                  className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold cursor-pointer"
                >
                  {pisosReais.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Estado de Conservação</label>
                <select
                  value={estado}
                  onChange={e => setEstado(e.target.value as any)}
                  className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold cursor-pointer"
                >
                  <option value="Excelente">Excelente</option>
                  <option value="Operacional">Operacional</option>
                  <option value="Necessita Manutenção">Manutenção</option>
                  <option value="Crítico">Crítico</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Fabricante / Fornecedor</label>
                <input
                  type="text"
                  value={fabricante}
                  onChange={e => setFabricante(e.target.value)}
                  placeholder="Ex: Schindler Lda."
                  className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Periodicidade de Inspeção</label>
                <select
                  value={frequenciaInspecao}
                  onChange={e => setFrequenciaInspecao(e.target.value)}
                  className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold cursor-pointer"
                >
                  <option value="Mensal">Mensal</option>
                  <option value="Trimestral">Trimestral</option>
                  <option value="Semestral">Semestral</option>
                  <option value="Anual">Anual</option>
                  <option value="Bianual">Bianual (2 anos)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Entidade Responsável / Prestador de Serviço</label>
              <input
                type="text"
                value={entidadeResponsavel}
                onChange={e => setEntidadeResponsavel(e.target.value)}
                placeholder="Ex: TKE, Fidelidade, A definir..."
                className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Base Legal / DGEG (Opcional)</label>
                <input
                  type="text"
                  value={baseLegalDgeg}
                  onChange={e => setBaseLegalDgeg(e.target.value)}
                  placeholder="Ex: DL 320/2002"
                  className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Nº de Licença / Autorização</label>
                <input
                  type="text"
                  value={numLicencaAutorizacao}
                  onChange={e => setNumLicencaAutorizacao(e.target.value)}
                  placeholder="Ex: registo DGEG do equipamento"
                  className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {!editingId && (
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Nº de Unidades a Criar</label>
                <input type="number" min={1} value={numUnidadesCriar} onChange={e => setNumUnidadesCriar(e.target.value)} className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs" />
                <p className="text-[9px] text-slate-600 mt-1">Ex: "2" num prédio com 2 elevadores cria "{nome.trim() || "Elevador"} 1" e "{nome.trim() || "Elevador"} 2" como equipamentos separados e independentes — cada um com a sua própria localização, histórico de vistorias e custos.</p>
              </div>
            )}

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Alertar (dias antes)</label>
              <input
                type="number"
                min={1}
                max={180}
                value={diasAlertaAntecedencia}
                onChange={e => setDiasAlertaAntecedencia(parseInt(e.target.value) || 30)}
                className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Notas Técnicas / Observações</label>
              <textarea
                value={detalhes}
                onChange={e => setDetalhes(e.target.value)}
                placeholder="Ex: Rolamento substituído recentemente. Monitorizar ruído térmico."
                rows={3}
                className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Fotografias</label>
              {/* Sem "capture" — isso forçava o telemóvel a abrir SEMPRE a
                  câmara diretamente, sem dar a escolher a galeria/ficheiros
                  já existentes (bug real reportado: "só abre a máquina
                  fotográfica"). Sem o atributo, o próprio telemóvel mostra
                  as duas opções. */}
              <input ref={fotoInputRef} type="file" accept="image/*" multiple onChange={handleFotosChange} className="hidden" />
              <button
                type="button"
                onClick={() => fotoInputRef.current?.click()}
                className="w-full border border-dashed p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:border-emerald-400 hover:text-emerald-600"
              >
                <Camera className="h-4 w-4" />
                <span>{fotos.length > 0 ? `${fotos.length} fotografia(s) anexada(s) — adicionar mais` : "Adicionar Fotografias"}</span>
              </button>
              {fotos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {fotos.map((f, i) => (
                    <div key={i} className="relative h-14 w-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                      <img src={f} className="h-full w-full object-cover" alt="" />
                      <button
                        type="button"
                        onClick={() => setFotos(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity"
                        title="Remover fotografia"
                        aria-label="Remover fotografia"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className={`w-full text-white font-bold py-2 rounded-lg text-xs cursor-pointer shadow flex items-center justify-center gap-1 ${editingId ? "bg-indigo-600 hover:bg-indigo-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
            >
              {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              <span>{editingId ? "Guardar Alterações" : "Inserir no Mapa Técnico"}</span>
            </button>
          </form>
        </div>

        {/* Right columns: List and interactive building schema */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Planta / Schema visual do Edifício */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Building className="h-4 w-4 text-blue-500" />
                Mapa Visual Técnico do Edifício
              </h3>
              <p className="text-[11px] text-slate-600">Mapeamento dinâmico por andar. Os equipamentos customizados são plotados abaixo.</p>
            </div>

            {/* Simulated Floors schematic — uma linha por piso real deste
                prédio (pisosReais), de cima para baixo, em vez de grupos
                fixos ("1º ao 3º") que já não cobriam os pisos 4º/5º reais
                desta morada. */}
            <div className="border rounded-xl overflow-hidden bg-slate-950 text-white p-4 space-y-3 font-mono text-xs">
              {[...pisosReais].reverse().map(piso => {
                const equipamentosDoPiso = equipamentos.filter(e => e.andar === piso);
                const emoji = piso === "Cobertura" ? "🏢" : piso === "Exterior" ? "🌳" : piso.includes("Cave") || piso.includes("Garagem") ? "🚗" : piso.includes("Loja") ? "🏪" : "🏢";
                return (
                  <div key={piso} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex justify-between items-center hover:border-slate-700 transition-colors">
                    <span className="font-bold text-slate-600">{emoji} {piso.toUpperCase()}:</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {equipamentosDoPiso.map(e => (
                        <span key={e.id} className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold" title={e.detalhes}>
                          ⚙️ {e.nome.split(" ")[0]}
                        </span>
                      ))}
                      {equipamentosDoPiso.length === 0 && (
                        <span className="text-[9px] text-slate-600">Nenhum equipamento</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Equipment table list */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600">Listagem de Equipamentos Registados</h3>
            
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {equipamentos.map(e => (
                <div key={e.id} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:border-slate-300 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] bg-slate-200 dark:bg-slate-800 px-2 rounded font-mono font-bold">ID: {e.id}</span>
                      <span className="text-[10px] bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 px-2 rounded font-bold font-mono">{e.categoria}</span>
                      <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
                        e.tipo === "inspeção_obrigatoria"
                          ? "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400"
                          : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400"
                      }`}>
                        {e.tipo === "inspeção_obrigatoria" ? "Obrigatória (Lei)" : "Facultativa"}
                      </span>
                      <span className={`text-[9px] px-2 rounded font-bold uppercase ${
                        e.estado === "Excelente" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400" :
                        e.estado === "Operacional" ? "bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400" :
                        e.estado === "Necessita Manutenção" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400" :
                        "bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400 animate-pulse"
                      }`}>
                        {e.estado}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{e.nome}</h4>
                    <p className="text-[11px] text-slate-600 font-medium leading-tight">{e.detalhes}</p>

                    <div className="flex gap-3 text-[10px] text-slate-600 pt-1 font-semibold flex-wrap">
                      <span>Piso: <strong className="text-slate-600 dark:text-slate-300">{e.andar}</strong></span>
                      <span>•</span>
                      <span>Fabricante: <strong className="text-slate-600 dark:text-slate-300">{e.fabricante || "N/A"}</strong></span>
                      <span>•</span>
                      <span>Última inspeção: <strong className="text-slate-600 dark:text-slate-300">{e.ultimaInspecao || "Nunca"} ({e.frequenciaInspecao})</strong></span>
                      {e.entidadeResponsavel && (
                        <>
                          <span>•</span>
                          <span>Entidade: <strong className="text-slate-600 dark:text-slate-300">{e.entidadeResponsavel}</strong></span>
                        </>
                      )}
                      {e.numLicencaAutorizacao && (
                        <>
                          <span>•</span>
                          <span>Licença: <strong className="text-slate-600 dark:text-slate-300">{e.numLicencaAutorizacao}</strong></span>
                        </>
                      )}
                    </div>

                    {e.proximaInspecaoData && (() => {
                      const diasRestantes = Math.ceil((new Date(e.proximaInspecaoData).getTime() - Date.now()) / 86400000);
                      const prazo = e.diasAlertaAntecedencia ?? 30;
                      const aVencer = diasRestantes <= prazo;
                      return (
                        <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg border ${
                          diasRestantes < 0 ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400" :
                          aVencer ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400" :
                          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400"
                        }`}>
                          <CalendarCheck className="h-3 w-3" />
                          {diasRestantes < 0
                            ? `Inspeção vencida há ${Math.abs(diasRestantes)} dias (${formatDatePT(e.proximaInspecaoData)})`
                            : `Próxima inspeção: ${formatDatePT(e.proximaInspecaoData)} (${diasRestantes} dias)`}
                        </div>
                      );
                    })()}

                    {e.fotos && e.fotos.length > 0 && (
                      <div className="flex gap-1.5 pt-1">
                        {e.fotos.map((f, i) => (
                          <a key={i} href={f} target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 hover:scale-110 transition-transform">
                            <img src={f} className="h-full w-full object-cover" alt="" />
                          </a>
                        ))}
                      </div>
                    )}

                    {e.historicoVistorias && e.historicoVistorias.length > 0 && (
                      <div className="pt-1.5 space-y-1 border-t border-slate-200 dark:border-slate-800 mt-1.5">
                        <span className="text-[9px] font-bold text-slate-600 uppercase block">Histórico de Vistorias ({e.historicoVistorias.length})</span>
                        {e.historicoVistorias.slice(0, 3).map(v => (
                          <div key={v.id} className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
                              <span className="text-slate-600 dark:text-slate-400">{formatDatePT(v.data)}</span>
                              <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                                v.resultado === "Aprovado" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" :
                                v.resultado === "Aprovado com Reservas" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" :
                                "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                              }`}>{v.resultado}</span>
                              <span className="text-slate-600 dark:text-slate-400">— {v.tecnico}</span>
                              {v.documentoUrl && (
                                <a href={v.documentoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-bold flex items-center gap-0.5">
                                  <Paperclip className="h-2.5 w-2.5" /> certificado
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => iniciarEdicaoVistoria(e, v)}
                                title="Editar esta vistoria"
                                aria-label="Editar esta vistoria"
                                className="text-slate-600 hover:text-indigo-600 active:text-indigo-700 active:scale-90 transition-all cursor-pointer"
                              >
                                <Pencil className="h-2.5 w-2.5" />
                              </button>
                            </div>
                            {/* Custo desta inspeção concreta — ligado à sua
                                própria data, nunca repartido pelas frações. */}
                            {(v.custo != null || v.fornecedorInspecaoNome || v.fornecedorManutencaoNome) && (
                              <div className="flex items-center gap-1.5 text-[9px] text-slate-600 dark:text-slate-500 flex-wrap pl-0.5">
                                {v.fornecedorInspecaoNome && <span>Inspeção: <strong>{v.fornecedorInspecaoNome}</strong></span>}
                                {v.fornecedorManutencaoNome && <span>Manutenção: <strong>{v.fornecedorManutencaoNome}</strong></span>}
                                {v.custo != null && (
                                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{v.custo.toFixed(2)}€</span>
                                )}
                                {v.custo != null && (
                                  v.id_movimento ? (
                                    <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                      <Check className="h-2.5 w-2.5" /> lançado
                                    </span>
                                  ) : (
                                    <span className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold">não lançado</span>
                                  )
                                )}
                                {v.comprovativoPagamentoUrl && (
                                  <a href={v.comprovativoPagamentoUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-bold flex items-center gap-0.5">
                                    <FileText className="h-2.5 w-2.5" /> fatura
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => abrirRegistarVistoria(e)}
                      className="p-1.5 rounded-lg border bg-white dark:bg-slate-900 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 active:border-emerald-400 active:bg-emerald-50 active:scale-95 transition-all cursor-pointer shadow-sm"
                      title="Registar Vistoria"
                      aria-label="Registar Vistoria"
                    >
                      <CalendarCheck className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => iniciarEdicao(e)}
                      className="p-1.5 rounded-lg border bg-white dark:bg-slate-900 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 active:border-indigo-400 active:bg-indigo-50 active:scale-95 transition-all cursor-pointer shadow-sm"
                      title="Editar Equipamento"
                      aria-label="Editar Equipamento"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleRemove(e.id)}
                      className="p-1.5 rounded-lg border bg-white dark:bg-slate-900 text-slate-600 hover:text-red-500 hover:border-red-200 active:border-red-400 active:bg-red-50 active:scale-95 transition-all cursor-pointer shadow-sm"
                      title="Remover Equipamento"
                      aria-label="Remover Equipamento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Modal: Registar Vistoria (agendada ou avulsa) */}
      {vistoriaTargetId && (() => {
        const eqAlvo = equipamentos.find(eq => eq.id === vistoriaTargetId);
        if (!eqAlvo) return null;
        return (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-emerald-500" /> {vistoriaEditId ? "Editar Vistoria" : "Registar Vistoria"}
                  </h3>
                  <p className="text-[11px] text-slate-600">{eqAlvo.nome} — {eqAlvo.categoria}</p>
                </div>
                <button
                  onClick={() => { setVistoriaTargetId(null); setVistoriaEditId(null); }}
                  className="p-1.5 text-slate-600 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title="Fechar"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleGravarVistoria} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Data da Vistoria</label>
                    <input
                      type="date"
                      value={vistoriaData}
                      onChange={e => setVistoriaData(e.target.value)}
                      required
                      className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Resultado</label>
                    <select
                      value={vistoriaResultado}
                      onChange={e => setVistoriaResultado(e.target.value as any)}
                      className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold cursor-pointer"
                    >
                      <option value="Aprovado">Aprovado</option>
                      <option value="Aprovado com Reservas">Aprovado com Reservas</option>
                      <option value="Reprovado">Reprovado</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Técnico / Entidade que Realizou</label>
                  <input
                    type="text"
                    value={vistoriaTecnico}
                    onChange={e => setVistoriaTecnico(e.target.value)}
                    placeholder="Ex: João Silva (TKE)"
                    className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Observações</label>
                  <textarea
                    value={vistoriaObservacoes}
                    onChange={e => setVistoriaObservacoes(e.target.value)}
                    rows={3}
                    placeholder="Observações técnicas da vistoria..."
                    className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Nº de Certificado desta Inspeção (Opcional)</label>
                  <input
                    type="text"
                    value={vistoriaNumCertificado}
                    onChange={e => setVistoriaNumCertificado(e.target.value)}
                    placeholder="Ex: 2026/CERT/4821"
                    className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Certificado de Inspeção (Opcional)</label>
                  {/* Documento já anexado (só em edição) — antes não havia
                      nenhuma forma de o remover, só de o substituir por um
                      novo. Pedido explícito: documento errado/formato não
                      reconhecido tem de poder ser removido. */}
                  {vistoriaEditId && vistoriaDocExistente && !vistoriaDocRemovido && !vistoriaDocFile && (
                    <div className="flex items-center justify-between gap-2 mb-1.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-lg px-2.5 py-1.5">
                      <a href={vistoriaDocExistente.url} target="_blank" rel="noopener noreferrer" className="text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1.5 truncate">
                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{vistoriaDocExistente.nome || "Documento atual"}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setVistoriaDocRemovido(true)}
                        title="Remover este documento"
                        aria-label="Remover este documento"
                        className="text-red-600 hover:text-red-700 active:scale-90 transition-all cursor-pointer shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {vistoriaEditId && vistoriaDocRemovido && (
                    <div className="flex items-center justify-between gap-2 mb-1.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg px-2.5 py-1.5">
                      <span className="text-red-700 dark:text-red-400 text-[11px] font-semibold">Documento marcado para remoção ao gravar.</span>
                      <button
                        type="button"
                        onClick={() => setVistoriaDocRemovido(false)}
                        className="text-[10px] text-slate-600 hover:underline cursor-pointer shrink-0"
                      >
                        Desfazer
                      </button>
                    </div>
                  )}
                  <input ref={vistoriaDocInputRef} type="file" accept=".pdf,image/*" onChange={e => setVistoriaDocFile(e.target.files?.[0] || null)} className="hidden" />
                  <button
                    type="button"
                    onClick={() => vistoriaDocInputRef.current?.click()}
                    className="w-full border border-dashed p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:border-emerald-400 hover:text-emerald-600"
                  >
                    <Paperclip className="h-4 w-4" />
                    <span>{vistoriaDocFile ? vistoriaDocFile.name : vistoriaDocExistente && !vistoriaDocRemovido ? "Substituir Comprovativo (PDF/Foto)" : "Anexar Comprovativo (PDF/Foto)"}</span>
                  </button>
                </div>

                {/* Custo desta inspeção — entidade oficial de inspeção e
                    empresa de manutenção que acompanha são 2 papéis
                    distintos; o custo sai sempre da conta do prédio, nunca
                    repartido pelas frações. Ligado à data desta vistoria
                    (pedido explícito: "falta a data da inspeção"). */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
                  <h5 className="text-[10px] font-black uppercase text-slate-600 flex items-center gap-1.5">
                    <Landmark className="h-3.5 w-3.5 text-indigo-500" /> Custo desta Inspeção (Opcional)
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Entidade Oficial de Inspeção</label>
                      <select value={vistoriaFornInspecaoId} onChange={ev => { setVistoriaFornInspecaoId(ev.target.value); setVistoriaFornInspecaoNome(""); }} className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs cursor-pointer">
                        <option value="">— Escolher fornecedor registado —</option>
                        {fornecedores.filter(f => f.id_predio === predio.id_predio).map(f => (
                          <option key={f.id_fornecedor} value={f.id_fornecedor}>{f.nome}</option>
                        ))}
                      </select>
                      {!vistoriaFornInspecaoId && (
                        <input type="text" value={vistoriaFornInspecaoNome} onChange={ev => setVistoriaFornInspecaoNome(ev.target.value)} placeholder="Ou nome (ainda sem ficha)..." className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs mt-1.5" />
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Empresa de Manutenção (acompanha)</label>
                      <select value={vistoriaFornManutencaoId} onChange={ev => { setVistoriaFornManutencaoId(ev.target.value); setVistoriaFornManutencaoNome(""); }} className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs cursor-pointer">
                        <option value="">— Escolher fornecedor registado —</option>
                        {fornecedores.filter(f => f.id_predio === predio.id_predio).map(f => (
                          <option key={f.id_fornecedor} value={f.id_fornecedor}>{f.nome}</option>
                        ))}
                      </select>
                      {!vistoriaFornManutencaoId && (
                        <input type="text" value={vistoriaFornManutencaoNome} onChange={ev => setVistoriaFornManutencaoNome(ev.target.value)} placeholder="Ou nome (ainda sem ficha)..." className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs mt-1.5" />
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Custo (€)</label>
                      <input type="text" value={vistoriaCusto} onChange={ev => setVistoriaCusto(ev.target.value)} placeholder="Ex: 85,00" className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Conta Bancária de Pagamento</label>
                      <select value={vistoriaContaPagamento} onChange={ev => setVistoriaContaPagamento(ev.target.value)} className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs cursor-pointer">
                        <option value="">— Escolher conta do prédio —</option>
                        {contas.filter(c => c.id_predio === predio.id_predio).map(c => (
                          <option key={c.id_conta} value={c.id_conta}>{c.banco} ({c.tipo})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {vistoriaIdMovimentoExistente ? (
                    <p className="text-[10px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5">
                      <Check className="h-3 w-3" /> Custo já lançado como movimento nesta conta — a corrigir só os outros dados, sem lançar de novo.
                    </p>
                  ) : (
                    <p className="text-[9px] text-slate-600">Ao gravar, se indicar custo e conta, cria logo o movimento de despesa (com a data desta vistoria) e desconta da conta do prédio — nunca repartido pelas frações.</p>
                  )}

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Fatura / Comprovativo de Pagamento (Opcional)</label>
                    {vistoriaEditId && vistoriaFaturaExistente && !vistoriaFaturaRemovida && !vistoriaFaturaFile && (
                      <div className="flex items-center justify-between gap-2 mb-1.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-lg px-2.5 py-1.5">
                        <a href={vistoriaFaturaExistente} target="_blank" rel="noopener noreferrer" className="text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1.5 truncate">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">Fatura atual</span>
                        </a>
                        <button type="button" onClick={() => setVistoriaFaturaRemovida(true)} title="Remover esta fatura" aria-label="Remover esta fatura" className="text-red-600 hover:text-red-700 active:scale-90 transition-all cursor-pointer shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {vistoriaEditId && vistoriaFaturaRemovida && (
                      <div className="flex items-center justify-between gap-2 mb-1.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg px-2.5 py-1.5">
                        <span className="text-red-700 dark:text-red-400 text-[11px] font-semibold">Fatura marcada para remoção ao gravar.</span>
                        <button type="button" onClick={() => setVistoriaFaturaRemovida(false)} className="text-[10px] text-slate-600 hover:underline cursor-pointer shrink-0">Desfazer</button>
                      </div>
                    )}
                    <input ref={vistoriaFaturaInputRef} type="file" accept=".pdf,image/*" onChange={ev => setVistoriaFaturaFile(ev.target.files?.[0] || null)} className="hidden" />
                    <button
                      type="button"
                      onClick={() => vistoriaFaturaInputRef.current?.click()}
                      className="w-full border border-dashed p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:border-emerald-400 hover:text-emerald-600"
                    >
                      <Upload className="h-4 w-4" />
                      <span>{vistoriaFaturaFile ? vistoriaFaturaFile.name : vistoriaFaturaExistente && !vistoriaFaturaRemovida ? "Substituir Fatura (PDF/Foto)" : "Anexar Fatura/Recibo (PDF/Foto)"}</span>
                    </button>
                  </div>
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl p-2.5 text-[10px] text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 shrink-0" />
                  <span>A gravar, a validade é atualizada e a próxima inspeção fica agendada automaticamente para <strong>{formatDatePT(calcularProximaInspecao(vistoriaData, eqAlvo.frequenciaInspecao || "Anual"))}</strong> ({eqAlvo.frequenciaInspecao || "Anual"}), com alerta {eqAlvo.diasAlertaAntecedencia ?? 30} dias antes.</span>
                </div>

                <button
                  type="submit"
                  disabled={aGravarVistoria}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-2 rounded-lg text-xs cursor-pointer shadow flex items-center justify-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>{aGravarVistoria ? "A gravar..." : vistoriaEditId ? "Guardar Alterações" : "Concluir Vistoria"}</span>
                </button>
              </form>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
