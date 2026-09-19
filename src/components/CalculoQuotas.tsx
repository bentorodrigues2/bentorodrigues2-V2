import React, { useState, useMemo, useEffect } from "react";
import { 
  Calculator, 
  Landmark, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  CreditCard, 
  Layers,
  ArrowRight,
  Info,
  Save
} from "lucide-react";
import { Predio, Fracao, Conta, Aviso, LoggedUser } from "../types";
import type { ObraExtraordinaria } from "./GestaoManutencaoIntervencoes";
import { jsPDF } from "jspdf";
import { saveConfiguracaoQuotasToSupabase, saveAvisosToSupabase, registarLogAuditoria, fetchObrasExtraFromSupabase } from "../lib/supabaseService";
import { parseValorMonetario, gerarReferenciaBR23E, exportarBalanceteMapaAnualXLS } from "../utils";

interface CalculoQuotasProps {
  predio: Predio;
  fracoes: Fracao[];
  contas: Conta[];
  avisos?: Aviso[];
  setAvisos?: React.Dispatch<React.SetStateAction<Aviso[]>>;
  loggedUser: LoggedUser;
}

export function CalculoQuotas({
  predio,
  fracoes,
  contas,
  avisos = [],
  setAvisos,
  loggedUser,
}: CalculoQuotasProps) {
  // Frações do prédio atual
  const predioFracoes = useMemo(
    () => fracoes.filter((f) => f.id_predio === predio.id_predio),
    [fracoes, predio.id_predio]
  );

  // Contas bancárias do prédio atual
  const predioContas = useMemo(
    () => contas.filter((c) => c.id_predio === predio.id_predio),
    [contas, predio.id_predio]
  );

  // Permilagem total
  const totalPermilagem = useMemo(
    () => predioFracoes.reduce((acc, curr) => acc + (Number(curr.permilagem) || 0), 0),
    [predioFracoes]
  );

  // Quota ordinária mensal: só de leitura, derivada do mesmo Orçamento Anual
  // que já alimenta a emissão automática real (dia 25, ver cronService.js /
  // Gestão de Emissão) — não editável aqui, para não criar uma segunda fonte
  // de verdade que duplicasse quotas ordinárias no mesmo mês.
  const orcamentoRegular = String(Math.round(((Number((predio.patrimonio as any)?.orcamento_anual) || 0) / 12) * 100) / 100);
  const [dataLimiteRegular, setDataLimiteRegular] = useState<string>(() => {
    const d = new Date();
    d.setDate(8);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  });
  const [contaOrdinariaId, setContaOrdinariaId] = useState<string>(() => {
    const ord = predioContas.find((c) => c.tipo === "Ordem" || c.tipo === "DO" || c.is_principal);
    return ord ? ord.id_conta : predioContas[0]?.id_conta || "";
  });

  const [orcamentoExtra, setOrcamentoExtra] = useState<string>("");
  const [numPrestacoesExtra, setNumPrestacoesExtra] = useState<number>(1);
  const [dataLimiteExtra, setDataLimiteExtra] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    return d.toISOString().split("T")[0];
  });
  const [descricaoExtra, setDescricaoExtra] = useState<string>("");

  // Obras adjudicadas reais (Portal de Orçamentos → Obras & Contratação) —
  // antes esta secção não tinha nenhuma ligação real à obra, só um campo de
  // texto livre "Finalidade/Descrição" que o administrador escrevia à mão,
  // sem relação nenhuma com a obra e o fornecedor já adjudicados.
  const [obrasExtra, setObrasExtra] = useState<ObraExtraordinaria[]>([]);
  const [obraSelecionadaId, setObraSelecionadaId] = useState<string>("");
  useEffect(() => {
    fetchObrasExtraFromSupabase(predio.id_predio).then((dados) => setObrasExtra(dados || []));
  }, [predio.id_predio]);
  const obrasAdjudicadasParaQuota = obrasExtra.filter((o) => o.necessitaCotaExtra && !!o.id_divida);
  const obraSelecionada = obrasAdjudicadasParaQuota.find((o) => o.id === obraSelecionadaId) || null;

  const handleSelecionarObra = (id: string) => {
    setObraSelecionadaId(id);
    if (!id) return;
    const obra = obrasAdjudicadasParaQuota.find((o) => o.id === id);
    if (!obra) return;
    setDescricaoExtra(`${obra.descricao} — ${obra.fornecedorNome}`);
    setOrcamentoExtra(String(obra.custoTotal));
    // O faseamento simulado/escolhido no Portal de Orçamentos ao adjudicar
    // (obra.mesesFracionamento) passa a ser o número de prestações aqui —
    // sem isto, o plano simulado ficava só "no papel" e tinha de ser
    // reintroduzido manualmente ao emitir a quota extra.
    if (obra.mesesFracionamento && obra.mesesFracionamento > 0) {
      setNumPrestacoesExtra(obra.mesesFracionamento);
    }
  };
  const [contaExtraId, setContaExtraId] = useState<string>(() => {
    const fcr = predioContas.find(
      (c) => c.tipo === "Poupanca" || c.tipo === "Fundo de Reserva" || c.descricao?.toLowerCase().includes("reserva")
    );
    return fcr ? fcr.id_conta : predioContas[0]?.id_conta || "";
  });

  const [sucessoEmissao, setSucessoEmissao] = useState<string | null>(null);

  // Conta Ordinária Selecionada
  const contaOrdinariaSel = useMemo(
    () => predioContas.find((c) => c.id_conta === contaOrdinariaId) || predioContas[0],
    [predioContas, contaOrdinariaId]
  );

  // Conta Extraordinária Selecionada
  const contaExtraSel = useMemo(
    () => predioContas.find((c) => c.id_conta === contaExtraId) || predioContas[1] || predioContas[0],
    [predioContas, contaExtraId]
  );

  // Cálculo individual da parcela extraordinária por mês se tiver prestações
  const extVal = parseValorMonetario(orcamentoExtra) || 0;
  const extraPorMesTotal = extVal / (numPrestacoesExtra || 1);

  // Taxa por permilagem da quota ordinária mensal, com o mesmo coeficiente
  // real das lojas com acesso exterior usado em GestaoEmissao.tsx/
  // cronService.js — antes esta pré-visualização calculava só por
  // permilagem pura (sem a exceção das lojas), por isso a "Quota Ordinária"
  // mostrada aqui nunca batia certo com o valor que a fração paga de facto.
  const COEF_LOJA_EXTERIOR = 0.4528;
  const isLojaExterior = (f: Fracao) => f.tipologia === "Loja Comercial" && (f.tipo_access || "").includes("Exterior");
  const { rateNormalOrdinaria, rateLojaOrdinaria } = useMemo(() => {
    let permilagemLoja = 0;
    predioFracoes.forEach((f) => { if (isLojaExterior(f)) permilagemLoja += f.permilagem; });
    const permilagemNormal = 1000 - permilagemLoja;
    const denominador = permilagemNormal + permilagemLoja * COEF_LOJA_EXTERIOR;
    const rN = denominador > 0 ? (Number(orcamentoRegular) || 0) / denominador : 0;
    return { rateNormalOrdinaria: rN, rateLojaOrdinaria: rN * COEF_LOJA_EXTERIOR };
  }, [predioFracoes, orcamentoRegular]);

  const calcularQuotaOrdinaria = (f: Fracao) => f.permilagem * (isLojaExterior(f) ? rateLojaOrdinaria : rateNormalOrdinaria);

  // Emitir Quotas Extraordinárias em Lote diretamente para Avisos.
  // A quota ordinária mensal NÃO se emite aqui — é sempre a emissão
  // automática real (dia 25, cronService.js) que trata disso, para nunca
  // haver duas fontes a criar avisos de quota ordinária para o mesmo mês.
  const handleEmitirQuotasEmLote = () => {
    if (totalPermilagem !== 1000) {
      alert(
        "Atenção: A soma das permilagens é de " +
          totalPermilagem +
          "‰ (deve somar 1000‰ para conformidade com o Código Civil). Pode emitir com caráter provisório ou retificar nas Frações."
      );
    }

    if (!setAvisos) {
      alert("Sistema de avisos não disponível de momento.");
      return;
    }

    if (extVal <= 0) {
      alert("Por favor defina um orçamento extraordinário superior a 0€!");
      return;
    }

    const d = new Date();
    const dataEmissao = d.toISOString().split("T")[0];
    const novosAvisos: Aviso[] = [];

    predioFracoes.forEach((f) => {
      // Quota Extraordinária
      if (extVal > 0) {
        const valorExtraMensal = Math.round((extraPorMesTotal * (f.permilagem / 1000)) * 100) / 100;
        novosAvisos.push({
          id_aviso: `av-ext-${Date.now()}-${f.id_fracao}`,
          id_predio: predio.id_predio,
          id_fracao: f.id_fracao,
          tipo: "Quota Extraordinária",
          data: dataEmissao,
          vencimento: dataLimiteExtra,
          descricao: `Quota Extraordinária (1/${numPrestacoesExtra}): ${descricaoExtra} (IBAN: ${contaExtraSel?.iban || "FCR"})`,
          valor: valorExtraMensal,
          estado: "Pendente",
          id_obra: obraSelecionadaId || undefined,
          // Fotografia do proprietário no momento da emissão — mantém o
          // aviso atribuído a quem devia na altura, mesmo que a fração mude
          // de proprietário mais tarde (Transferência de Propriedade).
          proprietario_nome: f.proprietario?.nome,
          proprietario_nif: f.proprietario?.nif,
        });
      }
    });

    setAvisos((prev) => [...novosAvisos, ...prev]);

    // Persistir configuração no Supabase (orcamento_regular fica só como
    // registo informativo do valor real em vigor, não é usado para emitir)
    saveConfiguracaoQuotasToSupabase({
      id_predio: predio.id_predio,
      ano_exercicio: new Date().getFullYear(),
      orcamento_regular: Number(orcamentoRegular) || 0,
      data_limite_regular: dataLimiteRegular,
      id_conta_ordinaria: contaOrdinariaId,
      orcamento_extra: extVal,
      num_prestacoes_extra: numPrestacoesExtra,
      descricao_extra: descricaoExtra,
      data_limite_extra: dataLimiteExtra,
      id_conta_extraordinaria: contaExtraId
    }).catch(console.error);

    saveAvisosToSupabase(novosAvisos).catch(console.error);

    registarLogAuditoria(
      "Financeira",
      `Emitiu ${novosAvisos.length} avisos de quota extraordinária em lote`,
      predio.id_predio,
      loggedUser,
      `Extra: ${extVal}€`
    );

    if (extVal > 0) {
      const destinatarios = predioFracoes
        .filter(f => f.proprietario?.email)
        .map(f => ({ email: f.proprietario.email, nome: f.proprietario.nome }));
      if (destinatarios.length > 0) {
        fetch("/api/email?acao=broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destinatarios,
            assunto: `Aviso de Quota Extraordinária — ${descricaoExtra || predio.nome}`,
            mensagem: `Foi emitida uma quota extraordinária: <strong>${descricaoExtra}</strong>.<br><br>A liquidar em ${numPrestacoesExtra} prestação(ões), com data limite da primeira prestação a ${dataLimiteExtra}.<br><br>Consulte o valor correspondente à sua fração na plataforma.`
          })
        }).catch(console.error);
      }
    }

    setSucessoEmissao(
      `Emitidos com sucesso ${novosAvisos.length} avisos e guardada configuração no Supabase interligada às contas (${contaOrdinariaSel?.banco || "Conta Principal"} / ${contaExtraSel?.banco || "Conta FCR"}).`
    );
    setTimeout(() => setSucessoEmissao(null), 7000);
  };

  // Exportar Mapa de Quotas em PDF Oficial
  const handleExportarPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Topo Cabeçalho
      doc.setFillColor(15, 23, 42); // Slate-900
      doc.rect(0, 0, pageWidth, 28, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text("MAPA DE CÁLCULO E REPARTIÇÃO DE QUOTAS", 14, 13);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(203, 213, 225);
      doc.text(
        `${predio.nome.toUpperCase()} • NIF: ${predio.nif || "N/A"} • ${new Date().toLocaleDateString("pt-PT")}`,
        14,
        21
      );

      // Resumo de Orçamento e Contas Bancárias
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Parâmetros Orçamentais & Contas Bancárias de Crédito", 14, 38);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.text(`• Orçamento Ordinário Mensal: ${Number(orcamentoRegular).toFixed(2)} €`, 14, 45);
      doc.text(`• Conta de Crédito (Ordinárias): ${contaOrdinariaSel?.banco || "Geral"} - IBAN: ${contaOrdinariaSel?.iban || "N/A"}`, 14, 50);
      doc.text(`• Data Limite Pagamento Ordinárias: ${dataLimiteRegular}`, 14, 55);

      doc.text(`• Orçamento Extraordinário: ${parseValorMonetario(orcamentoExtra).toFixed(2)} € (${numPrestacoesExtra} prestações de ${extraPorMesTotal.toFixed(2)} €/mês)`, 14, 62);
      doc.text(`• Finalidade: ${descricaoExtra}`, 14, 67);
      doc.text(`• Conta de Crédito (Extraordinárias): ${contaExtraSel?.banco || "FCR"} - IBAN: ${contaExtraSel?.iban || "N/A"}`, 14, 72);

      // Linha Divisória
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 77, pageWidth - 14, 77);

      // Tabela de Quotas
      let y = 85;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, pageWidth - 28, 8, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text("FRAÇÃO", 16, y + 5.5);
      doc.text("CONDÓMINO", 45, y + 5.5);
      doc.text("PERM.", 95, y + 5.5);
      doc.text("Q. ORDINÁRIA", 115, y + 5.5);
      doc.text("Q. EXTRAORD.", 145, y + 5.5);
      doc.text("TOTAL / MÊS", 175, y + 5.5);

      y += 10;
      doc.setFont("helvetica", "normal");

      predioFracoes.forEach((f) => {
        const regShare = calcularQuotaOrdinaria(f);
        const extShare = extraPorMesTotal * (f.permilagem / 1000);
        const totalShare = regShare + extShare;

        doc.text(`Fração ${f.fracao_nome}`, 16, y);
        doc.text((f.proprietario?.nome || "Vago").substring(0, 25), 45, y);
        doc.text(`${f.permilagem}‰`, 95, y);
        doc.text(`${regShare.toFixed(2)} €`, 115, y);
        doc.text(`${extShare.toFixed(2)} €`, 145, y);
        doc.setFont("helvetica", "bold");
        doc.text(`${totalShare.toFixed(2)} €`, 175, y);
        doc.setFont("helvetica", "normal");

        y += 7;
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      });

      // Rodapé
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Emitido pela Administração do Condomínio ${predio.nome} • Software de Gestão Certificado`,
        14,
        285
      );

      doc.save(`Mapa_Calculo_Quotas_${predio.nome.replace(/\s+/g, "_")}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Erro ao exportar PDF do Mapa de Quotas.");
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Principal do Módulo */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold mb-2 border border-emerald-200">
            <Calculator className="w-3.5 h-3.5" />
            <span>Módulo Financeiro Oficial</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span>Cálculo & Emissão de Quotas</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Mapa de repartição da quota ordinária mensal (automática, ver Gestão de Emissão) e emissão de quotas extraordinárias, interligadas diretamente com as contas bancárias do edifício.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportarPDF}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border border-slate-300 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Descarregar Mapa (PDF)</span>
          </button>

          {loggedUser.role === "ADMIN" && (
            <button
              type="button"
              id="btn-guardar-quotas-supabase"
              onClick={handleEmitirQuotasEmLote}
              disabled={(parseValorMonetario(orcamentoExtra) || 0) <= 0}
              title={(parseValorMonetario(orcamentoExtra) || 0) <= 0 ? "Define um Orçamento Extraordinário para emitir — a quota ordinária é sempre automática (dia 25)." : undefined}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Emitir Quota Extraordinária</span>
            </button>
          )}
        </div>
      </div>

      {sucessoEmissao && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-xl flex items-center gap-3 animate-fadeIn shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-xs font-bold">{sucessoEmissao}</p>
        </div>
      )}

      {/* Banner de Validação de Permilagem Legal */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          totalPermilagem === 1000
            ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
            : "bg-amber-50/80 border-amber-200 text-amber-900"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              totalPermilagem === 1000 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {totalPermilagem === 1000 ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider">
              {totalPermilagem === 1000
                ? "Integridade Jurídica Conforme (Art. 1418.º do Código Civil)"
                : "Aviso de Permilagem do Edifício"}
            </h4>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {totalPermilagem === 1000
                ? "A soma das permilagens totaliza exatamente 1000‰ legais. A partilha de encargos é estritamente proporcional."
                : `A soma das frações é de ${totalPermilagem}‰. Recomenda-se retificar para 1000‰ para validade fiscal plena.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono font-black text-sm px-3 py-1 bg-white rounded-lg border border-slate-200 shadow-xs">
            {totalPermilagem}‰ / 1000‰
          </span>
        </div>
      </div>

      {/* GRELHA DE CONFIGURAÇÃO DE QUOTAS & CONTAS BANCÁRIAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Quotas Mensais Ordinárias */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Quotas Ordinárias Mensais</h3>
                <p className="text-[10px] text-slate-400">Despesas correntes (limpeza, eletricidade, elevadores, seguro)</p>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
              Corrente
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Orçamento Mensal Global (€)
              </label>
              <input
                type="number"
                value={orcamentoRegular}
                readOnly
                disabled
                title="Valor real em vigor, vindo do Orçamento Anual definido em Gestão de Emissão — não editável aqui para nunca duplicar a emissão automática mensal (dia 25)."
                className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl bg-slate-100 font-mono font-bold text-slate-500 cursor-not-allowed"
              />
              <p className="text-[9.5px] text-slate-400 mt-1">Vem do Orçamento Anual em Gestão de Emissão. A quota ordinária é sempre emitida automaticamente no dia 25 — aqui só se emite a extraordinária.</p>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Dia Limite de Pagamento Mensal
              </label>
              <input
                type="date"
                value={dataLimiteRegular}
                onChange={(e) => setDataLimiteRegular(e.target.value)}
                className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-emerald-500 bg-white font-medium"
              />
            </div>
          </div>

          {/* Interligação com Contas Bancárias (Conta à Ordem) */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-emerald-600" />
                <span>Conta Bancária de Destino (Ordinárias)</span>
              </label>
              <span className="text-[9px] font-bold text-slate-500">
                {predioContas.length} Contas Registadas
              </span>
            </div>

            {predioContas.length === 0 ? (
              <p className="text-xs text-amber-700 font-medium">
                Nenhuma conta bancária registada para este condomínio. Vá ao menu "Contas Bancárias" para registar.
              </p>
            ) : (
              <select
                value={contaOrdinariaId}
                onChange={(e) => setContaOrdinariaId(e.target.value)}
                className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl bg-white font-bold text-slate-800 cursor-pointer focus:outline-emerald-500"
              >
                {predioContas.map((c) => (
                  <option key={c.id_conta} value={c.id_conta}>
                    {c.banco} • {c.descricao || c.tipo} ({c.saldo_atual?.toFixed(2) || 0} €)
                  </option>
                ))}
              </select>
            )}

            {contaOrdinariaSel && (
              <div className="pt-1 flex flex-wrap items-center justify-between text-[11px] text-slate-600">
                <span className="font-mono font-semibold">IBAN: {contaOrdinariaSel.iban}</span>
                <span className="font-bold text-emerald-700">Saldo: {contaOrdinariaSel.saldo_atual?.toFixed(2) || 0} €</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Quotas Extraordinárias (Obras / Fundo de Reserva) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Quotas Extraordinárias (Obras / FCR)</h3>
                <p className="text-[10px] text-slate-400">Encargos com conservação excecional e obras deliberadas em assembleia</p>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-sky-100 text-sky-800 rounded">
              Extraordinária
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Valor Total Orçado (€)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={orcamentoExtra}
                onChange={(e) => setOrcamentoExtra(e.target.value)}
                className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-sky-500 bg-slate-50/50 font-mono font-bold"
                placeholder="Ex: 5000"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                N.º de Prestações
              </label>
              <select
                value={numPrestacoesExtra}
                onChange={(e) => setNumPrestacoesExtra(Number(e.target.value))}
                className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-sky-500 bg-white font-bold"
              >
                <option value={1}>1x (Pagamento Único)</option>
                <option value={2}>2x Prestações</option>
                <option value={3}>3x Prestações</option>
                <option value={5}>5x Prestações</option>
                <option value={6}>6x Prestações</option>
                <option value={10}>10x Prestações</option>
                <option value={12}>12x Prestações</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Prazo Limite (1.ª Prestação)
              </label>
              <input
                type="date"
                value={dataLimiteExtra}
                onChange={(e) => setDataLimiteExtra(e.target.value)}
                className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-sky-500 bg-white font-medium"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Obra Adjudicada
            </label>
            <select
              value={obraSelecionadaId}
              onChange={(e) => handleSelecionarObra(e.target.value)}
              className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-sky-500 bg-white font-bold text-slate-800 cursor-pointer"
            >
              <option value="">-- Sem obra ligada (finalidade livre, ex: reforço geral do FCR) --</option>
              {obrasAdjudicadasParaQuota.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.descricao} — {o.fornecedorNome} ({o.custoTotal.toFixed(2)} €) [{o.estado}]
                </option>
              ))}
            </select>
            {obrasAdjudicadasParaQuota.length === 0 && (
              <p className="text-[10px] text-slate-400 mt-1">
                Nenhuma obra adjudicada a pedir quota extra de momento (Obras & Contratação → Obras Adjudicadas & Execução).
              </p>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Finalidade / Descrição {obraSelecionada && <span className="text-sky-600 normal-case font-medium">(preenchida a partir da obra selecionada, pode ajustar)</span>}
            </label>
            <input
              type="text"
              value={descricaoExtra}
              onChange={(e) => setDescricaoExtra(e.target.value)}
              className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-sky-500 bg-white font-medium text-slate-800"
              placeholder="Ex: Impermeabilização da cobertura e reparação de caleiras"
            />
          </div>

          {/* Interligação com Contas Bancárias (Conta FCR / Poupança) */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-sky-600" />
                <span>Conta Bancária de Destino (FCR / Obras)</span>
              </label>
              <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                {extraPorMesTotal.toFixed(2)} €/mês total
              </span>
            </div>

            {predioContas.length === 0 ? (
              <p className="text-xs text-amber-700 font-medium">
                Sem conta bancária registada para afetação extraordinária.
              </p>
            ) : (
              <select
                value={contaExtraId}
                onChange={(e) => setContaExtraId(e.target.value)}
                className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl bg-white font-bold text-slate-800 cursor-pointer focus:outline-sky-500"
              >
                {predioContas.map((c) => (
                  <option key={c.id_conta} value={c.id_conta}>
                    {c.banco} • {c.descricao || c.tipo} ({c.saldo_atual?.toFixed(2) || 0} €)
                  </option>
                ))}
              </select>
            )}

            {contaExtraSel && (
              <div className="pt-1 flex flex-wrap items-center justify-between text-[11px] text-slate-600">
                <span className="font-mono font-semibold">IBAN: {contaExtraSel.iban}</span>
                <span className="font-bold text-sky-700">Saldo: {contaExtraSel.saldo_atual?.toFixed(2) || 0} €</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DISCRIMINAÇÃO COMPLETA FRAÇÃO A FRAÇÃO */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-600" />
              <span>Discriminação das Quotas por Fração ({predioFracoes.length} Frações)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Cálculo proporcional exato pela permilagem, associado ao IBAN de crédito e referência de pagamento
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              Total Mensal: {predioFracoes.length === 0 ? "0.00" : ((Number(orcamentoRegular) || 0) + extraPorMesTotal).toFixed(2)} €
            </span>
            <button
              type="button"
              onClick={() => exportarBalanceteMapaAnualXLS(predio, predioFracoes, new Date().getFullYear(), avisos)}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              title="Descarregar grelha das 12 quotas mensais de todas as frações em Excel/CSV para entregar em Assembleia"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exportar Mapa Anual (XLS)</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <th className="p-3">Fração / Piso</th>
                <th className="p-3">Condómino</th>
                <th className="p-3 text-center">Permilagem</th>
                <th className="p-3 text-right">Quota Ordinária</th>
                <th className="p-3 text-right">Fundo de Reserva</th>
                <th className="p-3 text-right">Quota Extra (1/{numPrestacoesExtra})</th>
                <th className="p-3 text-right font-black">Total a Pagar</th>
                <th className="p-3">Conta / IBAN Crédito</th>
                <th className="p-3 text-center">Referência Pagamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {predioFracoes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    Nenhuma fração registada neste condomínio.
                  </td>
                </tr>
              ) : (
                predioFracoes.map((f) => {
                  const quotaTotal = calcularQuotaOrdinaria(f);
                  const quotaOrdinariaPart = Math.round(quotaTotal * 0.9 * 100) / 100;
                  const quotaFCRPart = Math.round(quotaTotal * 0.1 * 100) / 100;
                  const extShare = extraPorMesTotal * (f.permilagem / 1000);
                  const totalShare = quotaOrdinariaPart + quotaFCRPart + extShare;
                  // Referência de pagamento REAL (a mesma usada na Nota de
                  // Cobrança/Recibo oficiais) — antes esta coluna mostrava
                  // uma referência inventada ("CD-XXX-Y", variável literalmente
                  // chamada refSimulada) que não correspondia a nenhuma
                  // referência de cobrança real do condómino.
                  const referenciaReal = f.referencia_br23e || f.proprietario?.referencia_br23e || gerarReferenciaBR23E(f.fracao_nome, f.id_fracao);
                  // A quota extra tem referência própria (distinta da quota
                  // ordinária), já que pode ir para uma conta diferente
                  // (contaExtraSel) e precisa de ser conciliada em separado.
                  const referenciaExtra = `EXT23E-FR-${(f.fracao_nome || f.id_fracao || "").toString().trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]/g, "") || "01"}`;

                  return (
                    <tr key={f.id_fracao} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3">
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-mono">
                          Fração {f.fracao_nome}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">{f.piso}</span>
                      </td>

                      <td className="p-3">
                        <span className="font-semibold text-slate-800">
                          {f.proprietario?.nome || "Sem Proprietário"}
                        </span>
                        {f.proprietario?.email && (
                          <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">
                            {f.proprietario.email}
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-center font-mono font-bold text-slate-700">
                        {f.permilagem}‰
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-emerald-700">
                        {quotaOrdinariaPart.toFixed(2)} €
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-amber-700">
                        {quotaFCRPart.toFixed(2)} €
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-sky-700">
                        {extShare.toFixed(2)} €
                      </td>

                      <td className="p-3 text-right font-mono font-black text-slate-900 bg-slate-50/70 text-sm">
                        {totalShare.toFixed(2)} €
                      </td>

                      <td className="p-3">
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-700 font-bold block truncate max-w-[180px]">
                            {contaOrdinariaSel?.banco || "Conta Geral"}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500 block truncate max-w-[180px]">
                            {contaOrdinariaSel?.iban || "PT50..."}
                          </span>
                          {extVal > 0 && contaExtraSel?.id_conta !== contaOrdinariaSel?.id_conta && (
                            <>
                              <span className="text-[9px] text-sky-700 font-bold block truncate max-w-[180px] pt-1">
                                Extra: {contaExtraSel?.banco || "Conta Geral"}
                              </span>
                              <span className="text-[9px] font-mono text-sky-500 block truncate max-w-[180px]">
                                {contaExtraSel?.iban || "PT50..."}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <div className="space-y-1">
                          <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200 block">
                            {referenciaReal}
                          </span>
                          {extVal > 0 && (
                            <span className="font-mono text-[9px] font-bold bg-sky-50 text-sky-700 px-2 py-1 rounded border border-sky-200 block" title="Referência própria da quota extraordinária">
                              {referenciaExtra}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {predioFracoes.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300 text-slate-800">
                  <td colSpan={2} className="p-3 uppercase text-[10px] tracking-wider">
                    Total Global do Condomínio
                  </td>
                  <td className="p-3 text-center font-mono font-black">{totalPermilagem}‰</td>
                  <td className="p-3 text-right font-mono font-black text-emerald-800">
                    {(Math.round((Number(orcamentoRegular) || 0) * 0.9 * 100) / 100).toFixed(2)} €
                  </td>
                  <td className="p-3 text-right font-mono font-black text-amber-800">
                    {(Math.round((Number(orcamentoRegular) || 0) * 0.1 * 100) / 100).toFixed(2)} €
                  </td>
                  <td className="p-3 text-right font-mono font-black text-sky-800">
                    {extraPorMesTotal.toFixed(2)} €
                  </td>
                  <td className="p-3 text-right font-mono font-black text-slate-950 text-sm">
                    {((Number(orcamentoRegular) || 0) + extraPorMesTotal).toFixed(2)} €
                  </td>
                  <td colSpan={2} className="p-3 text-right text-[10px] text-slate-500">
                    Calculado e interligado com as contas bancárias
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
