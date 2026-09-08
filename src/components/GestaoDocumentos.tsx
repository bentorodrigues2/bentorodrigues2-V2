import React, { useState, useMemo } from "react";
import { jsPDF } from "jspdf";
import { Predio, Documento, LoggedUser } from "../types";
import { formatDatePT, downloadBlob, addPdfHeaderWithLogo, downloadReceiptPDF, downloadNotaCobrancaPDF } from "../utils";
import { getIllustratedManualHtml } from "../utils/manualIllustratedTemplates";
import { triggerSendReaction } from "./SendingReactionModal";
import { EnciclopediaPlataforma } from "./EnciclopediaPlataforma";
import { 
  FileText, 
  Trash2, 
  UploadCloud, 
  Plus, 
  Search, 
  Lock, 
  Unlock, 
  Calendar, 
  User, 
  Filter, 
  DownloadCloud,
  FileDown,
  Printer,
  ExternalLink,
  FolderOpen,
  Camera,
  Sparkles,
  Maximize2,
  X,
  Tag,
  CheckCircle2,
  Bot,
  Save,
  Send,
  Building2,
  Check,
  RotateCcw,
  ChevronRight,
  FolderTree,
  Folder,
  SlidersHorizontal,
  Eye,
  BookOpen,
  Video
} from "lucide-react";

interface GestaoDocumentosProps {
  predio: Predio;
  documentos: Documento[];
  onAddDocumento: (novoDoc: Documento) => void;
  loggedUser: LoggedUser;
  setDocumentos?: React.Dispatch<React.SetStateAction<Documento[]>>;
}

export function GestaoDocumentos({ 
  predio, 
  documentos, 
  onAddDocumento, 
  loggedUser,
  setDocumentos 
}: GestaoDocumentosProps) {
  // Main view mode tab: "documentos" or "fotografias" or "enciclopedia"
  const [activeTab, setActiveTab] = useState<"documentos" | "fotografias" | "enciclopedia">("documentos");

  // Single dynamic filter bar states
  const [busca, setBusca] = useState("");
  const [filtroAno, setFiltroAno] = useState<string>("Todos");
  const [filtroTema, setFiltroTema] = useState<string>("Todos");
  const [filtroFornecedor, setFiltroFornecedor] = useState<string>("Todos");
  const [filtroVisibilidade, setFiltroVisibilidade] = useState<string>("Todos");

  // Selected dynamic folder (if user clicks a folder card)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedSubPasta, setSelectedSubPasta] = useState<string | null>(null);

  // Photo Lightbox modal
  const [activePhotoModal, setActivePhotoModal] = useState<Documento | null>(null);

  // PDF Viewer Modal
  const [activePdfViewerDoc, setActivePdfViewerDoc] = useState<Documento | null>(null);

  // Edit & Re-emit Test Document Modal State
  const [editingDoc, setEditingDoc] = useState<Documento | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editAutor, setEditAutor] = useState("");
  const [editCategoria, setEditCategoria] = useState("");

  const abrirModalEditarDoc = (doc: Documento) => {
    setEditingDoc(doc);
    setEditNome(doc.nome);
    setEditDesc(doc.descricao || "");
    setEditAutor(doc.autor || loggedUser.nome);
    setEditCategoria(doc.categoria || "Documento Geral");
  };

  const guardarEGuardarPdf = () => {
    if (!editingDoc) return;
    const docAtualizado: Documento = {
      ...editingDoc,
      nome: editNome,
      descricao: editDesc,
      autor: editAutor,
      categoria: editCategoria
    };

    if (setDocumentos) {
      setDocumentos(prev => prev.map(d => d.id_doc === editingDoc.id_doc ? docAtualizado : d));
    }
    setEditingDoc(null);
    handleDownloadPdf(docAtualizado);
  };

  // Helper to generate full printable HTML content for any document
  const generateDocumentHtml = (doc: Documento) => {
    const illustratedHtml = getIllustratedManualHtml(doc, predio);
    if (illustratedHtml) {
      return illustratedHtml;
    }

    const isManualSintetizado = doc.id_doc === "doc-manual-4" || doc.nome.includes("Sintetizado");
    const isManualPerfis = doc.id_doc === "doc-manual-1" || doc.nome.includes("Perfis");
    const isManualPwa = doc.id_doc === "doc-manual-2" || doc.nome.includes("PWA");
    const isManualDesktop = doc.id_doc === "doc-manual-3" || doc.nome.includes("Desktop");

    if (isManualSintetizado) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.nome}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 30px; color: #0f172a; line-height: 1.5; }
    h1 { color: #047857; font-size: 18px; border-bottom: 2px solid #047857; padding-bottom: 6px; margin-top: 0; }
    h2 { color: #0f172a; font-size: 13px; margin-top: 18px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    p, li { font-size: 10.5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background-color: #f1f5f9; font-weight: bold; color: #0f172a; }
    .badge { background-color: #d1fae5; color: #065f46; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 9px; }
    .header-box { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }
    .feature-box { background: #f1f5f9; border-left: 4px solid #10b981; padding: 8px 12px; margin-bottom: 8px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="header-box">
    <h1 style="margin:0 0 6px 0;">⚡ CONDOMANAGER AI — MAPEAMENTO COMPLETO E GUIA SINTETIZADO DE FUNCIONALIDADES</h1>
    <p style="margin:0; font-size:10.5px;"><strong>Prédio:</strong> ${predio.nome} | <strong>Data:</strong> ${doc.data_upload} | <strong>Versão:</strong> 4.0 Oficial (Visão Global de Sistema)</p>
  </div>

  <h2>1. MAPEAMENTO DE TODOS OS MENUS E SUB-MENUS SISTÉMICOS</h2>
  <table>
    <thead>
      <tr>
        <th>Menu Principal</th>
        <th>Sub-menus Integrados</th>
        <th>Funcionalidades Detalhadas e Mapeadas</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>🏢 Prédio & Frações</strong></td>
        <td>Ficha Edifício, Frações & Permilagens, Proprietários/Inquilinos, Regulamento, Convites PWA</td>
        <td>Cadastro do prédio, alocação de permilagens (por mil), frações, garagens e arrecadações; associação de proprietários e inquilinos; geração do Regulamento do Condomínio; envio de acessos via WhatsApp e e-mail.</td>
      </tr>
      <tr>
        <td><strong>💰 Finanças & Quotas</strong></td>
        <td>Saldos, Movimentos, Contas Bancárias, Emissão Quotas MBWAY/MB, Fundo Reserva</td>
        <td>Emissão periódica de avisos de cobrança; geração de referências Multibanco e MB WAY; gestão da conta de ordem e conta de poupança/obras; balancetes de receitas e despesas.</td>
      </tr>
      <tr>
        <td><strong>🤖 Motor de IA Conciliação</strong></td>
        <td>Conciliação Bancária IA, Extrator OCR Comprovativos, Disquete de Arquivo IA</td>
        <td>Processamento de extratos bancários (OFX/CSV/PDF); leitura ótica OCR de comprovativos de transferência; correspondência automática entre depósitos e quotas pendentes.</td>
      </tr>
      <tr>
        <td><strong>⚖️ Assembleias & Legal</strong></td>
        <td>Assembleias, Convocatória IA, Sondagem Presenças, Atas IA, Assinatura PWA, Vídeo-Conferência</td>
        <td>Convocatórias legais por IA (Código Civil Art. 1414.º a 1438.º); sondagem "Vem/Não vem" em tempo real com estado de leitura; reuniões presenciais e por Vídeo-Conferência (Meet/Teams/Zoom); lavratura de ata por IA e recolha de assinatura tátil no telemóvel.</td>
      </tr>
      <tr>
        <td><strong>⚖️ Contencioso Jurídico</strong></td>
        <td>Cobrança Extrajudicial, Pré-Contencioso, Juros de Mora, Certidão para Ação Executiva</td>
        <td>Acompanhamento de devedores e frações em atraso; emissão de notificações registadas de interpelação; cálculo automático de juros legais de mora; geração do dossier de certidão de dívida.</td>
      </tr>
      <tr>
        <td><strong>🔍 Auditoria Interna</strong></td>
        <td>Balancete Contabilístico, Centro de Custos, Audit Log, Histórico Imutável de Operações</td>
        <td>Registo auditado de todas as edições, eliminações e lançamentos financeiros; verificação de consistência do Fundo Comum de Reserva; relatórios para o Conselho Fiscal.</td>
      </tr>
      <tr>
        <td><strong>📅 Agenda & Reservas</strong></td>
        <td>Calendário Edifício, Reserva Espaços Comuns (Churrasqueira/Salão/Ginásio), Cauções</td>
        <td>Marcação de áreas comuns pelos condóminos; verificação de sobreposição de horários; aprovação pela administração; liquidação/devolução de cauções.</td>
      </tr>
      <tr>
        <td><strong>🔧 Ocorrências & Avarias</strong></td>
        <td>Reporte Ocorrências, Piquetes Técnicos, Acompanhamento, Fotos WebP</td>
        <td>Registo de avarias em partes comuns; notificação de empresas de manutenção (elevadores, portões, canalização); captação de foto na câmara do telemóvel com conversão automática para WebP.</td>
      </tr>
      <tr>
        <td><strong>📦 Fornecedores & Obras</strong></td>
        <td>Prestadores Serviços, Contratos Manutenção, Garantias, Orçamentos Obras</td>
        <td>Gestão da carteira de fornecedores do condomínio; arquivo de apólices e contratos; controlo de prazos de renovação; pedidos de cotação para obras extraordinárias.</td>
      </tr>
      <tr>
        <td><strong>📁 Arquivo Digital</strong></td>
        <td>Pastas Inteligentes (Anos, Temas, Fornecedor), Instruções PWA/Desktop, Leitor PDF</td>
        <td>Repositório encriptado de atas, contratos, faturas, plantas e regulamentos; leitor de PDF e imagens integrado com descarregamento num clique.</td>
      </tr>
      <tr>
        <td><strong>📲 PWA Móvel & Floating FAB</strong></td>
        <td>Botão Flutuante, Mensagens de Voz, Fotos WebP, Piquetes, Limpezas, Autenticação Biométrica</td>
        <td>Aplicação PWA responsiva instalável no smartphone; botão flutuante para mensagens de áudio e anexos; biometria (FaceID/Fingerprint); painel dedicado para técnicos de manutenção e equipas de limpeza.</td>
      </tr>
    </tbody>
  </table>

  <h2>2. FUNÇÕES EXCLUSIVAS DA INTELIGÊNCIA ARTIFICIAL (CONDOMANAGER AI ENGINE)</h2>
  <div class="feature-box">
    <strong>✨ Elaborador de Convocatórias Legais:</strong> Formulação automática dos avisos e ordens de trabalho formais com verificação do quorum legal e prazos de antecedência estipulados no Código Civil.
  </div>
  <div class="feature-box">
    <strong>📝 Redator e Transcritor de Atas Oficiais:</strong> Compilação inteligente das votações por permilagem, presenças e deliberações em minuta de ata pronta a assinar e arquivar.
  </div>
  <div class="feature-box">
    <strong>🏦 Motor de Reconciliação Bancária & OCR:</strong> Leitura ótica e associação automática de comprovativos de transferência bancária às quotas devidas por cada fração.
  </div>
  <div class="feature-box">
    <strong>📊 Sondagem Automática de Presenças "Vem / Não Vem":</strong> Criação e sincronização em tempo real de sondagens para WhatsApp/PWA com registo auditado de leitura e intenção de voto.
  </div>
  <div class="feature-box">
    <strong>📁 Classificador Inteligente do Arquivo Digital (Disquete IA):</strong> Análise sintática de ficheiros para sugestão automática de sub-pasta, categoria e etiquetas de pesquisa.
  </div>
  <div class="feature-box">
    <strong>⚖️ Assistente Virtual Legal e Regulamentar:</strong> Resposta imediata a dúvidas jurídicas sobre o regime da propriedade horizontal, obras em partes comuns, seguros e quotas extraordinárias.
  </div>

  <h2>3. PROCESSAMENTO DE DOCUMENTOS, MULTIMÉDIA & TECNOLOGIAS PWA</h2>
  <ul>
    <li><strong>Leitura Ótica OCR (Optical Character Recognition):</strong> Leitura automática de faturas, recibos e extratos nos formatos PDF, PNG e JPG, extraindo NIF, Valor Total, Decomposição do IVA, Data e IBAN.</li>
    <li><strong>Captação de Fotografia WebP na Câmara (Telemóvel):</strong> Captura direta pela câmara traseira/frontal do telemóvel com compressão em tempo real para o formato WebP (redução até 85% no tráfego e espaço de armazenamento).</li>
    <li><strong>Gravador de Mensagens de Áudio no Botão Flutuante & Chat:</strong> Envio de notas de voz gravadas no telemóvel com temporizador e leitor de áudio interativo para dar notas rápidas à administração.</li>
    <li><strong>Assinatura Tátil Digital & Registos Auditados:</strong> Recolha de assinaturas no ecrã de smartphones e tablets para atas de assembleia, folhas de presença e comprovativos.</li>
    <li><strong>Autenticação Biométrica PWA:</strong> Suporte para verificação de identidade por TouchID / FaceID / Impressão Digital no telemóvel.</li>
    <li><strong>Integração Multibanco & MB WAY:</strong> Emissão e validação de referências de pagamento em tempo real.</li>
  </ul>

  <h2>4. MAPEAMENTO DE FUNCIONALIDADES POR PERFIL DE UTILIZADOR</h2>
  <ul>
    <li><strong>Administrador / Empresa Gestora:</strong> Acesso total a todas as áreas financeiras, emissão de quotas, assembleias, conciliação IA, aprovação de reservas e arquivo.</li>
    <li><strong>Condómino (PWA Móvel):</strong> Pagamento de quotas por MB WAY, voto em sondagens, participação em assembleias/vídeo-conferência, assinatura tátil de atas, marcação de espaços comuns e chat com envio de áudio e fotos WebP.</li>
    <li><strong>Técnico de Piquete / Manutenção:</strong> Acesso às ordens de trabalho de avarias em curso, inserção de relatórios técnicos e captação de fotos WebP dos reparações.</li>
    <li><strong>Equipa de Limpeza:</strong> Registo de vistorias operacionais, check-in de higienização do prédio e alerta de rutura de materiais.</li>
    <li><strong>Contabilista / Auditor / Jurídico:</strong> Acesso especializado a balancetes, extratos auditados, histórico do fundo de reserva e emissão de certidões para cobrança de dívidas.</li>
  </ul>
</body>
</html>`;
    }

    if (isManualPerfis) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.nome}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 30px; color: #0f172a; line-height: 1.5; }
    h1 { color: #047857; font-size: 18px; border-bottom: 2px solid #047857; padding-bottom: 6px; margin-top: 0; }
    h2 { color: #0f172a; font-size: 14px; margin-top: 20px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    p, li { font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10.5px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background-color: #f1f5f9; font-weight: bold; color: #0f172a; }
    .badge { background-color: #d1fae5; color: #065f46; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 9.5px; }
    .header-box { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="header-box">
    <h1 style="margin:0 0 6px 0;">🛡️ CONDOMANAGER AI - MANUAL DE PERFIS, MENUS & CAPACIDADES</h1>
    <p style="margin:0; font-size:11px;"><strong>Prédio:</strong> ${predio.nome} | <strong>Data:</strong> ${doc.data_upload} | <strong>Categoria:</strong> ${doc.categoria}</p>
  </div>

  <h2>1. ESTRUTURA DE MENUS E SUB-MENUS (COLUNA CENTRAL BROWSER & PWA)</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Menu Principal</th>
        <th>Sub-menus Dinâmicos Integrados</th>
        <th>Finalidade & Ações Disponíveis</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td><strong>🏢 Prédio & Frações</strong></td>
        <td>• Gestão do Prédio & Regras<br>• Gestão de Frações & Residentes<br>• Portal de Condóminos & Inquilinos</td>
        <td>Registo de frações, permilagens, identificação de condóminos, inquilinos, envio de convites e regulamento.</td>
      </tr>
      <tr>
        <td>2</td>
        <td><strong>💰 Finanças & Contas</strong></td>
        <td>• Saldos & Extrato de Movimentos<br>• Contas Bancárias do Condomínio<br>• Emissão de Quotas & Recibos<br>• Fundo de Reserva Comum<br>• Conciliação Bancária com IA</td>
        <td>Controlo financeiro total, extratos de conta, emissão de quotas com referência MB/MBWAY, gestão de poupança e reconciliação automática de extratos via IA.</td>
      </tr>
      <tr>
        <td>3</td>
        <td><strong>🏗️ Manutenção & Obras</strong></td>
        <td>• Gestão de Ocorrências & Avarias<br>• Agenda de Intervenções Técnicas<br>• Gestão de Obras Extraordinárias<br>• Vistorias Técnicas & Relatórios de Limpeza</td>
        <td>Registo de avarias com fotografias WebP, agendamento de técnicos, controlo de orçamentos de obras e folhas de vistoria/limpeza digital.</td>
      </tr>
      <tr>
        <td>4</td>
        <td><strong>📁 Arquivo Digital</strong></td>
        <td>• Arquivo Organizado (Instruções PWA & Desktop, Anos, Temas, Fornecedor)<br>• Auditoria Interna & Relatórios</td>
        <td>Repositório inteligente de documentos, atas, faturas, contratos, manuais operacionais e relatórios.</td>
      </tr>
      <tr>
        <td>5</td>
        <td><strong>⚖️ Assembleias & Legal</strong></td>
        <td>• Gestão & Organização de Assembleias<br>• Contencioso Jurídico & Litígios<br>• Consultadoria Legal & Regulamento</td>
        <td>Convocatórias, lavratura automática de atas com IA, recolha de assinaturas digitais na PWA e pareceres jurídicos.</td>
      </tr>
      <tr>
        <td>6</td>
        <td><strong>📢 Comunicação & IA</strong></td>
        <td>• Alerta Push Geral & Avisos<br>• Central de Inteligência Artificial Avançada</td>
        <td>Envio de notificações push para telemóveis, minutas de emails e assistente virtual inteligente.</td>
      </tr>
      <tr>
        <td>7</td>
        <td><strong>🛠️ Fornecedores & Orçamentos</strong></td>
        <td>• Fichas de Fornecedores & Contratos<br>• Portal de Orçamentos de Fornecedores</td>
        <td>Base de dados de empresas prestadoras de serviço, contratos de manutenção e consultas ao mercado.</td>
      </tr>
      <tr>
        <td>8</td>
        <td><strong>📝 Aprovações & Agenda</strong></td>
        <td>• Gestão & Aprovação de Reservas<br>• Emissão & Validação de Recibos</td>
        <td>Validação de reservas de salão de festas/churrasqueira feitas por condóminos e conferência de recibos.</td>
      </tr>
      <tr>
        <td>9</td>
        <td><strong>⚙️ Empresa Gestora & Parâmetros</strong></td>
        <td>• Ficha da Empresa Gestora (White-Label)<br>• Configurações Gerais do Condomínio<br>• Configurações de IA & Notificações Push</td>
        <td>Personalização da marca (logótipo e cores), parâmetros de cálculo, templates de email e logs de auditoria inalterável.</td>
      </tr>
    </tbody>
  </table>

  <h2>2. MATRIZ DE ATRIBUIÇÃO DE FUNÇÕES POR PERFIL (BROWSER E PWA)</h2>
  <table>
    <thead>
      <tr>
        <th>Perfil Utilizador</th>
        <th>Acesso Browser (Website Desktop)</th>
        <th>Acesso PWA (Aplicação Mobile)</th>
        <th>Permissões & Restrições</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>🛡️ Administrador / Empresa Gestora</strong></td>
        <td>Acesso total aos 9 menus centrais, painéis financeiros, arquivo digital, parametrização e auditoria.</td>
        <td>Dashboard bento de 9 cartões principais com abertura de sub-menus popups. Acesso total.</td>
        <td><span class="badge">Acesso Total</span> Leitura, escrita, edição, eliminação, exportação e aprovação.</td>
      </tr>
      <tr>
        <td><strong>🏠 Condómino / Inquilino</strong></td>
        <td>Consulta de frações próprias, saldo pendente, atas públicas, avisos gerais, pedido de reservas e reporte de avarias.</td>
        <td>Ecrã simplificado com saldo pessoal, quotas pendentes/pagas, botão MB WAY, quadro de assinatura tátil para atas e reporte de defeitos.</td>
        <td><span class="badge" style="background:#e0f2fe;color:#0369a1;">Restrito Pessoal</span> Apenas dados próprios, documentos públicos do condomínio e as suas frações.</td>
      </tr>
      <tr>
        <td><strong>🔧 Técnico de Manutenção</strong></td>
        <td>Gestão de ocorrências, vistorias técnicas, checklists de equipamentos e histórico de intervenções.</td>
        <td>Cards dedicados: Vistoria Checklist, Captura de Fotos, Histórico de Vistorias e Reporte de Defeito.</td>
        <td><span class="badge" style="background:#fef3c7;color:#92400e;">Especializado</span> Focado em manutenção, vistorias e relatórios técnicos.</td>
      </tr>
      <tr>
        <td><strong>🧼 Equipa de Limpezas</strong></td>
        <td>Registo de higienização de áreas comuns, folha digital e reporte de anomalias encontradas.</td>
        <td>Cards dedicados: Folha Digital de Limpeza, Inspeção de Áreas e Reporte de Avaria.</td>
        <td><span class="badge" style="background:#fef3c7;color:#92400e;">Especializado</span> Focado nas tarefas de higienização e conservação de halls.</td>
      </tr>
      <tr>
        <td><strong>⚖️ Apoio Jurídico</strong></td>
        <td>Módulo de Contencioso, cobrança de quotas em atraso, redação de regulamentos e pareceres.</td>
        <td>Cards dedicados: Contencioso & Litígios e Consultadoria Legal.</td>
        <td><span class="badge" style="background:#f3e8ff;color:#6b21a8;">Jurídico</span> Acesso a dados de devedores, atas, minutas e regulamento interno.</td>
      </tr>
      <tr>
        <td><strong>🔎 Auditor Externo</strong></td>
        <td>Consulta de extratos bancários, validação de faturas, verificação de conciliação e inserção de pareceres de auditoria.</td>
        <td>Cards dedicados: Relatórios de Auditoria e Inserção de Parecer Oficial.</td>
        <td><span class="badge" style="background:#f1f5f9;color:#334155;">Auditoria</span> Leitura financeira integral e emissão de pareceres oficiais.</td>
      </tr>
      <tr>
        <td><strong>📊 Contabilista</strong></td>
        <td>Gestão de contas bancárias, lançamento de despesas/faturas, emissão de recibos e balancetes.</td>
        <td>Cards dedicados: Saldos Bancários, Extratos & Conciliação e Lançamento de Faturas.</td>
        <td><span class="badge" style="background:#ecfdf5;color:#047857;">Financeiro</span> Operação de contas, lançamentos e conciliação contabilística.</td>
      </tr>
    </tbody>
  </table>

  <h2>3. RECURSOS INOVADORES & FUNCIONALIDADES IMPLEMENTADAS</h2>
  <ul>
    <li><strong>Assinatura Digital de Atas via PWA (Ativo):</strong> Recolha de assinaturas digitais diretamente no ecrã tátil do telemóvel dos condóminos para validação jurídica instantânea de atas.</li>
    <li><strong>Leitura OCR de Faturas por IA (Ativo):</strong> Leitura ótica de faturas com extração automática de NIF, Valor, Fornecedor e Data de Vencimento, com arquivamento no Arquivo Digital e lançamento automático nos Movimentos Financeiros após confirmação.</li>
    <li><strong>Notificações Web Push PWA (Ativo):</strong> Notificações em tempo real enviadas diretamente para o dispositivo móvel do utilizador para lembretes de quotas, avisos e convocatórias de assembleia.</li>
  </ul>
</body>
</html>`;
    }

    if (isManualPwa) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.nome}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 30px; color: #0f172a; line-height: 1.5; }
    h1 { color: #047857; font-size: 18px; border-bottom: 2px solid #047857; padding-bottom: 6px; margin-top: 0; }
    h2 { color: #0f172a; font-size: 14px; margin-top: 20px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    p, li { font-size: 11px; }
    .header-box { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }
    .step-box { background: #f1f5f9; border-left: 4px solid #10b981; padding: 10px 12px; margin-bottom: 10px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="header-box">
    <h1 style="margin:0 0 6px 0;">📱 INSTRUÇÕES DE INSTALAÇÃO & UTILIZAÇÃO PWA MOBILE</h1>
    <p style="margin:0; font-size:11px;"><strong>Prédio:</strong> ${predio.nome} | <strong>Plataforma:</strong> PWA iOS / Android | <strong>Documento:</strong> ${doc.nome}</p>
  </div>

  <h2>1. COMO INSTALAR A PWA NO SEU TELEMÓVEL</h2>
  <div class="step-box">
    <strong>📲 Em Dispositivos iOS (iPhone / iPad - Safari):</strong>
    <p style="margin:4px 0 0 0;">1. Abra o link do aplicativo no Safari.<br>2. Toque no botão "Partilhar" (ícone de quadrado com seta para cima).<br>3. Selecione a opção <strong>"Adicionar ao Ecrã Principal"</strong>.<br>4. Confirme o nome "CondoManager" e toque em "Adicionar". O ícone aparecerá no seu telemóvel como uma app nativa.</p>
  </div>

  <div class="step-box">
    <strong>🤖 Em Dispositivos Android (Chrome / Edge):</strong>
    <p style="margin:4px 0 0 0;">1. Abra o link do aplicativo no Google Chrome.<br>2. Toque no aviso inferior "Instalar CondoManager AI" ou nos 3 pontos do menu superior.<br>3. Toque em <strong>"Instalar Aplicação"</strong> ou <strong>"Adicionar ao Ecrã Principal"</strong>.<br>4. Abra a app diretamente a partir do ecrã inicial.</p>
  </div>

  <h2>2. PRINCIPAIS FUNCIONALIDADES DA PWA</h2>
  <ul>
    <li><strong>Pagamentos Instantâneos MB WAY & Multibanco:</strong> Liquide as suas quotas pendentes com 1 clique e obtenha recibos automáticos.</li>
    <li><strong>Assinatura Digital de Atas no Ecrã Tátil:</strong> Assine as atas das assembleias diretamente no ecrã do telemóvel com o dedo ou caneta stylus.</li>
    <li><strong>Reporte de Avarias com Fotografia HD:</strong> Tire foto de um defeito (ex: lâmpada fundida ou portão) e envie diretamente para a Administração.</li>
    <li><strong>Reserva de Espaços Comuns:</strong> Reserve o salão de festas ou churrasqueira com calendário de disponibilidade em tempo real.</li>
    <li><strong>Notificações Web Push:</strong> Receba alertas urgentes, avisos de corte de água e lembretes de reunião mesmo com a app fechada.</li>
  </ul>
</body>
</html>`;
    }

    if (isManualDesktop) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.nome}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 30px; color: #0f172a; line-height: 1.5; }
    h1 { color: #047857; font-size: 18px; border-bottom: 2px solid #047857; padding-bottom: 6px; margin-top: 0; }
    h2 { color: #0f172a; font-size: 14px; margin-top: 20px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    p, li { font-size: 11px; }
    .header-box { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="header-box">
    <h1 style="margin:0 0 6px 0;">💻 MANUAL DE UTILIZADOR BROWSER DESKTOP</h1>
    <p style="margin:0; font-size:11px;"><strong>Prédio:</strong> ${predio.nome} | <strong>Interface:</strong> Web Browser Desktop | <strong>Documento:</strong> ${doc.nome}</p>
  </div>

  <h2>1. ESTRUTURA DE NAVEGAÇÃO EM TRÊS COLUNAS</h2>
  <p>O Website Desktop opera com uma arquitetura modular responsiva:</p>
  <ul>
    <li><strong>Coluna Esquerda (Ecrã / Prédio Ativo):</strong> Seleção do condomínio ativo, simulação de perfis de utilizador e alternância para o simulador PWA.</li>
    <li><strong>Coluna Central (Menu de Operações):</strong> Os 9 menus operacionais com sub-menus dinâmicos para gestão financeira, manutenção, atas, arquivo e parametrização.</li>
    <li><strong>Coluna Direita (Painel de Trabalho):</strong> Área de trabalho detalhada com tabelas interativas, gráficos Recharts, emissão de documentos e minutas.</li>
  </ul>

  <h2>2. FERRAMENTAS AVANÇADAS PARA A ADMINISTRAÇÃO</h2>
  <ul>
    <li><strong>Conciliação Bancária por IA:</strong> Carregamento de extrato de conta em ficheiro e reconciliação automática de entradas e saídas.</li>
    <li><strong>Leitura OCR de Faturas:</strong> Processamento generativo de documentos com extração de NIF, Valor e Data, com lançamento em movimentos.</li>
    <li><strong>Arquivo Digital Organizado:</strong> Organização por Pastas de Fornecedores, Anos e o novo tema dedicado <strong>"Instruções PWA & Desktop"</strong>.</li>
    <li><strong>Gerador Inteligente de Atas e Minutas:</strong> Redação automatizada de atas de assembleias com quórum pré-calculado.</li>
  </ul>
</body>
</html>`;
    }

    const isRecibo =
      doc.tipo.toLowerCase().includes("recibo") ||
      (doc.categoria && doc.categoria.toLowerCase().includes("recibo")) ||
      doc.nome.toLowerCase().includes("recibo") ||
      doc.sub_pasta === "Recibos" ||
      doc.sub_pasta === "Recibos Quotas extra";

    if (isRecibo) {
      const isExtra = doc.tipo.toLowerCase().includes("extra") || doc.nome.toLowerCase().includes("extra") || doc.sub_pasta?.includes("extra");
      
      const reciboNumExt = "BR2 00195";
      const dataPagamento = doc.data_upload || "30-07-2026";
      const buildingName = predio.nome ? predio.nome.toUpperCase() : "EDIFÍCIO ESTRELA DA BARRA";
      const buildingMorada = `${predio.morada_linha1 || "Rua Bento Rodrigues"} ${predio.num_porta || "2"}, ${predio.localidade || "Seixal"}`;
      const buildingNif = predio.nif || "900123456";

      const propNome = "Ana Silva";
      const propNif = "221230475";
      const fracaoIdent = "Fração A (R/C Esq)";
      const metodoPag = "Transferência Bancária";

      const valorQM = 32.14;
      const valorFR = 3.21;
      const valorQE = 120.00;
      const valorTotal = isExtra ? valorQE : (valorQM + valorFR);
      const valorTotalDisplay = valorTotal.toFixed(2);

      const movQM = `MOV-2026-QM-${reciboNumExt}`;
      const movFR = `MOV-2026-FR-${reciboNumExt}`;
      const movQE = `MOV-2026-QE-${reciboNumExt}`;
      const movimentosDesc = isExtra ? movQE : `${movQM}, ${movFR}...`;

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.nome}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 20px; color: #0f172a; background: #f8fafc; line-height: 1.35; -webkit-print-color-adjust: exact; }
    .recibo-sheet { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 24px; max-width: 820px; margin: 0 auto; box-shadow: 0 4px 14px rgba(0,0,0,0.06); position: relative; overflow: hidden; }
    .watermark-bg { position: absolute; top: 52%; left: 50%; transform: translate(-50%, -50%); width: 320px; opacity: 0.05; pointer-events: none; z-index: 0; }
    .header-row { display: flex; justify-content: space-between; align-items: stretch; gap: 16px; margin-bottom: 16px; position: relative; z-index: 1; }
    .logo-dark-box { background: #0c1322; border-radius: 4px; padding: 8px 14px; display: inline-flex; align-items: center; gap: 10px; min-height: 52px; }
    .logo-dark-box img { height: 38px; object-fit: contain; }
    .recibo-badge-dark { background: #0b1426; color: #ffffff; border-radius: 2px; padding: 9px 16px; text-align: left; min-width: 320px; display: flex; flex-direction: column; justify-content: center; }
    .recibo-badge-title { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #ffffff; }
    .recibo-badge-sub { font-size: 10px; color: #cbd5e1; margin-top: 2px; }
    
    .id-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; position: relative; z-index: 1; }
    .id-box { border: 1px solid #cbd5e1; border-radius: 2px; padding: 9px 12px; background: rgba(255,255,255,0.92); }
    .id-box-label { font-size: 9.5px; font-weight: bold; color: #0284c7; text-transform: uppercase; letter-spacing: 0.3px; }
    .id-box-title { font-size: 13px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin-top: 2px; }
    .id-box-text { font-size: 10.5px; color: #334155; margin-top: 2px; }

    .tabela-recibo { width: 100%; border-collapse: collapse; margin-top: 6px; position: relative; z-index: 1; }
    .tabela-recibo th { background: #0b1426; color: #ffffff; padding: 6px 10px; font-size: 9.5px; font-weight: bold; text-align: left; text-transform: uppercase; border: 1px solid #0b1426; }
    .tabela-recibo td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; font-size: 10.5px; }
    .cat-qm { color: #0d9488; font-weight: bold; font-size: 9.5px; text-transform: uppercase; }
    .cat-fr { color: #c2410c; font-weight: bold; font-size: 9.5px; text-transform: uppercase; }
    .cat-qe { color: #be185d; font-weight: bold; font-size: 9.5px; text-transform: uppercase; }

    .total-subbar { background: #f8fafc; border: 1px solid #cbd5e1; border-top: none; padding: 7px 12px; display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 1; }
    .total-subbar-legal { font-size: 10px; color: #334155; }
    .total-subbar-val { font-size: 12px; font-weight: 900; color: #0d9488; }

    .quittance-note { font-size: 8.5px; color: #64748b; margin-top: 10px; position: relative; z-index: 1; }

    .footer-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; position: relative; z-index: 1; }
    .footer-left { font-size: 8.5px; color: #94a3b8; }
    .footer-right { text-align: center; min-width: 250px; }
    .footer-sign-title { font-size: 10px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin-bottom: 28px; }
    .footer-sign-line { width: 230px; border-bottom: 1px solid #cbd5e1; margin: 0 auto 4px auto; }
    .footer-sign-name { font-size: 9.5px; color: #334155; }
  </style>
</head>
<body>
  <div class="recibo-sheet">
    <img src="/marca/19-marca-dagua-logo-cinza-claro.png" class="watermark-bg" alt="Watermark" />

    <!-- Top Header -->
    <div class="header-row">
      <div class="logo-dark-box">
        <img src="/marca/20-Logotipo Horizontal com fundo.png" alt="CondoManager AI" />
      </div>
      <div class="recibo-badge-dark">
        <div class="recibo-badge-title">RECIBO DE PAGAMENTO Nº: ${reciboNumExt}</div>
        <div class="recibo-badge-sub">Data de Pagamento: ${dataPagamento}</div>
        <div class="recibo-badge-sub" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px;">Nºs Movimentos: ${movimentosDesc}</div>
      </div>
    </div>

    <!-- 2 Side-by-Side Cards -->
    <div class="id-grid">
      <div class="id-box">
        <div class="id-box-label">CONDOMÍNIO DO EDIFÍCIO:</div>
        <div class="id-box-title">${buildingName}</div>
        <div class="id-box-text">Morada: ${buildingMorada}</div>
        <div class="id-box-text">NIF do Condomínio: ${buildingNif}</div>
      </div>
      <div class="id-box">
        <div class="id-box-label">LIQUIDADO POR (PROPRIETÁRIO / FRAÇÃO):</div>
        <div class="id-box-title" style="text-transform: none;">${propNome}</div>
        <div class="id-box-text">NIF do Proprietário: ${propNif}</div>
        <div class="id-box-text">Fração: ${fracaoIdent}</div>
        <div class="id-box-text">Método de Pagamento: ${metodoPag}</div>
      </div>
    </div>

    <!-- Items Table -->
    <table class="tabela-recibo">
      <thead>
        <tr>
          <th style="width: 25%;">Nº MOVIMENTO</th>
          <th style="width: 45%;">DESCRITIVO DO CONCEITO / QUOTA</th>
          <th style="width: 18%;">CATEGORIA</th>
          <th style="width: 12%; text-align: right;">VALOR (€)</th>
        </tr>
      </thead>
      <tbody>
        ${!isExtra ? `
        <tr>
          <td style="font-family: monospace; font-size: 10px; font-weight: bold; color: #1e293b;">${movQM}</td>
          <td>Quota Ordinária de Julho 2026</td>
          <td><span class="cat-qm">QUOTA MENSAL</span></td>
          <td style="text-align: right; font-weight: bold; font-family: monospace;">${valorQM.toFixed(2)} €</td>
        </tr>
        <tr>
          <td style="font-family: monospace; font-size: 10px; font-weight: bold; color: #1e293b;">${movFR}</td>
          <td>Fundo Comum de Reserva (10% Legal)</td>
          <td><span class="cat-fr">FUNDO RESERVA</span></td>
          <td style="text-align: right; font-weight: bold; font-family: monospace;">${valorFR.toFixed(2)} €</td>
        </tr>
        ` : `
        <tr>
          <td style="font-family: monospace; font-size: 10px; font-weight: bold; color: #1e293b;">${movQE}</td>
          <td>Quota Extraordinária de Obras e Conservação</td>
          <td><span class="cat-qe">QUOTA EXTRA</span></td>
          <td style="text-align: right; font-weight: bold; font-family: monospace;">${valorQE.toFixed(2)} €</td>
        </tr>
        `}
      </tbody>
    </table>

    <!-- Total Sub-bar -->
    <div class="total-subbar">
      <div class="total-subbar-legal">Isento de I.V.A. nos termos do artº 9º do nº21 do CIVA</div>
      <div class="total-subbar-val"><span style="color: #0f172a; margin-right: 4px;">TOTAL DO RECIBO:</span> ${valorTotalDisplay} €</div>
    </div>

    <!-- Quittance Legal Note -->
    <div class="quittance-note">
      O presente documento serve de quitação oficial para todos os efeitos legais, comprovando a liquidação dos valores discriminados por movimento na conta do condomínio.
    </div>

    <!-- Signatures & Authenticity Footer -->
    <div class="footer-row">
      <div class="footer-left">
        Emitido via CondoManager AI • Documento nº ${reciboNumExt} • Autenticidade Digital Garantida
      </div>
      <div class="footer-right">
        <div class="footer-sign-title">A ADMINISTRAÇÃO DO CONDOMÍNIO</div>
        <div class="footer-sign-line"></div>
        <div class="footer-sign-name">Carlos Administrador - Administrador do Condomínio</div>
      </div>
    </div>
  </div>
</body>
</html>`;
    }

    const isNotaCobranca =
      doc.tipo.toLowerCase().includes("cobrança") ||
      doc.tipo.toLowerCase().includes("cobranca") ||
      (doc.categoria && doc.categoria.toLowerCase().includes("cobrança")) ||
      doc.nome.toLowerCase().includes("cobranca") ||
      doc.nome.toLowerCase().includes("aviso_cobranca");

    if (isNotaCobranca) {
      const reciboNumExt = "BR2 00195";
      const dataEmissao = doc.data_upload || "30-07-2026";
      const dataLimite = "08-08-2026";
      const buildingName = predio.nome ? predio.nome.toUpperCase() : "EDIFÍCIO ESTRELA DA BARRA";
      const buildingMorada = `${predio.morada_linha1 || "Rua Bento Rodrigues"} ${predio.num_porta || "2"}, ${predio.localidade || "Seixal"}`;
      const buildingNif = predio.nif || "900123456";
      const buildingIban = predio.iban || "PT50 0033 0000 12345678901 02";
      const buildingEmail = predio.email_condominio || "condominio.estrela.barra@condomanager.ai";

      const propNome = "Ana Silva";
      const propNif = "221230475";
      const fracaoIdent = "Fração A (R/C Esq)";

      const valorQM = 32.14;
      const valorFR = 3.21;
      const valorTotal = valorQM + valorFR;
      const valorTotalDisplay = valorTotal.toFixed(2);

      const movQM = `MOV-2026-QM-${reciboNumExt}`;
      const movFR = `MOV-2026-FR-${reciboNumExt}`;
      const movimentosDesc = `${movQM}, ${movFR}...`;

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.nome}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 20px; color: #0f172a; background: #f8fafc; line-height: 1.35; -webkit-print-color-adjust: exact; }
    .recibo-sheet { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 24px; max-width: 820px; margin: 0 auto; box-shadow: 0 4px 14px rgba(0,0,0,0.06); position: relative; overflow: hidden; }
    .watermark-bg { position: absolute; top: 52%; left: 50%; transform: translate(-50%, -50%); width: 320px; opacity: 0.05; pointer-events: none; z-index: 0; }
    .header-row { display: flex; justify-content: space-between; align-items: stretch; gap: 16px; margin-bottom: 16px; position: relative; z-index: 1; }
    .logo-dark-box { background: #0c1322; border-radius: 4px; padding: 8px 14px; display: inline-flex; align-items: center; gap: 10px; min-height: 52px; }
    .logo-dark-box img { height: 38px; object-fit: contain; }
    .recibo-badge-dark { background: #0b1426; color: #ffffff; border-radius: 2px; padding: 9px 16px; text-align: left; min-width: 320px; display: flex; flex-direction: column; justify-content: center; }
    .recibo-badge-title { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #ffffff; }
    .recibo-badge-sub { font-size: 10px; color: #cbd5e1; margin-top: 2px; }
    
    .id-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; position: relative; z-index: 1; }
    .id-box { border: 1px solid #cbd5e1; border-radius: 2px; padding: 9px 12px; background: rgba(255,255,255,0.92); }
    .id-box-label { font-size: 9.5px; font-weight: bold; color: #0284c7; text-transform: uppercase; letter-spacing: 0.3px; }
    .id-box-title { font-size: 13px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin-top: 2px; }
    .id-box-text { font-size: 10.5px; color: #334155; margin-top: 2px; }

    .tabela-recibo { width: 100%; border-collapse: collapse; margin-top: 6px; position: relative; z-index: 1; }
    .tabela-recibo th { background: #0b1426; color: #ffffff; padding: 6px 10px; font-size: 9.5px; font-weight: bold; text-align: left; text-transform: uppercase; border: 1px solid #0b1426; }
    .tabela-recibo td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; font-size: 10.5px; }
    .cat-qm { color: #0d9488; font-weight: bold; font-size: 9.5px; text-transform: uppercase; }
    .cat-fr { color: #c2410c; font-weight: bold; font-size: 9.5px; text-transform: uppercase; }

    .total-subbar { background: #f8fafc; border: 1px solid #cbd5e1; border-top: none; padding: 7px 12px; display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 1; }
    .total-subbar-legal { font-size: 10px; color: #334155; }
    .total-subbar-val { font-size: 12px; font-weight: 900; color: #0d9488; }

    .payment-instructions-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 3px; padding: 10px 14px; margin-top: 12px; position: relative; z-index: 1; font-size: 10px; color: #1e293b; }
    .payment-instructions-title { font-weight: 900; font-size: 10.5px; text-transform: uppercase; color: #0f172a; margin-bottom: 4px; }
    .payment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; }
    .payment-chip { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 2px; padding: 6px 10px; }

    .footer-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; position: relative; z-index: 1; }
    .footer-left { font-size: 8.5px; color: #94a3b8; }
    .footer-right { text-align: center; min-width: 250px; }
    .footer-sign-title { font-size: 10px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin-bottom: 28px; }
    .footer-sign-line { width: 230px; border-bottom: 1px solid #cbd5e1; margin: 0 auto 4px auto; }
    .footer-sign-name { font-size: 9.5px; color: #334155; }
  </style>
</head>
<body>
  <div class="recibo-sheet">
    <img src="/marca/19-marca-dagua-logo-cinza-claro.png" class="watermark-bg" alt="Watermark" />

    <!-- Top Header -->
    <div class="header-row">
      <div class="logo-dark-box">
        <img src="/marca/20-Logotipo Horizontal com fundo.png" alt="CondoManager AI" />
      </div>
      <div class="recibo-badge-dark">
        <div class="recibo-badge-title">NOTA DE COBRANÇA Nº: ${reciboNumExt}</div>
        <div class="recibo-badge-sub">Data de Emissão: ${dataEmissao} • Prazo Limite: ${dataLimite}</div>
        <div class="recibo-badge-sub" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px;">Nºs Movimentos: ${movimentosDesc}</div>
      </div>
    </div>

    <!-- 2 Side-by-Side Cards -->
    <div class="id-grid">
      <div class="id-box">
        <div class="id-box-label">CONDOMÍNIO DO EDIFÍCIO:</div>
        <div class="id-box-title">${buildingName}</div>
        <div class="id-box-text">Morada: ${buildingMorada}</div>
        <div class="id-box-text">NIF: ${buildingNif} • Email: ${buildingEmail}</div>
        <div class="id-box-text" style="font-weight: bold; color: #0f172a;">IBAN do Prédio: ${buildingIban}</div>
      </div>
      <div class="id-box">
        <div class="id-box-label">DESTINATÁRIO (CONDÓMINO / FRAÇÃO):</div>
        <div class="id-box-title" style="text-transform: none;">${propNome}</div>
        <div class="id-box-text">NIF do Proprietário: ${propNif}</div>
        <div class="id-box-text">Fração: ${fracaoIdent}</div>
        <div class="id-box-text" style="font-weight: bold; color: #0284c7;">Ref. Individual da Fração (IA): BR2-FRA</div>
      </div>
    </div>

    <!-- Items Table -->
    <table class="tabela-recibo">
      <thead>
        <tr>
          <th style="width: 25%;">Nº MOVIMENTO</th>
          <th style="width: 45%;">DESCRITIVO DO CONCEITO / QUOTA</th>
          <th style="width: 18%;">CATEGORIA</th>
          <th style="width: 12%; text-align: right;">VALOR (€)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="font-family: monospace; font-size: 10px; font-weight: bold; color: #1e293b;">${movQM}</td>
          <td>Quota Ordinária de Julho 2026</td>
          <td><span class="cat-qm">QUOTA MENSAL</span></td>
          <td style="text-align: right; font-weight: bold; font-family: monospace;">${valorQM.toFixed(2)} €</td>
        </tr>
        <tr>
          <td style="font-family: monospace; font-size: 10px; font-weight: bold; color: #1e293b;">${movFR}</td>
          <td>Fundo Comum de Reserva (10% Legal)</td>
          <td><span class="cat-fr">FUNDO RESERVA</span></td>
          <td style="text-align: right; font-weight: bold; font-family: monospace;">${valorFR.toFixed(2)} €</td>
        </tr>
      </tbody>
    </table>

    <!-- Total Sub-bar -->
    <div class="total-subbar">
      <div class="total-subbar-legal">Isento de I.V.A. nos termos do artº 9º do nº21 do CIVA</div>
      <div class="total-subbar-val"><span style="color: #0f172a; margin-right: 4px;">TOTAL A PAGAR:</span> ${valorTotalDisplay} €</div>
    </div>

    <!-- Payment & Submission Instructions -->
    <div class="payment-instructions-box">
      <div class="payment-instructions-title">DADOS PARA PAGAMENTO (EXCLUSIVAMENTE TRANSFERÊNCIA BANCÁRIA):</div>
      <div class="payment-grid">
        <div class="payment-chip">
          <div style="font-weight: bold; color: #0284c7; font-size: 9px; text-transform: uppercase;">IBAN do Condomínio (Conta Bancária Oficial):</div>
          <div style="font-family: monospace; font-weight: bold; font-size: 11.5px; color: #0f172a; margin-top: 2px;">${buildingIban}</div>
        </div>
        <div class="payment-chip">
          <div style="font-weight: bold; color: #0284c7; font-size: 9px; text-transform: uppercase;">Ref. Individual da Fração (Descritivo / IA):</div>
          <div style="font-family: monospace; font-weight: bold; font-size: 11.5px; color: #0f172a; margin-top: 2px;">BR2-FRA</div>
        </div>
      </div>
      <div style="margin-top: 8px; font-size: 9.5px; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 6px;">
        <strong>Instruções & Envio de Comprovativos:</strong> Por favor indique obrigatoriamente a referência <strong>BR2-FRA</strong> no descritivo da sua transferência bancária para conciliação automática por IA. Envie o comprovativo para <strong>${buildingEmail}</strong> ou submeta-o diretamente na aplicação <strong>CondoManager AI (App / Portal do Condómino)</strong>.
      </div>
    </div>

    <!-- Signatures & Authenticity Footer -->
    <div class="footer-row">
      <div class="footer-left">
        Emitido via CondoManager AI • Documento nº ${reciboNumExt} • Autenticidade Digital Garantida
      </div>
      <div class="footer-right">
        <div class="footer-sign-title">A ADMINISTRAÇÃO DO CONDOMÍNIO</div>
        <div class="footer-sign-line"></div>
        <div class="footer-sign-name">Carlos Administrador - Administrador do Condomínio</div>
      </div>
    </div>
  </div>
</body>
</html>`;
    }

    const isCartaAr =
      doc.tipo.toLowerCase().includes("ar") ||
      doc.nome.toLowerCase().includes("carta_ar") ||
      doc.nome.toLowerCase().includes("aviso_rececao");

    if (isCartaAr) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.nome}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 20px; color: #0f172a; background: #f8fafc; line-height: 1.35; }
    .doc-sheet { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 24px; max-width: 820px; margin: 0 auto; box-shadow: 0 4px 14px rgba(0,0,0,0.06); position: relative; }
    .header-row { display: flex; justify-content: space-between; align-items: stretch; gap: 16px; margin-bottom: 16px; }
    .logo-dark-box { background: #0c1322; border-radius: 4px; padding: 8px 14px; display: inline-flex; align-items: center; gap: 10px; min-height: 52px; }
    .logo-dark-box img { height: 38px; object-fit: contain; }
    .badge-dark { background: #0b1426; color: #ffffff; border-radius: 2px; padding: 9px 16px; text-align: left; min-width: 300px; display: flex; flex-direction: column; justify-content: center; }
  </style>
</head>
<body>
  <div class="doc-sheet">
    <div class="header-row">
      <div class="logo-dark-box">
        <img src="/marca/20-Logotipo Horizontal com fundo.png" alt="CondoManager AI" />
      </div>
      <div class="badge-dark">
        <div style="font-size: 12px; font-weight: 900; color: #ffffff;">📮 CTT CORREIOS • AVISO DE RECEÇÃO (AR)</div>
        <div style="font-size: 10px; color: #cbd5e1; margin-top: 2px;">Registo CTT: RF 892 134 591 PT</div>
        <div style="font-size: 9.5px; color: #4ade80; font-weight: bold; margin-top: 2px;">✓ ENTREGUE & ASSINADO EM MÃO</div>
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 11px; margin-top: 14px;">
      <div style="background: #f8fafc; padding: 10px 12px; border-radius: 4px; border: 1px solid #e2e8f0;">
        <strong style="color: #0284c7; text-transform: uppercase; font-size: 9.5px; display: block; margin-bottom: 4px;">Remetente:</strong>
        Condomínio do Edifício ${predio?.nome || "Condomínio"}<br>
        ${predio?.morada_linha1 || ""} ${predio?.num_porta || ""}, ${predio?.localidade || ""}
      </div>
      <div style="background: #f8fafc; padding: 10px 12px; border-radius: 4px; border: 1px solid #e2e8f0;">
        <strong style="color: #0284c7; text-transform: uppercase; font-size: 9.5px; display: block; margin-bottom: 4px;">Destinatário / Requerido:</strong>
        Fração em Incumprimento / Devedor<br>
        Interpelação & Notificação Postal Plena
      </div>
    </div>
    <div style="margin-top: 14px; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; font-size: 10.5px; color: #991b1b;">
      <strong>Certificação Postal:</strong> Entregue ao destinatário em mão • Assinatura conferida nos termos do art. 228.º do CPC para instrução de prova documental.
    </div>
  </div>
</body>
</html>`;
    }

    const isPrintWhatsApp =
      doc.tipo.toLowerCase().includes("whatsapp") ||
      doc.nome.toLowerCase().includes("whatsapp") ||
      doc.descricao?.toLowerCase().includes("whatsapp");

    if (isPrintWhatsApp) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.nome}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 24px; color: #0f172a; background: #efeae2; line-height: 1.4; }
    .chat-container { max-width: 600px; margin: 0 auto; background: #efeae2; border-radius: 16px; overflow: hidden; border: 1px solid #d1d5db; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .chat-header { background: #075e54; color: #fff; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .chat-body { padding: 16px; min-height: 280px; display: flex; flex-direction: column; gap: 12px; }
    .msg-out { align-self: flex-end; background: #d9fdd3; padding: 8px 12px; border-radius: 8px 0 8px 8px; max-width: 80%; font-size: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
    .msg-in { align-self: flex-start; background: #ffffff; padding: 8px 12px; border-radius: 0 8px 8px 8px; max-width: 80%; font-size: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
    .time { font-size: 9px; color: #667781; text-align: right; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="chat-container">
    <div class="chat-header">
      <div>
        <div style="font-weight: bold; font-size: 13px;">💬 Condómino Fração A (+351 912 345 678)</div>
        <div style="font-size: 10px; color: #a3e635;">online • Registo de Prova Digital</div>
      </div>
      <div style="font-size: 10px; background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 6px;">Autenticado</div>
    </div>
    <div class="chat-body">
      <div class="msg-out">
        Exmo.(a) Condómino(a), relembramos que a quota de condomínio referente a este mês se encontra pendente. Agradecemos a regularização.
        <div class="time">10:14 ✓✓</div>
      </div>
      <div class="msg-in">
        Bom dia. Já efetuei a transferência esta manhã e envio o comprovativo em anexo. Cumprimentos.
        <div class="time">11:30</div>
      </div>
      <div class="msg-out">
        Confirmamos a boa receção. O recibo oficial já foi emitido e arquivado no sistema. Obrigado!
        <div class="time">11:45 ✓✓</div>
      </div>
    </div>
  </div>
</body>
</html>`;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.nome}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 20px; color: #0f172a; background: #f8fafc; line-height: 1.4; }
    .doc-sheet { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 24px; max-width: 820px; margin: 0 auto; box-shadow: 0 4px 14px rgba(0,0,0,0.06); position: relative; overflow: hidden; }
    .watermark-bg { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 320px; opacity: 0.05; pointer-events: none; z-index: 0; }
    .header-row { display: flex; justify-content: space-between; align-items: stretch; gap: 16px; margin-bottom: 16px; position: relative; z-index: 1; }
    .logo-dark-box { background: #0c1322; border-radius: 4px; padding: 8px 14px; display: inline-flex; align-items: center; gap: 10px; min-height: 52px; }
    .logo-dark-box img { height: 38px; object-fit: contain; }
    .badge-dark { background: #0b1426; color: #ffffff; border-radius: 2px; padding: 9px 16px; text-align: left; min-width: 300px; display: flex; flex-direction: column; justify-content: center; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; position: relative; z-index: 1; }
    .meta-table td { padding: 6px 10px; border: 1px solid #e2e8f0; }
    .content-box { background: #ffffff; border: 1px solid #cbd5e1; padding: 16px; border-radius: 4px; min-height: 160px; font-size: 11.5px; position: relative; z-index: 1; }
    .seal { text-align: center; margin-top: 24px; padding-top: 14px; border-top: 1px dashed #cbd5e1; color: #334155; font-weight: bold; font-size: 10px; position: relative; z-index: 1; }
  </style>
</head>
<body>
  <div class="doc-sheet">
    <img src="/marca/19-marca-dagua-logo-cinza-claro.png" class="watermark-bg" alt="Watermark" />
    <div class="header-row">
      <div class="logo-dark-box">
        <img src="/marca/20-Logotipo Horizontal com fundo.png" alt="CondoManager AI" />
      </div>
      <div class="badge-dark">
        <div style="font-size: 12px; font-weight: 900; color: #ffffff; text-transform: uppercase;">DOCUMENTO OFICIAL REGISTADO</div>
        <div style="font-size: 10px; color: #cbd5e1; margin-top: 2px;">Categoria: ${doc.categoria || 'Arquivo Digital'}</div>
        <div style="font-size: 9.5px; color: #94a3b8; margin-top: 2px;">ID: ${doc.id_doc}</div>
      </div>
    </div>

    <table class="meta-table">
      <tr>
        <td style="background:#f8fafc;"><strong>Nome do Ficheiro:</strong> ${doc.nome}</td>
        <td style="background:#f8fafc;"><strong>Data de Upload:</strong> ${doc.data_upload}</td>
      </tr>
      <tr>
        <td><strong>Categoria / Tema:</strong> ${doc.categoria} • ${doc.tema || 'Geral'}</td>
        <td><strong>Tamanho:</strong> ${doc.tamanho}</td>
      </tr>
      <tr>
        <td><strong>Sub-pasta:</strong> ${doc.sub_pasta || doc.fornecedor || 'Geral'}</td>
        <td><strong>Visibilidade:</strong> ${doc.visibilidade}</td>
      </tr>
      <tr>
        <td colspan="2"><strong>Autor / Registado por:</strong> ${doc.autor || 'Administração'}</td>
      </tr>
    </table>

    <div class="content-box">
      <h3 style="margin-top:0; color:#0f172a; font-size:12.5px;">Resumo & Descritivo Oficial do Documento</h3>
      <p style="color:#334155; margin:0 0 10px 0;">${doc.descricao || "Ficheiro oficial autenticado e armazenado no Arquivo Digital do Condomínio."}</p>
      <p style="color:#64748b; font-style:italic; font-size:10.5px; margin:0;">Este documento constitui um registo digital autêntico referente ao edifício ${predio.nome}, certificado pelo sistema CondoManager AI.</p>
    </div>

    <div class="seal">
      ✓ CONDOMANAGER AI • DOCUMENTO CERTIFICADO E ARQUIVADO<br>
      <span style="font-size:9px; color:#64748b; font-weight:normal;">Registo Inalterável no Servidor • Emissão: ${new Date().toLocaleDateString('pt-PT')}</span>
    </div>
  </div>
</body>
</html>`;
  };

  // Handlers for exporting DOC and PDF files
  const handleDownloadDoc = (doc: Documento) => {
    const contentHtml = generateDocumentHtml(doc);
    const blob = new Blob(['\ufeff', contentHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.nome.replace(/\.pdf$/i, '') + '.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = (docItem: Documento) => {
    try {
      const isRecibo = 
        docItem.tipo.toLowerCase().includes("recibo") ||
        (docItem.categoria && docItem.categoria.toLowerCase().includes("recibo")) ||
        docItem.nome.toLowerCase().includes("recibo") ||
        docItem.sub_pasta === "Recibos" ||
        docItem.sub_pasta === "Recibos Quotas extra";

      if (isRecibo) {
        const isExtra = docItem.tipo.toLowerCase().includes("extra") || docItem.nome.toLowerCase().includes("extra") || docItem.sub_pasta?.includes("extra");
        const reciboNum = "BR2 00195";

        downloadReceiptPDF({
          reciboNum: reciboNum,
          dataPagamento: "30-07-2026",
          movimentoQuotaMensal: !isExtra ? `MOV-2026-QM-${reciboNum}` : undefined,
          movimentoFundoReserva: !isExtra ? `MOV-2026-FR-${reciboNum}` : undefined,
          movimentoQuotaExtra: isExtra ? `MOV-2026-QE-${reciboNum}` : undefined,
          buildingName: predio.nome || "EDIFÍCIO ESTRELA DA BARRA",
          buildingAddress: `${predio.morada_linha1 || "Rua Bento Rodrigues"} ${predio.num_porta || "2"}, ${predio.localidade || "Seixal"}`,
          buildingNif: predio.nif || "900123456",
          proprietarioNome: "Ana Silva",
          proprietarioNif: "221230475",
          fracaoIdent: "Fração A (R/C Esq)",
          metodoPagamento: "Transferência Bancária",
          quotaMensalVal: !isExtra ? 32.14 : 0,
          fundoReservaVal: !isExtra ? 3.21 : 0,
          quotaExtraVal: isExtra ? 120.00 : 0,
          isQuotaExtra: isExtra,
          descricaoQuota: !isExtra ? "Quota Ordinária de Julho 2026" : "Quota Extraordinária de Obras e Conservação",
          adminNome: "Carlos Administrador - Administrador do Condomínio",
          adminSignatureBase64: localStorage.getItem("admin_signature_digital") || undefined
        }, docItem.nome);
        return;
      }

      const isNotaCobranca =
        docItem.tipo.toLowerCase().includes("cobrança") ||
        docItem.tipo.toLowerCase().includes("cobranca") ||
        (docItem.categoria && docItem.categoria.toLowerCase().includes("cobrança")) ||
        docItem.nome.toLowerCase().includes("cobranca") ||
        docItem.nome.toLowerCase().includes("aviso_cobranca");

      if (isNotaCobranca) {
        const reciboNum = "BR2 00195";
        downloadNotaCobrancaPDF({
          reciboNum: reciboNum,
          dataEmissao: docItem.data_upload || "30-07-2026",
          dataLimite: "08-08-2026",
          movimentoQuotaMensal: `MOV-2026-QM-${reciboNum}`,
          movimentoFundoReserva: `MOV-2026-FR-${reciboNum}`,
          buildingName: predio.nome || "EDIFÍCIO ESTRELA DA BARRA",
          buildingAddress: `${predio.morada_linha1 || "Rua Bento Rodrigues"} ${predio.num_porta || "2"}, ${predio.localidade || "Seixal"}`,
          buildingNif: predio.nif || "900123456",
          buildingIban: predio.iban || "PT50 0033 0000 12345678901 02",
          buildingEmail: predio.email_condominio || "condominio.estrela.barra@condomanager.ai",
          proprietarioNome: "Ana Silva",
          proprietarioNif: "221230475",
          fracaoIdent: "Fração A (R/C Esq)",
          referenciaFracao: "BR2-FRA-A",
          quotaMensalVal: 32.14,
          fundoReservaVal: 3.21,
          adminNome: "Carlos Administrador - Administrador do Condomínio",
          adminSignatureBase64: localStorage.getItem("admin_signature_digital") || undefined
        }, docItem.nome);
        return;
      }

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const isManualSintetizado = docItem.id_doc === "doc-manual-4" || docItem.nome.includes("Sintetizado");
      const isManualPerfis = docItem.id_doc === "doc-manual-1" || docItem.nome.includes("Perfis");
      const isManualPwa = docItem.id_doc === "doc-manual-2" || docItem.nome.includes("PWA");
      const isManualDesktop = docItem.id_doc === "doc-manual-3" || docItem.nome.includes("Desktop");

      // Header Logo (centered, no background bars)
      let y = addPdfHeaderWithLogo(pdf);
      pdf.setTextColor(15, 23, 42); // Slate 900

      // Document Title & Metadata
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      const titleLines = pdf.splitTextToSize(docItem.nome, 180);
      pdf.text(titleLines, 14, y);
      y += (titleLines.length * 6) + 4;

      pdf.setFillColor(241, 245, 249); // Slate 100
      pdf.rect(14, y, 182, 28, "F");
      pdf.setDrawColor(203, 213, 225);
      pdf.rect(14, y, 182, 28, "S");

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(`Condomínio: ${predio.nome}`, 18, y + 6);
      pdf.text(`ID Documento: ${docItem.id_doc} | Data Upload: ${docItem.data_upload}`, 18, y + 12);
      pdf.text(`Categoria: ${docItem.categoria} | Tema: ${docItem.tema || 'Geral'}`, 18, y + 18);
      pdf.text(`Sub-pasta / Fornecedor: ${docItem.sub_pasta || docItem.fornecedor || 'Geral'}`, 18, y + 24);

      y += 34;

      // Content depending on manual type or standard document
      if (isManualSintetizado) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(4, 120, 87);
        pdf.text("1. MAPEAMENTO DE TODOS OS MENUS E SUB-MENUS SISTÉMICOS", 14, y);
        y += 7;

        const sintetizadoMenus = [
          "• Prédio & Frações: Ficha do Edifício, Permilagens, Proprietários/Inquilinos, Regulamento e Convites PWA.",
          "• Finanças & Quotas: Saldos, Movimentos, Contas Bancárias, Emissão de Quotas, Referências MB WAY e Multibanco, Fundo Reserva.",
          "• Motor de IA Conciliação: Reconciliação Bancária IA, Extrator OCR de Comprovativos, Regras e Disquete de Arquivo IA.",
          "• Assembleias & Legal: Agendamento, Convocatória IA (Art. 1414º a 1438º C.C.), Sondagem de Presenças 'Vem/Não vem', Redação de Atas IA, Assinatura Tátil e Vídeo-Conferência.",
          "• Contencioso Jurídico: Gestão de Inadimplência, Notificações Registadas, Pré-Contencioso, Juros de Mora e Certidão de Dívida.",
          "• Auditoria Interna: Balancete Contabilístico, Centros de Custos, Audit Log de Alterações e Conformidade Fiscal.",
          "• Agenda & Reservas: Calendário Espaços Comuns (Churrasqueira, Salão de Festas, Ginásio), Aprovação e Cauções.",
          "• Ocorrências & Avarias: Registo de Defeitos, Encaminhamento a Piquetes Técnicos, Acompanhamento e Captação de Fotos WebP.",
          "• Fornecedores & Obras: Fichas de Prestadores, Contratos de Manutenção, Controlo de Prazos/Garantias e Orçamentos.",
          "• Arquivo Digital: Pastas Inteligentes (Anos, Temas, Fornecedores), Leitor de PDF/Imagens e Instruções PWA/Desktop.",
          "• PWA Móvel & Floating FAB: Botão Flutuante, Gravação de Mensagens de Áudio, Fotos WebP, Biometria, Painel Piquetes e Limpezas."
        ];

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(15, 23, 42);

        for (const m of sintetizadoMenus) {
          if (y > 270) { pdf.addPage(); y = 20; }
          const lines = pdf.splitTextToSize(m, 180);
          pdf.text(lines, 14, y);
          y += (lines.length * 4) + 2;
        }

        y += 4;
        if (y > 270) { pdf.addPage(); y = 20; }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(4, 120, 87);
        pdf.text("2. FUNÇÕES EXCLUSIVAS DA INTELIGENCIA ARTIFICIAL (CONDOMANAGER AI)", 14, y);
        y += 7;

        const aiFunctions = [
          "• Elaboração Inteligente de Convocatórias e Ordens de Trabalho em conformidade com o Código Civil.",
          "• Redação e Transcrição Automática de Atas Oficiais de Assembleia com registo de votações por permilagem.",
          "• Reconciliação Bancária por IA com leitura ótica de extratos bancários (OFX/CSV/PDF) e comprovativos.",
          "• Sondagem Automática de Presenças 'Vem/Não vem' enviada para WhatsApp e PWA com registo de leitura.",
          "• Classificação Inteligente de Ficheiros no Arquivo Digital (Disquete IA) por tema, ano e fornecedor.",
          "• Assistente Virtual Legal e Regulamentar para esclarecimento imediato de dúvidas do regime do condomínio."
        ];

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(15, 23, 42);

        for (const ai of aiFunctions) {
          if (y > 270) { pdf.addPage(); y = 20; }
          const lines = pdf.splitTextToSize(ai, 180);
          pdf.text(lines, 14, y);
          y += (lines.length * 4) + 2;
        }

        y += 4;
        if (y > 270) { pdf.addPage(); y = 20; }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(4, 120, 87);
        pdf.text("3. RECONHECIMENTO DE DOCUMENTOS, MULTIMÉDIA & TECNOLOGIAS PWA", 14, y);
        y += 7;

        const ocrFunctions = [
          "• Leitura Ótica OCR (Optical Character Recognition): Extração de NIF, Valor Total, IVA, Data e IBAN em faturas/recibos.",
          "• Captação de Foto WebP na Câmara: Compressão em tempo real de fotografias da câmara para formato WebP (redução até 85%).",
          "• Gravador de Mensagens de Áudio no FAB/Chat: Envio de notas de voz no telemóvel com player e temporizador.",
          "• Assinatura Tátil Digital: Recolha de assinaturas no ecrã de smartphones para atas e avisos.",
          "• Autenticação Biométrica: Suporte para FaceID / Fingerprint na PWA do condómino.",
          "• Integração Multibanco e MB WAY: Emissão instantânea de referências de pagamento."
        ];

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(15, 23, 42);

        for (const ocr of ocrFunctions) {
          if (y > 270) { pdf.addPage(); y = 20; }
          const lines = pdf.splitTextToSize(ocr, 180);
          pdf.text(lines, 14, y);
          y += (lines.length * 4) + 2;
        }

        y += 4;
        if (y > 270) { pdf.addPage(); y = 20; }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(4, 120, 87);
        pdf.text("4. MAPEAMENTO DE FUNCIONALIDADES POR PERFIL DE UTILIZADOR", 14, y);
        y += 7;

        const profilesMapping = [
          "• Administrador / Empresa Gestora: Gestão financeira, emissão de quotas, assembleias, conciliação IA e arquivo.",
          "• Condómino (PWA Móvel): Pagamento MB WAY, voto em sondagens, assinatura de atas, reserva de espaços e chat com voz/fotos WebP.",
          "• Técnico de Piquete / Manutenção: Consulta de ordens de trabalho, relatórios operacionais e envio de fotos WebP.",
          "• Equipa de Limpeza: Check-in/Check-out de higienização do prédio e reporte de necessidades de material.",
          "• Contabilista / Auditor / Jurídico: Leitura de balancetes, mapa do fundo de reserva e certidões de dívida para contencioso."
        ];

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(15, 23, 42);

        for (const prof of profilesMapping) {
          if (y > 270) { pdf.addPage(); y = 20; }
          const lines = pdf.splitTextToSize(prof, 180);
          pdf.text(lines, 14, y);
          y += (lines.length * 4) + 2;
        }

      } else if (isManualPerfis) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(4, 120, 87);
        pdf.text("1. ESTRUTURA DE MENUS E SUB-MENUS INTEGRADOS", 14, y);
        y += 7;

        const menus = [
          "1. Prédio & Frações: Gestão do Prédio, Regras, Frações & Residentes, Inquilinos, Regulamento.",
          "2. Finanças & Contas: Saldos, Movimentos, Contas Bancárias, Quotas & MB WAY, Fundo de Reserva, Conciliação IA.",
          "3. Manutenção & Obras: Ocorrências, Avarias, Agenda Técnica, Obras Extraordinárias, Vistorias & Limpeza.",
          "4. Arquivo Digital: Instruções PWA & Desktop, Anos, Temas, Fornecedor, Auditoria Interna & Relatórios.",
          "5. Assembleias & Legal: Organização de Assembleias, Atas com IA, Assinatura Digital PWA, Contencioso & Litígios.",
          "6. Comunicação & IA: Alerta Push Geral, Avisos e Central de Inteligência Artificial Avançada.",
          "7. Fornecedores & Orçamentos: Fichas de Fornecedores, Contratos de Manutenção e Portal de Orçamentos.",
          "8. Aprovações & Agenda: Aprovação de Reservas de Espaços Comuns e Validação de Recibos.",
          "9. Empresa Gestora & Parâmetros: White-Label, Configurações Gerais, Configurações de IA e Logs de Auditoria."
        ];

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(15, 23, 42);

        for (const m of menus) {
          if (y > 270) { pdf.addPage(); y = 20; }
          const lines = pdf.splitTextToSize(m, 180);
          pdf.text(lines, 14, y);
          y += (lines.length * 4) + 2;
        }

        y += 4;
        if (y > 270) { pdf.addPage(); y = 20; }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(4, 120, 87);
        pdf.text("2. MATRIZ DE PERFIS DE UTILIZADOR", 14, y);
        y += 7;

        const perfis = [
          "• Administrador / Empresa Gestora: Acesso Total (Leitura, Escrita, Eliminação, Aprovação, White-label).",
          "• Condómino / Inquilino: Acesso Restrito às suas frações, quotas, MB WAY, atas públicas e assinatura tátil.",
          "• Técnico de Manutenção: Vistorias técnicas, checklists de equipamentos, reporte e registo de avarias.",
          "• Equipa de Limpezas: Folha digital de limpeza, vistoria de áreas comuns e anomalias.",
          "• Apoio Jurídico: Contencioso, devedores, minutas de atas, pareceres e regulamento interno.",
          "• Auditor Externo: Leitura financeira integral, conciliação bancária, pareceres oficiais.",
          "• Contabilista: Operação de contas bancárias, lançamentos de despesas/faturas e recibos."
        ];

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(15, 23, 42);

        for (const p of perfis) {
          if (y > 270) { pdf.addPage(); y = 20; }
          const lines = pdf.splitTextToSize(p, 180);
          pdf.text(lines, 14, y);
          y += (lines.length * 4) + 2;
        }

      } else if (isManualPwa) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(4, 120, 87);
        pdf.text("1. GUIA DE INSTALAÇÃO PWA (iOS & ANDROID)", 14, y);
        y += 7;

        const steps = [
          "• iOS (Safari): Toque em Partilhar (ícone quadrado com seta) -> 'Adicionar ao Ecrã Principal'.",
          "• Android (Chrome): Toque no aviso 'Instalar CondoManager' ou no menu -> 'Adicionar ao Ecrã Principal'.",
          "• Funcionalidades PWA:",
          "  - Pagamentos instantâneos MB WAY e Multibanco com emissão automática de recibo.",
          "  - Assinatura digital de Atas em quadro tátil diretamente no ecrã do telemóvel.",
          "  - Reporte de avarias com fotografia de alta definição (WebP).",
          "  - Reserva de espaços comuns (Salão de Festas, Churrasqueira).",
          "  - Notificações Web Push em tempo real para telemóveis."
        ];

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(15, 23, 42);

        for (const st of steps) {
          if (y > 270) { pdf.addPage(); y = 20; }
          const lines = pdf.splitTextToSize(st, 180);
          pdf.text(lines, 14, y);
          y += (lines.length * 4.5) + 2;
        }

      } else if (isManualDesktop) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(4, 120, 87);
        pdf.text("1. NAVEGAÇÃO EM BROWSER DESKTOP", 14, y);
        y += 7;

        const desktopInfo = [
          "• Estrutura de Três Colunas:",
          "  - Coluna Esquerda: Seleção de prédio, gestão de perfis e simulador.",
          "  - Coluna Central: Os 9 menus operacionais e sub-menus com badges dinâmicos.",
          "  - Coluna Direita: Painel de trabalho com gráficos Recharts, tabelas e relatórios.",
          "• Recursos Avançados:",
          "  - Conciliação Bancária com Inteligência Artificial.",
          "  - Leitura OCR de Faturas com extração de NIF e data.",
          "  - Organização por pastas de fornecedores e arquivo histórico."
        ];

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(15, 23, 42);

        for (const info of desktopInfo) {
          if (y > 270) { pdf.addPage(); y = 20; }
          const lines = pdf.splitTextToSize(info, 180);
          pdf.text(lines, 14, y);
          y += (lines.length * 4.5) + 2;
        }

      } else {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(4, 120, 87);
        pdf.text("CONTEÚDO E DESCRICIONAL DO DOCUMENTO", 14, y);
        y += 7;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.5);
        pdf.setTextColor(15, 23, 42);
        const descText = docItem.descricao || "Ficheiro oficial registado e armazenado no Arquivo Digital do Condomínio.";
        const descLines = pdf.splitTextToSize(descText, 180);
        pdf.text(descLines, 14, y);
        y += (descLines.length * 5) + 8;

        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(8.5);
        pdf.setTextColor(71, 85, 105);
        pdf.text(`Registado por: ${docItem.autor || "Administração"} | Visibilidade: ${docItem.visibilidade}`, 14, y);
        y += 5;
        pdf.text(`Este documento faz parte integrante do arquivo digital do edifício ${predio.nome}.`, 14, y);
        y += 12;
      }

      // Footer Seal
      if (y > 265) { pdf.addPage(); y = 20; }
      pdf.setDrawColor(4, 120, 87);
      pdf.line(14, y, 196, y);
      y += 5;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(4, 120, 87);
      pdf.text("CONDOMANAGER AI - REGISTO CERTIFICADO E AUTENTICADO EM PDF", 105, y, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Emissão em: ${new Date().toLocaleDateString('pt-PT')} | Compatível com Adobe Acrobat Reader`, 105, y + 4, { align: "center" });

      const fileName = docItem.nome.endsWith(".pdf") ? docItem.nome : `${docItem.nome}.pdf`;
      const blob = pdf.output("blob");
      downloadBlob(blob, fileName);
    } catch (err) {
      console.error("Erro ao gerar PDF com jsPDF:", err);
    }

    // Also open PDF Viewer modal for in-app preview
    setActivePdfViewerDoc(docItem);
  };

  // Manual Upload Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [novoTipoArquivo, setNovoTipoArquivo] = useState<"documento" | "fotografia">("documento");
  const [novoNome, setNovoNome] = useState("");
  const [novoAno, setNovoAno] = useState("2026");
  const [novoTema, setNovoTema] = useState("Atas & Convocatórias");
  const [novaSubPasta, setNovaSubPasta] = useState("Empresa Gestora");
  const [novaCategoria, setNovaCategoria] = useState("Oficial");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novaVisibilidade, setNovaVisibilidade] = useState<"Público" | "Administração">("Público");
  const [novaFotoUrl, setNovaFotoUrl] = useState("");

  // AI Disquete Archiving Confirmation Modal
  const [archiveTargetDoc, setArchiveTargetDoc] = useState<Documento | null>(null);
  const [targetAno, setTargetAno] = useState<string>("2026");
  const [targetTema, setTargetTema] = useState<string>("Faturas & Recibos");
  const [targetSubPasta, setTargetSubPasta] = useState<string>("OTIS Elevadores");
  const [targetFornecedor, setTargetFornecedor] = useState<string>("OTIS Elevadores");

  // AI Classification Status
  const [aiClassifying, setAiClassifying] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // Email Delivery Modal State
  const [emailModalDoc, setEmailModalDoc] = useState<Documento | null>(null);
  const [emailDestinatario, setEmailDestinatario] = useState<string>("");
  const [emailAssunto, setEmailAssunto] = useState<string>("");
  const [emailMensagem, setEmailMensagem] = useState<string>("");
  const [emailEnviarCopiaAdmin, setEmailEnviarCopiaAdmin] = useState<boolean>(true);

  const abrirModalEnviarEmail = (doc: Documento) => {
    setEmailModalDoc(doc);
    setEmailDestinatario(predio.email_condominio || "jcafguerra@hotmail.com");
    setEmailAssunto(`[CondoManager • ${predio.nome || "Edifício"}] ${doc.nome}`);
    setEmailMensagem(`Exmo.(a) Sr.(a),\n\nSegue em anexo para os devidos efeitos o documento oficial "${doc.nome}" (${doc.tipo || "Documento"}), referente ao condomínio ${predio.nome || "Edifício"}.\n\nDocumento autenticado e emitido via plataforma CondoManager AI.\n\nCom os melhores cumprimentos,\nA Administração`);
  };

  const confirmarEnvioEmail = () => {
    if (!emailModalDoc || !emailDestinatario.trim()) return;
    const docNome = emailModalDoc.nome;
    const dest = emailDestinatario.trim();
    setEmailModalDoc(null);
    triggerSendReaction("email", `A enviar "${docNome}" para ${dest}...`);
  };

  // Available Filter Options
  const disponiveisAnos = ["Todos", "2026", "2025", "2024", "2023"];

  const temasDocumentos = [
    "Todos",
    "Pasta Paga. Quotas",
    "Instruções PWA & Desktop",
    "Atas & Convocatórias",
    "Faturas & Recibos",
    "Seguros & Apólices",
    "Relatórios & Auditorias",
    "Regulamentos & Legal",
    "Obras & Reparações"
  ];

  const temasFotografias = [
    "Todos",
    "Vistorias Técnicas",
    "Obras & Reparações",
    "Avarias Reportadas",
    "Higienização & Limpezas",
    "Património do Edifício"
  ];

  const fornecedoresSubPastas = [
    "Todos",
    "Pasta Paga. Quotas",
    "Instruções PWA & Desktop",
    "OTIS Elevadores",
    "Allianz Seguros",
    "Cleandom Higienização",
    "EDP Comercial",
    "Empresa Gestora",
    "Fórmula & Método Eng.",
    "Frações & Residentes",
    "Dr. António Auditor",
    "Dra. Margarida Jurídico"
  ];

  // Base list of documents for building (includes global manuals so they never disappear)
  const predioDocsRaw = useMemo(() => {
    return documentos.filter(d => 
      d.id_predio === predio?.id_predio || 
      d.id_predio === "global" ||
      d.categoria === "Manuais & Guias Operacionais" ||
      d.sub_pasta === "Manuais & Guias Operacionais" ||
      d.categoria === "Instruções PWA & Desktop" ||
      d.sub_pasta === "Instruções PWA & Desktop" ||
      d.tipo === "Manual Ilustrado" ||
      d.tipo === "Guia Rápido"
    );
  }, [documentos, predio?.id_predio]);

  // Profile-based access filtering
  const predioDocsWithProfileAccess = useMemo(() => {
    return predioDocsRaw.filter(d => {
      if (["ADMIN", "EMPRESA_GESTORA", "USER"].includes(loggedUser.role)) {
        if (loggedUser.role === "USER" && d.visibilidade === "Administração") {
          return false;
        }
        return true;
      }

      if (d.relevancia_perfis && d.relevancia_perfis.length > 0) {
        if (d.relevancia_perfis.includes(loggedUser.role)) return true;
      }

      if (loggedUser.role === "TECNICO") {
        return ["Vistorias Técnicas", "Obras & Reparações", "Avarias Reportadas", "Manutenção & Obras", "Assistências"].includes(d.tema || "") || 
               ["Vistorias Técnicas", "Obras & Reparações", "Avarias Reportadas"].includes(d.categoria || "");
      }
      if (loggedUser.role === "LIMPEZAS") {
        return ["Higienização & Limpezas", "Serviços"].includes(d.tema || "") || 
               ["Higienização & Limpezas"].includes(d.categoria || "");
      }
      if (loggedUser.role === "JURIDICO") {
        return ["Regulamentos & Legal", "Atas & Convocatórias", "Regulamentação", "Atas"].includes(d.tema || "") ||
               ["Regulamentos", "Atas"].includes(d.categoria || "");
      }
      if (loggedUser.role === "AUDITOR") {
        return ["Relatórios & Auditorias", "Relatórios de contas"].includes(d.tema || "") ||
               ["Relatórios de contas"].includes(d.categoria || "");
      }
      if (loggedUser.role === "CONTABILISTA") {
        return ["Faturas & Recibos", "Financeiro & Orçamental", "Seguros & Apólices"].includes(d.tema || "") ||
               ["Orçamentos", "Reparações", "Relatórios de contas"].includes(d.categoria || "");
      }

      return true;
    });
  }, [predioDocsRaw, loggedUser.role]);

  // Filter by active Tab (Documentos vs Fotografias)
  const docsDoTipo = useMemo(() => {
    return predioDocsWithProfileAccess.filter(d => {
      if (activeTab === "fotografias") {
        return d.tipo_arquivo === "fotografia" || d.tipo === "Fotografia" || !!d.url_foto;
      } else {
        return d.tipo_arquivo !== "fotografia" && d.tipo !== "Fotografia" && !d.url_foto;
      }
    });
  }, [predioDocsWithProfileAccess, activeTab]);

  // Apply single dynamic filter bar criteria
  const docsFiltrados = useMemo(() => {
    return docsDoTipo.filter(d => {
      const termoBusca = busca.trim().toLowerCase();
      const matchesSearch = !termoBusca || 
                            d.nome.toLowerCase().includes(termoBusca) || 
                            (d.descricao && d.descricao.toLowerCase().includes(termoBusca)) ||
                            (d.fornecedor && d.fornecedor.toLowerCase().includes(termoBusca)) ||
                            (d.sub_pasta && d.sub_pasta.toLowerCase().includes(termoBusca));

      const matchesAno = filtroAno === "Todos" || d.ano === filtroAno;
      const matchesTema = filtroTema === "Todos" || d.tema === filtroTema || d.categoria === filtroTema;
      const matchesVis = filtroVisibilidade === "Todos" || d.visibilidade === filtroVisibilidade;

      const matchesFornecedor = filtroFornecedor === "Todos" || 
        d.sub_pasta === filtroFornecedor || 
        d.fornecedor === filtroFornecedor ||
        d.nome.toLowerCase().includes(filtroFornecedor.toLowerCase()) ||
        (d.descricao && d.descricao.toLowerCase().includes(filtroFornecedor.toLowerCase()));

      const isPastaPagaDoc = (doc: Documento) => 
        !doc.sub_pasta?.startsWith("⚖️ Processos Jurídicos") &&
        (doc.categoria === "Pasta Paga. Quotas" || 
         doc.tema === "Pasta Paga. Quotas" || 
         doc.sub_pasta === "Recibos e Quotas" ||
         ["Recibos", "Recibos Quotas extra", "Notas de cobrança"].includes(doc.sub_pasta || "") ||
         ["Recibo", "Recibo Quotas extra", "Nota de Cobrança"].includes(doc.tipo || ""));

      const isManualDoc = (doc: Documento) =>
        doc.tipo === "Manual Ilustrado" ||
        doc.tipo === "Guia Rápido" ||
        doc.categoria === "Instruções PWA & Desktop" ||
        doc.sub_pasta === "Manuais & Guias Operacionais" ||
        doc.sub_pasta === "05. Manuais & Guias Operacionais" ||
        doc.sub_pasta === "Instruções PWA & Desktop";

      const matchesFolder = !selectedFolder || 
        ((selectedFolder === "Pasta Paga. Quotas" || selectedFolder === "Recibos e Quotas") ? isPastaPagaDoc(d) : (
          selectedFolder === "Manuais & Guias Operacionais" ? isManualDoc(d) : (
            d.sub_pasta === selectedFolder || 
            d.fornecedor === selectedFolder || 
            d.tema === selectedFolder ||
            d.categoria === selectedFolder
          )
        ));

      const matchesSubFolder = !selectedSubPasta || d.sub_pasta === selectedSubPasta;

      return matchesSearch && matchesAno && matchesTema && matchesVis && matchesFornecedor && matchesFolder && matchesSubFolder;
    });
  }, [docsDoTipo, busca, filtroAno, filtroTema, filtroFornecedor, filtroVisibilidade, selectedFolder, selectedSubPasta]);

  // Check if any filters are active
  const hasActiveFilters = busca !== "" || filtroAno !== "Todos" || filtroTema !== "Todos" || filtroFornecedor !== "Todos" || filtroVisibilidade !== "Todos" || selectedFolder !== null || selectedSubPasta !== null;

  const resetAllFilters = () => {
    setBusca("");
    setFiltroAno("Todos");
    setFiltroTema("Todos");
    setFiltroFornecedor("Todos");
    setFiltroVisibilidade("Todos");
    setSelectedFolder(null);
    setSelectedSubPasta(null);
  };

  // Pre-configured standard empty folders in Arquivo Digital
  const PRECONFIGURED_FOLDERS = [
    "Recibos e Quotas",
    "Faturas Diversas",
    "Fornecedores & Contratos",
    "Atas & Convocatórias",
    "Seguros & Apólices",
    "Manuais & Guias Operacionais",
    "Obras & Vistorias Técnicas"
  ];

  // Group items by Fornecedor / Sub-Pasta for folder cards
  const folderGroups = useMemo(() => {
    const groups: { [key: string]: Documento[] } = {};

    // 1. Initialize pre-configured standard folders so they exist even if empty
    PRECONFIGURED_FOLDERS.forEach(folder => {
      groups[folder] = [];
    });

    // 2. Distribute existing documents into folders
    docsDoTipo.forEach(doc => {
      const isPastaPaga = (
        !doc.sub_pasta?.startsWith("⚖️ Processos Jurídicos") &&
        (doc.categoria === "Pasta Paga. Quotas" || 
         doc.tema === "Pasta Paga. Quotas" ||
         doc.sub_pasta === "Recibos e Quotas" ||
         ["Recibos", "Recibos Quotas extra", "Notas de cobrança"].includes(doc.sub_pasta || "") ||
         ["Recibo", "Recibo Quotas extra", "Nota de Cobrança"].includes(doc.tipo || ""))
      );

      const isManual = (
        doc.tipo === "Manual Ilustrado" ||
        doc.tipo === "Guia Rápido" ||
        doc.categoria === "Instruções PWA & Desktop" ||
        doc.sub_pasta === "Manuais & Guias Operacionais" ||
        doc.sub_pasta === "05. Manuais & Guias Operacionais" ||
        doc.sub_pasta === "Instruções PWA & Desktop"
      );

      let folderName: string;
      if (isPastaPaga) {
        folderName = "Recibos e Quotas";
      } else if (isManual) {
        folderName = "Manuais & Guias Operacionais";
      } else {
        folderName = doc.sub_pasta || doc.fornecedor || doc.tema || "Faturas Diversas";
      }

      if (!groups[folderName]) {
        groups[folderName] = [];
      }
      groups[folderName].push(doc);
    });
    return groups;
  }, [docsDoTipo]);

  // Open Floppy Disk AI Archiving Confirmation Modal
  const abrirModalArquivamentoIA = (doc: Documento) => {
    setArchiveTargetDoc(doc);
    
    const nomeLower = doc.nome.toLowerCase();
    const descLower = (doc.descricao || "").toLowerCase();

    let suggestedAno = doc.ano || "2026";
    let suggestedTema = doc.tema || (doc.tipo_arquivo === "fotografia" ? "Vistorias Técnicas" : "Faturas & Recibos");
    let suggestedSub = doc.sub_pasta || doc.fornecedor || "OTIS Elevadores";

    if (nomeLower.includes("otis") || descLower.includes("elevador")) {
      suggestedSub = "OTIS Elevadores";
      suggestedTema = "Faturas & Recibos";
    } else if (nomeLower.includes("allianz") || nomeLower.includes("apolice") || descLower.includes("seguro")) {
      suggestedSub = "Allianz Seguros";
      suggestedTema = "Seguros & Apólices";
    } else if (nomeLower.includes("clean") || descLower.includes("limpeza")) {
      suggestedSub = "Cleandom Higienização";
      suggestedTema = "Higienização & Limpezas";
    } else if (nomeLower.includes("edp") || descLower.includes("eletricidade")) {
      suggestedSub = "EDP Comercial";
      suggestedTema = "Faturas & Recibos";
    } else if (nomeLower.includes("ata") || nomeLower.includes("assembleia")) {
      suggestedSub = "Empresa Gestora";
      suggestedTema = "Atas & Convocatórias";
    } else if (nomeLower.includes("parecer") || nomeLower.includes("auditoria")) {
      suggestedSub = "Dr. António Auditor";
      suggestedTema = "Relatórios & Auditorias";
    } else if (nomeLower.includes("obra") || nomeLower.includes("infiltracao")) {
      suggestedSub = "Fórmula & Método Eng.";
      suggestedTema = "Obras & Reparações";
    }

    setTargetAno(suggestedAno);
    setTargetTema(suggestedTema);
    setTargetSubPasta(suggestedSub);
    setTargetFornecedor(suggestedSub);
  };

  // Confirm Floppy Disk AI Archiving
  const confirmarArquivamentoIA = () => {
    if (!archiveTargetDoc) return;

    if (setDocumentos) {
      setDocumentos(prev => prev.map(d => {
        if (d.id_doc === archiveTargetDoc.id_doc) {
          return {
            ...d,
            ano: targetAno,
            tema: targetTema,
            sub_pasta: targetSubPasta,
            fornecedor: targetFornecedor,
            arquivado: true,
            data_arquivamento: new Date().toISOString().split("T")[0]
          };
        }
        return d;
      }));
    }

    setAiMessage(`💾 Ficheiro "${archiveTargetDoc.nome}" arquivado com sucesso no repositório de ${targetAno} > ${targetTema} > ${targetSubPasta}!`);
    setArchiveTargetDoc(null);
  };

  // Handler for manual upload submission
  const submeterUploadManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome) {
      alert("Por favor indique o nome do ficheiro!");
      return;
    }

    const isFoto = novoTipoArquivo === "fotografia";
    const novoId = (isFoto ? "foto-" : "doc-") + (documentos.length + 100);

    const defaultPhotoUrl = novaFotoUrl || (isFoto 
      ? "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80" 
      : undefined);

    const novo: Documento = {
      id_doc: novoId,
      id_predio: predio.id_predio,
      nome: novoNome.endsWith(".pdf") || novoNome.endsWith(".jpg") ? novoNome : `${novoNome}.${isFoto ? "jpg" : "pdf"}`,
      tipo: isFoto ? "Fotografia" : novaCategoria,
      data_upload: new Date().toISOString().split("T")[0],
      tamanho: isFoto ? "2.5 MB" : "1.4 MB",
      categoria: novaCategoria,
      descricao: novaDescricao || "Ficheiro registado manualmente no Arquivo Digital.",
      visibilidade: novaVisibilidade,
      autor: `${loggedUser.nome} (${loggedUser.role})`,
      tema: novoTema,
      ano: novoAno,
      sub_pasta: novaSubPasta,
      fornecedor: novaSubPasta,
      arquivado: true,
      data_arquivamento: new Date().toISOString().split("T")[0],
      tipo_arquivo: novoTipoArquivo,
      url_foto: defaultPhotoUrl,
      relevancia_perfis: ["ADMIN", "EMPRESA_GESTORA", "USER", "TECNICO", "LIMPEZAS", "JURIDICO", "AUDITOR", "CONTABILISTA"]
    };

    onAddDocumento(novo);
    setShowUploadModal(false);
    setNovoNome("");
    setNovaDescricao("");
    setNovaFotoUrl("");
    setAiMessage(`💾 Ficheiro "${novo.nome}" arquivado com sucesso no repositório de ${novoAno} > ${novoTema} > ${novaSubPasta}!`);
  };

  // AI Auto-Classification Handler
  const executarClassificacaoIA = () => {
    setAiClassifying(true);
    setAiMessage(null);
    setTimeout(() => {
      setAiClassifying(false);
      setAiMessage(`🤖 IA concluiu a indexação dinâmica: ${docsDoTipo.length} registos organizados por Ano, Tema e Fornecedor com 100% de conformidade.`);
    }, 800);
  };

  // Delete document (Admin only)
  const eliminarDocumento = (docId: string) => {
    if (!["ADMIN", "EMPRESA_GESTORA"].includes(loggedUser.role)) return;
    if (!setDocumentos) return;

    if (confirm("Tem a certeza de que pretende eliminar este ficheiro permanentemente?")) {
      setDocumentos(prev => prev.filter(d => d.id_doc !== docId));
      alert("Ficheiro removido do Arquivo com sucesso.");
    }
  };

  // Toggle Visibility
  const alternarVisibilidade = (doc: Documento) => {
    if (!["ADMIN", "EMPRESA_GESTORA"].includes(loggedUser.role)) return;
    if (!setDocumentos) return;

    const novaVis = doc.visibilidade === "Administração" ? "Público" : "Administração";
    setDocumentos(prev => prev.map(d => d.id_doc === doc.id_doc ? { ...d, visibilidade: novaVis } : d));
  };

  return (
    <div className="space-y-4 bg-white p-4 rounded-3xl border border-emerald-100 shadow-sm">
      {/* CABEÇALHO DO ARQUIVO DIGITAL — VISUAL BRANCO COM BORDAS AI LUMINOSAS */}
      <div className="bg-white border-2 border-emerald-200 rounded-2xl p-5 shadow-sm text-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
          <FolderOpen className="h-40 w-40 text-emerald-600" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2 mb-1.5 flex-wrap">
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-xs">
                <FolderOpen className="h-3 w-3 text-emerald-600" /> Arquivo Digital PWA
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Bot className="h-3 w-3 text-emerald-600" /> Indexação Ativa por Fornecedor & IA
              </span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              📂 Arquivo de Documentos & Fotografias
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 max-w-xl leading-relaxed font-medium">
              Pesquisa dinâmica unificada por **Ano**, **Tema** e **Fornecedor** com arquivamento direto por IA.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                const docSint = documentos.find(d => d.id_doc === "doc-manual-4" || d.nome.includes("Sintetizado")) || {
                  id_doc: "doc-manual-4",
                  id_predio: predio.id_predio,
                  nome: "Guia_Sintetizado_Funcionalidades_AI_CondoManager.pdf",
                  tipo: "Instruções & Manuais",
                  data_upload: "2026-07-24",
                  tamanho: "2.1 MB",
                  categoria: "Instruções PWA & Desktop",
                  sub_pasta: "Instruções PWA & Desktop",
                  descricao: "Guia completo sintetizado com todas as funções de cada menu, sub-menu, IA e OCR.",
                  visibilidade: "Público",
                  autor: "CondoManager AI System",
                  tema: "Instruções PWA & Desktop",
                  ano: "2026",
                  tipo_arquivo: "documento"
                };
                handleDownloadPdf(docSint as any);
              }}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Gerar e descarregar PDF com resumo completo de menus, sub-menus, IA e OCR"
            >
              <FileDown className="h-4 w-4" />
              <span>⚡ PDF Guia Sintetizado (IA & OCR)</span>
            </button>

            <button
              onClick={executarClassificacaoIA}
              disabled={aiClassifying}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Sparkles className={`h-3.5 w-3.5 ${aiClassifying ? "animate-spin text-emerald-600" : ""}`} />
              <span>{aiClassifying ? "Indexando..." : "AI Indexação"}</span>
            </button>

            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>+ Adicionar Ficheiro</span>
            </button>
          </div>
        </div>

        {/* AI Confirmation Banner */}
        {aiMessage && (
          <div className="mt-3 bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-xl text-xs flex items-center justify-between gap-2 animate-fade-in shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{aiMessage}</span>
            </div>
            <button onClick={() => setAiMessage(null)} className="text-emerald-700 hover:text-slate-900 p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* SEPARADORES PRINCIPAIS: DOCUMENTOS VS FOTOGRAFIAS */}
      <div className="flex items-center justify-between border-b border-emerald-200 pb-2.5 gap-3 flex-wrap">
        <div className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-2xl border border-emerald-200 shadow-xs">
          <button
            onClick={() => {
              setActiveTab("documentos");
              setSelectedFolder(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "documentos"
                ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-300"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Documentos Oficiais</span>
            <span className="ml-1 bg-white text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200">
              {predioDocsWithProfileAccess.filter(d => d.tipo_arquivo !== "fotografia" && d.tipo !== "Fotografia" && !d.url_foto).length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("fotografias");
              setSelectedFolder(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "fotografias"
                ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-300"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Camera className="h-4 w-4" />
            <span>Galeria de Fotografias</span>
            <span className="ml-1 bg-white text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200">
              {predioDocsWithProfileAccess.filter(d => d.tipo_arquivo === "fotografia" || d.tipo === "Fotografia" || !!d.url_foto).length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("enciclopedia");
              setSelectedFolder(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "enciclopedia"
                ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-300"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>Enciclopédia & Vídeos PWA</span>
            <span className="ml-1 bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full text-[9px] font-black uppercase shadow-xs">
              Novo
            </span>
          </button>
        </div>

        {/* PROFILE INDICATOR */}
        <div className="text-xs bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-slate-700 flex items-center gap-2 shadow-xs">
          <User className="h-3.5 w-3.5 text-emerald-600" />
          <span>Perfil: <strong className="text-slate-900 font-black">{loggedUser.nome} ({loggedUser.role})</strong></span>
        </div>
      </div>

      {/* SEPARADOR ATIVO: ENCICLOPÉDIA OU DOCUMENTOS/FOTOS */}
      {activeTab === "enciclopedia" ? (
        <EnciclopediaPlataforma
          documentos={documentos}
          onOpenManual={(doc) => handleDownloadPdf(doc)}
          userRole={loggedUser.role}
        />
      ) : (
        <>
          {/* UNICA BARRA DE FILTROS DINÂMICOS (UMA ÚNICA BARRA COMPACTA) */}
          <div className="bg-white border border-emerald-200 p-3 rounded-2xl shadow-sm text-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2.5 items-center">
          
          {/* PESQUISA POR PALAVRA / FRASE (COL 4) */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-emerald-600 pointer-events-none" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Pesquisa por palavra, frase, fornecedor..."
              className="w-full bg-slate-50 border border-emerald-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-medium"
            />
            {busca && (
              <button
                onClick={() => setBusca("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* SELECTOR DE ANO (COL 2) */}
          <div className="md:col-span-2">
            <select
              value={filtroAno}
              onChange={e => setFiltroAno(e.target.value)}
              className="w-full bg-slate-50 border border-emerald-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="Todos">🗓️ Ano: Todos</option>
              {disponiveisAnos.filter(a => a !== "Todos").map(a => (
                <option key={a} value={a}>📅 Ano {a}</option>
              ))}
            </select>
          </div>

          {/* SELECTOR DE TEMA (COL 2) */}
          <div className="md:col-span-2">
            <select
              value={filtroTema}
              onChange={e => setFiltroTema(e.target.value)}
              className="w-full bg-slate-50 border border-emerald-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="Todos">🏷️ Tema: Todos</option>
              {(activeTab === "documentos" ? temasDocumentos : temasFotografias)
                .filter(t => t !== "Todos")
                .map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
            </select>
          </div>

          {/* SELECTOR DE FORNECEDOR / SUB-PASTA (COL 2) */}
          <div className="md:col-span-2">
            <select
              value={filtroFornecedor}
              onChange={e => {
                setFiltroFornecedor(e.target.value);
                setSelectedFolder(null);
              }}
              className="w-full bg-slate-50 border border-emerald-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="Todos">🏢 Fornecedor: Todos</option>
              {fornecedoresSubPastas.filter(f => f !== "Todos").map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* SELECTOR DE VISIBILIDADE / BOTAO LIMPAR (COL 2) */}
          <div className="md:col-span-2 flex items-center gap-1.5">
            <select
              value={filtroVisibilidade}
              onChange={e => setFiltroVisibilidade(e.target.value)}
              className="w-full bg-slate-50 border border-emerald-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="Todos">🔒 Vis: Todas</option>
              <option value="Público">Público</option>
              <option value="Administração">Reservado</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                title="Limpar Filtros"
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-emerald-200 shrink-0 transition-all cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

        </div>

        {/* ACTIVE FILTER STATUS / BREADCRUMB INDICATOR */}
        {hasActiveFilters && (
          <div className="mt-2.5 pt-2 border-t border-emerald-100 text-[11px] text-slate-600 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-1.5 flex-wrap gap-1">
              <span className="font-bold text-emerald-700">Filtros Ativos:</span>
              {filtroAno !== "Todos" && <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200 font-bold">Ano {filtroAno}</span>}
              {filtroTema !== "Todos" && <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200 font-bold">{filtroTema}</span>}
              {filtroFornecedor !== "Todos" && <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200 font-bold">Fornecedor: {filtroFornecedor}</span>}
              {selectedFolder && <span className="bg-emerald-600 text-white px-2 py-0.5 rounded font-black">Sub-Pasta: {selectedFolder}</span>}
              {busca && <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200 font-bold">"{busca}"</span>}
            </div>

            <button
              onClick={resetAllFilters}
              className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
            >
              Mostrar Todos ({docsDoTipo.length})
            </button>
          </div>
        )}
      </div>

      {/* PASTAS PRÉ-CONFIGURADAS & DINÂMICAS POR FORNECEDOR / SUB-PASTA */}
      {!selectedFolder && filtroFornecedor === "Todos" && !busca && (
        <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-2.5">
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                Pastas no Arquivo Digital ({Object.keys(folderGroups).length})
              </span>
            </div>
            <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
              💡 Pastas pré-configuradas & IA cria subpastas automaticamente
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {(Object.entries(folderGroups) as [string, Documento[]][]).map(([folderName, folderDocs]) => {
              const isPreconfig = PRECONFIGURED_FOLDERS.includes(folderName);
              const isEmpty = folderDocs.length === 0;

              return (
                <button
                  key={folderName}
                  onClick={() => setSelectedFolder(folderName)}
                  className={`border p-3 rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer group shadow-xs ${
                    isEmpty
                      ? "bg-slate-50/70 hover:bg-emerald-50/70 border-dashed border-slate-300 hover:border-emerald-400"
                      : "bg-slate-50 hover:bg-emerald-50 border-emerald-200 hover:border-emerald-400"
                  }`}
                >
                  <FolderOpen className={`h-6 w-6 mb-1 group-hover:scale-110 transition-transform ${isEmpty ? "text-slate-400 group-hover:text-emerald-600" : "text-emerald-600"}`} />
                  <span className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-emerald-900">
                    {folderName}
                  </span>
                  <span className={`text-[10px] mt-0.5 font-medium ${isEmpty ? "text-slate-400" : "text-slate-500"}`}>
                    {isEmpty ? "0 ficheiros (Pronta)" : `${folderDocs.length} ficheiro${folderDocs.length !== 1 ? "s" : ""}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* DYNAMIC BREADCRUMB BACK BUTTON IF INSIDE A SPECIFIC FOLDER */}
      {selectedFolder && (
        <div className="bg-emerald-900 border border-emerald-600 p-4 rounded-2xl text-xs text-white space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FolderOpen className="h-5 w-5 text-emerald-300" />
              <span className="text-sm">A ver Pasta: <strong className="font-black text-emerald-200">{selectedFolder}</strong> ({docsFiltrados.length} ficheiros)</span>
            </div>
            <button
              onClick={() => { setSelectedFolder(null); setSelectedSubPasta(null); }}
              className="bg-emerald-950 hover:bg-emerald-950/80 border border-emerald-700 px-3 py-1.5 rounded-xl text-emerald-200 font-bold text-[11px] cursor-pointer transition-all"
            >
              ← Voltar a Todas as Pastas
            </button>
          </div>

          {selectedFolder === "Pasta Paga. Quotas" && (
            <div className="bg-emerald-950/80 border border-emerald-700/80 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between text-[11px] text-emerald-300 font-bold border-b border-emerald-800/80 pb-2">
                <span>📁 ESTRUTURA DA PASTA PAGA: 3 SUB-PASTAS POR ANO DE EXERCÍCIO</span>
                {selectedSubPasta && (
                  <button 
                    onClick={() => setSelectedSubPasta(null)}
                    className="text-amber-300 hover:underline text-[10px]"
                  >
                    Ver todas as 3 sub-pastas
                  </button>
                )}
              </div>

              {/* Sub-Pastas Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { name: "Recibos", icon: "📄", label: "Recibos", desc: "Comprovativos e recibos de quotas mensais emitidos" },
                  { name: "Recibos Quotas extra", icon: "💳", label: "Recibos Quotas Extra", desc: "Recibos de liquidação de quotas extraordinárias" },
                  { name: "Notas de cobrança", icon: "📝", label: "Notas de Cobrança", desc: "Avisos de débito e notas de cobrança enviadas aos condóminos" }
                ].map(sub => {
                  const isActive = selectedSubPasta === sub.name;
                  const count = docsDoTipo.filter(d => 
                    (d.categoria === "Pasta Paga. Quotas" || d.tema === "Pasta Paga. Quotas" || ["Recibos", "Recibos Quotas extra", "Notas de cobrança"].includes(d.sub_pasta || "")) &&
                    d.sub_pasta === sub.name &&
                    (filtroAno === "Todos" || d.ano === filtroAno)
                  ).length;

                  return (
                    <button
                      key={sub.name}
                      onClick={() => setSelectedSubPasta(isActive ? null : sub.name)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isActive 
                          ? "bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/40" 
                          : "bg-emerald-900/60 hover:bg-emerald-800/60 border-emerald-700/80 text-emerald-100"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs flex items-center gap-1.5">
                            <span>{sub.icon}</span> {sub.label}
                          </span>
                          <span className="bg-emerald-950 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-300 border border-emerald-700">
                            {count} doc{count !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <p className="text-[10px] text-emerald-300/80 line-clamp-1">{sub.desc}</p>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-400 mt-2 block">
                        {isActive ? "✓ Sub-pasta selecionada (clique para limpar)" : "→ Filtrar por esta sub-pasta"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Filtro Rápido por Ano de Exercício */}
              <div className="flex items-center space-x-2 pt-1 text-[11px]">
                <span className="text-emerald-300 font-bold">Ano de Exercício:</span>
                <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                  {["Todos", "2026", "2025", "2024"].map(ano => (
                    <button
                      key={ano}
                      onClick={() => setFiltroAno(ano)}
                      className={`px-2.5 py-0.5 rounded-lg font-bold text-[10px] transition-all cursor-pointer ${
                        filtroAno === ano 
                          ? "bg-emerald-400 text-slate-950 font-black shadow-xs" 
                          : "bg-emerald-900 hover:bg-emerald-800 text-emerald-200 border border-emerald-700"
                      }`}
                    >
                      {ano === "Todos" ? "Todos os Anos" : `Exercício ${ano}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PASTA ESPECIAL: PROCESSOS JURÍDICOS & CONTENCIOSO */}
          {selectedFolder === "⚖️ Processos Jurídicos & Contencioso" && (
            <div className="bg-emerald-950/90 border border-emerald-600 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between text-[11px] text-emerald-300 font-bold border-b border-emerald-800/80 pb-2">
                <span className="flex items-center gap-2">
                  <span>⚖️</span> DOSSIÊS DE PROCESSOS JUDICIAIS, RECIBOS DE CARTAS AR CTT, PRINTS & PROVAS DOCUMENTAIS
                </span>
                {busca && (
                  <button 
                    onClick={() => setBusca("")}
                    className="text-amber-300 hover:underline text-[10px]"
                  >
                    Limpar pesquisa
                  </button>
                )}
              </div>
              <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                Esta pasta do arquivo armazena todos os elementos probatórios recolhidos para ações executivas, injunções do BNI e processos no Julgado de Paz: recibos e avisos de receção de cartas registadas com AR, capturas de ecrã (WhatsApp/e-mails), relatórios fotográficos de danos e atas com força executiva.
              </p>
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-emerald-300 font-bold mr-1">Filtrar por Processo / Prova:</span>
                {[
                  { label: "Todos", query: "" },
                  { label: "Proc. 001 (Fração A - Dívida)", query: "Proc_001" },
                  { label: "Proc. 002 (Fração D - Obras)", query: "Proc_002" },
                  { label: "✉️ Recibos AR CTT", query: "AR" },
                  { label: "💬 Prints & WhatsApp", query: "Prints" },
                  { label: "📜 Dossiês de Tribunal", query: "Dossie" }
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={() => setBusca(item.query)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      busca === item.query 
                        ? "bg-emerald-400 text-slate-950 shadow-sm" 
                        : "bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-700"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL: DOCUMENTOS OU FOTOGRAFIAS */}
      {docsFiltrados.length === 0 ? (
        <div className="bg-emerald-900/60 border border-dashed border-emerald-700 rounded-2xl p-10 text-center text-emerald-200 space-y-3 shadow-lg">
          <FolderOpen className="h-10 w-10 mx-auto text-emerald-400 animate-pulse" />
          <h4 className="text-sm font-bold text-white">Nenhum ficheiro corresponde aos filtros</h4>
          <p className="text-xs max-w-md mx-auto text-emerald-200">
            Ajuste a pesquisa por palavra ou altere o Ano, Tema e Fornecedor na barra superior.
          </p>
          <button
            onClick={resetAllFilters}
            className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl cursor-pointer transition-all shadow"
          >
            Limpar Filtros e Ver Todos
          </button>
        </div>
      ) : activeTab === "documentos" ? (
        /* VISTA DE DOCUMENTOS OFICIAIS — ESTILO PWA ADMINISTRADOR EMERALD */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {docsFiltrados.map(doc => (
            <div
              key={doc.id_doc}
              className="bg-white hover:border-emerald-400 border-2 border-emerald-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between transition-all group text-slate-800"
            >
              <div className="space-y-2.5">
                {/* Badges de Ano, Tema, Sub-pasta e Arquivado */}
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center space-x-1 flex-wrap gap-1">
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-lg">
                      📅 {doc.ano || "2026"}
                    </span>
                    <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-slate-200">
                      🏷️ {doc.tema || doc.categoria || "Geral"}
                    </span>
                    {(doc.sub_pasta || doc.fornecedor) && (
                      <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-xs">
                        🏢 {doc.sub_pasta || doc.fornecedor}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {doc.arquivado && (
                      <span className="bg-emerald-600 text-white font-black text-[9px] px-2 py-0.5 rounded-md flex items-center gap-0.5 shadow-xs">
                        <Check className="h-3 w-3" /> Arquivado
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                      doc.visibilidade === "Administração"
                        ? "bg-amber-50 text-amber-800 border border-amber-200"
                        : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    }`}>
                      {doc.visibilidade === "Administração" ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                      <span>{doc.visibilidade || "Público"}</span>
                    </span>
                  </div>
                </div>

                {/* Nome do Ficheiro */}
                <div className="flex items-start space-x-2.5 pt-0.5">
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl group-hover:border-emerald-400 transition-colors shrink-0">
                    <FileText className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 leading-tight group-hover:text-emerald-700 transition-colors line-clamp-2">
                      {doc.nome}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 flex-wrap">
                      <span>{doc.tamanho}</span>
                      <span>•</span>
                      <span>Carregado a {formatDatePT(doc.data_upload)}</span>
                    </p>
                  </div>
                </div>

                {/* Descrição */}
                <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-emerald-100 leading-relaxed font-medium">
                  {doc.descricao || "Sem descrição registada no arquivo."}
                </p>

                {/* Autor */}
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <User className="h-3 w-3 text-emerald-600" />
                  <span>Registado por: <strong className="text-slate-800">{doc.autor || "Administração"}</strong></span>
                </div>
              </div>

              {/* Botões de Ação — BOTÃO DE ARQUIVAMENTO COM IA */}
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => abrirModalArquivamentoIA(doc)}
                    title="Arquivar Ficheiro com IA"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    <span>Arquivar</span>
                  </button>

                  <button
                    onClick={() => abrirModalEditarDoc(doc)}
                    title="Editar metadados e registo oficial"
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all border border-slate-300 shadow-xs cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5 text-slate-600" />
                    <span>Editar Detalhes</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => abrirModalEnviarEmail(doc)}
                    title="Enviar documento oficial por e-mail com anexo"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Enviar E-mail</span>
                  </button>

                  <button
                    onClick={() => handleDownloadPdf(doc)}
                    title="Exportar & Abrir PDF Oficial com Logótipo e Marca de Água"
                    className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-xs"
                  >
                    <img src="/modulos/80-pdf-de-resultados.png" alt="PDF" className="h-5 w-5 object-contain" onError={(e) => { e.currentTarget.src = "/modulos/25-relatorio.png"; }} />
                  </button>
                  <button
                    onClick={() => handleDownloadDoc(doc)}
                    title="Exportar Documento Editável Word (.doc)"
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-colors cursor-pointer border border-slate-200 shadow-xs"
                  >
                    <FileDown className="h-3.5 w-3.5 text-blue-600" />
                    <span>DOC</span>
                  </button>
                </div>

                {["ADMIN", "EMPRESA_GESTORA"].includes(loggedUser.role) && (
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => alternarVisibilidade(doc)}
                      title="Alternar Visibilidade"
                      className="p-1.5 text-slate-500 hover:text-amber-600 bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      {doc.visibilidade === "Administração" ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => eliminarDocumento(doc.id_doc)}
                      title="Eliminar do Arquivo"
                      className="p-1.5 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-300 rounded-lg transition-all cursor-pointer active:scale-90 active:ring-2 active:ring-red-400 select-none"
                    >
                      <img src="/estados-acoes/14-eliminar.png" alt="Eliminar" className="h-3.5 w-3.5 object-contain" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* VISTA DE GALERIA DE FOTOGRAFIAS DO ARQUIVO — ESTILO PWA ADMINISTRADOR EMERALD */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {docsFiltrados.map(foto => (
            <div
              key={foto.id_doc}
              className="bg-emerald-800 hover:bg-emerald-850 border border-emerald-700 hover:border-emerald-400 rounded-2xl overflow-hidden shadow-xl flex flex-col group transition-all text-white"
            >
              {/* Imagem / Preview com Botão Zoom */}
              <div className="relative h-40 bg-emerald-950 overflow-hidden cursor-pointer" onClick={() => setActivePhotoModal(foto)}>
                <img
                  src={foto.url_foto || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80"}
                  alt={foto.nome}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-emerald-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="bg-emerald-400 text-emerald-950 text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-lg">
                    <Maximize2 className="h-3.5 w-3.5" /> Ver em Zoom
                  </span>
                </div>

                <span className="absolute top-2 left-2 bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 text-[10px] font-black px-2 py-0.5 rounded-lg">
                  📅 {foto.ano || "2026"}
                </span>

                <span className="absolute top-2 right-2 bg-emerald-950/90 text-white border border-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                  🏷️ {foto.tema || "Foto"}
                </span>
              </div>

              {/* Detalhes da Fotografia */}
              <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h4 className="text-xs font-black text-white group-hover:text-emerald-200 transition-colors line-clamp-1">
                      {foto.nome.replace(/\.[^/.]+$/, "")}
                    </h4>
                    {foto.arquivado && (
                      <span className="bg-emerald-400 text-emerald-950 text-[8px] font-black px-1.5 py-0.5 rounded shrink-0">
                        Arquivado
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-100 line-clamp-2 leading-relaxed font-medium">
                    {foto.descricao || "Fotografia registada no arquivo técnico do edifício."}
                  </p>
                </div>

                {/* Botão na Fotografia */}
                <div className="pt-2 border-t border-emerald-700/80 flex items-center justify-between gap-1.5 text-[10px]">
                  <button
                    onClick={() => abrirModalArquivamentoIA(foto)}
                    title="Arquivar Fotografia com IA"
                    className="bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-black px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition-all shadow cursor-pointer border border-emerald-200"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Arquivar</span>
                  </button>

                  <button
                    onClick={() => setActivePhotoModal(foto)}
                    className="text-emerald-300 hover:text-white font-bold cursor-pointer flex items-center gap-1"
                  >
                    <Eye className="h-3 w-3" /> Ampliar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}

      {/* MODAL IA AUTO-ARQUIVAMENTO DE DOCUMENTO / FOTOGRAFIA */}
      {archiveTargetDoc && (
        <div className="fixed inset-0 bg-emerald-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-emerald-900 border border-emerald-500 text-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-emerald-700 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-950 border border-emerald-400/50 rounded-xl text-emerald-300">
                  <Save className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    Confirmar Arquivamento IA
                  </h3>
                  <p className="text-[10px] text-emerald-200">Destino de arquivo sugerido pela Inteligência Artificial</p>
                </div>
              </div>
              <button
                onClick={() => setArchiveTargetDoc(null)}
                className="text-emerald-300 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Preview & AI Deduction */}
            <div className="bg-emerald-950/90 border border-emerald-700 p-4 rounded-xl space-y-3 text-xs">
              <div className="flex items-start space-x-3">
                <FileText className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-white">{archiveTargetDoc.nome}</h4>
                  <p className="text-[10px] text-emerald-200/80 mt-0.5">
                    Tamanho: {archiveTargetDoc.tamanho} • Tipo: {archiveTargetDoc.tipo_arquivo === "fotografia" ? "Fotografia Técnico-Visual" : "Documento Oficial"}
                  </p>
                </div>
              </div>

              <div className="bg-emerald-900/80 border border-emerald-600/80 p-3 rounded-lg text-emerald-100 flex items-start gap-2">
                <Bot className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  A IA analisou este ficheiro. Confirme ou ajuste a pasta de destino final:
                </p>
              </div>

              {/* Destination Form Fields */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="font-extrabold text-emerald-200 block mb-1">📅 Ano de Exercício:</label>
                  <select
                    value={targetAno}
                    onChange={e => setTargetAno(e.target.value)}
                    className="w-full bg-emerald-900 border border-emerald-600 rounded-xl px-3 py-2 text-white font-bold focus:outline-emerald-300 cursor-pointer"
                  >
                    <option value="2026">2026 (Exercício Atual)</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                    <option value="2023">2023</option>
                  </select>
                </div>

                <div>
                  <label className="font-extrabold text-emerald-200 block mb-1">🏷️ Tema / Categoria Principal:</label>
                  <select
                    value={targetTema}
                    onChange={e => setTargetTema(e.target.value)}
                    className="w-full bg-emerald-900 border border-emerald-600 rounded-xl px-3 py-2 text-white font-bold focus:outline-emerald-300 cursor-pointer"
                  >
                    {temasDocumentos.concat(temasFotografias)
                      .filter((v, i, a) => a.indexOf(v) === i && v !== "Todos")
                      .map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="font-extrabold text-emerald-200 block mb-1">🏢 Sub-Pasta por Fornecedor / Entidade:</label>
                  <select
                    value={targetSubPasta}
                    onChange={e => {
                      setTargetSubPasta(e.target.value);
                      setTargetFornecedor(e.target.value);
                    }}
                    className="w-full bg-emerald-900 border border-emerald-600 rounded-xl px-3 py-2 text-white font-bold focus:outline-emerald-300 cursor-pointer"
                  >
                    {fornecedoresSubPastas.filter(s => s !== "Todos").map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setArchiveTargetDoc(null)}
                className="bg-emerald-950 hover:bg-emerald-900 text-emerald-200 font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer border border-emerald-700"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarArquivamentoIA}
                className="bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>Sim, Confirmar e Arquivar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX / MODAL DE FOTOGRAFIA EM ZOOM */}
      {activePhotoModal && (
        <div className="fixed inset-0 bg-emerald-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-emerald-900 border border-emerald-600 text-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-3.5 bg-emerald-950 border-b border-emerald-800 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <Camera className="h-4 w-4 text-emerald-300" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Foto do Arquivo: {activePhotoModal.nome}
                </span>
              </div>
              <button
                onClick={() => setActivePhotoModal(null)}
                className="p-1 text-emerald-300 hover:text-white rounded-lg hover:bg-emerald-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              <div className="bg-emerald-950 rounded-xl overflow-hidden border border-emerald-800 flex items-center justify-center max-h-[50vh]">
                <img
                  src={activePhotoModal.url_foto || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80"}
                  alt={activePhotoModal.nome}
                  className="max-h-[50vh] w-auto object-contain"
                />
              </div>

              <div className="bg-emerald-950/90 p-4 rounded-xl border border-emerald-800 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-800 pb-2">
                  <span className="text-emerald-300 font-bold">📅 Ano: {activePhotoModal.ano} • 🏷️ Tema: {activePhotoModal.tema} • 🏢 Fornecedor: {activePhotoModal.sub_pasta || activePhotoModal.fornecedor || "Geral"}</span>
                  <span className="text-emerald-200/80">Data: {formatDatePT(activePhotoModal.data_upload)}</span>
                </div>
                <p className="text-emerald-100 leading-relaxed pt-1">{activePhotoModal.descricao}</p>
                <div className="text-[10px] text-emerald-300/80 pt-1">
                  Fotografia capturada por: <strong className="text-white">{activePhotoModal.autor || "Técnico do Condomínio"}</strong>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-emerald-950 border-t border-emerald-800 flex justify-between items-center shrink-0">
              <button
                onClick={() => {
                  abrirModalArquivamentoIA(activePhotoModal);
                  setActivePhotoModal(null);
                }}
                className="bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Save className="h-4 w-4" /> Arquivar com IA
              </button>

              <button
                onClick={() => {
                  if (activePhotoModal) {
                    if (activePhotoModal.url_foto) {
                      const a = document.createElement("a");
                      a.href = activePhotoModal.url_foto;
                      a.download = activePhotoModal.nome || "fotografia_vistoria.webp";
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    } else {
                      handleDownloadPdf(activePhotoModal);
                    }
                  }
                }}
                className="bg-emerald-800 hover:bg-emerald-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer border border-emerald-600"
              >
                <DownloadCloud className="h-4 w-4" /> Download Imagem HD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE UPLOAD MANUAL DE DOCUMENTOS OU FOTOGRAFIAS */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-emerald-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-emerald-900 border border-emerald-600 text-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-700 pb-3">
              <div className="flex items-center space-x-2">
                <UploadCloud className="h-5 w-5 text-emerald-300" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Adicionar Ficheiro ou Fotografia ao Arquivo
                </h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-emerald-300 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submeterUploadManual} className="space-y-3.5 text-xs">
              {/* Tipo de Ficheiro */}
              <div>
                <label className="font-extrabold text-emerald-200 block mb-1">Tipo de Ficheiro *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNovoTipoArquivo("documento");
                      setNovoTema("Atas & Convocatórias");
                    }}
                    className={`py-2 rounded-xl font-black flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      novoTipoArquivo === "documento"
                        ? "bg-emerald-400 text-emerald-950 border border-emerald-200 shadow"
                        : "bg-emerald-950 text-emerald-200 border border-emerald-700"
                    }`}
                  >
                    <FileText className="h-4 w-4" /> Documento (PDF / Doc)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNovoTipoArquivo("fotografia");
                      setNovoTema("Vistorias Técnicas");
                    }}
                    className={`py-2 rounded-xl font-black flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      novoTipoArquivo === "fotografia"
                        ? "bg-emerald-400 text-emerald-950 border border-emerald-200 shadow"
                        : "bg-emerald-950 text-emerald-200 border border-emerald-700"
                    }`}
                  >
                    <Camera className="h-4 w-4" /> Fotografia (JPG / PNG)
                  </button>
                </div>
              </div>

              {/* Título / Nome */}
              <div>
                <label className="font-extrabold text-emerald-200 block mb-1">Título do Ficheiro / Nome *</label>
                <input
                  type="text"
                  required
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  placeholder={novoTipoArquivo === "fotografia" ? "Ex: Foto_Inspecao_Garagem_Piso_Minus_1" : "Ex: Relatorio_Contas_Mensal_Maio_2026"}
                  className="w-full bg-emerald-950 border border-emerald-600 rounded-xl px-3 py-2 text-white focus:outline-emerald-300"
                />
              </div>

              {/* Ano, Tema e Sub-Pasta */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-extrabold text-emerald-200 block mb-1">📅 Ano:</label>
                  <select
                    value={novoAno}
                    onChange={e => setNovoAno(e.target.value)}
                    className="w-full bg-emerald-950 border border-emerald-600 rounded-xl px-2.5 py-2 text-white font-bold cursor-pointer"
                  >
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                    <option value="2023">2023</option>
                  </select>
                </div>

                <div>
                  <label className="font-extrabold text-emerald-200 block mb-1">🏷️ Tema:</label>
                  <select
                    value={novoTema}
                    onChange={e => setNovoTema(e.target.value)}
                    className="w-full bg-emerald-950 border border-emerald-600 rounded-xl px-2.5 py-2 text-white font-bold cursor-pointer"
                  >
                    {(novoTipoArquivo === "documento" ? temasDocumentos : temasFotografias)
                      .filter(t => t !== "Todos")
                      .map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="font-extrabold text-emerald-200 block mb-1">🏢 Fornecedor:</label>
                  <select
                    value={novaSubPasta}
                    onChange={e => setNovaSubPasta(e.target.value)}
                    className="w-full bg-emerald-950 border border-emerald-600 rounded-xl px-2.5 py-2 text-white font-bold cursor-pointer"
                  >
                    {fornecedoresSubPastas.filter(f => f !== "Todos").map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Se for foto, aceitar URL opcional */}
              {novoTipoArquivo === "fotografia" && (
                <div>
                  <label className="font-extrabold text-emerald-200 block mb-1">URL da Fotografia (Opcional):</label>
                  <input
                    type="url"
                    value={novaFotoUrl}
                    onChange={e => setNovaFotoUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-emerald-950 border border-emerald-600 rounded-xl px-3 py-2 text-white focus:outline-emerald-300"
                  />
                </div>
              )}

              {/* Descrição */}
              <div>
                <label className="font-extrabold text-emerald-200 block mb-1">Descrição / Notas do Arquivo:</label>
                <textarea
                  rows={2}
                  value={novaDescricao}
                  onChange={e => setNovaDescricao(e.target.value)}
                  placeholder="Anotações técnicas ou regulamentares sobre este ficheiro..."
                  className="w-full bg-emerald-950 border border-emerald-600 rounded-xl px-3 py-2 text-white focus:outline-emerald-300"
                />
              </div>

              {/* Visibilidade */}
              <div>
                <label className="font-extrabold text-emerald-200 block mb-1">Nível de Acesso / Nível de Visibilidade:</label>
                <select
                  value={novaVisibilidade}
                  onChange={e => setNovaVisibilidade(e.target.value as any)}
                  className="w-full bg-emerald-950 border border-emerald-600 rounded-xl px-3 py-2 text-white font-bold cursor-pointer"
                >
                  <option value="Público">Público (Visível a todos os Condóminos)</option>
                  <option value="Administração">Reservado (Apenas Administração & Perfis Especiais)</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="bg-emerald-950 hover:bg-emerald-950/80 text-emerald-200 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer border border-emerald-700"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-black px-5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>Guardar e Arquivar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF DOCUMENT READER & EXPORT MODAL */}
      {activePdfViewerDoc && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-4xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-emerald-950 border-b border-emerald-800 p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-900/80 border border-emerald-700/80 rounded-2xl text-emerald-300">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase bg-emerald-400 text-emerald-950 font-black px-2 py-0.5 rounded">
                      Documento Oficial PDF
                    </span>
                    <span className="text-[10px] text-emerald-300 font-bold">
                      {activePdfViewerDoc.id_doc}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-white leading-tight mt-0.5">
                    {activePdfViewerDoc.nome}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPdf(activePdfViewerDoc)}
                  className="bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
                >
                  <DownloadCloud className="h-4 w-4" />
                  <span>Descarregar PDF</span>
                </button>

                <button
                  onClick={() => handleDownloadDoc(activePdfViewerDoc)}
                  className="bg-emerald-900 hover:bg-emerald-800 text-emerald-200 border border-emerald-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FileDown className="h-4 w-4 text-blue-400" />
                  <span>Word (.doc)</span>
                </button>

                <button
                  onClick={() => setActivePdfViewerDoc(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer ml-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Embedded Preview Frame */}
            <div className="flex-1 bg-white relative p-2">
              <iframe
                title={activePdfViewerDoc.nome}
                srcDoc={generateDocumentHtml(activePdfViewerDoc)}
                className="w-full h-full border-0 rounded-xl"
              />
            </div>

            {/* Modal Footer */}
            <div className="bg-emerald-950/90 border-t border-emerald-800 p-3 px-5 flex items-center justify-between shrink-0 text-xs text-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Certificado e Autenticado no Arquivo Digital • CondoManager AI</span>
              </div>
              <button
                onClick={() => setActivePdfViewerDoc(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-1.5 rounded-xl text-xs cursor-pointer"
              >
                Fechar Visualização
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL EDITAR DADOS & METADADOS DO DOCUMENTO */}
      {editingDoc && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-white flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Editar Dados & Metadados do Documento</h3>
                  <p className="text-[10px] text-emerald-300 font-bold">Arquivo Digital • Atualização do Registo Oficial</p>
                </div>
              </div>
              <button
                onClick={() => setEditingDoc(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Nome do Ficheiro / Título Documental</label>
                <input
                  type="text"
                  value={editNome}
                  onChange={e => setEditNome(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Categoria / Tipo de Documento</label>
                <input
                  type="text"
                  value={editCategoria}
                  onChange={e => setEditCategoria(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Autor / Emitente Responsável</label>
                <input
                  type="text"
                  value={editAutor}
                  onChange={e => setEditAutor(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Conteúdo / Descrição do Documento</label>
                <textarea
                  rows={4}
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-xs leading-relaxed focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl text-[11px] text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>O documento atualizado manterá a certificação e autenticidade no arquivo digital.</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setEditingDoc(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEGuardarPdf}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg"
              >
                <DownloadCloud className="h-4 w-4" />
                <span>Guardar & Atualizar Documento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ENVIO DE DOCUMENTO / MANUAL POR E-MAIL */}
      {emailModalDoc && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-white flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Send className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Enviar Documento / Manual por E-mail</h3>
                  <p className="text-[10px] text-emerald-300 font-bold">Arquivo Digital • Envio com Validação & Anexo PDF</p>
                </div>
              </div>
              <button
                onClick={() => setEmailModalDoc(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Document details preview */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold text-white block truncate">{emailModalDoc.nome}</span>
                  <span className="text-[10px] text-slate-400">{emailModalDoc.tipo} • {emailModalDoc.tamanho || "PDF"}</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 shrink-0">
                Anexo Incluído
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-300">
                    Endereço de E-mail de Envio (Destinatário) *
                  </label>
                  <span className="text-[9px] text-emerald-400 font-medium">Obrigatório</span>
                </div>
                <input
                  type="email"
                  value={emailDestinatario}
                  onChange={e => setEmailDestinatario(e.target.value)}
                  placeholder="ex: condomino@exemplo.com ou administracao@condominio.pt"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-emerald-400"
                  required
                />
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="text-[9px] text-slate-400">Atalhos rápidos:</span>
                  {[
                    { label: "Administração", email: predio.email_condominio || "administracao@condominio.pt" },
                    { label: "Empresa Gestora", email: "gestao@condomanager.ai" },
                    { label: "jcafguerra@hotmail.com", email: "jcafguerra@hotmail.com" }
                  ].map(sug => (
                    <button
                      key={sug.label}
                      type="button"
                      onClick={() => setEmailDestinatario(sug.email)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] border border-slate-700 cursor-pointer"
                    >
                      {sug.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Assunto do E-mail</label>
                <input
                  type="text"
                  value={emailAssunto}
                  onChange={e => setEmailAssunto(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Mensagem / Observações de Acompanhamento</label>
                <textarea
                  rows={3}
                  value={emailMensagem}
                  onChange={e => setEmailMensagem(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-xs leading-relaxed focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="emailCopiaAdmin"
                  checked={emailEnviarCopiaAdmin}
                  onChange={e => setEmailEnviarCopiaAdmin(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-400"
                />
                <label htmlFor="emailCopiaAdmin" className="text-[10.5px] text-slate-300 cursor-pointer">
                  Enviar cópia de confirmação para o e-mail da Administração
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setEmailModalDoc(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEnvioEmail}
                disabled={!emailDestinatario.trim() || !emailDestinatario.includes("@")}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Confirmar & Enviar E-mail</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
