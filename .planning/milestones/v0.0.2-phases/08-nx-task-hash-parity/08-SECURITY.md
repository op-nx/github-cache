---
phase: 08-nx-task-hash-parity
status: secured
threats_open: 0
threats_total: 34
threats_closed: 34
asvs_level: 1
block_on: high
audited: 2026-07-28
audit_base: 7bfe64f..HEAD
new_findings: 5
new_findings_at_or_above_block_on: 0
implementation_modified: false
---

# Phase 08 Security Audit

**Phase:** 08 -- Nx Task Hash Parity
**Threats closed:** 34 / 34
**ASVS level:** 1 (verify the mitigation is PRESENT in the cited file)
**Block-on threshold:** high
**Blocking open threats:** 0
**Nothing at high or above is open.**

Register assembled from the six `<threat_model>` blocks in `08-01-PLAN.md` (T-08-01..05),
`08-02-PLAN.md` (T-08-06..10), `08-03-PLAN.md` (T-08-11..16), `08-04-PLAN.md`
(T-08-17..20), `08-05-PLAN.md` (T-08-21..26) and `08-06-PLAN.md` (T-08-27..33), plus the
supply-chain row `T-08-SC` which every one of the six declares identically (verified once,
noted as six declarations). Each threat was verified against code or recorded run evidence
at HEAD -- never against plan or summary prose.

## Method

- Diff frame: `git diff 7bfe64f..HEAD`. Non-planning files touched by this phase, in full:
  `.fallowrc.jsonc`, `.github/workflows/ci.yml`, `capture-hashes.mjs` (new), `nx.json`,
  `package.json`, `packages/github-cache/pack-check.cjs`,
  `packages/github-cache/package.json`, `packages/github-cache/src/hash-parity/{compare.ts,
  compare.spec.ts,assert-parity.ts}` (new), `packages/github-cache/src/nx-target-inputs.spec.ts`.
  `package-lock.json` is NOT in that set, and neither is any cache-server, write-gate,
  sync-gate, backend or published-export file. The brief's stated scope holds exactly.
- Live read-only checks: `npx vitest run src/hash-parity/compare.spec.ts` -> 37 / 37 passed
  at HEAD (includes the three WR-01 forge tests). A V8 JSON-error probe run out of the
  session scratchpad, never the repo (see NF-04).
- `git grep` for tracked files. `nx reset` was NOT run. Nothing was pushed and PR #9 was
  not touched.
- **No implementation file was modified.** This document is the only file this audit
  writes. No Edit was needed -- every declared mitigation was found present.
- The executor's summaries carry no `## Threat Flags` section, so the new attack surface
  below was derived independently from the diff rather than taken from a declared list.

## Threat verification

| Threat | Category | Sev | Disp | Verified in code / evidence | Verdict |
|---|---|---|---|---|---|
| T-08-01 | Tampering | high | mitigate | `package.json:52` `"includedScripts": []` -- present and UNCHANGED by this phase (the root manifest's only phase-8 diff is the `capture:hashes` script at `:16`), so the "cannot become an Nx target" property is structural, not new. Rationale locked at `capture-hashes.mjs:10-20`. | MITIGATED |
| T-08-02 | Spoofing | high | mitigate | `08-ROOT-CAUSE.md:172-175` -- byte-equality table against `.nx/cache/run.json` for `build` (`15091651677672778193`) and `test` (`17043910507556371878`), both `local-cache-hit`, with the Pitfall-2 same-session discipline recorded at `:206-211`. | MITIGATED |
| T-08-03 | Tampering | medium | accept | Loud-at-import verified: six STATIC `nx/src/*` imports at `capture-hashes.mjs:49-54`, no dynamic/guarded require anywhere in the file. `nx` is exact at `package.json:40` (`"23.1.0"`). Accepted-risk entry logged below. **The plan's secondary claim is false** -- see NF-01. | CLOSED (accepted; basis narrowed) |
| T-08-04 | Info disclosure | low | accept | Accepted-risk entry logged below. Independently re-scoped: what the committed record blocks actually expose is WIDER than the plan predicted -- see NF-05. Zero credential, zero email-shaped token. | CLOSED (accepted; scope corrected) |
| T-08-05 | DoS | medium | mitigate | `capture-hashes.mjs:285-294` throws on an absent `taskGraph.tasks[taskId]`, naming the target and `Object.keys(taskGraph.tasks)`. Companion throw for an absent project node at `:339-345`. Neither is a warn-and-continue. | MITIGATED |
| T-08-06 | DoS | high | mitigate | `compare.ts:299` parameter is `readonly unknown[]`; `shapeFault` at `:199-265` narrows `meta` (7 keys, non-empty strings), `targets` (every arriving entry: object, string `hash`, object `nodes`) and `discriminator` (both streams string) before any value is read. Returns a path string; never throws. Pinned by `compare.spec.ts:374-449`. | MITIGATED |
| T-08-07 | Tampering | high | mitigate | `compare.ts:366` iterates `EXPECTED_TARGETS`, not `Object.keys(record.targets)`; the arriving-keys loop at `:224` is type-checking only and says so. Vacuity control `compare.spec.ts:229-242` fails an EMPTY `targets` map. Live: both green in the 37-test run. | MITIGATED |
| T-08-08 | Info disclosure | medium | mitigate | `packages/github-cache/package.json:31` `"!dist/hash-parity"`, correctly ordered AFTER `"dist"` at `:27`. Asserted by `pack-check.cjs:112-115` (the `DIST_SUBTREES` entry) feeding the derived predicate at `:147-150`, so the exclusion is enforced and not merely declared. | MITIGATED |
| T-08-09 | Spoofing | high | mitigate | `assert-parity.ts:42` `SUCCESS_PREFIX`, printed only on the ok path at `:92-94`; `ci.yml:775` greps `'^hash-parity: PARITY OK'`. Colour-free literal, not Nx-formatted. | MITIGATED |
| T-08-10 | EoP | medium | mitigate | `public-surface.spec.ts`, `src/index.ts` and `src/test/consumer-contract.ts` are ABSENT from the phase-8 diff (verified by `git diff --name-status 7bfe64f..HEAD`). Nothing in `src/hash-parity/` is re-exported; no env knob, no action input. | MITIGATED |
| T-08-11 | Info disclosure | low | accept | Accepted-risk entry logged below. `ci.yml:9-10` workflow-level `contents: read` is unchanged by this phase (the phase-8 ci.yml diff touches no `permissions:` or `contents:` line), and neither new job requests a secret. | CLOSED (accepted) |
| T-08-12 | EoP | high | mitigate | The `hash-parity` job body (`ci.yml:573-626`) contains no `permissions:` key. Confirmed by enumerating every `permissions` occurrence in the file: only `:9` (workflow) and `:980` (a pre-existing unrelated job). | MITIGATED |
| T-08-13 | Spoofing | high | mitigate | `ci.yml:626` `if-no-files-found: error`, on the only upload step in the file. | MITIGATED |
| T-08-14 | Tampering | high | mitigate | `on:` remains `push.branches: [main]` + `pull_request` (`ci.yml:3-7`). The phase-8 diff over `ci.yml` contains ZERO added or removed `on:` / `push:` / `pull_request` / `branches` / `workflow_dispatch` / `permissions:` / `contents:` lines -- verified by filtering the diff for exactly those tokens. The trust-model surface was not touched. | MITIGATED |
| T-08-15 | Tampering | high | mitigate | `ci.yml:582-584` `ref: ${{ github.event.pull_request.head.sha \|\| github.sha }}` on the capture job, mirrored at `:751-753` on the compare job. `capture-hashes.mjs:334` records the checked-out HEAD and `:362` the runner `GITHUB_SHA`. Strengthened post-review by the cross-leg `commit` equality clause at `compare.ts:349-360`. | MITIGATED |
| T-08-16 | Info disclosure | low | accept | Same disposition and evidence as T-08-04. Accepted-risk entry logged below; scope corrected in NF-05. | CLOSED (accepted; scope corrected) |
| T-08-17 | Repudiation | high | mitigate | Re-executed, not read back: `git log --oneline 7bfe64f..HEAD -- nx.json` returns exactly three commits -- `163e6b9` (the one fix), `6260496` (the labelled D-22 gate-RED mutation) and `65a2e13` (its revert). `git diff 6260496~1 65a2e13 -- nx.json` is EMPTY, so the mutation was reverted byte-for-byte and no mutated tree persists. | MITIGATED |
| T-08-18 | Tampering | high | mitigate | The fix route and U-01's trigger condition were committed at `eeace53`, before any commit had touched `nx.json` (`08-05-SUMMARY.md:237`); `163e6b9` is strictly later in the same range. Ordering is provable from history, exactly as D-06 requires. | MITIGATED |
| T-08-19 | Spoofing | medium | mitigate | `08-ROOT-CAUSE.md` `## Requirement coverage` reads each requirement's own text; `:1951` is a worked row citing the requirement verbatim and recording what is and is not satisfied rather than smoothing it. | MITIGATED |
| T-08-20 | Tampering | medium | mitigate | No phase-8 spec asserts on `ci.yml` content -- the constraint is recorded at the two places that would otherwise have been tempted, `compare.ts:172-176` and `compare.spec.ts:482-485`, both naming PARITY-08 / Phase 9 as the registration path. `nx.json:59-60` lists `start-cache-server/*` and (at `:68`) `cleanup.yml`, never `ci.yml`. | MITIGATED |
| T-08-21 | Tampering | high | mitigate | `nx.json:134-142` -- the seven-entry `typecheck.outputs` list, deep-equality pinned at `nx-target-inputs.spec.ts:210-220` with the D-13 rationale comment-locked at `:203-209`. Value derived from the 136-file enumeration, not from an entry count; the WR-02 overlap is recorded as an accepted upstream property rather than silently trimmed. | MITIGATED |
| T-08-22 | Tampering | high | mitigate | Two guards, one pre-existing and one added. Pre-existing CORR-04 sole-discriminator guard `nx-target-inputs.spec.ts:327-345` is UNMODIFIED (the phase-8 diff over that file adds only two `it()` blocks and comment text). New byte-identical pin at `:367-374`, `expect(runtimeCommands).toEqual(['node -p process.platform'])` -- exact equality on the whole extracted list, not `toContain`. `capture-hashes.mjs:220-239` READS the string out of `nx.json` and throws if the entry is gone. `nx.json`'s `targetDefaults.integration` is untouched by the phase-8 diff. **One blind spot found -- see NF-02.** | MITIGATED |
| T-08-23 | Tampering | high | mitigate | `nx.json:56` `"{workspaceRoot}/nx.json"` is a declared `test` input, and the wiring itself is asserted at `nx-target-inputs.spec.ts:383-387`, so editing `nx.json` re-runs the pin rather than replaying it. | MITIGATED |
| T-08-24 | EoP | high | mitigate | U-01 resolved as `confirm-d12` by MAINTAINER selection against a condition committed to git before the experiment ran (`08-05-SUMMARY.md:31`, `:237`, `:169-173`); C1-C4 met, L1-L4 not met, N1-N3 occurred as pre-committed non-triggers. `08-CONTEXT.md` was not rewritten to match. | MITIGATED |
| T-08-25 | Tampering | high | mitigate | Exactly ONE `nx.json` fix commit exists in the phase (`163e6b9`, see T-08-17). There is no series of value-hunting edits. | MITIGATED |
| T-08-26 | Info disclosure | medium | mitigate | Same evidence as T-08-10: the three public-surface files are absent from the phase-8 diff. The `NX_DAEMON` env use is process-scoped to one CI step (`ci.yml:615`) and read by no shipped code. | MITIGATED |
| T-08-27 | Spoofing | high | mitigate | `ci.yml:772-775` -- `set -euo pipefail`, then the bin piped through `tee`, then `grep -q '^hash-parity: PARITY OK'`. Both signals are conjunctive: `pipefail` propagates the bin's non-zero exit past `tee` so `set -e` aborts before the grep, and a missing success line fails the step even on exit 0. Verified by reading: `assert-parity.ts` sets `process.exitCode = 1` on BOTH failure paths (`:80`, `:104`) and exits 0 only via the ok branch, so exit 0 is equivalent to an ok verdict. | MITIGATED |
| T-08-28 | Tampering | high | mitigate | Three run references in `08-ROOT-CAUSE.md`'s `## The gate can fail`: baseline GREEN `30355822956` (with the verbatim OK line and `Total of 2 artifact(s) downloaded`), RED `30356229082` (`hash-parity-compare` conclusion `failure`, verbatim message), GREEN-after-revert `30356937751`. Independently confirmed the revert is byte-for-byte (see T-08-17). | MITIGATED |
| T-08-29 | Tampering | high | mitigate | `continue-on-error` appears NOWHERE as a key in `ci.yml` -- the three occurrences (`:188`, `:468`, `:647`) are all comment prose forbidding it. No advisory period exists on either new job. | MITIGATED |
| T-08-30 | DoS | medium | mitigate | `compare.ts` returns a `malformed-record` verdict rather than throwing (T-08-06), and the loader's parse is wrapped at `assert-parity.ts:60-68` into a named error naming a truncated upload as the likely cause. `readdirSync` ENOENT is caught by the same top-level handler at `:100-105`. | MITIGATED |
| T-08-31 | EoP | high | mitigate | The `hash-parity-compare` job body (`ci.yml:742-775`) contains no `permissions:` key. Same enumeration as T-08-12. | MITIGATED |
| T-08-32 | Repudiation | high | mitigate | `ci.yml:744` `if: ${{ !cancelled() }}` on a job with `needs: hash-parity`, so a failed or skipped leg still reaches the assertion; `compare.ts:300-310` then fails with `wrong-record-count` naming the three suspects. `ci.yml:760-764` pre-creates the records directory so an empty download is a verdict, not an ENOENT. | MITIGATED |
| T-08-33 | Tampering | medium | mitigate | `lint` is a member of `INVARIANT_TARGETS` at `compare.ts:60-65` (D-21's PRIMARY branch, taken because `lint` measured byte-identical at `6930879416208693542` on both legs) -- downgraded to nothing, deleted from nothing. Content-pinned at `compare.spec.ts:549-556` and exercised per target at `:339-357`. | MITIGATED |
| T-08-SC | Tampering | high | mitigate | Declared identically in all six plans. `package-lock.json` is absent from the phase-8 diff, so no package was installed, removed or re-resolved. The two new third-party actions are first-party GitHub (`actions/upload-artifact@v7` at `ci.yml:622`, `actions/download-artifact@v8` at `:765`) and are pinned by MAJOR TAG -- the same convention as the pre-existing `actions/checkout@v7` and `actions/setup-node@v6` used at 18 sites in this file. No SHA-pinning precedent exists in the repo to diverge from, and the v7/v8 asymmetry is documented with its reason at `:555-559`. | MITIGATED |

## Independent re-confirmation of WR-01 (the record-controlled false-pass class)

WR-01 was found and fixed during code review (`08-REVIEW-FIX.md:31-79`, commit `81067e2`).
It is not re-reported as open. It WAS independently re-verified, because it is the one
finding in this phase that could have converted the build gate into a false green.

**The choke point is airtight for `compareHashParity`.** `git grep "ok: false"` over
`compare.ts` returns exactly ONE hit -- line 179, inside `fail()`. All eight failure
returns (`:301`, `:316`, `:325`, `:351`, `:371`, `:378`, `:418`, `:436`) route through it,
so the CR/LF collapse at `:179` covers every record-controlled interpolation, not just the
two the review named. Checked specifically, per the brief:

- **`meta.os`** -- reaches `:327`, `:353`, `:371`, `:381`, `:422`, `:438`. All via `fail`.
- **Target keys** -- reach `:236`, `:240`, `:244`, additionally `JSON.stringify`-escaped at
  the source so the offending byte stays readable, then collapsed by `fail`.
- **Hash values** -- reach `:381`, `:438`. All via `fail`.
- **Prototype-pollution-style keys** -- not exploitable. `JSON.parse` creates `__proto__`
  as an OWN property rather than mutating the prototype, and no code path in
  `compare.ts` or `assert-parity.ts` WRITES to an object derived from the record. Lookups
  that matter are driven from the literal `EXPECTED_TARGETS` / `LIKE_FOR_LIKE_META_KEYS` /
  `REQUIRED_META_KEYS` constants, none of whose members collide with an
  `Object.prototype` name, so no value can be inherited rather than supplied.

**And the gate is fail-closed independently of the log.** `assert-parity.ts` sets
`process.exitCode = 1` on the verdict-failure path (`:80`) and on the thrown-error path
(`:104`), and reaches exit 0 only through the ok branch. Under `set -euo pipefail`
(`ci.yml:773`) the bin's non-zero exit propagates past `tee`, so a forged success line
could never turn a red step green -- it could only mask the loss of the SECOND signal in a
state that is already red. The two halves the workflow comment calls jointly necessary
(`compare.ts:178-180` and the `^` anchor at `ci.yml:775`) are both present.

Live: 37 / 37 in `compare.spec.ts` at HEAD, including
`describe('a record cannot FORGE the success line through the failure detail')`
(`:451-532`).

## New findings

None at or above the `high` block threshold. Nothing here blocks the phase.

### NF-01 -- `pinned-deps.spec.ts` does not pin `nx` (low)

T-08-03's mitigation text states that "`nx` is exact-pinned at 23.1.0 and
`pinned-deps.spec.ts` fails the build if a specifier widens". The first half is true
(`package.json:40`). **The second half is false.** The guard asserts on exactly ten
specifiers -- `@actions/cache`, `@actions/core`, `@eslint/js`, `@nx/eslint`,
`@octokit/plugin-retry`, `@octokit/plugin-throttling`, `@octokit/rest`, `esbuild`,
`eslint`, `typescript-eslint` -- and `nx` is not among them. Widening `"nx": "23.1.0"` to
`"^23.1.0"` fails no test.

Severity **low**, and deliberately not higher: `package-lock.json` still pins the resolved
version and `npm ci` honours it, so a widened range only bites on a lockfile
regeneration. The accepted risk itself rests on the loud-at-import property, which IS
verified (`capture-hashes.mjs:49-54`). This is a missing secondary belt, not a live hole,
and `pinned-deps.spec.ts` is not a phase-8 file -- the gap is a plan-narrative
overstatement rather than a phase-8 regression.

Suggested follow-up: add one `it()` to `pinned-deps.spec.ts` for the `nx` specifier, or
correct the claim. Phase 9 scope.

### NF-02 -- the CORR-04 guard reads `nx.json` only, and `project.json` can override it (low)

`packages/github-cache/project.json` exists and declares the `integration` target (with
`command` and `options` only -- **no `inputs` key**, so `targetDefaults.integration.inputs`
does apply today and the discriminator is live). But both CORR-04 guards
(`nx-target-inputs.spec.ts:327-345` and `:367-374`) and the instrument's
`readDiscriminatorCommand` (`capture-hashes.mjs:220-239`) read `nx.json`'s
`targetDefaults` -- never the MERGED project configuration. Adding an `"inputs"` array to
`project.json`'s `integration` target would REPLACE `targetDefaults.integration.inputs`
wholesale, removing the platform discriminator from the effective hash while all three
reads stay green.

This matters for the Core-Value invariant specifically, which is why it is reported rather
than left as tidiness. With the discriminator gone, `integration` becomes OS-INVARIANT,
and a Linux-computed `integration` result becomes restorable on Windows -- a **wrong
result**, not a MISS. Audit priority 6's concern is real; the guard's coverage is narrower
than its comment implies.

Severity **low**, because the build-gating CI clause DOES catch it: an OS-invariant
`integration` fails `compare.ts:377-386` with `integration-not-divergent` on every run of
`hash-parity-compare`, which carries no `continue-on-error`. The residual is that the
nine-command local battery stays green, so the signal arrives late rather than never.
Defense in depth is working; the local layer has a hole.

Suggested follow-up: have the guard (or a new one) read the merged
`ProjectConfiguration.targets.integration.inputs` rather than `nx.json`'s `targetDefaults`.
The material already exists -- `capture-hashes.mjs:374` emits `projectConfiguration` into
every record. Note also that `08-05-PLAN.md`'s verification line "No `project.json` exists
in the workspace" is factually wrong; the executor already surfaced and recorded that
(`08-05-SUMMARY.md:66`, `:281`).

### NF-03 -- "build-gating" depends on repo settings not visible in the tree (informational)

Several threat mitigations describe `hash-parity-compare` as gating the branch or the
merge (T-08-27, T-08-28, T-08-29, and `ci.yml:628-649`). What the tree can prove is that
the job runs on `pull_request`, has no `continue-on-error`, and exits non-zero on a bad
verdict. Whether a red `hash-parity-compare` actually BLOCKS a merge is a
required-status-check setting on the base branch, and there is no in-repo record of it --
`docs/trust-and-security.md:99-109` documents default-branch protection as an operator
prerequisite but names no required checks.

Not a code defect and not scored as a gap. Recorded so the claim is not read as
tree-verified. Worth one confirmation that `hash-parity-compare` is in the required set,
since it is now the only standing enforcement of PARITY-03.

### NF-04 -- one failure-path print bypasses the `fail()` choke point (informational)

`assert-parity.ts:100-105` prints `error.message` directly, not through
`compare.ts:fail()`. For a truncated or non-JSON record that message is
`readRecords`'s wrapper (`:63-68`) around a V8 `SyntaxError`, and V8 embeds a raw snippet
of the offending file -- including literal newlines -- in that message. That is the same
mechanism WR-01 closed, at the one site the choke point does not cover.

**Empirically not exploitable today.** Probed against the real runtime: V8 caps the snippet
at roughly 11-12 source characters (`"x\nhash-par"...`), against a 22-character
`SUCCESS_PREFIX`, and the position-only message forms carry no source bytes at all. Six
payload placements were tried (error at position 0, payload-first, mid-document,
late-with-long-prefix, trailing-garbage, inside an unterminated string); none produced a
message line beginning with the success prefix. And as established above, this path sets
`process.exitCode = 1`, so `pipefail` fails the step before the grep runs regardless.

Informational because the residual is an unpinned dependency on a V8 internal: shortening
`SUCCESS_PREFIX`, or a V8 change to a wider snippet window, would reopen the second-signal
forge without any local code change. One-line hardening available -- route the loader's
message through the same `[\r\n]+` collapse. Not applied here: this audit does not modify
implementation, and the change is not needed to close any declared threat.

### NF-05 -- the accepted host-path disclosure is wider than T-08-04 / T-08-16 declared (low)

Both accept rows predicted "a repository path and an OS temp path" with "no credential,
token or work-domain string". The no-credential half is confirmed. The scope half is
understated. The committed `08-ROOT-CAUSE.md` `meta` blocks actually expose:

- the 8.3-truncated Windows account short name -- `C:\Users\LARSGY~1\...` at `:200`,
  `:578`, `:2188`, `:2289`;
- the local project path and drive layout, plus a **Claude Code session scratchpad path
  carrying a session UUID** -- `.../Temp/claude/D--projects-github-op-nx-github-cache/
  ecd11393-.../scratchpad/hp/cold/wsdata` at `:506`, `:508`, `:2233`, `:2235`;
- runner-side paths, which are public GitHub constants -- `/home/runner/work/...` at
  `:734`, `:2568`, and `C:\Users\RUNNER~1\...` at `:695`, `:2608`.

Nothing here has authentication value: the 8.3 form is a truncation of an account name the
git author field already publishes, and the session UUID is a local ephemeral identifier.
No record JSON file is committed (`git ls-files` returns none). The public-repo hygiene
rule is satisfied on its own terms -- an allowlist-inversion scan over every phase-8
planning file plus all new code returns **zero** email-shaped tokens other than the
approved public gmail, so neither the work email nor its bare domain appears in any
surface.

Severity **low**. The disposition stays `accept`; the accepted-risk log below records what
is actually there rather than what was predicted, which is the point of the log.

## Accepted risks log

| ID | Risk | Severity | Why accepted | Recorded scope |
|---|---|---|---|---|
| T-08-03 | `nx/src/*` is an internal subpath with no semver guarantee; an Nx major can move it | medium | The six static imports at `capture-hashes.mjs:49-54` fail LOUDLY at module load, never silently at read, and a dev-only instrument that will not load is a visible break rather than a wrong measurement. `nx` is exact at `package.json:40`. Same posture and in-repo precedent as `nx-target-inputs.spec.ts:35-37`. | Accepted for `capture-hashes.mjs` only. No shipped module imports `nx/src/*`. The secondary "a spec fails if the specifier widens" claim does NOT hold (NF-01). |
| T-08-04 | Host paths pasted into the committed `08-ROOT-CAUSE.md` record blocks | low | The values are paths, not secrets. No credential, token, or non-approved email-shaped token appears anywhere in the phase's committed content (verified by allowlist inversion). Removing them would destroy the record's value as evidence of WHERE each measurement ran, which is the whole point of the `meta` block. | Corrected and widened per NF-05: an 8.3 Windows account short name, the local project path, a Claude Code session UUID / scratchpad path, and public runner paths. No record JSON is committed. |
| T-08-11 | The `hash-parity-<os>` artifact is fetchable by anyone with the run URL on a public repo | low | Content is task hashes, npm package node names, runner paths, and the discriminator's stdout. The job requests no secret and the workflow grant stays `contents: read` (`ci.yml:9-10`, unchanged). Nothing in a record confers access to anything. | Accepted for both capture legs' artifacts. Retention is GitHub's default; no change requested. |
| T-08-16 | Host paths in the committed record, restated from the CI-side plan | low | Identical basis to T-08-04. | Identical scope to T-08-04, including the NF-05 correction. |

## Project-level ledger cross-check (C1-C18)

`THREAT-MODEL.md`'s eighteen CREEP controls were read row by row against the phase-8 diff.
**None is weakened.** The diff contains no backend, adapter, cache-server, write-trust-gate,
sync-gate, cleanup, retention, GHCR, mirror-filter or published-export change, so C1-C18
have no contact surface with this phase. C4's advisory-PPE and C14's docs rows are
untouched; the `permissions` grant they depend on is byte-identical.

The one invariant that DOES have contact is the Core Value "never a wrong result"
(`PROJECT.md:153`), which after this milestone rests on CORR-04's single declared
discriminator plus CORR-05's platform-agnosticism claim. This phase **strengthens** that
footing on net: it adds a byte-identical pin on the discriminator command
(`nx-target-inputs.spec.ts:367-374`) where only a presence check existed, and it adds a
build-gating CI clause that fails when the discriminator stops discriminating in FACT
rather than in declaration (`compare.ts:377-386` and `:417-428`). The one place the footing
is narrower than its own comments claim is NF-02, and the CI clause covers exactly that
case.

## Unregistered attack surface

No `## Threat Flags` section exists in any of the six summaries, so the new surface was
enumerated from the diff independently. Every item maps to a declared threat:

| New surface | Maps to |
|---|---|
| `capture-hashes.mjs` -- root dev-only ESM script; reads files, writes a JSON record, shells out | T-08-01, T-08-03, T-08-05. Additionally checked and clean: `git()` at `:207-213` uses `execFileSync` with fixed args and no shell; `runDiscriminator` at `:248-261` uses `shell: true` but its ONLY input is the `nx.json`-declared string, which Nx itself executes through a shell for runtime hashing, so the instrument mirrors production rather than adding surface; `--out` and `--diff` paths are operator-supplied, and in CI the matrix value is passed via the `RECORD` env var and quoted (`ci.yml:617-621`) so it never lands on a re-parsed command line. |
| `src/hash-parity/compare.ts` + `assert-parity.ts` -- untrusted JSON crossing a job boundary into a build gate | T-08-06, T-08-07, T-08-09, T-08-30, T-08-32, plus the WR-01 re-confirmation and NF-04 |
| `hash-parity` + `hash-parity-compare` CI jobs | T-08-12, T-08-13, T-08-14, T-08-15, T-08-27, T-08-28, T-08-29, T-08-31, T-08-32, NF-03 |
| `actions/upload-artifact@v7`, `actions/download-artifact@v8` -- first use of artifacts in this repo | T-08-SC. Pinning convention matches the pre-existing `actions/checkout@v7` / `actions/setup-node@v6` major-tag form at 18 sites. |
| `nx.json` `targetDefaults.typecheck.outputs` -- seven entries | T-08-21, T-08-23 |
| `dist/hash-parity` build output inside the package tree | T-08-08, T-08-10, T-08-26 |

One item worth stating plainly rather than filing: on a **fork** `pull_request`, the
workflow runs the FORK's tree, so a fork can weaken its own copy of the comparator, the
instrument or the job. That is inherent to `pull_request` on a public repo -- the run gets
`contents: read` and no secrets, and containment is human review plus the base branch's
required checks (NF-03), not the gate itself. It is not a phase-8 regression and no
mitigation is owed here.

## Conclusion

Every one of the 34 declared threats is verified: 30 mitigations found PRESENT in the cited
code, and 4 `accept` dispositions logged above with their scope corrected where the plan
understated it. No `transfer` disposition was declared anywhere in the register.

The gate this phase exists to install is fail-closed. Exit 0 from
`assert-parity.js` is equivalent to an ok verdict, `set -euo pipefail` carries that exit
code past `tee`, the anchored grep is a genuinely independent second signal now that the
`fail()` choke point is in place, and the whole chain has been observed RED on a real
mutated leg and GREEN on its revert with run references. No record-controlled value can
forge a pass.

Five new findings, all below the `high` block threshold: three `low` (NF-01, NF-02, NF-05)
and two `informational` (NF-03, NF-04). **Nothing at high or above is open.** No
implementation file was modified by this audit.

---

_Audited: 2026-07-28_
_Auditor: Claude (gsd-security-auditor)_
_ASVS level 1, block_on high_
