# Twelve Data Commercial Trial — Staff-Only Internal Validation

## Scope and expiry

Twelve Data support confirmed a 12-day Unlimited trial for the supplied Profitopath simulated-trading use
case. Their email reports 2,584 API credits and 2,500 WebSocket credits, ending on **13 September 2026**;
afterwards the provider requires a $499 full subscription. Retain the original correspondence outside Git.

The owner authorized a production-shaped, **staff-only internal validation** while the public website stays
online. This is not a commercial launch: new public entries are paused, and only active `ADMIN` or
`SUPERADMIN` accounts may receive trial candles/quotes, open the terminal or realtime connection, or submit
trial-backed orders. Non-staff accounts are denied before data delivery and excluded from worker recovery,
mark-to-market, and pending-order processing. Do not use this setting to serve customers, sell entries, or
continue after the trial.

The provider did not give an expiry time or timezone. The application must therefore stop no later than
`2026-09-13T00:00:00.000Z`; replace that with an earlier exact provider-confirmed time if obtained. Never
extend it to preserve trial access.

## Trial price policy

Twelve Data's WebSocket supplies a price but not bid/ask. Profitopath derives simulated executable sides
on the server from its provider midpoint and an explicit **full** spread. The browser receives the resulting
bid/ask only; it cannot inspect, set, or change the spread.

| Symbol | Provider symbol | Full synthetic spread | Basis                                             |
| ------ | --------------- | --------------------: | ------------------------------------------------- |
| EURUSD | `EUR/USD`       |  1.2 pips (`0.00012`) | Rounded up from IG's 1.13-pip all-session average |
| GBPUSD | `GBP/USD`       |  2.4 pips (`0.00024`) | Rounded up from IG's 2.38-pip all-session average |

The values are fixed, conservative trial rules, not vendor-supplied executable prices. Any new symbol,
variable-spread behavior, change to these values, or production continuation needs a new recorded decision.
The migration creates `marketDataSource` and `syntheticSpread` on each immutable
`InstrumentConfiguration` version. The worker refuses to become the feed leader until the active EURUSD and
GBPUSD versions both match the configured trial source and full spread.

References checked 1 September 2026:

- [Twelve Data API quickstart](https://twelvedata.com/docs/introduction/quickstart)
- [Twelve Data WebSocket guide](https://support.twelvedata.com/en/articles/5620516-how-to-stream-the-data)
- [Twelve Data WebSocket FAQ: no bid/ask](https://support.twelvedata.com/en/articles/5194610-websocket-faq)
- [IG current average FX spreads](https://www.ig.com/en/help-and-support/articles/691454-what-are-ig-s-forex-metatrader-product-details)

## Protected environment configuration

Store these values only in mode-0600 launch-host secret files. Do not put any token or provider key in Git,
an image layer, browser environment variable, CLI output, or chat. The compose configuration separates the
provider key from every process except the worker.

```dotenv
# .env.launch: shared non-provider configuration
MARKET_DATA_SOURCE=twelve-data-trial
MOCK_MARKET_DATA_ENABLED=false
# No later than this conservative fail-closed boundary.
TWELVE_DATA_TRIAL_ENDS_AT=2026-09-13T00:00:00.000Z
TWELVE_DATA_TRIAL_SPREAD_EURUSD=0.00012
TWELVE_DATA_TRIAL_SPREAD_GBPUSD=0.00024
TWELVE_DATA_TRIAL_STAFF_ONLY=true
TWELVE_DATA_TRIAL_HISTORY_MAX_MINUTES=10080
TWELVE_DATA_RECONNECT_INITIAL_MS=1000
TWELVE_DATA_RECONNECT_MAX_MS=30000
TWELVE_DATA_PRIVATE_TEST_ENABLED=false
```

```dotenv
# .env.market-data.launch: supplied only to web and worker
MARKET_DATA_INTERNAL_TOKEN=at-least-32-random-secret-characters
MARKET_DATA_WORKER_INTERNAL_URL=http://worker:3002

# .env.worker.launch: supplied only to worker
TWELVE_DATA_API_KEY=server-only-provider-key
```

Create both additional files with `chmod 600` (or equivalent) and keep `TWELVE_DATA_API_KEY` out of
`.env.launch`. The web process has no provider key: it calls the authenticated, worker-private historical
coverage endpoint, which limits every request to the configured seven-day range. The worker records coverage
durably and coalesces concurrent range requests with a Valkey lease.

`TWELVE_DATA_PRIVATE_TEST_ENABLED` is the earlier Basic-plan loopback-only probe and cannot be combined
with the commercial trial source.

## What the worker does

1. Competing worker replicas use a short-lived Valkey lease; only the elected worker opens the upstream
   Twelve Data WebSocket.
2. It authenticates upstream with the server-only key, subscribes only to `EUR/USD` and `GBP/USD`, and
   reconnects with bounded exponential backoff.
3. It backfills only canonical, missing UTC 1-minute ranges, records durable source coverage, validates each
   provider event, derives the configured bid/ask pair, assigns a monotonic shared sequence, publishes the
   quote to rebuildable Valkey, builds/persists server candles with `TWELVE_DATA_TRIAL` provenance, and then
   runs pending-order/risk processing for active staff accounts only.
4. A stale or missing quote leaves the terminal unable to execute; the browser cannot fabricate a price.
5. At expiry the elected runtime disconnects and releases its lease. The cache expires, so execution fails
   closed until the environment is reverted to `mock` or a separately approved paid source exists.

## Staff-only live validation procedure

1. Record the trial correspondence and exact expiry time outside Git.
2. Confirm `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` pass at the intended
   revision.
3. On the live host, create the two protected additional secret files above and confirm
   `docker compose --env-file .env.launch -f docker-compose.launch.yml config` succeeds without printing
   their values. The public site remains online, but its competition pages must show that new entries are
   paused during validation.
4. Apply migrations `20260901130000_twelve_data_trial_instrument_configuration`,
   `20260901133000_market_candle_source_provenance`, and `20260904110000_market_data_coverage`, then run
   `pnpm --filter @profitopath/worker market-data:activate-twelve-data-trial` in the protected worker
   environment. It creates a new immutable configuration version for each pair, deactivates the prior
   version for new orders, and writes an audit event. It is idempotent when the active source/spread already
   match.
5. Start the worker. Verify one `Twelve Data trial feed lease acquired` event and a historical-bootstrap
   summary; logs must name only symbols/counts, never prices or the key.
6. Verify both quote-cache keys refresh, the internal worker backfill endpoint accepts only its bearer
   secret, and one-minute candles carry `TWELVE_DATA_TRIAL` provenance.
7. As a staff account, exercise market, limit, stop, SL/TP, reconnect, worker failover, and stale-quote
   behavior. As a `TRADER` account, verify terminal, candle API, snapshot API, realtime upgrade, checkout,
   and order actions are denied or paused. Review audit/ledger records and source provenance.
8. Before the conservative cutoff, record either paid continuation terms or the completed rollback to
   `MARKET_DATA_SOURCE=mock`; stop and remove the provider credential. Do not run customer market data on
   an expired trial.
