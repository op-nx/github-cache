/**
 * CORR-03 / D-20 / D-21 / D-22: the comparator's clause-by-clause RED.
 *
 * D-22 is explicit that a passing gate is NOT evidence until its RED has been
 * observed, and Phase 7 recorded TWO distinct instances of a guard that passed
 * for the wrong reason -- a prescribed non-vacuity filter that was itself vacuous
 * (`nx-target-inputs.spec.ts:123-134`) and a lexical guard satisfied by the wrong
 * token. So every negative below mutates exactly ONE field of a pair that
 * otherwise PASSES, which is what makes each one isolate a single clause rather
 * than co-firing with its neighbours.
 *
 * The named vacuity control is the empty-`targets` case. Read its comment before
 * editing anything in the missing-target-hash group: it is the one test that
 * fails a comparator which compared nothing.
 *
 * Explicit assertion lists only -- the house rule at `public-surface.spec.ts:18-23`:
 * an intentional change must land as a reviewable diff, not a rubber-stampable
 * `.snap` regen. The name of the snapshot matcher this file must never call is
 * deliberately not written down anywhere in it, so a source scan for that name
 * finds nothing. 08-01 recorded the inverse defect: a comment asserting a token
 * is absent IS an occurrence of the token, and a check satisfiable by prose is
 * Phase 7's wrong-token lesson recurring.
 */
import { describe, expect, it } from 'vitest';
import {
  compareHashParity,
  DIVERGENT_TARGET,
  EXPECTED_TARGETS,
  INVARIANT_TARGETS,
  REQUIRED_META_KEYS,
} from './compare.js';
import type {
  HashParityRecord,
  ParityFailureReason,
  ParityVerdict,
} from './compare.js';

// Two platform names as LITERALS. They are fixture data, never a read of the
// running machine -- deriving either from process.platform would make this spec's
// verdict machine-dependent, which is the exact defect CORR-06's ban exists for.
const LINUX = 'linux';
const WINDOWS = 'win32';

/**
 * The hashes both legs agree on. Real values, copied from a capture at
 * `f9b993e`, so a reader can see the shape an Nx task hash actually has (a
 * decimal u64 string, not hex). `integration` is supplied per leg instead.
 */
const SHARED_HASHES: Readonly<Record<string, string>> = {
  build: '15091651677672778193',
  typecheck: '2416283064013654168',
  test: '17043910507556371878',
  lint: '9911735553963459641',
};

/**
 * One leg of the pair, built from EXPECTED_TARGETS so a fixture can never be
 * short a target the comparator asserts on.
 *
 * It deliberately carries the fields `HashParityRecord` does NOT model --
 * `targets.<t>.command`, `discriminator.command`, `discriminator.status`,
 * `meta.githubSha`, `meta.runnerOs`, `projectConfiguration`. The real record has
 * all of them, so every test here doubles as proof that the comparator TOLERATES
 * the parts of the record it does not check. That is what the single cast below
 * buys, and it is the only cast in this file.
 */
function leg(os: string, integrationHash: string): HashParityRecord {
  const targets: Record<string, unknown> = {};

  for (const target of EXPECTED_TARGETS) {
    targets[target] = {
      hash:
        target === DIVERGENT_TARGET
          ? integrationHash
          : (SHARED_HASHES[target] ?? ''),
      command: `command-hash-${target}`,
      nodes: {
        '@op-nx/github-cache:ProjectConfiguration': `node-hash-${target}`,
        'npm:typescript': '5715016401231215040',
      },
    };
  }

  return {
    meta: {
      os,
      arch: 'arm64',
      nxVersion: '23.1.0',
      nodeVersion: 'v24.13.0',
      installMode: 'ci',
      graphState: 'cold',
      commit: 'f9b993e47c395a5da8bd48f2a182f8349016a7fd',
      githubSha: null,
      runnerOs: null,
    },
    targets,
    discriminator: {
      command: 'node -p process.platform',
      stdout: `${os}\n`,
      stderr: '',
      status: 0,
    },
    projectConfiguration: { root: 'packages/github-cache' },
  } as unknown as HashParityRecord;
}

/**
 * A pair that PASSES every clause: two distinct platforms, identical hashes on
 * all four INVARIANT_TARGETS, and a genuinely divergent `integration`. Every
 * negative below starts here and changes exactly one thing (the
 * `sync-gate.spec.ts:35-45` single-override idiom).
 */
function validPair(): [HashParityRecord, HashParityRecord] {
  return [
    leg(LINUX, 'integration-hash-on-linux'),
    leg(WINDOWS, 'integration-hash-on-win32'),
  ];
}

function reasonOf(verdict: ParityVerdict): ParityFailureReason | 'PASS' {
  return verdict.ok ? 'PASS' : verdict.reason;
}

function detailOf(verdict: ParityVerdict): string {
  return verdict.ok ? '' : verdict.detail;
}

/** A record as a downloaded artifact can really arrive: any shape at all. */
function asDraft(record: HashParityRecord): Record<string, unknown> {
  return record as unknown as Record<string, unknown>;
}

function child(
  draft: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  return draft[key] as Record<string, unknown>;
}

describe('compareHashParity -- the positive control (CORR-03)', () => {
  it('PASSES a genuinely-correct two-record pair and names both platforms', () => {
    const verdict = compareHashParity(validPair());

    expect(verdict).toEqual({ ok: true, platforms: [LINUX, WINDOWS] });
  });
});

describe('CORR-03(a): exactly two platform records (D-20)', () => {
  // Zero is the "download pattern matched nothing" case, one is the "a leg
  // failed before upload" case, three is a merge-multiple collision. All three
  // are the SAME defect from the reader's point of view: the comparison did not
  // have two legs to compare, and the compare job's `if:` expression (D-17) is
  // what makes them reachable here at all instead of arriving as a skipped job.
  //
  // That expression is `!cancelled()`, NOT the `always()` D-17 names -- see the
  // job's rationale block in ci.yml for why the narrower form was chosen. The
  // one-record case has been observed on a REAL runner (run 30357290164, with the
  // windows leg at conclusion `failure`), so the reachability is measured rather
  // than assumed. Naming the wrong expression here would send whoever debugs a red
  // gate looking for a string the workflow does not contain.
  for (const count of [0, 1, 3]) {
    it(`FAILS with wrong-record-count for ${count} record(s)`, () => {
      const [a, b] = validPair();
      const records = [a, b, leg('darwin', 'integration-hash-on-darwin')].slice(
        0,
        count,
      );

      expect(reasonOf(compareHashParity(records))).toBe('wrong-record-count');
    });
  }

  it('names the three suspects rather than only reporting the count', () => {
    // D-23 and `read-back.ts:50-57`: reporting the count alone puts the reader
    // one job further from the cause than necessary.
    const detail = detailOf(compareHashParity([]));

    expect(detail).toContain('if-no-files-found');
    expect(detail).toContain('upload');
    expect(detail).toContain('download');
  });

  it('FAILS with duplicate-platform when both records carry the same meta.os', () => {
    // Without this clause two ubuntu records would fail CORR-03(b) instead --
    // a reason that reads as a DISCRIMINATOR defect when the real defect is a
    // matrix leg that ran twice on the same OS.
    const [a] = validPair();
    const b = leg(LINUX, 'integration-hash-on-linux-again');

    expect(reasonOf(compareHashParity([a, b]))).toBe('duplicate-platform');
  });

  it('FAILS clause (a) on an EMPTY targets map -- the named vacuity control (D-22)', () => {
    // THE control, and it is the chosen one for a specific reason. A comparator
    // that iterated `Object.keys(record.targets)` instead of EXPECTED_TARGETS
    // (RESEARCH Pitfall 4) would pass clauses (b), (c) and (d) TRIVIALLY on an
    // empty map -- there is no target left to find divergent, none left to find
    // different, and none left to find missing. Every positive assertion in this
    // file would then pass together on a comparator that compared nothing, which
    // is precisely the vacuity Phase 7 recorded twice. This test is false the
    // instant clause (a) stops iterating the EXPECTED list.
    const [a, b] = validPair();
    a.targets = {};

    expect(reasonOf(compareHashParity([a, b]))).toBe('missing-target-hash');
  });

  it('FAILS with missing-target-hash, naming the target, when one target entry is absent', () => {
    const [a, b] = validPair();
    delete a.targets['typecheck'];

    const verdict = compareHashParity([a, b]);

    expect(reasonOf(verdict)).toBe('missing-target-hash');
    expect(detailOf(verdict)).toContain('typecheck');
  });

  it('FAILS with missing-target-hash, naming the target, on an EMPTY hash string', () => {
    const [a, b] = validPair();
    a.targets['lint'].hash = '';

    const verdict = compareHashParity([a, b]);

    expect(reasonOf(verdict)).toBe('missing-target-hash');
    expect(detailOf(verdict)).toContain('lint');
  });

  it('FAILS with missing-target-hash on an EMPTY nodes map (PARITY-02)', () => {
    // This is what makes the per-node map load-bearing rather than decorative:
    // a record whose `details.nodes` is empty carries a hash nobody can
    // attribute to an input, so `capture-hashes.mjs --diff` has nothing to
    // partition and PARITY-01's node-by-node naming is unreachable.
    const [a, b] = validPair();
    b.targets['build'].nodes = {};

    const verdict = compareHashParity([a, b]);

    expect(reasonOf(verdict)).toBe('missing-target-hash');
    expect(detailOf(verdict)).toContain('build');
  });
});

describe('CORR-03(b): integration DIFFERS between the legs (D-20)', () => {
  it('FAILS with integration-not-divergent when the two integration hashes MATCH', () => {
    // The declared `{ "runtime": "node -p process.platform" }` input (D-14) is
    // the ONLY thing that should make this target OS-sensitive. Two matching
    // hashes mean either the input was deleted or it stopped discriminating --
    // and CORR-03 is explicit that asserting nx.json CONTAINS the input does not
    // substitute for this, because that proves it is DECLARED, not that it works.
    const [a, b] = validPair();
    b.targets[DIVERGENT_TARGET].hash = a.targets[DIVERGENT_TARGET].hash;

    expect(reasonOf(compareHashParity([a, b]))).toBe(
      'integration-not-divergent',
    );
  });
});

describe('CORR-03(c) + D-21: the four INVARIANT targets are IDENTICAL', () => {
  // `lint` is the FOURTH clause per D-21 and the roadmap's success criterion 6.
  // NAMED FALLBACK, recorded so a later reader can tell a downgrade from a
  // deletion: if `lint` does diverge cross-OS and the fix proves out of Phase 8's
  // scope, its clause is downgraded to a recorded-with-a-named-finding test --
  // never deleted, because a deleted clause is indistinguishable from a clause
  // that never existed.
  for (const target of INVARIANT_TARGETS) {
    it(`FAILS with invariant-target-diverged when \`${target}\` differs`, () => {
      const [a, b] = validPair();
      b.targets[target].hash = `${a.targets[target].hash}-mutated`;

      const verdict = compareHashParity([a, b]);

      expect(reasonOf(verdict)).toBe('invariant-target-diverged');
      expect(detailOf(verdict)).toContain(target);
    });
  }

  it('names both platforms, both hashes and the --diff invocation that localises it', () => {
    // A red gate that only says "build diverged" is a mystery; one that hands
    // over the command partitioning the node maps is a starting point.
    const [a, b] = validPair();
    b.targets['build'].hash = 'a-different-build-hash';

    const detail = detailOf(compareHashParity([a, b]));

    expect(detail).toContain(LINUX);
    expect(detail).toContain(WINDOWS);
    expect(detail).toContain(SHARED_HASHES['build']);
    expect(detail).toContain('a-different-build-hash');
    expect(detail).toContain('capture-hashes.mjs --diff');
  });
});

describe('a malformed downloaded record is a VERDICT, never a TypeError (ASVS V5)', () => {
  // The records are JSON downloaded from a CI artifact, so they are untrusted:
  // truncated, empty, or shaped differently than declared. `nx-target-inputs
  // .spec.ts:243-255` states the rule this reuses -- a type on a value parsed
  // from disk is an ASSERTION about the file, not a check of it. A crash is
  // where a comprehensible assertion failure belongs, and the security domain
  // reads an unhandled TypeError here as denial-of-service plus blame
  // misdirection (T-08-06).
  const MUTATIONS: readonly (readonly [
    string,
    (draft: Record<string, unknown>) => void,
  ])[] = [
    [
      '`meta` is missing entirely',
      (draft) => {
        delete draft['meta'];
      },
    ],
    [
      '`meta.installMode` is missing',
      (draft) => {
        delete child(draft, 'meta')['installMode'];
      },
    ],
    [
      '`meta.graphState` is an empty string',
      (draft) => {
        child(draft, 'meta')['graphState'] = '';
      },
    ],
    [
      '`targets` is not an object',
      (draft) => {
        draft['targets'] = 'build,typecheck,test';
      },
    ],
    [
      'a target `hash` is not a string',
      (draft) => {
        child(child(draft, 'targets'), 'build')['hash'] = 42;
      },
    ],
    [
      '`discriminator.stderr` is missing',
      (draft) => {
        delete child(draft, 'discriminator')['stderr'];
      },
    ],
  ];

  for (const [label, mutate] of MUTATIONS) {
    it(`FAILS with malformed-record, without throwing, when ${label}`, () => {
      const [a, b] = validPair();
      mutate(asDraft(a));

      expect(() => compareHashParity([a, b])).not.toThrow();
      expect(reasonOf(compareHashParity([a, b]))).toBe('malformed-record');
    });
  }

  it('names the record index and the offending path', () => {
    const [a, b] = validPair();
    delete child(asDraft(b), 'meta')['nxVersion'];

    const detail = detailOf(compareHashParity([a, b]));

    expect(detail).toContain('record 1');
    expect(detail).toContain('nxVersion');
  });

  it('FAILS a record that is not an object at all', () => {
    const [, b] = validPair();

    expect(reasonOf(compareHashParity([null, b]))).toBe('malformed-record');
  });
});

describe('the comparator constants are content-pinned, never snapshotted', () => {
  // Explicit deep-equality, the `sync-gate.spec.ts:208-217` pin. EXPECTED_TARGETS
  // must stay in lockstep with `capture-hashes.mjs`'s TARGETS: a drift here makes
  // the gate assert about targets that were never measured, which reads as a
  // missing hash rather than as a spec bug.
  it('EXPECTED_TARGETS deep-equals the instrument five-target list (D-05)', () => {
    expect([...EXPECTED_TARGETS]).toEqual([
      'build',
      'typecheck',
      'test',
      'integration',
      'lint',
    ]);
  });

  it('INVARIANT_TARGETS deep-equals the four that must be IDENTICAL (D-20, D-21)', () => {
    expect([...INVARIANT_TARGETS]).toEqual([
      'build',
      'typecheck',
      'test',
      'lint',
    ]);
  });

  it('partitions EXPECTED_TARGETS exactly: INVARIANT + the one DIVERGENT (CORR-04)', () => {
    // The partition is the whole claim. A target in NEITHER list is measured and
    // then silently unasserted, which is a gate with a hole in it; a target in
    // BOTH is a contradiction the comparator would resolve by whichever clause
    // ran first.
    expect([...INVARIANT_TARGETS, DIVERGENT_TARGET].sort()).toEqual(
      [...EXPECTED_TARGETS].sort(),
    );
    expect(INVARIANT_TARGETS).not.toContain(DIVERGENT_TARGET);
  });

  it('REQUIRED_META_KEYS deep-equals the seven D-04 fields', () => {
    // Seven, not seventeen. The instrument emits `githubSha` and `runnerOs` as
    // null off a runner, so requiring every emitted key would fail a legitimate
    // local capture -- PARITY-06 asks for completeness of the fields that
    // identify the measurement, not of the whole record.
    expect([...REQUIRED_META_KEYS]).toEqual([
      'os',
      'arch',
      'nxVersion',
      'nodeVersion',
      'installMode',
      'graphState',
      'commit',
    ]);
  });
});
