# Changelog

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
