# Authentication and Session Hardening

## Completed in M-011

- Login and registration accept only one safe, root-relative callback URL. Repeated values, external
  URLs, protocol-relative values, and backslash-based paths fall back to `/dashboard` without
  throwing. The callback is retained when users move between login and registration, and when an
  already authenticated user returns to either page.
- The credential client treats an absent, failed, or non-OK Auth.js response as a failed login and
  does not navigate until a session has been confirmed.
- Failed credential attempts are bounded in Valkey by hashed email and client-network keys. Defaults
  are five email failures and 25 network failures per 15 minutes. Valkey failure fails closed; raw
  emails and addresses are never placed in the cache keys or audit events.
- Failed credential attempts and rate-limit denials create `SIGN_IN_FAILED` audit events with a
  hashed credential identifier and a reason, while successful sign-ins retain the existing
  `SIGNED_IN` audit event.
- WebSocket upgrades require the current user to be active as well as the JWT claim. Every 60 seconds
  the realtime gateway batch-revalidates connected account ownership and user status, closing
  unauthorized sockets.
- The web Docker image now copies Prisma's native engine into the standalone dependency location
  searched by database-backed route bundles, as well as the server fallback location.

## Session model

Credentials create a seven-day Auth.js JWT session. Web requests re-read the current role and status
from PostgreSQL in the JWT callback, so normal pages, actions, and APIs deny suspended or closed
users immediately. The browser is never authoritative for account ownership or simulated trading.

## Production follow-up checklist

Before public launch, complete these operational and account-lifecycle items:

1. Set `NEXTAUTH_URL` to the final HTTPS origin and inject one stable `NEXTAUTH_SECRET` into every
   web and realtime replica through the production secret manager. Rotate it only with a deliberate
   session-retirement plan.
2. Terminate TLS at the trusted ingress and ensure it strips/replaces inbound `X-Forwarded-For` before
   forwarding the real client address. The network throttle relies on that ingress guarantee; the
   per-email throttle remains in force regardless.
3. Add production monitoring and alerts for `SIGN_IN_FAILED`, rate-limit unavailability, and
   unexpected Prisma/runtime errors. Keep authentication fail-closed when Valkey is unavailable.
4. Build the still-deferred account-lifecycle flows: verified email ownership, password reset/change,
   and administrator MFA. These require an approved transactional-email/identity provider and must
   be designed before public payments or broad customer onboarding.
5. In a disposable deployed environment, execute an end-to-end browser test for registration, login,
   logout, duplicate registration, protected-route continuation, Docker restart, account suspension,
   and WebSocket revocation. Do not use a real customer account for this test.

No item in this document authorizes real market-data, payment, brokerage, or customer-balance work.
