# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v0.0.1 — Greenfield MVP Rebuild

**Shipped:** 2026-07-22
**Phases:** 7 | **Plans:** 33 | **Tasks:** 63 | **Commits:** ~366 over 5 days (2026-07-17 → 2026-07-22)

### What Was Built
- Nx self-hosted-cache HTTP server (loopback bind, timing-safe bearer auth, hash validation, 2 GB body cap, best-effort read / fail-closed write) — zero runtime deps at the core.
- Actions-cache CI-RW backend + context-derived `selectBackend` (one backend per process, no caller-facing mode flag) + per-hash lock + SIGTERM drain.
- Authenticated GitHub Releases read-only reader, OS-namespaced so a cross-OS hit never serves a wrong-OS artifact; private-repo-capable local read.
- `{push,schedule}`-gated publish/cleanup engines, one coupled retention knob, fail-loud observability, ~2 GiB and 1000-asset graceful degradation.
- Host-detected fail-closed trust-widening + single-source `trust.ts` allowlist + server-produced-key mirror filter + shipped advisory PPE-hygiene gate.
- npm package + `uses:`-consumable `start-cache-server` JS action + background-step CI sidecar pattern + enumerated/tested public surface + adoption docs + SECURITY.md/LICENSE/semver.

### What Worked
- **Test-first (RED→GREEN) discipline** held across all build phases; mechanisms (sha256 conformance drift guard, pin guards, trust-allowlist deep-equality) were proven RED before GREEN.
- **Single-source-of-truth + drift guards** — `trust.ts`/`sync-gate.ts` allowlists, the enumerated public-surface spec, and the docs-adoption guard each fail the build on unintended change, so the consumer contract can't silently drift.
- **Vertical MVP slices** each landed one dogfoodable capability; the audit + fresh integration re-check found no regressions across the ~89 post-baseline hardening commits.

### What Was Inefficient
- **Live-CI-only bugs.** Three real distribution bugs — cross-OS lockfile drift (esbuild → missing `@emnapi`, `npm ci`), the background-step export handshake, and a readiness-poll/cache-key collision — passed every local gate AND the verifier, and only surfaced on real GitHub Actions. It took 5 live pushes to close them.
- **Dual-root trust copy churn.** The `trust.generated.cjs`/`selfcheck.cjs` pre-`npm-ci` copy was built, guarded, then superseded by esbuild bundling and ultimately removed — effort spent on a file nothing ended up consuming.
- **Requirements-checkbox lag.** VERIFICATION.md verdicts led REQUIREMENTS.md checkboxes by a day, briefly making the 3-source cross-reference look inconsistent (documented convention, but noise).

### Patterns Established
- Host-detected (`GITHUB_SERVER_URL`) fail-closed trust widening; the in-code gate is defense-in-depth, not the load-bearing control.
- A **separate** sync/publish predicate (`{push,schedule}`) distinct from the write-trust gate.
- One coupled retention knob (`CACHE_MIRROR_MAX_AGE_DAYS` → `resolveMaxAgeDays`/`shardTagsForWindow`) drives both read-lookback and cleanup — never a second knob.
- Background-step CI sidecar pattern (`background:`/`cancel:`) as the JS-action-launched Actions-cache path; plain `&` fallback for GHES/older runners.
- First-push "live-close" for behaviors no local harness can exercise (GitHub Actions runtime, per-OS cache-version hashing).

### Key Lessons
1. **Local gates cannot prove GitHub Actions runtime behavior.** Background-step export-variable propagation, the `background`/`cancel` lifecycle, and GitHub's per-OS cache-version hashing are only provable on a real runner — plan an explicit live first-push close for each, don't treat green-local as done.
2. **Single-source-of-truth + a byte/semantic drift guard beats a hand-synced second copy.** Every dual-root artifact drifted or became dead weight; the bundle-from-one-source approach won.
3. **Cross-OS parity is load-bearing and silent when broken** — `.gitattributes eol=lf`, OS-discriminated hashes, and a per-OS matrix must all stay; regressions here fail as invisible all-MISS, not as errors.

### Cost Observations
- Model mix: not instrumented this milestone.
- Notable: the audit + independent integration re-check (with live suite execution) added high confidence at low marginal cost — both prior tech-debt items were already resolved by the time of the re-audit.

---

## Milestone: v0.0.2 — OS-invariant cross-OS sharing

**Shipped:** 2026-08-11
**Phases:** 7 (7-13) | **Plans:** 45 | **Tasks:** 110 | **Commits:** 664 over 20 days (2026-07-22 → 2026-08-11)

### What Was Built
- ESLint 9 flat config + a `lint` target, with an ambient-platform-read ban that is a build failure in unit specs and permitted in integration specs; stale disable directives fail rather than pre-authorising a future violation.
- Cross-OS Nx task-hash parity, root-caused node by node to a single field (`targets.typecheck.outputs`) and fixed with one `nx.json` key — then kept that way by a build-gating two-leg CI comparison that runs every commit, not once.
- An OS-invariant `@actions/cache` version: one hardcoded workspace-relative forward-slash archive path plus `enableCrossOsArchive` at all three call sites, closed behaviourally by a Windows runner reading back a Linux-written entry.
- An OS-invariant Releases mirror: one `nx-cache-<hash>` asset name whose cleanup filter admits the legacy family in the same commit, with `mirrored-by: <os>` preserving incident-response attribution in the free-form label, outside the lookup name.
- All four cross-OS reuse outcomes (O1-O4) proven live in the mandated order, each with a named non-vacuity control, and O1's per-hash producer attribution captured at the last commit before anything rotated.
- A read-only Actions-cache backend composed from the writable one (`{ ...createReadOnlyActionsCacheBackend(), put }`), so the three Windows reuse legs' `[remote cache]` counts became soundly gateable rather than launderable — and cache-version drift became unrepresentable rather than guarded.
- `docs/cross-os.md`: a consumer recipe that leads with the safe default (discriminate everywhere first, earn a removal per target second), drift-guarded and registered in `nx.json`'s `test` inputs.

### What Worked
- **Pre-register the falsifiable condition in git BEFORE the run.** Every live proof wrote its expected counts, its non-triggers, and what would falsify it into a commit that provably predates the run. This is what let a falsified expectation (`readMisses 0`) be read as a finding to root-cause rather than as a result to reinterpret afterwards.
- **Mutation-test the guard in both directions and predict which case reddens.** Gates were proven to fail on a real leg, not only on a fixture — the CORR-03 comparison job was seen RED on real runner data for both halves and GREEN again on the revert, which five plans of fixtures could not establish.
- **Bank the perishable measurement first, gate second.** O1's producer attribution, the pre-rename O2 baseline, and the pre-rotation shard census were all captured before the change that destroyed them. The Phase 11 → Phase 12 boundary exists for exactly this reason and held.
- **Comment-lock the reason, not just the value.** When `publish-mirror.ts`'s byte-identity survived but its REASON changed, the comment was rewritten in the same commit. Where two guards rest on contradictory assumptions, the asymmetry is locked in both directions.
- **Spawn the dedicated auditor even when the workflow offers a clean-looking short-circuit.** TRUST-11/12 were classified by an independent security auditor, with the orchestrator's proposed classification treated as INPUT rather than conclusion.

### What Was Inefficient
- **The recommended measurement instrument was blind to the one node that mattered.** `nx show target inputs` skips `ProjectConfiguration` and reports file paths rather than content hashes, so a "no difference" reading from it was evidence of nothing. Building a per-node `details`-map instrument was a prerequisite, not a nicety — and a whole class of prior cross-OS measurements in this repo (including the pair in STATE.md) turned out to have read a confounded variable.
- **Several guards were vacuous in ways that read as coverage.** A negated matcher inside `toHaveBeenCalledWith` asserts "some call lacks X", not "no call has X". A cardinality gate ("appears twice") is satisfiable by deletion and cannot localize. Two of `assertGraphPremise`'s five assertions could not fail. Each was found by mutation, never by reading.
- **Artifact prose drifted behind the tree, and the first milestone audit went stale.** The audit had to be re-run 110 commits later, and a pre-close gate then surfaced five more open artifacts. Sealed VERIFICATION notes citing pre-fix state are correct-by-design; what cost time was status fields that had simply never been flipped after the work landed.
- **Tooling papercuts consumed real time and produced false confidence twice.** `git grep` silently returns zero on gitignored paths; `rg -c` counts lines rather than occurrences; a leading-slash needle is path-rewritten by Git Bash before rg sees it; a phrase split across a comment-continuation prefix defeats even the prescribed `-U` mitigation. Every one of these reads as a confirmed absence.
- **GSD tooling drift required per-plan repair.** `init.plan-phase` truncates `phase_req_ids` at a ROADMAP line wrap (silently dropping IDs), `state.record-metric` rejects positional arguments so per-plan metrics never recorded, and `roadmap update-plan-progress` left a plan both checked and unchecked. The milestone-close accomplishment extractor also emits deviation headers as accomplishments and undercounts tasks — this entry's list was written by hand.

### Patterns Established
- **Unlaunderable over merely present**, for any gate whose subject can produce its own evidence. A writable leg that MISSes will save its own entry and take a `count >= 1` check green on re-run with the property still dead. Remove the confound structurally; a gate a re-run can launder is worse than no gate.
- **Composition over a second implementation**, when the duplicated thing is a computation whose divergence is the bug you are fixing. Make drift unrepresentable, not guarded.
- **Assertion-level RED, never import-level.** An import-level RED proves the module is missing; it says nothing about whether the assertion bites.
- **Pair every negative result with a positive control at the same path**, and mark non-discriminating metrics as such beside the line rather than in a footnote.
- **Derive OS-sensitive expectations from a declared value set** (`CACHE_OS_VALUES`), never from the running machine — now mechanically enforced by the LINT-02 rule set rather than left as a convention.
- **Re-derive at the current commit; never cite an earlier measurement as current** — including line numbers, which move.

### Key Lessons
1. **A wrong-result guarantee must never rest on accidental correctness.** This milestone removed two such dependencies (`os.tmpdir()` in the version-hashed path, OS-namespaced asset names) and explicitly refused to add a third: an ordering-based argument resting on CI job scheduling was proposed and rejected. Correctness now rests on target platform-agnosticism, proven per target.
2. **Measure the confounder before attributing anything to the variable you care about.** Cold-vs-warm graph state masqueraded perfectly as the OS axis — both axes carried the same two node values. No difference may be attributed to the OS until freshness is pinned.
3. **A guard is worth exactly what its proven failure mode is worth.** Prove it can fail on a real leg, in both directions, with the redness predicted in advance. Repeat-running until green does not prove a flake is fixed, and `nx run-many -t <missing>` exits 0 — so an inferred target is a silently deletable CI gate.
4. **Local gates still cannot prove GitHub Actions runtime behaviour** *(v0.0.1's top lesson, re-verified)*. Every one of the four outcomes needed a real runner, and one live-CI item took three separate proving runs to close. The mitigation that worked was pre-registration plus a rehearsal on a PR before spending the proving run.

### Cost Observations
- Model mix: not instrumented (`state.record-metric` rejects the executor spec's positional call, so per-plan metrics never recorded — fixed by briefing executors, not by the tool).
- Notable: the audit-and-close cycle was disproportionately expensive relative to the build. Two full milestone audits, a cross-phase integration re-check, and a pre-close artifact gate ran across ~110 commits of drift; four of the five items the final gate found were stale status fields over finished work. Flipping status at the moment work lands is cheaper than proving it landed a fortnight later.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v0.0.1 | 7 | 33 | Greenfield vertical-slice rebuild; TDD + live-CI first-push close established |
| v0.0.2 | 7 | 45 | Lint gate replaces convention; pre-registration of falsifiable conditions before every live proof; mutation-testing gates on real legs, not fixtures |

### Cumulative Quality

| Milestone | Tests | E2E flows wired | Threats open | Requirements |
|-----------|-------|-----------------|--------------|--------------|
| v0.0.1 | 430 | 6/6 | 0 | 43/43 |
| v0.0.2 | 1,145 | 5/5 | 0 | 57/57 |

Flow counts are per-milestone acceptance frames, not cumulative: v0.0.1 counted 6 adoption flows,
v0.0.2 counts O1-O4 plus the fifth backend-selection outcome Phase 13 added.

### Top Lessons (Verified Across Milestones)

1. **Local gates cannot substitute for a live GitHub Actions run of runtime-only behaviors.** *(v0.0.1; RE-VERIFIED v0.0.2 — all four target outcomes needed a real runner, and one live item took three proving runs. Mitigation that worked: pre-register the expected counts in git, then rehearse on a PR before spending the proving run.)*
2. **Single-source-of-truth plus a drift guard beats a hand-synced second copy.** *(v0.0.1 as bundle-from-one-source; RE-VERIFIED v0.0.2 in a stronger form — Phase 13 COMPOSED the read-only backend from the writable one rather than guarding two implementations, making version drift unrepresentable rather than merely detectable.)*
3. **A wrong-result guarantee must never rest on accidental correctness.** *(New v0.0.2 — two such dependencies removed, a third proposed and rejected. Re-verify next milestone.)*
4. **A guard is worth what its proven failure mode is worth.** *(New v0.0.2 — prove it RED on a real leg in both directions with the redness predicted in advance; several guards that read as coverage turned out to be vacuous. Re-verify next milestone.)*
