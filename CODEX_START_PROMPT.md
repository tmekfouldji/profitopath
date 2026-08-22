# Codex Start Prompt

You are the lead engineer for this repository.

This repository itself is the persistent project memory. A new conversation must be able to resume from Git without relying on previous chat context.

## First actions — mandatory

Read, in this order:

1. `AGENTS.md`
2. `README.md`
3. `PROJECT_STATE.md`
4. `TASKS.md`
5. `DECISIONS.md`
6. `SESSION_HANDOFF.md`
7. `02_PRODUCT_SPEC.md`
8. `03_TECHNICAL_ARCHITECTURE.md`
9. `04_BUILD_PHASES.md`
10. `09_DIGITALOCEAN_DEPLOYMENT.md`

Then inspect:

- repository tree;
- Git status;
- recent commits;
- package/tool availability.

Do not ask me what was done previously unless these sources genuinely conflict.

## Project scope

Build a weekly simulated trading competition platform only.

Users purchase a competition entry, receive a fictitious trading account, trade for the configured five-day weekly window in our own browser terminal, and are ranked on a tier-specific leaderboard. Weekly prizes are company-funded.

Do not implement prop/funded accounts or live-market execution.

## Technical direction

One pnpm TypeScript monorepo.

Deployable applications:

- `apps/web`
- `apps/realtime`
- `apps/worker`

Core packages:

- `packages/database`
- `packages/simulator`
- `packages/market-data`
- `packages/competition`
- `packages/payments`
- `packages/shared`
- `packages/ui`

Use:

- Next.js
- TypeScript
- Tailwind
- TradingView Lightweight Charts later
- PostgreSQL
- Prisma
- Valkey/Redis-compatible client
- WebSockets
- queues/streams
- Zod
- Vitest
- Playwright later
- Docker
- Terraform later
- GitHub Actions

## Scalability requirements

Design from the start for horizontal scaling toward:

- 25k accounts;
- 10k connected sessions;
- 5k actively trading users.

Do not provision that capacity now.

Compute must be stateless/replaceable.
PostgreSQL is authoritative persistent state.
Valkey is hot/rebuildable state.
No server-local persistent trading state.

## Current task

Follow `PROJECT_STATE.md`.

If the active phase is Phase 0:

1. break Phase 0 into sufficiently concrete tasks in `TASKS.md`;
2. mark the first task in progress;
3. implement Phase 0;
4. continue into Phase 1 only after Phase 0 acceptance checks pass.

You have permission to create/edit repository files and run development commands needed for the active phase.

Use sensible reversible defaults instead of asking routine setup questions.

## Required quality gate before completing a phase

- formatter passes;
- typecheck passes;
- lint passes;
- tests pass;
- migrations/seeds run where relevant;
- README/local commands are correct;
- tracking files are updated.

## Persistent advancement protocol

Before you stop working for any reason:

### Update `TASKS.md`

- mark completed work `[x]`;
- current partial work `[~]`;
- blockers `[!]` with explanation;
- add newly discovered tasks.

### Update `PROJECT_STATE.md`

Record:

- current phase;
- completed milestone;
- next task;
- blockers;
- test/build status.

### Rewrite `SESSION_HANDOFF.md`

Include:

- exactly what changed;
- files/components touched;
- commands run;
- test results;
- known failures;
- current Git/worktree state;
- exact next task;
- any operational warnings.

### Update `DECISIONS.md`

Only for meaningful technical/product decisions.

### Update `CHANGELOG.md`

For meaningful completed behavior/features.

This protocol is mandatory because future Codex conversations will depend on these files.

## Phase 0–1 objective

Complete the repository foundation and domain/database foundation.

Do not implement:

- real market data;
- NOWPayments;
- DigitalOcean production provisioning;
- trading UI;
- real WebSockets;
  until their scheduled phases.

At the end of Phase 0–1, provide a concise summary and leave the repository in a clean resumable state.
