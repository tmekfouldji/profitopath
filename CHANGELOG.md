# Changelog

## Unreleased

### Project direction

- Weekly competitions only.
- First-party browser simulator.
- DigitalOcean deployment target.
- NOWPayments planned for later production checkout.
- Persistent Codex project-memory workflow added.

### Repository foundation

- Added a strict pnpm TypeScript monorepo with web, realtime, worker, and shared domain packages.
- Added local PostgreSQL/Valkey Compose services, deployable Dockerfiles, typed configuration,
  structured logging, liveness/readiness probes, and GitHub Actions CI.
- Added exact local development, migration, seed, test, build, and container commands.

### Database and domain

- Added the initial PostgreSQL/Prisma domain ledger for users, weekly competitions, entries,
  trading accounts, orders, executions, positions, closed trades, balance entries, snapshots,
  breaches, payments, prizes, payouts, leaderboard finalizations, and audit events.
- Added explicit validated state graphs and an atomic state-transition/audit service boundary.
- Added an idempotent Rookie/Trader/Elite seed with configurable development starting balances.
- Added exact integer/decimal money helpers plus unit and PostgreSQL persistence tests.
- Verified the initial migration, idempotent seed, Compose configuration, and all 11 tests against
  PostgreSQL/Valkey service containers in GitHub Actions.

Codex should add concise entries here for meaningful completed features, migrations, infrastructure changes, and operator-visible behavior changes.
