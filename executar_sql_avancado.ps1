# ================================
# CONFIGURAÇÕES
# ================================
$SUPABASE_URL = "https://kejnoxkllsrpijzeaiqr.supabase.co"
$SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtlam5veGtsbHNycGlqemVhaXFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDQxMTE0MiwiZXhwIjoyMDk5OTg3MTQyfQ.1N-DY-8NbUtml3moKr2XKhFJRAflwzTR9ZGduRGhYAo"
$SQL_FILE = "./sql_automatico.sql"

# ================================
# 1) CRIAR FUNÇÃO execute_sql SE NÃO EXISTIR
# ================================
$createFunction = @"
CREATE OR REPLACE FUNCTION public.execute_sql(query text)
RETURNS json
LANGUAGE plpgsql
AS \$\$
DECLARE
    result json;
BEGIN
    EXECUTE query;
    RETURN json_build_object('status', 'ok');
END;
\$\$;
"@

Invoke-RestMethod `
    -Uri "$SUPABASE_URL/rest/v1/rpc/execute_sql" `
    -Headers @{ "apikey" = $SERVICE_ROLE; "Authorization" = "Bearer $SERVICE_ROLE" } `
    -Method Post `
    -ContentType "application/json" `
    -Body (@{ query = $createFunction } | ConvertTo-Json)

Write-Host "Função execute_sql criada ou atualizada."


# ================================
# 2) LER SQL DO FICHEIRO
# ================================
if (!(Test-Path $SQL_FILE)) {
    Write-Host "ERRO: O ficheiro sql_automatico.sql não existe!"
    exit
}

$sql = Get-Content $SQL_FILE -Raw


# ================================
# 3) EXECUTAR SQL
# ================================
$response = Invoke-RestMethod `
    -Uri "$SUPABASE_URL/rest/v1/rpc/execute_sql" `
    -Headers @{ "apikey" = $SERVICE_ROLE; "Authorization" = "Bearer $SERVICE_ROLE" } `
    -Method Post `
    -ContentType "application/json" `
    -Body (@{ query = $sql } | ConvertTo-Json)

Write-Host "SQL executado com sucesso!"
Write-Host $response
