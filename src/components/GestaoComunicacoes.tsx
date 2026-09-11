import React, { useState } from "react";
import { Predio, Fracao, LoggedUser, Aviso } from "../types";

interface GestaoComunicacoesProps {
  predio: Predio;
  fracoes: Fracao[];
  avisos: Aviso[];
  setAvisos?: React.Dispatch<React.SetStateAction<Aviso[]>>;
  loggedUser: LoggedUser;
  activeSubSection?: "broadcast" | "chat" | "sondagens" | "questionarios";
  onSubSectionChange?: (sub: "broadcast" | "chat" | "sondagens" | "questionarios") => void;
}

interface ConversaItem {
  id: string;
  fracaoId: string;
  fracaoNome: string;
  proprietario: string;
  assunto: string;
  ultima_atualizacao: string;
  estado: "pendente" | "arquivada";
  mensagens: Array<{ autor: "condomino" | "administracao"; texto: string; data: string }>;
}

export function GestaoComunicacoes({
  predio,
  fracoes,
  avisos,
  loggedUser,
  activeSubSection = "broadcast",
  onSubSectionChange,
}: GestaoComunicacoesProps) {
  const [commSubTab, setCommSubTab] = useState<"broadcast" | "chat" | "sondagens" | "questionarios">(activeSubSection);

  // Sync internal state when prop changes
  React.useEffect(() => {
    if (activeSubSection) {
      setCommSubTab(activeSubSection);
    }
  }, [activeSubSection]);

  const handleTabClick = (sub: "broadcast" | "chat" | "sondagens" | "questionarios") => {
    setCommSubTab(sub);
    if (onSubSectionChange) {
      onSubSectionChange(sub);
    }
  };

  // 1. BROADCAST STATE
  const [comunicadosList, setComunicadosList] = useState<Array<{
    id: string;
    titulo: string;
    mensagem: string;
    data_envio: string;
    urgencia: "normal" | "urgente";
    anexos: string[];
    estado: string;
  }>>([]);

  const [comunicadoTitulo, setComunicadoTitulo] = useState("");
  const [comunicadoMensagem, setComunicadoMensagem] = useState("");
  const [comunicadoUrgencia, setComunicadoUrgencia] = useState<"normal" | "urgente">("normal");

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comunicadoTitulo.trim() || !comunicadoMensagem.trim()) return;

    const newCom = {
      id: "com_" + Date.now(),
      titulo: comunicadoTitulo,
      mensagem: comunicadoMensagem,
      data_envio: new Date().toLocaleDateString("pt-PT"),
      urgencia: comunicadoUrgencia,
      anexos: [],
      estado: "enviado",
    };

    setComunicadosList(prev => [newCom, ...prev]);
    setComunicadoTitulo("");
    setComunicadoMensagem("");
    alert("Comunicado Global enviado com sucesso para todas as frações!");
  };

  // 2. CHAT / INBOX STATE
  const [conversas, setConversas] = useState<ConversaItem[]>([]);

  const [selectedConversaId, setSelectedConversaId] = useState<string>("");
  const [respostaTexto, setRespostaTexto] = useState("");

  const handleSendResposta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!respostaTexto.trim()) return;

    setConversas(prev => prev.map(c => {
      if (c.id === selectedConversaId) {
        return {
          ...c,
          estado: "arquivada" as const,
          ultima_atualizacao: new Date().toLocaleDateString("pt-PT"),
          mensagens: [
            ...c.mensagens,
            { autor: "administracao", texto: respostaTexto, data: new Date().toLocaleDateString("pt-PT") + " " + new Date().toTimeString().split(" ")[0].substring(0, 5) }
          ]
        };
      }
      return c;
    }));

    setRespostaTexto("");
    alert("Resposta enviada com sucesso! A conversa foi arquivada no histórico.");
  };

  // 3. SONDAGENS STATE
  const [sondagensList, setSondagensList] = useState<Array<{
    id: string;
    pergunta: string;
    opcoes: string[];
    votos: Record<string, number>;
    estado: string;
    criada: string;
    fecho: string;
  }>>([]);

  const [sondagemPergunta, setSondagemPergunta] = useState("");
  const [sondagemOpcao1, setSondagemOpcao1] = useState("A Favor");
  const [sondagemOpcao2, setSondagemOpcao2] = useState("Contra");

  const handleCreateSondagem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sondagemPergunta.trim()) return;

    const ops = [sondagemOpcao1.trim(), sondagemOpcao2.trim()].filter(Boolean);
    const initVotes: Record<string, number> = {};
    ops.forEach(o => { initVotes[o] = 0; });

    const newSond = {
      id: "sond_" + Date.now(),
      pergunta: sondagemPergunta,
      opcoes: ops,
      votos: initVotes,
      estado: "ativa",
      criada: new Date().toLocaleDateString("pt-PT"),
      fecho: "Em 15 dias",
    };

    setSondagensList(prev => [newSond, ...prev]);
    setSondagemPergunta("");
    alert("Sondagem criada e disponibilizada aos condóminos com sucesso!");
  };

  // 4. QUESTIONÁRIOS STATE
  const [questionariosList, setQuestionariosList] = useState<Array<{
    id: string;
    titulo: string;
    descricao: string;
    respostasCount: number;
    criado: string;
    estado: string;
  }>>([]);

  const [questTitulo, setQuestTitulo] = useState("");
  const [questDesc, setQuestDesc] = useState("");

  const handleCreateQuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questTitulo.trim()) return;

    const newQuest = {
      id: "quest_" + Date.now(),
      titulo: questTitulo,
      descricao: questDesc,
      respostasCount: 0,
      criado: new Date().toLocaleDateString("pt-PT"),
      estado: "ativo",
    };

    setQuestionariosList(prev => [newQuest, ...prev]);
    setQuestTitulo("");
    setQuestDesc("");
    alert("Questionário criado com sucesso!");
  };

  const selectedConversa = conversas.find(c => c.id === selectedConversaId) || conversas[0];

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
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3 rounded-xl text-xs transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-paper-plane text-xs"></i>
                <span>Disparar Comunicado Global</span>
              </button>
            </form>

            <div className="lg:col-span-7 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Histórico de Comunicados Enviados</h4>
              <div className="space-y-3">
                {comunicadosList.length === 0 ? (
                  <div className="text-center text-slate-400 py-10 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs">
                    <i className="fa-solid fa-bullhorn text-2xl mb-2 text-slate-300 block"></i>
                    Nenhum comunicado enviado até ao momento. Utilize o formulário para disparar um comunicado para todos os condóminos.
                  </div>
                ) : (
                  comunicadosList.map(item => (
                    <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-xs text-slate-900">{item.titulo}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.urgencia === "urgente" ? "bg-red-100 text-red-700 border border-red-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"}`}>
                          {item.urgencia === "urgente" ? "🚨 Urgente" : "Informativo"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{item.mensagem}</p>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
                        <span>Data: {item.data_envio}</span>
                        <span className="text-emerald-600 font-bold">✓ Enviado a todas as frações</span>
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-3 border-r border-slate-200 pr-0 lg:pr-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">Mensagens Recebidas</h4>
              <div className="space-y-2">
                {conversas.length === 0 ? (
                  <div className="text-center text-slate-400 py-8 px-2 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs">
                    <i className="fa-regular fa-comments text-2xl mb-1 text-slate-300 block"></i>
                    Nenhuma mensagem recebida na caixa de entrada.
                  </div>
                ) : (
                  conversas.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedConversaId(c.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer space-y-1 ${
                        selectedConversaId === c.id
                          ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/20"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-slate-900 truncate">{c.proprietario}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${c.estado === "pendente" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"}`}>
                          {c.estado === "pendente" ? "Pendente" : "Arquivada"}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-800 truncate">{c.fracaoNome}</div>
                      <div className="text-[10px] text-slate-500 truncate">{c.assunto}</div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
              {selectedConversa ? (
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="border-b border-slate-200 pb-3 mb-4">
                      <h3 className="font-bold text-sm text-slate-900">{selectedConversa.assunto}</h3>
                      <p className="text-xs text-slate-500">{selectedConversa.fracaoNome} — {selectedConversa.proprietario}</p>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto p-2">
                      {selectedConversa.mensagens.map((m, idx) => (
                        <div key={idx} className={`flex ${m.autor === "administracao" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] p-3 rounded-xl text-xs space-y-1 ${m.autor === "administracao" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-800 border border-slate-200"}`}>
                            <div className="font-bold text-[10px] opacity-80">{m.autor === "administracao" ? "Administração" : selectedConversa.proprietario}</div>
                            <div>{m.texto}</div>
                            <div className="text-[9px] opacity-70 text-right">{m.data}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleSendResposta} className="space-y-2 pt-3 border-t border-slate-200">
                    <label className="block text-[11px] font-bold text-slate-700">Responder ao Condómino:</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Escreva a resposta oficial da administração..."
                      value={respostaTexto}
                      onChange={e => setRespostaTexto(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-2"
                    >
                      <i className="fa-solid fa-reply text-xs"></i>
                      <span>Enviar Resposta & Arquivar</span>
                    </button>
                  </form>
                </div>
              ) : (
                <div className="text-center text-slate-400 py-16 text-xs bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                  <i className="fa-solid fa-inbox text-3xl mb-2 text-slate-300 block"></i>
                  Nenhuma mensagem selecionada ou recebida.
                </div>
              )}
            </div>
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
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3 rounded-xl text-xs transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-square-poll-horizontal text-xs"></i>
                <span>Lançar Sondagem aos Condóminos</span>
              </button>
            </form>

            <div className="lg:col-span-7 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Sondagens Ativas e Resultados</h4>
              <div className="space-y-4">
                {sondagensList.length === 0 ? (
                  <div className="text-center text-slate-400 py-10 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs">
                    <i className="fa-solid fa-square-poll-horizontal text-2xl mb-2 text-slate-300 block"></i>
                    Nenhuma sondagem ou votação ativa no momento. Utilize o formulário para criar uma nova sondagem para os condóminos.
                  </div>
                ) : (
                  sondagensList.map(s => (
                    <div key={s.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-xs text-slate-900">{s.pergunta}</span>
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                          Ativa ({s.fecho})
                        </span>
                      </div>

                      <div className="space-y-2 pt-1">
                        {Object.entries(s.votos).map(([op, v]) => {
                          const count = Number(v) || 0;
                          return (
                            <div key={op} className="space-y-1">
                              <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                                <span>{op}</span>
                                <span>{count} Votos</span>
                              </div>
                              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(count * 8, 100)}%` }}></div>
                              </div>
                            </div>
                          );
                        })}
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
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3 rounded-xl text-xs transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-paper-plane text-xs"></i>
                <span>Publicar Inquérito aos Condóminos</span>
              </button>
            </form>

            <div className="lg:col-span-7 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Inquéritos em Andamento</h4>
              <div className="space-y-3">
                {questionariosList.length === 0 ? (
                  <div className="text-center text-slate-400 py-10 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs">
                    <i className="fa-solid fa-clipboard-question text-2xl mb-2 text-slate-300 block"></i>
                    Nenhum inquérito ou questionário criado até ao momento. Utilize o formulário para lançar um inquérito de auscultação aos condóminos.
                  </div>
                ) : (
                  questionariosList.map(q => (
                    <div key={q.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-xs text-slate-900">{q.titulo}</span>
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                          Ativo
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{q.descricao}</p>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-2 border-t border-slate-200">
                        <span>Criado em: {q.criado}</span>
                        <span className="font-bold text-emerald-700">{q.respostasCount} Respostas Recebidas</span>
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
