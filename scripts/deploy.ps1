param(
    [string]$ServerIp = "78.47.88.125",
    [string]$Domain = "taskmaster.sportagio.app"
)

$repoRoot = Split-Path $PSScriptRoot -Parent
$target = "root@$ServerIp"

function Test-Health {
    param([int]$TimeoutSeconds)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -le $deadline) {
        try {
            $health = Invoke-RestMethod "https://$Domain/api/health" -TimeoutSec 5 -ErrorAction Stop
            if ($health.status -eq "ok") {
                return $true
            }
        } catch {
            Start-Sleep -Seconds 3
        }
    }
    return $false
}

Write-Host "Zjistuji aktualne nasazeny image..." -ForegroundColor Cyan
$previousImage = (ssh $target "docker inspect taskmaster-app-1 --format '{{.Image}}' 2>/dev/null").Trim()
if ($previousImage) {
    Write-Host "Pro pripadny rollback: $previousImage"
} else {
    Write-Host "Zadny bezici app kontejner, rollback nebude k dispozici." -ForegroundColor Yellow
}

Write-Host "Kopiruji konfiguraci na $ServerIp..." -ForegroundColor Cyan
scp "$repoRoot\deploy\docker-compose.prod.yml" "${target}:/opt/taskmaster/docker-compose.yml"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

scp "$repoRoot\deploy\Caddyfile" "${target}:/opt/taskmaster/Caddyfile"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Stahuji nove image a restartuji stack..." -ForegroundColor Cyan
ssh $target "cd /opt/taskmaster && docker compose pull --quiet && docker compose up -d"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Cekam na health endpoint..." -ForegroundColor Cyan
if (Test-Health -TimeoutSeconds 60) {
    ssh $target "docker inspect taskmaster-app-1 --format 'Nasazeno, app kontejner vytvoren: {{.Created}}'"
    exit 0
}

Write-Host "Health endpoint neodpovedel do 60 s." -ForegroundColor Red
ssh $target "cd /opt/taskmaster && docker compose ps; docker compose logs --tail 30 app"

if (-not $previousImage) {
    Write-Host "Rollback neni k dispozici, oprav rucne." -ForegroundColor Red
    exit 1
}

Write-Host "Vracim app na predchozi image..." -ForegroundColor Yellow
ssh $target "cd /opt/taskmaster && APP_IMAGE=$previousImage docker compose up -d --no-deps app"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Rollback selhal, oprav rucne." -ForegroundColor Red
    exit 1
}

if (Test-Health -TimeoutSeconds 60) {
    Write-Host "Rollback probehl, bezi predchozi verze." -ForegroundColor Yellow
    Write-Host "Pozor: pokud tento deploy spustil migraci, schema zustalo zmenene." -ForegroundColor Yellow
    Write-Host "Databaze se zamerne nevraci, down migrace v tomto projektu dropuji tabulky." -ForegroundColor Yellow
    exit 1
}

Write-Host "Ani po rollbacku aplikace neodpovida, oprav rucne." -ForegroundColor Red
exit 1
