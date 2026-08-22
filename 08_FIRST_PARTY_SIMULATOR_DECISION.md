# First-Party Trading Simulator Decision

## Decision

The MVP will not use MT4 or MT5. We will build a browser-based simulated trading terminal and execution engine.

## Why

- no per-account MetaTrader dependency;
- better economics at $5/$10/$15 entry prices;
- one integrated user experience;
- full control of rule engine and leaderboard;
- easier scaling to tens of thousands of demo accounts;
- reusable core for future funded-trader evaluation;
- provider lock-in limited mainly to market data, which is abstracted.

## What we build

- charts;
- quote streaming;
- market/limit/stop orders;
- SL/TP;
- positions and history;
- P&L/equity/margin;
- drawdown and rule enforcement;
- weekly leaderboard;
- audit/replay.

## What we buy

A commercial market-data license/feed with explicit rights to display/redistribute data inside the paid simulator.

## Scale target

- 25,000 registered accounts;
- 10,000 active weekly accounts;
- ~2,000 concurrent traders;
- 20–50 launch instruments.

## Future prop-firm compatibility

The simulator becomes the evaluation environment. Future funded-trader programs can reuse:

- users/KYC;
- simulated accounts;
- rule engine;
- performance metrics;
- anti-cheat;
- leaderboard;
- payouts;
- audit logs.

If the future business executes real capital in financial markets, live execution must be implemented as a separate regulated/provider layer after legal review.
