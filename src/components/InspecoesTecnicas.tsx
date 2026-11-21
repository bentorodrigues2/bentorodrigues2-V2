import React, { useState, useEffect, useRef } from "react";
import { Predio, LoggedUser, Movimento, Conta, Fornecedor } from "../types";
import { Wrench, Check, X, Pencil, CalendarCheck, FileText, Paperclip, Bell, Upload, Landmark, ShieldAlert, ClipboardList, Trash2 } from "lucide-react";
import { EquipamentoTecnico, HistoricoVistoriaEquipamento, DocumentoVistoria } from "./InventarioTecnico";
import { fetchInventarioTecnicoFromSupabase, saveEquipamentoTecnicoToSupabase, registarLogAuditoria, uploadDocumentoToStorage, saveMovimentoToSupabase, ajustarSaldoContaReal } from "../lib/supabaseService";
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
}

export function InspecoesTecnicas({ predio, loggedUser, movements = [], setMovements, contas = [], fornecedores = [] }: InspecoesTecnicasProps) {
  const [equipamentos, setEquipamentos] = useState<EquipamentoTecnico[]>([]);

  useEffect(() => {
    if (!predio.id_predio) return;
    fetchInventarioTecnicoFromSupabase(predio.id_predio).then(dados => { if (dados) setEquipamentos(dados); });
  }, [predio.id_predio]);

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

  // Uma linha por equipamento incluído nesta inspeção — normalmente só 1,
  // mas pode ter várias (ex: os 2 elevadores do prédio na mesma visita da
  // TKE, cada um com o seu nº de certificado e a sua quota-parte do custo)
  // — pedido explícito do administrador a partir de um requerimento real à
  // Câmara que cobre 2 ascensores de uma só vez.
  interface VistoriaRow {
    idEquipamento: string;
    nome: string;
    // Id da entrada já gravada no historicoVistorias deste equipamento,
    // só presente em edição — permite substituir a entrada certa em vez de
    // duplicar.
    entryId?: string;
    numCertificado: string;
    custo: string;
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
    numCertificado: "",
    custo: "",
    certFile: null,
    certExistente: null,
    certRemovido: false
  });

  const abrirRegistarVistoria = (eq: EquipamentoTecnico) => {
    setVistoriaTargetId(eq.id);
    setVistoriaEditId(null);
    setVistoriaIdGrupo(null);
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
    setVistoriaFaturaFile(null); setVistoriaFaturaExistente(null); setVistoriaFaturaRemovida(false);
    setVistoriaComprovativoFile(null); setVistoriaComprovativoExistente(null); setVistoriaComprovativoRemovido(false);
    setVistoriaRequerimentoFile(null); setVistoriaRequerimentoExistente(null); setVistoriaRequerimentoRemovido(false);
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

    const docsPartilhados = v.documentos || [];
    const fatura = docsPartilhados.find(d => d.tipo === "fatura");
    const comprovativo = docsPartilhados.find(d => d.tipo === "comprovativo_pagamento");
    const requerimento = docsPartilhados.find(d => d.tipo === "requerimento");
    setVistoriaFaturaFile(null); setVistoriaFaturaExistente(fatura ? { url: fatura.url, nome: fatura.nome } : null); setVistoriaFaturaRemovida(false);
    setVistoriaComprovativoFile(null); setVistoriaComprovativoExistente(comprovativo ? { url: comprovativo.url, nome: comprovativo.nome } : null); setVistoriaComprovativoRemovido(false);
    setVistoriaRequerimentoFile(null); setVistoriaRequerimentoExistente(requerimento ? { url: requerimento.url, nome: requerimento.nome } : null); setVistoriaRequerimentoRemovido(false);

    // Reconstrói as linhas: o equipamento clicado + todos os outros
    // equipamentos com uma entrada do mesmo idGrupo (inspeção conjunta).
    const construirLinha = (equipamento: EquipamentoTecnico, entrada: HistoricoVistoriaEquipamento): VistoriaRow => {
      const certDoc = (entrada.documentos || []).find(d => d.tipo === "certificado");
      return {
        idEquipamento: equipamento.id,
        nome: equipamento.nome,
        entryId: entrada.id,
        numCertificado: entrada.numCertificado || "",
        custo: entrada.custo != null ? String(entrada.custo) : "",
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

  const handleGravarVistoria = async (e: React.FormEvent) => {
    e.preventDefault();
    const equipamentosAlvo = vistoriaRows
      .map(row => ({ row, eq: equipamentos.find(eq => eq.id === row.idEquipamento) }))
      .filter((x): x is { row: VistoriaRow; eq: EquipamentoTecnico } => !!x.eq);
    if (equipamentosAlvo.length === 0) return;
    setAGravarVistoria(true);
    try {
      const idBase = vistoriaEditId || `vist-${Date.now()}`;

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
        } else if (!row.certRemovido && row.certExistente) {
          docs.unshift({ id: `${row.entryId || idBase}-certificado`, tipo: "certificado", url: row.certExistente.url, nome: row.certExistente.nome });
        }
        documentosPorEquipamento[row.idEquipamento] = docs;
      }

      const fornecedorInspecaoReal = fornecedores.find(f => f.id_fornecedor === vistoriaFornInspecaoId);
      const fornecedorManutencaoReal = fornecedores.find(f => f.id_fornecedor === vistoriaFornManutencaoId);

      const custosPorEquipamento = equipamentosAlvo.map(({ row }) => ({ id: row.idEquipamento, custo: row.custo ? (parseValorMonetario(row.custo) || 0) : 0 }));
      const custoTotal = custosPorEquipamento.reduce((soma, c) => soma + c.custo, 0);
      const ehGrupo = equipamentosAlvo.length > 1;
      const idGrupoFinal = ehGrupo ? (vistoriaIdGrupo || `grp-${Date.now()}`) : (vistoriaIdGrupo || undefined);

      // Lança o custo TOTAL desta inspeção (todos os equipamentos somados)
      // como UM só movimento de Despesa na conta do prédio — nunca
      // repartido pelas frações, e nunca um movimento por equipamento
      // (pedido explícito: "o total dos equipamentos a ser lançado nos
      // movimentos e saldo da conta após pagamento"). Idempotente: se já
      // havia um movimento lançado para esta vistoria, não volta a lançar.
      let idMovimentoFinal = vistoriaIdMovimentoExistente;
      if (!idMovimentoFinal && custoTotal > 0 && vistoriaContaPagamento) {
        if (!setMovements) {
          alert("Sistema de movimentos não disponível de momento — a vistoria foi gravada sem lançar o custo.");
        } else {
          const contaAlvo = contas.find(c => c.id_conta === vistoriaContaPagamento);
          if (!contaAlvo) {
            alert("Conta de pagamento não encontrada — a vistoria foi gravada sem lançar o custo.");
          } else {
            const entidade = fornecedorInspecaoReal?.nome || vistoriaFornInspecaoNome.trim() || fornecedorManutencaoReal?.nome || vistoriaFornManutencaoNome.trim() || "Entidade de Inspeção";
            const nomeManutencao = fornecedorManutencaoReal?.nome || vistoriaFornManutencaoNome.trim();
            const nomesEquipamentos = equipamentosAlvo.map(({ eq }) => eq.nome).join(", ");
            const novoMov: Movimento = {
              id_mov: "mov-inv-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
              id_predio: predio.id_predio,
              id_conta: contaAlvo.id_conta,
              data: vistoriaData,
              tipo: "Despesa",
              valor: custoTotal,
              descricao: `${nomesEquipamentos} — ${entidade}${nomeManutencao && nomeManutencao !== entidade ? ` (acompanhado por ${nomeManutencao})` : ""} — inspeção de ${formatDatePT(vistoriaData)}`,
              categoria: categoriaSugeridaSNC(equipamentosAlvo[0].eq),
              estado: "Pago",
              is_movimento_cego: false,
              id_fornecedor: fornecedorInspecaoReal?.id_fornecedor,
              comprovativo_url: documentosPartilhados.find(d => d.tipo === "fatura")?.url || documentosPartilhados.find(d => d.tipo === "comprovativo_pagamento")?.url
            };
            const okMov = await saveMovimentoToSupabase(novoMov);
            if (!okMov) {
              alert("❌ Não foi possível gravar o movimento do custo. A vistoria foi gravada, mas o custo NÃO ficou lançado — tente lançá-lo outra vez ao editar esta vistoria.");
            } else {
              setMovements(prev => [novoMov, ...prev]);
              await ajustarSaldoContaReal(contaAlvo.id_conta, -novoMov.valor);
              idMovimentoFinal = novoMov.id_mov;
            }
          }
        }
      }

      const equipamentosAtualizados: EquipamentoTecnico[] = equipamentosAlvo.map(({ row, eq: eqAlvo }) => {
        const custoLinha = custosPorEquipamento.find(c => c.id === row.idEquipamento)?.custo || 0;
        const entradaVistoria: HistoricoVistoriaEquipamento = {
          id: row.entryId || `vist-${Date.now()}-${row.idEquipamento}`,
          idGrupo: idGrupoFinal,
          data: vistoriaData,
          tecnico: vistoriaTecnico || "Não identificado",
          resultado: vistoriaResultado,
          observacoes: vistoriaObservacoes || undefined,
          numCertificado: row.numCertificado || undefined,
          documentos: documentosPorEquipamento[row.idEquipamento],
          id_fornecedor_inspecao: fornecedorInspecaoReal?.id_fornecedor,
          fornecedorInspecaoNome: fornecedorInspecaoReal?.nome || vistoriaFornInspecaoNome.trim() || undefined,
          id_fornecedor_manutencao: fornecedorManutencaoReal?.id_fornecedor,
          fornecedorManutencaoNome: fornecedorManutencaoReal?.nome || vistoriaFornManutencaoNome.trim() || undefined,
          custo: custoLinha || undefined,
          custoTotalGrupo: ehGrupo ? custoTotal : undefined,
          id_conta_pagamento: vistoriaContaPagamento || undefined,
          id_movimento: idMovimentoFinal
        };

        const historicoAtualizado = row.entryId
          ? (eqAlvo.historicoVistorias || []).map(v => v.id === row.entryId ? entradaVistoria : v)
          : [entradaVistoria, ...(eqAlvo.historicoVistorias || [])];

        // A validade/estado do equipamento refletem sempre a vistoria mais
        // RECENTE por data (não a última gravada) — importante em edição,
        // onde corrigir a data de uma entrada antiga não pode mudar a
        // validade atual se já houver uma vistoria mais recente no
        // histórico.
        const maisRecente = [...historicoAtualizado].sort((a, b) => b.data.localeCompare(a.data))[0];
        const novoEstado: EquipamentoTecnico["estado"] =
          maisRecente.resultado === "Reprovado" ? "Crítico" :
          maisRecente.resultado === "Aprovado com Reservas" ? "Necessita Manutenção" :
          "Operacional";
        const proximaInspecao = calcularProximaInspecao(maisRecente.data, eqAlvo.frequenciaInspecao || "Anual");

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
      const nomesEquipamentos = equipamentosAlvo.map(({ eq }) => eq.nome).join(", ");
      registarLogAuditoria("Manutenção", `${vistoriaEditId ? "Editou" : "Registou"} vistoria de "${nomesEquipamentos}" (${vistoriaResultado})${custoTotal ? ` — custo total ${custoTotal.toFixed(2)}€` : ""}`, predio.id_predio, loggedUser, vistoriaObservacoes || undefined);
      setVistoriaTargetId(null);
      setVistoriaEditId(null);
      setVistoriaRows([]);
      alert(vistoriaEditId
        ? "✅ Vistoria atualizada! Validade e próxima inspeção recalculadas."
        : `✅ Vistoria registada${ehGrupo ? ` para ${equipamentosAlvo.length} equipamentos (${nomesEquipamentos})` : ""}!${idMovimentoFinal ? ` Custo total de ${custoTotal.toFixed(2)}€ lançado na conta.` : ""} Validade atualizada e próxima inspeção agendada.`);
    } catch (err: any) {
      alert(`❌ ${err?.message || "Não foi possível gravar a vistoria. Tente novamente."}`);
    } finally {
      setAGravarVistoria(false);
    }
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
                  <p className="text-[10px] text-slate-600">Piso: <strong>{e.andar}</strong>{e.entidadeResponsavel ? <> • Entidade: <strong>{e.entidadeResponsavel}</strong></> : ""}</p>

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
                </div>

                <button
                  onClick={() => abrirRegistarVistoria(e)}
                  className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-lg text-[11px] cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <CalendarCheck className="h-3.5 w-3.5" />
                  <span>Registar Vistoria</span>
                </button>
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
                          <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                            v.resultado === "Aprovado" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" :
                            v.resultado === "Aprovado com Reservas" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" :
                            "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                          }`}>{v.resultado}</span>
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
                            {v.custo != null && (
                              v.id_movimento ? (
                                <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                  <Check className="h-2.5 w-2.5" /> lançado
                                </span>
                              ) : (
                                <span className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold">não lançado</span>
                              )
                            )}
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Data da Vistoria</label>
                    <input
                      type="date"
                      value={vistoriaData}
                      onChange={e => setVistoriaData(e.target.value)}
                      required
                      className="w-full border p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
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
                </div>

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

                  {vistoriaRows.map(row => (
                    <div key={row.idEquipamento} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{row.nome}</span>
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
                      <div className="grid grid-cols-2 gap-2">
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
                          <label className="block text-[9px] uppercase font-bold text-slate-600 mb-1">Custo (€)</label>
                          <input
                            type="text"
                            value={row.custo}
                            onChange={ev => atualizarLinhaVistoria(row.idEquipamento, { custo: ev.target.value })}
                            placeholder="Ex: 85,00"
                            className="w-full border p-1.5 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-[11px]"
                          />
                        </div>
                      </div>
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
                  ))}

                  <select
                    value={vistoriaAdicionarId}
                    onChange={ev => adicionarEquipamentoAVistoria(ev.target.value)}
                    className="w-full border border-dashed p-2 rounded bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    <option value="">+ Incluir outro equipamento nesta mesma inspeção...</option>
                    {equipamentos.filter(eq => !vistoriaRows.some(r => r.idEquipamento === eq.id)).map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.nome}</option>
                    ))}
                  </select>

                  {vistoriaRows.length > 1 && (
                    <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 text-right">
                      Total desta inspeção: {vistoriaRows.reduce((s, r) => s + (parseValorMonetario(r.custo) || 0), 0).toFixed(2)}€
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

                  {vistoriaIdMovimentoExistente ? (
                    <p className="text-[10px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5">
                      <Check className="h-3 w-3" /> Custo já lançado como movimento nesta conta — a corrigir só os outros dados, sem lançar de novo.
                    </p>
                  ) : (
                    <p className="text-[9px] text-slate-600">Ao gravar, se indicar o custo (acima, por equipamento) e a conta, cria logo UM movimento de despesa com o TOTAL (com a data desta vistoria) e desconta da conta do prédio de uma só vez — nunca repartido pelas frações, tal como acontece com qualquer outro fornecedor.</p>
                  )}

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
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl p-2.5 text-[10px] text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {vistoriaRows.length > 1
                      ? "A gravar, a validade de cada equipamento é atualizada e a próxima inspeção fica agendada automaticamente, consoante a periodicidade própria de cada um."
                      : <>A gravar, a validade é atualizada e a próxima inspeção fica agendada automaticamente para <strong>{formatDatePT(calcularProximaInspecao(vistoriaData, eqAlvo.frequenciaInspecao || "Anual"))}</strong> ({eqAlvo.frequenciaInspecao || "Anual"}), com alerta {eqAlvo.diasAlertaAntecedencia ?? 30} dias antes.</>}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={aGravarVistoria}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-2 rounded-lg text-xs cursor-pointer shadow flex items-center justify-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>{aGravarVistoria ? "A gravar..." : vistoriaEditId ? "Guardar Alterações" : "Concluir Vistoria"}</span>
                </button>
              </form>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
