/**
 * The CORR-03 cross-OS hash-parity verdict (D-19, D-20, D-21, D-22, D-23).
 *
 * INVARIANT: across exactly two platform records captured at ONE commit,
 * `build`, `typecheck`, `test` and `lint` carry byte-identical Nx task hashes,
 * and `integration` -- only `integration` -- diverges.
 *
 * THE TEMPTING ALTERNATIVE, and why it is wrong: assert textually that `nx.json`
 * declares `{ "runtime": "node -p process.platform" }` on `integration`, and call
 * cross-OS divergence proven. CORR-03 and D-20 both rule that out. Such an
 * assertion proves the discriminator is DECLARED; it does not prove it
 * DISCRIMINATES, and it stays green on the day the input is declared and inert.
 * Clause (c) is what makes clause (b) mean anything: with every other input
 * demonstrably shared, the only surviving explanation for a divergent
 * `integration` is the declared discriminator.
 *
 * PINNED BY `compare.spec.ts`, every clause of which was OBSERVED red before this
 * file returned a correct verdict -- twice, per D-22: once at import time with no
 * implementation at all, and once against an implementation that returned success
 * unconditionally, which reddened all 23 negatives while leaving the positive
 * control and the four content pins green.
 *
 * WHY THIS LIVES UNDER `src/` RATHER THAN BESIDE `capture-hashes.mjs`: this is the
 * only location where it is typechecked and unit-testable. `typecheck` runs
 * `tsc --build` over the spec project, and a spec importing an untyped root
 * `.mjs` would not compile (D-19). Its build output is kept out of the published
 * tarball by `!dist/hash-parity` in the package `files`, and `pack-check.cjs`
 * asserts that exclusion -- an unasserted exclusion is how the other three would
 * have regressed (RESEARCH Pitfall 8).
 *
 * WHY IT DOES NOT SHARE THE INSTRUMENT'S NODE-PARTITION CODE: the instrument must
 * run immediately after `npm ci` with NO build step (the capture job has none, by
 * design), so it cannot import from `dist/`, and a typechecked module cannot
 * import an untyped root `.mjs`. The duplication that implies is deliberate and
 * bounded -- and in fact empty, because this module performs no set arithmetic
 * over the node maps at all. It only requires them to be non-empty, and hands the
 * partitioning back to `node capture-hashes.mjs --diff`.
 */

/**
 * The five targets the instrument measures, in its order (D-05). Content-pinned
 * in the spec: a drift from `capture-hashes.mjs`'s TARGETS makes this gate assert
 * about targets that were never measured, which surfaces as a missing hash rather
 * than as the spec bug it is.
 */
export const EXPECTED_TARGETS = [
  'build',
  'typecheck',
  'test',
  'integration',
  'lint',
] as const;

/**
 * The four that must be IDENTICAL across platforms. `lint` is the FOURTH clause
 * per D-21 and the roadmap's success criterion 6 -- Phase 7's D-35 handed it over
 * explicitly, and measuring it without asserting on it would waste that
 * measurement.
 */
export const INVARIANT_TARGETS = [
  'build',
  'typecheck',
  'test',
  'lint',
] as const;

/** The one target that must DIFFER, because it declares a platform runtime input. */
export const DIVERGENT_TARGET = 'integration';

/**
 * The seven D-04 `meta` fields required non-empty. The instrument emits ten more,
 * and requiring those would reject legitimate records: `githubSha` and `runnerOs`
 * are null off a runner by design, and `workingTreeClean` / `daemonEnabled` are
 * booleans. PARITY-06 asks for completeness of the fields that IDENTIFY the
 * measurement, not of the whole record.
 */
export const REQUIRED_META_KEYS = [
  'os',
  'arch',
  'nxVersion',
  'nodeVersion',
  'installMode',
  'graphState',
  'commit',
] as const;

/**
 * The subset of the instrument's record this module reads. Every field declared
 * here is validated by `shapeFault` before any value is read, so the narrowing
 * cast in `compareHashParity` is backed by a check rather than being an assertion
 * about the file. Fields the instrument also emits (`targets.<t>.command`,
 * `discriminator.command`, `discriminator.status`, `projectConfiguration`, the
 * remaining `meta` keys) are deliberately NOT modelled: declaring a field this
 * module neither checks nor uses would reintroduce exactly that assertion.
 */
export type HashParityRecord = {
  meta: Record<(typeof REQUIRED_META_KEYS)[number], string>;
  targets: Record<string, { hash: string; nodes: Record<string, string> }>;
  discriminator: { stdout: string; stderr: string };
};

/**
 * Why the pair was refused. Named per clause so a red gate reports its cause
 * rather than an opaque failure (the `SyncUntrustedReason` shape in
 * `lib/sync-gate.ts:55-56`).
 */
export type ParityFailureReason =
  | 'wrong-record-count'
  | 'malformed-record'
  | 'duplicate-platform'
  | 'missing-target-hash'
  | 'integration-not-divergent'
  | 'invariant-target-diverged';

/** Discriminated verdict: parity holds between the two named platforms, or it does not, WITH the reason. */
export type ParityVerdict =
  | { readonly ok: true; readonly platforms: readonly [string, string] }
  | {
      readonly ok: false;
      readonly reason: ParityFailureReason;
      readonly detail: string;
    };

/** A non-null, non-array object -- what every map in the record must be. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Narrow ONE untrusted record, returning the first offending path or `undefined`.
 *
 * The records are JSON downloaded from a CI artifact, so they are untrusted input
 * crossing a job boundary: truncated, empty, or shaped differently than declared.
 * `nx-target-inputs.spec.ts:243-255` states the rule this reuses -- a type on a
 * value parsed from disk is an ASSERTION about the file, not a check of it, so
 * indexing it without narrowing produces `TypeError: Cannot read properties of
 * undefined`, a crash where a comprehensible assertion failure belongs. Both are
 * red; only one names the cause, and the security domain reads the crash as
 * denial-of-service plus blame misdirection (T-08-06).
 */
function shapeFault(record: unknown): string | undefined {
  if (!isPlainObject(record)) {
    return 'the record is not an object';
  }

  const meta = record['meta'];

  if (!isPlainObject(meta)) {
    return '`meta` is missing or not an object';
  }

  for (const key of REQUIRED_META_KEYS) {
    const value = meta[key];

    if (typeof value !== 'string' || value === '') {
      return `\`meta.${key}\` is missing, empty, or not a string`;
    }
  }

  const targets = record['targets'];

  if (!isPlainObject(targets)) {
    return '`targets` is missing or not an object';
  }

  for (const [name, entry] of Object.entries(targets)) {
    // Iterating the ARRIVING keys is correct HERE and wrong in clause (a): this
    // loop type-checks whatever turned up, while COMPLETENESS is decided against
    // EXPECTED_TARGETS below. Reading this loop as the Pitfall 4 violation is the
    // easy misread; the vacuity control in the spec is what tells them apart.
    if (!isPlainObject(entry)) {
      return `\`targets.${name}\` is not an object`;
    }

    if (typeof entry['hash'] !== 'string') {
      return `\`targets.${name}.hash\` is missing or not a string`;
    }

    if (!isPlainObject(entry['nodes'])) {
      return `\`targets.${name}.nodes\` is missing or not an object`;
    }
  }

  const discriminator = record['discriminator'];

  if (!isPlainObject(discriminator)) {
    return '`discriminator` is missing or not an object';
  }

  for (const stream of ['stdout', 'stderr'] as const) {
    // Checks the TYPE, never the length: `stderr` is legitimately EMPTY on every
    // healthy leg. Both streams are required present because Nx's `hash_runtime`
    // hashes both, so a record missing one cannot explain why `integration`
    // diverged (D-04, PARITY-06).
    if (typeof discriminator[stream] !== 'string') {
      return `\`discriminator.${stream}\` is missing or not a string`;
    }
  }

  return undefined;
}

/** CORR-03(a) for ONE target on ONE record: present, non-empty, and attributable. */
function targetFault(
  record: HashParityRecord,
  target: string,
): string | undefined {
  const entry = record.targets[target];

  if (entry === undefined) {
    return `no \`targets.${target}\` entry at all`;
  }

  if (entry.hash === '') {
    return `\`targets.${target}.hash\` is an empty string`;
  }

  if (Object.keys(entry.nodes).length === 0) {
    return (
      `\`targets.${target}.nodes\` is empty, so the hash cannot be attributed ` +
      'to any input and PARITY-01 node-by-node localisation is unreachable'
    );
  }

  return undefined;
}

/**
 * The gate's verdict over the two downloaded platform records.
 *
 * The parameter is `readonly unknown[]` on purpose -- see `shapeFault`. The guard
 * chain is ordered, and the order is load-bearing: clause (c) must not run before
 * clause (a), or a MISSING target reads as an identical one.
 */
export function compareHashParity(records: readonly unknown[]): ParityVerdict {
  if (records.length !== 2) {
    return {
      ok: false,
      reason: 'wrong-record-count',
      detail:
        `expected exactly 2 platform records, one per matrix leg, but got ${records.length}. ` +
        'Suspect a leg that failed before its upload step, an upload whose ' +
        '`if-no-files-found` defaulted to `warn` and so produced no artifact at all, ' +
        'or a download pattern that matched nothing. The compare job runs ' +
        '`if: always()` (D-17) precisely so a missing leg arrives here as a FAILURE ' +
        'instead of vanishing as a skipped job.',
    };
  }

  for (const [index, record] of records.entries()) {
    const fault = shapeFault(record);

    if (fault !== undefined) {
      return {
        ok: false,
        reason: 'malformed-record',
        detail: `record ${index}: ${fault}`,
      };
    }
  }

  // Backed by the loop above: every field HashParityRecord declares was just
  // validated, so this narrows rather than asserts.
  const [a, b] = records as readonly [HashParityRecord, HashParityRecord];

  if (a.meta.os === b.meta.os) {
    return {
      ok: false,
      reason: 'duplicate-platform',
      detail:
        `both records report \`meta.os\` = \`${a.meta.os}\`, so this is not a ` +
        'cross-OS comparison. Without this clause the pair would fail CORR-03(b) ' +
        'instead, which reads as a discriminator defect when the real defect is a ' +
        'matrix leg that ran twice on the same runner image.',
    };
  }

  // CORR-03(a). Iterate the EXPECTED list, NEVER `Object.keys(record.targets)`
  // (RESEARCH Pitfall 4): a comparator driven by the arriving keys passes every
  // later clause trivially on an empty map. The spec's vacuity control fails the
  // instant this loop stops being driven from EXPECTED_TARGETS.
  for (const target of EXPECTED_TARGETS) {
    for (const record of [a, b]) {
      const fault = targetFault(record, target);

      if (fault !== undefined) {
        return {
          ok: false,
          reason: 'missing-target-hash',
          detail: `${record.meta.os}: ${fault}`,
        };
      }
    }
  }

  // CORR-03(b).
  if (a.targets[DIVERGENT_TARGET].hash === b.targets[DIVERGENT_TARGET].hash) {
    return {
      ok: false,
      reason: 'integration-not-divergent',
      detail:
        `\`${DIVERGENT_TARGET}\` computed the SAME hash ` +
        `${a.targets[DIVERGENT_TARGET].hash} on ${a.meta.os} and ${b.meta.os}, ` +
        'so the one declared platform discriminator is no longer discriminating. ' +
        'Suspect a deleted or re-spelled `{ "runtime": ... }` input on ' +
        '`targetDefaults.integration` (D-14 requires that string byte-identical).',
    };
  }

  // CORR-03(c), plus D-21's fourth clause.
  for (const target of INVARIANT_TARGETS) {
    const left = a.targets[target].hash;
    const right = b.targets[target].hash;

    if (left !== right) {
      return {
        ok: false,
        reason: 'invariant-target-diverged',
        detail:
          `\`${target}\` must be IDENTICAL across platforms but diverged: ` +
          `${a.meta.os}=${left} vs ${b.meta.os}=${right}. Localise it with ` +
          '`node capture-hashes.mjs --diff <recordA.json> <recordB.json>`, which ' +
          'partitions the two node maps into only-in-A / only-in-B / value-changed ' +
          'and diffs the merged project configuration field by field.',
      };
    }
  }

  return { ok: true, platforms: [a.meta.os, b.meta.os] };
}
