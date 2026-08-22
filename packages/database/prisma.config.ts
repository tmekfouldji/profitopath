import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

config({ path: '../../.env', quiet: true });

export default defineConfig({
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  schema: 'prisma/schema.prisma',
});
