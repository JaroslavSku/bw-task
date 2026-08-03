# TaskMaster

Todo aplikace (Next.js 16 + PostgreSQL) dotažená z rozpracovaného stavu do produkčního.

**Živě:** https://taskmaster.sportagio.app

## Jak spustit

### Docker Compose (doporučeno)

```bash
cp .env.example .env        # doplň POSTGRES_PASSWORD a JWT_SECRET
docker compose up --build
```

Běží na http://localhost:3000, migrace proběhnou v samostatném kontejneru před
startem aplikace.

### Lokální vývoj

Předpoklady: Node 22+, pnpm 11, běžící PostgreSQL.

```bash
pnpm install
cp .env.example .env.local   # DATABASE_URL + JWT_SECRET
createdb -U postgres taskmaster
pnpm migrate
pnpm dev
```

## Architektura

```
app/api/**/route.ts     HTTP vrstva: parsování, validace, stavové kódy
lib/schemas/*.ts        Zod schémata = jediný zdroj typů (z.infer)
lib/repositories/*.ts   SQL dotazy (pg, parametrizované)
lib/auth/*.ts           bcrypt hesla, JWT (jose), httpOnly cookie
lib/realtime/*.ts       Postgres LISTEN klient pro SSE
migrations/             db-migrate (čisté SQL v migrations/sqls)
```

## CI/CD a deployment

- **`ci.yml`** (PR + master): tři joby: `checks` (typecheck, lint, testy proti
  Postgres service kontejneru, build), `docker-build` (sestaví oba image bez
  pushnutí, ať se rozbitý Dockerfile pozná už na PR) a `audit`
  (`pnpm audit --prod --audit-level critical`).
- **`docker.yml`** (po merge do master): build & push `ghcr.io/jaroslavsku/bw-task`
  a `bw-task-migrate` s tagy `latest` + SHA, poté trivy scan.
- **`terraform/`**: Hetzner VM (cx23, Ubuntu 24.04), firewall (SSH jen z mé IP,
  HTTP/HTTPS veřejné). Cloud-init dělá jen bootstrap: Docker a `.env` se secrety.
- **`deploy/`**: produkční stack jako běžné soubory (`docker-compose.prod.yml`
  s ghcr images + Caddy, `Caddyfile`). Aplikační změna tak nevyžaduje sáhnout
  na Terraform a compose jde validovat přes `docker compose config`.

Proměnné se nepíšou do souboru, ale předávají přes `TF_VAR_*` (nic tajného tak
neleží natrvalo na disku):

```powershell
cd terraform
$env:TF_VAR_hcloud_token      = "..."
$env:TF_VAR_my_ip             = (curl.exe -s ifconfig.me)
$env:TF_VAR_postgres_password = "..."
$env:TF_VAR_jwt_secret        = "..."   # min. 32 znaku
$env:TF_VAR_domain            = "taskmaster.sportagio.app"
tofu init
tofu apply
```

Po `tofu apply` je server jen připravený, aplikaci na něj dostane až
`.\scripts\deploy.ps1` (nakopíruje `deploy/`, stáhne image, restartuje stack,
ověří `/api/health`). Infrastruktura a aplikace jsou oddělené kroky.

TLS řeší Caddy s automatickým Let's Encrypt certifikátem, HTTP se přesměruje
na HTTPS.

## Zbývající práce

Viz [HANDOVER.md](HANDOVER.md).
