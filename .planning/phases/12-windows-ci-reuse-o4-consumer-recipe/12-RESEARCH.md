# Phase 12: Windows CI Reuse (O4) + Consumer Recipe - Research

**Researched:** 2026-07-30
**Domain:** GitHub Actions job wiring / Nx 23.1.0 task hashing (`runtime` inputs) / consumer documentation
**Confidence:** HIGH on U-01 and on the three CONTEXT corrections; MEDIUM on the live-CI-only items (unobservable off-runner by construction)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied from `12-CONTEXT.md` `<decisions>`. Abbreviated only where the body is pure restatement; every
decision ID and its operative clause is present. Read `12-CONTEXT.md` for the full reasoning bodies.

- **D-00 [informational]** -- `init.plan-phase 12` returns all FOUR IDs; the last comes back as
  `DOCS-07.` with a trailing period. Never `rg` for that literal. Authoritative list:
  **XOS-04, XOS-05, XOS-08, DOCS-07**.
- **D-01 [informational]** -- `ROADMAP.md`'s traceability table (`:609-611`), coverage tally (`:624`)
  and `:684` UNDERCOUNT this phase at THREE; the XOS-08 row is missing. `REQUIREMENTS.md`
  (`:658-661`, `:663-665`) says FOUR and is AUTHORITATIVE. Audit coverage against REQUIREMENTS.md.
- **D-02** -- THREE dedicated jobs (`build-windows`, `typecheck-windows`, `test-windows`), each
  `runs-on: windows-11-arm`, each `needs:` its ONE corresponding ubuntu job. A matrix is
  STRUCTURALLY foreclosed (`needs:` is per-JOB, never per-LEG). The one-combined-`windows-reuse`-job
  alternative was weighed and NOT taken.
- **D-03** -- the sidecar block is COPIED VERBATIM; the invariant comment goes from "all four wired
  jobs" to seven, in the SAME commit that adds the legs. The block is already Windows-correct.
- **D-04** -- port 3000 on every new leg, unchanged. No port allocation scheme.
- **D-05** -- `timeout-minutes: 15` on each new leg, matching its ubuntu counterpart.
- **D-06 (MEASURED)** -- **the Windows legs WRITE, and it is FORCED, not chosen.** `select-backend.ts`
  has no read-only-Actions-cache branch: write-trusted + valid repo + NO token returns
  `createReadOnlyMemoryBackend()`, an EMPTY backend where every read MISSes. D2-02 forbids adding a
  knob.
- **D-07** -- both consequences fire and both are Phase 12 scope: (1) the attribution loss is recorded
  alongside TRUST-11/12; (2) the scheduled `--skip-nx-cache` windows-11-arm job becomes REQUIRED.
- **D-08** -- the regression detector is a NEW workflow file, not a job in `ci.yml`: `on: schedule`
  (daily cron off the top of the hour) **plus `workflow_dispatch`**, one `windows-11-arm` job, the
  three targets with `--skip-nx-cache`, **NO sidecar block**, **hard fail**. Rejected: adding
  `schedule:` to `ci.yml`.
  *(See `## Correction 2` below -- the `workflow_dispatch` pre-merge-proof clause is structurally
  unachievable. The rest of D-08 stands.)*
- **D-09** -- if the detector file gets a spec asserting on it, REGISTER IT in `nx.json`'s `test`
  inputs in the SAME commit (PARITY-08's lesson).
- **D-10** -- a NEW `docs/cross-os.md`, not a section inside `docs/advanced.md`.
- **D-11** -- section ORDER is load-bearing and fixed by the requirement: safe default FIRST,
  portability checklist SECOND framed as how to EARN a removal. Do not lead with the checklist; do
  not merge the two.
- **D-12** -- the checklist items are INHERITED from `08-ROOT-CAUSE.md:1777-1828`. Items 1-5 ship;
  **item 6 is STRUCK, measured FALSE, and its own text says to document NOTHING.**
- **D-13** -- architecture and libc are named as the two axes `process.platform` does not cover, with
  the honest limit stated: this repo cannot exercise either (every machine here is arm64).
- **D-14** -- the drift guard is the shipped phrase-keyed pattern and it is proven RED first. A phrase
  occurring TWICE is only half-locked (`toContain` stops at the first) -- assert a COUNT or key on a
  measured-unique phrase. Observe the red, never predict it.
- **D-15** -- the DOCUMENTED command and `nx.json`'s OWN command are ONE string, single-sourced, and
  the guard asserts the doc renders the literal `nx.json` carries. Editing `nx.json` rotates
  `integration` and `test`; both are affordable because O2 and O3 are CLOSED.
- **D-16 (MEASURED)** -- the rotation table. `ci.yml` -> `test` only. `nx.json` -> `test` plus the
  changed target's block. A new registered `docs/cross-os.md` -> `test`. Anything under `packages/`
  -> `test`+`typecheck`+`integration`; a non-spec `src/` file adds `build`. A NEW unregistered
  root-level workflow file -> NOTHING.
- **D-17** -- there is NO perishable-window ordering constraint; saying so IS the decision. The O4
  proof is a SAME-RUN property. Do not invent a `depends_on` chain to protect a window that does not
  exist -- but DO keep `depends_on` for genuine build-order dependencies.
- **D-18** -- a SAME-REPO pull-request run is the vehicle. NO temporary `main` push. Hard
  precondition: the proving PR is a same-repo branch PR.
  *(See `## Correction 1` -- the CONCLUSION holds and is in fact STRONGER than CONTEXT states, but
  the stated fork-PR reason is FALSE and must be replaced, not repeated.)*
- **D-19** -- counts are PRE-REGISTERED in the PLAN, not written after the run. Per target: whether
  the ubuntu leg is expected to HIT or MISS-and-save, and the expected non-zero `[remote cache]`
  occurrence count on the Windows leg. Count OCCURRENCES: `rg -c` counts LINES, use `rg -o | wc -l`.
- **D-20** -- `Cache: n/m hit` stays marked NON-DISCRIMINATING IN BOTH DIRECTIONS, beside the line.
  The gate is the literal `[remote cache]` label count, named per target.
- **D-21 (MEASURED)** -- keep the `--assert-graph-premise` code, correct the CLAIM, supply the
  REPLACEMENT reason. XOS-04 does not change `integration`'s resolved task set, so the assertion keeps
  passing; what it destroys is the INFERENCE it fed. Rewrite the evidentiary language in BOTH
  `ci.yml`'s comment block above the premise step AND `capture-hashes.mjs`'s contract comment, in the
  SAME commit.
- **D-22** -- the O4 section is APPENDED to `11-EVIDENCE.md`. There is no `12-EVIDENCE.md`. FILL the
  `## O4 (XOS-04, XOS-05) -- RESERVED` block (`:1002-1019`) in place and update the four-row status
  table at `:34` in the same edit.

### Claude's Discretion

- The three Windows job names (`build-windows` / `typecheck-windows` / `test-windows` are the obvious
  form; any consistent scheme is fine as long as the target is in the name).
- The regression-detector workflow's filename, job name, and exact cron minute.
- Whether the detector runs `nx run-many -t build typecheck test --skip-nx-cache` as one command or
  three steps.
- The `docs/cross-os.md` filename, its heading structure, and where it is linked from.
- Whether the DOCS-07 drift guard is a new spec file or an extension of `docs-adoption.spec.ts`.
- Plan count and wave grouping, subject to D-17 and to genuine build-order dependencies.

### Deferred Ideas (OUT OF SCOPE)

- A drift guard over the duplicated sidecar block (count recorded: FOUR copies -> SEVEN).
- An every-commit Vitest version of the graph-premise assertion -- **revisited here and DECLINED**.
- Collapsing the publish matrix to one leg (v0.0.3 trigger).
- Archive file-mode handling across the OS boundary (XOS-05 investigation item, never a requirement).
- PARITY-04's "does my everyday box hit" acceptance question.
- macOS in any form.
- Regenerating `.planning/codebase/*`.
- `roadmap update-plan-progress`'s duplicate plan list; the `requirements mark-complete`
  parenthetical-status defect (hand-correct, as Phase 11 did twice).
</user_constraints>

<phase_requirements>
## Phase Requirements

**FOUR, per `REQUIREMENTS.md:658-665` (authoritative over ROADMAP's table -- CONTEXT D-01).**

| ID | Description | Research Support |
|----|-------------|------------------|
| XOS-04 | `ci.yml` runs `build`, `typecheck` and `test` on a windows-11-arm leg in addition to the ubuntu leg | `## Pattern 1` (three-job shape, verbatim sidecar copy); `## Finding F-5` (`test` MEASURED green on Windows arm64 today, 856/856) |
| XOS-05 | Those Windows legs HIT for all three targets from ubuntu-saved entries; the write decision is explicit and recorded; if they write, the attribution loss is recorded alongside TRUST-11/12 and the `--skip-nx-cache` detector becomes REQUIRED | `## Finding F-3` (the `needs:` durability chain, source-traced); `## Security Domain` (the threat statements); `## Finding F-6` (`--skip-nx-cache` skips read AND write at 23.1.0) |
| XOS-08 | Producer-to-consumer ordering: the Windows legs declare `needs:` on the corresponding ubuntu jobs | `## Finding F-3`; `## Pitfall 3` (what `dogfood-seed -> dogfood-verify` proves and what it does NOT) |
| DOCS-07 | Consumer cross-OS recipe: safe default FIRST, portability checklist SECOND, arch+libc named, **stderr-immune discriminator command**, registered in `nx.json` `test` inputs, drift-guarded | `## U-01 RESOLVED` (the whole section); `## Pattern 4` (drift-guard shape); `## Finding F-7` (the doc's inherited checklist and the single-source-registration cost) |
</phase_requirements>

---

## Summary

**U-01 is settled empirically, in all three of its parts, and the answer is not the one either
branch of CONTEXT's decision tree predicted.** Nx 23.1.0's `hash_runtime` really does concatenate
trimmed stderr onto trimmed stdout before hashing -- quoted from source below -- so the requirement's
premise is TRUE. But the current command's stderr is measured EMPTY on both CI legs (Phase 8's
recorded artifacts) and locally under both of the two shells Nx actually uses, so the hazard is
LATENT, not live. What tips the recommendation is a third measurement CONTEXT did not anticipate: the
node warning channel that `--no-warnings` closes emits text containing the process **PID**, which
makes any warning a *per-invocation-varying* value. One warning would not merely change the
`integration` hash once -- it would change it on every single run, producing a permanent 100% MISS
that reads exactly like a portability failure. `node --no-warnings -p process.platform` is the
measured recommendation, with its residual stated honestly.

**Three CONTEXT claims are factually wrong and each needs a REPLACEMENT reason, not a deletion**
(D-21's own rule, applied to CONTEXT itself). D-18's fork-PR premise is false -- GitHub's 2026-06-26
changelog says verbatim that `pull_request` keeps read-write caching -- but D-18's *conclusion* is
right for a stronger reason it never states: `ci.yml` is `on: push: branches: [main]`, so a phase-branch
push does not trigger CI at all, leaving a PR as the only vehicle short of pushing to `main`. D-08's
claim that `workflow_dispatch` "closes the question before merge, at no cost" is structurally
impossible: GitHub only dispatches workflows whose file exists on the default branch. And the
`--assert-graph-premise` reading in D-21 is confirmed correct, so that one needs nothing.

The rest of the phase is low-risk assembly over shipped, live-proven parts: the sidecar block is
already Windows-correct and has run continuously on `windows-11-arm`; `test` passes on Windows arm64
today (measured this session, 40 files / 856 tests, cache bypassed); `--skip-nx-cache` at Nx 23.1.0
skips read AND write (source-traced, and this is stronger than older Nx behaviour); and three shipped
docs drift guards supply the exact pattern DOCS-07 needs.

**Primary recommendation:** adopt `node --no-warnings -p process.platform` as the single D-15 string,
supersede CORR-04's byte-identical invariant explicitly in the same commit (it is a Phase 8 constraint
with a written reason, so it must be *superseded*, never silently violated), and let the existing
`hash-parity` job -- which reads the discriminator out of `nx.json` and records raw stdout+stderr per
leg -- verify the new command on both runners for free on the next CI run.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Producer-to-consumer job ordering (XOS-08) | CI orchestration (`ci.yml` `needs:`) | -- | `needs:` is a workflow-graph property; nothing in the package can express it |
| Cross-OS cache HIT (XOS-05) | GitHub Actions cache service | Sidecar HTTP server + `@actions/cache` | The HIT is a property of the cache service's ref scope; the sidecar only relays |
| Write-vs-read decision | `select-backend.ts` (context-derived) | -- | TRUST-05: never a caller flag, never an env knob (D2-02). D-06 is FORCED by this tier boundary |
| OS separation of task results | Nx task hasher (`runtime` input) | -- | Since VER-01/VER-03 the STORE no longer partitions by OS; the Nx hash is the SOLE mechanism |
| Windows-only regression detection | A separate scheduled workflow | -- | `--skip-nx-cache` means no cache tier participates at all; the runner is the only tier involved |
| Consumer adoption guidance (DOCS-07) | `docs/` (repo-root, outside the project graph) | `nx.json` `test` inputs + a Vitest drift guard | Docs live outside `{projectRoot}`, so registration is what makes the guard non-stale |
| Evidence of the proof | `11-EVIDENCE.md` (planning tree) | -- | Not an Nx input, so it can neither serve nor suffer a stale cached pass |

---

## U-01 RESOLVED -- the stderr-immune discriminator command

The pre-stated falsifiable check, answered in its stated order.

### (a) Phase 8's recorded per-leg discriminator stdout AND stderr

`capture-hashes.mjs`'s `runDiscriminator` runs the command via `spawnSync(command, { shell: true })`
and records both streams verbatim, never `2>&1`. Node's `shell: true` resolves to `/bin/sh` on POSIX
and `process.env.ComSpec` on Windows -- **byte-for-byte the same two shells Nx's own hasher uses**
(see (b)), so the Phase 8 record is a measurement of exactly the right thing, not a proxy.

| Leg | Recorded value | Citation |
|---|---|---|
| `ubuntu-24.04-arm`, CI | `{ "stdout": "linux\n", "stderr": "" }`, `status: 0` | `08-ROOT-CAUSE.md:753`, `:2587`, `:3013` [VERIFIED: in-repo artifact record] |
| `windows-11-arm`, CI | `{ "stdout": "win32\n", "stderr": "" }`, `status: 0` | `08-ROOT-CAUSE.md:2625`, `:3013` [VERIFIED: in-repo artifact record] |
| Windows arm64 workstation | `{ "stdout": "win32\n", "stderr": "" }` | `08-ROOT-CAUSE.md:536`, `:601`, `:712`, `:2211` [VERIFIED] |

**stderr was EMPTY on BOTH legs.** So the hazard is **LATENT**, not live.

### (b) Nx 23.1.0's `runtime` input hashing -- stderr IS included

The hashing lives in the Rust native addon, not in JS. Located by string-searching the installed
binary (`rg -a -o "packages/nx/src/native/..."` against
`node_modules/@nx/nx-win32-arm64-msvc/nx.win32-arm64-msvc.node`, which yields
`packages\nx\src\native\tasks\hashers\hash_runtime.rs:27` and `:31`), then fetched at the matching tag.
Installed Nx version confirmed `23.1.0` from `node_modules/nx/package.json`.

```rust
// packages/nx/src/native/tasks/hashers/hash_runtime.rs, tag 23.1.0, lines 33-35
let std_out = std::str::from_utf8(&output.stdout)?.trim();
let std_err = std::str::from_utf8(&output.stderr)?.trim();
let hash_result = hash(&[std_out.as_bytes(), std_err.as_bytes()].concat());
```

[VERIFIED: https://raw.githubusercontent.com/nrwl/nx/23.1.0/packages/nx/src/native/tasks/hashers/hash_runtime.rs]

**Three consequences the planner and the doc both need:**

1. **stderr IS hashed.** The premise asserted (uncited) in `REQUIREMENTS.md:458`, `ROADMAP.md:554`,
   `research/v0.0.2/ARCHITECTURE.md:449`, `08-RESEARCH.md:50` and `08-CONTEXT.md:64` is **TRUE**.
   This is the citation those five sites never had.
2. **Both streams are `.trim()`ed before concatenation.** So the trailing newline is irrelevant, and
   a CRLF-vs-LF difference in the discriminator's own output cannot skew the hash. Worth stating in
   the doc: it is the one cross-OS newline hazard that is already closed by Nx.
3. **Concatenation has no separator.** `trim(stdout) + trim(stderr)`. Any non-empty stderr silently
   extends the hashed token.

The shell, from the same source tree:

```rust
// packages/nx/src/native/utils/command.rs, tag 23.1.0, lines 28-43
pub fn create_shell_command() -> Command {
    if cfg!(target_os = "windows") {
        let comspec = std::env::var("COMSPEC");
        let shell = comspec.as_ref().map(|v| v.as_str()).unwrap_or_else(|_| "cmd.exe");
        let mut command = create_command(shell);
        command.arg("/C");
        command
    } else {
        let mut command = create_command("sh");
        command.arg("-c");
        command
    }
}
```

[VERIFIED: https://raw.githubusercontent.com/nrwl/nx/23.1.0/packages/nx/src/native/utils/command.rs]

**This settles the "shell-invariance" question definitively and narrows it.** There is exactly ONE
shell per OS: `%COMSPEC% /C` (default `cmd.exe`) on Windows, `sh -c` everywhere else. So
"shell-invariant" does not mean "works in bash, pwsh, cmd and sh"; it means **the one string must
work correctly under `cmd /C` AND under `sh -c`**. A redirect is still ruled out for the reason
CONTEXT gives, and `--no-warnings` is still shell-agnostic for the reason CONTEXT gives -- but the
target is a two-shell set, not an open-ended one. `hash_runtime` also injects the caller's env into
the command (`env.iter().for_each(|(k, v)| command_builder.env(k, v))`), and `capture-hashes.mjs`
passes `process.env` -- so **the discriminator command runs with the full ambient environment**, which
is what makes the `NODE_OPTIONS` channel below reachable.

### (c) Byte-identical stdout under both shells, and differing between the two OSes

Measured this session on `win32/arm64`, Node `v24.13.0`, both streams captured separately, stdout
dumped through `od -c`:

| Command | Shell | stdout | stderr bytes | exit |
|---|---|---|---|---|
| `node -p process.platform` | `sh -c` | `w i n 3 2 \n` | 0 | 0 |
| `node -p process.platform` | `cmd.exe /C` | `w i n 3 2 \n` | 0 | 0 |
| `node --no-warnings -p process.platform` | `sh -c` | `w i n 3 2 \n` | 0 | 0 |
| `node --no-warnings -p process.platform` | `cmd.exe /C` | `w i n 3 2 \n` | 0 | 0 |

[VERIFIED: local measurement 2026-07-30, `COMSPEC=C:\WINDOWS\system32\cmd.exe`]

Byte-identical across both shells, stderr empty in all four cells, and `linux` vs `win32` differs
between the OSes per (a). **`--no-warnings` costs nothing in stdout and is shell-invariant.**

### The measurement that decides it: the warning channel carries a PID

The instrument was given a **positive control** before its zeros were trusted (this repo's own rule:
pair every absence with a positive control):

```
$ sh -c 'node -p "process.emitWarning(...),process.platform"'
exit=0  stdout=[win32]  stderrBytes=100
    stderr| (node:29864) Warning: probe
    stderr| (Use `node --trace-warnings ...` to show where the warning was created)

$ sh -c 'node --no-warnings -p "process.emitWarning(...),process.platform"'
exit=0  stdout=[win32]  stderrBytes=0
```

[VERIFIED: local measurement 2026-07-30]

Two things follow, and the first is the load-bearing one:

1. **`(node:29864)` is the process PID.** Any warning on the discriminator's stderr therefore makes
   the hashed value **vary on every single invocation**. That is not a one-off hash rotation -- it is
   a permanent, 100% MISS on every target carrying the discriminator, on every run, on every machine.
   And because a MISS is never self-evidencing in this system (fail-closed writes, best-effort reads),
   it presents to an adopter as "cross-OS caching does not work", i.e. exactly the phantom portability
   failure `docs/cross-os.md`'s checklist item 1 exists to pre-empt.
2. **`--no-warnings` closes that channel completely** (100 bytes -> 0), and does so without touching
   stdout.

This warning class is not hypothetical in this repo. The same background run that measured `test` on
Windows emitted, from the toolchain's own worker processes,
`(node:11660) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.` -- a
PID-bearing stderr warning produced by an ordinary env-var combination. (Probed directly against a
bare `node -p` with `FORCE_COLOR=1 NO_COLOR=1` under both shells: **stderr stayed empty**, because
that particular warning needs a TTY and CI/`hash_runtime` stdout is a pipe. Recorded as a negative
result so nobody re-derives it. The class is real; this specific trigger is not reachable here.)

### The residual `--no-warnings` does NOT cover, stated rather than glossed

```
$ NODE_OPTIONS=--experimental-permission sh -c "node -p process.platform"
exit=9  stdout=[]  stderrBytes=148
    stderr| C:\Users\...\fnm_multishells\22840_1785319807646\node.exe: --experimental-permission is not allowed in NODE_OPTIONS

$ NODE_OPTIONS=--experimental-permission cmd.exe /C "node -p process.platform"
exit=9  stdout=[]  stderrBytes=64
    stderr| node: --experimental-permission is not allowed in NODE_OPTIONS
```

`--no-warnings` suppresses neither. [VERIFIED: local measurement 2026-07-30]

Note what this shape actually is: node's **startup-error** channel, which empties stdout and exits
non-zero, and whose text is **machine-specific and shell-specific on the same box** (the absolute
fnm shim path under `sh -c`, a bare `node:` under `cmd /C`). Two honest observations:

- It is a LOUD, total failure, not a silent skew -- the discriminator produces no token at all.
- It opens the one genuine **wrong-result** path in this whole area: if stdout is emptied on BOTH
  OSes and the stderr texts happen to coincide, the discriminator collapses to a single value and
  `integration` silently becomes OS-invariant. In this repo that is caught by `compare.ts`'s
  `integration-not-divergent` clause on every `hash-parity-compare` run; **an adopter has no such
  gate**, which is why the recipe must tell them to verify the command emits a NON-EMPTY token that
  DIFFERS across their OSes, not merely to paste it.

### Verdict

**Adopt `node --no-warnings -p process.platform` as the single D-15 string** (both `nx.json:104` and
`docs/cross-os.md`). Reasoning, ranked:

1. stderr IS hashed [VERIFIED: Nx source]. The requirement's clause is real and must be honoured.
2. The dominant realistic channel is node's warning channel; it is PID-bearing, so it degrades to a
   permanent MISS rather than a one-off rotation [VERIFIED: local positive control].
3. `--no-warnings` closes it, is a node flag rather than a shell construct, and is byte-neutral on
   stdout under both of the two shells Nx uses [VERIFIED: local, 4-cell matrix].
4. The rotation cost is the one D-15 already priced and accepted (`integration` + `test`), and
   nothing perishable depends on the current value (O2/O3 CLOSED, and CORR-03's gate only asserts the
   two legs DIFFER).

**The change is NOT free of a documentation obligation.** `08-ROOT-CAUSE.md:1589` lists
"`integration`'s discriminator stays BYTE-IDENTICAL | D-14, CORR-04 | re-spelling
`{ "runtime": "node -p process.platform" }` in any way" as a bounding constraint, and the prose under
it says "Touching it is a Core-Value regression." That constraint was scoped to Phase 8's fix
("Phase 8 does not re-spell it"), but it is written down with a reason, so Phase 12 must **supersede
it explicitly with a replacement reason** in the same commit -- the exact discipline D-21 imposes on
the graph premise. Do not let a plan silently violate a written invariant.

### Every site the string change touches -- MEASURED, not guessed

`rg -n "node -p process.platform" --glob '!node_modules' --glob '!.nx' .`

| Site | Kind | Action |
|---|---|---|
| `nx.json:104` | the value itself | change |
| `packages/github-cache/src/nx-target-inputs.spec.ts:400` | `expect(runtimeCommands).toEqual([...])` exact-equality pin | change literal |
| `packages/github-cache/src/nx-target-inputs.spec.ts:446` | post-merge exact-equality pin (CORR-04 merged-config guard) | change literal |
| `packages/github-cache/src/hash-parity/compare.spec.ts:99` | fixture value `command: 'node -p process.platform'` | change literal |
| `packages/github-cache/src/hash-parity/compare.spec.ts:281` | comment | update |
| `packages/github-cache/src/hash-parity/compare.ts:9` | contract comment | update |
| `eslint.config.mjs:437` (repo ROOT, not under `packages/`) | comment | update |
| `.github/workflows/ci.yml` `integration` job comment (~`:387`) | comment quoting the string | update |
| `08-ROOT-CAUSE.md:1589`'s byte-identical constraint | written invariant | supersede with a replacement reason, in-commit |

`capture-hashes.mjs` needs NO change for this: `readDiscriminatorCommand` READS the string out of
`nx.json` rather than re-spelling it. That is also why **verification is free** -- see
`## Validation Architecture`.

**M3 in `08-ROOT-CAUSE.md:2148` is the pre-recorded RED for this pin**: re-spelling the discriminator
produced `expected [ Array(1) ] to deeply equal [ 'node -p process.platform' ]`, exactly one failing
test, while the pre-existing CORR-04 "only one runtime input" guard stayed green. The planner gets
the D-14 "observe the red" evidence for free -- the mutation has already been run and recorded; only
the *new* literal needs its own RED.

---

## Three corrections to CONTEXT.md

Each is stated as CONTEXT states it, then falsified, then given a REPLACEMENT reason. None of them
changes a decision's *outcome*; all three change the reason a plan would write into a comment, and a
comment carrying a false reason is a documented argument for undoing the work.

### Correction 1 -- D-18's fork-PR premise is FALSE; its conclusion survives on a stronger reason

**CONTEXT says:** "GitHub's read-only Actions cache for untrusted triggers makes a FORK PR read-only,
so the ubuntu leg would save nothing and BOTH legs would MISS."

**The changelog says the opposite, verbatim:**

> "The most common workflow triggers that write to the default-branch cache keep full read-write
> caching. These triggers are `push`, `schedule`, `workflow_dispatch`, `repository_dispatch`,
> `delete`, `registry_package`, and `page_build`. Additionally, **any trigger that uses a
> non-default-branch scope, such as `pull_request` and `release`, keeps read-write caching
> permission.**"

[CITED: https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/ --
fetched verbatim 2026-07-30; the read-only rule fires only when the trigger is untrusted **AND** the
execution context and cache scope come from the shared default-branch SHA, which names
`pull_request_target`, `issue_comment` and fork `workflow_run` cascades, not `pull_request`.]

The scope mechanics confirm it: "When a cache is created by a workflow run triggered on a pull
request, the cache is created for the merge ref (`refs/pull/.../merge`) ... It cannot be restored by
the base branch or other pull requests targeting that base branch."
[CITED: https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching]

And this repo has already measured it: `11-EVIDENCE.md:997` records "both entries were written under
`refs/pull/11/merge`" on a PR run. So a PR run -- fork or not -- writes into its own merge-ref scope,
and **both legs of the same run share that scope**, which is precisely what the O4 proof needs.

**The REPLACEMENT reason, and it is stronger than the false one:**

`.github/workflows/ci.yml:3-7` is:

```yaml
on:
  push:
    branches:
      - main
  pull_request:
```

[VERIFIED: `ci.yml:3-7`]

A push to `gsd/v0.0.2-os-invariant-cross-os-sharing` **does not trigger CI at all**. The pull-request
event is therefore not the *preferred* vehicle, it is the **only** vehicle short of pushing to `main`
-- which is exactly what D-18 declines. Write that. Two further precise consequences the plan should
carry:

- **The PR-scope entry is ephemeral and isolated.** The proof does not seed `main`'s scope and does
  not seed the Releases mirror. That is fine -- D-17 already establishes the proof is a same-run
  property -- but say so, or a reader will expect a mirror row that never appears.
- **The proof must come from the FIRST run of the PR, never a workflow re-run.** On a re-run the
  ubuntu leg restores from the merge-ref entry the FIRST run saved, so it HITs instead of
  MISS-and-saving. The Windows HIT would still be against Linux-produced bytes, but the *producer
  attribution within the run* evaporates. This is the exact discipline Phase 11 applied to T-11-26
  ("Proof taken from a FRESH push, never a workflow re-run") and it transfers verbatim. Pre-register
  it under D-19.

### Correction 2 -- D-08's `workflow_dispatch` cannot close the question before merge

**CONTEXT says:** "`on: schedule` fires only on the default branch, so the job cannot be proven from
the phase branch -- which is exactly why `workflow_dispatch` is included: it closes the 'does this job
actually run green on windows-11-arm' question before merge, at no cost."

**GitHub docs:** "This event will only trigger a workflow run if the workflow file exists on the
default branch."
[CITED: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows]

A brand-new workflow file on a feature branch **cannot be dispatched at all** -- it does not appear in
the UI and the API rejects it. So `workflow_dispatch` on a new file buys exactly the same pre-merge
proof as `schedule` does: none. Note also that `cleanup.yml` -- the named shape precedent -- carries
`schedule:` **only**, no `workflow_dispatch` [VERIFIED: `cleanup.yml:8-12`].

**What actually closes it, in order of cost:**

1. **Keep `workflow_dispatch`** -- it is still correct and cheap, and it is how the detector gets
   re-run on demand *after* merge. Just delete the false "before merge" clause.
2. **Prove the COMMAND, not the job, before merge.** The detector's substance is
   `nx run-many -t build typecheck test --skip-nx-cache` on Windows arm64 with the demand-the-success-
   line guard. That was run on this workstation this session for `test` -- the target that has never
   executed in Windows CI -- and it passed (see F-5). A pre-merge task can run all three the same way.
   This closes the substantive risk ("do these targets pass on Windows?"); it does not close "does
   the runner label resolve and the YAML parse".
3. **Structurally guard the YAML.** `cleanup-workflow.spec.ts` is the in-repo precedent for a spec
   over a workflow file, and D-09 already requires the registration that makes such a spec non-stale.
   `ppe/action.yml`'s pinned `actionlint 1.7.12` is available if a syntax gate is wanted.
4. **Treat the green-on-runner observation as a POST-MERGE first-run close.** This repo already has
   that pattern by name -- `.planning/codebase/TESTING.md` `## Live-CI first-push close pattern`, and
   `ppe`, `dogfood-*` and `consumer-smoke` are all first-push closes. Use it; do not invent a
   mechanism.

### Correction 3 -- D-21 is CORRECT, and gets a confirmation rather than a fix

`capture-hashes.mjs`'s `assertGraphPremise` resolves over `nx run-many -t integration` (seeded from
every graph node declaring the target) and asserts no `build`/`typecheck`/`test` appears in that set.
The new Windows jobs run `npm run build` / `npm run typecheck` / `npm run test`; they change no
project's declared targets and no `dependsOn`. So the resolved `integration` set is untouched and all
six clauses keep passing. [VERIFIED: `capture-hashes.mjs:501-516`, `:578-691`; wired at
`ci.yml:1065-1072` on both `hash-parity` legs.] D-21's "keep the code, correct the claim, supply the
replacement reason" is exactly right.

---

## Standard Stack

### Core

**No new runtime or dev dependency is added by this phase.** Every mechanism it needs is already
installed, pinned and live.

| Component | Version | Purpose | Why standard |
|---|---|---|---|
| `nx` | 23.1.0 (installed, verified) | task hashing, `runtime` inputs, `--skip-nx-cache` | already the workspace's runner; `capture-hashes.mjs` pins the installed version into every record |
| `vitest` | via `@nx/vitest` | the drift guard and any workflow-shape spec | the repo's only test runner; 40 spec files today |
| `@actions/cache` | 6.2.0 exact | `saveCache`/`restoreCache` behind the sidecar | already pinned and guarded by `pinned-deps.spec.ts` |
| GitHub Actions `needs:` | platform | producer-to-consumer ordering | the only per-job ordering primitive; `dogfood-seed -> dogfood-verify` is the shipped in-repo use |
| GitHub Actions background steps (`background: true` + `- cancel: <id>`) | platform | the sidecar lifecycle | shipped and green on `windows-11-arm` in the `integration` matrix |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| three Windows jobs with `needs:` | a matrix over `[ubuntu, windows]` on each target | STRUCTURALLY foreclosed: `needs:` is per-JOB, so a leg cannot depend on its sibling (D-02 ground 1) |
| three Windows jobs | one `windows-reuse` job with `needs: [build, typecheck, test]` | 5 sidecar copies instead of 7, but collapses three `[remote cache]` observations into one log and delays every target behind the slowest producer (weighed and rejected in D-02) |
| `node --no-warnings -p process.platform` | `node -p process.platform` unchanged | zero rotation cost, and today's stderr is empty -- but leaves a PID-bearing, per-run-varying channel open and cannot honestly be documented as "stderr-immune" |
| `node --no-warnings -p process.platform` | `node -p process.platform 2>/dev/null` | a shell redirect: `2>/dev/null` is `sh`, `2>nul` is `cmd`. Nx runs the string through the platform shell, so a redirect breaks the command on one OS rather than merely differing |
| a `runtime` input | an `env` input on `RUNNER_OS` | CI-only (unset off-CI) and MSYS uppercases env keys while Nx's env hasher is case-sensitive -- already recorded and rejected at `ci.yml:394-396` |

**Installation:** none. No `npm install` step belongs in this phase.

---

## Package Legitimacy Audit

**Not applicable -- this phase installs no external packages.**

Verified rather than asserted: the phase's file list (`ci.yml`, a new workflow file, `nx.json`,
`docs/cross-os.md`, a `docs-*.spec.ts`, `capture-hashes.mjs`, `11-EVIDENCE.md`) contains no
`package.json` and no `package-lock.json`. Phase 11 set the precedent for stating this affirmatively
(`11-SECURITY.md` T-11-SC: "No package installed by any plan. VERIFIED rather than taken on trust").
**If a plan reaches for a new dependency, that is a scope escape and the gate applies from scratch.**

| Package | Registry | Verdict | Disposition |
|---|---|---|---|
| *(none)* | -- | -- | -- |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

---

## Architecture Patterns

### System Architecture Diagram

```
                     one pull_request run, cache scope = refs/pull/N/merge
                     ===========================================================

  checkout (same tree, both legs)
        |
        +--> [ubuntu-24.04-arm]  build ------.
        |         pre-set NX_* vars          |
        |         ./start-cache-server (bg)  |  Nx client --PUT /v1/cache/{H}--> sidecar
        |         wait-for-404-or-200        |        (blocks on the response)
        |         npm run build              |             |
        |         cancel: cache-server       |             v  await backend.put()
        |                                    |        @actions/cache saveCache(nx-cache-H)
        |                                    |             |
        |                                    |             v  -1 disambiguated by lookupOnly probe
        |                                    |        GitHub Actions cache service   <=== DURABLE HERE
        |                                    |             |
        |                                    |         200 <-'   (only now does the PUT return)
        |                                    |
        |                                    `--- job success ---.
        |                                                        |
        |                                                     needs:
        |                                                        v
        +--> [windows-11-arm]   build-windows  (identical sidecar block, verbatim)
                  npm run build
                       |
                  Nx client --GET /v1/cache/{H}--> sidecar --> restoreCache --> 200 + bytes
                       |
                       v
                  "[remote cache]" printed  <=== XOS-05's GATE (count occurrences per target)
                  ...and the task DOES NOT EXECUTE  <=== XOS-05's TRAP

        (same shape, three times over: build / typecheck / test)


  a SEPARATE scheduled workflow, no sidecar, no cache tier at all
  ==============================================================

  schedule '<mm> <hh> * * *'  +  workflow_dispatch
        |
        v
  [windows-11-arm]  nx run-many -t build typecheck test --skip-nx-cache
        |                    (skips READ and WRITE -- source-verified, F-6)
        v
  demand the success LINE, not the exit code  (NO_COLOR: '1')
        |
        v
  hard fail  <=== the ONLY thing that can see a Windows-only regression once O4 lands
```

### Pattern 1: the three Windows jobs (XOS-04 + XOS-08)

**What:** three jobs, `runs-on: windows-11-arm`, each `needs:` its single ubuntu counterpart, each
carrying a VERBATIM copy of the sidecar block.

**When to use:** whenever a consumer job must observe an artifact a producer job created in the same
run. `dogfood-seed -> dogfood-verify` is the shipped instance.

**Example** (the comment-free form used by `typecheck`/`test`, not `build`'s annotated copy):

```yaml
  build-windows:
    # `needs:` here is a PRODUCER-TO-CONSUMER dependency for HIT-ability, NOT a
    # correctness control. PROJECT.md: "cross-OS sharing rests on target
    # platform-agnosticism, NEVER on publish-leg ordering" -- and XOS-06 forbids
    # ordering becoming a correctness control. Without the edge both legs compute the
    # SAME hash, both MISS, both execute, and both race saveCache (TRUST-11).
    needs: build
    runs-on: windows-11-arm
    # Generic hang insurance -- see the build job.
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with:
          node-version-file: '.node-version'
          cache: 'npm'
      - run: npm ci
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
          # ... byte-identical to the existing copies; see build ...
      - run: npm run build
      - cancel: cache-server
```
*(Source: `ci.yml` `typecheck` job, `:281-337`, copied verbatim per D-03.)*

**The invariant comment to update, verbatim as it stands today** -- `ci.yml:294`:
"The EXECUTABLE shell must stay identical across **all four wired jobs** -- only the final
`npm run <target>` line may differ, and only build's copy carries extra comments." Four -> seven, and
the job list with it, in the SAME commit (D-03).

### Pattern 2: the separate scheduled detector (D-08)

`cleanup.yml` is the shape: a top-of-file rationale comment explaining why it is NOT a job in
`ci.yml`, `on: schedule` with an off-the-hour cron, a `permissions:` block scoped to what it needs,
and one job. The detector needs **fewer** permissions than `cleanup.yml`: the workflow default
`contents: read` suffices (it checks out, installs, runs three targets, writes nothing).

### Pattern 3: demand the success LINE, never the exit code

`nx run-many` with no matching target prints "NX No tasks were run" and **exits 0**. The shipped
answer is `ci.yml:37-72`'s `lint` job:

```yaml
      - name: Lint, and prove the lint target actually ran
        env:
          NO_COLOR: '1'
        run: |
          set -euo pipefail
          npm run lint 2>&1 | tee lint.log
          grep -q 'Successfully ran target lint' lint.log
```

`NO_COLOR: '1'` is **load-bearing, not tidiness**: with colour on, Nx bolds the target name
mid-phrase ("ran target `ESC[1m`lint`ESC[22m` for project") and a plain-text match never fires -- a
gate that always fails gets deleted as fast as one that never fires. [VERIFIED: `ci.yml:56-61`]

Confirmed against the live output of this session's Windows run: with `NO_COLOR=1` Nx printed
`NX   Successfully ran target test for project @op-nx/github-cache`, so the phrase
`Successfully ran target <t> for project` is the right needle. Three targets means either three
asserted lines (run-many prints `Successfully ran targets build, typecheck, test for project ...`
when combined) or three separate steps -- **measure the exact combined phrase before pinning it**;
D-14's "observe the red, never predict it" applies to the needle itself.

### Pattern 4: the docs drift guard (DOCS-07)

Two shipped shapes, both valid; `docs-trust.spec.ts` is the stronger where a single source exists.

- **Import-the-source-and-assert-verbatim** (`docs-trust.spec.ts`): imports `TRUSTED_EVENTS` etc. and
  asserts each string renders in the doc, so widening the source trips the build. **This is the shape
  D-15 wants for the discriminator**: read `nx.json`'s `targetDefaults.integration.inputs` runtime
  entry and assert `docs/cross-os.md` renders that exact literal. Equality, single-sourced, no
  re-spelling.
- **Phrase-keyed content assertion** (`docs-same-os-claims.spec.ts`'s `DOCS_08_SITES`): keyed on
  FILE + QUOTED PHRASE, never on a line number, because edits in one commit shift each other's lines.
  Use for the section-order and arch/libc clauses.

Both resolve docs via `new URL('../../../', import.meta.url)`. Both depend on the doc being an
`nx.json` `test` input or they replay a stale pass -- `docs-adoption.spec.ts`'s own header says so.

### Anti-Patterns to Avoid

- **Reading `Cache: n/m hit` as evidence.** Non-discriminating in BOTH directions: `0%` prints
  identically with no sidecar at all (run `30169158892`), and a non-zero count includes local hits.
  Mark it beside the line (D-20).
- **A `needs:` comment that reads as an ordering-correctness argument.** PROJECT.md forbids
  cross-OS sharing resting on leg ordering; XOS-06 forbids `max-parallel` becoming a correctness
  control. Say "producer-to-consumer for HIT-ability" explicitly.
- **A `toContain` on a phrase that occurs twice.** Half-locked; deleting the other occurrence leaves
  the guard green (Phase 11 WR-09). Assert a COUNT or key on a measured-unique phrase.
- **Reading a green O4 CI as evidence the targets are PORTABLE.** Circular -- a restored task does not
  execute. `REQUIREMENTS.md`'s Out of Scope table names it. This is the entire argument for D-08 and
  it belongs at the point the detector is added, not in a distant rationale.
- **Adding `schedule:` to `ci.yml`.** Would fire all nineteen jobs unless every one grew an `if:`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| "did the target actually run?" | an exit-code check | `ci.yml:37-72`'s success-LINE pattern with `NO_COLOR: '1'` | `nx run-many` on a missing target exits 0; measured in this repo |
| a read-only-but-still-reading Actions cache | a new env knob / action input / mode flag | nothing -- D-06's write decision is FORCED | TRUST-05 forbids a caller-facing mode flag; D2-02 forbids a new env knob or input |
| suppressing the discriminator's stderr | `2>/dev/null` / `2>nul` / a wrapper script | `node --no-warnings` | Nx runs the string through `cmd /C` or `sh -c`; a redirect fails on one of them |
| capturing the discriminator's per-leg streams | a new CI step | `capture-hashes.mjs`'s `runDiscriminator`, already wired on both `hash-parity` legs | it READS the command out of `nx.json`, so it cannot drift from the config |
| asserting the graph premise | a new Vitest spec | `capture-hashes.mjs --assert-graph-premise` at `ci.yml:1065`, both legs | Phase 11 deferred the spec; CONTEXT revisits and DECLINES it -- it would rotate three hashes to duplicate a live gate |
| a divergence-detection subsystem | anything | the `--skip-nx-cache` detector | structurally impossible otherwise: every detector that exists re-executes the task. Out of Scope by name |
| an OS-invariance knob per job/target | anything | the `runtime` discriminator in `targetDefaults` | D2-02, and PROJECT.md's "no OS-separation knob" |

**Key insight:** every mechanism this phase needs already exists, is live, and has been exercised on
a real `windows-11-arm` runner. The phase's genuine new work is three job blocks, one workflow file,
one doc, one guard, and four comment corrections. Anything larger is scope escape.

---

## Common Pitfalls

### Pitfall 1: reading `--skip-nx-cache` as read-only-bypass

**What goes wrong:** a planner assumes (correctly for older Nx) that `--skip-nx-cache` still WRITES,
and either adds a guard against a phantom fifth cache producer or, worse, believes the detector's
results are being cached and drops the flag.
**Root cause:** the behaviour changed. See F-6 -- at 23.1.0 the flag skips read AND write.
**Avoid:** cite the source trace. With no sidecar and no `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` in the
detector's env, there is no remote tier at all regardless.

### Pitfall 2: proving O4 on a workflow RE-RUN

**What goes wrong:** the ubuntu leg HITs the merge-ref entry its own earlier run saved, so the
pre-registered "MISS-and-save" prediction fails and the in-run producer attribution evaporates.
**Root cause:** PR cache scope is `refs/pull/N/merge` and persists across re-runs of the same PR.
**Avoid:** pre-register "FIRST run of the PR only" under D-19, exactly as Phase 11 did for T-11-26.
**Warning sign:** the ubuntu leg logging `[remote cache]` when the plan predicted a MISS.

### Pitfall 3: over-reading `dogfood-seed -> dogfood-verify`

**What it PROVES:** an entry `saveCache`d in one job is `restoreCache`-able from a dependent job on
BOTH `ubuntu-24.04-arm` and `windows-11-arm`, green for two milestones, with a PROVENANCE check (the
literal `linux` producer stamp folded into the payload), not merely a presence check.

**What it does NOT prove, and each gap matters here:**

- **It has never run on a `pull_request`.** Both jobs are `if: github.event_name == 'push'`
  [VERIFIED: `ci.yml:1269`, `:1321`]. The O4 proving run is a PR run. So the PR-scope path is
  *inferred* from `11-EVIDENCE.md:997`'s measured `refs/pull/11/merge` observation, not from dogfood.
- **It does not exercise the sidecar.** Both dogfood jobs run `uses: ./packages/github-cache` -- the
  action calls `saveCache`/`restoreCache` directly. The new legs go through the HTTP sidecar. Same
  `@actions/cache` underneath, different transport. `ci.yml` already records the related misreading
  ("A GREEN dogfood-verify IS NOT ROBUST-04 EVIDENCE").
- **Its key is `nx-cache-<run_id>`, one key per RUN.** The new legs use `nx-cache-<hash>`, which
  pre-existing entries from other refs may also carry. `build` in particular may HIT a pre-existing
  entry on the ubuntu leg (D-19 anticipates this).

### Pitfall 4: the XOS-05 trap -- success and total failure look identical

XOS-05's own words: "the success signal for O4 (every target `[remote cache]`, wall time collapsing
to sidecar overhead) is the identical observation" to a Windows-only regression being invisible
forever. A green O4 leg **is** a Windows leg that did not run the code. Put this sentence at the
point the D-08 detector is added, not in a distant rationale (CONTEXT `<specifics>` asks for exactly
this).

### Pitfall 5: `test` executing on Windows for the first time and hitting the `69bd1b7` flake

`deferred-items.md` #1 records one unattributed `test` failure at `69bd1b7` whose output was
discarded; Nx's own flaky-task detection then fired (a FAILURE and a SUCCESS at the SAME hash). Under
XOS-04 the Windows leg is *supposed* to HIT and never execute `test`, so the flake surfaces only in
the D-08 detector -- where output is not discarded. **If it fires, capture the output BEFORE
re-running.** Mitigating measurement: F-5 below ran the whole suite on Windows arm64 with the cache
bypassed and it passed 856/856.

### Pitfall 6: locating anything in `ci.yml` by line number

1736 lines, drifted ~470 inside two milestones. Locate by JOB NAME. Current anchors, measured this
session: `format-check:13`, `lint:37`, `fallow:81`, `action-bundle-drift:99`, `pack-check:121`,
`ppe:144`, `build:207`, `typecheck:281`, `test:339`, `integration:416`, `o3-witness:665`,
`hash-parity:998`, `hash-parity-compare:1214`, `dogfood-seed:1266`, `dogfood-verify:1289`,
`consumer-smoke:1367`, `publish:1502`, `publish-verify:1716` -- **19 jobs including the two matrices'
legs; treat these numbers as expiring the moment the first plan edits the file.**

### Pitfall 7: `git grep` in `node_modules/`

The U-01 answer lives in `node_modules/@nx/nx-win32-arm64-msvc/*.node` and
`node_modules/nx/dist/**`. `git grep` returns a SILENT ZERO there and the zero reads as confirmation
of absence. Use `rg` with an explicit path (no flags needed -- ignore rules do not apply at or above
`rg`'s own walk root). Check the exit code: 0 = hits, 1 = genuine no-match, **2 = the command FAILED**.

---

## Code Examples

### Reading the discriminator out of `nx.json` for the D-15 equality guard

```typescript
// The docs-trust.spec.ts shape: import/read the single source, assert the doc
// renders it verbatim. Never re-spell the literal in the spec -- that is the
// drift the guard exists to catch.
import { readFileSync } from 'node:fs';

const repoRoot = new URL('../../../', import.meta.url);
const nxJson = JSON.parse(readFileSync(new URL('nx.json', repoRoot), 'utf8'));

const runtimeCommands: string[] = nxJson.targetDefaults.integration.inputs.flatMap(
  (input: unknown) =>
    typeof input === 'object' && input !== null && 'runtime' in input
      ? [(input as { runtime: string }).runtime]
      : [],
);

it('cross-os.md renders the discriminator nx.json actually declares', () => {
  // Exact equality on the whole extracted list, never toContain: a SECOND runtime
  // entry is as much a CORR-04 event as the string changing.
  expect(runtimeCommands).toHaveLength(1);

  const doc = readFileSync(new URL('docs/cross-os.md', repoRoot), 'utf8');
  const occurrences = doc.split(runtimeCommands[0]).length - 1;

  // A COUNT, not toContain -- WR-09: a phrase occurring twice is only half-locked.
  expect(occurrences).toBeGreaterThanOrEqual(1);
});
```
*(Pattern source: `packages/github-cache/src/docs-trust.spec.ts`, and the exact-equality idiom at
`nx-target-inputs.spec.ts:394-401`.)*

### The detector's command and its non-vacuity guard

```yaml
      - name: Run the three targets with the cache bypassed, and prove they ran
        env:
          NO_COLOR: '1'
        run: |
          set -euo pipefail
          npm exec -- nx run-many -t build typecheck test --skip-nx-cache 2>&1 | tee detector.log
          # Exit 0 is NOT sufficient: nx run-many on a MISSING target prints
          # "NX No tasks were run" and exits 0. Demand the success LINE.
          # MEASURE the exact combined phrase before pinning it -- run-many prints
          # "Successfully ran targets build, typecheck, test for project ..." for a
          # multi-target invocation and "Successfully ran target <t> for project ..."
          # for a single one. Observe the red; never predict it.
          grep -q 'Successfully ran target' detector.log
```

---

## State of the Art

| Old approach | Current approach | When changed | Impact here |
|---|---|---|---|
| `--skip-nx-cache` skips READ but still WRITES | at Nx 23.1.0 `doNotSkipCache` is threaded into `postRunSteps(results, shouldCache, ...)`, so it skips BOTH | 23.x (source-verified at 23.1.0) | the detector adds no cache producer even if a remote tier were present |
| fork-PR / untrusted triggers get read-write cache tokens | untrusted triggers writing to the **default-branch** cache get a read-only token; `pull_request` and `release` keep read-write on their non-default scope | 2026-06-26 | Correction 1: D-18's stated reason is false |
| Actions cache version partitions by runner OS | `enableCrossOsArchive` at all three call sites (VER-01/VER-03) removed the OS partition; the Nx `runtime` discriminator is the SOLE separation | v0.0.2, Phases 9-10 | the whole premise of O4, and why DOCS-07 leads with "declare the discriminator everywhere" |
| Nx exposes `src/**` directly in the package | Nx 23.1.0 ships under `node_modules/nx/dist/src/**`, and task hashing lives in the Rust `.node` addon | 23.x | `git grep`/`rg` on `node_modules/nx/src` false-zeroes; `capture-hashes.mjs` already imports `nx/src/...` via the package's export map |

**Deprecated / outdated in this repo's own record:**

- `08-ROOT-CAUSE.md` checklist **item 6** -- struck, measured FALSE, and its own text says to document
  NOTHING. Do not re-import the struck text into `docs/cross-os.md`.
- `.planning/codebase/*.md` -- mapped 2026-07-22 against v0.0.1, materially invalidated by v0.0.2.
  Conventions only; never for facts about the current tree.
- `AGENTS.md`'s per-worktree Nx cache claim -- false at Nx 23.1.0 (`sharedCacheDirectory()` resolves
  the MAIN worktree root). Surfaced-not-fixed in `08-ROOT-CAUSE.md:1832`; it IS checklist item 3's
  second half, so `docs/cross-os.md` states the true version.

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

Actionable directives extracted from `./CLAUDE.md` (which `@`-includes `./AGENTS.md`) and the global
user memory. The planner must not produce a task that contradicts any of these.

| Directive | Source | Consequence for this phase |
|---|---|---|
| Start work through a GSD command; no direct repo edits outside a GSD workflow | CLAUDE.md `## GSD Workflow Enforcement` | plans execute via `/gsd:execute-phase` |
| Prefer `nx run` / `run-many` / `affected` over underlying tooling; prefix with the package manager | AGENTS.md | the detector uses `nx run-many`, invoked through npm |
| NEVER guess CLI flags -- check `nx_docs` or `--help` | AGENTS.md | `--skip-nx-cache` was verified against installed source, not assumed |
| Invoke the `nx-workspace` skill for workspace navigation; `nx-generate` FIRST for scaffolding | AGENTS.md | no scaffolding in this phase; a new workflow file and a new doc are plain files |
| **Never `git add .` / `-A` / `-u`; stage specific files by name** | global | every plan's commit step names its files |
| **No AI attribution in commits** (no `Co-Authored-By`, no "Generated with") | global | applies to every commit in the phase |
| **Never use the `grep` command or the Grep tool**; `git grep` for tracked, `rg` for gitignored/untracked; `\| rg` never `\| grep` in pipes | global | note: the *shipped* `ci.yml` uses `grep -q` INSIDE a workflow (that is runner-side POSIX and is correct); the rule governs the agent's own shell |
| Never write multi-line content via Bash heredoc/echo -- use the Write tool | global | the new workflow file and `docs/cross-os.md` are written with Write |
| **Never use emojis, box-drawing, em/en dashes, curly quotes or any non-ASCII** in output, scripts, comments or docs | global | `docs/cross-os.md` and every new comment must be pure ASCII (`--`, `->`, `\|--`) |
| Prettier with `"singleQuote": true`; ESLint | global + repo | new spec files follow the repo's flat config; `nx format:check --all` gates |
| Blank lines around control flow and returns; always braces | global JS/TS style | applies to the new spec |
| TypeScript LSP diagnostics are NOT authoritative -- trust `nx test` / `nx build` | global | do not chase `new-diagnostics` noise into scope |
| `git commit -m` fails with EINVAL on the D: Dev Drive -- use `git commit -F <file>` | project memory | every commit step |
| Public-repo email hygiene: only the approved public gmail may appear in committed content | global | `governance-email.spec.ts` already gates it; `docs/cross-os.md` should carry no contact address |
| Action bundle: editing any `serve()`-reachable source drifts `start-cache-server/index.js`; regenerate in the SAME commit | project memory | this phase edits no `serve()`-reachable source -- **verify that stays true**; `action-bundle-drift` is the gate |
| `check:action` false-drifts in a junctioned worktree (esbuild rewrites 689 module paths) | project memory | if plans run in worktrees, do NOT read a `check:action` diff there as real |

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | everything | yes | v24.13.0 local (`.node-version` = `lts/krypton`; CI measured v24.18.0 on Windows, per `08-ROOT-CAUSE.md`) | -- |
| `nx` | hashing, the detector command | yes | 23.1.0 (verified from `node_modules/nx/package.json`) | -- |
| `@nx/nx-win32-arm64-msvc` | the native hasher on this box | yes | matches nx 23.1.0 | -- |
| `cmd.exe` (`%COMSPEC%`) | Nx's Windows shell for `runtime` inputs | yes | `C:\WINDOWS\system32\cmd.exe` | -- |
| `sh` | Nx's POSIX shell for `runtime` inputs | yes (Git Bash) | -- | -- |
| `rg` | searching `node_modules/` | yes | -- | -- |
| `windows-11-arm` GitHub runner | XOS-04/05/08, the detector | **live-CI only** | -- | none -- the HIT is unobservable off-runner by construction |
| `ubuntu-24.04-arm` GitHub runner | the producer leg | **live-CI only** | -- | none |
| GitHub Actions cache service | the HIT itself | **live-CI only** | -- | none |

**Missing dependencies with no fallback:** the three live-CI items above. This is inherent, named in
ROADMAP's `Live-CI close` line, and is why `11-EVIDENCE.md`'s RESERVED O4 section exists.

**Missing dependencies with fallback:** none.

---

## Runtime State Inventory

**Omitted deliberately -- this is not a rename / refactor / migration phase.** It adds jobs, a
workflow file and a doc, and changes one config value.

The one item that *would* belong here is stated instead where it matters: changing `nx.json:104`
rotates `integration` and `test`, which invalidates existing Actions-cache entries for those hashes.
That is cache invalidation, not stored state requiring migration -- the old entries age out under the
30-day retention and nothing reads them by name. D-15 already prices this.

---

## Validation Architecture

Nyquist validation is ENABLED (`.planning/config.json` `workflow.nyquist_validation: true`), and
`workflow.tdd_mode: true`.

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest via `@nx/vitest` (inferred `test` target, `testTargetName: "test"`) |
| Config file | `packages/github-cache/vitest.config.mts` (unit); `vitest.integration.config.mts` (integration) |
| Quick run command | `npx nx run @op-nx/github-cache:test --skip-nx-cache` (measured 3.8 s this session) |
| Full suite command | `npm run test` (`nx run-many -t test`) |
| Current baseline | **40 test files / 856 tests, all passing on win32/arm64** (measured 2026-07-30) |

### The honest constraint, stated before the map

Three of this phase's four requirements are **not Vitest-testable by construction**:

- **XOS-05's HIT** is a property of the GitHub Actions cache service observed in a runner log. No
  spec can produce it. `REQUIREMENTS.md` and ROADMAP both say so (`Live-CI close`).
- **XOS-04/XOS-08's *effect*** (that the Windows leg actually reuses the ubuntu artifact) is the same
  observation.
- **DOCS-07's *quality*** (is the recipe correct and safe?) is a review judgement, not an assertion.

What IS mechanically testable is the **shape** of each: that the jobs exist with the right
`runs-on`/`needs:`, that the doc exists and renders the single-sourced literal, that the discriminator
is registered exactly once, and that the doc is an `nx.json` input so the guard cannot replay a stale
pass. Proposing specs for the unobservable half would manufacture false coverage -- the exact defect
`08-ROOT-CAUSE.md:2056` names ("a textual assertion that `nx.json` CONTAINS the discriminator does NOT
satisfy CORR-03").

### Phase Requirements -> Test Map

| Req | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| XOS-04 | `ci.yml` declares `build-windows`/`typecheck-windows`/`test-windows`, each `runs-on: windows-11-arm` | unit (YAML shape) | `npx nx run @op-nx/github-cache:test -- -t "windows"` | WAVE 0 (extend `dogfood-cross-os.spec.ts`, the shipped `ci.yml`-shape guard) |
| XOS-08 | each Windows job declares `needs:` on exactly its one ubuntu counterpart | unit (YAML shape) | same spec | WAVE 0 |
| XOS-08 | the sidecar block is byte-identical across all seven wired jobs | unit (optional) | same spec | **DEFERRED by CONTEXT** -- the block drift guard is an explicit Deferred Idea. Do NOT add it |
| XOS-05 | the Windows legs log `[remote cache]` for all three targets | **live-CI only** | none -- read the run log, count OCCURRENCES (`rg -o \| wc -l`) against D-19's pre-registered numbers | n/a |
| XOS-05 | the write decision + attribution loss is recorded alongside TRUST-11/12 | doc artifact | none (a `.planning/**` edit; not an Nx input, correctly ungated) | n/a |
| XOS-05 | the detector workflow exists, is `windows-11-arm`, uses `--skip-nx-cache`, and demands the success LINE | unit (YAML shape) | `npx nx run @op-nx/github-cache:test -- -t "detector"` | WAVE 0 (`cleanup-workflow.spec.ts` is the shape precedent) -- **and D-09 requires registering the new workflow file in `nx.json` `test` inputs IN THE SAME COMMIT, or this spec replays a stale pass** |
| XOS-05 | the detector actually goes green on a `windows-11-arm` runner | **live-CI only, POST-MERGE** | `workflow_dispatch` after the file reaches `main` (Correction 2) | n/a |
| DOCS-07 | `docs/cross-os.md` exists and is an `nx.json` `test` input | unit | `npx nx run @op-nx/github-cache:test -- -t "cross-os"` | WAVE 0 |
| DOCS-07 | safe default FIRST, portability checklist SECOND | unit (ordered index assertion, phrase-keyed) | same | WAVE 0 |
| DOCS-07 | the doc names architecture AND libc, and states this repo cannot exercise either | unit (phrase-keyed, COUNT-asserted) | same | WAVE 0 |
| DOCS-07 | the doc renders the exact discriminator literal `nx.json` declares | unit (single-sourced equality) | same | WAVE 0 -- the `docs-trust.spec.ts` shape |
| DOCS-07 | `nx.json` declares exactly ONE runtime input and it is the new literal | unit | `npx nx run @op-nx/github-cache:test -- -t "discriminator"` | **EXISTS** -- `nx-target-inputs.spec.ts:400` and `:446`; update both literals |
| DOCS-07 (U-01) | the new command's raw stdout AND stderr, per OS, on real runners | **live-CI, but FREE** | already wired: `capture-hashes.mjs` reads the command out of `nx.json` and records both streams into `hash-parity-<os>.json` on both `hash-parity` legs | **EXISTS** -- no new instrument needed |

### Sampling rate

- **Per task commit:** `npx nx run @op-nx/github-cache:test` (3.8 s cold on this box).
- **Per wave merge:** `npm run test && npm run typecheck && npm run lint && npx nx format:check --all`.
- **Phase gate:** full suite green, plus `npm run check:action` from the MAIN tree (never a junctioned
  worktree -- project memory records a 689-module false drift there).

### Wave 0 gaps

- [ ] `ci.yml` Windows-job shape assertions -- extend `packages/github-cache/src/dogfood-cross-os.spec.ts`
      (already asserts on `ci.yml` and already has `ci.yml` registered as a `test` input).
- [ ] Detector-workflow shape assertions -- new describe block, `cleanup-workflow.spec.ts` shape.
- [ ] **`nx.json` `test` input registration for the new workflow file** -- same commit as the spec (D-09).
- [ ] **`nx.json` `test` input registration for `docs/cross-os.md`** -- same commit as the doc (DOCS-07).
- [ ] `docs/cross-os.md` drift guard -- new spec file or a `docs-adoption.spec.ts` extension
      (Claude's discretion per CONTEXT).
- [ ] Update the two discriminator literals in `nx-target-inputs.spec.ts` and the fixture in
      `hash-parity/compare.spec.ts:99`.
- [ ] Framework install: **none needed.**

**Every new guard must be OBSERVED RED before it is trusted** (D-14, and this repo's standing rule):
mutate the thing it asserts on, confirm the named assertion fails with the right cause, revert.
Note the accelerant: `08-ROOT-CAUSE.md:2148` already records mutation M3 for the discriminator pin.

---

## Security Domain

`workflow.security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: "high"`.

**The concrete delta is exactly one thing: a SECOND WRITER on an existing write path.** No new
credential, no new write PATH, no new package, no new network egress. Established by the file list
and by D-06's measurement of `select-backend.ts`.

### Applicable ASVS L1 categories

| ASVS category | Applies | Standard control already in place |
|---|---|---|
| V2 Authentication | yes | sidecar bearer token: per-process `crypto.randomBytes(32)`, compared as fixed 32-byte SHA-256 digests via `timingSafeEqual`. Unchanged by this phase; the new legs mint their own per job |
| V3 Session management | no | stateless HTTP, no sessions |
| V4 Access control | yes | `selectBackend` is the single context-derived RW/RO decision point; `isWriteTrusted` default-denies. **D2-02 and TRUST-05 forbid this phase adding any knob to either** |
| V5 Input validation | yes | `^[a-f0-9]{1,512}$` hash validation after auth, before any backend call; `MAX_CACHE_BODY_BYTES` 2 GiB Content-Length precheck + streaming socket-destroy. Unchanged |
| V6 Cryptography | yes | `crypto.randomBytes` / `timingSafeEqual` only; nothing hand-rolled. Unchanged |
| V7 Error handling / logging | yes | fail-closed writes (put fault -> 500), best-effort reads (get fault -> 404 MISS). The new legs inherit it |
| V14 Configuration | yes | workflow-level `permissions: contents: read`; `GITHUB_TOKEN` passed by **process inheritance into the action step only**, never through `$GITHUB_ENV` |

### Threat statements for `<threat_model>`

Grounded in `.planning/THREAT-MODEL.md`'s C1-C18 ledger, `10-SECURITY.md`'s TRUST-11/12
classification, and `11-SECURITY.md`'s T-11-27. Severities proposed as INPUT to the auditor, never
as its conclusion (TRUST-13's own posture).

| Proposed ID | Statement | STRIDE | Sev | Proposed mitigation / disposition |
|---|---|---|---|---|
| T-12-01 | **The second-producer fact.** From this commit, a `windows-11-arm` job can `saveCache(nx-cache-H)` for `build`/`typecheck`/`test`. "Any such hash in the store is Linux-produced" (O1's attribution) is permanently FALSE | Tampering | medium | **Accept and RECORD.** D-02's `needs:` edge removes the concurrent RACE; it does NOT remove the second producer. TRUST-11 predicted both halves. **An appended note claiming the race is gone without saying the producer count changed would be half true** -- record both, per CONTEXT `<specifics>` |
| T-12-02 | **First-write-wins arbitration between non-identical payloads.** The winner owns the entry INCLUDING its OS-specific captured terminal output (`ci.yml:652`) | Tampering | medium | mitigate -- `needs:` serializes the two producers, so the ubuntu leg always wins for a given hash within a run. Cross-RUN the winner is still whichever ran first; no requirement DEPENDS on the winner (XOS-06's posture) |
| T-12-03 | **Exposure delta on a public repo.** Windows-produced terminal output for these three targets can now reach the anonymously-readable Releases mirror | Information disclosure | low | Accept, appended to TRUST-12's existing record. `publish` is `push`-gated and `isSyncTrusted` is a separate allowlist (C2); the mirror filter admits only server-produced keys (C16). The delta is *which OS's* output, not *whether* output crosses |
| T-12-04 | **`$GITHUB_ENV` injection from a record-controlled value** -- the T-11-27 shape | Elevation of privilege | critical **if present** | **CHECK, do not assume.** The three new legs' only `$GITHUB_ENV` writes are the two `NX_*` vars from the verbatim sidecar block, whose values are a fixed literal URL and a locally minted `randomBytes(32)` hex token -- neither is record-, artifact- or PR-controlled. The detector writes no `$GITHUB_ENV` at all. **A plan that adds any `echo "X=${...}" >> "$GITHUB_ENV"` from a downloaded or computed value reintroduces T-11-27** and must be blocked. T-11-28 records that no guard asserts this absence |
| T-12-05 | **The bearer token reaching a log.** Three more jobs mint and export a loopback token | Information disclosure | low | mitigate -- the copied block masks BEFORE the `$GITHUB_ENV` write (`::add-mask::` precedes the echo), which is load-bearing: `entry.ts`'s `core.setSecret` only redacts once the action step starts. **The verbatim-copy discipline of D-03 is what preserves this**; a "cleaned up" copy that reorders the two lines is a real leak |
| T-12-06 | **A fork PR reaching the write-trusted branch.** `HOST_GATED_EVENTS` admits `pull_request` on github.com, and the changelog confirms `pull_request` keeps read-write caching | Elevation of privilege | low | Accept, unchanged from C1's recorded posture: the in-code host gate is **fork-spoofable defense-in-depth ONLY**; the load-bearing controls are GitHub's server-side guard plus Actions-cache **scope isolation** (a fork PR writes only to `refs/pull/N/merge`, unreadable from the base branch -- [CITED: GitHub caching docs]). The three new legs widen the *number of jobs* on that path, not the path |
| T-12-07 | **A new workflow file introducing an unsafe trigger.** The detector adds `schedule` + `workflow_dispatch` | Elevation of privilege | low | mitigate -- both are in the "trusted, collaborator-only" set per the 2026-06-26 changelog; `schedule` is already in `TRUSTED_EVENTS`; `workflow_dispatch` is deliberately absent from BOTH allowlists and stays that way (`trust.ts:22-29`: "Do not re-add them"). The detector needs no cache write, so this never matters. `ppe/action.yml` (zizmor + actionlint, exact-pinned) is available as advisory C4 hygiene |
| T-12-08 | **A doc that tells adopters to do something unsafe.** `docs/cross-os.md` is consumer-facing | Tampering (by proxy) | medium | mitigate by DESIGN -- D-11's section order IS the control: safe-by-default first, removal-by-proof second. C14/C15 already forbid the doc from recommending fork-PR write tokens or framing retention as poison-containment. The drift guard pins the order |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Cache poisoning via an untrusted writer (CREEP, CVE-2025-36852) | Tampering | C1 write-trust allowlist (default-deny) + C2 separate sync gate + GitHub's server-side read-only token; scope isolation |
| Script injection into `$GITHUB_ENV` / `$GITHUB_OUTPUT` | Elevation of privilege | never write a record-derived value; shape-check before any sink (T-11-27's fix) |
| Secret echoed before masking | Information disclosure | `::add-mask::` strictly before the value's first appearance |
| An unpinned third-party action | Supply chain | this phase adds none; every `uses:` is `actions/*@vN` or a local `./` path |

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `--no-warnings` behaves identically on `linux/arm64` (measured only on `win32/arm64` here) | U-01 verdict | LOW -- it is a documented Node CLI flag with no platform-specific semantics, and the next `hash-parity` run measures it on both legs for free. But the phase should READ that artifact rather than assume |
| A2 | The combined multi-target success phrase is `Successfully ran targets build, typecheck, test for project ...` | Pattern 3 / detector | MEDIUM -- a wrong needle makes the guard fail on every run and it gets deleted. **Measure it**; D-14's "observe the red" covers this |
| A3 | The three new legs will not need any adaptation to the sidecar block | Pattern 1 | LOW -- the block already runs on `windows-11-arm` continuously as the `integration` Windows leg, `shell: bash` everywhere, `node` not `openssl` |
| A4 | `build` and `typecheck` also pass on `windows-11-arm` (only `test` was run to completion here) | F-5 | LOW -- both run on this Windows arm64 box routinely; and the `hash-parity` Windows leg already does `npm ci` + build there |
| A5 | GitHub Actions background steps (`background: true` / `- cancel:`) behave the same on `windows-11-arm` for these three jobs as for `integration` | Pattern 1 | LOW -- same runner label, same block, live for two milestones |
| A6 | The `69bd1b7` `test` flake will not fire on the Windows detector | Pitfall 5 | MEDIUM -- it has never been attributed. Mitigated: 856/856 passed here. Capture output BEFORE re-running if it fires |

---

## Open Questions

> **ALL FOUR RESOLVED (2026-07-30, at the plan-check gate).** Each question below carries an explicit
> `**Recommendation:**`, and every one of those recommendations is concretely implemented by a task in
> `12-01-PLAN.md` .. `12-06-PLAN.md` -- verified by the plan-checker against task text rather than
> against the coverage table (`12-PLAN-CHECK.md`, WARNING 2). They are retained as questions, not
> rewritten as decisions, because the REASONING is what a future reader needs: each one records what
> was known, what was unclear, and why the recommendation was safe to take. Nothing here is awaiting
> an answer. If a plan is revised in a way that departs from one of these recommendations, re-open the
> corresponding question rather than editing this marker.

1. **Does the maintainer accept superseding CORR-04's byte-identical discriminator invariant?**
   *(RESOLVED -- recommendation taken; superseded in-commit with a replacement reason by `12-04`.)*
   - Known: the invariant is written at `08-ROOT-CAUSE.md:1589` with a reason, scoped in its prose to
     Phase 8 ("Phase 8 does not re-spell it"), and pinned by two exact-equality specs.
   - Unclear: whether the maintainer reads it as phase-scoped (my reading) or project-scoped.
   - **Recommendation:** treat it as phase-scoped and SUPERSEDE it explicitly in-commit with the
     replacement reason (stderr is hashed; the warning channel is PID-bearing). If the planner is
     unwilling to supersede, the fallback is to keep `node -p process.platform` in `nx.json` -- but
     then D-15's single-string lock forces the DOC to show the un-hardened form, and DOCS-07's
     stderr-immunity clause cannot be honoured. Those two cannot both be satisfied without the change.

2. **One combined detector command or three steps?** (Claude's discretion per CONTEXT.)
   - Known: one command means one success line to assert; three steps means three targets each named
     in a red leg.
   - **Recommendation:** ONE `nx run-many -t build typecheck test --skip-nx-cache` invocation. Nx
     already names the failing target in its own output, and one invocation shares the graph load.
     Lazier and no less diagnostic.

3. **Where does `docs/cross-os.md` get linked from?** (Claude's discretion.)
   - Known: `README.md:145-153` carries the docs nav (Configuration / Advanced / Trust and security /
     Versioning / Examples). `docs/` holds exactly four topic files today.
   - **Recommendation:** README nav (it is the milestone's headline consumer deliverable) plus one
     cross-link from `docs/advanced.md`, whose publish/mirror content is where a reader hits the
     cross-OS question. Both files are already `test` inputs, so a nav-presence assertion is cheap.

4. **Does the `test` target's Windows execution ever actually happen after O4 lands?**
   - Known: no. Under XOS-04 the Windows leg HITs and never executes. The detector is the only path.
   - **Recommendation:** state this in the D-08 detector's header comment, in XOS-05's own words.
     It is the sharpest sentence in the phase and CONTEXT explicitly asks for it at that location.

---

## Numbered findings referenced above

- **F-1** -- `hash_runtime` concatenates `trim(stdout) + trim(stderr)` and hashes both.
  [VERIFIED: Nx 23.1.0 source]
- **F-2** -- Nx's `runtime` shell is `%COMSPEC% /C` on Windows and `sh -c` elsewhere; the caller's env
  is injected into the command. [VERIFIED: Nx 23.1.0 source]
- **F-3** -- **the `needs:` durability chain.** `server.ts:253` does `result = await backend.put(hash, bytes)`
  before writing any status; `actions-cache-backend.ts:166-206` does `await writeFile` -> `saveCache`
  -> and disambiguates the ambiguous `-1` with a `lookupOnly` existence probe before answering
  `stored`(200) or `conflict`(409). So **the Nx client's PUT does not return until the entry is
  confirmed present in the Actions cache service.** `npm run <target>` cannot exit before its PUTs
  return; `cancel: cache-server` runs after that; job success runs after that; `needs:` runs after
  that. **`needs:` is a strictly stronger barrier than XOS-08 requires** -- the durability is already
  established four steps earlier, inside the producer's own `run:` step. [VERIFIED: in-repo source]
- **F-4** -- a PR run's cache entries are written to `refs/pull/N/merge`; both legs of one run share
  that scope. [CITED: GitHub caching docs; corroborated in-repo by `11-EVIDENCE.md:997`]
- **F-5** -- **`test` passes on `win32/arm64` today**: `npx nx run-many -t test --skip-nx-cache`,
  exit 0, `40 passed (40)` files, `856 passed (856)` tests, 3.3 s, `Cache: Skipped (--skip-nx-cache)`.
  [VERIFIED: local measurement 2026-07-30]
- **F-6** -- **`--skip-nx-cache` skips READ and WRITE at Nx 23.1.0.**
  `task-orchestrator.js:121-122` computes `doNotSkipCache = skipNxCache === false || skipNxCache === undefined`;
  it gates the read via `executeCoordinatorLoop(doNotSkipCache, ...)` AND is passed as the
  `shouldCache` argument of `postRunSteps(...)` at `:537`, `:700`, `:740` for genuinely-executed
  tasks (`:980` `if (shouldCache && !this.stopRequested)` wraps the `cache.put` batch). Replays pass
  `false` explicitly at `:469` and `:664`. The option is declared at
  `shared-options.js:107-112` as `skipNxCache`, `default: false`, `alias: disableNxCache`; yargs'
  default camel-case expansion means **both `--skip-nx-cache` and `--skipNxCache` work**. Separately,
  `--skip-remote-cache` (`:113-118`) disables ONLY the remote tier -- a different flag, do not confuse
  them. [VERIFIED: installed Nx 23.1.0 source]
- **F-7** -- `docs/cross-os.md` is NOT currently in `nx.json`'s `test` inputs; `ci.yml` IS (`:69` area),
  `capture-hashes.mjs` IS, and `targetDefaults` inputs REPLACE rather than merge, so registration
  means adding a line. [VERIFIED: `nx.json` read in full]

---

## Sources

### Primary (HIGH confidence)

- `node_modules/nx/package.json` -> `23.1.0`; `node_modules/@nx/nx-win32-arm64-msvc/*.node` (string
  search located `packages\nx\src\native\tasks\hashers\hash_runtime.rs`)
- https://raw.githubusercontent.com/nrwl/nx/23.1.0/packages/nx/src/native/tasks/hashers/hash_runtime.rs
- https://raw.githubusercontent.com/nrwl/nx/23.1.0/packages/nx/src/native/utils/command.rs
- `node_modules/nx/dist/src/tasks-runner/task-orchestrator.js`,
  `node_modules/nx/dist/src/command-line/yargs-utils/shared-options.js`
- Local measurements 2026-07-30 on `win32/arm64`, Node v24.13.0: the 4-cell shell x flag matrix, the
  `emitWarning` positive control, the `NODE_OPTIONS` startup-error residual, and the full `test` run
- In-repo: `.github/workflows/ci.yml`, `.github/workflows/cleanup.yml`, `nx.json`,
  `packages/github-cache/src/lib/trust.ts`, `.../server/server.ts`,
  `.../backend/actions-cache-backend.ts`, `capture-hashes.mjs`,
  `.../nx-target-inputs.spec.ts`, `.../docs-adoption.spec.ts`, `.../docs-same-os-claims.spec.ts`,
  `packages/github-cache/vitest.config.mts`, `.planning/config.json`
- In-repo records: `08-ROOT-CAUSE.md` (`:485`, `:536`, `:601`, `:712`, `:753`, `:1589`, `:1777-1835`,
  `:2148`, `:2211`, `:2587`, `:2625`, `:3013`), `11-EVIDENCE.md` (`:997`, `:1002-1019`, `:1046-1057`),
  `11-SECURITY.md`, `10-SECURITY.md`, `.planning/THREAT-MODEL.md`, `.planning/REQUIREMENTS.md`,
  `.planning/PROJECT.md`, `08-nx-task-hash-parity/deferred-items.md`

### Secondary (MEDIUM confidence)

- https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/ -- fetched
  verbatim via markdown.new; the operative sentence is quoted in Correction 1
- https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching -- cache scope
  for pull requests (fetched summary, key sentences quoted)
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows --
  `workflow_dispatch` default-branch requirement (fetched summary, sentence quoted)

### Tertiary (LOW confidence)

- None. Every claim in this document is either source-traced, measured this session, or quoted from a
  cited page.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| U-01 (a) stderr empty on both legs | HIGH | recorded CI artifacts, four independent citations in `08-ROOT-CAUSE.md`, from an instrument that reads the command out of `nx.json` |
| U-01 (b) stderr IS hashed | HIGH | quoted from Nx 23.1.0 source at the matching tag, with the installed binary confirming the file path |
| U-01 (c) shell invariance | HIGH on Windows, MEDIUM on Linux | 4-cell matrix measured locally; the Linux cell is inferred from a documented, platform-neutral Node flag and closed for free by the next `hash-parity` run |
| The `needs:` durability chain | HIGH | traced through in-repo source from the HTTP handler to `saveCache` and its `lookupOnly` disambiguation |
| `--skip-nx-cache` skips write | HIGH | traced through installed Nx source, all five `postRunSteps` call sites enumerated |
| Correction 1 (fork PR) | HIGH on the falsification, HIGH on the replacement | verbatim changelog quote; `ci.yml:3-7` read directly |
| Correction 2 (`workflow_dispatch`) | HIGH | documented GitHub constraint; `cleanup.yml` confirms the precedent carries no dispatch |
| `test` green on Windows | HIGH | executed here, cache bypassed, 856/856 |
| Architecture patterns | HIGH | copied from shipped, live-proven in-repo code |
| Live-CI HIT behaviour | Unobservable | by construction; named in ROADMAP's `Live-CI close` line |

**Research date:** 2026-07-30
**Valid until:** 2026-08-29 for the Nx-source and in-repo findings (stable, version-pinned);
**2026-08-13** for the GitHub Actions platform findings -- the cache-token policy changed on
2026-06-26 and the 2026-07-28 "GitHub Actions holds potentially malicious workflows for approval"
changelog indicates the trigger-trust surface is still moving. Re-read both before the proving run.
