# Session Handoff

Codex must rewrite this file at the end of every substantial work session.

## Current handoff

Phase 0, Phase 1, and Phase 2 are complete. Phase 3 is next and has not started.

### Start next session by

1. Read `AGENTS.md` and every project-memory file.
2. Inspect Git status, recent commits, and the latest GitHub Actions run.
3. Expand Phase 3 into acceptance-tested tasks in `TASKS.md` and mark P3-001 in progress.
4. Implement only the mock payment provider and idempotent entry/account provisioning scope.

### Current active phase

Phase 3 — mock payments and entry provisioning (not started).

### Work completed

- Reviewed and adopted `10_MARKET_DATA_CACHING_AND_CANDLES.md` as a future Phase 9 constraint;
  no real market-data provider was implemented.
- Added an Auth.js-compatible Prisma schema/migration for accounts, sessions, verification tokens,
  and one-to-one password credentials.
- Added normalized registration inputs, salted scrypt password hashes, timing-safe verification,
  generic login failures, typed JWT sessions, and database-refreshed role/status revocation.
- Added audited registration/sign-in, login/logout UI, protected dashboard, server-side admin RBAC,
  persisted competition pages, and an account-owned terminal shell.
- Added a deterministic upcoming weekly competition seed and PostgreSQL tests for the auth graph
  and seed output.
- Built a responsive ink/aqua/coral trading-desk UI with a five-session week tape; desktop and
  390px mobile browser checks showed no horizontal overflow.

### Verification results

- `pnpm format`: passed
- `pnpm db:validate` / `pnpm db:generate`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `pnpm test`: 17 passed locally; 3 PostgreSQL integration tests skipped locally
- `pnpm build`: passed without warnings
- GitHub Actions run `32548247855`: all 20 tests and every quality/build step passed

Docker is not installed on this workstation. CI is the required PostgreSQL/Valkey-backed gate and
runs migration deployment, idempotent seed, tests, Compose validation, and production build.

### Git state

Git is on `main` and tracks `origin/main` at `git@github.com:tmekfouldji/profitopath.git`. Phase 2
feature commit `02c78c4` passed CI; the closeout documentation is committed separately.

### Exact next task

P3-001 — expand Phase 3 mock-payment and provisioning work into concrete acceptance-tested tasks.

### Important blockers

None for Phase 0–8 mock development. Product/legal rules in `PROJECT_STATE.md` remain configurable.

### Do not start yet

- real market-data provider
- NOWPayments production integration
- DigitalOcean production deployment
- funded accounts, live brokerage execution, MT4/MT5, or prop functionality
