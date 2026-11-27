# Changelog

New entries go under *Unreleased*; the version is chosen when the release is published.

## Unreleased

- Dependabot: weekly update PRs for npm packages (server and web) and GitHub Actions.
- **Desktop browsers**: from 900 px wide the bottom menu becomes a sidebar with the logo and version, the content column is wider (760 px), and sheets such as *Swap exercise* open as centred dialogs. Example photos are capped at 360 px high.
- **Rows of chips** (filters in the library, coach suggestions, the exercise strip in a workout) wrap onto more lines when you use a mouse or trackpad, instead of being cut off; a mouse cannot swipe a hidden scrollbar. On phones they still scroll sideways, now with a faded edge that shows there is more.

## 1.8.0 — 2026-11-27

- **A block instead of weeks**: a program is now a number of rounds through its training days, counted in workouts. How often you train no longer matters: once a week or four times, the next workout is always the next day in the rotation. The Today screen shows "Workout 7 of 18" with a bar of the whole block (deload workouts tinted), and "in this block" and "to go". Look ahead lists the coming workouts, with the deload ones marked; workouts already done are summarised in one line.
- The deload is the last round of the block (for intermediate and advanced lifters), shown as workout numbers ("deload from workout 16").
- The profile asks for the number of **training days in the rotation** instead of training days per week. The AI is told that frequency varies, so each round through the days must cover every major muscle group, with volume guidance per round instead of per week.
- **Version visible**: the app version is shown next to the logo on the Today screen (and still under Profile).
- Migration 5 renames `programs.weeks` → `rounds`, `programs.deload_week` → `deload_round` and `workouts.week` → `round`. The values keep their meaning, so a running program continues where it was. Exports from older versions still import, and profiles saved with `daysPerWeek` are read as `trainingDays`.

## 1.7.0 — 2026-11-27

- **English by default, Dutch optional**: choose the language under Profile → Language; it applies right away. Everything the user sees follows it:
  - screens
  - the progression engine's advice and explanations
  - starting-weight reasons and "how it was built"
  - names, days and descriptions of rule-based programs
  - errors and notices
  - the coach's facts
  - the language the AI writes in

  Weights use a decimal point in English (42.5 kg) and a comma in Dutch (42,5 kg).
- Stored text (engine advice, rule-based program names, day names) keeps both languages, so switching also applies to existing programs and workouts. Text written by the AI stays in the language it was written in; rebuild the program to change it.
- The 67 core exercises have English names and steps as well as the Dutch ones. Imported exercises keep their English text in both languages.
- `AI_LANGUAGE` is no longer used: the AI writes in the profile's language.
- `/api/exercises?lang=en|nl` serves the library per language (each gzipped once).
- Documentation (README, CHANGELOG) is now in English.

## 1.6.0 — 2026-11-27

- **Exercises in the menu**: the library has its own item in the bottom menu (between Program and Progress) instead of being reached through Program or Profile.
- **What you do with an exercise**: each exercise shows which program days it is on and how often you have done it, with the date of the last time. New filters: *In my program*, per training day in program order, and *Done*, most done first. An exercise's page also shows its sets and reps in your program, how many sets you did and your heaviest set.
- `GET /api/stats/exercise-usage`: per exercise the number of completed workouts and sets, the last time and the heaviest set.
- The explanation at the top of the library is collapsed (*How does this list work?*).

## 1.5.0 — 2026-11-27

- **Favourites and "never use"**: mark exercises as a favourite (the star in the library) or set them to *Never use* (on the exercise's page or from your program). The AI gets your favourites marked and puts them in the schedule where they fit. Excluded exercises are left out of the AI's list and replaced if the AI picks one anyway. The rule-based program picks a favourite first per movement pattern, also from the import, and skips excluded exercises.
- Excluding an exercise removes it from your current program right away: the app swaps it for the best alternative and keeps sets and reps.
- **Exercise overview**: *Favourites* and *Never use* filters with counts. Favourites have a yellow star and lead their muscle group. Excluded exercises sit at the bottom, struck through with a red mark.
- **Swapping**: search all exercises that fit your equipment, not just similar ones. Favourites come first, excluded exercises are never offered. The "never use again" checkbox excludes the old exercise in one go.
- Migration 4: table `exercise_preferences`. Your marks are part of the export.

## 1.4.0 — 2026-11-27

- **All exercises from free-exercise-db**: the library now has 886 exercises: the 67 core exercises plus the whole list from the fork [x-real-ip/free-exercise-db](https://github.com/x-real-ip/free-exercise-db), including stretching, cardio, plyometrics, Olympic weightlifting and strongman. Names and instructions of imported exercises are English. Their photos come from the fork and are kept after the first view for offline use.
- **More choice when swapping and for the AI**: about 375 strength exercises from the import can be in a program. When swapping you see the best eight and can search the rest. The AI is offered them too, but builds programs mainly from the core exercises. The rule-based program stays with the 67 core exercises.
- Library: filters on exercise type and "only exercises that can be in a program"; the level per exercise. New muscle groups: lower back, traps, forearms, adductors, abductors and neck.
- `npm run import:exercises [ref]` fetches the list from the fork again and pins it to a commit (`server/data/free-exercise-db.json`).
- `/api/exercises` is served gzipped (about 170 kB instead of 1 MB).
- An AI program costs a little more because of the longer exercise list: about 12,000 extra input tokens with a fully equipped gym, roughly 2.5 dollar cents per program with Sonnet 5.5.

## 1.3.0 — 2026-11-27

- **Dutch**: the whole app was translated, including the progression engine's explanations, starting weights, rule-based programs, notices and the coach's facts. Weights with a decimal comma (42,5 kg), reps as 12/12/11. AI-written text is Dutch by default.
- **Exercise library in the app**: all 67 exercises that can be in a program, per muscle group, with search and a filter on your equipment.
- **How do you do this?**: Dutch steps and two example photos per exercise (start and end position, as a short animation) from free-exercise-db (public domain), available offline. Opens during the workout, from the program and from the library.
- **Program: how it was built**: a plain-language explanation of the schedule, exercise choice, sets/reps/rest for your goal, starting weights, progression and deload, generated from the same rules that build the program.
- **AI settings in the app**: provider, model, API key, thinking effort per feature (default: coach low, programs medium) and a monthly budget, stored in the database. Environment variables are only the defaults. A button tests the connection.
- **Usage**: every AI call is recorded (migration 3) with tokens and estimated cost; per month, per feature, per day and the latest calls. The AI stops when the monthly budget is reached.
- Claude is now called through the official Anthropic SDK, with an explicit thinking effort and enough room for thinking (coach 4,000, programs 16,000 tokens). Refusals and truncated answers are detected; Sonnet 5.5 and Opus 5.5 fall back to another model automatically on a refusal.
- **Program: look ahead**: every workout of the block per week, with the deload week, the planned weights and the next step per exercise.

## 1.2.0 — 2026-11-27

First release deployed to the cluster through GitOps.

- **Deployment through `x-real-ip/gitops`**: `k8s/` is gone. The manifests (CloudNativePG cluster, SealedSecrets, deployment with a migrate init container, HTTPRoute on `fitness.lan.stamx.nl`) live in the gitops repo; see `deploy/README.md`.
- **CI**: typecheck, tests, PWA build, migrations against Postgres 18 (twice, plus `/healthz`), image to `ghcr.io/x-real-ip/overload`, and on a `v*` tag a dispatch to the gitops repo. Labeler, release-drafter, release-monitor and yamllint as in depart.
- **Health and migrations**: `GET /healthz` (`{"status":"ok","database":"ok"}`, 503 on a database error). Migrations as a standalone command `npm run migrate` (idempotent, advisory lock); `MIGRATE_ON_START=false` skips them on start.
- **Supersets**: sessions of 45 minutes or less get pairs of exercises that do not get in each other's way. In the workout you go straight to the partner after a set; the rest timer runs after the round. The AI may propose supersets; the app repairs them where needed.
- **Offline**: unsynced sets are now stored in IndexedDB instead of localStorage. A queue from 1.1 is moved over automatically.
- A new profile starts with 30-minute sessions.
- New names for environment variables, the old ones keep working: `APP_URL` (was `PUBLIC_URL`), `OIDC_ISSUER_URL` (was `OIDC_ISSUER`). New: `LOG_LEVEL`, `MIGRATE_ON_START`.
- The image runs as uid/gid 3001.
- Docker Compose is gone: locally you run against your own Postgres through `DATABASE_URL`. The old endpoints `/api/health` and `/api/ready` are replaced by `/healthz`.
- `CLAUDE.md` with the working agreements for this repo.

## 1.1.0 — 2026-10-30

- Database from SQLite to PostgreSQL (`pg`), migrations with an advisory lock, readiness probe `/api/ready`.
- Kubernetes manifests (`k8s/`): Kustomize base + homelab overlay with HTTPRoute (Gateway API), ExternalSecrets (Vault), NetworkPolicies, a Postgres StatefulSet and a nightly `pg_dump` CronJob; an ArgoCD example.
- Authentication through `AUTH_MODE`: `none`, `password`, `proxy` (Authentik forward-auth headers) and `oidc` (Authentik OAuth2/OpenID, code flow + PKCE, RP-initiated logout), with optional user/group allowlists.
- Import accepts exports from 1.0 (SQLite) for migration.
- Docker Compose with a Postgres container; in-app SQLite backups replaced by database backups outside the app.

## 1.0.0 — 2026-10-30

First MVP:

- Mobile-first PWA (React + Vite) with a dark theme, installable, offline app shell.
- Profile with level, goal, training days, session length, equipment, weight steps and limitations.
- AI-generated programs (Anthropic or OpenAI-compatible) from a fixed exercise library, with validation, repair and a rule-based fallback.
- Logging with one tap per set, prefilled weight, optional RIR, rest timer, auto-advance and an offline queue for sets.
- Deterministic double-progression engine; the AI never decides weights.
- Deload week, stall detection, dashboard with charts, records and sets per muscle group.
- AI coach with training context; adjusting the program based on the coach's advice.
- Export (JSON/CSV) and import.
