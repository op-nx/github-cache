# Quick Task 260809-hcr: the OBS-04 total gate and the docs promise - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning

<domain>
## Task Boundary

Quick task `260809-2s6`'s advisory panel concluded the OBS-04 all-restore-MISS gate was
"effectively unreachable" and that `docs/advanced.md` promises consumers a warning that cannot
fire. Investigation before planning found the first half WRONG and the second half RIGHT, for a
reason nobody in the panel identified.

IN SCOPE: correct the consumer-facing documentation so it describes the warning that actually
fires, and record why the two events differ.
OUT OF SCOPE: changing the OBS-04 gate's condition; changing the partial branch; any merge.

</domain>

<decisions>
## Implementation Decisions -- auto-locked, with the gray-area rating that permitted it

The `--auto` trap quadrant is HIGH-IMPACT plus NOT-HIGH-CONFIDENCE. Every decision below was
HIGH-IMPACT when this task opened, and would NOT have been safe to auto-lock then. The
investigation recorded under `<evidence>` moved them to HIGH confidence by measurement, which is
what makes locking them legitimate rather than convenient.

### H-D1 -- do NOT change the gate. The gate is correct.

`readMisses === hashes.length && mirrored === 0` is reachable, and reachable in precisely the
scenario `ROBUST-04` invokes it for. Under bundle drift the sidecar writes at one cache version
while publish restores at another, so publish cannot restore ANYTHING -- including the entries
this very run wrote. Everything misses, nothing mirrors, the gate fires. That is the failure
`ROBUST-04` says the gate exists to surface.

REJECTED: the panel's proposal to exclude own-run seeds from the denominator. It was designed
against the belief that only seeds hit. Measured false -- see `<evidence>`. Excluding seeds
would leave the six same-run task hashes still hitting, so it would not make the gate fire on a
rotation either, while weakening the one case where it does work.

### H-D2 -- correct `docs/advanced.md`, which promises the wrong warning for a version bump

The rotation paragraph tells a consumer that after bumping the action, publish "restores
everything as a MISS and mirrors nothing", and that "the warning it emits names the axis". On a
deliberate bump BOTH the sidecar and publish move to the new cache version together, so this
run's own entries are written at the new version and publish restores them. Historical entries
miss; current ones hit and mirror. `mirrored` is not zero, so the TOTAL gate stays silent and
the PARTIAL branch is what fires.

The docs must describe the partial warning for that path, and reserve the total warning for the
case that actually produces it.

### H-D3 -- state the distinction once, at the code, and cite it from the docs

The two branches answer different questions and nothing currently says so where a reader stands:
the total gate means "this leg could restore NOTHING, including what it just wrote" (a drift or
a read-scope regression); the partial branch means "a cohort of older entries no longer
restores" (a version rotation). One sentence at the branch pair, referenced from the docs.

### Claude's Discretion

- Exact wording of the corrected docs paragraphs.
- Whether the distinction lives as a comment at the branch pair or in the message text.

</decisions>

<evidence>
## Measured, not argued

**Run `31305961054` mirrored 11 assets, and SIX of them are real Nx task hashes** written by
this run's own `build`/`typecheck`/`test`/`integration` jobs through the sidecar, not seeds:
`14030027344786192887`, `14138289791601272320`, `15286568596384306606`,
`15905284184490881973`, `16563134044476439278`, `8900395420611860092`. The other five are seeds
(`bead`/`cafe`/`feed0`/`feed2` for this run, plus a prior run-id seed). This is what falsifies
the exclude-own-seeds proposal: seeds are a minority of the same-run hits.

**The project already measured the rotation case and recorded it without recognising it.**
`09-VALIDATION.md`, on run `30400231720`, the one real VER-01 rotation: "The advance prediction
required `mirrored == 0` and `restore-MISS == scanned`. It was not met." Measured `mirrored 6`,
`restore-MISS 41`, `scanned 47`. A rotation leaves `mirrored` non-zero. The docs sentence has
been false since it was written, and the counterexample was sitting in the phase's own
validation artefact.

**`ROBUST-04` states the gate's real trigger**, `REQUIREMENTS.md:332-339`: bundle drift means
"the sidecar writes at one cache version while the publish action restores at another -- the
mirror silently stops receiving anything, surfacing only as the all-restore-MISS warning". That
is a total read failure, and under it the same-run writes miss along with everything else.

</evidence>

<constraints>
## Locked constraints

- **C1** -- do NOT touch `listCacheEntries`'s `ref` argument or widen its `{ key }` projection.
  The ref is the sole in-repo control for TRUST-10 / C1 / C2 / C16.
- **C2** -- `actions: write` must not be requested (absence-mitigation for HIGH threat T-11-01).
- **C3** -- both branches stay `core.warning`, never a failure (D-27). `failed > 0` -> setFailed
  remains the only red signal.
- **C4** -- the milestone is frozen pending the maintainer's code and security reviews. This
  lands in their diff, so keep it minimal and legible.
- **C5** -- no merge, and no deletion of Release assets.

</constraints>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md:332-339` (ROBUST-04, the gate's real trigger) and `:649` (OBS-04).
- `.planning/phases/09-os-invariant-actions-cache-version/09-VALIDATION.md` -- the OBS-04
  section recording `mirrored 6` on the real rotation.
- `docs/advanced.md:84-104` -- the paragraphs to correct.
- `.planning/quick/260809-2s6-stop-the-publish-mirror-from-re-enumerat/260809-2s6-PLAN-2.md`
  -- the partial branch as it now stands, after the Wilson change.

</canonical_refs>
