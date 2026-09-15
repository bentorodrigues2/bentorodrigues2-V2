-- ============================================================================
-- saveContratoToSupabase enviava colunas que não existem na tabela real
-- (servico, custo_mensal/custo_anual, documento_nome sem tipo_contrato/
-- data_inicio/estado, que são NOT NULL) e um id_contrato que nem era um
-- UUID válido — o upsert falhava sempre em silêncio (só console.warn),
-- por isso nenhum contrato ficava mesmo gravado. Corrigido o mapeamento de
-- colunas no código; esta migração acrescenta as colunas que a interface
-- já recolhia mas a tabela não tinha.
-- ============================================================================

ALTER TABLE contratos ADD COLUMN IF NOT EXISTS custo_mensal NUMERIC(10,2);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS sla_resposta TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS penalizacao_atraso TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS indexacao_preco TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS alerta_renovacao BOOLEAN DEFAULT true;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS historico_renovacoes JSONB DEFAULT '[]';
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS documento_nome TEXT;
