---
phase: 0
phase_name: "teardown"
project: "@op-nx/github-cache - GitHub-backed Nx Remote Cache"
generated: "2026-07-18"
counts:
  decisions: 4
  lessons: 4
  patterns: 4
  surprises: 3
missing_artifacts:
  - "00-UAT.md (no human UAT for a no-requirement prep phase)"
---

# Phase 0 Learnings: Teardown

## Decisions

### Nx-native removal via `nx g @nx/workspace:remove`, generator + manual siblings
Removed the `@op-nx/github-cache` PoC project with `nx g @nx/workspace:remove @op-nx/github-cache` (no `--forceRemove` - zero dependents), then manually `git rm -r` the three non-graph siblings `start-cache-server/`, `publish-mirror/`, `.verdaccio/`. `--dry-run` confirmed the generator DELETEs the package tree and UPDATEs root `tsconfig.json` only, so the hand-scrub covered nx.json/package.json residue.

**Rationale:** The generator owns only the Nx project graph entry + package dir; sibling action dirs and the verdaccio scaffold are not graph nodes, so they must be removed by hand to satisfy "no dangling references" (SC1).
**Source:** 00-01-PLAN.md, 00-01-SUMMARY.md, 00-RESEARCH.md

### Keep the dormant Phase-3 cross-OS invariants (D-03)
Preserved `.gitattributes eol=lf` and the nx.json `integration` targetDefault including its `{ runtime: "node -p process.platform" }` discriminator, even though no project consumes them post-teardown.

**Rationale:** They are the load-bearing foundation Phase 3's cross-OS correctness stands on; a dormant targetDefault with no matching target is inert, not dangling. Re-deriving them later risks reopening the silently-failed CRLF / cross-OS bugs.
**Source:** 00-CONTEXT.md (D-03), 00-01-SUMMARY.md, 00-04-SUMMARY.md

### Scope the `format:check --all` gate via `.prettierignore` rather than reformatting docs (D-07)
Added `.planning/`, `CLAUDE.md`, `AGENTS.md`, `.claude/` (and, per an in-flight finding, `.gsd-migration-backup/`) to `.prettierignore` so the kept `nx format:check --all` CI step passes green.

**Rationale:** Those are agent/planning docs, not workspace source; reformatting them repo-wide would fight the tools that generate them and churn every future plan edit. Keeps the gate on real source and survives SC5's map-codebase writes.
**Source:** 00-CONTEXT.md (D-07), 00-03-SUMMARY.md

### Verification of a no-requirement teardown is an acceptance-command battery, not unit tests
Phase 0 delivers zero v0.0.1 requirements and adds no runtime code, so validation is the graph-clean + green-CI + de-primed-map command battery (nx sync:check / show projects / run-many / format:check + scoped greps), not test files or a VALIDATION.md test matrix.

**Rationale:** There is no runtime behavior to unit-test; fabricating tests would test behavior the phase does not deliver. The nyquist audit confirmed compliant with 0 gaps on this basis.
**Source:** 00-04-SUMMARY.md, 00-VALIDATION.md

---

## Lessons

### A plain `npm install` leaves a phantom lockfile entry for the removed workspace package
After removing the workspace package, a normal `npm install` left an `"extraneous": true` `packages/op-nx-github-cache` entry in `package-lock.json` - a real dangling PoC reference. Rebuilding the lockfile from scratch (`rm -f package-lock.json && npm install`) fully removed the phantom entry plus `@octokit`/`@actions/cache`, and `npm ci` then exits 0.

**Context:** The lockfile resync is a mandatory hand-step the generator does not perform; a torn workspace whose lockfile still names the deleted package fails CI `npm ci`.
**Source:** 00-01-SUMMARY.md

### `verdaccio` survives in the lockfile as a transitive optional peer of `@nx/js` - not a dangling ref
Even after removing the direct `verdaccio` devDep and the `local-registry` nx target, a from-scratch lockfile still pulls `verdaccio` because it is an `optional: true` peer of workspace-core `@nx/js`. Forcing it out (`--omit=optional`) would desync default `npm ci`.

**Context:** Lockfile-scoped dangling-ref greps must exclude `verdaccio`; the authoritative direct-ref check is scoped to nx.json/package.json/tsconfig.json.
**Source:** 00-01-SUMMARY.md, 00-04-SUMMARY.md

### GSD `state.update-progress` writes non-ASCII block chars, violating the repo ASCII rule
`gsd-tools query state.update-progress` renders a Unicode block-char progress bar (U+2588/U+2591). On an ASCII-only repo (Windows cp1252) this is a rule violation; position tracking must go through `state.advance-plan` + `roadmap update-plan-progress` instead.

**Context:** Two executors independently hit and worked around this; it is a general GSD-on-ASCII-repo caveat, not a one-off.
**Source:** 00-02-SUMMARY.md, 00-03-SUMMARY.md

### `nx format:check --all` also trips on gitignored, untracked backup trees
Beyond tracked agent/planning docs, `format:check --all` failed on an unformatted `MANIFEST.json` inside the gitignored, untracked `.gsd-migration-backup/` (0 tracked files, absent in a fresh CI checkout). It had to be added to `.prettierignore` too.

**Context:** `--all` scans beyond tracked source; any unformatted file the tool can see fails the gate, including migration/backup artifacts.
**Source:** 00-03-SUMMARY.md

---

## Patterns

### Teardown acceptance = command battery over a merged tree
Prove a teardown with `nx sync:check` / `show projects` / `graph --print` + scoped `git grep` + `npm ci` + `nx run-many` + `nx format:check --all`, run against the fully-merged tree, rather than with test files.

**When to use:** Any phase whose deliverable is structural (removal/rework/config) with no runtime behavior to unit-test.
**Source:** 00-04-SUMMARY.md

### Split authoritative direct-ref greps from over-broad lockfile greps
The authoritative dangling-reference gate is (a) PoC tokens absent tree-wide + (b) direct refs absent from nx.json/package.json/tsconfig.json. A literal whole-tree grep that includes transitive-peer tokens (verdaccio) over the lockfile is over-broad and will false-fail.

**When to use:** Verifying removals where a token can legitimately survive as a transitive dependency.
**Source:** 00-04-SUMMARY.md

### De-prime LAST, against a committed graph-clean tree
Run `/gsd:map-codebase` only after the teardown commits land and the graph is proven clean, so the regenerated `.planning/codebase/*` reflects the deleted-PoC state rather than a broken or pre-teardown one.

**When to use:** Any de-priming / documentation-regeneration step that reads the live workspace.
**Source:** 00-05-PLAN.md, 00-05-SUMMARY.md

### Instruct mapper agents to describe current state only, never resurrect removed code
Tell codebase mappers explicitly: describe the live workspace, do NOT mine git history or `.planning/` prose to reconstruct deleted code. This is a structural guard against re-priming the very artifact the de-prime is trying to erase.

**When to use:** Regenerating a codebase map right after deleting a large subsystem.
**Source:** 00-05-SUMMARY.md

---

## Surprises

### No `tsconfig.base.json` paths alias to scrub
Contrary to the ROADMAP removal risk, resolution in this workspace is via TS project references + `customConditions`, not a `paths` alias - so `nx g @nx/workspace:remove` left nothing to hand-scrub in `tsconfig.base.json`, retiring one of the two stated removal risks.

**Impact:** Simpler, lower-risk removal than planned; the dangling-ref surface was narrower than the ROADMAP anticipated.
**Source:** 00-RESEARCH.md, 00-01-SUMMARY.md

### `nx run-many` on undefined targets is a green exit-0 no-op
With no remaining project defining `build`/`test`/`typecheck`/`integration`, `nx run-many` exits 0 with "No tasks were run" - which is exactly what lets the reworked baseline CI pass green on the empty shell.

**Impact:** The 5-job local-cache CI is a valid green scaffold with nothing to build yet; no placeholder targets were needed.
**Source:** 00-04-SUMMARY.md, 00-RESEARCH.md

### Dormant != dangling for nx.json targetDefaults
A targetDefault whose target no project defines errors on nothing - verified against the workspace's existing non-matching `test`/`tsconfig.storybook.json` default - so keeping the `integration` discriminator inert is safe.

**Impact:** Confirmed D-03's dormant-invariant preservation carries zero graph-resolution cost, removing doubt about keeping unused config.
**Source:** 00-RESEARCH.md
