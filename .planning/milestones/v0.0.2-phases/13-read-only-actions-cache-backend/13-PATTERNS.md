# Phase 13: Read-Only Actions-Cache Backend - Pattern Map

**Mapped:** 2026-08-02
**Files analyzed:** 14 (13 modified, 1 regenerated; ZERO new files under `src/`)
**Analogs found:** 14 / 14

> **The dominant pattern of this phase is SELF-ANALOG.** Almost every file to be modified already
> contains the exact idiom its change must extend -- an existing branch sequence, an existing
> per-leg triplet, an existing enumerated list, an existing describe block. The planner's default
> instruction should be "copy the sibling case in this same file", not "invent a shape". The one
> genuine cross-file analog is `memory-backend.ts`, which is the structural precedent for the whole
> phase.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/github-cache/src/backend/actions-cache-backend.ts` | backend adapter (port implementer) | file-I/O + request-response | `packages/github-cache/src/backend/memory-backend.ts` | exact (same port, same two-factory split) |
| `packages/github-cache/src/lib/select-backend.ts` | factory selector / composition seam | context-derived construction (no I/O) | itself, lines 29-60 (the four-branch sequence) | self (extend the existing chain) |
| `packages/github-cache/src/test/consumer-contract.ts` | test fixture (single-source contract list) | static config | itself, lines 12-21 | self (append one entry) |
| `packages/github-cache/src/backend/actions-cache-backend.spec.ts` | test (source-scan structural guard) | file-I/O read of own source | itself, lines 491-544 (comment-strip + member scan) | self (add a package-scope sibling) |
| `packages/github-cache/src/lib/select-backend.spec.ts` | test (behavioural table) | pure, injected env bag | itself, lines 297-336 (`TRUST-05: no caller-facing mode surface`) | self (add the narrowing-only table) |
| `packages/github-cache/src/dogfood-cross-os.spec.ts` | test (from-disk CI-shape pin) | file-I/O read of `ci.yml` | itself, lines 816-941 (`build-windows` describe) + `windowsLegReasons` 723-814 | self (add 2 clauses x 3 legs + 2 reason keys) |
| `packages/github-cache/src/public-surface.spec.ts` | test (enumerated contract guard) | static assertion | itself, lines 158-169 (the inline sorted literal) | self (append one entry -- the RED that IS the review diff) |
| `packages/github-cache/src/docs-adoption.spec.ts` | test (docs presence guard) | file-I/O read of docs | itself, lines 116-141 (`advanced.md documents all four selectBackend outcomes`) | self (fifth-outcome clause) |
| `.github/workflows/ci.yml` | CI config (3 near-identical legs) | shell pipeline / process orchestration | itself, `build-windows` lines 482-569 | self (ONE template, applied 3x) |
| `docs/configuration.md` | docs (contract reference) | static | itself, table row 23 + section 73-80 (`CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION`) | exact (same knob shape: non-empty opt-in) |
| `docs/advanced.md` | docs (selection table) | static | itself, lines 18-34 (the FOUR-outcome table) | self (fourth row is the closest sibling to the new fifth) |
| `docs/versioning.md` | docs (contract enumeration) | static | itself, lines 18-22 (group 3 knob list) | self (append to the inline list) |
| `.planning/THREAT-MODEL.md` | planning doc (control ledger) | static | itself, lines 90-103 (`## Residual notes` bullets) | self (one bullet, NO new control row) |
| `start-cache-server/index.js` | build artifact (committed esbuild bundle) | generated | none -- command-driven | N/A (regenerate, never hand-edit) |

**Also expected as a phase artifact (not source):** `.planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md`
-- analogs `.planning/phases/09-os-invariant-actions-cache-version/09-EVIDENCE.md`,
`.planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md`.

---

## Pattern Assignments

### `packages/github-cache/src/backend/actions-cache-backend.ts` (backend adapter, file-I/O + request-response)

**Analog:** `packages/github-cache/src/backend/memory-backend.ts` (structural shape) + ITSELF (every
line moved must move verbatim).

#### Pattern A -- the two-factory split (copy the SHAPE, not the mechanics)

`memory-backend.ts:30-73` -- two parameterless factories over one shared read helper, read-only-ness
expressed as an ABSENT method plus a comment that says so:

```typescript
// memory-backend.ts:9-17 -- the shared read helper
function readFrom(store: Map<string, Buffer>, hash: string): GetResult {
  const bytes = store.get(hash);

  if (bytes === undefined) {
    return { kind: 'miss' };
  }

  return { kind: 'hit', bytes };
}

// memory-backend.ts:30 -- writable factory, ZERO parameters
export function createWritableMemoryBackend(): CacheBackend { /* ... */ }

// memory-backend.ts:63-73 -- read-only factory, ZERO parameters, ReadableBackend return type
export function createReadOnlyMemoryBackend(): ReadableBackend {
  const store = new Map<string, Buffer>();

  return {
    async get(hash: Hash): Promise<GetResult> {
      return readFrom(store, hash);
    },
    // No put: read-only-ness is structural (ReadableBackend), not a runtime
    // 'forbidden'. The server answers a PUT here with the contract's 403.
  };
}
```

**Copy verbatim into the new read-only Actions factory:** the trailing
`// No put: read-only-ness is structural (ReadableBackend), not a runtime 'forbidden'.` comment.
It is the house sentence for this exact position.

**Copy the doc-comment conventions from `memory-backend.ts:50-62`:** the read-only factory's JSDoc
names (a) what its live role in `selectBackend` is, (b) that it is one of the documented
backend-selection outcomes with a pointer to the `docs/advanced.md` table, and (c) the TRUST-05
sentence "RW-vs-RO is which factory constructs the server, never a caller-facing mode flag".

**DIVERGE from `memory-backend.ts` on ONE axis (RESEARCH.md Q1 candidate table):** the memory backend
uses TWO INDEPENDENT factories over a helper. The Actions backend uses COMPOSITION -- the writable
factory spreads the read-only one -- because these two share construction-time state (the VER-04
guards + the VER-07 mkdir) which the memory backend's two independent `Map`s do not.

```typescript
// The target shape (RESEARCH.md Pattern 1 / CONTEXT.md D-01)
export function createReadOnlyActionsCacheBackend(): ReadableBackend { /* guards + mkdir + get */ }

export function createActionsCacheBackend(): CacheBackend {
  return { ...createReadOnlyActionsCacheBackend(), put(hash, bytes) { /* unchanged */ } };
}
```

#### Pattern B -- the spread-a-backend precedent (proves the spread is safe)

`serve.ts:91-117` already does exactly this spread on a backend object, and carries the comment
that licenses it:

```typescript
// serve.ts:91-101
// A writable backend gets its put wrapped in drain tracking; a read-only backend
// (ReadableBackend, no put) is passed through unchanged -- there is no write path
// to drain, and the server answers a PUT to it with the contract's 403. Spread is
// safe: backend factories return closures over captured state, not this-bound
// methods.
let tracked: ReadableBackend | WritableBackend;

if (isWritableBackend(backend)) {
  const writable = backend;
  tracked = {
    ...writable,
    put: (hash: Hash, bytes: Buffer): Promise<PutResult> => { /* ... */ },
  };
```

**No change to `serve.ts` is expected.** It already handles a `ReadableBackend` correctly.

#### Pattern C -- what MOVES verbatim (the comment locks)

These blocks move into the new read-only factory body UNEDITED. They are the phase's highest-risk
edit because a "tidy-up" during the move silently deletes a drift guard.

| Block | Current lines | Destination | Rule |
|---|---|---|---|
| VER-04 cwd probe (`nx.json` existsSync) + its ~40-line rationale comment | `86-92` (comment `47-85`) | read-only factory | verbatim; runs on BOTH paths |
| VER-04 `GITHUB_WORKSPACE` identity comparison + comment | `94-109` | read-only factory | verbatim; runs on BOTH paths |
| VER-07 construction-time `mkdirSync(CACHE_ARCHIVE_DIR, { recursive: true })` + comment | `111-121` | read-only factory (shared core) | verbatim; the writable path INHERITS it through the composition call. Do NOT drop it from the write path |
| VER-03 restoreCache positional comment lock + the call | `127-147` | read-only factory `get` | verbatim, comments included |
| the `withHashLock` wrapper + `readFile` + `finally { rm }` | `124-164` | read-only factory `get` | verbatim |
| VER-07 per-call `mkdirSync` in `put` | `170-191` | stays in `put` | UNCHANGED |
| VER-03 saveCache positional lock + call | `196-244` | stays in `put` | UNCHANGED |
| `lookupOnly` probe (the SECOND `restoreCache`) | `250-268` | stays in `put` | UNCHANGED. Write-path only; does NOT violate D-01 |
| `ReserveCacheError` catch + `finally { rm }` | `279-293` | stays in `put` | UNCHANGED |

**The one edit inside a moved block (Pitfall 6):** both VER-04 error messages are template literals
prefixed with the function name:

```typescript
// actions-cache-backend.ts:89-91 -- the prefix that must stop naming a function that no longer runs
throw new Error(
  `createActionsCacheBackend: the process cwd must be the Nx workspace root, but no nx.json exists at ${cwd}. ...`,
);
// actions-cache-backend.ts:106-108 -- same, second guard
throw new Error(
  `createActionsCacheBackend: GITHUB_WORKSPACE (${githubWorkspace}) and the process cwd (${cwd}) must be the same directory. ...`,
);
```

Rename the prefix to the read-only factory's name or a shared literal. Verify after the move with
`git grep -n "createActionsCacheBackend:" packages/github-cache/src`.

#### Pattern D -- the header doc-comment (extend, do not replace)

`actions-cache-backend.ts:18-45` is the module's rationale block. Two sentences in it become load-bearing
for the new shape and must be preserved / extended, not rewritten:

```typescript
// actions-cache-backend.ts:25-27
 * It takes NO parameters on purpose: nothing about RW-vs-RO is decided here --
 * that is the upstream write gate's job (D-01) -- and this factory must never
 * grow a mode argument (TRUST-05).

// actions-cache-backend.ts:33-41 -- the withHashLock placement rationale;
// the read-only factory inherits withHashLock for free via the moved `get`.
```

---

### `packages/github-cache/src/lib/select-backend.ts` (factory selector, context-derived construction)

**Analog:** ITSELF. The whole file is 60 lines and the branch ORDER is the guarantee, so the existing
sequence is the pattern to extend -- at the END, never in the middle.

**Current branch sequence, verbatim (lines 29-60):**

```typescript
export function selectBackend(
  env: NodeJS.ProcessEnv = process.env,
): ReadableBackend | WritableBackend {
  if (!isWriteTrusted(env).trusted) {
    // ... 8-line comment ...
    return createReleasesReadBackend(createReleasesReadClient(env));   // BRANCH 1: narrow
  }

  if (!GITHUB_REPOSITORY_PATTERN.test(env.GITHUB_REPOSITORY ?? '')) {
    // Fail-closed construction guard (server.ts:62-66 precedent): ...
    throw new Error(
      'selectBackend: GITHUB_REPOSITORY must be a valid owner/name in a write-trusted context (TEST-01)',
    );                                                                 // BRANCH 2: fail-closed
  }

  if (resolveGitHubToken(env) === undefined) {
    // Degrade, do NOT throw: a merely-unwired workflow token must not break the
    // build. ...
    return createReadOnlyMemoryBackend();                              // BRANCH 3: narrow
  }

  return createActionsCacheBackend();                                  // BRANCH 4: the ONLY writable
}
```

**Where the fifth outcome goes:** immediately before `return createActionsCacheBackend();` and
nowhere else (Pitfall 5). Every branch above it already returned a read-only backend or threw, so the
new check can only convert BRANCH 4 into a read-only one -- the "can only narrow" guarantee is
control flow, not a comment.

**Comment conventions to copy from this file:** every branch carries a WHY comment naming the
requirement id in parentheses (`(TEST-01)`, `(D-01)`, `(TRUST-05)`), and the degrade branch's comment
explicitly contrasts itself with the throwing branch. The new branch's comment must name its POSITION
as the guarantee.

**The truthiness idiom (the house form for a non-empty opt-in), `lib/retention.ts:118`:**

```typescript
// retention.ts:118 -- opt-in read as bare truthiness, never `=== 'true'`
if (raw < MIN_AGE_DAYS && !env.CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION) {
```

Its documented consumer form, `docs/configuration.md:75` -- "Set this (to any non-empty value)".

**Env-derived predicate idiom (`lib/trust.ts`), for reference only:** `isWriteTrusted` is pure,
takes an injectable env bag with a `= process.env` default, is default-deny, and returns a
DISCRIMINATED UNION carrying a reason rather than a bare boolean (`trust.ts:62-100`).

```typescript
// trust.ts:62-68 -- the reason-carrying union idiom
export type WriteUntrustedReason = 'not-ci' | 'untrusted-event' | 'untrusted-host';

export type WriteTrust =
  | { readonly trusted: true }
  | { readonly trusted: false; readonly reason: WriteUntrustedReason };
```

**Planner note (laziness check):** this phase's knob is a single truthiness read at ONE call site
with no degrade-reason to surface. `trust.ts`'s union shape exists because a silent read-only degrade
needed to be observable at the call site; a knob the workflow author set deliberately does not. A
bare `if (env.CACHE_READ_ONLY)` inline in `selectBackend` matches `retention.ts:118` and is the
smaller diff. Extracting a `resolveReadOnly()` predicate module would be the first rung this phase
should skip -- unless the planner wants the knob covered by `public-surface.spec.ts`'s
`KNOB_SOURCE_FILES` scan, which already lists `./lib/select-backend.ts` (`public-surface.spec.ts:70`),
so an inline read is ALREADY covered there.

---

### `packages/github-cache/src/test/consumer-contract.ts` (test fixture, static config)

**Analog:** ITSELF, lines 12-21. Append one entry; the array is deliberately NOT sorted (insertion
grouped by concern -- Nx client vars, then port, then mirror knobs, then tokens, then identity).

```typescript
// consumer-contract.ts:12-21 -- the single source both contract guards read
export const EXPECTED_ENV_KNOBS = [
  'NX_SELF_HOSTED_REMOTE_CACHE_SERVER',
  'NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN',
  'PORT',
  'CACHE_MIRROR_MAX_AGE_DAYS',
  'CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION',
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GITHUB_REPOSITORY',
];
```

Adding an entry here fires FOUR guards at once, all of which are the intended reviewable diff:
`public-surface.spec.ts:158-169` (inline sorted literal), `public-surface.spec.ts:182-187` (knob must
appear in `KNOB_SOURCE_FILES` source), `docs-adoption.spec.ts:52-54` (`configuration.md`),
`docs-adoption.spec.ts:82-84` (`versioning.md`).

---

### `packages/github-cache/src/backend/actions-cache-backend.spec.ts` (test, source-scan guard)

**Analog:** ITSELF, lines 491-544. **This guard is the reason both factories must live in ONE file.**

**The file-scoped comment-strip + member scan (lines 499-531) -- the guard the phase must NOT break:**

```typescript
// actions-cache-backend.spec.ts:499-510
const BACKEND_COMMENT_MARKERS = ['//', '/*', '*/', '*'] as const;

const strippedBackendSource = readFileSync(
  new URL('./actions-cache-backend.ts', import.meta.url),
  'utf8',
)
  .split('\n')
  .filter(
    (line) =>
      !BACKEND_COMMENT_MARKERS.some((marker) => line.trim().startsWith(marker)),
  )
  .join('\n');

// actions-cache-backend.spec.ts:517-531
it('accesses exactly the ordered members restoreCache, saveCache, restoreCache (VER-03)', () => {
  const members = [
    ...strippedBackendSource.matchAll(/\bcache\.([A-Za-z_$][\w$]*)/g),
  ].map((match) => match[1]);

  expect(members).toStrictEqual([
    'restoreCache',
    'saveCache',
    'restoreCache',
  ]);
});
```

Under the composed shape (read-only factory declared FIRST, writable second) this array is
byte-identical and the guard passes with zero edits. Under a sibling-file shape the guard goes BLIND.
**A new file matching `*actions-cache*.ts` is an automatic reject.**

**The companion single-import clause (lines 533-543), also unchanged:**

```typescript
it('imports @actions/cache exactly once, in the NAMESPACE form (VER-03)', () => {
  const imports = (
    strippedBackendSource.match(/import[^;]*'@actions\/cache';/g) ?? []
  ).map((statement) => statement.replace(/\s+/g, ' ').trim());

  expect(imports).toStrictEqual(["import * as cache from '@actions/cache';"]);
});
```

**Pattern for the NEW package-scope scan (VER-09):** same shape one level wider -- read files, filter
non-spec, assert an exact array. Comment conventions to copy from `:512-516` and `:524-525`: state
what the clause sees that the sibling clause CANNOT, and never assert a bare count ("assert on
content, never on a bare count a deletion satisfies"). Path resolution should reuse
`packages/github-cache/src/test/workspace-root-cwd.ts` rather than inventing a new idiom.

**The whole-argument-array positional pin (lines 431-488) must stay green.** Its comment at `:409-430`
records that asserting the WHOLE array (never `.mock.calls[0][0]` per index) is the load-bearing
choice:

```typescript
// actions-cache-backend.spec.ts:451-482
expect(restoreCache.mock.calls[0]).toStrictEqual([[path], key, undefined, undefined, true]);
expect(saveCache.mock.calls[0]).toStrictEqual([[path], key, undefined, true]);
expect(restoreCache.mock.calls[1]).toStrictEqual([[path], key, [], { lookupOnly: true }, true]);
```

**Pattern for the NEW read-only-factory describes:** assert BEHAVIOURALLY, never by identity against
a factory. The house form for "is it writable" is the structural discriminator:

```typescript
// types.ts:46-50 -- the runtime discriminator every spec uses
export function isWritableBackend(
  backend: ReadableBackend | WritableBackend,
): backend is WritableBackend {
  return 'put' in backend;
}
```

---

### `packages/github-cache/src/lib/select-backend.spec.ts` (test, behavioural table)

**Analog:** ITSELF, lines 297-336 (`describe('TRUST-05: no caller-facing mode surface')`). The new
narrowing-only proof belongs in or beside this describe.

**The structural clause that must stay green unchanged (lines 298-305):**

```typescript
it('structural: selectBackend.length is 0 -- its single declared parameter has a default (TRUST-05)', () => {
  // Non-vacuous: Function.length counts parameters BEFORE the first default.
  // ... If someone added a `mode`/options parameter to
  // request the writable backend, this count would change and the test fails.
  expect(selectBackend.length).toBe(0);
});
```

**The widening test the new knob must NOT weaken (lines 307-335):**

```typescript
it('behavioral: an untrusted env bag carrying override-shaped extra keys still yields a forbidden put (TRUST-05)', async () => {
  // Non-vacuous: NOT an identity check against a factory (a smuggled flag could
  // pass that while still returning the writable backend). ...
  const env = {
    GITHUB_ACTIONS: 'true',
    GITHUB_EVENT_NAME: 'pull_request_target', // refused on every host
    GITHUB_SERVER_URL: 'https://github.com',  // guarded host must NOT rescue it
    GITHUB_REPOSITORY: 'op-nx/github-cache',
    GH_TOKEN: 'ghs_token',
    MODE: 'write',
    FORCE_WRITABLE: 'true',
    NX_CACHE_MODE: 'rw',
    writable: 'true',
    readOnly: 'false',
  };

  const backend = selectBackend(env);

  expect(isWritableBackend(backend)).toBe(false);
});
```

**Table-driven idiom for the exhaustive narrowing proof, copy from lines 111-130:**

```typescript
it.each([
  'pull_request_target',
  'issue_comment',
  'workflow_run',
  'workflow_dispatch',
])(
  'CI + %s yields a read-only backend whose put is forbidden even on a github.com host (TEST-01, TRUST-01, Pitfall 1)',
  async (event) => {
    // Non-vacuous: the guarded host is PRESENT, so a passing 'forbidden' proves
    // the host did not rescue a dangerous/unlisted event ...
    const backend = selectBackend({ ...trusted, GITHUB_EVENT_NAME: event, GITHUB_SERVER_URL: 'https://github.com' });

    expect(isWritableBackend(backend)).toBe(false);
  },
);
```

**The base fixture to spread over (lines 71-76) -- vary exactly ONE axis per case:**

```typescript
// A well-formed trusted CI context: ... Individual tests spread over this to
// vary exactly one axis so a failure names the axis that broke.
const trusted = {
  GITHUB_ACTIONS: 'true',
  GITHUB_EVENT_NAME: 'push',
  GITHUB_REPOSITORY: 'op-nx/github-cache',
  GH_TOKEN: 'ghs_token',
} satisfies NodeJS.ProcessEnv;
```

**Also copy (mandatory for any new write-trusted case):** the `enterWorkspaceRootCwd()`
`beforeAll`/`afterAll` hook at lines 58-66 and its 13-line rationale at `:45-57` -- write-trusted
cases reach the REAL `createActionsCacheBackend()` and hit VER-04's cwd guard. The new read-only
outcome ALSO constructs the real factory, so it needs the same hook (already present file-wide).

**Direction warning for the narrowing table (recorded project hazard):** assert the implication
`writable(withKnob) => writable(withoutKnob)`. Never a negated matcher inside a single call
assertion -- negate the QUANTIFIER, not the predicate.

---

### `packages/github-cache/src/dogfood-cross-os.spec.ts` (test, from-disk CI-shape pin)

**Analog:** ITSELF -- `windowsLegReasons` (723-814) for the reason strings, and the `build-windows`
describe (816-941) for the clauses. The typecheck/test describes repeat the same regexes verbatim
without the comments (the file's stated convention at `:895-897`).

**The extraction harness -- comment-stripped, job-scoped (lines 49-77):**

```typescript
const codeLines = readFileSync(
  new URL('../../../.github/workflows/ci.yml', import.meta.url),
  'utf8',
)
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'));

function jobBlock(name: string): string {
  const start = codeLines.findIndex((line) =>
    new RegExp(`^ {2}${name}:\\s*$`).test(line),
  );

  if (start < 0) {
    throw new Error(
      `ci.yml: no job keyed \`  ${name}:\` -- VER-06's guard cannot scope its assertions`,
    );
  }

  const rest = codeLines.slice(start + 1);
  const end = rest.findIndex((line) => /^ {2}\S/.test(line));

  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}
```

Two consequences the new clauses inherit for free: (1) `jobBlock` THROWS on an absent job, so a
deleted leg fails loud; (2) comments are stripped, so a knob or gate that exists only in a `#` line
cannot satisfy an assertion.

**The exact clause pair being extended (lines 917-926) -- name-only TODAY, which is the defect:**

```typescript
it('tees its Nx output and records the remote-cache count, so the leg observes something', () => {
  const block = jobBlock('build-windows');

  expect(block, cacheObservation).toMatch(
    /^ {6}- name: Run the build target and tee its output$/m,
  );
  expect(block, cacheObservation).toMatch(
    /^ {6}- name: Record the remote-cache label occurrence count for this leg$/m,
  );
});
```

**HOW EXISTING CLAUSES IN THIS FILE AVOID VACUITY -- copy all four techniques:**

1. **A positive control comes FIRST** (`:830-840`), because the file's `not.toMatch` clauses are
   trivially satisfied by an empty or mis-extracted block:
   ```typescript
   // POSITIVE CONTROL, and it comes FIRST for the same reason every other control in this file
   // does: the no-`if:` clause at the end is a `not.toMatch`, which an empty or mis-extracted
   // block satisfies trivially. `jobBlock` THROWS on an absent job key, so this clause is
   // simultaneously the presence guard and the extraction control.
   it('scopes to a real build-windows job block that runs npm run build', () => {
     const block = jobBlock('build-windows');

     expect(block, presence).toMatch(/^ {10}npm run build 2>&1 | tee build-nx.log$/m);
   });
   ```
2. **Anchor at an exact indent** so a whole-file or wrong-scope match cannot pass. `:851` uses
   `/^ {4}needs: build$/m` and its reason string (`:737-743`) records that UNANCHORED, `build` is
   already satisfied by the job's own `npm run build` step -- "the exact tautology this file records
   having shipped once".
3. **Count the needle's occurrences in the STRIPPED file, and record the measurement** (`:700-712`):
   `windows-11-arm` occurs 10 times stripped / 25 raw, which is why every clause is job-scoped.
   Re-measure both readings when `ci.yml` changes shape.
4. **Prove non-vacuity by MUTATION and record it in the comment** (`:886-893`):
   ```typescript
   // MEASURED, not argued: deleting the whole "Pre-set the Nx cache client vars" step from a
   // leg leaves the `- uses: ./start-cache-server` clause, the `- cancel: cache-server`
   // clause and every other clause for that leg GREEN, ...
   // Both mutations were run against these three regexes before this clause
   // was committed; both go red here and nowhere else (WR-06).
   ```

**THE LIVE VACUITY TRAP (RESEARCH.md Q6, verified):** `jobBlock('build-windows')` spans `ci.yml:482-569`
and line **527** is a bare `exit 1` inside the readiness poll -- not a comment, so the strip keeps it.
`expect(block).toMatch(/exit 1/)` is GREEN today, before the phase changes anything. The COMPARISON
line is the load-bearing needle.

**The `$GITHUB_ENV` write regex idiom to copy (lines 901-906):**

```typescript
expect(block, cacheClient).toMatch(
  /^\s+echo "NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http:\/\/127\.0\.0\.1:3000" >> "\$GITHUB_ENV"$/m,
);
expect(block, cacheClient).toMatch(
  /^\s+echo "NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=\$\{token\}" >> "\$GITHUB_ENV"$/m,
);
```

**The reason-string factory to extend (lines 719-814).** Every clause passes a reason as the second
`expect` argument. The convention: state what breaks, name the SILENT failure mode, and end with
`RENAME_NOTE`.

```typescript
const RENAME_NOTE =
  'If the job was legitimately renamed, update this describe in the SAME commit; do not ' +
  'delete the assertion to make the suite green.';

function windowsLegReasons(leg: string, target: string, producer: string) {
  return {
    presence: `jobBlock THROWS when no job is keyed \`  ${leg}:\` ... ${RENAME_NOTE}`,
    // ... 8 keys today: presence, runsOn, needs, timeout, ownTarget, sidecar,
    //     cacheClient, cacheObservation, backendToken, noIf
  };
}
```

**D-06 CORRECTION SITE #7 lives here** -- `cacheObservation`, lines 774-791. The false half is
verbatim:

```typescript
// dogfood-cross-os.spec.ts:786-791 -- the sentences that become FALSE
'... This clause is about the RECORD ' +
'existing, never about its VALUE: the count is deliberately not gated because it ' +
'is LAUNDERABLE -- this leg writes through a WRITABLE sidecar, so a broken ' +
'cross-OS restore makes it MISS, execute and SAVE its own entry, and a re-run of ' +
'the same commit then HITs that self-produced entry and takes a `count >= 1` ' +
`check green with cross-OS reuse dead. ${RENAME_NOTE}`,
```

The first half of the same string (`:775-786`, the "@actions/cache bump / dogfood canary catches a
DIFFERENT thing" argument) stays TRUE and must survive.

---

### `.github/workflows/ci.yml` (CI config, 3 near-identical legs)

**Analog:** ITSELF. `build-windows` (482-569) is the TEMPLATE; `typecheck-windows` (571-...) and
`test-windows` (658-...) are verbatim copies differing only in the target name and the log filename.
`ci.yml`'s own convention (recorded in `dogfood-cross-os.spec.ts:896-897`): **only build's copy
carries the extra comments**; the other two carry a one-line form pointing at it.

**Per-leg line map (RESEARCH.md Q5, verified):**

| Leg | Job key | Pre-set step (add knob) | Count step (convert to gate) | Stale comment block |
|---|---|---|---|---|
| `build-windows` | 482 | 497-504 | 563-568 | 548-562 |
| `typecheck-windows` | 571 | 586-593 | 650-655 | 637-649 |
| `test-windows` | 658 | 673-680 | 737-742 | 724-736 |

**TEMPLATE 1 -- the pre-set step (`ci.yml:497-504`), where ONE `echo` line is added:**

```yaml
      # Sidecar dogfood block -- see the build job above.
      - name: Pre-set the Nx cache client vars for the sidecar
        shell: bash
        run: |
          set -euo pipefail
          echo "NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:3000" >> "$GITHUB_ENV"
          token="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
          echo "::add-mask::${token}"
          echo "NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=${token}" >> "$GITHUB_ENV"
```

**TEMPLATE 2 -- the sidecar step (`ci.yml:505-511`), UNCHANGED. The `env:` block is load-bearing:**

```yaml
      - uses: ./start-cache-server
        id: cache-server
        background: true
        with:
          port: '3000'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Without `GITHUB_TOKEN`, `selectBackend` takes the memory-degrade branch BEFORE reaching the knob --
a permanent MISS that would redden the new gate for the wrong reason.

**TEMPLATE 3 -- the readiness poll (`ci.yml:512-528`), UNCHANGED. Contains the `exit 1` at line 527
that makes an `/exit 1/` spec assertion vacuous:**

```yaml
      - name: Wait for the loopback sidecar
        shell: bash
        run: |
          set -euo pipefail
          auth="Authorization: Bearer ${NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN}"
          code=000
          for _ in $(seq 1 30); do
            code=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' -H "${auth}" "${NX_SELF_HOSTED_REMOTE_CACHE_SERVER}/v1/cache/deadbeef" || true)
            if [ "${code}" = "404" ] || [ "${code}" = "200" ]; then
              break
            fi
            sleep 1
          done
          if [ "${code}" != "404" ] && [ "${code}" != "200" ]; then
            echo "sidecar not ready on ${NX_SELF_HOSTED_REMOTE_CACHE_SERVER} after 30 attempts (last status ${code}, wanted 404 or 200)" >&2
            exit 1
          fi
```

**TEMPLATE 4 -- the tee'd run (`ci.yml:543-547`), UNCHANGED. Its rationale comment at `:529-542`
should be VERIFIED line by line, not reflexively rewritten (Assumption A4):**

```yaml
      - name: Run the build target and tee its output
        shell: bash
        run: |
          set -euo pipefail
          npm run build 2>&1 | tee build-nx.log
```

**TEMPLATE 5 -- the count step (`ci.yml:563-568`), the one that becomes a GATE. Keep the pipeline,
keep the printed number, add the comparison:**

```yaml
      - name: Record the remote-cache label occurrence count for this leg
        shell: bash
        run: |
          set -euo pipefail
          count=$({ grep -o -F '[remote cache]' build-nx.log || true; } | wc -l | tr -d '[:space:]')
          echo "remote-cache label occurrences on windows-11-arm (build): ${count} -- RECORDED, never gated"
```

Three things about this block:
- **`|| true` STAYS** (Pitfall 8). Under `set -euo pipefail` a zero-match `grep` exits 1 and aborts
  the step BEFORE the comparison, so the diagnostic never prints. Its current comment at `:561-562`
  already says why; extend that sentence rather than deleting it.
- **The `echo` string is D-06 correction site #4/5/6** and matters MORE than the comments: it is CODE
  (survives the spec's `#` strip) and it is what an operator reads in the job log. A gate that prints
  "RECORDED, never gated" is self-refuting.
- **Use `-lt 1`, not `-eq 0`** (RESEARCH.md Anti-Patterns): `-lt 1` states the FLOOR that D-05 locked.

**D-06 CORRECTION SITE #1 -- the 15-line `build-windows` rationale (`ci.yml:548-562`), verbatim, so
the planner can see exactly which sentences become false:**

```yaml
      # RECORDED, never GATED -- the integration job's policy and its exact pipeline.
      # Gating on a non-zero count would be a LAUNDERABLE gate rather than coverage.
      # This leg writes through a WRITABLE sidecar, so a broken cross-OS restore makes
      # it MISS, execute the target, and SAVE its own entry -- and a re-run of the same
      # commit then HITs that self-produced entry, taking a `count >= 1` check green
      # with cross-OS reuse still dead. A gate a re-run can launder is worse than no
      # gate, because it reads as coverage. The run-scoped, provenance-checked
      # dogfood-verify canary is the gate instead.
      # Note also what does NOT justify leaving this ungated: the `needs:` edge makes
      # this leg INTRA-run -- its ubuntu producer repopulates the entry earlier in the
      # SAME run -- so the cross-run "first run after a version-affecting change
      # legitimately sees a zero" argument, which an earlier version of this comment
      # rested on, never applied to these three legs at all.
      # The `|| true` keeps a legitimate zero printing 0 instead of aborting the
      # pipeline under pipefail.
```

Sites #2 (`:637-649`) and #3 (`:724-736`) are the one-line forms of the same claim on the other two
legs. All three must be corrected in the SAME commit as the gate.

**Comment style to copy for the replacement rationale:** this file's blocks state the SILENT failure
mode first, then the mechanism, then what does NOT justify the choice. The replacement must carry
(a) the inductive soundness sentence, (b) the `needs:`-is-LIVENESS-not-correctness distinction, and
(c) the "what this gate still does not cover" caveat (the legs run the committed PUBLIC bundle;
`action-bundle-drift` is what ties bundle to source).

---

### `docs/configuration.md` (docs, contract reference)

**Analog:** the `CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION` pair -- an EXACT shape match, since it is
also a non-empty-value opt-in with no parsing.

**Table row (line 23) -- the four-column shape:**

```markdown
| `CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION`  | you (optional)                            | Opt-in that lets `CACHE_MIRROR_MAX_AGE_DAYS` go below the 7-day floor               | unset (floor enforced)        |
```

**Resolution section (lines 73-80) -- the `### <KNOB>` shape:**

```markdown
### `CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION`

Set this (to any non-empty value) to deliberately opt in to a retention window
below the 7-day floor. With it set, `resolveMaxAgeDays` accepts a sub-floor
`CACHE_MIRROR_MAX_AGE_DAYS` (still clamped to the 1-day hard minimum and the
365-day ceiling). Leave it unset unless you have a specific reason to prune
aggressively -- the floor exists because a very short window can wipe most of the
mirror on the next cleanup.
```

Conventions: name the resolving function in backticks; state the fallback/unset behaviour explicitly;
say WHY the guard exists. The knob section must also cross-link the selection table, the way
`:92-94` does:

```markdown
That is one of the four backend-selection outcomes; see
[How the backend is selected](advanced.md#how-the-backend-is-selected) for the
full table rather than a binary framing.
```

**Note for the planner:** that sentence at `:92` says "four" and is a DOCS-10 correction site the
research's enumeration does not name explicitly.

---

### `docs/advanced.md` (docs, selection table)

**Analog:** ITSELF, lines 18-34. Both the prose count at `:21` and the table gain the fifth outcome.

```markdown
### How the backend is selected

**The backend is chosen from runtime context -- there is nothing to enable in
code (D-01/TRUST-05).** `selectBackend` has FOUR outcomes, not a binary
read-write-versus-reader switch:

| Context                                                               | Backend                                | Observable behavior                                                                                   |
| --------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Untrusted (a developer machine, a fresh runner, an untrusted trigger) | read-only GitHub Releases **reader**   | reads resolve from the mirror; a `put()` always returns `403`                                         |
| Trusted, but `GITHUB_REPOSITORY` is malformed                         | none -- it **throws**                  | fail-closed: the server does not start, rather than resolve into another repository's cache namespace |
| Trusted, valid identity, but no resolvable token                      | an **empty read-only memory backend**  | **every read is a permanent MISS and every write a `403`, silently -- no error**                      |
| Trusted, valid identity, resolvable token                             | the writable **Actions-cache backend** | full read-write caching                                                                               |
```

The new row is the closest sibling of the LAST row and belongs after it (table order mirrors branch
order in `select-backend.ts`). `memory-backend.ts:58-60` cites this table by name, and
`docs/configuration.md:92-94` links its anchor -- both are correction sites if the count changes.

---

### `docs/versioning.md` (docs, contract enumeration)

**Analog:** ITSELF, lines 18-22 -- an inline prose list inside numbered group 3.

```markdown
3. **Consumer env knobs.** The environment variables an adopter sets:
   `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`,
   `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN`, `PORT`,
   `CACHE_MIRROR_MAX_AGE_DAYS`, `CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION`,
   `GH_TOKEN` / `GITHUB_TOKEN`, and `GITHUB_REPOSITORY`.
```

Pinned by `docs-adoption.spec.ts:82-84` (`it.each(EXPECTED_ENV_KNOBS)` -> `expect(versioning).toContain(knob)`).
Easy to forget -- research's DOCS-10 row names only `configuration.md`.

---

### `.planning/THREAT-MODEL.md` (planning doc, control ledger)

**Analog:** `## Residual notes` bullets, lines 90-103. Add ONE bullet; add NO control row.

```markdown
## Residual notes

Kept here because the criterion for this file is "keep only what has no canonical home", and
these do not have one. Each was probed at claim level against the live tree before the rest of
the record was deleted.

- **Deferred by YAGNI, not designed out.** The one-backend-per-process port defers
  `multiple simultaneous stores` and `synchronous write fan-out` until a real consumer needs
  them. Neither is rejected; both are simply unbuilt.
- **GHES anti-spoofing cross-check (recorded, unbuilt).** ...
```

Bullet shape: `- **<Bold claim + parenthetical status>.** <2-4 sentences of mechanism.>`

---

### `start-cache-server/index.js` (build artifact, generated)

**No analog. Command-driven, and MANDATORY in the same commit.**

- Regenerate: `npm run build:action` (= `node esbuild.action.mjs`).
- Verify: `npm run check:action` (= `build:action && git diff --exit-code -- start-cache-server/index.js`),
  run by the `action-bundle-drift` job at `ci.yml:128` with no `if:`.
- **Run BOTH from the MAIN tree, never a junctioned worktree** -- a junctioned `node_modules` makes
  esbuild rewrite module paths and report hundreds of lines of FALSE drift (recorded project hazard).
- Why it drifts here: `entry.ts` imports `serve()`, `serve.ts:12` imports `selectBackend`,
  `select-backend.ts:1` imports `createActionsCacheBackend`. Both files this phase edits are inlined.

---

## Shared Patterns

### Read-only-ness is an ABSENT method, never a runtime value

**Source:** `packages/github-cache/src/backend/types.ts:1-30`
**Apply to:** the new backend factory, its specs, and any doc sentence describing the new outcome.

```typescript
// types.ts:3-8
// The Nx PUT contract has only two SUCCESS-ish outcomes a writer reports: the entry
// was stored, or an existing entry cannot be overridden (409). The read-only 403
// ("read-only token used to write") is NOT a put() result -- a read-only backend has
// no put at all, and the server produces that 403 at the protocol boundary. So there
// is no 'forbidden' here (it was the workaround the put-less split removes).
export type PutResult = 'stored' | 'conflict';

// types.ts:17-25
export interface ReadableBackend {
  get(hash: Hash): Promise<GetResult>;
}
```

Do NOT reintroduce `'forbidden'`. Do NOT add a `kind` discriminator -- `isWritableBackend`
(`types.ts:46-50`) already exists and `serve.ts:98` already uses it.

### Every factory takes ZERO parameters (TRUST-05)

**Source:** `memory-backend.ts:27-30`, `actions-cache-backend.ts:25-27`, `select-backend.spec.ts:298-305`
**Apply to:** the new read-only factory and the `selectBackend` change.

The sentence to reuse verbatim in the new factory's JSDoc:

```typescript
// memory-backend.ts:27-28
 * RW-vs-RO is which factory the caller constructs the server with, never a
 * caller-facing mode flag (TRUST-05).
```

### Contract changes land as a reviewable diff in an EXPLICIT list, never a snapshot

**Source:** `public-surface.spec.ts:18-23`
**Apply to:** `consumer-contract.ts`, `public-surface.spec.ts`, and any new enumerated guard.

```typescript
// public-surface.spec.ts:18-23
 * Style: explicit-assertion-list, NOT toMatchSnapshot() (the pinned-deps.spec.ts /
 * ppe-action.spec.ts precedent, D-05). An intentional surface change is made by
 * editing the EXPECTED_* lists below, so the contract change lands as an obvious,
 * reviewable diff in THIS file -- preferred over a `.snap` whose `-u` regen is easy
 * to rubber-stamp.
```

The FAILING `public-surface.spec.ts:158-169` assertion IS the intended review artifact. Do not
pre-emptively "fix" it before the knob exists.

### A guard that can pass over a wrong payload is not coverage

**Source:** `dogfood-cross-os.spec.ts:830-840` (positive control), `:886-893` (mutation proof),
`actions-cache-backend.spec.ts:524-525` (never a bare count)
**Apply to:** every new spec clause in this phase.

```typescript
// actions-cache-backend.spec.ts:524-525
// ORDERED, and identities pinned -- never a bare `=== 3`. Source order proves the
// probe is a restoreCache rather than a second saveCache, and a count alone is
// satisfied by a module that DELETED saveCache and added two probes ...
```

Concrete instance for this phase: the `exit 1` at `ci.yml:527` makes `/exit 1/` green before the
phase changes anything. Match the COMPARISON line.

### Verbatim triplication with comments on ONE copy only

**Source:** `ci.yml` (build's copy carries the rationale; typecheck/test carry one-liners pointing at
it) and `dogfood-cross-os.spec.ts:895-897` (which records the convention for the spec side).
**Apply to:** all three Windows legs and their three spec describes.

```typescript
// dogfood-cross-os.spec.ts:895-897
// The same three regexes are repeated verbatim in the typecheck-windows and test-windows
// describes below, without this comment -- the file's existing convention, matching
// ci.yml's own "only build's copy carries extra comments".
```

`ownTarget`'s reason string (`:748-754`) names the failure this convention invites: "a copy-paste
leaving the wrong target behind is the single most likely error in authoring them". Convert all
three, and check each leg's log filename (`build-nx.log` / `typecheck-nx.log` / `test-nx.log`).

### Correct EVERY copy of a stale claim in the SAME commit

**Source:** CONTEXT.md D-06; four prior instances on this branch (`fd75d83`, `7e777b3`, `9e949e4`,
quick task `260801-vyy`).
**Apply to:** all SEVEN sites (RESEARCH.md Q6 table) -- three `ci.yml` comment blocks (548-562,
637-649, 724-736), three `ci.yml` `echo` strings (568, 655, 742), one spec reason string
(`dogfood-cross-os.spec.ts:774-791`). Plus the two DOCS-10 count sites (`advanced.md:21`,
`configuration.md:92`).

Sweep command after the edits:
`git grep -n "RECORDED, never gated" -- .github packages` and
`git grep -n "WRITABLE sidecar" -- .github packages` must both return nothing.

### Path resolution in specs: `import.meta.url`, never `__dirname` / `process.cwd()`

**Source:** `dogfood-cross-os.spec.ts:24-27`, `public-surface.spec.ts:77-79`, `docs-adoption.spec.ts:22-30`
**Apply to:** the new VER-09 package-scope scan.

```typescript
// public-surface.spec.ts:77-79
function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}
```

Prefer the existing `packages/github-cache/src/test/workspace-root-cwd.ts` helper over a new
workspace-root idiom.

### Nx-input coupling: a from-disk pin needs its subject declared as a `test` input

**Source:** `dogfood-cross-os.spec.ts:44-47`
**Apply to:** any new from-disk assertion.

```typescript
 * This spec depends on `{workspaceRoot}/.github/workflows/ci.yml` being in
 * `nx.json`'s `targetDefaults.test.inputs` (PARITY-08, plan 09-01).
 * Without it, `ci.yml` is not a hashed input and this spec replays a cached PASS
 * computed before its subject existed.
```

`ci.yml`, `docs/configuration.md` and `docs/advanced.md` are ALREADY declared `test` inputs
(`nx.json:70,62,64`). **`nx.json` must not be edited** -- CONTEXT.md OUT OF SCOPE bans anything that
rotates a task hash beyond the source edits themselves.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | Every file in this phase has an in-repo analog, most of them in the file being modified. |

**Closest thing to a gap:** the VER-09 package-scope `@actions/cache` importer scan has no existing
package-scope source-glob guard to copy. The nearest idioms are the FILE-scoped scans
(`actions-cache-backend.spec.ts:499-543`, and the same idiom in `cache-archive-path.spec.ts`,
`lint-scope-drift.spec.ts`, `cleanup-workflow.spec.ts`, `ppe-action.spec.ts`). Widening to a glob is
new; keep the assertion shape (exact array, not a count) and reuse
`src/test/workspace-root-cwd.ts` for path resolution.

---

## Metadata

**Analog search scope:**
`packages/github-cache/src/backend/`, `packages/github-cache/src/lib/`,
`packages/github-cache/src/test/`, `packages/github-cache/src/*.spec.ts`,
`.github/workflows/ci.yml`, `docs/`, `.planning/`

**Files scanned:** 18 read (14 targets + 4 pure-analog: `memory-backend.ts`, `types.ts`, `trust.ts`,
`retention.ts`, `serve.ts`)

**Search tooling:** `git grep` for tracked files; `Read` with `offset`/`limit` for `ci.yml` (2185
lines), `dogfood-cross-os.spec.ts` (1220), `actions-cache-backend.spec.ts` (656). No `grep`, no
`| grep`.

**Pattern extraction date:** 2026-08-02
