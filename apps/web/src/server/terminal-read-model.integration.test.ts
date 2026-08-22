import { database } from '@profitopath/database';
import { afterEach, describe, expect, it } from 'vitest';

import { getOwnedTerminalState } from './terminal-read-model';

const integrationTest = describe.runIf(
  process.env.RUN_DATABASE_TESTS === 'true',
);
const fixtures: Array<{
  accountId: string;
  competitionId: string;
  entryId: string;
  tierId: string;
  userId: string;
}> = [];

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await database.accountSnapshot.deleteMany({
      where: { tradingAccountId: fixture.accountId },
    });
    await database.position.deleteMany({
      where: { tradingAccountId: fixture.accountId },
    });
    await database.execution.deleteMany({
      where: { tradingAccountId: fixture.accountId },
    });
    await database.order.deleteMany({
      where: { tradingAccountId: fixture.accountId },
    });
    await database.tradingAccount.delete({ where: { id: fixture.accountId } });
    await database.competitionEntry.delete({ where: { id: fixture.entryId } });
    await database.competition.delete({ where: { id: fixture.competitionId } });
    await database.challengeTier.delete({ where: { id: fixture.tierId } });
    await database.user.delete({ where: { id: fixture.userId } });
  }
});

integrationTest('terminal read model', () => {
  it('returns only owned authoritative account, risk, order and execution state', async () => {
    const suffix = crypto.randomUUID();
    const fixture = await database.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { email: `terminal-${suffix}@example.test` },
      });
      const tier = await transaction.challengeTier.create({
        data: {
          code: `TERM-${suffix.slice(0, 8)}`,
          entryFeeMinor: 500,
          maxDrawdownMinor: 100_000n,
          name: 'Terminal Test Tier',
          performanceBenchmarkMinor: 200_000n,
          startingBalanceMinor: 1_000_000n,
        },
      });
      const competition = await transaction.competition.create({
        data: {
          code: `TERM-${suffix.slice(9, 17)}`,
          name: 'Terminal Test Week',
          rulesVersion: 1,
          signupClosesAt: new Date('2026-08-24T07:00:00.000Z'),
          status: 'ACTIVE',
          tradingEndsAt: new Date('2026-08-28T17:00:00.000Z'),
          tradingStartsAt: new Date('2026-08-24T08:00:00.000Z'),
        },
      });
      const entry = await transaction.competitionEntry.create({
        data: {
          competitionId: competition.id,
          status: 'ACTIVE',
          tierId: tier.id,
          userId: user.id,
        },
      });
      const account = await transaction.tradingAccount.create({
        data: {
          balanceMinor: 1_000_000n,
          competitionEntryId: entry.id,
          configVersion: 1,
          startingBalanceMinor: 1_000_000n,
          status: 'ACTIVE',
        },
      });
      const order = await transaction.order.create({
        data: {
          acceptedAt: new Date('2026-08-24T09:00:00.000Z'),
          clientOrderId: `terminal-${suffix}`,
          instrumentVersion: 1,
          quantity: '0.1',
          side: 'BUY',
          status: 'FILLED',
          submittedAt: new Date('2026-08-24T09:00:00.000Z'),
          symbol: 'EURUSD',
          tradingAccountId: account.id,
          type: 'MARKET',
        },
      });
      const execution = await transaction.execution.create({
        data: {
          engineEventId: `terminal:${suffix}`,
          executedAt: new Date('2026-08-24T09:00:00.000Z'),
          instrumentVersion: 1,
          notional: '11002',
          orderId: order.id,
          price: '1.1002',
          quantity: '0.1',
          side: 'BUY',
          symbol: 'EURUSD',
          tradingAccountId: account.id,
        },
      });
      await transaction.position.create({
        data: {
          averageEntryPrice: '1.1002',
          instrumentVersion: 1,
          openedAt: execution.executedAt,
          openingExecutionId: execution.id,
          quantity: '0.1',
          side: 'LONG',
          symbol: 'EURUSD',
          tradingAccountId: account.id,
        },
      });
      await transaction.accountSnapshot.create({
        data: {
          asOf: new Date('2026-08-24T09:00:00.000Z'),
          balanceMinor: 1_000_000n,
          dataVersion: 1,
          equityMinor: 999_800n,
          marginFreeMinor: 988_800n,
          marginUsedMinor: 11_000n,
          maxDrawdownMinor: 200n,
          sequence: 1n,
          tradingAccountId: account.id,
          unrealizedPnlMinor: -200n,
        },
      });
      return {
        accountId: account.id,
        competitionId: competition.id,
        entryId: entry.id,
        tierId: tier.id,
        userId: user.id,
      };
    });
    fixtures.push(fixture);

    const owned = await getOwnedTerminalState(
      fixture.accountId,
      fixture.userId,
    );
    const notOwned = await getOwnedTerminalState(
      fixture.accountId,
      crypto.randomUUID(),
    );

    expect(notOwned).toBeNull();
    expect(owned).toMatchObject({
      account: { id: fixture.accountId, status: 'ACTIVE' },
      metrics: {
        equityMinor: '999800',
        marginUsedMinor: '11000',
        unrealizedPnlMinor: '-200',
      },
    });
    expect(owned?.positions).toHaveLength(1);
    expect(owned?.orders).toHaveLength(1);
    expect(owned?.executions).toHaveLength(1);
  });
});
