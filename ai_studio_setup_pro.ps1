# ============================================
# CONFIGURAÇÕES DO PROJETO
# ============================================
$SUPABASE_URL = "https://kejnoxkllsrpijzeaiqr.supabase.co"
$SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtlam5veGtsbHNycGlqemVhaXFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDQxMTE0MiwiZXhwIjoyMDk5OTg3MTQyfQ.1N-DY-8NbUtml3moKr2XKhFJRAflwzTR9ZGduRGhYAo"   # <-- ALTERA ISTO
$HEADERS = @{ "apikey" = $SERVICE_ROLE; "Authorization" = "Bearer $SERVICE_ROLE" }

Write-Host "=== AI STUDIO SETUP PRO ==="


# ============================================
# 1) CRIAR FUNÇÃO execute_sql (segura e compatível)
# ============================================
Write-Host "Criando função execute_sql..."

$createFunction = @"
CREATE OR REPLACE FUNCTION public.execute_sql(query text)
RETURNS text
LANGUAGE plpgsql
AS \$\$
BEGIN
    EXECUTE query;
    RETURN 'ok';
END;
\$\$;
"@

Invoke-RestMethod `
    -Uri "$SUPABASE_URL/rest/v1/rpc/execute_sql" `
    -Headers $HEADERS `
    -Method Post `
    -ContentType "application/json" `
    -Body (@{ query = $createFunction } | ConvertTo-Json)

Write-Host "Função execute_sql criada."


# ============================================
# 2) CRIAR BUCKET documentos
# ============================================
Write-Host "Criando bucket 'documentos'..."

$bucketBody = @{
    id = "documentos"
    name = "documentos"
    public = $false
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "$SUPABASE_URL/storage/v1/bucket" `
    -Headers $HEADERS `
    -Method Post `
    -ContentType "application/json" `
    -Body $bucketBody

Write-Host "Bucket criado."


# ============================================
# 3) CRIAR POLICIES RLS PARA O BUCKET
# ============================================
Write-Host "Criando policies RLS..."

$policies = @(
@"
CREATE POLICY documentos_select ON storage.objects
FOR SELECT USING (bucket_id = 'documentos');
"@,
@"
CREATE POLICY documentos_insert ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'documentos');
"@
)

foreach ($policy in $policies) {
    Invoke-RestMethod `
        -Uri "$SUPABASE_URL/rest/v1/rpc/execute_sql" `
        -Headers $HEADERS `
        -Method Post `
        -ContentType "application/json" `
        -Body (@{ query = $policy } | ConvertTo-Json)

    Write-Host "Policy criada."
}


# ============================================
# 4) EXECUTAR SQL AUTOMÁTICO (linha a linha)
# ============================================
Write-Host "Executando SQL automático..."

$sqlLines = Get-Content "./sql_automatico.sql"

foreach ($line in $sqlLines) {
    if ($line.Trim() -ne "") {
        Invoke-RestMethod `
            -Uri "$SUPABASE_URL/rest/v1/rpc/execute_sql" `
            -Headers $HEADERS `
            -Method Post `
            -ContentType "application/json" `
            -Body (@{ query = $line } | ConvertTo-Json)

        Write-Host "OK: $line"
    }
}

Write-Host "SQL executado com sucesso."


# ============================================
# 5) TESTAR ENDPOINTS PDF AUTOMATICAMENTE
# ============================================
Write-Host "Testando endpoints PDF..."

$endpoints = @(
    "convocatoria",
    "ata",
    "aviso",
    "recibo",
    "carta-n1",
    "carta-n2",
    "boas-vindas",
    "sinistro",
    "scie"
)

foreach ($ep in $endpoints) {

    $body = @{
        conteudo = "Teste automático PDF ($ep)"
        ano = 2026
        predio = "Predio-Teste"
        fracao = "A"
        email = "teste@exemplo.com"
    } | ConvertTo-Json

    try {
        Invoke-RestMethod `
            -Uri "http://localhost:3000/api/pdf/$ep" `
            -Method Post `
            -ContentType "application/json" `
            -Body $body

        Write-Host "Endpoint $ep OK"
    }
    catch {
        Write-Host "Erro no endpoint $ep"
    }
}

Write-Host "=== AI STUDIO SETUP COMPLETO ==="
