# NOWPayments Preorder Activation

## Purpose

This is the operational handoff for accepting paid preorders before the market-data provider is
integrated. The target storefront launch reported by the product owner is **15 September 2026**.
It does not set a competition start date: operators must schedule the first five-session competition
using the approved rules and market-data readiness date.

The application supports paid entry for a `SCHEDULED` competition and for an `ACTIVE` competition
until its configured signup-close time. A valid NOWPayments IPN activates the entry and creates its
simulated account. Scheduled entries remain **Preorder confirmed** until the competition is active;
the simulator independently rejects orders before the trading window.

## Evidence and boundaries

- The product owner reported NOWPayments approval and receipt of an API key on 30 August 2026. Retain
  the written approval in the company's restricted operations records, not in Git.
- NOWPayments is crypto-to-crypto hosted checkout only. Do not introduce fiat, customer deposits,
  custody, balances, payouts, or a browser-held key.
- The payment deployment does not authorize real market data. Until Phase 9 is separately implemented
  from the vendor's official documentation, set `MARKET_DATA_SOURCE=mock` and leave
  `MOCK_MARKET_DATA_ENABLED=false` in the public preorder environment.

## Deployment secret contract

Inject these values from the production secret manager into every service that loads the shared runtime
configuration. Do not add any value to `.env.example`, `.env.container.example`, Docker `ENV`
instructions, CI logs, browser code, or chat. The Server Action key is an intentional private build
input for Next.js and must be identical at build and runtime; never expose it in a public build variable.

| Variable                               | Required value                                                         |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `PAYMENT_PROVIDER`                     | `nowpayments`                                                          |
| `NOWPAYMENTS_API_KEY`                  | Merchant API key from the restricted secret store                      |
| `NOWPAYMENTS_IPN_SECRET`               | Newly generated NOWPayments IPN secret from the same restricted store  |
| `NEXTAUTH_URL`                         | Final public `https://` storefront origin, without a trailing path     |
| `NEXTAUTH_SECRET`                      | One stable, high-entropy shared value across web and realtime replicas |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`   | One stable base64-encoded 32-byte key for the web build and runtime    |
| `EMAIL_PROVIDER`                       | `smtp`                                                                 |
| `EMAIL_FROM` / `SMTP_USER`             | `contact@profitopath.com`                                              |
| `SMTP_HOST` / `SMTP_PORT`              | Exact Zoho account/datacenter SMTP values; 465 SSL or 587 TLS          |
| `SMTP_PASSWORD`                        | Zoho app-specific password, held only in the restricted secret store   |
| `EMAIL_VERIFICATION_TOKEN_TTL_MINUTES` | `60` unless a separately approved security policy changes it           |
| `MARKET_DATA_SOURCE`                   | `mock` until Phase 9 activation                                        |
| `MOCK_MARKET_DATA_ENABLED`             | `false` in the public preorder environment                             |

The deployed application derives all hosted-invoice URLs from `NEXTAUTH_URL`. The NOWPayments IPN
setting must therefore be exactly:

```text
https://<public-origin>/api/payments/nowpayments/ipn
```

The ingress must pass the raw request body and the `x-nowpayments-sig` header to the application
unchanged. This endpoint is intentionally unauthenticated; restrict only by normal edge protections
that do not rewrite the body or strip the signature header. Do not use a localhost URL, a tunnel that
is not owned by the company, or a browser redirect as the IPN endpoint.

## Underpayment policy

The product owner approved a **90% minimum** for a NOWPayments hosted-invoice payment: up to 10% of the
quoted crypto equivalent may be short because of network-fee or final-fiat-equivalent variance. This
tolerance is provider-owned, not a browser or application override. In NOWPayments Dashboard → Settings →
Payments → Payment details, set **Payment covering** to **10.00%**. This is the bounded control whose label
states the maximum shortfall it will still treat as completed. Do **not** use the separate **Default payment
status: Finished** setting: that accepts every underpayment, with no lower bound.

Profitopath continues to provision an entry only when it receives a signed NOWPayments `finished` IPN. It
does not locally relabel a `partially_paid` callback as paid, so a forged or arbitrarily underpaid browser
payment cannot bypass the provider's threshold. The local USD-cent validation remains a validation of the
immutable invoice quote; NOWPayments applies the approved covering calculation to the actual crypto deposit.
The setting is account-wide. Reassess it before using the same merchant account for goods that require an
exact collected amount.

The setting applies to new provider processing. For an older payment that is already `partially_paid`, review
the actual received amount, mark only an approved payment as `finished` in the NOWPayments payment details,
then use **Send IPN**. The signed callback will activate the matching pending competition entry exactly once.

## Pre-deployment checks

1. Deploy from the tracked [`docker-compose.launch.yml`](docker-compose.launch.yml) composition with the
   temporary self-hosted override below. It runs private PostgreSQL/Valkey plus stateless application
   containers and Caddy on the launch VM. Do not use the development seed to create public launch data.
2. Configure an approved future five-session competition and its signup-close time in the production
   database. The exact competition start date is a separate operations/rules decision from the
   storefront launch date.
3. Confirm the competition is `SCHEDULED`, the intended tiers are active, and all entry fees are the
   approved USD-cent values.
4. Send a confirmation link to a company-controlled mailbox. Confirm it in the browser and verify that a
   password cannot sign in before confirmation but can sign in after. Do not log the SMTP password or raw
   token.
5. Deploy web, worker, and realtime with the same `NEXTAUTH_URL` and `NEXTAUTH_SECRET`; build and run the
   web service with the same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`; check their readiness endpoints through
   the public deployment. Retaining that action key prevents a normal web rollout from invalidating an
   already-open form.
6. Confirm `POST /api/payments/nowpayments/ipn` is reachable over public HTTPS and returns a non-5xx
   response for an intentionally invalid signed-callback test. Never use this test to expose a real
   signature or secret in logs.

## Single-host Docker deployment

After Docker Engine and the Compose plugin are installed on the designated launch VM, clone the repository
there and materialize the ignored `.env.launch` from the production secret manager using
[`ops/launch.env.example`](ops/launch.env.example) as the variable inventory. Restrict that file to the
deployment account. The launch VM's public storefront hostname must resolve to it before Caddy starts so it
can obtain a TLS certificate.

From the repository root on the VM, validate and start the stack:

```bash
docker compose --env-file .env.launch -f docker-compose.launch.yml config --quiet
docker compose --env-file .env.launch -f docker-compose.launch.yml up --build --detach
docker compose --env-file .env.launch -f docker-compose.launch.yml ps
```

The `--env-file` argument is required at build time so the browser receives the public realtime WebSocket
origin. Caddy routes the storefront, raw NOWPayments IPN, and `/realtime` WebSocket path at that same
origin. Keeping the WebSocket at the storefront origin preserves the host-only authentication cookie; its
certificate data is the only Docker volume retained on the VM.

## Temporary self-hosted data services

The product owner explicitly authorized a temporary single-host PostgreSQL and Valkey deployment on
30 August 2026. This is a pre-launch compromise, not the target architecture: a loss of the launch VM
can lose the authoritative ledger because no off-host backup destination exists yet. Do not represent
this as managed or highly available infrastructure, and migrate before the market-data/trading launch.

To enable these private containers on the launch VM, materialize `.env.launch` from
[`ops/self-hosted-launch.env.example`](ops/self-hosted-launch.env.example), then use the override:

    docker compose --env-file .env.launch \
      -f docker-compose.launch.yml \
      -f docker-compose.self-hosted.yml \
      up --build --detach

PostgreSQL and Valkey expose no host ports; only Caddy exposes 80/443. The initial compose deployment
runs migrations but deliberately does not run the development seed, because public tier/rule values and
the first competition window require separate approval.

Public registration must remain unavailable until Zoho SMTP is configured. For a paid Zoho domain mailbox,
the usual baseline is `smtppro.zoho.com` with port 465/SSL or 587/TLS, but operators must copy the exact
host for their Zoho account/datacenter, use the complete `contact@profitopath.com` username, and create an
app-specific password. The app intentionally refuses to register a profile when SMTP is not configured.

For migration later, pause public writes, take a consistent pg_dump from the PostgreSQL container,
restore it to the managed target, update DATABASE_URL and VALKEY_URL, deploy, validate
readiness/authentication, and resume writes. Valkey is rebuildable and must not be treated as the
authoritative migration source.

## Controlled checkout smoke test

Run this in a non-production environment first. If NOWPayments does not provide an isolated merchant
environment, obtain written approval for a minimal-value invoice paid from a company-controlled wallet;
never use a customer payment as the first test.

1. Register a dedicated test trader and open an approved `SCHEDULED` competition tier.
2. Start checkout and verify the redirect target is a `https://*.nowpayments.io` hosted invoice. Verify
   that no API key, IPN secret, wallet, amount selector, or local payment ID is rendered to the browser.
3. Complete the controlled payment and wait for the signed IPN. Do not treat the success redirect as a
   confirmation.
4. Verify one payment retains the exact quoted tier amount in USD cents, one provider invoice ID, one actual
   payment ID, and a provider-event receipt. With the approved 10% Payment covering setting, test an amount
   at or above 90% of the provider's quoted crypto equivalent and verify NOWPayments sends `finished`; only
   signed `finished` may set the entry to `CONFIRMED`.
5. Verify exactly one competition entry and simulated account were activated, one initial-balance ledger
   row exists, and replaying the same IPN causes no duplicate account or ledger record.
6. Confirm the dashboard says **Preorder confirmed** and offers no terminal before the competition
   begins. Cancel/refund the controlled entry under the documented merchant procedure if it is not part
   of the approved test plan.

## Enable, observe, rollback

After the smoke test evidence is recorded, set `PAYMENT_PROVIDER=nowpayments` only in the deployed
secret configuration and roll out web/worker/realtime. Keep the former configuration available for a
fast rollback. Observe invoice-create failures, IPN non-2xx responses, payment/provider-event conflicts,
and database readiness for the first live checkouts.

To stop new purchases, make all affected tiers inactive or remove the scheduled competition from the
public board, then roll the deployment back to `PAYMENT_PROVIDER=mock`. Do not delete payments,
provider-event receipts, audit records, or payment secrets as part of rollback. Reconcile every
already-created hosted invoice and signed IPN before reopening sales.
