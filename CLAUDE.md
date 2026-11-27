# CLAUDE.md

Working agreements for this repository.

## Language

- Code, identifiers and code comments: **English**.
- UI text and every text the user sees (engine explanations, errors, curated exercise names and guides): **Dutch**.
  Weights use a decimal comma (42,5 kg). Exception: exercises imported from free-exercise-db keep their
  English names and instructions.
- Documentation (`README.md`, `CHANGELOG.md`): **Dutch**.

## Stack

- Node 22 + TypeScript. The server runs `.ts` directly (type stripping), so there is no
  server build step; `npm run build` builds the PWA in `web/`.
- Fastify serves both the API and the built PWA from one image
  (`ghcr.io/x-real-ip/overload`). Don't split it into separate web/api images.
- PostgreSQL only, via `pg`. Schema changes are new entries appended to `migrations` in
  `server/db.ts`; never edit a migration that has shipped. Migrations must stay
  idempotent (`npm run migrate` runs as an init container on every rollout).

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
- Every curated exercise needs a Dutch guide in `exerciseGuide.ts` with two photos in
  `web/public/exercises/`; `server/tests/exercises.test.ts` enforces this.
- Imported exercises (`freeExerciseDb.ts`) come from `server/data/free-exercise-db.json`, pinned to a commit of
  `x-real-ip/free-exercise-db` by `npm run import:exercises`. Their names and instructions stay English, on
  purpose; photos load from the fork at the same commit. Pattern, load type and start factor are derived by
  `classifyPattern` and friends; add a case to the classification test when changing them.

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
```

CI builds the image from the `Dockerfile`; there is no Docker setup for local use.
