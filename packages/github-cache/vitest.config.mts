import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/github-cache',
  test: {
    name: '@op-nx/github-cache',
    watch: false,
    globals: true,
    environment: 'node',
    // Neutralize the consumer cache-client vars for the whole suite. ci.yml's four
    // wired jobs pre-set these into $GITHUB_ENV job-wide so Nx can reach the sidecar,
    // which means every serve() call here would otherwise ADOPT the CI-minted token
    // instead of minting one -- and serve.spec.ts's "mints a CSPRNG bearer token"
    // assertion (/^[a-f0-9]{64}$/) would still pass, because the workflow's
    // randomBytes(32).toString('hex') is ALSO 64 lowercase hex. The assertion would
    // silently stop testing minting, so a regression in generateToken() (empty,
    // constant, short) would pass CI and only fail locally -- on a bearer-token path.
    // '' and not undefined: serve.ts resolves with || not ?? (deliberately, so a
    // blank value mints a fresh token), so '' falls through to generateToken().
    // Only this config needs it -- the integration suite has no serve() call.
    env: {
      NX_SELF_HOSTED_REMOTE_CACHE_SERVER: '',
      NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN: '',
    },
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
