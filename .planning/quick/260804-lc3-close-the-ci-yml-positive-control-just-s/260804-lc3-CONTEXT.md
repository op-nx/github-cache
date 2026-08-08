# Quick Task 260804-lc3: Close the ci.yml positive-control "just saved" doc defect - Context

**Gathered:** 2026-08-04
**Status:** Ready for research (one BLOCKER for research to settle -- see `<open_questions>`)

<domain>
## Task Boundary

Correct the `integration` job's positive-control comment block in `.github/workflows/ci.yml`, which
justifies the probe with a premise NARROWER than the code's real invariant. Found and deliberately
deferred by quick `260804-h3b`; deferred only because `ci.yml` is a declared `test` input and
rotating the hash would have broken that task's pre-registered shape. That constraint is now GONE.

Prose/comment correction only. NO behaviour change to the probe, its acceptance set, or any job.

</domain>

<the_defect>
## What was measured, and what the comment claims

**Measured, twice, in `260804-h3b`.** On both observed runs the ubuntu `integration` leg took a cache
HIT, so its task never executed and NOTHING was saved -- yet the positive control returned **200**
both times. Runs `30907575624` and `30910935382`.

**Why it still returned 200 -- the code path.** The probed key resolves through
`actions-cache-backend.ts:219-225`, an UNCONDITIONAL fresh `cache.restoreCache` against the run's
whole readable scope. Nothing in that path is save-conditioned. So the key is present when the leg
either SAVED it (Case A) or RESTORED it (Case B).

**The comment asserts the narrower half.** The real invariant is "restored OR saved"; the block says
"saved" in five places.

## The five sites -- root-cause scope, not one line

| Line | Text | Why it is wrong |
|------|------|-----------------|
| 210 | "that probe reads the same merge-ref scope its own save just wrote" | In the `build` job's fork-PR block, describing the integration probe. Assumes a save occurred |
| 1004 | "this probe proves the service really round-tripped the entry this leg's own task just saved" | The primary claim |
| 1022 | "'known-present after the task's own save' holds on a fork exactly as it does on the same-repo branch PRs" | The fork-PR resolution QUOTES the narrow premise |
| 1033 | "the key is known-present after the task's own save, so a retry could only paper over a real failure" | The no-retry-loop justification |
| 1040 | "Placement: AFTER the Nx run, because it is that task's own save that makes the key present" | The step-placement justification |

Correcting only :1004 would leave four sites still asserting the narrow premise. The repo's own
DOCS-09 precedent is the standard here: "all SEVEN sites justifying the ungated counts corrected in
the SAME commit that gates them."

## Scope is ONE step, verified -- not four

Only ONE positive-control step exists in the whole workflow (`ci.yml:1056`, the `integration` job).
The three read-only Windows legs (`build-windows`, `typecheck-windows`, `test-windows`) have NO
positive control, so the narrow premise is not replicated across them. Checked with
`rg -n "name: Positive control"` -- exactly one hit.

</the_defect>

<decisions>
## Implementation Decisions

### Correct all FIVE sites, in one commit
Root-cause discipline: a guard in the shared premise, not a patch on the one line the report named.
Evidence-backed by the DOCS-09 precedent above. Not auto-decided on preference.

### Comment-only edit; no behaviour change
The probe's acceptance set stays **200 ALONE**. The no-retry-loop decision stays. The
AFTER-the-Nx-run placement stays. Only the REASONS are widened. The control's conservatism is
unchanged and must be restated, not weakened: it can false-negative, never false-positive.

### The hash rotation is accepted, not worked around
`{workspaceRoot}/.github/workflows/ci.yml` is a declared `test` input (PARITY-08), so this edit
rotates `test`'s hash and the next run MISSES and re-runs `test`. That is normal, and it is the
correct behaviour PARITY-08 exists to produce. There is no pre-registration left to protect --
`260804-h3b` is committed and verified.

### `codeLines`-based gates are structurally blind to this edit
`dogfood-cross-os.spec.ts:49-54` filters out every line whose trimmed form starts with `#`. So no
`codeLines` assertion can break, and none can protect it either -- which is exactly how this drifted.

### Claude's Discretion
- Exact wording of the corrected paragraphs.
- Whether to record the correction's provenance (the two run IDs) inline or by reference.

</decisions>

<open_questions>
## BLOCKER for research -- do NOT auto-decide this one

**Q1. Does the control's stated FAILURE-IMPLICATION still hold on a HIT run?**

`:1005-1006` says: "A 404 here would therefore mean a dead sidecar had masqueraded as a cache MISS,
which would make the whole MISS observation inadmissible."

That sentence is about validating a **MISS** observation. But on a Case-B run the leg **HIT**, so
there is no MISS to invalidate -- and a 404 would instead mean the sidecar could not read a key the
Nx client had just successfully read through it, which is a different (and still real) anomaly.

So the block may carry TWO distinct defects, not one: the presence-mechanism claim (settled -- it is
"restored OR saved") and the failure-implication claim (OPEN).

This is HIGH IMPACT and my confidence is NOT high, so per the `--auto` trap-quadrant rule it is
recorded here rather than locked. **A freshly-asserted wrong correction is worse than the inherited
defect**, because the original at least has the excuse of predating the evidence.

Research must answer: on a run where the leg HIT, what exactly would a 404 from this probe mean, and
is "the MISS observation is inadmissible" still the right consequence to state -- or does the
sentence need a second branch? If research cannot settle it from the code and the two runs, record it
UNRESOLVED and correct ONLY the presence-mechanism half, leaving the failure-implication sentence
untouched and flagged. Half a correct fix beats a whole confident guess.

## Secondary questions

**Q2. Should a comment lock be added, and if so where?** `dogfood-cross-os.spec.ts:223-225` states
the policy: "NO comment-phrase assertion belongs here. `codeLines` strips every `#` line, so a
comment lock placed in this file is vacuous by construction; XOS-07's comment lock lives in
`docs-same-os-claims.spec.ts`, whose read is RAW." So the home is decided IF a lock is wanted.
Research should report that spec's SHAPE -- if it is row/table-driven, a lock is cheap and idiomatic;
if each lock is bespoke, weigh it against the precedent in `260803-0rr`, which declined a standing
guard as "third-party behaviour that would redden on an unrelated bump". Note this case is NOT that:
the subject is our own comment, and it drifted precisely because nothing guarded it.

**Q3. Is the fork-PR conclusion at :1013-1027 still sound once the premise widens?** It concludes the
control needs no trigger gate and keeps its 200-only acceptance set. Widening "saved" to "restored OR
saved" should only STRENGTHEN that conclusion, but confirm rather than assume -- it cites GitHub docs
for a fork case this repo has never run.

</open_questions>

<canonical_refs>
## Canonical References

- `.github/workflows/ci.yml:999-1055` -- the comment block being corrected; `:1056` the probe step
- `.github/workflows/ci.yml:203-215` -- the fifth site, in the `build` job's fork-PR block
- `packages/github-cache/src/backend/actions-cache-backend.ts:219-225` -- the unconditional `restoreCache` that makes the real invariant "restored OR saved"
- `packages/github-cache/src/dogfood-cross-os.spec.ts:49-54` -- `codeLines`, which strips `#` lines
- `packages/github-cache/src/dogfood-cross-os.spec.ts:223-225` -- the comment-lock policy and its named home
- `.planning/quick/260804-h3b-fix-o3-witness-case-b/260804-h3b-SUMMARY.md` -- where this defect was found and why it was deferred
- Runs `30907575624` and `30910935382` -- both legs HIT, both controls returned 200

</canonical_refs>
