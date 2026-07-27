---
phase: 07-lint-toolchain-and-the-ambient-platform-read-ban
fixed_at: 2026-07-27
review_path: .planning/phases/07-lint-toolchain-and-the-ambient-platform-read-ban/07-REVIEW.md
iteration: 1
findings_in_scope: 15
fixed: 13
skipped: 2
status: partial
diff_base: 0ef4aad
---

# Phase 7: Code Review Fix Report

**Source review:** `07-REVIEW.md` (1 CRITICAL, 2 HIGH, 6 MEDIUM, 6 LOW)
**Base:** `0ef4aad` -- **Head:** `f70ebc8` -- 13 commits, one per finding

**Summary:** 13 fixed, 2 declined (ME-01 escalated, ME-05 assessed).
All nine battery commands verified green from the repo root at EVERY commit.

## Disposition

| ID | Sev | Disposition | Commit |
|---|---|---|---|
| CR-01 | CRITICAL | fixed | `5e662a7` |
| HI-01 | HIGH | fixed | `5b9f5ca` |
| HI-02 | HIGH | fixed | `2cc6203` |
| ME-01 | MEDIUM | **DECLINED -- escalated, needs a D-16 decision** | -- |
| ME-02 | MEDIUM | fixed | `7afb251` |
| ME-03 | MEDIUM | fixed (ceiling recorded) | `eb765e2` |
| ME-04 | MEDIUM | fixed (primary half; latent half declined) | `31a1e73` |
| ME-05 | MEDIUM | **DECLINED as a code fix -- assessed below, no exposure** | -- |
| ME-06 | MEDIUM | fixed | `d4d89e7` |
| LO-01 | LOW | fixed | `331a60c` |
| LO-02 | LOW | fixed | `7b36c97` |
| LO-03 | LOW | fixed | `e03586b` |
| LO-04 | LOW | fixed | `ae60881` |
| LO-05 | LOW | fixed | `912b4b6` |
| LO-06 | LOW | fixed | `f70ebc8` |

## RED evidence, per guard fix

Every mutation was applied, observed, reverted, and confirmed byte-identical
(`git diff --exit-code`). No mutation is committed.

### CR-01 -- `5e662a7`

Mutation: delete the four-line `@nx/eslint/plugin` entry from `nx.json` `plugins[]`.

| Surface | Observed |
|---|---|
| `npm run lint` (the OLD gate) | **exit 0**, output ` NX   No tasks were run` -- green with nothing linted |
| pre-existing `nx-target-inputs` assertions | **14 of 14 still PASSED** -- reproduces the review's claim that nothing in the repo could see it |
| new spec assertions | **2 failed / 14 passed** -- only the two new ones |
| new CI check (`Successfully ran target lint`) | **absent from output -> FAILS** |

Restored: `git diff --exit-code -- nx.json` clean; 16/16 green; success line present again.

Also measured, and load-bearing for the CI fix: with colour on, Nx emits
`Successfully ran target <esc>[1mlint<esc>[22m for project`, so a plain-text
match never fires. `NO_COLOR: '1'` on the step yields
` NX   Successfully ran target lint for project @op-nx/github-cache`.

### HI-01 -- `5b9f5ca`

Measured against the shipped config at `packages/github-cache/src/x.spec.ts`:

| Source | BEFORE | AFTER |
|---|---|---|
| `import * as os from 'node:os'; os.tmpdir()` | both rules | both rules |
| `import osx from 'node:os'; osx.tmpdir()` | **`[]`** | `no-restricted-imports` |
| `import osx from 'os'; osx.platform()` | **`[]`** | `no-restricted-imports` |
| `import p from 'node:path'; p.sep` | **`[]`** | `no-restricted-imports` |
| `import p from 'path'; p.sep` | **`[]`** | `no-restricted-imports` |
| `import local from './local.js'` (control) | `[]` | `[]` |
| integration path, all of the above | `[]` | `[]` |

Mutation: remove `'default'` from both accessor lists -> **2 failed / 40 passed**,
exactly the two new `EVASION_SHAPES` rows. Reverted.

No default import of `os`/`path` exists anywhere in the repo today, so the
change is purely additive against the current tree.

### HI-02 -- `2cc6203`

Mutation: restore site 4's OLD reason text under the tightened guard ->
**1 failed / 41 passed**, exactly site 4's reason assertion. Sites 1-3 pass
unchanged: each already carries "an integration spec" as prose, so only site 4
was relying on the filename token. Reverted.

### ME-02 -- `7afb251`

Mutation: delete the P8 selector -> **2 failed / 44 passed**, exactly the two new
rows. Config still parses. Reverted. `process.env.CI` control stays clean.
Measured zero findings on the existing tree (no spec reads any of the five keys).

### ME-04 -- `31a1e73`

Mutation: add a second include glob `e2e/**/*.integration.spec.{tsx}` to the real
`vitest.integration.config.mts`.

| Guard | Observed |
|---|---|
| NEW (whole-array capture) | **1 failed / 4 passed** -- "an `*.integration.spec.tsx` would be linted as a UNIT spec: the ESLint scope covers cts, mts, ts and the integration vitest config includes tsx" |
| OLD (first-element capture) | extension set `["ts","mts","cts"]` -- tsx never seen, mutation **PASSES silently** |

Reverted; `vitest.integration.config.mts` confirmed byte-identical.

### LO-01 -- `331a60c`

Mutation: remove `{workspaceRoot}/tools/eslint-rules/**/*` from `test.inputs`,
leaving the `lint` entry intact -> **1 failed / 16 passed**, exactly the new
assertion. Reverted, `nx.json` byte-identical.

### LO-05 -- `912b4b6`

Mutation: add `"probe": { "cache": true }` to `targetDefaults` (an entry with no
`inputs` key).

| Code | Observed |
|---|---|
| OLD `target.inputs.some(...)` | **`TypeError: Cannot read properties of undefined (reading 'some')`** -- 1 failed / 16 passed |
| NEW `target.inputs?.some(...) ?? false` | **17/17 pass**, probe entry correctly contributes nothing |

Both reverted; `nx.json` byte-identical.

### LO-06 -- `f70ebc8`

Mutation: create a plain FILE named `src` at the workspace root (a file, not the
directory D-08 forbids).

```
OLD  existsSync(src)                      = true    <- lock FAILS on a file
NEW  statSync(src)?.isDirectory() === true = false   <- lock holds
```

Spec passed 5/5 with the file present. Probe file removed; tree clean.

### Comment-only fixes (no guard, so no RED)

ME-03, ME-06, LO-02, LO-03 change rationale prose and, for ME-06, remove a
timeout argument. Each was verified by the full battery. The MEASUREMENTS behind
them:

- **ME-06**: installed vitest 4.1.10 -- `resolved.testTimeout ??= ... 5e3` and
  `resolved.hookTimeout ??= ... 1e4`. The hooks were budgeted at 10 000 ms, not
  the 5 000 ms both comments cited. Confirmed the reviewer's finding exactly.
- **LO-02**: `export const v = process.cwd();` at a unit spec path -> `[]`.
- **LO-03**: `vitest.integration.config.mts` contains no `include: ['...']` form
  in its prose (read directly); the stripping rationale's factual claim was false.

## Declined

### ME-01 -- the ban's `files` glob is narrower than the unit runner's -- ESCALATED

**Not fixed. This one needs a decision, not a patch.**

The finding is real and I reproduced its premise: `vitest.config.mts` collects
`{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}` while the ban
covers `**/*.spec.{ts,mts,cts}`, so `*.test.ts`, `*.spec.tsx` and `*.spec.cjs`
would run as unit tests with the ban silently off. Measured: zero such files
exist today, which is exactly why nothing would notice the first one.

Declined because the fix collides with two LOCKED decisions, and the hard
constraint on this task is to stop and report rather than proceed:

1. **D-16** pins the glob text verbatim -- `files: ['**/*.spec.{ts,mts,cts}']`
   with `ignores: ['**/*.integration.spec.{ts,mts,cts}']`. Widening to
   `**/*.{test,spec}.{ts,mts,cts,tsx}` changes the locked string. It arguably
   preserves D-16's *purpose* (the full extension set in BOTH globs, against the
   E5 inversion), but "the locked decision meant something broader than it says"
   is precisely the call a fixer should not make alone.
2. **D-19** enumerates exactly TWO invariants for the drift guard and explicitly
   excludes the unit-vitest include from comparison ("an equality assertion would
   be permanently red"). The reviewer's second half -- "add a drift assertion that
   the unit include's `{test,spec}` name set is covered" -- adds a THIRD invariant
   over the config D-19 deliberately left out.

**Recommended resolution:** take it to a discuss-phase decision on D-16/D-19
rather than a review fix. The cheap interim, if a decision is not wanted now, is
a one-line ceiling comment in `eslint.config.mjs` naming the uncovered naming
family -- which is D-21's own remedy for a known gap and needs no locked-decision
change. I did not add even that, because it belongs in the same decision.

### ME-05 -- undici 6.27.0 -> 6.28.0 consumer impact -- ASSESSED, no exposure

Per the task, treated as an assessment rather than a dependency change. No code
or lockfile touched.

**The delta is real.** `start-cache-server/index.js` (bundle) and
`package-lock.json` both carry undici 6.28.0, and the new
`processHeader` path throws `InvalidArgumentError` on an invalid header value
where 6.27.0 passed it through.

**The predicate is narrow.** `headerCharRegex = /[^\t\x20-\x7e\x80-\xff]/` --
it rejects only control characters (CR, LF, NUL and the rest of C0 except tab).
Tab, every printable ASCII character, and the high-byte range all pass.

**Nothing this action constructs can hit it:**

- The repo's own `fetch` call sites (`src/action/index.ts`,
  `src/backend/releases-backend.ts`) use Node's GLOBAL fetch -- node 24's
  built-in undici -- not the bundled copy. The bundled undici is reached only by
  `@actions/cache`'s internals.
- The header values in play on that path are `Authorization: Bearer <token>`,
  `content-type: application/octet-stream`, `application/json`, and the versioned
  GitHub API header. The only non-literal is the token, which is either a GitHub
  token or a runner-injected `ACTIONS_RUNTIME_TOKEN` -- base64url/JWT, printable
  ASCII by construction.
- The loopback bearer token (`randomBytes(32).toString('hex')`) is consumed by
  this repo's own `node:http` server, which reads `req.headers.authorization`
  directly. It never crosses undici's request path.

**Verdict: no reachable exposure.** Recorded here as a decision rather than left
as a side effect nobody looked at, which was the finding's actual ask. I did NOT
edit `07-EVIDENCE.md` -- that artifact belongs to the phase executor, and this
note is the reviewable record.

### Sub-items declined inside fixed findings

- **CR-01**: declined the reviewer's `createProjectGraphAsync` spec variant.
  Computing the Nx project graph from inside a `test`-target spec makes that
  spec's result depend on the whole workspace, which is a NEW stale-cache hole of
  exactly the LINT-04 class this phase exists to close -- plus a daemon
  dependency in a pure nx.json reader. The registration pin plus the CI
  success-line check cover the same ground without it. Also declined changing the
  root `lint` script to `nx run @op-nx/github-cache:lint`, which would deviate
  from D-32's locked text.
- **HI-02**: sites 1-3 argue "moving gains nothing" rather than "cannot move".
  The reviewer flags this as systemic and "worth a deliberate decision rather
  than four independent slides". Agreed, and left alone: it is a decision about
  how strictly LINT-06 is read, not a review fix.
- **ME-03**: declined adding the two ceiling shapes as `EVASION_SHAPES` rows with
  `expected: []`. That table's describe block renders each row as
  "catches `<shape>`", so a row asserting nothing is caught would read as the
  opposite of what it means. The ceiling comment satisfies D-21's literal ask.
- **ME-04**: declined the block-comment half. The stripper only removes lines
  whose trimmed form starts with `//`, so a `/* ... */` block quoting an
  `include: ['...']` line would survive. Latent (the file uses only `//`
  comments), and doing it right needs a parser rather than a second regex.
- **LO-02**: declined adding a
  `callee.property.name=/^(cwd|uptime|memoryUsage)$/` selector to make the claim
  true. CORR-06 is about the running MACHINE; the working directory is a property
  of the invocation. Widening the ban past its own requirement to justify a
  comment is the wrong direction -- the comment was what was wrong.

## Hard constraints, verified at HEAD

| Constraint | Verdict |
|---|---|
| All nine battery commands green at every commit, from the repo root | VERIFIED -- run per commit; `format:check`, `build`, `typecheck`, `typecheck:action`, `test`, `lint`, `fallow:ci`, `check:action`, `pack:check` |
| `packages/github-cache/package.json` byte-identical (D-06) | VERIFIED -- `git log 0ef4aad..HEAD --` empty, no diff |
| `public-surface.spec.ts` unchanged AND green | VERIFIED -- no diff; 13/13 pass |
| All four CORR-05 violation sites still in place | VERIFIED -- `cache-archive-path.spec.ts` (1), `releases-backend.spec.ts` (1), `release-asset-name.spec.ts` (2). Only site 4's disable COMMENT was edited |
| No mutation committed | VERIFIED -- every mutated file confirmed byte-identical after revert |
| `.planning/config.json` not committed | VERIFIED -- still modified and unstaged |
| ASCII only | VERIFIED |

Files changed across the range: `.github/workflows/ci.yml`, `eslint.config.mjs`,
`nx.json`, `src/lib/release-asset-name.spec.ts` (comment only),
`src/lint-rules.spec.ts`, `src/lint-scope-drift.spec.ts`,
`src/nx-target-inputs.spec.ts`. 7 files, +416 / -67.

## Notes for the next reader

- **`test` and `lint` hashes rotate** on this range (`nx.json` changed, and it is
  a `test` input). Legitimate, and consistent with D-36's pre-recorded rotation
  windows -- but it is a THIRD rotation on top of the two D-36 names, so Phase 9's
  OBS-04 tripwire should be authored with that in mind.
- **`ci.yml`'s lint job is no longer a bare `run:`.** It is a scripted step with
  `NO_COLOR: '1'`. The observation in 07-REVIEW.md that `ci.yml` is not an Nx
  input still stands -- PARITY-06 registers it in Phase 9, and this job's shape
  is now one more thing that file's future guard should cover.
- **`07-VERIFICATION.md` passed 22/22 and did not catch any of this.** The pattern
  is consistent: it verified that each guard PASSES and that each mutation it
  re-ran FAILS as recorded, which is verification against the guards' own claims.
  Every finding fixed here is a claim the guards did not make -- a gate that
  no-ops, an evasion shape not in the table, a comment asserting coverage the
  code lacks. Worth carrying into how the next phase's verification is scoped.

---

_Fixed: 2026-07-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
