---
status: testing
phase: 12-windows-ci-reuse-o4-consumer-recipe
source: [12-VERIFICATION.md]
started: 2026-07-30T21:15:00Z
updated: 2026-07-30T21:15:00Z
---

## Current Test

number: 1
name: The O4 live observation -- first run of a same-repo pull request
expected: |
  Per Windows leg, counted from the leg's log with
  `rg -o -F "[remote cache]" <log> | wc -l`:
    build-windows     = 1
    typecheck-windows = 2
    test-windows      = 1
    total             = 4
  Each ubuntu leg MISS-and-saved in the SAME run, so the producer-to-consumer
  ordering is observable rather than inferred.
awaiting: user response

## Tests

### 1. The O4 live observation (XOS-05, XOS-04, XOS-08)

expected: build-windows=1, typecheck-windows=2, test-windows=1 (total 4) occurrences of the
literal `[remote cache]`, with each ubuntu leg MISS-and-saved in the same run.
result: [pending]

Reproduction:

```
gh pr create --fill                      # operator decision -- not taken by the executor
gh run view <run-id> --log > run.log     # the FIRST run only, NEVER a re-run
rg -o -F "[remote cache]" run.log | wc -l
```

D-18 constraint, load-bearing: only the FIRST run of a SAME-REPO pull request counts. On a
re-run the ubuntu leg restores the merge-ref entry the first run saved, so it HITs instead of
MISS-and-saving, and the in-run producer attribution evaporates. A temporary `main` push is not
a substitute either -- `ci.yml` is `on: push` restricted to `main` plus `pull_request`, so a
phase-branch push does not trigger CI at all. A record naming any other vehicle, or naming none,
does not close XOS-05.

D-20: `Cache: n/m hit` is NON-DISCRIMINATING in both directions and must not be read as evidence.

Why human: this is a property of the GitHub Actions cache service across two live jobs. No
in-process test can observe it. The remote tip is unmoved and no PR exists; opening one is an
operator decision the executor correctly declined to take unilaterally.

### 2. The detector going green on a real windows-11-arm runner (XOS-05)

expected: the run log contains the literal `Successfully ran targets build, typecheck, test for
project`. Exit code alone is NOT sufficient evidence.
result: [pending]

Reproduction (after merge to the default branch):

```
gh workflow run windows-regression-detector.yml
gh run view <run-id> --log > detector.log
rg -F "Successfully ran targets build, typecheck, test for project" detector.log
```

Why human: `workflow_dispatch` only fires for a workflow file present on the default branch, so
this is structurally impossible to prove pre-merge. The command itself was measured green
locally on win32/arm64 in plan 12-03; only the CI dispatch is unverified.

### 3. RESEARCH assumption A1 -- the discriminator's stderr on linux/arm64 (DOCS-07)

expected: stdout `linux` and `win32` respectively, with stderr EMPTY on BOTH legs, confirming
`--no-warnings` closes the stderr channel on linux/arm64 as well as win32/arm64.
result: [pending]

Reproduction (once any CI run exists on a tree carrying commit 3d9f895 or later):

```
gh run download <run-id> -n hash-parity-ubuntu-24.04-arm
gh run download <run-id> -n hash-parity-windows-11-arm
```

Then read each artifact's `discriminator` block: `command`, `stdout`, `stderr`, `status`.
Note the artifact names are the RUNNER LABELS, not `hash-parity-<os>`.

Why human: the only artifact available so far (run 30500255530) records the PRE-hardening
command `node -p process.platform`, because the hardened literal is unpushed. A1 is explicitly
OPEN and must not be closed by inference.

### 4. Whether the consumer recipe is correct and safe to copy (DOCS-07)

expected: the safe-default framing, the portability checklist and the trap comments in
`docs/cross-os.md` are technically accurate, not merely present.
result: [pending]

Why human: this is a prose and judgement review, not a mechanical assertion. The drift guard
proves the doc SAYS the right things; it cannot prove the doc MEANS them.

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
