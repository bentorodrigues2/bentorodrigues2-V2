import React, { useState, useRef } from "react";
import { Predio, Conta, LoggedUser } from "../types";
import { saveContaToSupabase, deleteContaFromSupabase } from "../lib/supabaseService";
import { parseValorMonetario } from "../utils";
import { 
  Building2, 
  CreditCard, 
  Wallet, 
  Save, 
  Pencil, 
  Trash2, 
  Plus, 
  X, 
  Star, 
  CheckCircle2, 
  MapPin, 
  Phone, 
  UserCheck, 
  Mail,
  AlertCircle
} from "lucide-react";

interface GestaoContasProps {
  predio: Predio;
  contas: Conta[];
  onAddConta: (novaConta: Conta) => void;
  onUpdateConta?: (contaAtualizada: Conta) => void;
  onSetPrincipalConta?: (id_conta: string) => void;
  onDeleteConta?: (id_conta: string) => void;
  loggedUser: LoggedUser;
}

export function GestaoContas({ 
  predio, 
  contas, 
  onAddConta, 
  onUpdateConta, 
  onSetPrincipalConta, 
  onDeleteConta, 
  loggedUser 
}: GestaoContasProps) {
  const [editingContaId, setEditingContaId] = useState<string | null>(null);
  const [banco, setBanco] = useState("");
  const [iban, setIban] = useState("");
  const [tipo, setTipo] = useState("Ordem (Gestão Corrente)");
  const [saldo, setSaldo] = useState("");
  const [balcao, setBalcao] = useState("");
  const [moradaBalcao, setMoradaBalcao] = useState("");
  const [contactoBanco, setContactoBanco] = useState("");
  const [gestorContas, setGestorContas] = useState("");
  const [emailGestor, setEmailGestor] = useState("");
  const [isPrincipal, setIsPrincipal] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [aReconciliarSaldo, setAReconciliarSaldo] = useState(false);

  const formRef = useRef<HTMLFormElement | null>(null);
  const predioContas = contas.filter(c => c.id_predio === predio.id_predio);

  // Correção pontual (mas segura de repetir) para pagamentos confirmados
  // antes de o saldo passar a ser creditado automaticamente ao confirmar —
  // ver server/lib/contaSaldo.js. Fica disponível aqui como rede de
  // segurança, mesmo já não sendo precisa para pagamentos confirmados a
  // partir de agora.
  const handleReconciliarSaldo = async () => {
    if (loggedUser.role !== "ADMIN") return;
    setAReconciliarSaldo(true);
    try {
      const resp = await fetch("/api/pagamento?acao=reconciliar-saldo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_predio: predio.id_predio })
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        alert(`Não foi possível reconciliar o saldo: ${data?.error || "erro desconhecido"}`);
        return;
      }
      if (data.quantidade === 0) {
        alert("✅ Nada a corrigir — todos os pagamentos confirmados já estão refletidos no saldo.");
        return;
      }
      if (onUpdateConta && data.id_conta && data.saldo_novo !== null) {
        const contaAtual = predioContas.find(c => c.id_conta === data.id_conta);
        if (contaAtual) {
          onUpdateConta({ ...contaAtual, saldo: Number(data.saldo_novo) });
        }
      }
      alert(`✅ Saldo corrigido: +${Number(data.creditado).toFixed(2)}€ (${data.quantidade} pagamento(s) confirmado(s) que ainda não estavam refletidos). Novo saldo: ${Number(data.saldo_novo).toFixed(2)}€.`);
    } catch (err: any) {
      alert(`Não foi possível reconciliar o saldo: ${err?.message || "erro de rede"}`);
    } finally {
      setAReconciliarSaldo(false);
    }
  };

  const handleIniciarEdicao = (conta: Conta) => {
    setEditingContaId(conta.id_conta);
    setBanco(conta.banco);
    setIban(conta.iban);
    setTipo(conta.tipo);
    setSaldo(conta.saldo !== undefined ? String(conta.saldo) : "0");
    setBalcao(conta.balcao || "");
    setMoradaBalcao(conta.morada_balcao || "");
    setContactoBanco(conta.contacto_banco || "");
    setGestorContas(conta.gestor_contas || "");
    setEmailGestor(conta.email_gestor || "");
    setIsPrincipal(Boolean(conta.is_principal));
    
    // Rolar suavemente até o formulário
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleCancelarEdicao = () => {
    setEditingContaId(null);
    setBanco("");
    setIban("");
    setTipo("Ordem (Gestão Corrente)");
    setSaldo("");
    setBalcao("");
    setMoradaBalcao("");
    setContactoBanco("");
    setGestorContas("");
    setEmailGestor("");
    setIsPrincipal(false);
  };

  const submeterForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedUser.role !== 'ADMIN') {
      alert("Apenas administradores podem registar ou editar contas bancárias!");
      return;
    }

    if (!banco.trim() || !iban.trim() || saldo === "") {
      alert("Por favor preencha os campos obrigatórios (*): Banco, IBAN e Saldo.");
      return;
    }

    if (editingContaId) {
      // MODO EDIÇÃO
      const contaAtualizada: Conta = {
        id_conta: editingContaId,
        id_predio: predio.id_predio,
        banco: banco.trim(),
        iban: iban.trim(),
        tipo,
        saldo: parseValorMonetario(saldo),
        balcao: balcao.trim() || undefined,
        morada_balcao: moradaBalcao.trim() || undefined,
        contacto_banco: contactoBanco.trim() || undefined,
        gestor_contas: gestorContas.trim() || undefined,
        email_gestor: emailGestor.trim() || undefined,
        is_principal: isPrincipal
      };

      if (onUpdateConta) {
        onUpdateConta(contaAtualizada);
      } else {
        onAddConta(contaAtualizada);
      }
      await saveContaToSupabase(contaAtualizada);

      setMensagemSucesso(`Conta bancária "${banco}" atualizada com sucesso!`);
      setTimeout(() => setMensagemSucesso(null), 4000);
      handleCancelarEdicao();
    } else {
      // MODO CRIAÇÃO
      const nova: Conta = {
        id_conta: "cta-" + Date.now(),
        id_predio: predio.id_predio,
        banco: banco.trim(),
        iban: iban.trim(),
        tipo,
        saldo: parseValorMonetario(saldo),
        balcao: balcao.trim() || undefined,
        morada_balcao: moradaBalcao.trim() || undefined,
        contacto_banco: contactoBanco.trim() || undefined,
        gestor_contas: gestorContas.trim() || undefined,
        email_gestor: emailGestor.trim() || undefined,
        is_principal: isPrincipal || predioContas.length === 0
      };

      onAddConta(nova);
      await saveContaToSupabase(nova);

      setMensagemSucesso(`Conta bancária "${banco}" guardada com sucesso!`);
      setTimeout(() => setMensagemSucesso(null), 4000);
      handleCancelarEdicao();
    }
  };

  const handleEliminarConta = async (conta: Conta) => {
    if (confirm(`Tem a certeza de que deseja eliminar a conta bancária "${conta.banco}" (${conta.iban})?`)) {
      onDeleteConta?.(conta.id_conta);
      await deleteContaFromSupabase(conta.id_conta);
      if (editingContaId === conta.id_conta) {
        handleCancelarEdicao();
      }
      setMensagemSucesso(`Conta "${conta.banco}" eliminada com sucesso.`);
      setTimeout(() => setMensagemSucesso(null), 4000);
    }
  };

  return (
    <div className="space-y-6" id="gestao-contas-container">
      {/* Notificação de Sucesso */}
      {mensagemSucesso && (
        <div id="contas-success-alert" className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-2 text-sm shadow-xs transition-all">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{mensagemSucesso}</span>
        </div>
      )}

      {/* Formulário de Criação / Edição */}
      {loggedUser.role === 'ADMIN' && (
        <form 
          ref={formRef}
          onSubmit={submeterForm} 
          id="form-gestao-conta"
          className={`p-6 rounded-2xl border transition-all space-y-4 shadow-sm ${
            editingContaId 
              ? "bg-amber-50/40 border-amber-300 ring-2 ring-amber-200" 
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${editingContaId ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                {editingContaId ? <Pencil className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800">
                  {editingContaId ? `Editar Conta Bancária: ${banco || "Conta"}` : "Cadastrar Nova Conta Bancária do Condomínio"}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingContaId 
                    ? "Altere os dados da conta bancária e clique em Guardar Alterações." 
                    : "Registe a conta oficial à ordem ou fundo de reserva para associação a quotas e cobranças."}
                </p>
              </div>
            </div>

            {editingContaId && (
              <button
                type="button"
                onClick={handleCancelarEdicao}
                id="btn-cancelar-edicao-topo"
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancelar</span>
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <label htmlFor="input-banco" className="text-xs font-semibold text-slate-600 mb-1">Instituição Bancária *</label>
              <input 
                id="input-banco"
                type="text" 
                value={banco} 
                onChange={e => setBanco(e.target.value)} 
                placeholder="Ex: Caixa Geral de Depósitos" 
                className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white" 
                required
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="input-iban" className="text-xs font-semibold text-slate-600 mb-1">IBAN Oficial da Conta *</label>
              <input 
                id="input-iban"
                type="text" 
                value={iban} 
                onChange={e => setIban(e.target.value)} 
                placeholder="PT50..." 
                className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono bg-white" 
                required
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="select-tipo" className="text-xs font-semibold text-slate-600 mb-1">Finalidade da Conta *</label>
              <select 
                id="select-tipo"
                value={tipo} 
                onChange={e => setTipo(e.target.value)} 
                className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white"
              >
                <option value="Ordem (Gestão Corrente)">Ordem (Gestão Corrente)</option>
                <option value="Fundo Comum de Reserva (FCR)">Fundo Comum de Reserva (FCR)</option>
                <option value="Poupança Intervenções & Obras">Poupança Intervenções & Obras</option>
                <option value="Depósito a Prazo">Depósito a Prazo</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label htmlFor="input-saldo" className="text-xs font-semibold text-slate-600 mb-1">Saldo Atual (€) *</label>
              <input
                id="input-saldo"
                type="text"
                inputMode="decimal"
                value={saldo}
                onChange={e => setSaldo(e.target.value)}
                placeholder="0,00"
                className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono bg-white"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="flex flex-col">
              <label htmlFor="input-balcao" className="text-xs font-semibold text-slate-600 mb-1">Balcão / Agência</label>
              <input 
                id="input-balcao"
                type="text" 
                value={balcao} 
                onChange={e => setBalcao(e.target.value)} 
                placeholder="Ex: Seixal Centro" 
                className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white" 
              />
            </div>
            <div className="flex flex-col col-span-1">
              <label htmlFor="input-morada-balcao" className="text-xs font-semibold text-slate-600 mb-1">Morada do Balcão</label>
              <input 
                id="input-morada-balcao"
                type="text" 
                value={moradaBalcao} 
                onChange={e => setMoradaBalcao(e.target.value)} 
                placeholder="Morada física" 
                className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white" 
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="input-contacto-banco" className="text-xs font-semibold text-slate-600 mb-1">Contacto do Balcão</label>
              <input 
                id="input-contacto-banco"
                type="text" 
                value={contactoBanco} 
                onChange={e => setContactoBanco(e.target.value)} 
                placeholder="Ex: 219 013 111" 
                className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono bg-white" 
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="input-gestor-contas" className="text-xs font-semibold text-slate-600 mb-1">Gestor de Contas Direto</label>
              <input 
                id="input-gestor-contas"
                type="text" 
                value={gestorContas} 
                onChange={e => setGestorContas(e.target.value)} 
                placeholder="Ex: Dr. Pedro Antunes" 
                className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white" 
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="input-email-gestor" className="text-xs font-semibold text-slate-600 mb-1">E-mail do Gestor</label>
              <input 
                id="input-email-gestor"
                type="email" 
                value={emailGestor} 
                onChange={e => setEmailGestor(e.target.value)} 
                placeholder="Ex: gestor@banco.pt" 
                className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono bg-white" 
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-1 pb-2">
            <input 
              type="checkbox" 
              id="isPrincipal" 
              checked={isPrincipal} 
              onChange={e => setIsPrincipal(e.target.checked)} 
              className="h-4 w-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="isPrincipal" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
              Definir como conta principal de depósitos do condomínio
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button 
              type="submit" 
              id="btn-guardar-conta"
              className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all flex items-center gap-2 shadow-xs cursor-pointer ${
                editingContaId 
                  ? "bg-amber-600 hover:bg-amber-700" 
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              <img 
                src={editingContaId ? "/estados-acoes/13-editar.png" : "/estados-acoes/12-adicionar.png"} 
                alt="Guardar" 
                className="w-4 h-4 object-contain" 
              />
              <Save className="w-4 h-4" />
              <span>{editingContaId ? "Guardar Alterações" : "Guardar Conta Bancária"}</span>
            </button>

            {editingContaId && (
              <button
                type="button"
                onClick={handleCancelarEdicao}
                id="btn-cancelar-edicao"
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200"
              >
                <X className="w-4 h-4" />
                <span>Cancelar</span>
              </button>
            )}
          </div>
        </form>
      )}

      {/* Lista de Contas Bancárias Ativas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-600" />
            <h4 className="text-base font-bold text-slate-800">
              Contas Bancárias Ativas ({predioContas.length})
            </h4>
          </div>
          {predioContas.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                Saldo Total Acumulado: <strong className="font-mono text-slate-800 font-bold text-sm">
                  {predioContas.reduce((acc, c) => acc + (Number(c.saldo) || 0), 0).toFixed(2)}€
                </strong>
              </span>
              {loggedUser.role === 'ADMIN' && (
                <button
                  type="button"
                  onClick={handleReconciliarSaldo}
                  disabled={aReconciliarSaldo}
                  title="Verifica se há pagamentos confirmados que ainda não estão refletidos no saldo (ex: confirmados antes da correção automática) e credita a diferença."
                  className="text-[11px] text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <i className={`fa-solid ${aReconciliarSaldo ? "fa-spinner fa-spin" : "fa-rotate"}`}></i>
                  <span>{aReconciliarSaldo ? "A verificar..." : "Reconciliar Saldo"}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {predioContas.length === 0 ? (
          /* Estado Vazio - Sem contas ativas de teste */
          <div id="empty-contas-state" className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3 shadow-xs">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Nenhuma Conta Bancária Registada</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Não existem contas ativas de teste. Utilize o formulário acima para registar a conta bancária oficial do condomínio (ex: Caixa Geral de Depósitos, Millennium, Santander, etc.).
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="grid-contas-ativas">
            {predioContas.map(c => {
              const isEditing = editingContaId === c.id_conta;
              return (
                <div 
                  key={c.id_conta} 
                  id={`card-conta-${c.id_conta}`}
                  className={`bg-white p-6 rounded-2xl border shadow-xs space-y-4 flex flex-col justify-between transition-all ${
                    isEditing 
                      ? "border-amber-400 ring-2 ring-amber-200" 
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-emerald-600" />
                          <span>{c.banco}</span>
                        </h4>
                        {c.is_principal && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-black tracking-tight flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> Principal
                          </span>
                        )}
                      </div>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-semibold">
                        {c.tipo}
                      </span>
                    </div>

                    <div className="text-xs space-y-2 text-slate-600">
                      <p className="flex items-center">
                        <span className="font-semibold text-slate-400 w-16">IBAN:</span>
                        <span className="font-mono ml-1 font-bold text-slate-800">{c.iban}</span>
                      </p>
                      {c.balcao && (
                        <p className="flex items-center">
                          <span className="text-slate-400 w-16">Balcão:</span>
                          <span className="ml-1 text-slate-700">{c.balcao}</span>
                        </p>
                      )}
                      {c.morada_balcao && (
                        <p className="flex items-center">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0" />
                          <span className="text-slate-700">{c.morada_balcao}</span>
                        </p>
                      )}
                      {c.contacto_banco && (
                        <p className="flex items-center">
                          <Phone className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0" />
                          <span className="font-mono text-slate-700">{c.contacto_banco}</span>
                        </p>
                      )}
                      
                      {c.gestor_contas && (
                        <div className="space-y-1 pt-1 border-t border-slate-100">
                          <p className="flex items-center">
                            <UserCheck className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
                            <span className="text-slate-700 font-medium">Gestor: {c.gestor_contas}</span>
                          </p>
                          {c.email_gestor && (
                            <p className="flex items-center text-slate-500 pl-5 font-mono text-[11px]">
                              <Mail className="w-3 h-3 text-slate-400 mr-1 shrink-0" />
                              <span>{c.email_gestor}</span>
                            </p>
                          )}
                        </div>
                      )}
                      
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-500">Saldo Disponível:</span>
                        <span className="text-xl font-bold font-mono text-slate-900">
                          {Number(c.saldo || 0).toFixed(2)}€
                        </span>
                      </div>
                    </div>
                  </div>

                  {loggedUser.role === 'ADMIN' && (
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {/* Botão Editar com Ícone Lápis */}
                        <button 
                          type="button"
                          id={`btn-editar-conta-${c.id_conta}`}
                          onClick={() => handleIniciarEdicao(c)}
                          className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title="Editar Conta Bancária"
                        >
                          <img src="/estados-acoes/13-editar.png" alt="Editar" className="w-3.5 h-3.5 object-contain" />
                          <span>Editar</span>
                        </button>

                        {/* Botão Eliminar com Ícone Lixo */}
                        <button 
                          type="button"
                          id={`btn-eliminar-conta-${c.id_conta}`}
                          onClick={() => handleEliminarConta(c)}
                          className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title="Eliminar Conta Bancária"
                        >
                          <img src="/estados-acoes/14-eliminar.png" alt="Eliminar" className="w-3.5 h-3.5 object-contain" />
                          <span>Eliminar</span>
                        </button>
                      </div>

                      {!c.is_principal && (
                        <button 
                          type="button"
                          id={`btn-definir-principal-${c.id_conta}`}
                          onClick={() => onSetPrincipalConta?.(c.id_conta)}
                          className="text-xs text-slate-600 hover:text-amber-700 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-200 rounded-lg px-2.5 py-1.5 font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Star className="w-3.5 h-3.5 text-amber-500" />
                          <span>Principal</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
