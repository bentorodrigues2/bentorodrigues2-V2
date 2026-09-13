# ================================
# CONFIGURAÇÕES
# ================================
$SUPABASE_URL = "https://kejnoxkllsrpijzeaiqr.supabase.co"      # <-- ALTERA
$SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtlam5veGtsbHNycGlqemVhaXFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDQxMTE0MiwiZXhwIjoyMDk5OTg3MTQyfQ.1N-DY-8NbUtml3moKr2XKhFJRAflwzTR9ZGduRGhYAo"                # <-- ALTERA
$SQL_FILE = "./sql_automatico.sql"

# ================================
# LER SQL DO FICHEIRO
# ================================
if (!(Test-Path $SQL_FILE)) {
    Write-Host "ERRO: O ficheiro sql_automatico.sql não existe!"
    exit
}

$sql = Get-Content $SQL_FILE -Raw

# ================================
# EXECUTAR SQL VIA SUPABASE REST API
# ================================
$body = @{
    query = $sql
} | ConvertTo-Json

$response = Invoke-RestMethod `
    -Uri "$SUPABASE_URL/rest/v1/rpc/execute_sql" `
    -Headers @{ "apikey" = $SERVICE_ROLE; "Authorization" = "Bearer $SERVICE_ROLE" } `
    -Method Post `
    -ContentType "application/json" `
    -Body $body

Write-Host "SQL executado com sucesso!"
Write-Host "Resposta Supabase:"
$response
