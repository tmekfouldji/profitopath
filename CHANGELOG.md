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

Codex should add concise entries here for meaningful completed features, migrations, infrastructure changes, and operator-visible behavior changes.
