import { Documento, Predio } from "../types";

export function getIllustratedManualHtml(doc: Documento, predio: Predio): string | null {
  const nomeLower = (doc.nome || "").toLowerCase();
  const idLower = (doc.id_doc || "").toLowerCase();

  const isCompleto = idLower.includes("completo") || idLower.includes("passo-a-passo") || nomeLower.includes("completo") || nomeLower.includes("passo_a_passo") || (nomeLower.includes("00_manual") && nomeLower.includes("plataforma"));
  const isCondomino = !isCompleto && (idLower.includes("condomino") || nomeLower.includes("condomino"));
  const isAdmin = !isCompleto && (idLower.includes("admin") || nomeLower.includes("administrador"));
  const isEmpresa = !isCompleto && (idLower.includes("empresa") || nomeLower.includes("empresa_gestora"));
  const isTecnico = !isCompleto && (idLower.includes("tecnico") || nomeLower.includes("tecnico") || nomeLower.includes("prestador"));
  const isLimpezas = !isCompleto && (idLower.includes("limpezas") || idLower.includes("limpeza") || nomeLower.includes("limpeza"));
  const isJuridico = !isCompleto && (idLower.includes("juridico") || nomeLower.includes("juridico"));
  const isContabilidade = !isCompleto && (idLower.includes("contabilidade") || nomeLower.includes("contabilidade") || nomeLower.includes("auditoria"));
  const isInstalacao = !isCompleto && (idLower.includes("instalacao") || nomeLower.includes("instalacao"));

  if (!isCompleto && !isCondomino && !isAdmin && !isEmpresa && !isTecnico && !isLimpezas && !isJuridico && !isContabilidade && !isInstalacao) {
    return null;
  }

  const baseStyle = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 24px; color: #0f172a; line-height: 1.5; background: #ffffff; }
      .header-card { background: linear-gradient(135deg, #064e3b 0%, #047857 100%); color: white; padding: 20px 24px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
      .header-card h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.025em; }
      .header-card p { margin: 0; font-size: 11px; opacity: 0.9; }
      .badge { display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; margin-right: 6px; }
      .badge-desktop { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
      .badge-pwa { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
      .badge-age { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
      .section-title { font-size: 14px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin: 24px 0 14px 0; display: flex; align-items: center; gap: 8px; }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
      .step-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; background: #f8fafc; position: relative; }
      .step-card.highlight { border-color: #10b981; background: #f0fdf4; }
      .step-number { width: 26px; height: 26px; border-radius: 50%; background: #047857; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; margin-bottom: 8px; }
      .step-title { font-size: 12.5px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
      .step-desc { font-size: 11px; color: #475569; line-height: 1.45; }
      .step-tip { margin-top: 8px; font-size: 10.5px; padding: 6px 10px; border-radius: 6px; background: #ffffff; border: 1px dashed #cbd5e1; color: #334155; }
      .icon-box { display: inline-flex; align-items: center; justify-content: center; font-size: 18px; margin-right: 6px; }
      .comparison-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10.5px; }
      .comparison-table th, .comparison-table td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
      .comparison-table th { background: #f1f5f9; font-weight: 700; color: #1e293b; }
      .footer-note { margin-top: 24px; padding: 12px; border-radius: 8px; background: #f1f5f9; font-size: 10.5px; color: #64748b; text-align: center; border: 1px solid #e2e8f0; }
    </style>
  `;

  if (isCompleto) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.nome}</title>
  ${baseStyle}
</head>
<body>
  <div class="header-card">
    <div style="margin-bottom: 6px;">
      <span class="badge badge-desktop">💻 DESKTOP & TABLET</span>
      <span class="badge badge-pwa">📱 PWA TELEMÓVEL</span>
      <span class="badge badge-age">🛡️ MANUAL OFICIAL CONDOMANAGER AI</span>
    </div>
    <h1>📖 GUIA ILUSTRADO COMPLETO: COMO FUNCIONA A APLICAÇÃO (PASSO A PASSO)</h1>
    <p><strong>Edifício:</strong> ${predio.nome || "Condomínio Edifício Estrela da Barra"} | <strong>Manual de Formação & Operação</strong> | <strong>Versão Oficial</strong></p>
  </div>

  <div class="section-title">🏛️ 1. ESTRUTURA GERAL DA PLATAFORMA</div>
  <div class="grid-2">
    <div class="step-card highlight">
      <div class="step-number">A</div>
      <div class="step-title">Barra Lateral Esquerda (Menu Principal)</div>
      <div class="step-desc">Permite navegar instantaneamente entre todos os módulos do condomínio. Pode ser recolhida a qualquer momento para dar mais espaço de ecrã ao clicar no botão com ícone de setas. O logótipo adapta-se dinamicamente.</div>
    </div>
    <div class="step-card highlight">
      <div class="step-number">B</div>
      <div class="step-title">Coluna Central de Sub-menus & Navegação</div>
      <div class="step-desc">Apresenta as opções e filtros do módulo ativo. Por predefinição surge recolhida para manter a interface limpa e focada no trabalho diário, podendo ser expandida com um clique.</div>
    </div>
  </div>

  <div class="section-title">🏢 2. MENU: PRÉDIO & FRAÇÕES</div>
  <div class="grid-2">
    <div class="step-card">
      <div class="step-number">1</div>
      <div class="step-title">Ficha do Prédio & Regras Gerais</div>
      <div class="step-desc">Consulte e edite a identificação do condomínio: Morada oficial, NIF, Código Postal com preenchimento automático, IBAN da conta bancária, seguradora e número de apólice.</div>
      <div class="step-tip">💡 <em>Estes dados são aplicados automaticamente em todas as atas, recibos e convocatórias emitidas.</em></div>
    </div>
    <div class="step-card">
      <div class="step-number">2</div>
      <div class="step-title">Frações, Permilagens & Condóminos</div>
      <div class="step-desc">Registe todas as frações autónomas (Habitação, Garagens, Lojas), permilagens por milésimos, contactos dos proprietários, e-mails e telemóveis para notificação automática.</div>
      <div class="step-tip">💡 <em>Permite gerir simultaneamente inquilinos e proprietários com níveis de permissão distintos.</em></div>
    </div>
  </div>

  <div class="section-title">💰 3. MENU: FINANÇAS & CONTAS</div>
  <div class="grid-2">
    <div class="step-card highlight">
      <div class="step-number">3</div>
      <div class="step-title">Emissão de Quotas Ordinárias e Extraordinárias</div>
      <div class="step-desc">Gere mensalidades e quotas de fundo de reserva com um clique. A plataforma cria avisos de cobrança individuais com Entidade/Referência Multibanco e instruções de MB WAY.</div>
      <div class="step-tip">💡 <em>Ao ser liquidado, o recibo oficial com quitação é gerado e arquivado no Arquivo Digital.</em></div>
    </div>
    <div class="step-card highlight">
      <div class="step-number">4</div>
      <div class="step-title">Contas Bancárias, Saldos & Fundo Comum de Reserva</div>
      <div class="step-desc">Acompanhe em tempo real o saldo da Conta à Ordem e da Conta Poupança do Fundo Comum de Reserva (FCR). Registe receitas e despesas com discriminação do fornecedor.</div>
      <div class="step-tip">💡 <em>Permite extrair balancetes analíticos e mapas de execução orçamental em PDF e Excel.</em></div>
    </div>
  </div>

  <div class="section-title">🤖 4. MENU: CONCILIAÇÃO BANCÁRIA IA & LEITOR DE ANEXOS</div>
  <div class="grid-2">
    <div class="step-card">
      <div class="step-number">5</div>
      <div class="step-title">Leitura Inteligente de Extratos e Comprovativos</div>
      <div class="step-desc">Carregue ficheiros de extratos em PDF/Excel ou fotografias WebP enviadas pelos condóminos. A IA deteta o valor pago, o NIF ou nome do depositante e a fração correspondente.</div>
      <div class="step-tip">💡 <em>Reconciliação automática: elimina erros manuais e acelera a liquidação das quotas.</em></div>
    </div>
    <div class="step-card">
      <div class="step-number">6</div>
      <div class="step-title">Auto-Responder e Disparo de Recibos</div>
      <div class="step-desc">Após confirmar o movimento, o sistema pode enviar de imediato o Recibo Oficial por e-mail com indicação de quitação e o anexo PDF em layout homologado.</div>
    </div>
  </div>

  <div class="section-title">🏗️ 5. MENU: MANUTENÇÃO, AVARIAS & VISTORIAS</div>
  <div class="grid-2">
    <div class="step-card">
      <div class="step-number">7</div>
      <div class="step-title">Reporte de Avarias com Fotografias WebP</div>
      <div class="step-desc">Condóminos e técnicos podem reportar avarias (lâmpadas, elevador, infiltrações) diretamente pelo telemóvel com fotos de alta definição comprimidas automaticamente.</div>
      <div class="step-tip">💡 <em>Acompanhamento visual do estado da ocorrência (Pendente, Em Reparação, Resolvido).</em></div>
    </div>
    <div class="step-card">
      <div class="step-number">8</div>
      <div class="step-title">Agenda de Intervenções & Folhas de Limpeza</div>
      <div class="step-desc">Planeamento de inspeções técnicas obrigatórias aos elevadores, colunas de gás e extintores. Checklists digitais de higienização dos pisos preenchidas pela equipa de limpeza com 1 toque.</div>
    </div>
  </div>

  <div class="section-title">👥 6. MENU: REUNIÕES, ASSEMBLEIAS & ATAS</div>
  <div class="grid-2">
    <div class="step-card highlight">
      <div class="step-number">9</div>
      <div class="step-title">Convocatórias com Quórum Legal Automático</div>
      <div class="step-desc">Agende assembleias ordinárias ou extraordinárias. O sistema gera a minuta da convocatória com 1.ª e 2.ª data legal, pontos da ordem de trabalhos e envia por e-mail com comprovativo.</div>
    </div>
    <div class="step-card highlight">
      <div class="step-number">10</div>
      <div class="step-title">Videoconferência, Votação em Tempo Real & Assinatura Tátil</div>
      <div class="step-desc">Permite assembleias mistas ou virtuais com votação ponto por ponto. A ata é redigida com apoio da IA e os condóminos podem assinar no ecrã com o dedo ou caneta digital.</div>
      <div class="step-tip">💡 <em>A Ata assinada é convertida em PDF Oficial e fica imediatamente disponível para consulta.</em></div>
    </div>
  </div>

  <div class="section-title">📁 7. MENU: ARQUIVO DIGITAL, PASTAS & ENVIO DE E-MAILS</div>
  <div class="grid-2">
    <div class="step-card highlight">
      <div class="step-number">11</div>
      <div class="step-title">Pastas Pré-configuradas e Criação Automática por IA</div>
      <div class="step-desc">O Arquivo Digital dispõe de pastas pré-configuradas vazias prontas a usar (Recibos e Quotas, Faturas Diversas, Fornecedores & Contratos, Atas, Seguros, Manuais). Conforme novos documentos ou faturas são carregados, a IA cria e organiza automaticamente as respetivas subpastas de fornecedores.</div>
      <div class="step-tip">💡 <em>Organização perfeita sem esforço manual: nada se perde ou fica fora do sítio.</em></div>
    </div>
    <div class="step-card highlight">
      <div class="step-number">12</div>
      <div class="step-title">Envio de Documentos por E-mail com Destinatário Personalizado</div>
      <div class="step-desc">Ao selecionar a opção "Enviar E-mail" em qualquer documento ou manual, a aplicação abre uma janela de envio onde pode indicar ou confirmar o endereço de e-mail de envio pretendido (administrador, condómino ou e-mail externo), assunto e mensagem de acompanhamento antes de efetuar o envio.</div>
      <div class="step-tip">💡 <em>Controlo total: sabe sempre exatamente para quem o documento está a ser remetido.</em></div>
    </div>
  </div>

  <div class="section-title">📢 8. MENUS COMPLEMENTARES: MURAL, RESERVAS & PWA MÓVEL</div>
  <div class="grid-2">
    <div class="step-card">
      <div class="step-number">13</div>
      <div class="step-title">Mural Digital & Reserva de Espaços Comuns</div>
      <div class="step-desc">Publicação de avisos aos residentes (cortes de água, manutenções) e marcação online do salão de condomínio ou churrasqueira com controlo de datas e cauções.</div>
    </div>
    <div class="step-card">
      <div class="step-number">14</div>
      <div class="step-title">PWA Telemóvel para Todos os Residentes</div>
      <div class="step-desc">Instalação imediata sem necessitar de lojas App Store / Play Store. Suporte a autenticação biométrica (FaceID / TouchID) e funcionamento rápido em qualquer telemóvel.</div>
    </div>
  </div>

  <div class="footer-note">
    Manual Oficial de Operação CondoManager AI • Todos os direitos reservados.
  </div>
</body>
</html>`;
  }

  if (isCondomino) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.nome}</title>
  ${baseStyle}
</head>
<body>
  <div class="header-card">
    <div style="margin-bottom: 6px;">
      <span class="badge badge-desktop">💻 DESKTOP</span>
      <span class="badge badge-pwa">📱 PWA TELEMÓVEL</span>
      <span class="badge badge-age">👥 TODAS AS IDADES</span>
    </div>
    <h1>🏠 GUIA ILUSTRADO DO CONDÓMINO & RESIDENTE</h1>
    <p><strong>Edifício:</strong> ${predio.nome || "Edifício Estrela da Barra"} | <strong>Perfis:</strong> Proprietário, Condómino e Inquilino | <strong>Versão Oficial 2026</strong></p>
  </div>

  <div class="section-title">✨ COMO ACEDER E UTILIZAR (PASSO A PASSO VISUAL)</div>
  <div class="grid-2">
    <div class="step-card highlight">
      <div class="step-number">1</div>
      <div class="step-title">🔑 Acesso com Password Provisória</div>
      <div class="step-desc">Seja no computador ou no telemóvel, insira o seu e-mail e a password provisória recebida por SMS ou e-mail da Administração. Na PWA, pode ativar a <strong>Impressão Digital / FaceID</strong> para nunca mais precisar de escrever a senha.</div>
      <div class="step-tip">💡 <em>Fácil e Seguro: Não precisa de instalar nada a partir de lojas de aplicações.</em></div>
    </div>

    <div class="step-card highlight">
      <div class="step-number">2</div>
      <div class="step-title">💳 Pagamento Rápido de Quotas (MB WAY / Multibanco)</div>
      <div class="step-desc">No ecrã principal, toque no botão verde <strong>"Pagar com MB WAY"</strong> ou consulte a Referência Multibanco atribuída à sua fração. O recibo com quitação é emitido automaticamente após a boa cobrança.</div>
      <div class="step-tip">💡 <em>Confirmação instantânea sem ter de enviar comprovativos em papel.</em></div>
    </div>

    <div class="step-card">
      <div class="step-number">3</div>
      <div class="step-title">📸 Enviar Comprovativo por Fotografia Direta</div>
      <div class="step-desc">Se preferir pagar por transferência no seu banco habitual, abra o simulador/app, tire uma fotografia ao comprovativo e o sistema comprime instantaneamente em formato WebP para poupar dados e bateria.</div>
      <div class="step-tip">💡 <em>A Inteligência Artificial lê os dados do talão e associa à sua fração.</em></div>
    </div>

    <div class="step-card">
      <div class="step-number">4</div>
      <div class="step-title">✍️ Assinatura de Atas no Ecrã Tátil</div>
      <div class="step-desc">Durante ou após as assembleias, leia a ata no telemóvel e assine com o próprio dedo ou caneta tátil. A sua assinatura digital fica gravada com carimbo de data e hora inviolável.</div>
      <div class="step-tip">💡 <em>Evita deslocações e papelada desnecessária.</em></div>
    </div>

    <div class="step-card">
      <div class="step-number">5</div>
      <div class="step-title">📅 Reserva de Espaços Comuns (Salão & Churrasqueira)</div>
      <div class="step-desc">Consulte o calendário do prédio e marque a data pretendida para convívios familiares. A Administração recebe o alerta de aprovação de forma instantânea.</div>
      <div class="step-tip">💡 <em>Regras de condomínio e cauções integradas no mesmo ecrã.</em></div>
    </div>

    <div class="step-card">
      <div class="step-number">6</div>
      <div class="step-title">🚨 Reporte de Avarias e Notificações Push</div>
      <div class="step-desc">Viu uma lâmpada fundida ou o portão encravado? Abra o menu <strong>"Avarias"</strong>, fotografe o problema e o piquete técnico é acionado imediatamente. Receba notificações no telemóvel sobre o estado da reparação.</div>
      <div class="step-tip">💡 <em>Acompanhe em direto quando o técnico se deslocar ao prédio.</em></div>
    </div>
  </div>

  <div class="section-title">📊 COMPARATIVO: BROWSER DESKTOP vs. PWA NO TELEMÓVEL</div>
  <table class="comparison-table">
    <thead>
      <tr>
        <th>Funcionalidade</th>
        <th>💻 Computador (Desktop)</th>
        <th>📱 Telemóvel (PWA Mobile)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Consulta de Quotas & Recibos</strong></td>
        <td>Visualização em tabela detalhada com download em PDF</td>
        <td>Cards resumidos com botão de pagamento em 1 toque</td>
      </tr>
      <tr>
        <td><strong>Assembleias & Votação</strong></td>
        <td>Participação por vídeo-conferência no ecrã grande</td>
        <td>Voto em sondagens interativas e assinatura com o dedo</td>
      </tr>
      <tr>
        <td><strong>Envio de Fotografias / Avarias</strong></td>
        <td>Carregamento de ficheiros do disco rígido</td>
        <td>Disparo direto com a câmara traseira em formato WebP</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-note">
    Este manual foi concebido com linguagem acessível para condóminos de todas as idades. Dúvidas? Contacte a Administração pelo chat da aplicação.
  </div>
</body>
</html>`;
  }

  if (isAdmin) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.nome}</title>
  ${baseStyle}
</head>
<body>
  <div class="header-card">
    <div style="margin-bottom: 6px;">
      <span class="badge badge-desktop">💻 DESKTOP</span>
      <span class="badge badge-pwa">📱 PWA TELEMÓVEL</span>
      <span class="badge badge-age">🛡️ ADMINISTRAÇÃO</span>
    </div>
    <h1>🛡️ GUIA ILUSTRADO DO ADMINISTRADOR DE EDIFÍCIO</h1>
    <p><strong>Edifício:</strong> ${predio.nome || "Edifício Estrela da Barra"} | <strong>Módulo:</strong> Gestão Operacional, Financeira e Legal | <strong>Versão Oficial 2026</strong></p>
  </div>

  <div class="section-title">⚙️ MÓDULOS DE GESTÃO DO ADMINISTRADOR</div>
  <div class="grid-2">
    <div class="step-card highlight">
      <div class="step-number">1</div>
      <div class="step-title">💰 Finanças, Quotas e Conciliação Bancária com IA</div>
      <div class="step-desc">Emissão em lote de quotas ordinárias e fundos de reserva com referências bancárias. Carregamento de extrato bancário para conciliação automática por Inteligência Artificial, associando recebimentos às frações sem esforço manual.</div>
      <div class="step-tip">💡 <em>Reconciliação com 1 clique e arquivo automático de recibos.</em></div>
    </div>

    <div class="step-card highlight">
      <div class="step-number">2</div>
      <div class="step-title">⚖️ Assembleias, Convocatórias e Minutas de Atas IA</div>
      <div class="step-desc">Geração automática de convocatórias conforme o Código Civil com verificação de quórum. Durante a assembleia, o redator de IA regista presenças, votações por permilagem e cria a minuta de ata oficial pronta a assinar.</div>
      <div class="step-tip">💡 <em>Assinatura recolhida nos telemóveis dos condóminos presentes.</em></div>
    </div>

    <div class="step-card">
      <div class="step-number">3</div>
      <div class="step-title">📢 Comunicação Central & Notificações Web Push</div>
      <div class="step-desc">Envio de circulares informativas, avisos de corte de água ou reuniões de emergência diretamente para o ecrã bloqueado dos condóminos via Web Push e e-mail sincronizado.</div>
      <div class="step-tip">💡 <em>Registo de entrega e leitura auditável por fração.</em></div>
    </div>

    <div class="step-card">
      <div class="step-number">4</div>
      <div class="step-title">📁 Arquivo Digital Organizado & Pastas Inteligentes</div>
      <div class="step-desc">Repositório central com classificação por Anos de Exercício, Fornecedores, Contratos, Apólices e a pasta oficial <strong>Instruções PWA & Desktop</strong>.</div>
      <div class="step-tip">💡 <em>Pesquisa rápida por palavra-chave e pré-visualização instantânea.</em></div>
    </div>
  </div>

  <div class="footer-note">
    Manual exclusivo para Administradores Eleitos do Condomínio. Em conformidade com o Artigo 1436.º do Código Civil Português.
  </div>
</body>
</html>`;
  }

  if (isEmpresa) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.nome}</title>
  ${baseStyle}
</head>
<body>
  <div class="header-card">
    <div style="margin-bottom: 6px;">
      <span class="badge badge-desktop">💻 DESKTOP</span>
      <span class="badge badge-pwa">📱 PWA TELEMÓVEL</span>
      <span class="badge badge-age">🏢 GESTÃO MULTI-EDIFÍCIO</span>
    </div>
    <h1>🏢 GUIA ILUSTRADO DA EMPRESA GESTORA DE CONDOMÍNIOS</h1>
    <p><strong>Plataforma:</strong> CondoManager AI White-Label | <strong>Capacidade:</strong> Gestão de Carteiras, Automação & IA | <strong>Versão Oficial 2026</strong></p>
  </div>

  <div class="section-title">🚀 RECURSOS AVANÇADOS DA EMPRESA GESTORA</div>
  <div class="grid-2">
    <div class="step-card highlight">
      <div class="step-number">1</div>
      <div class="step-title">🎨 Identidade Visual da Empresa (White-Label)</div>
      <div class="step-desc">Personalize o logótipo, as cores corporativas, o nome da empresa e os contactos de suporte. Os condóminos e clientes vêm a sua marca na aplicação móvel e nos cabeçalhos de todos os relatórios e recibos.</div>
    </div>

    <div class="step-card highlight">
      <div class="step-number">2</div>
      <div class="step-title">🤖 Sincronizador de Caixa Postal & Auto-Responder IA</div>
      <div class="step-desc">Conexão direta à caixa de correio do condomínio. A IA reconhece anexos (faturas em PDF/imagem e comprovativos de pagamento), lança a pré-despesa ou pré-receita nos movimentos e notifica a administração para confirmação com 1 clique.</div>
    </div>

    <div class="step-card">
      <div class="step-number">3</div>
      <div class="step-title">🏢 Gestão de Carteira Multi-Prédio</div>
      <div class="step-desc">Alterne entre edifícios num clique sem ter de sair da sessão. Consolide saldos bancários, balancetes de gestão e contratos de manutenção de toda a carteira de clientes.</div>
    </div>

    <div class="step-card">
      <div class="step-number">4</div>
      <div class="step-title">🔒 Log Imutável de Auditoria (Audit Trail)</div>
      <div class="step-desc">Todas as operações de criação, alteração ou cancelamento de movimentos e quotas ficam registadas com data, hora, IP e utilizador responsável, garantindo total transparência e blindagem jurídica.</div>
    </div>
  </div>

  <div class="footer-note">
    Manual Operacional para Empresas Profissionais de Administração e Gestão de Condomínios.
  </div>
</body>
</html>`;
  }

  if (isTecnico) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.nome}</title>
  ${baseStyle}
</head>
<body>
  <div class="header-card">
    <div style="margin-bottom: 6px;">
      <span class="badge badge-pwa">📱 PWA TELEMÓVEL</span>
      <span class="badge badge-desktop">💻 DESKTOP</span>
      <span class="badge badge-age">🔧 PRESTADOR TÉCNICO</span>
    </div>
    <h1>🔧 GUIA ILUSTRADO DO PRESTADOR TÉCNICO & MANUTENÇÃO</h1>
    <p><strong>Edifício:</strong> ${predio.nome || "Edifício Estrela da Barra"} | <strong>Perfis:</strong> Piquetes, Eletricistas, Canalizadores, Elevadores | <strong>Versão Oficial 2026</strong></p>
  </div>

  <div class="section-title">🛠️ FLUXO OPERACIONAL EM CAMPO (NO TELEMÓVEL)</div>
  <div class="grid-2">
    <div class="step-card highlight">
      <div class="step-number">1</div>
      <div class="step-title">📲 Acesso com Senha Provisória na PWA</div>
      <div class="step-desc">Abra o simulador/app no seu telemóvel com as credenciais enviadas pela Administração. Terá acesso imediato à lista de ordens de serviço pendentes para o edifício.</div>
    </div>

    <div class="step-card highlight">
      <div class="step-number">2</div>
      <div class="step-title">📋 Checklist Digital de Vistoria</div>
      <div class="step-desc">Preencha a folha de vistoria oficial (elevadores, portão de garagem, bombas de água, centrais de incêndio) com validação de conformidade passo a passo.</div>
    </div>

    <div class="step-card">
      <div class="step-number">3</div>
      <div class="step-title">📸 Registo Fotográfico Antes e Depois (WebP)</div>
      <div class="step-desc">Tire fotografias diretamente na câmara do telemóvel para comprovar o diagnóstico e o trabalho executado. As fotos são anexadas automaticamente à ficha da ocorrência.</div>
    </div>

    <div class="step-card">
      <div class="step-number">4</div>
      <div class="step-title">📄 Submissão de Orçamentos e Faturas</div>
      <div class="step-desc">Envie a sua proposta comercial ou a fatura final dos trabalhos diretamente pelo portal para aprovação rápida da administração e posterior liquidação.</div>
    </div>
  </div>

  <div class="footer-note">
    Manual para Prestadores de Serviços e Técnicos Credenciados de Manutenção de Edifícios.
  </div>
</body>
</html>`;
  }

  if (isLimpezas) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.nome}</title>
  ${baseStyle}
</head>
<body>
  <div class="header-card">
    <div style="margin-bottom: 6px;">
      <span class="badge badge-pwa">📱 PWA TELEMÓVEL SIMPLIFICADA</span>
      <span class="badge badge-age">🧹 EQUIPA DE LIMPEZA</span>
    </div>
    <h1>🧹 GUIA ILUSTRADO DA EQUIPA DE LIMPEZA & HIGIENIZAÇÃO</h1>
    <p><strong>Edifício:</strong> ${predio.nome || "Edifício Estrela da Barra"} | <strong>Operação:</strong> Botões Grandes & Fácil de Usar para Qualquer Idade | <strong>Versão Oficial 2026</strong></p>
  </div>

  <div class="section-title">🧼 ROTINA DE LIMPEZA PASSO A PASSO</div>
  <div class="grid-2">
    <div class="step-card highlight">
      <div class="step-number">1</div>
      <div class="step-title">📱 Check-In com 1 Toque ao Chegar ao Prédio</div>
      <div class="step-desc">Abra o telemóvel, toque em <strong>"Iniciar Limpeza"</strong>. Não precisa de escrever textos longos. O sistema regista o dia e hora de início dos trabalhos.</div>
    </div>

    <div class="step-card highlight">
      <div class="step-number">2</div>
      <div class="step-title">✅ Checklist Visual por Piso e Áreas Comuns</div>
      <div class="step-desc">Basta tocar no botão verde para marcar o que foi limpo: <strong>Átrio de Entrada</strong>, <strong>Cabina de Elevadores</strong>, <strong>Escadarias</strong>, <strong>Corrimãos</strong> e <strong>Vidros</strong>.</div>
    </div>

    <div class="step-card">
      <div class="step-number">3</div>
      <div class="step-title">⚠️ Reportar Problema Urgente (Lâmpada ou Vidro)</div>
      <div class="step-desc">Viu uma lâmpada apagada ou um vidro partido durante a limpeza? Toque no botão vermelho <strong>"Reportar Avaria"</strong>, aponte a câmara do telemóvel e envie o alerta sem complicações.</div>
    </div>

    <div class="step-card">
      <div class="step-number">4</div>
      <div class="step-title">📦 Pedido de Reposição de Produtos</div>
      <div class="step-desc">Quando o detergente ou os sacos do lixo estiverem a acabar, assinale a caixa correspondente para que a administração providencie a compra atempada.</div>
    </div>
  </div>

  <div class="footer-note">
    Ecrã com botões ampliados e contraste reforçado para facilitar o uso durante o trabalho de campo.
  </div>
</body>
</html>`;
  }

  if (isJuridico) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.nome}</title>
  ${baseStyle}
</head>
<body>
  <div class="header-card">
    <div style="margin-bottom: 6px;">
      <span class="badge badge-desktop">💻 DESKTOP</span>
      <span class="badge badge-pwa">📱 PWA TELEMÓVEL</span>
      <span class="badge badge-age">⚖️ DEPARTAMENTO JURÍDICO</span>
    </div>
    <h1>⚖️ GUIA ILUSTRADO DO GABINETE JURÍDICO & CONTENCIOSO</h1>
    <p><strong>Edifício:</strong> ${predio.nome || "Edifício Estrela da Barra"} | <strong>Legislação:</strong> Código Civil Art. 1424.º-A e ss. | <strong>Versão Oficial 2026</strong></p>
  </div>

  <div class="section-title">📜 INSTRUMENTOS JURÍDICOS & COBRANÇA EXECUTIVA</div>
  <div class="grid-2">
    <div class="step-card highlight">
      <div class="step-number">1</div>
      <div class="step-title">📄 Emissão de Declaração de Dívida (Art. 1424.º-A)</div>
      <div class="step-desc">Emissão automática e célere do documento oficial de encargos e débitos do condomínio para instrução de escrituras públicas e alienação de frações autónomas.</div>
    </div>

    <div class="step-card highlight">
      <div class="step-number">2</div>
      <div class="step-title">⚖️ Títulos Executivos a partir de Atas de Assembleia</div>
      <div class="step-desc">Acesso direto ao repositório de atas deliberativas aprovadas e assinadas com recolha de quórum legal, constituindo título executivo imediato para cobrança judicial de dívidas.</div>
    </div>

    <div class="step-card">
      <div class="step-number">3</div>
      <div class="step-title">📬 Gestão de Pré-Contencioso e Interpelações</div>
      <div class="step-desc">Envio de cartas registadas de notificação prévia e minutas formais com cômputo automatizado de juros moratórios à taxa legal supletiva.</div>
    </div>

    <div class="step-card">
      <div class="step-number">4</div>
      <div class="step-title">🛡️ Consultadoria de Regulamento Interno</div>
      <div class="step-desc">Consulta e redação de pareceres sobre o regulamento das áreas comuns, obras de alteração de fachada e resolução de litígios entre condóminos.</div>
    </div>
  </div>

  <div class="footer-note">
    Módulo em conformidade com as alterações introduzidas pela Lei n.º 8/2022 ao regime da propriedade horizontal.
  </div>
</body>
</html>`;
  }

  if (isContabilidade) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.nome}</title>
  ${baseStyle}
</head>
<body>
  <div class="header-card">
    <div style="margin-bottom: 6px;">
      <span class="badge badge-desktop">💻 DESKTOP</span>
      <span class="badge badge-pwa">📱 PWA TELEMÓVEL</span>
      <span class="badge badge-age">📊 CONTABILIDADE & AUDITORIA</span>
    </div>
    <h1>📊 GUIA ILUSTRADO DE CONTABILIDADE & AUDITORIA</h1>
    <p><strong>Edifício:</strong> ${predio.nome || "Edifício Estrela da Barra"} | <strong>Módulo:</strong> Fecho de Contas, Balancetes e FCR | <strong>Versão Oficial 2026</strong></p>
  </div>

  <div class="section-title">📈 FUNÇÕES CONTABILÍSTICAS & CONCILIAÇÃO</div>
  <div class="grid-2">
    <div class="step-card highlight">
      <div class="step-number">1</div>
      <div class="step-title">📑 Balancetes Analíticos e Mapas Fiscais</div>
      <div class="step-desc">Extração instantânea de balancetes mensais e anuais discriminando receitas operacionais, quotas extraordinárias, despesas correntes e saldo final de tesouraria.</div>
    </div>

    <div class="step-card highlight">
      <div class="step-number">2</div>
      <div class="step-title">🛡️ Fundo Comum de Reserva (FCR Obrigatório)</div>
      <div class="step-desc">Monitorização da dotação legal obrigatória de 10% em conta poupança dedicada, com gráficos de evolução de património e separação da conta à ordem.</div>
    </div>

    <div class="step-card">
      <div class="step-number">3</div>
      <div class="step-title">🔍 Validação de Faturas OCR & Lançamento de Despesas</div>
      <div class="step-desc">Conferência das faturas lidas pelo motor de IA, validação do NIF do emitente, segregação de taxas de IVA e lançamento direto na contabilidade do prédio.</div>
    </div>

    <div class="step-card">
      <div class="step-number">4</div>
      <div class="step-title">✍️ Parecer Oficial do Conselho Fiscal & Auditor</div>
      <div class="step-desc">Área dedicada para inserção do parecer formal sobre as contas do exercício antes da apresentação em Assembleia Geral Ordinária de Condóminos.</div>
    </div>
  </div>

  <div class="footer-note">
    Documentação técnica para Técnicos Oficiais de Contas (TOC) e Comissões de Auditoria do Condomínio.
  </div>
</body>
</html>`;
  }

  if (isInstalacao) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.nome}</title>
  ${baseStyle}
</head>
<body>
  <div class="header-card">
    <div style="margin-bottom: 6px;">
      <span class="badge badge-pwa">📱 PWA NATIVA</span>
      <span class="badge badge-age">👥 QUALQUER SMARTPHONE</span>
    </div>
    <h1>📲 GUIA VISUAL DE INSTALAÇÃO NO TELEMÓVEL</h1>
    <p><strong>Sem Lojas de Apps (Sem Google Play / App Store)</strong> | Instale em 10 segundos no seu telemóvel</p>
  </div>

  <div class="section-title">🍏 NO SEU IPHONE OU IPAD (NAVEGADOR SAFARI)</div>
  <div class="grid-2">
    <div class="step-card highlight">
      <div class="step-number">1</div>
      <div class="step-title">1. Abra o link do aplicativo no Safari</div>
      <div class="step-desc">Aceda ao link do condomínio no seu Safari. Verifique que o ecrã de início da aplicação é apresentado.</div>
    </div>

    <div class="step-card highlight">
      <div class="step-number">2</div>
      <div class="step-title">2. Toque no botão "Partilhar" (Ícone Quadrado com Seta)</div>
      <div class="step-desc">Na barra inferior do Safari, toque no ícone do quadrado com a seta a apontar para cima [ ↑ ].</div>
    </div>

    <div class="step-card highlight">
      <div class="step-number">3</div>
      <div class="step-title">3. Selecione "Adicionar ao Ecrã Principal"</div>
      <div class="step-desc">Arraste a lista para baixo e toque em <strong>"Adicionar ao Ecrã Principal"</strong> (ícone com o sinal de mais [+]).</div>
    </div>

    <div class="step-card highlight">
      <div class="step-number">4</div>
      <div class="step-title">4. Toque em "Adicionar" no canto superior</div>
      <div class="step-desc">O ícone do CondoManager AI aparecerá imediatamente no ecrã do seu telemóvel ao lado das outras aplicações habituais!</div>
    </div>
  </div>

  <div class="section-title">🤖 NO SEU ANDROID (GOOGLE CHROME OU SAMSUNG INTERNET)</div>
  <div class="grid-2">
    <div class="step-card highlight">
      <div class="step-number">1</div>
      <div class="step-title">1. Abra o link do condomínio no Chrome</div>
      <div class="step-desc">Abra o navegador Google Chrome e aceda ao endereço fornecido pela Administração do Condomínio.</div>
    </div>

    <div class="step-card highlight">
      <div class="step-number">2</div>
      <div class="step-title">2. Toque na barra inferior ou nos 3 Pontos</div>
      <div class="step-desc">Muitos telemóveis mostram automaticamente a faixa <strong>"Instalar CondoManager AI"</strong>. Se não aparecer, toque nos 3 pontinhos [ ⋮ ] no canto superior direito.</div>
    </div>

    <div class="step-card highlight">
      <div class="step-number">3</div>
      <div class="step-title">3. Selecione "Instalar Aplicação"</div>
      <div class="step-desc">Toque na opção <strong>"Instalar Aplicação"</strong> ou <strong>"Adicionar ao Ecrã Inicial"</strong>.</div>
    </div>

    <div class="step-card highlight">
      <div class="step-number">4</div>
      <div class="step-title">4. Pronto a Utilizar!</div>
      <div class="step-desc">A aplicação fica instalada como se tivesse vindo da Play Store, mas sem ocupar memória pesada no telemóvel.</div>
    </div>
  </div>

  <div class="footer-note">
    Precisa de ajuda para instalar no seu telemóvel? Peça apoio a um familiar ou contacte a Administração.
  </div>
</body>
</html>`;
  }

  return null;
}
