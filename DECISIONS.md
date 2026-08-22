# Decisions

Append-only architectural/product decision log.
Do not silently rewrite earlier decisions. Add a superseding decision when direction changes.

## D-001 — Weekly competition only

Status: Accepted

The MVP is a weekly simulated trading competition platform only. No funded accounts, profit splits, live brokerage execution, or prop-firm features are implemented.

## D-002 — First-party simulator

Status: Accepted

Build our own browser-based simulated trading engine instead of depending on MT4/MT5.

## D-003 — Single monorepo

Status: Accepted

Use one GitHub repository containing web, realtime, worker, packages, infrastructure, documentation and project-state files.

## D-004 — Server-owned trading state

Status: Accepted

Open positions, pending orders, P&L/risk enforcement and history persist independent of browser sessions. Browser disconnect must not alter trading state.

## D-005 — PostgreSQL authoritative / Valkey hot state

Status: Accepted

PostgreSQL is the permanent ledger. Valkey is rebuildable hot state/cache/queue infrastructure.

## D-006 — Horizontal scale

Status: Accepted

Compute nodes must be replaceable and horizontally scalable. No application service may depend on unique local persistent disk.

## D-007 — DigitalOcean

Status: Accepted for MVP hosting

Use DigitalOcean Droplets + Managed PostgreSQL + Managed Valkey + Spaces. Introduce Load Balancer when multiple frontend/realtime nodes are deployed.

## D-008 — NOWPayments

Status: Accepted as planned payment provider

Real integration is deferred until legal/merchant go-live gate. Crypto-to-crypto only. No customer stored balance.

## D-009 — Market-data abstraction

Status: Accepted

Use a provider adapter. No production vendor integration until commercial rights explicitly allow the required customer-facing real-time display/simulation usage.

## D-010 — Exact monetary representations

Status: Accepted

Store fiat/accounting amounts as integer minor units using PostgreSQL `BIGINT` where totals
can accumulate. Store prices, quantities, notionals, and trading calculations as fixed-precision
decimal values. JavaScript floating-point numbers are not permitted for money-sensitive math.

## D-011 — Versioned, configurable development tier balances

Status: Accepted for development

Seed Rookie, Trader, and Elite with configurable development starting balances of $10,000,
$20,000, and $40,000 respectively. These values are environment-driven and are not approved
production economics. Entry fees, max drawdowns, and performance benchmarks retain the product
values in `README.md`.

## D-012 — Transactional state changes and audit records

Status: Accepted

Material domain state transitions must be validated against explicit transition graphs and write
their audit record in the same storage transaction. Provider event IDs, client order IDs, ledger
keys, and audit keys use unique constraints where applicable to support idempotency.

## D-013 — Backend-owned market candles

Status: Accepted

`10_MARKET_DATA_CACHING_AND_CANDLES.md` is authoritative for future market-data, simulator,
charting, realtime, and scale work. Browsers never call the upstream provider. PostgreSQL stores
durable candles, Valkey holds rebuildable hot windows and distributed coalescing locks, and
identical missing-range requests must be deduplicated. Prefer deterministic aggregation from
finalized one-minute candles where provider terms and data quality permit. This decision does not
authorize a real provider integration before Phase 9 and commercial approval.

## D-014 — Durable, serialized payment-event provisioning

Status: Accepted

Verified payment events are retained as immutable provider-event receipts with a provider-scoped
unique event ID and normalized payload hash. Processing serializes identical events with a
PostgreSQL transaction advisory lock. A valid exact-amount confirmation activates the competition
entry, creates its single active simulated trading account, writes the idempotent initial-balance
ledger entry, and records correlated audits in one database transaction. This applies to the mock
provider now and establishes the boundary for later providers; it does not authorize NOWPayments.

## Pending decisions

- starting balance per tier
- static vs trailing drawdown
- exact equity/balance rule
- daily loss rule
- instrument list
- leverage
- contract specs/spreads/commissions/swaps
- final leaderboard formula
- final prize/legal wording
- market-data vendor
