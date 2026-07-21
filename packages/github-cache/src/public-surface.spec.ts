/**
 * DOCS-05 consumer-contract guard (the enumerated, tested public surface).
 *
 * Enumerates the EXACT consumer contract of @op-nx/github-cache and fails
 * `nx test github-cache` on any unintended change to it, so an internal dogfood
 * refactor in this repo can never silently alter what an external adopter depends
 * on (ROADMAP Risk 1; the dogfood-changes-stay-consumer-safe invariant).
 *
 * The contract is the D-04 "consumer contract only" set, in four groups:
 *   (c) package value exports  -> the runtime barrel keys of ./index.js
 *       package type exports   -> the `export type { ... }` names in ./index.ts
 *   (b) consumer action inputs -> the `inputs:` keys of start-cache-server/action.yml
 *   (a) consumer env knobs     -> the documented process.env knobs, each cross-checked
 *                                 for presence in the package source
 *   plus the FIXED body cap    -> MAX_CACHE_BODY_BYTES (a const contract limit, 2 GiB,
 *                                 NOT an env knob; resolved open question 1).
 *
 * Style: explicit-assertion-list, NOT toMatchSnapshot() (the pinned-deps.spec.ts /
 * ppe-action.spec.ts precedent, D-05). An intentional surface change is made by
 * editing the EXPECTED_* lists below, so the contract change lands as an obvious,
 * reviewable diff in THIS file -- preferred over a `.snap` whose `-u` regen is easy
 * to rubber-stamp. Under the D-01 pre-1.0 posture the surface MAY still evolve; the
 * guard only guarantees a change is intentional and reviewed, never that it is frozen.
 *
 * Internal module exports (withHashLock, shardTag, octokitFault, isWriteTrusted, and
 * ~25 others) are DELIBERATELY out of scope (D-04): the exact-equality assertion on
 * the barrel keys excludes them structurally, without naming any of them, so internal
 * refactors do not churn this guard.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as barrel from './index.js';
import { MAX_CACHE_BODY_BYTES } from './server/server.js';

// --- The enumerated consumer contract. An intentional, reviewed surface change
// edits the lists below; that edit IS the human-readable diff a reviewer sees. ---

/** D-04 group (c): the runtime value exports of the package barrel. */
const EXPECTED_VALUE_EXPORTS = ['createCacheServer'];

/** D-04 group (c): the type-only exports of the package barrel. */
const EXPECTED_TYPE_EXPORTS = [
  'CacheBackend',
  'GetHit',
  'GetResult',
  'PutResult',
];

/** D-04 group (b): the consumer JS action inputs. */
const EXPECTED_ACTION_INPUTS = ['port'];

/** D-04 group (a): the consumer-set process.env knobs. */
const EXPECTED_ENV_KNOBS = [
  'NX_SELF_HOSTED_REMOTE_CACHE_SERVER',
  'NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN',
  'PORT',
  'CACHE_MIRROR_MAX_AGE_DAYS',
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GITHUB_REPOSITORY',
];

/**
 * The fixed set of package source files a documented env knob must still appear
 * in. A code refactor that renames or drops a knob orphans it from this set and
 * fails the guard (T-06-02-02: a silent cache-MISS class defect). Paths are
 * resolved from this spec via import.meta.url (the pinned-deps.spec.ts idiom).
 */
const KNOB_SOURCE_FILES = [
  './server/server.ts',
  './serve.ts',
  './lib/retention.ts',
  './lib/github-identity.ts',
  './lib/select-backend.ts',
  '../../../start-cache-server/entry.ts',
];

/** The fixed 2 GiB PUT body cap (SRV-04), a contract limit and NOT an env knob. */
const EXPECTED_MAX_CACHE_BODY_BYTES = 2_147_483_648;

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

/**
 * Parse the `export type { ... }` names out of the barrel source. Iterates ALL
 * type-export blocks (global regex + matchAll) and unions their names, so a
 * second `export type { ... }` statement cannot escape the contract guard.
 */
function parseTypeExports(indexSource: string): string[] {
  const names: string[] = [];

  for (const match of indexSource.matchAll(/export\s+type\s*\{([^}]*)\}/g)) {
    for (const name of match[1].split(',').map((entry) => entry.trim())) {
      if (name.length > 0) {
        names.push(name);
      }
    }
  }

  return names;
}

/**
 * Extract the keys directly under `inputs:` in the consumer action.yml. A
 * deterministic line scan (no YAML dependency, ponytail): the block runs from the
 * `inputs:` line to the next top-level (zero-indent) key, and only exactly-two-space
 * indented keys count (deeper keys like `description:`/`required:` are ignored).
 */
function parseActionInputKeys(actionYaml: string): string[] {
  const lines = actionYaml.split('\n');
  const inputsIndex = lines.findIndex((line) => /^inputs:\s*$/.test(line));

  if (inputsIndex === -1) {
    return [];
  }

  const keys: string[] = [];

  for (let i = inputsIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === '' || line.trim().startsWith('#')) {
      continue;
    }

    if (/^\S/.test(line)) {
      break;
    }

    const keyMatch = /^ {2}([\w-]+):/.exec(line);

    if (keyMatch) {
      keys.push(keyMatch[1]);
    }
  }

  return keys;
}

describe('public consumer surface (DOCS-05)', () => {
  it('package value exports are exactly the enumerated set (D-04 group c)', () => {
    expect(Object.keys(barrel).sort()).toEqual(
      [...EXPECTED_VALUE_EXPORTS].sort(),
    );
  });

  it('package type exports are exactly the enumerated set (D-04 group c)', () => {
    const typeExports = parseTypeExports(readSource('./index.ts'));

    expect(typeExports.sort()).toEqual([...EXPECTED_TYPE_EXPORTS].sort());
  });

  it('consumer action inputs are exactly the enumerated set (D-04 group b)', () => {
    const inputs = parseActionInputKeys(
      readSource('../../../start-cache-server/action.yml'),
    );

    expect(inputs.sort()).toEqual([...EXPECTED_ACTION_INPUTS].sort());
  });

  it('the documented env-knob set is exactly the D-04 group-a contract list', () => {
    expect([...EXPECTED_ENV_KNOBS].sort()).toEqual([
      'CACHE_MIRROR_MAX_AGE_DAYS',
      'GH_TOKEN',
      'GITHUB_REPOSITORY',
      'GITHUB_TOKEN',
      'NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN',
      'NX_SELF_HOSTED_REMOTE_CACHE_SERVER',
      'PORT',
    ]);
  });

  it('MAX_CACHE_BODY_BYTES is a fixed 2 GiB contract limit, not a tunable env knob (open question 1)', () => {
    expect(MAX_CACHE_BODY_BYTES).toBe(EXPECTED_MAX_CACHE_BODY_BYTES);
    expect(EXPECTED_ENV_KNOBS).not.toContain('MAX_CACHE_BODY_BYTES');
  });
});

describe('documented env knobs stay wired in the package source (T-06-02-02)', () => {
  const knobSource = KNOB_SOURCE_FILES.map((path) => readSource(path)).join(
    '\n',
  );

  it.each(EXPECTED_ENV_KNOBS)(
    'env knob %s still appears in the package source (a rename that orphans it fails the guard)',
    (knob) => {
      expect(knobSource).toMatch(new RegExp(`\\b${knob}\\b`));
    },
  );
});
