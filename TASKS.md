# Tasks

Codex maintains this file.

Rules:

- Keep task IDs stable.
- Mark `[ ]`, `[~]`, `[x]`, or `[!]`.
- `[~]` means in progress.
- `[!]` means blocked; include blocker.
- Add acceptance criteria under non-trivial tasks.
- Never delete completed tasks; move old completed work to the Completed section if the file becomes long.

## Completed — Phase 0

- [x] P0-001 Inspect repository, initialize Git on `main`, and confirm toolchain availability.
  - Acceptance: required kickoff documents are read, repository contents are inventoried, and missing local tools are recorded.
- [x] P0-002 Initialize the pnpm workspace and root scripts.
  - Acceptance: a frozen install succeeds and root format/typecheck/lint/test commands cover every workspace.
- [x] P0-003 Create runnable `apps/web`, `apps/realtime`, and `apps/worker` skeletons.
  - Acceptance: each application has a typed entry point or route and participates in quality checks.
- [x] P0-004 Create `packages/database`, `simulator`, `market-data`, `competition`, `payments`, `shared`, and `ui`.
  - Acceptance: packages have explicit public exports and workspace dependency boundaries.
- [x] P0-005 Configure strict shared TypeScript settings and project builds.
- [x] P0-006 Configure ESLint and Prettier for the entire repository.
- [x] P0-007 Configure Vitest with an initial deterministic test suite.
- [x] P0-008 Add Docker Compose for local PostgreSQL and Valkey.
  - Acceptance: services have health checks, named volumes, explicit development ports, and no committed secrets.
- [x] P0-009 Add `.env.example` and typed Zod environment validation.
  - Acceptance: malformed configuration fails at startup without logging secret values.
- [x] P0-010 Configure the Prisma database package and client lifecycle.
- [x] P0-011 Add a structured JSON logging foundation.
- [x] P0-012 Add liveness and dependency-aware readiness foundations.
- [x] P0-013 Add GitHub Actions CI for frozen install, format, typecheck, lint, and tests.
- [x] P0-014 Document exact local setup, startup, database, seed, and quality commands.
- [x] P0-015 Pass the Phase 0 quality gate and update persistent project memory.

## Completed — Phase 1

- [x] P1-001 Define enums/state machines.
- [x] P1-002 Model User and profile.
- [x] P1-003 Model Competition and ChallengeTier.
- [x] P1-004 Model CompetitionEntry and TradingAccount.
- [x] P1-005 Model Order.
- [x] P1-006 Model Execution.
- [x] P1-007 Model Position.
- [x] P1-008 Model ClosedTrade.
- [x] P1-009 Model balance ledger.
- [x] P1-010 Model AccountSnapshot.
- [x] P1-011 Model RuleBreach.
- [x] P1-012 Model Payment.
- [x] P1-013 Model Prize/Payout.
- [x] P1-014 Model AuditEvent.
- [x] P1-015 Implement validated state-transition services.
- [x] P1-016 Seed competition tiers with configurable starting balances.
- [x] P1-017 Unit/integration tests.
  - GitHub Actions passed all 11 tests, including PostgreSQL persistence and seed integration.
- [x] P1-018 Migrations + seed commands.
- [x] P1-019 Update docs/state/handoff.

## Completed — Phase 2

- [x] P2-001 Expand Phase 2 auth/application-shell work into acceptance-tested tasks.
- [x] P2-002 Add Auth.js-compatible Prisma models and migration.
  - Acceptance: account/session/token/credential data is relational, indexed, and stores no plaintext passwords.
- [x] P2-003 Implement password hashing and registration validation.
  - Acceptance: password hashes are salted, verification is timing-safe, email normalization is deterministic, and invalid input is tested.
- [x] P2-004 Configure credential authentication and typed sessions.
  - Acceptance: sessions expose only user ID, role, and status needed for authorization; suspended/closed users cannot authenticate.
- [x] P2-005 Implement registration, login, and logout flows.
  - Acceptance: duplicate registration is safe, mutations are server-owned/audited, and authentication failures do not reveal account existence.
- [x] P2-006 Build the responsive application shell and navigation.
  - Acceptance: public/authenticated states, keyboard focus, mobile layout, and reduced-motion behavior are supported.
- [x] P2-007 Build the protected trader dashboard.
  - Acceptance: the page reads the signed-in user's persisted entries/accounts and gives a useful empty state.
- [x] P2-008 Build persisted competition list/detail pages.
  - Acceptance: weekly windows and tier configuration come from PostgreSQL, with clear not-found/empty behavior.
- [x] P2-009 Add an account-owned empty terminal route.
  - Acceptance: account ownership is enforced server-side and the browser receives no authoritative mutation capability.
- [x] P2-010 Add the protected admin RBAC shell.
  - Acceptance: non-admin users are denied server-side and admins see persisted operational counts/recent audit events.
- [x] P2-011 Seed a deterministic development competition and add auth/RBAC integration tests.
- [x] P2-012 Pass the Phase 2 quality gate and update project memory/handoff.
  - Local formatter, schema validation/generation, typecheck, lint, production build, and
    desktop/mobile visual checks passed.
  - GitHub Actions run `32548247855` passed migration deployment, seed, Compose validation, all 20
    tests, and production build with PostgreSQL/Valkey services.

## Completed — Phase 3

- [x] P3-001 Expand mock-payment and entry-provisioning work into concrete acceptance-tested tasks.
  - Acceptance: Phase 3 has stable task IDs covering provider behavior, persistence, idempotent
    provisioning, authenticated checkout UI, operator visibility, integration coverage, and the
    quality gate without authorizing a real provider.
- [x] P3-002 Implement the deterministic `MockPaymentProvider` behind the provider-neutral contract.
  - Acceptance: checkout creation is idempotent, mock callbacks are verifiable, provider payment
    lookup is supported, and unit tests cover confirmed/failed/expired states and invalid callbacks.
- [x] P3-003 Add durable payment-event receipt persistence and a forward-only migration.
  - Acceptance: provider event IDs are unique per provider, receipts retain the normalized event
    status and payment relation, Prisma validation/generation passes, and no production provider is
    added.
- [x] P3-004 Implement idempotent mock-checkout creation for an eligible user/competition/tier.
  - Acceptance: the server validates user, competition, signup window, active tier, amount, and
    currency; retries reuse the same payment/entry; and checkout state is persisted and audited.
- [x] P3-005 Implement atomic confirmed-payment entry/account provisioning.
  - Acceptance: one verified event transactionally confirms the payment, activates its entry,
    creates one active simulated account and initial-balance ledger record, and writes correlated
    audits; duplicate delivery changes nothing and terminal payment transitions cannot regress.
- [x] P3-006 Add authenticated mock-checkout and post-payment trader flows.
  - Acceptance: a signed-in trader can select a tier, review the fictitious-capital terms, complete
    mock payment, and reach the dashboard account; ownership and server-side mutation boundaries are
    enforced, and unauthenticated users are sent through login.
- [x] P3-007 Add admin payment/provisioning visibility.
  - Acceptance: the existing protected admin shell shows recent persisted payments and their entry /
    account provisioning state without exposing provider secrets.
- [x] P3-008 Add unit and PostgreSQL integration coverage for checkout and provisioning.
  - Acceptance: tests cover checkout retries, mismatched amounts, duplicate events, exact starting
    balances, initial ledger idempotency, transition rejection, ownership, and rollback-safe audits.
- [x] P3-009 Pass the Phase 3 quality gate and update persistent project memory/handoff.
  - Acceptance: formatter, Prisma validation/generation, typecheck, lint, tests, production build,
    and applicable UI checks pass; exact local/CI limitations and the Phase 4 next task are recorded.
  - Local formatter, Prisma validation/generation, typecheck, lint, 22 non-database tests, and
    production build passed; 8 PostgreSQL tests were skipped because Docker/PostgreSQL are absent.
  - GitHub Actions run `32549129070` passed migration deployment, seed, Compose validation, all 30
    tests, and production build with PostgreSQL/Valkey services.

## Completed — Phase 4

- [x] P4-001 Expand mock-market-data and simulator-core work into concrete acceptance-tested tasks.
  - Acceptance: tasks preserve server authority, exact decimal/integer accounting, persistent
    orders/executions/positions/ledger state, deterministic mock pricing and replay, offline/restart
    recovery, and the market-data boundaries in `10_MARKET_DATA_CACHING_AND_CANDLES.md` without
    implementing historical candles early or authorizing a real provider.
- [x] P4-002 Implement validated normalized quotes and a deterministic `MockMarketDataProvider`.
  - Acceptance: seeded quote sequences are reproducible, symbol subscriptions and latest-quote
    lookup are server-owned, stale/out-of-order/invalid bid-ask data is rejected, and no browser or
    real-provider integration is added.
- [x] P4-003 Persist versioned development instrument specifications and add a forward-only migration.
  - Acceptance: symbol, currencies, contract size, quantity step/minimum, price precision, leverage,
    and version are exact and auditable; the active development set is idempotently seeded and is
    explicitly not approved production economics.
- [x] P4-004 Implement exact simulator accounting primitives.
  - Acceptance: Decimal-only fill, notional, weighted-entry, realized/unrealized P&L, margin, equity,
    and free-margin calculations have explicit rounding at the integer-minor-unit boundary and tests
    for long/short, spread, partial close, full close, and reversal.
- [x] P4-005 Implement idempotent server-side market-order submission and validation.
  - Acceptance: active account/competition window, symbol config, quantity step/minimum, quote
    freshness, and margin are authoritative server checks; a client order ID creates at most one
    persisted order and rejected orders retain a reason and audit evidence.
- [x] P4-006 Implement atomic fills and net-position lifecycle persistence.
  - Acceptance: one engine event creates at most one execution, fills its order, opens/increases /
    reduces/closes/reverses one net position, persists closed trades and realized balance ledger
    entries when applicable, and records correlated audits in one transaction.
- [x] P4-007 Implement mark-to-market snapshots and configurable static development drawdown enforcement.
  - Acceptance: server quotes produce deterministic equity, margin, unrealized P&L, and drawdown;
    exact-boundary breaches immediately persist one breach and transition the account/entry with
    audit evidence even without a browser connection.
- [x] P4-008 Implement simulator recovery and deterministic replay boundaries.
  - Acceptance: active accounts/open positions are reconstructible from PostgreSQL, duplicate quote
    and engine events are harmless, snapshot sequences remain monotonic, and derived hot state does
    not require unique local disk.
- [x] P4-009 Connect the worker-owned mock feed to simulator processing without adding live-provider work.
  - Acceptance: the worker can start the deterministic feed, process subscribed symbols, update
    server-side risk, report readiness/failure safely, and remain horizontally replaceable.
- [x] P4-010 Add unit and PostgreSQL integration coverage for the Phase 4 correctness matrix.
  - Acceptance: tests cover market order create/fill/reject, long/short and netting lifecycle, P&L,
    spread, margin, exact drawdown boundary, duplicate events, offline processing, restart recovery,
    transaction rollback, and deterministic replay.
- [x] P4-011 Pass the Phase 4 quality gate and update persistent project memory/handoff.
  - Acceptance: formatter, Prisma validation/generation, typecheck, lint, all tests, build, and
    service-backed CI pass; the exact Phase 5 task and unresolved configurable economics are recorded.
  - Local formatter, Prisma validation/generation, typecheck, lint, 37 non-database tests, and
    production build passed; 13 PostgreSQL tests were skipped because Docker/PostgreSQL are absent.
  - GitHub Actions run `32550183420` passed migration deployment, seed, Compose validation, all 50
    tests, and production build with PostgreSQL/Valkey services.

## Completed — Phase 5

- [x] P5-001 Expand pending-order, SL/TP, and cancellation work into concrete acceptance-tested tasks.
  - Acceptance: Phase 5 has stable task IDs for persisted limit/stop orders, deterministic
    server-side trigger evaluation, stop-loss/take-profit protection, cancellation races,
    idempotency/recovery, audit/history completeness, tests, and the quality gate without adding a
    real market-data provider or browser-authoritative execution.
- [x] P5-002 Add durable pending/protective-order metadata and a versioned development market schedule.
  - Acceptance: a forward-only migration relates protective orders to their position and OCO group,
    records trigger quote identity and terminal reasons, indexes active trigger scans, and stores the
    development market-hours mode on the instrument version without inventing production economics.
- [x] P5-003 Implement exact order-price and trigger-policy primitives.
  - Acceptance: limit/stop and long/short SL/TP placement/trigger rules use executable bid/ask sides,
    strict positive price precision, current-quote validation, deterministic gap fills, UTC 24x5
    development market hours, and focused unit tests.
- [x] P5-004 Implement idempotent persisted limit/stop submission and cancellation.
  - Acceptance: server validation persists one accepted or rejected order per client ID; cancellation
    is account-locked, audited, terminal-state safe, retry-idempotent, and cannot undo a fill that won
    a trigger race.
- [x] P5-005 Implement deterministic quote-triggered pending-order execution.
  - Acceptance: each normalized quote processes eligible orders in stable account/order order,
    revalidates account/window/margin inside the account lock, creates at most one execution, reuses
    Phase 4 net-position/ledger/risk semantics, records quote sequence/time, and is replay-idempotent.
- [x] P5-006 Implement full-position stop-loss/take-profit protection with OCO cancellation.
  - Acceptance: protection is server-owned and persisted as linked STOP_LOSS/TAKE_PROFIT orders;
    trigger direction is correct for long/short positions, only one sibling can fill, manual net
    changes reconcile protected quantity, and close/reversal cancels stale protection atomically.
- [x] P5-007 Extend recovery and worker-owned offline processing for active orders and weekly cutoff.
  - Acceptance: recovery includes accepted pending/protective orders, mock quote processing triggers
    orders before post-fill risk snapshots without a browser, closed-market quotes do not trigger,
    and accepted orders expire with audit evidence at competition cutoff.
- [x] P5-008 Add unit and PostgreSQL integration coverage for the Phase 5 correctness matrix.
  - Acceptance: tests cover buy/sell limit and stop, long/short SL/TP, gap prices, OCO, cancellation /
    trigger races, duplicate quotes, insufficient margin at trigger, closed market, cutoff expiry,
    offline behavior, and restart recovery.
- [x] P5-009 Pass the Phase 5 quality gate and update persistent project memory/handoff.
  - Acceptance: formatter, Prisma validation/generation, typecheck, lint, all tests, build, and
    service-backed CI pass; the exact Phase 6 browser-terminal task and remaining configurable
    economics are recorded.
  - Local formatter, Prisma validation/generation, typecheck, lint, 41 non-database tests, and
    production build passed; 21 PostgreSQL tests were skipped because Docker/PostgreSQL are absent.
  - GitHub Actions run `32550829142` passed migration deployment, seed, Compose validation, all 62
    tests, and production build with PostgreSQL/Valkey services.

## Completed — Phase 6

- [x] P6-001 Expand the browser-terminal milestone into concrete acceptance-tested tasks.
  - Acceptance: stable task IDs cover authoritative account state/commands, backend-owned mock
    candle history, live quote/account updates, chart/order/position/pending/history UI, responsive
    accessibility, reconnect/resync behavior, tests, and the quality gate without browser-owned
    trading truth or a real market-data provider.
- [x] P6-002 Implement the durable mock candle service and historical/live aggregation boundary.
  - Acceptance: PostgreSQL stores exact unique base/derived candles; deterministic mock 1m history
    seeds idempotently; finalized 5m/15m/1h bars aggregate only complete canonical UTC buckets;
    identical range loads coalesce; ordering/pagination are deterministic; no real provider or fake
    fallback is introduced; and the service follows `10_MARKET_DATA_CACHING_AND_CANDLES.md`.
- [x] P6-003 Add shared hot quote publication and server-side terminal command adapters.
  - Acceptance: the worker publishes validated normalized mock quotes to rebuildable Valkey state;
    authenticated web commands read server quotes, re-check account ownership, call the simulator
    for market/limit/stop/cancel/protection actions, and fail closed when quotes are absent/stale.
- [x] P6-004 Implement the account-owned terminal read model and backend candle/marker endpoints.
  - Acceptance: one ownership-scoped server query/API returns account metrics, open positions,
    accepted orders, immutable order/execution/trade history, current quotes, and PostgreSQL-backed
    candles/ledger markers with bounded validated ranges and no provider credentials in the browser.
- [x] P6-005 Implement authenticated realtime quote/account resync contracts.
  - Acceptance: the gateway authenticates account ownership, emits typed sequence/version envelopes,
    supports reconnect snapshots before deltas, exposes stale/disconnected state, and never accepts
    authoritative browser calculations or mutation events.
- [x] P6-006 Build the historical/live candlestick workspace with trade markers and older-range loading.
  - Acceptance: Lightweight Charts renders backend candles, current forming updates, execution/trade
    markers, timeframe controls, loading/empty/stale states, and deduplicated historical/live handoff;
    scrolling left requests only an older bounded range from our backend.
- [x] P6-007 Build the authoritative market/pending/protection order ticket.
  - Acceptance: the signed-in owner can submit market/limit/stop, choose side/quantity/price, set or
    clear SL/TP, see exact server rejection/acceptance/fill outcomes, and never compute fills locally.
- [x] P6-008 Build positions, pending orders, order/execution/trade history, and risk/account panels.
  - Acceptance: dense desktop and usable mobile tables expose cancel/protection actions, bid/ask,
    balance/equity/P&L/margin/free margin/drawdown, timestamps and reasons from authoritative state,
    with useful empty/error states and complete fictitious-capital labeling.
- [x] P6-009 Complete responsive, keyboard, reduced-motion, and reconnect/resync terminal UX.
  - Acceptance: the established trading-desk identity is preserved, the competition/risk rail is the
    terminal signature, controls remain keyboard/screen-reader usable, mobile prioritizes action and
    risk, and stale/disconnected/resync states cannot be mistaken for live execution availability.
- [x] P6-010 Add unit, PostgreSQL, Valkey, API/action, and browser coverage for Phase 6.
  - Acceptance: tests cover candle persistence/dedup/aggregation/incomplete buckets/handoff/ranges,
    ownership and validation, trade-marker reload, command results, stale data, realtime resync, and
    responsive terminal interactions without contacting a real provider.
- [x] P6-011 Pass the Phase 6 quality gate and update persistent project memory/handoff.
  - Acceptance: formatter, Prisma validation/generation, typecheck, lint, all tests, build, applicable
    browser checks, and service-backed CI pass; the exact Phase 7 risk task and limitations are recorded.

## Completed — Phase 7

- [x] P7-001 Expand the weekly competition/leaderboard milestone into concrete acceptance-tested tasks.
  - Acceptance: stable task IDs cover UTC lifecycle/cutoff, versioned eligibility/ranking/ties,
    authoritative recompute, immutable finalization, public tier views, admin controls, archives,
    concurrency/idempotency, tests, and the quality gate without silently approving prize economics.
- [x] P7-002 Implement the versioned deterministic leaderboard eligibility and ranking domain.
  - Acceptance: exact integer performance, breach/disqualification/status eligibility, tier isolation,
    proposed tie-break order, true tied ranks, stable fallback ordering, invalid-input rejection, and
    development policy versioning are pure, deterministic, and unit tested.
- [x] P7-003 Add durable leaderboard standings and cutoff-input persistence.
  - Acceptance: PostgreSQL retains one versioned recomputable score input per entry plus indexed
    tier standings/finalization relations; exact values and authoritative timestamps survive restart,
    final results cannot be overwritten silently, and a forward-only migration is tested.
- [x] P7-004 Implement serialized UTC competition activation and weekly freeze/cutoff.
  - Acceptance: scheduled competitions activate at/after start; active competitions freeze once at
    cutoff under a competition lock; accepted orders expire, accounts/entries complete or retain
    terminal failure status, cutoff score inputs are captured, and correlated audits are atomic.
- [x] P7-005 Implement authoritative live recompute and immutable leaderboard finalization.
  - Acceptance: recompute derives only from PostgreSQL account/snapshot/breach/entry state, is
    idempotent and tier-separated, produces a canonical result hash, supports true ties, and finalizes
    a frozen competition once without trusting cached/browser scores.
- [x] P7-006 Implement audited admin lifecycle, disqualification, recompute, and finalize controls.
  - Acceptance: ADMIN authorization is server-side; reasons are required for disqualification;
    invalid transitions/finalize timing fail closed; each mutation is audited and concurrency-safe;
    prize amounts/allocation are not changed or auto-approved.
- [x] P7-007 Build public live/final tier leaderboards and archived competition views.
  - Acceptance: visitors can view tier-separated eligible ranks and archives; final views use the
    immutable snapshot/hash; identities are display-safe; UTC status/as-of and development-policy
    labeling are explicit; useful empty/error states and true ties render correctly.
- [x] P7-008 Add trader leaderboard position and competition-status integration.
  - Acceptance: authenticated traders see their authoritative eligible/ineligible state, rank/tie,
    score, drawdown tie-break input, cutoff/finalized state, and archived result without client math.
- [x] P7-009 Run lifecycle/recompute jobs in the worker with restart-safe idempotency.
  - Acceptance: any worker can discover due competitions from PostgreSQL, overlapping runs serialize,
    failures retry safely, no server list is hard-coded, and cutoff/finalization work survives restart.
- [x] P7-010 Add the Phase 7 correctness, concurrency, API/action, and browser test matrix.
  - Acceptance: tests cover weekly boundaries, eligibility exclusions, tier separation, every tie
    break, true ties, activation/freeze replay, cutoff order expiry/account completion, recompute,
    duplicate finalization, hash stability, admin RBAC/audits, archives, and worker recovery.
- [x] P7-011 Pass the Phase 7 quality gate and update persistent project memory/handoff.
  - Acceptance: formatter, Prisma validation/generation, typecheck, lint, all tests, build, applicable
    browser checks, and service-backed CI pass; the exact Phase 8 task and limitations are recorded.

## Completed — Phase 8

- [x] P8-001 Expand the company-funded prize/admin milestone into concrete acceptance-tested tasks.
  - Acceptance: stable task IDs cover prize-ledger derivation from immutable standings, winner
    review, fifth-place free-entry credits, manual KYC status, dual-control payout approval,
    transaction-reference recording, reconciliation, audit evidence, tests, and the quality gate;
    development work does not silently approve prize economics, custody, or production payouts.
- [x] P8-002 Extend the durable prize, compliance-review, payout, and free-entry-credit schema.
  - Acceptance: PostgreSQL records immutable prize-source provenance, explicit winner/KYC review
    evidence, separate prize and payout approvers, manual transaction/reconciliation evidence, and
    individually redeemable fifth-place credits; constraints prevent duplicate awards/credits and
    no customer stored-value balance is introduced.
- [x] P8-003 Derive an idempotent prize ledger only from immutable finalized standings.
  - Acceptance: an audited admin command locks one finalized competition, attaches configured
    development prize rows to exact standing entry/rank/source hash, refuses amount/currency
    invention or mutation, flags tied-rank ambiguity for manual policy review, and replays safely.
- [x] P8-004 Add winner review and manual KYC state transitions.
  - Acceptance: authorized admins confirm or reject the derived winner with required reasons,
    record explicit not-started/pending/approved/rejected KYC states, cannot approve a prize before
    winner and KYC approval, and every actor/before/after transition is append-only audited.
- [x] P8-005 Add dual-control prize and payout approval.
  - Acceptance: prize approval creates an exact matching pending payout; a different administrator
    must approve the payout; invalid, same-actor, duplicate, and concurrent commands fail closed or
    replay idempotently without changing amounts/currency.
- [x] P8-006 Record manual payout completion and reconciliation evidence.
  - Acceptance: no provider call is made; audited commands move approved payouts through processing,
    record a unique non-secret transaction reference before paid, reconcile exact prize/payout
    amount/currency/status with a second actor and required note, and preserve failure/cancellation
    history.
- [x] P8-007 Issue and expose fifth-place free-entry credits without stored customer value.
  - Acceptance: a paid/reconciled fifth-place prize issues exactly the configured count of
    single-use access credits to the winner, duplicate issuance is impossible, credit status and
    source are queryable by admins/traders, and payment/checkout redemption remains out of scope
    unless separately acceptance-tested.
- [x] P8-008 Add the restricted prize operations UI and trader prize/credit read model.
  - Acceptance: ADMIN-only controls present authoritative provenance, review/KYC/approval/payout/
    reconciliation state and valid next actions; traders see only their own prize and credit status,
    all money is company-funded, and development/manual limitations are explicit.
- [x] P8-009 Add the Phase 8 correctness, authorization, concurrency, persistence, and browser matrix.
  - Acceptance: tests cover source-hash/rank derivation, ties, missing/unconfigured awards,
    idempotency/concurrency, invalid transitions, dual control, KYC gating, exact money matching,
    transaction-reference uniqueness, reconciliation, credit issuance, RBAC, audits, and rendering.
- [x] P8-010 Pass the Phase 8 quality gate and update persistent project memory/handoff.
  - Acceptance: formatter, Prisma validation/generation, typecheck, lint, all tests, build, applicable
    browser checks, and service-backed CI pass; the exact Phase 9 gate and prohibited early provider
    work are recorded.

## Maintenance — Local runtime verification

- [x] M-009 Refresh the product-wide visual system and core trader journeys without changing domain
      behavior or the blocked real-provider phase.
  - Acceptance: the public home, navigation, authentication, competition discovery, dashboard,
    leaderboards, checkout, terminal, and administrative surfaces share an intentional responsive
    design system; important states and next actions are easier to understand; keyboard focus,
    reduced motion, and mobile layouts remain supported; no trading rule, prize allocation, payment
    behavior, market-data authority, or provider integration changes; formatter, typecheck, lint,
    tests, build, and desktop/mobile visual checks pass.
  - Implemented the race-week control-room design system across public, authentication, competition,
    leaderboard, dashboard, checkout, terminal, and administrative surfaces; added explanatory home,
    tier, standing, and dashboard content; fixed terminal radio-control viewport overflow; verified
    key journeys at 1440px and 390px; all 127 tests and the production build pass.
- [x] M-010 Integrate the published production-terminal work with the local product-wide visual
      refresh and verify the combined project state.
  - Acceptance: origin/main is fast-forwarded without losing local work; task IDs and project memory
    are reconciled; the merged advanced chart and race-week UI render together without hydration or
    console errors; formatter, Prisma validation/generation, typecheck, lint, all database-backed
    tests, production build, and repository diff checks pass.
  - Fast-forwarded to remote commit `7bba4a4`, reapplied the preserved M-009 work, resolved only the
    project-memory conflicts, and fixed the terminal week-progress hydration clock. All 146 tests,
    production build, focused browser routes, advanced chart controls, and console checks passed.

- [x] M-001 Make the documented local seed and health-check workflow exact, then verify the complete
      mock-backed stack locally.
  - Acceptance: `pnpm db:seed` loads the repository-root development environment without manual shell
    exports; README health URLs match the implemented web/realtime/worker routes; PostgreSQL/Valkey
    readiness, all 127 tests, formatter, typecheck, lint, and build pass without starting Phase 9.
  - Homebrew PostgreSQL 17 and Valkey readiness passed; all eight migrations and the idempotent seed
    ran locally; formatter, Prisma validation/generation, typecheck, lint, all 127 tests, and the
    production build passed.
- [x] M-002 Fix the live terminal's initial server-action hydration crash and add regression coverage.
  - Acceptance: client components import their serializable initial action state from a client-safe
    module rather than a `use server` action module; the ticket renders before any submission; focused
    tests and a live browser terminal smoke test pass.
  - Moved the shared state out of the server-action module, exercised the real initial state in the
    ticket test, and verified the provisioned terminal renders without the development error overlay.
- [x] M-003 Add and verify a production-shaped local Docker Compose environment.
  - Acceptance: web, realtime, and worker use their deployable Docker images; PostgreSQL/Valkey are
    reachable only through the Compose network; migrations and the idempotent development seed run
    before application services; documented health checks pass; no real market-data or payment
    provider is enabled.
  - Added the isolated `docker-compose.production.yml` stack and local-only container environment
    template. Migration deploy and the idempotent seed completed before application startup; all
    container health checks plus the web, realtime, worker, and database-backed competitions smoke
    checks passed. The stack retains deterministic mock market data and mock payments only.
- [x] M-004 Record the TraderMade trial offer and prepare a fail-closed provider activation path.
  - Acceptance: the vendor response and its remaining commercial/documentation gaps are recorded;
    the deployed environment explicitly permits only the mock feed; an operator runbook defines the
    payment-link, credential, documentation, rights, and validation gates before any provider code
    or customer-facing data is enabled.
  - Recorded the 24 August pricing/trial offer and its outstanding permission/documentation gaps in
    `11_TRADERMADE_TRIAL_ACTIVATION.md`. `MARKET_DATA_SOURCE` now accepts only `mock`, with a
    regression test proving an unimplemented provider value fails at startup. The rebuilt Compose
    stack is healthy with the mock source explicitly confirmed in the running worker.
- [x] M-005 Upgrade the browser terminal into an operator-focused charting workspace.
  - Acceptance: the terminal has an accessible browser full-screen mode; the server-owned terminal
    state exposes exact live per-position mark price, average entry, and unrealized P&L; the chart
    provides usable timeframes, indicator overlays, price-level/measurement/reset tools, and
    execution markers; a trader can drag an open position's SL or TP from the chart, with the final
    request still validated and persisted by the authoritative server protection command. Coverage
    demonstrates the price/indicator calculations and the updated terminal state; desktop and
    narrow layouts remain usable.
  - Added full-screen station mode; exact server-computed per-position executable mark, average
    entry, P&L, and pip display; moving-average and Bollinger overlays; 4h/1d timeframes; price
    level, measure, reset, and clear controls; and draggable on-chart SL/TP handles. A drop calls
    the existing owner-checked, auditable protection command rather than mutating browser state.
    Formatter, typecheck, lint, and all 101 runnable tests passed; the final Docker image was
    rebuilt and its running web image, migration/seed, realtime, worker, database, cache, and host
    health/smoke endpoints all passed.
- [x] M-006 Keep terminal order submissions in the trading station after a local runtime switch.
  - Acceptance: quote-side controls never submit or navigate; a valid local browser session remains
    valid when the same application is run from the production-shaped Docker environment; a market
    order returns its authoritative simulated result in the ticket rather than redirecting away.
  - Root cause was a local runtime session-signing-secret mismatch: Docker authenticated actions as
    anonymous after the switch and correctly redirected them away from the terminal. The Compose
    web environment now takes its stable local signing secret from root `.env`, matching production
    secret injection and the host-run web process. Quote Buy/Sell selection has explicit regression
    coverage; formatter, typecheck, lint, all 102 runnable tests, Compose validation, and the
    recreated Docker web readiness check passed.
- [x] M-007 Build professional chart drawing tools for the simulated trading station.
  - Acceptance: the chart offers a coherent select/drawing toolbelt with trend lines, horizontal
    rays, rectangles, long/short position-risk visualizations, and measurement; drawings can be
    selected, adjusted, deleted, cleared, and survive a browser refresh without participating in
    authoritative trade state. The controls remain keyboard-accessible and work at narrow widths.
  - Added a compact workstation drawing rail with trend, ray, zone, long-plan, short-plan, and
    measure tools. The SVG overlay anchors annotations to chart price/time coordinates; selection
    supports whole-drawing moves and endpoint handles, while `Delete`/`Backspace` remove the selected
    annotation and `Escape` returns to selection. Browser-only drawings are schema-validated,
    bounded, and persisted by account and symbol in local storage; no drawing crosses the
    server-authoritative order, position, or risk boundary. The narrow layout turns the rail into a
    scrollable horizontal tool strip. Formatter, typecheck, lint, all 105 runnable tests, production
    build, Docker image rebuild, and the recreated web readiness check passed.
- [x] M-008 Add a professional indicator-parameter window to the chart.
  - Acceptance: traders can open an accessible indicator settings dialog, enable/disable the
    supported studies, edit and validate their periods/deviation/style values, apply or cancel a
    draft, and reset defaults. The chart uses only the applied valid settings and remains free of
    any client-authoritative trading behaviour.
  - Added an accessible `ƒx Studies` settings window for the three supported indicators. Its drafts
    offer per-study visibility, periods, line colors, and Bollinger deviations; invalid values are
    rejected before studies are recreated, while Cancel/Escape preserve the current chart and Reset
    restores the documented defaults. Header chips always reflect applied settings. Formatter,
    typecheck, lint, all 110 runnable tests, the production image build, and recreated Docker web
    readiness check passed.
- [x] M-011 Harden authentication redirects, credential throttling, session revocation, and Docker
      database-runtime packaging.
  - Acceptance: malformed or repeated callback URLs cannot crash or redirect externally; login and
    registration resume a valid protected route; credential results are handled defensively; failed
    credential attempts are throttled and audited without storing plaintext identifiers; realtime
    connections lose access when their user becomes inactive; and the deployed web bundle locates the
    Prisma engine for database-backed authenticated pages. The operator follow-up checklist, focused
    regression coverage, and verification results are recorded.
  - Added safe callback normalization and login/registration continuation, defensive credential
    result handling, hashed email/network Valkey limits with failed-login audits, active-user WebSocket
    revalidation, and the corrected Prisma standalone-engine paths. The documented Docker stack
    rebuilt successfully; disposable signup/login/session, duplicate-callback, readiness, and
    database-backed route smoke checks passed alongside formatter, typecheck, lint, and all 126
    runnable tests. `12_AUTH_SESSION_HARDENING.md` records the remaining production follow-up work.
- [x] M-012 Add a TradingView-inspired chart command menu and workstation display controls.
  - Acceptance: right-click and keyboard context-menu invocation open an accessible, viewport-bounded
    command menu at the chart price/time; its actions expose the terminal's supported drawing,
    measurement, view, visibility, and drawing-management controls with clear descriptions; users can
    toggle chart grid and last-price visibility, reset/recenter the view, and manage browser-only
    drawings without modifying authoritative orders, positions, risk, or market data. The desktop and
    narrow layouts remain usable, focused regression coverage is added, and project memory/quality
    evidence is updated.
  - Added an accessible chart command menu triggered by right-click, `Shift+F10`, or the keyboard
    context-menu key. It shows the actual price/time under the pointer, explains the supported
    selection, trend, ray, rectangle, long/short-plan, and measurement tools, places a horizontal
    ray at that price, and exposes fit/latest, grid, last-price, visibility, repeat-drawing, and local
    drawing-management controls. The context menu and annotations remain browser-only; no command can
    submit an order or alter persisted trading/risk state. Official public TradingView tool/settings
    guidance informed the vocabulary, while the implementation remains first-party Lightweight
    Charts. Focused component/integration coverage, production Docker rebuild, readiness check, and
    browser right-click/action smoke checks passed.
- [x] M-013 Refine the chart command menu into a compact TradingView-style interaction.
  - Acceptance: the right-click menu no longer obscures the chart with explanatory text; it is a
    compact dark tool menu with clear grouping, nested drawing/settings panels, tooltips, keyboard
    return/escape behavior, and viewport containment. All existing first-party command behaviour and
    non-authoritative browser boundaries are preserved, with focused regression and browser visual
    checks.
  - Replaced the explanatory right-click panel with a compact, dark command menu sized for the chart.
    Drawing tools and display preferences now open focused nested panels; concise single-line commands,
    dividers, active-state checks, hover tooltips, back navigation, and Escape behavior keep the chart
    visible while retaining every supported browser-only command. Focused component/integration coverage,
    formatter, web typecheck, lint, production Docker rebuild/readiness, and real browser right-click
    visual checks passed.
- [x] M-014 Allow chart drawings to extend beyond the latest loaded bar.
  - Acceptance: the terminal maintains intentional right-side future space after the latest candle;
    trend lines, zones, and risk/reward plans can be placed and edited there without clamping to the
    final market-data timestamp. Existing viewport/history behaviour and the browser-only drawing
    authority boundary remain intact, with focused regression and real-browser checks.
  - Added a 16-bar right-side future margin and logical-index extrapolation for browser drawings. A
    pointer in the empty future area now receives an interval-aligned future timestamp; saved future
    annotation times map back to the same logical coordinate and become normal chart timestamps when
    data reaches them. Focused unit/component regressions, formatter, web typecheck, lint, production
    Docker rebuild/readiness, and a real-browser future-margin visual check passed.
- [x] M-015 Add a chart-only fullscreen workspace mode.
  - Acceptance: a chart-local control enters browser fullscreen for the chart panel only, keeping the
    chart toolbar, studies, drawing tools, annotations, context menu, and protected position levels
    usable while excluding the terminal order ticket, metrics, and ledger. Escape and the control exit
    cleanly; whole-terminal fullscreen remains independent. Focused coverage, browser verification, and
    project memory are updated.
  - Added a chart-toolbar control that uses the Fullscreen API on the chart panel alone. In that mode,
    the chart stage expands to the viewport while retaining timeframes, studies, drawing tools,
    annotations, protected position levels, the context menu, and reset/clear controls. Escape or the
    exit control restores the terminal; whole-terminal fullscreen remains available independently.
    Formatter, web typecheck, lint, nine focused tests, production Docker rebuild/readiness, and live
    browser enter/exit verification passed.

- [x] M-016 Add optional Buy/Sell quote selectors to the chart.
  - Acceptance: Chart settings can show or hide a clearly labelled live bid/ask control in normal and
    chart-only fullscreen modes; its Buy/Sell choice is shared with the order ticket without navigating
    away or submitting an order; unavailable quotes cannot be selected; explicit ticket submission
    remains the only browser path to the server-authoritative simulated-order command; focused coverage,
    project memory, and runtime verification are updated.
  - Added a default-off Chart settings toggle that overlays live bid/ask side selectors in both normal
    and chart-only fullscreen modes. The chart and order ticket now share their selected side; the chart
    controls are disabled without a live quote and explicitly direct the trader to submit from the ticket.
    Formatter, web typecheck, lint, 14 focused tests, and the production web build passed. Docker Desktop
    was unavailable in this session, so the existing local container could not be rebuilt for this change.

- [x] M-017 Add a TradingView-style active-studies legend to the chart pane.
  - Acceptance: applied studies appear as a compact, color-matched list at the chart pane's top-left,
    with their current configured parameters and latest values; the list remains legible alongside the
    drawing rail, live quote controls, and chart-only fullscreen, adapts at narrow widths, and the
    existing Studies settings dialog remains the source of truth for enablement and parameters.
  - Replaced the duplicate header study chips with a plot-local legend that shows each applied study's
    configured label, color, and latest calculated value. It sits beside the desktop drawing rail, moves
    below the narrow drawing strip, and preserves chart-only fullscreen. Formatter, web typecheck, lint,
    17 focused tests, and the production web build passed; Docker Desktop remains unavailable for an
    image rebuild and live visual pass.

- [x] M-018 Make chart studies selectable with an in-pane selected-state control.
  - Acceptance: a trader can select an applied study from its chart legend or its plotted line; the
    top-left legend clearly identifies the selected study, exposes its live values, and provides a direct
    settings control without hiding the chart; selection and the settings dialog operate only on visual
    study preferences and never affect authoritative trading state.
  - Added interactive legend rows and per-study settings buttons. A selected study gains a clear legend
    state plus a stronger plotted line; clicking a plotted Lightweight Charts study line also selects its
    owner. The existing settings dialog remains visual-only. Formatter, web typecheck, lint, 18 focused
    tests, and the production web build passed; Docker Desktop remains unavailable for rebuilt-image QA.

- [x] M-019 Support multiple independent instances of each chart study.
  - Acceptance: a trader can add, configure, select, and remove multiple SMA, EMA, and Bollinger Band
    instances in the Studies window; every instance renders independently with its own parameters and
    color, appears separately in the selectable top-left legend, and remains browser-only with bounded
    client validation.
  - Replaced the fixed one-per-type study model with independently identified SMA, EMA, and Bollinger
    instances. The Studies window now adds, removes, validates, resets, and counts up to 12 instances;
    duplicate kinds receive distinct default colors and ordinal legend labels. Formatter, web typecheck,
    lint, 22 focused tests, and the production web build passed; Docker Desktop remains unavailable for
    rebuilt-image QA.

- [x] M-020 Keep chart drawings fixed to their time and price anchors while panning and zooming.
  - Acceptance: browser-only drawings recalculate their SVG coordinates whenever the chart viewport
    moves or scales, so they track their anchored candle/time and price positions—including future-space
    anchors—without changing drawing data or server-authoritative trading state; focused regression
    coverage verifies the redraw path.
  - Reprojected overlay coordinates on every Lightweight Charts logical-range update and on captured
    drag/wheel viewport interactions, coalesced to one animation frame. The focused regression confirms
    that a saved ray follows both its time and price coordinates without mutating its saved anchor data.
    A no-cache production Compose rebuild, service-health checks, and a live terminal pan confirmed the
    behavior in the rebuilt web image.

- [x] M-021 Add TradingView-style chart-drawing constraints and click-to-lock measurement.
  - Acceptance: Shift constrains a new trend line to its dominant horizontal or vertical axis; Ctrl snaps
    new drawing and measurement price anchors to the closest OHLC value of the candle under the pointer;
    a measurement starts on its first click, previews under the cursor, and remains on the chart when the
    second click fixes it. These client-only visual tools must not modify simulated orders, positions, or
    market data, and focused coverage must verify their constraint and completion behavior.
  - Added deterministic horizontal/vertical Shift locking, exact per-candle OHLC Ctrl snapping, and a
    chart-coordinate-bound click-to-lock measurement. Focused unit/component tests, full static checks,
    production image build, web readiness, and live two-click measurement QA passed.

## Blocked — Phase 9

- [!] P9-001 Obtain the selected real market-data provider, official API documentation, and
  commercial-use approval before implementation.
  - Blocker: the user/vendor must provide the provider selection, official streaming and historical-
    candle API documentation, and documentary rights for customer-facing display, caching, and
    simulated execution. Provider APIs and commercial permissions must not be invented or inferred.
  - Acceptance: the approved provider, documentation version/links or supplied files, credential
    and rate-limit model, redistribution/cache limits, symbol/session semantics, historical bounds,
    and simulated-execution/display rights are recorded before P9 implementation tasks are expanded.

## In progress — Phase 10

- [x] P10-001 Implement the backend-only NOWPayments hosted-invoice adapter and signed IPN intake.
  - Acceptance: checkout creation uses the documented hosted-invoice API from the server only; API and
    IPN secrets are environment-only; a callback validates the documented recursively sorted HMAC-SHA-512
    signature before it can affect a payment; exact USD price, provider payment ID, provider invoice ID,
    and our immutable order ID are correlated; no payout, custody, stored-value, fiat, or browser-owned
    payment flow is introduced.
- [x] P10-002 Extend durable payment persistence and provider-neutral processing for NOWPayments.
  - Acceptance: provider/invoice/payment references are forward-migrated, duplicate IPNs are idempotent,
    terminal regressions are rejected, `finished` is the only provider status that provisions an entry,
    and under/overpayment cannot activate simulated capital.
- [x] P10-003 Route eligible competition checkout to the configured provider without weakening mock use.
  - Acceptance: `PAYMENT_PROVIDER=mock` stays the development default; selecting `nowpayments` requires
    complete server-only configuration; user-facing flow redirects only to the hosted invoice and displays
    no API/IPN secret or wallet custody UI.
- [x] P10-004 Add unit, route, and PostgreSQL integration coverage for invoice creation, HMAC validation,
      callback replay, invoice/order correlation, status mapping, and exact-amount activation.
- [x] P10-005 Pass the Phase 10 quality gate and update persistent project memory.
  - Acceptance: formatter, Prisma validation/generation, typecheck, lint, tests, build, environment
    documentation, changelog, project state, and handoff are current. Production enablement remains
    blocked until the business/legal merchant-acceptance evidence and a publicly reachable IPN endpoint
    are separately verified.
- [~] P10-006 Complete the preorder checkout operational activation gate.
  - Product owner reports NOWPayments approval and receipt of the API key on 30 August 2026. Record the
    approval artefact outside Git; never paste the key into this repository or chat.
  - Implementation evidence: preorder UI/test coverage, the single-host Docker/Caddy launch composition,
    deployment variable inventory, smoke procedure, rollback plan, 191 database-backed tests, and a
    production build are complete.
  - Host preparation: connected to `root@72.62.90.38`; installed Docker Engine 29.7.2 and Docker Compose
    5.5.0; enabled a default-deny UFW with SSH/HTTP/HTTPS allowed; cloned launch revision `4621bbe` to
    `/opt/profitopath`. No application, database, or payment service was started.
  - Temporary infrastructure decision: the product owner explicitly authorized private PostgreSQL and Valkey
    Docker containers on the launch VM without an off-host backup destination. The configuration keeps both
    ports private and records the required later managed-service migration; it is not highly available.
  - Blocker: `profitopath.com` and `www.profitopath.com` have no public A record, NOWPayments API/IPN
    secrets and deployment-secret injection are absent, and the first competition schedule is unapproved.
  - Remaining operational work: deploy the private data containers; add the Namecheap DNS records; generate
    local auth/data secrets; configure the final public HTTPS origin and raw-body IPN path; securely place
    NOWPayments credentials; run the documented controlled invoice/IPN smoke test; then enable
    `PAYMENT_PROVIDER=nowpayments` only in that deployed environment.
  - Acceptance: scheduled competition entries are presented as preorders, confirmed preorders cannot open
    a terminal before their competition activates, and the deployment team has a secret-safe activation
    and rollback runbook. `PAYMENT_PROVIDER=mock` remains the repository and local-development default.
- [x] P10-007 Build the protected superadmin operations console.
  - Acceptance: only active `SUPERADMIN` users can access the server-rendered console; it reports
    registered members, privacy-preserving daily unique visitors, active signed-in members, confirmed
    USD payment revenue, and simulated-account counts from authoritative stores; it exposes configuration
    readiness and provider modes without rendering, persisting, or accepting raw API keys in the browser.
- [x] P10-008 Add superadmin metric, authorization, and configuration-health coverage and complete the
      associated quality/documentation gate.
- [x] P10-009 Require Zoho SMTP email confirmation before credential sign-in.
  - Acceptance: registration only succeeds when a single-use, expiring confirmation link can be issued;
    plaintext tokens and SMTP credentials are never persisted; an unverified account cannot authenticate;
    confirmation and resend activity is audited; production SMTP configuration is environment-only; and
    the public interface never reveals whether a resend email belongs to an account.
