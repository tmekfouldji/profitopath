# TraderMade Trial Activation Gate

## Current evidence — 24 August 2026

TraderMade offered an FX plan starting at £599 (with a possible startup discount) or a £199 deposit
for a seven-day refundable trial. They asked us to reply before sending a payment link and said
commercials can be discussed after the data is tested.

This is a pricing/trial offer. It is **not** written permission to display or redistribute data to
our clients, cache/fan out quotes, retain historical evidence, or use the data as the basis for
simulated execution. It also supplies no official API documentation or credential specification.

## Environment status

The running services accept `MARKET_DATA_SOURCE=mock` only. Any other value fails configuration
validation at startup. `MOCK_MARKET_DATA_ENABLED=true` remains the sole feed switch in the local
production-shaped environment.

Do not put a payment URL, invoice, API credential, account identifier, or provider documentation in
Git, `.env.example`, `.env.container.example`, Docker image layers, browser code, or chat logs.
Store real credentials only in the chosen secret manager / the ignored local runtime environment
after the gates below are complete.

## Before accepting the payment link

Reply to TraderMade requesting written confirmation for this exact use case:

> We operate a browser-based simulated trading and weekly competition platform. End users trade
> fictitious balances only; we do not route customer capital or provide brokerage execution. May we
> use the paid trial and, if successful, the production plan to: (1) display real-time FX prices to
> authenticated paying end users, (2) consume one or a small number of upstream connections on our
> backend and fan out normalized bid/ask quotes to those users, (3) cache and retain historical
> candles/quotes for charting, audit, and dispute evidence, and (4) use those prices solely as
> server-side inputs to our simulated execution engine? Please identify any user, display,
> redistribution, cache, retention, attribution, concurrency, instrument, and geographic limits.
> Please also send the official streaming and historical-data API documentation, credential format,
> rate limits, symbol/session rules, trial restrictions, and the applicable terms.

The payment link can be accepted only after the owner is comfortable with the trial charge/refund
terms. Payment itself does not clear the product/legal gate above.

## Required artifacts before implementation

Record all of the following in `PROJECT_STATE.md` and link or attach the official material:

1. Written authorization for customer-facing display, backend fanout/redistribution, cache/retention,
   and simulated execution.
2. Official REST and streaming API documentation, including authentication and current version.
3. Trial and production entitlements: symbols, bid/ask versus mid/last, historical timeframes,
   concurrent connections, per-user/display fees, limits, allowed geographies, and attribution.
4. Rate limits, reconnect/backoff requirements, heartbeat/session semantics, market hours, outage and
   correction policies, and support/SLA contacts.
5. A trial credential and non-production account reference delivered through a private channel.

## Activation sequence after the artifacts arrive

1. Keep `MARKET_DATA_SOURCE=mock`; do not paste the credential into the repository.
2. Expand Phase 9 tasks from the official documentation. Implement and test a backend-only adapter,
   a provider-specific secret contract, normalized bid/ask validation, reconnect/backoff, rate limits,
   historical range coalescing, persistent candle provenance, and fail-closed outage behavior.
3. Test against the trial only in an isolated non-production environment. Verify that browsers never
   call TraderMade and that a single backend stream is fanned out through Valkey/realtime.
4. Obtain a second review that the implementation matches the written commercial terms.
5. Change the source gate only in the approved trial environment, deploy, and run the Phase 9
   correctness/recovery/duplicate-event/load tests before enabling any client-facing display.

No adapter endpoint, authentication scheme, symbol mapping, or provider API behavior may be inferred
from the pricing email. Until the preceding steps are complete, mock market data remains the only
authorized source.
