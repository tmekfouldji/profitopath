# Project State

This file is the authoritative high-level state for Codex.

## Current status

- Product: weekly simulated trading competitions only
- Trading platform: first-party browser simulator
- Repository: single GitHub monorepo
- Cloud target: DigitalOcean
- Payment target: NOWPayments, later phase
- Legal/company working assumption: SVG Business Company, final approval pending
- Current implementation phase: **Phase 4 — Mock market data + simulator core (not started)**
- Production deployment: not started
- Real market-data integration: not started
- Real payment integration: not started

## Active milestone

Phase 0 through Phase 3 are complete. The next milestone is Phase 4: deterministic mock market
data and the persisted simulator core. No real market-data or payment provider is authorized.

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

## Last completed task

P3-009 — Phase 3 quality gate, persistent project memory, and handoff.

## Next task

P4-001 — expand Phase 4 mock-market-data and simulator-core work into concrete acceptance-tested
tasks, applying `10_MARKET_DATA_CACHING_AND_CANDLES.md` wherever pricing boundaries overlap.

## Quality status

- `pnpm format`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `pnpm test`: 22 tests passed locally; 8 PostgreSQL integration tests skipped locally
- `pnpm build`: passed
- `pnpm db:validate` / `pnpm db:generate`: passed
- Phase 3 interactive browser flow: not run locally because this workstation has no
  Docker/PostgreSQL runtime; responsive CSS and all routes passed the production build
- GitHub Actions CI run `32549129070`: passed migration deploy, seed, Compose validation, all 30
  tests, and production build

## Blockers

- starting simulated balance per tier is not finally approved
- exact drawdown semantics not finally approved
- market-data vendor not selected
- NOWPayments merchant acceptance not completed
- SVG legal opinion not completed

These blockers do **not** prevent Phase 0–8 mock development.
