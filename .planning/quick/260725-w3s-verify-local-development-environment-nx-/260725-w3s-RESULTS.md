# Quick Task 260725-w3s: RESULTS -- local Nx cache HIT/MISS per cacheable target

**Measured:** 2026-07-25 (local clock rolled to 2026-07-26 mid-run; UTC timestamps below)
**Machine:** Windows 11 arm64, `process.platform` = `win32`, Node 24.13.0, Nx 23.1.0
**Branch:** `gsd/quick-260725-rk4-dogfood-ci`
**Commit:** `e4362066870ca2085bcb09e765c1c0d2ffb90037` (`e436206`, "docs(quick-260725-rk4): scope
the cross-OS gap as deferred value, per TEST-05"). Working tree clean apart from this task's own
untracked `.planning/quick/260725-w3s-.../` directory.

This is a VERIFY-ONLY record. No source file, workflow file, or consumer contract was changed.

---

## 1. What was run

Two `run-many` invocations over all four cacheable targets, one per graph state, through the
shipped loopback sidecar (`packages/github-cache/dist/serve.js`, launched directly -- that bin IS
the consumer surface, entry guard included). Not four separate runs: separate runs sharing a cache
dir would let run N warm the local cache for run N+1 and mask the remote for `build`, which
`typecheck` pulls in via a same-project `dependsOn` (RESEARCH 4e / section 5).

```
npx nx run-many -t build typecheck test integration
```

`--skip-nx-cache` was NOT passed (it disables the remote too). `nx reset` was NOT run.

### Sidecar

| Item | Value |
|---|---|
| Launch | `PORT=41999 NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=<throwaway> node packages/github-cache/dist/serve.js` |
| Bound URL (read from the sidecar's own stdout) | `http://127.0.0.1:41999` |
| Process | real separate process, background shell id `b9xla5nhj` |
| stdout | `$SCRATCH/w3s/sidecar.out` |
| stderr (the only fault channel) | `$SCRATCH/w3s/sidecar.err` |
| Bearer token | minted via `crypto.randomBytes(24).toString('hex')`, loopback-only, disposable. NEVER recorded here, in any log excerpt quoted here, or in any commit. |
| Built bin currency | `dist/serve.js` matches the current read path. `tsc --build tsconfig.lib.json` ran twice AFTER the last emit (the RESEARCH smoke run and the COLD run) and emitted nothing new, which is tsc's outputs-newer-than-inputs certification. The only source file newer than the newest `dist` output is `packages/github-cache/src/test/octokit-fault.ts`, a spec-only fixture imported solely by `*.spec.ts` and not reachable from `serve()`. |
| Teardown | background shell `b9xla5nhj` killed at the end of the run; port 41999 then confirmed not listening (`Get-NetTCPConnection -LocalPort 41999` returns nothing). No sidecar leaked. |

Readiness pair, as specified: the correct-bearer half is over-evidenced -- 8 real-hash GETs
returned HTTP 404 (section 3), each proving the request reached a backend `get` that MISSED. The
wrong-bearer half against `/v1/cache/deadbeef` was observed as 401 during startup but its status
line was NOT captured to a file, so it is recorded here as an operator observation rather than as
a reproducible artifact. Auth is independently evidenced by the 404s: a rejected bearer would
have returned 401 instead.

### Client env, per state

Common to both:

```
NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:41999
NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=<the same throwaway token>
```

| State | `NX_CACHE_DIRECTORY` | `NX_WORKSPACE_DATA_DIRECTORY` |
|---|---|---|
| COLD | `$SCRATCH/w3s/cold/nxcache` (fresh, empty) | `$SCRATCH/w3s/cold/nxdata` (fresh, empty) |
| WARM-GRAPH | `$SCRATCH/w3s/warm/nxcache` (fresh, empty) | `$SCRATCH/w3s/warm/nxdata` (a COPY of the real `.nx/workspace-data`) |

Every `nx` invocation set BOTH `NX_*` directory variables into the scratchpad. The warm graph was
read from a copy, never the original. The copy is byte-clean, not torn: source and copy of
`5758ec3f-c720-4e9d-9e01-db7850d30e22-v3.db` are both 184320 bytes.

**Nothing under the real `.nx/` was written.** Fingerprint (recursive file count, total bytes,
newest mtime) taken before the first run, after COLD, and after WARM-GRAPH -- all three identical:

```
files 6747
bytes 40785023
newest_mtime_iso 2026-07-25T22:39:52.371Z
newest_path .nx\workspace-data\file-map.json
```

That newest mtime predates the first Nx invocation of this task (22:48:32Z).

---

## 2. Measurement table

| target | state | cache label (verbatim) | task hash | `<hash>-windows` in shard | `<hash>-linux` in shard | attributed cause |
|---|---|---|---|---|---|---|
| build | COLD | *(no label)* | 13655686526929222562 | ABSENT | ABSENT | (1) nothing published in the current naming scheme |
| typecheck | COLD | *(no label)* | 3381254060286801611 | ABSENT | ABSENT | (1) nothing published in the current naming scheme |
| test | COLD | *(no label)* | 5027851155743781967 | ABSENT | ABSENT | (1) nothing published in the current naming scheme |
| integration | COLD | *(no label)* | 13758457399293023985 | ABSENT | ABSENT | (1) nothing published in the current naming scheme |
| build | WARM-GRAPH | `[local cache]` | 14522047022641658505 | ABSENT | ABSENT | INCONCLUSIVE via Nx (remote never consulted); (1) via direct probe |
| typecheck | WARM-GRAPH | `[local cache]` | 17612203514283256006 | ABSENT | ABSENT | INCONCLUSIVE via Nx (remote never consulted); (1) via direct probe |
| test | WARM-GRAPH | `[local cache]` | 12332927989897543193 | ABSENT | ABSENT | INCONCLUSIVE via Nx (remote never consulted); (1) via direct probe |
| integration | WARM-GRAPH | `[existing outputs match the cache, left as is]` | 18311993323643153366 | ABSENT | ABSENT | INCONCLUSIVE via Nx (remote never consulted); (1) via direct probe |

No task in either state carried a `[remote cache]` label. Zero remote cache hits were observed.

### The WARM-GRAPH state hit the risk the plan predicted

The plan flagged it in advance: the copied DB still holds `cache_outputs` rows for those hashes,
so Nx can report a local hit even against an empty artifact directory. That is what happened, for
all four tasks. `$SCRATCH/w3s/warm/nxcache` contains only `run.json` and `terminalOutputs` -- no
artifact directories -- yet all four tasks were served locally. Because Nx consults the remote only
*after* a local miss, the remote was never consulted in the WARM-GRAPH state, so its Nx labels
carry no information about the remote in either direction. Per the plan this is recorded verbatim
as INCONCLUSIVE for those four tasks, and the warm hashes are instead answered by the direct
`<hash>-<os>` asset probe and the direct read-path probe in section 3, which answer the same
question without Nx. The copied DB was NOT edited to force a miss, and the real `.nx/` was not
re-run against.

### `Cache: n/m hit` lines -- recorded, and NOT used

| State | Line (verbatim) |
|---|---|
| COLD | `Cache:             0/4 hit (0%)` |
| WARM-GRAPH | `Cache:             4/4 hit (100%)` |

Both are recorded and **neither is used to discriminate local from remote, in either direction**.
`CACHE_HIT_STATUSES` (`performance-analysis.js:14`) is `{local-cache, local-cache-kept-existing,
remote-cache}`, so the percentage counts local and remote identically (RESEARCH 4a). This run is
itself a live demonstration in both directions: the `0/4` is not evidence that the remote was
never consulted (section 3 shows it was), and the `4/4 hit (100%)` was produced with **zero**
remote consults. The per-task label is the only discriminating signal.

### Nx messages about writing to the remote

None. The off-CI backend is read-only by construction, so Nx's post-run PUT is answered 403, and
Nx printed nothing about it and exited 0. Recorded as observed; per the plan a 403 on PUT is
expected and is **not** a read fault, and it is not cited as a cause anywhere above.

---

## 3. The four attribution signals, with measured values

### Signal 1 -- tier probe, through the reader's own spawn shape

Run BEFORE any Nx invocation, replicating `runHelper`'s options verbatim from
`packages/github-cache/src/lib/local-context.ts:42-90` (`shell: false`, `timeout: 5000`,
`killSignal: 'SIGKILL'`, `windowsHide: true`, env spread with `GIT_TERMINAL_PROMPT=0`,
`GIT_ASKPASS=''`, `SSH_ASKPASS=''`). Output verbatim:

```
PROBE gh auth token | exit 0 | stdout non-empty true | RESOLVES | stdout length 40 (value never printed)
PROBE git remote get-url origin | exit 0 | stdout non-empty true | RESOLVES | stdout "https://github.com/op-nx/github-cache.git"
ENV GITHUB_ACTIONS | UNSET
ENV GH_TOKEN | UNSET
ENV GITHUB_TOKEN | UNSET
ENV GITHUB_REPOSITORY | UNSET
PLATFORM process.platform | win32
```

Both silent MISS causes are therefore ruled out by measurement, not assumption:

- **No token resolved** (`releases-backend.ts:306`, returns `undefined` with zero fetches) --
  RULED OUT. `gh auth token` RESOLVES through the reader's literal spawn shape. This matters
  specifically because `shell: false` does no PATHEXT resolution on Windows, so a `.cmd`-shimmed
  `gh` would have silently yielded nothing.
- **No repo identity resolved** (`releases-backend.ts:316`, same shape) -- RULED OUT.
  `git remote get-url origin` RESOLVES to `https://github.com/op-nx/github-cache.git`.

`GITHUB_ACTIONS`/`GH_TOKEN`/`GITHUB_TOKEN`/`GITHUB_REPOSITORY` all UNSET confirms the off-CI read
path: `isWriteTrusted` returns not-ci, so `selectBackend` hands back the real Releases reader.
None of them was set by this task. `process.platform` = `win32` means `releaseAssetName` resolves
the `-windows` suffix.

### Signal 2 -- `gh api` shard and asset probe

Shard window first, to confirm it is not a cause:

| Shard tag | Result |
|---|---|
| `cache-mirror-202608` | 404 |
| `cache-mirror-202607` | 200, release id 354838660, created 2026-07-16T02:51:16Z, **79 assets** |
| `cache-mirror-202606` | 404 |

The 30-day window is `[cache-mirror-202607, cache-mirror-202606]` and the only populated shard is
FIRST in the walk, with the next shard a clean 404 that terminates the walk on an exhausted
window. The shard window is NOT a cause. (Re-verified after the local date rolled to 2026-07-26;
202608 does not exist yet.)

Every one of the 79 asset names, by shape:

| Shape | Count | What it is |
|---|---|---|
| `<something>.tar.gz` | 50 | PoC-era (pre-greenfield-rebuild) names. Unreachable by today's reader: `releaseAssetName` produces `<hash>-<os>` with no extension. |
| `<run_id>-<os>` | 24 (13 `-linux`, 11 `-windows`) | v0.0.1 publisher output, `run_id`-keyed proof seeds |
| `cafe<run_id>-linux` | 5 | v0.0.1 publisher output, hex-prefixed proof seeds |
| **total** | **79** | |

The `<run_id>` prefixes are 11 digits (`29685631933` ... `30169158892` -- GitHub Actions run IDs).
Every task hash recovered in this task is 20 digits. A run-id-keyed asset name therefore cannot
collide with a task-hash-keyed lookup by construction, independent of the OS suffix.

Asset probe, all 8 recovered hashes x both OS suffixes -- **16 of 16 ABSENT**:

```
COLD | build       | 13655686526929222562-windows | ABSENT
COLD | build       | 13655686526929222562-linux   | ABSENT
COLD | integration | 13758457399293023985-windows | ABSENT
COLD | integration | 13758457399293023985-linux   | ABSENT
COLD | test        | 5027851155743781967-windows  | ABSENT
COLD | test        | 5027851155743781967-linux    | ABSENT
COLD | typecheck   | 3381254060286801611-windows  | ABSENT
COLD | typecheck   | 3381254060286801611-linux    | ABSENT
WARM | build       | 14522047022641658505-windows | ABSENT
WARM | build       | 14522047022641658505-linux   | ABSENT
WARM | integration | 18311993323643153366-windows | ABSENT
WARM | integration | 18311993323643153366-linux   | ABSENT
WARM | test        | 12332927989897543193-windows | ABSENT
WARM | test        | 12332927989897543193-linux   | ABSENT
WARM | typecheck   | 17612203514283256006-windows | ABSENT
WARM | typecheck   | 17612203514283256006-linux   | ABSENT
```

A wider probe was also run: for each of the 8 hashes, the count of asset names containing that
hash **under any suffix at all** is 0. So the absence is not an artifact of the two names probed.

**What this establishes about the three stacked causes.** For all 8 hashes, neither
`<hash>-windows` nor `<hash>-linux` is present, so:

- Cause **(1) nothing published in the current naming scheme** is the **ACTIVE** cause for every
  MISS in the table. It is confirmed positively, not inferred from the MISS.
- Cause **(2) OS suffix** (a Windows reader asks `-windows` while ubuntu CI publishes `-linux`) is
  **UNOBSERVABLE behind cause (1)** -- it was NOT tested. Testing it needs a hash whose `-linux`
  asset exists; none does.
- Cause **(3) hash parity** across OSes is likewise **UNOBSERVABLE behind cause (1)** -- it was
  NOT tested here. (Section 4 reports a separate, local finding about the *evidence* for it, which
  is not the same as testing it.)

No hash showed `-linux` present with `-windows` absent, so cause (2) was not promoted to active
for any hash, and cause (1) is not refuted for any hash. No hash showed `-windows` present, so no
result required re-checking the port/token link as a real fault.

### Signal 3 -- sidecar stderr (the only fault channel)

`$SCRATCH/w3s/sidecar.err` is **0 bytes**, verbatim empty, checked after the COLD run, after the
WARM-GRAPH run, and after 8 further authenticated real-hash GETs.

Empty means **no non-404 fault occurred at all**: no 401, no 403, no 429, no 5xx, no DNS failure,
no `FETCH_TIMEOUT_MS`/`DOWNLOAD_TIMEOUT_MS` abort. `warnOnce` fires on any thrown fault reaching
the port catch (`releases-backend.ts:95`, printing the numeric HTTP status when present) and
prints nothing on the absent-asset path.

Known limit, stated so the signal is not over-read: `warnOnce` is once per **process**
(module-level `warned` flag), so one sidecar serving a 4-target `run-many` emits at most ONE
warning. An empty stderr is a strong signal; a single warning would not have told us WHICH target
caused it.

### Signal 4 -- Nx's own end-of-run report

COLD: `Successfully ran targets build, typecheck, test, integration`, exit 0, all four tasks with
no cache label, `Cache: 0/4 hit (0%)`.

WARM-GRAPH: `Successfully ran targets ...`, exit 0, `Nx read the output from the cache instead of
running the command for 4 out of 4 tasks.`, `Cache: 4/4 hit (100%)`, three `[local cache]` labels
plus one `[existing outputs match the cache, left as is]`.

### Executor-added control (beyond the plan) -- proving the remote was actually reached

The plan's preconditions rule out the two silent causes but do not establish that Nx's client
actually transacted with the sidecar, and the sidecar has **no request logging** -- it cannot say
which hashes Nx asked for. Without that, an all-MISS could not be distinguished from a remote that
was never consulted, which is the false-negative this task most needed to avoid. Two additions,
both read-only, both through the shipped surface, neither a fix:

**(a) Dead-port differential control.** A third COLD `run-many` against
`NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:41998` (confirmed refusing connections,
curl code `000`) produced, verbatim:

```
 NX   Failed to send request: error sending request for url (http://127.0.0.1:41998/v1/cache/13758457399293023985)
```

and exited **1**. Two things follow. First, Nx surfaces a remote transport fault loudly and fails
the run -- so the 41999 runs' clean exit 0 with no such message means every request Nx made did
reach the sidecar. Second, the error names the request URL, and `13758457399293023985` is exactly
the COLD `integration` hash recovered from the DB -- so Nx addresses `/v1/cache/<task-hash>` using
precisely the hash values tabulated above.

Honest limit: that message appears *after* `Successfully ran targets`, which is consistent with
the post-run PUT rather than the pre-run GET, so this control on its own does not isolate the read
half from the write half.

**(b) Direct read-path probe on all 8 real hashes.** So the read half was driven directly through
the shipped sidecar with the valid bearer -- the same path the readiness probe used, on the real
hashes instead of `deadbeef`:

```
COLD | build       | GET /v1/cache/13655686526929222562 -> HTTP 404
COLD | integration | GET /v1/cache/13758457399293023985 -> HTTP 404
COLD | test        | GET /v1/cache/5027851155743781967  -> HTTP 404
COLD | typecheck   | GET /v1/cache/3381254060286801611  -> HTTP 404
WARM | build       | GET /v1/cache/14522047022641658505 -> HTTP 404
WARM | integration | GET /v1/cache/18311993323643153366 -> HTTP 404
WARM | test        | GET /v1/cache/12332927989897543193 -> HTTP 404
WARM | typecheck   | GET /v1/cache/17612203514283256006 -> HTTP 404
```

A 404 on a valid bearer proves the request reached a backend `get` and that backend MISSED (a
wrong bearer returns 401 -- observed in the readiness pair). All 8 real hashes MISS through the
shipped read path, and stderr stayed 0 bytes across all 8, so all 8 misses are clean absences
rather than suppressed faults. This is what makes the all-MISS attributable to absence: the read
path was exercised on every hash in the table and returned a clean MISS for each.

Residual limit: (b) measures the shipped read path on the exact hashes; it does not prove Nx itself
issued the GET. That last step rests on one measured fact (transport to 41999 demonstrably worked
during the runs, per (a)) plus one source-level fact (`cache.js:71-99`: local SQL lookup first,
remote consulted on a local miss). Both halves use the same client and the same base URL, so there
is no mechanism by which the PUT reaches 41999 and the GET does not -- but that is a mechanism
argument, not a direct measurement, and is recorded as such.

---

## 4. The two-state finding

The sharpened question this task actually answers is not "does a local read hit" but: **which hash
does a cold Windows developer compute, which hash does an established local box compute, and are
either of them the hash CI published?**

Measured on ONE Windows machine at ONE commit, varying only `.nx/workspace-data` freshness:

| target | COLD hash (fresh workspace-data) | WARM-GRAPH hash (copy of real workspace-data) | same? |
|---|---|---|---|
| build | 13655686526929222562 | 14522047022641658505 | NO |
| typecheck | 3381254060286801611 | 17612203514283256006 | NO |
| test | 5027851155743781967 | 12332927989897543193 | NO |
| integration | 13758457399293023985 | 18311993323643153366 | NO |

All four targets compute a **different task hash** depending only on workspace-data freshness, on
the same machine, same OS, same commit. RESEARCH 4c had measured this for `build` alone; it holds
for all four.

### Four-way comparison against the CI-measured values

`.planning/STATE.md` Deferred Items cites probe run 30173654069 as the measurement of cross-OS
hash divergence for `build`:

| Value | STATE.md attributes it to | This task reproduces it as |
|---|---|---|
| 14522047022641658505 | ubuntu CI | WARM-GRAPH Windows (warm `.nx/workspace-data`) |
| 13655686526929222562 | windows-11-arm CI | COLD Windows (fresh `.nx/workspace-data`) |

Both values in the cited pair are reproducible on this single Windows box by varying only
workspace-data freshness. Nothing OS-related was varied. This does **not** disprove cross-OS
divergence -- CI is always cold, and cold-Windows here equals the recorded cold-Windows value --
but it does mean workspace-data-derived state (plugin target re-inference, lockfile re-parse) is
an uncontrolled variable in that evidence, so the cited pair does not isolate OS as the variable.
Recorded against the existing STATE.md row (evidence framing only; the deferral decision, severity
framing, TEST-05 compliance statement, and milestone standing are untouched).

Neither hash, in either state, for any of the four targets, exists in the mirror.

---

## 5. What was NOT tested, and cannot be from here

- **Cause (2), the OS suffix.** Unobservable behind cause (1). It needs a hash whose `-linux`
  asset exists in the shard; none of the 8 does, under any suffix.
- **Cause (3), cross-OS hash parity.** Unobservable behind cause (1), and untestable from one
  machine regardless -- it needs a node-by-node hash comparison between native Windows and a Linux
  clone at the same commit. Section 4 reports a confound in the *existing evidence* for it, which
  is not the same as testing the parity claim.
- **The `@actions/cache` version-hash layer.** Untouched. The keys have never collided, so the
  layer that version-hashes `join(tmpdir(), ...)` has never been exercised. Closing it needs a
  probe forcing two OSes onto one key.
- **The cross-OS publish gap.** A ubuntu `publish-mirror` cannot restore Windows-saved Actions
  cache entries, so Windows-computed hashes never reach the mirror at all. Not exercised here.
- **Whether Nx itself issued the GET** (as opposed to the read path being driven directly). See
  the residual limit in section 3.
- **Whether Nx's own bearer was accepted.** A distinct case from the one above -- issued-and-
  refused, not never-issued. Had `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` not matched the
  sidecar's token, the server's auth layer would have answered Nx 401, and `sidecar.err` would
  NOT show it: stderr is the BACKEND fault channel, so an auth-layer rejection never reaches it.
  Token equality is asserted here by construction (one throwaway token, one shell variable, both
  sides) and was not measured for Nx's client specifically. This does NOT weaken the absence
  attribution: the 8 direct read-path probes drive the same shipped read path over the same 8
  hashes with a bearer proven accepted (404, not 401), so cause (1) stands on evidence that does
  not depend on Nx's auth at all.
- **The WARM-GRAPH state's Nx labels as remote evidence.** The remote was never consulted for
  those four tasks; the direct probes answer for them instead.
- **The publisher writing a real task artifact.** No `nx-cache-<taskhash>` Actions entry from
  `main` has ever been mirrored; the mirror holds only `run_id`-keyed seeds. That is what PR #4
  changes, and PR #4 is not merged. Verifying the post-merge state is a different measurement.

---

## 6. Both readings of the outcome

The measured outcome is: **zero remote cache hits across all four cacheable targets in both graph
states**, with cause (1) confirmed active for every hash, both silent causes ruled out by
measurement, the fault channel verbatim empty, and the read path shown to return a clean MISS for
every hash under test.

CONTEXT.md records an explicit UNRESOLVED item on how to LABEL that outcome. Both readings, with
the facts from this task that support each:

**Reading (a).** The verification did what a verification is for: it established current behavior
precisely, attributed every MISS to a named cause backed by a probe result, and proved its own
soundness first. Supporting facts: both silent MISS causes ruled out before any Nx run; the
sidecar's read path live and reaching a real backend get (401/404 pair); 16 of 16 asset probes
ABSENT plus a wider bare-hash probe at 0; stderr 0 bytes across every run and probe, so no MISS is
a suppressed fault; the real `.nx/` provably untouched. On this reading the outcome is
v0.0.1-compliant per TEST-05, whose acceptance is "cross-OS lookup returns a correct hit or a MISS
- never a wrong-OS artifact": a MISS is inside the contract, no wrong-OS artifact was served, and
CORR-01's safety property holds. The gap is already recorded as deferred VALUE by an explicit
maintainer decision (2026-07-25), so the measurement confirms a known, accepted position rather
than discovering a defect.

**Reading (b).** The task's own premise is "verify local development environment Nx cache HITs",
and zero HITs were found, so the premise is unmet and the shipped feature does not deliver its
value to the developer it was built for. Supporting facts: v0.0.1 shipped BOTH halves -- the
Phase 4 Releases publisher and the Phase 3 local client reader -- and the reader is demonstrably
healthy (authenticated, repo-identified, fault-free, correctly addressing `<hash>-<os>`), yet
there is no artifact for it to find: the mirror's 79 assets are 50 unreachable PoC-era `.tar.gz`
names plus 29 `run_id`-keyed proof seeds whose 11-digit keys cannot collide with a 20-digit task
hash by construction. A local developer therefore gets a MISS for every cacheable target, in every
graph state, today. On this reading the working publisher and working reader have never been
connected by a single real task artifact, and calling that outcome acceptable records a shipped,
audit-passed milestone as functional when its user-visible value is zero.

**This report chooses neither.** Both readings are consistent with every fact above; they differ
on what to call it, not on what happened. Per CONTEXT.md's UNRESOLVED item that label is the
maintainer's decision, and it is deliberately left open here.
