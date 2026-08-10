# Quick Task 260801-vyy: Resolve CR-18 - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning
**Mode:** `--full --auto` (gray areas auto-locked; each rated IMPACT x CONFIDENCE first)

<domain>
## Task Boundary

Resolve **CR-18**, a finding from the PR #12 round-3 code review.

**CR-18 as filed:** *Windows reuse legs are RECORDED, never GATED.*

- **Files:** `.github/workflows/ci.yml` (`build-windows` / `typecheck-windows` / `test-windows`)
- **Summary:** XOS-04's cross-OS HIT count is observed and printed; nothing fails when it is zero.
- **Failure scenario:** cross-OS reuse silently dies and CI stays green -- the milestone's
  headline outcome regresses with no signal.
- **Verdict:** CONFIRMED -- no assertion on the observed count.
- **Originally dispositioned:** SKIPPED, on the grounds that "RECORDED, never gated" is a
  recorded decision and that gating would change CI semantics on a first-run-cold cache.

The audit file that carried this finding is deliberately NOT committed to the repo (user
instruction: "No committing of code review or audit"), so this CONTEXT.md is the only
in-repo carrier of CR-18's definition. Everything the planner needs is restated here.

**IN SCOPE:** closing the signal gap CR-18 names.
**OUT OF SCOPE:** the other 24 review findings; any change to `nx.json`; anything that
rotates a task hash (this branch's entire subject is hash stability).

</domain>

<decisions>
## Implementation Decisions

### GA-1: Which mechanism closes CR-18 (LOCKED: enable dogfood on PRs)

IMPACT: HIGH. CONFIDENCE: HIGH (measured, see Specific Ideas). Not the trap quadrant.

**Decision: un-push-gate `dogfood-seed` / `dogfood-verify` so the already-sound cross-OS
gate runs on pull requests. Do NOT gate the three legs' `[remote cache]` counts.**

Rejected alternative (b) -- gate `count >= 1` on the three Windows legs. It is **not sound**:
the Windows legs write through a writable sidecar, so on a broken cross-OS restore they MISS,
execute, and SAVE their own entry. A re-run of the same commit then HITs that self-produced
entry and the gate goes green with cross-OS reuse still dead. **A gate a re-run can launder is
worse than no gate**, because it reads as coverage.

Rejected alternative (c) -- add a read-only Actions-cache backend so the consumer legs
structurally cannot write, making `count >= 1` sound. This is a genuinely good idea and the
`ReadableBackend` seam already exists (`memory-backend.ts` has no `put`). But it is a FEATURE,
not a config change, and it belongs after (a), not instead of it. Recorded as a follow-up.

### GA-2: Fork-PR scope (LOCKED: same-repo PRs only)

IMPACT: MEDIUM -- one `if:` condition, trivially reversible, freezes no contract.
CONFIDENCE: MEDIUM on fork behaviour specifically. Conservative option chosen BECAUSE
confidence is only medium.

Trigger becomes:

```yaml
if: github.event_name == 'push' ||
    github.event.pull_request.head.repo.full_name == github.repository
```

Fork PRs stay on the push path. Reason: this branch's own position (commit `fd75d83`) is that
a fork `pull_request` run still CREATES its cache in the merge ref -- but that is **CITED from
GitHub's docs, never reproduced here**, and this repo has never had a fork PR. Do not bet a
gating check on an unreproduced platform behaviour. Merged code still gets the push path, so
nothing is lost. Name the exclusion in the comment so it does not read as an oversight.

### GA-3: The three legs' count records (LOCKED: keep RECORDED, correct the stale reason)

IMPACT: LOW-MEDIUM. CONFIDENCE: HIGH (measured).

Keep the counts ungated -- GA-1 explains why that is now the RIGHT call. But the reason
currently written down is **factually wrong** and must be corrected in the same commit, in
both places it appears:

1. `.github/workflows/ci.yml`, all three legs: *"Gating on a non-zero count would redden a
   CORRECT leg on the first run after any version-affecting change, which is OBS-04's lesson
   about guards that fail on correct work."*
2. `packages/github-cache/src/dogfood-cross-os.spec.ts`, the `cacheObservation` reason string:
   *"the count is deliberately not gated, because reddening on a legitimate zero is OBS-04's
   lesson repeating."*

OBS-04's lesson (STATE.md:222, D-36) is **cross-run**: a version-affecting change legitimately
invalidates entries from EARLIER RUNS. These three legs are **intra-run** -- `needs: build` /
`needs: typecheck` / `needs: test` means the ubuntu producer runs first in the same run and
re-populates the entry seconds before the consumer reads it. The lesson does not transfer.

Replace with the true reason: the count is a **laundering-prone** signal (GA-1's re-run hole),
so it stays a diagnostic and the provenance-checked dogfood canary is the gate.

This repo has now corrected the same class of defect three times on this branch (`fd75d83`
ci.yml fork-PR, `7e777b3` README fork-PR, `9e949e4` eslint `no-undef`). A comment carrying a
false reason is a documented argument for undoing the work.

### GA-4: Pin the new trigger in a spec (LOCKED: yes)

IMPACT: MEDIUM. CONFIDENCE: HIGH -- it is the house idiom, and CR-17 set the precedent this
same day (the detector's `-t` list and its needle were pinned in one commit).

`dogfood-cross-os.spec.ts` already pins the seed job's single-leg shape and the verify job's
two-leg matrix from disk. It must also pin the new trigger, or a silent revert to push-only
reopens CR-18 with every other clause still green.

### Claude's Discretion

- Exact wording of replacement comments.
- Whether the new spec clause lives in the existing `dogfood-cross-os.spec.ts` describe or a
  new one -- prefer the existing file, it already owns this job pair.
- Whether to also correct the header block's other two stale sentences (lines ~1615-1617)
  while in there. Recommended: yes, they are the same false claim.

</decisions>

<specifics>
## Specific Ideas

### The measurement that refutes the recorded reason

Run **30717611910** (this branch's own round-3 push):

- The round-3 commits touched `compare.spec.ts`, `windows-regression-detector.spec.ts` and
  `eslint.config.mjs` -- all declared `test` inputs -- so `test`'s hash ROTATED.
- Ubuntu `test` **executed**: `@op-nx/github-cache:test 4.4s`, plus Nx's "share a cache across
  your team" nudge, which only prints when tasks were not cached. So it MISSed.
- `test-windows` recorded **1**.

That is exactly the "first run after a version-affecting change" scenario the comment claims
would redden a correct leg, and the count was 1, not 0. Recorded counts on that run:
`build-windows` = 1, `typecheck-windows` = 2, `test-windows` = 1.

### Why dogfood-verify is the sound gate

- Seed key is `nx-cache-<GITHUB_RUN_ID>` -- **run-scoped**, so no prior or self-produced entry
  can satisfy it.
- `dogfood-seed` is **ubuntu-only by design**, and `dogfood-cross-os.spec.ts` already pins that
  (a Windows seed leg would make the whole proof vacuous -- the spec says so in those words).
- The Windows verify leg asserts `expectedProducerOs = 'linux'` against the payload bytes
  (`action/index.ts:422`) -- a **PROVENANCE** check, not a presence check. It throws on a
  non-200 and on a producer mismatch.
- **Re-run-safe**: a re-run re-reads the same Linux-seeded entry and fails again.

### The stale claim being removed

`ci.yml` lines ~1615-1617: *"Both jobs run ONLY on the default-branch push trigger, because the
write gate trusts no other trigger (push/schedule only) and the read-only path is exhaustively
unit-tested instead."*

False. `HOST_GATED_EVENTS = ['pull_request', 'release']` (`lib/trust.ts:34`) and `isWriteTrusted`
returns `{trusted: true}` for `pull_request` on github.com (`trust.ts:92-97`). This is the third
site on this branch carrying that same misconception.

### What this does and does not cover

Closes the **storage** half of O4 on PRs. Does NOT cover the sidecar bundle path -- both dogfood
jobs run `uses: ./packages/github-cache`, built in-job, never the committed
`start-cache-server/index.js` that four of five sites execute. `action-bundle-drift` (already
unGated, runs on PRs) is what ties bundle to source. Combined with `hash-parity` for the hash
half, O4 is covered compositionally on every PR -- strictly more than today. State this limit
in the comment rather than letting a reader over-read the new gate.

### Cost

Three extra jobs per PR; long pole is the `windows-11-arm` verify leg at ~3-4 min, parallel with
`build-windows` (3m20s today), so little added wall clock. PR writes land in the merge-ref scope,
invisible to main's cache.

**CORRECTED BY RESEARCH -- do not repeat the original claim.** An earlier draft of this section
said "GitHub evicts them when the PR closes". That is FALSE. GitHub documents only two eviction
paths: 7-day-unaccessed, and the 10 GB per-repo LRU cap. Its *Managing caches* how-to ships an
OPT-IN `pull_request: types: [closed]` cleanup workflow precisely because closing a PR does NOT
auto-evict. This does not change the decision -- merge-ref scoping is the load-bearing half and
is confirmed -- but the false sentence must not reach a `ci.yml` comment. Each PR adds one small
run-scoped entry that ages out on the 7-day timer. Say that, or say nothing about eviction.



</specifics>

<canonical_refs>
## Canonical References

- `.github/workflows/ci.yml` -- `dogfood-seed` (1619), `dogfood-verify` (1656), the three
  Windows legs (474 / 547 / 620), and the header block at ~1602-1618
- `packages/github-cache/src/dogfood-cross-os.spec.ts` -- existing seed/verify pins; the
  `cacheObservation` reason string at ~685-695 that names this exact gap
- `packages/github-cache/src/lib/trust.ts:34,79-97` -- `HOST_GATED_EVENTS`, `isWriteTrusted`
- `packages/github-cache/src/action/index.ts:402-470` -- the verify branch's `'linux'`
  provenance assertion
- `.planning/STATE.md:222` -- D-36 / OBS-04's actual cross-run lesson
- Commits `fd75d83`, `7e777b3` -- the two prior corrections of the same fork-PR misconception
- Run `30717611910` -- the measurement in Specific Ideas

</canonical_refs>
