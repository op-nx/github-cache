import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const WORKSPACE_ROOT_URL = new URL('../../../', import.meta.url);

/**
 * DOCS-08 / OBS-04: every location that asserted same-OS restore as a load-bearing
 * invariant now says what is TRUE, and cannot drift back silently.
 *
 * VER-01 made the archive path a workspace-relative literal and VER-03 set
 * `enableCrossOsArchive` at all three call sites, so the `@actions/cache` cache
 * version no longer partitions by runner OS. Restore is no longer same-OS, and every
 * site that asserted it was is now either corrected or given a precondition.
 *
 * Keyed on FILE + QUOTED PHRASE, never on a line number. That is not style: all six
 * edits land in ONE commit and therefore shift each other's lines, so a
 * line-number-keyed table would rot before it was ever read.
 *
 * THE COUNT, and where the record has it wrong. DOCS-08 (REQUIREMENTS.md) names FOUR
 * sites-in-scope. The real shape is SIX sites touched: THREE corrections plus THREE
 * additive preconditions. The arithmetic reconciles because DOCS-08's fourth named
 * site, `docs/advanced.md`'s fault-degradation line, fails DOCS-08's OWN membership
 * criterion for a correction -- it is textually the SAME claim as the two sites
 * DOCS-08 explicitly says must NOT be "corrected as though they were wrong", and it
 * asserts nothing about same-OS restore. So it is treated as ADDITIVE (D-32's
 * reclassification), which is recorded here rather than done silently, following the
 * house precedent for a requirement miscount (Phase 7 comment-locked ROADMAP SC3's
 * "three CORR-05 violations" against REQUIREMENTS' four on `CORR_05_SITES`).
 *
 * THE LINE-NUMBER DRIFT, recorded so a verifier does not read a content-located edit
 * as unauthorised drift. REQUIREMENTS.md and ROADMAP.md cite `ci.yml:577-583` and
 * `ci.yml:356-360`. Phase 8 inserted the `hash-parity` and `hash-parity-compare` jobs
 * into `ci.yml`, so the cited `ci.yml:577-583` now lands INSIDE the hash-parity job
 * and names nothing this table is about. Every row below was located by phrase search.
 *
 * HARD DEPENDENCY -- this spec is a stale-cached-PASS victim without it. Two rows read
 * `.github/workflows/ci.yml`, which lives outside this project's graph, so it must be
 * registered in `nx.json`'s `targetDefaults.test.inputs` (it is, since PARITY-08) or an
 * edit to `ci.yml` replays a pass computed before the edit existed. The three docs
 * files were already `test` inputs.
 *
 * XOS-07 (Phase 10) adds a SEVENTH row that is NOT a DOCS-08 site. The six-site
 * arithmetic above is about DOCS-08 and is unchanged by it. The extra row locks the
 * `publish` job's rewritten `needs:` justification, and it belongs here for the same
 * reason the two DOCS-08 `ci.yml` rows do: this is the only guard in the repo that reads
 * `ci.yml` RAW. `dogfood-cross-os.spec.ts` strips every `#` line before matching, so it
 * can assert the `needs:` VALUE -- it does, since this phase -- but structurally cannot
 * see the comment that explains the value. Two harnesses, one question each; there is
 * deliberately no third.
 *
 * XOS-06 and D-21 (Phase 10) add FOUR more `ci.yml` rows on the same footing -- three
 * additive locks on the `max-parallel: 1` rationale (its status, the rejected ordering
 * argument, and the guard-sensitivity clause) plus one CORRECTION to the `publish-verify`
 * job comment. Same split as XOS-07: `dogfood-cross-os.spec.ts` now asserts the
 * `max-parallel` VALUE, and every claim ABOUT that value is locked here, because a comment
 * is invisible to a reader that strips `#` lines. The clauses are three separate rows
 * rather than one because each survives or falls independently -- deleting the
 * guard-sensitivity clause must redden something distinguishable from deleting the
 * rejected argument, and one row with nine phrases would not tell those two apart in a
 * failure report.
 *
 * EVERY PHRASE IN THIS TABLE MUST FIT ON ONE LINE OF ITS FILE. `read()` returns the raw
 * text, so a phrase spanning a hard wrap matches NOTHING and the row would be a silent
 * false PASS in the additive direction. That is why the `ci.yml` phrases below look
 * arbitrarily clipped: each was checked against a single comment line before being
 * committed, not written to read well in isolation.
 *
 * HOME. Neither existing docs guard fits: `docs-trust.spec.ts` reads only
 * `docs/trust-and-security.md` and `docs/versioning.md`, and `docs-adoption.spec.ts`
 * reads the README, `docs/configuration.md`, `docs/advanced.md` and the examples.
 * NEITHER reads `ci.yml`, and two of the six rows key on it -- so these rows would have
 * to be split across two guards that each own a different subset. Six sites in four
 * files is a fact spanning multiple files, which by `.planning/codebase/TESTING.md`'s
 * placement rule belongs at the package-source root.
 */
const DOCS_08_SITES = [
  {
    /**
     * CORRECTION, DOCS-08 site 1. The same-OS premise supported two further
     * sentences (a leg mirrors only the tasks that RAN on its OS; the per-leg asset
     * -count asymmetry follows from that), so the whole chain is corrected and the
     * reason the two legs still matter is supplied. Also carries OBS-04's
     * consumer-facing half -- an adopter's own one-time all-MISS publish on a
     * version-affecting bump.
     */
    file: 'docs/advanced.md',
    bucket: 'correction',
    required: [
      '**Restore is not same-OS.**',
      'each leg is still the only place its own',
      'once per version-affecting change',
    ],
    forbidden: [/Restore is same-[O]S --/],
  },
  {
    /**
     * CORRECTION, DOCS-08 site 2 -- the outright false one, AND the stated
     * justification for the `keep BOTH legs` instruction two lines below it. A bare
     * deletion would leave that instruction unsupported and a later reader would
     * collapse the matrix on the strength of the corrected text, destroying the
     * cross-OS proof VER-06 built. So the row requires BOTH the corrected claim and
     * the REPLACEMENT justification (the Windows leg is still the only producer of
     * Windows-hash entries), plus the instruction it supports.
     */
    file: '.github/workflows/ci.yml',
    bucket: 'correction',
    required: [
      'an ubuntu leg CAN now restore a Windows-saved entry',
      'the ONLY leg that produces Windows-hash entries',
      'keep BOTH legs',
    ],
    forbidden: [/per-OS tmpdi[r] path/],
  },
  {
    /**
     * CORRECTION, DOCS-08 site 3 -- TWO sentences in the `integration` job comment,
     * corrected NARROWLY. Over-correction is the named anti-pattern here: "a Linux
     * cache never satisfies a Windows run" and "the two legs compute DIFFERENT Nx
     * task hashes" are both still TRUE and both stay. Only the ATTRIBUTION changes
     * (3a: the hash is now the only separation, the storage is not), and only the
     * trailing CORR-01-namespacing clause is replaced (3b).
     */
    file: '.github/workflows/ci.yml',
    bucket: 'correction',
    required: [
      'that Nx hash is the ONLY thing separating them',
      'that hash is the SOLE separation',
    ],
    forbidden: [/exactly the CORR-01 namespacin[g] the store/],
  },
  {
    /**
     * CORRECTION, and the one row in this table that is NOT a DOCS-08 site -- it is
     * XOS-07's comment lock (see the XOS-07 paragraph in the header). The `publish` job's
     * leading comment used to argue for `needs: build (NOT test)` on the ground that a
     * failing test leg must never skip the mirror and drop already-built entries.
     * Widening `needs:` does not make that concern go away; it moves it onto a DIFFERENT
     * mechanism. So a bare DELETION of the old argument would leave a future reader
     * holding a documented case for narrowing `needs:` straight back -- which is exactly
     * how Phase 9 shipped a regression. This row therefore requires the REPLACEMENT
     * REASON to be PRESENT: the mechanism, the bounded failure mode if that mechanism is
     * ever wrong, and the run id the widening is justified by.
     *
     * `forbidden` is EMPTY on purpose, and this is the one place where an absence check
     * would be actively harmful rather than merely redundant: an absence check on the old
     * narrow-`needs:` phrase is SATISFIED BY DELETING THE WHOLE COMMENT, which is the
     * failure this row exists to prevent. The row asserts on surviving CONTENT only. It
     * is also why nothing here needs the single-character character-class contortion the
     * `forbidden` rows above carry -- there is no forbidden phrase to avoid spelling.
     */
    file: '.github/workflows/ci.yml',
    bucket: 'correction',
    required: [
      'MECHANISM: !cancelled() runs this job even when a needs: dependency FAILED.',
      'BOUNDED FAILURE MODE: a skipped mirror, never a wrong artifact.',
      'MEASURED on run 30400231720',
    ],
    forbidden: [],
  },
  {
    /**
     * ADDITIVE, XOS-06 clause (a). `max-parallel: 1` is RETAINED, so the risk is not that
     * the knob disappears -- `dogfood-cross-os.spec.ts` guards its VALUE now -- but that
     * its STATUS drifts. A future reader who finds a serialisation knob with no recorded
     * status is one step from treating it as a correctness control, which is exactly what
     * XOS-06 forbids. So the lock requires the status AND the mechanical reason for it:
     * both legs restore the SAME single Actions-cache entry and upload it verbatim, which
     * is WHY the race winner cannot matter. A bare "not a correctness control" with no
     * reason is an assertion a reader can argue with; with the mechanism it is a fact.
     *
     * `forbidden` is EMPTY, and every XOS-06 row below shares that: these are ADDITIVE
     * locks on prose that did not exist before, so there is no old phrase to forbid -- and
     * consequently none of them needs the single-character character-class contortion the
     * `forbidden` rows further up carry. Do not "tidy" that contortion out of those rows:
     * it exists because spelling a forbidden phrase plants it in the file that proves it
     * is gone.
     */
    file: '.github/workflows/ci.yml',
    bucket: 'additive',
    required: [
      'NOT a correctness control (XOS-06)',
      'which OS leg wins the first-write-wins race',
      'Actions-cache entry and upload it VERBATIM',
    ],
    forbidden: [],
  },
  {
    /**
     * ADDITIVE, XOS-06 clause (b) -- the REJECTED ARGUMENT, named. This row is the one
     * whose deletion costs the most and shows the least: an unnamed rejected argument is
     * indistinguishable from an argument nobody thought of, so the next reader reconstructs
     * it from first principles and promotes the knob. Recording the argument AND why it was
     * rejected (it would rest a WRONG-RESULT guarantee on CI job scheduling) is what makes
     * the rejection re-checkable instead of folklore.
     *
     * The argument is required VERBATIM including its trailing period, because the sentence
     * is the whole artifact -- a paraphrase would not be the argument a future reader
     * recognises as their own.
     */
    file: '.github/workflows/ci.yml',
    bucket: 'additive',
    required: [
      'REJECTED ARGUMENT: ubuntu-first ordering makes the stricter Linux verdict win.',
      'rest a WRONG-RESULT',
    ],
    forbidden: [],
  },
  {
    /**
     * ADDITIVE, XOS-06 clause (c) -- the GUARD-SENSITIVITY clause, and the subtlest row in
     * this table. It records the one thing that genuinely DOES depend on `max-parallel: 1`
     * (publish-verify's ability to detect a dead publish leg, via `read-back.ts`), while
     * insisting that this is guard sensitivity and NOT a wrong-result guarantee. Deleting
     * it costs two different things at once: a reader who removes the knob loses a guard
     * without knowing it, AND the two comments that draw this distinction -- here and at
     * the label assertion in `read-back.ts` -- stop agreeing, so one of them starts reading
     * as though it contradicts the other.
     *
     * It also requires the ORDERING measurement to be recorded as a MEASUREMENT: 5/5 with a
     * cited run id, explicitly not a documented guarantee. That pairing is the point. A
     * comment claiming the ordering is guaranteed would be false; one omitting the
     * measurement entirely would leave a future reader unable to tell whether the ordering
     * was checked or assumed.
     */
    file: '.github/workflows/ci.yml',
    bucket: 'additive',
    required: [
      'see read-back.ts, which reads the mirrored-by label of the',
      'would redden publish-verify on a CORRECT',
      'guard sensitivity, not a wrong-result guarantee',
      'MEASURED 5/5 across the default-branch push runs on',
      'run 30401077417',
      'A measurement is not a documented guarantee',
    ],
    forbidden: [],
  },
  {
    /**
     * CORRECTION, D-21 -- the half Phase 9 explicitly deferred to Phase 10, and the row
     * this table's whole technique was built for. The `publish-verify` job comment said
     * each OS leg reads back ONLY its own-OS asset and that this proves the same-OS
     * publisher-to-reader contract. The first half is TRUE AGAIN but for a DIFFERENT reason
     * (a per-leg seed derivation, not a per-leg asset name); the second half was flatly
     * false and is replaced by what the job actually proves -- that each leg's own publish
     * path uploaded the asset it reads back, a PUBLISHER identity rather than a producer
     * identity.
     *
     * `forbidden` is EMPTY and here that is LOAD-BEARING rather than incidental, for the
     * same reason the XOS-07 row above spells out: an absence check on a phrase from the
     * old claim is SATISFIED BY DELETING THE WHOLE COMMENT, and a bare deletion is the
     * precise failure mode D-21 exists to prevent -- it would leave the corrected claim
     * standing with no reason, which is how Phase 9 shipped a regression. This row asserts
     * on SURVIVING CONTENT only: the replacement mechanism, the publisher-not-producer
     * distinction, and the sweep-scope lesson that explains why the stale claim lasted.
     *
     * The asset name is required as `releaseAssetName(mirrorSeedHash(...))` rather than as
     * a literal shape, so this row does not have to be re-authored when CORR-02 collapses
     * that name.
     */
    file: '.github/workflows/ci.yml',
    bucket: 'correction',
    required: [
      'per-leg SEED derivation,',
      'NOT a per-leg asset name',
      'releaseAssetName(mirrorSeedHash(...))',
      'a PUBLISHER identity, never a',
      'producer identity',
      'EXECUTABLE CODE and CI PROSE, not only docs',
    ],
    forbidden: [],
  },
  {
    /**
     * ADDITIVE, and this is the row whose CLASSIFICATION changed -- see D-32 in the
     * doc block above. DOCS-08 names this site for correction; it is textually the
     * same fault-degradation claim as the README's and the trust doc's, so the
     * existing sentence is RETAINED VERBATIM (required below) and only a
     * platform-agnosticism precondition is added.
     */
    file: 'docs/advanced.md',
    bucket: 'additive',
    required: [
      'Every read fault degrades to a MISS (a rebuild), never a wrong result.',
      'outputs must not depend on which OS produced them',
    ],
    // Empty rather than absent: `as const` would otherwise drop the property from
    // this union member and the destructure below would not typecheck. An additive
    // row forbids nothing by definition -- it retains its sentence verbatim.
    forbidden: [],
  },
  {
    /**
     * ADDITIVE. DOCS-08 says in as many words that this must NOT be "corrected" as
     * though it were wrong: it frames "never a wrong result" as a consequence of
     * FAULT DEGRADATION, which stays true. Existing sentence retained verbatim.
     */
    file: 'README.md',
    bucket: 'additive',
    required: [
      'Every read fault degrades to a cache MISS (a rebuild),',
      'must declare that difference as an Nx input',
    ],
    forbidden: [],
  },
  {
    /**
     * ADDITIVE, same reasoning as the README row. `docs-trust.spec.ts` asserts event
     * strings in this file verbatim, which is why the edit only APPENDS a paragraph.
     */
    file: 'docs/trust-and-security.md',
    bucket: 'additive',
    required: [
      'Every read fault degrades to a MISS -- never a wrong result and never a broken',
      'carries one precondition',
    ],
    forbidden: [],
  },
] as const;

/**
 * The scope of the retraction guard below: the four files the DOCS_08_SITES rows span, PLUS
 * every source file this phase has already edited. The four came from Phase 9's sweep. The
 * six source files are Phase 10's, added so the producer-attribution retraction actually
 * reaches the CODE that now carries the `mirrored-by` label instead of only the prose about
 * it -- Phase 9's hardest-won sweep lesson is that a documentation-scoped scan missed
 * `read-back.ts` and a `ci.yml` capacity comment, and both were found only after the sweep
 * had declared itself complete.
 *
 * `packages/github-cache/src/lib/mirror-seed.ts` joined the list in the SAME commit that
 * created it (OBS-05), which is what the previous revision of this comment asked for.
 * Deliberately NOT here yet: `packages/github-cache/src/lib/release-asset-name.integration.spec.ts`.
 * It does not exist at this commit; `read()` is a `readFileSync` and THROWS on a missing
 * path, so an early entry would blow up rather than guard. The later plan in this phase
 * that CREATES it extends this list in the same commit. The omission is sequencing, not an
 * oversight.
 */
const EDITED_FILES = [
  'docs/advanced.md',
  'README.md',
  'docs/trust-and-security.md',
  '.github/workflows/ci.yml',
  'packages/github-cache/src/publish/publish-mirror.ts',
  'packages/github-cache/src/action/index.ts',
  'packages/github-cache/src/roundtrip/read-back.ts',
  'packages/github-cache/src/lib/release-asset-name.ts',
  'packages/github-cache/src/lib/mirror-seed.ts',
  'packages/github-cache/src/lib/cache-key.ts',
  'packages/github-cache/src/cleanup/cleanup.ts',
] as const;

function read(file: string): string {
  return readFileSync(new URL(file, WORKSPACE_ROOT_URL), 'utf8');
}

describe('every DOCS-08 site says what is true after VER-01/VER-03 (DOCS-08, OBS-04, XOS-07, D-31, D-32)', () => {
  for (const { file, bucket, required, forbidden } of DOCS_08_SITES) {
    describe(`${file} -- ${bucket}: ${required[0]}`, () => {
      for (const phrase of required) {
        it(`still contains \`${phrase}\``, () => {
          expect(
            read(file),
            `${file} no longer contains the exact phrase \`${phrase}\`. This table is keyed on FILE + PHRASE on purpose -- these six edits shift each other's lines in one commit, so a line number would rot. If the site was legitimately reworded, update its ROW here in the SAME commit; do not delete the assertion to make the suite green.`,
          ).toContain(phrase);
        });
      }

      for (const pattern of forbidden) {
        it(`no longer asserts same-OS restore (${String(pattern)})`, () => {
          // The single-character character class in each pattern is load-bearing,
          // not style: this assertion claims a phrase is ABSENT, so spelling it here
          // would plant it in the very file that proves it is gone, and a repo-wide
          // search could no longer tell this guard apart from a regression. The
          // bracket splits the token without changing what the regex matches.
          expect(
            read(file),
            `${file} has drifted BACK to a same-OS-restore claim matching ${String(pattern)}. VER-01 made the archive path OS-invariant and VER-03 set enableCrossOsArchive, so the claim is false. If this text is genuinely needed again, update its ROW here in the SAME commit and say why.`,
          ).not.toMatch(pattern);
        });
      }
    });
  }
});

describe('the retracted producer-attribution claim appears in no edited file (OBS-03, D-33)', () => {
  // OBS-03 RETRACTS any claim that the mirror answers producer attribution: the
  // Phase 10 `mirrored-by` label can only derive from the PUBLISHING leg's OS, and
  // from this phase forward the ubuntu leg can mirror a Windows-produced entry and
  // would label it `linux` -- so the claim would be wrong in exactly the cross-OS
  // case it would be invoked for. Same character-class technique, same reason.
  const retracted = /whose byte[s]/i;

  it.each([...EDITED_FILES])('%s makes no such claim', (file) => {
    expect(
      read(file),
      `${file} claims the mirror answers which producer's bytes a reader received. OBS-03 explicitly RETRACTS that claim -- the label is the PUBLISHING leg's OS, not the producing one. Remove it; do not weaken this guard.`,
    ).not.toMatch(retracted);
  });
});
