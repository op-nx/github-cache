# Phase 9 Plan Verification

**Verified:** 2026-07-28
**Plans checked:** 09-01 through 09-07-PLAN.md
**Scope:** the twelve specific failure-mode checks (V1-V12) requested by the orchestrator, on top of
the mechanical checks the orchestrator already performed (frontmatter, requirement coverage map,
wave/dependency graph, threat models, artifact sections, `check:action` references).

---

## Verdict summary

ONE WARNING, NO BLOCKER. All twelve specific checks pass except V10, which is a WARNING by the
orchestrator's own severity cap ("a WARNING at most, not a blocker").

---

## V1 -- H1's single-commit constraint (VER-07+VER-01+VER-03+VER-04 in ONE commit)

**SATISFIED.** 09-03-PLAN.md's three tasks are explicitly staged: Task 1 (RED, writes every spec,
"**DO NOT COMMIT**"), Task 2 (GREEN, implements everything, "**DO NOT COMMIT**. Task 3 creates the
single commit."), Task 3 (six mutations observed then reverted, "create **ONE commit** staging exactly
these nine paths"). The objective section states the constraint explicitly as "a hard constraint, not a
preference" and gives all three reasons (four rotation windows, dead mkdir, asymmetric Windows-only
signal, red tree without the spec accommodation). Acceptance criteria for Task 3 assert "Exactly ONE
commit contains all nine paths" and "No other commit in this plan touches
cache-archive-path.ts or actions-cache-backend.ts."

## V2 -- H2's blast radius and the count (three spec files, 17 direct / 21 total)

**SATISFIED.** 09-03 Task 1 Step 2 states the census as measured, not inferred: "actions-cache-backend
.spec.ts **16** direct constructions ... serve.spec.ts **1** (:401) = **17 direct**; plus
select-backend.spec.ts **4 call sites / 5 runtime invocations** ... = **21 total across THREE files**."
This matches 09-PATTERNS.md section 3's corrected count exactly (the plan explicitly flags 09-RESEARCH
.md's 15/16-and-"probably" as an undercount to be comment-locked, not silently fixed). All three files
get the same `beforeAll`/`afterAll` `enterWorkspaceRootCwd()` hook. The `:39` pre-write-before-`:40`
-construction ordering hazard is handled: `enterWorkspaceRootCwd()` itself does the
`mkdirSync(CACHE_ARCHIVE_DIR, ...)`, so the directory exists before any spec's pre-write runs, and
Task 1's `read_first`/action text explicitly names this as "the failure to avoid" (making one test's
setup depend on the code-under-test's side effect).

## V3 -- H5's pre-merge unobservability (VER-06, OBS-04 not falsely closed; ROBUST-04 not needlessly deferred)

**SATISFIED.** 09-05 (VER-06) and 09-06 (OBS-04) both state explicitly, in the objective and in Task 3,
that the live clause "is NOT closeable in this plan" / "is NOT closeable here," and both carry a
`<human-check>` tag phrased "MERGE-GATED, not satisfiable on this branch" rather than an `<automated>`
check. Acceptance criteria in both plans include an explicit negative: "No acceptance criterion in this
plan is satisfiable by the cross-OS restore actually working" (09-05) and "No acceptance criterion in
this plan is satisfiable by the rotation signal actually occurring" (09-06). ROBUST-04 is NOT deferred:
09-03 Task 3 runs `npm run check:action` as part of its own verify battery and asserts "npm run
check:action exits 0 at the committed tree with an empty diff" in that plan's own acceptance criteria --
correctly treated as PR-available rather than merge-gated, consistent with `action-bundle-drift`
carrying no `if:`.

## V4 -- H11's OBS-04 split across two positions, encoded via `depends_on`

**SATISFIED.** 09-02 (wave 1, `depends_on: []`) creates `09-ROTATION-SIGNAL.md` and is the
recorded-in-advance artifact; 09-03 (wave 2, `depends_on: ["09-01", "09-02"]`) is the rotation commit,
so the graph forces 09-02's commit to precede it. 09-06 (wave 5, `depends_on: ["09-02", "09-03",
"09-05"]`) is the message reword and depends on 09-03, so the graph forces the reword after the
rotation. Both orderings are encoded as `depends_on` frontmatter, not prose, matching the Phase 8
learning both context documents cite. 09-02's own acceptance criteria additionally verify the ordering
from git history directly ("`git log --oneline -1 -- .../cache-archive-path.ts` still points at a
commit that PREDATES this plan's commit").

## V5 -- non-vacuity controls actually present

**SATISFIED**, all six spot-checks present:
- VER-02 clause 2c: "the non-vacuity control, mandatory ... Assert the scanner FIRES on a fixture
  string containing the forbidden shape" (09-03 Task 1 Step 3).
- VER-03 clause 2: "the ordered multiset ... is exactly `['restoreCache', 'saveCache',
  'restoreCache']`. ... NOT `=== 3`" (09-03 Task 1 Step 6).
- VER-04: "Assert the THROW, not just the happy path. A VER-04 suite that still passes with the guard
  deleted is the failure mode" (09-03 Task 1 Step 7), with the happy path AND both conjuncts' throws as
  four separate assertions.
- VER-05: case 4 (non-zero exit) is labelled "**THIS IS THE CONTROL**" in the spec table and again in
  the acceptance criteria (09-04 Task 1).
- VER-07: "Remove it first -- otherwise the assertion passes on Nx's own `.nx/cache` and proves
  nothing" (09-03 Task 1 Step 7).
- PARITY-08: "STEP 4 -- clause 3, the NEGATIVE vacuity control ... build a LOCAL hostile copy of the
  project layer declaring `inputs: ['default']` and assert the merged result does NOT contain the
  `ci.yml` literal" (09-01 Task 1).
- VER-06 leaf half: "the two OS values produce DIFFERENT bytes for the same hash" is the first-listed,
  load-bearing assertion in 09-05 Task 1 Step 1.

## V6 -- the absence-claim trap (single-char character class + comment-stripping)

**SATISFIED**, via two correctly-differentiated mechanisms rather than one copy-pasted rule:
- VER-02 (09-03 Task 1 Step 3): scans `cache-archive-path.ts` SOURCE, which will carry prose naming the
  banned builders in its own comment lock. The plan mandates both techniques explicitly: bracket-class
  needles for every token, AND "The comment filter must drop lines whose trim starts with `//`, `/*`,
  `*` OR `*/`" -- explicitly widened beyond the repo's existing `//`-only precedent because this
  particular subject's lock is a `/** */` block. Both are also required in the acceptance criteria.
- OBS-04 (09-06 Task 1 Steps 2-3): the scanned subject is a runtime STRING (the emitted `core.warning`
  message), not a source file with comment lines to strip -- so "comment-stripping" has no applicable
  target here, and the plan correctly substitutes the equivalent discipline for this shape: the
  forbidden phrase must not be spelled anywhere in the SPEC FILE ITSELF, including its own comments
  ("with the bracket rationale comment-locked and the forbidden phrase not spelled anywhere in the
  file"), proven by a mutation in Step 3 that reintroduces the clause and observes the absence
  assertion go RED.
Both are the correct technique for their respective scan target; there is no gap.

## V7 -- H6's restructure (move into branches; update the three hand-authored literals)

**SATISFIED.** 09-05 Task 2 Step 2: "**Move the `:224` call INTO each branch.** Delete the pre-branch
`const body = ...` and add one inside the seed branch and one inside the verify branch," with an
explicit prohibition on the alternative ("Do NOT compute a conditional `producerOs` above the branch.
That reintroduces exactly the one-expression coupling that makes the vacuity trap reachable"). Task 2
Step 4 requires updating (not replacing with a `dogfoodBody(...)` call) the three hand-authored literals
at `action/index.spec.ts:165-213`, explicitly because "the literal now encodes the producer OS" and
`dogfood-body.ts`'s new `producerOs` parameter is REQUIRED to change the payload bytes (Task 2 Step 1:
"why the value is in the BYTES and not merely in the signature. A parameter that does not change the
payload makes the Windows leg's provenance claim true of every body regardless of producer"), making the
literal update load-bearing rather than cosmetic.

## V8 -- H9's six sites, three buckets, located by phrase, site 3 corrected narrowly

**SATISFIED.** 09-06 Task 2 lists all six sites by FILE + QUOTED PHRASE in `read_first` and executes
each: site 1 (`docs/advanced.md`, correction, with OBS-04's consumer-facing note folded into the same
edit), site 2 (`ci.yml` publish-matrix comment, correction, explicitly required to "supply the NEW
reason the matrix stays two-legged in the SAME sentence"), site 3 as TWO separate sub-edits -- "(3a) ...
stays TRUE ... make the attribution EXCLUSIVE" and "(3b) The trailing clause ... is the FALSE one and is
the actual target ... Replace only the trailing clause" -- sites 4/5/6 additive, each "RETAIN their
existing fault-degradation sentence verbatim." The `DOCS_08_SITES` guard is explicitly keyed on "file"
+ required phrase text, never line number, "because these six edits shift each other's lines inside one
commit."

## V9 -- retained substring `restored as a MISS`

**SATISFIED.** 09-06 Task 1 Step 1: "KEEP: the substring `restored as a MISS`, verbatim. Three spec
assertions depend on it and it is a good anchor." Repeated in the acceptance criteria and cross-checked
against `publish-mirror.spec.ts:426, :438, :486` by name.

## V10 -- over-serialization (WARNING, not blocker)

**ISSUE FOUND (WARNING).** 09-05's frontmatter declares `depends_on: ["09-03", "09-04"]`. Per
09-CONTEXT.md's D-35 sequencing (step 5 VER-05 "independent of the above; touches only the publish
path" and step 6 VER-06 "after VER-01/VER-03 land") and 09-RESEARCH.md Q12's validated table (VER-05
row: "CORRECT. Touches `action/index.ts` + a new leaf; no bundle obligation"), VER-06 (09-05) has no
logical dependency on VER-05 (09-04) -- it only needs 09-03 (VER-01/02/03/04/07). Nowhere in 09-05's
objective, tasks, or threat model is a reason given for the 09-04 dependency; it is silent frontmatter
without supporting prose. This forces wave 4 (09-05) to wait on wave 3 (09-04) completing even though
the two touch disjoint files (`compression-method.ts`/`action/index.ts`'s summary line vs.
`dogfood-body.ts`/`action/index.ts`'s branch restructure -- note both DO touch `action/index.ts`, which
is the most likely reason, see fix below) and have no stated behavioural coupling. Not a blocker: it
costs only wall-clock parallelism, not correctness, and a shared-file edit to `action/index.ts` by both
plans is a plausible (if unstated) merge-conflict-avoidance reason.

**Fix:** either drop `"09-04"` from 09-05's `depends_on` (if the two `action/index.ts` edits are in
disjoint regions and a merge is trivial), or add one sentence to 09-05's objective/key_links naming the
real reason (most likely: both plans edit `action/index.ts` and serializing avoids a conflicting merge
in the same file). Either resolution is fine; the current state is silent, which is what makes it worth
flagging per Phase 8's own learning ("a comment asking an executor to preserve ordering is not a
control; a `depends_on` graph is" -- the inverse also holds: an unexplained edge in the graph is not
self-documenting either).

## V11 -- scope (no Phase 10 work touched; read-back.ts:62 correctly in-scope)

**SATISFIED.** Every plan that touches a Phase-10-adjacent file names the boundary explicitly:
09-05 Task 2 Step 5 changes `read-back.ts:62` to `dogfoodBody(hash, cachePlatform())` and states "do NOT
touch `:10-31` or `:52-56`: those carry same-OS claims that belong to Phase 10's OBS-05/TRUST-11." 09-06
Task 2 lists `ci.yml`'s `publish-verify` same-OS claim, `read-back.ts:10-31,52-56`,
`publish-mirror.ts:146`, and `publish-mirror.ts:159`'s CORR-01 comment as untouched, "named out-of-scope
by content." 09-03's CORR-05 edit is scoped to site 1 only (`cache-archive-path.spec.ts`'s `tmpdir`
import), which 09-CONTEXT.md D-06 confirms is the one site that legitimately leaves in this phase; sites
2-4 are not referenced by any plan. No plan references the Releases asset name, `mirrored-by`/OBS-03, or
`ci.yml:1059`.

## V12 -- anti-patterns (11 named in 09-PATTERNS.md section 5)

**SATISFIED** on every spot-checked item: no second `no-restricted-syntax` config object (a spec-level
source scan is used instead, per 09-RESEARCH.md Q4's explicit rejection of the ESLint-rule route);
`isAbsolute()` is explicitly DROPPED from the rewritten `cache-archive-path.spec.ts` ("DROP the
`isAbsolute` assertion ... it would be actively misleading"); the construction guard anchors on
`process.cwd()` and explicitly prohibits `import.meta.url` in `actions-cache-backend.ts` ("Do NOT anchor
off `import.meta.url`" with the `esbuild.action.mjs:38` / `serve.ts:197` citation); `import.meta.url` IS
used, correctly, only inside the new spec-only `workspace-root-cwd.ts` helper, with the legitimacy
distinction comment-locked; `createActionsCacheBackend()` stays explicitly zero-parameter and
synchronous throughout (asserted in every plan that touches it); `start-cache-server/index.js` is never
hand-edited, only regenerated via `npm run build:action` with the diff inspected, never assumed empty.

---

## Cross-cutting checks (beyond the requested V1-V12)

- Git hygiene: every commit-creating task explicitly says "Stage each by name. Never `git add .`, `-A`
  or `-u`," matching the project's global git rules.
- 09-07 (the public-repo evidence file) explicitly gates on `git config user.email` being the approved
  public address before committing, and forbids raw `gh api` JSON / uploader identities / node ids /
  signed URLs in the committed file -- matching the project's public-repo contact-hygiene rule.
- REQUIREMENTS.md `:461-469` (DOCS-08's own words: "list is FOUR ... `README.md:125` and
  `docs/trust-and-security.md:155` ... must not be corrected as though they were wrong") matches
  09-06's implementation exactly, including the four-vs-six reclassification of `docs/advanced.md:45`
  the plan comment-locks rather than silently applying.
- No plan omits `check:action` from its acceptance battery when it touches a `serve()`-reachable file,
  and 09-04 (which does NOT touch a `serve()`-reachable file) still asserts `check:action` exits 0 with
  an EMPTY diff as the structural proof that `compression-method.ts` stayed out of the bundle (D-17).

---

## Issues (YAML)

```yaml
issues:
  - severity: WARNING
    plan: 09-05-PLAN.md
    finding: >
      depends_on: ["09-03", "09-04"] serializes VER-06 (09-05) behind VER-05 (09-04) with no stated
      reason in the plan text. Per 09-CONTEXT.md D-35 and 09-RESEARCH.md Q12, VER-06 only requires
      09-03 (VER-01/02/03/04/07); VER-05 is independent and touches only the publish path. The two
      plans do share an edit target (action/index.ts), which is a plausible unstated reason.
    fix: >
      Either drop "09-04" from 09-05's depends_on if the action/index.ts edits are in disjoint regions,
      or add one sentence to 09-05's objective/key_links naming the actual reason (shared-file
      merge-conflict avoidance in action/index.ts).
```
