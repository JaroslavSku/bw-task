param(
    [string]$ServerIp = "78.47.88.125"
)

Write-Host "Nasazuji novou verzi na $ServerIp..." -ForegroundColor Cyan

ssh "root@$ServerIp" "cd /opt/taskmaster && docker compose pull && docker compose up -d"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Nasazeni selhalo (exit code $LASTEXITCODE)." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Hotovo. Overuji health endpoint..." -ForegroundColor Cyan
Start-Sleep -Seconds 5
Invoke-RestMethod "https://taskmaster.sportagio.app/api/health"
