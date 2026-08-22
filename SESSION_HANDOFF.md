# Session Handoff

Codex must rewrite this file at the end of every substantial work session.

## Current handoff

Phase 0 and Phase 1 are complete. Phase 2 is next and has not started.

### Start next session by

1. Read `AGENTS.md`.
2. Read `PROJECT_STATE.md`.
3. Read `TASKS.md`.
4. Read `DECISIONS.md`.
5. Inspect Git status and recent commits.
6. Continue the first incomplete task in the active phase.

### Current active phase

Phase 2 — authentication and application shell (not started).

### Work completed

- Initialized the pnpm TypeScript monorepo and Git `main` branch.
- Added `apps/web`, `apps/realtime`, and `apps/worker`, including JSON logging and health routes.
- Added all architecture packages and provider-neutral simulator/market-data/payment boundaries.
- Added strict TypeScript, ESLint, Prettier, Vitest, Docker Compose, deployable Dockerfiles, and CI.
- Added typed Zod environment parsing without committed secrets.
- Added the full Phase 1 Prisma model, initial migration, client/health/audit helpers, and seed.
- Added explicit competition, entry, account, order, payment, prize, payout, and user state graphs.
- Added transactional state-transition/audit service boundaries and deterministic tests.
- Documented exact install, database, startup, test, build, and container commands in `README.md`.

### Work in progress

None. The exact next task is P2-001.

### Verification results

- `pnpm format`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `pnpm test`: 9 passed locally; all 11 passed in GitHub Actions with PostgreSQL
- `pnpm build`: passed
- `pnpm db:validate`: passed
- realtime `/health/live`: HTTP 200
- realtime `/health/ready`: HTTP 503 as expected with PostgreSQL/Valkey stopped
- GitHub Actions CI run `32546992929`: passed migration, seed, Compose validation, all tests,
  and production build

No tests are known to fail. Docker is not installed on this workstation; the service-backed
quality gate passed in GitHub Actions.

### Git state

Git is on `main` and tracks `origin/main` at `git@github.com:tmekfouldji/profitopath.git`. The
unrelated untracked file `10_MARKET_DATA_CACHING_AND_CANDLES.md` appeared during the final gate
and was intentionally left untouched and uncommitted.

### Exact next task

Expand Phase 2 into concrete acceptance-tested tasks in `TASKS.md`, mark P2-001 in progress,
then implement the Auth.js-compatible auth and application shell without entering Phase 3.

### Important blockers

None for Phase 0–8 mock development. Product/legal rules listed in `PROJECT_STATE.md` remain
unresolved but intentionally configurable.

### Do not start yet

- real market-data provider
- NOWPayments production integration
- DigitalOcean production deployment
- funded/prop functionality
