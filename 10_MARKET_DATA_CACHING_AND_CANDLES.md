# Market Data Caching and Historical Candles

## Purpose

This document defines the required architecture for historical candlesticks and live market-data delivery.

It is intentionally separate from the main architecture documents.

Codex should treat this file as an additional authoritative implementation requirement when working on market-data, charting, simulator, realtime, and scalability tasks.

---

## Core rule

End users must **not** call the market-data provider directly.

The platform must never create one upstream historical-data request per user.

Use this pattern:

```text
Market-data provider
        ↓
Our MarketDataService
        ↓
Local historical candle store / cache
        ↓
Our API / WebSocket layer
        ↓
All users
```

Do not use this pattern:

```text
User A ───────→ provider
User B ───────→ provider
User C ───────→ provider
...
User N ───────→ provider
```

---

## Historical candle behavior

When a user opens a chart, for example:

```text
EURUSD
15m timeframe
```

the application should request candles from **our own backend**.

Example:

```http
GET /api/market-data/candles?symbol=EURUSD&timeframe=15m&limit=500
```

The backend must then:

1. check the local historical candle store;
2. determine whether the requested range is already complete;
3. return cached/local candles immediately when possible;
4. request only missing ranges from the upstream provider;
5. persist newly fetched candles;
6. return the complete ordered series to the user.

Multiple users requesting the same symbol/timeframe/range should reuse the same local data.

---

## Example

Assume 1,000 traders open:

```text
EURUSD
15m
```

within the same minute.

Bad implementation:

```text
1,000 users
→ 1,000 upstream historical API calls
```

Required implementation:

```text
First request
→ local cache miss
→ one upstream request
→ persist candles

Next 999 requests
→ local cache/database
→ zero duplicate upstream calls
```

Use request coalescing or a short-lived distributed lock so simultaneous cache misses do not trigger duplicate upstream calls.

---

## Persistent candle model

Historical bars should be persisted in a durable store.

Recommended PostgreSQL model:

```text
MarketCandle
- id
- symbol
- timeframe
- openTime
- closeTime
- open
- high
- low
- close
- volume nullable
- source
- isFinal
- createdAt
- updatedAt
```

Recommended unique key:

```text
(symbol, timeframe, openTime)
```

Use high-precision decimal types for price values.

Do not use JavaScript floating-point arithmetic for persistent prices where precision matters.

---

## Hot cache

Valkey may be used for:

- latest finalized candles;
- currently forming candles;
- recent candle windows;
- request coalescing locks;
- chart-response caching.

Valkey is not the permanent source of truth for historical bars.

If Valkey is lost, the system must rebuild recent cache state from PostgreSQL plus the latest market-data stream/provider.

---

## Bootstrap strategy

At first startup for a supported symbol:

```text
provider historical API
        ↓
backfill required base history
        ↓
persist locally
```

Do not repeatedly request the same historical range from the provider after it has been successfully stored.

The backfill depth must be configurable by symbol/timeframe.

Example defaults for development only:

```text
1m  → 7 days
5m  → 30 days
15m → 90 days
1h  → 1 year
4h  → 2 years
1d  → provider maximum / configured range
```

These are implementation defaults only and must remain configurable.

---

## Preferred timeframe strategy

Prefer storing a reliable lower/base timeframe and generating higher timeframes internally when practical.

Recommended base:

```text
1-minute candles
```

Higher candles can be derived:

```text
1m → 5m
1m → 15m
1m → 30m
1m → 1h
1m → 4h
```

Aggregation rules:

```text
Open  = first source candle open
High  = maximum source candle high
Low   = minimum source candle low
Close = final source candle close
Volume = sum of source candle volume when meaningful
```

Generated candles must use deterministic time-bucket boundaries.

Do not generate higher timeframes from incomplete lower-timeframe data without marking them incomplete.

---

## Live candle construction

After historical bootstrap, live quotes should update the currently forming candle.

Architecture:

```text
Provider WebSocket / live stream
        ↓
normalized Quote
        ↓
CandleBuilder
        ↓
current 1m candle
        ↓
finalize at bucket close
        ↓
persist PostgreSQL
        ↓
derive higher timeframes
        ↓
publish chart update
```

Users should not require repeated historical REST calls to see new candles.

---

## Live vs historical handoff

When a user opens a chart:

1. load historical finalized candles from our backend;
2. subscribe the browser to our realtime channel;
3. send the current forming candle;
4. update the current candle from live quotes;
5. finalize it server-side at timeframe boundary;
6. append the next forming candle.

Avoid gaps and duplicate candles at the historical/live boundary.

The server must use canonical timestamps/timezone rules.

---

## Lazy loading older history

Charts should support scrolling left.

When the user requests older data:

```text
current earliest candle = T
```

backend checks whether older local data exists.

If yes:

```text
serve immediately
```

If missing:

```text
fetch only missing range upstream
→ persist
→ return
```

Never fetch the entire available history on every scroll action.

---

## Upstream request deduplication

Implement a request-coalescing strategy.

Example key:

```text
history:EURUSD:15m:2026-08-01T00:00:00Z:2026-08-08T00:00:00Z
```

If one worker is already fetching that range:

```text
other workers wait/reuse result
```

Do not allow a burst of identical user requests to create a provider request storm.

A distributed lock with timeout or an in-flight request registry is acceptable.

---

## Rate-limit protection

The market-data adapter must expose rate-limit awareness.

Required behavior:

- track provider response codes;
- respect documented rate limits;
- use exponential backoff;
- handle HTTP 429 explicitly;
- queue non-urgent historical backfills;
- never retry aggressively;
- expose provider health metrics;
- surface stale/missing data states to operators.

Historical chart loading must degrade gracefully rather than overloading the provider.

---

## Provider abstraction

Do not couple chart code or simulator code directly to a vendor.

Use an interface similar to:

```ts
interface MarketDataProvider {
  getHistoricalBars(input: HistoricalBarsRequest): Promise<Bar[]>;
  subscribe(symbols: string[]): Promise<void>;
  onQuote(handler: (quote: Quote) => Promise<void>): void;
  getLatestQuote(symbol: string): Promise<Quote>;
}
```

The rest of the application should talk to `MarketDataService`, not directly to the provider implementation.

---

## Commercial licensing requirement

Technical API capacity is not enough.

Before a real provider is used in production, obtain explicit rights for:

- customer-facing real-time display;
- customer-facing historical chart display;
- simulated trading/execution reference use;
- redistribution to the expected number of end users;
- storage/caching of historical data;
- creation of derived candles/timeframes if applicable.

Do not assume that an individual or developer API plan permits commercial redistribution.

The vendor contract should be reviewed against the expected usage:

```text
10,000 registered users
5,000 concurrent active traders
50–100 instruments
browser-based simulated trading
real-time prices
historical charts
```

---

## Scalability expectations

The number of users must not determine the number of upstream historical requests.

Example:

```text
5,000 users
30 symbols
7 timeframes
```

The potential distinct chart datasets are closer to:

```text
30 × 7 = 210 logical series
```

not 5,000 separate provider histories.

Actual request volume should be driven primarily by:

- missing ranges;
- symbol coverage;
- newly requested history depth;
- cache expiration/revalidation policy;

not by the raw number of users.

---

## Browser responsibilities

The browser may:

- request historical candles from our backend;
- render candles;
- receive realtime candle updates;
- request older ranges;
- render order/trade markers.

The browser must not:

- hold provider API keys;
- call the market-data vendor directly;
- build authoritative candles from client-local timestamps;
- be the source of truth for market data;
- decide whether a candle is final.

---

## Trade markers

Historical charts should support persistent trading markers sourced from our own trading ledger.

Examples:

- order submitted;
- execution/fill;
- position opened;
- partial close if supported;
- position closed;
- stop loss;
- take profit.

When a trader logs out and returns later, these markers must be reconstructed from PostgreSQL and rendered on the chart.

---

## Failure behavior

If historical-data provider requests fail:

- serve existing cached history when available;
- clearly mark missing/stale ranges;
- do not fabricate candles;
- queue retry where appropriate.

If live market data fails:

- stop creating fake live candles;
- mark symbols stale;
- pause simulated order execution where required by trading rules;
- record the outage;
- resume only after valid data is restored.

---

## Testing requirements

Codex must eventually add tests for:

1. cached range returns without upstream call;
2. missing range triggers one upstream call;
3. 100 simultaneous identical requests result in one upstream fetch;
4. fetched bars are persisted;
5. duplicate bars are not inserted;
6. candle ordering is deterministic;
7. 1m → 5m aggregation;
8. 1m → 15m aggregation;
9. incomplete bucket handling;
10. live quote updates current candle;
11. candle finalization;
12. historical/live handoff has no gap;
13. historical/live handoff has no duplicate;
14. lazy-loading older ranges;
15. provider 429/backoff behavior;
16. Valkey loss/rebuild behavior;
17. trade markers reload after session restart.

---

## Codex integration instruction

When Codex begins any task related to:

- market data;
- charting;
- historical bars;
- realtime quotes;
- candle generation;
- simulator pricing;
- WebSocket market-data delivery;
- market-data scaling;

it must read this file before implementation.

If this document conflicts with an older implementation detail, prefer this document for market-data caching and historical-candle behavior unless `DECISIONS.md` contains a newer explicit superseding decision.
