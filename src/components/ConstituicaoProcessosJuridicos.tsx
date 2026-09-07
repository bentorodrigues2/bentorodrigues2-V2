import React, { useState, useRef } from "react";
import { Predio, Fracao, LoggedUser, ProcessoJuridico, ProcessoProva, TipoProvaJuridica, Documento } from "../types";
import { generateAndDownloadPdf, formatDatePT } from "../utils";

interface ConstituicaoProcessosJuridicosProps {
  predio: Predio;
  fracoes: Fracao[];
  loggedUser: LoggedUser;
  processos: ProcessoJuridico[];
  setProcessos: React.Dispatch<React.SetStateAction<ProcessoJuridico[]>>;
  onAddDocumento?: (novoDoc: any) => void;
}

export function ConstituicaoProcessosJuridicos({
  predio,
  fracoes,
  loggedUser,
  processos,
  setProcessos,
  onAddDocumento
}: ConstituicaoProcessosJuridicosProps) {
  // Selected Process
  const [selectedProcessoId, setSelectedProcessoId] = useState<string>(
    processos.find(p => p.id_predio === predio.id_predio)?.id_processo || processos[0]?.id_processo || ""
  );

  // Active Process
  const currentProcesso = processos.find(p => p.id_processo === selectedProcessoId) || processos[0];

  // Filters & State
  const [filtroTipoProva, setFiltroTipoProva] = useState<string>("TODAS");
  const [buscaProva, setBuscaProva] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [showNovoProcessoModal, setShowNovoProcessoModal] = useState<boolean>(false);
  const [showAddProvaModal, setShowAddProvaModal] = useState<boolean>(false);
  const [showAddMarcoModal, setShowAddMarcoModal] = useState<boolean>(false);
  const [lightboxProva, setLightboxProva] = useState<ProcessoProva | null>(null);

  // Form: Novo Processo
  const [novoFracaoId, setNovoFracaoId] = useState<string>(fracoes[0]?.id_fracao || "");
  const [novoTipoProcesso, setNovoTipoProcesso] = useState<ProcessoJuridico["tipo_processo"]>("FALTA_PAGAMENTO_QUOTAS");
  const [novoTitulo, setNovoTitulo] = useState<string>("");
  const [novoDescricao, setNovoDescricao] = useState<string>("");
  const [novoValorCapital, setNovoValorCapital] = useState<string>("650.00");
  const [novoTribunal, setNovoTribunal] = useState<string>("Balcão Nacional de Injunções (BNI)");
  const [novoFase, setNovoFase] = useState<ProcessoJuridico["fase_processual"]>("INJUNCAO_BNI");
  const [novoMandatario, setNovoMandatario] = useState<string>(`${loggedUser.nome} (Administrador do Condomínio)`);

  // Form: Nova Prova
  const [novaProvaTipo, setNovaProvaTipo] = useState<TipoProvaJuridica>("RECIBO_RECECAO_CARTA_AR");
  const [novaProvaTitulo, setNovaProvaTitulo] = useState<string>("");
  const [novaProvaDescricao, setNovaProvaDescricao] = useState<string>("");
  const [novaProvaDataDoc, setNovaProvaDataDoc] = useState<string>(new Date().toISOString().split("T")[0]);
  const [novaProvaCodigoCtt, setNovaProvaCodigoCtt] = useState<string>("");
  const [novaProvaDataEntrega, setNovaProvaDataEntrega] = useState<string>("");
  const [novaProvaDestinatario, setNovaProvaDestinatario] = useState<string>("");
  const [novaProvaObsJuridica, setNovaProvaObsJuridica] = useState<string>("");
  const [novaProvaFileNome, setNovaProvaFileNome] = useState<string>("");
  const [novaProvaTipoFicheiro, setNovaProvaTipoFicheiro] = useState<"imagem" | "pdf" | "documento">("imagem");
  const [novaProvaUrlPreview, setNovaProvaUrlPreview] = useState<string>("");
  const [novaProvaArquivarDigital, setNovaProvaArquivarDigital] = useState<boolean>(true);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form: Novo Marco de Tramitação
  const [novoMarcoFase, setNovoMarcoFase] = useState<string>("Notificação Concluída / Apresentação de Provas");
  const [novoMarcoDesc, setNovoMarcoDesc] = useState<string>("");
  const [novoMarcoResp, setNovoMarcoResp] = useState<string>(loggedUser.nome);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Helper when changing fraction in Novo Processo modal
  const handleFracaoChange = (fracaoId: string) => {
    setNovoFracaoId(fracaoId);
    const fr = fracoes.find(f => f.id_fracao === fracaoId);
    if (fr) {
      const propNome = fr.proprietario?.nome || "Proprietário";
      setNovoTitulo(`Ação de Execução por Falta de Pagamento de Quotas - Fração ${fr.fracao_nome} (${propNome})`);
      setNovoDescricao(`Cobrança coerciva de dívida vencida de quotas ordinárias e fundo de reserva referente à fração autónoma ${fr.fracao_nome}.`);
    }
  };

  // Handle File selection for proof
  const handleFileSelect = (file: File) => {
    setNovaProvaFileNome(file.name);
    if (file.type.startsWith("image/")) {
      setNovaProvaTipoFicheiro("imagem");
      const reader = new FileReader();
      reader.onload = (e) => {
        setNovaProvaUrlPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else if (file.type === "application/pdf") {
      setNovaProvaTipoFicheiro("pdf");
      setNovaProvaUrlPreview("");
    } else {
      setNovaProvaTipoFicheiro("documento");
      setNovaProvaUrlPreview("");
    }

    if (!novaProvaTitulo) {
      setNovaProvaTitulo(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
    }
  };

  // Preset proof templates
  const applyPresetProof = (presetType: TipoProvaJuridica) => {
    setNovaProvaTipo(presetType);
    const dest = currentProcesso ? `${currentProcesso.nome_reu} (Fração ${currentProcesso.fracao_nome})` : "Condómino Devedor";
    setNovaProvaDestinatario(dest);

    if (presetType === "RECIBO_RECECAO_CARTA_AR") {
      setNovaProvaTitulo("Aviso de Receção CTT (AR) Notificação de Quotas com Assinatura");
      setNovaProvaDescricao("Comprovativo do registo postal CTT e recibo de aviso de receção assinado presencialmente pelo réu, atestando a tomada de conhecimento da mora.");
      setNovaProvaCodigoCtt("RH849203920PT");
      setNovaProvaDataEntrega("2026-02-18");
      setNovaProvaFileNome("recibo_aviso_rececao_ctt_assinado.png");
      setNovaProvaTipoFicheiro("imagem");
      setNovaProvaUrlPreview("/documentos/08-aviso-de-rececao.png");
      setNovaProvaObsJuridica("Prova plena da interpelação admonitória para efeitos do art. 805.º n.º 1 do Código Civil.");
    } else if (presetType === "PRINT_CONVERSA_WHATSAPP") {
      setNovaProvaTitulo("Print de Conversa WhatsApp com Confissão de Dívida e Recusa de Pagamento");
      setNovaProvaDescricao("Captura de ecrã certificada de troca de mensagens via WhatsApp com o número oficial do condómino réu onde assume os valores e adia o cumprimento.");
      setNovaProvaFileNome("print_conversa_whatsapp_divida_fracao.png");
      setNovaProvaTipoFicheiro("imagem");
      setNovaProvaUrlPreview("/documentos/16-print-conversa-whatsapp.png");
      setNovaProvaObsJuridica("Documento eletrónico nos termos do art. 368.º do Código Civil, corroborando a recusa ilegítima.");
    } else if (presetType === "PRINT_EMAIL_COMUNICACAO") {
      setNovaProvaTitulo("Print de E-mail de Notificação de Saldo Devedor com Confirmação de Leitura");
      setNovaProvaDescricao("Cópia e print do correio eletrónico enviado pela Administração para o endereço registado do condómino com recibo de entrega.");
      setNovaProvaFileNome("print_email_notificacao_saldo_devedor.png");
      setNovaProvaTipoFicheiro("imagem");
      setNovaProvaUrlPreview("/documentos/08-aviso-de-rececao.png");
      setNovaProvaObsJuridica("Comunicação formal enviada em cumprimento do Art. 1432.º do Código Civil.");
    } else if (presetType === "FOTOGRAFIA_DANO_INFRACAO") {
      setNovaProvaTitulo("Relatório Fotográfico de Danos / Obras não Autorizadas");
      setNovaProvaDescricao("Fotografia de alta resolução comprovando as alterações na fachada ou danos causados em partes comuns do edifício.");
      setNovaProvaFileNome("relatorio_fotografico_danos_partes_comuns.png");
      setNovaProvaTipoFicheiro("imagem");
      setNovaProvaUrlPreview("/documentos/17-fotografia-dano-fachada.png");
      setNovaProvaObsJuridica("Peritagem visual e registo da infração ao regulamento de condomínio.");
    } else if (presetType === "ATA_ASSEMBLEIA_TITULO_EXECUTIVO") {
      setNovaProvaTitulo("Ata da Assembleia de Condóminos n.º 24 com Força Executiva (Art. 6.º DL 268/94)");
      setNovaProvaDescricao("Extrato da ata da reunião magna onde foi aprovado o orçamento, quotas e liquidado o montante em dívida, constituindo título executivo.");
      setNovaProvaFileNome("ata_24_titulo_executivo_aprovacao_quotas.pdf");
      setNovaProvaTipoFicheiro("pdf");
      setNovaProvaObsJuridica("Título executivo extrajudicial bastante para instauração imediata de Ação Executiva.");
    } else if (presetType === "EXTRATO_CONTA_CORRENTE_DIVIDA") {
      setNovaProvaTitulo("Extrato de Conta-Corrente Atualizado com Juros de Mora Calculados a 4.00%");
      setNovaProvaDescricao("Demonstração detalhada mês a mês das quotas vencidas, débitos de conservação e juros de mora legais.");
      setNovaProvaFileNome("extrato_conta_corrente_discriminado_divida.pdf");
      setNovaProvaTipoFicheiro("pdf");
      setNovaProvaObsJuridica("Liquidação aritmética da dívida nos termos do art. 716.º do Código de Processo Civil.");
    }
  };

  // Submit: Criar Novo Processo
  const handleCriarProcessoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fr = fracoes.find(f => f.id_fracao === novoFracaoId);
    if (!fr) {
      showToast("Selecione uma fração válida.");
      return;
    }

    const capital = parseFloat(novoValorCapital) || 0;
    const juros = Number((capital * 0.04 * (8 / 12)).toFixed(2)); // ~8 meses a 4%
    const custas = 76.50; // Taxa de justiça média
    const total = capital + juros + custas;

    const novoId = `PROC-${new Date().getFullYear()}/${String(processos.length + 1).padStart(3, "0")}-JUR`;

    const novoProcesso: ProcessoJuridico = {
      id_processo: novoId,
      id_predio: predio.id_predio,
      id_fracao: fr.id_fracao,
      fracao_nome: fr.fracao_nome,
      nome_reu: fr.proprietario?.nome || "Proprietário",
      nif_reu: fr.proprietario?.nif || "299887766",
      tipo_processo: novoTipoProcesso,
      titulo_processo: novoTitulo || `Processo de Contencioso - Fração ${fr.fracao_nome}`,
      descricao_resumo: novoDescricao || `Cobrança coerciva de valores em dívida da fração ${fr.fracao_nome}.`,
      valor_divida_capital: capital,
      valor_juros_mora: juros,
      taxa_juros: 4.0,
      custas_processuais_estimadas: custas,
      valor_total_pedido: total,
      tribunal_competente: novoTribunal,
      fase_processual: novoFase,
      data_abertura: new Date().toISOString().split("T")[0],
      data_ultima_atualizacao: new Date().toISOString().split("T")[0],
      mandatario_responsavel: novoMandatario,
      pasta_arquivo_digital_nome: `⚖️ Processos Jurídicos & Contencioso / ${novoId} (${fr.fracao_nome})`,
      historico_tramitacao: [
        {
          id_fase: `tram-${Date.now()}-1`,
          data_hora: new Date().toISOString().replace("T", " ").substring(0, 16),
          fase: "Abertura dos Autos & Deliberação da Administração",
          descricao: `Processo aberto pela Administração do Condomínio. Registado valor global de ${total.toFixed(2)} € (Capital: ${capital.toFixed(2)} €).`,
          responsavel: loggedUser.nome
        }
      ],
      provas: []
    };

    setProcessos(prev => [novoProcesso, ...prev]);
    setSelectedProcessoId(novoId);
    setShowNovoProcessoModal(false);
    showToast(`Processo ${novoId} constituído com sucesso! Pode agora juntar recibos, prints e provas.`);
  };

  // Submit: Adicionar Prova
  const handleAdicionarProvaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProcesso) return;
    if (!novaProvaTitulo) {
      showToast("Indique o título do documento comprovativo.");
      return;
    }

    const novaProva: ProcessoProva = {
      id_prova: `prv-${Date.now()}`,
      id_processo: currentProcesso.id_processo,
      tipo: novaProvaTipo,
      titulo: novaProvaTitulo,
      descricao: novaProvaDescricao,
      data_documento: novaProvaDataDoc,
      data_adicao: new Date().toISOString().split("T")[0],
      numero_documento_ordem: currentProcesso.provas.length + 1,
      ficheiro_nome: novaProvaFileNome || `${novaProvaTipo.toLowerCase()}_${Date.now()}.png`,
      tamanho: "245 KB",
      tipo_ficheiro: novaProvaTipoFicheiro,
      url_preview: novaProvaUrlPreview || (novaProvaTipoFicheiro === "imagem" ? "/documentos/16-print-conversa-whatsapp.png" : undefined),
      codigo_rastreio_ctt: novaProvaCodigoCtt || undefined,
      data_entrega_ctt: novaProvaDataEntrega || undefined,
      destinatario: novaProvaDestinatario || undefined,
      observacoes_juridicas: novaProvaObsJuridica || undefined,
      arquivado_no_arquivo_digital: novaProvaArquivarDigital
    };

    // Update in Process
    const updatedProcessos = processos.map(p => {
      if (p.id_processo === currentProcesso.id_processo) {
        return {
          ...p,
          provas: [...p.provas, novaProva],
          data_ultima_atualizacao: new Date().toISOString().split("T")[0],
          historico_tramitacao: [
            ...p.historico_tramitacao,
            {
              id_fase: `tram-${Date.now()}`,
              data_hora: new Date().toISOString().replace("T", " ").substring(0, 16),
              fase: `Junção de Prova: Doc. ${novaProva.numero_documento_ordem}`,
              descricao: `Junta aos autos prova documental: "${novaProva.titulo}". ${novaProva.codigo_rastreio_ctt ? `Registo CTT: ${novaProva.codigo_rastreio_ctt}` : ""}`,
              responsavel: loggedUser.nome
            }
          ]
        };
      }
      return p;
    });

    setProcessos(updatedProcessos);

    // If sync with Digital Archive is enabled, push document to GestaoDocumentos
    if (novaProvaArquivarDigital && onAddDocumento) {
      const docParaArquivo: Partial<Documento> = {
        id_doc: `doc-jur-${Date.now()}`,
        id_predio: predio.id_predio,
        nome: `[Doc. ${novaProva.numero_documento_ordem}] ${novaProva.titulo} - Proc. ${currentProcesso.id_processo}`,
        tipo: novaProva.tipo_ficheiro === "imagem" ? "Fotografia" : "Comprovativo Judicial",
        data_upload: new Date().toISOString().split("T")[0],
        tamanho: "245 KB",
        categoria: "Processos Judiciais & Contencioso",
        tema: "Contencioso e Ações Judiciais",
        sub_pasta: "⚖️ Processos Jurídicos & Contencioso",
        descricao: `${novaProva.descricao || ""} • Réu: ${currentProcesso.nome_reu} (Fração ${currentProcesso.fracao_nome}) • Tribunal: ${currentProcesso.tribunal_competente}`,
        visibilidade: "Administração",
        arquivado: true,
        data_arquivamento: new Date().toISOString().split("T")[0],
        tipo_arquivo: novaProva.tipo_ficheiro === "imagem" ? "fotografia" : "documento",
        url_foto: novaProva.url_preview || "/documentos/16-print-conversa-whatsapp.png",
        fornecedor: currentProcesso.tribunal_competente,
        ano: new Date().getFullYear().toString(),
        relevancia_perfis: ["ADMIN", "JURIDICO"]
      };
      onAddDocumento(docParaArquivo);
    }

    setShowAddProvaModal(false);
    // Reset form
    setNovaProvaTitulo("");
    setNovaProvaDescricao("");
    setNovaProvaCodigoCtt("");
    setNovaProvaDataEntrega("");
    setNovaProvaFileNome("");
    setNovaProvaUrlPreview("");
    showToast(`Doc. ${novaProva.numero_documento_ordem} adicionado ao processo e arquivado na pasta de Contencioso.`);
  };

  // Remove Proof
  const handleRemoverProva = (idProva: string) => {
    if (!currentProcesso) return;
    if (!confirm("Tem a certeza que deseja retirar esta prova do dossiê do processo?")) return;

    const updatedProcessos = processos.map(p => {
      if (p.id_processo === currentProcesso.id_processo) {
        const filtered = p.provas.filter(pr => pr.id_prova !== idProva);
        // Renumber orders
        const renumbered = filtered.map((pr, idx) => ({
          ...pr,
          numero_documento_ordem: idx + 1
        }));
        return {
          ...p,
          provas: renumbered,
          data_ultima_atualizacao: new Date().toISOString().split("T")[0]
        };
      }
      return p;
    });

    setProcessos(updatedProcessos);
    showToast("Prova removida dos autos com sucesso.");
  };

  // Submit: Novo Marco de Tramitação
  const handleAdicionarMarcoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProcesso || !novoMarcoDesc) {
      showToast("Preencha a descrição do evento de tramitação.");
      return;
    }

    const updatedProcessos = processos.map(p => {
      if (p.id_processo === currentProcesso.id_processo) {
        return {
          ...p,
          data_ultima_atualizacao: new Date().toISOString().split("T")[0],
          historico_tramitacao: [
            ...p.historico_tramitacao,
            {
              id_fase: `tram-${Date.now()}`,
              data_hora: new Date().toISOString().replace("T", " ").substring(0, 16),
              fase: novoMarcoFase,
              descricao: novoMarcoDesc,
              responsavel: novoMarcoResp || loggedUser.nome
            }
          ]
        };
      }
      return p;
    });

    setProcessos(updatedProcessos);
    setShowAddMarcoModal(false);
    setNovoMarcoDesc("");
    showToast("Marco processual registado na cronologia do processo.");
  };

  // Generate Court Dossier PDF
  const handleGerarDossiePdf = () => {
    if (!currentProcesso) return;

    const sections = [
      {
        heading: "1. IDENTIFICAÇÃO DOS AUTOS & TRIBUNAL COMPETENTE",
        content: [
          `PROCESSO N.º: ${currentProcesso.id_processo}`,
          `TRIBUNAL / INSTÂNCIA: ${currentProcesso.tribunal_competente}`,
          `FASE PROCESSUAL: ${currentProcesso.fase_processual.replace(/_/g, " ")}`,
          `DATA DE ABERTURA: ${formatDatePT(currentProcesso.data_abertura)} | ÚLTIMA ATUALIZAÇÃO: ${formatDatePT(currentProcesso.data_ultima_atualizacao)}`,
          "",
          `REQUERENTE (EXEQUENTE): CONDOMÍNIO DO EDIFÍCIO ${(predio?.nome || "Condomínio").toUpperCase()}`,
          `NIF COLETIVO: ${predio?.nif || "999888777"} | SEDE: ${predio?.morada_linha1 || ""}, ${predio?.codigo_postal || ""} ${predio?.localidade || ""}`,
          `MANDATÁRIO / REPRESENTANTE: ${currentProcesso.mandatario_responsavel}`,
          "",
          `REQUERIDO (EXECUTADO): ${currentProcesso.nome_reu.toUpperCase()}`,
          `NIF: ${currentProcesso.nif_reu} | FRAÇÃO AUTÓNOMA: ${currentProcesso.fracao_nome}`,
          `TIPO DE LITÍGIO: ${currentProcesso.tipo_processo.replace(/_/g, " ")}`
        ]
      },
      {
        heading: "2. CAUSA DE PEDIR & RESUMO FÁCTICO DA INFRAÇÃO / DÍVIDA",
        content: [
          currentProcesso.descricao_resumo,
          "",
          "O Requerido, enquanto proprietário e condómino da identificada fração autónoma, incumpriu as suas obrigações legais e regulamentares decorrentes da propriedade horizontal (Artigos 1424.º e 1432.º do Código Civil e Decreto-Lei n.º 268/94).",
          "Foram efetuadas diligências amigáveis, interpelações formais e notificações por carta registada com aviso de receção, mantendo-se a mora injustificada."
        ]
      },
      {
        heading: "3. QUADRO LIQUIDADO DE QUANTIAS RECLAMADAS (CAPITAL, JUROS E CUSTAS)",
        content: [
          `• Dívida de Capital Vencido (Quotas / Reparações): ${currentProcesso.valor_divida_capital.toFixed(2)} €`,
          `• Juros de Mora Legais Vencidos (Taxa Comercial/Civil de ${currentProcesso.taxa_juros.toFixed(2)}% ao ano): ${currentProcesso.valor_juros_mora.toFixed(2)} €`,
          `• Custas Processuais & Despesas de Cobrança Estimadas: ${currentProcesso.custas_processuais_estimadas.toFixed(2)} €`,
          "------------------------------------------------------------------------------------------------------",
          `VALOR TOTAL DO PEDIDO LIQUIDADO: ${currentProcesso.valor_total_pedido.toFixed(2)} € (Por extenso: ${currentProcesso.valor_total_pedido.toFixed(2)} Euros)`
        ]
      },
      {
        heading: "4. ROL & ÍNDICE DISCRIMINADO DE DOCUMENTOS PROBATÓRIOS JUNTOS",
        content: currentProcesso.provas.length > 0 
          ? currentProcesso.provas.map(pr => 
              `[DOC. ${pr.numero_documento_ordem}] ${pr.titulo}\n` +
              `   • Tipo: ${pr.tipo.replace(/_/g, " ")} | Data: ${formatDatePT(pr.data_documento)}\n` +
              `   • Ficheiro: ${pr.ficheiro_nome} (${pr.tamanho})\n` +
              (pr.codigo_rastreio_ctt ? `   • Registo CTT / AR: ${pr.codigo_rastreio_ctt} (Entregue a: ${pr.data_entrega_ctt || "Conforme aviso"})\n` : "") +
              (pr.observacoes_juridicas ? `   • Valor Probatório: ${pr.observacoes_juridicas}\n` : "") +
              `   • Descrição dos factos: ${pr.descricao || "Comprovativo fáctico dos autos."}`
            )
          : ["Não foram ainda indexados documentos comprovativos adicionais."]
      },
      {
        heading: "5. HISTÓRICO CRONOLÓGICO DE TRAMITAÇÃO",
        content: currentProcesso.historico_tramitacao.map(h => 
          `[${h.data_hora}] ${h.fase.toUpperCase()}: ${h.descricao} (Resp: ${h.responsavel})`
        )
      },
      {
        heading: "6. DECLARAÇÃO DE CONFORMIDADE E ASSINATURA DA ADMINISTRAÇÃO",
        content: [
          "A Administração do Condomínio declara, sob compromisso de honra e para os devidos efeitos legais junto das instâncias judiciais competentes, que os documentos probatórios constantes do presente dossiê correspondem fielmente aos originais arquivados no acervo documental do edifício.",
          "",
          `Documento emitido em ${formatDatePT(new Date().toISOString())} através da plataforma oficial CondoManager AI.`,
          "",
          "P'la Administração do Condomínio,",
          `Assinatura: __________________________________________________`,
          `${loggedUser.nome} (Cartão de Cidadão / Representante Legal)`
        ]
      }
    ];

    generateAndDownloadPdf(
      `DOSSIÊ INSTRUTÓRIO JUDICIAL • PROCESSO ${currentProcesso.id_processo}`,
      sections,
      `Dossie_Judicial_${currentProcesso.id_processo.replace(/[/\\?%*:|"<>]/g, "_")}.pdf`,
      [
        { label: "Prédio", value: predio.nome },
        { label: "Fração / Réu", value: `${currentProcesso.fracao_nome} - ${currentProcesso.nome_reu}` },
        { label: "Tribunal", value: currentProcesso.tribunal_competente },
        { label: "Total Reclamado", value: `${currentProcesso.valor_total_pedido.toFixed(2)} €` }
      ]
    );

    showToast("Dossiê judicial completo em PDF gerado e pronto para apresentação em tribunal!");
  };

  // Helper icons and colors for proof types
  const getProofBadge = (tipo: TipoProvaJuridica) => {
    switch (tipo) {
      case "RECIBO_RECECAO_CARTA_AR":
        return {
          icon: "fa-envelope-circle-check",
          label: "Recibo de Receção AR CTT",
          color: "bg-amber-500/20 text-amber-300 border-amber-500/40"
        };
      case "PRINT_CONVERSA_WHATSAPP":
        return {
          icon: "fa-comments",
          label: "Print Conversa WhatsApp",
          color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
        };
      case "PRINT_EMAIL_COMUNICACAO":
        return {
          icon: "fa-at",
          label: "Print E-mail Notificação",
          color: "bg-blue-500/20 text-blue-300 border-blue-500/40"
        };
      case "FOTOGRAFIA_DANO_INFRACAO":
        return {
          icon: "fa-camera",
          label: "Fotografia de Danos / Obras",
          color: "bg-rose-500/20 text-rose-300 border-rose-500/40"
        };
      case "ATA_ASSEMBLEIA_TITULO_EXECUTIVO":
        return {
          icon: "fa-file-shield",
          label: "Ata Título Executivo",
          color: "bg-purple-500/20 text-purple-300 border-purple-500/40"
        };
      case "EXTRATO_CONTA_CORRENTE_DIVIDA":
        return {
          icon: "fa-calculator",
          label: "Extrato Conta-Corrente & Juros",
          color: "bg-teal-500/20 text-teal-300 border-teal-500/40"
        };
      default:
        return {
          icon: "fa-paperclip",
          label: "Comprovativo Judicial",
          color: "bg-slate-500/20 text-slate-300 border-slate-500/40"
        };
    }
  };

  // Filtered proofs of current process
  const filteredProvas = (currentProcesso?.provas || []).filter(pr => {
    const matchTipo = filtroTipoProva === "TODAS" || pr.tipo === filtroTipoProva;
    const matchBusca = !buscaProva || 
      pr.titulo.toLowerCase().includes(buscaProva.toLowerCase()) ||
      (pr.descricao && pr.descricao.toLowerCase().includes(buscaProva.toLowerCase())) ||
      (pr.codigo_rastreio_ctt && pr.codigo_rastreio_ctt.toLowerCase().includes(buscaProva.toLowerCase()));
    return matchTipo && matchBusca;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-5 py-3 rounded-xl shadow-2xl border border-emerald-500 text-xs font-bold flex items-center gap-3 animate-fade-in">
          <i className="fa-solid fa-circle-check text-emerald-300 text-base"></i>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner with KPIs and Actions */}
      <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-5 shadow-xl text-white">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold">
                MÓDULO JURÍDICO OFICIAL
              </span>
              <span className="text-xs text-slate-400 font-bold">Código Civil & DL 268/94</span>
            </div>
            <h3 className="text-lg font-bold text-white mt-1 flex items-center gap-2">
              <i className="fa-solid fa-gavel text-emerald-400"></i>
              Constituição de Processos Judiciais & Acervo Probatório
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Estruture processos por falta de pagamento de quotas ou infrações ao regulamento. Reúna e indexe de forma juridicamente admissível recibos de cartas AR CTT, capturas de ecrã (WhatsApp/e-mails), relatórios fotográficos de danos e atas com força executiva para entrega em tribunal ou Balcão Nacional de Injunções.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setShowNovoProcessoModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer border border-emerald-400"
            >
              <i className="fa-solid fa-plus-circle"></i>
              <span>Iniciar Novo Processo</span>
            </button>
            <button
              onClick={handleGerarDossiePdf}
              disabled={!currentProcesso}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <i className="fa-solid fa-file-pdf"></i>
              <span>Descarregar Dossiê Judicial (PDF)</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Processos Ativos</span>
            <span className="text-xl font-bold text-white font-mono">{processos.length}</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">Em contencioso judicial</span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Reclamado em Juízo</span>
            <span className="text-xl font-bold text-rose-400 font-mono">
              {processos.reduce((acc, p) => acc + p.valor_total_pedido, 0).toFixed(2)} €
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Capital + Juros 4% + Custas</span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Provas & Anexos Juntos</span>
            <span className="text-xl font-bold text-amber-300 font-mono">
              {processos.reduce((acc, p) => acc + p.provas.length, 0)} Docs
            </span>
            <span className="text-[10px] text-amber-400/90 block mt-0.5">Recibos AR, Prints e Fotos</span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Sincronização com Arquivo</span>
            <span className="text-xl font-bold text-emerald-300 font-mono">100% Ativa</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Pasta ⚖️ Processos Jurídicos</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Master (Processes list) + Detail (Active Process & Evidence Dossier) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Process List (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-folder-tree text-emerald-500"></i>
                Dossiês Judiciais ({processos.length})
              </h4>
              <button
                onClick={() => setShowNovoProcessoModal(true)}
                className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <i className="fa-solid fa-plus"></i> Novo
              </button>
            </div>

            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {processos.map(proc => {
                const isSelected = proc.id_processo === selectedProcessoId;
                return (
                  <div
                    key={proc.id_processo}
                    onClick={() => setSelectedProcessoId(proc.id_processo)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                      isSelected
                        ? "bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-500 shadow-sm ring-1 ring-emerald-500/50"
                        : "bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                        {proc.id_processo}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        {proc.valor_total_pedido.toFixed(2)} €
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <h5 className="text-xs font-bold text-slate-800 dark:text-white line-clamp-1">
                        Fração {proc.fracao_nome} • {proc.nome_reu}
                      </h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {proc.titulo_processo}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      <span className="flex items-center gap-1 font-medium">
                        <i className="fa-solid fa-paperclip text-emerald-500"></i>
                        {proc.provas.length} prova{proc.provas.length !== 1 ? "s" : ""}
                      </span>
                      <span className="text-emerald-500 font-bold">
                        {proc.tribunal_competente.includes("BNI") ? "Injunção BNI" : "Julgado de Paz"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Help Card */}
          <div className="bg-emerald-950/60 border border-emerald-700/50 rounded-2xl p-4 text-emerald-200 space-y-2">
            <h5 className="text-xs font-bold flex items-center gap-2 text-emerald-300">
              <i className="fa-solid fa-scale-balanced"></i>
              Requisitos Probatórios em Tribunal
            </h5>
            <p className="text-[11px] leading-relaxed text-emerald-200/90">
              Para obtenção de título executivo célere ou injunção transitada em julgado, certifique-se de anexar:
            </p>
            <ul className="text-[10px] space-y-1 text-emerald-300 list-disc list-inside">
              <li>Recibo de aviso de receção (AR) assinado ou objeto devolvido</li>
              <li>Ata da assembleia que fixou as quotas e aprovou a cobrança</li>
              <li>Demonstração aritmética discriminada com juros de mora</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Active Process Dossier & Evidence Workspace (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {currentProcesso ? (
            <>
              {/* Process Header & Metadata Details */}
              <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                        {currentProcesso.id_processo}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {currentProcesso.fase_processual.replace(/_/g, " ")}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-white mt-1.5">
                      {currentProcesso.titulo_processo}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAddProvaModal(true)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer border border-emerald-400"
                    >
                      <i className="fa-solid fa-file-circle-plus"></i>
                      <span>Adicionar Prova / Documento</span>
                    </button>
                    <button
                      onClick={() => setShowAddMarcoModal(true)}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-300 dark:border-slate-700"
                    >
                      <i className="fa-solid fa-clock-rotate-left"></i>
                      <span>Marco</span>
                    </button>
                  </div>
                </div>

                {/* Case Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Réu / Executado</span>
                    <span className="font-bold text-slate-800 dark:text-white block mt-0.5">{currentProcesso.nome_reu}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                      Fração {currentProcesso.fracao_nome} • NIF: {currentProcesso.nif_reu}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Tribunal & Mandatário</span>
                    <span className="font-bold text-slate-800 dark:text-white block mt-0.5">{currentProcesso.tribunal_competente}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block line-clamp-1">
                      Resp: {currentProcesso.mandatario_responsavel}
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold block">Valor Total do Pedido</span>
                    <span className="text-base font-bold text-slate-900 dark:text-white font-mono block mt-0.5">
                      {currentProcesso.valor_total_pedido.toFixed(2)} €
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                      Cap: {currentProcesso.valor_divida_capital.toFixed(2)} € | Jur: {currentProcesso.valor_juros_mora.toFixed(2)} €
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <strong className="text-slate-800 dark:text-white">Resumo dos Factos: </strong>
                  {currentProcesso.descricao_resumo}
                </div>
              </div>

              {/* SECTION: ACERVO PROBATÓRIO (PROOFS LIST) */}
              <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <i className="fa-solid fa-folder-open text-amber-500"></i>
                      Documentos Probatórios Juntos aos Autos ({currentProcesso.provas.length})
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Recibos de receção de cartas CTT, prints de comunicações, atas e fotografias indexadas para tribunal.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowAddProvaModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <i className="fa-solid fa-plus"></i> Juntar Prova
                  </button>
                </div>

                {/* Filter and Search Bar for Proofs */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                    {[
                      { id: "TODAS", label: "Todas" },
                      { id: "RECIBO_RECECAO_CARTA_AR", label: "Recibos AR CTT" },
                      { id: "PRINT_CONVERSA_WHATSAPP", label: "Prints WhatsApp" },
                      { id: "PRINT_EMAIL_COMUNICACAO", label: "Prints E-mail" },
                      { id: "FOTOGRAFIA_DANO_INFRACAO", label: "Fotografias" },
                      { id: "ATA_ASSEMBLEIA_TITULO_EXECUTIVO", label: "Atas" }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setFiltroTipoProva(f.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                          filtroTipoProva === f.id
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-48">
                    <input
                      type="text"
                      value={buscaProva}
                      onChange={(e) => setBuscaProva(e.target.value)}
                      placeholder="Pesquisar prova..."
                      className="w-full pl-7 pr-3 py-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                    />
                    <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-2 text-[10px] text-slate-400"></i>
                  </div>
                </div>

                {/* Proofs List */}
                {filteredProvas.length > 0 ? (
                  <div className="space-y-3">
                    {filteredProvas.map(prova => {
                      const badge = getProofBadge(prova.tipo);
                      return (
                        <div
                          key={prova.id_prova}
                          className="bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                        >
                          <div className="flex items-start gap-3.5">
                            {/* Preview Thumbnail or Icon */}
                            {prova.url_preview && prova.tipo_ficheiro === "imagem" ? (
                              <div 
                                onClick={() => setLightboxProva(prova)}
                                className="w-14 h-14 rounded-lg bg-slate-950 border border-slate-700 overflow-hidden shrink-0 cursor-pointer group relative shadow-xs"
                              >
                                <img 
                                  src={prova.url_preview} 
                                  alt={prova.titulo} 
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs">
                                  <i className="fa-solid fa-magnifying-glass-plus"></i>
                                </div>
                              </div>
                            ) : (
                              <div className="w-14 h-14 rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400">
                                <i className={`fa-solid ${badge.icon} text-xl`}></i>
                              </div>
                            )}

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">
                                  Doc. {prova.numero_documento_ordem}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.color}`}>
                                  <i className={`fa-solid ${badge.icon} mr-1`}></i>
                                  {badge.label}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {formatDatePT(prova.data_documento)}
                                </span>
                              </div>

                              <h5 className="text-xs font-bold text-slate-800 dark:text-white">
                                {prova.titulo}
                              </h5>

                              {prova.descricao && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
                                  {prova.descricao}
                                </p>
                              )}

                              {/* Special Meta: CTT Tracking or Observations */}
                              <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 pt-0.5 flex-wrap">
                                {prova.codigo_rastreio_ctt && (
                                  <span className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                                    <i className="fa-solid fa-truck-fast"></i>
                                    CTT AR: {prova.codigo_rastreio_ctt}
                                    {prova.data_entrega_ctt && ` (Entregue em ${formatDatePT(prova.data_entrega_ctt)})`}
                                  </span>
                                )}
                                <span className="font-mono">{prova.ficheiro_nome} ({prova.tamanho})</span>
                                {prova.arquivado_no_arquivo_digital && (
                                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <i className="fa-solid fa-circle-check"></i> No Arquivo Digital
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            {prova.url_preview && (
                              <button
                                onClick={() => setLightboxProva(prova)}
                                className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-xs cursor-pointer"
                                title="Visualizar Prova / Fotografia"
                              >
                                <i className="fa-solid fa-eye"></i>
                              </button>
                            )}
                            <button
                              onClick={() => {
                                showToast(`A descarregar cópia autêntica de "${prova.titulo}"...`);
                              }}
                              className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-xs cursor-pointer"
                              title="Descarregar Ficheiro"
                            >
                              <i className="fa-solid fa-download"></i>
                            </button>
                            <button
                              onClick={() => handleRemoverProva(prova.id_prova)}
                              className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors text-xs cursor-pointer"
                              title="Retirar dos Autos"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                      <i className="fa-solid fa-file-circle-question text-xl"></i>
                    </div>
                    <div className="space-y-1">
                      <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">Nenhum Documento Probatório Encontrado</h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                        Junte recibos de receção de cartas registadas CTT, capturas de ecrã ou fotografias ao processo para constituir a prova judicial.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddProvaModal(true)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer shadow-xs"
                    >
                      <i className="fa-solid fa-plus-circle"></i>
                      <span>Adicionar Primeira Prova</span>
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION: HISTÓRICO & TRAMITAÇÃO CRONOLÓGICA */}
              <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <i className="fa-solid fa-timeline text-emerald-500"></i>
                    Histórico de Tramitação Processual & Diligências
                  </h4>
                  <button
                    onClick={() => setShowAddMarcoModal(true)}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <i className="fa-solid fa-plus"></i> Registar Diligência
                  </button>
                </div>

                <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800 pl-8">
                  {currentProcesso.historico_tramitacao.map(item => (
                    <div key={item.id_fase} className="relative group">
                      <div className="absolute -left-8 top-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-slate-900"></div>
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-white">{item.fase}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{item.data_hora}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">{item.descricao}</p>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">
                          Responsável: {item.responsavel}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 min-h-[400px]">
              <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <i className="fa-solid fa-folder-plus text-2xl text-emerald-500"></i>
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">Nenhum Processo Selecionado</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Selecione um processo na lista lateral ou crie um novo para gerir o dossiê e os elementos de prova.
                </p>
              </div>
              <button
                onClick={() => setShowNovoProcessoModal(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-plus-circle"></i>
                <span>Iniciar Novo Processo Judicial</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADICIONAR PROVA / DOCUMENTO COMPROVATIVO COM VERTICAL DROP ZONE   */}
      {/* ========================================================================= */}
      {showAddProvaModal && currentProcesso && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-900 text-white">
              <div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider block">
                  Constituição Probatória • Proc. {currentProcesso.id_processo}
                </span>
                <h3 className="text-base font-bold flex items-center gap-2 mt-0.5">
                  <i className="fa-solid fa-file-circle-plus text-emerald-400"></i>
                  Juntar Prova / Documento Comprovativo aos Autos
                </h3>
              </div>
              <button
                onClick={() => setShowAddProvaModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAdicionarProvaSubmit} className="p-6 overflow-y-auto space-y-5">
              
              {/* Presets Quick Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  1. Selecione o Tipo de Prova ou Modelo Pré-Configurado:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { type: "RECIBO_RECECAO_CARTA_AR" as TipoProvaJuridica, label: "✉️ Recibo AR CTT", icon: "fa-envelope-circle-check" },
                    { type: "PRINT_CONVERSA_WHATSAPP" as TipoProvaJuridica, label: "💬 Print WhatsApp", icon: "fa-comments" },
                    { type: "PRINT_EMAIL_COMUNICACAO" as TipoProvaJuridica, label: "📧 Print E-mail", icon: "fa-at" },
                    { type: "FOTOGRAFIA_DANO_INFRACAO" as TipoProvaJuridica, label: "📸 Fotografia Danos", icon: "fa-camera" },
                    { type: "ATA_ASSEMBLEIA_TITULO_EXECUTIVO" as TipoProvaJuridica, label: "📜 Ata Executiva", icon: "fa-file-shield" },
                    { type: "EXTRATO_CONTA_CORRENTE_DIVIDA" as TipoProvaJuridica, label: "📊 Extrato Juros", icon: "fa-calculator" }
                  ].map(preset => (
                    <button
                      key={preset.type}
                      type="button"
                      onClick={() => applyPresetProof(preset.type)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                        novaProvaTipo === preset.type
                          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500 ring-2 ring-emerald-500/40"
                          : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <i className={`fa-solid ${preset.icon} text-emerald-500`}></i>
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title and Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Título da Prova (para Rol de Documentos em Tribunal) *
                  </label>
                  <input
                    type="text"
                    required
                    value={novaProvaTitulo}
                    onChange={(e) => setNovaProvaTitulo(e.target.value)}
                    placeholder="Ex: Recibo de Aviso de Receção CTT assinado com notificação de mora"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Data do Documento / Facto
                  </label>
                  <input
                    type="date"
                    value={novaProvaDataDoc}
                    onChange={(e) => setNovaProvaDataDoc(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Destinatário / Notificado
                  </label>
                  <input
                    type="text"
                    value={novaProvaDestinatario}
                    onChange={(e) => setNovaProvaDestinatario(e.target.value)}
                    placeholder={`Ex: ${currentProcesso.nome_reu} (Fração ${currentProcesso.fracao_nome})`}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Optional CTT Tracking Fields */}
              {novaProvaTipo === "RECIBO_RECECAO_CARTA_AR" && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-xl space-y-3">
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <i className="fa-solid fa-truck-fast"></i>
                    Dados do Registo Postal CTT (Aviso de Receção)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                        Código de Rastreio CTT (Ex: RH849203920PT)
                      </label>
                      <input
                        type="text"
                        value={novaProvaCodigoCtt}
                        onChange={(e) => setNovaProvaCodigoCtt(e.target.value)}
                        placeholder="Ex: RH849203920PT"
                        className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg font-mono text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                        Data Efetiva de Entrega / Assinatura
                      </label>
                      <input
                        type="date"
                        value={novaProvaDataEntrega}
                        onChange={(e) => setNovaProvaDataEntrega(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Vertical Sheet Upload / Drag Zone */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Ficheiro da Prova / Imagem / Print (Folha Vertical A4)</span>
                  <span className="text-[10px] text-slate-400">Formatos aceites: PNG, JPG, PDF, WEBP</span>
                </label>

                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingFile(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[170px] ${
                    isDraggingFile
                      ? "border-emerald-500 bg-emerald-500/10 scale-[1.01]"
                      : "border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                  />

                  {novaProvaUrlPreview && novaProvaTipoFicheiro === "imagem" ? (
                    <div className="flex items-center gap-4 text-left">
                      <div className="w-16 h-20 bg-slate-950 rounded-lg overflow-hidden border border-emerald-500 shrink-0 shadow-md">
                        <img src={novaProvaUrlPreview} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <i className="fa-solid fa-circle-check"></i> Ficheiro Selecionado
                        </span>
                        <p className="text-xs font-bold text-slate-800 dark:text-white">{novaProvaFileNome}</p>
                        <p className="text-[10px] text-slate-500">Clique para substituir o ficheiro</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                        <i className="fa-solid fa-cloud-arrow-up text-xl"></i>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Arraste o documento aqui ou clique para procurar no computador
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Ex: Fotografia do aviso CTT, captura de ecrã do WhatsApp ou PDF da ata
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Facts description & Legal value */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Descrição dos Factos Demonstrados por este Documento
                  </label>
                  <textarea
                    rows={2}
                    value={novaProvaDescricao}
                    onChange={(e) => setNovaProvaDescricao(e.target.value)}
                    placeholder="Descreva detalhadamente o que este documento comprova para apreciação do tribunal..."
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Relevância Jurídica & Artigo de Lei Aplicável (Opcional)
                  </label>
                  <input
                    type="text"
                    value={novaProvaObsJuridica}
                    onChange={(e) => setNovaProvaObsJuridica(e.target.value)}
                    placeholder="Ex: Prova da interpelação admonitória nos termos do art. 805.º n.º 1 do Código Civil"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Archive Synchronization Checkbox */}
              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="syncArquivoCheck"
                    checked={novaProvaArquivarDigital}
                    onChange={(e) => setNovaProvaArquivarDigital(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                  />
                  <label htmlFor="syncArquivoCheck" className="text-xs font-bold text-emerald-900 dark:text-emerald-200 cursor-pointer">
                    Arquivar automaticamente na pasta "⚖️ Processos Jurídicos & Contencioso" do Arquivo Digital
                  </label>
                </div>
                <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                  Recomendado
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddProvaModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer border border-emerald-400"
                >
                  <i className="fa-solid fa-plus-circle"></i>
                  <span>Juntar Prova aos Autos</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INICIAR NOVO PROCESSO JUDICIAL                                     */}
      {/* ========================================================================= */}
      {showNovoProcessoModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-900 text-white">
              <h3 className="text-base font-bold flex items-center gap-2">
                <i className="fa-solid fa-gavel text-emerald-400"></i>
                Iniciar Novo Processo de Contencioso / Judicial
              </h3>
              <button
                onClick={() => setShowNovoProcessoModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
            </div>

            <form onSubmit={handleCriarProcessoSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Fração com Dívida / Infratora *
                  </label>
                  <select
                    value={novoFracaoId}
                    onChange={(e) => handleFracaoChange(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-bold"
                  >
                    {fracoes.map(f => (
                      <option key={f.id_fracao} value={f.id_fracao}>
                        Fração {f.fracao_nome} - {f.proprietario?.nome || "Proprietário"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tipo de Litígio
                  </label>
                  <select
                    value={novoTipoProcesso}
                    onChange={(e) => setNovoTipoProcesso(e.target.value as any)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                  >
                    <option value="FALTA_PAGAMENTO_QUOTAS">Falta de Pagamento de Quotas</option>
                    <option value="OBRAS_NAO_AUTORIZADAS">Obras Não Autorizadas em Partes Comuns</option>
                    <option value="DANOS_PARTES_COMUNS">Danos em Partes Comuns</option>
                    <option value="INCUMPRIMENTO_REGULAMENTO">Incumprimento do Regulamento Interno</option>
                    <option value="INFILTRACOES_RESPONSABILIDADE">Infiltrações e Danos entre Frações</option>
                    <option value="OUTRO_LITIGIO">Outro Litígio Judicial</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Título do Processo
                </label>
                <input
                  type="text"
                  required
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  placeholder="Ex: Execução por Quotas Vencidas e Não Pagas - Fração A"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Valor da Dívida Capital (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={novoValorCapital}
                    onChange={(e) => setNovoValorCapital(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tribunal / Balcão Competente
                  </label>
                  <select
                    value={novoTribunal}
                    onChange={(e) => setNovoTribunal(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                  >
                    <option value="Balcão Nacional de Injunções (BNI)">Balcão Nacional de Injunções (BNI)</option>
                    <option value="Julgado de Paz">Julgado de Paz</option>
                    <option value="Tribunal Judicial da Comarca">Tribunal Judicial da Comarca</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Resumo e Causa de Pedir
                </label>
                <textarea
                  rows={3}
                  value={novoDescricao}
                  onChange={(e) => setNovoDescricao(e.target.value)}
                  placeholder="Descreva a génese da dívida ou da infração..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNovoProcessoModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer border border-emerald-400"
                >
                  <i className="fa-solid fa-gavel"></i>
                  <span>Criar Dossiê do Processo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTAR NOVO MARCO DE TRAMITAÇÃO                                  */}
      {/* ========================================================================= */}
      {showAddMarcoModal && currentProcesso && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-900 text-white">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <i className="fa-solid fa-clock-rotate-left text-emerald-400"></i>
                Registar Diligência ou Marco Processual
              </h3>
              <button
                onClick={() => setShowAddMarcoModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
            </div>

            <form onSubmit={handleAdicionarMarcoSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Fase / Título da Diligência *
                </label>
                <input
                  type="text"
                  required
                  value={novoMarcoFase}
                  onChange={(e) => setNovoMarcoFase(e.target.value)}
                  placeholder="Ex: Notificação AR Entregue com Sucesso"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Descrição Detalhada do Evento *
                </label>
                <textarea
                  rows={3}
                  required
                  value={novoMarcoDesc}
                  onChange={(e) => setNovoMarcoDesc(e.target.value)}
                  placeholder="Ex: Notificação entregue pelos CTT e assinada pelo réu. Inicia-se o prazo legal de 10 dias para oposição..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Responsável pelo Registo
                </label>
                <input
                  type="text"
                  value={novoMarcoResp}
                  onChange={(e) => setNovoMarcoResp(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddMarcoModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  Registar Diligência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LIGHTBOX / VISUALIZADOR DE PROVA (FOTOGRAFIA / PRINT / RECIBO)      */}
      {/* ========================================================================= */}
      {lightboxProva && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-white">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold bg-emerald-600 text-white px-2.5 py-0.5 rounded">
                  Doc. {lightboxProva.numero_documento_ordem}
                </span>
                <div>
                  <h4 className="text-sm font-bold">{lightboxProva.titulo}</h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {formatDatePT(lightboxProva.data_documento)} • {lightboxProva.ficheiro_nome}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setLightboxProva(null)}
                className="text-slate-400 hover:text-white p-2 rounded-lg cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto flex flex-col items-center justify-center bg-slate-950/80">
              {lightboxProva.url_preview && lightboxProva.tipo_ficheiro === "imagem" ? (
                <img
                  src={lightboxProva.url_preview}
                  alt={lightboxProva.titulo}
                  className="max-h-[500px] max-w-full rounded-lg shadow-2xl object-contain border border-slate-800"
                />
              ) : (
                <div className="p-12 text-center space-y-3">
                  <i className="fa-solid fa-file-pdf text-5xl text-rose-500"></i>
                  <p className="text-sm font-bold text-slate-300">{lightboxProva.ficheiro_nome}</p>
                  <p className="text-xs text-slate-500">Documento PDF certificado pronto para anexação judicial.</p>
                </div>
              )}

              {lightboxProva.descricao && (
                <p className="text-xs text-slate-300 mt-4 max-w-2xl text-center bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                  {lightboxProva.descricao}
                </p>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-900">
              <span>{lightboxProva.observacoes_juridicas || "Elemento probatório oficial CondoManager AI"}</span>
              <button
                onClick={() => setLightboxProva(null)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
              >
                Fechar Visualizador
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
