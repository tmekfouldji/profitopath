# Project State

This file is the authoritative high-level state for Codex.

## Current status

- Product: weekly simulated trading competitions only
- Trading platform: first-party browser simulator
- Repository: single GitHub monorepo
- Cloud target: DigitalOcean
- Payment target: NOWPayments, later phase
- Legal/company working assumption: SVG Business Company, final approval pending
- Current implementation phase: **Phase 2 — Auth + application shell (not started)**
- Production deployment: not started
- Real market-data integration: not started
- Real payment integration: not started

## Active milestone

Phase 0 and Phase 1 are complete. The next milestone is Phase 2: authentication and the
application shell.

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

## Last completed task

P1-019 — Phase 1 quality gate, documentation, and handoff.

## Next task

P2-001 — expand Phase 2 into concrete acceptance-tested tasks before implementation.

## Quality status

- `pnpm format`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `pnpm test`: 9 unit tests passed locally; all 11 tests passed in CI with PostgreSQL
- `pnpm build`: passed
- `pnpm db:validate` / `pnpm db:generate`: passed
- realtime liveness smoke test: HTTP 200; readiness correctly returned HTTP 503 without dependencies
- GitHub Actions CI: passed migration deploy, seed, Compose validation, 11 tests, and build

## Blockers

- starting simulated balance per tier is not finally approved
- exact drawdown semantics not finally approved
- market-data vendor not selected
- NOWPayments merchant acceptance not completed
- SVG legal opinion not completed

These blockers do **not** prevent Phase 0–8 mock development.
