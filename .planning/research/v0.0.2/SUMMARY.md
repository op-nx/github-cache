# Project Research Summary -- v0.0.2 OS-invariant cross-OS sharing

**Synthesized:** 2026-07-26
**Sources:** `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md` (this directory)

> **Provenance note (#222 self-heal):** the synthesizer's `Write` call was blocked by a harness
> report-file restriction. It returned the finished document inline and the orchestrator persisted
> it verbatim. Content is the synthesizer's; only this note and the heading structure are the
> orchestrator's.

> **Unusual ordering:** REQUIREMENTS.md and ROADMAP.md were written and COMMITTED before this
> research ran, and survived a five-lens adversarial review (52 findings triaged). This research is
> a deliberate after-the-fact check, so its primary deliverable is the change list in section 3.

---

## 1. Verdict: amend, do not re-run

**Targeted amendments suffice. Do NOT re-define the requirements and do NOT re-run the roadmapper.**

**Phase count.** No researcher proposes adding, removing, splitting or merging a phase.
ARCHITECTURE -- the only doc that evaluated build order explicitly -- states "Recommended order:
7 -> 8 -> 9 -> 10 -> 11 -> 12. The committed roadmap's sequence is correct." The two phases a re-run
would most plausibly restructure are the two the roadmap already defended: Phase 10's eleven
requirements are one indivisible change (RETAIN-04's same-commit rule plus OBS-05's before-CORR-02
rule make any split ship a strictly worse half-state), and Phase 12's three exist BECAUSE the 11->12
boundary IS the mandatory ordering. Research strengthens both. Phase 11 gains implementation work it
was not scoped for -- that is plan capacity inside a phase, not a boundary problem.

**Phase order.** Every sequencing constraint survives; three are now better evidenced than when
written. LINT-01 before PARITY-01 is confirmed at Rust source level (`ProjectConfiguration` emitted
for every task on both branches of `gather_self_inputs`). RETAIN-04 same-commit-as-CORR-02 confirmed
by reading `cleanup.ts:89` -- the filter is the only gate on the delete path. OBS-05 before CORR-02
confirmed via `read-back.ts:37` plus `publish-mirror.ts:262-266`. One JUSTIFICATION weakens without
changing order: ARCHITECTURE 6.5 finds the mechanical argument for 9-before-10 weak in both
directions (10-first would also be safe), so keep the order for the reason the roadmap actually
gives -- all four TRUST requirements in one phase with verifiable code behind them -- and stop
over-claiming mechanics. Prose edit, not a re-run.

**Requirement coverage.** 43 mapped, no orphans. Research deletes ZERO, moves ZERO between phases,
and adds five new IDs plus one conditional clause -- all landing in phases that already own their
subject matter. Post-amendment: 48/48, distributed 8 / 7 / 11 / 12 / 7 / 4. Phase 10 goes 11 -> 12
(already flagged intentionally heavy, for reasons that still hold); Phase 12 goes 3 -> 4
(strengthens its thin-by-design profile). **No phase changes shape.** A re-derivation reproduces the
same six phases in the same order with the same owners, and costs the 52-finding adversarial review
the current text already survived.

**Cost of amendment:** 11 requirement-text edits, 5 new REQ-IDs, ~20 success-criteria edits, 6
recorded decisions. Two decisions are BLOCKING for planning and must be settled at amendment time:
O3's proof shape, and Phase 12's ordering mechanism.

**The one thing that would change this verdict:** if the zstd probe returns NONE on
`windows-11-arm`, XOS-05 is unreachable at the library level, Phase 12 loses its primary
deliverable, and a real scope decision is needed (`choco install zstandard` step vs deferring O4 to
v0.0.3). A contingency, not a present reason to re-run -- but cheap to foreclose. **Run the probe
before Phase 9 planning**, not at Phase 12 where it currently sits implicitly inside VER-05.

---

## 2. Key findings

### The store was the outlier, and the ecosystem agrees with the direction

Zero of seven inspectable Nx remote-cache implementations namespace by OS, and the Nx wire protocol
carries no OS field at all (`http_remote_cache.rs` sends only the hash). v0.0.1's OS-namespaced
store was the ecosystem outlier. But "trust the hash" is the norm for the STORE, not the SYSTEM:
Bazel puts platform in the action digest, ccache/sccache capture it via hashed content, Gradle
requires a `@CacheableTask` annotation. Only Turborepo genuinely assumes. The honest framing is
**"trust the hash, having first made the hash trustworthy"** -- which is exactly CORR-02 plus
CORR-04.

### Nx has no mechanism-B safety net, and that is the strongest argument for declare-first

ccache tolerates cross-OS sharing because the things that differ (compiler binary, system headers)
are themselves inside its hash, so its documented consequence is "few or no cache hits" -- a MISS
problem. Nx hashes nothing outside the workspace unless a `runtime` input names it. Under Nx an
undeclared platform dependency is a WRONG ARTIFACT, not a miss. DOCS-07 must not import ccache's
relaxed posture.

### Nobody detects portability violations, and the reason is structural

Every detector that exists re-executes the task: Nix `nix-store --realise --check` (dedicated exit
code 104), reprotest's double-build plus diffoscope, Develocity's out-of-band scripted experiments.
A cache that re-runs tasks is not a cache. This upgrades the committed out-of-scope row's
justification from proportionality to structural necessity, and independently corroborates the
"green O4 CI is circular evidence" note already in REQUIREMENTS.md.

### Two barriers are being removed and the third was never a barrier

v0.0.1 had three overlapping separations: incidental Nx hash divergence, the `@actions/cache`
version, and the `<hash>-<os>` asset name. v0.0.2 removes two deliberately and fixes the third's
accidental divergence so it can no longer separate either. Afterwards the MISS-not-wrong-result
invariant rests on exactly ONE declared input (CORR-04) plus the CORR-05 platform-agnosticism claim.
Every Phase 8-12 gate is ultimately a gate on that one invariant.

### Nx's own documentation endorses the recipe's ordering

`configure-inputs.mdoc`: "Nx errs on the side of caution when using inputs... **Start safe and
fine-tune your inputs when there are clear opportunities to improve the cache hit rate.**" That is
DOCS-07's mandated declare-first structure, stated by the framework. Quoting it converts the recipe
from this project's opinion into the framework's guidance.

---

## 3. Required changes to the committed artifacts

### 3.1 BLOCKING -- wrong or unsatisfiable as written

Eleven findings. Six were anticipated; five were not.

**B-1. `VER-04` asserts the wrong variable (CRITICAL).** *PITFALLS B1 + ARCHITECTURE 2.1 h2 +
STACK 2.3 -- three-way.* `@actions/cache` never reads "the Nx workspace root". Four anchors: glob
expansion -> `process.cwd()`; tar-manifest relativization -> `GITHUB_WORKSPACE ?? cwd`; `tar -C` ->
`GITHUB_WORKSPACE ?? cwd`; our `readFile`/`writeFile` -> `cwd`. They coincide only when
`cwd === GITHUB_WORKSPACE`. A container action, a step-level `working-directory:`, or a sidecar
started from a subdirectory breaks the identity while cwd is still "a" workspace root. Failure:
restore HITs, extracts under `$GITHUB_WORKSPACE`, `readFile` ENOENTs under `$CWD`, `server.ts`
`handleGet` catches it -> 404. **Permanent silent all-MISS while `@actions/cache` logs
`Cache hit for:`.** Fix: assert the conjunction -- cwd is the workspace root AND
(`GITHUB_WORKSPACE` unset OR `resolve(GITHUB_WORKSPACE) === resolve(cwd)`), resolved and
case-normalised. Assert ONCE at `createActionsCacheBackend()` construction; a per-request check is
swallowed by `handleGet` and becomes another silent MISS. Keep `cacheArchivePath` a pure string
function. Record the asymmetry: the same fault is LOUD in `publishMirror`, SILENT in `serve`.

**B-2. `TEST-09`/`XOS-03`'s proof method inverts after Phase 9 (CRITICAL, unsatisfiable).*
*ARCHITECTURE 6.1.* After VER-01/VER-03 the version is identical across OSes, so
`restoreCache([path], 'nx-cache-<H_linux>')` on `windows-11-arm` HITs. Asserting a 404 asserts a
property this milestone deliberately destroyed -- and if it DID 404, the likeliest cause is
compression-method divergence, exactly the "passes for the pre-change reason" failure TEST-09
exists to prevent, inverted. Fix -- three-part Nx-hash proof: (1) cite CORR-03(b)'s build-gating
record that `H_linux != H_win`; (2) show the Windows `integration` task EXECUTED (no
`[remote cache]`) in a run where `nx-cache-<H_linux>` demonstrably existed; (3) positive control in
the same job via a scripted authed GET on a known-present key, extending `ci.yml:391-407`. XOS-03's
outcome stays true but must be re-read as a statement about Nx HASHES, not cache storage.

**B-3. `TRUST-11` names the wrong arbitration point (HIGH).** *ARCHITECTURE 4.4; PITFALLS B6
asserts the opposite -- adjudicated in section 4.* Two publish legs never produce differing
payloads: for a given hash the Actions cache holds exactly ONE entry, and both legs restore it and
upload verbatim without re-executing. The real arbitration is at `saveCache`, once XOS-04 puts
build/typecheck/test on a Windows leg and two jobs compute the same H. That race IS
ordering-dependent. XOS-06 is satisfied because no requirement DEPENDS on the winner, not because
the race does not exist. Fix: relocate to `saveCache`; note it does not exist until Phase 12 adds a
second producer -- **this moves TRUST-11's residual risk into the XOS-05 write decision**. Keep the
month-shard clause verbatim. Add: cross-OS restore is byte-faithful (tar-in-tar, inner entry names
forward-slash-normalized), so the out-of-scope file-mode question applies to the Nx client's
extraction of the INNER tar, not our transport. Correct BEFORE the Phase 10 audit.

**B-4. `LINT-01`'s "covered by the pinned-deps guard" is false (HIGH).** *PITFALLS E6 +
ARCHITECTURE 5.1 + STACK 1.7.* `pinned-deps.spec.ts` asserts exact specifiers for a hard-coded name
list (`@actions/cache`, `@actions/core`, `@octokit/rest`, `@octokit/plugin-retry`,
`@octokit/plugin-throttling`, `esbuild`). It cannot enforce "every dep is exact" -- the workspace
deliberately carries ranges. Pinning without adding NAMES leaves the deps unguarded, and a later
`npm install eslint@latest` passes every check. Fix: LINT-01 states the new names are ADDED to the
spec, and the ROBUST-03-class decision is recorded in the spec comment (`esbuild` is in the list,
`prettier` is not -- the precedent is genuinely ambiguous).

**B-5. `PARITY-02` is missing a fourth axis: warm vs cold `.nx/workspace-data` (HIGH).**
*PITFALLS B4, VERIFIED from `260725-w3s-RESULTS.md` s4.* On one Windows box at one commit, varying
only graph freshness, all four targets compute different hashes. **Both values STATE.md attributes
to "ubuntu CI" vs "windows CI" are reproducible on one Windows machine by varying nothing but graph
freshness.** CI is always COLD; the O1 workstation is WARM. So CORR-03(c) can be permanently green
while O1 misses, and nothing fails. Fix: (a) PARITY-02's three points each record graph state, with
the Windows workstation measured in BOTH -- four values per target; (b) PARITY-04 gains graph state
as a fourth recorded attribute; (c) "warm local hash == cold CI published hash" becomes a separate
NAMED acceptance question; (d) do not silently resolve it with `nx reset`, which clears
`.nx/workspace-data` too and forces COLD -- convenient for the proof, misleading as evidence of the
everyday developer experience.

**B-6. `CORR-05` has four violation sites, not three, and one survives CORR-02 (HIGH).**
*ARCHITECTURE 2.2 Gap 1.* `cache-archive-path.spec.ts:1,26` (VER-02, Phase 9);
`releases-backend.spec.ts:38` and `release-asset-name.spec.ts:39` (CORR-02, Phase 10); and
`release-asset-name.spec.ts:60`, removed by NOTHING -- OBS-03 deliberately keeps `cachePlatform`, so
the default-argument test stays meaningful and stays an ambient read. CORR-05 cannot become true in
Phase 10 as written. Fix: name four sites; Phase 10 makes an explicit call on `:60` (recommend
moving it to `public-server.integration.spec.ts`, where LINT-02 allows it). **Unwritten sequencing
consequence:** after Phase 7 all four sites FAIL lint, and LINT-03 requires them confirmed CAUGHT
while they still exist. Phase 7 must therefore land a described `eslint-disable-next-line` at each,
and LINT-06's `reportUnusedDisableDirectives: 'error'` forces each out with its violation in Phases
9/10. That is the mechanism working as designed, but it is in no success criterion.

**B-7. `LINT-02`'s literal glob set inverts the rule for `.mts`/`.cts` (MEDIUM-HIGH).**
*PITFALLS E5.* `vitest.integration.config.mts` includes `{ts,mts,cts}`; the mandated `ignores:
['**/*.integration.spec.ts']` does not. An `*.integration.spec.mts` would be linted as a UNIT spec
and its LEGITIMATE platform read would fail lint -- the rule inverted against the class it exempts.
Symmetrically a `*.spec.mts` unit spec slips the ban. Fix: mirror the full extension set in both
globs, plus a drift spec asserting the ESLint globs and the two vitest configs agree.

**B-8. One rule cannot enforce the ban list (MEDIUM-HIGH).** *STACK 1.5 + PITFALLS E4.*
`no-restricted-syntax` cannot see a destructured named import -- and one of the four CORR-05 sites
is exactly that shape (`import { tmpdir } from 'node:os'`). Conversely `no-restricted-imports`
cannot ban a member of a namespace import. Both are needed; both are core rules. LINT-03's RED
fixture must cover evasions, not only the four extant sites.

**B-9. `OBS-03`'s "producing OS" is not derivable at the publish site (MEDIUM-HIGH).**
*ARCHITECTURE 4.6.* The label derives from the PUBLISHING leg's `cachePlatform()`;
`listCacheEntries` returns `{ key }` only. Publisher-OS equals producer-OS only because restore is
same-OS -- **and Phase 9 is what breaks that identity.** After VER-03 the ubuntu leg mirrors a
Windows-produced entry and labels it `linux`. OBS-03 would produce a label that is WRONG in exactly
the cross-OS case it exists to serve. Fix: label `mirrored-by: <os>` and record the limitation.
Explicitly RETRACT the stronger claim that the label answers "whose bytes did the developer get".
Also: OBS-03 needs a seam widening no requirement mentions --
`uploadReleaseAsset(releaseId, name, bytes)` gains `label`, plumbed through `action/index.ts` and
every fake in `publish-mirror.spec.ts`.

**B-10. `VER-05`'s value is not readable from `@actions/cache` (MEDIUM).** *PITFALLS B9.* The
exports map is `{".": ...}` only; `getCompressionMethod` is internal -- the same
`ERR_PACKAGE_PATH_NOT_EXPORTED` wall VER-02 documents. So VER-05 means an independent
re-implementation, which will disagree if written naively: upstream runs `zstd --quiet --version`,
collects stdout AND stderr, swallows throws to `''`, and branches on
`versionOutput === '' ? Gzip : Zstd` -- **the parsed semver is computed and then not used**, so a
broken-but-present zstd still selects zstd. Fix: mirror the command, the capture and the
empty-string rule exactly; comment-lock to the pinned version; keep it advisory, never gating; add
"re-read `getCompressionMethod`" to the bump checklist.

**B-11. `VER-06`'s presence-only read-back is vacuous by construction (MEDIUM).** *PITFALLS B8.*
The seed key is `nx-cache-<GITHUB_RUN_ID>` -- one key per RUN, not per OS. VER-06 is a valid
cross-OS proof only while there is NO Windows `dogfood-seed` leg; the moment one exists the Windows
verify restores the Windows-written entry and passes even if cross-OS restore is completely broken.
This is precisely the failure class OBS-05 closes on the Releases side; the Actions-cache side has
no mirror-image guard. Fix: assert PROVENANCE not presence (extend `dogfoodBody` to encode the
producing OS; assert the Windows leg read a linux-produced body), and write the vacuity condition
into the job comment.

### 3.2 NEW requirements

**`PARITY-06` (Phase 9)** -- register `{workspaceRoot}/.github/workflows/ci.yml` as a `test` input
and comment-lock `nx.json`'s explicit list. `nx.json` lists `cleanup.yml` and NOT `ci.yml`, so any
new spec asserting on `ci.yml` serves a stale cached PASS. Consumers: Phase 9 DOCS-08, Phase 10
OBS-05/XOS-06/XOS-07, Phase 12 DOCS-07. The same edit must record WHY the explicit list exists:
`targetDefaults` inputs REPLACE rather than merge, and `@nx/vitest`'s inferred `test` target carries
`{ env: 'CI' }` -- true on every runner, unset on a workstation -- which would make **O1
structurally impossible for `test`**. We are safe by accident and nothing records it. Placed in
Phase 9 rather than Phase 10 so its hash rotation collapses into VER-01's existing window.

**`VER-07` (Phase 9)** -- the archive directory exists and the literal stays gitignored. `put()`
does `writeFile` before anything creates `.nx/cache` -> ENOENT -> 500, failing the build; one
`mkdir(recursive)` at construction. The read path self-heals (`extractTar` runs `io.mkdirP`); the
write path does not. `.gitignore` covers `.nx/cache`, NOT `.nx/` -- a later tidy to
`.nx/github-cache/` would put a transient multi-MB file into Nx's workspace file map, producing a
self-referential intermittent hash perturbation. Comment-lock the literal as chosen because
GITIGNORED. `nx reset` deletes `.nx/cache`, so Phase 11's ordering is reset FIRST, then sidecar.

**`ROBUST-04` (Phases 9, 10; 7 if autofix touches those files)** -- run `npm run build:action` in
the SAME COMMIT as any `serve()`-reachable edit. The committed bundle inlines both comment-locked
helpers and `getCacheVersion`'s `windows-only` branch, and four sidecar jobs run the COMMITTED
bundle from the git ref. Drift means the sidecar writes at V_old while publish restores at V_new --
the mirror silently stops receiving anything, surfacing only as the all-restore-MISS warning OBS-04
has just told everyone to expect once.

**`RETAIN-05` (Phase 10, same commit as CORR-02)** -- (a) ~50 PoC-era `<hash>.tar.gz` assets match
NO filter before or after RETAIN-04; they are permanent occupants of the 1000-asset cap. Decide and
record. (b) Assert the two filter branches mutually exclusive directly -- non-overlap is currently a
property of the last-`-` split, not of the design. (c) `CACHE_KEY_PREFIX` becomes QUADRUPLY
load-bearing (Actions key, `isServerProducedKey`, asset name, cleanup filter); changing it orphans
the mirror and the legacy branch would not cover the orphans.

**`XOS-08` (Phase 12)** -- a producer-to-consumer ordering for the O4 proof. The `integration`
matrix precedent does NOT transfer: its legs compute different hashes, so parallelism is harmless;
the new legs compute the SAME hash, so in parallel they both MISS and race `saveCache`. Once
PARITY-06 lands, the commit that ADDS the Windows legs invalidates the `test` hash, so the
cross-push option needs a second no-op push. Recommend `needs:` on the corresponding ubuntu jobs.

**Conditional clause on `XOS-05` (Phase 12)** -- a scheduled `--skip-nx-cache` `windows-11-arm` job
ONLY if the write decision is "they write". See the adjudication in section 4.

### 3.3 Roadmap success criteria that must change

**Phase 7** -- pinned-deps wording (B-4); full `{ts,mts,cts}` set plus drift spec (B-7); name BOTH
rules (B-8); **replace the `releaseAssetName(hash, 'win32')` example with `cachePlatform('win32')`**
-- the `platform` parameter is dead after Phase 10 and `fallow` will flag it, while OBS-03 preserves
`cachePlatform`; four sites each carrying a described disable so Phase 7 lands green (B-6); LINT-04's
three lint-specific instances (`eslint.config.*` and its imports are inputs; every file ESLint reads
is hashed, not just `src/**`; NO type-aware linting -- no rule needs `projectService` and it would
widen inputs to the whole TS program). New SC: enumerate the `lint` target's inferred nodes for
Phase 8, and CORR-03 treats `lint` as a fourth target.

**Phase 8** -- name the instrument correctly: **`nx show target inputs` is blind to
`ProjectConfiguration`** (skipped per `HashPlanInspector.inspectInputs`' own API doc) **and reports
file PATHS not HASHES**, so both of v0.0.1's named suspects are invisible to it and a "no
difference" result is not evidence. PARITY-01 needs the per-node `details` map, which nothing in the
CLI prints. Add `.nx/cache/run.json` as the task-level surface. Graph state on every recorded hash
(B-5). New SC: name the leading hypothesis -- `hash_project_config` is RULED OUT (every hashed field
already forward-slashed and `{projectRoot}`-tokenised), so start at `External`, then
`ProjectFileSet`.

**Phase 9** -- VER-04 conjunction (B-1) plus mkdir and the gitignored comment lock (VER-07);
provenance not presence (B-11); independent re-implemented probe (B-10); **OBS-04's tripwire gated
on "two consecutive all-miss pushes with no version-affecting change in between"**, and note there
are THREE legitimate rotation windows, not two. DOCS-08's location list is incomplete -- add
`ci.yml:356-360` and `docs/advanced.md:45`; note `README.md:125` and `trust-and-security.md:155`
frame "never a wrong result" as a consequence of FAULT DEGRADATION, which stays true, so the
correction there is ADDITIVE. New SCs: PARITY-06, ROBUST-04, and the zstd/GNU-tar pre-flight probe
recorded before any Phase 9 code lands.

**Phase 10** -- orphan disposition, branch disjointness, `CACHE_KEY_PREFIX` lock (RETAIN-05); four
sites and the `:60` disposition plus a replacement negative control (B-6); `mirrored-by` (B-9) and
the `uploadReleaseAsset` seam as explicit scope; corrected TRUST-11 input (B-3). Record, not SC: the
Windows publish leg will mirror ZERO real assets after this phase -- the strongest argument for the
deferred collapse; and the Phase 9-to-10 window's 2x shard growth, which is bounded and NOT a
correctness bug.

**Phase 11** -- the three-part O3 proof (B-2); `nx reset` FIRST then sidecar. **"Proof-only, so MVP
slicing does not apply" is half right** -- MVP slicing still does not apply, but "no code" does not
either: new `ci.yml` probe steps plus new task-graph assertion tooling for TEST-08. New SCs: every
"job was green" claim paired with a count that would differ under the failure hypothesis, named in
the plan not after the run; `ACTIONS_STEP_DEBUG` on for the proving run; a soundness probe before
the measurement; `Cache: n/m hit` recorded and explicitly marked non-discriminating both ways.
**The attribution window closes at Phase 9, not Phase 12.**

**Phase 12** -- `needs:` (XOS-08); the conditional detector; and the free credibility wins for
DOCS-07: lead with Nx's own "start safe" guidance, present the discriminator as the documented
`sharedGlobals` runtime-input pattern, frame VER-01 as the standard relocatability fix, name
`CACHE_KEY_PREFIX` as the poison-disowning epoch knob, and ADD the anti-import warning that ccache's
"same OS recommended" posture does NOT transfer to Nx.

---

## 4. Disagreements, adjudicated

1. **Where first-write-wins arbitrates. PITFALLS B6 vs ARCHITECTURE 4.4 -> ARCHITECTURE.** For a
   given hash the Actions cache holds one entry; both publish legs restore it and upload verbatim.
   The differing-payload race is at `saveCache` and does not exist until Phase 12 adds a second
   producer. Both agree on the action: rewrite `publish-mirror.ts:159` in the CORR-02 commit --
   byte-identity survives, its REASON changes.
2. **A sampled detector. PITFALLS B5 vs FEATURES s3 -> RECONCILE BY SCOPE.** FEATURES is decisive
   for Phases 7-11 (a cache-defeating job during the milestone proving the cache muddies TEST-08's
   attribution). PITFALLS is right for Phase 12 under its own condition. Result: a conditional
   clause on XOS-05. Does not reopen the committed out-of-scope row.
3. **Does `pinned-deps` cover new deps? STACK 1.7 heading vs PITFALLS E6 -> PITFALLS.** STACK's body
   already agrees; only its heading under-sells.
4. **PARITY-01's capture command. STACK 3.5 (`run.json`) vs PITFALLS B3 (per-node details) ->
   COMPLEMENTARY, name both.** Neither alone satisfies both PARITY-01 and PARITY-02/03.
5. **`@nx/eslint` vs an explicit target. STACK s0 vs PITFALLS E2 / ARCHITECTURE 6.4 -> KEEP
   `@nx/eslint`**, all three converge on the same mitigation. The dismissal is close -- the
   explicit-target alternative would dissolve the LINT-01 -> PARITY-01 constraint entirely -- so put
   it in the Phase 7 plan in one line before rejecting it.
6. **Does `windows-11-arm` ship zstd? Two EXTERNAL sources contradict.** `actions/cache#1622`'s last
   comment (2026-07-10) says yes; `actions/partner-runner-images`
   `arm-windows-11-image.md@20260105.41.1` still lists zstd under "Omitted software". One is stale.
   It matters because `compressionMethod` is pushed into the version UNCONDITIONALLY, before and
   independent of the `enableCrossOsArchive` branch. Workaround exists (`choco install zstandard`).
   **Probe before Phase 9 planning.**

---

## 5. Contradictions with the locked decisions (D2-01..D2-06)

**None contradicted.**

- **D2-01** CONFIRMED and strengthened -- v0.0.1 was the ecosystem outlier.
- **D2-02** CONFIRMED with a BETTER basis than YAGNI: every comparator puts the knob in the task
  DECLARATION, never in the cache BACKEND. "Wrong layer" does not expire the way "zero adopters"
  does.
- **D2-03** not contradicted; its unrecorded consequence is the quadruple single-point-of-failure
  (RETAIN-05).
- **D2-04** not contradicted but UNDER-CONSTRAINED -- three researchers independently add
  constraints it does not carry (VER-07). A `github-cache/` subdirectory still satisfies it.
- **D2-05** verified verbatim, but its one-line framing under-sells its precondition. Use the longer
  form: "trust the hash, having first made the hash trustworthy."
- **D2-06** untouched.

Two out-of-scope rows: the divergence-detection exclusion is CONFIRMED with its justification
upgradeable from proportionality to structural. The executor-classification exclusion is correct,
but every comparator ships a default POSTURE anyway and v0.0.2's lives only in DOCS-07 -- defensible
with zero adopters, but record it as a deliberate choice and note it is the first thing to harden if
an adopter appears.

---

## 6. Confidence and open gaps

Overall **HIGH**. Three of the eleven blocking findings were reached independently by two or three
researchers (VER-04: three; the pinned-deps gap: three; the missing `mkdir`: three). Both
single-source findings that CONTRADICT another researcher resolved against the single source once
checked at source level.

**Open gaps:** (1) `windows-11-arm` zstd -- MUST-MEASURE, gates O4; (2) GNU tar on the same probe;
(3) which hash instruction diverges -- this IS PARITY-01, `ProjectConfiguration` ruled out; (4)
whether `@nx/eslint` infers `lint` identically on both OSes -- CORR-03 settles it; (5) whether Nx
23's local-cache eviction can delete foreign files from `.nx/cache`; (6) closed-source Powerpack /
Nx Cloud key derivation (not load-bearing).

**Two hard locks that currently hold BY ACCIDENT with nothing recording why** -- both worth a
comment lock during Phase 8: never make `vitest.config.mts`'s `coverage.reportsDirectory` absolute
(`@nx/vitest`'s `normalizeOutputPath` has exactly one OS-sensitive branch and we miss it only
because the value is relative), and never "restore" the inferred `test` inputs (`{ env: 'CI' }`
would make O1 structurally impossible for `test`).

---

## 7. Sources

`.planning/research/v0.0.2/STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`, each carrying
its own verification log. Primary sources across the four include: `@actions/cache` 6.2.0 as
installed and the `actions/cache` local clone; the `nrwl/nx` local clone at tag 23.1.0; the
`bazelbuild/remote-apis` proto; Gradle's build-cache and `@CacheableTask` docs; `vercel/turborepo`
hash structs; `mozilla/sccache` and the ccache manual; `NiklasPor/nx-remotecache-custom` and five
sibling implementations; the npm registry for `@nx/eslint`, `@nx/eslint-plugin` and
`typescript-eslint`; Nix `nix-store --realise --check`; Debian `reprotest`; and the
Reproducible Builds environment-variations catalogue.
