import React, { useState, useEffect, useMemo, useRef } from "react";
import { Pencil, Trash2, Plus, ArrowLeftRight, History } from "lucide-react";
import { Predio, Fracao, LoggedUser, Aviso, Proprietario, Documento } from "../types";
import { computeTransferCode, copyTextToClipboard, exportToXLS, downloadFichaCondominoVaziaPDF, downloadFichaCondominoPreenchidaPDF, downloadListaCondominosPDF, gerarReferenciaBR23E, parseValorMonetario } from "../utils";
import { ModalFichaCondominoEditavel } from "./ModalFichaCondominoEditavel";
import { MoneyInput } from "./MoneyInput";
import { FiltroRelatoriosPDFModal } from "./FiltroRelatoriosPDFModal";
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { saveFracaoToSupabase, deleteFracaoFromSupabase, saveProprietarioToSupabase, deleteProprietarioFromSupabase, dbSelect, dbUpdate, dbInsert, dbDelete, dbUpsert, saveAvisosToSupabase, registarLogAuditoria, fetchResidentesInquilinosFromSupabase, saveResidenteInquilinoToSupabase, uploadDocumentoToStorage, saveDocumentoToSupabase, converterNotificacaoParaEnumProprietarios, converterAdminInternoParaBoolean } from "../lib/supabaseService";

interface GestaoFracoesProps {
  predio: Predio;
  fracoes: Fracao[];
  onAddFracao: (novaFracao: Fracao) => void;
  onUpdateFracoes: (updatedFracoes: Fracao[]) => void;
  loggedUser: LoggedUser;
  avisos?: Aviso[];
  setAvisos?: React.Dispatch<React.SetStateAction<Aviso[]>>;
  activeSubSection?: string;
  documentos?: Documento[];
  setDocumentos?: React.Dispatch<React.SetStateAction<Documento[]>>;
}

export function GestaoFracoes({
  predio,
  fracoes,
  onAddFracao,
  onUpdateFracoes,
  loggedUser,
  avisos,
  setAvisos,
  activeSubSection,
  documentos,
  setDocumentos
}: GestaoFracoesProps) {
  const [fracaoNome, setFracaoNome] = useState("");
  const [piso, setPiso] = useState("");
  const [permilagem, setPermilagem] = useState("");
  const [tipologia, setTipologia] = useState("T2");
  const [tipoAcesso, setTipoAcesso] = useState("Acesso Comum pelas Escadas");
  const [garagem, setGaragem] = useState(false);
  const [arrecadacao, setArrecadacao] = useState(false);
  
  // Modos de Edição e Estados de Navegação
  const [editingFracaoId, setEditingFracaoId] = useState<string | null>(null);
  const [editingOwnerKey, setEditingOwnerKey] = useState<string | null>(null);
  const [justCreatedFracao, setJustCreatedFracao] = useState<Fracao | null>(null);
  const [unassignedProprietarios, setUnassignedProprietarios] = useState<Proprietario[]>([]);

  const [propNome, setPropNome] = useState("");
  const [propNif, setPropNif] = useState("");
  const [propEmail, setPropEmail] = useState("");
  const [propTlm, setPropTlm] = useState("");
  const [propDataNascimento, setPropDataNascimento] = useState("");
  const [propIban, setPropIban] = useState("");
  const [propTitular, setPropTitular] = useState("");
  const [propBanco, setPropBanco] = useState("");
  // Contas bancárias adicionais (além da principal acima) — para cruzamento
  // na conciliação quando o pagamento vem de uma conta diferente (cônjuge,
  // conta conjunta, etc.)
  const [propContasAdicionais, setPropContasAdicionais] = useState<{ titular: string; iban: string; entidade_bancaria?: string }[]>([]);
  const [propMoradaAlt, setPropMoradaAlt] = useState("");
  const [propFoto, setPropFoto] = useState<string | null>(null);

  // Estados para Co-Proprietários (Vários proprietários por fração)
  const [coNome, setCoNome] = useState("");
  const [coNif, setCoNif] = useState("");
  const [coEmail, setCoEmail] = useState("");
  const [coTlm, setCoTlm] = useState("");
  const [coDataNascimento, setCoDataNascimento] = useState("");
  const [coFoto, setCoFoto] = useState<string | null>(null);
  const coFileRef = React.useRef<HTMLInputElement>(null);
  
  const [proprietariosAdicionais, setProprietariosAdicionais] = useState<{
    nome: string;
    nif: string;
    email: string;
    tlm: string;
    data_nascimento?: string;
    foto: string | null;
  }[]>([]);
  const [gravandoCoproprietario, setGravandoCoproprietario] = useState(false);
  const [enviandoConviteCoproprietario, setEnviandoConviteCoproprietario] = useState(false);
  const [reenviandoConviteCoIdx, setReenviandoConviteCoIdx] = useState<number | null>(null);
  const [editingCoIndex, setEditingCoIndex] = useState<number | null>(null);
  const [enviandoConvites, setEnviandoConvites] = useState(false);

  const [arrendada, setArrendada] = useState(false);
  const [inqNome, setInqNome] = useState("");
  const [inqEmail, setInqEmail] = useState("");
  const [inqTlm, setInqTlm] = useState("");
  const [inqNif, setInqNif] = useState("");
  const [inqDataNascimento, setInqDataNascimento] = useState("");
  const [inqFoto, setInqFoto] = useState<string | null>(null);

  const [adminInterno, setAdminInterno] = useState("Não");
  const [notificacao, setNotificacao] = useState("Digital (E-mail e Mensagens Push)");

  // Digital Signature Pad state for Administrator
  const adminCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const adminSigFileRef = React.useRef<HTMLInputElement>(null);
  const [isDrawingAdmin, setIsDrawingAdmin] = useState(false);
  const [adminSignatureSaved, setAdminSignatureSaved] = useState<string | null>(
    localStorage.getItem("admin_signature_digital") || null
  );

  const startDrawingAdmin = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawingAdmin(true);
    const canvas = adminCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const drawAdmin = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingAdmin) return;
    const canvas = adminCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawingAdmin = () => {
    setIsDrawingAdmin(false);
  };

  const clearAdminCanvas = () => {
    const canvas = adminCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // A assinatura só em localStorage nunca chega ao servidor (ex.: recibos
  // gerados automaticamente por email) — guarda também no Supabase, dentro
  // do JSON "patrimonio" do prédio, para ficar acessível a partir do backend.
  const persistirAssinaturaNoSupabase = async (dataUrl: string) => {
    if (!isSupabaseConfigured) return;
    try {
      await dbUpdate("predios", { patrimonio: { ...(predio.patrimonio || {}), assinatura_admin_base64: dataUrl } }, [["id_predio", "eq", predio.id_predio]]);
    } catch (err) {
      console.warn("[Supabase] Erro ao guardar assinatura do administrador:", err);
    }
  };

  const saveAdminCanvasSignature = () => {
    const canvas = adminCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setAdminSignatureSaved(dataUrl);
    localStorage.setItem("admin_signature_digital", dataUrl);
    persistirAssinaturaNoSupabase(dataUrl);
    alert("✅ Assinatura Digital do Administrador recolhida e gravada com sucesso! Será aplicada automaticamente em todos os recibos e documentos oficiais.");
  };

  const handleAdminSignatureFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const res = evt.target?.result as string;
      if (res) {
        setAdminSignatureSaved(res);
        localStorage.setItem("admin_signature_digital", res);
        persistirAssinaturaNoSupabase(res);
        alert("✅ Ficheiro de Assinatura do Administrador carregado e gravado com sucesso!");
      }
    };
    reader.readAsDataURL(file);
  };

  const propFileRef = React.useRef<HTMLInputElement>(null);
  const inqFileRef = React.useRef<HTMLInputElement>(null);

  const [selectedFracaoId, setSelectedFracaoId] = useState<string | null>(null);

  // Transferência de Propriedade: guarda o proprietário ATUAL da fração
  // enquanto o admin regista o novo — só é arquivado em historico_proprietarios
  // quando o novo proprietário é mesmo gravado (evita ficar em limbo se o
  // admin desistir a meio, e mantém arquivamento + novo registo atómicos).
  const [transferindoPropriedadeDe, setTransferindoPropriedadeDe] = useState<Proprietario | null>(null);
  const [historicoModalFracaoId, setHistoricoModalFracaoId] = useState<string | null>(null);
  const [aArquivarRegistoDe, setAArquivarRegistoDe] = useState<string | null>(null);

  // Inline Permilage editing state
  const [isEditingPermilages, setIsEditingPermilages] = useState(false);
  const [tempPermilages, setTempPermilages] = useState<{ [id: string]: string }>({});

  // Proportional Quotas Calculator state
  const [orcamentoRegular, setOrcamentoRegular] = useState("1200"); // Monthly
  const [orcamentoExtra, setOrcamentoExtra] = useState("5000"); // Extraordinary total
  const [descricaoExtra, setDescricaoExtra] = useState("Obras Extraordinárias - Reabilitação de Fachadas");
  const [dataLimiteRegular, setDataLimiteRegular] = useState("2026-08-10");
  const [dataLimiteExtra, setDataLimiteExtra] = useState("2026-09-15");

  // Modal States for Editable Form & Dynamic Report Filter
  const [isFichaEditavelOpen, setIsFichaEditavelOpen] = useState(false);
  const [isFiltroRelatoriosOpen, setIsFiltroRelatoriosOpen] = useState(false);
  const [isOpcoesExportacaoOpen, setIsOpcoesExportacaoOpen] = useState(false);

  const [currentSubTab, setCurrentSubTab] = useState<"fracoes_nova" | "fracoes_proprietario" | "fracoes_perfis" | "residentes_inquilinos" | "permilagens_auto">(
    activeSubSection === "fracoes_nova" ? "fracoes_nova" :
    activeSubSection === "fracoes_proprietario" ? "fracoes_proprietario" :
    activeSubSection === "residentes_inquilinos" ? "residentes_inquilinos" :
    activeSubSection === "permilagens_auto" ? "permilagens_auto" : "fracoes_perfis"
  );

  useEffect(() => {
    if (activeSubSection === "fracoes_nova") {
      setCurrentSubTab("fracoes_nova");
    } else if (activeSubSection === "fracoes_proprietario") {
      setCurrentSubTab("fracoes_proprietario");
    } else if (activeSubSection === "residentes_inquilinos") {
      setCurrentSubTab("residentes_inquilinos");
    } else if (activeSubSection === "permilagens_auto") {
      setCurrentSubTab("permilagens_auto");
    } else if (activeSubSection === "fracoes_perfis") {
      setCurrentSubTab("fracoes_perfis");
    }
  }, [activeSubSection]);

  // Task 12: Gestão de Residentes & Inquilinos States — arranca vazio;
  // antes tinha 3 residentes fictícios fixos (incluindo um "ex-residente"
  // histórico) que apareciam sempre, para qualquer prédio real. O fetch
  // real está mais abaixo, depois de predioFracoes estar definido.
  const [residentesHistorico, setResidentesHistorico] = useState<any[]>([]);
  const [carregandoResidentes, setCarregandoResidentes] = useState(true);
  const [registandoEntrada, setRegistandoEntrada] = useState(false);
  const [registandoSaida, setRegistandoSaida] = useState<string | null>(null);

  // Fire insurance email modal state
  const [fireInsuranceModalFracao, setFireInsuranceModalFracao] = useState<Fracao | null>(null);
  const [enviandoPedidoApolice, setEnviandoPedidoApolice] = useState(false);

  // Edição inline dos dados do seguro (seguradora / nº apólice / validade)
  const [editandoSeguroFracaoId, setEditandoSeguroFracaoId] = useState<string | null>(null);
  const [tempSeguradora, setTempSeguradora] = useState("");
  const [tempApoliceNum, setTempApoliceNum] = useState("");
  const [tempApoliceValidade, setTempApoliceValidade] = useState("");
  const [guardandoSeguro, setGuardandoSeguro] = useState(false);

  const iniciarEdicaoSeguro = (f: Fracao) => {
    setEditandoSeguroFracaoId(f.id_fracao);
    setTempSeguradora(f.seguradora || "");
    setTempApoliceNum(f.apolice_num || "");
    setTempApoliceValidade(f.apolice_validade || "");
  };

  const guardarSeguroFracao = async (f: Fracao) => {
    setGuardandoSeguro(true);
    try {
      const atualizada: Fracao = {
        ...f,
        seguradora: tempSeguradora || undefined,
        apolice_num: tempApoliceNum || undefined,
        apolice_validade: tempApoliceValidade || undefined
      };
      const ok = await saveFracaoToSupabase(atualizada);
      if (ok) {
        onUpdateFracoes(fracoes.map(fr => fr.id_fracao === f.id_fracao ? atualizada : fr));
        setEditandoSeguroFracaoId(null);
      } else {
        alert("Erro ao gravar os dados do seguro no Supabase.");
      }
    } finally {
      setGuardandoSeguro(false);
    }
  };

  // Resident Form States
  const [resFracaoTarget, setResFracaoTarget] = useState("");
  const [resNome, setResNome] = useState("");
  const [resNif, setResNif] = useState("");
  const [resEmail, setResEmail] = useState("");
  const [resTlm, setResTlm] = useState("");
  const [resDataEntrada, setResDataEntrada] = useState("2026-08-01");
  const [resContratoFim, setResContratoFim] = useState("2027-07-31");
  const [resValorRenda, setResValorRenda] = useState("850");
  const [resCaucao, setResCaucao] = useState("1700");
  const [resChaves, setResChaves] = useState("2 Comandos Garagem + 2 Chaves Portal");

  // Task 13: Permilagens Automáticas States
  const [areaCoberta, setAreaCoberta] = useState<Record<string, number>>({
    "frac-1": 110, "frac-2": 95, "frac-3": 120, "frac-4": 85
  });
  const [areaVarandas, setAreaVarandas] = useState<Record<string, number>>({
    "frac-1": 15, "frac-2": 10, "frac-3": 20, "frac-4": 8
  });
  const [coefPiso, setCoefPiso] = useState<Record<string, number>>({
    "frac-1": 1.0, "frac-2": 1.05, "frac-3": 1.10, "frac-4": 1.15
  });

  useEffect(() => {
    if (activeSubSection === "fracoes_nova") {
      setCurrentSubTab("fracoes_nova");
    } else if (activeSubSection === "fracoes_proprietario") {
      setCurrentSubTab("fracoes_proprietario");
    } else if (activeSubSection === "fracoes_perfis" || activeSubSection === "fracoes") {
      setCurrentSubTab("fracoes_perfis");
    }
  }, [activeSubSection]);

  const predioFracoes = useMemo(() => fracoes.filter(f => f.id_predio === predio.id_predio), [fracoes, predio.id_predio]);
  const totalPermilagem = useMemo(() => predioFracoes.reduce((acc, curr) => acc + (Number(curr.permilagem) || 0), 0), [predioFracoes]);

  useEffect(() => {
    let cancelado = false;
    setCarregandoResidentes(true);
    fetchResidentesInquilinosFromSupabase(predio.id_predio).then(dados => {
      if (cancelado) return;
      setResidentesHistorico((dados || []).map(r => ({
        ...r,
        fracao: (() => {
          const f = predioFracoes.find(pf => pf.id_fracao === r.id_fracao);
          return f ? `Fração ${f.fracao_nome} (${f.piso})` : r.id_fracao;
        })(),
        tipo: r.data_saida ? "Inquilino (Histórico Ex-Residente)" : "Inquilino (Habitação Tradicional)"
      })));
      setCarregandoResidentes(false);
    });
    return () => { cancelado = true; };
  }, [predio.id_predio, predioFracoes]);

  // Lista unificada de todos os proprietários registados no prédio
  const todosProprietarios: Proprietario[] = useMemo(() => {
    const list: Proprietario[] = [];
    const seenNifs = new Set<string>();

    // 1. Proprietários principais das frações
    predioFracoes.forEach(f => {
      if (f.proprietario && f.proprietario.nome && f.proprietario.nome.trim() !== "") {
        const nifKey = f.proprietario.nif || f.proprietario.nome;
        seenNifs.add(nifKey);
        list.push({
          ...f.proprietario,
          id_fracao: f.id_fracao,
          fracao_nome: `Fração ${f.fracao_nome} (${f.piso})`,
          administrador_interno: f.administrador_interno || f.proprietario.administrador_interno || "Não",
          notificacao_preferencial: f.notificacao_preferencial || f.proprietario.notificacao_preferencial || "Digital (E-mail e Mensagens Push)"
        });
      }
    });

    // 2. Proprietários não associados ou adicionais
    unassignedProprietarios.forEach(p => {
      const nifKey = p.nif || p.nome;
      if (!seenNifs.has(nifKey)) {
        seenNifs.add(nifKey);
        list.push(p);
      }
    });

    return list;
  }, [predioFracoes, unassignedProprietarios]);

  useEffect(() => {
    if (!selectedFracaoId && predioFracoes.length > 0) {
      setSelectedFracaoId(predioFracoes[0].id_fracao);
    }
  }, [predioFracoes, selectedFracaoId]);

  // Carregar listas de frações e proprietários diretamente do Supabase
  useEffect(() => {
    let isMounted = true;
    const carregarDadosSupabase = async () => {
      if (!isSupabaseConfigured) return;
      try {
        const fracoesData = await dbSelect('fracoes');
        if (!fracoesData) {
          console.warn("[Supabase] Aviso ao ler fracoes");
        } else if (fracoesData.length > 0 && isMounted) {
          const fracoesFormatadas: Fracao[] = fracoesData.map((row: any) => ({
            id_fracao: row.id_fracao,
            id_predio: row.id_predio,
            fracao_nome: row.fracao_nome,
            piso: row.piso || "",
            permilagem: Number(row.permilagem) || 0,
            tipologia: row.tipologia || "T2",
            tipo_access: row.tipo_access || "Residencial",
            tem_garagem_spot: Boolean(row.tem_garagem_spot),
            tem_arrecadacao_box: Boolean(row.tem_arrecadacao_box),
            is_arrendada: Boolean(row.is_arrendada),
            administrador_interno: row.administrador_interno || "Não",
            notificacao_preferencial: row.notificacao_preferencial || "Digital (E-mail e Mensagens Push)",
            proprietario: row.proprietario || null,
            proprietarios_adicionais: row.proprietarios_adicionais || [],
            inquilino: row.inquilino || null,
            seguradora: row.seguradora || "",
            apolice_num: row.apolice_num || "",
            apolice_validade: row.apolice_validade || ""
          }));
          onUpdateFracoes(fracoesFormatadas);
        }

        const propsData = await dbSelect('proprietarios');
        if (!propsData) {
          console.warn("[Supabase] Aviso ao ler proprietarios");
        } else if (propsData.length > 0 && isMounted) {
          const propsFormatados: Proprietario[] = propsData.map((row: any) => ({
            id_proprietario: row.id_proprietario || row.nif,
            id_predio: row.id_predio,
            id_fracao: row.id_fracao,
            nome: row.nome,
            nif: row.nif,
            email: row.email,
            tlm: row.tlm,
            iban: row.iban || "",
            titular_conta: row.titular_conta || row.nome,
            entidade_bancaria: row.entidade_bancaria || "",
            morada_alternativa: row.morada_alternativa || null,
            foto: row.foto || null,
            administrador_interno: row.administrador_interno || "Não",
            notificacao_preferencial: row.notificacao_preferencial || "Digital (E-mail e Mensagens Push)"
          }));
          setUnassignedProprietarios(propsFormatados);
        }
      } catch (err: any) {
        console.warn("[Supabase] Erro ao carregar dados iniciais:", err?.message);
      }
    };
    carregarDadosSupabase();
    return () => { isMounted = false; };
  }, [predio.id_predio]);

  // Helper para carregar dados de proprietário para o formulário (apenas em cliques explícitos!)
  const carregarProprietarioParaEdicao = (prop: Proprietario, fracaoId?: string) => {
    setPropNome(prop.nome || "");
    setPropNif(prop.nif || "");
    setPropEmail(prop.email || "");
    setPropTlm(prop.tlm || "");
    setPropDataNascimento(prop.data_nascimento || "");
    setPropIban(prop.iban || "");
    setPropTitular(prop.titular_conta || prop.nome || "");
    setPropBanco(prop.entidade_bancaria || "");
    setPropContasAdicionais(prop.contas_bancarias_adicionais || []);
    setPropMoradaAlt(prop.morada_alternativa || "");
    setPropFoto(prop.foto || null);
    setAdminInterno(prop.administrador_interno || "Não");
    setNotificacao(prop.notificacao_preferencial || "Digital (E-mail e Mensagens Push)");
    
    const targetFracId = fracaoId || prop.id_fracao;
    if (targetFracId) {
      setSelectedFracaoId(targetFracId);
      const targetFracao = predioFracoes.find(f => f.id_fracao === targetFracId);
      if (targetFracao) {
        if (targetFracao.proprietarios_adicionais && targetFracao.proprietarios_adicionais.length > 0) {
          setProprietariosAdicionais(targetFracao.proprietarios_adicionais.map(p => ({
            nome: p.nome || "",
            nif: p.nif || "",
            email: p.email || "",
            tlm: p.tlm || "",
            data_nascimento: p.data_nascimento || "",
            foto: p.foto || null
          })));
        } else {
          setProprietariosAdicionais([]);
        }
        if (targetFracao.inquilino) {
          setArrendada(true);
          setInqNome(targetFracao.inquilino.nome || "");
          setInqEmail(targetFracao.inquilino.email || "");
          setInqTlm(targetFracao.inquilino.tlm || "");
          setInqNif(targetFracao.inquilino.nif || "");
          setInqDataNascimento(targetFracao.inquilino.data_nascimento || "");
          setInqFoto(targetFracao.inquilino.foto || null);
        } else {
          setArrendada(false);
          setInqNome("");
          setInqEmail("");
          setInqTlm("");
          setInqNif("");
          setInqDataNascimento("");
          setInqFoto(null);
        }
      }
    }

    setEditingOwnerKey(prop.nif || prop.nome);
    setCurrentSubTab("fracoes_proprietario");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const limparFormProprietario = () => {
    setPropNome("");
    setPropNif("");
    setPropEmail("");
    setPropTlm("");
    setPropDataNascimento("");
    setPropIban("");
    setPropTitular("");
    setPropBanco("");
    setPropContasAdicionais([]);
    setPropMoradaAlt("");
    setPropFoto(null);
    setAdminInterno("Não");
    setNotificacao("Digital (E-mail e Mensagens Push)");
    setCoNome("");
    setCoNif("");
    setCoEmail("");
    setCoTlm("");
    setCoDataNascimento("");
    setCoFoto(null);
    setProprietariosAdicionais([]);
    setArrendada(false);
    setInqNome("");
    setInqEmail("");
    setInqTlm("");
    setInqNif("");
    setInqDataNascimento("");
    setInqFoto(null);
    setEditingOwnerKey(null);
    setTransferindoPropriedadeDe(null);
  };

  // Inicia a transferência de propriedade de uma fração: limpa o formulário
  // para registar o NOVO proprietário, mas guarda o antigo em
  // transferindoPropriedadeDe para ser arquivado em historico_proprietarios
  // assim que o novo for mesmo submetido (ver submeterEditarProprietario).
  const iniciarTransferenciaPropriedade = (fracaoId: string) => {
    const targetFracao = predioFracoes.find(f => f.id_fracao === fracaoId);
    if (!targetFracao?.proprietario?.nome) {
      alert("Esta fração não tem um proprietário atual registado — utilize 'Registar / Editar Proprietário' normalmente.");
      return;
    }
    if (!window.confirm(
      `Transferir a propriedade da Fração ${targetFracao.fracao_nome}?\n\n` +
      `O proprietário atual (${targetFracao.proprietario.nome}) será arquivado no histórico da fração (mantendo o acesso aos documentos e recibos já emitidos em seu nome) e vai poder registar de seguida os dados do novo proprietário.`
    )) {
      return;
    }
    limparFormProprietario();
    setSelectedFracaoId(fracaoId);
    setTransferindoPropriedadeDe(targetFracao.proprietario);
    setCurrentSubTab("fracoes_proprietario");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Arquivo manual de um registo (documento à escolha do admin) na pasta de
  // um ex-proprietário/coproprietário/inquilino em Arquivo → Condóminos →
  // Ex-Proprietários → [nome] — para além do registo automático criado ao
  // transferir a propriedade, permite juntar aí qualquer outro documento.
  const handleArquivarRegistoManual = async (nomeProprietario: string, fracaoNome: string, file: File) => {
    if (!setDocumentos) return;
    setAArquivarRegistoDe(nomeProprietario);
    try {
      const ano = new Date().getFullYear().toString();
      const caminho = `${ano}/Condominos/ExProprietarios/${predio.id_predio}/${Date.now()}-${file.name}`;
      const urlReal = await uploadDocumentoToStorage(file, caminho);
      if (!urlReal) {
        alert("Não foi possível carregar o ficheiro para o Supabase Storage.");
        return;
      }
      const novoDoc: Documento = {
        id_doc: "doc-exprop-manual-" + Date.now(),
        id_predio: predio.id_predio,
        nome: file.name,
        tipo: file.type.includes("pdf") ? "PDF" : "Documento",
        data_upload: new Date().toISOString().split("T")[0],
        tamanho: `${(file.size / 1024).toFixed(0)} KB`,
        categoria: "Condóminos",
        tema: "Ex-Proprietários",
        sub_pasta: nomeProprietario,
        descricao: `Registo arquivado manualmente para ${nomeProprietario} (Fração ${fracaoNome})`,
        visibilidade: "Administração",
        autor: loggedUser.nome,
        ano,
        caminho: urlReal,
        arquivado: true,
        data_arquivamento: new Date().toISOString().split("T")[0],
        tipo_arquivo: "documento",
        relevancia_perfis: ["ADMIN", "EMPRESA_GESTORA"]
      };
      setDocumentos(prev => [novoDoc, ...prev]);
      await saveDocumentoToSupabase(novoDoc);
      registarLogAuditoria("Frações", `Arquivou manualmente um registo de ${nomeProprietario}`, predio.id_predio, loggedUser, file.name);
    } finally {
      setAArquivarRegistoDe(null);
    }
  };

  // Helper para carregar dados de uma fração para edição
  const handleEditarFracao = (f: Fracao) => {
    setFracaoNome(f.fracao_nome);
    setPiso(f.piso);
    setPermilagem(String(f.permilagem));
    setTipologia(f.tipologia || "T2");
    setTipoAcesso(f.tipo_access || "Acesso Comum pelas Escadas");
    setGaragem(Boolean(f.tem_garagem_spot));
    setArrecadacao(Boolean(f.tem_arrecadacao_box));
    setEditingFracaoId(f.id_fracao);
    setCurrentSubTab("fracoes_nova");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelarEdicaoFracao = () => {
    setFracaoNome("");
    setPiso("");
    setPermilagem("");
    setTipologia("T2");
    setTipoAcesso("Acesso Comum pelas Escadas");
    setGaragem(false);
    setArrecadacao(false);
    setEditingFracaoId(null);
  };

  // Eliminar fração com confirmação e persistência no Supabase
  const handleEliminarFracao = async (idFracao: string, nomeFracao: string) => {
    if (!window.confirm(`Tem a certeza que deseja eliminar a Fração ${nomeFracao}? Esta ação é irreversível e removerá os dados do Supabase.`)) {
      return;
    }
    try {
      // DELETE na tabela 'fracoes'
      const deleteOk = await dbDelete('fracoes', [['id_fracao', 'eq', idFracao]]);

      if (!deleteOk) {
        alert(`Erro ao eliminar fração no Supabase.`);
        return;
      }

      const updated = fracoes.filter(f => f.id_fracao !== idFracao);
      onUpdateFracoes(updated);
      await deleteFracaoFromSupabase(idFracao);

      if (selectedFracaoId === idFracao) {
        setSelectedFracaoId(updated.length > 0 ? updated[0].id_fracao : null);
      }
      if (editingFracaoId === idFracao) {
        cancelarEdicaoFracao();
      }
      alert(`Fração ${nomeFracao} eliminada com sucesso do Supabase.`);
    } catch (err: any) {
      alert(`Erro na ligação com o Supabase: ${err?.message || "Erro desconhecido"}`);
    }
  };

  // Eliminar proprietário com confirmação e persistência no Supabase
  const handleEliminarProprietario = async (prop: Proprietario) => {
    if (!window.confirm(`Tem a certeza que deseja remover o proprietário ${prop.nome}? Esta ação irá apagar o registo no Supabase.`)) {
      return;
    }
    try {
      // DELETE na tabela 'proprietarios'
      const deleteOk = await dbDelete('proprietarios', [['nif', 'eq', prop.nif]]);

      if (!deleteOk) {
        console.warn("[Supabase] Aviso ao eliminar na tabela 'proprietarios'");
      }

      if (prop.id_fracao) {
        // Atualizar fração no Supabase
        const fracOk = await dbUpdate('fracoes', {
          proprietario: null,
          administrador_interno: "Não"
        }, [['id_fracao', 'eq', prop.id_fracao]]);

        if (!fracOk) {
          alert(`Erro ao desassociar proprietário da fração no Supabase.`);
          return;
        }

        const target = fracoes.find(f => f.id_fracao === prop.id_fracao);
        if (target) {
          const updatedFracao: Fracao = {
            ...target,
            proprietario: null,
            administrador_interno: "Não"
          };
          const updatedList = fracoes.map(f => f.id_fracao === prop.id_fracao ? updatedFracao : f);
          onUpdateFracoes(updatedList);
          await saveFracaoToSupabase(updatedFracao);
        }
      }

      setUnassignedProprietarios(prev => prev.filter(p => (p.nif || p.nome) !== (prop.nif || prop.nome)));
      await deleteProprietarioFromSupabase(prop.nif || prop.nome, prop.id_fracao);
      if (editingOwnerKey === (prop.nif || prop.nome)) {
        limparFormProprietario();
      }
      alert(`Proprietário ${prop.nome} removido com sucesso.`);
    } catch (err: any) {
      alert(`Erro na ligação com o Supabase: ${err?.message || "Erro desconhecido"}`);
    }
  };

  const processarFotoWebP = (e: React.ChangeEvent<HTMLInputElement>, targetSetter: (val: string | null) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_WIDTH = 400; 

        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        const webpUrl = canvas.toDataURL("image/webp", 0.8);
        targetSetter(webpUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Sub-menu 1: Registar ou Atualizar Fração (Totalmente Independente)
  const submeterNovaFracao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedUser.role !== 'ADMIN' && loggedUser.role !== 'EMPRESA_GESTORA') {
      return alert("Apenas administradores podem registar ou editar frações!");
    }
    if (!fracaoNome.trim() || !piso.trim()) {
      alert("Por favor, indique a Fração (Letra/Identificação) e o Piso.");
      return;
    }
    if (!tipologia.trim()) {
      alert("A Tipologia é um campo obrigatório. Por favor, selecione uma opção.");
      return;
    }
    if (!permilagem || isNaN(Number(permilagem)) || Number(permilagem) <= 0) {
      alert("A Permilagem/M2 é um campo obrigatório. Por favor, insira o valor da permilagem (ex: 125).");
      return;
    }

    const valorPermilagem = Number(permilagem);

    // Se estiver em modo de edição de fração existente
    if (editingFracaoId) {
      const targetFracao = fracoes.find(f => f.id_fracao === editingFracaoId);
      if (!targetFracao) return;

      const updatedFracao: Fracao = {
        ...targetFracao,
        fracao_nome: fracaoNome.trim(),
        piso: piso.trim(),
        permilagem: valorPermilagem,
        tipologia: tipologia.trim(),
        tipo_access: tipoAcesso,
        tem_garagem_spot: garagem,
        tem_arrecadacao_box: arrecadacao
      };

      try {
        // UPDATE na tabela 'fracoes'
        const updateOk = await dbUpdate('fracoes', {
          fracao_nome: fracaoNome.trim(),
          piso: piso.trim(),
          permilagem: valorPermilagem,
          tipologia: tipologia.trim(),
          tipo_access: tipoAcesso,
          tem_garagem_spot: garagem,
          tem_arrecadacao_box: arrecadacao
        }, [['id_fracao', 'eq', editingFracaoId]]);

        if (!updateOk) {
          alert(`Erro ao atualizar fração no Supabase.`);
          return;
        }

        const updatedList = fracoes.map(f => f.id_fracao === editingFracaoId ? updatedFracao : f);
        onUpdateFracoes(updatedList);
        await saveFracaoToSupabase(updatedFracao);

        cancelarEdicaoFracao();
        alert(`✅ Fração ${updatedFracao.fracao_nome} atualizada com sucesso no Supabase!`);
        return;
      } catch (err: any) {
        alert(`Erro na ligação com o Supabase: ${err?.message || "Erro desconhecido"}`);
        return;
      }
    }

    // Criar Nova Fração
    const refBR23E = gerarReferenciaBR23E(fracaoNome.trim(), "frac-" + Date.now());
    const nova: Fracao = {
      id_fracao: "frac-" + Date.now(),
      id_predio: predio.id_predio,
      fracao_nome: fracaoNome.trim(),
      piso: piso.trim(),
      permilagem: valorPermilagem,
      tipologia: tipologia.trim(),
      tipo_access: tipoAcesso,
      tem_garagem_spot: garagem,
      tem_arrecadacao_box: arrecadacao,
      is_arrendada: false,
      administrador_interno: "Não",
      notificacao_preferencial: "Digital (E-mail e Mensagens Push)",
      referencia_br23e: refBR23E,
      proprietario: null,
      proprietarios_adicionais: [],
      inquilino: null
    };

    try {
      // INSERT na tabela 'fracoes'
      const insertOk = await dbInsert('fracoes', {
        id_fracao: nova.id_fracao,
        id_predio: nova.id_predio,
        fracao_nome: nova.fracao_nome,
        piso: nova.piso,
        permilagem: nova.permilagem,
        tipologia: nova.tipologia,
        tipo_access: nova.tipo_access,
        tem_garagem_spot: nova.tem_garagem_spot,
        tem_arrecadacao_box: nova.tem_arrecadacao_box,
        is_arrendada: nova.is_arrendada,
        administrador_interno: nova.administrador_interno,
        notificacao_preferencial: nova.notificacao_preferencial,
        referencia_br23e: nova.referencia_br23e,
        proprietario: nova.proprietario,
        proprietarios_adicionais: nova.proprietarios_adicionais,
        inquilino: nova.inquilino
      });

      if (!insertOk) {
        alert(`Erro ao gravar fração no Supabase.`);
        return;
      }

      onAddFracao(nova);
      await saveFracaoToSupabase(nova);
      setJustCreatedFracao(nova);
      setSelectedFracaoId(nova.id_fracao);

      // Limpar campos de fração
      setFracaoNome("");
      setPiso("");
      setPermilagem("");
      setTipologia("T2");
      setTipoAcesso("Acesso Comum pelas Escadas");
      setGaragem(false);
      setArrecadacao(false);
    } catch (err: any) {
      alert(`Erro na ligação com o Supabase: ${err?.message || "Erro desconhecido"}`);
    }
  };

  // Sub-menu 2: Registar / Gravar Dados do Proprietário (Totalmente Independente)
  const submeterEditarProprietario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedUser.role !== 'ADMIN' && loggedUser.role !== 'EMPRESA_GESTORA') {
      return alert("Apenas administradores podem atualizar proprietários!");
    }
    // Campos obrigatórios aceitam "NA" (Não Aplicável/Não Autorizado) — há
    // condóminos que recusam fornecer certos dados (email, NIF, telemóvel);
    // sem esta válvula de escape não era possível sequer registar a fração
    // com um proprietário conhecido mas não colaborante.
    if (!propNome.trim()) {
      alert("O campo Nome Completo do Proprietário é obrigatório.");
      return;
    }
    if (!propNif.trim()) {
      alert("O campo NIF Fiscal do Proprietário é obrigatório (escreva NA se o condómino recusar fornecer).");
      return;
    }
    if (!propEmail.trim()) {
      alert("O campo E-mail do Proprietário é obrigatório (escreva NA se o condómino recusar fornecer/registar-se).");
      return;
    }
    if (!propTlm.trim()) {
      alert("O campo Telemóvel do Proprietário é obrigatório (escreva NA se o condómino recusar fornecer).");
      return;
    }
    if (!adminInterno) {
      alert("Indique se é o Administrador Interno (campo obrigatório).");
      return;
    }
    if (!notificacao) {
      alert("Indique como quer ser notificado (campo obrigatório).");
      return;
    }

    const targetFracao = selectedFracaoId ? predioFracoes.find(f => f.id_fracao === selectedFracaoId) : null;
    const refBR23E = targetFracao?.referencia_br23e || targetFracao?.proprietario?.referencia_br23e || gerarReferenciaBR23E(targetFracao?.fracao_nome || propNome.trim(), selectedFracaoId);

    // Primeiro registo REAL de proprietário nesta fração (não uma edição de
    // dados já existentes, nem uma Transferência de Propriedade — nesse caso
    // o novo proprietário não deve ser cobrado retroativamente por meses em
    // que ainda não era dono) — dispara a emissão automática das notas de
    // cobrança em atraso desde o início de atividade (ver mais abaixo).
    const isPrimeiroRegistoProprietario = !targetFracao?.proprietario && !transferindoPropriedadeDe;

    const novoProprietarioObj: Proprietario = {
      nome: propNome.trim(),
      nif: propNif.trim(),
      email: propEmail.trim(),
      tlm: propTlm.trim(),
      data_nascimento: propDataNascimento.trim() || undefined,
      iban: propIban.trim() || "",
      titular_conta: propTitular.trim() || propNome.trim(),
      entidade_bancaria: propBanco.trim() || "",
      contas_bancarias_adicionais: propContasAdicionais.filter(c => c.iban.trim()),
      morada_alternativa: arrendada ? propMoradaAlt || null : null,
      foto: propFoto,
      administrador_interno: adminInterno,
      notificacao_preferencial: notificacao,
      referencia_br23e: refBR23E
    };

    try {
      // Com NIF "NA" (recusado), usar o NIF como parte do id_proprietario
      // faria colidir dois proprietários diferentes que ambos recusaram
      // fornecer o NIF (o segundo upsert sobrescrevia o primeiro em
      // silêncio) — nesse caso gera um id ligado à fração em vez do NIF.
      const nifUtilizavel = novoProprietarioObj.nif && novoProprietarioObj.nif.toUpperCase() !== "NA";
      const propPayload = {
        id_proprietario: nifUtilizavel ? "prop-" + novoProprietarioObj.nif : "prop-" + (selectedFracaoId || "geral") + "-" + Date.now(),
        id_predio: predio.id_predio,
        id_fracao: selectedFracaoId || null,
        nome: novoProprietarioObj.nome,
        nif: novoProprietarioObj.nif,
        email: novoProprietarioObj.email,
        tlm: novoProprietarioObj.tlm,
        data_nascimento: novoProprietarioObj.data_nascimento || null,
        iban: novoProprietarioObj.iban,
        titular_conta: novoProprietarioObj.titular_conta,
        entidade_bancaria: novoProprietarioObj.entidade_bancaria,
        morada_alternativa: novoProprietarioObj.morada_alternativa,
        foto: novoProprietarioObj.foto,
        // A tabela proprietarios exige boolean/enum estritos, diferentes dos
        // rótulos em português usados no resto da app — ver conversores em
        // lib/supabaseService.ts (sem isto, este upsert falhava sempre e a
        // tabela proprietarios ficava vazia apesar do registo aparecer OK).
        administrador_interno: converterAdminInternoParaBoolean(novoProprietarioObj.administrador_interno),
        notificacao_preferencial: converterNotificacaoParaEnumProprietarios(novoProprietarioObj.notificacao_preferencial),
        referencia_br23e: refBR23E
      };

      // Tenta atualizar ou inserir na tabela 'proprietarios'
      const upsertPropOk = await dbUpsert('proprietarios', propPayload);

      if (!upsertPropOk) {
        console.warn("[Supabase] Aviso ao gravar na tabela proprietarios");
      }

      // Se houver fração selecionada, atualiza a fração no Supabase
      if (selectedFracaoId) {
        if (targetFracao) {
          const isNewEmail = targetFracao.proprietario?.email !== propEmail.trim();
          // Com email "NA" (condómino recusou fornecer), não faz sentido
          // tentar enviar convites/boas-vindas reais para um endereço que
          // não existe — a API do Resend rejeitaria o envio na mesma. E
          // quem escolheu explicitamente ser notificado por Correio Postal
          // não deve receber nenhum email automático de boas-vindas/ativação
          // — antes o sistema enviava-os na mesma, ignorando essa escolha.
          const emailValidoParaEnvio = /\S+@\S+\.\S+/.test(propEmail.trim()) && notificacao.includes("Digital");

          // Se isto é uma Transferência de Propriedade, arquiva o
          // proprietário anterior (capturado em iniciarTransferenciaPropriedade)
          // no histórico da fração, em vez de o deixar desaparecer ao ser
          // substituído pelo novo — mantém o registo de quem era o
          // proprietário em cada período, para consulta de documentos antigos.
          const novoHistoricoProprietarios = transferindoPropriedadeDe
            ? [
                ...(targetFracao.historico_proprietarios || []),
                {
                  proprietario: transferindoPropriedadeDe,
                  data_fim: new Date().toISOString().split("T")[0],
                  motivo: "Transferência de propriedade"
                }
              ]
            : targetFracao.historico_proprietarios;

          const updateFracOk = await dbUpdate('fracoes', {
            referencia_br23e: refBR23E,
            proprietario: novoProprietarioObj,
            proprietarios_adicionais: proprietariosAdicionais,
            historico_proprietarios: novoHistoricoProprietarios,
            inquilino: arrendada && inqNome.trim() ? {
              nome: inqNome.trim(),
              email: inqEmail.trim(),
              tlm: inqTlm.trim(),
              nif: inqNif.trim(),
              data_nascimento: inqDataNascimento.trim() || undefined,
              foto: inqFoto
            } : null,
            administrador_interno: adminInterno,
            notificacao_preferencial: notificacao,
            is_arrendada: arrendada
          }, [['id_fracao', 'eq', selectedFracaoId]]);

          if (!updateFracOk) {
            alert(`Erro ao atualizar proprietário da fração no Supabase.`);
            return;
          }

          const updatedFracao: Fracao = {
            ...targetFracao,
            is_arrendada: arrendada,
            administrador_interno: adminInterno,
            notificacao_preferencial: notificacao,
            proprietario: novoProprietarioObj,
            proprietarios_adicionais: proprietariosAdicionais,
            historico_proprietarios: novoHistoricoProprietarios,
            inquilino: arrendada && inqNome.trim() ? {
              nome: inqNome.trim(),
              email: inqEmail.trim(),
              tlm: inqTlm.trim(),
              nif: inqNif.trim(),
              data_nascimento: inqDataNascimento.trim() || undefined,
              foto: inqFoto
            } : null
          };

          const updatedList = fracoes.map(f => f.id_fracao === selectedFracaoId ? updatedFracao : f);
          onUpdateFracoes(updatedList);
          await saveFracaoToSupabase(updatedFracao);
          await saveProprietarioToSupabase(novoProprietarioObj, selectedFracaoId);

          if (transferindoPropriedadeDe) {
            registarLogAuditoria(
              "Frações",
              `Transferiu a propriedade da Fração ${targetFracao.fracao_nome}`,
              predio.id_predio,
              loggedUser,
              `${transferindoPropriedadeDe.nome} → ${novoProprietarioObj.nome}`
            );
            // Desvincula o antigo proprietário da fração (já feito acima, ao
            // substituir "proprietario") e cria um registo real no Arquivo
            // Digital (Condóminos → Ex-Proprietários → nome), para consulta
            // futura fora do JSON interno da fração.
            if (setDocumentos) {
              const docExOwner: Documento = {
                id_doc: "doc-exprop-" + Date.now(),
                id_predio: predio.id_predio,
                nome: `Registo de Proprietário — ${transferindoPropriedadeDe.nome} (Fração ${targetFracao.fracao_nome})`,
                tipo: "Registo",
                data_upload: new Date().toISOString().split("T")[0],
                tamanho: "—",
                categoria: "Condóminos",
                tema: "Ex-Proprietários",
                sub_pasta: transferindoPropriedadeDe.nome,
                descricao: `Proprietário da Fração ${targetFracao.fracao_nome} até ${new Date().toISOString().split("T")[0]}. NIF: ${transferindoPropriedadeDe.nif || "—"}. Email: ${transferindoPropriedadeDe.email || "—"}. Telemóvel: ${transferindoPropriedadeDe.tlm || "—"}. Motivo do arquivamento: Transferência de propriedade (novo proprietário: ${novoProprietarioObj.nome}).`,
                visibilidade: "Administração",
                autor: loggedUser.nome,
                ano: new Date().getFullYear().toString(),
                arquivado: true,
                data_arquivamento: new Date().toISOString().split("T")[0],
                relevancia_perfis: ["ADMIN", "EMPRESA_GESTORA"]
              };
              setDocumentos(prev => [docExOwner, ...prev]);
              saveDocumentoToSupabase(docExOwner).catch(console.error);
            }
            setTransferindoPropriedadeDe(null);
          }

          if ((isNewEmail || !targetFracao.proprietario) && emailValidoParaEnvio) {
            // Ordem deliberada: primeiro o email de boas-vindas (com o PDF
            // de instruções do site & instalação da PWA em anexo), só depois
            // o email de ativação — para a pessoa abrir o 1º email, ler o
            // anexo e perceber o que tem de fazer, em vez de receber os dois
            // juntos e arriscar ver primeiro o link de ativação. Entre os
            // dois há um intervalo real de 60 segundos (não é decorativo:
            // este pedido só é feito depois de a Promise abaixo resolver).
            setEnviandoConvites(true);

            // Primeiro registo do proprietário desta fração: emite e envia
            // automaticamente, antes de mais nada, todas as notas de
            // cobrança mensais em falta desde o início de atividade da
            // administração (01/06/2026) até ao mês corrente.
            let notasAtrasoResumoTexto = "";
            if (isPrimeiroRegistoProprietario) {
              try {
                const respNotas = await fetch("/api/pagamento?acao=emitir-notas-atraso", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id_predio: predio.id_predio, id_fracao: selectedFracaoId })
                });
                const dataNotas = await respNotas.json();
                if (respNotas.ok && dataNotas.ok) {
                  notasAtrasoResumoTexto = `\n💶 Foram emitidas e enviadas ${dataNotas.mesesEmitidos} nota(s) de cobrança em atraso (desde o início de atividade) para ${propEmail.trim()}.`;
                } else {
                  notasAtrasoResumoTexto = "\n⚠️ Não foi possível emitir automaticamente as notas de cobrança em atraso — pode fazê-lo manualmente em Financeiro.";
                }
              } catch (err) {
                console.warn("[GestaoFracoes] Aviso ao emitir notas de cobrança em atraso:", err);
                notasAtrasoResumoTexto = "\n⚠️ Não foi possível emitir automaticamente as notas de cobrança em atraso — pode fazê-lo manualmente em Financeiro.";
              }
            }

            let boasVindasEnviado = false;
            try {
              const respBV = await fetch("/api/pdf?tipo=boas-vindas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  nome: propNome.trim(),
                  buildingName: predio.nome,
                  email: propEmail.trim(),
                  predio: predio.id_predio,
                  fracao: selectedFracaoId
                })
              });
              const dataBV = await respBV.json();
              boasVindasEnviado = respBV.ok && dataBV.ok;
            } catch (err) {
              console.warn("[GestaoFracoes] Aviso ao enviar email de boas-vindas:", err);
            }

            await new Promise(resolve => setTimeout(resolve, 60000));

            // Cria o acesso real (Supabase Auth) e envia um email com um
            // link seguro de ativação — a pessoa define a sua própria
            // password, nunca uma password gerada pelo sistema.
            let convidado = false;
            try {
              const resp = await fetch("/api/admin?acao=convidar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: propEmail.trim(),
                  nome: propNome.trim(),
                  role: "USER",
                  id_predio: predio.id_predio,
                  id_fracao: selectedFracaoId
                })
              });
              const data = await resp.json();
              convidado = resp.ok && data.ok;
            } catch (err) {
              console.warn("[GestaoFracoes] Aviso ao enviar convite de ativação:", err);
            }
            setEnviandoConvites(false);

            alert((convidado
              ? `✅ Proprietário associado com sucesso à Fração ${targetFracao.fracao_nome}!\n\n${boasVindasEnviado ? `📧 Foi enviado o email de boas-vindas para ${propEmail.trim()} com o guia de instruções de acesso ao site e instalação da PWA.` : "⚠️ Não foi possível enviar o guia de boas-vindas — pode reenviá-lo mais tarde."}\n📧 60 segundos depois, foi enviado o email com o link seguro para o condómino ativar o seu acesso e definir a própria password.`
              : `✅ Proprietário associado com sucesso à Fração ${targetFracao.fracao_nome} no Supabase, mas houve um erro a enviar o email de ativação. Pode reenviá-lo mais tarde.`
            ) + notasAtrasoResumoTexto);
          } else {
            alert(`✅ Dados do proprietário da Fração ${targetFracao.fracao_nome} (${propNome.trim()}) gravados com sucesso no Supabase!`);
          }

          // Convite real de acesso ao inquilino — antes era só um registo
          // informativo, nunca recebia email nenhum nem conseguia entrar na
          // plataforma. Mesma ordem: boas-vindas primeiro, 60s depois a
          // ativação. Só dispara quando o email do inquilino é novo/mudou.
          const isNewInquilinoEmail = arrendada && inqNome.trim() && inqEmail.trim() && /\S+@\S+\.\S+/.test(inqEmail.trim()) && targetFracao.inquilino?.email !== inqEmail.trim();
          if (isNewInquilinoEmail) {
            setEnviandoConvites(true);
            try {
              await fetch("/api/pdf?tipo=boas-vindas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  nome: inqNome.trim(),
                  buildingName: predio.nome,
                  email: inqEmail.trim(),
                  predio: predio.id_predio,
                  fracao: selectedFracaoId
                })
              }).catch(err => console.warn("[GestaoFracoes] Aviso ao enviar boas-vindas ao inquilino:", err));

              await new Promise(resolve => setTimeout(resolve, 60000));

              const respConviteInq = await fetch("/api/admin?acao=convidar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: inqEmail.trim(),
                  nome: inqNome.trim(),
                  role: "INQUILINO",
                  id_predio: predio.id_predio,
                  id_fracao: selectedFracaoId
                })
              });
              const dataConviteInq = await respConviteInq.json();
              if (respConviteInq.ok && dataConviteInq.ok) {
                alert(`✅ Inquilino ${inqNome.trim()} convidado com sucesso! Foi enviado um email para ${inqEmail.trim()} com o guia de boas-vindas e, 60 segundos depois, o link para ativar o acesso e definir a password.`);
              } else {
                alert(`⚠️ Dados do inquilino gravados, mas houve um erro a enviar o convite de acesso. Pode reenviá-lo mais tarde.`);
              }
            } finally {
              setEnviandoConvites(false);
            }
          }

          limparFormProprietario();
          return;
        }
      }

      setUnassignedProprietarios(prev => {
        const filtered = prev.filter(p => (p.nif || p.nome) !== (novoProprietarioObj.nif || novoProprietarioObj.nome));
        return [...filtered, novoProprietarioObj];
      });
      await saveProprietarioToSupabase(novoProprietarioObj);

      alert(`✅ Proprietário ${novoProprietarioObj.nome} guardado com sucesso no Supabase! Poderá associá-lo a uma fração a qualquer momento.`);
      limparFormProprietario();
    } catch (err: any) {
      alert(`Erro na ligação com o Supabase: ${err?.message || "Erro desconhecido"}`);
    }
  };

  const exportarCondonimosPDF = () => {
    window.print();
  };

  const exportarCondonimosXLS = () => {
    const headers = ["Fracao", "Piso", "Permilagem", "Tipologia", "Proprietario", "Contacto", "Inquilino"];
    const rows = predioFracoes.map(f => [
      f.fracao_nome,
      f.piso,
      f.permilagem.toString(),
      f.tipologia,
      f.proprietario?.nome || "",
      f.proprietario?.email || "",
      f.is_arrendada ? f.inquilino?.nome || "" : "N/A"
    ]);
    exportToXLS("Lista_Condominos_Filiados", headers, rows);
  };

  const copiarCodigo = (codigo: string) => {
    const copiou = copyTextToClipboard(codigo);
    if (copiou) alert("Código de transferência copiado com sucesso!");
  };

  // Inline Permilage edit triggers
  const iniciarEdicaoPermilagens = () => {
    const temps: { [id: string]: string } = {};
    predioFracoes.forEach(f => {
      temps[f.id_fracao] = f.permilagem.toString();
    });
    setTempPermilages(temps);
    setIsEditingPermilages(true);
  };

  const cancelarEdicaoPermilagens = () => {
    setIsEditingPermilages(false);
  };

  // Grava a sério no Supabase as frações do prédio ativo cuja permilagem mudou —
  // sem isto, as permilagens revertiam ao recarregar a página apesar da
  // mensagem de sucesso (bug crítico: a permilagem determina o cálculo legal
  // das quotas).
  const persistirPermilagens = async (updated: Fracao[]) => {
    onUpdateFracoes(updated);
    const alteradas = updated.filter(f => f.id_predio === predio.id_predio);
    const resultados = await Promise.all(alteradas.map(f => saveFracaoToSupabase(f)));
    return resultados.every(Boolean);
  };

  const salvarPermilagens = async () => {
    const updated = fracoes.map(f => {
      if (f.id_predio === predio.id_predio && tempPermilages[f.id_fracao] !== undefined) {
        return { ...f, permilagem: Math.max(1, Math.min(1000, Number(tempPermilages[f.id_fracao]) || 1)) };
      }
      return f;
    });
    const ok = await persistirPermilagens(updated);
    setIsEditingPermilages(false);
    alert(ok ? "Permilagens salvas com sucesso!" : "As permilagens foram atualizadas no ecrã, mas houve um erro a gravar no Supabase — tente novamente.");
  };

  const autoAjustarPermilagens = async () => {
    if (predioFracoes.length === 0) return;
    const diff = 1000 - totalPermilagem;
    if (diff === 0) return alert("A soma já é exatamente 1000‰!");

    const valorAjustePorFracao = diff / predioFracoes.length;
    const updated = fracoes.map(f => {
      if (f.id_predio === predio.id_predio) {
        const novaPerm = Math.max(1, Math.round(f.permilagem + valorAjustePorFracao));
        return { ...f, permilagem: novaPerm };
      }
      return f;
    });

    // Make sure rounding sums up strictly to 1000
    const testBuildingFracoes = updated.filter(f => f.id_predio === predio.id_predio);
    const testSum = testBuildingFracoes.reduce((acc, curr) => acc + curr.permilagem, 0);
    if (testSum !== 1000 && testBuildingFracoes.length > 0) {
      const finalDiff = 1000 - testSum;
      testBuildingFracoes[0].permilagem += finalDiff;
    }

    const ok = await persistirPermilagens(updated);
    alert(ok ? "As permilagens foram ajustadas proporcionalmente de forma automática para somar 1000‰ legais!" : "As permilagens foram ajustadas no ecrã, mas houve um erro a gravar no Supabase — tente novamente.");
  };

  // Batch emit from Calculator
  const emitirQuotasDoCalculador = () => {
    if (totalPermilagem !== 1000) {
      return alert("Impossível emitir quotas legalmente! A soma das permilagens do edifício deve ser exatamente de 1000‰. Ajuste as permilagens primeiro.");
    }
    if (!setAvisos || !avisos) {
      return alert("Sistema financeiro indisponível de momento.");
    }

    const novosAvisos: Aviso[] = [];
    const d = new Date();
    const dataDoc = d.toISOString().split('T')[0];

    const regularVal = Number(orcamentoRegular) || 0;
    const extraVal = Number(orcamentoExtra) || 0;

    if (regularVal <= 0 && extraVal <= 0) {
      return alert("Defina pelo menos um orçamento regular ou extraordinário maior do que 0€!");
    }

    predioFracoes.forEach(f => {
      if (regularVal > 0) {
        const valorRegularProporcional = Math.round((regularVal * (f.permilagem / 1000)) * 100) / 100;
        novosAvisos.push({
          id_aviso: "av-" + Math.floor(10000 + Math.random() * 90000),
          id_predio: predio.id_predio,
          id_fracao: f.id_fracao,
          tipo: "Cota Ordinária",
          data: dataDoc,
          vencimento: dataLimiteRegular,
          descricao: `Quota Ordinária Proporcional - Ref Permilagem ${f.permilagem}‰`,
          valor: valorRegularProporcional,
          estado: "Pendente"
        });
      }

      if (extraVal > 0) {
        const valorExtraProporcional = Math.round((extraVal * (f.permilagem / 1000)) * 100) / 100;
        novosAvisos.push({
          id_aviso: "av-" + Math.floor(10000 + Math.random() * 90000),
          id_predio: predio.id_predio,
          id_fracao: f.id_fracao,
          tipo: "Quota Extraordinária",
          data: dataDoc,
          vencimento: dataLimiteExtra,
          descricao: `${descricaoExtra} - Proporcional ${f.permilagem}‰`,
          valor: valorExtraProporcional,
          estado: "Pendente"
        });
      }
    });

    setAvisos([...avisos, ...novosAvisos]);
    saveAvisosToSupabase(novosAvisos).catch(console.error);
    registarLogAuditoria(
      "Financeira",
      `Emitiu ${novosAvisos.length} avisos via calculador de permilagens`,
      predio.id_predio,
      loggedUser
    );
    alert(`Emissão em Lote Concluída! Foram emitidos com sucesso os avisos de pagamento para as ${predioFracoes.length} frações do prédio.`);
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex justify-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm no-print">
        <div className="flex flex-wrap gap-2 items-center relative">
          {/* Botão Principal de Filtro & Relatórios */}
          <button 
            type="button"
            onClick={() => setIsFiltroRelatoriosOpen(true)} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            title="Abrir Filtro Dinâmico para exportar relatórios por prédio, por fração ou todas"
          >
            <img src="/marca/16-documentos-relatorios.png" alt="Relatórios" className="h-4 w-4 object-contain" onError={(e) => { e.currentTarget.src = "/marca/18-pdf.png"; }} />
            <span>Filtro & Relatórios</span>
          </button>

          {/* Caixa Multi-Escolha de Opções de Exportação */}
          <div className="relative">
            <button 
              type="button"
              onClick={() => setIsOpcoesExportacaoOpen(!isOpcoesExportacaoOpen)} 
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-2 shadow-xs border border-slate-700"
              title="Opções de Exportação e Fichas"
            >
              <i className="fa-solid fa-file-export text-emerald-400 text-xs"></i>
              <span>Opções de Exportação</span>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${isOpcoesExportacaoOpen ? "rotate-180" : ""}`}></i>
            </button>

            {isOpcoesExportacaoOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-1.5 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpcoesExportacaoOpen(false);
                    setIsFichaEditavelOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-2.5"
                >
                  <span className="text-base">📄</span>
                  <div>
                    <div className="font-bold">Ficha PDF (Vazia & Editável)</div>
                    <div className="text-[10px] text-slate-400">Preencher / editar e descarregar ficha</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpcoesExportacaoOpen(false);
                    downloadListaCondominosPDF(predio.nome, predioFracoes);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-2.5"
                >
                  <span className="text-base">📋</span>
                  <div>
                    <div className="font-bold">Fichas Preenchidas (PDF)</div>
                    <div className="text-[10px] text-slate-400">Relatório completo em PDF</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpcoesExportacaoOpen(false);
                    exportarCondonimosXLS();
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-2.5"
                >
                  <span className="text-base">📊</span>
                  <div>
                    <div className="font-bold">Exportar Excel (XLS)</div>
                    <div className="text-[10px] text-slate-400">Tabela de condóminos e frações em XLS</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navegação entre Sub-Módulos de Frações & Proprietários */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-1.5 no-print">
        <button
          type="button"
          onClick={() => setCurrentSubTab("fracoes_nova")}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            currentSubTab === "fracoes_nova"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60"
          }`}
        >
          <i className="fa-solid fa-hotel text-xs"></i>
          <span>1. Frações Autónomas</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
            currentSubTab === "fracoes_nova" ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-700"
          }`}>
            {predioFracoes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentSubTab("fracoes_proprietario")}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            currentSubTab === "fracoes_proprietario"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60"
          }`}
        >
          <i className="fa-solid fa-user-check text-xs"></i>
          <span>2. Proprietários</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
            currentSubTab === "fracoes_proprietario" ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-700"
          }`}>
            {todosProprietarios.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentSubTab("fracoes_perfis")}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            currentSubTab === "fracoes_perfis"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60"
          }`}
        >
          <i className="fa-solid fa-id-card text-xs"></i>
          <span>3. Perfis & Fichas</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentSubTab("residentes_inquilinos")}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            currentSubTab === "residentes_inquilinos"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60"
          }`}
        >
          <i className="fa-solid fa-users-rectangle text-xs"></i>
          <span>4. Residentes & Inquilinos</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentSubTab("permilagens_auto")}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            currentSubTab === "permilagens_auto"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60"
          }`}
        >
          <i className="fa-solid fa-calculator text-xs"></i>
          <span>5. Cálculo Permilagens</span>
        </button>
      </div>

      {/* SUB-MENU 1: CADASTRAR / EDITAR FRAÇÃO */}
      {currentSubTab === "fracoes_nova" && (loggedUser.role === 'ADMIN' || loggedUser.role === 'EMPRESA_GESTORA') && (
        <div className="space-y-6">
          {/* Banner de Sucesso pós-criação com navegação direta para Proprietário */}
          {justCreatedFracao && (
            <div className="bg-emerald-50 border-2 border-emerald-300 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-emerald-600 text-white rounded-lg flex items-center justify-center font-bold">
                  <i className="fa-solid fa-check"></i>
                </span>
                <div>
                  <h4 className="text-sm font-bold text-emerald-900">
                    Fração {justCreatedFracao.fracao_nome} ({justCreatedFracao.piso}) registada com sucesso!
                  </h4>
                  <p className="text-xs text-emerald-700">
                    Deseja associar agora o Proprietário a esta fração?
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFracaoId(justCreatedFracao.id_fracao);
                    limparFormProprietario();
                    setCurrentSubTab("fracoes_proprietario");
                    setJustCreatedFracao(null);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition-all flex items-center gap-2 shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <i className="fa-solid fa-user-plus"></i>
                  <span>Adicionar Proprietário a esta Fração</span>
                </button>
                <button
                  type="button"
                  onClick={() => setJustCreatedFracao(null)}
                  className="text-slate-500 hover:text-slate-700 px-2 py-1 text-xs cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}

          {/* Formulário de Fração */}
          <form id="form-registo-fracao" onSubmit={submeterNovaFracao} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 no-print">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <i className="fa-solid fa-hotel text-xs"></i>
                </span>
                <span>{editingFracaoId ? `Editar Fração: ${fracaoNome || "..."}` : "Registar Nova Fração Autónoma"}</span>
              </h3>
              {editingFracaoId && (
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">
                    Modo Edição Ativo
                  </span>
                  <button
                    type="button"
                    onClick={cancelarEdicaoFracao}
                    className="text-xs text-slate-500 hover:text-slate-700 font-semibold underline cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-700 mb-1">Fração *</label>
                <input 
                  type="text" 
                  value={fracaoNome} 
                  onChange={e => setFracaoNome(e.target.value)} 
                  placeholder="Ex: A, B, 1º Dto, Loja 1" 
                  className="border border-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-bold text-slate-800 bg-white" 
                  required
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-700 mb-1">Piso / Designação *</label>
                <input 
                  type="text" 
                  value={piso} 
                  onChange={e => setPiso(e.target.value)} 
                  placeholder="Ex: 1º Andar Direito, R/C" 
                  className="border border-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white" 
                  required
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-700 mb-1">Tipologia *</label>
                <select 
                  value={tipologia} 
                  onChange={e => setTipologia(e.target.value)} 
                  className="border border-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white font-medium text-slate-700"
                  required
                >
                  <option value="T0">T0</option>
                  <option value="T1">T1</option>
                  <option value="T2">T2</option>
                  <option value="T3">T3</option>
                  <option value="T4">T4</option>
                  <option value="T5">T5</option>
                  <option value="T6+">T6+</option>
                  <option value="Loja Comercial">Loja Comercial</option>
                  <option value="Garagem / Box">Garagem / Box</option>
                  <option value="Arrecadação Autónoma">Arrecadação Autónoma</option>
                  <option value="Escritório / Serviços">Escritório / Serviços</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-700 mb-1">Permilagem / M2 (‰) *</label>
                <input 
                  type="number" 
                  min="1" 
                  max="1000" 
                  value={permilagem} 
                  onChange={e => setPermilagem(e.target.value)} 
                  placeholder="Ex: 125" 
                  className="border border-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono font-bold text-slate-800 bg-white" 
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-600 mb-1">Tipo de Acesso (Critério de Isenção)</label>
                <select 
                  value={tipoAcesso} 
                  onChange={e => setTipoAcesso(e.target.value)} 
                  className="border border-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white"
                >
                  <option value="Acesso Comum pelas Escadas">Acesso pelas Escadas / Elevadores comuns</option>
                  <option value="Acesso Direto pelo Exterior sem Escadas">Acesso Direto pelo Exterior (Isento Escadas/Elevadores)</option>
                </select>
              </div>
              <div className="flex items-center gap-6 pt-5">
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={garagem} 
                    onChange={e => setGaragem(e.target.checked)} 
                    className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" 
                  />
                  <span>Lugar de Garagem / Estacionamento</span>
                </label>
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={arrecadacao} 
                    onChange={e => setArrecadacao(e.target.checked)} 
                    className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" 
                  />
                  <span>Arrecadação / Box</span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button 
                type="submit" 
                className="border-2 border-emerald-500 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-md hover:shadow-lg active:ring-2 active:ring-emerald-400 select-none"
              >
                <img src="/estados-acoes/12-adicionar.png" alt="Guardar" className="h-4 w-4 object-contain" />
                <span>{editingFracaoId ? "Guardar Alterações da Fração" : "Guardar Fração"}</span>
              </button>

              {editingFracaoId && (
                <button
                  type="button"
                  onClick={cancelarEdicaoFracao}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar Edição
                </button>
              )}
            </div>
          </form>

          {/* TABELA DE FRAÇÕES REGISTADAS APÓS REGISTO */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <i className="fa-solid fa-table-list text-emerald-600"></i>
                  <span>Frações Registadas no Edifício ({predioFracoes.length})</span>
                </h3>
                <p className="text-xs text-slate-500">Lista completa de frações autónomas e respetivas permilagens</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    cancelarEdicaoFracao();
                    setCurrentSubTab("fracoes_nova");
                    const el = document.getElementById("form-registo-fracao");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="Registar uma nova fração"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Fração</span>
                </button>
                <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
                  totalPermilagem === 1000 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  Total Permilagem: {totalPermilagem}‰ / 1000‰
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3">Fração</th>
                    <th className="py-2.5 px-3">Piso / Descrição</th>
                    <th className="py-2.5 px-3">Tipologia</th>
                    <th className="py-2.5 px-3 text-right">Permilagem / M2</th>
                    <th className="py-2.5 px-3">Proprietário Principal</th>
                    <th className="py-2.5 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {predioFracoes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Nenhuma fração registada ainda neste condomínio. Utilize o formulário acima para registar a primeira fração.
                      </td>
                    </tr>
                  ) : (
                    predioFracoes.map((f) => (
                      <tr key={f.id_fracao} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          <span className="bg-slate-100 px-2 py-1 rounded text-slate-800 font-mono">
                            Fração {f.fracao_nome}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{f.piso}</td>
                        <td className="py-2.5 px-3">
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-semibold text-[11px]">
                            {f.tipologia || "T2"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                          {f.permilagem}‰
                        </td>
                        <td className="py-2.5 px-3">
                          {f.proprietario ? (
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">{f.proprietario.nome}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  carregarProprietarioParaEdicao(f.proprietario!, f.id_fracao);
                                }}
                                className="text-[11px] text-emerald-600 hover:text-emerald-800 font-bold underline cursor-pointer"
                              >
                                (Ver/Editar)
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                Sem Proprietário
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedFracaoId(f.id_fracao);
                                  limparFormProprietario();
                                  setCurrentSubTab("fracoes_proprietario");
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-[10px] cursor-pointer transition-all shadow-xs flex items-center gap-1"
                                title="Associar Proprietário a esta Fração"
                              >
                                <i className="fa-solid fa-user-plus text-[9px]"></i>
                                <span>Associar Proprietário</span>
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditarFracao(f)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-1.5 rounded-lg text-xs transition-colors cursor-pointer border border-emerald-200 flex items-center gap-1 shadow-xs"
                              title="Editar Fração"
                            >
                              <Pencil className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="font-semibold text-[10px]">Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEliminarFracao(f.id_fracao, f.fracao_nome)}
                              className="bg-red-50 hover:bg-red-100 text-red-700 p-1.5 rounded-lg text-xs transition-colors cursor-pointer border border-red-200 flex items-center gap-1 shadow-xs"
                              title="Eliminar Fração"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-600 shrink-0" />
                              <span className="font-semibold text-[10px]">Eliminar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MENU 2: CADASTRAR / EDITAR PROPRIETÁRIO */}
      {currentSubTab === "fracoes_proprietario" && (loggedUser.role === 'ADMIN' || loggedUser.role === 'EMPRESA_GESTORA') && (
        <div className="space-y-6">
          <form onSubmit={submeterEditarProprietario} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 no-print">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <i className="fa-solid fa-user-check text-xs"></i>
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {editingOwnerKey ? `Editar Proprietário: ${propNome || "..."}` : "Registar / Editar Proprietário"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    O formulário de proprietário é independente. Pode registar livremente e associar a qualquer fração.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {editingOwnerKey && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">
                      Modo Edição Ativo
                    </span>
                    <button
                      type="button"
                      onClick={limparFormProprietario}
                      className="text-xs text-slate-500 hover:text-slate-700 font-semibold underline cursor-pointer"
                    >
                      Limpar / Novo
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-600 font-bold whitespace-nowrap">Associar à Fração:</span>
                  <select 
                    value={selectedFracaoId || ""} 
                    onChange={e => {
                      const newFracaoId = e.target.value;
                      setSelectedFracaoId(newFracaoId);
                      // Se a fração selecionada já tiver proprietário e o formulário estiver vazio, pergunta se quer carregar
                      if (newFracaoId) {
                        const targetFracao = predioFracoes.find(f => f.id_fracao === newFracaoId);
                        if (targetFracao?.proprietario && !propNome.trim()) {
                          carregarProprietarioParaEdicao(targetFracao.proprietario, newFracaoId);
                        }
                      }
                    }}
                    className="border border-slate-300 bg-white px-3 py-1 text-xs rounded-md font-bold text-slate-700 focus:outline-emerald-500 max-w-[220px]"
                  >
                    <option value="">-- Sem Fração (Registo Geral) --</option>
                    {predioFracoes.map(f => (
                      <option key={f.id_fracao} value={f.id_fracao}>
                        Fração {f.fracao_nome} ({f.piso}) {f.proprietario ? `- ${f.proprietario.nome}` : "(Sem Proprietário)"}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setCurrentSubTab("fracoes_nova")}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-2.5 py-1 rounded transition-colors cursor-pointer whitespace-nowrap"
                    title="Abrir ecrã de frações"
                  >
                    <i className="fa-solid fa-hotel mr-1 text-emerald-600"></i>
                    <span>Ver Frações</span>
                  </button>
                </div>
              </div>
            </div>

            {transferindoPropriedadeDe && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-xs text-amber-800 leading-relaxed">
                  <i className="fa-solid fa-right-left mr-1.5"></i>
                  <strong>Transferência de Propriedade em curso</strong> — está a registar o novo proprietário da Fração{" "}
                  {predioFracoes.find(f => f.id_fracao === selectedFracaoId)?.fracao_nome}. Ao gravar, <strong>{transferindoPropriedadeDe.nome}</strong> será arquivado no histórico da fração (os documentos e recibos já emitidos em seu nome mantêm-se consultáveis).
                </p>
                <button
                  type="button"
                  onClick={limparFormProprietario}
                  className="text-xs text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer whitespace-nowrap"
                >
                  Cancelar Transferência
                </button>
              </div>
            )}

            {/* Ficha do Proprietário Principal */}
            <div className="pt-2 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="p-1 bg-emerald-50 text-emerald-600 rounded"><i className="fa-solid fa-user-check text-xs"></i></span>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Identificação do Proprietário Principal</h4>
                </div>
                {selectedFracaoId && (
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                    Ligado a: {predioFracoes.find(f => f.id_fracao === selectedFracaoId)?.fracao_nome || selectedFracaoId}
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-700 mb-1">Nome Completo *</label>
                  <input 
                    type="text" 
                    value={propNome} 
                    onChange={e => setPropNome(e.target.value)} 
                    placeholder="Ex: José Carlos Alves Guerra" 
                    className="border border-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white font-medium text-slate-800" 
                    required
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-700 mb-1">NIF Fiscal *</label>
                  <input 
                    type="text" 
                    value={propNif}
                    onChange={e => setPropNif(e.target.value)}
                    placeholder="Ex: 221230475 ou NA se recusar"
                    className="border border-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono bg-white font-medium text-slate-800" 
                    required
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-700 mb-1">E-mail *</label>
                  <input
                    type="text"
                    value={propEmail}
                    onChange={e => setPropEmail(e.target.value)}
                    placeholder="Ex: jose@email.com ou NA se recusar"
                    className="border border-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono bg-white font-medium text-slate-800"
                    required
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-700 mb-1">Telemóvel *</label>
                  <input 
                    type="text" 
                    value={propTlm}
                    onChange={e => setPropTlm(e.target.value)}
                    placeholder="Ex: 912345678 ou NA se recusar"
                    className="border border-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono bg-white font-medium text-slate-800" 
                    required
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <i className="fa-solid fa-cake-candles text-amber-500 text-xs"></i>
                    <span>Data de Nascimento</span>
                  </label>
                  <input 
                    type="date" 
                    value={propDataNascimento} 
                    onChange={e => setPropDataNascimento(e.target.value)} 
                    className="border border-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white font-medium text-slate-800" 
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5">Para cartão de aniversário</span>
                </div>
              </div>

              {/* Campos Obrigatórios Migrados: Administrador Interno & Notificação */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-emerald-50/40 p-4 rounded-xl border border-emerald-100">
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <i className="fa-solid fa-user-shield text-emerald-600"></i>
                    <span>É o Administrador Interno? *</span>
                  </label>
                  <select 
                    value={adminInterno} 
                    onChange={e => setAdminInterno(e.target.value)} 
                    className="border border-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white font-semibold text-slate-800"
                    required
                  >
                    <option value="Não">Não (Condómino Normal)</option>
                    <option value="Sim">Sim (Administrador Interno do Condomínio)</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Indica se este condómino exerce funções de administração interna no prédio.
                  </p>
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <i className="fa-solid fa-bell text-emerald-600"></i>
                    <span>Como quer ser Notificado? *</span>
                  </label>
                  <select 
                    value={notificacao} 
                    onChange={e => setNotificacao(e.target.value)} 
                    className="border border-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white font-semibold text-slate-800"
                    required
                  >
                    <option value="Digital (E-mail e Mensagens Push)">Digital (E-mail e Mensagens Push)</option>
                    <option value="Correio Postal (Físico)">Correio Postal (Físico)</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Método legal para envio de convocatórias, atas e avisos de pagamento.
                  </p>
                </div>
              </div>

              {/* Recolha de Assinatura Digital do Administrador (quando adminInterno === 'Sim') */}
              {adminInterno === "Sim" && (
                <div className="p-4 bg-slate-50 border-2 border-emerald-300 rounded-xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <i className="fa-solid fa-signature text-emerald-600 text-sm"></i>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Recolha de Assinatura Digital do Administrador (para uso nos documentos oficiais)
                      </h4>
                    </div>
                    <span className="text-[10px] text-slate-500 italic">
                      Desenho no ecrã ou carregamento de imagem/PDF
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Pad de Desenho Directo */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-600 uppercase block">
                        1. Assinar no Ecrã (Mouse / Touch)
                      </label>
                      <div className="border border-slate-300 rounded-lg overflow-hidden bg-white relative">
                        <canvas
                          ref={adminCanvasRef}
                          width={320}
                          height={120}
                          className="w-full h-[120px] bg-slate-50 block cursor-crosshair touch-none"
                          onMouseDown={startDrawingAdmin}
                          onMouseMove={drawAdmin}
                          onMouseUp={stopDrawingAdmin}
                          onMouseLeave={stopDrawingAdmin}
                          onTouchStart={startDrawingAdmin}
                          onTouchMove={drawAdmin}
                          onTouchEnd={stopDrawingAdmin}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={clearAdminCanvas}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-2.5 py-1 text-[10px] rounded cursor-pointer"
                        >
                          Limpar
                        </button>
                        <button
                          type="button"
                          onClick={saveAdminCanvasSignature}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 text-[10px] rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs"
                        >
                          <i className="fa-solid fa-floppy-disk"></i>
                          <span>Gravar Assinatura Desenhada</span>
                        </button>
                      </div>
                    </div>

                    {/* Upload de Imagem ou PDF */}
                    <div className="space-y-2 flex flex-col justify-between">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                          2. Ou Carregar Ficheiro de Assinatura / PDF
                        </label>
                        <input
                          type="file"
                          ref={adminSigFileRef}
                          accept="image/*,.pdf"
                          onChange={handleAdminSignatureFileUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => adminSigFileRef.current?.click()}
                          className="w-full border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-white p-3 rounded-lg text-center cursor-pointer transition-all space-y-1"
                        >
                          <i className="fa-solid fa-file-arrow-up text-emerald-600 text-lg"></i>
                          <p className="text-xs font-bold text-slate-700">Carregar Imagem ou PDF de Assinatura</p>
                          <p className="text-[9.5px] text-slate-400">Suporta PNG, JPG, WEBP e PDF</p>
                        </button>
                      </div>

                      {adminSignatureSaved && (
                        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <i className="fa-solid fa-circle-check text-emerald-600 text-sm"></i>
                            <span className="text-[10px] font-bold text-emerald-800">Assinatura Ativa Guardada</span>
                          </div>
                          {adminSignatureSaved.startsWith("data:image") && (
                            <img src={adminSignatureSaved} alt="Assinatura Administrador" className="h-8 max-w-[120px] object-contain border border-emerald-200 bg-white rounded p-0.5" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Informação Bancária e Fotografia */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Referência BR23E - Conciliação de Dados (Exclusivo do Perfil Bancário, Não Editável) */}
                <div className="flex flex-col bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-200/80 dark:border-emerald-800/60">
                  <label className="text-xs font-bold text-emerald-900 dark:text-emerald-300 mb-1 flex items-center justify-between">
                    <span>Referência BR23E</span>
                    <span className="text-[9px] bg-emerald-200/80 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 px-1.5 py-0.2 rounded font-bold">Auto</span>
                  </label>
                  <input 
                    type="text" 
                    readOnly 
                    disabled 
                    value={
                      selectedFracaoId 
                        ? (predioFracoes.find(f => f.id_fracao === selectedFracaoId)?.referencia_br23e || 
                           predioFracoes.find(f => f.id_fracao === selectedFracaoId)?.proprietario?.referencia_br23e || 
                           gerarReferenciaBR23E(predioFracoes.find(f => f.id_fracao === selectedFracaoId)?.fracao_nome, selectedFracaoId))
                        : "Aguardando Fração"
                    } 
                    title="Referência bancária BR23E gerada e guardada automaticamente pelo sistema para conciliação (não editável)"
                    className="w-full border border-emerald-300 dark:border-emerald-700 px-2.5 py-1.5 text-xs rounded font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-900 cursor-not-allowed select-all" 
                  />
                  <span className="text-[9px] text-emerald-700/80 dark:text-emerald-400 mt-1 font-medium">Conciliação automática</span>
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-600 mb-1">IBAN de Origem</label>
                  <input type="text" value={propIban} onChange={e => setPropIban(e.target.value)} placeholder="PT50..." className="border border-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono bg-white" />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-600 mb-1">Titular da Conta Bancária</label>
                  <input type="text" value={propTitular} onChange={e => setPropTitular(e.target.value)} placeholder="Nome do titular" className="border border-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white" />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-600 mb-1">Entidade Bancária</label>
                  <input type="text" value={propBanco} onChange={e => setPropBanco(e.target.value)} placeholder="Ex: BPI, CGD, ActivoBank" className="border border-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white" />
                </div>

                <div className="flex flex-col col-span-2 sm:col-span-3 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-600">Contas Bancárias Adicionais</label>
                    <button
                      type="button"
                      onClick={() => setPropContasAdicionais(prev => [...prev, { titular: "", iban: "", entidade_bancaria: "" }])}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer flex items-center gap-1"
                    >
                      <i className="fa-solid fa-plus"></i> Adicionar Conta
                    </button>
                  </div>
                  <p className="text-[9.5px] text-slate-400">Útil quando o pagamento pode vir de outra conta (ex: cônjuge, conta conjunta) — usado na conciliação para identificar a fração automaticamente pelo IBAN de quem pagou.</p>
                  {propContasAdicionais.length === 0 && (
                    <p className="text-[10px] text-slate-400 italic">Nenhuma conta adicional registada.</p>
                  )}
                  {propContasAdicionais.map((conta, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center bg-white border border-slate-200 rounded-lg p-2">
                      <input
                        type="text"
                        value={conta.iban}
                        onChange={e => setPropContasAdicionais(prev => prev.map((c, i) => i === idx ? { ...c, iban: e.target.value } : c))}
                        placeholder="IBAN adicional (PT50...)"
                        className="border border-slate-300 px-2.5 py-1.5 text-xs rounded-lg focus:outline-emerald-500 font-mono bg-white"
                      />
                      <input
                        type="text"
                        value={conta.titular}
                        onChange={e => setPropContasAdicionais(prev => prev.map((c, i) => i === idx ? { ...c, titular: e.target.value } : c))}
                        placeholder="Titular"
                        className="border border-slate-300 px-2.5 py-1.5 text-xs rounded-lg focus:outline-emerald-500 bg-white"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={conta.entidade_bancaria || ""}
                          onChange={e => setPropContasAdicionais(prev => prev.map((c, i) => i === idx ? { ...c, entidade_bancaria: e.target.value } : c))}
                          placeholder="Banco"
                          className="border border-slate-300 px-2.5 py-1.5 text-xs rounded-lg focus:outline-emerald-500 bg-white flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => setPropContasAdicionais(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-600 cursor-pointer shrink-0"
                          title="Remover esta conta"
                        >
                          <i className="fa-solid fa-trash text-xs"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-600 mb-1">Fotografia de Perfil</label>
                  <div className="flex items-center space-x-2">
                    <button type="button" onClick={() => {
                      const numProprietariosComFoto = (propFoto ? 1 : 0) + proprietariosAdicionais.filter(p => p.foto).length;
                      if (numProprietariosComFoto >= 2 && !propFoto) {
                        alert("Limite atingido! Máximo de 2 proprietários com fotografia por fração.");
                        return;
                      }
                      propFileRef.current?.click();
                    }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 flex items-center space-x-1.5 cursor-pointer">
                      <i className="fa-solid fa-camera"></i>
                      <span>Carregar Foto</span>
                    </button>
                    <input ref={propFileRef} type="file" accept="image/*" onChange={(e) => {
                      const numProprietariosComFoto = (propFoto ? 1 : 0) + proprietariosAdicionais.filter(p => p.foto).length;
                      if (numProprietariosComFoto >= 2 && !propFoto) {
                        alert("Limite atingido! Máximo de 2 proprietários com fotografia por fração.");
                        return;
                      }
                      processarFotoWebP(e, setPropFoto);
                    }} className="hidden" />
                    {propFoto && (
                      <div className="relative">
                        <img src={propFoto} className="h-9 w-9 rounded-full object-cover border border-slate-300" referrerPolicy="no-referrer" />
                        <button type="button" onClick={() => setPropFoto(null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 text-[8px] hover:bg-red-600"><i className="fa-solid fa-xmark"></i></button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Co-proprietários */}
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <div className="flex items-center space-x-3">
                <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded"><i className="fa-solid fa-users text-[#1A1A1A]"></i></span>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Coproprietários Adicionais</h4>
              </div>

              {proprietariosAdicionais.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                  <p className="text-[10px] font-bold text-slate-600">Coproprietários adicionados a esta fração:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {proprietariosAdicionais.map((co, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-slate-200">
                        <div className="flex items-center space-x-2">
                          {co.foto ? (
                            <img src={co.foto} className="h-7 w-7 rounded-full object-cover border border-slate-300" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold">{co.nome.slice(0,2).toUpperCase()}</div>
                          )}
                          <div>
                            <p className="text-xs font-bold text-slate-800">{co.nome}</p>
                            <p className="text-[9px] text-slate-500 font-mono">
                              NIF: {co.nif} | {co.email}
                              {co.data_nascimento && ` • 🎂 ${co.data_nascimento}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={reenviandoConviteCoIdx === idx}
                            onClick={async () => {
                              // Reenvia o link de acesso ao mesmo email (sem alterar dados) —
                              // essencial quando o link original expirou (o Supabase expira-os
                              // ao fim de 24h) ou nunca chegou, já que editar e gravar sem
                              // mudar o email não reenvia nada (só reenvia quando o email muda).
                              if (!co.email) {
                                alert("Este coproprietário não tem email registado.");
                                return;
                              }
                              setReenviandoConviteCoIdx(idx);
                              try {
                                const resp = await fetch("/api/admin?acao=convidar", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    email: co.email,
                                    nome: co.nome,
                                    role: "COPROPRIETARIO",
                                    id_predio: predio.id_predio,
                                    id_fracao: selectedFracaoId
                                  })
                                });
                                const data = await resp.json();
                                if (resp.ok && data.ok) {
                                  alert(`✅ Convite de acesso reenviado para ${co.email}. O link anterior deixa de ser válido — só o novo email funciona.`);
                                } else {
                                  alert(`❌ Não foi possível reenviar o convite: ${data?.error || "erro desconhecido"}.`);
                                }
                              } catch (err) {
                                alert(`❌ Não foi possível reenviar o convite: ${err instanceof Error ? err.message : "erro de rede"}.`);
                              } finally {
                                setReenviandoConviteCoIdx(null);
                              }
                            }}
                            className="text-emerald-500 hover:text-emerald-700 disabled:opacity-40 p-1 text-xs cursor-pointer"
                            title="Reenviar Convite de Acesso (link expirado ou nunca recebido)"
                          >
                            <i className={`fa-solid ${reenviandoConviteCoIdx === idx ? "fa-spinner fa-spin" : "fa-paper-plane"}`}></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCoNome(co.nome || "");
                              setCoNif(co.nif || "");
                              setCoEmail(co.email || "");
                              setCoTlm(co.tlm || "");
                              setCoDataNascimento(co.data_nascimento || "");
                              setCoFoto(co.foto || null);
                              setEditingCoIndex(idx);
                              window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
                            }}
                            className="text-indigo-500 hover:text-indigo-700 p-1 text-xs cursor-pointer"
                            title="Editar Coproprietário"
                          >
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const novaLista = proprietariosAdicionais.filter((_, i) => i !== idx);
                              setProprietariosAdicionais(novaLista);
                              if (editingCoIndex === idx) {
                                setEditingCoIndex(null);
                                setCoNome(""); setCoNif(""); setCoEmail(""); setCoTlm(""); setCoDataNascimento(""); setCoFoto(null);
                              }
                              const targetFracaoAtual = selectedFracaoId ? predioFracoes.find(f => f.id_fracao === selectedFracaoId) : null;
                              if (targetFracaoAtual) {
                                const ok = await dbUpdate('fracoes', { proprietarios_adicionais: novaLista }, [['id_fracao', 'eq', selectedFracaoId]]);
                                if (ok) {
                                  const updatedFracao: Fracao = { ...targetFracaoAtual, proprietarios_adicionais: novaLista };
                                  onUpdateFracoes(fracoes.map(f => f.id_fracao === selectedFracaoId ? updatedFracao : f));
                                }
                              }
                            }}
                            className="text-red-500 hover:text-red-700 p-1 text-xs cursor-pointer"
                            title="Remover Coproprietário"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-indigo-50/30 p-4 rounded-xl border border-indigo-100/50 space-y-3">
                <span className="text-[10px] font-bold text-indigo-800 uppercase block tracking-wider">{editingCoIndex !== null ? `A Editar: ${proprietariosAdicionais[editingCoIndex]?.nome || "Coproprietário"}` : "Novo Coproprietário"}</span>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-500 mb-1">Nome Completo</label>
                    <input type="text" value={coNome} onChange={e => setCoNome(e.target.value)} placeholder="Ex: Ana Maria Guerra" className="border border-slate-200 bg-white px-3 py-2 text-sm rounded-lg focus:outline-indigo-500" />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-500 mb-1">NIF Fiscal</label>
                    <input type="text" value={coNif} onChange={e => setCoNif(e.target.value)} placeholder="Ex: 234567890" className="border border-slate-200 bg-white px-3 py-2 text-sm rounded-lg focus:outline-indigo-500 font-mono" />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-500 mb-1">E-mail</label>
                    <input type="email" value={coEmail} onChange={e => setCoEmail(e.target.value)} placeholder="Ex: ana@email.com" className="border border-slate-200 bg-white px-3 py-2 text-sm rounded-lg focus:outline-indigo-500 font-mono" />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-500 mb-1">Telemóvel</label>
                    <input type="text" value={coTlm} onChange={e => setCoTlm(e.target.value)} placeholder="Ex: 919888777" className="border border-slate-200 bg-white px-3 py-2 text-sm rounded-lg focus:outline-indigo-500 font-mono" />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                      <i className="fa-solid fa-cake-candles text-indigo-500 text-xs"></i>
                      <span>Data de Nascimento</span>
                    </label>
                    <input type="date" value={coDataNascimento} onChange={e => setCoDataNascimento(e.target.value)} className="border border-slate-200 bg-white px-3 py-2 text-sm rounded-lg focus:outline-indigo-500" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-500 mb-1">Fotografia do Coproprietário</label>
                    <div className="flex items-center space-x-2">
                      <button type="button" onClick={() => {
                        const numProprietariosComFoto = (propFoto ? 1 : 0) + proprietariosAdicionais.filter(p => p.foto).length;
                        if (numProprietariosComFoto >= 2) {
                          alert("Limite atingido! Máximo de 2 proprietários com fotografia por fração.");
                          return;
                        }
                        coFileRef.current?.click();
                      }} className="bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 flex items-center space-x-1.5 cursor-pointer">
                        <i className="fa-solid fa-camera"></i>
                        <span>Carregar Foto (webp)</span>
                      </button>
                      <input ref={coFileRef} type="file" accept="image/*" onChange={(e) => {
                        const numProprietariosComFoto = (propFoto ? 1 : 0) + proprietariosAdicionais.filter(p => p.foto).length;
                        if (numProprietariosComFoto >= 2) {
                          alert("Limite atingido! Máximo de 2 proprietários com fotografia por fração.");
                          return;
                        }
                        processarFotoWebP(e, setCoFoto);
                      }} className="hidden" />
                      {coFoto && (
                        <div className="relative">
                          <img src={coFoto} className="h-9 w-9 rounded-full object-cover border border-slate-300" referrerPolicy="no-referrer" />
                          <button type="button" onClick={() => setCoFoto(null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 text-[8px] hover:bg-red-600"><i className="fa-solid fa-xmark"></i></button>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={gravandoCoproprietario || enviandoConviteCoproprietario}
                    onClick={async () => {
                      if (!coNome.trim()) {
                        alert("Insira pelo menos o nome do coproprietário.");
                        return;
                      }
                      const numProprietariosComFotoExcluindoEdicao = (propFoto ? 1 : 0) + proprietariosAdicionais.filter((p, i) => p.foto && i !== editingCoIndex).length + (coFoto ? 1 : 0);
                      if (numProprietariosComFotoExcluindoEdicao > 2) {
                        alert("Limite atingido! Máximo de 2 proprietários com fotografia por fração.");
                        return;
                      }
                      const novoCoproprietario = {
                        nome: coNome,
                        nif: coNif,
                        email: coEmail,
                        tlm: coTlm,
                        data_nascimento: coDataNascimento || undefined,
                        foto: coFoto
                      };
                      const emailAnterior = editingCoIndex !== null ? proprietariosAdicionais[editingCoIndex]?.email : undefined;
                      const isNovoEmailCo = coEmail.trim() && coEmail.trim() !== emailAnterior;
                      const novaLista = editingCoIndex !== null
                        ? proprietariosAdicionais.map((p, i) => i === editingCoIndex ? novoCoproprietario : p)
                        : [...proprietariosAdicionais, novoCoproprietario];
                      setProprietariosAdicionais(novaLista);
                      setEditingCoIndex(null);
                      // Clear inputs
                      setCoNome(""); setCoNif(""); setCoEmail(""); setCoTlm(""); setCoDataNascimento(""); setCoFoto(null);

                      // Grava logo a sério na fração já existente, em vez de
                      // ficar só na lista local à espera que o admin clique
                      // depois em "Gravar Dados do Proprietário" — era fácil
                      // esquecer esse segundo passo e o coproprietário
                      // parecer adicionado sem nunca chegar a ser guardado.
                      const targetFracaoAtual = selectedFracaoId ? predioFracoes.find(f => f.id_fracao === selectedFracaoId) : null;
                      if (targetFracaoAtual) {
                        setGravandoCoproprietario(true);
                        try {
                          const ok = await dbUpdate('fracoes', { proprietarios_adicionais: novaLista }, [['id_fracao', 'eq', selectedFracaoId]]);
                          if (ok) {
                            const updatedFracao: Fracao = { ...targetFracaoAtual, proprietarios_adicionais: novaLista };
                            onUpdateFracoes(fracoes.map(f => f.id_fracao === selectedFracaoId ? updatedFracao : f));
                          } else {
                            alert("⚠️ O coproprietário ficou na lista, mas houve um erro a gravar no Supabase. Tenta novamente ou clica em \"Gravar Dados do Proprietário\".");
                          }
                        } finally {
                          setGravandoCoproprietario(false);
                        }

                        // Convite real de acesso — antes um coproprietário
                        // era só um registo informativo, nunca recebia email
                        // nenhum nem conseguia entrar na plataforma. Mesma
                        // ordem já usada para o proprietário principal:
                        // boas-vindas primeiro, 60s depois a ativação.
                        if (isNovoEmailCo) {
                          setEnviandoConviteCoproprietario(true);
                          try {
                            await fetch("/api/pdf?tipo=boas-vindas", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                nome: coNome.trim(),
                                buildingName: predio.nome,
                                email: coEmail.trim(),
                                predio: predio.id_predio,
                                fracao: selectedFracaoId
                              })
                            }).catch(err => console.warn("[GestaoFracoes] Aviso ao enviar boas-vindas ao coproprietário:", err));

                            await new Promise(resolve => setTimeout(resolve, 60000));

                            const respConvite = await fetch("/api/admin?acao=convidar", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                email: coEmail.trim(),
                                nome: coNome.trim(),
                                role: "COPROPRIETARIO",
                                id_predio: predio.id_predio,
                                id_fracao: selectedFracaoId
                              })
                            });
                            const dataConvite = await respConvite.json();
                            if (respConvite.ok && dataConvite.ok) {
                              alert(`✅ Coproprietário ${coNome.trim()} convidado com sucesso! Foi enviado um email para ${coEmail.trim()} com o guia de boas-vindas e, 60 segundos depois, o link para ativar o acesso e definir a password.`);
                            } else {
                              alert(`⚠️ Coproprietário gravado, mas houve um erro a enviar o convite de acesso. Pode reenviá-lo mais tarde.`);
                            }
                          } finally {
                            setEnviandoConviteCoproprietario(false);
                          }
                        }
                      }
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <i className={`fa-solid ${editingCoIndex !== null ? "fa-check" : "fa-plus"} mr-1`}></i> {enviandoConviteCoproprietario ? "A enviar convite (não feche esta janela)..." : gravandoCoproprietario ? "A gravar..." : editingCoIndex !== null ? "Guardar Alterações" : "Adicionar Coproprietário"}
                  </button>
                  {editingCoIndex !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCoIndex(null);
                        setCoNome(""); setCoNif(""); setCoEmail(""); setCoTlm(""); setCoDataNascimento(""); setCoFoto(null);
                      }}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Arrendamento & Inquilino */}
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <label className="flex items-center space-x-3 text-sm font-semibold text-slate-700 cursor-pointer select-none">
                <input type="checkbox" checked={arrendada} onChange={e => setArrendada(e.target.checked)} className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" />
                <span className="font-bold text-slate-800">A fração está Arrendada? (Abre registo de Inquilino)</span>
              </label>

              {arrendada && (
                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200 animate-fadeIn">
                  <div className="flex items-center space-x-2">
                    <span className="text-violet-600"><i className="fa-solid fa-house-user"></i></span>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Identificação do Inquilino</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-slate-500 mb-1">Nome Completo do Inquilino</label>
                      <input type="text" value={inqNome} onChange={e => setInqNome(e.target.value)} placeholder="Ex: Ricardo Inquilino" className="border border-slate-200 bg-white px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-slate-500 mb-1">NIF Fiscal Inquilino</label>
                      <input type="text" value={inqNif} onChange={e => setInqNif(e.target.value)} placeholder="Contribuinte" className="border border-slate-200 bg-white px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono" />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-slate-500 mb-1">E-mail</label>
                      <input type="email" value={inqEmail} onChange={e => setInqEmail(e.target.value)} placeholder="ricardo@email.com" className="border border-slate-200 bg-white px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono" />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-slate-500 mb-1">Telemóvel</label>
                      <input type="text" value={inqTlm} onChange={e => setInqTlm(e.target.value)} placeholder="929887766" className="border border-slate-200 bg-white px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono" />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                        <i className="fa-solid fa-cake-candles text-amber-500 text-xs"></i>
                        <span>Data de Nascimento</span>
                      </label>
                      <input type="date" value={inqDataNascimento} onChange={e => setInqDataNascimento(e.target.value)} className="border border-slate-200 bg-white px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="flex flex-col col-span-3">
                      <label className="text-xs font-semibold text-slate-500 mb-1">Morada de Residência Alternativa do Proprietário (Obrigatório se Arrendado)</label>
                      <input type="text" value={propMoradaAlt} onChange={e => setPropMoradaAlt(e.target.value)} placeholder="Morada onde o proprietário vive" className="border border-slate-200 bg-white px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-slate-500 mb-1">Fotografia do Inquilino</label>
                      <div className="flex items-center space-x-2">
                        <button type="button" onClick={() => inqFileRef.current?.click()} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 flex items-center space-x-1.5 cursor-pointer">
                          <i className="fa-solid fa-camera"></i>
                          <span>Carregar Foto</span>
                        </button>
                        <input ref={inqFileRef} type="file" accept="image/*" onChange={(e) => processarFotoWebP(e, setInqFoto)} className="hidden" />
                        {inqFoto && (
                          <div className="relative">
                            <img src={inqFoto} className="h-9 w-9 rounded-full object-cover border border-slate-300" referrerPolicy="no-referrer" />
                            <button type="button" onClick={() => setInqFoto(null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 text-[8px] hover:bg-red-600"><i className="fa-solid fa-xmark"></i></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={enviandoConvites}
                className="border-2 border-emerald-500 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-md hover:shadow-lg active:ring-2 active:ring-emerald-400 select-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <img src="/estados-acoes/12-adicionar.png" alt="Guardar" className="h-4 w-4 object-contain" />
                <span>{enviandoConvites ? "A enviar emails (não feche esta janela)..." : editingOwnerKey ? "Guardar Alterações do Proprietário" : "Guardar Proprietário"}</span>
              </button>

              <button
                type="button"
                onClick={limparFormProprietario}
                disabled={enviandoConvites}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Limpar Campos / Novo
              </button>
            </div>
          </form>

          {/* TABELA DE PROPRIETÁRIOS REGISTADOS (Substitui os cartões antigos) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <i className="fa-solid fa-users text-emerald-600"></i>
                  <span>Proprietários Registados ({todosProprietarios.length})</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Lista tabular completa de condóminos, administradores internos e contactos
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={limparFormProprietario}
                  className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-user-plus text-xs"></i>
                  <span>Novo Proprietário</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3">Proprietário</th>
                    <th className="py-2.5 px-3">NIF Fiscal</th>
                    <th className="py-2.5 px-3">E-mail</th>
                    <th className="py-2.5 px-3">Telemóvel</th>
                    <th className="py-2.5 px-3 text-center">Admin Interno</th>
                    <th className="py-2.5 px-3">Notificação</th>
                    <th className="py-2.5 px-3">Fração Associada</th>
                    <th className="py-2.5 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {todosProprietarios.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Nenhum proprietário registado ainda. Preencha o formulário acima para registar o primeiro condómino.
                      </td>
                    </tr>
                  ) : (
                    todosProprietarios.map((prop, idx) => (
                      <tr key={prop.nif || `${prop.nome}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          <div className="flex items-center gap-2.5">
                            {prop.foto ? (
                              <img 
                                src={prop.foto} 
                                alt={prop.nome} 
                                className="h-7 w-7 rounded-full object-cover border border-slate-200" 
                                referrerPolicy="no-referrer" 
                              />
                            ) : (
                              <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">
                                {prop.nome.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-900">{prop.nome}</div>
                              {prop.iban && (
                                <div className="text-[10px] text-slate-400 font-mono">
                                  IBAN: {prop.iban.slice(0, 8)}...
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-700">
                          {prop.nif || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                          {prop.email || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                          {prop.tlm || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {prop.administrador_interno === "Sim" ? (
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1">
                              <i className="fa-solid fa-shield-halved text-[9px]"></i>
                              <span>Sim</span>
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">
                              Não
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            prop.notificacao_preferencial?.includes("Digital")
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {prop.notificacao_preferencial?.includes("Digital") ? "Digital" : "Correio Postal"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {prop.fracao_nome ? (
                            <span className="bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded font-bold text-[11px]">
                              {prop.fracao_nome}
                            </span>
                          ) : (
                            <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                              Não Associado
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                carregarProprietarioParaEdicao(prop, prop.id_fracao);
                              }}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-1.5 rounded-lg text-xs transition-colors cursor-pointer border border-emerald-200 flex items-center gap-1 shadow-xs"
                              title="Editar Proprietário"
                            >
                              <Pencil className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="font-semibold text-[10px]">Editar</span>
                            </button>
                            {prop.id_fracao && (
                              <button
                                type="button"
                                onClick={() => iniciarTransferenciaPropriedade(prop.id_fracao!)}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-700 p-1.5 rounded-lg text-xs transition-colors cursor-pointer border border-amber-200 flex items-center gap-1 shadow-xs"
                                title="Transferir Propriedade (arquiva este proprietário e regista o novo)"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span className="font-semibold text-[10px]">Transferir</span>
                              </button>
                            )}
                            {prop.id_fracao && (fracoes.find(f => f.id_fracao === prop.id_fracao)?.historico_proprietarios?.length ?? 0) > 0 && (
                              <button
                                type="button"
                                onClick={() => setHistoricoModalFracaoId(prop.id_fracao!)}
                                className="bg-slate-50 hover:bg-slate-100 text-slate-600 p-1.5 rounded-lg text-xs transition-colors cursor-pointer border border-slate-200 flex items-center gap-1 shadow-xs"
                                title="Ver Histórico de Proprietários"
                              >
                                <History className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleEliminarProprietario(prop)}
                              className="bg-red-50 hover:bg-red-100 text-red-700 p-1.5 rounded-lg text-xs transition-colors cursor-pointer border border-red-200 flex items-center gap-1 shadow-xs"
                              title="Eliminar Proprietário"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-600 shrink-0" />
                              <span className="font-semibold text-[10px]">Eliminar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MENU 4: GESTÃO DE RESIDENTES & INQUILINOS (TASK 12) */}
      {currentSubTab === "residentes_inquilinos" && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 no-print animate-fadeIn">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase text-violet-600 bg-violet-50 px-2.5 py-1 rounded border border-violet-100">
                🔥 12. GESTÃO DE RESIDENTES, INQUILINOS E CONTRATOS
              </span>
              <h3 className="text-base font-bold text-slate-800 mt-1 flex items-center gap-2">
                <i className="fa-solid fa-users-rectangle text-violet-600"></i>
                <span>Registo de Entradas/Saídas, Contratos de Arrendamento & Documentos</span>
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {residentesHistorico.filter(r => r.data_saida === null).length} Residentes Ativos
            </span>
          </div>

          {/* Form Registar Nova Entrada */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <i className="fa-solid fa-user-plus text-violet-600"></i>
              <span>Registar Nova Entrada de Residente / Inquilino</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Fração *</label>
                <select value={resFracaoTarget} onChange={e => setResFracaoTarget(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white">
                  <option value="">-- Escolher Fração --</option>
                  {predioFracoes.map(f => (
                    <option key={f.id_fracao} value={f.id_fracao}>Fração {f.fracao_nome} ({f.piso})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Nome Completo *</label>
                <input type="text" value={resNome} onChange={e => setResNome(e.target.value)} placeholder="Ex: Maria Antónia" className="w-full border border-slate-300 rounded-lg p-2 bg-white" />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">NIF *</label>
                <input type="text" value={resNif} onChange={e => setResNif(e.target.value)} placeholder="Ex: 234567890" className="w-full border border-slate-300 rounded-lg p-2 bg-white font-mono" />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">E-mail *</label>
                <input type="email" value={resEmail} onChange={e => setResEmail(e.target.value)} placeholder="residente@email.com" className="w-full border border-slate-300 rounded-lg p-2 bg-white" />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Telefone *</label>
                <input type="text" value={resTlm} onChange={e => setResTlm(e.target.value)} placeholder="912345678" className="w-full border border-slate-300 rounded-lg p-2 bg-white font-mono" />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Data de Entrada *</label>
                <input type="date" value={resDataEntrada} onChange={e => setResDataEntrada(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white font-mono" />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Fim de Contrato / Validade</label>
                <input type="date" value={resContratoFim} onChange={e => setResContratoFim(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white font-mono" />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Valor Renda (€) / Caução (€)</label>
                <div className="flex gap-1">
                  <input type="text" inputMode="decimal" value={resValorRenda} onChange={e => setResValorRenda(e.target.value)} placeholder="Renda €" className="w-1/2 border border-slate-300 rounded-lg p-2 bg-white font-mono" />
                  <input type="text" inputMode="decimal" value={resCaucao} onChange={e => setResCaucao(e.target.value)} placeholder="Caução €" className="w-1/2 border border-slate-300 rounded-lg p-2 bg-white font-mono" />
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={registandoEntrada}
              onClick={async () => {
                if (!resFracaoTarget) return alert("Selecione a fração.");
                if (!resNome || !resNif) return alert("Preencha Nome e NIF do residente.");
                const fracaoInfo = predioFracoes.find(f => f.id_fracao === resFracaoTarget);
                const idNovo = "res-" + Date.now();
                const novoRes = {
                  id: idNovo,
                  id_predio: predio.id_predio,
                  id_fracao: resFracaoTarget,
                  fracao: fracaoInfo ? `Fração ${fracaoInfo.fracao_nome} (${fracaoInfo.piso})` : resFracaoTarget,
                  nome: resNome,
                  nif: resNif,
                  email: resEmail || "residente@email.pt",
                  telefone: resTlm || "910000000",
                  tipo: "Inquilino (Habitação Tradicional)",
                  data_entrada: resDataEntrada,
                  data_saida: null,
                  contrato_fim: resContratoFim,
                  valor_renda: resValorRenda ? parseValorMonetario(resValorRenda) : 800,
                  caucao: resCaucao ? parseValorMonetario(resCaucao) : 1600,
                  chaves_entregues: resChaves,
                  estado: "Ativo"
                };
                setRegistandoEntrada(true);
                const ok = await saveResidenteInquilinoToSupabase(novoRes);
                setRegistandoEntrada(false);
                if (!ok) return alert("❌ Erro ao gravar o registo de entrada no Supabase.");
                setResidentesHistorico([novoRes, ...residentesHistorico]);
                setResNome(""); setResNif(""); setResEmail(""); setResTlm("");
                registarLogAuditoria("Frações", `Registou a entrada do residente "${resNome}" na ${novoRes.fracao}`, predio.id_predio, loggedUser);
                alert("Entrada do residente registada com sucesso!");
              }}
              className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <i className="fa-solid fa-check"></i> {registandoEntrada ? "A registar..." : "Registo de Entrada & Ficha do Inquilino"}
            </button>
          </div>

          {/* Tabela de Residentes & Histórico Cronológico */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <i className="fa-solid fa-clock-rotate-left text-violet-600"></i>
              <span>Histórico Cronológico de Residentes e Contratos por Fração</span>
            </h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-mono text-[10px] uppercase">
                  <tr>
                    <th className="p-3">Fração / Residente</th>
                    <th className="p-3">Contactos & NIF</th>
                    <th className="p-3">Período de Contrato</th>
                    <th className="p-3 text-right">Renda / Caução</th>
                    <th className="p-3 text-center">Estado / Alertas</th>
                    <th className="p-3 text-center">Ações / Saída</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {residentesHistorico.map(res => (
                    <tr key={res.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">{res.fracao}</span>
                        <span className="font-semibold text-violet-700 block">{res.nome}</span>
                        <span className="text-[10px] text-slate-400 block">{res.tipo}</span>
                      </td>
                      <td className="p-3 font-mono">
                        <span className="block font-semibold">{res.nif}</span>
                        <span className="block text-slate-500">{res.email}</span>
                        <span className="block text-slate-400">{res.telefone}</span>
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        <span className="block text-emerald-700">Entrada: {res.data_entrada}</span>
                        <span className="block text-slate-600">Fim: {res.contrato_fim || "Indeterminado"}</span>
                        {res.data_saida && <span className="block text-rose-600 font-bold">Saída: {res.data_saida}</span>}
                      </td>
                      <td className="p-3 font-mono text-right">
                        <span className="block font-bold text-slate-800">{res.valor_renda.toFixed(2)}€/mês</span>
                        <span className="block text-[10px] text-slate-500">Caução: {res.caucao.toFixed(2)}€</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                          res.estado === "Ativo" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                          res.estado.includes("Alerta") ? "bg-amber-100 text-amber-800 border border-amber-200 animate-pulse" :
                          "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}>
                          {res.estado}
                        </span>
                      </td>
                      <td className="p-3 text-center space-x-1">
                        {res.data_saida === null ? (
                          <button
                            disabled={registandoSaida === res.id}
                            onClick={async () => {
                              const dt = prompt("Informe a Data de Saída do Inquilino (AAAA-MM-DD):", new Date().toISOString().split('T')[0]);
                              if (!dt) return;
                              setRegistandoSaida(res.id);
                              const ok = await saveResidenteInquilinoToSupabase({
                                id: res.id,
                                id_predio: predio.id_predio,
                                id_fracao: res.id_fracao,
                                nome: res.nome,
                                nif: res.nif,
                                email: res.email,
                                telefone: res.telefone,
                                data_entrada: res.data_entrada,
                                data_saida: dt,
                                contrato_fim: res.contrato_fim,
                                valor_renda: res.valor_renda,
                                caucao: res.caucao,
                                chaves_entregues: res.chaves_entregues,
                                estado: "Saída Concluída"
                              });
                              setRegistandoSaida(null);
                              if (!ok) return alert("❌ Erro ao gravar a saída no Supabase.");
                              setResidentesHistorico(prev => prev.map(r => r.id === res.id ? { ...r, data_saida: dt, estado: "Saída Concluída" } : r));
                              registarLogAuditoria("Frações", `Registou a saída do residente "${res.nome}" (${res.fracao})`, predio.id_predio, loggedUser);
                              alert("Saída do residente registada e caução libertada para processo de devolução!");
                            }}
                            className="px-2.5 py-1 text-[10px] font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded transition-all cursor-pointer"
                          >
                            <i className="fa-solid fa-door-open mr-1"></i> {registandoSaida === res.id ? "A registar..." : "Registar Saída"}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">Desvinculado</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MENU 5: PERMILAGENS AUTOMÁTICAS (TASK 13) */}
      {currentSubTab === "permilagens_auto" && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 no-print animate-fadeIn">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-100">
                🔥 13. CÁLCULO E ATUALIZAÇÃO AUTOMÁTICA DE PERMILAGENS
              </span>
              <h3 className="text-base font-bold text-slate-800 mt-1 flex items-center gap-2">
                <i className="fa-solid fa-calculator text-indigo-600"></i>
                <span>Cálculo Científico por Áreas m², Coeficientes e Rebatimento para 1000‰ Legais</span>
              </h3>
            </div>
            <button
              type="button"
              onClick={async () => {
                let totalAreaWeighted = 0;
                const weightedByFracao: Record<string, number> = {};
                predioFracoes.forEach(f => {
                  const areaC = areaCoberta[f.id_fracao] || 90;
                  const areaV = areaVarandas[f.id_fracao] || 10;
                  const coef = coefPiso[f.id_fracao] || 1.0;
                  const totalW = (areaC + (areaV * 0.5)) * coef;
                  weightedByFracao[f.id_fracao] = totalW;
                  totalAreaWeighted += totalW;
                });

                let sumPerm = 0;
                const updated = fracoes.map(f => {
                  if (f.id_predio === predio.id_predio) {
                    const weight = weightedByFracao[f.id_fracao] || 1;
                    const calculatedPerm = Math.round((weight / totalAreaWeighted) * 1000);
                    sumPerm += calculatedPerm;
                    return { ...f, permilagem: calculatedPerm };
                  }
                  return f;
                });

                // Adjust remaining difference to make strict sum = 1000‰
                if (sumPerm !== 1000 && predioFracoes.length > 0) {
                  const diff = 1000 - sumPerm;
                  const targetId = predioFracoes[0].id_fracao;
                  const idx = updated.findIndex(f => f.id_fracao === targetId);
                  if (idx !== -1) updated[idx].permilagem += diff;
                }

                const ok = await persistirPermilagens(updated);
                alert(ok ? "Permilagens recalculadas e atualizadas com sucesso para exatamente 1000‰ legais com base nas áreas e coeficientes!" : "As permilagens foram recalculadas no ecrã, mas houve um erro a gravar no Supabase — tente novamente.");
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm transition-all cursor-pointer flex items-center gap-2"
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              <span>Recalcular & Atualizar Todas as Permilagens (1000‰ Exatos)</span>
            </button>
          </div>

          {/* Tabela de Áreas e Coeficientes por Fração */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-mono text-[10px] uppercase">
                <tr>
                  <th className="p-3">Fração / Piso</th>
                  <th className="p-3 text-center">Área Coberta (m²)</th>
                  <th className="p-3 text-center">Varandas/Terraço (m²)</th>
                  <th className="p-3 text-center">Coeficiente Piso</th>
                  <th className="p-3 text-center">Permilagem Atual</th>
                  <th className="p-3 text-center">Permilagem Ponderada IA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {predioFracoes.map(f => {
                  const areaC = areaCoberta[f.id_fracao] || 90;
                  const areaV = areaVarandas[f.id_fracao] || 10;
                  const coef = coefPiso[f.id_fracao] || 1.0;
                  return (
                    <tr key={f.id_fracao} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900 font-sans">
                        Fração {f.fracao_nome} ({f.piso})
                      </td>
                      <td className="p-3 text-center">
                        <MoneyInput
                          value={areaC}
                          onChange={valor => setAreaCoberta({ ...areaCoberta, [f.id_fracao]: valor })}
                          className="w-16 border border-slate-300 rounded text-center p-1 font-mono font-bold"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <MoneyInput
                          value={areaV}
                          onChange={valor => setAreaVarandas({ ...areaVarandas, [f.id_fracao]: valor })}
                          className="w-16 border border-slate-300 rounded text-center p-1 font-mono font-bold"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <MoneyInput
                          value={coef}
                          onChange={valor => setCoefPiso({ ...coefPiso, [f.id_fracao]: valor })}
                          className="w-16 border border-slate-300 rounded text-center p-1 font-mono font-bold"
                        />
                      </td>
                      <td className="p-3 text-center font-bold text-slate-800">
                        {f.permilagem}‰
                      </td>
                      <td className="p-3 text-center font-bold text-indigo-600 bg-indigo-50/50">
                        {Math.round(((areaC + (areaV * 0.5)) * coef) / 100 * 200)}‰
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-MENU 3 / CONSULTA: LISTA DE FRAÇÕES, PERFIS & CALCULADORA */}
      {currentSubTab === "fracoes_perfis" && (
        <>
          {/* Alerta de Integridade de Permilagem Legal */}
      <div className={`p-5 rounded-xl border flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 ${
        totalPermilagem === 1000 
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
          : 'bg-red-50 border-red-200 text-red-800 animate-pulse'
      }`}>
        <div className="flex items-center space-x-4">
          <div className={`text-2xl ${totalPermilagem === 1000 ? 'text-emerald-600' : 'text-red-600'}`}>
            <i className="fa-solid fa-scale-balanced"></i>
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-tight">Soma das Permilagens do Edifício</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {totalPermilagem === 1000 
                ? "✓ CONFORMIDADE LEGAL ATIVA: A soma totaliza exatamente 1000‰ legais do edifício (Art. 1418.º do Código Civil)." 
                : `🛑 ERRO DE INTEGRIDADE LEGAL: A soma total é de ${totalPermilagem}‰ (deve somar exatamente 1000‰ para validade jurídica de quotas).`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-lg font-black font-mono">
            {totalPermilagem}‰ / 1000‰
          </span>
          {loggedUser.role === 'ADMIN' && totalPermilagem !== 1000 && (
            <button
              type="button"
              onClick={autoAjustarPermilagens}
              className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm cursor-pointer transition-colors"
            >
              Ajustar Proporcionalmente
            </button>
          )}
        </div>
      </div>

      {/* REDIRECIONAMENTO PARA O MÓDULO OFICIAL DE CÁLCULO DE QUOTAS */}
      <div className="bg-gradient-to-r from-emerald-50 to-indigo-50 p-5 rounded-xl border border-emerald-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
            <i className="fa-solid fa-calculator text-base"></i>
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">Cálculo e Emissão de Quotas do Condomínio</h4>
            <p className="text-xs text-slate-600 mt-0.5">
              A calculadora de quotas ordinárias e extraordinárias agora está interligada com as contas bancárias no menu <strong className="text-emerald-700">Área Financeira → Cálculo de Quotas</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Ficha Detalhada da Fração Selecionada */}
      {(() => {
        const selectedFracao = predioFracoes.find(f => f.id_fracao === selectedFracaoId);
        if (!selectedFracao) return null;
        const code = computeTransferCode(predio.morada_linha1, predio.num_porta, selectedFracao.piso, selectedFracao.fracao_nome);

        return (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <span className="p-1.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-center shadow-xs">
                  <img src="/modulos/11-proprietario.png" alt="Proprietário" className="h-7 w-7 object-contain" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Ficha Individual — Fração {selectedFracao.fracao_nome} ({selectedFracao.piso})</h3>
                  <p className="text-xs text-slate-400">Permilagem legal: <span className="font-semibold text-slate-600">{selectedFracao.permilagem}‰</span> • Tipologia: <span className="font-semibold text-slate-600">{selectedFracao.tipologia}</span></p>
                </div>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => downloadFichaCondominoPreenchidaPDF(predio.nome, selectedFracao)}
                  className="bg-red-50 hover:bg-red-100 border border-red-300 text-red-900 font-bold px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  title="Descarregar Ficha de Registo desta Fração em PDF"
                >
                  <img src="/modulos/80-pdf-de-resultados.png" alt="PDF" className="h-4 w-4 object-contain" onError={(e) => { e.currentTarget.src = "/modulos/25-relatorio.png"; }} />
                  <span>Descarregar Ficha (PDF)</span>
                </button>
                {selectedFracao.administrador_interno === "Sim" && (
                  <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-1 rounded">Administração Interna Ativa</span>
                )}
                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded font-mono">Cód: {code}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Ficha do Proprietário */}
              <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <img src="/modulos/11-proprietario.png" alt="Proprietário" className="h-5 w-5 object-contain shrink-0" />
                    <span>Ficha do Proprietário</span>
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Titular Legal</span>
                </div>
                {selectedFracao.proprietario ? (
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center space-x-3">
                      {selectedFracao.proprietario.foto ? (
                        <img src={selectedFracao.proprietario.foto} className="h-12 w-12 rounded-full object-cover border border-slate-300 shadow-xs" referrerPolicy="no-referrer" />
                      ) : (
                        <img src="/modulos/11-proprietario.png" alt="Proprietário" className="h-12 w-12 rounded-xl bg-slate-100 p-1 object-contain border border-slate-200 shadow-xs" />
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{selectedFracao.proprietario.nome}</h4>
                        <p className="text-xs text-slate-400 font-mono">NIF: {selectedFracao.proprietario.nif}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 pt-1">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">E-mail de Contacto</span>
                        <a href={`mailto:${selectedFracao.proprietario.email}`} className="text-emerald-600 hover:underline font-mono font-semibold break-all">{selectedFracao.proprietario.email}</a>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Telemóvel / Telefone</span>
                        <a href={`tel:${selectedFracao.proprietario.tlm}`} className="text-slate-700 hover:underline font-mono font-semibold">{selectedFracao.proprietario.tlm || "Sem Telefone"}</a>
                      </div>
                      <div className="col-span-2 border-t border-slate-100 dark:border-slate-800 pt-2.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 block">Referência BR23E (Conciliação Bancária)</span>
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold">Gerada pelo Sistema • Não Editável</span>
                        </div>
                        <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-between">
                          <span className="font-mono font-black text-emerald-800 dark:text-emerald-300 text-xs tracking-wider select-all">
                            {selectedFracao.referencia_br23e || selectedFracao.proprietario.referencia_br23e || gerarReferenciaBR23E(selectedFracao.fracao_nome, selectedFracao.id_fracao)}
                          </span>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">Exclusivo Perfil Bancário</span>
                        </div>
                      </div>

                      <div className="col-span-2 border-t border-slate-100 pt-2">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">IBAN de Cobrança / Reembolsos</span>
                        <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 block mt-0.5 text-[11px] select-all">{selectedFracao.proprietario.iban || "IBAN Não Disponibilizado"}</span>
                        {selectedFracao.proprietario.iban && (
                          <p className="text-[9px] text-slate-400 mt-1">Titular: {selectedFracao.proprietario.titular_conta} ({selectedFracao.proprietario.entidade_bancaria})</p>
                        )}
                      </div>
                      {selectedFracao.proprietario.morada_alternativa && (
                        <div className="col-span-2 border-t border-slate-100 pt-2 bg-amber-50/50 p-2 rounded border border-amber-100">
                          <span className="text-[10px] uppercase font-bold text-amber-800 block">Morada de Correspondência Fora do Prédio</span>
                          <p className="text-xs text-amber-950 font-medium mt-0.5">{selectedFracao.proprietario.morada_alternativa}</p>
                        </div>
                      )}
                    </div>

                    {selectedFracao.proprietarios_adicionais && selectedFracao.proprietarios_adicionais.length > 0 && (
                      <div className="border-t border-slate-200/60 pt-3 space-y-2">
                        <span className="text-[9px] uppercase font-bold text-[#1A1A1A] block tracking-wider">Coproprietários Associados ({selectedFracao.proprietarios_adicionais.length})</span>
                        <div className="space-y-2">
                          {selectedFracao.proprietarios_adicionais.map((co, idx) => (
                            <div key={idx} className="flex items-center space-x-2.5 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-250/50">
                              {co.foto ? (
                                <img src={co.foto} className="h-9 w-9 rounded-full object-cover border border-slate-200" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center text-[10px] border border-slate-200 font-extrabold uppercase">{co.nome.slice(0, 2)}</div>
                              )}
                              <div className="flex-grow min-w-0">
                                <h5 className="text-xs font-bold text-[#1A1A1A] dark:text-slate-200 truncate">{co.nome}</h5>
                                <p className="text-[9px] text-[#555] font-mono">NIF: {co.nif || "N/A"}</p>
                                <div className="flex flex-wrap gap-x-2 text-[9px] text-[#555]">
                                  {co.email && <span className="truncate">📧 {co.email}</span>}
                                  {co.tlm && <span>📞 {co.tlm}</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Nenhum proprietário cadastrado para esta fração.</p>
                )}
              </div>

              {/* Ficha do Inquilino */}
              <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center"><i className="fa-solid fa-house-user text-violet-600 mr-1.5"></i> Ficha do Inquilino</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${selectedFracao.is_arrendada ? 'bg-violet-100 text-violet-800' : 'bg-slate-200 text-slate-600'}`}>{selectedFracao.is_arrendada ? 'Arrendada' : 'Sem Inquilino'}</span>
                </div>
                {selectedFracao.is_arrendada && selectedFracao.inquilino ? (
                  <div className="flex flex-col space-y-3 animate-fadeIn">
                    <div className="flex items-center space-x-3">
                      {selectedFracao.inquilino.foto ? (
                        <img src={selectedFracao.inquilino.foto} className="h-12 w-12 rounded-full object-cover border border-slate-300 shadow-xs" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-lg border border-slate-300 font-semibold uppercase">{selectedFracao.inquilino.nome.slice(0, 2)}</div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{selectedFracao.inquilino.nome}</h4>
                        <p className="text-xs text-slate-400 font-mono">NIF: {selectedFracao.inquilino.nif || "Não Fornecido"}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 pt-1">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">E-mail de Contacto</span>
                        <a href={`mailto:${selectedFracao.inquilino.email}`} className="text-violet-600 hover:underline font-mono font-semibold break-all">{selectedFracao.inquilino.email}</a>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Telemóvel / Telefone</span>
                        <a href={`tel:${selectedFracao.inquilino.tlm}`} className="text-slate-700 hover:underline font-mono font-semibold">{selectedFracao.inquilino.tlm || "Sem Telefone"}</a>
                      </div>
                      <div className="col-span-2 border-t border-slate-100 pt-2">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Canal Preferencial para Avisos</span>
                        <div className="flex items-center mt-1 text-slate-700 font-semibold">
                          <i className={`fa-solid ${selectedFracao.notificacao_preferencial.includes('Digital') ? 'fa-envelope-open text-emerald-600' : 'fa-truck-ramp-box text-blue-600'} mr-2 text-sm`}></i>
                          <span>{selectedFracao.notificacao_preferencial}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col justify-center items-center text-center p-6 text-slate-400 space-y-2">
                    <i className="fa-solid fa-home-user text-2xl text-slate-300"></i>
                    <p className="text-xs font-semibold text-slate-500">Proprietário Habita a Fração</p>
                    <p className="text-[9px] max-w-xs">Não existe inquilino associado. Toda a correspondência legal e notificações são direcionadas para o proprietário.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Seguro de Incêndio & Apólice Anual (Artigo 1429.º C.Civil) */}
            {(() => {
              const isInsuranceMissing = !selectedFracao.apolice_num || selectedFracao.apolice_num.trim() === "" || !selectedFracao.seguradora;
              const isInsuranceExpired = selectedFracao.apolice_validade ? new Date(selectedFracao.apolice_validade) < new Date() : true;
              const isAlertRequired = isInsuranceMissing || isInsuranceExpired;

              return (
                <div className={`p-4 rounded-xl border space-y-3 transition-all ${
                  isAlertRequired 
                    ? 'bg-red-50/50 border-red-300 ring-1 ring-red-500/20' 
                    : 'bg-amber-50/40 border-amber-200'
                }`}>
                  {/* Chamada de Atenção com Chaveta Vermelha */}
                  {isAlertRequired && (
                    <div className="border-l-4 border-red-600 bg-red-100/70 p-3 rounded-r-xl border border-r-red-200 border-y-red-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-2.5">
                        <div className="bg-red-600 text-white font-black text-[10px] px-2 py-0.5 rounded uppercase tracking-wider shrink-0 flex items-center gap-1 shadow-xs">
                          <i className="fa-solid fa-triangle-exclamation"></i>
                          <span>Atenção!</span>
                        </div>
                        <div className="text-xs text-red-950 font-bold">
                          {isInsuranceMissing 
                            ? "Apólice de Seguro Obrigatório Por Receber / Não Apresentada!" 
                            : `Seguro Obrigatório de Incêndio Fora de Validade (Expirado a ${selectedFracao.apolice_validade})!`}
                          <span className="block text-[10px] text-red-800 font-normal mt-0.5">
                            O Artigo 1429.º do Código Civil determina a obrigatoriedade do seguro contra risco de incêndio. A administração deve notificar o condómino para regularização imediata.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-2">
                    <div className="flex items-center space-x-2">
                      <i className={`fa-solid fa-shield-halved ${isAlertRequired ? 'text-red-600' : 'text-amber-600'} text-sm`}></i>
                      <h4 className={`text-xs font-bold ${isAlertRequired ? 'text-red-950' : 'text-amber-950'} uppercase tracking-wider`}>
                        Seguro Obrigatório de Incêndio / Multirriscos (Artigo 1429.º C.C.)
                      </h4>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border ${isAlertRequired ? 'border-red-300 text-red-900' : 'border-amber-300 text-amber-900'}`}>
                        {selectedFracao.seguradora || "Não Fornecida"} • Apólice: {selectedFracao.apolice_num || "Pendente"}
                      </span>
                      <button
                        type="button"
                        onClick={() => iniciarEdicaoSeguro(selectedFracao)}
                        className="bg-slate-600 hover:bg-slate-700 text-white font-bold text-[10px] px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <i className="fa-solid fa-pen text-[9px]"></i>
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFireInsuranceModalFracao(selectedFracao)}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <i className="fa-solid fa-paper-plane text-[9px]"></i>
                        <span>Enviar E-mail Pedido de Apólice</span>
                      </button>
                    </div>
                  </div>

                  {editandoSeguroFracaoId === selectedFracao.id_fracao && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-3 rounded-lg border border-amber-200">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">Seguradora</label>
                        <input
                          type="text"
                          value={tempSeguradora}
                          onChange={e => setTempSeguradora(e.target.value)}
                          placeholder="Ex: Fidelidade"
                          className="w-full text-xs p-2 rounded-lg border border-slate-300"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">Nº Apólice</label>
                        <input
                          type="text"
                          value={tempApoliceNum}
                          onChange={e => setTempApoliceNum(e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border border-slate-300"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">Validade</label>
                        <input
                          type="date"
                          value={tempApoliceValidade}
                          onChange={e => setTempApoliceValidade(e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border border-slate-300"
                        />
                      </div>
                      <div className="sm:col-span-3 flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditandoSeguroFracaoId(null)}
                          className="text-[10px] font-bold text-slate-500 px-3 py-1.5 rounded-lg cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={guardandoSeguro}
                          onClick={() => guardarSeguroFracao(selectedFracao)}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer"
                        >
                          {guardandoSeguro ? "A gravar..." : "Gravar"}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-amber-900 pt-1">
                    <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedFracao.solicitacao_email_incendio ?? true}
                        onChange={async (e) => {
                          const atualizada = { ...selectedFracao, solicitacao_email_incendio: e.target.checked };
                          onUpdateFracoes(fracoes.map(f => f.id_fracao === selectedFracao.id_fracao ? atualizada : f));
                          await saveFracaoToSupabase(atualizada);
                        }}
                        className="h-4 w-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                      />
                      <span className="font-semibold text-slate-800">
                        Solicitação por e-mail automatizada (Pedido anual de Apólice de Incêndio a 02/01)
                      </span>
                    </label>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Lista de Frações Registadas e Perfis de Acesso */}
      <div className={`bg-white rounded-xl border ${activeSubSection === 'fracoes_perfis' ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md' : 'border-slate-200 shadow-sm'} overflow-hidden transition-all`}>
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <i className="fa-solid fa-key text-emerald-600"></i>
              <span>{activeSubSection === 'fracoes_perfis' ? 'Perfis de Acesso & Credenciais dos Condóminos' : 'Frações Registadas no Edifício'}</span>
            </h4>
            {activeSubSection === 'fracoes_perfis' && (
              <p className="text-[11px] text-slate-500 mt-0.5">Gestão de acessos, códigos de validação bancária e preferências de notificação de cada condómino.</p>
            )}
          </div>
          {loggedUser.role === 'ADMIN' && (
            <div className="flex space-x-2">
              {isEditingPermilages ? (
                <>
                  <button
                    onClick={salvarPermilagens}
                    className="border-2 border-emerald-500 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 text-white text-[10px] font-bold px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-xs active:ring-2 active:ring-emerald-400 select-none"
                  >
                    <img src="/estados-acoes/12-adicionar.png" alt="Gravar" className="h-3.5 w-3.5 object-contain" />
                    <span>Gravar</span>
                  </button>
                  <button
                    onClick={cancelarEdicaoPermilagens}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold px-3 py-1 rounded transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  onClick={iniciarEdicaoPermilagens}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold px-3 py-1 rounded transition-all cursor-pointer flex items-center space-x-1"
                >
                  <i className="fa-solid fa-pen-to-square"></i>
                  <span>Editar Permilagens In-Place</span>
                </button>
              )}
            </div>
          )}
        </div>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <th className="p-3">Fração / Piso</th>
              <th className="p-3">Permilagem</th>
              <th className="p-3">Administração</th>
              <th className="p-3">Proprietário Principal</th>
              <th className="p-3">Inquilino</th>
              <th className="p-3">Preferência Notif.</th>
              <th className="p-3">Descritivo de Transferência Bancária Sugerido</th>
            </tr>
          </thead>
          <tbody>
            {predioFracoes.map(f => {
              const code = computeTransferCode(predio.morada_linha1, predio.num_porta, f.piso, f.fracao_nome);
              const isSelected = selectedFracaoId === f.id_fracao;
              
              return (
                <tr key={f.id_fracao} onClick={() => !isEditingPermilages && setSelectedFracaoId(f.id_fracao)} className={`border-b border-slate-100 transition-colors ${isSelected ? 'bg-emerald-50/50 font-medium' : 'hover:bg-slate-50/50'} ${isEditingPermilages ? '' : 'cursor-pointer'}`}>
                  <td className="p-3">
                    <div className="font-bold text-slate-800">Fração {f.fracao_nome}</div>
                    <div className="text-[10px] text-slate-400 font-semibold">{f.piso} • {f.tipologia}</div>
                  </td>
                  <td className="p-3 font-mono font-bold text-slate-750">
                    {isEditingPermilages ? (
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          value={tempPermilages[f.id_fracao] || ""}
                          onChange={e => setTempPermilages({ ...tempPermilages, [f.id_fracao]: e.target.value })}
                          className="w-16 border border-slate-300 rounded px-1.5 py-0.5 text-xs text-center font-bold font-mono text-slate-800 focus:outline-emerald-500"
                        />
                        <span className="text-slate-400">‰</span>
                      </div>
                    ) : (
                      <span>{f.permilagem}‰</span>
                    )}
                  </td>
                  <td className="p-3">
                    {f.administrador_interno === "Sim" ? (
                      <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded">Adm. Interno</span>
                    ) : <span className="text-slate-400">Condómino</span>}
                  </td>
                  <td className="p-3">
                    {f.proprietario ? (
                      <div className="flex items-center space-x-2">
                        {f.proprietario.foto && <img src={f.proprietario.foto} className="h-6 w-6 rounded-full border border-slate-300" />}
                        <div>
                          <p className="font-semibold text-slate-700">{f.proprietario.nome}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{f.proprietario.iban ? `${f.proprietario.entidade_bancaria}` : "Sem Banco"}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-bold">Sem Proprietário</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFracaoId(f.id_fracao);
                            limparFormProprietario();
                            setCurrentSubTab("fracoes_proprietario");
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-0.5 rounded text-[10px] cursor-pointer transition-all shadow-xs flex items-center gap-1"
                          title="Associar Proprietário a esta Fração"
                        >
                          <i className="fa-solid fa-user-plus text-[9px]"></i>
                          <span>Associar</span>
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {f.is_arrendada && f.inquilino ? (
                      <div className="flex items-center space-x-2">
                        {f.inquilino.foto && <img src={f.inquilino.foto} className="h-6 w-6 rounded-full border border-slate-300" />}
                        <div>
                          <p className="font-semibold text-violet-700">{f.inquilino.nome}</p>
                          <p className="text-[9px] text-slate-400">Arrendatário</p>
                        </div>
                      </div>
                    ) : <span className="text-slate-400">Proprietário Habita</span>}
                  </td>
                  <td className="p-3 font-semibold text-slate-500">{f.notificacao_preferencial}</td>
                  <td className="p-3">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex flex-col space-y-1.5 w-fit">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">Mensalidade {code}</span>
                        <button type="button" onClick={() => copiarCodigo(`Mensalidade ${code}`)} className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer" title="Copiar"><i className="fa-solid fa-copy"></i></button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
        </>
      )}

      {/* Modals for Interactive Ficha and Dynamic PDF Reports */}
      <ModalFichaCondominoEditavel
        isOpen={isFichaEditavelOpen}
        onClose={() => setIsFichaEditavelOpen(false)}
        predio={predio}
        fracaoAtual={null}
        onSaveFracaoData={(fracaoId, updatedData) => {
          const updatedList = fracoes.map(f => f.id_fracao === fracaoId ? { ...f, ...updatedData } : f);
          onUpdateFracoes(updatedList);
        }}
      />

      <FiltroRelatoriosPDFModal
        isOpen={isFiltroRelatoriosOpen}
        onClose={() => setIsFiltroRelatoriosOpen(false)}
        predio={predio}
        fracoes={predioFracoes}
        avisos={avisos}
      />

      {/* Modal Histórico de Proprietários — consulta de proprietários
          anteriores de uma fração e dos avisos/recibos emitidos em seu nome,
          preservados mesmo depois de uma Transferência de Propriedade. */}
      {historicoModalFracaoId && (() => {
        const fracaoHist = fracoes.find(f => f.id_fracao === historicoModalFracaoId);
        if (!fracaoHist) return null;
        const historico = [...(fracaoHist.historico_proprietarios || [])].sort((a, b) => (b.data_fim || "").localeCompare(a.data_fim || ""));
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
              <div className="bg-slate-900 px-6 py-4 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center space-x-2">
                  <History className="w-4 h-4 text-slate-300" />
                  <div>
                    <h3 className="font-bold text-sm">Histórico de Proprietários — Fração {fracaoHist.fracao_nome}</h3>
                    <p className="text-[10px] text-slate-300">Proprietário atual: <strong>{fracaoHist.proprietario?.nome || "—"}</strong></p>
                  </div>
                </div>
                <button onClick={() => setHistoricoModalFracaoId(null)} className="text-slate-300 hover:text-white cursor-pointer">
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>
              <div className="p-5 space-y-3 overflow-y-auto">
                {historico.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Ainda não há proprietários anteriores registados para esta fração.</p>
                ) : historico.map((h, idx) => {
                  const avisosDoProprietario = (avisos || []).filter(a =>
                    a.id_fracao === historicoModalFracaoId &&
                    (a.proprietario_nome ? a.proprietario_nome === h.proprietario.nome : a.data <= h.data_fim)
                  );
                  return (
                    <div key={idx} className="border border-slate-200 rounded-xl p-3.5 space-y-2 bg-slate-50/60">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{h.proprietario.nome}</p>
                          <p className="text-[10px] text-slate-500 font-mono">NIF: {h.proprietario.nif || "—"} {h.proprietario.email ? `· ${h.proprietario.email}` : ""}</p>
                        </div>
                        <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                          Até {h.data_fim}
                        </span>
                      </div>
                      {h.motivo && <p className="text-[10px] text-slate-500 italic">{h.motivo}</p>}
                      <div className="pt-1.5 border-t border-slate-200">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Avisos / Recibos em nome deste proprietário ({avisosDoProprietario.length})
                        </p>
                        {avisosDoProprietario.length === 0 ? (
                          <p className="text-[10px] text-slate-400">Nenhum documento encontrado.</p>
                        ) : (
                          <ul className="space-y-1 max-h-28 overflow-y-auto">
                            {avisosDoProprietario.map(a => (
                              <li key={a.id_aviso} className="text-[10px] text-slate-600 flex justify-between gap-2 bg-white rounded px-2 py-1 border border-slate-150">
                                <span className="truncate">{a.tipo} — {a.descricao}</span>
                                <span className="font-mono font-bold shrink-0">{a.valor.toFixed(2)}€ · {a.estado}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="pt-1.5 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            Registos Arquivados — Condóminos → Ex-Proprietários → {h.proprietario.nome}
                          </p>
                          <label className={`text-[9px] font-bold px-2 py-1 rounded cursor-pointer border ${aArquivarRegistoDe === h.proprietario.nome ? "bg-slate-100 text-slate-400 border-slate-200" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"}`}>
                            {aArquivarRegistoDe === h.proprietario.nome ? "A arquivar..." : "+ Arquivar Registo"}
                            <input
                              type="file"
                              className="hidden"
                              disabled={aArquivarRegistoDe === h.proprietario.nome}
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handleArquivarRegistoManual(h.proprietario.nome, fracaoHist.fracao_nome, file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                        {(() => {
                          const registosDoProprietario = (documentos || []).filter(d =>
                            d.categoria === "Condóminos" && d.tema === "Ex-Proprietários" && d.sub_pasta === h.proprietario.nome
                          );
                          return registosDoProprietario.length === 0 ? (
                            <p className="text-[10px] text-slate-400">Ainda sem registos arquivados.</p>
                          ) : (
                            <ul className="space-y-1 max-h-28 overflow-y-auto">
                              {registosDoProprietario.map(d => (
                                <li key={d.id_doc} className="text-[10px] text-slate-600 flex justify-between gap-2 bg-white rounded px-2 py-1 border border-slate-150">
                                  <span className="truncate">{d.tipo === "Registo" ? <i className="fa-solid fa-file-lines mr-1 text-slate-400"></i> : <i className="fa-solid fa-paperclip mr-1 text-slate-400"></i>}{d.nome}</span>
                                  {d.caminho ? (
                                    <a href={d.caminho} target="_blank" rel="noreferrer" className="font-bold text-emerald-600 hover:underline shrink-0">Abrir</a>
                                  ) : (
                                    <span className="text-slate-400 shrink-0">{d.data_upload}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Simulador de E-mail de Solicitação de Apólice de Incêndio (02/01) */}
      {fireInsuranceModalFracao && fireInsuranceModalFracao.proprietario && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-zoom-in">
            <div className="bg-amber-900 px-6 py-4 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <i className="fa-solid fa-fire-flame-curved text-amber-400 text-lg"></i>
                <div>
                  <h3 className="font-bold text-sm uppercase">Pedido Anual de Apólice de Incêndio (02/01)</h3>
                  <p className="text-[10px] text-amber-200">Notificação legal obrigatória nos termos do Artigo 1429.º do Código Civil</p>
                </div>
              </div>
              <button onClick={() => setFireInsuranceModalFracao(null)} className="text-amber-300 hover:text-white cursor-pointer">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto relative">
              <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-5 text-xs text-slate-800 space-y-4 relative overflow-hidden">
                {/* Background Watermark */}
                <img 
                  src="/marca/19-marca-dagua-logo-cinza-claro.png" 
                  alt="Watermark" 
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 object-contain opacity-10 pointer-events-none" 
                />

                {/* Central Top Logo Header */}
                <div className="text-center pb-2 border-b border-amber-200/80">
                  <img 
                    src="/marca/20-Logotipo Horizontal com fundo.png" 
                    alt="CondoManager AI" 
                    className="h-10 mx-auto object-contain drop-shadow-xs" 
                  />
                  <p className="text-[9px] font-bold text-amber-900 uppercase tracking-widest mt-1">Notificação Legal Obrigatoria</p>
                </div>

                <div className="space-y-1 text-slate-700 font-sans">
                  <p><strong>De:</strong> {(predio as any).email_administracao || (predio as any).email || "administracao@condomanager.pt"}</p>
                  <p><strong>Para:</strong> {fireInsuranceModalFracao.proprietario.email}</p>
                  <p><strong>Assunto:</strong> 🏢 Solicitação Anual de Comprovativo de Seguro / Apólice de Incêndio — Condomínio {predio.nome}</p>
                </div>
                <hr className="border-amber-200" />

                <div className="space-y-3 text-slate-700 font-sans leading-relaxed relative z-10">
                  <p>Olá <strong>{fireInsuranceModalFracao.proprietario.nome}</strong>,</p>
                  <p>Espero que este e-mail o(a) encontre bem.</p>
                  <p>Nos termos do <strong>Artigo 1429.º do Código Civil</strong>, é obrigatório o seguro contra o risco de incêndio do edifício, quer quanto às frações autónomas, quer quanto às partes comuns.</p>
                  <p>Para manter o registo legal do nosso condomínio devidamente atualizado, solicitamos o favor de nos enviar uma cópia da sua <strong>apólice de seguro de incêndio / multirriscos</strong> ou do respetivo <strong>recibo de pagamento renovado</strong> referente à sua <strong>Fração {fireInsuranceModalFracao.fracao_nome} ({fireInsuranceModalFracao.piso})</strong>.</p>
                  <p>Poderá enviar para o email <strong>bentorodrgues2@gmail.com</strong> anexando o comprovativo em formato PDF ou imagem, ou efetuar o carregamento na sua área reservada da plataforma <strong>CondoManager AI</strong>.</p>
                  <p>Agradecemos desde já a sua pronta colaboração na manutenção da segurança jurídica de todo o edifício.</p>

                  <div className="pt-3 border-t border-amber-200/80 space-y-1">
                    <p className="text-slate-700 text-xs">Com os meus cumprimentos,</p>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="bg-amber-100 text-amber-900 text-[9px] font-mono font-bold px-2 py-0.5 rounded border border-amber-300 inline-flex items-center gap-1">
                        <i className="fa-solid fa-shield-halved text-amber-700"></i> [Assinatura Digital Validada]
                      </span>
                    </div>
                    <p className="text-slate-900 text-xs font-bold mt-1">José Carlos Guerra</p>
                    <p className="text-slate-600 text-[11px]">O Administrador do Condomínio ({predio.nome})</p>
                  </div>
                </div>
              </div>
              <button
                disabled={enviandoPedidoApolice}
                onClick={async () => {
                  const alvo = fireInsuranceModalFracao;
                  const recipientEmail = alvo.proprietario?.email;
                  if (!recipientEmail) {
                    alert("Esta fração não tem email de proprietário registado.");
                    return;
                  }
                  setEnviandoPedidoApolice(true);
                  try {
                    const resp = await fetch("/api/email?acao=notificar", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        to: recipientEmail,
                        nomeDestinatario: alvo.proprietario.nome,
                        assunto: `Solicitação de Apólice de Seguro de Incêndio — Fração ${alvo.fracao_nome}`,
                        mensagem: `Para manter o registo legal do nosso condomínio devidamente atualizado, solicitamos o favor de nos enviar uma cópia da sua apólice de seguro de incêndio / multirriscos ou do respetivo recibo de pagamento renovado referente à sua Fração ${alvo.fracao_nome} (${alvo.piso}).<br><br>Poderá enviar para o email bentorodrgues2@gmail.com anexando o comprovativo em formato PDF ou imagem, ou efetuar o carregamento na sua área reservada da plataforma CondoManager AI.<br><br>Agradecemos desde já a sua pronta colaboração na manutenção da segurança jurídica de todo o edifício.`
                      })
                    });
                    const data = await resp.json();
                    if (!resp.ok || !data.ok) throw new Error(data.error || "Falha ao enviar");

                    const atualizada = { ...alvo, solicitacao_email_incendio: true };
                    await saveFracaoToSupabase(atualizada);
                    onUpdateFracoes(fracoes.map(f => f.id_fracao === alvo.id_fracao ? atualizada : f));

                    setFireInsuranceModalFracao(null);
                    alert(`E-mail de solicitação de apólice de incêndio enviado com sucesso para ${recipientEmail}!`);
                  } catch (err: any) {
                    alert("Erro ao enviar o email: " + (err?.message || "erro desconhecido"));
                  } finally {
                    setEnviandoPedidoApolice(false);
                  }
                }}
                className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition-colors cursor-pointer shadow-md text-center flex items-center justify-center gap-2"
              >
                {enviandoPedidoApolice ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
                <span>Enviar E-mail de Solicitação de Apólice</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
