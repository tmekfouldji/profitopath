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
- Real market-data integration: not started
- Real payment integration: not started

## Active milestone

Phase 0 through Phase 8 are complete. Phase 9 cannot start until the user selects a market-data
provider, supplies its official API documentation, and confirms commercial rights for customer-facing
chart display and simulated execution. Mock market data remains active; no real provider is authorized.

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

P8-010 — Phase 8 quality gate, persistent project memory, and handoff.

## Next task

P9-001 — obtain the selected market-data provider, its official streaming/historical API
documentation, and documentary confirmation of commercial customer-facing display and simulated-
execution rights. This task is blocked pending user/vendor input; do not invent or integrate an API.

## Quality status

- `pnpm format`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `pnpm test`: 91 tests passed locally; 36 PostgreSQL integration tests skipped locally
- `pnpm build`: passed
- `pnpm db:validate` / `pnpm db:generate`: passed
- service-backed tests were not run locally because this workstation has no
  Docker/PostgreSQL runtime
- GitHub Actions CI run `32554756501`: passed migration deploy, seed, Compose validation, all 127
  tests, and production build

## Blockers

- starting simulated balance per tier is not finally approved
- exact drawdown semantics not finally approved
- market-data vendor not selected
- official provider API documentation and commercial-use/redistribution approval not supplied
- NOWPayments merchant acceptance not completed
- SVG legal opinion not completed

The market-data selection/documentation/rights blocker prevents Phase 9 implementation under the
repository provider rules. Do not infer an API, scrape a provider, or present unapproved data as
commercially usable. Phase 10 NOWPayments and Phase 11 DigitalOcean production work also remain
explicitly deferred.
