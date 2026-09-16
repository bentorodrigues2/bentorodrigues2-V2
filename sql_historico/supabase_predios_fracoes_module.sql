-- Módulo de Prédios & Frações — correções e tabelas novas necessárias
-- Corre isto no SQL Editor do Supabase do projeto.

-- 1. CORREÇÃO CRÍTICA: falta a coluna "referencia_br23e" na tabela fracoes.
-- O código já tenta gravar este campo sempre que uma fração NOVA é criada
-- (GestaoFracoes.tsx) — sem esta coluna, a criação de frações novas falha
-- com erro 400 (a Supabase rejeita o pedido inteiro quando uma coluna do
-- payload não existe). Isto está a acontecer em produção neste momento.
ALTER TABLE public.fracoes ADD COLUMN IF NOT EXISTS referencia_br23e TEXT;

-- 2. Falta a coluna que regista se a fração está inscrita no pedido anual
-- automatizado da apólice de incêndio (usada como toggle on/off no ecrã).
-- CORREÇÃO: já corrida antes como TIMESTAMPTZ por engano — a UI usa-a como
-- um interruptor Sim/Não, por isso troca-se aqui para BOOLEAN.
ALTER TABLE public.fracoes DROP COLUMN IF EXISTS solicitacao_email_incendio;
ALTER TABLE public.fracoes ADD COLUMN IF NOT EXISTS solicitacao_email_incendio BOOLEAN DEFAULT true;

-- 3. GESTÃO DE INQUILINOS & HISTÓRICO DE ARRENDAMENTOS
-- Hoje esta secção (residentes_inquilinos) só existe em memória do browser
-- com dados de exemplo fixos ("Maria Antónia Santos" etc.) — nada é
-- gravado. Esta tabela substitui essa simulação por dados reais.
CREATE TABLE IF NOT EXISTS public.residentes_inquilinos (
  id_residente TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL,
  id_fracao TEXT NOT NULL,
  nome TEXT NOT NULL,
  nif TEXT,
  email TEXT,
  telefone TEXT,
  documento_identificacao TEXT,
  data_entrada DATE,
  data_saida DATE,
  valor_renda NUMERIC,
  valor_caucao NUMERIC,
  chaves_entregues TEXT,
  estado TEXT NOT NULL DEFAULT 'ativo', -- 'ativo' | 'anterior'
  contrato_arrendamento_caminho TEXT,   -- caminho no Storage, se o admin anexar o contrato
  termo_devolucao_caminho TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_residentes_fracao ON public.residentes_inquilinos(id_fracao);
CREATE INDEX IF NOT EXISTS idx_residentes_predio ON public.residentes_inquilinos(id_predio);

-- 4. VALIDADOR DE PEDIDOS DO REGULAMENTO INTERNO POR IA
-- Regista o histórico de pedidos submetidos (festas, obras, animais, etc.)
-- e a decisão real gerada pela IA (Aprovado / Aprovado com Condições /
-- Rejeitado), hoje 100% simulado por keyword-matching local sem IA nenhuma.
CREATE TABLE IF NOT EXISTS public.pedidos_regulamento (
  id_pedido TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL,
  id_fracao TEXT,
  solicitante_nome TEXT,
  texto_pedido TEXT NOT NULL,
  decisao TEXT,          -- 'Aprovado' | 'Aprovado com Condições' | 'Rejeitado'
  fundamentacao TEXT,
  recomendacao_ia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pedidos_regulamento_predio ON public.pedidos_regulamento(id_predio, created_at DESC);

-- Nota: o texto do Regulamento Interno em si (os 6 eixos de regras) fica
-- guardado dentro da coluna JSONB que já existe, predios.patrimonio
-- (mesmo padrão já usado neste ficheiro para a assinatura digital do
-- administrador) — não precisa de coluna nova.
