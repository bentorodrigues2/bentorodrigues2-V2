// ============================================================================
// TEMPLATES OFICIAIS DO AI STUDIO ROUTER & SCHEMA SQL SUPABASE
// ============================================================================

export const AI_STUDIO_ROUTER_LOGO_HTML = `<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp"
       alt="CondoManager AI"
       style="width:240px;opacity:0.95;" />
</div>`;

export const AI_STUDIO_ROUTER_SIGNATURE_HTML = `<br><br>
A administração do condomínio<br>
José Carlos Guerra<br>
📞 919 943 465<br>
✉️ bentorodrgues2@gmail.com`;

export interface OfficialTemplateDef {
  id: string;
  categoria: string;
  numero: number;
  titulo: string;
  icone: string;
  subject: string;
  corpo: string;
  isIgnored?: boolean;
}

export const OFFICIAL_EMAIL_ROUTER_TEMPLATES: Record<string, OfficialTemplateDef> = {
  ruido: {
    id: "ruido",
    categoria: "ruido",
    numero: 1,
    titulo: "Barulho / Ruído",
    icone: "📢",
    subject: "Registo de ocorrência de ruído",
    corpo: `Exmo. Sr./Sra. \${nome},
<br><br>
Registámos a sua comunicação referente a ruído proveniente de outra fração. A administração irá contactar os intervenientes e reforçar o cumprimento das regras de convivência previstas no Regulamento Interno.
<br><br>
Caso o ruído persista, agradecemos que nos informe para podermos atuar de forma mais célere.`
  },
  iluminacao: {
    id: "iluminacao",
    categoria: "iluminacao",
    numero: 2,
    titulo: "Lâmpada Fundida / Iluminação",
    icone: "💡",
    subject: "Registo de avaria na iluminação",
    corpo: `Exmo. Sr./Sra. \${nome},
<br><br>
Agradecemos a informação relativa à lâmpada fundida/avaria na iluminação das partes comuns.
<br><br>
A situação já foi registada e será efetuada a respetiva substituição com a maior brevidade possível.`
  },
  infiltracoes: {
    id: "infiltracoes",
    categoria: "infiltracoes",
    numero: 3,
    titulo: "Infiltração / Humidade",
    icone: "💧",
    subject: "Comunicação de infiltração / humidade",
    corpo: `Exmo. Sr./Sra. \${nome},
<br><br>
Acusamos a receção do seu email relativo à existência de infiltrações/humidade na sua fração.
<br><br>
Iremos proceder à verificação da origem da mesma, bem como articular com os técnicos/peritos necessários para apurar responsabilidades e agir em conformidade.`
  },
  elevador: {
    id: "elevador",
    categoria: "elevador",
    numero: 4,
    titulo: "Elevador Avariado / Manutenção",
    icone: "🛗",
    subject: "Avaria no elevador",
    corpo: `Exmo. Sr./Sra. \${nome},
<br><br>
Confirmamos que a avaria no elevador já foi comunicada à empresa de manutenção responsável pelo equipamento.
<br><br>
A equipa técnica foi solicitada para intervir no local o mais rapidamente possível.`
  },
  limpeza: {
    id: "limpeza",
    categoria: "limpeza",
    numero: 5,
    titulo: "Limpeza / Higiene",
    icone: "🧹",
    subject: "Comunicação sobre a limpeza do edifício",
    corpo: `Exmo. Sr./Sra. \${nome},
<br><br>
Agradecemos o seu reparo quanto à limpeza das áreas comuns.
<br><br>
A situação foi transmitida à equipa responsável pelo serviço de limpeza para que seja feita a devida intervenção e reforço.`
  },
  quotas: {
    id: "quotas",
    categoria: "quotas",
    numero: 6,
    titulo: "Pagamento de Quotas / Comprovativo",
    icone: "💳",
    subject: "Receção de comprovativo de pagamento",
    corpo: `Exmo. Sr./Sra. \${nome},
<br><br>
Acusamos a receção do comprovativo de pagamento da sua quota de condomínio.
<br><br>
Os serviços administrativos irão proceder à validação e emissão do respetivo recibo logo que a transferência seja conferida.`
  },
  documentos: {
    id: "documentos",
    categoria: "documentos",
    numero: 7,
    titulo: "Pedido de Documentos / Atas / Regulamento",
    icone: "📄",
    subject: "Pedido de documentos do condomínio",
    corpo: `Exmo. Sr./Sra. \${nome},
<br><br>
Recebemos o seu pedido de documentação relativo ao condomínio.
<br><br>
Iremos preparar os elementos solicitados e enviá-los no mais curto espaço de tempo.`
  },
  assembleia: {
    id: "assembleia",
    categoria: "assembleia",
    numero: 8,
    titulo: "Convocatória / Assembleia de Condóminos",
    icone: "👥",
    subject: "Assunto relativo à Assembleia de Condóminos",
    corpo: `Exmo. Sr./Sra. \${nome},
<br><br>
Registámos a sua questão relativa à assembleia de condóminos.
<br><br>
Todas as informações e esclarecimentos necessários ser-lhe-ão transmitidos pela administração com a brevidade possível.`
  },
  seguro: {
    id: "seguro",
    categoria: "seguro",
    numero: 9,
    titulo: "Sinistro / Seguro do Edifício",
    icone: "🛡️",
    subject: "Participação de sinistro / Seguro",
    corpo: `Exmo. Sr./Sra. \${nome},
<br><br>
Recebemos a informação relativa ao sinistro ocorrido.
<br><br>
Estamos a analisar a situação para verificar o enquadramento na apólice de seguro do condomínio e articular os procedimentos devidos junto da seguradora.`
  },
  obras: {
    id: "obras",
    categoria: "obras",
    numero: 10,
    titulo: "Obras / Intervenções",
    icone: "🔨",
    subject: "Comunicação sobre obras / intervenções",
    corpo: `Exmo. Sr./Sra. \${nome},
<br><br>
Tomámos nota da sua comunicação relativa a obras/intervenções.
<br><br>
A administração irá avaliar a situação técnica e assegurar que são cumpridas todas as normas legais e regulamentares em vigor.`
  },
  animais: {
    id: "animais",
    categoria: "animais",
    numero: 11,
    titulo: "Animais / Convivência",
    icone: "🐾",
    subject: "Assunto relativo a animais no condomínio",
    corpo: `Exmo. Sr./Sra. \${nome},
<br><br>
Acusamos a receção da sua exposição sobre a presença/comportamento de animais nas áreas comuns.
<br><br>
Iremos proceder à sensibilização dos respetivos proprietários para o estrito cumprimento das regras de higiene e convivência.`
  },
  outro: {
    id: "outro",
    categoria: "outro",
    numero: 12,
    titulo: "Dúvidas Gerais / Outros Assuntos",
    icone: "✉️",
    subject: "Comunicação à Administração do Condomínio",
    corpo: `Exmo. Sr./Sra. \${nome},
<br><br>
Agradecemos o seu contacto. A sua mensagem foi devidamente registada pela administração e encontra-se em análise.
<br><br>
Entraremos em contacto consigo assim que tivermos resposta para o assunto exposto.`
  },
  fornecedor: {
    id: "fornecedor",
    categoria: "fornecedor",
    numero: 13,
    titulo: "Fornecedor / Faturas / Notificações Automáticas (Ignorar)",
    icone: "🚫",
    subject: "",
    corpo: "",
    isIgnored: true
  }
};

/**
 * Monta a mensagem completa em HTML com o logotipo oficial e a assinatura.
 */
export function buildOfficialEmailMessage(corpo: string, nomeProprietario = "Condómino(a)"): string {
  if (!corpo) return "";
  const nomeFinal = nomeProprietario.trim() || "Condómino(a)";
  const corpoSubstituido = corpo.replace(/\$\{nome\}/g, nomeFinal);
  return `${AI_STUDIO_ROUTER_LOGO_HTML}\n\n${corpoSubstituido}\n\n${AI_STUDIO_ROUTER_SIGNATURE_HTML}`;
}

/**
 * Prompt completo pronto a colar no Google AI Studio
 */
export const PROMPT_COMPLETO_AI_STUDIO = `⭐ LOGOTIPO PARA TODOS OS EMAILS (AI Studio Router)
Cola isto no início de TODAS as mensagens:

<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp"
       alt="CondoManager AI"
       style="width:240px;opacity:0.95;" />
</div>

⭐ PROMPT COMPLETO PARA COLAR NO AI STUDIO (TODAS AS CATEGORIAS)
Organizado, limpo, pronto a colar.

🟦 1. Barulho / Ruído
subject: Registo de ocorrência de ruído
message:
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Registámos a sua comunicação referente a ruído proveniente de outra fração. A administração irá contactar os intervenientes e reforçar o cumprimento das regras de convivência previstas no Regulamento Interno.
<br><br>
Caso o ruído persista, agradecemos que nos informe para podermos atuar de forma mais célere.
<br><br>
A administração do condomínio
José Carlos Guerra
📞 919 943 465
✉️ bentorodrgues2@gmail.com

---

🟦 2. Lâmpada fundida / iluminação
subject: Registo de avaria na iluminação
message:
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Agradecemos a informação relativa à lâmpada fundida/avaria na iluminação das partes comuns.
<br><br>
A situação já foi registada e será efetuada a respetiva substituição com a maior brevidade possível.
<br><br>
A administração do condomínio
José Carlos Guerra
📞 919 943 465
✉️ bentorodrgues2@gmail.com

---

🟦 3. Infiltrações / humidades
subject: Comunicação de infiltração / humidade
message:
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Acusamos a receção do seu email relativo à existência de infiltrações/humidade na sua fração.
<br><br>
Iremos proceder à verificação da origem da mesma, bem como articular com os técnicos/peritos necessários para apurar responsabilidades e agir em conformidade.
<br><br>
A administração do condomínio
José Carlos Guerra
📞 919 943 465
✉️ bentorodrgues2@gmail.com

---

🟦 4. Elevador avariado
subject: Avaria no elevador
message:
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Confirmamos que a avaria no elevador já foi comunicada à empresa de manutenção responsável pelo equipamento.
<br><br>
A equipa técnica foi solicitada para intervir no local o mais rapidamente possível.
<br><br>
A administração do condomínio
José Carlos Guerra
📞 919 943 465
✉️ bentorodrgues2@gmail.com

---

🟦 5. Limpeza / Higiene
subject: Comunicação sobre a limpeza do edifício
message:
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Agradecemos o seu reparo quanto à limpeza das áreas comuns.
<br><br>
A situação foi transmitida à equipa responsável pelo serviço de limpeza para que seja feita a devida intervenção e reforço.
<br><br>
A administração do condomínio
José Carlos Guerra
📞 919 943 465
✉️ bentorodrgues2@gmail.com

---

🟦 6. Pagamento de Quotas / Comprovativo
subject: Receção de comprovativo de pagamento
message:
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Acusamos a receção do comprovativo de pagamento da sua quota de condomínio.
<br><br>
Os serviços administrativos irão proceder à validação e emissão do respetivo recibo logo que a transferência seja conferida.
<br><br>
A administração do condomínio
José Carlos Guerra
📞 919 943 465
✉️ bentorodrgues2@gmail.com

---

🟦 7. Pedido de Documentos / Atas / Regulamento
subject: Pedido de documentos do condomínio
message:
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Recebemos o seu pedido de documentação relativo ao condomínio.
<br><br>
Iremos preparar os elementos solicitados e enviá-los no mais curto espaço de tempo.
<br><br>
A administração do condomínio
José Carlos Guerra
📞 919 943 465
✉️ bentorodrgues2@gmail.com

---

🟦 8. Convocatória / Assembleia de Condóminos
subject: Assunto relativo à Assembleia de Condóminos
message:
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Registámos a sua questão relativa à assembleia de condóminos.
<br><br>
Todas as informações e esclarecimentos necessários ser-lhe-ão transmitidos pela administração com a brevidade possível.
<br><br>
A administração do condomínio
José Carlos Guerra
📞 919 943 465
✉️ bentorodrgues2@gmail.com

---

🟦 9. Sinistro / Seguro do Edifício
subject: Participação de sinistro / Seguro
message:
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Recebemos a informação relativa ao sinistro ocorrido.
<br><br>
Estamos a analisar a situação para verificar o enquadramento na apólice de seguro do condomínio e articular os procedimentos devidos junto da seguradora.
<br><br>
A administração do condomínio
José Carlos Guerra
📞 919 943 465
✉️ bentorodrgues2@gmail.com

---

🟦 10. Obras / Intervenções
subject: Comunicação sobre obras / intervenções
message:
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Tomámos nota da sua comunicação relativa a obras/intervenções.
<br><br>
A administração irá avaliar a situação técnica e assegurar que são cumpridas todas as normas legais e regulamentares em vigor.
<br><br>
A administração do condomínio
José Carlos Guerra
📞 919 943 465
✉️ bentorodrgues2@gmail.com

---

🟦 11. Animais / Convivência
subject: Assunto relativo a animais no condomínio
message:
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Acusamos a receção da sua exposição sobre a presença/comportamento de animais nas áreas comuns.
<br><br>
Iremos proceder à sensibilização dos respetivos proprietários para o estrito cumprimento das regras de higiene e convivência.
<br><br>
A administração do condomínio
José Carlos Guerra
📞 919 943 465
✉️ bentorodrgues2@gmail.com

---

🟦 12. Dúvidas Gerais / Outros Assuntos
subject: Comunicação à Administração do Condomínio
message:
<div style="text-align:center;margin-bottom:25px;">
  <img src="https://bentorodrigues2.vercel.app/email/20-logotipo.webp" style="width:240px;opacity:0.95;" />
</div>

Exmo. Sr./Sra. \${nome},
<br><br>
Agradecemos o seu contacto. A sua mensagem foi devidamente registada pela administração e encontra-se em análise.
<br><br>
Entraremos em contacto consigo assim que tivermos resposta para o assunto exposto.
<br><br>
A administração do condomínio
José Carlos Guerra
📞 919 943 465
✉️ bentorodrgues2@gmail.com

---

🟦 13. Email de Fornecedores / Faturas / Notificações Automáticas
subject: null
message: null
categoria: "ignorar"`;

/**
 * Código SQL para criação da tabela 'gestao_chaves' no Supabase
 * com todas as colunas solicitadas, RLS e índices.
 */
export const SQL_GESTAO_CHAVES_SUPABASE = `-- ====================================================================
-- CRIAÇÃO DA TABELA 'gestao_chaves' NO SUPABASE (POSTGRESQL)
-- Inclui colunas: id_chave, id_predio, local, responsavel, status,
-- data_entrega, data_devolucao, RLS e índices de performance.
-- ====================================================================

-- 1. Habilitar extensões necessárias para UUID (se ainda não ativas)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Criar a tabela 'gestao_chaves'
CREATE TABLE IF NOT EXISTS public.gestao_chaves (
  id_chave UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_predio UUID NOT NULL,
  local TEXT NOT NULL,
  responsavel TEXT,
  status TEXT NOT NULL DEFAULT 'disponivel',
  data_entrega TIMESTAMPTZ,
  data_devolucao TIMESTAMPTZ,
  
  -- Campos adicionais para compatibilidade completa com o Claviculário
  codigo_chave TEXT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  num_chaveiro TEXT DEFAULT '1',
  no_claviculario BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  
  -- Timestamps de auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Chave estrangeira para a tabela de prédios (se existir na base de dados)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'predios'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_gestao_chaves_predio'
    ) THEN
      ALTER TABLE public.gestao_chaves
        ADD CONSTRAINT fk_gestao_chaves_predio
        FOREIGN KEY (id_predio) REFERENCES public.predios(id_predio)
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 4. Constraint de validação do status da chave
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'chk_gestao_chaves_status'
  ) THEN
    ALTER TABLE public.gestao_chaves
      ADD CONSTRAINT chk_gestao_chaves_status
      CHECK (status IN ('disponivel', 'entregue', 'devolvida', 'perdida', 'em_manutencao'));
  END IF;
END $$;

-- 5. Índices de pesquisa rápida
CREATE INDEX IF NOT EXISTS idx_gestao_chaves_predio ON public.gestao_chaves(id_predio);
CREATE INDEX IF NOT EXISTS idx_gestao_chaves_status ON public.gestao_chaves(status);
CREATE INDEX IF NOT EXISTS idx_gestao_chaves_local ON public.gestao_chaves(local);
CREATE INDEX IF NOT EXISTS idx_gestao_chaves_responsavel ON public.gestao_chaves(responsavel);

-- 6. Trigger automático para atualização da coluna 'updated_at'
CREATE OR REPLACE FUNCTION public.fn_update_gestao_chaves_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gestao_chaves_updated_at ON public.gestao_chaves;
CREATE TRIGGER trg_gestao_chaves_updated_at
  BEFORE UPDATE ON public.gestao_chaves
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_gestao_chaves_timestamp();

-- 7. Ativar Row Level Security (RLS)
ALTER TABLE public.gestao_chaves ENABLE ROW LEVEL SECURITY;

-- 8. Políticas RLS (Administração / Acesso Autenticado)
DROP POLICY IF EXISTS "Acesso total a gestao_chaves para utilizadores autenticados" ON public.gestao_chaves;
CREATE POLICY "Acesso total a gestao_chaves para utilizadores autenticados"
  ON public.gestao_chaves
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política de leitura pública (caso a PWA/Portal necessite de leitura de chaves das áreas comuns)
DROP POLICY IF EXISTS "Leitura de chaves por condominio" ON public.gestao_chaves;
CREATE POLICY "Leitura de chaves por condominio"
  ON public.gestao_chaves
  FOR SELECT
  TO authenticated
  USING (true);
`;
