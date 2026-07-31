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
 * XOS-03, TEST-09 and D-17 (Phase 11) add FIVE more `ci.yml` rows, all ADDITIVE, and they
 * are authored RED -- one commit AHEAD of the `ci.yml` prose they lock. Plan 11-06 writes
 * that prose as the single GREEN commit and takes the literals from `11-05-SUMMARY.md`
 * character for character. Same split as XOS-07 and XOS-06 for the same structural reason:
 * `dogfood-cross-os.spec.ts` asserts the `o3-witness` job's PRESENCE and SHAPE, because its
 * `jobBlock` helper throws on an absent job key, and every claim ABOUT that job's design is
 * locked here, because a comment is invisible to a reader that strips `#` lines.
 *
 * `EDITED_FILES` is deliberately UNCHANGED by those five rows. `.github/workflows/ci.yml` is
 * already in the list, and the two files Phase 11 creates -- `read-integration-hash.mjs` and
 * `capture-hashes.mjs`'s new mode -- are workspace-ROOT dev instruments. `capture-hashes.mjs`
 * is edited by this milestone and is likewise absent, so the established scope of this list is
 * docs, `ci.yml` and files under `packages/github-cache/src/`. Read the omission as that
 * scope holding, not as the same-commit rule being skipped.
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
     * CORRECTION, CORR-02 -- the shard-growth estimate's THIRD correction, and the
     * first DOWNWARD one. Phase 9 raised it (each leg mirrored every restorable hash
     * under its own OS suffix, so ~5 real assets per push became ~10); CORR-02 brings it
     * back down, because one name per hash means the second leg to publish finds the
     * name present and skips it, so a hash is mirrored ONCE regardless of how many legs
     * restore it.
     *
     * The row requires the CORRECTED FIGURES, the ARITHMETIC that produces them, the
     * THIRD-CORRECTION RECORD naming both prior corrections, AND the Windows-leg
     * carve-out. That last one is the subtlest and the reason this is a row rather than
     * a silent edit: "the Windows leg now mirrors zero assets" is the natural summary of
     * this change and it is FALSE. It mirrors exactly ONE real asset -- its own publish
     * seed, plus its own `integration` hash whenever ubuntu's enumeration snapshot
     * predates it -- and that seed is precisely the asset OBS-05 reads back. A reader who
     * deleted the carve-out would be one step from collapsing the publish matrix to a
     * single leg and destroying OBS-05's only subject.
     *
     * `forbidden` is EMPTY, and here that is LOAD-BEARING for a reason the other empty
     * rows do not share: this comment DELIBERATELY QUOTES its own superseded figures, in
     * the correction-history paragraph. So a forbidden pattern over the old numbers would
     * redden on the correct implementation -- the very record that makes the correction
     * auditable is what an absence check would forbid. The row asserts on surviving
     * CONTENT only, which is also why it needs none of the single-character
     * character-class contortion the `forbidden` rows further up carry.
     */
    file: '.github/workflows/ci.yml',
    bucket: 'correction',
    required: [
      'corrected this estimate for the THIRD',
      'Phase 9 raised it UPWARD to ~10',
      'brings it back DOWN, because the suffix is GONE',
      "THE ARITHMETIC, from this estimate's own stated inputs",
      '1000 / 8 = ~125 default-branch pushes inside ONE calendar month',
      // The Windows-leg carve-out, re-pinned in plan 10-08 with research correction
      // C-1 applied. It USED to read `THE WINDOWS LEG STILL MIRRORS EXACTLY ONE REAL
      // ASSET`, which was measured correct on run 30400231720 and went stale the moment
      // XOS-07 widened `publish`'s `needs:` -- ubuntu's enumeration snapshot then
      // contained the Windows `integration` hash, so the Windows leg's one remaining
      // asset is its own SEED and its real-task count is ZERO. Three phrases, each
      // pinning one half of the corrected claim, because a single phrase let the count
      // and its CAUSE drift apart. Every phrase is deliberately WITHIN ONE LINE of the
      // wrapped comment: `read()` is a raw file read and this is `toContain`, so a phrase
      // spanning a line break would have to embed the `#` continuation prefix and would
      // then redden on a pure re-wrap.
      'THE WINDOWS LEG STILL MIRRORS EXACTLY ONE ASSET -- ITS OWN PUBLISH SEED',
      '`mirrored: 1`, NOT 0',
      "ZERO REAL TASK ASSETS DEPENDS ON XOS-07's WIDENED `needs:`, NOT ON THE RENAME",
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
  {
    /**
     * ADDITIVE, Phase 11 row A -- the CORRECTED `test`-inputs fact, and the row that is
     * additive in bucket while correcting a claim in substance. Two comment blocks in
     * `ci.yml`, above `hash-parity` and above `hash-parity-compare`, currently assert that
     * this file is NOT in `nx.json`'s `test` inputs and that a spec asserting on its content
     * would therefore serve a stale cached PASS. Both are STALE and assert the OPPOSITE of
     * current fact: `nx.json`'s `targetDefaults.test.inputs` lists
     * `{workspaceRoot}/.github/workflows/ci.yml`, registered by PARITY-08 in Phase 9.
     *
     * CITED BY KEY, NEVER BY LINE. This row previously said `nx.json:69`, which was off by
     * one -- the entry sits at line 70 -- and would have rotted again on any insertion above
     * it. A line number is unverifiable from the phrase itself, so a wrong one stays green
     * forever and correcting it reddens two assertions (this row and the occurrence count
     * below). The key path is stable under insertion and is what
     * `nx-target-inputs.spec.ts` asserts structurally.
     *
     * WHAT THIS ROW LOCKS IS THE REPLACEMENT REASON, not the absence of the wrong one. A bare
     * deletion of the stale claim would leave a future reader holding a documented argument
     * for REMOVING the registration -- and removing it would silently turn every `ci.yml`
     * content guard in this file and in `dogfood-cross-os.spec.ts` into a replay of a pass
     * computed before its subject existed. That is exactly how Phase 9 shipped a regression,
     * and it is why the correction must SUPPLY a fact rather than merely retract one.
     *
     * Independently deletable: the two blocks can be reworded without touching any other
     * `ci.yml` prose, and the specs would stay green while the argument for breaking them sat
     * in the file. `forbidden` is EMPTY for the reason every row below shares, and here it is
     * sharpest: an absence check on the stale wording is SATISFIED BY DELETING THE WHOLE
     * COMMENT, which is the failure this row exists to prevent.
     */
    file: '.github/workflows/ci.yml',
    bucket: 'additive',
    required: [
      "ci.yml IS in nx.json's targetDefaults.test.inputs (PARITY-08, Phase 9)",
      'asserted by dogfood-cross-os.spec.ts and docs-same-os-claims.spec.ts',
    ],
    forbidden: [],
  },
  {
    /**
     * ADDITIVE, Phase 11 row B -- the `o3-witness` job's `permissions` RESTATEMENT (D-17
     * sub-lock 3). The hazard this records is not that the block is missing: `dogfood-cross-os
     * .spec.ts` asserts both scopes now, in two separate cases. It is that the REASON the
     * block restates `contents: read` goes unrecorded, and a reader who does not know that a
     * job-level block REPLACES the workflow grant wholesale rather than merging it will read
     * the restatement as redundant and tidy it away -- silently dropping the grant that
     * `actions/download-artifact` needs.
     *
     * BOTH PHRASES ARE KEYED ON `o3-witness` BY NAME, and that is load-bearing rather than
     * decorative. The generic wholesale-replacement sentence ALREADY appears in this file,
     * above the `publish` job's own block, so a phrase reusing that wording would pass from
     * the pre-existing occurrence and lock nothing at all. Naming the job is what makes each
     * phrase unique to the new comment.
     *
     * Independently deletable: the restatement reason and the `actions: write`-is-DELETE
     * carve-out are two sentences that survive or fall separately -- the first prevents a
     * silent scope drop, the second prevents a reader from "fixing" a 404 by widening to
     * write. `forbidden` is EMPTY: this is prose that did not exist before.
     */
    file: '.github/workflows/ci.yml',
    bucket: 'additive',
    required: [
      'o3-witness restates contents: read because a job-level block REPLACES',
      'o3-witness does NOT request actions: write, the cache DELETE verb',
    ],
    forbidden: [],
  },
  {
    /**
     * ADDITIVE, Phase 11 row C -- D-17 sub-lock 2, the RECORDED-never-GATED clause, and the
     * subtlest row of the five. The remote-cache label's ABSENCE is recorded as an
     * observation and must never become a gate, because the absence is FALSE on a correct
     * re-run at the same commit: a local cache hit precedes any remote read, and a zero count
     * on the windows leg is the EXPECTED outcome rather than a defect. A tripwire that fires
     * on correct work gets disabled, and OBS-04 is this repo's own record of that happening.
     *
     * TWO PHRASES, SPLIT SO THE REASON AND THE MEASUREMENT CANNOT DRIFT APART. Phase 10's
     * recorded content-pin lesson is that one phrase covering both a claim and its cause lets
     * them separate silently, so the RECORDED-never-GATED reason is pinned by one phrase and
     * the measurement D-17 rests on by another. The measurement is the ubuntu-first margin,
     * n = 11, floor 109 s, max 182 s on run 30471772954, which is what makes the witness's
     * stated 30-second minimum a headroom choice rather than a guess.
     *
     * The house form for a measurement also requires the clause that a measurement is not a
     * documented guarantee. That sentence is REQUIRED IN THE PROSE but is deliberately NOT
     * pinned as a phrase here: the literal already appears in this file, in the `publish`
     * job's XOS-06 block, so a row asserting it would pass from the pre-existing occurrence
     * and lock nothing -- the same trap row B avoids by naming its job.
     *
     * Independently deletable: deleting the RECORDED-never-GATED reason must redden something
     * distinguishable from deleting the acceptance-set reason row D locks, or a failure report
     * cannot tell a promoted tripwire apart from a collapsed probe. `forbidden` is EMPTY: new
     * prose, and an absence check would be satisfied by deleting the whole comment.
     */
    file: '.github/workflows/ci.yml',
    bucket: 'additive',
    required: [
      'RECORDED and never GATED: a zero count is CORRECT on the windows leg',
      'MEASURED ubuntu-first 11 of 11 runs, 182 s max on run 30471772954',
    ],
    forbidden: [],
  },
  {
    /**
     * ADDITIVE, Phase 11 row D -- the positive control's ACCEPTANCE SET (D-16), and the only
     * one of the five whose prose lands in the `integration` job rather than in the witness's
     * own block. Two `curl` probes now run in that job against the same sidecar with two
     * DIFFERENT acceptance sets, and the whole value of the second one is the difference: the
     * readiness poll accepts 404 or 200 because it proves REACHABILITY, while the positive
     * control on the leg's own just-saved key accepts 200 ALONE, because a 404 there means a
     * dead sidecar masqueraded as a cache MISS.
     *
     * WHY THE PROSE IS WORTH LOCKING AND NOT MERELY WRITING. Two probes that differ only in
     * their acceptance set look like duplication, and the natural tidy-up is to collapse them
     * into one helper with the looser set -- which destroys the control while leaving both
     * steps green. The comment is the only thing standing between a reader and that edit, so
     * a phrase pins each half: what the control accepts, and why the poll above accepts more.
     *
     * Independently deletable: the acceptance-set sentence and the do-not-collapse sentence
     * are separate claims -- the first can survive a rewrite that still merges the probes.
     * `forbidden` is EMPTY: new prose. Note that `wanted 404 or 200` already appears in the
     * readiness step's own failure message, which is why this row's phrase says `accepts 404
     * or 200 on purpose` instead -- a phrase matching the existing message would lock nothing.
     */
    file: '.github/workflows/ci.yml',
    bucket: 'additive',
    required: [
      'the acceptance set is 200 ALONE -- a 404 here is a control FAILURE',
      'the readiness poll accepts 404 or 200 on purpose; do not collapse them',
    ],
    forbidden: [],
  },
  {
    /**
     * ADDITIVE, Phase 11 row E -- the EXACT-KEY-EQUALITY reason, and the clause whose loss
     * would be least visible. The caches endpoint's `?key=` parameter is a PREFIX match,
     * measured: `?key=nx-cache-1` returns 40 entries, and a full key minus its last character
     * returns 2. So `total_count > 0` is NOT an existence test -- a shorter hash that happens
     * to be a prefix of a longer one satisfies it. The witness therefore compares the
     * returned `.key` for exact string equality.
     *
     * THIS IS THE ONE THAT SHIPS SUBTLY BROKEN IF THE REASON IS LOST. A count-based check
     * PASSES on the happy path and is wrong only in the case the witness exists to detect, so
     * nothing about a green run would reveal the regression. The same applies to the
     * terminator that makes an absent match yield an EMPTY string rather than the literal
     * four-character null -- an emptiness test against `null` is false, so without it the
     * guard passes on absence.
     *
     * Independently deletable: the prefix-match fact and the exact-equality mechanism are two
     * sentences, and a reader can delete the first while keeping a `jq` filter they no longer
     * understand -- at which point the next simplification removes the filter too.
     * `forbidden` is EMPTY: new prose.
     */
    file: '.github/workflows/ci.yml',
    bucket: 'additive',
    required: [
      '?key= is a PREFIX match, so total_count > 0 is NOT an existence test',
      'the witness compares .key for EXACT string equality, never a count',
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
 *
 * `packages/github-cache/src/lib/release-asset-name.integration.spec.ts` has now joined
 * too. The previous revision of this comment held it out on SEQUENCING grounds -- it did
 * not exist yet, and `read()` is a `readFileSync` that THROWS on a missing path, so an
 * early entry would blow up rather than guard -- and asked the plan that created it to add
 * it in the same commit. That is not quite what happened: the RED plan created the file
 * ADD-only, one commit ahead of the rename, and this entry lands with the rename instead.
 * A one-commit lag, recorded rather than papered over, because the instruction it did not
 * follow is still the right instruction for the next file.
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
  'packages/github-cache/src/lib/release-asset-name.integration.spec.ts',
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

/**
 * PHASE 11 ROW A, SECOND HALF -- the OCCURRENCE COUNT, because `toContain` HALF-LOCKS a
 * phrase that occurs twice.
 *
 * Row A's own docstring names its subject explicitly: "**Two** comment blocks in `ci.yml`,
 * above `hash-parity` and above `hash-parity-compare`". Measured, both of its required
 * phrases occur TWICE. The table's generic assertion is `toContain`, which is satisfied by
 * the FIRST occurrence alone -- so deleting the replacement reason from EITHER block, or
 * reverting one block to the stale "ci.yml is NOT a test input" claim, left row A GREEN.
 * The row locked one block and believed it locked two.
 *
 * This is exactly the trap row B identifies and avoids by naming its job: "a phrase reusing
 * that wording would pass from the pre-existing occurrence and lock nothing at all". Row A
 * could not use that technique -- the replacement FACT is the same fact in both blocks and
 * rewording one to be unique would make the two blocks disagree about a shared truth. So the
 * count is asserted instead, which changes NO `ci.yml` prose and therefore cannot disturb the
 * other nine locked phrases. The other eight Phase 10/11 phrases were verified unique
 * (count 1); only row A's two are duplicated, which is why this guard is scoped to them.
 *
 * KEPT ALONGSIDE row A rather than replacing it. The count subsumes the containment, but the
 * two failures say different things -- "the phrase is gone" and "the phrase survives in only
 * one of the two blocks" -- and a reader who deleted one block needs the second message, not
 * the first. Removing row A from the table would also force a rewrite of the header's
 * five-row Phase 11 arithmetic for no gain.
 *
 * `split(phrase).length - 1` counts NON-OVERLAPPING occurrences, which is the right counter
 * here: these phrases cannot overlap themselves.
 *
 * A THIRD occurrence fails too, deliberately. If a future block legitimately carries the same
 * rationale, update the expected count HERE in the same commit -- the same rule every row in
 * this file states.
 */
describe('Phase 11 row A locks BOTH ci.yml blocks, not just the first (DOCS-08, PARITY-08)', () => {
  const ROW_A_PHRASES = [
    "ci.yml IS in nx.json's targetDefaults.test.inputs (PARITY-08, Phase 9)",
    'asserted by dogfood-cross-os.spec.ts and docs-same-os-claims.spec.ts',
  ] as const;

  it.each([...ROW_A_PHRASES])(
    'occurs in ci.yml exactly twice: `%s`',
    (phrase) => {
      expect(
        read('.github/workflows/ci.yml').split(phrase).length - 1,
        `ci.yml must carry the phrase \`${phrase}\` in BOTH comment blocks -- above hash-parity AND above hash-parity-compare. Row A of DOCS_08_SITES asserts it with toContain, which is satisfied by the FIRST occurrence alone, so deleting the replacement reason from either block would otherwise stay GREEN. Both blocks previously claimed the OPPOSITE (that ci.yml is NOT an nx.json test input); removing the correction from one of them leaves a future reader holding a documented argument for REMOVING the registration, and removing it turns every ci.yml content guard in this file and in dogfood-cross-os.spec.ts into a replay of a pass computed before its subject existed. If a block was legitimately reworded or added, update this expected count in the SAME commit; do not delete the assertion to make the suite green.`,
      ).toBe(2);
    },
  );
});

describe('the retracted producer-attribution claim appears in no edited file (OBS-03, D-33)', () => {
  // OBS-03 RETRACTS any claim that the mirror answers producer attribution: the
  // Phase 10 `mirrored-by` label can only derive from the PUBLISHING leg's OS, and
  // from this phase forward the ubuntu leg can mirror a Windows-produced entry and
  // would label it `linux` -- so the claim would be wrong in exactly the cross-OS
  // case it would be invoked for. Same character-class technique, same reason.
  //
  // SCOPED TO A SENTENCE, NOT TO THE FILE -- a deliberate narrowing, argued rather
  // than assumed. The bare `whose byte[s]` probe this replaced is ordinary English
  // about byte REACHABILITY, and the repo already contains it under a meaning that
  // has nothing to do with attribution: `actions-cache-backend.ts`'s
  // GITHUB_WORKSPACE/cwd mismatch error says "a reported HIT whose bytes are
  // unreachable". That file is one plausible `EDITED_FILES` addition away from
  // turning a CORRECT sentence into a red test named for producer attribution, and
  // the failure message would instruct its author to delete the sentence.
  //
  // The retracted claim is a CO-OCCURRENCE: whose-bytes AND a producer. Neither half
  // alone is the claim -- "whose bytes are unreachable" attributes nothing, and
  // "produced on windows-11-arm" is a fact this repo states freely. Requiring both
  // inside ONE sentence is what distinguishes them, and it is why this is a
  // re-aiming rather than a weakening: every phrasing of the retracted claim still
  // trips it, and the controls below pin that both directions still discriminate.
  const retracted = /whose byte[s]/i;
  const attribution = /produc(?:e[rd]|es|ing|tion)/i;

  function claimsProducerAttribution(text: string): boolean {
    return text
      .split(/(?<=[.;])\s+/)
      .some(
        (sentence) => retracted.test(sentence) && attribution.test(sentence),
      );
  }

  it.each([...EDITED_FILES])('%s makes no such claim', (file) => {
    expect(
      claimsProducerAttribution(read(file)),
      `${file} claims the mirror answers which producer's bytes a reader received. OBS-03 explicitly RETRACTS that claim -- the label is the PUBLISHING leg's OS, not the producing one. Remove the claim; do not widen this guard's escape hatch.`,
    ).toBe(false);
  });

  // NON-VACUITY, BOTH DIRECTIONS. A narrowed predicate that matches nothing is
  // indistinguishable from a deleted one, and a narrowed predicate that still
  // matches the innocent sentence bought nothing. Both are asserted so neither can
  // rot into the other.
  it('still catches the retracted claim when the two halves share a sentence', () => {
    expect(
      claimsProducerAttribution(
        'The label tells a reader whose bytes the producer wrote.',
      ),
    ).toBe(true);
  });

  it('does not fire on the byte-reachability sentence already in the repo', () => {
    expect(
      claimsProducerAttribution(
        'They are not, so @actions/cache would extract under one and this backend would read under the other -- a reported HIT whose bytes are unreachable, which handleGet then converts to a silent 404 (VER-04).',
      ),
    ).toBe(false);
  });

  it('does not fire when the two halves sit in different sentences', () => {
    expect(
      claimsProducerAttribution(
        'A reported HIT whose bytes are unreachable becomes a MISS. The entry was produced on windows-11-arm.',
      ),
    ).toBe(false);
  });
});
