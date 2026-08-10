# Quick Task 260809-og2: Address the rollover misattribution in the publish mirror warning - Context

**Gathered:** 2026-08-09
**Status:** Ready for research, then planning
**Discussion mode:** `--auto` (gray areas auto-locked, each rated IMPACT x CONFIDENCE per CLAUDE.md;
the one trap-quadrant item is NOT locked and is routed to measurement)

<domain>
## Task Boundary

The defect quick `260809-iqe` recorded as open and unfiled: the publish mirror's read-miss warning
enumerates exactly two candidate causes, and under action-bundle drift it fires naming a cause that
did not occur while never naming the one that did.

`260809-iqe` was the maintainer's chosen option 1 -- apply the correction, do not file the defect.
This task is the filing-and-fixing the integrity critic recommended, now requested explicitly.

</domain>

<what_is_already_established>
## Established by quick 260809-iqe's research pass -- re-derive, do not re-assume

These carry verdicts in `.planning/quick/260809-iqe-.../260809-iqe-RESEARCH.md`. They are the
starting point, NOT settled fact: that research was measured against `23d9207` and the tree has moved
three commits since. Anything load-bearing gets re-derived at HEAD.

- **C-F (CONFIRMED).** The partial branch's `core.warning` names exactly two candidate causes: a
  cache-version rotation in the commit range, and the runtime token's Actions-cache read scope.
  Bundle drift is neither, and is named nowhere in the message.
- **C-F, second half.** The comment above the branch instructs the reader to treat it as the live
  rotation signal. So the source itself directs a reader who sees it fire toward a cause that, under
  drift, is absent.
- **C-G (CONFIRMED, with a caveat).** An entry already in the month shard is skipped before any
  restore is attempted, counted into `alreadyPresent` rather than `readMisses`, so it stays in the
  warning's denominator and leaves its numerator. Mid-month the warning is therefore expected to be
  silent; at month-shard rollover the new shard is empty, nothing can be skipped, and it fires. The
  caveat: the skip is guarded on a shard that resolves only after the first restore hit, so the
  outcome is enumeration-order dependent and order is pinned nowhere.
- **C-H (CONFIRMED).** Under drift the publish leg still seeds and mirrors its own synthetic entry
  through the `dist/`-built internal action that drift cannot touch, so `mirrored >= 1` and the
  TOTAL-case gate (which requires `mirrored === 0`) cannot fire under drift at all.

</what_is_already_established>

<decisions>
## Implementation Decisions

### Scope: BOTH warning sites, not just the partial branch

IMPACT medium. CONFIDENCE high. Auto-locked.

The task was requested against "the rollover misattribution", which lives in the partial branch. But
reading the source shows the TOTAL-case gate carries the **identical** closed enumeration -- the same
"Two candidate causes: (1) a cache-version rotation ... (2) the runtime token's Actions-cache read
scope" sentence appears in both messages. Fixing only the branch the report named would leave its
sibling asserting the same closed set, which is the patch-the-symptom shape this project has been
bitten by before. Whatever the fix turns out to be, it applies to both sites.

Note the asymmetry that research must respect: per C-H the total gate **cannot** fire under bundle
drift, so drift is not a missing cause *for that branch specifically*. The shared defect is the
closed-enumeration FORM, not the drift instance. Do not "fix" the total gate by adding a cause it
cannot have.

### `.planning/REQUIREMENTS.md` remains untouchable

IMPACT high. CONFIDENCE high. Auto-locked.

Settled twice by two unanimous reviewers and re-affirmed by `260809-iqe`. ROBUST-04's checkbox stays
ticked. Nothing in this task edits that file.

### A source change is in scope; the milestone freeze does not bar it

IMPACT high. CONFIDENCE high. Auto-locked, with a re-check assigned to research.

The freeze that made ROBUST-04 a capture rather than an edit was specific to `REQUIREMENTS.md` as a
milestone artifact the maintainer is mid-review on. Source changes have continued landing on this
branch throughout: `260809-2s6` changed `publish-mirror.ts` itself, and `260809-hcr` landed a docs
correction plus its guard. So "the milestone is frozen" is not a reason to reduce this to a capture.
Research re-checks that no narrower freeze covers `publish-mirror.ts` specifically.

### Any behavioural change ships with a guard

IMPACT medium. CONFIDENCE high. Auto-locked.

Every comparable correction in this area shipped with a test that fails if the corrected claim
returns -- `260809-hcr`'s `docs-same-os-claims.spec.ts`, `260809-2s6`'s negative assertion over
`mock.calls.flat()`. The same applies here. Note the existing convention the source records: the
forbidden phrases are split inside the spec so they are not planted verbatim in the file that proves
them absent.

### Claude's Discretion

Message wording, comment updates, test placement, and whether the internal
`09-ROTATION-SIGNAL.md` pointer needs a companion change.

</decisions>

<unresolved>
## Trap quadrant -- NOT auto-locked, routed to measurement

**Whether the fix may name bundle drift in the warning text at all is HIGH-IMPACT and
NOT-HIGH-CONFIDENCE, and the two obvious answers each violate a different project rule.**

- If drift is **consumer-reachable**, the message should name it, and omitting it is the defect.
- If drift is **dogfood-only**, then naming it in a stranger's CI log is our own incident record
  rendered as their job log -- which `PROJECT.md`'s distribution constraint forbids, and which is
  precisely the defect `260809-2s6` REMOVED from this same warning string weeks-scale ago. "Fixing"
  the misattribution that way would re-introduce a defect the project has already paid to delete.

The evidence is genuinely split, which is why this is not being decided by argument:

- `HANDOFF.json`'s refuted-claim 4 argues the hole is **unreachable** for consumers, and not merely
  theoretical: `packages/github-cache/package.json` `files` carries `!dist/action`, `src/index.ts`
  exports only `createCacheServer`, and the internal `action.yml` `main` points at an untracked path,
  so a consumer `uses:` against the git ref cannot resolve it. It adds that the version-mismatch
  CLASS remains reachable for them by other means -- two jobs pinning different refs, a stale major
  tag -- but surfaces as ordinary Nx misses, never as a publish warning.
- Against that: **"dogfood-only" is falsification #1 in this very defect class.** The previous
  session asserted the OBS-04 gate was dogfood-only and then that it was effectively unreachable, and
  both were overturned. A reachability argument in this area has a measured track record of being
  wrong.
- And the source ALREADY treats drift as a real look-alike: the comment above the total gate calls it
  "the bundle-drift signal that looks exactly like this one but is a defect" and points the reader at
  `.planning/phases/09-.../09-ROTATION-SIGNAL.md` -- a path no consumer can read. So the project has
  already decided drift is worth warning about, and has put the warning somewhere only we can see it.

Research resolves reachability from the packaging and workflow evidence, at HEAD, and only then does
the planner choose the message's shape. A third shape exists and may dominate both: **stop claiming a
closed enumeration** -- drop "Two candidate causes" for a form that does not assert completeness --
which fixes the misattribution without naming any dogfood-specific mechanism in a stranger's log.
Research should evaluate it on the same evidence rather than treating it as the assumed answer.

</unresolved>

<constraints>
## Hard constraints

- **DO NOT touch `.planning/REQUIREMENTS.md`.**
- **DO NOT merge anything** -- not v0.0.2, not PR #16, not any branch. Standing and absolute until
  the maintainer says otherwise.
- **The warning message is written for a stranger's CI log.** `PROJECT.md`'s distribution constraint
  governs its CONTENT, not just its tone: no reference to this repository's own incident history, own
  run ids, own measured baselines, or own internal `.planning` paths.
- **It stays a warning, never a failure.** `setFailed` in this file is reserved for per-item upload
  faults; nothing in this task may add a red signal.
- Behavioural change ships with a guard that fails if the corrected claim returns.
- No emoji or non-ASCII anywhere -- `--` not an em dash, `->` not an arrow.

</constraints>

<canonical_refs>
## Canonical References

- `packages/github-cache/src/publish/publish-mirror.ts` -- 923 lines. Total-case gate and its message
  around `:804-816`; partial branch and its message around `:880-903`; the rotation-signal comment
  around `:866`; the stranger's-CI-log constraint stated in the comment block above the partial
  message. Line numbers are as read on 2026-08-09 and may move -- re-locate, do not trust.
- `packages/github-cache/src/publish/publish-mirror.spec.ts` -- existing negative assertions over
  `mock.calls.flat()`, and the split-phrase convention.
- `.planning/quick/260809-iqe-.../260809-iqe-RESEARCH.md` -- C-F, C-G, C-H verdicts.
- `.planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md` -- where this defect is
  currently recorded as open and unfiled.
- `.planning/phases/09-os-invariant-actions-cache-version/09-ROTATION-SIGNAL.md` -- the internal doc
  that already carries the bundle-drift look-alike.
- `.planning/PROJECT.md` -- the distribution constraint.

</canonical_refs>
