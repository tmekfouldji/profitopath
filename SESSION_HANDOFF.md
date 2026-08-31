# Session Handoff

## Current handoff

Phase 10 is a preorder launch package with mandatory email confirmation and a protected owner control
plane. Product scope remains weekly simulated trading competitions only: no customer deposits, custody,
fiat, payout provider, funded accounts, or real-market/broker execution. NOWPayments hosted invoices and
signed raw IPNs remain the sole checkout boundary. Real market data remains blocked under P9-001 until the
selected provider supplies official documentation and commercial customer-display/simulation rights. A
strictly local Twelve Data Basic `/price` probe now exists for server connectivity only; its free-plan
non-display terms prohibit using it for client delivery, cache/fan-out, candles, or simulated execution.

The product owner requested a 15 September 2026 preorder storefront and authorized deployment to
`root@72.62.90.38`. The public stack is live at `https://profitopath.com`, with a valid Let's Encrypt
certificate and canonical `www` redirect. The launch host has Docker Engine 29.7.2, Docker Compose 5.5.0,
a default-deny UFW permitting SSH/HTTP/HTTPS, and `/opt/profitopath` at the launch revision. Caddy, web,
realtime, and worker are healthy alongside private PostgreSQL 17 and Valkey 8; no DB/cache ports are
published. Their Docker volumes have no off-host backup destination, so this is a temporary explicit
pre-launch exception (D-025), not HA or a managed database solution. Migrate before market-data/trading
launch.

## This session’s implementation

- Added `SUPERADMIN` (above operational `ADMIN`) and migrations
  `20260830180000_superadmin_observability` / `20260830190000_email_verification`.
- Added `/superadmin`: registered-member totals, daily anonymous browser visits, signed-in member presence
  in the last five minutes, confirmed USD revenue, simulated account totals, and provider/config readiness.
  Daily visits store only a SHA-256 browser identifier—not IP, user agent, or raw cookie value. Secret
  values are neither rendered nor accepted in the browser (D-026).
- Added mandatory verification for password credentials. Registration creates an opaque 32-byte token but
  persists only its SHA-256 hash, with a configurable 60-minute expiry. The email link opens a confirmation
  form rather than consuming on GET (mail-scanner safe); confirmation, issuing, and reissuing are audited.
  Unverified users cannot authenticate even with a correct password. Resends return a generic response and
  are Valkey rate-limited to one per address per minute.
- Added Zoho SMTP delivery through Nodemailer. `EMAIL_PROVIDER=smtp` requires `EMAIL_FROM`, `SMTP_HOST`,
  `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASSWORD` in the runtime environment. Registration returns no success
  until SMTP is configured and the email send succeeds.
- Deployed secure password recovery with its own `PasswordResetToken` migration,
  hashed opaque single-use token, 60-minute default expiry, generic Valkey-rate-limited request path,
  password replacement, audit records, and invalidation of earlier credential JWTs through `credentialVersion`.
- Expanded the deployed `/superadmin` area into a separate, responsive sidebar control center. It provides
  overview metrics; versioned challenge-price controls; future UTC competition draft, edit, publish, and
  cancellation controls; constrained user role/status operations; payment/revenue visibility; the existing
  dual-review payout operations; and deployment readiness. All mutations are server-authorized and audited.
- Challenge-tier availability/checkout creation share a PostgreSQL advisory lock. A tier that has entries is
  immutable, so pricing or rules require a new tier code; a competition can publish only with valid future UTC
  times and an active tier. Public competition discovery hides drafts and cancelled competitions.
- Customer-facing discovery now reads active tier pricing from the authoritative store, and the customer
  dashboard has a direct purchase CTA and repeat-customer purchase strip.
- Corrected the owner-console server actions so a successful mutation redirects to its success notice only
  after the `try` block. Previously Next.js's internal redirect was caught and displayed as a false invalid
  operation. Typed validation errors now include their bounded, user-actionable explanation on the pricing,
  competition, and user pages.
- Stabilized Next.js Server Action identities across normal web deployments. The launch composition sends a
  protected 32-byte base64 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` into the web build and runtime. It was generated
  only on the launch host; the running server-reference manifest matches the runtime key without emitting its
  value. This corrects stale-form action failures after the required one-time browser reload.
- Configured NOWPayments Payment covering at 10.00% in the authenticated merchant dashboard, so the provider
  automatically marks a hosted-invoice payment `finished` when at least 90% of its quoted crypto equivalent
  is received. The app still accepts only a signed `finished` IPN and does not promote `partially_paid` locally.
  The unsafe unbounded Default payment status remains **Partially Paid**.
- Added `TwelveDataPrivateProbe`, a worker-only client for the documented batched `/price` endpoint. It
  samples EURUSD/GBPUSD midpoint values only on a development/test loopback origin with an owner-supplied
  key. It defaults to five-minute polling (576 credits/day for two symbols), validates exact Decimals, and
  logs only symbol names/sample count. It cannot publish to Valkey, candles, orders, execution, WebSockets,
  HTTP, or browser code. `14_TWELVE_DATA_PRIVATE_TESTING.md` is the operator runbook; do not configure the
  key or enable the probe on `/opt/profitopath`.

## Launch-host configuration state

`/opt/profitopath/.env.launch` is mode 0600 and has generated database/Valkey/auth/Server-Action secrets plus
protected live Zoho SMTP and NOWPayments values. The runtime is `EMAIL_PROVIDER=smtp`,
`SMTP_HOST=smtppro.zoho.com`, `SMTP_PORT=465`, and `PAYMENT_PROVIDER=nowpayments`; no raw secret has been
displayed, committed, or copied to chat. On 30 August 2026, the running container verified Zoho SMTP
authentication and Zoho accepted a resend for the product owner’s unconfirmed account. The app recognizes SSL
on port 465 (or TLS if explicitly switched to port 587). The first signed real payment callback is still
untested.

## Required external activation work

1. Confirm the received email, verify blocked-before-confirmation/allowed-after-confirmation, and check
   Zoho SPF/DKIM delivery outcomes.
2. Run the controlled NOWPayments invoice/signed-IPN smoke test at
   `https://profitopath.com/api/payments/nowpayments/ipn`; verify the provider's approved 90% floor with a
   company-controlled payment at or above that threshold.
3. Approve the first real `SCHEDULED` competition and tiers/rules. Do not run development seeds publicly.
4. The product owner account is already `SUPERADMIN`. Sign out and back in after a role change, then use
   `/superadmin`: create/activate a tier first, create a DRAFT competition with `signup close < start < end`
   in UTC, then publish it for preorder.

## Verification in this session

- Local migrations applied successfully to PostgreSQL 17.
- `pnpm db:generate`, `pnpm db:validate`, `pnpm typecheck`, and `pnpm lint` passed.
- Production-mode `pnpm build` completed successfully.
- The focused superadmin PostgreSQL test passed; the default full suite passed 206 tests across 71 files
  (52 environment-dependent tests skipped).
- Owner-action redirect regression coverage passed; after the correction, formatter, typecheck, lint, a
  production build, and the full default suite passed (208 tests across 72 files, 39 skipped).
- Revision `36adbf0` is live on the launch host. Home, competition, and readiness HTTPS smoke routes return
  HTTP 200; the protected competition setup route redirects to sign-in when unauthenticated; Caddy,
  PostgreSQL, Valkey, web, realtime, and worker are healthy.
- Corrected the challenge-tier and competition-code HTML patterns for Chromium's current Unicode `v` regular
  expression mode. The prior character class caused a client-side exception before form submission. The new
  expression accepts only uppercase/lowercase letters, digits, underscores, and hyphens without the invalid
  character-class syntax. Full quality checks passed before deployment. Revision `84e676a` is live; an
  authenticated browser reload confirmed the new pattern compiles with no console errors, while public
  home, competition, and readiness routes return HTTP 200.
- Signup now may close after trading begins, so customers can join an in-progress competition until its
  configured close time. It may not close after trading ends. The payment service accepts both `SCHEDULED`
  and `ACTIVE` competitions before that close time, and a confirmed active-window checkout provisions the
  normal active simulated account. The competition detail page labels this as an open in-progress entry
  instead of a preorder. PostgreSQL-backed setup/payment coverage passed, followed by formatter, typecheck,
  lint, the full default suite (209 tests / 72 files, 40 skipped), and a production build.
- Revision `43753bd` is live. An authenticated browser confirms the owner scheduling guidance renders without
  console errors; public home, competition, and readiness routes return HTTP 200; Caddy, PostgreSQL, Valkey,
  web, realtime, and worker are healthy.
- Revision `c6d6270` is live. The Next.js server-reference manifest matches the running container's protected
  Server Action key; Caddy, PostgreSQL, Valkey, web, realtime, and worker are healthy; and public readiness
  returns HTTP 200. The one-time migration invalidates forms opened before this deployment, so reload before
  resubmitting an owner-console form.
- NOWPayments merchant dashboard verification: Payment covering persists as 10.00%; Default payment status
  remains **Partially Paid** rather than the unsafe all-underpayments-finished mode. No deployment was
  required because the production application already processes only signed `finished` IPNs.
- Compose config and Caddy validation for the self-hosted launch composition passed. The host applied all
  migrations, deployed revision `008b102`, and started every launch service. Public home, competition, and
  readiness routes returned HTTP 200 over HTTPS; `/superadmin` correctly redirects unauthenticated visitors
  to the protected login flow.
- Twelve Data private-probe response/error/configuration coverage passed, followed by formatter, full
  typecheck, lint, the default suite (215 passed / 40 skipped), and a production build. An authenticated
  Chrome smoke check confirmed public home, competition discovery, and the pending-payment dashboard render
  with no application errors. In-container web/realtime/worker readiness and the Caddy-served public
  readiness route each returned HTTP 200; all six launch services were healthy.
- Revision `7847a72` is deployed to the launch host. The self-hosted Compose stack rebuilt successfully;
  Caddy, web, realtime, worker, PostgreSQL, and Valkey are healthy. In-container web/realtime/worker and
  public HTTPS readiness checks returned HTTP 200. The host explicitly reports
  `MARKET_DATA_SOURCE=mock` and `TWELVE_DATA_PRIVATE_TEST_ENABLED=false`; a fresh public competition-board
  browser check has no application-console errors.
- On 31 August 2026, the owner authorized a controlled production terminal-flow test. The verified
  `mekfouldjitahar@gmail.com` owner profile received an active Rookie simulated account in the short-lived
  `QA-FLOW-20260831-1750` competition, which the worker promoted to `ACTIVE` at its configured UTC start.
  The grant has an authoritative initial-balance ledger and audit records but deliberately no `Payment`,
  NOWPayments invoice, or revenue. `MOCK_MARKET_DATA_ENABLED=true` is now set in the protected launch-host
  environment, and the worker restarts healthy, recovers both active accounts, and publishes four mock
  quotes every five seconds. The Twelve Data private probe remains disabled on the host. The launch database
  now also has the explicit active version-1 EURUSD/GBPUSD simulated-instrument configurations required by
  the QA terminal; the owner-authorized, idempotent upsert is audited and uses the existing repository rules.
- Revision `3de46b7` is live. It serializes the initial lazy Valkey connection used by concurrent terminal
  quote reads, retaining fail-closed behavior for genuinely stale/missing data. The public authenticated
  WebSocket relay received a snapshot and quote delta, and the connected live browser terminal now shows
  EURUSD bid/ask, both EURUSD/GBPUSD choices, correct `0.01` quantity constraints, and an enabled simulated
  ticket with no application-console errors.

## Next work

Keep the public application running and monitor confirmation delivery. Reload any owner-console form opened
before revision `c6d6270` once, then retry it; normal future web releases retain Server Action identities. Do
not announce or promote customer checkout until the controlled confirmation and checkout/IPN tests (including
the approved 90% provider floor) complete and the first competition schedule is approved.
`20260830211500_password_reset_recovery` and `/reset-password` are live; perform a complete user
request/reset/new sign-in/old-session-invalidated check next. The owner may now sign in as the verified
owner profile, open the controlled QA account from `/dashboard`, and exercise an authoritative simulated
order using the live mock quotes. Do not create a real NOWPayments invoice during this terminal-only grant;
the controlled invoice/IPN smoke test remains separate. The separate evergreen tier-bound preorder
entitlement must receive explicit pricing, expiry/refund, and cancellation-policy approval before
implementation. To test Twelve Data, the owner must set `TWELVE_DATA_PRIVATE_TEST_ENABLED=true` and the
private key only in the local loopback `.env`, then check the worker's no-price probe event. P9-001 remains
blocked; do not change the public `MARKET_DATA_SOURCE=mock` or enable the probe on the launch host.
