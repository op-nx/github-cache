import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * VER-06's SAMPLING-RATE guard. A spec runs in one process on one OS and cannot
 * observe a two-OS property, so the load-bearing control for VER-06 is a CI job, not
 * a test. What a spec CAN do is pin the job's shape, and that shape is the whole
 * proof: one leg samples one OS and cannot detect an OS-partitioned cache store at
 * any rate. The Nyquist floor here is two legs.
 *
 * Two clauses, and the SECOND is the one that matters most:
 *
 *   1. `dogfood-verify` declares the two-leg matrix -- otherwise the Windows OS is
 *      never sampled and the cross-OS claim rests on nothing.
 *   2. `dogfood-seed` declares NO matrix. The seed key is
 *      `nx-cache-<GITHUB_RUN_ID>`: ONE key per RUN, not per OS. So a Windows seed leg
 *      makes the Windows verify job restore a WINDOWS-written entry and pass even
 *      with cross-OS restore completely dead. That is the vacuity trap, and this
 *      clause is what makes it structurally unreachable rather than merely
 *      documented. It is also the clause a future contributor is most likely to break
 *      while believing they are improving coverage, which is why its failure message
 *      spells out the reason.
 *
 * Path resolved via import.meta.url (the cleanup-workflow.spec.ts / pinned-deps
 * .spec.ts idiom), NOT __dirname and NOT process.cwd(). Placed at the package-source
 * root rather than in a subdirectory because its subject is a workspace-root workflow
 * file, not a cohesive module (.planning/codebase/TESTING.md spec placement).
 *
 * Only non-comment lines are matched: this file's own prose repeats `windows-11-arm`
 * and `fail-fast` verbatim while explaining the rationale, and `ci.yml`'s OWN comment
 * block above these jobs repeats the same strings, so a naive substring match against
 * the raw file would pass even after the real YAML had drifted. Stripping
 * '#'-prefixed lines first makes every assertion below non-vacuous against the actual
 * config.
 *
 * ASSERTIONS ARE SCOPED PER JOB BLOCK, deliberately. A bare
 * `expect(codeLines).toContain('windows-11-arm')` over all of `ci.yml` is already
 * satisfied by the `integration`, `hash-parity` and `publish` jobs, all of which name
 * that runner today -- so a whole-file match would pass unconditionally, whatever
 * `dogfood-verify` actually says. That is the exact non-vacuity failure this phase
 * keeps guarding against, so the extraction below is narrowed to each job's own block
 * and a positive control asserts the extraction is not empty.
 *
 * This spec depends on `{workspaceRoot}/.github/workflows/ci.yml` being in
 * `nx.json`'s `targetDefaults.test.inputs` (PARITY-08, plan 09-01).
 * Without it, `ci.yml` is not a hashed input and this spec replays a cached PASS
 * computed before its subject existed.
 */
const codeLines = readFileSync(
  new URL('../../../.github/workflows/ci.yml', import.meta.url),
  'utf8',
)
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'));

/**
 * One job's own block: from the `  <name>:` key (jobs are keyed at two spaces) up to
 * the next line at that same indent, exclusive. Throws rather than returning empty
 * when the job is absent, so a renamed or deleted job fails loud here instead of
 * silently satisfying the `not.toMatch` clause below.
 */
function jobBlock(name: string): string {
  const start = codeLines.findIndex((line) =>
    new RegExp(`^ {2}${name}:\\s*$`).test(line),
  );

  if (start < 0) {
    throw new Error(
      `ci.yml: no job keyed \`  ${name}:\` -- VER-06's guard cannot scope its assertions`,
    );
  }

  const rest = codeLines.slice(start + 1);
  const end = rest.findIndex((line) => /^ {2}\S/.test(line));

  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}

describe('ci.yml dogfood cross-OS sampling (VER-06)', () => {
  it('scopes to a real, non-empty job block -- the control that makes the no-matrix clause non-vacuous', () => {
    // A `not.toMatch` against an empty string passes trivially, so prove the
    // extraction actually captured each job before asserting on absence.
    expect(jobBlock('dogfood-seed')).toMatch(/operation:\s*seed/);
    expect(jobBlock('dogfood-verify')).toMatch(/operation:\s*verify/);
  });

  it('dogfood-verify samples BOTH OSes with fail-fast off, so a Windows-only failure never hides the ubuntu result', () => {
    const verify = jobBlock('dogfood-verify');

    expect(verify).toMatch(/strategy:\s*\n\s*fail-fast:\s*false/);
    expect(verify).toMatch(/matrix:\s*\n\s*os:\s*\[[^\]]*\]/);
    expect(verify).toMatch(/ubuntu-24\.04-arm/);
    expect(verify).toMatch(/windows-11-arm/);
    expect(verify).toMatch(/runs-on:\s*\$\{\{\s*matrix\.os\s*\}\}/);
  });

  it('dogfood-seed stays SINGLE-LEG -- a Windows seed leg would make the whole proof vacuous', () => {
    const seed = jobBlock('dogfood-seed');
    const reason =
      'dogfood-seed must stay single-leg (ubuntu-only). The seed key is ' +
      'nx-cache-<GITHUB_RUN_ID> -- ONE key per RUN, not per OS -- so a Windows seed leg ' +
      'makes the Windows dogfood-verify leg restore a WINDOWS-written entry and pass even ' +
      'if cross-OS restore is completely broken. That turns VER-06 into a presence check.';

    expect(seed, reason).not.toMatch(/strategy:/);
    expect(seed, reason).not.toMatch(/matrix/);
    expect(seed, reason).toMatch(/runs-on:\s*ubuntu-24\.04-arm/);
  });

  it('both dogfood jobs are SCHEDULED on same-repo pull requests, not push-only (CR-18)', () => {
    const trigger =
      /^ {4}if: github\.event_name == 'push' \|\| github\.event\.pull_request\.head\.repo\.full_name == github\.repository\s*$/m;
    const reason =
      'dogfood-seed and dogfood-verify must BOTH carry the two-clause trigger ' +
      "`if: github.event_name == 'push' || " +
      'github.event.pull_request.head.repo.full_name == github.repository`. Reverting ' +
      'either job to push-only reopens CR-18: cross-OS Actions-cache reuse would again ' +
      'have NO pre-merge signal, and every other clause in this file would stay green ' +
      'while it did. BOTH halves of the disjunction are matched on purpose -- a regex ' +
      'looking only for the push half survives exactly that revert, which is the ' +
      'cannot-fail-for-its-stated-reason defect this clause exists to avoid. Fork pull ' +
      'requests are excluded DELIBERATELY, because fork `pull_request` cache behaviour ' +
      'is cited from GitHub docs and never reproduced in this repo; widening this ' +
      'condition is a decision to make, not a drive-by fix. The `if:` must also stay ON ' +
      'ONE LINE: jobBlock joins its lines with a newline, so a folded or wrapped YAML ' +
      'scalar defeats this single-line anchor while the workflow keeps behaving -- ' +
      'measured against the prettier version pinned when this was written, so if a ' +
      'bump ever rewraps the line, FIX THE PIN rather than deleting it. Anchored at ' +
      "FOUR spaces because a job's own keys sit one level under the two-space job key; " +
      'unanchored, a step-level `if:` (eight spaces) would satisfy it. The clause below ' +
      'covers the direction this one structurally cannot see.';

    expect(jobBlock('dogfood-seed'), reason).toMatch(trigger);
    expect(jobBlock('dogfood-verify'), reason).toMatch(trigger);
  });

  // THE DIRECTION THE CLAUSE ABOVE STRUCTURALLY CANNOT SEE, and it is a separate case
  // because it is a different regression with a different repair. That anchor ends
  // `\s*$`, and `$` under /m matches at the end of ANY line -- so the engine satisfies
  // it with zero-width at the end of the pinned line and NEVER INSPECTS WHAT FOLLOWS.
  // YAML plain scalars continue onto more-indented following lines, so appending one
  // rewrites the effective condition while the anchor above stays GREEN. MEASURED, not
  // theorized: `&& false` (the jobs never run again, CR-18 reopens), `|| ...head.repo.fork`
  // (the exact fork widening the reason above calls a decision rather than a drive-by
  // fix), and a blank line before either, ALL passed the anchor above before this clause
  // existed. That is the same cannot-fail-for-its-stated-reason defect the clause above
  // warns about, one level up.
  //
  // Asserted as "the next line is a job key" rather than as "no line starts with && or
  // ||": the positive form rejects ANY deeper-indented continuation whatever it starts
  // with, and rejects a blank line too, which a token-based check would let through.
  it('the dogfood `if:` is a COMPLETE scalar -- no YAML continuation line folds extra logic in', () => {
    const scalarEndsAtTheLine = /^ {4}if: .*\n {0,4}\S/m;
    const reason =
      'A line more-indented than the job key now follows a dogfood `if:`, so YAML folds ' +
      'it INTO the condition. The effective gate is no longer what the line reads as, ' +
      'and the whole-line anchor in the clause above cannot see it: that anchor ends ' +
      '`\\s*$`, which `/m` satisfies with zero width at the end of the pinned line. The ' +
      'two drifts this catches are `&& false` (both dogfood jobs stop running and CR-18 ' +
      'reopens silently) and `|| github.event.pull_request.head.repo.fork` (fork PRs ' +
      'admitted, which is a decision to take deliberately, not by continuation). If the ' +
      'condition genuinely needs to grow, keep it on ONE line and update BOTH clauses in ' +
      'the same commit.';

    expect(jobBlock('dogfood-seed'), reason).toMatch(scalarEndsAtTheLine);
    expect(jobBlock('dogfood-verify'), reason).toMatch(scalarEndsAtTheLine);
  });

  // THE PRECONDITION BOTH CLAUSES ABOVE ASSUME AND NEITHER CAN SEE. They prove each job's
  // `if:` PERMITS a pull_request run; they say nothing about whether one ever happens.
  // Deleting `pull_request:` from ci.yml's workflow-level `on:` block leaves both `if:`
  // lines byte-identical, reopens CR-18 completely -- and takes every other PR gate in
  // the file with it -- with every clause in this file still green. Verified absent:
  // nothing else in the tree asserts anything about ci.yml's `on:` block, though
  // cleanup-workflow.spec.ts and windows-regression-detector.spec.ts both pin their OWN
  // workflow's triggers, so this is a real gap rather than a missing idiom.
  //
  // Scoped to the `on:` block by construction: the inner alternation consumes only
  // INDENTED lines, so the match cannot run past the next top-level key and be satisfied
  // by some unrelated `pull_request:` elsewhere in the file.
  it('ci.yml is pull_request-triggered at all -- the precondition the CR-18 job gates rest on', () => {
    expect(
      codeLines.join('\n'),
      'ci.yml no longer declares `pull_request:` in its workflow-level `on:` block. That ' +
        'reopens CR-18 in full -- the dogfood pair can never be SCHEDULED on a PR no ' +
        'matter what its `if:` permits -- and it silently disables every other ' +
        'PR-eligible gate in the file (action-bundle-drift, hash-parity, the three ' +
        'Windows legs, o3-witness) at the same time. The job-level trigger clauses above ' +
        'cannot detect this: both `if:` lines stay byte-identical through it.',
    ).toMatch(/^on:\n(?:[ \t]+.*\n|[ \t]*\n)* {2}pull_request:/m);
  });
});

/**
 * XOS-07's `needs:` VALUE guard, and the FIRST such guard in the repo. Nothing asserted any
 * job's `needs:` value before this phase, so reverting the widening reddened NOTHING. Stated
 * plainly rather than implied: "CI already covers it" is exactly what let this value sit
 * unguarded while the race below was live and measurable.
 *
 * WHY IT LIVES IN THIS FILE. `jobBlock` above is the only job-block extractor in the repo.
 * Extracting it to a shared module so this guard could live elsewhere would be a NEW mechanism
 * built for one caller, which 10-RESEARCH's Don't-Hand-Roll table names as the smell. So the
 * guard comes to the helper rather than the helper going to the guard.
 *
 * THE SUPERSET HOLE, and how the shape below closes it. A `toMatch` against a `needs:` LIST is
 * satisfied by any SUPERSET, so one assertion looking for `integration` would still pass
 * against `needs: [integration]` alone -- against a rewrite that DROPPED `build`. Each of the
 * four producers therefore gets its own case, `build` INCLUDED: the `build`-SURVIVES clause is
 * not decoration, it is the half a naive check structurally cannot express. Four separate cases
 * rather than four `expect`s in one, so the revert-to-`needs: build` mutation shows its 3-of-4
 * split instead of stopping at the first failure.
 *
 * Note the direction differs from every other clause in this file: `dogfood-cross-os` otherwise
 * asserts a job's shape is NARROW (the single-leg seed), and that direction inherits safety from
 * a non-vacuity control alone. Asserting a list is WIDE does not, which is why the per-member
 * split exists on top of the control.
 *
 * Each pattern is anchored at `^ {4}needs:` -- a job's own keys sit one level under the
 * two-space job key -- so the token must appear ON the `needs:` line. Unanchored, `\bbuild\b`
 * would already be satisfied by this same job's `- run: npm run build` step and the guard would
 * be a tautology.
 *
 * NO comment-phrase assertion belongs here. `codeLines` strips every `#` line, so a comment
 * lock placed in this file is vacuous by construction; XOS-07's comment lock lives in
 * `docs-same-os-claims.spec.ts`, whose read is raw.
 *
 * XOS-06's `max-parallel: 1` VALUE guard SHARES this describe, and shares its positive
 * control above. The describe's TITLE names XOS-07 only, and the alternative -- a second
 * describe with a second copy of the same `jobBlock('publish')` control -- would duplicate a
 * mechanism for one assertion. Both guards ask the same kind of question about the same job
 * block, so they share the one control. XOS-06's own clauses are named in its `it()` title
 * and its comment lock lives, like XOS-07's, in `docs-same-os-claims.spec.ts`.
 *
 * THE TITLE WAS NARROWED IN PHASE 12, "every job that produces a mirrored ENTRY" -> "every
 * job that produces a NEW mirrored KEY", and the rename is recorded here because it is a
 * REVERSAL of the trade this same block used to record. The old note declined to rename the
 * title because `10-03-SUMMARY.md` and `10-05-SUMMARY.md` cite it verbatim in six coverage
 * refs, which the rename rots. That trade was right when the only gain was cosmetic (adding
 * XOS-06 to the title). It flipped when XOS-04 landed three new Windows legs and left the old
 * title asserting coverage the `needs:` list does not provide (WR-09) -- and a guard title
 * that reads as false coverage is the same defect class this phase spent commits correcting
 * in `compare.ts` and in two `ci.yml` blocks. A stale ref is documentation archaeology;
 * nothing in the tree resolves those refs mechanically. A false invariant is a standing
 * argument. If you are following a rotted `10-0*-SUMMARY.md` ref, this describe is where it
 * went.
 *
 * WHY THE THREE WINDOWS LEGS ARE DELIBERATELY ABSENT from the list, rather than an omission:
 * `build-windows`, `typecheck-windows` and `test-windows` carry NO platform discriminator, so
 * by design each computes the SAME task hash as its ubuntu producer. On the happy path they
 * HIT and write no NEW key, so there is nothing for publish to miss. `integration` is in the
 * list for exactly the inverse reason -- its `{ runtime: ... process.platform }` input makes
 * the Windows leg's hash genuinely distinct, so that leg is the ONLY producer of those
 * entries. The gap opens only when a Windows hash DIVERGES: that leg MISSes, executes, and
 * saves a new key publish may have already raced past. That case is the regression this
 * milestone exists to CATCH -- it is already gated by `hash-parity-compare` and by the
 * scheduled detector -- and its cost is one mirror entry deferred to the next push, never a
 * wrong artifact reaching the world-readable mirror.
 */
describe('ci.yml publish waits on every job that produces a NEW mirrored key (XOS-07)', () => {
  const reason =
    'The publish job must declare needs: [build, typecheck, test, integration]. A leg reads ' +
    'the Actions-cache key set ONCE at its publish step start and never re-reads it, so what ' +
    'it can mirror is a function of its START TIME -- measured on run 30400231720, where the ' +
    'ubuntu leg enumerated 122s before integration (windows-11-arm) finished and task hash ' +
    '8059758544828235640 reached the shard only under -windows. The three windows-* legs ' +
    '(XOS-04) are deliberately ABSENT and must stay absent unless the reason below stops ' +
    'holding: they carry no platform discriminator, so they compute the SAME task hash as ' +
    'their ubuntu producer and on the happy path they HIT and write no NEW key. A Windows leg ' +
    'that MISSED would write one publish could race -- accepted, because that divergence is ' +
    'itself the regression hash-parity-compare and the scheduled detector exist to catch, and ' +
    'the cost is a mirror entry deferred to the next push rather than a wrong artifact. Each ' +
    'producer is asserted SEPARATELY because a toMatch against a needs: list is satisfied by ' +
    'any SUPERSET: a check for `integration` alone would pass against needs: [integration], ' +
    'which dropped build.';

  // POSITIVE CONTROL, and it comes first for the same reason the two controls above do. Every
  // clause below is a `toMatch`, so a `jobBlock` that returned the WRONG non-empty block would
  // have them asserting about the wrong job. This `if:` expression is unique to `publish` and
  // is real YAML, so it survives the comment strip.
  it('scopes to a real publish job block', () => {
    expect(jobBlock('publish')).toMatch(
      /^ {4}if:\s*\$\{\{\s*!cancelled\(\)\s*&&\s*github\.event_name == 'push'\s*\}\}$/m,
    );
  });

  it('waits on build -- the SURVIVES clause, which a superset check cannot express', () => {
    expect(jobBlock('publish'), reason).toMatch(/^ {4}needs:.*\bbuild\b/m);
  });

  it('waits on typecheck', () => {
    expect(jobBlock('publish'), reason).toMatch(/^ {4}needs:.*\btypecheck\b/m);
  });

  it('waits on test', () => {
    expect(jobBlock('publish'), reason).toMatch(/^ {4}needs:.*\btest\b/m);
  });

  it('waits on integration -- the two-leg matrix, so both OS legs finish first', () => {
    expect(jobBlock('publish'), reason).toMatch(
      /^ {4}needs:.*\bintegration\b/m,
    );
  });

  it('serializes the OS legs with max-parallel: 1 (XOS-06) -- publish-verify loses a guard without it', () => {
    expect(
      jobBlock('publish'),
      'The publish job must keep max-parallel: 1. Two things rest on it and NEITHER is a ' +
        'correctness control (XOS-06): the soft asset-cap check needs the later leg to see ' +
        "the earlier leg's uploads (WR-01), and publish-verify's dead-publish-leg DETECTION " +
        'needs the two legs NOT TO OVERLAP -- read-back.ts asserts the mirrored-by label of ' +
        'the asset its own leg seeded, and concurrent legs would let the other leg win that ' +
        "upload race, reddening publish-verify on a CORRECT implementation. That is a guard's " +
        'SENSITIVITY, never a wrong-result guarantee: no reader can receive wrong bytes, ' +
        'because both legs upload the SAME single Actions-cache entry verbatim. Nothing here ' +
        'depends on which leg goes FIRST. If this knob is genuinely being removed, price the ' +
        'lost detection first and update the comment lock in docs-same-os-claims.spec.ts in ' +
        'the SAME commit.',
    ).toMatch(/^ {6}max-parallel:\s*1$/m);
  });
});

/**
 * ROBUST-04's SAMPLING RATE, and it lives in VER-06's guard because it is the same fact
 * about which event samples what.
 *
 * A green `dogfood-verify` is NOT ROBUST-04 evidence, and the split is decided by the
 * `uses:` PATH rather than by a count: every `- uses: ./start-cache-server` site runs the
 * COMMITTED `start-cache-server/index.js`, and every `- uses: ./packages/github-cache` site
 * builds `dist/action/index.js` from source IN-JOB. Both dogfood jobs take the second path,
 * so neither ever executes the committed bundle. `action-bundle-drift` is the only control
 * tying the two together, and `09-RESEARCH.md`'s validation table states ROBUST-04's
 * sampling rate as "every PR and every push" on the strength of that job carrying NO `if:`.
 *
 * The ARITHMETIC, measured at HEAD rather than carried forward: 8 of the 12 sidecar `uses:`
 * sites in `ci.yml` run the committed bundle, and the other 4 build it in-job. This block
 * used to say "four of the five", which was stale BECAUSE OF THIS PHASE'S OWN EDIT -- XOS-04
 * added three `./start-cache-server` sites, taking the split from 5+4 at `0251bd3` to 8+4
 * (IN-06) -- and the numbers will rot again on the next job added. So the rule above is the
 * load-bearing statement and the counts are context: the ROBUST-04 ARGUMENT, that the
 * dogfood jobs build the action in-job and therefore never sample the committed bundle, does
 * not depend on either number and was never wrong. Re-measure before restating.
 *
 * Nothing in the tree asserted that shape. Adding `if: github.event_name == 'push'` to it
 * -- the same gate that still leaves OBS-04 unobservable until a merge, and therefore the
 * edit a reader is most likely to make while believing they are being consistent -- would
 * silently drop the committed bundle's only standing sampler to push-to-`main` only, while
 * every spec in this file and every other ci.yml guard stayed green.
 *
 * OBS-04 ALONE, and the narrowing is load-bearing rather than tidying: this paragraph used
 * to name VER-06 alongside it, which stopped being true in the commit that widened both
 * dogfood jobs to same-repo pull requests (CR-18). VER-06 is now PR-observable; OBS-04 is
 * the surviving example, because its `[remote cache]` counts are RECORDED and never GATED.
 */
describe('ci.yml action-bundle-drift stays PR-eligible (ROBUST-04)', () => {
  // POSITIVE CONTROL, and it has to come first for the same reason the job-block control
  // above does: the clause below asserts an ABSENCE, which an empty or mis-extracted block
  // satisfies trivially.
  it('scopes to a real job block that runs the bundle diff', () => {
    expect(jobBlock('action-bundle-drift')).toMatch(
      /run:\s*npm run check:action/,
    );
  });

  it('declares NO job-level if:, so the committed bundle is diffed on pull requests too', () => {
    // Anchored at FOUR spaces -- a job's own keys sit one level under the two-space job
    // key, so this matches a job-level gate and deliberately not a step-level `if:`
    // (eight spaces, inside a `- ` item), which gates one step rather than the sampler.
    expect(
      jobBlock('action-bundle-drift'),
      'action-bundle-drift has acquired a job-level `if:`. That job is the ONLY standing ' +
        'control proving the committed start-cache-server/index.js matches a fresh build, ' +
        'and every `- uses: ./start-cache-server` site executes THAT file rather than the ' +
        'in-job build the `- uses: ./packages/github-cache` sites (both dogfood jobs among ' +
        'them) use. Gating it on an event drops ROBUST-04 from "every PR and ' +
        'every push" to push-only, which is exactly the gate that still leaves OBS-04 ' +
        'unobserved until a merge lands. VER-06 is no longer an example of it: the ' +
        'dogfood pair now runs on same-repo pull requests too (CR-18).',
    ).not.toMatch(/^ {4}if:/m);
  });
});

/**
 * XOS-03 / TEST-09's PRESENCE and SHAPE guard for the `o3-witness` job, authored RED -- it
 * lands one commit BEFORE the `ci.yml` job it asserts on. That is the recorded shape from
 * plan 10-03, whose guards were written first and whose `ci.yml` change landed as the single
 * GREEN commit; HEAD is deliberately red in between. Do not soften these assertions and do
 * not stub a placeholder job to make the suite green.
 *
 * THREE THINGS THIS BLOCK'S HOME DEPENDS ON, because the wrong half in the wrong file is
 * vacuous rather than merely misplaced.
 *
 *   1. PRESENCE AND SHAPE BELONG HERE, and specifically here rather than in any file that
 *      reads `ci.yml` some other way. `jobBlock(name)` above THROWS when the job key is
 *      absent, and that throw IS the anti-silent-deletion mechanism. `o3-witness` is a new
 *      CI job with NO inferred Nx target behind it, and this repo's own recorded trap is
 *      that `nx run-many` on a missing target prints "No tasks were run" and exits 0 -- by
 *      the same logic a deleted CI JOB is a silently removable gate unless something asserts
 *      it by content. `jobBlock` is the only job-block extractor in the repo, so the guard
 *      comes to the helper rather than the helper going to the guard -- the same reasoning
 *      XOS-07's block above records, and the reason `jobBlock` stays unexported here.
 *   2. THE COMMENT-PROSE LOCK FOR THE SAME `ci.yml` CHANGE IS DELIBERATELY NOT HERE.
 *      `codeLines` strips every `#` line, so a comment assertion placed in this file is
 *      vacuous by construction. The `o3-witness` rationale prose is locked phrase by phrase
 *      in `docs-same-os-claims.spec.ts`, whose read is RAW, as five additive
 *      `DOCS_08_SITES` rows keyed on this same file. Two harnesses, one question each.
 *   3. IT CANNOT REPLAY A CACHED PASS COMPUTED BEFORE ITS SUBJECT EXISTED, because
 *      `{workspaceRoot}/.github/workflows/ci.yml` is an `nx.json` `test` input
 *      (`targetDefaults.test.inputs`, PARITY-08, Phase 9). `ci.yml`'s OWN comment blocks above `hash-parity` and
 *      `hash-parity-compare` currently claim the OPPOSITE; both are STALE, plan 11-06
 *      corrects them WITH a replacement reason, and the membership fact above was read from
 *      `nx.json` rather than from them.
 */
describe('ci.yml o3-witness job exists and keeps its shape (XOS-03, TEST-09)', () => {
  const permissionsReason =
    'The o3-witness job must carry a job-level permissions block granting exactly ' +
    'contents: read and actions: read. Such a block REPLACES the workflow-level grant ' +
    '(contents: read) WHOLESALE rather than merging it, so a missing scope is silently ' +
    'dropped rather than reported -- which is why contents: read is RESTATED and why the ' +
    'two scopes are asserted by two SEPARATE cases below. actions: read is what ' +
    '/actions/caches and /actions/runs/{id}/jobs need; actions: write is the cache DELETE ' +
    'verb and is deliberately NOT requested.';

  // POSITIVE CONTROL, and it comes FIRST for the same reason every other control in this
  // file does: every POSITIVE clause below is a `toMatch`, so a `jobBlock` that returned
  // the WRONG non-empty block would have the six envelope clauses asserting about the wrong
  // job. The qualifier is not pedantry -- two clauses in the body group below are
  // `not.toMatch` (the `exit 0` ban and the $GITHUB_ENV sink ban), and an ABSENCE is exactly
  // what a wrong-block extraction satisfies for free, which is why each of those carries its
  // own positive control rather than leaning on this one. `needs:
  // integration` is real YAML, so it survives the comment strip, and it is unique in this
  // file -- every other `needs:` line names a different value.
  it('scopes to a real o3-witness job block that waits on integration', () => {
    expect(
      jobBlock('o3-witness'),
      'jobBlock THROWS when no job is keyed `  o3-witness:`, and that throw is the whole ' +
        'presence guard: it is what stops the witness from being a gate that can be deleted ' +
        'without anything going red. A new CI job has no inferred Nx target behind it, and ' +
        'this repo has already recorded that `nx run-many` on a missing target exits 0. So ' +
        'the correct response to a red here is to RESTORE THE JOB, never to delete the ' +
        'assertion. `needs: integration` rather than `needs: hash-parity` is itself ' +
        'load-bearing (D-17 sub-lock 1): on a pull_request, hash-parity pins the PR head ' +
        "SHA while integration takes actions/checkout's default MERGE commit, so the two " +
        'measure DIFFERENT TREES and their task hashes are not commensurable. H_linux must ' +
        "come from the integration leg's own record.",
    ).toMatch(/^ {4}needs: integration$/m);
  });

  // Anchored at FOUR spaces -- a job's own keys sit one level under the two-space job key.
  // Unanchored, `permissions` would already be satisfied by the workflow-level grant's text
  // if the extraction ever widened, which is the tautology this file's own comment warns
  // about after an unanchored `\bbuild\b` was satisfied by a `npm run build` step.
  it('declares a job-level permissions block at all', () => {
    expect(jobBlock('o3-witness'), permissionsReason).toMatch(
      /^ {4}permissions:$/m,
    );
  });

  // Clauses 3 and 4 are SEPARATE cases on purpose. D-17 sub-lock 3's whole hazard is that a
  // job-level block REPLACES the workflow grant rather than merging it, so dropping
  // contents: read and dropping actions: read are two different regressions with two
  // different symptoms -- the first breaks actions/download-artifact, the second 404s the
  // cache enumeration -- and a combined assertion would report them identically. Anchored at
  // SIX spaces (one level under the job's own keys) but NOT terminated with `$`, because a
  // trailing `#` rationale comment on the same line is legitimate here and must not redden.
  it('RESTATES contents: read, which the job-level block would otherwise drop', () => {
    expect(jobBlock('o3-witness'), permissionsReason).toMatch(
      /^ {6}contents: read\b/m,
    );
  });

  it('grants actions: read, which is what the two REST endpoints need', () => {
    expect(jobBlock('o3-witness'), permissionsReason).toMatch(
      /^ {6}actions: read\b/m,
    );
  });

  it('runs on a SINGLE ubuntu-24.04-arm runner, not a matrix', () => {
    expect(
      jobBlock('o3-witness'),
      'The witness must run on one ubuntu-24.04-arm runner. It is curl plus jq against two ' +
        'REST endpoints, so a matrix would issue the same read twice and a windows-11-arm ' +
        'leg would reopen the gh/jq availability question this design closed by staying ' +
        'ubuntu-only. It also needs no checkout, no npm ci and no build -- unlike ' +
        'hash-parity-compare, whose comparator is TypeScript in dist/.',
    ).toMatch(/^ {4}runs-on: ubuntu-24\.04-arm$/m);
  });

  it('carries a timeout-minutes value -- generic hang insurance, like every other job', () => {
    expect(
      jobBlock('o3-witness'),
      'The witness must carry a timeout-minutes value. Every job in ci.yml does; the ' +
        'non-matrix siblings sit at 15. Without one, a hung curl against the REST API holds ' +
        'a runner for the account default rather than failing loud, and this job is ' +
        "build-gating from its first commit so its failure mode has to be a job's own, not " +
        'the platform ceiling.',
    ).toMatch(/^ {4}timeout-minutes: \d+$/m);
  });

  it('carries the house if: !cancelled() form, so a red needs: dependency still gates', () => {
    expect(
      jobBlock('o3-witness'),
      "The witness must carry `if: ${{ !cancelled() }}`, this file's house form. The two " +
        'candidate forms differ on exactly one case -- cancellation -- and a cancelled run ' +
        'producing a red gate is noise rather than signal, which is the reason ' +
        'hash-parity-compare records for choosing it over always(). Note what may NOT ' +
        'appear: nothing in this if: may govern whether the job PASSES, and there is ' +
        'deliberately no needs.*.result reference anywhere in it -- the verdict comes from ' +
        'the recorded cache-service and run metadata only.',
    ).toMatch(/^ {4}if:\s*\$\{\{\s*!cancelled\(\)\s*\}\}$/m);
  });

  /**
   * THE STEP BODY, and this block closes an ASYMMETRY rather than adding polish. Every
   * clause above pins the job's ENVELOPE -- its key, `needs:`, `permissions:`,
   * `runs-on:`, `timeout-minutes:`, `if:` -- and the ten Phase 11 prose locks in
   * `docs-same-os-claims.spec.ts` pin the RATIONALE. Nothing read the SHELL. All ten
   * locked phrases live in the job's LEADING COMMENT BLOCK, which a body edit does not
   * touch, so each of the following left the entire suite green AND every phrase intact:
   *
   *   - replacing the `select(.key == $key and .ref == $ref)` filter with
   *     `.actions_caches[0].created_at`, dropping exact-key equality, the ref filter and
   *     the null terminator in one stroke;
   *   - dropping `// empty` alone, after which an emptiness test runs against the literal
   *     string `null`, is false, and the guard PASSES on absence;
   *   - lowering `-lt 30` to `-lt 0`, turning the stated margin into the bare `<` this
   *     file's own comment rejects as satisfiable by a timestamp-truncation artefact;
   *   - deleting the `grep -q '^o3-witness: EXISTENCE OK'` second signal;
   *   - reverting the H_linux shape check to a bare `-z` emptiness test, which is what
   *     let an artifact-controlled value reach `$GITHUB_ENV` unvalidated.
   *
   * This job's own comment says of its mechanism: "THIS IS THE ONE THAT SHIPS SUBTLY
   * BROKEN IF THE REASON IS LOST. A count-based check PASSES on the happy path and is
   * wrong only in the case the witness exists to detect." The prose lock protected the
   * REASON; the MECHANISM had no guard. The `max-parallel: 1` precedent above locks both
   * the value AND the prose about the value, which is the shape this now matches.
   *
   * THREE CLAUSES WERE ADDED WHEN THE REF FILTER WAS WIDENED for Case B (run
   * 30768540898), and they exist because that widening opens mutations the original five
   * did not cover: the caches REQUEST must carry no server-side ref narrow (or the
   * base-scope row never reaches jq at all), the empty-result branch must still `exit 1`
   * (M4 -- nothing else forbids a skip-on-empty), and the OK line must print the matched
   * ref (or Case A and Case B collapse into one indistinguishable verdict).
   *
   * TWO MORE CAME FROM THE CODE REVIEW OF THAT WIDENING, both defects it introduced or
   * left standing rather than shapes it merely made possible: the response must be proven
   * to BE an `actions_caches` array before anything is read out of it (an error payload
   * otherwise exits 5 with no verdict printed at all), and a row with no `created_at` must
   * be excluded BEFORE the sort (jq 1.8.1 sorts a null FIRST, so a timeless row wins
   * `first` deterministically and reports a false absence).
   *
   * `codeLines` strips every `#` line, so each clause below is asserted against real
   * shell rather than against the comment that explains it -- verified by dumping the
   * stripped block. TEN separate cases, not one, because each mechanism survives or
   * falls independently and a combined assertion would report ten regressions
   * identically. THIS COUNT IS LOAD-BEARING PROSE AND HAS ALREADY GONE STALE TWICE: if a
   * clause is added or removed below, correct it in the SAME commit, and sweep the
   * sibling count in the sink block further down -- that is the exact pair that drifted.
   */
  it('compares .key for EXACT equality and constrains the ref to an ALLOWLIST -- ?key= is a prefix match', () => {
    expect(
      jobBlock('o3-witness'),
      'The witness must compare the returned .key for EXACT string equality AND constrain ' +
        'the ref. ?key= is a PREFIX match (measured: `?key=nx-cache-1` returns 40 entries, ' +
        'and a full key minus its last character still returns 2), and ONE hash holds ' +
        'entries on TWO refs, so neither a count nor a key-only match is an existence ' +
        'proof. The ref constraint may therefore never be DROPPED. It is an ALLOWLIST ' +
        'rather than an equality because a strict `.ref == $ref` encodes the Case-A shape ' +
        'only: MEASURED on run 30768540898, every ubuntu producer HIT, nothing was written ' +
        'to the PR merge ref, and the entry the Windows legs actually read lives in the ' +
        'DEFAULT-branch scope -- so an equality test reports "the entry may never have ' +
        'existed" about an entry that does exist. The allowlist must be exactly the scope a ' +
        'run can genuinely read, and that is THREE refs and not two: its own ref, a ' +
        'NON-EMPTY base ref, and a NON-EMPTY DEFAULT-branch ref. The third is not optional ' +
        'padding -- `on.pull_request` carries no `branches:` filter, so a STACKED pull ' +
        'request (base != the default branch) reaches this job, and on the Case-B shape ' +
        'above the row proving prior existence lives on the DEFAULT branch, which neither ' +
        'of the other two arms matches. Dropping it reproduces the same wrong-cause report ' +
        'one scope over: the witness discards a row the request already returned and blames ' +
        'a ref it can read. The pattern no longer requires the select to CLOSE after the ' +
        'ref allowlist, because there is now a conjunct after it (the created_at type ' +
        'guard); the close is pinned by that clause instead, so nothing was traded away -- ' +
        'every arm asserted here still has to appear in this exact literal adjacency.',
    ).toMatch(
      /select\(type == "object"\) \| select\(\s*\.key == \$key and \(\.ref == \$ref or \(\$baseref != "" and \.ref == \$baseref\) or \(\$defaultref != "" and \.ref == \$defaultref\)\)/,
    );
  });

  // THE ELEMENT-LEVEL HALF of the response guard, asserted with the allowlist because they
  // share one expression and a rewrite that drops either is the same edit. The container
  // guard thirty lines up proves `.actions_caches` IS an array and says nothing about what
  // is IN it. MEASURED with jq 1.8.1: `{"actions_caches":["scalar",3]}` passes that guard
  // (`ok`) and then exits 5 here with `Cannot index string with string "key"` -- and since
  // `entry=$(...)` is a plain assignment under `set -euo pipefail`, that kills the brace
  // group with NO `o3-witness:` verdict at all, which is verbatim the failure the container
  // guard claims to have eliminated. Pinned as the FIRST filter in the pipeline: placed
  // after the key comparison it would never run, because the indexing fault happens first.
  it('rejects a non-object ROW before indexing it, not just a non-array response', () => {
    expect(
      jobBlock('o3-witness'),
      'The entry expression must open with `select(type == "object")`. Without it a single ' +
        'non-object element in `actions_caches` -- which the container guard admits, because ' +
        'the container IS an array -- aborts the step at jq exit 5 with no verdict printed. ' +
        'It must come FIRST: after the key comparison it never runs, since indexing a scalar ' +
        'is what faults. The container guard is NOT redundant with it and must stay: only ' +
        'that one can tell an API or permissions fault apart from a genuinely empty result.',
    ).toMatch(/\[\.actions_caches\[\] \| select\(type == "object"\) \|/);
  });

  // THE ARG THE ALLOWLIST ARM READS, pinned separately from the arm itself because the two
  // fail differently and only one is visible. `--arg defaultref` bound to an UNSET shell
  // variable would abort the step under `set -u`; bound to an EMPTY one the arm above is
  // structurally present and permanently false, so the clause above stays green while the
  // default-branch scope is silently unreadable again. Reading the branch from the event
  // payload rather than a hardcoded `main` is the other half: a literal fails OPEN on a
  // branch rename, since a ref matching nothing just drops out of the allowlist.
  it('derives the default-branch ref from the event payload, so the third arm is never empty', () => {
    const block = jobBlock('o3-witness');

    expect(
      block,
      'o3-witness must pass the repository default branch into the step environment as ' +
        'DEFAULT_BRANCH, read from `github.event.repository.default_branch`. Both triggers ' +
        'carry `repository`. Hardcoding `main` fails OPEN the day the branch is renamed.',
    ).toMatch(
      /^ {10}DEFAULT_BRANCH: \$\{\{ github\.event\.repository\.default_branch \}\}$/m,
    );

    expect(
      block,
      'o3-witness must build `default_ref` as `refs/heads/${DEFAULT_BRANCH}` under a ' +
        'non-empty guard. The `:-` default form is required rather than tidy: the step runs ' +
        'under `set -euo pipefail`, so reading the variable bare would abort it outright.',
    ).toMatch(
      /default_ref=''\n\s*if \[ -n "\$\{DEFAULT_BRANCH:-\}" \]; then\n\s*default_ref="refs\/heads\/\$\{DEFAULT_BRANCH\}"\n\s*fi/,
    );
  });

  it('GUARDS that the caches response IS an actions_caches array, like its jobs-API sibling', () => {
    expect(
      jobBlock('o3-witness'),
      'The caches response must be proven to BE an `actions_caches` array before anything ' +
        'is read out of it. MEASURED under `set -euo pipefail`: an error payload from that ' +
        'endpoint (`{"message":"Not Found"}` on a permissions fault, ' +
        '`{"message":"API rate limit exceeded"}`, or any non-JSON body) makes ' +
        '`.actions_caches[]` fail -- `jq: error (at <stdin>:0): Cannot iterate over null ' +
        '(null)` -- and the subshell exits 5, killing the step with NO `o3-witness:` ' +
        'message at all. The jobs-API block thirty lines below guards this exact case by ' +
        'name, and its own comment says the guard "is not defensive noise: without it an ' +
        'error payload ... arrives at the absent-step message -- reintroducing exactly the ' +
        'wrong-cause report this block was just corrected for". The caches call had the ' +
        'same exposure and none of the protection. Gap bounded to the single message line, ' +
        'for the reason the M4 block records.',
    ).toMatch(
      /if \[ "\$\(printf '%s' "\$\{caches_body\}" \| jq -r 'if \(\.actions_caches \| type\) == "array" then "ok" else "bad" end'\)" != "ok" \]; then\n[^\n]*\n\s*exit 1\n/,
    );
  });

  // THE GUARD ABOVE ONLY RUNS IF THE STEP SURVIVES THE REQUEST, and neither curl carried
  // the swallow that lets it. This is the THIRD site in ci.yml to miss the same rule -- the
  // integration job's positive control records it at length after its absence defeated that
  // control on the ONE case it exists to detect -- so it is pinned here rather than left to
  // be re-learned a fourth time. COUNT-PAIRED rather than matched once: a floor would be
  // satisfied by whichever call still has it while the other silently aborts the step.
  it('swallows a TRANSPORT fault on BOTH REST calls, so a verdict always reaches the log', () => {
    const block = jobBlock('o3-witness');
    const curls = (block.match(/curl -s --max-time 30/g) ?? []).length;
    const swallows = (block.match(/ \|\| true\)/g) ?? []).length;

    // POSITIVE CONTROL: two zeroes are trivially equal, so prove the calls exist first.
    expect(
      curls,
      'o3-witness issues no `curl -s --max-time 30` REST call at all, so the pairing below ' +
        'has no subject and this clause cannot be evaluated.',
    ).toBe(2);

    expect(
      swallows,
      `o3-witness has ${swallows} \`|| true)\` swallows for ${curls} curl calls. curl exits ` +
        'non-zero for TRANSPORT faults that produce no body -- 7 connection refused, 28 on ' +
        'the --max-time ceiling, 6 DNS, 35 TLS -- and a command substitution INHERITS that ' +
        'status, so under `set -euo pipefail` the step aborts BEFORE its own array guard can ' +
        "run. `-s` has already suppressed curl's message, so the o3 proof then reads as a " +
        'bare non-zero exit naming no subsystem: the misattributing wrong-cause report this ' +
        'whole witness was corrected for, arriving one line ABOVE the guard that prevents it. ' +
        'An empty body is measured to reach that guard correctly. Restore the swallow; never ' +
        'relax this clause.',
    ).toBe(curls);
  });

  it('EXCLUDES a row with no created_at before sorting, so a timeless row cannot win', () => {
    expect(
      jobBlock('o3-witness'),
      'The select must reject rows whose `created_at` is not a string, and it must do so ' +
        'BEFORE the sort. MEASURED with jq 1.8.1: `sort_by(.created_at)` places a null ' +
        'FIRST, so a matching row that carries no timestamp wins `first` deterministically ' +
        'even when a perfectly good row is sitting in the same array -- the extraction then ' +
        'yields the empty string and the job prints "the entry never existed" about an ' +
        'entry jq had in hand. `created_at` carries no `required` marker in the ' +
        'cache-list schema, so this is unlikely rather than impossible, and the sort is ' +
        'what makes the bad row win DETERMINISTICALLY rather than by API ordering. It is ' +
        'the misattributing wrong-cause report this whole witness was corrected for, ' +
        "reached one field over. Asserted as the select's LAST conjunct immediately " +
        'followed by the sort, with no gap in the pattern at all: this file has already ' +
        'measured that a non-greedy gap bounds what a match PREFERS, not how far it may ' +
        'REACH.',
    ).toMatch(
      /\)\) and \(\.created_at \| type\) == "string"\)\] \| sort_by\(\.created_at\)/,
    );
  });

  it('does NOT narrow the caches REQUEST by ref server-side, or the base-scope row never arrives', () => {
    const cachesUrl = jobBlock('o3-witness').match(
      /actions\/caches\?[^"]*/,
    )?.[0];

    // POSITIVE CONTROL: `expect(undefined).not.toMatch(...)` THROWS rather than asserting,
    // and a clause that cannot be evaluated is not a clause. Prove the URL was extracted
    // before asserting about its contents.
    expect(
      cachesUrl,
      'o3-witness no longer issues an `actions/caches?` request at all, so the absence ' +
        'this case guards cannot be evaluated.',
    ).toBeDefined();

    expect(
      cachesUrl,
      'The caches REQUEST must carry no ref parameter. A server-side narrow to $GITHUB_REF ' +
        'cannot RETURN the base-scope row, so widening the client-side jq while leaving the ' +
        'URL narrowed fixes nothing -- the row that proves prior existence is filtered out ' +
        'at the server and never reaches jq at all. The character class stops at the ' +
        "URL's closing quote, so this asserts about the request and not about the rest of " +
        'the step.',
    ).not.toMatch(/ref=/);
  });

  it('terminates BOTH cache extractions with // empty, so an absent match is not the string "null"', () => {
    const emptyTerminatorReason =
      'The jq extraction of created_at must be terminated with `// empty`. Without it an ' +
      'absent match yields the literal four-character string `null`, and `[ -z "${created}" ]` ' +
      'against `null` is FALSE -- so the guard would PASS on exactly the absence it exists ' +
      "to detect. This file's own comment names this failure mode explicitly.";

    // The terminator now sits on the created_at extraction itself rather than inside a
    // parenthesised `first(...)`, because the filter selects the matching entry OBJECT
    // (to carry its ref) instead of the timestamp alone.
    expect(jobBlock('o3-witness'), emptyTerminatorReason).toMatch(
      /\.created_at \/\/ empty/,
    );

    // The SECOND extraction, on the same footing and for the same reason. matched_ref is
    // only printed, so a stray `null` there is cosmetic today -- but it is one of the six
    // enumerated mutations and an unterminated extraction is the shape that reads as
    // present when it is absent. Pinned for parity rather than left to the next reader.
    expect(jobBlock('o3-witness'), emptyTerminatorReason).toMatch(
      /\.ref \/\/ empty/,
    );
  });

  /**
   * M4, AND IT IS THE POINT OF THE CASE-B WIDENING. The ORIGINAL five clauses -- the five
   * enumerated in the block comment at the head of this group, not "the other clauses
   * here", of which there are now nine -- cover the mutations that were possible BEFORE
   * the widening; none of them forbids the
   * empty-result branch from becoming a skip. A witness that skips when it finds nothing
   * is disabled on precisely the runs it is hardest to satisfy -- the guard-green-because-
   * it-asserts-nothing failure mode, arriving through the fix rather than through neglect.
   *
   * NOT NATURALLY RED, and that is recorded rather than hidden: today's `ci.yml` already
   * exits 1 there, so this clause was proven by MUTATION -- `exit 1` temporarily changed
   * to `exit 0`, the red observed, the mutation reverted.
   *
   * THE OBVIOUS FORM OF THIS CLAUSE IS VACUOUS, MEASURED. Written as
   * `/if \[ -z "\$\{created\}" \]; then[\s\S]*?exit 1/` -- the shape the research
   * proposed -- the `exit 0` mutation left it GREEN. Non-greedy bounds how much the gap
   * PREFERS to consume, not how far it MAY reach: with the branch's own `exit 1` mutated
   * away, the gap simply walked past the closing `fi` and matched the jobs-API `exit 1`
   * a hundred lines further down. A structural guard that can satisfy itself from an
   * unrelated part of the same block is not a guard. Hence the two clauses below: the gap
   * is bounded to the branch's single message line, and `exit 0` is forbidden anywhere in
   * the witness -- the second is what actually caught the mutation.
   */
  it('still FAILS on an empty cache result -- no skip-on-empty branch (M4)', () => {
    const noSkipReason =
      'The empty-result branch must still `exit 1`. Widening the ref filter to accept the ' +
      'base-branch scope makes a skip-on-empty branch look reasonable -- "nothing was ' +
      'created this run, so there is nothing to witness" -- and nothing else in this ' +
      'describe forbids it. A witness that skips when it finds nothing asserts nothing ' +
      'on exactly the runs it is hardest to satisfy. The correct response to a red here ' +
      'is to RESTORE THE FAILURE, never to soften it.';

    // The gap is `[^\n]*\n`, ONE line -- the branch's own message -- so the match cannot
    // reach an `exit 1` outside the branch. See the block comment above: the unbounded
    // non-greedy form was measured to survive the mutation this clause exists to catch.
    expect(jobBlock('o3-witness'), noSkipReason).toMatch(
      /if \[ -z "\$\{created\}" \]; then\n[^\n]*\n\s*exit 1\n/,
    );

    // And the same fact from the other side, because the positive shape above would also
    // redden on a harmless extra diagnostic line and a reader could then be tempted to
    // loosen it. This one has no such pressure: the witness has no legitimate `exit 0`.
    // Every one of its exits is a verdict, and every verdict but the last is a failure --
    // the successful path falls off the end of the block after printing EXISTENCE OK.
    expect(jobBlock('o3-witness'), noSkipReason).not.toMatch(/exit 0\b/);
  });

  it('prints the MATCHED ref on the OK line, so the log records Case A versus Case B', () => {
    expect(
      jobBlock('o3-witness'),
      'The EXISTENCE OK line must print the ref the matched entry actually lives on. With ' +
        'the ref constraint widened to an allowlist, the verdict no longer says WHICH of ' +
        'the readable scopes satisfied it -- a run that wrote the entry itself and a run ' +
        'that read an older copy from the base branch produce the same OK. Read it as the ' +
        'provenance of the LOWER BOUND (the earliest readable copy is the one selected), ' +
        'not as a claim about which run created the entry; that is precisely why it has to ' +
        'be printed rather than inferred from the event.',
    ).toMatch(/EXISTENCE OK[^\n]*matched_ref=\$\{matched_ref\}/);
  });

  it('demands the STATED 30-second minimum margin, not a bare <', () => {
    expect(
      jobBlock('o3-witness'),
      'The witness must demand a 30-second minimum margin. A bare `<` (i.e. `-lt 0`, or ' +
        '`-le 0`) is satisfiable by a timestamp-truncation artefact -- the cache side ' +
        'carries sub-second precision and the step side is whole-second -- which is why ' +
        'ci.yml states a margin rather than an ordering. The measured ubuntu-first floor is ' +
        '109 s, so 30 s is roughly four times headroom, not a guess.',
    ).toMatch(/\[ "\$\{delta\}" -lt 30 \]/);
  });

  it('proves the verdict was PRINTED, not just that the step exited 0', () => {
    expect(
      jobBlock('o3-witness'),
      'The witness must keep the anchored `grep -q` on its own log as the SECOND signal. ' +
        'The exit code is the first verdict; the anchored content assertion proves the ' +
        'verdict was actually PRINTED rather than the step succeeding through an early ' +
        'exit. The `^` anchor is load-bearing because both streams merge into the one log ' +
        'this grep reads and the failure detail interpolates values the DOWNLOADED RECORD ' +
        'controls, so an unanchored match could hit a mid-line substring of a failure line.',
    ).toMatch(/grep -q '\^o3-witness: EXISTENCE OK' o3-witness\.log/);
  });

  it('validates the downloaded H_linux SHAPE, not merely that it is non-empty', () => {
    expect(
      jobBlock('o3-witness'),
      'The witness must reject a downloaded integration-hash record that is not an Nx task ' +
        'hash, using an all-decimal shape check rather than a bare `-z` emptiness test. The ' +
        'value is ARTIFACT-CONTROLLED -- produced by a job that executes PR-authored code, ' +
        'on a job that runs on pull_request including from forks. A `-z` check passes any ' +
        'non-empty value, which is how the value previously reached $GITHUB_ENV unvalidated: ' +
        'command substitution strips only TRAILING newlines, $GITHUB_ENV is parsed line by ' +
        'line, and `run:` steps are executed as `bash -e {0}`, which sources BASH_ENV. If ' +
        'the export step is ever reinstated, validate BEFORE the write.',
    ).toMatch(/case "\$\{h_linux\}" in\s*\n\s*''\|\*\[!0-9\]\*\)/);
  });

  /**
   * THE SINK'S ABSENCE (T-11-28), and it is the one direction every clause above leaves
   * open. CR-01's fix was a DELETION rather than a filter: the `$GITHUB_ENV` export step is
   * gone and `h_linux` is read inside its one consuming step. The TEN body clauses above
   * assert what the job now DOES -- including that the shape check is present -- but nothing
   * asserted what it must never do again, so an editor could reinstate
   * `echo "H_LINUX=${h_linux}" >> "$GITHUB_ENV"` and the whole suite would stay green.
   *
   * WHY THAT STILL MATTERS AFTER THE SHAPE CHECK. A reinstated sink would be materially
   * safer than the original, because the all-decimal `case` now runs first in the same step.
   * But the ORDERING is what makes it safe and the ordering is itself unguarded -- a
   * reinstated export placed ABOVE the `case` is one line of diff away from the original
   * vulnerability. The value is ARTIFACT-CONTROLLED: produced by a job that executes
   * PR-authored code, on a job ungated by event, so it runs on pull_request from forks;
   * command substitution strips only TRAILING newlines, `$GITHUB_ENV` is parsed LINE BY LINE,
   * and `run:` steps execute as `bash -e {0}`, which sources BASH_ENV. Guarding the sink's
   * absence outright is strictly cheaper than guarding a step ordering.
   *
   * `$GITHUB_OUTPUT` is in the same pattern deliberately: it is the same documented injection
   * sink reached by a different key, since a step output is interpolated into later `run:`
   * bodies. Rejecting one and accepting the other would guard the phrasing rather than the
   * defect.
   *
   * TWO THINGS MAKE THIS NON-VACUOUS rather than an absence over an empty string. First, the
   * positive control at the head of this describe proves `jobBlock('o3-witness')` returns the
   * real block -- and `jobBlock` THROWS on an absent job key, so a deleted job cannot satisfy
   * this clause by disappearing. Second, `codeLines` strips every `#` line, which is REQUIRED
   * here rather than incidental: this job's own leading comment names `$GITHUB_ENV` five times
   * while explaining why the sink was removed, so the identical assertion against the raw file
   * would fail on the CORRECT implementation. Verified by dumping the stripped block: the only
   * `GITHUB_*` tokens surviving in it are `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_REF` and
   * `GITHUB_RUN_ID`.
   *
   * The `integration` job legitimately writes to `$GITHUB_ENV` (its sidecar pre-set step), so
   * this clause is scoped to the witness's own block and must never be widened to the file.
   */
  it('routes the artifact-controlled H_linux into NO $GITHUB_ENV or $GITHUB_OUTPUT sink (T-11-28)', () => {
    expect(
      jobBlock('o3-witness'),
      'The o3-witness job must not write to $GITHUB_ENV or $GITHUB_OUTPUT. CR-01 was fixed by DELETING that sink, not by filtering it: h_linux is artifact-controlled, produced by a job that executes PR-authored code, and this job runs on pull_request including from forks. $GITHUB_ENV is parsed line by line and `run:` steps execute as `bash -e {0}`, which sources BASH_ENV -- so a record holding `123\\nBASH_ENV=/tmp/evil.sh` defines a variable for every later step and executes arbitrary code. The all-decimal shape check does make a reinstated export safer, but only while it runs FIRST, and that ordering is unguarded. If a sink is genuinely needed, validate BEFORE the write and replace this clause with one that asserts the ordering.',
    ).not.toMatch(/GITHUB_ENV|GITHUB_OUTPUT/);
  });

  /**
   * THREE LITERALS MUST MOVE TOGETHER and only one pair was documented as a contract.
   * `ci.yml` records that the integration STEP NAME is a contract ("If this name is ever
   * edited, the witness's jq selector must be edited in the SAME commit"), but the
   * ARTIFACT-NAME coupling -- `matrix.os`, the upload's `integration-hash-${{ matrix.os }}`
   * and this job's hardcoded `integration-hash-ubuntu-24.04-arm` -- carried no such note
   * and no guard.
   *
   * The `runs-on` clause above does NOT cover it: that pins the WITNESS's own runner, so
   * it stays green through a matrix bump to a different ubuntu label. The symptom would
   * be a `download-artifact` error one job away from the cause, with nothing saying why.
   *
   * This reads the label OUT of the witness rather than spelling it, so the clause does
   * not need re-authoring on a legitimate coordinated bump -- it fails only when the two
   * drift APART, which is the actual defect.
   */
  it('downloads an artifact name the integration matrix actually produces', () => {
    const witness = jobBlock('o3-witness');
    const wanted = witness.match(/name: integration-hash-(\S+)/)?.[1];

    // POSITIVE CONTROL: `toContain(undefined)` would throw rather than assert, so prove
    // the label was extracted before comparing against the matrix.
    expect(
      wanted,
      'o3-witness no longer downloads an `integration-hash-<os>` artifact at all, so the ' +
        'coupling this case guards cannot be evaluated.',
    ).toBeDefined();

    expect(
      jobBlock('integration'),
      `o3-witness downloads integration-hash-${wanted}, but \`${wanted}\` no longer appears ` +
        "in the integration job's block. THREE literals must move together: the " +
        'integration matrix.os value, the upload name integration-hash-${{ matrix.os }}, ' +
        'and this download name. When they drift apart the symptom is a download-artifact ' +
        'error inside o3-witness, one job away from the cause, with no message about why.',
    ).toContain(wanted);
  });
});

/**
 * XOS-04 / XOS-08's PRESENCE and SHAPE guard for the three Windows legs, authored RED -- these
 * three describes land BEFORE the `ci.yml` jobs they assert on (plan 12-02). That is the
 * recorded shape from plans 10-03 and 11-01, whose guards were written first and whose `ci.yml`
 * change landed as the single GREEN commit; HEAD is deliberately red in between. Do not soften
 * these assertions and do not stub placeholder jobs to make the suite green.
 *
 * WHY EACH LEG GETS ITS OWN DESCRIBE rather than one loop over three names. Each leg survives
 * or falls independently -- a copy-paste leaving `npm run test` in `build-windows` is a
 * different regression from a `typecheck-windows` that lost its `needs:` edge -- and a shared
 * parameterised block would report all three identically. The three names also give
 * `-t "build-windows"` something to select, which is how each RED was observed separately
 * rather than as one undifferentiated failure.
 *
 * THE ANCHORING RULE IS LIVE HERE, not theoretical. This file already records shipping a
 * tautology: an unanchored `\bbuild\b` on a `needs:` check was satisfied by that same job's own
 * `- run: npm run build` step (XOS-07's block above, and its comment at the head of this file).
 * `build-windows` reproduces the trap exactly -- its `needs:` value and its `- run:` line carry
 * the SAME token -- so every clause below is anchored at its indent level: a job's own keys at
 * FOUR spaces, their step children at SIX.
 *
 * AND EVERY CLAUSE IS SCOPED TO `jobBlock(<leg>)`, never to the file. `windows-11-arm` occurs
 * many times over in the COMMENT-STRIPPED `ci.yml` this guard actually reads, so a whole-file
 * `toContain('windows-11-arm')` passes unconditionally whatever these three jobs actually say.
 *
 * THE NUMBER IS COMPUTED, NOT RESTATED, and that is this block's third attempt at it (WR-07).
 * It first said 19, which was wrong in both directions: measured at author time BEFORE this
 * phase's own `ci.yml` edit landed and never re-measured (these guards were authored RED, so the
 * number was frozen against a tree that did not yet contain the three legs), and measured RAW
 * when `codeLines` strips every `#` line -- so the reading that supports the vacuity argument is
 * the comment-stripped one. Corrected to 7/19, then to 10/25, then to 13/29, each time by hand.
 * It drifted AGAIN inside this same phase: `c84ae43` added a `windows-11-arm` mention to a gate
 * rationale COMMENT after the 29 was refreshed, so the raw half was stale on landing -- the
 * fourth drift, and the second one caused by a change that touched no job at all.
 *
 * So the raw half is gone and the stripped half is derived from `codeLines` below. The raw count
 * rots on any `ci.yml` comment edit while supporting no argument this file makes -- `codeLines`
 * is what every clause here reads -- and a recorded measurement that no longer measures is the
 * exact defect class this phase set out to remove. The ARGUMENT holds at any value, so nothing
 * is lost by not pinning one.
 *
 * NO COMMENT-PHRASE ASSERTION BELONGS HERE. `codeLines` strips every `#` line, so a comment lock
 * placed in this file is vacuous by construction; the sidecar-invariant and graph-premise prose
 * locks live in `docs-same-os-claims.spec.ts`, whose read is RAW. Two harnesses, one question
 * each.
 */
const RENAME_NOTE =
  'If the job was legitimately renamed, update this describe in the SAME commit; do not ' +
  'delete the assertion to make the suite green.';

/**
 * How many lines of the COMMENT-STRIPPED `ci.yml` name the Windows runner -- derived from
 * `codeLines`, the same view every clause in this file reads, rather than restated as a literal
 * that four separate `ci.yml` edits have already outrun (see the block above).
 *
 * It feeds the `runsOn` failure message, whose job is to tell a reader why the clause is scoped
 * to one job block instead of to the file: any value above 1 makes a whole-file
 * `toContain('windows-11-arm')` vacuous, and the count is only there to show HOW vacuous. Lines
 * rather than occurrences because `codeLines` is a line array; the two readings are equal today
 * (13 and 13, measured) and nothing here depends on them staying equal.
 */
const strippedRunnerLines = codeLines.filter((line) =>
  line.includes('windows-11-arm'),
).length;

function windowsLegReasons(leg: string, target: string, producer: string) {
  return {
    presence:
      `jobBlock THROWS when no job is keyed \`  ${leg}:\`, and that throw IS the presence ` +
      `guard: it is what stops ${leg} from being a gate that can be deleted without anything ` +
      'going red. A CI job has no inferred Nx target behind it, and this repo has already ' +
      'recorded that `nx run-many` on a missing target prints "No tasks were run" and exits ' +
      `0. So the correct response to a red here is to RESTORE THE JOB. ${RENAME_NOTE}`,
    runsOn:
      `${leg} must run on windows-11-arm. It is the CONSUMER half of XOS-04, and a leg that ` +
      'quietly moved back to ubuntu proves nothing about cross-OS reuse while staying green. ' +
      'Asserted against this job block alone: `windows-11-arm` names ' +
      `${strippedRunnerLines} lines of the COMMENT-STRIPPED ci.yml this guard reads, so a ` +
      `whole-file match would pass unconditionally. ${RENAME_NOTE}`,
    needs:
      `${leg} must declare \`needs: ${producer}\` -- a BARE SCALAR naming exactly ONE ` +
      'producer, never a list (XOS-08, D-02). The edge is what makes this leg a CONSUMER of ' +
      'an artifact the ubuntu leg has already published; without it the leg races its own ' +
      'producer and MISSes on correct code. Anchored at FOUR spaces because unanchored, ' +
      `\`${producer}\` is already satisfied by this same job's own \`- run: npm run ${target}\` ` +
      `step -- the exact tautology this file records having shipped once. ${RENAME_NOTE}`,
    timeout:
      `${leg} must carry timeout-minutes: 15 (D-05), the value every non-matrix sibling in ` +
      'ci.yml uses. Without one, a hung step holds a runner for the account default rather ' +
      `than failing loud as a job's own failure. ${RENAME_NOTE}`,
    ownTarget:
      `${leg} must run \`npm run ${target}\` and NEITHER of the other two targets. The three ` +
      'Windows legs are verbatim copies of one block differing only in their final run line, ' +
      'so a copy-paste leaving the wrong target behind is the single most likely error in ' +
      'authoring them -- and nothing else in this file would catch it. The job would pass, ' +
      `one target would run twice, and ${target} would simply never run on Windows. ` +
      RENAME_NOTE,
    sidecar:
      `${leg} must carry the sidecar dogfood block -- \`- uses: ./start-cache-server\` and its ` +
      '`- cancel: cache-server` teardown. Without the sidecar the leg has no remote cache ' +
      'client at all, so it cannot exhibit the HIT XOS-05 is measured on: the leg goes green ' +
      'having proved nothing. That is the same silent-success failure mode the scheduled ' +
      `regression detector exists to catch. ${RENAME_NOTE}`,
    cacheClient:
      `${leg} must PRE-SET the Nx remote cache client vars and then WAIT for the sidecar to ` +
      'bind. A running sidecar is not what gives Nx a remote cache client -- the ' +
      'NX_SELF_HOSTED_REMOTE_CACHE_SERVER and NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN values ' +
      'written to $GITHUB_ENV are, and the readiness poll is what stops the Nx step beating ' +
      'the sidecar to the port. Delete either and Nx runs LOCAL-CACHE-ONLY: it MISSes on a ' +
      'fresh runner, executes the target, and the job goes GREEN having cached nothing -- ' +
      'with the sidecar clause and every other clause for this leg still green, because ' +
      'nothing else reads these lines. That matters MORE here than on the ubuntu producers: a ' +
      'producer that silently loses its cache client still builds, whereas these three legs ' +
      'exist for NOTHING BUT the HIT observation, so a consumer that silently loses its cache ' +
      "client is a DELETED CONTROL THAT STILL LOOKS PRESENT and makes XOS-05's O4 observation " +
      `unobtainable with the whole suite green. ${RENAME_NOTE}`,
    cacheObservation:
      `${leg} must TEE its Nx output and RECORD the remote-cache label count. Without ` +
      'it the leg has no runtime cache observation at all: a leg that MISSED and ' +
      'executed locally exits 0 identically to one that HIT, so the three legs that ' +
      'exist for NOTHING BUT the HIT observation cannot report the one thing they are ' +
      'for. The concrete loss is an @actions/cache bump that breaks cross-OS restore -- ' +
      'all three legs stay GREEN, hash-parity stays green because it compares hashes ' +
      'rather than storage. The dogfood canary DOES catch that bump -- its verify leg ' +
      'MISSes and reddens, on same-repo PRs too since CR-18 -- but it catches a ' +
      'DIFFERENT thing from these records: it drives a DIRECT scripted PUT/GET on a ' +
      'run-scoped key, so it never observes whether a REAL Nx build/typecheck/test task ' +
      'got a remote HIT, and it is skipped outright on a fork pull request. Those ' +
      'per-target records are what these clauses guard. This clause is about the RECORD ' +
      'existing; its VALUE is gated by the gatedCount clause, and soundly so since ' +
      'XOS-09: the leg DECLINES the write, so the only way it can carry a ' +
      '[remote cache] label at all is a genuine restore of the ubuntu producer entry. ' +
      'While the leg could still save, that gate would have been launderable -- a ' +
      'broken cross-OS restore made the leg MISS, execute and SAVE its own entry, and a ' +
      're-run of the same commit then HIT that self-produced entry and took a floor ' +
      `check green with cross-OS reuse dead. ${RENAME_NOTE}`,
    readOnlyLeg:
      `${leg} must write CACHE_READ_ONLY into $GITHUB_ENV from its pre-set step, so the ` +
      'sidecar started next constructs the read-only Actions backend (TRUST-14) and this leg ' +
      'CANNOT save an entry of its own. That is not hardening for its own sake, it is the whole ' +
      'reason the gatedCount clause below is allowed to exist: a leg that can write launders its ' +
      'own failure, because a broken cross-OS restore makes it MISS, execute and SAVE, and a ' +
      're-run of the same commit then HITs that self-produced entry and takes the floor green ' +
      'with cross-OS reuse dead. Delete this one line and NOTHING else on the leg reddens -- the ' +
      'job still runs, still HITs on a re-run, and the gate still passes -- so the failure mode ' +
      'is a GATE THAT STILL LOOKS PRESENT while it has quietly stopped proving the ubuntu ' +
      "producer is the source. The write belongs in the pre-set step and not the sidecar's own " +
      "`env:`, because a REGULAR step's $GITHUB_ENV writes reach later steps while a BACKGROUND " +
      `step's do not (start-cache-server/action.yml records this). ${RENAME_NOTE}`,
    gatedCount:
      `${leg} must COMPARE its [remote cache] count against the floor of 1 and FAIL below it ` +
      '(XOS-09, D-04/D-05), not merely print it. The COMPARISON and the `exit 1` under it are ' +
      "matched TOGETHER, with the gap bounded to the branch's single message line: a " +
      '`::error::` workflow command only ANNOTATES, so a comparison whose exit was deleted ' +
      'leaves the leg GREEN on a zero cross-OS count while still printing "GATED at a floor of ' +
      '1" -- a gate that reads as coverage. A BARE `/exit 1/` needle remains rejected and that ' +
      'rejection is why the gap is bounded: this job block already contains one, in the "Wait ' +
      'for the loopback sidecar" readiness poll, it is not a comment so the strip above keeps ' +
      'it, and an unbounded gap simply walks past the closing `fi` to reach it -- the same ' +
      'vacuity this file MEASURED on the o3-witness M4 clause. The `exit 0` absence check is ' +
      'the other half: ci.yml has ZERO legitimate `exit 0`, every exit in this leg is a ' +
      "verdict, and a gate's passing path falls off the end of the step. The record-only " +
      'absence check is the revert detector, and it reads the printed record rather than a ' +
      'comment on purpose: the echo is CODE and survives the comment strip, so a leg quietly ' +
      `returned to recording-without-gating still says so where an operator reads. ${RENAME_NOTE}`,
    countShape:
      `${leg} must PROVE its count is a decimal number before comparing it, and must force ` +
      "grep to treat the tee'd log as TEXT. Both halves close the same fail-OPEN route, and it " +
      'is MEASURED rather than argued: `[ "${count}" -lt 1 ]` sits in an `if` CONDITION, where ' +
      '`set -e` is SUSPENDED, so a non-decimal count prints `[: ...: integer expected` to ' +
      'stderr, tests FALSE, takes the else branch and EXITS 0 -- the identical test outside a ' +
      'condition exits 2 and aborts. So the leg PASSES while printing "GATED at a floor of 1" ' +
      'over a count it never evaluated. `-a` is the other half: one NUL byte in the log makes ' +
      'grep report `Binary file ... matches` as a SINGLE line, and `wc -l` then returns 1 on ' +
      'ZERO real labels -- clearing a floor of 1 outright. Neither the gatedCount clause nor ' +
      'any other clause on this leg reads either line, so losing them leaves a gate that still ' +
      'LOOKS present and can be satisfied by an encoding artefact. The correct response to a ' +
      `red here is to RESTORE the guard, never to drop it as noise. ${RENAME_NOTE}`,
    backendToken:
      `${leg} must pass GITHUB_TOKEN into the sidecar step's own \`env:\`, and this clause is ` +
      'SEPARATE from the cacheClient one above because the two produce the SAME green-having-' +
      'cached-nothing outcome by DIFFERENT mechanisms, and a combined assertion would report ' +
      'them identically. cacheClient governs whether NX has a remote cache CLIENT; this ' +
      'governs whether the sidecar has a usable BACKEND. Without the token `selectBackend` ' +
      'takes its documented degrade branch (select-backend.ts: an absent token is "just a ' +
      'not-yet-write-capable context") and returns the read-only MEMORY backend, which answers ' +
      'MISS forever. The readiness poll CANNOT catch it: the poll accepts 404, and 404 is ' +
      'exactly what a never-populated memory backend returns for the probe hash, so a dead ' +
      'backend and a healthy empty one are indistinguishable to it BY CONSTRUCTION. Nx then ' +
      'MISSes every task, executes the target and the job goes GREEN -- with the sidecar, ' +
      'cacheClient, ownTarget and every other clause for this leg still green, because nothing ' +
      'else reads this line. Same standing as cacheClient: these three legs exist for NOTHING ' +
      `BUT the HIT observation, so this is a DELETED CONTROL THAT STILL LOOKS PRESENT. ${RENAME_NOTE}`,
    noIf:
      `${leg} must declare NO job-level if:. Its ubuntu producer carries none, and that is ` +
      'exactly what makes build/typecheck/test PR-eligible -- which in turn is what makes the ' +
      'D-18 proving run possible at all, since `on: schedule` and a push to main are the two ' +
      'vehicles this phase deliberately does not use. Anchored at FOUR spaces so a step-level ' +
      `\`if:\` (eight spaces, inside a \`- \` item) is deliberately not matched. ${RENAME_NOTE}`,
  };
}

describe('ci.yml build-windows job exists and keeps its shape (XOS-04, XOS-08)', () => {
  const {
    presence,
    runsOn,
    needs,
    timeout,
    ownTarget,
    sidecar,
    cacheClient,
    cacheObservation,
    readOnlyLeg,
    gatedCount,
    countShape,
    backendToken,
    noIf,
  } = windowsLegReasons('build-windows', 'build', 'build');

  // POSITIVE CONTROL, and it comes FIRST for the same reason every other control in this file
  // does: the no-`if:` clause at the end is a `not.toMatch`, which an empty or mis-extracted
  // block satisfies trivially. `jobBlock` THROWS on an absent job key, so this clause is
  // simultaneously the presence guard and the extraction control.
  //
  // THE `\|` AND `\.` ARE LOAD-BEARING, and their absence made this needle an ALTERNATION
  // rather than a tightening. Unescaped, `/^ {10}npm run build 2>&1 | tee build-nx.log$/`
  // reads as `(^ {10}npm run build 2>&1 )` OR `( tee build-nx.log$)` -- so it was satisfied by
  // `npm run typecheck 2>&1 | tee build-nx.log` (wrong target, right logfile), by a bare
  // ` tee build-nx.log` tail with no `npm run` at all, and by the prefix alone with the tee
  // dropped for a `> /dev/null`. MEASURED on all four shapes before and after the escape: the
  // escaped form rejects every one and still matches all three real ci.yml lines. That is what
  // makes the target-to-logfile PAIRING the ownTarget reason claims to pin actually pinned --
  // the two `not.toMatch` clauses below only exclude the other two targets' run lines, and
  // neither of them reads the logfile name.
  it('scopes to a real build-windows job block that runs npm run build', () => {
    const block = jobBlock('build-windows');

    expect(block, presence).toMatch(
      /^ {10}npm run build 2>&1 \| tee build-nx\.log$/m,
    );
  });

  it('runs on the windows-11-arm runner -- the CONSUMER half of XOS-04', () => {
    const block = jobBlock('build-windows');

    expect(block, runsOn).toMatch(/^ {4}runs-on: windows-11-arm$/m);
  });

  it('waits on the ubuntu build job as a bare single-producer needs: scalar (XOS-08)', () => {
    const block = jobBlock('build-windows');

    expect(block, needs).toMatch(/^ {4}needs: build$/m);
  });

  it('carries timeout-minutes: 15 -- generic hang insurance, like every other job', () => {
    const block = jobBlock('build-windows');

    expect(block, timeout).toMatch(/^ {4}timeout-minutes: 15$/m);
  });

  it('runs the build target its NAME claims, and neither of the other two', () => {
    const block = jobBlock('build-windows');

    expect(block, ownTarget).toMatch(
      /^ {10}npm run build 2>&1 \| tee build-nx\.log$/m,
    );
    expect(block, ownTarget).not.toMatch(/^ {10}npm run typecheck 2>&1/m);
    expect(block, ownTarget).not.toMatch(/^ {10}npm run test 2>&1/m);
  });

  it('carries the sidecar dogfood block, without which it cannot exhibit a HIT', () => {
    const block = jobBlock('build-windows');

    expect(block, sidecar).toMatch(/^ {6}- uses: \.\/start-cache-server$/m);
    expect(block, sidecar).toMatch(/^ {6}- cancel: cache-server$/m);
  });

  // THE CLAUSE THAT GUARDS WHAT ACTUALLY MAKES THIS LEG A CONSUMER, and it is separate
  // from the sidecar clause above rather than folded into it because the two fail for
  // different reasons and a combined assertion would report them identically. The sidecar
  // clause's own failure message states the stake correctly -- "without the sidecar the leg
  // has no remote cache client at all" -- but a RUNNING SIDECAR is not what gives Nx a
  // remote cache client. The two NX_SELF_HOSTED_REMOTE_CACHE_* values written to
  // $GITHUB_ENV are, and ci.yml's own comment above these steps concedes there was no other
  // guard: "This is an unguarded invariant: nothing fails if it drifts."
  //
  // MEASURED, not argued: deleting the whole "Pre-set the Nx cache client vars" step from a
  // leg leaves the `- uses: ./start-cache-server` clause, the `- cancel: cache-server`
  // clause and every other clause for that leg GREEN, while Nx runs with the local cache
  // only, MISSes on a fresh runner, executes the target, and the job passes. The readiness
  // poll has the same standing: without it the Nx step can start before the sidecar binds,
  // every request fails, best-effort read degradation kicks in, and the leg is green having
  // cached nothing. Both mutations were run against these three regexes before this clause
  // was committed; both go red here and nowhere else (WR-06).
  //
  // The same three regexes are repeated verbatim in the typecheck-windows and test-windows
  // describes below, without this comment -- the file's existing convention, matching
  // ci.yml's own "only build's copy carries extra comments".
  it('pre-sets the Nx remote cache client vars and waits for the port, without which the sidecar is inert', () => {
    const block = jobBlock('build-windows');

    expect(block, cacheClient).toMatch(
      /^\s+echo "NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http:\/\/127\.0\.0\.1:3000" >> "\$GITHUB_ENV"$/m,
    );
    expect(block, cacheClient).toMatch(
      /^\s+echo "NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=\$\{token\}" >> "\$GITHUB_ENV"$/m,
    );
    expect(block, cacheClient).toMatch(
      /^ {6}- name: Wait for the loopback sidecar$/m,
    );
  });

  // THE FOURTH MECHANISM, and the one the three clauses above leave open. The step can
  // carry its sidecar, its two NX_* writes and its readiness poll and STILL cache nothing,
  // because none of them reach the token the sidecar's backend selection depends on.
  // MEASURED the same way the cacheClient clause was: deleting the `env:` block from a
  // leg's `- uses: ./start-cache-server` step leaves every other clause for that leg GREEN.
  it('tees its Nx output and records the remote-cache count, so the leg observes something', () => {
    const block = jobBlock('build-windows');

    expect(block, cacheObservation).toMatch(
      /^ {6}- name: Run the build target and tee its output$/m,
    );
    expect(block, cacheObservation).toMatch(
      /^ {6}- name: Gate on the cross-OS remote-cache label count for this leg$/m,
    );
  });

  // THE PREMISE OF THE GATE, asserted separately from the gate itself because the two fail
  // for different reasons and only one of them is visible in a failing job. Without this
  // line the leg is a WRITER, and a writer's own count is launderable: it MISSes, executes,
  // SAVEs its entry, and the next re-run of the same commit HITs what it saved and takes the
  // floor below green with cross-OS reuse dead. With it, no windows-produced entry for these
  // hashes can exist at all, so a label is NECESSARILY the ubuntu producer's -- and that is
  // INDUCTIVE, holding of every run rather than of this one.
  //
  // Same regex shape as the two cacheClient writes above, and for the same reason: anchored
  // at the leg's real indent, with `>> "$GITHUB_ENV"` pinned at end-of-line so a mention in
  // some other position cannot satisfy it. Non-vacuity is free here in one direction --
  // `codeLines` is comment-stripped, so a knob named only in a `#` line cannot pass.
  //
  // MEASURED, not argued (MUTATION 2 of 3, run before this clause was committed): deleting
  // the single `echo "CACHE_READ_ONLY=1"` line from typecheck-windows' pre-set step reddens
  // this clause for typecheck-windows ALONE -- one failure in the file. The two cacheClient
  // writes and the readiness-poll clause for that SAME leg stay GREEN, which is the reading
  // that matters: the two clauses share a step, so without this measurement this one could
  // be riding on its neighbour. Both other legs stay green too, so the clause is per-leg.
  it('declines the write via CACHE_READ_ONLY, which is what makes the gate below sound', () => {
    const block = jobBlock('build-windows');

    expect(block, readOnlyLeg).toMatch(
      /^\s+echo "CACHE_READ_ONLY=1" >> "\$GITHUB_ENV"$/m,
    );
  });

  // THE VACUITY TRAP THIS CLAUSE IS BUILT AROUND, and it is live rather than hypothetical:
  // this job block contains a bare `exit 1` in the "Wait for the loopback sidecar" readiness
  // poll, that line is not a comment so the strip keeps it, and `expect(block).toMatch(/exit
  // 1/)` was GREEN before this phase changed anything. An `exit 1` is not evidence of a gate.
  // The COMPARISON is the load-bearing needle, so it is matched literally and anchored at the
  // ten-space script indent.
  //
  // The absence check is the revert detector, and it reads the printed record rather than the
  // rationale comment on purpose: `codeLines` strips every `#` line, so a comment lock here
  // would be vacuous by construction, while the echo is CODE and is also the only one of the
  // two an operator ever sees.
  //
  // MEASURED, not argued, in the two directions a gate can be lost, both run before this
  // clause was committed.
  // MUTATION 1 of 3, deleting the whole gate step from build-windows: exactly two clauses
  // redden, both for build-windows -- this one, and the cacheObservation clause that pins the
  // step's name. The positive control, the `needs:` anchor, the tee'd-run clause, the sidecar
  // and cacheClient clauses and both other legs all stay GREEN. That run is also the direct
  // disproof of the `exit 1` trap: the mutated block has NO gate of any kind and still
  // contains the readiness poll's `exit 1`, so an `/exit 1/` clause would have stayed green
  // over a leg with the gate deleted.
  // MUTATION 3 of 3, changing this leg's `-lt 1` to a comparison that can never fire (run on
  // test-windows): that leg's copy of this clause reddens ALONE. Nothing else moves -- in
  // particular the readOnlyLeg clause above stays green, so the knob and the comparison are
  // independently pinned rather than one covering for the other.
  //
  // THE COMPARISON WITHOUT ITS `exit 1` IS AN ANNOTATION, NOT A GATE, and pinning only the
  // `if` line left exactly that gap. A `::error::` workflow command creates an annotation and
  // does NOT fail the step, so deleting the `exit 1` below it -- the obvious response to a
  // gate an operator believes is flaky -- leaves all three legs GREEN on a ZERO cross-OS
  // restore count while still printing "GATED at a floor of 1". None of the three recorded
  // mutations covers it: MUTATION 1 deletes the whole step and MUTATION 3 edits the operand,
  // and neither removes the exit.
  //
  // The rejection of a BARE `/exit 1/` needle above is correct and stands -- the readiness
  // poll supplies one. What was missing is the form that is not vacuous: a gap BOUNDED to the
  // branch's single message line, which is the shape the M4 o3-witness clause already uses
  // 470 lines up, plus the `exit 0` absence check it pairs with. `ci.yml` contains ZERO
  // `exit 0` (measured over the whole file), so the negative needle is available here for the
  // same reason it is there: every exit in these legs is a verdict, and a gate has no
  // legitimate success exit -- the passing path falls off the end of the step.
  it('gates that count at a floor of 1 rather than only printing it (XOS-09)', () => {
    const block = jobBlock('build-windows');

    expect(block, gatedCount).toMatch(
      /^ {10}if \[ "\$\{count\}" -lt 1 \]; then\n[^\n]*\n {12}exit 1$/m,
    );
    expect(block, gatedCount).not.toMatch(/exit 0\b/);
    expect(block, gatedCount).not.toContain('RECORDED, never gated');
  });

  // THE COMPARISON ABOVE IS ONLY A GATE ON A NUMBER, and neither the clause above nor any
  // other on this leg reads the two lines that make it one. Both needles are pinned as
  // WHOLE LINES so a partial revert (dropping `-a` while keeping the shape check, or the
  // reverse) reddens: each closes a different fail-OPEN route to the same green.
  // The `case` gap is bounded to ONE line -- the branch's own message -- for the reason
  // the M4 o3-witness clause records: an unbounded non-greedy gap walks past its own
  // block and satisfies itself from an unrelated `exit 1` further down the job.
  it('proves the count is a decimal and reads the log as TEXT, so the gate cannot pass unevaluated (XOS-09)', () => {
    const block = jobBlock('build-windows');

    expect(block, countShape).toMatch(
      /^ {10}count=\$\(\{ grep -a -o -F '\[remote cache\]' build-nx\.log \|\| true; \} \| wc -l \| tr -d '\[:space:\]'\)$/m,
    );
    expect(block, countShape).toMatch(
      /^ {10}case "\$\{count\}" in\n {12}''\|\*\[!0-9\]\*\)\n[^\n]*\n {14}exit 1$/m,
    );
  });

  it('passes GITHUB_TOKEN into the sidecar step, without which the backend is a memory stub', () => {
    const block = jobBlock('build-windows');

    expect(block, backendToken).toMatch(
      /^ {10}GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}$/m,
    );
  });

  it('declares NO job-level if:, so the leg stays PR-eligible', () => {
    const block = jobBlock('build-windows');

    expect(block, noIf).not.toMatch(/^ {4}if:/m);
  });
});

describe('ci.yml typecheck-windows job exists and keeps its shape (XOS-04, XOS-08)', () => {
  const {
    presence,
    runsOn,
    needs,
    timeout,
    ownTarget,
    sidecar,
    cacheClient,
    cacheObservation,
    readOnlyLeg,
    gatedCount,
    countShape,
    backendToken,
    noIf,
  } = windowsLegReasons('typecheck-windows', 'typecheck', 'typecheck');

  it('scopes to a real typecheck-windows job block that runs npm run typecheck', () => {
    const block = jobBlock('typecheck-windows');

    expect(block, presence).toMatch(
      /^ {10}npm run typecheck 2>&1 \| tee typecheck-nx\.log$/m,
    );
  });

  it('runs on the windows-11-arm runner -- the CONSUMER half of XOS-04', () => {
    const block = jobBlock('typecheck-windows');

    expect(block, runsOn).toMatch(/^ {4}runs-on: windows-11-arm$/m);
  });

  it('waits on the ubuntu typecheck job as a bare single-producer needs: scalar (XOS-08)', () => {
    const block = jobBlock('typecheck-windows');

    expect(block, needs).toMatch(/^ {4}needs: typecheck$/m);
  });

  it('carries timeout-minutes: 15 -- generic hang insurance, like every other job', () => {
    const block = jobBlock('typecheck-windows');

    expect(block, timeout).toMatch(/^ {4}timeout-minutes: 15$/m);
  });

  it('runs the typecheck target its NAME claims, and neither of the other two', () => {
    const block = jobBlock('typecheck-windows');

    expect(block, ownTarget).toMatch(
      /^ {10}npm run typecheck 2>&1 \| tee typecheck-nx\.log$/m,
    );
    expect(block, ownTarget).not.toMatch(/^ {10}npm run build 2>&1/m);
    expect(block, ownTarget).not.toMatch(/^ {10}npm run test 2>&1/m);
  });

  it('carries the sidecar dogfood block, without which it cannot exhibit a HIT', () => {
    const block = jobBlock('typecheck-windows');

    expect(block, sidecar).toMatch(/^ {6}- uses: \.\/start-cache-server$/m);
    expect(block, sidecar).toMatch(/^ {6}- cancel: cache-server$/m);
  });

  it('pre-sets the Nx remote cache client vars and waits for the port, without which the sidecar is inert', () => {
    const block = jobBlock('typecheck-windows');

    expect(block, cacheClient).toMatch(
      /^\s+echo "NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http:\/\/127\.0\.0\.1:3000" >> "\$GITHUB_ENV"$/m,
    );
    expect(block, cacheClient).toMatch(
      /^\s+echo "NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=\$\{token\}" >> "\$GITHUB_ENV"$/m,
    );
    expect(block, cacheClient).toMatch(
      /^ {6}- name: Wait for the loopback sidecar$/m,
    );
  });

  it('tees its Nx output and records the remote-cache count, so the leg observes something', () => {
    const block = jobBlock('typecheck-windows');

    expect(block, cacheObservation).toMatch(
      /^ {6}- name: Run the typecheck target and tee its output$/m,
    );
    expect(block, cacheObservation).toMatch(
      /^ {6}- name: Gate on the cross-OS remote-cache label count for this leg$/m,
    );
  });

  it('declines the write via CACHE_READ_ONLY, which is what makes the gate below sound', () => {
    const block = jobBlock('typecheck-windows');

    expect(block, readOnlyLeg).toMatch(
      /^\s+echo "CACHE_READ_ONLY=1" >> "\$GITHUB_ENV"$/m,
    );
  });

  it('gates that count at a floor of 1 rather than only printing it (XOS-09)', () => {
    const block = jobBlock('typecheck-windows');

    expect(block, gatedCount).toMatch(
      /^ {10}if \[ "\$\{count\}" -lt 1 \]; then\n[^\n]*\n {12}exit 1$/m,
    );
    expect(block, gatedCount).not.toMatch(/exit 0\b/);
    expect(block, gatedCount).not.toContain('RECORDED, never gated');
  });

  it('proves the count is a decimal and reads the log as TEXT, so the gate cannot pass unevaluated (XOS-09)', () => {
    const block = jobBlock('typecheck-windows');

    expect(block, countShape).toMatch(
      /^ {10}count=\$\(\{ grep -a -o -F '\[remote cache\]' typecheck-nx\.log \|\| true; \} \| wc -l \| tr -d '\[:space:\]'\)$/m,
    );
    expect(block, countShape).toMatch(
      /^ {10}case "\$\{count\}" in\n {12}''\|\*\[!0-9\]\*\)\n[^\n]*\n {14}exit 1$/m,
    );
  });

  it('passes GITHUB_TOKEN into the sidecar step, without which the backend is a memory stub', () => {
    const block = jobBlock('typecheck-windows');

    expect(block, backendToken).toMatch(
      /^ {10}GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}$/m,
    );
  });

  it('declares NO job-level if:, so the leg stays PR-eligible', () => {
    const block = jobBlock('typecheck-windows');

    expect(block, noIf).not.toMatch(/^ {4}if:/m);
  });
});

describe('ci.yml test-windows job exists and keeps its shape (XOS-04, XOS-08)', () => {
  const {
    presence,
    runsOn,
    needs,
    timeout,
    ownTarget,
    sidecar,
    cacheClient,
    cacheObservation,
    readOnlyLeg,
    gatedCount,
    countShape,
    backendToken,
    noIf,
  } = windowsLegReasons('test-windows', 'test', 'test');

  it('scopes to a real test-windows job block that runs npm run test', () => {
    const block = jobBlock('test-windows');

    expect(block, presence).toMatch(
      /^ {10}npm run test 2>&1 \| tee test-nx\.log$/m,
    );
  });

  it('runs on the windows-11-arm runner -- the CONSUMER half of XOS-04', () => {
    const block = jobBlock('test-windows');

    expect(block, runsOn).toMatch(/^ {4}runs-on: windows-11-arm$/m);
  });

  it('waits on the ubuntu test job as a bare single-producer needs: scalar (XOS-08)', () => {
    const block = jobBlock('test-windows');

    expect(block, needs).toMatch(/^ {4}needs: test$/m);
  });

  it('carries timeout-minutes: 15 -- generic hang insurance, like every other job', () => {
    const block = jobBlock('test-windows');

    expect(block, timeout).toMatch(/^ {4}timeout-minutes: 15$/m);
  });

  it('runs the test target its NAME claims, and neither of the other two', () => {
    const block = jobBlock('test-windows');

    expect(block, ownTarget).toMatch(
      /^ {10}npm run test 2>&1 \| tee test-nx\.log$/m,
    );
    expect(block, ownTarget).not.toMatch(/^ {10}npm run build 2>&1/m);
    expect(block, ownTarget).not.toMatch(/^ {10}npm run typecheck 2>&1/m);
  });

  it('carries the sidecar dogfood block, without which it cannot exhibit a HIT', () => {
    const block = jobBlock('test-windows');

    expect(block, sidecar).toMatch(/^ {6}- uses: \.\/start-cache-server$/m);
    expect(block, sidecar).toMatch(/^ {6}- cancel: cache-server$/m);
  });

  it('pre-sets the Nx remote cache client vars and waits for the port, without which the sidecar is inert', () => {
    const block = jobBlock('test-windows');

    expect(block, cacheClient).toMatch(
      /^\s+echo "NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http:\/\/127\.0\.0\.1:3000" >> "\$GITHUB_ENV"$/m,
    );
    expect(block, cacheClient).toMatch(
      /^\s+echo "NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=\$\{token\}" >> "\$GITHUB_ENV"$/m,
    );
    expect(block, cacheClient).toMatch(
      /^ {6}- name: Wait for the loopback sidecar$/m,
    );
  });

  it('tees its Nx output and records the remote-cache count, so the leg observes something', () => {
    const block = jobBlock('test-windows');

    expect(block, cacheObservation).toMatch(
      /^ {6}- name: Run the test target and tee its output$/m,
    );
    expect(block, cacheObservation).toMatch(
      /^ {6}- name: Gate on the cross-OS remote-cache label count for this leg$/m,
    );
  });

  it('declines the write via CACHE_READ_ONLY, which is what makes the gate below sound', () => {
    const block = jobBlock('test-windows');

    expect(block, readOnlyLeg).toMatch(
      /^\s+echo "CACHE_READ_ONLY=1" >> "\$GITHUB_ENV"$/m,
    );
  });

  it('gates that count at a floor of 1 rather than only printing it (XOS-09)', () => {
    const block = jobBlock('test-windows');

    expect(block, gatedCount).toMatch(
      /^ {10}if \[ "\$\{count\}" -lt 1 \]; then\n[^\n]*\n {12}exit 1$/m,
    );
    expect(block, gatedCount).not.toMatch(/exit 0\b/);
    expect(block, gatedCount).not.toContain('RECORDED, never gated');
  });

  it('proves the count is a decimal and reads the log as TEXT, so the gate cannot pass unevaluated (XOS-09)', () => {
    const block = jobBlock('test-windows');

    expect(block, countShape).toMatch(
      /^ {10}count=\$\(\{ grep -a -o -F '\[remote cache\]' test-nx\.log \|\| true; \} \| wc -l \| tr -d '\[:space:\]'\)$/m,
    );
    expect(block, countShape).toMatch(
      /^ {10}case "\$\{count\}" in\n {12}''\|\*\[!0-9\]\*\)\n[^\n]*\n {14}exit 1$/m,
    );
  });

  it('passes GITHUB_TOKEN into the sidecar step, without which the backend is a memory stub', () => {
    const block = jobBlock('test-windows');

    expect(block, backendToken).toMatch(
      /^ {10}GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}$/m,
    );
  });

  it('declares NO job-level if:, so the leg stays PR-eligible', () => {
    const block = jobBlock('test-windows');

    expect(block, noIf).not.toMatch(/^ {4}if:/m);
  });
});

/**
 * T-13-05-D1's SCOPE LIMIT, and the ONE direction the three `gatedCount` clauses above
 * cannot see. Those three read `not.toContain('RECORDED, never gated')` per Windows leg,
 * which catches a leg quietly REVERTING to record-without-gate -- the UNDER-sweep. The
 * threat this phase actually registered was the opposite one: XOS-09 converted three
 * `[remote cache]` records into gates and deliberately left TWO records unconverted, and
 * an over-eager sweep of the marker string would have deleted two claims that are still
 * TRUE.
 *
 * Until this block, that scope limit was stated in the plan as "asserted mechanically"
 * and asserted NOWHERE. `13-SECURITY.md` caught it: both survivors were intact and
 * correct, but deleting either reddened nothing -- the declared control was absent and
 * only its current outcome was right. That is the same defect class this phase exists to
 * remove (a guard that reads as coverage without being it), so it is closed here rather
 * than accepted.
 *
 * THE TWO SURVIVORS ARE TRUE, which is why they must not be swept:
 *   1. `runner.debug` -- a recorded FACT about the run's own logging, not a cache
 *      observation. There is no floor it could be compared against.
 *   2. the `integration` leg's per-OS count -- that job still SAVES, so its count is
 *      exactly the launderable number XOS-09 removed from the other three. Gating it
 *      would re-introduce the confound rather than close it.
 *
 * EACH IS IDENTIFIED BY ITS OWN SURROUNDING TOKEN (`RUNNER_DEBUG_OBSERVED`, `LEG_OS`)
 * rather than by the shared marker, so the two cannot cover for each other: a sweep that
 * deletes one leaves the other's clause green and reddens exactly one case. Both live in
 * the `integration` job block, so both are scoped to it and neither can be satisfied by a
 * Windows leg.
 *
 * COUNT PINNED EXACTLY, never a floor -- the same rule `MASKED_TOKEN_SITES` records
 * below. "Exactly two survivors" is the registered claim, so a floor of 2 would be
 * satisfied by a third record appearing somewhere new, which is the under-sweep direction
 * leaking back in through a job the per-leg clauses do not read. MEASURED against the
 * comment-stripped file, not predicted: `ci.yml` carries the marker on two `echo` lines
 * and in no comment, so the stripped count and the raw count agree at 2 today.
 */
const RECORD_ONLY_SURVIVOR_SITES = 2;

describe('ci.yml keeps exactly the two record-only diagnostics XOS-09 did not convert (T-13-05-D1)', () => {
  it('keeps the runner.debug record, which has no floor to be gated against', () => {
    const block = jobBlock('integration');

    expect(
      block,
      'The `runner.debug` record-only diagnostic is gone from the integration job. ' +
        "XOS-09 converted the three Windows legs' [remote cache] records into gates and " +
        'left this one deliberately unconverted: it reports whether step debug logging is ' +
        'active, which is a fact about the RUN and not a cache observation, so there is no ' +
        'floor it could be compared against. Deleting it is the OVER-sweep direction of ' +
        'T-13-05-D1 -- the three per-leg `not.toContain` clauses above are silent on it, so ' +
        'without this clause the deletion reddens nothing at all.',
    ).toMatch(
      /^ {10}echo "runner\.debug=\$\{RUNNER_DEBUG_OBSERVED:-<unset>\} -- RECORDED, never gated"$/m,
    );
  });

  it('keeps the integration leg per-OS count, which is still launderable and must NOT be gated', () => {
    const block = jobBlock('integration');

    expect(
      block,
      "The integration leg's per-OS [remote cache] count is gone from the integration job. " +
        'It is the second deliberate survivor, and it is ungated for a REASON rather than by ' +
        'omission: unlike the three Windows legs, this job still SAVES, so its count is ' +
        'exactly the launderable number XOS-09 removed elsewhere -- a broken cross-OS restore ' +
        'makes it MISS, execute and SAVE, and a re-run of the same commit then HITs that ' +
        'self-produced entry. Gating this one would re-introduce the confound the phase ' +
        'removed. The record stays, and it stays ungated.',
    ).toMatch(
      /^ {10}echo "remote-cache label occurrences on \$\{LEG_OS\}: \$\{count\} -- RECORDED, never gated"$/m,
    );
  });

  it('carries the marker on exactly two lines, so neither an over-sweep nor a new ungated record passes', () => {
    const sites = codeLines.filter((line) =>
      line.includes('RECORDED, never gated'),
    );

    expect(
      sites,
      `Expected exactly ${RECORD_ONLY_SURVIVOR_SITES} record-only diagnostics in the ` +
        'comment-stripped `ci.yml`. FEWER means an over-sweep deleted a claim that is still ' +
        'true (T-13-05-D1). MORE means a new [remote cache] record landed UNGATED somewhere ' +
        'the three per-leg clauses do not read, which is the launderable shape XOS-09 exists ' +
        'to remove. Pinned exactly rather than as a floor for the same reason ' +
        '`MASKED_TOKEN_SITES` is: a floor of 2 is satisfied by the two survivors alone and ' +
        'would let a third record appear in silence. If a record is legitimately added or ' +
        'converted, RE-MEASURE and update this constant HERE in the same commit.',
    ).toHaveLength(RECORD_ONLY_SURVIVOR_SITES);
  });
});

/**
 * T-12-05's ORDERING, which was correct in all eight sidecar blocks and guarded in
 * NONE of them until this clause. `12-SECURITY.md`'s `## Residual 1` names it and
 * hands over this exact shape: the mask's index must be less than the token write's
 * index. It is recorded there as a RATCHET rather than a static gap -- Phase 11's
 * audit logged it as PRE-EXISTING surface at five masked-token sites, and Phase 12
 * took the file to EIGHT by copying the sidecar block onto `build-windows`,
 * `typecheck-windows` and `test-windows`. Three of the eight are this phase's.
 *
 * WHAT IS AT STAKE, stated as the consequence rather than the mechanism: the token is
 * a per-process loopback bearer, but it is written to `$GITHUB_ENV`, so it is live in
 * every subsequent step's environment and reachable by captured terminal output on a
 * PUBLIC repository. `::add-mask::` redacts only from the moment it is PROCESSED, so
 * a mask that lands AFTER its write leaves a window in which the value is live and
 * unregistered. Until this clause, the protection was carried entirely by D-03's
 * verbatim-copy discipline across eight hand-maintained copies -- one careless
 * "cleanup" reordering away from a real leak, with the three `cacheClient` clauses
 * above and all 24 other Windows-leg clauses still green, because nothing read the
 * mask line at all.
 *
 * WHOLE-FILE AND PAIRWISE, deliberately, rather than the per-leg `jobBlock` scoping
 * every other clause in this file uses. The usual reason for scoping does not apply:
 * a file-wide `toContain('::add-mask::')` would be vacuous because the token appears
 * eight times, but a PAIRWISE ORDERING WITH COUNT EQUALITY is the stronger claim, not
 * the weaker one -- it says every mask/write pair in the file is correctly ordered,
 * which no per-job clause can say, and it cannot be satisfied by an unrelated
 * occurrence. It also covers the five PRE-EXISTING sites that no phase owns, which a
 * three-leg version would leave exactly as unguarded as they are today.
 *
 * The pairing is sound in both failure directions. Delete a mask and the counts
 * diverge; move a mask past its own write and that pair's comparison inverts.
 *
 * COUNT PINNED EXACTLY, never a `>= 1` floor. A floor is satisfied by the first pair,
 * so seven blocks could lose their mask with this clause still green -- the same
 * half-locking defect WR-09 and CR-01 both landed on in this phase. MEASURED against
 * the comment-stripped file, not predicted. If a job legitimately gains or loses a
 * sidecar block, RE-MEASURE and update this count HERE in the same commit.
 *
 * `codeLines` is comment-stripped, which is load-bearing here in the usual direction:
 * `ci.yml` mentions `::add-mask::` in three separate prose comments explaining the
 * rule, so a raw read would count 11 and the pairing would be garbage.
 */
/**
 * THE OTHER DIRECTION OF THE SAME KNOB, and the one no clause read. The three per-leg
 * `readOnlyLeg` clauses assert `CACHE_READ_ONLY` is PRESENT on each Windows consumer. What
 * makes those three gates SOUND is the complementary fact -- that the ubuntu PRODUCERS do
 * not carry it -- and `ci.yml` states that premise in prose at the build-windows block
 * ("one line the ubuntu producers deliberately do not carry") while nothing enforced it.
 *
 * WHAT A SPREAD COSTS, stated as the consequence. Copy the knob into the ubuntu
 * build/typecheck/test pre-set step during a sweep, or hoist the three copies to a
 * workflow-level `env:` block -- the natural "dedupe this" cleanup -- and every producer
 * stops writing. The Actions cache stops being repopulated on the default branch, the
 * publish job enumerates less each month, and the Releases mirror quietly stops being
 * seeded.
 *
 * THE WINDOWS GATES DO NOT CATCH IT, which is why this clause is not redundant with them.
 * Since the Case-B widening a leg legitimately restores from the DEFAULT-branch scope, so an
 * entry written by an earlier run keeps all three floor-of-1 gates green until the eviction
 * window closes -- and all three `readOnlyLeg` clauses stay green too, because each is
 * block-scoped presence only and says nothing about any other job.
 *
 * COUNT PINNED EXACTLY, never a floor, for the reason `MASKED_TOKEN_SITES` and
 * `RECORD_ONLY_SURVIVOR_SITES` are: a floor of 3 is satisfied by the three consumers alone
 * and would let a fourth site appear in silence, which is the whole failure mode. FEWER
 * means a consumer lost its knob and its gate went unsound. MEASURED against the
 * comment-stripped file -- 3 stripped, 9 raw -- not predicted, and the strip is load-bearing
 * here in the usual direction: six of the nine raw occurrences are prose explaining the
 * rule. If a leg is legitimately added or removed, RE-MEASURE and update this constant HERE
 * in the same commit.
 */
const READ_ONLY_LEG_SITES = 3;

const MASKED_TOKEN_SITES = 8;

/**
 * THE ORDERING THE KNOB DEPENDS ON, which is exactly one line wide and was guarded by
 * nothing. `$GITHUB_ENV` is processed only when the WRITING STEP COMPLETES, so the echo has
 * to land in a step that finishes BEFORE the sidecar starts. In `ci.yml` those are adjacent
 * lines: the echo closes the pre-set step and `- uses: ./start-cache-server` opens the next.
 *
 * MOVE THE ECHO BELOW THE SIDECAR AND EVERY CLAUSE IN THIS FILE STAYS GREEN. The three
 * `readOnlyLeg` clauses match `/^\s+echo "CACHE_READ_ONLY=1" >> "\$GITHUB_ENV"$/m` against
 * the whole job block with a `\s+` prefix, so they are satisfied from ANY step at ANY indent;
 * the new site-count clause below still counts three; and all three `gatedCount` clauses
 * still find their comparison. Meanwhile the sidecar never sees the knob, `selectBackend`
 * takes the writable branch, and the leg is a WRITER again -- so the gate keeps printing
 * "GATED at a floor of 1" while being satisfiable by a self-produced entry on a re-run.
 * That is precisely the defect XOS-09 was opened to close, reachable by moving one line.
 *
 * SCOPED PER JOB BLOCK, not paired across the whole file, and the distinction is load-
 * bearing rather than stylistic. `ci.yml` carries EIGHT `- uses: ./start-cache-server` steps
 * against three knob writes -- the other five belong to legs that legitimately WRITE -- so a
 * whole-file positional pairing compares a leg's knob against some unrelated job's sidecar.
 * Worse, it would still PASS the regression it exists to catch: move a knob below its own
 * sidecar and the next job's sidecar is still further down the file, so a "first sidecar
 * after this knob" pairing stays satisfied. Within one job block the comparison is exact.
 *
 * INDEX COMPARISON, not a `toMatch`, for the reason T-12-05's mask clause records:
 * order-within-a-block is not something a single regex can read. Both directions fail loud --
 * a deleted echo or a deleted sidecar trips its own positive control (-1), and a reordered
 * pair inverts the comparison.
 *
 * A RUNTIME PROBE WOULD BE STRONGER AND IS DELIBERATELY NOT USED. A `curl -X PUT` expecting
 * the contract's 403 would observe the CONSTRUCTED backend rather than the YAML that selects
 * it. But on the failure it exists to detect the backend is WRITABLE, so the probe itself
 * would STORE an entry under a valid server-produced key -- which `publish-mirror` would
 * then enumerate and mirror to the public Releases shard. A control that corrupts the store
 * on exactly the run it fires is not worth the strength. The behavioural half is covered
 * instead by select-backend.spec.ts, which drives the real `selectBackend` on the real knob.
 */
/**
 * NO WORKFLOW EXPRESSION MAY APPEAR INSIDE A `run:` BODY -- and this clause exists because
 * violating it took the ENTIRE workflow down, not because it is untidy.
 *
 * GitHub TEMPLATES a `run:` body before the shell ever sees it, so a brace-template
 * expression is evaluated even inside a shell COMMENT. Status functions (`cancelled()`,
 * `success()`, `failure()`) exist only in an `if:`, so one commented `if: <expr>` reference
 * in a run body made GitHub reject the whole file -- "Unrecognized function: 'cancelled'",
 * Invalid workflow file, ZERO jobs created, and no `pull_request` run at all. MEASURED on
 * run 30852881995: the failure surfaces as a startup failure whose run NAME is the file path
 * rather than `CI`, because GitHub could not read `name:` either.
 *
 * NOTHING ELSE IN THE TREE CATCHES IT. `codeLines` strips lines whose TRIMMED form starts
 * with `#`, which is exactly what a shell comment inside a run body looks like -- so every
 * other clause in this file is blind to run-body comments by construction. YAML parses fine
 * (the body is an opaque block scalar), so `format:check`, `lint` and every local target stay
 * green. The first signal is CI refusing to start, after the push.
 *
 * ZERO IS ALSO THE PROJECT'S SECURITY POSTURE, so the count is not merely convenient: this
 * workflow deliberately routes untrusted values through the step ENVIRONMENT rather than
 * interpolating them into scripts (the o3-witness block's own BASH_ENV injection analysis),
 * and an expression templated into a shell body is the canonical script-injection sink. The
 * two reasons point the same way, which is why this is a flat zero rather than an allowlist.
 *
 * SCOPED TO RUN BODIES, not grepped file-wide, and that scoping is REQUIRED rather than
 * tidy: `ci.yml` legitimately carries brace-template expressions in `if:`, `env:` and `with:`
 * values, and THREE of its YAML comments quote one while explaining a rule. A file-wide
 * needle would be red on a correct file, which is how a reader talks themselves into
 * deleting a guard.
 *
 * HAND-ROLLED BLOCK-SCALAR SCAN, deliberately, rather than a YAML parser: neither `js-yaml`
 * nor `yaml` is a declared dependency of this workspace (both are merely transitive), and no
 * spec in the tree parses YAML today. Adding a parser dependency to read one file would cost
 * more than the scan, which is exact for the only shape this file uses -- `run: |` followed
 * by lines indented deeper than the `run:` key itself.
 */

/**
 * Every line inside a `run:` block scalar, with the job it belongs to. A block scalar owns
 * every following line that is blank or indented MORE than its own `run:` key, which is the
 * YAML rule and needs no parser to apply. Single-line values are included too, in BOTH
 * spellings -- bare `run: <cmd>` and the dash-prefixed `- run: <cmd>` that is the only form
 * this file actually uses -- because an expression is the same injection sink there.
 */
function runBodyLines(): { job: string; line: string }[] {
  // THE RAW FILE, not `codeLines`. `codeLines` drops every line whose trimmed form starts
  // with `#`, which is precisely what a shell comment inside a run body looks like -- so
  // reading the stripped view here would make this clause blind to the exact defect it
  // exists to catch, and it would pass on the file that took CI down.
  const rawLines = readFileSync(
    new URL('../../../.github/workflows/ci.yml', import.meta.url),
    'utf8',
  ).split('\n');
  const collected: { job: string; line: string }[] = [];
  let job = '<before any job>';

  for (let index = 0; index < rawLines.length; index++) {
    const jobKey = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(rawLines[index]);

    if (jobKey) {
      job = jobKey[1];

      continue;
    }

    // THE OPTIONAL `- ` IS INSIDE GROUP 1, and it has to be, or this scan is blind to the
    // form ci.yml actually uses for one-liners. `/^(\s*)run:/` cannot match
    // `      - run: npm ci`: after `\s*` the next character is `-`, not `r`. Every single-line
    // `run:` in this file is dash-prefixed -- 35 of them -- so the `inline !== ''` branch below
    // was UNREACHABLE and the docstring's claim that single-line values are included was false.
    //
    // MEASURED before and after: collected lines 524 -> 559, of which the 19 `npm ci`
    // one-liners went from 0 to 19; the `set -euo pipefail` positive control is 34 under both;
    // ZERO previously-collected entries are lost; and an injected
    // `- run: echo "<expression>"` goes from 0 offenders to 1 while an expression inside a
    // block-scalar comment is still caught by both. Capturing the whole prefix rather than
    // adding a second group keeps `indent` meaning what it meant -- the column the `run:` key
    // starts at -- so block-scalar body collection is untouched. ci.yml carries zero
    // `- run: |` / `- run: >`, so no body-collection path changes today either.
    const runKey = /^(\s*(?:-\s+)?)run:(.*)$/.exec(rawLines[index]);

    if (!runKey) {
      continue;
    }

    const indent = runKey[1].length;
    const inline = runKey[2].trim();

    if (inline !== '' && inline !== '|' && inline !== '>') {
      collected.push({ job, line: inline });

      continue;
    }

    for (let body = index + 1; body < rawLines.length; body++) {
      const text = rawLines[body];
      const deeper = /^(\s*)\S/.exec(text);

      if (text.trim() !== '' && (!deeper || deeper[1].length <= indent)) {
        break;
      }

      collected.push({ job, line: text });
    }
  }

  return collected;
}
describe('ci.yml keeps workflow expressions OUT of every run: body', () => {
  it('has zero brace-template expressions inside any step script, comments included', () => {
    const body = runBodyLines();
    // Built by concatenation so this needle is not itself an offender when a future guard
    // scans THIS file the same way.
    const template = '${' + '{';
    const offenders = body
      .filter((entry) => entry.line.includes(template))
      .map((entry) => `${entry.job}: ${entry.line.trim()}`);

    // POSITIVE CONTROLS, both needed. An empty offender list is otherwise equally consistent
    // with a broken scan -- a renamed `jobs:` key, a changed indent convention, or a
    // readFileSync pointing at the wrong file -- as with a clean workflow.
    expect(
      body.length,
      'the scan found no `run:` body lines in ci.yml at all, so this clause has no subject',
    ).toBeGreaterThan(100);

    expect(
      body.filter((entry) => entry.line.includes('set -euo pipefail')).length,
      'the scan found no `set -euo pipefail` line, which every scripted step in this file ' +
        'opens with -- so it is not actually reading run bodies',
    ).toBeGreaterThan(10);

    expect(
      offenders,
      'These ci.yml run: bodies contain a workflow brace-template expression. GitHub ' +
        'templates a run body BEFORE the shell sees it, so this is evaluated even in a shell ' +
        'comment -- and a status function like cancelled() does not exist outside an `if:`, ' +
        'which makes GitHub reject the ENTIRE FILE ("Unrecognized function") and start ZERO ' +
        'jobs. It is also the canonical script-injection sink, and this workflow ' +
        'deliberately passes untrusted values through the step environment instead. Name the ' +
        'condition in PROSE inside a run body; put real expressions in `if:`, `env:` or ' +
        '`with:`. Note codeLines strips `#`-leading lines, so no other clause in this file ' +
        'can see a run-body comment.',
    ).toStrictEqual([]);
  });
});

describe('ci.yml starts each sidecar AFTER its leg declined the write (XOS-09, TRUST-14)', () => {
  it.each(['build-windows', 'typecheck-windows', 'test-windows'])(
    '%s writes CACHE_READ_ONLY in a step that COMPLETES before its sidecar step begins',
    (leg) => {
      const block = jobBlock(leg).split('\n');
      const knobAt = block.findIndex((line) =>
        /^\s+echo "CACHE_READ_ONLY=1" >> "\$GITHUB_ENV"$/.test(line),
      );
      const sidecarAt = block.findIndex((line) =>
        /^ {6}- uses: \.\/start-cache-server$/.test(line),
      );

      // POSITIVE CONTROLS FIRST, both needed: two -1s compare equal-and-not-less, so
      // without these the ordering assertion below would report a MISSING knob as a
      // correctly ordered one.
      expect(
        knobAt,
        `${leg} has no CACHE_READ_ONLY write at all, so its floor-of-1 gate is unsound -- ` +
          'see the readOnlyLeg clause for why, and restore the line rather than this clause.',
      ).toBeGreaterThanOrEqual(0);

      expect(
        sidecarAt,
        `${leg} has no \`- uses: ./start-cache-server\` step, so it has no remote cache ` +
          'client and this ordering assertion has no subject.',
      ).toBeGreaterThanOrEqual(0);

      expect(
        knobAt,
        `${leg} starts its sidecar at block line ${sidecarAt} but writes CACHE_READ_ONLY at ` +
          `block line ${knobAt} -- at or AFTER it. $GITHUB_ENV is processed only when the ` +
          'WRITING step completes, so a knob written at or after the sidecar step never ' +
          'reaches the sidecar: selectBackend takes the writable branch, the leg becomes a ' +
          'WRITER, and its floor-of-1 gate is launderable by a re-run again -- while every ' +
          'other clause in this file stays green, because none of them reads the order. The ' +
          'fix is to move the echo back above the sidecar step, never to relax this clause.',
      ).toBeLessThan(sidecarAt);
    },
  );
});

describe('ci.yml keeps the read-only knob on the CONSUMERS only (XOS-09, TRUST-14)', () => {
  it('carries CACHE_READ_ONLY on exactly the three Windows legs, so no producer stops writing', () => {
    const sites = codeLines.filter((line) => line.includes('CACHE_READ_ONLY'));

    expect(
      sites,
      `Expected exactly ${READ_ONLY_LEG_SITES} CACHE_READ_ONLY sites in the comment-stripped ` +
        '`ci.yml` -- one per Windows consumer leg, and NONE on the ubuntu producers. MORE ' +
        'means a producer has been given the knob (a copy-paste sweep, or a "dedupe the three ' +
        'copies" hoist to a workflow-level `env:` block): that producer stops writing, the ' +
        'Actions cache stops being repopulated on the default branch, and the Releases mirror ' +
        'quietly stops being seeded. The three floor-of-1 gates do NOT catch it -- since the ' +
        'Case-B widening a leg legitimately restores from the DEFAULT-branch scope, so an ' +
        'entry from an earlier run keeps them green until eviction. FEWER means a consumer ' +
        'lost its knob, which makes that leg a WRITER and its own gate launderable by a ' +
        're-run. Pinned exactly rather than as a floor for the same reason MASKED_TOKEN_SITES ' +
        'is. If a leg was legitimately added or removed, RE-MEASURE and update ' +
        'READ_ONLY_LEG_SITES in the same commit.',
    ).toHaveLength(READ_ONLY_LEG_SITES);
  });
});

describe('ci.yml masks the sidecar token before writing it (T-12-05)', () => {
  it('every sidecar block registers the token for redaction BEFORE it reaches $GITHUB_ENV', () => {
    const maskAt: number[] = [];
    const writeAt: number[] = [];

    codeLines.forEach((line, index) => {
      if (/^\s+echo "::add-mask::\$\{token\}"$/.test(line)) {
        maskAt.push(index);
      }

      if (
        /^\s+echo "NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=\$\{token\}" >> "\$GITHUB_ENV"$/.test(
          line,
        )
      ) {
        writeAt.push(index);
      }
    });

    // POSITIVE CONTROLS FIRST, and both are needed. Two empty arrays are trivially
    // equal in length and trivially pairwise-ordered, so without these the ordering
    // assertion below is satisfied by a `ci.yml` that masks nothing at all.
    expect(
      writeAt,
      `ci.yml no longer writes NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN to $GITHUB_ENV at ${MASKED_TOKEN_SITES} sites. That variable is what gives Nx a remote cache client; losing a site silently drops that job to local-cache-only, and it also makes the ordering assertion below vacuous. RE-MEASURE and update MASKED_TOKEN_SITES in the same commit if a sidecar block was legitimately added or removed.`,
    ).toHaveLength(MASKED_TOKEN_SITES);

    expect(
      maskAt,
      `ci.yml has ${maskAt.length} \`::add-mask::\` lines for ${writeAt.length} token writes. Every write must be preceded by its own mask: the value is a bearer token written into $GITHUB_ENV on a PUBLIC repository, and ::add-mask:: redacts only from the moment it is processed. A missing mask is a real disclosure, not a tidiness lapse.`,
    ).toHaveLength(writeAt.length);

    // THE ORDERING ITSELF. Compared pair by pair rather than as a whole, so the
    // failure names WHICH block regressed instead of reporting a bare false.
    expect(
      maskAt.map((mask, index) => mask < writeAt[index]),
      `at least one ci.yml sidecar block writes NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN to $GITHUB_ENV BEFORE masking it. mask line indices ${maskAt.join(', ')} against write line indices ${writeAt.join(', ')} (comment-stripped). The masked value is live and unredacted for every log line emitted in that window. The fix is to move the \`echo "::add-mask::\${token}"\` back above the write, never to relax this clause.`,
    ).toEqual(Array<boolean>(MASKED_TOKEN_SITES).fill(true));
  });
});
