# MVP Product Specification

## Scope

The MVP is **weekly simulated trading competitions only**.

Do not build:

- funded accounts;
- prop-firm evaluation programs;
- profit splits;
- live brokerage execution;
- liquidity routing;
- customer trading deposits;
- copy trading;
- internal crypto balances.

## User flow

1. User registers.
2. User chooses Rookie, Trader, or Elite.
3. User pays for one specific competition entry.
4. Payment is confirmed server-side.
5. A simulated trading account is created.
6. Competition becomes tradable during the configured weekly window.
7. Trader uses our browser terminal.
8. Orders and positions persist if the browser is closed.
9. Server-side P&L, equity, margin and drawdown continue while the trader is offline.
10. At weekly close, the authoritative leaderboard is frozen.
11. Winners are reviewed.
12. Required KYC/compliance review is completed.
13. Company pays prizes manually in the MVP.
14. Competition is archived; next weekly competition starts.

## Roles

### Visitor

- view tiers
- view leaderboard
- read rules
- register

### Trader

- purchase competition entry
- access simulated account
- open/cancel/modify supported orders
- view open positions
- view live P&L/equity/margin
- view order history
- view execution/trade history
- view drawdown
- view leaderboard position
- view past competitions
- view breach reason if failed

### Admin

- configure weekly competitions
- configure tiers/rules
- inspect payments
- inspect accounts/orders/executions/positions
- recompute competition
- review breaches
- disqualify with audit reason
- freeze/finalize leaderboard
- review winners
- record KYC state
- approve prize
- record payout transaction
- inspect audit log

## Persistence requirements

The browser is never the source of trading truth.

Permanent records in PostgreSQL:

- TradingAccount
- Order
- Execution
- Position
- ClosedTrade
- AccountBalanceLedgerEntry
- RuleBreach
- Competition
- CompetitionEntry
- LeaderboardFinalization
- Payment
- Prize
- Payout
- AuditEvent

Hot/live state in Valkey:

- latest prices
- active position indexes
- current derived unrealized P&L
- current derived equity/margin
- WebSocket routing/session state
- queues/streams

If Valkey is lost, the application must rebuild live state from PostgreSQL plus the latest market prices.

## Trading model

Initial supported order types:

- market
- limit
- stop
- stop loss
- take profit

MVP should support:

- bid/ask
- spreads
- configurable contract size
- configurable leverage
- margin
- realized/unrealized P&L
- commissions if configured
- swaps/overnight financing if configured
- market hours
- position close
- partial close only if deliberately added and tested

## Offline behavior

If a trader closes the browser:

- positions remain open;
- pending orders remain active;
- stop loss / take profit remain active;
- drawdown rules continue to run;
- weekly cutoff continues to apply;
- market-data events continue to update risk state.

Re-login reloads authoritative position/order/account state and resumes WebSocket updates.

## Weekly leaderboard

Each tier has a separate leaderboard.

Eligible users:

- active/completed account;
- no rule breach;
- no disqualification;
- valid competition entry.

Proposed tie breaks:

1. higher net performance;
2. lower maximum observed drawdown;
3. earlier time final score was reached;
4. earlier valid entry activation.

Must remain configurable/versioned until approved.

## Prize model

Company-funded weekly prize allocation.

Current allocation concept:

- 1st: 40%
- 2nd: 25%
- 3rd: 15%
- 4th: 10%
- 5th: 5% + two free entries
- 5%: rollover/bonus reserve

Exact legal/public wording must be counsel-approved.

## Scale target

Architecture must support horizontal scaling toward:

- 10,000 concurrent sessions;
- 5,000 active traders;
- 50–100 symbols;
  without changing domain architecture.
