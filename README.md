# Overload

Persoonlijke, self-hosted fitnessapp: AI-gegenereerde trainingsprogramma's, sets loggen in één tik per set, en automatische progressive overload op basis van wat je daadwerkelijk hebt getraind. Mobile-first, donker thema, installeerbaar als PWA. Draait op Kubernetes met PostgreSQL, en Authentik is te koppelen via OIDC of forward-auth.

## Inhoud

- [Kubernetes](#kubernetes)
- [Authentik koppelen](#authentik-koppelen)
- [Docker Compose](#docker-compose)
- [Lokaal ontwikkelen](#lokaal-ontwikkelen)
- [Configuratie](#configuratie)
- [Back-up, herstel en migratie vanaf 1.0](#back-up-herstel-en-migratie-vanaf-10)
- [Hoe de progressie werkt](#hoe-de-progressie-werkt)
- [Architectuur](#architectuur)

## Kubernetes

De manifesten staan in `k8s/` als Kustomize:

```
k8s/
  base/                     namespace, ConfigMap, app-Deployment + Service,
                            Postgres-StatefulSet + Services, pg_dump-CronJob, NetworkPolicy voor Postgres
  overlays/homelab/         HTTPRoute (Gateway API), ExternalSecrets (Vault), NetworkPolicy voor de app,
                            ConfigMap-patch met jouw URL's en auth-instellingen
  argocd-application.yaml   voorbeeld-Application voor ArgoCD
  backup-browser.yaml       tijdelijke pod om dumps uit het backup-volume te kopiëren
```

Alle waarden die je moet aanpassen zijn gemarkeerd met `CHANGE-ME`.

### 1. Image bouwen en pushen

```bash
docker build -t ghcr.io/<jij>/overload:1.1.0 .
docker push ghcr.io/<jij>/overload:1.1.0
```

Zet dezelfde naam en tag in `k8s/overlays/homelab/kustomization.yaml` onder `images`.

### 2. Secrets

De app verwacht twee Secrets in namespace `overload`:

| Secret | Keys |
|---|---|
| `overload-db` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| `overload-secrets` | `SESSION_SECRET`, `AI_API_KEY`, `OIDC_CLIENT_SECRET` (mogen leeg zijn) |

De homelab-overlay maakt ze via External Secrets Operator uit Vault (KV v2, pad `homelab/overload`, `ClusterSecretStore` `vault-backend`; pas aan in `externalsecret.yaml`):

```bash
vault kv put homelab/overload \
  postgres_user=overload postgres_password="$(openssl rand -hex 24)" postgres_db=overload \
  session_secret="$(openssl rand -hex 32)" ai_api_key="sk-ant-..." oidc_client_secret=""
```

Zonder ESO haal je `externalsecret.yaml` uit de overlay en maak je ze direct:

```bash
kubectl create namespace overload
kubectl -n overload create secret generic overload-db \
  --from-literal=POSTGRES_USER=overload \
  --from-literal=POSTGRES_PASSWORD="$(openssl rand -hex 24)" \
  --from-literal=POSTGRES_DB=overload
kubectl -n overload create secret generic overload-secrets \
  --from-literal=SESSION_SECRET="$(openssl rand -hex 32)" \
  --from-literal=AI_API_KEY="sk-ant-..." \
  --from-literal=OIDC_CLIENT_SECRET=""
```

### 3. Uitrollen

```bash
kubectl apply -k k8s/overlays/homelab
# of via ArgoCD: pas repoURL aan in k8s/argocd-application.yaml en apply dat bestand
```

Wat je krijgt:

- **App**: stateless Deployment (alle state zit in Postgres), dus meer replicas kunnen. Hij draait als non-root met een read-only root filesystem; de namespace dwingt Pod Security `restricted` af. Een init-container wacht tot Postgres klaar is. Migraties draaien bij het opstarten, met een advisory lock zodat replicas niet tegelijk migreren. `/api/health` dient als liveness- en `/api/ready` als readiness-probe (die controleert de database).
- **Postgres**: StatefulSet `postgres:17-alpine` met een PVC van 5 Gi uit je default StorageClass. Alleen de app en de backup-job mogen erbij (NetworkPolicy).
- **Backups**: elke nacht om 03:17 (Europe/Amsterdam) een `pg_dump -Fc` naar PVC `overload-backups`. Die worden 14 dagen bewaard.
- **Toegang**: een HTTPRoute naar je Gateway (NGINX Gateway Fabric). TLS regel je op de Gateway-listener met cert-manager. Alleen de gateway-namespace mag de app bereiken.

> De HTTPRoute verwacht een bestaande Gateway met een HTTPS-listener. Gebruik je Ingress in plaats van Gateway API, vervang `httproute.yaml` dan door een Ingress naar Service `overload` poort 80.

## Authentik koppelen

Er zijn twee manieren. De app hoeft er niet voor aangepast te worden; het is alleen configuratie.

### Optie A: OIDC (aanbevolen)

De app doet zelf de OpenID Connect-login (authorization code + PKCE). Dit werkt met elke gateway en je hebt geen outpost nodig.

1. **Authentik → Applications → Providers → Create → OAuth2/OpenID Provider**
   - Client type: *Confidential*
   - Redirect URI (strict): `https://fitness.lan.stamx.nl/api/auth/oidc/callback`
   - Signing key: je standaard certificaat
   - Scopes: de standaard *openid*, *email* en *profile* (profile levert ook `groups`)
   - Laat *Include claims in id_token* aan staan
2. **Applications → Create**: naam *Overload*, slug `overload`, en koppel de provider. Wil je alleen jezelf toelaten, bind dan een groep of gebruiker aan de applicatie. Je kunt ook `ALLOWED_GROUPS` gebruiken (zie hieronder).
3. Zet het client secret in Vault (`oidc_client_secret`) of in Secret `overload-secrets`.
4. Pas `k8s/overlays/homelab/config-patch.yaml` aan:
   ```yaml
   AUTH_MODE: oidc
   PUBLIC_URL: "https://fitness.lan.stamx.nl"
   OIDC_ISSUER: "https://authentik.lan.stamx.nl/application/o/overload/"
   OIDC_CLIENT_ID: "<client id uit de provider>"
   ALLOWED_GROUPS: "fitness"   # optioneel
   ```
5. Sync of apply. Het inlogscherm toont nu *Sign in with Authentik*. Uitloggen beëindigt ook de Authentik-sessie (RP-initiated logout via het end-session endpoint).

Gebruikt Authentik een certificaat van een interne CA in plaats van Let's Encrypt, mount die CA dan in de pod en zet `NODE_EXTRA_CA_CERTS=/pad/naar/ca.crt`.

### Optie B: forward-auth / proxy-outpost

Een Authentik proxy-outpost staat vóór de app en geeft de gebruiker door in headers (`X-authentik-username`, `-email` en `-groups`). Zet `AUTH_MODE: proxy`. Uitloggen gaat naar `/outpost.goauthentik.io/sign_out`.

Belangrijk: in deze modus vertrouwt de app de headers blind. Pas daarom `networkpolicy-app.yaml` aan, zodat alléén de outpost (en niet de gateway) de app kan bereiken. Anders kan iemand de outpost omzeilen en zelf headers sturen. Gateway API heeft geen standaard forward-auth; met NGINX Gateway Fabric is optie A daarom de eenvoudigste route.

### Tussentijds

Tot Authentik klaar is: `AUTH_MODE: none` (alleen bereikbaar via LAN/VPN) of `AUTH_MODE: password` met `APP_PASSWORD` in `overload-secrets`.

## Docker Compose

Voor een enkele host:

```bash
cp .env.example .env          # zet minimaal POSTGRES_PASSWORD
docker compose up -d --build
```

De app draait dan op `http://<host>:8080`, en de Postgres-data staat in `./data/postgres`. Een backup maak je met `docker compose exec db pg_dump -U overload -Fc overload > overload.dump`.

## Lokaal ontwikkelen

Vereist Node.js 22.18 of nieuwer (de server draait TypeScript direct, zonder buildstap) en een Postgres:

```bash
npm install && npm --prefix web install
export DATABASE_URL=postgres://overload:change-me@localhost:5432/overload
npm run dev                  # API op :8080
npm --prefix web run dev     # frontend op :5173, proxied /api naar :8080
npm test                     # start per testbestand een tijdelijke embedded Postgres
npm run typecheck
npm run seed:demo            # vult een LEGE database met ~5 weken demotrainingen
```

`npm test` heeft geen draaiende database nodig. Wil je een bestaande test-database gebruiken, zet dan `TEST_DATABASE_URL`. Let op: het `public`-schema daarvan wordt gewist.

## Configuratie

Alle instellingen zijn omgevingsvariabelen. Voor Compose staan ze in `.env.example`, voor Kubernetes in `k8s/base/configmap.yaml` plus de Secrets.

| Variabele | Betekenis |
|---|---|
| `DATABASE_URL` of `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` | Postgres-verbinding |
| `DB_SSL`, `DB_SSL_VERIFY`, `DB_POOL_SIZE` | TLS naar Postgres, connection pool |
| `PUBLIC_URL` | Publieke URL, nodig voor OIDC-redirects |
| `AUTH_MODE` | `none`, `password`, `proxy` of `oidc` |
| `SESSION_SECRET`, `SESSION_DAYS` | Ondertekening en duur van sessies. Zonder secret maakt de app er een aan in de database (gedeeld door alle replicas) |
| `APP_PASSWORD` | Wachtwoord voor `password`-modus |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_SCOPES`, `OIDC_PROVIDER_NAME` | OIDC-modus |
| `PROXY_USER_HEADER`, `PROXY_EMAIL_HEADER`, `PROXY_GROUPS_HEADER`, `PROXY_LOGOUT_URL` | Proxy-modus (standaard de Authentik-headers) |
| `ALLOWED_USERS`, `ALLOWED_GROUPS` | Optionele allowlists (komma-gescheiden) voor `oidc` en `proxy` |
| `AI_PROVIDER` | `anthropic` (Claude) of `openai` (elke OpenAI-compatibele API, ook Ollama/LM Studio/LiteLLM) |
| `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` | AI-sleutel (blijft op de server), model (standaard `claude-sonnet-5-5` resp. `gpt-4o-mini`) en endpoint |
| `AI_LANGUAGE` | Taal van door AI geschreven programmateksten. De coach antwoordt in de taal van je vraag |

Zonder AI-sleutel werkt alles behalve de AI-functies: programma's worden dan regelgebaseerd opgebouwd en de coach toont berekende feiten uit je trainingshistorie.

## Back-up, herstel en migratie vanaf 1.0

- **Database-backups**: de CronJob in Kubernetes, of `pg_dump` bij Compose.
  ```bash
  # direct een backup maken
  kubectl -n overload create job --from=cronjob/overload-postgres-backup backup-now
  # een dump uit het backup-volume halen
  kubectl apply -f k8s/backup-browser.yaml
  kubectl -n overload exec backup-browser -- ls -lh /backups
  kubectl -n overload cp backup-browser:/backups/overload-YYYYMMDD-HHMM.dump ./restore.dump
  kubectl delete -f k8s/backup-browser.yaml
  # terugzetten (schaal de app eerst naar 0)
  kubectl -n overload scale deploy/overload --replicas=0
  kubectl -n overload exec -i overload-postgres-0 -- sh -c 'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < restore.dump
  kubectl -n overload scale deploy/overload --replicas=1
  ```
- **Exports in de app** (Profile → Data): JSON met alles, en CSV met alle sets.
- **Migratie vanaf versie 1.0 (SQLite)**: exporteer in de oude versie via *Export everything* en importeer dat JSON-bestand in de nieuwe versie via *Import from export file*. Booleans en JSON-velden worden daarbij automatisch omgezet, en de id-reeksen lopen daarna gewoon door.

## Hoe de progressie werkt

Gewichten worden **nooit door de AI bepaald**. Na elke training berekent een deterministische engine (`server/services/progression.ts`) per oefening het advies, uitsluitend op basis van gelogde sets (double progression):

- **Verhogen**: alle voorgeschreven sets op of boven de bovengrens van de rep range, zonder set tot falen (RIR 0). Dat geeft één gewichtsstap omhoog, of twee als alle sets de bovengrens met 2+ reps overschreden met ruime reserve. Daarna bouw je weer op vanaf de ondergrens.
- **Behouden**: nog niet alle sets aan de bovenkant, een set tot falen, of niet alle sets gedaan. Het doel per set wordt dan +1 rep.
- **Verlagen**: twee sessies op rij onder de minimum reps op hetzelfde gewicht, of duidelijk te zwaar (gemiddeld 2+ reps onder het minimum). Het gewicht gaat dan ongeveer 10% omlaag, afgerond op je gewichtsstappen.
- **Lichaamsgewicht**: progressie via reps. Bij de bovengrens adviseert de app een zwaardere variant of extra belasting.
- **Deloadweek**: minder sets op ±90% van het werkgewicht. Deze sessies veranderen je doelen niet.

Dezelfde oefening met dezelfde rep range op verschillende trainingsdagen deelt één progressie. Gewichtsstappen per type apparatuur zijn in te stellen in je profiel. Bij een nieuw programma nemen oefeningen met historie hun verdiende gewicht mee; bij een andere rep range wordt dat herberekend via een geschat 1RM. Startgewichten van de AI worden begrensd rond een schatting op basis van lichaamsgewicht en niveau.

## Architectuur

```
server/                   Fastify API (TypeScript, Node 22+)
  config.ts               omgevingsvariabelen
  db.ts                   PostgreSQL-pool, migraties met advisory lock, query-helpers
  auth.ts                 none / password / proxy / oidc, ondertekende sessiecookie, allowlists
  routes/                 core (auth, profiel, health), programs, workouts, insights, data
  services/
    progression.ts        progressive-overload-engine
    programGenerator.ts   AI-programma's: prompt, validatie, reparatie, retry, fallback
    programTemplates.ts   regelgebaseerde programma's
    programs.ts           opslag, doelen per oefening, oefening wisselen
    workouts.ts           training starten, sets opslaan (idempotent), afronden en advies
    stats.ts              statistieken, stagnatiedetectie, historie voor AI
    coach.ts              AI-coach met trainingscontext
    dataExport.ts         JSON/CSV-export en -import (ook v1-formaat)
  tests/                  node:test met embedded Postgres en een lokale OIDC-provider
shared/types.ts           gedeelde types server/frontend
web/                      React + Vite PWA
k8s/                      Kustomize base + homelab-overlay + ArgoCD-voorbeeld
```

Sets worden op de telefoon eerst lokaal opgeslagen en daarna naar de server gestuurd. Valt de verbinding weg, dan blijven ze in een wachtrij staan en worden ze automatisch nagestuurd. Een training afronden wacht tot alles gesynchroniseerd is.
