# Phase 11: Live Proofs -- O1, O2, O3 - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning
**Mode:** `--analyze --auto --chain` (trade-off tables recorded in `11-DISCUSSION-LOG.md`;
recommended option auto-selected per area; one HIGH-impact / NOT-HIGH-confidence item withheld
from auto-lock and recorded as UNRESOLVED for `gsd-phase-researcher`)

<domain>
## Phase Boundary

Three of the four v0.0.2 target outcomes are PROVEN LIVE and recorded with defined evidence, in
the mandated order, including the producer attribution that Phase 12 destroys permanently.

Five things:

1. **O1 (XOS-01).** From a cleared local Nx cache, a native Windows workstation logs a non-zero
   count of tasks carrying the literal `[remote cache]` label for `build`, `typecheck` AND `test`,
   named per target, against artifacts Linux CI produced.
2. **O2 (XOS-02).** The same local Windows run HITs `integration` from a Windows-CI-produced
   artifact, compared against the pre-rename baseline as a non-regression.
3. **O3 (XOS-03, TEST-09).** Proven as an Nx-HASH property, not a storage probe: CORR-03(b)'s
   record is CITED for `H_linux != H_win`; the Windows `integration` task is shown to have
   EXECUTED with no `[remote cache]` label in a run where `nx-cache-<H_linux>` demonstrably
   existed in the Actions cache; and a POSITIVE CONTROL in that same job proves the sidecar and
   backend were alive.
4. **The evidence definition and its instruments (TEST-08, TEST-10, OBS-02).** Producer
   attribution captured at proof time; the "Windows CI produces no `build`/`typecheck`/`test`
   hash" premise asserted MECHANICALLY against the resolved Nx task graph; a soundness probe
   timestamped as PRECEDING the measurement; every green-job claim paired with a
   pre-registered COUNT; every `Cache: n/m hit` line marked NON-DISCRIMINATING.
5. **The new code the proofs need.** This phase is proof-LED but NOT proof-only (ROADMAP's own
   2026-07-26 scoping correction): new `ci.yml` probe steps for SC 4(b)/(c), a new witness job,
   and a new task-graph assertion mode on the existing root-level instrument.

**Not in this phase:** O4 in any form -- the Windows `build`/`typecheck`/`test` legs (XOS-04),
their HIT (XOS-05), the `needs:` producer-to-consumer ordering (XOS-08) and the write decision are
Phase 12, gated on XOS-01 being PROVEN here. Also Phase 12: DOCS-07's consumer portability recipe
and its drift guard. Out of scope for the milestone and not to be reached for: collapsing the
publish matrix to one leg, read-fallback across old and new asset names, any per-target
OS-invariance knob, an empirical divergence-detection subsystem, archive file-mode handling across
the OS boundary.

</domain>

<decisions>
## Implementation Decisions

### BLOCKING PRE-FLIGHT: what the tooling gets right and wrong for this phase

- **D-00 [informational]:** `gsd-tools query init.plan-phase 11` returns all **SEVEN** IDs.
  MEASURED this session. One residual trap, identical to Phase 10's D-00: the last ID comes back
  as **`OBS-02.`** with a trailing period, because the parser takes the `**Requirements**:` line
  to its end including sentence punctuation. Do not `rg` for the literal `OBS-02.` and do not
  write it into an artifact that way. The authoritative list is **XOS-01, XOS-02, XOS-03,
  TEST-08, TEST-09, TEST-10, OBS-02** -- pass it EXPLICITLY to the researcher, the planner, the
  plan-checker, the coverage gate, the security auditor and the verifier.

- **D-01 [informational]:** ROADMAP.md and REQUIREMENTS.md AGREE at seven for this phase
  (ROADMAP `:459`, `:607`; REQUIREMENTS `:651-657`, `:663-665`), so Phase 10's count defect does
  NOT recur. Audit coverage against **REQUIREMENTS.md's own words** regardless -- Phase 8 caught
  ROADMAP's stale PARITY numbering that way and Phase 10 caught a missing traceability row. Where
  the two disagree on substance, REQUIREMENTS.md wins. Note specifically that ROADMAP's Phase 11
  section carries NO `Canonical refs:` line, so the `<canonical_refs>` list below is assembled
  from REQUIREMENTS.md, PROJECT.md and the prior-phase artifacts rather than copied.

> **Why D-00 and D-01 are tagged `[informational]`.** Both are ORCHESTRATOR pre-flight
> instructions about artifact and tooling behaviour, not implementable behaviour -- an executor
> cannot "build" either one. Both were ACTED ON at discuss time: the authoritative seven-ID list
> is stated above, and every coverage audit in this phase must run against REQUIREMENTS.md's
> words. Tagged per the decision-coverage gate's own documented resolution, not to dodge it.

### The preconditions this phase inherits, and their expiry

- **D-02:** **Both Phase 11 preconditions are DISCHARGED.** `10-EVIDENCE-LIVE-CI.md` records run
  `30471772954` (event `push`, branch `main`, head `180c3d3`, `main` restored to `fe25a3f` and
  verified by SHA equality) republishing the mirror under the OS-free name: 16 new-form
  `nx-cache-*` assets, legacy names stopped growing (72 -> 72), and all four targets named by
  SC1/SC2 warm under hashes THIS workstation computes:

  | Target | Local hash (win32/arm64) at `3c6415f` | In the warm mirror | Stored label |
  |---|---|---|---|
  | `build` | `17269409342684722256` | yes | `mirrored-by: linux` |
  | `typecheck` | `122473981802582055` | yes | `mirrored-by: linux` |
  | `test` | `11681410932071446589` | yes | `mirrored-by: linux` |
  | `integration` | `8137422034373911537` | yes | `mirrored-by: linux` |
  | `lint` | `12188798272866712437` | no -- by design | -- |

  `lint`'s absence is BY DESIGN (its CI job is the one quality job that starts no sidecar) and is
  NOT in this phase's success criteria.

- **D-03 (the clock):** the 16 assets were created **2026-07-29T16:44Z** and cleanup prunes past
  `DEFAULT_MAX_AGE_DAYS` (30) daily at 03:17 UTC, so **the O1/O2 measurement window closes around
  2026-08-28.** The 2026-08-01 shard rollover is NOT a threat: `shardTagsForWindow` walks calendar
  months newest-first across the retention window, so `cache-mirror-202607` stays reachable from
  an August read. Treat O1/O2 as PERISHABLE, exactly as Phase 10 treated its pre-rename baseline.

- **D-04:** `.planning`-only commits rotate NO task hash -- verified: `nx.json`'s
  `namedInputs.default` is `{projectRoot}/**/*` plus `sharedGlobals`, and every workspace-root
  input is enumerated explicitly. So the current HEAD's hashes equal `3c6415f`'s.

### O1 / O2 local proof harness (TEST-10, XOS-01, XOS-02)

- **D-05:** The harness is **literal `nx reset`, THEN start the sidecar** -- TEST-10's exact
  mechanism and its exact order. The order is not stylistic: `nx reset` deletes `.nx/cache`,
  which is where VER-07 puts the archive, so resetting under a running sidecar makes the next PUT
  `writeFile` ENOENT into a 500. Phase 10's COLD-DIRECTORY variant
  (`NX_CACHE_DIRECTORY` + `NX_WORKSPACE_DATA_DIRECTORY` redirected into the session scratchpad)
  is the RECORDED FALLBACK with its four reasons carried from `10-01-SUMMARY.md`, including the
  measured fact that `CACHE_ARCHIVE_DIR` is a workspace-relative literal and is NOT redirected by
  `NX_CACHE_DIRECTORY`. Rationale for taking the literal route here rather than the variant Phase
  10 took: Phase 11 is the phase where TEST-10 CLOSES, and the requirement names both the
  mechanism and the order in its own words. If `nx reset` proves hazardous in practice, switch to
  the variant and RECORD the deviation with its reasons -- do not switch silently.

- **D-06 (the pre-flight that makes a MISS attributable in advance):** BEFORE the proof, run
  `npm run capture:hashes -- --install-mode ci` in **BOTH graph states** (cold and
  warm-preexisting) and cross-check each state's four hashes against the warm shard. Reason: the
  record does NOT state which graph state produced D-02's table, and PARITY-04 was answered **NO**
  at Phase 8's anchor (`08-03`: a warm-preexisting Windows box computes a different hash from cold
  on all five targets) -- measured BEFORE 08-05's fix, so its post-fix status is UNKNOWN. TEST-10's
  mandated reset forces the COLD state. If the mirrored hashes turn out to be the WARM values, the
  cold proof MISSES for a reason that is not a defect and not a regression.

- **D-07 (pre-declared contingency, so it cannot be absorbed):** if the COLD hashes are ABSENT
  from the mirror, O1 is unreachable at this commit and needs a re-warming default-branch push at
  a cold-equal tree. Record that as a **FINDING**, exactly as PARITY-04 instructs -- never absorb
  it by re-running until something hits, and never let the reset silently substitute the cold
  question for the everyday-box question. Each proof states WHICH QUESTION it answers: TEST-10's
  reset makes it "does a cold Windows box hit", and PARITY-04's "does my everyday box hit" is a
  separate named question this phase does not close.

- **D-08 (the calibrated instrument, re-run verbatim):** the soundness probe is
  `10-EVIDENCE-PRE-RENAME.md`'s control table, re-run and re-transcribed rather than redesigned:
  `gh auth token` and `git remote get-url origin` through `runHelper`'s literal `shell:false`
  spawn shape; `GITHUB_ACTIONS`/`GH_TOKEN`/`GITHUB_TOKEN`/`GITHUB_REPOSITORY` all unset;
  `isWriteTrusted(process.env).trusted` read from the BUILT `dist/lib/trust.js` and false (this is
  what proves WHICH backend served the read); the bound URL read from the sidecar's OWN stdout;
  wrong-bearer 401; no-bearer 401; valid-bearer known-absent-hash 404; a dead-port differential;
  sidecar stderr 0 bytes throughout; teardown confirmed with the port clear; and
  `git status --porcelain packages/ .github/ start-cache-server/` printing nothing.
  **Its timestamp is recorded as PRECEDING the first Nx run** (TEST-10's own words). Kept as
  transcribed ad-hoc commands, NOT promoted to a committed instrument -- a new committed file
  under `packages/` would rotate three of the four hashes being measured (D-09).

- **D-09 (XOS-02's two-part "before"):** the non-regression comparison cites BOTH halves and says
  which each answers -- the fresh pre-rename READ-PATH baseline at `06019d4` (HTTP 200, 410 bytes
  on `13758457399293023985-windows`, `10-EVIDENCE-PRE-RENAME.md`) and the only Nx-level pre-rename
  `[remote cache]` HIT there will ever be, the 2026-07-26 record at `bfd5143`
  (`260725-w3s-STEP0-RESULTS.md`). The read-path half does not establish Nx consumption and the
  Nx-level half predates Phase 9's version rotation; neither alone is the baseline.

### Ordering: hash rotation is the phase's real sequencing constraint

- **D-10 (MEASURED against `nx.json` this session, and load-bearing):**

  | Edit | Rotates |
  |---|---|
  | `.github/workflows/ci.yml` | **`test` only** -- it is an explicit `test` input (`nx.json:69`, PARITY-08) and appears in no other target's list |
  | any new file under `packages/github-cache/` | **`test`, `typecheck`, `integration`** -- all three start from `default` = `{projectRoot}/**/*` |
  | a new NON-spec source file under `packages/github-cache/src/` | the above **plus `build`** (`build` explicitly excludes `src/**/*.spec.ts`, `nx.json:116`) |
  | a new ROOT-level `.mjs` | **nothing** -- workspace-root inputs are enumerated explicitly, and root `nx.includedScripts` is `[]` so it cannot become an Nx target (the `capture-hashes.mjs` precedent, Phase 8 D-01(b)) |

- **D-11:** Therefore **O1 and O2 are measured FIRST, at the current commit, before any
  `packages/**` or `ci.yml` edit lands.** Encode it as `depends_on` in plan frontmatter, never as
  prose (Phase 8: "a comment asking an executor to preserve ordering is not a control; a
  `depends_on` graph is"). Plan order:
  1. **The O1/O2 local proofs** (D-05..D-09) plus D-12's task-graph instrument, which is
     hash-neutral and may therefore precede them.
  2. **The O3 `ci.yml` probe steps and the witness job** (D-14..D-17) -- these rotate `test`.
  3. **The O3 live proving run** (D-18) and the evidence record (D-20).

### TEST-08's mechanical task-graph assertion

- **D-12:** The premise "Windows CI produces no `build`/`typecheck`/`test` hash" is asserted by a
  **new mode on the existing root-level `capture-hashes.mjs`**, not by a new spec. It already
  drives `createProjectGraphAsync` -> `createTaskGraph` and already throws when an expected task
  id is missing from the graph. The mode emits the RESOLVED task-id SET for the Windows leg's
  ACTUAL command -- `npm run integration`, i.e. `nx run-many -t integration` -- and asserts that
  set contains no `build`, `typecheck` or `test` task. Root-level keeps it hash-neutral (D-10), so
  it can be authored and run before the perishable local proof.

- **D-13 (non-vacuity, mandatory):** the same run carries a **NEGATIVE CONTROL** -- a command that
  DOES resolve those tasks (e.g. `nx run-many -t test`) -- so a resolver that resolves nothing
  cannot pass. This is Phase 7's `filterUsingGlobPatterns` lesson recurring: a resolver returning
  an empty set satisfies every absence assertion simultaneously. TEST-08 also requires the
  assertion OUTPUT captured as evidence rather than discarded as a pre-flight check, and the
  premise stated as a property of the CURRENT graph rather than of the config -- `integration`'s
  `dependsOn: ["^build"]` resolves to zero tasks only because this is a single-project workspace,
  and the `typecheck` job already touches the `build` hash as a dependency.
  DEFERRED deliberately: an every-commit Vitest version of this assertion. TEST-08 asks for a
  mechanical assertion whose output is captured, not for a permanent gate, and the gate would cost
  the measurement window (D-10).

### TEST-08's producer attribution -- four independent means, and one that is unusable

- **D-14:** `mirrored-by` **CANNOT** attribute a producer, and this is now live fact rather than
  reasoning: `10-EVIDENCE-LIVE-CI.md` records the Windows-produced `integration` hash
  `8137422034373911537` in the mirror stamped `mirrored-by: linux`, because the ubuntu publish leg
  restored a Windows-produced entry (Phase 9's `enableCrossOsArchive`) and stamped its own OS. Any
  artifact, comment or doc line claiming the label answers "whose bytes did the developer get" is
  RETRACTED and must not reappear here.

  Attribution is established by these four, with the graph premise load-bearing:

  | Evidence | What it establishes | Its limit |
  |---|---|---|
  | D-12's graph premise | Windows CI resolves no `build`/`typecheck`/`test` task, so any such hash in the store is Linux-produced | structural -- valid only because it is ASSERTED, not assumed |
  | The replayed artifact's `terminalOutput` runner path (`/home/runner/...` vs `C:/a/...`) | a per-hit, byte-level producer fingerprint INSIDE the served artifact; this is what made Step 0's attribution decisive | readable only after a HIT |
  | Actions-cache entry list + shard asset list with `created_at` and the OBS-03 label per asset, cross-referenced against job windows | the requirement's own mandated capture; bounds when each entry could have been written | timing, not identity |
  | Recompute the hash on a known platform and match | established the producer live in `10-EVIDENCE-LIVE-CI.md` | works only for OS-SENSITIVE targets, so it serves O2/`integration` and never O1 |

- **D-15:** The pre-Phase-9 snapshot in `09-EVIDENCE.md` (`## Producer-attribution snapshot
  (D-34)`, 106 shard assets + the repository Actions-cache entry list, captured
  `2026-07-28T20:30:55Z`) is the inherited prior. **Cite it; do not spend it and do not re-derive
  it.** It is evidence PRESERVATION, explicitly not a proof, and its own scope note forbids the
  next step being the proof.

### O3 proof mechanics (XOS-03, TEST-09)

- **D-16 (the positive control, and why it cannot be plumbed):** TEST-09(3) requires the positive
  control **in the same job** as the MISS observation, or a dead sidecar in that job is not
  excluded. `H_linux` is NOT computable on a Windows runner -- the discriminator
  (`{"runtime":"node -p process.platform"}`) is honest -- and a matrix leg cannot `needs:` its
  sibling. So the control is an authed GET on the leg's **OWN** just-saved `nx-cache-<own hash>`,
  requiring **200**, taken AFTER the task ran. `restoreCache` always queries the cache service, so
  this is a genuine service round-trip and not a local-archive read. It extends `ci.yml`'s shipped
  readiness-GET shape, which TEST-09 names as the pattern to extend.

- **D-17 (the existence demonstration):** both `integration` legs, SYMMETRICALLY and with no
  `if: matrix.os == ...` conditional, (a) tee the Nx output, (b) read their own task hash from
  `.nx/cache/run.json` -- read IMMEDIATELY, since every `nx` invocation overwrites it -- and
  upload it under a per-leg artifact name (the `hash-parity` job's unique-name-per-leg precedent;
  v4-onward artifact names are immutable, so two legs uploading to one name is an error, not a
  merge), and (c) hard-gate D-16's own-key 200. A new **`o3-witness`** job on `ubuntu-24.04-arm`
  then `needs: integration`, reads `H_linux` from the ubuntu leg's artifact, and asserts that
  `nx-cache-<H_linux>` existed in the Actions cache with a `created_at` EARLIER than the Windows
  leg's `npm run integration` step `started_at`.

  Four sub-locks:
  1. **`H_linux` is sourced from the ubuntu `integration` leg's own `run.json`, NEVER from
     `hash-parity`.** On a `pull_request` event `hash-parity` pins `github.event.pull_request.head.sha`
     while `integration` takes actions/checkout's default MERGE commit, so the two measure
     DIFFERENT TREES and their hashes are not commensurable.
  2. **The absence-of-`[remote cache]` assertion is RECORDED, never GATED.** It is FALSE on a
     correct re-run at the same commit, and a tripwire that fires on correct work gets disabled --
     OBS-04's own lesson, calibrated in this very milestone.
  3. `o3-witness` needs `actions: read` for the cache-list endpoint. A job-level `permissions`
     block REPLACES the workflow grant WHOLESALE rather than merging it, so it must restate
     `contents: read` too -- the trap `ci.yml` documents and the `publish` job's
     `contents: write` + `actions: read` block is the precedent for.
  4. Reach the REST API with **`curl`**, not `gh`. MEASURED: no workflow in this repo invokes the
     `gh` CLI, so its presence on `windows-11-arm` is unverified -- and `curl` is already proven on
     both legs by the shipped readiness poll. Keeping every REST call on the ubuntu witness job
     removes the question entirely.

- **D-18:** `H_linux != H_win` is **CITED from CORR-03(b)'s build-gating record at the commit**,
  never re-derived here (TEST-09(1) in its own words). `PROBE-RESULTS.md` Q3
  (`8865876519165210738` vs `1822904335635353663` at `fe25a3f`) is the corroborating prior, also
  cited rather than re-taken. A storage-level probe for the Linux hash from a Windows runner would
  now HIT and is explicitly NOT the proof -- asserting a 404 there would assert a property this
  milestone deliberately destroyed. A run that MISSes everything is not a valid proof.

- **D-19 (no new `src/` file for the O3 probes):** the probe steps are scripted `bash` in
  `ci.yml` (`curl -w '%{http_code}'`, `tee`, a hard `exit 1`), matching the readiness-poll and
  `hash-parity-compare` precedents. A TypeScript bin would rotate all four hashes (D-10) and
  buy unit-testability the `ci.yml` content guard already substitutes for --
  `docs-same-os-claims.spec.ts` is the shipped phrase-keyed pattern, and `ci.yml` IS a `test`
  input, so a spec asserting on it does not serve a stale cached PASS.

### The proving run (live-CI close: the whole phase)

- **D-20:** The O3 proving run is a **temporary maintainer-authorised push of the phase branch to
  `main`, followed by an immediate restore**, on the contract Phases 9 and 10 both used and
  recorded: a retained backup ref, the restore verified by SHA EQUALITY rather than by assumption,
  and the restore force-push's own `push` run predicted IN ADVANCE (Phase 9 run `30401077417`,
  Phase 10 run `30473116345`) rather than read as an anomaly. Chosen over a `pull_request` run for
  one decisive reason: only on a push does `github.sha` equal the head, so `integration`,
  `hash-parity` and `hash-parity-compare` all measure ONE tree and D-18's citation is
  commensurable with the O3 observation. Side effect that is desirable rather than regrettable:
  the push re-warms the mirror under the post-Phase-11 hashes, which Phase 12 needs.

- **D-21:** `ACTIONS_STEP_DEBUG` is turned ON for the proving run by setting the **repository
  variable** `ACTIONS_STEP_DEBUG=true`, and unset afterwards -- recorded as an explicit maintainer
  action with both timestamps. TEST-08 requires it because restore MISSes log at `core.debug` and
  are otherwise absent from the log. Not committed as a workflow-level `env:`: that would leak
  debug logging into every future run and become one more thing to drift.

### Evidence and the pre-registered counts

- **D-22:** ONE `11-EVIDENCE.md`, with O1, O2 and O3 sections and an explicitly **RESERVED O4
  section**. TEST-08's own words: "Phase 12 appends the O4 row to the same evidence record".
  Per proof, the evidence is the requirement's defined set: the workflow run URL (O3) or captured
  terminal output (O1/O2), the Nx hash observed, and the literal `[remote cache]` label.

- **D-23 (counts pre-registered in the PLAN, not after the run):** every "the job was green" claim
  is paired with a COUNT that would differ under the failure hypothesis, and the count is NAMED IN
  THE PLAN. The gate is OBS-02's: a non-zero count of tasks carrying the literal `[remote cache]`
  label, **named per target**. Corroborating and explicitly secondary: the run-duration collapse
  (Step 0 measured 1ms replay against a real 554ms), and the `Nx read the output from the cache
  instead of running the command for N out of M tasks` line.

- **D-24:** Every recorded `Cache: n/m hit` line is marked **NON-DISCRIMINATING IN BOTH
  DIRECTIONS**, in the artifact, beside the line. Measured grounds: a `0%` prints identically with
  no sidecar at all (run `30169158892`), and a non-zero count includes LOCAL hits. Nx 23.1's
  end-of-run performance report is supporting context only -- it cannot separate local from remote
  and cannot attribute a producer OS.

### Claude's Discretion

- The name and flag surface of D-12's `capture-hashes.mjs` task-graph mode, and whether the
  negative control is a second invocation or a second assertion inside one invocation.
- The `o3-witness` job's name, and whether the `created_at`-versus-`started_at` comparison is done
  in `bash` arithmetic or a `node -e` one-liner.
- Per-leg artifact names for the `integration` hash upload, subject to per-leg uniqueness.
- The section order inside `11-EVIDENCE.md`, and whether the soundness-probe control table is
  inline per proof or shared once.
- Plan count and wave grouping, subject to D-11's ordering.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

ROADMAP.md's Phase 11 section carries NO `Canonical refs:` line, so this list is assembled rather
than copied. Every entry is a full relative path.

### Required reading, in this order

- `.planning/REQUIREMENTS.md` -- **FIRST, and it is the authoritative requirement text** (D-01).
  Specifically: `:343-357` (XOS-01, XOS-02, XOS-03 including the "statement about Nx HASHES, not
  about cache storage" clause and the 2026-07-26 measured divergence), `:473-491` (TEST-08 -- the
  evidence definition, the attribution window closing at Phase 9, the mechanical graph assertion,
  the pre-registered counts, `ACTIONS_STEP_DEBUG`), `:492-506` (TEST-09's three parts and why a
  storage probe is now INVALID), `:508-522` (TEST-10 -- reset order, which-question, the soundness
  probe, the non-discriminating `Cache: n/m` line), `:526-530` (OBS-02), `:228-233` (PARITY-04 --
  the separate named question the reset must not silently substitute for), `:568-591` (the
  `Before/After` sequencing table), `:592-602` (Out of Scope -- read it; several rows are things a
  planner would otherwise reach for).
- `.planning/ROADMAP.md` `:449-501` -- the Phase 11 section: goal, depends-on, SC1-SC5, the
  `Live-CI close` line ("the whole phase"), and the **Scoping correction (2026-07-26 research)**
  that allocates plan capacity for real implementation.
- `.planning/phases/10-os-invariant-releases-mirror/10-EVIDENCE-LIVE-CI.md` -- **the discharge of
  both preconditions and the source of D-02's warm-hash table, D-03's clock, and D-14's live
  publisher-not-producer instance.** Read `## Consequence for Phase 11` and
  `## What remains unobservable` in full.
- `.planning/phases/10-os-invariant-releases-mirror/10-EVIDENCE-PRE-RENAME.md` -- D-08's
  calibrated control table verbatim, and D-09's pre-rename read-path baseline plus its
  `## Disposition -- what Phase 11's XOS-02 inherits` section.
- `.planning/phases/09-os-invariant-actions-cache-version/09-EVIDENCE.md`
  `## Producer-attribution snapshot (D-34)` -- D-15's inherited prior. Cite, do not spend.
- `.planning/phases/10-os-invariant-releases-mirror/10-LEARNINGS.md` -- the nine Patterns are
  directly reusable; three Lessons are load-bearing here (`rg -c` counts LINES not occurrences; a
  grep-verifiable absence claim must not spell its own token; an acceptance-criterion `rg` literal
  is case-sensitive).
- `.planning/phases/09-os-invariant-actions-cache-version/09-LEARNINGS.md` -- the same-OS sweep
  must include EXECUTABLE code and CI prose; `git grep` false-zeroes on untracked and gitignored
  paths; a guard can be pinned at a CI sampling rate of ZERO.
- `.planning/research/v0.0.2/PROBE-RESULTS.md` -- Q3 is D-18's corroborating prior (consequence
  row 9 says Phase 11 CITES it and does not re-derive it); the two-axis finding is what forces
  D-06's both-graph-states pre-flight.
- `.planning/quick/260725-w3s-verify-local-development-environment-nx-/260725-w3s-STEP0-RESULTS.md`
  -- the only Nx-level pre-rename `[remote cache]` HIT (D-09), and the origin of the
  `terminalOutput` runner-path attribution method (D-14).

### Project-level locks

- `.planning/PROJECT.md` `## Key Decisions` -- the v0.0.2 rows, especially **"cross-OS sharing
  rests on target platform-agnosticism, NEVER on publish-leg ordering"** (the row D-17's
  sub-lock 2 and the UNRESOLVED item below are both measured against) and "no OS-separation knob".
- `.planning/PROJECT.md` `## Constraints` -- "changes made for this repo's own CI/hashing must
  never leak into the consumer contract". Every probe step here is project-local by construction.
- `.planning/THREAT-MODEL.md` -- the C1-C18 CREEP control ledger. This phase adds no write path
  and no new credential; C16's filters and C2's sync gate are untouched.

### Files this phase edits or asserts on

- `capture-hashes.mjs` -- D-12's new task-graph mode. Root-level, dev-only, hash-neutral;
  `captureTargets` at `:268` is the existing `createTaskGraph` call site to extend, and its
  missing-task throw at `:292` is the existing shape.
- `.github/workflows/ci.yml` -- the `integration` job (`:414-462`: the sidecar block, the readiness
  poll at `:444-460` that D-16 extends, `- run: npm run integration` at `:461`) and the new
  `o3-witness` job. Locate by JOB NAME, never by line number -- `ci.yml` drifted ~220 lines inside
  one milestone and this file is now 1269 lines.
- `packages/github-cache/src/docs-same-os-claims.spec.ts` -- the phrase-keyed `DOCS_08_SITES`
  guard, if D-19's `ci.yml` content guard extends it. **Note the rotation cost (D-10): touching
  any file under `packages/` rotates three of the four hashes, so this lands AFTER the local
  proofs.**
- `.planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md` (NEW) -- D-22's single record.

### In-repo precedent

- `.github/workflows/ci.yml` `hash-parity` (`:578`) and `hash-parity-compare` (`:747`) -- per-leg
  unique artifact names with `if-no-files-found: error`, the `needs:` + `if: !cancelled()` shape,
  and the grep-on-a-tee'd-log-plus-exit-code double signal with its `^` anchor rationale. The
  template for D-17.
- `.github/workflows/ci.yml` `publish` (`:1092-1094`) -- the `contents:` + `actions: read`
  job-level block and the wholesale-replacement trap, for D-17's sub-lock 3.
- `.github/workflows/ci.yml` `dogfood-seed` / `dogfood-verify` (`:799`, `:822`) -- the two-job
  producer-then-consumer proof shape, and the recorded reason a same-run same-process read-back is
  not evidence the bytes crossed the service.
- `packages/github-cache/src/nx-target-inputs.spec.ts` -- the in-repo precedent for reaching into
  `nx/src/hasher/*` from a spec, and the `filterUsingGlobPatterns`-returns-everything-on-an-empty-
  pattern-list vacuity trap that D-13's negative control exists to avoid.
- `.planning/codebase/TESTING.md` -- spec placement (cross-cutting drift guards at
  `src/*.spec.ts`), the config-assertion (YAML/text) testing shape, and the
  `## Live-CI first-push close pattern` section, which is this phase's whole nature.
  **STALE WARNING:** `.planning/codebase/*` was mapped 2026-07-22 against v0.0.1 and both
  PROJECT.md and STATE.md flag it as stale -- v0.0.2 invalidated it materially (renamed asset
  scheme, new archive path, an inferred `lint` target, ESLint in the toolchain). Use it for
  CONVENTIONS, never for facts about the current tree.

### Measured this session (2026-07-29), not inherited

- `gsd-tools query init.plan-phase 11` -> all SEVEN requirement IDs, trailing period on the last
  (D-00).
- `nx.json` read in full -> D-10's rotation table: `ci.yml` is a `test` input only (`:69`);
  `test`/`typecheck`/`integration` all start from `default` (`:51`, `:145`, `:93`); `build`
  explicitly excludes `src/**/*.spec.ts` (`:116`); `sharedGlobals` is `tsconfig.base.json` alone
  (`:10`).
- `packages/github-cache/src/lib/trust.ts:32-34` -> `TRUSTED_EVENTS = ['push','schedule']`,
  `HOST_GATED_EVENTS = ['pull_request','release']`, so a `pull_request` run on github.com IS
  write-trusted and both `integration` legs would save. That is what makes a PR run technically
  viable and D-20's tree-commensurability the deciding argument instead.
- `rg "gh api|gh auth" .github/workflows/*.yml` -> ZERO invocations (one mention inside a
  comment). The `gh` CLI has no workflow precedent in this repo, hence D-17's sub-lock 4.
- `.github/workflows/ci.yml` job inventory -> 19 jobs; `integration` is NOT push-gated, while
  `publish`, `publish-verify`, `dogfood-seed`, `dogfood-verify` and `consumer-smoke` are.
- `git rev-parse --short HEAD` -> `0bea74b`, working tree clean; all commits since `3c6415f` touch
  `.planning/` only, so D-02's hash table is current (D-04).

### Unpackaged findings

`.planning/spikes/MANIFEST.md` exists with no corresponding
`./.claude/skills/spike-findings-*/SKILL.md`. Run `/gsd:spike --wrap-up` if those findings are
needed; otherwise `.planning/research/v0.0.2/` is the current source.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `capture-hashes.mjs` already drives `createProjectGraphAsync` -> `createTaskGraph` ->
  `createTaskHasher().hashTask()` over five targets, records `graphState`, Nx version, Node
  version, install mode and commit, and already THROWS with the graph's task keys when an expected
  task id is absent. D-12 extends it rather than building an instrument.
- `ci.yml`'s readiness poll (`integration` job, `:444-460`) is already an authed `curl` GET
  asserting 404-or-200 with a bounded retry and a loud failure. D-16 is the same shape tightened
  to require 200 on a known-present key.
- `ci.yml`'s `hash-parity` / `hash-parity-compare` pair already establishes per-leg artifact
  upload with unique names, `if-no-files-found: error`, `needs:` + `if: !cancelled()`, and the
  exit-code-PLUS-anchored-grep double signal. D-17 reuses all of it.
- `.nx/cache/run.json` is the per-TASK hash surface -- written unconditionally by
  `StoreRunInformationLifeCycle`, and OVERWRITTEN by every `nx` invocation, so read it immediately
  after the run that produced it (`PROBE-RESULTS.md` method note).
- `docs-same-os-claims.spec.ts` is the shipped phrase-keyed content guard, and `ci.yml` is a
  `test` input, so a `ci.yml` content assertion cannot serve a stale cached PASS.
- `10-EVIDENCE-PRE-RENAME.md`'s control table is a ready-made, already-executed soundness harness.

### Established Patterns

- **Predict the mutation's redness, then observe it, then revert.** A predicted-only redness is
  not evidence. Phase 10 found four guards that passed for the wrong reason this way.
- **Pair every absence assertion with a non-vacuity companion.** D-13's negative control is this
  pattern applied to a task-graph resolver.
- **Assert over the whole value set, never over "the OS this machine is not."** Keeps a spec
  machine-independent so it bites at every-commit rate rather than on one runner.
- **A tripwire that fires on correct work gets disabled.** D-17's sub-lock 2 is this rule.
- **Correcting a claim requires supplying a REPLACEMENT reason**, or a future reader is left
  holding a documented argument for undoing the work.
- **`rg`, never `git grep`, for an absence claim** -- `git grep` false-zeroes on untracked and
  gitignored paths and the zero reads as confirmation. `rg -c` counts LINES; use `rg -o | wc -l`
  when you mean occurrences.
- **Live-CI first-push close.** The repo names GitHub-Actions-only behaviour explicitly rather
  than faking it locally, and closes it with a job that fails loud -- never a passive log line.
- **Fail-closed writes, best-effort reads.** Every read fault degrades to a MISS, which is
  precisely why a MISS is not self-evidencing and D-08's control table is mandatory.

### Integration Points

- `integration` job -> the sidecar block, the readiness poll, `npm run integration`, and the new
  probe/upload steps. The only job this phase edits.
- The new `o3-witness` job -> `needs: integration`, the ubuntu leg's hash artifact, and the REST
  cache-list and run-jobs endpoints via `curl`.
- `capture-hashes.mjs` -> Nx's internal hasher and task-graph modules; a root-level, non-target,
  hash-neutral boundary.
- The local proof harness -> `nx reset`, `packages/github-cache/dist/serve.js`, `selectBackend`'s
  off-CI branch, `createReleasesReadClient`, and the warm `cache-mirror-202607` shard.

</code_context>

<specifics>
## Specific Ideas

- **The phase's success criteria are explicit about what does NOT count**, and each is an
  anti-requirement worth restating in the plan: a storage-level probe for the Linux hash (TEST-09
  -- it would now HIT, and asserting a 404 would assert a property this milestone deliberately
  destroyed); a HIT recorded without a preceding reset (TEST-10 -- a local hit short-circuits
  before the remote is queried); a `Cache: n/m hit` line read as discriminating (OBS-02, TEST-10);
  a producing-OS reading of `mirrored-by` (D-14); a "the job was green" claim with no paired count
  (TEST-08); and a run that MISSes everything treated as a valid O3 proof (TEST-09).
- **The attribution window already closed once, at Phase 9, not at Phase 12.** TEST-08 says so in
  its own words, and `09-EVIDENCE.md` is what covers that window. Phase 11's capture is the SECOND
  half of a two-part record, not the first.
- **This phase's own edits are what expire its own measurement.** D-10 is not background colour:
  a single new file under `packages/` rotates three of the four hashes O1/O2 depend on. Phase 10
  hit the same class of hazard with D-25's unrecoverable baseline and solved it by ordering; this
  phase inherits the discipline, not just the lesson.
- **Nothing here needs a temporary `main` push for O1/O2.** Those are local measurements against
  an already-warm mirror. Only O3 needs the live run (D-20). Say so, because Phases 9 and 10 both
  needed the push for their perishable halves and a reader may assume the same shape.
- **`lint` is absent from the mirror by design** and is not in this phase's criteria. Recorded so
  a coverage audit does not read four-of-five as a gap.
- **The unattributed `test` failure at `69bd1b7`** is still open in
  `08-nx-task-hash-parity/deferred-items.md`. If `test` fails once during a proof run, capture the
  output BEFORE re-running -- the re-run destroys the evidence, and a failure inside a perishable
  measurement window is the worst place to lose it.

</specifics>

<deferred>
## Deferred Ideas

- **An every-commit Vitest version of D-12's task-graph assertion.** Deferred with a reason, not
  overlooked: TEST-08 asks for a mechanical assertion whose output is captured as evidence, not for
  a permanent gate, and a spec under `packages/` would rotate three of the four hashes the
  perishable local proof depends on (D-10). Revisit in Phase 12, where XOS-04 changes the graph
  premise anyway and the rotation cost is already being paid.
- **XOS-04 / XOS-05 / XOS-08 and the O4 write decision** -- Phase 12, gated on XOS-01 being PROVEN
  here. This is the milestone's load-bearing ordering: enabling O4 makes Windows CI a second
  producer of the `build`/`typecheck`/`test` hashes and permanently destroys O1's attribution.
  Consequence carried forward: TRUST-11's residual risk moves into the XOS-05 write decision, and
  if the Windows legs write, the attribution loss is appended to Phase 10's threat-model record.
- **DOCS-07's consumer portability recipe and its drift guard** -- Phase 12. Its checklist items
  derive from PARITY-01's root-cause record, and it also owns the "if your local box misses
  everything, `nx reset`" note that `PROBE-RESULTS.md` consequence row 10 assigns there. D-07's
  finding, if it fires, feeds that note.
- **PARITY-04's "does my everyday box hit" question.** Named, deliberately not closed here.
  TEST-10's reset forces the COLD state, so this phase answers the cold question only, and D-06's
  both-states pre-flight produces the data a later phase would need without turning it into a
  proof.
- **Collapsing the publish matrix to one leg.** Out of scope until XOS-05 is proven; Phase 10's
  D-26(a) already records the strongest argument for it.
- **A one-off manual prune of the 50 PoC-era `<hash>.tar.gz` assets.** Operational, not code,
  recorded as accepted dead weight with a measured count in `10-EVIDENCE-PRE-RENAME.md`.
- **Regenerating `.planning/codebase/*`** via `/gsd:map-codebase` -- flagged stale in both
  PROJECT.md and STATE.md, listed in Operator Next Steps, and not this phase's work. Conventions
  only until it happens.
- **`roadmap update-plan-progress`'s duplicate checked/unchecked plan list** -- logged as D1 in
  `10-os-invariant-releases-mirror/deferred-items.md`. Expect it again on this phase's plan block.

</deferred>

<unresolved>
## UNRESOLVED -- withheld from auto-lock (HIGH impact, NOT-HIGH confidence)

- **U-01: Whether `nx-cache-<H_linux>`'s existence AT THE MOMENT the Windows `integration` task
  ran can be demonstrated from inside the run, without making matrix-leg order load-bearing.**

  TEST-09(2) requires the Windows `integration` task shown to have executed "in a run where
  `nx-cache-<H_linux>` demonstrably existed in the Actions cache". D-17 proposes demonstrating it
  POST-HOC: `created_at(nx-cache-<H_linux>) < started_at(windows integration step)`. That design is
  sound in principle and needs no ordering -- but it rests on three facts this repo has never
  measured:

  1. Whether `GET /repos/{owner}/{repo}/actions/caches` exposes an entry written by a SIBLING
     matrix leg of the same run, and under which `ref` it appears.
  2. Whether `created_at` on a cache entry and `started_at` on a step are granular and reliable
     enough to establish the inequality, rather than landing inside the same second.
  3. Whether the ubuntu leg in practice completes its `saveCache` before the Windows leg's task
     starts. The two legs of `integration` run in PARALLEL with `fail-fast: false` and no
     `max-parallel`, so nothing orders them.

  IMPACT is HIGH: it decides whether the O3 proof demonstrates what TEST-09 asks for or is
  vacuous on its central clause. CONFIDENCE is NOT HIGH: all three are platform behaviours reasoned
  about rather than observed, and Phase 10's U-01 established that this repo's intuitions about
  matrix-leg semantics are unreliable -- GitHub documents NO matrix leg ORDER guarantee, and Phase
  10's resolution replaced an ordering dependency with a non-overlap dependency precisely because
  of it.

  **`gsd-phase-researcher` OWNS this**, with a pre-stated falsifiable check -- it is an empirical
  question, not a maintainer preference, so it belongs in RESEARCH.md rather than a checkpoint.
  The check: on a recent real run, read `/repos/op-nx/github-cache/actions/caches` and
  `/repos/op-nx/github-cache/actions/runs/{id}/jobs` and confirm (a) sibling-leg entry visibility
  and its `ref`, (b) timestamp granularity on both sides, and (c) the observed gap between the
  ubuntu `integration` step's completion and the Windows leg's start across several runs.

  **If the inequality CAN be established**, D-17 ships as written and the ordering question never
  arises.

  **If it CANNOT**, the fallback is additive but structural: move the Windows `integration` leg out
  of the matrix into its own job that `needs:` the ubuntu `integration` job, so it is the ONLY
  place the Windows `integration` task runs (no prior save of `H_win` exists to HIT on), receives
  `H_linux` from the ubuntu leg's artifact, and probes it BEFORE running the task -- existence and
  the positive control in one probe, at Nx time, in the same job. Note that this changes the shape
  of a core CI job and must be weighed as such.

  **What is NOT available as a fallback:** serialising or reordering the existing `integration`
  matrix so that leg order carries the proof. XOS-06 forbids `max-parallel: 1` becoming a
  correctness control, and the PROJECT.md row "cross-OS sharing rests on target
  platform-agnosticism, NEVER on publish-leg ordering" was written to close exactly that argument.
  If neither the post-hoc inequality nor the dedicated-job fallback holds, STOP and re-open the
  requirement with the maintainer rather than auto-selecting an ordering-based proof.

</unresolved>

---

*Phase: 11-Live Proofs -- O1, O2, O3*
*Context gathered: 2026-07-29*
