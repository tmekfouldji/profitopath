import {
  database,
  type UserRole,
  type UserStatus,
} from '@profitopath/database';
import { provisionTwelveDataTrialStaffAccount } from '@profitopath/competition';
import { workerServiceEnvSchema } from '@profitopath/shared';
import { config } from 'dotenv';

config({ path: '../../.env', quiet: true });

const env = workerServiceEnvSchema.parse({
  ...process.env,
  PORT: process.env.WORKER_PORT ?? 3002,
});

if (env.MARKET_DATA_SOURCE !== 'twelve-data-trial') {
  throw new Error(
    'MARKET_DATA_SOURCE=twelve-data-trial is required to provision a staff validation account',
  );
}

const configuredUserId = process.env.TWELVE_DATA_TRIAL_STAFF_USER_ID?.trim();
const configuredCompetitionId =
  process.env.TWELVE_DATA_TRIAL_COMPETITION_ID?.trim();

try {
  const candidateUsers =
    configuredUserId === undefined || configuredUserId.length === 0
      ? await database.user.findMany({
          select: { id: true },
          where: {
            role: 'SUPERADMIN' satisfies UserRole,
            status: 'ACTIVE' satisfies UserStatus,
          },
        })
      : [{ id: configuredUserId }];
  if (candidateUsers.length !== 1) {
    throw new Error(
      'Set TWELVE_DATA_TRIAL_STAFF_USER_ID when there is not exactly one active superadmin',
    );
  }

  const provisioned = await provisionTwelveDataTrialStaffAccount({
    actorUserId: candidateUsers[0]!.id,
    ...(configuredCompetitionId === undefined ||
    configuredCompetitionId.length === 0
      ? {}
      : { competitionId: configuredCompetitionId }),
  });
  console.log(
    JSON.stringify({
      accountId: provisioned.accountId,
      alreadyProvisioned: provisioned.alreadyProvisioned,
      competitionId: provisioned.competitionId,
      status: 'ok',
    }),
  );
} finally {
  await database.$disconnect();
}
