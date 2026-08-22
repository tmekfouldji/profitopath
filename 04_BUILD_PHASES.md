# Build Phases

Codex must complete phases in order unless `PROJECT_STATE.md` explicitly changes the active phase.

## Phase 0 — Repository / project memory

- initialize pnpm monorepo
- create app/package folders
- create TypeScript/lint/format/test configs
- establish PROJECT_STATE/TASKS/DECISIONS/HANDOFF workflow
- CI skeleton
- Docker local dependencies
- exact README commands

## Phase 1 — Database/domain foundation

- PostgreSQL/Prisma
- users
- competitions
- tiers
- entries
- trading accounts
- Orders
- Executions
- Positions
- ClosedTrades
- balance ledger
- rule breaches
- payments
- prizes/payouts
- audit events
- state machines
- seeds
- tests

## Phase 2 — Auth + application shell

- register/login
- trader dashboard
- admin RBAC shell
- competition pages
- empty terminal shell

## Phase 3 — Mock payments + entry provisioning

- PaymentProvider interface
- MockPaymentProvider
- idempotent event processing
- confirmed payment → competition entry/account
- no real NOWPayments yet

## Phase 4 — Mock market data + simulator core

- MarketDataProvider
- deterministic mock feed
- symbol specs
- market orders
- fills
- positions
- balance/equity
- margin
- P&L
- drawdown
- persistence/recovery
- extensive tests

## Phase 5 — Pending orders / SL / TP

- limit
- stop
- stop-loss
- take-profit
- cancellation
- trigger engine
- market hours
- offline behavior
- deterministic replay tests

## Phase 6 — Browser trading terminal

- Lightweight Charts
- quotes
- order ticket
- positions
- pending orders
- history
- account metrics
- WebSockets
- reconnect/resync

## Phase 7 — Competition + leaderboard

- weekly windows
- eligibility
- tier-separated leaderboard
- tie breaks
- freeze/finalize
- authoritative recompute
- archived competitions

## Phase 8 — Prize/admin workflow

- prize ledger
- winner review
- fifth-place credits
- manual KYC status
- manual payout approval
- transaction hash recording
- audit log

## Phase 9 — Real market-data provider

Only after commercial terms permit customer-facing display and simulated execution.

- provider adapter
- historical bars
- stream resilience
- stale-data handling
- market-hours handling
- fail-safe trading pause

## Phase 10 — NOWPayments

Only after SVG legal go-live and merchant acceptance.

- crypto-to-crypto
- USDT/USDC
- callback authentication
- idempotent state handling
- reconciliation
- manual review
- no fiat
- no stored customer balance

## Phase 11 — DigitalOcean staging

- Terraform
- VPC
- Droplets
- managed PostgreSQL
- managed Valkey
- load balancer when required
- Spaces
- secret handling
- deploy workflow
- backups/monitoring
- staging smoke tests

## Phase 12 — Load / failure testing

- WebSocket load
- 5k active-trader synthetic model
- worker scale-out
- server-loss recovery
- Valkey restart recovery
- DB connection/load tests
- quote bursts
- order contention
- competition close

## Phase 13 — Closed beta

- no-money or controlled beta
- full weekly lifecycle
- reconciliation
- support/incident drills

## Phase 14 — Production readiness

- legal docs/versioning
- restricted countries
- production payment approval
- security review
- restore test
- runbooks
- observability
- launch checklist
