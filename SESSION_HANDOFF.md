# Session Handoff

Codex must rewrite this file at the end of every substantial work session.

## Current handoff

Phase 0 through Phase 8 are complete. Phase 9 real market-data integration remains blocked at
P9-001. On 24 August 2026, TraderMade offered an FX plan starting at £599 (with a possible startup
discount) or a £199 refundable, seven-day trial. It said commercial terms can be discussed after
testing. This is a pricing/trial offer, not approval to provide data to customers. No real provider
integration has begun.

### Start next session by

1. Read `AGENTS.md` and every required project-memory, architecture, deployment, candle, and
   TraderMade activation-gate file.
2. Inspect Git status, recent commits, and GitHub Actions run `32554756501`.
3. For the all-container local environment, run `docker compose -f docker-compose.production.yml ps`.
   Start it with `docker compose -f docker-compose.production.yml up --build -d` if needed.
4. If TraderMade sends a payment link, treat it as a vendor-subscription payment link only. Do not
   store it, a receipt, credentials, or any secret in Git, an image, browser code, or chat logs.
5. Before any adapter work, obtain the official streaming/historical documentation and written
   permission for customer-facing display, caching/fanout, retention, and simulated execution.
   If any P9-001 input remains absent, keep Phase 9 blocked.

### Work completed this session

- Added the TradingView-style indicator settings surface. The terminal header now exposes `ƒx
Studies`; its accessible window allows the three supported studies to be shown/hidden and their
  periods, colors, and (for Bollinger Bands) deviations to be changed as a draft. `Apply changes`
  is required before the canvas redraws; invalid values are bounded client-side, and Cancel/Escape
  preserves the previous applied configuration. This changes chart presentation only and cannot
  influence the simulator's authoritative orders, positions, P&L, or risk decisions.
- Built the professional chart drawing layer for the browser terminal. The left workstation rail
  provides select/edit, trend line, horizontal ray, rectangle zone, long-plan, short-plan, and
  measurement tools. Drawings render from chart time/price coordinates; selected drawings can move
  or have endpoints adjusted, and `Delete`/`Backspace` and `Escape` provide keyboard control. The
  rail becomes a compact horizontal strip at narrow widths. Drawings are validated, bounded local
  browser annotations keyed by account and symbol; they do not create orders or alter the durable
  simulator ledger, position, or risk state.
- Fixed a local Docker runtime-switch authentication issue affecting terminal orders. The Docker
  web process had a different session-signing secret from the prior host-run process, so an otherwise
  valid browser session was rejected by the authoritative order action and redirected away from the
  station. `docker-compose.production.yml` now injects the stable root `.env` `NEXTAUTH_SECRET`,
  mirroring one secret-manager value across production web replicas. The container environment
  template no longer suggests a competing secret. A terminal-ticket regression test confirms the
  quote Buy/Sell controls select a side without submitting the form.
- Installed and started Docker Desktop, then added `docker-compose.production.yml` for an isolated
  production-shaped local stack.
- Added `.env.container.example` and a locally ignored `.env.container.local`. The environment is
  explicitly mock-only and addresses PostgreSQL/Valkey by Compose service DNS, never host ports.
- Put web, realtime, worker, migration/seed, PostgreSQL, and Valkey in the new Compose stack.
  PostgreSQL and Valkey are network-only; web (`3000`) and realtime (`3001`) are the only
  host-published application ports.
- Made migration deploy plus the idempotent development seed a one-shot prerequisite for web,
  realtime, and worker startup.
- Hardened the production web image: build-time runtime configuration, OpenSSL, Next standalone
  serving bound to `0.0.0.0`, static asset copying, and the Prisma native query engine are included.
  Realtime and worker images now include OpenSSL too.
- Corrected the quote-cache round-trip unit test to use a controlled fixture clock rather than the
  wall clock; production quote-staleness behavior is unchanged.
- Recorded the TraderMade offer and its missing approvals in
  `11_TRADERMADE_TRIAL_ACTIVATION.md`, including the exact vendor follow-up and a staged
  activation runbook.
- Added the fail-closed `MARKET_DATA_SOURCE` environment gate. Only `mock` parses; an attempt to
  configure an unimplemented source, including `tradermade`, fails before a service starts.
- Upgraded the browser terminal into a focused charting workspace: browser full-screen mode,
  server-computed per-position executable mark/average entry/live P&L/pips, 4h/1d timeframes,
  SMA 20/EMA 50/Bollinger overlays, price-level/measurement/reset controls, and on-chart draggable
  SL/TP handles. Protection drops call the existing owner-checked server action and remain subject
  to simulator-side quote/placement validation and audit recording.
- Kept all real-provider and real-payment work deferred. The running stack uses deterministic mock
  quotes, PostgreSQL-backed mock candles, and mock payment flows only.

### Verification results

- M-008: `pnpm format`, `pnpm typecheck`, and `pnpm lint` passed. `pnpm test` passed 110 runnable
  tests in 42 files (36 database integration tests skipped because PostgreSQL remains internal to
  this production-shaped local stack). The Docker web production build passed and the recreated
  service returned HTTP 200 from `/api/health/ready`.
- M-007: `pnpm format`, `pnpm typecheck`, and `pnpm lint` passed. `pnpm test` passed 105 runnable
  tests in 40 files (36 database integration tests skipped because PostgreSQL remains internal to
  this production-shaped local stack). The production web build passed; the Docker web image was
  rebuilt and the recreated web service returned HTTP 200 from `/api/health/ready`.
- M-006: `pnpm format`, `pnpm typecheck`, and `pnpm lint` passed. `pnpm test` passed 102 runnable
  tests in 39 files (36 database integration tests skipped because PostgreSQL remains internal to
  this production-shaped local stack). `docker compose -f docker-compose.production.yml config -q`
  passed and recreating the web service returned HTTP 200 from `/api/health/ready`.
- `pnpm format`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `RUN_DATABASE_TESTS=true pnpm test` with the local PostgreSQL `DATABASE_URL`: all 127 tests passed
  (48 test files) before the activation-gate change; the focused `packages/shared/src/env.test.ts`
  passed after it (3 tests).
- Terminal workspace quality: `pnpm format`, `pnpm typecheck`, and `pnpm lint` passed; `pnpm test`
  passed 101 tests in 39 files, with 36 database integration tests skipped because this Docker
  environment intentionally does not expose PostgreSQL to the host test runner.
- The final production-shaped Docker rebuild uses the updated web image; migration/seed completed,
  and PostgreSQL, Valkey, web, realtime, worker, host web/competitions, and all readiness endpoints
  passed.
- `docker compose -f docker-compose.production.yml config -q`: passed
- all eight tracked migrations and the idempotent seed completed in the migration container
- PostgreSQL, Valkey, web, realtime, and worker Docker health/readiness checks passed
- host smoke checks returned HTTP 200 for `/`, `/competitions`, web liveness/readiness, and realtime
  liveness/readiness; worker readiness returned 200 internally
- the rebuilt worker explicitly reports `MARKET_DATA_SOURCE=mock`
- the web standalone bundle contains the correct Prisma query engine and serves database-backed
  `/competitions` successfully
- GitHub Actions run `32554756501` remains the latest service-backed CI run and passed all 127 tests
  plus the production build

### Local runtime

- The production-shaped stack is currently running under Docker Compose. Use
  `docker compose -f docker-compose.production.yml ps` to inspect it.
- The root `.env` is now the single local source for `NEXTAUTH_SECRET`; preserve that secret when
  restarting or rebuilding the Docker web service. A browser session created before this fix with
  the obsolete container-only secret must sign in once again.
- Web: `http://localhost:3000`; realtime health: `http://localhost:3001/health/ready`.
- Worker remains internal by design; inspect it with
  `docker compose -f docker-compose.production.yml exec worker node -e "fetch('http://localhost:3002/health/ready').then(async response => { console.log(await response.text()); process.exit(response.ok ? 0 : 1) })"`.
- Stop the production-shaped local stack with `docker compose -f docker-compose.production.yml down`.
  Add `--volumes` only when deliberately deleting its local PostgreSQL data.
- The earlier base `docker-compose.yml` is still available for host-run development processes. It is
  separate from the new production-shaped stack and owns the host PostgreSQL/Valkey ports.

### Exact next task

P9-001 — obtain TraderMade's official streaming and historical-candle documentation, credential and
rate-limit terms, and documentary commercial approval for customer-facing display, caching/fanout,
retention, and simulated execution. Do not implement an adapter until all are supplied.

### Important blockers

- TraderMade offered pricing and a trial, but no payment link, official documentation, or commercial
  approval has been supplied.
- Commercial display, redistribution/cache/fanout, retention, and simulated-execution rights are not
  confirmed.
- Final production trading rules, prize/legal wording, KYC timing, SVG legal opinion, and
  NOWPayments merchant acceptance remain pending.

### Do not start yet

- any real market-data adapter, stream, or upstream historical-candle request
- NOWPayments production integration
- DigitalOcean production deployment
- funded accounts, live brokerage execution, MT4/MT5, profit splits, or customer trading deposits
