# Session Handoff

Codex must rewrite this file at the end of every substantial work session.

## Current handoff

Phase 0 through Phase 8 are complete. Phase 9 real market-data integration is blocked pending the
user/vendor inputs listed below.

### Start next session by

1. Read `AGENTS.md` and every required project-memory, architecture, deployment, and candle file.
2. Inspect Git status, recent commits, and GitHub Actions run `32554756501`.
3. Confirm whether P9-001 now has a selected provider, official API documentation, and written
   commercial rights covering customer-facing charts and simulated execution.
4. If any P9-001 input remains absent, keep Phase 9 blocked and do not invent or reverse-engineer a
   provider API. Do not start NOWPayments or DigitalOcean production work instead.

### Current active phase

Phase 9 — real market-data provider, blocked at P9-001.

### Work completed

- Completed Phase 8 tasks P8-001 through P8-010.
- Added a forward-only PostgreSQL prize-operations migration for immutable final-result provenance,
  winner/KYC reviews, distinct approval actors, reconciliation evidence, and individually tracked
  free-entry entitlements.
- Added a serialized idempotent prize ledger that binds only preconfigured development amounts to
  exact immutable standings/result hashes. Missing configuration fails closed and true tied ranks
  remain unresolved rather than selecting a winner or changing allocation.
- Added audited manual winner confirmation/rejection and KYC state transitions. Prize approval is
  gated on both, creates an exact amount/currency payout, and requires a different administrator to
  approve that payout.
- Added manual payout processing, failure/retry/cancellation, unique transaction-reference recording,
  paid-state immutability, second-actor reconciliation, and atomic issuance of the configured fifth-
  place access credits. No payout provider, crypto custody, or customer balance was added.
- Added an ADMIN-only operations console showing provenance/current state/valid next actions and an
  ownership-scoped trader prize/credit view without internal audit or transaction details.
- Added unit, action/RBAC, browser, concurrency, PostgreSQL persistence/ownership, tie, missing-award,
  mismatch, duplicate-reference, reconciliation, audit, and credit tests.
- Recorded D-022. Final prize formula/legal wording/KYC timing remain pending and unchanged.

### Verification results

- `pnpm format`: passed
- `pnpm db:validate` / `pnpm db:generate`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `pnpm test`: 91 passed locally; 36 PostgreSQL integration tests skipped locally
- `pnpm build`: passed with `.env.example` loaded and `NODE_ENV=production`
- GitHub Actions run `32554756501`: applied all eight migrations and passed idempotent seed,
  Compose validation, formatter, typecheck, lint, all 127 tests, and production build against
  PostgreSQL/Valkey services

Docker and `psql` remain absent on this workstation, so PostgreSQL scenarios run in CI.

### Git state

Git is on `main`, tracking `origin/main` at `git@github.com:tmekfouldji/profitopath.git`. Phase 8's
last service-backed tested code commit is `8a49c67`; the phase-boundary documentation commit
containing this handoff follows it.

### Exact next task

P9-001 — obtain and record all three prerequisites before implementation: the selected market-data
provider, official streaming and historical-candle API documentation, and documentary commercial
approval for customer-facing display plus simulated execution. This needs user/vendor intervention.

### Important blockers

- No market-data provider is selected.
- No official provider API/streaming/historical documentation has been supplied.
- Commercial display, redistribution/cache, and simulated-execution rights are not confirmed.
- Final production trading rules, prize/legal wording, KYC timing, SVG legal opinion, and
  NOWPayments merchant acceptance remain pending.

### Do not start yet

- any real market-data adapter, stream, or upstream historical-candle request
- NOWPayments production integration
- DigitalOcean production deployment
- funded accounts, live brokerage execution, MT4/MT5, profit splits, or customer trading deposits
