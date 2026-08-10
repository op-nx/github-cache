---
phase: 13-read-only-actions-cache-backend
plan: 02
subsystem: infra
tags: [actions-cache, backend-port, esbuild-bundle, vitest, source-scan-guard, tdd]

# Dependency graph
requires:
  - phase: 09-os-invariant-actions-cache-version
    provides: the single cache.restoreCache READ call site, its VER-03 positional lock, and the file-scoped ordered-member scan that made a second read site detectable
  - phase: 13-read-only-actions-cache-backend
    provides: "13-01 registered VER-08 and VER-09 in REQUIREMENTS.md and ROADMAP.md"
provides:
  - "createReadOnlyActionsCacheBackend(): a parameterless ReadableBackend with NO put -- an Actions-cache read position where a write is unrepresentable rather than refused"
  - "createActionsCacheBackend() rewritten as a spread of the read-only factory plus put, so exactly one get closure and one cache.restoreCache READ call site exist in the package"
  - "VER-09: a package-scope @actions/cache importer scan, mutation-proven, closing the one evasion the two file-scoped scans structurally cannot see"
  - regenerated start-cache-server/index.js carrying the composed shape, committed with its source
affects: [13-03 select-backend wiring and the CACHE_READ_ONLY knob, 13-05 the three Windows leg gates, 13-06 evidence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "read-only base + writable composition for backends that share construction-time state (diverges from memory-backend.ts's two-independent-factories-over-a-helper, which shares none)"
    - "package-scope source-glob drift guard: same shape as the file-scoped scans one level wider, exact array not a count, comment-stripped, cwd-anchored on the existing workspace-root hook"

key-files:
  created: []
  modified:
    - packages/github-cache/src/backend/actions-cache-backend.ts
    - packages/github-cache/src/backend/actions-cache-backend.spec.ts
    - start-cache-server/index.js

key-decisions:
  - "Both factories live in packages/github-cache/src/backend/actions-cache-backend.ts and the constraint is comment-locked in the module header: the ordered-member guard resolves its subject by NAME, so a sibling file would make it blind rather than red"
  - "Read-only factory declared FIRST -- that ordering is what keeps the guard's asserted array byte-identical at restoreCache, saveCache, restoreCache, so it passed with ZERO edits"
  - "Both VER-04 error prefixes renamed to createReadOnlyActionsCacheBackend rather than introducing a shared literal constant: after the split the throws come from the function the write path reaches by calling, so the name is accurate on both paths and no new symbol was needed"
  - "VER-09 matches the quoted module specifier including deep subpaths, on comment-stripped source -- five non-spec modules mention @actions/cache in prose today, so an unstripped scan would have been red before the phase changed anything"
  - "The existing :501-510 comment-strip pipeline was NOT refactored into the new per-file helper: the phase's own confirmation that the shape is right is that the VER-03 clauses pass with zero edits, and rewiring their input would forfeit that signal for a six-line saving"

patterns-established:
  - "Composition over duplication for ports sharing construction-time state: the writable factory spreads the read-only one, so guards and the read closure are inherited rather than copied"
  - "A drift guard that is green when written must be proven by MUTATION and the measurement recorded in its own comment, not argued"

requirements-completed: [VER-08, VER-09]

coverage:
  - id: D1
    description: "createReadOnlyActionsCacheBackend() exists, is parameterless, returns a ReadableBackend, and isWritableBackend is false for it -- a write is unrepresentable, not refused at runtime"
    requirement: VER-08
    verification:
      - kind: unit
        ref: "packages/github-cache/src/backend/actions-cache-backend.spec.ts#has NO put, so isWritableBackend is false and a write is unrepresentable (VER-08)"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/backend/actions-cache-backend.spec.ts#leaves the writable factory writable -- the composition ADDS put (VER-08)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both factories restore identically because there is literally one get closure -- the same HIT, the same MISS, and the same whole restoreCache argument array from either"
    requirement: VER-08
    verification:
      - kind: unit
        ref: "packages/github-cache/src/backend/actions-cache-backend.spec.ts#produces the same HIT and the SAME whole restoreCache argument array from either factory (VER-08, D-01)"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/backend/actions-cache-backend.spec.ts#returns a miss from either factory when restoreCache resolves undefined (VER-08)"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/backend/actions-cache-backend.spec.ts#accesses exactly the ordered members restoreCache, saveCache, restoreCache (VER-03)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The VER-04 cwd and GITHUB_WORKSPACE guards fire from the READ-ONLY factory too, and their messages no longer name a function that did not run"
    requirement: VER-08
    verification:
      - kind: unit
        ref: "packages/github-cache/src/backend/actions-cache-backend.spec.ts#THROWS from the READ-ONLY factory when the cwd has no nx.json (VER-04 conjunct 1, VER-08)"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/backend/actions-cache-backend.spec.ts#THROWS from the READ-ONLY factory when GITHUB_WORKSPACE points at a sibling directory (VER-04 conjunct 2, VER-08)"
        status: pass
      - kind: other
        ref: "git grep -n \"createActionsCacheBackend:\" -- 'packages/github-cache/src/**/*.ts' ':!*.spec.ts' -> no matches"
        status: pass
    human_judgment: false
  - id: D4
    description: "Exactly one non-spec module under packages/github-cache/src imports @actions/cache, asserted at PACKAGE scope so a future sibling backend is visible"
    requirement: VER-09
    verification:
      - kind: unit
        ref: "packages/github-cache/src/backend/actions-cache-backend.spec.ts#is the ONLY non-spec module under packages/github-cache/src that imports @actions/cache (VER-09)"
        status: pass
      - kind: other
        ref: "mutation proof: a throwaway backend/probe-actions-cache-mutation.ts importing @actions/cache scored 1 failed / 30 passed -- VER-09 red, both file-scoped clauses green; throwaway deleted, suite back to 31 passed"
        status: pass
    human_judgment: false
  - id: D5
    description: "start-cache-server/index.js matches its source at the commit that edits actions-cache-backend.ts"
    verification:
      - kind: other
        ref: "npm run check:action (main tree) -> exit 0, no diff"
        status: pass
      - kind: other
        ref: "git log --oneline -1 --name-only at 1172887 lists both actions-cache-backend.ts and start-cache-server/index.js"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-08-02
status: complete
---

# Phase 13 Plan 02: Read-Only Actions-Cache Backend Summary

**`createActionsCacheBackend()` is now `{ ...createReadOnlyActionsCacheBackend(), put }` -- one `get` closure, one `cache.restoreCache` READ call site, and a package-scope importer scan that makes a second one visible instead of silent.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-02T00:30:00Z
- **Completed:** 2026-08-02T00:47:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- **Cache-version drift is now unrepresentable rather than guarded.** The read-only factory owns
  the entire construction preamble and the single `get`; the writable factory spreads it and adds
  `put`. There is no second copy of the
  `(paths, primaryKey, undefined, undefined, /* enableCrossOsArchive */ true)` argument list to
  drift, which is D-01's locked acceptance criterion and the ROADMAP's named risk for this phase.
- **The existing ordered-member guard passed with ZERO edits**, which is the strongest available
  confirmation the shape is right. Declaring the read-only factory FIRST keeps the asserted array
  byte-identical at `['restoreCache', 'saveCache', 'restoreCache']`. Had that clause needed
  editing, the shape would have been wrong.
- **VER-09 closes the one evasion the file-scoped scans structurally cannot see.** Both existing
  clauses resolve their subject as `new URL('./actions-cache-backend.ts', ...)` -- a single named
  file -- so a sibling module carrying its own `cache.restoreCache` produced zero failures. The new
  package-scope clause was proven non-vacuous by mutation and the measurement recorded in its
  comment.
- **Read-only-ness is structural, as the port intended.** `isWritableBackend` is false for the new
  factory because there is no `put` to find; no `'forbidden'` value was reintroduced, no `kind`
  discriminator added, and neither factory grew a parameter.
- **Both VER-04 anchor guards now run on the read-only path**, where they matter more than on the
  write path: a read-only leg has no write whose failure would surface, so an unnamed
  cwd/`GITHUB_WORKSPACE` divergence would present as "cross-OS restore is broken" instead of naming
  its cause.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED -- behavioural describes for the read-only factory, and the package-scope importer scan** -- `24c5d9f` (test)
2. **Task 2: GREEN -- extract the read-only base factory and make the writable one compose it** -- `1172887` (feat; the Task 3 bundle regeneration is amended into this same commit, per plan)
3. **Task 3: Regenerate the committed action bundle and prove VER-09 is non-vacuous** -- bundle in `1172887`; the recorded mutation measurement in `2fdfd56` (test)

## Files Created/Modified

- `packages/github-cache/src/backend/actions-cache-backend.ts` - split into
  `createReadOnlyActionsCacheBackend()` (guards + VER-07 mkdir + the single `get`) and
  `createActionsCacheBackend()` (spread + `put`). Every moved block is verbatim; the only in-block
  edit is the two VER-04 message prefixes.
- `packages/github-cache/src/backend/actions-cache-backend.spec.ts` - four new behavioural
  describes for the read-only factory and the shared `get`, two VER-04 clauses added inside the
  existing fixture describe, and the VER-09 package-scope scan.
- `start-cache-server/index.js` - regenerated from the MAIN tree; the diff is the refactor and
  nothing else (15 changed lines).

## Decisions Made

- **Rename the VER-04 prefixes to the read-only factory's name rather than introduce a shared
  literal constant.** The plan allowed either. After the split both throws come from the function
  the write path reaches *by calling*, so the read-only name is accurate on both paths and a new
  symbol would have bought nothing.
- **Keep `put`'s `lookupOnly` probe exactly where it is.** It is a second `restoreCache`, but on
  the WRITE path only, and it must keep `enableCrossOsArchive: true` at the 5th positional -- a
  probe at a different cache version reports "absent" for a present entry and every Windows write
  would answer a spurious 409. Unifying it with the read path was explicitly not done.
- **VER-09 matches the quoted module specifier (including a deep subpath) on comment-stripped
  source, not a bare string occurrence.** Five non-spec modules name `@actions/cache` in prose
  today, so a naive `.includes("'@actions/cache'")` scan would risk a red that a later reader would
  "fix" by weakening the guard.
- **The read-only factory's JSDoc describes its role without a temporal claim.** Its `selectBackend`
  wiring lands in 13-03, so writing "not yet constructed on any runtime path" would have created a
  stale-claim site the moment 13-03 landed -- exactly the D-06 defect class this repo has corrected
  four times on this branch.
- **The existing comment-strip pipeline at `:501-510` was left inline rather than refactored into
  the new helper**, so the VER-03 clauses' input is untouched and "passed with zero edits" stays a
  real signal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `node:path`'s `sep` is banned in unit specs by a project lint rule**

- **Found during:** Task 1 (RED spec authoring)
- **Issue:** The VER-09 scan normalised `readdirSync` output with `sep`, which
  `no-restricted-imports` rejects under CORR-06: "a unit spec must not derive an expectation from
  the RUNNING machine."
- **Fix:** Replaced with a fixed, unconditional `entry.replaceAll('\\', '/')`, which yields the
  same array on every OS, plus a comment recording why `sep` must not be re-added.
- **Files modified:** `packages/github-cache/src/backend/actions-cache-backend.spec.ts`
- **Verification:** `npx nx lint github-cache --skip-nx-cache` clean.
- **Committed in:** `24c5d9f` (Task 1 commit)

**2. [Rule 3 - Blocking] `readdirSync` return type widened to `string[] | Buffer[]`**

- **Found during:** Task 2 (running the full battery after GREEN)
- **Issue:** `readdirSync(dir, { recursive: true })` resolves to the union overload, so
  `.replaceAll` did not typecheck. `nx test` passes regardless (vitest transpiles without
  typechecking), so only `tsc --build` surfaced it.
- **Fix:** Named `encoding: 'utf8'` explicitly so the overload resolves to `string[]`. Folded into
  the Task 1 commit by amend, since it is a defect in Task 1's own code and keeps Task 2's spec
  diff at exactly zero lines.
- **Files modified:** `packages/github-cache/src/backend/actions-cache-backend.spec.ts`
- **Verification:** `npx nx run-many -t typecheck lint --skip-nx-cache` green.
- **Committed in:** `24c5d9f` (amended into the Task 1 commit)

**3. [Rule 2 - Missing Critical] A stale parenthetical in the module header**

- **Found during:** Task 2 (header extension)
- **Issue:** "This backend never returns 'forbidden' (403 is the read-only backend's job)" implies
  the read-only backend returns `'forbidden'`. It does not -- `types.ts:3-8` deleted the value and
  the SERVER produces the 403 at the protocol boundary. The claim was already loose and this phase
  makes it conspicuous by putting the read-only backend in the same file.
- **Fix:** Corrected the parenthetical to name the server, per D-06 ("correct every copy of a stale
  claim in the SAME commit").
- **Files modified:** `packages/github-cache/src/backend/actions-cache-backend.ts`
- **Verification:** Suite green; claim now matches `types.ts:3-8`.
- **Committed in:** `1172887` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** All three were necessary to land the planned change cleanly. No scope creep --
nothing outside the three planned files was touched.

## Issues Encountered

- **`git grep -c "createActionsCacheBackend:" == 0` initially failed on two hits, neither a real
  defect.** One was my own new comment quoting the OLD prefix as an explanation; reworded so the
  criterion is mechanically clean. The other is `publish-mirror.spec.ts:26`, a pre-existing
  module-mock OBJECT KEY (`createActionsCacheBackend: vi.fn(...)`) that predates this phase and has
  nothing to do with an error-message prefix -- verified present at `HEAD~2`. The criterion holds
  in its intended sense: **no non-spec module under `src/` carries the prefix.**
- **The RED failed as "is not a function", not as a link-time unresolved-import error.** Vitest's
  esbuild transform turns the ESM named import into an interop property read, so a missing export
  surfaces at call time. Same signal, same 5 tests, same reason -- worth knowing so a future
  executor does not chase a "wrong RED".

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `createReadOnlyActionsCacheBackend()` is exported and fully specified, so **13-03 can wire it into
  `selectBackend` as the fifth outcome** with a one-line branch immediately before
  `return createActionsCacheBackend()`. Nothing in `serve.ts` or `server.ts` needs to change --
  `serve.ts:91-95` already passes a `ReadableBackend` through unchanged and answers PUT with 403.
- **`docs/advanced.md` still documents FOUR selection outcomes and `docs/configuration.md:92` still
  says "four".** Both are DOCS-10 correction sites owned by 13-03, and `docs-adoption.spec.ts`'s
  four-outcome clause will need updating with them.
- **Bundle coupling is live for the rest of the phase.** 13-03 edits `select-backend.ts`, which is
  also `serve()`-reachable, so it must regenerate `start-cache-server/index.js` in the same commit
  from the MAIN tree.
- No blockers.

## Self-Check: PASSED

Files verified present:
- `packages/github-cache/src/backend/actions-cache-backend.ts`
- `packages/github-cache/src/backend/actions-cache-backend.spec.ts`
- `start-cache-server/index.js`

Commits verified in history: `24c5d9f`, `1172887`, `2fdfd56`

Battery: `npm run test` green (950 passed), `npx nx run-many -t typecheck lint` green,
`npm run check:action` exit 0 with no diff, `git status --porcelain packages/github-cache/src`
empty.

---
*Phase: 13-read-only-actions-cache-backend*
*Completed: 2026-08-02*
