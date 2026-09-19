import React, { useState } from "react";
import { Predio, Fracao, Aviso, LoggedUser, Patrimonio } from "../types";
import { parseValorMonetario } from "../utils";

interface AssistenteImportacaoProps {
  onImportComplete: (predioData: Predio, fracoesData: Fracao[], avisosData: Aviso[]) => void;
  loggedUser: LoggedUser;
}

// Sample mock presets to make testing fast and delightful
const MOCK_PRESETS = [
  {
    name: "Edifício Miramar (Com Lacunas)",
    description: "Cópia de ata e folha de saldos da gestora anterior 'LiderCondo'. Contém lacunas de NIF e emails em algumas frações.",
    text: `RELATÓRIO DE TRANSIÇÃO - CONDOMÍNIO MIRAMAR
NIF do Prédio: 998234123
Morada: Avenida de Nice, Nº 42, 4400-123 Vila Nova de Gaia

Caraterísticas: Edifício com 2 elevadores, garagem subterrânea e jardins privativos.

Lista de Frações, Proprietários e Saldos em atraso (Julho 2026):

Fração A - R/C Esq
Permilagem: 120
Tipologia: T3
Proprietário: Maria Carmo Neto
Contacto: 912345678
NIF: 231456789
Email: mcarmo@miramar.pt
Saldo de Quotas: 0.00€ (Regularizado)

Fração B - R/C Dir
Permilagem: 120
Tipologia: T3
Proprietário: João Carlos Pereira
Contacto: 933111222
NIF: (Não fornecido pela antiga gestora)
Email: joao.pereira@gmail.com
Saldo de Quotas: -150.00€ (3 quotas em atraso)

Fração C - 1º Esq
Permilagem: 130
Tipologia: T4
Proprietário: Ana Sofia Lopes
Contacto: 966222333
NIF: 199222333
Email: (Falta registo de email)
Saldo de Quotas: -50.00€ (1 quota em atraso)

Fração D - 1º Dir
Permilagem: 130
Tipologia: T4
Proprietário: Pedro Miguel Santos
Contacto: (Contacto não registado)
NIF: 244555666
Email: pedro.santos@sapo.pt
Saldo de Quotas: 80.00€ (Crédito antecipado)

Fração E - Garagem G1
Permilagem: 50
Tipologia: Box
Proprietário: Maria Carmo Neto
Contacto: 912345678
NIF: 231456789
Email: mcarmo@miramar.pt
Saldo de Quotas: 0.00€`
  },
  {
    name: "Loteamento Quinta do Sol (Completo)",
    description: "Dados estruturados de condomínio horizontal. Sem lacunas de contactos.",
    text: `INFORMAÇÃO DE CADASTRO - QUINTA DO SOL
NIF do Edifício: 997123456
Morada: Rua dos Pinheiros, Lote 5, 2900-500 Setúbal
Loteamento residencial com piscina comum e churrasqueira comum, sem elevador.

Frações e Condóminos:

Fração L1 - Vivenda T4
Permilagem: 250
Proprietário: António Moreira de Sousa
NIF: 188777666
Email: antonio.sousa@solares.pt
Telemóvel: 911000111
Saldos: 0.00€

Fração L2 - Vivenda T4
Permilagem: 250
Proprietário: Cláudia Regina Cruz
NIF: 211222333
Email: claudia.cruz@outlook.com
Telemóvel: 922333444
Saldos: -200.00€ (Débito de conservação ordinária)

Fração L3 - Vivenda T5
Permilagem: 500
Proprietário: Rui Fernandes Jorge
NIF: 255444333
Email: rui.jorge@netcabo.pt
Telemóvel: 933444555
Saldos: 0.00€`
  }
];

export function AssistenteImportacao({ onImportComplete, loggedUser }: AssistenteImportacaoProps) {
  const [activeStep, setActiveStep] = useState<"upload" | "homologation" | "success">("upload");
  const [textContent, setTextContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // States for Homologation Data (editable by human)
  const [importedPredio, setImportedPredio] = useState<any>(null);
  const [importedFracoes, setImportedFracoes] = useState<any[]>([]);

  // States for missing fields report
  const [showReportModal, setShowReportModal] = useState(false);
  const [emailReport, setEmailReport] = useState<{ to: string; subject: string; body: string } | null>(null);
  const [enviandoRelatorioLacunas, setEnviandoRelatorioLacunas] = useState(false);

  // Drag and drop state
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      readAndSetFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      readAndSetFile(e.target.files[0]);
    }
  };

  const readAndSetFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setTextContent(event.target.result as string);
      }
    };
    reader.readAsText(file);
  };

  // Submit to Gemini extractor endpoint
  const processWithIA = async () => {
    if (!textContent.trim()) {
      setError("Por favor, cole o texto do documento ou carregue um ficheiro.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/parse-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textContent }),
      });

      if (!response.ok) {
        throw new Error("Falha ao comunicar com o servidor de IA. Verifique as credenciais.");
      }

      const data = await response.json();
      
      if (!data.predio || !data.fracoes) {
        throw new Error("A IA não conseguiu identificar os campos básicos necessários do prédio e frações.");
      }

      setImportedPredio(data.predio);
      setImportedFracoes(data.fracoes);
      setActiveStep("homologation");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocorreu um erro ao processar o ficheiro com Inteligência Artificial.");
    } finally {
      setIsLoading(false);
    }
  };

  // Check for gaps (NIF, contact, email)
  const getGaps = () => {
    const gaps: Array<{ fracao: string; proprietario: string; missing: string[] }> = [];
    importedFracoes.forEach((f) => {
      const missing: string[] = [];
      if (!f.proprietario.nif || f.proprietario.nif.includes("Não") || f.proprietario.nif.trim() === "") {
        missing.push("NIF");
      }
      if (!f.proprietario.email || f.proprietario.email.includes("Falta") || f.proprietario.email.trim() === "" || !f.proprietario.email.includes("@")) {
        missing.push("Email");
      }
      if (!f.proprietario.tlm || f.proprietario.tlm.includes("não") || f.proprietario.tlm.trim() === "") {
        missing.push("Telemóvel");
      }

      if (missing.length > 0) {
        gaps.push({
          fracao: f.fracao_nome,
          proprietario: f.proprietario.nome,
          missing,
        });
      }
    });
    return gaps;
  };

  // Generate Email Report for Admin
  const handleGenerateEmailReport = () => {
    const gaps = getGaps();
    if (gaps.length === 0) return;

    const buildingName = importedPredio?.nome || "Prédio Sem Nome";
    const subject = `[Relatório de Lacunas] Importação de Dados - ${buildingName}`;
    
    let body = `Estimado(a) Administrador(a) ${loggedUser.nome},\n\n`;
    body += `Durante a importação global por Inteligência Artificial do condomínio "${buildingName}" (NIF: ${importedPredio?.nif || "N/A"}), foram identificadas algumas lacunas de dados cadastrais essenciais de condóminos que requerem a sua atenção.\n\n`;
    body += `Para garantir a correta cobrança jurídica, notificações legais e acesso à PWA, solicitamos que contacte os seguintes proprietários para suprir estas falhas:\n\n`;
    
    gaps.forEach((gap) => {
      body += `• Fração ${gap.fracao} (${gap.proprietario}):\n`;
      body += `  Campos em falta: ${gap.missing.join(", ")}\n\n`;
    });

    body += `Este relatório foi gerado automaticamente pelo Assistente de Importação Global por IA.\n\n`;
    body += `Melhores cumprimentos,\n`;
    body += `Sistema de Automação CondoManager AI\n`;
    body += `Data: ${new Date().toLocaleDateString("pt-PT")}`;

    setEmailReport({
      to: loggedUser.email,
      subject,
      body,
    });
    setShowReportModal(true);
  };

  // Envio real do relatório de lacunas por email — antes o botão
  // ("Simular Envio por Email") só mostrava um alert "enviado com sucesso"
  // sem chamar nenhuma API, apesar do destinatário e do conteúdo já serem
  // reais (o próprio email do administrador autenticado).
  const handleEnviarRelatorioLacunas = async () => {
    if (!emailReport) return;
    setEnviandoRelatorioLacunas(true);
    try {
      const resp = await fetch("/api/email?acao=notificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailReport.to,
          nomeDestinatario: loggedUser.nome,
          assunto: emailReport.subject,
          mensagem: emailReport.body.replace(/\n/g, "<br>")
        })
      });
      const resultado = await resp.json();
      if (!resp.ok || !resultado.ok) {
        throw new Error(resultado?.error || "Falha ao enviar o email.");
      }
      alert(`✅ Relatório enviado com sucesso para ${emailReport.to}!`);
      setShowReportModal(false);
    } catch (err) {
      console.error("Erro ao enviar relatório de lacunas:", err);
      alert(`❌ Não foi possível enviar o relatório: ${err instanceof Error ? err.message : "erro desconhecido"}.`);
    } finally {
      setEnviandoRelatorioLacunas(false);
    }
  };

  // Commit and save everything to parent state
  const handleConfirmAndSave = () => {
    if (!importedPredio || importedFracoes.length === 0) return;

    // Map imported Predio into real Predio object
    const finalPredio: Predio = {
      id_predio: `predio-${Date.now()}`,
      nome: importedPredio.nome || "Novo Prédio Importado",
      morada_linha1: importedPredio.morada_linha1 || "Rua Principal",
      morada_linha2: null,
      num_porta: importedPredio.num_porta || "1",
      letra_porta: null,
      codigo_postal: importedPredio.codigo_postal || "1000-000",
      localidade: importedPredio.localidade || "Lisboa",
      nif: importedPredio.nif || "999999999",
      patrimonio: {
        tem_elevador: importedPredio.patrimonio?.tem_elevador ?? false,
        num_elevadores: importedPredio.patrimonio?.num_elevadores ?? 0,
        tem_garagem: importedPredio.patrimonio?.tem_garagem ?? false,
        tem_piscina: importedPredio.patrimonio?.tem_piscina ?? false,
        tem_sala_comum: false,
        tem_arrecadacoes_comuns: false,
        tem_jardins: importedPredio.patrimonio?.tem_jardins ?? false,
        tem_churrasqueira: importedPredio.patrimonio?.tem_piscina ?? false,
        tem_terraco: false,
        tem_ginasio: false,
        tem_spa: false,
      }
    };

    // Map imported Fracoes into real Fracao objects
    const finalFracoes: Fracao[] = importedFracoes.map((f, index) => {
      return {
        id_fracao: `fracao-imp-${Date.now()}-${index}`,
        id_predio: finalPredio.id_predio,
        fracao_nome: f.fracao_nome,
        piso: f.piso || "R/C",
        permilagem: f.permilagem || 50,
        tipologia: f.tipologia || "T2",
        tipo_access: "Código",
        tem_garagem_spot: finalPredio.patrimonio.tem_garagem,
        tem_arrecadacao_box: false,
        is_arrendada: false,
        administrador_interno: index === 0 ? "Sim" : "Não", // assign first to test
        notificacao_preferencial: "E-mail",
        proprietario: {
          nome: f.proprietario.nome || "Proprietário Desconhecido",
          nif: f.proprietario.nif || "",
          email: f.proprietario.email || "",
          tlm: f.proprietario.tlm || "",
          iban: "",
        },
        inquilino: null,
      };
    });

    // Create starting Avisos (debts/credits) for negative initial balances
    const finalAvisos: Aviso[] = [];
    importedFracoes.forEach((f, index) => {
      if (f.saldo_inicial && f.saldo_inicial < 0) {
        const correspondingFracao = finalFracoes[index];
        finalAvisos.push({
          id_aviso: `aviso-imp-${Date.now()}-${index}`,
          id_predio: finalPredio.id_predio,
          id_fracao: correspondingFracao.id_fracao,
          tipo: "Quota",
          data: new Date().toISOString().split("T")[0],
          vencimento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 15 days out
          descricao: "Saldo Devedor de Transição (Quota da anterior gestora)",
          valor: Math.abs(f.saldo_inicial),
          estado: "Pendente",
        });
      }
    });

    // Save
    onImportComplete(finalPredio, finalFracoes, finalAvisos);
    setActiveStep("success");
  };

  const gaps = getGaps();

  return (
    <div className="space-y-6">
      
      {/* HEADER PROGRESS STEPPER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center justify-between no-print">
        <div className="flex items-center space-x-3">
          <img src="/marca/20-Logotipo Horizontal com fundo.png" alt="CondoManager AI" className="h-7 object-contain mr-1" />
          <div className="p-2 bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 rounded-lg">
            <i className="fa-solid fa-file-import text-lg"></i>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Migração & Importador Global por IA</h3>
            <p className="text-xs text-slate-400">Importação autónoma de prédios e condóminos de outras empresas gestoras.</p>
          </div>
        </div>

        {/* Stepper Steps UI */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${activeStep === "upload" ? "bg-violet-600 text-white" : "bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400"}`}>1</span>
            <span className="text-xs font-semibold text-slate-500">Extração</span>
          </div>
          <i className="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
          <div className="flex items-center space-x-2">
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${activeStep === "homologation" ? "bg-violet-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>2</span>
            <span className="text-xs font-semibold text-slate-500">Homologação</span>
          </div>
          <i className="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
          <div className="flex items-center space-x-2">
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${activeStep === "success" ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>3</span>
            <span className="text-xs font-semibold text-slate-500">Pronto</span>
          </div>
        </div>
      </div>

      {/* ERROR DISPLAY */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 p-4 rounded-xl flex items-start space-x-3">
          <i className="fa-solid fa-circle-exclamation text-lg mt-0.5 shrink-0"></i>
          <div className="text-sm">
            <span className="font-bold">Ocorreu um problema:</span> {error}
          </div>
        </div>
      )}

      {/* STEP 1: UPLOAD & PASTE */}
      {activeStep === "upload" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Input Text Box */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Cole os dados do Condomínio (Ata, Tabelas, PDF Copiado)</h4>
                <p className="text-xs text-slate-400">A Inteligência Artificial irá ler toda a estrutura do edifício, frações, nomes, NIFs, e-mails e quotas em atraso automaticamente.</p>
              </div>

              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Exemplo de colar:
Condomínio Edifício Miramar, Rua de Gaia 123...
Fração A - Maria Carmo Neto - NIF 231456789 - Quota em atraso: 120€..."
                className="w-full h-80 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4 text-xs font-mono-custom focus:outline-none focus:border-violet-500 text-slate-700 dark:text-slate-200"
              />

              {/* Drag and Drop Zone */}
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-all cursor-pointer ${dragActive ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/20" : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}
              >
                <input 
                  type="file" 
                  id="file-upload" 
                  className="hidden" 
                  accept=".txt,.csv,.json,.pdf,.xlsx"
                  onChange={handleFileChange} 
                />
                <label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer text-center">
                  <i className="fa-solid fa-cloud-arrow-up text-2xl text-violet-400 dark:text-violet-500 mb-2"></i>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Arraste um ficheiro ou clique para carregar</span>
                  <span className="text-[10px] text-slate-400 mt-1">Formatos suportados: TXT, PDF extraído, CSV, XLS</span>
                </label>
              </div>

              {/* Action Trigger */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={processWithIA}
                  disabled={isLoading || !textContent.trim()}
                  className={`px-5 py-2.5 rounded-lg text-sm font-bold text-white flex items-center space-x-2 transition-all ${isLoading || !textContent.trim() ? "bg-slate-300 dark:bg-slate-800 cursor-not-allowed" : "bg-violet-600 hover:bg-violet-700 hover:shadow-lg cursor-pointer"}`}
                >
                  {isLoading ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin"></i>
                      <span>A extrair dados com IA...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                      <span>Extrair Dados com Gemini AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Presets Sidebar */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center">
                  <i className="fa-solid fa-circle-play text-violet-500 mr-2"></i>
                  Demonstrações Rápidas
                </h4>
                <p className="text-xs text-slate-400 mt-1">Clique para pré-carregar um exemplo realista e ver a inteligência artificial em ação instantânea.</p>
              </div>

              <div className="space-y-3">
                {MOCK_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setTextContent(preset.text)}
                    className="w-full text-left p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-800 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-violet-50/10 dark:hover:bg-violet-950/20 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-violet-600 dark:group-hover:text-violet-400">{preset.name}</span>
                      <i className="fa-solid fa-arrow-right text-[10px] text-slate-300 group-hover:translate-x-1 transition-transform"></i>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{preset.description}</p>
                  </button>
                ))}
              </div>

              <div className="bg-violet-50/40 dark:bg-violet-950/10 p-3.5 rounded-lg border border-violet-100/50 dark:border-violet-900/20 text-[11px] text-slate-500 leading-relaxed space-y-2">
                <span className="font-bold text-violet-700 dark:text-violet-400">Como funciona?</span>
                <p>1. O motor extrai a estrutura física e as divisões do edifício.</p>
                <p>2. Associa cada condómino ao seu lote ou fração.</p>
                <p>3. Regista saldos iniciais de débito ou crédito.</p>
                <p>4. Alerta para dados em falta de forma automática.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: HOMOLOGATION EDITOR */}
      {activeStep === "homologation" && importedPredio && (
        <div className="space-y-6">
          
          {/* Summary Warning Box */}
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/40 p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 rounded-lg shrink-0">
                <i className="fa-solid fa-triangle-exclamation text-lg"></i>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Ecrã de Homologação de Dados (Confirmação Humana)</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reveja e ajuste as informações extraídas pela IA antes de guardar na base de dados.
                  {gaps.length > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400 font-bold block mt-1">
                      <i className="fa-solid fa-circle-exclamation mr-1"></i>
                      Foram detetadas {gaps.length} frações com lacunas cadastrais (NIF, e-mail ou contacto).
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold block mt-1">
                      <i className="fa-solid fa-circle-check mr-1"></i>
                      Dados completos! Nenhuma lacuna importante detetada.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {gaps.length > 0 && (
              <button
                onClick={handleGenerateEmailReport}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center space-x-1.5 shadow transition-all cursor-pointer self-start md:self-center shrink-0"
              >
                <i className="fa-solid fa-envelope-open-text"></i>
                <span>Gerar Relatório de Lacunas por Email</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Building Registry Form */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center">
                <i className="fa-solid fa-building text-violet-500 mr-2"></i>
                1. Cadastro Geral do Prédio
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Nome do Prédio</label>
                  <input
                    type="text"
                    value={importedPredio.nome || ""}
                    onChange={(e) => setImportedPredio({ ...importedPredio, nome: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 focus:outline-none focus:border-violet-500 text-slate-700 dark:text-slate-200 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-bold mb-1">Morada Principal</label>
                  <input
                    type="text"
                    value={importedPredio.morada_linha1 || ""}
                    onChange={(e) => setImportedPredio({ ...importedPredio, morada_linha1: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 focus:outline-none focus:border-violet-500 text-slate-700 dark:text-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Nº Porta/Lote</label>
                    <input
                      type="text"
                      value={importedPredio.num_porta || ""}
                      onChange={(e) => setImportedPredio({ ...importedPredio, num_porta: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 focus:outline-none focus:border-violet-500 text-slate-700 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">NIF do Prédio</label>
                    <input
                      type="text"
                      value={importedPredio.nif || ""}
                      onChange={(e) => setImportedPredio({ ...importedPredio, nif: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 focus:outline-none focus:border-violet-500 text-slate-700 dark:text-slate-200 font-mono-custom"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Código Postal</label>
                    <input
                      type="text"
                      value={importedPredio.codigo_postal || ""}
                      onChange={(e) => setImportedPredio({ ...importedPredio, codigo_postal: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 focus:outline-none focus:border-violet-500 text-slate-700 dark:text-slate-200 font-mono-custom"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Localidade</label>
                    <input
                      type="text"
                      value={importedPredio.localidade || ""}
                      onChange={(e) => setImportedPredio({ ...importedPredio, localidade: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 focus:outline-none focus:border-violet-500 text-slate-700 dark:text-slate-200"
                    />
                  </div>
                </div>

                {/* Património */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <label className="block text-slate-500 font-bold mb-1">Caraterísticas extraídas</label>
                  
                  <div className="flex items-center justify-between py-1 bg-slate-50 dark:bg-slate-950 px-2.5 rounded">
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold flex items-center">
                      <i className="fa-solid fa-elevator mr-1.5 text-slate-400"></i> Elevador
                    </span>
                    <input
                      type="checkbox"
                      checked={importedPredio.patrimonio?.tem_elevador || false}
                      onChange={(e) => setImportedPredio({
                        ...importedPredio,
                        patrimonio: { ...importedPredio.patrimonio, tem_elevador: e.target.checked }
                      })}
                      className="rounded text-violet-600 focus:ring-violet-500"
                    />
                  </div>

                  {importedPredio.patrimonio?.tem_elevador && (
                    <div className="pl-4">
                      <label className="block text-[10px] text-slate-400 mb-0.5">Nº de Elevadores</label>
                      <input
                        type="number"
                        value={importedPredio.patrimonio?.num_elevadores || 1}
                        onChange={(e) => setImportedPredio({
                          ...importedPredio,
                          patrimonio: { ...importedPredio.patrimonio, num_elevadores: parseInt(e.target.value) }
                        })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-1 text-[11px]"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between py-1 bg-slate-50 dark:bg-slate-950 px-2.5 rounded">
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold flex items-center">
                      <i className="fa-solid fa-car mr-1.5 text-slate-400"></i> Garagem / Estacionamento
                    </span>
                    <input
                      type="checkbox"
                      checked={importedPredio.patrimonio?.tem_garagem || false}
                      onChange={(e) => setImportedPredio({
                        ...importedPredio,
                        patrimonio: { ...importedPredio.patrimonio, tem_garagem: e.target.checked }
                      })}
                      className="rounded text-violet-600 focus:ring-violet-500"
                    />
                  </div>

                  <div className="flex items-center justify-between py-1 bg-slate-50 dark:bg-slate-950 px-2.5 rounded">
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold flex items-center">
                      <i className="fa-solid fa-tree mr-1.5 text-slate-400"></i> Jardins e Lazer
                    </span>
                    <input
                      type="checkbox"
                      checked={importedPredio.patrimonio?.tem_jardins || false}
                      onChange={(e) => setImportedPredio({
                        ...importedPredio,
                        patrimonio: { ...importedPredio.patrimonio, tem_jardins: e.target.checked }
                      })}
                      className="rounded text-violet-600 focus:ring-violet-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Fractions and Owners Grid */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                  <span className="flex items-center">
                    <i className="fa-solid fa-door-open text-violet-500 mr-2"></i>
                    2. Frações, Proprietários & Saldos ({importedFracoes.length})
                  </span>
                  <span className="text-xs text-slate-400 font-normal">Edite livremente abaixo</span>
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800">
                        <th className="p-2 w-16">Fração</th>
                        <th className="p-2 w-20">Piso / Tip.</th>
                        <th className="p-2 w-16">Perm.</th>
                        <th className="p-2">Proprietário (Condómino)</th>
                        <th className="p-2 w-36">Contactos / NIF</th>
                        <th className="p-2 w-24 text-right">Saldo Inicial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {importedFracoes.map((frac, idx) => {
                        const hasNifMissing = !frac.proprietario.nif || frac.proprietario.nif.includes("Não") || frac.proprietario.nif.trim() === "";
                        const hasEmailMissing = !frac.proprietario.email || frac.proprietario.email.includes("Falta") || frac.proprietario.email.trim() === "" || !frac.proprietario.email.includes("@");
                        const hasTlmMissing = !frac.proprietario.tlm || frac.proprietario.tlm.includes("não") || frac.proprietario.tlm.trim() === "";

                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 align-top">
                            <td className="p-2 font-bold text-slate-800 dark:text-slate-100">
                              <input
                                type="text"
                                value={frac.fracao_nome || ""}
                                onChange={(e) => {
                                  const updated = [...importedFracoes];
                                  updated[idx].fracao_nome = e.target.value;
                                  setImportedFracoes(updated);
                                }}
                                className="w-full bg-transparent border-b border-transparent focus:border-violet-500 focus:outline-none p-0.5 font-bold text-slate-800 dark:text-slate-100"
                              />
                            </td>

                            <td className="p-2 space-y-1">
                              <input
                                type="text"
                                value={frac.piso || ""}
                                placeholder="Piso"
                                onChange={(e) => {
                                  const updated = [...importedFracoes];
                                  updated[idx].piso = e.target.value;
                                  setImportedFracoes(updated);
                                }}
                                className="w-full bg-transparent border-b border-transparent focus:border-violet-500 focus:outline-none p-0.5 text-slate-600 dark:text-slate-300 text-[11px]"
                              />
                              <input
                                type="text"
                                value={frac.tipologia || ""}
                                placeholder="Tipologia"
                                onChange={(e) => {
                                  const updated = [...importedFracoes];
                                  updated[idx].tipologia = e.target.value;
                                  setImportedFracoes(updated);
                                }}
                                className="w-full bg-transparent border-b border-transparent focus:border-violet-500 focus:outline-none p-0.5 text-slate-400 text-[10px]"
                              />
                            </td>

                            <td className="p-2">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={frac.permilagem || 0}
                                onChange={(e) => {
                                  const updated = [...importedFracoes];
                                  updated[idx].permilagem = parseValorMonetario(e.target.value);
                                  setImportedFracoes(updated);
                                }}
                                className="w-full bg-transparent border-b border-transparent focus:border-violet-500 focus:outline-none p-0.5 text-slate-600 dark:text-slate-300"
                              />
                            </td>

                            <td className="p-2">
                              <input
                                type="text"
                                value={frac.proprietario.nome || ""}
                                onChange={(e) => {
                                  const updated = [...importedFracoes];
                                  updated[idx].proprietario.nome = e.target.value;
                                  setImportedFracoes(updated);
                                }}
                                className="w-full bg-transparent border-b border-transparent focus:border-violet-500 focus:outline-none p-0.5 font-semibold text-slate-700 dark:text-slate-200"
                              />
                              
                              {/* Display specific warnings in small */}
                              <div className="mt-1 space-y-0.5">
                                {hasNifMissing && (
                                  <span className="inline-block text-[9px] bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 px-1 py-0.5 rounded font-bold">
                                    <i className="fa-solid fa-circle-exclamation mr-0.5"></i> Falta NIF
                                  </span>
                                )}
                                {hasEmailMissing && (
                                  <span className="inline-block ml-1 text-[9px] bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 px-1 py-0.5 rounded font-bold">
                                    <i className="fa-solid fa-envelope mr-0.5"></i> Falta Email
                                  </span>
                                )}
                                {hasTlmMissing && (
                                  <span className="inline-block ml-1 text-[9px] bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 px-1 py-0.5 rounded font-bold">
                                    <i className="fa-solid fa-phone mr-0.5"></i> Falta Tlm
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-2 space-y-1">
                              <input
                                type="text"
                                value={frac.proprietario.nif || ""}
                                placeholder="NIF"
                                onChange={(e) => {
                                  const updated = [...importedFracoes];
                                  updated[idx].proprietario.nif = e.target.value;
                                  setImportedFracoes(updated);
                                }}
                                className={`w-full bg-transparent border-b border-transparent focus:border-violet-500 focus:outline-none p-0.5 text-[11px] ${hasNifMissing ? "bg-amber-50/50 dark:bg-amber-950/20 text-amber-600" : "text-slate-600 dark:text-slate-300 font-mono-custom"}`}
                              />
                              <input
                                type="text"
                                value={frac.proprietario.email || ""}
                                placeholder="Email"
                                onChange={(e) => {
                                  const updated = [...importedFracoes];
                                  updated[idx].proprietario.email = e.target.value;
                                  setImportedFracoes(updated);
                                }}
                                className={`w-full bg-transparent border-b border-transparent focus:border-violet-500 focus:outline-none p-0.5 text-[11px] ${hasEmailMissing ? "bg-amber-50/50 dark:bg-amber-950/20 text-amber-600" : "text-slate-600 dark:text-slate-300"}`}
                              />
                              <input
                                type="text"
                                value={frac.proprietario.tlm || ""}
                                placeholder="Contacto"
                                onChange={(e) => {
                                  const updated = [...importedFracoes];
                                  updated[idx].proprietario.tlm = e.target.value;
                                  setImportedFracoes(updated);
                                }}
                                className={`w-full bg-transparent border-b border-transparent focus:border-violet-500 focus:outline-none p-0.5 text-[11px] ${hasTlmMissing ? "bg-amber-50/50 dark:bg-amber-950/20 text-amber-600" : "text-slate-600 dark:text-slate-300"}`}
                              />
                            </td>

                            <td className="p-2 text-right">
                              <div className="flex items-center justify-end">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={frac.saldo_inicial || 0}
                                  onChange={(e) => {
                                    const updated = [...importedFracoes];
                                    updated[idx].saldo_inicial = parseValorMonetario(e.target.value);
                                    setImportedFracoes(updated);
                                  }}
                                  className={`w-20 bg-transparent border-b border-transparent text-right focus:border-violet-500 focus:outline-none p-0.5 font-bold ${frac.saldo_inicial < 0 ? "text-rose-600" : frac.saldo_inicial > 0 ? "text-emerald-600" : "text-slate-500"}`}
                                />
                                <span className="text-[11px] font-bold text-slate-400 ml-0.5">€</span>
                              </div>
                              <span className="text-[9px] text-slate-400 block mt-0.5">
                                {frac.saldo_inicial < 0 ? "Dívida inicial" : frac.saldo_inicial > 0 ? "Saldo Credor" : "Sem saldo"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setActiveStep("upload")}
                    className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-4 py-2 rounded-lg text-xs cursor-pointer transition-all"
                  >
                    <i className="fa-solid fa-arrow-left mr-1"></i> Voltar para Extração
                  </button>

                  <button
                    onClick={handleConfirmAndSave}
                    className="border-2 border-emerald-500 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md hover:shadow-lg cursor-pointer transition-all active:ring-2 active:ring-emerald-400 select-none"
                  >
                    <img src="/estados-acoes/12-adicionar.png" alt="Gravar" className="h-4 w-4 object-contain" />
                    <span>Gravar</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* STEP 3: SUCCESS CONFIRMATION */}
      {activeStep === "success" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-xl shadow-sm text-center max-w-xl mx-auto space-y-6 my-10">
          <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl mx-auto shadow-inner animate-bounce">
            <i className="fa-solid fa-circle-check"></i>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Prédio Importado com Sucesso!</h3>
            <p className="text-xs text-slate-500">
              O condomínio <span className="font-bold text-slate-700 dark:text-slate-300">"{importedPredio?.nome}"</span> foi totalmente integrado na base de dados, incluindo todas as frações, proprietários e saldos iniciais devedores/credores.
            </p>
          </div>

          <div className="bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/20 p-4 rounded-lg text-left text-xs space-y-2.5">
            <h4 className="font-bold text-emerald-800 dark:text-emerald-400">Resumo da Integração de Dados:</h4>
            <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
              <div>• Edifício: <span className="font-bold">{importedPredio?.nome}</span></div>
              <div>• Frações Criadas: <span className="font-bold">{importedFracoes.length}</span></div>
              <div>• NIF Registado: <span className="font-mono-custom font-bold">{importedPredio?.nif}</span></div>
              <div>• Saldos Devedores: <span className="font-bold">{importedFracoes.filter(f => f.saldo_inicial < 0).length} Lançados</span></div>
            </div>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer transition-all shadow"
          >
            Aceder ao Painel de Controlo do Novo Prédio
          </button>
        </div>
      )}

      {/* REPORT EMAIL MODAL (LACUNAS) */}
      {showReportModal && emailReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <i className="fa-solid fa-paper-plane text-emerald-400"></i>
                <h3 className="font-bold text-sm">Relatório de Lacunas gerado por Email</h3>
              </div>
              <button 
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Email Form Representation */}
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-100 dark:border-slate-800 text-xs space-y-2">
                <div className="flex items-center">
                  <span className="font-bold text-slate-400 w-16">De:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono-custom">sistema@condomanager.pt</span>
                </div>
                <div className="flex items-center border-t border-slate-200 dark:border-slate-800 pt-2">
                  <span className="font-bold text-slate-400 w-16">Para:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono-custom">{emailReport.to}</span>
                </div>
                <div className="flex items-center border-t border-slate-200 dark:border-slate-800 pt-2">
                  <span className="font-bold text-slate-400 w-16">Assunto:</span>
                  <span className="text-slate-800 dark:text-slate-100 font-bold">{emailReport.subject}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Corpo do Relatório de Lacunas</label>
                <textarea
                  value={emailReport.body}
                  readOnly
                  className="w-full h-64 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4 text-xs font-mono-custom text-slate-700 dark:text-slate-200 focus:outline-none"
                />
              </div>

              {/* simulated email dispatch */}
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(emailReport.body);
                    alert("Rascunho de e-mail copiado para a Área de Transferência!");
                  }}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-4 py-2 rounded-lg text-xs cursor-pointer transition-all"
                >
                  <i className="fa-solid fa-copy mr-1"></i> Copiar Conteúdo
                </button>

                <button
                  onClick={handleEnviarRelatorioLacunas}
                  disabled={enviandoRelatorioLacunas}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold px-4 py-2 rounded-lg text-xs cursor-pointer transition-all"
                >
                  <i className={`fa-solid ${enviandoRelatorioLacunas ? "fa-spinner fa-spin" : "fa-paper-plane"} mr-1`}></i> {enviandoRelatorioLacunas ? "A enviar..." : "Enviar Relatório por Email"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
