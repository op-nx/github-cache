# Quick Task 260810-v1g: Close the two substantive v0.0.2 audit items - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Mode:** `--full --auto` (discussion auto-locked; the two headline decisions were supplied by the
maintainer in the invocation, so they are USER decisions, not auto-picks)

<domain>
## Task Boundary

The v0.0.2 milestone audit at `0dbee20` returned `tech_debt` with exactly two substantive items.
Both are closed here. Nothing else from that audit is in scope -- the ten prose/cosmetic items, the
v0.0.3 deferral lane, and the unattributed `69bd1b7` test failure are all explicitly OUT of scope.

**Item A -- per-commit gating.** Quick 260810-kuo's 22-commit range (`4518787..1b06816`) claims
"every commit leaves all six gates green", but that is measured at 10 of 22 commits on `test` only.
`260810-kuo-VERIFICATION.md` is `status: human_needed` for this reason.

**Item B -- the `readMisses` observation.** Quick 260809-2s6 fixed the publish mirror's seed
re-enumeration, but the post-fix number is only observable on a real push to `main`. Three things
are recorded NOT OBSERVED, and `10-VERIFICATION.md` carries a deliberately un-rewritten
`expected: readMisses 0`.

Not in scope: merging the milestone, merging PR #16, or closing the milestone.
</domain>

<decisions>
## Implementation Decisions

### Item A -- depth of per-commit gating (USER, locked)

**Best effort.** Run per-commit gating as far as it gets; do NOT treat 22/22 as a pass condition.
Record exactly which commits were gated on which gates, and say plainly what was not reached. A
partial measurement honestly scoped is the deliverable -- the failure mode to avoid is rounding a
partial sweep up to "all commits green".

**MEASURED post-decision: best effort reaches 22/22 comfortably.** The full eight-gate uncached
battery is **13 seconds** at HEAD (timed in this session: 6s for the five `nx` targets with
`--skip-nx-cache`, 7s for `format:check` + `check:action` + `fallow:ci`; all eight green, 1145 unit
tests + 15 integration). So the whole sweep is ~22 x 13s of compute plus checkout overhead --
roughly ten minutes, not the hours the "22 checkouts x 6 gates, not run" framing implies. That
framing predates any measurement of the battery.

This does NOT convert the decision into "22/22 required". It means the honest report is expected to
BE 22/22, and any commit not reached needs a named reason rather than a cost excuse.

### Item B -- the live window (USER, locked -- SUPERSEDED post-research, re-decided by the USER)

**ORIGINAL:** approved a temporary push to `main`, backup ref before and restore after.

**SUPERSEDED: NO WINDOW.** Research plus independent verification established that all three of
item B's NOT OBSERVED items are ALREADY CLOSED by run `31305961054` -- a push-to-`main` window
quick 260809-2s6 opened for itself on 2026-08-09 at head `e3bf98b`. Re-measuring something already
measured is not worth a production push. Put back to the maintainer with the verified evidence;
the maintainer chose **"No window -- close from run 31305961054"**.

Item B's work is therefore a RECORDS closure, not a live observation. No push, no backup ref, no
restore, no `gh workflow disable`.

### Two "facts" this file originally asserted that are MEASURED FALSE (corrected)

Both were mine, from the pre-flight, and both are corrected here so the planner does not inherit
them. Recording rather than silently overwriting, because each was load-bearing.

**FALSE 1 -- "the audit's item B is open."** `260809-2s6-SUMMARY.md` contains TWO
`## NOT OBSERVED` sections, one per plan. The first is PLAN-1's, written BEFORE the window, and
lists the three items. The second is PLAN-2's, written AFTER, and lists two entirely different
things. The milestone audit read the first and inherited a stale claim. The audit must be corrected
as part of this task.

**FALSE 2 -- "the restore force-push is safe because the `!github.event.forced` gate skips
`publish`."** The gate is present at HEAD but **ABSENT at `fe25a3f`**, which is the restore target.
A `push` event runs the workflow at the pushed TIP, so a restore to `fe25a3f` runs the UNGATED
workflow and attempts real production writes. Corroborated three ways: `260808-u2q-SUMMARY.md`
states it explicitly (and contradicts itself in its own `must_haves`, which is the line this file
originally lifted); `260808-wxg-EVIDENCE.md` warns "every window until v0.0.2 lands needs the hop-3
suppression"; and four `fe25a3f` push runs carry conclusion `failure` from exactly this. The
mitigation (`gh workflow disable`) is recorded as DENIED to the agent. This is the second
independent reason not to open a window.

### Gate set for item A (Claude's discretion -- resolved by superset)

The artifacts say "six gates" in the bisect claim and "eight gates" in the battery, and never
enumerate the six. Rather than guess which six, run the full EIGHT-gate battery per commit:

    npx nx run-many -t build typecheck test integration lint --skip-nx-cache
    npm run format:check && npm run check:action && npm run fallow:ci

Eight is a superset of any reading of "six", so this cannot under-deliver against the claim. The
ambiguity is recorded rather than silently resolved.

### Ordering: Item B fully closed BEFORE Item A starts (Claude's discretion)

Strictly sequential, B then A. Not a preference -- item A performs 22 `git checkout`s, so running
it during the window would leave the working tree detached at a historical commit while `main`
points at the feature tip. The two cannot overlap. B's window must be opened AND restored before
A's first checkout.

### One `npm ci` covers all 22 checkouts (Claude's discretion, MEASURED)

`git diff --name-only 4518787..HEAD -- package.json package-lock.json` is empty, so dependencies
are constant across the whole range. A single install serves every checkout. If that measurement
ever stops holding, per-commit gating needs a per-commit install and the cost estimate changes.

### `--skip-nx-cache` is mandatory per commit (Claude's discretion)

Nx caches terminal output for successful runs, so a warm `.nx/cache` replays a prior verdict and a
per-commit gate would prove nothing. Every per-commit invocation skips the cache.
</decisions>

<specifics>
## Specific Ideas

### What closes item B (three NOT OBSERVED items, from 260809-2s6)

1. The actual post-fix `readMisses` / `scanned` ratio -- the real numerator and denominator from
   the first live post-fix run on `main`. Every current figure behind the D5 threshold is DERIVED.
2. Both `publish-verify` legs staying green -- the live round-trip under the new seed filter.
3. The `bead` round-trip: the cross-job cache HIT has only ever run under the OLD key.

Closing item 1 is also what unblocks `10-VERIFICATION.md`'s `expected: readMisses 0` row, which
260809-2s6 deliberately left un-rewritten rather than replace one unverified expectation with
another. Rewrite it to the MEASURED value once the run exists -- never to a derived one.

### Pre-flight facts already established (do not re-derive)

- `origin/main` is at `fe25a3f`; the branch is 620 ahead, 0 behind, so the window-open push is a
  pure fast-forward, not a force-push.
- The `!github.event.forced` gate IS present in `ci.yml`, so the RESTORE force-push skips `publish`
  and `publish-verify`. This is why no workflow suppression is needed for hop 3 -- which matters
  because disabling a workflow is denied to the agent and would otherwise be a pre-flight blocker.
- Seven `refs/backups/*` already exist on origin, all at `fe25a3f`. Use a NEW, task-named backup
  ref; do not reuse or delete an existing one.
- The eight gates are: `build`, `typecheck`, `test`, `integration`, `lint` (via `nx run-many`),
  plus `format:check`, `check:action`, `fallow:ci`.

### Accepted consequence of item B, recorded so it is not a surprise

The window-OPEN push runs the production `publish` legs, which write REAL Release assets to the
public repo. That is the measurement mechanism, not a side effect -- `readMisses` is only
observable from a real publish run. Those assets PERSIST after the restore: the restore rewinds a
git ref, not a Release. Prior windows did exactly this. Accepted.

### Capture discipline (AGENTS.md, load-bearing)

Pipe every battery run through `tee` to a per-run log and capture `${PIPESTATUS[0]}` into a
VARIABLE -- never `exit ${PIPESTATUS[0]}` inline, which terminates the loop after one iteration and
reads as a clean pass over a battery that never ran. Keep a per-iteration suffix on the log name;
`date +%s` has one-second resolution and fast iterations collapse into one file. This exists
because Nx caches output for SUCCESSFUL runs only, so a failing run's output is destroyed by the
re-run. For item A this is the whole point: the per-commit sweep is worthless if a red commit's
output is lost.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/v0.0.2-MILESTONE-AUDIT.md` -- the audit that names both items (at `5c70c92`)
- `.planning/quick/260810-kuo-*/260810-kuo-VERIFICATION.md` -- item A's `human_needed` verdict
- `.planning/quick/260810-kuo-*/260810-kuo-SUMMARY.md` -- the 10-of-22-on-`test`-only measurement
  and the C1..C17 commit table
- `.planning/quick/260809-2s6-*/260809-2s6-SUMMARY.md` -- item B's three NOT OBSERVED items and the
  deliberate non-correction of `10-VERIFICATION.md`
- `.planning/quick/260808-wxg-*/` -- the prior three-hop window: procedure, recovery, and evidence
- `.planning/quick/260808-u2q-*/` -- the `!github.event.forced` gate and the window procedure
  recorded at its point of use
- `.planning/phases/10-os-invariant-releases-mirror/10-VERIFICATION.md` -- the `readMisses 0` row
  that item B closes
- `AGENTS.md` -- battery capture discipline; worktree decision rule
</canonical_refs>
