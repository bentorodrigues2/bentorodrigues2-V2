import React, { useState } from "react";
import { Predio, Fracao } from "../types";
import { downloadFichaCondominoVaziaPDF } from "../utils";

interface ModalFichaCondominoEditavelProps {
  isOpen: boolean;
  onClose: () => void;
  predio: Predio;
  fracaoAtual?: Fracao | null;
  onSaveFracaoData?: (fracaoId: string, updatedData: any) => void;
}

export function ModalFichaCondominoEditavel({
  isOpen,
  onClose,
  predio,
  fracaoAtual,
  onSaveFracaoData
}: ModalFichaCondominoEditavelProps) {
  // Form fields state pre-populated with fracaoAtual or default empty template
  const [formData, setFormData] = useState({
    morada_edificio: predio?.morada_linha1 || "",
    piso: fracaoAtual?.piso || "",
    letra: fracaoAtual?.fracao_nome || "",
    permilagem: fracaoAtual ? String(fracaoAtual.permilagem) : "125",
    tipologia: fracaoAtual?.tipologia || "T2",
    
    // Proprietário
    prop_nome: fracaoAtual?.proprietario?.nome || "",
    prop_nif: fracaoAtual?.proprietario?.nif || "",
    prop_tlm: fracaoAtual?.proprietario?.tlm || "",
    prop_email: fracaoAtual?.proprietario?.email || "",
    prop_data_nascimento: fracaoAtual?.proprietario?.data_nascimento || "",
    prop_iban: fracaoAtual?.proprietario?.iban || "",
    prop_titular: fracaoAtual?.proprietario?.nome || "",
    prop_banco: (fracaoAtual?.proprietario as any)?.banco || fracaoAtual?.proprietario?.entidade_bancaria || "",
    prop_morada_alt: "",

    // Co-Proprietário
    coprop_nome: fracaoAtual?.proprietarios_adicionais?.[0]?.nome || "",
    coprop_nif: fracaoAtual?.proprietarios_adicionais?.[0]?.nif || "",
    coprop_email: fracaoAtual?.proprietarios_adicionais?.[0]?.email || "",
    coprop_tlm: fracaoAtual?.proprietarios_adicionais?.[0]?.tlm || "",
    coprop_data_nascimento: fracaoAtual?.proprietarios_adicionais?.[0]?.data_nascimento || "",

    // Arrendamento / Inquilino
    is_arrendada: fracaoAtual?.is_arrendada ? "SIM" : "NAO",
    inq_nome: fracaoAtual?.inquilino?.nome || "",
    inq_nif: fracaoAtual?.inquilino?.nif || "",
    inq_email: fracaoAtual?.inquilino?.email || "",
    inq_tlm: fracaoAtual?.inquilino?.tlm || "",
    inq_data_nascimento: fracaoAtual?.inquilino?.data_nascimento || "",

    // RGPD e Assinatura
    rgpd_consentimento: true,
    data_preenchimento: new Date().toLocaleDateString("pt-PT"),
    assinatura_nome: fracaoAtual?.proprietario?.nome || ""
  });

  React.useEffect(() => {
    if (fracaoAtual) {
      setFormData(prev => ({
        ...prev,
        piso: fracaoAtual.piso || "",
        letra: fracaoAtual.fracao_nome || "",
        permilagem: String(fracaoAtual.permilagem || 125),
        tipologia: fracaoAtual.tipologia || "T2",
        prop_nome: fracaoAtual.proprietario?.nome || "",
        prop_nif: fracaoAtual.proprietario?.nif || "",
        prop_tlm: fracaoAtual.proprietario?.tlm || "",
        prop_email: fracaoAtual.proprietario?.email || "",
        prop_data_nascimento: fracaoAtual.proprietario?.data_nascimento || "",
        prop_iban: fracaoAtual.proprietario?.iban || "",
        coprop_nome: fracaoAtual.proprietarios_adicionais?.[0]?.nome || "",
        coprop_nif: fracaoAtual.proprietarios_adicionais?.[0]?.nif || "",
        coprop_email: fracaoAtual.proprietarios_adicionais?.[0]?.email || "",
        coprop_tlm: fracaoAtual.proprietarios_adicionais?.[0]?.tlm || "",
        coprop_data_nascimento: fracaoAtual.proprietarios_adicionais?.[0]?.data_nascimento || "",
        is_arrendada: fracaoAtual.is_arrendada ? "SIM" : "NAO",
        inq_nome: fracaoAtual.inquilino?.nome || "",
        inq_nif: fracaoAtual.inquilino?.nif || "",
        inq_email: fracaoAtual.inquilino?.email || "",
        inq_tlm: fracaoAtual.inquilino?.tlm || "",
        inq_data_nascimento: fracaoAtual.inquilino?.data_nascimento || "",
        assinatura_nome: fracaoAtual.proprietario?.nome || ""
      }));
    }
  }, [fracaoAtual]);

  if (!isOpen) return null;

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDownloadPDF = () => {
    // Passes form data map to downloadFichaCondominoVaziaPDF so AcroForm interactive textfields & text are populated!
    downloadFichaCondominoVaziaPDF(predio?.nome || "Condomínio", predio?.morada_linha1 || "", formData);
  };

  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ficha de Registo de Condómino - ${predio.nome}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; color: #0f172a; }
            h2 { text-align: center; font-size: 14px; margin-bottom: 5px; color: #047857; text-transform: uppercase; }
            .header-bg { background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px; font-size: 10px; margin-bottom: 15px; }
            .section-title { font-weight: bold; color: #047857; font-size: 11px; margin-top: 15px; margin-bottom: 5px; border-bottom: 2px solid #047857; padding-bottom: 3px; }
            .grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
            .box { border: 1px solid #cbd5e1; padding: 6px; border-radius: 4px; background: #fff; flex: 1; min-width: 120px; }
            .box-title { font-size: 8px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 2px; }
            .box-val { font-size: 10px; font-weight: bold; color: #0f172a; min-height: 14px; }
            .footer-rgpd { font-size: 9px; color: #475569; border: 1px solid #cbd5e1; padding: 8px; margin-top: 15px; background: #f8fafc; }
            .sig-container { display: flex; justify-content: space-between; margin-top: 25px; }
            .sig-box { width: 45%; border: 1px solid #cbd5e1; padding: 10px; text-align: center; }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <h2>Ficha de Registo de Condómino / Proprietário</h2>
          <div class="header-bg">
            <strong>Edifício:</strong> ${predio.nome} &nbsp;|&nbsp; <strong>Morada:</strong> ${formData.morada_edificio} &nbsp;|&nbsp; <strong>Exercício:</strong> 2026
          </div>

          <div class="section-title">1. IDENTIFICAÇÃO DA FRAÇÃO AUTÓNOMA</div>
          <div class="grid">
            <div class="box"><div class="box-title">Morada do Edifício</div><div class="box-val">${formData.morada_edificio}</div></div>
            <div class="box"><div class="box-title">Piso</div><div class="box-val">${formData.piso}</div></div>
            <div class="box"><div class="box-title">Letra / Nome</div><div class="box-val">${formData.letra}</div></div>
            <div class="box"><div class="box-title">Permilagem</div><div class="box-val">${formData.permilagem}‰</div></div>
            <div class="box"><div class="box-title">Tipologia</div><div class="box-val">${formData.tipologia}</div></div>
          </div>

          <div class="section-title">2. DADOS DO PROPRIETÁRIO PRINCIPAL</div>
          <div class="grid">
            <div class="box" style="flex: 2;"><div class="box-title">Nome Completo</div><div class="box-val">${formData.prop_nome}</div></div>
            <div class="box"><div class="box-title">NIF Fiscal</div><div class="box-val">${formData.prop_nif}</div></div>
            <div class="box"><div class="box-title">Telemóvel</div><div class="box-val">${formData.prop_tlm}</div></div>
          </div>
          <div class="grid">
            <div class="box"><div class="box-title">E-mail Oficial</div><div class="box-val">${formData.prop_email}</div></div>
            <div class="box" style="flex: 2;"><div class="box-title">IBAN de Origem</div><div class="box-val">${formData.prop_iban}</div></div>
          </div>

          <div class="section-title">3. COPROPRIETÁRIOS ADICIONAIS</div>
          <div class="grid">
            <div class="box" style="flex: 2;"><div class="box-title">Nome Completo</div><div class="box-val">${formData.coprop_nome || "—"}</div></div>
            <div class="box"><div class="box-title">NIF</div><div class="box-val">${formData.coprop_nif || "—"}</div></div>
            <div class="box"><div class="box-title">E-mail</div><div class="box-val">${formData.coprop_email || "—"}</div></div>
            <div class="box"><div class="box-title">Telemóvel</div><div class="box-val">${formData.coprop_tlm || "—"}</div></div>
          </div>

          <div class="section-title">4. DADOS DE ARRENDAMENTO E INQUILINO</div>
          <div class="grid">
            <div class="box"><div class="box-title">Fração Arrendada?</div><div class="box-val">${formData.is_arrendada}</div></div>
            <div class="box" style="flex: 2;"><div class="box-title">Nome do Inquilino</div><div class="box-val">${formData.inq_nome || "—"}</div></div>
            <div class="box"><div class="box-title">NIF Inquilino</div><div class="box-val">${formData.inq_nif || "—"}</div></div>
          </div>
          <div class="grid">
            <div class="box"><div class="box-title">E-mail Inquilino</div><div class="box-val">${formData.inq_email || "—"}</div></div>
            <div class="box"><div class="box-title">Telemóvel Inquilino</div><div class="box-val">${formData.inq_tlm || "—"}</div></div>
          </div>

          <div class="footer-rgpd">
            <strong>DECLARAÇÃO E CONSENTIMENTO RGPD (UE 2016/679):</strong><br>
            [X] Declaro sob compromisso de honra que as informações prestadas são verdadeiras e autorizo o tratamento dos dados pessoais para gestão do condomínio.
          </div>

          <div class="sig-container">
            <div class="sig-box">
              <div class="box-title">Data de Preenchimento</div>
              <div class="box-val" style="margin-top: 15px;">${formData.data_preenchimento}</div>
            </div>
            <div class="sig-box">
              <div class="box-title">Assinatura do Proprietário / Condómino</div>
              <div class="box-val" style="margin-top: 15px;">${formData.assinatura_nome}</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 300);
  };

  const handleSaveToFracao = () => {
    if (fracaoAtual && onSaveFracaoData) {
      onSaveFracaoData(fracaoAtual.id_fracao, {
        piso: formData.piso,
        fracao_nome: formData.letra,
        permilagem: parseFloat(formData.permilagem) || 125,
        tipologia: formData.tipologia,
        is_arrendada: formData.is_arrendada === "SIM",
        proprietario: {
          nome: formData.prop_nome,
          nif: formData.prop_nif,
          email: formData.prop_email,
          tlm: formData.prop_tlm,
          data_nascimento: formData.prop_data_nascimento || undefined,
          iban: formData.prop_iban
        },
        proprietarios_adicionais: formData.coprop_nome ? [{
          nome: formData.coprop_nome,
          nif: formData.coprop_nif,
          email: formData.coprop_email,
          tlm: formData.coprop_tlm,
          data_nascimento: formData.coprop_data_nascimento || undefined,
          foto: null
        }] : fracaoAtual?.proprietarios_adicionais || [],
        inquilino: formData.is_arrendada === "SIM" ? {
          nome: formData.inq_nome,
          nif: formData.inq_nif,
          email: formData.inq_email,
          tlm: formData.inq_tlm,
          data_nascimento: formData.inq_data_nascimento || undefined
        } : null
      });
      alert("✅ Ficha atualizada e gravada com sucesso na fração!");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full my-auto flex flex-col max-h-[92vh] animate-fadeIn">
        
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-lg">
              <i className="fa-solid fa-file-signature"></i>
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                Ficha de Registo do Condómino / Proprietário (Editável Interativa)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Preencha ou edite os dados em tempo real. O PDF gerado conterá **campos interativos (AcroForm)** totalmente preenchíveis no leitor de PDF!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          
          {/* Banner Info */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-3 text-emerald-900 dark:text-emerald-200">
            <i className="fa-solid fa-pen-to-square text-emerald-600 dark:text-emerald-400 text-lg"></i>
            <div>
              <p className="font-bold text-[11.5px]">Edição Dinâmica & PDF Preenchível Ativo</p>
              <p className="text-[10.5px] opacity-90">
                Pode alterar qualquer campo abaixo antes de descarregar ou imprimir. Ao descarregar em PDF, os campos mantêm-se interativos e editáveis diretamente no Adobe Acrobat ou Browser.
              </p>
            </div>
          </div>

          {/* 1. Fração */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
              <i className="fa-solid fa-building text-xs"></i>
              <span>1. Identificação da Fração Autónoma</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Morada do Edifício</label>
                <input
                  type="text"
                  value={formData.morada_edificio}
                  onChange={e => handleChange("morada_edificio", e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Piso</label>
                <input
                  type="text"
                  value={formData.piso}
                  onChange={e => handleChange("piso", e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Letra / Nome</label>
                <input
                  type="text"
                  value={formData.letra}
                  onChange={e => handleChange("letra", e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Permilagem (‰)</label>
                <input
                  type="text"
                  value={formData.permilagem}
                  onChange={e => handleChange("permilagem", e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* 2. Proprietário Principal */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
              <i className="fa-solid fa-user-tie text-xs"></i>
              <span>2. Dados do Proprietário Principal</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome Completo *</label>
                <input
                  type="text"
                  value={formData.prop_nome}
                  onChange={e => handleChange("prop_nome", e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">NIF Fiscal *</label>
                <input
                  type="text"
                  value={formData.prop_nif}
                  onChange={e => handleChange("prop_nif", e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Telemóvel *</label>
                <input
                  type="text"
                  value={formData.prop_tlm}
                  onChange={e => handleChange("prop_tlm", e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">E-mail Oficial *</label>
                <input
                  type="email"
                  value={formData.prop_email}
                  onChange={e => handleChange("prop_email", e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data de Nascimento (Aniversário)</label>
                <input
                  type="date"
                  value={formData.prop_data_nascimento}
                  onChange={e => handleChange("prop_data_nascimento", e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">IBAN de Origem Pagamentos</label>
                <input
                  type="text"
                  value={formData.prop_iban}
                  onChange={e => handleChange("prop_iban", e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* 3. Co-Proprietários */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
              <i className="fa-solid fa-users text-xs"></i>
              <span>3. Co-Proprietários Adicionais (Se aplicável)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome do Co-Proprietário</label>
                <input
                  type="text"
                  value={formData.coprop_nome}
                  onChange={e => handleChange("coprop_nome", e.target.value)}
                  placeholder="Ex: Maria Guerra"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">NIF</label>
                <input
                  type="text"
                  value={formData.coprop_nif}
                  onChange={e => handleChange("coprop_nif", e.target.value)}
                  placeholder="234567890"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">E-mail</label>
                <input
                  type="email"
                  value={formData.coprop_email}
                  onChange={e => handleChange("coprop_email", e.target.value)}
                  placeholder="coprop@email.pt"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Telemóvel</label>
                <input
                  type="text"
                  value={formData.coprop_tlm}
                  onChange={e => handleChange("coprop_tlm", e.target.value)}
                  placeholder="919888777"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data de Nascimento</label>
                <input
                  type="date"
                  value={formData.coprop_data_nascimento}
                  onChange={e => handleChange("coprop_data_nascimento", e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* 4. Arrendamento & Inquilino */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
              <i className="fa-solid fa-house-user text-xs"></i>
              <span>4. Situação de Arrendamento & Inquilino</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fração Arrendada?</label>
                <select
                  value={formData.is_arrendada}
                  onChange={e => handleChange("is_arrendada", e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 dark:text-white"
                >
                  <option value="NAO">NÃO — Habitação Própria</option>
                  <option value="SIM">SIM — Arrendada a Inquilino</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome Completo do Inquilino / Arrendatário</label>
                <input
                  type="text"
                  value={formData.inq_nome}
                  onChange={e => handleChange("inq_nome", e.target.value)}
                  placeholder="Caso esteja arrendada..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 dark:text-white"
                />
              </div>
            </div>

            {formData.is_arrendada === "SIM" && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">NIF do Inquilino</label>
                  <input
                    type="text"
                    value={formData.inq_nif}
                    onChange={e => handleChange("inq_nif", e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">E-mail do Inquilino</label>
                  <input
                    type="email"
                    value={formData.inq_email}
                    onChange={e => handleChange("inq_email", e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Telemóvel do Inquilino</label>
                  <input
                    type="text"
                    value={formData.inq_tlm}
                    onChange={e => handleChange("inq_tlm", e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data de Nascimento</label>
                  <input
                    type="date"
                    value={formData.inq_data_nascimento}
                    onChange={e => handleChange("inq_data_nascimento", e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 5. Data & Signatures */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data de Preenchimento</label>
              <input
                type="text"
                value={formData.data_preenchimento}
                onChange={e => handleChange("data_preenchimento", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome para Assinatura do Declarante</label>
              <input
                type="text"
                value={formData.assinatura_nome}
                onChange={e => handleChange("assinatura_nome", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 dark:text-white"
              />
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 rounded-b-2xl flex flex-wrap items-center justify-between gap-3">
          {fracaoAtual && onSaveFracaoData ? (
            <button
              type="button"
              onClick={handleSaveToFracao}
              className="border-2 border-emerald-500 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 shadow-md active:ring-2 active:ring-emerald-400 select-none"
              title={`Gravar dados na fração ${fracaoAtual.fracao_nome}`}
            >
              <img src="/estados-acoes/12-adicionar.png" alt="Gravar" className="h-4 w-4 object-contain" />
              <span>Gravar</span>
            </button>
          ) : (
            <div className="text-[11px] text-slate-400 italic">
              * Edição livre para impressão / exportação de ficha de cadastro.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <i className="fa-solid fa-print"></i>
              <span>Imprimir Ficha</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 shadow-sm"
            >
              <img src="/marca/18-pdf.png" alt="PDF" className="h-4 w-4 object-contain" />
              <span>Descarregar PDF Preenchível / Editável</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
