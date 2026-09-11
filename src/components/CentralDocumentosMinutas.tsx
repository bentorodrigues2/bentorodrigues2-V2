import React, { useState, useMemo } from "react";
import { jsPDF } from "jspdf";
import { Predio, Fracao, LoggedUser, Conta } from "../types";
import { 
  formatDatePT, 
  addPdfHeaderWithLogo, 
  generateCondominoPwaManualPDF, 
  gerarPdfBoasVindasAdministrador, 
  gerarPdfBoasVindasGestor,
  gerarPdfRegistoFornecedorHomologado,
  gerarCartaoAniversarioCondominoPDF,
  downloadNotaCobrancaPDF,
  gerarConvocatoriaOficialPDF,
  gerarNotificacaoDividaPDF,
  gerarAtaAprovadaOficialPDF,
  gerarParticipacaoSinistroPDF
} from "../utils";
import { BIRTHDAY_WATERMARK_BASE64 } from "../assets/birthdayWatermarkBase64";
import { 
  FileText, 
  Mail, 
  Download, 
  Send, 
  CheckCircle2, 
  Edit3, 
  Eye, 
  Copy, 
  Printer, 
  Sparkles, 
  Paperclip, 
  AlertTriangle, 
  Clock, 
  Building2, 
  FileCode, 
  Sliders, 
  ArrowRight,
  RefreshCw,
  FolderDown,
  ShieldCheck,
  Check,
  MessageSquare,
  Smartphone
} from "lucide-react";
import { triggerSendReaction } from "./SendingReactionModal";

interface CentralDocumentosMinutasProps {
  predio: Predio;
  fracoes: Fracao[];
  loggedUser: LoggedUser;
  contas?: Conta[];
  onOpenArranque?: () => void;
  activeTab?: TabMode;
  onSelectTab?: (tab: TabMode) => void;
}

type TabMode = "minutas_oficiais" | "simulador_emails";

export function CentralDocumentosMinutas({
  predio,
  fracoes,
  loggedUser,
  contas = [],
  onOpenArranque,
  activeTab: activeTabProp,
  onSelectTab
}: CentralDocumentosMinutasProps) {
  const [internalTab, setInternalTab] = useState<TabMode>("minutas_oficiais");
  const activeTab = activeTabProp || internalTab;
  const setActiveTab = (tab: TabMode) => {
    setInternalTab(tab);
    if (onSelectTab) onSelectTab(tab);
  };
  const [selectedMinutaId, setSelectedMinutaId] = useState<string>("ata_assembleia");
  const [selectedEmailSimId, setSelectedEmailSimId] = useState<string>("comprovativo_pagamento");

  // Email test target
  const [testEmailRecipient, setTestEmailRecipient] = useState<string>("jcafguerra@hotmail.com");
  const [emailSentStatus, setEmailSentStatus] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // --- MINUTAS STATE (EDITÁVEIS) ---
  // 1. ATA
  const [ataNumero, setAtaNumero] = useState<string>("42");
  const [ataTipo, setAtaTipo] = useState<string>("Assembleia Geral Ordinária");
  const [ataData, setAtaData] = useState<string>("2026-09-15");
  const [ataHora1, setAtaHora1] = useState<string>("20:30");
  const [ataHora2, setAtaHora2] = useState<string>("21:00");
  const [ataLocal, setAtaLocal] = useState<string>("Sala de Condomínio / Videoconferência");
  const [ataQuorum, setAtaQuorum] = useState<string>("780"); // permilagem
  const [ataOrdemTrabalhos, setAtaOrdemTrabalhos] = useState<string>(
    "Ponto Um: Apresentação, discussão e votação das contas do exercício anterior.\n" +
    "Ponto Dois: Apresentação, discussão e aprovação do orçamento previsional para o ano corrente e quotas.\n" +
    "Ponto Três: Obras de manutenção e impermeabilização do terraço comum.\n" +
    "Ponto Quatro: Eleição da Administração do Condomínio."
  );
  const [ataDeliberacoes, setAtaDeliberacoes] = useState<string>(
    "Ponto Um: As contas do exercício foram aprovadas por unanimidade dos presentes.\n" +
    "Ponto Dois: Foi aprovado o orçamento ordinário de 14.500,00€ e quota extraordinária de fundo de reserva.\n" +
    "Ponto Três: Deliberou-se adjudicar a reparação do terraço à empresa 'TecnoObras Lda' pelo valor de 3.200,00€.\n" +
    "Ponto Quatro: Foi reeleita a atual Administração com plenos poderes de gestão."
  );

  // 2. AVISO DE COBRANÇA
  const [avisoFracao, setAvisoFracao] = useState<string>(fracoes[0]?.fracao_nome || "Fração A - 1.º Dto");
  const [avisoProprietario, setAvisoProprietario] = useState<string>(fracoes[0]?.proprietario.nome || "José Carlos Guerra");
  const [avisoMesAno, setAvisoMesAno] = useState<string>("Setembro de 2026");
  const [avisoQuotaOrdinaria, setAvisoQuotaOrdinaria] = useState<string>("45.00");
  const [avisoFundoReserva, setAvisoFundoReserva] = useState<string>("4.50");
  const [avisoQuotaExtra, setAvisoQuotaExtra] = useState<string>("0.00");
  const [avisoDataLimite, setAvisoDataLimite] = useState<string>("2026-09-08");
  const [avisoIban, setAvisoIban] = useState<string>(predio.iban || "PT50 0033 0000 1234 5678 9012 3");
  const [avisoEntidade, setAvisoEntidade] = useState<string>("21234");
  const [avisoReferencia, setAvisoReferencia] = useState<string>("987 654 321");

  // 3. CARTA DE INTERPELAÇÃO DE DÍVIDA
  const [dividaFracao, setDividaFracao] = useState<string>(fracoes[1]?.fracao_nome || "Fração B - 2.º Esq");
  const [dividaProprietario, setDividaProprietario] = useState<string>(fracoes[1]?.proprietario.nome || "António Silva");
  const [dividaMorada, setDividaMorada] = useState<string>("Rua das Flores, N.º 12, 1000-001 Lisboa");
  const [dividaValorTotal, setDividaValorTotal] = useState<string>("247.50");
  const [dividaPeriodos, setDividaPeriodos] = useState<string>("Quotas Ordinárias de Maio, Junho, Julho e Agosto de 2026");
  const [dividaPrazoDias, setDividaPrazoDias] = useState<string>("15");

  // 4. BALANCETE FINANCEIRO
  const [balanceteExercicio, setBalanceteExercicio] = useState<string>("Exercício 2026 (Janeiro a Agosto)");
  const [balanceteTotalReceitas, setBalanceteTotalReceitas] = useState<string>("11.450,00");
  const [balanceteTotalDespesas, setBalanceteTotalDespesas] = useState<string>("8.920,00");
  const [balanceteSaldoOrdem, setBalanceteSaldoOrdem] = useState<string>("2.530,00");
  const [balanceteSaldoReserva, setBalanceteSaldoReserva] = useState<string>("6.850,00");

  // 5. AUTO DE VISTORIA TÉCNICA
  const [vistoriaNumero, setVistoriaNumero] = useState<string>("VIS-2026-09");
  const [vistoriaData, setVistoriaData] = useState<string>("2026-08-28");
  const [vistoriaArea, setVistoriaArea] = useState<string>("Casa das Máquinas do Elevador e Cobertura");
  const [vistoriaTecnico, setVistoriaTecnico] = useState<string>("Eng. Manuel Oliveira (Inspeção Técnica)");
  const [vistoriaAnomalias, setVistoriaAnomalias] = useState<string>(
    "- Detetado ligeiro desgaste nos cabos de tração do Elevador B.\n" +
    "- Grelha de ventilação desobstruída.\n" +
    "- Impermeabilização da caleira norte com sinais de infiltração pontual."
  );
  const [vistoriaRecomendacoes, setVistoriaRecomendacoes] = useState<string>(
    "1. Agendar substituição preventiva de cabos antes da inspeção periódica DGEG.\n" +
    "2. Aplicação de tela betuminosa líquida na caleira norte na próxima semana."
  );

  // --- GERADOR DE PDF ---
  const handleExportarPDFMinuta = () => {
    try {
      const doc = new jsPDF();
      let y = addPdfHeaderWithLogo(doc, predio.nome);

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");

      if (selectedMinutaId === "ata_assembleia") {
        doc.text(`ATA N.º ${ataNumero} - ${ataTipo.toUpperCase()}`, 14, y);
        y += 8;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Edifício: ${predio.nome || "Condomínio"} | NIF: ${predio.nif}`, 14, y);
        y += 6;
        doc.text(`Data: ${ataData} | 1.ª Conv.: ${ataHora1}h | 2.ª Conv.: ${ataHora2}h`, 14, y);
        y += 6;
        doc.text(`Local: ${ataLocal} | Quórum Representado: ${ataQuorum} ‰`, 14, y);
        y += 10;

        doc.setFont("helvetica", "bold");
        doc.text("ORDEM DE TRABALHOS:", 14, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        const linesOT = doc.splitTextToSize(ataOrdemTrabalhos, 180);
        doc.text(linesOT, 14, y);
        y += linesOT.length * 5 + 6;

        doc.setFont("helvetica", "bold");
        doc.text("DELIBERAÇÕES E DECISÕES TOMADAS:", 14, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        const linesDelib = doc.splitTextToSize(ataDeliberacoes, 180);
        doc.text(linesDelib, 14, y);
        y += linesDelib.length * 5 + 12;

        doc.text("A presente ata foi lida, aprovada e vai ser assinada pela Mesa da Assembleia.", 14, y);
        y += 16;
        doc.text("O Presidente da Mesa: _______________________", 14, y);
        doc.text("O Secretário / Administrador: _______________________", 110, y);
      } 
      else if (selectedMinutaId === "aviso_cobranca") {
        doc.text(`NOTA DE COBRANÇA DE QUOTA - ${avisoMesAno.toUpperCase()}`, 14, y);
        y += 8;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Destinatário: ${avisoProprietario}`, 14, y);
        y += 6;
        doc.text(`Fração: ${avisoFracao} | Prédio: ${predio.nome || "Condomínio"}`, 14, y);
        y += 10;

        doc.setFont("helvetica", "bold");
        doc.text("DISCRIMINAÇÃO DE VALORES:", 14, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.text(`- Quota Ordinária: ${avisoQuotaOrdinaria} €`, 14, y); y += 5;
        doc.text(`- Fundo Comum de Reserva: ${avisoFundoReserva} €`, 14, y); y += 5;
        if (parseFloat(avisoQuotaExtra) > 0) {
          doc.text(`- Quota Extraordinária: ${avisoQuotaExtra} €`, 14, y); y += 5;
        }
        const total = (parseFloat(avisoQuotaOrdinaria) + parseFloat(avisoFundoReserva) + parseFloat(avisoQuotaExtra)).toFixed(2);
        doc.setFont("helvetica", "bold");
        doc.text(`TOTAL A PAGAR: ${total} €`, 14, y); y += 10;

        doc.setFont("helvetica", "normal");
        doc.text(`Data Limite de Pagamento: ${avisoDataLimite}`, 14, y); y += 6;
        doc.text(`IBAN para Transferência: ${avisoIban}`, 14, y); y += 6;
        doc.text(`Dados Multibanco (Opcional): Entidade: ${avisoEntidade} | Referência: ${avisoReferencia}`, 14, y); y += 12;
        doc.text("Por favor envie o comprovativo para o email do condomínio para emissão do recibo.", 14, y);
      }
      else if (selectedMinutaId === "carta_divida") {
        doc.text("NOTIFICAÇÃO FORMAL DE DÍVIDA E CONSTITUIÇÃO EM MORA", 14, y);
        y += 8;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Para: ${dividaProprietario}`, 14, y); y += 5;
        doc.text(`Morada: ${dividaMorada}`, 14, y); y += 5;
        doc.text(`Referência: Fração ${dividaFracao} | Valor em Dívida: ${dividaValorTotal} €`, 14, y); y += 10;

        doc.setFont("helvetica", "bold");
        doc.text("EXMO.(A) CONDÓMINO(A),", 14, y); y += 6;
        doc.setFont("helvetica", "normal");
        const corpoDivida = `Vimos por este meio solicitar a regularização do montante de ${dividaValorTotal} €, relativo a ${dividaPeriodos}.\n\nNos termos do Artigo 1424.º-B do Código Civil e Decreto-Lei n.º 268/94, solicita-se o pagamento no prazo impreterível de ${dividaPrazoDias} dias a contar da receção desta missiva.\n\nMais se informa que as atas com deliberação de quotas têm força de título executivo nos termos da lei.`;
        const linesD = doc.splitTextToSize(corpoDivida, 180);
        doc.text(linesD, 14, y); y += linesD.length * 5 + 14;
        doc.text("Com os melhores cumprimentos,\nA Administração do Condomínio", 14, y);
      }
      else if (selectedMinutaId === "balancete_financeiro") {
        doc.text(`BALANCETE FINANCEIRO & MAPA ORÇAMENTAL`, 14, y);
        y += 8;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Período: ${balanceteExercicio}`, 14, y); y += 6;
        doc.text(`Edifício: ${predio.nome || "Condomínio"} | NIF: ${predio.nif}`, 14, y); y += 10;

        doc.setFont("helvetica", "bold");
        doc.text("RESUMO DE TESOURARIA:", 14, y); y += 6;
        doc.setFont("helvetica", "normal");
        doc.text(`- Total de Receitas Cobradas: ${balanceteTotalReceitas} €`, 14, y); y += 5;
        doc.text(`- Total de Despesas Liquidadas: ${balanceteTotalDespesas} €`, 14, y); y += 5;
        doc.text(`- Saldo em Conta à Ordem: ${balanceteSaldoOrdem} €`, 14, y); y += 5;
        doc.text(`- Saldo em Conta Poupança / Fundo de Reserva: ${balanceteSaldoReserva} €`, 14, y); y += 10;
        doc.text("Documento validado pela Administração e sujeito a verificação pelos condóminos.", 14, y);
      }
      else if (selectedMinutaId === "auto_vistoria") {
        doc.text(`AUTO DE VISTORIA TÉCNICA - N.º ${vistoriaNumero}`, 14, y);
        y += 8;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Data da Vistoria: ${vistoriaData} | Técnico: ${vistoriaTecnico}`, 14, y); y += 6;
        doc.text(`Área / Instalação Inspecionada: ${vistoriaArea}`, 14, y); y += 10;

        doc.setFont("helvetica", "bold");
        doc.text("ANOMALIAS / OBSERVAÇÕES DETETADAS:", 14, y); y += 6;
        doc.setFont("helvetica", "normal");
        const linesAnom = doc.splitTextToSize(vistoriaAnomalias, 180);
        doc.text(linesAnom, 14, y); y += linesAnom.length * 5 + 6;

        doc.setFont("helvetica", "bold");
        doc.text("RECOMENDAÇÕES & AÇÕES CORRETIVAS:", 14, y); y += 6;
        doc.setFont("helvetica", "normal");
        const linesRec = doc.splitTextToSize(vistoriaRecomendacoes, 180);
        doc.text(linesRec, 14, y); y += linesRec.length * 5 + 12;

        doc.text("O Técnico Responsável: _______________________", 14, y);
      }

      doc.save(`Minuta_${selectedMinutaId}_${predio.nif}.pdf`);
      triggerSendReaction("email", "PDF Editável descarregado com sucesso!");
    } catch (e: any) {
      alert("Erro ao exportar PDF: " + e.message);
    }
  };

  // --- DISPARAR EMAIL OFICIAL ---
  const handleDispararEmailSimulado = (tipo: string) => {
    triggerSendReaction("email", `A enviar e-mail oficial "${tipo}" para ${testEmailRecipient}...`);
    setTimeout(() => {
      triggerSendReaction("email", `E-mail oficial [${tipo}] enviado com sucesso para ${testEmailRecipient}!`);
      setEmailSentStatus(`Envio de "${tipo}" registado com sucesso para ${testEmailRecipient} em ${new Date().toLocaleTimeString()}`);
    }, 900);
  };

  // --- DESCARREGAR ANEXO DO E-MAIL SIMULADO ---
  const handleDescarregarAnexoEmail = (emailId: string) => {
    try {
      if (emailId === "boas_vindas_condomino") {
        generateCondominoPwaManualPDF(
          fracoes[0]?.proprietario?.nome || "Condómino",
          predio.nome || "Condomínio Edifício Estrela da Barra",
          "Cnd-94K2A8"
        );
        triggerSendReaction("email", "Manual do Condómino (PDF) descarregado com sucesso!");
      } else if (emailId === "boas_vindas_administrador") {
        gerarPdfBoasVindasAdministrador(
          {
            nome: loggedUser.nome || "Administrador do Condomínio",
            email: testEmailRecipient.includes("@") ? testEmailRecipient : "administracao@condomanagerai.com",
            perfil: "ADMIN",
            tlm: "+351 919 943 465",
            password_provisoria: "Admin#2026!"
          },
          [predio],
          "Condomínio Edifício Estrela da Barra"
        );
        triggerSendReaction("email", "Manual & Credencial de Administrador (PDF) descarregado com sucesso!");
      } else if (emailId === "boas_vindas_gestor") {
        gerarPdfBoasVindasGestor(
          {
            nome: "Gestor de Portfólio / Operacional",
            email: testEmailRecipient.includes("@") ? testEmailRecipient : "gestor@condomanagerai.com",
            perfil: "GESTOR",
            tlm: "+351 919 943 465",
            password_provisoria: "Gestor#2026!"
          },
          [predio],
          "Condomínio Edifício Estrela da Barra"
        );
        triggerSendReaction("email", "Manual & Credencial de Gestor (PDF) descarregado com sucesso!");
      } else if (emailId === "boas_vindas_fornecedor") {
        gerarPdfRegistoFornecedorHomologado(
          {
            nome: "Fornecedor / Prestador de Serviços",
            email_contacto: testEmailRecipient.includes("@") ? testEmailRecipient : "fornecedor@empresa.pt",
            pwa_password_provisoria: "Forn-82M4P9"
          },
          predio
        );
        triggerSendReaction("email", "Instruções & Credencial de Fornecedor (PDF) descarregado com sucesso!");
      } else if (emailId === "aniversario_condomino") {
        gerarCartaoAniversarioCondominoPDF(
          "Ana Silva",
          predio.nome || "Condomínio Edifício Estrela da Barra",
          "José Carlos Guerra"
        );
        triggerSendReaction("email", "Cartão Postal de Aniversário (PDF) descarregado com sucesso!");
      } else if (emailId === "convocatoria_assembleia") {
        gerarConvocatoriaOficialPDF(
          predio,
          {
            id_reuniao: "temp-convocatoria-email-9",
            id_predio: predio.id_predio,
            tema: "Assembleia Geral Ordinária de Condóminos",
            data: "15/09/2026",
            hora: "20:30",
            local_reuniao: "Sala de Condomínio / Ligação Zoom",
            ordens_trabalho: "1. Apresentação e votação do Relatório de Contas do exercício transato.\n2. Discussão e aprovação do Orçamento Previsional e Quotas para 2026/2027.\n3. Plano de Manutenção e Conservação de Áreas Comuns.\n4. Eleição / Renovação da Administração.",
            estado: "Agendada",
            isVideoconferencia: true,
            plataformaVideoconferencia: "Zoom / Ligação Online",
            linkVideoconferencia: "https://bentorodrigues2.condomanagerai.com"
          },
          fracoes,
          loggedUser?.nome || "José Carlos Guerra"
        );
        triggerSendReaction("email", "Convocatória Oficial em PDF (Layout & Imagem CondoManager AI) descarregada com sucesso!");
      } else if (emailId === "aviso_cobranca" || emailId === "lembrete_dia05") {
        downloadNotaCobrancaPDF({
          reciboNum: "NC-2026/09-FRA-A",
          dataEmissao: "25/08/2026",
          dataLimite: "08/09/2026",
          buildingName: predio?.nome || "Condomínio Edifício Estrela da Barra",
          buildingAddress: predio?.morada_linha1 || "Rua Bento Rodrigues, 2",
          buildingNif: predio?.nif || "900123456",
          buildingEmail: "edificio.estrela@condomanager.pt",
          buildingIban: "PT50 0035 0123 4567 8901 2344 5",
          proprietarioNome: "Ana Silva",
          proprietarioNif: fracoes[0]?.proprietario?.nif || "221230475",
          fracaoIdent: "Fração A",
          referenciaFracao: (fracoes[0] as any)?.referencia_pagamento || "BR2-FRA-A",
          quotaMensalVal: 45.00,
          fundoReservaVal: 4.50,
          descricaoQuota: "Quota Ordinária de Setembro de 2026",
          tipoDocumento: "NOTA_COBRANCA"
        }, "Aviso_Cobranca_Setembro_2026_Fracao_A.pdf");
        triggerSendReaction("email", "Aviso de Cobrança em PDF (Layout Oficial CondoManager AI) descarregado com sucesso!");
      } else if (emailId === "carta_interpelacao_divida") {
        gerarNotificacaoDividaPDF(
          "Carlos Administrador",
          "Fração B",
          "247,50",
          predio.nome || "Condomínio Edifício Estrela da Barra",
          predio.nif || "900 123 456",
          "PT50 0035 0123 4567 8901 2344 5"
        );
        triggerSendReaction("email", "Notificação Formal de Dívida (PDF com Título Executivo) descarregada com sucesso!");
      } else if (emailId === "envio_ata_aprovada") {
        gerarAtaAprovadaOficialPDF(
          "42",
          "15/09/2026",
          predio.nome || "Condomínio Edifício Estrela da Barra",
          predio.nif || "900 123 456"
        );
        triggerSendReaction("email", "Ata N.º 42 Aprovada da Assembleia (PDF Oficial) descarregada com sucesso!");
      } else if (emailId === "sinistro_comunicacao") {
        gerarParticipacaoSinistroPDF(
          "SIN-2026-014",
          "847291039",
          "Fidelidade - Companhia de Seguros, S.A.",
          predio.nome || "Condomínio Edifício Estrela da Barra",
          predio.nif || "900 123 456"
        );
        triggerSendReaction("email", "Participação Formal de Sinistro (PDF com Peritagem) descarregada com sucesso!");
      } else if (emailId === "ocorrencia_avaria") {
        triggerSendReaction("mensagem", "Comunicação exclusivamente por mensagem na aplicação (sem anexo de e-mail).");
      } else {
        handleExportarPDFMinuta();
      }
    } catch (e: any) {
      alert("Erro ao descarregar anexo: " + e.message);
    }
  };

  // --- TODOS OS TEMPLATES DE EMAIL DEFINIDOS NA PLATAFORMA ---
  const emailTemplates = useMemo(() => [
    {
      id: "boas_vindas_condomino",
      categoria: "Boas-Vindas & Acessos",
      titulo: "1. Boas-Vindas ao Condómino (Novo Proprietário / Residente)",
      gatilho: "Registo ou aquisição de nova fração / boas-vindas oficiais",
      assunto: "Boas Vindas e Acessos",
      anexoSimulado: "Instrucoes_Site_e_PWA_Condomino.pdf (210 KB)",
      corpoTexto: 
`De: ${(predio as any).email_administracao || (predio as any).email || "administracao@condomanagerai.com"}
Para: ${fracoes[0]?.proprietario?.email || "(Email do condómino)"}
Assunto: Boas Vindas e Acessos

Olá ${fracoes[0]?.proprietario?.nome || "(Nome do condómino)"},

Espero que se encontre bem.
O meu nome é José Carlos Guerra, administrador do nosso prédio e também seu vizinho no 3ºE. Disponibilizo o meu contacto direto (919943465) para qualquer assunto urgente ou questão que possa surgir.
Informo que a sua conta no CondoManager AI foi criada com sucesso. Pode aceder à sua área reservada através do link: https://bentorodrigues2.condomanagerai.com e pode baixar a aplicação AQUI (https://bentorodrigues2.condomanagerai.com).
Através desta plataforma — acessível via computador ou telemóvel — poderá acompanhar toda a atividade do condomínio, consultar documentos, reportar avarias, enviar comprovativos de pagamento e comunicar diretamente comigo. A sua participação ativa é fundamental para a gestão transparente do nosso prédio.

Importante:
    • Pagamentos: No seu perfil, encontrará a sua referência de pagamento personalizada. Por favor, utilize sempre esta referência ao efetuar transferências bancárias para garantir o processamento automático do seu saldo.
    • Instruções: Em anexo, encontrará um breve guia de utilização da plataforma.

Dados de Acesso:
Link: https://bentorodrigues2.condomanagerai.com
Utilizador: ${fracoes[0]?.proprietario?.email || "(Email do condómino)"}
Password Provisória: Cnd-94K2A8
(Por razões de segurança, ser-lhe-á solicitado que altere esta palavra-passe no seu primeiro acesso.)

Qualquer dúvida adicional, estou ao dispor.

Com os meus cumprimentos,

José Carlos Guerra
O Administrador do Condomínio`
    },
    {
      id: "boas_vindas_administrador",
      categoria: "Boas-Vindas & Acessos",
      titulo: "2. Nomeação & Ativação de Acesso - Perfil Administrador",
      gatilho: "Nomeação de novo Administrador do Condomínio / Ativação de Super Admin",
      assunto: "Nomeação & Ativação de Acesso à Gestão - Condomínio Edifício Estrela da Barra",
      anexoSimulado: "Instrucoes_Acesso_Perfil_Administrador.pdf (245 KB)",
      corpoTexto:
`De: ${(predio as any).email_administracao || (predio as any).email || "administracao@condomanagerai.com"}
Para: ${testEmailRecipient.includes("@") ? testEmailRecipient : "administracao@condomanagerai.com"}
Assunto: Nomeação & Ativação de Acesso à Gestão - Condomínio Edifício Estrela da Barra

Exmo.(a) Sr.(a) Administrador do Condomínio,

Confirmamos a sua integração com sucesso no sistema de gestão do Condomínio Edifício Estrela da Barra.

Privilégios e Módulos Ativados:
• Perfil de Acesso: Administrador do Condomínio (Super Admin / Acesso Total)
• Gestão de Tesouraria e Extratos Bancários com Reconciliação IA
• Emissão de Notas de Cobrança e Linhas Multibanco
• Gestão de Sinistros, Seguros e Livro de Vistorias Técnicas
• Assembleia Virtual com Votação em Tempo Real
• Controlo Cadastral & Jurídico: Registo de frações, autos e cobrança coerciva
• Parametrização do Autoresponder e Regras IA do Prédio

Aceda à consola de administração em https://bentorodrigues2.condomanagerai.com utilizando as suas credenciais seguras, pode acompanhar pelo seu telemóvel para baixar a aplicação selecione AQUI (https://bentorodrigues2.condomanagerai.com)

Dados de Acesso:
Link: https://bentorodrigues2.condomanagerai.com
Utilizador: ${testEmailRecipient.includes("@") ? testEmailRecipient : "administracao@condomanagerai.com"}
Password Provisória: Admin#2026!
(Por razões de segurança, ser-lhe-á solicitado que altere esta palavra-passe no seu primeiro acesso.)

Cordiais saudações,
CondoManager AI - Central de Operações`
    },
    {
      id: "boas_vindas_gestor",
      categoria: "Boas-Vindas & Acessos",
      titulo: "3. Nomeação & Ativação de Acesso - Perfil Gestor (Operacional)",
      gatilho: "Atribuição de carteira / integração de Gestor de Portfólio ou Operacional",
      assunto: "Nomeação & Ativação de Acesso à Gestão - Condomínio Edifício Estrela da Barra",
      anexoSimulado: "Instrucoes_Acesso_Perfil_Gestor.pdf (230 KB)",
      corpoTexto:
`De: ${(predio as any).email_administracao || (predio as any).email || "administracao@condomanagerai.com"}
Para: ${testEmailRecipient.includes("@") ? testEmailRecipient : "gestor@condomanagerai.com"}
Assunto: Nomeação & Ativação de Acesso à Gestão - Condomínio Edifício Estrela da Barra

Exmo.(a) Sr.(a) Gestor(a) de Portfólio / Operacional,

Confirmamos a sua integração com sucesso no sistema de gestão do Condomínio Edifício Estrela da Barra.

Privilégios e Módulos Ativados:
• Perfil de Acesso: Gestor de Portfólio / Gestor Operacional
• Gestão Operacional de Ocorrências e Triagem de Avarias
• Supervisão de Limpezas, Equipamentos e Vistorias Técnicas
• Acompanhamento de Fornecedores, Obras e Contratos de Manutenção
• Comunicação Direta com Condóminos, Comunicados e Notificações
• Consulta Documental, Atas e Gestão de Reservas de Espaços Comuns

Aceda à consola de administração em https://bentorodrigues2.condomanagerai.com utilizando as suas credenciais seguras, pode acompanhar pelo seu telemóvel para baixar a aplicação selecione AQUI (https://bentorodrigues2.condomanagerai.com)

Dados de Acesso:
Link: https://bentorodrigues2.condomanagerai.com
Utilizador: ${testEmailRecipient.includes("@") ? testEmailRecipient : "gestor@condomanagerai.com"}
Password Provisória: Gestor#2026!
(Por razões de segurança, ser-lhe-á solicitado que altere esta palavra-passe no seu primeiro acesso.)

Cordiais saudações,
CondoManager AI - Central de Operações`
    },
    {
      id: "boas_vindas_fornecedor",
      categoria: "Boas-Vindas & Acessos",
      titulo: "4. Registo de Fornecedor Homologado - Condomínio Edifício Estrela da Barra",
      gatilho: "Credenciação de fornecedor / prestador de serviços homologado",
      assunto: "Registo de Fornecedor Homologado - Condomínio Edifício Estrela da Barra",
      anexoSimulado: "Instrucoes_Acesso_Perfil_Fornecedor.pdf (215 KB)",
      corpoTexto:
`De: ${(predio as any).email_administracao || (predio as any).email || "administracao@condomanagerai.com"}
Para: ${testEmailRecipient.includes("@") ? testEmailRecipient : "fornecedor@empresa.pt"}
Assunto: Registo de Fornecedor Homologado - Condomínio Edifício Estrela da Barra

Exmos. Senhores (nome do fornecedor/prestador de serviço),

Confirmamos a conclusão do registo da vossa empresa no catálogo de fornecedores e prestadores homologados do Condomínio Edifício Estrela da Barra.

Dados Fiscais para Faturação :
• Designação: Condomínio Edifício Estrela da Barra
• NIF: 900123456
• Morada de Faturação: Rua Bento Rodrigues
• E-mail para Envio de Faturas/Recibos: ${(predio as any).email_administracao || (predio as any).email || "administracao@condomanagerai.com"}

Dados de Acesso:
Link: https://bentorodrigues2.condomanagerai.com
Utilizador: ${testEmailRecipient.includes("@") ? testEmailRecipient : "fornecedor@empresa.pt"}
Password Provisória: Forn-82M4P9
(Por razões de segurança, ser-lhe-á solicitado que altere esta palavra-passe no seu primeiro acesso.)

Atentamente,

José Carlos Guerra
+351 919 943 465
O Administrador do Condominio`
    },
    {
      id: "aniversario_condomino",
      categoria: "Relacionamento & Cordialidade",
      titulo: "5. Felicitações de Aniversário ao Condómino",
      gatilho: "Disparo automático no dia de aniversário do condómino / residente",
      assunto: "🎉 Feliz Aniversário, Ana Silva! - Os votos do seu Condomínio",
      anexoSimulado: "Cartao_Aniversario_Condomino.pdf (185 KB)",
      corpoTexto:
`De: ${(predio as any).email_administracao || (predio as any).email || "administracao@condomanagerai.com"}
Para: ${testEmailRecipient.includes("@") ? testEmailRecipient : "ana.silva@email.pt"}
Assunto: 🎉 Feliz Aniversário, Ana Silva! - Os votos do seu Condomínio

Exmo.(a) Sr.(a) Ana Silva,

Hoje é um dia especial!

A Administração e a equipa  do Condomínio Edifício Estrela da Barra têm o enorme gosto de lhe desejar um Feliz Aniversário, com muita saúde, alegria e realizações pessoais junto de quem mais estima.

Agradecemos o seu contributo diário para a harmonia e bom convívio no nosso edifício.

Parabéns pelo seu dia! 🎂🥂

Com as mais calorosas saudações,

José Carlos Guerra
A Administração do Condomínio 
Edifício Estrela da Barra`
    },
    {
      id: "aviso_cobranca",
      categoria: "Cobranças & Tesouraria",
      titulo: "6. Aviso de Cobrança / Emissão de Quota Mensal (Dia 25)",
      gatilho: "Emissão periódica de quotas com dados bancários e referência (Dia 25)",
      assunto: "Aviso de Pagamento: Quota de Setembro de 2026 - Fração A",
      anexoSimulado: "Aviso_Cobranca_Setembro_2026_Fracao_A.pdf (118 KB)",
      corpoTexto: 
`De: edificio.estrela@condomanager.pt
Para: ${testEmailRecipient.includes("@") ? testEmailRecipient : "jcafguerra@hotmail.com"}
Assunto: Aviso de Pagamento: Quota de Setembro de 2026 - Fração A

Exmo(a). Senhor(a) Ana Silva,

Encontra-se a pagamento a quota de condomínio referente à fração A para o mês de Setembro de 2026.

Resumo dos Valores:
• Quota Ordinária: 45,00 €
• Fundo Comum de Reserva: 4,50 €
• Total a Pagar: 49,50 €
• Data Limite de Pagamento: 08/09/2026

Dados de Pagamento:
• IBAN Oficial: PT50 0035 0123 4567 8901 2344 5
• Descritivo Obrigatório: ${(fracoes[0] as any)?.referencia_pagamento || "BR2-FRA-A"} (referência individual da fração correspondente para cruzamento de dados através da AI)
• E-mail para Envio de Comprovativos: edificio.estrela@condomanager.pt

Envie comprovativo para o email do condomínio ou através da aplicação, após confirmação recebe o recibo de pagamento.

Atenciosamente,

José Carlos Guerra
+351 919 943 465
A Administração do Condomínio
Edifício Estrela da Barra`
    },
    {
      id: "lembrete_dia05",
      categoria: "Cobranças & Tesouraria",
      titulo: "7. Lembrete Cordial de Vencimento de Quota (Dia 05)",
      gatilho: "Disparo automático 3 dias antes do limite de vencimento (Dia 05)",
      assunto: "Lembrete Cordial: Quota de Condomínio com Vencimento a 08/09 - Fração A",
      anexoSimulado: "Aviso_Cobranca_Setembro_2026_Fracao_A.pdf (118 KB)",
      corpoTexto:
`De: edificio.estrela@condomanager.pt
Para: ${testEmailRecipient.includes("@") ? testEmailRecipient : "jcafguerra@hotmail.com"}
Assunto: Lembrete Cordial: Quota de Condomínio com Vencimento a 08/09 - Fração A

Exmo.(a) Sr.(a) Ana Silva,

Lembramos cordialmente que a quota de condomínio relativa à fração A (valor: 49,50 €) atinge a data limite de liquidação no próximo dia 08 de Setembro de 2026.

Caso já tenha efetuado o pagamento nas últimas 24 horas, pedimos que desconsidere este lembrete ou nos envie o respetivo comprovativo.

Dados para Liquidação:
• IBAN Oficial: PT50 0035 0123 4567 8901 2344 5
• Descritivo Obrigatório: ${(fracoes[0] as any)?.referencia_pagamento || "BR2-FRA-A"} (referência individual da fração correspondente para cruzamento de dados através da AI)
• E-mail para Envio de Comprovativos: edificio.estrela@condomanager.pt

Envie comprovativo para o email do condomínio ou através da aplicação.

Atenciosamente,

José Carlos Guerra
+351 919 943 465
A Administração do Condomínio
Edifício Estrela da Barra`
    },
    {
      id: "carta_interpelacao_divida",
      categoria: "Cobranças & Tesouraria",
      titulo: "8. Carta de Interpelação / Notificação de Dívida (Art.º 1424.º-B CC)",
      gatilho: "Quotas com atraso superior a 60 dias / processo pré-judicial",
      assunto: `Carta de Interpelação: Regularização de Quotas em Atraso - Fração B`,
      anexoSimulado: "notificacao_formal_divida_titulo_executivo.pdf (230 KB)",
      corpoTexto:
`Estimado(a) Sr.(a) Carlos Administrador,

Proprietário(a) da Fração B,

Esperamos que este contacto o(a) encontre bem.

Vimos por este meio informar que a conta corrente da sua fração apresenta atualmente um valor pendente de 247,50 €, correspondente às quotas do condomínio dos meses de maio a agosto de 2026.

Com o intuito de mantermos as contas do nosso edifício devidamente regularizadas e em conformidade com o enquadramento legal aplicável (Artigo 1424.º-B do Código Civil e Decreto-Lei n.º 268/94), solicitamos a gentileza de proceder à regularização deste montante no prazo de 15 dias.

Caso prefira, estamos inteiramente disponíveis para analisar em conjunto um acordo de pagamento faseado que seja mais vantajoso e confortável para si.

Se porventura já efetuou este pagamento nos últimos dias, por favor desconsidere este aviso.

Ficamos a aguardar o seu contacto e disponíveis para qualquer esclarecimento.

Com os melhores cumprimentos,

A Administração do Condomínio`
    },
    {
      id: "convocatoria_assembleia",
      categoria: "Assembleias & Deliberações",
      titulo: "9. Convocatória Oficial de Assembleia de Condóminos",
      gatilho: "Convocatória formal ordinária ou extraordinária (DL 268/94)",
      assunto: `CONVOCATÓRIA: Assembleia Geral Ordinária de Condóminos - 15/09/2026`,
      anexoSimulado: "Convocatoria_Assembleia_15-09-2026.pdf (320 KB)",
      corpoTexto: 
`Assunto: CONVOCATÓRIA: Assembleia Geral Ordinária de Condóminos - 15/09/2026

Exmos.(as) Senhores(as) Condóminos(as) do Edifício Edifício Estrela da Barra,

Nos termos da lei, ficam convocados para a Assembleia Geral Ordinária de Condóminos a realizar no próximo dia 15 de Setembro de 2026:

• Data: 15/09/2026
• 1.ª Convocação: 20h30 (com quórum superior a 500‰)
• 2.ª Convocação: 21h00 (com qualquer quórum presente)
• Local: Sala de Condomínio / Ligação Zoom
• Plataforma de Votação Online: https://bentorodrigues2.condomanagerai.com

Ordem de Trabalhos:
1. Apresentação e votação do Relatório de Contas do exercício transato.
2. Discussão e aprovação do Orçamento Previsional e Quotas para 2026/2027.
3. Plano de Manutenção e Conservação de Áreas Comuns.
4. Eleição / Renovação da Administração.

Vai ser publicada na plataforma uma sondagem de presenças.

A Administração do Condomínio`
    },
    {
      id: "envio_ata_aprovada",
      categoria: "Assembleias & Deliberações",
      titulo: "10. Envio da Ata de Assembleia Aprovada & Folha de Presenças",
      gatilho: "Conclusão de assembleia e envio formal da ata (prazo legal de 30 dias)",
      assunto: `Ata N.º 42 da Assembleia Geral de 15/09/2026 - Edifício ${predio.nome || "Bento Rodrigues"}`,
      anexoSimulado: "ata_n42_assinada_mesa.pdf (410 KB)",
      corpoTexto:
`Exmos.(as) Senhores(as) Condóminos(as),

Em cumprimento do disposto no n.º 1 do Artigo 1432.º do Código Civil, remete-se em anexo a cópia integral da Ata N.º 42 respeitante à Assembleia Geral Ordinária realizada a 15 de Setembro de 2026.

Recorda-se aos condóminos não presentes que dispõem do prazo de 90 dias após a receção desta comunicação para, querendo, exercerem o direito de oposição ou comunicação escrita sobre as deliberações tomadas.

O documento encontra-se também permanentemente arquivado no vosso Portal do Condómino.

Com os melhores cumprimentos,
A Mesa da Assembleia & Administração`
    },
    {
      id: "ocorrencia_avaria",
      categoria: "Manutenção & Ocorrências",
      canal: "MENSAGEM" as const,
      titulo: "11. Resposta à Solicitação de Avaria Técnica (Via Mensagem - Sem E-mail)",
      gatilho: "Solicitação / reporte de avaria no PWA (Resposta enviada exclusivamente via mensagem)",
      assunto: `[MENSAGEM NA APLICAÇÃO] Resposta à Solicitação #TCK-2026-089 - Avaria no Portão da Garagem`,
      anexoSimulado: "Sem anexo de e-mail (Histórico integrado no chat da solicitação)",
      corpoTexto:
`[CANAL OFICIAL: RESPOSTA VIA MENSAGEM NA APLICAÇÃO (SEM ENVIO DE E-MAIL)]
Destinatário: ${fracoes[0]?.proprietario.nome || "José Carlos Guerra"} (Fração A - 1º Dto)
Canal: Mensagem interna no Chat & Notificações da Aplicação

Olá ${fracoes[0]?.proprietario.nome || "José Carlos Guerra"},

Agradecemos a sua comunicação. Em resposta à sua solicitação reportada sobre "Avaria no Portão da Garagem", informamos que foi registada e encaminhada no sistema:

• N.º de Solicitação: #TCK-2026-089
• Prioridade: Alta
• Estado: Encaminhado para a empresa técnica 'Portões & Automatismos Lda'
• Intervenção Prevista: Amanhã às 10:30

Acompanhe o estado da intervenção ou envie novas mensagens diretamente através da aplicação.

Atentamente,
Serviços de Manutenção & Administração
Condomínio Edifício Estrela da Barra`
    },
    {
      id: "sinistro_comunicacao",
      categoria: "Manutenção & Ocorrências",
      titulo: "12. Abertura e Declaração de Sinistro à Seguradora",
      gatilho: "Inundação, danos por tempestade, incêndio ou quebra em partes comuns",
      assunto: `Declaração de Sinistro #SIN-2026-014 - Apólice Multirriscos Condomínio ${predio.nome || "Bento Rodrigues"}`,
      anexoSimulado: "participacao_sinistro_peritagem_fotos.pdf (520 KB)",
      corpoTexto:
`Exmos. Senhores do Departamento de Sinistros / Companhia de Seguros Fidelidade,

Vimos por este meio efetuar a participação formal de sinistro ocorrido nas partes comuns do edifício:

• Apólice Multirriscos: N.º 847291039
• Tomador / Condomínio: Condomínio ${predio.nome || "Bento Rodrigues"} (NIF ${predio.nif || "900 123 456"})
• Data do Evento: 28/08/2026
• Natureza: Danos por Água / Rutura na coluna montante do piso 2
• Danos Preliminares Estimados: 1.850,00 €

Juntamos em anexo o relatório fotográfico, auto de vistoria técnica e primeiro orçamento de reparação urgente.

Aguardamos a nomeação do perito avaliador com a maior brevidade.

Atenciosamente,
A Administração do Condomínio`
    }
  ], [fracoes, predio, testEmailRecipient, loggedUser]);

  const activeEmailTemplate = useMemo(() => {
    return emailTemplates.find(t => t.id === selectedEmailSimId) || emailTemplates[0];
  }, [emailTemplates, selectedEmailSimId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-5 sm:p-7 rounded-2xl shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <FileText className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  Central de Documentos & Minutas Oficiais
                  <span className="text-xs px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 font-bold rounded-full border border-emerald-500/30">
                    Modelos Editáveis
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Minutas oficiais prontas para edição e exportação em PDF, com simulador completo de e-mails institucionais e anexos oficiais.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenArranque && (
              <button
                onClick={onOpenArranque}
                className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-black text-xs transition-all flex items-center space-x-1.5 shadow-md hover:scale-105 cursor-pointer"
              >
                <Sliders className="h-4 w-4 text-emerald-300" />
                <span>Configurar Saldos Iniciais & Dívidas</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab(activeTab === "minutas_oficiais" ? "simulador_emails" : "minutas_oficiais")}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs transition-all flex items-center space-x-1.5 shadow-md cursor-pointer"
            >
              {activeTab === "minutas_oficiais" ? (
                <>
                  <Mail className="h-4 w-4" />
                  <span>Ver Simulador de E-mails ({emailTemplates.length})</span>
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  <span>Ver Minutas Editáveis em PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* TABS DE SELEÇÃO PRINCIPAL */}
        <div className="flex items-center space-x-2 mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={() => setActiveTab("minutas_oficiais")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "minutas_oficiais"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <FileCode className="h-4 w-4 text-emerald-400" />
            <span>1. Minutas Oficiais em PDF (5 Documentos Editáveis)</span>
          </button>

          <button
            onClick={() => setActiveTab("simulador_emails")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "simulador_emails"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Mail className="h-4 w-4 text-emerald-400" />
            <span>2. Simulador de Todos os E-mails & Anexos ({emailTemplates.length} Templates)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: MINUTAS OFICIAIS EDITÁVEIS */}
      {/* ========================================================================= */}
      {activeTab === "minutas_oficiais" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* SIDEBAR SELETOR DE MINUTAS */}
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
              <h3 className="text-xs font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-3">
                Selecione o Documento Oficial
              </h3>
              <div className="space-y-2">
                {[
                  { id: "ata_assembleia", title: "Ata de Assembleia Geral", desc: "Com quórum em permilagem, ordem de trabalhos e deliberações", icon: FileText, tag: "DL 268/94" },
                  { id: "aviso_cobranca", title: "Aviso de Cobrança / Quota", desc: "Com quota ordinária, fundo de reserva e dados bancários", icon: Building2, tag: "Mensal" },
                  { id: "carta_divida", title: "Carta de Notificação de Dívida", desc: "Interpelação formal com força de título executivo", icon: AlertTriangle, tag: "Jurídico" },
                  { id: "balancete_financeiro", title: "Balancete & Mapa Orçamental", desc: "Demonstração de receitas, despesas e saldos bancários", icon: Sliders, tag: "Contas" },
                  { id: "auto_vistoria", title: "Auto de Vistoria Técnica", desc: "Registo de inspeção a elevadores, coberturas e bombas", icon: ShieldCheck, tag: "Manutenção" }
                ].map((doc) => {
                  const Icon = doc.icon;
                  const isSelected = selectedMinutaId === doc.id;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedMinutaId(doc.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-start space-x-3 ${
                        isSelected
                          ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 shadow-xs ring-1 ring-emerald-500"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${isSelected ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{doc.title}</span>
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {doc.tag}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{doc.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleExportarPDFMinuta}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs transition-all flex items-center justify-center space-x-2 shadow-md cursor-pointer hover:scale-[1.02]"
                >
                  <Download className="h-4 w-4" />
                  <span>Descarregar Este Documento em PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* PAINEL DE EDIÇÃO E PREVIEW LIVE DA MINUTA */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-2xl shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Edit3 className="h-4 w-4 text-emerald-500" />
                <h2 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                  Editor do Documento & Campos Oficiais
                </h2>
              </div>
              <button
                onClick={handleExportarPDFMinuta}
                className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-emerald-400 border border-slate-700 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Exportar PDF</span>
              </button>
            </div>

            {/* FORMULÁRIO ESPECÍFICO CONFORME O DOCUMENTO SELECIONADO */}
            {selectedMinutaId === "ata_assembleia" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">N.º da Ata</label>
                    <input
                      type="text"
                      value={ataNumero}
                      onChange={(e) => setAtaNumero(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Tipo de Assembleia</label>
                    <select
                      value={ataTipo}
                      onChange={(e) => setAtaTipo(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    >
                      <option value="Assembleia Geral Ordinária">Assembleia Geral Ordinária</option>
                      <option value="Assembleia Geral Extraordinária">Assembleia Geral Extraordinária</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Data da Reunião</label>
                    <input
                      type="date"
                      value={ataData}
                      onChange={(e) => setAtaData(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Horas (1.ª / 2.ª Conv.)</label>
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="text"
                        value={ataHora1}
                        onChange={(e) => setAtaHora1(e.target.value)}
                        className="w-1/2 px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-center"
                      />
                      <span className="text-slate-400">/</span>
                      <input
                        type="text"
                        value={ataHora2}
                        onChange={(e) => setAtaHora2(e.target.value)}
                        className="w-1/2 px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-center"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Local da Assembleia</label>
                    <input
                      type="text"
                      value={ataLocal}
                      onChange={(e) => setAtaLocal(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Quórum Representado (‰)</label>
                    <input
                      type="number"
                      value={ataQuorum}
                      onChange={(e) => setAtaQuorum(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-black text-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Ordem de Trabalhos</label>
                  <textarea
                    rows={4}
                    value={ataOrdemTrabalhos}
                    onChange={(e) => setAtaOrdemTrabalhos(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Deliberações e Decisões Aprovadas</label>
                  <textarea
                    rows={4}
                    value={ataDeliberacoes}
                    onChange={(e) => setAtaDeliberacoes(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>
            )}

            {selectedMinutaId === "aviso_cobranca" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Fração Destinatária</label>
                    <input
                      type="text"
                      value={avisoFracao}
                      onChange={(e) => setAvisoFracao(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nome do Condómino</label>
                    <input
                      type="text"
                      value={avisoProprietario}
                      onChange={(e) => setAvisoProprietario(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Mês / Ano</label>
                    <input
                      type="text"
                      value={avisoMesAno}
                      onChange={(e) => setAvisoMesAno(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Quota Ord. (€)</label>
                    <input
                      type="number"
                      value={avisoQuotaOrdinaria}
                      onChange={(e) => setAvisoQuotaOrdinaria(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Fundo Reserva (€)</label>
                    <input
                      type="number"
                      value={avisoFundoReserva}
                      onChange={(e) => setAvisoFundoReserva(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Data Limite</label>
                    <input
                      type="date"
                      value={avisoDataLimite}
                      onChange={(e) => setAvisoDataLimite(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">IBAN do Condomínio</label>
                    <input
                      type="text"
                      value={avisoIban}
                      onChange={(e) => setAvisoIban(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Entidade / Referência MB</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={avisoEntidade}
                        onChange={(e) => setAvisoEntidade(e.target.value)}
                        placeholder="Entidade"
                        className="w-1/3 px-2 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                      />
                      <input
                        type="text"
                        value={avisoReferencia}
                        onChange={(e) => setAvisoReferencia(e.target.value)}
                        placeholder="Referência"
                        className="w-2/3 px-2 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedMinutaId === "carta_divida" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Condómino Devedor</label>
                    <input
                      type="text"
                      value={dividaProprietario}
                      onChange={(e) => setDividaProprietario(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Fração</label>
                    <input
                      type="text"
                      value={dividaFracao}
                      onChange={(e) => setDividaFracao(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Morada de Notificação</label>
                    <input
                      type="text"
                      value={dividaMorada}
                      onChange={(e) => setDividaMorada(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Valor em Débito (€)</label>
                    <input
                      type="number"
                      value={dividaValorTotal}
                      onChange={(e) => setDividaValorTotal(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30 font-black text-red-600 dark:text-red-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Períodos / Meses em Atraso</label>
                    <input
                      type="text"
                      value={dividaPeriodos}
                      onChange={(e) => setDividaPeriodos(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Prazo para Pagamento (Dias)</label>
                    <input
                      type="number"
                      value={dividaPrazoDias}
                      onChange={(e) => setDividaPrazoDias(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedMinutaId === "balancete_financeiro" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Designação do Período</label>
                  <input
                    type="text"
                    value={balanceteExercicio}
                    onChange={(e) => setBalanceteExercicio(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1">Total de Receitas (€)</label>
                    <input
                      type="text"
                      value={balanceteTotalReceitas}
                      onChange={(e) => setBalanceteTotalReceitas(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-red-600 dark:text-red-400 uppercase mb-1">Total de Despesas (€)</label>
                    <input
                      type="text"
                      value={balanceteTotalDespesas}
                      onChange={(e) => setBalanceteTotalDespesas(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Saldo Conta à Ordem (€)</label>
                    <input
                      type="text"
                      value={balanceteSaldoOrdem}
                      onChange={(e) => setBalanceteSaldoOrdem(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Saldo Fundo Reserva (€)</label>
                    <input
                      type="text"
                      value={balanceteSaldoReserva}
                      onChange={(e) => setBalanceteSaldoReserva(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedMinutaId === "auto_vistoria" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">N.º da Vistoria</label>
                    <input
                      type="text"
                      value={vistoriaNumero}
                      onChange={(e) => setVistoriaNumero(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Data</label>
                    <input
                      type="date"
                      value={vistoriaData}
                      onChange={(e) => setVistoriaData(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Técnico / Responsável</label>
                    <input
                      type="text"
                      value={vistoriaTecnico}
                      onChange={(e) => setVistoriaTecnico(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Áreas Inspecionadas</label>
                  <input
                    type="text"
                    value={vistoriaArea}
                    onChange={(e) => setVistoriaArea(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Anomalias e Ocorrências</label>
                  <textarea
                    rows={3}
                    value={vistoriaAnomalias}
                    onChange={(e) => setVistoriaAnomalias(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Recomendações e Ações Corretivas</label>
                  <textarea
                    rows={3}
                    value={vistoriaRecomendacoes}
                    onChange={(e) => setVistoriaRecomendacoes(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: SIMULADOR DE E-MAILS & ANEXOS */}
      {/* ========================================================================= */}
      {activeTab === "simulador_emails" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LISTA DOS 6 TEMPLATES */}
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  Templates de E-mail ({emailTemplates.length})
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Pronto a Enviar
                </span>
              </div>

              <div className="space-y-2">
                {emailTemplates.map((template) => {
                  const isSelected = selectedEmailSimId === template.id;
                  return (
                    <button
                      key={template.id}
                      onClick={() => setSelectedEmailSimId(template.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-start space-x-3 ${
                        isSelected
                          ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 shadow-xs ring-1 ring-emerald-500"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${
                        isSelected 
                          ? (template.canal === "MENSAGEM" ? "bg-sky-600 text-white" : "bg-emerald-600 text-white") 
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}>
                        {template.canal === "MENSAGEM" ? (
                          <MessageSquare className="h-4 w-4" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-slate-800 dark:text-white truncate">
                            {template.titulo}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[8.5px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {template.categoria}
                          </span>
                          {template.canal === "MENSAGEM" ? (
                            <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                              Mensagem na App
                            </span>
                          ) : (
                            <span className="text-[9.5px] text-slate-500 dark:text-slate-400 truncate">
                              {template.gatilho}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* TARGET EMAIL CONFIG */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                  Endereço de E-mail de Envio / Destinatário
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="email"
                    value={testEmailRecipient}
                    onChange={(e) => setTestEmailRecipient(e.target.value)}
                    placeholder="ex: admin@condominio.pt"
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(testEmailRecipient);
                      setCopySuccess("E-mail copiado!");
                      setTimeout(() => setCopySuccess(null), 2000);
                    }}
                    className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
                    title="Copiar"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                {copySuccess && <p className="text-[10px] text-emerald-500 font-bold">{copySuccess}</p>}
              </div>
            </div>
          </div>

          {/* VISUALIZADOR DO EMAIL E ANEXO */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              {activeEmailTemplate.canal === "MENSAGEM" ? (
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4 text-sky-500" />
                  <h2 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                    Resposta à Solicitação via Mensagem na Aplicação
                  </h2>
                  <span className="hidden sm:inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    Sem Envio de E-mail
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-emerald-500" />
                  <h2 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                    Pré-visualização do E-mail Transacional
                  </h2>
                </div>
              )}

              <button
                onClick={() => {
                  if (activeEmailTemplate.canal === "MENSAGEM") {
                    triggerSendReaction("mensagem", "Mensagem enviada com sucesso para a aplicação do condómino! Não foi disparado e-mail.");
                    setEmailSentStatus("Resposta à solicitação enviada via mensagem interna na aplicação (sem envio de e-mail).");
                    setTimeout(() => setEmailSentStatus(null), 4000);
                  } else {
                    handleDispararEmailSimulado(activeEmailTemplate.titulo);
                  }
                }}
                className={`px-3.5 py-1.5 rounded-xl text-white text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-md hover:scale-105 ${
                  activeEmailTemplate.canal === "MENSAGEM"
                    ? "bg-sky-600 hover:bg-sky-700 active:bg-sky-800"
                    : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
                }`}
              >
                {activeEmailTemplate.canal === "MENSAGEM" ? (
                  <>
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Enviar Resposta via Mensagem</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Enviar E-mail para {testEmailRecipient}</span>
                  </>
                )}
              </button>
            </div>

            {/* AVISO INFORMATIVO DE CANAL MENSAGEM */}
            {activeEmailTemplate.canal === "MENSAGEM" && (
              <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-xl flex items-center space-x-2.5 text-xs text-sky-900 dark:text-sky-200">
                <Smartphone className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                <div>
                  <span className="font-bold">Regra de Comunicação Definida:</span> Não enviamos e-mail para este efeito. A resposta à solicitação é comunicada <strong>exclusivamente através de mensagem direta na aplicação (PWA/Chat)</strong> ao condómino.
                </div>
              </div>
            )}

            {emailSentStatus && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{emailSentStatus}</span>
                </div>
                <span className="font-bold text-[10px] uppercase">Registado com Sucesso</span>
              </div>
            )}

            {/* CAIXA DE E-MAIL OU MENSAGEM */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 font-sans">
              {activeEmailTemplate.canal === "MENSAGEM" ? (
                <div className="space-y-1.5 text-xs border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center">
                    <span className="w-24 font-bold text-slate-400 uppercase text-[10px]">Canal:</span>
                    <span className="font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" /> Mensagem Interna na Aplicação (Sem Envio de E-mail)
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-24 font-bold text-slate-400 uppercase text-[10px]">Destinatário:</span>
                    <span className="font-bold text-slate-800 dark:text-white">
                      {fracoes[0]?.proprietario.nome || "José Carlos Guerra"} (Fração A - 1º Dto)
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-24 font-bold text-slate-400 uppercase text-[10px]">Solicitação:</span>
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      #TCK-2026-089 (Avaria no Portão da Garagem)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 text-xs border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center">
                    <span className="w-16 font-bold text-slate-400 uppercase text-[10px]">De:</span>
                    <span className="font-bold text-slate-800 dark:text-white">
                      Condomínio {predio.nome || "Edifício Estrela da Barra"} &lt;{(predio as any).email_administracao || (predio as any).email || "administracao@condomanagerai.com"}&gt;
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-16 font-bold text-slate-400 uppercase text-[10px]">Para:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {testEmailRecipient}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-16 font-bold text-slate-400 uppercase text-[10px]">Assunto:</span>
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {activeEmailTemplate.assunto}
                    </span>
                  </div>
                </div>
              )}

              {/* ANEXO EM DESTAQUE OU INDICAÇÃO DE FORMATO */}
              {activeEmailTemplate.canal === "MENSAGEM" ? (
                <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 bg-sky-500/10 text-sky-500 rounded-lg">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-white block">
                        Sem anexo de e-mail
                      </span>
                      <span className="text-[9px] text-slate-400 uppercase font-semibold">Comunicação registada no histórico de mensagens da solicitação</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 px-2.5 py-1 rounded-lg">
                    Canal Mensagem Ativo
                  </span>
                </div>
              ) : activeEmailTemplate.id === "aniversario_condomino" ? (
                <div className="p-2.5 bg-gradient-to-r from-amber-50 to-emerald-50 dark:from-amber-950/20 dark:to-emerald-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-white block flex items-center gap-1.5">
                        Cartão Postal Visual Embebido no E-mail
                        <span className="text-[9px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold uppercase">Personalizado & Intimista</span>
                      </span>
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold">
                        Sem texto burocrático de e-mail • Inclui anexo PDF A5 de alta resolução para guardar
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDescarregarAnexoEmail("aniversario_condomino")}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
                  >
                    <Download className="h-3 w-3" />
                    <span>Baixar PDF A5</span>
                  </button>
                </div>
              ) : (
                <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 bg-red-500/10 text-red-500 rounded-lg">
                      <Paperclip className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-white block">
                        {activeEmailTemplate.anexoSimulado}
                      </span>
                      <span className="text-[9px] text-slate-400 uppercase font-semibold">Documento Oficial CondoManager AI</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDescarregarAnexoEmail(activeEmailTemplate.id)}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 transition-colors flex items-center space-x-1 cursor-pointer"
                  >
                    <Download className="h-3 w-3" />
                    <span>Descarregar Anexo</span>
                  </button>
                </div>
              )}

              {/* CORPO DO E-MAIL: NO CASO DO ANIVERSÁRIO, O POSTAL VISUAL É O PRÓPRIO CORPO DO EMAIL */}
              {activeEmailTemplate.id === "aniversario_condomino" ? (
                <div className="bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 rounded-2xl flex flex-col items-center">
                  {/* Postal com Moldura Dupla Oficial do Anexo */}
                  <div className="w-full max-w-xl bg-white border-2 border-slate-850 shadow-xl p-2.5 relative">
                    <div className="border border-sky-600 p-6 sm:p-8 relative text-center space-y-4">
                      {/* 4 Pontos de Canto Decorativos Oficiais */}
                      <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-sky-600 rounded-full"></div>
                      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-sky-600 rounded-full"></div>
                      <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-sky-600 rounded-full"></div>
                      <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-sky-600 rounded-full"></div>

                      {/* Topo: Nome do Edifício */}
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wider">
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
                        <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                          FELIZ ANIVERSÁRIO!
                        </h3>
                        <p className="text-[11px] sm:text-xs text-slate-600">
                          Hoje é um dia de celebração muito especial para a nossa comunidade
                        </p>
                      </div>

                      {/* Caixa de Destinatário */}
                      <div className="inline-block px-8 py-2.5 bg-sky-50 border border-sky-600 rounded-lg text-sm sm:text-base font-bold text-slate-900 shadow-xs">
                        Exmo.(a) Sr.(a) {testEmailRecipient.split("@")[0] ? "Ana Silva" : "Ana Silva"},
                      </div>

                      {/* Mensagem de Votos e Cordialidade */}
                      <div className="text-xs sm:text-sm text-slate-800 space-y-2.5 max-w-lg mx-auto leading-relaxed">
                        <p>
                          A Administração e a equipa do <strong>{predio.nome || "Condomínio Edifício Estrela da Barra"}</strong> têm o enorme gosto de lhe desejar um Feliz Aniversário, com muita saúde, alegria e realizações pessoais junto de quem mais estima.
                        </p>
                        <p>
                          Agradecemos o seu contributo diário para a harmonia e bom convívio no nosso edifício.
                        </p>
                      </div>

                      {/* Destaque Parabéns */}
                      <div className="text-sm sm:text-base font-bold text-sky-600 pt-1">
                        Parabéns pelo seu dia!
                      </div>

                      {/* Badge Selo Decorativo */}
                      <div className="inline-block px-4 py-1 bg-slate-100 border border-sky-200 rounded text-[10px] font-bold text-sky-600 uppercase tracking-widest">
                        VOTOS DE FELICIDADES & HARMONIA
                      </div>

                      {/* Despedida e Assinatura */}
                      <div className="pt-2 space-y-1 text-center">
                        <p className="text-xs text-slate-500">Com as mais calorosas saudações,</p>
                        <p className="text-xs sm:text-sm font-bold text-slate-900">José Carlos Guerra</p>
                        <p className="text-xs text-slate-600">A Administração do {predio.nome || "Edifício Estrela da Barra"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Ação de Descarregar Postal PDF */}
                  <div className="pt-4 flex justify-center">
                    <button
                      onClick={() => handleDescarregarAnexoEmail("aniversario_condomino")}
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center space-x-2 cursor-pointer hover:scale-105"
                    >
                      <Download className="h-4 w-4" />
                      <span>Descarregar Postal Oficial (PDF A5)</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* CORPO DO EMAIL TRADICIONAL */
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed font-sans shadow-2xs">
                  {activeEmailTemplate.corpoTexto}
                </div>
              )}
            </div>

            {/* BOTÕES DE AÇÃO RÁPIDA */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                <span>Gatilho: {activeEmailTemplate.gatilho}</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Assunto: ${activeEmailTemplate.assunto}\n\n${activeEmailTemplate.corpoTexto}`
                    );
                    setCopySuccess("Conteúdo do e-mail copiado!");
                    setTimeout(() => setCopySuccess(null), 2000);
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all flex items-center space-x-1 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copiar Texto</span>
                </button>

                <button
                  onClick={() => handleDispararEmailSimulado(activeEmailTemplate.titulo)}
                  className="px-4 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Testar Envio</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
