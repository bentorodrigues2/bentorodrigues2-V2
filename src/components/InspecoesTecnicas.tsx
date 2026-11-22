import React, { useState, useEffect, useRef } from "react";
import { Predio, LoggedUser, Movimento, Conta, Fornecedor, Documento, DividaFornecedor } from "../types";
import { Wrench, Check, X, Pencil, CalendarCheck, FileText, Paperclip, Bell, Upload, Landmark, ShieldAlert, ClipboardList, Trash2, Sparkles, Camera, Mail, Phone } from "lucide-react";
import { EquipamentoTecnico, HistoricoVistoriaEquipamento, DocumentoVistoria } from "./InventarioTecnico";
import { fetchInventarioTecnicoFromSupabase, saveEquipamentoTecnicoToSupabase, deleteEquipamentoTecnicoFromSupabase, registarLogAuditoria, uploadDocumentoToStorage, saveMovimentoToSupabase, deleteMovimentoFromSupabase, ajustarSaldoContaReal, saveDocumentoToSupabase, saveDividaFornecedorToSupabase, deleteDividaFornecedorFromSupabase, fetchDividasFornecedoresFromSupabase } from "../lib/supabaseService";
import { formatDatePT, parseValorMonetario } from "../utils";

// Separação explícita a pedido do administrador (2026-11-21): "Inventário
// Técnico" fica só com o registo do equipamento (identidade, localização,
// fotografias, nº de série); este ecrã fica com TODO o registo das
// inspeções/vistorias em concreto — data, técnico, resultado, custos,
// fornecedores (entidade de inspeção e empresa de assistência/manutenção),
// e os documentos (certificado, fatura, comprovativo de pagamento,
// requerimento). Lê e escreve nos MESMOS registos de "inventario_tecnico"
// (historicoVistorias, estado, ultimaInspecao, proximaInspecaoData) — não é
// uma tabela nova, só um ecrã dedicado só às inspeções.

interface InspecoesTecnicasProps {
  predio: Predio;
  loggedUser: LoggedUser;
  movements?: Movimento[];
  setMovements?: React.Dispatch<React.SetStateAction<Movimento[]>>;
  contas?: Conta[];
  fornecedores?: Fornecedor[];
  // Ponte para "Inventário Técnico" — pedido explícito do administrador:
  // "estes campos têm de ser editáveis, eliminar etc" a partir daqui
  // também, sem ter de ir procurar o equipamento noutro ecrã para corrigir
  // um dado de identidade (nome, categoria, localização...).
  onEditarEquipamento?: (id: string) => void;
  // Arquivo documental central da aplicação — pedido explícito: "Todos os
  // documentos anexados guardados em arquivo próprio". Cada documento
  // anexado a uma inspeção (certificado, fatura, comprovativo,
  // requerimento) fica também listado em "Arquivo Documental", além de
  // ficar ligado ao equipamento.
  documentos?: Documento[];
  setDocumentos?: React.Dispatch<React.SetStateAction<Documento[]>>;
}

export function InspecoesTecnicas({ predio, loggedUser, movements = [], setMovements, contas = [], fornecedores = [], onEditarEquipamento, documentos = [], setDocumentos }: InspecoesTecnicasProps) {
  const [equipamentos, setEquipamentos] = useState<EquipamentoTecnico[]>([]);

  useEffect(() => {
    if (!predio.id_predio) return;
    fetchInventarioTecnicoFromSupabase(predio.id_predio).then(dados => { if (dados) setEquipamentos(dados); });
  }, [predio.id_predio]);

  // Estado REAL de cada dívida ligada a uma vistoria — o pagamento de uma
  // dívida pendente é totalmente independente de a inspeção estar
  // "Realizada" ou não (pedido explícito: "a dívida pode ser paga
  // antecipadamente... passa a paga quando consta o pagamento no extrato
  // ou comprovativo de pagamento"). Paga-se sempre pelos sítios normais —
  // "Registar Pagamento" em Fornecedores, ou reconhecimento automático no
  // extrato bancário — nunca por este ecrã; aqui só se reflete o estado
  // real, lido da mesma tabela partilhada.
  const [dividasPorId, setDividasPorId] = useState<Record<string, DividaFornecedor>>({});
  const recarregarDividas = () => {
    if (!predio.id_predio) return;
    fetchDividasFornecedoresFromSupabase(predio.id_predio).then(dados => {
      if (!dados) return;
      const mapa: Record<string, DividaFornecedor> = {};
      dados.forEach(d => { mapa[d.id_divida] = d; });
      setDividasPorId(mapa);
    });
  };
  useEffect(recarregarDividas, [predio.id_predio]);

  const periodicidadeParaMeses = (freq: string): number => {
    const f = freq.toLowerCase();
    if (f.includes("mensal")) return 1;
    if (f.includes("trimestral")) return 3;
    if (f.includes("semestral")) return 6;
    if (f.includes("bianual") || f.includes("2 anos")) return 24;
    return 12; // Anual, por omissão
  };

  const calcularProximaInspecao = (dataBase: string, freq: string): string => {
    const d = new Date(dataBase);
    d.setMonth(d.getMonth() + periodicidadeParaMeses(freq));
    return d.toISOString().split("T")[0];
  };

  // --- Registar Vistoria (agendada ou avulsa) ---
  const [vistoriaTargetId, setVistoriaTargetId] = useState<string | null>(null);
  const [vistoriaEditId, setVistoriaEditId] = useState<string | null>(null);
  // Liga esta edição ao grupo partilhado com outros equipamentos (ver
  // HistoricoVistoriaEquipamento.idGrupo) — null quando a vistoria é
  // isolada ou nova.
  const [vistoriaIdGrupo, setVistoriaIdGrupo] = useState<string | null>(null);
  // Ciclo de vida real da inspeção — pedido explícito: "campo para
  // solicitação de inspeção e depois o agendamento da mesma quando formos
  // informados pela entidade que vem efetuar a inspeção". Por omissão
  // "Realizada" (o caso mais comum: a vistoria já aconteceu).
  const [vistoriaEstadoRegisto, setVistoriaEstadoRegisto] = useState<NonNullable<HistoricoVistoriaEquipamento["estadoRegisto"]>>("Realizada");
  const [vistoriaDataAgendada, setVistoriaDataAgendada] = useState("");
  const [vistoriaData, setVistoriaData] = useState(() => new Date().toISOString().split("T")[0]);
  const [vistoriaTecnico, setVistoriaTecnico] = useState("");
  const [vistoriaResultado, setVistoriaResultado] = useState<HistoricoVistoriaEquipamento["resultado"]>("Aprovado");
  const [vistoriaObservacoes, setVistoriaObservacoes] = useState("");
  const [aGravarVistoria, setAGravarVistoria] = useState(false);
  // Entidade oficial de inspeção e empresa de assistência/manutenção que
  // acompanha são 2 papéis distintos, cada um ligado à lista real de
  // Fornecedores do prédio (pedido explícito: "incluir campo ligado a
  // fornecedores para identificar o fornecedor responsável pela
  // assistência do equipamento").
  const [vistoriaFornInspecaoId, setVistoriaFornInspecaoId] = useState("");
  const [vistoriaFornInspecaoNome, setVistoriaFornInspecaoNome] = useState("");
  const [vistoriaFornManutencaoId, setVistoriaFornManutencaoId] = useState("");
  const [vistoriaFornManutencaoNome, setVistoriaFornManutencaoNome] = useState("");
  const [vistoriaContaPagamento, setVistoriaContaPagamento] = useState("");
  const [vistoriaIdMovimentoExistente, setVistoriaIdMovimentoExistente] = useState<string | undefined>(undefined);
  // Dívida pendente a fornecedor já criada para esta vistoria (ex: fatura
  // recebida antes da inspeção se realizar) — ver handleGravarVistoria.
  const [vistoriaIdDividaExistente, setVistoriaIdDividaExistente] = useState<string | undefined>(undefined);

  // Documentos PARTILHADOS por toda a inspeção, mesmo quando cobre vários
  // equipamentos (1 só fatura/comprovativo/requerimento da visita inteira)
  // — pedido explícito: "adicionar vários documentos (faturas,
  // comprovativos de pagamento, requerimento, certificados)". O certificado
  // fica à parte, por equipamento (ver VistoriaRow), porque cada elevador
  // tem o seu próprio nº de certificado/série.
  const [vistoriaFaturaFile, setVistoriaFaturaFile] = useState<File | null>(null);
  const [vistoriaFaturaExistente, setVistoriaFaturaExistente] = useState<{ url: string; nome: string } | null>(null);
  const [vistoriaFaturaRemovida, setVistoriaFaturaRemovida] = useState(false);
  const vistoriaFaturaInputRef = useRef<HTMLInputElement>(null);
  const [vistoriaComprovativoFile, setVistoriaComprovativoFile] = useState<File | null>(null);
  const [vistoriaComprovativoExistente, setVistoriaComprovativoExistente] = useState<{ url: string; nome: string } | null>(null);
  const [vistoriaComprovativoRemovido, setVistoriaComprovativoRemovido] = useState(false);
  const vistoriaComprovativoInputRef = useRef<HTMLInputElement>(null);
  const [vistoriaRequerimentoFile, setVistoriaRequerimentoFile] = useState<File | null>(null);
  const [vistoriaRequerimentoExistente, setVistoriaRequerimentoExistente] = useState<{ url: string; nome: string } | null>(null);
  const [vistoriaRequerimentoRemovido, setVistoriaRequerimentoRemovido] = useState(false);
  const vistoriaRequerimentoInputRef = useRef<HTMLInputElement>(null);

  // Fotografias tiradas durante a própria visita (ex: estado do
  // equipamento, placa de série, anomalia encontrada) — pedido explícito:
  // "adicionar fotografias web". Mesmo padrão (base64 comprimido) já usado
  // nas fotografias do equipamento em Inventário Técnico.
  const [vistoriaFotos, setVistoriaFotos] = useState<string[]>([]);
  const vistoriaFotoInputRef = useRef<HTMLInputElement>(null);

  // Anexar um documento qualquer e deixar a IA identificar de que tipo se
  // trata (certificado/fatura/comprovativo/requerimento) — pedido
  // explícito: "anexar documentos (permitir identificar documentos com
  // IA...)". Evita ter de escolher manualmente em que botão anexar cada
  // ficheiro.
  const [classificandoDocIA, setClassificandoDocIA] = useState(false);
  const docIAInputRef = useRef<HTMLInputElement>(null);

  // Uma linha por equipamento incluído nesta inspeção — normalmente só 1,
  // mas pode ter várias (ex: os 2 elevadores do prédio na mesma visita da
  // TKE, cada um com o seu nº de certificado e a sua quota-parte do custo)
  // — pedido explícito do administrador a partir de um requerimento real à
  // Câmara que cobre 2 ascensores de uma só vez.
  //
  // Campos de identidade/conformidade (tipo, fabricante, nº de série, nº
  // de licença, nº de processo, base legal, periodicidade, antecedência do
  // alerta) deixaram de se preencher no Inventário Técnico — pedido
  // explícito: "retira da ficha de adicionar equipamento todos os campos
  // desnecessários". Ficam editáveis aqui, pré-preenchidos com o que já
  // estava gravado no equipamento, e ao gravar são escritos de volta nesse
  // MESMO registo (não há tabela nova nem duplicação de dados).
  interface VistoriaRow {
    idEquipamento: string;
    nome: string;
    // Id da entrada já gravada no historicoVistorias deste equipamento,
    // só presente em edição — permite substituir a entrada certa em vez de
    // duplicar.
    entryId?: string;
    tipo: EquipamentoTecnico["tipo"];
    fabricante: string;
    numeroSerie: string;
    numLicencaAutorizacao: string;
    numProcessoCamara: string;
    baseLegalDgeg: string;
    frequenciaInspecao: string;
    diasAlertaAntecedencia: string;
    numCertificado: string;
    // Custo = quantidadeInspecionada × custoUnitario — pedido explícito:
    // "Custo da inspeção por equipamento e total de todos os equipamentos
    // (nº de equipamentos X Custo p/ equipamento)".
    quantidadeInspecionada: string;
    custoUnitario: string;
    certFile: File | null;
    certExistente: { url: string; nome: string } | null;
    certRemovido: boolean;
  }
  const [vistoriaRows, setVistoriaRows] = useState<VistoriaRow[]>([]);
  const [vistoriaAdicionarId, setVistoriaAdicionarId] = useState("");

  const novaLinhaVistoria = (eq: EquipamentoTecnico): VistoriaRow => ({
    idEquipamento: eq.id,
    nome: eq.nome,
    entryId: undefined,
    tipo: eq.tipo || "inspeção_obrigatoria",
    fabricante: eq.fabricante || "",
    numeroSerie: eq.numeroSerie || "",
    numLicencaAutorizacao: eq.numLicencaAutorizacao || "",
    numProcessoCamara: eq.numProcessoCamara || "",
    baseLegalDgeg: eq.baseLegalDgeg || "",
    frequenciaInspecao: eq.frequenciaInspecao || "Anual",
    diasAlertaAntecedencia: String(eq.diasAlertaAntecedencia ?? 30),
    numCertificado: "",
    quantidadeInspecionada: String(eq.quantidade ?? 1),
    custoUnitario: "",
    certFile: null,
    certExistente: null,
    certRemovido: false
  });

  const abrirRegistarVistoria = (eq: EquipamentoTecnico, estadoInicial: NonNullable<HistoricoVistoriaEquipamento["estadoRegisto"]> = "Realizada") => {
    setVistoriaTargetId(eq.id);
    setVistoriaEditId(null);
    setVistoriaIdGrupo(null);
    setVistoriaEstadoRegisto(estadoInicial);
    setVistoriaDataAgendada("");
    setVistoriaData(new Date().toISOString().split("T")[0]);
    setVistoriaTecnico("");
    setVistoriaResultado("Aprovado");
    setVistoriaObservacoes("");
    // Pré-preenche com os últimos fornecedores/conta usados neste
    // equipamento (costumam repetir-se de inspeção para inspeção), mas o
    // custo fica sempre em branco — nunca presumir que custou o mesmo.
    const ultimaVistoria = (eq.historicoVistorias || [])[0];
    setVistoriaFornInspecaoId(ultimaVistoria?.id_fornecedor_inspecao || "");
    setVistoriaFornInspecaoNome(ultimaVistoria?.id_fornecedor_inspecao ? "" : (ultimaVistoria?.fornecedorInspecaoNome || ""));
    setVistoriaFornManutencaoId(ultimaVistoria?.id_fornecedor_manutencao || "");
    setVistoriaFornManutencaoNome(ultimaVistoria?.id_fornecedor_manutencao ? "" : (ultimaVistoria?.fornecedorManutencaoNome || ""));
    setVistoriaContaPagamento(ultimaVistoria?.id_conta_pagamento || "");
    setVistoriaIdMovimentoExistente(undefined);
    setVistoriaIdDividaExistente(undefined);
    setVistoriaFaturaFile(null); setVistoriaFaturaExistente(null); setVistoriaFaturaRemovida(false);
    setVistoriaComprovativoFile(null); setVistoriaComprovativoExistente(null); setVistoriaComprovativoRemovido(false);
    setVistoriaRequerimentoFile(null); setVistoriaRequerimentoExistente(null); setVistoriaRequerimentoRemovido(false);
    setVistoriaFotos([]);
    setVistoriaRows([novaLinhaVistoria(eq)]);
    setVistoriaAdicionarId("");
  };

  const adicionarEquipamentoAVistoria = (id: string) => {
    if (!id || vistoriaRows.some(r => r.idEquipamento === id)) { setVistoriaAdicionarId(""); return; }
    const eq = equipamentos.find(x => x.id === id);
    if (!eq) return;
    setVistoriaRows(prev => [...prev, novaLinhaVistoria(eq)]);
    setVistoriaAdicionarId("");
  };

  const removerLinhaVistoria = (id: string) => {
    setVistoriaRows(prev => prev.length > 1 ? prev.filter(r => r.idEquipamento !== id) : prev);
  };

  const atualizarLinhaVistoria = (id: string, patch: Partial<VistoriaRow>) => {
    setVistoriaRows(prev => prev.map(r => r.idEquipamento === id ? { ...r, ...patch } : r));
  };

  const iniciarEdicaoVistoria = (eq: EquipamentoTecnico, v: HistoricoVistoriaEquipamento) => {
    setVistoriaTargetId(eq.id);
    setVistoriaEditId(v.id);
    setVistoriaIdGrupo(v.idGrupo || null);
    setVistoriaEstadoRegisto(v.estadoRegisto || "Realizada");
    setVistoriaDataAgendada(v.dataAgendada || "");
    setVistoriaData(v.data);
    setVistoriaTecnico(v.tecnico === "Não identificado" ? "" : v.tecnico);
    setVistoriaResultado(v.resultado);
    setVistoriaObservacoes(v.observacoes || "");
    setVistoriaFornInspecaoId(v.id_fornecedor_inspecao || "");
    setVistoriaFornInspecaoNome(v.id_fornecedor_inspecao ? "" : (v.fornecedorInspecaoNome || ""));
    setVistoriaFornManutencaoId(v.id_fornecedor_manutencao || "");
    setVistoriaFornManutencaoNome(v.id_fornecedor_manutencao ? "" : (v.fornecedorManutencaoNome || ""));
    setVistoriaContaPagamento(v.id_conta_pagamento || "");
    setVistoriaIdMovimentoExistente(v.id_movimento);
    setVistoriaIdDividaExistente(v.id_divida);
    setVistoriaFotos(v.fotos || []);

    const docsPartilhados = v.documentos || [];
    const fatura = docsPartilhados.find(d => d.tipo === "fatura");
    const comprovativo = docsPartilhados.find(d => d.tipo === "comprovativo_pagamento");
    const requerimento = docsPartilhados.find(d => d.tipo === "requerimento");
    setVistoriaFaturaFile(null); setVistoriaFaturaExistente(fatura ? { url: fatura.url, nome: fatura.nome } : null); setVistoriaFaturaRemovida(false);
    setVistoriaComprovativoFile(null); setVistoriaComprovativoExistente(comprovativo ? { url: comprovativo.url, nome: comprovativo.nome } : null); setVistoriaComprovativoRemovido(false);
    setVistoriaRequerimentoFile(null); setVistoriaRequerimentoExistente(requerimento ? { url: requerimento.url, nome: requerimento.nome } : null); setVistoriaRequerimentoRemovido(false);

    // Reconstrói as linhas: o equipamento clicado + todos os outros
    // equipamentos com uma entrada do mesmo idGrupo (inspeção conjunta).
    // Os campos de identidade/conformidade vêm sempre do registo ATUAL do
    // equipamento (é lá que ficam gravados), não da entrada histórica.
    const construirLinha = (equipamento: EquipamentoTecnico, entrada: HistoricoVistoriaEquipamento): VistoriaRow => {
      const certDoc = (entrada.documentos || []).find(d => d.tipo === "certificado");
      return {
        idEquipamento: equipamento.id,
        nome: equipamento.nome,
        entryId: entrada.id,
        tipo: equipamento.tipo || "inspeção_obrigatoria",
        fabricante: equipamento.fabricante || "",
        numeroSerie: equipamento.numeroSerie || "",
        numLicencaAutorizacao: equipamento.numLicencaAutorizacao || "",
        numProcessoCamara: equipamento.numProcessoCamara || "",
        baseLegalDgeg: equipamento.baseLegalDgeg || "",
        frequenciaInspecao: equipamento.frequenciaInspecao || "Anual",
        diasAlertaAntecedencia: String(equipamento.diasAlertaAntecedencia ?? 30),
        numCertificado: entrada.numCertificado || "",
        quantidadeInspecionada: String(entrada.quantidadeInspecionada ?? equipamento.quantidade ?? 1),
        custoUnitario: entrada.custoUnitario != null ? String(entrada.custoUnitario) : "",
        certFile: null,
        certExistente: certDoc ? { url: certDoc.url, nome: certDoc.nome } : null,
        certRemovido: false
      };
    };
    const linhas: VistoriaRow[] = [construirLinha(eq, v)];
    if (v.idGrupo) {
      equipamentos.forEach(outroEq => {
        if (outroEq.id === eq.id) return;
        const entradaIrma = (outroEq.historicoVistorias || []).find(h => h.idGrupo === v.idGrupo);
        if (entradaIrma) linhas.push(construirLinha(outroEq, entradaIrma));
      });
    }
    setVistoriaRows(linhas);
    setVistoriaAdicionarId("");
  };

  // Categoria SNC sugerida a partir do nome/categoria do equipamento —
  // mesma lógica já usada na antiga Agenda de Manutenção, agora unificada
  // aqui. Cai sempre em "Manutenção" genérico quando não reconhece nada.
  const categoriaSugeridaSNC = (eq: EquipamentoTecnico): string => {
    const t = `${eq.nome} ${eq.categoria}`.toLowerCase();
    if (/elevador/.test(t)) return "Manutenção de Elevadores";
    if (/extintor|corta-fogo|inc[êe]ndio|sinaliza[çc][ãa]o de emerg[êe]ncia/.test(t)) return "Segurança Contra Incêndio";
    if (/g[áa]s|conduta/.test(t)) return "Inspeção de Gás";
    if (/bomba|drenagem|[áa]guas pluviais/.test(t)) return "Manutenção de Bombas";
    if (/jardim|rega|eletrobomba/.test(t)) return "Manutenção de Jardins";
    if (/quadro el[ée]tric|coluna el[ée]trica|caixa t[ée]cnica/.test(t)) return "Manutenção Elétrica";
    if (/telhado|cobertura/.test(t)) return "Manutenção de Cobertura";
    return "Manutenção";
  };

  // Regista também no Arquivo Documental central da aplicação — pedido
  // explícito: "Todos os documentos anexados guardados em arquivo
  // próprio". Falhas aqui nunca travam a gravação da vistoria em si (o
  // documento já está ligado ao equipamento de qualquer forma).
  const arquivarDocumentoCentral = async (tipo: DocumentoVistoria["tipo"], url: string, nomeFicheiro: string, rotuloEquipamentos: string) => {
    if (!setDocumentos) return;
    const rotulos: Record<DocumentoVistoria["tipo"], string> = {
      certificado: "Certificado de Inspeção",
      fatura: "Fatura de Inspeção/Manutenção",
      comprovativo_pagamento: "Comprovativo de Pagamento",
      requerimento: "Requerimento de Inspeção",
      outro: "Documento de Inspeção"
    };
    try {
      const novoDoc: Documento = {
        id_doc: "doc-insp-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        id_predio: predio.id_predio,
        nome: nomeFicheiro,
        tipo: "inspecao_tecnica",
        data_upload: new Date().toISOString().split("T")[0],
        tamanho: "",
        categoria: rotulos[tipo],
        descricao: `${rotulos[tipo]} — ${rotuloEquipamentos}`,
        visibilidade: "Administração",
        autor: loggedUser.nome || "Administração",
        caminho: url,
        arquivado: true,
        data_arquivamento: new Date().toISOString().split("T")[0],
        tipo_arquivo: "documento"
      };
      const ok = await saveDocumentoToSupabase(novoDoc);
      if (ok) setDocumentos(prev => [novoDoc, ...prev]);
    } catch { /* arquivo central é um extra — nunca trava a vistoria */ }
  };

  const handleGravarVistoria = async (e: React.FormEvent) => {
    e.preventDefault();
    const equipamentosAlvo = vistoriaRows
      .map(row => ({ row, eq: equipamentos.find(eq => eq.id === row.idEquipamento) }))
      .filter((x): x is { row: VistoriaRow; eq: EquipamentoTecnico } => !!x.eq);
    if (equipamentosAlvo.length === 0) return;
    setAGravarVistoria(true);
    try {
      const idBase = vistoriaEditId || `vist-${Date.now()}`;
      const rotuloEquipamentos = equipamentosAlvo.map(({ eq }) => eq.nome).join(", ");

      // Documentos partilhados por TODA a inspeção — 1 só upload mesmo que
      // cubra vários equipamentos (pedido explícito: "adicionar vários
      // documentos (faturas, comprovativos de pagamento, requerimento,
      // certificados)").
      const documentosPartilhados: DocumentoVistoria[] = [];
      const uploadPartilhado = async (file: File | null, existente: { url: string; nome: string } | null, removido: boolean, tipo: DocumentoVistoria["tipo"], pasta: string, rotulo: string) => {
        if (file) {
          const caminho = `inventario_tecnico/${predio.id_predio}/grupo/${pasta}-${Date.now()}-${file.name}`;
          const url = await uploadDocumentoToStorage(file, caminho);
          if (!url) throw new Error(`Não foi possível carregar o ficheiro de ${rotulo}. Tente novamente.`);
          documentosPartilhados.push({ id: `${idBase}-${tipo}`, tipo, url, nome: file.name });
          await arquivarDocumentoCentral(tipo, url, file.name, rotuloEquipamentos);
        } else if (!removido && existente) {
          documentosPartilhados.push({ id: `${idBase}-${tipo}`, tipo, url: existente.url, nome: existente.nome });
        }
      };
      await uploadPartilhado(vistoriaFaturaFile, vistoriaFaturaExistente, vistoriaFaturaRemovida, "fatura", "fatura", "fatura");
      await uploadPartilhado(vistoriaComprovativoFile, vistoriaComprovativoExistente, vistoriaComprovativoRemovido, "comprovativo_pagamento", "comprovativo", "comprovativo de pagamento");
      await uploadPartilhado(vistoriaRequerimentoFile, vistoriaRequerimentoExistente, vistoriaRequerimentoRemovido, "requerimento", "requerimento", "requerimento");

      // Certificado — próprio de cada equipamento (nº de certificado/série
      // diferente por elevador, mesmo numa inspeção conjunta).
      const documentosPorEquipamento: Record<string, DocumentoVistoria[]> = {};
      for (const { row } of equipamentosAlvo) {
        const docs: DocumentoVistoria[] = [...documentosPartilhados];
        if (row.certFile) {
          const caminho = `inventario_tecnico/${predio.id_predio}/${row.idEquipamento}/certificado-${Date.now()}-${row.certFile.name}`;
          const url = await uploadDocumentoToStorage(row.certFile, caminho);
          if (!url) throw new Error(`Não foi possível carregar o certificado de "${row.nome}". Tente novamente.`);
          docs.unshift({ id: `${row.entryId || idBase}-certificado`, tipo: "certificado", url, nome: row.certFile.name });
          await arquivarDocumentoCentral("certificado", url, row.certFile.name, row.nome);
        } else if (!row.certRemovido && row.certExistente) {
          docs.unshift({ id: `${row.entryId || idBase}-certificado`, tipo: "certificado", url: row.certExistente.url, nome: row.certExistente.nome });
        }
        documentosPorEquipamento[row.idEquipamento] = docs;
      }

      const fornecedorInspecaoReal = fornecedores.find(f => f.id_fornecedor === vistoriaFornInspecaoId);
      const fornecedorManutencaoReal = fornecedores.find(f => f.id_fornecedor === vistoriaFornManutencaoId);

      // Custo por equipamento = quantidade inspecionada × custo unitário —
      // pedido explícito: "Custo da inspeção por equipamento e total de
      // todos os equipamentos (nº de equipamentos X Custo p/ equipamento)".
      const custosPorEquipamento = equipamentosAlvo.map(({ row }) => {
        const qtd = Math.max(1, parseInt(row.quantidadeInspecionada, 10) || 1);
        const unitario = row.custoUnitario ? (parseValorMonetario(row.custoUnitario) || 0) : 0;
        return { id: row.idEquipamento, quantidade: qtd, custoUnitario: unitario, custo: qtd * unitario };
      });
      const custoTotal = custosPorEquipamento.reduce((soma, c) => soma + c.custo, 0);
      const ehGrupo = equipamentosAlvo.length > 1;
      const idGrupoFinal = ehGrupo ? (vistoriaIdGrupo || `grp-${Date.now()}`) : (vistoriaIdGrupo || undefined);

      // Custo desta inspeção: nunca repartido pelas frações. Pedido
      // explícito do administrador: "a dívida pode ser paga
      // antecipadamente... passa a paga quando consta o pagamento no
      // extrato ou comprovativo de pagamento" — ou seja, pagar é
      // totalmente independente de a inspeção estar "Realizada", e o que
      // decide se já está pago é a presença de um COMPROVATIVO DE
      // PAGAMENTO (não a fatura sozinha, nem o estado da vistoria): sem
      // comprovativo, fica sempre como dívida pendente a fornecedor, tal
      // como uma fatura normal (NOWO, eletricidade); com comprovativo
      // anexado (agora ou já antes), lança-se logo o movimento real e
      // debita a conta, fechando a dívida pendente se já existir uma.
      let idMovimentoFinal = vistoriaIdMovimentoExistente;
      let idDividaFinal = vistoriaIdDividaExistente;
      const nomesEquipamentos = equipamentosAlvo.map(({ eq }) => eq.nome).join(", ");
      const fornecedorFaturaReal = fornecedorManutencaoReal || fornecedorInspecaoReal;
      const nomeFornecedorFatura = fornecedorManutencaoReal?.nome || vistoriaFornManutencaoNome.trim() || fornecedorInspecaoReal?.nome || vistoriaFornInspecaoNome.trim() || "Entidade de Inspeção";
      const faturaUrl = documentosPartilhados.find(d => d.tipo === "fatura")?.url;
      const comprovativoUrl = documentosPartilhados.find(d => d.tipo === "comprovativo_pagamento")?.url;
      const temProvaPagamento = !!comprovativoUrl;
      const dividaLigadaAtual = idDividaFinal ? dividasPorId[idDividaFinal] : undefined;
      const dividaJaPaga = !!dividaLigadaAtual && dividaLigadaAtual.estado !== "Pendente";

      if (custoTotal > 0 && vistoriaContaPagamento) {
        if (dividaJaPaga) {
          // Já foi paga fora deste ecrã (Fornecedores ou reconhecimento no
          // extrato bancário) — só reflete isso, nunca lança 2ª vez.
          if (dividaLigadaAtual!.id_movimento_pagamento) idMovimentoFinal = dividaLigadaAtual!.id_movimento_pagamento;
        } else if (temProvaPagamento && !idMovimentoFinal) {
          // Há comprovativo de pagamento (agora ou já anexado antes) —
          // está pago, lança o movimento e fecha a dívida pendente se
          // existir uma.
          if (!setMovements) {
            alert("Sistema de movimentos não disponível de momento — a vistoria foi gravada sem lançar o custo.");
          } else {
            const contaAlvo = contas.find(c => c.id_conta === vistoriaContaPagamento);
            if (!contaAlvo) {
              alert("Conta de pagamento não encontrada — a vistoria foi gravada sem lançar o custo.");
            } else {
              const novoMov: Movimento = {
                id_mov: "mov-inv-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
                id_predio: predio.id_predio,
                id_conta: contaAlvo.id_conta,
                data: vistoriaData,
                tipo: "Despesa",
                valor: custoTotal,
                descricao: `${nomesEquipamentos} — ${nomeFornecedorFatura} — inspeção de ${formatDatePT(vistoriaData)}`,
                categoria: categoriaSugeridaSNC(equipamentosAlvo[0].eq),
                estado: "Pago",
                is_movimento_cego: false,
                id_fornecedor: fornecedorFaturaReal?.id_fornecedor,
                comprovativo_url: comprovativoUrl || faturaUrl
              };
              const okMov = await saveMovimentoToSupabase(novoMov);
              if (!okMov) {
                alert("❌ Não foi possível gravar o movimento do custo. A vistoria foi gravada, mas o custo NÃO ficou lançado — tente lançá-lo outra vez ao editar esta vistoria.");
              } else {
                setMovements(prev => [novoMov, ...prev]);
                await ajustarSaldoContaReal(contaAlvo.id_conta, -novoMov.valor);
                idMovimentoFinal = novoMov.id_mov;
                if (idDividaFinal) {
                  // Fecha a dívida pendente que já existia, em vez de a
                  // deixar esquecida a dizer "Pendente" para sempre.
                  await saveDividaFornecedorToSupabase({
                    id_divida: idDividaFinal,
                    id_predio: predio.id_predio,
                    id_fornecedor: fornecedorFaturaReal?.id_fornecedor,
                    fornecedor_nome: nomeFornecedorFatura,
                    descricao: `${nomesEquipamentos} — inspeção técnica`,
                    valor: custoTotal,
                    estado: "Paga",
                    valor_pago: custoTotal,
                    data_pagamento: vistoriaData,
                    id_conta_pagamento: contaAlvo.id_conta,
                    id_movimento_pagamento: novoMov.id_mov
                  });
                }
              }
            }
          }
        } else {
          // Sem comprovativo de pagamento ainda — fica (ou mantém-se) como
          // dívida pendente a fornecedor, independente do estado da
          // vistoria (pode já ter sido "Realizada" e continuar por pagar).
          const divida: DividaFornecedor = {
            id_divida: idDividaFinal || "div-insp-" + Date.now(),
            id_predio: predio.id_predio,
            id_fornecedor: fornecedorFaturaReal?.id_fornecedor,
            fornecedor_nome: nomeFornecedorFatura,
            descricao: `${nomesEquipamentos} — inspeção técnica${vistoriaEstadoRegisto !== "Realizada" ? ` (${vistoriaEstadoRegisto === "Agendada" ? "agendada" : "solicitada"})` : ""}`,
            categoria: categoriaSugeridaSNC(equipamentosAlvo[0].eq),
            valor: custoTotal,
            data_emissao: vistoriaData,
            data_vencimento: vistoriaDataAgendada || undefined,
            estado: "Pendente",
            documento_anexo: faturaUrl
          };
          const okDivida = await saveDividaFornecedorToSupabase(divida);
          if (!okDivida) {
            alert("❌ Não foi possível registar a dívida pendente deste custo. A vistoria foi gravada na mesma — tente outra vez ao editar.");
          } else {
            idDividaFinal = divida.id_divida;
          }
        }
      }

      const equipamentosAtualizados: EquipamentoTecnico[] = equipamentosAlvo.map(({ row, eq: eqAlvoOriginal }) => {
        const custosLinha = custosPorEquipamento.find(c => c.id === row.idEquipamento);
        const entradaVistoria: HistoricoVistoriaEquipamento = {
          id: row.entryId || `vist-${Date.now()}-${row.idEquipamento}`,
          idGrupo: idGrupoFinal,
          estadoRegisto: vistoriaEstadoRegisto,
          dataAgendada: vistoriaDataAgendada || undefined,
          data: vistoriaData,
          tecnico: vistoriaTecnico || "Não identificado",
          resultado: vistoriaResultado,
          observacoes: vistoriaObservacoes || undefined,
          numCertificado: row.numCertificado || undefined,
          documentos: documentosPorEquipamento[row.idEquipamento],
          fotos: vistoriaFotos.length > 0 ? vistoriaFotos : undefined,
          id_fornecedor_inspecao: fornecedorInspecaoReal?.id_fornecedor,
          fornecedorInspecaoNome: fornecedorInspecaoReal?.nome || vistoriaFornInspecaoNome.trim() || undefined,
          id_fornecedor_manutencao: fornecedorManutencaoReal?.id_fornecedor,
          fornecedorManutencaoNome: fornecedorManutencaoReal?.nome || vistoriaFornManutencaoNome.trim() || undefined,
          custo: custosLinha?.custo || undefined,
          custoUnitario: custosLinha?.custoUnitario || undefined,
          quantidadeInspecionada: custosLinha?.quantidade,
          custoTotalGrupo: ehGrupo ? custoTotal : undefined,
          id_conta_pagamento: vistoriaContaPagamento || undefined,
          id_movimento: idMovimentoFinal,
          id_divida: idDividaFinal
        };

        // Identidade/conformidade do equipamento (tipo, fabricante, nº de
        // série/licença/processo, base legal, periodicidade, antecedência
        // do alerta) escritas de volta a partir desta linha — pedido
        // explícito: deixaram de se editar no Inventário Técnico, passam a
        // editar-se aqui.
        const eqAlvo: EquipamentoTecnico = {
          ...eqAlvoOriginal,
          tipo: row.tipo,
          fabricante: row.fabricante || undefined,
          numeroSerie: row.numeroSerie || undefined,
          numLicencaAutorizacao: row.numLicencaAutorizacao || undefined,
          numProcessoCamara: row.numProcessoCamara || undefined,
          baseLegalDgeg: row.baseLegalDgeg || undefined,
          frequenciaInspecao: row.frequenciaInspecao || "Anual",
          diasAlertaAntecedencia: Math.max(1, parseInt(row.diasAlertaAntecedencia, 10) || 30)
        };

        const historicoAtualizado = row.entryId
          ? (eqAlvo.historicoVistorias || []).map(v => v.id === row.entryId ? entradaVistoria : v)
          : [entradaVistoria, ...(eqAlvo.historicoVistorias || [])];

        // A validade/estado do equipamento só reflete vistorias REALIZADAS
        // (ou sem este campo, histórico antigo) — uma inspeção só
        // "Solicitada" ou "Agendada" ainda não aconteceu, por isso não pode
        // mudar a validade real do equipamento (pedido explícito: "campo
        // para solicitação de inspeção e depois o agendamento da mesma").
        // Entre essas, conta sempre a mais RECENTE por data (não a última
        // gravada) — importante em edição, onde corrigir a data de uma
        // entrada antiga não pode mudar a validade atual se já houver uma
        // vistoria mais recente no histórico.
        const realizadas = historicoAtualizado.filter(v => !v.estadoRegisto || v.estadoRegisto === "Realizada");
        const maisRecente = [...realizadas].sort((a, b) => b.data.localeCompare(a.data))[0];
        if (!maisRecente) {
          // Só há vistorias pendentes (Solicitada/Agendada) — mantém a
          // validade atual do equipamento tal como estava.
          return { ...eqAlvo, historicoVistorias: historicoAtualizado };
        }
        const novoEstado: EquipamentoTecnico["estado"] =
          maisRecente.resultado === "Reprovado" ? "Crítico" :
          maisRecente.resultado === "Aprovado com Reservas" ? "Necessita Manutenção" :
          "Operacional";
        // Pedido explícito: "considerar a hipótese de reprovar a inspeção e
        // termos de agendar nova inspeção após alguma reparação" — uma
        // inspeção REPROVADA não pode agendar a próxima pelo ciclo normal
        // (ex: +2 anos para um elevador bianual), isso passaria a sensação
        // de que está tudo bem até lá. Fica sem data de validade (o cartão
        // mostra antes um aviso fixo "Reprovado — necessita reinspeção") até
        // se registar uma nova vistoria (mesmo que só "Solicitada") depois
        // da reparação.
        const proximaInspecao = maisRecente.resultado === "Reprovado"
          ? undefined
          : calcularProximaInspecao(maisRecente.data, eqAlvo.frequenciaInspecao || "Anual");

        return {
          ...eqAlvo,
          estado: novoEstado,
          ultimaInspecao: maisRecente.data,
          proximaInspecaoData: proximaInspecao,
          // Reposto a undefined sempre que a próxima inspeção muda, para o
          // cron poder voltar a alertar no novo ciclo.
          alertaEnviadoEm: undefined,
          historicoVistorias: historicoAtualizado
        };
      });

      const resultados = await Promise.all(equipamentosAtualizados.map(eqAtual => saveEquipamentoTecnicoToSupabase(predio.id_predio, eqAtual)));
      if (resultados.some(r => !r)) {
        alert("❌ Não foi possível gravar a vistoria. Tente novamente.");
        return;
      }
      setEquipamentos(prev => prev.map(eq => equipamentosAtualizados.find(a => a.id === eq.id) || eq));
      recarregarDividas();
      registarLogAuditoria("Manutenção", `${vistoriaEditId ? "Editou" : "Registou"} vistoria de "${nomesEquipamentos}" (${vistoriaResultado})${custoTotal ? ` — custo total ${custoTotal.toFixed(2)}€` : ""}`, predio.id_predio, loggedUser, vistoriaObservacoes || undefined);
      setVistoriaTargetId(null);
      setVistoriaEditId(null);
      setVistoriaRows([]);
      setVistoriaFotos([]);
      const sufixoValidade = vistoriaEstadoRegisto === "Realizada"
        ? " Validade atualizada e próxima inspeção agendada."
        : vistoriaEstadoRegisto === "Agendada"
          ? ` Fica agendada para ${formatDatePT(vistoriaDataAgendada)} — a validade do equipamento só muda quando marcar como "Realizada".`
          : ` Pedido registado — a validade do equipamento só muda quando marcar como "Realizada".`;
      alert(vistoriaEditId
        ? `✅ Vistoria atualizada!${sufixoValidade}`
        : `✅ ${vistoriaEstadoRegisto === "Realizada" ? "Vistoria registada" : vistoriaEstadoRegisto === "Agendada" ? "Agendamento registado" : "Solicitação registada"}${ehGrupo ? ` para ${equipamentosAlvo.length} equipamentos (${nomesEquipamentos})` : ""}!${idMovimentoFinal ? ` Custo total de ${custoTotal.toFixed(2)}€ lançado na conta.` : ""}${sufixoValidade}`);
    } catch (err: any) {
      alert(`❌ ${err?.message || "Não foi possível gravar a vistoria. Tente novamente."}`);
    } finally {
      setAGravarVistoria(false);
    }
  };

  // Fotografias da visita — mesmo padrão (base64 comprimido, inline, sem
  // upload para Storage) já usado nas fotografias do equipamento em
  // Inventário Técnico. Pedido explícito: "adicionar fotografias web".
  const handleVistoriaFotosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []);
    e.target.value = "";
    files.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 700;
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
          setVistoriaFotos(prev => [...prev, canvas.toDataURL("image/webp", 0.8)]);
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Anexar um documento qualquer e deixar a IA identificar o tipo — pedido
  // explícito: "anexar documentos (permitir identificar documentos com
  // IA...)". A IA só decide ONDE o documento fica; quem o anexa continua a
  // ser o administrador.
  const handleAnexarDocumentoIA = async (file: File) => {
    setClassificandoDocIA(true);
    try {
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const resp = await fetch("/api/ai?acao=classificar-documento-inspecao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType: file.type || "application/octet-stream" })
      });
      const data = await resp.json();
      if (!resp.ok || !data?.tipo) throw new Error(data?.error || "A IA não conseguiu identificar este documento.");

      if (data.tipo === "fatura") {
        setVistoriaFaturaFile(file);
        alert(`✅ Identificado pela IA como Fatura: "${data.resumo || file.name}". Já foi anexado.`);
      } else if (data.tipo === "comprovativo_pagamento") {
        setVistoriaComprovativoFile(file);
        alert(`✅ Identificado pela IA como Comprovativo de Pagamento: "${data.resumo || file.name}". Já foi anexado.`);
      } else if (data.tipo === "requerimento") {
        setVistoriaRequerimentoFile(file);
        alert(`✅ Identificado pela IA como Requerimento: "${data.resumo || file.name}". Já foi anexado.`);
      } else if (data.tipo === "certificado") {
        const primeiraLinha = vistoriaRows[0];
        if (primeiraLinha) atualizarLinhaVistoria(primeiraLinha.idEquipamento, { certFile: file });
        alert(`✅ Identificado pela IA como Certificado: "${data.resumo || file.name}". Anexado a "${primeiraLinha?.nome || "equipamento"}"${vistoriaRows.length > 1 ? " — se for de outro equipamento desta inspeção conjunta, substitua no campo certo abaixo." : ""}.`);
      } else {
        alert(`A IA não identificou com confiança o tipo deste documento (resumo: "${data.resumo || "sem resumo"}"). Anexe-o manualmente no campo certo abaixo.`);
      }
    } catch (err: any) {
      alert(`❌ ${err?.message || "Não foi possível identificar este documento."}`);
    } finally {
      setClassificandoDocIA(false);
    }
  };

  // Elimina um registo de vistoria isolado — pedido explícito: "colocar a
  // possibilidade de eliminar o registo". Reverte com segurança tudo o que
  // esse registo tenha criado (movimento real já pago e/ou dívida pendente
  // ainda por pagar) antes de o remover, e recalcula a validade do
  // equipamento a partir do que sobrar no histórico.
  const handleEliminarVistoria = async (eq: EquipamentoTecnico, v: HistoricoVistoriaEquipamento) => {
    const avisos: string[] = [];
    if (v.id_movimento) avisos.push("o movimento de despesa já pago será revertido e o saldo da conta corrigido");
    if (v.id_divida) avisos.push("a dívida pendente associada será removida");
    if (!window.confirm(`Eliminar este registo de vistoria de ${formatDatePT(v.data)}?${avisos.length ? ` (${avisos.join("; ")}).` : ""} Esta ação não pode ser desfeita.`)) return;

    if (v.id_movimento) {
      const ok = await deleteMovimentoFromSupabase(v.id_movimento);
      if (ok) {
        if (setMovements) setMovements(prev => prev.filter(m => m.id_mov !== v.id_movimento));
        if (v.id_conta_pagamento && v.custo) {
          const contaAlvo = contas.find(c => c.id_conta === v.id_conta_pagamento);
          if (contaAlvo) await ajustarSaldoContaReal(contaAlvo.id_conta, v.custo);
        }
      } else {
        alert("⚠️ Não foi possível reverter o movimento já lançado — confirme manualmente em Área Financeira antes de continuar.");
      }
    }
    if (v.id_divida) {
      await deleteDividaFornecedorFromSupabase(v.id_divida).catch(() => {});
    }

    const historicoAtualizado = (eq.historicoVistorias || []).filter(h => h.id !== v.id);
    const realizadas = historicoAtualizado.filter(h => !h.estadoRegisto || h.estadoRegisto === "Realizada");
    const maisRecente = [...realizadas].sort((a, b) => b.data.localeCompare(a.data))[0];
    const equipamentoAtualizado: EquipamentoTecnico = maisRecente
      ? {
          ...eq,
          estado: maisRecente.resultado === "Reprovado" ? "Crítico" : maisRecente.resultado === "Aprovado com Reservas" ? "Necessita Manutenção" : "Operacional",
          ultimaInspecao: maisRecente.data,
          proximaInspecaoData: maisRecente.resultado === "Reprovado" ? undefined : calcularProximaInspecao(maisRecente.data, eq.frequenciaInspecao || "Anual"),
          alertaEnviadoEm: undefined,
          historicoVistorias: historicoAtualizado
        }
      : {
          ...eq,
          estado: "Operacional",
          ultimaInspecao: "",
          proximaInspecaoData: undefined,
          alertaEnviadoEm: undefined,
          historicoVistorias: historicoAtualizado
        };

    const ok = await saveEquipamentoTecnicoToSupabase(predio.id_predio, equipamentoAtualizado);
    if (!ok) { alert("❌ Não foi possível eliminar este registo de vistoria. Tente novamente."); return; }
    setEquipamentos(prev => prev.map(e => e.id === eq.id ? equipamentoAtualizado : e));
    registarLogAuditoria("Manutenção", `Eliminou um registo de vistoria de "${eq.nome}" (${formatDatePT(v.data)})`, predio.id_predio, loggedUser);
    alert("✅ Registo de vistoria eliminado.");
  };

  const handleRemoverEquipamento = (eq: EquipamentoTecnico) => {
    const confirmRemove = confirm(`Tem a certeza que deseja remover "${eq.nome}" do inventário do prédio? O histórico de inspeções associado também é eliminado.`);
    if (!confirmRemove) return;
    setEquipamentos(prev => prev.filter(e => e.id !== eq.id));
    deleteEquipamentoTecnicoFromSupabase(eq.id).catch(console.error);
    registarLogAuditoria("Manutenção", `Removeu "${eq.nome}" do inventário técnico (a partir de Inspeções Técnicas)`, predio.id_predio, loggedUser);
  };

  // Estatísticas focadas na validade das inspeções (não no estado físico do
  // equipamento, que é assunto do Inventário Técnico).
  const comData = equipamentos.filter(e => e.proximaInspecaoData);
  const agora = Date.now();
  const vencidas = comData.filter(e => new Date(e.proximaInspecaoData!).getTime() < agora).length;
  const aVencer = comData.filter(e => {
    const dias = Math.ceil((new Date(e.proximaInspecaoData!).getTime() - agora) / 86400000);
    return dias >= 0 && dias <= (e.diasAlertaAntecedencia ?? 30);
  }).length;
  const emDia = comData.length - vencidas - aVencer;

  // Ordena a listagem pelas mais urgentes primeiro (vencidas > a vencer >
  // em dia > sem data), para o administrador ver logo o que precisa de
  // atenção.
  const equipamentosOrdenados = [...equipamentos].sort((a, b) => {
    const dataA = a.proximaInspecaoData ? new Date(a.proximaInspecaoData).getTime() : Infinity;
    const dataB = b.proximaInspecaoData ? new Date(b.proximaInspecaoData).getTime() : Infinity;
    return dataA - dataB;
  });

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 animate-fadeIn">

      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">Inspeções Técnicas</h3>
        <p className="text-[11px] text-slate-600">Registo de vistorias obrigatórias e preventivas — data, resultado, fornecedores, custos e documentos (certificado, fatura, comprovativo, requerimento).</p>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-600 uppercase block font-bold">Equipamentos a Monitorizar</span>
            <span className="text-xl font-bold font-mono">{equipamentos.length}</span>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/40 p-2.5 rounded-lg text-blue-500">
            <Wrench className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-600 uppercase block font-bold">Inspeções em Dia</span>
            <span className="text-xl font-bold font-mono text-emerald-600">{emDia}</span>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg text-emerald-500">
            <Check className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-600 uppercase block font-bold">A Vencer</span>
            <span className="text-xl font-bold font-mono text-amber-600">{aVencer}</span>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg text-amber-500">
            <Bell className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-600 uppercase block font-bold">Vencidas</span>
            <span className="text-xl font-bold font-mono text-red-600">{vencidas}</span>
          </div>
          <div className="bg-red-50 dark:bg-red-950/40 p-2.5 rounded-lg text-red-500">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Listagem de equipamentos + histórico de inspeções */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
          <ClipboardList className="h-4 w-4 text-emerald-500" />
          Equipamentos e Histórico de Vistorias
        </h3>

        {equipamentos.length === 0 && (
          <p className="text-xs text-slate-600 bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center">
            Ainda não há equipamentos registados. Vá a "Inventário Técnico" para criar o primeiro equipamento e depois volte aqui para lhe registar inspeções.
          </p>
        )}

        <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
          {equipamentosOrdenados.map(e => (
            <div key={e.id} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2 hover:border-slate-300 transition-colors">
              <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 px-2 rounded font-bold font-mono">{e.categoria}</span>
                    <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
                      e.tipo === "inspeção_obrigatoria"
                        ? "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400"
                        : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400"
                    }`}>
                      {e.tipo === "inspeção_obrigatoria" ? "Obrigatória (Lei)" : "Facultativa"}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {e.nome}{e.numeroSerie ? ` — Nº Série ${e.numeroSerie}` : ""}
                  </h4>
                  <p className="text-[10px] text-slate-600">
                    Piso: <strong>{e.andar}</strong>
                    {e.quantidade != null && e.quantidade > 1 ? <> • Quantidade: <strong>{e.quantidade} unidades</strong></> : ""}
                    {e.localizacaoDetalhada ? <> • Localização: <strong>{e.localizacaoDetalhada}</strong></> : ""}
                    {e.entidadeResponsavel ? <> • Entidade: <strong>{e.entidadeResponsavel}</strong></> : ""}
                  </p>

                  {/* Reprovada — pedido explícito: não mostrar uma data de
                      validade normal (seria enganador, como se estivesse
                      tudo bem até lá); mostra antes um aviso fixo e um
                      atalho direto para agendar a reinspeção depois da
                      reparação. */}
                  {!e.proximaInspecaoData && e.estado === "Crítico" && (
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg border bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 animate-pulse">
                      <ShieldAlert className="h-3 w-3" />
                      Reprovada — necessita reparação e reinspeção
                    </div>
                  )}

                  {e.proximaInspecaoData && (() => {
                    const diasRestantes = Math.ceil((new Date(e.proximaInspecaoData).getTime() - Date.now()) / 86400000);
                    const prazo = e.diasAlertaAntecedencia ?? 30;
                    const aVencerItem = diasRestantes <= prazo;
                    return (
                      <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg border ${
                        diasRestantes < 0 ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400" :
                        aVencerItem ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400" :
                        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400"
                      }`}>
                        <CalendarCheck className="h-3 w-3" />
                        {diasRestantes < 0
                          ? `Vencida há ${Math.abs(diasRestantes)} dias (${formatDatePT(e.proximaInspecaoData)})`
                          : `Próxima: ${formatDatePT(e.proximaInspecaoData)} (${diasRestantes} dias)`}
                      </div>
                    );
                  })()}

                  {(() => {
                    // Pedido/agendamento ainda pendente (não é a validade do
                    // equipamento — é o que já se tratou para a próxima
                    // inspeção, antes de ela acontecer de facto).
                    const pendente = [...(e.historicoVistorias || [])]
                      .filter(v => v.estadoRegisto === "Solicitada" || v.estadoRegisto === "Agendada")
                      .sort((a, b) => b.data.localeCompare(a.data))[0];
                    if (!pendente) return null;
                    return (
                      <div className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg border bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 ml-1.5">
                        <Bell className="h-3 w-3" />
                        {pendente.estadoRegisto === "Agendada" && pendente.dataAgendada
                          ? `Inspeção agendada para ${formatDatePT(pendente.dataAgendada)}`
                          : `Inspeção solicitada em ${formatDatePT(pendente.data)}, aguarda data`}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {e.estado === "Crítico" && (
                    <button
                      onClick={() => abrirRegistarVistoria(e, "Solicitada")}
                      title="Pedido explícito: depois de reprovada, agendar a reinspeção após a reparação, em vez de esperar pelo ciclo normal"
                      className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-2 rounded-lg text-[11px] cursor-pointer shadow-sm flex items-center gap-1.5"
                    >
                      <Bell className="h-3.5 w-3.5" />
                      <span>Agendar Reinspeção</span>
                    </button>
                  )}
                  <button
                    onClick={() => abrirRegistarVistoria(e)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-lg text-[11px] cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    <CalendarCheck className="h-3.5 w-3.5" />
                    <span>Registar Vistoria</span>
                  </button>
                  {onEditarEquipamento && (
                    <button
                      onClick={() => onEditarEquipamento(e.id)}
                      className="p-2 rounded-lg border bg-white dark:bg-slate-900 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 active:border-indigo-400 active:bg-indigo-50 active:scale-95 transition-all cursor-pointer shadow-sm"
                      title="Editar Equipamento (Inventário Técnico)"
                      aria-label="Editar Equipamento"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoverEquipamento(e)}
                    className="p-2 rounded-lg border bg-white dark:bg-slate-900 text-slate-600 hover:text-red-500 hover:border-red-200 active:border-red-400 active:bg-red-50 active:scale-95 transition-all cursor-pointer shadow-sm"
                    title="Remover Equipamento"
                    aria-label="Remover Equipamento"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {e.historicoVistorias && e.historicoVistorias.length > 0 && (
                <div className="pt-1.5 space-y-1 border-t border-slate-200 dark:border-slate-800 mt-1.5">
                  <span className="text-[9px] font-bold text-slate-600 uppercase block">Histórico de Vistorias ({e.historicoVistorias.length})</span>
                  {e.historicoVistorias.slice(0, 5).map(v => {
                    const certificado = (v.documentos || []).find(d => d.tipo === "certificado");
                    const fatura = (v.documentos || []).find(d => d.tipo === "fatura");
                    const comprovativo = (v.documentos || []).find(d => d.tipo === "comprovativo_pagamento");
                    const requerimento = (v.documentos || []).find(d => d.tipo === "requerimento");
                    // Nomes dos OUTROS equipamentos cobertos pela mesma
                    // inspeção conjunta (idGrupo) — ex: "Elevador 2" na
                    // ficha do "Elevador 1".
                    const outrosDoGrupo = v.idGrupo
                      ? equipamentos.filter(outro => outro.id !== e.id && (outro.historicoVistorias || []).some(h => h.idGrupo === v.idGrupo)).map(outro => outro.nome)
                      : [];
                    return (
                      <div key={v.id} className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
                          <span className="text-slate-600 dark:text-slate-400">{formatDatePT(v.data)}</span>
                          {v.estadoRegisto && v.estadoRegisto !== "Realizada" ? (
                            <span className="px-1.5 py-0.5 rounded font-bold text-[9px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400">
                              {v.estadoRegisto === "Agendada" && v.dataAgendada ? `Agendada: ${formatDatePT(v.dataAgendada)}` : v.estadoRegisto}
                            </span>
                          ) : (
                            <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                              v.resultado === "Aprovado" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" :
                              v.resultado === "Aprovado com Reservas" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" :
                              "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                            }`}>{v.resultado}</span>
                          )}
                          <span className="text-slate-600 dark:text-slate-400">— {v.tecnico}</span>
                          {certificado && (
                            <a href={certificado.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-bold flex items-center gap-0.5">
                              <Paperclip className="h-2.5 w-2.5" /> certificado
                            </a>
                          )}
                          {requerimento && (
                            <a href={requerimento.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-bold flex items-center gap-0.5">
                              <FileText className="h-2.5 w-2.5" /> requerimento
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => iniciarEdicaoVistoria(e, v)}
                            title="Editar esta vistoria"
                            aria-label="Editar esta vistoria"
                            className="text-slate-600 hover:text-indigo-600 active:text-indigo-700 active:scale-90 transition-all cursor-pointer"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminarVistoria(e, v)}
                            title="Eliminar este registo de vistoria"
                            aria-label="Eliminar este registo de vistoria"
                            className="text-slate-600 hover:text-red-600 active:text-red-700 active:scale-90 transition-all cursor-pointer"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </div>
                        {outrosDoGrupo.length > 0 && (
                          <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold pl-0.5">Inspeção conjunta com: {outrosDoGrupo.join(", ")}</p>
                        )}
                        {(v.custo != null || v.fornecedorInspecaoNome || v.fornecedorManutencaoNome) && (
                          <div className="flex items-center gap-1.5 text-[9px] text-slate-600 dark:text-slate-500 flex-wrap pl-0.5">
                            {v.fornecedorInspecaoNome && <span>Inspeção: <strong>{v.fornecedorInspecaoNome}</strong></span>}
                            {v.fornecedorManutencaoNome && <span>Manutenção: <strong>{v.fornecedorManutencaoNome}</strong></span>}
                            {v.custo != null && (
                              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                {v.custo.toFixed(2)}€{v.custoTotalGrupo != null ? ` (de ${v.custoTotalGrupo.toFixed(2)}€ totais)` : ""}
                              </span>
                            )}
                            {v.custo != null && (() => {
                              // Estado REAL do pagamento — se há dívida
                              // ligada, manda sempre o que estiver
                              // gravado em Fornecedores (pode ter sido
                              // paga lá ou pelo extrato bancário, sem
                              // passar por aqui).
                              const dividaLigada = v.id_divida ? dividasPorId[v.id_divida] : undefined;
                              const pago = !!v.id_movimento || (dividaLigada && dividaLigada.estado !== "Pendente");
                              if (pago) return (
                                <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                  <Check className="h-2.5 w-2.5" /> pago
                                </span>
                              );
                              if (v.id_divida) return (
                                <span className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                  <Landmark className="h-2.5 w-2.5" /> dívida pendente
                                </span>
                              );
                              return (
                                <span className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold">não lançado</span>
                              );
                            })()}
                            {fatura && (
                              <a href={fatura.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-bold flex items-center gap-0.5">
                                <FileText className="h-2.5 w-2.5" /> fatura
                              </a>
                            )}
                            {comprovativo && (
                              <a href={comprovativo.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-bold flex items-center gap-0.5">
                                <Upload className="h-2.5 w-2.5" /> comprovativo
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Registar Vistoria (agendada ou avulsa, 1 ou vários equipamentos) */}
      {vistoriaTargetId && (() => {
        const eqAlvo = equipamentos.find(eq => eq.id === vistoriaTargetId);
        if (!eqAlvo) return null;
        return (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-emerald-500" /> {vistoriaEditId ? "Editar Vistoria" : "Registar Vistoria"}
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    {vistoriaRows.length > 1 ? `${vistoriaRows.length} equipamentos — ${vistoriaRows.map(r => r.nome).join(", ")}` : `${eqAlvo.nome} — ${eqAlvo.categoria}`}
                  </p>
                </div>
                <button
                  onClick={() => { setVistoriaTargetId(null); setVistoriaEditId(null); setVistoriaRows([]); }}
                  className="p-1.5 text-slate-600 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title="Fechar"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleGravarVistoria} className="space-y-3">
                {/* Ciclo de vida real — pedido explícito: "campo para
                    solicitação de inspeção e depois o agendamento da mesma
                    quando formos informados pela entidade que vem efetuar a
                    inspeção". Muda que campos fazem sentido pedir abaixo. */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Estado Desta Inspeção</label>
                  <select
                    value={vistoriaEstadoRegisto}
                    onChange={e => setVistoriaEstadoRegisto(e.target.value as any)}
                    className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold cursor-pointer"
                  >
                    <option value="Solicitada">Solicitada (pedido enviado, sem data de visita ainda)</option>
                    <option value="Agendada">Agendada (a entidade já informou a data da visita)</option>
                    <option value="Realizada">Realizada (a inspeção já aconteceu)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">
                      {vistoriaEstadoRegisto === "Realizada" ? "Data da Vistoria" : "Data do Pedido"}
                    </label>
                    <input
                      type="date"
                      value={vistoriaData}
                      onChange={e => setVistoriaData(e.target.value)}
                      required
                      className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  {vistoriaEstadoRegisto === "Realizada" ? (
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Resultado</label>
                      <select
                        value={vistoriaResultado}
                        onChange={e => setVistoriaResultado(e.target.value as any)}
                        className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-semibold cursor-pointer"
                      >
                        <option value="Aprovado">Aprovado</option>
                        <option value="Aprovado com Reservas">Aprovado com Reservas</option>
                        <option value="Reprovado">Reprovado</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Data Agendada (Informada pela Entidade)</label>
                      <input
                        type="date"
                        value={vistoriaDataAgendada}
                        onChange={e => setVistoriaDataAgendada(e.target.value)}
                        required={vistoriaEstadoRegisto === "Agendada"}
                        className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}
                </div>

                {vistoriaEstadoRegisto !== "Realizada" && (
                  <p className="text-[9px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-lg px-2.5 py-1.5">
                    Esta inspeção ainda não aconteceu — resultado, custo e certificado ficam por preencher. Quando a visita se realizar, volte a abrir este registo, mude o estado para "Realizada" e complete os dados.
                  </p>
                )}

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Técnico / Entidade que Realizou</label>
                  <input
                    type="text"
                    value={vistoriaTecnico}
                    onChange={e => setVistoriaTecnico(e.target.value)}
                    placeholder="Ex: João Silva (TKE)"
                    className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Observações</label>
                  <textarea
                    value={vistoriaObservacoes}
                    onChange={e => setVistoriaObservacoes(e.target.value)}
                    rows={3}
                    placeholder="Observações técnicas da vistoria..."
                    className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Um equipamento por omissão; "+ Incluir outro equipamento"
                    permite juntar à mesma inspeção outros equipamentos da
                    mesma visita (ex: os 2 elevadores do prédio inspecionados
                    pela TKE na mesma visita) — pedido explícito: "falta a
                    quantidade de equipamentos... custo por cada
                    equipamento". */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="text-[10px] font-black uppercase text-slate-600 flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5 text-emerald-500" /> Equipamentos Desta Inspeção
                    </h5>
                    {vistoriaRows.length > 1 && (
                      <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-full shrink-0">Inspeção conjunta ({vistoriaRows.length})</span>
                    )}
                  </div>

                  {vistoriaRows.map(row => {
                    const eqOriginal = equipamentos.find(eq => eq.id === row.idEquipamento);
                    const subtotal = Math.max(1, parseInt(row.quantidadeInspecionada, 10) || 1) * (parseValorMonetario(row.custoUnitario) || 0);
                    return (
                    <div key={row.idEquipamento} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{row.nome}</span>
                          {eqOriginal && (
                            <p className="text-[9px] text-slate-600">{eqOriginal.categoria} • {eqOriginal.andar}{eqOriginal.localizacaoDetalhada ? ` — ${eqOriginal.localizacaoDetalhada}` : ""}</p>
                          )}
                        </div>
                        {vistoriaRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removerLinhaVistoria(row.idEquipamento)}
                            title="Remover este equipamento desta inspeção"
                            aria-label={`Remover ${row.nome} desta inspeção`}
                            className="text-slate-600 hover:text-red-600 active:scale-90 transition-all cursor-pointer shrink-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Identidade/conformidade — deixou de se preencher no
                          Inventário Técnico; edita-se aqui e é escrita de
                          volta no registo do equipamento ao gravar. */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-slate-600 mb-1">Tipo de Vistoria</label>
                          <select value={row.tipo} onChange={ev => atualizarLinhaVistoria(row.idEquipamento, { tipo: ev.target.value as any })} className="w-full border p-1.5 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-[11px] cursor-pointer">
                            <option value="inspeção_obrigatoria">Obrigatória (Lei)</option>
                            <option value="preventiva">Facultativa</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-slate-600 mb-1">Fabricante</label>
                          <input type="text" value={row.fabricante} onChange={ev => atualizarLinhaVistoria(row.idEquipamento, { fabricante: ev.target.value })} placeholder="Ex: Schindler Lda." className="w-full border p-1.5 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-[11px]" />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-slate-600 mb-1">Nº de Série(s)</label>
                          <input type="text" value={row.numeroSerie} onChange={ev => atualizarLinhaVistoria(row.idEquipamento, { numeroSerie: ev.target.value })} placeholder="Ex: 50101007, 50101008..." className="w-full border p-1.5 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-[11px] font-mono" />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-slate-600 mb-1">Nº de Processo (Câmara/DGEG)</label>
                          <input type="text" value={row.numProcessoCamara} onChange={ev => atualizarLinhaVistoria(row.idEquipamento, { numProcessoCamara: ev.target.value })} placeholder="Ex: L/2009/52/0" className="w-full border p-1.5 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-[11px] font-mono" />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-slate-600 mb-1">Base Legal / DGEG</label>
                          <input type="text" value={row.baseLegalDgeg} onChange={ev => atualizarLinhaVistoria(row.idEquipamento, { baseLegalDgeg: ev.target.value })} placeholder="Ex: DL 320/2002" className="w-full border p-1.5 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-[11px]" />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-slate-600 mb-1">Nº de Licença / Autorização</label>
                          <input type="text" value={row.numLicencaAutorizacao} onChange={ev => atualizarLinhaVistoria(row.idEquipamento, { numLicencaAutorizacao: ev.target.value })} placeholder="Ex: registo DGEG" className="w-full border p-1.5 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-[11px]" />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-slate-600 mb-1">Periodicidade</label>
                          <select value={row.frequenciaInspecao} onChange={ev => atualizarLinhaVistoria(row.idEquipamento, { frequenciaInspecao: ev.target.value })} className="w-full border p-1.5 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-[11px] cursor-pointer">
                            <option value="Mensal">Mensal</option>
                            <option value="Trimestral">Trimestral</option>
                            <option value="Semestral">Semestral</option>
                            <option value="Anual">Anual</option>
                            <option value="Bianual">Bianual (2 anos)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-slate-600 mb-1">Pré-aviso (dias antes)</label>
                          <input type="number" min={1} max={180} value={row.diasAlertaAntecedencia} onChange={ev => atualizarLinhaVistoria(row.idEquipamento, { diasAlertaAntecedencia: ev.target.value })} className="w-full border p-1.5 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-[11px] font-mono" />
                        </div>
                      </div>

                      {/* Custo = quantidade inspecionada × custo unitário —
                          pedido explícito: "Custo da inspeção por
                          equipamento e total de todos os equipamentos (nº
                          de equipamentos X Custo p/ equipamento)". */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-slate-600 mb-1">Nº de Certificado</label>
                          <input
                            type="text"
                            value={row.numCertificado}
                            onChange={ev => atualizarLinhaVistoria(row.idEquipamento, { numCertificado: ev.target.value })}
                            placeholder="Ex: 2026/CERT/4821"
                            className="w-full border p-1.5 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-[11px] focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-slate-600 mb-1">Qtd. Inspecionada</label>
                          <input
                            type="number"
                            min={1}
                            value={row.quantidadeInspecionada}
                            onChange={ev => atualizarLinhaVistoria(row.idEquipamento, { quantidadeInspecionada: ev.target.value })}
                            className="w-full border p-1.5 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-[11px] font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-slate-600 mb-1">Custo p/ Equipamento (€)</label>
                          <input
                            type="text"
                            value={row.custoUnitario}
                            onChange={ev => atualizarLinhaVistoria(row.idEquipamento, { custoUnitario: ev.target.value })}
                            placeholder="Ex: 3,50"
                            className="w-full border p-1.5 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-[11px]"
                          />
                        </div>
                      </div>
                      {subtotal > 0 && (
                        <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 text-right">Subtotal: {row.quantidadeInspecionada} × {(parseValorMonetario(row.custoUnitario) || 0).toFixed(2)}€ = {subtotal.toFixed(2)}€</p>
                      )}

                      <div>
                        {row.certExistente && !row.certRemovido && !row.certFile && (
                          <div className="flex items-center justify-between gap-2 mb-1 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-lg px-2 py-1">
                            <a href={row.certExistente.url} target="_blank" rel="noopener noreferrer" className="text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold flex items-center gap-1 truncate">
                              <Paperclip className="h-3 w-3 shrink-0" />
                              <span className="truncate">{row.certExistente.nome}</span>
                            </a>
                            <button type="button" onClick={() => atualizarLinhaVistoria(row.idEquipamento, { certRemovido: true })} title="Remover este certificado" aria-label="Remover este certificado" className="text-red-600 hover:text-red-700 active:scale-90 transition-all cursor-pointer shrink-0">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        {row.certRemovido && (
                          <div className="flex items-center justify-between gap-2 mb-1 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg px-2 py-1">
                            <span className="text-red-700 dark:text-red-400 text-[10px] font-semibold">Certificado marcado para remoção.</span>
                            <button type="button" onClick={() => atualizarLinhaVistoria(row.idEquipamento, { certRemovido: false })} className="text-[9px] text-slate-600 hover:underline cursor-pointer shrink-0">Desfazer</button>
                          </div>
                        )}
                        <label htmlFor={`cert-file-${row.idEquipamento}`} className="w-full border border-dashed p-2 rounded bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-[11px] font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:border-emerald-400 hover:text-emerald-600">
                          <Paperclip className="h-3.5 w-3.5" />
                          <span>{row.certFile ? row.certFile.name : row.certExistente && !row.certRemovido ? "Substituir certificado" : "Anexar certificado (Opcional)"}</span>
                        </label>
                        <input id={`cert-file-${row.idEquipamento}`} type="file" accept=".pdf,image/*" className="hidden" onChange={ev => atualizarLinhaVistoria(row.idEquipamento, { certFile: ev.target.files?.[0] || null })} />
                      </div>
                    </div>
                    );
                  })}

                  <select
                    value={vistoriaAdicionarId}
                    onChange={ev => adicionarEquipamentoAVistoria(ev.target.value)}
                    className="w-full border border-dashed p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    <option value="">+ Incluir outro equipamento nesta mesma inspeção...</option>
                    {equipamentos.filter(eq => !vistoriaRows.some(r => r.idEquipamento === eq.id)).map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.nome} ({eq.categoria}, {eq.andar}) — {eq.quantidade ?? 1} unid. disponíveis</option>
                    ))}
                  </select>

                  {vistoriaRows.length > 1 && (
                    <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 text-right">
                      Total desta inspeção: {vistoriaRows.reduce((s, r) => s + Math.max(1, parseInt(r.quantidadeInspecionada, 10) || 1) * (parseValorMonetario(r.custoUnitario) || 0), 0).toFixed(2)}€
                    </p>
                  )}
                </div>

                {/* Entidade/empresa/conta e documentos PARTILHADOS por toda
                    a inspeção — mesmo quando cobre vários equipamentos, há
                    só 1 fatura, 1 comprovativo e 1 requerimento (o custo sai
                    sempre da conta do prédio, nunca repartido pelas
                    frações). Ligado à data desta vistoria (pedido explícito:
                    "falta a data da inspeção"). */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
                  <h5 className="text-[10px] font-black uppercase text-slate-600 flex items-center gap-1.5">
                    <Landmark className="h-3.5 w-3.5 text-indigo-500" /> Entidades e Pagamento (Opcional)
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Entidade Responsável pela Inspeção</label>
                      <select value={vistoriaFornInspecaoId} onChange={ev => { setVistoriaFornInspecaoId(ev.target.value); setVistoriaFornInspecaoNome(""); }} className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs cursor-pointer">
                        <option value="">— Escolher fornecedor registado —</option>
                        {fornecedores.filter(f => f.id_predio === predio.id_predio).map(f => (
                          <option key={f.id_fornecedor} value={f.id_fornecedor}>{f.nome}</option>
                        ))}
                      </select>
                      {!vistoriaFornInspecaoId && (
                        <input type="text" value={vistoriaFornInspecaoNome} onChange={ev => setVistoriaFornInspecaoNome(ev.target.value)} placeholder="Ex: Câmara Municipal, DGEG..." className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs mt-1.5" />
                      )}
                      {(() => {
                        const f = fornecedores.find(x => x.id_fornecedor === vistoriaFornInspecaoId);
                        if (!f || (!f.email_contacto && !f.contacto && !f.telemovel_direto)) return null;
                        return (
                          <div className="flex flex-wrap gap-2 mt-1 text-[9px] text-slate-600">
                            {f.email_contacto && <span className="flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> {f.email_contacto}</span>}
                            {(f.telemovel_direto || f.contacto) && <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {f.telemovel_direto || f.contacto}</span>}
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Fornecedor Responsável pela Assistência (Manutenção)</label>
                      <select value={vistoriaFornManutencaoId} onChange={ev => { setVistoriaFornManutencaoId(ev.target.value); setVistoriaFornManutencaoNome(""); }} className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs cursor-pointer">
                        <option value="">— Escolher fornecedor registado —</option>
                        {fornecedores.filter(f => f.id_predio === predio.id_predio).map(f => (
                          <option key={f.id_fornecedor} value={f.id_fornecedor}>{f.nome}</option>
                        ))}
                      </select>
                      {!vistoriaFornManutencaoId && (
                        <input type="text" value={vistoriaFornManutencaoNome} onChange={ev => setVistoriaFornManutencaoNome(ev.target.value)} placeholder="Ex: TKE, Schindler..." className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs mt-1.5" />
                      )}
                      {(() => {
                        const f = fornecedores.find(x => x.id_fornecedor === vistoriaFornManutencaoId);
                        if (!f || (!f.email_contacto && !f.contacto && !f.telemovel_direto)) return null;
                        return (
                          <div className="flex flex-wrap gap-2 mt-1 text-[9px] text-slate-600">
                            {f.email_contacto && <span className="flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> {f.email_contacto}</span>}
                            {(f.telemovel_direto || f.contacto) && <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {f.telemovel_direto || f.contacto}</span>}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Conta Bancária de Pagamento</label>
                      <select value={vistoriaContaPagamento} onChange={ev => setVistoriaContaPagamento(ev.target.value)} className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs cursor-pointer">
                        <option value="">— Escolher conta do prédio —</option>
                        {contas.filter(c => c.id_predio === predio.id_predio).map(c => (
                          <option key={c.id_conta} value={c.id_conta}>{c.banco} ({c.tipo})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const dividaLigada = vistoriaIdDividaExistente ? dividasPorId[vistoriaIdDividaExistente] : undefined;
                    const jaPaga = !!vistoriaIdMovimentoExistente || (dividaLigada && dividaLigada.estado !== "Pendente");
                    if (jaPaga) return (
                      <p className="text-[10px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5">
                        <Check className="h-3 w-3" /> Custo já pago{dividaLigada ? ` (em Fornecedores, ${formatDatePT(dividaLigada.data_pagamento || vistoriaData)})` : " nesta conta"} — a corrigir só os outros dados, sem lançar de novo.
                      </p>
                    );
                    if (vistoriaIdDividaExistente) return (
                      <p className="text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5">
                        <Landmark className="h-3 w-3" /> Custo registado como dívida pendente a pagar (Fornecedores → Dívidas) — paga-se quando quiser por lá (ou automaticamente, se reconhecida no extrato bancário), independentemente do estado desta vistoria.
                      </p>
                    );
                    return (
                      <p className="text-[9px] text-slate-600">Ao gravar, se indicar o custo e a conta: com um <strong>Comprovativo de Pagamento</strong> anexado (abaixo), lança logo o movimento com o TOTAL e desconta da conta — nunca repartido pelas frações; sem comprovativo, fica registado como dívida pendente a pagar (tal como uma fatura normal da NOWO ou da eletricidade), independente do estado desta vistoria.</p>
                    );
                  })()}

                  {/* Anexar um documento qualquer e deixar a IA identificar
                      o tipo — pedido explícito: "permitir identificar
                      documentos com IA, fatura, comprovativo de pagamento,
                      certificado etc". */}
                  <div>
                    <input ref={docIAInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ""; if (f) handleAnexarDocumentoIA(f); }} />
                    <button
                      type="button"
                      disabled={classificandoDocIA}
                      onClick={() => docIAInputRef.current?.click()}
                      className="w-full border border-dashed border-indigo-300 dark:border-indigo-800 p-2.5 rounded bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 hover:border-indigo-400 disabled:opacity-60"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>{classificandoDocIA ? "A identificar com IA..." : "Anexar Documento (a IA identifica o tipo)"}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Fatura (Opcional)</label>
                      {vistoriaEditId && vistoriaFaturaExistente && !vistoriaFaturaRemovida && !vistoriaFaturaFile && (
                        <div className="flex items-center justify-between gap-2 mb-1.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-lg px-2 py-1">
                          <a href={vistoriaFaturaExistente.url} target="_blank" rel="noopener noreferrer" className="text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold flex items-center gap-1 truncate">
                            <FileText className="h-3 w-3 shrink-0" />
                            <span className="truncate">{vistoriaFaturaExistente.nome}</span>
                          </a>
                          <button type="button" onClick={() => setVistoriaFaturaRemovida(true)} title="Remover esta fatura" aria-label="Remover esta fatura" className="text-red-600 hover:text-red-700 active:scale-90 transition-all cursor-pointer shrink-0">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      {vistoriaEditId && vistoriaFaturaRemovida && (
                        <div className="flex items-center justify-between gap-2 mb-1.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg px-2 py-1">
                          <span className="text-red-700 dark:text-red-400 text-[10px] font-semibold">Marcada para remoção.</span>
                          <button type="button" onClick={() => setVistoriaFaturaRemovida(false)} className="text-[9px] text-slate-600 hover:underline cursor-pointer shrink-0">Desfazer</button>
                        </div>
                      )}
                      <input ref={vistoriaFaturaInputRef} type="file" accept=".pdf,image/*" onChange={ev => setVistoriaFaturaFile(ev.target.files?.[0] || null)} className="hidden" />
                      <button
                        type="button"
                        onClick={() => vistoriaFaturaInputRef.current?.click()}
                        className="w-full border border-dashed p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-[11px] font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:border-emerald-400 hover:text-emerald-600"
                      >
                        <Upload className="h-4 w-4" />
                        <span>{vistoriaFaturaFile ? vistoriaFaturaFile.name : vistoriaFaturaExistente && !vistoriaFaturaRemovida ? "Substituir" : "Anexar Fatura"}</span>
                      </button>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Comprovativo de Pagamento (Opcional)</label>
                      {vistoriaEditId && vistoriaComprovativoExistente && !vistoriaComprovativoRemovido && !vistoriaComprovativoFile && (
                        <div className="flex items-center justify-between gap-2 mb-1.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-lg px-2 py-1">
                          <a href={vistoriaComprovativoExistente.url} target="_blank" rel="noopener noreferrer" className="text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold flex items-center gap-1 truncate">
                            <FileText className="h-3 w-3 shrink-0" />
                            <span className="truncate">{vistoriaComprovativoExistente.nome}</span>
                          </a>
                          <button type="button" onClick={() => setVistoriaComprovativoRemovido(true)} title="Remover este comprovativo" aria-label="Remover este comprovativo" className="text-red-600 hover:text-red-700 active:scale-90 transition-all cursor-pointer shrink-0">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      {vistoriaEditId && vistoriaComprovativoRemovido && (
                        <div className="flex items-center justify-between gap-2 mb-1.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg px-2 py-1">
                          <span className="text-red-700 dark:text-red-400 text-[10px] font-semibold">Marcado para remoção.</span>
                          <button type="button" onClick={() => setVistoriaComprovativoRemovido(false)} className="text-[9px] text-slate-600 hover:underline cursor-pointer shrink-0">Desfazer</button>
                        </div>
                      )}
                      <input ref={vistoriaComprovativoInputRef} type="file" accept=".pdf,image/*" onChange={ev => setVistoriaComprovativoFile(ev.target.files?.[0] || null)} className="hidden" />
                      <button
                        type="button"
                        onClick={() => vistoriaComprovativoInputRef.current?.click()}
                        className="w-full border border-dashed p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-[11px] font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:border-emerald-400 hover:text-emerald-600"
                      >
                        <Upload className="h-4 w-4" />
                        <span>{vistoriaComprovativoFile ? vistoriaComprovativoFile.name : vistoriaComprovativoExistente && !vistoriaComprovativoRemovido ? "Substituir" : "Anexar Comprovativo"}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Requerimento (Câmara/DGEG, Opcional)</label>
                    {vistoriaEditId && vistoriaRequerimentoExistente && !vistoriaRequerimentoRemovido && !vistoriaRequerimentoFile && (
                      <div className="flex items-center justify-between gap-2 mb-1.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-lg px-2.5 py-1.5">
                        <a href={vistoriaRequerimentoExistente.url} target="_blank" rel="noopener noreferrer" className="text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1.5 truncate">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{vistoriaRequerimentoExistente.nome}</span>
                        </a>
                        <button type="button" onClick={() => setVistoriaRequerimentoRemovido(true)} title="Remover este requerimento" aria-label="Remover este requerimento" className="text-red-600 hover:text-red-700 active:scale-90 transition-all cursor-pointer shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {vistoriaEditId && vistoriaRequerimentoRemovido && (
                      <div className="flex items-center justify-between gap-2 mb-1.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg px-2.5 py-1.5">
                        <span className="text-red-700 dark:text-red-400 text-[11px] font-semibold">Marcado para remoção ao gravar.</span>
                        <button type="button" onClick={() => setVistoriaRequerimentoRemovido(false)} className="text-[10px] text-slate-600 hover:underline cursor-pointer shrink-0">Desfazer</button>
                      </div>
                    )}
                    <input ref={vistoriaRequerimentoInputRef} type="file" accept=".pdf,image/*" onChange={ev => setVistoriaRequerimentoFile(ev.target.files?.[0] || null)} className="hidden" />
                    <button
                      type="button"
                      onClick={() => vistoriaRequerimentoInputRef.current?.click()}
                      className="w-full border border-dashed p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:border-emerald-400 hover:text-emerald-600"
                    >
                      <Upload className="h-4 w-4" />
                      <span>{vistoriaRequerimentoFile ? vistoriaRequerimentoFile.name : vistoriaRequerimentoExistente && !vistoriaRequerimentoRemovido ? "Substituir Requerimento (PDF/Foto)" : "Anexar Requerimento (PDF/Foto)"}</span>
                    </button>
                  </div>

                  {/* Fotografias da própria visita — pedido explícito:
                      "adicionar fotografias web". */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Fotografias da Vistoria (Opcional)</label>
                    <input ref={vistoriaFotoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleVistoriaFotosChange} />
                    <button
                      type="button"
                      onClick={() => vistoriaFotoInputRef.current?.click()}
                      className="w-full border border-dashed p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:border-emerald-400 hover:text-emerald-600"
                    >
                      <Camera className="h-4 w-4" />
                      <span>{vistoriaFotos.length > 0 ? `${vistoriaFotos.length} fotografia(s) anexada(s) — adicionar mais` : "Adicionar Fotografias"}</span>
                    </button>
                    {vistoriaFotos.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {vistoriaFotos.map((f, i) => (
                          <div key={i} className="relative h-14 w-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                            <img src={f} className="h-full w-full object-cover" alt="" />
                            <button
                              type="button"
                              onClick={() => setVistoriaFotos(prev => prev.filter((_, idx) => idx !== i))}
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity"
                              title="Remover fotografia"
                              aria-label="Remover fotografia"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {vistoriaEstadoRegisto === "Realizada" && (
                  <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl p-2.5 text-[10px] text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {vistoriaRows.length > 1
                        ? "A gravar, a validade de cada equipamento é atualizada e a próxima inspeção fica agendada automaticamente, consoante a periodicidade própria de cada um."
                        : <>A gravar, a validade é atualizada e a próxima inspeção fica agendada automaticamente para <strong>{formatDatePT(calcularProximaInspecao(vistoriaData, eqAlvo.frequenciaInspecao || "Anual"))}</strong> ({eqAlvo.frequenciaInspecao || "Anual"}), com alerta {eqAlvo.diasAlertaAntecedencia ?? 30} dias antes.</>}
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={aGravarVistoria}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-2 rounded-lg text-xs cursor-pointer shadow flex items-center justify-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>
                    {aGravarVistoria ? "A gravar..." : vistoriaEditId ? "Guardar Alterações" :
                      vistoriaEstadoRegisto === "Solicitada" ? "Registar Pedido" :
                      vistoriaEstadoRegisto === "Agendada" ? "Registar Agendamento" :
                      "Concluir Vistoria"}
                  </span>
                </button>
              </form>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
