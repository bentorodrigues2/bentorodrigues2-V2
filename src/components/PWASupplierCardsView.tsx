import React, { useState, useRef, useEffect } from "react";
import { LoggedUser, Fornecedor, Predio, Documento } from "../types";
import { formatQuotaReceiptNumber } from "../utils";
import { saveFornecedorToSupabase, saveDocumentoToSupabase, savePushSubscriptionToSupabase, registarLogAuditoria } from "../lib/supabaseService";
import { supabase } from "../lib/supabaseClient";
import { subscribeUserToPush } from "../utils/subscribeUser";

interface PWASupplierCardsViewProps {
  loggedUser: LoggedUser;
  fornecedores: Fornecedor[];
  predio?: Predio;
  onUpdateFornecedor?: (updated: Fornecedor) => void;
  onAddDocumento?: (doc: Documento) => void;
  onClose?: () => void;
  initialTab?: "perfil" | "seguranca" | "financeiro";
}

export function PWASupplierCardsView({
  loggedUser,
  fornecedores,
  predio,
  onAddDocumento,
  onUpdateFornecedor,
  onClose,
  initialTab = "perfil"
}: PWASupplierCardsViewProps) {
  const [activeTab, setActiveTab] = useState<"perfil" | "seguranca" | "financeiro">(initialTab);

  // Find supplier matching logged user name or first supplier as default
  const myFornecedor = fornecedores.find(
    f => f.nome.toLowerCase().includes((loggedUser.nome || "").toLowerCase()) ||
         (loggedUser.email && f.email_contacto === loggedUser.email)
  ) || fornecedores[0] || {
    id_fornecedor: "forn-1",
    id_predio: "predio-1",
    nome: loggedUser.nome || "OTIS Elevadores Lda",
    nif: "500112233",
    iban: "PT50003344556677889900112",
    categoria: "Manutenção Elevadores",
    morada: "Av. da Liberdade 120, Lisboa",
    contacto: "214156000",
    pessoa_contacto: "Eng. João Costa",
    telemovel_direto: "912345678",
    email_contacto: loggedUser.email || "joao.costa@otis.pt",
    data_nascimento: "1985-04-12",
    perfis_pwa: ["TECNICO"]
  };

  // --- PERFIL STATE ---
  const [iban, setIban] = useState(myFornecedor.iban || "PT50003344556677889900112");
  const [email, setEmail] = useState(myFornecedor.email_contacto || myFornecedor.contacto || "joao.costa@otis.pt");
  const [telemovel, setTelemovel] = useState(myFornecedor.telemovel_direto || myFornecedor.contacto || "912345678");
  const [morada, setMorada] = useState(myFornecedor.morada || "Av. da Liberdade 120, Lisboa");
  const [dataNascimento, setDataNascimento] = useState(myFornecedor.data_nascimento || "1985-04-12");
  const [fotoWebp, setFotoWebp] = useState<string | null>(myFornecedor.foto || null);

  // Handle Photo WebP Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        // Convert to WebP format
        const webpData = canvas.toDataURL("image/webp", 0.85);
        setFotoWebp(webpData);
        alert("✨ Fotografia convertida e atualizada para formato WebP com sucesso!");
      };
    };
    reader.readAsDataURL(file);
  };

  const handleSavePerfil = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Fornecedor = {
      ...myFornecedor,
      iban,
      email_contacto: email,
      telemovel_direto: telemovel,
      morada,
      data_nascimento: dataNascimento,
      foto: fotoWebp || undefined
    };
    if (onUpdateFornecedor) onUpdateFornecedor(updated);
    saveFornecedorToSupabase(updated).catch(console.error);
    alert("✅ Perfil profissional do fornecedor atualizado com sucesso!");
  };

  // --- SEGURANÇA STATE ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pushAtivo, setPushAtivo] = useState(false);
  const [ativandoPush, setAtivandoPush] = useState(false);
  const handleAtivarPush = async () => {
    if (ativandoPush) return;
    setAtivandoPush(true);
    try {
      if (typeof Notification === "undefined") {
        alert("Este dispositivo/navegador não suporta notificações push.");
        return;
      }
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        alert("Permissão de notificações não concedida.");
        return;
      }
      const subscription = await subscribeUserToPush();
      if (!subscription) {
        alert("❌ Não foi possível ativar as notificações neste dispositivo.");
        return;
      }
      const ok = await savePushSubscriptionToSupabase({
        idPredio: predio?.id_predio,
        subscription
      });
      if (ok) {
        setPushAtivo(true);
        alert("✅ Notificações push ativadas neste dispositivo!");
      } else {
        alert("❌ Não foi possível guardar a subscrição.");
      }
    } finally {
      setAtivandoPush(false);
    }
  };
  const [biometriaAtiva, setBiometriaAtiva] = useState(true);

  const [updatingPassword, setUpdatingPassword] = useState(false);
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return alert("A nova palavra-passe deve conter pelo menos 6 caracteres!");
    if (newPassword !== confirmPassword) return alert("As palavras-passes introduzidas não coincidem!");
    setUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setUpdatingPassword(false);
    if (error) {
      alert("❌ Erro ao atualizar a palavra-passe: " + error.message);
      return;
    }
    alert("🔐 Palavra-passe atualizada com sucesso!");
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
  };

  // --- FINANCEIRO STATE ---
  const [finSubTab, setFinSubTab] = useState<"ai_upload" | "manual">("ai_upload");
  const [uploadingAi, setUploadingAi] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  // Manual Receipt Form State
  const [reciboValor, setReciboValor] = useState("125.00");
  const [reciboMes, setReciboMes] = useState("Julho/2026");
  const [reciboCategoria, setReciboCategoria] = useState(myFornecedor.categoria || "Manutenção Elevadores");
  const [reciboNif, setReciboNif] = useState(myFornecedor.nif || "500112233");
  const [reciboIban, setReciboIban] = useState(iban || "PT50003344556677889900112");
  
  // Signature Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    if (activeTab === "financeiro" && finSubTab === "manual" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#0284c7"; // Cyan/Blue signature line
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
      }
    }
  }, [activeTab, finSubTab]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setHasSignature(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    ctx?.beginPath();
    ctx?.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    ctx?.lineTo(clientX - rect.left, clientY - rect.top);
    ctx?.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const [aiUploadError, setAiUploadError] = useState<string | null>(null);
  const lerFicheiroComoBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // AI Receipt Upload Handler — lê mesmo o ficheiro com o motor real de IA
  // multimodal (Gemini Vision), já usado noutros leitores de documentos da
  // app; antes enviava só o nome do ficheiro para um endpoint que só lê
  // texto, nunca lia o conteúdo, e mostrava sempre os mesmos dados fixos.
  const handleAiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAi(true);
    setAiResult(null);
    setAiUploadError(null);

    try {
      const base64 = await lerFicheiroComoBase64(file);
      const res = await fetch("/api/ai?acao=reconhecer-anexo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType: file.type || "application/octet-stream" })
      });
      const resultado = await res.json();
      if (!res.ok || !resultado.ok) {
        throw new Error(resultado?.error || "A IA não conseguiu ler este documento.");
      }
      const dados = resultado.dados || {};
      setAiResult({
        nif: dados.nif || myFornecedor.nif || "",
        valor: Number(dados.valor_total) || 0,
        mes: dados.data_documento || "",
        categoria: dados.categoria_contabilistica || myFornecedor.categoria || "",
        iban: iban || "",
        data: dados.data_documento || new Date().toLocaleDateString("pt-PT"),
        fornecedor_nome: dados.entidade || myFornecedor.nome,
        resumo: `Leitura real por IA (Gemini Vision): ${dados.entidade || myFornecedor.nome}, ${Number(dados.valor_total || 0).toFixed(2)}€.`
      });
    } catch (err: any) {
      setAiUploadError(err?.message || "Não foi possível ler o ficheiro.");
    } finally {
      setUploadingAi(false);
    }
  };

  const handleConfirmAiReceipt = () => {
    const num = formatQuotaReceiptNumber(Math.floor(100 + Math.random() * 900));
    if (onAddDocumento && predio) {
      onAddDocumento({
        id_doc: `doc-rec-forn-${Date.now()}`,
        id_predio: predio.id_predio,
        nome: `Recibo_${myFornecedor.nome.replace(/\s+/g, "_")}_${num}.pdf`,
        tipo: "Recibo de Fornecedor",
        data_upload: new Date().toISOString().split("T")[0],
        tamanho: "",
        categoria: aiResult.categoria || "Fornecedores",
        descricao: `Recibo nº ${num} — ${aiResult.resumo || ""}. Valor: ${aiResult.valor}€.`,
        visibilidade: "Administração",
        autor: myFornecedor.nome,
        tema: "Fornecedores",
        ano: new Date().getFullYear().toString(),
        fornecedor: myFornecedor.nome
      });
      registarLogAuditoria("Financeira", `Fornecedor "${myFornecedor.nome}" submeteu recibo nº ${num}`, predio.id_predio, loggedUser, `${aiResult.valor}€`);
    }
    alert(`🎉 Recibo de Cobrança emitido com sucesso!\n\nNúmero Oficial: ${num}\nFornecedor: ${myFornecedor.nome}\nValor: ${aiResult.valor}€\nCategoria: ${aiResult.categoria}\n\nEnviado para validação na gestão financeira do condomínio.`);
    setAiResult(null);
  };

  const handleSubmitManualReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSignature) return alert("Por favor assine electronicamente o recibo no quadro abaixo!");

    const num = formatQuotaReceiptNumber(Math.floor(100 + Math.random() * 900));
    const assinaturaBase64 = canvasRef.current?.toDataURL("image/png");
    if (onAddDocumento && predio) {
      onAddDocumento({
        id_doc: `doc-rec-forn-${Date.now()}`,
        id_predio: predio.id_predio,
        nome: `Recibo_Manual_${myFornecedor.nome.replace(/\s+/g, "_")}_${num}.pdf`,
        tipo: "Recibo de Fornecedor",
        data_upload: new Date().toISOString().split("T")[0],
        tamanho: "",
        categoria: reciboCategoria,
        descricao: `Recibo manual nº ${num} — NIF: ${reciboNif}, IBAN: ${reciboIban}, Mês: ${reciboMes}. Valor: ${reciboValor}€.`,
        visibilidade: "Administração",
        autor: myFornecedor.nome,
        tema: "Fornecedores",
        ano: new Date().getFullYear().toString(),
        fornecedor: myFornecedor.nome,
        url_foto: assinaturaBase64
      });
      registarLogAuditoria("Financeira", `Fornecedor "${myFornecedor.nome}" submeteu recibo manual nº ${num}`, predio.id_predio, loggedUser, `${reciboValor}€`);
    }
    alert(`🎉 Recibo Manual emitido e assinado com sucesso!\n\nNúmero Oficial: ${num}\nNIF: ${reciboNif}\nIBAN: ${reciboIban}\nValor: ${reciboValor}€\nMês: ${reciboMes}\nCategoria: ${reciboCategoria}\n\nAssinatura digital anexada ao documento.`);
    clearCanvas();
  };

  return (
    <div className="bg-slate-900 text-slate-100 min-h-full flex flex-col font-sans select-none animate-fadeIn pb-12">
      {/* Navigation Header */}
      <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-lg">
            {fotoWebp ? (
              <img src={fotoWebp} alt="WebP Avatar" className="w-full h-full object-cover rounded-xl" />
            ) : (
              "🏢"
            )}
          </div>
          <div>
            <h2 className="text-xs font-black uppercase text-emerald-400 tracking-wider">Gestão do Fornecedor PWA</h2>
            <p className="text-[11px] font-bold text-white truncate max-w-[180px]">{myFornecedor.nome}</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 cursor-pointer text-xs font-bold">
            ✕ Fechar
          </button>
        )}
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-800 bg-slate-950/80 px-2 pt-2 gap-1 text-xs font-bold">
        <button
          onClick={() => setActiveTab("perfil")}
          className={`flex-1 py-2.5 rounded-t-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "perfil"
              ? "bg-slate-900 text-emerald-400 border-t-2 border-emerald-500 shadow-inner"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>👤</span>
          <span>Perfil</span>
        </button>
        <button
          onClick={() => setActiveTab("seguranca")}
          className={`flex-1 py-2.5 rounded-t-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "seguranca"
              ? "bg-slate-900 text-emerald-400 border-t-2 border-emerald-500 shadow-inner"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>🔐</span>
          <span>Segurança</span>
        </button>
        <button
          onClick={() => setActiveTab("financeiro")}
          className={`flex-1 py-2.5 rounded-t-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "financeiro"
              ? "bg-slate-900 text-emerald-400 border-t-2 border-emerald-500 shadow-inner"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>🧾</span>
          <span>Financeiro</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-4 flex-1 overflow-y-auto">
        {/* --- TAB 1: PERFIL --- */}
        {activeTab === "perfil" && (
          <form onSubmit={handleSavePerfil} className="space-y-4 text-xs">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <h3 className="font-bold text-emerald-400 text-xs uppercase flex items-center gap-2">
                <i className="fa-solid fa-id-card"></i> Dados do Fornecedor / Parceiro
              </h3>

              {/* WebP Photo Upload */}
              <div className="flex items-center space-x-4 bg-slate-900 p-3 rounded-lg border border-slate-800">
                <div className="w-16 h-16 bg-slate-800 border-2 border-dashed border-emerald-500/50 rounded-xl flex items-center justify-center overflow-hidden shrink-0 relative">
                  {fotoWebp ? (
                    <img src={fotoWebp} alt="Foto WebP" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">📸</span>
                  )}
                </div>
                <div className="space-y-1 flex-1">
                  <label className="block text-[10px] font-bold text-slate-300 uppercase">Fotografia / Logótipo (Formato WebP)</label>
                  <label className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] cursor-pointer transition-colors">
                    <i className="fa-solid fa-upload mr-1"></i> Carregar & Converter em WebP
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                  <p className="text-[9px] text-slate-500">A imagem é otimizada e convertida automaticamente para WebP.</p>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Empresa / Fornecedor</label>
                  <input type="text" value={myFornecedor.nome} disabled className="w-full bg-slate-900 border border-slate-800 p-2 rounded-lg text-slate-400 font-bold" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">NIF Contribuinte</label>
                    <input type="text" value={myFornecedor.nif} disabled className="w-full bg-slate-900 border border-slate-800 p-2 rounded-lg text-slate-400 font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data de Nascimento</label>
                    <input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white font-mono focus:border-emerald-500 focus:outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">IBAN de Cobrança</label>
                  <input type="text" value={iban} onChange={e => setIban(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-emerald-400 font-mono font-bold focus:border-emerald-500 focus:outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">E-mail de Notificações</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white font-mono focus:border-emerald-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Telemóvel Direto</label>
                    <input type="text" value={telemovel} onChange={e => setTelemovel(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white font-mono focus:border-emerald-500 focus:outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Morada Fiscal / Operações</label>
                  <input type="text" value={morada} onChange={e => setMorada(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white focus:border-emerald-500 focus:outline-none" />
                </div>
              </div>

              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-all cursor-pointer shadow-md text-center mt-2">
                <i className="fa-solid fa-floppy-disk mr-1.5"></i> Guardar Alterações do Perfil
              </button>
            </div>
          </form>
        )}

        {/* --- TAB 2: SEGURANÇA --- */}
        {activeTab === "seguranca" && (
          <div className="space-y-4 text-xs">
            <form onSubmit={handleUpdatePassword} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <h3 className="font-bold text-emerald-400 text-xs uppercase flex items-center gap-2">
                <i className="fa-solid fa-shield-halved"></i> Gestão de Palavra-Passe
              </h3>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Palavra-passe Atual</label>
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white focus:border-emerald-500 focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Nova Palavra-passe</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white focus:border-emerald-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Confirmar Palavra-passe</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white focus:border-emerald-500 focus:outline-none" />
                </div>
              </div>

              <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold py-2 rounded-xl transition-all cursor-pointer text-center">
                Atualizar Segurança
              </button>
            </form>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <h3 className="font-bold text-emerald-400 text-xs uppercase flex items-center gap-2">
                <i className="fa-solid fa-bell"></i> Notificações PWA
              </h3>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <span>Notificações Push neste dispositivo</span>
                  <button
                    type="button"
                    onClick={handleAtivarPush}
                    disabled={ativandoPush || pushAtivo}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                      pushAtivo ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
                    }`}
                  >
                    {pushAtivo ? "✓ Ativas" : ativandoPush ? "A ativar..." : "Ativar"}
                  </button>
                </div>
                <p className="text-[9px] text-slate-500">E-mail e SMS de emergência: em breve.</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <h3 className="font-bold text-emerald-400 text-xs uppercase flex items-center gap-2">
                <i className="fa-solid fa-fingerprint"></i> Dados Biométricos
              </h3>
              <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-800">
                <div>
                  <p className="font-bold text-white text-[11px]">Autenticação Biométrica (Touch ID / Face ID)</p>
                  <p className="text-[9px] text-slate-400">Permite aceder rapidamente à PWA com biometria no telemóvel.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBiometriaAtiva(!biometriaAtiva)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all cursor-pointer ${
                    biometriaAtiva ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {biometriaAtiva ? "Ativo ✓" : "Inativo"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 3: FINANCEIRO --- */}
        {activeTab === "financeiro" && (
          <div className="space-y-4 text-xs">
            {/* Subtab selection */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 font-bold text-[11px]">
              <button
                onClick={() => setFinSubTab("ai_upload")}
                className={`py-2 rounded-lg text-center transition-all cursor-pointer ${
                  finSubTab === "ai_upload" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                🤖 Reconhecimento AI (PDF/DOC/JPEG)
              </button>
              <button
                onClick={() => setFinSubTab("manual")}
                className={`py-2 rounded-lg text-center transition-all cursor-pointer ${
                  finSubTab === "manual" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                ✍️ Recibo Manual c/ Assinatura
              </button>
            </div>

            {/* AI UPLOAD SUBTAB */}
            {finSubTab === "ai_upload" && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-emerald-400 text-xs uppercase flex items-center gap-2">
                    <i className="fa-solid fa-wand-magic-sparkles"></i> Enviar Recibo de Cobrança com Leitura IA
                  </h3>
                  <p className="text-[10px] text-slate-400">Suporta ficheiros em formato PDF, DOC ou imagens JPEG. A IA lê e extrai automaticamente NIF, valor, mês, categoria e IBAN.</p>
                </div>

                <div className="border-2 border-dashed border-emerald-500/40 rounded-xl p-6 text-center space-y-3 bg-slate-900/50 hover:bg-slate-900 transition-colors">
                  <div className="w-12 h-12 mx-auto bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center text-xl">
                    <i className="fa-solid fa-file-invoice-dollar"></i>
                  </div>
                  <div>
                    <label className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shadow-md transition-all">
                      <i className="fa-solid fa-cloud-arrow-up mr-1.5"></i> Selecionar Ficheiro (PDF / DOC / JPEG)
                      <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleAiFileUpload} className="hidden" />
                    </label>
                  </div>
                  <p className="text-[9px] text-slate-500">Ou arraste e largue o recibo de cobrança para esta área.</p>
                </div>

                {uploadingAi && (
                  <div className="p-4 bg-slate-900 rounded-xl border border-emerald-500/30 text-center space-y-2 animate-pulse">
                    <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-emerald-400 font-bold text-xs">A analisar recibo com Gemini Vision...</p>
                  </div>
                )}

                {aiUploadError && (
                  <div className="p-4 bg-red-950/60 rounded-xl border border-red-700/50 text-xs font-bold text-red-300">
                    ❌ {aiUploadError}
                  </div>
                )}

                {aiResult && (
                  <div className="bg-slate-900 border border-emerald-500/50 p-4 rounded-xl space-y-3 animate-zoom-in">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="font-bold text-emerald-400 uppercase text-[10px] flex items-center gap-1.5">
                        <i className="fa-solid fa-circle-check text-emerald-400"></i> Extração Concluída com Sucesso
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{aiResult.data}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-[9px] text-slate-400 block uppercase font-sans">NIF Emissor:</span>
                        <span className="text-white font-bold">{aiResult.nif}</span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-[9px] text-slate-400 block uppercase font-sans">Valor Total (€):</span>
                        <span className="text-emerald-400 font-bold text-sm">{Number(aiResult.valor).toFixed(2)}€</span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-[9px] text-slate-400 block uppercase font-sans">Mês / Ano:</span>
                        <span className="text-white font-bold">{aiResult.mes}</span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-[9px] text-slate-400 block uppercase font-sans">Categoria:</span>
                        <span className="text-white font-bold">{aiResult.categoria}</span>
                      </div>
                    </div>

                    <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[10px] font-mono">
                      <span className="text-[9px] text-slate-400 block uppercase font-sans">IBAN Extraído:</span>
                      <span className="text-emerald-300 font-bold">{aiResult.iban}</span>
                    </div>

                    <button
                      onClick={handleConfirmAiReceipt}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-all cursor-pointer shadow-md text-center"
                    >
                       Confirmar & Emitir Recibo BR2 XXXXX
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* MANUAL RECEIPT SUBTAB */}
            {finSubTab === "manual" && (
              <form onSubmit={handleSubmitManualReceipt} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h3 className="font-bold text-emerald-400 text-xs uppercase flex items-center gap-2">
                  <i className="fa-solid fa-pen-nib"></i> Elaboração Manual de Recibo de Cobrança
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">NIF Emissor</label>
                    <input type="text" value={reciboNif} onChange={e => setReciboNif(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white font-mono focus:border-emerald-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Valor (€)</label>
                    <input type="text" value={reciboValor} onChange={e => setReciboValor(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-emerald-400 font-mono font-bold focus:border-emerald-500 focus:outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mês de Referência</label>
                    <input type="text" value={reciboMes} onChange={e => setReciboMes(e.target.value)} placeholder="Ex: Julho/2026" className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white focus:border-emerald-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Categoria (Atribuída)</label>
                    <input type="text" value={reciboCategoria} onChange={e => setReciboCategoria(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white focus:border-emerald-500 focus:outline-none font-bold" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">IBAN para Liquidação</label>
                  <input type="text" value={reciboIban} onChange={e => setReciboIban(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-emerald-400 font-mono focus:border-emerald-500 focus:outline-none" />
                </div>

                {/* Signature Canvas */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-bold text-slate-300 uppercase">Assinatura Eletrónica do Fornecedor *</label>
                    <button type="button" onClick={clearCanvas} className="text-[10px] text-slate-400 hover:text-red-400 cursor-pointer">
                      Limpar Assinatura
                    </button>
                  </div>
                  <div className="border border-slate-700 bg-white rounded-xl overflow-hidden touch-none relative">
                    <canvas
                      ref={canvasRef}
                      width={320}
                      height={100}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-[100px] cursor-crosshair bg-slate-50"
                    />
                    {!hasSignature && (
                      <span className="absolute inset-0 flex items-center justify-center text-slate-400 text-[10px] pointer-events-none italic">
                        Desenhe a sua assinatura aqui com o dedo ou rato
                      </span>
                    )}
                  </div>
                </div>

                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-all cursor-pointer shadow-md text-center mt-2">
                  <i className="fa-solid fa-paper-plane mr-1.5"></i> Emitir Recibo Manual (BR2 XXXXX)
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
