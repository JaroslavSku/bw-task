param(
    [string]$ServerIp = "78.47.88.125",
    [string]$Domain = "taskmaster.sportagio.app"
)

$repoRoot = Split-Path $PSScriptRoot -Parent
$target = "root@$ServerIp"

Write-Host "Kopiruji konfiguraci na $ServerIp..." -ForegroundColor Cyan
scp "$repoRoot\deploy\docker-compose.prod.yml" "${target}:/opt/taskmaster/docker-compose.yml"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

scp "$repoRoot\deploy\Caddyfile" "${target}:/opt/taskmaster/Caddyfile"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Stahuji nove image a restartuji stack..." -ForegroundColor Cyan
ssh $target "cd /opt/taskmaster && docker compose pull && docker compose up -d"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Overuji health endpoint..." -ForegroundColor Cyan
Start-Sleep -Seconds 5
Invoke-RestMethod "https://$Domain/api/health"
