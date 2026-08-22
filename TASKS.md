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

## Active — Phase 4 (not started)

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
- [~] P4-010 Add unit and PostgreSQL integration coverage for the Phase 4 correctness matrix.
  - Acceptance: tests cover market order create/fill/reject, long/short and netting lifecycle, P&L,
    spread, margin, exact drawdown boundary, duplicate events, offline processing, restart recovery,
    transaction rollback, and deterministic replay.
- [ ] P4-011 Pass the Phase 4 quality gate and update persistent project memory/handoff.
  - Acceptance: formatter, Prisma validation/generation, typecheck, lint, all tests, build, and
    service-backed CI pass; the exact Phase 5 task and unresolved configurable economics are recorded.
