# Quick Task 260801-vyy: Resolve CR-18 - Research

**Researched:** 2026-08-01
**Domain:** GitHub Actions expression + `needs:` semantics, Actions-cache scoping on pull requests, Nx input-hash blast radius
**Confidence:** HIGH (every load-bearing claim is CITED from GitHub's own reference docs or MEASURED in-repo)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **GA-1:** un-push-gate `dogfood-seed` / `dogfood-verify` so the already-sound cross-OS gate runs on
  pull requests. Do NOT gate the three Windows legs' `[remote cache]` counts.
- **GA-2:** same-repo PRs only. Trigger becomes
  `if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository`.
  Fork PRs stay on the push path. Name the exclusion in the comment.
- **GA-3:** keep the three legs' counts RECORDED, and correct the factually-wrong OBS-04 reason in the
  same commit, in both `ci.yml` and `dogfood-cross-os.spec.ts`.
- **GA-4:** pin the new trigger in `dogfood-cross-os.spec.ts`.

### Claude's Discretion

- Exact wording of replacement comments.
- Whether the new spec clause lives in the existing `dogfood-cross-os.spec.ts` describe or a new one
  (prefer the existing file).
- Whether to also correct the header block's other two stale sentences (~1615-1617). Recommended: yes.

### Deferred Ideas (OUT OF SCOPE)

- Alternative (b): gating `count >= 1` on the three Windows legs -- rejected as launderable.
- Alternative (c): a read-only Actions-cache backend making `count >= 1` sound -- recorded as a
  follow-up FEATURE, after (a), not instead of it.
- The other 24 review findings; any change to `nx.json`.
</user_constraints>

## Summary

The locked approach is confirmed sound on every platform assumption it rests on. The chosen `if:`
expression is safe on a `push` event (a missing context property dereferences to an EMPTY STRING, not
an error), the bare unwrapped form is legal and matches house style, a skipped `dogfood-seed` cleanly
skips `dogfood-verify`, and a same-repo `pull_request` run demonstrably writes AND reads back an
Actions-cache entry inside its own merge-ref scope.

**One CONTEXT.md claim is refuted and must not reach a committed comment:** GitHub does **not** evict
PR-scoped caches when the PR closes. See the CONTRADICTION section.

The stale-claim sweep found **more sites than GA-3 names** -- two of them inside
`dogfood-cross-os.spec.ts` itself, one of which is a live assertion message.

**Primary recommendation:** author the widened `if:` on ONE line (prettier-stable, measured), pin it
with a single-line `^ {4}if: ...$` regex in `dogfood-cross-os.spec.ts` alongside the existing seed /
verify describe, and correct all seven stale sites in the same commit.

---

## CONTRADICTION -- one locked-context claim is false

**CONTEXT.md `## Specific Ideas > Cost` says:** *"PR writes land in the merge-ref scope, invisible to
main's cache, and GitHub evicts them when the PR closes."*

The first half is CITED and correct. **The second half is false.** GitHub's caching reference documents
exactly two eviction mechanisms: entries not accessed in over 7 days, and LRU eviction once the repo
passes its 10 GB cache cap. Closing a pull request is not one of them.
[CITED: docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#default-limits]

GitHub's *Managing caches* how-to supplies an **opt-in** example workflow whose stated purpose is
"to delete caches on a faster cadence than the cache eviction policy will" -- specifically "delete up
to 100 caches created by a branch once a pull request is closed," triggered on
`pull_request: types: [closed]`. That example would be pointless if closing the PR evicted them.
[CITED: docs.github.com/en/actions/how-tos/manage-workflow-runs/manage-caches]

**Does this break the locked approach? No.** The entries are still merge-ref-scoped and invisible to
`main` (the load-bearing property), and the seed payload is a single short dogfood string
(`nx-github-cache-dogfood:<os>:run-<id>`) -- storage impact against a 10 GB cap is nil. The correction
is purely to the *reason written down*. This branch has now corrected the same class of defect three
times (`fd75d83`, `7e777b3`, `9e949e4`); planting a fourth false claim while closing CR-18 would be
self-inflicted.

**Replacement wording (accurate):** PR writes land in the merge-ref scope, invisible to main's cache,
and age out under the standard 7-day-unaccessed policy -- GitHub does not evict them at PR close.

---

## Focus 1 -- `if:` expression semantics [CONFIRMED SAFE]

| Question | Answer | Source |
|---|---|---|
| Missing property on a `push` event -- error or safe? | **Safe.** "If you attempt to dereference a nonexistent property, it will evaluate to an empty string." | [CITED: contexts reference] |
| Result of the comparison on a push | `'' == 'op-nx/github-cache'` -> both operands are strings, so no numeric coercion; plain case-insensitive string compare -> **false**. (Even under the number-coercion path it is false: empty string -> `0`, non-numeric string -> `NaN`.) | [CITED: expressions reference, loose-equality table] |
| Is `\|\|` short-circuiting? | **Not documented, and it does not matter.** The RHS is safe to evaluate on every trigger, so the whole expression is total either way. Do not add a defensive `&& github.event_name == 'pull_request'` clause -- it buys nothing (`&&` short-circuit is equally undocumented) and adds noise. | [ASSUMED -- absence of a documented guarantee] |
| Does a multi-clause `if:` need `${{ }}`? | **No.** "When you use expressions in an `if` conditional, you can, optionally, omit the `${{ }}` expression syntax." The single documented exception is an expression **starting with `!`** (YAML reserved). Ours starts with `github.`, so the bare form is legal. | [CITED: workflow-syntax, `jobs.<job_id>.if`] |
| House style in this repo | Mixed **for a reason**: the two `!cancelled()` sites (`ci.yml:997`, `:1569`, `:1870`) are wrapped because they start with `!`; every bare-`github.` gate is unwrapped (`:1622`, `:1687`, `:1735`, `:2089`). The rule is the documented one, not taste. **Use the bare form** -- it matches `dogfood-seed`'s current line and the whole `github.`-prefixed family. | [VERIFIED: git grep over ci.yml] |
| Prettier stability of a 106-char single-line `if:` | **Stable -- measured.** `ci.yml` is NOT in `.prettierignore`, so `nx format:check --all` covers it. Ran the exact candidate line through this repo's prettier: byte-identical output, no rewrap. Keep it on ONE line. | [VERIFIED: local prettier run] |

---

## Focus 2 -- `needs:` interaction with a shared gate [CONFIRMED SAFE]

> "If a job fails **or is skipped**, all jobs that need it are skipped unless the jobs use a
> conditional expression that causes the job to continue."
> [CITED: workflow-syntax, `jobs.<job_id>.needs`]

`dogfood-verify` (`needs: dogfood-seed`, `ci.yml:1688`) carries no status-check function in its `if:`,
so the default `success()` still applies on top of the custom condition. A skipped seed **skips**
verify -- it is never left queued and never fails. Putting the same condition on both jobs is
belt-and-braces, consistent, and matches the file's existing pairing (`publish` / `publish-verify`).

**Concurrency interaction (`ci.yml:12-29`):** `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`,
group `ci-${{ github.ref }}` (a PR's ref is `refs/pull/N/merge`, so the two event kinds cannot share a
group). The comment's justification for not cancelling push runs is that push runs WRITE, and it
already carries the qualifier that PR runs "write nothing **outside their own merge-ref cache scope**"
-- which stays true after this change. The new PR-side write is safe under cancellation for a reason
worth naming: the seed key is `nx-cache-<GITHUB_RUN_ID>`, so a cancelled mid-upload leaves at most an
absent entry for a run id that is never reused. There is no first-write-wins filename arbitration to
poison, which is the specific hazard the comment reserves cancellation-avoidance for. **No change to
the concurrency block is required** -- but a one-clause note is cheap insurance against a future
reader concluding the qualifier is now stale.

---

## Focus 3 -- cache scope on same-repo pull requests [CONFIRMED -- the load-bearing assumption holds]

> "When a cache is created by a workflow run triggered on a pull request, the cache is created for the
> merge ref (`refs/pull/.../merge`). Because of this, the cache will have a limited scope and can only
> be restored by re-runs of the pull request. It cannot be restored by the base branch or other pull
> requests targeting that base branch."
> [CITED: dependency-caching#restrictions-for-accessing-a-cache]

> "The `pull_request` event is **not affected** [by the low-trust read-only restriction]. Caches created
> by a `pull_request` run are already scoped to the merge ref and cannot be written to the default
> branch's scope."
> [CITED: dependency-caching#cache-access-for-low-trust-workflow-triggers]

So: a `pull_request` run **can write**, the entry lands in the PR's own merge-ref scope (not main's),
and it is restorable within that scope -- which includes the same run. The second quote is the
decisive one: GitHub's 2026 cache-poisoning hardening explicitly carves `pull_request` OUT of the
read-only-in-default-scope rule, so the write capability is documented policy rather than an
accident.

**Corroborated in-repo, not merely cited.** The `integration` job is ungated (runs on every PR),
saves its own key through the sidecar, and then runs a **200-only** positive control against that
just-saved key (`ci.yml:861-927`; a 404 there is a hard control FAILURE). Every green PR run of this
workflow is therefore a standing measurement that a same-repo PR run writes and reads back inside its
own scope. `ci.yml:200-208` already records this in prose. [VERIFIED: in-repo]

**Eviction:** see the CONTRADICTION section -- 7-day-unaccessed and the 10 GB LRU cap only.

---

## Focus 4 -- repo-local sites and pitfalls

### 4a. The stale-claim sweep found SEVEN sites, not the five GA-3 implies

| # | Location | Stale text | Named by GA-3? |
|---|---|---|---|
| 1 | `ci.yml:527` | "dogfood-verify is push-gated, so the bump PR would merge with no signal anywhere" | implied |
| 2 | `ci.yml:600` | same sentence (typecheck-windows) | implied |
| 3 | `ci.yml:673` | same sentence (test-windows) | implied |
| 4 | `ci.yml:535-537`, `608-610`, `681-683` | "Gating on a non-zero count would redden a CORRECT leg ... which is OBS-04's lesson" -- the intra-run/cross-run misattribution | **yes (GA-3 item 1)** |
| 5 | `ci.yml:1615-1617` | "Both jobs run ONLY on the default-branch push trigger, because the write gate trusts no other trigger (push/schedule only)" | discretionary |
| 6 | `dogfood-cross-os.spec.ts:692` | `cacheObservation` reason: "dogfood-verify is push-gated, so the bump PR merges with no signal anywhere" + the OBS-04 sentence at :694-695 | **yes (GA-3 item 2)** |
| 7 | **`dogfood-cross-os.spec.ts:261` and `:287-288`** | the `action-bundle-drift` describe: "the same gate that makes VER-06 and OBS-04 unobservable pre-merge" (doc comment) and, in a **live assertion message**, "which is exactly the gate that already makes VER-06 and OBS-04 unobservable before a merge" | **NO -- new finding** |

Site 7 is the one that will bite. It is the argument for why `action-bundle-drift` must stay
PR-eligible, and after this change its supporting premise (VER-06 unobservable pre-merge) is false for
VER-06 while still true for OBS-04. The clause itself stays correct and must NOT be weakened -- narrow
the prose to OBS-04 and note that VER-06 became PR-observable in this commit.

Two adjacent RULE statements (`ci.yml:1212-1213` and `:1497-1498`: "Every job in this file carrying
`if: github.event_name == 'push'` does so because it WRITES") get slightly *more* accurate after the
change, since the read-only `dogfood-verify` stops carrying the bare form. Optional touch-up at most.

### 4b. What DOES and does NOT pin the lines being edited

`docs-same-os-claims.spec.ts` reads `ci.yml` **RAW** and `toContain`-pins exact comment phrases via
`DOCS_08_SITES`. Scanned every string literal in that spec against `ci.yml` line by line: the pinned
ci.yml phrases land at **lines 947, 956, 973, 977, 1006, 1899-1913, 1989, 2065-2080** -- **none** of
them on any line this task edits. In particular `'RECORDED and never GATED: a zero count is CORRECT on
the windows leg'` pins **`ci.yml:956`, the `o3-witness` block**, not the three Windows legs. Editing
the legs' comments and the header block is safe. [VERIFIED: scripted cross-scan]

`dogfood-cross-os.spec.ts` reads `ci.yml` **comment-stripped** (`codeLines` filters every line whose
trim starts with `#`), so no comment edit can redden it -- and, symmetrically, no comment lock can be
placed there. The file says so itself, twice.

`MASKED_TOKEN_SITES = 8` (`:1083`) counts `::add-mask::` sites -- untouched by this change. Nothing in
the tree pins a job COUNT or a line number in `ci.yml`. The concurrency comment's "fans out to
twenty-two jobs" stays true (no jobs added). [VERIFIED: git grep]

### 4c. How to write the new pin, in house style

`jobBlock(name)` (`dogfood-cross-os.spec.ts:62-77`) slices from `^  <name>:$` to the next 2-space key,
over the comment-stripped lines. Constraints the new clause must respect:

- **Anchor at FOUR spaces.** A job's own keys sit one level under the two-space job key. The file's
  existing `if:`-shaped clause is `.not.toMatch(/^ {4}if:/m)` (`:289`) -- mirror it as a positive
  `toMatch`. An unanchored match would be satisfied by a step-level `if:` (eight spaces).
- **Positive control FIRST.** Every describe in this file leads with one. The seed/verify describe
  already has one at `:80-85` (`operation: seed` / `operation: verify`), and `jobBlock` THROWS on an
  absent job key -- so adding the clause to that existing describe inherits both guards. Prefer it
  over a new describe (matches the discretion note, and avoids duplicating the control).
- **Assert BOTH clauses of the disjunction, in one `toMatch` on the whole line.** A regex matching only
  `github.event_name == 'push'` would stay green against a silent revert to push-only -- exactly the
  reopening CR-18 that GA-4 exists to prevent.
- **Single line only.** If the `if:` is ever authored as a folded/multi-line YAML scalar, `jobBlock`
  joins the lines with `\n` and a single-line `$`-anchored regex silently fails. Prettier is measured
  not to rewrap the one-line form, so keep it one line and say so in the reason string.
- **Reason strings carry the argument** (see `windowsLegReasons`, `:634-717`) and end with
  `RENAME_NOTE`-style "update the assertion in the SAME commit; do not delete it to make the suite
  green."
- **Do NOT put a comment-phrase assertion in this file** -- vacuous by construction. If the new prose
  needs a lock, it belongs in `docs-same-os-claims.spec.ts` as a `DOCS_08_SITES` row.

---

## Focus 5 -- Nx hash blast radius [ACCEPTABLE, and it is the normal case]

`.github/workflows/ci.yml` appears in **exactly one** target's inputs: `targetDefaults.test.inputs`
(`nx.json:70`, PARITY-08). It is not in `build`, `typecheck`, `lint`, or `integration` inputs, and it
sits at `{workspaceRoot}`, outside the `{projectRoot}/**/*` glob those targets inherit via `default`.
[VERIFIED: read of nx.json]

| Edited file | Rotates |
|---|---|
| `.github/workflows/ci.yml` | `test` only |
| `packages/github-cache/src/dogfood-cross-os.spec.ts` | `test`, `typecheck`, `lint`, `integration` (all inherit `default` = `{projectRoot}/**/*`). NOT `build` -- it explicitly excludes `**/*.spec.ts` (`nx.json:120`). |

**This is expected, not a problem.** The branch's subject is hash **parity** (ubuntu and Windows
computing the SAME hash), not hash **immutability**. Rotation on a source edit is the design.
`.gitattributes` (`* text=auto eol=lf`) keeps both files byte-identical across runners, so both OSes
rotate to the same new hash and `test-windows` can still consume the ubuntu `test` entry produced
earlier in the same run.

Concrete precedent, measured: run **30717611910** rotated `test` for exactly this reason (three
declared `test` inputs edited); ubuntu `test` MISSed and executed, and `test-windows` still recorded
**1**. Same shape as this commit. `hash-parity` compares hashes rather than storage and is unaffected
by which value the hash takes.

**One derived expectation for the first run after this commit:** since `test` rotates and `ci.yml` is a
`test` input, the ubuntu `test` leg will MISS-and-save, and `test-windows` records whatever the
restore yields. Do not read a low count there as a regression -- that is precisely the laundering-prone
diagnostic GA-3 keeps ungated.

---

## Common Pitfalls

1. **Authoring the `if:` across two lines.** Breaks the new single-line spec pin with a confusing
   failure and gains nothing (prettier does not require it -- measured). One line.
2. **Correcting only the two sites GA-3 names.** Sites 1-3, 5 and especially 7 above stay false.
   Site 7 is a live assertion message, so the falsehood ships inside the test suite's own output.
3. **Weakening `action-bundle-drift`'s `not.toMatch(/^ {4}if:/m)`** while "tidying" its now-partly-stale
   reason. The clause is correct and load-bearing; only the prose changes.
4. **Adding a `${{ }}` wrapper "for consistency."** Legal, but it breaks consistency with every other
   bare `github.`-prefixed gate in the file and obscures the real rule (the wrapper marks `!`-leading
   expressions).
5. **Writing "GitHub evicts them when the PR closes" into the new comment.** False -- see
   CONTRADICTION. A fourth false claim on a branch whose theme is correcting false claims.
6. **Giving `dogfood-seed` a Windows leg** because the gate now runs on PRs. The VACUITY CONDITION
   (`ci.yml:1666-1674`) is unchanged and the spec pins it at `:97-108`.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `\|\|` short-circuit behaviour is undocumented in GitHub's expression language | Focus 1 | None -- the expression is total either way because the RHS never errors. |
| A2 | A cancelled PR run mid-cache-upload leaves no permanent artifact (run-id keys are never reused) | Focus 2 | Low -- worst case is one absent entry for a superseded run; the superseding run seeds its own. |

## Sources

**Primary (HIGH):**
- `docs.github.com/en/actions/reference/workflows-and-actions/contexts` -- nonexistent property -> empty string
- `docs.github.com/en/actions/reference/workflows-and-actions/expressions` -- operators, loose-equality coercion table
- `docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax` -- `jobs.<job_id>.if` (`${{ }}` optional, `!` exception); `jobs.<job_id>.needs` (skip propagation)
- `docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching` -- merge-ref scoping, `pull_request` carve-out from the low-trust read-only rule, 7-day / 10 GB eviction
- `docs.github.com/en/actions/how-tos/manage-workflow-runs/manage-caches` -- opt-in PR-close cleanup example (refutes auto-eviction)

**In-repo MEASURED / VERIFIED:**
- `nx.json:70` (`ci.yml` is a `test` input, and only `test`); `nx.json:120` (build excludes specs)
- `ci.yml:200-208, 861-927` (the ungated `integration` job's 200-only positive control on its own just-saved PR-scope key)
- `.gitattributes` (`* text=auto eol=lf`)
- Local prettier run on the candidate `if:` line -- byte-identical, no rewrap
- Scripted cross-scan of every `docs-same-os-claims.spec.ts` string literal against `ci.yml` lines
- Run 30717611910 (CONTEXT.md) -- `test` rotated, `test-windows` still recorded 1
