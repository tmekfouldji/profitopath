# Session Handoff

Codex must rewrite this file at the end of every substantial work session.

## Current handoff

Phase 0 through Phase 8 are complete. The production-shaped environment and advanced trading terminal
are integrated with the M-009 control-room visual refresh and the M-010 hydration-boundary fix. M-011
hardened authentication and session handling. M-012 added a first-party chart command menu. Phase 9 remains blocked at P9-001: TraderMade's trial
pricing is not documentation or written commercial authorization for customer-facing market data.

### Integrated work

- Production-shaped Docker Compose runs migration/seed, PostgreSQL, Valkey, web, realtime, and worker
  services with mock-only market data and service-DNS dependencies. Images use OpenSSL, Next
  standalone serving, static assets, Prisma's engine, and the shared root-environment session secret.
- The browser terminal includes full-screen mode, server-computed position metrics, studies, drawings,
  measurement tools, persisted browser-only annotations, and server-validated draggable SL/TP
  controls. The M-012 menu opens via right-click or `Shift+F10` at the current chart price/time and
  explains/selects the actual available drawing and measurement tools. It can add a local horizontal
  ray at that point and offers local view, visibility, repeat-drawing, and drawing-management controls;
  it cannot create orders or change server-authoritative state. The M-009 visual system applies across public, authentication, competition, dashboard,
  leaderboard, administrative, and terminal surfaces without changing server authority.
- M-011 fixed callback continuation: login and registration retain only one validated root-relative
  protected destination. Repeated or unsafe callbacks cannot crash the form or redirect externally.
  Successful credential navigation requires a confirmed Auth.js result.
- Failed credentials are limited by hashed email/network Valkey keys (five and 25 failures in 15
  minutes by default), create privacy-safe `SIGN_IN_FAILED` audits, and fail closed if Valkey is down.
- Realtime upgrades and 60-second batch revalidation require current active-user ownership rather than
  trusting a stale JWT claim. The Docker web image now copies Prisma's engine into the actual
  standalone lookup path used by database-backed route bundles.
- `11_TRADERMADE_TRIAL_ACTIVATION.md` remains the real-provider gate. `12_AUTH_SESSION_HARDENING.md`
  records the remaining public-production authentication setup and lifecycle work.

### Verification status

- The remote M-009/M-010 integration passed browser visual QA at 1440px and 390px, formatter,
  Prisma validation/generation, typecheck, lint, all 146 database-backed tests, and production build.
- The combined M-009/M-010/M-011 branch passed formatter, typecheck, lint, `pnpm build`, and 126
  runnable tests in 47 files. Twelve database integration files (36 tests) remain skipped because
  the production-shaped local stack deliberately keeps PostgreSQL network-only.
- The M-011 Docker web image built successfully. Its engine is present in both standalone lookup
  paths; readiness and database-backed `/competitions` return 200; the repeated-callback login URL
  returns 200; and a disposable registration/login/session smoke test returned 201/200/active.
- M-012 passed formatter, web typecheck, lint, five focused menu/component integration tests, a full
  test run, and production build. The rebuilt production-shaped Docker web service is healthy; the
  browser smoke opened the menu through a real right-click and verified its horizontal-ray command
  creates only one browser-local drawing.

### Local runtime

- `docker-compose.production.yml` is running: web is `http://localhost:3000`; realtime health is
  `http://localhost:3001/health/ready`. Worker, PostgreSQL, and Valkey remain internal.
- The root `.env` is the local source for `NEXTAUTH_SECRET`; do not commit local secrets or vendor
  credentials. The base `docker-compose.yml` is a separate host-run development option.

### Start next session by

1. Read `AGENTS.md`, README, project-state files, architecture/deployment/candle docs,
   `11_TRADERMADE_TRIAL_ACTIVATION.md`, and `12_AUTH_SESSION_HARDENING.md`.
2. Inspect Git status and the Docker stack, then rerun the complete quality gate if it was not
   completed after the M-010/M-011 rebase.
3. Preserve the M-009 visual system and the M-005/M-007/M-008/M-012 terminal behavior when extending a
   route. Keep authentication fail-closed and browser operations non-authoritative.
4. Do not begin real provider work unless P9-001 receives official documentation and written approval
   for customer display, cache/fanout, retention, and simulated execution.

### Exact next task

P9-001 — obtain TraderMade's official streaming/historical documentation and written commercial
approval for customer-facing display, caching/fanout, retention, and simulated execution. Do not
implement an adapter until every required item is supplied and recorded.

### Do not start yet

- real market-data adapter work or upstream-provider requests
- NOWPayments production integration
- DigitalOcean production deployment
- funded accounts, brokerage execution, profit splits, or customer trading deposits
