import React, { useState, useEffect } from "react";
import { Download, Save, FileText, Trash2, CheckCircle2, AlertTriangle, Pencil, X } from "lucide-react";
import { Predio, Fornecedor, DividaFornecedor, PagamentoDivida, LoggedUser, Conta, Movimento } from "../types";
import { exportToXLS, generateSupplierPwaManualPDF, gerarPdfRegistoFornecedorHomologado, gerarCartaoAniversarioCondominoPDF } from "../utils";
import {
  saveFornecedorToSupabase,
  deleteFornecedorFromSupabase,
  saveContratoToSupabase,
  fetchContratosFromSupabase,
  deleteContratoFromSupabase,
  fetchDividasFornecedoresFromSupabase,
  saveDividaFornecedorToSupabase,
  deleteDividaFornecedorFromSupabase,
  fetchPagamentosDividasFromSupabase,
  savePagamentoDividaToSupabase,
  saveContaToSupabase,
  saveMovimentoToSupabase,
  registarLogAuditoria
} from "../lib/supabaseService";

interface GestaoFornecedoresProps {
  predio: Predio;
  fornecedores: Fornecedor[];
  onAddFornecedor: (novoFornecedor: Fornecedor) => void;
  onRemoveFornecedor?: (idFornecedor: string) => void;
  loggedUser: LoggedUser;
  initialTab?: "fornecedores" | "contratos" | "dividas";
  contas: Conta[];
  setContas: React.Dispatch<React.SetStateAction<Conta[]>>;
  movements: Movimento[];
  setMovements: React.Dispatch<React.SetStateAction<Movimento[]>>;
}

export interface Contrato {
  id_contrato: string;
  id_predio: string;
  id_fornecedor: string;
  tipo_contrato: string;
  servico: string;
  data_inicio: string;
  custo_mensal: number;
  custo_anual: number;
  renovacao_automatica: boolean;
  data_fim: string;
  // "Ativo" | "Rescindido" | "Expirado" — os dois últimos são aplicados
  // automaticamente pela sincronização diária (ver cronService.js) quando
  // um contrato passa a data_fim sem ser renovado.
  estado: string;
  alerta_renovacao: boolean;
  // Prazo de antecedência (dias) para o alerta automático de fim de
  // contrato — 30/60/90/120. Substitui o antigo alerta_renovacao (boolean,
  // mantido só por compatibilidade) que não permitia escolher o prazo.
  alerta_dias_antecedencia?: number;
  // Última data em que o alerta de vencimento foi enviado — evita repetir o
  // email todos os dias depois de ultrapassado o limiar; reposto a vazio
  // sempre que o contrato é renovado, para o próximo ciclo poder alertar.
  alerta_enviado_em?: string;
  sla_resposta?: string;
  penalizacao_atraso?: string;
  indexacao_preco?: string;
  historico_renovacoes?: string[];
  documento_nome?: string;
  documento_base64?: string;
  // Registo da rescisão — só existe depois de emitida a carta de rescisão.
  // enviado_em/comprovativo confirmam que a carta foi mesmo enviada por
  // email (ou o motivo de não ter sido), em vez de um botão que só finge.
  rescisao?: {
    motivo: string;
    data_efeito: string;
    enviado_para: string;
    enviado_em?: string;
    comprovativo?: string;
  };
}

export function GestaoFornecedores({ predio, fornecedores, onAddFornecedor, onRemoveFornecedor, loggedUser, initialTab, contas, setContas, movements, setMovements }: GestaoFornecedoresProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"fornecedores" | "contratos" | "dividas">(initialTab || "fornecedores");
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
  const [editingFornecedorId, setEditingFornecedorId] = useState<string | null>(null);
  const [expandedFornecedorId, setExpandedFornecedorId] = useState<string | null>(null);

  // Referências de contrato/ADC (débito direto) — o dado que realmente
  // identifica ESTE contrato com o fornecedor, já que o IBAN do credor em
  // utilities (eletricidade, água, gás) é partilhado por todos os clientes.
  const [referenciasContrato, setReferenciasContrato] = useState<{ referencia: string; descricao?: string }[]>([]);
  const [novaReferenciaValor, setNovaReferenciaValor] = useState("");
  const [novaReferenciaDescricao, setNovaReferenciaDescricao] = useState("");

  const handleAdicionarReferenciaContrato = () => {
    if (!novaReferenciaValor.trim()) return;
    setReferenciasContrato(prev => [...prev, { referencia: novaReferenciaValor.trim(), descricao: novaReferenciaDescricao.trim() || undefined }]);
    setNovaReferenciaValor("");
    setNovaReferenciaDescricao("");
  };

  const handleEditarFornecedor = (f: Fornecedor) => {
    setEditingFornecedorId(f.id_fornecedor);
    setNome(f.nome);
    setNif(f.nif);
    setIban(f.iban || "");
    setCategoria(f.categoria);
    setMorada(f.morada || "");
    setContacto(f.contacto || "");
    setPessoaContacto(f.pessoa_contacto || "");
    setTelemovelDireto(f.telemovel_direto || "");
    setEmailContacto(f.email_contacto || "");
    setDataNascimento(f.data_nascimento || "");
    setPerfisPwa(f.perfis_pwa || []);
    setReferenciasContrato(f.referencias_contrato || []);
    document.getElementById("btn-guardar-fornecedor-supabase")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleCancelarEdicaoFornecedor = () => {
    setEditingFornecedorId(null);
    setNome(""); setNif(""); setIban(""); setCategoria(""); setMorada(""); setContacto(""); setPessoaContacto(""); setTelemovelDireto(""); setEmailContacto(""); setDataNascimento(""); setPerfisPwa([]);
    setReferenciasContrato([]); setNovaReferenciaValor(""); setNovaReferenciaDescricao("");
  };

  const handleEliminarFornecedor = async (f: Fornecedor) => {
    if (!window.confirm(`Tem a certeza de que deseja eliminar o fornecedor "${f.nome}"?`)) return;
    const ok = await deleteFornecedorFromSupabase(f.id_fornecedor);
    if (!ok) return alert("❌ Não foi possível eliminar o fornecedor no Supabase. Tente novamente.");
    setFornecedoresList(prev => prev.filter(x => x.id_fornecedor !== f.id_fornecedor));
    onRemoveFornecedor?.(f.id_fornecedor);
  };

  // Modals for supplier automated emails
  const [welcomeModalFornecedor, setWelcomeModalFornecedor] = useState<Fornecedor | null>(null);
  const [enviandoBoasVindasFornecedor, setEnviandoBoasVindasFornecedor] = useState<boolean>(false);
  const [birthdayModalFornecedor, setBirthdayModalFornecedor] = useState<Fornecedor | null>(null);

  const togglePerfilPwa = (perfil: "LIMPEZAS" | "TECNICO" | "JURIDICO" | "AUDITOR" | "CONTABILISTA") => {
    setPerfisPwa(prev => 
      prev.includes(perfil) ? prev.filter(p => p !== perfil) : [...prev, perfil]
    );
  };

  // Contratos — carregados do Supabase (tabela real, antes só existiam
  // como 2 exemplos fixos no código e o "guardar" nunca persistia de facto).
  const [contratos, setContratos] = useState<Contrato[]>([]);

  useEffect(() => {
    fetchContratosFromSupabase(predio.id_predio).then(setContratos);
  }, [predio.id_predio]);

  // Dívidas a fornecedores (faturas recebidas ainda não pagas)
  const [dividas, setDividas] = useState<DividaFornecedor[]>([]);

  useEffect(() => {
    fetchDividasFornecedoresFromSupabase(predio.id_predio).then(d => setDividas(d || []));
  }, [predio.id_predio]);

  // Livro de pagamentos por tranche — uma dívida pode ser paga aos poucos
  // (contratos de valor avultado costumam ser pagos em várias parcelas).
  const [pagamentos, setPagamentos] = useState<PagamentoDivida[]>([]);

  useEffect(() => {
    fetchPagamentosDividasFromSupabase(predio.id_predio).then(p => setPagamentos(p || []));
  }, [predio.id_predio]);

  const [historicoAbertoDividaId, setHistoricoAbertoDividaId] = useState<string | null>(null);

  // Novo lançamento de dívida (ou edição de uma já lançada)
  const [dividaFornecedorId, setDividaFornecedorId] = useState("");
  const [dividaFornecedorNome, setDividaFornecedorNome] = useState("");
  const [dividaDescricao, setDividaDescricao] = useState("");
  const [dividaCategoria, setDividaCategoria] = useState("");
  const [dividaValor, setDividaValor] = useState("");
  const [dividaDataEmissao, setDividaDataEmissao] = useState(() => new Date().toISOString().split("T")[0]);
  const [dividaDataVencimento, setDividaDataVencimento] = useState("");
  const [editingDividaId, setEditingDividaId] = useState<string | null>(null);

  const handleEditarDivida = (d: DividaFornecedor) => {
    setEditingDividaId(d.id_divida);
    setDividaFornecedorId(d.id_fornecedor || "");
    setDividaFornecedorNome(d.fornecedor_nome);
    setDividaDescricao(d.descricao);
    setDividaCategoria(d.categoria || "");
    setDividaValor(String(d.valor));
    setDividaDataEmissao(d.data_emissao || "");
    setDividaDataVencimento(d.data_vencimento || "");
    document.getElementById("form-lancar-divida")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleCancelarEdicaoDivida = () => {
    setEditingDividaId(null);
    setDividaFornecedorId(""); setDividaFornecedorNome(""); setDividaDescricao(""); setDividaCategoria(""); setDividaValor(""); setDividaDataVencimento(""); setDividaDataEmissao(new Date().toISOString().split("T")[0]);
  };

  // Pagamento de dívida (em tranches — ver handleRegistarPagamentoTranche)
  const [pagandoDividaId, setPagandoDividaId] = useState<string | null>(null);
  const [pagamentoContaId, setPagamentoContaId] = useState("");
  const [pagamentoData, setPagamentoData] = useState(() => new Date().toISOString().split("T")[0]);
  const [pagamentoValorTranche, setPagamentoValorTranche] = useState("");

  const predioContas = contas.filter(c => c.id_predio === predio.id_predio);
  const dividasPredio = dividas.filter(d => d.id_predio === predio.id_predio);
  const saldoDevedorDivida = (d: DividaFornecedor) => Math.max(0, d.valor - (d.valor_pago || 0));
  const pagamentosDaDivida = (idDivida: string) =>
    pagamentos.filter(p => p.id_divida === idDivida).sort((a, b) => (a.data < b.data ? 1 : -1));
  const dividasPendentes = dividasPredio.filter(d => d.estado === "Pendente" || d.estado === "Paga Parcialmente");
  const totalDividasPendentes = dividasPendentes.reduce((acc, d) => acc + saldoDevedorDivida(d), 0);

  const handleLancarDivida = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedUser.role !== "ADMIN" && loggedUser.role !== "EMPRESA_GESTORA") {
      return alert("Apenas administradores podem lançar dívidas a fornecedores!");
    }
    if (!dividaFornecedorNome.trim() || !dividaDescricao.trim() || !dividaValor) {
      return alert("Preencha o fornecedor, a descrição e o valor da dívida!");
    }

    const isEditing = editingDividaId !== null;
    const dividaOriginal = isEditing ? dividasPredio.find(d => d.id_divida === editingDividaId) : null;
    const novoValor = Number(dividaValor) || 0;
    if (dividaOriginal && novoValor < (dividaOriginal.valor_pago || 0)) {
      return alert(`Já foram pagos ${(dividaOriginal.valor_pago || 0).toFixed(2)} € desta dívida — o novo valor não pode ficar abaixo do que já foi pago.`);
    }
    const dividaAtualizada: DividaFornecedor = {
      id_divida: isEditing && dividaOriginal ? dividaOriginal.id_divida : "div-" + Date.now(),
      id_predio: predio.id_predio,
      id_fornecedor: dividaFornecedorId || undefined,
      fornecedor_nome: dividaFornecedorNome.trim(),
      descricao: dividaDescricao.trim(),
      categoria: dividaCategoria || undefined,
      valor: novoValor,
      data_emissao: dividaDataEmissao || undefined,
      data_vencimento: dividaDataVencimento || undefined,
      // Editar não mexe no estado nem no valor já pago — mantém o que já lá estava.
      estado: dividaOriginal?.estado || "Pendente",
      valor_pago: dividaOriginal?.valor_pago || 0,
      data_pagamento: dividaOriginal?.data_pagamento,
      id_conta_pagamento: dividaOriginal?.id_conta_pagamento,
      id_movimento_pagamento: dividaOriginal?.id_movimento_pagamento
    };
    const ok = await saveDividaFornecedorToSupabase(dividaAtualizada);
    if (!ok) return alert("❌ Não foi possível gravar a dívida no Supabase. Tente novamente.");

    if (isEditing) {
      setDividas(prev => prev.map(d => d.id_divida === dividaAtualizada.id_divida ? dividaAtualizada : d));
      registarLogAuditoria("Financeira", "Editou uma dívida a fornecedor", predio.id_predio, loggedUser, `${dividaAtualizada.fornecedor_nome} — ${dividaAtualizada.descricao} (${dividaAtualizada.valor.toFixed(2)} €)`);
      handleCancelarEdicaoDivida();
      alert("✅ Dívida atualizada com sucesso!");
      return;
    }

    setDividas(prev => [dividaAtualizada, ...prev]);
    registarLogAuditoria("Financeira", "Lançou uma dívida a fornecedor", predio.id_predio, loggedUser, `${dividaAtualizada.fornecedor_nome} — ${dividaAtualizada.descricao} (${dividaAtualizada.valor.toFixed(2)} €)`);
    setDividaFornecedorId(""); setDividaFornecedorNome(""); setDividaDescricao(""); setDividaCategoria(""); setDividaValor(""); setDividaDataVencimento("");
    alert("Dívida lançada com sucesso! Já entra no cálculo do saldo líquido do prédio.");
  };

  // Pagamento de uma dívida em tranches: contratos de valor avultado
  // costumam ser pagos aos poucos, e cada tranche pode sair de uma conta
  // bancária diferente (ex: uma parcela da conta principal, outra do fundo
  // de reserva). Cada tranche gera o seu próprio Movimento de despesa real
  // e um registo no livro de pagamentos da dívida.
  const handleRegistarPagamentoTranche = async (divida: DividaFornecedor) => {
    if (!pagamentoContaId) return alert("Selecione a conta bancária que vai pagar esta tranche.");
    const conta = predioContas.find(c => c.id_conta === pagamentoContaId);
    if (!conta) return alert("Conta bancária não encontrada.");

    const saldoDevedor = saldoDevedorDivida(divida);
    const valorTranche = Number(pagamentoValorTranche) || 0;
    if (valorTranche <= 0) return alert("Indique o valor a pagar nesta tranche.");
    if (valorTranche > saldoDevedor + 0.01) {
      return alert(`Esta tranche (${valorTranche.toFixed(2)} €) é maior do que o saldo em dívida (${saldoDevedor.toFixed(2)} €).`);
    }

    const novoMovimento: Movimento = {
      id_mov: "mov-" + Date.now(),
      id_predio: predio.id_predio,
      id_conta: conta.id_conta,
      data: pagamentoData,
      tipo: "Despesa",
      categoria: divida.categoria || "Fornecedores",
      descricao: `Pagamento a ${divida.fornecedor_nome} — ${divida.descricao}${saldoDevedor - valorTranche > 0.01 ? " (tranche)" : ""}`,
      valor: valorTranche,
      metodo_pagamento: "Transferência Bancária",
      estado: "Justificado"
    };
    const movOk = await saveMovimentoToSupabase(novoMovimento);
    if (!movOk) return alert("❌ Não foi possível registar o movimento de pagamento. Tente novamente.");

    const contaAtualizada: Conta = { ...conta, saldo: conta.saldo - valorTranche };
    await saveContaToSupabase(contaAtualizada);
    setContas(prev => prev.map(c => c.id_conta === conta.id_conta ? contaAtualizada : c));
    setMovements(prev => [novoMovimento, ...prev]);

    const novoPagamento: PagamentoDivida = {
      id_pagamento: "pagdiv-" + Date.now(),
      id_divida: divida.id_divida,
      id_predio: predio.id_predio,
      id_fornecedor: divida.id_fornecedor,
      valor: valorTranche,
      data: pagamentoData,
      id_conta: conta.id_conta,
      id_movimento: novoMovimento.id_mov
    };
    const pagOk = await savePagamentoDividaToSupabase(novoPagamento);
    if (!pagOk) return alert("❌ Não foi possível registar o pagamento no livro de tranches. Tente novamente.");
    setPagamentos(prev => [novoPagamento, ...prev]);

    const novoValorPago = (divida.valor_pago || 0) + valorTranche;
    const ficaLiquidada = novoValorPago >= divida.valor - 0.01;
    const dividaAtualizada: DividaFornecedor = {
      ...divida,
      estado: ficaLiquidada ? "Paga" : "Paga Parcialmente",
      valor_pago: novoValorPago,
      data_pagamento: pagamentoData,
      id_conta_pagamento: conta.id_conta,
      id_movimento_pagamento: novoMovimento.id_mov
    };
    await saveDividaFornecedorToSupabase(dividaAtualizada);
    setDividas(prev => prev.map(d => d.id_divida === divida.id_divida ? dividaAtualizada : d));
    registarLogAuditoria(
      "Financeira",
      ficaLiquidada ? "Liquidou uma dívida a fornecedor" : "Pagou uma tranche de uma dívida a fornecedor",
      predio.id_predio,
      loggedUser,
      `${divida.fornecedor_nome} — ${divida.descricao} (${valorTranche.toFixed(2)} € via ${conta.banco}${ficaLiquidada ? "" : `, saldo em dívida: ${(divida.valor - novoValorPago).toFixed(2)} €`})`
    );

    setPagamentoContaId("");
    setPagamentoValorTranche("");
    if (ficaLiquidada) {
      setPagandoDividaId(null);
      alert(`✅ Dívida totalmente paga! O saldo da conta ${conta.banco} foi atualizado.`);
    } else {
      alert(`✅ Tranche registada! Saldo em dívida: ${(divida.valor - novoValorPago).toFixed(2)} €. Podes registar outra tranche quando quiseres.`);
    }
  };

  const handleRemoverDivida = async (divida: DividaFornecedor) => {
    if ((divida.valor_pago || 0) > 0) {
      return alert("Esta dívida já tem pagamentos registados — não pode ser eliminada, para não perder a ligação aos movimentos e contas já debitados. Corrija-a antes através da edição, se necessário.");
    }
    if (!window.confirm(`Eliminar o lançamento "${divida.descricao}"? Esta ação não pode ser desfeita.`)) return;
    const ok = await deleteDividaFornecedorFromSupabase(divida.id_divida);
    if (!ok) return alert("❌ Não foi possível eliminar a dívida no Supabase.");
    setDividas(prev => prev.filter(d => d.id_divida !== divida.id_divida));
  };

  // Global budget reference for impact evaluation
  const [orcamentoReferencia, setOrcamentoReferencia] = useState("5000");

  // New Contract Form State
  const [selectedFornecedorId, setSelectedFornecedorId] = useState("");
  const [tipoContrato, setTipoContrato] = useState("Manutenção");
  const [servicoNome, setServicoNome] = useState("");
  const [dataInicio, setDataInicio] = useState(() => new Date().toISOString().split("T")[0]);
  const [custoMensal, setCustoMensal] = useState("");
  const [custoAnual, setCustoAnual] = useState("");
  const [renovacaoAuto, setRenovacaoAuto] = useState(true);
  const [dataFim, setDataFim] = useState("2027-01-01");
  const [alertaDiasAntecedencia, setAlertaDiasAntecedencia] = useState(60);
  const [slaResposta, setSlaResposta] = useState("4 horas para avarias");
  const [penalizacaoAtraso, setPenalizacaoAtraso] = useState("5% desconto em mora");
  const [indexacaoPreco, setIndexacaoPreco] = useState("IPC Inflação INE");
  const [documentoNome, setDocumentoNome] = useState("");
  const [documentoBase64, setDocumentoBase64] = useState("");

  // Rescisão de contrato — emite carta real (PDF + email) e regista
  // comprovativo de envio no próprio contrato.
  const [rescindindoContratoId, setRescindindoContratoId] = useState<string | null>(null);
  const [motivoRescisao, setMotivoRescisao] = useState("");
  const [dataEfeitoRescisao, setDataEfeitoRescisao] = useState(() => new Date().toISOString().split("T")[0]);
  const [aEnviarRescisao, setAEnviarRescisao] = useState(false);

  const renovarContratoAutomatico = async (idContrato: string) => {
    const atual = contratos.find(c => c.id_contrato === idContrato);
    if (!atual) return;

    const parts = atual.data_fim.split("-");
    const nextYear = (parseInt(parts[0]) || 2026) + 1;
    const newDateFim = `${nextYear}-${parts[1] || "12"}-${parts[2] || "31"}`;
    const logMsg = `Renovado manualmente em ${new Date().toLocaleDateString("pt-PT")} para ${newDateFim}`;
    const atualizado: Contrato = {
      ...atual,
      data_fim: newDateFim,
      estado: "Ativo",
      // Repõe o ciclo de alerta — sem isto, um contrato recém-renovado
      // ficava "mudo" para sempre, porque alerta_enviado_em continuava
      // preenchido da vigência anterior.
      alerta_enviado_em: undefined,
      historico_renovacoes: [logMsg, ...(atual.historico_renovacoes || [])]
    };

    const ok = await saveContratoToSupabase(atualizado);
    if (ok) {
      setContratos(prev => prev.map(c => c.id_contrato === idContrato ? atualizado : c));
      alert("✨ Contrato renovado automaticamente por +1 ano com registo auditado e alerta atualizado!");
    } else {
      alert("❌ Não foi possível guardar a renovação no Supabase. Tente novamente.");
    }
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

  const submeterFornecedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedUser.role !== 'ADMIN' && loggedUser.role !== 'EMPRESA_GESTORA') {
      return alert("Apenas administradores podem cadastrar fornecedores!");
    }
    if (!nome || !nif || !categoria) return alert("Preencha todos os campos obrigatórios (Nome, NIF, Categoria)!");

    const isEditing = editingFornecedorId !== null;
    const fornecedorOriginal = isEditing ? fornecedoresList.find(f => f.id_fornecedor === editingFornecedorId) : null;
    // "forn-" + contagem gerava o mesmo id para fornecedores criados em
    // sucessão rápida (o prop "fornecedores" ainda não tinha atualizado
    // entre submissões) — o segundo apagava silenciosamente o primeiro no
    // Supabase, porque a gravação é sempre um upsert pelo id_fornecedor.
    const idFinal = isEditing && fornecedorOriginal ? fornecedorOriginal.id_fornecedor : "forn-" + Date.now();
    const novo: Fornecedor = {
      id_fornecedor: idFinal,
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
      // Ao editar, mantém o que já lá estava — não se reenvia o acesso PWA
      // só porque se corrigiu, por exemplo, um número de telefone.
      pwa_acesso_enviado: isEditing ? (fornecedorOriginal?.pwa_acesso_enviado ?? perfisPwa.length > 0) : perfisPwa.length > 0,
      referencias_contrato: referenciasContrato.length > 0 ? referenciasContrato : undefined
    };
    onAddFornecedor(novo);
    const okSave = await saveFornecedorToSupabase(novo);
    if (!okSave) {
      alert("⚠️ Fornecedor gravado localmente, mas houve um erro a gravar no Supabase. Tente novamente.");
    }

    if (isEditing) {
      handleCancelarEdicaoFornecedor();
      alert(`✅ Dados do fornecedor "${novo.nome}" atualizados com sucesso!`);
      return;
    }

    // Automatically select this new supplier in contract form if they want to build one next
    setSelectedFornecedorId(idFinal);

    // If PWA profile checklist had selected items, trigger automated welcome email & PDF manual
    if (perfisPwa.length > 0) {
      setWelcomeModalFornecedor(novo);

      if (novo.email_contacto) {
        try {
          await fetch("/api/pdf?tipo=registo-fornecedor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fornecedor: novo,
              predioObj: predio,
              email: novo.email_contacto,
              predio: predio.id_predio,
              ano: new Date().getFullYear()
            })
          });
        } catch (err) {
          console.warn("[GestaoFornecedores] Aviso ao enviar email de registo do fornecedor:", err);
        }
      }
    }

    setNome(""); setNif(""); setIban(""); setCategoria(""); setMorada(""); setContacto(""); setPessoaContacto(""); setTelemovelDireto(""); setEmailContacto(""); setDataNascimento(""); setPerfisPwa([]); setReferenciasContrato([]);
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
      id_contrato: crypto.randomUUID(),
      id_predio: predio.id_predio,
      id_fornecedor: selectedFornecedorId,
      tipo_contrato: tipoContrato,
      servico: servicoNome,
      data_inicio: dataInicio,
      custo_mensal: cMensal,
      custo_anual: cAnual,
      renovacao_automatica: renovacaoAuto,
      data_fim: dataFim,
      estado: "Ativo",
      alerta_renovacao: true,
      alerta_dias_antecedencia: alertaDiasAntecedencia,
      sla_resposta: slaResposta || "24h padrão",
      penalizacao_atraso: penalizacaoAtraso || "Sem penalização",
      indexacao_preco: indexacaoPreco || "IPC Taxa Inflação",
      historico_renovacoes: [`Criado e registado em ${new Date().toLocaleDateString("pt-PT")}`],
      // Antes só se guardava o nome do ficheiro (documento_base64 ficava
      // capturado no estado local mas nunca era enviado ao Supabase) — o
      // anexo desaparecia sempre depois de recarregar a página.
      documento_nome: documentoNome || undefined,
      documento_base64: documentoBase64 || undefined
    };

    saveContratoToSupabase(novoContrato).then(ok => {
      if (ok) {
        setContratos([novoContrato, ...contratos]);
        setServicoNome("");
        setCustoMensal("");
        setCustoAnual("");
        setAlertaDiasAntecedencia(60);
        setDocumentoNome("");
        setDocumentoBase64("");
        alert("Serviço Contratado registado e arquivado no sistema!");
      } else {
        alert("❌ Não foi possível guardar o contrato no Supabase. Tente novamente.");
      }
    });
  };

  const excluirContrato = async (id: string) => {
    if (!window.confirm("Deseja realmente arquivar/remover este contrato?")) return;
    const ok = await deleteContratoFromSupabase(id);
    if (ok) {
      setContratos(contratos.filter(c => c.id_contrato !== id));
    } else {
      alert("❌ Não foi possível remover o contrato no Supabase. Tente novamente.");
    }
  };

  // Emite a carta de rescisão (PDF real, gerado e enviado por email a
  // partir do servidor — não um botão que só finge). O resultado devolvido
  // por /api/pdf diz mesmo se o email foi enviado, e isso fica gravado como
  // comprovativo no próprio contrato, em vez de assumir sucesso às cegas.
  // Ao rescindir, o contrato também é arquivado automaticamente na pasta
  // "Fornecedores → Contratos Rescindidos / Não Renovados" do Arquivo
  // Digital (feito no servidor, via registarDocumento em api/pdf.js).
  const handleEmitirRescisao = async (contrato: Contrato) => {
    if (loggedUser.role !== 'ADMIN' && loggedUser.role !== 'EMPRESA_GESTORA') {
      return alert("Apenas administradores podem rescindir contratos!");
    }
    if (!motivoRescisao.trim()) return alert("Indique o motivo da rescisão.");

    const fornecedor = predioForn.find(f => f.id_fornecedor === contrato.id_fornecedor);
    const emailDestino = fornecedor?.email_contacto;
    if (!emailDestino) {
      return alert("Este fornecedor não tem e-mail de contacto registado — não é possível enviar a carta de rescisão. Adicione um e-mail na ficha do fornecedor primeiro.");
    }

    setAEnviarRescisao(true);
    try {
      const resp = await fetch("/api/pdf?tipo=rescisao-contrato-fornecedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predio: predio.id_predio,
          ano: new Date().getFullYear(),
          email: emailDestino,
          nome: fornecedor?.nome,
          rescisao: {
            predioNome: predio.nome,
            predioNif: predio.nif || "",
            fornecedorNome: fornecedor?.nome || contrato.tipo_contrato,
            fornecedorNif: fornecedor?.nif,
            servico: contrato.servico,
            dataInicio: contrato.data_inicio,
            dataFimContratual: contrato.data_fim,
            motivo: motivoRescisao.trim(),
            dataEfeito: dataEfeitoRescisao,
            administradorNome: loggedUser.nome
          }
        })
      });
      const resultado = await resp.json();
      if (!resp.ok || !resultado?.ok) {
        alert(`❌ Não foi possível gerar/enviar a carta de rescisão: ${resultado?.error || "erro desconhecido"}`);
        return;
      }

      const contratoAtualizado: Contrato = {
        ...contrato,
        estado: "Rescindido",
        rescisao: {
          motivo: motivoRescisao.trim(),
          data_efeito: dataEfeitoRescisao,
          enviado_para: emailDestino,
          enviado_em: resultado.email_enviado ? new Date().toISOString() : undefined,
          comprovativo: resultado.email_enviado
            ? `E-mail enviado com sucesso para ${emailDestino} em ${new Date().toLocaleString("pt-PT")}`
            : "PDF gerado, mas o envio do e-mail falhou — confirme o e-mail do fornecedor e tente reenviar."
        },
        historico_renovacoes: [
          `Contrato rescindido em ${new Date().toLocaleDateString("pt-PT")} — ${motivoRescisao.trim()}`,
          ...(contrato.historico_renovacoes || [])
        ]
      };
      const okSave = await saveContratoToSupabase(contratoAtualizado);
      if (!okSave) {
        alert("⚠️ A carta foi gerada e enviada, mas não foi possível atualizar o estado do contrato no Supabase. Tente novamente.");
        return;
      }
      setContratos(prev => prev.map(c => c.id_contrato === contrato.id_contrato ? contratoAtualizado : c));
      registarLogAuditoria("Fornecedores", "Rescindiu um contrato de fornecedor", predio.id_predio, loggedUser, `${fornecedor?.nome || ""} — ${contrato.servico}`);
      setRescindindoContratoId(null);
      setMotivoRescisao("");
      alert(resultado.email_enviado
        ? `✅ Carta de rescisão enviada para ${emailDestino} e arquivada em Arquivo → Fornecedores.`
        : "⚠️ Carta gerada e contrato marcado como rescindido, mas o envio do e-mail falhou. Verifique o e-mail do fornecedor.");
    } catch (err) {
      console.error("Erro ao emitir carta de rescisão:", err);
      alert("❌ Ocorreu um erro ao emitir a carta de rescisão. Tente novamente.");
    } finally {
      setAEnviarRescisao(false);
    }
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
  // Usava uma data fixa ("hoje" = 16/07/2026) em vez da data real, por isso
  // o alerta visual ficava errado (sempre calculado a partir dessa data
  // congelada) assim que se passasse a data verdadeira do sistema. Também
  // aceita agora o prazo configurado por contrato (30/60/90/120 dias) em
  // vez de 30 dias fixos para todos.
  const isExpiringSoon = (dateStr: string, diasAntecedencia: number = 30) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const expDate = new Date(dateStr);
    const diffTime = expDate.getTime() - hoje.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= diasAntecedencia;
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
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">{editingFornecedorId ? `Editar Fornecedor: ${nome || "..."}` : "Cadastrar Novo Fornecedor do Condomínio"}</h3>
                {editingFornecedorId && (
                  <button
                    type="button"
                    onClick={handleCancelarEdicaoFornecedor}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancelar</span>
                  </button>
                )}
              </div>

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

              {/* Referências de Contrato / ADC — usadas para cruzar
                  automaticamente débitos diretos (eletricidade, água, gás)
                  com este fornecedor, já que o IBAN de credor de uma utility
                  é o mesmo para todos os clientes. */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-2">
                    <i className="fa-solid fa-link text-emerald-600"></i>
                    Referências de Contrato / ADC (Débito Direto)
                  </label>
                  <span className="text-[10px] text-slate-400 max-w-xs text-right">Ex: "Número da ADC" de eletricidade/água/gás — identifica o contrato certo mesmo quando o IBAN do credor é partilhado por todos os clientes da mesma entidade.</span>
                </div>

                {referenciasContrato.length > 0 && (
                  <div className="space-y-1.5">
                    {referenciasContrato.map((rc, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                        <div>
                          <span className="font-mono font-bold text-slate-700">{rc.referencia}</span>
                          {rc.descricao && <span className="text-slate-400 ml-2">— {rc.descricao}</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => setReferenciasContrato(prev => prev.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={novaReferenciaValor}
                    onChange={e => setNovaReferenciaValor(e.target.value)}
                    placeholder="Ex: 219702983000"
                    className="border border-slate-200 px-2.5 py-1.5 text-xs rounded-lg focus:outline-emerald-500 font-mono flex-1"
                  />
                  <input
                    type="text"
                    value={novaReferenciaDescricao}
                    onChange={e => setNovaReferenciaDescricao(e.target.value)}
                    placeholder="Descrição (opcional, ex: Eletricidade partes comuns)"
                    className="border border-slate-200 px-2.5 py-1.5 text-xs rounded-lg focus:outline-emerald-500 flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAdicionarReferenciaContrato}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Checklist de Atribuição de Perfis PWA */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-2">
                    <i className="fa-solid fa-[#000] fa-mobile-screen-button text-emerald-600"></i>
                    Checklist de Atribuição de Perfis PWA
                  </label>
                  <span className="text-[10px] text-slate-400">Por defeito não é enviado nenhum e-mail (bancos, seguradoras e a maioria dos fornecedores não precisam de acesso). Só selecione um perfil se este fornecedor for mesmo usar a PWA.</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPerfisPwa([])}
                    className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${
                      perfisPwa.length === 0
                        ? "border-slate-400 bg-slate-100 text-slate-800 ring-2 ring-slate-400 shadow-xs"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span>🚫</span>
                      <span>Sem Acesso PWA</span>
                    </span>
                    <i className={`fa-solid ${perfisPwa.length === 0 ? "fa-circle-check text-slate-600" : "fa-circle text-slate-300"} text-xs`}></i>
                  </button>
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

              <button
                type="submit"
                id="btn-guardar-fornecedor-supabase"
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer flex items-center space-x-1.5 shadow-xs"
              >
                {editingFornecedorId ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{editingFornecedorId ? "Guardar Alterações" : "Guardar Fornecedor no Supabase"}</span>
              </button>
            </form>
          )}

          {/* Lista de Fornecedores — acordeão em vez de tabela larga, para
              caber muitos fornecedores sem ficar impossível de percorrer. */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Fornecedores Registados</span>
              <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{predioForn.length}</span>
            </div>
            {predioForn.length === 0 ? (
              <div className="p-6 text-center text-slate-400 italic text-xs">Nenhum fornecedor cadastrado.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {predioForn.map(f => {
                  const isExpanded = expandedFornecedorId === f.id_fornecedor;
                  return (
                    <div key={f.id_fornecedor}>
                      <button
                        type="button"
                        onClick={() => setExpandedFornecedorId(isExpanded ? null : f.id_fornecedor)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <i className={`fa-solid fa-chevron-right text-slate-400 text-[10px] transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`}></i>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 text-xs block truncate">{f.nome}</span>
                            <span className="text-[10px] text-slate-400 font-mono">NIF {f.nif || "—"}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {f.perfis_pwa && f.perfis_pwa.length > 0 && (
                            <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full hidden sm:inline-block">PWA</span>
                          )}
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{f.categoria}</span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 bg-slate-50/40 text-xs space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1 text-slate-600">
                              <p className="font-mono"><span className="font-semibold text-slate-500">IBAN:</span> {f.iban || <span className="text-slate-400 italic">Não fornecido</span>}</p>
                              {f.contacto && <p className="font-mono"><i className="fa-solid fa-phone mr-1.5 text-slate-400"></i><span className="font-semibold text-slate-500">Geral:</span> {f.contacto}</p>}
                              {f.pessoa_contacto && <p><i className="fa-solid fa-user-tie mr-1.5 text-slate-400"></i><span className="font-semibold text-slate-500">Pessoa:</span> {f.pessoa_contacto}</p>}
                              {f.email_contacto && <p className="font-mono"><i className="fa-solid fa-envelope mr-1.5 text-slate-400"></i><span className="font-semibold text-slate-500">E-mail:</span> {f.email_contacto}</p>}
                              {f.telemovel_direto && <p className="font-mono"><i className="fa-solid fa-mobile-screen-button mr-1.5 text-slate-400"></i><span className="font-semibold text-slate-500">Telemóvel Direto:</span> {f.telemovel_direto}</p>}
                              {f.morada && <p><i className="fa-solid fa-location-dot mr-1.5 text-slate-400"></i>{f.morada}</p>}
                              {f.data_nascimento && <p className="font-mono">🎂 Nasc: {f.data_nascimento}</p>}
                              {f.referencias_contrato && f.referencias_contrato.length > 0 && (
                                <div className="pt-1">
                                  <span className="font-semibold text-slate-500 block mb-0.5">Referências de Contrato / ADC:</span>
                                  {f.referencias_contrato.map((rc, i) => (
                                    <p key={i} className="font-mono text-[10px]">{rc.referencia}{rc.descricao ? ` — ${rc.descricao}` : ""}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
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
                            </div>
                          </div>

                          {(() => {
                            const contratosDoFornecedor = predioContratos.filter(c => c.id_fornecedor === f.id_fornecedor);
                            if (contratosDoFornecedor.length === 0) return null;
                            const ativos = contratosDoFornecedor.filter(c => c.estado === "Ativo");
                            const proximoAVencer = [...ativos].sort((a, b) => a.data_fim < b.data_fim ? -1 : 1)[0];
                            const algumAExpirar = ativos.some(c => isExpiringSoon(c.data_fim, c.alerta_dias_antecedencia || 60));
                            return (
                              <div className={`flex items-center justify-between gap-2 border-t border-slate-200 pt-2 text-[10px] ${algumAExpirar ? "text-amber-700" : "text-slate-500"}`}>
                                <span>
                                  <i className="fa-solid fa-file-contract mr-1"></i>
                                  {ativos.length} contrato(s) ativo(s){contratosDoFornecedor.length > ativos.length ? `, ${contratosDoFornecedor.length - ativos.length} encerrado(s)` : ""}
                                  {proximoAVencer && ` — próximo fim: ${proximoAVencer.data_fim}`}
                                  {algumAExpirar && <span className="font-bold"> ⚠️ a vencer em breve</span>}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab("contratos")}
                                  className="text-indigo-600 hover:text-indigo-800 underline font-semibold cursor-pointer shrink-0"
                                >
                                  Ver Contratos
                                </button>
                              </div>
                            );
                          })()}

                          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200">
                            <button
                              onClick={() => handleEditarFornecedor(f)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                              title="Editar Fornecedor"
                            >
                              <Pencil className="h-2.5 w-2.5" />
                              <span>Editar</span>
                            </button>
                            <button
                              onClick={() => setWelcomeModalFornecedor(f)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                            >
                              <i className="fa-solid fa-paper-plane text-[8px]"></i> Acessos PWA & Manual
                            </button>
                            <button
                              onClick={() => setBirthdayModalFornecedor(f)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                            >
                              <i className="fa-solid fa-cake-candles text-[8px]"></i> E-mail Aniversário
                            </button>
                            <button
                              onClick={() => handleEliminarFornecedor(f)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                              title="Eliminar Fornecedor"
                            >
                              <img src="/estados-acoes/14-eliminar.png" alt="Eliminar" className="h-2.5 w-2.5 object-contain" />
                              <span>Eliminar</span>
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
                      <p><strong>Assunto:</strong> Registo de Fornecedor Homologado - Condomínio {predio.nome || "Edifício"}</p>
                    </div>
                    <hr className="border-emerald-100" />
                    <div className="space-y-3 text-slate-700 font-sans leading-relaxed relative z-10">
                      <p>Exmos. Senhores <strong>{welcomeModalFornecedor.nome}</strong>,</p>
                      <p>Confirmamos a conclusão do registo da vossa empresa no catálogo de fornecedores e prestadores homologados do <strong>Condomínio {predio.nome || "Edifício"}</strong>.</p>

                      <div className="bg-white/90 border border-slate-200 p-3 rounded-lg text-[11px] text-slate-800 space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Dados Fiscais para Faturação :</p>
                        <p>• <strong>Designação:</strong> Condomínio {predio.nome || "Edifício"}</p>
                        <p>• <strong>NIF:</strong> {predio.nif || "—"}</p>
                        <p>• <strong>Morada de Faturação:</strong> {predio.morada_linha1 || "—"}{predio.num_porta ? `, ${predio.num_porta}` : ""}{predio.localidade ? `, ${predio.localidade}` : ""}</p>
                        <p>• <strong>E-mail para Envio de Faturas/Recibos:</strong> {(predio as any).email_administracao || (predio as any).email || "administracao@condomanagerai.com"}</p>
                      </div>

                      <div className="bg-amber-50/90 border border-amber-200 p-3 rounded-lg text-[11px] text-slate-800 space-y-1">
                        <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Dados de Acesso:</p>
                        <p>• <strong>Link:</strong> <span className="font-mono text-indigo-600">https://bentorodrigues2.condomanagerai.com</span></p>
                        <p>• <strong>Utilizador:</strong> <span className="font-mono">{welcomeModalFornecedor.email_contacto || welcomeModalFornecedor.contacto || "fornecedor@empresa.pt"}</span></p>
                        <p className="text-[10px] text-amber-700 italic mt-1">O email enviado ao fornecedor não contém nenhuma palavra-passe — inclui apenas o link de acesso e os dados de contacto da administração.</p>
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
                    disabled={enviandoBoasVindasFornecedor}
                    onClick={async () => {
                      const destino = welcomeModalFornecedor.email_contacto || welcomeModalFornecedor.contacto;
                      if (!destino) {
                        alert("Este fornecedor não tem email de contacto registado.");
                        return;
                      }
                      setEnviandoBoasVindasFornecedor(true);
                      try {
                        const resp = await fetch("/api/pdf?tipo=registo-fornecedor", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            fornecedor: welcomeModalFornecedor,
                            predioObj: predio,
                            email: destino,
                            nome: welcomeModalFornecedor.nome,
                            predio: predio.id_predio,
                            ano: new Date().getFullYear()
                          })
                        });
                        const resultado = await resp.json();
                        if (!resp.ok || !resultado.ok) throw new Error(resultado?.error || "Falha ao enviar o email de boas-vindas");
                        setWelcomeModalFornecedor(null);
                        alert("E-mail de boas-vindas e credenciais PWA enviados com sucesso!");
                      } catch (err: any) {
                        alert(`❌ Erro ao enviar o email de boas-vindas: ${err?.message || "erro desconhecido"}`);
                      } finally {
                        setEnviandoBoasVindasFornecedor(false);
                      }
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer shadow-md text-center"
                  >
                    {enviandoBoasVindasFornecedor ? "A enviar..." : "Confirmar Envio Automático de Boas-Vindas"}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Tipo de Contrato *</label>
                  <select
                    required
                    value={tipoContrato}
                    onChange={e => setTipoContrato(e.target.value)}
                    className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-indigo-500 bg-white"
                  >
                    <option value="Manutenção">Manutenção</option>
                    <option value="Seguro">Seguro</option>
                    <option value="Limpeza">Limpeza</option>
                    <option value="Arrendamento">Arrendamento</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Data de Início *</label>
                  <input
                    type="date"
                    required
                    value={dataInicio}
                    onChange={e => setDataInicio(e.target.value)}
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

                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Alertar Fim de Contrato Com Antecedência</label>
                  <select
                    value={alertaDiasAntecedencia}
                    onChange={e => setAlertaDiasAntecedencia(Number(e.target.value))}
                    className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-indigo-500 bg-white"
                  >
                    <option value={30}>30 dias antes</option>
                    <option value={60}>60 dias antes</option>
                    <option value={90}>90 dias antes</option>
                    <option value={120}>120 dias antes</option>
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1">Email automático à administração quando faltar este prazo para o fim do contrato.</span>
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
                    <FileText className="w-4 h-4 shrink-0 text-red-600" />
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

              <button 
                type="submit" 
                id="btn-guardar-contrato-supabase"
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer flex items-center space-x-2 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar e Vincular Contrato no Supabase</span>
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
                  const isExpiring = c.estado === "Ativo" && isExpiringSoon(c.data_fim, c.alerta_dias_antecedencia || 60);
                  const isEncerrado = c.estado === "Rescindido" || c.estado === "Expirado";

                  return (
                    <div
                      key={c.id_contrato}
                      className={`bg-white p-5 rounded-xl border shadow-sm transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                        isEncerrado
                          ? "border-slate-200 opacity-70"
                          : isExpiring
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
                          {c.estado === "Rescindido" && (
                            <span className="text-[9px] bg-red-100 text-red-700 border border-red-200 font-extrabold px-2 py-0.5 rounded-full">
                              RESCINDIDO
                            </span>
                          )}
                          {c.estado === "Expirado" && (
                            <span className="text-[9px] bg-slate-200 text-slate-600 border border-slate-300 font-extrabold px-2 py-0.5 rounded-full">
                              EXPIRADO SEM RENOVAÇÃO
                            </span>
                          )}
                          {c.estado === "Ativo" && c.renovacao_automatica && (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-extrabold px-1.5 py-0.5 rounded">
                              Renovação Auto Ativa
                            </span>
                          )}
                          {isExpiring && (
                            <span className="text-[9px] bg-amber-500 text-white font-extrabold px-2 py-0.5 rounded-full animate-bounce flex items-center space-x-1">
                              <i className="fa-solid fa-bell"></i>
                              <span>ALERTA DE FIM DE CONTRATO (&lt;{c.alerta_dias_antecedencia || 60} dias)</span>
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

                        {c.rescisao && (
                          <div className="text-[10px] text-red-700 bg-red-50 px-2.5 py-1.5 rounded border border-red-200/60 space-y-0.5">
                            <div><span className="font-semibold">Motivo da Rescisão:</span> {c.rescisao.motivo}</div>
                            <div><span className="font-semibold">Data de Efeito:</span> {c.rescisao.data_efeito}</div>
                            <div className="font-mono text-[9px] text-red-500">{c.rescisao.comprovativo}</div>
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
                          {c.estado === "Ativo" && c.renovacao_automatica && (
                            <button
                              type="button"
                              onClick={() => renovarContratoAutomatico(c.id_contrato)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-xs"
                              title="Executar Renovação (+1 ano)"
                            >
                              <i className="fa-solid fa-rotate"></i>
                              <span>Renovar</span>
                            </button>
                          )}

                          {c.estado === "Ativo" && (loggedUser.role === 'ADMIN' || loggedUser.role === 'EMPRESA_GESTORA') && (
                            <button
                              type="button"
                              onClick={() => {
                                setRescindindoContratoId(rescindindoContratoId === c.id_contrato ? null : c.id_contrato);
                                setMotivoRescisao("");
                                setDataEfeitoRescisao(new Date().toISOString().split("T")[0]);
                              }}
                              className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                              title="Emitir Carta de Rescisão"
                            >
                              <i className="fa-solid fa-file-signature"></i>
                              <span>Rescindir</span>
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
                              title="Eliminar Registo do Contrato"
                            >
                              <img src="/estados-acoes/14-eliminar.png" alt="Eliminar" className="h-3.5 w-3.5 object-contain" />
                            </button>
                          )}
                        </div>
                      </div>

                      {rescindindoContratoId === c.id_contrato && (
                        <div className="w-full order-last bg-red-50/60 border border-red-200 rounded-lg p-4 space-y-3">
                          <p className="text-[10px] text-red-700">A carta de rescisão é gerada em PDF e enviada por email real para <strong>{partner?.email_contacto || "— este fornecedor não tem e-mail registado —"}</strong>, com comprovativo de envio guardado no contrato e arquivado em Arquivo → Fornecedores.</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col">
                              <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase">Motivo da Rescisão *</label>
                              <input
                                type="text"
                                value={motivoRescisao}
                                onChange={e => setMotivoRescisao(e.target.value)}
                                placeholder="Ex: Incumprimento reiterado do SLA contratado"
                                className="border border-slate-200 px-3 py-1.5 text-xs rounded-lg focus:outline-red-500"
                              />
                            </div>
                            <div className="flex flex-col">
                              <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase">Data de Efeito</label>
                              <input
                                type="date"
                                value={dataEfeitoRescisao}
                                onChange={e => setDataEfeitoRescisao(e.target.value)}
                                className="border border-slate-200 px-3 py-1.5 text-xs rounded-lg focus:outline-red-500"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={aEnviarRescisao}
                              onClick={() => handleEmitirRescisao(c)}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                              {aEnviarRescisao ? "A enviar..." : "Emitir e Enviar Carta de Rescisão"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRescindindoContratoId(null)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
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
        </div>
      )}

      {activeTab === "dividas" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide block">Total de Dívidas Pendentes</span>
              <span className="text-xl font-black text-amber-700 font-mono mt-0.5 block">{totalDividasPendentes.toFixed(2)} €</span>
              <span className="text-[10px] text-amber-600 mt-0.5 block">{dividasPendentes.length} fatura(s) por pagar</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Total Já Pago</span>
              <span className="text-xl font-black text-slate-700 font-mono mt-0.5 block">
                {dividasPredio.reduce((acc, d) => acc + (d.valor_pago || 0), 0).toFixed(2)} €
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {pagamentos.filter(p => dividasPredio.some(d => d.id_divida === p.id_divida)).length} tranche(s) paga(s) — {dividasPredio.filter(d => d.estado === "Paga").length} fatura(s) liquidada(s)
              </span>
            </div>
          </div>

          {(loggedUser.role === 'ADMIN' || loggedUser.role === 'EMPRESA_GESTORA') && (
            <form id="form-lancar-divida" onSubmit={handleLancarDivida} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">{editingDividaId ? "Editar Dívida / Fatura" : "Lançar Dívida / Fatura Pendente"}</h3>
                {editingDividaId && (
                  <button
                    type="button"
                    onClick={handleCancelarEdicaoDivida}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancelar</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">Registe faturas recebidas de fornecedores ainda não pagas — entram logo no saldo líquido real do prédio, sem precisar de já ter saído dinheiro de nenhuma conta.</p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col col-span-2">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Fornecedor *</label>
                  <select
                    value={dividaFornecedorId}
                    onChange={e => {
                      const id = e.target.value;
                      setDividaFornecedorId(id);
                      const f = predioForn.find(x => x.id_fornecedor === id);
                      if (f) setDividaFornecedorNome(f.nome);
                    }}
                    className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white"
                  >
                    <option value="">— Fornecedor não registado (escrever nome abaixo) —</option>
                    {predioForn.map(f => (
                      <option key={f.id_fornecedor} value={f.id_fornecedor}>{f.nome}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={dividaFornecedorNome}
                    onChange={e => setDividaFornecedorNome(e.target.value)}
                    placeholder="Nome do fornecedor / entidade"
                    className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 mt-2"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Valor (€) *</label>
                  <input type="number" min="0" step="0.01" value={dividaValor} onChange={e => setDividaValor(e.target.value)} placeholder="0.00" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono" />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Categoria</label>
                  <input type="text" value={dividaCategoria} onChange={e => setDividaCategoria(e.target.value)} placeholder="Ex: Manutenção, Limpeza..." className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col md:col-span-1">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Descrição da Fatura *</label>
                  <input type="text" value={dividaDescricao} onChange={e => setDividaDescricao(e.target.value)} placeholder="Ex: Fatura nº 123 — reparação elevador" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Data de Emissão</label>
                  <input type="date" value={dividaDataEmissao} onChange={e => setDividaDataEmissao(e.target.value)} className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Data de Vencimento</label>
                  <input type="date" value={dividaDataVencimento} onChange={e => setDividaDataVencimento(e.target.value)} className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
                </div>
              </div>

              <button type="submit" className="bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors cursor-pointer flex items-center space-x-1.5 shadow-xs">
                {editingDividaId ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{editingDividaId ? "Guardar Alterações" : "Lançar Dívida"}</span>
              </button>
            </form>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <th className="p-3">Fornecedor</th>
                  <th className="p-3">Descrição</th>
                  <th className="p-3">Vencimento</th>
                  <th className="p-3 text-right">Valor / Saldo em Dívida</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {dividasPredio.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-400">Sem dívidas a fornecedores lançadas.</td></tr>
                )}
                {dividasPredio.map(d => {
                  const saldo = saldoDevedorDivida(d);
                  const historico = pagamentosDaDivida(d.id_divida);
                  const podeGerir = (loggedUser.role === 'ADMIN' || loggedUser.role === 'EMPRESA_GESTORA') && d.estado !== "Paga";
                  return (
                  <React.Fragment key={d.id_divida}>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-700">{d.fornecedor_nome}</td>
                      <td className="p-3 text-slate-600">{d.descricao}{d.categoria ? ` (${d.categoria})` : ""}</td>
                      <td className="p-3 text-slate-500 font-mono">{d.data_vencimento || "—"}</td>
                      <td className="p-3 text-right font-mono">
                        <span className="font-bold text-slate-800">{d.valor.toFixed(2)} €</span>
                        {d.estado === "Paga Parcialmente" && (
                          <span className="block text-[10px] text-amber-600 mt-0.5">
                            Pago: {(d.valor_pago || 0).toFixed(2)} € · Falta: {saldo.toFixed(2)} €
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                          d.estado === "Paga" ? "bg-emerald-100 text-emerald-800" :
                          d.estado === "Paga Parcialmente" ? "bg-blue-100 text-blue-800" :
                          "bg-amber-100 text-amber-800"
                        }`}>
                          {d.estado}
                        </span>
                        {historico.length > 0 && (
                          <button
                            onClick={() => setHistoricoAbertoDividaId(historicoAbertoDividaId === d.id_divida ? null : d.id_divida)}
                            className="block text-[9px] text-slate-400 hover:text-slate-700 underline mt-1 cursor-pointer"
                          >
                            {historico.length} tranche(s) {historicoAbertoDividaId === d.id_divida ? "▲" : "▼"}
                          </button>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {podeGerir && (
                            <button
                              onClick={() => handleEditarDivida(d)}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg transition-all cursor-pointer"
                              title="Editar Dívida"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {podeGerir && (
                            <button
                              onClick={() => {
                                const abrir = pagandoDividaId !== d.id_divida;
                                setPagandoDividaId(abrir ? d.id_divida : null);
                                setPagamentoValorTranche(abrir ? saldo.toFixed(2) : "");
                              }}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                              title="Pagar (total ou em tranche)"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Pagar</span>
                            </button>
                          )}
                          {loggedUser.role === 'ADMIN' && (
                            <button
                              onClick={() => handleRemoverDivida(d)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg transition-all cursor-pointer"
                              title="Eliminar Lançamento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {historicoAbertoDividaId === d.id_divida && historico.length > 0 && (
                      <tr className="bg-slate-50/60 border-b border-slate-100">
                        <td colSpan={6} className="p-3">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Histórico de Tranches Pagas</span>
                          <div className="space-y-1">
                            {historico.map(p => {
                              const contaPag = predioContas.find(c => c.id_conta === p.id_conta);
                              return (
                                <div key={p.id_pagamento} className="flex items-center justify-between text-[11px] bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                                  <span className="text-slate-500 font-mono">{p.data}</span>
                                  <span className="text-slate-600">{contaPag ? `${contaPag.banco} (${contaPag.tipo})` : "Conta removida"}</span>
                                  <span className="font-bold text-slate-800 font-mono">{p.valor.toFixed(2)} €</span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}

                    {pagandoDividaId === d.id_divida && (
                      <tr className="bg-emerald-50/40 border-b border-emerald-100">
                        <td colSpan={6} className="p-3">
                          <p className="text-[10px] text-slate-500 mb-2">
                            Saldo em dívida: <strong className="text-slate-700">{saldo.toFixed(2)} €</strong>. Podes pagar o valor todo agora ou só uma tranche — o resto fica pendente para pagares mais tarde, mesmo a partir de outra conta bancária.
                          </p>
                          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                            <div className="flex flex-col">
                              <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase">Valor a Pagar Agora (€) *</label>
                              <input
                                type="number"
                                min="0.01"
                                max={saldo}
                                step="0.01"
                                value={pagamentoValorTranche}
                                onChange={e => setPagamentoValorTranche(e.target.value)}
                                className="border border-slate-200 px-3 py-1.5 text-xs rounded-lg focus:outline-emerald-500 font-mono w-32"
                              />
                            </div>
                            <div className="flex flex-col">
                              <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase">Conta a Debitar *</label>
                              <select
                                value={pagamentoContaId}
                                onChange={e => setPagamentoContaId(e.target.value)}
                                className="border border-slate-200 px-3 py-1.5 text-xs rounded-lg focus:outline-emerald-500 bg-white min-w-[220px]"
                              >
                                <option value="">— Selecione a conta —</option>
                                {predioContas.map(c => (
                                  <option key={c.id_conta} value={c.id_conta}>{c.banco} ({c.tipo}) — Saldo: {c.saldo.toFixed(2)} €</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-col">
                              <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase">Data de Pagamento</label>
                              <input type="date" value={pagamentoData} onChange={e => setPagamentoData(e.target.value)} className="border border-slate-200 px-3 py-1.5 text-xs rounded-lg focus:outline-emerald-500" />
                            </div>
                            <button
                              onClick={() => handleRegistarPagamentoTranche(d)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                            >
                              {Number(pagamentoValorTranche) >= saldo - 0.01 ? "Confirmar Pagamento Total" : "Registar Tranche"}
                            </button>
                            <button
                              onClick={() => { setPagandoDividaId(null); setPagamentoContaId(""); setPagamentoValorTranche(""); }}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                          {predioContas.length === 0 && (
                            <p className="text-[10px] text-red-600 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Não há contas bancárias registadas neste prédio.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
