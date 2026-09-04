# Project State

This file is the authoritative high-level state for Codex.

## Current status

- Product: weekly simulated trading competitions only
- Trading platform: first-party browser simulator
- Repository: single GitHub monorepo
- Cloud target: DigitalOcean
- Payment target: NOWPayments hosted invoices, preorder implementation and launch composition complete;
  repository/local default remains mock while the protected launch host uses NOWPayments
- Legal/company working assumption: SVG Business Company, final approval pending
- Current implementation phase: **Phase 9 — Twelve Data commercial-trial staff-only live validation
  (server-owned, time-limited; Phase 10 checkout operations remain separate)**
- Production deployment: `https://profitopath.com` is served over valid HTTPS from the launch host. Docker
  Caddy/web/realtime/worker services and private PostgreSQL 17/Valkey 8 containers are healthy; migrations
  through `20260904110000_market_data_coverage` are applied. Revision `49945eb` is deployed with the
  staff-only Twelve Data trial configuration; its Basic probe is explicitly disabled on the production host.
  On 31 August 2026 the owner
  authorized a short-lived `QA-FLOW-20260831-1750` terminal-flow competition and a complimentary, audited
  Rookie simulated account for the verified owner account; it records no payment or revenue. The worker's
  server-owned deterministic mock feed is enabled for this controlled QA flow and continues to be the only
  customer-delivered quote source. The launch database now has the explicit, audited active version-1 EURUSD
  and GBPUSD simulated-instrument configurations required by that feed, and the browser terminal has been
  verified with live mock prices plus an enabled server-authoritative ticket.
- Production-shaped local Docker environment: complete and verified
- Real market-data integration: Twelve Data support has authorized the stated use for a 12-day trial ending
  13 September 2026. The EURUSD/GBPUSD adapter, source-isolated historical coverage/candle persistence,
  elected worker runtime, and worker-only secret boundary are complete. Local credentialed validation
  succeeded: 20,204 initial one-minute bars persisted, both quote-cache keys refreshed, and the protected
  worker endpoint backfilled a fresh 27-bar range. The staff-only live-host deployment also succeeded:
  20,258 bars bootstrapped, both cache keys refreshed, public checkout paused, unauthenticated candle access
  denied, and worker backfill bearer authentication rejected invalid callers. The active competition initially
  had no staff account; the protected, idempotent complimentary staff-account provisioner is now deployed and
  created the sole active superadmin's inactive-zero-fee-tier account, its initial-balance ledger record, and
  three audit events with no associated staff-tier payment. The public site stays online but does not sell new
  entries or deliver trial data to non-staff, and the runtime stops no later than `2026-09-13T00:00:00.000Z`
  unless an earlier exact expiry is supplied.
- Terminal live-feedback validation: the trading desk now preserves the trader's chart viewport during
  server-authoritative TP/SL edits, applies execution markers in place, and receives a post-simulation
  account-state signal so filled orders appear without a follow-up action or page reload. Fast quote delivery
  is decoupled from the ordered candle/simulator path; it remains server-owned and preserves persistent
  processing order. The compact instrument rail renders every active server configuration, shows live
  bid/ask-derived spread, and remembers account-local favorites in the browser. It currently lists EURUSD and
  GBPUSD because those are the only active server configurations, not because the provider trial lacks a wider
  catalogue. Any additional simulated instruments still require a configured contract and server-owned spread.
  This release is deployed on the launch host: web, realtime, and worker passed their Docker health checks;
  public HTTPS readiness returned HTTP 200; and the worker re-acquired its staff-scoped EURUSD/GBPUSD feed lease.
- Terminal interaction continuity: the chart uses Lightweight Charts' free crosshair mode rather than OHLC
  magnetization, while the existing Ctrl drawing modifier remains the deliberate way to snap annotations to a
  candle. The terminal also restores an account-local selected-symbol preference only when that symbol is still
  active in the server configuration.
- Terminal execution and timeframe workflow: persisted history returns immediately while coverage refreshes in
  the background; aligned, versioned timeframe requests and an idle warm-up prevent slow or out-of-order chart
  changes. The ticket exposes Buy Bid/Market/Limit/Stop and Sell Ask/Market/Limit/Stop. Limit and stop selections
  arm a draggable provisional chart price before the owner explicitly places the server-authoritative pending
  order. Unset TP/SL are compact controls beside the position entry instead of false full-width protection levels.
- Real payment integration: backend hosted-invoice and signed-IPN path complete; paid scheduled entries
  are preorders and `PAYMENT_PROVIDER=mock` remains the repository/local default. The protected launch host
  is configured for `PAYMENT_PROVIDER=nowpayments`; raw credentials remain server-only.

## Active milestone

Phase 0 through Phase 8 and the Phase 10 backend integration are complete. On 1 September 2026, Twelve
Data support confirmed a 12-day Unlimited trial through 13 September 2026 with 2,584 API credits and
2,500 WebSocket credits, approved the supplied customer-display/fan-out/cache/simulated-execution use
case for that period, and stated that a $499 full subscription is required after trial. The source email
must be retained outside Git. This unblocks only a time-limited server-owned trial integration: Twelve
Data's documented feed has no bid/ask, so D-031 records fixed server-side synthetic trial spreads of 1.2
pips for EURUSD and 2.4 pips for GBPUSD. The Phase 9 adapter and single-subscriber worker pipeline are
implemented, including worker-owned historical backfill/range coalescing, local credentialed smoke, and
staff-only live deployment. The active superadmin's audited staff account is provisioned; the remaining
validation is an owner-signed-in staff terminal/order smoke. Public checkout remains paused and non-staff
cannot receive or trigger on provider data. The deployment must
revert to mock no later than `2026-09-13T00:00:00.000Z` unless a paid continuation is explicitly recorded.
On 30 August 2026, the product
owner reported NOWPayments approval and receipt of the merchant API key, and requested a preorder launch
before the market-data rollout. That key is not present in the repository or this runtime. On 24 August 2026, TraderMade offered pricing and a paid,
seven-day refundable trial, but stated that commercial terms can be discussed after testing. The reply
does not supply official API documentation or confirm rights for customer-facing chart display,
caching/fanout, or simulated execution. TraderMade remains blocked. Twelve Data Basic pricing/docs support
only a loopback, non-display `/price` connectivity probe (D-030), but the separate D-031 commercial trial
authorization governs the explicitly limited Twelve Data trial implementation. The NOWPayments implementation follows its documented
hosted-invoice and IPN flow, but production activation remains blocked on merchant acceptance, SVG legal
approval evidence retention, secret-manager provisioning, final public origin/DNS, a public HTTPS IPN
endpoint test, an explicit launch competition schedule, and managed PostgreSQL/Valkey endpoints. The
designated Ubuntu launch host now has the temporary, private single-host PostgreSQL/Valkey exception
approved by the product owner; it has no off-host backup and must migrate before the market-data/trading
launch. Public credential registration now also requires working Zoho SMTP delivery because unverified
accounts cannot sign in. The production SMTP transport authenticated successfully on 30 August 2026 and a
verification-email resend was accepted by Zoho. The non-secret public DNS is live and Caddy issued a valid
certificate. A controlled real invoice/IPN smoke test and first approved competition schedule remain.

## Phase 0–1 completion evidence

- pnpm monorepo initialized
- apps/packages skeleton exists
- local Postgres + Valkey through Docker Compose
- Prisma configured
- all initial domain entities/states implemented
- audit trail foundation implemented
- seeds implemented
- tests for states/money/decimals/persistence pass
- lint/typecheck/tests pass
- GitHub Actions CI passes
- README contains exact local commands
- TASKS / PROJECT_STATE / SESSION_HANDOFF updated

All items above are complete, including the service-backed GitHub Actions run.

## Definition of done for Phase 2

- Auth.js-compatible registration, login, logout, and session foundation
- trader dashboard shell
- admin RBAC shell with server-side authorization
- competition list/detail pages backed by persisted data
- empty trading-terminal route protected by account ownership
- authentication/authorization tests
- formatter, typecheck, lint, tests, build, and GitHub Actions pass
- project memory and handoff updated

## Phase 2 completion evidence

- Auth.js-compatible Prisma account/session/token models and isolated password credentials
- salted scrypt password hashing, normalized registration, and generic credential failures
- typed JWT sessions with database-refreshed role/status revocation
- registration, login, logout, trader dashboard, and server-side admin RBAC
- persisted competition list/detail pages and deterministic next-week development seed
- account-owned terminal shell with no client-authoritative trading operations
- responsive weekly trading-desk UI verified at desktop and 390px mobile widths
- unit coverage for passwords, registration, money formatting, and authorization
- PostgreSQL integration coverage for the authentication relation graph and weekly seed
- GitHub Actions passed migration deploy, seed, Compose validation, all 20 tests, and build

## Phase 3 completion evidence

- deterministic signed `MockPaymentProvider` behind the provider-neutral interface
- authenticated tier selection, mock checkout, confirmation, dashboard completion, and admin view
- persisted checkout URL/expiry and immutable provider-event receipt migration
- exact-amount payment validation and provider-scoped event idempotency
- PostgreSQL advisory-lock serialization for concurrent duplicate provider events
- one-transaction payment confirmation, entry activation, account provisioning, initial ledger, and
  correlated audit writes
- unit and PostgreSQL coverage for eligibility, retries, ownership, amount mismatch, concurrent
  duplicates, exact starting balance, ledger idempotency, and invalid terminal transitions
- GitHub Actions passed migration deploy, seed, Compose validation, all 30 tests, and build

## Phase 4 completion evidence

- normalized quote validation and deterministic mock quote replay with server-owned subscriptions
- versioned exact EURUSD/GBPUSD development instrument configurations and idempotent seeds
- Decimal-only spread, fill, netting, realized/unrealized P&L, margin, equity, and free-margin math
- PostgreSQL-authoritative market orders, executions, positions, closed trades, balance ledger,
  snapshots, drawdown breaches, and correlated audit events
- account-level transaction serialization plus client-order, engine-event, and quote idempotency
- static initial-balance development drawdown enforcement at the exact configured boundary
- restart recovery from PostgreSQL and an opt-in worker-owned deterministic mock feed
- local non-database tests and production build passed; GitHub Actions run `32550183420` passed the
  migration, seed, Compose validation, all 50 tests, and production build

## Phase 5 completion evidence

- durable limit/stop and linked full-position SL/TP orders with OCO and trigger quote metadata
- versioned UTC 24x5 development market hours and exact executable bid/ask trigger policies
- account-serialized, replay-safe quote triggers with deterministic limit/gap fill behavior
- idempotent cancellation and terminal-state-safe trigger/cancel race handling
- protection quantity reconciliation on net reductions/increases and atomic cleanup on close/reverse
- active pending/protective order recovery, offline worker trigger-before-risk processing, and cutoff
  expiry
- GitHub Actions run `32550829142` passed migration deploy, seed, Compose validation, all 62 tests,
  and production build

## Phase 6 completion evidence

- exact PostgreSQL mock candle persistence, idempotent weekday-aligned 1m history, and complete
  Decimal 5m/15m/1h aggregation with deterministic UTC buckets and range coalescing
- rebuildable Valkey quotes with expiry/staleness enforcement, monotonic worker sequences,
  server-owned forming/final candle publication, and no closed-market mock publication
- ownership-scoped terminal snapshots/candle APIs and authoritative market/limit/stop/cancel/SL/TP
  server actions that fail closed without a current quote
- authenticated account WebSocket upgrades, snapshot-before-delta resync, typed quote/candle
  envelopes, stale/offline execution states, and reconnect handling
- responsive Lightweight Charts terminal with bounded older-range loading, historical/live dedup,
  persistent execution markers, risk rail, account metrics, order ticket, positions, pending orders,
  executions, closed trades, and fictitious-capital disclosure
- direct unit, API/action, browser-component, Valkey-boundary, and PostgreSQL integration coverage
- GitHub Actions run `32552180252` passed migration deploy, seed, Compose validation, all 83 tests,
  and production build

## Phase 7 completion evidence

- versioned exact eligibility/ranking with tier isolation, every proposed tie break, true shared
  ranks, stable display fallback, and retained PostgreSQL cutoff inputs
- serialized exact-UTC activation/cutoff under competition/account locks, accepted-order expiry,
  authoritative last-snapshot capture, account/entry completion, and restart-safe replay
- PostgreSQL-only live/frozen recompute, canonical SHA-256 results, immutable standings, concurrent
  duplicate finalization safety, and frozen-to-finalized audit transition
- server-authorized lifecycle/recompute/finalize/archive controls plus reason-required active/frozen
  disqualification that preserves cutoff evidence and changes only eligibility
- public live/frozen/final/archive tier boards with safe display identity and UTC/policy/hash
  provenance, plus authenticated trader eligibility/rank/tie/performance/drawdown projections
- PostgreSQL-discovered worker cycles with cross-replica locks, local overlap prevention, retry after
  restart, and opt-in auto-finalization while the unapproved review duration keeps it off by default
- unit, action, browser-render, concurrency, PostgreSQL persistence, archive, lifecycle-boundary, and
  worker-recovery coverage
- GitHub Actions run `32554024772` passed migration deploy, seed, Compose validation, all 115 tests,
  and production build

## Phase 8 completion evidence

- forward-only prize-operations migration with immutable standing/finalization/hash provenance,
  explicit winner and KYC reviews, separate approval actors, reconciliation evidence, and durable
  single-use free-entry entitlements without a monetary/customer balance
- competition-serialized idempotent derivation from preconfigured development prize rows only;
  missing awards fail closed and true tied prize ranks remain unresolved without changing economics
- audited winner confirmation/rejection, manual KYC state graph, exact prize-to-payout creation,
  second-administrator payout approval, and amount/currency mismatch rejection
- manual payout processing, failure/retry/cancellation, unique transaction-reference recording,
  immutable paid state, second-actor reconciliation, and atomic fifth-place credit issuance with no
  provider call
- ADMIN-only prize operations console plus ownership-scoped trader prize/credit state that omits
  internal transaction/audit evidence and labels all company-funded/manual development limitations
- unit, authorization/action, browser-render, concurrency, PostgreSQL persistence/ownership,
  missing/tied/mismatch/duplicate-reference, reconciliation, audit, and credit coverage
- GitHub Actions run `32554756501` applied all eight migrations and passed Compose validation,
  formatter, typecheck, lint, all 127 tests, and production build

## Phase 10 preorder activation evidence — public deployment verified

- versioned provider-neutral payment contract and Prisma migration retain provider invoice and actual
  payment IDs separately, preserving invoice-to-IPN/order correlation and provider-scoped replay safety
- server-only NOWPayments `POST /v1/invoice` hosted checkout sends exact integer-derived USD cents and an
  immutable local payment ID as `order_id`; browser clients never receive API/IPN credentials or wallet UI
- `/api/payments/nowpayments/ipn` receives raw IPN bodies, checks the recursively sorted HMAC-SHA-512
  `x-nowpayments-sig`, and rejects invalid, mismatched, regressive, or duplicate-conflicting events
- only signed NOWPayments `finished` maps to the existing quoted-amount `CONFIRMED` activation path;
  waiting, confirming, partially paid, and sending states remain non-provisioning. NOWPayments Payment
  covering is configured at 10%, so the provider may emit `finished` when it accepts an actual deposit at or
  above 90% of the quoted crypto equivalent; Profitopath does not locally promote a partial callback.
- `PAYMENT_PROVIDER=mock` remains the default. `PAYMENT_PROVIDER=nowpayments` requires both
  server-only NOWPayments secrets and an HTTPS non-localhost callback origin
- scheduled entries now render as preorders after a confirmed payment; the dashboard withholds the trading
  terminal until the competition is active and its scheduled window has begun
- `docker-compose.launch.yml` and `ops/Caddyfile.launch` define a single-host launch deployment with
  Caddy TLS, a same-origin `/realtime` WebSocket proxy that preserves host-only auth cookies, private
  web/realtime/worker services, and externally managed PostgreSQL/Valkey; the secret-safe variable
  inventory and smoke/rollback procedure live in `13_PREORDER_PAYMENT_ACTIVATION.md`
- local PostgreSQL migration applied successfully; `pnpm db:validate`, `pnpm db:generate`, formatter,
  typecheck, lint, production build, and all 191 database-backed tests passed
- `SUPERADMIN` is distinct from operational `ADMIN`: `/superadmin` provides authoritative member, daily
  anonymous-visitor, active-member, confirmed-revenue, account, and configuration-readiness reporting.
  It never displays, stores, or accepts raw API keys in the browser.
- registration creates a hashed, single-use, 60-minute email-verification token and sends it only through
  configured SMTP. A credential password cannot sign in until confirmation; resends are generic,
  rate-limited, and audited. Zoho SMTP authenticated successfully on the launch host using SSL port 465.
- Password recovery is implemented with a separate forward-only reset-token table. Requests do not disclose
  whether an account exists; accepted reset replaces the credential, consumes all reset tokens, audits the
  event, and invalidates earlier credential JWTs through a monotonic user credential version.

## Last completed task

P10-005 — NOWPayments hosted-invoice, IPN, persistence, and verification quality gate. The preorder UX
and launch composition have since been implemented and verified as part of P10-006.

## Next task

P10-006 — complete the controlled live-checkout test and approve the first preorder competition schedule.
The host is reachable as `root@72.62.90.38`; Caddy, web, realtime, worker, private PostgreSQL/Valkey, and
`https://profitopath.com` are healthy. Protected SMTP and NOWPayments credentials are loaded, runtime modes
are `smtp` and `nowpayments`, and Zoho accepted a confirmation-email resend. The deployed owner control center
at `/superadmin` can create versioned active tiers, draft/publish future UTC competitions, manage eligible user
roles/statuses, review revenue/payments, and enter the dual-review payout workflow. Run the documented
exact-amount invoice/signed-IPN smoke test before promoting checkout, then use its Competition and Challenge
sections to approve the first `SCHEDULED` competition.
`www.profitopath.com` canonically redirects to the root domain.
P10-010 password recovery is deployed at `/reset-password`; migration
`20260830211500_password_reset_recovery` applied successfully and its public reset page/API health smoke
tests passed. P10-011 evergreen preorder entitlement is explicitly scoped but needs approved
pricing/expiry/refund policy. P9-T-002 still awaits a privately entered local Twelve Data API key for the
separate non-display probe, while the commercial-trial path awaits its separately provisioned isolated
credential, exact expiry timestamp, historical-range implementation, and smoke test.

## Quality status

- NOWPayments/preorder integration: focused checkout/IPN/dashboard tests, `pnpm typecheck`, `pnpm lint`,
  `pnpm build`, `docker compose --env-file ops/launch.env.example -f docker-compose.launch.yml config
--quiet`, and `RUN_DATABASE_TESTS=true pnpm test` passed locally (65 files / 191 tests); migration
  `20260829223500_nowpayments_checkout` applied to local PostgreSQL 17
- `pnpm format`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `RUN_DATABASE_TESTS=true pnpm test`: all 146 tests passed locally across 54 test files
- `pnpm build`: passed
- `pnpm db:validate` / `pnpm db:generate`: passed
- Twelve Data private-probe release: focused response/configuration/observability coverage passed (15
  tests), then formatter, full typecheck, lint, default suite (215 passed / 40 environment-dependent
  skipped), and production build passed. Live HTTPS home/competition/dashboard checks had no application
  console errors; Caddy, web, realtime, worker, PostgreSQL, and Valkey readiness checks were all HTTP 200.
- Twelve Data commercial-trial implementation: Prisma validation/generation, local migration deploy and
  idempotent seed, typecheck, lint, the full PostgreSQL-backed suite (76 files / 224 tests), and a
  production-mode build passed. The repository-wide formatter is blocked solely by the pre-existing user
  edit in `apps/realtime/src/protocol.test.ts`; all files changed for this work were formatted.
- Live terminal repair: focused quote-cache coverage, formatter, full typecheck, lint, default suite (176
  passed / 40 skipped), and production build passed. Revision `3de46b7` is deployed. The public authenticated
  WebSocket relay received a snapshot and quote delta. The owner-authorized, audited, idempotent launch-data
  configuration created active version-1 EURUSD/GBPUSD simulated instruments using the repository's existing
  rules; the connected browser now shows live EURUSD bid/ask, both pairs, valid `0.01` quantity constraints,
  and an enabled simulated ticket with no application-console errors.
- Current Phase 10 checkpoint: migrations `20260830180000_superadmin_observability` and
  `20260830190000_email_verification` applied locally; `pnpm typecheck`, `pnpm lint`, a production-mode
  `pnpm build`, and `RUN_DATABASE_TESTS=true pnpm exec vitest run` passed (136 files / 200 tests).
- Owner control center release: focused PostgreSQL integration coverage passed; full default test suite passed
  (206 tests across 71 files, with 52 environment-dependent tests skipped), followed by `pnpm typecheck`,
  `pnpm lint`, and a clean production `pnpm build`. Revision `008b102` was deployed successfully and public
  home/competition/readiness HTTPS smoke checks returned HTTP 200; protected owner routes redirect to login.
- Owner console mutation correction: successful create/update/publish/cancel, pricing, and user actions now
  redirect only after their command completes, so the Next.js redirect control signal cannot be misreported as
  an invalid command. Typed owner-command rejections retain a bounded, user-actionable explanation. Focused
  regression coverage, formatter, typecheck, lint, production build, and the full default suite passed
  (208 tests across 72 files, with 39 environment-dependent tests skipped).
  Revision `36adbf0` is deployed to the launch host; public home, competition, and readiness checks returned
  HTTP 200 after the rebuilt web/realtime/worker services became healthy.
- Browser compatibility correction: owner code fields now use an HTML `v`-mode-safe expression, removing the
  client-side regular-expression exception seen in Chromium. The expression was exercised against valid and
  invalid codes; formatter, typecheck, lint, the full default suite (208 tests / 72 files, 39 skipped), and
  the production build passed before deployment. Revision `84e676a` is live; an authenticated browser reload
  confirmed the compatible pattern compiles without console errors, while public home, competition, and
  readiness routes returned HTTP 200.
- Overlapping signup windows: a signup close may occur during trading but not after trading ends. Checkout
  accepts a `SCHEDULED` or `ACTIVE` competition while its signup window remains open; confirmed active-window
  payments provision the normal active simulated account. PostgreSQL-backed setup/payment coverage passed,
  along with formatter, typecheck, lint, the full default suite (209 tests / 72 files, 40 skipped), and the
  production build. Revision `43753bd` is live; the authenticated owner page renders the updated scheduling
  guidance with no browser-console errors, public home/competition/readiness checks return HTTP 200, and all
  launch services are healthy.
- Server Action deployment stability: the launch composition now supplies the protected
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to the web image build and runtime. The host generated and retained
  a valid 32-byte base64 key without exposing it; the running server-reference manifest equals the container
  runtime key. Formatter, typecheck, lint, default tests, production build/key assertion, and launch Compose
  validation passed. Revision `c6d6270` is live; all services are healthy and public readiness returns HTTP 200. Open forms from before this one-time migration must be reloaded once; later ordinary web releases
  retain their action identities.
- NOWPayments bounded underpayment handling: the authenticated merchant dashboard's Payment covering is
  persisted at 10.00%, its documented maximum. It lets NOWPayments automatically send `finished` for a
  qualifying payment at or above 90% of the quoted crypto equivalent; the application continues to require a
  signed `finished` callback and leaves `partially_paid` non-provisioning. The separate unbounded default
  status remains **Partially Paid**. Existing partial payments require individual review, provider-side
  completion, and an IPN resend.
- all eight migrations, idempotent seed, PostgreSQL 17 readiness, and Valkey readiness passed locally
- `docker compose -f docker-compose.production.yml config -q`: passed
- production-shaped Compose startup: migrations/seed completed before the application services;
  PostgreSQL, Valkey, web, realtime, and worker health checks passed; host web and competitions
  smoke routes returned HTTP 200
- TraderMade activation gate: formatter, typecheck, lint, and the focused shared-environment tests
  passed; the rebuilt Compose stack is healthy and its running worker confirms
  `MARKET_DATA_SOURCE=mock`
- terminal workspace upgrade: formatter, typecheck, lint, and all 101 runnable tests passed (36
  database integration tests are skipped without a host-exposed test database); the full-screen,
  indicator, exact position-metric, and server-validated chart-protection paths have focused
  coverage; the updated production-shaped Docker image and all service/host smoke checks passed
- terminal order continuity: the production-shaped Compose stack now injects one stable local
  `NEXTAUTH_SECRET` from root `.env`, so a `localhost:3000` session remains valid after switching
  from the host-run app to Docker. The quote-side non-submission regression test, formatter,
  typecheck, lint, all 102 runnable tests, Compose validation, and recreated web readiness check
  passed.
- professional chart drawings: browser-only, account/symbol-scoped annotations now provide a
  select/edit rail, trend lines, horizontal rays, rectangle zones, long/short target-and-stop plan
  visualizations, and measurement. The validated local schema bounds saved drawings while preserving
  the simulator's server-owned order/risk boundary. Formatter, typecheck, lint, all 105 runnable
  tests, the production build, rebuilt Docker image, and recreated web readiness check passed.
- indicator settings: the professional `ƒx Studies` dialog provides per-study visibility, lengths,
  line colors, and Bollinger deviations with draft/apply/cancel/reset behavior and bounded client
  validation. Applied settings drive the existing server-supplied candle overlays only; they cannot
  affect any order, position, or risk decision. Formatter, typecheck, lint, all 110 runnable tests,
  production image build, and recreated Docker web readiness check passed.
- authentication/session hardening: safe callback normalization prevents repeated or external callback
  failures; login and registration preserve a valid protected destination; credential failures are
  rate-limited in Valkey with hashed identifiers and audited; realtime periodically revokes inactive
  users; and the web standalone image now carries Prisma's engine at its dependency lookup path.
  Formatter, typecheck, lint, all 126 runnable tests, Docker production build, duplicate-callback,
  disposable registration/login/session, readiness, and database-backed route smoke checks passed.
  `12_AUTH_SESSION_HARDENING.md` records the deferred public-production account-lifecycle work.
- chart command menu: the first-party Lightweight Charts terminal now provides a keyboard-accessible
  right-click command menu at the chart's actual price/time. It describes and exposes the supported
  selection, trend, horizontal-ray, rectangle, long/short-plan, and measurement tools; adds local
  grid/last-price/visibility/repeat-drawing/view management; and preserves the browser-only drawing
  boundary. The five focused menu tests, formatter, typecheck, lint, full test run, production build,
  production Docker rebuild/readiness, and browser right-click/horizontal-ray smoke check passed.
- compact chart command menu: the right-click menu is now a narrow, dark, single-line command surface
  that preserves chart context. Drawing tools and chart settings open in small nested panels, with
  contextual tooltips, keyboard back/Escape behavior, and the existing browser-only authority boundary.
  Formatter, web typecheck, lint, six focused component/integration tests, production Docker rebuild and
  readiness, and real-browser visual checks of the main and drawing panels passed.
- future chart drawing space: the terminal reserves a 16-bar right margin and maps empty right-side
  logical coordinates to interval-aligned future timestamps. Trend lines, zones, and risk/reward plans
  can now be created or edited past the latest candle; saved future annotations map back to that space
  and remain browser-only. Formatter, web typecheck, lint, focused unit/component coverage, production
  Docker rebuild/readiness, and a real-browser future-margin visual check passed.
- chart-only fullscreen: the chart toolbar now has an independent Fullscreen API control that expands
  only the chart panel to the viewport. Chart timeframes, studies, drawing tools, annotations, position
  levels, context menu, and chart controls remain available; Escape or the exit control returns to the
  normal terminal without affecting the existing whole-terminal fullscreen mode. Formatter, web
  typecheck, lint, nine focused tests, production Docker rebuild/readiness, and live browser enter/exit
  verification passed.
- chart Buy/Sell selectors: Chart settings now includes a default-off Buy/Sell control overlay, using the
  current live bid/ask and available in normal plus chart-only fullscreen views. Choosing one synchronizes
  the existing ticket-side state; it neither navigates nor submits a simulated order, and no stale/missing
  quote can be selected. Formatter, web typecheck, lint, 14 focused tests, and the web production build
  passed. Docker Desktop was unavailable in this session, so the already-running
  local container still serves the prior image and was not represented as verification for this change.
- chart studies legend: applied studies now render as a compact, color-matched top-left plot legend with
  their configured label and latest calculated value; Bollinger Bands include upper/middle/lower values.
  The Studies dialog remains the only configuration surface, replacing duplicate toolbar study toggles.
  Formatter, web typecheck, lint, 17 focused tests, and the web production build passed. Docker Desktop
  remains unavailable for a rebuilt-image visual check.
- selectable chart studies: legend rows now select their study and reveal a direct settings button; the
  selected plotted study also has a stronger line. A Lightweight Charts click on an indicator line selects
  that study in the legend. These are chart display preferences only. Formatter, web typecheck, lint, 18
  focused tests, and the web production build passed; Docker Desktop remains unavailable for live QA.
- multiple chart studies: SMA, EMA, and Bollinger Bands are no longer limited to one instance per kind.
  The `ƒx Studies` window now adds/removes independently identified instances (up to 12), validates each
  configuration, provides distinct default colors for duplicates, and displays ordinal labels plus values
  in the selectable chart legend. Formatter, web typecheck, lint, 22 focused tests, and the web production
  build passed; Docker Desktop remains unavailable for live visual QA.
- chart drawing scale synchronization: browser-only SVG annotations now recompute their anchored time and
  price coordinates on every logical viewport-range update and during captured drag/wheel scaling, with
  one refresh per animation frame. The focused regression proves a saved ray moves with both axes while
  preserving its stored anchors. Formatter, full typecheck, lint, 14 focused chart tests, and the web
  production build passed. A no-cache production Compose rebuild and force-recreate completed; PostgreSQL,
  Valkey, web, realtime, and worker are healthy, and a live terminal browser check confirmed the ray moves
  with the chart during a pan.
- chart drawing constraints: Shift locks a new trend line to the dominant horizontal/vertical axis, while
  Ctrl snaps a new drawing or measure anchor to the closest OHLC value on its candle. Measurements now
  start on a first click, preview under the cursor, and lock in place on the second click while remaining
  bound to chart coordinates. Formatter, full typecheck, lint, 18 focused chart tests, production Docker
  web build/readiness, and a live two-click measurement check passed.
- GitHub Actions CI run `32554756501`: passed migration deploy, seed, Compose validation, all 127
  tests, and production build
- local browser visual QA passed for the home, competition discovery/detail, dashboard, and live
  terminal at 1440px desktop and 390px mobile widths with no page-level horizontal overflow
- post-integration browser smoke passed for home, competitions, dashboard, and the provisioned
  advanced terminal; studies, drawing tools, and order ticket rendered with no console warnings or
  errors after the deterministic hydration-clock fix

## Maintenance completion evidence

- established a cohesive midnight-blue, lap-blue, amber, and coral control-room design system with
  shared rounded surfaces, focus treatment, responsive navigation, status language, and data styling
- expanded the home experience into an explanatory competition journey with the five-session week,
  four-step lifecycle, tier comparison, and explicit simulated/server-owned/result assurances
- improved competition discovery, tier selection, standing provenance, authentication guidance, and
  trader-dashboard orientation without changing persisted data or server authority
- aligned terminal chart colors with the product palette and fixed visually hidden order-type radio
  controls that could expand the terminal beyond the viewport
- preserved keyboard focus and reduced-motion behavior and verified the dense terminal at desktop
  and mobile widths

## Blockers

- starting simulated balance per tier is not finally approved
- exact drawdown semantics not finally approved
- TraderMade offered pricing/a paid trial, but commercial terms, official documentation, and required
  client-display/redistribution/simulated-execution rights are not approved or integrated
- Twelve Data trial ends 13 September 2026. Local credentialed validation is complete; the remaining work is
  staff-only live-host validation and rollback no later than `2026-09-13T00:00:00.000Z` unless paid terms
  are explicitly recorded. The Basic-plan local probe remains non-display only.
- NOWPayments merchant acceptance, production credential provisioning, and public HTTPS IPN verification
  are not completed; real checkout remains disabled
- SVG legal opinion not completed

The time-limited Twelve Data trial authorization permits only its documented, server-owned path through
13 September. Do not infer APIs, scrape a provider, or present data outside that authorization as
commercially usable. The Phase 10 code path is complete but its real-checkout activation and Phase 11
DigitalOcean production work remain explicitly deferred.
