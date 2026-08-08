# Phase 9: OS-Invariant Actions-Cache Version - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-28
**Phase:** 9-OS-Invariant Actions-Cache Version
**Mode:** `--analyze --auto --chain` -- all gray areas auto-selected, recommended
option auto-locked per area, trade-off tables recorded here for the audit trail.
One item withheld from auto-lock per the HIGH-impact / NOT-HIGH-confidence rule.
**Areas discussed:** Requirement-list integrity, Archive-path literal, VER-02
replacement spec, VER-04 construction guard, VER-03 call sites, VER-05 compression
probe, VER-05 surfacing, VER-06 provenance encoding, VER-06 job topology, PARITY-08
input + lock, OBS-04 tripwire mechanism, DOCS-08 site list, ROBUST-04 bundle
sequencing, Attribution-evidence expiry

---

## Requirement-list integrity (pre-flight)

| Option | Description | Selected |
|--------|-------------|----------|
| Trust `init.plan-phase`'s `phase_req_ids` | 9 IDs; standard path | |
| Pass the corrected 11-ID list explicitly to every downstream agent | Measured truncation; ROADMAP line wrap at `:256-257` drops OBS-04 and DOCS-08 | YES |
| Fix ROADMAP.md's wrapping so the query returns 11 | Edits a locked artifact mid-phase; rotates nothing but invites a re-read of the whole roadmap | |

**Choice:** pass the corrected list explicitly (D-00).
**Notes:** Measured this session, not assumed. Phase 8 lost `CORR-03` and `CORR-04` to
the identical defect. Option 3 was not taken because ROADMAP's `:537-544` table and
`:575` count are ALSO wrong for this phase, so unwrapping one line would leave two
other disagreements standing and produce a false sense of repair. D-28 makes
REQUIREMENTS.md the audit source instead.

---

## Archive-path literal (VER-01, VER-07)

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| `.nx/cache/nx-github-cache-<hash>.tar` (flat, keep the stem) | Existing hand-authored basename literal in the spec survives; `.gitignore:41` covers exactly `.nx/cache`; `nx reset` clears it | Lands a foreign file inside Nx's own cache dir (see U-01) | YES |
| `.nx/cache/github-cache/<hash>.tar` (nested) | Namespaced away from Nx's own entries | Two literals to keep in sync; throws away the spec's existing pinned basename; one more mkdir level | |
| `.nx/github-cache/<hash>.tar` | Reads cleanly | **Rejected by VER-07 explicitly**: `.gitignore` covers `.nx/cache`, not `.nx/`, so this puts a transient multi-megabyte file into Nx's workspace file map | |

**Choice:** flat `.nx/cache/nx-github-cache-<hash>.tar` (D-01, D-02).
**Notes:** D2-04 already locks "workspace-relative forward-slash literal under
`.nx/cache/`", so only the stem was genuinely open, and keeping the existing stem is
the evidence-backed pick. The residual risk in option 1 is carried as U-01 rather than
waved away.

---

## VER-02 replacement spec

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Pin the FULL literal only | One assertion; fails on any rename or reparent | `test` runs on ubuntu ONLY today, and a reintroduced `join()` renders the same string there -- so it cannot catch the exact regression VER-01 forbids | |
| Pin the FULL literal + a source scan proving no `node:path` / `node:os` import | Directly asserts VER-01's MUST-NOT list; non-vacuous on a single-OS runner | Runs into Phase 8's "an absence claim must not spell the token it forbids" trap | YES |
| Add `isAbsolute` / no-backslash shape checks | Cheap | Redundant once the literal is pinned, and `isAbsolute('C:/x')` is `false` under POSIX, so it would be actively misleading | |

**Choice:** literal pin plus source scan (D-04), with the needle-spelling trap
addressed explicitly (D-05).
**Notes:** VER-01 is written as a list of prohibitions, so asserting the prohibition
is the faithful shape rather than a proxy. The shape checks were dropped as redundant,
not as unimportant.

---

## VER-04 construction guard

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| `existsSync(join(cwd, 'nx.json'))` + the `GITHUB_WORKSPACE` conjunct | Dependency-free (mandatory: the module is inlined into the `uses:`-resolved bundle and `nx` is a devDependency); fails on a subdirectory cwd | Cannot tell "no Nx workspace anywhere" from "cwd is a subdirectory" | YES |
| Walk up for `nx.json` and assert it equals cwd | Better error message | Reaches no verdict the cwd probe does not already reach; adds a loop for message quality only | |
| Assert only the `GITHUB_WORKSPACE` conjunct | Smallest | Drops half of VER-04's explicit CONJUNCTION | |

**Choice:** option 1 (D-07), asserting BEFORE the `mkdirSync`.
**Notes:** VER-04 says "the Nx workspace root" alone is the WRONG variable, so the
`GITHUB_WORKSPACE` conjunct carries the real weight; the cwd conjunct exists so the
workspace-relative literal resolves where Nx runs. Recorded consequence: an adopter
whose Nx workspace sits in a repo SUBDIRECTORY now fails loud at construction instead
of silently over-partitioning -- which is what VER-04 wants, and there are zero
adopters (D2-02).

---

## VER-03 call sites and the positional flag

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Per-call exact argument arrays only | Pins the positional index by measurement | Only sees sites the specs execute; a fourth site on an unexercised path passes | |
| Source-level count of `@actions/cache` reaches only | Catches a fourth site anywhere | Says nothing about argument position, which is the part upstream's JSDoc gets wrong | |
| Both | Covers position AND a future fourth site | Two assertions instead of one | YES |

**Choice:** both (D-11).
**Notes:** The indices were VERIFIED against the installed `cache.d.ts` rather than
read from the JSDoc -- `saveCache`'s JSDoc lists `enableCrossOsArchive` before
`options` while the real signature is the reverse (D-09). The `lookupOnly` probe must
carry the flag too or a Windows write turns into a spurious 409 (D-10).

---

## VER-05 compression probe

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| New leaf using `spawn` directly, stdout+stderr, no exit-code check, no timeout | Mirrors `cacheUtils.js` exactly, which is the requirement | One more module | YES |
| Reuse `local-context.ts`'s `runHelper` | Existing hardened wrapper, one mock shape | **Wrong on both axes**: stdout-only, and resolves `undefined` on non-zero exit -- so it would report `gzip` for a broken-but-present zstd, the exact case VER-05 names | |
| `execFile` | Terser | Rejects on non-zero exit, reintroducing the same inversion unless the error object's streams are re-read | |
| Add `@actions/exec` as a direct dependency | Literally upstream's call | A new exact-pinned dep plus a `pinned-deps.spec.ts` name entry, against the D2-02 no-new-surface posture, for one version probe | |

**Choice:** option 1 (D-12, D-13, D-14, D-15).
**Notes:** The no-timeout call is deliberate and recorded as the one place hardening was
declined: a timeout would make the SURFACED value differ from what `@actions/cache`
actually computed, and the hang risk is already upstream's -- the library calls
`getCompressionMethod()` itself on every restore/save in the same job.

---

## VER-05 surfacing

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| A separate `core.summary` line after the count table, plus `core.info` | Keeps the shared renderer intact; `core.summary.write()` appends by default | Two `write()` calls | YES |
| Widen `writeCountSummary` to accept string values | One call site | `summary.ts`'s own comment refuses widening for one caller, and the column header is literally `count` | |
| Encode as a number (`zstd=1`) | Fits the existing shape | Unreadable; defeats the point of surfacing it | |

**Choice:** separate line (D-16). Surfaced, never gated.

---

## VER-06 provenance encoding

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| `dogfoodBody(hash, producerOs)` -- required explicit parameter | The vacuity trap becomes structurally unreachable: with no default, the verify leg cannot silently compare against its own OS | Touches both callers (`action/index.ts`, `roundtrip/read-back.ts`) | YES |
| Read `process.platform` inside `dogfoodBody` | No signature change | Makes the reader compute its OWN OS, which is exactly the assertion VER-06 needs to be impossible; also the banned CORR-05 shape | |
| A second function `dogfoodBodyFor(hash, os)` | Non-breaking | Two payload derivations for one payload -- the drift the leaf exists to prevent | |

**Choice:** required explicit parameter (D-18), with `CacheOs` imported type-only so
`dogfood-body.ts` stays a runtime leaf. Verify asserts the LITERAL `'linux'` (D-19).

---

## VER-06 job topology

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Matrix `dogfood-verify` over `[ubuntu-24.04-arm, windows-11-arm]`, seed stays ubuntu-only | Keeps the v0.0.1 same-OS round-trip close AND adds the cross-OS one; reuses the proven `integration` matrix shape | One extra leg's runtime | YES |
| Flip `dogfood-verify` to windows only | Smallest diff | Trades away an existing live proof for a new one | |
| Add a third job `dogfood-verify-windows` | Explicit | Duplicates ~15 lines the matrix expresses once | |
| Also add a Windows `dogfood-seed` leg | Symmetric | **Forbidden by VER-06**: the seed key is per-RUN not per-OS, so a Windows seed makes the Windows verify restore its own entry and pass even if cross-OS restore is completely broken | |

**Choice:** matrix the verify, seed stays single-leg (D-20). Vacuity condition written
into the job comment (D-21).

---

## PARITY-08 input registration and comment lock

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Add `ci.yml` to `test.inputs`; lock the rationale in `nx-target-inputs.spec.ts`; read the MERGED config | Follows Phase 8 D-13's displacement pattern and closes Phase 8's NF-02 blind spot in the same stroke | Slightly more than a one-line change | YES |
| Add the input only | One line | The `{ env: 'CI' }` finding stays unrecorded, which is the thing PARITY-08 says nothing currently records | |
| Guard by reading `nx.json` directly | Simpler | `packages/github-cache/project.json` EXISTS and could replace `targetDefaults.test.inputs` wholesale while the guard stayed GREEN | |

**Choice:** option 1 (D-22, D-23, D-24), sequenced FIRST in the phase.
**Notes:** The `{ env: 'CI' }` claim was VERIFIED at
`node_modules/@nx/vitest/dist/src/plugins/plugin.js:246` rather than taken from the
requirement text. Also recorded: Phase 8's D-12 and Phase 7's D-02 both assert this
workspace has no `project.json` -- that premise is false and must not be repeated.

---

## OBS-04 tripwire mechanism

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Documented reading instruction in the warning message + the expected signal recorded in advance | Satisfies every OBS-04 clause literally, adds no state, cannot fire on the three legitimate rotation windows | An auditor could read "the tripwire is gated on X" as demanding mechanism | YES |
| Persist a marker (Release asset / repo variable / cache entry) and compare pushes | Automated | Adds mutable observability state, which this project's Key Decisions reject on principle for the LRU-manifest case; and a tripwire that fires on correct work gets disabled | |
| Scheduled job diffing the last two publish runs via the API | No stored state | A whole new job for a signal OBS-04 says stays a warning | |

**Choice:** option 1 (D-28b), with the message reworded per D-27 and the expected
first-push signal recorded per D-29.
**Notes:** Impact was re-priced DOWN before auto-locking: adding mechanism later is
additive, touches one warning message, freezes no contract, and no downstream phase
inherits the choice -- so it is not in the trap quadrant. Recorded so a later
maintainer can add mechanism without re-deriving the reasoning.

---

## DOCS-08 site list

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Re-derive every site by CONTENT, touch all four named sites, but give `docs/advanced.md:45` the ADDITIVE treatment, and comment-lock the reclassification | Honours DOCS-08's count of four sites-in-scope while not "correcting" a statement that is true; follows Phase 7's `CORR_05_SITES` precedent for a requirement miscount | Reduces the CORRECTION count from four to three, which a verifier reading the requirement literally may query | YES |
| Follow the cited line numbers literally | Matches the requirement text exactly | Edits the WRONG text: Phase 8 inserted ~220 lines into `ci.yml`, so `:577-583` now lands inside the hash-parity job | |
| Correct `advanced.md:45` anyway | Preserves the count of four corrections | Contradicts DOCS-08's own instruction not to correct fault-degradation framing, which `README.md:125` states identically | |

**Choice:** option 1 (D-31, D-32, D-33).
**Notes:** The reclassification is grounded, not a bare default -- `advanced.md:45`
reads "Every read fault degrades to a MISS (a rebuild), never a wrong result", which
does not assert same-OS restore at all and so fails DOCS-08's own membership
criterion; it is textually the same claim as the two sites DOCS-08 explicitly puts in
the additive bucket. Phase 7 handled the identical class (ROADMAP SC3's "three CORR-05
violations" versus REQUIREMENTS' four) by comment-locking the correction on the
site-list constant, which is what makes this evidence-backed rather than a preference.
Net: six sites touched, three corrected, three additive.

---

## ROBUST-04 bundle sequencing

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| `build:action` + stage the bundle in the SAME commit as every `serve()`-reachable edit; `check:action` in each plan's acceptance | The only shape that keeps every intermediate commit self-consistent | A bundle diff in several commits | YES |
| One rebuild at the end of the phase | Fewer bundle diffs | FIVE `ci.yml` jobs run the committed bundle from the git ref, so an intermediate push has the sidecar writing at one cache version while publish restores at another -- the mirror silently stops receiving | |
| Rely on the `action-bundle-drift` job | Zero effort | Catches it only on push, after the misleading all-MISS signal has been rationalised as OBS-04's expected one-time event | |

**Choice:** option 1 (D-25, D-26).
**Notes:** Also recorded which files are and are not in the bundle graph:
`cache-archive-path.ts` and `actions-cache-backend.ts` ARE `serve()`-reachable;
`compression-method.ts` deliberately is NOT (D-17), so it carries no rebuild
obligation.

---

## Attribution evidence that expires when this phase lands

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Capture a shard snapshot (asset names + `created_at`) plus the Actions-cache entry list before the first version-rotating push | One command, one committed file; the only moment it can be taken | Serves a Phase 11 requirement from a Phase 9 plan | YES |
| Record a hand-off note only | Zero work | TEST-08 says the window CLOSES at Phase 9; a note does not preserve data | |
| Leave it to Phase 11 | Cleanest scope line | Phase 11 runs after the ubuntu leg has started mirroring Windows entries, and `CACHE_MIRROR_MAX_AGE_DAYS` is 30, so the record is gone twice over | |

**Choice:** capture the snapshot (D-34).
**Notes:** Scope-checked, not assumed: TEST-08's own text places the capture at Phase
9, so this is evidence PRESERVATION rather than a new capability. The plan must not let
it grow into the O1 proof itself.

---

## Claude's Discretion

- Where the D-04 source scan lives, and the technique for spelling the forbidden
  needles without tripping the absence claim.
- Exact wording of the reworded OBS-04 warning and of the additive DOCS-08 precondition.
- Name and shape of the `DOCS_08_SITES` constant.
- Filename and format of D-34's snapshot artifact.
- Whether VER-03's source-level count sits in `actions-cache-backend.spec.ts` or in a
  cross-cutting drift guard.
- Plan count and wave grouping, subject to D-35's ordering.

## Withheld from auto-lock

- **U-01: whether `.nx/cache` tolerates a foreign transient `.tar`.** HIGH impact (the
  path literal IS the cache version, so a late discovery means a FOURTH rotation window
  in a milestone whose tripwire is calibrated to three) and NOT-HIGH confidence (D2-04
  and VER-07 argue only from gitignore and file-map grounds; nobody measured Nx's
  behaviour toward a stray file in that directory). Cheap to check before committing to
  D-01; re-open with the maintainer if the check fails rather than auto-selecting a
  fallback directory.

## Deferred Ideas

Recorded in CONTEXT.md `<deferred>`. Nothing new surfaced during this pass that was not
already owned by Phase 10, 11 or 12 -- the phase boundary held, which is expected for a
phase whose requirements are this prescriptive.
