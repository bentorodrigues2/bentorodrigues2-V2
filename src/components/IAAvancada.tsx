import React, { useState } from "react";
import { Predio, Fracao, Aviso, Movimento, Fornecedor, LoggedUser } from "../types";
import { generateAndDownloadPdf } from "../utils";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, LineChart, Line, ComposedChart } from "recharts";
import { SendingReactionModal } from "./SendingReactionModal";
import { MoneyInput } from "./MoneyInput";
import { fetchObrasExtraFromSupabase } from "../lib/supabaseService";
import type { ObraExtraordinaria } from "./GestaoManutencaoIntervencoes";

interface IAAvancadaProps {
  predio: Predio;
  fracoes: Fracao[];
  avisos: Aviso[];
  movements: Movimento[];
  fornecedores: Fornecedor[];
  loggedUser: LoggedUser;
  initialTab?: "juridico" | "orcamento_anual_ia" | "cerebro_ia";
}

interface Proposal {
  id_proposta: string;
  fornecedor: string;
  preco: number;
  prazo: string;
  garantia: string;
  detalhes: string;
  certificacoes: string;
}

const TRIGGERS_DATA = {
  trigger_5_1: {
    id: "trigger_5_1",
    section: "5.1",
    title: "Novo Condómino Criado",
    condition: "Quando a administração cria um novo condómino",
    tables: ["Condóminos", "Notificações", "Logs de Sistema", "Documentos"],
    steps: [
      "Verificação de dados obrigatórios inseridos pela administração (Nome, NIF, E-mail, Fração, Telefone, Data Nascimento).",
      "Geração automática de Password Provisória segura (ex. 9fA2#xP) com expiração programada.",
      "Criação automática do PDF das Regras do Prédio e do Manual de Utilização da Plataforma.",
      "Compilação do E-mail de Boas-Vindas contendo credenciais, links da PWA, horários, regulamentos essenciais, capacidade máxima dos espaços e equipamentos.",
      "Envio imediato do e-mail de Boas-Vindas através do servidor integrado.",
      "Registo de data de envio e alteração do estado do Condómino para 'Boas-vindas enviadas'.",
      "Gravação de evento na tabela de Auditoria / Logs de Sistema."
    ],
    example: "João Silva é criado. Password '9fA2#xP' e regulamentos enviados por e-mail automaticamente.",
    previewType: "email",
    previewContent: {
      from: "CondoManager AI <no-reply@condomanager.ai>",
      to: "joao.silva@email.com",
      subject: "Bem-vindo ao Condomínio Bento Rodrigues PP2! 🏠",
      body: `Caro João Silva,

É com grande satisfação que lhe damos as boas-vindas ao Condomínio Bento Rodrigues PP2!

A administração criou o seu acesso oficial à nossa PWA de Gestão Inteligente. Com ela poderá reportar avarias, consultar documentos do prédio, reservar áreas comuns e participar nas assembleias.

Abaixo encontram-se as suas credenciais provisórias de acesso:
• Fração Associada: Fração A (Piso 1 - T2)
• E-mail: joao.silva@email.com
• Password Provisória: 9fA2#xP

Aceda à PWA diretamente no seu telemóvel ou computador aqui:
👉 https://pwa.condomanager.ai

Enviamos em anexo os seguintes documentos essenciais para a sua integração:
1. Regulamento Interno do Prédio Bento Rodrigues PP2 (PDF)
2. Manual de Utilização Completo da Plataforma (PWA + Site)

Regras Gerais e Informações do Prédio:
• Horário de Silêncio: Dias úteis das 22:00 às 08:00, Fim de semana das 23:00 às 09:00.
• Capacidade Máxima dos Espaços: Ginásio (max. 4 pessoas), Spa (max. 2 pessoas), Piscina (max. 12 pessoas).
• Equipamentos Técnicos Disponíveis: 2 Elevadores Otis Gen2, Sistema Solar Térmico, Sala Comum de Festas.

Se tiver qualquer dúvida, entre em contacto com a nossa administração através do e-mail BentoRodrigesPP2@gmail.com ou pelo telefone 210 123 456.

Com os melhores cumprimentos,
CondoManager AI - Gestão Inteligente de Condomínios`
    }
  },
  trigger_5_2: {
    id: "trigger_5_2",
    section: "5.2",
    title: "Documento Carregado",
    condition: "Quando um novo documento entra no sistema (Upload)",
    tables: ["Documentos", "Movimentos Financeiros", "Logs de Sistema"],
    steps: [
      "Submissão do ficheiro no arquivo digital (ex. Fatura de empresa de limpeza).",
      "Processamento de OCR e extração generativa por IA (identificação de Tipo: Fatura, Fornecedor: Limpezas Estrela, Categoria: Limpeza, Ano: 2026, Valor: 180.00€).",
      "Criação automática da estrutura de diretórios em árvore: pasta '2026' e subpasta 'Limpeza'.",
      "Renomeação sistemática inteligente do ficheiro para indexação otimizada.",
      "Aplicação de metadados e Tags Inteligentes correspondentes (#limpeza, #financeiro, #fornecedor).",
      "Lançamento automático de Movimento Financeiro de despesa associado com estado 'Pendente de validação' para aprovação da administração."
    ],
    example: "Fatura de Limpezas de 180€ é carregada. IA lê, arquiva na pasta '2026/Limpeza', aplica tags e cria despesa pendente.",
    previewType: "invoice",
    previewContent: {
      fileName: "Fatura_552_Limpezas_Julho_2026.pdf",
      extractedData: {
        tipo: "Fatura de Despesa",
        fornecedor: "Limpezas Estrela Lda",
        nif: "512345678",
        valor: "180.00 €",
        data: "2026-07-17",
        ano: "2026",
        pasta: "/Documentos/2026/Limpeza",
        tags: ["limpeza", "financeiro", "fornecedor", "despesa"],
        estado_movimento: "Pendente de validação"
      }
    }
  },
  trigger_5_3: {
    id: "trigger_5_3",
    section: "5.3",
    title: "Avaria Reportada",
    condition: "Quando um condómino reporta uma avaria na PWA",
    tables: ["Intervenções", "Equipamentos Técnicos", "Fornecedores", "Notificações", "Logs de Sistema"],
    steps: [
      "Submissão da avaria pelo condómino ('Elevador da direita não funciona').",
      "Análise semântica da descrição pela IA para classificar Categoria (Elevadores) e Urgência (Crítica/Alta).",
      "Identificação automática do Equipamento correspondente no inventário técnico (Elevador nº 2 - Otis, instalado em 2018).",
      "Criação de registo automático na tabela 'Intervenções' com código interno único e estado 'Aberta'.",
      "Vínculo automático do fornecedor de manutenção contratado responsável (Otis — Elevadores).",
      "Disparo automático de e-mail de assistência técnica com descrição, morada, fotos e contactos.",
      "Envio de notificação push global e e-mail para todos os moradores notificando sobre a indisponibilidade do equipamento."
    ],
    example: "Avaria: 'Elevador direito parou'. IA cria intervenção #102, aciona Otis por e-mail e avisa condóminos.",
    previewType: "ticket",
    previewContent: {
      intervencao_id: "INT-2026-102",
      equipamento: "Elevador nº 2 (Marca: Otis)",
      tipo: "Manutenção Corretiva Urgente",
      urgencia: "Crítica",
      fornecedor: "Otis Elevadores S.A.",
      fornecedor_email: "assistencia@otis.pt",
      morada: "Rua Garret 45, Lisboa",
      notificacao_broadcast: "⚠️ Intervenção Aberta: Elevador nº 2 indisponível devido a avaria técnica. Piquete técnico acionado automaticamente às 10h15."
    }
  },
  trigger_5_4: {
    id: "trigger_5_4",
    section: "5.4",
    title: "Limpeza Concluída",
    condition: "Quando a empresa de limpezas conclui o serviço",
    tables: ["Limpezas", "Documentos", "Notificações", "Logs de Sistema"],
    steps: [
      "Operador da empresa de limpeza seleciona o prédio e clica em 'Limpeza Concluída' na PWA.",
      "Registo automático da data, hora exacta e dados do operador de limpeza.",
      "Importação automática do relatório de tarefas e fotos das áreas higienizadas para o arquivo.",
      "Leitura do relatório para identificar anomalias (ex: 'porta do ginásio não fecha').",
      "Criação automática do documento de vistoria na pasta documental correspondente.",
      "Disparo automático de notificação push para todos os condóminos: 'Limpeza concluída no prédio'."
    ],
    example: "Empresa clica em 'Terminar'. IA regista 10h32, cria o documento e avisa moradores: 'Limpeza concluída'.",
    previewType: "cleaning",
    previewContent: {
      limpeza_id: "LIM-2026-88",
      empresa: "Limpezas Estrela Lda",
      data_hora: "2026-07-17 10:32:15",
      relatorio: "Limpeza geral concluída de forma exemplar. Nota: detetada porta do ginásio que não fecha totalmente.",
      broadcast: "🧹 Limpeza concluída no prédio Bento Rodrigues PP2 às 10h32."
    }
  },
  trigger_5_5: {
    id: "trigger_5_5",
    section: "5.5",
    title: "Tarefa Técnica Concluída",
    condition: "Quando o técnico termina uma reparação ou manutenção",
    tables: ["Intervenções", "Documentos", "Notificações", "Logs de Sistema"],
    steps: [
      "Técnico acede ao painel, seleciona o prédio e clica em 'Tarefa Terminada'.",
      "Registo automático da data e hora da intervenção, relatório técnico e fotos de validação.",
      "Atualização do estado da Intervenção para 'Concluída' (aguardando homologação da administração).",
      "Geração do documento oficial da intervenção técnica e arquivamento na pasta do condomínio.",
      "Envio de notificação push para todos os condóminos: 'Intervenção concluída: Elevador nº 2'."
    ],
    example: "Técnico clica em 'Tarefa Terminada'. Estado muda para 'Concluída', gera relatório e notifica moradores.",
    previewType: "tech",
    previewContent: {
      intervencao_id: "INT-2026-102",
      tecnico: "Eng. Rui Melo",
      estado: "Concluída",
      relatorio: "Substituição do relé de chamada do 3º piso e afinação do fecho magnético.",
      broadcast: "🔧 Intervenção concluída: Elevador nº 2 funcional. Obrigado pela vossa paciência!"
    }
  },
  trigger_5_6: {
    id: "trigger_5_6",
    section: "5.6",
    title: "Pagamento Recebido",
    condition: "Quando um condómino envia um comprovativo de pagamento",
    tables: ["Movimentos Financeiros", "Frações", "Logs de Sistema"],
    steps: [
      "Upload ou receção do comprovativo bancário do condómino.",
      "Extração inteligente do valor do depósito (ex. 300.00€) e titular da conta associada.",
      "Comparação matemática com o valor unitário da quota ordinária da fração (ex. 50.00€).",
      "Identificação matemática de cobertura múltipla: 300€ / 50€ = 6 meses de quotas ordinárias pagas.",
      "Sugestão automática ao administrador: 'Deseja lançar 6 meses de quotas? Pagamento múltiplo detetado'.",
      "Lançamento automático de 6 movimentos financeiros individualizados e isenção de notas de cobrança para os próximos 6 meses."
    ],
    example: "Condómino paga 300€ (Quota 50€). IA deteta 6 meses, lança 6 movimentos e suspende cobranças futuras.",
    previewType: "payment",
    previewContent: {
      titular: "João Silva",
      fracao: "Fração A",
      valor_total: 300.00,
      quota_unitaria: 50.00,
      multiplo_detetado: "6 Meses de Quotas",
      acao_automatica: "Gerar 6 lançamentos de receita e suspender avisos até 12/2026."
    }
  },
  trigger_5_7: {
    id: "trigger_5_7",
    section: "5.7",
    title: "Dia 25 do Mês (Cobrança)",
    condition: "Todos os dias 25 de cada mês às 08:00",
    tables: ["Movimentos Financeiros", "Notificações", "Documentos", "Logs de Sistema"],
    steps: [
      "Varrimento automático diário ao atingir o Dia 25 do mês.",
      "Identificação de todos os condóminos com quotas mensais ativas cujo estado do aviso é pendente/não pago.",
      "Geração automatizada de Nota de Cobrança PDF personalizada.",
      "Envio automatizado de E-mail de Cobrança ('A sua quota do mês X encontra-se em atraso. Em anexo nota de cobrança.').",
      "Disparo de notificação push para a PWA móvel do devedor.",
      "Registo da data de envio do aviso de cobrança e atualização do estado para 'Cobrança enviada'."
    ],
    example: "Chega o Dia 25. Maria tem quota pendente. IA envia e-mail de cobrança com PDF e push de alerta.",
    previewType: "alert",
    previewContent: {
      data: "Dia 25 de Julho",
      avisos_gerados: [
        { fracao: "Fração H", devedor: "Maria Antónia", valor: "50.00 €", estado: "Cobrança enviada" },
        { fracao: "Fração F", devedor: "Luís Pereira", valor: "50.00 €", estado: "Cobrança enviada" }
      ],
      notificacao_push: "⚠️ [CondoManager] Detetámos que a sua quota de Julho encontra-se em atraso. Por favor verifique o seu e-mail para regularizar."
    }
  },
  trigger_5_8: {
    id: "trigger_5_8",
    section: "5.8",
    title: "Documento Jurídico / Validade Próxima",
    condition: "Deteção automática de documento legal próximo do termo de validade",
    tables: ["Contratos", "Seguros", "Certidões", "Notificações", "Logs de Sistema"],
    steps: [
      "Varrimento preventivo diário da validade de seguros, contratos de manutenção e certidões técnicas obrigatórias.",
      "Deteção de documentos legais que irão expirar nos próximos 30 dias (ex: Inspeção de Elevadores ou Seguro Multirriscos).",
      "Disparo automático de alerta de conformidade crítico no painel de administração da Empresa Gestora.",
      "Geração de notificação por e-mail e push para a administração.",
      "Criação automática de minuta de renegociação de contrato ou marcação de vistoria técnica legal."
    ],
    example: "Seguro do prédio expira em 30 dias. IA deteta, cria alerta visual vermelho e minuta e-mail de renegociação.",
    previewType: "juridico_alert",
    previewContent: {
      alertas: [
        { documento: "Seguro Multirriscos (Allianz)", validade: "2026-08-12", dias_restantes: 26, acao: "Solicitar simulações automáticas" },
        { documento: "Certificado de Inspeção de Elevadores (ISQ)", validade: "2026-08-18", dias_restantes: 32, acao: "Agendar vistoria técnica ISQ" }
      ],
      minuta: "Estimados Srs. Allianz, pretendemos renegociar as condições da apólice multirriscos do Edifício Bento Rodrigues PP2 que vence no dia 12 de Agosto..."
    }
  },
  trigger_5_9: {
    id: "trigger_5_9",
    section: "5.9",
    title: "Exportação Solicitada",
    condition: "Quando o utilizador solicita exportação de relatórios",
    tables: ["Exportações", "Documentos", "Logs de Sistema"],
    steps: [
      "Receção do pedido de exportação (balancetes gerais, listagens fiscais, extratos de conta).",
      "Processamento e geração encriptada do ficheiro solicitado (formato PDF ou Excel).",
      "Registo automático da ação na tabela de auditoria contendo data, utilizador e IP para fins de conformidade RGPD.",
      "Backup automático do ficheiro gerado na pasta do condomínio `/Exportações/2026/`.",
      "Disponibilização do link de descarga segura para o utilizador."
    ],
    example: "Administrador exporta balancete. IA cria ficheiro, guarda no arquivo digital e regista log de auditoria.",
    previewType: "export",
    previewContent: {
      ficheiro: "Balancete_Financeiro_Geral_Julho2026.xlsx",
      tamanho: "412 KB",
      gerado_por: "Carlos Administrador",
      link: "https://condomanager.ai/descarga/segura/balancete_julho_2026_nb.xlsx",
      log_conformidade: "Exportação Excel efetuada por Carlos Administrador, IP: 192.168.1.45, Dispositivo: Chrome 126.0 - Windows 11"
    }
  },
  trigger_fg_comm_1: {
    id: "trigger_fg_comm_1",
    section: "ADENDA 3.1",
    title: "Mensagem Global Enviada (Broadcast)",
    condition: "Quando a administração envia um comunicado geral para todas as frações",
    tables: ["Comunicados", "Notificações", "Logs de Sistema", "Documentos"],
    steps: [
      "Verificação dos campos obrigatórios do comunicado (Título, Mensagem, Categoria, Urgência).",
      "Análise de sentimentos e revisão ortográfica/sintática generativa com IA.",
      "Criação automática do PDF formatado do comunicado oficial.",
      "Compilação e disparo de e-mails em lote para todos os condóminos registados.",
      "Disparo de notificações push em tempo real (PWA) de acordo com a urgência.",
      "Indexação automática do PDF oficial na pasta de arquivo digital `/Documentos/Comunicados/2026/`.",
      "Registo do log de envio na tabela de Auditoria."
    ],
    example: "Administrador envia comunicado de corte de água. IA gera PDF, dispara e-mails/push e arquiva documento.",
    previewType: "email",
    previewContent: {
      from: "Administração Bento Rodrigues <comunicados@condomanager.ai>",
      to: "todos-condominos@bento-rodrigues.pt",
      subject: "🚨 [URGENTE] Interrupção Temporária do Abastecimento de Água - 23/Julho",
      body: `Estimados Condóminos,

Vimos por este meio informar que, devido a uma intervenção técnica urgente na conduta principal de distribuição do Edifício Bento Rodrigues PP2, haverá uma interrupção temporária no fornecimento de água no próximo dia 23 de Julho (Quinta-feira), entre as 09:00 e as 12:30.

Esta intervenção é absolutamente crucial para prevenir uma rutura iminente detetada pelos sensores preditivos de pressão de água.

Recomendamos que tomem as devidas precauções e evitem a utilização de eletrodomésticos de grande consumo de água (máquinas de lavar roupa/loiça) durante este período.

Encontra-se em anexo a nota técnica oficial assinada pela administração:
👉 Anexo: Comunicado_Tecnico_Agua_2026.pdf

Agradecemos desde já a vossa compreensão e colaboração para a melhoria constante da segurança do nosso condomínio.

Com os melhores cumprimentos,
A Administração do Condomínio Bento Rodrigues PP2`
    }
  },
  trigger_fg_comm_2: {
    id: "trigger_fg_comm_2",
    section: "ADENDA 3.2",
    title: "Nova Mensagem de Condómino (Inbox)",
    condition: "Quando um condómino envia uma mensagem individual para a administração",
    tables: ["Conversações", "Mensagens", "Logs de Sistema"],
    steps: [
      "Receção da mensagem do condómino através da PWA.",
      "Análise generativa por IA para classificação automática de categoria (Financeiro, Técnico, Jurídico, Geral).",
      "Identificação do grau de urgência e proposta automática de minuta de resposta na caixa de entrada da administração.",
      "Notificação por e-mail ou push à administração sobre a nova mensagem pendente.",
      "Atualização do estado da conversação para 'Pendente de Resposta'."
    ],
    example: "Fração C envia mensagem sobre infiltração. IA categoriza como 'Técnico', define urgência como 'Alta' e pré-redige resposta.",
    previewType: "juridico_alert",
    previewContent: {
      alertas: [
        { documento: "Mensagem da Fração C (Infiltração)", dias_restantes: "Prazo: 24h", acao: "Aprovar a minuta técnica gerada para envio ao empreiteiro de manutenção" }
      ],
      minuta: "Estimado condómino da Fração C, acusamos a receção do seu alerta relativo à infiltração no teto da casa de banho. Um técnico credenciado da nossa parceira de manutenção preventiva foi agendado para inspecionar o local amanhã entre as 10h e as 12h. Agradecemos o aviso imediato."
    }
  },
  trigger_fg_comm_3: {
    id: "trigger_fg_comm_3",
    section: "ADENDA 3.3",
    title: "Sondagem Criada",
    condition: "Quando a administração lança uma sondagem oficial de opinião",
    tables: ["Sondagens", "Notificações", "Logs de Sistema"],
    steps: [
      "Criação dos metadados da sondagem (Pergunta, Opções, Data Limite, Visibilidade).",
      "Compilação automática por IA do texto explicativo sobre o impacto ou justificação da sondagem.",
      "Disparo de notificações push para todos os condóminos elegíveis com link direto para votação.",
      "Registo de auditoria da criação da sondagem."
    ],
    example: "Lançamento de sondagem sobre instalação de carregador elétrico. Notificação disparada para todos.",
    previewType: "alert",
    previewContent: {
      notificacao_push: "🔔 Nova Sondagem Ativa: Instalação de Painéis Solares Fotovoltaicos. Vote na PWA até 30/Julho!",
      avisos_gerados: [
        { fracao: "Sondagem ID #12", devedor: "Instalação de Painéis Solares", valor: "Aberta", estado: "Pendente de Voto" }
      ]
    }
  },
  trigger_fg_comm_4: {
    id: "trigger_fg_comm_4",
    section: "ADENDA 3.4",
    title: "Sondagem Fechada",
    condition: "Quando o prazo de uma sondagem expira ou é encerrada manualmente",
    tables: ["Sondagens", "Respostas de Sondagens", "Documentos", "Logs de Sistema"],
    steps: [
      "Bloqueio imediato de novas respostas na sondagem.",
      "Contagem e análise estatística dos votos.",
      "Geração automática por IA de um Relatório PDF detalhado contendo gráficos e resumo executivo.",
      "Arquivamento do Relatório na pasta `/Documentos/Sondagens/2026/`.",
      "Envio do resumo dos resultados por e-mail e notificação push para todos os participantes."
    ],
    example: "Sondagem de painéis solares é encerrada. IA gera relatório PDF com 75% de aprovação e publica no arquivo.",
    previewType: "export",
    previewContent: {
      ficheiro: "Relatorio_Sondagem_Paineis_Solares_2026.pdf",
      tamanho: "256 KB",
      gerado_por: "CondoManager AI - Auditor",
      link: "https://condomanager.ai/descarga/segura/relatorio_sondagem_paineis.pdf",
      log_conformidade: "Sondagem encerrada com 12 votos válidos (75% Sim, 25% Não). PDF gerado e assinado digitalmente."
    }
  },
  trigger_fg_comm_5: {
    id: "trigger_fg_comm_5",
    section: "ADENDA 3.5",
    title: "Questionário Criado",
    condition: "Quando a administração emite um questionário estruturado de satisfação ou avaliação",
    tables: ["Questionários", "Notificações", "Logs de Sistema"],
    steps: [
      "Estruturação das perguntas abertas e fechadas pela administração.",
      "Revisão sintática e formatação por IA para otimizar taxa de resposta.",
      "Envio de e-mails com link individualizado e disparos push na PWA.",
      "Registo de criação do questionário para auditoria."
    ],
    example: "Questionário de avaliação da empresa de limpezas enviado para recolha de feedback das frações.",
    previewType: "alert",
    previewContent: {
      notificacao_push: "📋 Questionário Disponível: Avaliação dos Serviços de Limpeza 2026. Partilhe a sua opinião!",
      avisos_gerados: [
        { fracao: "Quest. ID #5", devedor: "Avaliação Limpeza Trimestral", valor: "Ativo", estado: "Pendente" }
      ]
    }
  },
  trigger_fg_comm_6: {
    id: "trigger_fg_comm_6",
    section: "ADENDA 3.6",
    title: "Questionário Fechado",
    condition: "Quando o período de recolha de questionários termina",
    tables: ["Questionários", "Respostas de Questionários", "Documentos", "Logs de Sistema"],
    steps: [
      "Encerramento da submissão de respostas.",
      "Agrupamento inteligente de respostas abertas através de Processamento de Linguagem Natural (NLP) da IA para extração de tendências e sugestões recorrentes.",
      "Geração de Relatório de Satisfação consolidado em PDF com plano de ação proposto.",
      "Arquivamento digital do relatório na pasta `/Documentos/Questionarios/2026/`.",
      "Disponibilização do relatório final para consulta da administração."
    ],
    example: "Questionário de limpezas fechado. IA analisa respostas abertas, extrai reclamações comuns e sugere melhorias à equipa.",
    previewType: "export",
    previewContent: {
      ficheiro: "Balanço_Qualidade_Servicos_Limpeza_2026.pdf",
      tamanho: "310 KB",
      gerado_por: "CondoManager AI - Auditor",
      link: "https://condomanager.ai/descarga/segura/relatorio_limpeza_satisfacao.pdf",
      log_conformidade: "NLP processou 8 questionários. Principais tópicos extraídos: Garagem (+ reclamações), Escadarias (+ elogios)."
    }
  }
};

const TABLES_DATA = {
  predios: {
    name: "3.1 Tabela: Prédios",
    icon: "fa-building",
    desc: "Armazena todos os prédios geridos pela administração, contendo metadados técnicos, e-mail de gestão e capacidades.",
    fields: [
      { name: "id_predio", type: "UUID / String (PK)", desc: "Identificador único do edifício" },
      { name: "nome_predio", type: "String", desc: "Nome identificativo (ex: Bento Rodrigues PP2)" },
      { name: "morada", type: "String", desc: "Localização completa do imóvel" },
      { name: "codigo_postal", type: "String", desc: "Código postal do imóvel" },
      { name: "localidade", type: "String", desc: "Freguesia / Cidade" },
      { name: "email_administracao", type: "String", desc: "Endereço eletrónico oficial da gestão" },
      { name: "contacto_telefonico", type: "String", desc: "Linha telefónica de suporte" },
      { name: "numero_fracoes", type: "Integer", desc: "Total de frações do edifício (ex: 32)" },
      { name: "equipamentos_existentes", type: "String", desc: "Metadados técnicos (ex: 2 elevadores)" },
      { name: "capacidade_maxima_espacos", type: "JSON", desc: "Capacidade limite de ginásio, spa, piscina" },
      { name: "regras_predio_pdf", type: "PDF / Link", desc: "PDF gerado automaticamente com regras do prédio" },
      { name: "data_criacao", type: "Timestamp", desc: "Data de registo do prédio no ERP" }
    ],
    relations: ["Prédio → Frações (1:N)", "Prédio → Condóminos (1:N)", "Prédio → Movimentos Financeiros (1:N)", "Prédio → Intervenções (1:N)"],
    example: "Prédio Bento Rodrigues PP2, 32 frações, 2 elevadores, 1 ginásio, 1 spa, 1 piscina. Email: BentoRodrigesPP2@gmail.com"
  },
  fracoes: {
    name: "3.2 Tabela: Frações",
    icon: "fa-door-open",
    desc: "Armazena cada fração autónoma de cada prédio do sistema.",
    fields: [
      { name: "id_fracao", type: "UUID / String (PK)", desc: "Identificador único da fração" },
      { name: "id_predio", type: "UUID / String (FK)", desc: "Vínculo ao prédio associado" },
      { name: "numero_fracao", type: "String", desc: "Designação da fração (ex: Fração A)" },
      { name: "piso", type: "String", desc: "Andar (ex: Piso 1)" },
      { name: "tipologia", type: "String", desc: "Tipologia do imóvel (ex: T2)" },
      { name: "area", type: "Decimal", desc: "Área em metros quadrados" },
      { name: "condomino_responsavel", type: "UUID / String (FK)", desc: "Condómino responsável pelo pagamento" },
      { name: "estado", type: "String", desc: "Estado da fração ('ocupada' ou 'vazia')" }
    ],
    relations: ["Prédio → Frações (1:N)", "Fração → Condómino (1:1)"],
    example: "Fração A — Piso 1 — T2 — Condómino: João Silva"
  },
  condominos: {
    name: "3.3 Tabela: Condóminos",
    icon: "fa-users",
    desc: "Armazena todos os condóminos proprietários ou arrendatários dos prédios geridos.",
    fields: [
      { name: "id_condomino", type: "UUID / String (PK)", desc: "Identificador do condómino" },
      { name: "nome", type: "String", desc: "Nome completo do condómino" },
      { name: "email", type: "String", desc: "E-mail de correspondência oficial" },
      { name: "telefone", type: "String", desc: "Contacto telefónico de emergência" },
      { name: "data_nascimento", type: "Date", desc: "Data de nascimento" },
      { name: "fracao_associada", type: "UUID / String (FK)", desc: "Fração à qual está vinculado" },
      { name: "password_provisoria", type: "String", desc: "Password gerada pela IA no onboarding" },
      { name: "password_atual", type: "String", desc: "Password encriptada em vigor" },
      { name: "estado", type: "String", desc: "Estado do condómino ('ativo' ou 'inativo')" },
      { name: "data_entrada", type: "Date", desc: "Data de registo" },
      { name: "historico_interacoes", type: "JSON", desc: "Histórico consolidado de interações e contatos" }
    ],
    relations: ["Fração → Condómino (1:1)", "Prédio → Condóminos (1:N)", "Condómino → Movimentos Financeiros (1:N)", "Condómino → Notificações (1:N)"],
    example: "João Silva — Fração A — Entrada em 12/03/2026"
  },
  movimentos: {
    name: "3.4 Tabela: Movimentos Financeiros",
    icon: "fa-money-bill-transfer",
    desc: "Regista todos os fluxos financeiros de receitas e despesas pertencentes ao prédio.",
    fields: [
      { name: "id_movimento", type: "UUID / String (PK)", desc: "Código único da transação" },
      { name: "id_predio", type: "UUID / String (FK)", desc: "Prédio de destino" },
      { name: "id_condomino", type: "UUID (FK, opcional)", desc: "Condómino responsável pelo pagamento" },
      { name: "tipo", type: "String", desc: "Categoria ('quota', 'obra', 'limpeza', 'seguro')" },
      { name: "valor", type: "Decimal", desc: "Montante da transação em Euros (€)" },
      { name: "data", type: "Date", desc: "Data de registo ou vencimento" },
      { name: "estado", type: "String", desc: "Estado de liquidação ('pendente', 'validado', 'pago')" },
      { name: "documento_associado", type: "UUID (FK, opcional)", desc: "Ficheiro PDF ou fatura associada" },
      { name: "metodo_pagamento", type: "String", desc: "Forma de pagamento (Transferência, Multibanco)" },
      { name: "observacoes", type: "String", desc: "Notas internas e anotações explicativas" }
    ],
    relations: ["Prédio → Movimentos Financeiros (1:N)", "Condómino → Movimentos Financeiros (1:N)"],
    example: "Quota — 50€ — Abril — Condómino João Silva — Estado: Pago"
  },
  intervencoes: {
    name: "3.5 Tabela: Intervenções",
    icon: "fa-screwdriver-wrench",
    desc: "Controlo e registo das avarias técnicas e ocorrências operacionais do edifício.",
    fields: [
      { name: "id_intervencao", type: "UUID (PK)", desc: "Código único da ocorrência técnica" },
      { name: "id_predio", type: "UUID (FK)", desc: "Vínculo ao prédio afetado" },
      { name: "tipo", type: "String", desc: "Categoria técnica ('elevador', 'bomba', 'motor')" },
      { name: "equipamento", type: "String", desc: "Designação do equipamento (ex: Elevador nº 2)" },
      { name: "descricao_avaria", type: "String", desc: "Texto do morador que relata a avaria" },
      { name: "fotos", type: "JSON", desc: "Lista de referências de imagens de suporte" },
      { name: "estado", type: "String", desc: "Estado ('aberta', 'em curso', 'concluída')" },
      { name: "tecnico_responsavel", type: "String", desc: "Operacional responsável pela reparação" },
      { name: "fornecedor_responsavel", type: "UUID (FK)", desc: "Empresa externa responsável (ex: Otis)" },
      { name: "data_abertura", type: "Date", desc: "Instante de criação do registo" },
      { name: "data_conclusao", type: "Date", desc: "Instante de conclusão dos trabalhos" },
      { name: "documentos_associados", type: "JSON", desc: "Lista de faturas ou relatórios técnicos" }
    ],
    relations: ["Prédio → Intervenções (1:N)", "Equipamento → Intervenções (1:N)", "Fornecedor → Intervenções (1:N)", "Intervenção → Documentos (1:N)"],
    example: "Intervenção #102, Elevador nº 2, Avaria: não sobe, Estado: Aberta, Fornecedor: Otis, Data: 12/07/2026"
  },
  limpezas: {
    name: "3.6 Tabela: Limpezas",
    icon: "fa-broom",
    desc: "Registo histórico das limpezas e higienizações efetuadas pelas empresas externas de limpeza.",
    fields: [
      { name: "id_limpeza", type: "UUID (PK)", desc: "Registo único de limpeza" },
      { name: "id_predio", type: "UUID (FK)", desc: "Prédio higienizado" },
      { name: "empresa_limpeza", type: "String", desc: "Nome da empresa contratada" },
      { name: "data", type: "Date", desc: "Dia da higienização" },
      { name: "hora", type: "Time", desc: "Instante de conclusão do serviço" },
      { name: "fotos", type: "JSON", desc: "Imagens que atestam a qualidade do serviço" },
      { name: "relatorio", type: "String", desc: "Breve relatório preenchido pela empresa" },
      { name: "avarias_encontradas", type: "String", desc: "Eventuais anomalias identificadas" },
      { name: "estado", type: "String", desc: "Estado do registo ('pendente', 'concluída')" }
    ],
    relations: ["Prédio → Limpezas (1:N)", "Limpeza → Documentos (1:N)"],
    example: "Limpeza #88, Prédio Bento Rodrigues PP2, Concluída às 10h32. Avaria encontrada: porta do ginásio não fecha"
  },
  obras: {
    name: "3.7 Tabela: Obras",
    icon: "fa-helmet-safety",
    desc: "Regista obras e intervenções estruturais extraordinárias planeadas ou ativas.",
    fields: [
      { name: "id_obra", type: "UUID (PK)", desc: "Identificador único da obra" },
      { name: "id_predio", type: "UUID (FK)", desc: "Prédio que acolhe os trabalhos" },
      { name: "tipo", type: "String", desc: "Tipo de intervenção (Pintura, Impermeabilização)" },
      { name: "fornecedor", type: "String", desc: "Empreiteiro adjudicado para os trabalhos" },
      { name: "valor", type: "Decimal", desc: "Montante global adjudicado" },
      { name: "estado", type: "String", desc: "Estado ('planeada', 'adjudicada', 'concluída')" },
      { name: "documentos_associados", type: "JSON", desc: "Orçamentos, contratos de obra e atas" },
      { name: "data_inicio", type: "Date", desc: "Data de início" },
      { name: "data_conclusao", type: "Date", desc: "Previsão ou fecho efetivo" }
    ],
    relations: ["Prédio → Obras (1:N)", "Obra → Documentos (1:N)"],
    example: "Obra #12, Pintura das escadas, Valor: 3.200€, Estado: Adjudicada"
  },
  fornecedores: {
    name: "3.8 Tabela: Fornecedores",
    icon: "fa-truck-field",
    desc: "Base de dados geral de fornecedores técnicos, de serviços e de seguros.",
    fields: [
      { name: "id_fornecedor", type: "UUID (PK)", desc: "Identificador do fornecedor" },
      { name: "nome", type: "String", desc: "Designação comercial" },
      { name: "email_assistencia", type: "String", desc: "Correio eletrónico de suporte prioritário" },
      { name: "telefone", type: "String", desc: "Contacto de emergência técnica" },
      { name: "whatsapp", type: "String", desc: "Número alternativo para envio de alertas" },
      { name: "tipo", type: "String", desc: "Especialidade ('elevadores', 'limpeza', 'bombas')" },
      { name: "predios_atribuidos", type: "JSON", desc: "Lista de edifícios sob contrato de manutenção" }
    ],
    relations: ["Fornecedor → Intervenções (1:N)"],
    example: "Otis — Elevadores — Email: assistencia@otis.pt"
  },
  equipamentos: {
    name: "3.9 Tabela: Equipamentos Técnicos",
    icon: "fa-gears",
    desc: "Regista o inventário técnico e maquinaria instalada em cada prédio.",
    fields: [
      { name: "id_equipamento", type: "UUID (PK)", desc: "Identificador do equipamento" },
      { name: "id_predio", type: "UUID (FK)", desc: "Prédio de instalação" },
      { name: "tipo", type: "String", desc: "Tipo de equipamento (Elevador, Bomba, Clarabóia)" },
      { name: "numero", type: "String", desc: "Identificação local (ex: Elevador nº 2)" },
      { name: "marca", type: "String", desc: "Marca comercial do fabricante" },
      { name: "modelo", type: "String", desc: "Especificação do modelo" },
      { name: "data_instalacao", type: "Date", desc: "Ano ou data de instalação" },
      { name: "estado", type: "String", desc: "Estado operativo atual ('funcional', 'avariado')" }
    ],
    relations: ["Prédio → Equipamentos Técnicos (1:N)", "Equipamento → Intervenções (1:N)"],
    example: "Elevador nº 2 — Otis — instalado em 2018"
  },
  documentos: {
    name: "3.10 Tabela: Documentos",
    icon: "fa-file-pdf",
    desc: "Base do arquivo documental digitalizado e categorizado do prédio.",
    fields: [
      { name: "id_documento", type: "UUID (PK)", desc: "Código do documento" },
      { name: "id_predio", type: "UUID (FK)", desc: "Edifício ao qual pertence" },
      { name: "tipo", type: "String", desc: "Natureza do ficheiro (Fatura, Relatório, Seguro)" },
      { name: "ano", type: "String", desc: "Ano civil de enquadramento" },
      { name: "pasta", type: "String", desc: "Pasta de indexação principal (ex: 2026)" },
      { name: "subpasta", type: "String", desc: "Subcategoria (ex: Limpeza)" },
      { name: "tags", type: "JSON", desc: "Lista de tags de categorização por IA" },
      { name: "ficheiro", type: "String", desc: "Link para o binário do ficheiro" },
      { name: "data_upload", type: "Timestamp", desc: "Momento da submissão" },
      { name: "origem", type: "String", desc: "Quem introduziu ('email', 'condomino', 'limpeza')" }
    ],
    relations: ["Prédio → Documentos (1:N)", "Condómino → Documentos (1:N)", "Documento → Tags (N:N)"],
    example: "Fatura #552 — Limpeza — Março 2026 — Pasta: 2026/Limpeza"
  },
  comunicados: {
    name: "3.11 Tabela: Comunicados",
    icon: "fa-bullhorn",
    desc: "Registo dos comunicados globais (broadcast) enviados pela administração às frações.",
    fields: [
      { name: "id_comunicado", type: "UUID (PK)", desc: "Código único do comunicado" },
      { name: "id_predio", type: "UUID (FK)", desc: "Edifício ao qual se aplica" },
      { name: "titulo", type: "String", desc: "Assunto / Título do comunicado" },
      { name: "mensagem", type: "Text", desc: "Conteúdo textual completo" },
      { name: "anexos", type: "JSON", desc: "Lista de links para ficheiros anexados (ex: PDF)" },
      { name: "data_envio", type: "Timestamp", desc: "Data e hora do disparo" },
      { name: "urgencia", type: "String", desc: "Grau de urgência ('normal', 'urgente')" },
      { name: "estado", type: "String", desc: "Estado de distribuição ('enviado', 'falhado')" }
    ],
    relations: ["Prédio → Comunicados (1:N)"],
    example: "Aviso de manutenção preventiva de elevadores em 20/Julho."
  },
  mensagens: {
    name: "3.12 Tabela: Mensagens",
    icon: "fa-envelope",
    desc: "Histórico de mensagens individuais trocadas entre condóminos e a administração.",
    fields: [
      { name: "id_mensagem", type: "UUID (PK)", desc: "Código da mensagem" },
      { name: "id_conversacao", type: "UUID (FK)", desc: "Conversação à qual pertence" },
      { name: "autor", type: "String", desc: "Quem escreveu ('condomino', 'administracao')" },
      { name: "texto", type: "Text", desc: "Conteúdo textual" },
      { name: "anexos", type: "JSON", desc: "Anexos inseridos na mensagem" },
      { name: "data_envio", type: "Timestamp", desc: "Data e hora" },
      { name: "estado_leitura", type: "Boolean", desc: "Se foi lida pelo destinatário" }
    ],
    relations: ["Conversação → Mensagens (1:N)"],
    example: "Condómino pergunta sobre o atraso no envio do recibo de condomínio."
  },
  conversacoes: {
    name: "3.13 Tabela: Conversações",
    icon: "fa-comments",
    desc: "Canal ou tópico que agrupa o histórico de mensagens de uma fração específica.",
    fields: [
      { name: "id_conversacao", type: "UUID (PK)", desc: "Código da conversa" },
      { name: "id_fracao", type: "UUID (FK)", desc: "Fração que iniciou a conversa" },
      { name: "categoria_ia", type: "String", desc: "Classificação automática por IA ('financeiro', 'tecnico', 'juridico', 'geral')" },
      { name: "urgencia_ia", type: "String", desc: "Nível de urgência ('baixo', 'medio', 'alto')" },
      { name: "estado", type: "String", desc: "Estado atual ('aberta', 'pendente_resposta', 'arquivada')" },
      { name: "data_criacao", type: "Timestamp", desc: "Data de abertura do canal" },
      { name: "ultima_atualizacao", type: "Timestamp", desc: "Data da última mensagem" }
    ],
    relations: ["Fração → Conversações (1:N)", "Conversação → Mensagens (1:N)"],
    example: "Conversa de suporte técnico sobre portão da garagem avariado (Fração G)."
  },
  sondagens: {
    name: "3.14 Tabela: Sondagens",
    icon: "fa-square-poll-horizontal",
    desc: "Registo de sondagens e votações rápidas abertas pela administração.",
    fields: [
      { name: "id_sondagem", type: "UUID (PK)", desc: "Código da sondagem" },
      { name: "id_predio", type: "UUID (FK)", desc: "Edifício ao qual pertence" },
      { name: "pergunta", type: "String", desc: "Questão principal a votos" },
      { name: "opcoes", type: "JSON", desc: "Array de opções de resposta (ex: ['Sim', 'Não', 'Abster'])" },
      { name: "data_criacao", type: "Timestamp", desc: "Data de abertura" },
      { name: "data_fecho", type: "Timestamp", desc: "Data de encerramento programado/real" },
      { name: "visibilidade", type: "String", desc: "Quem pode ver os resultados parciais ('todos', 'apenas_admin')" },
      { name: "estado", type: "String", desc: "Estado ('ativa', 'fechada')" }
    ],
    relations: ["Prédio → Sondagens (1:N)", "Sondagem → Respostas (1:N)"],
    example: "Instalação de câmaras de videovigilância no hall."
  },
  respostas_sondagens: {
    name: "3.15 Tabela: Respostas de Sondagens",
    icon: "fa-check-to-slot",
    desc: "Votos e respostas individuais submetidos pelos condóminos em cada sondagem.",
    fields: [
      { name: "id_resposta_sondagem", type: "UUID (PK)", desc: "Código único do voto" },
      { name: "id_sondagem", type: "UUID (FK)", desc: "Sondagem correspondente" },
      { name: "id_fracao", type: "UUID (FK)", desc: "Fração que votou (voto por fração/permilagem)" },
      { name: "opcao_selecionada", type: "String", desc: "Opção votada" },
      { name: "data_voto", type: "Timestamp", desc: "Momento da submissão" }
    ],
    relations: ["Sondagem → Respostas (1:N)", "Fração → Respostas (1:N)"],
    example: "Fração H votou 'Sim' na sondagem de videovigilância."
  },
  questionarios: {
    name: "3.16 Tabela: Questionários",
    icon: "fa-clipboard-question",
    desc: "Estrutura dos questionários de satisfação ou diagnóstico de longa duração.",
    fields: [
      { name: "id_questionario", type: "UUID (PK)", desc: "Código do questionário" },
      { name: "id_predio", type: "UUID (FK)", desc: "Edifício de enquadramento" },
      { name: "titulo", type: "String", desc: "Nome do questionário" },
      { name: "descricao", type: "Text", desc: "Objetivo do questionário" },
      { name: "perguntas", type: "JSON", desc: "Array de objetos pergunta (tipo: aberta/fechada, título, opções)" },
      { name: "data_criacao", type: "Timestamp", desc: "Início" },
      { name: "data_fecho", type: "Timestamp", desc: "Fim da recolha" },
      { name: "estado", type: "String", desc: "Estado ('ativo', 'fechado')" }
    ],
    relations: ["Prédio → Questionários (1:N)", "Questionário → Respostas (1:N)"],
    example: "Inquérito anual de qualidade dos serviços comuns (Segurança, Limpeza, Admin)."
  },
  respostas_questionarios: {
    name: "3.17 Tabela: Respostas de Questionários",
    icon: "fa-signature",
    desc: "Respostas detalhadas preenchidas pelos condóminos para cada pergunta do questionário.",
    fields: [
      { name: "id_resposta_questionario", type: "UUID (PK)", desc: "Código da resposta submetida" },
      { name: "id_questionario", type: "UUID (FK)", desc: "Questionário correspondente" },
      { name: "id_fracao", type: "UUID (FK)", desc: "Fração respondente" },
      { name: "respostas", type: "JSON", desc: "Array de respostas dadas a cada pergunta (ID e texto/opção)" },
      { name: "data_submissao", type: "Timestamp", desc: "Data de gravação" }
    ],
    relations: ["Questionário → Respostas (1:N)", "Fração → Respostas (1:N)"],
    example: "Fração B classificou a Limpeza como 'Muito Bom' (5/5) e sugeriu lavagem mensal de garagem."
  }
};

export function IAAvancada({ predio, fracoes, avisos, movements, fornecedores, loggedUser, initialTab }: IAAvancadaProps) {
  // Tabs for the IA Avançada Dashboard
  const [activeTab, setActiveTab] = useState<"juridico" | "orcamento_anual_ia" | "cerebro_ia">(initialTab || "orcamento_anual_ia");

  const [sendingReaction, setSendingReaction] = useState<{ isOpen: boolean; type: "email" | "mensagem"; title?: string } | null>(null);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // ----------------------------------------------------
  // STATES FOR ADENDA FG-COMM (COMUNICAÇÃO & MENSAGENS)
  // ----------------------------------------------------
  const [comunicadosList, setComunicadosList] = useState<Array<{ id: string; titulo: string; mensagem: string; data_envio: string; urgencia: "normal" | "urgente"; anexos: string[]; estado: string }>>([
    {
      id: "com_1",
      titulo: "Planeamento da Manutenção dos Elevadores Otis",
      mensagem: "Estimados condóminos, informamos que no dia 20 de Julho os dois elevadores do edifício Bento Rodrigues estarão inoperacionais entre as 14:00 e as 17:00 para uma vistoria técnica anual e calibração de segurança. Agradecemos a vossa compreensão e sugerimos a utilização das escadas comuns.",
      data_envio: "15 de Julho de 2026",
      urgencia: "normal",
      anexos: ["Cronograma_Manutencao_Otis.pdf"],
      estado: "enviado"
    },
    {
      id: "com_2",
      titulo: "🚨 Convocatória Oficial para Assembleia Geral Extraordinária",
      mensagem: "Ficam por este meio convocados todos os proprietários das frações autónomas do Prédio Bento Rodrigues PP2 para reunirem em Assembleia Geral Extraordinária no próximo dia 28 de Julho, às 20h30, no salão comum do rés-do-chão. A ordem de trabalhos inclui a discussão e aprovação do plano de quotas e a instalação de painéis solares.",
      data_envio: "10 de Julho de 2026",
      urgencia: "urgente",
      anexos: ["Convocatoria_AGE_Julho_2026.pdf"],
      estado: "enviado"
    }
  ]);

  const [conversas, setConversas] = useState<Array<{
    id: string;
    fracaoNome: string;
    proprietario: string;
    categoria_ia: "Financeiro" | "Técnico" | "Jurídico" | "Geral";
    urgencia_ia: "baixo" | "medio" | "alto";
    estado: "aberta" | "pendente_resposta" | "arquivada";
    ultima_atualizacao: string;
    mensagens: Array<{ autor: "condomino" | "administracao"; texto: string; data: string }>;
  }>>([
    {
      id: "conv_1",
      fracaoNome: "Fração B",
      proprietario: "Maria Antunes",
      categoria_ia: "Financeiro",
      urgencia_ia: "baixo",
      estado: "pendente_resposta",
      ultima_atualizacao: "16 de Julho de 2026",
      mensagens: [
        { autor: "condomino", texto: "Olá, boa tarde! Gostaria de pedir se me podiam enviar a segunda via do recibo de pagamento da quota ordinária do mês de Junho. Penso que não a cheguei a receber no meu e-mail.", data: "16 de Julho de 2026 14:32" }
      ]
    },
    {
      id: "conv_2",
      fracaoNome: "Fração C",
      proprietario: "António Mendes",
      categoria_ia: "Técnico",
      urgencia_ia: "alto",
      estado: "pendente_resposta",
      ultima_atualizacao: "17 de Julho de 2026",
      mensagens: [
        { autor: "condomino", texto: "Detetei uma infiltração visível e preocupante no teto da casa de banho principal, vinda provavelmente da cobertura comum ou do terraço superior. Está a manchar o gesso cartonado. Podem mandar um técnico avaliar o quanto antes?", data: "17 de Julho de 2026 10:15" }
      ]
    },
    {
      id: "conv_3",
      fracaoNome: "Fração D",
      proprietario: "Rita Ferreira",
      categoria_ia: "Jurídico",
      urgencia_ia: "medio",
      estado: "aberta",
      ultima_atualizacao: "14 de Julho de 2026",
      mensagens: [
        { autor: "condomino", texto: "Gostaria de saber qual é o regulamento relativo ao estacionamento de bicicletas no pátio comum. É permitido deixar cadeados fixos nos pilares de betão?", data: "14 de Julho de 2026 16:10" },
        { autor: "administracao", texto: "Estimada D. Rita, segundo o Regulamento Interno do Edifício (Artigo 14º), é estritamente proibido fixar permanentemente cadeados ou objetos aos pilares estruturais e nas áreas de circulação comum para não impedir a livre passagem e evacuação. Sugerimos a utilização do parque de bicicletas próprio nas garagens.", data: "14 de Julho de 2026 17:45" }
      ]
    }
  ]);

  const [sondagensList, setSondagensList] = useState<Array<{
    id: string;
    pergunta: string;
    opcoes: string[];
    votos: Record<string, number>;
    estado: "ativa" | "fechada";
    criada: string;
    fecho: string;
    visibilidade: "todos" | "apenas_admin";
  }>>([
    {
      id: "sond_1",
      pergunta: "Deseja aprovar a instalação de pontos de carregamento para carros elétricos nas garagens comuns?",
      opcoes: ["Sim", "Não", "Prefiro adiar"],
      votos: { "Sim": 5, "Não": 2, "Prefiro adiar": 1 },
      estado: "ativa",
      criada: "12 de Julho de 2026",
      fecho: "30 de Julho de 2026",
      visibilidade: "todos"
    },
    {
      id: "sond_2",
      pergunta: "Instalação de painéis solares fotovoltaicos na cobertura do edifício para reduzir a fatura de eletricidade das partes comuns?",
      opcoes: ["Sim", "Não"],
      votos: { "Sim": 7, "Não": 1 },
      estado: "ativa",
      criada: "15 de Julho de 2026",
      fecho: "31 de Julho de 2026",
      visibilidade: "todos"
    }
  ]);

  const [questionariosList, setQuestionariosList] = useState<Array<{
    id: string;
    titulo: string;
    descricao: string;
    estado: "ativo" | "fechado";
    criado: string;
    perguntas: Array<{ id: string; tipo: "aberta" | "fechada"; titulo: string; opcoes?: string[] }>;
    respostas: Array<{ fracao: string; respostas: Record<string, string> }>;
  }>>([
    {
      id: "quest_1",
      titulo: "Inquérito de Satisfação da Limpeza e Manutenção",
      descricao: "Ajude-nos a avaliar os serviços de limpeza contratados no último trimestre para propor melhorias.",
      estado: "ativo",
      criado: "14 de Julho de 2026",
      perguntas: [
        { id: "q1", tipo: "fechada", titulo: "Como classifica a limpeza geral das escadas e hall de entrada?", opcoes: ["Excelente", "Bom", "Satisfatório", "Insuficiente"] },
        { id: "q2", tipo: "aberta", titulo: "Que áreas comuns considera que necessitam de maior frequência de limpeza?" }
      ],
      respostas: [
        { fracao: "Fração A", respostas: { "q1": "Excelente", "q2": "A garagem necessita de uma lavagem sob pressão mais frequente." } },
        { fracao: "Fração C", respostas: { "q1": "Bom", "q2": "O elevador acumula muito pó nos trilhos das portas de alumínio." } }
      ]
    }
  ]);

  // UI state for creating/replying
  const [selectedConversaId, setSelectedConversaId] = useState<string>("conv_1");
  const [respostaTexto, setRespostaTexto] = useState<string>("");
  
  // Broadcast Form State
  const [comunicadoTitulo, setComunicadoTitulo] = useState<string>("");
  const [comunicadoMensagem, setComunicadoMensagem] = useState<string>("");
  const [comunicadoUrgencia, setComunicadoUrgencia] = useState<"normal" | "urgente">("normal");
  const [comunicadoAnexo, setComunicadoAnexo] = useState<boolean>(false);
  const [comunicadoAnexoNome, setComunicadoAnexoNome] = useState<string>("Comunicado_Oficial.pdf");
  
  // Poll Form State
  const [sondagemPergunta, setSondagemPergunta] = useState<string>("");
  const [sondagemOpcao1, setSondagemOpcao1] = useState<string>("Sim");
  const [sondagemOpcao2, setSondagemOpcao2] = useState<string>("Não");
  const [sondagemOpcao3, setSondagemOpcao3] = useState<string>("Prefiro adiar");
  
  // Survey Form State
  const [questionarioTitulo, setQuestionarioTitulo] = useState<string>("");
  const [questionarioDescricao, setQuestionarioDescricao] = useState<string>("");
  const [questPergunta1, setQuestPergunta1] = useState<string>("");
  const [questPergunta2, setQuestPergunta2] = useState<string>("");

  // States for "cerebro_ia" tab (DOCUMENTO FG)
  const [cerebroSubTab, setCerebroSubTab] = useState<"triggers" | "schema" | "states">("triggers");
  const [selectedTriggerId, setSelectedTriggerId] = useState<string>("trigger_5_1");
  const [selectedTableId, setSelectedTableId] = useState<string>("predios");
  const [isSimulatingTrigger, setIsSimulatingTrigger] = useState<boolean>(false);
  const [simulationStepIndex, setSimulationStepIndex] = useState<number>(-1);
  const [realtimeLogs, setRealtimeLogs] = useState<Array<{ id: string; timestamp: string; trigger: string; message: string; type: "info" | "success" | "warning" }>>([
    { id: "log-init-1", timestamp: "08:00:00", trigger: "Sistema", message: "Cérebro IA CondoManager inicializado e pronto para processamento.", type: "success" },
    { id: "log-init-2", timestamp: "08:15:34", trigger: "Auditoria", message: "Mapeamento relacional de 18 tabelas de base de dados verificado com sucesso.", type: "info" },
    { id: "log-init-3", timestamp: "09:12:05", trigger: "Compliance", message: "Rotinas automáticas integradas (Decreto-Lei nº 268/94).", type: "info" }
  ]);

  // States for Orçamento & Projeções IA
  const [contratos, setContratos] = useState<number>(250);
  const [seguros, setSeguros] = useState<number>(800);
  const [servicos, setServicos] = useState<number>(150);
  const [manutencao, setManutencao] = useState<number>(120);
  const [limpeza, setLimpeza] = useState<number>(180);
  const [inspecoes, setInspecoes] = useState<number>(450);
  const [inadimplenciaHistorica, setInadimplenciaHistorica] = useState<number>(12);
  const [isGeneratingBudget, setIsGeneratingBudget] = useState<boolean>(false);

  // Antes deste ecrã sequer ser usado, já mostrava um "Orçamento Anual
  // Automático (IA)" completo com números e datas inventados (despesas de
  // €12.480, obras de "Pintura Geral" e "Reparação de Clarabóia" que não
  // existem, meses já passados como "Jul 26") — indistinguível de uma
  // análise real. Substituído por um estado a zeros com os 12 meses reais
  // seguintes a partir de hoje, até o administrador gerar mesmo uma análise
  // (handleRunBudgetPredictionAI, que agora usa obras reais do prédio).
  const proximosDozeMeses = (): string[] => {
    const nomesMeses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const hoje = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      return `${nomesMeses[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
    });
  };

  // Reparte o custo de cada obra real pelos meses do seu fracionamento
  // (a partir da data de início), alinhado com proximosDozeMeses() — usado
  // para preencher "obras_futuras" no gráfico com dados reais em vez do
  // valor fixo (0 ou 500€ nalguns meses) que existia antes.
  const calcularObrasFuturasPorMes = (obras: ObraExtraordinaria[], meses: string[]): number[] => {
    const nomesMeses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return meses.map(mesLabel => {
      const [nomeMes, anoCurto] = mesLabel.split(" ");
      const mesIdx = nomesMeses.indexOf(nomeMes);
      const ano = 2000 + Number(anoCurto);
      let total = 0;
      obras.forEach(o => {
        if (o.estado === "Concluída" || !o.dataInicio) return;
        const inicio = new Date(o.dataInicio);
        const duracao = Math.max(1, o.mesesFracionamento || 1);
        const fim = new Date(inicio.getFullYear(), inicio.getMonth() + duracao, 1);
        const alvo = new Date(ano, mesIdx, 1);
        if (alvo >= new Date(inicio.getFullYear(), inicio.getMonth(), 1) && alvo < fim) {
          total += (o.custoTotal || 0) / duracao;
        }
      });
      return Math.round(total * 100) / 100;
    });
  };

  const defaultBudgetResult = {
    despesas_previstas: 0,
    receitas_previstas: 0,
    fundo_minimo_legal: 0,
    fundo_recomendado: 0,
    saldo_anual_previsto: 0,
    impacto_obras: "Gere o orçamento inteligente para obter uma análise real com base nos dados deste prédio.",
    impacto_quotas_extraordinarias: "",
    impacto_inadimplencia_prevista: "",
    quota_minima: 0,
    quota_recomendada: 0,
    quota_ideal: 0,
    quota_extraordinaria: 0,
    explicacao_quotas: "",
    quota_extraordinaria_sugestao: {
      valor_total: 0,
      valor_por_fracao_medio: 0,
      fracionamentos: [3, 6, 9, 12, 18, 24].map(meses => ({ meses, valor_mensal_medio: 0 })),
      impacto_fundo: "",
      impacto_saldo: ""
    },
    chart_data: proximosDozeMeses().map(month => ({
      month, saldo_futuro: 0, despesas_futuras: 0, receitas_previstas: 0, obras_futuras: 0, inadimplencia_prevista: 0
    }))
  };

  const [budgetResult, setBudgetResult] = useState<any>(defaultBudgetResult);

  // States for delay penalties (Penalizações)
  const [aplicaPenalizacoes, setAplicaPenalizacoes] = useState<boolean>(false);
  const [frequenciaPenalizacao, setFrequenciaPenalizacao] = useState<"mensal" | "semestral" | "anual">("mensal");
  const [tipoPenalizacao, setTipoPenalizacao] = useState<"fixo" | "percentual">("percentual");
  const [valorPenalizacao, setValorPenalizacao] = useState<number>(5);
  const [carenciaDias, setCarenciaDias] = useState<number>(10);
  const [regrasExcecoes, setRegrasExcecoes] = useState<string>("Isenção para frações sob acordo de insolvência ou plano de pagamentos ativo.");

  // States for automatic reports sending
  const [enviarPdfAnual, setEnviarPdfAnual] = useState<boolean>(true);
  const [enviarResumoMensal, setEnviarResumoMensal] = useState<boolean>(true);
  const [enviarResumoTrimestral, setEnviarResumoTrimestral] = useState<boolean>(false);
  const [destinatariosEnvio, setDestinatariosEnvio] = useState<string>("all"); // "all", "owners", "debtors"
  const [isSendingSimulated, setIsSendingSimulated] = useState<boolean>(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string>("");

  // Budget Lock State
  const [isBudgetLocked, setIsBudgetLocked] = useState<boolean>(false);

  // State for Task 10: IA Avançada Previsões
  const [selectedPrevisaoTab, setSelectedPrevisaoTab] = useState<"dividas" | "manutencao" | "obras" | "financeira">("dividas");

  // Active rubrics for manual administration
  const [rubricas, setRubricas] = useState<Array<{ id: string; nome: string; valor: number; editable: boolean }>>([
    { id: "contratos", nome: "Contratos de Manutenção (Elevadores, Limpeza, etc.)", valor: 250 * 12, editable: true },
    { id: "seguros", nome: "Seguros do Edifício (Multirriscos Condomínio)", valor: 800, editable: true },
    { id: "servicos", nome: "Serviços de Administração e Apoio", valor: 150 * 12, editable: true },
    { id: "manutencao", nome: "Manutenção Preventiva Periódica", valor: 120 * 12, editable: true },
    { id: "limpeza", nome: "Limpeza Geral das Áreas Comuns", valor: 180 * 12, editable: true },
    { id: "inspecoes", nome: "Inspeções Obrigatórias e Elevadores", valor: 450, editable: true },
    { id: "obras", nome: "Fundo de Obras Futuras", valor: 12000, editable: true }
  ]);

  // New rubric form state
  const [newRubricaNome, setNewRubricaNome] = useState<string>("");
  const [newRubricaValor, setNewRubricaValor] = useState<number>(150);

  // PDF report modal controller
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);

  const handleSimulateTrigger = (triggerId: string) => {
    if (isSimulatingTrigger) return;
    setIsSimulatingTrigger(true);
    setSimulationStepIndex(0);
    
    const trigger = TRIGGERS_DATA[triggerId as keyof typeof TRIGGERS_DATA];
    if (!trigger) {
      setIsSimulatingTrigger(false);
      return;
    }

    const timestamp = new Date().toTimeString().split(" ")[0];
    const newLogs = [
      {
        id: "sim-log-" + Date.now() + "-0",
        timestamp,
        trigger: trigger.title,
        message: `[INÍCIO] Evento disparado: ${trigger.condition}`,
        type: "info" as const
      }
    ];
    setRealtimeLogs(prev => [newLogs[0], ...prev]);

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < trigger.steps.length) {
        setSimulationStepIndex(currentStep);
        const logTime = new Date().toTimeString().split(" ")[0];
        const stepLog = {
          id: "sim-log-" + Date.now() + "-" + currentStep,
          timestamp: logTime,
          trigger: trigger.title,
          message: `[PROCESSAMENTO] ${trigger.steps[currentStep]}`,
          type: "info" as const
        };
        setRealtimeLogs(prev => [stepLog, ...prev]);
      } else {
        clearInterval(interval);
        setIsSimulatingTrigger(false);
        const finalTime = new Date().toTimeString().split(" ")[0];
        const finalLog = {
          id: "sim-log-" + Date.now() + "-final",
          timestamp: finalTime,
          trigger: trigger.title,
          // Esta é uma SIMULAÇÃO ilustrativa da rotina lógica documentada no
          // Documento FG — não escreve nada na base de dados nem na
          // Auditoria Interna (a mensagem anterior afirmava isso, o que era
          // falso). Para ver a auditoria real, ir a Auditoria Interna.
          message: `[CONCLUÍDO] Simulação da rotina "${trigger.title}" terminada — passos ilustrativos apresentados acima. Isto é uma demonstração da lógica documentada, não uma execução real na base de dados.`,
          type: "success" as const
        };
        setRealtimeLogs(prev => [finalLog, ...prev]);
      }
    }, 1000);
  };

  const handleRunBudgetPredictionAI = async () => {
    setIsGeneratingBudget(true);
    try {
      // Obras reais do prédio (antes eram sempre as mesmas duas obras
      // inventadas, "Pintura Geral das Fachadas" e "Reparação de
      // Clarabóia", que nem sequer eram usadas pelo servidor).
      const obrasReais = (await fetchObrasExtraFromSupabase(predio.id_predio)) || [];
      const obrasPendentesReais = obrasReais.filter(o => o.estado !== "Concluída");
      const totalObrasReal = Math.round(obrasPendentesReais.reduce((acc, o) => acc + (o.custoTotal || 0), 0) * 100) / 100;

      const novasRubricas = [
        { id: "contratos", nome: "Contratos de Manutenção (Elevadores, Limpeza, etc.)", valor: contratos * 12, editable: true },
        { id: "seguros", nome: "Seguros do Edifício (Multirriscos Condomínio)", valor: seguros, editable: true },
        { id: "servicos", nome: "Serviços de Administração e Apoio", valor: servicos * 12, editable: true },
        { id: "manutencao", nome: "Manutenção Preventiva Periódica", valor: manutencao * 12, editable: true },
        { id: "limpeza", nome: "Limpeza Geral das Áreas Comuns", valor: limpeza * 12, editable: true },
        { id: "inspecoes", nome: "Inspeções Obrigatórias e Elevadores", valor: inspecoes, editable: true },
        { id: "obras", nome: "Fundo de Obras Futuras", valor: totalObrasReal, editable: true }
      ];

      // Números reais calculados já aqui (mesma fórmula de
      // handleRecalculateBudget) para dar à IA um contexto real sobre o
      // qual escrever a análise, em vez de lhe pedir para "inventar" ou
      // recalcular por conta própria.
      const totalDespesasReal = novasRubricas.reduce((sum, r) => sum + r.valor, 0);
      const fundoMinimoLegalReal = Math.round(totalDespesasReal * 0.10 * 100) / 100;
      const fundoRecomendadoReal = Math.round(totalDespesasReal * 0.20 * 100) / 100;
      const numFracoesReal = fracoes?.length || 1;
      const quotaRecomendadaReal = Math.round(((totalDespesasReal + fundoRecomendadoReal) / (12 * numFracoesReal)) * 100) / 100;
      const quotaMinimaReal = Math.round(((totalDespesasReal + fundoMinimoLegalReal) / (12 * numFracoesReal)) * 100) / 100;
      const quotaIdealReal = Math.round((quotaRecomendadaReal * (1 + (inadimplenciaHistorica / 100))) * 100) / 100;
      const receitasPrevistasReal = Math.round((quotaRecomendadaReal * 12 * numFracoesReal) * 100) / 100;
      const saldoAnualPrevistoReal = Math.round((receitasPrevistasReal - totalDespesasReal) * 100) / 100;

      const response = await fetch("/api/ai?acao=predict-budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predioNome: predio?.nome,
          numFracoes: numFracoesReal,
          despesasPrevistas: totalDespesasReal,
          receitasPrevistas: receitasPrevistasReal,
          fundoMinimoLegal: fundoMinimoLegalReal,
          fundoRecomendado: fundoRecomendadoReal,
          saldoAnualPrevisto: saldoAnualPrevistoReal,
          quotaMinima: quotaMinimaReal,
          quotaRecomendada: quotaRecomendadaReal,
          quotaIdeal: quotaIdealReal,
          totalObrasReal,
          obrasPendentes: obrasPendentesReais.map(o => ({ titulo: o.descricao, custo: o.custoTotal })),
          inadimplenciaHistorica
        })
      });

      const narrativa = await response.json();
      if (!response.ok || !narrativa?.success) {
        throw new Error(narrativa?.error || "Erro na análise de orçamento por IA.");
      }

      const meses = proximosDozeMeses();
      const obrasFuturasPorMes = calcularObrasFuturasPorMes(obrasPendentesReais, meses);

      setBudgetResult((prev: any) => ({
        ...prev,
        impacto_obras: narrativa.impacto_obras,
        impacto_quotas_extraordinarias: narrativa.impacto_quotas_extraordinarias,
        impacto_inadimplencia_prevista: narrativa.impacto_inadimplencia_prevista,
        explicacao_quotas: narrativa.explicacao_quotas,
        // Equivalente mensal, por fração, do custo total das obras
        // pendentes espalhado por 12 meses — antes ficava sempre no valor
        // de exemplo fixo (€15,00), nunca recalculado a sério.
        quota_extraordinaria: numFracoesReal > 0 ? Math.round((totalObrasReal / numFracoesReal / 12) * 100) / 100 : 0,
        quota_extraordinaria_sugestao: {
          valor_total: totalObrasReal,
          valor_por_fracao_medio: numFracoesReal > 0 ? Math.round((totalObrasReal / numFracoesReal) * 100) / 100 : 0,
          fracionamentos: [3, 6, 9, 12, 18, 24].map(m => ({ meses: m, valor_mensal_medio: Math.round((totalObrasReal / m) * 100) / 100 })),
          impacto_fundo: narrativa.impacto_fundo,
          impacto_saldo: narrativa.impacto_saldo
        },
        chart_data: meses.map((month, i) => ({ month, saldo_futuro: 0, despesas_futuras: 0, receitas_previstas: 0, obras_futuras: obrasFuturasPorMes[i], inadimplencia_prevista: 0 }))
      }));

      // Aplica as rubricas reais e recalcula todos os números derivados
      // (despesas, receitas, quotas, gráfico de 12 meses) por fórmula real.
      setRubricas(novasRubricas);
      setTimeout(() => handleRecalculateBudget(), 50);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao calcular orçamento IA: " + err.message);
    } finally {
      setIsGeneratingBudget(false);
    }
  };

  const handleUpdateRubricaValue = (id: string, value: number) => {
    if (isBudgetLocked) return;
    setRubricas(prev => prev.map(r => r.id === id ? { ...r, valor: value } : r));
  };

  const handleAddRubrica = (e: React.FormEvent) => {
    e.preventDefault();
    if (isBudgetLocked || !newRubricaNome.trim() || newRubricaValor <= 0) return;
    const newId = "custom_" + Date.now();
    setRubricas(prev => [
      ...prev,
      { id: newId, nome: newRubricaNome.trim(), valor: newRubricaValor, editable: true }
    ]);
    setNewRubricaNome("");
    setNewRubricaValor(150);
  };

  const handleRemoveRubrica = (id: string) => {
    if (isBudgetLocked) return;
    setRubricas(prev => prev.filter(r => r.id !== id));
  };

  const handleRecalculateBudget = () => {
    // 1. Sum up all active rubrics
    const totalDespesas = rubricas.reduce((sum, r) => sum + r.valor, 0);

    // 2. Minimum legal fund (10% of total despesas)
    const fundoLegal = Math.round(totalDespesas * 0.10 * 100) / 100;
    
    // 3. Recommended fund (20% of total despesas)
    const fundoRec = Math.round(totalDespesas * 0.20 * 100) / 100;

    const numFracoes = fracoes?.length || 8;
    const qRecomendada = Math.round(((totalDespesas + fundoRec) / (12 * numFracoes)) * 100) / 100;
    const qMinima = Math.round(((totalDespesas + fundoLegal) / (12 * numFracoes)) * 100) / 100;
    const qIdeal = Math.round((qRecomendada * (1 + (inadimplenciaHistorica / 100))) * 100) / 100;

    // base expected revenues
    let totalReceitas = Math.round((qRecomendada * 12 * numFracoes) * 100) / 100;

    // 5. Apply delay penalties impact if active
    let penaltyRevenue = 0;
    let penaltyImpactExplanation = "Sem penalizações por atraso aplicadas.";
    if (aplicaPenalizacoes) {
      // Estimate defaulting amount
      const defaultingAmount = totalReceitas * (inadimplenciaHistorica / 100);
      if (tipoPenalizacao === "percentual") {
        penaltyRevenue = Math.round(defaultingAmount * (valorPenalizacao / 100) * 100) / 100;
        penaltyImpactExplanation = `A aplicação de penalização de ${valorPenalizacao}% sobre as quotas em atraso (estimadas em €${defaultingAmount.toFixed(2)}) gerará uma receita extraordinária anual prevista de €${penaltyRevenue.toFixed(2)}, mitigando a quebra de tesouraria de ${inadimplenciaHistorica}%.`;
      } else {
        const avgDefaultingFractions = Math.max(1, Math.round(numFracoes * (inadimplenciaHistorica / 100)));
        const periods = frequenciaPenalizacao === "mensal" ? 12 : frequenciaPenalizacao === "semestral" ? 2 : 1;
        penaltyRevenue = valorPenalizacao * avgDefaultingFractions * periods;
        penaltyImpactExplanation = `A aplicação de taxa fixa de €${valorPenalizacao.toFixed(2)} (${frequenciaPenalizacao}) sobre cerca de ${avgDefaultingFractions} frações inadimplentes gerará €${penaltyRevenue.toFixed(2)} anuais de receita extraordinária.`;
      }
      totalReceitas += penaltyRevenue;
    }

    const totalSaldo = Math.round((totalReceitas - totalDespesas) * 100) / 100;

    // Update the budgetResult state with the new values
    setBudgetResult((prev: any) => ({
      ...prev,
      despesas_previstas: totalDespesas,
      receitas_previstas: totalReceitas,
      fundo_minimo_legal: fundoLegal,
      fundo_recomendado: fundoRec,
      saldo_anual_previsto: totalSaldo,
      quota_minima: qMinima,
      quota_recomendada: qRecomendada,
      quota_ideal: qIdeal,
      impacto_inadimplencia_prevista: aplicaPenalizacoes 
        ? `${penaltyImpactExplanation} O saldo final de tesouraria foi ajustado para €${totalSaldo.toFixed(2)}.` 
        : `Com inadimplência de ${inadimplenciaHistorica}%, estima-se quebra de liquidez de €${(totalReceitas * (inadimplenciaHistorica / 100)).toFixed(2)}. Nenhuma penalização ativa para compensar.`,
      chart_data: prev.chart_data?.map((item: any, idx: number) => {
        const monthlyDespesaOrdinaria = Math.round((totalDespesas - (prev.quota_extraordinaria_sugestao?.valor_total || 0)) / 12 * 100) / 100;
        const obrasMes = item.obras_futuras || 0;
        const totalMesDespesa = monthlyDespesaOrdinaria + obrasMes;
        const monthlyReceita = Math.round((totalReceitas) / 12 * 100) / 100;
        const monthlyInadimplencia = Math.round((monthlyReceita * (inadimplenciaHistorica / 100)) * 100) / 100;

        // Sem acesso ao saldo bancário real neste ecrã, o ponto de partida
        // é 0 (não um valor inventado) — o gráfico mostra a variação
        // projetada, não um saldo absoluto de tesouraria.
        let prevSaldo = idx === 0 ? 0 : prev.chart_data[idx - 1].saldo_futuro;
        const saldoFut = prevSaldo + monthlyReceita - totalMesDespesa - monthlyInadimplencia;

        return {
          ...item,
          despesas_futuras: monthlyDespesaOrdinaria,
          receitas_previstas: monthlyReceita,
          inadimplencia_prevista: monthlyInadimplencia,
          saldo_futuro: Math.round(saldoFut * 100) / 100
        };
      })
    }));
  };

  // State for Legal Assistant
  const [selectedFracaoId, setSelectedFracaoId] = useState<string>("");
  const [legalNoticeText, setLegalNoticeText] = useState<string>("");
  const [isGeneratingNotice, setIsGeneratingNotice] = useState<boolean>(false);


  // 1. IDENTIFY DEBTORES (FRACTIONS WITH PENDING PAYMENTS)
  // Group pending avisos by fraction
  const devedoresMap = (avisos || [])
    .filter(a => a && predio && a.id_predio === predio.id_predio && a.estado && a.estado.toLowerCase() === "pendente")
    .reduce((acc, current) => {
      const fracaoId = current.id_fracao;
      if (!acc[fracaoId]) {
        acc[fracaoId] = {
          fracao: (fracoes || []).find(f => f.id_fracao === fracaoId) || null,
          total: 0,
          avisos: [] as Aviso[]
        };
      }
      acc[fracaoId].total += current.valor;
      acc[fracaoId].avisos.push(current);
      return acc;
    }, {} as { [key: string]: { fracao: Fracao | null; total: number; avisos: Aviso[] } });

  const listaDevedores = Object.keys(devedoresMap).map(key => ({
    fracaoId: key,
    ...devedoresMap[key]
  })).filter(d => d.fracao !== null);

  // Generate legal notice via Gemini API
  const handleGerarMinutaLegal = async (fracaoId: string) => {
    const dData = devedoresMap[fracaoId];
    if (!dData || !dData.fracao) return;

    setIsGeneratingNotice(true);
    setLegalNoticeText("");
    setSelectedFracaoId(fracaoId);

    try {
      const response = await fetch("/api/generate-legal-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proprietario: dData.fracao.proprietario,
          fracao: dData.fracao,
          atraso: dData.avisos.map(a => ({ descricao: a.descricao, data: a.data, valor: a.valor })),
          predio: predio,
          totalDebito: dData.total
        })
      });

      if (!response.ok) throw new Error("Falha ao contactar assistente jurídico IA.");
      const resData = await response.json();
      setLegalNoticeText(resData.documentText || "Erro ao formatar o documento.");
    } catch (error: any) {
      console.error(error);
      alert("Não foi possível gerar a minuta jurídica: " + error.message);
    } finally {
      setIsGeneratingNotice(false);
    }
  };

  const handleCopiarMinuta = () => {
    navigator.clipboard.writeText(legalNoticeText);
    alert("Minuta jurídica copiada para a área de transferência!");
  };

  const handleImprimirMinutaPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return alert("Por favor, permita pop-ups para imprimir.");
    printWindow.document.write(`
      <html>
        <head>
          <title>Carta de Interpelação Legal - Notificação de Dívida</title>
          <style>
            body { font-family: 'Times New Roman', Times, serif; color: #1e293b; padding: 50px; font-size: 13px; line-height: 1.6; max-width: 800px; margin: 0 auto; }
            .content { white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <div class="content">${legalNoticeText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          <script>
            window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };


  // A "Bolsa de Orçamentos" que existia aqui foi removida — era uma
  // segunda versão, com pedidos e propostas de fornecedores 100%
  // inventados (nomes, preços e certificações fictícios), mesmo chamando
  // a IA real de comparação sobre esses dados falsos. O Portal de
  // Orçamentos real (RFPs reais, gravados no Supabase) já existe e está
  // acessível em Fornecedores → Portal de Orçamentos.

  return (
    <div className="space-y-6">
      {/* HEADER SECTION - CONSULTORIA IA */}
      <div className="bg-emerald-50 text-slate-800 p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-emerald-200 pb-4">
          <div className="flex items-center space-x-3.5">
            <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 border border-emerald-300 shrink-0 shadow-xs">
              <img src="/modulos/87-ia-ativa.png" alt="Consultoria IA" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-wide text-slate-800 flex items-center gap-2">
                <span>
                  {activeTab === "orcamento_anual_ia" && "🪄 Orçamentos & Projeções (IA)"}
                  {activeTab === "juridico" && "⚖️ Assistente Jurídico (IA)"}
                  {activeTab === "cerebro_ia" && "🧠 Analista IA (DocFG)"}
                </span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Prédio: <strong className="text-emerald-900">{predio?.nome || predio?.morada_linha1 || "Condomínio"}</strong> — Algoritmos generativos e auditoria para gestão de condomínio.
              </p>
            </div>
          </div>
          <div className="bg-white px-3.5 py-1.5 rounded-lg border border-emerald-300 text-[11px] font-bold text-emerald-800 shadow-xs flex items-center gap-1.5">
            <i className="fa-solid fa-circle-check text-emerald-600"></i>
            <span>Motor de IA Ativo & Operacional</span>
          </div>
        </div>

        {/* NOTAS EXPLICATIVAS DE CADA SUB-MENU */}
        <div className="p-4 bg-white border border-emerald-200 rounded-xl space-y-2 text-xs text-slate-700 shadow-xs">
          {activeTab === "orcamento_anual_ia" && (
            <div className="space-y-1">
              <span className="font-black text-emerald-800 uppercase tracking-wider block text-[11px]">
                <i className="fa-solid fa-circle-info mr-1.5"></i>Nota Explicativa: Orçamentos & Projeções
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Aqui pode consultar, gerar e simular os orçamentos previsionais anuais do condomínio utilizando inteligência artificial generativa. A ferramenta analisa custos históricos, contratos vigentes e estimativas de inflação para projetar quotas equilibradas.
              </p>
            </div>
          )}

          {activeTab === "juridico" && (
            <div className="space-y-1">
              <span className="font-black text-emerald-300 uppercase tracking-wider block text-[11px]">
                <i className="fa-solid fa-circle-info mr-1.5"></i>Nota Explicativa: Assistente Jurídico
              </span>
              <p className="text-[11px] text-emerald-100/90 leading-relaxed">
                Aqui pode consultar o detetor de contencioso de frações em atraso e redigir automaticamente minutas de cartas de interpelação extrajudicial e avisos de cobrança em conformidade com o Código Civil português.
              </p>
            </div>
          )}

          {activeTab === "cerebro_ia" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-emerald-700/50 pb-1.5">
                <span className="font-black text-pink-300 uppercase tracking-wider block text-[11px]">
                  <i className="fa-solid fa-brain mr-1.5 text-pink-400"></i>Central de Inteligência Documental & Base de Conhecimento (DocFG - Analista IA)
                </span>
                <span className="bg-pink-900/60 text-pink-200 text-[10px] font-bold px-2 py-0.5 rounded border border-pink-700/60">
                  Nome Sugerido: Central de Inteligência Documental (DocFG)
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/90 leading-relaxed">
                <strong>O que é & Função:</strong> O <strong>DocFG (Analista IA)</strong> é a Central de Inteligência Documental do condomínio. Funciona como uma base de conhecimento generativa que lê, analisa e indexa todas as atas de assembleia, relatórios de prestação de contas, contratos de fornecedores, certidões prediais e regulamentos internos. Permite ao gestor realizar pesquisas em linguagem natural (ex: <em>"qual o valor aprovado para a pintura em 2024?"</em>), resumir documentos extensos e efetuar verificações automáticas de auditoria e RGPD.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* 1. ASSISTENTE JURÍDICO CONTENT */}
      {activeTab === "juridico" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          {/* Debtors list and fraction selector */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Detetor de Contencioso (Faltosos em Quotas)</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                O assistente jurídico analisa em tempo real os avisos de pagamento de quotas com prazo de vencimento excedido (em atraso) para propor minutas legais extrajudiciais de aviso de cobrança.
              </p>

              {listaDevedores.length === 0 ? (
                <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold flex items-center">
                  <i className="fa-solid fa-circle-check text-emerald-500 mr-2 text-sm"></i>
                  Excelente! Todas as frações estão rigorosamente em dia com as quotas ordinárias e extraordinárias.
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {listaDevedores.map(d => (
                    <div
                      key={d.fracaoId}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedFracaoId === d.fracaoId
                          ? "border-violet-500 bg-violet-50/20 shadow-sm"
                          : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                      }`}
                      onClick={() => handleGerarMinutaLegal(d.fracaoId)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-black text-slate-800">
                            Fração {d.fracao?.fracao_nome} • Piso {d.fracao?.piso}
                          </span>
                          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Proprietário: {d.fracao?.proprietario.nome}</p>
                          <p className="text-[9px] text-slate-400">Email: {d.fracao?.proprietario.email}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-red-600 block">€{d.total.toFixed(2)}</span>
                          <span className="text-[8px] bg-red-100 text-red-800 font-extrabold px-2 py-0.5 rounded-full uppercase mt-1 inline-block">
                            {d.avisos.length} Quotas
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex justify-between items-center">
                        <span className="text-[9px] text-slate-400">
                          <i className="fa-solid fa-clock mr-1"></i>Vencido desde {d.avisos[0]?.vencimento}
                        </span>
                        <button
                          type="button"
                          className="bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-[10px] px-2.5 py-1 rounded shadow-sm transition-colors flex items-center"
                        >
                          {isGeneratingNotice && selectedFracaoId === d.fracaoId ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-1.5 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              A Redigir...
                            </>
                          ) : (
                            <>
                              <i className="fa-solid fa-file-invoice mr-1"></i> Gerar Minuta Legal
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-500 leading-relaxed space-y-2">
              <p className="font-bold text-slate-700 flex items-center">
                <i className="fa-solid fa-circle-info text-violet-500 mr-2 text-sm"></i>
                Enquadramento Legal (Código Civil)
              </p>
              <p>
                De acordo com as recentes alterações ao condomínio (Decreto-Lei nº 268/94), a ata da assembleia de condóminos constitui <strong>título executivo</strong> imediato contra o proprietário devedor. No entanto, é obrigatório um pré-aviso extrajudicial por carta registada com aviso de receção de 15 dias antes da instauração judicial.
              </p>
            </div>
          </div>

          {/* Legal Document Display (Gemini generated) */}
          <div className="lg:col-span-7">
            {isGeneratingNotice ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 min-h-[500px]">
                <div className="relative flex items-center justify-center h-16 w-16">
                  <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-20"></div>
                  <div className="relative rounded-full h-12 w-12 bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-600">
                    <i className="fa-solid fa-feather-pointed text-xl"></i>
                  </div>
                </div>
                <div className="space-y-1">
                  <h5 className="text-sm font-bold text-slate-800">Redação de Notificação Extrajudicial em Curso</h5>
                  <p className="text-xs text-slate-400 max-w-sm">O Assistente Jurídico Inteligente está a cruzar a permilagem, identificação fiscal e faturas vencidas no Código Civil Português...</p>
                </div>
              </div>
            ) : legalNoticeText ? (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col justify-between overflow-hidden min-h-[500px] animate-fadeIn">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700 flex items-center">
                    <i className="fa-solid fa-file-signature text-violet-500 mr-2 text-sm"></i>
                    Interpelação e Constituição de Mora de Quotas
                  </span>
                  <div className="flex space-x-1.5">
                    <button
                      onClick={handleCopiarMinuta}
                      className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      title="Copiar Texto"
                    >
                      <i className="fa-solid fa-copy mr-1"></i>Copiar
                    </button>
                    <button
                      onClick={handleImprimirMinutaPDF}
                      className="bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <i className="fa-solid fa-print mr-1"></i>Imprimir PDF
                    </button>
                  </div>
                </div>

                <div className="p-8 text-xs font-mono text-slate-800 leading-relaxed bg-slate-50/20 flex-grow max-h-[500px] overflow-y-auto whitespace-pre-wrap">
                  {legalNoticeText}
                </div>

                <div className="bg-slate-50 p-4 border-t border-slate-200 text-[10px] text-slate-400 italic text-center">
                  Documento lavrado automaticamente via IA Generativa em conformidade com o Código Civil de Portugal.
                </div>
              </div>
            ) : (
              <div className="bg-slate-100 border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 min-h-[500px]">
                <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
                  <i className="fa-solid fa-scale-unbalanced-flip text-xl"></i>
                </div>
                <div className="space-y-1">
                  <h5 className="text-sm font-bold text-slate-600">Aguardando Seleção de Fração devedora</h5>
                  <p className="text-xs text-slate-400 max-w-xs">Selecione uma fração com pagamentos em atraso na lista lateral para que o Assistente de IA redija a minuta jurídica correspondente.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. ORÇAMENTOS & PROJEÇÕES FINANCEIRAS IA */}
      {activeTab === "orcamento_anual_ia" && budgetResult && (
        <div className="space-y-6 animate-fadeIn">
          {/* PAINEL DEDICADO: 🔥 10. IA AVANÇADA – PREVISÕES */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-6 border border-slate-800">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-violet-400 bg-violet-950/80 border border-violet-800/60 px-3 py-1 rounded-full">
                  🔥 10. MOTOR DE IA AVANÇADA — PREVISÕES PREDITIVAS
                </span>
                <h3 className="text-lg font-black text-white mt-1 flex items-center gap-2">
                  <i className="fa-solid fa-brain text-violet-400"></i>
                  <span>Previsão de Dívidas, Manutenção, Obras e Saúde Financeira</span>
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1 rounded-full font-bold">
                ● Algoritmos Ativos & Atualizados
              </span>
            </div>

            {/* Sub Tabs Bar for 4 Predictions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setSelectedPrevisaoTab("dividas")}
                className={`p-3.5 rounded-xl border transition-all text-left cursor-pointer flex flex-col justify-between ${
                  selectedPrevisaoTab === "dividas"
                    ? "bg-violet-600 border-violet-400 text-white shadow-lg"
                    : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <div className="flex justify-between items-center">
                  <i className="fa-solid fa-file-invoice-dollar text-base"></i>
                  <span className="text-[9px] font-black uppercase tracking-wide bg-black/20 px-1.5 py-0.5 rounded">
                    Risco
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs font-black block">Previsão de Dívidas</span>
                  <span className="text-[9px] opacity-80 block mt-0.5">Inadimplência por fração</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPrevisaoTab("manutencao")}
                className={`p-3.5 rounded-xl border transition-all text-left cursor-pointer flex flex-col justify-between ${
                  selectedPrevisaoTab === "manutencao"
                    ? "bg-violet-600 border-violet-400 text-white shadow-lg"
                    : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <div className="flex justify-between items-center">
                  <i className="fa-solid fa-screwdriver-wrench text-base"></i>
                  <span className="text-[9px] font-black uppercase tracking-wide bg-black/20 px-1.5 py-0.5 rounded">
                    Técnico
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs font-black block">Previsão de Manutenção</span>
                  <span className="text-[9px] opacity-80 block mt-0.5">Degradação de equipamentos</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPrevisaoTab("obras")}
                className={`p-3.5 rounded-xl border transition-all text-left cursor-pointer flex flex-col justify-between ${
                  selectedPrevisaoTab === "obras"
                    ? "bg-violet-600 border-violet-400 text-white shadow-lg"
                    : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <div className="flex justify-between items-center">
                  <i className="fa-solid fa-building-circle-check text-base"></i>
                  <span className="text-[9px] font-black uppercase tracking-wide bg-black/20 px-1.5 py-0.5 rounded">
                    12-36 Meses
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs font-black block">Previsão de Obras</span>
                  <span className="text-[9px] opacity-80 block mt-0.5">Intervenções & Fundo Reserva</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPrevisaoTab("financeira")}
                className={`p-3.5 rounded-xl border transition-all text-left cursor-pointer flex flex-col justify-between ${
                  selectedPrevisaoTab === "financeira"
                    ? "bg-violet-600 border-violet-400 text-white shadow-lg"
                    : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <div className="flex justify-between items-center">
                  <i className="fa-solid fa-chart-line text-base"></i>
                  <span className="text-[9px] font-black uppercase tracking-wide bg-black/20 px-1.5 py-0.5 rounded">
                    Cash Flow
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs font-black block">Previsão Financeira</span>
                  <span className="text-[9px] opacity-80 block mt-0.5">Projeções a 6 e 12 meses</span>
                </div>
              </button>
            </div>

            {/* CONTENT OF PREDICTION 1: DIVIDAS */}
            {selectedPrevisaoTab === "dividas" && (
              <div className="bg-slate-800/90 p-5 rounded-xl border border-slate-700 space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <i className="fa-solid fa-triangle-exclamation text-amber-400"></i>
                      <span>Previsão de Dívidas & Probabilidade de Inadimplência por Fração</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Análise preditiva de risco baseada no histórico de pagamentos, dias de atraso e índice socioeconómico do condomínio.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/60 border border-amber-800 px-3 py-1 rounded-lg">
                    Risco Médio do Prédio: 12%
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-400 font-mono text-[10px] uppercase">
                        <th className="p-2.5">Fração / Condómino</th>
                        <th className="p-2.5 text-center">Nível de Risco IA</th>
                        <th className="p-2.5 text-right">Dívida Atual</th>
                        <th className="p-2.5 text-center">Atraso Médio</th>
                        <th className="p-2.5">Ação Automática Recomendada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60 font-mono">
                      <tr>
                        <td className="p-2.5 font-bold text-white">Fração H (3º Dto) — Maria Antónia</td>
                        <td className="p-2.5 text-center">
                          <span className="bg-red-950 text-red-400 border border-red-800 px-2 py-0.5 rounded text-[10px] font-bold">ALTO (78%)</span>
                        </td>
                        <td className="p-2.5 text-right font-bold text-red-400">€250.00</td>
                        <td className="p-2.5 text-center text-slate-300">42 dias</td>
                        <td className="p-2.5 text-slate-300 font-sans text-[11px]">
                          Enviar plano de regularização suave com fracionamento em 3x via WhatsApp/Email.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-white">Fração F (2º Esq) — Luís Pereira</td>
                        <td className="p-2.5 text-center">
                          <span className="bg-amber-950 text-amber-400 border border-amber-800 px-2 py-0.5 rounded text-[10px] font-bold">MÉDIO (42%)</span>
                        </td>
                        <td className="p-2.5 text-right font-bold text-amber-400">€100.00</td>
                        <td className="p-2.5 text-center text-slate-300">18 dias</td>
                        <td className="p-2.5 text-slate-300 font-sans text-[11px]">
                          Notificação push amigável no dia 25 com lembrete de quota.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-white">Fração A (1º Esq) — João Silva</td>
                        <td className="p-2.5 text-center">
                          <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">BAIXO (4%)</span>
                        </td>
                        <td className="p-2.5 text-right font-bold text-emerald-400">€0.00</td>
                        <td className="p-2.5 text-center text-slate-300">0 dias</td>
                        <td className="p-2.5 text-slate-300 font-sans text-[11px]">
                          Condómino exemplar (Débito Direto ativo). Nenhuma intervenção requerida.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CONTENT OF PREDICTION 2: MANUTENÇÃO */}
            {selectedPrevisaoTab === "manutencao" && (
              <div className="bg-slate-800/90 p-5 rounded-xl border border-slate-700 space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <i className="fa-solid fa-gears text-cyan-400"></i>
                      <span>Previsão de Manutenção Preventiva & Ciclo de Degradação de Equipamentos</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Modelo preditivo de desgaste técnico baseado na idade, número de utilizações e relatórios das folhas digitais.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-800 px-3 py-1 rounded-lg">
                    4 Equipamentos Críticos Monitorizados
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-700 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-white">Elevadores Otis Gen2 (2 Unidades)</span>
                      <span className="text-[10px] bg-amber-950 text-amber-400 font-bold px-2 py-0.5 rounded border border-amber-800">
                        Degradação: 68%
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full w-[68%]"></div>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      <strong>Data Prevista de Intervenção:</strong> Novembro 2026 (Substituição de patins e cabos de tração).
                    </p>
                    <span className="text-[10px] text-cyan-400 font-mono block">Custo Estimado: €850.00 (Incluso no contrato de manutenção)</span>
                  </div>

                  <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-700 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-white">Bombas de Água Grundfos (Grupo Sobressalente)</span>
                      <span className="text-[10px] bg-red-950 text-red-400 font-bold px-2 py-0.5 rounded border border-red-800">
                        Degradação: 82%
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-red-500 h-full w-[82%]"></div>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      <strong>Data Prevista de Intervenção:</strong> Setembro 2026 (Substituição de selos mecânicos e vedantes).
                    </p>
                    <span className="text-[10px] text-cyan-400 font-mono block">Custo Estimado: €320.00 (Cobrir via Fundo Manutenção)</span>
                  </div>

                  <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-700 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-white">Portão Automático da Garagem</span>
                      <span className="text-[10px] bg-emerald-950 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-800">
                        Degradação: 25%
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full w-[25%]"></div>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      <strong>Data Prevista de Intervenção:</strong> Junho 2027 (Lubrificação e afinação de cremalheira).
                    </p>
                    <span className="text-[10px] text-cyan-400 font-mono block">Custo Estimado: €75.00</span>
                  </div>

                  <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-700 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-white">Sistema de Iluminação Comum LED</span>
                      <span className="text-[10px] bg-emerald-950 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-800">
                        Degradação: 15%
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full w-[15%]"></div>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      <strong>Data Prevista de Intervenção:</strong> Março 2028 (Substituição pontual de armaduras de iluminação).
                    </p>
                    <span className="text-[10px] text-cyan-400 font-mono block">Custo Estimado: €120.00</span>
                  </div>
                </div>
              </div>
            )}

            {/* CONTENT OF PREDICTION 3: OBRAS */}
            {selectedPrevisaoTab === "obras" && (
              <div className="bg-slate-800/90 p-5 rounded-xl border border-slate-700 space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <i className="fa-solid fa-helmet-safety text-amber-400"></i>
                      <span>Previsão de Obras Extraordinárias (Horizonte 12, 24 e 36 Meses)</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Projeção estratégica de grande conservação, investimento estimado e taxa de cobertura do Fundo Comum de Reserva.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/60 border border-amber-800 px-3 py-1 rounded-lg">
                    FCR Atual: €2.150,00
                  </span>
                </div>

                <div className="space-y-3 font-sans">
                  <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <span className="text-[9px] font-mono font-bold text-amber-400 uppercase tracking-widest bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                        Horizonte 12 Meses (Ano 2026/2027)
                      </span>
                      <h5 className="text-xs font-black text-white mt-1">Impermeabilização do Telhado e Clarabóia Central</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">Substituição de telas asfálticas danificadas para prevenir infiltrações no 4º andar.</p>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <span className="text-sm font-extrabold text-amber-400 block">€3.500,00</span>
                      <span className="text-[10px] text-emerald-400 block">Cobertura FCR: 61% (Requer cota extra de €1.350)</span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <span className="text-[9px] font-mono font-bold text-violet-400 uppercase tracking-widest bg-violet-950 px-2 py-0.5 rounded border border-violet-800">
                        Horizonte 24 Meses (Ano 2027/2028)
                      </span>
                      <h5 className="text-xs font-black text-white mt-1">Pintura Geral da Fachada Posterior e Varandas</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">Tratamento de fissuras com tinta elástica impermeável e lavagem de cantarias.</p>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <span className="text-sm font-extrabold text-violet-300 block">€12.000,00</span>
                      <span className="text-[10px] text-violet-400 block">Sugerida quota extraordinária fracionada em 18x</span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <span className="text-[9px] font-mono font-bold text-sky-400 uppercase tracking-widest bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                        Horizonte 36 Meses (Ano 2028/2029)
                      </span>
                      <h5 className="text-xs font-black text-white mt-1">Substituição Integral das Colunas de Água Comum</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">Substituição das antigas tubagens de ferro por multicamada de alta durabilidade.</p>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <span className="text-sm font-extrabold text-sky-300 block">€8.200,00</span>
                      <span className="text-[10px] text-slate-400 block">Planeamento de poupança contínua no FCR</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CONTENT OF PREDICTION 4: FINANCEIRA */}
            {selectedPrevisaoTab === "financeira" && (
              <div className="bg-slate-800/90 p-5 rounded-xl border border-slate-700 space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <i className="fa-solid fa-chart-line text-emerald-400"></i>
                      <span>Previsão Financeira & Projeção de Cash Flow (6 e 12 Meses)</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Modelo preditivo de liquidez de tesouraria combinando quotas esperadas, sazonalidade e contratos fixos.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1 rounded-lg">
                    Saldo Projetado a 12m: €2.120,00
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                  <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-700 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Projeção a 6 Meses (Dezembro 2026)</span>
                    <div className="flex justify-between items-center text-xs text-slate-300 pt-1">
                      <span>Receitas de Quotas Estimadas:</span>
                      <span className="font-bold text-emerald-400">+ €7.080,00</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-300">
                      <span>Despesas Operacionais Fixas:</span>
                      <span className="font-bold text-rose-400">- €6.240,00</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-300 border-t border-slate-800 pt-2 font-bold">
                      <span className="text-white">Saldo de Tesouraria Estimado:</span>
                      <span className="text-emerald-400 text-sm">€2.040,00</span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-700 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Projeção a 12 Meses (Junho 2027)</span>
                    <div className="flex justify-between items-center text-xs text-slate-300 pt-1">
                      <span>Receitas de Quotas Estimadas:</span>
                      <span className="font-bold text-emerald-400">+ €14.160,00</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-300">
                      <span>Despesas Operacionais Fixas:</span>
                      <span className="font-bold text-rose-400">- €12.480,00</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-300 border-t border-slate-800 pt-2 font-bold">
                      <span className="text-white">Saldo de Tesouraria Estimado:</span>
                      <span className="text-emerald-400 text-sm">€2.120,00</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Controls & General Parameters */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-extrabold text-slate-800">Cálculo de Orçamento Anual Automático e Previsão de Quotas</h4>
                <p className="text-xs text-slate-500 leading-relaxed mt-1">
                  Defina os custos operacionais estimados e a taxa de inadimplência histórica do condomínio para gerar um planeamento financeiro preventivo, prospecção de quotas ordinárias/extraordinárias e gráficos de projeções a 12 meses via Inteligência Artificial.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunBudgetPredictionAI}
                disabled={isGeneratingBudget}
                className="bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-colors shadow flex items-center justify-center cursor-pointer shrink-0"
              >
                {isGeneratingBudget ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    A Calcular Cenários com IA...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>Gerar Orçamento Inteligente
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  <span>Contratos Mensais</span>
                  <span className="text-slate-800">€{contratos}/mês</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="10"
                  value={contratos}
                  onChange={e => setContratos(Number(e.target.value))}
                  className="w-full accent-violet-600 h-1 bg-slate-200 rounded"
                />
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  <span>Seguros Anuais</span>
                  <span className="text-slate-800">€{seguros}/ano</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="3000"
                  step="50"
                  value={seguros}
                  onChange={e => setSeguros(Number(e.target.value))}
                  className="w-full accent-violet-600 h-1 bg-slate-200 rounded"
                />
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  <span>Serviços & Limpeza</span>
                  <span className="text-slate-800">€{servicos + limpeza}/mês</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1500"
                  step="25"
                  value={servicos + limpeza}
                  onChange={e => {
                    const total = Number(e.target.value);
                    setServicos(Math.round(total * 0.45));
                    setLimpeza(Math.round(total * 0.55));
                  }}
                  className="w-full accent-violet-600 h-1 bg-slate-200 rounded"
                />
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  <span>Inadimplência Histórica</span>
                  <span className="text-slate-800">{inadimplenciaHistorica}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={inadimplenciaHistorica}
                  onChange={e => setInadimplenciaHistorica(Number(e.target.value))}
                  className="w-full accent-violet-600 h-1 bg-slate-200 rounded"
                />
              </div>
            </div>
          </div>

          {/* Section 1: Orçamento Anual Automático */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center">
                  <i className="fa-solid fa-calculator text-violet-500 mr-2"></i> Orçamento Anual Automático (IA)
                </h5>

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100/70 rounded-xl transition-colors">
                    <div>
                      <span className="text-xs font-semibold text-slate-600 block">Despesas Previstas</span>
                      <span className="text-[10px] text-slate-400">Contratos, seguros, limpezas, vistorias</span>
                    </div>
                    <span className="text-sm font-bold text-slate-800">€{budgetResult.despesas_previstas?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100/70 rounded-xl transition-colors">
                    <div>
                      <span className="text-xs font-semibold text-slate-600 block">Receitas Previstas</span>
                      <span className="text-[10px] text-slate-400">Quotas regulares previstas</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">€{budgetResult.receitas_previstas?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100/70 rounded-xl transition-colors">
                    <div>
                      <span className="text-xs font-semibold text-slate-600 block">Fundo de Reserva Mínimo Legal</span>
                      <span className="text-[10px] text-slate-400">Art. 4º DL 268/94 (10% das despesas)</span>
                    </div>
                    <span className="text-sm font-bold text-red-600">€{budgetResult.fundo_minimo_legal?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100/70 rounded-xl transition-colors">
                    <div>
                      <span className="text-xs font-semibold text-slate-600 block">Fundo de Reserva Recomendado</span>
                      <span className="text-[10px] text-slate-400">Proposta IA com base em risco predial</span>
                    </div>
                    <span className="text-sm font-bold text-violet-600">€{budgetResult.fundo_recomendado?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-900 text-slate-100 rounded-xl shadow-sm">
                    <div>
                      <span className="text-xs font-extrabold block text-slate-300">Saldo Anual Líquido Previsto</span>
                      <span className="text-[10px] text-slate-400">Balanço anual final ordinário</span>
                    </div>
                    <span className={`text-sm font-black ${budgetResult.saldo_anual_previsto >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      €{budgetResult.saldo_anual_previsto?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Impact evaluation cards */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Impactos Financeiros Analisados (IA)</span>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100/80 space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-orange-700 flex items-center">
                      <i className="fa-solid fa-screwdriver-wrench mr-1.5 text-xs"></i> Impacto das Obras
                    </span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{budgetResult.impacto_obras}</p>
                  </div>

                  <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/80 space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 flex items-center">
                      <i className="fa-solid fa-sack-dollar mr-1.5 text-xs"></i> Quotas Extraordinárias
                    </span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{budgetResult.impacto_quotas_extraordinarias}</p>
                  </div>

                  <div className="bg-red-50/50 p-4 rounded-xl border border-red-100/80 space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-red-700 flex items-center">
                      <i className="fa-solid fa-triangle-exclamation mr-1.5 text-xs"></i> Inadimplência Prevista
                    </span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{budgetResult.impacto_inadimplencia_prevista}</p>
                  </div>
                </div>
              </div>

              {/* Section 2: Sugestão Automática de Quota Mensal */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Sugestão Automática de Quota Mensal (IA)</span>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="border border-slate-200 rounded-xl p-3 text-center bg-slate-50 hover:bg-slate-100/70 transition-all">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Mínima</span>
                    <span className="text-sm font-black text-slate-800 block mt-1">€{budgetResult.quota_minima?.toFixed(2)}</span>
                    <span className="text-[8px] text-slate-400">/fração/mês</span>
                  </div>

                  <div className="border border-violet-200 bg-violet-50/20 rounded-xl p-3 text-center shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-violet-600 text-white text-[7px] font-extrabold uppercase tracking-wider px-1 py-0.5 rounded-bl">RECOMENDADA</div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-violet-600 block">Recomendada</span>
                    <span className="text-sm font-black text-violet-700 block mt-1">€{budgetResult.quota_recomendada?.toFixed(2)}</span>
                    <span className="text-[8px] text-slate-400">/fração/mês</span>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-3 text-center bg-slate-50 hover:bg-slate-100/70 transition-all">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Ideal</span>
                    <span className="text-sm font-black text-slate-800 block mt-1">€{budgetResult.quota_ideal?.toFixed(2)}</span>
                    <span className="text-[8px] text-slate-400">/fração/mês</span>
                  </div>

                  <div className="border border-orange-200 bg-orange-50/20 rounded-xl p-3 text-center transition-all">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-orange-600 block">Extraordinária</span>
                    <span className="text-sm font-black text-orange-700 block mt-1">€{budgetResult.quota_extraordinaria?.toFixed(2)}</span>
                    <span className="text-[8px] text-slate-400">/fração/mês</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed italic bg-slate-50 p-3 rounded-xl border border-slate-200/50">
                  <i className="fa-solid fa-lightbulb text-violet-500 mr-1.5 text-xs"></i>
                  {budgetResult.explicacao_quotas}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Sugestão Automática de Quotas Extraordinárias */}
          {budgetResult.quota_extraordinaria_sugestao && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-3 gap-2">
                <div>
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center">
                    <i className="fa-solid fa-circle-plus text-orange-500 mr-2"></i> Sugestão Automática de Quotas Extraordinárias (IA)
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-0.5">Plano de comparticipação para execução de obras ou benfeitorias estruturais com fracionamento legal.</p>
                </div>
                <div className="bg-slate-900 text-slate-100 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-slate-800 shadow-sm shrink-0">
                  <span className="text-slate-400">Referência Obrigatória:</span> <span className="text-orange-400">BR23E</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Valor Total das Obras</span>
                      <span className="text-lg font-black text-slate-900 mt-1 block">€{budgetResult.quota_extraordinaria_sugestao.valor_total?.toLocaleString()}</span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Valor Médio por Fração</span>
                      <span className="text-lg font-black text-slate-900 mt-1 block">€{budgetResult.quota_extraordinaria_sugestao.valor_por_fracao_medio?.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="bg-orange-50/30 p-4 rounded-xl border border-orange-100 space-y-2 text-xs text-slate-600 leading-relaxed">
                    <p className="font-bold text-orange-800 flex items-center">
                      <i className="fa-solid fa-circle-info mr-1.5"></i>Impacto Orçamental Previsível
                    </p>
                    <p><strong>Fundo de Reserva:</strong> {budgetResult.quota_extraordinaria_sugestao.impacto_fundo}</p>
                    <p className="pt-1.5 border-t border-orange-200/50"><strong>Saldo Geral:</strong> {budgetResult.quota_extraordinaria_sugestao.impacto_saldo}</p>
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 block">Opções de Fracionamento Obrigatório (Sugestão IA)</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {budgetResult.quota_extraordinaria_sugestao.fracionamentos?.map((frac: any, i: number) => (
                      <div key={i} className="border border-slate-200 rounded-xl p-3 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-all text-center">
                        <span className="text-[10px] bg-slate-900 text-white font-extrabold px-2 py-0.5 rounded-full inline-block mb-1.5">
                          {frac.meses} Meses
                        </span>
                        <span className="text-xs font-black text-slate-800 block">€{frac.valor_mensal_medio?.toFixed(2)}</span>
                        <span className="text-[8px] text-slate-400">/fração/mês</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Painel de Projeções Financeiras (IA) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center">
              <i className="fa-solid fa-chart-line text-violet-500 mr-2"></i> Painel de Projeções Financeiras Inteligente (IA)
            </h5>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              O gráfico abaixo apresenta a simulação cumulativa de saldo de tesouraria do condomínio cruzada com as despesas recorrentes estimadas, o custo programado de obras futuras e o impacto previsto da taxa de inadimplência histórica ao longo de 12 meses.
            </p>

            <div className="h-80 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={budgetResult.chart_data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSaldoFuturo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fontWeight: "bold" }} />
                  <YAxis tick={{ fontSize: 9, fontWeight: "bold" }} />
                  <Tooltip formatter={(value: any) => [`€${Number(value).toFixed(2)}`]} />
                  <Legend wrapperStyle={{ fontSize: 10, fontWeight: "bold" }} />
                  
                  {/* Area: Saldo Futuro */}
                  <Area type="monotone" dataKey="saldo_futuro" name="Saldo Futuro Acumulado (€)" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSaldoFuturo)" />
                  
                  {/* Bar: Despesas Futuras */}
                  <Bar dataKey="despesas_futuras" name="Despesas Ordinárias (€)" fill="#ef4444" opacity={0.7} radius={[4, 4, 0, 0]} maxBarSize={20} />
                  
                  {/* Bar: Obras Futuras */}
                  <Bar dataKey="obras_futuras" name="Despesas com Obras (€)" fill="#f97316" opacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={20} />

                  {/* Line: Inadimplência Prevista */}
                  <Line type="monotone" dataKey="inadimplencia_prevista" name="Quebra por Inadimplência (€)" stroke="#64748b" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>


            <div className="flex justify-center items-center gap-6 text-[10px] font-bold text-slate-500 pt-3 border-t border-slate-100 flex-wrap">
              <span className="flex items-center"><span className="h-2.5 w-4 bg-violet-500 rounded mr-1.5 inline-block"></span>Saldo Futuro Acumulado</span>
              <span className="flex items-center"><span className="h-2.5 w-4 bg-red-500 rounded mr-1.5 inline-block"></span>Despesas Correntes</span>
              <span className="flex items-center"><span className="h-2.5 w-4 bg-orange-500 rounded mr-1.5 inline-block"></span>Investimento em Obras</span>
              <span className="flex items-center"><span className="h-2.5 border-t border-dashed border-slate-500 w-4 mr-1.5 inline-block"></span>Inadimplência Projetada</span>
            </div>
          </div>

          {/* Section 5: Edição Manual pela Administração */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div>
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center">
                  <i className="fa-solid fa-pen-to-square text-violet-500 mr-2"></i> Edição Manual pela Administração
                </h5>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Adicione, remova ou altere as rubricas de despesas. Recalcule o orçamento com IA ou bloqueie a versão final para aprovação formal.
                </p>
              </div>
              
              {/* Lock toggle button */}
              <button
                type="button"
                onClick={() => setIsBudgetLocked(!isBudgetLocked)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  isBudgetLocked 
                    ? "bg-red-50 text-red-700 border-red-200" 
                    : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                }`}
              >
                <i className={`fa-solid ${isBudgetLocked ? "fa-lock-open" : "fa-lock"}`}></i>
                {isBudgetLocked ? "Bloqueado (Clique para Desbloquear)" : "Bloquear Orçamento Final"}
              </button>
            </div>

            {isBudgetLocked && (
              <div className="bg-red-50 border border-red-100 text-red-800 p-3.5 rounded-xl text-xs flex items-center gap-2.5 animate-fadeIn">
                <i className="fa-solid fa-lock text-sm shrink-0"></i>
                <div>
                  <span className="font-bold">Orçamento Oficial Bloqueado:</span> Todas as edições e alterações manuais de valores ou adição de rubricas estão desativadas. Desbloqueie acima para permitir edições.
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Rubric List Table */}
              <div className="lg:col-span-8 space-y-3">
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 block">Rubricas de Despesas Ativas</span>
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-slate-50/20">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-500 font-bold border-b border-slate-200 text-[10px] uppercase">
                        <th className="p-3 pl-4">Rubrica de Despesa</th>
                        <th className="p-3 w-40 text-right">Valor Estimado Anual</th>
                        <th className="p-3 w-20 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rubricas.map((rub) => (
                        <tr key={rub.id} className="border-b border-slate-150/50 hover:bg-white/60 transition-colors">
                          <td className="p-3 pl-4 font-semibold text-slate-700">{rub.nome}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-slate-400">€</span>
                              <MoneyInput
                                disabled={isBudgetLocked}
                                value={rub.valor}
                                onChange={(valor) => handleUpdateRubricaValue(rub.id, valor)}
                                className="w-28 text-right font-mono font-bold text-slate-800 border border-slate-200 rounded px-1.5 py-0.5 focus:border-violet-500 focus:outline-none bg-white disabled:bg-slate-100/50"
                              />
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              disabled={isBudgetLocked}
                              onClick={() => handleRemoveRubrica(rub.id)}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent"
                              title="Remover Rubrica"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Quick Add Rubric Form */}
                {!isBudgetLocked && (
                  <form onSubmit={handleAddRubrica} className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Nome da Nova Rubrica</label>
                      <input
                        type="text"
                        required
                        value={newRubricaNome}
                        onChange={(e) => setNewRubricaNome(e.target.value)}
                        placeholder="Ex: Luz Comum, Manutenção de Portão, etc."
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white"
                      />
                    </div>
                    <div className="w-full sm:w-40 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Valor Anual (€)</label>
                      <MoneyInput
                        value={newRubricaValor}
                        onChange={setNewRubricaValor}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white font-mono font-bold"
                      />
                    </div>
                    <button
                      type="submit"
                      className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors shrink-0 h-9 flex items-center justify-center cursor-pointer"
                    >
                      <i className="fa-solid fa-plus mr-1.5"></i>Adicionar Rubrica
                    </button>
                  </form>
                )}
              </div>

              {/* Recalculate block */}
              <div className="lg:col-span-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 block">Recálculo de Orçamento</span>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Clique abaixo para recalcular todas as projeções anuais de despesas, quotas recomendadas, saldo estimado e atualizar as curvas dos gráficos com base nos novos valores ajustados administrativamente.
                  </p>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Soma de Rubricas:</span>
                      <span className="font-bold text-slate-800">€{rubricas.reduce((sum, r) => sum + r.valor, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fundo Reserva (10%):</span>
                      <span className="font-bold text-slate-800">€{(rubricas.reduce((sum, r) => sum + r.valor, 0) * 0.1).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRecalculateBudget}
                  disabled={isBudgetLocked}
                  className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center cursor-pointer"
                >
                  <i className="fa-solid fa-arrows-rotate mr-2"></i>Recalcular Orçamento por IA
                </button>
              </div>
            </div>
          </div>

          {/* Section 6: Penalizações por Atraso */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div>
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center">
                  <i className="fa-solid fa-gavel text-violet-500 mr-2"></i> Regulamento de Penalizações por Atraso (Facultativo)
                </h5>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Defina taxas de atraso para proprietários com quotas pendentes. Os valores calculados impactam positivamente a receita prevista e o saldo de tesouraria do orçamento.
                </p>
              </div>

              {/* Apply delay penalties switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isBudgetLocked}
                  checked={aplicaPenalizacoes}
                  onChange={(e) => {
                    setAplicaPenalizacoes(e.target.checked);
                    // trigger budget recalculation after state update
                    setTimeout(() => handleRecalculateBudget(), 50);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                <span className="ml-2 text-xs font-bold text-slate-700">Aplicar Penalizações</span>
              </label>
            </div>

            {aplicaPenalizacoes ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
                <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Periodicidade de Cobrança</span>
                    <select
                      disabled={isBudgetLocked}
                      value={frequenciaPenalizacao}
                      onChange={(e) => {
                        setFrequenciaPenalizacao(e.target.value as any);
                        setTimeout(() => handleRecalculateBudget(), 50);
                      }}
                      className="w-full border border-slate-200 rounded-lg p-1.5 text-xs bg-white focus:outline-none"
                    >
                      <option value="mensal">Mensal (Após prazo limite)</option>
                      <option value="semestral">Semestral (Acumulado)</option>
                      <option value="anual">Anual (Balanço de Exercício)</option>
                    </select>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Tipo de Penalização</span>
                    <div className="flex gap-4 pt-1">
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                        <input
                          type="radio"
                          disabled={isBudgetLocked}
                          name="tipoPenalizacao"
                          value="percentual"
                          checked={tipoPenalizacao === "percentual"}
                          onChange={() => {
                            setTipoPenalizacao("percentual");
                            setTimeout(() => handleRecalculateBudget(), 50);
                          }}
                          className="accent-violet-600"
                        />
                        Percentual (%)
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                        <input
                          type="radio"
                          disabled={isBudgetLocked}
                          name="tipoPenalizacao"
                          value="fixo"
                          checked={tipoPenalizacao === "fixo"}
                          onChange={() => {
                            setTipoPenalizacao("fixo");
                            setTimeout(() => handleRecalculateBudget(), 50);
                          }}
                          className="accent-violet-600"
                        />
                        Valor Fixo (€)
                      </label>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Valor da Penalização</span>
                    <div className="relative">
                      <MoneyInput
                        disabled={isBudgetLocked}
                        value={valorPenalizacao}
                        onChange={(valor) => {
                          setValorPenalizacao(valor);
                          setTimeout(() => handleRecalculateBudget(), 50);
                        }}
                        className="w-full border border-slate-200 rounded-lg p-1.5 text-xs bg-white font-bold"
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">
                        {tipoPenalizacao === "percentual" ? "%" : "€"}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Período de Tolerância / Carência</span>
                    <div className="relative">
                      <input
                        type="number"
                        disabled={isBudgetLocked}
                        min="0"
                        value={carenciaDias}
                        onChange={(e) => setCarenciaDias(Number(e.target.value))}
                        className="w-full border border-slate-200 rounded-lg p-1.5 text-xs bg-white font-bold"
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">Dias</span>
                    </div>
                  </div>

                  <div className="sm:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Regras Específicas & Exceções Autorizadas</span>
                    <textarea
                      disabled={isBudgetLocked}
                      rows={2}
                      value={regrasExcecoes}
                      onChange={(e) => setRegrasExcecoes(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white resize-none"
                      placeholder="Indique as exceções regulamentares aplicáveis..."
                    />
                  </div>
                </div>

                {/* Penalty Impact Preview Card */}
                <div className="lg:col-span-4 bg-violet-50/40 p-5 rounded-2xl border border-violet-100 flex flex-col justify-between">
                  <div className="space-y-2">
                    <span className="text-[9px] font-black tracking-wider uppercase text-violet-700 block">Impacto de Penalizações</span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Com base no histórico predial de <span className="font-bold text-red-600">{inadimplenciaHistorica}%</span> de inadimplência, a imposição destas taxas cria incentivos corretivos imediatos.
                    </p>
                    <div className="bg-white p-3.5 rounded-xl border border-violet-100 text-center shadow-sm space-y-1">
                      <span className="text-[9px] text-slate-400 uppercase font-bold block">Receita Adicional Estimada (Anual)</span>
                      <span className="text-xl font-black text-violet-700 block">
                        €{((tipoPenalizacao === "percentual" 
                            ? ((budgetResult.receitas_previstas || 14000) * (inadimplenciaHistorica/100)) * (valorPenalizacao/100) 
                            : valorPenalizacao * Math.max(1, Math.round((fracoes?.length || 8) * (inadimplenciaHistorica/100))) * (frequenciaPenalizacao === "mensal" ? 12 : frequenciaPenalizacao === "semestral" ? 2 : 1))
                          ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[9px] text-emerald-600 font-bold block">
                        <i className="fa-solid fa-chart-line mr-1"></i>Incorporado no Orçamento de Receitas
                      </span>
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-400 pt-2 border-t border-violet-100">
                    * Os valores finais dependem dos prazos de liquidação voluntária e aplicação das isenções regulamentares especificadas.
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl text-center text-xs text-slate-500 py-8 space-y-2">
                <i className="fa-solid fa-gavel text-xl text-slate-300"></i>
                <p className="font-medium">Nenhum regulamento de penalizações por atraso está ativo no condomínio atualmente.</p>
                <p className="text-[10px] text-slate-400 max-w-md mx-auto">Ative as penalizações no seletor acima para simular e incluir receitas compensatórias de atrasos de quotas no saldo previsto anual.</p>
              </div>
            )}
          </div>

          {/* Section 7: Envio Automático & Agendamento de Relatórios */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center">
                <i className="fa-solid fa-envelope-open-text text-violet-500 mr-2"></i> Agendamento & Envio Automático de Relatórios
              </h5>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Configure os gatilhos e destinatários para o envio periódico do Relatório Anual de Orçamento em PDF acompanhado dos resumos financeiros periódicos do CondoManager AI.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Option 1: PDF Anual */}
                  <label className={`border rounded-xl p-4 flex flex-col justify-between h-28 cursor-pointer transition-all ${
                    enviarPdfAnual 
                      ? "border-violet-200 bg-violet-50/10 shadow-sm" 
                      : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                  }`}>
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-slate-800">PDF Anual do Orçamento</span>
                      <input
                        type="checkbox"
                        checked={enviarPdfAnual}
                        onChange={(e) => setEnviarPdfAnual(e.target.checked)}
                        className="accent-violet-600 cursor-pointer h-4 w-4"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-wider text-violet-600 block">Gatilho AI</span>
                      <span className="text-[10px] text-slate-500 font-semibold block">Assim que aprovado pela administração</span>
                    </div>
                  </label>

                  {/* Option 2: Resumo Financeiro Mensal */}
                  <label className={`border rounded-xl p-4 flex flex-col justify-between h-28 cursor-pointer transition-all ${
                    enviarResumoMensal 
                      ? "border-violet-200 bg-violet-50/10 shadow-sm" 
                      : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                  }`}>
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-slate-800">Resumo Financeiro Mensal</span>
                      <input
                        type="checkbox"
                        checked={enviarResumoMensal}
                        onChange={(e) => setEnviarResumoMensal(e.target.checked)}
                        className="accent-violet-600 cursor-pointer h-4 w-4"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-wider text-violet-600 block">Gatilho AI</span>
                      <span className="text-[10px] text-slate-500 font-semibold block">No último dia de cada mês</span>
                    </div>
                  </label>

                  {/* Option 3: Resumo Trimestral */}
                  <label className={`border rounded-xl p-4 flex flex-col justify-between h-28 cursor-pointer transition-all ${
                    enviarResumoTrimestral 
                      ? "border-violet-200 bg-violet-50/10 shadow-sm" 
                      : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                  }`}>
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-slate-800">Balanço Trimestral IA</span>
                      <input
                        type="checkbox"
                        checked={enviarResumoTrimestral}
                        onChange={(e) => setEnviarResumoTrimestral(e.target.checked)}
                        className="accent-violet-600 cursor-pointer h-4 w-4"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-wider text-violet-600 block">Gatilho AI</span>
                      <span className="text-[10px] text-slate-500 font-semibold block">No encerramento de cada trimestre</span>
                    </div>
                  </label>
                </div>

                {/* Recipient Picker */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Lista de Destinatários do Envio Automatizado</label>
                  <select
                    value={destinatariosEnvio}
                    onChange={(e) => setDestinatariosEnvio(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white focus:outline-none"
                  >
                    <option value="all">Enviar para Todos os Condóminos ({fracoes?.length || 8} frações registadas)</option>
                    <option value="owners">Apenas Proprietários e Usuários com Perfis Ativos</option>
                    <option value="debtors">Proprietários com Valores Pendentes / Avisos de Cobrança</option>
                  </select>
                </div>
              </div>

              {/* Instant Simulated Send block */}
              <div className="lg:col-span-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 block">Ações Imediatas</span>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Pode testar as configurações de email disparando uma simulação de envio imediata para os condóminos selecionados com o Relatório Anual IA em anexo.
                  </p>
                  
                  {sendSuccessMessage && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-[10px] font-bold animate-fadeIn">
                      <i className="fa-solid fa-circle-check mr-1.5 text-emerald-500"></i>
                      {sendSuccessMessage}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      const documents = [];
                      if (enviarPdfAnual) documents.push("PDF Anual do Orçamento");
                      if (enviarResumoMensal) documents.push("Resumo Financeiro Mensal");
                      if (enviarResumoTrimestral) documents.push("Balanço Trimestral IA");

                      if (documents.length === 0) {
                        alert("Selecione pelo menos um documento para enviar.");
                        return;
                      }

                      // Estes documentos são previsões/relatórios gerados por
                      // IA (não dados oficiais aprovados) — o envio em massa
                      // real aos condóminos ainda não está implementado,
                      // fica para trabalho dedicado. Antes esta ação
                      // afirmava falsamente "enviados" sem nenhum envio real.
                      alert(`Pré-visualização gerada para: ${documents.join(", ")}.\n\nO envio automático em massa aos condóminos ainda não está disponível — use "Central de Documentos & Minutas" para enviar manualmente a cada destinatário.`);
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center cursor-pointer"
                  >
                    <i className="fa-solid fa-paper-plane mr-2"></i>Compilar Documentos Selecionados
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPdfModal(true)}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center cursor-pointer"
                  >
                    <i className="fa-solid fa-file-pdf mr-2"></i>Ver Relatório Anual (PDF IA)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "cerebro_ia" && (
        <div className="space-y-6 animate-fadeIn text-slate-100">
          
          {/* Main Info Header */}
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-pink-500/15 flex items-center justify-center border border-pink-500/20 shadow-inner shrink-0">
                  <i className="fa-solid fa-brain text-2xl text-pink-400 animate-pulse"></i>
                </div>
                <div>
                  <h4 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                    Analista IA CondoManager <span className="bg-pink-600/30 text-pink-400 text-[10px] uppercase px-2 py-0.5 rounded-full font-black border border-pink-500/20">Documento FG</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Visualização interativa das rotinas inteligentes, triggers de base de dados e transições de estado mapeadas conforme as especificações do Documento FG.
                  </p>
                </div>
              </div>
              <div className="flex bg-slate-900/60 p-1 rounded-xl border border-slate-700/60 font-bold text-[10px] sm:text-xs shrink-0 flex-wrap gap-1">
                <button
                  onClick={() => setCerebroSubTab("triggers")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${cerebroSubTab === "triggers" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  <i className="fa-solid fa-bolt mr-1.5 text-amber-400"></i>Simulador de Triggers (Cap. 5)
                </button>
                <button
                  onClick={() => setCerebroSubTab("schema")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${cerebroSubTab === "schema" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  <i className="fa-solid fa-database mr-1.5 text-indigo-400"></i>Esquema Relacional ERP (Cap. 3/4)
                </button>
                <button
                  onClick={() => setCerebroSubTab("states")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${cerebroSubTab === "states" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  <i className="fa-solid fa-arrows-spin mr-1.5 text-pink-400"></i>Matriz de Estados (Cap. 6)
                </button>
              </div>
            </div>
          </div>

          {/* Sub-tab content */}
          {cerebroSubTab === "triggers" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Trigger list sidebar */}
              <div className="lg:col-span-4 bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-4">
                <div>
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-400">Fluxos de Trigger Automatizados</h5>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                    Selecione um evento listado no Documento FG para analisar a rotina lógica e simular a execução na BD.
                  </p>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {Object.values(TRIGGERS_DATA).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (isSimulatingTrigger) return;
                        setSelectedTriggerId(t.id);
                        setSimulationStepIndex(-1);
                      }}
                      disabled={isSimulatingTrigger}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                        selectedTriggerId === t.id
                          ? "bg-violet-600/20 border-violet-500/50 shadow-md text-white"
                          : "bg-slate-900/40 border-slate-700/50 text-slate-300 hover:bg-slate-700/50 hover:text-white"
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="text-[10px] font-black text-violet-400 bg-violet-950/50 border border-violet-800/60 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          Cap. {t.section}
                        </span>
                        <span className="text-[9px] text-slate-500 font-bold">
                          {t.tables.length} tabelas afetadas
                        </span>
                      </div>
                      <span className="text-xs font-black mt-2 leading-snug">{t.title}</span>
                      <span className="text-[10px] text-slate-400 italic mt-1 line-clamp-1">"{t.condition}"</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step Executor & Preview Panel */}
              <div className="lg:col-span-8 space-y-6">
                {/* Simulation controls & sequential steps */}
                <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5">
                  {(() => {
                    const activeTrigger = TRIGGERS_DATA[selectedTriggerId as keyof typeof TRIGGERS_DATA];
                    if (!activeTrigger) return null;
                    return (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-700 pb-4 gap-4">
                          <div>
                            <span className="text-[10px] font-black text-pink-400 uppercase tracking-wider block">Gatilho Selecionado</span>
                            <h4 className="text-base font-extrabold text-white mt-0.5">{activeTrigger.title}</h4>
                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                              <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
                              Condição: <span className="text-white font-bold">{activeTrigger.condition}</span>
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSimulateTrigger(selectedTriggerId)}
                            disabled={isSimulatingTrigger}
                            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-lg shadow-violet-950/40 flex items-center gap-2 justify-center cursor-pointer shrink-0"
                          >
                            {isSimulatingTrigger ? (
                              <>
                                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span>A processar trigger...</span>
                              </>
                            ) : (
                              <>
                                <i className="fa-solid fa-play animate-pulse"></i>
                                <span>Simular Rotina (Demonstração)</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Sequential trigger steps visualization */}
                        <div className="space-y-3">
                          <h6 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Passos sequenciais de execução automática (BD & IA)</h6>
                          <div className="relative border-l border-slate-700 pl-4 ml-2 space-y-4 py-1">
                            {activeTrigger.steps.map((step, idx) => {
                              const isStepPassed = simulationStepIndex >= idx;
                              const isStepActive = simulationStepIndex === idx;
                              return (
                                <div key={idx} className="relative transition-all duration-300">
                                  {/* Dot indicator */}
                                  <div className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border flex items-center justify-center transition-all ${
                                    isStepActive 
                                      ? "bg-pink-500 border-pink-400 ring-4 ring-pink-950 shadow-md shadow-pink-500/50 scale-110" 
                                      : isStepPassed 
                                        ? "bg-violet-600 border-violet-500 ring-2 ring-violet-950/20" 
                                        : "bg-slate-900 border-slate-700"
                                  }`}>
                                    {isStepPassed && !isStepActive && <i className="fa-solid fa-check text-[7px] text-white"></i>}
                                    {isStepActive && <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping"></span>}
                                  </div>

                                  <div className={`p-3 rounded-xl border transition-all ${
                                    isStepActive
                                      ? "bg-slate-700/60 border-pink-500/40 text-white"
                                      : isStepPassed
                                        ? "bg-slate-800/40 border-violet-600/30 text-slate-300"
                                        : "bg-slate-900/10 border-transparent text-slate-500"
                                  }`}>
                                    <span className="text-[10px] font-black block text-slate-500 mb-0.5">Passo {idx + 1}</span>
                                    <p className="text-xs font-semibold leading-relaxed">{step}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Interactive dynamic preview output */}
                        {activeTrigger.previewType && (
                          <div className="bg-slate-900 border border-slate-700 p-5 rounded-2xl space-y-3.5 animate-fadeIn text-left">
                            <span className="text-[10px] font-black uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                              <i className="fa-solid fa-display text-pink-400"></i>
                              Output Digital Simulado do Trigger (Capítulo 5)
                            </span>

                            {activeTrigger.previewType === "email" && activeTrigger.previewContent && (
                              <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 text-xs font-mono">
                                {/* Email Top Branding Header */}
                                <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
                                  <img src="/marca/20-Logotipo Horizontal com fundo.png" alt="CondoManager AI" className="h-6 object-contain" />
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded border border-slate-800">Email Oficial Gerado</span>
                                </div>
                                <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800/50 space-y-1">
                                  <div><span className="text-slate-500">De:</span> <span className="text-violet-400">{(activeTrigger.previewContent as any).from}</span></div>
                                  <div><span className="text-slate-500">Para:</span> <span className="text-slate-200">{(activeTrigger.previewContent as any).to}</span></div>
                                  <div><span className="text-slate-500">Assunto:</span> <span className="text-emerald-400">{(activeTrigger.previewContent as any).subject}</span></div>
                                </div>
                                <div className="p-4 text-slate-300 leading-relaxed whitespace-pre-wrap font-sans text-xs max-h-56 overflow-y-auto">
                                  {(activeTrigger.previewContent as any).body}
                                </div>
                                {/* Email Branding Footer */}
                                <div className="bg-slate-900/60 border-t border-slate-800/60 px-4 py-2 text-center flex items-center justify-between text-[9px] text-slate-500">
                                  <span>Mensagem enviada via CondoManager AI</span>
                                  <img src="/marca/20-Logotipo Horizontal com fundo.png" alt="" className="h-4 object-contain opacity-70" />
                                </div>
                              </div>
                            )}

                            {activeTrigger.previewType === "invoice" && activeTrigger.previewContent && (
                              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-xs space-y-3">
                                <div className="flex justify-between border-b border-slate-800 pb-2">
                                  <span className="font-bold text-slate-300"><i className="fa-solid fa-file-pdf mr-1.5 text-red-500 text-sm"></i>{(activeTrigger.previewContent as any).fileName}</span>
                                  <span className="text-emerald-400 font-bold">OCR Completo ✓</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300 font-mono text-[11px]">
                                  <div>Tipo: <span className="text-white font-bold">{(activeTrigger.previewContent as any).extractedData.tipo}</span></div>
                                  <div>Fornecedor: <span className="text-white font-bold">{(activeTrigger.previewContent as any).extractedData.fornecedor}</span></div>
                                  <div>NIF: <span className="text-white font-bold">{(activeTrigger.previewContent as any).extractedData.nif}</span></div>
                                  <div>Valor: <span className="text-emerald-400 font-bold">{(activeTrigger.previewContent as any).extractedData.valor}</span></div>
                                  <div>Pasta: <span className="text-white">{(activeTrigger.previewContent as any).extractedData.pasta}</span></div>
                                  <div>Movimento: <span className="text-amber-400 font-bold">{(activeTrigger.previewContent as any).extractedData.estado_movimento}</span></div>
                                </div>
                                <div className="flex gap-1.5 flex-wrap pt-2.5 border-t border-slate-800">
                                  {((activeTrigger.previewContent as any).extractedData.tags as string[]).map((tag, i) => (
                                    <span key={i} className="text-[9px] bg-slate-850 text-slate-300 px-2 py-0.5 rounded-full font-bold">#{tag}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {activeTrigger.previewType === "ticket" && activeTrigger.previewContent && (
                              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-xs space-y-3 font-mono">
                                <div className="flex justify-between border-b border-slate-800 pb-2">
                                  <span className="font-bold text-red-400"><i className="fa-solid fa-circle-exclamation mr-1.5 text-sm"></i>Ocorrência {(activeTrigger.previewContent as any).intervencao_id}</span>
                                  <span className="bg-red-950 text-red-400 border border-red-900 text-[9px] px-2 py-0.5 rounded font-black">Urgência: {(activeTrigger.previewContent as any).urgencia}</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300 text-[11px]">
                                  <div>Equipamento: <span className="text-white font-bold">{(activeTrigger.previewContent as any).equipamento}</span></div>
                                  <div>Tipo: <span className="text-white">{(activeTrigger.previewContent as any).tipo}</span></div>
                                  <div>Fornecedor: <span className="text-violet-400 font-bold">{(activeTrigger.previewContent as any).fornecedor}</span></div>
                                  <div>Email Fornecedor: <span className="text-slate-400">{(activeTrigger.previewContent as any).fornecedor_email}</span></div>
                                </div>
                                <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-lg text-slate-300 font-sans text-xs">
                                  {(activeTrigger.previewContent as any).notificacao_broadcast}
                                </div>
                              </div>
                            )}

                            {activeTrigger.previewType === "cleaning" && activeTrigger.previewContent && (
                              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-xs space-y-3 font-mono">
                                <div className="flex justify-between border-b border-slate-800 pb-2">
                                  <span className="font-bold text-slate-300"><i className="fa-solid fa-broom mr-1.5 text-sky-400 text-sm"></i>Relatório {(activeTrigger.previewContent as any).limpeza_id}</span>
                                  <span className="text-emerald-400 font-bold">Concluído ✓</span>
                                </div>
                                <div className="space-y-1.5 text-[11px] text-slate-300">
                                  <div>Empresa: <span className="text-white font-bold">{(activeTrigger.previewContent as any).empresa}</span></div>
                                  <div>Data/Hora: <span className="text-white font-bold">{(activeTrigger.previewContent as any).data_hora}</span></div>
                                  <div>Observações: <span className="text-slate-400 italic">"{(activeTrigger.previewContent as any).relatorio}"</span></div>
                                </div>
                                <div className="p-2.5 bg-sky-950/10 border border-sky-900/20 rounded-lg text-slate-300 font-sans text-xs">
                                  {(activeTrigger.previewContent as any).broadcast}
                                </div>
                              </div>
                            )}

                            {activeTrigger.previewType === "tech" && activeTrigger.previewContent && (
                              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-xs space-y-3 font-mono">
                                <div className="flex justify-between border-b border-slate-800 pb-2">
                                  <span className="font-bold text-slate-300"><i className="fa-solid fa-screwdriver-wrench mr-1.5 text-violet-400 text-sm"></i>Vistoria {(activeTrigger.previewContent as any).intervencao_id}</span>
                                  <span className="text-emerald-400 font-bold">Concluída ✓</span>
                                </div>
                                <div className="space-y-1.5 text-[11px] text-slate-300">
                                  <div>Técnico: <span className="text-white font-bold">{(activeTrigger.previewContent as any).tecnico}</span></div>
                                  <div>Estado: <span className="text-emerald-400 font-bold">{(activeTrigger.previewContent as any).estado}</span></div>
                                  <div>Relatório: <span className="text-slate-400 italic">"{(activeTrigger.previewContent as any).relatorio}"</span></div>
                                </div>
                                <div className="p-2.5 bg-violet-950/10 border border-violet-900/20 rounded-lg text-slate-300 font-sans text-xs">
                                  {(activeTrigger.previewContent as any).broadcast}
                                </div>
                              </div>
                            )}

                            {activeTrigger.previewType === "payment" && activeTrigger.previewContent && (
                              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-xs space-y-3 font-mono">
                                <div className="flex justify-between border-b border-slate-800 pb-2">
                                  <span className="font-bold text-slate-300"><i className="fa-solid fa-money-bill-transfer mr-1.5 text-emerald-400 text-sm"></i>Receção de Comprovativo</span>
                                  <span className="text-emerald-400 font-bold">Multideteção Ativa</span>
                                </div>
                                <div className="space-y-1.5 text-[11px] text-slate-300">
                                  <div>Titular: <span className="text-white font-bold">{(activeTrigger.previewContent as any).titular}</span></div>
                                  <div>Fração: <span className="text-white">{(activeTrigger.previewContent as any).fracao}</span></div>
                                  <div>Valor Recebido: <span className="text-emerald-400 font-bold">€{(activeTrigger.previewContent as any).valor_total.toFixed(2)}</span></div>
                                  <div>Valor de Quota: <span className="text-slate-400">€{(activeTrigger.previewContent as any).quota_unitaria.toFixed(2)}</span></div>
                                  <div className="text-violet-400 font-bold">Múltiplo Identificado: {(activeTrigger.previewContent as any).multiplo_detetado}</div>
                                </div>
                                <div className="p-2.5 bg-violet-950/20 border border-violet-900/30 rounded-lg text-violet-300 font-sans text-xs font-bold">
                                  💡 Ação automática recomendada: {(activeTrigger.previewContent as any).acao_automatica}
                                </div>
                              </div>
                            )}

                            {activeTrigger.previewType === "alert" && activeTrigger.previewContent && (
                              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-xs space-y-3 font-mono">
                                <div className="flex justify-between border-b border-slate-800 pb-2">
                                  <span className="font-bold text-amber-400"><i className="fa-solid fa-clock mr-1.5 text-sm"></i>Varrimento do Dia 25</span>
                                  <span className="text-slate-400">Cobranças Ativas</span>
                                </div>
                                <div className="space-y-2">
                                  <span className="text-[9px] text-slate-500 uppercase block font-bold">Avisos de Cobrança Emitidos:</span>
                                  {((activeTrigger.previewContent as any).avisos_gerados as any[]).map((av, idx) => (
                                    <div key={idx} className="flex justify-between text-[11px] text-slate-300 bg-slate-900 p-1.5 rounded border border-slate-800">
                                      <span>{av.fracao} - {av.devedor}</span>
                                      <span className="text-red-400 font-bold">{av.valor} ({av.estado})</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="p-2 bg-red-950/10 border border-red-900/20 rounded-lg text-slate-300 font-sans text-xs">
                                  {(activeTrigger.previewContent as any).notificacao_push}
                                </div>
                              </div>
                            )}

                            {activeTrigger.previewType === "juridico_alert" && activeTrigger.previewContent && (
                              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-xs space-y-3 font-mono">
                                <div className="flex justify-between border-b border-slate-800 pb-2">
                                  <span className="font-bold text-red-400"><i className="fa-solid fa-shield-halved mr-1.5 text-sm"></i>Controlo Preventivo de Validades</span>
                                  <span className="text-slate-400 font-bold text-[10px]">Análise Diária de Seguros/Contratos</span>
                                </div>
                                <div className="space-y-2">
                                  {((activeTrigger.previewContent as any).alertas as any[]).map((al, idx) => (
                                    <div key={idx} className="bg-slate-900 p-2 rounded border border-slate-800 text-[11px] text-slate-300">
                                      <div className="flex justify-between">
                                        <span className="font-bold text-white">{al.documento}</span>
                                        <span className="text-red-400 font-bold">Vence em {al.dias_restantes} dias</span>
                                      </div>
                                      <div className="text-[10px] text-slate-500 mt-0.5">Ação recomendada: {al.acao}</div>
                                    </div>
                                  ))}
                                </div>
                                <div className="p-2.5 bg-slate-900 rounded-lg text-[10px] text-slate-400 italic font-sans max-h-24 overflow-y-auto border border-slate-850">
                                  <strong>Minuta de email gerada:</strong> "{(activeTrigger.previewContent as any).minuta}"
                                </div>
                              </div>
                            )}

                            {activeTrigger.previewType === "export" && activeTrigger.previewContent && (
                              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-xs space-y-3 font-mono">
                                <div className="flex justify-between border-b border-slate-800 pb-2">
                                  <span className="font-bold text-emerald-400"><i className="fa-solid fa-file-excel mr-1.5 text-sm text-emerald-500"></i>{(activeTrigger.previewContent as any).ficheiro}</span>
                                  <span className="text-slate-500">{(activeTrigger.previewContent as any).tamanho}</span>
                                </div>
                                <div className="space-y-1.5 text-[11px] text-slate-300">
                                  <div>Gerado por: <span className="text-white font-bold">{(activeTrigger.previewContent as any).gerado_por}</span></div>
                                  <div>Acesso Seguro: <span className="text-violet-400 underline">{(activeTrigger.previewContent as any).link}</span></div>
                                </div>
                                <div className="p-2 bg-slate-900 border border-slate-800 rounded text-[10px] text-slate-400">
                                  <strong>Log Auditoria RGPD:</strong> {(activeTrigger.previewContent as any).log_conformidade}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Real-time terminal console output */}
                <div className="bg-slate-900 rounded-2xl border border-slate-700 p-5 space-y-3 font-mono text-xs text-left">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Terminal Logs de Auditoria do Cérebro
                    </span>
                    <button
                      onClick={() => setRealtimeLogs([])}
                      className="text-[10px] text-slate-500 hover:text-slate-300 underline font-bold cursor-pointer"
                    >
                      Limpar logs
                    </button>
                  </div>

                  <div className="h-44 overflow-y-auto space-y-2.5 pr-2 text-[11px] leading-relaxed">
                    {realtimeLogs.length === 0 ? (
                      <p className="text-slate-600 italic py-4 text-center">Nenhum registo no terminal.</p>
                    ) : (
                      realtimeLogs.map((log) => (
                        <div key={log.id} className="flex items-start gap-2.5 border-b border-slate-800/40 pb-2">
                          <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 uppercase tracking-wide ${
                            log.type === "success" 
                              ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900" 
                              : log.type === "warning" 
                                ? "bg-amber-950/50 text-amber-400 border border-amber-900" 
                                : "bg-violet-950/50 text-violet-400 border border-violet-900"
                          }`}>{log.trigger.split(" ")[0]}</span>
                          <p className="text-slate-300 font-sans leading-relaxed">{log.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {cerebroSubTab === "schema" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
              {/* Tables selection list */}
              <div className="lg:col-span-4 bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-4">
                <div>
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-400">Esquema da Base de Dados ERP</h5>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                    Selecione uma tabela física do sistema para consultar os tipos de campos obrigatórios e chaves estrangeiras (FK).
                  </p>
                </div>

                <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                  {Object.entries(TABLES_DATA).map(([id, t]) => (
                    <button
                      key={id}
                      onClick={() => setSelectedTableId(id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                        selectedTableId === id
                          ? "bg-violet-600 border-violet-500 text-white shadow"
                          : "bg-slate-900/40 border-slate-700/50 text-slate-300 hover:bg-slate-700/50"
                      }`}
                    >
                      <i className={`fa-solid ${t.icon} text-sm text-violet-400 ${selectedTableId === id ? "text-white" : ""}`}></i>
                      <span className="text-xs font-bold truncate">{t.name.split(":")[1] || t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Table fields and visual relations */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-4">
                  {(() => {
                    const activeTable = TABLES_DATA[selectedTableId as keyof typeof TABLES_DATA];
                    if (!activeTable) return null;
                    return (
                      <>
                        <div className="border-b border-slate-700 pb-3 flex justify-between items-center gap-4">
                          <div>
                            <span className="text-[10px] font-black text-violet-400 uppercase tracking-wider">Metadados Técnicos da BD</span>
                            <h4 className="text-base font-extrabold text-white mt-0.5">{activeTable.name}</h4>
                            <p className="text-xs text-slate-400 mt-1">{activeTable.desc}</p>
                          </div>
                          <div className="h-10 w-10 bg-slate-900/60 rounded-xl flex items-center justify-center border border-slate-700 shrink-0">
                            <i className={`fa-solid ${activeTable.icon} text-violet-400 text-base`}></i>
                          </div>
                        </div>

                        {/* Fields table */}
                        <div className="border border-slate-700 rounded-xl overflow-x-auto bg-slate-900/30">
                          <table className="w-full text-xs text-left border-collapse min-w-[500px]">
                            <thead>
                              <tr className="bg-slate-900 text-slate-400 font-extrabold uppercase tracking-wide text-[9px] border-b border-slate-700">
                                <th className="p-2.5 pl-4">Nome do Campo</th>
                                <th className="p-2.5">Tipo de Dados / Chave</th>
                                <th className="p-2.5 pr-4">Descrição e Finalidade</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeTable.fields.map((f, idx) => (
                                <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-800/40 text-[11px]">
                                  <td className="p-2.5 pl-4 font-mono font-bold text-white">{f.name}</td>
                                  <td className="p-2.5 font-mono text-violet-400 font-medium">{f.type}</td>
                                  <td className="p-2.5 pr-4 text-slate-300 leading-relaxed font-sans">{f.desc}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Relations and relationships map */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                          <div className="bg-slate-900/60 border border-slate-700 p-4 rounded-xl space-y-2">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Relações Físicas (Integridade Referencial)</span>
                            <div className="space-y-1.5">
                              {activeTable.relations.map((rel, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs font-bold text-slate-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0"></span>
                                  <span>{rel}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-slate-900/60 border border-slate-700 p-4 rounded-xl space-y-2">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Exemplo Prático (Documento FG)</span>
                            <div className="p-2.5 bg-slate-950 rounded text-xs italic text-slate-300 font-sans border border-slate-850">
                              "{activeTable.example}"
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Schema relationships flowchart graphic representation */}
                <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-4">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <i className="fa-solid fa-network-wired text-violet-400"></i>
                    Grafo de Relacionamentos do CondoManager ERP (1:N & 1:1)
                  </span>

                  <div className="p-6 bg-slate-950 rounded-xl border border-slate-850/80 grid grid-cols-1 md:grid-cols-3 gap-6 text-center text-xs relative overflow-hidden">
                    {/* Columns representing Entity Blocks and relational paths */}
                    <div className="space-y-3 bg-slate-900/40 p-3 rounded-lg border border-slate-800">
                      <span className="text-[9px] font-black uppercase text-violet-400 block">Dimensões Centrais</span>
                      <div className="p-2 bg-slate-800/80 border border-slate-700 rounded-lg font-bold text-white shadow-sm flex items-center justify-center gap-2">
                        <i className="fa-solid fa-building text-pink-400 text-[10px]"></i> Prédios (id_predio)
                      </div>
                      <div className="p-2 bg-slate-800/80 border border-slate-700 rounded-lg font-bold text-white shadow-sm flex items-center justify-center gap-2">
                        <i className="fa-solid fa-door-open text-violet-400 text-[10px]"></i> Frações (id_fracao)
                      </div>
                      <div className="p-2 bg-slate-800/80 border border-slate-700 rounded-lg font-bold text-white shadow-sm flex items-center justify-center gap-2">
                        <i className="fa-solid fa-users text-emerald-400 text-[10px]"></i> Condóminos
                      </div>
                    </div>

                    <div className="space-y-3 bg-slate-900/40 p-3 rounded-lg border border-slate-800 flex flex-col justify-center">
                      <span className="text-[9px] font-black uppercase text-violet-400 block">Chaves de Ligação (FK)</span>
                      <div className="py-2.5 px-3 bg-slate-950 rounded-lg font-mono text-[10px] text-slate-400 border border-slate-850 space-y-2 leading-relaxed">
                        <div>id_predio <i className="fa-solid fa-arrows-left-right text-violet-500 mx-1"></i> FK Geral</div>
                        <div>id_condomino <i className="fa-solid fa-arrows-left-right text-violet-500 mx-1"></i> FK Responsável</div>
                        <div>id_documento <i className="fa-solid fa-arrows-left-right text-violet-500 mx-1"></i> FK Anexo</div>
                      </div>
                    </div>

                    <div className="space-y-3 bg-slate-900/40 p-3 rounded-lg border border-slate-800">
                      <span className="text-[9px] font-black uppercase text-violet-400 block">Transações e Operacional</span>
                      <div className="p-2 bg-slate-800/80 border border-slate-700 rounded-lg font-bold text-white shadow-sm flex items-center justify-center gap-2">
                        <i className="fa-solid fa-money-bill-transfer text-emerald-400 text-[10px]"></i> Movimentos Fin.
                      </div>
                      <div className="p-2 bg-slate-800/80 border border-slate-700 rounded-lg font-bold text-white shadow-sm flex items-center justify-center gap-2">
                        <i className="fa-solid fa-screwdriver-wrench text-red-400 text-[10px]"></i> Intervenções
                      </div>
                      <div className="p-2 bg-slate-800/80 border border-slate-700 rounded-lg font-bold text-white shadow-sm flex items-center justify-center gap-2">
                        <i className="fa-solid fa-file-pdf text-amber-400 text-[10px]"></i> Documentos
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {cerebroSubTab === "states" && (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-6 text-left">
              <div>
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-400">Matriz de Estados do Sistema (Capítulo 6)</h5>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                  Estes estados estruturam as transições de ciclo de vida das entidades do sistema CondoManager AI, prevenindo faturas sem liquidação ou reclamações esquecidas.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* 6.1 Intervenção */}
                <div className="bg-slate-900/40 border border-slate-700 p-4.5 rounded-xl space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                      <i className="fa-solid fa-screwdriver-wrench text-red-400"></i>
                      6.1 Estado da Intervenção
                    </span>
                    <span className="text-[9px] bg-red-950/40 text-red-400 border border-red-900/40 px-2 py-0.5 rounded font-bold uppercase">Manutenção</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-white">Aberta</span>
                      <p className="text-[10px] text-slate-450 font-medium">Reportada pelo morador na PWA</p>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-amber-400">Em Curso</span>
                      <p className="text-[10px] text-slate-450 font-medium">Técnico acionado / no local</p>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-violet-400">Aguardando Fornecedor</span>
                      <p className="text-[10px] text-slate-455 font-medium">Aguardando peças / orçamentos</p>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-sky-400">Aguardando Validação</span>
                      <p className="text-[10px] text-slate-450 font-medium">Reparação feita, sob vistoria</p>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-emerald-400">Concluída</span>
                      <p className="text-[10px] text-slate-450 font-medium">Intervenção fechada e faturada</p>
                    </div>
                  </div>
                </div>

                {/* 6.2 Limpeza */}
                <div className="bg-slate-900/40 border border-slate-700 p-4.5 rounded-xl space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                      <i className="fa-solid fa-broom text-sky-400"></i>
                      6.2 Estado da Limpeza
                    </span>
                    <span className="text-[9px] bg-sky-950/40 text-sky-400 border border-sky-900/40 px-2 py-0.5 rounded font-bold uppercase">Higienização</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-slate-400">Pendente</span>
                      <p className="text-[10px] text-slate-450 font-medium">Serviço semanal em escala</p>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-emerald-400">Concluída</span>
                      <p className="text-[10px] text-slate-450 font-medium">Registada pelo operador com fotos</p>
                    </div>
                  </div>
                </div>

                {/* 6.3 Movimento Financeiro */}
                <div className="bg-slate-900/40 border border-slate-700 p-4.5 rounded-xl space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                      <i className="fa-solid fa-money-bill-transfer text-emerald-400"></i>
                      6.3 Movimento Financeiro
                    </span>
                    <span className="text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 px-2 py-0.5 rounded font-bold uppercase">Tesouraria</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-amber-500">Pendente</span>
                      <p className="text-[10px] text-slate-450 font-medium">Gerado pelo ERP / Sem comprovativo</p>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-violet-400">Validado</span>
                      <p className="text-[10px] text-slate-450 font-medium">Aprovado por OCR ou reconciliação</p>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-emerald-400">Pago</span>
                      <p className="text-[10px] text-slate-450 font-medium">Transação liquidada com recibo</p>
                    </div>
                  </div>
                </div>

                {/* 6.4 Documento */}
                <div className="bg-slate-900/40 border border-slate-700 p-4.5 rounded-xl space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                      <i className="fa-solid fa-file-pdf text-amber-400"></i>
                      6.4 Estado do Documento
                    </span>
                    <span className="text-[9px] bg-amber-950/40 text-amber-400 border border-amber-900/40 px-2 py-0.5 rounded font-bold uppercase">Gestão Documental</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-red-400">Novo</span>
                      <p className="text-[10px] text-slate-450 font-medium">Submetido no ERP mas sem indexação</p>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-violet-400">Classificado</span>
                      <p className="text-[10px] text-slate-450 font-medium">Leitura efetuada e tags aplicadas</p>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-emerald-400">Arquivado</span>
                      <p className="text-[10px] text-slate-450 font-medium">Pasta criada e arquivado em árvore</p>
                    </div>
                  </div>
                </div>

                {/* 6.5 Notificação */}
                <div className="bg-slate-900/40 border border-slate-700 p-4.5 rounded-xl space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                      <i className="fa-solid fa-bell text-violet-400"></i>
                      6.5 Estado de Notificação
                    </span>
                    <span className="text-[9px] bg-violet-950/40 text-violet-400 border border-violet-900/40 px-2 py-0.5 rounded font-bold uppercase">Mensagens</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-slate-500">Enviada</span>
                      <p className="text-[10px] text-slate-450 font-medium">Disparada por canais automáticos</p>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-sky-400">Entregue</span>
                      <p className="text-[10px] text-slate-450 font-medium">Confirmada no telemóvel do morador</p>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-emerald-400">Lida</span>
                      <p className="text-[10px] text-slate-450 font-medium">Aberta e consultada na PWA</p>
                    </div>
                  </div>
                </div>

                {/* 6.6 Obras */}
                <div className="bg-slate-900/40 border border-slate-700 p-4.5 rounded-xl space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                      <i className="fa-solid fa-helmet-safety text-amber-500"></i>
                      6.6 Estado das Obras
                    </span>
                    <span className="text-[9px] bg-amber-950/40 text-amber-500 border border-amber-900/40 px-2 py-0.5 rounded font-bold uppercase">Engenharia</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-slate-400">Planeada</span>
                      <p className="text-[10px] text-slate-450 font-medium">Em estudo técnico / rateio financeiro</p>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-violet-400">Adjudicada</span>
                      <p className="text-[10px] text-slate-450 font-medium">Empreiteiro selecionado e adjudicado</p>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-amber-500">Em Curso</span>
                      <p className="text-[10px] text-slate-450 font-medium">Trabalhos físicos ativos no local</p>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="text-xs font-mono font-bold text-emerald-400">Concluída</span>
                      <p className="text-[10px] text-slate-450 font-medium">Obra encerrada e vistoriada</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      )}

      {/* PDF REPORT VIEW MODAL (PRINT-READY) */}
      {showPdfModal && budgetResult && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal header controls */}
            <div className="bg-slate-950 px-6 py-4 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <i className="fa-solid fa-file-pdf text-red-500 text-lg"></i>
                <div>
                  <h4 className="text-sm font-bold text-white leading-none">Relatório Anual do Orçamento de Condomínio (IA)</h4>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1">Simulação de Documento de Alta Fidelidade</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const confirmPrint = window.confirm("Pretende abrir o menu de impressão do sistema para guardar como PDF?");
                    if (confirmPrint) {
                      window.print();
                    }
                  }}
                  className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-print"></i>Imprimir / Guardar PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Este relatório é uma previsão gerada por IA, não o
                    // orçamento oficial aprovado — o envio automático em
                    // massa a todos os condóminos ainda não está
                    // implementado. Antes esta ação afirmava falsamente
                    // "agendada" sem nenhum envio real por trás.
                    alert("O envio automático em massa deste relatório de previsão ainda não está disponível. Use 'Imprimir / Guardar PDF' e partilhe manualmente através da Central de Documentos & Minutas.");
                  }}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-share-nodes"></i>Partilhar com Condóminos
                </button>
                <button
                  type="button"
                  onClick={() => setShowPdfModal(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm p-1"
                >
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>
            </div>

            {/* Modal document body (Print Area) */}
            <div className="p-8 overflow-y-auto flex-1 bg-slate-100/50 print:bg-white print:p-0" id="print-area">
              <div className="bg-white max-w-3xl mx-auto p-10 border border-slate-200/80 shadow-md rounded-lg space-y-8 print:border-none print:shadow-none print:p-0 relative overflow-hidden">
                
                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden opacity-10">
                  <div className="text-slate-400 font-black text-[50px] md:text-[70px] uppercase tracking-widest -rotate-45 text-center leading-none">
                    CondoManager AI<br/>Documento Oficial
                  </div>
                </div>

                {/* PDF Letterhead */}
                <div className="relative z-10 flex justify-between items-center border-b-4 border-double border-slate-900 pb-5">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black">
                        <span className="text-xs text-emerald-400">C</span>
                        <span className="text-xs text-white">M</span>
                      </div>
                      <span className="text-xs font-black text-slate-900 uppercase tracking-widest">
                        CondoManager AI
                      </span>
                    </div>
                    <h1 className="text-lg font-black text-slate-950 tracking-tight">RELATÓRIO DE PLANEAMENTO ORÇAMENTAL ANUAL</h1>
                    <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wide">Planeamento Financeiro Preventivo & Quotas Recomendadas</p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right space-y-1 text-xs font-mono">
                      <div className="text-slate-900 font-extrabold text-[11px]">Ref: BR23E/ORC-26</div>
                      <div className="text-[9px] text-slate-500">Emissão: 16 de Julho de 2026</div>
                      <div className="text-[9px] text-slate-500">Edifício: {predio?.nome || "Condomínio Exemplo"}</div>
                      <div className="text-[8px] bg-slate-900 text-white font-black px-1.5 py-0.5 rounded uppercase mt-1 inline-block">Proposta Oficial</div>
                    </div>
                    {/* Mock QR Code purely in CSS Grid */}
                    <div className="flex flex-col items-center shrink-0 border border-slate-200 p-1 rounded bg-white shadow-xs">
                      <div className="grid grid-cols-5 gap-0.5 h-10 w-10">
                        {[...Array(25)].map((_, idx) => (
                          <div key={idx} className={`h-1.5 w-1.5 ${[0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24].includes(idx) || Math.random() > 0.5 ? 'bg-slate-900' : 'bg-transparent'}`} />
                        ))}
                      </div>
                      <span className="text-[5px] text-slate-400 font-mono mt-0.5 uppercase">QR VERIFY</span>
                    </div>
                  </div>
                </div>

                {/* 1. Orçamento Anual Geral */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center">
                    <i className="fa-solid fa-calculator text-slate-500 mr-2 text-xs"></i> 1. Resumo do Orçamento Anual Preventivo (Exercício 2026/2027)
                  </h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Abaixo apresenta-se o plano financeiro consolidado calculado e otimizado através dos motores de Inteligência Artificial do CondoManager, integrando a totalidade de custos previstos e estimativa regulada de receitas correntes.
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1.5">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Receitas Previstas Anuais</span>
                      <span className="text-sm font-extrabold text-emerald-600 block mt-1">
                        €{budgetResult.receitas_previstas?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Despesas Previstas Anuais</span>
                      <span className="text-sm font-extrabold text-slate-900 block mt-1">
                        €{budgetResult.despesas_previstas?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Fundo de Reserva Legal (10%)</span>
                      <span className="text-sm font-extrabold text-slate-700 block mt-1">
                        €{budgetResult.fundo_minimo_legal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="bg-slate-900 text-slate-100 rounded-xl p-3 border border-slate-800 shadow-sm">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Saldo Anual Líquido Previsto</span>
                      <span className={`text-sm font-black block mt-1 ${budgetResult.saldo_anual_previsto >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        €{budgetResult.saldo_anual_previsto?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Detalhe de Custos por Rubrica */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center">
                    <i className="fa-solid fa-list-check text-slate-500 mr-2 text-xs"></i> 2. Detalhamento de Rubricas de Custos Previstos
                  </h3>
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-xs border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-100 text-slate-500 font-bold border-b border-slate-200 text-[9px] uppercase tracking-wide">
                          <th className="p-3 pl-4">Rubrica / Rubricado Operacional</th>
                          <th className="p-3 w-44 text-right">Encargo Anual Previsto</th>
                          <th className="p-3 w-40 text-center">Referência de Distribuição</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rubricas.map((rub, i) => (
                          <tr key={rub.id} className="border-b border-slate-150">
                            <td className="p-3 pl-4 font-semibold text-slate-700">
                              {i+1}. {rub.nome}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-950">
                              €{rub.valor.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-center text-slate-500 font-medium">
                              {rub.id === "obras" ? "Quota Extraordinária" : "Permilagem Legal"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900">
                          <td className="p-3 pl-4">Total Despesas Estimadas Ordinárias + Extraordinárias</td>
                          <td className="p-3 text-right font-mono font-black text-sm text-slate-900">
                            €{budgetResult.despesas_previstas?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* 3. Previsão de Quotas Recomendadas */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center">
                    <i className="fa-solid fa-hand-holding-dollar text-slate-500 mr-2 text-xs"></i> 3. Plano de Quotas de Condomínio Recomendado (Mensal por Fração)
                  </h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Com base no rateio equitativo do orçamento e provisões recomendadas de fundo de reserva, as quotas propostas são categorizadas em três cenários de robustez financeira e uma componente extraordinária temporal de obras.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 pt-1.5">
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 text-center">
                      <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block">Quota Mínima</span>
                      <span className="text-base font-black text-slate-800 block mt-1">€{budgetResult.quota_minima?.toFixed(2)}</span>
                      <span className="text-[7px] text-slate-400">/fração/mês</span>
                    </div>

                    <div className="border border-violet-200 bg-violet-50/20 rounded-xl p-3 text-center shadow-sm">
                      <span className="text-[8px] font-black uppercase tracking-wider text-violet-600 block">Quota Recomendada (IA)</span>
                      <span className="text-base font-black text-violet-700 block mt-1">€{budgetResult.quota_recomendada?.toFixed(2)}</span>
                      <span className="text-[7px] text-slate-400">/fração/mês</span>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 text-center">
                      <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block">Quota Ideal Preventiva</span>
                      <span className="text-base font-black text-slate-800 block mt-1">€{budgetResult.quota_ideal?.toFixed(2)}</span>
                      <span className="text-[7px] text-slate-400">/fração/mês</span>
                    </div>

                    <div className="border border-orange-200 bg-orange-50/20 rounded-xl p-3 text-center">
                      <span className="text-[8px] font-bold uppercase tracking-wider text-orange-600 block">Quota Extraordinária Obras</span>
                      <span className="text-base font-black text-orange-700 block mt-1">€{budgetResult.quota_extraordinaria?.toFixed(2)}</span>
                      <span className="text-[7px] text-slate-400">/fração/mês</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 italic bg-slate-50 p-3 rounded-lg border border-slate-150 leading-relaxed">
                    <strong>Nota IA explicativa de quotas:</strong> {budgetResult.explicacao_quotas}
                  </p>
                </div>

                {/* 4. Regulamento de Penalizações por Atraso */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center">
                    <i className="fa-solid fa-gavel text-slate-500 mr-2 text-xs"></i> 4. Regulamento e Política de Penalizações por Atraso de Quotas
                  </h3>
                  {aplicaPenalizacoes ? (
                    <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl text-xs space-y-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-600">
                        <div>
                          <span className="font-bold text-slate-400 text-[9px] uppercase block">Estado</span>
                          <span className="text-slate-800 font-bold flex items-center"><span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5"></span>Ativo</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-400 text-[9px] uppercase block">Cobrança</span>
                          <span className="text-slate-800 font-bold capitalize">{frequenciaPenalizacao}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-400 text-[9px] uppercase block">Taxa/Valor</span>
                          <span className="text-slate-800 font-bold">{valorPenalizacao}{tipoPenalizacao === "percentual" ? "%" : "€"}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-400 text-[9px] uppercase block">Tolerância</span>
                          <span className="text-slate-800 font-bold">{carenciaDias} Dias</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <span className="font-bold text-slate-500 text-[9px] uppercase block">Exceções e Regras de Isenção</span>
                        <p className="text-slate-600 text-[10px] italic leading-relaxed mt-0.5">"{regrasExcecoes}"</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">Nenhum regulamento de penalizações ativas para este exercício orçamental.</p>
                  )}
                </div>

                {/* 5. Autenticação e Signatures */}
                <div className="relative z-10 pt-8 border-t border-slate-200/80 space-y-6">
                  <p className="text-[9px] text-center text-slate-400 leading-relaxed">
                    Relatório gerado automaticamente por CondoManager AI no âmbito do plano preventivo predial em conformidade com o Artigo 4º do Decreto-Lei nº 268/94. Os dados apresentados refletem projeções estimadas e carecem de votação em Assembleia Geral de Condóminos.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-12 pt-4 text-center text-xs">
                    <div className="space-y-1">
                      <div className="border-b border-slate-300 mx-auto w-48 h-8"></div>
                      <span className="font-bold text-slate-800 block">Administração do Condomínio</span>
                      <span className="text-[10px] text-slate-400 font-medium">CondoManager AI / Representante</span>
                    </div>
                    <div className="space-y-1">
                      <div className="border-b border-slate-300 mx-auto w-48 h-8"></div>
                      <span className="font-bold text-slate-800 block">Presidente da Assembleia</span>
                      <span className="text-[10px] text-slate-400 font-medium">Condómino Designado</span>
                    </div>

                    {/* Integrated Digital Signature Box */}
                    <div className="col-span-2 pt-6 border-t border-slate-100 flex flex-col items-center justify-center space-y-2">
                      <div className="bg-emerald-50/50 border border-emerald-200/50 px-4 py-2.5 rounded-xl flex items-center gap-3 max-w-md shadow-xs">
                        <i className="fa-solid fa-shield-halved text-emerald-600 text-lg"></i>
                        <div className="text-left font-sans">
                          <div className="text-[9px] font-black uppercase text-emerald-800 tracking-wider">Assinatura Digital Certificada</div>
                          <div className="text-[8px] text-slate-500 font-mono break-all">ID: CM-AUTH-9883-294A-B662-C841E</div>
                          <div className="text-[7px] text-slate-400">Assinado digitalmente por CondoManager AI Auditor em 16/07/2026 às 11:34:52 UTC</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal footer controls */}
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                Fechar Visualizador
              </button>
            </div>
          </div>
        </div>
      )}


      <SendingReactionModal 
        isOpen={!!sendingReaction?.isOpen} 
        type={sendingReaction?.type || "mensagem"} 
        title={sendingReaction?.title} 
        onComplete={() => setSendingReaction(null)} 
      />
    </div>
  );
}

