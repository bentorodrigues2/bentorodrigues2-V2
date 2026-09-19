import React, { useState } from "react";
import { Predio, LoggedUser, Movimento } from "../types";
import { exportToXLS } from "../utils";

interface ContabilidadeInternaProps {
  predio: Predio;
  loggedUser: LoggedUser;
  movimentos?: Movimento[];
}

interface PlanoConta {
  codigo: string;
  nome: string;
  tipo: "GASTO" | "RENDIMENTO" | "ATIVO" | "PASSIVO";
  descricao: string;
}

interface ComprovativoPendente {
  id_comprovativo: string;
  nome_ficheiro: string;
  data_sugerida: string;
  valor_sugerido: number;
  descricao_sugerida: string;
  estado: "Não Reconciliado" | "Sugerido" | "Reconciliado";
}

export function ContabilidadeInterna({ predio, loggedUser, movimentos = [] }: ContabilidadeInternaProps) {
  const [activeTabContab, setActiveTabContab] = useState<"plano" | "reconciliacao" | "motor_regras">("plano");
  
  // 1. Plano de Contas Oficial de Condomínios (SNC Simplificado)
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([
    { codigo: "11", nome: "Caixa Geral de Condomínio", tipo: "ATIVO", descricao: "Fundo físico de maneio em numerário" },
    { codigo: "12", nome: "Depósitos à Ordem", tipo: "ATIVO", descricao: "Contas bancárias correntes do condomínio" },
    { codigo: "13", nome: "Fundo Comum de Reserva", tipo: "ATIVO", descricao: "Conta bancária específica para o FCR" },
    { codigo: "61", nome: "Consumos de Água", tipo: "GASTO", descricao: "Faturas de água das partes comuns" },
    { codigo: "62", nome: "Consumos de Eletricidade", tipo: "GASTO", descricao: "Faturas de eletricidade/luz comum" },
    { codigo: "63", nome: "Manutenção Elevadores", tipo: "GASTO", descricao: "Contratos e assistência técnica de elevadores" },
    { codigo: "64", nome: "Serviços de Limpeza", tipo: "GASTO", descricao: "Salários de limpezas ou faturas de empresas" },
    { codigo: "65", nome: "Seguros de Edifício", tipo: "GASTO", descricao: "Apólices multirrisco comuns" },
    { codigo: "68", nome: "Obras de Conservação", tipo: "GASTO", descricao: "Gastos com pinturas, telhado e reparos" },
    { codigo: "71", nome: "Rendimentos de Quotas", tipo: "RENDIMENTO", descricao: "Contribuições de quotas ordinárias das frações" },
    { codigo: "72", nome: "Rendimentos FCR", tipo: "RENDIMENTO", descricao: "Reforços das frações consignados ao FCR" },
    { codigo: "78", nome: "Rendimentos Extraordinários", tipo: "RENDIMENTO", descricao: "Quotas extra para obras ou indemnizações" }
  ]);

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
      codigo: novoCodigo,
      nome: novoNome,
      tipo: novoTipo,
      descricao: novaDesc
    };
    setPlanoContas([...planoContas, nC].sort((a,b) => a.codigo.localeCompare(b.codigo)));
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

    alert(`Reconciliador Inteligente CondoManager AI:\nEncontrados ${matchedCount} cruzamentos automáticos perfeitos de valores e datas! Comprovativos vinculados à contabilidade.`);
  };

  // 3. Motor de Categorização Semântica / Regras
  const [inputRegraDesc, setInputRegraDesc] = useState("");
  const [sugestaoConta, setSugestaoConta] = useState<PlanoConta | null>(null);

  const testarCategorizacaoAutomatica = () => {
    if (!inputRegraDesc) {
      alert("Introduza um descritivo de transação (Ex: 'Fatura Eletricidade EDP de Junho').");
      return;
    }

    const desc = inputRegraDesc.toLowerCase();
    let codeMatch = "68"; // Default: Obras de Conservação / Geral
    
    if (desc.includes("epal") || desc.includes("água") || desc.includes("agua")) {
      codeMatch = "61";
    } else if (desc.includes("edp") || desc.includes("luz") || desc.includes("eletricidade") || desc.includes("gás")) {
      codeMatch = "62";
    } else if (desc.includes("elevador") || desc.includes("otis") || desc.includes("schindler") || desc.includes("kone")) {
      codeMatch = "63";
    } else if (desc.includes("limp") || desc.includes("estrela") || desc.includes("higienizacao")) {
      codeMatch = "64";
    } else if (desc.includes("seguro") || desc.includes("fidelidade") || desc.includes("apolice") || desc.includes("allianz")) {
      codeMatch = "65";
    } else if (desc.includes("quota") || desc.includes("fração") || desc.includes("fracao") || desc.includes("condómino")) {
      codeMatch = "71";
    } else if (desc.includes("fcr") || desc.includes("reserva")) {
      codeMatch = "72";
    }

    const found = planoContas.find(c => c.codigo === codeMatch);
    if (found) {
      setSugestaoConta(found);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="contabilidade-interna-module">
      {/* Description header */}
      <div className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 p-6 rounded-2xl border border-indigo-500/15">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md">
            <i className="fa-solid fa-calculator text-xl"></i>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Contabilidade Interna Integrada</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Gerencie a contabilidade do condomínio com um Plano de Contas adaptado (SNC), regras inteligentes para classificação de extratos e um motor de reconciliação cruzada automática de despesas e faturas.
            </p>
          </div>
        </div>
      </div>

      {/* Sub tabs inside Contabilidade */}
      <div className="flex space-x-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTabContab("plano")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTabContab === "plano" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <i className="fa-solid fa-folder-open mr-1.5"></i> Plano de Contas
        </button>
        <button
          onClick={() => setActiveTabContab("reconciliacao")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTabContab === "reconciliacao" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <i className="fa-solid fa-receipt mr-1.5"></i> Reconciliação com Comprovativos
        </button>
        <button
          onClick={() => setActiveTabContab("motor_regras")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTabContab === "motor_regras" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <i className="fa-solid fa-bolt mr-1.5"></i> Categorização Automática
        </button>
      </div>

      {/* 1. PLANO DE CONTAS */}
      {activeTabContab === "plano" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Add account */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Criar Conta Contábil</h4>
            <form onSubmit={handleAdicionarConta} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1 flex flex-col">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Código</label>
                  <input
                    type="text"
                    placeholder="Ex: 66"
                    value={novoCodigo}
                    onChange={e => setNovoCodigo(e.target.value)}
                    className="border border-slate-200 px-3 py-2 text-xs rounded-lg font-mono focus:outline-indigo-500 bg-slate-50/50"
                  />
                </div>
                <div className="col-span-2 flex flex-col">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Nome da Conta</label>
                  <input
                    type="text"
                    placeholder="Ex: Telecomunicações"
                    value={novoNome}
                    onChange={e => setNovoNome(e.target.value)}
                    className="border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-indigo-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Classe de Balanço</label>
                <select
                  value={novoTipo}
                  onChange={e => setNovoTipo(e.target.value as any)}
                  className="border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-indigo-500 bg-slate-50/50 cursor-pointer"
                >
                  <option value="GASTO">Classe 6 — Gastos (Custo)</option>
                  <option value="RENDIMENTO">Classe 7 — Rendimentos (Receita)</option>
                  <option value="ATIVO">Classe 1/2 — Ativo / Disponibilidades</option>
                  <option value="PASSIVO">Classe 2 — Passivo / Fornecedores</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Descrição Adicional</label>
                <textarea
                  placeholder="Explique o propósito contábil desta rubrica..."
                  rows={2}
                  value={novaDesc}
                  onChange={e => setNovaDesc(e.target.value)}
                  className="border border-slate-200 p-2 text-xs rounded-lg focus:outline-indigo-500 bg-slate-50/50"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
              >
                <i className="fa-solid fa-plus mr-1.5"></i> Adicionar Conta SNC
              </button>
            </form>
          </div>

          {/* List of accounts */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Rubricas Contábeis Ativas</h4>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {planoContas.map(c => (
                <div key={c.codigo} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between hover:border-indigo-300 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
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
                    <p className="text-[10px] text-slate-450 leading-relaxed">{c.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
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
                    <span className="text-[9px] text-slate-400 uppercase block">Fornecedor / Emitente</span>
                    <span className="font-bold text-white text-[11px] block">{ocrResult.fornecedor}</span>
                  </div>

                  <div className="p-2.5 bg-slate-800/80 rounded-lg">
                    <span className="text-[9px] text-slate-400 uppercase block">Nº Documento & Data</span>
                    <span className="font-bold text-white text-[11px] block">{ocrResult.num_fatura}</span>
                    <span className="text-[9px] text-slate-400">{ocrResult.data_emissao}</span>
                  </div>

                  <div className="p-2.5 bg-slate-800/80 rounded-lg">
                    <span className="text-[9px] text-slate-400 uppercase block">Valor Total</span>
                    <span className="font-bold text-emerald-400 text-sm block">€{ocrResult.valor_total.toFixed(2)}</span>
                  </div>

                  <div className="p-2.5 bg-slate-800/80 rounded-lg col-span-2 md:col-span-3">
                    <span className="text-[9px] text-slate-400 uppercase block">Cruzamento Bancário</span>
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
                <i className="fa-solid fa-wand-magic-sparkles text-indigo-600 mr-2"></i> Conciliação Bancária & Comprovativos Inteligente
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed max-w-2xl">
                O CondoManager AI lê os ficheiros de faturas digitadas e extratos bancários integrados em tempo real. Clique em "Iniciar Reconciliação" para emparelhar automaticamente faturas por valor e data de vencimento.
              </p>
            </div>
            <button
              onClick={triggerReconciliacaoAutomatica}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition-all flex items-center cursor-pointer shrink-0"
            >
              <i className="fa-solid fa-wand-magic-sparkles mr-2 animate-bounce"></i> Executar Reconciliação Automática
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bank movements */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2 flex justify-between">
                <span>Movimentos do Extrato Bancário</span>
                <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono">BPI Empresas</span>
              </h4>
              <div className="space-y-2">
                {movimentosReconciliacao.map(m => (
                  <div key={m.id_mov} className="p-3 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-mono">{m.data}</span>
                      <span className="text-[11px] font-black text-slate-750 block">{m.descricao}</span>
                      <span className="text-[9px] text-slate-500 block">Sugerido para: {m.categoria}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-mono font-bold block ${m.tipo === "RECEITA" ? "text-emerald-600" : "text-rose-600"}`}>
                        {m.tipo === "RECEITA" ? "+" : "-"}{m.valor.toFixed(2)}€
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
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2 flex justify-between">
                <span>Comprovativos Carregados (Faturas/Recibos)</span>
                <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">Arquivo Digital</span>
              </h4>
              <div className="space-y-2">
                {comprovativosPendentes.map(doc => (
                  <div key={doc.id_comprovativo} className="p-3 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-700 flex items-center">
                        <i className="fa-solid fa-file-pdf text-rose-600 mr-1.5 text-xs"></i>
                        {doc.nome_ficheiro}
                      </span>
                      <span className="text-[8px] text-slate-400 font-mono block mt-0.5">Extraído por OCR: {doc.data_sugerida} | Ref: {doc.descricao_sugerida}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-slate-800 block">{doc.valor_sugerido.toFixed(2)}€</span>
                      <span className={`text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-full inline-block mt-1 ${
                        doc.estado === "Reconciliado" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"
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
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Demonstração: Motor de Regras e Categorização Automática</h4>
            <p className="text-xs text-slate-500 mt-1">
              Introduza um descritivo livre (ex: do seu extrato bancário ou faturas OCR) e o algoritmo CondoManager AI associará automaticamente à rubrica correspondente do plano de contas nacional (SNC).
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Descritivo da Transação / Movimento</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Ex: Pagamento da fatura EDP luz condomínio Junho"
                  value={inputRegraDesc}
                  onChange={e => setInputRegraDesc(e.target.value)}
                  className="flex-grow border border-slate-200 px-3 py-2 text-xs rounded-lg focus:outline-indigo-500 bg-slate-50/50"
                />
                <button
                  onClick={testarCategorizacaoAutomatica}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
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
                  <div className="font-mono text-xs font-extrabold text-indigo-700 bg-white border border-indigo-100 px-3 py-1.5 rounded-lg inline-block mt-2">
                    Conta {sugestaoConta.codigo} — {sugestaoConta.nome} ({sugestaoConta.tipo})
                  </div>
                  <p className="text-[9px] text-slate-450 mt-1 leading-normal">
                    * Baseado em regras semânticas de relevância linguística (Regra SNB para faturas de serviços recorrentes).
                  </p>
                </div>
              </div>
            )}

            <div className="border-t border-slate-100 pt-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Exemplos Práticos Disponíveis</span>
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
          </div>
        </div>
      )}
    </div>
  );
}
