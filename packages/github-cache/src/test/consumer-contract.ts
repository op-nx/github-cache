/**
 * The consumer contract of @op-nx/github-cache as the guards share it -- the ONE source
 * of truth for each group, so no two guards can drift.
 *
 * D-04 group (a), the consumer-set process.env knobs:
 * - public-surface.spec.ts pins this against an inline sorted literal, so an intentional
 *   change to the consumer env contract still lands as a reviewable diff there.
 * - docs-adoption.spec.ts asserts each knob is documented in configuration.md.
 *
 * D-04 group (c), the package value and type exports, on exactly the same footing and
 * for exactly the same reason:
 * - public-surface.spec.ts asserts them for EXACT equality against the parsed barrel,
 *   and pins each against an inline sorted literal for the same reviewable-diff reason.
 * - docs-adoption.spec.ts asserts each export name appears in versioning.md.
 *
 * The two export arrays moved here because group (c) was pinned against the CODE and
 * never against the PROSE, so versioning.md named four of the six exports for as long as
 * ReadableBackend and WritableBackend had existed and nothing went red. That is the same
 * defect the env-knob guard's own comment already records for group (a) ("exactly what
 * happened to GITHUB_REPOSITORY") -- the lesson was applied to one group and never
 * generalized.
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
  'CACHE_READ_ONLY',
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GITHUB_REPOSITORY',
];

/** D-04 group (c): the runtime value exports of the package barrel. */
export const EXPECTED_VALUE_EXPORTS = ['createCacheServer'];

/** D-04 group (c): the type-only exports of the package barrel. */
export const EXPECTED_TYPE_EXPORTS = [
  'CacheBackend',
  'GetHit',
  'GetResult',
  'PutResult',
  'ReadableBackend',
  'WritableBackend',
];
