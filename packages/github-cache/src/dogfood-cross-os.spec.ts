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
 * -- the same gate that makes VER-06 and OBS-04 unobservable pre-merge, and therefore the
 * edit a reader is most likely to make while believing they are being consistent -- would
 * silently drop the committed bundle's only standing sampler to push-to-`main` only, while
 * every spec in this file and every other ci.yml guard stayed green.
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
        'every push" to push-only, which is exactly the gate that already makes VER-06 and ' +
        'OBS-04 unobservable before a merge.',
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
  // file does: every clause below is a `toMatch`, so a `jobBlock` that returned the WRONG
  // non-empty block would have the six of them asserting about the wrong job. `needs:
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
   * `codeLines` strips every `#` line, so each clause below is asserted against real
   * shell rather than against the comment that explains it -- verified by dumping the
   * stripped block. Five separate cases, not one, because each mechanism survives or
   * falls independently and a combined assertion would report five regressions
   * identically.
   */
  it('compares .key for EXACT equality and filters on ref -- ?key= is a prefix match', () => {
    expect(
      jobBlock('o3-witness'),
      'The witness must compare the returned .key for EXACT string equality AND filter on ' +
        'ref. ?key= is a PREFIX match (measured: `?key=nx-cache-1` returns 40 entries, and ' +
        'a full key minus its last character still returns 2), and ONE hash holds entries ' +
        'on TWO refs, so neither a count nor a key-only match is an existence proof.',
    ).toMatch(/select\(\s*\.key == \$key and \.ref == \$ref\s*\)/);
  });

  it('terminates the cache extraction with // empty, so an absent match is not the string "null"', () => {
    expect(
      jobBlock('o3-witness'),
      'The jq extraction of created_at must be terminated with `// empty`. Without it an ' +
        'absent match yields the literal four-character string `null`, and `[ -z "${created}" ]` ' +
        'against `null` is FALSE -- so the guard would PASS on exactly the absence it exists ' +
        "to detect. This file's own comment names this failure mode explicitly.",
    ).toMatch(/\.created_at\) \/\/ empty/);
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
   * gone and `h_linux` is read inside its one consuming step. The five body clauses above
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
 * AND EVERY CLAUSE IS SCOPED TO `jobBlock(<leg>)`, never to the file. `windows-11-arm` occurs 10
 * times in the COMMENT-STRIPPED `ci.yml` this guard actually reads (25 times in the raw file),
 * so a whole-file `toContain('windows-11-arm')` passes unconditionally whatever these three jobs
 * actually say.
 *
 * WHICH ARTIFACT the number is measured against is not a footnote, and this block previously got
 * it wrong in both directions (WR-07). It said 19, which was (a) measured at author time, BEFORE
 * this phase's own `ci.yml` edit landed, and never re-measured -- these guards were authored RED,
 * so the number was frozen against a tree that did not yet contain the three legs -- and (b) the
 * RAW count, when `codeLines` strips every `#` line, so the reading that supports the vacuity
 * argument is the comment-stripped one. It was 7 stripped / 19 raw at `0251bd3`, and is 10
 * stripped / 25 raw at HEAD. The ARGUMENT holds at any of these numbers; the number is this
 * file's own house standard, which is MEASURED, not predicted. Re-measure BOTH readings when
 * `ci.yml` next changes shape.
 *
 * NO COMMENT-PHRASE ASSERTION BELONGS HERE. `codeLines` strips every `#` line, so a comment lock
 * placed in this file is vacuous by construction; the sidecar-invariant and graph-premise prose
 * locks live in `docs-same-os-claims.spec.ts`, whose read is RAW. Two harnesses, one question
 * each.
 */
const RENAME_NOTE =
  'If the job was legitimately renamed, update this describe in the SAME commit; do not ' +
  'delete the assertion to make the suite green.';

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
      'Asserted against this job block alone: `windows-11-arm` occurs 10 times in the ' +
      'COMMENT-STRIPPED ci.yml this guard reads (25 in the raw file), so a whole-file match ' +
      `would pass unconditionally. ${RENAME_NOTE}`,
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
    noIf,
  } = windowsLegReasons('build-windows', 'build', 'build');

  // POSITIVE CONTROL, and it comes FIRST for the same reason every other control in this file
  // does: the no-`if:` clause at the end is a `not.toMatch`, which an empty or mis-extracted
  // block satisfies trivially. `jobBlock` THROWS on an absent job key, so this clause is
  // simultaneously the presence guard and the extraction control.
  it('scopes to a real build-windows job block that runs npm run build', () => {
    const block = jobBlock('build-windows');

    expect(block, presence).toMatch(/^ {6}- run: npm run build$/m);
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

    expect(block, ownTarget).toMatch(/^ {6}- run: npm run build$/m);
    expect(block, ownTarget).not.toMatch(/^ {6}- run: npm run typecheck$/m);
    expect(block, ownTarget).not.toMatch(/^ {6}- run: npm run test$/m);
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
    noIf,
  } = windowsLegReasons('typecheck-windows', 'typecheck', 'typecheck');

  it('scopes to a real typecheck-windows job block that runs npm run typecheck', () => {
    const block = jobBlock('typecheck-windows');

    expect(block, presence).toMatch(/^ {6}- run: npm run typecheck$/m);
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

    expect(block, ownTarget).toMatch(/^ {6}- run: npm run typecheck$/m);
    expect(block, ownTarget).not.toMatch(/^ {6}- run: npm run build$/m);
    expect(block, ownTarget).not.toMatch(/^ {6}- run: npm run test$/m);
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
    noIf,
  } = windowsLegReasons('test-windows', 'test', 'test');

  it('scopes to a real test-windows job block that runs npm run test', () => {
    const block = jobBlock('test-windows');

    expect(block, presence).toMatch(/^ {6}- run: npm run test$/m);
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

    expect(block, ownTarget).toMatch(/^ {6}- run: npm run test$/m);
    expect(block, ownTarget).not.toMatch(/^ {6}- run: npm run build$/m);
    expect(block, ownTarget).not.toMatch(/^ {6}- run: npm run typecheck$/m);
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

  it('declares NO job-level if:, so the leg stays PR-eligible', () => {
    const block = jobBlock('test-windows');

    expect(block, noIf).not.toMatch(/^ {4}if:/m);
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
const MASKED_TOKEN_SITES = 8;

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
