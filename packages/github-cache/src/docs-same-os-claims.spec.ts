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

/** The four files the six rows span -- the scope of the retraction guard below. */
const EDITED_FILES = [
  'docs/advanced.md',
  'README.md',
  'docs/trust-and-security.md',
  '.github/workflows/ci.yml',
] as const;

function read(file: string): string {
  return readFileSync(new URL(file, WORKSPACE_ROOT_URL), 'utf8');
}

describe('every DOCS-08 site says what is true after VER-01/VER-03 (DOCS-08, OBS-04, D-31, D-32)', () => {
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
