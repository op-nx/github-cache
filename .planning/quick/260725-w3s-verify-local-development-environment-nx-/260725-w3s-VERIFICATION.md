# Quick Task 260725-w3s: VERIFICATION

**Verified:** 2026-07-26
**Verifier:** gsd-verifier (independent; fresh context)
**Under verification:** commit `ba60101` on `gsd/quick-260725-rk4-dogfood-ci`
**Artifacts:** `260725-w3s-RESULTS.md` (new, 402 lines) + one row of `.planning/STATE.md`

## STATUS: passed

`passed` is the GOAL-ACHIEVEMENT verdict on the measurement task: was the measurement
performed and reported as the plan specified. It is **NOT** a resolution of the PASS/FAIL
outcome question.

**I did not resolve the PASS/FAIL outcome question.** Whether the measured all-MISS should be
labelled PASS or FAIL remains the maintainer's open decision per CONTEXT.md's UNRESOLVED item
and the maintainer's deferral to a post-merge re-measurement. Nothing in this report -- no
verdict word, no heading, no closing recommendation -- resolves it, implicitly or otherwise.
Per the PLAN's own `<verification>` block, observing a hit is "Explicitly NOT part of
completion" and all-MISS "is the predicted result and is not a task failure", so the all-MISS
was not treated as a goal-achievement failure.

Gaps: 0 blocking, 3 advisory. Human items: 1, pre-existing and already accepted.

---

## Per-must_have assessment

Note on counting: the PLAN carries **10** `must_haves.truths` (PLAN.md:17-26), 2 artifacts,
4 key_links -- not 11 truths. All 10 are assessed below.

| # | Truth (abbreviated) | Result | Evidence relied on |
|---|---|---|---|
| 1 | Both silent MISS causes ruled out BEFORE any Nx run, through the reader's own spawn shape, with exit code + non-empty stdout recorded | MET | RESULTS.md:123-152 records the probe output verbatim (`gh auth token` exit 0 / non-empty / RESOLVES / length only; `git remote get-url origin` exit 0 / RESOLVES / `https://github.com/op-nx/github-cache.git`) and the replicated `runHelper` options incl. `shell: false`. Independently corroborated: `$SCRATCH/w3s/tier-probe.out` is byte-identical, mtime 00:46, i.e. BEFORE the first Nx run at 00:48:32. No token material printed. |
| 2 | Sidecar a real separate process; readiness by the 401-wrong-bearer / 404-valid-bearer pair; torn down with port 41999 confirmed no longer listening | **PARTIAL** | Separate process MET: RESULTS.md:32-36 records the launch line, the bound URL read from the sidecar's own stdout, and background shell id `b9xla5nhj`; corroborated by `$SCRATCH/w3s/sidecar.out` = `github-cache serve listening on http://127.0.0.1:41999`. 404-on-valid-bearer MET and over-delivered: 8 real-hash GETs -> HTTP 404 (RESULTS.md:277-284; `read-path-probe.txt` identical). 401-on-wrong-bearer appears only as a parenthetical assertion (RESULTS.md:288) with no recorded status-code line for the `deadbeef` pair. **Teardown is not recorded anywhere in RESULTS.md** (`rg` over the file finds no teardown / kill / "no longer listening" statement). I checked the fact independently: `Get-NetTCPConnection -LocalPort 41999` returns nothing, so no sidecar leaked -- the requirement holds in fact, only its record is missing. |
| 3 | All four targets in ONE `run-many` per state; each task's label recorded VERBATIM | MET | `$SCRATCH/w3s/cold-run.log` is a single `run-many` with 4 task lines and no labels; `warm-run.log` a single `run-many` with `[local cache]` x3 + `[existing outputs match the cache, left as is]` x1. RESULTS.md:73-84 reproduces all 8 rows. The fourth label is outside the plan's three-value enum; recording it verbatim rather than coercing it is the faithful reading, and it is a LOCAL-hit variant (`CACHE_HIT_STATUSES` includes `local-cache-kept-existing`), not a remote label. |
| 4 | BOTH graph states measured and reported separately, task hash per target per state | MET | RESULTS.md:48-55 (recipes; COLD both dirs fresh, WARM a COPY of real `.nx/workspace-data` + fresh cache dir) and the 8-row table. All 8 hashes match `hashes-cold.txt` / `hashes-warm.txt` exactly. Predicted pairing confirmed: COLD `build` = 13655686526929222562, WARM `build` = 14522047022641658505. |
| 5 | `[remote cache]` label is the ONLY discriminator; every `Cache: n/m hit` recorded but marked non-discriminating in BOTH directions | MET | RESULTS.md:99-111 records both lines verbatim (`0/4 hit (0%)`, `4/4 hit (100%)`) and marks them non-discriminating in both directions, using this very run as a live two-way demonstration: the `0/4` co-exists with a demonstrably consulted remote, and the `4/4` was produced with zero remote consults. Checked sections 2-6: no conclusion anywhere leans on a `Cache:` line. |
| 6 | Every hash probed for BOTH `-windows` and `-linux`; each MISS attributed to a NAMED cause, with active vs unobservable distinguished | MET | RESULTS.md:182-201 tabulates 16 of 16 ABSENT, plus a wider probe (count of asset names containing each bare hash under any suffix = 0). Cause (1) is established POSITIVELY, not inferred from the MISS. Causes (2) and (3) are labelled UNOBSERVABLE behind (1) and explicitly "NOT tested" in two places (RESULTS.md:211-216 and section 5). No claim that (2) or (3) was tested. An extra independent discriminator is recorded: 11-digit run-id keys cannot collide with 20-digit task hashes by construction. |
| 7 | Sidecar stderr captured to a file and recorded verbatim | MET | RESULTS.md:222-235: 0 bytes, checked after COLD, after WARM, and after 8 further authenticated GETs; the `warnOnce`-is-per-process limit is stated so the signal is not over-read. Corroborated: `$SCRATCH/w3s/sidecar.err` is 0 bytes on disk. |
| 8 | Nothing under the real `.nx/` written; both `NX_*` dir vars on every invocation; warm graph from a COPY; no `nx reset` | MET | RESULTS.md:56-67 records an identical recursive fingerprint (6747 files / 40785023 bytes / newest mtime 2026-07-25T22:39:52.371Z) before, after COLD, and after WARM, with the newest mtime predating the first invocation. Copy byte-clean (184320 == 184320). Independently, a FOURTH fingerprint exists in the scratchpad -- `nx-final.txt`, mtime 00:58, i.e. after the executor-added dead-port and gate runs -- and is byte-identical to `nx-before.txt`. So the claim holds across the two extra runs too; RESULTS.md under-reports rather than over-reports here. `nx reset` not run (RESULTS.md:26). |
| 9 | Both readings presented, NEITHER chosen; no verdict word as the report's conclusion | MET | Section 6 lays out reading (a) and reading (b), each with its own supporting facts, and closes "This report chooses neither." A scan of all 19 headings finds no verdict word. The only verdict-adjacent words in the file (`v0.0.1-compliant`, `audit-passed`) sit INSIDE their respective readings, attributed to that reading. |
| 10 | STATE.md cross-OS row: evidence framing corrected; deferral decision, severity framing, milestone standing unchanged; existing evidence not deleted | MET | `git show ba60101 --word-diff=porcelain` on STATE.md yields a single `+` block and NO `-` block: the edit is INSERT-ONLY, so no pre-existing evidence was deleted. The status column is still `later milestone (maintainer decision, 2026-07-25)`. The severity framing ("NOT a v0.0.1 defect", "This is deferred VALUE") and the TEST-05 compliance sentence are intact. `--stat` shows 1 insertion / 1 deletion confined to that one row; no frontmatter, no other row, no Session Continuity change. TEST-05's acceptance was read directly at `.planning/milestones/v0.0.1-ROADMAP.md` ("asserts a cross-OS lookup returns a correct hit or a MISS - never a wrong-OS artifact") and matches what both RESULTS.md and the amended row cite. |

### Artifacts

| Artifact | Result | Evidence |
|---|---|---|
| `260725-w3s-RESULTS.md` -- per-target x per-state table, four attribution signals, both readings | MET | Present and committed in `ba60101` (402 lines). All six required sections in the specified order, incl. the exact env (port, both `NX_*` dir vars, both `NX_SELF_HOSTED_*` client vars) with the token value never recorded. |
| `.planning/STATE.md` -- cross-OS Value row, evidence framing only | MET | See truth 10. |

### Key links

| Link | Result | Notes |
|---|---|---|
| Sidecar PORT == port in `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`; sidecar token == `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` | **PARTIAL** | Port half proven: the bound URL was read from the sidecar's own stdout and equals the client var, and the dead-port control proves transport to 41999 worked during the runs. Token half proven for the DIRECT probes (valid bearer -> 404, not 401) but not independently for Nx's own client. See advisory gap A2. |
| Recovered hash -> `<hash>-<os>` probed against release 354838660 (`cache-mirror-202607`) | MET | 16/16 ABSENT; shard confirmed 200 with 79 assets, and 202608 / 202606 both 404, so the shard window is positively excluded as a cause. |
| Predicted COLD/WARM `build` hash pairing | MET | Both predicted values reproduced exactly, and it is precisely this pairing the STATE.md correction records. |
| A 403 on Nx's cache PUT is expected and must never be cited as a MISS cause | MET | RESULTS.md:113-117 records it as observed-and-expected. Checked: the `attributed cause` column cites it nowhere. |

---

## Where the goal actually lives -- substantive weighing

### Measurement soundness precedes attribution: yes, and beyond the plan

The Releases reader degrades every fault to a MISS by design, so an all-MISS carries no
information until the measurement is proven sound. The record establishes soundness FIRST
(tier probe at 00:46, first Nx run at 00:48:32) and then goes further than the plan required.
Two executor-added controls, both read-only, both through the shipped surface, are recorded
with their own honest limits:

- **Dead-port differential control.** A COLD run against a refusing port 41998 fails loudly
  (`NX Failed to send request ... /v1/cache/13758457399293023985`) and exits 1 -- so the clean
  exit 0 on 41999 means Nx's requests did reach the sidecar, and the error text proves Nx
  addresses `/v1/cache/<task-hash>` with exactly the hash values tabulated. The record states
  the limit itself: the message appears after `Successfully ran targets`, consistent with the
  post-run PUT, so it does not isolate the read half.
- **Direct read-path probe on all 8 real hashes** through the shipped sidecar with a valid
  bearer -> 8 clean 404s, stderr still 0 bytes. This is what converts the all-MISS into an
  attributable absence. The residual limit is recorded as a mechanism argument, not a
  measurement.

Silent-MISS causes left OPEN, assessed one by one:

- **Shard window / wrong shard: CLOSED.** Positively excluded with three status codes.
- **Nx-side bearer mismatch: OPEN in the record.** See advisory gap A2 -- neutralized for the
  conclusion, but unnamed.
- **Stale `dist/serve.js`: OPEN in the record.** See advisory gap A3 -- I checked it
  independently and it holds.
- **Wrong or unpopulated shard as an artifact of the naming probe:** closed by the wider
  bare-hash containment probe (0 hits under any suffix).

### Attribution soundness: sound, and honestly bounded

The central inference is not asserted. Probing both `<hash>-windows` and `<hash>-linux` for all
8 hashes returns 16 ABSENT, which establishes cause (1) positively rather than deriving it from
the MISS, and the record does NOT claim causes (2) or (3) were tested -- both are named
UNOBSERVABLE behind (1) and stated as "NOT tested" twice. The substantive defect the
orchestrator warned about (claiming a masked cause was tested) is absent. RESULTS.md also
separates "a confound in the existing EVIDENCE for cause (3)" from "testing cause (3)", which is
the distinction the STATE.md edit turns on.

### Signal discipline: met, with an unusually strong demonstration

Rather than merely asserting RESEARCH 4a, the report shows the non-discrimination in both
directions from its own two runs. No conclusion leans on a `Cache: n/m` line.

### Both graph states: WARM correctly downgraded, not laundered

The predicted WARM risk materialized -- the copied DB's `cache_outputs` rows served all four
tasks locally against an empty artifact dir, so the remote was never consulted. The record marks
those four Nx labels INCONCLUSIVE and answers the warm hashes with the direct asset and
read-path probes instead. It does NOT present them as measured remote misses. The copied DB was
not edited and the real `.nx/` was not re-run against.

### Blast radius: confined

`ba60101` touches exactly two files: the new RESULTS.md and one STATE.md row (insert-only). No
source, workflow, or consumer-contract change -- consistent with the verify-only lock.

---

## Gaps

### Advisory

**A1 -- Sidecar teardown is not recorded.**
Attached to: PLAN.md truth 2, PLAN.md Task 3 step 3e and its `<verify>` line ("The sidecar
process is gone and port 41999 refuses connections"); missing from RESULTS.md section 1.
RESULTS.md records the launch and the background shell id but contains no teardown statement and
no post-kill port check. Independently checked and factually satisfied: nothing is listening on
41999. Fix is one line in RESULTS.md section 1 recording the kill and the port check; no
re-measurement needed. Also in this bucket: the 401-on-wrong-bearer half of the readiness pair
appears only as a parenthetical claim, with no recorded status-code line for the `deadbeef`
probe (the 404-on-valid-bearer half is over-evidenced by 8 real-hash 404s).

**A2 -- One silent-MISS channel is unnamed: a client-side 401 to Nx.**
Attached to: PLAN.md `key_links` item 1; RESULTS.md section 5 (the "what was NOT tested" list).
If Nx's `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` had not matched the sidecar's, the server's
auth layer would answer Nx 401 -- and `sidecar.err` is the BACKEND fault channel, so a 401 at
the auth layer would not appear there. RESULTS.md asserts token equality by construction ("the
same throwaway token") and never names this channel. Section 5's "whether Nx itself issued the
GET" is a near neighbour but not the same case (issued-and-refused vs never-issued).
**Neutralized for the conclusion:** the 8 direct read-path probes exercise the same shipped read
path on the same 8 hashes with a bearer proven accepted (404, not 401), so the ABSENCE
attribution does not depend on Nx's auth at all. Fix is one bullet in section 5.

**A3 -- `dist/serve.js` currency is inherited from the plan, not evidenced.**
Attached to: RESULTS.md section 1 (the sidecar row asserts the shipped bin "IS the consumer
surface" but records no check that the built bin matches the current read path). A `dist/serve.js`
predating the current source would mean the measurement exercised an older reader. I checked it
independently and it holds: `tsc --build tsconfig.lib.json` ran twice after the last emit (the
RESEARCH smoke run and the COLD run) and emitted nothing new, which is exactly tsc's
outputs-newer-than-inputs certification; the only source file newer than the newest dist output
is `packages/github-cache/src/test/octokit-fault.ts`, a spec-only fixture imported solely by
`*.spec.ts` and not reachable from `serve()`. Fix is to record that check, not to re-measure.

### Blocking

None.

---

## Human items

**H1 (PRE-EXISTING, already accepted -- does not drive this status).** Whether the measured
all-MISS is labelled PASS or FAIL. Recorded as UNRESOLVED in CONTEXT.md (HIGH impact, NOT-HIGH
confidence, so the trap-quadrant rule forbade auto-locking it) and deferred by the maintainer
until after a post-merge re-measurement. RESULTS.md section 6 presents both readings with their
supporting facts and picks neither, which is what the plan required of it. This verification did
not resolve it and did not let it influence the goal-achievement verdict.

No new human items.
