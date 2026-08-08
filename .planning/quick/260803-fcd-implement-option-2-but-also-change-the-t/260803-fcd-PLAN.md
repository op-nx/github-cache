---
phase: 260803-fcd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/github-cache/src/lib/octokit-fault-reason.ts
  - packages/github-cache/src/publish/publish-mirror.ts
  - packages/github-cache/src/publish/publish-mirror.spec.ts
  - packages/github-cache/src/lib/retention.ts
  - packages/github-cache/src/lib/retention.spec.ts
  - packages/github-cache/src/cleanup/cleanup.ts
  - packages/github-cache/src/cleanup/cleanup.spec.ts
  - packages/github-cache/src/backend/releases-backend.spec.ts
  - packages/github-cache/src/roundtrip/read-back.ts
  - packages/github-cache/src/roundtrip/read-back.spec.ts
  - docs/advanced.md
  - start-cache-server/index.js
autonomous: true
requirements: [D1, D2, D3, D4, D6]

must_haves:
  truths:
    - "A burned month-shard tag makes the publish leg SKIP loudly and exit 0: skipped == scanned, mirrored == 0, failed == 0, setFailed not called (D5 Window A expectation)."
    - "Exactly ONE createRelease attempt and exactly ONE core.warning per burned-shard run, independent of how many hashes the leg enumerates."
    - "A 422 carrying only the pre_receive ruleset entry still FAILS the publish job (the decoy stays fatal)."
    - "A 422 whose tag_name entry is reworded past 'immutable release' still FAILS the job, and the fatal log names the tag_name entry rather than the pre_receive decoy."
    - "shardTag() produces nx-cache-YYYYMM and isShardTag accepts exactly that shape (D2)."
    - "The non-shard rejection fixtures still fail on the 6-digit SUFFIX, not on a prefix mismatch -- proven by a loose-prefix mutation that reddens both blocks."
    - "The generated action bundle carries the new prefix in the SAME commit as the source rename (D4)."
    - "Phase A and Phase B are two separate commits, A first (D1)."
  artifacts:
    - packages/github-cache/src/lib/octokit-fault-reason.ts
    - packages/github-cache/src/publish/publish-mirror.ts
    - packages/github-cache/src/publish/publish-mirror.spec.ts
    - packages/github-cache/src/lib/retention.ts
    - packages/github-cache/src/lib/retention.spec.ts
    - packages/github-cache/src/cleanup/cleanup.spec.ts
    - start-cache-server/index.js
  key_links:
    - "faultMessageForField(error, 'tag_name') -> the 'immutable release' substring test at the single publish call site. A test against faultReason().message reads the pre_receive DECOY and can NEVER fire (RESEARCH Q1.4)."
    - "The one-shot sentinel in publishMirror's lazy shard resolve -> ensureShardRelease returning undefined. Without the sentinel the resolve re-runs per hash: ~32 createRelease calls and ~32 warnings in one leg (RESEARCH Q1.8b)."
    - "SHARD_TAG_PREFIX -> SHARD_TAG_PATTERN -> isShardTag -> the cleanup scope filter; and -> the bundled `var SHARD_TAG_PREFIX` in start-cache-server/index.js (D4)."
    - "Rebased trap fixtures -> the \\d{6} suffix check. A prefix-mismatch rejection is SILENT vacuity: green suite, zero coverage (RESEARCH Q2 traps 1 and 2)."
---

<!-- planner-discipline-allow: cache-mirror -->

<objective>
Two behavioural changes in a STRICT order, each on its own commit so each can be verified on its
own `main` window.

**Phase A (Task 1)** -- `ensureShardRelease` treats ONE specific `createRelease` 422 (GitHub
reporting the tag name was used by an immutable release) as a non-fatal skip with a loud warning.
Every other 422 stays fatal.

**Phase B (Tasks 2 and 3)** -- `SHARD_TAG_PREFIX` goes from the old prefix to `nx-cache-`, so month
shards become `nx-cache-YYYYMM`. One source literal, its dependents, both silent-vacuity traps, the
stale prose, and the regenerated action bundle -- all in ONE commit.

Purpose: the burn is PERISHABLE (D1). `cache-mirror-202608` is burned RIGHT NOW and `shardTag()`
still returns it, so Phase A has a live subject. Once Phase B lands, `nx-cache-202608` is fresh and
the skip path can never be exercised live again.

Output: two commits. Phase A first, Phase B second.

NOT IN THIS PLAN (orchestrator-owned): the two `main` windows (D5), the `cache-mirror-202607`
deletion (Phase C, D6), STATE.md, ROADMAP.md.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.planning/quick/260803-fcd-implement-option-2-but-also-change-the-t/260803-fcd-CONTEXT.md
@.planning/quick/260803-fcd-implement-option-2-but-also-change-the-t/260803-fcd-RESEARCH.md
@packages/github-cache/src/lib/octokit-fault-reason.ts
@packages/github-cache/src/lib/retention.ts
@packages/github-cache/src/publish/publish-mirror.ts
</context>

<environment>
MEASURED this session, do not re-derive:

- File-scoped run form WORKS: `npx nx test github-cache -- src/lib/retention.spec.ts` -> 1 file, 34
  tests, pass. (RESEARCH assumption A3 is now MEASURED.)
- **Add `--skip-nx-cache` to every MUTATION-proof run.** Nx caches `test` results; a restored file
  re-hashes to a cached PASS, and a cached verdict must never stand in for a fresh mutation run.
- `git commit -m` FAILS on this Dev Drive (ReFS: COMMIT_EDITMSG "Invalid argument"). Write each
  commit message with the **Write tool** to the scratchpad, then `git commit -F <path>`.
- Scratchpad (use your session scratchpad if it differs):
  `/c/Users/LARSGY~1/AppData/Local/Temp/claude/D--projects-github-op-nx-github-cache/1ad8209a-14e5-4852-9e64-ab190cd11699/scratchpad`
- Executor runs on the MAIN TREE. No worktree. `npm run check:action` false-drifts in a worktree.
- Stage files BY NAME. Never `git add .` / `-A` / `-u`. No AI attribution in commit messages.
- ASCII only. Never the Grep tool, never `grep`; use `git grep` / `rg`.

**Byte-exact restore protocol** used by both mutation proofs:

1. `git hash-object <file>` -> record the SHA.
2. `cp <file> $SCRATCH/<name>.pre-mutation`
3. Apply the mutation, run the named spec with `--skip-nx-cache`, capture the failure lines.
4. `cp $SCRATCH/<name>.pre-mutation <file>`
5. `git hash-object <file>` -> MUST equal step 1's SHA. If it does not, restore from the copy again
   and re-check before continuing.
</environment>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Phase A -- burned-name skip, field-scoped and one-shot (commit 1 of 2)</name>
  <files>packages/github-cache/src/lib/octokit-fault-reason.ts, packages/github-cache/src/publish/publish-mirror.ts, packages/github-cache/src/publish/publish-mirror.spec.ts</files>

  <behavior>
    Three NEW clauses in `publish-mirror.spec.ts`, inside the existing
    `publishMirror fault discrimination (ROBUST-01, TEST-03)` describe block. The measured payload
    (CONTEXT "The exact payload") drops into `octokitFault(422, { errors: [...] })` verbatim -- all
    three entries, in order, `code: 'custom'` on each.

    - **A1 (natural RED) -- the skip.** `getReleaseByTag` rejects 404; `createRelease` throws the
      measured three-entry 422. `listCacheEntries` returns THREE distinct server-produced keys, and
      that multiplicity is load-bearing: with a single hash the called-ONCE assertions below are
      vacuous and the sentinel is unpinned. Assert: `result.skipped === result.scanned` (3),
      `result.mirrored === 0`, `result.failed === 0`, `createRelease` called EXACTLY once,
      `core.warning` called EXACTLY once with a string containing the tag AND `immutable release`,
      `uploadReleaseAsset` not called, `core.setFailed` NOT called.
    - **A2 (regression guard, NOT naturally red -- mutation-proven below) -- the decoy stays fatal.**
      `createRelease` throws a 422 whose `errors` holds ONLY the `pre_receive` entry. Assert
      `rejects.toThrow()`, `createRelease` called once, `core.error` called once,
      `uploadReleaseAsset` not called.
    - **A3 (natural RED on its content half) -- fail-closed on a rewording, and the log names the
      right entry.** `createRelease` throws a 422 carrying the `pre_receive` entry AND a `tag_name`
      entry whose message is REWORDED past the substring (use
      `{resource:'Release', code:'custom', field:'tag_name', message:'tag_name is reserved'}`).
      Assert `rejects.toThrow()`. Then read the single `core.error` call's argument out of
      `vi.mocked(core.error).mock.calls[0]` and assert it CONTAINS `tag_name is reserved` and does
      NOT contain `Repository rule violations`. Assert on the captured argument, never via a negated
      `toHaveBeenCalledWith` -- that form asserts only "some call lacks X" and is vacuous here.

    Two existing clauses MUST stay green untouched: `re-reads the shard by tag when the
    createRelease 422 body EXPLICITLY says already_exists` and `REJECTS a createRelease 422 whose
    body is UNREADABLE`.
  </behavior>

  <action>
Write the three clauses FIRST and run them RED. Record the actual failure lines -- they go in the
commit body.

Then implement, in this order:

1. **`lib/octokit-fault-reason.ts` -- add a field-scoped accessor.** Export
`faultMessageForField(error: unknown, field: string): string | undefined`: read
`error.response.data.errors` through the existing `FaultBody` cast, treat a non-array as empty, and
return the first entry whose `field` is `=== field` AND whose `message` is a string. Reuse the
file's existing `stringOrUndefined`. Undefined on anything else -- absent body, wrong shape,
non-string message (V5: the 422 body is untrusted remote input). Document WHY it exists rather than
a `message` substring test: `faultReason().message` returns the FIRST entry carrying a message,
which on the measured payload is the `pre_receive` decoy, so the obvious guard could never fire
(RESEARCH Q1.4). Do NOT add a publisher-specific `isBurnedTagName()` helper here -- one call site,
and a caller-specific predicate does not belong in a generic reader (RESEARCH Q1.5).

2. **`publish-mirror.ts` -- widen `ensureShardRelease` and take the skip.** Signature becomes
`Promise<number | undefined>`; `undefined` means "shard skipped, nothing mirrorable". In the
`createRelease` catch, AFTER the existing `already_exists` branch and BEFORE the fatal
`core.error` + `throw`, add the burned-name branch:

- predicate: `statusOf(error) === 422` AND `faultMessageForField(error, 'tag_name')` is defined AND
  includes `immutable release` (case-sensitive, exactly as measured; RESEARCH Q1.5 rejected both the
  longer sentence and the bare word `immutable`).
- on match: `core.warning` naming the tag, the numeric status, and GitHub's OWN `tag_name`-entry
  message -- never a token, never a raw workflow-command string (the rule already stated at the
  fatal log). Then `return undefined`.
- comment the fail-CLOSED property: a rewording, a dropped/renamed `field`, or an unreadable body all
  miss the predicate and fall through to the existing throw; the `pre_receive` decoy is excluded BOTH
  structurally (its field is not `tag_name`) and textually (its message carries no `immutable
  release`) -- keep both reasons, do not lean on one.

3. **`publish-mirror.ts` -- fix the fatal log to name the authoritative entry** (RESEARCH Open
Question 1, taken deliberately, not folded in silently). In the existing `core.error`, print
`faultMessageForField(error, 'tag_name') ?? reason.message` instead of `reason.message` alone. On the
decoy-only payload this is unchanged behaviour; on a payload carrying both entries it stops printing
the decoy for exactly the failure the log exists to diagnose. A3 is its test.

4. **`publish-mirror.ts` -- the one-shot sentinel at the lazy resolve.** Declare
`let burnedShardTag = false;` beside the existing `shard` sentinel. In the
`if (shard === undefined)` block: if `burnedShardTag`, `skipped++` and `continue` with NO API call;
otherwise call `ensureShardRelease`, and if it returns `undefined`, set `burnedShardTag = true`,
`skipped++`, `continue`. Comment WHY: the lazy resolve re-runs per hash while `shard` is unset, so a
naive skip issues one `createRelease` and one warning PER HASH -- 32 on the measured ubuntu leg --
which is precisely the noise this file's own comment argues against. A burned tag cannot become
creatable mid-run, so once is enough. Counts stay honest: `skipped` rises, `mirrored` stays 0,
`failed` stays 0, so `setFailed` does not fire and the leg is GREEN -- D5's stated Window A outcome,
with `publish-verify` RED as the downstream backstop.

5. **Do NOT delete the historical evidence line while rewriting the doc block.** The
`ensureShardRelease` doc block records run 30773689490's measurement, naming the two real tags that
were probed. That is a MEASUREMENT RECORD (RESEARCH Q2 Kind 2) and Task 3's residual sweep expects
it to survive. Extend the block for the new branch; do not rewrite that sentence's tag names.

Then run GREEN and record the counts.

**Mutation proof for A2 and A3** (A2 is not naturally RED -- current code already throws on every
non-`already_exists` 422, so without this it is an unproven guard). Follow the byte-exact restore
protocol on `publish-mirror.ts`. Mutation: replace the whole burned-name predicate with the
status-only reading `statusOf(error) === 422` -- the historical defect class this project keeps
hitting. Run `npx nx test github-cache -- src/publish/publish-mirror.spec.ts --skip-nx-cache` and
confirm BOTH A2 and A3 FAIL (the decoy and the rewording would each take the skip path). Restore,
verify the hash-object SHA matches, re-run green.

Finally: full suite + typecheck + lint, then commit. Write the message with the Write tool to
`$SCRATCH/260803-fcd-commit-a.txt` and `git commit -F` it. Subject:
`fix(publish): skip a burned month-shard tag instead of failing the run`. Body carries: the measured
payload's role as the fixture, the Q1.4 defect (why the field-scoped accessor and not a
`faultReason().message` test), the sentinel's reason, `RED:` with the actual A1/A3 failure lines,
`GREEN:` with the actual pass counts, and `MUTATION:` with the status-only run's A2/A3 failure lines.
Stage by name: the three files only.
  </action>

  <verify>
    <automated>npx nx test github-cache -- src/publish/publish-mirror.spec.ts && npx nx run-many -t typecheck lint --projects=github-cache && npx nx test github-cache</automated>
    <automated>git log -1 --format=%s | rg -q "^fix\(publish\): skip a burned month-shard tag"</automated>
  </verify>

  <done>
Three new clauses exist and pass; `already_exists` and UNREADABLE-body clauses still pass; full
suite + typecheck + lint green. The status-only mutation reddens A2 AND A3, and the restored file's
`git hash-object` matches its pre-mutation SHA. `ensureShardRelease` returns `number | undefined`,
the warning fires exactly once for a 3-hash run, and the fatal log prints the `tag_name` entry when
one is present. ONE commit landed, Phase A only -- no `SHARD_TAG_PREFIX` change in it.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Phase B code half -- the prefix, its dependents, and BOTH vacuity traps (no commit)</name>
  <files>packages/github-cache/src/lib/retention.ts, packages/github-cache/src/lib/retention.spec.ts, packages/github-cache/src/cleanup/cleanup.spec.ts, packages/github-cache/src/backend/releases-backend.spec.ts</files>

  <behavior>
    The rename's self-announcing half is the RED assertions; its dangerous half is two blocks that
    stay GREEN while their coverage evaporates. Both must end up testing what their comments claim.

    - `retention.spec.ts` shardTag / isShardTag / SHARD_TAG_PREFIX / SHARD_TAG_PATTERN /
      shardTagsForWindow pins go RED on the exact produced tags and are rebased onto `nx-cache-`.
    - `releases-backend.spec.ts` pinned request URLs (`releases/tags/...`, three sites) go RED and
      are rebased.
    - `cleanup.spec.ts` shard fixtures go RED (scoped counts and the fault-abort clause) and are
      rebased.
    - **TRAP 1, `retention.spec.ts` non-shard REJECT list.** Rebase every fixture onto the new
      prefix (`nx-cache-`, `nx-cache-2026`, `nx-cache-20260`, `nx-cache-2026070`, `nx-cache-latest`,
      `nx-cache-backup`, `nx-cache-2026-07`). Leave `v1.0.0` alone -- it is the foreign-tag case and
      is correctly a prefix-mismatch rejection. Rename ONLY the source and these stay green while
      rejecting on a PREFIX mismatch instead of the `\d{6}` suffix check they exist to test.
    - **TRAP 2, `cleanup.spec.ts` non-shard skip clause.** Rebase both release fixtures
      (`nx-cache-latest`, `nx-cache-backup`) so the clause keeps exercising exactness rather than
      the prefix. Its own comment names what it guards, so a vacuous version leaves a claim the
      test no longer backs.
    - **Proof that the rebase kept its teeth:** a loose-prefix mutation of `SHARD_TAG_PATTERN`
      reddens BOTH blocks. Nothing else in the suite, the typechecker, lint, or `check:action`
      would report their vacuity.
  </behavior>

  <action>
**Do NOT commit in this task.** D4 requires the regenerated bundle in the SAME commit as the source
rename, and the traps must land in the same commit too -- Task 3 makes the single Phase B commit for
Tasks 2 and 3 together.

1. **`retention.ts:52`** -- `export const SHARD_TAG_PREFIX = 'nx-cache-';`. This is the ONE
load-bearing line change (per D2, and the namespace reuse with the Actions-cache key prefix is
deliberate: `isServerProducedKey` is applied only to Actions-cache keys and `isShardTag` only to
release tags -- two disjoint keyspaces, never cross-tested. Do not re-raise the collision
objection). Leave the surrounding prose for Task 3.

2. Run the suite and let it go RED. Record the actual failing assertion lines -- they go in the
Task 3 commit body as the rename's RED evidence.

3. **Rebase every RED literal** onto `nx-cache-` across `retention.spec.ts` (the `shardTag`
month/zero-pad pins, the ACCEPT list, the `SHARD_TAG_PREFIX` / `SHARD_TAG_PATTERN` direct pins, and
the four `shardTagsForWindow` exact-array cases), `releases-backend.spec.ts` (the three pinned
`releases/tags/...` URLs), and `cleanup.spec.ts` (the shard fixtures). Keep them as string LITERALS,
not derived from the constant under test -- a spec that derives its expectation from its own subject
is vacuous, and these pins are the tripwire working as intended. Do NOT convert them to
`shardTag(...)` calls: that is a refactor bundled into a rename that already has two silent traps to
get right (RESEARCH Open Question 2).

4. **Fix both traps** exactly as `<behavior>` specifies.

5. **`cleanup.spec.ts` MEASURED-census comment (near the shard census block) is a HISTORICAL
MEASUREMENT** -- it names a real shard and a real release id that were read live. Leave the tag name
verbatim; Task 3 marks it. Do not rebase it.

6. Suite green, typecheck + lint green.

7. **Mutation proof for both traps.** Byte-exact restore protocol on `retention.ts`. Mutation: drop
the suffix check from the pattern --
`export const SHARD_TAG_PATTERN = new RegExp('^' + SHARD_TAG_PREFIX);` -- which turns `isShardTag`
into the loose prefix test the exact accepter replaced. Run
`npx nx test github-cache -- src/lib/retention.spec.ts src/cleanup/cleanup.spec.ts --skip-nx-cache`
and confirm the trap-1 reject cases FAIL (each rebased fixture is now wrongly accepted; `v1.0.0`
correctly stays green) AND the trap-2 clause FAILS (`listAllAssets` gets called for the non-shard
releases). Capture those failure lines. Restore, verify the `git hash-object` SHA matches, re-run
green. One mutation proves both traps.
  </action>

  <verify>
    <automated>npx nx test github-cache && npx nx run-many -t typecheck lint --projects=github-cache</automated>
    <automated>git log -1 --format=%s | rg -q "^fix\(publish\): skip a burned month-shard tag"</automated>
  </verify>

  <done>
`SHARD_TAG_PREFIX` is `nx-cache-`; every rebased pin passes as a literal; both trap blocks test the
6-digit suffix on the new prefix; the loose-prefix mutation reddens both, and the restored
`retention.ts` hash-object SHA matches its pre-mutation value. Full suite + typecheck + lint green.
Working tree is DIRTY and NOT committed -- `git log -1` still shows the Phase A subject.
  </done>
</task>

<task type="auto">
  <name>Task 3: Phase B prose, bundle regeneration, and the single Phase B commit (commit 2 of 2)</name>
  <files>packages/github-cache/src/lib/retention.ts, packages/github-cache/src/cleanup/cleanup.ts, packages/github-cache/src/cleanup/cleanup.spec.ts, packages/github-cache/src/lib/retention.spec.ts, packages/github-cache/src/backend/releases-backend.spec.ts, packages/github-cache/src/roundtrip/read-back.ts, packages/github-cache/src/roundtrip/read-back.spec.ts, packages/github-cache/src/publish/publish-mirror.ts, docs/advanced.md, start-cache-server/index.js</files>

  <action>
Sweep the prose in two DISTINCT classes. Getting the classes backwards is the defect here: a
blanket rename falsifies a measurement record, and a missed current-scheme claim leaves a false
statement no guard can see.

**Class 1 -- CURRENT-SCHEME claims. These are now FALSE and MUST be rewritten to the new prefix.**

- `retention.ts` -- the comment-locked header's month-shard-scheme sentence (the single most
  important prose fix in the task), the `shardTag` doc naming the prefix and its example, the
  restated regex in the `SHARD_TAG_PATTERN` doc, the two non-shard exclusion examples, and the
  `isShardTag` doc's shard/non-shard examples.
- `cleanup.ts` -- the two LIST-phase sentences describing which releases the engine enumerates.
  After the rename both are false and invisible to every guard.
- `cleanup.spec.ts` -- the scope-filter comment and the two TEST NAMES that state the old scope
  (test names are prose that shows up in CI output).
- `retention.spec.ts` -- the two "single home for the ... tag scheme" comments.
- `releases-backend.spec.ts` -- the three pinned-window narrative comments naming both shard tags.
- `docs/advanced.md` -- both consumer-facing statements of the scheme. Change ONLY the tag literal
  on those lines; leave the surrounding same-OS wording byte-identical, because
  `docs-same-os-claims.spec.ts` asserts required phrases against this file.

**Class 2 -- HISTORICAL MEASUREMENT records. Keep the tag names VERBATIM; add a short marker.**
Renaming a recorded measurement would claim the measurement was taken against a tag that never
existed -- a worse defect than leaving it.

- `publish-mirror.ts` -- run 30773689490's evidence (the absent shard, with the July shard as the
  passing positive control).
- `read-back.ts` -- the measured month-boundary 404, and the two `MAX_ASSET_PAGES` / pagination
  justifications citing the live 122-asset shard.
- `read-back.spec.ts` -- the MEASURED empty-label census of that same shard.
- `cleanup.spec.ts` -- the MEASURED shard census with its release id.

Marker rule, and it is mechanical: append a short parenthetical such as `(the PRE-RENAME tag
scheme)` on the SAME line as the existing occurrence, and do NOT repeat the old literal in the
marker text. Adding a new line that carries the old literal would change the residual counts the
gate below pins.

Also add ONE line near `isShardTag` recording why the same-commit-widening precedent stated in
`cleanup.ts`'s asset-name reasoning does NOT apply to this tag rename: old shards become unreadable
AND unprunable, and the answer here is D6's hand-delete of the single populated legacy shard, with
no adopters -- not a widened accepter. A future reader will otherwise find that rule and a rename
that did not follow it.

**Bundle regeneration (D4, same commit).** `npm run build:action`, then `npm run check:action` from
the MAIN TREE. The bundle preserves the derivation (`shardTag` and `SHARD_TAG_PATTERN` both read the
constant), so the single source literal plus a rebuild fully updates it -- no second source fix.

**Residual sweep gate.** Run `git grep -c -F "cache-mirror" -- . ':!.planning'` and
`rg -c -F "cache-mirror" start-cache-server/index.js`. The ONLY surviving sites must be the Class 2
records, exactly:

| File | Expected line count |
|---|---|
| `packages/github-cache/src/publish/publish-mirror.ts` | 1 |
| `packages/github-cache/src/roundtrip/read-back.ts` | 3 |
| `packages/github-cache/src/roundtrip/read-back.spec.ts` | 1 |
| `packages/github-cache/src/cleanup/cleanup.spec.ts` | 1 |
| `start-cache-server/index.js` | 0 (rg exits 1) |

Any other file appearing means a Class 1 claim was missed. A HIGHER count in a Class 2 file means a
marker introduced a new line carrying the literal. Note `CACHE_MIRROR_MAX_AGE_DAYS` and
`CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION` are OUT OF SCOPE (D3, published consumer knobs); `git
grep` is case-sensitive so they do not appear in this lowercase sweep -- do not "helpfully" include
them, and do not touch `docs/advanced.md`'s `cache_mirror` anchor link for that knob.

**Commit.** Full suite + typecheck + lint + `check:action` green first. Write the message with the
Write tool to `$SCRATCH/260803-fcd-commit-b.txt`, then `git commit -F`. Subject:
`refactor(retention): rename the month-shard tag prefix to nx-cache-`. Body carries: D2's
forward-looking rationale (a future read-write Releases backend makes "mirror" a permanent misnomer;
`nx-cache-` is the durable name) and the retracted collision objection in one line; `RED:` with
Task 2's actual failing assertion lines; `VACUITY:` naming both traps, why a prefix-mismatch
rejection is silent coverage loss, and the actual loose-prefix mutation failure lines; the two prose
classes and why Class 2 stays verbatim; the D6 note on why the same-commit-widening precedent does
not apply; and the residual sweep result. Stage BY NAME every file from Tasks 2 and 3 plus
`start-cache-server/index.js` -- one commit, Phase B whole.
  </action>

  <verify>
    <automated>npx nx test github-cache && npx nx run-many -t typecheck lint --projects=github-cache && npm run check:action</automated>
    <automated>git grep -c -F "cache-mirror" -- . ':!.planning'</automated>
    <automated>git status --porcelain | rg -q . && echo DIRTY-FAIL || echo CLEAN</automated>
  </verify>

  <done>
Every Class 1 claim reads the new prefix; every Class 2 record keeps its measured tag names plus an
inline marker. The residual sweep matches the table exactly and the bundle carries no occurrence of
the old prefix. `npm run check:action` passes from the main tree. Full suite + typecheck + lint
green. Exactly TWO commits exist for this task, Phase A then Phase B, and the working tree is clean.
  </done>
</task>

</tasks>

<source_audit>
## Multi-Source Coverage Audit

No ROADMAP phase and no REQUIREMENTS rows -- this is a quick task, so GOAL comes from CONTEXT's Task
Boundary and REQ is not applicable.

| Source | Item | Covered by |
|---|---|---|
| GOAL | Phase A: burned-name 422 is a non-fatal loud skip; every other 422 fatal | Task 1 |
| GOAL | Phase B: `SHARD_TAG_PREFIX` -> `nx-cache-` | Tasks 2, 3 |
| GOAL | Phase C: delete the legacy shard | OUT -- orchestrator-owned (D6) |
| CONTEXT D1 | A verified before B, separate commits | Task 1 commits before Task 3; Task 2 verify pins Phase A as `git log -1` |
| CONTEXT D2 | Namespace reuse deliberate; objection not re-raised | Task 2 action states it; Task 3 commit body records the rationale |
| CONTEXT D3 | `CACHE_MIRROR_*` knobs NOT renamed | Task 3 residual-sweep note excludes them explicitly |
| CONTEXT D4 | Bundle regenerated in the SAME commit, `check:action` from main tree | Task 3 |
| CONTEXT D5 | Two `main` windows, Window A green-publish/red-verify | OUT -- orchestrator-owned. Task 1 makes the counts produce that outcome |
| CONTEXT D6 | Phase C waits for Window B green | OUT -- orchestrator-owned. Task 3 records why no accepter widening |
| CONTEXT specifics | Measured 3-entry payload used as the fixture verbatim | Task 1 behavior |
| CONTEXT specifics | Skip is LOUD, counts honest, decoy stays fatal | Task 1 A1 / A2 |
| RESEARCH Q1.4 | `faultReason().message` returns the decoy -> field-scoped accessor required | Task 1 step 1 |
| RESEARCH Q1.5 | Predicate = 422 + `field === 'tag_name'` + `immutable release` | Task 1 step 2 |
| RESEARCH Q1.6 | Fail-closed on rewording / dropped field / unreadable body | Task 1 A3 + existing UNREADABLE clause |
| RESEARCH Q1.7 | Decoy excluded structurally AND textually, both preserved | Task 1 step 2 comment; A2 |
| RESEARCH Q1.8a | Return type widens | Task 1 step 2 |
| RESEARCH Q1.8b | One-shot sentinel, 3-hash fixture pins it | Task 1 step 4 + A1 |
| RESEARCH Q1.8c/d | Counts honest, warning is the only separator from a healthy leg | Task 1 A1 asserts all four counters + setFailed |
| RESEARCH Open Q1 | Fatal log should name the `tag_name` entry | Task 1 step 3, tested by A3 |
| RESEARCH Q2 traps 1+2 | Fixture rebase, proven by loose-prefix mutation | Task 2 |
| RESEARCH Q2 | One-home rule HELD in source; zero second inlines | Task 2 -- single literal change, no source hunt needed |
| RESEARCH Q2 | `publish-mirror.spec.ts` needs NO Phase B edit (derives via `shardTag(NOW)`) | Absent from Tasks 2/3 file lists by design |
| RESEARCH Q2 | Bundle = regeneration only | Task 3 |
| RESEARCH Q2 | 14 prose sites split Class 1 rewrite / Class 2 verbatim | Task 3 |
| RESEARCH Q3 | Tag not in the consumer contract -> no breaking-change note owed | No such task, deliberately |
| RESEARCH Q3 | Record why the same-commit-widening precedent does not apply | Task 3 |
| RESEARCH Open Q2 | Do NOT convert non-home specs to derived tags | Task 2 step 3 forbids it |
| RESEARCH side finding | `immutable-releases` settings endpoints | OUT -- explicitly no action |
| RESEARCH deferred | Immutable-releases-vs-sharding design incompatibility | OUT -- deferred by maintainer |

No unplanned items. No phase split needed.
</source_audit>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| GitHub REST -> publisher | The 422 response BODY is untrusted remote input; the new predicate reads it |
| Publisher -> job outcome | The skip decides whether a leg exits 0, so the predicate gates the fail signal |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-fcd-01 | Tampering / Repudiation | `ensureShardRelease` burned-name branch | high | mitigate | Predicate requires 422 AND `field === 'tag_name'` AND `immutable release`. A token-scope regression is 403, not 422, so it cannot take the skip path. Mutation-proven: the status-only reading reddens A2 and A3. `publish-verify` RED is the downstream backstop (D5) |
| T-fcd-02 | Information Disclosure | the skip `core.warning` | low | mitigate | Log only the tag, the numeric status, and GitHub's own `tag_name`-entry message -- never a token, never a raw workflow-command string |
| T-fcd-03 | Repudiation | `PublishResult` counts | high | mitigate | Warning is mandatory and fires exactly once (A1 asserts called-once on a 3-hash run); `skipped` rises, `mirrored`/`failed` stay 0, so a skipped shard never reads as a successful mirror |
| T-fcd-04 | Tampering | 422 body reader (V5 input validation) | medium | mitigate | `faultMessageForField` uses optional chaining plus `typeof === 'string'`; an unreadable or malformed body returns undefined and stays FATAL (existing UNREADABLE-body clause) |
| T-fcd-05 | Tampering | rebased trap fixtures | high | mitigate | Loose-prefix mutation of `SHARD_TAG_PATTERN` must redden both trap blocks; nothing else in the toolchain detects their vacuity |
| T-fcd-06 | Tampering | stale prose surviving the rename | medium | mitigate | Residual sweep pins the exact per-file survivor counts; any extra file means a missed Class 1 claim |
| T-fcd-SC | Tampering | npm/pip/cargo installs | low | accept | No package-manager install in this plan -- no `package.json` or lockfile change in either phase (RESEARCH: Package Legitimacy Audit not applicable) |
</threat_model>

<verification>
- `npx nx test github-cache` -- full suite green after Task 1 and after Task 3.
- `npx nx run-many -t typecheck lint --projects=github-cache` -- green.
- `npm run check:action` -- green from the MAIN TREE (Task 3).
- Two mutation proofs, each with a matching `git hash-object` SHA before and after restore.
- Residual sweep matches the Task 3 table exactly.
- `git log --oneline -2` shows exactly the Phase B commit then the Phase A commit, in that order.
</verification>

<success_criteria>
- A burned month-shard tag produces a GREEN publish leg with one warning, one `createRelease`
  attempt, `skipped == scanned`, `mirrored == 0`, `failed == 0`.
- A `pre_receive`-only 422 and a reworded `tag_name` 422 both still fail the job; the fatal log names
  the `tag_name` entry when one is present.
- `shardTag()` returns `nx-cache-YYYYMM`; both trap blocks still test the 6-digit suffix, proven by
  mutation.
- The bundle carries the new prefix and `check:action` passes, in the same commit as the rename.
- Exactly two commits, Phase A first, working tree clean.
</success_criteria>

<output>
Create `.planning/quick/260803-fcd-implement-option-2-but-also-change-the-t/260803-fcd-SUMMARY.md`
when done: the two commit SHAs, the recorded RED/GREEN/mutation outputs, the residual sweep result,
and a note that Window A expects `publish` GREEN with the skip warning and `publish-verify` RED (D5).
</output>
