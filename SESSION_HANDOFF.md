# Session Handoff

Codex must rewrite this file at the end of every substantial work session.

## Current handoff

Phase 0 through Phase 4 are complete. Phase 5 task expansion is now active.

### Start next session by

1. Read `AGENTS.md` and every required project-memory / architecture file.
2. Inspect Git status, recent commits, and GitHub Actions run `32550183420`.
3. Continue P5-001 by expanding Phase 5 into acceptance-tested tasks, then start the first
   implementation task.
4. Keep all trigger evaluation server-side on normalized deterministic quotes; do not add a real
   market-data provider or historical candle implementation.

### Current active phase

Phase 5 — pending orders / SL / TP (P5-001 in progress).

### Work completed

- Expanded and completed Phase 4 tasks P4-001 through P4-011.
- Added validated normalized quotes, deterministic replay, and explicit historical-data deferral.
- Added versioned persisted development instrument specifications and an idempotent seed.
- Added exact Decimal/integer accounting for fills, netting, P&L, margin, equity, and drawdown.
- Added persistent idempotent market orders, executions, positions, closed trades, realized ledger
  effects, snapshots, exact-boundary breaches, and correlated audits.
- Added restart recovery and an opt-in worker-owned mock-feed runtime.
- Corrected Decimal.js positive-zero handling so zero quantities are rejected and opening fills do
  not create zero-value realized-P&L ledger entries.
- Recorded D-015 for Phase 4 development instrument and rounding/risk semantics. No real provider or
  historical candle implementation was added.

### Verification results

- `pnpm format`: passed
- `pnpm db:validate` / `pnpm db:generate`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `pnpm test`: 37 passed locally; 13 PostgreSQL integration tests skipped locally
- `pnpm build`: passed
- GitHub Actions run `32550183420`: passed migration deployment, idempotent seed, Compose
  validation, all 50 tests, and production build against PostgreSQL/Valkey services

The first Phase 4 CI run exposed Decimal.js treating positive zero as `isPositive()`. Commit
`3131874` uses strict greater-than-zero checks and adds regression coverage; the corrected full CI
run passed. Docker and `psql` remain absent on this workstation, so PostgreSQL integration coverage
is run in CI.

### Git state

Git is on `main` with Phase 4 feature commit `636111a` and positive-zero fix `3131874`, tracking
`origin/main` at `git@github.com:tmekfouldji/profitopath.git`. The documentation phase-boundary
commit containing this handoff follows those implementation commits.

### Exact next task

P5-001 — expand Phase 5 pending-order, stop-loss/take-profit, and cancellation work into concrete
acceptance-tested tasks. Preserve server authority, quote-sequence determinism, idempotent trigger /
cancel races, persistence, recovery, and complete order/execution/trade history.

### Important blockers

None for Phase 5 mock development. Product/legal rules in `PROJECT_STATE.md` remain configurable.

### Do not start yet

- real market-data provider or upstream historical-candle integration
- NOWPayments production integration
- DigitalOcean production deployment
- funded accounts, live brokerage execution, MT4/MT5, or prop functionality
