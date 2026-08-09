---
captured: 2026-08-09
source: quick 260809-hcr
type: correction
target: .planning/REQUIREMENTS.md (ROBUST-04)
blocked_by: v0.0.2 milestone freeze
---

# ROBUST-04's "only as the all-restore-MISS warning" clause is false

`REQUIREMENTS.md:332-339` (ROBUST-04) says that action-bundle drift means "the mirror silently
stops receiving anything, surfacing **only as the all-restore-MISS warning** that OBS-04 has
just told everyone to expect exactly once."

That surfacing claim is false, and was false when written.

## Why

Drift is between the committed `start-cache-server/index.js` and source. But
`packages/github-cache/action.yml:41` declares `main: dist/action/index.js`, and `ci.yml`
runs both the `mirror-seed` and `publish` operations from that freshly built dist inside the
same `publish` job. Under drift the stale committed bundle is a DIFFERENT artifact from the one
publish reads with, so the same-run seed still writes and restores at the dist's cache version.
`mirrored >= 1`, and the all-restore-MISS gate -- which needs `readMisses === hashes.length`
AND `mirrored === 0` -- cannot fire.

What a drifted run would actually show is the PROPORTIONAL branch: the sidecar's entries miss
while the run's own seed restores.

## Why this is a capture and not an edit

The v0.0.2 milestone is frozen pending the maintainer's code and security reviews.
`REQUIREMENTS.md` is a milestone artifact, so amending it now would push an unreviewed
requirement change into a diff the maintainer is mid-review on.

## Note on scope

ROBUST-04's own mitigation is unaffected -- `action-bundle-drift` is the job that actually
catches drift, and it is untouched. Only the sentence about how drift SURFACES is wrong. The
requirement's checkbox should not be un-ticked on the strength of this.

## Related

- `docs/advanced.md` carried the mirror-image error for a version BUMP and was corrected by
  quick `260809-hcr`, guarded by `docs-same-os-claims.spec.ts`.
- `09-VALIDATION.md`'s OBS-04 section records `mirrored 6` on the one real rotation (run
  `30400231720`), which is the same falsifier from the rotation side.
