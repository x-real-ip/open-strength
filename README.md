# Overload

A personal, self-hosted strength training app: AI-designed training programs, logging with one tap per set, and automatic progressive overload based on what you actually trained. Mobile-first, dark theme, installable as a PWA. Runs in the homelab cluster with PostgreSQL (CloudNativePG) and is deployed through [`x-real-ip/gitops`](https://github.com/x-real-ip/gitops).

## Contents

- [What the app does](#what-the-app-does)
- [Deployment](#deployment)
- [Connecting Authentik](#connecting-authentik)
- [Local development](#local-development)
- [Configuration](#configuration)
- [Backup, export and migration](#backup-export-and-migration)
- [How progression works](#how-progression-works)
- [Architecture](#architecture)

## What the app does

- **English or Dutch**: English by default; pick Dutch under Profile → Language. Everything follows that choice: screens, the advice and explanations from the progression engine, rule-based programs, errors and the language the AI writes in. Text the app stores (engine advice, names of rule-based programs) keeps both languages, so switching also applies to what is already there. Weights use a decimal point in English (42.5 kg) and a comma in Dutch (42,5 kg).
- **Profile**: level, goal (muscle growth by default), training days, session length (30 minutes by default), equipment, limitations and weight steps per type (barbell, dumbbell, machine, cable, kettlebell).
- **Exercise library**: the app knows 886 exercises. The core is a curated list of 67 exercises with an English and Dutch name and how-to, primary and secondary muscle group, movement pattern, equipment and load type. On top of that the whole [free-exercise-db](https://github.com/x-real-ip/free-exercise-db) is included (own fork, public domain) with its English names and instructions: also stretching, cardio, plyometrics, Olympic weightlifting and strongman. You find them all under **Exercises** in the bottom menu, with search and filters on muscle group, type and your equipment. Each exercise shows which days of your program it is on and how often you have done it (and when last). *In my program* shows your exercises per training day, *Done* everything you have trained, most done first. An exercise's page also shows its sets and reps in the program and your heaviest set.
- **Which exercises can be in a program**: the rule-based program picks from the 67 core exercises and your favourites. When you swap an exercise, and in AI programs, about 375 strength exercises from free-exercise-db can be used too. For those the app derives the movement pattern, load type and a careful starting weight from name, equipment and muscles. Explosive lifts (cleans, snatches, jumps) and variants with chains or reverse bands stay out of programs. Stretching, cardio and the rest are for viewing only.
- **Your choice: favourites and "never use"**: tap the star in the library to make an exercise a favourite. On an exercise's page, or from your program, choose *Never use*. Favourites go into your next schedule where they fit, with the AI and with the rule-based program, also when they come from the import. An exercise set to "never use" never goes into a schedule again and is no longer offered when swapping. If it is in your program now, the app replaces it right away with the best alternative. The *Favourites* and *Never use* filters show your choices at a glance. When swapping you search all exercises and can set the old exercise to "never use again" in one go.
- **How do you do this?**: every exercise has steps and two photos (start and end position) that alternate like a short animation. The photos of the 67 core exercises ship with the app and always work offline. Those of the other exercises load from the fork on GitHub and are kept after the first view, so they work offline from then on.
- **Programs**: designed by the AI (for example full body A/B with supersets for 30-minute sessions), validated and repaired where needed. If the AI answer is unusable or there is no AI, a rule-based program is made. Programs have weeks and a deload week. The program page shows **how the program was built** (schedule, exercise choice, sets and reps for your goal, starting weights, progression, deload) and lets you **look ahead** through the whole block, with the planned weights and the next step per workout.
- **Supersets**: for sessions of 45 minutes or less the app pairs exercises that do not get in each other's way (push with pull, legs with upper body). You do a set of one, straight away a set of the other, and then rest. They are labelled A1/A2, B1/B2 and so on.
- **Logging a workout**: the Today screen shows the next training day. Weight and reps are prefilled, so it is one tap per set. RIR is optional. The rest timer starts by itself, with a beep and vibration. After the last set (or the round of a superset) you move on to the next exercise. Each exercise shows what you did last time.
- **Offline first**: sets are stored on the phone first (IndexedDB) and synced as soon as there is a connection.
- **Afterwards**: a summary with the advice for the next session per exercise, explained in plain language.
- **AI coach**: a chat that gets your real training data. The coach may explain weights but never sets them. One button turns the coach's advice into an adjusted program.
- **Statistics**: estimated 1RM per exercise, volume per week, sets per muscle group per week (recent versus the period before), personal records and stall detection.
- **Data**: export as JSON (everything) and CSV (sets), import of a JSON export.

AI is optional: without a key everything works, just without AI.

- **AI settings** (Profile → AI settings and usage): provider, model, API key, how much the model thinks (separately for the coach and for programs) and a monthly budget. These settings live in the database and take precedence over the environment variables, which are only the defaults. The key is never sent to the browser. *Test connection* checks key and model.
- **Usage**: every AI call is recorded with tokens and estimated cost (from the price list). You see this month, per feature, per day and the latest calls. When the monthly budget is used up, the AI stops until next month and the app falls back to rule-based programs.

## Deployment

The manifests live in [`x-real-ip/gitops`](https://github.com/x-real-ip/gitops) under `manifests/overload/`, not in this repo. That is also where the database (CloudNativePG), the migrate init container and the SealedSecrets are.

In short: a release tag `v1.2.3` builds image `ghcr.io/x-real-ip/overload:1.2.3`, the workflow sends a dispatch to the gitops repo, which pins the tag in the overlay, and Argo CD rolls it out.

## Connecting Authentik

There are two ways. The app needs no changes for either; it is only configuration.

### Option A: OIDC (recommended)

The app does the OpenID Connect login itself (authorization code + PKCE, through `openid-client`). This works with any gateway and needs no outpost.

1. **Authentik → Applications → Providers → Create → OAuth2/OpenID Provider**
   - Client type: *Confidential*
   - Redirect URI (strict): `https://fitness.lan.stamx.nl/api/auth/oidc/callback`
   - Signing key: your default certificate
   - Scopes: the default *openid*, *email* and *profile* (profile also provides `groups`)
   - Leave *Include claims in id_token* on
2. **Applications → Create**: name *Overload*, slug `overload`, and attach the provider. To only let yourself in, bind a group or user to the application, or use `ALLOWED_USERS`/`ALLOWED_GROUPS`.
3. In the gitops repo (`manifests/overload/base/`) set:
   - in `configmap.yaml`: `AUTH_MODE: "oidc"` and `OIDC_CLIENT_ID: "<client id from the provider>"`. `OIDC_ISSUER_URL` is already `https://auth.lan.stamx.nl/application/o/overload/`.
   - in `sealedsecret.yaml`: the sealed `OIDC_CLIENT_SECRET` (scope `cluster-wide`, controller `sealed-secrets` in `kube-system`).
4. Merge the PR. The login screen now shows *Sign in with Authentik*. Signing out also ends the Authentik session (RP-initiated logout).

`auth.lan.stamx.nl` has a certificate from the internal Stamx CA. The deployment mounts that CA (ConfigMap `stamx-ca`) and sets `NODE_EXTRA_CA_CERTS`, so the app trusts the certificate.

### Option B: forward auth / proxy outpost

An Authentik proxy outpost sits in front of the app and passes the user on in headers (`X-authentik-username`, `-email` and `-groups`). Set `AUTH_MODE: proxy`. Signing out goes to `/outpost.goauthentik.io/sign_out`.

Note: in this mode the app trusts the headers blindly. That is only safe if nothing but the outpost can reach the app. Gateway API has no standard forward auth; with NGINX Gateway Fabric option A is therefore the simplest route.

### Until Authentik is ready

`AUTH_MODE: password` with `APP_PASSWORD` in `overload-secrets`. That is also how the cluster configuration starts.

## Local development

Requires Node.js 22.18 or newer (the server runs TypeScript directly, without a build step) and a Postgres of your choice:

```bash
npm install && npm --prefix web install
export DATABASE_URL=postgres://overload:change-me@localhost:5432/overload
npm run migrate              # run migrations on their own (idempotent)
npm run dev                  # API on :8080 (also migrates on start)
npm --prefix web run dev     # frontend on :5173, proxies /api to :8080
npm test                     # starts a temporary embedded Postgres per test file
npm run typecheck            # server and PWA
npm run build                # builds the PWA into web/dist
npm run seed:demo            # fills an EMPTY database with ~5 weeks of demo workouts
npm run import:exercises     # re-import free-exercise-db from the fork (optionally a ref)
```

`npm test` needs no running database. To use an existing test database, set `TEST_DATABASE_URL`. Note: its `public` schema is wiped.

Agreements for whoever (or whatever) works on the code are in [`CLAUDE.md`](CLAUDE.md).

## Configuration

All settings are environment variables. For local use they are in `.env.example`; in the cluster they come from ConfigMap `overload-config` and Secret `overload-secrets`.

| Variable | Meaning |
|---|---|
| `PORT`, `LOG_LEVEL` | Port (8080 by default) and log level (`info`, `debug`, …) |
| `APP_URL` | Public URL, needed for OIDC redirects (the old name `PUBLIC_URL` also works) |
| `DATABASE_URL` or `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` | Postgres connection |
| `DB_SSL`, `DB_SSL_VERIFY`, `DB_POOL_SIZE` | TLS to Postgres, connection pool |
| `MIGRATE_ON_START` | Run migrations on start (`true` by default; `false` in the cluster, where the init container does it) |
| `AUTH_MODE` | `none`, `password`, `proxy` or `oidc` |
| `SESSION_SECRET`, `SESSION_DAYS` | Signing and lifetime of sessions. Without a secret the app creates one in the database |
| `APP_PASSWORD` | Password for `password` mode |
| `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_SCOPES`, `OIDC_PROVIDER_NAME` | OIDC mode (the old name `OIDC_ISSUER` also works) |
| `NODE_EXTRA_CA_CERTS` | Extra CA for outbound TLS, such as the Stamx CA for Authentik |
| `PROXY_USER_HEADER`, `PROXY_EMAIL_HEADER`, `PROXY_GROUPS_HEADER`, `PROXY_LOGOUT_URL` | Proxy mode (the Authentik headers by default) |
| `ALLOWED_USERS`, `ALLOWED_GROUPS` | Optional allowlists (comma-separated) for `oidc` and `proxy`. `ALLOWED_USERS` matches the username or email address |
| `AI_PROVIDER` | `anthropic` (Claude, the default) or `openai` (any OpenAI-compatible API, including Ollama, LM Studio or LiteLLM). Like the other `AI_*` variables only a default: the AI settings in the app take precedence |
| `ANTHROPIC_API_KEY` or `AI_API_KEY` | AI key; stays on the server |
| `AI_MODEL`, `AI_BASE_URL` | Model (`claude-sonnet-5-5` by default, or `gpt-4o-mini` for `openai`) and endpoint |

The language the AI writes in follows the language in the profile; `AI_LANGUAGE` is no longer used.

Without an AI key everything except the AI features works: programs are then rule-based and the coach shows facts calculated from your training history.

## Backup, export and migration

- **Database**: in the cluster Postgres runs as CloudNativePG cluster `overload-db` on a TrueNAS volume. A manual dump: `kubectl -n tools exec overload-db-1 -- pg_dump -Fc -U postgres overload > overload.dump`.
- **Exports in the app** (Profile → Data): JSON with everything (including your favourites and "never use" marks), and CSV with all sets. You import a JSON export with *Import from an export file*. That replaces all data.
- **Migrating from 1.0 (SQLite)**: export in the old version with *Export everything* and import that file. Booleans and JSON fields are converted automatically, and the id sequences simply carry on.

## How progression works

Weights are **never decided by the AI**. After every workout a deterministic engine (`server/services/progression.ts`) works out the advice per exercise, based only on logged sets (double progression):

- **Increase**: all prescribed sets at or above the top of the rep range, without a set to failure (RIR 0). That is one weight step up, or two if all sets went past the top by 2+ reps with plenty in reserve. You then build up again from the bottom of the range.
- **Hold**: not all sets at the top yet, a set to failure, or not all sets done. The target per set becomes +1 rep. Example: 12/11/10 at 40 kg with 8–12 reps gives "stay at 40 kg and aim for 12/12/11".
- **Decrease**: two sessions in a row below the minimum at the same weight, or right away if it is clearly too heavy (on average 2+ reps below the minimum). The weight then drops by about 10%, rounded to your weight steps.
- **Bodyweight**: progression through reps. At the top of the range the app suggests a harder variation or added load.
- **Deload week**: fewer sets at about 90% of the working weight. These sessions do not change your targets.
- **Stalling**: no progress in estimated 1RM (or reps) over three sessions is flagged on the Today screen and passed to the AI for a new program.

The same exercise with the same rep range on different training days shares one progression. In a new program, exercises with history carry over the weight you built up; with a different rep range it is recalculated through an estimated 1RM. AI starting weights are capped around an estimate based on body weight and level.

## Architecture

```
server/                   Fastify API (TypeScript, Node 22+), also serves the built PWA
  index.ts                starts the server
  migrate.ts              standalone migration command (npm run migrate, init container)
  config.ts               environment variables
  db.ts                   PostgreSQL pool, migrations with an advisory lock, query helpers
  auth.ts                 none / password / proxy / oidc, signed session cookie, allowlists
  i18n.ts                 English/Dutch server text, stored text in both languages
  routes/                 core (health, auth, profile), programs, workouts, insights, data, settings
  services/
    progression.ts        progressive overload engine
    programGenerator.ts   AI programs: prompt, validation, repair, retry, fallback
    programTemplates.ts   rule-based programs and superset pairing
    programExplain.ts     "how it was built", from the same rules
    programs.ts           storage, targets per exercise, swapping exercises, normalizing supersets
    exercises.ts          the library: 67 core exercises plus the import, and what programs may use
    exerciseGuide.ts      Dutch names and how-to of the core exercises (English: exerciseGuideEn.ts)
    freeExerciseDb.ts     reads free-exercise-db and classifies strength exercises by pattern and load
    exercisePrefs.ts      favourites and "never use"; swapping excluded exercises out of the program
    workouts.ts           starting a workout, saving sets (idempotent), finishing and advice
    stats.ts              statistics, stall detection, history for the AI
    coach.ts              AI coach with training context
    dataExport.ts         JSON/CSV export and import (also the v1 format)
  data/free-exercise-db.json  the imported list, pinned to one commit of the fork
  scripts/importExercises.ts  npm run import:exercises [ref]: fetch the list again from the fork
  tests/                  node:test with embedded Postgres and a local OIDC provider
shared/types.ts           types shared by server and frontend
web/                      React + Vite PWA
  src/i18n.ts             UI language: t('English', 'Nederlands') in place
  src/offlineStore.ts     IndexedDB queue for sets not yet on the server
```

Finishing a workout waits until all sets are synced. `GET /healthz` returns `{"status":"ok","database":"ok"}`, or status 503 when the database does not answer.
