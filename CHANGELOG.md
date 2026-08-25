# Changelog

## Unreleased

### Project direction

- Weekly competitions only.
- First-party browser simulator.
- DigitalOcean deployment target.
- NOWPayments planned for later production checkout.
- Persistent Codex project-memory workflow added.

### Repository foundation

- Added a strict pnpm TypeScript monorepo with web, realtime, worker, and shared domain packages.
- Added local PostgreSQL/Valkey Compose services, deployable Dockerfiles, typed configuration,
  structured logging, liveness/readiness probes, and GitHub Actions CI.
- Added exact local development, migration, seed, test, build, and container commands.
- Made the standalone seed load the repository-root development environment automatically, corrected
  the web/realtime/worker health-route documentation, and verified all 127 tests against local
  PostgreSQL 17 and Valkey services.
- Moved terminal action-state initialization out of the server-only module so the live order ticket
  hydrates safely before its first submission; verified the complete provisioned terminal in-browser.
- Integrated the production-shaped terminal/chart upgrade with the race-week visual refresh, resolved
  their project-memory task collision, and made the terminal week-progress clock deterministic across
  server rendering and client hydration.
- Added a production-shaped local Compose stack: isolated web, realtime, worker, migration/seed,
  PostgreSQL, and Valkey services; only web/realtime ports are host-published, and application
  services wait for migration deploy and the idempotent development seed.
- Added a local-only container environment template and hardened deployable images with OpenSSL,
  Next standalone serving, an included Prisma query engine, and in-container readiness probes.
- Made the quote-cache round-trip test use a controlled clock so it cannot become stale during the
  day.
- Added a fail-closed `MARKET_DATA_SOURCE=mock` gate and a TraderMade trial activation runbook;
  pricing/trial correspondence alone cannot enable a provider feed or client-facing data.
- Upgraded the simulated trading station with full-screen mode, exact live per-position marks and
  P&L, average entry and pip display, indicator overlays, chart price-level/measurement tools, and
  drag-to-edit server-validated SL/TP controls.
- Kept local terminal orders in the station across the host-to-Docker runtime switch by using one
  stable `NEXTAUTH_SECRET` for `localhost:3000`; quote Buy/Sell controls are covered as side
  selection only and cannot submit the ticket themselves.
- Added a professional chart drawing rail: selectable/movable trend lines, horizontal rays,
  rectangle zones, long/short risk-reward plans with adjustable target/stop handles, measurement,
  keyboard deletion, and per-account/symbol browser persistence. These analytical annotations are
  deliberately non-authoritative and cannot create or modify simulated trades.
- Added a compact `ƒx Studies` parameter window for simple/exponential moving averages and
  Bollinger Bands, including show/hide controls, bounded period/deviation validation, line colors,
  applied-setting labels, cancel, and defaults reset.
- Added a TradingView-inspired chart command menu: right-click or `Shift+F10` now exposes the
  chart's supported drawing and measurement tools with plain-language descriptions, places a
  horizontal ray at the selected chart price, and provides safe local view/visibility/drawing
  controls. It is a first-party Lightweight Charts feature; no TradingView Charting Library or
  client-authoritative trading action was added.
- Refined that command menu into a narrow, dark, TradingView-style surface with grouped single-line
  commands and nested Drawing tools and Chart settings panels. Tool explanations are available as
  tooltips instead of obscuring the chart; keyboard back/Escape and the browser-only authority boundary
  remain intact.
- Added a 16-bar right-side chart margin and future-time coordinate mapping, so browser annotations can
  be placed and edited past the latest loaded candle. Those future drawing points persist locally and
  transition naturally to normal chart coordinates when matching candle data arrives.
- Added a dedicated chart-only full-screen mode. It expands the chart panel—not the full terminal—and
  preserves the chart's studies, drawings, context menu, and protected position levels until Escape or
  the chart exit control is used.
- Added a default-off Chart settings toggle for live chart Buy/Sell quote selectors. They synchronize the
  selected side with the order ticket and remain unavailable without a live quote; only the ticket's
  explicit submit can call the server-authoritative simulated-order command.
- Moved applied-study labels into a compact, color-matched chart-pane legend at the top-left, showing
  each configured study and its latest value while retaining the Studies dialog for parameter changes.
- Made chart studies selectable from either their legend row or plotted line, with a visible selected state,
  emphasized line, and direct per-study settings control.
- Replaced the fixed one-per-type study controls with up to 12 independently configurable SMA, EMA, and
  Bollinger Band instances, including distinct default colors, per-instance removal, and separate legend
  entries.
- Kept browser-only drawing overlays locked to their time/price anchors while the chart is panned or
  zoomed. Logical-range changes and drag/wheel viewport interactions now reproject SVG coordinates once
  per animation frame without changing stored drawing anchors or simulated trading state.

### Database and domain

- Added the initial PostgreSQL/Prisma domain ledger for users, weekly competitions, entries,
  trading accounts, orders, executions, positions, closed trades, balance entries, snapshots,
  breaches, payments, prizes, payouts, leaderboard finalizations, and audit events.
- Added explicit validated state graphs and an atomic state-transition/audit service boundary.
- Added an idempotent Rookie/Trader/Elite seed with configurable development starting balances.
- Added exact integer/decimal money helpers plus unit and PostgreSQL persistence tests.
- Verified the initial migration, idempotent seed, Compose configuration, and all 11 tests against
  PostgreSQL/Valkey service containers in GitHub Actions.

### Authentication and application shell

- Hardened authentication continuation and session handling: login/registration retain only one
  validated internal callback route; repeated, external, protocol-relative, and backslash callbacks
  safely fall back to the dashboard; credential client navigation now requires a confirmed Auth.js
  result.
- Added privacy-preserving failed-login throttling using Valkey keys hashed from the normalized email
  and client network, fail-closed Valkey handling, and failed-sign-in audit records without plaintext
  login identifiers.
- Added current-active-user checks at realtime upgrade plus batch WebSocket revalidation, and copied
  Prisma's native engine into the actual Next standalone dependency lookup path used by
  database-backed authenticated route bundles.
- Added `12_AUTH_SESSION_HARDENING.md` with the remaining production setup, monitoring, email,
  password-lifecycle, MFA, and isolated end-to-end test requirements.
- Added Auth.js-compatible account, session, verification-token, and password-credential models
  with a forward-only Prisma migration.
- Added salted scrypt credential hashing, normalized registration, typed sessions, immediate
  database-backed role/status revocation, server-side authorization, and authentication audits.
- Added registration, login, logout, protected trader dashboard, admin control-room shell,
  persisted competition pages, and an account-owned empty terminal boundary.
- Added a deterministic upcoming weekly competition seed plus auth, authorization, money-format,
  and PostgreSQL relation-graph coverage.
- Introduced a responsive weekly trading-desk visual system and verified it at desktop and mobile
  widths with keyboard-focus and reduced-motion support.
- Refreshed the product around a modern race-week control-room identity with responsive navigation,
  clearer action language, softer information surfaces, a unified terminal/chart palette, and
  product-wide status styling.
- Expanded the public home into an explanatory competition journey covering the weekly sequence,
  order/risk lifecycle, tier comparison, simulated-only boundaries, and auditable result model.
- Added trader dashboard orientation metrics, clearer competition/tier descriptions, a standings
  explainer, registration guidance, and direct “Open trading terminal” action language.
- Fixed visually hidden terminal order-type radio controls so they cannot create horizontal viewport
  overflow; verified public and authenticated journeys at 1440px and 390px widths.
- Verified the Auth migration, deterministic seed, all 20 tests, and production build against
  PostgreSQL/Valkey service containers in GitHub Actions.

### Mock payments and entry provisioning

- Added a deterministic, signed `MockPaymentProvider` with idempotent checkout creation, callback
  verification, payment lookup, and isolated signing configuration.
- Added durable provider-event receipts, checkout expiry/URL persistence, provider-scoped event
  uniqueness, normalized payload hashes, and a forward-only Prisma migration.
- Added exact-amount, transactionally audited payment processing that activates one competition
  entry, provisions one simulated trading account, and writes one initial-balance ledger record.
- Added authenticated mock checkout, dashboard completion feedback, and protected admin payment /
  provisioning visibility without integrating a real payment provider.
- Added unit and PostgreSQL integration coverage for eligibility, checkout retries, ownership,
  amount validation, concurrent duplicate delivery, exact account balance, ledger idempotency, and
  rollback on invalid terminal transitions.
- Verified the payment-event migration, seed, all 30 tests, concurrent event serialization, and
  production build against PostgreSQL/Valkey service containers in GitHub Actions.

### Market-data architecture

- Adopted `10_MARKET_DATA_CACHING_AND_CANDLES.md` as the future backend-owned candle/cache design,
  while keeping all real provider work deferred to Phase 9 and commercial approval.

### Mock market data and simulator core

- Added validated normalized quotes, deterministic mock quote replay, server-owned subscriptions,
  stale/order checks, and an explicit unsupported boundary for historical bars until candle work.
- Added versioned persisted EURUSD/GBPUSD development specifications with exact contract, leverage,
  precision, minimum, and quantity-step fields plus idempotent seeding and a forward-only migration.
- Added Decimal-only market fills, notional, spread, weighted entry, long/short realized and
  unrealized P&L, margin, equity, free margin, partial close, full close, and reversal calculations.
- Added a PostgreSQL-authoritative execution engine with account-level transaction locks,
  client-order and engine-event idempotency, margin rejection, atomic executions/net positions /
  closed trades/ledger/audits, monotonic snapshots, and exact static development drawdown breaches.
- Added recovery projections for active accounts/open positions and an opt-in worker-owned mock feed
  (`MOCK_MARKET_DATA_ENABLED`) that recovers before deterministic quote/risk processing.
- Added unit and PostgreSQL integration coverage for deterministic feeds, arithmetic, order retries /
  rejection, netting, exact P&L and ledgers, duplicate quotes, offline drawdown, and restart recovery.
- Verified the instrument migration, idempotent seed, all 50 tests, deterministic recovery/risk
  processing, and production build against PostgreSQL/Valkey service containers in GitHub Actions.
- Fixed positive-zero handling so zero order quantities are rejected and opening fills cannot emit
  zero-value realized-P&L ledger entries.

### Pending orders and position protection

- Added durable pending/protective-order relations, OCO groups, terminal reasons, trigger quote
  sequences/timestamps, active-scan indexes, and versioned UTC 24x5 development market hours.
- Added exact executable-side buy/sell limit and stop policies with precision validation,
  deterministic current-quote/gap fills, account-serialized triggering, and replay-safe executions.
- Added idempotent order cancellation and full-net-position stop-loss/take-profit OCO protection,
  including quantity reconciliation after manual reductions and atomic cleanup after close/reversal.
- Extended recovery with accepted pending/protective orders and changed worker quote handling to
  process order triggers before post-fill mark-to-market risk snapshots while the browser is absent.
- Added unit and PostgreSQL integration coverage for trigger directions, market hours, replay,
  margin-at-trigger expiry, cancellation, long/short OCO protection, gap fills, cutoff expiry,
  restart recovery, and trigger/cancel serialization.
- Verified the pending-order migration, idempotent seed, all 62 tests, and production build against
  PostgreSQL/Valkey service containers in GitHub Actions.

### Browser trading terminal and candles

- Added exact PostgreSQL `MarketCandle` persistence, deterministic weekday-aligned one-minute mock
  history, complete UTC higher-timeframe aggregation, concurrent range coalescing, and a
  server-owned historical/live candle handoff without adding a real provider.
- Added rebuildable Valkey quote publication with expiry/staleness enforcement, monotonic worker
  sequences, server-side forming/final candle publication, and closed-market quote suspension.
- Added account-owned market/limit/stop/cancel/protection actions plus bounded candle and complete
  terminal snapshot endpoints; all fills, margin checks, risk, and persistence remain server-owned.
- Added authenticated account-scoped WebSocket upgrades, snapshot-before-delta resync, validated
  quote/candle envelopes, stale/offline states, and reconnect behavior.
- Replaced the placeholder with a responsive Lightweight Charts trading workspace, competition risk
  rail, quote/order ticket, account metrics, position protection, pending orders, executions, closed
  trades, persistent markers, older-range loading, and explicit fictitious-capital labeling.
- Added unit and PostgreSQL integration coverage for candle aggregation/deduplication/handoff,
  coalescing, quote cache loss/staleness, live candle finalization, realtime protocols, terminal
  ownership, and ledger-marker reconstruction.

### Weekly competition and leaderboard

- Added versioned development leaderboard eligibility and exact integer ranking with tier isolation,
  the proposed performance/drawdown/score-time/activation tie-break order, true shared ranks, stable
  fallback display ordering, and explicit invalid-input rejection.
- Added durable versioned cutoff score inputs and indexed immutable finalized standings with exact
  performance/drawdown values, authoritative timestamps, tier relations, and uniqueness guards.
- Added serialized UTC activation/freeze processing with competition and simulator-account locks,
  cutoff order expiry, exact last-snapshot score capture, account/entry completion, restart-safe
  idempotency, correlated audits, and late-payment exclusion after freeze.
- Added PostgreSQL-only live leaderboard recomputation plus canonical SHA-256 final results, durable
  true-tie standings, atomic frozen-to-finalized transition/audit, and duplicate-finalization
  verification that fails closed if authoritative cutoff inputs no longer match.
- Added a server-authorized weekly control room for due lifecycle processing, authoritative
  recompute/finalization, reason-required pre-finalization disqualification, and archival. Commands
  serialize with trading/lifecycle work, retain actor audits, and never alter prize economics.
- Added public tier-separated live, cutoff-review, final, and archived leaderboard routes with
  display-safe identities, explicit UTC/policy/rules provenance, true-tie labels, resilient empty
  states, and immutable final-result hash disclosure.
- Added authenticated trader leaderboard summaries with authoritative eligibility/ineligibility,
  rank/tie, exact performance, maximum-observed-drawdown input, valuation time, competition state,
  and direct live/archive standings access without client-side score calculations.
- Added horizontally safe worker competition cycles that discover work from PostgreSQL, process due
  activation/cutoff, recompute active/frozen standings, isolate per-competition failures, retry after
  restart, and optionally invoke the idempotent finalizer while keeping auto-finalization off by
  default for administrative review.
- Extended the Phase 7 matrix with exact pre-start/pre-cutoff boundaries, concurrent finalization,
  archived public/private read-model persistence, admin failure notices, worker restart recovery,
  and browser-rendered archive/tie/provenance coverage.

### Company-funded prize administration

- Added immutable finalization/standing/hash provenance, winner-review and manual-KYC states,
  separate prize/payout approvers, manual payment/reconciliation evidence, and individually tracked
  free-entry credits in a forward-only Prisma migration.
- Added an idempotent, competition-serialized prize ledger that binds only preconfigured development
  award rows to exact final standings, refuses to invent amounts/currencies, and leaves true tied
  ranks unresolved for policy review.
- Added audited winner confirmation/rejection, KYC transitions, exact prize approval, second-admin
  payout approval, manual processing/failure/retry/cancellation/paid recording, immutable unique
  transaction references, and second-review reconciliation without a production payment provider.
- Added atomic issuance of configured fifth-place access credits after paid reconciliation; credits
  are single-use entitlements rather than money or customer stored value, and redemption is deferred.
- Added an ADMIN-only prize operations console with valid-next-action controls and a trader-owned
  prize/credit status view that withholds internal transaction/audit data and labels every manual
  company-funded limitation.
- Added unit, PostgreSQL concurrency/persistence/ownership, authorization, negative-path, and browser
  rendering coverage for the full Phase 8 workflow.

Codex should add concise entries here for meaningful completed features, migrations, infrastructure changes, and operator-visible behavior changes.
