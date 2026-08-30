# Session Handoff

## Current handoff

Phase 10 is now a preorder activation package. The NOWPayments hosted-invoice/IPN implementation was
already present and remains the only checkout boundary: no customer deposits, fiat, custody, stored
balances, live brokerage execution, payouts, or browser-authoritative payment action exists. On 30 August
2026, the product owner reported NOWPayments approval and receipt of the merchant API key, requested
preorders before real market data, set a target storefront launch of 15 September 2026, and authorized
installation on the designated `profitopath` SSH launch machine.

The application is launch-ready but has **not** been deployed. This session has no NOWPayments API/IPN
secrets and no saved SSH alias or resolvable hostname named `profitopath`; the attempted read-only SSH
preflight used the effective default `profitopath` / local user and failed hostname resolution. No remote
machine was accessed or modified.

## Integrated work

- The existing provider-neutral payment service stores NOWPayments invoice and eventual payment IDs
  separately, creates server-owned hosted invoices, verifies raw signed IPNs with recursively sorted
  HMAC-SHA-512, and provisions only exact-amount USD `finished` confirmations. It is replay safe and
  keeps provider events/audits in the same authoritative PostgreSQL transaction.
- Paid entries for a future `SCHEDULED` competition now render as **Preorder confirmed** after the signed
  IPN. The dashboard does not link to the terminal until the competition is active and its trading window
  has started; payment success redirects remain explicitly pending because browser success is not a
  payment confirmation. `D-024` records this non-economic product decision.
- Added `13_PREORDER_PAYMENT_ACTIVATION.md`: secret contract, public raw-IPN requirements, controlled
  invoice/IPN smoke procedure, launch/rollback sequence, and the explicit separation from market-data
  authorization.
- Added `docker-compose.launch.yml`, `ops/Caddyfile.launch`, and `ops/launch.env.example`. They define a
  launch VM with Caddy TLS and private web, realtime, worker, and migration containers. Caddy proxies the
  WebSocket at the same storefront `/realtime` origin so the host-only login cookie is preserved.
  PostgreSQL and Valkey are deliberately external managed services; no authoritative database runs on the
  VM. The web Docker image now accepts the build-time `NEXT_PUBLIC_REALTIME_URL` required by the browser.
- The repository/local default remains `PAYMENT_PROVIDER=mock`. Only the ignored `.env.launch` created on
  the production host from the secret manager sets `PAYMENT_PROVIDER=nowpayments`.

## Verification

- Focused dashboard/preorder, NOWPayments provider, and raw-IPN route tests: 8 passed.
- `RUN_DATABASE_TESTS=true pnpm test`: 65 files / 191 tests passed with local PostgreSQL 17 and Valkey.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed; the Next production build includes `/api/payments/nowpayments/ipn`.
- `pnpm exec prettier --check` for all changed parseable files: passed.
- `git diff --check`: passed.
- `docker compose --env-file ops/launch.env.example -f docker-compose.launch.yml config --quiet`:
  passed. Docker Desktop was restarted by the user during verification; local database services are healthy.

## Launch-host deployment blocker

To continue the user-authorized installation, obtain one of the following through the secure infrastructure
channel:

1. A saved SSH target named `profitopath` that is visible to this session, or the exact `user@hostname`
   plus verified host-key fingerprint and the authorized SSH identity.
2. The final storefront and realtime hostnames with DNS already pointed at the launch VM.
3. Managed PostgreSQL and Valkey URLs, injected via the deployment secret manager together with
   `NEXTAUTH_SECRET`, `MOCK_PAYMENT_SIGNING_SECRET`, `NOWPAYMENTS_API_KEY`, and
   `NOWPAYMENTS_IPN_SECRET`. Never paste any of these in chat or Git.
4. The approved first five-session competition date, signup close, tiers/rules version, and the written
   merchant approval artefact retained in restricted operations storage.

When those are available, clone/pull this branch on the host, materialize protected `.env.launch` from
`ops/launch.env.example`, run the three Compose commands in `13_PREORDER_PAYMENT_ACTIVATION.md`, verify
the public health/IPN route, and execute the controlled company-wallet NOWPayments smoke test before
opening customer sales.

## Deferred market data

The product owner wants market-data implementation after the preorder launch. Keep
`MARKET_DATA_SOURCE=mock` and `MOCK_MARKET_DATA_ENABLED=false` on the public preorder stack. Phase 9
remains deferred until the provider gives its official API/streaming documentation, written display,
fanout, cache/retention, and simulated-execution rights, credential/rate-limit model, and infrastructure
details. Do not infer a provider API from approval correspondence.

## Worktree

- Do not touch the user-owned untracked `marketing/` directory or `package-lock.json`.
- All Phase 10 files are still uncommitted. The pre-existing NOWPayments implementation, this preorder
  work, docs, Prisma migration, and launch composition need a review/commit before remote deployment.

## Exact next task

P10-006 — receive a valid SSH target and host identity, deploy the prepared Docker/Caddy composition to
the launch VM with secret-manager values and managed services, provision the approved scheduled
competition, then run and record the controlled NOWPayments invoice/IPN smoke test. Keep public sales
closed until that test succeeds. Start Phase 9 only after the deferred provider documents and
commercial-use limits are supplied.
