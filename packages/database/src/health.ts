import type { PrismaClient } from '@prisma/client';

import { database } from './client';

export async function checkDatabase(
  client: Pick<PrismaClient, '$queryRaw'> = database,
): Promise<void> {
  await client.$queryRaw`SELECT 1`;
}
