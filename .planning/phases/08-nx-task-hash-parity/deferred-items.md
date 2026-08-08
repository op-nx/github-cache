# Phase 8 deferred items

Discoveries made during Phase 8 execution that are OUT OF SCOPE for the plan that
found them. Logged rather than fixed, per the executor scope boundary.

## 1. One unattributed `test` failure at commit `69bd1b7`, not reproducible

**Found during:** plan 08-06, the final nine-command battery.

**What is known, exactly:**

- `npm run test` exited 1 once. Its output was discarded by the battery loop's
  redirect, so the failing assertion is NOT known and cannot be recovered -- Nx
  caches terminal output for SUCCESSFUL task runs only, and `.nx/cache/terminalOutputs`
  contains no failing entry.
- Nx's own flaky-task detection then fired on the very next run: `NX detected a
  flaky task: @op-nx/github-cache:test`. That message means Nx observed a FAILURE
  and a SUCCESS at the SAME task hash, which is the definition of non-determinism
  rather than of a real regression -- the inputs were byte-identical across both.
- SEVEN consecutive local runs afterwards passed at that same hash, all `562
  passed (562)`: one immediate re-run, five in a dedicated repeat loop, and one
  more inside a re-run of the full battery.
- CI's `test` job at the same commit's tree (`f866210`, run `30358020343`) is
  `success`. So is every earlier `test` job on this branch.

**What is NOT known:** which spec failed, and why. Any statement about the cause
would be invention.

**Why it is deferred rather than chased:** it did not reproduce in seven attempts,
it left no artefact, and it is not attributable to anything plan 08-06 changed --
`compare.ts` / `compare.spec.ts` are the only source files this plan touched and
their 28 clause cases pass deterministically. Chasing an unreproducible one-off
with no message is not a fix, and guessing at one would be worse than recording
the honest gap.

**What would make it actionable:** a SECOND occurrence with output captured.
Anyone who sees `test` fail on this repo should capture the output before
re-running -- the re-run destroys the evidence, which is what happened here. A
plausible-but-unverified class to check first is a Vitest worker/tinypool startup
race under load on Windows, since the battery runs nine targets back to back; that
is a hypothesis, not a finding.
