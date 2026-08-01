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
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  collapseToOneLine,
  compareHashParity,
  DIVERGENT_TARGET,
  EXPECTED_TARGETS,
  INVARIANT_TARGETS,
  LIKE_FOR_LIKE_META_KEYS,
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
      command: 'node --no-warnings -p process.platform',
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
  // Still EXACT equality, not a partial match: the success shape is the thing under
  // test, so an extra field appearing here must be a reviewable diff. `records` is
  // asserted to be the pair that went IN -- the comparator narrows those two and
  // hands them back for `assert-parity.ts` to read, and returning anything else
  // (a copy, a reordering) would silently break the caller that indexes them.
  it('PASSES a genuinely-correct two-record pair, naming both platforms and returning what it validated', () => {
    const pair = validPair();

    const verdict = compareHashParity(pair);

    expect(verdict).toEqual({
      ok: true,
      platforms: [LINUX, WINDOWS],
      records: pair,
    });
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

  it('FAILS with not-like-for-like when the legs measured DIFFERENT things', () => {
    // The seven REQUIRED_META_KEYS used to be validated per record and then
    // dropped -- `meta.os` was the only one compared ACROSS the pair -- so a pair
    // with a different commit on each leg PASSED. Same wrong-blame class as
    // `duplicate-platform`, one field over: without this clause the skew reaches
    // clause (c) and reports `invariant-target-diverged`, which reads as an
    // OS-invariance regression when the real defect is a broken checkout pin or an
    // nx version skew. Driven from the exported list so a key added there cannot
    // arrive without a negative.
    for (const key of LIKE_FOR_LIKE_META_KEYS) {
      const [a, b] = validPair();
      b.meta[key] = `${a.meta[key]}-mutated`;

      const verdict = compareHashParity([a, b]);

      expect(reasonOf(verdict), key).toBe('not-like-for-like');
      expect(detailOf(verdict), key).toContain(key);
    }
  });

  it('PASSES a pair whose `nodeVersion` differs, because that field is measured INERT', () => {
    // THE OVER-REACH CONTROL for the clause above, and it is load-bearing rather
    // than decorative. The obvious "improvement" to that loop is to require all
    // seven REQUIRED_META_KEYS equal, which would reject the comparison
    // `08-ROOT-CAUSE.md` is built on: observation points 1 and 3 differ ONLY in
    // Node version (`.node-version` holds the moving `lts/krypton` alias, so the
    // runners resolved v24.18.0 against the workstation's v24.13.0) and their
    // hashes are byte-identical with ZERO differing nodes. This test goes red the
    // instant someone widens the list to cover a field the record proved inert.
    const [a, b] = validPair();
    b.meta.nodeVersion = 'v24.18.0';

    expect(reasonOf(compareHashParity([a, b]))).toBe('PASS');
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
    // The declared `{ "runtime": "node --no-warnings -p process.platform" }`
    // input (D-14) is the ONLY thing that should make this target OS-sensitive.
    // Two matching hashes mean either the input was deleted or it stopped
    // discriminating -- and CORR-03 is explicit that asserting nx.json CONTAINS
    // the input does not substitute for this, because that proves it is
    // DECLARED, not that it works.
    const [a, b] = validPair();
    b.targets[DIVERGENT_TARGET].hash = a.targets[DIVERGENT_TARGET].hash;

    expect(reasonOf(compareHashParity([a, b]))).toBe(
      'integration-not-divergent',
    );
  });
});

describe('the discriminator must have DISCRIMINATED on these two legs (D-20)', () => {
  // The record collects `discriminator.stdout` per leg and `shapeFault` requires it
  // present, on an ATTRIBUTION argument. Nothing compared it, so the comparator
  // PASSED the one pair that refutes its own premise: two legs whose discriminator
  // printed the same thing while `integration` diverged anyway. Clause (b) cannot
  // catch that -- the hashes DO differ -- and clause (c) cannot, because
  // `integration` is excluded from the invariant set by construction.
  it('FAILS when both legs printed the SAME value but `integration` still diverged', () => {
    const [a, b] = validPair();
    b.discriminator.stdout = a.discriminator.stdout;

    const verdict = compareHashParity([a, b]);

    expect(reasonOf(verdict)).toBe('discriminator-not-platform-sensitive');
    expect(detailOf(verdict)).toContain(DIVERGENT_TARGET);
  });

  // ORDERING CONTROL, and it is the reason this clause sits after clause (b) rather
  // than before it. Identical streams AND identical hashes is a discriminator that
  // is simply GONE, which is clause (b)'s named reason and the more useful blame. A
  // clause inserted one line earlier would silently steal it, and every assertion
  // above would still pass.
  it('leaves integration-not-divergent to clause (b) when the hashes ALSO match', () => {
    const [a, b] = validPair();
    b.discriminator.stdout = a.discriminator.stdout;
    b.targets[DIVERGENT_TARGET].hash = a.targets[DIVERGENT_TARGET].hash;

    expect(reasonOf(compareHashParity([a, b]))).toBe(
      'integration-not-divergent',
    );
  });

  // `stderr` is required PRESENT by shapeFault and deliberately never compared: it
  // is empty on every healthy leg, so requiring equality is vacuous and requiring
  // difference asserts that a healthy run writes to stderr. This pins that
  // asymmetry as a decision -- a differing stderr alone is not a verdict.
  it('does NOT fail a healthy pair whose `stderr` differs', () => {
    const [a, b] = validPair();
    b.discriminator.stderr = 'a warning only one leg emitted';

    expect(reasonOf(compareHashParity([a, b]))).toBe('PASS');
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

describe('a record cannot FORGE the success line through the failure detail', () => {
  // `ci.yml`'s compare step pipes BOTH streams of `assert-parity.js` into one log
  // and greps that log for the comparator's success prefix, presented there as a
  // SECOND, INDEPENDENT signal on top of the exit code. It is only independent if
  // the FAILURE path cannot print a line that grep matches -- and every `detail`
  // interpolates values the DOWNLOADED RECORD controls, so a record can try. Left
  // unfixed, the step stayed red only because `process.exitCode = 1` under
  // `pipefail` aborts before the grep runs, which is the exit-code-alone signal
  // D-23 calls insufficient on its own.
  //
  // THE ASSERTION IS PREFIX-AGNOSTIC ON PURPOSE: "the detail contains no line
  // break", never "the detail does not contain <prefix>". A prefix-matching
  // assertion is satisfiable by the wrong token, which is Phase 7's lesson, and
  // it would go stale the day the prefix is re-spelled. The payload below is only
  // the vehicle.
  //
  // WHAT EACH ASSERTION BELOW WAS OBSERVED RED FOR, per D-22, stated exactly
  // rather than as a tidier symmetry it does not have. The two code halves are
  // `fail`'s CR/LF collapse and `shapeFault`'s `JSON.stringify` on the key, and
  // they were mutated one at a time:
  //   - collapse disabled -> the `meta.os` vector goes RED (that value reaches
  //     the detail through no escape) and the target-KEY vector stays green.
  //   - quoting reverted -> both vectors stay green on the ONE-LINE assertion,
  //     because the collapse catches the key too. What the quoting uniquely buys
  //     is the DIAGNOSTIC, so the third test is the one that goes red, on
  //     `record 0: \`targets. hash-parity: PARITY OK\` is not an object` -- one
  //     line, and no longer naming which key.
  // So the ONE-LINE property is defended twice over for a target key and once for
  // `meta.os`, and the escaping is defended only by the third test. A reader
  // deleting that test is deleting the only cover the quoting has.
  //
  // THE THIRD HALF -- the `^` anchor on the grep, without which the payload still
  // matches as a MID-LINE substring of the failure line -- is pinned by the
  // `hash-parity-compare` describe at the foot of this file, NOT here. This block
  // used to say it was "not pinnable here at all", on the ground that `ci.yml` was
  // not a declared `test` input (PARITY-08, deferred to Phase 9) and a spec reading
  // it would serve a stale cached PASS. Both halves of that are now false:
  // `{workspaceRoot}/.github/workflows/ci.yml` IS a `test` input, and `compare.ts`'s
  // own header already carried the correction in prose while this spec still
  // asserted the impossibility. The reason it is a SEPARATE describe rather than a
  // clause here: this group's assertions are prefix-AGNOSTIC on purpose (above), and
  // the anchor pin is necessarily prefix-SPECIFIC, so folding them together would
  // undo the property the paragraph above is protecting.
  const PAYLOAD = '\nhash-parity: PARITY OK';

  const VECTORS: readonly (readonly [
    string,
    ParityFailureReason,
    (draft: Record<string, unknown>) => void,
  ])[] = [
    [
      'a target KEY carrying the payload',
      'malformed-record',
      (draft) => {
        draft['targets'] = { [PAYLOAD]: 'not-an-object' };
      },
    ],
    [
      '`meta.os` carrying the payload',
      'missing-target-hash',
      (draft) => {
        child(draft, 'meta')['os'] = PAYLOAD;
        delete child(draft, 'targets')['typecheck'];
      },
    ],
  ];

  for (const [label, reason, mutate] of VECTORS) {
    it(`reports ONE line, and the named reason, for ${label}`, () => {
      const [a, b] = validPair();
      mutate(asDraft(a));

      const verdict = compareHashParity([a, b]);

      expect(reasonOf(verdict)).toBe(reason);
      expect(detailOf(verdict)).not.toMatch(/[\r\n]/);
    });
  }

  it('still NAMES the offending target key, escaped rather than swallowed', () => {
    // Neutralising must not cost the diagnostic, or the fix trades a false green
    // for an unactionable red. The CR/LF collapse alone would render the payload
    // as a bare space and leave an operator guessing WHICH key; quoting it puts
    // the escaped bytes in the message.
    const [a, b] = validPair();
    asDraft(a)['targets'] = { [PAYLOAD]: 'not-an-object' };

    expect(detailOf(compareHashParity([a, b]))).toContain('\\n');
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

  it('LIKE_FOR_LIKE_META_KEYS is the THREE compared across the pair, and a SUBSET of the seven', () => {
    // Three, not seven. Which three is argued at the constant's own declaration;
    // pinning it here is what makes widening the list a reviewable diff rather
    // than a silent tightening that rejects a legitimate record. The subset
    // assertion is the second half: a key here that is NOT in
    // REQUIRED_META_KEYS is never validated as a non-empty string first, so the
    // comparison would run over two `undefined`s and find them equal -- a clause
    // that cannot fail.
    expect([...LIKE_FOR_LIKE_META_KEYS]).toEqual([
      'commit',
      'nxVersion',
      'arch',
    ]);
    expect([...REQUIRED_META_KEYS]).toEqual(
      expect.arrayContaining([...LIKE_FOR_LIKE_META_KEYS]),
    );
  });
});

/**
 * The OTHER end of the gate: `assert-parity.ts`'s success line and the `ci.yml`
 * expression that reads it, pinned against each other.
 *
 * WHY THIS IS NOT COVERED BY ANYTHING ABOVE. `assert-parity.ts` is, by its own
 * header, "the one part of the gate with no unit test standing behind it" -- the
 * bin is kept small enough to review by eye instead. That is a reasonable trade for
 * its file-reading and printing, but it left the ONE value in it that is a CONTRACT
 * with another file unguarded: `SUCCESS_PREFIX` has to match the `hash-parity-compare`
 * step's grep BYTE FOR BYTE, and nothing read either side.
 *
 * THE TWO FAILURES THIS CLOSES, both silent-green:
 *   1. Re-spell `SUCCESS_PREFIX` (or the grep) and the step's second signal can
 *      never match. Under `pipefail` the job then goes red only when the exit code
 *      already said so -- collapsing the deliberately-independent second signal into
 *      the exit-code-alone check D-23 calls insufficient, with nothing announcing the
 *      loss.
 *   2. Drop the `^` and the anchor half of the log-injection defence is gone, which
 *      `compare.ts`'s `fail` header calls load-bearing and explicitly says it does
 *      NOT own ("Neither half suffices alone").
 *
 * ONE ASSERTION COVERS BOTH because the prefix is read from `assert-parity.ts`'s own
 * source rather than re-authored here: the expression is built from that value, so a
 * re-spelling on either side and a deleted anchor all land as the same red.
 *
 * READ FROM SOURCE, not imported. Importing the bin to export its constant would put
 * a spec-only export on a module whose surface is deliberately empty, and this repo
 * gates on `fallow dead-code`. The source scan is the house pattern
 * (`cache-archive-path.spec.ts` scans its module's text for the same class of reason).
 *
 * PRECEDENT: the sibling `o3-witness` job's `grep -q '^o3-witness: EXISTENCE OK'` is
 * pinned exactly this way in `dogfood-cross-os.spec.ts`. This job was the only one of
 * the two left unguarded.
 */
describe('the hash-parity-compare gate agrees with the bin it runs (D-19, D-23)', () => {
  const workspaceRoot = new URL('../../../../', import.meta.url);
  const assertParitySource = readFileSync(
    new URL('assert-parity.ts', import.meta.url),
    'utf8',
  );
  const ciYml = readFileSync(
    new URL('.github/workflows/ci.yml', workspaceRoot),
    'utf8',
  );

  // The extraction is its own test, and it comes FIRST: every assertion below is
  // built from this value, so a regex that silently stopped matching would make the
  // rest of the group assert about `undefined` instead of about the gate.
  const successPrefix = /const SUCCESS_PREFIX = '([^']+)';/.exec(
    assertParitySource,
  )?.[1];

  it('states its success prefix as a single-quoted literal the gate can be built from', () => {
    expect(
      successPrefix,
      "assert-parity.ts must declare `const SUCCESS_PREFIX = '...';`. If the " +
        'declaration was legitimately reshaped, update this extraction in the SAME ' +
        'commit -- every assertion in this group is derived from it, so a failed ' +
        'extraction silently empties them rather than failing loud.',
    ).toBe('hash-parity: PARITY OK');
  });

  it('greps for that exact prefix, ANCHORED, so the failure path cannot satisfy the success signal', () => {
    expect(
      ciYml,
      "ci.yml's `hash-parity-compare` job must carry " +
        `\`grep -q '^${successPrefix}' hash-parity.log\`. The ^ is half of a ` +
        'two-half log-injection defence: compare.ts collapses CR/LF in every detail ' +
        'so injected text cannot START a line, and this anchor is what stops the same ' +
        'text matching as a MID-LINE substring of the failure line. Neither half ' +
        'suffices alone, and compare.ts explicitly does not own this one. Deleting ' +
        'the anchor, the grep, or re-spelling either side is silent: the step still ' +
        'goes red on a bad exit code, so the loss of the INDEPENDENT second signal ' +
        'shows up nowhere.',
    ).toContain(`grep -q '^${successPrefix}' hash-parity.log`);
  });

  // The THROW path, which is the one `fail()` never sees. Everything the
  // comparator REFUSES goes through compare.ts's collapse; everything the bin
  // THROWS -- and `readRecords` throws on record bytes, via `JSON.parse`, whose
  // message embeds the offending input verbatim including newlines -- reached
  // `console.error` raw. The line it lands on is the same one the anchored grep
  // above reads, so this is the same two-half defence with one half missing on
  // one path, not a separate concern.
  //
  // A SOURCE SCAN rather than a spawn, matching the extraction above: driving the
  // bin would need the built `dist/`, which this unit spec deliberately does not
  // depend on. It asserts the CALL, so re-authoring the regex inline here would
  // still fail -- which is the point, because a second authored copy is how the
  // single choke point stops being single.
  it('routes its throw path through the comparator collapse, not a raw error.message', () => {
    expect(
      assertParitySource,
      'assert-parity.ts must import `collapseToOneLine` from ./compare.js and wrap ' +
        'the caught error in it. compare.ts calls itself "THE SINGLE PLACE untrusted ' +
        'record content is neutralised"; a raw `error.message` on the catch makes that ' +
        'false for the one path that does not go through fail(), and leaves the ' +
        "success-prefix injection blocked only by V8's cap on the snippet it quotes " +
        'back -- a runtime detail, not a control.',
    ).toContain('import {\n  collapseToOneLine,');
    expect(assertParitySource).toContain(
      'collapseToOneLine(error instanceof Error ? error.message : String(error))',
    );
    expect(
      /console\.error\(\s*`hash-parity: PARITY FAILED -- \$\{error instanceof Error/.test(
        assertParitySource,
      ),
      'The unsanitised shape `${error instanceof Error ? ...}` must not be ' +
        'interpolated directly into the PARITY FAILED line.',
    ).toBe(false);
  });

  it('collapses CR/LF so injected record text cannot START a line (the half this module owns)', () => {
    expect(collapseToOneLine('a\nhash-parity: PARITY OK')).toBe(
      'a hash-parity: PARITY OK',
    );
    expect(collapseToOneLine('a\r\n\r\nb')).toBe('a b');
    expect(
      collapseToOneLine('nothing to collapse'),
      'A string with no line break must survive byte-for-byte, or the collapse is ' +
        'mangling authored detail rather than neutralising injected content.',
    ).toBe('nothing to collapse');
  });
});
