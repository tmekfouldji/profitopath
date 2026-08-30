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

## Launch-host configuration state

`/opt/profitopath/.env.launch` is mode 0600 and has generated database/Valkey/auth/mock-payment secrets.
It contains **commented-only** template lines for live providers; no real provider values were entered:

```dotenv
# NOWPAYMENTS_API_KEY=
# NOWPAYMENTS_IPN_SECRET=
# EMAIL_PROVIDER=smtp
# EMAIL_FROM=contact@profitopath.com
# SMTP_HOST=smtppro.zoho.com
# SMTP_PORT=465
# SMTP_USER=contact@profitopath.com
# SMTP_PASSWORD=
EMAIL_VERIFICATION_TOKEN_TTL_MINUTES=60
```

When the product owner has generated a Zoho app-specific password, edit that protected remote file over
SSH—never chat/Git/browser—and uncomment/set every SMTP value. Use the exact SMTP host shown in the Zoho
account’s server configuration for its datacenter (typically `smtppro.zoho.com` for a paid custom-domain
mailbox) and port 465 SSL or 587 TLS. Then, after DNS resolves, deploy the updated tracked code, confirm a
test email, and only then enable public registration. For NOWPayments, set both secrets, change
`PAYMENT_PROVIDER=nowpayments`, and run the controlled hosted-invoice/IPN smoke test.

## Required external activation work

1. Securely populate/enable Zoho SMTP as above; confirm the domain’s existing SPF/DKIM records remain valid
   in Zoho. Then test confirmation/blocked-before-verification/allowed-after-verification.
2. Securely populate `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET`; set the merchant IPN endpoint to
   `https://profitopath.com/api/payments/nowpayments/ipn`; run the controlled exact-amount invoice/IPN
   smoke test.
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

Keep the public application running with registration and real payment disabled until SMTP, NOWPayments,
and first-competition gates are satisfied. Then run the controlled confirmation and checkout/IPN smoke
tests before enabling public registration or live payment. P9-001 is still blocked.
