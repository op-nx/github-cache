---
captured: 2026-08-09
source: quick 260809-hcr
type: correction
target: .planning/REQUIREMENTS.md (ROBUST-04)
blocked_by: v0.0.2 milestone freeze
amended: 2026-08-09
amended_by: quick 260809-iqe
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

The quoted wording is wrong in a second, smaller way. Under drift the shard stops receiving
real cache content, but it is not empty: in the same job the publish leg seeds and mirrors
its own synthetic entry, through the `dist/`-built internal action that bundle drift cannot
touch. That single mirrored entry is the same fact restated -- it is why the all-restore-MISS
gate, which requires `mirrored === 0`, stays silent. "Stops receiving anything" is literally
false while being substantively right.

Nor did any runtime signal take its place. Before 2026-08-09 there was no partial branch at all
in `packages/github-cache/src/publish/publish-mirror.ts`, so drift was fully runtime-silent for
the requirement's entire life, 2026-07-26 to 2026-08-09. The partial branch was introduced that
day by `e78a842`, and gated on a Wilson lower bound hours later by `aee017c`.

## No drift was actually shipped in that window

The gap above was latent and unrealised. It stood open for two weeks and nothing rode through it.

The evidence is a direct measurement, not an argument. The last commit to rebuild the bundle is
`501bcb1` (2026-08-04). Forty-seven commits later -- measured at `23d9207`, this amendment's
parent -- a fresh build still reproduced the committed `start-cache-server/index.js` byte for
byte.

The commit accounting agrees. Nine commits rebuilt the committed bundle in that window
(`969de3e..HEAD`). Eight of the nine paired with the source change that required them; the
ninth, `db577db`, was driven by a lockfile re-resolution -- `undici` 6.27.0 to 6.28.0 -- and
staged the rebuilt bundle in that same commit. Seven further commits touched a bundled source
without rebuilding the bundle; all seven are comment-only, and esbuild emits no comments here,
so none of them changed a byte of the bundle.

Residual, stated rather than hidden: the byte-identity measurement directly covers only the two
unpaired commits that landed after `501bcb1`. For the earlier five the argument is the
comment-only classification plus the strip behaviour those two demonstrate, and any transient
staleness would in any case have been absorbed by the next paired rebuild.

The drift guard itself has fired once in this window: Phase 7's `check:action` caught an 88-line
dependency-driven drift on 2026-07-27, and the rebuild was staged in the same commit.

## What is established about how drift surfaces from 2026-08-09 onward

The partial branch introduced that day does not resolve any of this.

Under drift the proportional warning is expected to be silent for most of the month: an entry
already in the month shard is skipped before any restore is attempted (`publish-mirror.ts:635`),
counted into `alreadyPresent` rather than `readMisses`, so it stays in the warning's denominator
-- the full enumeration -- and leaves its numerator.

That is an expectation, not a guarantee. The skip is guarded on a shard that resolves only after
the first restore HIT, so the outcome is enumeration-order dependent, and enumeration order is
pinned nowhere. Entries enumerated ahead of the first hit are attempted regardless of shard
membership. Mid-month quiet is the expected behaviour; it is not something to rely on.

At month-shard rollover the shard is new and empty, nothing can be skipped, and the warning
fires. It names only two candidate causes -- a cache-version rotation in the commit range, and
the runtime token's Actions-cache read scope (`publish-mirror.ts:895-902`) -- and the comment at
`:866` directs the reader to treat the branch as the live rotation signal. Bundle drift is
neither. So drift surfaces as a warning pointing at a cause that did not occur.

Both outcomes are bad, and neither resolves the gap this capture records.

## The misattribution is an open, unfiled defect

A warning that points an operator at a cache-version rotation that never happened is a
consumer-facing defect in its own right, of the same species as the one in `docs/advanced.md`
that quick `260809-hcr` fixed. It is deliberately not filed as a separate follow-up: the
maintainer was offered exactly that and chose the edit alone. Recording it here is what keeps it
from being dropped instead.

Worth noting alongside it: `publish-mirror.ts` is not in the action bundle's 18-file input set.
The drifting artifact and the warning that misattributes it sit in different graphs entirely.

## Why this is a capture and not an edit

The v0.0.2 milestone is frozen pending the maintainer's code and security reviews.
`REQUIREMENTS.md` is a milestone artifact, so amending it now would push an unreviewed
requirement change into a diff the maintainer is mid-review on.

## Note on scope

ROBUST-04's own mitigation is unaffected -- `action-bundle-drift` is the job that actually
catches drift, and it is untouched. Only the sentence about how drift SURFACES is wrong. The
requirement's checkbox should not be un-ticked on the strength of this. The 2026-08-09
amendment does not change that. It sharpens how the surfacing sentence is wrong and records
that the gap went unrealised; neither bears on the mitigation.

## Related

- `docs/advanced.md` carried the mirror-image error for a version BUMP and was corrected by
  quick `260809-hcr`, guarded by `docs-same-os-claims.spec.ts`.
- `09-VALIDATION.md`'s OBS-04 section records `mirrored 6` on the one real rotation (run
  `30400231720`), which is the same falsifier from the rotation side.
