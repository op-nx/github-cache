---
phase: 11
phase_name: live-proofs-o1-o2-o3
status: secured
threats_open: 0
threats_total: 30
threats_closed: 28
threats_open_nonblocking: 2
asvs_level: 1
asvs_level_applied: 3
block_on: high
security_enforcement: true
audited_at: 2026-07-30
auditor: gsd-security-auditor
verdict: SECURED
---

# Phase 11 Security Audit -- Live Proofs O1/O2/O3

Retroactive verification that every mitigation declared in the seven
`<threat_model>` blocks of `11-01-PLAN.md` .. `11-07-PLAN.md` exists in the
implemented code. Starting hypothesis for every row: the mitigation is ABSENT
until a located match proves otherwise. Documentation and stated intent were
not accepted as evidence for any row.

**Verdict: SECURED.** 28 of 30 threats CLOSED. 2 OPEN at `low`, both below the
`high` block threshold, therefore non-blocking and excluded from
`threats_open`. Nothing blocks phase advancement.

Three threats in the register below (T-11-27, T-11-28, T-11-29) were NOT
declared by any plan. They were added by this audit. T-11-27 is the critical
finding the code review caught and the plans' own security analysis missed --
see `## Threat-model gap` for why that omission is itself worth recording.

---

## Scope

Phase 11's real attack surface, established from
`git diff 90ec284..HEAD` rather than from the SUMMARY narrative:

| Surface | What is new |
|---|---|
| `.github/workflows/ci.yml` | 5 new steps in the `integration` matrix job; 1 new job `o3-witness` (3 steps) |
| `read-integration-hash.mjs` | new file; reads `.nx/cache/run.json`, writes a value that becomes a cache key |
| `capture-hashes.mjs` | new `--assert-graph-premise` mode |
| `packages/github-cache/src/dogfood-cross-os.spec.ts` | new `o3-witness` presence + shape + body guards |
| `packages/github-cache/src/docs-same-os-claims.spec.ts` | 11 new additive prose-lock rows |
| `package.json` | one npm SCRIPT added; no dependency, no lockfile change |
| Outward-facing operations | temporary push to public `main` + restore; `ACTIONS_STEP_DEBUG` on then off; `npx nx reset` |

The `Pre-set the Nx cache client vars for the sidecar` blocks and the
`Wait for the loopback sidecar` polls are PRE-EXISTING (Phase 8/9). They are
examined below only where a phase 11 threat depends on them.

---

## Threat verification -- CLOSED

| ID | Category | Sev | Disp | Evidence located |
|---|---|---|---|---|
| T-11-01 | Elevation of privilege | high | mitigate | `ci.yml:689-691` grants exactly `contents: read` + `actions: read`. `actions: write` absent workspace-wide (search exit 1 against a passing positive control). Guarded by three SEPARATE cases, `dogfood-cross-os.spec.ts:318-341` |
| T-11-02 | Spoofing | high | mitigate | `ci.yml:788-789` `select(.key == $key and .ref == $ref)` plus `// empty` terminator. Both clauses independently guarded, `dogfood-cross-os.spec.ts:409-427` |
| T-11-03 | Information disclosure | high | mitigate | ZERO email-shaped tokens across every phase 11 artifact and every new code file (positive control: the same pattern locates the approved public gmail in `package.json`/`LICENSE`). `node_id`/`uploader`/`browser_download_url` occur only as prose field NAMES in rationale sentences, never as payload values. `gh auth token` recorded as `len 40`, value never written. No GitHub token prefix (`ghp_`/`gho_`/`ghs_`/`github_pat_`) anywhere in the repository. Every long hex string in the artifacts resolves to a git SHA or the deliberate all-zero probe hash |
| T-11-04 | Information disclosure | high | mitigate | `ci.yml:443-449` recorder is ECHO-ONLY (`runner.debug=...  -- RECORDED, never gated`), so it cannot become a tripwire once the variable is unset. `11-EVIDENCE.md:738-739` records set `2026-07-29T23:39:35Z` and deleted `2026-07-29T23:57:22Z`. Deletion independently confirmed by the orchestrator (`total_count = 0`) |
| T-11-05 | Repudiation | high | mitigate | `capture-hashes.mjs:578-690`: six assertions, every one routed through `fail()` which THROWS; none warns. Clause 1 (non-emptiness), clause 5 (forbidden-set intersection) and clause 6 (set inequality) are the declared negative control and all three are present. In `ci.yml` every phase 11 probe terminates in a bare `exit 1` printing observed AND wanted; `continue-on-error` appears nowhere in the file except in prose forbidding it |
| T-11-06 | Tampering | high | mitigate | `11-EVIDENCE.md:732-749`. Backup ref `refs/heads/backup/main-before-phase11-verify` = `fe25a3f`, published to the remote BEFORE the push and RETAINED (orchestrator confirms it still exists on the remote at that SHA). Restore verified by SHA EQUALITY, `main` before and after both `fe25a3f`. Divergence recorded pre-push as `0  240` with `merge-base --is-ancestor` exit 0, so the outbound leg was MEASURED a fast-forward. `--force-with-lease` on both legs as a concurrency guard. Restore run predicted in the plan text before anything was pushed, then resolved to run `30501074211` |
| T-11-07 | Information disclosure | medium | mitigate | The two new secret-touching steps build the header in a shell variable (`ci.yml:592`, `ci.yml:759`) and echo only the HTTP code and an already-validated hash. `LEG_OS` and `RUNNER_DEBUG_OBSERVED` reach their scripts through `env:`, never interpolated into a `run:` body. No `set -x`, no `set -euxo`, no `curl -v`, no `--trace` anywhere in the file (all searched, exit 1, against a passing positive control) |
| T-11-08 | Denial of service | medium | mitigate | `11-03-SUMMARY.md:198-205`: teardown is a recorded control-table row -- `curl` exit 7 plus a listening-port query returning nothing |
| T-11-09 | Spoofing | high | mitigate | `read-integration-hash.mjs:65` matches `/(^|\s)integration(\s|$)/` against `run.run?.command`. Tightened from the substring test by WR-03; an absent `run.command` still fails closed via `?? ''` |
| T-11-10 | Repudiation | high | mitigate | `read-integration-hash.mjs:89-98` demands EXACTLY ONE matching task and enumerates every observed target in the throw. Never writes an empty hash |
| T-11-11 | Denial of service | high | mitigate | `11-02-SUMMARY.md:122`: blocking decision checkpoint, explicitly NOT self-approved (`auto_advance` and `_auto_chain_active` both verified false). Warm capture committed in `8d90fc8` BEFORE the reset, so no measurement was at risk |
| T-11-12 | Repudiation | high | mitigate | `11-02-SUMMARY.md:187-195`: the guard was turned into a MEASUREMENT -- an unpaginated read returns 30 of 141 assets with ZERO `nx-cache-` names, so a single page would have reported every present asset as ABSENT. Two independent paginated reads, 141 each |
| T-11-13 | Repudiation | high | mitigate | `graphState` derived by `measureGraphState` from `workspaceDataEntries` (`graphStateBasis: workspaceDataEntries`), 18 warm / 0 cold, recorded at three points. There is no graph-state CLI flag to assert it by |
| T-11-14 | Spoofing | high | mitigate | `cacheStatus == remote-cache-hit` on 4 of 4 targets, zero `local-cache-hit` -- a structural refutation, not an inference. `npx nx reset` preceded everything and `11-02-SUMMARY.md:206-217` states explicitly that no `nx` invocation of any kind intervened |
| T-11-16 | Repudiation | high | mitigate | `docs-same-os-claims.spec.ts:659-671` sweeps `/whose byte[s]/i` across the four DOCS_08 files plus the six Phase 10 source files. Green |
| T-11-17 | Tampering | high | mitigate | `11-04-SUMMARY.md:49,253`: task 2 is a blocking decision checkpoint enforced by the `depends_on` graph; maintainer selected `proceed`, not self-approved |
| T-11-18 | Tampering | high | mitigate | `jobBlock('o3-witness')` THROWS on an absent job key. The describe carries 13 cases (7 envelope + 5 body + 1 artifact-name coupling), exceeding the declared seven. The positive control (`needs: integration`) is the FIRST case, so a wrong non-empty block cannot make the rest vacuous |
| T-11-19 | Repudiation | high | mitigate | All 69 `docs-same-os-claims.spec.ts` cases pass against the real `ci.yml`, so every locked phrase resolves on a single line of the current file |
| T-11-20 | Repudiation | high | mitigate | `nx.json:69` registers `{workspaceRoot}/.github/workflows/ci.yml` as a `test` input, so a `ci.yml` edit rotates the `test` hash and no stale cached PASS can replay |
| T-11-21 | Tampering | high | mitigate | All 11 phase 11 rows carry `bucket: 'additive'` with `forbidden: []` (lines 194, 216, 241, 348, 365, 378, 409, 438, 473, 503, 532). No new absence check exists that deleting a whole comment could satisfy |
| T-11-22 | Tampering | medium | mitigate | `ci.yml:869` `grep -q '^o3-witness: EXISTENCE OK' o3-witness.log` -- anchored. Guarded by `dogfood-cross-os.spec.ts:440-450`, which asserts the anchor character-for-character |
| T-11-24 | Repudiation | high | mitigate | Closed from BOTH sides independently. Configuration: repository holds zero secrets, established by a REST read returning `total_count = 0` rather than by an empty-output no-match (`11-EVIDENCE.md:941-945` records why that distinction mattered). Effect: `runner.debug=1` on both legs, with the rehearsal's `runner.debug=<unset>` as the negative control |
| T-11-25 | Repudiation | high | mitigate | `11-07-SUMMARY.md:145-149`: every pre-registered count is tabulated BESIDE its observed value with a verdict; no pre-registered value was edited after the run |
| T-11-26 | Spoofing | high | mitigate | Proof taken from a FRESH push (run `30500255530`), never a workflow re-run. The label count is RECORDED and gated nowhere -- confirmed in code: the only consumer is `echo ... -- RECORDED, never gated` at `ci.yml:552` |
| T-11-27 | Elevation of privilege | critical | mitigate | NEW -- see `## The critical finding` below. Independently verified fixed |

## Threat verification -- accepted risks log

| ID | Category | Sev | Disp | Accepted risk, and why the acceptance holds |
|---|---|---|---|---|
| T-11-15 | Tampering | medium | accept | Archive bytes from the Releases mirror are extracted into `.nx/cache`. This is the cache's designed behaviour and the read path is authenticated to the repository's own release assets. Phase 11 measured that path and introduced no new trust boundary on it; C16's filters and C2's sync gate are untouched. ACCEPTED |
| T-11-23 | Repudiation | low | accept | The `o3-witness` job is ungated by event and therefore runs on fork pull requests. Accepted on the recorded posture that it is read-only, fails loud, and is useful rehearsal, with the O3 proof recorded ONLY from the push run per D-20. **This acceptance was UNSOUND as originally written and is sound only because of `19a209e`** -- the "it is read-only" premise was false while the `$GITHUB_ENV` sink existed (see T-11-27). Re-accepted here against the fixed code. ACCEPTED |
| T-11-SC | Tampering | high | accept | No package installed by any plan. VERIFIED rather than taken on trust: the only `package.json` change across the whole phase is one added npm SCRIPT (`assert:graph-premise`); `package-lock.json` and `packages/github-cache/package.json` are untouched. The witness uses only runner-provided `curl`, `jq` and `date`. ACCEPTED |

## Threat verification -- OPEN, below the `high` block threshold

Neither counts toward `threats_open`. Neither blocks phase advancement.

| ID | Category | Sev | Mitigation expected | Files searched |
|---|---|---|---|---|
| T-11-28 | Tampering | low | A guard asserting the ABSENCE of a `$GITHUB_ENV` write inside the `o3-witness` block. NOT FOUND. `dogfood-cross-os.spec.ts:452-464` asserts the shape check is PRESENT, and the only other `GITHUB_ENV` occurrences in the spec tree are prose inside assertion messages. So a future editor could reinstate an `echo "X=${h_linux}" >> "$GITHUB_ENV"` line and the entire 93-case suite would stay green. The reintroduced sink would be materially safer than the original (the shape check now runs first in the same step), which is why this is `low` and not higher -- but the ordering that makes it safe is itself unguarded | `packages/github-cache/src/**/*.spec.ts`, `.github/workflows/ci.yml` |
| T-11-29 | Information disclosure | low | `.gitignore` entries for the three root-written run artifacts. NOT FOUND. `integration-nx.log`, `integration-hash.txt` and `o3-witness.log` are all written at the workspace root and none is ignored, while this SAME phase added `/hash-parity-*.json` and `/graph-premise-*.json` for the other two root-written record families. Exposure is genuinely small: `integration-hash.txt` holds only an all-decimal hash already published in `11-EVIDENCE.md`; `o3-witness.log` is CI-only (the job never checks out the repo); and `integration-nx.log` cannot carry the bearer token on any path this audit could find (see `## Token handling`). It is an untracked-file hygiene gap on a PUBLIC repository, not a demonstrated leak | `.gitignore`, `.github/workflows/ci.yml`, `packages/github-cache/src/server/`, `read-integration-hash.mjs` |

---

## The critical finding: T-11-27

**`$GITHUB_ENV` injection from an artifact-controlled value in `o3-witness`
(review finding CR-01).** Registered here as `T-11-27`, category Elevation of
privilege, severity **critical**, disposition mitigate, status **CLOSED**.

The pre-fix shape read the downloaded artifact with `cat`, guarded it with a
bare `-z` emptiness test, and wrote it to `$GITHUB_ENV`. Command substitution
strips only TRAILING newlines, `$GITHUB_ENV` is parsed line by line, and
GitHub executes `run:` steps as `bash -e {0}`, which sources `BASH_ENV`. A
record holding `<digits>\nBASH_ENV=/tmp/evil.sh` therefore yielded arbitrary
code execution in every later step of a job holding `contents: read` +
`actions: read` and a `GITHUB_TOKEN`. The value is artifact-controlled --
produced by a job that executes PR-authored code -- and the job is ungated by
event, so it runs on fork pull requests.

**Independently verified fixed, not taken from the fix report.** Verified by
reading `git show 19a209e` and the current file, not by reading `11-REVIEW-FIX.md`:

1. The sink is DELETED, not filtered. The diff removes the whole
   `Read H_linux from the ubuntu integration leg's record` step including
   `echo "H_LINUX=${h_linux}" >> "$GITHUB_ENV"`. There is no `$GITHUB_ENV`
   write anywhere in the `o3-witness` job (`ci.yml:665-869`); the only two
   occurrences in that range are comment lines at 718 and 721.
2. The exported variable is fully gone. `H_LINUX` returns exit 1 across
   `.github/` while the replacement local `h_linux` returns 6 hits -- a
   positive control that the search itself works.
3. The value is read in its ONE consuming step and shape-checked before any
   use. `ci.yml:751-757` runs `case "${h_linux}" in ''|*[!0-9]*)` -> `exit 1`
   BEFORE the first `echo` (758), before `key="nx-cache-${h_linux}"` (762) and
   before any interpolation into a failure message. In a bash `case` glob,
   `[!0-9]` matches a newline, so the exact `123\nBASH_ENV=...` payload is
   rejected on shape even if the sink ever returned.
4. The upstream half is real too. `read-integration-hash.mjs:108` rejects a
   non-`/^[0-9]+$/` hash at the producing leg. Probed: without the `m` flag JS
   `$` anchors to end-of-input, so `"123\n"` is correctly REJECTED -- the
   trailing-newline escape does not exist here.
5. The guard is not vacuous. The spec regex at `dogfood-cross-os.spec.ts:463`
   was mutation-checked against both forms: it matches the fixed `case` block
   and does NOT match the pre-fix `-z` + `$GITHUB_ENV` shape.

**Artifact trust boundary, traced end to end.** The downloaded record has
exactly one consumer (`ci.yml:751`), and every read of it occurs after the
shape check. The sibling `integration` job's positive control also `cat`s a
hash (`ci.yml:593`), but that file is written by `read-integration-hash.mjs`
in the SAME job, whose GUARD 3 validated it, and the step ordering makes a
skipped reader fail the leg under `set -e`. No unvalidated consumer found.

## Threat-model gap

**The plans' own security analysis did not register this threat, and one
accepted risk rested on the premise it falsified.** Recorded because it is
the substantive lesson of this phase's security posture:

- `11-06-PLAN.md`'s trust-boundary table DOES name the boundary --
  "downloaded artifact to the witness | the hash the witness builds a key from
  comes from another job's upload". The boundary was seen.
- No threat in the register crosses it. The nearest, `T-11-22` (Tampering,
  medium), covers forged LOG content and the `^` anchor -- the log-matching
  vector, not the environment-file sink. Nothing covered code execution.
- `T-11-23` accepted the fork-PR witness run explicitly "because it is
  read-only". At the time that risk was accepted the job was not read-only in
  effect: `BASH_ENV` gave arbitrary execution. The acceptance was reasoned
  from a premise the code did not satisfy.

The mechanism that caught it was the code review, not the threat model. A
named trust boundary with no threat crossing it is the shape to watch for in
future registers.

## Token handling

Checked because `ACTIONS_STEP_DEBUG` was ON for one run of a PUBLIC
repository, making that run's `##[debug]` output permanent and world-readable.

Masking is real and correctly ordered, verified in the file rather than from
the comment that claims it:

- All five `Pre-set` blocks emit `::add-mask::${token}` BEFORE the
  `$GITHUB_ENV` write (`ci.yml` 234/235, 310/311, 357/358, 462/463,
  1400/1401). The token is generated and masked in the same command sequence,
  so no window exists in which the value is live but unregistered.
- `core.setSecret(running.token)` is the first statement after `serve()` in
  both `start-cache-server/entry.ts:86` and
  `packages/github-cache/src/action/index.ts:305`. This is a redundant SECOND
  registration; the workflow-level mask is what covers the pre-action window,
  and `ci.yml:231-232` records exactly that reasoning.
- `secrets.GITHUB_TOKEN` is runner-managed and auto-masked.

Debug logging could not defeat it. The runner's secret masker applies to all
log output including `##[debug]` lines, and every value in question was
registered before it could reach any log surface. Corroborating negatives, all
run with a passing positive control: no `set -x` / `set -euxo` / `set -ex`; no
`curl -v` / `--verbose` / `--trace`; no step echoes
`NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` except into `$GITHUB_ENV` after the
mask.

Log and artifact contents:

- `packages/github-cache/src/server/` contains ZERO logging calls. The auth
  gate (`server.ts:25-34`) is constant-time and never echoes the presented
  header.
- No `core.info` in the action path carries a token.
- `integration-nx.log` is the tee'd Nx output; nothing on the reachable code
  path prints the bearer.
- The only uploaded artifact is `integration-hash.txt`, whose entire content
  is `task.hash` written bare (`read-integration-hash.mjs:119`).

## Unregistered flags

Non-blocking. Recorded so they are not rediscovered.

1. **The T-11-27 injection class had no threat mapping in any plan.** See
   `## Threat-model gap`. This is the significant one.
2. **Four of seven SUMMARYs carry no `## Threat Flags` section at all.**
   `11-01` through `11-04` omit it entirely; only `11-05`, `11-06` and `11-07`
   emit one. The section is the executor's channel for surfacing attack
   surface discovered during implementation, so for the four plans that built
   the instruments (`capture-hashes.mjs --assert-graph-premise`,
   `read-integration-hash.mjs`) and performed the REST reads, that channel was
   silent. This audit compensated by scoping from the git diff instead.
3. **Root-written untracked run artifacts** -- tracked as T-11-29 above.
4. **No guard on the `ci.yml` `::add-mask::` ORDERING.**
   `docs-adoption.spec.ts:87-111` asserts documented SNIPPETS mask before
   writing `$GITHUB_ENV` (F17), but nothing asserts it for `ci.yml` itself.
   The ordering is correct in all five blocks today. This is PRE-EXISTING
   surface, not phase 11's, so it is informational only -- but it is the same
   guard-the-mechanism-not-only-the-prose lesson as WR-04.
5. **One non-ASCII character in a phase artifact.** `11-REVIEW-FIX.md:230`
   contains U+2713. Outside T-11-03's declared scope -- `11-EVIDENCE.md`, the
   SUMMARYs and both capture records are pure ASCII, which is what T-11-03
   asserts -- but a deviation from the phase's own stated posture.

## Outward-facing operations

| Operation | Reversal | State now |
|---|---|---|
| Push of 240 commits to public `main` | Restored, verified by SHA equality | `origin/main` = `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a`; backup ref `refs/heads/backup/main-before-phase11-verify` RETAINED on the remote at that SHA |
| `ACTIONS_STEP_DEBUG` repository variable | Deleted, confirmed by a second listing | Repository variables `total_count = 0` |
| `npx nx reset` on the maintainer workstation | Not reversible by design; that was the measurement | Gated behind a blocking checkpoint; warm capture committed first, so no measurement was lost |

The push is irreversible in ONE respect, and the record states it: the run
re-warmed the Releases mirror under the post-Phase-11 hashes. That is intended
(Phase 12 depends on it), not an unreviewed side effect.

The debug window is bounded and its content is assessed above: nothing in the
phase 11 steps could have emitted an unmasked credential into the public log.

## Method notes

- `asvs_level` is configured at 1 (presence-level). Verification was performed
  deeper than that -- boundary placement for every mitigation, and an
  end-to-end data-flow trace with a bypass search for the artifact boundary
  and the token paths -- because the phase performed real outward-facing
  operations on a public repository.
- Every negative search in this report was run with a positive control first.
  The email-shaped-token sweep is the load-bearing case: it returns zero
  across all phase 11 artifacts, and the identical pattern locates the
  approved public gmail in `package.json`/`LICENSE`, so the zero is absence
  and not a broken search.
- Credential detection was by ALLOWLIST INVERSION. No forbidden value appears
  anywhere in this document.
- No implementation file was modified by this audit.

## `threats_open` computation

`block_on: high`, severity order critical > high > medium > low.

- OPEN threats: T-11-28 (low), T-11-29 (low).
- Both rank BELOW `high`, so neither counts.
- No OPEN threat has a missing or unparseable severity, so the fail-closed
  rule does not apply.

**`threats_open: 0`.** Phase 11 is clear to advance.
