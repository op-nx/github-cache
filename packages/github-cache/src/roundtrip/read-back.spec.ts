import * as core from '@actions/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReleasesReadBackend } from '../backend/releases-backend.js';
import { dogfoodBody } from '../lib/dogfood-body.js';
import { CACHE_OS_VALUES } from '../lib/release-asset-name.js';
import { run } from './read-back.js';

// THIS BIN HAD NO SPEC BEFORE THIS PLAN, and that is the direct cause of the regression
// these tests close. read-back.ts carried a `//` comment asserting "producer and reader
// are the same OS by construction" directly above the byte comparison it justified.
// VER-01 (the workspace-relative path literal) and VER-03 (enableCrossOsArchive) made
// cross-OS restore WORK -- the phase's goal -- which falsified that premise, and nothing
// reddened. The failure was MEASURED live: run 30400231720, job
// `publish-verify (windows-11-arm)`, conclusion failure, on a windows leg that had
// mirrored the LINUX-produced payload under its own asset name.
//
// The spec drives the EXPORTED run() rather than an extracted helper. Both sibling bins
// in this package (cleanup/index.ts, action/index.ts) already export run() behind the
// same isEntrypoint(import.meta.url) guard and are driven by a co-located spec;
// isEntrypoint is what makes importing the module inert under vitest. read-back.ts was
// the only bin doing neither, which is exactly why its premise rotted unnoticed. No new
// module is warranted for one `.find()`.
//
// THE OS AXIS IS `it.each(CACHE_OS_VALUES)`, NOT "the OS that is not this one". Asserting
// acceptance for EVERY known producer makes the verdict machine-INDEPENDENT and needs no
// ambient platform read -- which LINT-02 bans in unit specs (eslint.config.mjs, the
// no-restricted-syntax ban object) for precisely the reason this gap exists: a
// machine-dependent expectation is how a cross-OS-shared entry becomes right on one
// matrix leg and wrong on another. The ban's own name for the banned members is left
// unspelled here so the readable `git grep` check agrees with the enforcing lint run.
//
// GROUP B IS THE NON-VACUITY CONTRACT, and it matters as much as Group A. This spec's
// purpose is as much to prove the byte assertion still BITES as to prove it accepts
// cross-OS bytes. Deleting the assertion, or weakening it to a presence / length /
// HIT-only check, would trade a RED job for a SILENTLY-GREEN one -- strictly worse than
// the bug being fixed. Group B pins the four classes that must keep failing: garbage
// bytes, a truncated (partial) upload, an asset for a different hash, and a cross-run
// asset-name collision.

vi.mock('@actions/core', () => ({ info: vi.fn(), setFailed: vi.fn() }));
// Mocking the whole backend module is what keeps this spec off the network: no client is
// constructed, so no token is resolved and no request is made (T-09-64). The read seam
// reduces to a single `get`, which is all ReadableBackend has (backend/types.ts).
vi.mock('../backend/releases-backend.js', () => ({
  createReleasesReadClient: vi.fn(),
  createReleasesReadBackend: vi.fn(),
}));

const createReleasesReadBackendMock = vi.mocked(createReleasesReadBackend);

// HAND-AUTHORED literals (the pinned-literal discipline, A1b). The hash is the REAL run
// id from the measured failure, so this spec and 09-EVIDENCE.md's addendum read as the
// same incident.
const HASH = '30400231720';
// A NEIGHBOURING run id -- one digit apart, SAME LENGTH. The same length is the whole
// point: it is the only different-hash fixture that reddens a length-only or prefix-only
// comparison.
const NEIGHBOUR_HASH = '30400231721';

const get = vi.fn();

// The repo's bin-spec harness (cleanup/index.spec.ts, action/index.spec.ts): a file-level
// env save plus a per-test copy. clearAllMocks (NOT resetAllMocks) -- reset would clear
// the `{ get }` implementation wired below and every rejection test would fail on a
// TypeError instead of on its merits.
const ORIGINAL_ENV = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  process.env.GITHUB_RUN_ID = HASH;
  createReleasesReadBackendMock.mockReturnValue({ get });
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('round-trip read-back producer provenance (09-08)', () => {
  it.each(CACHE_OS_VALUES)(
    'accepts a mirrored payload produced on %s and names that producer in the log',
    async (os) => {
      get.mockResolvedValue({ kind: 'hit', bytes: dogfoodBody(HASH, os) });

      await expect(run()).resolves.toBeUndefined();

      // The relaxation's honest half: the guard no longer JUDGES the producer, so it
      // must REPORT it. A cross-OS mirror has to be legible in the run log rather than
      // silently accepted (T-09-60).
      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining(`'${os}'-produced`),
      );
    },
  );
});

describe('round-trip read-back still fails loud on every corruption class (09-08)', () => {
  // The rejection substrings are PINNED to 'cache HIT for' / 'MISS' deliberately: both
  // are present in the pre-fix AND post-fix messages, so these clauses stay green across
  // the RED -> GREEN transition. That continuity is the evidence they were PRESERVED
  // rather than traded away. Never assert the full message, and never a phrase unique to
  // one side of the fix.
  it('fails loud on garbage bytes', async () => {
    get.mockResolvedValue({
      kind: 'hit',
      bytes: Buffer.from('not a dogfood payload at all'),
    });

    await expect(run()).rejects.toThrow('cache HIT for');
  });

  it('fails loud on a truncated payload (partial upload)', async () => {
    // Buffer.equals compares LENGTH FIRST, so a prefix of the right payload matches no
    // candidate. This is the partial-upload class.
    get.mockResolvedValue({
      kind: 'hit',
      bytes: dogfoodBody(HASH, 'linux').subarray(0, 12),
    });

    await expect(run()).rejects.toThrow('cache HIT for');
  });

  it('fails loud on a payload for a DIFFERENT hash (cross-run asset-name collision)', async () => {
    // dogfood-body.ts folds the hash INTO the bytes, so a well-formed payload for a
    // neighbouring run matches no candidate for THIS hash. Cross-RUN collision stays
    // caught; only the within-run cross-OS case is deliberately given up (OBS-05).
    get.mockResolvedValue({
      kind: 'hit',
      bytes: dogfoodBody(NEIGHBOUR_HASH, 'linux'),
    });

    await expect(run()).rejects.toThrow('cache HIT for');
  });

  it('fails loud on a cache MISS', async () => {
    get.mockResolvedValue({ kind: 'miss' });

    await expect(run()).rejects.toThrow('MISS');
  });
});

describe('round-trip read-back input guard (09-08)', () => {
  it('fails loud when GITHUB_RUN_ID is absent', async () => {
    delete process.env.GITHUB_RUN_ID;

    await expect(run()).rejects.toThrow('GITHUB_RUN_ID');
  });
});
