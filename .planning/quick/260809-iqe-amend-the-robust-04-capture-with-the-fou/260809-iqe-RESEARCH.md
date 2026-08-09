# Quick Task 260809-iqe: Forensic re-derivation of the ROBUST-04 amendment's figures

**Researched:** 2026-08-09
**Mode:** forensic re-derivation from git history and source only. No web research.
**Confidence:** HIGH (every claim below traces to a command whose output is quoted or to a byte comparison)

## User Constraints (from CONTEXT.md)

Unchanged and binding on the planner; not re-litigated here.

- **DO NOT touch `.planning/REQUIREMENTS.md`.** ROBUST-04's checkbox stays ticked.
- **DO NOT write that the drift gap is "closed"** or "now surfaced by the proportional branch".
- **DO NOT merge anything.**
- **XOS-05 is not a precedent** for an inline correction.
- Single file, docs-only. No source, test, or CI changes.

## Method note

Three findings below exist only because a filtered view was distrusted:

1. A `rg -f <(...)` process substitution **silently failed on Windows** (`os error 3`) and printed
   nine consecutive false "no bundled-source file in this commit" results -- the exact shape of the
   error this task exists to catch. Re-run with a real pattern file plus a positive control, eight
   of the nine reversed.
2. The canonical reference path in CONTEXT.md, `packages/github-cache/src/lib/publish-mirror.ts`,
   **does not exist**. The file is `packages/github-cache/src/publish/publish-mirror.ts`.
3. The bundle's true input set was computed from an **esbuild metafile**, not guessed. It is 18
   first-party files plus `package-lock.json`. `publish-mirror.ts` is *not* among them.

The single strongest piece of evidence in this document is not a count. It is that a fresh
`esbuild` build of `start-cache-server/entry.ts` at HEAD is **byte-identical** to the committed
`start-cache-server/index.js` (2 474 234 bytes, `cmp` exit 0). That is a direct measurement of "no
drift is shipped", and it does not depend on any commit-counting argument at all.

---

### C-A: "Nine commits touched `start-cache-server/index.js` since 2026-07-26."

**Verdict:** CONFIRMED

**Derived from:**
```
git log -1 --format='%H %ad %s' --date=iso 969de3e
  -> 969de3eb 2026-07-26 23:27:54 +0200  docs: amend v0.0.2 requirements after research and the live cross-OS probe
git log --format='%h %ad %s' --date=short 969de3e..HEAD -- start-cache-server/index.js   -> 9 commits
git log --format='%h %ad %s' --date=short --since=2026-07-26 -- start-cache-server/index.js -> 9 commits
git log --follow -- start-cache-server/index.js  -> 27 commits total over the file's whole life
```

**Finding:** Nine, and the inclusive/exclusive question is **moot** -- both window definitions
return the identical nine commits. The reason is worth stating because it removes the ambiguity
rather than papering over it: `969de3e` is itself a **docs-only** commit that did not touch the
bundle, so starting the window *at* it and starting it *after* it cannot differ. The window is
`969de3e..HEAD`, i.e. every commit strictly after the clause was written.

The nine, newest first:

| SHA | Date | Subject |
|-----|------|---------|
| `501bcb1` | 2026-08-04 | feat(select-backend): say so in the log when CACHE_READ_ONLY narrows (TRUST-14) |
| `6833706` | 2026-08-03 | fix(backend): remove the restored archive on the miss and fault paths too (WR-01) |
| `a1d6139` | 2026-08-03 | refactor(retention): rename the month-shard tag prefix to nx-cache- |
| `cbf60e6` | 2026-08-02 | feat(13-03): narrow to a read-only Actions backend via a last-branch CACHE_READ_ONLY knob (TRUST-14) |
| `1172887` | 2026-08-02 | feat(13-02): compose the writable Actions backend from a read-only base (VER-08) |
| `1c6faef` | 2026-08-01 | fix(12): re-create the archive directory on put(), not only at construction |
| `77f675c` | 2026-07-29 | feat(10-07): collapse the Releases namespace to one asset name per hash |
| `47597a6` | 2026-07-28 | feat(09-03): make the Actions cache version OS-invariant |
| `db577db` | 2026-07-27 | feat(07-01): adopt the ESLint 9 flat-config toolchain |

**Wording the amendment may use:** "Nine commits rebuilt the committed bundle in that window
(`969de3e..HEAD`)."

---

### C-B: "Each paired with the source change that required it."

**Verdict:** CORRECTED

**Derived from:** the bundle's real input set, computed with an esbuild metafile rather than
assumed:
```
node <scratchpad>/meta.mjs <scratchpad>/bundle-probe.js
  -> LOCAL INPUT COUNT=18   (entry.ts + serve.ts + server/server.ts + 3 backends + 11 lib modules)
cmp <scratchpad>/bundle-probe.js start-cache-server/index.js
  -> IDENTICAL (exit 0), 2474234 bytes each
```
then, per commit, with a real pattern file and a positive control (`rg` exit codes recorded):
```
git show --name-only --format='' <sha> | rg -F -f srcset.txt
  -> exit 0 for eight commits; exit 1 for db577db only
git log 969de3e..HEAD -- package-lock.json   -> db577db  (the only lockfile change in the window)
```

**Finding:** **Eight of nine** paired with a first-party source change. The ninth, `db577db`, did
**not** -- and the claim as worded is false for it.

`db577db` is a **dependency-driven** rebuild. Its lockfile regeneration re-resolved
`undici 6.27.0 -> 6.28.0` through `@actions/*`'s ranged transitive dependencies, changing the bytes
esbuild inlines (`git show db577db -- package-lock.json | rg undici` confirms both version lines;
the `index.js` hunk is undici's cookie parser gaining `isValidHeaderValue` calls, +88 / -6).

So the accurate statement is broader and, usefully, **stronger**: every one of the nine was
accompanied by a change to a bundle **input** -- eight to a source file, one to `package-lock.json`.
The lockfile is a genuine third input alongside `entry.ts` and the 18-file source graph, and it
changed exactly once in the window, paired.

**Wording the amendment may use:** "Eight of the nine paired with the source change that required
them; the ninth (`db577db`) was driven by a lockfile re-resolution -- `undici` 6.27.0 to 6.28.0 --
and staged the rebuilt bundle in that same commit."

---

### C-C: "The unpaired commits to bundled sources are spec files or comment-only (`f6c91fd`), and esbuild strips comments."

**Verdict:** CORRECTED (the conclusion survives; the "spec files" half does not, and the
supporting evidence is much better than the claim gives it credit for)

**Derived from:**
```
git log 969de3e..HEAD -- <the 18 bundled sources>      -> 15 commits
  for each: does it also touch start-cache-server/index.js?   -> 8 PAIRED, 7 UNPAIRED
git show --format='' <sha> -- <the 18 bundled sources>  (full diffs read, all seven)
git log 969de3e..HEAD -- start-cache-server/entry.ts    -> (empty) entry.ts untouched in the window
rg -c -F 'isWriteTrusted' start-cache-server/index.js   -> 2   (positive control, exit 0)
rg -c -F 'POSITION IS THE GUARANTEE' start-cache-server/index.js  -> exit 1
rg -c -F 'self-refuting'             start-cache-server/index.js  -> exit 1
rg -c -F 'month-shard release tag'   start-cache-server/index.js  -> exit 1
rg -c -F 'THREAT-MODEL.md control C1' start-cache-server/index.js -> exit 1
rg -c -F 'fail-closed'               start-cache-server/index.js  -> exit 1
git rev-list --count 501bcb1..HEAD   -> 47
```

**Finding -- three corrections and one upgrade.**

**(1) None of the seven is a spec file.** Every one of them edited a real, bundled `.ts` module.
The "spec files" half of the claim has no referent at all:

| SHA | Date | Bundled source touched | What the diff actually is |
|-----|------|------------------------|---------------------------|
| `4b51649` | 08-04 10:35 | `lib/retention.ts` | JSDoc block moved; text byte-identical |
| `0bfc29b` | 08-04 10:33 | `backend/memory-backend.ts` | comment reworded (DOCS-10) |
| `f6c91fd` | 08-03 22:53 | `backend/actions-cache-backend.ts` | comment retraction only |
| `bb6ea2b` | 08-03 22:51 | `lib/select-backend.ts` | comment corrections only |
| `fd29858` | 08-03 22:40 | `backend/actions-cache-backend.ts` | comment correction only |
| `9f76a80` | 08-01 22:19 | `lib/cache-archive-path.ts` | comment correction only |
| `83ac4fd` | 07-26 23:48 | `backend/actions-cache-backend.ts` | one comment line: `ARCHITECTURE-DECISION.md` -> `THREAT-MODEL.md` |

**(2) `f6c91fd` is exactly what the claim says.** Its whole diff against bundled sources is two
comment hunks (+25 / -5) retracting the "no second cache-version computation exists" claim. Zero
executable lines. Verified by reading the diff, not by trusting the subject line.

**(3) esbuild-strips-comments is confirmed against *this repo's* build, not general knowledge.**
`esbuild.action.mjs` sets no `minify` and no `legalComments`, so the question is settled
empirically instead: five distinctive comment strings drawn from the very files above return exit 1
against the committed bundle, while a code identifier from the same graph returns 2 hits at exit 0.
The control rules out a broken search.

**(4) The upgrade -- this is provable byte-exactly, and the amendment should use that instead.**
The last commit to rebuild the bundle is `501bcb1` (2026-08-04). **47 commits** have landed since,
two of them (`4b51649`, `0bfc29b`) editing bundled sources. And a fresh build at HEAD is byte-identical
to the committed bundle. So those two comment-only edits are *measured* to have produced a zero-byte
delta -- not inferred from how esbuild is documented to behave.

Combined with C-B, the window's accounting is closed on all three inputs: `entry.ts` untouched;
`package-lock.json` changed once and paired; the 18-file source graph changed across 15 commits, 8
paired and 7 comment-only. **No behavioural source change shipped un-bundled.**

**Residual, stated rather than hidden:** the byte-identity proof directly covers only the two
unpaired commits after `501bcb1`. For the earlier five, the argument is the comment-only
classification plus the strip behaviour that the two later ones demonstrate. Any transient staleness
they could have caused would in any case have been absorbed by the next paired rebuild.

**Wording the amendment may use:** "The seven commits that touched a bundled source without
rebuilding the bundle are comment-only -- none is a spec file -- and esbuild emits no comments, so
none of them changed a byte of the bundle. Forty-seven commits after the last rebuild, a fresh
`npm run build:action` at HEAD still reproduces the committed `start-cache-server/index.js`
byte for byte."

---

### C-D: "No `action-bundle-drift` catch is recorded anywhere in `.planning`."

**Verdict:** REFUTED

**Derived from:**
```
git grep -c -F 'action-bundle-drift' -- .planning   -> exit 0, 105 files, 175 matching lines
rg  -c -F 'action-bundle-drift' .planning           -> exit 0, same corpus + 1 untracked file
rg -i -U '(red|failed|failure)[^\n]{0,120}action-bundle-drift' .planning  -> exit 0
rg -i -U 'action-bundle-drift[^\n]{0,120}(red|fail...)' .planning         -> exit 0
rg -c -F 'Phase 7 saw an 88-line drift' .planning   -> exit 0  (positive control)
git grep -n -F '88-line' -- .planning               -> exit 0, 8 files
git grep -n -F '88 lines' -- .planning              -> exit 0, 9 files
```
No zero-hit result is load-bearing in this claim; every search returned exit 0 with hits.

**Finding:** A drift catch **is** recorded, in detail, and it is **inside the window**.

`.planning/phases/07-.../07-EVIDENCE.md` carries a section headed *"Q10 / SC9 -- the action bundle
DID drift"*, recording verbatim: *"RESEARCH carried this as a contingency, not a prediction. **The
contingency fired.**"* Cause: `undici 6.27.0 -> 6.28.0`. Delta: `+88 / -6` lines. Action: rebuilt
and staged in the same commit. That commit is `db577db`, 2026-07-27 -- one day into the window. The
same catch is recorded in `07-01-SUMMARY.md`, `07-LEARNINGS.md`, and `STATE.md:327`, and is then
cited as precedent at least ten more times across Phases 9, 10 and 12.

Two things this does *not* do. It does not mean drift shipped -- the catch worked, and the rebuilt
bundle went out in the same commit. And it does not mean the *CI job* went red: no record of a red
`action-bundle-drift` job exists. But the narrow reading that would rescue the claim is worthless,
because the gate **never ran on any of the relevant commits**:

```
gh run list --workflow=ci.yml --commit=<sha>   for db577db and all seven unpaired commits
  -> <no runs> for all eight
```

CI triggers on `push` to `main` and on `pull_request`, so it evaluated push tips, never these
individual commits. "No CI catch is recorded" is therefore compatible with the gate having had no
opportunity to catch anything -- it is not evidence of cleanliness. **The amendment must not use
this argument.** It already has a real one: the byte-identity measurement in C-C.

**Wording the amendment may use:** *Do not state this.* If the drift history is worth a sentence,
state the true one: "The guard has fired once in this window -- Phase 7's `check:action` caught an
88-line dependency-driven drift on 2026-07-27 and the rebuild was staged in the same commit."

---

### C-E: "The date window 2026-07-26 to 2026-08-09 is the requirement's entire life; `aee017c` first introduced a partial/proportional branch."

**Verdict:** CORRECTED -- the window survives; the attribution to `aee017c` does not.

**Derived from:**
```
git log -1 --date=iso 969de3e -> 2026-07-26 23:27:54 +0200  docs: amend v0.0.2 requirements ...
git log -1 --date=iso aee017c -> 2026-08-09 12:06:28 +0200  feat(260809-2s6): GATE the partial-miss branch on a Wilson lower bound
git log --reverse -S'alreadyPresent'    -- src/publish/publish-mirror.ts -> e78a842 first
git log --reverse -S'wilsonLowerBound'  -- src/publish/publish-mirror.ts -> aee017c first
git log --reverse -S'proportional'      -- src/publish/publish-mirror.ts -> (none)
git log --follow --date=short           -- src/publish/publish-mirror.ts -> 28 commits, none before 2026-08-09 carrying a partial branch
```

**Finding -- the two dates are right, the causal commit is not.**

Both endpoints confirm: `969de3e` is 2026-07-26, `aee017c` is 2026-08-09. **The window
2026-07-26 to 2026-08-09 stands, and no earlier commit introduced a partial branch.** Nothing about
edit 1's framing changes.

But `aee017c` is **not** the commit that first introduced the partial branch. It **gated an already
existing one** on a Wilson lower bound -- its own subject says *"gate the partial-miss branch"*, and
`-S'wilsonLowerBound'` versus `-S'alreadyPresent'` separates the two cleanly. The partial branch was
introduced nine hours earlier the same day by **`e78a842`, 2026-08-09 03:06:52**, *"feat(260809-2s6):
split the conflated miss metric and guard the partial case"*. The full same-day sequence:

| SHA | Time | What it did |
|-----|------|-------------|
| `3cdf87c` | 03:01 | skip other runs' seeds and pre-restore shard members |
| `e78a842` | 03:06 | **introduced the partial branch** |
| `9b1b136` | 09:43 | corrected comments asserting constraints the code lacked |
| `aee017c` | 12:06 | gated the existing partial branch on a Wilson lower bound |
| `e40cfcf` | 12:08 | replaced the branch's estimates with a measurement |
| `54677af` | 12:11 | stopped the warning leaking this repo's own history |

Because both fall on 2026-08-09, the window is unaffected -- but writing "`aee017c` introduced it"
into a permanent capture would plant a seventh falsifiable claim in the same subject area.

Also correct while here: CONTEXT.md's canonical reference gives the file as
`packages/github-cache/src/lib/publish-mirror.ts`. **That path does not exist.** It is
`packages/github-cache/src/publish/publish-mirror.ts`.

**Wording the amendment may use:** "Before 2026-08-09 there was no partial branch at all, so drift
was fully runtime-silent for the requirement's entire life, 2026-07-26 to 2026-08-09. The partial
branch was introduced that day by `e78a842` and gated on a Wilson lower bound hours later by
`aee017c`." -- If a single commit must be cited, cite `e78a842`, or cite the date alone.

---

### C-F: "The proportional warning names exactly (1) a cache-version rotation and (2) the token's Actions-cache read scope, and bundle drift is neither."

**Verdict:** CONFIRMED (line numbers hold; the file path in CONTEXT.md does not -- see C-E)

**Derived from:** direct read of `packages/github-cache/src/publish/publish-mirror.ts` (923 lines).

**Finding:** Exact. The partial branch's `core.warning` sits at **lines 895-902**:

```
github-cache publish: ${readMisses} of ${hashes.length} server-produced cache entries
(${percent}%) restored as a MISS. That is a proportion of the entries ENUMERATED on this
leg, not of the restores attempted. Two candidate causes: (1) a cache-version rotation in
this commit range -- the archive path literal or the cross-OS flag changed; (2) the runtime
token's Actions-cache read scope.
```

Exactly two candidate causes, both as claimed. **Bundle drift is neither**, and it is not named
anywhere in either message. The comment above the branch, at **line 866**, reads:

```
// Treat this branch as the live rotation signal; the gate above covers only a
// read-scope regression wide enough to hide the seed itself. A reader tuning the
// threshold must not over-weight a gate that does not fire.
```

What that means for misattribution is unambiguous and is the source's own instruction, not an
inference: the file directs a reader who sees this branch fire to read it **as a rotation signal**.
Under bundle drift the branch fires with no rotation having occurred, so the operator is pointed at
a cause that is absent and away from one the message never mentions. The comment block at 892-894
narrows it further -- what the message keeps is *"the two candidate causes the sibling gate above
already names"* -- so the omission is deliberate and closed, not an oversight a reader might work
around.

Note also that `publish-mirror.ts` is **not** in the action bundle's 18-file input set. The
drifting artifact and the warning that misattributes it are in different graphs entirely.

**Wording the amendment may use:** "At shard rollover the proportional warning fires, but it names
only two candidate causes -- a cache-version rotation in the commit range, and the runtime token's
Actions-cache read scope (`publish-mirror.ts:895-902`). Bundle drift is neither, and the comment at
`:866` instructs the reader to treat the branch as the live rotation signal. So drift surfaces as a
warning pointing at a cause that did not occur."

---

### C-G: "An entry already present in the shard is SKIPPED before any restore attempt, counted into `alreadyPresent` and not `readMisses`, so it stays in the denominator and leaves the numerator -- silent mid-month, loud at rollover."

**Verdict:** CONFIRMED as a mechanism, with one caveat the amendment should carry

**Derived from:** direct read of `publish-mirror.ts` lines 524-546, 596-649, 683-692, 804-903.

**Finding:** The mechanism is exactly as described.

- **The skip precedes the restore.** Line 635: `if (shard !== undefined && shard.names.has(name))`
  -> `skipped++; alreadyPresent++; continue;`. The restore call, `await actionsCache.get(hash)`, is
  at line 642 -- *after* the `continue`. A present entry is never attempted.
- **It cannot reach `readMisses`.** Only the `restored.kind === 'miss'` branch at 644-648
  increments it.
- **The denominator is unaffected.** Both the gate (804) and the partial branch (819, 896) divide by
  `hashes.length`, the **full enumeration**, not by attempts. Lines 843-851 defend that choice
  explicitly and record the measurement behind it: attempted-only would give 43/53 = 0.811 on ubuntu
  and 43/44 = 0.977 on windows and fire on both legs of a healthy run.
- The source states the reclassification's direction itself, at 623-626: it *"moves `readMisses`
  down in PARTIAL runs."*

So: present entries stay in the denominator and leave the numerator, suppressing the Wilson lower
bound. Mid-month the shard has accumulated names, most enumerated entries take the 635 skip, and
`readMisses` stays low -> **silent**. At month rollover the shard is new and empty, nothing is
already present, every entry is attempted, and under drift every server-produced entry misses ->
`readMisses` approaches `hashes.length` -> the branch **fires**, and misattributes per C-F.

**"Silent mid-month, fires and misattributes at rollover" is a fair statement of the mechanism.**

**The caveat, which the amendment should not drop:** the skip is guarded on `shard !== undefined`,
and the shard resolves only after a restore **hit** (line 692, inside the mirror path). So the
suppression is **enumeration-order dependent** -- entries enumerated before the first hit are
attempted regardless of shard membership, and enumeration order is pinned nowhere. Mid-month silence
is therefore the *likely* outcome, not a guaranteed one, and it also decays as new task hashes
appear that were never mirrored. Write "silent" as the expected behaviour, not as a certainty.

**Wording the amendment may use:** "Under drift the proportional warning is silent for most of the
month: an entry already in the month shard is skipped before any restore is attempted
(`publish-mirror.ts:635`), counted into `alreadyPresent` rather than `readMisses`, so it stays in
the warning's denominator -- the full enumeration -- and leaves its numerator. The warning becomes
loud at month-shard rollover, when the new shard is empty and nothing can be skipped."

---

### C-H: "Under bundle drift the publish leg's own synthetic seed still uploads, so 'the mirror silently stops receiving anything' is literally false while being substantively right."

**Verdict:** CONFIRMED

**Derived from:** `.github/workflows/ci.yml:2474-2486` and `publish-mirror.ts:232-253, 683-728`.

**Finding:** Confirmed, and the reason is structural rather than incidental.

The `publish` job runs two steps back to back, **both `uses: ./packages/github-cache`** -- the
internal action whose `main` is `dist/action/index.js`, a build output rebuilt in-job:

```yaml
- uses: ./packages/github-cache
  with: { hash: ${{ github.run_id }}, operation: mirror-seed }
- uses: ./packages/github-cache
  with: { operation: publish }
```

Bundle drift is a property of a **different artifact** -- the committed `start-cache-server/index.js`,
whose `main` is `'index.js'` resolved from the git ref. So the seed's write version and publish's
restore version are identical by construction and drift cannot separate them. The seed restores.

It is then genuinely **mirrored**, not merely restored. `isOtherRunsSeed` (line 253) filters seeds
belonging to *other* runs; this run's own seed is admitted, and the docblock at 244-245 says why it
must be -- *"C1 needs it mirrored (publish-verify reads its own leg's seed back out of the SHARD)."*
It reaches `uploadReleaseAsset` at 726 and increments `mirrored`.

Two consequences the amendment can rely on. The shard **does** receive content under drift, so
"stops receiving anything" is literally false. And `mirrored >= 1` is the same fact that keeps the
all-MISS gate silent (its condition requires `mirrored === 0`), so a correction cannot assert both
"receives nothing" and "the gate stays silent because the seed mirrors". The two claims are the same
event read twice. Substantively the point stands: no real task content reaches the shard.

**Wording the amendment may use:** "Under drift the shard stops receiving real cache content. It is
not empty -- the publish leg seeds and mirrors its own synthetic entry in the same job, through the
`dist/`-built internal action that bundle drift cannot touch -- and that single mirrored entry is
also why the all-restore-MISS gate, which requires `mirrored === 0`, stays silent."

---

## Figures the amendment MUST NOT state

1. **"Each of the nine paired with the source change that required it."** False for `db577db`.
   Write "eight of the nine", and name the ninth as a lockfile re-resolution
   (`undici` 6.27.0 -> 6.28.0).

2. **"The unpaired commits ... are spec files."** No referent -- **not one** of the seven is a spec
   file; all seven edit real bundled `.ts` modules. Drop "spec files" entirely and say
   "comment-only".

3. **"No `action-bundle-drift` catch is recorded anywhere in `.planning`."** REFUTED -- Phase 7's
   Q10 catch is recorded in five places and sits *inside* the window. Delete this sentence. It is
   also a broken argument on its own terms: `gh run list --commit=<sha>` returns **no runs** for
   `db577db` and for all seven unpaired commits, so the CI gate never evaluated any of them and its
   silence proves nothing. Replace the whole argument with the byte-identity measurement:
   47 commits after the last rebuild, a fresh build at HEAD reproduces the committed bundle exactly.

4. **"Commit `aee017c` introduced the partial branch."** It *gated* an existing one. `e78a842`
   (2026-08-09 03:06:52) introduced it. Cite `e78a842`, or cite the date alone. The window
   2026-07-26 to 2026-08-09 is itself confirmed and needs no change.

5. **`packages/github-cache/src/lib/publish-mirror.ts`.** Path does not exist. It is
   `packages/github-cache/src/publish/publish-mirror.ts`. (Line numbers 895-902 and 866 are correct.)

6. **"Silent mid-month"** stated as a certainty. The suppressing skip is guarded on a shard that
   resolves only after the first restore hit, so the outcome is enumeration-order dependent and
   order is pinned nowhere. State it as the expected behaviour, not a guarantee.

7. **Any Wilson percentage, ratio, or miss count** re-stated from `HANDOFF.json` (the 46%, the
   0.3746, the 52/112). Not re-derived here -- and the source comment at lines 838-841 records that
   **two prior estimates of exactly these figures were both wrong, in opposite directions, by the
   denominator each time**. The only measured figures carry run id `31305961054` (43/112 ubuntu,
   43/113 windows, bound 0.299). Cite those with the run id or cite none.

## Sources

All primary, all this repository. No external sources consulted.

- `git log` / `git show` / `git rev-list` over `969de3e..HEAD`
- `esbuild` metafile build of `start-cache-server/entry.ts` (18 first-party inputs), plus `cmp`
  against the committed `start-cache-server/index.js`
- `packages/github-cache/src/publish/publish-mirror.ts` (923 lines)
- `esbuild.action.mjs`, `package.json` (`build:action`, `check:action`, `typecheck:action`)
- `.github/workflows/ci.yml` (triggers, `action-bundle-drift` job at :128, `publish` job at :2474)
- `start-cache-server/action.yml`, `packages/github-cache/action.yml`
- `.planning/phases/07-.../07-EVIDENCE.md`, `07-01-SUMMARY.md`, `07-LEARNINGS.md`, `STATE.md`
- `gh run list --workflow=ci.yml --commit=<sha>`

**Research date:** 2026-08-09
**Valid until:** invalidated by the next commit touching `start-cache-server/index.js`, any bundled
source, `package-lock.json`, or `publish-mirror.ts`.
