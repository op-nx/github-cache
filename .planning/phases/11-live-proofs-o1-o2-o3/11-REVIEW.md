---
phase: 11-live-proofs-o1-o2-o3
reviewed: 2026-07-30T00:00:00Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - .github/workflows/ci.yml
  - capture-hashes.mjs
  - packages/github-cache/src/docs-same-os-claims.spec.ts
  - packages/github-cache/src/dogfood-cross-os.spec.ts
  - read-integration-hash.mjs
findings:
  critical: 1
  warning: 11
  info: 5
  total: 17
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-07-30
**Depth:** deep
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 11 adds three instruments (`--assert-graph-premise`, `read-integration-hash.mjs`,
the `o3-witness` job) plus per-leg probes in the `integration` job and ten new prose
locks. The review focused on the named failure classes: silently-passing guards,
existence checks that are not existence proofs, shell correctness, the positive
control's acceptance set, reader edge cases, and the one fallow-INTRODUCED function.

**What held up.** All ten Phase 11 locked phrases were verified present and on a
single line of `ci.yml` (`rg -F -c`, exit 0, positive control on each) -- the
line-wrap false-PASS trap did not fire. The positive control's acceptance set is
correct: 200 alone, placed after the Nx run and before `cancel:`, and `handlePut`
awaits `backend.put` before responding, so the no-retry stance is defensible. The
witness's exact-key-equality plus `ref` filter plus `// empty` terminator are all
present and correct as written, and the `{ ... } 2>&1 | tee` + anchored `grep`
construct does fail closed under `set -euo pipefail` (an `exit 1` in the subshell
propagates through `pipefail` and aborts before the `grep`). `jobBlock`'s throw does
work as the anti-silent-deletion mechanism.

**The core concerns.** (1) The witness reads an artifact-controlled value straight
into `$GITHUB_ENV` with no validation -- the authors anchored the `grep` precisely
*because* that value is record-controlled, then piped the same value into a documented
Actions injection sink. (2) The `o3-witness` mechanism the phase itself calls "the
clause whose loss would be least visible" is guarded only by a *prose* lock; nothing
in the repo asserts the shell that implements it, so gutting the jq filter or lowering
the 30 s margin leaves every test green and every comment intact. (3)
`--assert-graph-premise` is invoked by no CI step, no npm script and no test -- it is
inert in the pipeline. (4) `read-integration-hash.mjs`'s header promises it "must
THROW rather than yield an empty or partial hash"; the code guards only task
*absence*, never the hash *value*.

## Structural Findings (fallow)

Fallow 3.6.0 `audit --changed-since <phase-base>`, gate `new-only`, verdict FAIL.
`dead_code_issues` 0, `duplication_clone_groups` 0. The FAIL is driven entirely by
complexity: `complexity_introduced` = 1, `complexity_inherited` = 6. All 7 findings are
in `capture-hashes.mjs`, all with `exceeded=crap` and `coverage_tier=none`, so the
CRAP score is complexity multiplied by a zero-coverage penalty, not raw complexity.

| SEVERITY | LOCATION | FUNCTION | CYC | COG | CRAP | ORIGIN |
|---|---|---|---|---|---|---|
| CRITICAL | capture-hashes.mjs:698 | `diff` | 12 | 13 | 156 | inherited |
| CRITICAL | capture-hashes.mjs:485 | `assertGraphPremise` | 10 | 9 | 110 | INTRODUCED (plan 11-01) |
| HIGH | capture-hashes.mjs:350 | `capture` | 7 | 7 | 56 | inherited |
| MODERATE | capture-hashes.mjs:134 | `parseArgs` | 6 | 9 | 42 | inherited |
| MODERATE | capture-hashes.mjs:640 | `partition` | 6 | 8 | 42 | inherited |
| MODERATE | capture-hashes.mjs:615 | `flatten` | 5 | 5 | 30 | inherited |
| MODERATE | capture-hashes.mjs:674 | `printPartition` | 5 | 4 | 30 | inherited |

The 6 inherited findings are pre-existing debt in a file this phase only extended and
are out of scope. The one INTRODUCED finding, `assertGraphPremise`, is picked up by the
narrative findings below: the zero-coverage half of its CRAP score is confirmed real
(WR-05), and two of its five assertions are unreachable (WR-06), so the effective
branch count that can actually fire is lower than the cyclomatic number suggests.

NOTE (carried from the orchestrator): GSD's normalizer maps only dead-code/duplication
keys and silently drops the `complexity` category, so the usual normalized block would
have arrived EMPTY despite the FAIL verdict.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `$GITHUB_ENV` injection from an artifact-controlled value in `o3-witness`

**File:** `.github/workflows/ci.yml:696-706`

**Issue:** `h_linux` is `cat`'d from a downloaded artifact and written to `$GITHUB_ENV`
with no format validation:

```bash
h_linux="$(cat integration-hash-records/integration-hash.txt)"
if [ -z "${h_linux}" ]; then ... fi
echo "H_LINUX=${h_linux}" >> "$GITHUB_ENV"
```

Command substitution strips only *trailing* newlines. An embedded newline survives,
and `$GITHUB_ENV` is parsed line by line -- so a value of
`123\nBASH_ENV=/tmp/evil.sh` defines a second environment variable for every later
step in the job. GitHub runs `run:` steps as `bash -e {0}` (non-interactive), which
sources `BASH_ENV`, giving arbitrary code execution in the witness step.

The `-z` check is the only guard and it passes on any non-empty value. Nothing checks
that the value is a hash.

**Trust boundary.** `o3-witness` is ungated by event (`if: ${{ !cancelled() }}` only),
so it runs on `pull_request`, including from forks. The artifact is produced by
`read-integration-hash.mjs` in the `integration` job, which executes PR-authored code
(`npm run integration`, plus the reader script itself, both editable in the PR).

**Escalation, stated honestly:** the `integration` job already has code execution and
the same read-only `GITHUB_TOKEN`. The gain is narrow but real -- `o3-witness` restates
a *wider* scope set (`contents: read` **plus** `actions: read`, lines 678-680) than
`integration` inherits from the workflow grant (`contents: read` only), so the
injection converts a `contents: read` token into a `contents: read` + `actions: read`
token and grants cache-enumeration and workflow-log access on that ref. It is rated
Critical because it is an unvalidated injection into a documented Actions sink
(zizmor's `github-env`, HIGH), it crosses a permission boundary, and the fix is one
line. It becomes unambiguously severe the moment `o3-witness` gains any write scope or
any secret beyond `GITHUB_TOKEN`.

**Note on internal consistency:** `ci.yml:710-716` anchors the verification `grep` at
`^` *specifically because* "the failure detail interpolates values the downloaded
record controls". The same record-controlled value is then piped unvalidated into
`$GITHUB_ENV`. The threat was identified for one sink and missed for the other.

**Fix:** Do not route the value through `$GITHUB_ENV` at all -- the value is used in
exactly one later step, so read it there. If the cross-step hop is wanted, validate
the shape first (Nx task hashes are all-decimal per `ci.yml:1521-1522`; the server's
own validator is `HASH_PATTERN = /^[a-f0-9]{1,512}$/` in `lib/cache-key.ts:46`).

```bash
# Option A (preferred -- deletes the sink entirely). Drop the export step and read
# the file inside the assertion step:
h_linux="$(cat integration-hash-records/integration-hash.txt)"
case "${h_linux}" in
  ''|*[!0-9]*)
    echo "o3-witness: the downloaded integration-hash record is empty or not an Nx task hash (got '${h_linux}') -- refusing to compose a cache key from it" >&2
    exit 1
    ;;
esac
key="nx-cache-${h_linux}"

# Option B (keep the export step, validate before the write):
case "${h_linux}" in
  ''|*[!0-9]*) echo "o3-witness: ... " >&2; exit 1 ;;
esac
echo "H_LINUX=${h_linux}" >> "$GITHUB_ENV"
```

## Warnings

### WR-01: `read-integration-hash.mjs` guards task absence but never the hash value

**File:** `read-integration-hash.mjs:53-66`

**Issue:** The header states, in bold, "an empty hash would upload cleanly through
`if-no-files-found: error`, which only checks that a file EXISTS. Absence must fail the
leg, never default to an empty hash." GUARD 2 only checks that a *task object* exists:

```js
const task = run.tasks?.find((entry) => entry.target === TARGET);
if (!task) { throw ... }
writeFileSync(outPath, task.hash);
```

A task record with `hash: ''` (or `hash: null`) passes GUARD 2 and writes a zero-byte
`integration-hash.txt`. `if-no-files-found: error` accepts it, the artifact uploads,
and the failure surfaces one job later in `o3-witness`'s `-z` check -- precisely the
"one job further from its cause" outcome `ci.yml:519-522` says the design exists to
avoid. (`hash: undefined` happens to throw a generic `ERR_INVALID_ARG_TYPE` from
`writeFileSync` in modern Node, not this file's own diagnostic message.)

There is also no shape check, which is the upstream half of CR-01.

**Fix:**

```js
// GUARD 3 (empty/malformed hash). `if-no-files-found: error` only checks a file
// EXISTS, and an empty hash silently becomes a valid-looking cache key.
if (typeof task.hash !== 'string' || !/^[0-9]+$/.test(task.hash)) {
  throw new Error(
    `read-integration-hash: the \`${TARGET}\` task in ${runJsonPath} carries no usable ` +
      `hash (got \`${task.hash}\`). Nx renders a task hash as an all-decimal string; an ` +
      'empty or malformed value would upload cleanly and become a valid-looking cache key.',
  );
}
```

### WR-02: `read-integration-hash.mjs` takes the first `integration` task and ignores `projectName`

**File:** `read-integration-hash.mjs:53`

**Issue:** `run.tasks?.find((entry) => entry.target === TARGET)` is a first-match. The
`run.json` task records carry `projectName` (verified against the local
`.nx/cache/run.json`: keys are `taskId, target, projectName, hash, startTime, endTime,
params, cacheStatus, status`), so the discriminator is available and unused. Today the
workspace has one project so the set is a singleton -- but `npm run integration` is
`nx run-many -t integration`, which is inherently multi-project. Adding a second
project with an `integration` target makes this leg upload an arbitrary project's hash
with nothing going red, which then becomes the `H_linux` the O3 proof rests on.

This is the same class as WR-08 in `capture-hashes.mjs`: a single-project assumption
baked into an instrument whose command is multi-project.

**Fix:** Match on the full set and fail on ambiguity rather than picking one.

```js
const matches = (run.tasks ?? []).filter((entry) => entry.target === TARGET);

if (matches.length !== 1) {
  throw new Error(
    `read-integration-hash: expected exactly ONE \`${TARGET}\` task in ${runJsonPath}, ` +
      `found ${matches.length} (${matches.map((e) => e.taskId).join(', ') || '<none>'}). ` +
      'A first-match would upload an arbitrary project\'s hash as this leg\'s H_linux.',
  );
}

const task = matches[0];
```

### WR-03: GUARD 1 is a substring test on a free-form command string

**File:** `read-integration-hash.mjs:44`

**Issue:** `run.run?.command?.includes(TARGET)` matches the literal `integration`
anywhere in the recorded command. `nx run-many -t build --projects=integration-fixtures`,
`nx reset` invoked from a path containing "integration", or any future flag mentioning
the word all satisfy the spoofing guard. The guard's stated job is "a record left
behind by a DIFFERENT command must never be uploaded as this leg's integration hash" --
tolerant matching where exact matching was intended.

Note the guard does fail closed on an *absent* `run.command` (optional chaining yields
`undefined`, `!undefined` is true), which is correct.

**Fix:** Match the target as a token rather than a substring.

```js
if (!/(^|\s)integration(\s|$)/.test(run.run?.command ?? '')) {
```

Or, stronger, drop GUARD 1's dependence on command text entirely and rely on
`run.command` matching the exact expected invocation (`nx run-many -t integration`),
since ci.yml controls it.

### WR-04: nothing asserts the `o3-witness` step BODY -- only its shape and its comments

**Files:** `packages/github-cache/src/dogfood-cross-os.spec.ts:283-377`,
`packages/github-cache/src/docs-same-os-claims.spec.ts:410-538`,
`.github/workflows/ci.yml:717-763`

**Issue:** The two-harness split covers the job key, `needs:`, `permissions:` (both
scopes), `runs-on:`, `timeout-minutes:`, `if:` -- and, separately, the leading comment
prose. Neither reads the shell. Verified by search: no spec in the repo mentions
`actions_caches`, and `dogfood-cross-os.spec.ts` strips every `#` line before matching
so it structurally cannot see the comments either.

Consequence: each of the following edits leaves the entire suite green **and** every
locked phrase intact, because all ten phrases live in the job's leading comment block,
which a body edit does not touch:

- replacing `first(.actions_caches[] | select(.key == $key and .ref == $ref) | .created_at) // empty`
  with `.actions_caches[0].created_at` (drops exact-key equality, the ref filter and
  the null terminator in one stroke);
- dropping `// empty` alone (an emptiness test against the literal string `null` is
  false, so the guard passes on absence -- the file's own comment at :640-645 names
  this exact failure);
- lowering `-lt 30` to `-lt 0` (turns the stated margin into a bare `<`, which
  `ci.yml:610-612` explicitly rejects as satisfiable by a timestamp-truncation
  artefact);
- deleting the `grep -q '^o3-witness: EXISTENCE OK'` second signal.

The phase's own analysis (row E, `docs-same-os-claims.spec.ts:512-529`) says of exactly
this mechanism: "THIS IS THE ONE THAT SHIPS SUBTLY BROKEN IF THE REASON IS LOST. A
count-based check PASSES on the happy path and is wrong only in the case the witness
exists to detect." The prose lock protects the *rationale*; the *mechanism* has no
guard. That is an asymmetry, not a design choice -- the `max-parallel: 1` precedent
(WR-01/XOS-06) locks both the value and the prose about the value.

**Fix:** `dogfood-cross-os.spec.ts` already has the extractor; add cases to the existing
`o3-witness` describe. `codeLines` strips `#` lines, so these clauses are non-vacuous.

```ts
it('compares .key for EXACT equality and filters on ref -- ?key= is a prefix match', () => {
  expect(
    jobBlock('o3-witness'),
    'The witness must compare the returned .key for EXACT string equality AND filter on ' +
      'ref. ?key= is a PREFIX match (measured: a full key minus its last character still ' +
      'returns 2 entries), and ONE hash holds entries on TWO refs, so neither a count nor ' +
      'a key-only match is an existence proof.',
  ).toMatch(/select\(\s*\.key == \$key and \.ref == \$ref\s*\)/);
});

it('terminates the jq extraction with // empty, so an absent match is not the string "null"', () => {
  expect(jobBlock('o3-witness')).toMatch(/\/\/ empty'\)?$/m);
});

it('demands the STATED 30-second minimum margin, not a bare <', () => {
  expect(jobBlock('o3-witness')).toMatch(/\[ "\$\{delta\}" -lt 30 \]/);
});

it('proves the verdict was PRINTED, not just that the step exited 0', () => {
  expect(jobBlock('o3-witness')).toMatch(
    /grep -q '\^o3-witness: EXISTENCE OK' o3-witness\.log/,
  );
});
```

### WR-05: `--assert-graph-premise` is invoked by nothing -- no CI step, no npm script, no test

**Files:** `capture-hashes.mjs:485-612`, `.github/workflows/ci.yml`,
`package.json` scripts

**Issue:** Verified by search across the tracked tree (excluding `.planning/`): every
occurrence of the string `assert-graph-premise` is inside `capture-hashes.mjs` itself.
`ci.yml`'s only `capture-hashes.mjs` invocation is
`node capture-hashes.mjs --install-mode ci --out "$RECORD"` (line 940, `hash-parity`
job). The root scripts are `"capture:hashes": "node capture-hashes.mjs"` -- passthrough
with no mode.

So the mode has zero automated execution and zero test coverage. This matches fallow's
`coverage_tier=none` on the function and is what drives its CRAP 110. Its redness was
demonstrated only by a manual edit-and-revert (temporarily adding `integration` to
`FORBIDDEN_TARGETS`), which is not a committed regression test.

The consequence is not hypothetical: assertion 3 exists specifically so "an Nx upgrade
that changes the inferred `dependsOn` must fail loud instead of quietly weakening the
control". An Nx upgrade that changes it today changes nothing, because nothing runs the
assertion. A guard nothing executes is documentation.

**Fix:** Pick one of the two cheap options.

```jsonc
// package.json -- makes the mode runnable by name and greppable as a gate:
"assert:graph-premise": "node capture-hashes.mjs --assert-graph-premise"
```

```yaml
# ci.yml -- wire it into the existing hash-parity capture job (it needs no sidecar and
# no build). Under `set -euo pipefail` a failed assertion reddens the leg, and the
# --out record is the evidence TEST-08 asks for.
      - name: Assert the TEST-08 graph premise on this runner
        shell: bash
        env:
          NX_DAEMON: 'false'
          PREMISE: graph-premise-${{ matrix.os }}.json
        run: |
          set -euo pipefail
          node capture-hashes.mjs --assert-graph-premise --out "$PREMISE"
```

If wiring it into CI is deliberately out of scope, say so in the file header -- right
now the header reads as though the mode gates something.

### WR-06: two of `assertGraphPremise`'s five assertions cannot fail

**File:** `capture-hashes.mjs:536-579`

**Issue:** Trace the assertions in order.

- Assertion 4 (line 551) requires `controlIds` to equal exactly
  `[<PROJECT>:build, <PROJECT>:typecheck]` (sorted).
- Assertion 5 (line 560) requires `controlIds` to intersect `FORBIDDEN_TARGETS`.
  `FORBIDDEN_TARGETS = ['build', 'typecheck', 'test']` (line 86), and assertion 4 has
  already pinned `build` and `typecheck` into the set. Assertion 5 is therefore
  unreachable unless someone edits `FORBIDDEN_TARGETS` itself -- it is a guard on a
  local constant, not on the resolver, which is not what its own comment claims ("This
  is the clause that makes assertion 2 meaningful rather than vacuous"; assertion 4
  already discharges that).
- Assertion 6 (line 573) requires `premiseIds` to equal `controlIds`. Assertion 2 has
  already rejected any `premiseIds` containing a `build`/`typecheck`/`test` segment,
  and assertion 4 has pinned `controlIds` to exactly those two. The two sets can never
  be equal at this point. Its stated failure mode -- "a resolver returning the same
  thing for every input" -- fires on assertion 2 first, with a better message.

Net: three live assertions, not five. That matters because the mode is presented (in
the contract block at :460-484 and in the phase framing) as five independent clauses,
and because it has no test coverage to reveal the redundancy.

This is not a correctness defect -- the mode still asserts what it needs to. It is a
coverage-overstatement defect, which in a phase whose entire subject is "guards that
read as coverage but are not" deserves to be recorded.

**Fix:** Either delete assertions 5 and 6 as subsumed and renumber, or -- cheaper and
arguably better -- keep them and correct the contract comment to say they are
belt-and-braces checks on the *constants*, reachable only if `FORBIDDEN_TARGETS` or
`CONTROL_TARGET` is edited. Do not leave the current comment, which claims 5 is what
makes 2 non-vacuous.

### WR-07: the premise record claims a commit it did not prove it measured

**File:** `capture-hashes.mjs:581-596`

**Issue:** `capture()` records `workingTreeClean` (line 370, measured *before* any
output file is written, with a comment explaining why). `assertGraphPremise()` records
`commit` (line 486) but not `workingTreeClean`, and does not call `measureGraphState()`
either.

The record therefore asserts `PREMISE OK` "at commit X" while the resolved graph may
have come from an uncommitted `nx.json` / `project.json` edit. This is the exact
failure the mode's own mutual-exclusion error (line 749-755) forbids: "recording an
install mode against it would make the record claim a provenance it never measured."
The same objection applies to the commit field.

**Fix:**

```js
const commit = git('rev-parse', 'HEAD').trim();
const workingTreeClean = git('status', '--porcelain').length === 0;
// ... in record.meta:
      commit,
      workingTreeClean,
```

### WR-08: `resolvedTaskIds` hardcodes a single-project run-many

**File:** `capture-hashes.mjs:436-447`, used at `capture-hashes.mjs:497-498`

**Issue:** The comment at :489-492 justifies `[PROJECT]` on the ground that "`run-many`
over every project in a single-project workspace is `[PROJECT]`". True today, and
`PROJECT` is derived rather than hardcoded (line 111) -- but the derivation reads one
fixed path, `./packages/github-cache/package.json`.

Add a second workspace project with an `integration` target and the real
`nx run-many -t integration` resolves a superset, while `assertGraphPremise` keeps
asserting over the one project and keeps printing `PREMISE OK`. The absence assertion
(assertion 2) then covers strictly less than the command it claims to model, and
assertion 1's non-emptiness check does not detect it (the set is still non-empty).

This is a guard that silently *narrows* rather than breaking -- the same failure shape
as WR-02, and the shape this file elsewhere guards against explicitly (the missing-task
throw at :322-331 exists because "a deleted inferred target must NEVER read as
'measured, no difference'").

**Fix:** Resolve over the whole graph rather than a pinned project, so the model tracks
the command:

```js
function resolvedTaskIds(projectGraph, targets) {
  const taskGraph = createTaskGraph(
    projectGraph,
    {},
    Object.keys(projectGraph.nodes),
    targets,
    undefined,
    {},
  );

  return Object.keys(taskGraph.tasks).sort();
}
```

If the single-project pin is deliberate, add an assertion 0 that
`Object.keys(projectGraph.nodes)` has length 1 -- so a second project fails loud rather
than narrowing the premise.

### WR-09: DOCS_08 row A locks only one of the two comment blocks it names

**File:** `packages/github-cache/src/docs-same-os-claims.spec.ts:386-415`

**Issue:** Row A's docstring states its subject explicitly: "**Two** comment blocks in
`ci.yml`, above `hash-parity` and above `hash-parity-compare`, currently assert that
this file is NOT in `nx.json`'s `test` inputs ... WHAT THIS ROW LOCKS IS THE
REPLACEMENT REASON".

Measured (`rg -F -c`): both required phrases occur **twice** in `ci.yml` --
`ci.yml:883` / `ci.yml:1063` and `ci.yml:886` / `ci.yml:1066`. The assertion is
`toContain`, which is satisfied by the first occurrence. Deleting the replacement
reason from *either* block -- or reverting one block to the stale "ci.yml is NOT a test
input" claim -- leaves the row GREEN.

This is precisely the trap row B (lines 426-430) identifies and avoids: "The generic
wholesale-replacement sentence ALREADY appears in this file ... so a phrase reusing that
wording would pass from the pre-existing occurrence and lock nothing at all. Naming the
job is what makes each phrase unique to the new comment." Row A does not disambiguate,
so it half-locks. The other eight Phase 10/11 phrases were verified unique (count 1);
only row A's two are duplicated.

**Fix:** Give the two blocks distinguishable replacement wording and lock one phrase
per block, or assert the occurrence count rather than mere containment.

```ts
// Option A -- split into two rows with block-unique phrases, following row B's
// name-the-subject technique (e.g. append "-- the hash-parity capture job" and
// "-- the hash-parity-compare gate" to the two ci.yml sentences).

// Option B -- if the wording must stay identical, assert BOTH occurrences survive:
it('locks the replacement fact in BOTH ci.yml blocks, not just the first', () => {
  const phrase = "ci.yml IS in nx.json's test inputs (nx.json:69, PARITY-08, Phase 9)";
  expect(read('.github/workflows/ci.yml').split(phrase).length - 1).toBe(2);
});
```

### WR-10: the positive control suppresses its own diagnostic on the dead-sidecar case

**File:** `.github/workflows/ci.yml:577-588`

**Issue:**

```bash
set -euo pipefail
code=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' -H "${auth}" ".../${own_hash}")
echo "positive control: GET /v1/cache/${own_hash} -> ${code} (wanted 200)"
if [ "${code}" != "200" ]; then ... exit 1; fi
```

There is no `|| true` on the substitution. On connection-refused, `curl` exits 7, the
assignment inherits that status, and `set -e` aborts the step immediately -- before the
`echo` and before the explicit "positive control FAILED ... the sidecar and backend were
not proven alive, so this leg's MISS observation is not evidence" message.

A dead sidecar is the single case this control exists to detect. The step does still
fail (correct), but it fails with a bare `curl` exit and no explanation in the log,
which is the opposite of the design intent stated at :553-570. The sibling readiness
poll at :478 does carry `|| true` and documents exactly this reasoning ("On
connection-refused curl's `-w` already prints 000 and exits non-zero, so swallow the
exit with `|| true`"); the new step did not inherit it.

**Fix:**

```bash
          code=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' -H "${auth}" "${NX_SELF_HOSTED_REMOTE_CACHE_SERVER}/v1/cache/${own_hash}" || true)
```

`code` is then `000` on connection-refused, the `!= "200"` branch fires, and the
explanatory message reaches the log. Note the `|| echo 000` form is still wrong here for
the reason :262-264 already records.

### WR-11: the artifact-name literal is not tied to the `integration` matrix label

**Files:** `.github/workflows/ci.yml:526` (upload),
`.github/workflows/ci.yml:691` (download),
`.github/workflows/ci.yml:420` (matrix)

**Issue:** Three literals must move together:
`matrix.os: [ubuntu-24.04-arm, ...]`, the upload name
`integration-hash-${{ matrix.os }}`, and the download's hardcoded
`integration-hash-ubuntu-24.04-arm`. Only the *step name* contract is documented as a
contract (`ci.yml:488-495`, "If this name is ever edited, the witness's jq selector
must be edited in the SAME commit") -- the artifact-name coupling has no such note and
no guard.

`dogfood-cross-os.spec.ts:343-352` asserts `o3-witness` runs on `ubuntu-24.04-arm`, but
that pins the *witness's own runner*, not the integration matrix's ubuntu label, so it
would stay green through a matrix bump to `ubuntu-26.04-arm`. The symptom would be a
`download-artifact` error in `o3-witness`, one job away from the cause, with no message
about why.

**Fix:** Add the contract note next to the download, and/or a spec clause tying the
literal to the matrix.

```ts
it('downloads an artifact name that the integration matrix actually produces', () => {
  const integration = jobBlock('integration');
  const witness = jobBlock('o3-witness');
  const wanted = witness.match(/name: integration-hash-(\S+)/)?.[1];

  expect(
    wanted && integration.includes(wanted),
    'o3-witness downloads integration-hash-<os>, but that <os> literal no longer appears ' +
      "in the integration job's matrix. Three literals must move together: matrix.os, the " +
      'upload name, and this download name.',
  ).toBe(true);
});
```

## Info

### IN-01: `--assert-graph-premise` silently swallows `--diff`

**File:** `capture-hashes.mjs:747-767`

**Issue:** The dispatch checks `installMode` exclusivity for the premise branch and
both `installMode` and `out` for the diff branch. `--assert-graph-premise --diff a b`
runs the premise mode and discards `--diff` with no error, which is inconsistent with
the file's stated "a record must never claim a provenance it never measured" posture.

**Fix:** Add `args.diff !== undefined` to the premise branch's exclusivity check and
extend its message.

### IN-02: `--out` with a missing value falls back to stdout instead of erroring

**File:** `capture-hashes.mjs:157-161`

**Issue:** `parsed.out = argv[index + 1]` is `undefined` when `--out` is last, and both
`capture()` and `assertGraphPremise()` treat a falsy `out` as "print to stdout". A
mistyped invocation silently produces no file. In `ci.yml` the value is always supplied
(`--out "$RECORD"`), and `if-no-files-found: error` catches the empty-`$RECORD` case,
so the exposure is limited to manual runs.

**Fix:** Throw when the flag is present but its value is absent or begins with `--`.

### IN-03: `o3-witness` misattributes an upstream integration failure to a rename

**File:** `.github/workflows/ci.yml:744-750`

**Issue:** `if: ${{ !cancelled() }}` runs the witness even when `integration` failed.
If the Windows leg dies before reaching its run step (a wedged `npm ci`, for example),
the jobs API reports that step as skipped with `started_at: null`, `// empty` yields an
empty string, and the job prints "no started_at for step ... Both are literal selectors;
a rename in the integration job must land in the SAME commit as the change here." The
message points at a rename that did not happen.

**Fix:** Distinguish "job/step not found" from "step found but never started" before
choosing the message -- e.g. extract `.status`/`.conclusion` alongside `.started_at` and
name the upstream failure when the step exists but was skipped.

### IN-04: `/actions/runs/{id}/jobs` is fetched unpaginated at `per_page=100`

**File:** `.github/workflows/ci.yml:744-746`

**Issue:** No `page` loop and no `Link`-header follow. The workflow currently has ~25
job legs, so a single page suffices. Crossing 100 (a wider matrix, more jobs) silently
truncates the response, the Windows integration job falls off the page, and a correct
run FAILS with the rename message from IN-03. The sibling caches query is safe by a
different mechanism -- it is server-filtered by `key` + `ref` down to one or two rows --
so the two calls do not share the same protection despite looking identical.

**Fix:** Note the cap next to the call, or page explicitly. `gh` is deliberately not
available here (D-17 sub-lock 4), so a small `while` loop over `page=N` until the
selector matches or the page is short is the in-scope option.

### IN-05: query values and `cacheStatus` are used without encoding or validation

**Files:** `.github/workflows/ci.yml:733`, `read-integration-hash.mjs:73-75`

**Issue:** Two minor cases.

(a) `?key=${key}&ref=${GITHUB_REF}` interpolates `GITHUB_REF` into a URL query with no
percent-encoding. Safe for `refs/heads/main` and `refs/pull/N/merge`, which are the only
two values this workflow sees. A branch name containing `&` or `#` would silently
corrupt the filter and produce a wrong-but-plausible result rather than an error.

(b) `read-integration-hash.mjs` prints `cacheStatus=${task.cacheStatus}` and describes it
as "one of exactly three values -- `remote-cache-hit`, `local-cache-hit` or
`cache-miss`" without checking. An absent field prints `cacheStatus=undefined` into the
recorded evidence line. The value is RECORDED and never GATED, so this is cosmetic, but
the record is cited as O1/O2's structured corroborator.

**Fix:** (a) `jq -rn --arg r "$GITHUB_REF" '$r|@uri'` before interpolating, or leave as
is with a note. (b) Print `${task.cacheStatus ?? '<absent>'}` so the evidence line never
reads as a real value.

---

_Reviewed: 2026-07-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
