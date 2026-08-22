# Tasks

Codex maintains this file.

Rules:

- Keep task IDs stable.
- Mark `[ ]`, `[~]`, `[x]`, or `[!]`.
- `[~]` means in progress.
- `[!]` means blocked; include blocker.
- Add acceptance criteria under non-trivial tasks.
- Never delete completed tasks; move old completed work to the Completed section if the file becomes long.

## Completed — Phase 0

- [x] P0-001 Inspect repository, initialize Git on `main`, and confirm toolchain availability.
  - Acceptance: required kickoff documents are read, repository contents are inventoried, and missing local tools are recorded.
- [x] P0-002 Initialize the pnpm workspace and root scripts.
  - Acceptance: a frozen install succeeds and root format/typecheck/lint/test commands cover every workspace.
- [x] P0-003 Create runnable `apps/web`, `apps/realtime`, and `apps/worker` skeletons.
  - Acceptance: each application has a typed entry point or route and participates in quality checks.
- [x] P0-004 Create `packages/database`, `simulator`, `market-data`, `competition`, `payments`, `shared`, and `ui`.
  - Acceptance: packages have explicit public exports and workspace dependency boundaries.
- [x] P0-005 Configure strict shared TypeScript settings and project builds.
- [x] P0-006 Configure ESLint and Prettier for the entire repository.
- [x] P0-007 Configure Vitest with an initial deterministic test suite.
- [x] P0-008 Add Docker Compose for local PostgreSQL and Valkey.
  - Acceptance: services have health checks, named volumes, explicit development ports, and no committed secrets.
- [x] P0-009 Add `.env.example` and typed Zod environment validation.
  - Acceptance: malformed configuration fails at startup without logging secret values.
- [x] P0-010 Configure the Prisma database package and client lifecycle.
- [x] P0-011 Add a structured JSON logging foundation.
- [x] P0-012 Add liveness and dependency-aware readiness foundations.
- [x] P0-013 Add GitHub Actions CI for frozen install, format, typecheck, lint, and tests.
- [x] P0-014 Document exact local setup, startup, database, seed, and quality commands.
- [x] P0-015 Pass the Phase 0 quality gate and update persistent project memory.

## Completed — Phase 1

- [x] P1-001 Define enums/state machines.
- [x] P1-002 Model User and profile.
- [x] P1-003 Model Competition and ChallengeTier.
- [x] P1-004 Model CompetitionEntry and TradingAccount.
- [x] P1-005 Model Order.
- [x] P1-006 Model Execution.
- [x] P1-007 Model Position.
- [x] P1-008 Model ClosedTrade.
- [x] P1-009 Model balance ledger.
- [x] P1-010 Model AccountSnapshot.
- [x] P1-011 Model RuleBreach.
- [x] P1-012 Model Payment.
- [x] P1-013 Model Prize/Payout.
- [x] P1-014 Model AuditEvent.
- [x] P1-015 Implement validated state-transition services.
- [x] P1-016 Seed competition tiers with configurable starting balances.
- [x] P1-017 Unit/integration tests.
  - GitHub Actions passed all 11 tests, including PostgreSQL persistence and seed integration.
- [x] P1-018 Migrations + seed commands.
- [x] P1-019 Update docs/state/handoff.

## Active — Phase 2

- [x] P2-001 Expand Phase 2 auth/application-shell work into acceptance-tested tasks.
- [x] P2-002 Add Auth.js-compatible Prisma models and migration.
  - Acceptance: account/session/token/credential data is relational, indexed, and stores no plaintext passwords.
- [x] P2-003 Implement password hashing and registration validation.
  - Acceptance: password hashes are salted, verification is timing-safe, email normalization is deterministic, and invalid input is tested.
- [x] P2-004 Configure credential authentication and typed sessions.
  - Acceptance: sessions expose only user ID, role, and status needed for authorization; suspended/closed users cannot authenticate.
- [x] P2-005 Implement registration, login, and logout flows.
  - Acceptance: duplicate registration is safe, mutations are server-owned/audited, and authentication failures do not reveal account existence.
- [x] P2-006 Build the responsive application shell and navigation.
  - Acceptance: public/authenticated states, keyboard focus, mobile layout, and reduced-motion behavior are supported.
- [x] P2-007 Build the protected trader dashboard.
  - Acceptance: the page reads the signed-in user's persisted entries/accounts and gives a useful empty state.
- [x] P2-008 Build persisted competition list/detail pages.
  - Acceptance: weekly windows and tier configuration come from PostgreSQL, with clear not-found/empty behavior.
- [x] P2-009 Add an account-owned empty terminal route.
  - Acceptance: account ownership is enforced server-side and the browser receives no authoritative mutation capability.
- [x] P2-010 Add the protected admin RBAC shell.
  - Acceptance: non-admin users are denied server-side and admins see persisted operational counts/recent audit events.
- [x] P2-011 Seed a deterministic development competition and add auth/RBAC integration tests.
- [~] P2-012 Pass the Phase 2 quality gate and update project memory/handoff.
  - Local formatter, schema validation/generation, typecheck, lint, 20-test suite, production build,
    and desktop/mobile visual checks pass. PostgreSQL/Valkey-backed GitHub Actions is pending.
