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
createdb taskmaster
pnpm migrate
pnpm dev
```

Účet si vytvoříš na `/login` (Sign up). Realtime vyzkoušíš otevřením aplikace
ve dvou oknech — změna v jednom se do vteřiny projeví v druhém.

| Příkaz                         | Co dělá                                 |
| ------------------------------ | --------------------------------------- |
| `pnpm dev`                     | dev server (Turbopack)                  |
| `pnpm build` / `pnpm start`    | produkční build / server                |
| `pnpm test`                    | vitest (potřebuje DB `taskmaster_test`) |
| `pnpm typecheck` / `pnpm lint` | tsc / eslint                            |
| `pnpm migrate`                 | db-migrate up                           |

## Co jsem našel a opravil

1. **Memory leak v `trackRequest()`** — každý požadavek uložil do modulové `Map`
   ~4 MB (serializovaný `process.env`, stack trace, 2 MB padding) a nikdy nemazal.
   Naměřeno 91 MB → 1549 MB po 349 požadavcích; při 50 spojeních server spadl po
   ~1000 požadavcích (23k chyb z 24k odpovědí). Funkce nedělala nic užitečného —
   odstraněna, logování nahrazeno pinem.
2. **Únik tajemství** — tatáž funkce držela v paměti celé `process.env` včetně
   DB hesel a klíčů. Bezpečnostní, ne výkonnostní problém.
3. **Umělé zpoždění 100 ms** v GET handleru — odstraněno.
4. **„Databáze" bylo pole v paměti procesu** — restart = ztráta dat, druhá
   instance = jiná data. Nahrazeno PostgreSQL; bez toho nejde splnit škálování.
5. **Žádná validace vstupů** — `POST {}` vytvořil todo bez textu, smazání
   neexistujícího id vrátilo `200 success`. Teď Zod a správné kódy (400/401/404/409).
6. **Frontend bez ošetření chyb** — fetch bez catch, optimistické updaty bez
   rollbacku, request na každou klávesu, race condition mezi odpověďmi. Teď
   debounce 300 ms, AbortController, rollback s hláškou, error stav s retry.
7. Drobnější: duplicitní `layout.js`, typy definované dvakrát, `strict: false`,
   `id: Date.now()` (kolize), statistiky ve 4 průchodech, externí Google Fonts.

### Měření (autocannon, produkční build)

| Metrika                                    | Před                        | Po                    |
| ------------------------------------------ | --------------------------- | --------------------- |
| GET /api/todos, 5 spojení — medián latence | 114 ms                      | **12 ms**             |
| GET /api/todos, 5 spojení — propustnost    | 43 req/s                    | **354 req/s**         |
| 50 spojení, 15 s                           | **pád serveru** (~23k chyb) | **0 chyb**, 386 req/s |
| Paměť pod zátěží                           | +4,2 MB/request, trvale     | stabilní ~250 MB      |

## Architektura

```
app/api/**/route.ts     HTTP vrstva: parsování, validace, stavové kódy
lib/schemas/*.ts        Zod schémata = jediný zdroj typů (z.infer)
lib/repositories/*.ts   SQL dotazy (pg, parametrizované)
lib/auth/*.ts           bcrypt hesla, JWT (jose), httpOnly cookie
lib/realtime/*.ts       Postgres LISTEN klient pro SSE
migrations/             db-migrate (čisté SQL v migrations/sqls)
```

- **Autentizace:** bcrypt (12 rund), JWT v httpOnly cookie (`sameSite: lax`,
  `secure` v produkci), middleware chrání stránky i API, každý SQL dotaz
  filtruje `user_id`.
- **Realtime:** DB trigger → `pg_notify` → jeden LISTEN klient na proces → SSE
  stream per uživatel → klient refetchne. Funguje napříč instancemi, protože
  společným bodem je Postgres.
- **Škálování:** aplikace nedrží stav v paměti → lze pustit N instancí za load
  balancer nad jednou DB. Index kopíruje hlavní dotaz, stránkování limit/offset,
  statistiky jedním dotazem, connection pool (max 10/instance).

## Rozhodnutí a kompromisy

- **Next.js Route Handlers, ne NestJS** — backend už existoval a zadání říká
  dostat aplikaci do produkčního stavu, ne přepsat framework. Vrstvy (routes →
  repositories → schémata) ale odpovídají tomu, co dělá Nest.
- **Čistý `pg` + SQL, ne ORM** — datová vrstva je pět dotazů; SQL je tu čitelnější
  než modely ORM. Migrace řeší zavedený db-migrate.
- **Ne Supabase** — nasazení na VM má být soběstačné. Přechod by byl přímočarý
  (čisté Postgres schéma), přibyla by RLS a Supabase Auth.
- **Ne RLS** — klient nemá přímý přístup k DB; `where user_id = $1` skládané
  serverem je vynucená hranice. RLS by znamenala propagovat identitu do DB session
  a hlídat její reset v poolu — složitost bez přidané bezpečnosti v tomto modelu.
- **Ne Redis/cache** — per-user data měněná každou akcí; cache by netrefovala
  a její invalidace je riziko úniku mezi uživateli. Správně: indexy a stránkování.
- **SSE, ne WebSocket** — tok notifikací je jednosměrný (zápisy jdou běžným
  POST/PATCH). SSE je obyčejné HTTP: projde proxy, autentizuje se stejnou cookie,
  prohlížeč má vestavěný reconnect. WebSocket by v Route Handlers vyžadoval
  custom server nebo samostatný ws proces.
- **`pg_notify`, ne in-memory events ani Redis pub/sub** — události musí dorazit
  všem instancím, in-memory emitter zná jen svou. Postgres už ve stacku je a
  trigger zachytí i změny mimo aplikaci. Redis až by NOTIFY přestal stačit.
- **pnpm supply chain** — `minimumReleaseAge: 10080` (jen ≥7 dní staré verze),
  build skripty závislostí blokované.

## CI/CD a deployment

- **`ci.yml`** (PR + master) — tři joby: `checks` (typecheck, lint, testy proti
  Postgres service kontejneru, build), `docker-build` (sestaví oba image bez
  pushnutí, ať se rozbitý Dockerfile pozná už na PR) a `audit`
  (`pnpm audit --prod --audit-level critical`).
- **`docker.yml`** (po merge do master) — build & push `ghcr.io/jaroslavsku/bw-task`
  a `bw-task-migrate` s tagy `latest` + SHA, poté trivy scan.
- **`terraform/`** — Hetzner VM (cx23, Ubuntu 24.04), firewall (SSH jen z mé IP,
  HTTP/HTTPS veřejné). Cloud-init dělá jen bootstrap: Docker a `.env` se secrety.
- **`deploy/`** — produkční stack jako běžné soubory (`docker-compose.prod.yml`
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

Po `tofu apply` je server jen připravený — aplikaci na něj dostane až
`.\scripts\deploy.ps1` (nakopíruje `deploy/`, stáhne image, restartuje stack,
ověří `/api/health`). Infrastruktura a aplikace jsou oddělené kroky.

TLS řeší Caddy s automatickým Let's Encrypt certifikátem, HTTP se přesměruje
na HTTPS.

## Bezpečnost Docker image

- multi-stage build, finální image obsahuje jen standalone výstup
- proces běží jako `USER 1000` (číselně — projde i `runAsNonRoot` v k8s),
  soubory vlastní root → aplikace nemůže přepsat vlastní kód
- žádné secrety v image, vše přes env
- trivy scan v CI (zatím report režim, viz HANDOVER)

## Zbývající práce

Viz [HANDOVER.md](HANDOVER.md).
