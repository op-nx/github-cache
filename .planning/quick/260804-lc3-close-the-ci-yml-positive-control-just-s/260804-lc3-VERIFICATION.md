---
task: 260804-lc3
verified: 2026-08-04
commit: abb722d2cf3a460d8ba2e91928061442c6bb2830
status: passed
score: 24/24 claims verified
advisories: 2
gaps: []
---

# Quick Task 260804-lc3 -- Goal Verification

**status: passed**

**Score: 24/24 claims verified.** Two advisories, neither a gap: one imprecise
shorthand in the shipped prose that the same block later states more precisely,
and one undercount in the SUMMARY's own census (not in the shipped prose).

Verification stance: adversarial. The starting hypothesis was that a freshly
authored WRONG claim had replaced the inherited one. Every shipped sentence in
the seven `ci.yml` sites was traced to source, and the MEASURED half was
re-derived from the GitHub Actions run logs rather than from RESEARCH.md, the
PLAN, or the SUMMARY. The plan's 26 gates were NOT re-run as the basis of any
verdict below.

---

## 1. Is the corrected prose actually TRUE?

Each shipped claim traced to code. All VERIFIED.

### 1a. `UNCONDITIONAL cache.restoreCache`, not save-conditioned -- VERIFIED

Shipped (`ci.yml:1005-1007`): "the leg either RESTORED it from that scope or
WROTE it into that scope, and both routes end in the same place, because the GET
resolves through an UNCONDITIONAL cache.restoreCache in
actions-cache-backend.ts that is not conditioned on this run having written
first."

Trace: `packages/github-cache/src/backend/actions-cache-backend.ts`,
`createReadOnlyActionsCacheBackend().get()`. Inside `withHashLock`, the FIRST
statement in the `try` is `await cache.restoreCache([path], cacheKeyFor(hash),
undefined, undefined, true)`. There is no preceding branch, no write flag, no
`if`. `createActionsCacheBackend()` SPREADS that same object, so the writable
backend carries the identical `get` closure -- the file's own JSDoc states
"exactly ONE `get`". The second `cache.restoreCache` in the file is put's
`lookupOnly` existence probe, which is not on the GET path.

Verdict: TRUE, and the prose's scoping ("the GET resolves through") correctly
avoids the whole-file count the file itself warns about.

### 1b. `handleGet`'s catch degrades EVERY backend fault to a 404 -- VERIFIED

Shipped (`ci.yml:1017-1021`, restated at `:1068-1069`): "handleGet's catch in
server.ts degrades EVERY backend fault to a 404 MISS (SRV-05), which is what
makes a broken read path indistinguishable from a genuine absence at this
boundary."

Trace: `packages/github-cache/src/server/server.ts`, `handleGet`:

```
  } catch {
    res.statusCode = 404;
    res.end();
  }
```

A bare `catch` with no filter and no rethrow. A `miss` also yields 404, so a
fault and a genuine absence are byte-identical at the HTTP boundary. The
function's own JSDoc independently states "any backend.get fault degrades to a
404 MISS -- never a build-breaking 5xx" and names SRV-05.

Verdict: TRUE. "EVERY" is literally correct, not rhetorical.

### 1c. Token-less sidecar routes to `createReadOnlyMemoryBackend` -- VERIFIED

Shipped (`ci.yml:1025-1027`): "a token-less sidecar falls to
createReadOnlyMemoryBackend in select-backend.ts and 404s everything."

Trace: `select-backend.ts` -- `if (resolveGitHubToken(env) === undefined) {
return createReadOnlyMemoryBackend(); }`. `memory-backend.ts`'s
`createReadOnlyMemoryBackend` constructs a fresh `new Map()` that no code path
populates (no `put` exists on the returned `ReadableBackend`), so every `get`
returns `{ kind: 'miss' }`, which `handleGet` renders as 404. Its JSDoc: "The
store is never populated, so it is a PERMANENT MISS on every read".

Precision note: this branch is reached only AFTER the `isWriteTrusted` gate and
the repository-identity guard. The integration job is write-trusted and wires
`GITHUB_TOKEN` at `ci.yml:916`, so the named branch is exactly the one this
job's sidecar would take. The same shorthand already exists in UNEDITED house
prose at `ci.yml:194-195` ("Without a resolvable token selectBackend degrades to
the empty in-memory backend"), so the commit introduces no new looseness.

Verdict: TRUE in the context it is written for.

### 1d. The readiness poll accepts 404 as proof of life -- VERIFIED

Shipped (`ci.yml:1015-1017`): "404 is the readiness poll's own proof-of-life
signature, and this file must not read one status code as proof of life at the
poll above and as proof of death in this block."

Trace: `ci.yml:925` -- `if [ "${code}" = "404" ] || [ "${code}" = "200" ]; then
break; fi`, and `:930` fails ONLY when the code is neither. A 404 therefore ENDS
the poll successfully. `:1096` records the complementary half: connection-refused
gives curl exit 7, swallowed by `|| true`, and `-w '%{http_code}'` prints `000`.
So a non-answering sidecar cannot produce a 404.

Verdict: TRUE. The self-contradiction the task exists to close is genuinely
closed, and the correction rests on a fact still present in the file.

### 1e. The Case-B claims -- VERIFIED

- "the backend is chosen ONCE at sidecar startup": `serve.ts:90` --
  `const backend = selectBackend(process.env);` at the composition root, before
  the server is created. One call, not per-request. TRUE.
- "cacheStatus is RECORDED and never GATED": `read-integration-hash.mjs:141`
  ("NOT a throw -- gating a recorded-only observation is the
  tripwire-on-correct-work") and `:144`, which only `console.log`s
  `cacheStatus=...`. TRUE.
- "on such a leg this step is the only thing in the job that hard-fails on a
  broken read path": checked against every step in the `integration` job. The
  readiness poll ACCEPTS 404 so it cannot fail on a degraded read path; the
  remote-cache label count is "RECORDED, never gated" (`:998`);
  `read-integration-hash.mjs` throws only on run.json problems;
  `upload-artifact` fails only on a missing file. TRUE.

### 1f. The placement reason -- VERIFIED

Shipped (`ci.yml:1083-1086`): "this step's own INPUT DOES NOT EXIST before the
Nx run. own_hash is read from integration-hash.txt, which the run.json reader
step writes, and that reader needs .nx/cache/run.json, which only the Nx run
produces."

Trace: `ci.yml:1110` -- `own_hash="$(cat integration-hash.txt)"`.
`read-integration-hash.mjs:51-52` -- defaults `.nx/cache/run.json` and
`integration-hash.txt`. The reader step (`ci.yml:955-959`) runs `node
read-integration-hash.mjs` with no arguments, immediately after the Nx run.

Verdict: TRUE, and it is a genuinely premise-INDEPENDENT reason, not a phrase
swap -- it holds on a HIT leg where the old reason was false.

**No shipped sentence overstates what the code does.** No BLOCKER here.

---

## 2. Is MEASURED vs REASONED honestly separated?

VERIFIED, and the measured half was re-measured independently.

### 2a. The measured claim, checked against the run logs themselves

Shipped (`ci.yml:1008-1012`): "THE DISJUNCTION IS MEASURED, not defensive: on
runs 30907575624 and 30910935382 every integration leg took a remote-cache HIT
and wrote NOTHING -- four leg-observations across those two runs -- and every
control still returned 200."

Measured by this verification, not taken from any artifact:

| Run | Job | Leg | `cacheStatus` | Positive control |
|---|---|---|---|---|
| 30907575624 | 91986179819 | ubuntu-24.04-arm | `remote-cache-hit` | `-> 200 (wanted 200)` |
| 30907575624 | 91986179847 | windows-11-arm | `remote-cache-hit` | `-> 200 (wanted 200)` |
| 30910935382 | 91997235380 | ubuntu-24.04-arm | `remote-cache-hit` | `-> 200 (wanted 200)` |
| 30910935382 | 91997235471 | windows-11-arm | `remote-cache-hit` | `-> 200 (wanted 200)` |

Four leg-observations, two runs, 4/4 HIT, 4/4 control 200. The Nx log on each
leg shows the `integration` task carrying the `[remote cache]` label, i.e. a
replay rather than an execute-and-save, and the per-leg label count is 1.

The run IDs are attached to exactly the claim they support: the presence
disjunction, and nothing else. Both run IDs sit on the single line `:1008`, so
neither can be separated from `THE DISJUNCTION IS MEASURED` by a reflow.

The count wording is correct too -- "four leg-observations across those two
runs", not "four legs", which is the ambiguity the plan explicitly told the
executor to avoid.

Additional check: the `integration` job does NOT set `CACHE_READ_ONLY` (its
occurrences are at `:520`, `:655`, `:755`, all other jobs), so the leg was
write-CAPABLE and still wrote nothing. That strengthens rather than weakens the
falsification of the old premise.

### 2b. The reasoned half is marked as never observed -- VERIFIED

Shipped (`ci.yml:1035-1037`): "THE FAILURE DIRECTION IS NEVER OBSERVED. No 404
has ever come back from this step, so every claim above about what a non-200
would MEAN is derived from the code rather than measured; only the presence
disjunction is measured."

Adversarial reading of `:1013-1034` for observational drift, sentence by
sentence: every claim in the reasoned span is present-tense MECHANISM
(`000 is`, `a 404 means`, `handleGet's catch ... degrades`, `a token-less
sidecar falls to`) or an explicit evidentiary judgement (`The MISS observation
is INADMISSIBLE`). No past-tense observational verb is attached to any failure
claim. The one "already proved" (`:1028`) refers to the leg's OWN remote-cache
HIT, which is genuinely observed on any HIT leg by construction.

The disclaimer's scope is stated explicitly ("every claim above about what a
non-200 would MEAN"), so it cannot be read as covering only the adjacent
sentence. It sits after the reasoned span and back-references it.

Both markers occupy one `#` line each and are gated: `THE DISJUNCTION IS
MEASURED` at `:1008`, `NEVER OBSERVED` at `:1035`.

Verdict: the plan's top quality constraint is met. The reasoned half does not
read as observed anywhere, including by adjacency.

---

## 3. Zero behaviour change -- VERIFIED

Instrument: `git diff abb722d~1 abb722d -- .github/workflows/ci.yml`, plus the
comment-only assertion.

- **Comment-only.** Every added or removed content line, whitespace-stripped, is
  `#`-prefixed or blank. The awk filter over `diff -U0` returns EMPTY output.
  Three hunks only: `@@ -207,9 +207,9 @@`, `@@ -1000,10 +1000,41 @@`,
  `@@ -1018,30 +1049,48 @@`. No `run:`, `if:`, `needs:`, `env:`, job or step
  key appears on any `+`/`-` line.
- **Acceptance set still 200 ALONE.** `ci.yml:1113` -- `if [ "${code}" != "200"
  ]; then ... exit 1; fi`. Unchanged (outside every hunk).
- **No retry loop.** The step body (`:1107-1116`) contains no `for`/`while`/
  `until`. Unchanged.
- **Placement unchanged.** Step at `:1105`, after the Nx run (`:942`) and before
  `- cancel: cache-server` (`:1117`). The step ordering is outside every hunk.
- **Document still parses.** Independent behavioral check:
  `npx vitest run src/dogfood-cross-os.spec.ts` -> 84/84 pass. That spec parses
  `ci.yml` as YAML through its job/step helpers, so a comment edit that broke
  the document would redden it.
- **Nothing outside the two files.** `git diff --stat a372b96 HEAD` = exactly
  `.github/workflows/ci.yml` (95 changed) and
  `packages/github-cache/src/docs-same-os-claims.spec.ts` (37 changed), 106
  insertions / 26 deletions. `start-cache-server/index.js` is therefore
  unchanged by construction.
- **`.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md`:**
  `git diff --stat a372b96 HEAD --` on both returns EMPTY.

---

## 4. The two legitimate `dead sidecar` claims SURVIVED -- VERIFIED

The naive search undercounts, exactly as warned. Measured with
`rg -U -i -o 'dead\s+#?\s*sidecar'`: **FOUR** occurrences (naive `rg -i -n 'dead
sidecar'` reports only three).

| # | Line | Text | Class |
|---|---|---|---|
| 1 | `:1020` | "That degradation, not a dead sidecar, is the masquerade agent this control exists to catch" | NEW -- a DENIAL |
| 2 | `:1046` | "BOTH legs go red blaming a dead sidecar that was / alive" | REQUIRED SURVIVOR -- historical record |
| 3 | `:1070-1071` | "Not a dead / # sidecar: that yields 000, as the paragraph below records" | NEW -- a DENIAL, wrapped across a `#` line |
| 4 | `:1096` | "On connection-refused -- a DEAD SIDECAR -- curl exits 7" | REQUIRED SURVIVOR -- the `|| true` paragraph |

Both required survivors are present and both are outside every diff hunk (the
`|| true` paragraph `:1095-1104` is untouched). The two NEW occurrences are
denials, not attributions. **No occurrence wrongly survives.**

Absence of the two defect sentences, with exit codes:
- `git grep -q -F 'a dead sidecar had masqueraded as a cache MISS'` -- absent.
- `git grep -q -F 'sidecar masquerading as a cache MISS'` -- absent.
- Positive control on the same path: `rg -c -F 'lines'` returns 5, so the search
  path is live.

---

## 5. `ci.yml:450` UNTOUCHED and byte-identical -- VERIFIED

- `git grep -n -F 'producer just wrote'` returns exactly ONE line, still at
  `:450`: "producer just wrote and can restore that entry. That restore IS the
  XOS-05".
- Byte-identity proved directly: `git show abb722d~1:.github/workflows/ci.yml |
  sed -n '440,460p'` diffed against the same range of the current file --
  IDENTICAL, no differences.
- The line is outside all three diff hunks.
- It also serves as the positive control for the presence-absence gate: the
  regex path `own save|just saved` exits 1 (genuine no-match) while the sibling
  literal `just wrote` returns 1 file on the same path.

---

## 6. Is the lock non-vacuous? -- VERIFIED

**Exactly-one-line match, by count:**
- `git grep -c -F 'UNCONDITIONAL cache.restoreCache' -- .github/workflows/ci.yml`
  -> `1` (at `:1006`)
- `git grep -c -F '404 means the sidecar DID answer' -- .github/workflows/ci.yml`
  -> `1` (at `:1015`)

Neither phrase spans a hard wrap. A `git grep` count alone would not prove the
`toContain` matches, so this was checked behaviorally as well:

**Named-test evidence** (single named tests, not the suite):
- `npx vitest run src/docs-same-os-claims.spec.ts -t 'UNCONDITIONAL
  cache.restoreCache'` -> `1 passed | 77 skipped`
- `npx vitest run src/docs-same-os-claims.spec.ts -t '404 means the sidecar DID
  answer'` -> `1 passed | 77 skipped`
- Whole spec file: `78 passed (78)` -- including the row A occurrence-count guard
  and the OBS-03/D-33 retracted-producer-attribution guard, neither of which the
  new prose trips.

Each new phrase is therefore a live, individually-failing-capable assertion
against RAW `ci.yml`, not a string that happens to sit in an array.

**Row D's docstring no longer carries either defect, and states a REPLACEMENT
reason:**
- Corrected sentence (`spec:520-522`): "the positive control on the leg's own key
  accepts 200 ALONE, because a 404 there means the read path could not produce a
  key this run's own scope demonstrably holds." The old `just-saved key` and
  `dead sidecar masqueraded as a cache MISS` are both gone -- and replaced, not
  merely deleted.
- Absence measured wrap-aware: `rg -U -i 'just-saved'` exits 1;
  `rg -U -i -o 'dead\s+\*?\s*sidecar[a-z ]*masquerad[a-z]*'` exits 1. Positive
  control on the same path: `rg -c -F 'acceptance set'` returns 3.
- The correction record is present: `CORRECTED by quick 260804-lc3` at `:524`,
  and `left the REASONS unguarded` at `:533` -- the one spec literal that the
  `required` array cannot satisfy.
- The superseded wording is described BY CONCEPT and not quoted, as the file's
  own convention requires.

**`forbidden` is still `[]`:** row D's `forbidden: []` is intact at `:573`, and
the file-wide count of `forbidden: []` is **14** -- unchanged, so nothing was
added to any row's forbidden array.

---

## 7. The SUMMARY's citations -- VERIFIED (one advisory)

Every literal line number re-derived from the post-edit tree by phrase search.
All match the SUMMARY exactly:

| Literal | SUMMARY says | Re-derived |
|---|---|---|
| `RESTORED OR WROTE` | `:211` | 211 |
| `UNCONDITIONAL cache.restoreCache` | `:1006` | 1006 (only occurrence) |
| `THE DISJUNCTION IS MEASURED` | `:1008` | 1008 |
| `404 means the sidecar DID answer` | `:1015` | 1015 (only occurrence) |
| `SRV-05` | `:1018`, `:1069` | 1018, 1069 |
| `NON-DETERMINISM` | `:1031`, `:1076` | 1031, 1076 |
| `REDUNDANT AS A LIVENESS PROOF` | `:1032` | 1032 |
| `NEVER OBSERVED` | `:1035` | 1035 |
| `NO WRITE PERMISSION` | `:1056` | 1056 |
| `ADMITS THE DEGRADATION` | `:1067` | 1067 |
| `a retry would HIDE` | `:1075` | 1075 |
| `INPUT DOES NOT EXIST` | `:1084` | 1084 |
| spec `CORRECTED by quick 260804-lc3` | `:524` | 524 |
| spec `left the REASONS unguarded` | `:533` | 533 |
| spec new array entries | `:570-571` | 570, 571 |

Also confirmed: the `|| true` paragraph really is at `:1095-1104`; the readiness
poll's 404 acceptance really is at `:925`; the two pre-existing pinned phrases
really are at `:1001-1002` and are byte-identical (outside every hunk).

Note on `SRV-05`: the count is 2 and the two occurrences ARE distributed across
PART A (`:1018`) and the escape hatch (`:1069`), which is what the plan wanted
but could not gate by cardinality. The escape hatch independently carries its own
`ADMITS THE DEGRADATION` literal at `:1067`, so localization does not rest on the
count. The escape hatch itself survives intact ("IF A FORK PR EVER DOES REDDEN
HERE ... the fix is to gate this step on the trigger").

**Both EXPLICITLY OPEN items are recorded** in the SUMMARY's own section: (1) the
FAIL direction has never been observed, cross-referenced to the shipped prose at
`ci.yml:1035`; (2) fork PR behaviour remains cited-never-reproduced, with the
honest note that the new `NO WRITE PERMISSION` leg reduces but does not eliminate
the citation exposure. The shipped prose itself declines to overclaim, at `:1060`
("That is NOT the fork question closed: see the escape hatch").

**The XOS-03 legitimacy note is recorded** and is independently correct: both
`.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` are byte-unchanged across
`a372b96..HEAD`.

---

## Deviations, assessed

### (a) The plan's PART D battery command does not parse -- CONFIRMED, real defect

Probed directly with a harmless target list:

```
npm exec nx run-many -t zzz-nonexistent-a zzz-b zzz-c
  -> npm warn Unknown cli config "--t"
  -> Missing required argument: targets      (exit 1)

npm exec nx -- run-many -t zzz-nonexistent-a,zzz-b,zzz-c
  -> exit 0
```

`npm exec` consumes `-t` itself. The executor's correction is right, and the
diagnosis ("a plan defect worth carrying forward") is right: the same invocation
will fail for the next executor that copies it. The comma form is what
`run-many --help` prescribes.

### (b) The `--amend` to drop a line-distance number -- REASONING HOLDS, commit is clean

The amend delta `fbb20ee -> abb722d` is exactly ONE line:

```
-      # and as proof of death eighty lines later. The fault is DOWNSTREAM ...
+      # above and as proof of death in this block. The fault is DOWNSTREAM ...
```

- The measurement behind it is correct: the readiness poll's 404 acceptance is at
  `:925` and the "proof of death" clause landed at `:1017` -- 92 lines, not 80.
  `rg -U -i 'eighty\s+#?\s*lines'` now exits 1 (positive control `rg -c -F
  'lines'` returns 5).
- The reasoning holds. A line-distance rots on exactly the same mechanism as a
  `file.ext:NN` citation -- any insertion between the two anchors invalidates it
  silently -- and this very commit shifted everything below `:1003` by ~30 lines,
  demonstrating the mechanism in the same diff. Shipping a measurably-wrong
  number inside the commit that corrects false claims would have been the defect
  class the task exists to close. Dropping the number rather than updating it to
  92 is the stronger fix: 92 would rot again on the next edit.
- The commit is clean. Single parent `a372b96` (not a merge). `fbb20ee` is NOT an
  ancestor of HEAD (`git merge-base --is-ancestor` exits 1), so it is cleanly
  amended away and only reachable via reflog. Author and committer are both the
  public gmail identity. Commit message: pure ASCII, no CI-skip token in any
  form, no AI-attribution trailer. Both committed files are pure ASCII
  (`rg -c '[^\x00-\x7F]'` exits 1 on both).

---

## Advisories (neither is a gap)

**A1. `THIS RUN'S OWN SCOPE HOLDS` (`ci.yml:1004`) is looser than the same
block's own later wording.** GitHub's cache restore searches the current ref's
scope with fallback to the base and default-branch scopes, so an entry a run
RESTORES need not live in the scope that run can WRITE. The block's new
second-leg paragraph states this correctly at `:1056` ("restored the entry from a
scope it only had to READ"), so the precise form is present a few lines below.
On the two measured runs the branch scope was the run's own, so the shorthand is
accurate for every observation on record. Recorded rather than raised: it is a
framing shorthand inherited from the unedited fork paragraph, not a new false
claim, and it is self-correcting within the same block.

**A2. The SUMMARY undercounts `dead sidecar` occurrences.** It says "A third
`dead sidecar` occurrence now exists at `:1020`", implying three total. There are
FOUR -- the fourth is the new denial wrapped across `:1070-1071` ("Not a dead /
sidecar: that yields 000"). This is the exact undercount trap this repo has
recorded, and it landed in the SUMMARY's own census rather than in the shipped
prose. No correctness impact: both new occurrences are DENIALS and both required
survivors are intact. The SUMMARY also quotes `blaming a dead sidecar that was
alive` as one string when it wraps across `:1046-1047`; the line citation itself
is right.

---

## What I MEASURED

| # | Check | Command | Result |
|---|---|---|---|
| 1 | Commit shape | `git show --stat --format` abb722d | 2 files, 106+/26-, parent a372b96, public gmail author+committer |
| 2 | `ci.yml` diff comment-only | `git diff -U0 ... \| awk` filter | EMPTY output (no non-comment content line) |
| 3 | Hunk inventory | `git diff \| rg '@@'` | 3 hunks: 207, 1000, 1018 -- no others |
| 4 | Unconditional restore | Read `actions-cache-backend.ts` | `cache.restoreCache` first stmt in `get`'s try; writable factory spreads it |
| 5 | 404 degradation | Read `server.ts` `handleGet` | bare `catch { 404 }`; JSDoc names SRV-05 |
| 6 | Token-less degrade | Read `select-backend.ts` + `memory-backend.ts` | `resolveGitHubToken===undefined` -> read-only memory; store never populated |
| 7 | Backend chosen once | `git grep selectBackend -- serve.ts` | one call site, `serve.ts:90`, composition root |
| 8 | cacheStatus not gated | `git grep` `read-integration-hash.mjs` | `:141` "NOT a throw"; `:144` prints only |
| 9 | Step input provenance | `ci.yml:1110`, reader defaults `:51-52` | `cat integration-hash.txt`; reader writes it from run.json |
| 10 | Poll accepts 404 | Read `ci.yml:920-933` | `[ "$code" = "404" ] \|\| [ "$code" = "200" ]` breaks the loop |
| 11 | MEASURED half, run 30907575624 | `gh api .../jobs` + `gh run view --job --log` | 2 legs, both `cacheStatus=remote-cache-hit`, both control `-> 200` |
| 12 | MEASURED half, run 30910935382 | same | 2 legs, both `remote-cache-hit`, both control `-> 200` |
| 13 | Nx replayed, did not save | job log `rg '\[remote cache\]'` | `[remote cache]` on the integration task; label count 1 per leg |
| 14 | `CACHE_READ_ONLY` not on this job | `git grep -F CACHE_READ_ONLY -- ci.yml` | `:520`, `:655`, `:755` only -- other jobs |
| 15 | Presence-defect absence | `git grep -E "own save\|just saved"` | exit 1 (genuine no-match) |
| 16 | Positive control, same path | `git grep -c -E "just wrote"` | 1 file (path is live) |
| 17 | `:450` byte-identical | `git show abb722d~1:... \| sed 440,460` vs current | IDENTICAL |
| 18 | `dead sidecar` census | `rg -U -i -o 'dead\s+#?\s*sidecar'` | 4 occurrences: 1020, 1046, 1070-71, 1096 |
| 19 | Masquerade sentences absent | two `git grep -q -F` | both absent |
| 20 | Lock phrase counts | `git grep -c -F` x2 | exactly 1 each (`:1006`, `:1015`) |
| 21 | Lock behaviorally live | `vitest -t '<phrase>'` x2 | `1 passed \| 77 skipped` each |
| 22 | Whole guard spec | `vitest run docs-same-os-claims.spec.ts` | 78 passed (78) |
| 23 | YAML still parses | `vitest run dogfood-cross-os.spec.ts` | 84 passed (84) |
| 24 | `forbidden: []` count | `git grep -c -F 'forbidden: []'` | 14 |
| 25 | Spec defects absent | `rg -U -i` just-saved / masquerad | both exit 1; positive control returns 3 |
| 26 | SUMMARY citations | `git grep -n -F` x15 literals | all 15 match the SUMMARY exactly |
| 27 | REQUIREMENTS/ROADMAP | `git diff --stat a372b96 HEAD --` | EMPTY |
| 28 | ASCII, both files | `rg -c '[^\x00-\x7F]'` | exit 1 (pure ASCII) |
| 29 | Commit msg hygiene | `rg -i` skip/attribution/non-ASCII | none found (exit 1 on all three) |
| 30 | Amend delta | `git diff fbb20ee abb722d` | exactly one line: the dropped `eighty lines later` |
| 31 | Amend cleanliness | `git merge-base --is-ancestor fbb20ee HEAD` | exit 1 -- cleanly amended away |
| 32 | Battery command parse | `npm exec nx run-many -t a b c` | `Missing required argument: targets`, exit 1 (deviation (a) confirmed) |
| 33 | Corrected form parse | `npm exec nx -- run-many -t a,b,c` | exit 0 |
| 34 | `ci.yml` is a `test` input | `git grep -n ci.yml -- nx.json` | `nx.json:70` -- PARITY-08 hash rotation claim holds |

---

## What I did NOT verify

1. **GitHub's cache-scope platform semantics.** The merge-ref scoping claim and
   "GitHub's restriction is on WRITING" are CITED from GitHub's docs, not
   reproduced. The shipped prose says so itself (`:1062-1064`, "CITED from
   GitHub's docs, not reproduced -- no fork PR on record"). No fork PR exists on
   this repo to reproduce against. This is the SUMMARY's OPEN item 2 and remains
   correctly open.
2. **"No 404 has ever come back from this step" -- verified only by sample.** I
   confirmed 200 on 4/4 legs across the two cited runs, and the step hard-fails
   on any non-200 so a 404 would have reddened a run. I did NOT enumerate every
   historical run of this step. The claim is conservative in the safe direction
   (it declines to claim observation), so a sampling gap cannot turn it into an
   overclaim.
3. **`npm run format:check` and `npm run check:action` were not re-run.** Bundle
   drift is excluded structurally instead: the commit touches exactly two files,
   neither of which is `start-cache-server/index.js`.
4. **The full workspace battery was not re-run.** Three targeted runs were used
   instead (the guard spec by name, the two lock phrases by name, and the
   YAML-parsing dogfood spec), which is the evidence the verdicts above actually
   need.
5. **The plan's own 26 gates were not re-run as evidence.** By design -- the task
   brief is explicit that re-running them proves only that the guards' own claims
   hold. Where a gate's subject mattered, it was measured independently and
   usually by a different instrument (wrap-aware `rg -U`, blob-range diff,
   named vitest run, GitHub run logs).

---

## Verdict

**status: passed.** The goal is achieved in the codebase, not merely claimed.

The seven `ci.yml` sites and row D's docstring now state claims that every trace
supports: the GET path really is an unconditional `cache.restoreCache`,
`handleGet`'s catch really does collapse every backend fault to a 404, the
token-less degrade really does route to the empty in-memory backend, and the
readiness poll really does treat 404 as proof of life. The measured half was
re-measured from the two cited runs' own job logs -- 4/4 legs HIT, 4/4 controls
200 -- and the reasoned half is explicitly and correctly scoped as never
observed. The diff is comment-only across three hunks, the acceptance set,
retry decision and step placement are untouched, `:450` is byte-identical, both
legitimate `dead sidecar` claims survive while both defect sentences are gone,
and the two new lock phrases each match exactly one raw `ci.yml` line and each
pass as an individually named live assertion.

The defect class this task exists to close -- a claim that reads as coverage but
asserts something false -- is not present in what shipped.

---

_Verified: 2026-08-04_
_Verifier: gsd-verifier (independent, goal-backward, read-only)_
