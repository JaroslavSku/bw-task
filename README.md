# TaskMaster

Todo aplikace (Next.js 16 + PostgreSQL) dotažená z rozpracovaného stavu do produkčního.

## Jak spustit

### Docker Compose (doporučeno)

```bash
cp .env.example .env        # doplň POSTGRES_PASSWORD a JWT_SECRET
docker compose up --build
```

Aplikace běží na http://localhost:3000. Migrace proběhnou automaticky v samostatném
kontejneru před startem aplikace.

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

### Příkazy

| Příkaz | Co dělá |
|---|---|
| `pnpm dev` | dev server (Turbopack) |
| `pnpm build` / `pnpm start` | produkční build / server |
| `pnpm test` | vitest (potřebuje DB `taskmaster_test`) |
| `pnpm typecheck` / `pnpm lint` | tsc / eslint |
| `pnpm migrate` | db-migrate up |

## Co jsem našel a opravil

Původní kód obsahoval nastražené chyby. Nejdůležitější nálezy, ověřené měřením:

1. **Memory leak v `trackRequest()`** — každý požadavek uložil do modulové `Map`
   ~4 MB (serializovaný `process.env`, stack trace a 2 MB padding) a nikdy nemazal.
   Naměřeno: 91 MB → 1549 MB po 349 požadavcích; při 50 souběžných spojeních server
   spadl po ~1000 požadavcích (23k chybových odpovědí z 24k). Funkce nic užitečného
   nedělala — odstraněna, logování nahrazeno pinem.
2. **Únik tajemství** — `trackRequest` ukládal do paměti kompletní `process.env`
   včetně případných DB hesel a klíčů. Bezpečnostní, ne výkonnostní problém.
3. **Umělé zpoždění 100 ms** v GET handleru — odstraněno.
4. **„Databáze" bylo pole v paměti procesu** — restart = ztráta dat, druhá instance =
   jiná data. Nahrazeno PostgreSQL (bez toho nejde splnit škálování na víc instancí).
5. **Žádná validace vstupů** — `POST {}` vytvořil todo bez textu, smazání
   neexistujícího id vracelo `200 success`. Teď: Zod validace, správné stavové kódy
   (400/401/404/409), pokryto testy.
6. **Frontend bez ošetření chyb** — fetch bez catch, optimistické updaty bez
   rollbacku, request na každou klávesu hledání, race condition mezi odpověďmi.
   Teď: debounce 300 ms, AbortController, rollback + chybová hláška, error stav s retry.
7. Drobnější: duplicitní `layout.js`, typy definované dvakrát, `strict: false`,
   `id: Date.now()` (kolize), statistiky ve 4 průchodech, externí Google Fonts.

## Výsledky měření (autocannon, produkční build)

| Metrika | Před | Po |
|---|---|---|
| GET /api/todos, 5 spojení — medián latence | 114 ms | **12 ms** |
| GET /api/todos, 5 spojení — propustnost | 43 req/s | **354 req/s** |
| 50 spojení, 15 s | **pád serveru** (~23k chyb) | **0 chyb**, 386 req/s |
| Paměť pod zátěží | +4,2 MB/request, trvale | stabilní ~250 MB |

## Architektura

```
app/api/**/route.ts     HTTP vrstva: parsování, validace, stavové kódy
lib/schemas/*.ts        Zod schémata = jediný zdroj typů (z.infer)
lib/repositories/*.ts   SQL dotazy (pg, parametrizované)
lib/auth/*.ts           bcrypt hesla, JWT (jose), httpOnly cookie
lib/realtime/*.ts       Postgres LISTEN klient pro SSE
migrations/             db-migrate (čisté SQL v migrations/sqls)
```

- **Autentizace:** registrace/login, bcrypt (12 rund), JWT v httpOnly cookie
  (`sameSite: lax`, `secure` v produkci), middleware chrání stránky i API,
  každý SQL dotaz filtruje `user_id`.
- **Realtime:** DB trigger → `pg_notify` → jeden LISTEN klient na proces → SSE
  stream per uživatel → klient refetchne. Funguje napříč instancemi aplikace,
  protože společným bodem je Postgres.
- **Škálování:** aplikace nedrží stav v paměti → lze pustit N instancí za load
  balancer nad jednou DB. Index kopíruje hlavní dotaz, stránkování limit/offset,
  stats jedním dotazem, connection pool (max 10/instance).

## Rozhodnutí a kompromisy

- **Next.js Route Handlers, ne NestJS** — backend už existoval; zadání říká dostat
  aplikaci do produkčního stavu, ne přepsat framework. Vrstvy (routes → repositories
  → schémata) ale odpovídají tomu, co znáte z Nestu.
- **Čistý `pg` + SQL, ne ORM** — celá datová vrstva je pět dotazů; SQL je tu
  čitelnější a rychlejší na obhajobu než modely ORM. Migrace řeší zavedený
  db-migrate.
- **Ne Supabase** — deployment na VM má být soběstačný. Migrace by byla přímočará
  (čistý Postgres), přibyla by RLS vrstva a Supabase Auth.
- **Ne RLS** — klient nemá přímý přístup k DB; `where user_id = $1` skládané
  serverem je vynucená hranice. RLS by vyžadovalo propagovat identitu do DB session
  a hlídat reset v poolu — přidaná složitost bez přidané bezpečnosti v tomto modelu.
- **Ne Redis/cache** — per-user data měněná každou akcí; cache by netrefovala
  a invalidace je riziko úniku mezi uživateli. Správný nástroj: indexy + stránkování.
- **SSE, ne WebSocket** — tok notifikací je jednosměrný (zápisy jdou běžným
  POST/PATCH), takže obousměrný kanál není potřeba. SSE je obyčejné HTTP: projde
  proxy, autentizuje se stejnou cookie a prohlížeč má vestavěný reconnect.
  WebSocket by navíc v Next.js Route Handlers nativně nešel — vyžadoval by custom
  server nebo samostatný ws proces, tedy další infrastrukturu za nulový přínos.
- **`pg_notify`, ne in-memory events nebo Redis pub/sub** — události musí dorazit
  všem instancím aplikace, in-memory emitter zná jen svou instanci. Postgres už
  ve stacku je a LISTEN/NOTIFY tuhle práci odvede bez další služby; DB trigger
  navíc zachytí i změny provedené mimo aplikaci. Redis pub/sub by byl správný
  krok, až by NOTIFY přestal stačit (velké payloady, tisíce zpráv/s).
- **pnpm supply chain** — `minimumReleaseAge: 10080` (instalují se jen ≥7 dní staré
  verze), build skripty závislostí blokované (`sharp` ověřen jako nepotřebný —
  `next/image` se nepoužívá).

## CI/CD a deployment

- **`.github/workflows/ci.yml`** — na PR a master: typecheck, lint, testy proti
  Postgres service kontejneru, build, `pnpm audit`.
- **`.github/workflows/docker.yml`** — po merge do master: build & push
  `ghcr.io/jaroslavsku/bw-task` (app) a `bw-task-migrate` (migrace) s tagy
  `latest` + SHA, poté trivy scan.
- **`terraform/`** — Hetzner VM (cx23, Ubuntu 24.04) s firewallem (SSH jen z mé IP,
  HTTP veřejné). Cloud-init nainstaluje Docker a spustí compose stack z ghcr image.

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # doplnit hodnoty
tofu init && tofu apply
```

Deployment nové verze na VM: `docker compose pull && docker compose up -d`
v `/opt/taskmaster` (kandidát na automatizaci, viz HANDOVER).

## Bezpečnost Docker image

- multi-stage build, finální image jen se standalone výstupem
- proces běží jako `USER 1000` (číselně — ověřitelné i pro případný
  `runAsNonRoot` v k8s), soubory vlastní root → aplikace nemůže přepsat vlastní kód
- žádné secrety v image, vše přes env
- trivy scan v CI (report režim)

## Zbývající práce

Viz [HANDOVER.md](HANDOVER.md).
