import React, { useState } from "react";
import { Predio, Fracao, Fornecedor, Movimento } from "../types";
import { 
  FileText, 
  UploadCloud, 
  Sparkles, 
  CheckCircle2, 
  Receipt,
  Bot,
  Search, 
  Check, 
  RefreshCw, 
  Paperclip, 
  FileUp,
  FileCheck2,
  DollarSign,
  Building,
  Calendar,
  CreditCard,
  Layers,
  ArrowDownToLine,
  Eye
} from "lucide-react";
import { formatDatePT } from "../utils";

interface LeitorAnexosIAProps {
  predio: Predio;
  fracoes: Fracao[];
  fornecedores?: Fornecedor[];
  onMovimentoCriado?: (mov: Movimento) => void;
}

interface DocumentoAnalisado {
  id: string;
  nomeArquivo: string;
  tamanho: string;
  tipo: "FATURA_DESPESA" | "COMPROVATIVO_TRANSFERENCIA" | "ORCAMENTO_OBRA" | "CONTRATO_MANUTENCAO";
  dataUpload: string;
  status: "ANALISANDO" | "CONCLUIDO" | "LANCADO" | "ERRO";
  confiancaIa?: number;
  dadosExtraidos: {
    fornecedorNome?: string;
    nif?: string;
    numeroFatura?: string;
    dataDocumento?: string;
    dataVencimento?: string;
    valorTotal: number;
    valorIva?: number;
    taxaIva?: string;
    ibanDestino?: string;
    categoriaRubrica: string;
    fracaoReferenciada?: string;
    descricaoDespesa: string;
    resumoIa: string;
  };
}

export function LeitorAnexosIA({ predio, fracoes, fornecedores = [], onMovimentoCriado }: LeitorAnexosIAProps) {
  // Sem documentos de exemplo fixos — a lista só mostra o que for mesmo
  // carregado e lido pela IA nesta sessão.
  const [documentos, setDocumentos] = useState<DocumentoAnalisado[]>([]);

  const [docSelecionado, setDocSelecionado] = useState<DocumentoAnalisado | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [pesquisa, setPesquisa] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const lerFicheiroComoBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const resultado = reader.result as string;
        // reader.result vem como "data:<mime>;base64,<dados>" — só o Gemini
        // precisa da parte depois da vírgula.
        resolve(resultado.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    const file = files[0];

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
      const tipoDoc = (dados.tipo_documento || "").toLowerCase();
      const ehComprovativo = tipoDoc === "comprovativo" || tipoDoc === "recibo";

      const novoDoc: DocumentoAnalisado = {
        id: `doc-${Date.now()}`,
        nomeArquivo: file.name,
        tamanho: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        tipo: ehComprovativo ? "COMPROVATIVO_TRANSFERENCIA" : "FATURA_DESPESA",
        dataUpload: new Date().toISOString().replace("T", " ").substring(0, 16),
        status: "CONCLUIDO",
        dadosExtraidos: {
          fornecedorNome: dados.entidade || undefined,
          numeroFatura: dados.referencia || undefined,
          dataDocumento: dados.data_documento || new Date().toISOString().split("T")[0],
          valorTotal: Number(dados.valor_total) || 0,
          categoriaRubrica: dados.categoria_contabilistica || "Por classificar",
          descricaoDespesa: `${tipoDoc || "Documento"} de ${dados.entidade || "entidade não identificada"}`,
          resumoIa: `Leitura real por IA (Gemini Vision): ${dados.entidade || "entidade não identificada"}, ${Number(dados.valor_total || 0).toFixed(2)}€, tipo "${dados.tipo_documento || "não classificado"}".`
        }
      };

      setDocumentos(prev => [novoDoc, ...prev]);
      setDocSelecionado(novoDoc);
      showToast(`Documento "${file.name}" processado com sucesso pelo Gemini Vision!`);
    } catch (err: any) {
      showToast(`❌ Erro ao processar "${file.name}": ${err?.message || "erro desconhecido"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const lancarComoMovimento = (doc: DocumentoAnalisado) => {
    const isReceita = doc.tipo === "COMPROVATIVO_TRANSFERENCIA";
    const novoMov: Movimento = {
      id_mov: `mov-${Date.now()}`,
      id_predio: predio.id_predio,
      id_conta: "",
      data: doc.dadosExtraidos.dataDocumento || new Date().toISOString().split("T")[0],
      descricao: `${doc.dadosExtraidos.fornecedorNome || "Documento lido por IA"}: ${doc.dadosExtraidos.descricaoDespesa}`,
      tipo: isReceita ? "Receita" : "Despesa",
      valor: doc.dadosExtraidos.valorTotal,
      categoria: doc.dadosExtraidos.categoriaRubrica,
      metodo_pagamento: "Transferência",
      estado: "Movimento Cego / Por Justificar",
      is_movimento_cego: true
    };

    setDocumentos(prev => prev.map(d => d.id === doc.id ? { ...d, status: "LANCADO" } : d));

    if (onMovimentoCriado) {
      onMovimentoCriado(novoMov);
    } else {
      showToast(`✅ Lançado no mapa financeiro como ${isReceita ? "Receita" : "Despesa"} (${doc.dadosExtraidos.valorTotal.toFixed(2)}€)!`);
    }
  };

  const docsFiltrados = documentos.filter(doc => {
    const matchFiltro = filtroTipo === "TODOS" || doc.tipo === filtroTipo;
    const matchSearch = pesquisa === "" || 
      doc.nomeArquivo.toLowerCase().includes(pesquisa.toLowerCase()) ||
      (doc.dadosExtraidos.fornecedorNome && doc.dadosExtraidos.fornecedorNome.toLowerCase().includes(pesquisa.toLowerCase())) ||
      doc.dadosExtraidos.categoriaRubrica.toLowerCase().includes(pesquisa.toLowerCase());
    return matchFiltro && matchSearch;
  });

  const totalValor = documentos.reduce((acc, d) => acc + d.dadosExtraidos.valorTotal, 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-500 flex items-center gap-3 animate-fade-in text-xs font-bold">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BANNER SUPERIOR - CORES OFICIAIS DO CONDOMANAGER AI (EMERALD & SLATE)     */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white p-6 sm:p-7 rounded-3xl border border-emerald-500/30 shadow-xl space-y-4 relative overflow-hidden">
        {/* Glow background accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5" /> Leitor IA de Anexos & OCR
              </span>
              <span className="text-xs text-slate-400 font-mono">Google AI Studio & Gemini Vision</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Reconhecimento Automático de Faturas e Comprovativos
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Faça a triagem ótica e reconhecimento inteligente de faturas de fornecedores ou comprovativos de transferência recebidos por e-mail oficial (<code className="text-emerald-300 bg-emerald-950/80 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">{predio.email || "oficial@condomanager.pt"}</code>). O Gemini extrai entidades, NIFs, datas e valores para lançamento imediato na contabilidade.
            </p>
          </div>

          {/* KPI Badge Oficial */}
          <div className="bg-slate-900/90 border border-emerald-500/30 p-3 px-5 rounded-2xl text-right shrink-0 shadow-lg">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Identificado</span>
            <span className="text-base font-black font-mono text-emerald-400">{totalValor.toFixed(2)} €</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* WORKSPACE PRINCIPAL: FOLHA VERTICAL + LISTA + PAINEL DE DETALHES         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ======================================================================= */}
        {/* COLUNA 1 (3 COLS): ÁREA DE ARRASTE EM FORMATO DE FOLHA NA VERTICAL (A4) */}
        {/* ======================================================================= */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <FileUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Entrada de Ficheiros</span>
              </span>
              <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono px-2 py-0.5 rounded-full font-bold border border-emerald-500/20">
                OCR Pronto
              </span>
            </div>

            {/* FOLHA NA VERTICAL (PORTRAIT SHEET FORMAT) */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files); }}
              className={`relative aspect-[1/1.414] w-full rounded-2xl transition-all flex flex-col justify-between p-5 text-center cursor-pointer overflow-hidden ${
                dragOver 
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-2 border-dashed border-emerald-500 shadow-lg scale-[1.02]" 
                  : "bg-slate-50 dark:bg-slate-950/60 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500/60 hover:bg-slate-100/70 dark:hover:bg-slate-900/80 shadow-inner"
              }`}
            >
              {/* Decorative Corner Fold (Simulação de Folha/Documento A4) */}
              <div className="absolute top-0 right-0 w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-bl-xl border-b border-l border-slate-300 dark:border-slate-700 shadow-xs pointer-events-none"></div>

              {/* Folha Header */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                <span className="flex items-center gap-1"><FileText className="h-3 w-3 text-slate-400" /> DOC-A4</span>
                <span className="bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">Digitalizar</span>
              </div>

              {/* Folha Center Drop Content */}
              <div className="space-y-3 my-auto py-2">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-xs">
                  {isProcessing ? (
                    <RefreshCw className="h-7 w-7 animate-spin text-emerald-500" />
                  ) : (
                    <UploadCloud className="h-7 w-7" />
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    {isProcessing ? "A processar via Gemini..." : "Arraste a folha ou fatura para aqui"}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug px-1">
                    Solte o ficheiro nesta folha para extrair dados fiscais automaticamente.
                  </p>
                </div>

                <div className="pt-1">
                  <input
                    type="file"
                    id="file-ocr-vertical-sheet"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                  <label
                    htmlFor="file-ocr-vertical-sheet"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    <span>Carregar Ficheiro</span>
                  </label>
                </div>
              </div>

              {/* Folha Footer Supported Formats */}
              <div className="border-t border-slate-200 dark:border-slate-800/80 pt-2 text-[10px] text-slate-400 space-y-1">
                <div className="flex justify-center gap-1 font-mono font-bold text-[9px] text-slate-500 dark:text-slate-400">
                  <span className="bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">PDF</span>
                  <span className="bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">JPG</span>
                  <span className="bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">PNG</span>
                  <span className="bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">DOC</span>
                </div>
                <span className="block text-[9px]">Leitura de NIF, Data, IVA e IBAN</span>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* COLUNA 2 (5 COLS): LISTA ESTRUTURADA DE DOCUMENTOS EXTRAÍDOS             */}
        {/* ======================================================================= */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3">
          {/* Header com Filtros */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Documentos Reconhecidos ({docsFiltrados.length})
              </h3>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setFiltroTipo("TODOS")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filtroTipo === "TODOS" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo("FATURA_DESPESA")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filtroTipo === "FATURA_DESPESA" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Faturas
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo("COMPROVATIVO_TRANSFERENCIA")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filtroTipo === "COMPROVATIVO_TRANSFERENCIA" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Comprovativos
              </button>
            </div>
          </div>

          {/* Caixa de Pesquisa */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              placeholder="Pesquisar por fornecedor, ficheiro ou rubrica..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 dark:text-slate-200"
            />
          </div>

          {/* LISTA DINÂMICA DE DOCUMENTOS */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 divide-y divide-slate-100 dark:divide-slate-800/60">
            {docsFiltrados.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-8">Nenhum documento corresponde aos filtros.</p>
            ) : (
              docsFiltrados.map((doc) => {
                const isSelected = docSelecionado?.id === doc.id;
                const isReceita = doc.tipo === "COMPROVATIVO_TRANSFERENCIA";

                return (
                  <div
                    key={doc.id}
                    onClick={() => setDocSelecionado(doc)}
                    className={`pt-2.5 first:pt-0 pb-2 px-3 rounded-2xl transition-all cursor-pointer text-xs space-y-1.5 ${
                      isSelected 
                        ? "bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-500/50 shadow-xs" 
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent"
                    }`}
                  >
                    {/* Row Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className={`p-2 rounded-xl shrink-0 ${
                          isReceita 
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" 
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}>
                          {isReceita ? <Receipt className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-slate-900 dark:text-white truncate block">
                            {doc.dadosExtraidos.fornecedorNome || doc.nomeArquivo}
                          </span>
                          <span className="text-[11px] text-slate-400 truncate block">
                            {doc.nomeArquivo} • {doc.tamanho}
                          </span>
                        </div>
                      </div>

                      {/* Right: Amount & Status Badge */}
                      <div className="text-right shrink-0">
                        <span className={`font-mono font-bold text-sm block ${isReceita ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100"}`}>
                          {doc.dadosExtraidos.valorTotal.toFixed(2)} €
                        </span>
                        {doc.status === "LANCADO" ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                            <Check className="h-2.5 w-2.5" /> Lançado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            <Sparkles className="h-2.5 w-2.5" /> Lido por IA
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata strip */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                      <span className="truncate max-w-[200px]">
                        Rubrica: <strong className="text-slate-700 dark:text-slate-300">{doc.dadosExtraidos.categoriaRubrica}</strong>
                      </span>
                      <span className="font-mono text-[10px]">
                        {doc.dadosExtraidos.dataDocumento || doc.dataUpload.split(" ")[0]}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ======================================================================= */}
        {/* COLUNA 3 (4 COLS): PAINEL DE INSPEÇÃO OCR & LANÇAMENTO                   */}
        {/* ======================================================================= */}
        <div className="lg:col-span-4">
          {docSelecionado ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
              {/* Header Details */}
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 font-bold rounded text-[10px] uppercase ${
                      docSelecionado.tipo === "COMPROVATIVO_TRANSFERENCIA"
                        ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300"
                    }`}>
                      {docSelecionado.tipo === "COMPROVATIVO_TRANSFERENCIA" ? "Comprovativo" : "Fatura Fornecedor"}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">{docSelecionado.dadosExtraidos.numeroFatura || "S/N"}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                    {docSelecionado.dadosExtraidos.fornecedorNome || "Entidade Detetada"}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => lancarComoMovimento(docSelecionado)}
                  disabled={docSelecionado.status === "LANCADO"}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{docSelecionado.status === "LANCADO" ? "Já Lançado" : "Lançar"}</span>
                </button>
              </div>

              {/* Semantic Analysis Card */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Análise Semântica Gemini</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  {docSelecionado.dadosExtraidos.resumoIa}
                </p>
              </div>

              {/* Extracted Fields Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Valor Total</span>
                  <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {docSelecionado.dadosExtraidos.valorTotal.toFixed(2)} €
                  </span>
                  {docSelecionado.dadosExtraidos.valorIva && (
                    <span className="text-[10px] text-slate-400 block">
                      IVA ({docSelecionado.dadosExtraidos.taxaIva}): {docSelecionado.dadosExtraidos.valorIva.toFixed(2)}€
                    </span>
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">NIF Entidade</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                    {docSelecionado.dadosExtraidos.nif || "Não detetado"}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Doc: {docSelecionado.dadosExtraidos.numeroFatura || "—"}
                  </span>
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Rubrica</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 truncate block">
                    {docSelecionado.dadosExtraidos.categoriaRubrica}
                  </span>
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Data / Vencimento</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-bold block">
                    {formatDatePT(docSelecionado.dadosExtraidos.dataDocumento || "")}
                  </span>
                </div>

                <div className="col-span-2 p-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">IBAN de Liquidação</span>
                  <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate block">
                    {docSelecionado.dadosExtraidos.ibanDestino || "Não especificado"}
                  </span>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs text-center space-y-2">
              <FileText className="h-10 w-10 text-slate-300 dark:text-slate-700" />
              <p>Selecione um documento da lista para visualizar a extração de dados fiscais.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
