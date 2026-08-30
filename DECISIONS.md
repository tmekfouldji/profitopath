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

## D-015 — Versioned development simulator accounting policy

Status: Accepted for development

Phase 4 seeds version-one EURUSD and GBPUSD mock specifications with USD quote currency, 100,000
contract size, 100:1 leverage, and 0.01 minimum/step quantity. These are reversible development
defaults, not approved production instruments or leverage. Market buys fill at ask, sells at bid,
P&L converts to account minor units using half-even rounding, and positive margin requirements round
up. Until the final rule decision, mock drawdown is static from initial balance and breaches when
current drawdown is greater than or equal to the tier threshold. Every persisted trading record
captures its instrument version; changing this policy requires a new configuration/rules version.

## D-016 — Deterministic development pending-order trigger policy

Status: Accepted for development

Phase 5 evaluates triggers only on validated server-owned normalized quotes, serialized by trading
account and processed in stable acceptance/ID order. Buy limits use ask at or below the limit; sell
limits use bid at or above it; buy stops use ask at or above the stop; sell stops use bid at or
below it. Long protection evaluates executable bid and short protection executable ask. A triggered
limit fills at the current executable quote (never worse than its limit under the trigger rule),
while stop/SL orders fill at the current executable quote and therefore preserve deterministic gap
slippage. Development market hours are versioned as UTC 24x5; this is a reversible mock schedule,
not an approved production session calendar. SL/TP orders protect the full current net position and
form an OCO pair. Account advisory locks and quote-sequence event keys make trigger, cancellation,
and replay outcomes atomic and idempotent.

## D-017 — Durable deterministic mock candle history

Status: Accepted for development

Phase 6 uses explicitly sourced deterministic `MOCK_SEED` one-minute candles for browser-terminal
development, persisted in PostgreSQL under the canonical `(symbol, timeframe, openTime)` key.
Higher development timeframes are derived only from complete finalized UTC-aligned one-minute
buckets with exact Decimal OHLC aggregation; forming mock candles use the exact bid/ask midpoint.
Concurrent identical local range requests coalesce in the service process; Valkey may cache hot
results and current quotes but remains rebuildable. Missing mock history returns an explicit
incomplete/empty response and is never silently fabricated as live or production provider data.
This establishes the backend-owned chart boundary required by
`10_MARKET_DATA_CACHING_AND_CANDLES.md` without authorizing an upstream provider, commercial data
use, or production backfill/rate-limit behavior.

## D-018 — Versioned development leaderboard ranking policy

Status: Accepted for development

Phase 7 policy version one follows the product-spec proposal without claiming final commercial rule
approval. Eligible entries have active/completed entry and account states, no rule breach, and no
disqualification. Each tier ranks independently by exact net performance, then lower maximum
observed drawdown, earlier time the final score was reached, and earlier entry activation. Entries
still equal after all four approved development criteria share the same competition rank; entry ID
is used only for deterministic display order and does not break the tie. PostgreSQL-authoritative
cutoff inputs and the policy version must be retained with final results. Changing these semantics
requires a new policy/rules version. This decision does not alter or approve prize allocations.

## D-019 — Weekly cutoff uses the last authoritative valuation

Status: Accepted for development

At the configured UTC competition end, Phase 7 serializes against each simulator account, expires
accepted orders, captures the latest PostgreSQL account snapshot at or before cutoff, completes
still-active accounts/entries, and freezes the competition. Open positions are not assigned an
invented cutoff fill or synthetic execution; their last authoritative server valuation is retained
as the development leaderboard equity input. Missing snapshots are explicitly ineligible rather
than fabricated. Cutoff score inputs, maximum observed drawdown, final-score time, policy version,
and audit correlation are persisted. Final production rules may instead require a documented
provider close/forced-liquidation policy; adopting one requires a new rules version.

## D-020 — Administrative disqualification remains open until finalization

Status: Accepted for development

An authenticated active ADMIN may disqualify an active entry during trading or a completed entry
during the frozen review window, but never after the leaderboard is finalized. The command
serializes with competition lifecycle and simulator-account work, requires a retained reason,
cancels accepted orders, transitions the entry/account together, and records actor-attributed
audits. Frozen cutoff values remain unchanged for evidence; only their eligibility status changes
to `DISQUALIFIED`, so recompute removes the entry without rewriting its score. This review control
does not approve prizes or change prize amounts.

## D-021 — Worker finalization is available but opt-in during development

Status: Accepted for development

Every worker discovers scheduled, active, and frozen competition work from PostgreSQL on a
configurable interval; no replica list or local job ledger is authoritative. Existing competition
and simulator advisory locks serialize overlapping replicas, while self-scheduling after completion
prevents local overlap and makes failures retry on the next cycle. Live/frozen recompute runs by
default. Automatic frozen-result finalization is implemented behind
`AUTO_FINALIZE_FROZEN_COMPETITIONS` but defaults to false because no review-window duration has been
approved; administrators can finalize idempotently in the meantime. Enabling the flag does not
change ranking or prize economics.

## D-022 — Prize operations bind configured awards and require manual dual control

Status: Accepted for development

Phase 8 never calculates or seeds prize economics. Administrators may derive only preconfigured
development `Prize` rows from immutable finalized standings, retaining the finalization, standing,
and result-hash provenance. A configured rank shared by true ties remains explicitly unresolved;
the system does not choose a winner, split an amount, or invent a tie allocation. Winner review and
KYC are manual recorded states. Prize approval creates an exact amount/currency payout, a different
administrator must approve that payout, and a different administrator from the payment recorder
must reconcile it. The platform performs no payout provider call. Only a paid and reconciled
fifth-place prize can issue its configured count of individually tracked single-use access credits;
credits are not money, customer custody, or a stored-value balance, and checkout redemption remains
out of scope until separately designed and tested. Final prize formula, legal wording, KYC timing,
and production payout procedures remain pending decisions.

## D-023 — NOWPayments uses server-owned hosted invoices and signed IPN only

Status: Accepted for implementation; production activation pending

The application uses NOWPayments' documented `POST /v1/invoice` hosted checkout directly from the
server rather than routing customer checkout through the agent-facing MCP wrapper. Each invoice sends the
immutable local `Payment.id` as `order_id`; the provider invoice ID and eventual payment ID are retained
separately, and only a raw-body IPN with a valid recursively sorted HMAC-SHA-512
`x-nowpayments-sig` can update state. NOWPayments `finished` is the sole status mapped to confirmed entry
provisioning after exact USD-cent validation; waiting, confirming, sending, and partially-paid states do
not activate fictitious capital. API and IPN secrets are server-only, `PAYMENT_PROVIDER=mock` remains the
default, and no payouts, custody, customer balance, fiat, or browser-authoritative payment action is
introduced. This code decision does not establish merchant acceptance, legal approval, or permission to
enable real checkout.

## D-024 — Paid scheduled entries are preorders, not early trading access

Status: Accepted for the September 2026 preorder launch

A completed NOWPayments payment for a scheduled competition reserves that tier and provisions its
simulated account through the existing audited payment flow, but it does not grant trading-terminal
access before the competition is active and its trading window has begun. The dashboard labels this
state as a confirmed preorder; payment submission remains pending until the signed provider IPN has
been processed. This does not change entry fees, competition dates, prize economics, simulated-capital
amounts, or market-data requirements. `PAYMENT_PROVIDER=nowpayments` is enabled only in the deployed
environment after the secret-manager, public-HTTPS, and smoke-test checks in the preorder runbook.

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
