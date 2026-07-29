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
 * `nx.json`'s `targetDefaults.test.inputs` (PARITY-08, plan 09-01, `nx.json:69`).
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
 * control above. The describe's TITLE names XOS-07 only, which is a deliberate trade: the
 * title is cited by 10-03-SUMMARY's coverage refs, so renaming it would rot those
 * references, and the alternative -- a second describe with a second copy of the same
 * `jobBlock('publish')` control -- would duplicate a mechanism for one assertion. Both
 * guards ask the same kind of question about the same job block, so they share the one
 * control. XOS-06's own clauses are named in its `it()` title and its comment lock lives,
 * like XOS-07's, in `docs-same-os-claims.spec.ts`.
 */
describe('ci.yml publish waits on every job that produces a mirrored entry (XOS-07)', () => {
  const reason =
    'The publish job must declare needs: [build, typecheck, test, integration]. A leg reads ' +
    'the Actions-cache key set ONCE at its publish step start and never re-reads it, so what ' +
    'it can mirror is a function of its START TIME -- measured on run 30400231720, where the ' +
    'ubuntu leg enumerated 122s before integration (windows-11-arm) finished and task hash ' +
    '8059758544828235640 reached the shard only under -windows. Each producer is asserted ' +
    'SEPARATELY because a toMatch against a needs: list is satisfied by any SUPERSET: a check ' +
    'for `integration` alone would pass against needs: [integration], which dropped build.';

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
 * A green `dogfood-verify` is NOT ROBUST-04 evidence: both dogfood jobs use
 * `./packages/github-cache`, whose `dist/action/index.js` is built from source IN-JOB, so
 * neither ever executes the committed `start-cache-server/index.js` that four of the five
 * sidecar `uses:` sites run. `action-bundle-drift` is the only control tying the two
 * together, and `09-RESEARCH.md`'s validation table states ROBUST-04's sampling rate as
 * "every PR and every push" on the strength of that job carrying NO `if:`.
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
        'and four of the five sidecar sites execute THAT file rather than the in-job build ' +
        'the dogfood jobs use. Gating it on an event drops ROBUST-04 from "every PR and ' +
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
 *      `{workspaceRoot}/.github/workflows/ci.yml` is an `nx.json` `test` input (`nx.json:69`,
 *      PARITY-08, Phase 9). `ci.yml`'s OWN comment blocks above `hash-parity` and
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
});
