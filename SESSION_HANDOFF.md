# Session Handoff

Codex must rewrite this file at the end of every substantial work session.

## Current handoff

Phase 0 through Phase 6 are complete. Phase 7 task expansion is active.

### Start next session by

1. Read `AGENTS.md` and every required project-memory / architecture file.
2. Inspect Git status, recent commits, and GitHub Actions run `32552180252`.
3. Continue P7-001 by expanding Phase 7 into acceptance-tested lifecycle/leaderboard tasks, then
   start the first implementation task.
4. Keep ranking/tie rules explicitly versioned, compute only from authoritative PostgreSQL state,
   preserve company-funded prize economics, and do not add a real provider or production deploy.

### Current active phase

Phase 7 — competition + leaderboard (P7-001 in progress).

### Work completed

- Completed Phase 6 tasks P6-001 through P6-011.
- Added durable exact mock 1m candles, complete higher-timeframe UTC aggregation, range coalescing,
  live server candle construction, historical/live handoff, and bounded older-history loading.
- Added rebuildable Valkey quote publication with TTL/staleness checks, monotonic worker sequences,
  weekend suspension, and server command adapters that fail closed without a valid quote.
- Added ownership-scoped terminal/candle APIs, authenticated snapshot-first WebSockets, and typed
  quote/candle delta validation; the gateway accepts no trading mutation messages.
- Replaced the terminal placeholder with the responsive risk rail, Lightweight Charts workspace,
  authoritative order ticket, positions/protection, pending orders, executions, closed trades,
  metrics, reconnect/stale states, persistent markers, and fictitious-capital labeling.
- Recorded D-017 for reversible deterministic development candle policy. No real provider was added.

### Verification results

- `pnpm format`: passed
- `pnpm db:validate` / `pnpm db:generate`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `pnpm test`: 60 passed locally; 23 PostgreSQL integration tests skipped locally
- `pnpm build`: passed with the documented development environment and `NODE_ENV=production`
- GitHub Actions run `32552180252`: passed migration deployment, idempotent seed, Compose
  validation, all 83 tests, and production build against PostgreSQL/Valkey services

Docker and `psql` remain absent on this workstation, so PostgreSQL scenarios run in CI.

### Git state

Git is on `main` with Phase 6 feature commit `a06501e`, tracking `origin/main` at
`git@github.com:tmekfouldji/profitopath.git`. The phase-boundary documentation commit containing
this handoff follows that implementation commit.

### Exact next task

P7-001 — expand weekly competition lifecycle and leaderboard work into concrete acceptance-tested
tasks. The first implementation must establish deterministic, versioned eligibility/ranking/tie
semantics and cutoff inputs before public or admin leaderboard UI.

### Important blockers

Final leaderboard formula, drawdown semantics, and prize/legal wording are not approved. Phase 7
may use a clearly labeled version-one development ranking policy matching the product-spec proposal;
it must not silently change prize amounts/allocation or present development policy as final.

### Do not start yet

- real market-data provider or upstream historical-candle integration
- NOWPayments production integration
- DigitalOcean production deployment
- funded accounts, live brokerage execution, MT4/MT5, or prop functionality
