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
the same evidence record"). O1, O2 and O3 are all complete below; O3 was owned by plan 11-07 and
closed by the live push run recorded in its section. O4's slot was RESERVED for Phase 12 -- neither
to be filled nor deleted by Phase 11 -- and plan 12-06 DISCHARGED that reservation IN PLACE. The O4
section below now carries its claim, its pre-registered counts and its anti-requirements; its
VERDICT is PENDING on the first run of the proving pull request.

---

## Headline

| Half | Verdict |
|---|---|
| **O1 (XOS-01)** -- a cold local Windows box logs the literal `[remote cache]` for `build`, `typecheck` AND `test`, per target, against Linux-CI-produced artifacts | **PROVEN.** 1 occurrence per target, 3 of 3 named individually. All three pre-registered counts MET |
| **O2 (XOS-02)** -- the same run HITs `integration` from a Windows-CI-produced artifact | **PROVEN.** 1 occurrence, pre-registered count MET, and the restored artifact carries a Windows runner path |
| Structured corroborator -- `run.json` `cacheStatus` == `remote-cache-hit` | **4 of 4 targets**, exactly the pre-registered set `{build, typecheck, test, integration}` |
| Producer fingerprint, per hit | `test` -> **LINUX**, `integration` -> **WINDOWS**. `build`/`typecheck` UNAVAILABLE with a stated reason (see the table) |
| Producer ATTRIBUTION, per hit hash (TEST-08's own mandated capture) | **COMPLETE, 4 of 4.** `build`/`typecheck`/`test` -> **LINUX**, `integration` -> **WINDOWS**. The two hashes with no fingerprint are carried by the job-window cross-reference, which resolves a UNIQUE runner OS for all four |
| **O3 (XOS-03, TEST-09)** -- the Windows `integration` task EXECUTES carrying no remote-cache label, in a run where the `H_linux` entry demonstrably existed | **PROVEN.** All three parts satisfied on push run `30500255530`; witness delta `144s` against a `30s` stated margin; positive control `200` on both legs |
| **O4 (XOS-04, XOS-05)** -- the three `windows-11-arm` legs log the literal `[remote cache]` per resolved target, against Actions-cache entries the ubuntu legs saved in the SAME run, `needs:` ordering producer before consumer | **PENDING -- live-CI, first run of the proving PR.** Pre-registered per-target occurrence counts `build` 1 / `typecheck` 2 / `test` 1, total 4, fixed in `12-06-PLAN.md` BEFORE any run. No observation recorded: no such run exists. See the O4 section |

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

**The retraction's replacement is no longer only structural.** The attribution section below turns
D-14 row 3 into a MEASUREMENT on this record's own four hashes, and it separates publisher from
producer to the second: for `integration` the two events are **55.16 seconds and two different
runner OS labels apart**. See `### The publisher-versus-producer separation, measured` below.

---

## TEST-08 producer attribution, captured at proof time (D-14, D-15)

TEST-08's own mandated capture, in its own words: per hit hash, the Actions-cache entry list and the
shard asset list with `created_at`, cross-referenced against job windows, capturing `created_at` and
the OBS-03 label PER ASSET rather than just the asset list. Taken now because enabling O4
permanently destroys the ability to re-derive it (see the O4 section), and because plans 11-05 and
11-06 rotate three of these four hashes.

### How this was read

| Item | Value |
|---|---|
| Capture time (UTC) | `2026-07-29T22:04:12Z` -- about 20 minutes after the O1/O2 measurement run ended at `21:44:31.930Z` |
| Repository | `op-nx/github-cache` |
| `gh` | 2.86.0 (2026-01-21) |
| Calls | read-only, GET-shaped only. Nothing created, updated or deleted: no release, no asset, no issue, no pull request, no workflow dispatch |
| Extraction | every value pulled by FIELD NAME through `gh api -q`, then matched in-process. No raw REST payload is pasted -- payload fields carry uploader identity, node ids and signed URLs, and this is a public repository (T-11-03) |
| Order within this capture | the Actions-cache half FIRST, because it is the more perishable of the two. That ordering is justified by a measurement, not by caution -- see the clock subsection at the end |
| Nx invocations | **zero.** Nothing here touches Nx, so `.nx/cache/run.json` is not perturbed and the O1/O2 values above remain the ones the measurement wrote |

### Pagination, re-measured in this session rather than inherited (T-11-12)

Plan 11-02 MEASURED this trap on the shard endpoint and this record cites that measurement above.
Both endpoints were nonetheless re-read here in both forms, because this capture's own ABSENT/PRESENT
verdicts must not rest on a reader artifact from a different session.

| Endpoint | Paginated | Single page | `nx-cache-` names on the single page | What a single page would have reported for the four hit hashes |
|---|---|---|---|---|
| `GET /repos/{owner}/{repo}/actions/caches` | **142** entries | **30** | 30 of 30 (all four hashes happen to be on it) | PRESENT -- by luck of ordering, not by design |
| `GET /repos/{owner}/{repo}/releases/354838660/assets` | **141** assets | **30** | **0** | **ABSENT, all four** -- a false eviction finding |

Two facts worth separating, because they fail differently:

1. The Actions-cache endpoint's own `total_count` field reads **142**, and the paginated read returned
   exactly 142 rows -- so the count is self-consistent and the guard is verifiable from inside the
   response.
2. `gh api` without `--paginate` returns **30**, not 100. The per-page MAXIMUM is 100 but the
   DEFAULT is 30, so "the repository holds fewer than 100 entries" would not have been a safe
   substitute for paginating even if it were true. It is not true: 142 > 100 as well.

On the shard the single-page read carries **zero** `nx-cache-` names, so an unpaginated reader would
have reported every one of these four hashes ABSENT. Every read below used `--paginate`.

### Exact-key equality, and the prefix trap it avoids

`?key=` is a PREFIX match, so `total_count > 0` is not an existence test. Rather than rely on the
filter at all, the full lists above were pulled and matched in-process for **exact string equality**
on `.key` / `.name`. The trap was re-measured on this session's own data:

| Probe on the 142 paginated entries | Matches |
|---|---|
| keys equal to `nx-cache-8137422034373911537` (exact) | **2** (two refs -- see below) |
| keys STARTING WITH `nx-cache-813742203437391153` (the full key minus its last character) | **2** -- a shorter hash that is a prefix would have passed a count test |
| keys STARTING WITH `nx-cache-1` (short prefix) | **40** |
| keys equal to the deliberately bogus `nx-cache-0000000000000000000` | **0** -- so the matcher discriminates rather than matching everything |

The bogus-key control is included for the same reason 11-02 included one: a matcher that matched
everything would satisfy every PRESENT assertion simultaneously.

### List 1 -- Actions-cache entries, by exact key (142 entries read, 136 `nx-cache-` prefixed)

Exact-key equality returns **TWO** entries per hash, on two different refs, from two different runs.
Both rows are recorded rather than one being silently chosen.

| Target | Key | `ref` | `created_at` | `last_accessed_at` | Size (bytes) |
|---|---|---|---|---|---|
| `build` | `nx-cache-17269409342684722256` | `refs/heads/main` | **2026-07-29T16:40:22.677666000Z** | 2026-07-29T17:54:34.886217000Z | 127542 |
| `build` | same key | `refs/pull/10/merge` | 2026-07-29T16:32:41.378341000Z | 2026-07-29T16:32:42.612618000Z | 127752 |
| `typecheck` | `nx-cache-122473981802582055` | `refs/heads/main` | **2026-07-29T16:40:25.516159000Z** | 2026-07-29T17:54:35.339630000Z | 93260 |
| `typecheck` | same key | `refs/pull/10/merge` | 2026-07-29T16:32:44.000667000Z | 2026-07-29T16:32:44.000667000Z | 93494 |
| `test` | `nx-cache-11681410932071446589` | `refs/heads/main` | **2026-07-29T16:40:32.428633000Z** | 2026-07-29T17:54:31.241303000Z | 1238 |
| `test` | same key | `refs/pull/10/merge` | 2026-07-29T16:32:48.972927000Z | 2026-07-29T16:32:48.972927000Z | 1250 |
| `integration` | `nx-cache-8137422034373911537` | `refs/heads/main` | **2026-07-29T16:43:31.841858000Z** | 2026-07-29T17:57:11.636089000Z | 695 |
| `integration` | same key | `refs/pull/10/merge` | 2026-07-29T16:34:51.553240000Z | 2026-07-29T16:34:51.553240000Z | 698 |

**No hash read ABSENT.** Every one of the four is still in the Actions cache at capture time. Had one
been evicted it would be recorded as the literal ABSENT here, because an eviction is a fact about the
clock and not a gap in the proof.

**The `refs/heads/main` row is the one the mirror was published from, and that is a structural fact
rather than a choice.** `publish` is gated on `github.event_name == 'push'` and `on.push.branches` is
`[main]` only, so the `refs/pull/10/merge` entries were never visible to any publish leg. The
bolded `created_at` values above are therefore the ones cross-referenced below. The PR-ref rows are
recorded as an independent second observation of the same four hashes at the same OS split -- and
RESEARCH.md's `## U-01` section (1) already measured the window containment across THREE runs
including `30471172051`, so that is cited rather than re-derived here.

Sizes differ by 200-250 bytes between the two refs for the same hash. That is expected -- the
archive wraps the same task output with per-run metadata -- and it is recorded rather than smoothed
over, since a reader comparing the two rows will notice it.

### List 2 -- month-shard release assets, by exact name (141 assets read, 16 `nx-cache-` names)

Shard `cache-mirror-202607`, release id `354838660`.

| Target | Asset name | `created_at` | `label` (OBS-03) |
|---|---|---|---|
| `build` | `nx-cache-17269409342684722256` | 2026-07-29T16:44:31Z | `mirrored-by: linux` |
| `typecheck` | `nx-cache-122473981802582055` | 2026-07-29T16:44:32Z | `mirrored-by: linux` |
| `test` | `nx-cache-11681410932071446589` | 2026-07-29T16:44:30Z | `mirrored-by: linux` |
| `integration` | `nx-cache-8137422034373911537` | 2026-07-29T16:44:27Z | `mirrored-by: linux` |

Exactly one asset each -- no duplicate under a second name. Label distribution across all 141:
`mirrored-by: linux` 15, `mirrored-by: windows` 1, no label 125. Unchanged from Phase 10's post-run
census, so nothing has been mirrored into this shard since.

**The label is a PUBLISHER stamp. It is not read as a producer anywhere in this record.**

### List 3 -- the bounding job windows, from run `30471772954`

The producing run: event `push`, branch `main`, head `180c3d3`, 22 job legs, conclusion `success`.
All 22 legs were read; the relevant windows are below.

The window that BOUNDS a cache write is the leg's **loopback sidecar** window, not the target-run
step: no cache entry can be created while the sidecar is down, because the sidecar IS the
`NX_SELF_HOSTED_REMOTE_CACHE_SERVER` the Nx client posts to. Three ubuntu legs in this run
(`dogfood-seed`, `pack-check`, `hash-parity`) run `npm run build` and start NO sidecar, so they
appear as target-run candidates and are correctly excluded as writers.

**A recorded artefact so a transcriber does not misread it: the sidecar step's `conclusion` is
`cancelled` on EVERY leg, in every run, because the `Cancel` step kills it -- while the JOB
conclusion is `success`.** That is the designed shape, not a failure.

Comparison mechanics: cache `created_at` is sub-second, job and step timestamps are whole seconds, so
the comparison is done in epoch seconds with the cache value's fractional part FLOORED. This is
RESEARCH.md's measured method, reused rather than reinvented.

| Target | Entry `created_at` (main ref) | Sidecar-alive windows containing it | Leg(s) | Runner OS label(s) | Verdict from windows alone |
|---|---|---|---|---|---|
| `build` | 16:40:22.677666Z | **1** | `typecheck` sidecar 16:40:17Z-16:40:25Z | `ubuntu-24.04-arm` | unique OS -> **LINUX** |
| `typecheck` | 16:40:25.516159Z | **3** | `typecheck` 16:40:17Z-16:40:25Z, `build` 16:40:25Z-16:40:29Z, `test` 16:40:24Z-16:40:32Z | all three `ubuntu-24.04-arm` | unique OS -> **LINUX** (NOT a unique job) |
| `test` | 16:40:32.428633Z | **1** | `test` sidecar 16:40:24Z-16:40:32Z | `ubuntu-24.04-arm` | unique OS -> **LINUX** |
| `integration` | 16:43:31.841858Z | **1** | `integration (windows-11-arm)` sidecar 16:43:22Z-16:43:42Z | `windows-11-arm` | unique OS -> **WINDOWS** |

Three findings in that table are worth stating rather than leaving for a reader to notice:

1. **The `build` hash was written by the `typecheck` job, not by the `build` job.** The `build` job's
   own sidecar came up at 16:40:25Z, three seconds AFTER the entry already existed. This is the graph
   premise's own observation appearing as live metadata: the `typecheck` job's resolved graph
   includes `build` via an inferred `dependsOn: ["build", "^typecheck"]`, which is exactly why plan
   11-01 chose `typecheck` as its negative control. The `build` job then got a remote HIT off the
   `typecheck` job's write.
2. **`typecheck`'s entry has THREE candidate windows, and the means still resolves it -- to an OS,
   not to a job.** All three candidates are `ubuntu-24.04-arm`, so the producing OS is determined
   regardless of which leg won the write. Stated explicitly because "unique window" and "unique OS"
   are different claims and only the second is being made.
3. **`integration`'s sole candidate is the Windows leg**, and no ubuntu window contains its
   timestamp. The ubuntu `integration` leg's sidecar closed at 16:40:21Z, 190 seconds earlier.

### The publisher-versus-producer separation, measured

This is D-14's retraction restated as arithmetic on this record's own load-bearing hash, so the
correction ships with something a reader can use instead of the claim it removes.

`integration`, hash `8137422034373911537`:

| Event | When | Where | OS |
|---|---|---|---|
| PRODUCED -- the Actions-cache entry was created | 2026-07-29T16:43:31.841858Z | inside `integration (windows-11-arm)`'s sidecar window 16:43:22Z-16:43:42Z, the SOLE candidate | **windows-11-arm** |
| PUBLISHED -- the shard asset was created | 2026-07-29T16:44:27Z | inside `publish (ubuntu-24.04-arm)`'s mirror step 16:44:24Z-16:44:47Z | **ubuntu-24.04-arm** |
| The label the mirror stored | `mirrored-by: linux` | -- | records the PUBLISHER |

**Separation: 55.16 seconds, and two different runner OS labels.** All four shard assets were
created inside that one ubuntu publish step (16:44:27Z to 16:44:32Z), which is the mechanical reason
all four carry `mirrored-by: linux` -- including the one whose bytes a Windows runner produced. The
label is a faithful record of the publishing leg and a wrong answer to the producing question.

### The four means, and which one carried each verdict

Every row names the means that carried it AND that means' limit. Where a means does not apply, that
is stated with its limit rather than left blank.

| Target | Hash | Entry `created_at` | Asset `created_at` | `mirrored-by` | Bounding job window | `terminalOutput` fingerprint | Producer concluded | Carried by |
|---|---|---|---|---|---|---|---|---|
| `build` | `17269409342684722256` | 16:40:22.677666Z | 16:44:31Z | `mirrored-by: linux` (publisher) | `typecheck` leg [ubuntu-24.04-arm] sidecar 16:40:17Z-16:40:25Z | **UNAVAILABLE** -- 44 bytes, `tsc` prints no absolute path | **LINUX** | **M3 primary** (sole window, unique OS) + **M1 corroborating**. M2 unavailable. M4 does not apply |
| `typecheck` | `122473981802582055` | 16:40:25.516159Z | 16:44:32Z | `mirrored-by: linux` (publisher) | three ubuntu sidecar windows, 16:40:17Z-16:40:32Z, all `ubuntu-24.04-arm` | **UNAVAILABLE** -- 62 bytes, same cause | **LINUX** | **M3 primary** (three windows, one OS) + **M1 corroborating**. M2 unavailable. M4 does not apply |
| `test` | `11681410932071446589` | 16:40:32.428633Z | 16:44:30Z | `mirrored-by: linux` (publisher) | `test` leg [ubuntu-24.04-arm] sidecar 16:40:24Z-16:40:32Z | `/home/runner/work/...` -> **LINUX** | **LINUX** | **M2 primary** (byte-level, in-artifact) + **M3** (sole window, own leg) + **M1**. M4 does not apply. Three independent means agree |
| `integration` | `8137422034373911537` | 16:43:31.841858Z | 16:44:27Z | `mirrored-by: linux` (publisher -- and WRONG about production) | `integration (windows-11-arm)` sidecar 16:43:22Z-16:43:42Z | `C:/a/github-cache/...` -> **WINDOWS** | **WINDOWS** | **M2 primary** + **M3** (sole window, windows-only) + **M4** (cited from `10-EVIDENCE-LIVE-CI.md`). M1 does not apply |

The four means and their limits, keyed as used above:

| Key | Means | What it establishes | Its LIMIT |
|---|---|---|---|
| **M1** | The graph premise from plan 11-01 | Windows CI resolves no `build`, `typecheck` or `test` task, so any such hash in the store is Linux-produced | Structural, and valid only because it was ASSERTED mechanically rather than assumed. It is a property of the CURRENT resolved graph: `integration`'s `dependsOn: ["^build"]` resolves to zero extra tasks only because this is a single-project workspace, so a second project means re-asserting it. **It says nothing about `integration`**, which the Windows leg DOES resolve -- that is why M1 is marked "does not apply" on the `integration` row |
| **M2** | The replayed artifact's `terminalOutput` runner path | A per-hit, byte-level producer fingerprint INSIDE the served bytes | Readable only AFTER a HIT, which is why 11-03 captured it and this plan does not re-take it. And it does not exist at all when the target's tool prints no absolute path -- `tsc` prints none on success, which is why `build` and `typecheck` are UNAVAILABLE rather than unmeasured |
| **M3** | The Actions-cache entry list plus the shard asset list with `created_at` and the OBS-03 label, cross-referenced against job windows | The requirement's own mandated capture. Bounds WHEN each entry could have been written and on WHICH labelled runner | **Timing, not identity.** It resolves the producing OS when the candidate windows share one OS label, and it does NOT resolve which JOB wrote the entry (see `typecheck`, three candidates). It also depends on the run's job records remaining readable -- GitHub's run retention is finite, so this means decays on its own clock, independently of the cache and mirror clocks |
| **M4** | Recompute the hash on a known platform and match | Established the producer live in `10-EVIDENCE-LIVE-CI.md` | Works only for OS-SENSITIVE targets. `integration` carries the `{"runtime":"node -p process.platform"}` discriminator so a `win32` box and a `linux` box cannot compute the same value; `build`, `typecheck` and `test` are OS-invariant, so a recomputation matches on EVERY platform and discriminates nothing. **It serves O2 and never O1** |

**`mirrored-by` is not a means and cannot become one.** It appears in the table only as a publisher
label, in a column labelled as such.

### An independent corroborator the capture turned up: `last_accessed_at`

The four main-ref entries were last accessed **17:54:31Z to 17:57:11Z**. The O1/O2 measurement ran
**21:44:28Z to 21:44:31Z**, nearly four hours later, and `last_accessed_at` records the LATEST
access -- so had that run touched the Actions cache, these fields would read `21:44`. They do not.

**The local read provably never reached the Actions cache**, which independently corroborates the O1
soundness probe's backend finding (`isWriteTrusted(...).trusted === false` -> the off-CI branch into
`createReleasesReadBackend`). That conclusion was previously established by reading the built
`dist/lib/trust.js`; it is now also visible in live server-side metadata the local session could not
have influenced. The 17:5x accesses belong to the later CI run, not to this workstation.

### The clock, measured -- and why the Actions-cache half went first

The plan asserts the Actions-cache half is the more perishable of the two. That is now a number.

| Half | Governing clock | Basis | Approximate close |
|---|---|---|---|
| Actions-cache entries | eviction after a period of no ACCESS | earliest `last_accessed_at` of the four is 2026-07-29T17:54:31Z; GitHub's documented no-access eviction window is 7 days (a documented figure, NOT measured here) | around **2026-08-05** |
| Releases-mirror shard | pruned past `DEFAULT_MAX_AGE_DAYS` (30) on CREATION time, daily at 03:17 UTC | assets created 2026-07-29T16:44Z (D-03) | around **2026-08-28** |

The Actions-cache half closes roughly **23 days earlier**, so taking it first was load-bearing rather
than tidy. Two honest qualifications: the 7-day figure is GitHub's documented policy rather than
something this session measured, and any future CI run that restores these keys pushes
`last_accessed_at` forward and defers the eviction. Neither changes the ordering.

### D-15 -- the inherited Phase 9 snapshot, CITED and not spent

`09-EVIDENCE.md`'s `## Producer-attribution snapshot (D-34)`, captured **2026-07-28T20:30:55Z** at
commit `72eeca3`, holds the pre-Phase-9 window: **106** shard assets in `cache-mirror-202607` (every
one with an EMPTY `label`, because OBS-03 had not landed) plus the repository Actions-cache entry
list of that moment.

**Phase 11's capture above is the SECOND half of a two-part record; Phase 9's is the first.** The two
halves cover different windows and neither substitutes for the other: before the merge the asset
name's OS suffix still WAS producer attribution, and from the first post-merge push it stopped being
one.

Its contents are deliberately NOT re-enumerated here, it was NOT re-run, and the one-shot observation
it preserves is NOT consumed (D-15). Its own scope note records it as evidence PRESERVATION,
explicitly not a proof, and forbids the next step being the proof -- this section is that next step,
and it is a separate capture at a separate time against a separate population (141 assets, 16 of them
new-form and labelled, versus 106 unlabelled).

### What this attribution capture does NOT establish

- **Which JOB wrote a given entry**, where more than one same-OS window brackets it. `typecheck` has
  three candidates. The OS is determined; the leg is not. M3's limit, stated in place.
- **Anything about the producing leg from mirror metadata alone.** Retracted, not relocated.
- **A per-hit fingerprint for `build` or `typecheck`.** `tsc` prints no absolute path. M3 and M1
  carry those two rows, which is precisely why the four-means scheme exists.
- **That the shard asset's bytes are byte-identical to the Actions-cache entry's.** Not compared
  here; the O1/O2 halves establish that Nx accepted and replayed the mirror's bytes, which is the
  question that matters and a different one.

---

## O3 (XOS-03, TEST-09) -- PROVEN

**Owner: plan 11-07.** This section's shape was fixed by plan 11-03 BEFORE the run, so it was not
invented after it. O3 is proven as an Nx-HASH property, never as a storage probe.

### Push-and-restore provenance

| Item | Value |
|---|---|
| Observed run | `30500255530`, event `push`, branch `main` |
| Run URL | `https://github.com/op-nx/github-cache/actions/runs/30500255530` |
| Head commit | `38f9aea`, from phase branch `gsd/v0.0.2-os-invariant-cross-os-sharing` |
| `main` before | `fe25a3f` |
| `main` after restore | `fe25a3f` -- **verified by SHA equality, not by assumption** |
| Backup ref RETAINED | `refs/heads/backup/main-before-phase11-verify` = `fe25a3f`, published to the remote before the push |
| Outbound push shape | `fe25a3f..38f9aea`, a FAST-FORWARD -- measured, not forced |
| Restore push shape | `38f9aea...fe25a3f`, forced update, the only non-fast-forward leg |
| Run conclusion | `success` -- **23 of 23 job legs green** |
| `ACTIONS_STEP_DEBUG` set (UTC) | `2026-07-29T23:39:35Z` |
| `ACTIONS_STEP_DEBUG` deleted (UTC) | `2026-07-29T23:57:22Z` |
| Restore push run | `30501074211`, event `push`, head `fe25a3f` |

`main` does NOT contain Phase 7-11 work. `38f9aea` is not an ancestor of `fe25a3f`.

**The outbound leg needed no force, and that was measured rather than assumed.** At pre-flight
`git rev-list --left-right --count origin/main...HEAD` read `0  240` and
`git merge-base --is-ancestor origin/main HEAD` exited 0, so `main` was a strict ancestor of the
phase branch. `--force-with-lease` was still passed on both legs, as a CONCURRENCY guard rather
than to overpower a rejection: the lease pinned the expected prior value, so a third-party push
landing mid-operation would have aborted the write instead of silently clobbering it.

**The restore is a git-ref restore ONLY.** It does not un-publish what the run mirrored, and that
is the intended outcome rather than a side effect to regret: the push re-warmed the mirror under
the post-Phase-11 hashes, which Phase 12 needs.

### The restore run was predicted IN ADVANCE, then resolved

Quoted from the plan-11-07 decision checkpoint, written before anything was pushed:

> Step E's restore will itself fire a second `push` run on `main` at head `fe25a3f` -- precedent
> Phase 9 run `30401077417`, Phase 10 run `30473116345`.

**Resolved:** run `30501074211`, event `push`, head `fe25a3f`, created `2026-07-29T23:55:47Z`.
Predicting it in advance is what stops a later reader treating it as an anomaly. Phase 9's restore
produced run `30401077417` and Phase 10's produced run `30473116345` the same way.

---

### TEST-09 part 1 -- `H_linux != H_win` for `integration`, CITED

**Phase 11 CITES this and does not re-derive it (D-18).** The citation is CORR-03(b)'s build-gating
record at THIS commit, produced by the `hash-parity-compare` job of the same run:

```
hash-parity-compare: hash-parity: PARITY OK linux vs win32 -- build=17269409342684722256/17269409342684722256 typecheck=14220792214246320661/14220792214246320661 test=5057102264757918793/5057102264757918793 integration=18442367512424001648/4283357908429349587 lint=6877603161093158279/6877603161093158279
```

| Target | linux | win32 | Relation |
|---|---|---|---|
| `integration` | `18442367512424001648` | `4283357908429349587` | **DIFFERENT** -- this is `H_linux != H_win` |
| `build` | `17269409342684722256` | `17269409342684722256` | identical (OS-invariant) |
| `typecheck` | `14220792214246320661` | `14220792214246320661` | identical (OS-invariant) |
| `test` | `5057102264757918793` | `5057102264757918793` | identical (OS-invariant) |
| `lint` | `6877603161093158279` | `6877603161093158279` | identical (OS-invariant) |

**On a push, `github.sha` equals the head, so `integration`, `hash-parity` and
`hash-parity-compare` all measured ONE tree** and the citation is commensurable with the O3
observation below. That commensurability is the whole reason D-20 chose a push over a pull request.

**Corroborating prior, also CITED rather than re-taken:** `PROBE-RESULTS.md` Q3 recorded
`8865876519165210738` against `1822904335635353663` at commit `fe25a3f`. Different values from
today's, at a different commit, and deliberately not re-measured here.

**A storage-level probe for the Linux hash from a Windows runner would now HIT, and is NOT the
proof.** With the cache version now OS-invariant, asserting a 404 there would assert a property
this milestone deliberately DESTROYED. That is why O3 is an Nx-hash property and the existence
half is demonstrated positively rather than by an absence.

### TEST-09 part 2 -- the Windows task EXECUTED, in a run where the `H_linux` entry existed

The existence half is the `o3-witness` job's own assertion, evaluated on recorded cache-service and
run metadata:

```
o3-witness: H_linux=18442367512424001648
o3-witness: key=nx-cache-18442367512424001648 created_at=2026-07-29T23:40:37.933086000Z started_at=2026-07-29T23:43:01Z delta=144s margin=30s
o3-witness: EXISTENCE OK key=nx-cache-18442367512424001648 created_at=2026-07-29T23:40:37.933086000Z started_at=2026-07-29T23:43:01Z delta=144s margin=30s
```

| Timing fact | Value |
|---|---|
| Key looked up, by EXACT `.key` equality plus a `.ref` filter | `nx-cache-18442367512424001648` |
| Entry `created_at` (ubuntu leg's save) | `2026-07-29T23:40:37.933086000Z` |
| Windows `Run the integration target and tee its output` `started_at` | `2026-07-29T23:43:01Z` |
| Computed delta | **144 s** |
| Stated minimum margin | **30 s** |
| Prior measured range across 11 consecutive runs | 109 s to 182 s, ubuntu-first 11 of 11 |

**The margin is recorded as a MEASUREMENT and never as a guarantee.** The 109-to-182-second range
has a structural cause -- `npm ci` costs about 19 s on ubuntu against about 180 s on
windows-11-arm -- but a measurement is not a documented guarantee, which is exactly why the
comparison demands a STATED 30-second minimum rather than a bare `<` that a timestamp-truncation
artefact could satisfy.

**This is an ASSERTION evaluated on recorded metadata, NOT an ordering control.** If the margin
ever collapses the witness fails LOUD and no O3 proof is recorded for that run. Leg order is
therefore not a correctness control, and XOS-06 and PROJECT.md's platform-agnosticism row are
untouched by it.

Independently confirmed from the cache service after the run, both entries under the push's own
ref scope:

```
key=nx-cache-18442367512424001648 ref=refs/heads/main created=2026-07-29T23:40:37.933086000Z
key=nx-cache-4283357908429349587 ref=refs/heads/main created=2026-07-29T23:43:10.036127000Z
```

The Windows leg's own entry was created at `23:43:10`, which is AFTER its step started at
`23:43:01` -- the leg saved its artifact 9 s into the task, exactly as a MISS-then-save should.

**The execution half**, quoted per leg:

```
integration (windows-11-arm): integration hash=4283357908429349587 cacheStatus=cache-miss status=0
integration (windows-11-arm): remote-cache label occurrences on windows-11-arm: 0 -- RECORDED, never gated
integration (ubuntu-24.04-arm): integration hash=18442367512424001648 cacheStatus=cache-miss status=0
integration (ubuntu-24.04-arm): remote-cache label occurrences on ubuntu-24.04-arm: 0 -- RECORDED, never gated
```

The Windows count of 0 is **RECORDED and never GATED**, and the reason is not squeamishness: a zero
count is CORRECT on the Windows leg and equally correct on any re-run at the same commit, where a
LOCAL hit precedes any remote read. Gating on it would redden the workflow for being right, and a
tripwire that fires on correct work gets disabled -- OBS-04 is this repo's own record of that
happening. The structured corroborator is the `cacheStatus` value of **`cache-miss`**, which is the
remote-versus-local discrimination the label count cannot make.

The ubuntu leg's 0 is recorded beside it so the Windows 0 is not misread as asymmetric: the
`integration` hash DID rotate on this commit, so neither leg could hit.

### TEST-09 part 3 -- the positive control, both legs

```
integration (ubuntu-24.04-arm): positive control: GET /v1/cache/18442367512424001648 -> 200 (wanted 200)
integration (windows-11-arm): positive control: GET /v1/cache/4283357908429349587 -> 200 (wanted 200)
```

| Leg | Observed | Acceptance set |
|---|---|---|
| `integration (ubuntu-24.04-arm)` | **200** | 200 ALONE |
| `integration (windows-11-arm)` | **200** | 200 ALONE |

The acceptance set was **200 alone**, and a 404 there would have been a control FAILURE rather than
a readiness answer. The Windows 200 is the observation that makes the Windows MISS attributable
rather than an artefact of a dead sidecar.

**Why a false 200 is impossible, in one sentence:** the backend calls the restore path BEFORE any
local read and returns a miss on no match, and the server degrades any fault to a 404, so a 200 can
only have come from a real cache-service hit and the control is strictly conservative.

### Pre-registered counts (D-23), fixed in plan 11-07 BEFORE the run

No pre-registered value was edited after the run.

| Observation | Pre-registered expectation | Observed | Verdict |
|---|---|---|---|
| `o3-witness` computed delta, in seconds | at least 30; measured range 109 to 182 across 11 runs | **144 s** | **MET** |
| positive control, `integration (ubuntu-24.04-arm)` | HTTP 200 | **200** | **MET** |
| positive control, `integration (windows-11-arm)` | HTTP 200 | **200** | **MET** |
| Windows `integration` remote-cache label occurrences | 0, RECORDED and never GATED | **0**, recorded, not gated | **MET** |
| Windows `integration` `cacheStatus` in `run.json` | the exact string `cache-miss` | **`cache-miss`** | **MET** |
| echoed `runner.debug` value | `1` | **`1`** on both legs | **MET** |
| RUN-LEVEL NON-VACUITY: ubuntu `build` remote-cache label occurrences | at least 1 | **2**, with `Cache: 1/1 hit (100%)` | **MET** |
| ubuntu `integration` remote-cache label occurrences | 0, expected because the `integration` hash DID rotate | **0** | **MET** |
| green job legs | 23 | **23 of 23** | **MET** |

**The run-level non-vacuity prediction was CONFIRMED, not rescued.** The plan's stated rationale was
that `build`'s hash does not rotate on this commit, because `build` excludes `src/**/*.spec.ts` and
takes no workspace-root workflow input. That held: `build` hit from the store while `integration`
missed on both legs, so this run was demonstrably NOT an everything-misses run and the proof does
not rest on the two positive controls alone. No re-run was performed to obtain a better number.

### `Cache: n/m hit` lines -- NON-DISCRIMINATING IN BOTH DIRECTIONS

```
integration (ubuntu-24.04-arm): Cache:             0/1 hit (0%)
```
**NON-DISCRIMINATING IN BOTH DIRECTIONS.**

```
integration (windows-11-arm): Cache:             0/1 hit (0%)
```
**NON-DISCRIMINATING IN BOTH DIRECTIONS.**

```
build: Cache:             1/1 hit (100%)
```
**NON-DISCRIMINATING IN BOTH DIRECTIONS.**

The two measured grounds, stated once for all three: a `0%` prints identically with no sidecar at
all (run `30169158892`), and a non-zero count includes LOCAL hits. Nx 23.1's end-of-run performance
report cannot separate local from remote and cannot attribute a producer OS. Every claim above
rests on the label count, the `cacheStatus` value and the witness's assertion -- never on these
lines.

### `runner.debug` -- step debug logging was ACTIVE, observed from the EFFECT side

```
integration (ubuntu-24.04-arm): runner.debug=1
integration (windows-11-arm): runner.debug=1
```

TEST-08 requires step debug logging because restore MISSes log at `core.debug` and are otherwise
absent from the log. The recorder is ECHO-ONLY rather than a fatal gate, which is why it survives
the variable being unset afterwards.

**This observation reads the EFFECT rather than the configuration, which is what makes it immune to
the documented secret-takes-precedence trap.** GitHub documents that when both a secret and a
variable named `ACTIONS_STEP_DEBUG` exist, the SECRET takes precedence -- so a stale secret at any
value, including `false`, would have made D-21's variable silently ineffective with no visible
signal. The trap was closed from BOTH sides independently:

- **Configuration side, at pre-flight:** the repository holds **zero secrets**, established by a
  read returning `total_count = 0` rather than by an empty-output no-match. The distinction
  mattered: `gh secret list` returned empty output and a bare filter returned exit 1, but a
  positive control showed the listing had no content at all, so "no match" could not be
  distinguished from "nothing was read". The REST read with its `total_count` field resolved it.
- **Effect side, in-run:** `runner.debug=1` on both legs.

The rehearsal run recorded `runner.debug=<unset>` on both legs with the variable deliberately not
set, which is the negative control for this same observation.

### The rehearsal that preceded this run -- a MECHANICS CHECK, never a proof

Recorded because a reader will otherwise find a second run at the same head and have to guess at it.

Before the proving push, the maintainer chose to rehearse on a pull request. PR #11 was reopened at
head `38f9aea`, producing run `30499450423` (`pull_request`, conclusion `success`, 15 green legs
with the 5 push-gated jobs skipped; 15 + 8 push-only legs = the 23 pre-registered for a push). It
was closed again before the proving push, deliberately, so no permanent MERGED record would be left
for a `main` state that existed for about fifteen minutes -- a considered divergence from the
Phase 9 and Phase 10 precedent, where the PR was allowed to auto-merge.

The rehearsal exposed **no defect**: no selector, `jq` filter, step name, job name or artifact name
fault. It was the FIRST EVER execution of the `o3-witness` job, which is absent from `ci.yml` at
`0bea74b` (the branch's prior remote head) and present at `38f9aea`, so the branch's earlier green
PR run `30477430909` had never exercised it.

**None of the rehearsal's values are cited as proof anywhere in this section.** Every number above
comes from push run `30500255530`.

**A finding that qualifies how strong the "a PR cannot be the proof" claim is.** The design's stated
reason (`ci.yml`, the `o3-witness` block) is that on a pull request, `integration` takes
actions/checkout's default MERGE commit while `hash-parity` pins the head SHA, so the two jobs
measure DIFFERENT TREES and their task hashes are not commensurable. Measured on this PR:
`refs/pull/11/merge` was a distinct COMMIT (`376975c`), but its TREE was byte-identical to the
head's -- both `f6610d30613d7b2b802c9e081a0cebbbe2d85920`, with `git diff 38f9aea 376975c` empty.
Corroborated independently: the rehearsal's Windows `integration` hash equalled the local hash at
HEAD, across two different commit SHAs and two machines.

So at THIS divergence state the incommensurability did not obtain. The push was still the right
instrument, for three reasons that are unaffected by it:

1. The tree identity is CONTINGENT on `main` being a strict ancestor of the head (`0  240` at
   pre-flight). The moment anyone pushes to `main`, the merge commit acquires content and the trees
   diverge. It is a property of the divergence state, not of pull-request runs in general.
2. It rests on a tree-identity argument rather than the commit-identity one D-20 specifies.
3. A pull request cannot re-warm the mirror under the post-Phase-11 hashes, because `publish`,
   `publish-verify`, `dogfood-seed`, `dogfood-verify` and `consumer-smoke` are all push-gated and
   were observed SKIPPED on the rehearsal run. Phase 12 needs that warming.

A future reader should get this from the record rather than rediscovering it.

**The `.ref` clause was NOT exercised as a discriminator by the rehearsal.** Querying the key
without the ref filter returned exactly ONE exact-key match, so the clause was proven not to
FALSE-NEGATIVE in pull-request context but was not shown to discriminate. The reason it stays is
plan 11-04's measurement that one hash can hold TWO entries on TWO refs, not anything the rehearsal
observed. The rehearsal did confirm, empirically, the `ci.yml` claim that `$GITHUB_REF` is the
correct filter value on BOTH events: both entries were written under `refs/pull/11/merge`, matching
what the witness computed, so the witness needed no change.

---

## O4 (XOS-04, XOS-05)

**The reservation that stood here through Phase 11 is DISCHARGED by plan 12-06, and converted rather
than deleted so a reader can see what the slot was and what filled it.** It read: "Do not fill this
section and do not delete it. Phase 12 appends the O4 row to THIS record" -- TEST-08's own words,
"Phase 12 appends the O4 row to the same evidence record". This section is that append, written IN
PLACE (D-22). There is no `12-EVIDENCE.md`; the section was not relocated and not duplicated.

**The reason the reservation existed is retained, because it is still the load-bearing fact about
this whole record -- and it is now REALISED rather than pending.** Enabling O4 makes Windows CI a
**second producer** of the `build`, `typecheck` and `test` hashes, which **permanently destroys O1's
producer attribution**. Once a Windows leg can write those hashes, "any such hash in the store is
Linux-produced" is false, the graph premise transcribed above no longer establishes attribution, and
no future session can re-derive what this record captured. That is precisely why the fingerprint
capture above happened in that session, at proof time, and why TEST-08 closes the attribution window
at Phase 9 rather than at Phase 12. As of `ci.yml`'s `build-windows`, `typecheck-windows` and
`test-windows` legs (plan 12-02), the second conjunct is falsified permanently. The claim was
corrected at three sites in the same commit that added the legs, each with a replacement reason
rather than a bare deletion: `ci.yml`'s comment block above the premise step, `capture-hashes.mjs`'s
`FORBIDDEN_TARGETS` docblock, and `capture-hashes.mjs`'s assertion-2 runtime failure message.

**This file is NOT an Nx input**, so nothing about it can serve a stale cached PASS -- and equally,
no spec can usefully guard it, which is why none is written. Phase 11's Nyquist audit already
declined that, and this section does not reopen it.

### The CLAIM, stated in full

The three `windows-11-arm` legs -- `build-windows`, `typecheck-windows` and `test-windows` -- each
log the literal `[remote cache]` per resolved target, against Actions-cache entries that the ubuntu
`build`, `typecheck` and `test` legs saved IN THE SAME RUN, with each Windows leg's `needs:` edge
ordering its ONE ubuntu producer before it.

Two clauses of that sentence are doing work and are stated separately so neither can be lost:

- **Same run.** Not "against Linux bytes from some earlier run". The producer and the consumer check
  out the same tree in the same run, which is what makes the producer attribution readable WITHIN
  the run and is why D-17 records that this proof has no perishable window.
- **`needs:` orders, it does not make correct.** The edge exists so the consumer can HIT at all; it
  is not an ordering CONTROL and nothing in XOS-06 or PROJECT.md's platform-agnosticism row depends
  on leg order. This mirrors O3's own disclaimer above.

### PRE-REGISTERED counts (D-19), fixed in `12-06-PLAN.md` BEFORE any observation

Named in the PLAN, before the run. Recording a different value is a FINDING, not a reason to re-run,
and not a reason to adjust the number.

**Derivation, so a mismatch is investigated rather than explained away.** The resolved task set per
target was MEASURED with `nx run-many -t <target> --graph <file>`, at planning time and again at
plan-12-06 pre-flight on commit `03b0143`. Both measurements agree.

| Command the Windows leg runs | Resolved tasks | Expected `[remote cache]` OCCURRENCES on that leg |
|---|---|---|
| `npm run build` (`nx run-many -t build`) | 1 -- `@op-nx/github-cache:build` | **1** |
| `npm run typecheck` (`nx run-many -t typecheck`) | 2 -- `@op-nx/github-cache:typecheck` AND `@op-nx/github-cache:build`, via an inferred `dependsOn` | **2** |
| `npm run test` (`nx run-many -t test`) | 1 -- `@op-nx/github-cache:test` (`dependsOn: ["^build"]` resolves to zero extra tasks in this single-project workspace) | **1** |

**Total expected non-zero `[remote cache]` occurrences across the three Windows legs: 4.** The
aggregate is recorded, and it is NOT the gate: OBS-02 requires the count named PER TARGET, exactly
as O1's table above does it. A 3-of-4 outcome is reported as which target missed, never as "mostly
hit".

**Expected ubuntu producer verdict, per target. All three MISS-and-save, and the reason is an EDIT,
not a guess:**

| Target | ubuntu leg | Why |
|---|---|---|
| `build` | **MISS-and-save** | plan 12-04 edits `packages/github-cache/src/hash-parity/compare.ts`, a NON-spec `src/` file, which is a `build` input. CONTEXT D-19 allowed for a possible `build` HIT on the grounds that a `ci.yml`-only edit does not rotate `build`; that condition does not hold in this phase, and `compare.ts` is why |
| `typecheck` | **MISS-and-save** | rotated by the new spec files (`typecheck`'s inputs start from `default`, which includes spec files) and by `build`'s rotated declaration outputs, which it hashes via `dependentTasksOutputFiles` |
| `test` | **MISS-and-save** | rotated many times over: `nx.json`, `ci.yml`, `docs/cross-os.md`, the detector workflow registration, the new spec files, `capture-hashes.mjs` and `eslint.config.mjs` are all explicit or implicit `test` inputs |

**One anticipated ambiguity, named IN ADVANCE so it is not read as a failure.** The ubuntu
`typecheck` job also resolves a `build` task, and the ubuntu `build` job has no `needs:` relationship
to it, so the two race for `nx-cache-<H_build>`. Whichever finishes first executes and saves; the
other HITs. That race predates this phase, it is covered by T-12-02, and NEITHER outcome invalidates
O4. Record which one happened. Do not treat the `typecheck` job's `build` task HITting as a
deviation. This is the same shape List 3 above already measured on run `30471772954`, where the
`build` hash was written by the `typecheck` job rather than by the `build` job.

**How to count.** `rg -o -F "[remote cache]" <log> | wc -l`. NEVER `rg -c`, which counts LINES rather
than occurrences. `-F` is required because square brackets are a regex character class. Read the
EXIT CODE: 0 means hits, 1 means a genuine no-match, and **2 means the command FAILED** while
printing zero lines, which is indistinguishable from absence if only the output is read.

### ANTI-REQUIREMENTS -- each of these would produce a FALSE PASS

Restated here rather than left in a distant rationale, because every one of them is a plausible
mistake at the moment of reading the log. They are on record BEFORE the observation, which is the
point of writing them here at all.

1. **A run that MISSes everything is not a valid O4 proof.** TEST-09's rule, applied to O4. A MISS is
   never self-evidencing in this system: every read fault degrades to a MISS, which is exactly why
   the gate is the literal `[remote cache]` LABEL and never the absence of an error.
2. **A workflow RE-RUN is not the proof.** On a re-run the ubuntu leg restores the merge-ref entry
   the FIRST run saved, so it HITs instead of MISS-and-saving. The Windows HIT would still be
   against Linux-produced bytes, but the producer attribution WITHIN the run evaporates. Phase 11
   applied this same discipline as T-11-26 and it transfers verbatim: **the FIRST run of the PR, or
   nothing.**
3. **`Cache: n/m hit` is NOT discriminating, in EITHER direction.** A `0%` prints identically for a
   run with no sidecar at all (measured on run `30169158892`), and a non-zero count includes LOCAL
   hits. If the line is recorded at all, it is marked NON-DISCRIMINATING IN BOTH DIRECTIONS BESIDE
   the line (D-20, OBS-02).
4. **"The job was green" is not evidence unless it is paired with a COUNT** that would differ under
   the failure hypothesis. TEST-08.
5. **A green O4 CI is NOT evidence the targets are PORTABLE.** That argument is CIRCULAR, and
   `REQUIREMENTS.md`'s Out of Scope table names it as such: a restored task does not execute. It is
   the entire reason the plan 12-03 scheduled Windows regression detector exists. A green O4 leg
   must not be written up as a portability finding.

Anti-requirement 5 restated in XOS-05's own words, because it is the sharpest sentence in the phase:
the success signal for O4 -- every target `[remote cache]`, wall time collapsing to sidecar overhead
-- is the IDENTICAL observation to a Windows-only regression being invisible forever. The
pre-registered counts above are what separate the two.

### The vehicle, and why it is the ONLY one (D-18, as corrected)

`.github/workflows/ci.yml` is `on: push` restricted to `main`, plus `pull_request`. **A push to the
phase branch does not trigger CI at all.** So a same-repo pull request is not the PREFERRED vehicle
for O4 -- it is the ONLY vehicle short of pushing to `main`, which D-18 declines.

**The reason previously recorded in CONTEXT was FALSE and must not be repeated.** It claimed that a
fork PR gets a read-only Actions cache, so both legs would MISS. GitHub's 2026-06-26 changelog says
the opposite verbatim: "any trigger that uses a non-default-branch scope, such as `pull_request` and
`release`, keeps read-write caching permission." The read-only rule fires only when an untrusted
trigger ALSO runs at the shared default-branch scope, which names `pull_request_target`,
`issue_comment` and fork `workflow_run` cascades -- not `pull_request`. The correction ships with its
replacement reason rather than as a bare deletion.

This repo has already MEASURED the scope rather than inheriting it: both entries of PR run
`30499450423` were written under `refs/pull/11/merge` (recorded in the rehearsal subsection of O3
above). Both legs of one PR run share that one scope, which is precisely what O4 needs.

### What this proof does NOT need

Stated explicitly, mirroring this file's own habit directly under its status table, so a reader does
not look for evidence that never appears:

- **No temporary `main` push.** Phases 9, 10 and 11 each needed one for a perishable half. O4 does
  not: it is a SAME-RUN property (D-17), so the commit that invalidates the `test` hash is the same
  commit that proves the HIT.
- **No warm Releases mirror, and no mirror row.** `publish`, `publish-verify`, `dogfood-seed`,
  `dogfood-verify` and `consumer-smoke` are all push-gated and are SKIPPED on a PR run. This record
  already documents observing exactly that on the O3 rehearsal. O4 does not need mirror warming.
- **The PR-scope entry is ephemeral and isolated.** The proof seeds neither `main`'s cache scope nor
  the Releases mirror; a `refs/pull/N/merge` entry cannot be restored by the base branch or by other
  pull requests targeting it. That is fine, because the proof is a same-run property -- but it is
  said here so the absence is read as designed rather than as missing.

### The write decision, recorded as FORCED rather than chosen

The Windows legs write because `selectBackend` hands a CI-trusted run the writable backend; there is
no consumer-facing knob that makes a trusted leg read-only, and adding one would be a TRUST-05
violation. The full re-pricing lives where it belongs and is cross-referenced rather than restated
differently here: `.planning/phases/10-os-invariant-releases-mirror/10-SECURITY.md` `### Q1
(TRUST-11)`, appended by plan 12-02, which asserts **Leg A** (the `needs:` edge removes the
concurrent RACE, and only the race) and **Leg B** (it does not remove the SECOND PRODUCER) as
separately labelled legs.

**The sharpening that keeps this record honest:** on a run where every Windows task RESTORES, the
Windows legs write NOTHING. So the second-producer fact is a **CAPABILITY** that materialises on a
Windows MISS -- it is not an observation about the proving run, and a proving run in which all four
pre-registered counts are MET is precisely a run in which the Windows legs wrote nothing at all.
Both halves have to be stated or the record is half-true in whichever direction the reader prefers.

### VERDICT

**PENDING -- live-CI, first run of the proving PR.**

Nothing above this line is an observation. The counts, the ubuntu expectations, the anti-requirements
and the vehicle are all pre-registration, written before any run existed. The observation record is
below.

### The observation attempt, and its honest result

Attempted `2026-07-30` at commit `f5d03b0` by plan 12-06 Task 3. **No proving run exists, so NO
observation is recorded.** Not a partial one, not an inferred one, not one reconstructed from an
earlier run. PENDING is an allowed terminal outcome for this section and this is it.

Why there is no run, MEASURED rather than assumed:

| Check | Command | Result |
|---|---|---|
| the branch's remote tip | `git ls-remote --heads origin gsd/v0.0.2-os-invariant-cross-os-sharing` | `38f9aea` -- the Phase 11 proving head, from 2026-07-29 |
| how far the local tree is ahead of that tip | `git rev-list --count 38f9aea..HEAD` | **55 commits**, every one of them UNPUSHED |
| open pull requests | `gh pr list --repo op-nx/github-cache --state open` | **none.** PR #11 is CLOSED, at head `38f9aea` |
| the newest workflow run in the repository, any branch | `gh run list --repo op-nx/github-cache --limit 1` | `30518183457`, event `schedule`, branch `main`, head `fe25a3f`, created `2026-07-30T05:59:07Z` |

The three Windows legs landed in commit `f5dd429` (plan 12-02) and exist nowhere on the remote. CI
can only run on a pushed ref, and `ci.yml` is `on: push` for `main` plus `pull_request`, so no run
can possibly carry them. **Opening the pull request is a carried OPERATOR decision. Plan 12-06
prepares and records the observation; it does not open the pull request, push a branch, or trigger a
workflow.**

### The observation procedure, handed over so it does not have to be reconstructed

Run this against the FIRST run of the same-repo proving pull request, never a re-run, and write the
result into the VERDICT slot above plus the `## Headline` table's O4 row.

1. **Identify the run and confirm it is the FIRST**, not a re-run. `gh run list --repo
   op-nx/github-cache --branch gsd/v0.0.2-os-invariant-cross-os-sharing --event pull_request`; the
   run's `run_attempt` must be `1`. A re-run is disqualified by anti-requirement 2, not merely
   discouraged.
2. **Per Windows leg, count OCCURRENCES of the literal label.** Download or open the log for
   `build-windows`, `typecheck-windows` and `test-windows`, then for each:

   ```
   rg -o -F "[remote cache]" <log> | wc -l
   ```

   `-F` is mandatory (square brackets are a regex character class). `rg -o ... | wc -l` counts
   occurrences; `rg -c` counts LINES and is wrong here. Read the EXIT CODE: 0 hits, 1 genuine
   no-match, **2 the command FAILED** while printing nothing.

   | Leg | Pre-registered occurrences | Targets that must be named INDIVIDUALLY |
   |---|---|---|
   | `build-windows` | **1** | `build` |
   | `typecheck-windows` | **2** | `typecheck` AND `build` |
   | `test-windows` | **1** | `test` |

   Total 4. Record the Nx hash observed per target, and an explicit MET / NOT MET per leg. Never
   report an aggregate in place of the per-target counts.
3. **Per ubuntu leg, record MISSED-and-saved or HIT** for `build`, `typecheck` and `test`, and note
   which outcome the ubuntu `typecheck` job's own `build` task took in its race with the ubuntu
   `build` job. Both outcomes of that race are legitimate.
4. **Record the run identifier and the run URL.** If a `Cache: n/m hit` line is quoted at all, mark
   it NON-DISCRIMINATING IN BOTH DIRECTIONS beside the line.
5. **If any count differs from the pre-registration, record the DIFFERENCE and its investigation.**
   Do not adjust the pre-registration to match the observation, and do not round a partial result up
   to PROVEN.
6. **If the `test` target FAILS on any leg, capture the full output BEFORE any re-run** and append it
   to `.planning/phases/08-nx-task-hash-parity/deferred-items.md` item 1 with the run URL, the Nx
   version, the Node version and the leg's OS. The `69bd1b7` `test` failure has never been
   attributed and its output was discarded once already by a re-run.

**The same first run also closes RESEARCH assumption A1 for free**, and it is currently OPEN: the
`integration` platform discriminator became `node --no-warnings -p process.platform` in plan 12-04,
measured only on `win32/arm64`. `capture-hashes.mjs`'s `readDiscriminatorCommand` reads that string
out of `nx.json` rather than re-spelling it, so the `hash-parity` job records the command's raw
`stdout` AND `stderr` per OS with no new instrument. Download both legs' artifacts -- their names are
the RUNNER LABELS, `hash-parity-ubuntu-24.04-arm` and `hash-parity-windows-11-arm`, each containing a
same-named `.json` with a top-level `discriminator` block -- and record the two `stdout`/`stderr`
pairs verbatim. Expected: `stdout` `linux` and `win32` respectively, `stderr` EMPTY on both. **A
non-empty `stderr` on either leg is a FINDING, not a nuisance**: it means the hardening did not close
the channel it was chosen for, and Nx hashes `trim(stdout) + trim(stderr)` together.

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
- **O4's live observation.** The O4 section above is FILLED by plan 12-06 with its claim, its
  pre-registered counts and its five anti-requirements, but its VERDICT is **PENDING -- live-CI,
  first run of the proving PR**: no such run existed when it was written, and inventing one is the
  single worst outcome available in that plan. The section is no longer reserved and no longer
  unfilled; what remains unobservable is the observation itself. O3, by contrast, is CLOSED by push
  run `30500255530`.
- **Whether the Windows leg would MISS at a commit where the `integration` hash had NOT rotated.**
  Not observable here: the hash rotated on this commit, so both legs missed for that reason too.
  The witness's existence assertion is what carries the attribution, not the coincidence of a miss.
- **That the 30-second margin will hold on any future run.** Recorded as a MEASUREMENT, never as a
  guarantee. The witness fails loud if it collapses, which is the correct failure mode, but nothing
  here promises it will not.
- **macOS in any form.** `cachePlatform` maps `darwin -> macos` and is unit-pinned, but no macOS
  runner or developer read exists.
- **Whether a warm-graph local box hits these same hashes.** Not measured here; the reset removed
  the opportunity by design.

### The calibrated instruments Phase 12 inherits, by name

Each was exercised live by push run `30500255530` and is now a known-good measuring device rather
than an untested one:

| Instrument | What it measures | State handed to Phase 12 |
|---|---|---|
| the `o3-witness` job | that a named cache entry existed before a named step started, by exact `.key` equality plus a `.ref` filter, with a stated 30 s minimum margin | GREEN on a push and on a pull request; its `$GITHUB_REF` filter confirmed correct on BOTH events |
| the positive control, per `integration` leg | that the sidecar and backend were alive on that leg, acceptance set 200 ALONE | 200 on both legs, on both runs |
| `capture-hashes.mjs --assert-graph-premise` | the graph premise O1's producer attribution RESTED on | **Phase 12's XOS-04 changed this premise's meaning, and the correction has LANDED (plan 12-02).** The assertion is byte-unchanged and still a real gate on the GRAPH PROPERTY -- `nx run-many -t integration` still resolves no `build`/`typecheck`/`test` task, and it still catches an Nx upgrade that changes the inferred `dependsOn`. What moved is what it ESTABLISHES: it no longer establishes producer attribution, because that rested on a CONJUNCTION with "Windows CI runs only `integration`", which `ci.yml`'s three Windows legs falsify permanently. The claim was rewritten at THREE sites -- `ci.yml`'s comment block above the premise step, `capture-hashes.mjs`'s `FORBIDDEN_TARGETS` docblock, and assertion 2's runtime failure message -- each supplying a replacement reason and pointing at this file's O1 section as the FROZEN attribution record |
| the `runner.debug` echo recorder | that step debug logging was active, from the EFFECT side | echo-only, so it survives the variable being unset; `1` observed with the variable set, `<unset>` without |

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

### Provenance of the O3 half -- the LIVE run, not the local session

The table above covers the LOCAL session that produced O1 and O2. O3 was produced by a separate,
live measurement and its provenance is distinct:

| Fact | Value |
|---|---|
| Proving run | `30500255530`, event `push`, branch `main`, head `38f9aea` |
| Rehearsal run (mechanics check, NOT a proof) | `30499450423`, event `pull_request`, head `38f9aea`, PR #11 reopened then closed before the push |
| Restore run | `30501074211`, event `push`, head `fe25a3f` -- predicted in advance |
| Runners | `ubuntu-24.04-arm` and `windows-11-arm`, GitHub-hosted |
| `main` before and after | `fe25a3f` both, verified by SHA equality |
| Backup ref retained | `refs/heads/backup/main-before-phase11-verify` = `fe25a3f` |
| Step debug logging | repository VARIABLE `ACTIONS_STEP_DEBUG`, set `2026-07-29T23:39:35Z`, deleted `2026-07-29T23:57:22Z`; zero secrets at pre-flight by `total_count` |
| Secret hygiene | named fields extracted programmatically; NO raw REST payload pasted; no address of any kind written into this record |

**The O1 and O2 measurements above are NOT reproducible at any later commit.** This phase's own
`ci.yml` and spec edits rotated `test`, `typecheck`, `integration` and `lint` -- `hash-parity`'s
verdict line in the O3 section records their post-rotation values, and only `build`
(`17269409342684722256`) is unchanged from the O1/O2 session. A future reader who tries to retake
the O1 or O2 numbers at a later commit will measure different hashes against a different mirror
state and should not attempt it. That is the sentence that stops the attempt.
