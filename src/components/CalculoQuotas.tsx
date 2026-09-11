import React, { useState, useMemo } from "react";
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
  Info
} from "lucide-react";
import { Predio, Fracao, Conta, Aviso, LoggedUser } from "../types";
import { jsPDF } from "jspdf";

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

  // Estados dos Orçamentos
  const [orcamentoRegular, setOrcamentoRegular] = useState<string>("1200");
  const [dataLimiteRegular, setDataLimiteRegular] = useState<string>(() => {
    const d = new Date();
    d.setDate(8);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  });
  const [contaOrdinariaId, setContaOrdinariaId] = useState<string>(() => {
    const ord = predioContas.find((c) => c.tipo === "Ordem" || c.tipo === "DO");
    return ord ? ord.id_conta : predioContas[0]?.id_conta || "";
  });

  const [orcamentoExtra, setOrcamentoExtra] = useState<string>("5000");
  const [numPrestacoesExtra, setNumPrestacoesExtra] = useState<number>(5);
  const [dataLimiteExtra, setDataLimiteExtra] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    return d.toISOString().split("T")[0];
  });
  const [descricaoExtra, setDescricaoExtra] = useState<string>(
    "Obras Urgentes de Manutenção e Impermeabilização da Cobertura"
  );
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
  const extraPorMesTotal = (Number(orcamentoExtra) || 0) / (numPrestacoesExtra || 1);

  // Emitir Quotas em Lote diretamente para Avisos
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

    const regVal = Number(orcamentoRegular) || 0;
    const extVal = Number(orcamentoExtra) || 0;

    if (regVal <= 0 && extVal <= 0) {
      alert("Por favor defina um orçamento regular ou extraordinário superior a 0€!");
      return;
    }

    const d = new Date();
    const dataEmissao = d.toISOString().split("T")[0];
    const novosAvisos: Aviso[] = [];

    predioFracoes.forEach((f) => {
      // 1. Quota Ordinária
      if (regVal > 0) {
        const valorOrdinario = Math.round(regVal * (f.permilagem / 1000) * 100) / 100;
        novosAvisos.push({
          id_aviso: `av-ord-${Date.now()}-${f.id_fracao}`,
          id_predio: predio.id_predio,
          id_fracao: f.id_fracao,
          tipo: "Cota Ordinária",
          data: dataEmissao,
          vencimento: dataLimiteRegular,
          descricao: `Quota Ordinária Mensal - Permilagem ${f.permilagem}‰ (IBAN: ${contaOrdinariaSel?.iban || "Conta à Ordem"})`,
          valor: valorOrdinario,
          estado: "Pendente",
        });
      }

      // 2. Quota Extraordinária
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
        });
      }
    });

    setAvisos((prev) => [...novosAvisos, ...prev]);
    setSucessoEmissao(
      `Emitidos com sucesso ${novosAvisos.length} avisos de cobrança interligados com as contas bancárias (${contaOrdinariaSel?.banco || "Conta Principal"} / ${contaExtraSel?.banco || "Conta FCR"}).`
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

      doc.text(`• Orçamento Extraordinário: ${Number(orcamentoExtra).toFixed(2)} € (${numPrestacoesExtra} prestações de ${extraPorMesTotal.toFixed(2)} €/mês)`, 14, 62);
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
        const regShare = (Number(orcamentoRegular) || 0) * (f.permilagem / 1000);
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
            Calculadora de quotas ordinárias mensais e quotas extraordinárias interligadas diretamente com as contas bancárias do edifício.
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
              onClick={handleEmitirQuotasEmLote}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Emitir Avisos em Lote</span>
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
                Orçamento Mensal Global (€) *
              </label>
              <input
                type="number"
                value={orcamentoRegular}
                onChange={(e) => setOrcamentoRegular(e.target.value)}
                className="w-full border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-emerald-500 bg-slate-50/50 font-mono font-bold"
                placeholder="Ex: 1200"
              />
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
                type="number"
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
              Finalidade / Descrição da Obra
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
              Total Mensal: {((Number(orcamentoRegular) || 0) + extraPorMesTotal).toFixed(2)} €
            </span>
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
                <th className="p-3 text-right">Quota Extra (1/{numPrestacoesExtra})</th>
                <th className="p-3 text-right font-black">Total a Pagar</th>
                <th className="p-3">Conta / IBAN Crédito</th>
                <th className="p-3 text-center">Referência Pagamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {predioFracoes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Nenhuma fração registada neste condomínio.
                  </td>
                </tr>
              ) : (
                predioFracoes.map((f) => {
                  const regShare = (Number(orcamentoRegular) || 0) * (f.permilagem / 1000);
                  const extShare = extraPorMesTotal * (f.permilagem / 1000);
                  const totalShare = regShare + extShare;
                  const refSimulada = `CD-${predio.id_predio.slice(-3).toUpperCase()}-${f.fracao_nome}`;

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
                        {regShare.toFixed(2)} €
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
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200">
                          {refSimulada}
                        </span>
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
                    {Number(orcamentoRegular).toFixed(2)} €
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
