import React, { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { Predio, Fornecedor, LoggedUser } from "../types";
import { exportToXLS, generateSupplierPwaManualPDF, gerarPdfRegistoFornecedorHomologado, gerarCartaoAniversarioCondominoPDF } from "../utils";

interface GestaoFornecedoresProps {
  predio: Predio;
  fornecedores: Fornecedor[];
  onAddFornecedor: (novoFornecedor: Fornecedor) => void;
  loggedUser: LoggedUser;
  initialTab?: "fornecedores" | "contratos";
}

export interface Contrato {
  id_contrato: string;
  id_predio: string;
  id_fornecedor: string;
  servico: string;
  custo_mensal: number;
  custo_anual: number;
  renovacao_automatica: boolean;
  data_fim: string;
  alerta_renovacao: boolean;
  sla_resposta?: string;
  penalizacao_atraso?: string;
  indexacao_preco?: string;
  historico_renovacoes?: string[];
  documento_nome?: string;
  documento_base64?: string;
}

export function GestaoFornecedores({ predio, fornecedores, onAddFornecedor, loggedUser, initialTab }: GestaoFornecedoresProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"fornecedores" | "contratos">(initialTab || "fornecedores");
  const [fornecedoresList, setFornecedoresList] = useState<Fornecedor[]>(fornecedores);

  useEffect(() => {
    setFornecedoresList(fornecedores);
  }, [fornecedores]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Suppliers form state
  const [nome, setNome] = useState("");
  const [nif, setNif] = useState("");
  const [iban, setIban] = useState("");
  const [categoria, setCategoria] = useState("");
  const [morada, setMorada] = useState("");
  const [contacto, setContacto] = useState("");
  const [pessoaContacto, setPessoaContacto] = useState("");
  const [telemovelDireto, setTelemovelDireto] = useState("");
  const [emailContacto, setEmailContacto] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [perfisPwa, setPerfisPwa] = useState<("LIMPEZAS" | "TECNICO" | "JURIDICO" | "AUDITOR" | "CONTABILISTA")[]>([]);

  // Modals for supplier automated emails
  const [welcomeModalFornecedor, setWelcomeModalFornecedor] = useState<Fornecedor | null>(null);
  const [birthdayModalFornecedor, setBirthdayModalFornecedor] = useState<Fornecedor | null>(null);

  const togglePerfilPwa = (perfil: "LIMPEZAS" | "TECNICO" | "JURIDICO" | "AUDITOR" | "CONTABILISTA") => {
    setPerfisPwa(prev => 
      prev.includes(perfil) ? prev.filter(p => p !== perfil) : [...prev, perfil]
    );
  };

  // Contract state & simulated data store
  const [contratos, setContratos] = useState<Contrato[]>([
    {
      id_contrato: "contr-1",
      id_predio: "predio-1",
      id_fornecedor: "forn-1", // Reference to first supplier
      servico: "Manutenção Preventiva de Elevadores (Contrato Mensal)",
      custo_mensal: 85.0,
      custo_anual: 1020.0,
      renovacao_automatica: true,
      data_fim: "2026-12-31",
      alerta_renovacao: true,
      sla_resposta: "2h (Emergência) / 24h (Padrão)",
      penalizacao_atraso: "5% de desconto mensal por cada dia de paragem não agendada",
      indexacao_preco: "Taxa Inflação INE (IPC +2.1%)",
      historico_renovacoes: ["Renovado automaticamente em 01-01-2026 para 2026-12-31"],
      documento_nome: "contrato_otis_elevador_assinado.pdf"
    },
    {
      id_contrato: "contr-2",
      id_predio: "predio-1",
      id_fornecedor: "forn-2",
      servico: "Seguro Multirriscos Edifícios (Anual)",
      custo_mensal: 29.17,
      custo_anual: 350.0,
      renovacao_automatica: true,
      data_fim: "2026-08-10", // Expiration within 30 days
      alerta_renovacao: true,
      sla_resposta: "Peritagem até 48h após sinistro",
      penalizacao_atraso: "Sem penalização aplicável",
      indexacao_preco: "Revisão Anual de Valor de Reconstrução (+3.5%)",
      historico_renovacoes: ["Em Período de Pré-Aviso de Renovação 2026/2027"],
      documento_nome: "apolice_multirriscos_fidelidade_2026.pdf"
    }
  ]);

  // Global budget reference for impact evaluation
  const [orcamentoReferencia, setOrcamentoReferencia] = useState("5000");

  // New Contract Form State
  const [selectedFornecedorId, setSelectedFornecedorId] = useState("");
  const [servicoNome, setServicoNome] = useState("");
  const [custoMensal, setCustoMensal] = useState("");
  const [custoAnual, setCustoAnual] = useState("");
  const [renovacaoAuto, setRenovacaoAuto] = useState(true);
  const [dataFim, setDataFim] = useState("2027-01-01");
  const [slaResposta, setSlaResposta] = useState("4 horas para avarias");
  const [penalizacaoAtraso, setPenalizacaoAtraso] = useState("5% desconto em mora");
  const [indexacaoPreco, setIndexacaoPreco] = useState("IPC Inflação INE");
  const [documentoNome, setDocumentoNome] = useState("");
  const [documentoBase64, setDocumentoBase64] = useState("");

  const renovarContratoAutomatico = (idContrato: string) => {
    setContratos(prev => prev.map(c => {
      if (c.id_contrato === idContrato) {
        const parts = c.data_fim.split("-");
        const nextYear = (parseInt(parts[0]) || 2026) + 1;
        const newDateFim = `${nextYear}-${parts[1] || "12"}-${parts[2] || "31"}`;
        const logMsg = `Renovado automaticamente pela IA em ${new Date().toLocaleDateString("pt-PT")} para ${newDateFim}`;
        return {
          ...c,
          data_fim: newDateFim,
          historico_renovacoes: [logMsg, ...(c.historico_renovacoes || [])]
        };
      }
      return c;
    }));
    alert("✨ Contrato renovado automaticamente por +1 ano com registo auditado e alerta atualizado!");
  };

  const exportarRelatorioContratosXLS = () => {
    const headers = ["Serviço", "Fornecedor", "Custo Mensal (€)", "Custo Anual (€)", "Renovação Auto", "Data Fim", "SLA Resposta", "Penalização Atraso", "Indexação Preço"];
    const rows = predioContratos.map(c => {
      const partner = fornecedores.find(f => f.id_fornecedor === c.id_fornecedor);
      return [
        c.servico,
        partner?.nome || "N/A",
        c.custo_mensal.toFixed(2),
        c.custo_anual.toFixed(2),
        c.renovacao_automatica ? "Sim" : "Não",
        c.data_fim,
        c.sla_resposta || "Padrão",
        c.penalizacao_atraso || "N/A",
        c.indexacao_preco || "N/A"
      ];
    });
    exportToXLS(`Relatorio_Executivo_Contratos_${predio.nome || "Predio"}`, headers, rows);
  };

  const predioForn = fornecedoresList.filter(f => f.id_predio === predio.id_predio);
  const predioContratos = contratos.filter(c => c.id_predio === predio.id_predio);

  // Auto calculate cost relations
  const handleCustoMensalChange = (val: string) => {
    setCustoMensal(val);
    if (val) {
      setCustoAnual((Number(val) * 12).toFixed(2));
    } else {
      setCustoAnual("");
    }
  };

  const handleCustoAnualChange = (val: string) => {
    setCustoAnual(val);
    if (val) {
      setCustoMensal((Number(val) / 12).toFixed(2));
    } else {
      setCustoMensal("");
    }
  };

  const handleContractFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocumentoNome(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setDocumentoBase64(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const submeterFornecedor = (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedUser.role !== 'ADMIN' && loggedUser.role !== 'EMPRESA_GESTORA') {
      return alert("Apenas administradores podem cadastrar fornecedores!");
    }
    if (!nome || !nif || !categoria) return alert("Preencha todos os campos obrigatórios (Nome, NIF, Categoria)!");

    const novoId = "forn-" + (fornecedores.length + 1);
    const passProvisoria = "PwaForn2026!";
    const novo: Fornecedor = {
      id_fornecedor: novoId,
      id_predio: predio.id_predio,
      nome,
      nif,
      iban: iban || undefined,
      categoria,
      morada,
      contacto,
      pessoa_contacto: pessoaContacto,
      telemovel_direto: telemovelDireto,
      email_contacto: emailContacto || undefined,
      data_nascimento: dataNascimento || undefined,
      perfis_pwa: perfisPwa.length > 0 ? perfisPwa : undefined,
      pwa_acesso_enviado: perfisPwa.length > 0,
      pwa_password_provisoria: passProvisoria
    };
    onAddFornecedor(novo);
    
    // Automatically select this new supplier in contract form if they want to build one next
    setSelectedFornecedorId(novoId);

    // If PWA profile checklist had selected items, trigger automated welcome email & PDF manual
    if (perfisPwa.length > 0) {
      setWelcomeModalFornecedor(novo);
    }

    setNome(""); setNif(""); setIban(""); setCategoria(""); setMorada(""); setContacto(""); setPessoaContacto(""); setTelemovelDireto(""); setEmailContacto(""); setDataNascimento(""); setPerfisPwa([]);
    alert("Fornecedor registado com sucesso!");
  };

  const submeterContrato = (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedUser.role !== 'ADMIN' && loggedUser.role !== 'EMPRESA_GESTORA') {
      return alert("Apenas administradores podem cadastrar contratos!");
    }
    if (!selectedFornecedorId || !servicoNome || !custoAnual) {
      return alert("Preencha todos os campos obrigatórios (Fornecedor, Serviço, Custo)!");
    }

    const cMensal = Number(custoMensal) || 0;
    const cAnual = Number(custoAnual) || 0;

    const novoContrato: Contrato = {
      id_contrato: "contr-" + (contratos.length + 1),
      id_predio: predio.id_predio,
      id_fornecedor: selectedFornecedorId,
      servico: servicoNome,
      custo_mensal: cMensal,
      custo_anual: cAnual,
      renovacao_automatica: renovacaoAuto,
      data_fim: dataFim,
      alerta_renovacao: true,
      sla_resposta: slaResposta || "24h padrão",
      penalizacao_atraso: penalizacaoAtraso || "Sem penalização",
      indexacao_preco: indexacaoPreco || "IPC Taxa Inflação",
      historico_renovacoes: [`Criado e registado em ${new Date().toLocaleDateString("pt-PT")}`],
      documento_nome: documentoNome || undefined,
      documento_base64: documentoBase64 || undefined
    };

    setContratos([novoContrato, ...contratos]);
    setServicoNome("");
    setCustoMensal("");
    setCustoAnual("");
    setDocumentoNome("");
    setDocumentoBase64("");
    alert("Serviço Contratado registado e arquivado no sistema!");
  };

  const excluirContrato = (id: string) => {
    if (!window.confirm("Deseja realmente arquivar/remover este contrato?")) return;
    setContratos(contratos.filter(c => c.id_contrato !== id));
  };

  const exportarFornecedoresXLS = () => {
    const headers = ["Nome", "NIF", "IBAN", "Categoria", "Contacto Geral", "Pessoa de Contacto", "E-mail de Contacto", "Telemóvel Direto", "Morada"];
    const rows = predioForn.map(f => [
      f.nome,
      f.nif,
      f.iban || "N/A",
      f.categoria,
      f.contacto || "",
      f.pessoa_contacto || "",
      f.email_contacto || "",
      f.telemovel_direto || "",
      f.morada || ""
    ]);
    exportToXLS("Lista_Fornecedores_Condominio", headers, rows);
  };

  // Helper to check expiration within 30 days (based on local date 2026-07-16)
  const isExpiringSoon = (dateStr: string) => {
    const baseDate = new Date("2026-07-16");
    const expDate = new Date(dateStr);
    const diffTime = expDate.getTime() - baseDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  };

  // Sum active contracted services costs
  const totalMensalContratos = predioContratos.reduce((acc, curr) => acc + curr.custo_mensal, 0);
  const totalAnualContratos = predioContratos.reduce((acc, curr) => acc + curr.custo_anual, 0);
  const orcReferenciaNum = Number(orcamentoReferencia) || 5000;
  const impactoOrcamentoContratos = (totalAnualContratos / orcReferenciaNum) * 100;

  return (
    <div className="space-y-6">
      {activeTab === "fornecedores" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex justify-between items-center no-print">
            <h4 className="text-xs font-bold uppercase text-slate-400">Exportações de Relatórios</h4>
            <button onClick={exportarFornecedoresXLS} className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold px-3 py-1.5 rounded-lg text-xs hover:bg-emerald-100 transition-all cursor-pointer flex items-center gap-1.5">
              <img src="/modulos/66-exportacao-financeira.png" alt="Excel" className="w-4 h-4 object-contain shrink-0" /> Exportar Fornecedores XLS / CSV
            </button>
          </div>

          {(loggedUser.role === 'ADMIN' || loggedUser.role === 'EMPRESA_GESTORA') && (
            <form onSubmit={submeterFornecedor} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 no-print">
              <h3 className="text-sm font-bold text-slate-800">Cadastrar Novo Fornecedor do Condomínio</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col col-span-2">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Nome do Parceiro / Empresa *</label>
                  <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: OTIS Elevadores" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">NIF Contribuinte *</label>
                  <input type="text" value={nif} onChange={e => setNif(e.target.value)} placeholder="Ex: 500112233" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono" />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Categoria de Despesa *</label>
                  <input type="text" value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ex: Manutenção Elevadores" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="flex flex-col col-span-2">
                  <label className="text-xs font-semibold text-slate-500 mb-1">IBAN de Pagamento</label>
                  <input type="text" value={iban} onChange={e => setIban(e.target.value)} placeholder="PT50..." className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono" />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Contacto Geral</label>
                  <input type="text" value={contacto} onChange={e => setContacto(e.target.value)} placeholder="Ex: 214156000" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono" />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Pessoa de Contacto</label>
                  <input type="text" value={pessoaContacto} onChange={e => setPessoaContacto(e.target.value)} placeholder="Ex: Eng. João Costa" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">E-mail de Contacto</label>
                  <input type="email" value={emailContacto} onChange={e => setEmailContacto(e.target.value)} placeholder="Ex: joao.costa@empresa.com" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono" />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Data de Nascimento (Facultativa)</label>
                  <input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Telemóvel Direto</label>
                  <input type="text" value={telemovelDireto} onChange={e => setTelemovelDireto(e.target.value)} placeholder="Ex: 912345678" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono" />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Morada de Operações / Sede</label>
                  <input type="text" value={morada} onChange={e => setMorada(e.target.value)} placeholder="Morada física do fornecedor" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
                </div>
              </div>

              {/* Checklist de Atribuição de Perfis PWA */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-2">
                    <i className="fa-solid fa-[#000] fa-mobile-screen-button text-emerald-600"></i>
                    Checklist de Atribuição de Perfis PWA
                  </label>
                  <span className="text-[10px] text-slate-400">Ao selecionar um perfil, é enviado um e-mail com acessos e instruções PDF</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  {[
                    { id: "LIMPEZAS", label: "Limpezas", icon: "🧹", color: "border-emerald-300 bg-emerald-50/50 text-emerald-900" },
                    { id: "TECNICO", label: "Técnico", icon: "🔍", color: "border-blue-300 bg-blue-50/50 text-blue-900" },
                    { id: "JURIDICO", label: "Jurídico", icon: "⚖️", color: "border-purple-300 bg-purple-50/50 text-purple-900" },
                    { id: "AUDITOR", label: "Auditor", icon: "🕵️", color: "border-amber-300 bg-amber-50/50 text-amber-900" },
                    { id: "CONTABILISTA", label: "Contabilista", icon: "📈", color: "border-teal-300 bg-teal-50/50 text-teal-900" }
                  ].map(p => {
                    const active = perfisPwa.includes(p.id as any);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => togglePerfilPwa(p.id as any)}
                        className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${
                          active 
                            ? `${p.color} ring-2 ring-emerald-500 shadow-xs` 
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span>{p.icon}</span>
                          <span>{p.label}</span>
                        </span>
                        <i className={`fa-solid ${active ? "fa-circle-check text-emerald-600" : "fa-circle text-slate-300"} text-xs`}></i>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors cursor-pointer">
                <i className="fa-solid fa-plus mr-1.5"></i> Registar Fornecedor
              </button>
            </form>
          )}

          {/* Lista de Fornecedores */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <th className="p-3">Nome / Empresa</th>
                  <th className="p-3">NIF</th>
                  <th className="p-3">IBAN de Cobrança</th>
                  <th className="p-3">Contactos & Morada</th>
                  <th className="p-3">Categoria & Aniversário</th>
                  <th className="p-3">Perfis PWA</th>
                  <th className="p-3 text-right">Ações Automáticas</th>
                </tr>
              </thead>
              <tbody>
                {predioForn.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-slate-400 italic">Nenhum fornecedor cadastrado.</td>
                  </tr>
                ) : (
                  predioForn.map(f => (
                    <tr key={f.id_fornecedor} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="p-3 font-bold text-slate-800">
                        {f.nome}
                        {f.data_nascimento && (
                          <span className="block text-[10px] font-normal text-slate-400 font-mono">
                            🎂 Nasc: {f.data_nascimento}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono">{f.nif}</td>
                      <td className="p-3 font-mono text-slate-600">{f.iban || <span className="text-slate-400 italic">Não Fornecido</span>}</td>
                      <td className="p-3 text-slate-600 space-y-1">
                        {f.contacto && <p className="font-mono"><i className="fa-solid fa-phone mr-1.5 text-slate-400"></i><span className="font-semibold text-slate-500">Geral:</span> {f.contacto}</p>}
                        {f.pessoa_contacto && <p><i className="fa-solid fa-user-tie mr-1.5 text-slate-400"></i><span className="font-semibold text-slate-500">Pessoa:</span> {f.pessoa_contacto}</p>}
                        {f.email_contacto && <p className="font-mono"><i className="fa-solid fa-envelope mr-1.5 text-slate-400"></i><span className="font-semibold text-slate-500">E-mail:</span> {f.email_contacto}</p>}
                        {f.telemovel_direto && <p className="font-mono"><i className="fa-solid fa-mobile-screen-button mr-1.5 text-slate-400"></i><span className="font-semibold text-slate-500">Telemóvel Direto:</span> {f.telemovel_direto}</p>}
                        {f.morada && <p><i className="fa-solid fa-location-dot mr-1.5 text-slate-400"></i>{f.morada}</p>}
                      </td>
                      <td className="p-3 text-slate-500 font-semibold">{f.categoria}</td>
                      <td className="p-3">
                        {f.perfis_pwa && f.perfis_pwa.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {f.perfis_pwa.map(p => (
                              <span key={p} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                {p === "LIMPEZAS" && "🧹 Limpezas"}
                                {p === "TECNICO" && "🔍 Técnico"}
                                {p === "JURIDICO" && "⚖️ Jurídico"}
                                {p === "AUDITOR" && "🕵️ Auditor"}
                                {p === "CONTABILISTA" && "📈 Contabilista"}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">Sem perfil PWA</span>
                        )}
                      </td>
                      <td className="p-3 text-right space-y-1">
                        <button
                          onClick={() => setWelcomeModalFornecedor(f)}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer block w-full text-center"
                        >
                          <i className="fa-solid fa-paper-plane mr-1"></i> Acessos PWA & Manual
                        </button>
                        <button
                          onClick={() => setBirthdayModalFornecedor(f)}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer block w-full text-center"
                        >
                          <i className="fa-solid fa-cake-candles mr-1"></i> E-mail Aniversário
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Tem a certeza de que deseja eliminar o fornecedor "${f.nome}"?`)) {
                              setFornecedoresList(prev => prev.filter(x => x.id_fornecedor !== f.id_fornecedor));
                            }
                          }}
                          className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 w-full text-center"
                          title="Eliminar Fornecedor"
                        >
                          <img src="/estados-acoes/14-eliminar.png" alt="Eliminar" className="h-3.5 w-3.5 object-contain" />
                          <span>Eliminar</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* --- SUPPLIER WELCOME EMAIL & PWA MANUAL MODAL --- */}
          {welcomeModalFornecedor && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-zoom-in border border-emerald-200">
                <div className="bg-emerald-700 px-6 py-4 text-white flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <i className="fa-solid fa-paper-plane text-emerald-400 text-lg"></i>
                    <div>
                      <h3 className="font-bold text-sm uppercase">Registo de Fornecedor Homologado</h3>
                      <p className="text-[10px] text-slate-300">Comunicação oficial e credencial de acesso em PDF</p>
                    </div>
                  </div>
                  <button onClick={() => setWelcomeModalFornecedor(null)} className="text-slate-400 hover:text-white cursor-pointer">
                    <i className="fa-solid fa-xmark text-lg"></i>
                  </button>
                </div>
                <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto relative">
                  <div className="border border-emerald-100 bg-emerald-50/30 rounded-xl p-5 text-xs text-slate-800 space-y-4 relative overflow-hidden">
                    {/* Background Watermark */}
                    <img 
                      src="/marca/19-marca-dagua-logo-cinza-claro.png" 
                      alt="Watermark" 
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 object-contain opacity-10 pointer-events-none" 
                    />

                    {/* Central Top Logo Header */}
                    <div className="text-center pb-2 border-b border-emerald-200/80">
                      <img 
                        src="/marca/20-Logotipo Horizontal com fundo.png" 
                        alt="CondoManager AI" 
                        className="h-10 mx-auto object-contain drop-shadow-xs" 
                      />
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Comunicação Oficial a Fornecedores</p>
                    </div>

                    <div className="space-y-1 text-slate-700 font-sans">
                      <p><strong>De:</strong> {(predio as any).email_administracao || (predio as any).email || "administracao@condomanagerai.com"}</p>
                      <p><strong>Para:</strong> {welcomeModalFornecedor.email_contacto || welcomeModalFornecedor.contacto || "fornecedor@empresa.pt"}</p>
                      <p><strong>Assunto:</strong> Registo de Fornecedor Homologado - Condomínio Edifício Estrela da Barra</p>
                    </div>
                    <hr className="border-emerald-100" />
                    <div className="space-y-3 text-slate-700 font-sans leading-relaxed relative z-10">
                      <p>Exmos. Senhores <strong>{welcomeModalFornecedor.nome}</strong>,</p>
                      <p>Confirmamos a conclusão do registo da vossa empresa no catálogo de fornecedores e prestadores homologados do <strong>Condomínio Edifício Estrela da Barra</strong>.</p>
                      
                      <div className="bg-white/90 border border-slate-200 p-3 rounded-lg text-[11px] text-slate-800 space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Dados Fiscais para Faturação :</p>
                        <p>• <strong>Designação:</strong> Condomínio Edifício Estrela da Barra</p>
                        <p>• <strong>NIF:</strong> 900123456</p>
                        <p>• <strong>Morada de Faturação:</strong> Rua Bento Rodrigues</p>
                        <p>• <strong>E-mail para Envio de Faturas/Recibos:</strong> {(predio as any).email_administracao || (predio as any).email || "administracao@condomanagerai.com"}</p>
                      </div>

                      <div className="bg-amber-50/90 border border-amber-200 p-3 rounded-lg text-[11px] text-slate-800 space-y-1">
                        <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Dados de Acesso:</p>
                        <p>• <strong>Link:</strong> <span className="font-mono text-indigo-600">https://bentorodrigues2.condomanagerai.com</span></p>
                        <p>• <strong>Utilizador:</strong> <span className="font-mono">{welcomeModalFornecedor.email_contacto || welcomeModalFornecedor.contacto || "fornecedor@empresa.pt"}</span></p>
                        <p>• <strong>Password Provisória:</strong> <span className="font-mono font-bold text-amber-900">{welcomeModalFornecedor.pwa_password_provisoria || "Forn-82M4P9"}</span></p>
                        <p className="text-[10px] text-amber-700 italic mt-1">(Por razões de segurança, ser-lhe-á solicitado que altere esta palavra-passe no seu primeiro acesso.)</p>
                      </div>

                      <div className="bg-emerald-100/80 border border-emerald-200 p-2.5 rounded-lg flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-[11px] text-emerald-900">
                          <i className="fa-solid fa-file-pdf text-red-500 text-lg"></i>
                          <span>Anexo: <strong>Instrucoes_Acesso_Perfil_Fornecedor.pdf</strong></span>
                        </div>
                        <button
                          onClick={() => gerarPdfRegistoFornecedorHomologado(welcomeModalFornecedor, predio)}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <i className="fa-solid fa-download"></i> Baixar PDF
                        </button>
                      </div>

                      <div className="pt-3 border-t border-slate-200 space-y-1">
                        <p className="text-slate-700 text-xs">Atentamente,</p>
                        <p className="text-slate-900 text-xs font-bold mt-1">José Carlos Guerra</p>
                        <p className="text-slate-600 text-[11px]">+351 919 943 465</p>
                        <p className="text-emerald-700 text-[11px] font-bold">O Administrador do Condominio</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setWelcomeModalFornecedor(null);
                      alert("E-mail de boas-vindas e credenciais PWA enviados com sucesso!");
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer shadow-md text-center"
                  >
                    Confirmar Envio Automático de Boas-Vindas
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --- SUPPLIER BIRTHDAY EMAIL SIMULATION DIALOG --- */}
          {birthdayModalFornecedor && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-zoom-in border border-purple-200">
                <div className="bg-purple-950 px-6 py-4 text-white flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <i className="fa-solid fa-cake-candles text-purple-400 text-lg"></i>
                    <div>
                      <h3 className="font-bold text-sm uppercase">Simulador de E-mail de Aniversário Fornecedor</h3>
                      <p className="text-[10px] text-purple-200">Envio automatizado com base na data de nascimento</p>
                    </div>
                  </div>
                  <button onClick={() => setBirthdayModalFornecedor(null)} className="text-purple-300 hover:text-white cursor-pointer">
                    <i className="fa-solid fa-xmark text-lg"></i>
                  </button>
                </div>
                <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto relative">
                  {/* Header do E-mail */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1 font-mono text-slate-700">
                    <p><strong>De:</strong> {(predio as any).email_administracao || (predio as any).email || "administracao@estreladabarra.pt"}</p>
                    <p><strong>Para:</strong> {birthdayModalFornecedor.email_contacto || birthdayModalFornecedor.contacto || "fornecedor@empresa.pt"}</p>
                    <p><strong>Assunto:</strong> 🎉 Parabéns pelo seu Aniversário, {birthdayModalFornecedor.nome}! - Os votos do seu Condomínio</p>
                    <p className="text-[10px] text-slate-500 font-sans mt-1">
                      <strong>Anexo:</strong> Cartao_Aniversario_Parceiro.pdf (Postal Oficial A5)
                    </p>
                  </div>

                  {/* POSTAL OFICIAL DE ANIVERSÁRIO */}
                  <div className="w-full bg-white border-2 border-slate-800 shadow-lg p-2.5 relative">
                    <div className="border border-sky-600 p-6 relative text-center space-y-4 bg-white">
                      {/* 4 Pontos de Canto Decorativos */}
                      <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-sky-600 rounded-full"></div>
                      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-sky-600 rounded-full"></div>
                      <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-sky-600 rounded-full"></div>
                      <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-sky-600 rounded-full"></div>

                      {/* Topo: Nome do Edifício */}
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        {predio.nome ? predio.nome.toUpperCase() : "EDIFÍCIO ESTRELA DA BARRA"}
                      </h4>

                      {/* Divisória com Ponto Central */}
                      <div className="relative flex items-center justify-center max-w-xs mx-auto">
                        <div className="w-full border-t border-sky-600"></div>
                        <div className="w-2 h-2 bg-sky-600 rounded-full mx-2 shrink-0"></div>
                        <div className="w-full border-t border-sky-600"></div>
                      </div>

                      {/* Título Principal */}
                      <div className="space-y-1">
                        <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                          FELIZ ANIVERSÁRIO!
                        </h3>
                        <p className="text-[11px] text-slate-600">
                          Votos sinceros de sucesso, saúde e prosperidade
                        </p>
                      </div>

                      {/* Caixa de Destinatário */}
                      <div className="inline-block px-6 py-2 bg-sky-50 border border-sky-600 rounded-lg text-sm font-bold text-slate-900 shadow-xs">
                        Exmo.(a) Sr.(a) / Parceiro(a) {birthdayModalFornecedor.nome},
                      </div>

                      {/* Mensagem de Votos e Cordialidade */}
                      <div className="text-xs text-slate-800 space-y-2 max-w-md mx-auto leading-relaxed">
                        <p>
                          A Administração e a equipa do <strong>{predio.nome || "Condomínio Edifício Estrela da Barra"}</strong> têm o enorme gosto de lhe desejar um Feliz Aniversário, com muita saúde, alegria e realizações pessoais e profissionais.
                        </p>
                        <p>
                          Agradecemos a dedicação e a excelente parceria no cuidado e valorização do nosso condomínio.
                        </p>
                      </div>

                      {/* Destaque Parabéns */}
                      <div className="text-sm font-bold text-sky-600 pt-1">
                        Parabéns pelo seu dia! 🎂🥂
                      </div>

                      {/* Badge Selo Decorativo */}
                      <div className="inline-block px-3 py-1 bg-slate-100 border border-sky-200 rounded text-[9px] font-bold text-sky-600 uppercase tracking-widest">
                        PARCERIA DE CONFIANÇA & EXCELÊNCIA
                      </div>

                      {/* Despedida e Assinatura */}
                      <div className="pt-2 space-y-0.5 text-center">
                        <p className="text-[11px] text-slate-500">Com as mais calorosas saudações,</p>
                        <p className="text-xs font-bold text-slate-900">José Carlos Guerra</p>
                        <p className="text-[11px] text-slate-600">A Administração do {predio.nome || "Edifício Estrela da Barra"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        gerarCartaoAniversarioCondominoPDF(birthdayModalFornecedor.nome, predio.nome, "José Carlos Guerra");
                      }}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
                    >
                      <Download className="h-4 w-4 text-sky-400" />
                      <span>Descarregar Postal PDF (A5)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBirthdayModalFornecedor(null);
                        alert("E-mail de aniversário com postal anexado simulado com sucesso!");
                      }}
                      className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-paper-plane"></i>
                      <span>Confirmar Envio Simulador</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "contratos" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Contracts General Overview Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wide block">Despesa Mensal de Contratos</span>
                <h3 className="text-xl font-black text-slate-800 font-mono">{totalMensalContratos.toFixed(2)}€</h3>
                <p className="text-[10px] text-slate-400 mt-1">Serviços ativos recorrentes</p>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><i className="fa-solid fa-calendar-day"></i></div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wide block">Encargo Anual Total</span>
                <h3 className="text-xl font-black text-slate-800 font-mono">{totalAnualContratos.toFixed(2)}€</h3>
                <p className="text-[10px] text-slate-400 mt-1">Soma de contratos do prédio</p>
              </div>
              <div className="p-3 bg-teal-50 text-teal-600 rounded-lg"><i className="fa-solid fa-calculator"></i></div>
            </div>

            {/* Live budget impact evaluation */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center w-full">
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wide block">Impacto no Orçamento Geral</span>
                  <h3 className="text-base font-extrabold text-slate-800 mt-0.5">{impactoOrcamentoContratos.toFixed(1)}%</h3>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">Ref. Orçamento Anual</span>
                  <div className="flex items-center justify-end space-x-1 mt-0.5 font-mono">
                    <input 
                      type="number"
                      value={orcamentoReferencia}
                      onChange={e => setOrcamentoReferencia(e.target.value)}
                      className="w-16 border border-slate-200 text-center font-bold rounded py-0.5 text-[10px] bg-slate-50 focus:outline-indigo-500"
                    />
                    <span className="text-[10px] text-slate-500">€</span>
                  </div>
                </div>
              </div>

              {/* Progress bar representing consumption */}
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 relative overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    impactoOrcamentoContratos > 50 
                      ? "bg-red-500" 
                      : impactoOrcamentoContratos > 25 
                      ? "bg-amber-500" 
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, impactoOrcamentoContratos)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Form to archive new Contracted Service */}
          {(loggedUser.role === 'ADMIN' || loggedUser.role === 'EMPRESA_GESTORA') && (
            <form onSubmit={submeterContrato} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 no-print">
              <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded">
                  <i className="fa-solid fa-file-signature text-xs"></i>
                </span>
                <span>Arquivar Novo Contrato de Prestação de Serviços</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Fornecedor Associado *</label>
                  <select
                    required
                    value={selectedFornecedorId}
                    onChange={e => setSelectedFornecedorId(e.target.value)}
                    className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-indigo-500 bg-white"
                  >
                    <option value="">-- Selecione o Parceiro --</option>
                    {predioForn.map(f => (
                      <option key={f.id_fornecedor} value={f.id_fornecedor}>{f.nome} ({f.categoria})</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col col-span-1 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Descrição do Serviço Contratado *</label>
                  <input
                    type="text"
                    required
                    value={servicoNome}
                    onChange={e => setServicoNome(e.target.value)}
                    placeholder="Ex: Contrato de Manutenção Preventiva de Elevador Principal"
                    className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Custo Mensal (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={custoMensal}
                    onChange={e => handleCustoMensalChange(e.target.value)}
                    placeholder="Ex: 85.00"
                    className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-indigo-500 font-mono"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Custo Anual (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={custoAnual}
                    onChange={e => handleCustoAnualChange(e.target.value)}
                    placeholder="Ex: 1020.00"
                    className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-indigo-500 font-mono"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Fim de Vigência / Renovação</label>
                  <input
                    type="date"
                    required
                    value={dataFim}
                    onChange={e => setDataFim(e.target.value)}
                    className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-indigo-500"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center space-x-2 text-xs font-semibold text-slate-600 select-none pb-2.5">
                    <input
                      type="checkbox"
                      checked={renovacaoAuto}
                      onChange={e => setRenovacaoAuto(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span>Renovação Automática?</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">SLA de Resposta (Horas/Dias)</label>
                  <input
                    type="text"
                    value={slaResposta}
                    onChange={e => setSlaResposta(e.target.value)}
                    placeholder="Ex: 2 horas (Urgência) / 24 horas"
                    className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-indigo-500"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Cláusula de Penalização por Incumprimento</label>
                  <input
                    type="text"
                    value={penalizacaoAtraso}
                    onChange={e => setPenalizacaoAtraso(e.target.value)}
                    placeholder="Ex: 5% desconto por cada dia de paragem"
                    className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-indigo-500"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Regra de Indexação / Atualização de Preço</label>
                  <input
                    type="text"
                    value={indexacaoPreco}
                    onChange={e => setIndexacaoPreco(e.target.value)}
                    placeholder="Ex: Inflação INE IPC + 2%"
                    className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-indigo-500"
                  />
                </div>
              </div>

              {/* PDF Contract Uploader */}
              <div className="flex flex-col pt-1">
                <label className="text-xs font-semibold text-slate-500 mb-1">Anexo / Arquivo Digital do Contrato (Opcional)</label>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => document.getElementById("contract-file-selector")?.click()}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold border border-slate-250 cursor-pointer flex items-center space-x-1.5"
                  >
                    <img src="/marca/18-pdf.png" alt="PDF" className="w-4 h-4 object-contain shrink-0" />
                    <span>Selecionar Documento Contratual</span>
                  </button>
                  <input
                    id="contract-file-selector"
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleContractFile}
                    className="hidden"
                  />
                  {documentoNome && (
                    <span className="text-xs text-slate-600 font-bold font-mono bg-slate-50 px-2 py-1 rounded border border-slate-200">
                      ✓ {documentoNome}
                    </span>
                  )}
                </div>
              </div>

              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer flex items-center space-x-2">
                <i className="fa-solid fa-check"></i>
                <span>Arquivar e Vincular Contrato</span>
              </button>
            </form>
          )}

          {/* List of active Contracted Services with warning indicators */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Pasta Digital de Contratos de Serviços ({predioContratos.length})</h4>
              <button
                type="button"
                onClick={exportarRelatorioContratosXLS}
                className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold px-3 py-1.5 rounded-lg text-xs hover:bg-indigo-100 transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <img src="/modulos/66-exportacao-financeira.png" alt="Excel" className="w-4 h-4 object-contain shrink-0" />
                <span>Relatório Executivo de Contratos (XLS)</span>
              </button>
            </div>
            
            {predioContratos.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 italic text-xs">
                Nenhum contrato arquivado para este condomínio.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {predioContratos.map(c => {
                  const partner = fornecedores.find(f => f.id_fornecedor === c.id_fornecedor);
                  const isExpiring = isExpiringSoon(c.data_fim);
                  
                  return (
                    <div 
                      key={c.id_contrato} 
                      className={`bg-white p-5 rounded-xl border shadow-sm transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                        isExpiring 
                          ? "border-amber-400 bg-amber-50/20" 
                          : "border-slate-200"
                      }`}
                    >
                      <div className="space-y-2 flex-grow">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className="text-xs font-black text-slate-800">{partner?.nome || "Parceiro do Prédio"}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded">
                            {partner?.categoria || "Serviço Geral"}
                          </span>
                          {c.renovacao_automatica && (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-extrabold px-1.5 py-0.5 rounded">
                              Renovação Auto Ativa
                            </span>
                          )}
                          {isExpiring && (
                            <span className="text-[9px] bg-amber-500 text-white font-extrabold px-2 py-0.5 rounded-full animate-bounce flex items-center space-x-1">
                              <i className="fa-solid fa-bell"></i>
                              <span>ALERTA DE RENOVAÇÃO EM CURSO (&lt;30 dias)</span>
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-700">{c.servico}</h4>
                        
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 font-mono">
                          <span>Data Fim: <strong className={isExpiring ? "text-amber-700 font-extrabold" : ""}>{c.data_fim}</strong></span>
                          <span>IBAN: <strong>{partner?.iban || "N/A"}</strong></span>
                          {c.sla_resposta && <span>SLA: <strong className="text-indigo-600">{c.sla_resposta}</strong></span>}
                          {c.indexacao_preco && <span>Indexação: <strong className="text-slate-700">{c.indexacao_preco}</strong></span>}
                        </div>

                        {c.penalizacao_atraso && (
                          <div className="text-[10px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200/60 inline-block font-sans">
                            <i className="fa-solid fa-gavel mr-1 text-amber-600"></i>
                            <span className="font-semibold">Penalização:</span> {c.penalizacao_atraso}
                          </div>
                        )}

                        {c.historico_renovacoes && c.historico_renovacoes.length > 0 && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            <i className="fa-solid fa-history mr-1 text-slate-400"></i>
                            <span>Último Registo: {c.historico_renovacoes[0]}</span>
                          </div>
                        )}
                      </div>

                      {/* Right financials & Contract archive buttons */}
                      <div className="flex items-center space-x-4 shrink-0 self-end md:self-auto">
                        <div className="text-right">
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">Encargo de Contrato</span>
                          <span className="text-sm font-black text-slate-800 font-mono block">{c.custo_mensal.toFixed(2)}€ <span className="text-[10px] text-slate-400 font-medium">/mês</span></span>
                          <span className="text-[10px] text-slate-500 font-mono block">({c.custo_anual.toFixed(2)}€ /ano)</span>
                        </div>

                        <div className="flex space-x-1.5">
                          {c.renovacao_automatica && (
                            <button
                              type="button"
                              onClick={() => renovarContratoAutomatico(c.id_contrato)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-xs"
                              title="Executar Renovação Automática (+1 ano)"
                            >
                              <i className="fa-solid fa-rotate"></i>
                              <span>Renovar Auto</span>
                            </button>
                          )}

                          {c.documento_nome && (
                            <a 
                              href={c.documento_base64 || "#"} 
                              download={c.documento_nome}
                              className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
                              title={`Download ${c.documento_nome}`}
                            >
                              <i className="fa-solid fa-download"></i>
                            </a>
                          )}
                          {loggedUser.role === 'ADMIN' && (
                            <button
                              onClick={() => excluirContrato(c.id_contrato)}
                              className="p-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                              title="Arquivar Contrato"
                            >
                              <i className="fa-solid fa-box-archive"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
