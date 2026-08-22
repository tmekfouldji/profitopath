import { PrismaClient } from '@prisma/client';

const prismaGlobal = globalThis as typeof globalThis & {
  profitopathPrisma?: PrismaClient;
};

export const database =
  prismaGlobal.profitopathPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : [{ emit: 'stdout', level: 'error' }],
  });

if (process.env.NODE_ENV !== 'production') {
  prismaGlobal.profitopathPrisma = database;
}
