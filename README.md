# Weekly Trading Competition MVP

A first-party browser-based simulated trading platform for **weekly competitions only**.

## MVP business model

Customers purchase access to a five-trading-day simulated trading competition.

- All trading capital is fictitious.
- We do not operate a broker.
- We do not execute customer capital in real markets.
- There are no funded accounts in the MVP.
- There are no profit splits in the MVP.
- There is no live-execution/broker integration in the MVP.
- Each competition tier has its own weekly leaderboard.
- Weekly prizes are funded and paid by the company after winner verification.
- Working operating-company assumption: SVG Business Company, subject to final legal approval.
- Working checkout provider: NOWPayments, crypto-to-crypto only, subject to merchant acceptance.

## Competition tiers

| Tier   | Entry | Max Drawdown | Performance Benchmark |
| ------ | ----: | -----------: | --------------------: |
| Rookie |    $5 |       $1,000 |                $2,000 |
| Trader |   $10 |       $2,000 |                $4,000 |
| Elite  |   $15 |       $4,000 |                $6,000 |

Starting balances remain configurable until formally approved.

The benchmark is not necessarily an account-closing target. For the weekly-competition model, leaderboard rank is based on eligible performance at competition close.

## Technical product

We are building our own simulated trading terminal.

Core components:

- Next.js + TypeScript web application
- browser trading terminal
- TradingView Lightweight Charts
- licensed/commercially-permitted market-data adapter
- server-side simulated execution engine
- persistent Orders / Executions / Positions / Trades
- PostgreSQL authoritative ledger
- DigitalOcean Managed Valkey for hot state/queues
- WebSockets for live UI
- weekly competition engine
- leaderboard engine
- NOWPayments adapter
- audit trail
- DigitalOcean infrastructure

## Scale target

Design target, not day-one hardware:

- 25,000 competition accounts
- 10,000 concurrent connected sessions
- 5,000 actively trading users
- 50–100 instruments
- horizontally scalable compute
- no application service depends on unique local persistent disk

## Repository model

Use **one GitHub monorepo**.

Codex must treat the project-tracking files in the repository as persistent memory:

- `PROJECT_STATE.md`
- `TASKS.md`
- `DECISIONS.md`
- `SESSION_HANDOFF.md`
- `CHANGELOG.md`
- `10_MARKET_DATA_CACHING_AND_CANDLES.md` for market-data/charting work

Read them at the start of every session and update them before ending any substantial session.

## Local development

Prerequisites:

- Node.js 22 or newer
- pnpm 11.19.0
- Docker Engine with Docker Compose

From the repository root, run:

```bash
cp .env.example .env
pnpm install --frozen-lockfile
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Local services:

- web: `http://localhost:3000`
- realtime health server: `http://localhost:3001`
- worker health server: `http://localhost:3002`
- PostgreSQL: `localhost:5432`
- Valkey: `localhost:6379`

Each application exposes `/health/live` for process liveness and `/health/ready` for
PostgreSQL/Valkey readiness. Stop local dependencies with `docker compose down`.

Database commands:

```bash
pnpm db:validate
pnpm db:generate
pnpm db:migrate
pnpm db:migrate:deploy
pnpm db:seed
```

The seed is idempotent. It creates the three development tiers and schedules the next UTC Monday
competition. Starting balances come from the `DEV_*_STARTING_BALANCE_MINOR` environment variables
and are explicitly development defaults, not approved production rules. Authentication requires
the local-only `NEXTAUTH_URL` and `NEXTAUTH_SECRET` values copied from `.env.example`.

Phase 3 uses only the local `MockPaymentProvider`. Its callback signatures use the separate
`MOCK_PAYMENT_SIGNING_SECRET` from `.env.example`; the in-app confirmation screen never charges a
real payment method and provisions fictitious competition capital only.

Phase 4 adds an opt-in deterministic worker feed. Set `MOCK_MARKET_DATA_ENABLED=true` only for the
development mock cycle; browsers still never call a provider, historical bars remain deferred, and
the seeded instrument/leverage values are versioned development defaults rather than approved rules.

Phase 5 extends that server-owned mock path with persistent limit/stop orders, full-position SL/TP
OCO protection, cancellation, UTC 24x5 development hours, weekly-cutoff expiry, and restart recovery.
Executable bid/ask triggers and gap fills are deterministic; these mock hours and prices are not
approved production market rules.

Run the complete local quality gate with:

```bash
pnpm format
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

With PostgreSQL migrated and seeded, include the persistence integration tests with:

```bash
RUN_DATABASE_TESTS=true pnpm test
```

Build deployable images from the repository root with:

```bash
docker build -f apps/web/Dockerfile -t profitopath-web .
docker build -f apps/realtime/Dockerfile -t profitopath-realtime .
docker build -f apps/worker/Dockerfile -t profitopath-worker .
```

## Workspace structure

- `apps/web`: Next.js web/BFF application
- `apps/realtime`: realtime gateway process and health server
- `apps/worker`: background worker process and health server
- `packages/database`: Prisma schema, migrations, seeds, and database helpers
- `packages/competition`: competition state machines and audited transitions
- `packages/simulator`: simulated execution boundary types
- `packages/market-data`: vendor-neutral market-data interfaces
- `packages/payments`: provider-neutral payment interfaces
- `packages/shared`: configuration, logging, health, money, and Valkey utilities
- `packages/ui`: shared React components

## Start here

1. Read `AGENTS.md`.
2. Read `CODEX_START_PROMPT.md`.
3. Read the project-state files.
4. Start only the phase listed as active in `PROJECT_STATE.md`.
