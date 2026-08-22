# Project State

This file is the authoritative high-level state for Codex.

## Current status

- Product: weekly simulated trading competitions only
- Trading platform: first-party browser simulator
- Repository: single GitHub monorepo
- Cloud target: DigitalOcean
- Payment target: NOWPayments, later phase
- Legal/company working assumption: SVG Business Company, final approval pending
- Current implementation phase: **Phase 1 — Database/domain foundation (CI validation)**
- Production deployment: not started
- Real market-data integration: not started
- Real payment integration: not started

## Active milestone

Validate the initial migration, seed, and persistence integration tests in GitHub Actions, then
close Phase 1 and hand off to Phase 2.

## Definition of done for active milestone

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

## Last completed task

P1-018 — initial PostgreSQL migration and idempotent tier seed commands.

## Next task

Commit and push the Phase 0–1 foundation, confirm GitHub Actions passes with PostgreSQL and
Valkey service containers, then complete P1-017/P1-019.

## Quality status

- `pnpm format`: passed
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `pnpm test`: 9 unit tests passed; 2 PostgreSQL integration tests skipped locally
- `pnpm build`: passed
- `pnpm db:validate` / `pnpm db:generate`: passed
- realtime liveness smoke test: HTTP 200; readiness correctly returned HTTP 503 without dependencies
- Docker Compose/migration/seed integration: pending GitHub Actions because Docker is not installed locally

## Blockers

- starting simulated balance per tier is not finally approved
- exact drawdown semantics not finally approved
- market-data vendor not selected
- NOWPayments merchant acceptance not completed
- SVG legal opinion not completed

These blockers do **not** prevent Phase 0–8 mock development.
