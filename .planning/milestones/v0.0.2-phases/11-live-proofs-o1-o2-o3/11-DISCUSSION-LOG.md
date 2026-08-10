# Phase 11: Live Proofs -- O1, O2, O3 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-29
**Phase:** 11-live-proofs-o1-o2-o3
**Mode:** `--analyze --auto --chain` -- trade-off table per area, recommended option auto-selected,
no interactive prompt. One HIGH-impact / NOT-HIGH-confidence item withheld from auto-lock.
**Areas discussed:** local proof harness, warm-mirror pre-flight, rotation ordering, task-graph
instrument, producer attribution, O3 mechanics, proving-run event, evidence layout

---

## Area 1 -- O1/O2 local proof harness: how "a cleared local Nx cache" is reached

**Trade-off analysis**

| Approach | Pros | Cons |
|---|---|---|
| Literal `nx reset`, then start the sidecar | TEST-10's exact mechanism AND its exact order; the mandated order is itself the mitigation for the `.nx/cache` ENOENT -> 500 hazard VER-07 records | deletes the repo's real `.nx/cache`; a sidecar already running when it fires breaks the next PUT |
| COLD-DIRECTORY variant (`NX_CACHE_DIRECTORY` + `NX_WORKSPACE_DATA_DIRECTORY` into the scratchpad) | reaches the identical cold state; mutates nothing in the repo; REMOVES the ordering hazard rather than satisfying it; the shape BOTH prior local measurements used (10-01, quick 260725-w3s) | deviates from the requirement's literal mechanism in the very phase that CLOSES it; `CACHE_ARCHIVE_DIR` is not redirected, so the archive still lands in the repo's `.nx/cache` |
| Run both variants | belt-and-braces | doubles the measurement work for one question |

| Option | Description | Selected |
|--------|-------------|----------|
| Literal `nx reset` then sidecar | Requirement's words and order; variant kept as recorded fallback | (X) |
| COLD-DIRECTORY variant | Phase 10's precedent, non-mutating | |
| Both | Two measurements of one question | |

**Auto-selected:** literal `nx reset` then sidecar (recommended default).
**Notes:** Phase 11 is where TEST-10 closes, and TEST-10 names both the mechanism and the order in
its own words. The order it mandates is precisely the mitigation for the hazard the variant was
invented to dodge, so the variant's strongest argument does not apply once the order is honoured.
Recorded in CONTEXT.md as D-05 with the variant, and its four reasons from `10-01-SUMMARY.md`,
carried as the named fallback -- switch to it and RECORD the deviation, never switch silently.

---

## Area 2 -- Warm-mirror pre-flight: which graph state's hashes are actually mirrored

**Trade-off analysis**

Nothing in the record states the graph state of `10-EVIDENCE-LIVE-CI.md`'s `capture:hashes` run,
and PARITY-04 was answered **NO** at Phase 8's anchor (a warm-preexisting Windows box computes a
different hash from cold on all five targets) -- measured BEFORE 08-05's fix, so its post-fix
status is unknown. TEST-10's reset forces COLD.

| Approach | Pros | Cons |
|---|---|---|
| Cross-check BOTH graph states against the warm shard before the proof | cheap -- two `capture:hashes` runs plus four shard lookups each; makes a MISS attributable IN ADVANCE instead of after; answers PARITY-04's named question as a by-product | one extra measurement step |
| Assume cold-local == cold-CI post-Phase-8 | zero cost | an assumption in exactly the place this milestone exists to remove assumptions; the two-axis confounding in `PROBE-RESULTS.md` is what this repo learned the hard way |

| Option | Description | Selected |
|--------|-------------|----------|
| Cross-check both states first, record both | Pre-flight measurement, pre-declared contingency | (X) |
| Assume post-fix parity | No pre-flight | |

**Auto-selected:** cross-check both states first (recommended default).
**Notes:** the contingency is pre-declared rather than discovered -- if the COLD hashes are absent
from the mirror, O1 is unreachable at this commit and needs a re-warming default-branch push, and
that is recorded as a FINDING per PARITY-04's own instruction, never absorbed by re-running until
something hits. CONTEXT.md D-06 and D-07.

---

## Area 3 -- Ordering: hash rotation as the phase's real sequencing constraint

**Trade-off analysis**

Measured against `nx.json` this session: `ci.yml` is a `test` input only (`:69`);
`test`/`typecheck`/`integration` all start from `default` = `{projectRoot}/**/*`; `build`
explicitly excludes `src/**/*.spec.ts`; a root-level `.mjs` is in no input list and
`nx.includedScripts` is `[]`.

| Approach | Pros | Cons |
|---|---|---|
| Measure O1/O2 FIRST at the current commit, then land the O3 tooling | takes the perishable measurement while the window is open -- Phase 10's D-24/D-25 discipline; needs no re-warming push | the phase's own tooling cannot contribute to O1's evidence unless it is hash-neutral |
| Land the tooling, re-warm via a live push, then measure | tooling available for O1's evidence | costs an extra live push and re-opens the whole rotation question, including a fresh both-states pre-flight |

| Option | Description | Selected |
|--------|-------------|----------|
| O1/O2 first, hash-neutral tooling, then the `ci.yml` work | `depends_on` in plan frontmatter, three waves | (X) |
| Tooling first, re-warm, then measure | Extra live push | |

**Auto-selected:** O1/O2 first (recommended default).
**Notes:** encoded as `depends_on` in plan frontmatter, never as prose -- Phase 8's "a comment
asking an executor to preserve ordering is not a control; a `depends_on` graph is". This is also
what forces Area 4's answer: the task-graph instrument must be hash-neutral to be usable before
the local proof. CONTEXT.md D-10 and D-11.

---

## Area 4 -- TEST-08's mechanical task-graph assertion: instrument shape and home

**Trade-off analysis**

| Approach | Pros | Cons |
|---|---|---|
| A new mode on the root-level `capture-hashes.mjs` | rotates NO hash, so it may run before the perishable proof; the instrument already drives `createProjectGraphAsync` -> `createTaskGraph` and already throws with the graph's task keys on a missing id; the output is a capturable artifact, which is what TEST-08 asks for | no continuous every-commit enforcement |
| A Vitest spec under `packages/github-cache/src/` | continuously enforced; `nx-target-inputs.spec.ts` is the in-repo precedent for reaching into Nx internals | rotates `test`, `typecheck` AND `integration` the moment it lands, destroying the O1/O2 window |
| Both | enforcement plus hash-neutral evidence | two mechanisms for one claim -- Phase 8's "three guards for one invariant can share one blind spot" |

| Option | Description | Selected |
|--------|-------------|----------|
| A mode on `capture-hashes.mjs` | Root-level, dev-only, hash-neutral; negative control mandatory | (X) |
| A Vitest spec | Continuous but rotates the hashes | |
| Both | Two mechanisms | |

**Auto-selected:** a mode on `capture-hashes.mjs` (recommended default).
**Notes:** the negative control is not optional -- a resolver that resolves nothing satisfies every
absence assertion simultaneously, which is Phase 7's `filterUsingGlobPatterns` lesson recurring.
The spec version is DEFERRED with its reason rather than dropped. CONTEXT.md D-12, D-13, and the
Deferred Ideas entry.

---

## Area 5 -- TEST-08's producer attribution: what establishes "Linux CI produced this hash"

**Trade-off analysis**

`mirrored-by` is ruled out by live data, not by reasoning: `10-EVIDENCE-LIVE-CI.md` records the
Windows-produced `integration` hash `8137422034373911537` stamped `mirrored-by: linux`.

| Evidence | What it establishes | Its limit |
|---|---|---|
| The graph premise (Area 4) | Windows CI resolves no `build`/`typecheck`/`test` task, so any such hash in the store is Linux-produced | structural -- valid only because it is ASSERTED, not assumed |
| The replayed artifact's `terminalOutput` runner path | a per-hit, byte-level producer fingerprint INSIDE the served artifact; what made Step 0's attribution decisive | readable only after a HIT |
| Cache-entry and shard-asset lists with `created_at`, cross-referenced against job windows | the requirement's own mandated capture | timing, not identity |
| Recompute the hash on a known platform and match | established the producer live in Phase 10 | only for OS-SENSITIVE targets, so it serves O2 and never O1 |

| Option | Description | Selected |
|--------|-------------|----------|
| All four, graph premise load-bearing | Independent, each cheap | (X) |
| Mandated capture only | Minimum the requirement names | |
| Recomputation only | Phase 10's live method | |

**Auto-selected:** all four (recommended default).
**Notes:** they are independent and each is cheap; TEST-08 mandates the third explicitly and the
fourth is what makes O2's attribution direct rather than inferred. The retraction is restated so
it cannot creep back: no artifact, comment or doc line may claim `mirrored-by` answers "whose bytes
did the developer get". CONTEXT.md D-14 and D-15.

---

## Area 6 -- O3 proof mechanics: existence, positive control, and where `H_linux` comes from

**Trade-off analysis**

TEST-09(3) requires the positive control **in the same job** as the MISS observation, or a dead
sidecar in that job is not excluded. `H_linux` is not computable on a Windows runner (the
discriminator is honest) and a matrix leg cannot `needs:` its sibling.

| Approach | Pros | Cons |
|---|---|---|
| Control = authed GET on the leg's OWN just-saved key -> require 200, inside the `integration` job; `H_linux` existence demonstrated in a separate ordered ubuntu witness job | zero plumbing for the control; a genuine service round-trip, since `restoreCache` always queries the service; extends the shipped readiness-GET shape TEST-09 names; keeps every REST call on ubuntu, where `curl` and tooling are proven | existence is demonstrated POST-HOC, so it needs a `created_at` versus step-`started_at` cross-reference |
| Plumb `H_linux` into the Windows `integration` leg and probe it BEFORE the task | existence AND the control in one probe, at Nx time | a matrix leg cannot `needs:` its sibling, so this requires restructuring the job |
| Serialise or reorder the `integration` matrix | simplest ordering story | makes leg order load-bearing for a proof -- exactly what XOS-06 and the PROJECT.md ordering row reject |

| Option | Description | Selected |
|--------|-------------|----------|
| Own-key control + ubuntu witness job | Four sub-locks; see notes | (X) |
| Plumb `H_linux` into the Windows leg | Requires restructuring `integration` | |
| Reorder the matrix | Forbidden by XOS-06 | |

**Auto-selected:** own-key control plus a witness job (recommended default).
**Notes:** four sub-locks recorded, three of which came out of this analysis rather than the
requirement text. (1) `H_linux` is sourced from the ubuntu `integration` leg's own `run.json`,
NEVER from `hash-parity` -- on a `pull_request` event `hash-parity` pins the PR head SHA while
`integration` takes the default merge commit, so the two measure different trees. (2) The
absence-of-`[remote cache]` assertion is RECORDED, never GATED: it is false on a correct re-run at
the same commit, and OBS-04's own lesson is that a tripwire firing on correct work gets disabled.
(3) The witness job needs `actions: read` and must restate `contents: read`, because a job-level
`permissions` block replaces the workflow grant wholesale. (4) REST calls use `curl`, not `gh` --
MEASURED that no workflow in this repo invokes `gh`, so its presence on `windows-11-arm` is
unverified, while `curl` is proven on both legs by the shipped readiness poll. CONTEXT.md D-16 to
D-19. The residual empirical question is carried as U-01.

---

## Area 7 -- The proving run's event, and `ACTIONS_STEP_DEBUG`

**Trade-off analysis**

| Approach | Pros | Cons |
|---|---|---|
| Temporary maintainer-authorised push of the phase branch to `main`, then restore | `github.sha` equals the head, so `integration`, `hash-parity` and `hash-parity-compare` all measure ONE tree and the CORR-03 citation is commensurable with the O3 observation; the procedure is established twice (Phase 9 run `30400231720`, Phase 10 run `30471772954`) with a retained backup ref and SHA-equality verification; re-warms the mirror under the post-Phase-11 hashes for Phase 12 | touches `main` temporarily; the restore force-push fires its own `push` run (expected, precedented) |
| A `pull_request` run | no `main` involvement; freely repeatable; `pull_request` IS write-trusted on github.com (`trust.ts:34`), so both `integration` legs would still save | `integration` checks out the MERGE commit while `hash-parity` pins the PR head, so the CORR-03 record and the observed hashes are over DIFFERENT TREES, and `H_linux` sourcing gets harder |

| Option | Description | Selected |
|--------|-------------|----------|
| Temporary push to `main` + restore | One tree everywhere; established contract | (X) |
| `pull_request` run | Cheaper, but trees diverge | |

**Auto-selected:** temporary push to `main` plus restore (recommended default).
**Notes:** tree commensurability is the deciding argument, not cost -- a PR run is technically
viable because `pull_request` is write-trusted, so the choice turned on TEST-09(1)'s citation being
over the same tree as the observation. `ACTIONS_STEP_DEBUG` is set as a repository VARIABLE for the
proving run and unset afterwards, recorded with both timestamps: the documented route, reversible,
and it does not commit debug logging into every future run. CONTEXT.md D-20 and D-21.

---

## Area 8 -- Evidence artifact layout and the pre-registered counts

**Trade-off analysis**

| Approach | Pros | Cons |
|---|---|---|
| ONE `11-EVIDENCE.md` with O1/O2/O3 sections and an explicitly RESERVED O4 section | TEST-08's own words: "Phase 12 appends the O4 row to the same evidence record"; one file for the milestone's acceptance frame | a long file |
| Split local (O1/O2) versus live-CI (O3), Phase 10's shape | mirrors the immediately prior phase | TEST-08 wants one record, and Phase 12 would then have to choose a half |

| Option | Description | Selected |
|--------|-------------|----------|
| One `11-EVIDENCE.md`, O4 section reserved | Requirement's own shape; counts pre-registered in the PLAN | (X) |
| Split local versus live-CI | Phase 10's layout | |

**Auto-selected:** one `11-EVIDENCE.md` (recommended default).
**Notes:** the layout is the smaller half. The load-bearing half is that every count which would
differ under the failure hypothesis is pre-registered IN THE PLAN rather than chosen after the run
-- the `[remote cache]` occurrence count per target as the gate (OBS-02: non-zero, named per
target), with the run-duration collapse and the "Nx read the output from the cache ... for N out of
M tasks" line as explicitly secondary corroboration. Every recorded `Cache: n/m hit` line is marked
NON-DISCRIMINATING in both directions, beside the line: a `0%` prints identically with no sidecar
at all (run `30169158892`) and a non-zero count includes local hits. CONTEXT.md D-22 to D-24.

---

## Claude's Discretion

- The name and flag surface of the `capture-hashes.mjs` task-graph mode, and whether the negative
  control is a second invocation or a second assertion inside one invocation.
- The `o3-witness` job's name, and whether the `created_at`-versus-`started_at` comparison is done
  in `bash` arithmetic or a `node -e` one-liner.
- Per-leg artifact names for the `integration` hash upload, subject to per-leg uniqueness.
- Section order inside `11-EVIDENCE.md`, and whether the soundness-probe control table is inline
  per proof or shared once.
- Plan count and wave grouping, subject to the ordering lock in Area 3.

## Withheld from auto-lock

**U-01 -- whether `nx-cache-<H_linux>`'s existence at the moment the Windows `integration` task ran
can be demonstrated from inside the run without making matrix-leg order load-bearing.** Rated HIGH
impact (it decides whether the O3 proof demonstrates TEST-09's central clause or is vacuous on it)
and NOT-HIGH confidence (three unmeasured platform behaviours: sibling-leg cache-entry visibility
and its `ref`, timestamp granularity on both sides, and the observed gap between the ubuntu leg's
save and the Windows leg's start). Recorded as UNRESOLVED in CONTEXT.md for
`gsd-phase-researcher`, with a falsifiable check, an additive fallback, and an explicit statement
of what is NOT available as a fallback. Phase 10's own U-01 is the precedent for treating this
repo's intuitions about matrix-leg semantics as unreliable.

## Deferred Ideas

- An every-commit Vitest version of the task-graph assertion -- revisit in Phase 12, where XOS-04
  changes the graph premise and the rotation cost is already being paid.
- XOS-04 / XOS-05 / XOS-08 and the O4 write decision -- Phase 12, gated on XOS-01 being PROVEN.
- DOCS-07's consumer portability recipe, including the "if your local box misses everything,
  `nx reset`" note.
- PARITY-04's "does my everyday box hit" question -- named, deliberately not closed; the
  both-states pre-flight produces its data without turning it into a proof.
- Collapsing the publish matrix to one leg; a manual prune of the 50 PoC-era assets; regenerating
  `.planning/codebase/*`.
