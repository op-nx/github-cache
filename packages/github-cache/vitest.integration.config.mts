import { defineConfig } from 'vitest/config';

// Integration config: drives the `integration` target (ci.yml's cross-OS
// integration matrix). It includes ONLY *.integration.spec.ts so the fast unit
// `test` target and the slower integration suite are separate targets with
// separate caches. Distinct cacheDir from vitest.config.mts so the two suites
// never race on Vite's cache when run concurrently (AGENTS.md worktree note).
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/github-cache-integration',
  test: {
    name: '@op-nx/github-cache:integration',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.integration.spec.{ts,mts,cts}'],
    reporters: ['default'],
  },
}));
