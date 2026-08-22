# AGENTS.md

## Mission

Build a production-quality MVP for weekly simulated trading competitions.

## Absolute scope

Build only:

- simulated/demo trading;
- weekly competitions;
- browser trading terminal;
- persistent orders/positions/history;
- rule enforcement;
- leaderboard;
- payments for competition access;
- company-funded prize administration.

Do not build:

- funded accounts;
- profit splits;
- real-market/live brokerage execution;
- liquidity routing;
- customer trading deposits;
- internal crypto custody/balances;
- copy trading.

## Mandatory session startup

At the start of every Codex conversation/session:

1. Read `README.md`.
2. Read `PROJECT_STATE.md`.
3. Read `TASKS.md`.
4. Read `DECISIONS.md`.
5. Read `SESSION_HANDOFF.md`.
6. Read the relevant product/architecture/build-phase docs.
7. Inspect Git status and recent commits.
8. Identify the active phase and first incomplete task.

Do not ask the user what was done previously if the repository can answer it.

## Mandatory task discipline

Before implementing:

- expand the active phase into concrete tasks in `TASKS.md` if necessary;
- mark current task `[~]`;
- state the intended change briefly.

During implementation:

- keep commits/work coherent;
- do not silently change product economics;
- record new irreversible/material decisions in `DECISIONS.md`.

Before ending:

1. run formatter;
2. run typecheck;
3. run lint;
4. run relevant tests;
5. mark completed/blocked tasks;
6. update `PROJECT_STATE.md`;
7. rewrite `SESSION_HANDOFF.md`;
8. update `CHANGELOG.md` when relevant.

The repository state files are the project's persistent memory.

## Engineering priorities

1. Trading correctness.
2. Determinism and auditability.
3. Persistence/recovery.
4. Security.
5. Idempotency.
6. Horizontal scalability.
7. Testability.
8. UI quality.

## Trading correctness rules

- Browser is never authoritative.
- Orders, executions and positions are separate concepts.
- Open positions survive disconnect/restart.
- Pending SL/TP/orders continue while user is offline.
- Drawdown enforcement is server-side.
- Permanent history is PostgreSQL-backed.
- Hot derived state is rebuildable.
- Use Decimal/integer representations; never use JS floating-point for money-sensitive accounting.
- Explicitly version trading/rule configuration.

## Infrastructure rules

- Dockerize deployables.
- No irreplaceable local disk.
- Configuration through environment/secret manager.
- DigitalOcean infrastructure through Terraform when cloud work begins.
- New worker nodes must auto-join queues/streams.
- No manually hard-coded server lists in app code.
- Prefer DNS/service configuration and load balancers.

## Provider rules

- Do not invent APIs.
- Mock market data first.
- Do not integrate a real market-data feed without explicit documentation and commercial-use approval.
- Mock payments first.
- NOWPayments is the planned first production adapter but not part of early phases.
- Do not enable fiat features.
- No customer stored-value crypto balance.

## Testing minimums

Eventually include:

- order creation/fill/cancel;
- market/limit/stop;
- SL/TP;
- P&L;
- margin;
- spread;
- commission/swap if enabled;
- offline persistent positions;
- restart recovery;
- exact drawdown boundary;
- short-lived breach handling;
- duplicate events;
- leaderboard ties;
- weekly cutoff;
- audit records;
- payment idempotency;
- worker failure/reclaim.
