import { type Prisma, database } from '@profitopath/database';

const source = 'TWELVE_DATA_TRIAL';
const symbols = ['EURUSD', 'GBPUSD'] as const;

export interface TwelveDataTrialInstrumentConfig {
  fullSpread: string;
  symbol: (typeof symbols)[number];
}

export class TwelveDataTrialInstrumentConfigurationError extends Error {
  constructor(message: string) {
    super(`Twelve Data trial instrument configuration failed: ${message}`);
    this.name = 'TwelveDataTrialInstrumentConfigurationError';
  }
}

function spreadForSymbol(
  symbol: (typeof symbols)[number],
  input: Readonly<Record<string, string>>,
): string {
  const spread = input[symbol];
  if (spread === undefined || spread.trim().length === 0) {
    throw new TwelveDataTrialInstrumentConfigurationError(
      `full spread is missing for ${symbol}`,
    );
  }
  return spread;
}

export function twelveDataTrialInstrumentConfigs(
  spreads: Readonly<Record<string, string>>,
): readonly TwelveDataTrialInstrumentConfig[] {
  return symbols.map((symbol) => ({
    fullSpread: spreadForSymbol(symbol, spreads),
    symbol,
  }));
}

export async function assertTwelveDataTrialInstrumentConfigurations(
  spreads: Readonly<Record<string, string>>,
): Promise<void> {
  const required = twelveDataTrialInstrumentConfigs(spreads);
  const active = await database.instrumentConfiguration.findMany({
    select: { marketDataSource: true, symbol: true, syntheticSpread: true },
    where: {
      active: true,
      symbol: { in: required.map((configuration) => configuration.symbol) },
    },
  });
  for (const expected of required) {
    const configurations = active.filter(
      (candidate) => candidate.symbol === expected.symbol,
    );
    const configuration = configurations[0];
    if (
      configurations.length !== 1 ||
      configuration === undefined ||
      configuration.marketDataSource !== source ||
      configuration.syntheticSpread?.toString() !== expected.fullSpread
    ) {
      throw new TwelveDataTrialInstrumentConfigurationError(
        `${expected.symbol} must have an active ${source} version with full spread ${expected.fullSpread}`,
      );
    }
  }
}

async function lockConfiguration(
  transaction: Prisma.TransactionClient,
): Promise<void> {
  await transaction.$queryRaw`
    SELECT 1 AS "locked"
    FROM (
      SELECT pg_advisory_xact_lock(hashtextextended('market-data-config:twelve-data-trial', 0))
    ) AS twelve_data_trial_lock
  `;
}

/**
 * Creates new immutable instrument versions. Old positions retain their old
 * version, while new trial orders reference the persisted spread/source rule.
 */
export async function activateTwelveDataTrialInstrumentConfigurations(
  spreads: Readonly<Record<string, string>>,
): Promise<readonly { symbol: string; version: number }[]> {
  const required = twelveDataTrialInstrumentConfigs(spreads);
  return database.$transaction(async (transaction) => {
    await lockConfiguration(transaction);
    const activated: Array<{ symbol: string; version: number }> = [];
    for (const expected of required) {
      const configurations = await transaction.instrumentConfiguration.findMany(
        {
          orderBy: { version: 'desc' },
          where: { symbol: expected.symbol },
        },
      );
      const active = configurations.find(
        (configuration) => configuration.active,
      );
      if (active === undefined) {
        throw new TwelveDataTrialInstrumentConfigurationError(
          `no active base instrument exists for ${expected.symbol}`,
        );
      }
      if (
        active.marketDataSource === source &&
        active.syntheticSpread?.toString() === expected.fullSpread
      ) {
        activated.push({ symbol: expected.symbol, version: active.version });
        continue;
      }
      const version = (configurations[0]?.version ?? 0) + 1;
      await transaction.instrumentConfiguration.updateMany({
        data: { active: false },
        where: { active: true, symbol: expected.symbol },
      });
      const created = await transaction.instrumentConfiguration.create({
        data: {
          active: true,
          baseCurrency: active.baseCurrency,
          contractSize: active.contractSize,
          leverage: active.leverage,
          marketDataSource: source,
          marketHoursMode: active.marketHoursMode,
          minimumQuantity: active.minimumQuantity,
          priceScale: active.priceScale,
          quantityStep: active.quantityStep,
          quoteCurrency: active.quoteCurrency,
          symbol: expected.symbol,
          syntheticSpread: expected.fullSpread,
          version,
        },
      });
      await transaction.auditEvent.upsert({
        create: {
          action: 'INSTRUMENT_CONFIGURATION_ACTIVATED',
          after: {
            fullSyntheticSpread: expected.fullSpread,
            marketDataSource: source,
            version,
          },
          before: {
            marketDataSource: active.marketDataSource,
            syntheticSpread: active.syntheticSpread?.toString() ?? null,
            version: active.version,
          },
          entityId: created.id,
          entityType: 'InstrumentConfiguration',
          idempotencyKey: `audit:instrument-configuration:${source}:${expected.symbol}:${version}`,
          reason: 'Twelve Data commercial trial activation',
        },
        update: {},
        where: {
          idempotencyKey: `audit:instrument-configuration:${source}:${expected.symbol}:${version}`,
        },
      });
      activated.push({ symbol: expected.symbol, version });
    }
    return activated;
  });
}
