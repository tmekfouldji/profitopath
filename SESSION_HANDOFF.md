# Session Handoff

Codex must rewrite this file at the end of every substantial work session.

## Current handoff

Phase 0 through Phase 7 are complete. Phase 8 prize/admin workflow task expansion is next.

### Start next session by

1. Read `AGENTS.md` and every required project-memory / architecture file.
2. Inspect Git status, recent commits, and GitHub Actions run `32554024772`.
3. Start P8-001 by expanding Phase 8 into concrete acceptance-tested prize/admin tasks before
   implementing the first prize-ledger change.
4. Derive winners only from immutable finalized standings; keep company-funded prize economics,
   KYC, payout approval, and transaction recording manual/audited development workflows.

### Current active phase

Phase 8 — prize/admin workflow (P8-001 not started).

### Work completed

- Completed Phase 7 tasks P7-001 through P7-011.
- Added versioned exact leaderboard eligibility/ranking, tier isolation, every development tie
  break, true shared ranks, stable display ordering, and durable cutoff/final standing records.
- Added serialized UTC activation/freeze, order expiry, authoritative last-snapshot cutoff capture,
  exact drawdown/score-time inputs, account/entry completion, idempotent replay, and late-payment
  exclusion after freeze.
- Added PostgreSQL-only live/frozen recompute, canonical SHA-256 final results, immutable standing
  rows, concurrent duplicate finalization, and frozen-to-finalized audits.
- Added ADMIN-authorized lifecycle/recompute/finalize/archive controls and reason-required
  pre-finalization disqualification with actor audits and preserved cutoff evidence.
- Added public live/frozen/final/archive leaderboards and authenticated trader rank/eligibility views
  with safe display names, UTC provenance, development-policy labeling, and final hashes.
- Added PostgreSQL-discovered worker cycles with overlap protection, failure isolation, restart retry,
  and opt-in auto-finalization. `AUTO_FINALIZE_FROZEN_COMPETITIONS=false` remains the safe default
  until a review-window duration is approved.
- Recorded D-018 through D-021 for ranking, cutoff valuation, administrative disqualification, and
  worker finalization defaults. No prize amounts, real providers, custody, or production deployment
  were added.

### Verification results

- `pnpm format`: passed
- `pnpm db:validate` / `pnpm db:generate`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `pnpm test`: 86 passed locally; 29 PostgreSQL integration tests skipped locally
- `pnpm build`: passed with `.env.example` loaded and `NODE_ENV=production`
- GitHub Actions run `32554024772`: passed migration deployment, idempotent seed, Compose
  validation, formatter, typecheck, lint, all 115 tests, and production build against
  PostgreSQL/Valkey services

Docker and `psql` remain absent on this workstation, so PostgreSQL scenarios run in CI.

### Git state

Git is on `main`, tracking `origin/main` at `git@github.com:tmekfouldji/profitopath.git`. Phase 7's
last tested code commit is `8d1395d`; the phase-boundary documentation commit containing this
handoff follows it.

### Exact next task

P8-001 — expand the company-funded prize/admin milestone into concrete acceptance-tested tasks for
immutable-standing winner derivation, winner review, fifth-place free-entry credits, manual KYC,
dual-control payout approval, transaction-reference recording, reconciliation, audit evidence,
tests, and the Phase 8 quality gate.

### Important blockers

Final prize/legal wording and production economics are not approved. The existing development prize
records may be used to build a reversible ledger/review workflow, but no implementation may initiate
a production payout, imply KYC automation, add customer custody/balances, or silently alter prize
amounts/allocation. The frozen automatic-finalization review duration is also unapproved, so its
worker flag remains false.

### Do not start yet

- real market-data provider or upstream historical-candle integration
- NOWPayments production integration
- DigitalOcean production deployment
- funded accounts, live brokerage execution, MT4/MT5, profit splits, or customer trading deposits
