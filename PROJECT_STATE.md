# Project State

This file is the authoritative high-level state for Codex.

## Current status

- Product: weekly simulated trading competitions only
- Trading platform: first-party browser simulator
- Repository: single GitHub monorepo
- Cloud target: DigitalOcean
- Payment target: NOWPayments, later phase
- Legal/company working assumption: SVG Business Company, final approval pending
- Current implementation phase: **Phase 9 — Real market-data provider (blocked on provider approval)**
- Production deployment: not started
- Production-shaped local Docker environment: complete and verified
- Real market-data integration: not started
- Real payment integration: not started

## Active milestone

Phase 0 through Phase 8 are complete. On 24 August 2026, TraderMade offered pricing and a paid,
seven-day refundable trial, but stated that commercial terms can be discussed after testing. The reply
does not supply official API documentation or confirm rights for customer-facing chart display,
caching/fanout, or simulated execution. Phase 9 therefore remains blocked. Mock market data remains
active; no real provider is authorized.

## Phase 0–1 completion evidence

- pnpm monorepo initialized
- apps/packages skeleton exists
- local Postgres + Valkey through Docker Compose
- Prisma configured
- all initial domain entities/states implemented
- audit trail foundation implemented
- seeds implemented
- tests for states/money/decimals/persistence pass
- lint/typecheck/tests pass
- GitHub Actions CI passes
- README contains exact local commands
- TASKS / PROJECT_STATE / SESSION_HANDOFF updated

All items above are complete, including the service-backed GitHub Actions run.

## Definition of done for Phase 2

- Auth.js-compatible registration, login, logout, and session foundation
- trader dashboard shell
- admin RBAC shell with server-side authorization
- competition list/detail pages backed by persisted data
- empty trading-terminal route protected by account ownership
- authentication/authorization tests
- formatter, typecheck, lint, tests, build, and GitHub Actions pass
- project memory and handoff updated

## Phase 2 completion evidence

- Auth.js-compatible Prisma account/session/token models and isolated password credentials
- salted scrypt password hashing, normalized registration, and generic credential failures
- typed JWT sessions with database-refreshed role/status revocation
- registration, login, logout, trader dashboard, and server-side admin RBAC
- persisted competition list/detail pages and deterministic next-week development seed
- account-owned terminal shell with no client-authoritative trading operations
- responsive weekly trading-desk UI verified at desktop and 390px mobile widths
- unit coverage for passwords, registration, money formatting, and authorization
- PostgreSQL integration coverage for the authentication relation graph and weekly seed
- GitHub Actions passed migration deploy, seed, Compose validation, all 20 tests, and build

## Phase 3 completion evidence

- deterministic signed `MockPaymentProvider` behind the provider-neutral interface
- authenticated tier selection, mock checkout, confirmation, dashboard completion, and admin view
- persisted checkout URL/expiry and immutable provider-event receipt migration
- exact-amount payment validation and provider-scoped event idempotency
- PostgreSQL advisory-lock serialization for concurrent duplicate provider events
- one-transaction payment confirmation, entry activation, account provisioning, initial ledger, and
  correlated audit writes
- unit and PostgreSQL coverage for eligibility, retries, ownership, amount mismatch, concurrent
  duplicates, exact starting balance, ledger idempotency, and invalid terminal transitions
- GitHub Actions passed migration deploy, seed, Compose validation, all 30 tests, and build

## Phase 4 completion evidence

- normalized quote validation and deterministic mock quote replay with server-owned subscriptions
- versioned exact EURUSD/GBPUSD development instrument configurations and idempotent seeds
- Decimal-only spread, fill, netting, realized/unrealized P&L, margin, equity, and free-margin math
- PostgreSQL-authoritative market orders, executions, positions, closed trades, balance ledger,
  snapshots, drawdown breaches, and correlated audit events
- account-level transaction serialization plus client-order, engine-event, and quote idempotency
- static initial-balance development drawdown enforcement at the exact configured boundary
- restart recovery from PostgreSQL and an opt-in worker-owned deterministic mock feed
- local non-database tests and production build passed; GitHub Actions run `32550183420` passed the
  migration, seed, Compose validation, all 50 tests, and production build

## Phase 5 completion evidence

- durable limit/stop and linked full-position SL/TP orders with OCO and trigger quote metadata
- versioned UTC 24x5 development market hours and exact executable bid/ask trigger policies
- account-serialized, replay-safe quote triggers with deterministic limit/gap fill behavior
- idempotent cancellation and terminal-state-safe trigger/cancel race handling
- protection quantity reconciliation on net reductions/increases and atomic cleanup on close/reverse
- active pending/protective order recovery, offline worker trigger-before-risk processing, and cutoff
  expiry
- GitHub Actions run `32550829142` passed migration deploy, seed, Compose validation, all 62 tests,
  and production build

## Phase 6 completion evidence

- exact PostgreSQL mock candle persistence, idempotent weekday-aligned 1m history, and complete
  Decimal 5m/15m/1h aggregation with deterministic UTC buckets and range coalescing
- rebuildable Valkey quotes with expiry/staleness enforcement, monotonic worker sequences,
  server-owned forming/final candle publication, and no closed-market mock publication
- ownership-scoped terminal snapshots/candle APIs and authoritative market/limit/stop/cancel/SL/TP
  server actions that fail closed without a current quote
- authenticated account WebSocket upgrades, snapshot-before-delta resync, typed quote/candle
  envelopes, stale/offline execution states, and reconnect handling
- responsive Lightweight Charts terminal with bounded older-range loading, historical/live dedup,
  persistent execution markers, risk rail, account metrics, order ticket, positions, pending orders,
  executions, closed trades, and fictitious-capital disclosure
- direct unit, API/action, browser-component, Valkey-boundary, and PostgreSQL integration coverage
- GitHub Actions run `32552180252` passed migration deploy, seed, Compose validation, all 83 tests,
  and production build

## Phase 7 completion evidence

- versioned exact eligibility/ranking with tier isolation, every proposed tie break, true shared
  ranks, stable display fallback, and retained PostgreSQL cutoff inputs
- serialized exact-UTC activation/cutoff under competition/account locks, accepted-order expiry,
  authoritative last-snapshot capture, account/entry completion, and restart-safe replay
- PostgreSQL-only live/frozen recompute, canonical SHA-256 results, immutable standings, concurrent
  duplicate finalization safety, and frozen-to-finalized audit transition
- server-authorized lifecycle/recompute/finalize/archive controls plus reason-required active/frozen
  disqualification that preserves cutoff evidence and changes only eligibility
- public live/frozen/final/archive tier boards with safe display identity and UTC/policy/hash
  provenance, plus authenticated trader eligibility/rank/tie/performance/drawdown projections
- PostgreSQL-discovered worker cycles with cross-replica locks, local overlap prevention, retry after
  restart, and opt-in auto-finalization while the unapproved review duration keeps it off by default
- unit, action, browser-render, concurrency, PostgreSQL persistence, archive, lifecycle-boundary, and
  worker-recovery coverage
- GitHub Actions run `32554024772` passed migration deploy, seed, Compose validation, all 115 tests,
  and production build

## Phase 8 completion evidence

- forward-only prize-operations migration with immutable standing/finalization/hash provenance,
  explicit winner and KYC reviews, separate approval actors, reconciliation evidence, and durable
  single-use free-entry entitlements without a monetary/customer balance
- competition-serialized idempotent derivation from preconfigured development prize rows only;
  missing awards fail closed and true tied prize ranks remain unresolved without changing economics
- audited winner confirmation/rejection, manual KYC state graph, exact prize-to-payout creation,
  second-administrator payout approval, and amount/currency mismatch rejection
- manual payout processing, failure/retry/cancellation, unique transaction-reference recording,
  immutable paid state, second-actor reconciliation, and atomic fifth-place credit issuance with no
  provider call
- ADMIN-only prize operations console plus ownership-scoped trader prize/credit state that omits
  internal transaction/audit evidence and labels all company-funded/manual development limitations
- unit, authorization/action, browser-render, concurrency, PostgreSQL persistence/ownership,
  missing/tied/mismatch/duplicate-reference, reconciliation, audit, and credit coverage
- GitHub Actions run `32554756501` applied all eight migrations and passed Compose validation,
  formatter, typecheck, lint, all 127 tests, and production build

## Last completed task

M-015 — Chart-only fullscreen workspace mode.

## Next task

P9-001 — obtain TraderMade's official streaming/historical API documentation and documentary
confirmation of commercial customer-facing display, caching/fanout, retention, and simulated-
execution rights. The 24 August pricing/trial email alone does not meet this gate; do not invent or
integrate an API.

## Quality status

- `pnpm format`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `RUN_DATABASE_TESTS=true pnpm test`: all 146 tests passed locally across 54 test files
- `pnpm build`: passed
- `pnpm db:validate` / `pnpm db:generate`: passed
- all eight migrations, idempotent seed, PostgreSQL 17 readiness, and Valkey readiness passed locally
- `docker compose -f docker-compose.production.yml config -q`: passed
- production-shaped Compose startup: migrations/seed completed before the application services;
  PostgreSQL, Valkey, web, realtime, and worker health checks passed; host web and competitions
  smoke routes returned HTTP 200
- TraderMade activation gate: formatter, typecheck, lint, and the focused shared-environment tests
  passed; the rebuilt Compose stack is healthy and its running worker confirms
  `MARKET_DATA_SOURCE=mock`
- terminal workspace upgrade: formatter, typecheck, lint, and all 101 runnable tests passed (36
  database integration tests are skipped without a host-exposed test database); the full-screen,
  indicator, exact position-metric, and server-validated chart-protection paths have focused
  coverage; the updated production-shaped Docker image and all service/host smoke checks passed
- terminal order continuity: the production-shaped Compose stack now injects one stable local
  `NEXTAUTH_SECRET` from root `.env`, so a `localhost:3000` session remains valid after switching
  from the host-run app to Docker. The quote-side non-submission regression test, formatter,
  typecheck, lint, all 102 runnable tests, Compose validation, and recreated web readiness check
  passed.
- professional chart drawings: browser-only, account/symbol-scoped annotations now provide a
  select/edit rail, trend lines, horizontal rays, rectangle zones, long/short target-and-stop plan
  visualizations, and measurement. The validated local schema bounds saved drawings while preserving
  the simulator's server-owned order/risk boundary. Formatter, typecheck, lint, all 105 runnable
  tests, the production build, rebuilt Docker image, and recreated web readiness check passed.
- indicator settings: the professional `ƒx Studies` dialog provides per-study visibility, lengths,
  line colors, and Bollinger deviations with draft/apply/cancel/reset behavior and bounded client
  validation. Applied settings drive the existing server-supplied candle overlays only; they cannot
  affect any order, position, or risk decision. Formatter, typecheck, lint, all 110 runnable tests,
  production image build, and recreated Docker web readiness check passed.
- authentication/session hardening: safe callback normalization prevents repeated or external callback
  failures; login and registration preserve a valid protected destination; credential failures are
  rate-limited in Valkey with hashed identifiers and audited; realtime periodically revokes inactive
  users; and the web standalone image now carries Prisma's engine at its dependency lookup path.
  Formatter, typecheck, lint, all 126 runnable tests, Docker production build, duplicate-callback,
  disposable registration/login/session, readiness, and database-backed route smoke checks passed.
  `12_AUTH_SESSION_HARDENING.md` records the deferred public-production account-lifecycle work.
- chart command menu: the first-party Lightweight Charts terminal now provides a keyboard-accessible
  right-click command menu at the chart's actual price/time. It describes and exposes the supported
  selection, trend, horizontal-ray, rectangle, long/short-plan, and measurement tools; adds local
  grid/last-price/visibility/repeat-drawing/view management; and preserves the browser-only drawing
  boundary. The five focused menu tests, formatter, typecheck, lint, full test run, production build,
  production Docker rebuild/readiness, and browser right-click/horizontal-ray smoke check passed.
- compact chart command menu: the right-click menu is now a narrow, dark, single-line command surface
  that preserves chart context. Drawing tools and chart settings open in small nested panels, with
  contextual tooltips, keyboard back/Escape behavior, and the existing browser-only authority boundary.
  Formatter, web typecheck, lint, six focused component/integration tests, production Docker rebuild and
  readiness, and real-browser visual checks of the main and drawing panels passed.
- future chart drawing space: the terminal reserves a 16-bar right margin and maps empty right-side
  logical coordinates to interval-aligned future timestamps. Trend lines, zones, and risk/reward plans
  can now be created or edited past the latest candle; saved future annotations map back to that space
  and remain browser-only. Formatter, web typecheck, lint, focused unit/component coverage, production
  Docker rebuild/readiness, and a real-browser future-margin visual check passed.
- chart-only fullscreen: the chart toolbar now has an independent Fullscreen API control that expands
  only the chart panel to the viewport. Chart timeframes, studies, drawing tools, annotations, position
  levels, context menu, and chart controls remain available; Escape or the exit control returns to the
  normal terminal without affecting the existing whole-terminal fullscreen mode. Formatter, web
  typecheck, lint, nine focused tests, production Docker rebuild/readiness, and live browser enter/exit
  verification passed.
- GitHub Actions CI run `32554756501`: passed migration deploy, seed, Compose validation, all 127
  tests, and production build
- local browser visual QA passed for the home, competition discovery/detail, dashboard, and live
  terminal at 1440px desktop and 390px mobile widths with no page-level horizontal overflow
- post-integration browser smoke passed for home, competitions, dashboard, and the provisioned
  advanced terminal; studies, drawing tools, and order ticket rendered with no console warnings or
  errors after the deterministic hydration-clock fix

## Maintenance completion evidence

- established a cohesive midnight-blue, lap-blue, amber, and coral control-room design system with
  shared rounded surfaces, focus treatment, responsive navigation, status language, and data styling
- expanded the home experience into an explanatory competition journey with the five-session week,
  four-step lifecycle, tier comparison, and explicit simulated/server-owned/result assurances
- improved competition discovery, tier selection, standing provenance, authentication guidance, and
  trader-dashboard orientation without changing persisted data or server authority
- aligned terminal chart colors with the product palette and fixed visually hidden order-type radio
  controls that could expand the terminal beyond the viewport
- preserved keyboard focus and reduced-motion behavior and verified the dense terminal at desktop
  and mobile widths

## Blockers

- starting simulated balance per tier is not finally approved
- exact drawdown semantics not finally approved
- TraderMade offered pricing/a paid trial, but commercial terms, official documentation, and required
  client-display/redistribution/simulated-execution rights are not approved or integrated
- official provider API documentation and commercial-use/redistribution approval not supplied
- NOWPayments merchant acceptance not completed
- SVG legal opinion not completed

The market-data selection/documentation/rights blocker prevents Phase 9 implementation under the
repository provider rules. Do not infer an API, scrape a provider, or present unapproved data as
commercially usable. Phase 10 NOWPayments and Phase 11 DigitalOcean production work also remain
explicitly deferred.
