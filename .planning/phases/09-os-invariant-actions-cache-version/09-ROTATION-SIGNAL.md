# Phase 9 - Rotation-Signal Record (OBS-04, recorded IN ADVANCE)

Authored by plan 09-02, in wave 1, BEFORE any commit that changes `getCacheVersion`'s input.

OBS-04's rotation signal exists on **exactly ONE run** and cannot be re-sampled -- the next push is a
normal all-HIT push. A prediction written afterwards is indistinguishable from a rationalisation, so
"recorded IN ADVANCE" is a claim about **git history**, and history is the only proof. There is no
programmatic mtime guard; the position of this file's commit relative to plan 09-03's commit IS the
control (D-29, and Phase 8's precedent in `08-ROOT-CAUSE.md`).

Everything below is a **prediction**, not a measurement. It is phrased so that it can be checked
against one specific job summary and either match or fail -- including its non-triggers (Section 6),
which are the half that does the work (`08-LEARNINGS.md`, "Pre-register the falsifiable condition,
including its non-triggers, before running the experiment").

---

## Method

**Capture date:** 2026-07-28.
**Authored at commit:** `4296d1d` (`gsd/v0.0.2-os-invariant-cross-os-sharing`; this file's own commit
is its child).
**Pinned `@actions/cache`:** **6.2.0**, exact-pinned at `packages/github-cache/package.json:42` and
guarded by `pinned-deps.spec.ts:22`.

PARITY-06 discipline: every upstream mechanism claim below was read first-hand against **that**
installed version, at the cited line, this session. A future reader who bumps `@actions/cache` must
re-read `getCacheVersion` before trusting Sections 2 and 3 -- the version is what makes those claims
checkable rather than folklore.

In-repo sites read first-hand this session:

| Claim | Site | Read |
|---|---|---|
| the warning's branch condition and its exact substring | `publish/publish-mirror.ts:300-307` | yes |
| the five job-summary row labels | `action/index.ts:162-168` | yes |
| `getCacheVersion`'s component order and the `windows-only` gate | `@actions/cache/lib/internal/cacheUtils.js:157-172` | yes |
| pushes are filtered to `main` | `.github/workflows/ci.yml:3-7` | yes |
| `publish` is push-gated, two-leg, `max-parallel: 1` | `.github/workflows/ci.yml:958-975` | yes |

---

## The prediction

On the **FIRST push to `main` that contains plan 09-03's commit**, the `publish` job
(`ci.yml:958`, matrix `[ubuntu-24.04-arm, windows-11-arm]`, `fail-fast: false`, `max-parallel: 1`):

1. **BOTH legs** report, in the `github-cache publish` count table written by `writeCountSummary`
   (`action/index.ts:162-168`) -- these are the row labels verbatim, so no translation is needed when
   comparing against the real job summary:

   | Row | Predicted value |
   |---|---|
   | `scanned` | `> 0` (see the vacuity note below) |
   | `mirrored` | `== 0` |
   | `skipped` | `== scanned` |
   | `restore-MISS (of skipped)` | `== scanned` |
   | `failed` | `== 0` |

   `restore-MISS (of skipped)` is a **BREAKDOWN of `skipped`, not an addend** (`action/index.ts:156-158`):
   the engine's miss branch increments both, which is why the two rows carry the same value here and
   why the column must not be summed.

2. **Each leg emits exactly one `core.warning` containing the substring `restored as a MISS`** -- the
   branch at `publish-mirror.ts:300`. Note the message's `entr(y|ies)` count is **DISTINCT keys after
   dedup**, not enumerated rows (`publish-mirror.ts:298-299`), so it equals `scanned` and not the
   number of cache entries GitHub holds.

3. **`publish-verify` on that same run therefore has nothing new to read back** under the new cache
   version. Nothing was mirrored, so there is no newly-written asset for it to confirm.

### `scanned == 0` does NOT satisfy this prediction

The warning's branch requires `hashes.length > 0` (`publish-mirror.ts:300`). A run that enumerated
nothing never reaches the warning at all, and a zero-scan run is a **different event** -- an empty
default-branch cache, or a `getActionsCacheList` fault -- which must not be read as this one. If
`scanned == 0`, this prediction has neither passed nor failed; it has not been sampled, and the one
opportunity to sample it is gone. See Section 6.

---

## The axis, and why naming it matters

The mechanism here is the **`@actions/cache` cache VERSION**: the sha256 over
`paths | compressionMethod | ('windows-only') | versionSalt`, joined with `|`
(`cacheUtils.js:157-172`). The literal archive-path strings are the FIRST components
(`cacheUtils.js:159`), which is exactly why changing the path literal rotates the version.

This milestone has **three** legitimate all-MISS rotation windows, and they are **three different
mechanisms on two different axes** (D-30, `09-RESEARCH.md` Q9 and Hazard E, first stated in Phase 7's
D-36):

| Window | Phase | Mechanism | Axis |
|---|---|---|---|
| 1 | 7 | the inferred `lint` target changes `hash_project_config`, and `nx.json` is itself a `test` input so `test` rotates twice over | Nx TASK hash |
| 2 | 9 | the archive-path literal changes `getCacheVersion`'s input | `@actions/cache` cache VERSION |
| 3 | 10 | the Releases asset name changes (CORR-02) | Release ASSET NAME |

**The consequence, in one sentence:** a tripwire keyed on "all-restore-MISS at publish" sees window 2
directly, while windows 1 and 3 produce a superficially similar all-MISS through unrelated machinery
-- so any message or note that says only "rotation" lets a reader misdiagnose the other two, and
D-30 forbids authoring a tripwire that fires on them.

---

## Attribution: the PATH, not the flag

The both-legs all-MISS is caused by **VER-01's path change**, not by `enableCrossOsArchive`.

`enableCrossOsArchive` alone rotates **ONLY Windows entries**. `cacheUtils.js:166` pushes the
`windows-only` component only when:

```js
process.platform === 'win32' && !enableCrossOsArchive
```

So on Linux and macOS `process.platform !== 'win32'` and the component was never pushed in the first
place -- flipping the flag there changes nothing about the version. The flag is a **no-op on the
version off `win32`**. The compression method, by contrast, is pushed **unconditionally**
(`cacheUtils.js:162-163`), and the path components are unconditional too -- so a path change moves the
version on **every** platform, which is what makes both legs miss together.

### Corollary, as a diagnostic

An **asymmetric** signal -- Windows leg all-MISS, ubuntu leg normal -- means **VER-03 (the flag)
landed WITHOUT VER-01 (the path)**. That reads like a Windows-specific breakage and it is **NOT this
event**. Do not rationalise it as "the rotation, arriving unevenly". Check the commit range for a
`cache-archive-path.ts` change; if there is none, the path never moved.

Getting this backwards in either direction is the misdiagnosis D-29 exists to prevent: attributing
the symmetric signal to the flag would predict an asymmetry that never comes, and attributing the
asymmetric signal to the path would hide a genuinely half-landed change.

---

## The version-affecting commits in this phase

**Exactly ONE: plan 09-03's commit.** It lands **VER-07, VER-01, VER-02, VER-03 and VER-04 together**,
plus the rebuilt `start-cache-server/index.js`.

That merge is **load-bearing, not tidy**, for two reasons (C-04, RESEARCH Hazards B and D):

1. **VER-01 and VER-03 EACH change `getCacheVersion`'s input.** Splitting them would give the
   milestone **FOUR** rotation windows where D-30 says three and this record says "once" -- and the
   tripwire in Section 5 is calibrated against that count.
2. **A VER-03-only commit produces the asymmetric Windows-only signal of Section 3**, which reads as a
   Windows breakage. The split does not merely add a window; it adds a *misleading* one.

### Maintenance instruction, explicit

> **If plan 09-03's commit is ever split, THIS FILE MUST BE REWRITTEN** to enumerate every
> version-affecting commit, rather than leave "once" standing. Do not leave a reader to infer it. A
> sentence that says "expected once" while four commits rotated the version still reads as
> authoritative and is simply false -- that is the T-09-11 failure, and rewriting this section is the
> only mitigation.

### The bundle coupling, because it produces a signal that LOOKS like this one

This is **the single most likely way this record gets misused.**

If a `serve()`-reachable edit ever reaches `main` **WITHOUT** the rebuilt `start-cache-server/index.js`
(ROBUST-04, D-25), then the **five** `ci.yml` sidecar sites (`:236`, `:310`, `:357`, `:432`, `:895`)
run the OLD committed bundle and write at the OLD cache version, while the publish action -- built
from source -- restores at the NEW one. Nothing errors. The mirror **silently stops receiving**, and it
surfaces as **exactly the all-MISS warning of Section 1**, on a run where it is a **DEFECT**.

`action-bundle-drift` (`ci.yml`, no `if:` gate, so it runs on PRs too) catches the drift -- but only
after the misleading signal has already been rationalised as "the rotation OBS-04 told us to expect".

**Reading rule:** an all-MISS is only this event if plan 09-03's commit is in the range AND the bundle
in that commit matches a fresh `npm run build:action`. If `action-bundle-drift` is red, or was red on
the merge, the all-MISS is the drift, not the rotation.

---

## The tripwire

**The gate, verbatim as OBS-04 requires:**

> **two consecutive all-miss pushes with NO version-affecting change in between**

Not a raw push counter. The second occurrence is only actionable when nothing between the two pushes
touched the cache version -- which for this axis means neither
`packages/github-cache/src/lib/cache-archive-path.ts` nor
`packages/github-cache/src/backend/actions-cache-backend.ts` changed in the range.

It is a **documented READING INSTRUCTION**, carried in two places: this record, and the warning
message itself (plan 09-06). It **stays a `core.warning`** (`publish-mirror.ts:301`) and is **never a
hard failure** -- because a tripwire that fires on correct work gets disabled, and then it is not a
tripwire. This milestone has three legitimate all-MISS windows; a hard failure would break all three.

### Rejected alternatives, with the reason

Recorded so a later maintainer does not re-litigate them silently (D-28b):

| Rejected | Why |
|---|---|
| **A persisted marker** -- a Release asset, a repo variable, or a cache entry recording "the last push was all-miss" | Adds **mutable observability state**, which this project's Key Decisions already reject on principle (the LRU-manifest row: "a manifest adds mutable retention state (security-negative)"). OBS-04 itself says the mechanism stays a warning. |
| **A scheduled job diffing the last two runs** | Same objection plus a second one: it needs its own trigger, its own permissions, and its own correctness -- new machinery whose failure mode is silence, to observe a machine whose failure mode is already silence. |

**Adding a mechanism later is strictly additive.** What ships here is one warning message and this
record. No contract is frozen, no schema is written, nothing has to be migrated if a future maintainer
decides state is worth it after all.

---

## Non-triggers

Phase 8's discipline: the non-triggers are the half that does the work. They stop a known,
already-root-caused difference being relabelled as this signal, and equally stop this signal being
waved away by pointing at one of them.

**NONE of the following is this signal.** What each one is instead:

1. **An all-MISS push whose commit range contains no change to `cache-archive-path.ts` or
   `actions-cache-backend.ts`.**
   -> That is **the tripwire FIRING**, and the reader must act. Nothing rotated the version, so the
   misses have another cause -- most likely the runtime token's Actions-cache read scope, or the
   bundle drift of Section 4.

2. **A single-leg all-MISS** (one of `ubuntu-24.04-arm` / `windows-11-arm` normal, the other
   all-MISS).
   -> See Section 3. The flag landed without the path. Not this event, and not a Windows breakage
   either.

3. **An all-MISS following Phase 7's `lint`-inference commit, or Phase 10's CORR-02 asset rename.**
   -> Rotation windows **1** and **3** -- the Nx TASK hash and the Release ASSET NAME. Different
   axes, different machinery, superficially identical symptom. See the table in Section 2.

4. **A `scanned == 0` run.**
   -> The warning's branch is **unreachable** there (`hashes.length > 0`, `publish-mirror.ts:300`).
   Nothing was enumerated, so nothing could miss. This prediction was not sampled.

5. **An all-MISS with `failed > 0`.**
   -> That run **already failed loud** through `core.setFailed` (`publish-mirror.ts:315-317`). It is a
   **mirror fault**, not a rotation. Read the failure, not this file.

---

## How this record is consumed

**When.** At the **first `main` push after the merge** -- a `human_needed` item this phase closes with
(H5, C-06). It cannot be consumed earlier: `ci.yml:3-7` filters pushes to `main`, and `publish` is
`if: ${{ !cancelled() && github.event_name == 'push' }}` (`ci.yml:959`), so nothing on this branch and
nothing on a pull request can produce the signal. Do not author a pre-merge acceptance check that
either could satisfy -- that is a guard passing for the wrong reason.

**Against what.** Its **axis wording must MATCH plan 09-06's reworded warning message**. Two copies of
one diagnosis; if they drift, a reader who finds one and not the other gets a different answer. Both
must name the axis as the **`@actions/cache` cache VERSION**, and 09-06 must retain the substring
`restored as a MISS` (`publish-mirror.spec.ts` asserts it in three places).
