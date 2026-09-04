# Session Handoff

## Current state

Phase 9 is code-complete and awaiting the last step: a staff-only validation deployment to the existing
launch host. The product remains weekly simulated competitions only. There is no brokerage execution,
customer deposit/custody, funded account, or copy trading.

Twelve Data support wrote that the account's 12-day Unlimited trial is active until **13 September 2026**,
with 2,584 API credits and 2,500 WebSocket credits; it would require a $499 subscription afterwards. Their
message gives no expiry time or timezone. D-032 therefore fixes a conservative automatic cutoff of
`2026-09-13T00:00:00.000Z`. Do not extend it without a paid continuation explicitly authorized by the owner.

The owner authorized the public site remaining online only for internal validation. While
`MARKET_DATA_SOURCE=twelve-data-trial` is active:

- Only active `ADMIN`/`SUPERADMIN` accounts can receive trial chart/terminal/snapshot/realtime data or send
  trial order commands.
- The worker scopes recovery, mark-to-market, and pending-order processing to those staff accounts.
- `TRADER` websocket upgrades and terminal/data routes are denied; no provider event may affect their orders
  or positions.
- Public checkout is server-denied and the competition page visibly pauses new public entries.

This is not a commercial launch.

## Implementation delivered

- `TwelveDataMarketDataProvider` supports only EURUSD and GBPUSD. It uses the documented authenticated REST
  and WebSocket paths, derives server-owned executable bid/ask from D-031's full spreads (EURUSD `0.00012`,
  GBPUSD `0.00024`), reconnects safely, and stops at the cutoff. Twelve Data's FX event timestamp is
  minute-granular, so the adapter bounds the source timestamp then uses authenticated receipt time for quote
  freshness.
- The worker is elected by a Valkey lease, handles source-isolated historical backfill before subscription,
  records canonical `MarketDataCoverage` ranges, and persists `TWELVE_DATA_TRIAL` candles without mixing
  mock candles. Concurrent range work coalesces across workers.
- The web process has no provider key. It asks an authenticated worker-private endpoint for coverage and
  falls back to already persisted candles if the worker/upstream is unavailable.
- `docker-compose.launch.yml` now keeps secrets least-privileged: common `.env.launch` has no provider key;
  `.env.market-data.launch` (web + worker) contains the internal token and worker URL; `.env.worker.launch`
  (worker only) contains `TWELVE_DATA_API_KEY`.
- Migrations: `20260901130000_twelve_data_trial_instrument_configuration`,
  `20260901133000_market_candle_source_provenance`, and
  `20260904110000_market_data_coverage`. The final migration uses short PostgreSQL-safe index names.

## Local validation evidence

- Local PostgreSQL/Valkey worker smoke succeeded using the configured key without exposing it. It created
  local immutable version-2 trial instruments, bootstrapped 20,204 one-minute bars, acquired the lease,
  refreshed both quote cache keys, and successfully served a protected 27-bar historical range.
- After the smoke, local configurations were restored to active version-1 mock configs so ordinary database
  fixtures remain deterministic; version-2 trial configs remain inactive for audit only.
- Latest quality checks: Prisma validation/generation, typecheck, lint, production build, and the full
  PostgreSQL suite passed: **78 files / 231 tests**.
- Repository-wide `pnpm format` is expected to fail only on the user-preexisting unformatted
  `apps/realtime/src/protocol.test.ts`. Do not reformat or overwrite that user change. All Twelve Data files
  were formatted separately.

## Next deployment procedure

1. Commit the scoped Twelve Data changes only; do not include `marketing/`, `package-lock.json`, or the
   pre-existing `apps/realtime/src/protocol.test.ts` change.
2. Inspect `root@72.62.90.38` before deploying; preserve any unrelated host changes. The current deployment
   lives at `/opt/profitopath` and uses `docker-compose.launch.yml`.
3. On the host, create mode-0600 `.env.market-data.launch` with a fresh 32+ character
   `MARKET_DATA_INTERNAL_TOKEN` and `MARKET_DATA_WORKER_INTERNAL_URL=http://worker:3002`; create mode-0600
   `.env.worker.launch` with the existing Twelve Data key. Keep `TWELVE_DATA_API_KEY` out of `.env.launch`.
4. Set the common `.env.launch` trial configuration from
   `15_TWELVE_DATA_TRIAL_ACTIVATION.md`, including the conservative cutoff, fixed spreads,
   `TWELVE_DATA_TRIAL_STAFF_ONLY=true`, seven-day history cap, and disabled mock/private probe.
5. Validate compose without outputting secret values; pull/build, apply migrations, then run the worker-only
   activation command. Start the stack and verify health, a single lease acquisition, cache-key refresh, and
   source provenance.
6. Perform an authenticated browser staff terminal/order smoke and a non-staff denial smoke. Do not expose
   price values in terminal/log output. Keep checkout paused.
7. Before the cutoff, revert the common source to `mock`, remove the worker key file, restart, and record the
   rollback unless the owner explicitly approves and records paid Twelve Data continuation.

The operative runbook is `15_TWELVE_DATA_TRIAL_ACTIVATION.md`. D-031 and D-032 are the controlling market
data and access decisions.
