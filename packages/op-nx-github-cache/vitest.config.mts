import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/op-nx-github-cache',
  test: {
    name: '@op-nx/github-cache',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Test tiers: this fast `test` target runs UNIT specs only and stays
    // OS-portable (cross-OS cache hits). The slower `integration` tier
    // (real sockets / real filesystem) lives alongside as *.integration.spec.*
    // with an OS-sensitive hash, so it is excluded here. The e2e tier
    // (black-box / whole-system) lives in a separate `*-e2e` project (plain
    // *.spec.ts), and the `act`-based GitHub Actions tests are their own tier
    // (npm `test:act`) -- neither is part of this project's specs.
    exclude: [
      ...configDefaults.exclude,
      '{src,tests}/**/*.integration.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
