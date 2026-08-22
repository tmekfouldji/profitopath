# Session Handoff

Codex must rewrite this file at the end of every substantial work session.

## Current handoff

Phase 0 is complete and Phase 1 implementation is complete pending its service-backed CI run.

### Start next session by

1. Read `AGENTS.md`.
2. Read `PROJECT_STATE.md`.
3. Read `TASKS.md`.
4. Read `DECISIONS.md`.
5. Inspect Git status and recent commits.
6. Continue the first incomplete task in the active phase.

### Current active phase

Phase 1 — database/domain foundation, final CI validation.

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

- P1-017: run PostgreSQL persistence tests in GitHub Actions.
- P1-019: mark Phase 1 complete after CI and finalize this handoff for Phase 2.

### Verification results

- `pnpm format`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `pnpm test`: 9 passed, 2 service-backed integration tests skipped locally
- `pnpm build`: passed
- `pnpm db:validate`: passed
- realtime `/health/live`: HTTP 200
- realtime `/health/ready`: HTTP 503 as expected with PostgreSQL/Valkey stopped

No tests are known to fail. Docker is not installed on this workstation, so GitHub Actions is
responsible for executing migrations, the seed, Compose validation, and the two PostgreSQL tests.

### Git state

Git was initialized on `main`, `origin` is `https://github.com/tmekfouldji/profitopath.git`, and
the remote currently has no branch heads. The initial commit/push is the current task.

### Exact next task

Commit and push the Phase 0–1 implementation, inspect GitHub Actions, fix any service-backed
failures, then mark P1-017/P1-019 complete and set Phase 2 as the next phase.

### Important blockers

None for Phase 0–8 mock development. Product/legal rules listed in `PROJECT_STATE.md` remain
unresolved but intentionally configurable.

### Do not start yet

- real market-data provider
- NOWPayments production integration
- DigitalOcean production deployment
- funded/prop functionality
