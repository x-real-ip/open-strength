# Changelog

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
