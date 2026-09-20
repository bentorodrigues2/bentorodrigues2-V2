import React, { useState, useEffect, useCallback } from "react";
import { Predio, Fracao, LoggedUser, Aviso, Comunicado, ConversaCondomino, MensagemConversa, Sondagem, Questionario } from "../types";
import { supabase } from "../lib/supabaseClient";
import {
  isSupabaseConfigured,
  fetchComunicadosFromSupabase,
  saveComunicadoToSupabase,
  fetchConversasFromSupabase,
  saveConversaToSupabase,
  fetchMensagensConversaFromSupabase,
  saveMensagemConversaToSupabase,
  fetchSondagensFromSupabase,
  saveSondagemToSupabase,
  fetchQuestionariosFromSupabase,
  saveQuestionarioToSupabase
} from "../lib/supabaseService";

interface GestaoComunicacoesProps {
  predio: Predio;
  fracoes: Fracao[];
  avisos: Aviso[];
  setAvisos?: React.Dispatch<React.SetStateAction<Aviso[]>>;
  loggedUser: LoggedUser;
  activeSubSection?: "broadcast" | "chat" | "sondagens" | "questionarios";
  onSubSectionChange?: (sub: "broadcast" | "chat" | "sondagens" | "questionarios") => void;
}

export function GestaoComunicacoes({
  predio,
  fracoes,
  loggedUser,
  activeSubSection = "broadcast",
  onSubSectionChange,
}: GestaoComunicacoesProps) {
  const [commSubTab, setCommSubTab] = useState<"broadcast" | "chat" | "sondagens" | "questionarios">(activeSubSection);

  useEffect(() => {
    if (activeSubSection) setCommSubTab(activeSubSection);
  }, [activeSubSection]);

  const handleTabClick = (sub: "broadcast" | "chat" | "sondagens" | "questionarios") => {
    setCommSubTab(sub);
    if (onSubSectionChange) onSubSectionChange(sub);
  };

  const destinatariosPredio = fracoes
    .filter(f => f.proprietario?.email)
    .map(f => ({ email: f.proprietario.email, nome: f.proprietario.nome }));

  // ==========================================================================
  // 1. BROADCAST (Comunicados & Avisos)
  // ==========================================================================
  const [comunicadosList, setComunicadosList] = useState<Comunicado[]>([]);
  const [loadingComunicados, setLoadingComunicados] = useState(false);
  const [enviandoBroadcast, setEnviandoBroadcast] = useState(false);

  const [comunicadoTitulo, setComunicadoTitulo] = useState("");
  const [comunicadoMensagem, setComunicadoMensagem] = useState("");
  const [comunicadoUrgencia, setComunicadoUrgencia] = useState<"normal" | "urgente">("normal");

  const carregarComunicados = useCallback(async () => {
    if (!predio?.id_predio) return;
    setLoadingComunicados(true);
    const dados = await fetchComunicadosFromSupabase(predio.id_predio);
    setComunicadosList(dados || []);
    setLoadingComunicados(false);
  }, [predio?.id_predio]);

  useEffect(() => { carregarComunicados(); }, [carregarComunicados]);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comunicadoTitulo.trim() || !comunicadoMensagem.trim() || enviandoBroadcast) return;

    if (destinatariosPredio.length === 0) {
      alert("Nenhuma fração tem email de proprietário registado. Não há destinatários para este comunicado.");
      return;
    }

    setEnviandoBroadcast(true);
    try {
      const resp = await fetch("/api/email?acao=broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinatarios: destinatariosPredio,
          assunto: comunicadoTitulo,
          mensagem: comunicadoMensagem,
          urgente: comunicadoUrgencia === "urgente"
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error || "Falha ao enviar comunicado");

      const novoComunicado: Comunicado = {
        id_comunicado: "com_" + Date.now(),
        id_predio: predio.id_predio,
        titulo: comunicadoTitulo,
        mensagem: comunicadoMensagem,
        urgencia: comunicadoUrgencia,
        autor_nome: loggedUser?.nome,
        total_destinatarios: data.total_destinatarios,
        total_enviados: data.total_enviados
      };
      await saveComunicadoToSupabase(novoComunicado);
      setComunicadosList(prev => [{ ...novoComunicado, created_at: new Date().toISOString() }, ...prev]);
      setComunicadoTitulo("");
      setComunicadoMensagem("");

      // Notificação push real (além do email) — silenciosa se ninguém tiver
      // subscrito ainda neste prédio.
      fetch("/api/admin?acao=enviar-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_predio: predio.id_predio,
          title: comunicadoUrgencia === "urgente" ? `🚨 ${novoComunicado.titulo}` : novoComunicado.titulo,
          body: novoComunicado.mensagem,
          // Comunicados urgentes saem sempre; os normais respeitam a preferência "Comunicados Gerais"
          categoria: comunicadoUrgencia === "urgente" ? undefined : "optional_general"
        })
      }).catch(() => {});

      alert(`Comunicado enviado com sucesso a ${data.total_enviados} de ${data.total_destinatarios} destinatário(s)!`);
    } catch (err: any) {
      alert("Erro ao enviar o comunicado: " + (err?.message || "erro desconhecido"));
    } finally {
      setEnviandoBroadcast(false);
    }
  };

  // ==========================================================================
  // 2. CHAT / INBOX (Admin)
  // ==========================================================================
  const [conversas, setConversas] = useState<ConversaCondomino[]>([]);
  const [loadingConversas, setLoadingConversas] = useState(false);
  const [selectedConversaId, setSelectedConversaId] = useState<string>("");
  const [mensagensSelecionadas, setMensagensSelecionadas] = useState<MensagemConversa[]>([]);
  const [respostaTexto, setRespostaTexto] = useState("");
  const [enviandoResposta, setEnviandoResposta] = useState(false);

  const carregarConversas = useCallback(async () => {
    if (!predio?.id_predio) return;
    setLoadingConversas(true);
    const dados = await fetchConversasFromSupabase(predio.id_predio);
    setConversas(dados || []);
    setLoadingConversas(false);
  }, [predio?.id_predio]);

  useEffect(() => { carregarConversas(); }, [carregarConversas]);

  // Realtime: novas conversas / atualizações à lista da inbox
  useEffect(() => {
    if (!isSupabaseConfigured() || !predio?.id_predio) return;
    const canal = supabase
      .channel(`conversas_${predio.id_predio}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversas", filter: `id_predio=eq.${predio.id_predio}` },
        () => { carregarConversas(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [predio?.id_predio, carregarConversas]);

  const carregarMensagens = useCallback(async (idConversa: string) => {
    const dados = await fetchMensagensConversaFromSupabase(idConversa);
    setMensagensSelecionadas(dados || []);
  }, []);

  useEffect(() => {
    if (selectedConversaId) carregarMensagens(selectedConversaId);
    else setMensagensSelecionadas([]);
  }, [selectedConversaId, carregarMensagens]);

  // Realtime: mensagens novas na conversa aberta
  useEffect(() => {
    if (!isSupabaseConfigured() || !selectedConversaId) return;
    const canal = supabase
      .channel(`mensagens_${selectedConversaId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens_conversa", filter: `id_conversa=eq.${selectedConversaId}` },
        (payload: any) => {
          const nova = payload.new;
          setMensagensSelecionadas(prev => prev.some(m => m.id_mensagem === nova.id_mensagem) ? prev : [...prev, {
            id_mensagem: nova.id_mensagem,
            id_conversa: nova.id_conversa,
            autor: nova.autor,
            texto: nova.texto,
            created_at: nova.created_at
          }]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [selectedConversaId]);

  const handleSendResposta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respostaTexto.trim() || !selectedConversaId || enviandoResposta) return;

    const selectedC = conversas.find(c => c.id_conversa === selectedConversaId);
    if (!selectedC) return;

    setEnviandoResposta(true);
    try {
      const novaMensagem: MensagemConversa = {
        id_mensagem: "msg_" + Date.now(),
        id_conversa: selectedConversaId,
        autor: "administracao",
        texto: respostaTexto
      };
      await saveMensagemConversaToSupabase(novaMensagem);
      setMensagensSelecionadas(prev => [...prev, { ...novaMensagem, created_at: new Date().toISOString() }]);

      // Responder já é a própria ação de resolver o pendente — antes a
      // conversa ficava "pendente" para sempre, mesmo depois de respondida,
      // porque só o botão separado "Arquivar" mudava o estado.
      const conversaRespondida = { ...selectedC, estado: "arquivada" as const };
      await saveConversaToSupabase(conversaRespondida);
      setConversas(prev => prev.map(c => c.id_conversa === selectedC.id_conversa ? conversaRespondida : c));

      const fracaoDaConversa = fracoes.find(f => f.id_fracao === selectedC.id_fracao);
      if (fracaoDaConversa?.proprietario?.email) {
        await fetch("/api/email?acao=notificar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: fracaoDaConversa.proprietario.email,
            nomeDestinatario: fracaoDaConversa.proprietario.nome,
            assunto: `Nova resposta da Administração: ${selectedC.assunto || "a sua mensagem"}`,
            mensagem: respostaTexto
          })
        });
      }

      // Notificação push real no telemóvel/PWA do condómino (além do email).
      fetch("/api/admin?acao=enviar-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_predio: selectedC.id_predio,
          id_fracao: selectedC.id_fracao,
          title: "Nova mensagem da Administração",
          body: respostaTexto.length > 120 ? respostaTexto.slice(0, 117) + "..." : respostaTexto,
          url: "/"
        })
      }).catch(() => {});

      setRespostaTexto("");
    } catch (err) {
      alert("Erro ao enviar a resposta.");
    } finally {
      setEnviandoResposta(false);
    }
  };

  const handleArquivarConversa = async (idConversa: string) => {
    const c = conversas.find(cv => cv.id_conversa === idConversa);
    if (!c) return;
    const atualizada = { ...c, estado: "arquivada" as const };
    await saveConversaToSupabase(atualizada);
    setConversas(prev => prev.map(cv => cv.id_conversa === idConversa ? atualizada : cv));
  };

  const selectedConversa = conversas.find(c => c.id_conversa === selectedConversaId);

  // ==========================================================================
  // 3. SONDAGENS
  // ==========================================================================
  const [sondagensList, setSondagensList] = useState<Sondagem[]>([]);
  const [loadingSondagens, setLoadingSondagens] = useState(false);
  const [criandoSondagem, setCriandoSondagem] = useState(false);
  const [sondagemPergunta, setSondagemPergunta] = useState("");
  const [sondagemOpcao1, setSondagemOpcao1] = useState("A Favor");
  const [sondagemOpcao2, setSondagemOpcao2] = useState("Contra");

  const carregarSondagens = useCallback(async () => {
    if (!predio?.id_predio) return;
    setLoadingSondagens(true);
    const dados = await fetchSondagensFromSupabase(predio.id_predio);
    setSondagensList(dados || []);
    setLoadingSondagens(false);
  }, [predio?.id_predio]);

  useEffect(() => { carregarSondagens(); }, [carregarSondagens]);

  const handleCreateSondagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sondagemPergunta.trim() || criandoSondagem) return;

    const ops = [sondagemOpcao1.trim(), sondagemOpcao2.trim()].filter(Boolean);
    setCriandoSondagem(true);
    try {
      const dataFecho = new Date();
      dataFecho.setDate(dataFecho.getDate() + 15);
      const nova: Sondagem = {
        id_sondagem: "sond_" + Date.now(),
        id_predio: predio.id_predio,
        pergunta: sondagemPergunta,
        opcoes: ops,
        estado: "ativa",
        data_fecho: dataFecho.toISOString().split("T")[0]
      };
      const ok = await saveSondagemToSupabase(nova);
      if (!ok) throw new Error("Falha ao gravar sondagem");

      fetch("/api/admin?acao=enviar-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_predio: predio.id_predio,
          title: "🗳️ Nova Sondagem",
          body: sondagemPergunta,
          categoria: "optional_general"
        })
      }).catch(() => {});

      if (destinatariosPredio.length > 0) {
        await fetch("/api/email?acao=broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destinatarios: destinatariosPredio,
            assunto: `Nova Sondagem: ${sondagemPergunta}`,
            mensagem: `A administração lançou uma nova sondagem: "${sondagemPergunta}". Aceda à sua área de condómino para votar.`
          })
        });
      }

      setSondagensList(prev => [{ ...nova, votos: [] }, ...prev]);
      setSondagemPergunta("");
      alert("Sondagem criada e notificação enviada aos condóminos!");
    } catch (err: any) {
      alert("Erro ao criar sondagem: " + (err?.message || "erro desconhecido"));
    } finally {
      setCriandoSondagem(false);
    }
  };

  const handleFecharSondagem = async (idSondagem: string) => {
    const s = sondagensList.find(sd => sd.id_sondagem === idSondagem);
    if (!s) return;
    const atualizada = { ...s, estado: "fechada" as const };
    await saveSondagemToSupabase(atualizada);
    setSondagensList(prev => prev.map(sd => sd.id_sondagem === idSondagem ? atualizada : sd));
  };

  const totalPermilagemPredio = fracoes.reduce((acc, f) => acc + (f.permilagem || 0), 0) || 1000;

  const resultadosPermilagem = (s: Sondagem) => {
    const votos = s.votos || [];
    return s.opcoes.map(op => {
      const totalPermil = votos.filter(v => v.opcao_escolhida === op).reduce((acc, v) => acc + (v.permilagem || 0), 0);
      const pct = Math.min((totalPermil / totalPermilagemPredio) * 100, 100);
      return { opcao: op, votos: votos.filter(v => v.opcao_escolhida === op).length, permilagem: totalPermil, pct };
    });
  };

  // ==========================================================================
  // 4. QUESTIONÁRIOS
  // ==========================================================================
  const [questionariosList, setQuestionariosList] = useState<Questionario[]>([]);
  const [loadingQuestionarios, setLoadingQuestionarios] = useState(false);
  const [criandoQuest, setCriandoQuest] = useState(false);
  const [questTitulo, setQuestTitulo] = useState("");
  const [questDesc, setQuestDesc] = useState("");

  const carregarQuestionarios = useCallback(async () => {
    if (!predio?.id_predio) return;
    setLoadingQuestionarios(true);
    const dados = await fetchQuestionariosFromSupabase(predio.id_predio);
    setQuestionariosList(dados || []);
    setLoadingQuestionarios(false);
  }, [predio?.id_predio]);

  useEffect(() => { carregarQuestionarios(); }, [carregarQuestionarios]);

  const handleCreateQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questTitulo.trim() || criandoQuest) return;

    setCriandoQuest(true);
    try {
      const novo: Questionario = {
        id_questionario: "quest_" + Date.now(),
        id_predio: predio.id_predio,
        titulo: questTitulo,
        descricao: questDesc,
        estado: "ativo"
      };
      const ok = await saveQuestionarioToSupabase(novo);
      if (!ok) throw new Error("Falha ao gravar questionário");

      fetch("/api/admin?acao=enviar-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_predio: predio.id_predio,
          title: "📋 Novo Questionário",
          body: questTitulo,
          categoria: "optional_general"
        })
      }).catch(() => {});

      if (destinatariosPredio.length > 0) {
        await fetch("/api/email?acao=broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destinatarios: destinatariosPredio,
            assunto: `Novo Questionário: ${questTitulo}`,
            mensagem: `A administração publicou um novo questionário: "${questTitulo}". ${questDesc || ""} Aceda à sua área de condómino para responder.`
          })
        });
      }

      setQuestionariosList(prev => [{ ...novo, respostas: [] }, ...prev]);
      setQuestTitulo("");
      setQuestDesc("");
      alert("Questionário publicado e notificação enviada aos condóminos!");
    } catch (err: any) {
      alert("Erro ao criar questionário: " + (err?.message || "erro desconhecido"));
    } finally {
      setCriandoQuest(false);
    }
  };

  const handleEncerrarQuest = async (idQuestionario: string) => {
    const q = questionariosList.find(qq => qq.id_questionario === idQuestionario);
    if (!q) return;
    const atualizado = { ...q, estado: "encerrado" as const };
    await saveQuestionarioToSupabase(atualizado);
    setQuestionariosList(prev => prev.map(qq => qq.id_questionario === idQuestionario ? atualizado : qq));
  };

  return (
    <div className="space-y-6">
      {/* HEADER PRINCIPAL - VERDE CLARO CONDOMANAGER */}
      <div className="bg-emerald-50 border border-emerald-200 text-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 border border-emerald-300 shrink-0 shadow-xs">
              <img src="/modulos/73-mensagem-global.png" alt="Mensagens" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-wide text-slate-800 flex items-center gap-2">
                <span>
                  {commSubTab === "broadcast" && "📢 Comunicados & Avisos (Gerais)"}
                  {commSubTab === "chat" && "💬 Mensagens & Inbox (Admin)"}
                  {commSubTab === "sondagens" && "📊 Sondagens & Votações"}
                  {commSubTab === "questionarios" && "📝 Questionários & Inquérito"}
                </span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Prédio: <strong className="text-emerald-900">{predio?.nome || predio?.morada_linha1 || "Condomínio"}</strong> — Canal oficial de comunicação e envio de avisos.
              </p>
            </div>
          </div>
          <div className="bg-white px-3.5 py-1.5 rounded-lg border border-emerald-300 text-xs font-bold text-emerald-800 shadow-xs flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Canal Oficial de Comunicação Ativo</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["broadcast", "chat", "sondagens", "questionarios"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => handleTabClick(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                commSubTab === tab ? "bg-emerald-600 text-white" : "bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              {tab === "broadcast" && "📢 Comunicados"}
              {tab === "chat" && "💬 Mensagens"}
              {tab === "sondagens" && "📊 Sondagens"}
              {tab === "questionarios" && "📝 Questionários"}
            </button>
          ))}
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO CORRESPONDENTE AO SUB-MENU SELECIONADO */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs min-h-[450px]">

        {/* SUB-MENU 1: COMUNICADOS & AVISOS (BROADCAST) */}
        {commSubTab === "broadcast" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleSendBroadcast} className="lg:col-span-5 space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200/80">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <i className="fa-solid fa-pen-nib text-emerald-600"></i> Redigir Novo Comunicado Geral
              </h4>
              <p className="text-[10px] text-slate-500">
                Será enviado por email a {destinatariosPredio.length} fração(ões) com email registado.
              </p>

              <button
                type="button"
                onClick={() => {
                  const servico = prompt("Serviço afetado (ex: Elevador, Água, Eletricidade):", "Elevador");
                  if (servico === null) return;
                  const data = prompt("Data da interrupção:", new Date().toLocaleDateString("pt-PT"));
                  if (data === null) return;
                  const periodo = prompt("Período estimado (ex: 09:00 - 13:00):", "09:00 - 13:00");
                  if (periodo === null) return;
                  setComunicadoTitulo(`Aviso Urgente: Interrupção Temporária de ${servico}`);
                  setComunicadoUrgencia("urgente");
                  setComunicadoMensagem(`Informamos que, por motivos de manutenção inadiável, haverá uma interrupção temporária do seguinte serviço comum:\n\nServiço afetado: ${servico}\nData: ${data}\nPeríodo: ${periodo}\n\nAgradecemos desde já a melhor compreensão para eventuais constrangimentos temporários.`);
                }}
                className="w-full text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg py-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-triangle-exclamation"></i> Usar Modelo: Interrupção Temporária de Serviços
              </button>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Título do Comunicado *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Limpeza das Garagens ou Convocatória"
                  value={comunicadoTitulo}
                  onChange={e => setComunicadoTitulo(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Nível de Urgência</label>
                <select
                  value={comunicadoUrgencia}
                  onChange={e => setComunicadoUrgencia(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="normal">Normal (Informativo)</option>
                  <option value="urgente">🚨 Urgente (Destacado no Portal)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Conteúdo da Mensagem *</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Escreva aqui os detalhes do comunicado a enviar para todos os condóminos..."
                  value={comunicadoMensagem}
                  onChange={e => setComunicadoMensagem(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={enviandoBroadcast}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold p-3 rounded-xl text-xs transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
              >
                {enviandoBroadcast ? (
                  <><i className="fa-solid fa-spinner fa-spin text-xs"></i><span>A enviar...</span></>
                ) : (
                  <><i className="fa-solid fa-paper-plane text-xs"></i><span>Disparar Comunicado Global</span></>
                )}
              </button>
            </form>

            <div className="lg:col-span-7 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Histórico de Comunicados Enviados</h4>
              <div className="space-y-3">
                {loadingComunicados ? (
                  <div className="text-center text-slate-400 py-10 text-xs"><i className="fa-solid fa-spinner fa-spin mr-2"></i>A carregar...</div>
                ) : comunicadosList.length === 0 ? (
                  <div className="text-center text-slate-400 py-10 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs">
                    <i className="fa-solid fa-bullhorn text-2xl mb-2 text-slate-300 block"></i>
                    Nenhum comunicado enviado até ao momento. Utilize o formulário para disparar um comunicado para todos os condóminos.
                  </div>
                ) : (
                  comunicadosList.map(item => (
                    <div key={item.id_comunicado} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-xs text-slate-900">{item.titulo}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.urgencia === "urgente" ? "bg-red-100 text-red-700 border border-red-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"}`}>
                          {item.urgencia === "urgente" ? "🚨 Urgente" : "Informativo"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{item.mensagem}</p>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
                        <span>Data: {item.created_at ? new Date(item.created_at).toLocaleDateString("pt-PT") : ""}</span>
                        <span className="text-emerald-600 font-bold">✓ Enviado a {item.total_enviados}/{item.total_destinatarios} fração(ões)</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* SUB-MENU 2: MENSAGENS & INBOX (CHAT) */}
        {commSubTab === "chat" && (
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">Mensagens Recebidas</h4>
            <div className="space-y-2 max-w-2xl">
              {loadingConversas ? (
                <div className="text-center text-slate-400 py-8 text-xs"><i className="fa-solid fa-spinner fa-spin mr-2"></i>A carregar...</div>
              ) : conversas.length === 0 ? (
                <div className="text-center text-slate-400 py-8 px-2 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs">
                  <i className="fa-regular fa-comments text-2xl mb-1 text-slate-300 block"></i>
                  Nenhuma mensagem recebida na caixa de entrada.
                </div>
              ) : (
                conversas.map(c => (
                  <button
                    key={c.id_conversa}
                    onClick={() => setSelectedConversaId(c.id_conversa)}
                    className="w-full text-left p-3 rounded-xl border transition-all cursor-pointer space-y-1 bg-slate-50 border-slate-200 hover:bg-slate-100"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-slate-900 truncate">{c.proprietario_nome}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${c.estado === "pendente" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"}`}>
                        {c.estado === "pendente" ? "Pendente" : "Arquivada"}
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-800 truncate">{fracoes.find(f => f.id_fracao === c.id_fracao)?.fracao_nome || c.id_fracao}</div>
                    <div className="text-[10px] text-slate-500 truncate">{c.assunto}</div>
                  </button>
                ))
              )}
            </div>

            {/* MODAL DE CONVERSA (estilo WhatsApp) — abre ao selecionar uma
                mensagem, em vez de mostrar a conversa inline ao lado da
                lista. */}
            {selectedConversa && (
              <div
                onClick={(e) => { if (e.target === e.currentTarget) setSelectedConversaId(""); }}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl flex flex-col h-[85vh] sm:h-[600px] overflow-hidden"
                >
                  {/* Cabeçalho estilo WhatsApp */}
                  <div className="bg-emerald-700 text-white px-4 py-3 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button onClick={() => setSelectedConversaId("")} className="text-white/90 hover:text-white cursor-pointer shrink-0">
                        <i className="fa-solid fa-arrow-left"></i>
                      </button>
                      <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                        {selectedConversa.proprietario_nome.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs truncate">{selectedConversa.proprietario_nome}</div>
                        <div className="text-[10px] text-emerald-100 truncate">
                          Fração {fracoes.find(f => f.id_fracao === selectedConversa.id_fracao)?.fracao_nome || selectedConversa.id_fracao}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {selectedConversa.estado === "pendente" && (
                        <button
                          onClick={() => handleArquivarConversa(selectedConversa.id_conversa)}
                          className="text-[10px] font-bold text-white/90 hover:text-white border border-white/30 rounded-lg px-2.5 py-1.5 cursor-pointer"
                        >
                          <i className="fa-solid fa-box-archive mr-1"></i> Arquivar
                        </button>
                      )}
                      <button onClick={() => setSelectedConversaId("")} className="text-white/80 hover:text-white cursor-pointer p-1">
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  </div>

                  {/* Corpo de mensagens (fundo estilo WhatsApp) */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#e5ddd5] bg-[radial-gradient(#d9d0c7_1px,transparent_1px)] bg-[length:14px_14px]">
                    <div className="text-center text-[10px] text-slate-500 bg-white/70 rounded-lg px-2 py-1 inline-block mx-auto block w-fit">{selectedConversa.assunto}</div>
                    {mensagensSelecionadas.map((m) => (
                      <div key={m.id_mensagem} className={`flex ${m.autor === "administracao" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] p-2.5 rounded-xl text-xs space-y-1 shadow-xs ${m.autor === "administracao" ? "bg-emerald-100 text-slate-800" : "bg-white text-slate-800"}`}>
                          <div>{m.texto}</div>
                          <div className="text-[9px] text-slate-400 text-right">{m.created_at ? new Date(m.created_at).toLocaleString("pt-PT") : ""}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Campo de resposta */}
                  <form onSubmit={handleSendResposta} className="p-3 border-t border-slate-200 bg-white flex items-center gap-2 shrink-0">
                    <textarea
                      rows={1}
                      required
                      placeholder="Escreva a resposta oficial da administração..."
                      value={respostaTexto}
                      onChange={e => setRespostaTexto(e.target.value)}
                      className="flex-1 text-xs p-2.5 rounded-full border border-slate-300 focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                    <button
                      type="submit"
                      disabled={enviandoResposta}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white w-10 h-10 rounded-full transition-all cursor-pointer flex items-center justify-center shrink-0"
                    >
                      {enviandoResposta ? <i className="fa-solid fa-spinner fa-spin text-xs"></i> : <i className="fa-solid fa-paper-plane text-xs"></i>}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUB-MENU 3: SONDAGENS & VOTAÇÕES */}
        {commSubTab === "sondagens" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleCreateSondagem} className="lg:col-span-5 space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200/80">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <i className="fa-solid fa-plus-circle text-emerald-600"></i> Criar Nova Sondagem / Votação
              </h4>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Pergunta / Tópico em Votação *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Instalação de Painéis Solares na Cobertura?"
                  value={sondagemPergunta}
                  onChange={e => setSondagemPergunta(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Opção 1</label>
                  <input
                    type="text"
                    required
                    value={sondagemOpcao1}
                    onChange={e => setSondagemOpcao1(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Opção 2</label>
                  <input
                    type="text"
                    required
                    value={sondagemOpcao2}
                    onChange={e => setSondagemOpcao2(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={criandoSondagem}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold p-3 rounded-xl text-xs transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
              >
                {criandoSondagem ? <i className="fa-solid fa-spinner fa-spin text-xs"></i> : <i className="fa-solid fa-square-poll-horizontal text-xs"></i>}
                <span>Lançar Sondagem aos Condóminos</span>
              </button>
            </form>

            <div className="lg:col-span-7 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Sondagens Ativas e Resultados (ponderado por permilagem)</h4>
              <div className="space-y-4">
                {loadingSondagens ? (
                  <div className="text-center text-slate-400 py-10 text-xs"><i className="fa-solid fa-spinner fa-spin mr-2"></i>A carregar...</div>
                ) : sondagensList.length === 0 ? (
                  <div className="text-center text-slate-400 py-10 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs">
                    <i className="fa-solid fa-square-poll-horizontal text-2xl mb-2 text-slate-300 block"></i>
                    Nenhuma sondagem ou votação ativa no momento. Utilize o formulário para criar uma nova sondagem para os condóminos.
                  </div>
                ) : (
                  sondagensList.map(s => (
                    <div key={s.id_sondagem} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-xs text-slate-900">{s.pergunta}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${s.estado === "ativa" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-slate-200 text-slate-600 border-slate-300"}`}>
                            {s.estado === "ativa" ? `Ativa (fecha ${s.data_fecho ? new Date(s.data_fecho).toLocaleDateString("pt-PT") : ""})` : "Fechada"}
                          </span>
                          {s.estado === "ativa" && (
                            <button onClick={() => handleFecharSondagem(s.id_sondagem)} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer">
                              Fechar
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 pt-1">
                        {resultadosPermilagem(s).map(r => (
                          <div key={r.opcao} className="space-y-1">
                            <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                              <span>{r.opcao}</span>
                              <span>{r.votos} voto(s) — {r.pct.toFixed(1)}‰ do total</span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${r.pct}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* SUB-MENU 4: QUESTIONÁRIOS & INQUÉRITOS */}
        {commSubTab === "questionarios" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleCreateQuest} className="lg:col-span-5 space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200/80">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <i className="fa-solid fa-plus-circle text-emerald-600"></i> Criar Inquérito aos Condóminos
              </h4>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Título do Inquérito *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Inquérito de Satisfação da Limpeza"
                  value={questTitulo}
                  onChange={e => setQuestTitulo(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Descrição / Instruções</label>
                <textarea
                  rows={4}
                  placeholder="Explique o objetivo deste inquérito aos proprietários..."
                  value={questDesc}
                  onChange={e => setQuestDesc(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={criandoQuest}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold p-3 rounded-xl text-xs transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
              >
                {criandoQuest ? <i className="fa-solid fa-spinner fa-spin text-xs"></i> : <i className="fa-solid fa-paper-plane text-xs"></i>}
                <span>Publicar Inquérito aos Condóminos</span>
              </button>
            </form>

            <div className="lg:col-span-7 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Inquéritos em Andamento</h4>
              <div className="space-y-3">
                {loadingQuestionarios ? (
                  <div className="text-center text-slate-400 py-10 text-xs"><i className="fa-solid fa-spinner fa-spin mr-2"></i>A carregar...</div>
                ) : questionariosList.length === 0 ? (
                  <div className="text-center text-slate-400 py-10 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs">
                    <i className="fa-solid fa-clipboard-question text-2xl mb-2 text-slate-300 block"></i>
                    Nenhum inquérito ou questionário criado até ao momento. Utilize o formulário para lançar um inquérito de auscultação aos condóminos.
                  </div>
                ) : (
                  questionariosList.map(q => (
                    <div key={q.id_questionario} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-xs text-slate-900">{q.titulo}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${q.estado === "ativo" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-slate-200 text-slate-600 border-slate-300"}`}>
                            {q.estado === "ativo" ? "Ativo" : "Encerrado"}
                          </span>
                          {q.estado === "ativo" && (
                            <button onClick={() => handleEncerrarQuest(q.id_questionario)} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer">
                              Encerrar
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600">{q.descricao}</p>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-2 border-t border-slate-200">
                        <span>Criado em: {q.created_at ? new Date(q.created_at).toLocaleDateString("pt-PT") : ""}</span>
                        <span className="font-bold text-emerald-700">{(q.respostas || []).length} Respostas Recebidas</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
