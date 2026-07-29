# Phase 10 live-CI evidence -- the push-gated half, observed

Companion to `10-EVIDENCE-PRE-RENAME.md`, which holds the PERISHABLE pre-rename baseline. This
file holds the POST-rename live observations that no PR run can reach, because `publish`,
`publish-verify`, `dogfood-seed`, `dogfood-verify` and `consumer-smoke` are all gated on
`github.event_name == 'push'` and `on.push.branches` is `[main]` only.

## How this was sampled, and how `main` was left

A maintainer-authorised TEMPORARY push of the phase branch to `main`, then an immediate restore.
Same procedure as Phase 9's run `30400231720`, and the same procedure that auto-marked PR #9 and
now PR #10 as MERGED (GitHub closes a PR when its head becomes reachable from the base).

| Item | Value |
|---|---|
| Observed run | `30471772954`, event `push`, branch `main` |
| Head commit | `180c3d3` (the phase-close commit) |
| `main` before | `fe25a3f` |
| `main` after restore | `fe25a3f` -- verified by SHA equality, not by assumption |
| Backup ref retained | `refs/heads/backup/main-before-phase10-verify` = `fe25a3f` |
| Run conclusion | `success` -- all 22 job legs green |

`main` does NOT contain Phase 7-10 work. `180c3d3` is not an ancestor of `fe25a3f`.

**The restore is a git-ref restore ONLY.** It does not and cannot un-publish the Release assets
the run uploaded -- and that is the intended outcome, not a side effect to regret: the warm mirror
under the new name is Phase 11's hard precondition (CORR-02).

**The restore force-push itself fires a `push` run on `main`** (run `30473116345`, head
`fe25a3f`). That is expected and has precedent -- Phase 9's restore produced run `30401077417` the
same way. It runs PRE-CORR-02 code, so anything it mirrors lands under the LEGACY
`<hash>-<os>` name. Most of it hits first-write-wins skips because `fe25a3f`'s task hashes were
already mirrored by run `30401077417`. Read the census below as the CORR-02 delta; a later count
that includes the restore run's own dogfood seeds is not a contradiction of it.

---

## The shard census, before and after

`cache-mirror-202607`, read via `gh api repos/op-nx/github-cache/releases/tags/cache-mirror-202607`.

| Bucket | Before the push | After the push | Delta |
|---|---|---|---|
| Total assets | 122 | 138 | +16 |
| `nx-cache-*` (new form) | **0** | **16** | **+16** |
| Legacy `<hash>-<os>` | 72 | 72 | **0** |
| PoC-era other (`.tar.gz` family) | 50 | 50 | 0 |
| Assets carrying a label | 0 | 16 | +16 |

Label distribution after: `mirrored-by: linux` = 15, `mirrored-by: windows` = 1, `(none)` = 122.

**CORR-02's prediction holds on every clause.** Nonzero mirrored, `nx-cache-*` names present,
legacy names STOPPED GROWING (72 -> 72, not 72 -> 74+), and the pre-existing 122 unlabelled assets
untouched.

**The falsifier was pre-registered and did NOT fire.** It read: "if the ubuntu leg reports
`mirrored: 0` with `readMisses == scanned`, the full-republish prediction is falsified and must be
recorded as such." Measured `readMisses` is **0** -- the ubuntu leg logged 16 `Cache hit for:`
restores and ZERO restore-MISS lines, with no all-restore-MISS warning anywhere in the job. The
prediction is confirmed, not rescued.

### The 16 new-form assets

Ten real task hashes, plus the `dogfood-seed` run keys (`30400231720`, `30471772954`), the
`cafe<run_id>` family (`cafe30400231720`, `cafe30471772954`), and the two per-leg mirror seeds
(`feed230471772954`, `feed030471772954`).

---

## OBS-05 -- CLOSED, both halves

The requirement has two clauses and each was observed separately.

**Clause 1: each `publish` leg seeds a leg-DISTINGUISHABLE hash.**

```
publish (ubuntu-24.04-arm): github-cache mirror-seed: stored feed230471772954 for this linux publish leg (PUT 200).
publish (windows-11-arm):   github-cache mirror-seed: stored feed030471772954 for this windows publish leg (PUT 200).
```

`feed2...` vs `feed0...` -- distinct per leg, both valid lowercase hex, both non-all-decimal. The
derivation is `mirrorSeedHash`, in TypeScript at both call sites, from the raw `github.run_id`.

**Clause 2: each `publish-verify` leg reads back its OWN leg's asset.**

```
publish-verify (ubuntu-24.04-arm): ... mirrored-by: linux'); the real publisher/reader round-trip is closed.
publish-verify (windows-11-arm):   ... feed030471772954 ... mirrored-by: windows'); the real publisher/reader round-trip is closed.
```

Each leg named ITS OWN OS as the publisher of the asset it read. Neither read the other's.

**The non-vacuity condition was the one that mattered, and it was met.** The pre-registered
expectation was that `publish (windows)` must mirror exactly ONE asset -- its own seed -- and NOT
zero, because a zero would mean the per-leg seed never landed and OBS-05's detector would be
passing on nothing. The census shows exactly one asset labelled `mirrored-by: windows`, and it is
`nx-cache-feed030471772954`. The windows leg's REAL-task count is zero, which is exactly what
`10-08`'s corrected `ci.yml` carve-out predicts: XOS-07's widened `needs:` means ubuntu's
enumeration snapshot now already contains every real task hash, so first-write-wins leaves the
windows leg only its own seed. The windows publish log corroborates it -- it restored BOTH
`feed030471772954` and `feed230471772954` and uploaded only the former.

That single asset is the whole reason the guard is not vacuous, and it is present.

---

## XOS-07 -- CLOSED, and the closed race is measurable

Job timings from the run, all UTC:

| Job | Completed |
|---|---|
| `build`, `typecheck`, `test`, `integration (ubuntu-24.04-arm)` | all by 16:40:36 |
| `integration (windows-11-arm)` -- the slowest `needs:` dependency | **16:43:49** |
| `publish (ubuntu-24.04-arm)` -- started | **16:43:52** |

`publish` started 3 seconds after the LAST of its four dependencies finished, having waited
roughly 3m16s for the Windows integration leg specifically. Under the pre-phase `needs: build` it
would have started at about 16:40:32.

That is the race closed, stated as a measurement rather than as a config reading: on run
`30400231720` `publish` enumerated the Actions cache 122 seconds BEFORE `integration` finished, so
the Windows integration hash could not be in the snapshot. The old behaviour's fingerprint was a
task hash present only under `-windows` and never under `-linux`; the census above has no such
asset.

**One push mirrored that push's full task set** -- the second half of XOS-07's live clause. All
ten real task hashes appear exactly once each, under `nx-cache-<hash>`, with no OS suffix and no
duplicate.

### `max-parallel: 1` (XOS-06) held

`publish (ubuntu)` 16:43:52 -> 16:44:49, `publish (windows)` 16:44:51 -> 16:49:01. Strictly
non-overlapping. This is the non-overlap dependency U-01's label assertion needs; had the legs
run concurrently, either could have won the race for the other's seed and reddened
`publish-verify` on correct code.

---

## Phase 9's carry-forward -- satisfied in substance, SUPERSEDED in wording

Phase 9 left this open: "`publish-verify (windows-11-arm)` green with a `'linux'` producer line."

The job is green. But its producer line reads `mirrored-by: windows`, and that is CORRECT rather
than a miss: OBS-05 deliberately redesigned that job to read its OWN leg's seed, so a `'linux'`
line there would now mean the Windows publish path was dead. Phase 9's wording predates the
redesign and cannot be satisfied literally without reintroducing the vacuity OBS-05 closed.

The cross-OS read it was really asking about IS proven live, by the job that owns VER-06:

```
dogfood-verify (windows-11-arm): github-cache dogfood verify: cache HIT for 30471772954 on
windows with bytes matching a 'linux'-produced payload.
```

A Windows runner read back a Linux-produced entry. Recorded as a wording supersession, not as a
closed checkbox against the old text.

`dogfood-verify (ubuntu-24.04-arm)`, `consumer-smoke` and both `hash-parity` legs plus
`hash-parity-compare` were also green on this run.

---

## What remains unobservable

Nothing in Phase 10. Both live clauses are now sampled.

`XOS-01` / `XOS-02` (Phase 11) still need a LOCAL Windows-workstation read against the now-warm
mirror. `10-01`'s note stands: until this push, a post-rename local read MISSed for a single known
cause, and that was an open PRECONDITION rather than a defect. The mirror is now warm under the
new name, so that precondition is DISCHARGED and Phase 11 can measure the Nx-level `[remote cache]`
hit. The calibrated instrument to re-run is `10-01`'s 401/404/200 triple plus `isWriteTrusted`
false.
