-- ============================================================================
-- Gestão de Cauções (depósitos de dinheiro real de condóminos — salão de
-- festas, obras/mudanças, comando de garagem, chave técnica) vivia só em
-- useState local em FinanceiroAvancado.tsx, com 2 linhas de demonstração
-- fixas no código. Qualquer caução registada, devolvida ou retida
-- desaparecia ao recarregar a página — sem qualquer registo persistente de
-- dinheiro de terceiros retido pelo condomínio.
-- ============================================================================

CREATE TABLE IF NOT EXISTS caucoes (
  id_caucao TEXT PRIMARY KEY,
  id_predio TEXT NOT NULL REFERENCES predios(id_predio) ON DELETE CASCADE,
  id_fracao TEXT NOT NULL,
  fracao_nome TEXT NOT NULL,
  titular TEXT NOT NULL,
  finalidade TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_deposito DATE NOT NULL,
  metodo_pagamento TEXT NOT NULL,
  comprovativo_ref TEXT,
  estado TEXT NOT NULL DEFAULT 'Ativa (Retida)',
  data_resolucao DATE,
  comprovativo_devolucao TEXT,
  justificacao_retencao TEXT,
  valor_retido NUMERIC(12,2),
  valor_devolvido NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS caucoes_id_predio_idx ON caucoes(id_predio);

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'caucoes' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.caucoes', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE caucoes ENABLE ROW LEVEL SECURITY;
