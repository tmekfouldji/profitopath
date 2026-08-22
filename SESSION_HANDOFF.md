# Session Handoff

Codex must rewrite this file at the end of every substantial work session.

## Current handoff

Phase 0 through Phase 8 are complete. Phase 9 real market-data integration remains blocked at
P9-001. TraderMade is the preferred candidate and the user is waiting for its commercial response;
no provider API or commercial rights have been approved.

### Start next session by

1. Read `AGENTS.md` and every required project-memory, architecture, deployment, and candle file.
2. Inspect Git status, recent commits, and GitHub Actions run `32554756501`.
3. Ask only whether the TraderMade response now supplies official streaming/historical documentation
   and written customer-facing display, cache/fanout, and simulated-execution rights.
4. If any P9-001 input remains absent, keep Phase 9 blocked. Do not invent/reverse-engineer an API or
   start NOWPayments/DigitalOcean production work instead.

### Work completed this session

- Installed and started local Homebrew PostgreSQL 17 and Valkey because Docker is unavailable on this
  workstation; both are managed by `brew services` and are removable.
- Applied all eight migrations and ran the idempotent development seed.
- Fixed `pnpm db:seed` so it loads the repository-root `.env` without manual shell exports.
- Corrected README health URLs: web uses `/api/health/*`; realtime and worker use `/health/*`.
- Reconciled the ignored local `.env` with the current mock-only development keys and enabled
  `MOCK_MARKET_DATA_ENABLED=true` locally.
- Started web/realtime/worker together and verified every liveness/readiness route against PostgreSQL
  and Valkey. Public home and registration pages rendered successfully in the local browser.
- Kept all real-provider work deferred. The simulator still uses deterministic mock quotes and
  PostgreSQL-backed mock candle history.

### Verification results

- `pnpm format:write`: passed
- `pnpm db:validate` / `pnpm db:generate`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `RUN_DATABASE_TESTS=true pnpm test`: all 127 tests passed (48 test files)
- `NODE_ENV=production pnpm build`: passed
- `pnpm db:seed` with `DATABASE_URL` and seed values explicitly unset in the shell: passed by loading
  the root `.env`
- web, realtime, and worker readiness: passed with PostgreSQL and Valkey healthy
- GitHub Actions run `32554756501` remains the latest service-backed CI run and passed all 127 tests
  plus the production build

### Local runtime

- PostgreSQL 17 and Valkey are running through Homebrew services on ports 5432 and 6379.
- Start the app from the repository root with `pnpm dev`; the ignored `.env` enables the deterministic
  mock feed.
- Web: `http://localhost:3000`; realtime: port 3001; worker: port 3002.
- The development market schedule is UTC 24x5. On weekends, live quote publication intentionally
  pauses; historical candles and the rest of the application remain available.

### Exact next task

P9-001 — record the TraderMade response, official streaming and historical-candle documentation,
credential/rate-limit terms, and documentary commercial approval for customer-facing display,
caching/fanout, and simulated execution. Do not implement an adapter until all are supplied.

### Important blockers

- TraderMade commercial inquiry is pending; no vendor is approved.
- Official streaming/historical documentation and rate-limit/credential terms are not supplied.
- Commercial display, redistribution/cache/fanout, and simulated-execution rights are not confirmed.
- Final production trading rules, prize/legal wording, KYC timing, SVG legal opinion, and
  NOWPayments merchant acceptance remain pending.

### Do not start yet

- any real market-data adapter, stream, or upstream historical-candle request
- NOWPayments production integration
- DigitalOcean production deployment
- funded accounts, live brokerage execution, MT4/MT5, profit splits, or customer trading deposits
