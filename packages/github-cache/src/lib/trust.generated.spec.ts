import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { HOST_GATED_EVENTS, TRUSTED_EVENTS, isWriteTrusted } from './trust.js';

/**
 * TRUST-04 semantic-parity guard (the load-bearing behavioral check; the CI
 * selfcheck.cjs byte-diff is the cheap "no hand edits" tripwire). A GitHub JS
 * action runs the committed dependency-free CommonJS copy BEFORE `npm ci`, so
 * its write-start gate must reproduce the server's `isWriteTrusted` verdict
 * exactly. Any host-logic or allowlist divergence between trust.ts and the
 * generated .cjs is a silent, security-relevant drift -- this asserts identical
 * verdicts across the full env matrix plus deep-equal allowlist arrays.
 *
 * The committed .cjs is require()d through createRequire (a real Node require of
 * a CommonJS module, bypassing the ESM/vite graph) so this spec exercises the
 * exact artifact a consumer action executes. Path via import.meta.url (the
 * pinned-deps.spec.ts idiom), never __dirname / process.cwd().
 */
const requireCjs = createRequire(import.meta.url);

const generated = requireCjs('../action/trust.generated.cjs') as {
  isWriteTrusted: (env: NodeJS.ProcessEnv) => boolean;
  TRUSTED_EVENTS: readonly string[];
  HOST_GATED_EVENTS: readonly string[];
};

// The full env matrix (undefined = the key is left unset on the env bag).
const ACTIONS_VALUES = ['true', 'false', undefined] as const;

const EVENT_VALUES = [
  'push',
  'schedule',
  'pull_request',
  'release',
  'pull_request_target',
  'workflow_run',
  'unknown',
  undefined,
] as const;

const SERVER_URL_VALUES = [
  'https://github.com',
  'https://octocorp.ghe.com',
  'https://ghes.example.com',
  'https://github.com.attacker.com',
  '',
  undefined,
] as const;

function buildEnv(
  actions: string | undefined,
  event: string | undefined,
  serverUrl: string | undefined,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};

  if (actions !== undefined) {
    env.GITHUB_ACTIONS = actions;
  }

  if (event !== undefined) {
    env.GITHUB_EVENT_NAME = event;
  }

  if (serverUrl !== undefined) {
    env.GITHUB_SERVER_URL = serverUrl;
  }

  return env;
}

describe('trust.generated.cjs semantic parity with trust.ts (TRUST-04)', () => {
  for (const actions of ACTIONS_VALUES) {
    for (const event of EVENT_VALUES) {
      for (const serverUrl of SERVER_URL_VALUES) {
        const env = buildEnv(actions, event, serverUrl);
        const label = JSON.stringify(env);

        it(`.cjs isWriteTrusted matches trust.ts for ${label}`, () => {
          expect(generated.isWriteTrusted(env)).toBe(isWriteTrusted(env));
        });
      }
    }
  }

  // Non-vacuous guard: the matrix must exercise BOTH verdicts, so parity is not
  // trivially satisfied by every combination denying (a broken .cjs that always
  // returns false would otherwise pass the parity loop against a broken source).
  it('the env matrix exercises both trusted and untrusted verdicts (non-vacuous)', () => {
    const verdicts = new Set<boolean>();

    for (const actions of ACTIONS_VALUES) {
      for (const event of EVENT_VALUES) {
        for (const serverUrl of SERVER_URL_VALUES) {
          verdicts.add(isWriteTrusted(buildEnv(actions, event, serverUrl)));
        }
      }
    }

    expect(verdicts).toEqual(new Set([true, false]));
  });
});

describe('trust.generated.cjs allowlist arrays deep-equal trust.ts (TRUST-04)', () => {
  it('TRUSTED_EVENTS deep-equals the trust.ts base allowlist', () => {
    expect([...generated.TRUSTED_EVENTS]).toEqual([...TRUSTED_EVENTS]);
  });

  it('HOST_GATED_EVENTS deep-equals the trust.ts host-gated allowlist', () => {
    expect([...generated.HOST_GATED_EVENTS]).toEqual([...HOST_GATED_EVENTS]);
  });
});
