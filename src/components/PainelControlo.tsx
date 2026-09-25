import React, { useMemo } from "react";
import { Predio, Conta, Fracao, Movimento, Aviso } from "../types";
import { exportToXLS, ehContaFundoReserva } from "../utils";
import { 
  Building, DoorOpen, Users, FileText, Hammer, Brush, 
  Wallet, Truck, MessageSquare, Sparkles,
  AlertTriangle, BarChart2
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

interface PainelControloProps {
  predio: Predio;
  predios?: Predio[];
  contas: Conta[];
  fracoes: Fracao[];
  movements: Movimento[];
  avisos: Aviso[];
  documentosCount?: number;
  fornecedoresCount?: number;
  obrasCount?: number;
  limpezasCount?: number;
  alertasJuridicosCount?: number;
  sondagensCount?: number;
  ocorrenciasCount?: number;
  reservasCount?: number;
  mensagensCount?: number;
  notificacoesCount?: number;
  dividasPendentesValor?: number;
  onSelectSection?: (section: string) => void;
  isAdmin?: boolean;
}

export function PainelControlo({
  predio,
  predios = [],
  contas,
  fracoes,
  movements,
  avisos,
  documentosCount = 0,
  fornecedoresCount = 0,
  obrasCount = 0,
  limpezasCount = 0,
  alertasJuridicosCount = 0,
  sondagensCount = 0,
  ocorrenciasCount = 0,
  reservasCount = 0,
  mensagensCount = 0,
  notificacoesCount = 0,
  dividasPendentesValor = 0,
  onSelectSection,
  isAdmin = true
}: PainelControloProps) {

  // Global list references derived from props
  const predioFracoes = fracoes.filter(f => f.id_predio === predio?.id_predio);
  const predioMovements = movements.filter(m => m.id_predio === predio?.id_predio);
  const lancamentosPorConfirmarCount = predioMovements.filter(
    (m: any) => m.is_movimento_cego || m.estado === "Movimento Cego / Por Justificar"
  ).length;
  const predioAvisos = avisos.filter(a => a.id_predio === predio?.id_predio);
  const predioContas = contas.filter(c => c.id_predio === predio?.id_predio);

  // Dynamic buildings count (0 if empty or provisional temporary placeholder)
  const totalPrediosReais = predios.filter(p => p.id_predio && p.id_predio !== "predio-temp").length;

  // Saldos reais das contas bancárias (não somados a partir dos movimentos —
  // o saldo de cada Conta já é a verdade mantida atualizada pelo saldo de
  // abertura do arranque + cada movimento posterior; recalcular a partir dos
  // movimentos ignorava sempre o saldo de abertura). Classificação por
  // palavras-chave no "tipo" da conta, cobrindo tanto o texto produzido em
  // GestaoContas.tsx como no Assistente de Arranque.
  const totalFundoReserva = predioContas
    .filter(c => ehContaFundoReserva(c.tipo))
    .reduce((acc, c) => acc + (Number(c.saldo) || 0), 0);
  const totalContaOrdem = predioContas
    .filter(c => !ehContaFundoReserva(c.tipo))
    .reduce((acc, c) => acc + (Number(c.saldo) || 0), 0);
  const totalDisponibilidades = totalContaOrdem + totalFundoReserva;
  const totalLiquido = totalDisponibilidades - dividasPendentesValor;

  // Gráfico inicial dinâmico gerado conforme os saldos vs despesas reais do prédio (a zero se sem movimentos)
  const chartData = useMemo(() => {
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const baseMeses = meses.slice(0, 7).map((mesNome, index) => ({
      name: mesNome,
      mesIndex: index,
      Receitas: 0,
      Despesas: 0,
      Saldo: 0
    }));

    if (!predioMovements || predioMovements.length === 0) {
      return baseMeses;
    }

    predioMovements.forEach(m => {
      const dataRaw = m.data || (m as any).data_movimento;
      if (!dataRaw) return;
      const dataObj = new Date(dataRaw);
      if (isNaN(dataObj.getTime())) return;

      const mesIdx = dataObj.getMonth();
      if (mesIdx >= 0 && mesIdx < 7) {
        const val = Number(m.valor) || 0;
        const tipoNorm = String(m.tipo || "").toUpperCase();
        if (tipoNorm === "RECEITA" || tipoNorm === "ENTRADA" || tipoNorm === "QUOTA") {
          baseMeses[mesIdx].Receitas += val;
        } else if (tipoNorm === "DESPESA" || tipoNorm === "SAIDA") {
          baseMeses[mesIdx].Despesas += val;
        }
      }
    });

    let acumulado = 0;
    baseMeses.forEach(item => {
      acumulado += (item.Receitas - item.Despesas);
      item.Saldo = acumulado;
    });

    return baseMeses;
  }, [predioMovements]);

  // Quotas em atraso reais (avisos pendentes cujo vencimento já passou)
  const quotasEmAtraso = useMemo(() => {
    const hoje = new Date();
    const porFracao = new Map<string, { fracao: string; valor: number }>();
    predioAvisos
      .filter(a => (a.estado === "Pendente" || a.estado === "Paga Parcialmente") && a.vencimento && new Date(a.vencimento) < hoje)
      .forEach(a => {
        const frac = predioFracoes.find(f => f.id_fracao === a.id_fracao);
        const nomeFracao = frac?.fracao_nome || a.id_fracao;
        const atual = porFracao.get(a.id_fracao) || { fracao: nomeFracao, valor: 0 };
        atual.valor += (Number(a.valor) || 0) - (Number(a.valor_pago) || 0);
        porFracao.set(a.id_fracao, atual);
      });
    return Array.from(porFracao.values()).sort((a, b) => b.valor - a.valor);
  }, [predioAvisos, predioFracoes]);

  const [gerandoResumoIA, setGerandoResumoIA] = React.useState(false);

  const handleGerarResumoIA = async () => {
    setGerandoResumoIA(true);
    try {
      const respIA = await fetch("/api/ai?acao=resumo-painel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predioNome: predio?.nome,
          saldoCaixa: totalContaOrdem,
          fundoReserva: totalFundoReserva,
          dividasPendentes: dividasPendentesValor,
          totalLiquido,
          quotasEmAtraso,
          ocorrenciasAbertas: ocorrenciasCount,
          totalFracoes: predioFracoes.length
        })
      });
      const dadosIA = await respIA.json();
      if (!respIA.ok || !dadosIA.resumo) throw new Error(dadosIA?.error || "Falha ao gerar o resumo.");

      const emailAdmin = (predio as any)?.email_administracao || (predio as any)?.email;
      if (emailAdmin) {
        const respEmail = await fetch("/api/email?acao=enviar-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: emailAdmin,
            subject: `Resumo Executivo IA — ${predio?.nome || "Condomínio"}`,
            texto: dadosIA.resumo
          })
        });
        if (!respEmail.ok) {
          alert(`Resumo gerado, mas não foi possível enviar por email:\n\n${dadosIA.resumo}`);
          return;
        }
        alert(`Resumo IA gerado e enviado para ${emailAdmin}:\n\n${dadosIA.resumo}`);
      } else {
        alert(`Resumo IA gerado (sem email de administração configurado para envio):\n\n${dadosIA.resumo}`);
      }
    } catch (err: any) {
      alert(`❌ Erro ao gerar o relatório de IA: ${err?.message || "erro desconhecido"}`);
    } finally {
      setGerandoResumoIA(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* INDICADORES DO PRÉDIO — 4 fixos (Prédios, Condóminos, Fundo de
          Reserva, Saldo em Caixa) + os restantes só aparecem quando há dados
          reais que os justifiquem (ex: só há cartão de "Inquilinos" se
          houver pelo menos 1 fração arrendada) */}
      {(() => {
        const indicadores = [
          {
            // Só faz sentido mostrar este cartão quando há mais que um
            // prédio a gerir — com um único edifício é informação óbvia.
            name: "Prédios Ativos",
            val: totalPrediosReais === 1 ? "1 Edifício" : `${totalPrediosReais} Edifícios`,
            icon: "/modulos/01-predio.png",
            section: "predios",
            fixo: totalPrediosReais > 1,
            contagem: 1
          },
          {
            // Condóminos e Inquilinos fundidos num só cartão — consultam-se
            // sempre em conjunto ao nível da fração.
            name: "Condóminos & Inquilinos",
            val: `${predioFracoes.length} Frações · ${predioFracoes.filter(f => f.is_arrendada).length} Arrendadas`,
            icon: "/modulos/07-fracao.png",
            section: "fracoes",
            fixo: true,
            contagem: 1
          },
          {
            name: "Intervenções",
            val: `${ocorrenciasCount} Registadas`,
            icon: "/modulos/28-intervencao.png",
            section: "manutencao_intervencoes",
            fixo: false,
            contagem: ocorrenciasCount
          },
          {
            name: "Obras Gerais",
            val: obrasCount === 1 ? "1 Ativa" : `${obrasCount} Ativas`,
            icon: "/modulos/41-obra.png",
            section: "manutencao_extraordinarias",
            fixo: false,
            contagem: obrasCount
          },
          {
            name: "Escala Limpeza",
            val: limpezasCount === 1 ? "1 Área" : `${limpezasCount} Áreas`,
            icon: "/modulos/50-limpeza.png",
            section: "vistorias_limpezas",
            fixo: false,
            contagem: limpezasCount
          },
          {
            name: "Documentos IA",
            val: `${documentosCount} Arquivados`,
            icon: "/modulos/27-arquivo-automatico.png",
            section: "documentos",
            fixo: false,
            contagem: documentosCount
          },
          {
            // Sempre visível (fixo) — o número de mensagens por ler mostra-se
            // como emblema vermelho no canto superior direito do ícone, estilo
            // WhatsApp/SMS, em vez de depender do cartão aparecer/desaparecer.
            name: "Mensagens",
            val: mensagensCount === 0 ? "Sem Pendentes" : mensagensCount === 1 ? "1 Pendente" : `${mensagensCount} Pendentes`,
            icon: "/modulos/75-mensagem.png",
            section: "comunicacao_chat",
            fixo: true,
            contagem: 1,
            emblemaContagem: mensagensCount
          },
          {
            name: "Cobranças",
            val: `${predioAvisos.filter(a => a.estado === 'Pendente' || a.estado === 'Paga Parcialmente').length} Pendentes`,
            icon: "/modulos/60-nota-de-cobranca.png",
            section: "financeiro_relatorios",
            fixo: false,
            contagem: predioAvisos.filter(a => a.estado === 'Pendente' || a.estado === 'Paga Parcialmente').length,
            apenasAdmin: true
          },
          {
            // Movimentos "cegos" chegados por email (comprovativos/faturas
            // reconhecidos automaticamente) que ainda esperam confirmação
            // manual do administrador — sempre visível (fixo), tal como
            // "Mensagens", para nunca desaparecer do painel mesmo quando não
            // há nenhum pendente; cor vermelha só quando há mesmo algo por
            // justificar (dinheiro por confirmar).
            name: "Lançamentos por Confirmar",
            val: lancamentosPorConfirmarCount === 0 ? "Sem Pendentes" : lancamentosPorConfirmarCount === 1 ? "1 Por Justificar" : `${lancamentosPorConfirmarCount} Por Justificar`,
            icon: "/modulos/66-exportacao-financeira.png",
            section: "movimentos",
            fixo: true,
            contagem: 1,
            corSinal: lancamentosPorConfirmarCount > 0,
            positivo: false,
            apenasAdmin: true
          },
          {
            name: "Alertas Jurídicos",
            val: alertasJuridicosCount === 1 ? "1 Ativo" : `${alertasJuridicosCount} Ativos`,
            icon: "/modulos/23-contrato.png",
            section: "contencioso_juridico",
            fixo: false,
            contagem: alertasJuridicosCount
          },
          {
            name: "Sondagens IA",
            val: sondagensCount === 1 ? "1 Ativa" : `${sondagensCount} Ativas`,
            icon: "/modulos/76-sondagem.png",
            section: "comunicacao_sondagens",
            fixo: false,
            contagem: sondagensCount
          },
          {
            name: "Conta(s) à Ordem",
            val: `${totalContaOrdem.toLocaleString("pt-PT")} €`,
            icon: "/modulos/57-quota.png",
            // Antes ia para "financeiro_extratos" (Extrato de Movimentos e
            // Saldo do CONDÓMINO — por fração, nada a ver com o saldo desta
            // conta bancária). Vai agora para a gestão real das contas.
            section: "contas",
            fixo: true,
            destaque: true,
            // Uma conta à ordem pode ficar negativa (ex: despesa lançada
            // antes de o reforço de fundos entrar) — antes "destaque: true"
            // pintava sempre de verde, mesmo com saldo negativo.
            corSinal: true,
            positivo: totalContaOrdem >= 0,
            contagem: 1
          },
          {
            name: "Fundo de Reserva",
            val: `${totalFundoReserva.toLocaleString("pt-PT")} €`,
            icon: "/modulos/64-saldo.png",
            // Idem — ia para o mesmo sítio errado. Vai agora para o ecrã
            // real do Fundo de Reserva.
            section: "fundo_reserva",
            fixo: true,
            destaque: true,
            corSinal: true,
            positivo: totalFundoReserva >= 0,
            contagem: 1
          },
          {
            name: "Total Líquido",
            val: `${totalLiquido.toLocaleString("pt-PT")} €`,
            icon: "/modulos/57-quota.png",
            // Antes ia para Fornecedores, que só mostra uma das três parcelas
            // que compõem este valor (Contas + Fundo de Reserva - Dívidas
            // Pendentes) — vai agora para o Relatório de Contas, onde as três
            // parcelas são visíveis.
            section: "financeiro_relatorios",
            fixo: true,
            corSinal: true,
            positivo: totalLiquido >= 0,
            contagem: 1
          }
        ].filter(ind => (ind.fixo || ind.contagem > 0) && (!ind.apenasAdmin || isAdmin));

        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#333] uppercase tracking-wider">Módulo de Administração: Indicadores do Prédio</h4>
              <span className="text-[10px] text-slate-400 font-medium">Clique em qualquer indicador para navegar para o módulo</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {indicadores.map((ind, idx) => {
                const corVerde = ind.corSinal ? ind.positivo : ind.destaque;
                const corVermelha = ind.corSinal && !ind.positivo;
                const emblema = ind.emblemaContagem;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectSection?.(ind.section)}
                    title={ind.corSinal ? "Total = Saldos Bancários (Ordem + Fundo de Reserva) − Dívidas Pendentes a Fornecedores" : undefined}
                    className={`w-full min-h-[115px] rounded-2xl flex flex-col items-center justify-between text-center p-2.5 relative select-none hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-xs overflow-hidden ${
                      corVermelha
                        ? "bg-red-100 hover:bg-red-200 text-red-950 border border-red-400"
                        : corVerde
                        ? "bg-[#A7F3D0] hover:bg-[#6EE7B7] text-[#022c22] border border-[#34D399]"
                        : "bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#064E3B] border border-[#A7F3D0]"
                    }`}
                  >
                    <div className="relative shrink-0 mb-0.5">
                      <img src={ind.icon} alt={ind.name} className="h-9 w-9 object-contain rounded-lg drop-shadow-xs" />
                      {!!emblema && emblema > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center shadow-sm ring-2 ring-white animate-pulse">
                          {emblema > 99 ? "99+" : emblema}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-center leading-none w-full px-0.5">
                      <span className={`text-[9.5px] font-black leading-[1.15] line-clamp-2 break-words text-center uppercase tracking-tight ${corVermelha ? "text-red-950" : corVerde ? "text-[#022c22]" : "text-[#064E3B]"}`}>{ind.name}</span>
                    </div>
                    <span className={`bg-white/95 border text-[8px] font-black px-2 py-0.5 rounded-full shadow-xs uppercase tracking-wide leading-tight max-w-full text-center break-words line-clamp-1 ${
                      corVermelha ? "text-red-700 border-red-400" : corVerde ? "text-[#022c22] border-[#34D399]" : "text-[#064E3B] border-[#6EE7B7]"
                    }`}>
                      {ind.val}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400">
              "Total Líquido" = Conta(s) à Ordem ({totalContaOrdem.toLocaleString("pt-PT")} €) + Fundo de Reserva ({totalFundoReserva.toLocaleString("pt-PT")} €)
              {dividasPendentesValor > 0 && ` − Dívidas Pendentes a Fornecedores (${dividasPendentesValor.toLocaleString("pt-PT")} €)`}. Uma conta com saldo negativo (ex: obras pagas antes de reforço de fundos) reduz este total tanto quanto uma dívida por pagar.
            </p>
          </div>
        );
      })()}

      {/* Destaques de Arranque & Pasta Provisória */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          onClick={() => onSelectSection?.("configuracao_arranque")}
          className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/40 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-amber-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-sm group-hover:scale-105 transition-transform">
              <i className="fa-solid fa-sliders text-lg"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-slate-800 group-hover:text-amber-700 transition-colors">Arranque & Saldos Iniciais</h4>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full">Transição</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Defina o balanço de abertura bancário, dívidas/créditos de frações e histórico.</p>
            </div>
          </div>
          <i className="fa-solid fa-arrow-right text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all"></i>
        </div>

        <div 
          onClick={() => onSelectSection?.("minutas_oficiais")}
          className="bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-300/40 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-sm group-hover:scale-105 transition-transform">
              <i className="fa-solid fa-file-signature text-lg"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-slate-800 group-hover:text-indigo-700 transition-colors">Minutas Oficiais & Simulador de E-mails</h4>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-indigo-200 text-indigo-900 rounded-full">5 PDFs Editáveis</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Descarregue exemplares em PDF ou simule os envios automáticos para o seu e-mail.</p>
            </div>
          </div>
          <i className="fa-solid fa-arrow-right text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all"></i>
        </div>
      </div>

      {/* Main Row: Chart + IA Alerts Side-by-Side to eliminate extra scrolling */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">Transparência Orçamental e Fluxo de Caixa</h3>
                {predioMovements.length === 0 ? (
                  <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                    Base a Zero (Sem Movimentos)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {predioMovements.length} Movimento{predioMovements.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {predioMovements.length === 0
                  ? "O gráfico inicia a zero e reflete automaticamente os saldos e despesas reais lançados no prédio."
                  : "Receitas de quotas vs. despesas de manutenção calculadas conforme os saldos do prédio."}
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-200 self-start sm:self-auto">
              Ano {new Date().getFullYear()}
            </span>
          </div>
          <div className="h-52 text-xs font-bold">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(v) => `${v}€`} />
                <Tooltip formatter={(value: any) => [`${Number(value).toLocaleString("pt-PT")} €`, ""]} />
                <Legend />
                <Area type="monotone" name="Receitas" dataKey="Receitas" stroke="#10b981" fillOpacity={1} fill="url(#colorRec)" strokeWidth={2} />
                <Area type="monotone" name="Despesas" dataKey="Despesas" stroke="#ef4444" fillOpacity={1} fill="url(#colorDes)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* IA Assistente & Alerts (Immediately visible, no artificial scroll barrier) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between min-h-[250px]">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center justify-between">
              <span>IA Assistente Automático</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">Reconciliação e alertas pendentes de validação.</p>
            
            <div className="space-y-3">
              {quotasEmAtraso.length === 0 ? (
                <div className="flex items-start space-x-2 text-xs bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg text-emerald-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                  <div>
                    <span className="font-bold block">Quotas em Dia</span>
                    <span>Não existem quotas em atraso registadas neste momento.</span>
                  </div>
                </div>
              ) : (
                quotasEmAtraso.slice(0, 2).map((q) => (
                  <div key={q.fracao} className="flex items-start space-x-2 text-xs bg-amber-50 border border-amber-100 p-2.5 rounded-lg text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                    <div>
                      <span className="font-bold block">Quotas em Atraso</span>
                      <span>A fração {q.fracao} tem {q.valor.toFixed(2)} € em quotas por regularizar.</span>
                    </div>
                  </div>
                ))
              )}
              {quotasEmAtraso.length > 2 && (
                <p className="text-[10px] text-slate-400">+ {quotasEmAtraso.length - 2} outra(s) fração(ões) com quotas em atraso.</p>
              )}
            </div>
          </div>
          <button
            disabled={gerandoResumoIA}
            onClick={handleGerarResumoIA}
            className="mt-4 w-full bg-[#1A1A1A] hover:bg-[#333] disabled:opacity-50 text-white font-bold py-2 rounded-lg text-xs cursor-pointer flex items-center justify-center space-x-1.5 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>{gerandoResumoIA ? "A gerar..." : "Gerar Relatório de IA"}</span>
          </button>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Transações e Movimentos de Caixa</h3>
            <p className="text-xs text-slate-400">Lançamentos confirmados e reconciliados recentemente.</p>
          </div>
          <button 
            onClick={() => exportToXLS("Saldos_Movimentos", ["Data", "Tipo", "Descricao", "Valor"], predioMovements.map(m=>[m.data, m.tipo, m.descricao, m.valor.toString()]))} 
            title="Exportar Excel"
            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-xs"
          >
            <img src="/modulos/66-exportacao-financeira.png" alt="Excel" className="h-6 w-6 object-contain" onError={(e) => { e.currentTarget.src = "/modulos/26-exportacao.png"; }} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-150 text-slate-400 font-bold">
                <th className="py-2">Data</th>
                <th className="py-2">Tipo</th>
                <th className="py-2">Descrição</th>
                <th className="py-2">Categoria</th>
                <th className="py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {predioMovements.slice(0, 5).map((m) => (
                <tr key={m.id_mov} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="py-2.5 font-mono text-slate-500">{m.data}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                      m.tipo === "Receita" || m.tipo === "RECEITA" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                    }`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td className="py-2.5 font-medium text-slate-700">{m.descricao}</td>
                  <td className="py-2.5 text-slate-500">{m.categoria}</td>
                  <td className={`py-2.5 text-right font-bold ${
                    m.tipo === "Receita" || m.tipo === "RECEITA" ? "text-emerald-600" : "text-red-600"
                  }`}>
                    {m.tipo === "Receita" || m.tipo === "RECEITA" ? "+" : "-"}{m.valor.toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
