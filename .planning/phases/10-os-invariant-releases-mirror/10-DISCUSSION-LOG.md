# Phase 10: OS-Invariant Releases Mirror - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-29
**Phase:** 10-os-invariant-releases-mirror
**Mode:** `--analyze --auto --chain` -- all gray areas auto-selected, recommended option
auto-chosen per question, trade-off table recorded per question. One HIGH-impact /
NOT-HIGH-confidence item was WITHHELD from auto-lock and recorded as `U-01` in CONTEXT.md.
**Areas discussed:** Asset-name single source, Cleanup filter and the unprunable legacy
shard, `mirrored-by` attribution seam, Leg-distinguishable publish seed, `publish` job
dependencies, CORR-05 site 4 and the replacement non-vacuity proof, Trust classification
hand-off, Sequencing and the perishable baseline

`[--auto] Selected all gray areas: Asset-name single source, Cleanup filter and the unprunable legacy shard, mirrored-by attribution seam, Leg-distinguishable publish seed, publish job dependencies, CORR-05 site 4 and the replacement non-vacuity proof, Trust classification hand-off, Sequencing and the perishable baseline.`

---

## Asset-name single source

**Trade-off analysis: how `nx-cache-<hash>` is derived**

| Option | Pros | Cons |
|--------|------|------|
| Alias `releaseAssetName` to `cacheKeyFor(hash)` | Zero duplication; the two strings are byte-identical today | Couples the Actions-cache KEY namespace to the Release ASSET namespace; a later change to either silently moves both |
| Compose from the imported `CACHE_KEY_PREFIX` locally | Satisfies D2-03's "single-sourced from the existing `CACHE_KEY_PREFIX`"; keeps four distinct consumers of one prefix, which is exactly RETAIN-05(c)'s framing | Needs a comment lock, because "these return the same string, tidy them" is an obvious future proposal |
| A separate authored literal | Fully decoupled | Violates D2-03 outright and re-creates the drift `cache-key.spec.ts`'s authored-count guard exists to catch |

Recommended: **compose from the imported prefix** -- RETAIN-05(c) names FOUR distinct
consumers of one prefix, not two aliases of one builder.

| Option | Description | Selected |
|--------|-------------|----------|
| Alias to `cacheKeyFor` | One builder for both namespaces | |
| Compose from `CACHE_KEY_PREFIX` (recommended) | Import the prefix, compose locally, comment-lock the deliberate separation | ✓ |
| Separate literal | Independent template | |

`[auto] Asset-name single source -- Q: "How is nx-cache-<hash> derived?" -> Selected: "Compose from CACHE_KEY_PREFIX" (recommended default)`

**Notes:** Captured as D-03. The `platform` parameter is DELETED rather than
defaulted away (D-04), which is what removes CORR-05 sites 2 and 3; `cachePlatform` and
`CACHE_OS_VALUES` survive with an intentionally-kept annotation so `fallow` does not prune
them. RETAIN-04 names only `CACHE_OS_VALUES` for that annotation -- `cachePlatform` needs
it for the same reason and nothing in the requirements says so.

---

## Cleanup filter and the unprunable legacy shard

**Trade-off analysis: the 50 PoC-era `<hash>.tar.gz` assets (RETAIN-05a)**

Live census taken this session (`gh api`, shard `cache-mirror-202607`): 122 assets --
**50** `<hash>.tar.gz`, 46 `-linux`, 26 `-windows`, 0 `-macos`, 0 other. The
requirement's "~50" is exact.

| Option | Pros | Cons |
|--------|------|------|
| Record as accepted dead weight with the count | Zero code risk; the month-shard scheme already bounds it (122/1000 in a shard that rolls over 2026-08-01, so its cap is unreachable) | The 50 stay forever in that one shard |
| Prune once by hand | Removes them completely | Outward-facing and hard to reverse; an operational action, not code; needs maintainer authorisation |
| Add a third accept branch to the filter | Makes them age out automatically | WIDENS a DELETE filter that quick `260721-vdn` deliberately narrowed on security grounds, and `<hash>.tar.gz` is indistinguishable in shape from a foreign asset dropped into a genuine shard |

Recommended: **record with the count.** The third option is not merely the most work, it is
the worst on security -- it is the one option that makes the delete filter admit a shape the
publisher never produced.

| Option | Description | Selected |
|--------|-------------|----------|
| Record as accepted dead weight (recommended) | Write the measured count + the per-shard bounding argument; no code change | ✓ |
| Prune once by hand | Maintainer-run one-off | |
| Third accept branch | Filter widening | |

`[auto] Cleanup filter -- Q: "What disposition for the ~50 unprunable PoC-era assets?" -> Selected: "Record as accepted dead weight with a measured count" (recommended default)`

**Notes:** Captured as D-08, with the manual prune preserved in Deferred Ideas as an
operational option. The framing correction that decided it: the 1000-asset cap is
per-SHARD, so "permanent occupants of the cap" is true and also bounded. Branch
disjointness (RETAIN-05b) is asserted DIRECTLY over an adversarial table including
`nx-cache-<hash>-linux`, never inferred from the last-`-` split (D-07).

---

## `mirrored-by` attribution seam

**Trade-off analysis: plumbing the OBS-03 label**

| Option | Pros | Cons |
|--------|------|------|
| Fourth positional `label: string` on `uploadReleaseAsset` | Minimal diff; one call site, one implementation | Widens a 3-arg signature to 4 |
| An options object on `uploadReleaseAsset` | Extensible | An options object for one field is the shape `summary.ts` already records this repo refusing |
| Inject the OS through `PublishOptions` | Test-friendly without mocking | `PublishOptions` is `{ now }` today; `action/index.spec.ts:87` already establishes mocking `cachePlatform` as the house pattern |

Recommended: **fourth positional parameter, with `cachePlatform()` called once per run and
the spec mocking that module** -- both halves follow shipped precedent.

| Option | Description | Selected |
|--------|-------------|----------|
| Fourth positional `label` + mocked `cachePlatform` (recommended) | Matches `action/index.spec.ts`'s existing harness | ✓ |
| Options object | Extensible signature | |
| Inject via `PublishOptions` | New injection seam | |

`[auto] mirrored-by seam -- Q: "How is the label plumbed and the OS resolved?" -> Selected: "Fourth positional label + mocked cachePlatform" (recommended default)`

**Notes:** Captured as D-09/D-10/D-11. The load-bearing half is not the plumbing but the
RETRACTION comment lock: the label is the PUBLISHING leg's OS, never the producing OS, and
Phase 9 is precisely what broke that identity. Assertion shape is the whole argument ARRAY
over `it.each(CACHE_OS_VALUES)` -- Phase 9 measured a hand-authored `'linux'` literal pinned
at a CI sampling rate of ZERO, and a negated matcher inside `toHaveBeenCalledWith` that
asserted "SOME call lacks X".

---

## Leg-distinguishable publish seed

**Trade-off analysis: OBS-05's per-leg seed hash**

Hard constraint a planner will miss: `HASH_PATTERN` is `^[a-f0-9]{1,512}$`, so
`<run_id>-linux` is not representable as a cache hash.

| Option | Pros | Cons |
|--------|------|------|
| Re-purpose `operation: seed` to derive per-OS | No new operation value | BREAKS VER-06 -- `dogfood-seed`/`dogfood-verify` require one shared key per RUN, and per-OS seeding there is exactly the vacuity trap Phase 9 closed |
| New internal `operation` value + one TS helper called by both the seed and `read-back.ts` | One derivation, two call sites, no YAML mapping; `dogfood-seed` untouched | One more operation value on the internal action |
| Per-leg hash computed in the workflow (`${{ matrix.os == ... && 'x' \|\| 'y' }}`) | No new operation | Puts the OS mapping in TWO languages -- the drift class this repo guards against everywhere |
| Suffix a decimal digit per OS | Simplest encoding | Leaves a ~12-digit all-decimal key in the same space as a run id; collision becomes probabilistic instead of structural |

Recommended: **new internal `operation` value plus one hex-letter-marked helper**, with the
OS component indexed out of `CACHE_OS_VALUES`. Verified this session that a new value on
`packages/github-cache/action.yml` is not a public-surface change:
`public-surface.spec.ts:53` enumerates only `start-cache-server/action.yml`'s inputs.

| Option | Description | Selected |
|--------|-------------|----------|
| New `operation` + one hex-letter helper (recommended) | `mirror-seed`; both seed and read-back call the same derivation | ✓ |
| Re-purpose `operation: seed` | Breaks VER-06 | |
| Workflow-side expression | Mapping in two languages | |
| Decimal-digit suffix | Probabilistic collision argument | |

`[auto] Publish seed -- Q: "How does each publish leg seed a distinguishable hash?" -> Selected: "New internal operation value + one hex-letter helper" (recommended default)`

**Notes:** Captured as D-12/D-13/D-14/D-15. Analysing this area is what surfaced **U-01**
(below): distinguishable seeds alone may not make a dead Windows publish leg fail, because
since VER-01/VER-03 the ubuntu leg can restore a Windows-seeded entry. Also captured: once
the producer is knowable per leg, `read-back.ts` tightens back to an exact expectation and
its "DO NOT UNIFY with dogfood-verify" lock must be UPDATED rather than left standing --
its premise ("publish's producer is genuinely VARIABLE") is what OBS-05 removes.

---

## `publish` job dependencies

**Trade-off analysis: XOS-07's `needs:` widening**

| Option | Pros | Cons |
|--------|------|------|
| Widen to `[build, typecheck, test, integration]` and rewrite the comment | Satisfies XOS-07; one push mirrors the full task set, so Phase 11's O1 proof cannot race job completion | Appears to contradict the existing "needs: build (NOT test)" comment until the comment is rewritten |
| Keep `needs: build` | No comment work | Fails XOS-07 outright; the O1 proof can fail on a correct implementation |
| Widen but leave the comment | Least effort | Leaves a future reader holding a documented argument for narrowing `needs:` straight back |

Recommended: **widen AND rewrite the comment in the same commit.** The apparent conflict is
not real -- `publish` carries `if: ${{ !cancelled() && ... }}`, and `!cancelled()` runs the
job even when a dependency FAILED, which is exactly what the original comment wanted.
Recording that mechanism is what makes the widening safe to read.

| Option | Description | Selected |
|--------|-------------|----------|
| Widen + rewrite the comment (recommended) | Names `!cancelled()` as the mechanism preserving the original intent | ✓ |
| Keep `needs: build` | Fails XOS-07 | |
| Widen only | Stale contradictory prose | |

`[auto] publish needs -- Q: "Widen needs: and what happens to the comment that argued against it?" -> Selected: "Widen + rewrite the comment" (recommended default)`

**Notes:** Captured as D-16. Direct application of Phase 9's learning that correcting a
claim requires SUPPLYING A REPLACEMENT REASON.

---

## CORR-05 site 4 and the replacement non-vacuity proof

**Trade-off analysis: where `release-asset-name.spec.ts:60` goes**

| Option | Pros | Cons |
|--------|------|------|
| New `src/lib/release-asset-name.integration.spec.ts` | Co-located with its subject; picked up by `vitest.integration.config.mts`'s `{src,tests}/**/*.integration.spec.{ts,mts,cts}`, so it runs on BOTH legs of the `integration` matrix -- strictly stronger than today | Deviates from ROADMAP SC2's named recommendation, so the deviation must be recorded |
| `server/public-server.integration.spec.ts` (ROADMAP's recommendation) | Exactly what the roadmap names; the file exists | Poor cohesion -- an asset-name default-argument contract in a spec about the public HTTP server |
| Delete the assertion | Removes the violation with no relocation | Drops real coverage: OBS-03 KEEPS `cachePlatform`, so its default-argument contract stays live |

Recommended: **the new co-located integration spec.** Today the assertion runs under
`test`, which is ubuntu-ONLY, where `cachePlatform()` and `cachePlatform('linux')` are
indistinguishable -- the same sampling-rate-of-zero defect Phase 9's validation found. Moving
it into `integration` does not merely relocate the read, it makes the assertion bite on
Windows.

| Option | Description | Selected |
|--------|-------------|----------|
| New co-located integration spec (recommended) | Better cohesion AND runs on both OS legs | ✓ |
| `public-server.integration.spec.ts` | The roadmap's literal recommendation | |
| Delete | Loses live coverage | |

`[auto] CORR-05 site 4 -- Q: "Where does the surviving ambient-platform read go?" -> Selected: "New co-located integration spec" (recommended default)`

**Notes:** Captured as D-17, with the deviation from ROADMAP SC2 recorded rather than taken
silently. The paired decision D-18 names the replacement for the non-vacuity proof CORR-02
destroys: exactly-one requested name, equal to the imported `releaseAssetName(hash)`, and
carrying no `CACHE_OS_VALUES` token -- extending `releases-backend.spec.ts:128-134`, which
already holds the first two clauses, rather than authoring a third overlapping guard.

---

## Trust classification hand-off

**Trade-off analysis: how TRUST-11/TRUST-12 reach a verdict**

| Option | Pros | Cons |
|--------|------|------|
| PLAN.md `<threat_model>` carries them as INPUT; `gsd-security-auditor` authors SECURITY.md | What TRUST-13 literally requires ("not self-certified"); an independent fresh-context audit | Needs the auditor pointed at Phase 9's commits, since Phase 9 created the delta |
| Orchestrator writes SECURITY.md inline | Fewer moving parts | Self-certification -- explicitly forbidden by TRUST-13, and `secure-phase` has a clean-looking short-circuit that would allow it |
| Defer classification to Phase 12 | Waits for the XOS-05 write decision | TRUST-13 is a Phase 10 requirement; and TRUST-11's residual risk MOVING to XOS-05 is itself part of what must be recorded now |

Recommended: **auditor-authored, with corrected input.** TRUST-11's arbitration point is
corrected in the input: the differing-payload race is at `saveCache`, not at the Release
upload, and it only appears once XOS-04 adds a second producer.

| Option | Description | Selected |
|--------|-------------|----------|
| Auditor-authored from corrected INPUT (recommended) | `gsd-security-auditor` reaches the verdict; orchestrator only routes and commits | ✓ |
| Orchestrator-authored inline | Self-certification | |
| Defer to Phase 12 | Misses a Phase 10 requirement | |

`[auto] Trust classification -- Q: "Who reaches the TRUST-11/12 verdict?" -> Selected: "Auditor-authored from corrected INPUT" (recommended default)`

**Notes:** Captured as D-22 (plus D-19/D-20/D-21/D-23 for the pins and the comment sweep).
`/gsd:secure-phase`'s documented short-circuit (skip the auditor when
`threats_open: 0 AND register_authored_at_plan_time: true`) must NOT be taken here -- the
auditor is spawned regardless. Required auditor reading includes `09-SECURITY.md` section 1,
whose finding that the OS partition was never a security boundary is what makes the exposure
delta assessable as bounded rather than alarming.

---

## Sequencing and the perishable baseline

**Trade-off analysis: XOS-02's pre-rename baseline**

| Option | Pros | Cons |
|--------|------|------|
| Capture fresh AND cite the existing record | Baseline sits at the CURRENT cache version, so Phase 11's non-regression isolates the RENAME instead of straddling two changes; loses nothing | Costs one local `nx reset` + cold `integration` run behind the sidecar |
| Cite the 2026-07-26 Step 0 record only | ROADMAP explicitly sanctions it; zero cost | That sanction was written BEFORE Phase 9 rotated the `@actions/cache` version, so the before/after pair would straddle two changes |
| Capture fresh only | Current-version baseline | Discards a qualifying corroborating record for no reason |

Recommended: **both.** The window closes permanently the moment the rename lands, and
capture is cheap -- so the option that cannot be wrong is the one to take. Recorded as a
HIGH-impact item resolved by taking the dominant option rather than by picking a side.

| Option | Description | Selected |
|--------|-------------|----------|
| Capture fresh AND cite (recommended) | Fresh capture is the baseline of record; 2026-07-26 is the corroborating prior | ✓ |
| Cite only | Straddles Phase 9's rotation | |
| Capture only | Discards a qualifying record | |

`[auto] Sequencing -- Q: "Capture or cite the pre-rename O2 baseline?" -> Selected: "Capture fresh AND cite the existing record" (recommended default)`

**Notes:** Captured as D-24/D-25/D-26/D-27. The sequencing itself is not a gray area -- it
is dictated by three literal same-commit rules (RETAIN-04, RETAIN-05, LINT-06's disables)
and one strict before (OBS-05 -> CORR-02) -- so it is recorded as `depends_on`, not
discussed. D-27 is the one addition from the scout rather than the requirements:
`start-cache-server/index.js` inlines `cachePlatform`, so ROBUST-04 RECURS and CORR-02's
commit must rebuild the bundle.

---

## Claude's Discretion

- The names of the two RETAIN-04 branch predicates and the D-12 seed helper.
- The D-12 encoding's marker character and prefix-versus-suffix placement, subject to its
  three locked constraints (hex-only, not all-decimal, OS component from `CACHE_OS_VALUES`).
- The `operation` value's name (`mirror-seed` is a suggestion, not a lock).
- Where the RETAIN-05(b) disjointness table and the D-19 `ref`-scoping pin live -- an
  existing spec versus a new cross-cutting drift guard.
- Filenames and format for D-25's baseline capture and D-26's recorded notes.
- Plan count and wave grouping, subject to D-24's ordering.

## Withheld from auto-lock

**U-01 -- whether OBS-05's distinguishable seeds actually make a dead Windows publish leg
FAIL, and whether the detection rests on step ORDERING.** HIGH impact (it decides whether
OBS-05 ships a guard that detects what it claims, and it is the one place two of this
phase's own requirements -- OBS-05 and XOS-06 -- pull against each other) and NOT-HIGH
confidence (reasoned from source, not measured; depends on matrix-leg serialisation
semantics this repo has measured for separate JOBS but not for two legs of one matrix job).
Recorded in CONTEXT.md with a pre-stated falsifiable check and both resolution branches;
`gsd-phase-researcher` owns it. Per the trap-quadrant rule this was NOT auto-decided.

## Deferred Ideas

- Collapsing the publish matrix to one leg -- the strongest argument for it is RECORDED
  here (the Windows leg mirrors zero real assets after this phase) and it stays deferred
  until XOS-05 is proven in Phase 12.
- A one-off manual prune of the 50 PoC-era `<hash>.tar.gz` assets -- operational, not code.
- Read-fallback across old and new asset names; a per-job/per-target OS-invariance flag;
  adopter-migration signalling -- all Out of Scope in REQUIREMENTS.md.
- Regenerating `.planning/codebase/*` (stale since 2026-07-22) -- Operator Next Steps, not
  this phase.
- The unattributed `test` failure at `69bd1b7` -- still open in Phase 8's deferred items;
  capture output BEFORE re-running if `test` fails once here.
