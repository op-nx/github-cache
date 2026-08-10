# Quick Task 260808-u2q: Stop the temporary-main-window restore force-push from firing the production publish legs, and triage the unattributed test failure at 69bd1b7 - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Task Boundary

Two independent halves, sharing one task because both are follow-ups the v0.0.2 milestone
audit left genuinely open.

**Half A (load-bearing).** The maintainer opens a TEMPORARY WINDOW on `main` to observe what a
pull request structurally cannot: push the feature tip to `main`, let the push-only jobs run,
then force-push `main` back to `fe25a3f`. Merging is PROHIBITED, so this window is the only
sanctioned measurement instrument. The RESTORE force-push itself fires a full production
`ci.yml` run, including the `publish` legs writing for real. `[skip ci]` is structurally
unavailable because the restore re-pushes an EXISTING commit and cannot alter its message.

**Half B.** One unattributed test failure at `69bd1b7`, not reproducible in 7 attempts, with no
output captured.

This task is ORDERED BEFORE the operator plan's item 3, and the ordering is load-bearing: item 3
uses this exact window procedure as its instrument, so the defect is fixed before it is relied on.
</domain>

<decisions>
## Implementation Decisions

Every decision below was auto-locked under `discuss-phase --auto` semantics. None sits in the
trap quadrant (high-impact AND not-high-confidence): the one high-impact choice was deliberately
held until research raised it to HIGH confidence on measured evidence, rather than locked on a
plausible default.

### The discriminator between a restore push and a real one

**LOCKED: `github.event.forced`, gating the `publish` job only.**

```yaml
if: ${{ !cancelled() && github.event_name == 'push' && !github.event.forced }}
```

A restore is a REWIND and therefore non-fast-forward; a window-open push is a fast-forward,
because the feature branch descends from `fe25a3f`. The same condition skips the restore while
still letting the window-open push publish -- which item 3 REQUIRES, so a fix that suppressed
both would break the very measurement this exists to protect.

Confidence HIGH, and not from reasoning alone. Research classified all 70 `PushEvent`s on
`refs/heads/main` and cross-checked ancestry with `git merge-base --is-ancestor`: in the
`fe25a3f` era, 22 of 22 separate correctly with zero misclassification -- 11 restores, all
rewinds; 11 window-opens, all fast-forwards, including the current tip; plus the merge push that
created `fe25a3f`, a fast-forward that published correctly.

### Why not the alternatives

- **A repository-variable toggle flipped around the window** -- REJECTED. It requires an action
  DURING the window and fails OPEN when forgotten, which is precisely the defect being fixed.
- **A hardcoded `before == fe25a3f` check** -- REJECTED. It rots the moment the restore point
  moves, and a rotted hardcoded value is this project's recurring defect class.
- **`workflow_dispatch`-only publishing** -- REJECTED. It would stop the window measuring the
  push path at all, which is the thing being measured.

### Scope of the gate

**LOCKED: `publish` only.**

`publish-verify` follows for free through `needs: publish` -- confirmed on run `30825636788`,
where publish failed and publish-verify shows `skipped`. `dogfood-seed` and `consumer-smoke` are
left alone: their writes are run-id-scoped Actions-cache entries that age out on their own, so
they are not production writes in the sense that matters here.

### No tripwire for a wrongly-skipped publish

**LOCKED: do not build one.**

A wrongly-skipped publish is silent in the general case, and that was weighed rather than
overlooked. It fails CLOSED -- the outcome is a missed measurement and no production write, and
the gap is recoverable by construction. A tripwire asserting "the mirror received this commit"
would fire on correct behaviour in exactly the way this project's own OBS-04 record warns about.
Not worth building.

### Where the change lives

**LOCKED: the job `if:`, with rationale in the surrounding comment.**

`ci.yml` documents the reasoning at every gate, so a bare condition would read as bolted on. The
comment must say why `forced` is the discriminator and why the window-open push is unaffected.

### The procedural half

**LOCKED: record the restore procedure alongside the fix.**

The gate makes the restore safe; it does not make the procedure written down. Note the one
operator habit that matters -- a plain `git push` on the window-open push, never `--force` -- and
that a second window opened while the first is still open fails closed.

### Half B -- the 69bd1b7 failure

**LOCKED: unactionable until it recurs WITH output. Do not manufacture an investigation.**

Research settled it: `69bd1b7` is docs-only (one `.planning` file, +326, zero source),
`gh run list --commit` returns empty so no CI run ever existed, and the failure was a local
battery run whose output the loop's redirect discarded. There is nothing left to investigate.

**The actionable part is capture, not diagnosis:** change the battery loop's redirect so the next
occurrence keeps its output (`tee "$LOG"; exit ${PIPESTATUS[0]}`, preserving the real exit code
rather than `tee`'s). Nx caches terminal output for successful runs only, so a failed run's output
is lost unless captured at the point of failure.

### Claude's Discretion

Commit granularity, comment wording, and whether the two halves land as one commit or two.
</decisions>

<specifics>
## Specific Ideas

- The occurrence count inherited from the handoff is WRONG and must be corrected rather than
  repeated: **11 restore pushes, not five**. Backup refs are reused by name, so counting
  `refs/backups/*` cannot count events -- which is exactly why the five-figure looked right.
- The impact is larger than "a red run". Five of the twelve restore-shaped runs concluded
  `success` and completed their uploads, consuming roughly 88 asset slots against the 1000/month
  shard cap, per `ci.yml`'s own arithmetic.
- Run `30825636788` reached a genuine production write before failing:
  `POST /repos/op-nx/github-cache/releases` returning 422.
- The single fact that would refute the fix, stated so it can be checked rather than trusted: if
  GitHub set `forced` from the client's `--force` flag rather than from server-computed
  non-fast-forwardness. It cannot -- the push wire protocol carries only
  `<old-oid> <new-oid> <refname>` with no force bit, and `forced-update` exists only
  server-to-client in `report-status-v2`. This is what makes the gate robust against an operator
  habitually typing `--force-with-lease` on the open push.
- **Do NOT touch the five `refs/backups/*` on origin.** They are evidence, not cleanup targets.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/quick/260808-u2q-stop-the-temporary-main-window-restore-f/260808-u2q-RESEARCH.md`
  -- the measured classification, the protocol argument, and the Half B probe results.
- `.github/workflows/ci.yml` -- `publish` (~2206), `publish-verify` (~2427), `dogfood-seed`
  (~1947), and the shard-cap arithmetic (~2323-2331).
- GitHub webhook payloads and Actions contexts documentation; `gitprotocol-pack`,
  `git-send-pack`, `git-receive-pack`.
</canonical_refs>
