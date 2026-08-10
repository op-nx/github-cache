---
phase: 11-live-proofs-o1-o2-o3
plan: 04
subsystem: testing
tags: [producer-attribution, actions-cache, releases-mirror, pagination, exact-key-equality, job-windows, obs-03-label, perishable-window, evidence, blocking-checkpoint]

# Dependency graph
requires:
  - phase: 11-live-proofs-o1-o2-o3
    plan: 01
    provides: "the graph premise record (M1), which carries the build and typecheck rows structurally where no per-hit fingerprint exists"
  - phase: 11-live-proofs-o1-o2-o3
    plan: 02
    provides: "the MEASURED shard pagination trap (30 of 141 assets, zero nx-cache- names on a single page), cited here rather than re-derived, and the four hashes' PRESENT verdicts"
  - phase: 11-live-proofs-o1-o2-o3
    plan: 03
    provides: "the four hit hashes, their cacheStatus set, and the per-hit terminalOutput runner-path fingerprints (M2) captured while the restored artifacts still existed"
  - phase: 10-os-invariant-releases-mirror
    provides: "run 30471772954 as the producing run, the 16 new-form labelled assets, D-03's clock, and the live publisher-not-producer instance (M4)"
  - phase: 09-os-invariant-actions-cache-version
    provides: "the pre-Phase-9 producer-attribution snapshot (D-34), CITED per D-15 and neither re-derived nor spent"
provides:
  - "11-EVIDENCE.md attribution section: TEST-08's own mandated capture, per hit hash, at proof time -- Actions-cache entry list plus shard asset list with created_at and the OBS-03 label, cross-referenced against job windows"
  - "Producer attribution COMPLETE 4 of 4: build/typecheck/test -> LINUX, integration -> WINDOWS, each naming which of the four means M1-M4 carried it AND that means' limit"
  - "MEASURED: the job-window cross-reference resolves a UNIQUE runner OS for all four hashes, including build and typecheck whose terminalOutput fingerprint is UNAVAILABLE -- so the two rows M2 cannot reach are carried by a means that was measured, not assumed"
  - "MEASURED: D-14's retraction as arithmetic -- integration was PRODUCED inside the windows-11-arm sidecar window and PUBLISHED inside the ubuntu publish step 55.16 seconds later, two runner labels apart"
  - "MEASURED: the build hash was written by the typecheck job, whose sidecar preceded the build job's by three seconds -- the graph premise's own observation appearing as live server-side metadata"
  - "MEASURED: last_accessed_at reads 17:5x rather than 21:44, so the O1/O2 local read provably never reached the Actions cache -- live corroboration of the probe's Releases-backend finding"
  - "MEASURED: the Actions-cache half closes ~23 days earlier than the mirror half, so taking it first was load-bearing rather than tidy"
  - "The maintainer's explicit authorisation to proceed into the hash-rotating waves, on record beside the numbers it was taken against"
affects: [11-05, 11-06, 11-07, 12, TEST-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bound a cache write by the leg's SIDECAR-ALIVE window rather than by its target-run step -- no entry can be created while the sidecar is down, which correctly excludes same-OS legs that run the target with no sidecar"
    - "When a timing means yields several candidate windows, report what it DOES resolve (the OS) and what it does NOT (the job), rather than collapsing both into one verdict"
    - "Ship a retraction with arithmetic on the record's own load-bearing value, so the correction leaves a reader something to use instead of an argument for undoing the work"
    - "Re-measure an inherited pagination trap on the current session's own data, so this capture's ABSENT/PRESENT verdicts cannot rest on a reader artifact from a different session"

key-files:
  created:
    - .planning/phases/11-live-proofs-o1-o2-o3/11-04-SUMMARY.md
  modified:
    - .planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md

key-decisions:
  - "The maintainer selected `proceed` at task 2's blocking decision checkpoint. NOT self-approved: workflow.auto_advance and workflow._auto_chain_active were both verified false, and the checkpoint was returned to the orchestrator with all three options, the numbers the decision was taken against, and three weaknesses surfaced explicitly"
  - "The SUMMARY was deliberately NOT written at the checkpoint. The plan's <output> contract requires it to carry the selected option id, which did not exist yet -- 11-02 set the same precedent in this phase"
  - "The bounding window for a cache write is the leg's sidecar-alive window, not its target-run step. Three ubuntu legs (dogfood-seed, pack-check, hash-parity) run npm run build with NO sidecar and are correctly excluded as writers"
  - "Both refs' entries are recorded rather than one being silently chosen. Exact-key equality returns TWO entries per hash; refs/heads/main is the mirror's source because publish is gated on push to main, which is structural rather than a preference"
  - "requirements mark-complete was SUPPRESSED for this plan's frontmatter IDs. TEST-08 spans O1-O4 and O4 is Phase 12's; XOS-01 and XOS-02 are already Complete with corrected rows. The blanket flip had nothing to gain and one forbidden effect"
  - "The PR-ref window containment was NOT re-derived. RESEARCH.md's U-01 section (1) already measured it across three runs including 30471172051, so it is cited"

patterns-established:
  - "A perishable capture states its own clock as a measurement and orders its halves by it -- the Actions-cache half went first because it closes ~23 days earlier, not because it felt riskier"
  - "Every attribution row names the means that carried it, that means' limit, AND which means do NOT apply and why -- a blank cell would read as an unmeasured gap rather than as an inapplicable instrument"
  - "A blocking sign-off checkpoint surfaces the WEAKNESSES a reviewer should weigh, not only the numbers that passed, so the authorisation is informed rather than rubber-stamped"

requirements-completed: []

coverage:
  - id: D1
    description: "Per hit hash, the Actions-cache entry list and the shard asset list are captured with created_at and the OBS-03 mirrored-by label, and cross-referenced against job windows (TEST-08's own mandated capture)"
    requirement: TEST-08
    verification:
      - kind: integration
        ref: "142 Actions-cache entries and 141 shard assets read with --paginate at 2026-07-29T22:04:12Z, gh 2.86.0, read-only GET only. Per hash: Actions-cache created_at, last_accessed_at, ref and size (two entries each, on refs/heads/main and refs/pull/10/merge); shard asset created_at and label. Cross-referenced against all 22 job legs of run 30471772954, bounding each entry by the leg's sidecar-alive step window"
        status: pass
      - kind: integration
        ref: "No hash read ABSENT -- all four still present at capture time. The ABSENT literal is carried in the record as the value an eviction would have produced, so an eviction would have been a fact about the clock rather than a gap in the proof"
        status: pass
    human_judgment: false
  - id: D2
    description: "Attribution is established by the four independent means, and each hash states WHICH means carried its verdict, with that means' limit stated too"
    requirement: TEST-08
    verification:
      - kind: integration
        ref: "Per-hash table with a Carried by column keyed M1-M4, plus a means table giving each means' limit. build -> LINUX (M3 primary, M1 corroborating, M2 unavailable, M4 N/A); typecheck -> LINUX (same, three same-OS windows); test -> LINUX (M2 primary + M3 + M1, three means agreeing); integration -> WINDOWS (M2 primary + M3 + M4 cited, M1 N/A). Every inapplicable means is stated with its limit rather than left blank"
        status: pass
    human_judgment: false
  - id: D3
    description: "09-EVIDENCE.md's pre-Phase-9 producer-attribution snapshot is CITED, not re-derived and not spent (D-15)"
    requirement: TEST-08
    verification:
      - kind: integration
        ref: "Cited by section name (## Producer-attribution snapshot (D-34)) with its 2026-07-28T20:30:55Z capture time, commit 72eeca3 and its 106 unlabelled shard assets, plus the one-sentence statement that Phase 11's capture is the SECOND half of a two-part record. Contents deliberately not re-enumerated; the snapshot was not re-run and its one-shot observation was not consumed"
        status: pass
    human_judgment: false
  - id: D4
    description: "No claim that mirrored-by answers the producing OS appears anywhere; the retraction carries a replacement means rather than only a deletion (D-14)"
    requirement: TEST-08
    verification:
      - kind: integration
        ref: "The retraction is restated WITH a measured replacement: integration produced inside integration (windows-11-arm)'s sidecar window 16:43:22Z-16:43:42Z and published inside publish (ubuntu-24.04-arm)'s mirror step 16:44:24Z-16:44:47Z, 55.16s and two runner labels apart. An automated sweep for mirrored-by co-occurring with produc* on one line returns only the retraction sentence itself and a table header whose Producer column is separate. The shipped source surface was swept independently: ci.yml:1235 reads 'a PUBLISHER identity, never a ...' and read-back.ts / publish-mirror.ts / release-asset-name.ts all frame the label as publisher"
        status: pass
    human_judgment: false
  - id: D5
    description: "The maintainer signs off on O1 and O2 BEFORE any hash-rotating edit lands"
    requirement: TEST-08
    verification:
      - kind: integration
        ref: "Selected option id `proceed`, recorded verbatim below. Auto mode verified inactive on both flags before the checkpoint returned. git status --porcelain packages/ .github/ start-cache-server/ printed nothing both before and after this plan's only commit, so the sign-off provably preceded the first rotation"
        status: pass
    human_judgment: true

# Metrics
duration: 23min
completed: 2026-07-29
status: complete
---

# Phase 11 Plan 04: Producer Attribution at Proof Time, and the Rotation Sign-Off Summary

**TEST-08's producer attribution is CAPTURED, 4 of 4, at the last commit where nothing had rotated -- and the job-window cross-reference turned out to resolve a UNIQUE runner OS for all four hashes, including the two whose in-artifact fingerprint does not exist. `build`, `typecheck` and `test` are LINUX; `integration` is WINDOWS. D-14's retraction now ships arithmetic rather than reasoning: `integration` was produced on `windows-11-arm` and published from `ubuntu-24.04-arm` 55.16 seconds later, which is exactly why its label reads `mirrored-by: linux`. The maintainer selected `proceed`.**

## Performance

- **Duration:** 23 min (including the blocking checkpoint wait)
- **Started:** 2026-07-29T22:02Z
- **Completed:** 2026-07-29T22:25Z
- **Tasks:** 2 (1 auto, 1 blocking decision checkpoint)
- **Files created:** 1. **Files modified:** 1

## The selected option

**`proceed`** -- recorded verbatim, as the plan's acceptance criteria require.

**Selecting `proceed` was understood to rotate `test`, `typecheck`, `integration` and `lint`,** and to make O1 unrepeatable at this commit. Plan 11-05 edits two files under `packages/github-cache/src/`, which rotates all four; plan 11-06 edits `ci.yml`, which rotates `test`. **`build` is the one survivor** -- `nx.json:116` excludes `src/**/*.spec.ts` from the `build` inputs, so the spec edit cannot reach it. Three of the four PROOF hashes rotate. The mirror still holds the OLD values, so a re-measurement after the rotation would MISS for a reason that has nothing to do with cross-OS sharing.

The checkpoint was **not self-approved**. `workflow.auto_advance` and `workflow._auto_chain_active` were both verified `false`, and the gate is `blocking` regardless of either flag. The checkpoint was returned to the orchestrator with all three options, their costs, the numbers below, and three weaknesses surfaced explicitly rather than left for the maintainer to find.

## The evidence the decision was taken against

**Per-target verdicts against the counts pre-registered in `11-03-PLAN.md` before the run:**

| Target | Pre-registered | Observed `[remote cache]` occurrences | Verdict |
|---|---|---|---|
| `build` | exactly 1 | **1** | **MET** |
| `typecheck` | exactly 1 | **1** | **MET** |
| `test` | exactly 1 | **1** | **MET** |
| `integration` | exactly 1 | **1** | **MET** |

**4 of 4 MET. No target reported NOT MET.** Aggregate 4 recorded, explicitly not the gate.

**`run.json` `cacheStatus`:** `{build, typecheck, test, integration}` all `remote-cache-hit` -- 4 of 4, exactly the pre-registered set. Not one read `local-cache-hit`.

**D-07's contingency did NOT fire** (11-02): cold == warm on all four and all four PRESENT in the shard. Nor did this capture find any hash ABSENT from the Actions cache.

**The clocks at decision time:** 29.8 days to the D-03 mirror expiry (~2026-08-28); 6.8 days to the Actions-cache no-access eviction (~2026-08-05, on GitHub's documented 7-day policy).

## The four attribution verdicts, with the means that carried each

| Target | Hash | Producer | Carried by | That means' limit |
|---|---|---|---|---|
| `build` | `17269409342684722256` | **LINUX** | **M3** primary (sole sidecar window, the `typecheck` leg, ubuntu) + **M1** corroborating | M3 is timing not identity, and depends on the run records staying readable. **M2 unavailable** -- 44 bytes, `tsc` prints no absolute path. **M4 does not apply** -- an OS-invariant target recomputes identically everywhere and discriminates nothing |
| `typecheck` | `122473981802582055` | **LINUX** | **M3** primary (three windows, all ubuntu) + **M1** | Resolves an **OS, not a job**. **M2 unavailable** -- 62 bytes, same cause. **M4 does not apply** |
| `test` | `11681410932071446589` | **LINUX** | **M2** primary (`/home/runner/work/...` inside the served bytes) + **M3** (sole window, its own leg) + **M1** | Three independent means agree. M2 is readable only after a HIT, which is why 11-03 captured it. **M4 does not apply** |
| `integration` | `8137422034373911537` | **WINDOWS** | **M2** primary (`C:/a/github-cache/...`) + **M3** (sole window, windows-only) + **M4** (cited from `10-EVIDENCE-LIVE-CI.md`) | **M1 does not apply** -- the Windows leg DOES resolve `integration`, so the graph premise says nothing about it |

`mirrored-by` is not on this list and cannot be added to it. It appears in the record only in a column labelled as a publisher stamp.

## The two paginated totals, and what a single page would have reported

Both endpoints were re-read in both forms in this session, so this capture's own verdicts cannot rest on a reader artifact inherited from another.

| Endpoint | Paginated | Single page | `nx-cache-` names on the single page | What a single page would have reported for the four hashes |
|---|---|---|---|---|
| `GET .../actions/caches` | **142 entries** | **30** | 30 of 30 | PRESENT -- by luck of ordering, not by design |
| `GET .../releases/354838660/assets` | **141 assets** | **30** | **0** | **ABSENT, all four** -- a false eviction finding |

**142 exceeds the `per_page` maximum of 100, so a single page truncates by construction** -- and the endpoint's own `total_count` field reads 142, matching the paginated row count, so the guard is verifiable from inside the response. Two facts worth separating: the per-page MAXIMUM is 100 but `gh api`'s DEFAULT is 30, so "the repository holds fewer than 100 entries" would not have been a safe substitute for paginating even had it been true. On the shard, the single page carries **zero** `nx-cache-` names, which is 11-02's measured trap reproducing exactly. Every read used `--paginate`.

## Exact string equality, and the prefix trap it avoids

**Every key and name comparison used exact string equality on `.key` / `.name`, matched in-process over the full paginated list. No comparison used a prefix filter's `total_count`.** The trap is that `?key=` is a PREFIX match anchored at the start and open-ended at the tail, so a shorter hash that is a prefix of a longer one passes a count test and a different entry is silently accepted.

Re-measured on this session's own 142 entries:

| Probe | Matches |
|---|---|
| keys EQUAL to `nx-cache-8137422034373911537` | **2** (two refs) |
| keys STARTING WITH the full key minus its last character | **2** -- a count test would have accepted these |
| keys STARTING WITH `nx-cache-1` | **40** |
| keys EQUAL to the bogus `nx-cache-0000000000000000000` | **0** -- the matcher discriminates rather than matching everything |

## Four measured results the record did not previously state

**1. The job-window cross-reference resolves a UNIQUE runner OS for all four hashes.** This is the result that matters most, because `build` and `typecheck` have no in-artifact fingerprint and the plan's four-means scheme exists precisely to carry them by another means. It does: `build`, `typecheck` and `test` each have candidate windows belonging exclusively to `ubuntu-24.04-arm` legs, and `integration`'s sole candidate is the `windows-11-arm` leg. The two rows M2 cannot reach are carried by a means that was MEASURED, not assumed.

**2. The `build` hash was written by the `typecheck` job, not by the `build` job.** The `build` job's own sidecar came up at `16:40:25Z`, three seconds AFTER the entry existed at `16:40:22.677666Z`. This is the graph premise's own observation appearing as live server-side metadata: the `typecheck` job's resolved graph includes `build` via an inferred `dependsOn: ["build", "^typecheck"]`, which is exactly why plan 11-01 chose `typecheck` as its negative control. The `build` job then got a remote HIT off that write.

**3. `last_accessed_at` proves the local read never reached the Actions cache.** The four main-ref entries were last accessed `17:54:31Z` to `17:57:11Z`; the O1/O2 measurement ran `21:44:28Z` to `21:44:31Z`, nearly four hours later. `last_accessed_at` records the LATEST access, so had that run touched the Actions cache these fields would read `21:44`. They do not. This independently corroborates the O1 soundness probe's backend finding (`isWriteTrusted(...).trusted === false` -> `createReleasesReadBackend`) in live server-side metadata the local session could not have influenced. The probe established it by reading the built `dist/lib/trust.js`; this establishes it from the other side.

**4. The Actions-cache half closes about 23 days earlier than the mirror half.** Earliest `last_accessed_at` of the four is `2026-07-29T17:54:31Z`, so on GitHub's documented 7-day no-access eviction the Actions-cache half closes around **2026-08-05**, against the shard's creation-clock expiry around **2026-08-28**. The plan's instruction to take the Actions-cache read first was load-bearing rather than tidy. Two honest qualifications: the 7-day figure is GitHub's documented policy and not something this session measured, and any future CI run restoring these keys pushes `last_accessed_at` forward and defers the eviction.

## The bounding window, and why it is the sidecar's

A cache entry can only be created while that leg's loopback sidecar is alive, because the sidecar IS the `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` the Nx client posts to. Bounding on the sidecar step rather than the target-run step is what makes the exclusion sound: three ubuntu legs in run `30471772954` (`dogfood-seed`, `pack-check`, `hash-parity`) run `npm run build` with **no sidecar**, appear as target-run candidates, and are correctly excluded as writers.

**The recorded transcription artefact:** the sidecar step's `conclusion` is `cancelled` on EVERY leg in every run, because the `Cancel` step kills it -- while the JOB conclusion is `success`. That is the designed shape and not a failure, and it is stated in the record so a later transcriber does not read it as one.

Comparison mechanics: cache `created_at` is sub-second and job/step timestamps are whole seconds, so the comparison runs in epoch seconds with the cache value's fractional part FLOORED. This is RESEARCH.md's measured method, reused rather than reinvented.

## The three weaknesses surfaced at the checkpoint, and accepted as STATED LIMITS

Recorded here because the authorisation was taken against them, not in ignorance of them.

1. **`build` and `typecheck` are carried by timing (M3) plus a structural argument (M1), not by identity.** M2 does not exist for them and never will -- `tsc` prints no absolute path on success.
2. **`typecheck`'s `created_at` `16:40:25.516159Z` sits on a whole-second truncation edge** against the `typecheck` sidecar window's `completed_at` of `16:40:25Z`. It does not change the verdict, because all three candidate windows are `ubuntu-24.04-arm`, so the producing OS is determined regardless of which candidate a truncation artefact would add or remove. This is the one place a granularity artefact touches a candidate set.
3. **GitHub run-record retention is finite**, so once run `30471772954`'s job records age out, the `build` and `typecheck` rows reduce to M1 alone. The mitigation is that the bounding windows are TRANSCRIBED into `11-EVIDENCE.md` now, rather than left as a live query a future reader would have to re-run.

Weakness 3 argues **for** proceeding promptly rather than against it, which is why it was presented alongside the recommendation rather than as a caveat to it.

## Deviations from Plan

**None** - the plan executed exactly as written, on the option the maintainer selected.

Three items a reader could mistake for deviations, and none is:

1. **The SUMMARY was withheld at the checkpoint.** The plan's `<output>` contract requires the selected option id and the four attribution verdicts; the option id did not exist yet. Recording an unmeasured value is the failure this phase exists to eliminate, and 11-02 set the identical precedent at its own blocking checkpoint.
2. **`requirements mark-complete` was not run.** A deliberate suppression, detailed below.
3. **The unpaginated re-reads and the bogus-key control were not asked for.** Both are strictly stronger, zero-cost, read-only forms of checks the plan does require. They added no file and no dependency; the throwaway scripts live in the session scratchpad, not the repository.

**Total deviations:** 0

## Issues Encountered

- **No `nx` command was run at any point in this plan, deliberately.** The plan's own guidance is to avoid Nx entirely so nothing perturbs `.nx/cache/run.json` before its values were transcribed. The four `cacheStatus` values and hashes in the record are therefore still the ones the measurement wrote, and the preserved scratchpad copy of the measurement `run.json` was never needed.
- **`git commit -m` was not used.** Per the recorded Dev Drive (ReFS) `COMMIT_EDITMSG` "Invalid argument" hazard, the commits used `git commit -F <file>` with the message authored via the Write tool into the session scratchpad.
- **The D-14 sweep was written as an allowlist-inversion rather than as a search for the wrong claim.** It flags every line where `mirrored-by` co-occurs with `produc*` and then subtracts the lines that qualify the label as a publisher, a retraction, or wrong-about-production. Two lines survive and both are correct: the retraction sentence itself, and a table header whose `mirrored-by` and `Producer concluded` are separate columns. Written this way because a sweep that searched for the specific wrong phrasing would pass on any paraphrase of it.
- **Committer identity verified as the public address before committing**, since this is a public repository.

## Requirements: nothing flipped, deliberately

The plan's frontmatter carries `requirements: [TEST-08, XOS-01, XOS-02]`, and the execute-plan workflow would normally pass all three to `requirements mark-complete`. **That was suppressed, and `requirements-completed` is empty above.** The blanket flip had nothing to gain and one forbidden effect.

| ID | State before and after | Why |
|---|---|---|
| **TEST-08** | `- [ ]`, row `Pending (O4 evidence row appended in Phase 12)` | Its own text is "Each of **O1-O4** has a recorded live proof". This plan delivers TEST-08's ATTRIBUTION clause, which is a part rather than the whole: O3 is plan 11-07 and O4 is not in Phase 11's scope at all. Flipping it would contradict the same file's own traceability row -- the failure 11-01 caught and reverted, and the suppression 11-02 and 11-03 both continued |
| **XOS-01** | `- [x]`, row `Complete (...11-EVIDENCE.md O1)` | Already correct. Closed by 11-03's measurement; nothing here to change |
| **XOS-02** | `- [x]`, row `Complete (...11-EVIDENCE.md O2)` | Already correct. Closed by 11-03 |
| XOS-03 | `- [ ]`, row `Pending (live-CI only)` | Closes at 11-07. Untouched |
| TEST-09 | `- [ ]`, row `Pending (live-CI only)` | Closes at 11-07. Untouched |
| TEST-10, OBS-02 | `- [x]`, rows `Complete` | Already correct from 11-03. Untouched |

**No checkbox disagrees with its traceability row.** All seven IDs were checked individually before the decision to suppress, so no over-reach needed correcting this time -- unlike 11-03, where the tool ticked XOS-01 and XOS-02 but left both rows reading `Pending` because it only rewrites rows whose status is exactly `Pending` with no parenthetical. `git status --porcelain .planning/REQUIREMENTS.md` prints nothing.

## Task Commits

1. **Task 1: Capture producer attribution per hit hash and append it to 11-EVIDENCE.md** - `ada339a` (docs)
2. **Task 2: Sign off O1 and O2 before any hash-rotating edit lands** - no commit; a blocking decision checkpoint with `<files>none</files>`. The selection is recorded here.

## Files Changed

- `.planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md` - MODIFIED, +254 lines. A new `## TEST-08 producer attribution, captured at proof time (D-14, D-15)` section inserted between the D-14 retraction and the PENDING O3 section, carrying: the read provenance; the pagination re-measurement on both endpoints; the exact-equality statement with the prefix trap re-measured; the Actions-cache entry list by exact key (both refs, with `created_at`, `last_accessed_at` and size); the shard asset list by exact name with `created_at` and the OBS-03 label; the bounding job windows from all 22 legs of run `30471772954`; the publisher-versus-producer separation as arithmetic; the per-hash attribution table with a `Carried by` column keyed M1-M4; the four means with their limits; the `last_accessed_at` corroborator; the measured clock asymmetry; the D-15 citation; and a `What this attribution capture does NOT establish` section. One row added to the Headline table.

**The D-22 shape is preserved.** `## O3 (XOS-03, TEST-09) -- PENDING` and `## O4 (XOS-04, XOS-05) -- RESERVED` both survive, unfilled and undeleted, and an automated check asserts all four O-section headings are still present.

**No source file was touched and no task hash rotated.** `git status --porcelain packages/ .github/ start-cache-server/` printed nothing both before and after the commit.

## Next Phase Readiness

**The rotation is AUTHORISED. Plans 11-05, 11-06 and 11-07 are unblocked.**

Handed forward:

1. **The attribution capture is BANKED and committed.** This is the one thing Phase 12 destroys permanently. Nothing downstream needs to re-derive it, and nothing downstream can.
2. **To 11-05 and 11-06 (the rotating waves):** `test`, `typecheck`, `integration` and `lint` are now free to rotate. Expect them to, and do not read a post-rotation MISS as a cross-OS finding -- the mirror holds the pre-rotation values. `build` does not rotate on a spec edit (`nx.json:116`). VALIDATION.md's after-every-task-commit sampling, suspended through 11-03, **resumes at plan 11-05**.
3. **To 11-07 (O3):** `## O3 (XOS-03, TEST-09) -- PENDING` still fixes the shape with TEST-09's three parts enumerated; append into it, do not restructure it. Two mechanics from this capture transfer directly: `?key=` is a PREFIX match so match on exact `.key` equality (re-measured here -- the full key minus its last character still matches 2 entries), and the `?key=` + `ref` filter reduces 142 entries to 1-2 so filtering beats paginating in the witness job. Also note that a hash may hold TWO entries on two refs, so the witness must filter on `ref` as well as key.
4. **To Phase 12 (O4):** `## O4 (XOS-04, XOS-05) -- RESERVED` is present and must be neither filled nor deleted before then. The attribution it destroys is now recorded, which is what makes enabling O4 a decision rather than a loss taken by accident.
5. **Still open, unchanged:** TEST-08 (until Phase 12), XOS-03 and TEST-09 (plan 11-07), PARITY-04's everyday-box question (the reset makes this phase's question the COLD one), and DOCS-07.

No blockers.

## Self-Check: PASSED

Every claim above re-verified against disk, git and the live API rather than asserted:

| Claim | Check | Result |
|---|---|---|
| `11-04-SUMMARY.md` created | `[ -f ]` | FOUND |
| `11-EVIDENCE.md` modified, attribution section present | the plan's own `node` verify block | exit 0, `attribution section OK` |
| Task 1 commit `ada339a` | `git log --oneline` | FOUND |
| No file deletion in that commit | `git diff --diff-filter=D --name-only HEAD~1 HEAD` | empty |
| No source file touched | `git status --porcelain packages/ .github/ start-cache-server/` | printed nothing |
| No task hash rotated | same check, plus this plan writes only under `.planning/` | confirmed |
| D-22 four-section shape intact | automated assertion on all four O-headings | O1, O2, O3 PENDING, O4 RESERVED all present |
| No raw REST payload field | automated check for `node_id`, `uploader`, `browser_download_url` | none present |
| ASCII-only | automated per-line non-ASCII scan of the whole record | 0 lines |
| No email-shaped token | allowlist-inversion regex, `@op-nx/...` stripped first | none present |
| Four means keyed and defined | automated assertion on M1-M4 | all four defined with limits |
| `ABSENT` literal carried | automated | present |
| No unqualified `mirrored-by`/producer claim | allowlist-inversion sweep on the record + `git grep` over the shipped source surface | 2 lines surviving, both correct; `ci.yml:1235` reads "a PUBLISHER identity, never a ..." |
| 142 entries / 141 assets | paginated reads, plus the endpoint's own `total_count` | 142 = 142, 141 = 141 |
| Single page truncates | unpaginated re-reads of both endpoints | 30 and 30; 0 `nx-cache-` names on the shard page |
| Exact-equality matching | in-process matcher, plus a bogus-key control | 0 matches on the bogus key |
| Unique OS per hash | window containment over all 22 legs | 4 of 4 unique |
| Auto mode inactive at the checkpoint | `config-get` on both flags | both `false` |
| REQUIREMENTS.md untouched | `git status --porcelain .planning/REQUIREMENTS.md` | printed nothing |
| TEST-08 still open, row still Pending | `git grep` on the checkbox and the row | `- [ ]`, `Pending (O4 evidence row appended in Phase 12)` |
| XOS-03 and TEST-09 still Pending | `git grep` on both | `- [ ]`, rows `Pending (live-CI only)` |
| No `nx` invocation in this plan | command-by-command audit | zero |
| MAIN tree, not a worktree | `.git` is a directory | confirmed |
| Committer identity is the public one | `git config user.email` | the public gmail |

---
*Phase: 11-live-proofs-o1-o2-o3*
*Completed: 2026-07-29*
