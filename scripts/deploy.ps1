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
ssh $target "cd /opt/taskmaster && docker compose pull --quiet && docker compose up -d"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Cekam na health endpoint..." -ForegroundColor Cyan
$deadline = (Get-Date).AddSeconds(60)
while ($true) {
    try {
        $health = Invoke-RestMethod "https://$Domain/api/health" -TimeoutSec 5 -ErrorAction Stop
        Write-Host "Aplikace odpovida: $($health.status)" -ForegroundColor Green
        break
    } catch {
        if ((Get-Date) -gt $deadline) {
            Write-Host "Health endpoint neodpovedel do 60 s." -ForegroundColor Red
            ssh $target "cd /opt/taskmaster && docker compose ps"
            exit 1
        }
        Start-Sleep -Seconds 3
    }
}

ssh $target "docker inspect taskmaster-app-1 --format 'App kontejner vytvoren: {{.Created}}'"
exit 0
