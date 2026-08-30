# Session Handoff

## Current handoff

Phase 10 is a preorder launch package with mandatory email confirmation and a protected owner control
plane. Product scope remains weekly simulated trading competitions only: no customer deposits, custody,
fiat, payout provider, funded accounts, or real-market/broker execution. NOWPayments hosted invoices and
signed raw IPNs remain the sole checkout boundary. Real market data remains blocked under P9-001 until the
selected provider supplies official documentation and commercial customer-display/simulation rights.

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
- Implemented (not yet deployed) secure password recovery with its own `PasswordResetToken` migration,
  hashed opaque single-use token, 60-minute default expiry, generic Valkey-rate-limited request path,
  password replacement, audit records, and invalidation of earlier credential JWTs through `credentialVersion`.

## Launch-host configuration state

`/opt/profitopath/.env.launch` is mode 0600 and has generated database/Valkey/auth secrets plus protected
live Zoho SMTP and NOWPayments values. The runtime is `EMAIL_PROVIDER=smtp`, `SMTP_HOST=smtppro.zoho.com`,
`SMTP_PORT=465`, and `PAYMENT_PROVIDER=nowpayments`; no raw secret has been displayed, committed, or copied
to chat. On 30 August 2026, the running container verified Zoho SMTP authentication and Zoho accepted a
resend for the product owner’s unconfirmed account. The app recognizes SSL on port 465 (or TLS if explicitly
switched to port 587). The first signed real payment callback is still untested.

## Required external activation work

1. Confirm the received email, verify blocked-before-confirmation/allowed-after-confirmation, and check
   Zoho SPF/DKIM delivery outcomes.
2. Run the controlled exact-amount NOWPayments invoice/signed-IPN smoke test at
   `https://profitopath.com/api/payments/nowpayments/ipn`.
3. Approve the first real `SCHEDULED` competition and tiers/rules. Do not run development seeds publicly.
4. Bootstrap one owner after that account confirms its email: promote it through a controlled PostgreSQL
   command to `SUPERADMIN`, then use `/superadmin`. Do not promote from a browser/config-variable form.

## Verification in this session

- Local migrations applied successfully to PostgreSQL 17.
- `pnpm db:generate`, `pnpm db:validate`, `pnpm typecheck`, and `pnpm lint` passed.
- Production-mode `pnpm build` completed successfully.
- `RUN_DATABASE_TESTS=true pnpm exec vitest run` passed: 136 files, 200 tests.
- Compose config and Caddy validation for the self-hosted launch composition passed. The host applied both
  new migrations successfully, started every launch service, and externally returned
  HTTP 200 for the homepage and healthy JSON for `/api/health/ready` over HTTPS.

## Next work

Keep the public application running and monitor confirmation delivery. Do not announce or promote customer
checkout until the controlled confirmation and exact-amount checkout/IPN tests complete and the first
competition schedule is approved. Deploy migration `20260830211500_password_reset_recovery` and its web
image; then test request/reset/new sign-in/old-session invalidation. The separate evergreen tier-bound
preorder entitlement must receive explicit pricing, expiry/refund, and cancellation-policy approval before
implementation. P9-001 is still blocked.
