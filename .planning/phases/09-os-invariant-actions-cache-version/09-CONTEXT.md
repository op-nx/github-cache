# Phase 9: OS-Invariant Actions-Cache Version - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning
**Mode:** `--analyze --auto --chain` (trade-off tables recorded in
`09-DISCUSSION-LOG.md`, recommended option auto-selected; one HIGH-impact /
NOT-HIGH-confidence item withheld from auto-lock and recorded as UNRESOLVED)

<domain>
## Phase Boundary

The `@actions/cache` version stops depending on which OS computed it, and a Windows
runner proves it by reading back an entry a Linux runner wrote.

Four things:

1. **The path.** `cacheArchivePath` becomes a hardcoded, workspace-relative,
   forward-slash literal under `.nx/cache/` -- byte-identical on `win32` and `linux`,
   built with no `node:path` and no `node:os` -- and the directory it names is created
   before the first write.
2. **The flag.** `enableCrossOsArchive: true` is hardcoded at ALL THREE
   `@actions/cache` call sites, at the POSITIONAL index each function actually uses,
   with the argument list and the call count asserted so a fourth site fails.
3. **The guard.** `createActionsCacheBackend()` asserts ONCE, at construction, the
   CONJUNCTION that cwd is the Nx workspace root AND `GITHUB_WORKSPACE` agrees.
4. **The proof.** A `dogfood-verify` leg on `windows-11-arm` reads back the entry
   `dogfood-seed` wrote on `ubuntu-24.04-arm`, asserting PROVENANCE rather than
   presence, and a MISS fails the job.

Plus the three supporting obligations that ride with them: `ci.yml` registered as a
`test` input BEFORE any spec asserts on it (PARITY-08), the resolved compression
method surfaced in the publish summary (VER-05), the all-restore-MISS warning
reworded with its rotation window recorded in advance (OBS-04), the same-OS-restore
claims in the docs corrected (DOCS-08), and the committed action bundle rebuilt in
the same commit as every `serve()`-reachable edit (ROBUST-04).

**Not in this phase:** the Releases asset name (CORR-02, Phase 10), the
`mirrored-by` label (OBS-03, Phase 10), the remaining three CORR-05 violation sites
(Phase 10 -- only site 1, `cache-archive-path.spec.ts`, leaves here with VER-02),
`publish-mirror.ts:159`'s CORR-01 comment (TRUST-11, Phase 10), `publish-verify`'s
same-OS claim at `ci.yml:1053-1061` (Phase 10's OBS-05), any live O1-O4 proof
(Phase 11/12), and the DOCS-07 portability recipe (Phase 12).

</domain>

<decisions>
## Implementation Decisions

### BLOCKING PRE-FLIGHT: the requirement list is truncated by tooling

- **D-00:** `gsd-tools query init.plan-phase 9` returns
  `phase_req_ids = "PARITY-08, VER-01, VER-02, VER-03, VER-04, VER-05, VER-06,
  VER-07, ROBUST-04"` -- **NINE of ELEVEN. `OBS-04` and `DOCS-08` are SILENTLY
  DROPPED**, because ROADMAP.md's `**Requirements**:` line for Phase 9 wraps across
  `:256-257` and the query stops at the newline. MEASURED this session, and it is the
  same defect Phase 8 recorded (`08-LEARNINGS.md`, "`init.plan-phase` truncates
  `phase_req_ids` at a ROADMAP line wrap").

  **The authoritative list is ELEVEN: PARITY-08, VER-01, VER-02, VER-03, VER-04,
  VER-05, VER-06, VER-07, ROBUST-04, OBS-04, DOCS-08.** Pass it EXPLICITLY to the
  researcher, the planner, the plan-checker, the coverage gate, and the verifier --
  every one of them inherits the truncation otherwise.

  ROADMAP.md is additionally wrong in two more places for this phase and neither is
  to be trusted: `:575` says "Phase 9: 8", and the traceability rows at `:537-544`
  carry only eight, omitting `PARITY-08`, `VER-07` and `ROBUST-04`. REQUIREMENTS.md
  is self-consistent at eleven (`:628-638`, `:663-665`).

- **D-28:** Audit coverage against **REQUIREMENTS.md's own words, never ROADMAP.md's
  table or paraphrase.** Phase 8's coverage audit caught ROADMAP's stale PARITY
  numbering exactly this way, and this phase's ROADMAP rows are missing three
  requirements outright.

### The archive-path literal (VER-01, VER-02, VER-07)

- **D-01:** The literal is **`.nx/cache/nx-github-cache-<hash>.tar`** -- flat, no
  extra subdirectory. The existing basename stem is KEPT: `cache-archive-path.spec.ts`
  already pins `nx-github-cache-abc123.tar` as a hand-authored literal, so keeping the
  stem means only the directory assertion changes and the non-vacuity discipline that
  spec was written with survives intact. `.gitignore:41` covers `.nx/cache`
  specifically (NOT `.nx/` wholesale), so this exact directory is the one that is both
  gitignored and outside Nx's own file map.

- **D-02:** The **directory literal is `.nx/cache`** and it is created with ONE
  `mkdirSync(..., { recursive: true })` at construction. `mkdirSync`, not the async
  form: `selectBackend` is synchronous by structural contract (TRUST-05,
  `selectBackend.length === 0`, and `select-backend.ts:34-35` comment-locks that it
  "stays SYNCHRONOUS"), so `createActionsCacheBackend()` must not become async or the
  public-surface guard and `serve()`'s composition root both move.

- **D-03:** `cacheArchivePath` stays a **pure string function** taking only the hash
  (VER-04 says so explicitly). It gains no platform parameter: a parameter would
  invite an ambient read at the call site, which is the CORR-05 shape
  `releaseAssetName(hash, process.platform)` is being deleted for in Phase 10.

- **D-04:** `cache-archive-path.spec.ts` is **REPLACED, not relaxed**, and asserts
  exactly two things:
  1. the **FULL path literal**, hand-authored, not rebuilt from the implementation's
     template -- `expect(cacheArchivePath('abc123' as Hash)).toBe('.nx/cache/nx-github-cache-abc123.tar')`;
  2. a **source scan of the module** proving it imports neither `node:path` nor
     `node:os` and names none of the forbidden builders.

  Clause 2 is what makes clause 1 non-vacuous: `test` runs on ubuntu ONLY today
  (`ci.yml:337`; the Windows legs are XOS-04, Phase 12), and on ubuntu a
  reintroduced `join()` renders the SAME string, so a literal pin alone cannot catch
  it. VER-01 is written as a MUST-NOT list, so asserting the MUST-NOT directly is the
  faithful shape.

  The `isAbsolute` / `dirname` shape checks are dropped as redundant once the full
  literal is pinned -- and `isAbsolute` would be actively misleading, since
  `isAbsolute('C:/x')` is `false` under POSIX.

- **D-05:** Clause 2 hits Phase 8's recorded trap head-on: **a grep-verifiable
  ABSENCE claim must not spell the token it forbids, anywhere in the file** -- which
  bit Phase 8 twice in one plan, once inside the sentence claiming the token was
  absent. Build the needles so the file never contains them verbatim (split literals
  or char codes), and comment-lock WHY the spelling is contorted so a later tidy does
  not undo it.

- **D-06 (CORR-05 site 1 leaves here):** `cache-archive-path.spec.ts`'s
  `import { tmpdir } from 'node:os'` AND its `eslint-disable-next-line
  no-restricted-imports` directive at `:6` are removed in the **SAME COMMIT**.
  `reportUnusedDisableDirectives: 'error'` (LINT-06) fails the build on a directive
  left behind, so they are one edit, not two. Phase 7 recorded that `:26` is a SITE
  but NOT an error position -- the import is the chokepoint -- so there is exactly ONE
  directive to remove, not two.

### The construction-time conjunction guard (VER-04)

- **D-07:** The guard runs **at `createActionsCacheBackend()` construction, in this
  order: assert, THEN `mkdirSync`.** Asserting first means a wrong cwd fails loud
  before the mkdir creates a `.nx/cache` in the wrong tree.

  Both conjuncts:
  - **cwd is the Nx workspace root** -- probed as `existsSync(join(cwd, 'nx.json'))`.
    This must be dependency-free: the module is inlined into the committed
    `start-cache-server/index.js`, which external repos resolve via `uses:` with no
    `npm ci`, and `nx` is a devDependency. An upward walk for `nx.json` was considered
    and rejected: it cannot reach a verdict the cwd probe does not already reach
    (a subdirectory cwd fails both), and buys only a better message for a loop.
  - **`GITHUB_WORKSPACE` is unset OR `resolve(GITHUB_WORKSPACE) === resolve(cwd)`,
    compared case-normalised.** This is the conjunct that actually matters:
    `@actions/cache` reads `GITHUB_WORKSPACE` for the tar manifest and `tar -C`, while
    glob expansion and our own `readFile`/`writeFile` use `process.cwd()`. When they
    diverge the restore reports a HIT, extraction lands under `$GITHUB_WORKSPACE`, our
    `readFile` throws ENOENT under `$CWD`, and `server.ts` `handleGet` converts it to
    a 404 -- a permanent silent all-MISS while `@actions/cache` logs `Cache hit for:`.

  Note `resolve` here is a legitimate `node:path` use in the GUARD (it compares two
  anchors); VER-01's ban is on BUILDING the archive path, which D-03 keeps separate.

- **D-08:** Record the **asymmetry**: the same fault is LOUD in `publishMirror`
  (which propagates) and SILENT in `serve()` (swallowed by `handleGet` into a 404), so
  a green publish job is not evidence the serve path is healthy. This is exactly why
  the check is at construction and not per request -- a per-request check fires inside
  `get()` and is eaten by the same catch.

### The three call sites and the positional flag (VER-03)

- **D-09:** VERIFIED this session against the installed `@actions/cache@6.2.0`
  `lib/cache.d.ts`, and the requirement's warning is CORRECT -- **`saveCache`'s JSDoc
  documents `enableCrossOsArchive` BEFORE `options`, while the real signature is the
  reverse.** The indices to hardcode:

  | Call site | Real signature | Flag index |
  |---|---|---|
  | `restoreCache` (read, `actions-cache-backend.ts:46`) | `(paths, primaryKey, restoreKeys?, options?, enableCrossOsArchive?)` | **5th** |
  | `saveCache` (write, `:101`) | `(paths, key, options?, enableCrossOsArchive?)` | **4th** |
  | `restoreCache` `lookupOnly` probe (`:107`) | same as `restoreCache` | **5th** |

  Comment-lock both the indices and the JSDoc-is-wrong finding at the call sites.

- **D-10:** The `lookupOnly` probe MUST carry the flag too. It exists to
  disambiguate `saveCache`'s ambiguous `-1`; probing at a DIFFERENT cache version from
  the save would report "absent" for a present entry and turn every Windows write into
  a spurious 409.

- **D-11:** The VER-03 spec asserts **both** shapes, because neither alone is
  sufficient:
  1. **per-call exact argument arrays** (deep equality over `.mock.calls`, so the
     positional index is pinned rather than assumed) plus each function's call count,
     in `actions-cache-backend.spec.ts`, which already mocks `@actions/cache`;
  2. a **source-level count** that the module reaches `@actions/cache` at exactly
     THREE places. Clause 1 only sees sites the specs execute; clause 2 is what makes
     "a fourth site added later fails" true for a site on an unexercised path.

  Assert on CONTENT, never on an exit code or a bare count that a deletion satisfies
  (Phase 8 D-23).

### The compression-method probe (VER-05)

- **D-12:** It is an **independent re-implementation in a new leaf**,
  `packages/github-cache/src/lib/compression-method.ts`, with a co-located spec.
  `getCompressionMethod` is unreachable through `@actions/cache`'s exports map (the
  same `ERR_PACKAGE_PATH_NOT_EXPORTED` wall VER-02 documents), and the logic is a
  branch plus a swallow, which the repo's convention puts in a comment-locked
  single-source leaf rather than inline.

- **D-13:** It **mirrors upstream exactly**, verified this session against
  `node_modules/@actions/cache/lib/internal/cacheUtils.js:100-136`:
  - argv `zstd` `['--quiet', '--version']` (upstream pushes `--version` onto the
    passed args, so the real invocation is `zstd --quiet --version`);
  - stdout AND stderr accumulated into ONE string;
  - **the exit code is NEVER inspected** (upstream passes `ignoreReturnCode: true`);
  - a spawn fault (ENOENT) swallowed to `''`;
  - `.trim()`;
  - branch on **`versionOutput === '' ? 'gzip' : 'zstd-without-long'`** -- the parsed
    semver is computed and then unused upstream, so a broken-but-present zstd still
    selects zstd.

  Comment-lock it to the pinned `@actions/cache` version pointing at `cacheUtils.js`,
  and add "re-read `getCompressionMethod`; VER-05 duplicates it" to the
  `@actions/cache` bump checklist.

- **D-14:** **`local-context.ts`'s `runHelper` is NOT reused, and that is a
  deliberate rejection, not an oversight.** It is stdout-ONLY and resolves `undefined`
  on any non-zero exit -- the exact inverse of what VER-05 needs on both axes.
  Reusing it would report `gzip` for a broken-but-present zstd, i.e. it would be wrong
  in precisely the case VER-05 names. Use `spawn` directly with `shell: false` and
  `windowsHide: true`, borrowing only those two hardening options.

- **D-15:** **No timeout**, deliberately, even though `runHelper` has one. VER-05's
  value must equal what `@actions/cache` actually computed; a timeout would make it
  report `gzip` where the library reported `zstd`. The hang risk is not ours to add
  anyway -- `@actions/cache` calls `getCompressionMethod()` itself on every
  restore/save in the same job, so a hanging `zstd` has already wedged the publish
  before our probe runs. Record this as the one place we chose NOT to harden.

- **D-16:** It is surfaced as a **separate `core.summary` line after the count
  table**, plus a `core.info` so it also lands in the log. `writeCountSummary` takes
  `[string, number]` pairs and renders a column headed `count`; putting
  `zstd-without-long` under a `count` header is wrong, and `summary.ts`'s own comment
  says the shared renderer is not widened for one caller. `core.summary.write()`
  appends by default, so a second `write()` after `writeCountSummary` is all it takes.
  **Surfaced, never gated** -- no branch anywhere reads this value.

- **D-17:** `compression-method.ts` is **NOT `serve()`-reachable** and must stay that
  way: import it only from `runPublish` in `action/index.ts`. That keeps it out of
  `start-cache-server/index.js` and out of ROBUST-04's rebuild obligation.

### The cross-OS behavioural close (VER-06)

- **D-18:** `dogfoodBody` gains a **required explicit second parameter**:
  `dogfoodBody(hash: string, producerOs: CacheOs): Buffer`. Required, with NO default
  -- a default is what makes the vacuity trap reachable, because the verify leg could
  silently compare against its own OS. `CacheOs` is imported **type-only** from
  `release-asset-name.ts` so `dogfood-body.ts` stays a runtime leaf (the type erases
  at compile time), and there is one OS vocabulary rather than two.

- **D-19:** The **seed leg passes `cachePlatform()`** (an ambient read, in the
  action, where LINT-02 permits it) and the **verify leg asserts against the LITERAL
  `'linux'`**, comment-locked with the vacuity condition and with a note that this
  literal is what must change if a Windows seed leg is ever added. No new action input
  for it: the seed leg is ubuntu-only BY DESIGN, and an input would be a second place
  for the two legs to disagree.

- **D-20:** **`dogfood-verify` becomes a two-leg matrix** over
  `[ubuntu-24.04-arm, windows-11-arm]` with `fail-fast: false`, mirroring the
  `integration` job's shape (`ci.yml:409`). **`dogfood-seed` stays ubuntu-ONLY.** The
  seed key is `nx-cache-<GITHUB_RUN_ID>` -- one key per RUN, not per OS -- so the
  moment a Windows seed leg exists the Windows verify restores the Windows-written
  entry and passes even if cross-OS restore is completely broken. Keeping the ubuntu
  verify leg preserves the v0.0.1 same-OS round-trip close instead of trading one
  proof for another; both legs assert a LINUX-produced body, which is trivially true
  for the ubuntu leg and the whole point for the Windows one.

- **D-21:** The **vacuity condition is written into the job comment**, per VER-06,
  not only into the spec or this file.

### PARITY-08 (`ci.yml` as a `test` input) -- lands FIRST

- **D-22:** Add `{workspaceRoot}/.github/workflows/ci.yml` to
  `nx.json` `targetDefaults.test.inputs`. `nx.json` currently lists `cleanup.yml` and
  NOT `ci.yml`, so **any spec asserting on `ci.yml` content serves a stale cached PASS
  until this lands** -- the same false-pass class that already shipped once on
  `typecheck`. This phase's DOCS-08 and VER-06 guards both assert on `ci.yml`, so
  PARITY-08 is the FIRST thing in the phase, not a tidy-up at the end.

- **D-23:** The **comment lock is displaced into `nx-target-inputs.spec.ts`** (Phase
  8 D-13: `nx.json` is strict JSON and carries no comments, so the rationale lives in
  the guard spec that pins the fact). It records:
  - `targetDefaults` inputs **REPLACE** rather than merge; and
  - **VERIFIED this session** at `node_modules/@nx/vitest/dist/src/plugins/plugin.js:246`:
    `@nx/vitest`'s inferred `test` target carries `{ env: 'CI' }`. `CI` is set on every
    runner and unset on a workstation, so an inferred-input `test` target would make
    **O1 structurally impossible for `test`**. The explicit list is what saves it, and
    nothing currently records that.

- **D-24:** The guard reads the **MERGED configuration**, not `nx.json`. Phase 8's
  NF-02 finding applies directly: `packages/github-cache/project.json` **EXISTS**
  (tracked since `7413363`, declaring `integration`), and a `project.json` `inputs`
  list would replace `targetDefaults.test.inputs` wholesale while a guard reading
  `nx.json` stayed GREEN. Delegate the merge to Nx's own functions and pair it with a
  vacuity control that reddens if the merge never consulted the overriding file.

  Corollary for the planner: Phase 8's D-12 and Phase 7's D-02 both assert this
  workspace is free of `project.json`. **That premise is false.** Do not repeat it.

### ROBUST-04 (the committed bundle)

- **D-25:** `npm run build:action` runs and `start-cache-server/index.js` is staged
  in the **SAME COMMIT as every `serve()`-reachable edit** -- which in this phase means
  every commit touching `cache-archive-path.ts` or `actions-cache-backend.ts`. Not one
  rebuild at the end of the phase: FIVE `ci.yml` jobs run the committed bundle from the
  git ref (`build:236`, `typecheck:310`, `test:357`, `integration:432`,
  `consumer-smoke:895`), so an intermediate push leaves the sidecar writing at one
  cache version while the publish action restores at another -- and **the mirror
  silently stops receiving**, surfacing only as the all-restore-MISS warning OBS-04 has
  just told everyone to expect exactly once. `action-bundle-drift` catches it, but only
  after that misleading signal has been rationalised.

- **D-26:** `npm run check:action` (`build:action` + `git diff --exit-code`) goes in
  the acceptance check of every plan that touches a `serve()`-reachable file. Note
  Phase 7's Q10 precedent: a lockfile re-resolution drifted the bundle by 88 lines
  independently of any source edit, so the diff is checked, never assumed empty.

### OBS-04 (the all-restore-MISS warning)

- **D-27:** The reworded message (currently `publish-mirror.ts:300-307`) **drops
  "Expected when publishing from a different OS than the entries were saved on"** and
  names two candidate causes instead: (1) a cache-version rotation in this commit
  range (the archive path or the cross-OS flag changed), and (2) the runtime token's
  Actions-cache read scope. It **stays a `core.warning`**, never a failure.

- **D-28b:** The **tripwire is a documented reading instruction, not persisted
  cross-push state.** The gate -- "two consecutive all-miss pushes with NO
  version-affecting change in between" -- is carried in the warning message and in the
  recorded-in-advance note, so a human reading the second occurrence knows to act.
  Rejected: a persisted marker (a Release asset, a repo variable, a cache entry) or a
  scheduled job diffing the last two runs. Both add mutable observability state, which
  this project's Key Decisions already reject on principle for the LRU-manifest case
  ("a manifest adds mutable retention state (security-negative)"), and OBS-04 itself
  says it stays a warning. Mechanism is strictly additive later if the maintainer wants
  it -- one warning message, no contract frozen.

- **D-29:** The **expected signal of the first post-change push is recorded IN
  ADVANCE**, in the phase artifacts and not reconstructed afterwards: all-miss on BOTH
  publish legs, `mirrored == 0`. Note `enableCrossOsArchive` alone rotates only
  WINDOWS entries (on Linux the flag is a no-op on the version -- confirmed at
  `cacheUtils.js:166`, the `windows-only` component is pushed only when
  `process.platform === 'win32' && !enableCrossOsArchive`), so the all-MISS on BOTH
  legs is caused by the PATH change, not the flag.

- **D-30:** This is **rotation window 2 of 3** in this milestone (Phase 7's inferred
  `lint` target was 1; Phase 10's CORR-02 asset rename is 3). Do not author a tripwire
  here that would fire on windows 1 or 3.

### DOCS-08 (the same-OS-restore corrections)

- **D-31:** **Locate every site by CONTENT, never by the line numbers in
  REQUIREMENTS.md or ROADMAP.md -- they are STALE.** Measured this session: Phase 8
  inserted `hash-parity` and `hash-parity-compare` at `ci.yml:573-793`, so the cited
  `ci.yml:577-583` now lands inside the hash-parity job. Current locations:

  | Cited | Actually at | Bucket |
  |---|---|---|
  | `docs/advanced.md:54-57` | `docs/advanced.md:54-57` (still accurate) | CORRECT |
  | `ci.yml:577-583` | `ci.yml:943-950` (the publish matrix comment) | CORRECT |
  | `ci.yml:356-360` | `ci.yml:384-406` (the `integration` job comment) | CORRECT |
  | `docs/advanced.md:45` | `docs/advanced.md:45` | see D-32 |
  | `README.md:125` | `README.md:125` (still accurate) | ADDITIVE |
  | `docs/trust-and-security.md:155` | `docs/trust-and-security.md:184-185` | ADDITIVE |

  Record the drift so the verifier does not read a content-located edit as drift.

- **D-32:** **All FOUR named sites are TOUCHED, but `docs/advanced.md:45` gets the
  ADDITIVE treatment, not a correction** -- and the reclassification is comment-locked
  as a correction to DOCS-08 rather than done silently. `advanced.md:45` reads "Every
  read fault degrades to a MISS (a rebuild), never a wrong result", which is
  textually the SAME fault-degradation claim as `README.md:125` and
  `trust-and-security.md:184-185` -- both of which DOCS-08 explicitly says must NOT be
  "corrected as though they were wrong". It does not assert same-OS restore at all, so
  it fails DOCS-08's own membership criterion. So: three corrections, three additive
  preconditions, six sites touched, and DOCS-08's count of four sites-in-scope is
  honoured.

  This follows the house pattern for a requirement miscount: Phase 7 hit the same
  class (ROADMAP SC3's "three CORR-05 violations" against REQUIREMENTS' four) and
  comment-locked the correction on the site-list constant. Do that here -- a
  `DOCS_08_SITES` constant carrying both the site list and the miscount note, keyed on
  FILE plus QUOTED PHRASE rather than on line number, because these edits shift each
  other's lines within one commit.

- **D-33:** The **additive** edit is a precondition about target platform-agnosticism,
  never a contradiction: fault degradation stays true. And OBS-03's retraction binds
  here -- **do NOT write any claim that the mirror answers "whose bytes did the
  developer get".** The `mirrored-by` label (Phase 10) is the PUBLISHING leg's OS, and
  from this phase forward the ubuntu leg can mirror a Windows-produced entry and would
  label it `linux`.

### Evidence that expires when this phase lands

- **D-34:** **Capture the producer-attribution snapshot BEFORE the first
  version-rotating default-branch push.** TEST-08 (Phase 11) states that the
  attribution window "closes at Phase 9, not Phase 12" -- once the version is
  OS-invariant the ubuntu publish leg starts mirroring the Windows `integration` entry
  too, so the shard stops being "everything here is ubuntu's" before Phase 11 runs.
  One `gh api` pass over the current month shard (asset names + `created_at`) plus the
  Actions-cache entry list, written to a dated file in the phase directory and
  committed. It is one command and one file, and it is the only moment it can be
  taken; `CACHE_MIRROR_MAX_AGE_DAYS` is 30, so waiting also ages the record out.

  Scope note for the planner: TEST-08 is a Phase 11 requirement and is NOT in this
  phase's list. This is evidence PRESERVATION for it, not the proof itself -- do not
  let it grow into the O1 proof.

### Sequencing (load-bearing)

- **D-35:** Order:
  1. **PARITY-08** (`ci.yml` as a `test` input + the merged-config guard + the comment
     lock) -- before ANY spec asserts on `ci.yml`.
  2. **D-34's snapshot** -- before any commit that rotates the cache version.
  3. **VER-07's `mkdir`** -- before VER-01's first write at the new path
     (REQUIREMENTS' own `Before/After` table says so).
  4. **VER-01 / VER-02 / VER-03 / VER-04** with the bundle rebuilt in each commit.
  5. **VER-05** (independent of the above; touches only the publish path).
  6. **VER-06** (the cross-OS dogfood pair) -- after VER-01/VER-03 land, or the
     Windows leg proves nothing.
  7. **OBS-04 / DOCS-08** -- the docs and the warning follow the behaviour they
     describe.

  Encode this as `depends_on` in the plan frontmatter, not as prose. Phase 8's
  learning: "a comment asking an executor to preserve ordering is not a control; a
  `depends_on` graph is."

- **D-36:** `nx reset` deletes `.nx/cache`, which is where the archive now lives, so
  the local proof order is **reset FIRST, then start the sidecar** (VER-07 / TEST-10).
  Resetting under a running sidecar makes the next PUT a 500.

### Claude's Discretion

- Whether the source scan in D-04 lives in `cache-archive-path.spec.ts` or in a
  sibling drift guard, and the exact technique for spelling the forbidden needles.
- The exact wording of the reworded OBS-04 warning and of the additive DOCS-08
  precondition.
- The name and exact shape of the `DOCS_08_SITES` constant and where it sits.
- The filename and format of D-34's snapshot artifact.
- Whether the VER-03 source-level count lives in `actions-cache-backend.spec.ts` or in
  a cross-cutting drift guard at `packages/github-cache/src/*.spec.ts`.
- Plan count and wave grouping, subject to D-35's ordering.

### UNRESOLVED -- withheld from auto-lock (HIGH impact, NOT-HIGH confidence)

- **U-01: Whether `.nx/cache` is a safe home for a transient multi-megabyte archive
  while Nx itself owns that directory.** VER-07 and D2-04 both name `.nx/cache/`
  because it is gitignored and outside Nx's file map, and that reasoning is sound for
  the GIT and HASH axes. But the archive now lands INSIDE Nx's own cache directory
  rather than in the OS temp dir, and nothing in the requirements or the research
  establishes that Nx tolerates a foreign `.tar` file there -- Nx 23.1 writes
  `run.json`, `terminalOutputs/`, `d/` and per-hash directories under `.nx/cache`, and
  its own pruning behaviour over unrecognised entries is not recorded anywhere in this
  project.

  IMPACT is HIGH: the path literal IS the cache version, so discovering a conflict
  after the first default-branch push means a SECOND rotation window and a second
  all-MISS push -- in a milestone whose OBS-04 tripwire is explicitly calibrated to
  three windows, not four. CONFIDENCE is NOT HIGH: the choice is inherited from D2-04
  and VER-07, and both argue only from gitignore and file-map grounds; neither
  measured Nx's behaviour toward a stray file in that directory.

  **Do not treat D-01 as settled until this is checked, and `gsd-phase-researcher`
  OWNS the check** -- it is an empirical question with a pre-stated falsifiable
  condition, not a maintainer preference, so it belongs in RESEARCH.md and not in a
  checkpoint. The check: place a `.tar` under `.nx/cache`, run `nx run-many -t build`
  twice, and confirm the file survives, the task hash does not move between runs, and
  no Nx warning appears. Record the Nx version with the result (Phase 8's PARITY-06
  discipline).

  **If it survives, D-01 stands and U-01 closes in RESEARCH.md.** If it does NOT
  survive, the options open up to a subdirectory (`.nx/cache/github-cache/`, still
  gitignored, still `nx reset`-cleared) or another gitignored workspace-relative
  directory -- and THAT is a re-pricing of a locked decision (D2-04), so stop and
  re-open it with the maintainer rather than auto-selecting a fallback.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Required reading, in this order

- `.planning/REQUIREMENTS.md` -- **FIRST, and it is the authoritative requirement
  text.** Lines 258-340 (VER-01..07 and ROBUST-04), 248-256 (PARITY-08), 549-560
  (OBS-04), 461-469 (DOCS-08), 568-591 (the `Before/After` sequencing table), 473-491
  (TEST-08's attribution-window clause), 88-118 (CORR-05's site table and its
  sequencing consequence), 55-65 (D2-01..D2-06). Per D-00 and D-28, coverage is
  audited against THIS file, never against ROADMAP.md's table.
- `.planning/ROADMAP.md` -- the Phase 9 section (`:245-324`): goal, SC1/1b/1c/1d,
  SC2-SC5, and the Live-CI close note. Its `:537-544` traceability rows and `:575`
  count are KNOWN WRONG for this phase (D-00) -- read the section, not the table.
- `.planning/research/v0.0.2/PROBE-RESULTS.md` -- Q2 establishes that the
  cwd / `GITHUB_WORKSPACE` identity HOLDS on both runners today (so VER-04 is a drift
  guard, not a live fix); the zstd v1.5.7 / GNU tar 1.35 measurement and the
  `C:\tools\zstd` provenance correction back VER-05.
- `.planning/research/v0.0.2/SUMMARY.md` -- the "two barriers are being removed and
  the third was never a barrier" section.

### Prior-phase decisions this phase inherits

- `.planning/phases/08-nx-task-hash-parity/08-CONTEXT.md` -- D-13 (rationale locks
  displace into the guard spec, because `nx.json` is strict JSON), D-14
  (`integration`'s discriminator stays byte-identical), D-15 (order encoded as
  dependencies), D-22 (prove a guard can fail before trusting it), D-23 (assert on
  content, never on exit code).
- `.planning/phases/08-nx-task-hash-parity/08-LEARNINGS.md` -- "Assert against the
  MERGED configuration when a lower-precedence file can silently replace it",
  "A grep-verifiable ABSENCE claim must not spell the token it forbids -- anywhere",
  "`init.plan-phase` truncates `phase_req_ids` at a ROADMAP line wrap",
  "`packages/github-cache/project.json` exists, falsifying a premise two locked
  decisions assert", "Three guards for one invariant, and all three had the same blind
  spot", "Pre-register the falsifiable condition, including its non-triggers".
- `.planning/phases/08-nx-task-hash-parity/08-SECURITY.md` -- NF-02 (the merged-config
  guard and its vacuity control).
- `.planning/phases/07-lint-toolchain-and-the-ambient-platform-read-ban/07-CONTEXT.md`
  -- D-36 (three legitimate all-MISS rotation windows), D-08 (no root `src/` or `lib/`
  during v0.0.2), and the `CORR_05_SITES` comment-lock pattern for a requirement
  miscount.
- `.planning/phases/08-nx-task-hash-parity/deferred-items.md` -- the one
  unattributed `test` failure at `69bd1b7`; capture output BEFORE re-running.

### Project-level locks

- `.planning/PROJECT.md` -- `## Key Decisions`, specifically the two v0.0.2 rows on
  the OS-invariant store and the archive-path constant, and `## Constraints`
  ("`cacheArchivePath()` must stay the single source of truth and must not change
  without re-verifying an end-to-end restore").
- `.planning/THREAT-MODEL.md` -- the C1-C18 CREEP control ledger; C1/C2/C16 are
  verified-not-assumed by TRUST-10 in Phase 10, but this phase must not weaken them.

### Files this phase edits or asserts on

- `packages/github-cache/src/lib/cache-archive-path.ts` -- the literal, its comment
  lock, and the cross-process ceiling note that survives the change.
- `packages/github-cache/src/lib/cache-archive-path.spec.ts` -- REPLACED (VER-02),
  and CORR-05 site 1 plus its `eslint-disable-next-line` leave with it.
- `packages/github-cache/src/backend/actions-cache-backend.ts` -- the three call
  sites (`:46`, `:101`, `:107`), the construction-time guard, the `mkdirSync`.
- `packages/github-cache/src/backend/actions-cache-backend.spec.ts` -- already mocks
  `@actions/cache`; VER-03's argument-list and call-count assertions go here.
- `packages/github-cache/src/lib/dogfood-body.ts` + `.spec.ts` -- the explicit
  `producerOs` parameter.
- `packages/github-cache/src/lib/compression-method.ts` (NEW) + spec -- VER-05.
- `packages/github-cache/src/action/index.ts` -- `runPublish`'s summary line (`:154-168`)
  and `run()`'s seed/verify `dogfoodBody` calls (`:224`, `:276`).
- `packages/github-cache/src/publish/publish-mirror.ts` `:292-307` -- the OBS-04
  warning.
- `packages/github-cache/src/nx-target-inputs.spec.ts` -- PARITY-08's assertion,
  merged-config read, and comment lock.
- `nx.json` `targetDefaults.test.inputs` -- add `{workspaceRoot}/.github/workflows/ci.yml`.
- `.github/workflows/ci.yml` -- `dogfood-seed`/`dogfood-verify` (`:794-836`), the
  `integration` job comment (`:384-406`), the `publish` matrix comment (`:943-950`).
- `docs/advanced.md` (`:45`, `:54-57`), `README.md` (`:125`),
  `docs/trust-and-security.md` (`:184-185`).
- `start-cache-server/index.js` -- the committed bundle, rebuilt per D-25.

### In-repo precedent

- `packages/github-cache/src/lib/local-context.ts` `:20-118` -- the hardened spawn
  wrapper. Read it to understand WHY it is NOT reused for VER-05 (D-14).
- `packages/github-cache/src/lib/release-asset-name.ts` -- `cachePlatform` and
  `CacheOs`; the comment-locked single-source pattern the archive path mirrors.
- `packages/github-cache/src/lib/summary.ts` -- `writeCountSummary` and its explicit
  refusal to be widened for one caller.
- `packages/github-cache/src/lib/cache-key.ts` -- `CACHE_KEY_PREFIX`, `HASH_PATTERN`,
  `isServerProducedKey`; already quadruply load-bearing, do not touch it here.
- `eslint.config.mjs` -- the LINT-02 ban rules and the `files`/`ignores` scoping that
  decides where an ambient platform read is legal.
- `esbuild.action.mjs` -- what `npm run build:action` does and why the bundle inlines
  the serve graph.
- `.planning/codebase/TESTING.md` -- spec placement (cross-cutting drift guards at
  `src/*.spec.ts`, cohesive modules in a subdirectory) and the Live-CI first-push close
  pattern.
- `.planning/codebase/CONVENTIONS.md` -- the single-source-of-truth plus drift-guard
  pattern and the comment-density rule.

### External, verified this session

- `node_modules/@actions/cache/lib/cache.d.ts` `:48-68` -- the real `restoreCache`
  and `saveCache` signatures, and the JSDoc order error on `saveCache` (D-09).
- `node_modules/@actions/cache/lib/internal/cacheUtils.js` `:100-172` --
  `getVersion`, `getCompressionMethod`, and `getCacheVersion` (including the
  `windows-only` component's `!enableCrossOsArchive` gate) (D-13, D-29).
- `node_modules/@actions/cache/lib/internal/constants.js` `:6-13` -- the
  `CompressionMethod` string values `gzip` / `zstd-without-long` / `zstd` (D-13).
- `node_modules/@nx/vitest/dist/src/plugins/plugin.js` `:246` -- the inferred `test`
  target's `{ env: 'CI' }` input (D-23).

### Unpackaged findings

`.planning/spikes/MANIFEST.md` exists with no corresponding
`./.claude/skills/spike-findings-*/SKILL.md`. Run `/gsd:spike --wrap-up` if those
spike findings are needed; otherwise the v0.0.2 research directory is the current
source.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `packages/github-cache/src/backend/actions-cache-backend.spec.ts` already mocks
  `@actions/cache`, so VER-03's argument-list and call-count assertions extend an
  existing harness rather than build one.
- `ci.yml`'s `integration` job (`:409-455`) is a working two-leg
  `[ubuntu-24.04-arm, windows-11-arm]` matrix with `fail-fast: false` and
  `timeout-minutes` -- the shape `dogfood-verify` adopts.
- `packages/github-cache/src/lib/release-asset-name.ts` supplies `cachePlatform()`
  and `CacheOs`, so VER-06 needs no new OS vocabulary.
- `local-context.ts`'s spawn hardening (`shell: false`, `windowsHide: true`) transfers
  to VER-05 even though its exit-code and stdout-only semantics do NOT.
- `nx-target-inputs.spec.ts` already reaches into `nx/src/hasher/*` and resolves
  inputs through Nx's own `splitInputsIntoSelfAndDependencies` ->
  `extractPatternsFromFileSets` -> `filterUsingGlobPatterns` trio -- PARITY-08's
  assertion extends it. Note its own caveat: reading `nx.json` from a spec is safe
  only because `{workspaceRoot}/nx.json` is a `test` input, and only `test` declares
  it.
- `npm run check:action` already exists as `build:action && git diff --exit-code`, so
  D-26 wires an existing script into acceptance rather than inventing a check.

### Established Patterns

- **Single source + comment lock + drift guard.** Author the fact once, lock the
  rationale in a comment, then add a spec that fails the moment a second copy drifts.
  `cacheArchivePath` and `releaseAssetName` are the two canonical instances.
- **Rationale locks displace into a file that can hold comments** when the fact lives
  in strict JSON (`nx.json` -> its guard spec; `eslint.config.mjs`'s D-08 header).
- **Explicit assertion lists, never snapshot matchers.** An intentional change must
  show up as a reviewable diff.
- **Prove a guard can fail before trusting it**, on a fixture AND on a real leg.
- **Strict ESM, `nodenext`** -- every relative import carries an explicit `.js`
  extension even from a `.ts` source; `import type` for type-only imports.
- **Live-CI first-push close.** Behaviours only a real runner can prove are named
  explicitly and closed by a job that fails loud, never by a passive log line.
- **Fail-closed writes, best-effort reads.** A read fault degrades to a MISS; a write
  fault must never look like a silent 200. VER-04's guard exists because
  `handleGet`'s catch would otherwise convert a real misconfiguration into a 404.

### Integration Points

- `createActionsCacheBackend()` -- gains the construction-time guard and the
  `mkdirSync`; must stay SYNCHRONOUS and parameterless (TRUST-05).
- `selectBackend` -- unchanged; it is the only caller and it stays synchronous.
- `serve()` graph -> `start-cache-server/index.js` -- the bundle boundary that makes
  ROBUST-04 bite.
- `runPublish` in `action/index.ts` -- where VER-05's value is surfaced and the only
  place `compression-method.ts` is imported.
- `nx.json` `targetDefaults.test.inputs` -- PARITY-08's one-line addition.
- `.github/workflows/ci.yml` `dogfood-verify` -- becomes a matrix; `dogfood-seed`
  stays single-leg.

</code_context>

<specifics>
## Specific Ideas

- Three separate documents disagree about how many requirements this phase has (11 in
  REQUIREMENTS.md, 9 from `init.plan-phase`, 8 in ROADMAP's table and count). Treat
  D-00 as a hard pre-flight step, not a footnote -- Phase 8 lost `CORR-03` and
  `CORR-04` to the identical defect and only caught it by orchestrator observation.
- Every line-number citation in this phase's requirements was authored at a commit
  before Phase 8 inserted ~220 lines into `ci.yml`. Locate by content. The drift is
  tabulated in D-31 so a verifier does not read a content-located edit as drift.
- The phase's success criteria are unusually explicit about what does NOT count:
  "the Nx workspace root" alone is the WRONG variable for VER-04; a presence-only
  check satisfies VER-06 vacuously; the parsed semver is computed and NOT used in
  VER-05; a textual assertion that a config contains a value does not satisfy a
  behavioural clause. Treat each as an anti-requirement.
- The first default-branch push after VER-01 lands is EXPECTED to be all-MISS on both
  publish legs with `mirrored == 0`. That is rotation window 2 of 3. It is not a
  defect and no tripwire authored here may fire on it.
- `enableCrossOsArchive` alone would rotate only WINDOWS entries. The both-legs
  all-MISS comes from the PATH change. Getting this backwards would misattribute the
  expected signal.

</specifics>

<deferred>
## Deferred Ideas

- **CORR-02** (the `nx-cache-<hash>` Releases asset name) and **RETAIN-04 / RETAIN-05**
  (the cleanup filter and the `CACHE_KEY_PREFIX` lock) -- Phase 10, same commit as each
  other.
- **OBS-03** (`mirrored-by` in Release asset metadata, plus the
  `uploadReleaseAsset` `label` seam) -- Phase 10. Until it lands there is a window
  where mirrored assets carry no attribution at all; D-34's snapshot is what covers it.
- **CORR-05 sites 2, 3 and 4** (`releases-backend.spec.ts:38`,
  `release-asset-name.spec.ts:39`, `release-asset-name.spec.ts:60`) -- Phase 10. Site 4
  is removed by NOTHING today and needs an explicit Phase 10 call.
- **TRUST-10 / TRUST-11 / TRUST-12 / TRUST-13** (the exposure delta and its
  independent classification) -- Phase 10. This phase CREATES the delta TRUST-12
  records, so Phase 10's auditor must be pointed at this phase's commits.
- **`publish-mirror.ts:159`'s "byte-identical under CORR-01" comment** and
  `ci.yml:1053-1061` / `read-back.ts`'s same-OS claims -- Phase 10 (TRUST-11 / OBS-05),
  explicitly NOT this phase's DOCS-08 work.
- **OBS-05** (leg-distinguishable publish seeds) -- Phase 10, and it must land BEFORE
  CORR-02 or `publish-verify` goes vacuous.
- **XOS-04 / XOS-05 / XOS-08** (Windows legs for `build`/`typecheck`/`test`, their
  `needs:` ordering, and the write decision) -- Phase 12, and gated on O1 being PROVEN
  first. Consequence for this phase: `test` still runs on ubuntu ONLY, which is why
  D-04's source scan carries the non-vacuity weight.
- **TEST-08 / TEST-09 / TEST-10 and the O1-O4 proofs** -- Phase 11 and 12. This phase
  produces a precondition and D-34's snapshot, never a proof.
- **DOCS-07's portability recipe** -- Phase 12. Per Phase 8's correction, it documents
  NOTHING about `dist/` state and `typecheck`.
- **A cross-process advisory lock for the archive path** -- still the recorded ceiling
  in `cache-archive-path.ts`, still not needed: no supported deployment runs `serve()`
  and `publishMirror()` concurrently. Moving the path does not change this.
- **The unattributed `test` failure at `69bd1b7`** -- open in
  `08-nx-task-hash-parity/deferred-items.md`. If `test` fails once in this phase,
  capture the output BEFORE re-running; the re-run destroys the evidence.

</deferred>

---

*Phase: 9-OS-Invariant Actions-Cache Version*
*Context gathered: 2026-07-28*
