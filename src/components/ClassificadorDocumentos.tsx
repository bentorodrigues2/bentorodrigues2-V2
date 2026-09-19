import React, { useState } from "react";
import { Predio, Fracao, Conta, Movimento, Documento, LoggedUser } from "../types";
import {
  uploadDocumentoToStorage,
  saveDocumentoToSupabase,
  saveMovimentoToSupabase,
  saveContaToSupabase,
  registarLogAuditoria
} from "../lib/supabaseService";

interface ClassificadorDocumentosProps {
  predio: Predio;
  fracoes: Fracao[];
  contas: Conta[];
  setContas: React.Dispatch<React.SetStateAction<Conta[]>>;
  movements: Movimento[];
  setMovements: React.Dispatch<React.SetStateAction<Movimento[]>>;
  documentos: Documento[];
  setDocumentos: React.Dispatch<React.SetStateAction<Documento[]>>;
  loggedUser: LoggedUser;
  onNavigate?: (section: string) => void;
}

type TipoDocumento = "ata" | "extrato_bancario" | "comprovativo_financeiro" | "apolice_seguro" | "outro";

interface ResultadoClassificacao {
  tipo: TipoDocumento;
  confianca: number;
  resumo: string;
  titulo_sugerido?: string;
}

interface MovimentoExtraido {
  data: string;
  descricao: string;
  valor: number;
  tipo: "Receita" | "Despesa";
  categoria?: string;
}

// Classes Tailwind literais e completas por tipo (não construídas
// dinamicamente com template strings) — o JIT do Tailwind só reconhece
// classes que aparecem por extenso no código-fonte.
const LABELS_TIPO: Record<TipoDocumento, { label: string; icone: string; classesCaixa: string; classesIcone: string }> = {
  ata: {
    label: "Ata / Convocatória de Assembleia",
    icone: "fa-gavel",
    classesCaixa: "bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl p-4",
    classesIcone: "fa-solid fa-gavel text-lg text-indigo-600 dark:text-indigo-400"
  },
  extrato_bancario: {
    label: "Extrato Bancário",
    icone: "fa-building-columns",
    classesCaixa: "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl p-4",
    classesIcone: "fa-solid fa-building-columns text-lg text-emerald-600 dark:text-emerald-400"
  },
  comprovativo_financeiro: {
    label: "Comprovativo / Fatura / Recibo",
    icone: "fa-file-invoice-dollar",
    classesCaixa: "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4",
    classesIcone: "fa-solid fa-file-invoice-dollar text-lg text-amber-600 dark:text-amber-400"
  },
  apolice_seguro: {
    label: "Apólice de Seguro",
    icone: "fa-shield-halved",
    classesCaixa: "bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 rounded-xl p-4",
    classesIcone: "fa-solid fa-shield-halved text-lg text-sky-600 dark:text-sky-400"
  },
  outro: {
    label: "Outro Documento",
    icone: "fa-file",
    classesCaixa: "bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4",
    classesIcone: "fa-solid fa-file text-lg text-slate-600 dark:text-slate-400"
  }
};

export function ClassificadorDocumentos({ predio, fracoes, contas, setContas, movements, setMovements, documentos, setDocumentos, loggedUser, onNavigate }: ClassificadorDocumentosProps) {
  const [anexo, setAnexo] = useState<{ nome: string; base64: string; mimeType: string; file: File } | null>(null);
  const [classificando, setClassificando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoClassificacao | null>(null);
  const [tipoConfirmado, setTipoConfirmado] = useState<TipoDocumento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Estado do passo de extração/confirmação específico de cada tipo
  const [extraindo, setExtraindo] = useState(false);
  const [movimentosExtraidos, setMovimentosExtraidos] = useState<MovimentoExtraido[] | null>(null);
  const [movimentosSelecionados, setMovimentosSelecionados] = useState<Set<number>>(new Set());
  const [contaDestinoId, setContaDestinoId] = useState("");
  const [dadosComprovativo, setDadosComprovativo] = useState<any | null>(null);
  const [descricaoArquivo, setDescricaoArquivo] = useState("");

  const predioContas = contas.filter(c => c.id_predio === predio.id_predio);

  const lerFicheiroComoBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const resultado = reader.result as string;
        resolve(resultado.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const reiniciar = () => {
    setAnexo(null);
    setResultado(null);
    setTipoConfirmado(null);
    setErro(null);
    setSucesso(null);
    setMovimentosExtraidos(null);
    setMovimentosSelecionados(new Set());
    setDadosComprovativo(null);
    setDescricaoArquivo("");
  };

  const handleFile = async (file: File) => {
    reiniciar();
    if (file.size > 8 * 1024 * 1024) {
      setErro(`O ficheiro "${file.name}" tem ${(file.size / (1024 * 1024)).toFixed(1)} MB — o limite para leitura pela IA é de ~8 MB.`);
      return;
    }
    const base64 = await lerFicheiroComoBase64(file);
    setAnexo({ nome: file.name, base64, mimeType: file.type || "application/octet-stream", file });
  };

  const classificar = async () => {
    if (!anexo) return;
    setClassificando(true);
    setErro(null);
    try {
      const resp = await fetch("/api/ai?acao=classificar-documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64: anexo.base64, mimeType: anexo.mimeType })
      });
      let data: any = null;
      try { data = await resp.json(); } catch { /* resposta não-JSON tratada abaixo */ }
      if (!resp.ok || !data) {
        throw new Error(data?.error || "A IA não conseguiu classificar este documento.");
      }
      setResultado(data);
      setTipoConfirmado(data.tipo);
      setDescricaoArquivo(data.resumo || "");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao classificar o documento.");
    } finally {
      setClassificando(false);
    }
  };

  // --- Ação real 1: Arquivar (ata / apólice / outro) ---
  const arquivarDocumento = async (categoria: string, tema: string, extra?: Partial<Documento>) => {
    if (!anexo) return;
    setExtraindo(true);
    setErro(null);
    try {
      const ano = new Date().getFullYear().toString();
      const caminho = `${ano}/${categoria}/${predio.id_predio}/${Date.now()}-${anexo.nome}`;
      const urlReal = await uploadDocumentoToStorage(anexo.file, caminho);
      if (!urlReal) {
        throw new Error("Não foi possível carregar o ficheiro para o Supabase Storage.");
      }
      const novoDoc: Documento = {
        id_doc: "doc-clf-" + Date.now(),
        id_predio: predio.id_predio,
        nome: resultado?.titulo_sugerido ? `${resultado.titulo_sugerido}.pdf` : anexo.nome,
        tipo: categoria,
        data_upload: new Date().toISOString().split("T")[0],
        tamanho: `${(anexo.file.size / 1024).toFixed(0)} KB`,
        categoria,
        descricao: descricaoArquivo || resultado?.resumo || "",
        visibilidade: "Administração",
        autor: loggedUser.nome || "Administração",
        tema,
        ano,
        caminho: urlReal,
        arquivado: true,
        data_arquivamento: new Date().toISOString().split("T")[0],
        tipo_arquivo: "documento",
        relevancia_perfis: ["ADMIN", "EMPRESA_GESTORA", "USER", "CONTABILISTA"],
        ...extra
      };
      const ok = await saveDocumentoToSupabase(novoDoc);
      if (!ok) throw new Error("Não foi possível gravar o documento no Supabase.");
      setDocumentos(prev => [novoDoc, ...prev]);
      registarLogAuditoria("Documental", `Classificou e arquivou um documento como "${categoria}" via IA`, predio.id_predio, loggedUser, novoDoc.nome);
      setSucesso(`Documento arquivado com sucesso em "${categoria}".`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao arquivar o documento.");
    } finally {
      setExtraindo(false);
    }
  };

  // --- Ação real 2: Extrato bancário → extrair movimentos e importar ---
  const extrairExtrato = async () => {
    if (!anexo) return;
    setExtraindo(true);
    setErro(null);
    try {
      const resp = await fetch("/api/ai?acao=extrair-movimentos-historicos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anexos: [{ base64: anexo.base64, mimeType: anexo.mimeType }] })
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok || !Array.isArray(data.movimentos)) {
        throw new Error(data?.error || "A IA não conseguiu identificar movimentos neste extrato.");
      }
      setMovimentosExtraidos(data.movimentos);
      setMovimentosSelecionados(new Set(data.movimentos.map((_: any, i: number) => i)));
      if (predioContas.length > 0) setContaDestinoId(predioContas[0].id_conta);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao extrair movimentos do extrato.");
    } finally {
      setExtraindo(false);
    }
  };

  const importarMovimentosSelecionados = async () => {
    if (!movimentosExtraidos || !contaDestinoId) {
      setErro("Selecione a conta bancária de destino.");
      return;
    }
    const contaAlvo = contas.find(c => c.id_conta === contaDestinoId);
    if (!contaAlvo) return;

    setExtraindo(true);
    try {
      const selecionados = movimentosExtraidos.filter((_, i) => movimentosSelecionados.has(i));
      let saldoAtualizado = contaAlvo.saldo || 0;
      const novosMovimentos: Movimento[] = selecionados.map((m, idx) => {
        saldoAtualizado += m.tipo === "Receita" ? m.valor : -m.valor;
        return {
          id_mov: "mov-clf-" + Date.now() + "-" + idx,
          id_predio: predio.id_predio,
          id_conta: contaDestinoId,
          data: m.data,
          tipo: m.tipo,
          valor: m.valor,
          descricao: m.descricao,
          categoria: m.categoria || "Outro",
          estado: "Justificado"
        };
      });

      const contaFinal = { ...contaAlvo, saldo: Math.round(saldoAtualizado * 100) / 100 };
      setContas(prev => prev.map(c => c.id_conta === contaDestinoId ? contaFinal : c));
      await saveContaToSupabase(contaFinal);

      setMovements(prev => [...novosMovimentos, ...prev]);
      await Promise.all(novosMovimentos.map(m => saveMovimentoToSupabase(m)));

      registarLogAuditoria("Financeira", `Importou ${novosMovimentos.length} movimentos de um extrato bancário classificado por IA`, predio.id_predio, loggedUser, `Conta: ${contaAlvo.banco}`);
      setSucesso(`${novosMovimentos.length} movimento(s) importado(s) com sucesso para ${contaAlvo.banco}.`);
      setMovimentosExtraidos(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao importar os movimentos.");
    } finally {
      setExtraindo(false);
    }
  };

  // --- Ação real 3: Comprovativo/Fatura → extrair e lançar movimento pendente ---
  const extrairComprovativo = async () => {
    if (!anexo) return;
    setExtraindo(true);
    setErro(null);
    try {
      const resp = await fetch("/api/ai?acao=reconhecer-anexo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64: anexo.base64, mimeType: anexo.mimeType })
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data?.error || "A IA não conseguiu ler este documento.");
      }
      setDadosComprovativo(data.dados || {});
      if (predioContas.length > 0) setContaDestinoId(predioContas[0].id_conta);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao extrair dados do comprovativo.");
    } finally {
      setExtraindo(false);
    }
  };

  const lancarMovimentoComprovativo = async () => {
    if (!dadosComprovativo || !contaDestinoId) {
      setErro("Selecione a conta bancária de destino.");
      return;
    }
    const contaAlvo = contas.find(c => c.id_conta === contaDestinoId);
    if (!contaAlvo) return;
    const valor = Number(dadosComprovativo.valor_total) || 0;
    if (valor <= 0) {
      setErro("Valor extraído inválido — não é possível lançar o movimento.");
      return;
    }

    setExtraindo(true);
    try {
      const novoMovimento: Movimento = {
        id_mov: "mov-clf-" + Date.now(),
        id_predio: predio.id_predio,
        id_conta: contaDestinoId,
        data: dadosComprovativo.data_documento || new Date().toISOString().split("T")[0],
        tipo: "Despesa",
        valor,
        descricao: `${dadosComprovativo.entidade || "Fornecedor"} — ${dadosComprovativo.referencia || anexo?.nome || ""}`.trim(),
        categoria: dadosComprovativo.categoria_contabilistica || "Outro",
        estado: "Movimento Cego / Por Justificar",
        is_movimento_cego: true
      };
      const contaFinal = { ...contaAlvo, saldo: Math.round(((contaAlvo.saldo || 0) - valor) * 100) / 100 };
      setContas(prev => prev.map(c => c.id_conta === contaDestinoId ? contaFinal : c));
      await saveContaToSupabase(contaFinal);

      setMovements(prev => [novoMovimento, ...prev]);
      await saveMovimentoToSupabase(novoMovimento);

      await arquivarDocumento("Comprovativos & Faturas", "Financeiro");

      registarLogAuditoria("Financeira", "Lançou um movimento a partir de um comprovativo classificado por IA", predio.id_predio, loggedUser, `${valor.toFixed(2)}€ — ${dadosComprovativo.entidade || ""}`);
      setSucesso(`Movimento de ${valor.toFixed(2)}€ lançado como "Por Justificar" em Movimentos & Tesouraria, e documento arquivado.`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao lançar o movimento.");
    } finally {
      setExtraindo(false);
    }
  };

  const toggleMovimentoSelecionado = (idx: number) => {
    setMovimentosSelecionados(prev => {
      const novo = new Set(prev);
      if (novo.has(idx)) novo.delete(idx); else novo.add(idx);
      return novo;
    });
  };

  return (
    <div className="space-y-6">
      {/* CABEÇALHO UNIFORMIZADO CONDOMANAGER AI */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-950 text-white p-6 rounded-2xl border border-emerald-500/30 shadow-lg relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl"></div>
        <div className="relative flex items-center gap-3">
          <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1 border border-emerald-400/30">
            Classificador IA
          </span>
        </div>
        <h2 className="relative text-lg font-black mt-2">Classificador Geral de Documentos</h2>
        <p className="relative text-xs text-slate-300 mt-1 max-w-2xl">
          Carregue qualquer documento (ata, extrato bancário, fatura, apólice de seguro...) e a IA identifica o que é e sugere a ação certa — arquivar, importar movimentos, lançar uma despesa ou associar a um seguro.
        </p>
      </div>

      {erro && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 p-4 rounded-xl flex items-start gap-3 text-sm">
          <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0"></i>
          <div><span className="font-bold">Ocorreu um problema:</span> {erro}</div>
        </div>
      )}

      {sucesso && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 p-4 rounded-xl flex items-center justify-between gap-3 text-sm">
          <div className="flex items-start gap-3">
            <i className="fa-solid fa-circle-check mt-0.5 shrink-0"></i>
            <span>{sucesso}</span>
          </div>
          <button onClick={reiniciar} className="text-xs font-bold underline cursor-pointer shrink-0">Classificar outro documento</button>
        </div>
      )}

      {!sucesso && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-5">
          {!anexo ? (
            <label className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <i className="fa-solid fa-cloud-arrow-up text-3xl text-emerald-500 mb-3"></i>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Arraste ou clique para carregar um documento</span>
              <span className="text-[11px] text-slate-400 mt-1">PDF, imagem, ou foto — qualquer tipo de documento do condomínio</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
          ) : (
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-file-lines text-xl text-emerald-500"></i>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">{anexo.nome}</p>
                  <p className="text-[10px] text-slate-400">{(anexo.file.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
              {!resultado && (
                <div className="flex items-center gap-2">
                  <button onClick={reiniciar} className="text-xs font-bold text-slate-400 hover:text-rose-600 cursor-pointer">
                    Remover
                  </button>
                  <button
                    onClick={classificar}
                    disabled={classificando}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2"
                  >
                    {classificando ? (
                      <><i className="fa-solid fa-spinner fa-spin"></i><span>A classificar com IA...</span></>
                    ) : (
                      <><i className="fa-solid fa-wand-magic-sparkles"></i><span>Classificar com IA</span></>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {resultado && tipoConfirmado && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4">
              <div className={LABELS_TIPO[tipoConfirmado].classesCaixa}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <i className={LABELS_TIPO[tipoConfirmado].classesIcone}></i>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">{LABELS_TIPO[tipoConfirmado].label}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{resultado.resumo}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 shrink-0">Confiança: {Math.round((resultado.confianca || 0) * 100)}%</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Não é isto? Corrigir:</label>
                  <select
                    value={tipoConfirmado}
                    onChange={(e) => { setTipoConfirmado(e.target.value as TipoDocumento); setMovimentosExtraidos(null); setDadosComprovativo(null); }}
                    className="text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg px-2 py-1"
                  >
                    {(Object.keys(LABELS_TIPO) as TipoDocumento[]).map(t => (
                      <option key={t} value={t}>{LABELS_TIPO[t].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* AÇÃO: ATA */}
              {tipoConfirmado === "ata" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Descrição para o Arquivo</label>
                    <input
                      type="text"
                      value={descricaoArquivo}
                      onChange={(e) => setDescricaoArquivo(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs px-3 py-2 rounded-lg"
                    />
                  </div>
                  <button
                    onClick={() => arquivarDocumento("Atas & Assembleias", "Assembleias")}
                    disabled={extraindo}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer flex items-center gap-2"
                  >
                    {extraindo ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-box-archive"></i>}
                    <span>Arquivar em Atas & Assembleias</span>
                  </button>
                </div>
              )}

              {/* AÇÃO: OUTRO */}
              {tipoConfirmado === "outro" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Descrição para o Arquivo</label>
                    <input
                      type="text"
                      value={descricaoArquivo}
                      onChange={(e) => setDescricaoArquivo(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs px-3 py-2 rounded-lg"
                    />
                  </div>
                  <button
                    onClick={() => arquivarDocumento("Diversos", "Geral")}
                    disabled={extraindo}
                    className="bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer flex items-center gap-2"
                  >
                    {extraindo ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-box-archive"></i>}
                    <span>Arquivar em Diversos</span>
                  </button>
                </div>
              )}

              {/* AÇÃO: APÓLICE DE SEGURO */}
              {tipoConfirmado === "apolice_seguro" && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Arquiva o documento e abre depois Gestão de Sinistros & Seguros, onde pode associar a apólice à fração/parte comum correta com todos os dados extraídos automaticamente.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => arquivarDocumento("Seguros", "Seguros")}
                      disabled={extraindo}
                      className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer flex items-center gap-2"
                    >
                      {extraindo ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-box-archive"></i>}
                      <span>Arquivar em Seguros</span>
                    </button>
                    {onNavigate && (
                      <button
                        onClick={() => onNavigate("gestao_sinistros")}
                        className="bg-white dark:bg-slate-900 border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-400 text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer flex items-center gap-2"
                      >
                        <i className="fa-solid fa-arrow-right"></i>
                        <span>Abrir em Seguros</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* AÇÃO: COMPROVATIVO FINANCEIRO */}
              {tipoConfirmado === "comprovativo_financeiro" && (
                <div className="space-y-3">
                  {!dadosComprovativo ? (
                    <button
                      onClick={extrairComprovativo}
                      disabled={extraindo}
                      className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer flex items-center gap-2"
                    >
                      {extraindo ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-magnifying-glass-dollar"></i>}
                      <span>Extrair Dados Financeiros</span>
                    </button>
                  ) : (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div><span className="text-slate-400">Entidade:</span> <strong>{dadosComprovativo.entidade || "—"}</strong></div>
                        <div><span className="text-slate-400">Valor:</span> <strong>{Number(dadosComprovativo.valor_total || 0).toFixed(2)} €</strong></div>
                        <div><span className="text-slate-400">Data:</span> <strong>{dadosComprovativo.data_documento || "—"}</strong></div>
                        <div><span className="text-slate-400">Categoria:</span> <strong>{dadosComprovativo.categoria_contabilistica || "—"}</strong></div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Conta a Debitar *</label>
                        <select
                          value={contaDestinoId}
                          onChange={(e) => setContaDestinoId(e.target.value)}
                          className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg px-2.5 py-1.5"
                        >
                          <option value="">Selecione a conta...</option>
                          {predioContas.map(c => (
                            <option key={c.id_conta} value={c.id_conta}>{c.banco} ({c.tipo}) — Saldo: {c.saldo?.toFixed(2)}€</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={lancarMovimentoComprovativo}
                        disabled={extraindo}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer flex items-center gap-2"
                      >
                        {extraindo ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                        <span>Confirmar e Lançar Movimento</span>
                      </button>
                      <p className="text-[10px] text-slate-500">O movimento entra como "Por Justificar" em Movimentos & Tesouraria para confirmação final.</p>
                    </div>
                  )}
                </div>
              )}

              {/* AÇÃO: EXTRATO BANCÁRIO */}
              {tipoConfirmado === "extrato_bancario" && (
                <div className="space-y-3">
                  {!movimentosExtraidos ? (
                    <button
                      onClick={extrairExtrato}
                      disabled={extraindo}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer flex items-center gap-2"
                    >
                      {extraindo ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-list-check"></i>}
                      <span>Extrair Movimentos do Extrato</span>
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Conta de Destino *</label>
                        <select
                          value={contaDestinoId}
                          onChange={(e) => setContaDestinoId(e.target.value)}
                          className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg px-2.5 py-1.5"
                        >
                          <option value="">Selecione a conta...</option>
                          {predioContas.map(c => (
                            <option key={c.id_conta} value={c.id_conta}>{c.banco} ({c.tipo}) — Saldo: {c.saldo?.toFixed(2)}€</option>
                          ))}
                        </select>
                      </div>
                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
                            <tr>
                              <th className="p-2 w-8"></th>
                              <th className="p-2">Data</th>
                              <th className="p-2">Descrição</th>
                              <th className="p-2">Tipo</th>
                              <th className="p-2 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {movimentosExtraidos.map((m, idx) => (
                              <tr key={idx} className={movimentosSelecionados.has(idx) ? "" : "opacity-40"}>
                                <td className="p-2">
                                  <input type="checkbox" checked={movimentosSelecionados.has(idx)} onChange={() => toggleMovimentoSelecionado(idx)} />
                                </td>
                                <td className="p-2 font-mono">{m.data}</td>
                                <td className="p-2">{m.descricao}</td>
                                <td className={`p-2 font-bold ${m.tipo === "Receita" ? "text-emerald-600" : "text-rose-600"}`}>{m.tipo}</td>
                                <td className="p-2 text-right font-mono">{m.valor.toFixed(2)} €</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button
                        onClick={importarMovimentosSelecionados}
                        disabled={extraindo || movimentosSelecionados.size === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer flex items-center gap-2"
                      >
                        {extraindo ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                        <span>Importar {movimentosSelecionados.size} Movimento(s) Selecionado(s)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
