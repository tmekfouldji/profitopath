# Session Handoff

Codex must rewrite this file at the end of every substantial work session.

## Current handoff

Phase 0 through Phase 8 are complete. The production-shaped local environment and advanced browser
terminal work from M-003 through M-008 are integrated with the product-wide race-week visual refresh,
now uniquely recorded as M-009. Phase 9 remains blocked at P9-001. TraderMade's 24 August pricing and
refundable-trial offer is not commercial permission to display or retain its data for customers, and
no real-provider adapter has begun.

### Start next session by

1. Read `AGENTS.md` and every required project-memory, architecture, deployment, candle, and
   TraderMade activation-gate file.
2. Inspect Git status, recent commits, and the latest service-backed CI run.
3. Inspect the production-shaped environment with
   `docker compose -f docker-compose.production.yml ps`; start it only when local runtime work needs it.
4. Preserve the M-009 race-week design system and the M-005/M-007/M-008 terminal behavior when
   extending a route.
5. Before provider work, obtain official streaming/historical documentation and written permission
   for customer-facing display, caching/fanout, retention, and simulated execution. Keep P9-001
   blocked while any prerequisite is missing.

### Integrated work

- Added and verified a production-shaped Docker Compose environment containing migration/seed,
  PostgreSQL, Valkey, web, realtime, and worker services. The deployed configuration remains
  explicitly mock-only and uses service DNS rather than host database/cache ports.
- Hardened deployable images with OpenSSL, Next standalone serving, static assets, Prisma's native
  query engine, and a stable root-environment `NEXTAUTH_SECRET` shared by local web replicas.
- Recorded the TraderMade pricing/trial offer and fail-closed activation checklist in
  `11_TRADERMADE_TRIAL_ACTIVATION.md`; `MARKET_DATA_SOURCE` accepts only the implemented mock source.
- Upgraded the terminal with full-screen mode, exact server-computed position metrics, 4h/1d chart
  ranges, SMA/EMA/Bollinger studies, configurable indicator settings, drawing/measurement tools,
  persistent browser-only annotations, and server-validated draggable SL/TP handles.
- Preserved the authoritative boundary: browser chart studies and drawings never create orders or
  alter positions, P&L, margin, drawdown, or durable risk state.
- Integrated the M-009 race-week control-room visual system across the public home, navigation,
  authentication, competition discovery/detail, checkout, dashboard, leaderboards, terminal, and
  administrative surfaces.
- Expanded explanatory trader content, aligned chart colors with the product palette, and fixed the
  narrow-terminal radio-control overflow while preserving keyboard focus and reduced motion.

### Verification status

- The individual remote M-003 through M-008 gates passed formatter, typecheck, lint, focused tests,
  production builds/images, and production-shaped Compose readiness checks as recorded in
  `PROJECT_STATE.md` and `TASKS.md`.
- The pre-integration M-009 visual refresh passed formatter, typecheck, lint, all 127 database-backed
  tests, production build, browser console review, and 1440px/390px visual checks.
- Combined post-merge `pnpm format`, Prisma validation/generation, typecheck, and lint passed.
- Combined `RUN_DATABASE_TESTS=true pnpm test` passed all 146 tests across 54 test files after an
  idempotent seed refreshed the mutable local competition fixture.
- Combined `NODE_ENV=production pnpm build` passed.
- Live browser smoke passed for home, competitions, dashboard, and the provisioned terminal. The
  merged studies, drawing rail, and order ticket rendered together without console warnings/errors.
- A live-only progress-bar hydration mismatch was fixed by passing one server-render timestamp into
  the client and advancing the display clock only after mount; focused workspace tests passed.

### Local runtime

- `docker-compose.production.yml` is the preferred production-shaped local stack. It publishes web
  on port 3000 and realtime on port 3001; worker, PostgreSQL, and Valkey remain internal.
- The root `.env` is the local source for `NEXTAUTH_SECRET`; do not commit local secrets or vendor
  credentials.
- The earlier `docker-compose.yml` and Homebrew PostgreSQL/Valkey services remain separate host-run
  development options. Avoid starting both database/cache stacks on the same host ports.
- The mock feed follows its configured UTC market schedule; closed-market quote suspension is
  intentional.
- The temporary host-run web/realtime/worker processes used for browser verification were stopped.

### Exact next task

P9-001 — obtain TraderMade's official streaming and historical-candle documentation, credential and
rate-limit terms, and documentary commercial approval for customer-facing display, caching/fanout,
retention, and simulated execution. Do not implement an adapter until all are supplied.

### Important blockers

- TraderMade offered pricing and a refundable trial, but no approved payment link, official API
  documentation, or commercial permission has been supplied.
- Customer display, redistribution/cache/fanout, retention, and simulated-execution rights remain
  unconfirmed.
- Final production trading rules, prize/legal wording, KYC timing, SVG legal opinion, and
  NOWPayments merchant acceptance remain pending.

### Do not start yet

- any real market-data adapter, stream, or upstream historical-candle request
- NOWPayments production integration
- DigitalOcean production deployment
- funded accounts, live brokerage execution, MT4/MT5, profit splits, or customer trading deposits
