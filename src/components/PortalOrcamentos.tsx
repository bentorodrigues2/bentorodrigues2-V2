import React, { useState, useEffect } from "react";
import { Predio, Fracao, Fornecedor, LoggedUser } from "../types";
import { Loader2, ShieldCheck, BadgeAlert, Sparkles, Building, Coins, Calendar, Plus, ExternalLink, ThumbsUp, Table, FileText, CheckCircle2, XCircle, Paperclip, HardHat, Wrench, PiggyBank } from "lucide-react";
import {
  fetchRfpsFromSupabase,
  saveRfpToSupabase,
  fetchPropostasFromSupabase,
  savePropostaToSupabase,
  uploadPropostaFicheiros,
  saveFornecedorToSupabase,
  saveObraExtraToSupabase,
  saveIntervencaoToSupabase,
  registarLogAuditoria
} from "../lib/supabaseService";
import type { ObraExtraordinaria, Intervencao } from "./GestaoManutencaoIntervencoes";

interface RequestForProposal {
  id_rfp: string;
  id_predio: string;
  titulo: string;
  categoria: string;
  estimativa: number;
  data_publicacao: string;
  data_limite: string;
  descricao: string;
  estado: "Aberto" | "Adjudicado" | "Cancelado";
  fornecedor_adjudicado?: string;
}

interface Proposal {
  id_proposal: string;
  id_rfp: string;
  nome_empresa: string;
  nif: string;
  email: string;
  contacto: string;
  valor: number;
  prazo_dias: number;
  garantia_anos: number;
  descricao_tecnica: string;
  ficheiro_nome: string;
  ficheiro_caminho?: string;
  data_submissao: string;
  // Vários anexos por proposta (proposta comercial, fichas técnicas,
  // seguros, certificações) — em vez de um único ficheiro.
  anexos?: { nome: string; caminho: string }[];
  // Aprovar ou rejeitar cada proposta individualmente, em vez de a única
  // decisão possível ser adjudicar o concurso inteiro.
  estado?: "Pendente" | "Aprovada" | "Rejeitada" | "Não Selecionada";
  motivo_rejeicao?: string;
  // Preenchidos quando aprovada: para onde foi a obra/intervenção real
  // criada, e se vai ser paga a partir do Fundo de Reserva Comum.
  destino_obra?: "obra_extraordinaria" | "intervencao";
  usa_fundo_reserva?: boolean;
  id_obra_criada?: string;
}

interface ComparativeResponse {
  comparisonMatrix: Array<{
    criterion: string;
    supplierA: string;
    supplierB: string;
    supplierC?: string;
    winner: string;
  }>;
  analysis: {
    [key: string]: {
      pros: string[];
      cons: string[];
      score: number;
    };
  };
  recommendation: string;
}

interface PortalOrcamentosProps {
  predio: Predio;
  fracoes: Fracao[];
  fornecedores: Fornecedor[];
  onAddFornecedor: (novo: Fornecedor) => void;
  loggedUser: LoggedUser;
}

export function PortalOrcamentos({
  predio,
  fracoes,
  fornecedores,
  onAddFornecedor,
  loggedUser,
}: PortalOrcamentosProps) {
  // RFPs (concursos) do prédio — carregados do Supabase, nunca fictícios.
  const [rfps, setRfps] = useState<RequestForProposal[]>([]);
  const [carregandoRfps, setCarregandoRfps] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setCarregandoRfps(true);
    fetchRfpsFromSupabase(predio.id_predio).then(dados => {
      if (!cancelado) {
        setRfps(dados || []);
        setCarregandoRfps(false);
      }
    });
    return () => { cancelado = true; };
  }, [predio.id_predio]);

  // Propostas — carregadas sob pedido para o concurso selecionado.
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [carregandoPropostas, setCarregandoPropostas] = useState(false);

  // Form states for new RFP (Admin only)
  const [showRfpForm, setShowRfpForm] = useState(false);
  const [rfpTitulo, setRfpTitulo] = useState("");
  const [rfpCategoria, setRfpCategoria] = useState("");
  const [rfpEstimativa, setRfpEstimativa] = useState("");
  const [rfpLimite, setRfpLimite] = useState("");
  const [rfpDescricao, setRfpDescricao] = useState("");

  // Form states for new Proposal (External Vendor / Partner)
  const [selectedRfpId, setSelectedRfpId] = useState<string>("");
  const [propEmpresa, setPropEmpresa] = useState("");
  const [propNif, setPropNif] = useState("");
  const [propEmail, setPropEmail] = useState("");
  const [propContacto, setPropContacto] = useState("");
  const [propValor, setPropValor] = useState("");
  const [propPrazo, setPropPrazo] = useState("");
  const [propGarantia, setPropGarantia] = useState("");
  const [propDescricao, setPropDescricao] = useState("");
  const [propFicheiros, setPropFicheiros] = useState<File[]>([]);

  // IA comparative analysis states
  const [isComparing, setIsComparing] = useState(false);
  const [compareLog, setCompareLog] = useState<string[]>([]);
  const [selectedRfpForAnalysis, setSelectedRfpForAnalysis] = useState<string>("");
  const [aiResult, setAiResult] = useState<ComparativeResponse | null>(null);

  const predioRfps = rfps.filter(r => r.id_predio === predio.id_predio);
  const activeRfp = rfps.find(r => r.id_rfp === selectedRfpForAnalysis);
  const activeRfpProposals = proposals.filter(p => p.id_rfp === selectedRfpForAnalysis);

  // Seleciona automaticamente o primeiro concurso assim que os reais chegam.
  useEffect(() => {
    if (!selectedRfpForAnalysis && predioRfps.length > 0) {
      setSelectedRfpForAnalysis(predioRfps[0].id_rfp);
    }
  }, [predioRfps, selectedRfpForAnalysis]);

  // Carrega as propostas reais do concurso selecionado.
  useEffect(() => {
    let cancelado = false;
    if (!selectedRfpForAnalysis) return;
    setCarregandoPropostas(true);
    fetchPropostasFromSupabase(selectedRfpForAnalysis).then(dados => {
      if (cancelado) return;
      setProposals(prev => [
        ...prev.filter(p => p.id_rfp !== selectedRfpForAnalysis),
        ...(dados || [])
      ]);
      setCarregandoPropostas(false);
    });
    return () => { cancelado = true; };
  }, [selectedRfpForAnalysis]);

  // Submit New RFP
  const [publicandoRfp, setPublicandoRfp] = useState(false);
  const handleLancarRfp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedUser.role !== "ADMIN") return alert("Apenas administradores podem lançar pedidos de orçamento.");
    if (!rfpTitulo || !rfpCategoria || !rfpEstimativa || !rfpLimite || !rfpDescricao) {
      return alert("Por favor preencha todos os campos obrigatórios (*)");
    }

    const novoRfp: RequestForProposal = {
      id_rfp: "rfp-" + Date.now() + "-" + Math.floor(Math.random() * 100),
      id_predio: predio.id_predio,
      titulo: rfpTitulo,
      categoria: rfpCategoria,
      estimativa: Number(rfpEstimativa),
      data_publicacao: new Date().toISOString().split("T")[0],
      data_limite: rfpLimite,
      descricao: rfpDescricao,
      estado: "Aberto"
    };

    setPublicandoRfp(true);
    const ok = await saveRfpToSupabase({ ...novoRfp, criado_por: loggedUser.nome });
    setPublicandoRfp(false);

    if (!ok) {
      alert("❌ Erro ao publicar o concurso no Supabase. Tente novamente.");
      return;
    }

    setRfps([...rfps, novoRfp]);
    setSelectedRfpForAnalysis(novoRfp.id_rfp);
    alert(`Concurso Público/RFP "${rfpTitulo}" publicado no portal de orçamentos com sucesso!`);

    // Reset Form
    setRfpTitulo("");
    setRfpCategoria("");
    setRfpEstimativa("");
    setRfpLimite("");
    setRfpDescricao("");
    setShowRfpForm(false);
  };

  // Submit Proposal from Supplier
  const [submetendoProposta, setSubmetendoProposta] = useState(false);
  const handleSubmeterProposta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRfpId) return alert("Selecione primeiro o pedido de orçamento correspondente.");
    if (!propEmpresa || !propNif || !propEmail || !propContacto || !propValor || !propPrazo || !propGarantia || !propDescricao) {
      return alert("Preencha todos os campos obrigatórios (*) para submeter a proposta.");
    }

    setSubmetendoProposta(true);

    const idProposal = "prop-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    const anexos = await uploadPropostaFicheiros(propFicheiros, selectedRfpId, idProposal);

    const novaProposta: Proposal = {
      id_proposal: idProposal,
      id_rfp: selectedRfpId,
      nome_empresa: propEmpresa,
      nif: propNif,
      email: propEmail,
      contacto: propContacto,
      valor: Number(propValor),
      prazo_dias: Number(propPrazo),
      garantia_anos: Number(propGarantia),
      descricao_tecnica: propDescricao,
      ficheiro_nome: anexos[0]?.nome || "proposta_assinada_eletronicamente.pdf",
      ficheiro_caminho: anexos[0]?.caminho || undefined,
      anexos,
      estado: "Pendente",
      data_submissao: new Date().toISOString().split("T")[0]
    };

    const ok = await savePropostaToSupabase(novaProposta);
    setSubmetendoProposta(false);

    if (!ok) {
      alert("❌ Erro ao submeter a proposta no Supabase. Tente novamente.");
      return;
    }

    setProposals([...proposals, novaProposta]);
    setSelectedRfpForAnalysis(selectedRfpId);
    alert(`Parabéns! A proposta da empresa "${propEmpresa}" foi registada com sucesso para análise.\nNIF: ${propNif}\nValor: ${Number(propValor).toLocaleString("pt-PT")} €`);

    // Reset Form
    setPropEmpresa("");
    setPropNif("");
    setPropEmail("");
    setPropContacto("");
    setPropValor("");
    setPropPrazo("");
    setPropGarantia("");
    setPropDescricao("");
    setPropFicheiros([]);
    setSelectedRfpId("");
  };

  // Compare Proposals using server-side Gemini 3.5 Flash
  const triggerIaComparison = async () => {
    const targetRfp = rfps.find(r => r.id_rfp === selectedRfpForAnalysis);
    if (!targetRfp) return alert("Pedido de orçamento inválido.");

    const activeProps = proposals.filter(p => p.id_rfp === selectedRfpForAnalysis);
    if (activeProps.length < 2) {
      return alert("Para efetuar uma comparação inteligente por IA, necessita de ter pelo menos 2 propostas submetidas no concurso.");
    }

    setIsComparing(true);
    setCompareLog([
      "A contactar o motor de inteligência artificial Gemini 3.5 Flash...",
      "A indexar o caderno de encargos e estimativa orçamental...",
      "A processar propostas dos fornecedores submetidas no portal...",
    ]);

    // Build standard proposals array for backend API
    const formattedProposals = activeProps.map(p => ({
      name: p.nome_empresa,
      nif: p.nif,
      value: p.valor,
      timeframe: `${p.prazo_dias} dias`,
      guarantee: `${p.garantia_anos} anos`,
      description: p.descricao_tecnica
    }));

    try {
      // Simulate real step updates for visual feedback
      setTimeout(() => {
        setCompareLog(prev => [
          ...prev,
          "A cruzar preços, garantias e prazos propostos...",
          "A cruzar os requisitos técnicos com as especificidades do edifício...",
          "A detetar riscos de conformidade jurídica com a lei do condomínio (Código Civil)..."
        ]);
      }, 1000);

      const rfpDetails = `Título: ${targetRfp.titulo}\nCategoria: ${targetRfp.categoria}\nEstimativa Máxima: ${targetRfp.estimativa} EUR\nDescrição Técnica: ${targetRfp.descricao}`;

      const response = await fetch("/api/compare-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestDescription: rfpDetails,
          proposals: formattedProposals
        })
      });

      if (!response.ok) {
        throw new Error("Ocorreu um erro no servidor durante a análise comparativa.");
      }

      const result: ComparativeResponse = await response.json();
      
      setTimeout(() => {
        setCompareLog(prev => [...prev, "Matriz comparativa estruturada.", "Análise final de recomendação gerada com sucesso!"]);
        setAiResult(result);
        setIsComparing(false);
      }, 2000);

    } catch (error: any) {
      console.error(error);
      alert("Erro ao analisar com IA: " + error.message);
      setIsComparing(false);
    }
  };

  // Aprovar (adjudicar) ou rejeitar cada proposta — antes só existia
  // "Adjudicar", que fechava o concurso mas nunca criava nenhuma Obra
  // Extraordinária ou Intervenção real: o trabalho ficava só "adjudicado"
  // no papel, sem nada em Manutenção para o admin gerir a seguir.
  const [adjudicando, setAdjudicando] = useState(false);
  const [rejeitando, setRejeitando] = useState(false);
  const [painelAdjudicacaoId, setPainelAdjudicacaoId] = useState<string | null>(null);
  const [destinoObraEscolhido, setDestinoObraEscolhido] = useState<"obra_extraordinaria" | "intervencao">("obra_extraordinaria");
  const [usaFundoReservaEscolhido, setUsaFundoReservaEscolhido] = useState(false);
  const [painelRejeicaoId, setPainelRejeicaoId] = useState<string | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");

  const handleRejeitarProposta = async (proposal: Proposal) => {
    if (!motivoRejeicao.trim()) return alert("Indique o motivo da rejeição.");
    setRejeitando(true);
    const propostaAtualizada: Proposal = { ...proposal, estado: "Rejeitada", motivo_rejeicao: motivoRejeicao.trim() };
    const ok = await savePropostaToSupabase(propostaAtualizada);
    setRejeitando(false);
    if (!ok) {
      alert("❌ Erro ao registar a rejeição no Supabase. Tente novamente.");
      return;
    }
    setProposals(prev => prev.map(p => p.id_proposal === proposal.id_proposal ? propostaAtualizada : p));
    registarLogAuditoria("Fornecedores", "Rejeitou uma proposta do Portal de Orçamentos", predio.id_predio, loggedUser, `${proposal.nome_empresa} — ${motivoRejeicao.trim()}`);
    setPainelRejeicaoId(null);
    setMotivoRejeicao("");
  };

  const handleAdjudicarProposta = async (proposal: Proposal) => {
    const rfpAlvo = rfps.find(r => r.id_rfp === proposal.id_rfp);
    if (!rfpAlvo) return;

    setAdjudicando(true);

    // 1. Mark RFP as Adjudicated (Supabase real, não só estado local)
    const rfpAtualizado: RequestForProposal = { ...rfpAlvo, estado: "Adjudicado", fornecedor_adjudicado: proposal.nome_empresa };
    const okRfp = await saveRfpToSupabase({ ...rfpAtualizado, criado_por: loggedUser.nome });
    if (!okRfp) {
      setAdjudicando(false);
      alert("❌ Erro ao registar a adjudicação no Supabase. Tente novamente.");
      return;
    }
    setRfps(prev => prev.map(r => r.id_rfp === proposal.id_rfp ? rfpAtualizado : r));

    // 2. Auto-register supplier as active Fornecedor in the system
    const fornecedorExistente = fornecedores.find(f => f.nif === proposal.nif && f.id_predio === predio.id_predio);
    let idFornecedor = fornecedorExistente?.id_fornecedor;
    if (!fornecedorExistente) {
      idFornecedor = "forn-auto-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
      const novoFornecedor: Fornecedor = {
        id_fornecedor: idFornecedor,
        id_predio: predio.id_predio,
        nome: proposal.nome_empresa,
        nif: proposal.nif,
        categoria: rfpAlvo.categoria || "Serviços Gerais",
        email_contacto: proposal.email,
        contacto: proposal.contacto
      };
      onAddFornecedor(novoFornecedor);
      await saveFornecedorToSupabase(novoFornecedor);
    }

    // 3. Cria a Obra Extraordinária ou a Intervenção (Reparação) REAL — é
    // aqui que o trabalho adjudicado passa mesmo a aparecer em Manutenção
    // para o administrador gerir, em vez de "adjudicado" ficar só no papel.
    const hoje = new Date().toISOString().split("T")[0];
    const dataFimEstimada = new Date(Date.now() + (proposal.prazo_dias || 30) * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    let idObraCriada: string;

    if (destinoObraEscolhido === "obra_extraordinaria") {
      const valoresPorFracao: { [fracaoId: string]: number } = {};
      (fracoes || []).forEach(f => {
        valoresPorFracao[f.id_fracao] = (proposal.valor * (f.permilagem || 0)) / 1000;
      });
      const novaObra: ObraExtraordinaria = {
        id: "obr-" + Date.now(),
        descricao: `${rfpAlvo.titulo} (via Portal de Orçamentos)`,
        fornecedorId: idFornecedor || "forn-custom",
        fornecedorNome: proposal.nome_empresa,
        dataInicio: hoje,
        dataFim: dataFimEstimada,
        custoTotal: proposal.valor,
        necessitaCotaExtra: !usaFundoReservaEscolhido,
        mesesFracionamento: 1,
        valoresPorFracao,
        impactoFundoReserva: Math.round(proposal.valor * 0.10 * 100) / 100,
        impactoSaldoAnual: -proposal.valor,
        estado: "Planeada",
        orcamentos: (proposal.anexos || []).map(a => a.nome),
        documentosArquivados: false,
        usaFundoReserva: usaFundoReservaEscolhido,
        id_rfp: rfpAlvo.id_rfp,
        id_proposta: proposal.id_proposal
      };
      idObraCriada = novaObra.id;
      const okObra = await saveObraExtraToSupabase(predio.id_predio, novaObra);
      if (!okObra) {
        setAdjudicando(false);
        alert("⚠️ Fornecedor registado e concurso adjudicado, mas houve um erro a criar a Obra Extraordinária. Crie-a manualmente em Manutenção → Obras Extraordinárias.");
        return;
      }
    } else {
      const novaIntervencao: Intervencao = {
        id: "int-" + Date.now(),
        descricao: `${rfpAlvo.titulo} (via Portal de Orçamentos)`,
        id_fracao: "common",
        prioridade: "Média",
        fornecedor: proposal.nome_empresa,
        custoPrevisto: proposal.valor,
        estado: "Pendente",
        anoExercicio: new Date().getFullYear().toString(),
        validadoAdmin: false,
        id_rfp: rfpAlvo.id_rfp,
        id_proposta: proposal.id_proposal
      };
      idObraCriada = novaIntervencao.id;
      const okInt = await saveIntervencaoToSupabase(predio.id_predio, novaIntervencao);
      if (!okInt) {
        setAdjudicando(false);
        alert("⚠️ Fornecedor registado e concurso adjudicado, mas houve um erro a criar a Intervenção. Crie-a manualmente em Manutenção → Intervenções.");
        return;
      }
    }

    // 4. Marca esta proposta como Aprovada e todas as outras do mesmo
    // concurso como "Não Selecionada" (não é uma rejeição ativa — só
    // deixaram de ser a opção escolhida, distinto de quem foi rejeitada
    // explicitamente antes de haver decisão).
    const propostaAprovada: Proposal = {
      ...proposal,
      estado: "Aprovada",
      destino_obra: destinoObraEscolhido,
      usa_fundo_reserva: destinoObraEscolhido === "obra_extraordinaria" ? usaFundoReservaEscolhido : undefined,
      id_obra_criada: idObraCriada
    };
    await savePropostaToSupabase(propostaAprovada);

    const outrasPropostas = proposals.filter(p => p.id_rfp === proposal.id_rfp && p.id_proposal !== proposal.id_proposal && p.estado !== "Rejeitada");
    await Promise.all(outrasPropostas.map(p => savePropostaToSupabase({ ...p, estado: "Não Selecionada" })));

    setProposals(prev => prev.map(p => {
      if (p.id_proposal === proposal.id_proposal) return propostaAprovada;
      if (p.id_rfp === proposal.id_rfp && p.estado !== "Rejeitada") return { ...p, estado: "Não Selecionada" as const };
      return p;
    }));

    registarLogAuditoria(
      "Fornecedores",
      "Adjudicou uma proposta do Portal de Orçamentos",
      predio.id_predio,
      loggedUser,
      `${proposal.nome_empresa} — ${rfpAlvo.titulo} (${proposal.valor.toFixed(2)} €, ${destinoObraEscolhido === "obra_extraordinaria" ? "Obra Extraordinária" : "Intervenção"}${usaFundoReservaEscolhido ? ", Fundo de Reserva" : ""})`
    );

    setAdjudicando(false);
    setPainelAdjudicacaoId(null);
    alert(
      `CONTRATO ADJUDICADO COM SUCESSO!\n\n` +
      `Fornecedor: ${proposal.nome_empresa}\n` +
      `Serviço: ${rfpAlvo.titulo}\n` +
      `Valor: ${proposal.valor.toLocaleString("pt-PT")} €\n` +
      `Prazo: ${proposal.prazo_dias} dias\n` +
      `Criado em: ${destinoObraEscolhido === "obra_extraordinaria" ? "Manutenção → Obras Extraordinárias" : "Manutenção → Intervenções (Reparações)"}\n\n` +
      `O concurso foi fechado e o fornecedor integrado no registo oficial do condomínio.`
    );
  };

  return (
    <div className="space-y-6">
      {/* CABEÇALHO UNIFORMIZADO CONDOMANAGER AI */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-950 text-white p-6 rounded-2xl border border-emerald-500/30 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 opacity-10">
          <Building size={200} />
        </div>
        <div className="relative z-10 max-w-3xl space-y-2">
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-xs w-fit">
            <Sparkles size={12} className="text-emerald-300" />
            Portal Transparente de Orçamentação Inteligente
          </span>
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">Portal Público de Contratos & Propostas de Obras</h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
            Abra concursos para obras, receba propostas externas de empreiteiros de forma transparente, cruze garantias de orçamentação e utilize a Inteligência Artificial Gemini para comparar propostas e obter recomendações automáticas de adjudicação.
          </p>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: LISTA DE RFPS E FORMULÁRIO DE CANDIDATURA */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* LANÇAR NOVO CONCURSO (ADMIN) */}
          <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Concursos de Obras (RFP)</h3>
              {loggedUser.role === "ADMIN" && (
                <button
                  onClick={() => setShowRfpForm(!showRfpForm)}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer flex items-center"
                >
                  <Plus size={12} className="mr-1" /> Novo Concurso
                </button>
              )}
            </div>

            {showRfpForm && (
              <form onSubmit={handleLancarRfp} className="space-y-3 pt-2 text-xs border-t border-slate-100 dark:border-slate-800">
                <p className="font-semibold text-slate-700 dark:text-slate-300">Publicar Caderno de Encargos</p>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Título do Concurso *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Impermeabilização de Cobertura"
                    value={rfpTitulo}
                    onChange={e => setRfpTitulo(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Categoria *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Infraestrutura"
                      value={rfpCategoria}
                      onChange={e => setRfpCategoria(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Estimativa Máx (€) *</label>
                    <input
                      type="number"
                      required
                      placeholder="Ex: 5000"
                      value={rfpEstimativa}
                      onChange={e => setRfpEstimativa(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200 font-mono-custom"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Prazo de Candidatura *</label>
                  <input
                    type="date"
                    required
                    value={rfpLimite}
                    onChange={e => setRfpLimite(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200 font-mono-custom"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Descrição Detalhada / Memorial Descritivo *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Descrição das exigências e especificações técnicas..."
                    value={rfpDescricao}
                    onChange={e => setRfpDescricao(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200"
                  ></textarea>
                </div>
                <button
                  type="submit"
                  disabled={publicandoRfp}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 rounded shadow transition-all cursor-pointer"
                >
                  {publicandoRfp ? "A publicar..." : "Publicar Concurso Público"}
                </button>
              </form>
            )}

            {/* List RFPs */}
            <div className="space-y-3">
              {carregandoRfps ? (
                <p className="text-xs text-slate-400 text-center py-6 flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={13} /> A carregar concursos...
                </p>
              ) : predioRfps.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  Ainda não existem concursos publicados para este prédio.
                </p>
              ) : predioRfps.map(r => (
                <div
                  key={r.id_rfp}
                  onClick={() => {
                    setSelectedRfpForAnalysis(r.id_rfp);
                    setAiResult(null);
                  }}
                  className={`p-3.5 rounded-lg border text-xs transition-all cursor-pointer ${
                    selectedRfpForAnalysis === r.id_rfp
                      ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20"
                      : "border-slate-150 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white leading-normal">{r.titulo}</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{r.categoria}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                        r.estado === "Adjudicado"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {r.estado}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 font-mono-custom text-[10px] text-slate-500">
                    <div className="flex items-center space-x-1">
                      <Coins size={11} className="text-slate-400 shrink-0" />
                      <span>Estimativa: <strong>{r.estimativa.toLocaleString("pt-PT")} €</strong></span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar size={11} className="text-slate-400 shrink-0" />
                      <span>Até: <strong>{r.data_limite}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FORMULÁRIO DE SUBMISSÃO DE PROPOSTA — grava mesmo no Supabase
              (savePropostaToSupabase), não é uma simulação. */}
          <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
              <ExternalLink size={13} className="text-emerald-500 mr-1.5" />
              Submeter Proposta (Canal do Empreiteiro)
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Área pública destinada a construtores ou fornecedores externos para o envio de propostas técnicas e orçamentos comerciais.
            </p>

            <form onSubmit={handleSubmeterProposta} className="space-y-3 text-xs pt-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Selecionar Concurso Aberto *</label>
                <select
                  required
                  value={selectedRfpId}
                  onChange={e => setSelectedRfpId(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-800 p-2.5 rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                >
                  <option value="">-- Escolher Concurso --</option>
                  {predioRfps
                    .filter(r => r.estado === "Aberto")
                    .map(r => (
                      <option key={r.id_rfp} value={r.id_rfp}>
                        {r.titulo} (Est: {r.estimativa.toLocaleString("pt-PT")}€)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Nome Legal da Empresa *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Construtora das Avenidas, Lda"
                  value={propEmpresa}
                  onChange={e => setPropEmpresa(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">NIF Contribuinte *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 501234567"
                    value={propNif}
                    onChange={e => setPropNif(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200 font-mono-custom"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Contacto Telefónico *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 910200300"
                    value={propContacto}
                    onChange={e => setPropContacto(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200 font-mono-custom"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">E-mail de Contacto Oficial *</label>
                <input
                  type="email"
                  required
                  placeholder="Ex: comercial@construtora.pt"
                  value={propEmail}
                  onChange={e => setPropEmail(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200 font-mono-custom"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Valor Total *</label>
                  <input
                    type="number"
                    required
                    placeholder="Ex: 14500"
                    value={propValor}
                    onChange={e => setPropValor(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200 font-mono-custom"
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Prazo (Dias) *</label>
                  <input
                    type="number"
                    required
                    placeholder="Ex: 45"
                    value={propPrazo}
                    onChange={e => setPropPrazo(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200 font-mono-custom"
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Garantia (Anos) *</label>
                  <input
                    type="number"
                    required
                    placeholder="Ex: 5"
                    value={propGarantia}
                    onChange={e => setPropGarantia(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200 font-mono-custom"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Memória Descritiva / Especificações Técnicas *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detalhes dos materiais utilizados, marcas, métodos de intervenção ou seguros..."
                  value={propDescricao}
                  onChange={e => setPropDescricao(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-emerald-500 text-slate-700 dark:text-slate-200"
                ></textarea>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Anexos (Proposta, Fichas Técnicas, Seguros, Certificados...)</label>
                <div className="border border-dashed border-slate-250 dark:border-slate-800 rounded p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-900/40 relative cursor-pointer">
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    multiple
                    onChange={e => setPropFicheiros(Array.from(e.target.files || []))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <p className="font-semibold text-[11px] text-slate-600 dark:text-slate-300">
                    {propFicheiros.length > 0 ? `${propFicheiros.length} ficheiro(s) selecionado(s)` : "Clique para anexar um ou vários ficheiros"}
                  </p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Máx. 10MB por ficheiro</p>
                </div>
                {propFicheiros.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {propFicheiros.map((f, i) => (
                      <li key={i} className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Paperclip size={9} className="shrink-0" />
                        <span className="truncate">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => setPropFicheiros(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-red-500 hover:text-red-700 cursor-pointer ml-auto shrink-0"
                        >
                          <XCircle size={11} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                type="submit"
                disabled={submetendoProposta}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 rounded shadow transition-all cursor-pointer flex items-center justify-center space-x-1"
              >
                <span>{submetendoProposta ? "A submeter..." : "Submeter Proposta Comercial"}</span>
              </button>
            </form>
          </div>
        </div>

        {/* COLUNA DIREITA: DETALHE DO CONCURSO E COMPARATIVO IA */}
        <div className="lg:col-span-2 space-y-6">
          {activeRfp ? (
            <div className="space-y-6">
              
              {/* Caderno de Encargos Atual */}
              <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-6 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">{activeRfp.titulo}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Categoria: <strong>{activeRfp.categoria}</strong></p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Estimativa Limite</span>
                    <span className="text-base font-bold font-mono-custom text-emerald-600 dark:text-emerald-400">
                      {activeRfp.estimativa.toLocaleString("pt-PT")} €
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
                  {activeRfp.descricao}
                </p>

                <div className="flex justify-between items-center text-[11px] text-slate-500 font-mono-custom bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded border border-slate-100 dark:border-slate-800">
                  <span>Data Publicação: <strong>{activeRfp.data_publicacao}</strong></span>
                  <span>Propostas Recebidas: <strong className="text-emerald-600">{activeRfpProposals.length}</strong></span>
                </div>
              </div>

              {/* Propostas Recebidas */}
              <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Propostas Recebidas ({activeRfpProposals.length})</h3>
                  {activeRfpProposals.length >= 2 && activeRfp.estado === "Aberto" && (
                    <button
                      onClick={triggerIaComparison}
                      disabled={isComparing}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded text-xs shadow transition-all cursor-pointer flex items-center space-x-1.5"
                    >
                      {isComparing ? (
                        <Loader2 className="animate-spin" size={13} />
                      ) : (
                        <Sparkles size={13} className="text-amber-300 animate-pulse" />
                      )}
                      <span>Executar Análise Comparativa IA</span>
                    </button>
                  )}
                </div>

                {isComparing && (
                  <div className="bg-slate-950 text-emerald-400 p-4 rounded-xl border border-slate-800 font-mono-custom text-xs space-y-2">
                    <div className="flex justify-between items-center border-b border-emerald-900 pb-2 mb-2">
                      <span className="font-sans font-bold text-slate-400 uppercase tracking-widest text-[9px] flex items-center">
                        <Sparkles size={11} className="mr-1.5 text-amber-400" /> Motor Gemini Pro 1.5 Comparador
                      </span>
                      <Loader2 className="animate-spin text-emerald-400" size={13} />
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {compareLog.map((log, idx) => (
                        <p key={idx} className={idx === compareLog.length - 1 ? "text-white font-bold" : ""}>
                          &gt; {log}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {carregandoPropostas ? (
                  <p className="text-xs text-slate-400 text-center py-8 flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={13} /> A carregar propostas...
                  </p>
                ) : activeRfpProposals.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">
                    Não existem propostas submetidas para este concurso. Preencha o formulário "Submeter Proposta" ao lado para adicionar.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {activeRfpProposals.map((prop, idx) => {
                      const anexosProposta = prop.anexos && prop.anexos.length > 0
                        ? prop.anexos
                        : (prop.ficheiro_caminho ? [{ nome: prop.ficheiro_nome, caminho: prop.ficheiro_caminho }] : []);
                      const estadoProp = prop.estado || "Pendente";
                      const podeDecidir = activeRfp.estado === "Aberto" && loggedUser.role === "ADMIN" && estadoProp === "Pendente";
                      return (
                      <div
                        key={prop.id_proposal}
                        className={`border rounded-xl p-4 space-y-3 ${
                          estadoProp === "Aprovada" ? "border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/10" :
                          estadoProp === "Rejeitada" ? "border-red-200 bg-red-50/30 dark:bg-red-950/10 opacity-75" :
                          estadoProp === "Não Selecionada" ? "border-slate-150 dark:border-slate-800 opacity-60" :
                          "border-slate-150 dark:border-slate-800 hover:border-emerald-400/50 bg-slate-50/40 dark:bg-slate-900/10"
                        }`}
                      >
                        <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-2.5">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-800 dark:text-white text-xs">{prop.nome_empresa}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                estadoProp === "Aprovada" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                                estadoProp === "Rejeitada" ? "bg-red-100 text-red-800 border border-red-200" :
                                estadoProp === "Não Selecionada" ? "bg-slate-100 text-slate-500 border border-slate-200" :
                                "bg-amber-100 text-amber-800 border border-amber-200"
                              }`}>
                                {estadoProp}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3 text-[10px] text-slate-400 mt-0.5">
                              <span>NIF: <strong className="font-mono-custom">{prop.nif}</strong></span>
                              <span>•</span>
                              <span>Data: <strong className="font-mono-custom">{prop.data_submissao}</strong></span>
                            </div>
                            {estadoProp === "Rejeitada" && prop.motivo_rejeicao && (
                              <p className="text-[10px] text-red-600 mt-1">Motivo: {prop.motivo_rejeicao}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono-custom block">
                              {prop.valor.toLocaleString("pt-PT")} €
                            </span>
                            <span className="text-[9px] text-slate-400">Proposta Comercial</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                          <p>{prop.descricao_tecnica}</p>
                          <div className="space-y-1.5 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-150 dark:border-slate-800/80 font-mono-custom text-[10px]">
                            <p>Prazo de Execução: <strong className="text-slate-800 dark:text-slate-300">{prop.prazo_dias} dias</strong></p>
                            <p>Garantia da Obra: <strong className="text-slate-800 dark:text-slate-300">{prop.garantia_anos} anos</strong></p>
                            <div className="pt-1">
                              <span className="block mb-0.5">Anexos ({anexosProposta.length}):</span>
                              {anexosProposta.length === 0 ? (
                                <span className="text-slate-400">Sem ficheiros anexados</span>
                              ) : (
                                <div className="space-y-0.5">
                                  {anexosProposta.map((a, ai) => (
                                    <p key={ai} className="truncate">
                                      <span
                                        className="text-emerald-500 hover:underline cursor-pointer"
                                        onClick={async () => {
                                          const resp = await fetch("/api/documento?acao=descarregar", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ caminho: a.caminho })
                                          });
                                          const resultado = await resp.json();
                                          if (resultado?.url) window.open(resultado.url, "_blank");
                                          else alert("❌ Não foi possível abrir o documento.");
                                        }}
                                      >
                                        <Paperclip size={10} className="inline mr-0.5" />{a.nome}
                                      </span>
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {estadoProp === "Aprovada" && (
                          <div className="pt-2 border-t border-emerald-100 dark:border-emerald-900 text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 size={11} />
                            <span>
                              Adjudicada para {prop.destino_obra === "intervencao" ? "Intervenção (Reparação)" : "Obra Extraordinária"}
                              {prop.usa_fundo_reserva ? " — paga pelo Fundo de Reserva" : ""}
                            </span>
                          </div>
                        )}

                        {podeDecidir && (
                          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                              onClick={() => { setPainelRejeicaoId(painelRejeicaoId === prop.id_proposal ? null : prop.id_proposal); setMotivoRejeicao(""); }}
                              className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold py-1 px-3 text-[11px] rounded transition-colors cursor-pointer flex items-center space-x-1"
                            >
                              <XCircle size={11} />
                              <span>Rejeitar</span>
                            </button>
                            <button
                              onClick={() => {
                                const abrir = painelAdjudicacaoId !== prop.id_proposal;
                                setPainelAdjudicacaoId(abrir ? prop.id_proposal : null);
                                setDestinoObraEscolhido("obra_extraordinaria");
                                setUsaFundoReservaEscolhido(false);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-3 text-[11px] rounded transition-colors cursor-pointer flex items-center space-x-1"
                            >
                              <CheckCircle2 size={11} />
                              <span>Adjudicar Contrato</span>
                            </button>
                          </div>
                        )}

                        {painelRejeicaoId === prop.id_proposal && (
                          <div className="bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-3 space-y-2">
                            <label className="text-[10px] font-bold text-red-700 dark:text-red-400 block">Motivo da Rejeição *</label>
                            <input
                              type="text"
                              value={motivoRejeicao}
                              onChange={e => setMotivoRejeicao(e.target.value)}
                              placeholder="Ex: Valor acima da estimativa, prazo incompatível..."
                              className="w-full border border-red-200 dark:border-red-900 p-2 rounded bg-white dark:bg-slate-900 text-xs"
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleRejeitarProposta(prop)}
                                disabled={rejeitando}
                                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-1 px-3 text-[11px] rounded transition-colors cursor-pointer"
                              >
                                {rejeitando ? "A rejeitar..." : "Confirmar Rejeição"}
                              </button>
                              <button
                                onClick={() => setPainelRejeicaoId(null)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-1 px-3 text-[11px] rounded transition-colors cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}

                        {painelAdjudicacaoId === prop.id_proposal && (
                          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 space-y-3">
                            <div>
                              <label className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 block mb-1.5">Esta adjudicação passa a ser criada como *</label>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setDestinoObraEscolhido("obra_extraordinaria")}
                                  className={`p-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                                    destinoObraEscolhido === "obra_extraordinaria"
                                      ? "border-emerald-500 bg-emerald-100 text-emerald-800"
                                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  <HardHat size={13} /> Obra Extraordinária (Grande)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDestinoObraEscolhido("intervencao")}
                                  className={`p-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                                    destinoObraEscolhido === "intervencao"
                                      ? "border-emerald-500 bg-emerald-100 text-emerald-800"
                                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  <Wrench size={13} /> Intervenção (Reparação)
                                </button>
                              </div>
                            </div>

                            {destinoObraEscolhido === "obra_extraordinaria" && (
                              <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={usaFundoReservaEscolhido}
                                  onChange={e => setUsaFundoReservaEscolhido(e.target.checked)}
                                  className="h-3.5 w-3.5 accent-emerald-600"
                                />
                                <PiggyBank size={13} className="text-emerald-600" />
                                <span>Pagar esta obra a partir do Fundo de Reserva Comum (em vez de quota extraordinária aos condóminos)</span>
                              </label>
                            )}

                            <div className="flex gap-2 justify-end pt-1 border-t border-emerald-100 dark:border-emerald-900">
                              <button
                                onClick={() => handleAdjudicarProposta(prop)}
                                disabled={adjudicando}
                                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-1.5 px-3 text-[11px] rounded transition-colors cursor-pointer"
                              >
                                {adjudicando ? "A adjudicar..." : "Confirmar Adjudicação"}
                              </button>
                              <button
                                onClick={() => setPainelAdjudicacaoId(null)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-1.5 px-3 text-[11px] rounded transition-colors cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RESULTADO COMPARATIVO IA */}
              {aiResult && (
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-emerald-200 dark:border-emerald-950 p-6 space-y-6">
                  
                  {/* Cabeçalho de Sucesso IA */}
                  <div className="flex items-center space-x-2 border-b border-emerald-100 dark:border-emerald-900 pb-3">
                    <div className="bg-emerald-100 dark:bg-emerald-950 p-2 rounded-lg text-emerald-600 dark:text-emerald-400">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                        Análise Comparativa Inteligente (Gemini 3.5 Flash)
                      </h3>
                      <p className="text-[10px] text-slate-400">Relatório automatizado com base no Caderno de Encargos do Edifício</p>
                    </div>
                  </div>

                  {/* Matriz Comparativa */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center">
                      <Table size={13} className="mr-1 text-slate-400" /> Matriz Comparativa de Critérios
                    </h4>
                    <div className="border border-slate-150 dark:border-slate-800 rounded-lg overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse bg-white dark:bg-[#0f172a]">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-150 dark:border-slate-800 text-slate-500">
                            <th className="p-2.5">Critério Comparativo</th>
                            <th className="p-2.5">
                              {activeRfpProposals[0]?.nome_empresa || "Fornecedor A"}
                            </th>
                            <th className="p-2.5">
                              {activeRfpProposals[1]?.nome_empresa || "Fornecedor B"}
                            </th>
                            <th className="p-2.5 text-center text-emerald-600">Vencedor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {aiResult.comparisonMatrix.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/40 text-[11px] text-slate-600 dark:text-slate-400">
                              <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-300">{item.criterion}</td>
                              <td className="p-2.5">{item.supplierA}</td>
                              <td className="p-2.5">{item.supplierB}</td>
                              <td className="p-2.5 text-center">
                                <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-0.5 rounded text-[10px] font-mono-custom uppercase">
                                  {item.winner}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pontuações e Prós/Contas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(aiResult.analysis).map(([supplierName, rawData], idx) => {
                      const data = rawData as { score: number; pros: string[]; cons: string[]; };
                      return (
                        <div
                          key={idx}
                          className="bg-white dark:bg-[#0f172a] border border-slate-150 dark:border-slate-800 rounded-xl p-4 space-y-3"
                        >
                          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                            <span className="font-bold text-xs text-slate-800 dark:text-white truncate max-w-[140px]">{supplierName}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold font-mono-custom ${
                                data.score >= 90
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              Score: {data.score}/100
                            </span>
                          </div>

                          <div className="space-y-2 text-[10px]">
                            <div>
                              <span className="font-bold text-emerald-600 uppercase tracking-wide block mb-1">Prós Vantagens</span>
                              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                                {data.pros.map((pro, pIdx) => (
                                  <li key={pIdx}>{pro}</li>
                                ))}
                              </ul>
                            </div>

                            <div>
                              <span className="font-bold text-amber-600 uppercase tracking-wide block mb-1">Contras Riscos</span>
                              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                                {data.cons.map((con, cIdx) => (
                                  <li key={cIdx}>{con}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Recomendação do Auditor */}
                  <div className="bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl p-4 border border-emerald-100 dark:border-emerald-900/60 space-y-2.5">
                    <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-400">
                      <ThumbsUp size={15} />
                      <span className="font-bold text-xs uppercase tracking-wide">Recomendação Automática IA</span>
                    </div>
                    <p className="text-[11px] text-slate-700 dark:text-emerald-200 leading-relaxed text-justify">
                      {aiResult.recommendation}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-8 text-center text-slate-400 text-xs">
              Selecione um concurso de obras ativo na coluna à esquerda para ver os detalhes e propostas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
