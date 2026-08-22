# Codex Master Prompt — Start Here

You are the lead engineer for this repository.

Read these files first and treat them as authoritative project context:

1. `README.md`
2. `AGENTS.md`
3. `01_EXTERNAL_LAUNCH_PLAN.md`
4. `02_PRODUCT_SPEC.md`
5. `03_TECHNICAL_ARCHITECTURE.md`
6. `04_BUILD_PHASES.md`
7. `06_DECISIONS_REQUIRED.md`

## Goal

Build the MVP incrementally. Start with **Phase 0 and Phase 1 only**. Do not jump to a commercial market-data feed or real crypto integrations.

## Stack

Use:

- latest stable Next.js compatible with the local environment
- TypeScript
- pnpm
- PostgreSQL
- Prisma
- Redis
- Docker Compose
- Zod
- Tailwind
- Vitest (or Jest if there is a strong reason)
- Playwright for later E2E

Keep dependencies minimal.

## Phase 0 tasks

1. Initialize the application if the repository is not already initialized.
2. Create a clean project structure.
3. Add Docker Compose with PostgreSQL and Redis.
4. Add `.env.example`; never create real secrets.
5. Configure Prisma.
6. Configure linting, formatting, type checking and tests.
7. Add a simple CI workflow that runs install/typecheck/lint/test.
8. Add health endpoints for application/database/redis where sensible.
9. Add structured server logging.
10. Update README with exact local startup commands.

## Phase 1 tasks

Implement the domain/data layer for:

- User
- Competition
- ChallengeTier
- ChallengePurchase
- ChallengeAccount
- AccountSnapshot
- Execution
- RuleBreach
- Payment
- Refund
- PrizeAllocation
- PrizeWinner
- FreeChallengeCredit
- AuditEvent

Implement challenge and competition states from `02_PRODUCT_SPEC.md`.

Seed these tiers:

- Rookie: $5 entry, $1,000 max drawdown, $2,000 target
- Trader: $10 entry, $2,000 max drawdown, $4,000 target
- Pro: $15 entry, $4,000 max drawdown, $6,000 target

Because starting account balances are not yet decided, model them as configurable and use clearly-labeled development seed values rather than presenting them as approved production rules.

## Critical implementation rules

- Store fiat money in integer minor units.
- Use Decimal for high-precision trading/crypto values.
- All timestamps UTC internally.
- Store the contest/business timezone as configuration.
- Make state transitions explicit, validated and tested.
- Create audit records for meaningful state changes.
- Do not implement a real payment processor.
- Do not implement MT4/MT5. This project now uses a first-party simulated execution engine.
- Do not connect to a commercial market-data provider yet; create a deterministic `MockMarketDataProvider` abstraction.
- Do not implement automated payouts.
- Do not invent missing legal/business decisions.
- Put unresolved settings in configuration and document them.

## Tests required now

Write tests for:

- valid challenge transitions;
- invalid challenge transitions;
- competition transitions;
- audit event creation;
- challenge-tier seed values;
- decimal/money handling.

## Execution behavior

You have permission to create/edit files and run local development commands needed for Phase 0–1.

Do not ask me routine implementation questions. Choose sensible reversible development defaults and document them.

Stop only when Phase 0 and Phase 1:

- compile;
- typecheck;
- lint;
- tests pass;
- local startup instructions are documented.

At the end, provide:

1. what you implemented;
2. commands I should run;
3. tests/status;
4. important design decisions;
5. unresolved items from `06_DECISIONS_REQUIRED.md`;
6. the exact recommended prompt for the next Codex turn to begin Phase 2.

## Updated product direction

MetaTrader is no longer part of the MVP.

We are building our own browser trading simulator. Architecture must include:

- `MarketDataProvider` abstraction;
- deterministic mock quote stream for development;
- `SimulatedExecutionEngine`;
- Order, Execution, Position, AccountSnapshot and SymbolSpecification domain types;
- exact Decimal/fixed-point arithmetic;
- server-side authoritative P&L/equity/margin/drawdown;
- future WebSocket fan-out design;
- audit/replay capability.

Do not build the full UI terminal during Phase 0–1. Establish the domain boundaries so Phase 4 and Phase 8 can add it cleanly.

A future real prop/live-execution layer must be an optional separate adapter and must not contaminate the simulator domain.
