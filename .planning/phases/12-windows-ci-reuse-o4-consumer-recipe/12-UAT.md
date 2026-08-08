---
status: complete
phase: 12-windows-ci-reuse-o4-consumer-recipe
source: [12-VERIFICATION.md]
started: 2026-07-30T21:15:00Z
updated: 2026-07-31T04:25:00Z
---

## Current Test

[testing complete]

## Tests

### 1. The O4 live observation (XOS-05, XOS-04, XOS-08)

expected: build-windows=1, typecheck-windows=2, test-windows=1 (total 4) occurrences of the
literal `[remote cache]`, with each ubuntu leg MISS-and-saved in the same run.
result: pass
evidence: run 30586177358 (PR #12, FIRST run, event=pull_request, headSha=e757d4c)

Measured per leg, counted from that leg's own log:

| Leg | `[remote cache]` | ran fresh | restored |
| --- | --- | --- | --- |
| `build-windows` | 1 | 0 | 1 |
| `typecheck-windows` | 2 | 0 | 2 |
| `test-windows` | 1 | 0 | 1 |
| **total** | **4** | **0** | **4** |

The producer half, same run, same table shape -- the ubuntu legs are the exact mirror image:

| Leg | `[remote cache]` | ran fresh | restored |
| --- | --- | --- | --- |
| `build` | 0 | 1 | 0 |
| `typecheck` | 0 | 2 | 0 |
| `test` | 0 | 1 | 0 |

Every ubuntu task MISSed and executed; every Windows task restored and executed nothing. The
counts match 1:1 per target, so the four Windows restores are each attributable to an in-run
ubuntu producer. Ordering is structural, not inferred: `build-windows` `needs: build`,
`typecheck-windows` `needs: typecheck`, `test-windows` `needs: test`. `o3-witness` independently
recorded `EXISTENCE OK key=nx-cache-14017528273429599213 created_at=2026-07-30T22:10:52Z
started_at=2026-07-30T22:13:37Z delta=165s margin=30s`.

D-18 satisfied: this was the FIRST run of same-repo PR #12, never a re-run.

CAVEAT, recorded because the reproduction line invites it. `rg -o -F "[remote cache]" run.log |
wc -l` returns **6**, not 4, when pointed at a WHOLE-RUN log. The two extras are the *echoed
shell command* in the two `integration` matrix legs -- `count=$({ grep -o -F '[remote cache]'
integration-nx.log ...` -- which contains the literal needle and is not a marker. The per-leg
counts above are the real assertion and they match exactly. Count per leg, never run-wide.

### 2. The detector going green on a real windows-11-arm runner (XOS-05)

expected: the run log contains the literal `Successfully ran targets build, typecheck, test for
project`. Exit code alone is NOT sufficient evidence.
result: pass
evidence: run 30603713356 (event=workflow_dispatch, headSha=e757d4c, job `detect` success, 3m49s)

**SUPERSEDED by quick 260803-mew.** The observation below is preserved verbatim and remains true of
the needle it measured, but it no longer speaks to the needle at HEAD. It proved the THREE-target
line at `e757d4c`. Commit `9e79009` ("add lint to the detector, the one invariant it could not see",
2026-08-01) then replaced the needle with the FOUR-target form `Successfully ran targets build,
typecheck, test, lint for project`, and `git merge-base --is-ancestor 9e79009 e757d4c` is FALSE --
so run `30603713356` ran a tree that predates the current needle and cannot close it. Both
directions of the four-target needle were subsequently observed on real `windows-11-arm` runners:
**run `30825110047`** (PASS, `headSha 41f65e1`, the needle as genuine Nx output with `lint`
executing) and **run `30825602626`** (FAIL, the mutated 3-of-4 tree, red at the needle's `grep`
with `nx` at exit 0 in the same step). See
`.planning/quick/260803-mew-observe-phase-12-fail-half-on-real-run/260803-mew-EVIDENCE.md`. That
window also closed the FAIL half, which this test never covered in either form.

The needle is present as genuine Nx output, not merely as the echoed `grep -q` line that also
carries it:

```
 NX   Successfully ran targets build, typecheck, test for project @op-nx/github-cache
```

Runner label confirmed `windows-11-arm` via the jobs REST payload. The detector's whole point is
that the targets EXECUTE rather than restore, and that holds: **zero** `[remote cache]` markers in
the log, and all three targets report the executed marker --

```
[OK] > nx run @op-nx/github-cache:build
[OK] > nx run @op-nx/github-cache:typecheck
[OK] > nx run @op-nx/github-cache:test
```

HOW THE PRE-MERGE BLOCK WAS CLEARED, because the constraint in this file was real and is
unchanged. GitHub dispatches only a workflow whose file exists on the DEFAULT branch, so this was
structurally unprovable from the feature branch. Rather than merge, the file was placed on `main`
TEMPORARILY under an operator-approved backup-and-restore:

1. `main` (`fe25a3f`) backed up to remote ref `backup/main-pre-uat-260731`, SHA verified.
2. A single plumbing-built commit `d043eec` adding ONLY
   `.github/workflows/windows-regression-detector.yml` (1 file, 119 insertions, `[skip ci]`)
   pushed to `main`. Working tree and index never touched.
3. Dispatched with `--ref gsd/v0.0.2-os-invariant-cross-os-sharing`, so the run executed the
   PHASE-12 tree (`e757d4c`), not `main`'s 316-commits-stale tree. This is strictly closer to the
   post-merge condition the test describes than dispatching against `main` would have been.
4. `main` force-restored to `fe25a3f` immediately after dispatch -- the run is pinned at creation
   and does not re-read `main`. Verified: SHA matches, the detector file is absent, and
   `git diff origin/main origin/backup/...` was EMPTY. Backup ref then deleted.

So the workflow-dispatch constraint documented in this file is CONFIRMED, not circumvented -- the
file had to reach the default branch before the API would accept the dispatch at all.

### 3. RESEARCH assumption A1 -- the discriminator's stderr on linux/arm64 (DOCS-07)

expected: stdout `linux` and `win32` respectively, with stderr EMPTY on BOTH legs, confirming
`--no-warnings` closes the stderr channel on linux/arm64 as well as win32/arm64.
result: pass
evidence: `hash-parity-ubuntu-24.04-arm` / `hash-parity-windows-11-arm` artifacts, run 30586177358

```json
// ubuntu-24.04-arm
{ "command": "node --no-warnings -p process.platform",
  "stdout": "linux\n", "stderr": "", "status": 0 }
// windows-11-arm
{ "command": "node --no-warnings -p process.platform",
  "stdout": "win32\n", "stderr": "", "status": 0 }
```

A1 is CLOSED. The recorded `command` is the HARDENED literal on both legs, so this is a
measurement of the post-`3d9f895` configuration and not of the pre-hardening `node -p
process.platform` the only prior artifact carried. stderr is empty on BOTH legs, so the
PID-carrying-warning hazard is confirmed latent rather than live on linux/arm64 too. stdout is
non-empty and DIFFERS across the two legs, so the discriminator has not collapsed to one value.

### 4. Whether the consumer recipe is correct and safe to copy (DOCS-07)

expected: the safe-default framing, the portability checklist and the trap comments in
`docs/cross-os.md` are technically accurate, not merely present.
result: pass

Every independently checkable claim verifies against the repository:

| Doc claim | Check |
| --- | --- |
| Discriminator is byte-identical to `nx.json`'s | `node --no-warnings -p process.platform` in both |
| `nx.json` declares it on `integration` ALONE | exactly one `runtime` input, on `integration` |
| `test` carries a long explicit `inputs` list | 28 entries in `nx.json` |
| The repo ships `* text=auto eol=lf` | present in `.gitattributes` |
| "at Nx 23.1.0 ..." | `nx` is 23.1.0 |
| A build-gating two-leg comparison exists | `hash-parity-compare` job in `ci.yml` |
| `nx show project <p> --json \| jq ...` works | run; returns the 8 `integration` inputs with the discriminator appended last, exactly as the doc's "reproduce every entry, then append" instruction describes |

The two Nx-internals claims a reader cannot check from this repo alone are both sourced rather
than asserted. `12-RESEARCH.md` quotes Nx's own Rust `create_shell_command()` for the
"`%COMSPEC% /C` on Windows, `sh -c` everywhere else" claim, and Nx 23.1.0's `hash_runtime` for
"trimmed stdout AND trimmed stderr, concatenated with no separator". The stderr-empty premise the
`--no-warnings` rationale rests on is no longer only a Phase 8 record -- test 3 above re-measured
it on both legs with the hardened command.

Section 3's scope disclaimer is accurate and worth keeping: `process.platform` covers neither CPU
architecture nor libc, the two axes are unexercised for DIFFERENT reasons (arm64-everywhere vs
glibc-everywhere), and the `glibcVersionRuntime`-is-absent-on-musl warning is correct -- it yields
`undefined`, which prints and hashes like a real value.

No inaccuracy found. The doc consistently frames the asymmetry correctly: a superfluous
discriminator costs hits, a missing one yields a wrong result.

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none -- all four checkpoints passed]
