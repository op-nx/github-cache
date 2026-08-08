# Phase 10 Trust Evidence -- TRUST-10 observations, and the TRUST-11/12/13 auditor hand-off

**Status:** Part A is a record of observations. Part B is INPUT to an independent audit and is
NOT that audit's conclusion.
**Written:** 2026-07-29, plan 10-08.
**Requirements:** TRUST-10 (Part A), TRUST-11 / TRUST-12 / TRUST-13 (Part B).

## What this file is, and what it deliberately is not

Part A answers TRUST-10, which asks for three controls **verified rather than assumed**. So every
row below records the COMMAND that was run and the OBSERVED result. A control's row says
`unchanged`, `additively widened`, or `extended` -- those are *observations about a diff*, not
security classifications, and nothing in Part A should be read as one.

Part B answers TRUST-11 and TRUST-12, which ask for two facts **recorded in the phase threat
model**, and it answers TRUST-13 by NOT answering the classification question those two facts
raise. TRUST-13's own words: the proposed classification is *"offered as INPUT to that audit, not
as its conclusion."* Part B is written to be read by `gsd-security-auditor` and contains no
verdict, no severity rating, and no sentence that resolves either question.

---

# PART A -- TRUST-10, verified by observation

## A0. The base commits, resolved and recorded

Two bases are recorded because two different questions were asked, and both resolve.

| Base | `git log -1 --format='%h %s' <base>` | What it is |
|------|--------------------------------------|------------|
| `ff21b5f` | `docs(roadmap): unwrap Requirements lines so gsd-tools stops dropping continuation IDs` | The base 10-08-PLAN.md names: the last commit before this phase's PLANNING began. The wider of the two ranges. |
| `06019d4` | `docs(10): cite context decisions in plans and record planning completion` | The last planning commit before any IMPLEMENTATION commit -- the phase's pre-execution base. |

The plan's instruction on a divergent base was to record BOTH, so both are here. The two ranges
differ only by this phase's eight planning commits (`docs(10):` / `docs(phase-10):`), which touch
`.planning/` only -- so for every source-file claim below the two ranges are interchangeable, and
where it matters the command was run twice and both results are recorded.

## A1. C1 -- the write-trust allowlist. OBSERVED UNCHANGED.

```
git diff --stat ff21b5f..HEAD -- packages/github-cache/src/lib/trust.ts \
                                 packages/github-cache/src/lib/sync-gate.ts
git diff --stat 06019d4..HEAD -- packages/github-cache/src/lib/trust.ts \
                                 packages/github-cache/src/lib/sync-gate.ts
```

**Observed: both commands print NOTHING.** Empty output, no changed-file line, no insertion or
deletion count. `lib/trust.ts` carries C1 (`TRUSTED_EVENTS = ['push', 'schedule']`, the
`HOST_GATED_EVENTS` widening, and the structural `hostSupportsWidenedTrust` host check) and it is
byte-identical to both bases.

Had either command printed a changed-file line, that would be a FINDING and would be recorded here
as one rather than explained. Neither did.

## A2. C2 -- the sync gate. OBSERVED UNCHANGED.

Same two commands as A1; `lib/sync-gate.ts` is the second pathspec in each. **Observed: nothing
printed.** `SYNC_EVENTS`, `isSyncTrusted`'s default-branch check, and the deliberately narrower
`isTrustedSyncEvent` are all byte-identical to both bases.

Recorded because it is easy to assume otherwise from this phase's shape: plan 10-08 widened a
comment INSIDE `action/index.ts` that talks at length about the sync gate, and that is a comment in
a different file. The gate's own two files were never opened by this phase.

## A3. C16 Actions-cache side (`isServerProducedKey`). OBSERVED UNCHANGED AT FUNCTION SCOPE.

A file-scoped diff would have been the wrong instrument here, and it is worth naming why: it would
have printed a non-empty result and the honest reading of that result is "unchanged", which is
exactly the trap a file-scoped claim falls into.

**Step 1 -- the file DOES change.**

```
git diff --stat ff21b5f..HEAD -- packages/github-cache/src/lib/cache-key.ts
```

Observed: `1 file changed, 25 insertions(+)`. Twenty-five added lines, zero deletions.

**Step 2 -- every one of those lines is a comment line.** The added block is the widened
`CACHE_KEY_PREFIX` lock recording that the prefix now governs four consumers (RETAIN-05c) and what
editing the literal would orphan. Scoping method, stated so it can be re-run and so its limits are
visible:

```
git diff --unified=0 ff21b5f..HEAD -- packages/github-cache/src/lib/cache-key.ts \
  | rg '^[+-]' | rg -v '^(\+\+\+|---)' | rg -v '^[+-]\s*(//|\*|/\*|\*/)' | rg -v '^[+-]\s*$'
```

Observed: **no output, exit 1** (`rg`'s genuine no-match). Every added or removed line is either a
`*`-prefixed JSDoc continuation line, a `//` line, a fence line, or blank. `--unified=0` is
load-bearing: without it the surrounding context lines would be printed and filtered on their own
content rather than on being changed. The filter's limit is real and recorded rather than glossed:
it classifies by LEADING TOKEN, so a code line placed inside a block comment would be
misclassified. That is why step 3 exists and why this claim is not left to a shell pipeline.

**Step 3 -- the function's behaviour is pinned independently.** `isServerProducedKey` at
`cache-key.ts:77-82` is the prefix test plus `HASH_PATTERN` over the remainder. Its accept/reject
sets are pinned by `cache-key.spec.ts`'s `isServerProducedKey admit/reject (TRUST-08)` describe --
seven cases, admitting `nx-cache-abc123` and `nx-cache-0`, rejecting `nx-cache-h1` (non-hex),
`nx-cache-ABC` (uppercase), `nx-cache-` (empty remainder), `unrelated-key` (no prefix) and
`some-nx-cache-abc` (prefix not at position 0). That describe pre-dates this phase and is
untouched by it, so the behavioural half of the claim rests on assertions that were already green
before the comment moved.

**Both halves recorded: the file's diff is comment-only, and the function's accept/reject sets are
pinned by a spec this phase did not author.**

## A4. C16 Releases side (`isServerProducedAssetName`). CHANGED, AND THE CHANGE IS ADDITIVE.

It changed in `77f675c` (plan 10-07) and now reads:

```ts
export function isServerProducedAssetName(name: string): boolean {
  return isCurrentAssetName(name) || isLegacyOsSuffixedAssetName(name);
}
```

The additive claim is PROVABLE rather than asserted, in two independent ways.

**(i) Branch B is the pre-rename filter's body preserved VERBATIM.**

```
git show ff21b5f:packages/github-cache/src/lib/release-asset-name.ts \
  | rg -A14 'export function isServerProducedAssetName'
```

Observed: the pre-rename body is the `lastIndexOf('-')` split with the `separator < 0` early
return, `HASH_PATTERN` over the hash half and `CACHE_OS_VALUES.includes` over the OS half. That is
character-for-character the current `isLegacyOsSuffixedAssetName` body at
`release-asset-name.ts:152-166` -- the same five statements in the same order, with only the
function name changed. So for any name `N`, pre-rename `isServerProducedAssetName(N) === true`
implies current `isLegacyOsSuffixedAssetName(N) === true` implies the `||` returns `true`. **Every
previously-accepted name is still accepted.** The widening can only add.

**(ii) The two branches are mutually exclusive, so "which branch accepted this" stays answerable.**
`release-asset-name.spec.ts`'s `the two accept branches are mutually exclusive (RETAIN-05b,
T-10-01)` describe asserts the MECHANISM in three atoms (`HASH_PATTERN` rejects a lone dash;
`CACHE_KEY_PREFIX` contains a dash; that dash is its last character) plus the composed argument and
a dashless-name belt, backed by the 26-case adversarial table. That matters for an audit
specifically because RETAIN-04 widened a DELETE filter (C9's path): the additive argument in (i)
rests on branch B being the old filter unchanged, and if a name could satisfy both branches, that
argument would stop being checkable from the code.

## A5. C9 -- the cleanup delete path. EXTENDED, not unchanged.

Recorded as **extended** deliberately. C9 is *"list phase aborts with zero deletions on any non-404
fault / incomplete pagination; delete phase isolates per item"*, and that discipline is intact --
but RETAIN-04 added a second accept branch to the filter that decides what the delete path may
touch, so the control's SURFACE grew and a claim of "unchanged" would be false.

Offline proof of record, from plan 10-07: `cleanupMirror over a MIXED shard (RETAIN-04, RETAIN-05,
T-10-01) > prunes both name families and deletes neither the PoC-era family nor a foreign asset`.
It lives in the same commit as the rename (`77f675c`), which is the same-commit rule RETAIN-04
carries -- a publisher writing the new name against an unwidened filter would silently stop
pruning, producing unbounded shard growth under a green build.

## A6. The `ref` scoping -- newly pinned by spec and comment-locked.

Located by CONTENT, not by line number: research correction C-7 established that REQUIREMENTS
TRUST-10 (`action/index.ts:40-43`) and CONTEXT D-19 (`:42-51`) are BOTH stale, and that the
parameter, the scoping comment and the `octokit.paginate` call are three separate places. The
locating phrase is `Scope to`.

| Half | Where, by content | Commit |
|------|-------------------|--------|
| The pin | `action/index.spec.ts`, describe `createPublishClient.listCacheEntries ref scoping (TRUST-10)`: two `it.each` cases asserting the WHOLE `paginate.mock.calls[0]` array by deep equality against a named endpoint sentinel plus the full options object, driven with two distinct constructor refs; and a SEPARATE case pinning `toHaveBeenCalledOnce()`. | `4374d5e` |
| The lock | `action/index.ts`, the adapter comment found by the phrase `Scope to`, widened from two lines to a lock naming what it governs, the two supporting facts, the failure mode, and the describe that pins it. | `1c0b69a` |

**Why three cases and not one assertion.** Three distinct regressions are in scope, and each
reddens a DIFFERENT case. Observed, each mutation predicted before it was run and reverted after:

| Mutation | Predicted | Observed |
|----------|-----------|----------|
| `ref` dropped from the paginate options | both ref cases redden, count case green | `2 failed \| 18 passed` -- exactly those two |
| a SECOND, unscoped `octokit.paginate` call added | ONLY the count case reddens, both array cases stay green | `1 failed \| 19 passed` -- the count case alone |
| the `ref` value hardcoded to `refs/heads/main` | ONLY the second ref case reddens, the first stays green | `1 failed \| 19 passed` -- the second case alone |

The middle row is why the count pin is a separate case: a deep equality on `.mock.calls[0]` says
nothing whatsoever about a second call, and a second unscoped enumeration is precisely the
regression the scoping exists to prevent. The third row is what the two-value drive buys -- with
one ref, a hardcoded literal is indistinguishable from a plumbed parameter.

**What the lock states, and why each clause is there.** Full text in the tree; the structure is:

1. **What it governs.** Only default-branch Actions-cache entries are ENUMERATED, and the engine
   mirrors nothing it was not handed, so only those can reach the anonymously-readable Release.
2. **Why nothing else carries it -- two facts, both readable in the tree.** `TRUSTED_EVENTS`
   admits `push` with NO ref check (`lib/trust.ts:32`), so a push to any branch is write-trusted
   and its entries genuinely sit in the Actions cache awaiting enumeration. The sync gate does not
   cover this: `isSyncTrusted` (runPublish's first statement) decides whether THIS RUN may publish
   at all, which is a different question from WHICH ENTRIES a legitimately-running default-branch
   publisher may see. Second fact: until Phase 9 the `@actions/cache` version differed per OS, so a
   leg could restore only a fraction of what it enumerated -- a barrier that was never ref-based
   and narrowed the reachable set only incidentally. VER-01/VER-03 removed it, so the enumeration
   is the only place the set is still narrowed. The C-numbered ledger at `.planning/THREAT-MODEL.md`
   is cited, not restated.
3. **The failure mode.** A non-default-branch trusted write becomes reachable from a world-readable
   Release asset. That is an information-disclosure change, **not a cache MISS** -- nothing turns
   red, no restore fails, and the mirror keeps reporting success while publishing bytes it should
   never have seen. Naming this matters because every other failure in this subsystem announces
   itself as a MISS or a red job, and this one would not.
4. **Where the guard is**, by describe name, so removing the comment does not remove the
   protection.

## A7. CORR-05's `no-restricted-syntax` disable directives -- ZERO survivors.

```
rg -n 'eslint-disable-next-line no-restricted-syntax' packages/github-cache/src
```

Observed: **no output, exit 1.** There are no surviving live directives, so there is no survivor to
attribute to another requirement. CORR-05 reads TRUE by measurement rather than by claim.

Two things recorded so a future reader does not mis-read a broader search. First, `rg -n
'eslint-disable' packages/github-cache/src` DOES return ten lines -- every one of them is prose or
a lint-rule test FIXTURE (`lint-rules.spec.ts` string literals that feed the described-disable
rule, plus three doc-block references in `releases-backend.spec.ts`, `cache-archive-path.spec.ts`
and `release-asset-name.spec.ts` recording that a directive was deleted in the CORR-02 commit).
None is a live directive. Second, `rg` was used rather than `git grep` throughout Part A's absence
claims where an untracked path was in play, and every absence claim above records its exit code
because a zero-hit `rg` with exit 2 is a FAILED command and is indistinguishable from absence by
output alone.

---

# PART B -- the auditor hand-off for TRUST-11, TRUST-12 and TRUST-13

## B0. READ THIS FIRST: everything below is INPUT, not a conclusion

**This part of the file is INPUT to an independent security audit. It is not that audit's output.**

TRUST-13 requires that TRUST-11 and TRUST-12 be *"classified by gsd-security-auditor in
SECURITY.md, not self-certified"*, and that the proposed classification be *"offered as INPUT to
that audit, not as its conclusion."* So Part B states two QUESTIONS (B1), then a proposed answer
labelled as INPUT (B2), then the evidence an auditor needs to reach its own answer (B3-B7).

No sentence in Part B is a verdict. No severity is assigned. Where Part A says a control is
`unchanged` or `extended`, that is an observation about a diff and carries no security meaning on
its own -- assigning that meaning is the audit's job.

## B1. The two questions, stated as questions

**Q1 (TRUST-11).** Does the first-write-wins race between two same-hash producers at the
**cache-save** boundary cross a trust boundary?

**Q2 (TRUST-12).** Does collapsing the Release asset namespace from `<hash>-<os>` to `<hash>`
change the public-repo exposure surface?

## B2. The proposed classification -- OFFERED AS INPUT ONLY

> Neither crosses a trust boundary, because the Actions cache's boundary is **ref scope, not OS**.

**That sentence is offered as INPUT to the audit and is explicitly NOT its conclusion.** It is
reproduced here because REQUIREMENTS TRUST-13 names it, so an auditor should see the proposal it is
being asked to evaluate rather than reconstruct it. An auditor is free to reject it. If it is
rejected, this file is wrong and SECURITY.md is right.

## B3. Q1's arbitration point, CORRECTED -- it is at `saveCache`, not at the Release upload

This correction matters because the uncorrected version points an audit at the wrong code.

**The Release upload is NOT where non-identical payloads meet.** Read in
`packages/github-cache/src/publish/publish-mirror.ts`, located by content:

- The engine takes ONE enumeration snapshot per run -- `const entries = await
  client.listCacheEntries();` before the loop, assigned to a `const` and never re-read. The dedup
  maps over that same array and the `for (const hash of hashes)` loop iterates the frozen list.
- Inside the loop each hash is RESTORED (`const restored: GetResult = await
  actionsCache.get(hash);`) and the restored bytes are uploaded **verbatim** (`const bytes =
  restored.bytes;` then `client.uploadReleaseAsset(shard.id, name, bytes, label)`).
- **The engine never re-executes the task.** There is no build, no command spawn, no regeneration
  anywhere on that path -- the bytes uploaded are the bytes the Actions cache returned.
- For a given hash the Actions cache holds **exactly ONE entry**. So two publish legs restore the
  SAME single entry and upload byte-identical bytes. A duplicate-upload race returns 422
  `already_exists` and is a benign no-op, discriminated on status alone.

The engine's own doc block and its first-write-wins branch both carry this corrected reasoning in
comments as of `77f675c`: byte-identity SURVIVES CORR-02, but its REASON changed from
OS-namespacing (each leg owned its own suffix, so two legs could not collide on a name at all) to
one-entry-per-hash. Both comment sites were rewritten in the rename's own commit, because that is
the branch a reader lands on when they ask why skipping is safe.

**Where the race actually is.** Two producers computing the same hash H and both calling
`saveCache(nx-cache-H)`. The winner owns the entry INCLUDING its OS-specific captured terminal
output. That is not reachable in this phase: `build` / `typecheck` / `test` run on a single ubuntu
leg today, so there is only ever ONE producer per hash. It becomes reachable when XOS-04 puts those
targets on a Windows leg, and those legs run in parallel, so that race IS ordering-dependent.

**The cross-phase consequence, stated explicitly because the next phase inherits it.** This moves
TRUST-11's residual risk into **the XOS-05 write decision (Phase 12)**. XOS-06 is satisfied in
Phase 10 because no requirement DEPENDS on which leg wins -- *not* because the race does not
exist. When Phase 12 decides whether the Windows legs write, this is the question it inherits, and
if they do write, the attribution loss recorded in B4 is appended to that phase's threat record
rather than re-derived.

**Two clauses that remain correct as originally written**, carried forward so an auditor does not
have to re-verify them: the month-shard newest-first read walk makes the winner shard-dependent
when a hash is mirrored into two shards; and cross-OS restore is byte-faithful (tar-in-tar, inner
entry names forward-slash-normalised), so the out-of-scope file-mode question applies to the Nx
client's extraction of the INNER tar, not to this project's transport.

## B4. Q2's exposure delta, recorded

**What Phase 9 removed.** VER-01/VER-03 removed the incidental within-scope OS partitioning,
leaving CORR-04's declared discriminator (`{ "runtime": "node -p process.platform" }`, measured
present in the merged `integration` inputs) as the **sole** separation mechanism.

**The public-repo exposure delta.** A single-OS publish leg can now restore and mirror **every**
OS's entries, so the captured terminal output of every CI job on every OS crosses into the
anonymously-readable Releases mirror.

**This is already live and measurable, not hypothetical.** The per-leg mirroring fingerprint from
run `30400231720`: the ubuntu leg mirrored four all-decimal task hashes and the Windows leg
mirrored those same four under a `-windows` suffix plus the Windows-only `8059758544828235640`.
The same four crossing under both names is the measurement -- one leg mirroring another OS's
entries. The pre-rename shard census in `10-EVIDENCE-PRE-RENAME.md` (shard `cache-mirror-202607`,
122 assets, measured 2026-07-29) is its written record.

**What CORR-02 -- this phase -- adds on top: nothing in exposure terms.** The bytes were already
crossing before this phase started. CORR-02 removes the asset-name OS token, which removes the only
in-name attribution; OBS-03's `label` restores attribution as metadata. **So the delta THIS phase
introduces is an ATTRIBUTION change, not an exposure change -- and the attribution it restores is
of the PUBLISHER.** An auditor evaluating Q2 should therefore separate two deltas with two
different owners: the exposure delta belongs to Phase 9's change, and the attribution delta belongs
to this phase's.

## B5. Required reading, by path and by concrete commit range

| What | Where | Why it is required |
|------|-------|--------------------|
| The reframing that bounds Q2 | `.planning/phases/09-os-invariant-actions-cache-version/09-SECURITY.md` **section 1** ("did any OTHER site depend on the OS partition?") | It establishes that the Actions-cache read/write boundary is GitHub's per-ref scope plus this repo's own write gate, both OS-blind -- two runners in the same scope were ALREADY mutually trusted, so the OS partition was never a security boundary. This is what makes the B4 delta assessable as bounded rather than alarming. Without it, B4 reads as a new exposure rather than a re-description of an existing one. |
| The control ledger | `.planning/THREAT-MODEL.md` rows **C1, C2, C9, C16** | The four controls in scope. Cited by number; Part A records each one's observed status. |
| **Phase 9's commit range** | **`3327a4f..7d467e8`** | Phase 9 CREATED the delta TRUST-12 records, so the change under evaluation is in this range, not in Phase 10's. |

**The range resolves and was verified before being recorded:**

```
git rev-list --count 3327a4f..7d467e8      ->  51
git log -1 --format='%h %s' 3327a4f        ->  3327a4f docs(08): extract phase learnings
git log -1 --format='%h %s' 7d467e8        ->  7d467e8 docs(phase-09): evolve PROJECT.md after phase completion
```

**51 commits**, from Phase 8's last commit (exclusive) through Phase 9's PROJECT.md evolution
(inclusive). Given by range rather than as "look at git log", because the boundary is the thing an
auditor would otherwise have to guess.

Also cited and deliberately NOT spent: `09-EVIDENCE.md`'s pre-Phase-9 producer-attribution
snapshot. Phase 11's TEST-08 depends on that snapshot, so it is referenced here and left intact.

## B6. The controls in scope, with their verdict-relevant status

Drawn from Part A rather than restated independently, so there is one source and it is the one with
the commands in it. Read the Part A section for each row's evidence.

| Control | Observed status | Part A |
|---------|-----------------|--------|
| C1 write-trust allowlist | unchanged (empty diff, both bases) | A1 |
| C2 sync gate | unchanged (empty diff, both bases) | A2 |
| C16 Actions-cache side (`isServerProducedKey`) | unchanged at FUNCTION scope; the file's diff is comment-only | A3 |
| C16 Releases side (`isServerProducedAssetName`) | changed, ADDITIVELY -- branch B is the old body verbatim | A4 |
| C9 cleanup delete path | **extended** by the second accept branch; the list-abort / per-item-isolation discipline intact | A5 |
| the `ref` scoping on `listCacheEntries` | now the sole in-repo control for its property; newly pinned by spec, mutation-checked, comment-locked | A6 |

## B7. The three anti-requirements, so they can be checked

Enumerated as anti-requirements -- things that must be ABSENT from this phase's artifacts. An
auditor can check each:

1. **No producing-OS claim anywhere.** OBS-03's `label` records which leg PUBLISHED an asset. It
   does not answer which producer's bytes a reader received, and no artifact in this phase may say
   or imply that it does. The exact forbidden phrasing is pinned as a `retracted` regex in
   `packages/github-cache/src/docs-same-os-claims.spec.ts`, which is the authority; it is not
   restated here, because restating it is how it comes back.
2. **No self-certified verdict.** See B8.
3. **No ordering-based cross-OS-safety argument.** Cross-OS sharing rests on platform-agnosticism.
   Publish-leg ordering carries only a CI guard's SENSITIVITY -- see B9 -- and that distinction is
   comment-locked in two places on purpose.

## B8. THE PROCESS CONSTRAINT -- for whoever runs the next step

`/gsd:secure-phase` **short-circuits past the auditor and writes SECURITY.md inline** when the
threat register shows no open threat and was authored at plan time. **That is exactly this phase's
shape.** Every plan in Phase 10 authored its `<threat_model>` block at plan time and none leaves an
open high-severity row.

**Do NOT take that short-circuit.** Spawn `gsd-security-auditor` and let it author
`10-SECURITY.md`. TRUST-13 forbids self-certification in as many words, and an orchestrator
deriving the verdict from its own reading of this file would be self-certification with extra
steps -- this file is the INPUT, and an input cannot grade itself.

Concretely, the audit is what must reach a verdict on Q1 and Q2. Nothing in this file, in
`10-08-SUMMARY.md`, or in any Phase 10 PLAN.md does. **TRUST-13 stays open until SECURITY.md
exists**, and its requirement checkbox must not be ticked before then.

## B9. U-01, and the line that was drawn

Recorded because U-01 is the one place two of this phase's own requirements pull against each
other, and an auditor should see the reasoning rather than discover the tension.

**The finding.** `max-parallel: 1` does NOT guarantee leg ordering. GitHub documents `max-parallel`
in one sentence with no order clause; the only documented order statement concerns job CREATION
order following matrix declaration order. Measured practice is 5/5 ubuntu-first with a 150-190 s
margin, and job-level serialisation was confirmed (a 2-second gap between the ubuntu job ending and
the Windows job starting). But the guarantee is absent, and the falsifier is concrete and specific
to this matrix: the two legs use DIFFERENT runner labels, i.e. different hosted pools, so a
scheduler honouring `max-parallel: 1` while starting the first AVAILABLE job could start Windows
first. A same-runner matrix would not have that axis; this one does.

**The line.** Two things could rest on ordering, and only one of them is acceptable:

| Resting on ordering | Verdict on the shape | Why |
|---------------------|----------------------|-----|
| A wrong-RESULT guarantee -- "the mirror is correct because ubuntu goes first" | **FORBIDDEN** | An undocumented scheduling property cannot carry a correctness claim. Cross-OS safety rests on platform-agnosticism, never on ordering. |
| A CI guard's SENSITIVITY -- OBS-05's dead-Windows-publish detection samples more reliably when the legs run in the measured order | **ACCEPTABLE, with the dependency RECORDED** | Losing the ordering costs detection sensitivity. It does not make any reader's restore wrong. |

**It is testable, which is the point.** Removing the serialisation knob costs a guard's
sensitivity, not any reader's correctness -- and OBS-05's additive per-leg own-asset assertion
actually REMOVES the ordering dependency rather than merely annotating it. The distinction is
comment-locked in two places (the `max-parallel` retention comment and the read-back control) so
that neither comment reads as contradicting the other. An auditor finding one of those comments
without the other should read both.

---

## Provenance of every number in this file

Every command in Part A was run at HEAD after plan 10-08's two source commits (`4374d5e`,
`1c0b69a`) and its observed output is transcribed above, not paraphrased. Full suite at that HEAD:
**821 tests across 39 files, all passing.** No `gh api` or `git log` output field that can carry a
committer email address appears anywhere in this file -- the only git metadata reproduced is
`%h %s` (abbreviated hash and subject line).
