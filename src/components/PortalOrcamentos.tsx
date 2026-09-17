import React, { useState, useEffect } from "react";
import { Predio, Fornecedor, LoggedUser } from "../types";
import { Loader2, ShieldCheck, BadgeAlert, Sparkles, Building, Coins, Calendar, Plus, ExternalLink, ThumbsUp, Table, FileText, CheckCircle2 } from "lucide-react";
import {
  fetchRfpsFromSupabase,
  saveRfpToSupabase,
  fetchPropostasFromSupabase,
  savePropostaToSupabase,
  uploadPropostaFicheiro,
  saveFornecedorToSupabase
} from "../lib/supabaseService";

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
  fornecedores: Fornecedor[];
  onAddFornecedor: (novo: Fornecedor) => void;
  loggedUser: LoggedUser;
}

export function PortalOrcamentos({
  predio,
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
  const [propFicheiro, setPropFicheiro] = useState<File | null>(null);

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
    const ficheiroCaminho = propFicheiro
      ? await uploadPropostaFicheiro(propFicheiro, selectedRfpId, idProposal)
      : undefined;

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
      ficheiro_nome: propFicheiro ? propFicheiro.name : "proposta_assinada_eletronicamente.pdf",
      ficheiro_caminho: ficheiroCaminho || undefined,
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
    setPropFicheiro(null);
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

  // Accept and Adjudicate Proposal
  const [adjudicando, setAdjudicando] = useState(false);
  const handleAdjudicarProposta = async (proposal: Proposal) => {
    const confirmAdjudicacao = window.confirm(
      `Deseja adjudicar formalmente esta obra/serviço à empresa "${proposal.nome_empresa}" pelo valor de ${proposal.valor.toLocaleString("pt-PT")} €?\n` +
      `Isso irá encerrar o concurso público, registar a empresa como fornecedor ativo do condomínio e criar as diretivas financeiras correspondentes.`
    );

    if (!confirmAdjudicacao) return;
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
    const alreadyRegistered = fornecedores.some(f => f.nif === proposal.nif && f.id_predio === predio.id_predio);
    if (!alreadyRegistered) {
      const novoFornecedor: Fornecedor = {
        id_fornecedor: "forn-auto-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        id_predio: predio.id_predio,
        nome: proposal.nome_empresa,
        nif: proposal.nif,
        categoria: rfpAlvo.categoria || "Serviços Gerais",
        email_contacto: proposal.email,
        contacto: proposal.contacto
      };
      onAddFornecedor(novoFornecedor);
      saveFornecedorToSupabase(novoFornecedor).catch(console.error);
    }

    setAdjudicando(false);
    alert(
      `CONTRATO ADJUDICADO COM SUCESSO!\n\n` +
      `Fornecedor: ${proposal.nome_empresa}\n` +
      `Serviço: ${rfpAlvo.titulo}\n` +
      `Valor: ${proposal.valor.toLocaleString("pt-PT")} €\n` +
      `Prazo: ${proposal.prazo_dias} dias\n\n` +
      `O concurso foi fechado e o fornecedor integrado no registo oficial do condomínio.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Banner de Apresentação */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-700 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 opacity-10">
          <Building size={200} />
        </div>
        <div className="relative z-10 max-w-3xl space-y-2">
          <span className="bg-white/20 text-white font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center w-fit">
            <Sparkles size={12} className="mr-1.5 animate-pulse text-amber-300" />
            Portal Transparente de Orçamentação Inteligente
          </span>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Portal Público de Contratos & Propostas de Obras</h2>
          <p className="text-xs text-indigo-100 leading-relaxed max-w-2xl">
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
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer flex items-center"
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
                    className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-indigo-500 text-slate-700 dark:text-slate-200"
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
                      className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-indigo-500 text-slate-700 dark:text-slate-200"
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
                      className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-indigo-500 text-slate-700 dark:text-slate-200 font-mono-custom"
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
                    className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-indigo-500 text-slate-700 dark:text-slate-200 font-mono-custom"
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
                    className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-indigo-500 text-slate-700 dark:text-slate-200"
                  ></textarea>
                </div>
                <button
                  type="submit"
                  disabled={publicandoRfp}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2 rounded shadow transition-all cursor-pointer"
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
                      ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20"
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
                          : "bg-indigo-100 text-indigo-800 border border-indigo-200"
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

          {/* SIMULADO PORTAL PÚBLICO: FORMULÁRIO DE SUBMISSÃO EXTERNA */}
          <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
              <ExternalLink size={13} className="text-indigo-500 mr-1.5" />
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
                  className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-indigo-500 text-slate-700 dark:text-slate-200"
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
                    className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-indigo-500 text-slate-700 dark:text-slate-200 font-mono-custom"
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
                    className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-indigo-500 text-slate-700 dark:text-slate-200 font-mono-custom"
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
                  className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-indigo-500 text-slate-700 dark:text-slate-200 font-mono-custom"
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
                    className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-indigo-500 text-slate-700 dark:text-slate-200 font-mono-custom"
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
                    className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-indigo-500 text-slate-700 dark:text-slate-200 font-mono-custom"
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
                    className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-indigo-500 text-slate-700 dark:text-slate-200 font-mono-custom"
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
                  className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 focus:outline-indigo-500 text-slate-700 dark:text-slate-200"
                ></textarea>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Ficheiro de Proposta Detalhada (PDF)</label>
                <div className="border border-dashed border-slate-250 dark:border-slate-800 rounded p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-900/40 relative cursor-pointer">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={e => setPropFicheiro(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <p className="font-semibold text-[11px] text-slate-600 dark:text-slate-300">
                    {propFicheiro ? propFicheiro.name : "Clique para anexar PDF"}
                  </p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Máx. 10MB - Assinado Digitalmente</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={submetendoProposta}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2 rounded shadow transition-all cursor-pointer flex items-center justify-center space-x-1"
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
                    <span className="text-base font-bold font-mono-custom text-indigo-600 dark:text-indigo-400">
                      {activeRfp.estimativa.toLocaleString("pt-PT")} €
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
                  {activeRfp.descricao}
                </p>

                <div className="flex justify-between items-center text-[11px] text-slate-500 font-mono-custom bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded border border-slate-100 dark:border-slate-800">
                  <span>Data Publicação: <strong>{activeRfp.data_publicacao}</strong></span>
                  <span>Propostas Recebidas: <strong className="text-indigo-600">{activeRfpProposals.length}</strong></span>
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
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded text-xs shadow transition-all cursor-pointer flex items-center space-x-1.5"
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
                    {activeRfpProposals.map((prop, idx) => (
                      <div
                        key={prop.id_proposal}
                        className="border border-slate-150 dark:border-slate-800 rounded-xl p-4 hover:border-indigo-400/50 bg-slate-50/40 dark:bg-slate-900/10 space-y-3"
                      >
                        <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-2.5">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-white text-xs">{prop.nome_empresa}</span>
                            <div className="flex items-center space-x-3 text-[10px] text-slate-400 mt-0.5">
                              <span>NIF: <strong className="font-mono-custom">{prop.nif}</strong></span>
                              <span>•</span>
                              <span>Data: <strong className="font-mono-custom">{prop.data_submissao}</strong></span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono-custom block">
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
                            <p className="truncate">
                              Documento:{" "}
                              {prop.ficheiro_caminho ? (
                                <span
                                  className="text-indigo-500 hover:underline cursor-pointer"
                                  onClick={async () => {
                                    const resp = await fetch("/api/documento?acao=descarregar", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ caminho: prop.ficheiro_caminho })
                                    });
                                    const resultado = await resp.json();
                                    if (resultado?.url) window.open(resultado.url, "_blank");
                                    else alert("❌ Não foi possível abrir o documento.");
                                  }}
                                >
                                  <FileText size={10} className="inline mr-0.5" />{prop.ficheiro_nome}
                                </span>
                              ) : (
                                <span className="text-slate-400"><FileText size={10} className="inline mr-0.5" />{prop.ficheiro_nome} (sem ficheiro anexado)</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {activeRfp.estado === "Aberto" && loggedUser.role === "ADMIN" && (
                          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                              onClick={() => handleAdjudicarProposta(prop)}
                              disabled={adjudicando}
                              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-1 px-3 text-[11px] rounded transition-colors cursor-pointer flex items-center space-x-1"
                            >
                              <CheckCircle2 size={11} />
                              <span>{adjudicando ? "A adjudicar..." : "Adjudicar Contrato"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* RESULTADO COMPARATIVO IA */}
              {aiResult && (
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-indigo-200 dark:border-indigo-950 p-6 space-y-6">
                  
                  {/* Cabeçalho de Sucesso IA */}
                  <div className="flex items-center space-x-2 border-b border-indigo-100 dark:border-indigo-900 pb-3">
                    <div className="bg-indigo-100 dark:bg-indigo-950 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-300">
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
                            <th className="p-2.5 text-center text-indigo-600">Vencedor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {aiResult.comparisonMatrix.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/40 text-[11px] text-slate-600 dark:text-slate-400">
                              <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-300">{item.criterion}</td>
                              <td className="p-2.5">{item.supplierA}</td>
                              <td className="p-2.5">{item.supplierB}</td>
                              <td className="p-2.5 text-center">
                                <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-bold px-2 py-0.5 rounded text-[10px] font-mono-custom uppercase">
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
                                  : "bg-indigo-50 text-indigo-700 border border-indigo-200"
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
                  <div className="bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl p-4 border border-indigo-100 dark:border-indigo-900/60 space-y-2.5">
                    <div className="flex items-center space-x-2 text-indigo-800 dark:text-indigo-400">
                      <ThumbsUp size={15} />
                      <span className="font-bold text-xs uppercase tracking-wide">Recomendação Automática IA</span>
                    </div>
                    <p className="text-[11px] text-slate-700 dark:text-indigo-200 leading-relaxed text-justify">
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
