# Changelog

## 1.5.0 — 2026-11-27

- **Favorieten en "niet gebruiken"**: markeer oefeningen als favoriet (de ster in de bibliotheek) of zet ze op *Niet gebruiken* (in de uitleg van een oefening of vanuit je programma). De AI krijgt je favorieten gemarkeerd en zet ze in het schema waar ze passen. Uitgesloten oefeningen staan niet meer in de lijst voor de AI en worden vervangen als de AI ze toch kiest. Het regelgebaseerde programma kiest per bewegingspatroon eerst een favoriet, ook uit de import, en slaat uitgesloten oefeningen over.
- Een oefening die je uitsluit, verdwijnt meteen uit je huidige programma: de app wisselt hem voor het beste alternatief en houdt sets en herhalingen gelijk.
- **Oefeningenoverzicht**: filters *Favorieten* en *Niet gebruiken* met aantallen. Favorieten hebben een gele ster en staan bovenaan hun spiergroep. Uitgesloten oefeningen staan onderaan, doorgestreept en met een rood teken.
- **Wisselen**: zoeken in alle oefeningen die bij je apparatuur passen, niet alleen in vergelijkbare. Favorieten staan bovenaan, uitgesloten oefeningen worden niet aangeboden. Met het vinkje "nooit meer gebruiken" sluit je de oude oefening meteen uit.
- Migratie 4: tabel `exercise_preferences`. Je markeringen gaan mee in de export.

## 1.4.0 — 2026-11-27

- **Alle oefeningen uit free-exercise-db**: de bibliotheek heeft nu 886 oefeningen. Dat zijn de 67 vaste oefeningen plus de volledige lijst uit de fork [x-real-ip/free-exercise-db](https://github.com/x-real-ip/free-exercise-db), inclusief rekken, cardio, plyometrie, olympisch gewichtheffen en strongman. Namen en uitleg van de geïmporteerde oefeningen zijn Engels. Hun foto's komen uit de fork en worden na de eerste keer bewaard voor offline gebruik.
- **Meer keus bij wisselen en voor de AI**: ongeveer 375 krachtoefeningen uit de import kunnen in een programma. Bij het wisselen zie je de beste acht en kun je zoeken in de rest. De AI krijgt ze ook aangeboden, maar bouwt programma's vooral uit de vaste oefeningen. Het regelgebaseerde programma blijft bij de 67 vaste oefeningen.
- Bibliotheek: filters op soort oefening en "alleen oefeningen die in een programma kunnen"; per oefening het niveau. Nieuwe spiergroepen: onderrug, trapezius, onderarmen, adductoren, abductoren en nek.
- `npm run import:exercises [ref]` haalt de lijst opnieuw op uit de fork en zet hem vast op een commit (`server/data/free-exercise-db.json`).
- `/api/exercises` gaat met gzip over de lijn (ongeveer 170 kB in plaats van 1 MB).
- Een AI-programma kost door de langere oefeningenlijst iets meer: ongeveer 12.000 extra invoertokens bij een volledig uitgeruste gym, zo'n 2,5 dollarcent per programma met Sonnet 5.5.

## 1.3.0 — 2026-11-27

- **Nederlands**: de hele app is vertaald, inclusief de uitleg van de progressie-engine, startgewichten, regelgebaseerde programma's, meldingen en de feiten van de coach. Gewichten met een decimale komma (42,5 kg), herhalingen als 12/12/11. Door de AI geschreven tekst is standaard Nederlands.
- **Oefeningenbibliotheek in de app**: alle 67 oefeningen die in een programma kunnen komen, per spiergroep, met zoeken en een filter op je apparatuur.
- **Hoe doe je dit?**: per oefening Nederlandse stappen en twee voorbeeldfoto's (begin- en eindpositie, als korte animatie) uit free-exercise-db (publiek domein), offline beschikbaar. Te openen tijdens de training, vanuit het programma en vanuit de bibliotheek.
- **Programma: hoe het is opgebouwd**: uitleg in gewone taal van schema, oefeningkeuze, sets/herhalingen/rust bij je doel, startgewichten, progressie en deload, gemaakt uit dezelfde regels die het programma bouwen.
- **AI-instellingen in de app**: aanbieder, model, API-sleutel, denkniveau per onderdeel (standaard: coach laag, programma's middel) en een maandbudget, opgeslagen in de database. Omgevingsvariabelen zijn alleen nog de standaard. Met een knop test je de verbinding.
- **Verbruik**: elke AI-aanroep wordt bijgehouden (migratie 3) met tokens en geschatte kosten; per maand, per onderdeel, per dag en de laatste aanroepen. Bij het bereiken van het maandbudget stopt de AI.
- Claude wordt nu aangeroepen via de officiële Anthropic SDK, met een expliciet denkniveau en genoeg ruimte voor nadenken (coach 4.000, programma 16.000 tokens). Weigeringen en afgekapte antwoorden worden herkend; Sonnet 5.5 en Opus 5.5 vallen bij een weigering automatisch terug op een ander model.
- **Programma: vooruitkijken**: alle trainingen van het blok per week, met de deloadweek, de geplande gewichten en per oefening de volgende stap.

## 1.2.0 — 2026-11-27

Eerste release die via GitOps naar het cluster gaat.

- **Uitrol via `x-real-ip/gitops`**: `k8s/` is weg. De manifests (CloudNativePG-cluster, SealedSecrets, deployment met migrate-initContainer, HTTPRoute op `fitness.lan.stamx.nl`) staan in de gitops-repo; zie `deploy/README.md`.
- **CI**: typecheck, tests, PWA-build, migraties tegen Postgres 18 (twee keer, plus `/healthz`), image naar `ghcr.io/x-real-ip/overload`, en bij een `v*`-tag een dispatch naar de gitops-repo. Labeler, release-drafter, release-monitor en yamllint zoals in depart.
- **Health en migraties**: `GET /healthz` (`{"status":"ok","database":"ok"}`, 503 bij een databasefout). Migraties als los commando `npm run migrate` (idempotent, advisory lock); `MIGRATE_ON_START=false` slaat ze bij het opstarten over.
- **Supersets**: sessies van 45 minuten of korter krijgen paren van oefeningen die elkaar niet in de weg zitten. In de training ga je na een set direct naar de partner; de rusttimer loopt na de ronde. De AI mag supersets voorstellen, de app repareert ze waar nodig.
- **Offline**: niet-gesynchroniseerde sets staan nu in IndexedDB in plaats van localStorage. Een wachtrij uit 1.1 wordt automatisch overgezet.
- Een nieuw profiel begint met sessies van 30 minuten.
- Nieuwe namen voor omgevingsvariabelen, de oude blijven werken: `APP_URL` (was `PUBLIC_URL`), `OIDC_ISSUER_URL` (was `OIDC_ISSUER`). Nieuw: `LOG_LEVEL`, `MIGRATE_ON_START`.
- De image draait als uid/gid 3001.
- Docker Compose is weg: lokaal draai je tegen een eigen Postgres via `DATABASE_URL`. De oude endpoints `/api/health` en `/api/ready` zijn vervangen door `/healthz`.
- `CLAUDE.md` met de werkafspraken voor deze repo.

## 1.1.0 — 2026-10-30

- Database van SQLite naar PostgreSQL (`pg`), migraties met advisory lock, readiness-probe `/api/ready`.
- Kubernetes-manifesten (`k8s/`): Kustomize base + homelab-overlay met HTTPRoute (Gateway API), ExternalSecrets (Vault), NetworkPolicies, Postgres-StatefulSet en nachtelijke `pg_dump`-CronJob; ArgoCD-voorbeeld.
- Authenticatie via `AUTH_MODE`: `none`, `password`, `proxy` (Authentik forward-auth headers) en `oidc` (Authentik OAuth2/OpenID, code flow + PKCE, RP-initiated logout), met optionele allowlists op gebruiker/groep.
- Import accepteert exports uit 1.0 (SQLite) voor migratie.
- Docker Compose met Postgres-container; in-app SQLite-back-ups vervangen door database-back-ups buiten de app.

## 1.0.0 — 2026-10-30

Eerste MVP:

- Mobile-first PWA (React + Vite) met donker thema, installeerbaar, offline app-shell.
- Profiel met niveau, doel, trainingsdagen, sessieduur, apparatuur, gewichtsstappen en beperkingen.
- AI-gegenereerde programma's (Anthropic of OpenAI-compatibel) uit een vaste oefeningenbibliotheek, met validatie, reparatie en een regelgebaseerde fallback.
- Training loggen met één tik per set, vooringevuld gewicht, optionele RIR, rusttimer, auto-doorgaan en een offline wachtrij voor sets.
- Deterministische double-progression-engine; de AI bepaalt nooit gewichten.
- Deloadweek, stagnatiedetectie, dashboard met grafieken, records en sets per spiergroep.
- AI-coach met trainingscontext; programma aanpassen op basis van coachadvies.
- Export (JSON/CSV) en import.
