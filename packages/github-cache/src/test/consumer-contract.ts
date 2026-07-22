/**
 * The consumer-set process.env knobs of @op-nx/github-cache (D-04 group a) -- the ONE
 * source of truth both contract guards share, so the two can never drift.
 *
 * - public-surface.spec.ts pins this against an inline sorted literal, so an intentional
 *   change to the consumer env contract still lands as a reviewable diff there.
 * - docs-adoption.spec.ts asserts each knob is documented in configuration.md.
 *
 * A test fixture (kept alongside test/octokit-fault.ts), not runtime surface -- it is
 * imported only by the *.spec.ts guards, never by the package barrel.
 */
export const EXPECTED_ENV_KNOBS = [
  'NX_SELF_HOSTED_REMOTE_CACHE_SERVER',
  'NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN',
  'PORT',
  'CACHE_MIRROR_MAX_AGE_DAYS',
  'CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION',
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GITHUB_REPOSITORY',
];
