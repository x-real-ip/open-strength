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

- **Nederlands**: de hele app, inclusief de uitleg bij elk advies. Gewichten met een komma (42,5 kg).
- **Profiel**: niveau, doel (standaard spiermassa), trainingsdagen, sessieduur (standaard 30 minuten), apparatuur, beperkingen en gewichtsstappen per type (barbell, dumbbell, machine, cable, kettlebell).
- **Oefeningenbibliotheek**: de app kent 886 oefeningen. De kern is een gecureerde lijst van 67 oefeningen met Nederlandse naam en uitleg, primaire en secundaire spiergroep, bewegingspatroon, apparatuur en type belasting. Daarnaast staat de volledige [free-exercise-db](https://github.com/x-real-ip/free-exercise-db) erin (eigen fork, publiek domein), met Engelse namen en uitleg: ook rekken, cardio, plyometrie, olympisch gewichtheffen en strongman. Je ziet ze allemaal via Programma → Alle oefeningen, met zoeken en filters op spiergroep, soort en je apparatuur.
- **Welke oefeningen in een programma kunnen**: het regelgebaseerde programma kiest uit de 67 vaste oefeningen en je favorieten. Bij het wisselen van een oefening en in AI-programma's kunnen ook zo'n 375 krachtoefeningen uit free-exercise-db. Voor die oefeningen leidt de app bewegingspatroon, type belasting en een voorzichtig startgewicht af uit naam, apparatuur en spieren. Explosieve lifts (cleans, snatches, jumps) en varianten met kettingen of reverse bands blijven buiten programma's. Rekken, cardio en de rest zijn alleen om te bekijken.
- **Jouw keuze: favorieten en "niet gebruiken"**: in de bibliotheek maak je met de ster een oefening favoriet. In de uitleg van een oefening, of vanuit je programma, kies je *Niet gebruiken*. Favorieten komen in je volgende schema waar ze passen, bij de AI en bij het regelgebaseerde programma, ook als ze uit de import komen. Een oefening op "niet gebruiken" komt nooit meer in een schema en wordt niet meer aangeboden bij wisselen. Staat hij nu in je programma, dan vervangt de app hem meteen door het beste alternatief. Met de filters *Favorieten* en *Niet gebruiken* zie je je keuze in één oogopslag. Bij het wisselen zoek je in alle oefeningen en kun je de oude oefening meteen op "nooit meer gebruiken" zetten.
- **Hoe doe je dit?**: elke oefening heeft stappen en twee foto's (begin- en eindpositie) die als korte animatie afwisselen. De foto's van de 67 vaste oefeningen zitten in de app zelf en werken altijd offline. Die van de overige oefeningen laadt de app uit de fork op GitHub en bewaart ze na de eerste keer, zodat ze daarna ook offline werken.
- **Programma's**: door de AI ontworpen (bijvoorbeeld full body A/B met supersets voor sessies van 30 minuten), gevalideerd en waar nodig gerepareerd. Is het AI-antwoord onbruikbaar of is er geen AI, dan komt er een regelgebaseerd programma. Programma's hebben weken en een deloadweek. Op de programmapagina zie je **hoe het programma is opgebouwd** (schema, keuze van oefeningen, sets en herhalingen bij je doel, startgewichten, progressie, deload) en kun je **vooruitkijken** door het hele blok, met per training de geplande gewichten en de volgende stap.
- **Supersets**: bij sessies van 45 minuten of korter koppelt de app oefeningen die elkaar niet in de weg zitten (duwen met trekken, benen met bovenlichaam). Je doet een set van de ene, direct een set van de andere, en rust dan.
- **Training loggen**: het Vandaag-scherm toont de volgende trainingsdag. Gewicht en herhalingen staan vooringevuld, dus één tik per set. RIR is optioneel. De rusttimer start vanzelf, met piep en trilling. Na de laatste set (of de ronde van een superset) ga je door naar de volgende oefening. Per oefening zie je wat je vorige keer deed.
- **Offline-first**: sets worden eerst op de telefoon opgeslagen (IndexedDB) en gesynchroniseerd zodra er verbinding is.
- **Na afloop**: een samenvatting met per oefening het advies voor de volgende sessie, met uitleg in gewone taal.
- **AI-coach**: chat die je echte trainingsdata meekrijgt. De coach mag gewichten uitleggen maar bepaalt ze niet. Een advies van de coach zet je met één knop om in een aangepast programma.
- **Statistieken**: geschatte 1RM per oefening, volume per week, sets per spiergroep per week (recent tegenover de periode daarvoor), persoonlijke records en stagnatiedetectie.
- **Data**: export als JSON (alles) en CSV (sets), import van een JSON-export.

AI is optioneel: zonder sleutel werkt alles, alleen zonder AI.

- **AI-instellingen** (Profiel → AI-instellingen en verbruik): aanbieder, model, API-sleutel, hoeveel het model nadenkt (apart voor de coach en voor programma's) en een maandbudget. Deze instellingen staan in de database en gaan voor de omgevingsvariabelen; die zijn alleen nog de standaard. De sleutel gaat nooit naar de browser. Met *Verbinding testen* controleer je sleutel en model.
- **Verbruik**: elke AI-aanroep wordt bijgehouden met tokens en geschatte kosten (op basis van de prijslijst). Je ziet deze maand, per onderdeel, per dag en de laatste aanroepen. Is het maandbudget op, dan stopt de AI tot de volgende maand en valt de app terug op regelgebaseerde programma's.

## Uitrollen

De manifests staan in [`x-real-ip/gitops`](https://github.com/x-real-ip/gitops) onder `manifests/overload/`, niet in deze repo. Daar staan ook de database (CloudNativePG), de migrate-initContainer en de SealedSecrets.

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
   - in `sealedsecret.yaml`: het verzegelde `OIDC_CLIENT_SECRET` (scope `cluster-wide`, controller `sealed-secrets` in `kube-system`).
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
| `AI_PROVIDER` | `anthropic` (Claude, standaard) of `openai` (elke OpenAI-compatibele API, ook Ollama, LM Studio of LiteLLM). Net als de andere `AI_*`-variabelen alleen de standaard: de AI-instellingen in de app gaan voor |
| `ANTHROPIC_API_KEY` of `AI_API_KEY` | AI-sleutel; blijft op de server |
| `AI_MODEL`, `AI_BASE_URL` | Model (standaard `claude-sonnet-5-5`, of `gpt-4o-mini` voor `openai`) en endpoint |
| `AI_LANGUAGE` | Taal van door de AI geschreven programmateksten. De coach antwoordt in de taal van je vraag |

Zonder AI-sleutel werkt alles behalve de AI-functies: programma's worden dan regelgebaseerd opgebouwd en de coach toont berekende feiten uit je trainingshistorie.

## Back-up, export en migratie

- **Database**: in het cluster draait Postgres als CloudNativePG-cluster `overload-db` op een TrueNAS-volume. Een handmatige dump: `kubectl -n tools exec overload-db-1 -- pg_dump -Fc -U postgres overload > overload.dump`.
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
    exercises.ts          de bibliotheek: 67 vaste oefeningen plus de import, en wat in een programma mag
    freeExerciseDb.ts     free-exercise-db inlezen en krachtoefeningen indelen naar patroon en belasting
    exercisePrefs.ts      favorieten en "niet gebruiken"; uitgesloten oefeningen uit het programma wisselen
  data/free-exercise-db.json  de geïmporteerde lijst, vastgezet op één commit van de fork
  scripts/importExercises.ts  npm run import:exercises [ref]: de lijst opnieuw ophalen uit de fork
    workouts.ts           training starten, sets opslaan (idempotent), afronden en advies
    stats.ts              statistieken, stagnatiedetectie, historie voor AI
    coach.ts              AI-coach met trainingscontext
    dataExport.ts         JSON/CSV-export en -import (ook v1-formaat)
  tests/                  node:test met embedded Postgres en een lokale OIDC-provider
shared/types.ts           gedeelde types server/frontend
web/                      React + Vite PWA
  src/offlineStore.ts     IndexedDB-wachtrij voor sets die nog niet op de server staan
```

Een training afronden wacht tot alle sets gesynchroniseerd zijn. `GET /healthz` geeft `{"status":"ok","database":"ok"}`, of status 503 als de database niet antwoordt.
