# Technical Architecture

## Monorepo

One GitHub repository.

Recommended structure:

```text
/apps
  /web
  /realtime
  /worker

/packages
  /database
  /simulator
  /market-data
  /competition
  /payments
  /shared
  /ui

/infrastructure
  /terraform
  /cloud-init

/.github/workflows

AGENTS.md
PROJECT_STATE.md
TASKS.md
DECISIONS.md
SESSION_HANDOFF.md
CHANGELOG.md
```

## Stack

- TypeScript
- Next.js
- React
- Tailwind CSS
- TradingView Lightweight Charts
- PostgreSQL
- Prisma
- DigitalOcean Managed Valkey (Redis compatible)
- BullMQ or Streams-based worker coordination
- WebSockets
- Zod
- Auth.js-compatible auth abstraction
- Vitest
- Playwright
- Docker
- Terraform
- GitHub Actions

## Services

### web

- Next.js UI
- normal HTTP API/BFF
- account/dashboard/leaderboard pages
- admin UI

### realtime

- authenticated WebSocket gateway
- fan-out of market/account updates
- no authoritative trading logic in browser

### worker

Initially one deployable worker application with role-based processes:

- market-data ingest
- simulation/risk workers
- order-trigger workers
- snapshots
- leaderboard/weekly jobs
- payment webhook/reconciliation jobs

It can later be horizontally split into independent deployables without changing domain packages.

## First-party trading architecture

```text
Commercially permitted market data
        ↓
MarketDataProvider adapter
        ↓
Normalized price events
        ↓
Valkey stream/cache
        ↓
Simulation / Order / Risk workers
        ↓
PostgreSQL authoritative ledger
        ↓
Derived live state in Valkey
        ↓
WebSocket gateways
        ↓
Browser terminal
```

## Market-data adapter

Never couple domain logic to a specific vendor.

```ts
interface MarketDataProvider {
  subscribe(symbols: string[]): Promise<void>;
  onQuote(handler: (quote: Quote) => Promise<void>): void;
  getLatestQuote(symbol: string): Promise<Quote>;
  getHistoricalBars(input: HistoricalBarsRequest): Promise<Bar[]>;
}
```

MVP implementation:

- `MockMarketDataProvider`
- real vendor only after commercial display/redistribution rights are confirmed.

## Payment adapter

```ts
interface PaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  verifyCallback(input: VerifyCallbackInput): Promise<PaymentEvent>;
  getPayment(providerPaymentId: string): Promise<PaymentStatus>;
}
```

Implementations:

- `MockPaymentProvider`
- `NowPaymentsProvider` later

No customer stored crypto balance.

## Trading ledger

Authoritative entities:

- Order
- Execution
- Position
- ClosedTrade
- AccountBalanceLedgerEntry

Important:

- an Order is not an Execution;
- an Execution changes a Position;
- a Position can survive browser disconnects/restarts;
- closing a Position produces ledger records;
- every mutation is auditable.

## P&L / risk

Do not write tick-derived P&L into PostgreSQL on every tick.

PostgreSQL stores authoritative inputs/events.
Valkey/memory stores hot derived values.

Example:

- position entry/size persisted;
- latest quote cached;
- unrealized P&L derived;
- periodic AccountSnapshot persisted;
- all threshold/breach events persisted immediately.

Risk processing must continue without browser presence.

## Restart recovery

At service startup:

1. read ACTIVE competitions;
2. load open positions and pending orders;
3. restore indexes in Valkey;
4. fetch latest valid quotes;
5. recalculate account state;
6. resume streams;
7. record recovery metrics.

No local server disk may be required for recovery.

## Horizontal scaling rules

Every compute service must be replaceable and horizontally scalable.

- no unique local state;
- no manual mapping of trader → server;
- load balancer distributes HTTP/WS;
- workers claim work from queue/stream;
- new workers join automatically;
- dead worker work is reclaimed;
- service endpoints provided through configuration/DNS;
- persistent storage is managed separately.

## Target scale

Design for:

- 25k accounts
- 10k WebSocket sessions
- 5k active traders

Avoid:

- polling every account individually every second;
- database writes on every quote;
- sending every upstream tick to every client.

Use:

- symbol/exposure indexes;
- coalesced UI updates;
- event-driven risk;
- connection pooling;
- DB indexes/partition strategy;
- worker sharding by deterministic key where needed.

## Security

- least-privilege cloud credentials;
- secrets outside Git;
- SSH keys only;
- no production wallet private keys in app environment;
- signed payment callbacks;
- admin RBAC;
- auditable admin actions;
- rate limiting;
- CSRF/session protection;
- encrypted sensitive secrets;
- backups and restore drills;
- structured logs/metrics.
