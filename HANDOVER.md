# HANDOVER — zbývající práce

Karty jsou seřazené podle priority a psané tak, aby je zvládl junior bez dalšího
kontextu. U každé je uvedeno, co už v projektu je a na co si dát pozor.

---

## [HOTOVO] HTTPS s vlastní doménou (Caddy)

Aplikace  na `https://taskmaster.sportagio.app` — Caddy jako reverse proxy
(image `caddy:2-alpine`, porty 80+443) s automatickým Let's Encrypt certifikátem

**Kontext pro navazující práci:** cloud-init běží jen při prvním bootu, takže
`user_data` je bootstrap, ne správa konfigurace. Caddy byl proto na běžící VM
nasazený ručně přes SSH (`/opt/taskmaster/docker-compose.yml` a `Caddyfile`),
zatímco `cloud-init.yaml.tftpl` v repu je připravený pro čisté nasazení. Ty dvě
verze se rozešly a na existujícím serveru se šablona z repa už neprojeví.

Aby z toho Terraform nechtěl server přetvořit (a smazat volume `db-data` se
všemi daty), má `hcloud_server` v `terraform/server.tf` `lifecycle` blok
s `ignore_changes = [user_data]` a `prevent_destroy = true`. Až budeš chtít
server legitimně zrušit, smaž `prevent_destroy` a teprve pak `tofu destroy`.

---

## [P2] Osekat cloud-init na bootstrap a oddělit data od serveru

**Kontext:** `cloud-init.yaml.tftpl` obsahuje celý aplikační stack — compose,
Caddyfile i secrety. Každá aplikační změna je tím formálně infrastrukturní.
Data Postgresu navíc leží v docker volume na disku serveru, takže zánik
serveru = ztráta dat.

**Úkol:** Osekej cloud-init na „nainstaluj Docker, stáhni compose, spusť";
compose i Caddyfile drž v repu a dostávej je na server přes `scripts/deploy.sh`.
Přidej `hcloud_volume` pro data Postgresu a `hcloud_floating_ip`, ať výměna
serveru neznamená ztrátu dat ani přepis DNS.

**Hotovo, když:** aplikační změna jde na server bez sáhnutí na Terraform
a přetvoření serveru nezpůsobí ztrátu dat.

**Odhad:** 4–6 h
**Pozor na:** přesun dat na `hcloud_volume` znamená odstávku — nejdřív
`pg_dump`, teprve pak přepínej.

---

## [P3] Ověřit SSE přes Caddy dlouhodobě

**Kontext:** Caddy streamované odpovědi ve výchozím stavu nebufferuje, takže
SSE přes proxy funguje. Ověřené je to ale jen krátkodobě.

**Úkol:** Nech dvě okna otevřená na doméně několik hodin a sleduj, jestli
realtime nepřestane chodit. Když ano, hledej idle timeouty v Caddy nebo
zkrať heartbeat (25 s v `app/api/todos/stream/route.ts`).

**Hotovo, když:** změna v jednom okně se po hodinách provozu pořád objeví
v druhém do sekundy.

**Odhad:** 1 h + čekání

---

## [P1] Rate limiting na auth endpointy

**Kontext:** `/api/auth/login` a `/api/auth/register` nejsou nijak omezené 

**Úkol:** Do obou handlerů přidej limit na IP (např. 10 pokusů za minutu).
Pro jednu instanci stačí in-memory mapa jinak Redis.

**Hotovo, když:** 11. pokus během minuty vrátí 429 s hlavičkou `Retry-After`,
test to pokrývá.

**Odhad:** 1 h
**Pozor na:** za reverse proxy čti IP z `X-Forwarded-For` (první hodnota),
jinak limitneš proxy místo útočníka.

---

## [P2] Zálohy databáze

**Kontext:** Postgres běží v kontejneru s volume `db-data` na jediné VM.
Když VM umře, data jsou pryč.

**Úkol:** Cron na VM: pg_dump, lépe mimo naše VM tedy třeba CloudFlare R2.

**Hotovo, když:** záloha vzniká denně, leží mimo VM a existuje ověřený postup
obnovy (dokumentovaný v README).

**Odhad:** 3 h

---

## [P2] Monitoring a alerting

**Kontext:** Existuje `/api/health` (ověřuje i spojení do DB) a strukturované
pino logy na stdout (`docker compose logs app`). Nikdo se ale nedozví, když
aplikace umře.

**Úkol:** Instalace .

**Hotovo, když:** výpadek aplikace nebo DB pošle notifikaci do 5 minut.

**Odhad:** 2 h (uptime check) / 1 den (Prometheus stack)

---

## [P2] Automatický deploy na VM po merge

**Kontext:** CI dnes buildí a pushne image do ghcr, ale na VM se nová verze
dostane ručně (`docker compose pull && up -d`).

**Úkol:** Přidej do `docker.yml` job, který po úspěšném push spustí přes SSH
(`appleboy/ssh-action`, klíč v GitHub Secrets) pull + up na VM. Alternativa
bez otevírání SSH pro CI: watchtower kontejner na VM, který každých pár minut
kontroluje nové tagy.

**Hotovo, když:** merge do master se do pár minut sám objeví na VM.

**Odhad:** 2–3 h
**Pozor na:** deploy job pouštěj až po úspěšném build & push jobu (`needs:`),
a používej SHA tag, ne `latest`, ať je jasné, co přesně běží.

---

## [P3] E2E testy (Playwright)

**Kontext:** Unit a integrační testy pokrývají schémata a SQL vrstvu (37 testů),
ale nikdo automaticky neklika UI. Kritické flow: registrace → přidání úkolu →
označení hotovo → odhlášení → přihlášení → data tam pořád jsou.

**Úkol:** Playwright s webServer konfigurací (spustí `pnpm dev` proti testovací
DB), 3–5 scénářů včetně realtime (dvě context pages, změna v jedné se objeví
v druhé). Zapoj do CI za stávající testy.

**Hotovo, když:** `pnpm test:e2e` projde lokálně i v CI.

**Odhad:** 1 den
**Pozor na:** SSE v testu chvíli trvá — použij `expect.poll`/`toPass`, ne pevné sleepy.

---

## [P3] Stránkování v UI

**Kontext:** API stránkování umí (`limit`/`offset`, default 100, max 200),
frontend zatím bere první stránku — pro osobní todo list to stačí.

**Úkol:** Přidej „Load more" tlačítko (offset += limit, append k seznamu),
nebo infinite scroll. Stats zůstávají globální (počítá je server zvlášť).

**Hotovo, když:** uživatel se 300 úkoly doskroluje ke všem.

**Odhad:** 3 h
**Pozor na:** SSE refetch teď stahuje jen první stránku — po refetchi je
potřeba buď zahodit načtené stránky, nebo refetchnout všechny do aktuálního offsetu.

---

## [P3] Vypnout trivy „report only" režim

**Kontext:** trivy v `docker.yml` má `exit-code: 0` — nálezy jen reportuje,
build neshazuje. Záměr: nejdřív posbírat baseline, pak zpřísnit.

**Úkol:** Po pár týdnech projdi nálezy, oprav/akceptuj (`.trivyignore`
s komentářem proč), přepni `exit-code: 1` pro CRITICAL.

**Hotovo, když:** nový CRITICAL CVE v base image zastaví pipeline.

**Odhad:** 2 h

---

## [P4] Migrace na Supabase (pokud by byla strategicky žádoucí)

**Kontext:** Schéma je čistý Postgres, takže přenos je přímočarý. Dnes je auth
vlastní (JWT cookie) a autorizace `where user_id` na serveru.

**Úkol:** Přenést schéma, zapnout RLS politiky (`user_id = auth.uid()`),
nahradit vlastní auth za Supabase Auth, SSE nahradit Supabase Realtime.

**Odhad:** 2–3 dny
**Pozor na:** RLS má smysl až ve chvíli, kdy klient mluví s DB přímo — do té
doby by jen duplikovala serverovou kontrolu.
