# External Launch Plan

## Current model

Weekly simulated trading competitions only.

The company sells access to a simulated/demo training competition. Trading uses fictitious capital. The company awards weekly prizes to top eligible performers.

Working assumptions:

- SVG Business Company
- NOWPayments for later crypto-to-crypto checkout
- USDT/USDC later
- no fiat in MVP
- no customer stored crypto balance
- first-party trading simulator
- commercially licensed/permitted market-data feed

## External gates

### Company/legal

1. Get SVG counsel opinion on:
   - financial-services classification;
   - skill competition/gaming classification;
   - crypto/VAB/MSB treatment;
   - prize payout;
   - permitted countries;
   - KYC/AML;
   - business-activity wording.
2. Incorporate only after approval.
3. Prepare Terms, Competition Rules, Privacy, Refund, Simulation Disclosure, KYC/AML policy.

### NOWPayments

Before production:

1. obtain merchant acceptance for SVG entity + exact business model;
2. crypto-to-crypto only;
3. confirm supported USDT/USDC networks;
4. confirm callback/IPN authentication;
5. confirm restricted countries;
6. no fiat;
7. no stored customer balance.

### Market data

This is a critical vendor/legal gate.

Ask prospective data providers in writing:

> We operate a customer-facing browser-based simulated trading competition. We expect initially up to 10,000 registered users and approximately 5,000 concurrent active traders. We need real-time prices displayed to end users and used as the reference for simulated order execution, P&L, drawdown and leaderboard calculations.

Require:

- explicit customer-facing display rights;
- explicit simulated-trading usage rights;
- quote/tick streaming;
- historical bars;
- symbol coverage;
- latency characteristics;
- redistribution limits;
- concurrent/end-user pricing;
- production SLA;
- commercial contract.

Do not assume an individual API plan permits redistribution.

### DigitalOcean

Cloud resources are not required during early local phases.

Create DigitalOcean account/project before Phase 11.
Use `09_DIGITALOCEAN_DEPLOYMENT.md` as the purchase/configuration plan.

## Closed beta

Run a full weekly competition with mock/free payments before real-money launch.

Validate:

- persistent open positions;
- pending orders while offline;
- P&L/risk;
- drawdown;
- weekly freeze;
- leaderboard recomputation;
- admin review;
- prize workflow;
- server restart recovery;
- market-data interruption handling;
- reconciliation.
