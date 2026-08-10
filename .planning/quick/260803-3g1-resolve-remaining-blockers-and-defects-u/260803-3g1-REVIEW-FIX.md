---
quick_id: 260803-3g1
fixed_at: 2026-08-03T04:05:00Z
review_path: .planning/quick/260803-3g1-resolve-remaining-blockers-and-defects-u/260803-3g1-REVIEW.md
iteration: 1
scope: targeted subset (WR-01, WR-02+WR-09, WR-03, WR-04, WR-05, WR-07)
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Quick Task 260803-3g1: Code Review Fix Report

**Fixed at:** 2026-08-03T04:05:00Z
**Source review:** `.planning/quick/260803-3g1-resolve-remaining-blockers-and-defects-u/260803-3g1-REVIEW.md`
**Iteration:** 1
**Tree:** main working tree (no worktree -- explicitly directed)

**Summary:**

- Findings in scope: 7 (WR-01, WR-02, WR-03, WR-04, WR-05, WR-07, WR-09)
- Fixed: 7 (in 6 atomic commits, WR-02 and WR-09 collapsed into one by the
  reviewer's own instruction, plus 1 formatting fixup)
- Skipped: 0

**The window question.** Both findings that could have SILENTLY LOST GitHub's
real reason for the `createRelease` 422 are closed. WR-02 was the live hole: an
`errors[]` entry carrying a diagnostic `message` with no string `code` had that
message discarded in favour of the generic `"Validation Failed"`. WR-01 closed
the untested half: the `data.message` fallback -- the shape a ruleset rejection
most plausibly arrives in -- now has a case, and the fail-closed clause now
asserts that the fault was LOGGED rather than merely thrown.

## Fixed Issues

### WR-02 + WR-09: the 422 body reader, hoisted and decoupled

**Commit:** `8dc0131`
**Files:** `packages/github-cache/src/lib/octokit-fault-reason.ts` (new),
`packages/github-cache/src/publish/publish-mirror.ts`,
`packages/github-cache/src/publish/publish-mirror.spec.ts`,
`packages/github-cache/src/cleanup/cleanup.ts`,
`packages/github-cache/src/cleanup/cleanup.spec.ts`

One edit, per the reviewer's note, because it is one defect from two sides.

- **WR-02.** The `code` and `message` lookups are now independent. `message` is
  the first readable one ANYWHERE in `errors[]`, only then `data.message`. The
  `code` half is unchanged in behaviour.
- **WR-09.** `faultReason`, `FaultBody`, `FaultReason` and `stringOrUndefined`
  moved out of `publish-mirror.ts` into a `lib/` leaf. `cleanup.ts:147` now
  renders code and message alongside the status, closing the site the reviewer
  flagged as weaker than the code-only reader B2 already measured useless.

**Deviation from the suggested fix, deliberate.** The reviewer offered
`src/lib/octokit-status.ts` OR a sibling leaf. A sibling
(`octokit-fault-reason.ts`) was chosen: the name stays honest (status half vs
body half), and `octokit-status.ts` is `serve()`-reachable through
`releases-backend.ts` while this reader is not, so the action bundle keeps no
opinion about it. Cost is one file and two import lines.
`npm run check:action` confirms no bundle drift.

**RED first, verbatim:**

```
FAIL src/cleanup/cleanup.spec.ts > names GitHub own code AND message on a delete
  failure, not the status alone
AssertionError: expected 'github-cache cleanup: failed to delet...' to contain
  'code custom'
FAIL src/publish/publish-mirror.spec.ts > names an errors[] message that carries
  NO code, instead of the generic top-level one
AssertionError: expected 'github-cache: createRelease cache-mir...' to contain
  'Blocked by org policy X'
Tests  2 failed | 995 passed (997)
```

### WR-01: the `data.message` fallback and the rest of the fail-closed frontier

**Commit:** `f44dd3b`
**File:** `packages/github-cache/src/publish/publish-mirror.spec.ts`

- A case for the `data.message` fallback (a 422 whose body is a bare top-level
  message with no `errors` array).
- The UNREADABLE-body clause now also asserts `createRelease` was called at all
  (the bare `toThrow()` was satisfiable by an earlier unrelated throw) and that
  `core.error` was called once (a regression that throws without logging stayed
  green).
- Two `it.each` groups for the rest of the docstring's claims: an empty object,
  `errors: []`, a non-array `errors`, an entry whose `code` is not a string;
  and separately a thrown `null` / `undefined` / bare string. Every mock is
  primed to RESOLVE the second `getReleaseByTag`, so a re-GET on a guess turns
  the run GREEN rather than merely red elsewhere. The primitive axis uses
  `rejects.toBe` because the engine rethrows the ORIGINAL value and `toThrow`
  cannot express a non-Error rejection.

**Not naturally RED** (coverage, not behaviour), so proven by MUTATION with the
restore proven byte-exact via `git diff --quiet -- <file>`. Actual output:

```
M1  drop `?? stringOrUndefined(data?.message)` from the reader
    FAIL > names GitHub own top-level message when the 422 body carries NO
      errors array
    AssertionError: expected 'github-cache: createRelease cache-mir...' to
      contain 'Tag name cannot be reused under this ...'
    Tests  1 failed | 1005 passed (1006)

M2  delete the createRelease core.error call
    FAIL > REJECTS a createRelease 422 whose body is UNREADABLE, never
      re-GETting on a guess
    AssertionError: expected "vi.fn()" to be called once, but got 0 times
    Tests  12 failed | 994 passed (1006)

M3  `statusOf(error) === 422` alone, dropping the already_exists conjunct
    FAIL > all five degenerate-body cases, plus four pre-existing
    Tests  9 failed | 997 passed (1006)
```

M3 correctly leaves the primitive axis green -- `statusOf(null)` is not 422
either way -- so that axis is pinned by M2 instead.

### WR-03: a timeless cache row must not win `sort_by`

**Commit:** `1d62298`
**Files:** `.github/workflows/ci.yml`,
`packages/github-cache/src/dogfood-cross-os.spec.ts`

Reproduced independently with jq 1.8.1 before fixing:

```
input : [{key,ref:"refs/heads/main"},
         {key,ref:"refs/pull/16/merge",created_at:"2026-07-05T10:00:00.000Z"}]
before: created=[]  matched_ref=[refs/heads/main]   -> exit 1 (false absence)
after : {"key":"nx-cache-1","ref":"refs/pull/16/merge",
         "created_at":"2026-07-05T10:00:00.000Z"}
```

`(.created_at | type) == "string"` added as the select's LAST conjunct.
Guard-last rather than the reviewer's guard-middle placement, so the sibling
exact-equality clause keeps its literal `.key == $key and (.ref == ...` adjacency
intact -- only its trailing `\s*\)` terminator had to go, and the close is now
pinned by the new clause instead.

Verified across seven jq 1.8.1 fixtures: the mixed case above, Case B
(base-branch row only), earliest-of-two, only-a-timeless-row (empty, correct),
an explicit `created_at: null` alongside a good row, push-with-no-base, and a
wrong-ref row (empty, correct).

**RED first, verbatim:**

```
FAIL src/dogfood-cross-os.spec.ts > EXCLUDES a row with no created_at before
  sorting, so a timeless row cannot win
AssertionError: ... expected '    needs: integration\n    if: ${{ !...' to match
  /\)\) and \(\.created_at \| type\) == .../
Tests  1 failed | 1006 passed (1007)
```

The new clause's pattern has NO gap at all -- guard as the select's last
conjunct, immediately followed by the sort -- per the file's own measured lesson
that a non-greedy gap bounds what a match PREFERS, not how far it may REACH.

### WR-04: the false "SERVER-filtered by key + ref" claim

**Commit:** `9e52ed1`
**File:** `.github/workflows/ci.yml:1301-1312`

Retracted and replaced with what actually holds after `40e4d21`: server-filtered
by KEY ONLY (a full all-decimal hash, rows differ essentially only by ref),
unpaged, and sharing exactly one protection with the jobs call -- the array
guard added in WR-05. The replacement text states outright that `codeLines`
strips `#` lines so no guard can catch this drift and a reader is the only thing
protecting it.

Comment-only, so no RED is possible. Verified by allowlist inversion:
`git grep "SERVER-filtered"` now exits 1, with `server-filtered by KEY ONLY`
matching once as the positive control.

### WR-05: the caches response is now proven to be an array

**Commit:** `680fa7c`
**Files:** `.github/workflows/ci.yml`,
`packages/github-cache/src/dogfood-cross-os.spec.ts`

Reproduced the reported exit 5 first, under `set -euo pipefail`:

```
$ printf '%s' '{"message":"Not Found"}' | jq -c '[.actions_caches[] | ...]'
jq: error (at <stdin>:0): Cannot iterate over null (null)
subshell exit=5
```

The sibling jobs-API guard is mirrored rather than reinvented, so both calls now
fail the same way. jq's own parse error still reaches stderr next to the verdict
-- extra evidence, not noise, and the sibling does not suppress it either.

Verified end to end with real bash + jq: `{"message":"Not Found"}` and a
non-JSON body both now exit 1 carrying the `o3-witness: FAIL` line; the
well-formed body still resolves its entry. `ci.yml` re-parsed as YAML (21 jobs,
o3-witness 3 steps).

**RED first, verbatim:**

```
FAIL src/dogfood-cross-os.spec.ts > GUARDS that the caches response IS an
  actions_caches array, like its jobs-API sibling
Tests  1 failed | 1007 passed (1008)
```

### WR-07: stale clause counts, plus the sweep

**Commits:** `a7a603f`, `442f9de` (prettier fixup)
**File:** `packages/github-cache/src/dogfood-cross-os.spec.ts`

Both counts are now **TEN**, which is the count after the two clauses WR-03 and
WR-05 added -- so the head docstring ("Eight separate cases") had to move too,
not only the `:711` sibling the review named. The head docstring records why
those two exist separately from the three that came with the Case-B widening
(those three were shapes the widening made POSSIBLE; these two are defects it
introduced or left standing), and now states that the count is load-bearing
prose that has gone stale twice, naming the sibling to sweep.

Secondary: the positive control's "every clause below is a `toMatch`" gained the
`POSITIVE` qualifier, with the reason it matters -- an ABSENCE is what a
wrong-block extraction satisfies for free, so the two `not.toMatch` clauses lean
on their own controls.

**Sweep performed** over every file this task touched, with a
count-word-plus-plural-noun pattern. One more drift found and fixed: the M4
block said "The five clauses around it", which reads as "the other clauses
here" (nine now); it means the ORIGINAL five and now says so. Every other hit
was VERIFIED accurate rather than assumed:

| Site | Claim | Verified |
|------|-------|----------|
| spec:209 | "Four separate cases" for the `needs:` producers | 4 `it`s -- correct |
| spec:1113 | "the three clauses above" (build-windows) | 3 -- correct |
| spec:1562 | "seven blocks could lose their mask" | 8 `add-mask` echo lines, so 7 unpinned -- correct |
| spec:1568 | "three separate prose comments" | ci.yml 1004, 1953, 2212 -- correct |
| spec:688 | "the two clauses below" (M4) | 2 `expect`s -- correct |

## Not Fixed (out of the directed subset)

Left recorded in the REVIEW for a later pass, per instruction: **WR-06**
(default-branch allowlist slot / the message's "any ref this run can read"
overclaim) and **WR-08** (`toContain('custom')` unpinned to the code slot at
publish-mirror.spec.ts:470), plus **IN-01** through **IN-04**.

WR-08 is worth flagging as the cheapest of them -- a one-word change already
applied at the sibling site -- and it is now marginally more exposed than the
review found it, because this task added an adjacent case whose fixture message
does contain a policy phrase.

## One observation the review did not raise

`.github/workflows/ci.yml:1076-1077`, in the witness's leading comment block:

> "the witness compares .key for EXACT string equality, never a count / and it
> filters on `ref` as well, because ONE hash holds TWO entries on TWO DIFFERENT
> refs ... so a key-only match can return an entry from the wrong ref"

This is **not** a false comment of WR-04's kind -- it is still TRUE, because the
ref constraint moved client-side rather than being dropped. It is merely
un-updated: it does not say that the filter is now an ALLOWLIST over two scopes
rather than an equality. Found during the WR-07 sweep and deliberately NOT
edited, to stay inside the directed subset. Worth folding into whichever pass
takes WR-06, which is about that same allowlist.

## Verification

Full battery from the MAIN TREE, all with `--skip-nx-cache`:

```
npx nx run-many -t test typecheck lint --skip-nx-cache
  Test Files  42 passed (42)
       Tests  1008 passed (1008)
  NX  Successfully ran targets test, typecheck, lint for project
      @op-nx/github-cache and 1 task it depends on

npm run check:action           exit 0 (no bundle drift)
npx nx format:check            clean (no files listed)
```

Each target was ALSO run individually, because `nx run-many` on a MISSING target
exits 0 -- the exit code is not the signal:

```
nx run @op-nx/github-cache:test        Successfully ran target test
nx run @op-nx/github-cache:typecheck   Successfully ran target typecheck
nx run @op-nx/github-cache:lint        Successfully ran target lint
```

Test count moved 995 -> 1008, +13: two in WR-02/WR-09 (one publish, one
cleanup), nine in WR-01 (one standalone plus eight `it.each` rows: five bodies,
three thrown primitives), and one each for the WR-03 and WR-05 clauses.

Working tree after all commits carries only
`.planning/phases/13-read-only-actions-cache-backend/13-VERIFICATION.md` (the
concurrent background agent's file, never touched here) and the untracked
`260803-3g1-REVIEW.md`. Nothing was pushed; `main` was not touched; no PR was
opened or closed; STATE.md and ROADMAP.md were not edited.

## Commits

| Commit | Finding |
|--------|---------|
| `8dc0131` | WR-02 + WR-09 |
| `f44dd3b` | WR-01 |
| `1d62298` | WR-03 |
| `680fa7c` | WR-05 |
| `9e52ed1` | WR-04 |
| `a7a603f` | WR-07 |
| `442f9de` | prettier fixup on the WR-03 clause reasons |

---

_Fixed: 2026-08-03T04:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
