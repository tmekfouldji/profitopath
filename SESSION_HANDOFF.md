# Session Handoff

Codex must rewrite this file at the end of every substantial work session.

## Current handoff

Phase 0 through Phase 8 are complete. The production-shaped environment and advanced trading terminal
are integrated with the M-009 control-room visual refresh and the M-010 hydration-boundary fix. M-011
hardened authentication and session handling. M-012 added a first-party chart command menu, M-013
refined it into a compact TradingView-style command surface, and M-014 added usable future chart space
for browser annotations. M-015 added chart-only fullscreen, M-016 added optional chart Buy/Sell quote
selectors, M-017 added a TradingView-style studies legend, and M-018 made those studies selectable.
Phase 9 remains blocked at P9-001: TraderMade's trial
pricing is not documentation or written commercial authorization for customer-facing market data.

### Integrated work

- Production-shaped Docker Compose runs migration/seed, PostgreSQL, Valkey, web, realtime, and worker
  services with mock-only market data and service-DNS dependencies. Images use OpenSSL, Next
  standalone serving, static assets, Prisma's engine, and the shared root-environment session secret.
- The browser terminal includes full-screen mode, server-computed position metrics, studies, drawings,
  measurement tools, persisted browser-only annotations, and server-validated draggable SL/TP
  controls. The M-013 menu opens via right-click or `Shift+F10` at the current chart price/time as a
  compact command panel. Drawing tools and display preferences use small nested panels with tooltips,
  keyboard back/Escape behavior, and the same local horizontal-ray, view, visibility, repeat-drawing,
  and drawing-management controls. The time scale reserves a 16-bar right margin and maps annotation
  points in that empty space to interval-aligned future timestamps, so future drawings persist and
  render past the newest candle; none can create orders or change server-authoritative state. The M-009 visual system applies across public, authentication, competition, dashboard,
  leaderboard, administrative, and terminal surfaces without changing server authority.
- The chart toolbar provides a separate full-screen control for the chart panel. It expands only the
  chart (including timeframes, studies, drawing tools, annotations, protected position levels, context
  menu, and chart controls), while the terminal-level full-screen control remains independent.
- Chart settings now offers a default-off Buy/Sell selector overlay. It displays only live server quotes,
  shares the selected side with the order ticket, and keeps the existing explicit ticket submission as the
  sole route to the server-authoritative simulated-order action. It is therefore present in chart-only
  fullscreen without creating an unsafe implicit one-click trade.
- Applied studies render inside the chart pane as a compact top-left legend: the configured label, line
  color, and latest computed value are shown for each moving average or Bollinger Band. The toolbar now
  retains one `ƒx Studies` settings entry rather than duplicating active-study chips.
- Each chart-study legend row is interactive and exposes a focused selected state plus a per-study gear
  button. Clicking a plotted study line uses Lightweight Charts' hit information to select its owner and
  strengthen that visual line; these interactions affect no simulator command or market-data state.
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
- M-013 passed formatter, web typecheck, lint, and six focused menu/component integration tests. The
  production-shaped Docker web service rebuilt and is healthy; real-browser visual checks confirmed the
  compact main command surface and its nested Drawing tools panel no longer use the obstructive
  explanatory layout.
- M-014 passed formatter, web typecheck, lint, and focused future-space/drawing/menu integration tests.
  The production-shaped Docker web service rebuilt and is healthy; a real-browser visual check confirmed
  the right-side future margin is present in the served terminal.
- M-015 passed formatter, web typecheck, lint, and nine focused tests. The production-shaped Docker web
  service rebuilt and is healthy; live browser checks confirmed the chart alone expands to the viewport
  and its exit control returns to the normal terminal.
- M-016 passed formatter, web typecheck, lint, 14 focused chart/ticket/workspace tests, and a production
  web build. Docker Desktop was unavailable in this session, so the running local container is the prior
  image and needs a normal Compose rebuild before visual verification of this change.
- M-017 passed formatter, web typecheck, lint, 17 focused chart/ticket/workspace tests, and a production
  web build. Docker Desktop remains unavailable, so the container needs its normal Compose rebuild before
  a live visual verification of the legend.
- M-018 passed formatter, web typecheck, lint, 18 focused chart/ticket/workspace tests, and a production
  web build. Docker Desktop remains unavailable, so it likewise requires an image rebuild for visual QA.

### Local runtime

- A prior `docker-compose.production.yml` web image remains reachable at `http://localhost:3000`, but
  Docker Desktop/the `docker` CLI was unavailable while completing M-016. Rebuild the `web` service before
  relying on it to verify the new chart selectors; realtime, worker, PostgreSQL, and Valkey remain internal.
- The root `.env` is the local source for `NEXTAUTH_SECRET`; do not commit local secrets or vendor
  credentials. The base `docker-compose.yml` is a separate host-run development option.

### Start next session by

1. Read `AGENTS.md`, README, project-state files, architecture/deployment/candle docs,
   `11_TRADERMADE_TRIAL_ACTIVATION.md`, and `12_AUTH_SESSION_HARDENING.md`.
2. Inspect Git status and the Docker stack, then rerun the complete quality gate if it was not
   completed after the M-010/M-011 rebase.
3. Preserve the M-009 visual system and the M-005/M-007/M-008/M-012/M-013/M-014/M-015/M-016/M-017/M-018 terminal behavior when extending a
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
