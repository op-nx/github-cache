# Quick Task 260804-h3b -- probe file for sub-claim (b)

This file exists ONLY to give the probe branch `obs/case-b-defaultref-260804-h3b` a non-empty diff
against its base, so opening a PR fires a `pull_request` run.

**Sub-claim it triggers:** (b), the `$defaultref` clause matching. The probe PR's base is the FEATURE
branch `gsd/v0.0.2-os-invariant-cross-os-sharing`, NOT `main`. That is the whole point: with base =
`main`, `base_ref` and `default_ref` are the same string and the `$baseref` arm of the jq chain is
satisfied first, making the match unattributable. `ci.yml:1255-1257` names that exact duplication as
"the reason the gap stayed invisible".

**Why it is ONE file under `.planning/`:** a `.planning/`-only diff rotates no Nx task hash
(research Q4, measured with a same-modality positive control), so all five targets are Case B on the
probe run. That is the pre-registered shape. A second file, or an empty commit, would be unmeasured.

**Pre-registration, observation and verdicts:**
`.planning/quick/260804-h3b-fix-o3-witness-case-b/260804-h3b-EVIDENCE.md`

This branch and its PR are torn down at the end of the task. The file's content is reproduced in the
EVIDENCE file so it survives the deletion.
