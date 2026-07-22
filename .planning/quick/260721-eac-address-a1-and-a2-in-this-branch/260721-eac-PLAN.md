---
phase: 260721-eac
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/github-cache/src/action/trust.generated.cjs
  - packages/github-cache/selfcheck.cjs
  - packages/github-cache/src/lib/trust.generated.spec.ts
  - packages/github-cache/src/selfcheck.spec.ts
  - .github/workflows/ci.yml
  - package.json
  - .fallowrc.jsonc
  - .prettierignore
  - packages/github-cache/pack-check.cjs
  - .planning/REQUIREMENTS.md
autonomous: true
requirements:
  - TRUST-04
  - TRUST-07
must_haves:
  truths:
    - "npx nx test github-cache passes after the two selfcheck/trust.generated specs are removed (no missing-import failures)"
    - "npm run fallow:ci is clean (no dangling fallow entry/ignore pointing at a deleted file)"
    - "npm run check:action and npm run pack:check both pass"
    - "trust.ts remains the sole isWriteTrusted source; no production code require()s the deleted trust.generated.cjs"
    - "REQUIREMENTS.md TRUST-07 (line 54) shows [x]; TRUST-07-GHCR (line 87, later-milestone) is unchanged"
    - "package.json dependencies/devDependencies and package-lock.json are byte-unchanged (only the two npm scripts removed)"
  artifacts:
    - "packages/github-cache/src/lib/trust.ts (KEEP - single source of truth, must stay unmodified)"
    - ".planning/quick/260721-eac-address-a1-and-a2-in-this-branch/260721-eac-SUMMARY.md (created on completion)"
  key_links:
    - "ci.yml has no selfcheck job and no `needs: selfcheck` anywhere"
    - ".fallowrc.jsonc has no entry or ignorePattern referencing selfcheck.cjs or trust.generated.cjs"
    - "git grep 'export function isWriteTrusted' returns exactly one file (trust.ts)"
---

<objective>
Close the two non-blocking "Findings A" from the v0.0.1 milestone audit, on the CURRENT
branch `gsd/v0.0.1-greenfield-rebuild` (no new branch, no worktree; the milestone code
lives only on this branch, `origin/main` is the pre-milestone baseline - never a base here).

- A1 (tech debt): REMOVE the whole orphaned `trust.generated.cjs` write-trust loop. It has
  zero runtime consumers - both actions reach the write gate via `trust.ts` (compiled to
  `dist/` for the internal action; esbuild-bundled for the Phase 6 consumer action). Its
  intent (single source + no dual-root drift) is met by `trust.ts` alone once the generated
  copy and its guards are gone (nothing left to drift against). KEEP `trust.ts`.
- A2 (bookkeeping): flip the TRUST-07 checkbox `[ ]` -> `[x]` in REQUIREMENTS.md.

Purpose: remove dead-but-guarded weight and reconcile a stale checkbox before the milestone
lands via PR.
Output: 4 files deleted, 5 files edited, 1 checkbox flipped; the CI/test/fallow battery green.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/260721-eac-address-a1-and-a2-in-this-branch/260721-eac-CONTEXT.md
@.planning/STATE.md

# The single source of truth to PRESERVE (do NOT modify):
@packages/github-cache/src/lib/trust.ts
</context>

<planning_notes>
The planning grep found TWO references NOT listed in CONTEXT.md's locked removal set. Both are
config/dead-assertion references (NOT runtime consumers), so neither triggers the A1 abort gate;
both must be cleaned to complete "REMOVE the whole loop":

1. `.prettierignore` lines 12-16 - a dangling ignore for `trust.generated.cjs`. Surfaced by the
   mandated gate grep. Same class as the `.fallowrc.jsonc` ignore entry. INCLUDED in Task 1.
2. `packages/github-cache/pack-check.cjs` lines 10/15/66 - a dead `FORBIDDEN` predicate asserting
   `selfcheck.cjs` must-not-ship, plus two doc-comment mentions. `npm run pack:check` stays green
   either way, but it is dangling dead weight referencing the deleted generator. INCLUDED in Task 1.

Also: `.fallowrc.jsonc` has TWO blocks to remove, not one. CONTEXT.md named only the
`trust.generated.cjs` ignorePattern (lines 52-55). There is ALSO a `selfcheck.cjs` ENTRY
(lines 28-31). Leaving the entry after deleting the file would make `npm run fallow:ci` fail
(a declared entry point at a missing file). BOTH blocks are removed in Task 1.

One cosmetic reference is intentionally LEFT untouched (out of scope; harmless, separate file):
`esbuild.action.mjs:9` comment "mirroring the selfcheck.cjs generator-script convention". It is a
convention description, not a file dependency, and touching it would open a new file in the change
surface for a single comment word.
</planning_notes>

<tasks>

<task type="auto">
  <name>Task 1: A1 - remove the whole trust.generated write-trust loop</name>
  <files>
    packages/github-cache/src/action/trust.generated.cjs (DELETE),
    packages/github-cache/selfcheck.cjs (DELETE),
    packages/github-cache/src/lib/trust.generated.spec.ts (DELETE),
    packages/github-cache/src/selfcheck.spec.ts (DELETE),
    .github/workflows/ci.yml (EDIT),
    package.json (EDIT),
    .fallowrc.jsonc (EDIT),
    .prettierignore (EDIT),
    packages/github-cache/pack-check.cjs (EDIT)
  </files>
  <action>
    STEP 0 - CONFIRMATION GATE (security-adjacent removal, per CONTEXT.md; run BEFORE any
    deletion). Re-run:
    `git grep -n "trust.generated" -- ':!*trust.generated.cjs' ':!*trust.generated.spec.ts' ':!.planning/*'`
    Confirm every remaining hit maps to a file this task removes/edits: `.fallowrc.jsonc`,
    `.github/workflows/ci.yml`, `.prettierignore`, `packages/github-cache/selfcheck.cjs`,
    `packages/github-cache/src/selfcheck.spec.ts`. The `.prettierignore` hit is EXPECTED
    (planning-discovered dangling ignore, same class as the fallowrc entry - NOT a runtime
    consumer). Also run `git grep -n "require(.*trust.generated\|from.*trust.generated" -- 'packages/github-cache/src/**/*.ts' 'packages/github-cache/src/**/*.cjs'`
    and confirm the ONLY importers are the two spec files being deleted. If ANY OTHER production
    `require()`/`import` of trust.generated.cjs surfaces (one that ships to dist/), ABORT A1 and
    surface it - do NOT remove blindly.

    STEP 1 - DELETE the four loop files with `git rm`:
    - packages/github-cache/src/action/trust.generated.cjs (the orphaned artifact)
    - packages/github-cache/selfcheck.cjs (the generator/drift-detector)
    - packages/github-cache/src/lib/trust.generated.spec.ts (147-case semantic-parity spec)
    - packages/github-cache/src/selfcheck.spec.ts (the selfcheck.cjs CLI drift-detection test)

    STEP 2 - EDIT .github/workflows/ci.yml: delete the entire `selfcheck` job including its
    leading comment block - the run of lines from `# The trust-copy drift tripwire (TRUST-04 / D-07).`
    (~line 44) through `      - run: npm run selfcheck` (~line 64), plus the single trailing blank
    line, so exactly one blank line separates the `fallow` job's last step
    (`- run: npm run fallow:ci`) from the `# The consumer-action bundle drift guard` comment. No
    other job has `needs: selfcheck` (verified: only dogfood-seed/build/publish carry `needs:`),
    so no downstream `needs:` array edits are required.

    STEP 3 - EDIT package.json: remove ONLY these two script lines (~14-15), leaving deps untouched:
      "selfcheck": "node packages/github-cache/selfcheck.cjs",
      "generate:trust": "node packages/github-cache/selfcheck.cjs --write",
    The preceding "fallow:ci" line keeps its trailing comma; "build:action" follows, so JSON stays
    valid. Do NOT touch dependencies/devDependencies (Windows lockfile-prune trap - guarded by
    the git diff/status checks in the <verify> block below).

    STEP 4 - EDIT .fallowrc.jsonc: remove BOTH trust.generated-loop blocks (JSONC trailing commas
    are fine):
    (a) the `entry` for the generator (~lines 28-31): its `// Trust-copy drift tripwire ...` comment
        plus the `"packages/github-cache/selfcheck.cjs",` line.
    (b) the `ignorePatterns` for the artifact (~lines 52-55): its `// Generated dependency-free
        write-gate copy ...` comment plus the `"packages/github-cache/src/action/trust.generated.cjs",`
        line.

    STEP 5 - EDIT .prettierignore: remove the trust.generated block (~lines 12-16) - the
    `# Generated dependency-free write-gate copy ...` comment (4 lines) plus the
    `packages/github-cache/src/action/trust.generated.cjs` path line, plus one adjacent blank line
    so no double-blank remains. Leave the vendored-OpenAPI block (above) and the esbuild-bundle
    block (below) intact.

    STEP 6 - EDIT packages/github-cache/pack-check.cjs (dangling dead-assertion cleanup): remove the
    now-dead `FORBIDDEN` predicate line `{ label: 'the selfcheck generator', test: (p) => p === 'selfcheck.cjs' },`
    (~line 66). In the file's doc comment, drop the stale generator name: change the dogfood-files
    list (~line 10) `(action.yml, selfcheck.cjs, pack-check.cjs,` to `(action.yml, pack-check.cjs,`
    and drop `, mirroring selfcheck.cjs` from the "Dependency-free ... so CI can run" sentence
    (~line 15). Do not otherwise change pack-check.cjs logic.
  </action>
  <verify>
    <automated>git rm confirmed for the 4 files; then run the battery: `npx nx test github-cache` passes, `npm run fallow:ci` passes, `npm run check:action` passes, `npm run pack:check` passes</automated>
    Deps-untouched proof (Windows lockfile-prune guard): `git diff -- package.json` shows ONLY the
    two removed script lines (no dependencies/devDependencies change), and `git status --porcelain -- package-lock.json`
    is empty (lockfile unmodified). No-consumer proof: `git grep -c "export function isWriteTrusted" -- 'packages/github-cache/src/**/*.ts'`
    returns exactly 1 (trust.ts), and `git grep -n "trust.generated"` returns hits ONLY under `.planning/`
    (docs) - zero in source/config. trust.ts unchanged: `git status --porcelain -- packages/github-cache/src/lib/trust.ts` is empty.
  </verify>
  <done>
    The 4 loop files are deleted; ci.yml selfcheck job, the two npm scripts, both .fallowrc.jsonc
    blocks, the .prettierignore block, and the pack-check.cjs dead predicate/comments are removed;
    trust.ts is untouched; package-lock.json and package.json deps are unchanged; all four verify
    commands (nx test, fallow:ci, check:action, pack:check) pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: A2 - flip the TRUST-07 checkbox to [x]</name>
  <files>.planning/REQUIREMENTS.md</files>
  <action>
    In .planning/REQUIREMENTS.md, on line 54, change the TRUST-07 checkbox from unchecked to
    checked: `- [ ] **TRUST-07**:` becomes `- [x] **TRUST-07**:`. This reconciles the requirement
    with 04-VERIFICATION.md:225, which marks TRUST-07 SATISFIED (first-write-wins / no-overwrite;
    409 on existing record + mirror never overwrites; unit-tested). Change ONLY the checkbox
    character - leave the rest of line 54 verbatim. Do NOT touch line 87 (the `TRUST-07-GHCR`
    reference inside the GHCR-01 later-milestone bullet) - it is correctly parked.
  </action>
  <verify>
    <automated>`git grep -n "TRUST-07" -- .planning/REQUIREMENTS.md` shows line 54 as `- [x] **TRUST-07**` and line 87's TRUST-07-GHCR unchanged; `git grep -c "\- \[ \] \*\*TRUST-07\*\*" -- .planning/REQUIREMENTS.md` returns 0 (no unchecked TRUST-07 remains)</automated>
    `git diff -- .planning/REQUIREMENTS.md` shows exactly one changed line (line 54, `[ ]`->`[x]`).
  </verify>
  <done>REQUIREMENTS.md line 54 shows `- [x] **TRUST-07**`; line 87 TRUST-07-GHCR is unchanged; the diff is a single character on a single line.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| GitHub Actions event context -> write-gate decision | `isWriteTrusted(env)` decides RW-vs-RO from untrusted trigger/host env |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-eac-01 | Tampering/Elevation | removal of the trust-copy drift guard (selfcheck.cjs + trust.generated.spec.ts) | medium | mitigate | The guard only protected the now-DELETED dependency-free copy (trust.generated.cjs); with the copy gone there is nothing left to drift against. `trust.ts` stays the single source compiled/bundled into both actions. STEP 0 confirmation gate proves no production code require()s the deleted copy before removal. |
| T-eac-02 | Tampering | accidental edit to trust.ts write-gate logic during the removal | low | mitigate | trust.ts is KEEP-only; verify `git status --porcelain -- packages/github-cache/src/lib/trust.ts` is empty (unmodified). |
| T-eac-03 | Denial of Service (CI) | removal breaks the CI battery (stale fallow entry / dead pack-check predicate / dangling ci.yml needs) | low | mitigate | fallow entry for the deleted generator is removed; pack:check re-run proves the guard still passes; no `needs: selfcheck` exists. Full battery (nx test / fallow:ci / check:action / pack:check) is the verify gate. |
</threat_model>

<verification>
Everything runs on the current branch `gsd/v0.0.1-greenfield-rebuild` (no branch/worktree change).
After both tasks:
- `npx nx test github-cache` - green (the two removed specs no longer referenced).
- `npm run fallow:ci` - green (no dangling entry/ignore for deleted files).
- `npm run check:action` - green (unaffected; does not reference selfcheck).
- `npm run pack:check` - green (dead selfcheck predicate removed; guard still enforces the tarball allow-list).
- `git grep "trust.generated"` and `git grep "selfcheck"` return hits ONLY under `.planning/` (docs), zero in source/config (except the intentionally-left cosmetic `esbuild.action.mjs:9` convention comment).
- `git diff -- package.json` shows only the two script deletions; `package-lock.json` unmodified.
- REQUIREMENTS.md TRUST-07 (line 54) = `[x]`; TRUST-07-GHCR (line 87) unchanged.
</verification>

<success_criteria>
- A1: the trust.generated loop is fully removed (4 files deleted + 5 config/guard files de-referenced), trust.ts preserved as the single isWriteTrusted source, and the full CI battery is green with no deps/lockfile change.
- A2: REQUIREMENTS.md TRUST-07 checkbox is `[x]`, TRUST-07-GHCR untouched.
</success_criteria>

<output>
Create `.planning/quick/260721-eac-address-a1-and-a2-in-this-branch/260721-eac-SUMMARY.md` when done.
</output>
