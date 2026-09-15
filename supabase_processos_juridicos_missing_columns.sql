-- A tabela "processos_juridicos" já existe no Supabase mas não tem coluna
-- para guardar as provas documentais juntas a cada processo (recibos,
-- prints, fotos, avisos de receção CTT, etc.) — só tinha o histórico de
-- tramitação. Aditivo (ADD COLUMN IF NOT EXISTS): não apaga nada.

ALTER TABLE processos_juridicos
  ADD COLUMN IF NOT EXISTS provas JSONB DEFAULT '[]'::jsonb;
