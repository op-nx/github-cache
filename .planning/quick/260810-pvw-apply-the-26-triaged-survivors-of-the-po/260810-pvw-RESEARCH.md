# Quick Task 260810-pvw: Anchor research for P1..P26

**Researched:** 2026-08-10
**Mode:** quick-task, anchor resolution only (NOT a domain survey)
**Tree:** branch `gsd/v0.0.2-os-invariant-cross-os-sharing`, HEAD `2f75c68`, working tree clean
**Method:** `git grep -n` / `awk` over tracked files only. Every line number below was read from
the tree at `2f75c68`. Every anchor carries a verbatim excerpt because line numbers drift and the
excerpt does not.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Commit granularity.** One commit per ACCEPT GROUP, five commits: vacuous assertions (P1-P7),
  aliases and one-call-site indirection (P8-P11), real duplication (P12-P22), the docs-gate triple
  assertion (P23), prose corrections (P24-P26).
- **Execution tree -- MAIN TREE, not a worktree.** `check:action`'s verdict is only trustworthy in
  the main tree (a junctioned `node_modules` makes esbuild rewrite ~689 module paths with no source
  edit). One plan, one executor, so worktree isolation buys nothing.
- **`faultSuffix` placement (P13).** New export in the EXISTING `lib/octokit-fault-reason.ts`. Do
  not create a new `lib/` leaf.
- **`nonSpecModules` placement (P12).** Move into `src/test/repo-file.ts` beside
  `packageSourceFiles`, following the landed `260810-kuo` A6 precedent.
- **P22 sweep scope.** Apply to ALL THREE sibling spec files in one pass.
- **Guard discipline (non-negotiable).** No guard is weakened. A guard that reddens gets the CODE
  changed, not the assertion deleted. Any NEW "X subsumes this assertion" argument surfacing during
  execution must be settled by RUNNING THE MUTATION before acting (the A12 precedent).

### Claude's Discretion

Exact wording of the three prose corrections (P24-P26), provided each states the MEASURED fact and
does not delete the correction history around it.

### Deferred Ideas (OUT OF SCOPE)

The 7 REJECTs (VER-05, trust-boundary input validation, D2-01's `integration` discriminator,
D2-03's comment locks, quick `260803-fcd`'s burned-tag skip, M3, DEC-1, T4-5) and the 13 DEFERs
(U2, U5, U6, U8, T4-3, N1, N2). `.planning/`, `package-lock.json`, and the generated
`start-cache-server/index.js` are out of scope.
</user_constraints>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- GSD workflow gates all file-changing tools. This research pass is read-only and made no edits.
- Never `git add .` / `-A` / `-u`; stage files by name.
- ASCII only in all output. No emojis, no em dashes.
- Prefer `git grep` for tracked files; `rg` only for gitignored/untracked paths; never `grep`.
- Nx tasks run through `npm exec nx ...`, never the underlying tooling directly.
- Capture the acceptance battery through `tee` with `${PIPESTATUS[0]}` into a variable -- Nx caches
  terminal output for SUCCESSFUL runs only, so a re-run destroys a failing run's evidence.

---

## The 26 anchors

`serve?` column: does the edit touch a file in the `serve()` import graph (the set the consumer
bundle `start-cache-server/index.js` is generated from). See "serve() reachability" below.

All paths are relative to `packages/github-cache/` unless prefixed otherwise.

| # | file | anchor (line + verbatim excerpt) | found | serve? | blast radius |
|---|------|----------------------------------|-------|--------|--------------|
| P1 | `src/action/index.spec.ts` | `:610` `.split('/').at(-1)).not.toBe(RUN_ID)` | CONFIRMED | no | doc block `:574-576` describes BOTH assertions ("on the WHOLE url and on the final PATH SEGMENT") -- must be reworded |
| P2 | `src/lint-rules.spec.ts` | `:899` `expect(CORR_05_SITES).toEqual([])` | CONFIRMED | no | it is the ONLY `it` in its describe: deleting it deletes `:857-901` AND orphans `const CORR_05_SITES` `:855`. See notes -- the comment argues retention |
| P3 | `src/publish/publish-mirror.spec.ts` | `:1471-1485` `it('the partial TARGET RATE is one half` / `.toBe(0.5)` | CONFIRMED | no | import `PARTIAL_READ_MISS_WARN_RATIO` at `:15` becomes unused |
| P4 | `src/backend/actions-cache-backend.spec.ts` | `:368` `expect('put' in backend).toBe(false)` (paired with `:367`) | CONFIRMED | no | 3 sibling files carry the identical pair and are NOT named by the ledger; doc block `:350-353` cites `'put' in backend` in prose (stays true) |
| P5 | `src/hash-parity/compare.spec.ts` | `:662`, `:682`, `:698` -- `INVARIANT_TARGETS deep-equals`, `REQUIRED_META_KEYS deep-equals`, `LIKE_FOR_LIKE_META_KEYS is the THREE` | AMBIGUOUS | no | `:698` carries a RELATIONAL second half (`arrayContaining`) that is not a literal restatement; imports `:32-34` go unused if all three drop |
| P6 | `src/lib/release-asset-name.spec.ts` | `:320-326` `it('pins the both-true count across the whole table to ZERO` | CONFIRMED | no | comment `:305-307` cross-references it by name ("the same reason the both-true total below is a COUNT") -- must be reworded |
| P7 | `src/lib/octokit-fault-reason.spec.ts` | -- no `timeout` token anywhere in the file | **NOT-FOUND** | no | see notes: the only "no timeout" test in the repo is `src/lib/compression-method.spec.ts:209`, and its comment ARGUES retention |
| P8 | `src/lib/compression-method.spec.ts` | `:279` `const strippedSourceOf = stripLineComments;` | CONFIRMED | no | 3 call sites in-file: `:281`, `:320`, `:336`. P14 removes `:320` and `:336`, so sequence P14 -> P8 |
| P9 | `src/public-surface.spec.ts` (NOT `docs-*.spec.ts`) | `:83-85` `function readSource(relativePath: string) { return readRepoFile(relativePath); }` | CONFIRMED | no | 3 call sites `:152`, `:160`, `:202`; comment `:61-64` and the whole block `:78-82` name `readSource` and must go/reword |
| P10 | `src/lib/select-backend.spec.ts` (NOT `actions-cache-backend.spec.ts`) | `:436-439` `function widened(withoutKnob: SelectOutcome, withKnob: SelectOutcome)` | CONFIRMED | no | ONE call site `:515`; comments `:510-514` and `:537` name `widened()` -- `:537` must be reworded. See hazard note |
| P11 | `src/backend/types.ts` | `:66` `readonly put?: never;` | CONFIRMED | **YES** | explanation lines `:58-59` ("`readonly` is documentation, not the mechanism") go with it. Type-only edit -- emitted JS unchanged |
| P12 | `src/backend/actions-cache-backend.spec.ts` `:784-788` + `src/lib/cache-key.spec.ts` `:100-104` | both `function nonSpecModules(): string[] {` | CONFIRMED | no | **NOT byte-identical** -- see notes. Call sites: acb `:840`, `:880`, `:904`; cache-key `:165`. Destination `src/test/repo-file.ts` beside `packageSourceFiles` `:135` |
| P13 | `src/cleanup/cleanup.ts` `:164`, `src/publish/publish-mirror.ts` `:424` and `:1087` | `(status ${statusOf(error) ?? 'unknown'}, code ${reason.code ?? 'unknown'}, message ` | CONFIRMED | no | `:424` is NOT identical (`burnedTagMessage ?? reason.message ?? 'unknown'`). New export lands in `src/lib/octokit-fault-reason.ts`. Message-string assertions in both specs |
| P14 | `src/lib/cache-archive-path.spec.ts` `:167-197` + `src/lib/compression-method.spec.ts` `:308-338` | `'%s fires on a fixture carrying the token in CODE` / `'%s stays silent when EVERY occurrence is a comment` | CONFIRMED | no | KEEP the first clause of each triad (`matches its own derived probe token`, `:163` / `:301`). Owner is `src/test/repo-file.spec.ts:45-73` (exact) |
| P15 | `src/lib/cache-key.spec.ts` `:116-127`, `src/lib/mirror-seed.spec.ts` `:144-155`, `src/lib/cache-archive-path.spec.ts` `:144-156` | `it('is a true leaf: imports nothing from` (x2) / `it('has one import statement and it is the type-only Hash` | AMBIGUOUS | no | only 2 of the 3 share a shape; the 3rd is a strictly STRONGER exact-import-list equality. See notes |
| P16 | `src/public-surface.spec.ts` | `:166-179` `it('the package value-export set is exactly the D-04 group-c contract list` + the type-export sibling | CONFIRMED | no | KEEP `:181-193` (env knobs, DOCS-10). `src/test/consumer-contract.ts:10-14` records the retention argument for group (c) and must be corrected |
| P17 | `src/backend/actions-cache-backend.spec.ts` | `:416-427` `it('returns a miss from either factory when restoreCache resolves undefined (VER-08)'` | CONFIRMED | no | sibling arg-array test `:390-414` stays and is the real claim; `:163` keeps the writable-factory miss |
| P18 | `src/backend/actions-cache-backend.spec.ts` | `:966`, `:974` (writable) and `:1014`, `:1021` (read-only) -- `it('THROWS ... (VER-04 conjunct` | AMBIGUOUS | no | composition CONFIRMED at `src/backend/actions-cache-backend.ts:286` `...createReadOnlyActionsCacheBackend()`. Which pair to drop is undecided -- two in-code blocks argue the read-only pair matters MORE |
| P19 | `src/cleanup/cleanup.spec.ts` | `:212-236` census block, `:223-226` `const CENSUS_TAR_GZ = 50;`, loops `:263-284`, arithmetic `:318-322` | CONFIRMED | no | the census is a MEASURED record citing `10-EVIDENCE-PRE-RENAME.md`. Shrinking it rewrites four coupled regions. See notes |
| P20 | `src/read-integration-hash.integration.spec.ts` (NOT `compare.spec.ts`) | `:140-153` `let acceptedResult` / `const acceptedRun = () => (acceptedResult ??= read(ACCEPTED));` | CONFIRMED | no | 2 call sites `:157`, `:173`. **This is an `integration` spec** -- see the D2-01 hazard note |
| P21 | `src/hash-parity/compare.spec.ts` | `:194-195` `expect(detail).toContain('upload');` / `('download')` | CONFIRMED | no | leaves `:193` `toContain('if-no-files-found')` as the sole assertion of that `it` |
| P22 | `src/serve.spec.ts` `:45-53`, `src/lib/select-backend.spec.ts` `:85-93`, `src/backend/actions-cache-backend.spec.ts` `:117-125` | `let restoreCwd: () => void;` + `beforeAll` + `afterAll` | CONFIRMED | no | `afterAll` import goes unused in serve (`:6`) and select-backend (`:7`); actions-cache-backend KEEPS it (second `afterAll` at `:943`) |
| P23 | `src/docs-same-os-claims.spec.ts` | table row `:494-530` (`:523` phrase), per-block parser `:796-853`, occurrence count `:834` | AMBIGUOUS | no | `:783-787` argues to keep all three AND states that removing row A "would force a rewrite of the header's five-row Phase 11 arithmetic". This is the N1 file |
| P24 | `src/lib/mirror-seed.spec.ts` | `:33-36` `a hardcoded 0/1/2 mapping satisfies every literal in this file and fails only there` | CONFIRMED | no | zero -- prose only. The cited `:59` and `:66` are exact at HEAD |
| P25 | `src/hash-parity/compare.spec.ts` | `:837-841` `invisible to every other gate in the battery -- it typechecks, it lints` | CONFIRMED | no | zero -- it is a failure-message string literal; the matcher at `:842` is untouched |
| P26 | `src/test/repo-file.ts` `:74-76` (ledger says `:52-55` -- WRONG) | `alone is read at four sites across four files` | CONFIRMED | no | `:52-55` is a DIFFERENT docstring (`REPO_FILE_CACHE` writer-disjointness). The "three specs loop over every package module" clause at `:75` is false the same way |

---

## Per-item notes (only where more than one line is needed)

### P1 -- `action/index.spec.ts:610`

The `it.each` at `:592-618` is what holds it. The deletion is one line, but the describe's doc block
at `:574-576` reads:

> The assertion is on the WHOLE url and on the final PATH SEGMENT, never `toContain(RUN_ID)`

Deleting `:610` removes the "final PATH SEGMENT" half. The prose must be corrected in the same
commit, or the file ships a comment describing an assertion that is gone. CONTEXT.md's corrected
rationale (redundant because `mirror-seed.spec.ts` catches the identity mutation five ways off
hand-authored literals at `:59`, `:66`, `:82`, `:101`) should be what the corrected prose records --
NOT "can never fail", which M1 falsified.

Verified at HEAD: `mirror-seed.spec.ts:59` is the pinned-literal assertion inside the `it.each` at
`:56-61`, and `:66` is the tuple-derived assertion inside the `it.each` at `:63-70`. Both citations
are exact.

### P2 -- HAZARD: the assertion's own comment argues its retention

`CORR_05_SITES` is `[] as const` at `:855`, so `:899` is literally `expect([]).toEqual([])`. The
ledger's premise ("its own comment concedes it cannot catch a reintroduced violation") is TRUE and
is stated at `:884-885`. But the SAME comment block states the assertion's actual job at
`:864-868` and `:896-897`:

> an enumeration over an EMPTY array emits ZERO tests, SILENTLY. So at the exact moment CORR-05
> became true, everything this describe contributed would have dropped to nothing with no signal
> whatsoever [...] This assertion's job is narrower and still worth its line: it is what keeps the
> emptied table from becoming a describe that silently emits ZERO tests.

That is a recorded in-code decision -- triage authority #3 ("an argued retention is not dead code").
The A12 precedent is that exactly this reasoning class was reversed once already. Deleting `:899`
also deletes the entire `describe` `:857-901` (it is the only `it`) and orphans `:855`, and the
historical doc block above `:855` explicitly says it must survive its rows.

**Recommendation for the planner:** do not treat P2 as mechanical. Either (a) keep the assertion and
record the conflict, or (b) delete it only after MEASURING that no other clause reports the
zero-test cliff -- and note there is nothing to mutate here, because an empty array is unmutatable.
`readFileSync` is already gone from the file (only the `:1` comment references it), so there is no
import to clean up.

### P4 -- three unnamed siblings

The `'put' in backend` / `isWritableBackend(backend)` pair also appears at:

- `src/backend/memory-backend.spec.ts:55-56`
- `src/backend/releases-backend.spec.ts:178-179`
- `src/cleanup/cleanup.spec.ts:472-473`

The ledger names only `actions-cache-backend.spec.ts`. Scope says P1..P26 only, so the executor
should touch only the named site -- but the finding's own mechanism ("the latter is DEFINED as the
former", `backend/types.ts:86` `return 'put' in backend;`) applies identically to all four. Flag for
the maintainer; do not silently sweep.

### P5 -- AMBIGUOUS: which three, and one has a relational half

The describe at `:616` holds five tests. `:653` was already fixed (it now reads the instrument's
source). The remaining literal-restating candidates are:

| line | test | pure literal restatement? |
|------|------|---------------------------|
| `:662` | `INVARIANT_TARGETS deep-equals the four` | yes -- and `:671-680` already asserts the partition relationally |
| `:671` | `partitions EXPECTED_TARGETS exactly` | NO -- relational, keep |
| `:682` | `REQUIRED_META_KEYS deep-equals the seven` | yes |
| `:698` | `LIKE_FOR_LIKE_META_KEYS is the THREE ... and a SUBSET of the seven` | HALF -- `:706-710` is a literal pin, `:711-713` is a SUBSET assertion whose comment at `:701-705` argues it catches a clause that cannot fail |

So "3 constant-pin tests" most plausibly means `:662`, `:682`, and the literal HALF of `:698`. Delete
`:698` whole and the subset guard goes with it -- that is a guard weakening under the locked
discipline. Recommend: drop `:662` and `:682` entirely, and drop only `:706-710` from `:698`,
renaming that test.

Import cleanup: after that, `INVARIANT_TARGETS` is still used (`:409`, `:676`, `:679`),
`REQUIRED_META_KEYS` still used (`:711`), `LIKE_FOR_LIKE_META_KEYS` still used (`:217`, `:712`). No
import drops.

### P7 -- NOT-FOUND, and the near-miss is protected by authority #3

`src/lib/octokit-fault-reason.spec.ts` contains **zero** occurrences of the token `timeout`
(verified by `git grep -n -i "timeout"` over that path, and by reading all 317 lines: the file has
four describes covering `faultReason`, `hasFaultCode`, `hasOnlyFaultCode`, `faultMessageForField`,
and no test concedes subsumption).

The only "no timeout" test in the package is:

```
src/lib/compression-method.spec.ts:209
  it('passes NO timeout, which is the considered value rather than an omission (D-15)', ...)
```

Its comment at `:219-225` DOES concede subsumption -- "The whole-object equality above already
subsumes this assertion today" -- and then immediately argues retention:

> It is kept anyway, and it is not redundant: the moment a future contributor relaxes that assertion
> to `toMatchObject` to admit some legitimate new option, this is the only surviving guard -- and it
> names the timeout in its failure message [...] An asserted omission is how a deliberate decision
> stops being indistinguishable from an oversight.

That is a recorded in-code decision under triage authority #3, which outranks the finding. It is
also the A12 shape verbatim (delete an assertion on a "X subsumes it" argument).

**Do NOT substitute this site for P7.** Report P7 as NOT-FOUND and let the maintainer decide. If the
executor is told to proceed anyway, the locked discipline requires MEASURING the mutation first
(relax `:202-206` to `toMatchObject` and confirm `:232` is the only clause that reddens).

### P9 -- relocated to `public-surface.spec.ts`

No `docs-*.spec.ts` file defines or calls `readSource`. The real site is:

```
src/public-surface.spec.ts:83
function readSource(relativePath: string): string {
  return readRepoFile(relativePath);
}
```

Pure alias, confirmed. Three call sites (`:152`, `:160`, `:202`) rename to `readRepoFile`. Two prose
regions name it: `:61-64` ("REPO-RELATIVE, because `readSource` now goes through `readRepoFile`") and
the whole comment `:78-82` ("THROUGH `readRepoFile`, not a second copy of its body"), which exists
solely to justify the alias and should go with it.

### P10 -- relocated to `select-backend.spec.ts`, and inlining risks a vacuous form

`actions-cache-backend.spec.ts` contains no `widened` symbol. The real site:

```
src/lib/select-backend.spec.ts:436-439
/** The single forbidden transition: a non-writable outcome becoming writable. */
function widened(withoutKnob: SelectOutcome, withKnob: SelectOutcome): boolean {
  return withKnob === 'writable' && withoutKnob !== 'writable';
}
```

One call site at `:515`. HAZARD: the comment directly above that call (`:510-514`) is a warning
about exactly this class of edit --

> The implication `writable(withKnob) => writable(withoutKnob)`, asserted by negating the QUANTIFIER
> ("no row widened") rather than a predicate. An `if (withKnob === 'writable')` guard around the
> assertion would be the vacuous form [...] so would a negated matcher inside a single call
> assertion, which this repo has shipped before.

The correct inline is `expect(withKnob === 'writable' && withoutKnob !== 'writable').toBe(false);`
-- boolean-identical, still non-vacuous. Anything that moves the condition into an `if` or into a
`.not.` matcher is a regression the repo has already paid for. The comment at `:537` also names
`widened()` in prose and must be reworded.

### P11 -- the ONE serve()-reachable edit

`src/backend/types.ts` is imported by `serve.ts:9` and `server/server.ts:9`, and the string
`packages/github-cache/src/backend/types.ts` appears in the generated bundle. The ledger's blanket
claim that no P-item touches a `serve()`-reachable source is **FALSE for P11**.

The mitigating fact: `readonly` on `put?: never` inside an `interface` is type-only. Interfaces emit
nothing, so the emitted bundle should be byte-unchanged. The file's own docstring says the same at
`:58-59`: "`readonly` is documentation, not the mechanism: it contributes nothing to assignability."

`ReadOnlyBackend` is INTERNAL (`:61-63`: deliberately not re-exported from `src/index.ts`; D2-02
forbids new package exports this milestone; `public-surface.spec.ts` asserts over the barrel alone),
so no public-surface guard sees this change.

**Required:** run `check:action` in the MAIN TREE after this commit and confirm zero drift. Do not
rely on the ledger's blanket claim.

### P12 -- the "byte-identical" premise is FALSE

```
src/lib/cache-key.spec.ts:100-104              src/backend/actions-cache-backend.spec.ts:784-788
function nonSpecModules(): string[] {          function nonSpecModules(): string[] {
  return packageSourceFiles(                     return packageSourceFiles(
    (f) => f.endsWith('.ts')                       (f) => f.endsWith('.ts')
        && !f.endsWith('.spec.ts'),                    && !f.endsWith('.spec.ts'),
  );                                             ).map((file) => `${PACKAGE_SOURCE_ROOT}/${file}`);
}                                              }
```

The `actions-cache-backend` copy PREFIXES; the `cache-key` copy returns BARE paths. They are not
byte-identical and never were. `src/test/repo-file.ts:126-128` already prescribes the resolution:

> BARE paths, not prefixed with the root. Two of the three callers want them bare; the one that
> asserts on prefixed literals re-prefixes at its own call site, which is a smaller and clearer
> contract than an options bag.

So the shared `nonSpecModules` returns BARE, and `actions-cache-backend.spec.ts` re-prefixes at its
three call sites (`:840`, `:880`, `:904`). `cache-key.spec.ts:165` needs no change beyond the import.
`cache-key.spec.ts:133` names the shape in prose ("The walk is the same `nonSpecModules()` shape
`actions-cache-backend.spec.ts` uses") and should be updated to name the shared helper.

`PACKAGE_SOURCE_ROOT` already lives in `src/test/repo-file.ts:108`, so no new constant is needed.

### P13 -- three renderings, but only two are identical

| site | expression |
|------|-----------|
| `src/cleanup/cleanup.ts:164` | `(status ${statusOf(error) ?? 'unknown'}, code ${reason.code ?? 'unknown'}, message ${reason.message ?? 'unknown'})` |
| `src/publish/publish-mirror.ts:1087` | identical to the above |
| `src/publish/publish-mirror.ts:424` | `... message ${burnedTagMessage ?? reason.message ?? 'unknown'}` -- **extra fallback** |

A zero-argument `faultSuffix(error): string` covers two of three. `:424` needs either an optional
message override (`faultSuffix(error, { message: burnedTagMessage })`) or to stay hand-authored.
Recommend the override -- it keeps all three on one renderer and the parameter is visible.

`src/publish/publish-mirror.ts:360` is a status-only rendering, not part of this class; leave it.

`faultReason` call sites confirmed at `cleanup.ts:160`, `publish-mirror.ts:341` (feeds `:424`), and
`publish-mirror.ts:1018` (feeds `:1087`). None branches on the result -- the ledger's "ZERO branching
callers" claim holds.

`src/lib/octokit-fault-reason.ts` is NOT in the serve() bundle (`rg -c "octokit-fault-reason"` and
`rg -c "faultReason"` both return 0 against `start-cache-server/index.js`), so the new export is
bundle-safe.

Blast radius: both spec files assert on these message strings. Search for the literals `status `,
`, code `, `, message ` in `cleanup.spec.ts` and `publish-mirror.spec.ts` before editing.

### P14 -- the count checks out, and the "MANDATORY" control survives

Each scan site has a THREE-clause triad:

| clause | cache-archive-path.spec.ts | compression-method.spec.ts | what it proves |
|--------|---------------------------|----------------------------|----------------|
| 1 | `:163-165` | `:301-306` | the needle matches its own derived probe token -- KEEP, this is the "MANDATORY non-vacuity control" |
| 2 | `:167-181` | `:308-322` | `stripLineComments` FIRES on code -- DELETE, owned by `repo-file.spec.ts:46-48` |
| 3 | `:183-197` | `:324-338` | `stripLineComments` stays SILENT on comments -- DELETE, owned by `repo-file.spec.ts:50-52` |

Generated-case arithmetic confirms the ledger: `FORBIDDEN` has 14 needles, `FORBIDDEN_RESULT_MEMBERS`
has 2, so clauses 2 and 3 generate `(14 + 2) * 2 = 32` cases. Exactly the "32 generated cases" the
ledger names.

Owner confirmed exact: `src/test/repo-file.spec.ts:45-73` is the
`describe('stripLineComments keeps code and drops comments (T2-5)')` block, whose first two `it`s
carry the same names ("FIRES on a fixture carrying the token in CODE, even with the token also in
comments" / "stays SILENT when every occurrence is a comment -- the strip is real, not blind").

The "MANDATORY non-vacuity control" prose at `cache-archive-path.spec.ts:159-162` and
`compression-method.spec.ts:298-300` refers to clause 1, which survives. No prose correction needed,
but both describe TITLES ("the scanner FIRES on a fixture carrying the forbidden shape") should be
re-read after the cut.

Ordering: P14 removes two of the three `strippedSourceOf(fixture)` call sites in
`compression-method.spec.ts`. Apply P14 before P8 so P8's rename touches only `:281`.

### P15 -- AMBIGUOUS: only two of the three share a shape

| file | shape |
|------|-------|
| `src/lib/cache-key.spec.ts:116-127` | `readFileSync(new URL(...))` + four `expect(source).not.toMatch(/from '...`/)` |
| `src/lib/mirror-seed.spec.ts:144-155` | identical shape, FIVE `not.toMatch` (adds `../action`) |
| `src/lib/cache-archive-path.spec.ts:144-156` | `strippedSubject.match(/import[^;]*;/g)` then `toEqual(["import type { Hash } from './cache-key.js';"])` |

The third is a strictly STRONGER assertion, and its own comment at `:145-148` says why:

> Equality, NOT a not.toContain: an exact import list fails on a builder reached through a module the
> FORBIDDEN list never anticipated

Consolidating all three onto the `not.toMatch` shape WEAKENS `cache-archive-path.spec.ts` -- a guard
weakening under the locked discipline. The defensible reading of P15 is: unify only the two
`not.toMatch` copies into one shared helper taking the forbidden-prefix list as a parameter (the
`packageSourceFiles(predicate)` precedent), and leave `cache-archive-path.spec.ts` alone.

`actions-cache-backend.spec.ts:738` also does an import scan, but the claim is different (counting
`@actions/cache` imports for VER-03), not a leaf scan. Out of scope.

### P16 -- the two export self-checks, and the contract file's own retention argument

Delete `:166-168` and `:170-179`. KEEP `:181-193` (the env-knob pin) and `:195-198`
(`MAX_CACHE_BODY_BYTES`).

`src/test/consumer-contract.ts:10-14` records the retention argument for BOTH groups:

> public-surface.spec.ts asserts them for EXACT equality against the parsed barrel, and pins each
> against an inline sorted literal for the same reviewable-diff reason.

The finding's counter is that group (c) already has the barrel equality at `:146` and `:155`, so the
inline pin is the third copy of the same list; group (a) has no barrel to compare against, which is
why DOCS-10 mandates its pin. That reasoning must be written INTO `consumer-contract.ts:10-14` in
the same commit, or the file ships a docstring describing a pin that no longer exists. Same for
`public-surface.spec.ts:44` and `:53`.

### P18 -- AMBIGUOUS: which two of four

Composition CONFIRMED at `src/backend/actions-cache-backend.ts:286`:

```
export function createActionsCacheBackend(): CacheBackend {
  return {
    ...createReadOnlyActionsCacheBackend(),
```

and `:54-55` states it in prose. So all four throw tests exercise one construction guard. The four:

| line | factory | conjunct |
|------|---------|----------|
| `:966` | writable | 1 (`nx.json`) |
| `:974` | writable | 2 (`GITHUB_WORKSPACE`) |
| `:1014` | read-only | 1 |
| `:1021` | read-only | 2 |

TWO in-code blocks argue the READ-ONLY pair is the load-bearing one: `:864-868` ("Both VER-04 throws
come from the READ-ONLY factory, which the write path reaches BY CALLING") and `:1005-1009` ("They
matter MORE on the read-only path than on the writable one"). So the writable pair (`:966`, `:974`)
is the defensible cut -- but the ledger does not say which, VER-04 is a named requirement, and the
locked discipline forbids acting on a subsumption argument without measuring it.

**Recommendation:** measure before cutting. Break each conjunct in `actions-cache-backend.ts` one at
a time and record which of the four reddens. If all four redden on both mutations, the pair choice is
free and the writable pair goes. If any of the four uniquely catches something, it stays.

### P19 -- the fixture is a MEASURED record, not an invented one

`:212-218` records provenance: shard `cache-mirror-202607`, release id 354838660, read live
2026-07-29, recorded in `10-EVIDENCE-PRE-RENAME.md`. `:220-222` states the design intent:

> These are real numbers, so the fixture below models a shard that actually exists rather than one
> invented to suit the filter

Shrinking 122 -> 7 rows means editing four coupled regions in step: the census comment `:212-222`,
the constants `:223-226`, the three generation loops `:263-284`, and the arithmetic locks
`:318-322`. The ledger's mechanism claim ("identical branch coverage for a stateless per-asset
predicate") is sound -- the predicate has no state and every family is exercised by row 1 -- but the
edit trades a measured record for a synthetic one.

If applied: keep the census NUMBERS as the recorded measurement in the comment and reduce only the
GENERATED counts, so the evidence link survives. Do not delete `:318` -- re-point it at whatever
the new constants are, or the fixture-shape lock the comment at `:314-317` argues for is gone.

### P20 -- relocated, and it lands inside the `integration` target

`compare.spec.ts` contains no `let` at all. The memo is:

```
src/read-integration-hash.integration.spec.ts:152-153
let acceptedResult: ReturnType<typeof read> | undefined;
const acceptedRun = () => (acceptedResult ??= read(ACCEPTED));
```

with a 12-line rationale at `:140-151`. Two call sites: `:157` and `:173`. The file spawns `read()`
eight further times (`:179`, `:194`, `:209`, `:221`, `:246`, `:273`, plus two more in the tail),
which supports the ledger's "a suite that pays it eleven other times silently".

**HAZARD (D2-01).** This is an `*.integration.spec.ts` file. The TRIAGE itself REJECTED a sibling
item on exactly this ground:

> Delete `release-asset-name.integration.spec.ts` + its matrix leg | The `integration` target is this
> milestone's SOLE OS discriminator (D2-01); touching it has task-hash consequences

Editing this file rotates the `integration` task hash on both legs. That is not fatal (the whole
point of `integration` is that its hash DIVERGES across OS), but it is a deliberate cache
invalidation on the one target the cross-OS proof rides on, for a saving of one 0.33 s subprocess.

**Also:** the memo's docstring at `:145-150` records a MEASURED constraint --

> Vitest evaluates describe bodies at COLLECTION time, so a bare `const accepted = read(ACCEPTED);`
> inside the describe would move a `spawnSync` into collection -- where a failure surfaces as a
> COLLECTION ERROR rather than as a test failure

so the ONLY compliant collapse is inlining `read(ACCEPTED)` into each of the two tests. A
describe-scope `const` is forbidden by a measured fact.

**Recommendation:** surface P20 to the maintainer as a D2-01 question before executing. The saving
does not obviously justify rotating the discriminator's hash.

### P22 -- confirmed mechanical, with one asymmetry

vitest **4.1.10** confirmed installed (`node -p "require('./node_modules/vitest/package.json').version"`).
`enterWorkspaceRootCwd()` returns its teardown closure (`src/test/workspace-root-cwd.ts:106`,
`return () => {` at `:120`), so `beforeAll(() => enterWorkspaceRootCwd())` is the whole collapse.

| file | hook block | `afterAll` import | after the edit |
|------|-----------|-------------------|----------------|
| `src/serve.spec.ts` | `:45-53` | `:6` | import DROPS (only use was `:51`) |
| `src/lib/select-backend.spec.ts` | `:85-93` | `:7` | import DROPS (only use was `:91`) |
| `src/backend/actions-cache-backend.spec.ts` | `:117-125` | `:13` | import STAYS -- second `afterAll` at `:943` |

`src/capture-hashes-cli.spec.ts:179-191` has the same idiom but describe-scoped and interleaved with
`fixtureRoot`/`fixtureAbsolute` setup. It is the "2 siblings" the ledger does NOT name; CONTEXT.md
fixes the sweep at three files. Leave it.

Prose that survives unchanged if all three are edited together: `serve.spec.ts:42-44` ("same shape in
all three files") and `select-backend.spec.ts:82-84` ("an ASYMMETRICAL hook in THIS file [...] would
be the most visible possible inconsistency"). Editing fewer than three falsifies both.

### P23 -- AMBIGUOUS, and it is the N1 file

Row A is asserted three ways:

1. **Table row** in `DOCS_08_SITES` (`:494-530`, required phrase at `:523`), driven generically by
   the loop at `:722-748` using `toContain`.
2. **Bespoke per-block parser**: `describe` at `:796`, `ROW_A_PHRASES` at `:797-800`, job-key
   existence check at `:806-816`, per-block clause at `:846-853` built from
   `['hash-parity', 'hash-parity-compare'].map(...)` at `:835`.
3. **Whole-file occurrence count** at `:834`, `ROW_A_PHRASES.flatMap(...)`.

The file states the subsumption at `:783` -- but in a sentence that argues the OPPOSITE conclusion:

> KEPT ALONGSIDE row A rather than replacing it. The clauses subsume the containment, but the
> failures say different things [...] Removing row A from the table would also force a rewrite of the
> header's five-row Phase 11 arithmetic for no gain.

Two independent hazards:

- **Authority #3.** That paragraph is a recorded in-code decision to keep all three.
- **N1 / DEFER overlap.** `docs-same-os-claims.spec.ts` is the file the TRIAGE defers as N1 with
  "HIGH blast radius (deleting the wrong half deletes DOCS-08 coverage -- `260810-kuo` already
  REJECTED one attempt at this file for that reason). Needs a deliberate owner." P23 asks the
  executor to do a targeted version of exactly what N1 defers.

Strictly, clause 2 subsumes both 1 and 3 (it pins each occurrence to its own job's comment run,
which the count cannot localize -- see the repo's own recorded lesson that a cardinality gate cannot
localize). So "keep one" = keep clause 2. But removing the table row forces the header arithmetic
rewrite the file names, and the table row is what carries the DOCS-08 site registration.

**Recommendation:** treat P23 as maintainer-gated. The lazy safe cut is clause 3 alone (the
whole-file count at `:834`), which is the one clause 2 provably subsumes with no DOCS-08 site
bookkeeping and no header arithmetic change. Removing the table row should be a separate decision.

### P24 -- exact, and both cited line numbers hold

`src/lib/mirror-seed.spec.ts:33-36`:

> How the two split, which is why both are here: the LITERAL catches a marker change and a slot
> reordering. The DERIVED check catches an index that is no longer taken from the real tuple -- a
> hardcoded 0/1/2 mapping satisfies every literal in this file and fails only there.

M2 measured that false (22/22 pass under a hardcoded map). The correction must state what `:66`
uniquely catches: hardcode PLUS a tuple reorder. `:59` and `:66` are exact at HEAD -- `:59` is
`expect(mirrorSeedHash(RUN_ID, os)).toBe(PINNED_SEEDS[os]);` and `:66-68` is the
`toContain(\`${MARKER}${CACHE_OS_VALUES.indexOf(os)}\`)` assertion.

### P26 -- the ledger's line number is wrong

`src/test/repo-file.ts:52-55` is inside the `REPO_FILE_CACHE` docstring and says something else
entirely (the filesystem-writer disjointness argument). The false claim is in the `readRepoFile`
docstring:

```
:74-76
 * MEMOIZED, because the callers are read-only content scans and several of them scan the
 * same tree: three specs loop over every package module, and `.github/workflows/ci.yml`
 * alone is read at four sites across four files.
```

BOTH halves of that sentence are false for the same reason -- vitest isolates per file by default,
so each spec gets its own module registry and `REPO_FILE_CACHE` cannot dedupe across files. The
correction must cover the "three specs loop over every package module" clause too, not only the
ci.yml one. The memo still earns its keep WITHIN one file (`docs-same-os-claims.spec.ts` alone reads
`ci.yml` many times).

---

## serve() reachability -- the ledger's claim VERIFIED and FALSIFIED

**Ledger claim:** "No P-item touches a `serve()`-reachable source, so no bundle rebuild is
expected."

**Verdict: FALSE as written. P11 touches one.**

Method: read the module markers embedded in the generated bundle
(`rg -o "packages/github-cache/src/[a-z/-]+\.ts" start-cache-server/index.js | sort -u`), and
cross-checked against the import chain `serve.ts` -> `server/server.ts` / `lib/select-backend.ts`.

The serve() import graph is exactly these 17 package sources:

```
backend/actions-cache-backend.ts   lib/is-entrypoint.ts
backend/memory-backend.ts          lib/local-context.ts
backend/releases-backend.ts        lib/octokit-status.ts
backend/types.ts    <-- P11         lib/release-asset-name.ts
lib/cache-archive-path.ts          lib/retention.ts
lib/cache-key.ts                   lib/select-backend.ts
lib/github-identity.ts             lib/trust.ts
                                   lib/with-hash-lock.ts
serve.ts                           server/server.ts
```

**P11 (`backend/types.ts`) is in that set.** `serve.ts:9` and `server/server.ts:9` both import from
`./backend/types.js`, and `isWritableBackend` appears in the bundle (3 occurrences).

Mitigating fact: the P11 edit removes a `readonly` modifier from an `interface` property. TypeScript
interfaces emit no JavaScript, so the bundle output should be byte-identical. The precise correct
claim is: **no P-item changes serve()-reachable EMITTED code, but P11 does edit a serve()-reachable
file.** `check:action` must be run in the MAIN TREE after the P8-P11 commit and confirm zero drift --
not assumed clean from the ledger's blanket sentence.

Explicitly NOT in the bundle (verified, count 0 each): `lib/octokit-fault-reason.ts`,
`cleanup/cleanup.ts`, `publish/publish-mirror.ts`. So P13's new export and its three call-site edits
are bundle-safe. Every other P-item is a `*.spec.ts` file or a `src/test/` fixture, neither of which
the bundle reaches (`src/test/consumer-contract.ts:23-24` states it is "imported only by the
*.spec.ts guards, never by the package barrel").

---

## Cross-item execution ordering

| constraint | reason |
|------------|--------|
| P14 before P8 | P14 deletes two of the three `strippedSourceOf(fixture)` call sites in `compression-method.spec.ts`; doing P8 first means renaming three sites and then deleting two of them |
| P12 before or with P15 | both relocate walk/scan helpers; P12 lands `nonSpecModules` in `src/test/repo-file.ts`, which is the natural home for P15's shared leaf-scan helper too |
| P16 with the `consumer-contract.ts` docstring edit | the docstring at `:10-14` describes the pins P16 deletes; splitting them ships a false comment between commits |
| P1 with its `:574-576` prose correction | same reason |
| P6 with its `:305-307` prose correction | same reason |
| P22 all three files in one commit | two in-file comments assert the three files share one shape |
| P11 immediately followed by a MAIN-TREE `check:action` | the only serve()-reachable edit |

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | P17's "third copy of the miss test" is `:416-427` | P17 row | Wrong test deleted; the ledger does not enumerate copies 1 and 2, so this is inference from "the sibling arg-array test is the real claim" (which uniquely identifies `:390` as the survivor, hence `:416` as the target) |
| A2 | P5's "3 constant-pin tests" are `:662`, `:682`, and the literal half of `:698` | P5 note | `:671` could be intended instead of one of these; it is relational and should not be deleted |
| A3 | P15's three specs are `cache-key`, `mirror-seed`, `cache-archive-path` | P15 note | Only two share the shape; if a fourth site exists outside `git grep`'s reach the consolidation misses it |
| A4 | A `readonly` removal on an interface property emits no bundle change | serve() section | Would be caught by `check:action` in the main tree -- the gate exists for exactly this |
| A5 | P23's "keep one" means keep the per-block parser | P23 note | The ledger does not say which of the three to keep |

All five are structural inferences from the ledger's own wording, not external claims. None depends
on a package version, a registry lookup, or documentation.

---

## Counts

- **CONFIRMED: 21** -- P1, P2, P3, P4, P6, P8, P9, P10, P11, P12, P13, P14, P16, P17, P19, P20, P21,
  P22, P24, P25, P26
- **AMBIGUOUS: 4** -- P5 (which three, and one has a relational half), P15 (only two of three share
  a shape), P18 (which pair of four), P23 (which of three to keep; forces a header-arithmetic
  rewrite and sits in the N1 file)
- **NOT-FOUND: 1** -- P7 (`octokit-fault-reason.spec.ts` has no `timeout` token at all; the only
  matching test in the repo is `compression-method.spec.ts:209`, protected by triage authority #3)

**Ledger site references that were WRONG and are corrected above:** P7 (file), P9 (file), P10
(file), P20 (file), P26 (line range). Five of twenty-six.

**Ledger premises FALSIFIED by measurement in this pass:** P12's "byte-identical" (the two copies
differ by a `.map()` prefix step), P13's "authored 3x" identically (one of the three carries an extra
`burnedTagMessage ??` fallback), and the execution note's "No P-item touches a `serve()`-reachable
source" (P11 does).

**serve() reachability: ONE item touches a serve()-reachable source -- P11 (`backend/types.ts`).**
The edit is type-only so the emitted bundle should be unchanged, but `check:action` must be run in
the MAIN TREE to confirm rather than assumed from the ledger.
