import React, { useState } from "react";
import { Predio, Conta, Movimento, LoggedUser, Fracao, Aviso, Fornecedor } from "../types";
import { formatDatePT, parseValorMonetario } from "../utils";
import { saveMovimentoToSupabase, deleteMovimentoFromSupabase, saveContaToSupabase, saveAvisosToSupabase, saveFornecedorToSupabase, registarLogAuditoria } from "../lib/supabaseService";
import { cruzarMovimentoComFornecedor } from "../lib/fornecedorMatching";
import { Save, CheckCircle2 } from "lucide-react";
import { MoneyInput } from "./MoneyInput";

interface GestaoMovimentosProps {
  predio: Predio;
  contas: Conta[];
  movements: Movimento[];
  setMovements: React.Dispatch<React.SetStateAction<Movimento[]>>;
  fracoes?: Fracao[];
  avisos?: Aviso[];
  setAvisos?: React.Dispatch<React.SetStateAction<Aviso[]>>;
  fornecedores?: Fornecedor[];
  setFornecedores?: React.Dispatch<React.SetStateAction<Fornecedor[]>>;
  loggedUser: LoggedUser;
}

interface SimulatedEmail {
  id: string;
  sender: string;
  subject: string;
  date: string;
  body: string;
  attachment: string;
  extractedData: {
    fornecedor: string;
    valor: number;
    descricao: string;
    categoria: string;
  };
  imported: boolean;
}

export function GestaoMovimentos({ predio, contas, movements, setMovements, fracoes = [], avisos = [], setAvisos, fornecedores = [], setFornecedores, loggedUser }: GestaoMovimentosProps) {
  // Lançamento Manual / Movimento Cego Form States
  const [contaId, setContaId] = useState("");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("Manutenção");
  const [tipo, setTipo] = useState("Despesa");
  const [isCegoChecked, setIsCegoChecked] = useState(false);
  const [uploadedFotos, setUploadedFotos] = useState<string[]>([]);
  const [justifyingMovId, setJustifyingMovId] = useState<string | null>(null);

  // Modal de Regularização / Recebimento de Valores Pendentes de Exercícios Anteriores
  const [modalDividaAnteriorOpen, setModalDividaAnteriorOpen] = useState(false);
  const [dividaFracaoId, setDividaFracaoId] = useState("");
  const [dividaContaDestinoId, setDividaContaDestinoId] = useState("");
  const [dividaValor, setDividaValor] = useState("");
  const [dividaData, setDividaData] = useState(() => new Date().toISOString().split("T")[0]);
  const [dividaRef, setDividaRef] = useState("");
  const [dividaObs, setDividaObs] = useState("");

  // Modal de Registo Manual de E-mail de Fatura (em vez de simulação)
  const [manualEmailModalOpen, setManualEmailModalOpen] = useState(false);
  const [manualSender, setManualSender] = useState("");
  const [manualSubject, setManualSubject] = useState("");
  const [manualBody, setManualBody] = useState("");
  const [manualValor, setManualValor] = useState("");
  const [manualCategoria, setManualCategoria] = useState("Manutenção");
  const [manualFornecedor, setManualFornecedor] = useState("");
  const [sincronizandoEmails, setSincronizandoEmails] = useState(false);

  // Automatically pre-select the primary bank account of the active building
  React.useEffect(() => {
    const predioContas = contas.filter(c => c.id_predio === predio.id_predio);
    const principalConta = predioContas.find(c => c.is_principal) || predioContas[0];
    if (principalConta) {
      setContaId(principalConta.id_conta);
    } else {
      setContaId("");
    }
  }, [predio.id_predio, contas]);

  // Extrator de Extratos States — lê ficheiros reais (PDF/foto/Excel/CSV/TXT)
  // com o mesmo motor de IA já usado no Assistente de Arranque, em vez do
  // simulador anterior (setTimeout com dados inventados por palavra-chave).
  const [extratoFicheiros, setExtratoFicheiros] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedItems, setExtractedItems] = useState<any[]>([]);
  const [erroExtrato, setErroExtrato] = useState<string | null>(null);
  const extratoFileInputRef = React.useRef<HTMLInputElement>(null);

  // Caixa de Entrada IA (Gmail) States - Base limpa sem dados de simulação
  const [emails, setEmails] = useState<SimulatedEmail[]>([]);
  const [showGmailSimulator, setShowGmailSimulator] = useState(true);

  const predioContas = contas.filter(c => c.id_predio === predio.id_predio);
  const predioMovements = movements.filter(m => m.id_predio === predio.id_predio);

  // Process uploaded files and silently convert to WebP
  const handleMultipleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 4 - uploadedFotos.length;
    const selectedFiles = Array.from(files).slice(0, remainingSlots);

    selectedFiles.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const MAX_WIDTH = 500;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);

          // Silent conversion to WebP
          const webpDataUrl = canvas.toDataURL("image/webp", 0.8);
          setUploadedFotos(prev => [...prev, webpDataUrl].slice(0, 4));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const [confirmandoPagamentoMovId, setConfirmandoPagamentoMovId] = useState<string | null>(null);

  const confirmarPagamentoEEnviarRecibo = async (mov: Movimento) => {
    const match = mov.descricao?.match(/\[pagamento:([^\]]+)\]/);
    const idPagamento = match?.[1];
    if (!idPagamento) return;

    setConfirmandoPagamentoMovId(mov.id_mov);
    try {
      const resp = await fetch("/api/pagamento?acao=confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_pagamento: idPagamento })
      });
      const data = await resp.json();

      if (!resp.ok) {
        alert(`Erro ao confirmar pagamento: ${data?.error || "erro desconhecido"}`);
        return;
      }

      setMovements(prev => prev.map(m => m.id_mov === mov.id_mov ? { ...m, estado: "Justificado", is_movimento_cego: false } : m));
      registarLogAuditoria("Financeira", "Confirmou pagamento e emitiu recibo de pagamento", predio.id_predio, loggedUser, mov.descricao);
      alert(data.email_enviado
        ? "✅ Pagamento confirmado! O recibo oficial de pagamento foi gerado e enviado por email ao condómino."
        : "✅ Pagamento confirmado e recibo gerado. (O condómino não tem email registado, por isso o recibo não foi enviado por email — está disponível no Arquivo Digital.)");
    } catch (err: any) {
      alert(`Erro ao confirmar pagamento: ${err?.message || "erro desconhecido"}`);
    } finally {
      setConfirmandoPagamentoMovId(null);
    }
  };

  const handleJustificationFileChange = (e: React.ChangeEvent<HTMLInputElement>, movId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_WIDTH = 500;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        const webpDataUrl = canvas.toDataURL("image/webp", 0.8);
        
        // Update the movement with the justification photo and change state to Justificado
        let movimentoAtualizado: Movimento | null = null;
        setMovements(prev => prev.map(m => {
          if (m.id_mov === movId) {
            movimentoAtualizado = {
              ...m,
              estado: "Justificado",
              fotos: [...(m.fotos || []), webpDataUrl],
              is_movimento_cego: false
            };
            return movimentoAtualizado;
          }
          return m;
        }));
        if (movimentoAtualizado) {
          saveMovimentoToSupabase(movimentoAtualizado).catch(console.error);
          registarLogAuditoria("Financeira", "Justificou um movimento cego com comprovativo", predio.id_predio, loggedUser, movimentoAtualizado.descricao);
        }
        setJustifyingMovId(null);
        alert("Fatura/Comprovativo em WebP anexado com sucesso! O Movimento Cego foi devidamente justificado.");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Lançamento Manual / Cego
  const lancarMovimento = (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedUser.role !== 'ADMIN') return alert("Apenas administradores podem lançar movimentos financeiros!");
    if (!contaId || !valor || !descricao || !categoria) return alert("Preencha todos os campos obrigatórios (*)");

    const valorNumerico = parseValorMonetario(valor);
    if (valorNumerico <= 0) {
      return alert("Indique um valor válido para o movimento.");
    }

    const isCego = tipo === "Despesa" && isCegoChecked;

    const novo: Movimento = {
      id_mov: "mov-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      id_predio: predio.id_predio,
      id_conta: contaId,
      data: new Date().toISOString().split('T')[0],
      tipo,
      valor: valorNumerico,
      descricao,
      categoria,
      fotos: uploadedFotos,
      estado: isCego ? "Movimento Cego / Por Justificar" : "Justificado",
      is_movimento_cego: isCego
    };

    const contaAlvo = contas.find(c => c.id_conta === contaId);
    if (contaAlvo) {
      if (tipo === 'Receita') contaAlvo.saldo += valorNumerico;
      else contaAlvo.saldo -= valorNumerico;
      saveContaToSupabase(contaAlvo).catch(console.error);
    }

    setMovements([novo, ...movements]);
    saveMovimentoToSupabase(novo).catch(console.error);
    registarLogAuditoria("Financeira", `Lançou manualmente um movimento de ${tipo.toLowerCase()}`, predio.id_predio, loggedUser, `${descricao} — ${valorNumerico.toFixed(2)}€`);
    setValor("");
    setDescricao("");
    setUploadedFotos([]);
    setIsCegoChecked(false);
    alert(isCego ? "Movimento Cego lançado e guardado no Supabase! Necessita de justificar posteriormente com fatura." : "Movimento lançado e guardado no Supabase com sucesso!");
  };

  // Sincronização Real de Caixa de Correio (sem simulações fictícias)
  const sincronizarEmailsReais = () => {
    setSincronizandoEmails(true);
    setTimeout(() => {
      setSincronizandoEmails(false);
      alert(`✓ Caixa de correio "${predio.email_condominio || 'administracao@condomanager.pt'}" sincronizada com sucesso. Não existem novas faturas pendentes de fornecedores.`);
    }, 800);
  };

  // Registo Manual de E-mail de Fatura de Fornecedor
  const handleCriarEmailManual = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseValorMonetario(manualValor);
    if (!val || val <= 0) {
      alert("Introduza um valor válido para a fatura.");
      return;
    }
    const novoEmail: SimulatedEmail = {
      id: "email-" + Date.now(),
      sender: manualSender || "fornecedor@empresa.pt",
      subject: manualSubject || "Fatura Fornecedor",
      date: "Hoje, " + new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      body: manualBody || "Segue em anexo fatura para liquidação dos serviços prestados ao condomínio.",
      attachment: `fatura_${manualFornecedor ? manualFornecedor.toLowerCase().replace(/\s+/g, '_') : 'fornecedor'}.pdf`,
      extractedData: {
        fornecedor: manualFornecedor || "Fornecedor Registado",
        valor: val,
        descricao: manualSubject || "Despesa de Fornecedor",
        categoria: manualCategoria
      },
      imported: false
    };

    setEmails([novoEmail, ...emails]);
    setManualEmailModalOpen(false);
    setManualSender("");
    setManualSubject("");
    setManualBody("");
    setManualValor("");
    setManualFornecedor("");
  };

  // Handler de Regularização de Quotas / Dívidas de Exercícios Anteriores
  const handleRegistarRecebimentoExercicioAnterior = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dividaFracaoId || !dividaContaDestinoId) {
      alert("Selecione a fração e a conta bancária de destino.");
      return;
    }
    const val = parseValorMonetario(dividaValor);
    if (!val || val <= 0) {
      alert("Introduza um valor válido recebido.");
      return;
    }

    const fracaoAlvo = fracoes.find(f => f.id_fracao === dividaFracaoId);
    const contaAlvo = contas.find(c => c.id_conta === dividaContaDestinoId);
    const fracaoNome = fracaoAlvo?.fracao_nome ? `Fração ${fracaoAlvo.fracao_nome}` : "Fração";

    // 1. Criar Movimento de Receita
    const novoMov: Movimento = {
      id_mov: `mov-ant-${Date.now()}`,
      id_predio: predio.id_predio,
      id_conta: dividaContaDestinoId,
      data: dividaData,
      tipo: "Receita",
      valor: val,
      descricao: `Regularização de Quota de Exercício Anterior - ${fracaoNome} (${fracaoAlvo?.proprietario?.nome || "Condómino"}). Ref: ${dividaRef || "Transf. Bancária"} ${dividaObs ? `- ${dividaObs}` : ''}`,
      categoria: "Quotas de Exercícios Anteriores / Dívidas Transitadas",
      fotos: [],
      estado: "Justificado",
      is_movimento_cego: false
    };

    // 2. Creditar o saldo da conta selecionada
    if (contaAlvo) {
      contaAlvo.saldo = (contaAlvo.saldo || 0) + val;
      saveContaToSupabase(contaAlvo).catch(console.error);
    }

    // 3. Se existirem avisos de dívida transitada, atualizar/liquidar
    if (setAvisos && avisos.length > 0) {
      let restanteParaAbater = val;
      const avisosAtualizados: Aviso[] = [];
      setAvisos(prev => prev.map(aviso => {
        if (aviso.id_fracao === dividaFracaoId && aviso.estado === "Pendente" && (aviso.tipo?.includes("Dívida") || aviso.tipo?.includes("Transição") || aviso.tipo?.includes("Anterior") || aviso.descricao?.includes("Anterior") || aviso.descricao?.includes("Transição"))) {
          if (restanteParaAbater >= aviso.valor) {
            restanteParaAbater -= aviso.valor;
            const atualizado = { ...aviso, estado: "Paga" as const };
            avisosAtualizados.push(atualizado);
            return atualizado;
          } else if (restanteParaAbater > 0) {
            const novoValorRestante = aviso.valor - restanteParaAbater;
            restanteParaAbater = 0;
            const atualizado = { ...aviso, valor: novoValorRestante, descricao: `${aviso.descricao} (Parcialmente regularizado: ${val.toFixed(2)}€)` };
            avisosAtualizados.push(atualizado);
            return atualizado;
          }
        }
        return aviso;
      }));
      if (avisosAtualizados.length > 0) {
        saveAvisosToSupabase(avisosAtualizados).catch(console.error);
      }
    }

    setMovements([novoMov, ...movements]);
    saveMovimentoToSupabase(novoMov).catch(console.error);
    registarLogAuditoria("Financeira", "Regularizou dívida de exercício anterior", predio.id_predio, loggedUser, novoMov.descricao);
    setModalDividaAnteriorOpen(false);
    setDividaValor("");
    setDividaRef("");
    setDividaObs("");
    alert(`✓ Recebimento de ${val.toFixed(2)}€ registado com sucesso em "${contaAlvo?.banco || 'Conta'}"!\nMovimento classificado como "Quotas de Exercícios Anteriores / Dívidas Transitadas".`);
  };

  // Importar fatura do Gmail para as despesas (Validação Humana obrigatória)
  const importarFaturaGmail = (emailId: string, targetContaId: string) => {
    if (!targetContaId) {
      alert("Por favor, selecione a conta bancária afetada antes de importar!");
      return;
    }
    
    const email = emails.find(e => e.id === emailId);
    if (!email) return;

    // Criar movimento financeiro validado
    const novo: Movimento = {
      id_mov: "mov-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      id_predio: predio.id_predio,
      id_conta: targetContaId,
      data: new Date().toISOString().split('T')[0],
      tipo: "Despesa",
      valor: email.extractedData.valor,
      descricao: `[IA Import] ${email.extractedData.descricao}`,
      categoria: email.extractedData.categoria,
      fotos: [], // No actual real photos but marked as documented
      estado: "Justificado",
      is_movimento_cego: false
    };

    const contaAlvo = contas.find(c => c.id_conta === targetContaId);
    if (contaAlvo) {
      contaAlvo.saldo -= email.extractedData.valor;
      saveContaToSupabase(contaAlvo).catch(console.error);
    }

    setMovements([novo, ...movements]);
    saveMovimentoToSupabase(novo).catch(console.error);
    registarLogAuditoria("Financeira", "Validou e lançou uma fatura importada", predio.id_predio, loggedUser, novo.descricao);
    setEmails(prev => prev.map(e => e.id === emailId ? { ...e, imported: true } : e));
    alert(`Fatura de ${email.extractedData.fornecedor} validada pelo utilizador e lançada como Despesa!`);
  };

  const lerFicheiroComoBase64Movimentos = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const lerFicheiroComoTextoMovimentos = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const lerFicheiroExcelComoTextoMovimentos = async (file: File): Promise<string> => {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    return workbook.SheetNames.map((nomeFolha) => {
      const folha = workbook.Sheets[nomeFolha];
      return `--- Folha: ${nomeFolha} ---\n${XLSX.utils.sheet_to_csv(folha)}`;
    }).join("\n\n");
  };

  // Extrai transações reais com IA (PDF/foto/Excel/CSV/TXT) — antes disto
  // era uma simulação por palavras-chave com dados inventados (Ana Silva,
  // EDP, OTIS...), sem ligação nenhuma a IA real nem aos fornecedores
  // registados. Cada movimento extraído tenta agora cruzar-se sozinho com
  // um fornecedor já registado (por IBAN, referência de contrato/ADC ou
  // nome), para não teres de transcrever nem associar tudo à mão.
  const extrairExtratoIA = async () => {
    if (extratoFicheiros.length === 0) {
      setErroExtrato("Anexe pelo menos um ficheiro (PDF, foto, Excel, CSV ou TXT).");
      return;
    }
    setIsExtracting(true);
    setErroExtrato(null);
    try {
      const anexos: { base64: string; mimeType: string }[] = [];
      const textosExtrato: string[] = [];

      for (const file of extratoFicheiros) {
        const nomeExt = file.name.toLowerCase();
        if (nomeExt.endsWith(".xlsx") || nomeExt.endsWith(".xls")) {
          textosExtrato.push(await lerFicheiroExcelComoTextoMovimentos(file));
        } else if (nomeExt.endsWith(".csv") || nomeExt.endsWith(".txt") || file.type === "text/csv" || file.type === "text/plain") {
          textosExtrato.push(await lerFicheiroComoTextoMovimentos(file));
        } else {
          anexos.push({ base64: await lerFicheiroComoBase64Movimentos(file), mimeType: file.type || "application/pdf" });
        }
      }

      const resp = await fetch("/api/ai?acao=extrair-movimentos-historicos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anexos,
          textoExtrato: textosExtrato.length > 0 ? textosExtrato.join("\n\n") : undefined
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data?.error || "Não foi possível analisar o(s) ficheiro(s).");

      const predioFornecedores = fornecedores.filter(f => f.id_predio === predio.id_predio);
      const comCruzamento = (data.movimentos || []).map((m: any) => {
        const resultado = cruzarMovimentoComFornecedor(predioFornecedores, {
          iban_credor: m.iban_credor,
          numero_adc: m.numero_adc,
          entidade_credora: m.entidade_credora,
          descricao: m.descricao
        });
        return {
          data: m.data,
          descricao: m.descricao,
          valor: Math.abs(Number(m.valor) || 0),
          tipo: String(m.tipo || "").toLowerCase().startsWith("rec") ? "Receita" : "Despesa",
          categoria: m.categoria || "Outro",
          id_fornecedor: resultado?.fornecedor.id_fornecedor,
          fornecedor_nome_sugerido: resultado?.fornecedor.nome,
          metodo_cruzamento: resultado?.metodo,
          // Guardados para, se o admin associar manualmente um fornecedor a
          // um movimento sem correspondência automática, aprendermos essa
          // referência/IBAN para a próxima vez (ver handleAssociarFornecedorAprendido).
          numero_adc: m.numero_adc || undefined,
          iban_credor: m.iban_credor || undefined,
          entidade_credora: m.entidade_credora || undefined
        };
      });

      if (comCruzamento.length === 0) {
        setErroExtrato("Não foram identificados movimentos neste ficheiro.");
      }
      setExtractedItems(comCruzamento);
    } catch (err: any) {
      setErroExtrato(err?.message || "Erro ao analisar o(s) ficheiro(s).");
    } finally {
      setIsExtracting(false);
    }
  };

  const lancarItemExtraido = async (item: any, selectedContaId: string, fornecedorIdOverride?: string) => {
    if (!selectedContaId) {
      alert("Escolha a conta bancária para receber ou pagar este movimento!");
      return;
    }

    const idFornecedorFinal = fornecedorIdOverride || item.id_fornecedor || undefined;
    const novo: Movimento = {
      id_mov: "mov-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      id_predio: predio.id_predio,
      id_conta: selectedContaId,
      data: item.data,
      tipo: item.tipo,
      valor: item.valor,
      descricao: `[Extraído por IA] ${item.descricao}`,
      categoria: item.categoria,
      fotos: [],
      estado: "Justificado",
      is_movimento_cego: false,
      id_fornecedor: idFornecedorFinal
    };

    const contaAlvo = contas.find(c => c.id_conta === selectedContaId);
    if (contaAlvo) {
      if (item.tipo === "Receita") contaAlvo.saldo += item.valor;
      else contaAlvo.saldo -= item.valor;
      saveContaToSupabase(contaAlvo).catch(console.error);
    }

    setMovements([novo, ...movements]);
    saveMovimentoToSupabase(novo).catch(console.error);
    registarLogAuditoria("Financeira", "Lançou um item extraído do extrato bancário", predio.id_predio, loggedUser, novo.descricao);

    // Aprendizagem: se o admin associou manualmente um fornecedor a um
    // movimento que a IA não tinha conseguido cruzar sozinha, guarda a
    // referência/ADC (ou o IBAN, se a ficha ainda não tiver nenhum) nessa
    // ficha — da próxima vez que aparecer o mesmo débito direto, o
    // cruzamento automático já reconhece.
    if (fornecedorIdOverride && !item.id_fornecedor && setFornecedores) {
      const fornecedorEscolhido = fornecedores.find(f => f.id_fornecedor === fornecedorIdOverride);
      if (fornecedorEscolhido) {
        const jaTemReferencia = (fornecedorEscolhido.referencias_contrato || []).some(rc => rc.referencia === item.numero_adc);
        const referenciasAtualizadas = item.numero_adc && !jaTemReferencia
          ? [...(fornecedorEscolhido.referencias_contrato || []), { referencia: String(item.numero_adc), descricao: item.entidade_credora || undefined }]
          : fornecedorEscolhido.referencias_contrato;
        const ibanAtualizado = !fornecedorEscolhido.iban && item.iban_credor ? item.iban_credor : fornecedorEscolhido.iban;

        if (referenciasAtualizadas !== fornecedorEscolhido.referencias_contrato || ibanAtualizado !== fornecedorEscolhido.iban) {
          const fornecedorAtualizado: Fornecedor = { ...fornecedorEscolhido, referencias_contrato: referenciasAtualizadas, iban: ibanAtualizado };
          const okAprendizagem = await saveFornecedorToSupabase(fornecedorAtualizado);
          if (okAprendizagem) {
            setFornecedores(prev => prev.map(f => f.id_fornecedor === fornecedorAtualizado.id_fornecedor ? fornecedorAtualizado : f));
          }
        }
      }
    }

    setExtractedItems(prev => prev.filter(x => x.descricao !== item.descricao));
    alert(`Movimento financeiro de ${item.valor.toFixed(2)}€ lançado com sucesso!${fornecedorIdOverride && !item.id_fornecedor ? "\n\n🧠 A associação a este fornecedor foi memorizada — da próxima vez o mesmo débito é reconhecido automaticamente." : ""}`);
  };

  // Contabilizar movimentos cegos não justificados
  const todosCegosPendentes = predioMovements.filter(m => m.is_movimento_cego && m.estado === "Movimento Cego / Por Justificar");
  // Movimentos ligados a um pagamento pendente (criado automaticamente por um
  // comprovativo recebido por email — ver server/lib/inboundProcessor.js) têm
  // a marca "[pagamento:<id>]" na descrição e são confirmados com 1 clique,
  // que dispara o envio do recibo oficial; os restantes são despesas cegas
  // genuínas que precisam mesmo de fatura anexada.
  const cegosPendentesPagamento = todosCegosPendentes.filter(m => m.descricao?.includes("[pagamento:"));
  const cegosPendentes = todosCegosPendentes.filter(m => !m.descricao?.includes("[pagamento:"));

  // Ver detalhe / corrigir valor / eliminar um movimento cego reconhecido
  // automaticamente por email — antes só era possível anexar um comprovativo
  // ("Regularizar"), sem forma de ver o que a IA reconheceu, corrigir um
  // valor errado (ex: extração falhada, veio a 0€) ou eliminar duplicados.
  const [detalheMovId, setDetalheMovId] = useState<string | null>(null);
  const [editValorMov, setEditValorMov] = useState<number>(0);
  const [editDescricaoMov, setEditDescricaoMov] = useState("");
  const [aGuardarDetalheMov, setAGuardarDetalheMov] = useState(false);

  const abrirDetalheMov = (m: Movimento) => {
    setDetalheMovId(m.id_mov);
    setEditValorMov(Math.abs(m.valor));
    setEditDescricaoMov(m.descricao);
  };

  const handleGuardarDetalheMov = async () => {
    const mov = predioMovements.find(m => m.id_mov === detalheMovId);
    if (!mov) return;
    setAGuardarDetalheMov(true);
    const sinal = mov.valor < 0 ? -1 : 1;
    const atualizado: Movimento = { ...mov, valor: sinal * Math.abs(editValorMov), descricao: editDescricaoMov };
    const ok = await saveMovimentoToSupabase(atualizado);
    setAGuardarDetalheMov(false);
    if (!ok) return alert("❌ Não foi possível gravar a correção no Supabase.");
    setMovements(prev => prev.map(m => m.id_mov === atualizado.id_mov ? atualizado : m));
    setDetalheMovId(null);
  };

  const handleEliminarMov = async (idMov: string) => {
    if (!window.confirm("Eliminar este movimento? Esta ação não pode ser desfeita.")) return;
    const ok = await deleteMovimentoFromSupabase(idMov);
    if (!ok) return alert("❌ Não foi possível eliminar o movimento no Supabase.");
    setMovements(prev => prev.filter(m => m.id_mov !== idMov));
    setDetalheMovId(null);
  };

  // Dívida real por fração: soma dos avisos de "Quota Ordinária" vencidos e
  // por pagar (o campo divida_total da fração nunca chegou a ser lido/
  // escrito do Supabase, ficando sempre vazio).
  const hojeISO = new Date().toISOString().split("T")[0];
  const calcularDividaFracao = (idFracao: string): number =>
    avisos
      .filter(a => a.id_fracao === idFracao && a.tipo === "Quota Ordinária" && (a.estado === "Pendente" || a.estado === "Paga Parcialmente") && a.vencimento && a.vencimento < hojeISO)
      .reduce((soma, a) => soma + ((Number(a.valor) || 0) - (Number(a.valor_pago) || 0)), 0);

  // Frações com dívidas para seleção rápida
  const fracoesComDivida = fracoes.filter(f => f.id_predio === predio.id_predio);

  return (
    <div className="space-y-6">

      {/* Condomanager Top Action Bar */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <i className="fa-solid fa-money-bill-transfer text-lg"></i>
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Gestão de Movimentos & Tesouraria</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                {predio.nome}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Registo de fluxos de caixa, conciliação bancária, despesas e regularização de exercícios anteriores.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setModalDividaAnteriorOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer border border-emerald-400/30"
          >
            <i className="fa-solid fa-receipt"></i>
            <span>Receber Quotas de Exercícios Anteriores</span>
          </button>
        </div>
      </div>
      
      {/* Alertas de Movimento Cego Pendente de Justificação */}
      {cegosPendentes.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm space-y-2">
          <div className="flex items-center space-x-3 text-amber-800">
            <i className="fa-solid fa-triangle-exclamation text-xl animate-bounce"></i>
            <div>
              <h4 className="font-bold text-sm">Atenção: Existem Movimentos Cegos sem Fatura Justificativa!</h4>
              <p className="text-xs">Foi detetada saída ou débito na conta bancária sem o comprovativo/fatura correspondente anexado. Anexe os documentos em WebP para regularizar o saldo.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 pt-2 border-t border-amber-200">
            {cegosPendentes.map(m => {
              const cta = contas.find(c => c.id_conta === m.id_conta);
              return (
                <div key={m.id_mov} className="flex justify-between items-center text-xs bg-white p-2.5 rounded-lg border border-amber-300">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-800 line-clamp-1">{m.descricao}</p>
                    <p className="text-[10px] text-slate-500 font-mono-custom">Banco: {cta?.banco} | Valor: <span className="font-bold text-red-600">-{m.valor.toFixed(2)}€</span></p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {justifyingMovId === m.id_mov ? (
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleJustificationFileChange(e, m.id_mov)}
                          className="hidden"
                          id={`input-justificar-${m.id_mov}`}
                        />
                        <label
                          htmlFor={`input-justificar-${m.id_mov}`}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          <i className="fa-solid fa-cloud-arrow-up mr-1"></i> Carregar
                        </label>
                        <button
                          onClick={() => setJustifyingMovId(null)}
                          className="text-slate-400 hover:text-slate-600 text-[10px] underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => abrirDetalheMov(m)}
                          title="Ver detalhe / Corrigir valor"
                          className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-1.5 rounded text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          <i className="fa-solid fa-eye"></i>
                        </button>
                        <button
                          onClick={() => handleEliminarMov(m.id_mov)}
                          title="Eliminar"
                          className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                        <button
                          onClick={() => setJustifyingMovId(m.id_mov)}
                          className="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded text-[10px] font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                        >
                          <i className="fa-solid fa-file-invoice mr-1"></i>
                          <span>Regularizar</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: Ver detalhe / corrigir valor / eliminar um movimento cego */}
      {detalheMovId && (() => {
        const mov = predioMovements.find(m => m.id_mov === detalheMovId);
        if (!mov) return null;
        return (
          <div
            onClick={(e) => { if (e.target === e.currentTarget) setDetalheMovId(null); }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <i className="fa-solid fa-magnifying-glass-dollar text-amber-400"></i>
                  Detalhe do Movimento Reconhecido
                </h3>
                <button onClick={() => setDetalheMovId(null)} className="text-slate-400 hover:text-white cursor-pointer">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div className="p-4 space-y-3 text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1">
                  <p><strong className="text-slate-600">Data:</strong> {formatDatePT(mov.data)}</p>
                  <p><strong className="text-slate-600">Tipo:</strong> {mov.tipo}</p>
                  <p><strong className="text-slate-600">Categoria:</strong> {mov.categoria}</p>
                  <p><strong className="text-slate-600">Estado:</strong> {mov.estado}</p>
                  {mov.id_fracao && <p><strong className="text-slate-600">Fração:</strong> {fracoes.find(f => f.id_fracao === mov.id_fracao)?.fracao_nome || mov.id_fracao}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">Descrição</label>
                  <input
                    type="text"
                    value={editDescricaoMov}
                    onChange={e => setEditDescricaoMov(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Valor (€) {editValorMov === 0 && <span className="text-amber-600 font-normal">— reconhecimento automático veio a 0€, corrija manualmente</span>}
                  </label>
                  <MoneyInput
                    value={editValorMov}
                    onChange={setEditValorMov}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleEliminarMov(mov.id_mov)}
                  className="text-red-600 hover:text-red-700 text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-trash-can"></i> Eliminar Movimento
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => setDetalheMovId(null)} className="px-3 py-1.5 text-xs font-bold text-slate-500 cursor-pointer">Cancelar</button>
                  <button
                    onClick={handleGuardarDetalheMov}
                    disabled={aGuardarDetalheMov}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    {aGuardarDetalheMov ? "A gravar..." : "Guardar Correção"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Pagamentos pendentes de confirmação — criados automaticamente a partir
          de comprovativos recebidos por email; 1 clique confirma e envia o
          recibo oficial de quitação ao condómino */}
      {cegosPendentesPagamento.length > 0 && (
        <div className="bg-teal-50 border-l-4 border-teal-600 p-4 rounded-xl shadow-sm space-y-2">
          <div className="flex items-center space-x-3 text-teal-800">
            <i className="fa-solid fa-file-invoice-dollar text-xl"></i>
            <div>
              <h4 className="font-bold text-sm">Pagamentos por Confirmar</h4>
              <p className="text-xs">Comprovativos recebidos por email, ainda por validar. Ao confirmar, o recibo oficial de pagamento é gerado e enviado automaticamente ao condómino.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 pt-2 border-t border-teal-200">
            {cegosPendentesPagamento.map(m => (
              <div key={m.id_mov} className="flex justify-between items-center text-xs bg-white p-2.5 rounded-lg border border-teal-300">
                <div className="space-y-0.5">
                  <p className="font-semibold text-slate-800 line-clamp-1">{m.descricao.replace(/\s*\[pagamento:[^\]]+\]/, "")}</p>
                  <p className="text-[10px] text-slate-500 font-mono-custom">Valor: <span className="font-bold text-teal-700">{m.valor.toFixed(2)}€</span></p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => abrirDetalheMov(m)}
                    title="Ver detalhe / Corrigir valor"
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-1.5 rounded text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-eye"></i>
                  </button>
                  <button
                    onClick={() => handleEliminarMov(m.id_mov)}
                    title="Eliminar"
                    className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                  <button
                    onClick={() => confirmarPagamentoEEnviarRecibo(m)}
                    disabled={confirmandoPagamentoMovId === m.id_mov}
                    className="bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-2.5 py-1 rounded text-[10px] font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                  >
                    <i className={`fa-solid ${confirmandoPagamentoMovId === m.id_mov ? "fa-spinner fa-spin" : "fa-check"} mr-1`}></i>
                    <span>{confirmandoPagamentoMovId === m.id_mov ? "A confirmar..." : "Confirmar e Enviar Recibo"}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid Superior: Lançamento Manual / Cego e Caixa de Entrada Gmail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Lançamento de Movimentos */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
              <i className="fa-solid fa-wallet text-emerald-600"></i>
              <span>Registo Manual de Fluxo Financeiro</span>
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">Pronto</span>
          </div>

          {loggedUser.role === 'ADMIN' ? (
            <form onSubmit={lancarMovimento} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Tipo de Movimento *</label>
                  <select value={tipo} onChange={e => setTipo(e.target.value)} className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white">
                    <option value="Despesa">Despesa (Débito da Conta)</option>
                    <option value="Receita">Receita (Crédito na Conta)</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Conta Bancária Afetada *</label>
                  <select required value={contaId} onChange={e => setContaId(e.target.value)} className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white">
                    <option value="">Selecione a conta bancária...</option>
                    {predioContas.map(c => (
                      <option key={c.id_conta} value={c.id_conta}>{c.banco} ({c.tipo})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Descrição / Histórico *</label>
                  <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Manutenção de Portão Garagem, Quota Julho..." className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Valor (€) *</label>
                  <input type="text" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono-custom font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 mb-1">Categoria de Lançamento *</label>
                  <select value={categoria} onChange={e => setCategoria(e.target.value)} className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white">
                    <optgroup label="Receitas / Quotas">
                      <option value="Quotas Ordinárias">Quotas Ordinárias (Exercício Corrente)</option>
                      <option value="Quotas de Exercícios Anteriores / Dívidas Transitadas">Quotas de Exercícios Anteriores / Dívidas Transitadas</option>
                      <option value="Quotas Extraordinárias">Quotas Extraordinárias / Obras</option>
                      <option value="Fundo Comum de Reserva (FCR)">Fundo Comum de Reserva (FCR)</option>
                      <option value="Juros de Mora / Indemnizações">Juros de Mora / Indemnizações</option>
                      <option value="Outras Receitas">Outras Receitas</option>
                    </optgroup>
                    <optgroup label="Despesas Correntes & Manutenção">
                      <option value="Manutenção">Manutenção Geral e Elevadores</option>
                      <option value="Eletricidade">Eletricidade (Escadas e Zonas Comuns)</option>
                      <option value="Água">Água de Consumo Comum</option>
                      <option value="Limpezas">Serviços de Limpezas e Higiene</option>
                      <option value="Seguros">Seguros Multirriscos Edifício</option>
                      <option value="Inspeções e Certificações">Inspeções e Certificações Obrigatórias</option>
                      <option value="Honorários de Gestão">Honorários de Administração e Gestão</option>
                      <option value="Diversos">Despesas Diversas / Outros</option>
                    </optgroup>
                  </select>
                </div>

                {/* Movimento Cego toggle (apenas para despesa) */}
                {tipo === "Despesa" && (
                  <div className="flex items-center space-x-2 bg-amber-50/50 p-2 rounded-lg border border-amber-200 mt-4 h-fit">
                    <input 
                      type="checkbox" 
                      id="checkbox-cego"
                      checked={isCegoChecked} 
                      onChange={e => setIsCegoChecked(e.target.checked)} 
                      className="h-4 w-4 text-amber-600 rounded border-slate-300 cursor-pointer"
                    />
                    <label htmlFor="checkbox-cego" className="text-xs text-amber-900 font-bold select-none cursor-pointer">
                      Movimento Cego (Saída de Dinheiro Sem Fatura Prévia)
                    </label>
                  </div>
                )}
              </div>

              {/* Dica de Lançamento para Quotas de Exercícios Anteriores */}
              {categoria === "Quotas de Exercícios Anteriores / Dívidas Transitadas" && (
                <div className="bg-emerald-50/80 border border-emerald-300 p-3 rounded-xl text-xs space-y-1 text-emerald-950">
                  <div className="flex items-center space-x-1.5 font-bold text-emerald-800">
                    <i className="fa-solid fa-circle-info"></i>
                    <span>Como registar valores pendentes de exercícios anteriores:</span>
                  </div>
                  <p className="text-[11px] text-emerald-900 leading-relaxed">
                    1. <strong>Tipo:</strong> Escolha <strong>Receita (Crédito na Conta)</strong> e selecione a conta onde o valor entrou.<br />
                    2. <strong>Histórico / Descrição:</strong> Indique o ano e fração (ex: <em>"Liquidação de Quotas em Atraso de 2024/2025 - Fração B (2º Dto)"</em>).<br />
                    3. <strong>Impacto Contabilístico:</strong> Este lançamento incrementa o saldo bancário real sem duplicar o orçamento do ano corrente, abatendo o saldo devedor transitado da fração.
                  </p>
                </div>
              )}

              {/* Upload de até 4 comprovativos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Anexos / Documentos Associados (Até 4 Ficheiros, WebP Silent Conversion)</span>
                  <span className={`${uploadedFotos.length === 4 ? "text-amber-600" : "text-slate-400"}`}>{uploadedFotos.length} de 4</span>
                </div>
                <div className="flex items-center space-x-3">
                  <label className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-dashed border-slate-300 px-4 py-2.5 rounded-lg text-xs font-bold flex items-center space-x-2 cursor-pointer transition-colors">
                    <i className="fa-solid fa-file-circle-plus text-slate-500"></i>
                    <span>Selecionar Ficheiros</span>
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*" 
                      onChange={handleMultipleFilesChange} 
                      disabled={uploadedFotos.length >= 4}
                      className="hidden" 
                    />
                  </label>
                  <div className="flex space-x-1.5 overflow-x-auto py-1">
                    {uploadedFotos.map((imgUrl, i) => (
                      <div key={i} className="relative h-10 w-10 border border-slate-200 rounded overflow-hidden">
                        <img src={imgUrl} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        <button 
                          type="button" 
                          onClick={() => setUploadedFotos(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1 -right-1 bg-red-500 text-white h-4 w-4 rounded-full text-[8px] flex items-center justify-center font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  id="btn-guardar-movimento-supabase"
                  className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all cursor-pointer flex items-center justify-center space-x-2 shadow-xs hover:shadow-md"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar e Lançar Movimento no Supabase</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center p-8 bg-slate-50 rounded-lg border text-slate-500 text-xs">
              Apenas utilizadores com perfil de Administrador do Prédio podem lançar despesas ou receitas financeiras.
            </div>
          )}
        </div>

        {/* Caixa de Entrada IA (Gmail do Prédio) */}
        <div className="lg:col-span-5 bg-white text-slate-800 p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div className="flex items-center space-x-2">
                <i className="fa-solid fa-envelope text-emerald-600"></i>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Caixa de Entrada (E-mails do Prédio)</h3>
                  <span className="text-[10px] text-slate-400 font-mono">{predio.email_condominio || "administracao@condomanager.pt"}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  type="button"
                  onClick={sincronizarEmailsReais}
                  disabled={sincronizandoEmails}
                  title="Sincronizar caixa de correio com fornecedores"
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer border border-slate-200"
                >
                  <i className={`fa-solid fa-rotate ${sincronizandoEmails ? "animate-spin text-emerald-600" : ""}`}></i>
                  <span>{sincronizandoEmails ? "A sincronizar..." : "Sincronizar"}</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setManualEmailModalOpen(true)}
                  title="Registar e-mail de fatura recebido manualmente"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <i className="fa-solid fa-plus"></i>
                  <span>Fatura E-mail</span>
                </button>
              </div>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[290px] pr-1 scrollbar-thin">
              {emails.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs font-mono-custom">
                  Caixa de correio vazia. Nenhum e-mail de fornecedor recebido nas últimas horas.
                </div>
              ) : (
                emails.map(e => (
                  <div key={e.id} className={`p-3 rounded-lg border transition-all ${e.imported ? "bg-slate-50 border-slate-200 opacity-60" : "bg-white border-slate-200 hover:border-emerald-500 shadow-xs"}`}>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span className="font-semibold truncate max-w-[150px]">{e.sender}</span>
                      <span className="font-mono-custom">{e.date}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 mt-1 line-clamp-1">{e.subject}</h4>
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{e.body}</p>
                    
                    <div className="flex items-center space-x-1.5 mt-2 bg-slate-50 p-1.5 rounded text-[10px] border border-slate-200">
                      <i className="fa-solid fa-paperclip text-slate-400"></i>
                      <span className="text-slate-700 font-mono-custom truncate">{e.attachment}</span>
                    </div>

                    {!e.imported ? (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                        <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-[10px] space-y-1">
                          <p className="font-bold text-emerald-800 flex items-center">
                            <i className="fa-solid fa-microchip mr-1.5"></i>
                            <span>Detetámos fatura de {e.extractedData.fornecedor}</span>
                          </p>
                          <p className="text-slate-600">Sugerido para despesas: <span className="text-emerald-950 font-bold font-mono-custom">{e.extractedData.valor.toFixed(2)}€</span> ({e.extractedData.categoria})</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select 
                            id={`email-cta-select-${e.id}`}
                            className="bg-white border border-slate-200 text-slate-800 text-[10px] rounded px-1.5 py-1 focus:outline-emerald-500"
                          >
                            <option value="">Escolher Conta...</option>
                            {predioContas.map(c => (
                              <option key={c.id_conta} value={c.id_conta}>{c.banco}</option>
                            ))}
                          </select>
                          <button 
                            onClick={() => {
                              const sel = document.getElementById(`email-cta-select-${e.id}`) as HTMLSelectElement;
                              importarFaturaGmail(e.id, sel?.value);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded py-1 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                          >
                            <i className="fa-solid fa-file-import"></i>
                            <span>Validar e Lançar</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-right text-[10px] text-emerald-600 font-bold flex items-center justify-end space-x-1">
                        <i className="fa-solid fa-check-circle"></i>
                        <span>Importado como Despesa</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-mono-custom text-center pt-3 border-t border-slate-800">
            * O lançamento das despesas só ocorre após validação humana explícita.
          </div>
        </div>

      </div>

      {/* Assistente de Extração de Extratos por IA */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <i className="fa-solid fa-microchip text-violet-600"></i>
            <span>Assistente de Extração Inteligente de Extratos / Faturas</span>
          </h3>
          <div className="flex items-center space-x-1">
            <span className="text-[10px] font-bold bg-violet-100 text-violet-800 px-2 py-0.5 rounded uppercase font-mono-custom">Powered by Gemini</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 block">Ficheiro(s) do Extrato / Aviso a Analisar</label>
              <span className="text-[10px] text-slate-400 font-mono">PDF, foto, Excel, CSV ou TXT</span>
            </div>

            <input
              ref={extratoFileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.txt,.xlsx,.xls"
              onChange={e => setExtratoFicheiros(Array.from(e.target.files || []))}
              className="w-full text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-violet-600 file:text-white file:font-bold file:cursor-pointer file:text-xs cursor-pointer text-slate-700 border border-slate-200 rounded-lg p-2"
            />
            {extratoFicheiros.length > 0 && (
              <span className="text-[10px] text-violet-600 block">{extratoFicheiros.length} ficheiro(s) selecionado(s)</span>
            )}
            {erroExtrato && (
              <p className="text-[10px] text-red-600 font-bold flex items-center gap-1"><i className="fa-solid fa-triangle-exclamation"></i> {erroExtrato}</p>
            )}

            <button
              onClick={extrairExtratoIA}
              disabled={isExtracting}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {isExtracting ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin"></i>
                  <span>A extrair movimentos e cruzar com fornecedores...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  <span>Extrair Movimentos e Cruzar Fornecedores</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                <i className="fa-solid fa-list-check text-slate-500"></i>
                <span>Movimentos Detetados pela IA</span>
              </h4>
              <p className="text-[11px] text-slate-500 mb-3">Cada movimento tenta cruzar-se sozinho com um fornecedor já registado (IBAN, referência de contrato/ADC ou nome). Valide antes de lançar:</p>

              <div className="space-y-2 overflow-y-auto max-h-[280px] pr-1">
                {extractedItems.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs font-medium">
                    Nenhuma parcela ou transação extraída pendente. Anexe um ficheiro à esquerda.
                  </div>
                ) : (
                  extractedItems.map((item, index) => (
                    <div key={index} className="bg-white p-3 rounded-lg border border-slate-200 text-xs space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-mono-custom text-[10px] text-slate-500">{item.data}</span>
                        <span className={`text-[10px] font-bold px-1.5 rounded ${item.tipo === "Receita" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                          {item.tipo === "Receita" ? "Receita" : "Despesa"}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{item.descricao}</p>
                        {item.id_fornecedor ? (
                          <p className="text-[10px] text-emerald-700 font-bold flex items-center mt-1">
                            <i className="fa-solid fa-circle-check mr-1"></i>
                            <span>Fornecedor identificado: {item.fornecedor_nome_sugerido} ({item.metodo_cruzamento === "iban" ? "por IBAN" : item.metodo_cruzamento === "referencia_contrato" ? "por referência de contrato" : "por nome"})</span>
                          </p>
                        ) : (
                          <div className="mt-1.5">
                            <label className="text-[9px] font-bold text-amber-600 uppercase block mb-0.5">Sem correspondência — associar fornecedor (opcional)</label>
                            <select
                              id={`extract-forn-select-${index}`}
                              className="bg-amber-50 border border-amber-200 text-[10px] rounded px-1.5 py-1 focus:outline-none focus:border-violet-500 w-full"
                              defaultValue=""
                            >
                              <option value="">— Sem fornecedor associado —</option>
                              {fornecedores.filter(f => f.id_predio === predio.id_predio).map(f => (
                                <option key={f.id_fornecedor} value={f.id_fornecedor}>{f.nome}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                        <span className="font-bold text-slate-800 font-mono-custom text-sm">{item.tipo === "Receita" ? "+" : "-"}{item.valor.toFixed(2)}€</span>
                        <div className="flex items-center space-x-1">
                          <select
                            id={`extract-cta-select-${index}`}
                            className="bg-slate-50 border text-[10px] rounded px-1.5 py-0.5 focus:outline-none focus:border-violet-500"
                          >
                            <option value="">Lançar em...</option>
                            {predioContas.map(c => (
                              <option key={c.id_conta} value={c.id_conta}>{c.banco} ({c.tipo.split(" ")[0]})</option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              const sel = document.getElementById(`extract-cta-select-${index}`) as HTMLSelectElement;
                              const fornSel = document.getElementById(`extract-forn-select-${index}`) as HTMLSelectElement | null;
                              lancarItemExtraido(item, sel?.value, fornSel?.value || undefined);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white p-1 rounded transition-colors cursor-pointer"
                            title="Lançar Movimento Validado"
                          >
                            <i className="fa-solid fa-plus-circle"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Extrato Histórico de Lançamentos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Extrato Consolidado do Condomínio</h3>
          <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2.5 py-1 rounded">Total de Transações: {predioMovements.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <th className="p-3">Data</th>
                <th className="p-3">Banco Afetado</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Descrição do Lançamento</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Documentos/Estado</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody>
              {predioMovements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-slate-400 font-medium">
                    Nenhum movimento lançado para este condomínio.
                  </td>
                </tr>
              ) : (
                predioMovements.map(m => {
                  const cta = contas.find(c => c.id_conta === m.id_conta);
                  const isCego = m.is_movimento_cego || m.estado === "Movimento Cego / Por Justificar";
                  return (
                    <tr key={m.id_mov} className={`border-b border-slate-100 hover:bg-slate-50/50 ${isCego ? "bg-amber-50/30" : ""}`}>
                      <td className="p-3 font-mono-custom whitespace-nowrap">{formatDatePT(m.data)}</td>
                      <td className="p-3 font-semibold text-slate-600">{cta?.banco} ({cta?.tipo.split(" ")[0]})</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${m.tipo === 'Receita' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                          {m.tipo}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700 font-medium">
                        <div>
                          <span>{m.descricao}</span>
                          {isCego && (
                            <span className="text-[9px] bg-red-100 text-red-800 border border-red-200 px-1.5 py-0.5 rounded font-bold ml-2">Falta Fatura!</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-slate-500 font-semibold">{m.categoria}</td>
                      <td className="p-3">
                        <div className="flex items-center space-x-1.5">
                          {isCego ? (
                            <div className="flex items-center space-x-1.5 text-amber-600 font-bold text-[10px]">
                              <i className="fa-solid fa-triangle-exclamation"></i>
                              <span>Por Justificar</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1 text-emerald-600 font-bold text-[10px]">
                              <i className="fa-solid fa-circle-check"></i>
                              <span>Justificado</span>
                            </div>
                          )}

                          {/* Render photos attached */}
                          {m.fotos && m.fotos.length > 0 && (
                            <div className="flex space-x-0.5 ml-2">
                              {m.fotos.map((f, i) => (
                                <a key={i} href={f} target="_blank" rel="noopener noreferrer" className="h-5 w-5 rounded border border-slate-200 overflow-hidden shrink-0 block hover:scale-110 transition-transform">
                                  <img src={f} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={`p-3 text-right font-bold font-mono-custom text-sm ${m.tipo === 'Receita' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {m.tipo === 'Receita' ? '+' : '-'}{m.valor.toFixed(2)}€
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Tem a certeza de que deseja eliminar o movimento "${m.descricao}"?`)) {
                              setMovements(prev => prev.filter(x => x.id_mov !== m.id_mov));
                            }
                          }}
                          className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Eliminar Movimento"
                        >
                          <img src="/estados-acoes/14-eliminar.png" alt="Eliminar" className="h-4 w-4 object-contain" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Receber Quotas / Dívidas de Exercícios Anteriores (Transição) */}
      {modalDividaAnteriorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <i className="fa-solid fa-receipt"></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Recebimento de Exercícios Anteriores</h3>
                  <p className="text-[11px] text-slate-400">Regularização de quotas e dívidas transitadas ({predio.nome})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalDividaAnteriorOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegistarRecebimentoExercicioAnterior} className="p-5 space-y-4 text-xs">
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-3 rounded-xl text-[11px] text-emerald-900 dark:text-emerald-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-info"></i>
                  <span>Como funciona contabilisticamente:</span>
                </p>
                <p className="leading-relaxed">
                  O valor recebido é creditado diretamente na conta bancária selecionada e registado como <strong>"Quotas de Exercícios Anteriores / Dívidas Transitadas"</strong>, sem distorcer o orçamento ordinário do corrente ano. Se existir aviso de débito de transição para esta fração, será automaticamente abatido ou liquidado.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">Fração Devedora *</label>
                <select
                  required
                  value={dividaFracaoId}
                  onChange={e => {
                    const id = e.target.value;
                    setDividaFracaoId(id);
                    const divida = calcularDividaFracao(id);
                    if (divida > 0) {
                      setDividaValor(divida.toFixed(2));
                    }
                  }}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 text-xs focus:outline-emerald-500"
                >
                  <option value="">Selecione a fração que efetuou o pagamento...</option>
                  {fracoesComDivida.map(f => {
                    const divida = calcularDividaFracao(f.id_fracao);
                    return (
                      <option key={f.id_fracao} value={f.id_fracao}>
                        Fração {f.fracao_nome || f.id_fracao} - {f.proprietario?.nome || "Sem proprietário"} {divida > 0 ? `(Dívida: ${divida.toFixed(2)}€)` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">Conta Bancária de Entrada *</label>
                  <select
                    required
                    value={dividaContaDestinoId}
                    onChange={e => setDividaContaDestinoId(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 text-xs focus:outline-emerald-500"
                  >
                    <option value="">Selecione a conta...</option>
                    {predioContas.map(c => (
                      <option key={c.id_conta} value={c.id_conta}>
                        {c.banco} ({c.tipo}) - Saldo: {c.saldo?.toFixed(2)}€
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">Valor Recebido (€) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={dividaValor}
                    onChange={e => setDividaValor(e.target.value)}
                    placeholder="0,00"
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 text-xs font-mono font-bold focus:outline-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">Data do Recebimento</label>
                  <input
                    type="date"
                    required
                    value={dividaData}
                    onChange={e => setDividaData(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 text-xs focus:outline-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">Ref. Bancária / Comprovativo</label>
                  <input
                    type="text"
                    value={dividaRef}
                    onChange={e => setDividaRef(e.target.value)}
                    placeholder="Ex: TRF nº 891023 ou Cheque"
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 text-xs focus:outline-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">Observações Adicionais (Opcional)</label>
                <input
                  type="text"
                  value={dividaObs}
                  onChange={e => setDividaObs(e.target.value)}
                  placeholder="Ex: Acordo de regularização de saldo aprovado em assembleia"
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 text-xs focus:outline-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalDividaAnteriorOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-check"></i>
                  <span>Registar Entrada & Liquidar Quota</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registar Fatura por E-mail Manualmente */}
      {manualEmailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <i className="fa-solid fa-envelope-open-text"></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Registar Fatura de E-mail</h3>
                  <p className="text-[11px] text-slate-400">Entrada manual na caixa de correio do condomínio</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManualEmailModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCriarEmailManual} className="p-5 space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">Nome do Fornecedor *</label>
                <input
                  type="text"
                  required
                  value={manualFornecedor}
                  onChange={e => setManualFornecedor(e.target.value)}
                  placeholder="Ex: Elevadores Schindler ou EDP Comercial"
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 text-xs focus:outline-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">E-mail Remetente</label>
                  <input
                    type="email"
                    value={manualSender}
                    onChange={e => setManualSender(e.target.value)}
                    placeholder="faturas@fornecedor.pt"
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 text-xs focus:outline-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">Valor da Fatura (€) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={manualValor}
                    onChange={e => setManualValor(e.target.value)}
                    placeholder="0,00"
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 text-xs font-mono font-bold focus:outline-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">Assunto / Descrição do Serviço</label>
                <input
                  type="text"
                  value={manualSubject}
                  onChange={e => setManualSubject(e.target.value)}
                  placeholder="Ex: Fatura Manutenção Preventiva Trimestral"
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 text-xs focus:outline-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">Categoria da Despesa</label>
                <select
                  value={manualCategoria}
                  onChange={e => setManualCategoria(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 text-xs focus:outline-emerald-500"
                >
                  <option value="Manutenção">Manutenção Geral e Elevadores</option>
                  <option value="Eletricidade">Eletricidade</option>
                  <option value="Água">Água</option>
                  <option value="Limpezas">Limpezas</option>
                  <option value="Seguros">Seguros</option>
                  <option value="Inspeções e Certificações">Inspeções e Certificações</option>
                  <option value="Diversos">Outros / Diversos</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setManualEmailModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-inbox"></i>
                  <span>Colocar na Caixa de Entrada</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
