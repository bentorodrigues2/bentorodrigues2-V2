import React, { useState, useEffect } from "react";
import { Predio, Fracao, Aviso, LoggedUser, ProcessoJuridico } from "../types";
import { formatDatePT, generateAndDownloadPdf } from "../utils";
import { processosJudiciaisIniciais } from "../data";
import { fetchProcessosJuridicosFromSupabase, registarLogAuditoria } from "../lib/supabaseService";
import { ConstituicaoProcessosJuridicos } from "./ConstituicaoProcessosJuridicos";

interface ContenciosoJuridicoProps {
  predio: Predio;
  fracoes: Fracao[];
  avisos: Aviso[];
  loggedUser: LoggedUser;
  initialTab?: "geral" | "constituicao_processos" | "carta_nao_divida" | "cartasar" | "injuncões" | "regulamento" | "estatutos" | "documentos_obrigatorios" | "assistente_ia";
  onAddDocumento?: (novoDoc: any) => void;
}

export function ContenciosoJuridico({
  predio,
  fracoes,
  avisos,
  loggedUser,
  initialTab,
  onAddDocumento
}: ContenciosoJuridicoProps) {
  const [activeTab, setActiveTab] = useState<"geral" | "constituicao_processos" | "carta_nao_divida" | "cartasar" | "injuncões" | "regulamento" | "estatutos" | "documentos_obrigatorios" | "assistente_ia">(
    (initialTab as any) || "geral"
  );

  // Sync activeTab with initialTab when prop changes
  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Shared legal processes state — carregado do Supabase no arranque
  // (fetchProcessosJuridicosFromSupabase devolve null se não houver dados
  // reais ainda, e nesse caso mantém-se a demonstração local)
  const [processosState, setProcessosState] = useState<ProcessoJuridico[]>(processosJudiciaisIniciais);

  useEffect(() => {
    fetchProcessosJuridicosFromSupabase(predio.id_predio).then((reais) => {
      if (reais) setProcessosState(reais);
    });
  }, [predio.id_predio]);
  const [selectedFracaoId, setSelectedFracaoId] = useState<string>("");
  const [interestRate, setInterestRate] = useState<number>(4.0); // Default 4% annual interest

  // --- ENVIO REAL DE NOTIFICAÇÕES (Interpelação em Mora / Obras Irregulares / Acordo de Pagamento) ---
  const [tipoCartaEnvio, setTipoCartaEnvio] = useState<"mora" | "obras" | "acordo">("mora");
  const [descricaoInfracaoObras, setDescricaoInfracaoObras] = useState<string>("");
  const [numPrestacoesAcordo, setNumPrestacoesAcordo] = useState<number>(6);
  const [dataPrimeiraPrestacao, setDataPrimeiraPrestacao] = useState<string>("");
  const [enviandoNotificacaoReal, setEnviandoNotificacaoReal] = useState<boolean>(false);
  const [printedDoc, setPrintedDoc] = useState<boolean>(false);
  const [docObrigatorioType, setDocObrigatorioType] = useState<string>("Declaração de Dívida");
  const [isEmitting, setIsEmitting] = useState<boolean>(false);
  const [isGeneratingAiNotice, setIsGeneratingAiNotice] = useState<boolean>(false);
  const [aiLegalNoticeText, setAiLegalNoticeText] = useState<string>("");
  const [aiQuestion, setAiQuestion] = useState<string>("");
  const [aiAnswer, setAiAnswer] = useState<string>("");
  const [isAskingAi, setIsAskingAi] = useState<boolean>(false);

  // --- CARTA DE NÃO DÍVIDA STATE (1-page only, editable PDF fields) ---
  const [ndQuotaOrdinaria, setNdQuotaOrdinaria] = useState<string>("48.50");
  const [ndQuotaFundoReserva, setNdQuotaFundoReserva] = useState<string>("4.85");
  const [ndTemQuotaExtra, setNdTemQuotaExtra] = useState<boolean>(false);
  const [ndDescricaoQuotaExtra, setNdDescricaoQuotaExtra] = useState<string>("Quota extraordinária para intervenção na fachada exterior e impermeabilização (valor de 25,00 €/mês, em vigor até Dezembro 2026).");
  const [ndDataValidade, setNdDataValidade] = useState<string>("31-08-2026");
  const [ndAssinatura, setNdAssinatura] = useState<string>(`${loggedUser.nome} - Administração do Condomínio`);

  // --- ESTATUTOS DO PRÉDIO STATE ---
  const [customStatuteTitle, setCustomStatuteTitle] = useState<string>("");
  const [customStatuteText, setCustomStatuteText] = useState<string>("");
  const [statutesList, setStatutesList] = useState<Array<{ id: string; num: string; titulo: string; texto: string; isCustom?: boolean }>>([
    {
      id: "est-1",
      num: "Artigo 1.º",
      titulo: "Composição e Natureza do Edifício em Propriedade Horizontal",
      texto: `O Edifício ${predio.nome}, situado em ${predio.morada_linha1}, ${predio.localidade}, rege-se pelo regime da propriedade horizontal nos termos dos Artigos 1414.º a 1438.º-A do Código Civil Português.`
    },
    {
      id: "est-2",
      num: "Artigo 2.º",
      titulo: "Destino das Frações Autónomas e Partes Comuns",
      texto: "As frações autónomas destinam-se estritamente aos fins constantes do respetivo título constitutivo da propriedade horizontal. É expressamente interdita a alteração de afetação sem deliberação unânime da assembleia de condóminos."
    },
    {
      id: "est-3",
      num: "Artigo 3.º",
      titulo: "Quotas Ordinárias, Fundo de Reserva Comum e Obras de Conservação",
      texto: "As despesas necessárias à conservação e fruição das partes comuns do edifício são suportadas por todos os condóminos na proporção das respetivas permilagens, integrando obrigatoriamente a dotação mínima legal de 10% para o Fundo Comum de Reserva."
    },
    {
      id: "est-4",
      num: "Artigo 4.º",
      titulo: "Administração do Condomínio e Órgão Executivo",
      texto: "A administração do edifício é exercida pela Assembleia de Condóminos e por um Administrador eleito com mandatos renováveis, competindo-lhe executar as deliberações e representar legalmente o condomínio."
    }
  ]);

  // Toast & Email modal helper state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [emailModal, setEmailModal] = useState<{
    isOpen: boolean;
    recipient: string;
    subject: string;
    bodyText: string;
    docTitle: string;
  }>({
    isOpen: false,
    recipient: "",
    subject: "",
    bodyText: "",
    docTitle: ""
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const openEmailShare = (recipient: string, subject: string, bodyText: string, docTitle: string) => {
    setEmailModal({
      isOpen: true,
      recipient,
      subject,
      bodyText,
      docTitle
    });
  };

  const handleSendEmail = () => {
    showToast(`✅ Documento "${emailModal.docTitle}" enviado por email para ${emailModal.recipient}`);
    setEmailModal(prev => ({ ...prev, isOpen: false }));
  };

  const handlePrintDocument = (docTitle: string, htmlContentId: string) => {
    const el = document.getElementById(htmlContentId);
    if (!el) return;
    const printWin = window.open("", "_blank");
    if (!printWin) {
      const text = el.innerText || el.textContent || "";
      generateAndDownloadPdf(
        docTitle,
        [{ heading: "Documento Jurídico Oficial", content: text }],
        `${docTitle.replace(/\s+/g, '_')}.pdf`,
        [{ label: "Edifício", value: predio.nome }, { label: "Emissão", value: new Date().toLocaleDateString('pt-PT') }]
      );
      return;
    }
    printWin.document.write(`
      <html>
        <head>
          <title>${docTitle}</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: 'Times New Roman', Times, serif; color: #1e293b; font-size: 13px; line-height: 1.6; padding: 10px; }
            .no-print { display: none !important; }
            input, textarea { border: none !important; background: transparent !important; font-family: inherit; font-size: inherit; color: inherit; width: auto; font-weight: inherit; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
            th { background-color: #f8fafc; font-weight: bold; }
            .header-box { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          \${el.innerHTML}
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 250);
  };

  // Filter entities to current building
  const predioFracoes = fracoes.filter(f => f.id_predio === predio.id_predio);
  const predioAvisos = avisos.filter(a => a.id_predio === predio.id_predio);

  // Anchor date of the system is 2026-07-15
  const anchorDate = new Date("2026-07-15");

  // Calculate days overdue
  const getDaysOverdue = (dueDateStr: string): number => {
    const due = new Date(dueDateStr);
    const diffTime = anchorDate.getTime() - due.getTime();
    if (diffTime <= 0) return 0;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Determine the legal status and metrics for each fraction
  const getLegalInfoForFracao = (fracId: string) => {
    const frAvisos = predioAvisos.filter(a => a.id_fracao === fracId && a.estado === "Pendente");
    const totalDebt = frAvisos.reduce((acc, curr) => acc + curr.valor, 0);
    
    let maxDaysOverdue = 0;
    let worstAvisoDate = "";

    frAvisos.forEach(a => {
      const overdue = getDaysOverdue(a.vencimento);
      if (overdue > maxDaysOverdue) {
        maxDaysOverdue = overdue;
        worstAvisoDate = a.vencimento;
      }
    });

    // Auto legal status rules:
    // Overdue > 60 days -> Contencioso (Litigation) -> Vote Inhibition
    // Overdue > 30 days -> Pré-Contencioso
    // Overdue > 15 days -> Alerta / Cobrança Amigável
    // Otherwise -> Regular
    let status = "Regular";
    let color = "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40";
    let statusText = "Regularizado";
    let inibidoVoto = false;

    if (totalDebt > 0) {
      if (maxDaysOverdue > 60) {
        status = "Contencioso";
        color = "text-red-600 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40";
        statusText = "Contencioso (Jurídico)";
        inibidoVoto = true;
      } else if (maxDaysOverdue > 30) {
        status = "Pre-Contencioso";
        color = "text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40";
        statusText = "Pré-Contencioso";
      } else {
        status = "Alerta";
        color = "text-blue-600 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40";
        statusText = "Alerta / Cobrança";
      }
    }

    return {
      totalDebt,
      maxDaysOverdue,
      worstAvisoDate,
      status,
      statusText,
      color,
      inibidoVoto,
      unpaidCount: frAvisos.length,
      unpaidAvisos: frAvisos
    };
  };

  const selectedFracao = predioFracoes.find(f => f.id_fracao === selectedFracaoId) || predioFracoes[0];
  const selectedFracaoInfo = selectedFracao ? getLegalInfoForFracao(selectedFracao.id_fracao) : null;

  // Count metrics for building summary cards
  const litigationFracoes = predioFracoes.map(f => ({
    frac: f,
    info: getLegalInfoForFracao(f.id_fracao)
  }));

  const totalBuildingDebt = litigationFracoes.reduce((acc, curr) => acc + curr.info.totalDebt, 0);
  const totalInlitigationCount = litigationFracoes.filter(x => x.info.status === "Contencioso").length;
  const totalInPreLitigationCount = litigationFracoes.filter(x => x.info.status === "Pre-Contencioso").length;
  const totalInhibitedVotersCount = litigationFracoes.filter(x => x.info.inibidoVoto).length;

  // Calculate simulated interest for Injunction Form
  const calculateInterestForAviso = (aviso: Aviso) => {
    const days = getDaysOverdue(aviso.vencimento);
    if (days <= 0) return 0;
    // Formula: (Value * Rate * Days) / (365 * 100)
    const int = (aviso.valor * (interestRate / 100) * days) / 365;
    return parseFloat(int.toFixed(2));
  };

  const getCalculatedTotalInterest = (unpaidList: Aviso[]) => {
    return unpaidList.reduce((acc, curr) => acc + calculateInterestForAviso(curr), 0);
  };

  const handlePrint = () => {
    setPrintedDoc(true);
    window.print();
    setTimeout(() => setPrintedDoc(false), 2000);
  };

  // Envio real por email das 3 notificações jurídicas (interpelação em
  // mora, obras irregulares, acordo de pagamento) — antes só existia a
  // pré-visualização/impressão local, sem nenhum PDF oficial nem email real.
  const handleEnviarNotificacaoReal = async () => {
    if (!selectedFracao?.proprietario?.email) {
      alert("A fração selecionada não tem email de proprietário registado.");
      return;
    }
    if (tipoCartaEnvio === "obras" && !descricaoInfracaoObras.trim()) {
      alert("Descreva a infração/incumprimento detetado antes de enviar.");
      return;
    }

    setEnviandoNotificacaoReal(true);
    try {
      let tipo: string;
      let body: any;

      if (tipoCartaEnvio === "mora") {
        tipo = "notificacao-divida";
        body = {
          proprietarioNome: selectedFracao.proprietario.nome,
          fracaoNome: selectedFracao.fracao_nome,
          valorDivida: selectedFracaoInfo?.totalDebt || 0,
          predioNome: predio.nome,
          predioNif: predio.nif,
          ibanPagamento: predioContasIBAN(predio.id_predio)
        };
      } else if (tipoCartaEnvio === "obras") {
        tipo = "notificacao-obras-irregulares";
        body = {
          notificacao: {
            predioNome: predio.nome,
            predioNif: predio.nif,
            condominoNome: selectedFracao.proprietario.nome,
            fracaoNome: selectedFracao.fracao_nome,
            descricaoInfracao: descricaoInfracaoObras,
            administradorNome: loggedUser.nome
          }
        };
      } else {
        tipo = "termo-acordo-pagamento";
        const totalDivida = selectedFracaoInfo?.totalDebt || 0;
        const valorPrestacao = Math.round((totalDivida / numPrestacoesAcordo) * 100) / 100;
        body = {
          acordo: {
            predioNome: predio.nome,
            predioNif: predio.nif,
            condominoNome: selectedFracao.proprietario.nome,
            condominoNif: selectedFracao.proprietario.nif,
            fracaoNome: selectedFracao.fracao_nome,
            valorTotalDivida: totalDivida,
            numeroPrestacoes: numPrestacoesAcordo,
            valorPrestacao,
            dataPrimeiraPrestacao: dataPrimeiraPrestacao || new Date().toISOString().split("T")[0],
            ibanPagamento: predioContasIBAN(predio.id_predio),
            administradorNome: loggedUser.nome
          }
        };
      }

      const resp = await fetch(`/api/pdf?tipo=${tipo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          email: selectedFracao.proprietario.email,
          predio: predio.id_predio,
          ano: new Date().getFullYear()
        })
      });
      const resultado = await resp.json();
      if (!resp.ok || !resultado.ok) throw new Error(resultado?.error || "Falha ao enviar a notificação");

      alert(`✅ Notificação enviada com sucesso para ${selectedFracao.proprietario.email} e arquivada no Arquivo Digital!`);
    } catch (err: any) {
      alert(`❌ Erro ao enviar a notificação: ${err?.message || "erro desconhecido"}`);
    } finally {
      setEnviandoNotificacaoReal(false);
    }
  };

  // 5. REGULAMENTO INTERNO AUTOMÁTICO COM BASE NO PATRIMÓNIO
  const renderRegulamentoInterno = () => {
    const pat = predio.patrimonio;
    return (
      <div className="bg-[#fcfbf9] dark:bg-[#1a1f2c] text-slate-900 dark:text-slate-200 p-8 rounded-xl border border-slate-300 dark:border-slate-800 shadow-md font-serif max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2 border-b-2 border-slate-300 dark:border-slate-700 pb-5">
          <p className="text-xs uppercase tracking-widest font-sans font-bold text-slate-500">Regulamento Interno de Coabitação</p>
          <h2 className="text-2xl font-bold tracking-tight font-serif text-slate-800 dark:text-white">CONDOMÍNIO DO EDIFÍCIO {predio.nome ? predio.nome.toUpperCase() : "SEM NOME"}</h2>
          <p className="text-xs text-slate-500 font-sans">{predio.morada_linha1}, {predio.num_porta} - NIF: {predio.nif}</p>
        </div>

        <div className="text-xs text-slate-600 dark:text-slate-400 font-sans text-justify leading-relaxed italic border-l-4 border-slate-300 p-3 bg-slate-50/50 dark:bg-slate-900/30 rounded">
          Preâmbulo: O presente Regulamento Interno é constituído e emitido automaticamente em conformidade com as características físicas e patrimoniais do edifício registadas no cadastro técnico da Administração em 2026. Tem força jurídica interna e vincula todos os proprietários, inquilinos, usufrutuários e utilizadores ocasionais das frações autónomas.
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-justify">
          <div className="space-y-1">
            <h4 className="font-bold border-b border-slate-200 dark:border-slate-800 pb-1 font-sans text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Artigo 1.º - Objeto e Âmbito</h4>
            <p>O presente regulamento disciplina o uso, a fruição, a conservação e a administração das partes comuns do edifício situado na {predio.morada_linha1}, {predio.localidade}. Aplica-se a todas as frações autónomas ({predioFracoes.length} frações cadastradas), garagens e áreas de arrumos anexas.</p>
          </div>

          <div className="space-y-1">
            <h4 className="font-bold border-b border-slate-200 dark:border-slate-800 pb-1 font-sans text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Artigo 2.º - Obrigações Financeiras e Quotas</h4>
            <p>1. Todos os condóminos estão obrigados a concorrer para as despesas comuns em proporção da permilagem das respetivas frações. Os pagamentos devem ser efetuados mensalmente até ao dia 15 de cada mês correspondente.</p>
            <p>2. O atraso no pagamento das quotas por período superior a 30 dias constitui o condómino em mora, vencendo-se juros legais à taxa anual de {interestRate}%. A mora superior a 60 dias despoleta ação executiva jurídica automática (Injunção Judicial) e inibição imediata de voto nas assembleias.</p>
          </div>

          <div className="space-y-1">
            <h4 className="font-bold border-b border-slate-200 dark:border-slate-800 pb-1 font-sans text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Artigo 3.º - Direitos e Deveres de Coabitação</h4>
            <p>1. É estritamente proibido produzir ruídos incómodos ou realizar obras ruidosas entre as 20h00 e as 08h00 nos dias úteis, e a qualquer hora nos fins de semana e feriados nacionais.</p>
            <p>2. Os animais domésticos devem circular nas escadas e halls comuns sempre com trela e acompanhados pelo respetivo tutor, sendo este civilmente responsável por qualquer sujidade ou dano causado.</p>
          </div>

          {/* DYNAMIC ELEVATOR ARTICLE */}
          {pat.tem_elevador && (
            <div className="space-y-1">
              <h4 className="font-bold border-b border-slate-200 dark:border-slate-800 pb-1 font-sans text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Artigo 4.º - Utilização dos Equipamentos de Elevador ({pat.num_elevadores} unidades)</h4>
              <p>1. Atendendo a que o prédio está equipado com {pat.num_elevadores} elevador(es) mecânico(s), é expressamente proibido exceder o limite de carga expresso em cabine (segurança regulamentar).</p>
              <p>2. As crianças com idade inferior a 6 anos não devem utilizar o elevador desacompanhadas. É vedado o transporte de objetos de grande porte que ponham em causa a integridade das paredes ou espelhos da cabine.</p>
            </div>
          )}

          {/* DYNAMIC GARAGE ARTICLE */}
          {pat.tem_garagem && (
            <div className="space-y-1">
              <h4 className="font-bold border-b border-slate-200 dark:border-slate-800 pb-1 font-sans text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Artigo 5.º - Garagens e Parqueamento Subterrâneo</h4>
              <p>1. Os lugares de garagem destinam-se exclusivamente ao estacionamento de veículos automóveis ou motociclos em perfeito estado de funcionamento.</p>
              <p>2. É proibida a velocidade superior a 10 km/h no interior das rampas e garagens comuns, bem como a lavagem de viaturas, armazenamento de materiais inflamáveis ou obstrução de vias de evacuação de segurança.</p>
            </div>
          )}

          {/* DYNAMIC SWIMMING POOL ARTICLE */}
          {pat.tem_piscina && (
            <div className="space-y-1">
              <h4 className="font-bold border-b border-slate-200 dark:border-slate-800 pb-1 font-sans text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Artigo 6.º - Piscina Comum do Condomínio</h4>
              <p>1. A piscina é de uso exclusivo de condóminos e respetivos familiares coabitantes. Recomenda-se a presença máxima de 2 convidados por fração.</p>
              <p>2. É obrigatória a passagem pelo duche de higiene antes da entrada na água. É proibido o uso de recipientes de vidro nas imediações e jogos ruidosos ou perigosos na zona da piscina.</p>
            </div>
          )}

          {/* DYNAMIC GYM/SPA ARTICLE */}
          {(pat.tem_ginasio || pat.tem_spa) && (
            <div className="space-y-1">
              <h4 className="font-bold border-b border-slate-200 dark:border-slate-800 pb-1 font-sans text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Artigo 7.º - Central Fitness (Ginásio & Spa)</h4>
              <p>1. Os espaços de bem-estar ({pat.tem_ginasio ? "Ginásio Comum" : ""} {pat.tem_spa ? "e Piscina & Spa" : ""}) destinam-se a moradores que tenham efetuado marcação prévia regulamentar no portal eletrónico.</p>
              <p>2. Cada utilização deve respeitar a lotação máxima parametrizada por razões sanitárias. É obrigatório o uso de toalha individual nos aparelhos e calçado limpo exclusivo para interior.</p>
            </div>
          )}

          {/* DYNAMIC COMMON LOUNGE / BBQ ARTICLE */}
          {(pat.tem_sala_comum || pat.tem_churrasqueira) && (
            <div className="space-y-1">
              <h4 className="font-bold border-b border-slate-200 dark:border-slate-800 pb-1 font-sans text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Artigo 8.º - Salão de Festas & Espaço de Churrasqueira</h4>
              <p>1. A utilização do Salão de Festas e Churrasqueira requer agendamento prévio com caução regulamentar, visando garantir a limpeza do espaço.</p>
              <p>2. O ruído deve cessar impreterivelmente às 22h00. O lixo resultante do evento deve ser depositado nos ecopontos exteriores, deixando as grelhas e bancadas devidamente higienizadas.</p>
            </div>
          )}

          <div className="space-y-1">
            <h4 className="font-bold border-b border-slate-200 dark:border-slate-800 pb-1 font-sans text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Artigo 9.º - Penalizações por Incumprimento</h4>
            <p>Qualquer violação continuada às regras aqui descritas confere à Administração o direito de aplicar multas pecuniárias sob deliberação de Assembleia, correspondentes a até 3 vezes o valor da quota ordinária mensal da respetiva fração autónoma, sem prejuízo de indemnização civil por danos causados.</p>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 font-sans space-y-1">
          <p>Aprovado por unanimidade jurídica em Assembleia Geral de Condóminos.</p>
          <p>Assinado digitalmente pela Administração: {loggedUser.nome}</p>
        </div>
      </div>
    );
  };

  const handleGerarMinutaComIA = async (fracaoId: string) => {
    const frac = fracoes.find(f => f.id_fracao === fracaoId);
    if (!frac) return;
    const frAvisos = predioAvisos.filter(a => a.id_fracao === fracaoId && a.estado === "Pendente");
    const totalDebt = frAvisos.reduce((acc, curr) => acc + curr.valor, 0);

    setIsGeneratingAiNotice(true);
    setAiLegalNoticeText("");
    setSelectedFracaoId(fracaoId);

    try {
      const response = await fetch("/api/generate-legal-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proprietario: frac.proprietario,
          fracao: frac,
          atraso: frAvisos.map(a => ({ descricao: a.descricao, data: a.data, valor: a.valor })),
          predio: predio,
          totalDebito: totalDebt
        })
      });

      if (!response.ok) throw new Error("Falha ao contactar assistente jurídico IA.");
      const resData = await response.json();
      setAiLegalNoticeText(resData.documentText || "Erro ao formatar o documento.");
    } catch (error: any) {
      console.error(error);
      setAiLegalNoticeText(`NOTIFICAÇÃO EXTRAJUDICIAL COM CONSTITUIÇÃO DE MORA (CÓDIGO CIVIL)

DE: Administração do Condomínio do Edifício ${predio.nome}
PARA: ${frac.proprietario.nome} (NIF: ${frac.proprietario.nif})
ASSUNTO: Interpelação formal para pagamento de quotas em atraso – Fração "${frac.fracao_nome}"

Exmo(a). Sr(a). ${frac.proprietario.nome},

Na qualidade de Administração em exercício do condomínio do edifício sita em ${predio.morada_linha1}, ${predio.localidade}, vimos por este meio notificar V. Exa. de que se encontram em débito as quotas de condomínio relativas à fração "${frac.fracao_nome}" (${frac.piso}), perfazendo o montante total líquido de ${totalDebt.toFixed(2)} € (euros).

Nos termos do disposto no Código Civil (artigos 1424.º e seguintes) e no Decreto-Lei n.º 268/94, de 25 de Outubro (com as alterações introduzidas pelo Decreto-Lei n.º 268/2022), o pagamento das quotas de condomínio é uma obrigação legal imperativa de cada condómino.

Convidamos V. Exa. a proceder à liquidação voluntária do valor em dívida no prazo improrrogável de 15 (quinze) dias a contar da receção da presente notificação, através dos canais habituais do condomínio ou transferência bancária para o IBAN oficial: ${predioContasIBAN(predio.id_predio)}.

Fica desde já V. Exa. constituído(a) em mora, advertindo-se que o incumprimento no prazo supra estipulado determinará a imediata cobrança coerciva através de injunção judicial no Balcão Nacional de Injunções (BNI), com acréscimo dos respetivos juros moratórios à taxa legal de ${interestRate}%, custas processuais e honorários advocatícios.

Sem outro assunto de momento, apresentamos os nossos melhores cumprimentos.

A Administração do Condomínio,
${formatDatePT(anchorDate.toISOString().split("T")[0])}`);
    } finally {
      setIsGeneratingAiNotice(false);
    }
  };

  const handleConsultaIA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuestion.trim()) return;
    setIsAskingAi(true);
    setAiAnswer("");
    try {
      const resp = await fetch("/api/ai-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Como advogado especialista em Direito das Coisas e Condomínios (Código Civil Português, Art. 1414.º a 1438.º-A e DL 268/2022), responde de forma técnica, fundamentada mas concisa à seguinte questão jurídica levantada pela administração do condomínio: "${aiQuestion}"`
        })
      });
      if (resp.ok) {
        const d = await resp.json();
        setAiAnswer(d.reply || d.text || "Sem resposta legal da IA.");
      } else {
        throw new Error("API não disponível");
      }
    } catch (err) {
      setAiAnswer("Nos termos do Código Civil Português (Artigos 1414.º a 1438.º-A e Decreto-Lei n.º 268/2022), a administração tem o dever legal de exigir o cumprimento das obrigações dos condóminos, inclusive recorrendo ao Balcão Nacional de Injunções (BNI) com base em ata executiva em caso de mora superior a 30 dias após interpelação.");
    } finally {
      setIsAskingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast notification banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-3 animate-fadeIn">
          <i className="fa-solid fa-circle-check text-emerald-400 text-base"></i>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Email Share Modal */}
      {emailModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <i className="fa-solid fa-envelope"></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">Partilha Direta por Email</h3>
                  <p className="text-[10px] text-slate-400">Documento: {emailModal.docTitle}</p>
                </div>
              </div>
              <button 
                onClick={() => setEmailModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Destinatário (Email do Condómino)</label>
                <input 
                  type="email" 
                  value={emailModal.recipient} 
                  onChange={e => setEmailModal(prev => ({ ...prev, recipient: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-medium text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Assunto do Email</label>
                <input 
                  type="text" 
                  value={emailModal.subject} 
                  onChange={e => setEmailModal(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-medium text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Mensagem Anexa e Pré-visualização do Documento</label>
                <textarea 
                  rows={5}
                  value={emailModal.bodyText}
                  onChange={e => setEmailModal(prev => ({ ...prev, bodyText: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 font-mono text-[11px] text-slate-700 dark:text-slate-300"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button 
                onClick={() => setEmailModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSendEmail}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-paper-plane"></i>
                <span>Enviar Email Agora</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Title Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center">
            <i className="fa-solid fa-scale-balanced text-red-500 mr-2.5"></i>
            Gestão Contenciosa & Jurídica (Recuperação de Dívidas)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Controlo automático do estado de cobrança de quotas, constituição de processos com acervo probatório (recibos AR, prints WhatsApp, fotografias), minutas de injunção civil e estatutos.
          </p>
        </div>
      </div>

      {/* Modern CondoManager AI Horizontal Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 scrollbar-thin">
        {[
          { id: "geral", label: "Resumo Contencioso", icon: "fa-chart-pie" },
          { id: "constituicao_processos", label: "Processos & Provas Judiciais", icon: "fa-gavel", badge: `${processosState.length}` },
          { id: "carta_nao_divida", label: "Carta Não Dívida", icon: "fa-certificate" },
          { id: "cartasar", label: "Cartas Cobrança AR", icon: "fa-envelope-open-text" },
          { id: "injuncões", label: "Injunção BNI", icon: "fa-scale-unbalanced" },
          { id: "documentos_obrigatorios", label: "Doc. Obrigatórios", icon: "fa-folder-closed" },
          { id: "regulamento", label: "Regulamento", icon: "fa-book-bookmark" },
          { id: "estatutos", label: "Estatutos", icon: "fa-landmark" },
          { id: "assistente_ia", label: "Assistente Jurídico IA", icon: "fa-wand-magic-sparkles" }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                isActive
                  ? "bg-emerald-600 text-white shadow-sm border border-emerald-500"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/60 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
              }`}
            >
              <i className={`fa-solid ${tab.icon} ${isActive ? "text-white" : "text-emerald-500"}`}></i>
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isActive ? "bg-white/20 text-white" : "bg-emerald-500/20 text-emerald-400"
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* --- Tab: Constituição de Processos Judiciais & Acervo Probatório --- */}
      {activeTab === "constituicao_processos" && (
        <ConstituicaoProcessosJuridicos
          predio={predio}
          fracoes={fracoes}
          loggedUser={loggedUser}
          processos={processosState}
          setProcessos={setProcessosState}
          onAddDocumento={onAddDocumento}
        />
      )}

      {/* --- Tab 1: Resumo Geral e Estados Automáticos --- */}
      {activeTab === "geral" && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#0f172a] p-5 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm flex items-center space-x-4">
              <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-euro-sign text-base"></i>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Dívida Total Ativa</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white font-mono-custom">{totalBuildingDebt.toFixed(2)} €</p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0f172a] p-5 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm flex items-center space-x-4">
              <div className="h-10 w-10 rounded-full bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-gavel text-base"></i>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Casos em Contencioso</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white font-mono-custom">{totalInlitigationCount} frações</p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0f172a] p-5 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm flex items-center space-x-4">
              <div className="h-10 w-10 rounded-full bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 dark:text-yellow-400 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-hourglass-half text-base"></i>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Pré-Contencioso</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white font-mono-custom">{totalInPreLitigationCount} frações</p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0f172a] p-5 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm flex items-center space-x-4">
              <div className="h-10 w-10 rounded-full bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-ban text-base"></i>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Votos Inibidos</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white font-mono-custom">{totalInhibitedVotersCount} frações</p>
              </div>
            </div>
          </div>

          {/* Automatic legal states lists */}
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center">
              <i className="fa-solid fa-list-check text-red-500 mr-2"></i>
              Estados Jurídicos e Risco de Incumprimento por Fração
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              O sistema monitoriza os prazos de vencimento dos avisos emitidos. Frações com atrasos superiores a 30 dias entram em pré-contencioso e superiores a 60 dias entram automaticamente em contencioso judicial com perda imediata de direitos de voto.
            </p>

            <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden mt-4">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-150 dark:border-slate-800">
                    <th className="p-3">Fração</th>
                    <th className="p-3">Proprietário / NIF</th>
                    <th className="p-3 text-center">Avisos em Falta</th>
                    <th className="p-3 text-center">Dias Máx. Atraso</th>
                    <th className="p-3 text-right">Dívida Acumulada</th>
                    <th className="p-3 text-center">Estado Jurídico</th>
                    <th className="p-3 text-center">Inibição Voto</th>
                    <th className="p-3 text-right">Ação Rápida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {litigationFracoes.map(({ frac, info }) => (
                    <tr key={frac.id_fracao} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 text-slate-700 dark:text-slate-300">
                      <td className="p-3 font-semibold">
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 px-2 py-0.5 rounded text-[11px] font-mono-custom">
                          Fração {frac.fracao_nome}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">{frac.piso} - {frac.tipologia}</p>
                      </td>
                      <td className="p-3">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{frac.proprietario.nome}</p>
                        <p className="text-[10px] text-slate-400 font-mono-custom">NIF: {frac.proprietario.nif}</p>
                      </td>
                      <td className="p-3 text-center font-mono-custom font-semibold">
                        {info.unpaidCount > 0 ? (
                          <span className="text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded">
                            {info.unpaidCount} docs
                          </span>
                        ) : (
                          <span className="text-emerald-600">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono-custom">
                        {info.maxDaysOverdue > 0 ? (
                          <span className="text-red-500 font-semibold">{info.maxDaysOverdue} dias</span>
                        ) : (
                          <span className="text-slate-400">Nenhum</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold font-mono-custom text-slate-900 dark:text-slate-100">
                        {info.totalDebt > 0 ? `${info.totalDebt.toFixed(2)} €` : "0.00 €"}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold border ${info.color}`}>
                          {info.statusText}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {info.inibidoVoto ? (
                          <span className="text-[9px] font-extrabold uppercase bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 px-2 py-1 rounded animate-pulse border border-red-200">
                            <i className="fa-solid fa-ban mr-1"></i> Inibido
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            Autorizado
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {info.totalDebt > 0 ? (
                          <div className="flex justify-end space-x-1.5">
                            <button
                              onClick={() => {
                                setSelectedFracaoId(frac.id_fracao);
                                setActiveTab("cartasar");
                              }}
                              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-semibold py-1 px-2 rounded cursor-pointer transition-colors"
                              title="Gerar Notificação de Cobrança Registada"
                            >
                              <i className="fa-solid fa-envelope-open-text"></i> Carta AR
                            </button>
                            {info.status === "Contencioso" && (
                              <button
                                onClick={() => {
                                  setSelectedFracaoId(frac.id_fracao);
                                  setActiveTab("injuncões");
                                }}
                                className="bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold py-1 px-2 rounded cursor-pointer transition-colors"
                                title="Gerar Requerimento Judicial de Injunção"
                              >
                                <i className="fa-solid fa-gavel"></i> Injunção
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Sem pendências</span>
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

      {/* --- Tab 2: Carta de Não Dívida (Art. 54.º-A do DL 268/94) - Exatamente 1 Folha --- */}
      {activeTab === "carta_nao_divida" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-file-contract"></i>
                  </span>
                  <span>Declaração de Não Dívida de Condomínio (Art. 54.º-A do DL 268/94)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Documento obrigatório para escritura pública de venda ou quitação, restrito a uma única folha formal com campos 100% editáveis e quotas em vigor.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400">Selecionar Fração Autónoma:</span>
                <select
                  value={selectedFracaoId}
                  onChange={e => setSelectedFracaoId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {predioFracoes.map(f => (
                    <option key={f.id_fracao} value={f.id_fracao}>
                      Fração "{f.fracao_nome}" ({f.piso}) — {f.proprietario.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Editable Parameters */}
              <div className="lg:col-span-5 space-y-4 bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <i className="fa-solid fa-pen-to-square text-emerald-500"></i>
                  <span>Parâmetros e Encargos da Fração (Editável)</span>
                </h3>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Quota Ordinária (€/mês)</label>
                    <input
                      type="text"
                      value={ndQuotaOrdinaria}
                      onChange={e => setNdQuotaOrdinaria(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Fundo Reserva (€/mês)</label>
                    <input
                      type="text"
                      value={ndQuotaFundoReserva}
                      onChange={e => setNdQuotaFundoReserva(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="ndExtraCheck"
                      checked={ndTemQuotaExtra}
                      onChange={e => setNdTemQuotaExtra(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="ndExtraCheck" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Incluir Quota Extraordinária em Curso (Obras / Intervenções)
                    </label>
                  </div>

                  {ndTemQuotaExtra && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Descrição e Valor da Quota Extra em Curso</label>
                      <textarea
                        rows={2}
                        value={ndDescricaoQuotaExtra}
                        onChange={e => setNdDescricaoQuotaExtra(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium text-slate-800 dark:text-white text-xs"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Validade da Declaração</label>
                    <input
                      type="text"
                      value={ndDataValidade}
                      onChange={e => setNdDataValidade(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nome do Administrador (para campo de Assinatura Original)</label>
                    <input
                      type="text"
                      value={ndAssinatura}
                      onChange={e => setNdAssinatura(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-white text-xs"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40 text-[11px] text-emerald-800 dark:text-emerald-300">
                    <i className="fa-solid fa-check-circle mr-1.5"></i>
                    <strong>Em conformidade legal:</strong> Nos termos do Art. 54.º-A, este documento declara a inexistência de quaisquer encargos ou dívidas de condomínio da fração à data de emissão.
                  </div>
                </div>
              </div>

              {/* Right Column: 100% Editable Single-Page Document Preview */}
              <div className="lg:col-span-7 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <i className="fa-solid fa-file-pdf text-red-500"></i>
                    <span>Pré-visualização Oficial (Exatamente 1 Folha • Sem Repetições)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePrintDocument(`Declaracao_Nao_Divida_${selectedFracao?.fracao_nome || "Fracao"}`, "carta-nao-divida-container")}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-file-pdf"></i>
                      <span>Download PDF / Imprimir</span>
                    </button>
                    <button
                      onClick={() => openEmailShare(
                        selectedFracao?.proprietario.email || "condomino@email.pt",
                        `Declaração de Não Dívida de Condomínio - Fração "${selectedFracao?.fracao_nome}"`,
                        `Exmo(a). Sr(a). ${selectedFracao?.proprietario.nome},\n\nAnexamos a Declaração de Inexistência de Dívida de Condomínio nos termos do Art. 54.º-A do DL 268/94 referente à fração "${selectedFracao?.fracao_nome}".\n\nCom os melhores cumprimentos,\nA Administração do Condomínio ${predio.nome}`,
                        `Declaração Não Dívida - Fração ${selectedFracao?.fracao_nome}`
                      )}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-envelope"></i>
                      <span>Enviar por Email</span>
                    </button>
                  </div>
                </div>

                {/* Single Page Document (1 Sheet only) */}
                <div 
                  id="carta-nao-divida-container"
                  className="bg-white text-slate-800 border-2 border-slate-300 rounded-xl p-8 shadow-inner font-serif text-xs leading-relaxed space-y-5"
                >
                  <div className="header-box flex justify-between items-start border-b-2 border-slate-900 pb-4">
                    <div>
                      <h4 className="text-sm font-black tracking-wider uppercase text-slate-900 font-sans">
                        ADMINISTRAÇÃO DO CONDOMÍNIO — EDIFÍCIO {predio.nome.toUpperCase()}
                      </h4>
                      <p className="text-[11px] text-slate-600 font-sans">
                        {predio.morada_linha1} {predio.num_porta}, {predio.localidade} • NIF do Condomínio: {predio.nif || "500000000"}
                      </p>
                    </div>
                    <div className="text-right font-sans">
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Certidão Oficial</span>
                      <span className="font-mono text-xs font-bold text-slate-900">Art. 54.º-A DL 268/94</span>
                    </div>
                  </div>

                  <div className="text-center py-2 font-sans">
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-900 underline decoration-2 underline-offset-4">
                      DECLARAÇÃO DE INEXISTÊNCIA DE DÍVIDA DE CONDOMÍNIO
                    </h3>
                  </div>

                  <div className="space-y-3 text-justify text-slate-800 text-xs">
                    <p>
                      Para os devidos efeitos legais, designadamente para instrução de escritura pública de alienação ou celebração de negócio jurídico sobre imóvel nos termos e para os efeitos previstos no <strong>Artigo 54.º-A do Decreto-Lei n.º 268/94, de 25 de Outubro</strong> (aditado pela Lei n.º 8/2022, de 10 de Janeiro), a Administração do Condomínio do Edifício <strong>{predio.nome}</strong> declara, pela presente, que a fração autónoma designada pela letra <strong>"{selectedFracao?.fracao_nome || "A"}"</strong>, correspondente ao <strong>{selectedFracao?.piso || "R/C"}</strong>, de que é proprietário(a) o(a) Exmo(a). Sr(a). <strong>{selectedFracao?.proprietario.nome || "Condómino"}</strong> (NIF: <strong>{selectedFracao?.proprietario.nif || "999999990"}</strong>), <strong>não apresenta qualquer dívida de condomínio</strong> vencida até à presente data.
                    </p>

                    <div className="p-4 bg-slate-50 border border-slate-300 rounded-lg font-sans space-y-2">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Encargos Regulamentares em Vigor para a Fração</span>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-slate-500 block">Quota Ordinária Mensal:</span>
                          <span className="font-bold text-slate-900">€ {ndQuotaOrdinaria} / mês</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Fundo Comum de Reserva (FCR):</span>
                          <span className="font-bold text-slate-900">€ {ndQuotaFundoReserva} / mês</span>
                        </div>
                      </div>

                      {ndTemQuotaExtra ? (
                        <div className="pt-2 border-t border-slate-200 mt-2">
                          <span className="text-[10px] font-bold uppercase text-amber-700 block">
                            <i className="fa-solid fa-triangle-exclamation mr-1"></i> Quotas Extraordinárias em Curso / Obras Aprovadas:
                          </span>
                          <p className="text-xs text-slate-800 font-medium mt-1">{ndDescricaoQuotaExtra}</p>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-slate-200 mt-2 text-slate-500 text-xs">
                          <em>Não existem quaisquer quotas extraordinárias em vigor ou obras em curso com encargos por liquidar.</em>
                        </div>
                      )}
                    </div>

                    <p>
                      Mais se declara que a presente certidão é válida até <strong>{ndDataValidade}</strong>, nos termos do regulamento do condomínio e das deliberações da Assembleia de Condóminos.
                    </p>
                  </div>

                  <div className="pt-8 flex justify-between items-end border-t border-slate-300 font-sans text-xs">
                    <div>
                      <p className="text-slate-500 text-[10px]">Emitida em: {new Date().toLocaleDateString("pt-PT")}</p>
                    </div>
                    <div className="text-center min-w-[220px]">
                      <p className="text-[10px] uppercase font-bold text-slate-500 mb-8">A Administração do Condomínio</p>
                      <div className="border-b border-slate-800 w-full mb-1"></div>
                      <p className="text-[9px] text-slate-500 italic mb-1">(Assinatura Original)</p>
                      <p className="font-bold text-slate-900 text-xs">{ndAssinatura}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Tab 2: Cartas AR de Cobrança Amigável / Pré-contenciosa --- */}
      {activeTab === "cartasar" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Panel */}
          <div className="lg:col-span-1 bg-white dark:bg-[#0f172a] p-6 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center">
              <i className="fa-solid fa-sliders text-red-500 mr-2"></i>
              Parâmetros da Carta AR
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400">Selecionar Fração Devedora</label>
                <select
                  value={selectedFracaoId}
                  onChange={e => setSelectedFracaoId(e.target.value)}
                  className="mt-1 w-full border border-slate-200 dark:border-slate-800 p-2 text-xs rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                >
                  <option value="">-- Selecionar Fração --</option>
                  {predioFracoes.map(f => {
                    const info = getLegalInfoForFracao(f.id_fracao);
                    return (
                      <option key={f.id_fracao} value={f.id_fracao}>
                        Fração {f.fracao_nome} - {f.proprietario.nome} ({info.totalDebt.toFixed(2)} €)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400">Prazo para Regularização (Dias)</label>
                <select className="mt-1 w-full border border-slate-200 dark:border-slate-800 p-2 text-xs rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                  <option value="15">15 Dias Úteis (Recomendado)</option>
                  <option value="8">8 Dias de Calendário</option>
                  <option value="30">30 Dias Gerais</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400">Taxa de Juro de Mora Anual (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={interestRate}
                  onChange={e => setInterestRate(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full border border-slate-200 dark:border-slate-800 p-2 text-xs rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-mono-custom"
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={handlePrint}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-xs transition-colors cursor-pointer flex items-center justify-center space-x-2 shadow"
                >
                  <i className="fa-solid fa-print"></i>
                  <span>Imprimir / Exportar Carta AR</span>
                </button>
              </div>

              {/* Envio real de notificações jurídicas por email */}
              <div className="pt-3 mt-1 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <label className="text-[10px] uppercase font-bold text-slate-400">Tipo de Notificação a Enviar por Email</label>
                <select
                  value={tipoCartaEnvio}
                  onChange={e => setTipoCartaEnvio(e.target.value as typeof tipoCartaEnvio)}
                  className="w-full border border-slate-200 dark:border-slate-800 p-2 text-xs rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                >
                  <option value="mora">Notificação Formal de Interpelação em Mora</option>
                  <option value="obras">Notificação de Cessação de Obras / Violação do Regulamento</option>
                  <option value="acordo">Termo de Acordo de Pagamento em Prestações</option>
                </select>

                {tipoCartaEnvio === "obras" && (
                  <textarea
                    rows={3}
                    placeholder="Descreva a infração/incumprimento detetado..."
                    value={descricaoInfracaoObras}
                    onChange={e => setDescricaoInfracaoObras(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-800 p-2 text-xs rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                  />
                )}

                {tipoCartaEnvio === "acordo" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400">N.º Prestações</label>
                      <input
                        type="number"
                        min={1}
                        value={numPrestacoesAcordo}
                        onChange={e => setNumPrestacoesAcordo(parseInt(e.target.value) || 1)}
                        className="mt-1 w-full border border-slate-200 dark:border-slate-800 p-2 text-xs rounded bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400">1.ª Prestação</label>
                      <input
                        type="date"
                        value={dataPrimeiraPrestacao}
                        onChange={e => setDataPrimeiraPrestacao(e.target.value)}
                        className="mt-1 w-full border border-slate-200 dark:border-slate-800 p-2 text-xs rounded bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleEnviarNotificacaoReal}
                  disabled={enviandoNotificacaoReal || !selectedFracaoId}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded text-xs transition-colors cursor-pointer flex items-center justify-center space-x-2 shadow"
                >
                  {enviandoNotificacaoReal ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>A enviar...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane"></i>
                      <span>Enviar Notificação por Email</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Letter preview */}
          <div className="lg:col-span-2">
            {!selectedFracaoId ? (
              <div className="bg-white dark:bg-[#0f172a] p-12 text-center text-slate-400 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
                <i className="fa-regular fa-envelope-open text-4xl mb-3 text-slate-300"></i>
                <p className="text-xs">Por favor, selecione uma fração devedora para gerar a notificação jurídica oficial.</p>
              </div>
            ) : (
              <div className="bg-[#fcfbf9] text-slate-800 p-8 rounded-xl border border-slate-300 shadow-md font-serif text-justify text-xs leading-relaxed space-y-6">
                <div className="flex justify-between items-start font-sans">
                  <div>
                    <h4 className="font-extrabold uppercase text-[10px] text-slate-500 tracking-wider">CONDOMÍNIO DO EDIFÍCIO</h4>
                    <p className="text-sm font-bold text-slate-950 font-sans">{predio.nome || "Sem Nome"}</p>
                    <p className="text-[10px] text-slate-500 font-mono-custom">NIF: {predio.nif}</p>
                    <p className="text-[10px] text-slate-500">{predio.morada_linha1}, {predio.localidade}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-600 uppercase">CARTA REGISTADA COM AR</p>
                    <p className="text-[9px] text-slate-400">DATA: 15 de Julho de 2026</p>
                  </div>
                </div>

                <div className="font-sans border border-slate-300 p-4 rounded bg-slate-50 space-y-1 w-2/3 ml-auto text-xs leading-normal">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Destinatário:</p>
                  <p className="font-bold text-slate-900">{selectedFracao.proprietario.nome}</p>
                  <p className="font-mono-custom">NIF: {selectedFracao.proprietario.nif}</p>
                  <p>Fração Autónoma "{selectedFracao.fracao_nome}" - {selectedFracao.piso}</p>
                  <p>{predio.morada_linha1}, {predio.localidade}</p>
                </div>

                <div className="space-y-4">
                  <p className="font-bold text-slate-900 text-sm">Assunto: Notificação de Cobrança Extrajudicial de Quotas de Condomínio em Falta</p>

                  <p>Exmo.(a) Senhor(a) Condómino(a),</p>

                  <p>Na qualidade de Administração do Condomínio do Edifício {predio.nome || "Sem Nome"}, em conformidade com as atribuições legais conferidas pelo Código Civil, entramos em contacto por este meio formal para expor e solicitar a V. Exa. a regularização urgente dos valores em dívida para com este condomínio, relativos à fração autónoma designada pela letra <strong>"{selectedFracao.fracao_nome}"</strong>, correspondente ao {selectedFracao.piso} do qual é legítimo proprietário.</p>

                  <p>De acordo com os nossos registos contabilísticos e financeiros atualizados à presente data (15-07-2026), encontram-se por liquidar os seguintes avisos e quotas do condomínio:</p>

                  <table className="w-full text-left font-sans text-[10px] border border-slate-300 rounded overflow-hidden">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                        <th className="p-2">Documento</th>
                        <th className="p-2">Descrição</th>
                        <th className="p-2">Vencimento</th>
                        <th className="p-2 text-center">Dias Atraso</th>
                        <th className="p-2 text-right">Valor Inicial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedFracaoInfo?.unpaidAvisos.map(av => (
                        <tr key={av.id_aviso} className="text-slate-600">
                          <td className="p-2 font-mono-custom">{av.id_aviso}</td>
                          <td className="p-2">{av.descricao}</td>
                          <td className="p-2 font-mono-custom">{av.vencimento}</td>
                          <td className="p-2 text-center font-mono-custom font-semibold text-red-600">{getDaysOverdue(av.vencimento)} dias</td>
                          <td className="p-2 text-right font-mono-custom font-bold text-slate-900">{av.valor.toFixed(2)} €</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-bold border-t border-slate-300 text-slate-900">
                        <td colSpan={4} className="p-2 text-right uppercase tracking-wider text-[9px]">Total em Dívida:</td>
                        <td className="p-2 text-right font-mono-custom text-red-600 text-xs">{selectedFracaoInfo?.totalDebt.toFixed(2)} €</td>
                      </tr>
                    </tbody>
                  </table>

                  <p>Mais se informa que ao abrigo do regulamento interno em vigor, e do Código Civil, os valores em mora vencem juros de mora legais de <strong>{interestRate}% ao ano</strong> a contar do respetivo vencimento de cada prestação.</p>

                  <p>Assim, serve a presente notificação para interpelar V. Exa. a proceder à liquidação total da referida dívida no valor de <strong>{selectedFracaoInfo?.totalDebt.toFixed(2)} €</strong>, no prazo impreterível de <strong>15 dias úteis</strong> a contar da receção da presente carta, através dos canais habituais, Multibanco ou transferência para o IBAN do condomínio: <strong>{predioContasIBAN(predio.id_predio)}</strong>.</p>

                  <p>Caso se verifique o decurso do prazo indicado sem que o pagamento seja efetuado ou sem que nos seja apresentada uma proposta de plano de pagamento razoável, esta Administração ver-se-á legalmente obrigada, nos termos do Código Civil, a intentar uma ação judicial executiva de cobrança coerciva através do <strong>Balcão Nacional de Injunções (BNI)</strong>, servindo as atas de assembleia como título executivo.</p>

                  <p>Adicionalmente, recordamos que a situação de incumprimento superior a 60 dias implica a <strong>inibição imediata e legal dos direitos de voto</strong> de V. Exa. em qualquer Assembleia Geral de Condóminos nos termos do Regulamento Interno do Edifício.</p>

                  <p>Com os melhores cumprimentos,</p>
                </div>

                <div className="pt-8 border-t border-slate-200 text-center font-sans text-[10px] text-slate-500">
                  <p>A Administração do Condomínio do Edifício {predio.nome || "Sem Nome"}</p>
                  <p className="font-bold text-slate-700 mt-2">{loggedUser.nome}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Tab 3: Requerimento de Injunção Judicial ao BNI --- */}
      {activeTab === "injuncões" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings / Fee calculation */}
          <div className="lg:col-span-1 bg-white dark:bg-[#0f172a] p-6 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center">
              <i className="fa-solid fa-calculator text-red-500 mr-2"></i>
              Custas e Juros Judiciais
            </h3>

            {selectedFracaoInfo && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Selecionar Réu (Fração)</label>
                  <select
                    value={selectedFracaoId}
                    onChange={e => setSelectedFracaoId(e.target.value)}
                    className="mt-1 w-full border border-slate-200 dark:border-slate-800 p-2 text-xs rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                  >
                    {predioFracoes.map(f => {
                      const info = getLegalInfoForFracao(f.id_fracao);
                      return (
                        <option key={f.id_fracao} value={f.id_fracao}>
                          Fração {f.fracao_nome} - {f.proprietario.nome}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 space-y-2">
                  <div className="flex justify-between">
                    <span>Capital da Dívida:</span>
                    <span className="font-bold font-mono-custom">{selectedFracaoInfo.totalDebt.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Juros de Mora ({interestRate}%):</span>
                    <span className="font-bold text-amber-500 font-mono-custom">
                      {getCalculatedTotalInterest(selectedFracaoInfo.unpaidAvisos).toFixed(2)} €
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxa de Justiça BNI:</span>
                    {/* Legal simulation fee: under €2000 is €25.50, above is €51.00 */}
                    <span className="font-bold text-red-500 font-mono-custom">
                      {selectedFracaoInfo.totalDebt <= 2000 ? "25.50" : "51.00"} €
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 font-bold text-sm text-slate-800 dark:text-white">
                    <span>Valor Total Reclamado:</span>
                    <span className="font-mono-custom">
                      {(
                        selectedFracaoInfo.totalDebt + 
                        getCalculatedTotalInterest(selectedFracaoInfo.unpaidAvisos) + 
                        (selectedFracaoInfo.totalDebt <= 2000 ? 25.50 : 51.00)
                      ).toFixed(2)} €
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 leading-normal italic">
                  * O requerimento de injunção é um processo célere que confere força executiva de tribunal (título executivo judicial) para penhora imediata de contas bancárias ou bens móveis do devedor caso este não se oponha no prazo de 15 dias.
                </p>

                <button
                  onClick={handlePrint}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-xs transition-colors cursor-pointer flex items-center justify-center space-x-2 shadow"
                >
                  <i className="fa-solid fa-print"></i>
                  <span>Imprimir Requerimento Judicial</span>
                </button>
              </div>
            )}
          </div>

          {/* Court form preview */}
          <div className="lg:col-span-2">
            {!selectedFracaoId ? (
              <div className="bg-white dark:bg-[#0f172a] p-12 text-center text-slate-400 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
                <p className="text-xs">Por favor, selecione uma fração para formular o requerimento de injunção civil.</p>
              </div>
            ) : (
              <div className="bg-white text-slate-800 p-8 rounded-xl border border-slate-300 shadow-md font-sans text-[10px] leading-relaxed space-y-4">
                <div className="text-center space-y-1 border-b-2 border-slate-200 pb-3">
                  <h3 className="text-sm font-extrabold text-slate-900 tracking-wider">BALCÃO NACIONAL DE INJUNÇÕES</h3>
                  <p className="text-xs uppercase font-semibold text-slate-500">Requerimento de Injunção - Decreto-Lei n.º 269/98</p>
                </div>

                <div className="grid grid-cols-2 gap-4 border border-slate-300 p-3 bg-slate-50 rounded">
                  <div>
                    <h5 className="font-extrabold uppercase text-[9px] text-slate-500">1. Requerente (Credor)</h5>
                    <p className="font-bold text-slate-900">CONDOMÍNIO DO EDIFÍCIO {predio.nome ? predio.nome.toUpperCase() : "SEM NOME"}</p>
                    <p>Contribuinte NIF: <strong>{predio.nif}</strong></p>
                    <p>Morada: {predio.morada_linha1}, {predio.localidade}</p>
                    <p>Representante: {loggedUser.nome}</p>
                  </div>
                  <div>
                    <h5 className="font-extrabold uppercase text-[9px] text-slate-500">2. Requerido (Devedor / Réu)</h5>
                    <p className="font-bold text-slate-900">{selectedFracao.proprietario.nome}</p>
                    <p>Contribuinte NIF: <strong>{selectedFracao.proprietario.nif}</strong></p>
                    <p>Morada: {predio.morada_linha1}, Fração {selectedFracao.fracao_nome}, {predio.localidade}</p>
                    <p>Contacto tlm: {selectedFracao.proprietario.tlm}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="font-bold uppercase tracking-wide border-b border-slate-200 pb-0.5 text-slate-700 text-[11px]">3. Pedido Líquido Discriminado</h5>
                  <div className="grid grid-cols-4 gap-2 text-center p-2 bg-slate-50 border rounded font-mono-custom text-xs font-bold">
                    <div className="border-r">
                      <p className="text-[9px] font-sans text-slate-400 uppercase">Capital Inicial</p>
                      <p className="text-slate-800">{selectedFracaoInfo?.totalDebt.toFixed(2)} €</p>
                    </div>
                    <div className="border-r">
                      <p className="text-[9px] font-sans text-slate-400 uppercase">Juros de Mora</p>
                      <p className="text-amber-600">{getCalculatedTotalInterest(selectedFracaoInfo?.unpaidAvisos || []).toFixed(2)} €</p>
                    </div>
                    <div className="border-r">
                      <p className="text-[9px] font-sans text-slate-400 uppercase">Taxa de Justiça</p>
                      <p className="text-red-600">{(selectedFracaoInfo?.totalDebt || 0) <= 2000 ? "25.50" : "51.00"} €</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-sans text-slate-400 uppercase">Valor do Pedido</p>
                      <p className="text-slate-950 font-extrabold">
                        {(
                          (selectedFracaoInfo?.totalDebt || 0) + 
                          getCalculatedTotalInterest(selectedFracaoInfo?.unpaidAvisos || []) + 
                          ((selectedFracaoInfo?.totalDebt || 0) <= 2000 ? 25.50 : 51.00)
                        ).toFixed(2)} €
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="font-bold uppercase tracking-wide border-b border-slate-200 pb-0.5 text-slate-700 text-[11px]">4. Exposição dos Factos Fundamentadores</h5>
                  <div className="bg-slate-50 p-3 rounded text-justify space-y-2 border font-mono-custom text-[9px] leading-relaxed">
                    <p>1. O Requerente é o Condomínio do Edifício {predio.nome || "Sem Nome"}, regularmente constituído ao abrigo do regime jurídico da propriedade horizontal.</p>
                    <p>2. O Requerido é proprietário da fração autónoma designada pela letra "{selectedFracao.fracao_nome}" correspondente ao {selectedFracao.piso} do referido edifício, estando legalmente obrigado a concorrer para o pagamento das despesas comuns aprovadas em Assembleia Geral.</p>
                    <p>3. O Requerido encontra-se em mora relativamente ao pagamento de {selectedFracaoInfo?.unpaidCount} aviso(s) e cota(s) de condomínio devidamente emitidos, com prazos de vencimento já largamente ultrapassados, totalizando uma dívida líquida de capital em mora de {selectedFracaoInfo?.totalDebt.toFixed(2)} €.</p>
                    <p>4. Em conformidade com o Artigo 1431º e seguintes do Código Civil, os devedores foram regularmente interpelados pela Administração através de correio registado, mantendo-se a situação de incumprimento e omissão de pagamento voluntário até à presente data.</p>
                    <p>5. O Requerente reclama juros legais calculados à taxa de {interestRate}% ao ano sobre o capital vencido, computando presentemente {getCalculatedTotalInterest(selectedFracaoInfo?.unpaidAvisos || []).toFixed(2)} € de juros, e a taxa de justiça de injunção correspondente ao valor da ação.</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[9px] text-slate-500 font-sans">
                  <span>Assinatura Eletrónica do Mandatário / Administrador</span>
                  <span className="font-bold text-slate-700">{loggedUser.nome}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Tab 4: Regulamento Interno Automático --- */}
      {activeTab === "regulamento" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-[#0f172a] p-4 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal max-w-lg">
              Regulamento interno gerado dinamicamente com base nas características de património técnico cadastradas para o prédio ativo. Configurado para regular elevadores, piscina, ginásio, spa e garagens comunitárias.
            </p>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={handlePrint}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3.5 rounded text-xs transition-colors cursor-pointer flex items-center space-x-2 shadow"
              >
                <i className="fa-solid fa-print"></i>
                <span>Imprimir</span>
              </button>
              <button
                onClick={() => {
                  if (onAddDocumento) {
                    onAddDocumento({
                      id: "doc-reg-" + Date.now(),
                      id_predio: predio.id_predio,
                      titulo: `Regulamento Interno de Coabitação - Edifício ${predio.nome || predio.morada_linha1} (Oficial Finalizado)`,
                      data: new Date().toLocaleDateString("pt-PT"),
                      categoria: "Regulamentos",
                      tema: "Regulamentos & Legal",
                      tipo: "PDF",
                      tamanho: "320 KB",
                      url: "#",
                      status: "Oficial Finalizado"
                    });
                    alert("✅ Regulamento Interno finalizado com sucesso! Foi publicado e guardado no Arquivo Digital na pasta 'Regulamentos & Legal'.");
                  } else {
                    alert("✅ Regulamento Interno guardado no Arquivo Digital!");
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3.5 rounded text-xs transition-colors cursor-pointer flex items-center space-x-2 shadow"
              >
                <i className="fa-solid fa-file-circle-check"></i>
                <span>Finalizar & Publicar p/ Arquivo Digital</span>
              </button>
            </div>
          </div>
          {renderRegulamentoInterno()}
        </div>
      )}

      {/* --- Tab 6: Estatutos do Prédio (Proposta IA por Fisionomia & Artigos Personalizados) --- */}
      {activeTab === "estatutos" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-scroll"></i>
                  </span>
                  <span>Estatutos Fundamentais do Edifício & Propriedade Horizontal</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Proposta automática de estatutos adaptada à fisionomia do prédio com possibilidade de inclusão manual e exportação PDF autêntica.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    const novoId = `est-${Date.now()}`;
                    setStatutesList([
                      {
                        id: novoId,
                        num: "Artigo 5.º",
                        titulo: "Regras Específicas de Fruição de Garagens e Arrecadações",
                        texto: "Os lugares de estacionamento e arrecadações não podem ser utilizados para armazenamento de matérias perigosas, sendo obrigatório manter desimpedidos os acessos comuns e vias de circulação."
                      },
                      ...statutesList
                    ]);
                    showToast("✨ Artigo de Estatutos adicionado com sucesso pela Inteligência Artificial!");
                  }}
                  className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-wand-magic-sparkles text-pink-300"></i>
                  <span>Gerar Artigo IA</span>
                </button>
                <button
                  onClick={() => handlePrintDocument(`Estatutos_${predio.nome}`, "estatutos-doc-container")}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-file-pdf"></i>
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => {
                    if (onAddDocumento) {
                      onAddDocumento({
                        id: "doc-est-" + Date.now(),
                        id_predio: predio.id_predio,
                        titulo: `Estatutos Fundamentais do Edifício - ${predio.nome || predio.morada_linha1} (Oficial Finalizado)`,
                        data: new Date().toLocaleDateString("pt-PT"),
                        categoria: "Regulamentos",
                        tema: "Regulamentos & Legal",
                        tipo: "PDF",
                        tamanho: "410 KB",
                        url: "#",
                        status: "Oficial Finalizado"
                      });
                      alert("✅ Estatutos do Prédio finalizados com sucesso! Foram publicados e guardados no Arquivo Digital na pasta 'Regulamentos & Legal'.");
                    } else {
                      alert("✅ Estatutos do Prédio guardados no Arquivo Digital!");
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-file-circle-check"></i>
                  <span>Finalizar & Publicar p/ Arquivo Digital</span>
                </button>
              </div>
            </div>

            {/* Custom Statute Form */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <i className="fa-solid fa-plus-circle text-red-500"></i>
                <span>Adicionar Artigo / Norma Personalizada aos Estatutos do Prédio</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Número & Título do Artigo</label>
                  <input
                    type="text"
                    placeholder="Ex: Artigo 5.º - Horário de Silêncio"
                    value={customStatuteTitle}
                    onChange={e => setCustomStatuteTitle(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Texto Legal / Conteúdo do Estatuto</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Descreva a regra normativa a integrar nos estatutos..."
                      value={customStatuteText}
                      onChange={e => setCustomStatuteText(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 dark:text-white"
                    />
                    <button
                      onClick={() => {
                        if (!customStatuteTitle.trim() || !customStatuteText.trim()) {
                          alert("Preencha o título e o texto do artigo dos estatutos.");
                          return;
                        }
                        const novo = {
                          id: `est-custom-${Date.now()}`,
                          num: customStatuteTitle,
                          titulo: "",
                          texto: customStatuteText,
                          isCustom: true
                        };
                        setStatutesList(prev => [...prev, novo]);
                        setCustomStatuteTitle("");
                        setCustomStatuteText("");
                        showToast("✅ Novo Estatuto integrado na carta fundadora do edifício!");
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-plus"></i>
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Printable Statutes Document */}
            <div 
              id="estatutos-doc-container"
              className="bg-white text-slate-800 border-2 border-slate-300 rounded-xl p-8 shadow-inner font-serif text-xs leading-relaxed space-y-6"
            >
              <div className="header-box flex justify-between items-start border-b-2 border-slate-900 pb-4 font-sans">
                <div>
                  <h4 className="text-sm font-black tracking-wider uppercase text-slate-900">
                    ESTATUTOS E REGIME CONSTITUTIVO — EDIFÍCIO {predio.nome.toUpperCase()}
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    {predio.morada_linha1} {predio.num_porta}, {predio.localidade} • Permilagem Total: 1000‰
                  </p>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Carta Normativa</span>
                  <span className="font-mono text-xs font-bold text-slate-900">Art. 1414.º CC</span>
                </div>
              </div>

              <div className="text-center py-2 font-sans">
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-900 underline decoration-2 underline-offset-4">
                  ESTATUTOS DO CONDOMÍNIO E NORMAS FUNDAMENTAIS
                </h3>
              </div>

              <div className="space-y-4">
                {statutesList.map((st, i) => (
                  <div key={st.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-slate-900 font-sans uppercase tracking-wide">
                        {st.num} {st.titulo ? `— ${st.titulo}` : ""}
                      </span>
                      {st.isCustom && (
                        <button
                          onClick={() => setStatutesList(prev => prev.filter(x => x.id !== st.id))}
                          className="text-red-500 hover:text-red-700 text-[10px] font-sans font-bold no-print"
                        >
                          <i className="fa-solid fa-trash mr-1"></i> Remover
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed text-justify">
                      {st.texto}
                    </p>
                  </div>
                ))}
              </div>

              <div className="pt-8 flex justify-between items-end border-t border-slate-300 font-sans text-xs">
                <div>
                  <p className="text-slate-500 text-[10px]">Aprovados em Assembleia de Condóminos</p>
                  <p className="text-slate-400 text-[10px]">Estatutos gerados por CondoManager</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-6">Administração do Edifício</p>
                  <p className="font-bold text-slate-900 border-t border-slate-400 pt-1 px-4 inline-block">
                    {loggedUser.nome} - Administrador
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Tab 5: Área Jurídica - Documentos Obrigatórios (Adenda Geral Requirement) --- */}
      {activeTab === "documentos_obrigatorios" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Settings and Actions Configurator */}
          <div className="lg:col-span-1 bg-white dark:bg-[#0f172a] p-6 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center">
              <i className="fa-solid fa-file-signature text-red-500 mr-2"></i>
              Emissão de Declaração
            </h3>

            <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">1. Selecionar Fração Autónoma</label>
                <select
                  value={selectedFracaoId}
                  onChange={e => setSelectedFracaoId(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-800 p-2.5 text-xs rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium"
                >
                  {predioFracoes.map(f => {
                    const info = getLegalInfoForFracao(f.id_fracao);
                    return (
                      <option key={f.id_fracao} value={f.id_fracao}>
                        Fração {f.fracao_nome} - {f.proprietario.nome} ({info.totalDebt > 0 ? `${info.totalDebt.toFixed(2)}€` : "Sem Dívida"})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">2. Tipo de Declaração Obrigatória</label>
                <select
                  value={docObrigatorioType}
                  onChange={e => setDocObrigatorioType(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-800 p-2.5 text-xs rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium"
                >
                  <option value="Declaração de Dívida">Declaração de Dívida</option>
                  <option value="Declaração de Não Dívida">Declaração de Não Dívida</option>
                  <option value="Declaração de Encargos Previstos">Declaração de Encargos Previstos</option>
                  <option value="Declaração de Situação Jurídica">Declaração de Situação Jurídica</option>
                  <option value="Declaração de Condomínio para Escritura">Declaração de Condomínio para Escritura (DL 268/2022)</option>
                  <option value="Declaração de Obras em Curso">Declaração de Obras em Curso</option>
                </select>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg text-[10px] text-slate-500 leading-relaxed border border-slate-100 dark:border-slate-850/80">
                <span className="font-extrabold text-slate-700 dark:text-slate-300 block mb-1">Enquadramento Legal:</span>
                {docObrigatorioType === "Declaração de Dívida" && "Utilizada em ações executivas ou assembleias. Discrimina todas as parcelas e juros vencidos devidos pelo condómino em incumprimento."}
                {docObrigatorioType === "Declaração de Não Dívida" && "Obrigatória para outorga de Escritura nos termos do DL 268/2022, libertando o condómino vendedor e atestando contas em dia."}
                {docObrigatorioType === "Declaração de Encargos Previstos" && "Prevê as quotas futuras ordinárias com base no orçamento e permilagem, essencial para planeamento de potenciais compradores."}
                {docObrigatorioType === "Declaração de Situação Jurídica" && "Atesta de forma oficial se a fração ou proprietário se encontra sob processos litigiosos ou em contencioso judicial com o condomínio."}
                {docObrigatorioType === "Declaração de Condomínio para Escritura" && "A declaração mais completa exigida por notários, englobando simultaneamente estado de dívida, encargos correntes e obras."}
                {docObrigatorioType === "Declaração de Obras em Curso" && "Informa se o edifício se encontra sob intervenção física ou obras estruturais autorizadas em ata com contribuições extraordinárias pendentes."}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-850 pt-3 space-y-2">
                <button
                  type="button"
                  disabled={isEmitting}
                  onClick={() => {
                    setIsEmitting(true);
                    setTimeout(() => {
                      setIsEmitting(false);
                      const selFrac = predioFracoes.find(f => f.id_fracao === selectedFracaoId) || predioFracoes[0];
                      const nomeDoc = `${docObrigatorioType} - Fração ${selFrac?.fracao_nome || "N/A"}`;
                      handlePrintDocument(nomeDoc, "declaracao-certidao-view");
                      if (onAddDocumento) {
                        onAddDocumento({
                          id_doc: `legal-doc-${Date.now()}`,
                          id_predio: predio.id_predio,
                          nome: nomeDoc,
                          tipo: "Legal / Judicial",
                          categoria: "Público",
                          data_upload: new Date().toISOString().split("T")[0],
                          autor: loggedUser.nome,
                          tema: "Contencioso Jurídico"
                        });
                        registarLogAuditoria("Jurídica", `Emitiu "${docObrigatorioType}" para a Fração ${selFrac?.fracao_nome}`, predio.id_predio, loggedUser);
                        alert(`Sucesso! O documento "${nomeDoc}" foi gerado e arquivado no Arquivo do Edifício.`);
                      } else {
                        alert(`Documento gerado: ${docObrigatorioType}. No entanto, o canal de arquivo não está conectado.`);
                      }
                    }, 800);
                  }}
                  className={`w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-4 rounded-lg transition-colors cursor-pointer flex items-center justify-center space-x-2 shadow-sm ${isEmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <i className="fa-solid fa-file-signature text-xs"></i>
                  <span>{isEmitting ? "A assinar digitalmente..." : "Emitir & Arquivar no Prédio"}</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center space-x-2"
                >
                  <i className="fa-solid fa-print"></i>
                  <span>Imprimir / Exportar PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* Certificate View (High Fidelity Portuguese Legal Formatting) */}
          <div className="lg:col-span-2">
            {!selectedFracaoId ? (
              <div className="bg-white dark:bg-[#0f172a] p-12 text-center text-slate-400 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
                <p className="text-xs">Selecione uma fração para pré-visualizar a certidão jurídica.</p>
              </div>
            ) : (
              <div id="declaracao-certidao-view" className="bg-[#fdfcfb] dark:bg-slate-950 text-slate-900 dark:text-slate-200 p-8 md:p-12 rounded-xl border border-slate-300 dark:border-slate-850 shadow-lg font-sans text-justify text-[11px] leading-relaxed space-y-6 relative overflow-hidden" style={{ color: "#1A1A1A" }}>

                {/* 1. Official Watermark (Diagonal ~30º, 11% opacity, centered behind content) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.06] pointer-events-none text-center select-none z-0" style={{ transform: "translate(-50%, -50%) rotate(-30deg)" }}>
                  <p className="text-[64px] font-black tracking-[10px] uppercase text-[#1A1A1A]">CONDOMANAGER</p>
                  <p className="text-lg font-bold uppercase tracking-wider text-[#1A1A1A] -mt-2">Certidão Jurídica Oficial</p>
                </div>

                <div className="relative z-10 space-y-6">
                  {/* 2. Cabeçalho Institucional (padrão oficial) */}
                  <div className="flex justify-between items-start border-b-2 border-[#1A1A1A] pb-4">
                    <div className="flex items-center space-x-2">
                      <div className="h-10 w-10 bg-[#1A1A1A] text-white flex items-center justify-center font-black text-xl rounded">
                        CM
                      </div>
                      <div className="leading-tight">
                        <span className="font-extrabold text-[14px] uppercase tracking-wider block text-[#1A1A1A]">CONDOMANAGER AI</span>
                        <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-tight">Gestão Digital de Condomínios</span>
                      </div>
                    </div>
                    
                    <div className="text-right font-sans text-[9px] text-slate-500 space-y-0.5 leading-tight">
                      <p className="font-extrabold uppercase text-[#1A1A1A]">CONDOMANAGER AI — ADMINISTRAÇÃO LEGAL</p>
                      <p>Avenida da República, Nº 1000, 1050-191 Lisboa</p>
                      <p className="font-mono">NIF: 512 345 678 • Registo Comercial de Lisboa</p>
                      <p>Email: suporte@condomanager.ai • Tel: +351 210 000 000</p>
                    </div>
                  </div>

                  {/* 3. Título do Documento */}
                  <div className="text-center py-1">
                    <h2 className="text-xs font-black uppercase tracking-widest border-b border-dashed border-slate-300 pb-1 inline-block min-w-[280px] text-[#1A1A1A]">
                      {docObrigatorioType.toUpperCase()} — MODELO OFICIAL
                    </h2>
                    <p className="text-[8px] text-slate-400 font-mono mt-1">CÓDIGO OFICIAL: LEG-{selectedFracao.fracao_nome}-{Date.now().toString().slice(-6)}</p>
                  </div>

                  {/* 4. Identificação do Condómino */}
                  <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Identificação do Condómino / Proprietário</span>
                      <p className="text-[10px] font-black uppercase text-[#1A1A1A]">Exmo(a) Sr(a):</p>
                      <p className="text-xs font-bold text-slate-800">{selectedFracao.proprietario.nome}</p>
                      <p className="text-[9px] text-slate-500 mt-1">
                        Fração Autónoma: <strong className="text-[#1A1A1A]">{selectedFracao.fracao_nome}</strong> 
                        &nbsp;({selectedFracao.piso})
                      </p>
                      <p className="text-[9px] text-slate-500">
                        Morada do Edifício: {predio.morada_linha1}, {predio.localidade}
                      </p>
                    </div>
                    
                    <div className="text-right space-y-1">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dados Administrativos</span>
                      <p className="text-[9px] text-slate-600"><strong>Contribuinte NIF:</strong> {selectedFracao.proprietario.nif || "999999990"}</p>
                      <p className="text-[9px] text-slate-600"><strong>Data de Emissão:</strong> 18 de Julho de 2026</p>
                      <p className="text-[9px] text-slate-600"><strong>Estado da Fração:</strong> <span className={`font-bold uppercase ${selectedFracaoInfo?.status === "Contencioso" ? "text-red-600" : "text-emerald-600"}`}>{selectedFracaoInfo?.status || "Regularizada"}</span></p>
                      <p className="text-[9px] text-slate-500"><strong>Permilagem Legal:</strong> {selectedFracao.permilagem || 0}‰ do edifício</p>
                    </div>
                  </div>

                  {/* 5. Corpo do Documento / Declaração Legal */}
                  <div className="space-y-4 text-[10px] text-slate-800 leading-relaxed font-sans">
                    <p className="indent-8 text-justify">
                      O signatário, <strong>{loggedUser.nome}</strong>, na qualidade de Administrador Legal do Condomínio do Edifício {predio.nome || "Sem Nome"}, com sede na {predio.morada_linha1}, concelho de {predio.localidade}, titular do NIF de condomínio {predio.nif}, certifica por este meio e com fé pública para todos os devidos efeitos legais que:
                    </p>

                    {/* Document specific body text */}
                    {docObrigatorioType === "Declaração de Dívida" && (
                      <div className="space-y-3 bg-red-50/30 p-4 rounded-lg border border-red-100">
                        <p className="text-justify text-[#1A1A1A]">
                          1. A fração autónoma designada pela letra <strong>"{selectedFracao.fracao_nome}"</strong>, correspondente ao {selectedFracao.piso} do referido imóvel, da qual consta como titular cadastrado o(a) Sr.(a) <strong>{selectedFracao.proprietario.nome}</strong> (NIF: {selectedFracao.proprietario.nif}), <strong>DÉVEM até à data corrente</strong> o valor global líquido acumulado de <strong className="text-red-600 font-mono text-xs">{selectedFracaoInfo?.totalDebt.toFixed(2)} €</strong> (euros), relativo a quotas ordinárias ou extraordinárias aprovadas e vencidas conforme histórico de avisos em atraso discriminado nos autos de arquivo do condomínio.
                        </p>
                        <p className="text-justify text-[#1A1A1A]">
                          2. Sobre as quantias em dívida aplicam-se juros de mora legais à taxa de {interestRate}% ao ano, nos termos do regulamento do condomínio, até à data de efetivo pagamento voluntário ou coercivo em sede de cobrança de contencioso.
                        </p>
                      </div>
                    )}

                    {docObrigatorioType === "Declaração de Não Dívida" && (
                      <div className="space-y-3 bg-emerald-50/20 p-4 rounded-lg border border-emerald-100">
                        <p className="text-justify text-[#1A1A1A]">
                          1. A fração autónoma designada pela letra <strong>"{selectedFracao.fracao_nome}"</strong>, correspondente ao {selectedFracao.piso}, de que é proprietário(a) Sr.(a) <strong>{selectedFracao.proprietario.nome}</strong>, <strong>se encontra integralmente REGULARIZADA e sem quaisquer valores em dívida</strong> relativos a quotas ordinárias ou extraordinárias de condomínio vencidas até à data de emissão do presente documento.
                        </p>
                        <p className="text-justify text-[#1A1A1A]">
                          2. Desta forma, o condómino encontra-se livre de quaisquer obrigações financeiras pendentes perante este condomínio, para os efeitos previstos na Lei da Propriedade Horizontal e no Decreto-Lei n.º 268/2022.
                        </p>
                      </div>
                    )}

                    {docObrigatorioType === "Declaração de Encargos Previstos" && (
                      <div className="space-y-3 bg-indigo-50/20 p-4 rounded-lg border border-indigo-100">
                        <p className="text-justify text-[#1A1A1A]">
                          1. A fração autónoma designada pela letra <strong>"{selectedFracao.fracao_nome}"</strong>, com a permilagem regulamentar de <strong>{selectedFracao.permilagem}‰</strong> (permilagem), está sujeita aos seguintes encargos ordinários futuros aprovados em assembleia para o corrente ano civil: uma quota mensal corrente fixa no valor de <strong className="font-mono text-[#1A1A1A]">{(selectedFracao.permilagem * 0.15).toFixed(2)} €</strong>.
                        </p>
                        <p className="text-justify text-[#1A1A1A]">
                          2. Mais certifica que, no presente momento, não existem outros planos orçamentais extraordinários ou taxas adicionais projetadas para aprovação no corrente exercício de manutenção ou remodelação.
                        </p>
                      </div>
                    )}

                    {docObrigatorioType === "Declaração de Situação Jurídica" && (
                      <div className="space-y-3 bg-slate-100/50 p-4 rounded-lg border border-slate-200">
                        <p className="text-justify text-[#1A1A1A]">
                          1. Relativamente à fração autónoma designada pela letra <strong>"{selectedFracao.fracao_nome}"</strong>, <strong>{selectedFracaoInfo?.status === "Contencioso" ? "EXISTEM processos judiciais ativos ou reclamações de contencioso" : "NÃO EXISTE qualquer registo de litígio judicial, processo de injunção, ou disputa jurídica pendente"}</strong> entre o condomínio e o proprietário.
                        </p>
                        {selectedFracaoInfo?.status === "Contencioso" && (
                          <p className="text-red-700 font-sans font-bold text-[9px] bg-red-50 p-2.5 border border-red-200 rounded leading-normal">
                            Aviso: A fração encontra-se sob plano de execução coerciva de cobrança de quotas acumuladas no valor de {selectedFracaoInfo?.totalDebt.toFixed(2)}€ junto do Balcão Nacional de Injunções ou Tribunal de comarca.
                          </p>
                        )}
                      </div>
                    )}

                    {docObrigatorioType === "Declaração de Condomínio para Escritura" && (
                      <div className="space-y-3 bg-amber-50/20 p-4 rounded-lg border border-amber-150">
                        <p className="text-justify text-[#1A1A1A]">
                          Em conformidade com o artigo 5.º do Decreto-Lei n.º 268/2022, de 10 de janeiro, declara-se para efeitos de transmissão do imóvel por venda e respetiva lavratura de escritura notarial que:
                        </p>
                        <ul className="list-disc pl-5 font-sans text-[9px] text-slate-700 space-y-1.5 p-1">
                          <li><strong>Dívida Ativa Acumulada da Fração:</strong> <span className="font-mono font-bold text-red-600">{selectedFracaoInfo?.totalDebt > 0 ? `${selectedFracaoInfo.totalDebt.toFixed(2)} €` : "NADA A DECLARAR (0.00 €)"}</span></li>
                          <li><strong>Encargos de Condomínio Correntes:</strong> <span className="font-mono font-bold">{(selectedFracao.permilagem * 0.15).toFixed(2)} €</span> por mês, com vencimento no dia 15 de cada mês correspondente.</li>
                          <li><strong>Obras Aprovadas em Curso:</strong> Fachada geral ordinária em fase de vistoria e conservação geral, com quota de obras já totalmente liquidada pelo vendedor à presente data.</li>
                        </ul>
                      </div>
                    )}

                    {docObrigatorioType === "Declaração de Obras em Curso" && (
                      <div className="space-y-3 bg-slate-100/50 p-4 rounded-lg border border-slate-200">
                        <p className="text-justify text-[#1A1A1A]">
                          1. No edifício de condomínio acima referenciado, <strong>{predio.patrimonio.tem_elevador ? "encontra-se sob plano geral de manutenção das cabines de elevador" : "não existem quaisquer obras extraordinárias estruturais de grande envergadura de momento em curso"}</strong> na estrutura de betão armado ou nas fachadas exteriores.
                        </p>
                        <p className="text-justify text-[#1A1A1A]">
                          2. Os planos ordinários de manutenção técnica e conservação preventiva dos elevadores ({predio.patrimonio.num_elevadores} unidades) estão inteiramente cobertos pelo orçamento ordinário do edifício, não exigindo taxas extraordinárias dos condóminos de momento.
                        </p>
                      </div>
                    )}

                    <p className="text-justify text-[#1A1A1A]">
                      {docObrigatorioType === "Declaração de Não Dívida"
                        ? "Por ser verdade e me ter sido solicitada para os devidos efeitos, mandei passar a presente certidão que vai por mim devidamente assinada de forma original."
                        : "Por ser verdade e me ter sido solicitada para os devidos efeitos, mandei passar a presente certidão que assino com aposição do selo temporal eletrónico e certificação integrada."}
                    </p>
                  </div>

                  {/* 6. Nota Legal (IVA) */}
                  <div className="text-left py-1 text-[8px] text-slate-500 border-t border-dashed border-slate-200">
                    <p className="font-semibold">Nota Legal: Isento de IVA nos termos do art.º 9.º, nº 21 do Código do Imposto sobre o Valor Acrescentado (CIVA).</p>
                  </div>

                  {/* 7. Assinatura e Autenticação do Documento */}
                  {docObrigatorioType === "Declaração de Não Dívida" ? (
                    <div className="pt-6 border-t border-slate-200 flex flex-col md:flex-row items-end justify-between gap-6 font-sans">
                      <div className="text-left space-y-1">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Documento Físico / Original</span>
                        <p className="text-[10px] text-slate-600 font-medium">Emitida em: {new Date().toLocaleDateString("pt-PT")}</p>
                      </div>

                      <div className="text-center min-w-[240px]">
                        <p className="text-[10px] uppercase font-bold text-slate-500 mb-8">A Administração do Condomínio</p>
                        <div className="border-b border-slate-800 w-full mb-1"></div>
                        <p className="text-[8.5px] text-slate-500 italic mb-1">(Assinatura Original)</p>
                        <p className="font-bold text-slate-900 text-xs">{loggedUser?.nome || "José Carlos Guerra"}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-6 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6 font-sans">
                      <div className="text-center md:text-left space-y-1">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Assinatura Certificada</span>
                        <p className="text-[10px] font-extrabold text-[#1A1A1A] uppercase">A Administração do Condomínio</p>
                        <p className="text-[8px] text-slate-500 font-medium">CondoManager AI, Lda. • Selo Tempus Eletrónico</p>
                        <p className="text-[7.5px] text-emerald-600 uppercase font-black tracking-widest mt-1">✓ Assinatura Digital Ativa • Emissão Validada por IA</p>
                      </div>

                      <div className="flex items-center space-x-3.5 bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                        <div className="h-10 w-10 bg-white border border-slate-300 flex items-center justify-center font-black text-slate-800 text-[8px] p-1 select-none">
                          <div className="grid grid-cols-4 gap-0.5 w-full h-full">
                            {[...Array(16)].map((_, i) => (
                              <div key={i} className={`rounded-xs ${i % 3 === 1 || i % 5 === 0 ? "bg-[#1A1A1A]" : "bg-transparent"}`} />
                            ))}
                          </div>
                        </div>
                        <div className="leading-tight text-[8px] text-slate-500 font-mono text-left">
                          <p className="font-bold text-[#1A1A1A]">SECURE VERIFY QR</p>
                          <p>LEG-HASH-SHA256-{selectedFracao.fracao_nome}</p>
                          <p className="text-[7px] text-indigo-600 font-bold">✓ Certidão Legal Autêntica</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 8. Rodapé Institucional (padrão oficial) */}
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-[7.5px] text-slate-400 font-mono leading-none">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold uppercase tracking-wider">CondoManager AI</span>
                      <span>— Gestão Inteligente de Condomínios</span>
                    </div>
                    <div className="text-right">
                      <span>Documento gerado automaticamente pelo sistema • Versão Oficial 3.2</span>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Tab 6: Assistente IA (Código Civil & Minutas de Cobrança) --- */}
      {activeTab === "assistente_ia" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          {/* Debtors list and fraction selector */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Detetor de Contencioso & Mora (Faltosos em Quotas)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                O assistente jurídico IA analisa em tempo real os avisos de pagamento excedidos para propor minutas extrajudiciais com constituição de mora nos termos do Código Civil.
              </p>

              {predioFracoes.filter(f => getLegalInfoForFracao(f.id_fracao).totalDebt > 0).length === 0 ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center">
                  <i className="fa-solid fa-circle-check text-emerald-500 mr-2 text-sm"></i>
                  Excelente! Todas as frações estão rigorosamente em dia com as quotas ordinárias e extraordinárias.
                </div>
              ) : (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {predioFracoes
                    .filter(f => getLegalInfoForFracao(f.id_fracao).totalDebt > 0)
                    .map(frac => {
                      const lInfo = getLegalInfoForFracao(frac.id_fracao);
                      const frAvisos = predioAvisos.filter(a => a.id_fracao === frac.id_fracao && a.estado === "Pendente");
                      return (
                        <div
                          key={frac.id_fracao}
                          className={`p-4 rounded-xl border transition-all cursor-pointer ${
                            selectedFracaoId === frac.id_fracao
                              ? "border-violet-500 bg-violet-50/20 dark:bg-violet-950/20 shadow-sm"
                              : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 hover:bg-slate-50"
                          }`}
                          onClick={() => handleGerarMinutaComIA(frac.id_fracao)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-xs font-black text-slate-800 dark:text-white">
                                Fração {frac.fracao_nome} • Piso {frac.piso}
                              </span>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                Proprietário: {frac.proprietario.nome}
                              </p>
                              <p className="text-[9px] text-slate-400">NIF: {frac.proprietario.nif}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-bold text-red-600 block">€{lInfo.totalDebt.toFixed(2)}</span>
                              <span className="text-[8px] bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 font-extrabold px-2 py-0.5 rounded-full uppercase mt-1 inline-block">
                                {frAvisos.length} Quotas
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex justify-between items-center">
                            <span className="text-[9px] text-slate-400">
                              <i className="fa-solid fa-clock mr-1"></i>Atraso: {lInfo.maxDaysOverdue} dias
                            </span>
                            <button
                              type="button"
                              className="bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-[10px] px-2.5 py-1 rounded shadow-sm transition-colors flex items-center"
                            >
                              {isGeneratingAiNotice && selectedFracaoId === frac.id_fracao ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-1.5 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  A Redigir...
                                </>
                              ) : (
                                <>
                                  <i className="fa-solid fa-file-invoice mr-1"></i> Gerar Minuta IA
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Interactive Legal AI Q&A */}
            <div className="bg-white dark:bg-[#0f172a] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center">
                <i className="fa-solid fa-gavel text-violet-500 mr-2"></i>
                Consulta Rápida IA — Código Civil (Art. 1414.º a 1438.º)
              </h5>
              <form onSubmit={handleConsultaIA} className="space-y-2">
                <input
                  type="text"
                  value={aiQuestion}
                  onChange={e => setAiQuestion(e.target.value)}
                  placeholder="Ex: Qual o quórum para obras de alteração da fachada?"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  type="submit"
                  disabled={isAskingAi || !aiQuestion.trim()}
                  className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-xs py-2 rounded-xl transition-all shadow-sm flex items-center justify-center"
                >
                  {isAskingAi ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin mr-2"></i> A Consultar Jurisprudência...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane mr-2"></i> Perguntar à IA Jurídica
                    </>
                  )}
                </button>
              </form>
              {aiAnswer && (
                <div className="p-3 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/40 rounded-xl text-xs text-slate-700 dark:text-slate-300 leading-relaxed max-h-48 overflow-y-auto">
                  <span className="font-bold text-violet-700 dark:text-violet-400 block mb-1">
                    <i className="fa-solid fa-scale-balanced mr-1"></i> Parecer Jurídico IA:
                  </span>
                  {aiAnswer}
                </div>
              )}
            </div>
          </div>

          {/* Legal Document Display (Gemini generated) */}
          <div className="lg:col-span-7">
            {isGeneratingAiNotice ? (
              <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 min-h-[500px]">
                <div className="relative flex items-center justify-center h-16 w-16">
                  <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-20"></div>
                  <div className="relative rounded-full h-12 w-12 bg-violet-100 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800 flex items-center justify-center text-violet-600 dark:text-violet-400">
                    <i className="fa-solid fa-feather-pointed text-xl"></i>
                  </div>
                </div>
                <div className="space-y-1">
                  <h5 className="text-sm font-bold text-slate-800 dark:text-white">Redação de Notificação Extrajudicial em Curso</h5>
                  <p className="text-xs text-slate-400 max-w-sm">
                    O Assistente Jurídico Inteligente está a cruzar a permilagem, identificação fiscal e faturas vencidas nos termos do Código Civil...
                  </p>
                </div>
              </div>
            ) : aiLegalNoticeText ? (
              <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col justify-between overflow-hidden min-h-[500px] animate-fadeIn">
                <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center">
                    <i className="fa-solid fa-file-signature text-violet-500 mr-2 text-sm"></i>
                    Notificação Extrajudicial com Constituição de Mora (IA)
                  </span>
                  <div className="flex space-x-1.5">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(aiLegalNoticeText);
                        alert("Minuta jurídica copiada para a área de transferência!");
                      }}
                      className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      title="Copiar Texto"
                    >
                      <i className="fa-solid fa-copy mr-1"></i>Copiar
                    </button>
                    <button
                      onClick={() => {
                        const printWindow = window.open("", "_blank");
                        if (!printWindow) return alert("Por favor, permita pop-ups para imprimir.");
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>Carta de Interpelação Legal - Notificação de Dívida</title>
                              <style>
                                body { font-family: 'Times New Roman', Times, serif; color: #1e293b; padding: 50px; font-size: 13px; line-height: 1.6; max-width: 800px; margin: 0 auto; }
                                .content { white-space: pre-wrap; }
                              </style>
                            </head>
                            <body>
                              <div class="content">${aiLegalNoticeText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                        printWindow.print();
                      }}
                      className="bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <i className="fa-solid fa-print mr-1"></i>Imprimir PDF
                    </button>
                  </div>
                </div>

                <div className="p-8 text-xs font-mono text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50/20 dark:bg-slate-900/30 flex-grow max-h-[500px] overflow-y-auto whitespace-pre-wrap">
                  {aiLegalNoticeText}
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 p-4 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 italic text-center">
                  Documento lavrado automaticamente via IA Generativa em conformidade com o Código Civil de Portugal.
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 min-h-[500px]">
                <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <i className="fa-solid fa-scale-unbalanced-flip text-xl"></i>
                </div>
                <div className="space-y-1">
                  <h5 className="text-sm font-bold text-slate-600 dark:text-slate-300">Aguardando Seleção de Fração Devedora</h5>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Selecione uma fração com pagamentos em atraso na lista lateral para que o Assistente de IA redija a minuta jurídica correspondente.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Helper local function to retrieve Bank Accounts IBAN to avoid crash
  function predioContasIBAN(predioId: string): string {
    // Return a dummy IBAN or search
    return "PT50 0018 2222 3333 4444 5555 6";
  }
}
