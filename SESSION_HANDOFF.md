# Session Handoff

## Current state

Phase 9 is deployed in staff-only validation mode on the existing launch host at revision `49945eb`. The
product remains weekly simulated competitions only. There is no brokerage execution, customer
deposit/custody, funded account, or copy trading.

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

## Live deployment evidence and remaining work

- On 4 September 2026, `root@72.62.90.38:/opt/profitopath` applied the three trial migrations and the
  worker activation command created immutable EURUSD/GBPUSD version-2 trial configurations. Its first
  worker bootstrap persisted 20,258 bars, acquired the lease, and refreshed both quote-cache keys.
- `.env.launch`, `.env.market-data.launch`, `.env.worker.launch`, and the pre-switch backup are mode 0600.
  The common file does not contain the provider key; the web/realtime containers do not receive it. The
  internal endpoint rejected an invalid bearer token with HTTP 401.
- Public HTTPS home/readiness returned HTTP 200. The unauthenticated candle route returned HTTP 401. Browser
  validation found the active competition page's explicit internal-validation notice and three disabled
  checkout buttons.
- Realtime initially failed closed because it received neither worker-only boundary secret. `49945eb` scopes
  that validation to web/worker and the rebuilt realtime container now reports healthy. No provider data was
  emitted during that restart loop.
- The initially signed-in superadmin has one completed account in the frozen QA competition and no active
  account in the current validation competition. After deploying the next revision, run
  `pnpm --filter @profitopath/worker market-data:provision-twelve-data-trial-staff-account` through the
  protected worker compose environment. With exactly one active superadmin it selects that account; otherwise
  provide `TWELVE_DATA_TRIAL_STAFF_USER_ID` and, if needed, `TWELVE_DATA_TRIAL_COMPETITION_ID` for the one
  active validation competition. It is idempotent and creates an inactive zero-fee tier, active account,
  initial balance, and audit trail without any payment/revenue. Inactive staff tiers are excluded from public
  counts and leaderboards.
- Then do one owner-signed-in `ADMIN`/`SUPERADMIN` terminal smoke (view chart and quote, then a controlled
  order only if desired). Do not automate login or submit an order without the owner's active-session authority.
- Before the cutoff, set `MARKET_DATA_SOURCE=mock`, remove `.env.worker.launch`, restart the compose stack,
  and record the rollback unless the owner explicitly approves and records paid Twelve Data continuation.

The operative runbook is `15_TWELVE_DATA_TRIAL_ACTIVATION.md`. D-031 through D-033 are the controlling
market-data, access, and staff-account decisions.
