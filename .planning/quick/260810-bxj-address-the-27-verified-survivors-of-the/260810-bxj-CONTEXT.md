# Quick Task 260810-bxj: Address the 27 verified survivors of the thermos review of PR 16 - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Discussion mode:** `--auto` (gray areas auto-resolved; every resolution below is backed by a
`.planning/` artifact or a measurement, not by a bare default)

<domain>
## Task Boundary

A thermos multi-agent review of PR #16 (milestone v0.0.2, OS-invariant cross-OS sharing) ran 8
reviewers over 4 components: A (action entrypoint + backend layer + cache-version inputs), B
(Releases mirror + publish + retention/cleanup + roundtrip), C (CI workflows + hash-parity tooling
+ Nx/package config), D (lint toolchain + guard specs + consumer docs + test helpers). Each
component got both a correctness reviewer and a code-quality reviewer.

Every finding was re-verified from source by the orchestrator before acceptance. 33 survived; 6
were rejected or folded with a written reason. Of the 33, **27 are in scope for this task** and 6
are deferred to v0.0.3 (see DEC-2).

**Source artifacts** (session scratchpad, not committed):
`TRIAGE.md` (the triage, verification notes and locked decisions) plus per-component reports
`A-bugs.md`, `A-quality.md`, `B-bugs.md`, `B-quality.md`, `C-bugs.md`, `C-quality.md`,
`D-bugs.md`, `D-quality.md`, all under the session scratchpad directory
`.../cd9519c8-8905-481f-ad81-7758aa610af9/scratchpad/thermos/`.

**READ `TRIAGE.md` FIRST.** It carries the per-item verification evidence. Do not re-derive the
findings from scratch and do not re-open DEC-1 or DEC-2.

**Reviewer verdicts.** Zero critical, zero high on the correctness axis. All four correctness
reviewers independently re-derived the milestone MECHANISM and it held: `enableCrossOsArchive` at
the correct positional index against the real `@actions/cache@6.2.0` `.d.ts`; the cache version
reducing to workspace-relative literal + compression method + salt; the read-only backend having no
reachable write and degrading faults to a 404 MISS; zero `${{ }}` in any workflow `run:` body; no
`pull_request_target` / `workflow_run`; no third-party actions; the ESLint globs mirroring the
vitest partition; the runtime discriminator on `integration` alone; the action bundle byte-identical
with its gate wired; 1090 unit tests passing. **v0.0.2's central claim is intact.** What survived is
concentrated in this repo's two named recurring defect classes.

</domain>

<decisions>
## Implementation Decisions

### DEC-1 (LOCKED, from `.planning/` artifacts) -- a non-benign sibling in a 422 body is FATAL

**Do not re-open.** Taken from the record, not from preference:

- `.planning/debug/publish-verify-422-empty-shard.md` and `STATE.md:710-717` establish the root
  cause of run `30767511870`: immutable releases were enabled as a REPOSITORY SETTING between
  2026-07-16 and 2026-08-02, so `cache-mirror-202608` was born `immutable: true` and "rejected all
  65 uploads"; "every asset upload returned 422 and was swallowed as benign"; the shard froze at
  ZERO assets and `publish` exited GREEN. That is exactly T1-1's payload shape, already measured on
  a real runner.
- Quick `260803-3g1` names the defect CLASS -- "branching on an HTTP status without reading the
  response body" -- and adopts the governing rule: "Now fails CLOSED -- an unreadable, missing or
  malformed body counts as a FAULT, never a benign skip -- and surfaces `errors[].message` as well
  as `code`, because policy rejections arrive as `code: \"custom\"` with the diagnostic in the
  message." `code: 'custom'` IS the recorded policy-rejection shape.
- Quick `260803-fcd` fixes the implementation pattern, and it ALREADY EXISTS in this file at
  `publish-mirror.ts:366-395`: exactly ONE signature is a loud non-fatal skip, read through a
  FIELD-SCOPED accessor and anchored textually, and "every other 422 stays fatal, including the
  `pre_receive` ruleset decoy, which is excluded both structurally (wrong `field`) and textually".
  The field-scoped accessor is MANDATORY: `faultReason().message` returns the FIRST message-carrying
  entry, which on the measured payload was a DECOY.
- `STATE.md:482` records the standing exposure as deliberately LOUD: "anyone re-enabling the setting
  silently kills the mirror again. The `e96670e` classifier fix makes that failure LOUD rather than
  preventing it."

**Therefore:** the RULE is fail-closed on the ASSET-UPLOAD path. A body is benign only if EVERY entry
in `errors[]` is positively recognised as benign; a single unrecognised sibling makes the whole body
FATAL. Rename the spec at `publish-mirror.spec.ts:513` to state what it actually asserts, and correct
the three comments (`octokit-fault-reason.ts:167`, `publish-mirror.ts:989`, and the block above the
spec) that credit the whole-array scan with closing a hole it only widens. `publish-mirror.ts:341`
already says this correctly and is the model.

**CLARIFICATION (2026-08-10, from the plan check) -- what "field-scoped and textually anchored"
governs.** An earlier revision of this entry called the field-scoped accessor MANDATORY on this path.
That over-generalised the mechanism from the rule, and the distinction matters:

- At `ensureShardRelease` the benign signal is a MESSAGE (`tag_name was used by an immutable
  release`). Reading a message off a multi-entry array is where the decoy bites -- quick `260803-fcd`
  measured `faultReason().message` returning the `pre_receive` DECOY -- so THERE the accessor must be
  field-scoped and the match textually anchored.
- On the asset-upload path the benign signal is a CODE (`already_exists`). A code-set predicate never
  reads a message, so it is structurally immune to the decoy the field-scoping rule exists to defeat.

So the fail-closed all-entries CODE conjunction SATISFIES DEC-1, and no message read belongs on the
upload path. If a future benign signature on this path needs a message, the field-scoped accessor
becomes mandatory again. Say this in the code comment; do not let `must_haves` promise a "field-scoped
predicate" for a path that must not read messages at all.

**ACCEPTED CONSEQUENCE, stated here rather than discovered at the first red run.** The twin spec
`it('reaches the same verdict when already_exists is NOT the first entry')` asserts
`skipped: 1, failed: 0` on the body `[{code: custom, message: decoy}, {code: already_exists}]`, and
its comment argues the fail-closed outcome would be WRONG. Under the rule above that body becomes
FATAL, so the twin MUST be re-authored against the new behaviour, and its comment's claim is one more
instance of the falsified-prose class. The trade is explicit and is DEC-1's own: a genuine
duplicate-upload race that arrives ALONGSIDE any unrecognised error entry now reddens the publish leg.
That is the intended direction -- `STATE.md:482` wants this failure LOUD -- and it is strictly
preferable to the current behaviour, where a permanent policy rejection sitting beside an
`already_exists` exits GREEN having mirrored nothing. Do NOT narrow the predicate to keep the twin
green; that silently relaxes DEC-1.

**Spurious-red risk was measured, not guessed:** immutability is disabled, the dead release was
removed, and Window B (`run 30807461616`) went full green with 69 assets. If the setting is ever
re-enabled, red is the DESIRED outcome per `STATE.md:482`.

### DEC-2 (LOCKED, from `.planning/` artifacts) -- scope is 27 items; 6 structural splits deferred

**Do not expand into the deferred six.** Taken from the record:

- `ROADMAP.md:418` already establishes v0.0.3 as the deferral lane for structural collapse work
  ("write it down so v0.0.3 does not re-derive it").
- `RETROSPECTIVE.md` "What Was Inefficient" penalises speculative restructuring by name -- the
  dual-root trust copy was "effort spent on a file nothing ended up consuming".
- Top Lesson #1, verified across BOTH milestones: local gates cannot prove GitHub Actions runtime
  behaviour; three distribution bugs passed every local gate AND the verifier and took five live
  pushes. `ci.yml` is what PRODUCED this milestone's O1-O4 evidence, so restructuring it now
  invalidates the provenance of the evidence the PR rests on and would need fresh live windows on a
  maintainer-only push path.
- The house pattern for a post-review fix pass is a QUICK TASK (`260809-uge`: 44 findings, 32
  commits). Quick tasks fix defects; they do not restructure.
- T4-1 is blocked by T2-2 by construction anyway.

**DEFERRED to v0.0.3, each with its reason, recorded in a `260810-bxj-deferred-items.md`:**
T4-1 (`ci.yml` 2594 lines, 5 named seams, blocked by T2-2), T4-2 (`publish-mirror.ts` 1043 lines,
11 fallow complexity findings), T4-3 (`dogfood-cross-os.spec.ts` 2211 lines, 11 concerns, ~370
duplicated lines), T4-4 (`capture-hashes.mjs` 957 lines, 3 programs), T4-5
(`actions-cache-backend.spec.ts` 1069 lines + 2 misplaced package-scope walks), T4-8
(`ReadOnlyBackend` re-widening, 4 port names for 2 concepts), and -- ADDED post-research -- T4-7a
(the `nx.json` `namedInputs` single-sourcing half of T4-7; see its amendment below for why, and note
it must land EARLY in v0.0.3, before any new hash record). SEVEN deferred items, not six.

**IN SCOPE (27) = T1 (8) + T2 (7) + T3 (10) + T4-6 + T4-7.** T4-6 and T4-7 moved out of the
deferred set because they are defects, not refactors -- see the two entries below. T4-7 remains in
scope but its FIX SHAPE was amended post-research to the drift guard only; its `namedInputs` half is
deferred as T4-7a. The item count stays 27.

### Census claims: DELETE the number, or replace it with a programmatic count. Never hand-author a new one.

Three independent reviewers measured three different totals (29, 34, 35) for the same file whose
comment claims 16 -- inside a block titled "CENSUS CORRECTION" that exists to fix a prior miscount.
The repo's own precedent is decisive: `windows-regression-detector.yml:7-13`, added in this same PR,
DROPPED its own job count with the stated reason "an unguarded number in a comment rots". So: delete
the count, or, where the count is load-bearing, assert it programmatically so it cannot rot. A fourth
hand-authored number is not an acceptable outcome.

### T1-5 Phase 13 guard: make it LOCALIZING, not a cardinality check

`READ_ONLY_LEG_SITES = 3` cannot prove locality -- it is satisfiable by deletion and blind to a NEW
Windows job. Replace with a guard that enumerates every job whose runner is Windows and which runs a
portable target, and asserts each one sets `CACHE_READ_ONLY`. The invariant is per-job, so the guard
must be per-job. A new non-conforming Windows job must redden it.

### T1-2 docs fix: correct the DOC; do NOT widen `cleanup.ts`

`retention.ts:87-96` records the deliberate decision not to widen `isShardTag` -- a widened accepter
must be maintained forever, the affected shards were one hand-deleted release, and the tag scheme is
not part of the consumer contract. That decision stands. The defect is that `docs/advanced.md:118-120`
tells a CONSUMER the opposite of what the source says. Fix the doc to state the truth: legacy
`cache-mirror-*` shards are NOT reachable by cleanup and must be removed by hand. On a public repo
the consequence of believing the doc is world-readable assets retained forever, so the doc must say
so plainly.

### T1-3 ambient-platform-read ban: close the family, not just the one token

Add `node:process` and `process` to `no-restricted-imports` with the same banned accessors as
`node:os`, and add selectors covering the aliased default import (`import proc from 'node:process';
proc.platform`), which today evades because the existing selectors key on `object.name === 'process'`.
Fold in the `process.env` denylist widening the reviewer found alongside it
(`TEMP`, `RUNNER_TEMP`, `USERPROFILE`, `HOME`, `windir`) -- that is the exact substitution Phase 9
created pressure for by banning `os.tmpdir`. The ban must be proven by a test that FIRES, using the
ESLint Node API against a unit-spec path, not by asserting config shape.

### Every fix carries a check that fails if the logic breaks

Byte-pinning a file's indentation is NOT such a check (that is T2-2, one of the defects being fixed).
A guard must fail when the invariant is violated, not when the bytes move. Where a fix is
prose-deletion only (most of T3), the "check" is that the deleted claim has no surviving assertion
depending on it -- verify that, do not invent a test for a comment.

### Commit granularity

Atomic commits grouped by tier and file, following `260809-uge`'s precedent (32 commits for 44
findings). `retention.ts` is in the action bundle (`start-cache-server/index.js:68503`), so any change
to a bundled source requires the regenerated bundle in the SAME commit or `check:action` fails that
commit. `publish-mirror.ts` and `octokit-fault-reason.ts` are NOT bundled (verified).

### Execution: main tree, no worktree isolation

Measured reason, not preference. This repo has recorded that a junctioned worktree makes esbuild
rewrite module paths with no source edit, so `check:action` returns a FALSE drift verdict there and
only the main tree gives a true one. This task touches a bundled source, so a trustworthy
`check:action` is required. AGENTS.md's decision rule also applies: a single plan has no parallelism
to gain, so run sequential-on-main regardless.

### Claude's Discretion

- Exact wording of replacement comments and doc sentences, provided no new unguarded count or
  unverifiable claim is introduced.
- Whether a given T3 deletion also warrants a one-line replacement stating the current truth.
- Test placement within the existing spec files, subject to the deferred-item boundary (do not
  restructure the four oversized files).

</decisions>

<specifics>
## Specific Ideas

**T1 -- changes behavior or what a consumer believes (8).** T1-1 the silent-green publish path and
its falsely-titled spec (DEC-1). T1-2 `docs/advanced.md` claiming legacy shards stay prunable when
`cleanup.ts:78` skips them. T1-3 the ambient-platform-read ban missing `node:process` entirely.
T1-4 `read-back.spec.ts:447` deriving its fixture from the wall clock, deterministically RED on the
31st of a 31-day month (7 days/year) because `shardTagsForWindow(30)` collapses to one tag --
`cleanup.spec.ts:59` and `releases-backend.spec.ts:85` already pin the clock with
`vi.setSystemTime`. T1-5 Phase 13's non-structural `READ_ONLY_LEG_SITES` guard. T1-6 `ci.yml:26-31`'s
`cancel-in-progress` safety enumeration, falsified by this milestone's own wiring (the four
non-push-gated sidecar jobs DO write task-hash-keyed entries on PR runs, as the same file admits at
`:2441-2447`). T1-7 the `mirrored-by:` label -- OBS-03's attribution, the thing CORR-02 claims
survived dropping the OS component -- authored independently at 6 sites with no single source, so a
writer-side rename passes every spec. T1-8 the burned-tag short-circuit sitting below the size check
and the restore, making its "GREEN by design, `failed` stays 0" claim false for an oversized entry
and costing a useless round-trip per remaining hash.

**T2 -- guards that read as coverage and are not (7).** T2-1 the census comments. T2-2 the
indentation-anchored regexes pinning `ci.yml` shell character-for-character (`^ {10}`), which assert
the bytes are unchanged rather than the arithmetic being right. T2-3 the whole-file positional
mask/write pairing that cannot localize. T2-4 `capture-hashes-cli.spec.ts:238`'s `[\s\S]*?` defeating
the same-line locality its own comment claims. T2-5 the comment-stripper in five copies with three
marker sets, all line-leading-only, where the copy with NO positive control backs the strongest claim
in the package. T2-6 `eslint.config.mjs:88-97` claiming a control over five `ignores` entries when
only `**/dist/` is asserted. T2-7 `compression-method.ts:87-94`'s "mechanically checkable" claim with
nothing scanning it.

**T3 -- prose this PR's own changes falsified (10).** Fix by deletion. Includes `ci.yml:12`'s
"three ... Windows-arm legs" (five jobs carry a 2-way OS matrix, so it is 8 Windows legs of ~27, and
the comment is a COST argument that understates its own cost); `ci.yml:342-346`'s seven-job "only the
final `npm run` line may differ" invariant, already false and inviting a normalisation that would
delete `CACHE_READ_ONLY`; a comment claiming a test "drives the REAL put" when it does not; a comment
naming the moved `tmpdir`; six comments naming the renamed port type; a `types.ts:46-50` citation
invalidated by a same-changeset insertion; a completed two-commit move described as in progress;
`isLegacyOsSuffixedAssetName`'s ~90 lines of prose plus a disjointness proof for unreachable code;
`SHARD_TAG_PREFIX`/`CACHE_KEY_PREFIX` as two byte-identical independently authored literals; and
`docs/trust-and-security.md:155-160` pointing at `docs/versioning.md` for an Nx pin that file does not
mention.

**T4-7 (in scope; FIX SHAPE AMENDED post-research -- drift guard ONLY, NOT `namedInputs`).**
`nx.json` authors the 4-element ESLint `externalDependencies` array twice -- at `:81-87` under `test`
and `:169-174` under `lint`. The DEFECT is real and stays in scope: add a plugin to `lint` only and
`test` stops rotating on ESLint upgrades, so `lint-rules.spec.ts` replays a cached PASS.

**AMENDMENT (2026-08-10, post-research).** The `namedInputs` refactor is REJECTED for this task, on
the project's own hard ordering rather than a preference. Research MEASURED that the refactor rotates
ALL FIVE target hashes and makes `.planning/phases/11-live-proofs-o1-o2-o3/11-hashes-{cold,warm}.json`
non-reproducible from HEAD. `REQUIREMENTS.md:654` and `STATE.md:608` record that this milestone was
SEQUENCED to prevent exactly that -- "Phase 7 before Phase 8 because `@nx/eslint` is an Nx INFERENCE
plugin: an inferred `lint` target changes `hash_project_config`, which is folded into EVERY task hash,
so adopting the linter after the parity root-cause work would invalidate that work." An `nx.json` edit
that rotates `hash_project_config` is that same class of change, and landing it post-Phase-13 does to
Phase 8's and Phase 11's records precisely what the ordering existed to prevent. It is also the same
argument DEC-2 used to defer the `ci.yml` split, so deferring here is the CONSISTENT call, not a
special case. The research's finding that the rotation is semantically neutral does not rescue it: the
cost is to EVIDENCE PROVENANCE, not to correctness.

**Take the drift guard alone.** `RETROSPECTIVE.md` Patterns Established is "single-source-of-truth +
a byte/semantic drift guard beats a hand-synced second copy" -- two halves. Ship the SECOND half only:
a spec asserting the `test` and `lint` `externalDependencies` sets are equal, so adding a plugin to one
and not the other goes RED. That closes the defect at ZERO hash cost and changes no `nx.json` byte.
Record the `namedInputs` single-sourcing as a seventh v0.0.3 deferred item, noting it must land EARLY
in that milestone -- before any new hash record -- per the same ordering rule.

**CORRECTION (2026-08-10, from the plan check).** An earlier revision of this entry said "assert SET
EQUALITY between the two arrays". That instruction was WRONG and would have shipped a guard that is
RED on a correct tree -- the same defect class this whole task exists to close. MEASURED from
`nx.json`:

```
test: ["vitest","eslint","@eslint/js","typescript-eslint","@eslint-community/eslint-plugin-eslint-comments"]
lint: ["eslint","@eslint/js","typescript-eslint","@eslint-community/eslint-plugin-eslint-comments"]
equal? false        test minus lint: ["vitest"]
```

The duplication is the FOUR ESLint packages, which appear in both; `test` additionally carries
`vitest`, which `lint` correctly does not.

**SECOND CORRECTION (2026-08-10, from the code review and the verification -- both found this
independently).** My first correction said to assert
`test.externalDependencies \ lint.externalDependencies === {vitest}`. That subtraction is BLIND TO A
REMOVAL and was faithfully implemented as such. MEASURED against the five mutations:

| Mutation | subtraction form | union form |
|---|---|---|
| correct tree | GREEN | GREEN |
| plugin on `lint` only | RED | RED |
| plugin on `test` only | RED | RED |
| `test` loses ONE ESLint package | **GREEN** | RED |
| `test` loses ALL FOUR | **GREEN** | RED |

A shrinking `test` set is exactly the stale-cache false PASS T4-7 exists to close, so the subtraction
form fails at its own purpose -- and the shipped assertion message even ends "A removal is the same
hazard mirrored", a claim it does not honour. This is the THIRD hand-authored set relation in this task
that I got wrong before testing it against the mutation, which is itself an instance of the defect
class under repair: I asserted coverage I had not proven.

**The correct assertion is the UNION form, and nothing else:**

- `lint.externalDependencies` set-equals the four ESLint package names, AND
- `test.externalDependencies` set-equals `lint.externalDependencies` UNION `{vitest}`

That closes all four drift directions -- a plugin added to either side alone, an unexplained new entry
on `test`, and a REMOVAL from either side. Still no hard-coded element COUNT anywhere (that would be
the T2-1 census defect); express it as set relations over named packages, and make the failure message
describe only what the assertion actually catches.

**Standing rule for the rest of this task:** every set relation, partition or derivation a guard
asserts must be validated against the mutation it claims to catch BEFORE it ships, and the failure
message must not claim a direction the assertion does not cover. A guard whose message overstates its
reach is the same defect as a comment whose reason is false.

**T4-6 (in scope, reclassified).** `repo-file.ts:15` asserts it is "the ONE authored copy" while three
`WORKSPACE_ROOT_URL` constants exist in the package and two sites re-implement `readRepoFile`'s body
verbatim. The claim is false either way; the same single-source pattern says route the six bypassing
sites (`lint-rules`, `lint-scope-drift`, `public-surface`, `nx-target-inputs`, `pinned-deps`) through
the helper rather than weaken the claim.

**Rejected or folded, do not re-litigate.** The zstd `.cmd`-shim compression inversion stays a
DOCUMENTED CEILING (surfaced, never gated, live O4 gate behind it) -- the module's contract analysis
should merely name the tool-resolution axis it omits. The `.gitignore` gaps
(`hash-parity-records/`, `integration-hash-records/`, `payload.bin`, `roundtrip.bin`) and
`ci.yml:1508`'s missing `select(type == "object")` jq element guard fold into T3/T1 as cheap fixes.
`windows-regression-detector.yml` having never executed is OPEN BY DESIGN and matches the milestone's
existing live-CI-only pattern.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` -- 57 requirements, all `[x]`. Exposure: T1-1 -> ROBUST-04 / OBS;
  T1-2 -> DOCS-07..10 + RETAIN; T1-3 -> LINT-01..06; T1-5 -> XOS-09 + Phase 13; T1-7 -> OBS-03 +
  CORR-02; T2-* -> the TEST-08..11 coverage claims. **No requirement checkbox is falsified outright;
  what is falsified is the sufficiency of several guards backing them, plus one consumer-facing doc
  claim.**
- `.planning/debug/publish-verify-422-empty-shard.md` -- the established root cause behind DEC-1.
- `.planning/STATE.md` -- quick `260803-3g1` (the read-the-body defect class and the fail-closed
  rule), quick `260803-fcd` (the field-scoped, textually-anchored house pattern and the two live
  windows), and `:482` (the standing immutable-releases exposure, deliberately LOUD).
- `.planning/RETROSPECTIVE.md` -- "What Was Inefficient" and Top Lesson #1, both backing DEC-2.
- `.planning/ROADMAP.md:418` -- the v0.0.3 deferral lane.
- `.planning/v0.0.2-MILESTONE-AUDIT.md` -- `status: tech_debt`; all requirements satisfied, the debt
  being bookkeeping plus two open-by-design live-CI observations.
- `publish-mirror.ts:341` and `:366-395` -- the in-repo model DEC-1 tells the executor to copy.

</canonical_refs>
