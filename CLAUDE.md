# CLAUDE.md

Working agreements for this repository.

## Language

- Code, identifiers, UI text and code comments: **English**.
- Documentation (`README.md`, `deploy/README.md`, `CHANGELOG.md`): **Dutch**.

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
  this repo. See `deploy/README.md`.
- A release tag `v*` deploys: CI dispatches to gitops, which pins the image tag. Never
  push to `main` of gitops directly; Argo CD applies it immediately. Use a PR.

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
docker build .
```
