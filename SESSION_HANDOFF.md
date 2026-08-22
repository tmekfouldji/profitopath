# Session Handoff

Codex must rewrite this file at the end of every substantial work session.

## Current handoff

Phase 0 through Phase 5 are complete. Phase 6 task expansion is now active.

### Start next session by

1. Read `AGENTS.md` and every required project-memory / architecture file.
2. Inspect Git status, recent commits, and GitHub Actions run `32550829142`.
3. Continue P6-001 by expanding Phase 6 into acceptance-tested tasks, then start the first
   implementation task.
4. Keep all commands and chart history backend-owned; apply
   `10_MARKET_DATA_CACHING_AND_CANDLES.md` and do not add a real provider.

### Current active phase

Phase 6 — browser trading terminal (P6-001 in progress).

### Work completed

- Expanded and completed Phase 5 tasks P5-001 through P5-009.
- Added durable pending/protective metadata, trigger quote evidence, terminal reasons, active-scan
  indexes, and a versioned development market schedule.
- Added exact limit/stop and long/short SL/TP policies using executable bid/ask prices.
- Added account-serialized quote triggering, current-quote/gap fills, replay idempotency, and margin
  revalidation at trigger.
- Added idempotent cancellation, full-position OCO protection, manual-size reconciliation, and
  trigger/cancel race handling.
- Extended worker processing and restart recovery to accepted orders, offline triggers, risk, closed
  markets, and weekly cutoff expiry.
- Recorded D-016 for reversible development pending/protection semantics. No real provider was added.

### Verification results

- `pnpm format`: passed
- `pnpm db:validate` / `pnpm db:generate`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `pnpm test`: 41 passed locally; 21 PostgreSQL integration tests skipped locally
- `pnpm build`: passed
- GitHub Actions run `32550829142`: passed migration deployment, idempotent seed, Compose
  validation, all 62 tests, and production build against PostgreSQL/Valkey services

Docker and `psql` remain absent on this workstation, so the 21 PostgreSQL scenarios are run in CI.
The Phase 5 service-backed run passed on the first feature commit.

### Git state

Git is on `main` with Phase 5 feature commit `bc2c23b`, tracking `origin/main` at
`git@github.com:tmekfouldji/profitopath.git`. The documentation phase-boundary commit containing
this handoff follows that implementation commit.

### Exact next task

P6-001 — expand Phase 6 into concrete acceptance-tested browser-terminal tasks. Preserve server
authority, backend-owned deterministic candle history, account ownership, complete persisted
history, responsive accessibility, and reconnect/resync behavior.

### Important blockers

None for Phase 6 mock development. Product/legal rules in `PROJECT_STATE.md` remain configurable.

### Do not start yet

- real market-data provider or upstream historical-candle integration
- NOWPayments production integration
- DigitalOcean production deployment
- funded accounts, live brokerage execution, MT4/MT5, or prop functionality
