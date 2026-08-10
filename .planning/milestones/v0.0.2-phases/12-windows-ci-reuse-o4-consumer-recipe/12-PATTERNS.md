# Phase 12: Windows CI Reuse (O4) + Consumer Recipe - Pattern Map

**Mapped:** 2026-07-30
**Files analyzed:** 12 (3 created, 9 modified)
**Analogs found:** 12 / 12 (every file has an in-repo analog; nothing falls back to RESEARCH.md's
generic examples)

All line numbers in this file were RE-RESOLVED against the working tree on 2026-07-30. `ci.yml` is
1736 lines; every reference below is anchored to a JOB NAME or a quoted phrase as well as a line
number, so a plan can re-locate it after the first edit shifts everything.

---

## Two measurements taken while mapping that change what the planner writes

These are not pattern notes. They correct a specific instruction in CONTEXT/RESEARCH, so they lead.

### M-1: `rg` without `--hidden` SILENTLY DROPS `.github/` from the 9-site discriminator sweep

RESEARCH's site table (`12-RESEARCH.md` `## Every site the string change touches`) states the sweep
command as:

```
rg -n "node -p process.platform" --glob '!node_modules' --glob '!.nx' .
```

MEASURED this session, the same command with and without `--hidden`:

| Invocation | Sites returned | `.github/workflows/ci.yml:387` present? |
|---|---|---|
| `rg -n -F "node -p process.platform" --glob '!node_modules' --glob '!.nx' --glob '!.planning' .` | 7 | **NO** |
| same plus `--hidden --glob '!.git'` | 8 | YES |

`.github` is a dot-directory, and ripgrep skips hidden entries during TRAVERSAL by default. Exit
code was 0 in both cases, so nothing signalled the omission. RESEARCH's table happens to list
`ci.yml` anyway (row 8), so the record is correct -- but an executor who RE-RUNS the documented
sweep to confirm completeness will get a 7-site answer that agrees with itself and miss the
`ci.yml` comment.

**Instruction for the plan:** the sweep command is
`rg -n -F --hidden "node -p process.platform" --glob '!node_modules' --glob '!.nx' --glob '!.git' .`
Or use `git grep -n -F` (tracked-only, but `.github/` IS tracked, so it does not have this hole).

### M-2: the multi-target success LINE, source-traced -- and the naive needle is VACUOUS

RESEARCH Assumption A2 ("MEDIUM -- measure it") is now settled from installed Nx source, not from a
run. `node_modules/nx/dist/src/tasks-runner/life-cycles/formatting-utils.js:22-55`:

```javascript
function formatTargetsAndProjects(projectNames, targets, tasks) {
    // ...
    targets = targets.filter((t) => tasksTargets.has(t)); // filter out targets that don't exist
    projectNames = projectNames.filter((p) => tasksProjects.has(p)); // filter out projects that don't exist
    if (targets.length === 1) {
        targetsText = `target ${output_1.output.bold(targets[0])}`;
    }
    else {
        targetsText = `targets ${targets.map((t) => output_1.output.bold(t)).join(', ')}`;
    }
    if (projectNames.length === 1) {
        projectsText = `project ${projectNames[0]}`;
    }
    // ...
    return `${targetsText} for ${projectsText}${dependentTasksText}`;
}
```

`output.bold` is `pc.bold` (picocolors) -- `node_modules/nx/dist/src/utils/output.js:50` -- which
honours `NO_COLOR`.

Four consequences, and the second is the load-bearing one:

1. **The exact expected line** for `nx run-many -t build typecheck test` on this ONE-project
   workspace, with `NO_COLOR=1`:
   `Successfully ran targets build, typecheck, test for project @op-nx/github-cache`
   Plural `targets`, comma-space separated, order = the `-t` argument order, one project by name (2+
   projects would render `N projects` instead). No ` and N tasks it depends on` suffix, because
   `build` is itself in the `-t` list so it is not counted as a dependent task.
2. **`grep -q 'Successfully ran target' detector.log` -- RESEARCH's own Code Example needle -- is
   VACUOUS for three targets.** Line 37 filters out any target that resolved NO task, so if
   `typecheck` silently stopped resolving, the line becomes
   `Successfully ran targets build, test for project ...` and STILL contains the needle. The lint
   job's needle works only because it names its target (`Successfully ran target lint`). A
   three-target guard must name all three, or run three steps.
3. **`NO_COLOR: '1'` is MORE load-bearing here than in `lint`, not less.** Each target name is
   bolded INDIVIDUALLY and the `, ` separators are not, so with colour on the line carries three
   escape-sequence pairs interleaved with the commas. A plain-text match against the combined phrase
   cannot fire.
4. `formatTargetsAndProjects` is JS, not the Rust addon. `rg -a -l "Successfully ran target"
   node_modules/` returns exit 1 (genuine no-match, positive control passed) because the string is
   assembled at runtime -- do not read that zero as "the phrase does not exist".

**Instruction for the plan.** Two shapes are correct; pick one and say why. Both are strictly
stronger than RESEARCH's example:

- (a) ONE command, needle names all three in order:
  `grep -q 'Successfully ran targets build, typecheck, test for project' detector.log`
  Lazier (one graph load, one step). Costs: the needle pins the `-t` ARGUMENT ORDER too, so
  reordering the flags reddens a correct run.
- (b) THREE steps, each the lint job's exact shape with a single-target needle
  (`Successfully ran target build for project`, etc.). More YAML, but each target gets its own red
  step name and no ordering is pinned. This is the shape that matches the repo's
  "a distinct named thing per concern" convention.

Either way: OBSERVE THE RED (D-14). Delete one target from the `-t` list, confirm the named
assertion fails, revert.

---

## File Classification

| New/Modified file | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|
| `.github/workflows/ci.yml` -- 3 new jobs `build-windows` / `typecheck-windows` / `test-windows` | config (CI job) | batch / producer-consumer | `ci.yml` `test` job (`:339-384`) for the block; `dogfood-seed` -> `dogfood-verify` (`:1266`, `:1289`) for the `needs:` edge; `integration` (`:416`) for the windows-11-arm facts | exact (3-way composite) |
| `.github/workflows/ci.yml` -- sidecar invariant comment (`:292-303`) | config comment | n/a | itself; correction discipline from `docs-same-os-claims.spec.ts` rows 2-3 | exact |
| `.github/workflows/ci.yml` -- graph-premise comment block (`:1047-1064`) | config comment | n/a | `docs-same-os-claims.spec.ts` row 4 (XOS-07): correct-the-claim-plus-replacement-reason | exact |
| `.github/workflows/<detector>.yml` (NEW) | config (CI workflow) | batch / scheduled | `.github/workflows/cleanup.yml` (whole file) + `ci.yml` `lint` job step (`:66-72`) | exact (2-way composite) |
| `nx.json` -- 2 new `test` inputs + `integration` runtime value | config | n/a | its own `targetDefaults.test.inputs` list (`:50-88`) | exact |
| `docs/cross-os.md` (NEW) | doc (consumer-facing) | n/a | `docs/trust-and-security.md` (intro + numbered sections + single-source table); `docs/advanced.md` (voice, fenced YAML with inline trap comments) | exact |
| `packages/github-cache/src/docs-cross-os.spec.ts` (NEW, or a `docs-adoption.spec.ts` extension) | test | file-I/O | `docs-trust.spec.ts` (single-source equality); `docs-same-os-claims.spec.ts` (phrase-keyed + occurrence COUNT); `docs-adoption.spec.ts` (presence + registration header) | exact (3-way composite) |
| `packages/github-cache/src/dogfood-cross-os.spec.ts` -- new describe for the 3 Windows jobs | test | file-I/O | its own `o3-witness` describe (`:283-546`) | exact |
| `packages/github-cache/src/dogfood-cross-os.spec.ts` -- new describe for the detector workflow | test | file-I/O | `packages/github-cache/src/cleanup/cleanup-workflow.spec.ts` (whole file) | exact |
| `packages/github-cache/src/nx-target-inputs.spec.ts` `:400`, `:446` | test | n/a | itself (both literals already in the shape they must keep) | exact |
| `packages/github-cache/src/hash-parity/compare.spec.ts` `:99`, `:281`; `compare.ts:9`; `eslint.config.mjs:437`; `ci.yml:387` | test fixture + comments | n/a | themselves | exact |
| `capture-hashes.mjs` `:90-96` and `:629-637` | config comment + message string | n/a | itself | exact |
| `.planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md` -- fill RESERVED, update table `:34` | doc artifact | n/a | its own O1/O2/O3 sections and the 4-row table it lives in | exact |
| `.planning/phases/10-os-invariant-releases-mirror/10-SECURITY.md` (Q1) and/or `.planning/THREAT-MODEL.md` | doc artifact | n/a | `10-SECURITY.md:132-140` -- the paragraph that explicitly invites this append | exact |

---

## Pattern Assignments

### `.github/workflows/ci.yml` -- the three new Windows jobs (config, producer-consumer)

**Analogs, in the order the executor uses them:**
1. `ci.yml` `test` job, `:350-384` -- the sidecar block to COPY VERBATIM.
2. `ci.yml` `dogfood-seed` -> `dogfood-verify`, `:1266` / `:1289-1321` -- the `needs:` edge.
3. `ci.yml` `integration`, `:386-415` -- the recorded windows-11-arm facts (read the comment; copy
   nothing).

#### The sidecar block, quoted VERBATIM from the `test` job (`ci.yml:350-384`)

This is the COMMENT-FREE copy. `typecheck`'s executable lines are byte-identical but it carries the
12-line invariant comment above it (see the next subsection), and `build`'s copy carries the full
inline trap notes. Copy THIS one, three times, changing only the final `npm run <target>` line.

```yaml
      # Sidecar dogfood block -- see the build job above.
      - name: Pre-set the Nx cache client vars for the sidecar
        shell: bash
        run: |
          set -euo pipefail
          echo "NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:3000" >> "$GITHUB_ENV"
          token="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
          echo "::add-mask::${token}"
          echo "NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=${token}" >> "$GITHUB_ENV"
      - uses: ./start-cache-server
        id: cache-server
        background: true
        with:
          port: '3000'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Wait for the loopback sidecar
        shell: bash
        run: |
          set -euo pipefail
          auth="Authorization: Bearer ${NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN}"
          code=000
          for _ in $(seq 1 30); do
            code=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' -H "${auth}" "${NX_SELF_HOSTED_REMOTE_CACHE_SERVER}/v1/cache/deadbeef" || true)
            if [ "${code}" = "404" ] || [ "${code}" = "200" ]; then
              break
            fi
            sleep 1
          done
          if [ "${code}" != "404" ] && [ "${code}" != "200" ]; then
            echo "sidecar not ready on ${NX_SELF_HOSTED_REMOTE_CACHE_SERVER} after 30 attempts (last status ${code}, wanted 404 or 200)" >&2
            exit 1
          fi
      - run: npm run test
      - cancel: cache-server
```

And the four steps that precede it in every one of the four wired jobs (`test`: `:343-349`):

```yaml
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with:
          node-version-file: '.node-version'
          cache: 'npm'
      - run: npm ci
```

**MIRROR:** every executable line, character for character. `shell: bash` on both scripted steps.
`node -e ... randomBytes(32)` for the token. `::add-mask::` STRICTLY BEFORE the `$GITHUB_ENV` write
(T-12-05: reordering those two lines is a real secret leak, because `entry.ts`'s `core.setSecret`
only redacts once the action step starts). `port: '3000'` unchanged (D-04). `- cancel: cache-server`
as the last step.

**DO NOT COPY:** `build`'s inline trap comments (`:209-215`, `:229-232`) and `typecheck`'s invariant
comment. Those live ONCE each, by the invariant's own words: "only build's copy carries extra
comments".

**DO NOT ADD:** an `if:` on any of the three. VERIFIED this session -- `build` (`:207`),
`typecheck` (`:281`) and `test` (`:339`) carry NO job-level `if:`, which is exactly what makes them
PR-eligible and therefore what makes D-18's proving-run vehicle work.

**Header shape, verbatim from `test` (`:339-343`), with the D-02/D-05 additions:**

```yaml
  test:
    runs-on: ubuntu-24.04-arm
    # Generic hang insurance -- see the build job.
    timeout-minutes: 15
    steps:
```

So each Windows leg is: job key, the `needs:` comment + value, `runs-on: windows-11-arm`, the
`# Generic hang insurance -- see the build job.` line verbatim, `timeout-minutes: 15`, `steps:`.

#### The `needs:` edge -- shape quoted from `dogfood-verify` (`ci.yml:1320-1321`)

```yaml
    if: github.event_name == 'push'
    needs: dogfood-seed
```

The relevant fact is the FORM: a bare scalar `needs: <one-job-name>` at four-space indent, not a
list. `dogfood-verify` is the only job in the file whose `needs:` names exactly one producer;
`publish` uses a list (`needs: [build, typecheck, test, integration]`) and `o3-witness` uses
`needs: integration`.

**Anchor that matters for the guard:** `dogfood-cross-os.spec.ts` matches `needs:` at FOUR spaces
(`/^ {4}needs: integration$/m`). The three new legs must therefore put `needs:` at four spaces --
which is automatic if the header shape above is followed.

**DO NOT COPY from `dogfood-seed` / `dogfood-verify`:**
- The `if: github.event_name == 'push'` gate. Both dogfood jobs carry it; the Windows legs must NOT
  (see above -- it would make the D-18 PR proving run impossible).
- The two-leg `matrix` on `dogfood-verify`. D-02 forecloses a matrix structurally.
- **The "add a Windows leg" instinct.** `dogfood-seed` is ubuntu-ONLY BY DESIGN and its VACUITY
  CONDITION comment (`ci.yml:1299-1307`) says why: its key is `nx-cache-<GITHUB_RUN_ID>`, ONE key
  per RUN not per OS, so a Windows seed leg would make the Windows verify leg restore a
  Windows-written entry and pass with cross-OS restore completely dead. That reasoning is about a
  RUN-ID key and does NOT transfer to the new legs (whose key is `nx-cache-<hash>`), so do not
  import it -- and equally, do not let anyone "fix the asymmetry" by adding a `dogfood-seed` Windows
  leg while they are in this file.

#### The windows-11-arm facts -- read `ci.yml:386-415` (the `integration` comment), copy nothing

The two facts the new legs depend on, in the comment's own words (`:402-408`):

> This job carries the same sidecar dogfood block as build/typecheck/test (see the build job for the
> full rationale), and it is the reason that block declares `shell: bash` everywhere: GitHub's
> DEFAULT shell on windows-11-arm is pwsh, which fails on $GITHUB_ENV, $(...), seq and [ ... ]. For
> the same reason the loopback token comes from node rather than openssl, which may be absent from
> the Windows runner's Git Bash while node is guaranteed after setup-node (curl and Git Bash
> themselves are both present on the Windows runner).

**VERIFIED this session (RESEARCH A3 confirmed from source):** the `integration` job's sidecar block
(`:456-490`) is byte-identical to `test`'s. The block needs NO Windows adaptation.

**SAY EXPLICITLY IN THE PLAN THAT `integration` IS NOT THE WIRING PRECEDENT.** A reader arriving at
`ci.yml` sees the only existing two-OS Nx-target job and will reach for its matrix. XOS-08 and
CONTEXT D-02 both foreclose it, for two different reasons that must both be written down:
`needs:` is per-JOB and never per-LEG (so a matrix cannot express XOS-08 at all), AND
`integration`'s two legs compute DIFFERENT hashes because of the platform discriminator, so
parallelism is harmless there and lethal here.

#### The `needs:` comment -- what it must and must NOT say

PROJECT.md locks "cross-OS sharing rests on target platform-agnosticism, NEVER on publish-leg
ordering", and XOS-06 forbids ordering becoming a correctness control. The comment must read as
producer-to-consumer for HIT-ability. The in-repo precedent for this exact distinction is the
`publish` job's `max-parallel: 1` reason, comment-locked in
`dogfood-cross-os.spec.ts:194-204`: "Two things rest on it and NEITHER is a correctness control
(XOS-06) ... That is a guard's SENSITIVITY, never a wrong-result guarantee". Mirror that register.

---

### `.github/workflows/ci.yml` -- the sidecar invariant comment (config comment)

**Analog:** itself. Quoted VERBATIM as it stands, `ci.yml:292-303` (above the `typecheck` job, and
this is its ONLY occurrence -- `rg -o -F "all four wired jobs" | wc -l` = 1, so a single edit closes
it and no WR-09 count-assertion is needed):

```yaml
      # Sidecar dogfood block. Rationale, and the traps it avoids, are documented
      # once above the build job (whose copy also carries the inline trap notes).
      # The EXECUTABLE shell must stay identical across all four wired jobs -- only
      # the final `npm run <target>` line may differ, and only build's copy carries
      # extra comments. Keep it that way, so the windows-11-arm integration leg
      # never drifts from the others. This is an unguarded invariant: nothing fails
      # if it drifts. CORRECTED, and the replacement fact rather than a bare deletion:
      # this note used to say ci.yml was NOT in nx.json's test inputs, so such a guard
      # would first need it registered there. PARITY-08 registered it (nx.json:69), and
      # dogfood-cross-os.spec.ts and docs-same-os-claims.spec.ts now both assert on this
      # file, so the precondition is already met -- only the drift guard itself would be
      # new work. cleanup-workflow.spec.ts remains the precedent for the shape.
```

**MIRROR:** the CORRECTED-plus-replacement-fact register in the second half. That is the house form
this phase uses three more times (D-21 twice, and the threat-model append).

**THE COUNT, and it is NOT the obvious one -- MEASURED this session.** The sidecar step
`- name: Pre-set the Nx cache client vars for the sidecar` occurs **FIVE** times today
(`ci.yml:224` build, `:304` typecheck, `:351` test, `:456` integration, `:1390` consumer-smoke), but
the invariant says "four WIRED jobs". The fifth copy is in `consumer-smoke`, which drives a scripted
PUT/GET rather than an Nx target and is deliberately outside the invariant. After this phase:
**SEVEN wired** (build, typecheck, test, integration, build-windows, typecheck-windows,
test-windows) and EIGHT total copies. A plan that writes "five copies become eight" is describing a
different set than the invariant governs. Update the number AND enumerate the seven job names, per
D-03.

**DO NOT:** weaken the invariant to accommodate three more copies, and do not add the deferred
block-drift guard (an explicit Deferred Idea; `12-RESEARCH.md`'s test map says "Do NOT add it").

---

### `.github/workflows/ci.yml` -- the graph-premise comment block (config comment)

**Location:** `ci.yml:1047-1064`, immediately above the step at `:1065`. RE-RESOLVED; CONTEXT cites
`:1047-1064` and it is still correct.

The step it annotates, quoted (`:1065-1072`) -- this stays EXACTLY as-is (D-21: keep the code):

```yaml
      - name: Assert the TEST-08 graph premise on this runner
        shell: bash
        env:
          NX_DAEMON: 'false'
          PREMISE: graph-premise-${{ matrix.os }}.json
        run: |
          set -euo pipefail
          node capture-hashes.mjs --assert-graph-premise --out "$PREMISE"
```

The comment sentence D-21 targets (`:1056-1058`):

```yaml
      # runs on BOTH matrix legs, which is the point -- the premise it asserts is about
      # the WINDOWS leg's resolved graph (D-12, D-14 row 1), so a ubuntu-only check would
      # assert it on the wrong runner.
```

**Analog for HOW to rewrite it:** `docs-same-os-claims.spec.ts` row 4, whose docstring
(`:146-161`) states the discipline better than any paraphrase:

```typescript
     * ... So a bare DELETION of the old argument would leave a future reader
     * holding a documented case for narrowing `needs:` straight back -- which is exactly
     * how Phase 9 shipped a regression. This row therefore requires the REPLACEMENT
     * REASON to be PRESENT: the mechanism, the bounded failure mode if that mechanism is
     * ever wrong, and the run id the widening is justified by.
```

**MIRROR:** three components in the replacement text -- (a) what the assertion still guards (the
graph property, against an Nx upgrade changing the inferred `dependsOn`), (b) what it no longer
establishes (producer attribution), (c) where the attribution record is FROZEN
(`11-EVIDENCE.md`'s O1 section).

**DO NOT:** delete the step, delete the `--assert-graph-premise` mode, or add an every-commit Vitest
version of it (revisited and DECLINED in CONTEXT's Deferred Ideas).

---

### `.github/workflows/<detector>.yml` (NEW) -- config, scheduled batch

**Analog 1:** `.github/workflows/cleanup.yml`, quoted in full (47 lines; this is the whole
skeleton). Note the header comment records WHY it is a separate file, which is exactly what D-08
needs:

```yaml
name: Cleanup mirror

# Age-based prune of the GitHub Releases cache mirror (RETAIN-03/D-09). This is a
# SEPARATE scheduled workflow, never a job inside ci.yml and never a publish matrix
# leg: a single scheduled job is a single cleanup writer BY CONSTRUCTION -- no env
# gate, no OS expression, no concurrent-delete race -- and it honors the retention
# TTL on a calendar cadence even while the repo is idle.
on:
  # Once daily, off the top of the hour: GitHub delays scheduled runs under
  # top-of-hour load, and cleanup has no deadline, so an off-peak minute is fine.
  schedule:
    - cron: '17 3 * * *'

# Least privilege (RETAIN-03/T-04-15): the delete path needs ONLY contents:write on
# the same repo (Releases assets live under contents). No actions:read -- cleanup
# lists no Actions caches. No personal token and no package-delete scope. The
# job-scoped GITHUB_TOKEN is the only credential.
permissions:
  contents: write

# Single-writer serialization (T-04-16/D-09): all runs of this workflow share one
# concurrency group so at most one cleanup runs at a time. cancel-in-progress is
# FALSE -- a queued run waits for the active one instead of cancelling it, because a
# cleanup cancelled mid-delete is unsafe. Queue, never cancel.
concurrency:
  group: github-cache-cleanup
  cancel-in-progress: false

jobs:
  cleanup:
    runs-on: ubuntu-24.04-arm
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with:
          node-version-file: '.node-version'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: node packages/github-cache/dist/cleanup/index.js
        env:
          # Same-repo contents:write token, passed by process inheritance (no
          # personal token, RETAIN-03). resolveGitHubToken reads GH_TOKEN || GITHUB_TOKEN.
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # Overridable retention window (D-07); resolveMaxAgeDays defaults to 30
          # days and clamps to a 365-day ceiling when this is unset or invalid.
          CACHE_MIRROR_MAX_AGE_DAYS: ${{ vars.CACHE_MIRROR_MAX_AGE_DAYS }}
```

**MIRROR:** `name:` at the top; a rationale comment block IMMEDIATELY under it recording why the
concern is not a `ci.yml` job; a comment above `cron:` giving the off-the-hour reason in the same
words ("GitHub delays scheduled runs under top-of-hour load"); one job; the four-step
checkout/setup-node/`npm ci` prelude byte-identical.

**DO NOT COPY:**
- `permissions: contents: write`. RESEARCH Pattern 2 is explicit: the detector needs FEWER
  permissions. Omit the block entirely and inherit the workflow default, or state
  `permissions: contents: read`. It writes nothing.
- The `concurrency:` block. `cleanup.yml` needs single-writer serialization because concurrent
  DELETES are unsafe. The detector deletes nothing and writes nothing; two overlapping runs are
  harmless. Adding it would be an unrequested mechanism.
- `- run: npm run build` as a separate step. The detector's `nx run-many -t build typecheck test`
  IS the build.
- `cleanup.yml` carries `schedule:` ONLY, no `workflow_dispatch` (VERIFIED, `:8-12`). D-08 ADDS
  `workflow_dispatch` deliberately -- keep it, but per RESEARCH Correction 2 its justification is
  "on-demand re-run AFTER merge", never "closes the question before merge".

**Analog 2:** the `lint` job's demand-the-success-LINE step, quoted VERBATIM (`ci.yml:66-72`) with
the comment that makes `NO_COLOR` non-negotiable (`:46-61`):

```yaml
      # Exit 0 is NOT sufficient here, and that is the whole reason this is a
      # scripted step rather than `- run: npm run lint`. `npm run lint` is
      # `nx run-many -t lint`, and run-many with no matching target ANYWHERE
      # prints "NX No tasks were run" and exits 0 (measured). ...
      #
      # NO_COLOR is load-bearing, not tidiness. With colour on, Nx bolds the
      # target name mid-phrase -- "ran target <esc>[1mlint<esc>[22m for project"
      # -- so the plain-text match never fires and the check fails on every run
      # including the good ones. A gate that always fails gets deleted just as
      # fast as one that never fires.
      - name: Lint, and prove the lint target actually ran
        env:
          NO_COLOR: '1'
        run: |
          set -euo pipefail
          npm run lint 2>&1 | tee lint.log
          grep -q 'Successfully ran target lint' lint.log
```

**MIRROR:** `env: NO_COLOR: '1'` at step level; `set -euo pipefail`; `2>&1 | tee <name>.log`;
`grep -q '<needle>' <name>.log` as the SECOND signal after the exit code. Note the shipped `ci.yml`
uses `grep` INSIDE a workflow -- that is runner-side POSIX and is CORRECT; the project's
never-use-grep rule governs the AGENT's own shell, not workflow bodies.

**ADAPT, per M-2 above:** the needle. `Successfully ran target lint` names its one target; a
three-target needle must name all three (or use three steps). Do not carry
`grep -q 'Successfully ran target'` across -- it is vacuous for a multi-target run.

**Also put HERE, not in a distant rationale (CONTEXT `<specifics>`, RESEARCH Pitfall 4):** XOS-05's
own sentence -- the success signal for O4 (every target `[remote cache]`, wall time collapsing to
sidecar overhead) is the IDENTICAL observation to a Windows-only regression being invisible forever.
A green O4 leg IS a Windows leg that did not run the code. That sentence is the detector's entire
justification and belongs in its header comment.

**NO sidecar block in this file** (D-08). `--skip-nx-cache` skips read AND write at Nx 23.1.0
(RESEARCH F-6), so a cache server would be dead weight and an extra producer.

---

### `nx.json` -- 2 new `test` inputs + the `integration` runtime value (config)

**Analog:** its own `targetDefaults.test.inputs` array, quoted with the exact insertion points
(`nx.json:50-72`, the string-literal region; the object-form entries follow at `:73-87`):

```json
      "inputs": [
        "default",
        "^production",
        "{workspaceRoot}/SECURITY.md",
        "{workspaceRoot}/LICENSE",
        "{workspaceRoot}/package.json",
        "{workspaceRoot}/nx.json",
        "{workspaceRoot}/eslint.config.mjs",
        "{workspaceRoot}/tools/eslint-rules/**/*",
        "{workspaceRoot}/start-cache-server/action.yml",
        "{workspaceRoot}/start-cache-server/entry.ts",
        "{workspaceRoot}/README.md",
        "{workspaceRoot}/docs/configuration.md",
        "{workspaceRoot}/docs/advanced.md",
        "{workspaceRoot}/docs/trust-and-security.md",
        "{workspaceRoot}/docs/versioning.md",
        "{workspaceRoot}/docs/examples/minimal-ci.yml",
        "{workspaceRoot}/docs/examples/README.md",
        "{workspaceRoot}/.github/workflows/cleanup.yml",
        "{workspaceRoot}/.github/workflows/ci.yml",
        "{workspaceRoot}/.gitattributes",
        "{workspaceRoot}/ppe/action.yml",
        "{workspaceRoot}/capture-hashes.mjs",
```

**Where the two new lines go, following the list's own grouping:**
- `"{workspaceRoot}/docs/cross-os.md"` -- inside the `docs/` run. Alphabetically it belongs after
  `configuration.md`; the shipped order is configuration / advanced / trust-and-security /
  versioning, which is NOT alphabetical, so append it to the end of the docs run (after
  `docs/examples/README.md`) or slot it after `configuration.md`. Either is consistent; pick one and
  do not reorder the existing lines (an unrelated reorder is diff noise on a `test`-rotating file).
- `"{workspaceRoot}/.github/workflows/<detector>.yml"` -- immediately after
  `.github/workflows/ci.yml`, keeping the workflow entries adjacent.

**The `integration` runtime value (`nx.json:104`), quoted with its surroundings:**

```json
        { "externalDependencies": ["vitest"] },
        { "dependentTasksOutputFiles": "**/*.js", "transitive": true },
        { "runtime": "node -p process.platform" }
```

Change the value to `node --no-warnings -p process.platform` per RESEARCH's U-01 verdict. It stays
the ONLY `runtime` entry in the whole file (`nx-target-inputs.spec.ts:372` asserts
`targetsWithRuntimeInput` equals `['integration']`).

**MIRROR the two structural facts, both of which are recorded in the SPEC rather than in `nx.json`
(strict JSON holds no comments -- `nx-target-inputs.spec.ts:555-558` calls this "THE COMMENT LOCK
(Phase 8 D-13's displacement)"):**
1. `targetDefaults.<target>.inputs` REPLACES the inferred list rather than merging into it. Adding
   an input means ADDING A LINE; nothing merges. (`nx-target-inputs.spec.ts:560-565`.)
2. `project.json` sits ABOVE `targetDefaults` and a key declared there replaces the default's key
   wholesale -- which is why every registration guard has a merged-configuration clause.

**MIRROR the effectiveness fact too (`nx-target-inputs.spec.ts:549-553`):** the entry is effective
on its OWN commit, because `{workspaceRoot}/nx.json` is already a `test` input, so adding the line
rotates the `test` hash on the very run that introduces it. There is no ordering instruction anyone
has to remember. This is what discharges D-09.

**DO NOT:** use `{workspaceRoot}/.github/workflows/**`. The reason is comment-locked at
`nx-target-inputs.spec.ts:583-591`: explicit paths, because a glob "would silently adopt whatever
lands there next, which is the part that is not equivalent". Same call `start-cache-server/` already
got.

---

### `docs/cross-os.md` (NEW) -- consumer-facing doc

**Analog 1 (structure and the guard-declaring intro):** `docs/trust-and-security.md:1-22`.

```markdown
# Trust and Security

This document renders the SETTLED trust model shipped across phases 1-5. It is a
rendering of the single sources listed below, never a re-typed paraphrase. If
this document and the code disagree, the code wins -- and the `docs-trust` guard
(`packages/github-cache/src/docs-trust.spec.ts`) fails the build until this file
is brought back in sync with the allowlists.

## Single sources of truth

| Concern                                        | Source                                       |
| ---------------------------------------------- | -------------------------------------------- |
| Write-trust allowlist (which events may WRITE) | `packages/github-cache/src/lib/trust.ts` ... |
```

Its section headings are NUMBERED (`## 1. Which events may write` ... `## 11. Freshness and
staleness caveats`).

**MIRROR:** (a) an intro paragraph that names the doc's guard spec by path and states "if this
document and the code disagree, the code wins" -- the discriminator string is EXACTLY that kind of
single-sourced value under D-15, so this intro form is the one to copy; (b) a single-source table
whose one row is the discriminator, sourced to `nx.json`'s `targetDefaults.integration.inputs`;
(c) numbered `##` headings, which make D-11's load-bearing ORDER visible to a reader and assertable
by an index comparison (safe default = section 1, portability checklist = section 2).

**Analog 2 (voice, and fenced YAML with inline trap comments):** `docs/advanced.md`. Its headings
are `## The opt-in GitHub Releases read store`, `### How the backend is selected`,
`## Publish / sync and cleanup`, `## The `&` fallback (older runners and GHES)`,
`## Why the sidecar is a JS action, not composite`. Its code fences carry trap comments INSIDE the
YAML, e.g. `docs/advanced.md:117-119`:

```yaml
# shell: bash is REQUIRED, not stylistic. This step uses export, $(...), & and
# >> "$GITHUB_ENV" -- on a Windows runner the default shell is pwsh, which fails
# on every one of them. Redundant on ubuntu; harmless there, load-bearing here.
```

**MIRROR:** the reason-inside-the-snippet habit. The discriminator snippet in `cross-os.md` should
carry, in the fence, why `--no-warnings` and not a redirect (Nx runs the string through `cmd /C` or
`sh -c`, so `2>/dev/null` / `2>nul` breaks one OS) and why the token must be verified NON-EMPTY and
DIFFERENT across the adopter's OSes (RESEARCH: the adopter has no `hash-parity-compare` gate, so a
collapsed discriminator silently makes their target OS-invariant).

**Content the doc must carry, and where each item COMES FROM -- do not re-derive:**
- Section 1 (safe default): declare the discriminator on ALL cacheable targets, then remove per
  target only after proving portability. D-11.
- Section 2 (portability checklist, framed as how to EARN a removal): items 1-5 verbatim from
  `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md:1777-1828`. **Item 6 is STRUCK and
  measured FALSE -- document NOTHING for it** (D-12). Item 3's second half is
  `08-ROOT-CAUSE.md:1832` (`AGENTS.md`'s per-worktree Nx cache claim is false at Nx 23.1.0).
- Architecture and libc named as the two axes `process.platform` does not cover, WITH the honest
  limit that this repo cannot exercise either (every machine here is arm64). D-13; do not soften to
  "consider also".
- The one cross-OS newline hazard Nx already closes: both streams are `.trim()`ed before
  concatenation (RESEARCH F-1), so a trailing newline / CRLF difference in the discriminator's own
  output cannot skew the hash.
- Pure ASCII only. `--` not an em dash, `->` not an arrow glyph, `*` not a bullet glyph. No contact
  address (`governance-email.spec.ts` gates the repo's email hygiene).

**Nav link (RESEARCH Open Question 3):** `README.md:143-153` is the `## Documentation` list; every
entry is `- [Title](docs/x.md) -- <one-line what-it-covers>` wrapped at ~80 cols:

```markdown
- [Configuration](docs/configuration.md) -- every environment variable knob, the
  Actions-cache 10 GB per-repo limit, and the no-default-local-read note.
```

Mirror that exact bullet form. `README.md` and `docs/advanced.md` are both already `test` inputs, so
a nav-presence assertion in the new guard is free.

---

### `packages/github-cache/src/docs-cross-os.spec.ts` (NEW) -- test, file-I/O

Three shipped shapes, quoted side by side. The DOCS-07 guard needs pieces of all three; CONTEXT
leaves new-file-vs-extension to discretion. **Recommendation: a NEW file**, because the
single-sourced `nx.json` read is a mechanism `docs-adoption.spec.ts` does not have, and because
`docs-adoption.spec.ts`'s own header scopes it to "adoption docs" presence/topic tokens.

#### Shape A -- import-the-single-source, assert the doc renders it verbatim (`docs-trust.spec.ts`)

THE STRONGEST, and the one D-15's equality clause needs. Full file is 86 lines; the load-bearing
parts:

```typescript
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HOST_GATED_EVENTS, TRUSTED_EVENTS } from './lib/trust.js';
import { SYNC_EVENTS } from './lib/sync-gate.js';

/**
 * DOCS-03/GOV-03 single-source drift guard.
 *
 * The trust doc renders the SETTLED model, so its correctness is only as good as
 * its agreement with the code it describes. Rather than a generic topic-token
 * check, this spec imports the authored write-gate and sync-gate allowlists
 * ... and asserts every event string renders verbatim in
 * docs/trust-and-security.md. A future allowlist change (e.g. widening
 * HOST_GATED_EVENTS) therefore trips this guard until the doc is updated,
 * closing the doc-vs-code drift failure mode.
 * ...
 * The docs live at the repo root (../../../ from src/), reached via
 * import.meta.url like ppe-action.spec.ts resolves the top-level ppe/ action.
 */
const trustDocUrl = new URL(
  '../../../docs/trust-and-security.md',
  import.meta.url,
);

const trustDoc = existsSync(trustDocUrl)
  ? readFileSync(trustDocUrl, 'utf8')
  : '';

describe('docs-trust single-source drift guard (DOCS-03/GOV-03)', () => {
  it('docs/trust-and-security.md exists', () => {
    expect(existsSync(trustDocUrl)).toBe(true);
  });

  it('renders every write-gate and sync-gate event string verbatim', () => {
    const events = [...TRUSTED_EVENTS, ...HOST_GATED_EVENTS, ...SYNC_EVENTS];

    for (const event of events) {
      expect(trustDoc, `trust doc missing event "${event}"`).toContain(event);
    }
  });
```

**MIRROR:** `new URL('../../../docs/<file>.md', import.meta.url)` -- NEVER `__dirname`, NEVER
`process.cwd()`. Read the SOURCE, never re-spell the literal in the spec. Per-item failure message
naming the missing value.

**ADAPT:** the source here is `nx.json`, read as JSON rather than imported as a TS constant (docs
live outside the graph; `nx.json` is not importable as a module). RESEARCH's Code Examples section
already writes the extraction, and its `flatMap` matches `nx-target-inputs.spec.ts:395-398`
character for character -- reuse that shape so the two guards cannot disagree about what a runtime
input is.

**DO NOT COPY:** the bare `toContain` for the discriminator literal. WR-09 (D-14): a phrase
occurring twice is only half-locked. Use an occurrence COUNT, or key on a phrase measured unique.

#### Shape B -- phrase-keyed rows plus an occurrence COUNT (`docs-same-os-claims.spec.ts`)

The table form (`:91`, `:539`) and its runner (`:581-608`):

```typescript
const DOCS_08_SITES = [
  {
    file: 'docs/advanced.md',
    bucket: 'correction',
    required: [
      '**Restore is not same-OS.**',
      'each leg is still the only place its own',
      'once per version-affecting change',
    ],
    forbidden: [/Restore is same-[O]S --/],
  },
  // ...
] as const;

function read(file: string): string {
  return readFileSync(new URL(file, WORKSPACE_ROOT_URL), 'utf8');
}

describe('every DOCS-08 site says what is true after VER-01/VER-03 (...)', () => {
  for (const { file, bucket, required, forbidden } of DOCS_08_SITES) {
    describe(`${file} -- ${bucket}: ${required[0]}`, () => {
      for (const phrase of required) {
        it(`still contains \`${phrase}\``, () => {
          expect(
            read(file),
            `${file} no longer contains the exact phrase \`${phrase}\`. This table is keyed on FILE + PHRASE on purpose -- these six edits shift each other's lines in one commit, so a line number would rot. If the site was legitimately reworded, update its ROW here in the SAME commit; do not delete the assertion to make the suite green.`,
          ).toContain(phrase);
        });
      }
      // ... forbidden loop
    });
  }
});
```

And the COUNT assertion that fixes `toContain`'s half-lock (`:642-657`):

```typescript
describe('Phase 11 row A locks BOTH ci.yml blocks, not just the first (DOCS-08, PARITY-08)', () => {
  const ROW_A_PHRASES = [
    "ci.yml IS in nx.json's test inputs (nx.json:69, PARITY-08, Phase 9)",
    'asserted by dogfood-cross-os.spec.ts and docs-same-os-claims.spec.ts',
  ] as const;

  it.each([...ROW_A_PHRASES])(
    'occurs in ci.yml exactly twice: `%s`',
    (phrase) => {
      expect(
        read('.github/workflows/ci.yml').split(phrase).length - 1,
        `... If a block was legitimately reworded or added, update this expected count in the SAME commit; do not delete the assertion to make the suite green.`,
      ).toBe(2);
    },
  );
});
```

**MIRROR:** keyed on FILE + QUOTED PHRASE, NEVER a line number (its header, `:15-17`: "all six edits
land in ONE commit and therefore shift each other's lines, so a line-number-keyed table would rot").
Failure messages that say "update the ROW in the SAME commit; do not delete the assertion".
`split(phrase).length - 1` for a non-overlapping occurrence count.

**MIRROR the hard constraint at `:62-66`, which is easy to violate in a fresh doc:**

> EVERY PHRASE IN THIS TABLE MUST FIT ON ONE LINE OF ITS FILE. `read()` returns the raw text, so a
> phrase spanning a hard wrap matches NOTHING and the row would be a silent false PASS in the
> additive direction.

`docs/cross-os.md` will be prose wrapped at ~80 cols. Every pinned phrase must be checked against a
single line of the written file before the assertion is committed.

**DO NOT COPY:** the single-character character-class trick (`/Restore is same-[O]S --/`) unless the
assertion is a genuine ABSENCE. It exists so the forbidden string is not planted in the file that
proves it is gone. DOCS-07's clauses are mostly PRESENCE, so `forbidden: []` is the honest default.

#### Shape C -- presence + registration header (`docs-adoption.spec.ts`)

```typescript
/**
 * ... Because
 * these files live OUTSIDE this project's graph, they are wired into the `test`
 * target inputs in nx.json (the 06-02/06-03 stale-cache precedent) so an edit to
 * any of them busts the Nx cache and re-runs this guard instead of replaying a
 * stale pass.
 */
const repoRoot = new URL('../../../', import.meta.url);

function docUrl(relativePath: string): URL {
  return new URL(relativePath, repoRoot);
}

function read(relativePath: string): string {
  return readFileSync(docUrl(relativePath), 'utf8');
}

const REQUIRED_DOCS = [
  'README.md',
  'docs/configuration.md',
  // ...
];

describe('adoption docs exist (DOCS-01/02/04)', () => {
  it.each(REQUIRED_DOCS)('%s exists', (path) => {
    expect(existsSync(docUrl(path))).toBe(true);
  });
});
```

Note also its ANCHORED same-sentence idiom (`:62-64`), which beats a whole-document `/fixed/i`:

```typescript
    expect(config).toMatch(
      /MAX_CACHE_BODY_BYTES[^.!?]{0,80}fixed|fixed[^.!?]{0,80}MAX_CACHE_BODY_BYTES/i,
    );
```

**MIRROR:** the docstring paragraph stating the `nx.json` registration DEPENDENCY explicitly (every
docs guard in this repo carries one; without it the guard replays a stale pass). The
`[^.!?]{0,80}` same-sentence anchor is the right tool for D-13's "names arch AND libc AND says this
repo cannot exercise either" -- three tokens that must be RELATED, not merely co-present.

**A registration ASSERTION belongs in `nx-target-inputs.spec.ts`, not here.** That file already owns
every `{workspaceRoot}` literal pin, with the comment lock explaining why a literal is the honest
form (`:466-476`, `:604-614`). Add `docs/cross-os.md` and the detector workflow there, in the same
shape:

```typescript
  it('nx.json declares ci.yml as a test input', () => {
    expect(nxJson.targetDefaults.test.inputs).toContain(
      '{workspaceRoot}/.github/workflows/ci.yml',
    );
  });
```

...plus the merged-configuration clause and its NEGATIVE non-vacuity control (`:652-685`), if the
plan wants the full PARITY-08 treatment. Minimum viable is the literal pin; the merge clause is
already discharged for the whole `test` list by the existing `mergedTest` cases, so a second copy
per new entry is duplication.

---

### `packages/github-cache/src/dogfood-cross-os.spec.ts` -- extend (test, file-I/O)

**Analog:** its own `o3-witness` describe (`:283-546`). This file is the ONLY job-block extractor in
the repo, and its header states the rule the new describes must follow (`:117-120`): "the guard comes
to the helper rather than the helper going to the guard".

The helper and the comment-strip, quoted (`:49-77`):

```typescript
const codeLines = readFileSync(
  new URL('../../../.github/workflows/ci.yml', import.meta.url),
  'utf8',
)
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'));

/**
 * One job's own block: from the `  <name>:` key (jobs are keyed at two spaces) up to
 * the next line at that same indent, exclusive. Throws rather than returning empty
 * when the job is absent, so a renamed or deleted job fails loud here instead of
 * silently satisfying the `not.toMatch` clause below.
 */
function jobBlock(name: string): string {
  const start = codeLines.findIndex((line) =>
    new RegExp(`^ {2}${name}:\\s*$`).test(line),
  );

  if (start < 0) {
    throw new Error(
      `ci.yml: no job keyed \`  ${name}:\` -- VER-06's guard cannot scope its assertions`,
    );
  }

  const rest = codeLines.slice(start + 1);
  const end = rest.findIndex((line) => /^ {2}\S/.test(line));

  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}
```

The per-job assertion shape, quoted (`:298-352`):

```typescript
  // POSITIVE CONTROL, and it comes FIRST for the same reason every other control in this
  // file does: every clause below is a `toMatch`, so a `jobBlock` that returned the WRONG
  // non-empty block would have the six of them asserting about the wrong job.
  it('scopes to a real o3-witness job block that waits on integration', () => {
    expect(
      jobBlock('o3-witness'),
      'jobBlock THROWS when no job is keyed `  o3-witness:`, and that throw is the whole ' +
        'presence guard: it is what stops the witness from being a gate that can be deleted ' +
        'without anything going red. ...',
    ).toMatch(/^ {4}needs: integration$/m);
  });

  it('runs on a SINGLE ubuntu-24.04-arm runner, not a matrix', () => {
    expect(jobBlock('o3-witness'), '...').toMatch(/^ {4}runs-on: ubuntu-24\.04-arm$/m);
  });

  it('carries a timeout-minutes value -- generic hang insurance, like every other job', () => {
    expect(jobBlock('o3-witness'), '...').toMatch(/^ {4}timeout-minutes: \d+$/m);
  });
```

**MIRROR, clause for clause, for each of `build-windows` / `typecheck-windows` / `test-windows`:**
1. A POSITIVE CONTROL first. The `jobBlock` THROW is the presence guard -- that is what stops a new
   CI job from being a silently deletable gate (the file's own words at `:301-306`, tied to this
   repo's `nx run-many` exit-0 finding).
2. `runs-on` anchored at four spaces: `/^ {4}runs-on: windows-11-arm$/m`.
3. `needs:` anchored at four spaces and naming exactly ONE producer.
4. `timeout-minutes` anchored at four spaces.
5. The final `npm run <target>` line, so the leg is proven to run the target its NAME claims. (This
   is the clause that catches a copy-paste leaving `npm run test` in `build-windows` -- the single
   most likely error in a verbatim-copy task, and nothing else in the file would catch it.)

**CRITICAL anchoring rule, from this file's own recorded bug (`:135-138`):**

> Each pattern is anchored at `^ {4}needs:` -- a job's own keys sit one level under the two-space job
> key -- so the token must appear ON the `needs:` line. Unanchored, `\bbuild\b` would already be
> satisfied by this same job's `- run: npm run build` step and the guard would be a tautology.

That trap is LIVE for `build-windows`: an unanchored `\bbuild\b` check on its `needs:` is satisfied
by its own `- run: npm run build`. Anchor every clause.

**Second critical rule (`:36-42`):** assertions are SCOPED PER JOB BLOCK. `windows-11-arm` occurs
19 times in `ci.yml` today (MEASURED), so a whole-file `toContain('windows-11-arm')` passes
unconditionally.

**DO NOT:** put a comment-phrase assertion in this file. `codeLines` strips every `#` line, so a
comment lock here is vacuous BY CONSTRUCTION (`:271-275`). The invariant-comment and graph-premise
prose locks, if the plan wants them, belong in `docs-same-os-claims.spec.ts`, whose read is RAW.
Two harnesses, one question each.

**DO NOT:** add the sidecar-block byte-identity guard. Explicit Deferred Idea; `12-RESEARCH.md`'s
test map says "Do NOT add it".

### `packages/github-cache/src/cleanup/cleanup-workflow.spec.ts` -- the detector's shape guard

**Analog:** the whole file (58 lines), which is the in-repo precedent for a spec over a workflow
FILE rather than over a job inside `ci.yml`. Quoted in full because the detector's guard is this file
with substitutions:

```typescript
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * RETAIN-03 is a workflow-config requirement, not runtime logic: there is no
 * injected-client seam over YAML, so 04-VALIDATION.md classified it manual-review
 * only. This pins the SECURITY-load-bearing structure directly from disk instead --
 * the same contents:write GITHUB_TOKEN with no PAT and no wider scope, and a
 * queue-don't-cancel concurrency group -- so a regression (a widened scope, a
 * flipped cancel-in-progress, a swapped-in PAT) fails the automated suite rather
 * than surviving until the next manual re-review.
 *
 * Path resolved via import.meta.url (the pinned-deps.spec.ts / release-asset-name
 * .spec.ts idiom), NOT __dirname and NOT process.cwd().
 *
 * Only non-comment lines are matched: this file's own prose comments repeat
 * "contents: write" and "cancel-in-progress" verbatim while explaining the
 * rationale, so a naive substring match against the raw file would pass even if
 * the REAL YAML directive had drifted. Stripping '#'-prefixed lines first makes
 * every assertion below non-vacuous against the actual config.
 */
const workflowSource = readFileSync(
  new URL('../../../../.github/workflows/cleanup.yml', import.meta.url),
  'utf8',
);

const codeLines = workflowSource
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n');

describe('cleanup.yml workflow config (RETAIN-03)', () => {
  it('grants ONLY contents: write -- no actions:read, no packages scope', () => {
    expect(codeLines).toMatch(/permissions:\s*\n\s*contents:\s*write\s*\n/);
    expect(codeLines).not.toMatch(/actions:\s*(read|write)/);
    expect(codeLines).not.toMatch(/packages:\s*(read|write)/);
  });

  it('runs on a schedule trigger, never on push or pull_request', () => {
    expect(codeLines).toMatch(/^on:\s*\n\s*schedule:/m);
    expect(codeLines).not.toMatch(/^\s*(push|pull_request):/m);
  });
});
```

**MIRROR:** the `../../../../` depth (FOUR levels -- this spec lives in `src/cleanup/`, one deeper
than the flat `src/` specs' `../../../`); the `#`-stripping comment filter with its stated reason;
`/^on:\s*\n\s*schedule:/m` for the trigger; the `not.toMatch(/^\s*(push|pull_request):/m)` absence.

**ADAPT for the detector:** assert `runs-on: windows-11-arm`, that the run body contains
`--skip-nx-cache`, that it contains the success-LINE grep and `NO_COLOR`, and that it declares NO
sidecar (`not.toMatch(/start-cache-server/)` -- an absence, so pair it with the positive control the
`toMatch` clauses already provide). Keep `workflow_dispatch` OUT of the forbidden-trigger list --
D-08 requires it.

**PLACEMENT:** if the guard lands as a new describe in `dogfood-cross-os.spec.ts` (flat `src/`),
the URL depth is `../../../`, not `../../../../`. Getting that wrong is a `readFileSync` ENOENT, so
it fails loud -- but check it rather than copying the depth across directories.

---

### `packages/github-cache/src/nx-target-inputs.spec.ts` `:400` and `:446` -- test

**Analog:** itself. Both literals quoted with the surrounding context the planner needs to specify
the exact edit.

Site 1, `:394-401` (reads `nx.json`'s `targetDefaults` alone):

```typescript
  it('integration declares exactly the byte-identical discriminator command', () => {
    const runtimeCommands = nxJson.targetDefaults.integration.inputs.flatMap(
      (input) =>
        typeof input === 'object' && 'runtime' in input ? [input.runtime] : [],
    );

    expect(runtimeCommands).toEqual(['node -p process.platform']);
  });
```

Site 2, `:441-447` (the CORR-04 merged-configuration guard, `project.json` merged over
`targetDefaults`):

```typescript
  it('keeps the byte-identical discriminator once project.json is merged over targetDefaults', () => {
    expect(
      runtimeInputsOf(
        mergedIntegration(projectJson.targets.integration).inputs,
      ),
    ).toEqual(['node -p process.platform']);
  });
```

**The edit is the LITERAL ONLY** -- both become `['node --no-warnings -p process.platform']`. Do not
touch `toEqual` (exact equality is deliberate: "a second runtime entry appearing on `integration` is
as much a CORR-04 event as the string changing", `:391-393`), and do not touch the
`runtimeInputsOf` / `mergedIntegration` helpers or the negative control at `:456-463`.

**THE COMMENT ABOVE SITE 1 MUST BE REWRITTEN, NOT LEFT** (`:375-393`). It currently argues the
string must stay byte-identical:

```typescript
  // The guard above proves exactly one target HAS a runtime input. It does NOT
  // prove the string was not RE-SPELLED, and two independent things break if it
  // is (D-14 requires it byte-identical for both):
  //
  //   1. After VER-03 this runtime input is the SOLE mechanism separating
  //      OS-sensitive targets from OS-invariant ones. Re-spelling it is a
  //      Core-Value regression even when the replacement reads equivalently --
  //      `node -e "console.log(process.platform)"` prints the same thing and
  //      hashes to a different node, and this phase's whole result is stated in
  //      terms of that node's identity.
```

Leaving that text beside a CHANGED literal ships a file that argues against its own contents. This
is the same class of defect D-21 is fixing in `ci.yml` and `capture-hashes.mjs`, and the same class
`08-ROOT-CAUSE.md:1589`'s CORR-04 invariant needs SUPERSEDING for. Apply the house form: keep the
byte-identity requirement GOING FORWARD, record that Phase 12 re-spelled it ONCE with the
replacement reason (stderr IS hashed -- Nx 23.1.0 `hash_runtime.rs:33-35`; the node warning channel
is PID-bearing so a warning would produce a permanent 100% MISS rather than a one-time rotation).

**FREE RED, do not re-derive it:** `08-ROOT-CAUSE.md:2148` records mutation M3 -- re-spelling the
discriminator produced `expected [ Array(1) ] to deeply equal [ 'node -p process.platform' ]`,
exactly one failing test, while the "only one runtime input" guard stayed green. The MECHANISM's red
is already observed; only the NEW literal needs its own observation.

### The remaining discriminator sites -- fixture and comments

| Site | Kind | Verified present |
|---|---|---|
| `packages/github-cache/src/hash-parity/compare.spec.ts:99` | fixture value `command: 'node -p process.platform',` inside a record factory whose `stdout` is `` `${os}\n` `` and `stderr` is `''` | yes |
| `packages/github-cache/src/hash-parity/compare.spec.ts:281` | comment | yes |
| `packages/github-cache/src/hash-parity/compare.ts:9` | contract comment (`declares \`{ "runtime": "node -p process.platform" }\` on \`integration\`, and call`) | yes |
| `eslint.config.mjs:437` | comment (repo ROOT, not under `packages/`) | yes |
| `.github/workflows/ci.yml:387` | comment quoting the string, inside the `integration` job's leading block | yes -- **and this is the site the documented `rg` sweep misses (M-1)** |

`compare.spec.ts:99`'s fixture is a plain string literal, so the edit is mechanical. Note the
fixture also carries `stderr: ''`, which is the value RESEARCH measured on both real legs -- leave it.

**`capture-hashes.mjs` needs NO change for the string** (`readDiscriminatorCommand` reads it out of
`nx.json`), which is also why verification is free: the next `hash-parity` run records the new
command's raw stdout AND stderr per leg into `hash-parity-<os>.json` with no new instrument.

---

### `capture-hashes.mjs` -- the D-21 contract-comment correction

**Analog:** itself. TWO sites, and CONTEXT names only one -- both carry the attribution claim.

Site 1, the `FORBIDDEN_TARGETS` docblock (`capture-hashes.mjs:90-96`):

```javascript
/**
 * The targets TEST-08's premise asserts are ABSENT from the Windows CI leg's
 * RESOLVED task graph. That absence is what licenses "any `build`, `typecheck`
 * or `test` hash in the store is Linux-produced" (D-12; D-14's attribution table
 * row 1, the only structural rather than observational means).
 */
const FORBIDDEN_TARGETS = ['build', 'typecheck', 'test'];
```

Site 2, assertion 2's FAILURE MESSAGE -- this is a runtime string, not a comment
(`capture-hashes.mjs:629-637`):

```javascript
  if (offenders.length > 0) {
    fail(
      2,
      `\`${premiseCommand}\` resolves forbidden target(s) ${offenders.join(', ')}. TEST-08's ` +
        `premise is that the Windows CI leg resolves no ${FORBIDDEN_TARGETS.join('/')} task, so ` +
        'any such hash in the store is Linux-produced (D-12, D-14 row 1). With this false, that ' +
        'attribution is withdrawn.',
    );
  }
```

**VERIFIED SAFE TO EDIT:** `capture-hashes-cli.spec.ts` asserts only on the USAGE line
(`'--assert-graph-premise [--out <path>]'`) and on the mutual-exclusion errors. No spec pins either
string above, so changing them breaks nothing.

**MIRROR the file's own correction register.** Its header already carries one
(`:22-30`, "WHERE EACH MODE IS EXECUTED, stated because a guard nothing runs is documentation"), and
its `assertGraphPremise` contract block carries an in-place correction with the reason
(`:533-537`: "An earlier revision of this block presented all six as independent ... What follows is
the MEASURED split"). Correct in place, name what changed, keep the old claim visible as superseded.

**WHAT THE REPLACEMENT MUST SAY (D-21):** from this commit the premise no longer establishes producer
attribution (XOS-04 falsifies the second half of O1's conjunction -- that Windows CI ran only
`integration`); the attribution record is FROZEN at `11-EVIDENCE.md`'s O1 section; the assertion now
guards ONLY the graph property, against an Nx upgrade changing the inferred `dependsOn`. Note the
assertion KEEPS PASSING -- RESEARCH Correction 3 verified `integration`'s resolved task set is
untouched by three jobs that run `npm run <target>` and declare no new targets.

**DO NOT:** change `FORBIDDEN_TARGETS`, `CONTROL_TARGET`, `resolvedTaskIds`, or any of the six
assertions. Behaviour is unchanged; only the evidentiary language moves.

---

### `11-EVIDENCE.md` -- fill the RESERVED O4 section (doc artifact)

**Analog:** the file's own structure. Two anchors, both RE-VERIFIED:

The status table row to update, `11-EVIDENCE.md:34` (the table runs `:26-34`):

```markdown
| **O4 (XOS-04, XOS-05)** | **RESERVED** -- Phase 12 |
```

Compare the register of the rows above it, e.g. `:28`:

```markdown
| **O1 (XOS-01)** -- a cold local Windows box logs the literal `[remote cache]` for `build`, `typecheck` AND `test`, per target, against Linux-CI-produced artifacts | **PROVEN.** 1 occurrence per target, 3 of 3 named individually. All three pre-registered counts MET |
```

**MIRROR:** the left cell states the CLAIM in full; the right cell opens with a bold verdict
(`**PROVEN.**`), then the per-target OCCURRENCE COUNT, then whether the pre-registered counts were
MET. That is the D-19/D-20 shape rendered as a table row.

The section to fill in place, `:1002-1019` (opens `## O4 (XOS-04, XOS-05) -- RESERVED`, carries
"**Do not fill this section and do not delete it.**"). Two more places in the same file reference
O4 and should be reconciled in the same edit: `:1034` (`- **O4.** RESERVED above, and owned by Phase
12.` in `## What remains unobservable`) and `:1055` (the calibrated-instruments row for
`capture-hashes.mjs --assert-graph-premise`, which says "Phase 12's XOS-04 CHANGES this premise ...
the flag must be re-read, not re-run blindly").

**Also mirror `:36-39`'s habit** -- stating explicitly what this proof does NOT need, so a reader
does not look for it:

```markdown
Both proved halves are LOCAL measurements against an already-warm mirror. **Nothing in O1 or O2
needed a temporary `main` push.** Only O3 needs the live run (D-20). This is stated explicitly
because Phases 9 and 10 both needed a push for their perishable halves and a reader may otherwise
assume the same shape here.
```

O4's equivalent, per RESEARCH Correction 1: the PR-scope entry is ephemeral and isolated -- the proof
seeds neither `main`'s cache scope nor the Releases mirror -- so say so, or a reader will look for a
mirror row that never appears.

**DO NOT:** create `12-EVIDENCE.md`. Do not relocate or duplicate the section. This file is not an
Nx input, so no spec can guard it and none should be written.

---

### The threat-model append (doc artifact)

**Analog and the exact append surface:** `10-SECURITY.md:132-140`, which was written to be appended
to and says so:

```markdown
**What the residual actually is, stated so Phase 12 inherits it as a question and not as a
reassurance.** The genuine race is two producers computing hash H on different OSes and
both calling `saveCache(nx-cache-H)`; the winner owns the entry INCLUDING its OS-specific
captured terminal output. That is a determinism and attribution property, not an
authorization one -- no reader receives bytes from an untrusted writer either way. It
becomes reachable when XOS-04 puts `build`/`typecheck`/`test` on a Windows leg, which is
the **XOS-05 write decision in Phase 12**. XOS-06 is satisfied here because no requirement
depends on the winner, NOT because the race does not exist, and the engine's own comments
say so in those terms (`publish-mirror.ts:165-176`, `:303-310`).
```

Its section heading is `### Q1 (TRUST-11) -- the first-write-wins race between two same-hash
producers`, opening `**Classification: does NOT cross a trust boundary. Severity of the residual:
LOW today, re-priced by Phase 12. Not a Phase 10 gap.**` -- so "re-priced by Phase 12" is a promise
this phase keeps.

**MIRROR:** the bold-lead-sentence-then-evidence paragraph form; the Leg A / Leg B split when a
verdict rests on two independent legs; the habit of citing the file and line the claim was verified
against rather than asserting it.

**RECORD BOTH HALVES, per CONTEXT `<specifics>`:** D-02's `needs:` edge removes the concurrent RACE
(the legs are no longer simultaneous); it does NOT remove the SECOND PRODUCER. An appended note
claiming the race is gone without saying the producer count changed would be HALF TRUE. RESEARCH's
T-12-01 states it in the form the auditor wants.

`.planning/THREAT-MODEL.md`'s C1-C18 ledger (rows at `:74-82`) is a one-row-per-control table. This
phase adds no new credential and no new write PATH, so no new C-row is required -- the append belongs
in `10-SECURITY.md`'s Q1. If the plan wants a THREAT-MODEL touch too, say which C-row it annotates
and why, rather than inventing C19.

---

## Shared Patterns

### S-1: Correcting a claim requires a REPLACEMENT reason

**Source:** `docs-same-os-claims.spec.ts:146-161` (row 4's docstring) and the shipped example at
`ci.yml:298-303`.
**Apply to:** `ci.yml`'s invariant comment, `ci.yml`'s graph-premise block,
`capture-hashes.mjs` (2 sites), `nx-target-inputs.spec.ts:375-393`, `08-ROOT-CAUSE.md:1589`'s
CORR-04 invariant, `11-EVIDENCE.md:1055`.

> ... So a bare DELETION of the old argument would leave a future reader
> holding a documented case for narrowing `needs:` straight back -- which is exactly
> how Phase 9 shipped a regression. This row therefore requires the REPLACEMENT
> REASON to be PRESENT: the mechanism, the bounded failure mode if that mechanism is
> ever wrong, and the run id the widening is justified by.

Six sites in this phase are corrections. Each needs mechanism + bounded failure mode + the
measurement that justifies it. A deletion is not a correction.

### S-2: Every workflow-file guard strips `#` lines, and states why

**Source:** `cleanup-workflow.spec.ts:16-20` and `dogfood-cross-os.spec.ts:29-34`.
**Apply to:** the detector's shape guard, the three Windows-job describes.

> Only non-comment lines are matched: this file's own prose comments repeat
> "contents: write" and "cancel-in-progress" verbatim while explaining the
> rationale, so a naive substring match against the raw file would pass even if
> the REAL YAML directive had drifted. Stripping '#'-prefixed lines first makes
> every assertion below non-vacuous against the actual config.

Corollary, and it partitions the work: a spec that strips `#` CANNOT lock a comment. Comment prose
goes to `docs-same-os-claims.spec.ts` (raw read); YAML values go to `dogfood-cross-os.spec.ts` /
`cleanup-workflow.spec.ts` (stripped read). Two harnesses, one question each -- there is deliberately
no third.

### S-3: A POSITIVE CONTROL comes FIRST, before any absence assertion

**Source:** `dogfood-cross-os.spec.ts:80-85`, `:167-171`, `:227-234`, `:293-312`, `:529-535`.
**Apply to:** every new describe in this phase.

```typescript
  it('scopes to a real, non-empty job block -- the control that makes the no-matrix clause non-vacuous', () => {
    // A `not.toMatch` against an empty string passes trivially, so prove the
    // extraction actually captured each job before asserting on absence.
    expect(jobBlock('dogfood-seed')).toMatch(/operation:\s*seed/);
    expect(jobBlock('dogfood-verify')).toMatch(/operation:\s*verify/);
  });
```

The control must key on something UNIQUE to the block and REAL YAML (it must survive the `#` strip).
For `build-windows` / `typecheck-windows` / `test-windows` the natural unique key is the final
`- run: npm run <target>` line combined with the job key -- and `jobBlock`'s THROW covers presence.

### S-4: Resolve paths via `import.meta.url`, never `__dirname` / `process.cwd()`

**Source:** `docs-trust.spec.ts:21-23`, `docs-adoption.spec.ts:15-16`,
`cleanup-workflow.spec.ts:13-14`, `docs-same-os-claims.spec.ts:4`.
**Apply to:** every new or edited spec.

Depth by location: flat `src/` -> `../../../` reaches the repo root; `src/cleanup/` ->
`../../../../`. `docs-same-os-claims.spec.ts` factors it into a `WORKSPACE_ROOT_URL` constant plus a
`read(file)` helper taking repo-relative paths -- the cleanest shape when a guard reads more than
two files.

### S-5: Anchor YAML assertions by indent level

**Source:** `dogfood-cross-os.spec.ts:135-138`, `:314-317`, `:324-330`.
**Apply to:** every clause in the three Windows-job describes and in the detector guard.

Job-level keys sit at FOUR spaces (`^ {4}needs:`, `^ {4}runs-on:`, `^ {4}if:`,
`^ {4}timeout-minutes:`). Their children sit at SIX (`^ {6}contents: read\b`,
`^ {6}max-parallel:\s*1$`). Unanchored patterns become tautologies -- this file records the
`\bbuild\b` incident where a `needs:` check was satisfied by the job's own `- run: npm run build`.
Do NOT terminate with `$` when a trailing `#` comment on the same line is legitimate.

### S-6: A phrase occurring twice is only HALF locked

**Source:** `docs-same-os-claims.spec.ts:610-657` (WR-09's fix).
**Apply to:** the DOCS-07 drift guard, and to any `ci.yml` comment lock added this phase.

`toContain` is satisfied by the first occurrence. Either assert a COUNT
(`doc.split(phrase).length - 1`) or key on a phrase MEASURED unique. Measure with
`rg -o -F "<phrase>" <file> | wc -l` -- `rg -c` counts LINES, not occurrences.

**Measured for this phase:** `all four wired jobs` occurs ONCE in `ci.yml`, so the invariant-comment
edit needs no count assertion. `windows-11-arm` occurs 19 times, so nothing about it can be asserted
file-wide.

### S-7: Observe the RED, never predict it

**Source:** D-14, and `08-ROOT-CAUSE.md:2148` (mutation M3, the discriminator pin's recorded red).
**Apply to:** every new assertion in this phase.

Mutate the thing the assertion reads, confirm the NAMED assertion fails with the RIGHT cause, revert.
Two accelerants: M3 already covers the discriminator pin's mechanism (only the new literal needs its
own red), and M-2 above already tells you which mutation exposes the detector needle's vacuity
(delete one target from the `-t` list, not from the workflow).

### S-8: Docs live outside the project graph, so registration IS the guard's validity

**Source:** `docs-adoption.spec.ts:16-20`, `docs-same-os-claims.spec.ts:36-40`,
`dogfood-cross-os.spec.ts:44-47`, `nx-target-inputs.spec.ts:537-614`.
**Apply to:** `docs/cross-os.md`, the detector workflow file, and their guards.

Every guard whose subject lives outside `{projectRoot}` carries a docstring paragraph naming its
`nx.json` `test`-input dependency. Write that paragraph in the new guard. And register in the SAME
COMMIT (D-09) -- the entry is effective on its own commit because `{workspaceRoot}/nx.json` is
itself a `test` input, so there is no window and no ordering instruction to remember.

---

## No Analog Found

None. Every file in this phase's set has a shipped in-repo analog. The three items that come closest
to "new" each still have a precedent:

| Item | Why it looks new | Analog that covers it |
|---|---|---|
| A second workflow file with a `windows-11-arm` job | no existing workflow other than `ci.yml` uses that runner | `cleanup.yml` for the FILE shape; `ci.yml` `integration` / `hash-parity` / `dogfood-verify` for the runner label (19 occurrences) |
| A `test`-target job on Windows | `test` has never run in Windows CI | the sidecar block has run continuously on `windows-11-arm` as `integration`'s Windows leg; and `test` was MEASURED green on Windows arm64 locally this milestone (RESEARCH F-5: 40 files, 856 tests, exit 0) |
| A doc that single-sources a value out of `nx.json` | existing single-source guards import TS constants | `docs-trust.spec.ts`'s shape with `nx-target-inputs.spec.ts:395-398`'s JSON extraction substituted for the import |

---

## Metadata

**Analog search scope:** `.github/workflows/` (both files, by job name), `nx.json`, `docs/` (all 4
topic files + examples), `README.md`, `packages/github-cache/src/*.spec.ts` (15 flat specs),
`packages/github-cache/src/cleanup/`, `packages/github-cache/src/hash-parity/`,
`capture-hashes.mjs`, `eslint.config.mjs`, `.planning/phases/10-*/10-SECURITY.md`,
`.planning/phases/11-*/11-EVIDENCE.md`, `.planning/THREAT-MODEL.md`, and
`node_modules/nx/dist/src/tasks-runner/life-cycles/` (via `rg`, for M-2).

**Files read in full or by targeted range:** 18. **Analogs selected:** 9 primary
(`ci.yml` `test` / `dogfood-verify` / `integration` / `lint` / graph-premise block, `cleanup.yml`,
`docs-trust.spec.ts`, `docs-same-os-claims.spec.ts`, `dogfood-cross-os.spec.ts`,
`cleanup-workflow.spec.ts`, `nx-target-inputs.spec.ts`) -- above the 3-5 early-stop threshold because
this phase touches 12 files across 5 distinct roles, not because the search kept widening.

**Line numbers RE-RESOLVED 2026-07-30** against the working tree. Job anchors measured this session:
`format-check:13`, `lint:37`, `fallow:81`, `action-bundle-drift:99`, `pack-check:121`, `ppe:144`,
`build:207`, `typecheck:281`, `test:339`, `integration:416`, `o3-witness:665`, `hash-parity:998`,
`hash-parity-compare:1214`, `dogfood-seed:1266`, `dogfood-verify:1289`, `consumer-smoke:1367`,
`publish:1502`, `publish-verify:1716`. **These expire the moment the first plan edits `ci.yml`** --
every reference in this document also names its job or quotes its phrase, so re-locate by that.

**Stale sources deliberately NOT used for facts:** `.planning/codebase/*.md` (mapped 2026-07-22
against v0.0.1). Used for CONVENTIONS only, per its own flag in PROJECT.md and STATE.md.

**Pattern extraction date:** 2026-07-30
