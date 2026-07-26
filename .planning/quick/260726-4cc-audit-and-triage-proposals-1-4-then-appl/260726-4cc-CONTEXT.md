# Quick Task 260726-4cc: Audit and triage Proposals 1-4 then apply the proposals that remain - Context

**Gathered:** 2026-07-26
**Status:** Ready for research
**Mode:** `--full --auto` (gray areas auto-locked EXCEPT where recorded UNRESOLVED below)

<domain>
## Task Boundary

Audit and triage the four improvements PROPOSED (and explicitly not applied) by the debug
investigation in `.planning/debug/windows-publish-one-asset.md`, then apply the ones that survive
triage, as bisect-safe atomic commits.

The four proposals, verbatim from that file's PROPOSED section:

1. **Report `scanned` and `readMisses` in the OBS-01 summary.** Add both to `PublishResult`
   (`publish/publish-mirror.ts:72-76`), return them from `publishMirror`, add two rows in
   `action/index.ts:156-160`. `scanned` is `hashes.length`; `readMisses` is already computed and
   just needs returning.
2. **Dedup `hashes` before the restore loop.** `publish-mirror.ts:162-168` maps one entry per
   (key, version) row, so every dual-version key is restored twice (12 redundant restores per leg
   in the measured run). A `[...new Set(...)]` removes the wasted round-trips.
3. **Document the expected shape.** One line in the publish docs: each `publish` leg can only
   mirror tasks that actually RAN on that OS, so a per-OS asset-count asymmetry is the expected
   shape.
4. **Update PITFALLS Pitfall 7** for two staleness corrections: the "windows-11-arm lacks zstd
   and falls back to gzip" clause is stale (both legs now use zstd), and the `uploadHash` symbol
   no longer exists (the mechanism is now the `restored.kind === 'miss'` branch at
   `publish-mirror.ts:184-189`).

IN SCOPE: triage each proposal on merit, then implement those that survive.
OUT OF SCOPE: anything that makes a publish leg mirror another OS's entries. The debug file
explicitly does not recommend it (`enableCrossOsArchive` would change every derived version and
invalidate the whole existing mirror), and the cross-OS value question is separately deferred.
Also out of scope: U2 (the `nx-cache-cafe<runid>` Linux-only entries) -- a distinct thread.
</domain>

<decisions>
## Implementation Decisions

Auto-locked per `--auto`, EXCEPT where recorded UNRESOLVED. Each is rated for IMPACT (hard to
reverse? freezes a contract?) and CONFIDENCE (evidence-backed, or a bare default?), per the
trap-quadrant rule: HIGH impact + NOT-HIGH confidence is never auto-locked.

### Proposal 1 is IN SCOPE and is the priority
- **Locked:** apply it. It is the change that would have made the investigated run
  self-explaining, and the debug file rates it the highest-value item.
- Impact MEDIUM (adds two summary rows and two interface fields), confidence HIGH -- verified
  directly this session: `PublishResult` is NOT exported from `packages/github-cache/src/index.ts`,
  so it is outside the DOCS-05 public surface (`public-surface.spec.ts` enumerates
  `createCacheServer` + 4 types only). Not a consumer-contract change. And `readMisses` already
  exists at `publish-mirror.ts:175`, incremented at 186 -- returning it is additive, not new logic.

### Proposals 3 and 4 are IN SCOPE (documentation accuracy)
- **Locked:** apply both. Impact LOW (prose only, no behavior), confidence HIGH -- proposal 4's
  two corrections were each verified against run 30180166604's job logs and a live
  `git grep uploadHash` returning nothing.
- Proposal 4 must NOT weaken the invariant Pitfall 7 protects. It is a staleness fix to the
  explanation, not a relaxation of the rule. The per-OS publish matrix and `cacheArchivePath`
  single-source remain load-bearing and comment-locked.

### TDD applies to the source changes
- **Locked:** `workflow.tdd_mode` is `true`. Proposals 1 and 2 touch source, so each gets a real
  RED before GREEN. A test that passes on first write is not evidence.
- Impact LOW (project standing policy), confidence HIGH (config-derived, not guessed).

### Commit shape
- **Locked:** one atomic commit per surviving proposal, each independently green on the full local
  battery. The user asked explicitly for bisect-safe atomic commits.
- Impact LOW, confidence HIGH (explicit user instruction).
- Ordering constraint: if BOTH 1 and 2 are applied, proposal 1 lands FIRST. Proposal 2 changes
  what `hashes.length` means, so `scanned` must exist and be tested before its denominator moves
  -- otherwise the bisect midpoint has a `scanned` whose semantics silently changed.

### Existing test suite is the regression gate
- **Locked:** the full battery (`format:check`, `build`, `typecheck`, `typecheck:action`, `test`,
  `fallow:ci`, `check:action`, `pack:check`) must pass at EVERY commit, not just at the end.
  430+ tests exist; a break in `publish-mirror.spec.ts` is the primary signal for both source
  proposals.
- Impact LOW, confidence HIGH (established project practice, recorded across prior quick tasks).

### Claude's Discretion
Exact field names on `PublishResult` (`scanned` / `readMisses` vs alternatives), the summary row
labels, which docs file receives proposal 3's line, test names and file placement, and the exact
wording of proposal 4's corrections -- all at the planner/executor's discretion within the
decisions above.
</decisions>

<unresolved>
## UNRESOLVED -- deliberately NOT auto-locked

### Whether Proposal 2's dedup changes the all-miss warning gate's semantics

`publish-mirror.ts:264` gates the read-scope-regression warning on:

    hashes.length > 0 && readMisses === hashes.length && mirrored === 0

Proposal 2 shrinks `hashes` by deduping (key, version) rows down to distinct hashes. That moves
the DENOMINATOR of this gate. The gate is the only automated detector for "this leg's
Actions-cache read scope has regressed" -- the exact failure the debug investigation showed is
otherwise invisible. So this is not a cosmetic refactor: it edits the condition of a safety
signal.

Two readings, and the evidence does not yet settle which holds:

- **(a) Dedup makes the gate MORE correct.** Today a dual-version key contributes TWO rows, so
  both `readMisses` and `hashes.length` can double-count, and a partial-miss population can
  coincidentally satisfy equality. Deduping to distinct hashes makes "every hash missed" mean
  exactly that.
- **(b) Dedup makes the gate FIRE MORE OFTEN, or changes when it fires, in a way not yet
  characterised.** `readMisses` is incremented per LOOP ITERATION (line 186). If dedup changes
  iteration count but the increment site is unchanged, the ratio shifts. Whether that widens or
  narrows the warning is unverified.

Rated HIGH IMPACT (it modifies the condition of the only regression detector for a silent
failure mode, and TRUST/OBS-adjacent) and NOT-HIGH CONFIDENCE (the debug file flagged the
`hashes.length` interaction only as a sequencing note -- "land it together with item 1 so
`scanned` means distinct hashes from the start" -- and did not analyse the gate's behavior under
dedup at all).

Per the trap-quadrant rule this is NOT auto-locked. **This is a question RESEARCH CAN SETTLE**,
so it is routed there rather than blocked: the research phase MUST characterise the gate's
behavior before and after dedup, with the increment site (line 186) and the gate (line 264) read
together. If research establishes the behavior with HIGH confidence, the planner may lock
Proposal 2 accordingly (apply, apply-with-gate-adjustment, or drop). If research CANNOT settle
it, Proposal 2 is DROPPED from this task and recorded as a follow-up -- proposals 1, 3 and 4
stand on their own and do not depend on it.

Explicitly: do NOT apply Proposal 2 while leaving the gate unanalysed. A behavior-neutral-looking
dedup that silently widens or narrows a silent-failure detector is precisely the class of change
this project's own PITFALLS document warns about.

### Whether Proposal 3's target doc is wired into nx test inputs

If proposal 3's line lands in a repo-root doc that a guard spec reads (`docs-adoption.spec.ts`
and `docs-trust.spec.ts` both read repo-root docs), that file may need to be in the nx `test`
target inputs -- the T-06-03-02 precedent, where a stale nx cache replayed a false pass because a
scanned file was not an input. Impact MEDIUM (a false-passing guard is worse than no guard),
confidence NOT-HIGH until the target file is chosen. Routed to research/planning: whichever doc
is chosen, verify whether a spec reads it and whether it is already an input.
</unresolved>

<specifics>
## Specific Ideas

Primary source, already written and committed as `24a2597`:
`.planning/debug/windows-publish-one-asset.md` -- the full root-cause report with E1-E9 evidence,
the eliminated hypotheses, the `correct_by_design` verdict, and the PROPOSED section these four
items come from. Read its ROOT CAUSE, E5, E6, and PROPOSED sections at minimum.

Measured numbers worth preserving in any test or doc wording:
- The investigated run's true per-leg counts were ubuntu `mirrored 6 / skipped 32 / failed 0` and
  windows `mirrored 2 / skipped 24 / failed 0`.
- Windows enumerated 37 rows, restored 25, MISSed 12. Under proposal 1 the summary would read
  `scanned 37 / mirrored 2 / restore-MISS 12 / skipped 12 / failed 0` -- the number that makes the
  4/1 split obvious without touching a log.
- `@actions/cache` logs a restore MISS at `core.debug` (`cache.js:294`), which is why the misses
  were invisible with `ACTIONS_STEP_DEBUG` unset. This is upstream behavior, NOT something to
  patch -- it is the reason proposal 1 matters.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/debug/windows-publish-one-asset.md` -- the proposals' origin and all supporting evidence.
- `.planning/research/PITFALLS.md` Pitfall 7 -- proposal 4's target; also the standing
  MUST-NOT-REOPEN invariant that proposal 4 must not weaken.
- `packages/github-cache/src/publish/publish-mirror.ts` -- `PublishResult` (72-76), the restore
  loop and hash mapping (162-189), the all-miss gate (259-271), the return (283).
- `packages/github-cache/src/action/index.ts` -- the OBS-01 `writeCountSummary` call site (156-160).
- `packages/github-cache/src/public-surface.spec.ts` -- the DOCS-05 guard that proves
  `PublishResult` is NOT part of the consumer contract.
</canonical_refs>
