import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/github-cache',
  test: {
    name: '@op-nx/github-cache',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // *.integration.spec.ts is owned by the separate `integration` target
    // (vitest.integration.config.mts); exclude it here so it does not double-run
    // under the fast unit `test` target. Spread configDefaults.exclude so the
    // built-in node_modules/dist exclusions are preserved (a bare array replaces
    // them, which would make vitest scan node_modules).
    exclude: [
      ...configDefaults.exclude,
      '{src,tests}/**/*.integration.spec.{ts,mts,cts}',
    ],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
