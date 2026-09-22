import React, { useState, useEffect } from "react";
import { Predio, Fracao, Aviso, LoggedUser, Documento, RevisaoOrcamento, Conta, Movimento, Reuniao } from "../types";
import { formatDatePT, formatQuotaReceiptNumber, parseValorMonetario, escolherIbanContaPorTipo } from "../utils";
import { downloadOfficialReceiptPDF } from "../utils/receiptGenerator";
import { MoneyInput } from "./MoneyInput";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  dbUpdate,
  dbDelete,
  saveAvisosToSupabase,
  saveContaToSupabase,
  saveMovimentoToSupabase,
  registarLogAuditoria,
  fetchRevisoesOrcamentoFromSupabase,
  saveRevisaoOrcamentoToSupabase,
  deleteRevisaoOrcamentoFromSupabase,
  orcamentoVigente
} from "../lib/supabaseService";

interface GestaoEmissaoProps {
  predio: Predio;
  fracoes: Fracao[];
  avisos: Aviso[];
  setAvisos: React.Dispatch<React.SetStateAction<Aviso[]>>;
  contas: Conta[];
  setContas: React.Dispatch<React.SetStateAction<Conta[]>>;
  movements: Movimento[];
  setMovements: React.Dispatch<React.SetStateAction<Movimento[]>>;
  documentos?: Documento[];
  setDocumentos?: React.Dispatch<React.SetStateAction<Documento[]>>;
  loggedUser: LoggedUser;
  reunioes?: Reuniao[];
}

export function GestaoEmissao({ predio, fracoes, avisos, setAvisos, contas, setContas, movements, setMovements, documentos, setDocumentos, loggedUser, reunioes = [] }: GestaoEmissaoProps) {
  // Atas reais já emitidas (com nº atribuído) deste prédio — usadas para
  // ligar a revisão de orçamento à ata que a aprovou, em vez de texto livre
  // digitado à mão que podia divergir da ata realmente emitida.
  const atasEmitidas = reunioes.filter(r => r.id_predio === predio.id_predio && (r.numero_ata || r.ata)).sort((a, b) => b.data.localeCompare(a.data));
  const [orcamentoAnual, setOrcamentoAnual] = useState(() => {
    const guardado = (predio.patrimonio as any)?.orcamento_anual;
    return guardado ? String(guardado) : "";
  });
  const [mes, setMes] = useState("Janeiro");
  const [anoEmissao, setAnoEmissao] = useState(String(new Date().getFullYear()));

  // O orçamento anual também é necessário no servidor (emissão automática de
  // quotas no dia 25 via cron — ver server/lib/cronService.js), por isso é
  // guardado em predios.patrimonio, tal como a assinatura do administrador.
  useEffect(() => {
    const guardado = (predio.patrimonio as any)?.orcamento_anual;
    setOrcamentoAnual(guardado ? String(guardado) : "");
  }, [predio.id_predio]);

  const persistirOrcamentoNoSupabase = async (valor: number) => {
    if (!isSupabaseConfigured) return;
    try {
      await dbUpdate("predios", { patrimonio: { ...(predio.patrimonio || {}), orcamento_anual: valor } }, [["id_predio", "eq", predio.id_predio]]);
    } catch (err) {
      console.warn("[Supabase] Erro ao guardar orçamento anual:", err);
    }
  };

  // Histórico de adendas/revisões ao orçamento anual — permite registar que
  // a partir de uma certa data (ex: aprovada em assembleia a meio do ano)
  // passa a vigorar um novo valor, sem perder o histórico do anterior. A
  // sincronização diária (server/lib/cronService.js) aplica sozinha a
  // revisão certa quando a sua data de vigência chega; ao gravar uma
  // revisão já em vigor hoje, aplica-se de imediato aqui também.
  const [revisoesOrcamento, setRevisoesOrcamento] = useState<RevisaoOrcamento[]>([]);
  const [novaRevisaoValor, setNovaRevisaoValor] = useState("");
  const [novaRevisaoData, setNovaRevisaoData] = useState(() => new Date().toISOString().split("T")[0]);
  const [novaRevisaoAssembleia, setNovaRevisaoAssembleia] = useState(false);
  const [novaRevisaoMotivo, setNovaRevisaoMotivo] = useState("");
  const [novaRevisaoAtaId, setNovaRevisaoAtaId] = useState("");

  useEffect(() => {
    fetchRevisoesOrcamentoFromSupabase(predio.id_predio).then(r => setRevisoesOrcamento(r || []));
  }, [predio.id_predio]);

  const revisaoEmVigor = orcamentoVigente(revisoesOrcamento);

  const handleAddRevisaoOrcamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedUser.role !== "ADMIN" && loggedUser.role !== "EMPRESA_GESTORA") {
      return alert("Apenas administradores podem registar revisões ao orçamento!");
    }
    if (!novaRevisaoValor || !novaRevisaoData) return alert("Preencha o novo valor e a data de vigência.");
    const novoValorRevisao = parseValorMonetario(novaRevisaoValor);
    if (novoValorRevisao <= 0) return alert("Indique um valor válido para a revisão do orçamento.");

    const ataSelecionada = atasEmitidas.find(r => r.id_reuniao === novaRevisaoAtaId);
    const motivoFinal = ataSelecionada
      ? `Ata ${ataSelecionada.numero_ata || "s/nº"} — ${ataSelecionada.tema} (${formatDatePT(ataSelecionada.data)})${novaRevisaoMotivo ? ` — ${novaRevisaoMotivo}` : ""}`
      : (novaRevisaoMotivo || undefined);

    const nova: RevisaoOrcamento = {
      id_revisao: "rev-" + Date.now(),
      id_predio: predio.id_predio,
      valor: novoValorRevisao,
      data_vigencia: novaRevisaoData,
      aprovado_em_assembleia: novaRevisaoAssembleia || Boolean(ataSelecionada),
      motivo: motivoFinal,
      id_reuniao_ata: ataSelecionada?.id_reuniao || undefined
    };
    const ok = await saveRevisaoOrcamentoToSupabase(nova);
    if (!ok) return alert("❌ Não foi possível gravar a revisão no Supabase. Tente novamente.");

    const novaLista = [nova, ...revisoesOrcamento];
    setRevisoesOrcamento(novaLista);
    registarLogAuditoria("Financeira", "Registou uma revisão ao orçamento anual", predio.id_predio, loggedUser, `Novo valor: ${nova.valor.toFixed(2)} € a partir de ${formatDatePT(nova.data_vigencia)}`);

    // Se a revisão já entra em vigor hoje (ou no passado), aplica de imediato
    // em vez de esperar pela sincronização diária do cron.
    const maisRecenteVigente = orcamentoVigente(novaLista);
    if (maisRecenteVigente && maisRecenteVigente.id_revisao === nova.id_revisao) {
      setOrcamentoAnual(String(nova.valor));
      await persistirOrcamentoNoSupabase(nova.valor);
    }

    setNovaRevisaoValor("");
    setNovaRevisaoMotivo("");
    setNovaRevisaoAssembleia(false);
    setNovaRevisaoAtaId("");
    alert(
      maisRecenteVigente?.id_revisao === nova.id_revisao
        ? "✅ Revisão registada e já aplicada — o orçamento anual em vigor foi atualizado."
        : "✅ Revisão registada — entra em vigor automaticamente em " + formatDatePT(nova.data_vigencia) + "."
    );
  };

  const handleRemoverRevisaoOrcamento = async (revisao: RevisaoOrcamento) => {
    if (!window.confirm(`Eliminar a revisão de ${revisao.valor.toFixed(2)} € (vigência ${formatDatePT(revisao.data_vigencia)})?`)) return;
    const ok = await deleteRevisaoOrcamentoFromSupabase(revisao.id_revisao);
    if (!ok) return alert("❌ Não foi possível eliminar a revisão no Supabase.");
    setRevisoesOrcamento(prev => prev.filter(r => r.id_revisao !== revisao.id_revisao));
  };

  // Document Viewer modal states
  const [selectedAviso, setSelectedAviso] = useState<Aviso | null>(null);
  const [docType, setDocType] = useState<"RECIBO" | "NOTA_COBRANCA">("NOTA_COBRANCA");
  
  // Customization states for the generated document
  // Vazio por omissão — quando vazio, o IBAN é escolhido automaticamente
  // pelo tipo do aviso (escolherIbanContaPorTipo, ver handleGeneratePdf);
  // só é usado quando o admin o preenche manualmente de propósito.
  const [customIban, setCustomIban] = useState("");
  const [customDataLimite, setCustomDataLimite] = useState("");
  const [customDataPagamento, setCustomDataPagamento] = useState("");
  const [customQuotaMensal, setCustomQuotaMensal] = useState<number>(0);
  const [customQuotaExtra, setCustomQuotaExtra] = useState<number>(0);
  const [customDescritivo, setCustomDescritivo] = useState("");
  const [customCondomino, setCustomCondomino] = useState("");
  const [customNrecibo, setCustomNrecibo] = useState("");
  const [pagamentoContaId, setPagamentoContaId] = useState("");
  const [aRegistarPagamento, setARegistarPagamento] = useState(false);
  const [pagamentoValorInput, setPagamentoValorInput] = useState("");

  // Edição/eliminação de avisos já emitidos — antes não existia forma
  // nenhuma de corrigir um valor errado ou eliminar um aviso lançado por
  // engano, só era possível criar novos.
  const [editingAviso, setEditingAviso] = useState<Aviso | null>(null);
  const [editValorTotal, setEditValorTotal] = useState("");
  const [editValorFCR, setEditValorFCR] = useState("");
  const [editVencimento, setEditVencimento] = useState("");
  const [editDescricao, setEditDescricao] = useState("");

  const predioFracoes = fracoes.filter(f => f.id_predio === predio.id_predio);
  const predioAvisos = avisos.filter(a => a.id_predio === predio.id_predio);
  const predioContas = contas.filter(c => c.id_predio === predio.id_predio);

  const MESES_INDEX: Record<string, number> = {
    "Janeiro": 0, "Fevereiro": 1, "Março": 2, "Abril": 3, "Maio": 4, "Junho": 5,
    "Julho": 6, "Agosto": 7, "Setembro": 8, "Outubro": 9, "Novembro": 10, "Dezembro": 11
  };

  const gerarOrcamentoMensal = (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedUser.role !== 'ADMIN' && loggedUser.role !== 'EMPRESA_GESTORA') {
      return alert("Apenas administradores podem emitir quotas!");
    }
    if (!orcamentoAnual) return alert("Preencha o Orçamento Anual!");
    const orcamentoAnualNum = parseValorMonetario(orcamentoAnual);
    if (orcamentoAnualNum <= 0) return alert("Indique um valor válido para o Orçamento Anual!");
    const anoNum = parseInt(anoEmissao, 10);
    if (!anoNum || anoNum < 2000) return alert("Indique um ano de emissão válido!");

    persistirOrcamentoNoSupabase(orcamentoAnualNum);

    const d = new Date();
    const dataDoc = d.toISOString().split('T')[0];
    // Vencimento a dia 8 do mês selecionado (mesma convenção usada pela
    // emissão automática mensal em server/lib/cronService.js).
    const mesIdx = MESES_INDEX[mes] ?? 0;
    const vencimento = `${anoNum}-${String(mesIdx + 1).padStart(2, "0")}-08`;
    const orcamentoMensal = orcamentoAnualNum / 12;

    // Coeficiente real das lojas com acesso direto pelo exterior — NÃO é uma
    // isenção legal fixa (a lei, art.º 1424º CC, só isenta especificamente
    // despesas de ascensor, e o ascensor deste prédio custa 1600€/ano, o que
    // por si só não explicava o desfasamento). Este valor (45,28%) foi
    // reverse-engineered a partir do quadro de quotas real desta gestora
    // anterior (confirmado com o administrador: bate a 1 cêntimo ou exato
    // em 17 de 17 frações, incluindo o total = orçamento anual/12) e
    // confirmado por ele para passar a ser a fórmula oficial. As lojas
    // pagam esta fração da taxa das restantes frações, e a diferença é
    // sempre redistribuída pelas outras para o total bater sempre certo
    // com o orçamento anual aprovado (antes o fator 0.4 "perdia" essa
    // diferença sem a redistribuir — por isso o total nunca batia certo).
    const COEF_LOJA_EXTERIOR = 0.4528;
    const isLojaExterior = (f: Fracao) => f.tipologia === "Loja Comercial" && (f.tipo_access || "").includes("Exterior");

    let permilagemLoja = 0;
    predioFracoes.forEach(f => {
      if (isLojaExterior(f)) permilagemLoja += f.permilagem;
    });
    const permilagemNormal = 1000 - permilagemLoja;
    const denominador = permilagemNormal + permilagemLoja * COEF_LOJA_EXTERIOR;
    const rateNormal = denominador > 0 ? orcamentoMensal / denominador : 0;
    const rateLoja = rateNormal * COEF_LOJA_EXTERIOR;

    const novosAvisos: Aviso[] = [];
    predioFracoes.forEach(f => {
      const orcamentoMensalProporcional = f.permilagem * (isLojaExterior(f) ? rateLoja : rateNormal);

      const valorOrdinario = Math.round((orcamentoMensalProporcional * 0.9) * 100) / 100;
      const valorFCR = Math.round((orcamentoMensalProporcional * 0.1) * 100) / 100;
      const valorTotal = Math.round((valorOrdinario + valorFCR) * 100) / 100;

      const idAviso = "av-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000);

      novosAvisos.push({
        id_aviso: idAviso,
        id_predio: predio.id_predio,
        id_fracao: f.id_fracao,
        tipo: "Cota Ordinária",
        data: dataDoc,
        vencimento,
        descricao: `Quota de Condomínio (Ordinária + Fundo de Reserva) - ${mes} / ${anoNum}`,
        valor: valorTotal,
        valor_fundo_reserva: valorFCR,
        estado: "Pendente",
        // Fotografia do proprietário no momento da emissão — se a fração
        // mudar de proprietário mais tarde, este aviso continua a mostrar
        // sempre quem o devia na altura, em vez do proprietário atual.
        proprietario_nome: f.proprietario?.nome,
        proprietario_nif: f.proprietario?.nif
      });
    });

    setAvisos([...avisos, ...novosAvisos]);
    saveAvisosToSupabase(novosAvisos).catch(console.error);
    registarLogAuditoria(
      "Financeira",
      `Emitiu ${novosAvisos.length} notas de cobrança (Quota + FCR juntos) - ${mes}/${anoNum}`,
      predio.id_predio,
      loggedUser
    );

    if (setDocumentos) {
      const novosDocs: Documento[] = novosAvisos.map(a => {
        const frac = fracoes.find(f => f.id_fracao === a.id_fracao);
        return {
          id_doc: "doc-nc-" + a.id_aviso,
          id_predio: predio.id_predio,
          nome: `Nota_Cobranca_${a.id_aviso.toUpperCase()}_Fracao_${frac?.fracao_nome || "A"}.pdf`,
          tipo: "Nota de Cobrança",
          data_upload: dataDoc,
          tamanho: "280 KB",
          categoria: "Pasta Paga. Quotas",
          sub_pasta: "Notas de cobrança",
          descricao: `Nota de cobrança para ${a.descricao} - Fração ${frac?.fracao_nome}`,
          visibilidade: "Público",
          autor: loggedUser.nome || "Administração",
          tema: "Pasta Paga. Quotas",
          ano: dataDoc.substring(0, 4),
          tipo_arquivo: "documento",
          relevancia_perfis: ["ADMIN", "EMPRESA_GESTORA", "USER", "CONTABILISTA"]
        };
      });
      setDocumentos(prev => [...prev, ...novosDocs]);
    }

    alert("Foram gerados e emitidos com sucesso os avisos de cobrança para todas as frações! Arquivados na Pasta Paga. Quotas.");
  };

  const abrirDocumento = (aviso: Aviso, tipoInicial: "RECIBO" | "NOTA_COBRANCA") => {
    const frac = fracoes.find(f => f.id_fracao === aviso.id_fracao);
    const codPostal = predio.codigo_postal;
    
    // Auto-generate receipt number
    const hash = aviso.id_aviso.toUpperCase();
    const nRec = formatQuotaReceiptNumber(hash.replace("AV-", ""));

    setSelectedAviso(aviso);
    setDocType(tipoInicial);
    setCustomIban(predio.iban || "PT50 0033 0000 12345678901 23");
    setCustomDataLimite(aviso.vencimento);
    setCustomDataPagamento(aviso.data);
    
    if (aviso.tipo.includes("Ordinária")) {
      setCustomQuotaMensal(aviso.valor);
      setCustomQuotaExtra(0);
    } else if (aviso.tipo.includes("Extraordinária") || aviso.tipo.includes("Extra")) {
      setCustomQuotaMensal(0);
      setCustomQuotaExtra(aviso.valor);
    } else {
      setCustomQuotaMensal(aviso.valor);
      setCustomQuotaExtra(0);
    }

    setCustomDescritivo(aviso.descricao);
    setCustomCondomino(frac?.proprietario?.nome || "Condómino Registado");
    setCustomNrecibo(nRec);
  };

  const abrirEdicaoAviso = (aviso: Aviso) => {
    setEditingAviso(aviso);
    setEditValorTotal(String(aviso.valor));
    setEditValorFCR(aviso.valor_fundo_reserva !== undefined ? String(aviso.valor_fundo_reserva) : "");
    setEditVencimento(aviso.vencimento);
    setEditDescricao(aviso.descricao);
  };

  const guardarEdicaoAviso = () => {
    if (!editingAviso) return;
    const novoValor = parseValorMonetario(editValorTotal);
    if (novoValor <= 0) return alert("Indique um valor total válido.");
    const novoValorFCR = editValorFCR ? parseValorMonetario(editValorFCR) : undefined;
    if (novoValorFCR !== undefined && novoValorFCR >= novoValor) {
      return alert("O valor do Fundo de Reserva tem de ser menor do que o valor total.");
    }

    const atualizacao: Partial<Aviso> = {
      valor: novoValor,
      valor_fundo_reserva: novoValorFCR,
      vencimento: editVencimento,
      descricao: editDescricao
    };
    setAvisos(prev => prev.map(a => a.id_aviso === editingAviso.id_aviso ? { ...a, ...atualizacao } : a));
    dbUpdate("avisos", { ...atualizacao, valor_fundo_reserva: novoValorFCR ?? null }, [["id_aviso", "eq", editingAviso.id_aviso]]).catch(console.error);
    registarLogAuditoria("Financeira", `Editou o aviso ${editingAviso.id_aviso}`, predio.id_predio, loggedUser, `Novo valor: ${novoValor.toFixed(2)}€`);
    setEditingAviso(null);
  };

  const eliminarAviso = (aviso: Aviso) => {
    if (aviso.id_movimento) {
      alert("Este aviso já tem um depósito real registado na Tesouraria — não pode ser eliminado. Se foi um erro, corrija o movimento diretamente em Movimentos & Tesouraria.");
      return;
    }
    if (!window.confirm(`Eliminar o aviso ${aviso.id_aviso.toUpperCase()} (${aviso.valor.toFixed(2)}€)? Esta ação não pode ser desfeita.`)) return;
    setAvisos(prev => prev.filter(a => a.id_aviso !== aviso.id_aviso));
    dbDelete("avisos", [["id_aviso", "eq", aviso.id_aviso]]).catch(console.error);
    registarLogAuditoria("Financeira", `Eliminou o aviso ${aviso.id_aviso}`, predio.id_predio, loggedUser, `${aviso.valor.toFixed(2)}€`);
  };

  const alterarEstadoAviso = (id: string, novoEstado: string) => {
    setAvisos(prev => prev.map(a => a.id_aviso === id ? { ...a, estado: novoEstado } : a));
    if (selectedAviso && selectedAviso.id_aviso === id) {
      setSelectedAviso(prev => prev ? { ...prev, estado: novoEstado } : null);
    }
    dbUpdate("avisos", { estado: novoEstado }, [["id_aviso", "eq", id]]).catch(console.error);
    registarLogAuditoria("Financeira", `Alterou o estado do aviso ${id} para "${novoEstado}"`, predio.id_predio, loggedUser);
  };

  // Regista o depósito real do condómino ao marcar um aviso como pago —
  // antes "Marcar Pago" só mudava um estado (sem criar nenhum movimento
  // bancário nem tocar no saldo de conta nenhuma), por isso o recibo gerado
  // mostrava referências de movimento (MOV-...) completamente fabricadas,
  // que não correspondiam a nada na Tesouraria. Agora cria um Movimento real
  // ligado à fração e à conta escolhida, e credita mesmo o saldo dessa conta.
  // O valor é editável em vez de assumir sempre o total — um condómino pode
  // pagar só parte do que deve agora e o resto mais tarde (ex: deve 600€,
  // paga 250€), e o aviso fica "Paga Parcialmente" com o saldo em aberto.
  const handleMarcarPagoComMovimento = async (aviso: Aviso, idConta: string, valorInformado: number) => {
    if (!idConta) {
      alert("Selecione a conta bancária onde o valor foi recebido antes de marcar como pago.");
      return;
    }
    const contaAlvo = contas.find(c => c.id_conta === idConta);
    if (!contaAlvo) {
      alert("Conta bancária inválida.");
      return;
    }
    const saldoDevedor = Math.round((aviso.valor - (aviso.valor_pago || 0)) * 100) / 100;
    if (valorInformado <= 0 || valorInformado > saldoDevedor + 0.01) {
      alert(`Indique um valor entre 0,01€ e o saldo em dívida (${saldoDevedor.toFixed(2)}€).`);
      return;
    }

    const frac = fracoes.find(f => f.id_fracao === aviso.id_fracao);
    const ehQuitacaoTotal = valorInformado >= saldoDevedor - 0.01;
    const novoMovimento: Movimento = {
      id_mov: "mov-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      id_predio: predio.id_predio,
      id_conta: idConta,
      id_fracao: aviso.id_fracao,
      data: customDataPagamento || new Date().toISOString().split("T")[0],
      tipo: "Receita",
      valor: valorInformado,
      descricao: `${aviso.tipo || "Quota"} — Fração ${frac?.fracao_nome || aviso.id_fracao} (Aviso ${aviso.id_aviso})${ehQuitacaoTotal ? "" : " (tranche)"}`,
      categoria: (aviso.tipo || "").toLowerCase().includes("extra") ? "Quota Extraordinária" : "Quota Mensal",
      estado: "Justificado",
      metodo_pagamento: "Transferência Bancária"
    };

    const contaAtualizada: Conta = { ...contaAlvo, saldo: (contaAlvo.saldo || 0) + valorInformado };
    setContas(prev => prev.map(c => c.id_conta === idConta ? contaAtualizada : c));
    saveContaToSupabase(contaAtualizada).catch(console.error);

    setMovements(prev => [novoMovimento, ...prev]);
    saveMovimentoToSupabase(novoMovimento).catch(console.error);

    const novoValorPago = Math.round(((aviso.valor_pago || 0) + valorInformado) * 100) / 100;
    const atualizacaoAviso = {
      // "avisos.estado" só aceita "Pendente"/"Pago" (check constraint) — um
      // pagamento parcial fica "Pendente" na mesma; valor_pago (abaixo) é
      // quem regista quanto já foi pago, sem precisar de um 3º estado.
      estado: ehQuitacaoTotal ? "Pago" : "Pendente",
      valor_pago: novoValorPago,
      id_movimento: novoMovimento.id_mov,
      id_conta: idConta
    };
    setAvisos(prev => prev.map(a => a.id_aviso === aviso.id_aviso ? { ...a, ...atualizacaoAviso } : a));
    if (selectedAviso && selectedAviso.id_aviso === aviso.id_aviso) {
      setSelectedAviso(prev => prev ? { ...prev, ...atualizacaoAviso } : null);
    }
    dbUpdate("avisos", atualizacaoAviso, [["id_aviso", "eq", aviso.id_aviso]]).catch(console.error);
    registarLogAuditoria(
      "Financeira",
      ehQuitacaoTotal ? `Liquidou o aviso ${aviso.id_aviso}` : `Registou um pagamento parcial do aviso ${aviso.id_aviso}`,
      predio.id_predio,
      loggedUser,
      `${valorInformado.toFixed(2)}€ via ${contaAlvo.banco}${ehQuitacaoTotal ? "" : ` — saldo em dívida: ${(saldoDevedor - valorInformado).toFixed(2)}€`}`
    );

    setARegistarPagamento(false);
    setPagamentoContaId("");
    setPagamentoValorInput("");
  };

  const fecharModal = () => {
    setSelectedAviso(null);
  };

  // Substitui a antiga dupla geração (preview HTML "no-print" reaberta numa
  // janela popup com uma tradução manual e incompleta de classes Tailwind
  // para CSS + o próprio botão de "Recibo A5" com dados por vezes simulados)
  // por UM único caminho real: o mesmo gerador jsPDF (generateOfficialReceiptPDF)
  // já usado pela emissão automática mensal (server/lib/cronService.js).
  // Isto resolve de uma vez: (1) o menu jurídico fabricado ("Autoridade
  // Digital de Lisboa" etc., que nunca existiu neste gerador), (2) a nota/
  // recibo a sair desconfigurada ao imprimir (um PDF real não tem risco de
  // quebra de página/CSS em falta), e (3) a Quota Mensal + Fundo de Reserva
  // deixam de sair em dois documentos separados — vêm sempre juntas no
  // mesmo PDF, com um total único, sempre que o aviso tiver valor_fundo_reserva.
  const handleDownloadDocumentoOficial = () => {
    if (!selectedAviso) return;
    const frac = fracoes.find(f => f.id_fracao === selectedAviso.id_fracao);
    const isExtra = selectedAviso.tipo.toLowerCase().includes("extra");
    const temFCR = typeof selectedAviso.valor_fundo_reserva === "number" && selectedAviso.valor_fundo_reserva > 0;

    const rubricas: import("../types").ReciboQuitacao["rubricas"] = [];
    if (temFCR) {
      const valorOrdinaria = Math.round((selectedAviso.valor - (selectedAviso.valor_fundo_reserva || 0)) * 100) / 100;
      rubricas.push({ descricao: "Quota de Condomínio Ordinária", valor: valorOrdinaria, tipo: "Quota Ordinária" });
      rubricas.push({ descricao: "Fundo Comum de Reserva (FCR)", valor: selectedAviso.valor_fundo_reserva || 0, tipo: "Fundo Comum de Reserva" });
    } else if (isExtra) {
      rubricas.push({ descricao: customDescritivo || selectedAviso.descricao, valor: selectedAviso.valor, tipo: "Quota Extraordinária" });
    } else {
      rubricas.push({ descricao: customDescritivo || selectedAviso.descricao, valor: selectedAviso.valor, tipo: "Quota Ordinária" });
    }

    const recNumStr = customNrecibo || formatQuotaReceiptNumber(selectedAviso.id_aviso.toUpperCase().replace("AV-", ""));
    const dtPag = customDataPagamento || selectedAviso.data || new Date().toISOString().split("T")[0];
    const dtEmissao = selectedAviso.data || dtPag;

    downloadOfficialReceiptPDF(
      {
        id_recibo: recNumStr,
        tipoDocumento: docType === "RECIBO" ? "recibo" : "nota_cobranca",
        numero_sequencial: 1,
        ano: Number(dtPag.substring(0, 4)) || new Date().getFullYear(),
        id_predio: predio.id_predio,
        id_fracao: selectedAviso.id_fracao,
        // Usa a "fotografia" gravada no aviso (proprietario_nome/nif), não o
        // proprietário ATUAL da fração — sem isto, reemitir o documento de
        // um aviso antigo depois de uma Transferência de Propriedade mudava
        // silenciosamente o nome do condómino para o novo proprietário.
        // Avisos anteriores a esta funcionalidade não têm o instantâneo
        // gravado, por isso caem para o proprietário atual como antes.
        nome_condomino: customCondomino || selectedAviso.proprietario_nome || frac?.proprietario?.nome || "Condómino Registado",
        nif_condomino: selectedAviso.proprietario_nif || frac?.proprietario?.nif || "",
        fracao_nome: frac?.fracao_nome || "",
        permilagem: frac?.permilagem || 0,
        data_emissao: dtEmissao,
        data_pagamento: dtPag,
        metodo_pagamento: "Transferência Bancária",
        valor_total: selectedAviso.valor,
        rubricas,
        iban_predio: customIban || escolherIbanContaPorTipo(contas, selectedAviso.tipo) || predio.iban || "",
        codigo_verificacao_hash: selectedAviso.id_aviso.toUpperCase(),
        emitido_por: loggedUser.nome || "Administração do Condomínio",
        adminNome: loggedUser.nome ? `${loggedUser.nome} (Administração)` : "Administração do Condomínio",
        adminSignatureBase64: localStorage.getItem("admin_signature_digital") || undefined
      },
      predio,
      frac
    );

    if (setDocumentos) {
      const isRecibo = docType === "RECIBO";
      setDocumentos(prev => [
        ...prev,
        {
          id_doc: "doc-" + (isRecibo ? "rec-" : "nc-") + Math.floor(10000 + Math.random() * 90000),
          id_predio: predio.id_predio,
          nome: `${isRecibo ? "Recibo" : "Nota_Cobranca"}_${recNumStr.replace(/[^a-zA-Z0-9_-]/g, "_")}_Fracao_${frac?.fracao_nome || "A"}.pdf`,
          tipo: isRecibo ? "Recibo" : "Nota de Cobrança",
          data_upload: dtPag,
          tamanho: "220 KB",
          categoria: "Pasta Paga. Quotas",
          sub_pasta: isRecibo ? "Recibos" : "Notas de cobrança",
          descricao: `${isRecibo ? "Recibo" : "Nota de cobrança"} nº ${recNumStr} - Fração ${frac?.fracao_nome || "A"} - ${customDescritivo || selectedAviso.descricao}`,
          visibilidade: "Público",
          autor: loggedUser.nome || "Administração",
          tema: "Pasta Paga. Quotas",
          ano: dtPag.substring(0, 4),
          tipo_arquivo: "documento",
          relevancia_perfis: ["ADMIN", "EMPRESA_GESTORA", "USER", "CONTABILISTA"]
        }
      ]);
    }
  };

  return (
    <div className="space-y-6">
      {(loggedUser.role === 'ADMIN' || loggedUser.role === 'EMPRESA_GESTORA') && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 no-print">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <i className="fa-solid fa-file-signature text-sm"></i>
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Adendas & Revisões ao Orçamento Anual</h3>
              <p className="text-xs text-slate-500">Regista uma revisão aprovada em assembleia a meio do ano (mantém o histórico do valor anterior, entra em vigor sozinha na data indicada).</p>
            </div>
          </div>

          {revisaoEmVigor && (
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-800">
              <strong>Em vigor desde {formatDatePT(revisaoEmVigor.data_vigencia)}:</strong> {revisaoEmVigor.valor.toFixed(2)} € /ano
              {revisaoEmVigor.aprovado_em_assembleia ? " (aprovado em assembleia)" : ""}
              {revisaoEmVigor.motivo ? ` — ${revisaoEmVigor.motivo}` : ""}
            </div>
          )}

          <form onSubmit={handleAddRevisaoOrcamento} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Novo Valor Anual (€) *</label>
              <input type="text" inputMode="decimal" value={novaRevisaoValor} onChange={e => setNovaRevisaoValor(e.target.value)} placeholder="Ex: 12000" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono" />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Vigência a partir de *</label>
              <input type="date" value={novaRevisaoData} onChange={e => setNovaRevisaoData(e.target.value)} className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Ata da Decisão</label>
              <select
                value={novaRevisaoAtaId}
                onChange={e => setNovaRevisaoAtaId(e.target.value)}
                className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white"
              >
                <option value="">— Sem ata associada —</option>
                {atasEmitidas.map(r => (
                  <option key={r.id_reuniao} value={r.id_reuniao}>
                    Ata {r.numero_ata || "s/nº"} — {r.tema} ({formatDatePT(r.data)})
                  </option>
                ))}
              </select>
              {atasEmitidas.length === 0 && (
                <span className="text-[10px] text-amber-600 mt-0.5">Nenhuma ata emitida ainda em Assembleias — pode continuar sem associar.</span>
              )}
              <input
                type="text"
                value={novaRevisaoMotivo}
                onChange={e => setNovaRevisaoMotivo(e.target.value)}
                placeholder="Nota adicional (opcional)"
                className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 mt-1.5"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                <input type="checkbox" checked={novaRevisaoAssembleia} onChange={e => setNovaRevisaoAssembleia(e.target.checked)} className="cursor-pointer" />
                Aprovado em assembleia
              </label>
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0">
                Registar Revisão
              </button>
            </div>
          </form>

          {revisoesOrcamento.length > 0 && (
            <div className="overflow-x-auto border border-slate-150 rounded-xl">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="p-2.5">Vigência</th>
                    <th className="p-2.5 text-right">Valor Anual</th>
                    <th className="p-2.5">Motivo</th>
                    <th className="p-2.5 text-center">Assembleia</th>
                    <th className="p-2.5 text-center">Estado</th>
                    <th className="p-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {revisoesOrcamento.map(r => (
                    <tr key={r.id_revisao} className={`border-b border-slate-100 hover:bg-slate-50/50 ${r.id_revisao === revisaoEmVigor?.id_revisao ? "bg-indigo-50/40" : ""}`}>
                      <td className="p-2.5 font-mono text-slate-600">{formatDatePT(r.data_vigencia)}</td>
                      <td className="p-2.5 text-right font-bold font-mono text-slate-800">{r.valor.toFixed(2)} €</td>
                      <td className="p-2.5 text-slate-500">{r.motivo || "—"}</td>
                      <td className="p-2.5 text-center">{r.aprovado_em_assembleia ? "✅" : "—"}</td>
                      <td className="p-2.5 text-center">
                        {r.id_revisao === revisaoEmVigor?.id_revisao ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold">Em Vigor</span>
                        ) : r.data_vigencia > new Date().toISOString().split("T")[0] ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold">Agendada</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold">Histórico</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right">
                        {loggedUser.role === "ADMIN" && (
                          <button onClick={() => handleRemoverRevisaoOrcamento(r)} className="text-slate-400 hover:text-red-500 cursor-pointer" title="Eliminar">
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {loggedUser.role === 'ADMIN' || loggedUser.role === 'EMPRESA_GESTORA' ? (
        <form onSubmit={gerarOrcamentoMensal} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 no-print">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <i className="fa-solid fa-calculator text-sm"></i>
            </span>
            <h3 className="text-sm font-bold text-slate-800">Calcular & Lançar Quotas Mensais (Notas de Cobrança)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Orçamento Geral Anual (€) *</label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={orcamentoAnual}
                onChange={e => setOrcamentoAnual(e.target.value)}
                placeholder="Ex: 5000"
                className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Mês de Emissão *</label>
              <select
                value={mes}
                onChange={e => setMes(e.target.value)}
                className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white"
              >
                <option value="Janeiro">Janeiro</option>
                <option value="Fevereiro">Fevereiro</option>
                <option value="Março">Março</option>
                <option value="Abril">Abril</option>
                <option value="Maio">Maio</option>
                <option value="Junho">Junho</option>
                <option value="Julho">Julho</option>
                <option value="Agosto">Agosto</option>
                <option value="Setembro">Setembro</option>
                <option value="Outubro">Outubro</option>
                <option value="Novembro">Novembro</option>
                <option value="Dezembro">Dezembro</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Ano de Emissão *</label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={anoEmissao}
                onChange={e => setAnoEmissao(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                placeholder={String(new Date().getFullYear())}
                className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono"
              />
            </div>
          </div>
          <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors cursor-pointer flex items-center space-x-2">
            <i className="fa-solid fa-paper-plane"></i>
            <span>Emitir Quotas em Lote Proporcional</span>
          </button>
        </form>
      ) : null}

      {/* Lista de Avisos de Cobrança Emitidos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Avisos de Cobrança Emitidos</h4>
          <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full">
            Total: {predioAvisos.length} docs
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <th className="p-3">Doc ID</th>
                <th className="p-3">Fração</th>
                <th className="p-3">Data</th>
                <th className="p-3">Vencimento</th>
                <th className="p-3">Descrição do Aviso</th>
                <th className="p-3">Tipo</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-center no-print">Gerar Docs</th>
              </tr>
            </thead>
            <tbody>
              {predioAvisos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-400 italic">
                    Nenhum aviso emitido para este condomínio.
                  </td>
                </tr>
              ) : (
                predioAvisos.map(a => {
                  const frac = fracoes.find(f => f.id_fracao === a.id_fracao);
                  return (
                    <tr key={a.id_aviso} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="p-3 font-mono text-indigo-600 font-bold">{a.id_aviso.toUpperCase()}</td>
                      <td className="p-3 font-bold text-slate-800">
                        Fração {frac?.fracao_nome || "?"} ({frac?.piso || "N/A"})
                      </td>
                      <td className="p-3 font-mono">{formatDatePT(a.data)}</td>
                      <td className="p-3 font-mono">{formatDatePT(a.vencimento)}</td>
                      <td className="p-3 text-slate-600">{a.descricao}</td>
                      <td className="p-3">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                          a.tipo === 'Cota Ordinária' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : a.tipo.includes('Extra') 
                            ? 'bg-amber-50 text-amber-700 border-amber-100' 
                            : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                        }`}>
                          {a.tipo}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold font-mono">{a.valor.toFixed(2)}€</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          a.estado === 'Pago'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : (a.valor_pago || 0) > 0
                            ? 'bg-sky-50 text-sky-700 border border-sky-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {a.estado === 'Pago' ? 'Pago' : (a.valor_pago || 0) > 0 ? 'Paga Parcialmente' : a.estado}
                        </span>
                      </td>
                      <td className="p-3 text-center no-print">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => abrirDocumento(a, "NOTA_COBRANCA")}
                            title="Nota de Cobrança"
                            className="p-1 px-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 text-slate-600 rounded text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            <i className="fa-solid fa-file-invoice mr-1"></i> Nota
                          </button>
                          <button
                            onClick={() => abrirDocumento(a, "RECIBO")}
                            title="Emitir Recibo Oficial"
                            className="p-1 px-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 border border-slate-200 text-slate-600 rounded text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            <i className="fa-solid fa-receipt mr-1"></i> Recibo
                          </button>
                          <button
                            onClick={() => abrirEdicaoAviso(a)}
                            title="Editar Aviso"
                            className="p-1 px-2 bg-slate-100 hover:bg-amber-50 hover:text-amber-600 border border-slate-200 text-slate-600 rounded text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          <button
                            onClick={() => eliminarAviso(a)}
                            title="Eliminar Aviso"
                            className="p-1 px-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 border border-slate-200 text-slate-600 rounded text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DOCUMENT GENERATOR MODAL */}
      {selectedAviso && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto no-print">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl w-full max-w-5xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row h-[90vh] max-h-[800px] overflow-hidden">
            
            {/* Left sidebar: Editor / Adjustments */}
            <div className="w-full md:w-80 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between overflow-y-auto shrink-0">
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Editor do Documento</h3>
                  <button 
                    onClick={fecharModal}
                    className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tipo de Documento</label>
                  <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-slate-100 dark:bg-slate-900 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setDocType("NOTA_COBRANCA")}
                      className={`py-1 text-[10px] font-bold rounded-md transition-all ${
                        docType === "NOTA_COBRANCA" 
                          ? "bg-indigo-600 text-white shadow" 
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Nota Cobrança
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocType("RECIBO")}
                      className={`py-1 text-[10px] font-bold rounded-md transition-all ${
                        docType === "RECIBO" 
                          ? "bg-emerald-600 text-white shadow" 
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Recibo Pago
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Condómino / Proprietário</label>
                  <input
                    type="text"
                    value={customCondomino}
                    onChange={e => setCustomCondomino(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2.5 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Descritivo Oficial</label>
                  <textarea
                    rows={2}
                    value={customDescritivo}
                    onChange={e => setCustomDescritivo(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs p-2.5 rounded-lg focus:outline-indigo-500 dark:text-white font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Quota Mensal (€)</label>
                    <MoneyInput
                      value={customQuotaMensal}
                      onChange={setCustomQuotaMensal}
                      className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Quota Extra (€)</label>
                    <MoneyInput
                      value={customQuotaExtra}
                      onChange={setCustomQuotaExtra}
                      className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">IBAN do Prédio</label>
                  <input
                    type="text"
                    value={customIban}
                    onChange={e => setCustomIban(e.target.value)}
                    placeholder={selectedAviso ? `Automático: ${escolherIbanContaPorTipo(contas, selectedAviso.tipo) || predio.iban || "—"}` : "Automático conforme o tipo de aviso"}
                    className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2.5 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white font-mono"
                  />
                </div>

                {docType === "RECIBO" ? (
                  <div className="grid grid-cols-1 gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Data de Liquidação</label>
                      <input
                        type="date"
                        value={customDataPagamento}
                        onChange={e => setCustomDataPagamento(e.target.value)}
                        className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nº Recibo</label>
                      <input
                        type="text"
                        value={customNrecibo}
                        onChange={e => setCustomNrecibo(e.target.value)}
                        className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2.5 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Data Limite de Pagamento</label>
                    <input
                      type="date"
                      value={customDataLimite}
                      onChange={e => setCustomDataLimite(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs px-2 py-1.5 rounded-lg focus:outline-indigo-500 dark:text-white"
                    />
                  </div>
                )}

                <div className="space-y-1 pt-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Estado do Aviso Global</label>
                  <div className="flex space-x-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedAviso.id_movimento && !confirm("Este aviso já tem um depósito real registado na Tesouraria. Marcar como Pendente NÃO apaga esse movimento nem o saldo já creditado — se foi um erro, corrija/elimine o movimento diretamente em Movimentos & Tesouraria. Continuar?")) {
                          return;
                        }
                        setARegistarPagamento(false);
                        alterarEstadoAviso(selectedAviso.id_aviso, "Pendente");
                      }}
                      className={`flex-1 py-1 text-[9px] font-extrabold rounded-md border ${
                        selectedAviso.estado === "Pendente"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-slate-50 border-slate-200 text-slate-400"
                      }`}
                    >
                      Marcar Pendente
                    </button>
                    <button
                      type="button"
                      disabled={selectedAviso.estado === "Pago"}
                      onClick={() => {
                        const saldoDevedor = Math.round((selectedAviso.valor - (selectedAviso.valor_pago || 0)) * 100) / 100;
                        setPagamentoValorInput(saldoDevedor.toFixed(2).replace(".", ","));
                        setARegistarPagamento(true);
                      }}
                      className={`flex-1 py-1 text-[9px] font-extrabold rounded-md border disabled:cursor-not-allowed ${
                        selectedAviso.estado === "Pago"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "bg-slate-50 border-slate-200 text-slate-400"
                      }`}
                    >
                      Marcar Pago
                    </button>
                  </div>
                  {selectedAviso.estado === "Pago" && selectedAviso.id_movimento && (
                    <p className="text-[9px] text-emerald-600 dark:text-emerald-400 pt-0.5">
                      <i className="fa-solid fa-check-circle mr-1"></i>Depósito registado na Tesouraria ({movements.find(m => m.id_mov === selectedAviso.id_movimento)?.categoria || "Movimento"})
                    </p>
                  )}
                  {selectedAviso.estado === "Pendente" && (selectedAviso.valor_pago || 0) > 0 && (
                    <p className="text-[9px] text-amber-600 dark:text-amber-400 pt-0.5">
                      <i className="fa-solid fa-hourglass-half mr-1"></i>Pago {((selectedAviso.valor_pago || 0)).toFixed(2)}€ de {selectedAviso.valor.toFixed(2)}€ — falta {(selectedAviso.valor - (selectedAviso.valor_pago || 0)).toFixed(2)}€
                    </p>
                  )}

                  {aRegistarPagamento && (
                    <div className="mt-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-lg space-y-2">
                      <label className="text-[9px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">Conta Bancária de Entrada *</label>
                      <select
                        value={pagamentoContaId}
                        onChange={e => setPagamentoContaId(e.target.value)}
                        className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] px-2 py-1.5 rounded-lg focus:outline-emerald-500 dark:text-white"
                      >
                        <option value="">Selecione a conta...</option>
                        {predioContas.map(c => (
                          <option key={c.id_conta} value={c.id_conta}>{c.banco} ({c.tipo}) - Saldo: {c.saldo?.toFixed(2)}€</option>
                        ))}
                      </select>
                      <label className="text-[9px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                        Valor Recebido Agora (€) * — em dívida: {(selectedAviso.valor - (selectedAviso.valor_pago || 0)).toFixed(2)}€
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={pagamentoValorInput}
                        onChange={e => setPagamentoValorInput(e.target.value)}
                        placeholder="0,00"
                        className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] px-2 py-1.5 rounded-lg focus:outline-emerald-500 dark:text-white"
                      />
                      <p className="text-[8px] text-emerald-700 dark:text-emerald-400">
                        Pode indicar um valor inferior ao total em dívida para registar um pagamento parcial (o aviso fica "Paga Parcialmente" até liquidar o resto).
                      </p>
                      <div className="flex space-x-1.5">
                        <button
                          type="button"
                          onClick={() => { setARegistarPagamento(false); setPagamentoContaId(""); setPagamentoValorInput(""); }}
                          className="flex-1 py-1 text-[9px] font-extrabold rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarcarPagoComMovimento(selectedAviso, pagamentoContaId, parseValorMonetario(pagamentoValorInput))}
                          className="flex-1 py-1 text-[9px] font-extrabold rounded-md border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Confirmar Recebimento
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                <button
                  type="button"
                  onClick={handleDownloadDocumentoOficial}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-md"
                >
                  <i className="fa-solid fa-file-pdf"></i>
                  <span>Descarregar PDF Oficial (A5)</span>
                </button>
                <button
                  type="button"
                  onClick={fecharModal}
                  className="w-full bg-slate-100 text-slate-600 font-bold py-2 rounded-xl text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Voltar à Lista
                </button>
              </div>
            </div>

            {/* Right side: resumo honesto dos dados — o documento oficial real
                (com marca de água, numeração, assinatura) é gerado em PDF
                real via handleDownloadDocumentoOficial (jsPDF, o mesmo motor
                usado pela emissão automática mensal). Antes havia aqui uma
                pré-visualização em HTML com texto jurídico fabricado
                ("Autoridade Digital de Lisboa", "Assinatura Certificada",
                um NIF e morada inventados) e sujeita a quebras de página ao
                imprimir — removida por completo. */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-900/40 p-6 md:p-10 overflow-y-auto flex flex-col items-center">
              <div className="w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-5">
                <div className="text-center space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pré-visualização de Dados</p>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase">
                    {docType === "RECIBO" ? `Recibo Nº ${customNrecibo}` : "Nota de Cobrança"}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Fração {fracoes.find(f => f.id_fracao === selectedAviso.id_fracao)?.fracao_nome || "?"} — {customCondomino}
                  </p>
                </div>

                <div className="space-y-2">
                  {(() => {
                    const temFCR = typeof selectedAviso.valor_fundo_reserva === "number" && (selectedAviso.valor_fundo_reserva || 0) > 0;
                    const isExtra = selectedAviso.tipo.toLowerCase().includes("extra");
                    const linhas: { label: string; valor: number }[] = temFCR
                      ? [
                          { label: "Quota de Condomínio Ordinária", valor: Math.round((selectedAviso.valor - (selectedAviso.valor_fundo_reserva || 0)) * 100) / 100 },
                          { label: "Fundo Comum de Reserva (FCR)", valor: selectedAviso.valor_fundo_reserva || 0 }
                        ]
                      : [{ label: isExtra ? "Quota Extraordinária" : "Quota de Condomínio", valor: selectedAviso.valor }];
                    return linhas.map((l, i) => (
                      <div key={i} className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 dark:text-slate-300">{l.label}</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-white">{l.valor.toFixed(2)} €</span>
                      </div>
                    ));
                  })()}
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">Total</span>
                  <span className="font-mono font-black text-emerald-600 text-base">{selectedAviso.valor.toFixed(2)} €</span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg p-3 text-[10px] text-slate-500 dark:text-slate-400 space-y-1">
                  <p><strong className="text-slate-700 dark:text-slate-300">Emissão:</strong> {formatDatePT(selectedAviso.data)}</p>
                  <p><strong className="text-slate-700 dark:text-slate-300">{docType === "RECIBO" ? "Data de Liquidação" : "Limite de Pagamento"}:</strong> {formatDatePT(docType === "RECIBO" ? customDataPagamento : customDataLimite)}</p>
                  <p><strong className="text-slate-700 dark:text-slate-300">IBAN:</strong> {customIban || escolherIbanContaPorTipo(contas, selectedAviso.tipo) || predio.iban || "—"}</p>
                </div>

                <p className="text-[9px] text-slate-400 text-center leading-relaxed">
                  Isto é apenas um resumo dos dados. O documento oficial (PDF em A5, com marca de água, numeração e assinatura da administração) é gerado no botão "Descarregar PDF Oficial" ao lado.
                </p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal: Editar Aviso */}
      {editingAviso && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="text-sm font-bold">Editar Aviso {editingAviso.id_aviso.toUpperCase()}</h3>
              <button onClick={() => setEditingAviso(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Descrição</label>
                <input
                  type="text"
                  value={editDescricao}
                  onChange={e => setEditDescricao(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Valor Total (€) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editValorTotal}
                    onChange={e => setEditValorTotal(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Fundo de Reserva (€)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Sem FCR"
                    value={editValorFCR}
                    onChange={e => setEditValorFCR(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Vencimento</label>
                <input
                  type="date"
                  value={editVencimento}
                  onChange={e => setEditVencimento(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg text-xs"
                />
              </div>
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAviso(null)}
                  className="flex-1 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardarEdicaoAviso}
                  className="flex-1 py-2 text-xs font-bold rounded-lg border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
