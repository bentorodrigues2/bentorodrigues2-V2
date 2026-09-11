import React, { useState } from "react";
import { Predio, Fracao, Reuniao, LoggedUser, PontoVotacaoAssembleia } from "../types";
import { 
  Vote, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  Scale, 
  Users, 
  FileText, 
  Download, 
  Sparkles, 
  PlusCircle,
  PlayCircle,
  StopCircle,
  CheckCheck,
  Building2
} from "lucide-react";
import jsPDF from "jspdf";
import { addPdfHeaderWithLogo, addPdfWatermark, downloadBlob, formatDatePT } from "../utils";

interface VotacaoAssembleiaVirtualProps {
  predio: Predio;
  fracoes: Fracao[];
  reuniao?: Reuniao;
  loggedUser: LoggedUser;
  onIntegrarNaAta?: (textoDeliberacoes: string) => void;
}

export function VotacaoAssembleiaVirtual({ predio, fracoes, reuniao, loggedUser, onIntegrarNaAta }: VotacaoAssembleiaVirtualProps) {
  const predioFracoes = fracoes.filter(f => f.id_predio === predio.id_predio);
  const totalPermilagemPredio = predioFracoes.reduce((acc, f) => acc + f.permilagem, 0) || 1000;

  // Points / Motions for the meeting
  const [pontos, setPontos] = useState<PontoVotacaoAssembleia[]>([]);

  const [pontoAtivoId, setPontoAtivoId] = useState<string>("");
  const [novoPontoTitulo, setNovoPontoTitulo] = useState("");
  const [novoPontoDesc, setNovoPontoDesc] = useState("");
  const [novoPontoMaioria, setNovoPontoMaioria] = useState<"MAIORIA_SIMPLES" | "MAIORIA_QUALIFICADA_2_3" | "UNANIMIDADE">("MAIORIA_SIMPLES");
  const [showNovoPontoModal, setShowNovoPontoModal] = useState(false);

  const pontoAtivo = pontos.find(p => p.id_ponto === pontoAtivoId) || pontos[0];

  // Calculate vote totals for the active motion
  const calcularTotais = (ponto?: PontoVotacaoAssembleia) => {
    if (!ponto) return { favor: 0, contra: 0, abstencao: 0, totalVotado: 0, aprovado: false };
    let favor = 0;
    let contra = 0;
    let abstencao = 0;

    (ponto.votos || []).forEach(v => {
      if (v.voto === "FAVOR") favor += v.permilagem;
      else if (v.voto === "CONTRA") contra += v.permilagem;
      else if (v.voto === "ABSTENCAO") abstencao += v.permilagem;
    });

    const totalVotado = favor + contra + abstencao;
    let aprovado = false;

    if (ponto.tipo_maioria === "MAIORIA_SIMPLES") {
      aprovado = favor > contra;
    } else if (ponto.tipo_maioria === "MAIORIA_QUALIFICADA_2_3") {
      aprovado = favor >= 667; // 2/3 of 1000 permilagem
    } else if (ponto.tipo_maioria === "UNANIMIDADE") {
      aprovado = favor >= 1000;
    }

    return { favor, contra, abstencao, totalVotado, aprovado };
  };

  const { favor, contra, abstencao, totalVotado, aprovado } = calcularTotais(pontoAtivo);

  // Cast vote for a specific fraction in the active motion
  const registarVoto = (fracaoId: string, tipoVoto: "FAVOR" | "CONTRA" | "ABSTENCAO") => {
    const fracao = predioFracoes.find(f => f.id_fracao === fracaoId);
    if (!fracao) return;

    setPontos(prev => prev.map(p => {
      if (p.id_ponto === pontoAtivo.id_ponto) {
        const votosAtuais = p.votos || [];
        const semEste = votosAtuais.filter(v => v.id_fracao !== fracaoId);
        const novoVoto = {
          id_fracao: fracaoId,
          fracao_nome: fracao.fracao_nome,
          proprietario: fracao.proprietario.nome,
          permilagem: fracao.permilagem,
          voto: tipoVoto,
          data_hora: new Date().toISOString().replace("T", " ").substring(0, 19),
          canal: "PWA_ONLINE" as const
        };
        return {
          ...p,
          votos: [...semEste, novoVoto]
        };
      }
      return p;
    }));
  };

  // Switch motion status
  const alternarEstadoPonto = (novoEstado: "ABERTA" | "EM_VOTACAO" | "CONCLUIDA") => {
    setPontos(prev => prev.map(p => {
      if (p.id_ponto === pontoAtivo.id_ponto) {
        const { favor: fv, contra: ct, abstencao: ab, aprovado: ap } = calcularTotais(p);
        let textoDelib = "";
        if (ap) {
          textoDelib = `Submetido a votação na Ordem de Trabalhos (Ponto ${p.ordem}), a proposta foi APROVADA com ${fv}‰ votos a favor, ${ct}‰ votos contra e ${ab}‰ abstenções, nos termos do Art. 1432.º do Código Civil.`;
        } else {
          textoDelib = `Submetido a votação (Ponto ${p.ordem}), a proposta foi REJEITADA com ${fv}‰ votos a favor, ${ct}‰ contra e ${ab}‰ abstenções.`;
        }
        return {
          ...p,
          estado: novoEstado,
          total_favor_permilagem: fv,
          total_contra_permilagem: ct,
          total_abstencao_permilagem: ab,
          aprovado: ap,
          deliberacao_texto: textoDelib
        };
      }
      return p;
    }));
  };

  // Add new voting motion
  const adicionarNovoPonto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoPontoTitulo) return;

    const novo: PontoVotacaoAssembleia = {
      id_ponto: `ponto-${Date.now()}`,
      id_reuniao: reuniao?.id_reuniao || "reu-1",
      ordem: pontos.length + 1,
      titulo: novoPontoTitulo,
      descricao: novoPontoDesc,
      tipo_maioria: novoPontoMaioria,
      estado: "ABERTA",
      votos: [],
      total_favor_permilagem: 0,
      total_contra_permilagem: 0,
      total_abstencao_permilagem: 0
    };

    setPontos(prev => [...prev, novo]);
    setPontoAtivoId(novo.id_ponto);
    setNovoPontoTitulo("");
    setNovoPontoDesc("");
    setShowNovoPontoModal(false);
  };

  // Compile all deliberations for the minutes
  const gerarResumoDeliberacoesAta = () => {
    let texto = "REGISTO OFICIAL DE VOTAÇÕES E DELIBERAÇÕES DA ASSEMBLEIA:\n\n";
    pontos.forEach((p) => {
      const { favor: fv, contra: ct, abstencao: ab, aprovado: ap } = calcularTotais(p);
      const maioriaLabel = p.tipo_maioria === "MAIORIA_QUALIFICADA_2_3" ? "Maioria Qualificada de 2/3 (667‰)" : p.tipo_maioria === "UNANIMIDADE" ? "Unanimidade (1000‰)" : "Maioria Simples do Quórum";

      texto += `Ponto ${p.ordem}: ${p.titulo}\n`;
      texto += `Tipo de Exigência Legal: ${maioriaLabel}\n`;
      texto += `Resultado da Votação: ${ap ? "APROVADO" : "REJEITADO"} (${fv}‰ A FAVOR | ${ct}‰ CONTRA | ${ab}‰ ABSTENÇÃO)\n`;
      texto += `Deliberação Formal: ${p.deliberacao_texto || (ap ? "Aprovado pelos condóminos com força vinculativa e executiva." : "Rejeitado pela assembleia.")}\n\n`;
    });

    if (onIntegrarNaAta) {
      onIntegrarNaAta(texto);
      alert("✨ Resultados das votações integrados com sucesso no texto da Ata Oficial!");
    } else {
      navigator.clipboard.writeText(texto);
      alert("Texto das deliberações copiado para a área de transferência!");
    }
  };

  // Export official voting report PDF
  const exportarBoletimVotacoesPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    addPdfWatermark(doc);
    addPdfHeaderWithLogo(doc, predio.nome);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Assembleia Geral: ${reuniao?.tema || "Assembleia Geral de Condóminos"}`, 14, 45);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Data: ${reuniao?.data || formatDatePT(new Date().toISOString())} | Quórum Total do Prédio: 1000‰`, 14, 50);

    let yPos = 60;

    pontos.forEach((p) => {
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }

      const { favor: fv, contra: ct, abstencao: ab, aprovado: ap } = calcularTotais(p);

      doc.setFillColor(241, 245, 249);
      doc.roundedRect(14, yPos, 182, 14, 2, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(`Ponto ${p.ordem}: ${p.titulo}`, 18, yPos + 6);

      doc.setFontSize(8);
      doc.setTextColor(ap ? 16 : 220, ap ? 149 : 38, ap ? 193 : 38);
      doc.text(`Resultado: ${ap ? "APROVADO" : "REJEITADO"} (${fv}‰ Favor, ${ct}‰ Contra, ${ab}‰ Abst)`, 18, yPos + 11);

      yPos += 18;
    });

    // Signature line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("O Presidente da Mesa da Assembleia / O Administrador do Condomínio:", 14, yPos + 15);
    doc.line(14, yPos + 30, 100, yPos + 30);
    doc.text(`${loggedUser.nome || "Administração"}`, 14, yPos + 35);

    const blob = doc.output("blob");
    downloadBlob(blob, `Boletim_Votacoes_${Date.now()}.pdf`);
    alert("📄 Boletim Oficial de Votações em PDF descarregado com sucesso!");
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1">
              <Vote className="h-3.5 w-3.5" /> Assembleia Virtual & Votação PWA
            </span>
            <span className="text-xs text-slate-300 font-mono">Art. 1432.º Código Civil</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">Votação em Tempo Real por Permilagem (‰)</h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Permita que os condóminos votem a partir do seu telemóvel ou presencialmente. O sistema calcula a permilagem exata em direto e redige as deliberações com força jurídica para a ata.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNovoPontoModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="h-4 w-4 text-emerald-400" />
            <span>Adicionar Ponto de Votação</span>
          </button>
          
          <button
            type="button"
            onClick={gerarResumoDeliberacoesAta}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            <span>Integrar Deliberações na Ata</span>
          </button>

          <button
            type="button"
            onClick={exportarBoletimVotacoesPDF}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="h-4 w-4 text-indigo-400" />
            <span>Boletim PDF</span>
          </button>
        </div>
      </div>

      {/* Motions Navigation Bar or Empty State */}
      {pontos.length === 0 || !pontoAtivo ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto border border-indigo-200 dark:border-indigo-800">
            <Vote className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Nenhum ponto de deliberação adicionado</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Adicione os pontos da Ordem de Trabalhos da reunião para abrir votações eletrónicas aos condóminos e apurar automaticamente as maiorias legais (simples, 2/3 ou unanimidade).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNovoPontoModal(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm inline-flex items-center gap-2 cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Adicionar Primeiro Ponto</span>
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pontos.map((p) => {
              const isSelected = p.id_ponto === pontoAtivo.id_ponto;
              const { aprovado: ap } = calcularTotais(p);

              return (
                <button
                  key={p.id_ponto}
                  type="button"
                  onClick={() => setPontoAtivoId(p.id_ponto)}
                  className={`px-4 py-3 rounded-2xl border text-left shrink-0 transition-all cursor-pointer min-w-[240px] max-w-[300px] ${
                    isSelected 
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md" 
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-indigo-400"
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase mb-1">
                    <span>Ponto {p.ordem}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] ${
                      isSelected ? "bg-white/20 text-white" : p.estado === "EM_VOTACAO" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    }`}>
                      {p.estado === "EM_VOTACAO" ? "A Votar Agora" : p.estado === "CONCLUIDA" ? (ap ? "Aprovado" : "Rejeitado") : "Agendado"}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs line-clamp-1">{p.titulo}</h4>
                </button>
              );
            })}
          </div>

          {/* Active Motion Live Workspace */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">Ponto {pontoAtivo.ordem} da Ordem de Trabalhos</span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-600 dark:text-slate-300">
                {pontoAtivo.tipo_maioria === "MAIORIA_QUALIFICADA_2_3" ? "Maioria 2/3 (667‰)" : pontoAtivo.tipo_maioria === "UNANIMIDADE" ? "Unanimidade (1000‰)" : "Maioria Simples"}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{pontoAtivo.titulo}</h3>
            {pontoAtivo.descricao && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{pontoAtivo.descricao}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {pontoAtivo.estado !== "EM_VOTACAO" ? (
              <button
                type="button"
                onClick={() => alternarEstadoPonto("EM_VOTACAO")}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <PlayCircle className="h-4 w-4" />
                <span>Abrir Votação na PWA</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => alternarEstadoPonto("CONCLUIDA")}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <StopCircle className="h-4 w-4" />
                <span>Encerrar & Apurar Deliberação</span>
              </button>
            )}
          </div>
        </div>

        {/* Real-time Vote Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
            <div className="flex justify-between items-center text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> VOTOS A FAVOR</span>
              <span className="font-mono text-base font-black">{favor}‰</span>
            </div>
            <div className="w-full bg-emerald-200/50 dark:bg-emerald-900/50 h-2 rounded-full mt-2 overflow-hidden">
              <div className="bg-emerald-600 h-full transition-all duration-500" style={{ width: `${(favor / 1000) * 100}%` }} />
            </div>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold block mt-1">
              {((favor / totalPermilagemPredio) * 100).toFixed(1)}% do capital do prédio
            </span>
          </div>

          <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-xl border border-red-200 dark:border-red-900/50">
            <div className="flex justify-between items-center text-xs font-bold text-red-800 dark:text-red-300">
              <span className="flex items-center gap-1.5"><XCircle className="h-4 w-4" /> VOTOS CONTRA</span>
              <span className="font-mono text-base font-black">{contra}‰</span>
            </div>
            <div className="w-full bg-red-200/50 dark:bg-red-900/50 h-2 rounded-full mt-2 overflow-hidden">
              <div className="bg-red-600 h-full transition-all duration-500" style={{ width: `${(contra / 1000) * 100}%` }} />
            </div>
            <span className="text-[10px] text-red-700 dark:text-red-400 font-semibold block mt-1">
              {((contra / totalPermilagemPredio) * 100).toFixed(1)}% do capital do prédio
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5"><MinusCircle className="h-4 w-4" /> ABSTENÇÕES</span>
              <span className="font-mono text-base font-black">{abstencao}‰</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mt-2 overflow-hidden">
              <div className="bg-slate-500 h-full transition-all duration-500" style={{ width: `${(abstencao / 1000) * 100}%` }} />
            </div>
            <span className="text-[10px] text-slate-500 font-semibold block mt-1">
              {((abstencao / totalPermilagemPredio) * 100).toFixed(1)}% do capital do prédio
            </span>
          </div>
        </div>

        {/* Voting Table for Every Fraction */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-indigo-500" />
              <span>Votação Individual das Frações Autónomas</span>
            </h4>
            <span className="text-xs font-mono text-slate-500">
              Total Votado: {totalVotado}‰ / 1000‰
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="p-3">Fração / Piso</th>
                  <th className="p-3">Proprietário</th>
                  <th className="p-3">Permilagem</th>
                  <th className="p-3">Sentido de Voto</th>
                  <th className="p-3">Canal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {predioFracoes.map((f) => {
                  const votoRegistado = (pontoAtivo.votos || []).find(v => v.id_fracao === f.id_fracao);
                  const currentVoto = votoRegistado?.voto;

                  return (
                    <tr key={f.id_fracao} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-slate-900 dark:text-white">
                        Fração {f.fracao_nome} <span className="text-[10px] text-slate-400 font-normal">({f.piso})</span>
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">{f.proprietario.nome}</td>
                      <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{f.permilagem}‰</td>
                      <td className="p-3">
                        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-800 text-xs">
                          <button
                            type="button"
                            onClick={() => registarVoto(f.id_fracao, "FAVOR")}
                            className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                              currentVoto === "FAVOR" ? "bg-emerald-600 text-white" : "text-slate-600 hover:text-emerald-600"
                            }`}
                          >
                            A Favor
                          </button>
                          <button
                            type="button"
                            onClick={() => registarVoto(f.id_fracao, "CONTRA")}
                            className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                              currentVoto === "CONTRA" ? "bg-red-600 text-white" : "text-slate-600 hover:text-red-600"
                            }`}
                          >
                            Contra
                          </button>
                          <button
                            type="button"
                            onClick={() => registarVoto(f.id_fracao, "ABSTENCAO")}
                            className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                              currentVoto === "ABSTENCAO" ? "bg-slate-600 text-white" : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            Abster
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-[10px] font-mono text-slate-400">
                        {votoRegistado ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="h-3 w-3" /> PWA ({votoRegistado.data_hora?.split(" ")[1] || "Agora"})
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Aguarda Voto</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )}

      {/* New Motion Modal */}
      {showNovoPontoModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={adicionarNovoPonto} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Vote className="h-4 w-4 text-indigo-600" />
                <span>Novo Ponto da Ordem de Trabalhos</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNovoPontoModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Título da Deliberação *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aprovação de Obras no Telhado"
                  value={novoPontoTitulo}
                  onChange={e => setNovoPontoTitulo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Exigência de Quórum / Maioria Legal</label>
                <select
                  value={novoPontoMaioria}
                  onChange={e => setNovoPontoMaioria(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                >
                  <option value="MAIORIA_SIMPLES">Maioria Simples dos Votos Presentes (Art. 1432.º)</option>
                  <option value="MAIORIA_QUALIFICADA_2_3">Maioria Qualificada de 2/3 (667‰) - Obras / Inovações</option>
                  <option value="UNANIMIDADE">Unanimidade (1000‰) - Alteração do Título Constitutivo</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Descrição / Detalhes da Proposta</label>
                <textarea
                  rows={3}
                  placeholder="Explicação da proposta que será lida e votada pelos condóminos..."
                  value={novoPontoDesc}
                  onChange={e => setNovoPontoDesc(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowNovoPontoModal(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Criar Ponto de Votação
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
