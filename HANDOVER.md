# HANDOVER — zbývající práce

Karty jsou seřazené podle priority a psané tak, aby je zvládl junior bez dalšího
kontextu. U každé je uvedeno, co už v projektu je a na co si dát pozor.

---

## [P1] HTTPS s vlastní doménou (Caddy)

**Kontext:** Aplikace na VM běží na portu 80 bez TLS. Session cookie má
`secure: true` v produkci (`lib/auth/session.ts`) — prohlížeč `Secure` cookie
přes čisté HTTP nikdy nepošle zpátky. Bez tohohle nasazení nejde přihlásit:
server cookie nastaví, ale klient ji zahodí a hned tě to vrátí na `/login`.
Ne „nemusí fungovat", ale nefunguje jistě. Compose stack je v `/opt/taskmaster`,
definovaný v `terraform/cloud-init.yaml.tftpl`.

**Úkol:**
1. Zaregistruj/nasměruj doménu (A záznam na IP z `tofu output server_ip`).
2. Do compose přidej službu `caddy` (image `caddy:2-alpine`, porty 80+443,
   volume na certifikáty) s Caddyfile: `tvoje-domena.cz { reverse_proxy app:3000 }`.
3. U služby `app` zruš mapování portu 80 (zůstane jen vnitřní síť).
4. Otevři port 443 v `terraform/firewall.tf`.

**Hotovo, když:** aplikace jede na https://tvoje-domena.cz, certifikát platný
(Caddy si ho vyřídí sám přes Let's Encrypt), http přesměrovává na https.

**Odhad:** 2–3 h
**Pozor na:** SSE přes reverse proxy — Caddy streamuje odpovědi automaticky,
ale kdyby realtime přestal chodit, hledej buffering na proxy.

---

## [P1] Rate limiting na auth endpointy

**Kontext:** `/api/auth/login` a `/api/auth/register` nejsou nijak omezené —
lze zkoušet hesla neomezenou rychlostí. bcrypt lámání brzdí (~100 ms/pokus),
ale online bruteforce je pořád možný.

**Úkol:** Do obou handlerů přidej limit na IP (např. 10 pokusů za minutu).
Pro jednu instanci stačí in-memory mapa `ip → časy pokusů` s úklidem starých
záznamů; pro víc instancí je potřeba sdílené úložiště (Redis, nebo tabulka
v Postgresu s `created_at` indexem).

**Hotovo, když:** 11. pokus během minuty vrátí 429 s hlavičkou `Retry-After`,
test to pokrývá.

**Odhad:** 3–4 h
**Pozor na:** za reverse proxy čti IP z `X-Forwarded-For` (první hodnota),
jinak limitneš proxy místo útočníka.

---

## [P2] Zálohy databáze

**Kontext:** Postgres běží v kontejneru s volume `db-data` na jediné VM.
Když VM umře, data jsou pryč.

**Úkol:** Cron na VM: `docker compose exec -T db pg_dump -U postgres taskmaster
| gzip > /backup/taskmaster-$(date +%F).sql.gz`, rotace 14 dní, upload mimo VM
(Hetzner Storage Box nebo S3). Jednou za čas restore test.

**Hotovo, když:** záloha vzniká denně, leží mimo VM a existuje ověřený postup
obnovy (dokumentovaný v README).

**Odhad:** 3 h
**Pozor na:** zálohu, kterou nikdo nikdy nezkusil obnovit, nelze počítat za zálohu.

---

## [P2] Monitoring a alerting

**Kontext:** Existuje `/api/health` (ověřuje i spojení do DB) a strukturované
pino logy na stdout (`docker compose logs app`). Nikdo se ale nedozví, když
aplikace spadne.

**Úkol:** Minimálně: externí uptime check na `/api/health` (UptimeRobot apod.)
s notifikací. Lépe: `docker stats` → node_exporter + Prometheus + Grafana,
alert na paměť > 80 % a error rate v lozích.

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

**Kontext:** Unit a integrační testy pokrývají schémata a SQL vrstvu (33 testů),
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
