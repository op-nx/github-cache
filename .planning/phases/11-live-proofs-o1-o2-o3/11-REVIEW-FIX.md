---
phase: 11-live-proofs-o1-o2-o3
fixed_at: 2026-07-30T01:20:00Z
review_path: .planning/phases/11-live-proofs-o1-o2-o3/11-REVIEW.md
iteration: 1
findings_in_scope: 17
fixed: 17
skipped: 0
no_change_needed: 0
status: all_fixed
tests_before: 840
tests_after: 848
test_files: 39
check_action: pass
new_guards: 8
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-07-30
**Source review:** `.planning/phases/11-live-proofs-o1-o2-o3/11-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 17 (1 critical, 11 warning, 5 info -- maintainer chose "fix everything")
- Fixed: 17
- Skipped: 0
- `no_change_needed`: 0

**Suite:** 840 passed -> **848 passed / 0 failed**, 39 files. The +8 are the new
assertion-level guards (5 from WR-04, 1 from WR-11, 2 from WR-09).
**`npm run check:action`:** exit 0. **`nx run-many -t lint typecheck`:** pass. **Prettier:** clean.
**All 10 Phase 11 locked ci.yml phrases:** present, each matched WITHIN a single line
(verified by direct line-scan after the final commit, not merely by the suite being green).

Every new guard was observed RED against a deliberate mutation before being committed, and the
mutation was reverted in the same step. No deliberately-broken state was left behind.

---

## Working-tree deviation, recorded rather than done silently

**This ran in the MAIN working tree, not an isolated git worktree.** The agent role prescribes a
worktree. It was not used here for a measured reason: this project's own recorded finding is that
a worktree with a junctioned `node_modules` makes esbuild rewrite ~689 module paths with no source
edit, so `check:action` reports FALSE drift and only the main tree gives a true bundle verdict.
Constraint 4 required a true `check:action` verdict, which the prescribed isolation would have
made unobtainable. The main tree was clean at start, no other worktree existed, and every commit
staged specific files by name.

---

## Fixed Issues

### CR-01: `$GITHUB_ENV` injection from an artifact-controlled value

**Files:** `.github/workflows/ci.yml`
**Commit:** `19a209e`
**Applied fix:** Reviewer's **Option A** -- the `$GITHUB_ENV` sink is DELETED, not filtered. The
export step is gone; `h_linux` is now read inside its one consuming step. A `case` shape check
(`''|*[!0-9]*`) replaces the `-z` emptiness test, since Nx renders a task hash as all-decimal.

**Observed red:** the guard was exercised directly against the payload class the review named.
`8059758544828235640` ACCEPT; `""` REJECT; `123\nBASH_ENV=/tmp/evil.sh` REJECT; `abc` REJECT;
`123 456` REJECT. The embedded-newline payload -- the actual injection vector -- is rejected.
A regression lock on this guard was added under WR-04 (case 5), so reverting to `-z` now reddens.

---

### WR-01: guarded task absence but never the hash value

**Files:** `read-integration-hash.mjs`
**Commit:** `774f62d`
**Applied fix:** GUARD 3 added (`typeof task.hash !== 'string' || !/^[0-9]+$/.test(task.hash)`).
Header prose corrected from "BOTH GUARDS BELOW THROW" to describe all three.

**Observed red:** fixture with `hash: ""` throws with the intended message and exit 1; fixture with
a real hash writes 19 bytes and exits 0.

---

### WR-02: first-match ignored `projectName`

**Files:** `read-integration-hash.mjs`
**Commit:** `c5c1c41`
**Applied fix:** `.find()` -> `.filter()` plus an exactly-one assertion, enumerating every matching
`taskId` on failure.

**Observed red:** two-`integration`-task fixture fails naming both taskIds; zero-task fixture fails
naming observed targets; the one-task fixture passes.

---

### WR-03: GUARD 1 was a substring test

**Files:** `read-integration-hash.mjs`
**Commit:** `d8403c8`
**Applied fix:** `.includes(TARGET)` -> `/(^|\s)integration(\s|$)/`.

**Proof it TIGHTENS rather than weakens** (constraint 1): enumerated old-vs-new over the review's
cited spoofs. The set of commands NEW accepts that OLD rejected is EMPTY; `--projects=integration-fixtures`
flips PASS -> REJECT. `\b` was rejected as a fix -- there is a word boundary between `n` and `-`, so
`\bintegration\b` still matches `integration-fixtures`.

**Extra correction:** the failure message said "does not mention `integration`", which was now false
(the spoof *does* contain it). Reworded to "does not name `integration` as a whitespace-delimited
token", with the `--projects=integration-fixtures` example inline.

---

### WR-04: nothing asserted the `o3-witness` step BODY

**Files:** `packages/github-cache/src/dogfood-cross-os.spec.ts`
**Commit:** `ef88f79`
**Applied fix:** Five cases added to the existing `o3-witness` describe -- the reviewer's four plus
one locking CR-01's shape check (equally silently-deletable, and it guards the Critical fix).

**Confirmed non-vacuous before writing:** dumped the comment-STRIPPED `jobBlock('o3-witness')` and
confirmed every asserted clause is real shell, not the comment explaining it.

**Observed red -- one mutation per guard, and the discrimination was exact (1 failed / 844 passed each time):**

| Mutation | Failing case |
|---|---|
| `select(.key == $key and .ref == $ref)` -> `.actions_caches[0].created_at` | compares .key for EXACT equality |
| drop `// empty` alone | terminates the cache extraction with // empty |
| `-lt 30` -> `-lt 0` | demands the STATED 30-second minimum margin |
| delete the `grep -q` second signal | proves the verdict was PRINTED |
| shape check -> bare `''` emptiness test | validates the downloaded H_linux SHAPE |

Each mutation reddened exactly its own case and no other.

---

### WR-05: `--assert-graph-premise` was invoked by nothing

**Files:** `.github/workflows/ci.yml`, `package.json`, `capture-hashes.mjs`
**Commit:** `cffe79a`
**Applied fix:** Wired into the `hash-parity` job on BOTH matrix legs (the premise is about the
WINDOWS leg's resolved graph, so a ubuntu-only check would assert it on the wrong runner), plus the
`assert:graph-premise` npm script. Header now records where each mode executes.

**Adapted from the reviewer's snippet -- one correction:** the review implies folding the `--out`
record into the existing artifact. Checking `assert-parity.ts:53` first showed the loader reads
EVERY `.json` in the merged download directory, so `graph-premise-*.json` inside the `hash-parity-*`
artifact would hand the comparator four records where it demands two and redden `wrong-record-count`
on a CORRECT run. It is uploaded as a SEPARATE artifact whose name deliberately does not match
`hash-parity-*`.

**Observed red:** the mode's redness had never been committed-proven. Two mutations, each producing a
loud differentiated failure at exit 1: adding `integration` to `FORBIDDEN_TARGETS` fires assertion 2;
switching `CONTROL_TARGET` to `test` fires assertion 3 ("resolved 1 task(s), wanted exactly 2").

---

### WR-06: two of five assertions cannot fail

**Files:** `capture-hashes.mjs`
**Commit:** `21dc59f`
**Applied fix:** The reviewer's cheaper option -- assertions 5 and 6 KEPT, contract comment corrected.
Restructured into "THREE CLAUSES OVER THE RESOLVER" (1-4, live) and "TWO CLAUSES OVER THE CONSTANTS"
(5-6, belt and braces), with matching inline notes at each site. No working assertion was deleted.

**One finding SHARPER than the review.** The review says 5 and 6 are "reachable only if
`FORBIDDEN_TARGETS` or `CONTROL_TARGET` is edited". That is true of 5 but NOT of 6. Assertion 6 is
unreachable for ANY value of the constants: clause 2 passing means no `integration` member carries a
forbidden segment, clause 5 passing means some control member does, so the sets cannot be equal.
Verified two ways -- a brute-force search over all subsets of a six-target universe found no
counterexample, and empirically `FORBIDDEN_TARGETS = []` and `= ['zzz']` each make clause **5** the
first to fail, never 6. The comment now states 5 as constant-guarded and 6 as written-down intent
that must not be counted as coverage.

---

### WR-07: the premise record claimed a commit it did not prove it measured

**Files:** `capture-hashes.mjs`, `.gitignore`
**Commit:** `22754c1`
**Applied fix:** `workingTreeClean` measured before the graph is built and recorded on the premise
record, mirroring `capture()`.

**Necessary addition the review did not name.** The field would have been NOISE without it: the CI
records are written to the workspace root and `hash-parity-*.json` was NOT gitignored, so whichever
of the two steps ran second would always see the first's output and report `false`. `/hash-parity-*.json`
and `/graph-premise-*.json` are now gitignored, so the field reveals an uncommitted `nx.json` edit --
which is the only thing it exists to reveal.

**Observed:** reports `false` on a dirty tree. The TRUE branch could not be observed locally because
the two untracked `.planning/FALLOW*.json` files (out of scope, see below) keep `git status --porcelain`
non-empty; the predicate is the same one-line check `capture()` has used since Phase 8, and CI runs it
after a pristine checkout.

---

### WR-08: `resolvedTaskIds` hardcoded a single-project run-many

**Files:** `capture-hashes.mjs`
**Commit:** `97a6ddc`
**Applied fix:** Seeded from the project graph instead of a pinned `[PROJECT]`.

**The reviewer's literal fix BREAKS the mode, and this was caught by measuring rather than assuming.**
The review states "Today the workspace has one project so the set is a singleton". The graph actually
holds TWO nodes -- `@op-nx/github-cache` and the ROOT package `@op-nx/source`. The suggested
`Object.keys(projectGraph.nodes)` throws `Cannot find configuration for task @op-nx/source:integration`,
because `createTaskGraph` demands the target exist on every project it is handed. `run-many` does not:
it seeds only projects that DECLARE the target. The implementation filters by target declaration,
which reproduces `run-many`'s own selection.

**Observed:** with the real graph, OLD and NEW agree exactly for both `integration` and `typecheck`
(no regression). With a synthetic second project declaring `integration`, OLD silently returns 1 task
while NEW returns 2 -- the silent narrowing demonstrated and closed. A widened graph now reddens
assertions 3/4 with both sets enumerated, which is fail-loud rather than fail-narrow.

---

### WR-09: DOCS_08 row A locked only one of the two comment blocks

**Files:** `packages/github-cache/src/docs-same-os-claims.spec.ts`
**Commit:** `2370fbe`
**Applied fix:** Reviewer's **Option B** -- occurrence COUNT asserted as exactly 2 for both of row A's
phrases, in a dedicated describe. Chosen over Option A precisely because it changes no `ci.yml` prose
and therefore cannot disturb the other nine locked phrases. Row A is kept in the table alongside it:
the two failures say different things ("the phrase is gone" vs "it survives in only one of two
blocks"), and removing the row would force a rewrite of the header's five-row Phase 11 arithmetic.

**Observed red -- and this is the cleanest evidence in the whole pass.** Deleting ONE of the two
occurrences:

- the EXISTING row A assertion **PASSED** (`✓ still contains 'ci.yml IS in nx.json's test inputs ...'`)
  -- the half-lock proven real, not merely argued;
- the NEW count assertion **FAILED** for that phrase;
- the second phrase's count stayed 2 and passed, so the guards discriminate per phrase.

---

### WR-10: the positive control suppressed its own diagnostic

**Files:** `.github/workflows/ci.yml`
**Commit:** `d33d8ef`
**Applied fix:** `|| true` on the `curl` substitution, matching the sibling readiness poll.

**Observed red, after correcting a false negative in my own harness.** A first attempt wrapped the
snippet in `( ... ) || echo`, which SUPPRESSES `errexit` inside the subshell and made the bug look
absent. Re-tested the way Actions actually runs a step -- `bash -e <script-file>`:

- pre-fix: **exit 7 with completely EMPTY output** -- the step dies on a bare curl exit with no
  explanation, exactly as the review describes;
- post-fix: exit 1 carrying both `positive control: GET -> 000 (wanted 200)` and the
  "MISS observation is not evidence" message.

---

### WR-11: artifact-name literal not tied to the `integration` matrix

**Files:** `packages/github-cache/src/dogfood-cross-os.spec.ts`, `.github/workflows/ci.yml`
**Commit:** `0aaff25`
**Applied fix:** Both halves the review offers -- the contract note beside the download, AND a spec
clause. The clause reads the label OUT of the witness rather than spelling it, so a legitimate
coordinated bump stays green and only a DRIFT reddens. A `toBeDefined()` positive control runs first
so `toContain(undefined)` cannot throw-instead-of-assert.

**Observed red:** bumping the download to `ubuntu-26.04-arm` fails with the three-literals message.

---

### IN-01: `--assert-graph-premise` silently swallowed `--diff`

**Files:** `capture-hashes.mjs`
**Commit:** `d545920`
**Applied fix:** `args.diff !== undefined` added to the premise branch's exclusivity check, message
extended and made specific about which flag was actually seen.

**Observed red:** `--assert-graph-premise --diff a.json b.json` exits 1 naming `--diff a.json b.json`;
`--assert-graph-premise --install-mode ci` exits 1 naming `--install-mode ci`; the mode alone still
prints `PREMISE OK`.

---

### IN-02: `--out` with a missing value fell back to stdout

**Files:** `capture-hashes.mjs`
**Commit:** `5402679`
**Applied fix:** Throws when `--out` is last or is followed by another `--` flag.

**Observed red:** `--out` as final argument exits 1 ("it was the last argument"); `--out --install-mode ci`
exits 1 naming the offending flag. Both green paths still work -- `--out <path>` writes 712 bytes,
and omitting `--out` still prints to stdout.

`--install-mode` and `--diff` were checked and need no equivalent: a missing value already reaches
their own explicit throws. `--out` was the only unguarded one.

---

### IN-03: witness misattributed an upstream failure to a rename

**Files:** `.github/workflows/ci.yml`
**Commit:** `51462b5`
**Applied fix:** The step OBJECT is extracted (`jq -c`), then `.started_at` derived from it, so
"step ABSENT" and "step EXISTS but never STARTED" get separate messages. The second reports
`status=` and `conclusion=`.

**Observed red:** against two fixtures, the OLD `.started_at`-only selector returns an IDENTICAL
empty string for both a renamed step and a `status: queued, started_at: null` step -- the
misattribution reproduced. The NEW split yields "ABSENT (rename/deletion)" and "EXISTS but never
started (status=queued conclusion=<absent>)" respectively.

---

### IN-04: `/actions/runs/{id}/jobs` fetched unpaginated

**Files:** `.github/workflows/ci.yml`
**Commit:** `8b6643b`
**Applied fix:** Explicit page walk (stop on first match, or on a short page), 20-page runaway
ceiling. Chose the loop over the review's "note the cap" alternative because the failure mode is a
CORRECT run reporting a rename that did not happen.

**Observed:** against a mock endpoint -- short-page fixture resolves on page 1; a fixture whose page 1
is 100 filler jobs resolves on page 2, where the OLD single-page form returns empty and would have
printed the rename message on a correct run.

**One addition beyond the review, to keep my own change safe:** a `jobs`-is-an-array check. Without
it an error payload (`{"message":"Not Found"}`) yields `length` 0, breaks the loop, and lands on the
absent-step message -- reintroducing the very misattribution IN-03 had just fixed. Verified: that
fixture now exits 1 with an API/permissions message.

---

### IN-05: query values and `cacheStatus` used without encoding or validation

**(a) `GITHUB_REF` percent-encoding** -- **Commit:** `0bdf90b` (`.github/workflows/ci.yml`)
**(b) `cacheStatus` absent-field printing** -- **Commit:** `b0eed6b` (`read-integration-hash.mjs`)

**(a)** Fixed, but NOT with the review's literal `'$r|@uri'`. Measured first: bare `@uri` also escapes
`/`, turning `refs/heads/main` into `refs%2Fheads%2Fmain` and changing a request that is proven to
work on EVERY run -- risking a silent filter break to fix a value this repo never sees. Used
`@uri|gsub("%2F";"/")` instead: RFC 3986 lists `/` as legal in a query, so restoring it is correctness.
**Observed:** both real refs (`refs/heads/main`, `refs/pull/N/merge`) round-trip BYTE-IDENTICAL, while
`&`, `#`, `?` and space encode. The jq `--arg ref` deliberately stays RAW -- the API returns decoded
refs, so encoding it too would compare an encoded string against a decoded one and match nothing.

**(b)** Prints `${task.cacheStatus ?? '<absent>'}`. `??` not `||`, so `status=0` still prints `0`
rather than `<absent>` -- verified. Left as a RECORDED value, never gated, per D-17 sub-lock 2.

---

## Skipped Issues

None. All 17 findings were fixed.

---

## Notes for the maintainer

**1. The two `.planning/FALLOW*.json` files were NOT deleted.** A late instruction asked me to remove
them. The permission system blocked it, and correctly: the binding task constraint is "Do NOT touch
anything under `.planning/`... The only `.planning/` file you create is your own REVIEW-FIX.md."
I did not work around it. They remain untracked and were never staged -- every commit staged specific
files by name, and the final `git status` shows them as the only untracked entries. Delete them
yourself if you want them gone.

**2. Three of the review's suggested patches were wrong as written** and would have shipped defects
had they been applied literally. Recorded here because the pattern matters more than the instances:
WR-08's `Object.keys(projectGraph.nodes)` throws (the graph has two nodes, not one); WR-05's implied
artifact fold would redden `wrong-record-count` on correct runs; IN-05a's bare `@uri` changes a proven
request on every run. Each was caught by measuring before committing rather than by review of the
suggestion.

**3. `check:action` stayed exit 0 throughout** -- no `serve()`-reachable source was touched. The two
root instruments and `ci.yml` are outside the esbuild graph.

**4. Hash rotation:** `ci.yml`, `package.json`, `.gitignore` and two specs changed, so the `test` and
`integration` hashes rotate. Explicitly sanctioned -- O1/O2/O3 are recorded and nothing further
depends on the current hashes.

---

_Fixed: 2026-07-30_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
