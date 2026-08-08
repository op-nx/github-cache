/**
 * The CORR-03 cross-OS hash-parity verdict (D-19, D-20, D-21, D-22, D-23).
 *
 * INVARIANT: across exactly two platform records captured at ONE commit,
 * `build`, `typecheck`, `test` and `lint` carry byte-identical Nx task hashes,
 * and `integration` -- only `integration` -- diverges.
 *
 * THE TEMPTING ALTERNATIVE, and why it is wrong: assert textually that `nx.json`
 * declares `{ "runtime": "node --no-warnings -p process.platform" }` on
 * `integration`, and call cross-OS divergence proven. CORR-03 and D-20 both rule
 * that out. Such an assertion proves the discriminator is DECLARED; it does not
 * prove it DISCRIMINATES, and it stays green on the day the input is declared
 * and inert.
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
 * A target this module has established is PRESENT on both records. `targetFault`'s
 * presence loop below is driven from EXPECTED_TARGETS and from nothing else, so a
 * name outside that tuple is one nothing checked for.
 *
 * The two constants below are `satisfies`-bound to it, which is the difference
 * between a compile error and a crash. Clauses (b) and (c) index `a.targets[...]`
 * directly on the strength of that loop having run; with `noUncheckedIndexedAccess`
 * off, a fifth invariant target added HERE but not to EXPECTED_TARGETS type-checks
 * clean, skips the presence check, and throws `TypeError: Cannot read properties of
 * undefined` -- a crash where `shapeFault`'s own doc block requires a named reason,
 * and one the security domain reads as denial-of-service plus blame misdirection.
 *
 * `compare.spec.ts` already catches this at RUN time; the bind moves it to `tsc`,
 * where the author of the fifth target is standing. The sibling `meta` field gets
 * this for free -- `HashParityRecord.meta` is keyed on REQUIRED_META_KEYS, so
 * LIKE_FOR_LIKE_META_KEYS is STRUCTURALLY a subset -- while `targets` is a
 * `Record<string, ...>` and can enforce nothing. This closes that asymmetry.
 */
type ExpectedTarget = (typeof EXPECTED_TARGETS)[number];

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
] as const satisfies readonly ExpectedTarget[];

/** The one target that must DIFFER, because it declares a platform runtime input. */
export const DIVERGENT_TARGET = 'integration' satisfies ExpectedTarget;

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
  | 'not-like-for-like'
  | 'missing-target-hash'
  | 'integration-not-divergent'
  | 'discriminator-not-platform-sensitive'
  | 'invariant-target-diverged';

/**
 * The `meta` fields required EQUAL across the two legs, as opposed to merely
 * present on each. They identify WHAT was measured -- which tree, which hasher,
 * which architecture -- so a mismatch means the two hashes are not comparable and
 * every later clause would report the wrong defect.
 *
 * THE OTHER FOUR REQUIRED_META_KEYS ARE DELIBERATELY ABSENT, and the asymmetry is
 * recorded here so it reads as a decision rather than as the same oversight one
 * field over:
 *
 * - `os` is compared, but to prove the legs DIFFER (`duplicate-platform`). These
 *   three are compared to prove they AGREE, which is why it is not in this list.
 * - `nodeVersion` must NOT be required equal. `08-ROOT-CAUSE.md` measured it
 *   INERT: observation points 1 and 3 differ ONLY in Node version -- v24.13.0
 *   against v24.18.0, because `.node-version` holds the moving `lts/krypton`
 *   alias -- and their `build`, `test`, `integration` and `lint` hashes are
 *   byte-identical with ZERO differing nodes. It reaches no hashed node, so
 *   requiring it would reject the workstation-against-runner comparison the whole
 *   record is built on.
 * - `installMode` and `graphState` are D-09 admissibility conditions, and both CI
 *   legs agree on both BY CONSTRUCTION (one matrix job, one list of steps). They
 *   stay recorded-and-unenforced so the record's deliberate CROSS-state readings
 *   stay expressible -- the warm-Windows against cold-Linux masquerade PARITY-04
 *   exists to name. `capture-hashes.mjs --diff` is the tool for those; this gate
 *   asserts the invariant.
 */
export const LIKE_FOR_LIKE_META_KEYS = ['commit', 'nxVersion', 'arch'] as const;

/**
 * Discriminated verdict: parity holds between the two named platforms, or it does
 * not, WITH the reason.
 *
 * THE SUCCESS VARIANT CARRIES THE RECORDS IT VALIDATED, and that is load-bearing
 * rather than convenience. `compareHashParity` is the only thing that narrows the
 * two untrusted records -- `shapeFault` runs inside it -- and its caller then wants
 * to READ them to print the hashes. Handing back only `platforms` left
 * `assert-parity.ts` to re-assert the narrowing by hand
 * (`records as readonly [HashParityRecord, HashParityRecord]`), a cast whose
 * soundness rested on a comment pointing back at `verdict.ok`.
 *
 * That cast sat in the ONE file this design deliberately leaves untested -- the bin
 * is kept small enough to review by eye instead -- so it was an unchecked assertion
 * in precisely the place with no test to catch it being wrong. Returning what was
 * validated deletes the assertion rather than documenting it.
 */
export type ParityVerdict =
  | {
      readonly ok: true;
      readonly platforms: readonly [string, string];
      readonly records: readonly [HashParityRecord, HashParityRecord];
    }
  | {
      readonly ok: false;
      readonly reason: ParityFailureReason;
      readonly detail: string;
    };

/**
 * Every refusal, with the detail forced onto ONE line.
 *
 * THE SINGLE PLACE untrusted record content is neutralised, and it is one place
 * rather than one per interpolation deliberately. Every `detail` below
 * interpolates values the DOWNLOADED RECORD controls -- a target key, `meta.os`,
 * a hash -- and `assert-parity.ts` prints the result into the step log that
 * `ci.yml`'s `grep` reads. A record carrying a target key or a `meta.os` whose
 * text is a line break followed by the comparator's own success prefix would
 * otherwise make the FAILURE path print a line the SUCCESS grep matches: the
 * log-grep ci.yml presents as a second, INDEPENDENT signal would be satisfiable
 * by content the failing path itself emitted. Escaping at each interpolation
 * site would leave the next detail string written here free to reopen the hole;
 * a choke point cannot be forgotten. Collapsing CR/LF is lossless because every
 * detail here is authored as a single sentence.
 *
 * IT IS HALF THE FIX, and says so. Stripping line breaks stops injected text
 * from STARTING a line; the other half is the `^` anchor on that grep, without
 * which the same text still matches as a mid-line SUBSTRING of the failure
 * line. Neither half suffices alone. This half is the one this module owns, and
 * `compare.spec.ts` pins it.
 *
 * THE COLLAPSE IS EXPORTED because "the single place" was not true of the one
 * path that does not go through `fail` at all. `assert-parity.ts` wraps `run()`
 * in a top-level try/catch and printed `error.message` RAW into the same
 * `hash-parity: PARITY FAILED` line the grep reads -- and the messages reaching
 * it are built from record BYTES: `JSON.parse` embeds the offending input
 * verbatim, newlines included, in `Unexpected token ... is not valid JSON`. So
 * the throw path was protected only by V8's ~10-character cap on that quoted
 * snippet, an implementation detail of the runtime rather than the choke point
 * this block credits. Exporting the collapse and calling it there makes the
 * claim above true of EVERY path instead of every path but one.
 *
 * CORRECTED (Phase 12), and supplying the REPLACEMENT FACT is the point rather
 * than retracting the old sentence. This block used to say the anchor "cannot be
 * pinned from a spec", on the ground that `ci.yml` was not a declared `test`
 * input (PARITY-08, deferred to Phase 9), so a spec asserting on its content
 * would serve a stale cached PASS. Both halves are now false:
 * `{workspaceRoot}/.github/workflows/ci.yml` IS a `test` input (`nx.json`,
 * PARITY-08, Phase 9, pinned by name in `nx-target-inputs.spec.ts`), and
 * `dogfood-cross-os.spec.ts` pins the sibling `o3-witness` job's
 * `grep -q '^o3-witness: EXISTENCE OK'` expression by exactly this mechanism. The
 * `hash-parity-compare` job's `^hash-parity: PARITY OK` anchor is now pinned the
 * same way, in `compare.spec.ts`'s "the hash-parity-compare gate agrees with the
 * bin it runs" group -- so BOTH halves of the two-half defence are guarded. A bare
 * deletion of the old sentence would have left a future reader holding a
 * documented argument that one half of a defence this same comment calls
 * load-bearing is UNGUARDABLE, which is a documented reason not to guard it. Do
 * not read the old wording as that reason.
 */
export function collapseToOneLine(detail: string): string {
  return detail.replace(/[\r\n]+/g, ' ');
}

function fail(reason: ParityFailureReason, detail: string): ParityVerdict {
  return { ok: false, reason, detail: collapseToOneLine(detail) };
}

/** A non-null, non-array object -- what every map in the record must be. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Narrow ONE untrusted record, returning the first offending path or `undefined`.
 *
 * The records are JSON downloaded from a CI artifact, so they are untrusted input
 * crossing a job boundary: truncated, empty, or shaped differently than declared.
 * `nx-target-inputs.spec.ts`'s `parseNxJson` cast note states the rule this reuses
 * (search that file for `ASSERTION about`) -- a type on a
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
    // `JSON.stringify` on the KEY, not dot-notation on it. `name` is a key of the
    // downloaded JSON, so the raw form puts arbitrary record bytes into a message
    // a CI step greps. `fail` neutralises the line break that makes that
    // exploitable; quoting it here additionally keeps the offending key READABLE
    // -- an escaped `"\n..."` names the byte an operator has to go and find,
    // where a key collapsed to a space by `fail` alone would not.
    if (!isPlainObject(entry)) {
      return `\`targets[${JSON.stringify(name)}]\` is not an object`;
    }

    if (typeof entry['hash'] !== 'string') {
      return `\`targets[${JSON.stringify(name)}].hash\` is missing or not a string`;
    }

    if (!isPlainObject(entry['nodes'])) {
      return `\`targets[${JSON.stringify(name)}].nodes\` is missing or not an object`;
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
    return fail(
      'wrong-record-count',
      `expected exactly 2 platform records, one per matrix leg, but got ${records.length}. ` +
        'Suspect a leg that failed before its upload step, an upload whose ' +
        '`if-no-files-found` defaulted to `warn` and so produced no artifact at all, ' +
        'or a download pattern that matched nothing. The compare job runs ' +
        '`if: !cancelled()` (D-17) precisely so a missing leg arrives here as a ' +
        'FAILURE instead of vanishing as a skipped job.',
    );
  }

  for (const [index, record] of records.entries()) {
    const fault = shapeFault(record);

    if (fault !== undefined) {
      return fail('malformed-record', `record ${index}: ${fault}`);
    }
  }

  // Backed by the loop above: every field HashParityRecord declares was just
  // validated, so this narrows rather than asserts.
  const [a, b] = records as readonly [HashParityRecord, HashParityRecord];

  if (a.meta.os === b.meta.os) {
    return fail(
      'duplicate-platform',
      `both records report \`meta.os\` = \`${a.meta.os}\`, so this is not a ` +
        'cross-OS comparison. Without this clause the pair would fail CORR-03(b) ' +
        'instead, which reads as a discriminator defect when the real defect is a ' +
        'matrix leg that ran twice on the same runner image.',
    );
  }

  // Like-for-like, and it sits HERE for the same reason `duplicate-platform` does:
  // before any hash is compared, because comparing hashes from two records that
  // measured different things reports a defect neither record has. The seven
  // REQUIRED_META_KEYS were validated per record and then DROPPED -- `meta.os` was
  // the only one compared across the pair -- so a pair with a different `commit`,
  // `nxVersion` or `arch` on each leg was a PASS.
  //
  // A cross-commit green was never substantively WRONG: an Nx task hash covers its
  // inputs, so two matching invariant hashes mean the trees were input-identical
  // whatever the SHAs. The cost this closes is DIAGNOSTIC, which is the whole point
  // of a named reason. Without it a skewed pair reaches clause (c) and reports
  // `invariant-target-diverged`, which reads as an OS-invariance regression -- the
  // exact wrong-blame class `duplicate-platform` was added to eliminate, one field
  // over. It also matters off a runner, over the hand-collected records
  // `08-ROOT-CAUSE.md`'s two workstation observation points are.
  for (const key of LIKE_FOR_LIKE_META_KEYS) {
    if (a.meta[key] !== b.meta[key]) {
      return fail(
        'not-like-for-like',
        `\`meta.${key}\` differs between the legs (${a.meta.os}=${a.meta[key]} vs ` +
          `${b.meta.os}=${b.meta[key]}), so the two records did not measure the same ` +
          'thing and their hashes are not comparable. Suspect a broken checkout pin ' +
          '(the CHECKOUT REF block in ci.yml), an nx version skew between the legs, ' +
          'or a matrix that gained a second architecture.',
      );
    }
  }

  // CORR-03(a). Iterate the EXPECTED list, NEVER `Object.keys(record.targets)`
  // (RESEARCH Pitfall 4): a comparator driven by the arriving keys passes every
  // later clause trivially on an empty map. The spec's vacuity control fails the
  // instant this loop stops being driven from EXPECTED_TARGETS.
  for (const target of EXPECTED_TARGETS) {
    for (const record of [a, b]) {
      const fault = targetFault(record, target);

      if (fault !== undefined) {
        return fail('missing-target-hash', `${record.meta.os}: ${fault}`);
      }
    }
  }

  // CORR-03(b).
  if (a.targets[DIVERGENT_TARGET].hash === b.targets[DIVERGENT_TARGET].hash) {
    return fail(
      'integration-not-divergent',
      `\`${DIVERGENT_TARGET}\` computed the SAME hash ` +
        `${a.targets[DIVERGENT_TARGET].hash} on ${a.meta.os} and ${b.meta.os}, ` +
        'so the one declared platform discriminator is no longer discriminating. ' +
        'Suspect a deleted or re-spelled `{ "runtime": ... }` input on ' +
        '`targetDefaults.integration` (D-14 requires that string byte-identical).',
    );
  }

  // The evidence the record already collects for exactly this question, turned into
  // an assertion. `shapeFault` requires both discriminator streams present as
  // strings and grounds that requirement in ATTRIBUTION -- a record missing one
  // cannot explain why `integration` diverged (D-04, PARITY-06) -- and then nothing
  // READ either value. So the record carried the one direct measurement of whether
  // the declared discriminator actually discriminated on THESE two legs, and the
  // comparator threw it away: a pair whose two `discriminator.stdout` values are
  // IDENTICAL while `integration` still differs was a PASS.
  //
  // That is precisely the state this module's header argues is impossible -- "with
  // every other input demonstrably shared, the only surviving explanation for a
  // divergent `integration` is the declared discriminator". The record can REFUTE
  // that premise directly, so it is checked rather than assumed. The gap is
  // otherwise covered only from the other side, by
  // `nx-target-inputs.spec.ts`'s `integration declares exactly the byte-identical
  // discriminator command` (and its post-merge twin, `keeps the byte-identical
  // discriminator once project.json is merged over targetDefaults`) pinning the
  // command string byte-identical,
  // which proves the input is DECLARED -- the substitution the header itself calls
  // the tempting wrong answer.
  //
  // IT SITS AFTER CLAUSE (b) ON PURPOSE. Identical streams AND identical hashes is
  // a discriminator that is simply GONE, which is clause (b)'s named reason and the
  // better blame; this clause is for the narrower case where the hashes diverge for
  // some reason the discriminator cannot account for.
  //
  // `stderr` stays shape-checked and UNCOMPARED, which is not the same oversight in
  // a different costume: it is legitimately EMPTY on every healthy leg, so an
  // equality check over it would reject every correct pair and an inequality check
  // would assert that a healthy run writes to stderr. Its PRESENCE is required
  // because Nx's `hash_runtime` hashes both streams, and its VALUE is evidence for
  // whoever reads a red gate.
  // TRIMMED, because TRIMMED IS WHAT NX HASHES. The instrument records both streams
  // VERBATIM on purpose (`capture-hashes.mjs`: "a trimmed value is a different
  // value") -- that is right for a RECORD, whose job is to preserve evidence. It is
  // wrong for THIS comparison, whose question is not "did the two legs print
  // different bytes" but "did the two legs feed different TOKENS into the hash".
  // `docs/cross-os.md` states the rule this clause has to match: Nx trims both
  // streams before concatenating them.
  //
  // Untrimmed, two legs printing `linux\n` and `linux\r\n` -- or `linux ` and
  // `linux` -- have IDENTICAL hashed tokens, so the discriminator has collapsed,
  // and yet the raw strings differ and this clause would PASS. It would then hand
  // the divergent `integration` hash an attribution the evidence does not support,
  // which is the one thing it exists to prevent.
  //
  // Not reachable on the CURRENT command (`win32` and `linux` differ in content, not
  // only in whitespace), and that is exactly why it is worth fixing now:
  // `docs/cross-os.md` invites replacing the command for the architecture and libc
  // axes -- "The same `runtime` mechanism carries it; only the command changes" --
  // and a CRLF-versus-LF pair is the first thing a Windows leg produces.
  if (a.discriminator.stdout.trim() === b.discriminator.stdout.trim()) {
    return fail(
      'discriminator-not-platform-sensitive',
      'the platform discriminator fed the SAME token into the hash on both legs ' +
        `(${JSON.stringify(a.discriminator.stdout)} on ${a.meta.os} and ` +
        `${JSON.stringify(b.discriminator.stdout)} on ${b.meta.os}; Nx TRIMS ` +
        `both streams, so these are one token), so the divergent ` +
        `\`${DIVERGENT_TARGET}\` hash is NOT ` +
        'attributable to it. Some OTHER input became OS-sensitive, and clause (c) ' +
        `cannot see it because \`${DIVERGENT_TARGET}\` is excluded from the ` +
        'invariant set by construction (CORR-04). Localise it with ' +
        '`node capture-hashes.mjs --diff <recordA.json> <recordB.json>`.',
    );
  }

  // CORR-03(c), plus D-21's fourth clause.
  for (const target of INVARIANT_TARGETS) {
    const left = a.targets[target].hash;
    const right = b.targets[target].hash;

    if (left !== right) {
      return fail(
        'invariant-target-diverged',
        `\`${target}\` must be IDENTICAL across platforms but diverged: ` +
          `${a.meta.os}=${left} vs ${b.meta.os}=${right}. Localise it with ` +
          '`node capture-hashes.mjs --diff <recordA.json> <recordB.json>`, which ' +
          'partitions the two node maps into only-in-A / only-in-B / value-changed ' +
          'and diffs the merged project configuration field by field.',
      );
    }
  }

  return { ok: true, platforms: [a.meta.os, b.meta.os], records: [a, b] };
}
