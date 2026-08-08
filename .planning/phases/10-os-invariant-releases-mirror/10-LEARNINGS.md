---
phase: 10
phase_name: "OS-Invariant Releases Mirror"
project: "@op-nx/github-cache"
generated: "2026-07-29"
counts:
  decisions: 11
  lessons: 12
  patterns: 9
  surprises: 10
missing_artifacts:
  - "10-UAT.md"
---

# Phase 10 Learnings: OS-Invariant Releases Mirror

The phase collapsed the Releases mirror namespace from two names per hash to one
(`nx-cache-<hash>`), while keeping it prunable (two-branch cleanup filter, same commit) and
attributable (`mirrored-by: <os>` in the free-form Release asset label, outside the lookup name).

---

## Decisions

### The `mirrored-by` label is the PUBLISHING leg's OS, never the producing OS

The label records which leg uploaded the asset, and the producing-OS reading is explicitly
retracted at the construction site.

**Rationale:** `listCacheEntries` exposes no producing-OS field, and Phase 9 is precisely what
broke the publisher-equals-producer identity -- so a "producing OS" claim would be wrong in
exactly the cross-OS case the label exists to serve. A wrong attribution claim during an incident
is worse than no claim, which is why the retraction, not the label, is the security-relevant half.
**Source:** 10-02-SUMMARY.md, 10-05-SUMMARY.md, 10-SECURITY.md

### U-01 resolved to the additive branch: a label assertion, not an ordering dependency

The dead-publisher detector asserts the read-back asset's `mirrored-by` label equals the reader's
own OS, rather than depending on matrix leg order.

**Rationale:** measured 5/5 push runs that ubuntu's `publish` step ends 150-190 s before the
Windows `seed` step starts -- but GitHub documents NO matrix leg ORDER guarantee. The law is
narrower than CONTEXT.md guessed: the leg that runs LAST is the only one whose dead publish path
is detectable. The label assertion REPLACES the ordering dependency with a non-overlap dependency,
and it is the ONLY mechanism that detects a dead publisher -- the payload tightening cannot,
because the bytes are correct regardless of who uploaded them.
**Source:** 10-RESEARCH.md `## U-01 Resolution`, 10-TRUST-EVIDENCE.md B9

### `forbidden: []` on the new drift-guard row, deliberately

The new `DOCS_08_SITES` row carries no forbidden-phrase regex.

**Rationale:** an absence check on the old `needs: build (NOT test)` phrase would be SATISFIED BY
DELETING THE WHOLE COMMENT -- the exact failure the row exists to prevent -- and it would also
re-trigger the Phase 8 trap where a guard spells the token it forbids. Recorded in the row's
doc-comment so a later tidy does not "strengthen" it into uselessness.
**Source:** 10-03-SUMMARY.md

### Four authored `it` cases instead of `it.each` over a name array

The `needs:` VALUE guard uses four hand-written regex cases rather than iterating an array.

**Rationale:** an array member can be deleted silently while the harness still looks intact; four
authored regexes cannot. The extra repetition buys mutation observability.
**Source:** 10-03-SUMMARY.md

### Baseline expected OS = `CACHE_OS_VALUES[0]`, not a hand-authored `'linux'`

**Rationale:** the `it.each` group is the clause that bites on every machine. Index 0 is `windows`,
so on the ubuntu-only `test` job the baseline assertions ALSO redden against an engine that read
the ambient platform instead of calling `cachePlatform()`. The source comment marks that as a
bonus, NOT a guarantee -- on a Windows workstation the two coincide again, and overstating it
would be the same class of error OBS-03's retraction exists to prevent.
**Source:** 10-02-SUMMARY.md

### `mirrored-by: ` stays a pinned literal in two files rather than extracted to a shared leaf

**Rationale:** rejected on a measured asymmetry. A drift between the stamper
(`publish-mirror.ts`) and the reader (`read-back.ts`) fails LOUD -- `publish-verify` reddens with
both values in the message -- unlike an asset-name drift, which MISSes SILENTLY and is why
`releaseAssetName` is single-sourced. Pinned-literal-in-two-files is already the house pattern for
this case (`dogfood-body.ts`: "pinned in TWO files by design").
**Source:** 10-05-SUMMARY.md

### `mirror-seed.ts` is a NEW leaf, not an addition to `release-asset-name.ts`

**Rationale:** keeps OBS-05's commit outside the bundle-source set, so the commit carries no
`start-cache-server/index.js` regeneration obligation.
**Source:** 10-VALIDATION.md Wave 0, 10-04-SUMMARY.md

### The 404-versus-fault BRANCH was not copied, only the discrimination discipline

`read-back.ts` names the status in one message instead of splitting 404 from other faults.

**Rationale:** `releases-backend.ts` has two OUTCOMES because a 404 means "try the next shard".
This bin has already observed a HIT, so every non-ok status has exactly ONE outcome: fail. What
WAS copied is the part that matters -- discrimination is STRUCTURAL on `res.status`, never body
text. Recorded rather than taken silently, because a verifier comparing the two files would
otherwise read the missing branch as an omission.
**Source:** 10-05-SUMMARY.md deviation 4

### Two guards with two diagnoses for the seed derivation, comment-locked against re-merging

**Rationale:** keeping only the widened undefined-hash throw would have been a REGRESSION.
`mirrorSeedHash('', os)` is `feed<index>`, which is valid lowercase hex, so `parseHash` ACCEPTS
it -- the existing `GITHUB_RUN_ID is required` guard would have stopped firing and the reader
would have looked up the seed of the empty run, surfacing as a dead publish path rather than as an
unset variable.
**Source:** 10-05-SUMMARY.md deviation 1

### Execution ran sequential-on-main, not in git worktrees

**Rationale:** AGENTS.md's own rule covers it -- sequentially dependent plans gain no parallelism
(7 waves for 8 plans). Decisive: 10-07 requires `npm run check:action` in the MAIN tree, because a
fresh worktree has no `node_modules` and junctioning it makes esbuild rewrite ~689 module paths
with zero source edits and report false drift. Set per-run only; `workflow.use_worktrees` was NOT
persisted to false.
**Source:** 10-HANDOFF decisions, AGENTS.md

### Both phase bases recorded instead of picking one

The plan named `ff21b5f`; the orchestrator named `06019d4`.

**Rationale:** neither is wrong -- they answer different questions (pre-planning versus
pre-execution) -- and the plan's own instruction on a divergent base is to record BOTH. Every
source-file claim was run against both bases and both results transcribed, so the artifact
satisfies either reading and a later reader can confirm the range rather than trust it.
**Source:** 10-08-SUMMARY.md

---

## Lessons

### Commit GREEN before mutating

Mutation check 3 was applied to `action/index.ts` while that file's GREEN edit was still
uncommitted; `git checkout -- <file>` then reverted BOTH the mutation and the real edit.

**Context:** cost one re-apply and a full re-verify. Cheap to avoid: commit GREEN first, so a
mutation revert is always a revert to the intended state.
**Source:** 10-02-SUMMARY.md deviation 2

### A grep-verifiable ABSENCE claim must not spell the token it forbids -- including in the prose explaining the rule

The acceptance criterion `rg -c 'toHaveBeenCalledWith\(\s*expect\.not' publish-mirror.spec.ts`
returns 0 was unsatisfiable as written: it returns 1, and did so before the phase started. The
single hit is a COMMENT introduced by Phase 9's own gap-closure commit, which spells the forbidden
shape while explaining why the surrounding assertion deliberately does NOT use it.

**Context:** the comment was NOT deleted -- it is load-bearing prose, and deleting it to satisfy a
lexical count would destroy the explanation that keeps the correct shape from being "tidied" back.
The criterion's INTENT was measured instead: comment-stripped, the count is 0 in both
line-oriented and `-U` multiline modes. This reproduces a standing Phase 8 finding, and the
follow-on rule is that a future acceptance grep of this shape must strip comments.
**Source:** 10-02-SUMMARY.md deviation 1

### `rg -c` counts LINES, not occurrences

Two acceptance criteria measured lines where they meant occurrences.

**Context:** measured correctly with `rg -o ... | wc -l` instead: `jobBlock('publish')` occurs 5
times, and `bucket: 'correction'` went 3 -> 4. Both happen to be one-per-line here so the two
readings agree -- but they were measured the right way rather than assumed to agree. This is the
same standing lesson that invalidated two Phase 9 acceptance criteria.
**Source:** 10-03-SUMMARY.md deviation 2

### An acceptance-criterion `rg` literal is case-sensitive

A first draft wrote "operational, NOT code" for emphasis, so `rg -c 'not code'` returned 0 and the
criterion failed on correct content.

**Context:** rephrased to "explicitly operational and not code". The lesson is that emphasis
capitalisation silently breaks a lexical acceptance check.
**Source:** 10-01-SUMMARY.md deviation 3

### A multi-part requirement cannot be marked complete by the first plan that touches it

`requirements mark-complete RETAIN-05` flipped the whole requirement to `[x]` from plan 10-01,
which satisfies only part (a); parts (b) and (c) land in the later CORR-02 one-commit plan.

**Context:** the milestone audit closes requirements on a 3-source cross-reference (VERIFICATION +
SUMMARY + REQUIREMENTS), so a premature `[x]` would let (b) and (c) pass unaudited -- a silent
coverage hole in exactly the requirement whose whole point is that RETAIN-04 does not cover
everything. Reverted with a single-file targeted `git checkout`. This is a plan-frontmatter
granularity mismatch, not a tooling bug, and two other requirements in the phase have the same
shape.
**Source:** 10-01-SUMMARY.md deviation 4

### A comment lock that misstates the failure mode invites the deletion it exists to prevent

Both length-bound comment locks claimed the single-digit slot "stops separating the legs" at ten
members. That clause is FALSE -- `feed1<run_id>` and `feed10<run_id>` are different strings, so
two legs of the same run still differ at ten.

**Context:** both comments now state the real failure (positional boundary loss, hence injectivity
loss over the whole `(runId, os)` domain) AND why the injectivity case cannot carry the claim.
Counts as a bug rather than a wording nit: a comment lock's whole function is to stop a future
reader reconstructing a rejected argument.
**Source:** 10-04-SUMMARY.md deviation 2

### A DOCS-08 content pin covering both a COUNT and its CAUSE in one phrase lets them drift apart

The row pinned the single phrase `THE WINDOWS LEG STILL MIRRORS EXACTLY ONE REAL ASSET`.

**Context:** split into three phrases -- the carve-out, the count, and the dependency -- each
deliberately WITHIN ONE LINE of the wrapped comment. `read()` is a raw file read and the matcher
is `toContain`, so a line-spanning phrase would have to embed the `#` continuation prefix and
would then redden on a pure re-wrap. The first attempt did embed it and was corrected before
committing.
**Source:** 10-08-SUMMARY.md auto-fix 2

### A raw-file phrase guard cannot see a phrase split across a comment-continuation prefix

The retraction guard reddened on a rewritten doc block. The first hypothesis -- a latent line-wrap
false negative -- was WRONG, and measuring it is what established that.

**Context:** the pre-edit text does not match even a newline-tolerant `whose\s+byte[s]`, because
the JSDoc ` * ` prefix sits between the two words. So there was no hole to fix and no widening was
made. The sensitivity is recorded and deliberately NOT fixed: closing it would need
comment-prefix-aware normalisation, a new mechanism for one caller, and the guard already catches
the single-line form, which is how the phrase is actually written.
**Source:** 10-05-SUMMARY.md deviation 3

### RED-first sequencing may require executing tasks out of numeric order

Tasks ran 2 -> 3 -> 1: the `ci.yml` edit is task 1, and the guards that must redden without it are
tasks 2 and 3. Running task 1 first makes both REDs unreachable.

**Context:** authored and committed both guards RED first, then landed `ci.yml` as the single GREEN
commit. HEAD was red for two commits -- which is what a `test(...)` RED commit means. No hook runs
tests in this repo (`core.hooksPath` delegates to a repo-local `.githooks/` that does not exist),
so nothing was bypassed and `--no-verify` was never used.
**Source:** 10-03-SUMMARY.md deviation 1

### An inferred CI value guard needs a positive control asserting something UNIQUE to its job

**Context:** the `jobBlock('publish')` positive control asserts `publish`'s own `if:` expression,
not merely non-emptiness. A `jobBlock` that returned the WRONG non-empty block would otherwise
have every later clause asserting about a different job.
**Source:** 10-03-SUMMARY.md

### Deleting a violation site leaves debris that the lint gate catches in the same commit

`readSiteLines` was `readFileSync`'s only consumer in `lint-rules.spec.ts`; removing the
enumeration left the import unused.

**Context:** worth recording as evidence rather than noise -- this is LINT-06's mechanism firing
one level up from the directives it was built for.
**Source:** 10-07-SUMMARY.md auto-fix 2

### No phantom `feat` commit for a comment-only change

Task 10-08-1 adds no behaviour: `ref` was already plumbed through `createPublishClient`, and the
only source edit is a comment.

**Context:** the RED was demonstrated against three deliberately weakened calls, observed and
transcribed, BEFORE the spec was trusted or committed. Commit types stayed truthful --
`test(10-08)` then `docs(10-08)` -- rather than inventing a `feat` to satisfy a TDD gate shape.
Not a gate violation.
**Source:** 10-08-SUMMARY.md judgement calls

---

## Patterns

### Predict the mutation's redness, then observe it, then revert

Every mutation check in this phase was written down as a prediction first and only then run, with
the observed red set transcribed beside the prediction.

**When to use:** any guard whose value is that it fails. It is what separates "the guard exists"
from "the guard bites", and this phase found four separate instances of a guard that passed for
the wrong reason. A predicted-only redness is not evidence.
**Source:** 10-02 through 10-08 SUMMARY.md `## Mutation checks (predicted first, then observed)`

### Pair every disjointness assertion with a non-vacuity companion

An added case asserts each branch accepts a nonempty slice of the adversarial table and that the
union's length equals the sum of the two.

**When to use:** whenever you pin a both-true count to 0. Every disjointness assertion is
satisfied by a table where BOTH branches reject everything. Mutation 3 confirmed the companion
earns its place -- it is one of the 11 RED when the composed filter loses branch B.
**Source:** 10-07-SUMMARY.md auto-fix 3

### On a DELETE path, the laziest sufficient fixture is not the right one

The mixed-shard fixture gained a second foreign asset, `nx-cache-release-notes.md`, which wears
the real prefix so it must be rejected on its non-hex remainder rather than only by the legacy
last-`-` split. It also gained a within-window new-form asset that is green before AND after the
rename.

**When to use:** any test over a destructive operation. The within-window asset contributes no RED
but separates "the filter widened" from "the filter widened and stopped honouring the `created_at`
cutoff" -- the second is data loss wearing a passing test.
**Source:** 10-06-SUMMARY.md additions 1 and 2

### Split the RED into an ADD-only commit so the GREEN can be one atomic commit

Plan 10-06 is assertion-level RED with additions only; 10-07 is THE ONE COMMIT that turns it
green.

**When to use:** when a rename must land atomically but its tests should be reviewable separately.
The ADD-only contract is what legitimises the split -- which is also why `CACHE_OS_VALUES` was
added as a SECOND import statement rather than widening an existing import line, since widening
would register as a deletion.
**Source:** 10-06-SUMMARY.md, 10-07-SUMMARY.md

### Set a partial mock's return value in `beforeEach`, not in the `vi.mock` factory

**When to use:** any spec file with a file-level `afterEach` running `vi.resetAllMocks()`, which
discards a factory-supplied implementation after the first test. A factory default would have
worked for exactly one test and then silently returned `undefined`.
**Source:** 10-02-SUMMARY.md

### Derive OS-sensitive expectations from `CACHE_OS_VALUES`, never from the running machine

**When to use:** every assertion that could be sampled at rate ZERO on the ubuntu-only `test` leg.
A hand-authored `'linux'` literal in a unit spec can never fail on the OS it is wrong about. The
alternative is moving the assertion to `integration`, which is the only every-PR two-OS sampler.
**Source:** 10-VALIDATION.md Sign-Off, Phase 9 gap G2

### Negate the QUANTIFIER, not the predicate, in an absence assertion

`toHaveBeenCalledWith(expect.not.stringContaining('x'))` asserts "SOME call lacks x", not "NO call
has x" -- vacuously satisfiable by any other call.

**When to use:** every absence claim over a spy. Assert over `spy.mock.calls` with
`.every(...)`/`.some(...)`, or use `expect(spy).not.toHaveBeenCalledWith(...)`. Re-verified clean
against the current tree during validation.
**Source:** 10-VALIDATION.md Sign-Off, Phase 9 gap G3

### Pin a widened API argument with a whole-argument-array assertion PLUS a call-count pin

The `ref` scoping on `listCacheEntries` is pinned this way, and driven with two constructor values
so the plumbing is proven.

**When to use:** when a single argument becomes the sole narrowing control. Neither dropping the
scope nor adding a second unscoped enumeration can then land silently. Comment-lock it with the
supporting facts and name the failure mode -- here, information disclosure, not a MISS.
**Source:** 10-08-SUMMARY.md, 10-SECURITY.md T-10-02

### Spawn the dedicated auditor even when the workflow offers a clean-looking short-circuit

Both `secure-phase` and `validate-phase` short-circuit past their auditor on a clean register or a
no-gap phase and have the orchestrator author the verdict.

**When to use:** every post-execution gate that HAS a dedicated agent. Here the security
short-circuit's predicate (`threats_open:0 AND register_authored_at_plan_time:true AND
asvs_level==1`) matched the phase exactly and would have self-certified TRUST-13 -- which the
requirement forbids in its own words, and which T-10-29 names as a threat about the audit itself.
The orchestrator may only route and commit the returned verdict.
**Source:** 10-TRUST-EVIDENCE.md B8, 10-SECURITY.md, 10-VALIDATION.md

---

## Surprises

### A sixth `releaseAssetName` consumer that research enumerated as five

`publish-mirror.spec.ts:178` asserted `name.startsWith(\`${HASH}-\`)`. Research correctly found
all eight CALLS in that file single-arg and surviving -- this is not a call, it is a shape
assertion on the RESULT, pinning the deleted `<hash>-<os>` layout.

**Impact:** one failure out of 811 at the first full run; the 14th file in a 13-file plan. Not
scope creep -- a test the plan's own change breaks has to land in the same commit or the wave stays
red. Same class of miss as the stale prose the phase sweeps, one abstraction level up.
**Source:** 10-07-SUMMARY.md auto-fix 1

### An unanchored `\bbuild\b` would have matched the publish job's own `npm run build` step

**Impact:** the XOS-07 `needs:` guard would have been a tautology. Caught by an executor, not by
the plan.
**Source:** 10-CONTINUE-HERE context, 10-03-SUMMARY.md

### The label read needed pagination because the live shard holds 122 assets

A single-page read would have reddened `publish-verify` on CORRECT code.

**Impact:** T-10-22. Caught by an executor measuring the live shard rather than trusting the
plan's prose.
**Source:** 10-05-SUMMARY.md `## The pagination correction (T-10-22)`

### `feed<index>` is valid lowercase hex, so `parseHash` accepts the seed of an empty run

**Impact:** turned a "widen the message" instruction into a mandatory second guard. Without it an
unset `GITHUB_RUN_ID` would surface as a dead publish path instead of as an unset variable.
**Source:** 10-05-SUMMARY.md deviation 1

### The plan's own D-08 bounding-argument sentence misstated the measured total as 1000

The measured total is 122, of a 1000-asset cap. CONTEXT.md states it correctly.

**Impact:** none on any acceptance criterion; the correct figure was written and the divergence
recorded rather than silently substituted.
**Source:** 10-01-SUMMARY.md deviation 2

### The `@actions/cache` version rotation has no effect on the Releases read path

The Releases reader fetches asset bytes by NAME only; the version-hash layer governs the
Actions-cache backend. The prior record's asset still returns the identical 410-byte payload.

**Impact:** narrows D-25's rationale. That independence was an ASSUMPTION before this measurement
and is now a fact -- and the fresh capture was still the right call precisely because it was an
assumption.
**Source:** 10-01-SUMMARY.md `## Notes for later phases`

### `CACHE_ARCHIVE_DIR` is a workspace-relative literal and is NOT redirected by `NX_CACHE_DIRECTORY`

**Impact:** the fourth reason for taking the COLD-DIRECTORY variant instead of `nx reset` -- not
resetting at all REMOVES the ordering constraint rather than merely satisfying it. Found by
reading the source, not predicted by the plan.
**Source:** 10-01-SUMMARY.md deviation 1

### A `ci.yml` comment went stale the moment plan 10-03 widened `publish`'s `needs:`

The Windows-leg carve-out cited run `30400231720` to explain a nonzero `mirrored` by "its own
`integration` hash, which ubuntu's enumeration snapshot predates". Once `needs:` widened, ubuntu's
snapshot CONTAINS that hash, so the Windows leg's real-task count is zero and its one remaining
asset is its own seed.

**Impact:** left as-is, the workflow comment would have contradicted the SC6 note on exactly the
point that drives the matrix-collapse decision. The fix keeps the old run as evidence for the
PRE-widening case and warns that reverting the `needs:` list silently restores it.
**Source:** 10-08-SUMMARY.md auto-fix 1

### The DOCS-08 content pin reddened on that very fix -- the guard working, not a defect

**Impact:** exposed that one phrase covering both a count and its cause lets either change without
reddening. Split into three single-line phrases.
**Source:** 10-08-SUMMARY.md auto-fix 2

### `roadmap update-plan-progress` left plan 10-01 both checked and unchecked

The verb inserted a bare `- [x] 10-01-PLAN.md` above the pre-existing descriptive list, which
still read `- [ ] \`10-01-PLAN.md\` - ...`, so one plan rendered as both done and not done in one
section. It also collapsed a progress-table cell separator.

**Impact:** repaired for 10-01; the duplicate list STRUCTURE was left alone as pre-existing across
the file (Phase 9's block carries the identical artifact). Logged to `deferred-items.md` as D1
rather than repaired eight times ad hoc.
**Source:** 10-01-SUMMARY.md deviation 5, deferred-items.md D1
