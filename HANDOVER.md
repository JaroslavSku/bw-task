# HANDOVER — zbývající práce

Karty jsou seřazené podle priority a psané tak, aby je zvládl junior bez dalšího
kontextu. U každé je uvedeno, co už v projektu je a na co si dát pozor.

---

## [HOTOVO] HTTPS s vlastní doménou (Caddy)

Aplikace na `https://taskmaster.sportagio.app` — Caddy jako reverse proxy
(image `caddy:2-alpine`, porty 80+443) s automatickým Let's Encrypt certifikátem

**Kontext pro navazující práci:** cloud-init běží jen při prvním bootu, takže
`user_data` je bootstrap, ne správa konfigurace. Caddy byl proto na běžící VM
nasazený ručně přes SSH

Aby z toho Terraform nechtěl server přetvořit (a smazat volume `db-data` se
všemi daty), má `hcloud_server` v `terraform/server.tf` `lifecycle` blok
s `ignore_changes = [user_data]`

---

## [HOTOVO] Osekání cloud-initu na bootstrap

Produkční stack je v `deploy/` jako běžné soubory (`docker-compose.prod.yml`,
`Caddyfile`), na server je kopíruje `scripts/deploy.ps1`. Cloud-init dělá jen
„nainstaluj Docker a zapiš `.env`". Odpadlo tím vnořování compose jako řetězce
do YAMLu do Terraform šablony (a s ním `$${VAR}` escapování) a produkční compose
jde nově validovat přes `docker compose config`.

Doména se do Caddyfile dostává přes `{$DOMAIN}` z `.env`, takže v repu není
napevno.

---

## [P2] Oddělit data od životnosti serveru

**Kontext:** Data Postgresu leží v docker volume na disku serveru, takže zánik
serveru = ztráta dat. Proti nechtěnému smazání dnes chrání jen `prevent_destroy`
v `terraform/server.tf` — což je pojistka, ne řešení. Stejně tak je IP vázaná
na server, takže výměna serveru znamená přepsat DNS záznam.

**Úkol:** Přidej `hcloud_volume` pro data Postgresu a `hcloud_floating_ip`.

**Hotovo, když:** přetvoření serveru nezpůsobí ztrátu dat ani nevyžaduje sáhnout
na DNS.

**Odhad:** 3–4 h
**Pozor na:** přesun dat na `hcloud_volume` znamená odstávku — nejdřív
`pg_dump`, teprve pak přepínej. A `prevent_destroy` v `server.tf` musíš dočasně
odstranit, jinak Terraform odmítne cokoli, co server nahrazuje.

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

**Úkol:** Instalace Grafana a Prometheus.

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

---

## [P3] E2E testy (Playwright)

**Kontext:** Kritické flow: registrace → přidání úkolu →
označení hotovo → odhlášení → přihlášení → data tam pořád jsou.

**Úkol:** Playwright s webServer konfigurací zapoj do CI za stávající testy.

**Hotovo, když:** `pnpm test:e2e` projde lokálně i v CI.

**Odhad:** 1 den

---

## [P3] Stránkování v UI

**Kontext:** API stránkování umí (`limit`/`offset`, default 100, max 200),
frontend zatím bere první stránku — pro osobní todo list to stačí.

**Úkol:** Přidej „Load more" tlačítko,
nebo infinite scroll.

**Hotovo, když:** uživatel se 300 úkoly doskroluje ke všem.

**Odhad:** 3 h

---
