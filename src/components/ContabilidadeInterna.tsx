import React, { useState } from "react";
import { Predio, LoggedUser, Movimento } from "../types";
import { exportToXLS } from "../utils";
import {
  fetchPlanoContasFromSupabase, savePlanoContaToSupabase, PlanoContaRow,
  fetchRegrasCategorizacaoFromSupabase, saveRegraCategorizacaoToSupabase, deleteRegraCategorizacaoFromSupabase, RegraCategorizacaoRow
} from "../lib/supabaseService";
import { PLANO_CONTAS_SNC_DEFAULT, REGRAS_SNC_DEFAULT, classificarPorRegrasSNC, CODIGO_CONTA_SNC_FALLBACK_DESPESA } from "../lib/classificacaoSNC";

interface ContabilidadeInternaProps {
  predio: Predio;
  loggedUser: LoggedUser;
  movimentos?: Movimento[];
}

type PlanoConta = PlanoContaRow;

interface ComprovativoPendente {
  id_comprovativo: string;
  nome_ficheiro: string;
  data_sugerida: string;
  valor_sugerido: number;
  descricao_sugerida: string;
  estado: "Não Reconciliado" | "Sugerido" | "Reconciliado";
}

// Plano de Contas Oficial de Condomínios (SNC Simplificado) e regras de
// categorização por omissão — definidos uma única vez em
// src/lib/classificacaoSNC.ts (partilhado com saveMovimentoToSupabase, que
// aplica a mesma classificação no momento do lançamento de cada movimento,
// e com server/lib/inboundProcessor.js, para o lançamento automático por
// email), usados aqui só para semear a tabela real plano_contas na
// primeira vez que um prédio abre este módulo.
const PLANO_CONTAS_DEFAULT: Array<Omit<PlanoConta, "id" | "id_predio">> = PLANO_CONTAS_SNC_DEFAULT.map(c => ({ ...c, descricao: c.descricao || "" }));
const REGRAS_DEFAULT: Array<{ palavra_chave: string; codigo_conta: string }> = REGRAS_SNC_DEFAULT;
const CODIGO_CONTA_FALLBACK = CODIGO_CONTA_SNC_FALLBACK_DESPESA; // Obras de Conservação / Geral — quando nenhuma regra bate certo

export function ContabilidadeInterna({ predio, loggedUser, movimentos = [] }: ContabilidadeInternaProps) {
  const [activeTabContab, setActiveTabContab] = useState<"plano" | "reconciliacao" | "motor_regras" | "razao">("razao");
  const [anoRazaoSelecionado, setAnoRazaoSelecionado] = useState<string>("todos");

  // 1. Plano de Contas Oficial de Condomínios (SNC Simplificado) — carregado
  // da tabela real plano_contas; semeia os valores por omissão na primeira
  // vez que este prédio abre o módulo (nunca mais se perde no refresh).
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [regras, setRegras] = useState<RegraCategorizacaoRow[]>([]);
  const [carregandoContabilidade, setCarregandoContabilidade] = useState(true);

  React.useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!predio.id_predio) return;
      const [contasCarregadas, regrasCarregadas] = await Promise.all([
        fetchPlanoContasFromSupabase(predio.id_predio),
        fetchRegrasCategorizacaoFromSupabase(predio.id_predio)
      ]);
      if (cancelado) return;

      if (contasCarregadas && contasCarregadas.length > 0) {
        setPlanoContas(contasCarregadas);
      } else {
        const semeadas: PlanoConta[] = PLANO_CONTAS_DEFAULT.map(c => ({ ...c, id: `pc-${predio.id_predio}-${c.codigo}`, id_predio: predio.id_predio }));
        setPlanoContas(semeadas);
        semeadas.forEach(c => savePlanoContaToSupabase(c).catch(console.error));
      }

      if (regrasCarregadas && regrasCarregadas.length > 0) {
        setRegras(regrasCarregadas);
      } else {
        const semeadas: RegraCategorizacaoRow[] = REGRAS_DEFAULT.map((r, i) => ({ ...r, id: `rc-${predio.id_predio}-${i}`, id_predio: predio.id_predio }));
        setRegras(semeadas);
        semeadas.forEach(r => saveRegraCategorizacaoToSupabase(r).catch(console.error));
      }
      setCarregandoContabilidade(false);
    })();
    return () => { cancelado = true; };
  }, [predio.id_predio]);

  // Plano de Contas state helper
  const [novoCodigo, setNovoCodigo] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState<"GASTO" | "RENDIMENTO" | "ATIVO" | "PASSIVO">("GASTO");
  const [novaDesc, setNovaDesc] = useState("");

  const handleAdicionarConta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoCodigo || !novoNome) {
      alert("Por favor, preencha o código e o nome da conta contábil.");
      return;
    }
    if (planoContas.some(c => c.codigo === novoCodigo)) {
      alert("Já existe uma conta com este código contábil.");
      return;
    }
    const nC: PlanoConta = {
      id: `pc-${predio.id_predio}-${novoCodigo}`,
      id_predio: predio.id_predio,
      codigo: novoCodigo,
      nome: novoNome,
      tipo: novoTipo,
      descricao: novaDesc
    };
    setPlanoContas(prev => [...prev, nC].sort((a, b) => a.codigo.localeCompare(b.codigo)));
    savePlanoContaToSupabase(nC).catch(console.error);
    alert("Conta contábil adicionada com sucesso ao Plano de Contas!");
    setNovoCodigo("");
    setNovoNome("");
    setNovaDesc("");
  };

  // 2. Reconciliação Automática: movimentos reais recebidos por prop, não
  // uma lista fixa fabricada — antes ignorava sempre os movimentos reais
  // do prédio e mostrava os mesmos 4 movimentos fictícios.
  const [movimentosReconciliacao, setMovimentosReconciliacao] = useState<Movimento[]>(() =>
    movimentos.filter(m => m.id_predio === predio.id_predio && (m.is_movimento_cego || m.estado === "Movimento Cego / Por Justificar"))
  );

  React.useEffect(() => {
    setMovimentosReconciliacao(
      movimentos.filter(m => m.id_predio === predio.id_predio && (m.is_movimento_cego || m.estado === "Movimento Cego / Por Justificar"))
    );
  }, [movimentos, predio.id_predio]);

  const [comprovativosPendentes, setComprovativosPendentes] = useState<ComprovativoPendente[]>([]);

  const [validatingOCR, setValidatingOCR] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<{
    fornecedor: string;
    num_fatura: string;
    data_emissao: string;
    valor_total: number;
    movimento_correspondente?: string;
  } | null>(null);

  const lerFicheiroComoBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleUploadValidarRecibo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidatingOCR(true);
    setOcrResult(null);
    setOcrError(null);

    try {
      const base64 = await lerFicheiroComoBase64(file);
      const resp = await fetch("/api/ai?acao=reconhecer-anexo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType: file.type || "application/octet-stream" })
      });
      const resultado = await resp.json();
      if (!resp.ok || !resultado.ok) {
        throw new Error(resultado?.error || "A IA não conseguiu ler este documento.");
      }

      const dados = resultado.dados || {};
      const res = {
        fornecedor: dados.entidade || "Entidade não identificada",
        num_fatura: dados.referencia || "N/D",
        data_emissao: dados.data_documento || new Date().toISOString().split("T")[0],
        valor_total: Number(dados.valor_total) || 0
      };

      const matchMovimento = movimentosReconciliacao.find(m => m.valor === res.valor_total && m.estado !== "Reconciliado");
      setOcrResult({
        ...res,
        movimento_correspondente: matchMovimento ? `${matchMovimento.id_mov} (${matchMovimento.valor.toFixed(2)}€ em ${matchMovimento.data})` : undefined
      });

      // Add to pending documents — real leitura por IA (Gemini Vision), sem validações fiscais inventadas
      const newDoc: ComprovativoPendente = {
        id_comprovativo: "doc-rec-" + Date.now(),
        nome_ficheiro: file.name,
        data_sugerida: res.data_emissao,
        valor_sugerido: res.valor_total,
        descricao_sugerida: res.fornecedor + (res.num_fatura !== "N/D" ? ` (${res.num_fatura})` : ""),
        estado: matchMovimento ? "Reconciliado" : "Sugerido"
      };
      setComprovativosPendentes(prev => [newDoc, ...prev]);

      // Reconcile corresponding movement only if a real match was found
      if (matchMovimento) {
        setMovimentosReconciliacao(prev => prev.map(m => {
          if (m.id_mov === matchMovimento.id_mov) {
            return { ...m, estado: "Reconciliado", descricao: `${m.descricao} [✓ Lido por IA & Arquivado: ${file.name}]` };
          }
          return m;
        }));
      }
    } catch (err: any) {
      setOcrError(err?.message || "Erro ao processar o documento.");
    } finally {
      setValidatingOCR(false);
    }
  };

  const triggerReconciliacaoAutomatica = () => {
    // Attempt automatic matching between movements and documents based on Amount (valor) and similarity
    let matchedCount = 0;
    
    const novosMovs = movimentosReconciliacao.map(mov => {
      const matchDoc = comprovativosPendentes.find(doc => 
        doc.valor_sugerido === mov.valor && 
        doc.estado !== "Reconciliado"
      );

      if (matchDoc) {
        matchedCount++;
        // Update document state inside loop is complex, but we'll reflect it in the copy
        return { ...mov, estado: "Reconciliado", descricao: `${mov.descricao} [✓ Reconciliado com ${matchDoc.nome_ficheiro}]` };
      }
      return mov;
    });

    const novosDocs = comprovativosPendentes.map(doc => {
      const hasMatch = movimentosReconciliacao.some(mov => mov.valor === doc.valor_sugerido);
      if (hasMatch) {
        return { ...doc, estado: "Reconciliado" as const };
      }
      return doc;
    });

    setMovimentosReconciliacao(novosMovs);
    setComprovativosPendentes(novosDocs);

    alert(`Reconciliador Inteligente CondoManager AI:\nEncontrados ${matchedCount} cruzamento(s) automático(s) por valor exato! Comprovativos vinculados à contabilidade. (Datas próximas ainda têm de ser confirmadas manualmente.)`);
  };

  // 3. Motor de Categorização Semântica / Regras — antes tinha as
  // palavras-chave escritas diretamente no código (hardcoded, nunca
  // editável); passa a usar as regras reais guardadas em
  // regras_categorizacao, que o administrador pode agora gerir aqui.
  const [inputRegraDesc, setInputRegraDesc] = useState("");
  const [sugestaoConta, setSugestaoConta] = useState<PlanoConta | null>(null);
  const [novaRegraPalavra, setNovaRegraPalavra] = useState("");
  const [novaRegraConta, setNovaRegraConta] = useState("");

  // "tipo" (Receita/Despesa) do movimento, quando conhecido, restringe as
  // regras candidatas ao tipo de conta compatível — uma Despesa nunca pode
  // cair numa conta RENDIMENTO e vice-versa. Sem isto, a palavra-chave
  // "fração" (regra "quota"/"fração"/"condómino" → Conta 71) apanhava o
  // texto genérico "(Fração Não Identificada - ...)" que aparece em
  // QUALQUER movimento reconhecido por email sem fração associada — mesmo
  // faturas de fornecedor (ex: Iberdrola, uma Despesa) ficavam classificadas
  // como "Rendimentos de Quotas". E, no sentido inverso, uma receita real
  // sem nenhuma palavra-chave a bater certo (ex: "TRF.IMED. DE Maria Irene
  // Pereira Bilreiro") caía sempre no fallback fixo (Conta 68, Obras de
  // Conservação — um GASTO), misturando entradas de dinheiro em rubricas de
  // despesa. Confirmado em produção pelo administrador.
  const classificarPorRegras = (descricaoLivre: string, tipo?: string): PlanoConta | null => {
    const codigo = classificarPorRegrasSNC(descricaoLivre, tipo, planoContas, regras);
    return planoContas.find(c => c.codigo === codigo) || null;
  };

  const [inputRegraTipo, setInputRegraTipo] = useState<"Receita" | "Despesa">("Despesa");
  const testarCategorizacaoAutomatica = () => {
    if (!inputRegraDesc) {
      alert("Introduza um descritivo de transação (Ex: 'Fatura Eletricidade EDP de Junho').");
      return;
    }
    setSugestaoConta(classificarPorRegras(inputRegraDesc, inputRegraTipo));
  };

  const handleAdicionarRegra = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaRegraPalavra.trim() || !novaRegraConta) {
      alert("Indique a palavra-chave e a conta contábil de destino.");
      return;
    }
    const nova: RegraCategorizacaoRow = {
      id: `rc-${predio.id_predio}-${Date.now()}`,
      id_predio: predio.id_predio,
      palavra_chave: novaRegraPalavra.trim().toLowerCase(),
      codigo_conta: novaRegraConta
    };
    setRegras(prev => [...prev, nova]);
    saveRegraCategorizacaoToSupabase(nova).catch(console.error);
    setNovaRegraPalavra("");
    setNovaRegraConta("");
  };

  const handleEliminarRegra = (regra: RegraCategorizacaoRow) => {
    setRegras(prev => prev.filter(r => r.id !== regra.id));
    deleteRegraCategorizacaoFromSupabase(regra.id).catch(console.error);
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="contabilidade-interna-module">
      {/* Description header */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-violet-500/10 p-6 rounded-2xl border border-emerald-500/15">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md">
            <i className="fa-solid fa-calculator text-xl"></i>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Contabilidade Interna Integrada</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Gerencie a contabilidade do condomínio com um Plano de Contas adaptado (SNC), regras inteligentes para classificação de extratos e um motor de reconciliação cruzada automática de despesas e faturas.
            </p>
          </div>
        </div>
      </div>

      {/* Sub tabs inside Contabilidade */}
      <div className="flex space-x-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTabContab("razao")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTabContab === "razao" ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-600 hover:text-slate-600"
          }`}
        >
          <i className="fa-solid fa-scale-balanced mr-1.5"></i> Razão Geral (SNC)
        </button>
        <button
          onClick={() => setActiveTabContab("plano")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTabContab === "plano" ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-600 hover:text-slate-600"
          }`}
        >
          <i className="fa-solid fa-folder-open mr-1.5"></i> Plano de Contas
        </button>
        <button
          onClick={() => setActiveTabContab("reconciliacao")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTabContab === "reconciliacao" ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-600 hover:text-slate-600"
          }`}
        >
          <i className="fa-solid fa-receipt mr-1.5"></i> Reconciliação com Comprovativos
        </button>
        <button
          onClick={() => setActiveTabContab("motor_regras")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTabContab === "motor_regras" ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-600 hover:text-slate-600"
          }`}
        >
          <i className="fa-solid fa-bolt mr-1.5"></i> Categorização Automática
        </button>
      </div>

      {/* 0. RAZÃO GERAL (SNC) — o Plano de Contas e as Regras de
          Categorização definiam a classificação, mas nunca eram aplicados a
          nenhum movimento real: o módulo só guardava configuração, sem
          produzir nenhuma contabilidade de facto. Esta aba classifica agora
          TODOS os movimentos reais do prédio pelas regras reais (mesma
          função classificarPorRegras já usada no testador manual) e soma-os
          por conta SNC — é o "livro razão" real, não uma demonstração. */}
      {activeTabContab === "razao" && (() => {
        const movimentosPredio = movimentos.filter(m => m.id_predio === predio.id_predio);
        const anosDisponiveis = Array.from(new Set(movimentosPredio.map(m => m.data?.slice(0, 4)).filter(Boolean))).sort().reverse();
        const movimentosAno = anoRazaoSelecionado === "todos" ? movimentosPredio : movimentosPredio.filter(m => m.data?.startsWith(anoRazaoSelecionado));

        // Movimentos lançados depois desta sessão já trazem o código SNC
        // gravado no próprio lançamento (saveMovimentoToSupabase /
        // inboundProcessor.js) — usa-se esse, real, em vez de o recalcular;
        // só cai na classificação por regras aqui para movimentos antigos
        // lançados antes desta funcionalidade existir.
        const porConta = planoContas.map(conta => {
          const movsConta = movimentosAno.filter(m => (m.codigo_conta_snc || classificarPorRegras(m.descricao, m.tipo)?.codigo) === conta.codigo);
          const total = movsConta.reduce((s, m) => s + (m.tipo === "Despesa" ? -Math.abs(m.valor) : Math.abs(m.valor)), 0);
          return { conta, movimentos: movsConta, total };
        }).filter(linha => linha.movimentos.length > 0);

        const semClassificacao = movimentosAno.length - porConta.reduce((s, l) => s + l.movimentos.length, 0);
        const totalGastos = porConta.filter(l => l.conta.tipo === "GASTO").reduce((s, l) => s + Math.abs(l.total), 0);
        const totalRendimentos = porConta.filter(l => l.conta.tipo === "RENDIMENTO").reduce((s, l) => s + Math.abs(l.total), 0);

        return (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">Livro Razão — Movimentos Reais Classificados por Conta SNC</h4>
                <p className="text-[10px] text-slate-600 mt-0.5">{movimentosAno.length} movimento(s) no período · {porConta.reduce((s, l) => s + l.movimentos.length, 0)} classificado(s) por regra · {semClassificacao} sem regra correspondente (ver nota abaixo)</p>
              </div>
              <select
                value={anoRazaoSelecionado}
                onChange={e => setAnoRazaoSelecionado(e.target.value)}
                className="border border-slate-200 px-3 py-1.5 text-xs rounded-lg bg-slate-50/50 cursor-pointer"
              >
                <option value="todos">Todos os anos</option>
                {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl">
                <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider">Total Rendimentos Classificados</span>
                <h3 className="text-base font-black text-emerald-950 font-mono mt-1">{totalRendimentos.toFixed(2)}€</h3>
              </div>
              <div className="bg-red-50/50 border border-red-100 p-4 rounded-xl">
                <span className="text-[9px] font-bold text-red-800 uppercase tracking-wider">Total Gastos Classificados</span>
                <h3 className="text-base font-black text-red-950 font-mono mt-1">{totalGastos.toFixed(2)}€</h3>
              </div>
            </div>

            {porConta.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center text-xs text-slate-600">
                Nenhum movimento real classificado neste período. Verifique se há movimentos lançados e se as regras de categorização cobrem as descrições reais (aba "Categorização Automática").
              </div>
            ) : (
              <div className="space-y-2">
                {porConta.sort((a, b) => a.conta.codigo.localeCompare(b.conta.codigo)).map(linha => (
                  <details key={linha.conta.codigo} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden group">
                    <summary className="p-3.5 flex items-center justify-between gap-2 cursor-pointer list-none">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <i className="fa-solid fa-chevron-right text-[9px] text-slate-600 group-open:rotate-90 transition-transform shrink-0"></i>
                        <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">{linha.conta.codigo}</span>
                        <span className="text-xs font-bold text-slate-800 truncate">{linha.conta.nome}</span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                          linha.conta.tipo === "GASTO" ? "bg-red-100 text-red-700" : linha.conta.tipo === "RENDIMENTO" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}>{linha.conta.tipo}</span>
                        <span className="text-[10px] text-slate-600 shrink-0">({linha.movimentos.length})</span>
                      </div>
                      <span className={`text-xs font-mono font-black shrink-0 ${linha.total < 0 ? "text-red-600" : "text-emerald-600"}`}>{linha.total.toFixed(2)}€</span>
                    </summary>
                    <div className="border-t border-slate-100 divide-y divide-slate-50">
                      {linha.movimentos.sort((a, b) => (b.data || "").localeCompare(a.data || "")).map(m => (
                        <div key={m.id_mov} className="px-3.5 py-2 flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-slate-600 font-mono shrink-0">{m.data}</span>
                          <span className="text-slate-700 truncate flex-1 px-2">{m.descricao}</span>
                          <span className={`font-mono font-bold shrink-0 ${m.tipo === "Despesa" ? "text-red-600" : "text-emerald-600"}`}>{m.tipo === "Despesa" ? "-" : "+"}{Math.abs(m.valor).toFixed(2)}€</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}

            {semClassificacao > 0 && (
              <p className="text-[10px] text-slate-600 text-center">
                {semClassificacao} movimento(s) não tiveram nenhuma conta classificada porque o Plano de Contas não tem nenhuma conta com o código de fallback "{CODIGO_CONTA_FALLBACK}" configurada — confirme em "Plano de Contas".
              </p>
            )}
          </div>
        );
      })()}

      {/* 1. PLANO DE CONTAS */}
      {activeTabContab === "plano" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Add account */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-2">Criar Conta Contábil</h4>
            <form onSubmit={handleAdicionarConta} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1 flex flex-col">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-600 mb-1">Código</label>
                  <input
                    type="text"
                    placeholder="Ex: 66"
                    value={novoCodigo}
                    onChange={e => setNovoCodigo(e.target.value)}
                    className="border border-slate-200 px-3 py-2 text-xs rounded-lg font-mono focus:outline-emerald-500 bg-slate-50/50"
                  />
                </div>
                <div className="col-span-2 flex flex-col">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-600 mb-1">Nome da Conta</label>
                  <input
                    type="text"
                    placeholder="Ex: Telecomunicações"
                    value={novoNome}
                    onChange={e => setNovoNome(e.target.value)}
                    className="border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-emerald-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-600 mb-1">Classe de Balanço</label>
                <select
                  value={novoTipo}
                  onChange={e => setNovoTipo(e.target.value as any)}
                  className="border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-emerald-500 bg-slate-50/50 cursor-pointer"
                >
                  <option value="GASTO">Classe 6 — Gastos (Custo)</option>
                  <option value="RENDIMENTO">Classe 7 — Rendimentos (Receita)</option>
                  <option value="ATIVO">Classe 1/2 — Ativo / Disponibilidades</option>
                  <option value="PASSIVO">Classe 2 — Passivo / Fornecedores</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-600 mb-1">Descrição Adicional</label>
                <textarea
                  placeholder="Explique o propósito contábil desta rubrica..."
                  rows={2}
                  value={novaDesc}
                  onChange={e => setNovaDesc(e.target.value)}
                  className="border border-slate-200 p-2 text-xs rounded-lg focus:outline-emerald-500 bg-slate-50/50"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
              >
                <i className="fa-solid fa-plus mr-1.5"></i> Adicionar Conta SNC
              </button>
            </form>
          </div>

          {/* List of accounts */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">Rubricas Contábeis Ativas</h4>
              <button
                onClick={() => {
                  const headers = ["Código", "Nome da Rubrica", "Tipo", "Descrição"];
                  const rows = planoContas.map(c => [c.codigo, c.nome, c.tipo, c.descricao]);
                  exportToXLS(`Plano_de_Contas_Oficial_SNC_${predio.nome.replace(/\s+/g, '_')}`, headers, rows);
                }}
                className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <img src="/modulos/66-exportacao-financeira.png" alt="Excel" className="w-4 h-4 object-contain shrink-0" /> Exportar Plano (Excel)
              </button>
            </div>

            {carregandoContabilidade ? (
              <div className="p-8 text-center text-xs text-slate-600">A carregar o Plano de Contas...</div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {planoContas.map(c => (
                <div key={c.codigo} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between hover:border-emerald-300 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        Conta {c.codigo}
                      </span>
                      <span className={`text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded border ${
                        c.tipo === "GASTO" 
                          ? "bg-rose-50 text-rose-700 border-rose-200" 
                          : c.tipo === "RENDIMENTO" 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}>
                        {c.tipo}
                      </span>
                    </div>
                    <h5 className="text-xs font-bold text-slate-800">{c.nome}</h5>
                    <p className="text-[10px] text-slate-600 leading-relaxed">{c.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>
      )}

      {/* 2. RECONCILIAÇÃO AUTOMÁTICA */}
      {activeTabContab === "reconciliacao" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Validação Automática de Recibos por IA Dropzone */}
          <div className="bg-gradient-to-r from-violet-900 to-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-violet-800/60 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-violet-300 bg-violet-800/50 px-2.5 py-1 rounded-full">
                  🔥 VALIDAÇÃO AUTOMÁTICA DE RECIBOS POR IA
                </span>
                <h3 className="text-base font-black text-white mt-1 flex items-center gap-2">
                  <i className="fa-solid fa-microchip text-violet-400"></i>
                  <span>Extração OCR, Validação Fiscal, Cruzamento & Arquivo Direto</span>
                </h3>
              </div>
              <label className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-lg flex items-center gap-2 shrink-0">
                <i className="fa-solid fa-cloud-arrow-up text-sm"></i>
                <span>Carregar Recibo/Fatura (PDF/Imagem)</span>
                <input type="file" accept="image/*,application/pdf" onChange={handleUploadValidarRecibo} className="hidden" />
              </label>
            </div>

            {validatingOCR && (
              <div className="p-4 bg-violet-950/60 rounded-xl border border-violet-700/50 flex items-center gap-3 animate-pulse">
                <i className="fa-solid fa-spinner fa-spin text-xl text-violet-400"></i>
                <span className="text-xs font-bold text-violet-200">
                  O CondoManager AI está a analisar a imagem/PDF com o Gemini Vision...
                </span>
              </div>
            )}

            {ocrError && (
              <div className="p-4 bg-red-950/60 rounded-xl border border-red-700/50 text-xs font-bold text-red-300">
                ❌ {ocrError}
              </div>
            )}

            {ocrResult && (
              <div className="bg-slate-900/90 p-5 rounded-xl border border-violet-500/40 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                    <i className="fa-solid fa-circle-check"></i>
                    <span>DOCUMENTO LIDO PELA IA (GEMINI VISION)</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-2.5 bg-slate-800/80 rounded-lg">
                    <span className="text-[9px] text-slate-600 uppercase block">Fornecedor / Emitente</span>
                    <span className="font-bold text-white text-[11px] block">{ocrResult.fornecedor}</span>
                  </div>

                  <div className="p-2.5 bg-slate-800/80 rounded-lg">
                    <span className="text-[9px] text-slate-600 uppercase block">Nº Documento & Data</span>
                    <span className="font-bold text-white text-[11px] block">{ocrResult.num_fatura}</span>
                    <span className="text-[9px] text-slate-600">{ocrResult.data_emissao}</span>
                  </div>

                  <div className="p-2.5 bg-slate-800/80 rounded-lg">
                    <span className="text-[9px] text-slate-600 uppercase block">Valor Total</span>
                    <span className="font-bold text-emerald-400 text-sm block">€{ocrResult.valor_total.toFixed(2)}</span>
                  </div>

                  <div className="p-2.5 bg-slate-800/80 rounded-lg col-span-2 md:col-span-3">
                    <span className="text-[9px] text-slate-600 uppercase block">Cruzamento Bancário</span>
                    {ocrResult.movimento_correspondente ? (
                      <>
                        <span className="font-bold text-cyan-300 text-[10px] block truncate">{ocrResult.movimento_correspondente}</span>
                        <span className="text-[9px] text-emerald-400 font-bold block mt-0.5">Emparelhado Auto ✓</span>
                      </>
                    ) : (
                      <span className="text-[9px] text-amber-400 font-bold block mt-0.5">Sem movimento com o mesmo valor por reconciliar — requer confirmação manual.</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Instructions and CTA */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-800 flex items-center">
                <i className="fa-solid fa-wand-magic-sparkles text-emerald-600 mr-2"></i> Conciliação Bancária & Comprovativos Inteligente
              </h4>
              <p className="text-[11px] text-slate-600 leading-relaxed max-w-2xl">
                O CondoManager AI lê os ficheiros de faturas digitadas e cruza-os com os movimentos bancários reais deste prédio ainda por justificar. Clique em "Iniciar Reconciliação" para emparelhar automaticamente por valor exato — datas diferentes têm de ser confirmadas manualmente.
              </p>
            </div>
            <button
              onClick={triggerReconciliacaoAutomatica}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition-all flex items-center cursor-pointer shrink-0"
            >
              <i className="fa-solid fa-wand-magic-sparkles mr-2 animate-bounce"></i> Executar Reconciliação Automática
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bank movements */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-2 flex justify-between">
                <span>Movimentos por Justificar</span>
                <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono">{movimentosReconciliacao.length}</span>
              </h4>
              <div className="space-y-2">
                {movimentosReconciliacao.map(m => (
                  <div key={m.id_mov} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-600 block font-mono">{m.data}</span>
                      <span className="text-[11px] font-black text-slate-700 block">{m.descricao}</span>
                      <span className="text-[9px] text-slate-600 block">Sugerido para: {m.categoria}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-mono font-bold block ${m.tipo === "Receita" ? "text-emerald-600" : "text-rose-600"}`}>
                        {m.tipo === "Receita" ? "+" : "-"}{m.valor.toFixed(2)}€
                      </span>
                      <span className={`text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-full inline-block mt-1 ${
                        m.estado === "Reconciliado" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {m.estado || "Pendente"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Uploaded invoices / receipts */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-2 flex justify-between">
                <span>Comprovativos Carregados (Faturas/Recibos)</span>
                <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">Arquivo Digital</span>
              </h4>
              <div className="space-y-2">
                {comprovativosPendentes.map(doc => (
                  <div key={doc.id_comprovativo} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-700 flex items-center">
                        <i className="fa-solid fa-file-pdf text-rose-600 mr-1.5 text-xs"></i>
                        {doc.nome_ficheiro}
                      </span>
                      <span className="text-[8px] text-slate-600 font-mono block mt-0.5">Extraído por OCR: {doc.data_sugerida} | Ref: {doc.descricao_sugerida}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-slate-800 block">{doc.valor_sugerido.toFixed(2)}€</span>
                      <span className={`text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-full inline-block mt-1 ${
                        doc.estado === "Reconciliado" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600"
                      }`}>
                        {doc.estado}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. MOTOR DE CATEGORIZAÇÃO */}
      {activeTabContab === "motor_regras" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 max-w-3xl mx-auto animate-fadeIn">
          <div className="border-b border-slate-100 pb-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">Demonstração: Motor de Regras e Categorização Automática</h4>
            <p className="text-xs text-slate-600 mt-1">
              Introduza um descritivo livre (ex: do seu extrato bancário ou faturas OCR) e o algoritmo CondoManager AI associará automaticamente à rubrica correspondente do plano de contas nacional (SNC).
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold uppercase tracking-wide text-slate-600 mb-1">Descritivo da Transação / Movimento</label>
              <div className="flex gap-2 mb-2">
                {(["Despesa", "Receita"] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setInputRegraTipo(t)}
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-colors cursor-pointer ${
                      inputRegraTipo === t ? (t === "Despesa" ? "bg-red-600 text-white border-red-600" : "bg-emerald-600 text-white border-emerald-600") : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Ex: Pagamento da fatura EDP luz condomínio Junho"
                  value={inputRegraDesc}
                  onChange={e => setInputRegraDesc(e.target.value)}
                  className="flex-grow border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-emerald-500 bg-slate-50/50"
                />
                <button
                  onClick={testarCategorizacaoAutomatica}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Categorizar
                </button>
              </div>
            </div>

            {sugestaoConta && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start space-x-3 animate-fadeIn">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg text-sm shrink-0">
                  <i className="fa-solid fa-brain"></i>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-emerald-800 uppercase tracking-wider block">Associação Inteligente Sugerida</span>
                  <p className="text-xs text-emerald-700 font-medium">
                    O CondoManager AI associou o termo à conta contábil:
                  </p>
                  <div className="font-mono text-xs font-extrabold text-emerald-700 bg-white border border-emerald-100 px-3 py-1.5 rounded-lg inline-block mt-2">
                    Conta {sugestaoConta.codigo} — {sugestaoConta.nome} ({sugestaoConta.tipo})
                  </div>
                  <p className="text-[9px] text-slate-600 mt-1 leading-normal">
                    * Primeira regra de palavra-chave que corresponder, por ordem da lista abaixo; sem nenhuma correspondência, usa a Conta {CODIGO_CONTA_FALLBACK}.
                  </p>
                </div>
              </div>
            )}

            <div className="border-t border-slate-100 pt-3">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-2">Exemplos Práticos Disponíveis</span>
              <div className="flex flex-wrap gap-2">
                {[
                  "Fatura Água da EPAL Garagem",
                  "Manutenção Elevadores Otis de Julho",
                  "Serviço Semanal Empresa Estrela Limpezas",
                  "Quota Condomínio Fração C",
                  "Reforço FCR Quota Extraordinária"
                ].map(txt => (
                  <button
                    key={txt}
                    onClick={() => {
                      setInputRegraDesc(txt);
                      setSugestaoConta(null);
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] px-2.5 py-1 rounded-lg border-none cursor-pointer transition-colors"
                  >
                    {txt}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <h5 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Regras de Categorização ({regras.length})</h5>
              <p className="text-[10px] text-slate-600">Palavra-chave encontrada no descritivo → conta contábil associada automaticamente. A primeira regra que corresponder é usada; sem nenhuma correspondência, usa-se a Conta 68 (Obras de Conservação / Geral).</p>

              <form onSubmit={handleAdicionarRegra} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Palavra-chave (ex: nowo, vodafone)"
                  value={novaRegraPalavra}
                  onChange={e => setNovaRegraPalavra(e.target.value)}
                  className="flex-grow border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-emerald-500 bg-slate-50/50"
                />
                <select
                  value={novaRegraConta}
                  onChange={e => setNovaRegraConta(e.target.value)}
                  className="border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-emerald-500 bg-slate-50/50 cursor-pointer"
                >
                  <option value="">Conta de destino...</option>
                  {planoContas.map(c => (
                    <option key={c.codigo} value={c.codigo}>Conta {c.codigo} — {c.nome}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <i className="fa-solid fa-plus mr-1"></i> Adicionar Regra
                </button>
              </form>

              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {regras.map(r => {
                  const conta = planoContas.find(c => c.codigo === r.codigo_conta);
                  return (
                    <div key={r.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-xs text-slate-700">
                        <span className="font-mono font-bold bg-white border border-slate-200 px-1.5 py-0.5 rounded">{r.palavra_chave}</span>
                        <i className="fa-solid fa-arrow-right mx-2 text-slate-400"></i>
                        Conta {r.codigo_conta}{conta ? ` — ${conta.nome}` : ""}
                      </span>
                      <button
                        onClick={() => handleEliminarRegra(r)}
                        className="text-slate-400 hover:text-red-600 cursor-pointer px-2"
                        title="Eliminar regra"
                        aria-label="Eliminar regra"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
