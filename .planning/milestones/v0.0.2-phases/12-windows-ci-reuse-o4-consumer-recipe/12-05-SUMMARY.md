---
phase: 12-windows-ci-reuse-o4-consumer-recipe
plan: 05
subsystem: consumer-docs
tags: [DOCS-07, D-10, D-11, D-12, D-13, D-15, cross-os, drift-guard, nx-inputs]
requires:
  - '12-04: the single-sourced discriminator literal this doc renders byte-identically'
  - '08-ROOT-CAUSE.md Hand-off to Phase 12: checklist items 1-5, inherited rather than re-derived'
provides:
  - 'docs/cross-os.md -- the DOCS-07 consumer cross-OS adoption recipe, safe default first'
  - 'docs-cross-os.spec.ts -- single-sourced discriminator equality plus phrase-keyed order, arch/libc and item-count locks'
  - 'the nx.json test-input registration that stops the guard replaying a stale cached PASS'
affects:
  - '12-06: this plan rotates test only, so the pre-registered counts stay traceable to one edit class'
tech-stack:
  added: []
  patterns:
    - 'single-sourced doc equality: read the value from config, never re-spell it in the spec'
    - 'occurrence COUNT over toContain, and an EXACT count over a >= 1 floor'
    - 'measure every pinned phrase against the written file before committing the assertion'
key-files:
  created:
    - docs/cross-os.md
    - packages/github-cache/src/docs-cross-os.spec.ts
  modified:
    - nx.json
    - README.md
    - docs/advanced.md
    - packages/github-cache/src/nx-target-inputs.spec.ts
decisions:
  - 'the discriminator renders TWICE by design (config snippet + verification fence) and is pinned at exactly 2, because a >= 1 floor would have dropped the verification fence silently'
  - 'the plan acceptance one-liner for the five-item count is off by one: the section chunk includes its own numbered heading; the corrected form slices past the heading line'
  - 'the JSON fence stays comment-free and copy-pasteable; the three trap comments live in the adjacent verification fence, which is bash and takes # comments'
metrics:
  duration: 17min
  completed: 2026-07-30
status: complete
---

# Phase 12 Plan 05: The DOCS-07 Consumer Cross-OS Recipe Summary

`docs/cross-os.md` ships the safe-by-default cross-OS adoption recipe, renders the exact
discriminator `nx.json` declares at both of its two sites, is registered as a `test` input in the
same commit so its guard cannot replay a stale cached PASS, and is locked by a drift guard whose
every clause was observed failing for the right cause before it was allowed to pass.

## What shipped

Three commits, in the order the plan's TDD gate requires.

| Commit    | Type | What                                                                       |
| --------- | ---- | -------------------------------------------------------------------------- |
| `8abe25c` | test | the drift guard and the registration pin, authored RED                     |
| `6c0c2d1` | feat | the doc, its `nx.json` registration and both nav links, in ONE commit      |
| `e8faa6b` | test | the discriminator clause converted from a `>= 1` floor to an EXACT count   |

## Task 1: the OBSERVED RED, transcribed

`npx nx run @op-nx/github-cache:test --skip-nx-cache -- -t "cross-os"` exited non-zero.
`Tests 9 failed | 4 passed | 883 skipped (896)`. The FIRST failure is the named existence control,
not a module-load ENOENT -- the `existsSync` guard is what buys that:

```
FAIL  src/docs-cross-os.spec.ts > docs/cross-os.md exists at all (DOCS-07)
      > the cross-os recipe is on disk
AssertionError: docs/cross-os.md is missing. It is DOCS-07 itself -- the consumer
cross-OS adoption recipe -- and every other clause in this file reads it as an empty
string without this control.: expected false to be true
```

The remaining eight, each naming its own cause:

| Clause                                   | RED verdict                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| existence (Test 1)                        | `expected false to be true`                                              |
| one runtime discriminator (Test 2a)       | **PASSED** -- reads `nx.json`, not the doc                                |
| doc renders the command (Test 2b)         | `expected 0 to be greater than or equal to 1`                            |
| section order (Test 3)                    | `expected -1 to be greater than or equal to 0` (missing safe-default heading) |
| first numbered section (Test 4)           | `expected undefined to be '## 1. The safe default: ...'`                  |
| arch / libc / arm64 (Test 5)              | `expected '' to match /architecture[^.!?]{0,80}libc[^.!?]{0,80}arm64/i`   |
| five checklist items (Test 6)             | `expected [] to have a length of 5 but got +0`                           |
| README nav (Test 7a)                      | `expected '# @op-nx/github-cache...' to match /^- \[.+\]\(docs\/cross-os\.md\) -- /` |
| `docs/advanced.md` nav (Test 7b)          | `expected '# Advanced usage...' to contain 'cross-os.md'`                |
| `nx.json` registration (Test 8)           | `expected [ 'default', '^production', ...(25) ] to include '{workspaceRoot}/docs/cross-os.md'` |

**NOT ONE doc-reading clause passed trivially against the empty string.** That is a stronger
outcome than the plan anticipated and it is recorded as an outcome rather than a design claim: the
order clause was written to assert BOTH indices are `>= 0` before comparing them, which is exactly
what stops `-1 < -1` from reading as a satisfied comparison. The single trivial pass -- Test 2a --
is not trivial at all: it reads `nx.json`, which already declared exactly one runtime input, so its
green is the correct verdict about the source rather than a vacuous one about the doc.

The three other `cross-os`-matching specs in the tree (`dogfood-cross-os.spec.ts`,
`docs-same-os-claims.spec.ts`, `action/index.spec.ts`) stayed green throughout.

## Task 2: the doc, and the section headings actually written

Four numbered sections, in this order, measured out of the written file rather than transcribed
from the plan:

```
## 1. The safe default: declare the discriminator on every cacheable target
## 2. The portability checklist: how to EARN a removal
## 3. What `process.platform` does not cover
## 4. The one cross-OS hazard Nx already closes for you
```

Preceded by an unnumbered `## Single sources of truth` table whose one row sources the
discriminator to `nx.json`'s `targetDefaults.integration.inputs`, and by an intro in
`docs/trust-and-security.md`'s register that names the guard spec BY PATH and states that if the
document and the configuration disagree, the configuration wins.

**Section 2 has exactly five items and there is no sixth.** Item 6 of the source hand-off is
STRUCK and measured FALSE, and its own text says what to document instead: nothing. Nothing was
reconstructed and no reassurance about it was added -- a reassurance about a non-problem is worse
than silence.

**Section 3 is one sentence, not a bullet.** `process.platform` is an operating-system read and
nothing more; it does not cover CPU architecture and it does not cover libc, and this project
cannot exercise either, because every machine here is arm64. The three facts are RELATED in one
sentence, which is what the anchored regex asserts and what a three-way `toContain` would not.

**Why the trap comments are in the bash fence, not the JSON fence.** The plan asked for
`docs/advanced.md`'s reason-inside-the-fence habit. `nx.json` is strict JSON and holds no comments,
so a commented JSON fence would ship an adopter a snippet that does not parse where they are told
to paste it. The config fence therefore stays comment-free and copy-pasteable, and all three trap
comments -- (a) a node flag rather than a shell redirect, because Nx runs a runtime input through
exactly ONE shell per OS; (b) stderr is hashed concatenated with stdout and a node warning carries
the PID, so a warning is a permanent 100% MISS rather than a one-time rotation; (c) VERIFY a
non-empty token that DIFFERS across your operating systems, because this repo has a build-gating
two-leg comparison and an adopter has none -- live as `#` comments in the adjacent `bash`
verification fence, immediately above the command they annotate.

### The `nx.json` insertion index

`{workspaceRoot}/docs/cross-os.md` sits at **index 12** of `targetDefaults.test.inputs`,
immediately after `{workspaceRoot}/docs/configuration.md` (index 11) and before
`{workspaceRoot}/docs/advanced.md`. Verified by direct read:

```
node -e "...const b=i.indexOf('{workspaceRoot}/docs/cross-os.md');if(b!==a+1)throw..."
-> ok adjacent at 12
```

Explicit path, never a `docs/**` glob: `rg -c -F "{workspaceRoot}/docs/**" nx.json` exits 1. No
existing entry was reordered or reformatted -- `nx.json` is a `test` input, so an unrelated
reorder would be diff noise on a hash-rotating file.

### Nav

`README.md` gained ONE bullet in the shipped `- [Title](docs/x.md) -- <what it covers>` form,
placed between the Advanced usage and Trust and security bullets.
`docs/advanced.md` gained ONE sentence in the publish / sync section. `git diff HEAD --
docs/advanced.md | rg "^-"` returns only the diff header, so the edit is provably additive: no
existing sentence was reworded, and the file did not reacquire a same-OS-restore claim.

## Task 3, Check A: the phrase-count table

Every phrase the guard pins, measured against the written file. `rg -o | wc -l`, never `rg -c`,
which counts LINES rather than occurrences.

| Pinned phrase                                                                | File                | Measured | Asserted by                       |
| ---------------------------------------------------------------------------- | ------------------- | -------- | --------------------------------- |
| `node --no-warnings -p process.platform`                                      | `docs/cross-os.md`  | **2**    | occurrence COUNT, exact `toBe(2)` |
| `## 1. The safe default: declare the discriminator on every cacheable target` | `docs/cross-os.md`  | 1        | `indexOf` + `toBe` (first heading) |
| `## 2. The portability checklist: how to EARN a removal`                      | `docs/cross-os.md`  | 1        | `indexOf`                          |
| `/architecture[^.!?]{0,80}libc[^.!?]{0,80}arm64/i`                            | `docs/cross-os.md`  | 1        | `toMatch` (anchored same-sentence) |
| `^- \[.+\]\(docs/cross-os\.md\) -- `                                          | `README.md`         | 1        | `toMatch`                          |
| `cross-os.md`                                                                 | `docs/advanced.md`  | 1        | `toContain`                        |
| `{workspaceRoot}/docs/cross-os.md`                                            | `nx.json`           | 1        | `toContain`                        |

**No row has a count of 0**, so no clause is a silent false PASS in the additive direction.

**The one conversion, and it was needed.** The discriminator measured 2 -- line 39 (the
copy-pasteable config snippet) and line 75 (the bare command in the verification fence). The plan's
`<behavior>` specified `toBeGreaterThanOrEqual(1)`, and a `>= 1` floor is exactly as HALF-LOCKING
as the `toContain` it replaced: satisfied by the first occurrence, so deleting the second leaves
the guard green. The half it would have dropped is the verification fence -- the only control an
adopter has against T-12-09, a discriminator that silently collapses to one value. Converted to an
exact `toBe(2)` in commit `e8faa6b`, with the count comment-locked and the house rule stated (a
THIRD occurrence fails too, deliberately; update the count HERE in the same commit).

**A measurement caveat found while running Check A, worth carrying forward.** `rg -o | wc -l`
counts OUTPUT LINES, so a MULTI-LINE match inflates the count. The D-13 regex first reported 2;
`node`'s `String.match(...g)` reported 1, and printing the match showed ONE hit spanning a hard
wrap. `rg -o | wc -l` is the right counter for a single-line phrase and the WRONG one for a
multi-line pattern -- for those, count matches in the language, not lines in the output.

## Task 3, Check B: five MEASURED reds

Five mutations, five named failures, five reverts. Each mutation was applied by a scratchpad
script, the test run, the failure transcribed, and the file restored with
`git checkout -- <one file>`. `git status --porcelain` was confirmed clean after every revert.

**M1 -- swap section 1 with section 2 (whole blocks, not just headings):**

```
FAIL > docs/cross-os.md puts the safe default FIRST (D-11, cross-os section order)
     > the safe-default section precedes the portability checklist
AssertionError: docs/cross-os.md now leads with the portability checklist. D-11 fixes
the ORDER: a reader who stops after section one must land on the SAFE configuration,
because the unsafe one is a WRONG-RESULT risk rather than a performance one. Do not
reorder these two sections to read better.: expected 3341 to be less than 822
```

The companion clause fired too and says something different, which is why both exist:
`expected '## 2. The portability checklist: how ...' to be '## 1. The safe default: declare the d...'`.
`Tests 2 failed | 11 passed`. Nothing else moved -- the checklist itself was intact, so its
five-item clause stayed green, which is what makes this an ORDER red rather than a generic one.

**M2 -- remove the architecture token (`CPU architecture` -> `CPU width`):**

```
FAIL > docs/cross-os.md states the cross-os limits of the platform read (D-13)
     > relates architecture, libc and the arm64-only limit in one sentence
AssertionError: docs/cross-os.md no longer names architecture AND libc AND the
arm64-only limit in a single sentence. ... expected '# Cross-OS caching\n\nThis
document i...' to match /architecture[^.!?]{0,80}libc[^.!?]{0...
```

`Tests 1 failed | 12 passed` -- exactly one clause, so the D-13 lock is independently deletable.

**M3 -- delete checklist item 4:**

```
FAIL > docs/cross-os.md carries the five inherited checklist items (D-12)
     > the portability checklist has exactly five numbered items
AssertionError: the portability checklist in docs/cross-os.md no longer has exactly
five numbered items. Items 1-5 are INHERITED from 08-ROOT-CAUSE.md and are not
re-derived; item 6 there is STRUCK, was measured FALSE, and must not be
reconstructed.: expected [ '1. ', '2. ', '3. ', '5. ' ] to have a length of 5 but got 4
```

The received array naming the surviving markers is the useful half: a reader sees WHICH item went.
`Tests 1 failed | 12 passed`.

**M4 -- alter ONE character of the rendered discriminator, at the verification-fence site only
(`--no-warnings` -> `--no-warning`), leaving the config snippet intact:**

```
FAIL > docs/cross-os.md renders the discriminator nx.json declares (D-15)
     > the cross-os doc renders that exact command, byte for byte, at both sites
AssertionError: docs/cross-os.md must render the discriminator nx.json declares
(`node --no-warnings -p process.platform`) at BOTH sites: the copy-pasteable config
snippet AND the verification fence. ... expected 1 to be 2
```

**This is the mutation that proves the Check A conversion was load-bearing rather than tidy.**
Under the plan's `>= 1` floor this exact mutation returns 1, which satisfies the floor, and the
guard would have stayed GREEN with the doc telling an adopter to run a command node rejects. The
message names the value `nx.json` declares, interpolated from the config and never re-spelled in
the spec. `Tests 1 failed | 12 passed`.

**M5 -- delete the README Documentation bullet:**

```
FAIL > docs/cross-os.md is reachable (cross-os nav) > README.md links it from the
     Documentation list
AssertionError: README.md's ## Documentation list no longer carries a
`- [Title](docs/cross-os.md) -- <what it covers>` bullet. An unreachable recipe is
not a consumer deliverable.: expected '# @op-nx/github-cache\n\nA GitHub-bac...' to
match /^- \[.+\]\(docs\/cr.../cross-os\.md\) -- 
```

`Tests 1 failed | 12 passed`.

After all five reverts: `git status --porcelain` clean, and the full suite green (below).

## The D-15 sweep, with its positive control

Run in the corrected shape from PATTERNS M-1 -- `.planning/` and `.github/` are BOTH
dot-directories, so a bare traversal silently drops real sites and exits 0 while omitting them:

```
rg --hidden --glob '!.git' --glob '!.planning' -F "<literal>" .
```

| Literal                                       | Result                                    |
| --------------------------------------------- | ----------------------------------------- |
| `node --no-warnings -p process.platform` (new) | **11 occurrences** across 7 files, exit 0 |
| the pre-12-04 spelling (old)                   | exit **1** -- a GENUINE no-match          |

Eleven, not nine: this plan added the doc's TWO sites to 12-04's nine. The zero on the old literal
is trusted only because the positive control on the new literal ran in the identical command shape
and returned 11. Exit 1 is a genuine no-match; exit 2 would be a failed command that looks the
same in the output.

This SUMMARY does not reproduce the retired spelling, for the reason 12-04 recorded: a historical
citation is indistinguishable from a live spelling site to a mechanical sweep. `.planning/` is
excluded from the sweep in any case, so this is belt and braces rather than load-bearing here.

## Verification

| Gate                                          | Result                                        |
| --------------------------------------------- | --------------------------------------------- |
| full suite, `--skip-nx-cache`                  | **42 files passed (42), 896 tests passed (896)** |
| `-t "cross-os"`                                | 13 passed, exit 0                             |
| `-t "docs"`                                    | 35 passed, exit 0                             |
| `-t "governance"` (email allowlist-inversion)  | 4 passed, exit 0                              |
| `npm run typecheck`                            | `Successfully ran target typecheck`           |
| `npm run lint`                                 | `Successfully ran target lint`                |
| `npx nx format:check --all`                    | exit 0                                        |
| `npm run check:action` (MAIN tree)             | exit 0, no drift                              |
| `docs/cross-os.md` pure ASCII                  | `rg -c '[^\x00-\x7F]'` exits 1                |

The suite went 886 -> 896 tests and 41 -> 42 files: ten new assertions (nine in the new guard, one
registration pin), which is the correct delta for a plan that adds a guard.

**ROBUST-04 confirmed rather than assumed.** `npm run check:action` was run FROM THE MAIN WORKING
TREE, never a junctioned worktree (which reports a false 689-module drift). Exit 0, and
`start-cache-server/index.js` is in no commit of this plan. Expected twice over: this plan edits a
doc, a config list, two markdown files and two spec files, none of them reachable from `serve()`.

## Rotation this plan pays

| Edit                                | Rotates                                  |
| ----------------------------------- | ---------------------------------------- |
| `nx.json`                            | `test` (own input)                       |
| `docs/cross-os.md` (now registered)  | `test`                                   |
| `README.md`, `docs/advanced.md`      | `test`                                   |
| the two spec files                   | `test`, `typecheck`, `integration`       |
| `.planning/**`                       | nothing                                  |

`build` does NOT rotate: no non-spec source file under `packages/github-cache/src/` was touched.
That differs from 12-04, which rotated `build` via `hash-parity/compare.ts`.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] The plan's five-item acceptance one-liner is off by one**

- **Found during:** Task 2, running the acceptance criteria
- **Issue:** the criterion selects the checklist section with
  `d.split(/^## /m).find(x => /^\d+\..*(checklist|earn)/i.test(x))`. That `find` predicate only
  matches because the chunk STARTS with the section's own numbered heading -- so the heading line
  `2. The portability checklist: how to EARN a removal` is inside the chunk, and it matches the
  item counter `/^\d+\. /gm` too. The command therefore returns 6 for a correct five-item
  checklist, and is unsatisfiable for ANY five-item list under a numbered heading. Proven rather
  than argued: the matched markers print as `["2. ","1. ","2. ","3. ","4. ","5. "]` and the chunk's
  first line is the heading.
- **Fix:** the corrected form slices past the heading line before counting
  (`s.split('\n').slice(1).join('\n')`), and returns `five items`. The SPEC never had the bug --
  it slices from `indexOf(CHECKLIST_HEADING) + heading.length`, so it measured 5 from the start,
  and mutation M3 confirms it fires at 4.
- **Files modified:** none (an acceptance-command correction, recorded here)
- **Commit:** n/a

**2. [Rule 2 - Missing critical guard] The `>= 1` discriminator floor was half-locking**

- **Found during:** Task 3, Check A
- **Issue:** the plan specified `toBeGreaterThanOrEqual(1)` for the discriminator occurrence count.
  Measured, the command renders TWICE, and a floor is satisfied by the first occurrence -- which is
  the precise defect (WR-09 / PATTERNS S-6) the count was introduced to fix. Task 3's own
  acceptance criterion requires any phrase measured at 2 or more to be asserted by COUNT.
- **Fix:** converted to an exact `toBe(2)` behind a named constant, with the two sites and the
  third-occurrence rule comment-locked. Mutation M4 measures the difference: altering one site
  returns 1, which the floor accepted and the exact count rejects.
- **Files modified:** `packages/github-cache/src/docs-cross-os.spec.ts`
- **Commit:** `e8faa6b`

**3. [Rule 3 - Blocking] The trap comments could not go inside the JSON fence**

- **Found during:** Task 2, writing the doc
- **Issue:** the plan asks for `docs/advanced.md`'s comments-inside-the-fence habit for the
  discriminator snippet. `docs/advanced.md`'s fences are YAML, which takes `#` comments; the
  discriminator snippet is `nx.json` configuration, and `nx.json` is strict JSON. A commented JSON
  fence would ship an adopter a snippet that does not parse where they are told to paste it, and
  prettier formats `json` fences in markdown, so it would also have to be `jsonc` -- which is not
  what `nx.json` is.
- **Fix:** the config fence stays comment-free and copy-pasteable; all three trap comments live as
  `#` comments in the adjacent `bash` verification fence, immediately above the command they
  annotate. Both fences carry the discriminator, which is why its measured count is 2.
- **Files modified:** `docs/cross-os.md`
- **Commit:** `6c0c2d1`

### Not a deviation, recorded so it is not read as one

The plan's Task 1 asked for TWO `it`s in `nx-target-inputs.spec.ts`, the second being the
detector-workflow pin "if not already present from plan 12-01". It IS already present
(`nx.json declares the windows-regression-detector workflow as a test input`), so ONE `it` was
added. The conditional resolved to its no-op branch.

## What this plan explicitly does NOT close

**Whether the recipe is CORRECT and safe for a consumer to copy.** The guard proves the doc SAYS
the right things; only `/gsd:code-review` proves it MEANS them. Surfaced as a review item, not as
covered -- the plan states this in its own verification block and it is repeated here so a
verifier does not read a green guard as a review verdict.

## GSD tooling defects, all four reproduced as briefed

1. **`requirements.mark-complete` NOT called.** Traceability is closed once by the orchestrator's
   `phase.complete` step after the verifier runs. Verified:
   `git diff --stat 0251bd3 HEAD -- .planning/REQUIREMENTS.md` is EMPTY.
2. **`roadmap.update-plan-progress` fired both defects.** It injected a duplicate bare plan list
   (count 6 -> 12) and re-mangled the progress-table cell to `| 4/6 | In Progress|  |`. Both
   repaired by hand: `rg -c "12-0[1-6]-PLAN.md"` is back to exactly 6 with 12-01..12-05 as `[x]`,
   and the cell reads `| 5/6 | In Progress | - |`. The injected list is the BARE one; the
   descriptive list is canonical and is what was kept.
3. **`state.add-decision` injected a `[Phase ?]` marker**, corrected to `[Phase 12]`. No em dash
   was injected (the decision text is pure ASCII):
   `rg -c '[^\x00-\x7F]' .planning/STATE.md` returns **13**, unchanged.
4. **`state.record-metric` rejects the positional form** the executor spec prescribes. Used named
   flags: `--phase 12 --plan 05 --duration 17min --tasks "3 tasks" --files "6 files"`. It then
   appends its own units, producing `3 tasks tasks | 6 files files`; corrected by hand to match
   the P02/P03 rows.

`state.update-progress` also recomputed `completed_plans` 36 -> 37 in the frontmatter. The prose
`Progress: 4/6 phases complete` line is PHASE-level and was left untouched, which is correct --
phase 12 is not complete.

## Self-Check: PASSED

- `docs/cross-os.md` exists on disk; `packages/github-cache/src/docs-cross-os.spec.ts` exists on disk.
- `.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-05-SUMMARY.md` exists on disk.
- All three commit hashes (`8abe25c`, `6c0c2d1`, `e8faa6b`) resolve in `git log`.
- `git show --stat 6c0c2d1` lists exactly four files: `docs/cross-os.md`, `nx.json`, `README.md`,
  `docs/advanced.md`.
- This SUMMARY is pure ASCII.

## Threat Flags

None. The delta is one consumer-facing document, one `nx.json` input line, two nav links and two
spec files: no credential, no write path, no code path, no package, no network egress.

- **T-12-08 (a doc telling an adopter to do something unsafe)** -- mitigated BY DESIGN and the
  control is MEASURED, not asserted: D-11's order is pinned by index comparison and mutation M1
  reddens it. The doc recommends no fork-PR write token and frames retention nowhere.
- **T-12-09 (an adopter's discriminator collapsing to one value)** -- the verification fence tells
  the adopter to confirm a NON-EMPTY token that DIFFERS across their operating systems, and says
  plainly that this repo has a build-gating two-leg comparison and they do not. That fence is now
  pinned by an exact count precisely so it cannot be deleted silently.
- **T-12-18 (a doc guard replaying a stale cached PASS)** -- `docs/cross-os.md` is an `nx.json`
  `test` input registered in the SAME COMMIT as the doc, pinned by a literal in
  `nx-target-inputs.spec.ts`, with the dependency stated in the guard's own docstring.
- **T-12-19 (a contact address in committed content)** -- no contact address of any kind in the new
  doc; `-t "governance"` green.
- **T-12-04 (`$GITHUB_ENV` writes)** -- CHECKED and clear: this plan writes no workflow YAML and the
  doc contains no `$GITHUB_ENV` line.
- **T-12-SC (package installs)** -- CHECKED and clear: no `package.json` and no `package-lock.json`
  in the changeset, nothing installed.
