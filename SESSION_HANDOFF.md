# Session Handoff

Codex must rewrite this file at the end of every substantial work session.

## Current handoff

Phase 0 through Phase 3 are complete. Phase 4 is next and has not started.

### Start next session by

1. Read `AGENTS.md` and every required project-memory / architecture file.
2. Inspect Git status, recent commits, and GitHub Actions run `32549129070`.
3. Expand Phase 4 into acceptance-tested tasks in `TASKS.md` and mark P4-001 in progress.
4. Implement only deterministic mock market data and the persisted simulator core; reread and apply
   `10_MARKET_DATA_CACHING_AND_CANDLES.md` to every overlapping pricing boundary.

### Current active phase

Phase 4 — mock market data + simulator core (not started).

### Work completed

- Expanded and completed Phase 3 tasks P3-001 through P3-009.
- Added a deterministic signed mock provider with idempotent checkout creation, payment lookup, and
  confirmed/failed/expired callback verification.
- Added a forward-only migration for checkout URL/expiry and immutable provider-event receipts with
  provider-scoped uniqueness and normalized payload hashes.
- Added eligibility-controlled checkout reservation that reuses one pending entry and payment.
- Added exact-amount payment processing serialized by PostgreSQL advisory transaction locks.
- Added one-transaction confirmation, entry activation, active simulated account provisioning,
  initial-balance ledger creation, and correlated immutable audits.
- Added authenticated competition checkout, explicit fictitious-capital disclosure, dashboard
  completion state, ownership checks, and protected admin payment/provisioning visibility.
- Added five mock-provider unit tests and five PostgreSQL provisioning integration tests.
- Recorded D-014 for durable serialized payment-event provisioning. No NOWPayments or real provider
  code was added.

### Verification results

- `pnpm format`: passed
- `pnpm db:validate` / `pnpm db:generate`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `pnpm test`: 22 passed locally; 8 PostgreSQL integration tests skipped locally
- `pnpm build`: passed with the mock checkout route included
- GitHub Actions run `32549129070`: passed migration deployment, idempotent seed, Compose
  validation, all 30 tests, and production build against PostgreSQL/Valkey services

The first Phase 3 CI run exposed Prisma's inability to deserialize the PostgreSQL advisory lock's
`void` result. Commit `ec37192` projects the lock query to a supported integer; the corrected full
CI run passed. Docker and `psql` remain absent on this workstation, so the authenticated browser
checkout was not interactively exercised locally. Its routes compiled, and its database behavior
was exercised by service-backed CI.

### Git state

Git is on `main` with feature commit `b0b6a88` and PostgreSQL lock fix `ec37192`, tracking
`origin/main` at `git@github.com:tmekfouldji/profitopath.git`. The documentation closeout commit
containing this handoff follows those implementation commits.

### Exact next task

P4-001 — expand Phase 4 mock-market-data and simulator-core work into concrete acceptance-tested
tasks. Preserve server authority, deterministic replay, exact Decimal/integer accounting,
persistence/restart recovery, and the authoritative market-data boundaries in
`10_MARKET_DATA_CACHING_AND_CANDLES.md`.

### Important blockers

None for Phase 4 mock development. Product/legal rules in `PROJECT_STATE.md` remain configurable.

### Do not start yet

- real market-data provider or upstream historical-candle integration
- NOWPayments production integration
- DigitalOcean production deployment
- funded accounts, live brokerage execution, MT4/MT5, or prop functionality
