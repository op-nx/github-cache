# Quick Task 260809-og2: The rollover misattribution in the publish mirror warning - Research

**Researched:** 2026-08-09
**HEAD:** `ded3ddf` (branch `gsd/v0.0.2-os-invariant-cross-os-sharing`), working tree clean
**Mode:** forensic re-derivation + design evaluation. No web research. Everything below traces to a
command or a direct file read at HEAD.
**Confidence:** HIGH on Q1/Q2/Q5/Q6, HIGH on the two Q3 causes I kept, MEDIUM on the fix shape (it is
a judgement call over confirmed evidence).

## Headline

**Q1 comes out CONSUMER-REACHABLE, and the recommendation moves because of it.** `HANDOFF.json`'s
refuted-claim 4 has three legs. All three are individually TRUE at HEAD and none of them does the
work the argument needs. `dist/publish/publish-mirror.js` **ships in the npm tarball**, and
`docs/advanced.md:139-145` tells an adopter it ships and states its trust requirements "regardless of
how you wire them". The consumer form of the failure is not "our bundle drifted" but "the sidecar and
publish ran at different versions of this action" -- same mechanism, same mass restore-MISS, same
warning, in a stranger's log, naming a rotation they did not make.

That kills the framing that made this a trap quadrant. The choice was never "name our incident
history or say nothing". There is a **consumer-general statement of the same cause**, and naming it
violates nothing.

---

### Q-1: Is action-bundle drift reachable for a CONSUMER of this package?

**Verdict / Answer:** The *artifact* is not, but the *defect class the warning misattributes* is --
and it reaches the consumer through the very same warning. `HANDOFF.json`'s refuted-claim 4 is
**REFUTED on its conclusion**, specifically its clause "surfaces as ordinary Nx misses, never as a
publish warning". Its three legs are individually confirmed; two of them are simply not load-bearing.

**Derived from:**

Leg 1 -- `files` carries `!dist/action`. **CONFIRMED, and irrelevant.** `packages/github-cache/package.json:26-34`.
But it excludes the internal action ENTRY, not the publish engine:
```
cd packages/github-cache && npm pack --dry-run --json
  -> 59 files. Includes dist/publish/publish-mirror.js AND dist/publish/publish-mirror.d.ts,
     dist/cleanup/index.js, dist/serve.js. NO dist/action/* entry.
```
The engine ships to every consumer who runs `npm install @op-nx/github-cache`.

Leg 2 -- `src/index.ts` exports only `createCacheServer`. **CONFIRMED** (plus five backend types).
And `exports` in `package.json:14-22` has no wildcard subpath, so a bare-specifier deep import is
blocked by Node's exports gate. But the file is on disk in `node_modules`, reachable by file URL or
`createRequire` -- unsupported, not prevented.

Leg 3 -- the internal `action.yml` `main` points at an untracked path. **CONFIRMED.**
`packages/github-cache/action.yml:41` declares `main: 'dist/action/index.js'`; `.gitignore:5` ignores
`dist`; and:
```
git ls-files | rg -c '^packages/github-cache/dist'   -> exit 1 (no tracked file)
```
A consumer `uses: op-nx/github-cache/packages/github-cache@<ref>` cannot resolve `main`. **This leg
holds and closes that one path.**

The question the mechanism does not answer -- can a consumer reach `publishMirror` at all:

| Path | Reachable? | Evidence |
|---|---|---|
| `uses: op-nx/github-cache/start-cache-server@v0` (the public surface) | **No** | `rg -c -F 'publishMirror' start-cache-server/index.js` -> exit 1; positive control `rg -c -F 'createCacheServer'` -> 3, exit 0. `rg -c -F 'candidate causes'` -> exit 1. The warning is not in the consumer sidecar bundle. |
| `uses:` the internal action against a git ref | **No** | Leg 3 above. |
| npm bin `github-cache` -> `dist/serve.js` | **No** | `git grep -n "publish" -- src/serve.ts` -> exit 1. |
| npm install + deep import of `dist/publish/publish-mirror.js` | **Yes, unsupported** | Ships in the tarball (above); blocked only for bare specifiers. |
| **Adopter wires publish themselves** | **Yes, documented** | `docs/advanced.md:139-145`: "Publish and cleanup ship in the package (`publish/publish-mirror.ts`, `cleanup/`)... Their trust requirements above are load-bearing **regardless of how you wire them**." That sentence presupposes the adopter wires it. `docs/advanced.md:60-63` calls publish/sync "opt-in". |
| Forking / vendoring the repo | Yes, but that reader is a dogfooder, not a consumer | Out of scope for the distribution constraint's purpose. |

And the drift-equivalent mechanism, verified end to end:
```
rg -n -F 'cache-archive-path' packages/github-cache/src/backend/actions-cache-backend.ts -> exit 0
rg -c -F 'cacheArchivePath'      start-cache-server/index.js -> 3   (exit 0)
rg -c -F 'enableCrossOsArchive'  start-cache-server/index.js -> 18  (exit 0)
```
Both inputs to the `@actions/cache` cache version are **inlined in the consumer sidecar bundle**. The
sidecar therefore fixes the cache version at which the consumer's entries are WRITTEN, and it is
pinned by a git ref/tag. Publish computes the version independently from whatever artifact it runs
from. Pin the action at a stale tag while wiring publish from a newer npm install (or the reverse)
and the two disagree -- every enumerated entry misses.

**Finding:** The consumer analogue of bundle drift is a **version skew between the pinned sidecar
action and the artifact publish runs from**. `HANDOFF.json` itself concedes this class is reachable
("two jobs pinning different refs, a stale major tag") and then asserts it "surfaces as ordinary Nx
misses, never as a publish warning". That last clause is false for any adopter who wired publish --
which the docs invite. Their run produces exactly the miss shape the partial branch fires on, and the
message tells them to look for a cache-version rotation in a commit range where none happened.

**Consequence for the fix:** The trap quadrant dissolves. Shape A's stated danger was "naming our own
incident record in a stranger's log". But the cause has a **consumer-general form** -- "the sidecar
and this publish step ran at different versions of this action" -- that names no artifact of ours, no
run id, no `.planning` path, and is directly actionable by a stranger. Naming that does NOT repeat
`260809-2s6`. What WOULD repeat it is naming "action-bundle drift", `start-cache-server/index.js`, or
`09-ROTATION-SIGNAL.md` -- so those stay out.

---

### Q-2: Which of the two warning branches can misattribute, and under what conditions?

**Verdict / Answer:** **Both.** Not symmetrically, and not for the same reason. C-H holds exactly as
stated and constrains nothing once Q1 is answered.

**Derived from:** direct read of `publish-mirror.ts:804-816` (total gate) and `:817-903` (partial
branch); `.github/workflows/ci.yml` publish job as recorded in `260809-iqe-RESEARCH.md` C-H.

**Finding:**

**Total gate** (`hashes.length > 0 && readMisses === hashes.length && mirrored === 0`, `:804`).
C-H is CONFIRMED and I am not disturbing it: in *this repository's* CI the `mirror-seed` step writes
this run's own seed through the `dist/`-built internal action in the same job, so under our bundle
drift `mirrored >= 1` and the gate cannot fire. **Our drift is not a missing cause for this branch.**
CONTEXT.md's locked instruction "do not fix the total gate by adding a cause it cannot have" is
correct as far as it goes.

But the gate's enumeration is still **incomplete for the case it CAN fire on**. Its firing condition
is a run with no same-run writes -- `docs/advanced.md:100-102` already names that shape: "a
publish-only or scheduled run that wrote nothing of its own". For a consumer on that shape, a
sidecar/publish version skew drives every entry to miss with `mirrored === 0`, and the gate fires
naming a rotation they did not make. So the total gate misattributes too, via the consumer instance
of the same class rather than via our bundle.

**Partial branch** (`:817-820`). Fires under drift/skew, exactly as C-F and C-G recorded, and its
enumeration omits more than the total gate's (see Q3).

**Consequence for the fix:** The shared defect is the **closed-enumeration FORM**, as CONTEXT
reasoned -- and it is now also true that both branches are missing the *same* substantive cause,
stated at different scopes. So the fix is symmetric in form and near-symmetric in content. The
rollover cause (Q3) belongs to the partial branch alone: the total gate requires `mirrored === 0`, so
the shard never resolves, so the pre-restore membership skip never runs and rollover cannot affect
it.

---

### Q-3: The causes the messages actually omit

**Verdict / Answer:** Three real omissions, of which two are worth naming in the message. One
candidate I expected to find is CLOSED and must not be claimed.

**Derived from:** `publish-mirror.ts:480-522` (enumeration + dedup), `:635-649` (skip / miss
branches), `:253-262` (seed filter), `:617-634` (the D3 reorder's own recorded consequences),
`:869-876` (the open cohort), `action/index.ts:46-91` (the real `listCacheEntries` adapter), and
`54677af`'s full diff.

**Finding:**

**(1) Artifact version skew -- the Q1 cause.** Not named. The engine restores by hash and the
Actions cache stores `(key, version)` pairs; `listCacheEntries` maps every row to `{ key }` and drops
`version` entirely (`publish-mirror.ts:490`, `action/index.ts:90`). So a key present *only* at a
foreign cache version is enumerated and always misses. Cause (1) in the message narrows this to "a
rotation in this commit range" -- a change WE made -- which excludes a skew between two artifacts, and
also excludes a rotation originating in a dependency (the cache version hashes the compression method,
so an `@actions/cache` upgrade in the consumer's own tree rotates it with no change of ours at all).

**(2) The self-perpetuating cohort -- and `54677af` DELETED it.** This is the finding I did not
expect. The pre-`54677af` message's cause (2) was: *"a self-perpetuating cohort -- an entry that
MISSES can never be mirrored, so it is never in the shard, so it is enumerated and retried on every
future run and can never succeed."* `54677af` replaced it with "the runtime token's Actions-cache read
scope" while removing the leaked baseline sentence. That was collateral, not intent: the commit
message describes removing the baseline instruction and aligning to the sibling gate's causes, and
never mentions dropping a cause. The cohort is still live and is the **largest measured contributor to
the baseline** -- the engine's own comment at `:869-874` says the bare-run-id seed cohort "is still
inside the 43" of 112. And the generic statement is consumer-general: any entry that cannot restore is
never mirrored, so it is re-enumerated and re-attempted forever until it evicts.

**(3) Month-shard rollover as a pure calendar artifact.** Not named, and it is this task's literal
subject. An entry already in the shard takes the pre-restore skip (`:635`) and counts into
`alreadyPresent`, never `readMisses`, while staying in the denominator. Entries that were mirrored
before a rotation and would now miss are therefore *invisible* mid-month and *all re-attempted* on the
first run against a new empty shard. So `readMisses` can jump at the calendar boundary with nothing
about cache health having changed. The source states the direction itself at `:623-626`. Caveat per
C-G: the skip is guarded on a shard that resolves only after the first restore HIT, so suppression is
enumeration-order dependent and order is pinned nowhere -- the number is noisy across runs at the same
repo state.

**Closed, and MUST NOT be claimed:**

- **Ordinary Actions-cache eviction is not a cause.** An evicted entry leaves `listCacheEntries` too,
  so it leaves numerator and denominator together. (The engine comment at `:617-621` flags eviction as
  a mirroring-coverage concern, which is a different thing from a miss-rate cause.)
- **Branch/ref scoping is not a cause.** I expected an enumerate-wider-than-you-can-read gap and it is
  not there: `action/index.ts:81-84` passes `ref` to `getActionsCacheList`, scoping the enumeration to
  the default branch, and publish only runs on the default branch. Verified by reading the adapter, not
  assumed.

**Consequence for the fix:** The omissions are **broad, not a single missing item** -- three causes,
spanning three unrelated mechanisms, one of which the messages used to name and lost. That is a direct
argument for Shape C and against a targeted "add drift as cause (3)": a closed list of three would be
wrong again the next time someone reads the code carefully.

---

### Q-4: The three candidate fix shapes

**Verdict / Answer:** C is right and A is wrong, but **not for the reason CONTEXT expected** -- A
fails on Q3's breadth, not on the distribution constraint. B is not optional: a minimal docs edit is
*forced* by C.

**Shape A -- name drift as a third cause.**
Fixes the instance; does not fix the form. What `260809-2s6` removed (`54677af`, read in full) was a
*sentence instructing the reader to compare against this repo's own pre/post-fix baselines* -- an
unactionable reference to our history. Naming a cause in consumer-general terms is a different act and
does not repeat it. **So A does not violate the distribution constraint, provided the wording avoids
"action-bundle drift", `start-cache-server/index.js`, and the `.planning` pointer.** A fails on Q3
instead: it leaves "Three candidate causes" asserting a completeness that is still false, in a message
that has already lost one true cause once (Q3 item 2) without anyone noticing. Rejected.

**Shape B -- point at a consumer-readable doc.**
The *message* points nowhere today; only the source comment at `:796-799` points at
`.planning/phases/09-.../09-ROTATION-SIGNAL.md`, and a comment in our own file is not in a stranger's
log. So B is not needed to fix the misattribution. But **`docs/advanced.md` already asserts the
message's cardinality** and goes stale the moment C lands:
- `:98` -- "...which denominator that proportion is over, and **two candidate causes**."
- `:105` -- "...and **the same two causes** worth checking."

Neither phrase is pinned by any guard row, so nothing would redden -- which is precisely why the edit
must be made deliberately in the same commit. Guard constraints on that file, read at HEAD from
`docs-same-os-claims.spec.ts`:
- `260809-hcr`'s OBS-04 row requires three phrases verbatim, each on ONE line: `depends on whether the
  publish run also wrote entries of`, `a warning once that cohort dominates the enumeration`, `that is
  the shape the all-MISS warning is reserved`. None of them is the cardinality sentence, so the edit
  is compatible.
- Forbidden on that file: `/restores everything as a M[I]SS and mirrors/`,
  `/warning it emits names the axis/`, `/one all-M[I]SS publish/`, `/Restore is same-[O]S --/`.
- `docs/advanced.md` is in `EDITED_FILES`, so no single sentence may contain both `/whose byte[s]/i`
  and `/produc(e[rd]|es|ing|tion)/i`.
- House rule the file states about itself: a reworded site updates its ROW in the SAME commit.

So B collapses to: **a two-word consistency edit in `docs/advanced.md`, not a new look-alike section.**

**Shape C -- stop asserting a closed enumeration.**
Fixes the misattribution at both sites without naming any dogfood-specific mechanism, and survives Q1
either way. Its honest cost -- "check the usual suspects" is worse for a stranger than two specific
checkable causes -- is real but is **avoidable**: dropping the cardinality claim does not require
dropping the specifics. Keep every named cause, add the skew one, and change only the sentence that
claims the list is exhaustive.

**Recommended shape (a named combination, and it dominates all three):**
**C + one generalized cause + the forced docs consistency edit.** C alone under-serves the reader; A
alone re-asserts a false closure; B alone fixes nothing. The combination is one clause of new text per
message plus two words in a doc.

---

### Q-5: What the guard must assert, and what would make it vacuous

**Verdict / Answer:** Two assertions per branch -- one absence, one presence -- driven through the
ENGINE, never through a file read. Both fail against the current message.

**Derived from:** `publish-mirror.spec.ts:1413-1532` (`runWithMisses`, the partial-fires case, the W3
negative case, the total-branch discriminator) and `54677af`'s spec diff.

**Finding:**

The absence needle, split per the house convention (`/differen[t] OS/` at `:1320`, and the three W3
patterns at `:1456-1462`):
```ts
const recorded = vi.mocked(core.warning).mock.calls.flat();
expect(recorded).not.toContainEqual(expect.stringMatching(/Two candidate cause[s]/));
```
The presence needle:
```ts
expect(warned).toContain('different versions of this action');
```

**Both fail against the CURRENT message.** `Two candidate causes:` is emitted verbatim by both
branches today (`publish-mirror.ts:810-811` and `:898-899`), and `different versions of this action`
appears nowhere. Non-vacuous by construction, not by argument.

**Five ways this goes vacuous, all of which this project has already been bitten by:**

1. **A negated matcher inside `toHaveBeenCalledWith`.** `expect(core.warning).not.toHaveBeenCalledWith(
   expect.stringMatching(...))` asserts "SOME call lacks the phrase", not "no call carries it" --
   negating the predicate instead of the quantifier. `54677af`'s commit body records rejecting exactly
   this. Use `mock.calls.flat()` + `not.toContainEqual`, and pin `toHaveBeenCalledOnce()` alongside.
2. **Absence alone is satisfied by deleting the message.** This is the `forbidden: []` lesson recorded
   in six rows of `docs-same-os-claims.spec.ts`. The presence needle is what makes the pair
   load-bearing -- do not ship one without the other.
3. **Only guarding the branch the report named.** The phrase occurs in BOTH messages and only one
   fires per run, so the absence assertion must run against BOTH fixtures: `runWithMisses(10, 9)` for
   the partial branch and the all-miss fixture at `:1506` for the total gate.
4. **Reaching for a source-file read instead.** It would silently pass: the literal is split across a
   template concatenation in both branches (`'... machinery. Two ' + 'candidate causes: ...'`), so
   `readFileSync` + `toContain('Two candidate causes')` matches NOTHING today and would be green
   against the unchanged file. Assert on the runtime message.
5. **Spelling the forbidden phrase whole in the spec.** Plants it in the file that proves it absent
   and destroys the repo-wide search's ability to tell the guard apart from a regression. Split it.

**What stays green untouched:** the existing `:1422-1431` pins (`9 of 10 server-produced cache entries
(90%)`, `not of the restores attempted`, `cache-version rotation in this commit range`, `runtime
token's Actions-cache read scope`) and the total-branch discriminator at `:1527-1531` (`nothing
mirrored`, `not.toContain('not of the restores attempted')`). The wording below preserves every one of
those literals deliberately -- if the implementation reworks a cause's phrasing, it must update those
assertions in the same commit.

**The total gate needs a positive content pin it currently lacks.** Its only content assertions are
`toContain('nothing mirrored')` and the negative discriminator. Add the two shared cause phrases there
too, or that branch's cause list is unguarded.

---

### Q-6: Freeze re-check

**Verdict / Answer:** No freeze covers `publish-mirror.ts`. Source changes have been landing on this
branch throughout, including to this exact file and to a guard spec. CONTEXT.md's auto-locked decision
stands.

**Derived from:**
```
git log --oneline -12
  ded3ddf  docs(quick-260809-iqe): amend the ROBUST-04 capture ...
  aceb526  docs(quick-260809-iqe): ...
  06ccf16  docs(quick-260809-iqe): ...
  23d9207  wip: paused ...
  9251809  docs(quick-260809-hcr): record the correction ...
  909a88a  docs(quick-260809-hcr): say which warning a version bump actually produces
  ff25c5a  docs(quick-260809-2s6): ...
  54677af  fix(260809-2s6): stop the partial-miss warning leaking this repo's own history

git log --oneline -- packages/github-cache/src/publish/publish-mirror.ts
  -> 54677af, e40cfcf, aee017c, 9b1b136, e78a842, 3cdf87c, ...  (six on 2026-08-09 alone)

git show 909a88a --stat
  -> docs/advanced.md +35/-12  AND  packages/github-cache/src/docs-same-os-claims.spec.ts +50/-1
```

**Finding:** The freeze is scoped to `.planning/REQUIREMENTS.md` as a milestone artifact the
maintainer is mid-review on -- stated in `robust-04-all-restore-miss-clause-is-false.md` ("`REQUIREMENTS.md`
is a milestone artifact, so amending it now would push an unreviewed requirement change into a diff
the maintainer is mid-review on") and in `260809-hcr-SUMMARY.md:161-164`. `260809-hcr` landed a
**source** change (`docs-same-os-claims.spec.ts`) under that same freeze without objection.

`publish-mirror.ts` is unchanged since `54677af`, so CONTEXT.md's cited line numbers are still exact:
total gate `:804-816`, partial message `:895-902`, rotation-signal comment `:866`. I re-located all
three anyway.

**Consequence for the fix:** A source change is in scope. `.planning/REQUIREMENTS.md` stays untouched.

---

## Recommendation

**Shape C, plus one generalized cause named in consumer-general terms, applied to BOTH branches, plus
the forced two-word consistency edit in `docs/advanced.md`.**

What decides it: Q3 established that the omissions are **plural and heterogeneous** -- an artifact
version skew, a self-perpetuating cohort the message used to name and silently lost in `54677af`, and
a calendar artifact at shard rollover. A message that swaps "Two candidate causes" for "Three" is the
same defect with a bigger number, and this file has already demonstrated that a closed list can shed a
true cause without anyone noticing. Dropping the completeness claim is the only fix that is still
correct after the next careful reading.

And Q1 is what lets it also be *specific*: the cause that actually occurred has a consumer-general
form ("the sidecar and this publish step ran at different versions of this action") that names no
artifact, run id, baseline or `.planning` path of ours. So C does not have to pay its usual vagueness
cost. Keep every existing cause, add that one, and change only the sentence claiming the list is
closed.

**The one piece of evidence that would change my mind:** a demonstration that `publishMirror` is
genuinely unreachable for any adopter -- i.e. that `docs/advanced.md:139-145` does not sanction wiring
publish, AND that `dist/publish/publish-mirror.js` does not ship. The second is measured false
(`npm pack --dry-run`). If both were somehow closed, cause (2) below becomes our incident record in a
stranger's log and must be cut, leaving bare Shape C -- and I would then take the vagueness cost
rather than reopen Shape A.

Not recommended: a new look-alike section in `docs/advanced.md`. The message points at no doc today,
so there is nothing to redirect, and a new load-bearing doc claim would owe a new `DOCS_08_SITES` row.

## Wording the implementation may use

Partial branch, replacing `publish-mirror.ts:895-902`:

```
`github-cache publish: ${readMisses} of ${hashes.length} server-produced ` +
  `cache entries (${percent}%) restored as a MISS. That is a proportion of ` +
  'the entries ENUMERATED on this leg, not of the restores attempted. Causes ' +
  'worth checking, and this list is not exhaustive: (1) a cache-version ' +
  'rotation in this commit range -- the archive path literal or the cross-OS ' +
  'flag changed; (2) the sidecar that wrote these entries and this publish ' +
  'step running at different versions of this action, which computes two ' +
  "cache versions in one repository; (3) the runtime token's Actions-cache " +
  'read scope; (4) the first publish run against a new month shard, where ' +
  'entries previously skipped as already mirrored are re-attempted and a ' +
  'one-time rise is expected.',
```

Total gate, replacing `publish-mirror.ts:805-816`:

```
`github-cache publish: all ${hashes.length} server-produced cache ` +
  `entr${hashes.length === 1 ? 'y' : 'ies'} restored as a MISS; nothing ` +
  'mirrored. The axis here is the @actions/cache cache VERSION -- a SEPARATE ' +
  'mechanism from the Nx TASK hash and from the Release ASSET NAME, each of ' +
  'which produces a look-alike all-MISS through unrelated machinery. Causes ' +
  'worth checking, and this list is not exhaustive: (1) a cache-version ' +
  'rotation in this commit range -- the archive path literal or the cross-OS ' +
  'flag changed; (2) the sidecar that wrote these entries and this publish ' +
  'step running at different versions of this action, which computes two ' +
  "cache versions in one repository; (3) the runtime token's Actions-cache " +
  'read scope. This is expected ONCE per version-affecting change. Two ' +
  'consecutive all-miss pushes with NO version-affecting change in between ' +
  'is the signal to act.',
```

`docs/advanced.md`, the two cardinality assertions:
- `:98` -- `and two candidate causes.` -> `and the causes worth checking.`
- `:105` -- `the same two causes worth checking` -> `the same causes worth checking`

Both edits leave every phrase the `260809-hcr` guard row requires intact and match none of its
forbidden patterns. Per the file's own rule, update the row's docstring in the same commit to record
why the cardinality left the prose.

At the planner's discretion (source comments, not consumer-facing, so they may name our artifacts):
the rotation-signal instruction at `:866` ("Treat this branch as the live rotation signal") is the
comment that directs a reader to the absent cause and should say that the branch also fires on a
version skew between the sidecar artifact and this one.

## What the guard must assert

Per branch, in `publish-mirror.spec.ts`, driven through `publishMirror` and never through a file read:

```ts
// Partial branch -- reuse runWithMisses(10, 9).
expect(core.warning).toHaveBeenCalledOnce();
const recorded = vi.mocked(core.warning).mock.calls.flat();
expect(recorded).not.toContainEqual(expect.stringMatching(/Two candidate cause[s]/));
expect(vi.mocked(core.warning).mock.calls[0][0]).toContain(
  'different versions of this action',
);
```
and the same pair against the total-gate fixture at `:1506`.

Confirmation it fails against the CURRENT message: `Two candidate causes:` is emitted verbatim by both
branches today (`publish-mirror.ts:810-811`, `:898-899`), so the absence assertion is RED before the
edit; `different versions of this action` appears nowhere in the file, so the presence assertion is RED
before the edit. Both flip green only on the corrected messages.

Do not substitute a `readFileSync` + `toContain('Two candidate causes')` check: the literal is split
across a concatenation boundary in both branches and that assertion is green against the unchanged
file.

Also add the two shared cause phrases as `toContain` pins on the total-gate case, which currently has
no positive pin on its cause list at all.

## Claims the implementation MUST NOT make

1. **"Bundle drift is unreachable for consumers", or any restatement of `HANDOFF.json`'s refuted-claim
   4.** REFUTED. `dist/publish/publish-mirror.js` ships in the npm tarball, and `docs/advanced.md:139-145`
   sanctions an adopter wiring publish. Its clause "never as a publish warning" is false for such an
   adopter.
2. **"`!dist/action` keeps the publish engine out of the package."** False -- measured by
   `npm pack --dry-run`. It excludes the internal action ENTRY only.
3. **The strings `action-bundle drift`, `start-cache-server/index.js`, `dist/action/index.js`, or any
   `.planning/` path -- in either warning MESSAGE.** They are our artifacts and our incident record;
   `PROJECT.md:146` forbids leaking them into the consumer contract, and `260809-2s6` already paid to
   remove one such sentence. Source COMMENTS may name them freely.
4. **Any claim that the total gate can fire under THIS repository's bundle drift.** C-H holds: the
   same-run `mirror-seed` step keeps `mirrored >= 1`. The total gate gets cause (2) for the consumer
   skew case only.
5. **"The enumeration is now complete", "three candidate causes", or any restored cardinality.** That
   is the defect, not the fix.
6. **Ordinary Actions-cache eviction, or branch/ref scoping, as causes of the miss rate.** Both
   checked and closed: an evicted entry leaves the enumeration too, and `action/index.ts:81-84` scopes
   `getActionsCacheList` to the default-branch ref that publish itself runs on.
7. **Any Wilson bound, percentage or miss count not carrying run id `31305961054`.** Two prior
   estimates of these figures were wrong in opposite directions, by the denominator each time
   (`publish-mirror.ts:838-841`). The measured pair is 43/112 ubuntu and 43/113 windows, bound 0.299.
8. **"Silent mid-month" as a guarantee.** C-G's caveat stands: the suppressing skip is guarded on a
   shard that resolves only after the first restore HIT, so the outcome is enumeration-order dependent
   and order is pinned nowhere.
9. **That `260809-2s6` deliberately dropped the self-perpetuating-cohort cause.** It did not say so;
   the drop reads as collateral of the leak removal. State it as what the diff shows, not as intent.
