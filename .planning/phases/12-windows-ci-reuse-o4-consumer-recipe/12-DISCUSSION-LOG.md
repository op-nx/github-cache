# Phase 12: Windows CI Reuse (O4) + Consumer Recipe - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-30
**Phase:** 12-windows-ci-reuse-o4-consumer-recipe
**Mode:** `--analyze --auto --chain` -- all gray areas auto-selected; the recommended option
auto-selected per question with a trade-off table logged first; no AskUserQuestion issued.
**Areas discussed:** Windows leg wiring shape, the XOS-05 write decision, the regression
detector's home, the DOCS-07 recipe's home, the discriminator command, the proving-run vehicle,
the graph-premise instrument's fate, the evidence record's location.

`[--auto] Selected all gray areas: Windows leg wiring shape, XOS-05 write decision, regression
detector home, DOCS-07 recipe home, discriminator command, proving-run vehicle, graph-premise
instrument fate, evidence record location.`

---

## Pre-flight, before any gray area

Two measurements taken at discuss time, both acted on rather than logged for later:

- `gsd-tools query init.plan-phase 12` returns all FOUR requirement IDs, with the familiar
  trailing period on the last (`DOCS-07.`). Recorded as CONTEXT D-00.
- **ROADMAP.md undercounts this phase.** Its `**Requirements**:` line says FOUR (including
  XOS-08), but its Traceability table has no XOS-08 row, its Coverage Validation says "Phase 12:
  3", and its deviations section says "intentionally light (3 requirements)". REQUIREMENTS.md says
  FOUR in both its traceability rows and its coverage tally. Authoritative count is FOUR.
  Recorded as CONTEXT D-01.

---

## Windows leg wiring shape (XOS-04, XOS-08)

**Trade-off analysis**

| Approach | Pros | Cons |
|----------|------|------|
| Three dedicated jobs (`build-windows`, `typecheck-windows`, `test-windows`), each `needs:` its ubuntu counterpart | Literal reading of SC1's "the corresponding ubuntu jobs"; mirrors `dogfood-seed` -> `dogfood-verify` as XOS-08 names; three independent `[remote cache]` observations in three named job logs; each leg starts as soon as ITS producer finishes; matches the repo's distinct-named-job-per-concern convention | Takes the duplicated sidecar block from 4 copies to 7, on an invariant `ci.yml` itself calls unguarded |
| One `windows-reuse` job with `needs: [build, typecheck, test]` running all three targets | Shortest diff -- one new sidecar block (5 copies, not 7); one job to maintain | Collapses three observations into one log; every target waits behind the slowest producer; reads "corresponding jobs" loosely; a single-target regression reddens a job whose name does not say which |
| Convert `build`/`typecheck`/`test` to an OS matrix | Fewest new job blocks | **Structurally foreclosed.** `needs:` is per-JOB, never per-LEG, so a matrix leg cannot depend on its sibling -- which is exactly what XOS-08 requires. XOS-08 says so in its own words |

Recommended: **three dedicated jobs** -- SC1 says "the corresponding ubuntu jobs" (1:1), XOS-08
names the two-job `dogfood-seed` -> `dogfood-verify` pair as the mirror, and the matrix option is
not available at all.

| Option | Description | Selected |
|--------|-------------|----------|
| Three dedicated jobs | One Windows job per target, each `needs:` its ubuntu counterpart | Y |
| One combined `windows-reuse` job | All three targets, one sidecar, `needs:` all three | |
| OS matrix on the existing jobs | Structurally impossible under `needs:` | |

**Choice:** `[auto] Windows leg wiring shape -- Q: "How are the Windows build/typecheck/test legs
wired?" -> Selected: "Three dedicated jobs, each needs: its ubuntu counterpart" (recommended
default)`
**Notes:** Recorded as CONTEXT D-02, with the lazier one-job alternative and its costs written
into the decision so a planner does not re-derive it. The sidecar-block count going 4 -> 7 is
carried to Deferred Ideas as the drift-guard entry.

---

## The XOS-05 write decision

**Trade-off analysis**

`selectBackend` was read in full this session. The option space is smaller than the requirement's
phrasing suggests:

| Approach | Pros | Cons |
|----------|------|------|
| The Windows legs WRITE (pass `GITHUB_TOKEN`, write-trusted event -> `createActionsCacheBackend()`) | The only configuration that can read the Actions cache at all, so the only one under which O4 is provable | Windows becomes a second producer of the three hashes; XOS-05's conditional fires and the scheduled `--skip-nx-cache` detector becomes required |
| Read-only Windows legs (withhold `GITHUB_TOKEN`) | Would preserve Linux-only production | **Does not do what it sounds like.** A write-trusted context with no token returns `createReadOnlyMemoryBackend()` -- an EMPTY backend. Every read MISSes and O4 is unprovable |
| Add a read-only knob or action input | Would give a genuine RO Actions-cache branch | Forbidden: D2-02 (no new env knob, no new action input), TRUST-05 (no caller-facing mode flag), PARITY-07 (public-surface guard passes unchanged) |

Recommended: **they write** -- forced by the code, not chosen, and recorded as such.

| Option | Description | Selected |
|--------|-------------|----------|
| They write; record the consequences | Second-producer fact appended to TRUST-11/12; detector becomes required | Y |
| They read only | Yields an empty memory backend; O4 unprovable | |
| Add an RO knob | Forbidden by D2-02 / TRUST-05 / PARITY-07 | |

**Choice:** `[auto] XOS-05 write decision -- Q: "Do the Windows legs write?" -> Selected: "Yes,
they write -- forced by selectBackend, recorded with both consequences" (recommended default)`
**Notes:** CONTEXT D-06 and D-07. TRUST-11 already predicted this in Phase 10's threat model and
named where the residual risk moves. The `needs:` edge from D-02 removes the RACE but not the
second-producer fact; both halves get recorded.

---

## The regression detector's home and shape (XOS-05's conditional clause)

**Trade-off analysis**

| Approach | Pros | Cons |
|----------|------|------|
| New `.github/workflows/<detector>.yml` -- `schedule` + `workflow_dispatch`, one windows-11-arm job, `--skip-nx-cache`, no sidecar, hard fail | Mirrors `cleanup.yml`'s shipped separate-scheduled-workflow rationale; `workflow_dispatch` lets it be proven green BEFORE merge, since `schedule` fires only on the default branch; no sidecar because `--skip-nx-cache` bypasses the cache entirely | A new workflow file starts unregistered in `nx.json`, so any spec asserting on it repeats PARITY-08's stale-cached-PASS defect unless registered in the same commit |
| Add `schedule:` to `ci.yml` with `if:` gates | No new file | Fires all nineteen jobs on a schedule unless every one grows an `if:`; `cleanup.yml`'s own header records why a scheduled concern lives in its own file |
| Defer the detector to v0.0.3 | Smallest phase | Not available -- XOS-05's own words make it "required rather than optional" once the legs write |

Recommended: **new workflow file**, with `workflow_dispatch` alongside the cron.

| Option | Description | Selected |
|--------|-------------|----------|
| New scheduled workflow file | `cleanup.yml`'s shape; daily off-hour cron; `workflow_dispatch` too | Y |
| `schedule:` on `ci.yml` | Requires nineteen `if:` gates | |
| Defer to v0.0.3 | Forbidden by XOS-05's conditional | |

**Choice:** `[auto] Regression detector home -- Q: "Where does the scheduled --skip-nx-cache
Windows job live?" -> Selected: "A new scheduled workflow file with workflow_dispatch"
(recommended default)`
**Notes:** CONTEXT D-08 and D-09. Hard fail is correct here and is NOT the "tripwire that fires on
correct work" class -- a red leg means a real Windows-only regression. The `lint` job's
"prove the target actually ran" step is reused, because `nx run-many` on a missing target prints
"NX No tasks were run" and exits 0.

---

## Where the DOCS-07 recipe lives

**Trade-off analysis**

| Approach | Pros | Cons |
|----------|------|------|
| New `docs/cross-os.md` | Matches the repo's one-topic-per-file docs convention; this is the milestone's headline consumer deliverable, not an advanced opt-in | Costs one `nx.json` `test`-input line and a nav link |
| A section inside `docs/advanced.md` | Shortest diff -- `advanced.md` is ALREADY an `nx.json` `test` input and already covered by `docs-adoption.spec.ts`, so DOCS-07's registration clause is satisfied for free | Buries a safe-by-default cross-OS adoption recipe inside a page about the opt-in Releases reader and publish/cleanup |
| A top-level `CROSS-OS.md` at the repo root | Discoverable | Breaks the `docs/` convention every other consumer doc follows |

Recommended: **new `docs/cross-os.md`** -- the registration line is one line and this phase pays a
`test` rotation regardless.

| Option | Description | Selected |
|--------|-------------|----------|
| New `docs/cross-os.md` | One topic per file; registered in `nx.json` test inputs; phrase-keyed drift guard | Y |
| Section in `docs/advanced.md` | Free registration, muddled topic | |
| Root `CROSS-OS.md` | Off-convention | |

**Choice:** `[auto] DOCS-07 recipe home -- Q: "Where does the consumer recipe live?" -> Selected:
"A new docs/cross-os.md, registered and drift-guarded" (recommended default)`
**Notes:** CONTEXT D-10 through D-14. Section ORDER is fixed by the requirement (safe default
first, checklist second). Checklist items are INHERITED verbatim from `08-ROOT-CAUSE.md`'s
`## Hand-off to Phase 12 (DOCS-07)` -- items 1-5 ship, item 6 is struck and falsified and its own
text says to document nothing.

---

## The discriminator command (DOCS-07 SC4)

**Trade-off analysis**

| Approach | Pros | Cons |
|----------|------|------|
| One string, shared by `nx.json` and the doc, guarded by equality | The repo's established single-source discipline (`releaseAssetName`, `CACHE_KEY_PREFIX`, `trust.generated.cjs`); the drift guard can assert equality; the recipe teaches what the repo dogfoods | Editing `nx.json` rotates `integration` and `test` |
| Document a hardened form while `nx.json` keeps `node -p process.platform` | No rotation | Docs asserting something the code does not do is the exact defect class DOCS-08 spent a phase correcting; the guard degrades to a phrase check |
| Shell redirect (`2>/dev/null`) as the hardening | Obvious | **NOT shell-invariant.** `2>/dev/null` is POSIX and `2>nul` is cmd.exe; Nx runs a `runtime` input through the platform default shell, so a redirect makes the command FAIL on one OS rather than merely differ |

Recommended: **lock the direction (one shared string), withhold the string.** The rotation cost is
affordable and measured -- O2 and O3 are closed, so no perishable measurement depends on the
current `integration` value, and CORR-03 asserts only that the two legs DIFFER.

| Option | Description | Selected |
|--------|-------------|----------|
| One shared string, exact value researched | Direction locked (CONTEXT D-15); string owned by U-01 | Y (direction only) |
| Doc-only hardening | Reopens the DOCS-08 defect class | |
| Shell redirect | Not shell-invariant | |

**Choice:** `[auto] Discriminator command -- Q: "What is the stderr-immune discriminator?" ->
Selected: DIRECTION ONLY. The exact string is WITHHELD from auto-lock and recorded as UNRESOLVED
U-01.`
**Notes:** HIGH impact (a consumer contract; changing it later invalidates an adopter's whole
cross-OS partition) and NOT-HIGH confidence (three underlying facts are asserted across five
documents but never measured: that `hash_runtime` includes stderr, that the current command's
stderr is empty on both runners today, and which hardening mechanism is shell-invariant).
`gsd-phase-researcher` owns it with a three-step falsifiable check, including the branch to take
if the stderr premise turns out to be FALSE.

---

## The proving-run vehicle

**Trade-off analysis**

| Approach | Pros | Cons |
|----------|------|------|
| A same-repo pull-request run | `build`/`typecheck`/`test` are NOT push-gated, so they run on PRs; `pull_request` on github.com IS write-trusted (`trust.ts` `HOST_GATED_EVENTS`), so the ubuntu leg genuinely saves; producer and consumer sit in ONE run behind a `needs:` edge, so there is no cross-tree commensurability question; `o3-witness` and the positive control were already GREEN on a PR | Requires a same-repo branch -- a FORK PR gets a read-only Actions cache, so ubuntu saves nothing and both legs MISS |
| A temporary maintainer-authorised `main` push + restore | The Phase 9 / 10 / 11 precedent, contract already established | Buys nothing here. The ONLY reason O3 needed it was `hash-parity` pinning `head.sha` while `integration` took the merge commit -- two trees. O4 has no cross-job hash citation, so that argument does not transfer |
| Wait for the real merge | Zero ceremony | The phase cannot close on evidence that does not exist yet |

Recommended: **same-repo PR run** -- the first departure from the Phase 9-11 push pattern in this
milestone, taken on measured grounds rather than habit.

| Option | Description | Selected |
|--------|-------------|----------|
| Same-repo PR run | One run, `needs:`-ordered, write-trusted | Y |
| Temporary `main` push + restore | Precedent, but its reason does not transfer | |
| Wait for merge | No evidence | |

**Choice:** `[auto] Proving-run vehicle -- Q: "How is O4 proven live?" -> Selected: "A same-repo
pull-request run, no temporary main push" (recommended default)`
**Notes:** CONTEXT D-18, with the fork-PR precondition written in as a hard plan requirement and
the push contract kept available unchanged if the maintainer prefers it. D-19 pre-registers the
counts in the plan; D-20 keeps `Cache: n/m hit` marked non-discriminating.

---

## The graph-premise instrument's fate

**Trade-off analysis**

`capture-hashes.mjs --assert-graph-premise` was read this session. It asserts that
`nx run-many -t integration` resolves no `build`/`typecheck`/`test` task -- a property of the TASK
GRAPH. XOS-04 adds jobs that run different commands; it does not change `integration`'s
resolution. So the assertion keeps passing.

| Approach | Pros | Cons |
|----------|------|------|
| Keep the code, correct the claim, supply the replacement reason | The assertion is still TRUE and still a real gate against an Nx upgrade changing the inferred `dependsOn`; the repo's own rule is that correcting a claim requires supplying a replacement reason | Two comment blocks to rewrite (`ci.yml` and `capture-hashes.mjs`), in the same commit as the legs |
| Delete the mode and its CI step | Smallest surface | Deletes a passing gate over a still-true property, and leaves `11-EVIDENCE.md` citing an instrument that no longer exists |
| Leave both comments as-is | No work | Ships a file claiming producer attribution that XOS-04 has just destroyed -- the exact defect DOCS-08 corrected across four sites |

Recommended: **keep, correct, replace the reason.**

| Option | Description | Selected |
|--------|-------------|----------|
| Keep + correct the evidentiary claim | Cite `11-EVIDENCE.md` O1 as the frozen attribution record | Y |
| Delete the mode | Removes a passing gate | |
| Leave the comments | Ships a false claim | |

**Choice:** `[auto] Graph-premise instrument -- Q: "What happens to --assert-graph-premise?" ->
Selected: "Keep the assertion, correct the evidentiary comment in both places" (recommended
default)`
**Notes:** CONTEXT D-21. Phase 11's deferred "every-commit Vitest version" was revisited here and
DECLINED with a reason -- XOS-04 removes the premise's evidentiary value, so there is nothing left
for a second gate to protect.

---

## The evidence record's location

Not a live gray area -- locked upstream and logged for completeness. TEST-08's own words are
"Phase 12 appends the O4 row to the same evidence record", and `11-EVIDENCE.md:1002-1019` already
carries a `## O4 (XOS-04, XOS-05) -- RESERVED` block with a do-not-fill-and-do-not-delete
instruction.

**Choice:** `[auto] Evidence record -- Q: "Where does the O4 evidence go?" -> Selected: "Fill the
RESERVED O4 section in 11-EVIDENCE.md in place; no 12-EVIDENCE.md" (locked by TEST-08 and Phase
11's D-22)`
**Notes:** CONTEXT D-22, including updating the four-row status table at `11-EVIDENCE.md:34` in the
same edit.

---

## Claude's Discretion

- The three Windows job names.
- The regression-detector workflow's filename, job name, and exact cron minute; and whether it
  runs one `nx run-many -t build typecheck test --skip-nx-cache` or three steps.
- The `docs/cross-os.md` filename, heading structure, and link points.
- Whether the DOCS-07 drift guard is a new spec or an extension of `docs-adoption.spec.ts`.
- Plan count and wave grouping, subject to CONTEXT D-17 (this phase has no perishable-measurement
  ordering constraint) and to genuine build-order dependencies.

## Deferred Ideas

- A drift guard over the duplicated sidecar block (going from 4 to 7 copies raises its value; still
  a new capability no Phase 12 requirement asks for).
- An every-commit Vitest version of the graph-premise assertion -- revisited from Phase 11 and
  DECLINED with the reason.
- Collapsing the publish matrix to one leg -- out of scope for v0.0.2 by name; XOS-05 being proven
  here is exactly the trigger that unblocks it for v0.0.3.
- Archive file-mode handling across the OS boundary -- an XOS-05 investigation item, never a
  requirement.
- PARITY-04's "does my everyday box hit" acceptance question.
- macOS in any form.
- Regenerating `.planning/codebase/*` via `/gsd:map-codebase` (carried since Phase 10).
- `roadmap update-plan-progress`'s duplicate plan list, and `requirements mark-complete` leaving a
  parenthetical traceability row out of sync with its own checkbox.

## Todos

`todo.match-phase 12` returned `todo_count: 0`. No todos folded, none reviewed.
