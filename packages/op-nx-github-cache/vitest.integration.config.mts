import { defineConfig } from 'vitest/config';

// Integration tests only (real sockets / real filesystem). Kept out of the
// `@nx/vitest`-inferred `test` target: the filename intentionally does NOT match
// the plugin's `{vite,vitest}.config.*` glob, so it is driven by the explicit
// `test-integration` target instead. That target hashes an OS+arch discriminator
// so a Linux cache never satisfies a Windows run (and vice versa).
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/op-nx-github-cache-integration',
  test: {
    name: '@op-nx/github-cache:integration',
    watch: false,
    globals: true,
    environment: 'node',
    include: [
      '{src,tests}/**/*.integration.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage-integration',
      provider: 'v8' as const,
    },
  },
}));
