# Phase 11: Live proofs -- O1, O2, O3 (one evidence record, D-22)

**Captured:** 2026-07-29
**Commit:** `2628921` (branch `gsd/v0.0.2-os-invariant-cross-os-sharing`, UNMERGED)
**Machine:** native Windows arm64, `process.platform=win32`, Node v24.13.0, Nx 23.1.0
**Tree:** the **MAIN tree** at `D:/projects/github/op-nx/github-cache` -- `.git` is a directory,
not a file, so this is NOT a git worktree and no junctioned `node_modules` is in play. This line is
not boilerplate: this project's junctioned-`node_modules` hazard makes a worktree measurement
unattributable, and `10-EVIDENCE-PRE-RENAME.md` records the same check in the same position.

**PERISHABLE.** The O1/O2 halves below rest on the warm `cache-mirror-202607` shard, whose 16
assets were created 2026-07-29T16:44Z. Cleanup prunes past `DEFAULT_MAX_AGE_DAYS` (30) daily at
03:17 UTC, so the window closes around **2026-08-28** -- approximately **29 days** remaining at
capture time (D-03). Separately, plans 11-05 and 11-06 rotate three of the four hashes measured
here, so this measurement cannot be retaken at this commit once they land (D-10, D-11).

This record has FOUR sections by design (D-22, TEST-08's own words: "Phase 12 appends the O4 row to
the same evidence record"). O1 and O2 are complete below. O3 is PENDING and owned by plan 11-07.
O4 is RESERVED for Phase 12 and must be neither filled nor deleted here.

---

## Headline

| Half | Verdict |
|---|---|
| **O1 (XOS-01)** -- a cold local Windows box logs the literal `[remote cache]` for `build`, `typecheck` AND `test`, per target, against Linux-CI-produced artifacts | **PROVEN.** 1 occurrence per target, 3 of 3 named individually. All three pre-registered counts MET |
| **O2 (XOS-02)** -- the same run HITs `integration` from a Windows-CI-produced artifact | **PROVEN.** 1 occurrence, pre-registered count MET, and the restored artifact carries a Windows runner path |
| Structured corroborator -- `run.json` `cacheStatus` == `remote-cache-hit` | **4 of 4 targets**, exactly the pre-registered set `{build, typecheck, test, integration}` |
| Producer fingerprint, per hit | `test` -> **LINUX**, `integration` -> **WINDOWS**. `build`/`typecheck` UNAVAILABLE with a stated reason (see the table) |
| **O3 (XOS-03, TEST-09)** | **PENDING** -- plan 11-07 |
| **O4 (XOS-04, XOS-05)** | **RESERVED** -- Phase 12 |

Both proved halves are LOCAL measurements against an already-warm mirror. **Nothing in O1 or O2
needed a temporary `main` push.** Only O3 needs the live run (D-20). This is stated explicitly
because Phases 9 and 10 both needed a push for their perishable halves and a reader may otherwise
assume the same shape here.

---

## O1 (XOS-01, TEST-10, OBS-02) -- soundness probe completed 2026-07-29T21:44:03Z, recorded as PRECEDING the first Nx run

### Measurement soundness, established BEFORE any read (D-08, re-run verbatim)

The read path degrades **every** fault to a MISS, so a HIT is self-evidencing but a MISS is not.
That asymmetry is the whole reason this table runs first and is timestamped.

**Probe completed: `2026-07-29T21:44:03Z`. First Nx invocation of the session began:
`2026-07-29T21:44:28.096Z`** (`run.json` `run.startTime`). The probe therefore PRECEDES the first
Nx run by 25 seconds, which is TEST-10's requirement in TEST-10's own words. At the moment the
probe timestamp was taken, `.nx/cache` was confirmed **absent** -- no `nx` invocation of any kind
had yet occurred in this session.

Control rows reuse `10-EVIDENCE-PRE-RENAME.md`'s table shape, including its third column naming
which MISS cause each row eliminates.

| Control | Result | Which MISS cause it eliminates |
|---|---|---|
| `gh auth token` through `runHelper`'s literal spawn shape (`shell:false`, `timeout` 5000, `killSignal` SIGKILL, `windowsHide`, the three env keys over a COPY of `process.env`) | exit 0, **RESOLVES**, len 40 (LENGTH only; the value was never recorded) | "no token, so the reader returns `undefined` with zero fetches" |
| `git remote get-url origin`, same spawn shape | **RESOLVES**, `https://github.com/op-nx/github-cache.git` | "no repo identity, so the reader cannot compose a URL" |
| `GITHUB_ACTIONS` / `GH_TOKEN` / `GITHUB_TOKEN` / `GITHUB_REPOSITORY` in the env the sidecar and the Nx run inherit | all **UNSET** | wrong-branch selection |
| `isWriteTrusted(process.env).trusted`, imported from the BUILT `packages/github-cache/dist/lib/trust.js` rather than reasoned about | **false**, `reason: 'not-ci'` -> `selectBackend` takes the off-CI branch into `createReleasesReadBackend(createReleasesReadClient(env))` | proves WHICH backend served the read: the Releases mirror reader, not the Actions cache |
| Bound URL read from the sidecar's OWN stdout (`resolvePort` silently falls back to an OS-assigned port on a bad `PORT`) | `http://127.0.0.1:41999`, EQUAL to the exported `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` | a port mismatch making every task MISS |
| Wrong bearer | **401** | auth is live |
| No bearer | **401** | auth is live |
| Valid bearer, known-absent hash `000000000000000000000000000000000000000f` | **404** | the request reached a backend `get`; a 404 is a backend ANSWER, not a routing failure |
| Dead-port differential: same request shape to port 41998, nothing listening | **`curl` exit 7** | proves the 401/401/404 requests actually LEFT the process |
| Sidecar stderr | **0 bytes** across every probe and the whole Nx run | no 401/403/429/5xx, no DNS fault, no download fault |
| Teardown | listening PID stopped; a Windows listening-port query returns nothing for 41999; `curl` exit 7 | a leaked sidecar holding the port (T-11-08) |
| Repo mutation | `git status --porcelain packages/ .github/ start-cache-server/` printed **nothing** | this session edited no hashed source input |

Sidecar launch (the shipped consumer surface, launched directly; the bearer is a locally generated
session-scoped throwaway and is never recorded in any committed file):

```
PORT=41999 NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=<throwaway> \
  node packages/github-cache/dist/serve.js
```

The sidecar's own stdout, first line, verbatim:

```
github-cache serve listening on http://127.0.0.1:41999
```

The second stdout line carries the bearer token and is deliberately not transcribed (T-11-03).

### `dist/` currency, confirmed WITHOUT rebuilding -- and a recorded finding

No build was run before the probe, and none should have been: `packages/github-cache/dist/`
survives `nx reset`, and a rebuild would repopulate the outputs that `typecheck`'s
`dependentTasksOutputFiles` input hashes (`nx.json` `typecheck.inputs` carries
`{"dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts}", "transitive": true}`), which is the one
thing that could move a proof target's hash mid-session.

**The plan's literal check FAILED, and that failure is recorded here rather than absorbed.** The
plan asks that the newest mtime under `dist/` be newer than the newest mtime under `src/`. Measured:

| Quantity | Value |
|---|---|
| Newest mtime under `packages/github-cache/src/` | `2026-07-29T15:07:45.130Z` (`src/lib/release-asset-name.ts`) |
| Newest mtime under `packages/github-cache/dist/` | `2026-07-29T13:09:15.698Z` (`dist/tsconfig.lib.tsbuildinfo`) |
| Aggregate check "dist newer than src" | **NO -- the plan's literal check does not pass** |

The aggregate newest-vs-newest form is a crude proxy, and it was defeated here by files whose
CONTENT did not change. Three stronger, read-only checks settle the actual question, and all three
agree that `dist/` is current for the path being measured:

1. **Pairwise, per file.** Of the 34 BUILD-RELEVANT sources (`src/**/*.ts` minus the 41 spec/test
   files, which `build` excludes at `nx.json:116`), 32 have an emitted output newer than
   themselves. The 2 exceptions are `lib/release-asset-name.ts` and `publish/publish-mirror.ts`.
   The one file whose CONTENT is genuinely newer than the build, `src/docs-same-os-claims.spec.ts`,
   is a spec: `dist` contains **0** entries matching `docs-same-os-claims` and **0** matching
   `.spec.`, so it cannot make `dist` stale.
2. **Content provenance, not timestamps.** For both exceptions the only commit after the emit is
   `77f675c` ("collapse the Releases namespace to one asset name per hash"). Its changes to
   `lib/cache-key.ts` and `backend/releases-backend.ts` are **comment-only** -- 0 non-comment
   changed lines out of 27 and 35 respectively. Its real code change is in
   `lib/release-asset-name.ts`, and the emitted output CARRIES it: `dist/lib/release-asset-name.js`
   holds `export function releaseAssetName(hash)` returning the OS-free
   `` `${CACHE_KEY_PREFIX}${hash}` ``, with `isCurrentAssetName` and
   `isLegacyOsSuffixedAssetName` present, and `CACHE_KEY_PREFIX = 'nx-cache-'` byte-identical
   between source and emit. The pre-CORR-02 `-${cachePlatform(platform)}` form is genuinely absent
   (`rg` exit 1, checked alongside a same-file same-flag-shape positive control at exit 0, so the
   zero is not a reader artifact). `publish/publish-mirror.ts` is NOT on the `serve()` read path.
3. **The independent argument the plan itself names.** Plan 11-02's warm capture matched D-02's
   table exactly, and D-02's values are the hashes CI saved. Because `typecheck` hashes the
   declaration outputs in `dist/` via `dependentTasksOutputFiles`, a local `dist/` that disagreed
   with CI's build output would have produced a different local `typecheck` hash. It did not:
   `122473981802582055` in both.

The 17 modules reachable from `dist/serve.js` were enumerated and checked; `dist/lib/trust.js`
(the probe's own read target) is consistent with `src/lib/trust.ts` on all six checked markers and
was emitted `2026-07-28T22:24:58Z`, after its source's last content change. **Conclusion: the
mtime failure is an artifact of later touches that changed no bytes -- the working tree is clean,
so its content equals HEAD -- and the read path being measured is current.** No rebuild was run.

### WHICH QUESTION this proof answers

Stated in as many words, because the reset makes this easy to get wrong and D-07 forbids letting one
question silently substitute for the other:

`nx reset` clears `.nx/workspace-data` as well as `.nx/cache`, so it forces the COLD state. **This
proof therefore answers "does a COLD Windows box hit".** It does NOT answer PARITY-04's "does my
EVERYDAY box hit" -- that is a separate, named question, it is on this phase's deferred list, and
this phase does not close it. Plan 11-02 captured the data a later phase would need for it (cold
== warm on all four) and deliberately recorded that as a FINDING rather than promoting it to a
proof.

### Pre-registered counts (D-23), reproduced verbatim from `11-03-PLAN.md`

Named in the PLAN, before the run. Recording a different value would be a finding, not a reason to
re-run.

**O1, the gate, named per target (OBS-02's own words):**

| Target | Expected occurrences of the literal `[remote cache]` | Value under the failure hypothesis (mirror read dead) |
|---|---|---|
| `build` | exactly 1 | 0 |
| `typecheck` | exactly 1 | 0 |
| `test` | exactly 1 | 0 |

**O2, the gate:**

| Target | Expected occurrences of the literal `[remote cache]` | Value under the failure hypothesis |
|---|---|---|
| `integration` | exactly 1 | 0 |

The aggregate total of 4 is recorded too, but it is NOT the gate. OBS-02 requires the count named
PER TARGET, so the four task lines are quoted individually below. A 3-of-4 outcome would have been
reported as which target missed, never as "mostly hit".

### The measurement: ONE cold Nx run

Run EXACTLY ONCE, as a single invocation, so there is one `run.json` and one end-of-run line for all
four targets. No retry, no second reset, no intervening `nx` call of any kind.

```
npx nx run-many -t build typecheck test integration -p @op-nx/github-cache
```

Started `2026-07-29T21:44:28.096Z`, ended `2026-07-29T21:44:31.930Z` (`run.json`'s own
`run.startTime` / `run.endTime`). Exit 0. Output tee'd to a durable log file so every count below is
re-countable from an artifact rather than from scrollback.

`run.json`'s `run.command` reads `nx run-many -t build typecheck test integration -p @op-nx/github-cache`
and names all four targets, so a stale record from a different invocation cannot be mistaken for
this run's.

### Observed counts, named PER TARGET, with the task lines quoted VERBATIM

ANSI stripped, otherwise byte-for-byte. One quotation per target.

`build`:

```
> nx run @op-nx/github-cache:build  [remote cache]
```

`typecheck`:

```
> nx run @op-nx/github-cache:typecheck  [remote cache]
```

`test`:

```
> nx run @op-nx/github-cache:test  [remote cache]
```

`integration`:

```
> nx run @op-nx/github-cache:integration  [remote cache]
```

| Target | Pre-registered | Observed occurrences of the literal `[remote cache]` | Verdict |
|---|---|---|---|
| `build` | exactly 1 | **1** | **MET** |
| `typecheck` | exactly 1 | **1** | **MET** |
| `test` | exactly 1 | **1** | **MET** |
| `integration` | exactly 1 | **1** | **MET** |
| aggregate (recorded, NOT the gate) | 4 | **4** | MET |

Counting mechanics, each of which has bitten this project before:

- `rg` was used, never `git grep`: the log is an untracked path, where `git grep` returns a silent
  zero that reads exactly like confirmation.
- `-F` was passed, because square brackets are a character class as a regex and `[remote cache]`
  would otherwise not match what it appears to match.
- `rg -o ... | wc -l` was used wherever a count of OCCURRENCES rather than of LINES was intended;
  `rg -c` counts lines.
- The literal was treated as CASE-SENSITIVE. Verified rather than assumed: a search for
  `[REMOTE CACHE]` returns 0 occurrences and `rg` exit 1 (genuine no-match), while a positive
  control on the same file returns exit 0.

### Structured corroborator, explicitly SECONDARY: `run.json` per-target `cacheStatus`

This field discriminates remote from local, which is precisely what the `Cache: n/m hit` line
cannot do. It does NOT replace the literal `[remote cache]` label, which OBS-02 and ROADMAP SC1
name in their own words; the label stays the primary instrument and this corroborates it.

`cacheStatus` has exactly three possible values -- `remote-cache-hit`, `local-cache-hit`,
`cache-miss`.

| Target | `hash` | `cacheStatus` | `status` | Under the failure hypothesis |
|---|---|---|---|---|
| `build` | `17269409342684722256` | **`remote-cache-hit`** | 0 | `cache-miss` |
| `typecheck` | `122473981802582055` | **`remote-cache-hit`** | 0 | `cache-miss` |
| `test` | `11681410932071446589` | **`remote-cache-hit`** | 0 | `cache-miss` |
| `integration` | `8137422034373911537` | **`remote-cache-hit`** | 0 | `cache-miss` |

Pre-registered expectation: the set of targets whose `cacheStatus` equals the exact string
`remote-cache-hit` is `{build, typecheck, test, integration}`, four members. **Observed: exactly
that set, 4 of 4. MET.** Not one target read `local-cache-hit`, which is the structural refutation
of T-11-14 (a local hit presented as a remote one).

### The `Cache: n/m hit` line, quoted verbatim

```
Nx read the output from the cache instead of running the command for 4 out of 4 tasks.

  Run duration:      2.0s
  Cache:             4/4 hit (100%)
  Critical path:     1ms (1 task)
  Recoverable time:  <1ms
```

**`Cache: 4/4 hit (100%)` is NON-DISCRIMINATING IN BOTH DIRECTIONS** (D-24, OBS-02, TEST-10). It is
recorded because the requirement says to record it, and marked because a reader would otherwise
treat it as the proof. The two MEASURED grounds:

1. A `0%` prints **identically** with no sidecar at all -- measured in run `30169158892`. So a zero
   is not evidence the remote was consulted and failed.
2. A non-zero count **includes LOCAL hits**. So a non-zero is not evidence the remote was consulted
   at all.

Nx 23.1's end-of-run performance report is supporting context only: it cannot separate local from
remote and cannot attribute a producer OS. **`Cache: 4/4 hit (100%)` is NOT the gate here** -- the
per-target label count is, corroborated by `cacheStatus`.

Corroborating and also explicitly secondary, the run-duration collapse: **2.0s for all four
targets**, against `10-EVIDENCE-PRE-RENAME.md`'s measured **2.4s** for a real all-MISS four-target
run and **961ms** for a real single `integration` run, and against Step 0's 1ms replay versus a real
554ms execution. Consistent with a remote-served run, and not by itself discriminating.

### Per-hit producer fingerprint, captured while the restored artifacts still existed (D-14 row 2)

The byte-level, per-hit attribution read from `.nx/cache/terminalOutputs/<hash>`. This is readable
only AFTER a HIT, which is why it is captured in this session and not in a later plan -- and why it
is captured at all, given that Phase 12 destroys the ability to re-derive it (see the O4 section).

| Target | Hash | Runner path found inside the restored artifact | Fingerprints | Note |
|---|---|---|---|---|
| `build` | `17269409342684722256` | none | **UNAVAILABLE** | The whole artifact is 44 bytes: `> tsc --build tsconfig.lib.json` plus blank lines. `tsc` prints no absolute path on success, so there is no path to fingerprint. Recorded with the reason rather than left blank |
| `typecheck` | `122473981802582055` | none | **UNAVAILABLE** | Same cause; 62 bytes: `> tsc --build tsconfig.json --emitDeclarationOnly` |
| `test` | `11681410932071446589` | `/home/runner/work/github-cache/github-cache/packages/github-cache` | **LINUX producer** | 6121 bytes. Also visible live in the run output, where the replayed vitest banner reads that path instead of this machine's |
| `integration` | `8137422034373911537` | `C:/a/github-cache/github-cache/packages/github-cache` | **WINDOWS producer** | 798 bytes. `C:/a/...` is the GitHub Windows runner workspace root, not this machine's `D:/projects/...` |

For all four artifacts, the count of this workstation's own path
`D:/projects/github/op-nx/github-cache` is **0** -- so none of them was locally produced.

**`build` and `typecheck` have no per-hit fingerprint, and their attribution rests on the graph
premise instead.** That is not a gap being papered over: it is exactly why D-14 row 1 is
load-bearing and why plan 11-01 asserted it mechanically rather than assuming it. See the graph
premise section below.

**A measurement hazard worth recording, because it produced a false zero mid-capture.** The first
fingerprint pass ran through `rg` from Git Bash and reported the linux prefix ABSENT for `test`
while simultaneously printing that very path from a regex search on the same file. Cause: Git Bash
MSYS rewrites any argument that looks like an absolute POSIX path, so `rg -F -e '/home/runner/...'`
was mangled before `rg` ever saw it. A `C:/...` pattern is left alone, which is precisely why the
Windows fingerprint resolved and the Linux one did not. The fingerprints in the table above were
re-taken by reading the bytes in-process, with no shell in the path. Recorded because a false zero
that agrees with a plausible expectation is the failure mode this whole phase exists to eliminate.

### Cold-versus-warm, settled empirically (D-06)

`run.json` is the ground truth of what the run actually hashed, so it settles this without relying
on the capture instrument's own graph-state reading.

| Target | `run.json` hash | == `11-hashes-cold.json` | == `11-hashes-warm.json` |
|---|---|---|---|
| `build` | `17269409342684722256` | YES | YES |
| `typecheck` | `122473981802582055` | YES | YES |
| `test` | `11681410932071446589` | YES | YES |
| `integration` | `8137422034373911537` | YES | YES |

The warm record was captured at `graphState: warm` with 18 `.nx/workspace-data` entries; the cold
record at `graphState: cold` with 0. **The run matched BOTH sets on all four targets**, because
11-02 already measured cold == warm; `run.json` now confirms it a third time from Nx's own
arithmetic during the measured run itself. All four are also PRESENT in the warm
`cache-mirror-202607` shard (release id `354838660`), which is what made a MISS attributable IN
ADVANCE and is why D-07 never fired.

### The shard the bytes came from

| Target | Hash | In `cache-mirror-202607` | `created_at` | `label` |
|---|---|---|---|---|
| `build` | `17269409342684722256` | PRESENT | 2026-07-29T16:44:31Z | `mirrored-by: linux` |
| `typecheck` | `122473981802582055` | PRESENT | 2026-07-29T16:44:32Z | `mirrored-by: linux` |
| `test` | `11681410932071446589` | PRESENT | 2026-07-29T16:44:30Z | `mirrored-by: linux` |
| `integration` | `8137422034373911537` | PRESENT | 2026-07-29T16:44:27Z | `mirrored-by: linux` |

Transcribed from plan 11-02's committed cross-check, which read the shard twice with
`gh api ... --paginate` (141 assets each read). **The `label` is a PUBLISHER, never a producer** --
see the D-14 retraction below. No raw REST payload is pasted anywhere in this record: payload fields
carry uploader identity, node ids and signed URLs, and this is a public repository (T-11-03).

Pagination is load-bearing rather than defensive, and plan 11-02 MEASURED it rather than inferring
it: the same endpoint read WITHOUT `--paginate` returns 30 of 141 assets with **zero** `nx-cache-`
names, which would have reported every one of these four hashes ABSENT and manufactured a false
D-07 finding. Cited here rather than re-derived.

---

## O2 (XOS-02)

**PROVEN.** The same single cold run HIT `integration` from a Windows-CI-produced artifact:

```
> nx run @op-nx/github-cache:integration  [remote cache]
```

| Quantity | Pre-registered | Observed | Verdict |
|---|---|---|---|
| Occurrences of the literal `[remote cache]` for `integration` | exactly 1 | **1** | **MET** |
| `run.json` `cacheStatus` for `integration` | `remote-cache-hit` | **`remote-cache-hit`** | **MET** |
| `integration` hash | `8137422034373911537` | `8137422034373911537` | matches both capture records |
| Producer fingerprint in the restored artifact | a Windows runner path | `C:/a/github-cache/github-cache/packages/github-cache` | **WINDOWS producer** |

The fingerprint is what makes this O2 rather than merely "a hit": `integration` is the
OS-SENSITIVE target, its hash is computed from a runtime `process.platform` discriminator, and the
artifact this Windows box consumed was demonstrably produced on a Windows CI runner.

### The non-regression comparison against BOTH halves of the pre-rename baseline (D-09)

Neither half alone is the baseline. Each answers a DIFFERENT question, and the comparison is
therefore stated as two rows with the question named, not collapsed into one "before".

| Baseline half | What it is | WHICH QUESTION it answers | Its limit |
|---|---|---|---|
| The fresh pre-rename READ-PATH baseline at `06019d4` (`10-EVIDENCE-PRE-RENAME.md`): HTTP **200**, **410 bytes** on the `13758457399293023985-windows` asset | a direct authed GET through the sidecar, on this machine, in that session | **Does the local Windows reader RESOLVE a Windows-CI-produced mirror asset?** YES | It does **NOT** establish Nx CONSUMPTION. A 200 on a direct probe says the reader reaches the mirror; it says nothing about whether Nx's client accepts and replays the bytes |
| The 2026-07-26 Nx-level `[remote cache]` HIT at `bfd5143` (`260725-w3s-STEP0-RESULTS.md`) | the only Nx-level pre-rename HIT there will ever be, on `integration`, from a Windows-CI-produced asset | **Does Nx CONSUME a mirror-served Windows artifact end to end?** YES | It **predates Phase 9's `@actions/cache` version rotation**, so citing it alone would leave this comparison straddling TWO changes (the version rotation AND the CORR-02 rename) instead of one |

**Non-regression verdict: CONFIRMED, not rescued.** Post-rename, under the OS-free
`nx-cache-<hash>` asset name, both halves' properties hold simultaneously in ONE observation: the
reader resolved a Windows-produced asset AND Nx consumed it end to end, evidenced by the literal
`[remote cache]` label, `cacheStatus: remote-cache-hit`, and a Windows runner path inside the
replayed bytes. The pre-rename baseline needed two separate records to say that much; this one
observation says both.

---

## TEST-08 graph premise

Transcribed from plan 11-01's committed record `11-task-graph-premise.json` (captured
2026-07-29T20:51:08Z at commit `7d90907`), NOT re-derived here and NOT re-run to produce a second
record at a different commit.

| Field | Value |
|---|---|
| `verdict` | **`PREMISE OK`** |
| `forbiddenTargets` | `build`, `typecheck`, `test` |
| Resolved task-id set for the Windows leg's ACTUAL command, `nx run-many -t integration` | `@op-nx/github-cache:integration` -- **1 member, no forbidden member** |
| D-13 negative control, `nx run-many -t typecheck` | `@op-nx/github-cache:build`, `@op-nx/github-cache:typecheck` -- **2 members, one of them the FORBIDDEN member `build`** |

The premise is a property of the **CURRENT RESOLVED GRAPH**, not of the config -- which is TEST-08's
own distinction. Two consequences of that framing, stated here so a later reader does not mistake
either for an oversight:

- `integration`'s `dependsOn: ["^build"]` resolves to **zero extra tasks only because this is a
  single-project workspace**. `^` means *dependencies'* build, and there are none. Add a second
  project and the premise must be re-asserted, not assumed.
- The `typecheck` CI job **already touches the `build` hash as a dependency**, via an inferred
  `dependsOn: ["build", "^typecheck"]`. That is exactly why the control resolves two tasks and why
  its intersection with the forbidden set makes the absence over the `integration` set meaningful.

The control was chosen as `typecheck` rather than `test` deliberately: `test`'s `dependsOn` is
`^build`, so it resolves ONE task and would clear bare vacuity without ever demonstrating that the
resolver expands `dependsOn` at all. A resolver that resolved nothing would satisfy every absence
assertion simultaneously -- Phase 7's `filterUsingGlobPatterns` lesson recurring.

**Why this section is load-bearing for O1 specifically.** `build` and `typecheck` have no per-hit
runner-path fingerprint (their `tsc` artifacts carry no absolute path). Their attribution rests on
this premise: Windows CI resolves no `build`, `typecheck` or `test` task, therefore any such hash in
the store is Linux-produced. The premise is valid because it was ASSERTED mechanically, not
assumed -- and `test`, which DOES carry a fingerprint, independently corroborates it by reading
`/home/runner/...`.

---

## D-14 retraction: `mirrored-by` cannot attribute a producer

**`mirrored-by: <os>` is the PUBLISHING leg's OS. It CANNOT answer "whose bytes did the developer
get".** Any artifact, comment or doc line claiming otherwise is RETRACTED repo-wide and must not
reappear.

**The live instance, not a hypothetical.** `10-EVIDENCE-LIVE-CI.md` records the
Windows-PRODUCED `integration` hash **`8137422034373911537`** sitting in the
`cache-mirror-202607` shard stamped **`mirrored-by: linux`**. The cause is structural: Phase 9's
`enableCrossOsArchive` lets the ubuntu publish leg restore a Windows-produced entry and then stamp
its own OS on the mirrored asset. This record's own O2 half is measured against that exact hash,
and its Windows producer is established by the runner path INSIDE the artifact -- while its label
reads `linux`. The two disagree, and the label is the one that is wrong about production.

**The REPLACEMENT means, supplied rather than merely deleting the wrong claim.** Correcting a claim
requires giving a reader something to use instead, or the correction leaves them holding a
documented argument for undoing the work. Producer attribution is established by four independent
means, of which this record supplies two directly:

| Means | What it establishes | Its limit | Supplied here? |
|---|---|---|---|
| D-12's graph premise | Windows CI resolves no `build`/`typecheck`/`test` task, so any such hash in the store is Linux-produced | structural -- valid only because it is ASSERTED, not assumed | YES, transcribed above |
| The replayed artifact's `terminalOutput` runner path (`/home/runner/...` vs `C:/a/...`) | a per-hit, byte-level producer fingerprint INSIDE the served artifact | readable only after a HIT | YES, for `test` and `integration` |
| Actions-cache entry list plus shard asset list with `created_at` and the OBS-03 label per asset, cross-referenced against job windows | bounds WHEN each entry could have been written | timing, not identity | Cited from 11-02 and 09-EVIDENCE.md's D-34 snapshot |
| Recompute the hash on a known platform and match | established the producer live in `10-EVIDENCE-LIVE-CI.md` | works only for OS-SENSITIVE targets, so it serves O2 and never O1 | Cited |

What NOTHING answers, and this is the honest shape of the retraction: the mirror carries no field
that names the PRODUCING leg. That claim is retracted rather than relocated.

---

## O3 (XOS-03, TEST-09) -- PENDING

**Owner: plan 11-07.** This section's shape is fixed HERE, before the run, so it is not invented
after it. O3 is proven as an Nx-HASH property, never as a storage probe: with the version now
OS-invariant, a storage-level probe for the Linux hash from a Windows runner would HIT, and
asserting a 404 there would assert a property this milestone deliberately destroyed.

The three parts TEST-09 requires, each to be filled by 11-07:

1. **CITE** CORR-03(b)'s build-gating record that `H_linux != H_win` for `integration` at the
   commit. Phase 11 CITES it and does not re-derive it. `PROBE-RESULTS.md` Q3
   (`8865876519165210738` vs `1822904335635353663` at `fe25a3f`) is the corroborating prior, also
   cited rather than re-taken.
2. **SHOW** the Windows `integration` task EXECUTED, carrying no `[remote cache]` label, in a run
   where `nx-cache-<H_linux>` demonstrably existed in the Actions cache at the time. The existence
   half is the `o3-witness` job's post-hoc inequality
   `floor(epoch(created_at)) + 30s <= epoch(started_at)`, with the entry matched by EXACT key
   equality rather than `total_count > 0` (the `?key=` filter is a PREFIX match). The
   absence-of-label observation is **RECORDED, never GATED**: it is false on a correct re-run at the
   same commit, and a tripwire that fires on correct work gets disabled.
3. **A POSITIVE CONTROL in the same job** -- an authed GET on the leg's OWN just-saved
   `nx-cache-<H_win>` returning exactly **200** through the same sidecar and backend, taken AFTER
   the task ran, so part 2 is not an artifact of a dead sidecar. A run that MISSes everything is not
   a valid proof.

Also to be recorded by 11-07: the run URL, and both `ACTIONS_STEP_DEBUG` timestamps (on before the
proving push, off after), since restore MISSes log at `core.debug` and are otherwise absent from the
log.

---

## O4 (XOS-04, XOS-05) -- RESERVED

**Do not fill this section and do not delete it.** Phase 12 appends the O4 row to THIS record --
TEST-08's own words: "Phase 12 appends the O4 row to the same evidence record". O4 in every form
(the Windows `build`/`typecheck`/`test` legs, their HIT, the `needs:` producer-to-consumer ordering,
and the write decision) is out of Phase 11's scope and is gated on XOS-01 being PROVEN here.

**Why this section exists as a reservation rather than as work:** enabling O4 makes Windows CI a
**second producer** of the `build`, `typecheck` and `test` hashes, which **permanently destroys
O1's producer attribution**. Once a Windows leg can write those hashes, "any such hash in the store
is Linux-produced" is false, the graph premise transcribed above no longer holds, and no future
session can re-derive what this record captured. That is precisely why the fingerprint capture above
happened in this session, at proof time, and why TEST-08 closes the attribution window at Phase 9
rather than at Phase 12.

Consequence carried forward for Phase 12: TRUST-11's residual risk moves into the XOS-05 write
decision, and if the Windows legs write, the attribution loss is appended to Phase 10's
threat-model record.

---

## What remains unobservable

- **PARITY-04's "does my EVERYDAY box hit".** The reset forces the COLD state, so this session
  answers the cold question only. Named, deliberately not closed. 11-02's cold == warm result is
  the data a later phase would need, recorded as a finding rather than promoted to a proof.
- **Which leg PRODUCED a mirrored asset, from mirror metadata alone.** Retracted above, not
  relocated. The mirror has no such field. Attribution needs the graph premise or an in-artifact
  runner path.
- **A per-hit fingerprint for `build` and `typecheck`.** Their `tsc` artifacts carry no absolute
  path. This is a property of what `tsc` prints, not a defect, and the graph premise covers their
  attribution structurally.
- **O3 and O4.** Pending and reserved respectively, above.
- **macOS in any form.** `cachePlatform` maps `darwin -> macos` and is unit-pinned, but no macOS
  runner or developer read exists.
- **Whether a warm-graph local box hits these same hashes.** Not measured here; the reset removed
  the opportunity by design.

---

## Recorded deviation: the plan's aggregate `dist/` mtime check failed, and the session continued

Recorded with its HEADING naming it a deviation, and its reasons numbered, following
`10-EVIDENCE-PRE-RENAME.md`'s deviation-section shape. Not recorded silently, and not omitted.

The plan instructs: "If the mtime check fails, STOP and record it as a finding." The check failed
(see the `dist/` currency subsection under O1 for the measured numbers). The session continued
rather than stopping. Reasons:

1. **The failing check is a crude proxy for the real question, and it failed on files whose content
   did not change.** Newest-mtime-under-`src` versus newest-mtime-under-`dist` is defeated by any
   later touch that rewrites no bytes. The working tree is clean, so every source's content equals
   HEAD's.
2. **Three stronger read-only checks all answered the real question affirmatively** -- pairwise
   per-file comparison, content provenance from git for each exception, and direct inspection
   confirming the emitted `dist/lib/release-asset-name.js` carries `77f675c`'s post-CORR-02 OS-free
   form with the pre-CORR-02 form genuinely absent. The 17 modules reachable from `dist/serve.js`
   were enumerated and checked.
3. **The plan itself names an independent argument that covers this**, and it holds: `typecheck`
   hashes `dist/` declaration outputs via `dependentTasksOutputFiles`, and the local `typecheck`
   hash equals the one CI saved.
4. **Stopping would have forfeited an irreplaceable measurement window** for a proxy failure whose
   subject was, on stronger evidence, sound. Plans 11-05 and 11-06 rotate three of the four hashes,
   and the mirror expires around 2026-08-28.
5. **The prohibited response was not taken.** No rebuild was run. The plan's reason for forbidding
   one holds regardless of the check's verdict: a rebuild moves `typecheck`'s input hash mid-session.

**What a reader should take from this:** the currency claim in this record rests on the three
content-level checks, NOT on the plan's aggregate mtime comparison, which is reported as FAILED
above. If a future reader needs the aggregate form to pass, `dist/` must be rebuilt at a commit
where doing so costs nothing -- never inside a measurement window.

**No COLD-DIRECTORY deviation exists.** Plan 11-02's blocking checkpoint was resolved by the
maintainer as `literal-reset` -- D-05's locked choice, TEST-10's named mechanism in TEST-10's named
order (reset FIRST, sidecar after). The Phase 10 COLD-DIRECTORY variant was offered with its
reasons and was NOT taken, so this record carries none of its baggage and no partial-redirection
caveat.

---

## Provenance

| Fact | Value |
|---|---|
| Commit | `2628921` |
| Branch | `gsd/v0.0.2-os-invariant-cross-os-sharing` (unmerged) |
| Tree | MAIN tree, not a git worktree (no junctioned `node_modules`) |
| Node | v24.13.0 |
| Nx | 23.1.0 |
| Vitest | 4.1.10 |
| Platform | win32, arm64 |
| Sidecar | `node packages/github-cache/dist/serve.js`, bound `http://127.0.0.1:41999`, read from its own stdout |
| Backend selected | off-CI branch, `createReleasesReadBackend(createReleasesReadClient(env))`, proven by `isWriteTrusted(...).trusted === false` read from the built `dist/lib/trust.js` |
| Asset naming in effect | OS-free `nx-cache-<hash>` (post-CORR-02) |
| Shard read | `cache-mirror-202607`, release id `354838660` |
| Probe completed (UTC) | `2026-07-29T21:44:03Z` -- PRECEDING the first Nx run |
| First Nx run started (UTC) | `2026-07-29T21:44:28.096Z` |
| First Nx run ended (UTC) | `2026-07-29T21:44:31.930Z` |
| Nx invocations in this session | exactly ONE, the measurement itself |
| `.nx/cache` state before the run | ABSENT (cleared by `npx nx reset` in plan 11-02) |
| Sidecar stderr across the whole session | 0 bytes |
| Teardown | listening PID stopped; no process listening on 41999; `curl` exit 7 |
| Source files changed by this capture | **none** (`git status --porcelain packages/ .github/ start-cache-server/` printed nothing; the full `git status --porcelain` was empty) |
| Secret hygiene | the `gh auth token` result is recorded as a LENGTH only; the throwaway bearer is session-scoped and appears in no committed file; no raw REST payload is pasted |
| Corroborating priors | `10-EVIDENCE-PRE-RENAME.md` (`06019d4`), `260725-w3s-STEP0-RESULTS.md` (2026-07-26, `bfd5143`), `11-task-graph-premise.json` (`7d90907`), `11-hashes-warm.json` / `11-hashes-cold.json` (11-02) |
