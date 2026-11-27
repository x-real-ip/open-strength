# CLAUDE.md

Working agreements for this repository.

## Language

- Code, comments, commits, PRs, release notes and documentation (`README.md`): **English**.
- Everything the user sees exists in **English (default) and Dutch**; the profile's `language` picks one.
  - Web: write text in place as `t('English', 'Nederlands')` (`web/src/i18n.ts`). Numbers through `kg()`/`decimal()`
    (42.5 in English, 42,5 in Dutch), dates through `locale()`.
  - Server: `loc(en, nl)` and `UserError(status, en, nl)` (`server/i18n.ts`); pick with `langOf(profile)`.
    Text that is stored (engine reasons, rule-based program/day names) is stored with both languages via
    `encode()` and read back with `pick()`, so switching language also covers existing data.
  - Curated exercises: English steps in `exerciseGuideEn.ts`, Dutch in `exerciseGuide.ts`; `localizeExercise`.
    Imported free-exercise-db exercises keep their English text in both languages.
  - The AI writes in the profile's language (`AI_LANGUAGE` in `server/i18n.ts`).

## Stack

- Node 22 + TypeScript. The server runs `.ts` directly (type stripping), so there is no
  server build step; `npm run build` builds the PWA in `web/`.
- Fastify serves both the API and the built PWA from one image
  (`ghcr.io/x-real-ip/overload`). Don't split it into separate web/api images.
- PostgreSQL only, via `pg`. Schema changes are new entries appended to `migrations` in
  `server/db.ts`; never edit a migration that has shipped. Migrations must stay
  idempotent (`npm run migrate` runs as an init container on every rollout).

## Versions

- The release tag decides the version. CI passes it into the image as `APP_VERSION` (tag `v1.2.3` → `1.2.3`);
  other builds show `dev-<commit>`. `package.json` has no version.
- No version numbers in PRs or commits: not in titles, descriptions or files; the version is chosen when the
  release is published.
- Release notes come from release-drafter (PR titles and labels). PRs do not edit `CHANGELOG.md`: every PR
  adding lines at the same spot made each next PR conflict. Write a clear PR title instead.

## Deployment

- Deploy only via `x-real-ip/gitops` (`manifests/overload/`). No Kubernetes manifests in
  this repo.
- A release tag `v*` deploys: CI dispatches to gitops, which pins the image tag. Never
  push to `main` of gitops directly; Argo CD applies it immediately. Use a PR.

## AI

- Claude calls go through the official `@anthropic-ai/sdk` (`server/services/ai.ts`); other providers through
  the OpenAI-compatible chat API. Every call is recorded in `ai_usage`.
- AI settings saved in the app (`services/aiSettings.ts`, settings key `ai`) win over `AI_*` environment
  variables. Never send the API key to the browser.
- Keep `MODEL_PRICES` in `aiSettings.ts` in line with the published price list.

## Exercise library

- `server/services/exercises.ts`: `CURATED` (67 exercises), `LIBRARY` (curated plus all of free-exercise-db)
  and `EXERCISES` (programmable: what programs, swaps and the AI may use). Rule-based templates pick a
  favourite first, otherwise from `CURATED` (`pickForPattern`).
- User marks live in `exercise_preferences` (`services/exercisePrefs.ts`). An excluded exercise must never
  reach a program: filter it out of the AI catalogue, `sanitizeAiProgram`, `pickForPattern`,
  `alternativesFor` and the replace route.
- Every curated exercise needs a Dutch guide in `exerciseGuide.ts`, English steps in `exerciseGuideEn.ts`, and two photos in
  `web/public/exercises/`; `server/tests/exercises.test.ts` enforces this.
- Imported exercises (`freeExerciseDb.ts`) come from `server/data/free-exercise-db.json`, pinned to a commit of
  `x-real-ip/free-exercise-db` by `npm run import:exercises`. Their names and instructions stay English, on
  purpose; photos load from the fork at the same commit. Pattern, load type and start factor are derived by
  `classifyPattern` and friends; add a case to the classification test when changing them.

## Push notifications

- Rest notifications use Web Push (`services/push.ts`, `web-push`). VAPID keys are generated once and kept in the
  settings table. The pending rest push is an in-memory timer: fine for one replica; a restart only drops a pending
  rest notification. The page schedules it only while hidden (`web/src/notifications.ts`), so it never doubles the beep.

## Progression engine

- Training weights come from `server/services/progression.ts` only: deterministic, based
  on logged sets. The AI never decides weights; it may explain them. AI start weights are
  clamped (`clampStartWeight`) and logged history always wins.
- Every change to the engine (progression, deload, stall detection, start weights)
  needs unit tests in `server/tests/`. Keep the spec example green: 12/11/10 at 40 kg with
  8–12 reps → stay at 40 kg, aim for 12/12/11.

## Checks before a PR

```bash
npm run typecheck && npm test && npm run build
yamllint .
E2E_DATABASE_URL=postgres://… npm run test:e2e   # browser tests; also run in CI
```

Change UI text or flows? Update `e2e/flow.spec.ts` too: it clicks through the app by visible text, in both languages.

CI builds the image from the `Dockerfile`; there is no Docker setup for local use.
