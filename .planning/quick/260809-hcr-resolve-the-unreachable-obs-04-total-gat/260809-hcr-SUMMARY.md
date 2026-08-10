---
phase: 260809-hcr
plan: 01
status: complete
subsystem: docs
tags: [OBS-04, ROBUST-04, DOCS-08, docs-correction, content-lock]
requirements: [OBS-04, ROBUST-04, H-D2, H-D3]
dependency_graph:
  requires: []
  provides:
    - 'docs/advanced.md states the CONDITION that selects between publish''s two warnings'
    - 'a docs-same-os-claims.spec.ts row that reddens on either false promise returning'
  affects:
    - 'ROBUST-04 (its all-restore-MISS clause is now known false -- capture filed, see below)'
tech_stack:
  added: []
  patterns:
    - 'FILE + QUOTED PHRASE content lock, extended rather than re-invented'
key_files:
  created: []
  modified:
    - docs/advanced.md
    - packages/github-cache/src/docs-same-os-claims.spec.ts
decisions:
  - 'Correction and guard land in ONE commit, per the rule docs-same-os-claims.spec.ts states about itself'
  - 'The harness failure message is made claim-neutral rather than left hardcoded to the same-OS claim'
metrics:
  duration: ~35m
  completed: 2026-08-09
commits:
  - 909a88a
---

# Quick 260809-hcr: correct the version-bump paragraph in docs/advanced.md -- Summary

`docs/advanced.md` told an adopter that the first publish after a cache-version bump
"restores everything as a MISS and mirrors nothing" and that "the warning it emits names
the axis". Both halves were false for the path the paragraph describes. The paragraph now
states the CONDITION that decides which of publish's two warnings a bump produces, and
promises neither.

## What each rewritten sentence claims, and which ledger claim licenses it

| Sentence (abridged) | Claim |
|---|---|
| "rotates it for every entry already sitting in the Actions cache, so every entry that predates the bump restores as a MISS" | surviving true half of the original text |
| "That is expected **once per version-affecting change**." | retained verbatim -- the pre-existing DOCS-08 row requires this literal |
| "Which warning that produces depends on whether the publish run also wrote entries of its own at the new cache version." | 1, 3 |
| "A run that did -- this repository's CI, and any workflow where the sidecar and publish share a run -- restores and mirrors those, so the all-MISS warning cannot fire." | 3 |
| "Expect instead a spike in restore-MISS counts, and a warning once that cohort dominates the enumeration." | 2 |
| "weighed against a lower bound on the miss proportion and not the raw ratio ... around 90% of ten entries against around 60% of a hundred" | 2, 4 |
| "It reports the miss count, the enumeration size, which denominator that proportion is over, and two candidate causes." | 6 |
| "A publish-only or scheduled run that wrote nothing of its own has an entirely historical enumeration, and that is the shape the all-MISS warning is reserved for -- alongside a runtime token whose Actions-cache read scope regressed." | 7 |
| "It names the axis as well (... a separate mechanism from the Nx task hash and from the Release asset name) and the same two causes worth checking." | 6 |
| "Two consecutive all-miss runs with no version-affecting change in between is the signal that something else is wrong" | retained tripwire, reattached to the all-MISS warning where it belongs |
| "The two warnings are siblings at one branch pair in `publish/publish-mirror.ts`." | H-D3's citation half |
| "the two land in the same run, so expect one disrupted publish run, not two" | 8 |

No sentence was written that the ledger does not license. Claim 5 stayed OUT of the docs
entirely, as instructed -- no run ids and no internal counts reached consumer-facing text.

**Claims 4 and 5 were re-derived from `wilsonLowerBound` as written, not taken on trust.**
The smallest miss count clearing the 0.5 target rate is 9 of 10 (90%), 15 of 20 (75%),
31 of 47 (66%) and 67 of 112 (60%) -- the ledger's four figures exactly. The recorded
rotation's 41 of 47 gives 0.748, over the target rate, confirming claim 5's arithmetic. The
docs quote only the two extreme figures, as round approximations ("around 90% of ten
entries against around 60% of a hundred"), because a consumer needs the SHAPE of the
scale-dependence and not a lookup table.

## The word `run`, deliberately

The condition phrase carries `run` and not `job`, and the guard pins the phrase containing
it. The same document states in bold, twenty lines below, that publish must not share a JOB
with a running sidecar. A draft that slipped to "share a job" would have made the document
contradict itself within one screen.

## The six discriminating phrases

Three `required`, each taken from a single line of the corrected file:

- `depends on whether the publish run also wrote entries of`
- `a warning once that cohort dominates the enumeration`
- `that is the shape the all-MISS warning is reserved`

Three `forbidden`, each proven a single-line substring of the pre-edit file:

- `/restores everything as a M[I]SS and mirrors/` -- stops at `mirrors` because the original
  sentence wrapped between `mirrors` and `nothing`; a phrase crossing that wrap would have
  matched nothing and passed silently.
- `/warning it emits names the axis/`
- `/one all-M[I]SS publish/` -- stops at `publish` because the longer phrase matches only the
  lesser of that sentence's TWO occurrences. Measured on the pre-edit file, the short pattern
  hits both the asset-name paragraph's closing sentence AND the bolded lead sentence of the
  paragraph under correction -- the most-read statement of the false promise. A pattern
  carrying the tail would have left that lead sentence free to return with the suite green.

## The red log -- proof the guard bites

Restoring the pre-edit `docs/advanced.md` over the corrected file and re-running the suite
produced exactly six failures against an otherwise untouched baseline:

```
x still contains `depends on whether the publish run also wrote entries of`
x still contains `a warning once that cohort dominates the enumeration`
x still contains `that is the shape the all-MISS warning is reserved`
x no longer matches /restores everything as a M[I]SS and mirrors/
x no longer matches /warning it emits names the axis/
x no longer matches /one all-M[I]SS publish/

Tests  6 failed | 1073 passed (1079)
```

All three required phrases report ABSENT against the pre-edit text, so none of them passes
on uncorrected prose. All three forbidden patterns report PRESENT, so none is dead weight.
The `1073 passed` is the stated pre-task baseline exactly, which independently confirms the
six failures are the six new assertions and nothing else moved.

The third pattern's two-site requirement was checked directly against the pre-edit file as
well as through the suite: it matches on both the bolded lead sentence and the asset-name
paragraph's closing sentence. Two hits, as required -- one would have meant the tail crept
back in.

## The harness fix

The shared `forbidden` reporter was hardcoded to the same-OS claim: its title said the file
"no longer asserts same-OS restore" and its message said the file "has drifted BACK to a
same-OS-restore claim", with remediation about `enableCrossOsArchive`. A reader who
reintroduced the all-MISS promise would have been told they reintroduced a same-OS claim --
which defeats the entire reason this correction gets its own row. Both are now claim-neutral
and defer to the row's own docstring. Row shapes and the `required` branch's message are
untouched.

## The two findings the plan asked to be met in the artifact

**H-D1's DECISION stands; its RATIONALE is false and did not reach the docs.** H-D1 justified
the gate as reachable under `ROBUST-04` bundle drift because "publish cannot restore ANYTHING
-- including the entries this very run wrote". Drift is between the COMMITTED
`start-cache-server/index.js` that the sidecar jobs run and its source; but
`packages/github-cache/action.yml` declares `main: dist/action/index.js`, and the publish job
runs `mirror-seed` and `publish` from that freshly built dist in the same job. Under drift the
sidecar's entries miss while the same-run seed still restores, leaving `mirrored >= 1` and the
total gate silent. The gate itself was left untouched per H-D1, and the docs took claim 7's
consumer-facing framing instead of the drift story.

**H-D3 was already satisfied at the code, so no code edit was made.** The distinction lives at
the branch pair in `publish-mirror.ts` under "WHICH BRANCH ACTUALLY FIRES ON A ROTATION", and
it is accurate as written -- including its "IN THIS WORKFLOW" scoping and its clause that the
gate above covers only a read-scope regression wide enough to hide the seed itself, which the
H-D1 finding confirms rather than contradicts. Adding drift to that clause would have
introduced a sixth false comment of exactly the class this task exists to remove. H-D3's
remaining half is the docs citation, which task 1 supplied.

## Follow-up capture the plan requires -- FILED

`ROBUST-04` in `REQUIREMENTS.md` still states that bundle drift surfaces "only as the
all-restore-MISS warning". The H-D1 finding above proves that false: under drift the same-run
seed written from the freshly built dist still restores, so `mirrored >= 1` and the
all-restore-MISS warning cannot fire. The proportional branch is what a drifted run would
show.

**Why a capture and not an edit:** C4 freezes the milestone pending the maintainer's code and
security reviews. `REQUIREMENTS.md` is a milestone artifact, so amending it now would put an
unreviewed requirement change into a diff the maintainer is mid-review on. FILED at `.planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md` by the orchestrator (a subagent cannot invoke the command, and `.planning/` is the orchestrator's to write). A capture parks the
finding where the next unfrozen cycle picks it up without touching the frozen record.

**Status: not filed by this executor.** Filing it writes into `.planning/`, which this task's
constraints reserve to the orchestrator, and a slash command is not invocable from here. The
capture text above is ready to file verbatim. **This is the one plan step left open.**

## What could not be verified

- **Whether a consumer ever sees either warning is NOT OBSERVABLE from here**, and is recorded
  as such rather than inferred. Nothing in this repository can observe a stranger's publish
  run. The claims about which warning a given run shape produces are derived from the branch
  conditions in `publish-mirror.ts`, not from any consumer observation.
- **The proportional warning is not promised to fire on a version bump, and this SUMMARY does
  not promise it either.** Whether the partial branch's threshold is reached depends on the
  ratio of historical to same-run entries in a given enumeration, which varies per repository
  and per run. The docs say a warning follows "once that cohort dominates the enumeration" --
  deliberately weaker than a promise, and it should stay weaker.
- **Claim 5 remains a RETROSPECTIVE computation.** The partial branch did not exist at the one
  recorded rotation, so the warning was never observed to fire. What is verified is that the
  recorded counts clear the target rate, not that any warning was emitted.
- **CI behaviour of the corrected docs is untested by definition** -- prose has no runtime. The
  guard proves the text says what it says; it cannot prove the text is true. That the text is
  true rests on the branch conditions cited above.

## Verification run

| Check | Result |
|---|---|
| `nx run-many -t typecheck lint test -p github-cache --skip-nx-cache` | PASS -- 1079 tests, 43 files (1073 baseline + 6 new assertions) |
| red run against pre-edit docs | FAILS as designed -- 6 failed, 1073 passed |
| `nx format:check --all` | two PRE-EXISTING failures, both under the gitignored `CLAUDE-SECURITY-*` scan-output directory. Neither file touched by this task appears. |
| `npm run check:action` | PASS -- exit 0, tree clean after rebuild |
| `npm run typecheck:action` | PASS -- exit 0 |
| `git status --short` | exactly the two intended files, now committed |

Both action checks were run as npm scripts, not through `nx run-many`, because `nx run-many`
drops a non-existent target silently and still exits 0.

## Deviations from plan

**One, deliberate: both files landed in ONE commit rather than one commit per task.**
`docs-same-os-claims.spec.ts` states the rule about itself -- a reworded site updates its ROW
in the SAME commit. Splitting the tasks would have shipped an intermediate commit carrying
corrected prose with no guard on it, which is the precise drift the table exists to prevent.
Nothing else in the plan was changed, and the per-task verification was run in full at each
stage regardless.

No plan contradiction was encountered. Every numeric claim the plan asserted was re-derived
independently and matched.

## Self-Check: PASSED

- `docs/advanced.md` -- FOUND, modified
- `packages/github-cache/src/docs-same-os-claims.spec.ts` -- FOUND, modified
- commit `909a88a` -- FOUND in `git log`
