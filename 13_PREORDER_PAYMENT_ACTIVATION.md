# NOWPayments Preorder Activation

## Purpose

This is the operational handoff for accepting paid preorders before the market-data provider is
integrated. The target storefront launch reported by the product owner is **15 September 2026**.
It does not set a competition start date: operators must schedule the first five-session competition
using the approved rules and market-data readiness date.

The application supports a paid entry only for a `SCHEDULED` competition. A valid NOWPayments IPN
activates the entry and creates its simulated account, but the dashboard keeps it in **Preorder
confirmed** until the competition is active. The simulator independently rejects orders before the
trading window.

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
configuration. Do not add any value to `.env.example`, `.env.container.example`, Docker image layers,
CI logs, browser code, or chat.

| Variable                   | Required value                                                         |
| -------------------------- | ---------------------------------------------------------------------- |
| `PAYMENT_PROVIDER`         | `nowpayments`                                                          |
| `NOWPAYMENTS_API_KEY`      | Merchant API key from the restricted secret store                      |
| `NOWPAYMENTS_IPN_SECRET`   | Newly generated NOWPayments IPN secret from the same restricted store  |
| `NEXTAUTH_URL`             | Final public `https://` storefront origin, without a trailing path     |
| `NEXTAUTH_SECRET`          | One stable, high-entropy shared value across web and realtime replicas |
| `MARKET_DATA_SOURCE`       | `mock` until Phase 9 activation                                        |
| `MOCK_MARKET_DATA_ENABLED` | `false` in the public preorder environment                             |

The deployed application derives all hosted-invoice URLs from `NEXTAUTH_URL`. The NOWPayments IPN
setting must therefore be exactly:

```text
https://<public-origin>/api/payments/nowpayments/ipn
```

The ingress must pass the raw request body and the `x-nowpayments-sig` header to the application
unchanged. This endpoint is intentionally unauthenticated; restrict only by normal edge protections
that do not rewrite the body or strip the signature header. Do not use a localhost URL, a tunnel that
is not owned by the company, or a browser redirect as the IPN endpoint.

## Pre-deployment checks

1. Deploy from the tracked [`docker-compose.launch.yml`](docker-compose.launch.yml) composition. It runs
   only stateless application containers and Caddy on the launch VM; PostgreSQL and Valkey URLs must
   point to the managed services prepared by infrastructure. Do not use the development seed to create
   public launch data.
2. Configure an approved future five-session competition and its signup-close time in the production
   database. The exact competition start date is a separate operations/rules decision from the
   storefront launch date.
3. Confirm the competition is `SCHEDULED`, the intended tiers are active, and all entry fees are the
   approved USD-cent values.
4. Deploy web, worker, and realtime with the same `NEXTAUTH_URL` and `NEXTAUTH_SECRET`; check their
   readiness endpoints through the public deployment.
5. Confirm `POST /api/payments/nowpayments/ipn` is reachable over public HTTPS and returns a non-5xx
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

To enable these private containers on the launch VM, materialize .env.launch from
ops/self-hosted-launch.env.example, then use the override:

    docker compose --env-file .env.launch \
      -f docker-compose.launch.yml \
      -f docker-compose.self-hosted.yml \
      up --build --detach

PostgreSQL and Valkey expose no host ports; only Caddy exposes 80/443. The initial compose deployment
runs migrations but deliberately does not run the development seed, because public tier/rule values and
the first competition window require separate approval.

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
4. Verify one payment has the exact tier amount in USD cents, one provider invoice ID, one actual
   payment ID, and a provider-event receipt. Only `finished` may set it to `CONFIRMED`.
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
