---
phase: quick-260725-w3s
plan: 01
status: complete
date: 2026-07-25
branch: gsd/quick-260725-rk4-dogfood-ci
base_commit: e4362066870ca2085bcb09e765c1c0d2ffb90037
commits:
  - ba6010142e4135bfec3cc0c41b179cb92cfd1045  # Task 3: RESULTS.md + STATE.md evidence framing
tasks_executed: 3
tasks_total: 3
outcome_label: PASS  # maintainer decision 2026-07-26, post-Step-0; was DELIBERATELY-OPEN at execution time
---

# Quick Task 260725-w3s: SUMMARY

Verify-only. Measured whether a local developer environment gets an Nx remote cache HIT for every
cacheable target through the shipped v0.0.1 surface, and attributed every MISS to a named cause.
No source file, workflow file, doc, or consumer contract was changed. Full record in
`260725-w3s-RESULTS.md`.

**Result: zero remote cache hits, all four targets, both graph states.** Cause (1) "nothing
published in the current naming scheme" is confirmed ACTIVE for every hash. Causes (2) and (3) were
NOT tested -- they are unobservable behind cause (1).

---

## Preconditions (verbatim, run BEFORE any Nx invocation)

Probed through the reader's own spawn shape, replicating `runHelper`'s options from
`packages/github-cache/src/lib/local-context.ts:42-90` (`shell: false`, `timeout: 5000`,
`killSignal: 'SIGKILL'`, `windowsHide: true`, env spread with `GIT_TERMINAL_PROMPT=0`,
`GIT_ASKPASS=''`, `SSH_ASKPASS=''`):

```
PROBE gh auth token | exit 0 | stdout non-empty true | RESOLVES | stdout length 40 (value never printed)
PROBE git remote get-url origin | exit 0 | stdout non-empty true | RESOLVES | stdout "https://github.com/op-nx/github-cache.git"
ENV GITHUB_ACTIONS | UNSET
ENV GH_TOKEN | UNSET
ENV GITHUB_TOKEN | UNSET
ENV GITHUB_REPOSITORY | UNSET
PLATFORM process.platform | win32
```

Sidecar (real separate process, shipped bin `packages/github-cache/dist/serve.js`, background shell
id `b9xla5nhj`):

```
bound URL (from the sidecar's own stdout): http://127.0.0.1:41999
readiness: wrong bearer   -> HTTP 401   (listener up, auth live)
readiness: correct bearer -> HTTP 404   (request reached a backend get, which MISSED)
sidecar stderr: 0 bytes, verbatim empty, at every checkpoint
teardown: process killed; post-teardown probe curl exit 7 (connection refused), Get-NetTCPConnection reports port 41999 clear in every state
```

Both silent MISS causes are therefore ruled out by measurement: no-token-resolved
(`releases-backend.ts:306`) and no-repo-identity-resolved (`releases-backend.ts:316`). The token
value was never printed or recorded anywhere.

---

## Measurement table (per target x per state)

| target | state | cache label (verbatim) | task hash | `-windows` in shard | `-linux` in shard | attributed cause |
|---|---|---|---|---|---|---|
| build | COLD | *(no label)* | 13655686526929222562 | ABSENT | ABSENT | (1) ACTIVE |
| typecheck | COLD | *(no label)* | 3381254060286801611 | ABSENT | ABSENT | (1) ACTIVE |
| test | COLD | *(no label)* | 5027851155743781967 | ABSENT | ABSENT | (1) ACTIVE |
| integration | COLD | *(no label)* | 13758457399293023985 | ABSENT | ABSENT | (1) ACTIVE |
| build | WARM-GRAPH | `[local cache]` | 14522047022641658505 | ABSENT | ABSENT | INCONCLUSIVE via Nx; (1) via direct probe |
| typecheck | WARM-GRAPH | `[local cache]` | 17612203514283256006 | ABSENT | ABSENT | INCONCLUSIVE via Nx; (1) via direct probe |
| test | WARM-GRAPH | `[local cache]` | 12332927989897543193 | ABSENT | ABSENT | INCONCLUSIVE via Nx; (1) via direct probe |
| integration | WARM-GRAPH | `[existing outputs match the cache, left as is]` | 18311993323643153366 | ABSENT | ABSENT | INCONCLUSIVE via Nx; (1) via direct probe |

No `[remote cache]` label appeared anywhere. `Cache:` lines recorded -- COLD `0/4 hit (0%)`,
WARM-GRAPH `4/4 hit (100%)` -- and **not used to discriminate** in either direction
(`CACHE_HIT_STATUSES` counts local and remote identically, RESEARCH 4a). This run demonstrates both
directions live: the `4/4 hit (100%)` was produced with zero remote consults.

Cause key: **(1)** nothing published in the current naming scheme; **(2)** OS suffix; **(3)** hash
parity.

---

## Attribution per MISS

Every MISS in the table is attributed to cause **(1)**, established positively rather than inferred
from the MISS:

- All 8 recovered hashes x both OS suffixes = **16 of 16 asset probes ABSENT** against the live
  shard `cache-mirror-202607` (release id 354838660, 79 assets).
- A wider probe: for each of the 8 hashes, the count of shard asset names containing that hash
  **under any suffix at all** is **0**. The absence is not an artifact of the two names probed.
- The 79 live assets are 50 `.tar.gz` (PoC-era, unreachable because `releaseAssetName` emits
  `<hash>-<os>` with no extension) + 24 `<run_id>-<os>` + 5 `cafe<run_id>-linux`. The `<run_id>`
  prefixes are 11 digits; every task hash here is 20 digits, so a run-id-keyed name cannot collide
  with a task-hash lookup by construction, independent of the OS suffix.
- The shard window is NOT a cause: `cache-mirror-202607` -> 200 and is FIRST in the walk;
  `cache-mirror-202606` -> 404 (clean window exhaustion); `cache-mirror-202608` -> 404 (does not
  exist yet). Re-verified after the local date rolled to 2026-07-26.
- No non-404 fault occurred: sidecar stderr 0 bytes after both runs and after 8 further
  authenticated real-hash GETs. So no MISS is a suppressed 401/403/429/5xx, DNS failure, or timeout.
- Nx printed nothing about failing to WRITE to the remote and exited 0. The off-CI backend is
  read-only by construction, so a 403 on PUT is expected; it is recorded and is cited as a cause
  nowhere.

**Causes (2) and (3) are UNOBSERVABLE BEHIND cause (1) and were not tested.** No hash showed
`-linux` present with `-windows` absent, so cause (2) was never promoted to active and cause (1) is
refuted for no hash. No hash showed `-windows` present, so no result had to be re-checked as a real
fault.

---

## Two-state finding

All four targets compute a **different task hash** depending only on `.nx/workspace-data`
freshness, on one machine, same OS, same commit. RESEARCH 4c had measured this for `build` alone.

| Value | STATE.md attributes it to | This task reproduces it as |
|---|---|---|
| 14522047022641658505 | ubuntu CI (probe run 30173654069) | WARM-GRAPH Windows |
| 13655686526929222562 | windows-11-arm CI (same run) | COLD Windows |

Both halves of the pair STATE.md cites as the cross-OS divergence measurement are reproducible on
one Windows box by varying only workspace-data freshness. The divergence is not disproven (CI is
always cold, and cold-Windows here equals the recorded cold-Windows value), but the pair does not
isolate OS as the variable. Recorded into the existing STATE.md row as evidence framing only.

---

## What could NOT be observed, and why

- **Cause (2), OS suffix** -- needs a hash whose `-linux` asset exists in the shard. None of the 8
  does, under any suffix. Hidden behind cause (1).
- **Cause (3), cross-OS hash parity** -- hidden behind cause (1), and untestable from one machine
  regardless; it needs node-by-node hash comparison between native Windows and a Linux clone at the
  same commit.
- **The `@actions/cache` version-hash layer** -- the keys have never collided, so it has never been
  exercised.
- **The cross-OS publish gap** -- a ubuntu `publish-mirror` cannot restore Windows-saved Actions
  cache entries, so Windows-computed hashes never reach the mirror. Not exercised here.
- **The WARM-GRAPH Nx labels as remote evidence** -- the remote was never consulted for those four
  tasks (see deviation 3), so their labels carry no information about the remote in either
  direction. Answered by the direct asset + read-path probes instead.
- **Whether Nx itself issued the GET** (as opposed to the shipped read path being driven directly on
  the same hashes) -- rests on one measured fact (transport to 41999 demonstrably worked) plus one
  source-level fact (`cache.js:71-99`). A mechanism argument, recorded as such, not a direct
  measurement.
- **The publisher writing a real task artifact** -- no `nx-cache-<taskhash>` Actions entry from
  `main` has ever been mirrored. That is what PR #4 changes, and PR #4 is not merged.

---

## Deviations from the plan, with reasons

1. **No commit for Tasks 1 and 2.** Both tasks' `<files>` lists are scratchpad-only by the plan's
   own definition, so neither produced a repo-file change to commit. Only Task 3 has a commit
   (`ba60101`). The one-commit-per-task rule is satisfied as far as there was anything to commit;
   no empty commits were fabricated.
2. **`read-hashes.mjs` had to copy the `-wal` and `-shm` sidecars alongside the `*-v3.db`.** The
   plan's recipe (copy the `.db`, open with `node:sqlite` `readOnly: true`) failed with
   `no such table: task_details`: Nx leaves the DB in WAL mode, so the bare `.db` is a 4 KB stub
   (4096 bytes of `.db` against a 197792-byte `-wal`). Copying all three files fixed it and
   `readOnly: true` was retained as specified. A read-write-on-copy fallback was coded but never
   taken.
3. **WARM-GRAPH Nx labels are INCONCLUSIVE for all four tasks.** This is the risk the plan
   pre-declared, and it fired: the copied DB's `cache_outputs` rows served all four tasks locally
   against an empty artifact directory (`warm/nxcache` held only `run.json` and `terminalOutputs`),
   so Nx never consulted the remote. Handled exactly as prescribed -- recorded verbatim as
   INCONCLUSIVE, answered by Task 3's direct `<hash>-<os>` probe. The copied DB was NOT edited to
   force a miss and the real `.nx/` was NOT re-run against.
4. **Warm hash recovery needed a join, not the plan's bare `SELECT d.hash, d.target FROM
   task_details d`.** The warm DB is the real accumulated history with 52+ rows and many hashes per
   target, so the bare query cannot say which hash *this* run used. Resolved by joining
   `cache_outputs` and ordering by `accessed_at`; the four warm hashes are pinned by
   `accessed=2026-07-25 22:50:31`, the warm run's own timestamp. The COLD state needed no join (its
   DB is fresh and holds exactly four rows, which also match the four artifact directory names
   under `cold/nxcache`).
5. **Two soundness controls added beyond the plan.** The sidecar has no request logging, so the
   plan's preconditions could not distinguish an all-MISS from a remote that was never consulted --
   the exact false negative this task most needed to avoid. Added: (a) a dead-port differential
   `run-many` (Nx fails loudly, exit 1, naming
   `http://127.0.0.1:41998/v1/cache/13758457399293023985` -- a real recovered COLD hash), proving
   Nx addresses `/v1/cache/<task-hash>` with the tabulated values and that the 41999 runs' silent
   exit 0 means the requests landed; and (b) a direct GET of all 8 real hashes through the shipped
   sidecar with the valid bearer, all returning HTTP 404 with stderr still 0 bytes. Both are
   read-only, both go through the shipped surface, neither injects a backend or stubs a client, and
   neither changes any verdict row -- the table's labels remain the real sidecar runs'.
6. **The green checks were run with the scratchpad `NX_*` directories.** `npm run format:check` and
   `npm run test` are themselves `nx` invocations; running them bare would have written to the real
   `.nx/` and broken the plan's "nothing under the real `.nx/` is written" must-have. Both were run
   with `NX_CACHE_DIRECTORY`/`NX_WORKSPACE_DATA_DIRECTORY` pointed into the scratchpad instead.
   `format:check` exit 0; `test` exit 0, 430 tests in 30 files. `.planning/` is prettier-ignored
   (`.prettierignore:19`) -- confirmed by reading it, not assumed.
7. **Scratchpad files live in a `w3s/` subdirectory** of the session scratchpad. The parent already
   held quick-260725-rk4 artifacts including an `assets.txt`, which a flat layout would have
   silently overwritten.
8. **`260725-w3s-PLAN.md`, `-CONTEXT.md` and `-RESEARCH.md` are still untracked.** They were
   untracked when this executor started and are outside the stated write scope (RESULTS.md +
   STATE.md only), so they were deliberately not staged. Flagged for the orchestrator to handle
   alongside the SUMMARY.

---

## Plan constraints, verified

| Constraint | Status |
|---|---|
| Nothing under the real `.nx/` written | HELD. Recursive fingerprint (6747 files, 40785023 bytes, newest mtime 2026-07-25T22:39:52.371Z) byte-identical before the first run, after COLD, after WARM-GRAPH, and at the end. That mtime predates the first Nx invocation (22:48:32Z). |
| Both `NX_*` dir vars into the scratchpad on every `nx` invocation | HELD, including the two green checks. |
| Warm graph read from a COPY | HELD. Copy and source both 184320 bytes -- clean, not torn. |
| No `nx reset` | HELD. |
| No `--skip-nx-cache` | HELD. |
| One `run-many` per state over all four targets | HELD. |
| Sidecar torn down, port confirmed clear | HELD. curl exit 7 post-teardown; `Get-NetTCPConnection -LocalPort 41999` returns nothing in any state. |
| Token value never recorded | HELD, in RESULTS.md, this SUMMARY, the commit message, and every quoted log excerpt. |
| Branch untouched (no create/switch/delete, no push, no PR change) | HELD. Still on `gsd/quick-260725-rk4-dogfood-ci`. |
| STATE.md edit scoped to the cross-OS Value row | HELD. `git diff` = 1 line changed; deferral status string, TEST-05 compliance statement, severity framing, milestone standing, frontmatter and Session Continuity all unchanged. |
| RESULTS.md presents both readings and picks neither | HELD. No verdict word in any heading or the closing line. |

---

## Outcome label

**Not decided here.** CONTEXT.md's UNRESOLVED item -- whether an all-MISS result is a PASS or a
FAIL -- is the maintainer's call. RESULTS.md section 6 presents both readings side by side against
the measured facts and chooses neither, and this SUMMARY does not resolve it either. The verifier
should likewise not convert the all-MISS into a `passed` or a `gaps_found` on its own initiative.

**Maintainer decision, 2026-07-25: DEFERRED** until after the Step 0 post-merge re-measurement.
The label stays open; it is not a PASS and not a FAIL yet.

**RESOLVED 2026-07-26: PASS** (maintainer decision, reading (a), taken with the Step 0 evidence
in hand -- see `260725-w3s-STEP0-RESULTS.md` and the resolution block in CONTEXT.md). The
verification correctly established current behavior, and Step 0 confirmed its central attribution
by repair: once real `<taskhash>-<os>` assets existed, the same read path on the same machine HIT.
`260725-w3s-RESULTS.md` is deliberately NOT edited -- its neutrality is a verified must_have and
the measurement record stands as measured.

---

## Verification

`gsd-verifier`, independent and fresh-context, verdict in `260725-w3s-VERIFICATION.md`.

**STATUS: passed** -- a goal-achievement verdict on the measurement (was it performed and reported
as specified), explicitly NOT a resolution of the outcome label. 10 of 10 `must_haves.truths` MET,
2 of 2 artifacts MET, 3 of 4 key_links MET with 1 PARTIAL. Zero blocking gaps, three advisory.

It did not take the record on trust -- it re-derived the load-bearing facts independently:
`Get-NetTCPConnection` to confirm no leaked sidecar, `git show --word-diff=porcelain` to prove the
STATE.md edit is INSERT-ONLY (so no pre-existing evidence was deleted), TEST-05's acceptance text
read from the ROADMAP rather than from a summary, and a FOURTH `.nx/` fingerprint found in the
scratchpad that this SUMMARY had under-reported.

All three advisory gaps were "the fact holds, the record does not say so", each independently
confirmed by the verifier and now folded into the artifacts:

| Gap | Substance | Resolution |
|---|---|---|
| A1 | RESULTS.md recorded no teardown, and the 401-wrong-bearer half of the readiness pair was a parenthetical with no captured status line | RESULTS.md section 1 now records the teardown + port check, and marks the 401 an operator observation rather than a reproducible artifact. Teardown was already recorded in this SUMMARY. |
| A2 | A client-side 401 to Nx was an UNNAMED silent-MISS channel. `sidecar.err` is the BACKEND fault channel, so an auth-layer rejection would never appear there. | Named in RESULTS.md section 5. Neutralized for the conclusion: the 8 direct read-path probes use a bearer proven accepted (404, not 401), so cause (1) does not rest on Nx's auth. |
| A3 | `dist/serve.js` currency was inherited from the plan, never evidenced | Recorded in RESULTS.md section 1: `tsc --build` ran twice after the last emit and emitted nothing; the only newer source is a spec-only fixture unreachable from `serve()`. |

### Plan-check gate: NOT satisfied (recorded as a gap, not a pass)

The independent pre-execution plan-check was never obtained. `gsd-plan-checker` was attempted
three times across two sessions and went idle without returning a verdict four times -- including
once with all network and `nx` work explicitly capped out, which disproves the earlier theory that
live probing was stalling it. The orchestrator's inline check stands recorded as
self-certification, NOT as a pass.

Not re-attempted with a substitute agent, deliberately: the two questions that gave the gate its
value -- measurement soundness under D-11, and whether the `-windows`/`-linux` probe pair genuinely
discriminates the three causes -- were folded into the verifier's brief as checks 1 and 2 and
answered there independently. A third agent asking the same questions would have been ceremony.

Tooling note for future sessions: both agents DID the work and failed only at returning final
text. The verifier's output survived because it was briefed to write a FILE; the plan-checker's was
lost because it was briefed to return text only. Give flaky agents a file deliverable.
