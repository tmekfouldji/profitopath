# Project State

This file is the authoritative high-level state for Codex.

## Current status

- Product: weekly simulated trading competitions only
- Trading platform: first-party browser simulator
- Repository: single GitHub monorepo
- Cloud target: DigitalOcean
- Payment target: NOWPayments, later phase
- Legal/company working assumption: SVG Business Company, final approval pending
- Current implementation phase: **Phase 3 — Mock payments + entry provisioning (not started)**
- Production deployment: not started
- Real market-data integration: not started
- Real payment integration: not started

## Active milestone

Phase 0, Phase 1, and Phase 2 are complete. The next milestone is Phase 3: mock payments and
idempotent competition entry/account provisioning. No real payment provider is authorized yet.

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

## Last completed task

P2-012 — Phase 2 quality gate, persistent project memory, and handoff.

## Next task

P3-001 — expand Phase 3 into concrete acceptance-tested mock-payment/provisioning tasks.

## Quality status

- `pnpm format`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `pnpm test`: 17 tests passed locally; 3 PostgreSQL integration tests skipped locally
- `pnpm build`: passed
- `pnpm db:validate` / `pnpm db:generate`: passed
- responsive browser check: desktop and 390px mobile passed with no horizontal overflow
- GitHub Actions CI run `32548247855`: passed migration deploy, seed, Compose validation, all 20
  tests, and production build

## Blockers

- starting simulated balance per tier is not finally approved
- exact drawdown semantics not finally approved
- market-data vendor not selected
- NOWPayments merchant acceptance not completed
- SVG legal opinion not completed

These blockers do **not** prevent Phase 0–8 mock development.
