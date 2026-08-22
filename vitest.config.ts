import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)),
      'server-only': fileURLToPath(
        new URL('./test-support/server-only.ts', import.meta.url),
      ),
    },
  },
  test: {
    coverage: {
      include: ['packages/*/src/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'json-summary'],
    },
    include: ['packages/**/*.test.{ts,tsx}', 'apps/**/*.test.{ts,tsx}'],
    passWithNoTests: false,
    restoreMocks: true,
  },
});
