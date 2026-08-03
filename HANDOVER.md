# HANDOVER: zbývající práce

Karty jsou seřazené podle priority.

---

## [P2] Oddělit data od životnosti serveru

**Kontext:** Data Postgresu leží v docker volume na disku serveru, takže zánik
serveru = ztráta dat. Proti nechtěnému smazání dnes chrání jen `prevent_destroy`
v `terraform/server.tf`, což je pojistka, ne řešení. Stejně tak je IP vázaná
na server, takže výměna serveru znamená přepsat DNS záznam.

**Úkol:** Přidej `hcloud_volume` pro data Postgresu a `hcloud_floating_ip`.

**Hotovo, když:** přetvoření serveru nezpůsobí ztrátu dat ani nevyžaduje sáhnout
na DNS.

**Odhad:** 3-4 h
**Pozor na:** přesun dat na `hcloud_volume` znamená odstávku, nejdřív
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

## [P2] Bezpečnostní hlavičky

**Kontext:** Odpovědi neposílají žádné bezpečnostní hlavičky, Next.js je sám
nepřidává. Aplikaci tak jde vložit do iframu na cizí web (clickjacking).
Ostatní chybějící hlavičky jsou obrana do hloubky. Ověřeno útoky, že SQL
injection, IDOR ani XSS zneužít nejdou, tohle je jediná otevřená mezera.

**Úkol:** Ve dvou krocích podle rizika změny:

1. Bezpečné hned, přes `headers()` v `next.config.mjs`: `X-Frame-Options: DENY`,
   `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
2. Zvlášť a s testováním: `Content-Security-Policy` a `Strict-Transport-Security`
   (HSTS dává smysl řešit v Caddy, ne v aplikaci).

**Hotovo, když:** securityheaders.com dá doméně aspoň B a aplikace se nedá
vložit do iframu.

**Odhad:** 15 min na první krok, 3-4 h na CSP

**Pozor na:** CSP nezaváděj naslepo. Next.js používá inline skripty, takže bez
nastavení nonce si snadno rozbiješ funkční aplikaci. Nasazuj nejdřív v režimu
`Content-Security-Policy-Report-Only` a teprve po vyčištění hlášení přepni na
ostrou.

---

## [P1] Index pro fulltextové hledání (pg_trgm)

**Kontext:** Hledání v `lib/repositories/todos.ts` skládá `text ilike '%vyraz%'`.
Vzor začínající zástupným znakem žádný btree index využít nedokáže, takže
Postgres projde všechny řádky uživatele. Je to nejdražší dotaz v aplikaci.

**Úkol:** Migrací zapni `pg_trgm` a přidej GIN index nad `text`
(`using gin (text gin_trgm_ops)`).

**Hotovo, když:** `explain (analyze)` na dotazu se `search` ukazuje místo
sekvenčního průchodu bitmap index scan.

**Odhad:** 1-2 h
**Pozor na:** na pár stovkách řádků zvolí plánovač seq scan i tak, měř na
realistickém objemu. `create extension` chce superuživatele.

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

**Odhad:** 2-3 h

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
frontend zatím bere první stránku, pro osobní todo list to stačí.

**Úkol:** Přidej „Load more" tlačítko,
nebo infinite scroll.

**Hotovo, když:** uživatel se 300 úkoly doskroluje ke všem.

**Odhad:** 3 h

---

## [P3] Řazení úkolů

**Kontext:** Řadí se napevno `order by created_at desc, id desc`
(`lib/repositories/todos.ts`), uživatel to nemůže změnit.

**Úkol:** Přidej `sort` do `todoFiltersSchema` (termín, priorita, název, vytvoření)
a select do FilterBaru. Volitelně vlastní pořadí přes sloupec `position`
a drag and drop.

**Hotovo, když:** uživatel si seznam seřadí podle termínu a volba mu vydrží
i po refetchi.

**Odhad:** 4 h (vlastní pořadí s drag and drop spíš 1 den)

**Pozor na:** priorita je text s hodnotami `low`/`medium`/`high`, takže abecedně
by vyšlo high, low, medium. Potřebuje `case` v `order by` nebo vlastní enum typ.
Index `todos_user_created_idx` pokrývá jen řazení podle `created_at`, na řazení
podle `due_date` je potřeba další index, jinak to u velkých seznamů bude sekvenční
scan a sort.

---

## [P2] Refresh token

**Kontext:** Jeden JWT s platností 7 dní (`lib/auth/session.ts`). Odhlášení smaže
cookie, ale token platí dál, takže ukradený token nejde zneplatnit.

**Úkol:** Krátký access token (15 min) plus refresh token uložený v DB, s rotací
při každém použití. Odhlášení pak maže řádek v DB, ne jen cookie.

**Hotovo, když:** ukradený token přestane fungovat do 15 minut a jde vynutit
odhlášení ze všech zařízení.

**Odhad:** 1 den

---

## [P3] Škálování a Kubernetes

**Kontext:** Aplikace je bezstavová a `pg_notify` chodí napříč instancemi, takže
víc replik je možných už dnes. Běží ale jedna instance na jedné VM.

**Úkol:** Deployment se dvěma a více replikami za load balancerem, Postgres ven
z compose do spravované služby. Image je na to připravený (`USER 1000` číselně,
`/api/health` pro liveness a readiness).

**Hotovo, když:** výpadek jedné repliky neshodí aplikaci.

**Odhad:** 2-3 dny

---

## [P4] Alternativa: Supabase

**Kontext:** Schéma je čistý Postgres, přechod by byl přímočarý.

**Úkol:** Přenést schéma, zapnout RLS (`user_id = auth.uid()`), nahradit vlastní
JWT auth za Supabase Auth a SSE za Supabase Realtime.

**Hotovo, když:** aplikace běží bez vlastní DB a auth vrstvy.

**Odhad:** 2-3 dny
**Pozor na:** RLS dává smysl až když klient mluví s DB přímo, do té doby by jen
zdvojovala serverovou kontrolu.

---
