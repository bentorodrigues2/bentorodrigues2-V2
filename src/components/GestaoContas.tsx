import React, { useState } from "react";
import { Predio, Conta, LoggedUser } from "../types";
import { saveContaToSupabase, deleteContaFromSupabase } from "../lib/supabaseService";

interface GestaoContasProps {
  predio: Predio;
  contas: Conta[];
  onAddConta: (novaConta: Conta) => void;
  onSetPrincipalConta?: (id_conta: string) => void;
  onDeleteConta?: (id_conta: string) => void;
  loggedUser: LoggedUser;
}

export function GestaoContas({ predio, contas, onAddConta, onSetPrincipalConta, onDeleteConta, loggedUser }: GestaoContasProps) {
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

  const predioContas = contas.filter(c => c.id_predio === predio.id_predio);

  const submeterForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedUser.role !== 'ADMIN') return alert("Apenas administradores podem registar contas bancárias!");
    if (!banco || !iban || !saldo) return alert("Preencha todos os campos obrigatórios (*)");

    const nova: Conta = {
      id_conta: "cta-" + Date.now(),
      id_predio: predio.id_predio,
      banco,
      iban,
      tipo,
      saldo: Number(saldo),
      balcao,
      morada_balcao: moradaBalcao,
      contacto_banco: contactoBanco,
      gestor_contas: gestorContas,
      email_gestor: emailGestor || undefined,
      is_principal: isPrincipal
    };
    onAddConta(nova);
    await saveContaToSupabase(nova);
    setBanco(""); setIban(""); setTipo("Ordem (Gestão Corrente)"); setSaldo(""); setBalcao(""); setMoradaBalcao(""); setContactoBanco(""); setGestorContas(""); setEmailGestor(""); setIsPrincipal(false);
  };

  return (
    <div className="space-y-6">
      {loggedUser.role === 'ADMIN' && (
        <form onSubmit={submeterForm} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-slate-800">Cadastrar Nova Conta Bancária do Condomínio</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Instituição Bancária *</label>
              <input type="text" value={banco} onChange={e => setBanco(e.target.value)} placeholder="Ex: Caixa Geral de Depósitos" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">IBAN Oficial da Conta *</label>
              <input type="text" value={iban} onChange={e => setIban(e.target.value)} placeholder="PT50..." className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono-custom" />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Finalidade da Conta *</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 bg-white">
                <option value="Ordem (Gestão Corrente)">Ordem (Gestão Corrente)</option>
                <option value="Fundo Comum de Reserva (FCR)">Fundo Comum de Reserva (FCR)</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Saldo Inicial (€) *</label>
              <input type="number" min="0" step="0.01" value={saldo} onChange={e => setSaldo(e.target.value)} placeholder="0.00" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono-custom" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Balcão / Agência</label>
              <input type="text" value={balcao} onChange={e => setBalcao(e.target.value)} placeholder="Ex: Seixal Centro" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
            </div>
            <div className="flex flex-col col-span-1">
              <label className="text-xs font-semibold text-slate-500 mb-1">Morada do Balcão</label>
              <input type="text" value={moradaBalcao} onChange={e => setMoradaBalcao(e.target.value)} placeholder="Morada física" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Contacto do Balcão</label>
              <input type="text" value={contactoBanco} onChange={e => setContactoBanco(e.target.value)} placeholder="Ex: 219 013 111" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono-custom" />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Gestor de Contas Direto</label>
              <input type="text" value={gestorContas} onChange={e => setGestorContas(e.target.value)} placeholder="Ex: Dr. Pedro Antunes" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500" />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">E-mail do Gestor</label>
              <input type="email" value={emailGestor} onChange={e => setEmailGestor(e.target.value)} placeholder="Ex: gestor@banco.pt" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-emerald-500 font-mono-custom" />
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

          <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors cursor-pointer">
            <i className="fa-solid fa-plus mr-1.5"></i> Registar Conta Bancária
          </button>
        </form>
      )}

      {/* Contas Ativas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {predioContas.map(c => (
          <div key={c.id_conta} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <h4 className="text-base font-bold text-slate-800">{c.banco}</h4>
                  {c.is_principal && (
                    <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200/60 px-2 py-0.5 rounded-full font-black tracking-tight flex items-center">
                      <i className="fa-solid fa-star mr-1 text-amber-400"></i> Principal
                    </span>
                  )}
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded font-semibold">{c.tipo}</span>
              </div>
              <div className="text-xs space-y-2 text-slate-600">
                <p className="flex items-center"><i className="fa-solid fa-hashtag mr-2 text-slate-400"></i>IBAN: <span className="font-mono-custom ml-1 font-semibold">{c.iban}</span></p>
                {c.balcao && <p className="flex items-center"><i className="fa-solid fa-building-columns mr-2 text-slate-400"></i>Balcão/Agência: {c.balcao}</p>}
                {c.morada_balcao && <p className="flex items-center"><i className="fa-solid fa-location-dot mr-2 text-slate-400"></i>Morada: {c.morada_balcao}</p>}
                {c.contacto_banco && <p className="flex items-center"><i className="fa-solid fa-phone mr-2 text-slate-400"></i>Contacto: <span className="font-mono-custom ml-1">{c.contacto_banco}</span></p>}
                
                {c.gestor_contas && (
                  <div className="space-y-1">
                    <p className="flex items-center"><i className="fa-solid fa-user-tie mr-2 text-slate-400"></i>Gestor: {c.gestor_contas}</p>
                    {c.email_gestor && (
                      <p className="flex items-center text-slate-500 pl-6 font-mono-custom text-[11px]"><i className="fa-solid fa-envelope mr-1.5 text-slate-400 text-[10px]"></i>{c.email_gestor}</p>
                    )}
                  </div>
                )}
                
                <p className="text-xl font-bold text-slate-800 flex items-center pt-2">
                  <i className="fa-solid fa-wallet mr-2 text-slate-400 text-sm"></i>
                  <span className="font-mono-custom">{c.saldo.toFixed(2)}€</span>
                </p>
              </div>
            </div>

            {!c.is_principal && loggedUser.role === 'ADMIN' && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button 
                  type="button"
                  onClick={async () => {
                    if (confirm(`Tem a certeza de que deseja eliminar a conta bancária "${c.banco}"?`)) {
                      onDeleteConta?.(c.id_conta);
                      await deleteContaFromSupabase(c.id_conta);
                    }
                  }}
                  className="text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 font-bold transition-all flex items-center gap-1 cursor-pointer"
                  title="Eliminar Conta"
                >
                  <img src="/estados-acoes/14-eliminar.png" alt="Eliminar" className="h-3.5 w-3.5 object-contain" />
                  <span>Eliminar</span>
                </button>

                <button 
                  type="button"
                  onClick={() => onSetPrincipalConta?.(c.id_conta)}
                  className="text-[11px] text-slate-600 hover:text-amber-700 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-200 rounded-lg px-3 py-1.5 font-bold transition-all flex items-center cursor-pointer"
                >
                  <i className="fa-regular fa-star mr-1.5 text-amber-500"></i> Definir como Principal
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
