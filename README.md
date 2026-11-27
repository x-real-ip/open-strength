# Overload

Persoonlijke, self-hosted krachttrainingsapp: AI-gegenereerde trainingsprogramma's, sets loggen met één tik per set, en automatische progressive overload op basis van wat je echt getraind hebt. Mobile-first, donker thema, installeerbaar als PWA. Draait in het homelab-cluster met PostgreSQL (CloudNativePG) en wordt uitgerold via [`x-real-ip/gitops`](https://github.com/x-real-ip/gitops).

## Inhoud

- [Wat de app doet](#wat-de-app-doet)
- [Uitrollen](#uitrollen)
- [Authentik koppelen](#authentik-koppelen)
- [Lokaal ontwikkelen](#lokaal-ontwikkelen)
- [Configuratie](#configuratie)
- [Back-up, export en migratie](#back-up-export-en-migratie)
- [Hoe de progressie werkt](#hoe-de-progressie-werkt)
- [Architectuur](#architectuur)

## Wat de app doet

- **Profiel**: niveau, doel (standaard spiermassa), trainingsdagen, sessieduur (standaard 30 minuten), apparatuur, beperkingen en gewichtsstappen per type (barbell, dumbbell, machine, cable, kettlebell).
- **Oefeningenbibliotheek**: een vaste, gecureerde lijst met primaire/secundaire spiergroep, bewegingspatroon, apparatuur en type belasting. Programma's gebruiken alleen oefeningen uit deze lijst, zodat historie en statistieken kloppen.
- **Programma's**: door de AI ontworpen (bijvoorbeeld full body A/B met supersets voor sessies van 30 minuten), gevalideerd en waar nodig gerepareerd. Is het AI-antwoord onbruikbaar of is er geen AI, dan komt er een regelgebaseerd programma. Programma's hebben weken en een deloadweek.
- **Supersets**: bij sessies van 45 minuten of korter koppelt de app oefeningen die elkaar niet in de weg zitten (duwen met trekken, benen met bovenlichaam). Je doet een set van de ene, direct een set van de andere, en rust dan.
- **Training loggen**: het Vandaag-scherm toont de volgende trainingsdag. Gewicht en herhalingen staan vooringevuld, dus één tik per set. RIR is optioneel. De rusttimer start vanzelf, met piep en trilling. Na de laatste set (of de ronde van een superset) ga je door naar de volgende oefening. Per oefening zie je wat je vorige keer deed.
- **Offline-first**: sets worden eerst op de telefoon opgeslagen (IndexedDB) en gesynchroniseerd zodra er verbinding is.
- **Na afloop**: een samenvatting met per oefening het advies voor de volgende sessie, met uitleg in gewone taal.
- **AI-coach**: chat die je echte trainingsdata meekrijgt. De coach mag gewichten uitleggen maar bepaalt ze niet. Een advies van de coach zet je met één knop om in een aangepast programma.
- **Statistieken**: geschatte 1RM per oefening, volume per week, sets per spiergroep per week (recent tegenover de periode daarvoor), persoonlijke records en stagnatiedetectie.
- **Data**: export als JSON (alles) en CSV (sets), import van een JSON-export.

AI is optioneel: zonder sleutel werkt alles, alleen zonder AI.

## Uitrollen

De manifests staan in [`x-real-ip/gitops`](https://github.com/x-real-ip/gitops) onder `manifests/overload/`, niet in deze repo. Hoe dat in elkaar zit (database, migraties, secrets, een release uitrollen) staat in [`deploy/README.md`](deploy/README.md).

In het kort: een release-tag `v1.2.3` bouwt image `ghcr.io/x-real-ip/overload:1.2.3`, de workflow stuurt een dispatch naar de gitops-repo, die zet de tag in de overlay, en Argo CD rolt uit.

## Authentik koppelen

Er zijn twee manieren. De app hoeft er niet voor aangepast te worden; het is alleen configuratie.

### Optie A: OIDC (aanbevolen)

De app doet zelf de OpenID Connect-login (authorization code + PKCE, via `openid-client`). Dit werkt met elke gateway en er is geen outpost nodig.

1. **Authentik → Applications → Providers → Create → OAuth2/OpenID Provider**
   - Client type: *Confidential*
   - Redirect URI (strict): `https://fitness.lan.stamx.nl/api/auth/oidc/callback`
   - Signing key: je standaardcertificaat
   - Scopes: de standaard *openid*, *email* en *profile* (profile levert ook `groups`)
   - Laat *Include claims in id_token* aan staan
2. **Applications → Create**: naam *Overload*, slug `overload`, en koppel de provider. Wil je alleen jezelf toelaten, bind dan een groep of gebruiker aan de applicatie, of gebruik `ALLOWED_USERS`/`ALLOWED_GROUPS`.
3. Zet in de gitops-repo (`manifests/overload/base/`):
   - in `configmap.yaml`: `AUTH_MODE: "oidc"` en `OIDC_CLIENT_ID: "<client id uit de provider>"`. `OIDC_ISSUER_URL` staat al op `https://auth.lan.stamx.nl/application/o/overload/`.
   - in `sealedsecret.yaml`: het verzegelde `OIDC_CLIENT_SECRET` (zie [`deploy/README.md`](deploy/README.md#secrets)).
4. Merge de PR. Het inlogscherm toont nu *Sign in with Authentik*. Uitloggen beëindigt ook de Authentik-sessie (RP-initiated logout).

`auth.lan.stamx.nl` heeft een certificaat van de interne Stamx CA. De deployment mount die CA (ConfigMap `stamx-ca`) en zet `NODE_EXTRA_CA_CERTS`, zodat de app het certificaat vertrouwt.

### Optie B: forward-auth / proxy-outpost

Een Authentik proxy-outpost staat vóór de app en geeft de gebruiker door in headers (`X-authentik-username`, `-email` en `-groups`). Zet `AUTH_MODE: proxy`. Uitloggen gaat naar `/outpost.goauthentik.io/sign_out`.

Let op: in deze modus vertrouwt de app de headers blind. Dat is alleen veilig als niets anders dan de outpost de app kan bereiken. Gateway API heeft geen standaard forward-auth; met NGINX Gateway Fabric is optie A daarom de eenvoudigste route.

### Tot Authentik klaar is

`AUTH_MODE: password` met `APP_PASSWORD` in `overload-secrets`. Zo start de clusterconfiguratie ook.

## Lokaal ontwikkelen

Vereist Node.js 22.18 of nieuwer (de server draait TypeScript direct, zonder buildstap) en een Postgres naar keuze:

```bash
npm install && npm --prefix web install
export DATABASE_URL=postgres://overload:change-me@localhost:5432/overload
npm run migrate              # migraties los draaien (idempotent)
npm run dev                  # API op :8080 (migreert ook zelf bij het opstarten)
npm --prefix web run dev     # frontend op :5173, stuurt /api door naar :8080
npm test                     # start per testbestand een tijdelijke embedded Postgres
npm run typecheck            # server en PWA
npm run build                # bouwt de PWA naar web/dist
npm run seed:demo            # vult een LEGE database met ~5 weken demotrainingen
```

`npm test` heeft geen draaiende database nodig. Wil je een bestaande testdatabase gebruiken, zet dan `TEST_DATABASE_URL`. Let op: het `public`-schema daarvan wordt gewist.

Afspraken voor wie (of wat) aan de code werkt staan in [`CLAUDE.md`](CLAUDE.md).

## Configuratie

Alle instellingen zijn omgevingsvariabelen. Voor lokaal staan ze in `.env.example`; in het cluster komen ze uit ConfigMap `overload-config` en Secret `overload-secrets`.

| Variabele | Betekenis |
|---|---|
| `PORT`, `LOG_LEVEL` | Poort (standaard 8080) en logniveau (`info`, `debug`, …) |
| `APP_URL` | Publieke URL, nodig voor OIDC-redirects (oude naam `PUBLIC_URL` werkt ook) |
| `DATABASE_URL` of `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` | Postgres-verbinding |
| `DB_SSL`, `DB_SSL_VERIFY`, `DB_POOL_SIZE` | TLS naar Postgres, connection pool |
| `MIGRATE_ON_START` | Migraties bij het opstarten (standaard `true`; in het cluster `false`, daar doet de initContainer het) |
| `AUTH_MODE` | `none`, `password`, `proxy` of `oidc` |
| `SESSION_SECRET`, `SESSION_DAYS` | Ondertekening en duur van sessies. Zonder secret maakt de app er een aan in de database |
| `APP_PASSWORD` | Wachtwoord voor `password`-modus |
| `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_SCOPES`, `OIDC_PROVIDER_NAME` | OIDC-modus (oude naam `OIDC_ISSUER` werkt ook) |
| `NODE_EXTRA_CA_CERTS` | Extra CA voor uitgaande TLS, zoals de Stamx CA voor Authentik |
| `PROXY_USER_HEADER`, `PROXY_EMAIL_HEADER`, `PROXY_GROUPS_HEADER`, `PROXY_LOGOUT_URL` | Proxy-modus (standaard de Authentik-headers) |
| `ALLOWED_USERS`, `ALLOWED_GROUPS` | Optionele allowlists (kommagescheiden) voor `oidc` en `proxy`. `ALLOWED_USERS` matcht op gebruikersnaam of e-mailadres |
| `AI_PROVIDER` | `anthropic` (Claude, standaard) of `openai` (elke OpenAI-compatibele API, ook Ollama, LM Studio of LiteLLM) |
| `ANTHROPIC_API_KEY` of `AI_API_KEY` | AI-sleutel; blijft op de server |
| `AI_MODEL`, `AI_BASE_URL` | Model (standaard `claude-sonnet-5-5`, of `gpt-4o-mini` voor `openai`) en endpoint |
| `AI_LANGUAGE` | Taal van door de AI geschreven programmateksten. De coach antwoordt in de taal van je vraag |

Zonder AI-sleutel werkt alles behalve de AI-functies: programma's worden dan regelgebaseerd opgebouwd en de coach toont berekende feiten uit je trainingshistorie.

## Back-up, export en migratie

- **Database**: in het cluster draait Postgres als CloudNativePG-cluster `overload-db` op een TrueNAS-volume; zie [`deploy/README.md`](deploy/README.md) voor een handmatige dump.
- **Exports in de app** (Profile → Data): JSON met alles, en CSV met alle sets. Een JSON-export importeer je via *Import from export file*. Dat vervangt alle data.
- **Migratie vanaf 1.0 (SQLite)**: exporteer in de oude versie via *Export everything* en importeer dat bestand. Booleans en JSON-velden worden automatisch omgezet, en de id-reeksen lopen daarna gewoon door.

## Hoe de progressie werkt

Gewichten worden **nooit door de AI bepaald**. Na elke training berekent een deterministische engine (`server/services/progression.ts`) per oefening het advies, uitsluitend op basis van gelogde sets (double progression):

- **Verhogen**: alle voorgeschreven sets op of boven de bovengrens van de rep range, zonder set tot falen (RIR 0). Dat geeft één gewichtsstap omhoog, of twee als alle sets de bovengrens met 2+ reps overschreden met ruime reserve. Daarna bouw je weer op vanaf de ondergrens.
- **Behouden**: nog niet alle sets aan de bovenkant, een set tot falen, of niet alle sets gedaan. Het doel per set wordt dan +1 rep. Voorbeeld: 12/11/10 op 40 kg bij 8–12 reps geeft "blijf op 40 kg, mik op 12/12/11".
- **Verlagen**: twee sessies op rij onder het minimum op hetzelfde gewicht, of direct als het duidelijk te zwaar is (gemiddeld 2+ reps onder het minimum). Het gewicht gaat dan ongeveer 10% omlaag, afgerond op je gewichtsstappen.
- **Lichaamsgewicht**: progressie via reps. Bij de bovengrens adviseert de app een zwaardere variant of extra belasting.
- **Deloadweek**: minder sets op ±90% van het werkgewicht. Deze sessies veranderen je doelen niet.
- **Stagnatie**: geen vooruitgang in geschatte 1RM (of reps) over drie sessies wordt gemeld op het Vandaag-scherm en meegegeven aan de AI bij een nieuw programma.

Dezelfde oefening met dezelfde rep range op verschillende trainingsdagen deelt één progressie. Bij een nieuw programma nemen oefeningen met historie hun opgebouwde gewicht mee; bij een andere rep range wordt dat herberekend via een geschatte 1RM. Startgewichten van de AI worden begrensd rond een schatting op basis van lichaamsgewicht en niveau.

## Architectuur

```
server/                   Fastify API (TypeScript, Node 22+), serveert ook de gebouwde PWA
  index.ts                start de server
  migrate.ts              los migratiecommando (npm run migrate, initContainer)
  config.ts               omgevingsvariabelen
  db.ts                   PostgreSQL-pool, migraties met advisory lock, query-helpers
  auth.ts                 none / password / proxy / oidc, ondertekende sessiecookie, allowlists
  routes/                 core (health, auth, profiel), programs, workouts, insights, data
  services/
    progression.ts        progressive-overload-engine
    programGenerator.ts   AI-programma's: prompt, validatie, reparatie, retry, fallback
    programTemplates.ts   regelgebaseerde programma's en superset-koppeling
    programs.ts           opslag, doelen per oefening, oefening wisselen, supersets normaliseren
    workouts.ts           training starten, sets opslaan (idempotent), afronden en advies
    stats.ts              statistieken, stagnatiedetectie, historie voor AI
    coach.ts              AI-coach met trainingscontext
    dataExport.ts         JSON/CSV-export en -import (ook v1-formaat)
  tests/                  node:test met embedded Postgres en een lokale OIDC-provider
shared/types.ts           gedeelde types server/frontend
web/                      React + Vite PWA
  src/offlineStore.ts     IndexedDB-wachtrij voor sets die nog niet op de server staan
deploy/README.md          hoe de app in het cluster draait
```

Een training afronden wacht tot alle sets gesynchroniseerd zijn. `GET /healthz` geeft `{"status":"ok","database":"ok"}`, of status 503 als de database niet antwoordt.
