# Twelve Data Basic — Private Connectivity Testing

## Purpose and limit

This runbook verifies that a developer machine can authenticate to Twelve Data and receive the current
midpoint for the two existing development FX symbols. It is deliberately **not** a customer data feed.

Twelve Data's current Basic pricing identifies the free plan as internal, non-display usage, with 8 API
credits per minute and 800 credits per day. The application therefore keeps the response inside the
worker process: no browser, HTTP endpoint, WebSocket event, Valkey key, candle, database record, trading
engine, or log receives a provider price. The public stack remains on deterministic mock market data.

The implementation uses the documented `/price` endpoint and its supported comma-separated batch symbol
parameter for `EUR/USD` and `GBP/USD`. Twelve Data returns a midpoint rather than executable bid/ask
pricing, which is another reason it is not connected to simulated execution.

Official references, checked 31 August 2026:

- [Twelve Data price endpoint](https://twelvedata.com/docs/price-transform/ln)
- [Batch API requests](https://support.twelvedata.com/en/articles/5203360-batch-api-requests)
- [Individual pricing](https://twelvedata.com/pricing)
- [Forex price semantics](https://support.twelvedata.com/en/articles/11850499-understanding-price-deviations-in-commodities-and-forex-data)

## Local setup

1. Copy `.env.example` to the ignored `.env` if needed.
2. Obtain the API key privately from the Twelve Data dashboard. Never paste it into Git, chat, a Docker
   image, a browser environment variable, or an `ops` launch file.
3. In the local `.env`, set only:

   ```dotenv
   TWELVE_DATA_PRIVATE_TEST_ENABLED=true
   TWELVE_DATA_API_KEY=your-private-key
   # Five minutes × two symbols = at most 576 API credits/day.
   TWELVE_DATA_POLL_INTERVAL_MS=300000
   ```

4. Keep `MARKET_DATA_SOURCE=mock`. Start the local worker with `pnpm dev` (or its normal local Docker-
   dependency setup). The application validates that the test is development/test mode and that
   `NEXTAUTH_URL` is loopback-only before it starts.
5. Confirm the worker records a successful private-probe event showing only the symbol names and sample
   count. It must never show a price or API key.

## Client and infrastructure flow test

Use the deterministic mock feed when testing what customers see: registration, mandatory confirmation,
sign-in, checkout initiation, account provisioning after an approved payment callback, terminal delivery,
and realtime fan-out. The live `profitopath.com` deployment must keep:

```dotenv
MARKET_DATA_SOURCE=mock
MOCK_MARKET_DATA_ENABLED=false
TWELVE_DATA_PRIVATE_TEST_ENABLED=false
```

The server-only Twelve Data probe and the customer-flow test are intentionally separate. Do not enable a
Basic-plan key on the launch host or use it as a shortcut to a public terminal test.

## What is still required before Phase 9

Obtain a Twelve Data business plan and written authorization covering customer display, backend fan-out,
cache/retention, geographic limits, attribution, historical bars, and use as the input to simulated
execution. Then design the production adapter with a licensed bid/ask source (or approved spread policy),
historical provenance, outage/reconnect/backoff behavior, a private staging environment, and the Phase 9
correctness/load/recovery tests.
