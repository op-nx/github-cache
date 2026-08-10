# PR #16 review survivors -- verified findings to fix

All 36 verified against source at HEAD `c7793c4`. Battery green at HEAD: test 1079/1079 across
43 files, lint exit 0 forced-uncached, typecheck exit 0, `check:action` exit 0, `pack:check`
exit 0. So every item below is something the green suite does not catch.

## HARD CONSTRAINTS for whoever fixes these

**ROBUST-04 -- the single most likely way to break this.** `start-cache-server/index.js` is a
committed esbuild bundle that INLINES every `serve()`-reachable source. Items touching
`actions-cache-backend.ts`, `select-backend.ts`, `backend/types.ts`, `cache-archive-path.ts`,
`cache-key.ts`, `mirror-seed.ts` or `release-asset-name.ts` MUST run `npm run build:action` and
commit the regenerated `start-cache-server/index.js` IN THE SAME COMMIT. `npm run check:action`
is the gate; it fails the commit otherwise. Verify in the MAIN tree, never a worktree with a
junctioned `node_modules` (that produces false drift on ~689 module paths).

**Bisect-safe atomic commits.** Every commit must independently pass
`npm run lint && npm run typecheck && npm run test && npm run check:action && npm run pack:check`.
Do not split a code change from the spec change that covers it, and do not split a comment
correction from the sibling copies of the same claim -- a partially-corrected N-copy comment is
this repo's named recurring defect.

**Do not weaken any guard to make it pass.** Several items below make guards STRICTER; if a
stricter guard goes red, the finding was real and the code is what changes.

**No emojis or non-ASCII in anything you write.** ASCII only, `--` not em dash.

---

## A. Guard strength -- guards that read as coverage and are not

**A1 (HIGHEST). `docs-adoption.spec.ts:134` -- `::add-mask::` guard defeated by an adjacent comment.**
`expect(doc).toContain('::add-mask::')` reads the doc raw. `README.md` has the token at `:74`
inside a `#` YAML comment AND at `:79` as the only executable `echo "::add-mask::${token}"`.
Deleting `:79` leaves the guard green while the documented snippet writes an UNMASKED bearer
token to `$GITHUB_ENV` at `:80`. Docs are correct today; the guard cannot detect the regression.
Fix: `expect(doc).toMatch(/echo "::add-mask::/)`, and assert that index precedes the
`>> "$GITHUB_ENV"` token write.

**A2. `docs-adoption.spec.ts:129-132` -- self-disabling precondition.** The early `return` makes
all three cases silent no-ops reporting PASS if a doc stops naming
`NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` literally. Fix: assert the precondition still holds
for all three docs.

**A3. `docs-adoption.spec.ts:167-169` -- writable-outcome clause satisfied by prose.**
`/Actions-cache backend/i` occurs on FIVE lines of `docs/advanced.md` (11, 29, 30, 191, 205);
only `:29` is the selection-table row. Both table rows could be deleted with the clause green.
Fix: line-scope it, `/writable[^\n]*Actions-cache backend/` (verified: matches `:29` only).

**A4. `docs-adoption.spec.ts:157-165` -- co-presence, not relation.** Two independent
whole-document matches that happen to land on the same line today. Fix:
`/GITHUB_REPOSITORY[^\n]*throws/` and `/memory backend[^\n]*permanent MISS/i`.

**A5. `docs-adoption.spec.ts:56-58,86-88` -- `toContain('PORT')` matches IMPORTANT/SUPPORT/EXPORT.**
Not live today. Fix: `` toContain('`PORT`') `` or `/\bPORT\b/`.

**A6. `dogfood-cross-os.spec.ts:359-375` -- publish `needs:` clauses are substring-satisfiable.**
`\bbuild\b` matches inside `build-windows`, which THIS PR added. Rewriting `ci.yml`'s
`needs: [build, typecheck, test, integration]` to the three `*-windows` jobs keeps all four cases
green while dropping every real producer -- the XOS-07 race the block exists to prevent.
Fix: pin the whole list once, `toMatch(/^ {4}needs: \[build, typecheck, test, integration\]$/m)`.

**A7. `hash-parity/compare.spec.ts:738-741,760-773` -- reads `ci.yml` RAW, no comment strip.**
`toContain("grep -q '^hash-parity: PARITY OK' hash-parity.log")` is satisfiable by a comment.
Non-vacuous today only because the needle appears exactly once. The house convention is that
workflow comments repeat needles verbatim, and the guard this spec names as its own model
(`dogfood-cross-os.spec.ts`) DOES strip `#` lines. Fix: strip comments before matching.

**A8. `nx-target-inputs.spec.ts:398-417` -- CORR-04 exclusivity asserted at the wrong layer.**
Enumerates `nxJson.targetDefaults` only. `packages/github-cache/project.json` is a live merge
layer whose target keys REPLACE defaults wholesale, and the same file has two merge describes
proving it knows this. Adding `inputs: ["default", {"runtime": "..."}]` to `test` in
`project.json` makes `test` OS-sensitive -- killing the milestone's core outcome -- with every
guard green until the next two-leg parity run. Fix: enumerate the union of
`Object.keys(nxJson.targetDefaults)` and `Object.keys(projectJson.targets)`, map each through
the `mergeTargetConfigurations` / `readTargetDefaultsForTarget` pair ALREADY imported at the top
of the file, filter with the existing `runtimeInputsOf`, assert `toEqual(['integration'])`.

**A9. `nx-target-inputs.spec.ts:117-128` -- `hashedFilesFor` has the same wrong-layer bug.**
Reads `nxJson.targetDefaults[target].inputs`; a `project.json` `targets.typecheck.inputs` would
re-open the spec-excluding-inputs hole the `:130-162` describe exists to close. Route through
the same merge pair.

**A10. `windows-regression-detector.spec.ts:198-210` -- least-privilege clauses are absence-only.**
Nothing asserts a `permissions:` block EXISTS, so deleting it entirely (job inherits repo/workflow
default scopes) passes both assertions. Separately `/permissions:[\s\S]{0,60}contents:\s*write/`
only sees 60 chars; three added scope lines clear the window. Fix: positive pin
`toMatch(/^permissions:\n {2}contents: read$/m)` plus unbounded negative
`not.toMatch(/^\s*(contents|actions|packages|id-token):\s*write$/m)`.

**A11. `docs-cross-os.spec.ts:140-149` -- `RENDERED_DISCRIMINATOR_SITES` counts without localizing.**
Exactly 4 occurrences: `docs/cross-os.md:45,51,57` (snippet) + `:117` (verification fence).
Deleting the adopter-facing fence and adding a 4th target to the snippet keeps the count at 4.
Fix: count inside the fenced json snippet (expect 3) AND assert at least one occurrence inside
the bash verification fence.

**A12. `docs-same-os-claims.spec.ts:772-787` -- Phase 11 row A count cannot localize.**
Asserts two phrases occur exactly twice in all of `ci.yml` (`:1638`, `:1881`). Deleting the
`:1881` block and duplicating the sentence inside the hash-parity block keeps the count at 2.
Fix: slice `ci.yml` at each job key and assert the phrase in each slice.

**A13. `docs-same-os-claims.spec.ts:263` -- half-locked run-id phrase.**
`'MEASURED on run 30400231720'` occurs TWICE in `ci.yml` (`:2280` publish `needs:` block, `:2434`
CORR-02 shard-growth comment in a different job), so `toContain` survives deleting the
justification paragraph at `:2280-2288`. Fix: extend to the unique tail
`'MEASURED on run 30400231720, which is why this widening is a fix'`.
ALSO: the docstring at `:756-757` claims "The other eight Phase 10/11 phrases were verified
unique (count 1)" -- false as written; the Phase 10 rows contribute 28 phrases, one duplicated.
Correct the docstring in the same commit.

**A14. `actions-cache-backend.spec.ts` -- `get()`'s archive cleanup untested on MISS and THROW.**
Only four `existsSync(cacheArchivePath(...))` assertions: get-HIT plus three put paths. The source
at `:190-204` says the `try` was moved ABOVE the restore specifically because it previously
covered only the hit branch. Moving it back leaves the suite green. Exposure got WORSE in this PR
by the source's own argument: a `CACHE_READ_ONLY` leg issues zero puts, so put's `finally` no
longer incidentally sweeps the leftover -- and this PR introduced read-only legs. Fix: two cases
(pre-write the archive; mock `restoreCache` to resolve `undefined`, and to reject; assert the
file is gone).

**A15. `actions-cache-backend.spec.ts:803-893` -- VER-04's case-fold is untested.** Cases cover
unset / no `nx.json` / sibling directory; nothing exercises same-directory-different-case, the
only reason `.toLowerCase()` exists at `:167`. Dropping it keeps every case green then throws at
construction on Windows CI, taking out all three XOS-04 legs.

**A16. `select-backend.spec.ts:609-641` -- TRUST-14 branch-order anchored against only one of
three earlier branches.** Only the token degrade is anchored; `isWriteTrusted` (`:44`) and the
`GITHUB_REPOSITORY` throw (`:55`) are not. A reorder moving either below the knob keeps the clause
green while breaking the guarantee. Fix: two more `indexOf` anchors in the existing style.

**A17. `cache-key.spec.ts:127-157` -- single-source guard is a hand-maintained 4-file map, and its
stated property is already FALSE.** The comment claims the literal "must exist in exactly one
production place"; there are TWO authored copies -- `cache-key.ts:43` and `retention.ts:56`
(`SHARD_TAG_PREFIX`). The second is deliberate and documented at `retention.ts:44-54`, so it is
not itself a bug -- but `retention.ts` is absent from the map, so the guard can see neither it nor
a FIFTH module inlining the literal. Fix: swap the map for the `nonSpecModules()` tree walk that
already exists in `actions-cache-backend.spec.ts`, with an explicit two-site allowlist, and
correct the "exactly one" wording.

**A18. `nx-target-inputs.spec.ts:294-332` -- the LINT-01 existence chain's second half is unpinned.**
The comment credits `ci.yml:100`'s `Successfully ran target lint` grep, but NOTHING asserts it, and
`nx run-many -t lint` on a missing target exits 0. Fix: one clause in `dogfood-cross-os.spec.ts`
(which already has `jobBlock`) asserting the lint job block matches
`/grep -q 'Successfully ran target lint' \S+\.log$/m`. Secondary: that `ci.yml` grep is UNANCHORED
unlike the o3-witness and hash-parity ones -- anchor it.

**A19. `capture-hashes-cli.spec.ts:222-235` -- `--diff` asserts a count and a key untied.**
Fix: `toMatch(/only-in-A \(1\)[\s\S]*?targets\.typecheck\.outputs/)`.

## B. CI gates

**B1. `ci.yml:713-728` -- `typecheck-windows` floor is 1 but the leg resolves TWO cacheable tasks.**
`npm run typecheck` is `nx run-many -t typecheck`, and `typecheck` carries the inferred
`dependsOn: ["build", "^typecheck"]`. `capture-hashes.mjs:667-689` pins exactly that two-task set,
and the traceability record shows healthy counts of 1/2/1. If cross-OS restore of the `typecheck`
entry breaks while `build` still restores, count is 1 and the gate stays GREEN -- the one
observation the leg exists for was never made. Fix: raise THIS leg's floor to 2 (still a floor,
not the exact pin XOS-09 forbids) and reword `:718`/`:726` to name both tasks. The `:726` message
currently asserts the count can only come from the ubuntu typecheck entry, which is false in that
state. `build-windows` and `test-windows` resolve 1 task each and stay at 1.

**B2. `ci.yml:997` -- integration leg's label counter lacks `grep -a`.** Its three siblings all use
`grep -a -o -F` and carry a paragraph explaining that a single NUL byte -- "routine for
PowerShell-invoked tooling on windows-11-arm" -- makes grep emit one binary-file summary line, so
`wc -l` returns 1 on ZERO real labels. This step is RECORDED not gated, so it cannot launder a
gate, but the Windows leg's recorded `0` is the observation the O3 narrative rests on and the same
byte would record `1`. Evidence corruption. Fix: add `-a`.

**B3. `ci.yml:2148-2159` -- `consumer-smoke`'s readiness poll left on the loose `!= "000"` form.**
This PR replaced that form in all six Nx-target jobs precisely because it accepts a 401; the file
now carries two contradictory poll idioms with the rejected one still present as a copy source,
and this copy also lacks `--max-time`. Not currently exploitable. Fix: adopt the 404-or-200 +
`--max-time 10` form.

## C. Code

**C1. `actions-cache-backend.ts:314` -- `put()`'s `writeFile` sits OUTSIDE the try/finally, so the
`finally`'s "Cleanup runs on every exit path" claim at `:409-414` is false.** A throwing
`writeFile` (ENOSPC; EPERM/EACCES/EBUSY from Windows antivirus or a concurrent handle) leaves a
partial archive at the deterministic per-hash path with the `finally` never entered. This is the
same defect the READ path fixed in this same PR. Not a correctness hole -- a stale partial cannot
become a wrong HIT, and the put still fails closed into a 500. Fix: move `await writeFile(path,
bytes)` inside the existing `try`. A writeFile fault then falls into the existing `catch`, is not
a `ReserveCacheError`, and rethrows unchanged -- behaviour preserved. SERVE-REACHABLE: rebuild the
bundle.

**C2. `select-backend.ts:64` -- the token-absent degrade is genuinely silent.** A write-trusted push
with an unwired token: sidecar starts, readiness poll gets its 404 and accepts it as proof of life,
every GET 404s, every PUT 403s, Nx degrades best-effort, job GREEN with a permanently cold cache
and not one line in the log. This PR added a `core.info` to the ADJACENT `CACHE_READ_ONLY` branch
justifying the level with "Every other silent-degradation path in this package warns (the saveCache
-1 ambiguity, the all-restore-MISS run, the asset cap, an unparseable created_at)" -- an
enumeration that omits the branch three lines above it. Fix: one `core.warning` (a surprise, not a
request -- unlike the sibling's deliberate `info`) naming the consequence, AND either add it to
that enumeration or drop the "every other" claim. SERVE-REACHABLE: rebuild the bundle.

**C3. `hash-parity/compare.ts` -- an EMPTY `discriminator.stdout` passes the platform-sensitivity
clause.** `shapeFault` (`:327`) checks the TYPE and never the length -- correct for `stderr`, which
is legitimately empty on a healthy leg, WRONG for `stdout`, which is never legitimately empty for
`node --no-warnings -p process.platform`. `capture-hashes.mjs`'s `runDiscriminator` returns
`stdout: result.stdout ?? ''` and a spawn that fails to launch yields `''` with `status: null`. Leg
A `''` vs leg B `'win32'` -> `:512`'s trimmed comparison differs -> clause PASSES and the gate
prints PARITY OK, attributing a divergent `integration` hash to a discriminator that produced
nothing on one leg. The record already carries `discriminator.status` FOR THIS PURPOSE and no
consumer reads it -- neither modelled in `HashParityRecord` nor checked in `shapeFault`. This is
the CORR-03 "malformed input yielding a PASS" class. Fix: require non-empty `stdout` in
`shapeFault` while leaving `stderr` type-only, and state the asymmetry (the existing comment
already half-argues it).

**C4. `mirror-seed.ts:63` + `action/index.ts:395` -- `runId: ''` yields `'feed0'`, a VALID hash.**
Verified: `mirrorSeedHash('', 'windows') === 'feed0'` and it matches `HASH_PATTERN`. It crosses
`parseHash` and is a perfectly valid cache key, so the server's SRV-03 route validator cannot
reject it -- PUT returns 200 and the leg writes a run-independent key every future empty-run-id leg
collides on. The READER already guards this (`read-back.ts` validates the run id separately and its
comment names this case); the WRITER does not. Impact bounded by the retention window and the
reader still fails loud, hence low. Fix: reject an empty `runId` at `action/index.ts:395` the way
`read-back.ts` already does. SERVE-REACHABLE (mirror-seed): rebuild the bundle if you touch it --
prefer fixing at the `action/index.ts` call site, which is NOT serve-reachable.

**C5. `backend/types.ts:23-30` -- `ReadableBackend | WritableBackend` collapses to
`ReadableBackend`.** `WritableBackend extends ReadableBackend`, so `selectBackend`'s return type
carries ZERO read-only information; the structural guarantee rests entirely on excess-property
checking, which fires only on a fresh object literal. A later non-literal wrapper --
`function createReadOnlyActionsCacheBackend(): ReadableBackend { return createActionsCacheBackend(); }`
-- compiles clean, makes `isWritableBackend` true on the `CACHE_READ_ONLY` branch, the server calls
`put`, and XOS-09's inductive argument ("read-only => no Windows-produced entry can exist") is
silently false with every gate green. Fix: add
`export interface ReadOnlyBackend extends ReadableBackend { readonly put?: never; }`, return it
from the three read-only factories, widen `selectBackend` to `ReadOnlyBackend | WritableBackend`.
`isWritableBackend` unchanged, `WritableBackend extends ReadableBackend` untouched, and the wrapper
above becomes a compile error at the frame that wrote it. SERVE-REACHABLE: rebuild the bundle.
**CORRECTED BY RESEARCH -- do not overclaim in the comment.** The pattern was probed with a real
`tsc --noEmit` under this repo's strictness: `WritableBackend` -> `ReadOnlyBackend` IS rejected, so
the fix is real. BUT `ReadableBackend` is still assignable to `ReadOnlyBackend`, so a wrapper
annotated with the OLD base type still launders a writable backend through one indirection. The fix
converts a silent hole into one requiring a VISIBLE return-type widening. Any comment landing at
`types.ts` MUST NOT claim the wrapper is unrepresentable -- say it requires a visible widening.
CHECK `public-surface.spec.ts` -- if `ReadOnlyBackend` is exported from the barrel it is a
consumer-visible surface addition and must land as an explicit reviewable literal diff; prefer
keeping it INTERNAL (not exported from `src/index.ts`) so no public surface changes, per D2-02.

**C6. `octokit-fault-reason.ts:161` -- `hasFaultCode(error, code: string)` accepts any string.**
The module header enumerates GitHub's code enum as exactly six members. `hasFaultCode(error,
'already_exist')` compiles, always returns false, and silently converts a genuine duplicate-upload
race into a counted `failed` -- fail-closed, so not a Core-Value risk, but a green run turns red
for a benign cause with the cause invisible. Fix: `export type GitHubErrorCode = 'missing' |
'missing_field' | 'invalid' | 'already_exists' | 'unprocessable' | 'custom'` and annotate the
parameter. Do NOT do this to `faultMessageForField`'s `field` (endpoint-specific names), and leave
`faultReason().code` as `string` (it renders whatever GitHub sent).

## D. Comments and docs -- false reasons this PR's own changes created

**D1. `actions-cache-backend.ts:401-403` -- the N-copy sweep missed the third copy.**
"a reserve conflict still means another job is creating the same byte-identical entry (CORR-01)".
CORR-01 is the superseded OS-namespaced-store invariant. Both copies in `publish-mirror.ts` were
corrected (`:442-448`, `:705-712`) with the new reason -- one entry per hash, restored and
re-uploaded VERBATIM without re-running the task -- and that reason does NOT transfer here: this
branch is two jobs that each EXECUTED the task and race to reserve the same key. That collision was
structurally IMPOSSIBLE before this milestone (the cache version partitioned by OS) and is now
reachable for an adopter running `build` read-write on both an ubuntu and a windows runner. Two
independently produced tar archives from two operating systems are not byte-identical.
First-write-wins is probably still the right trade; the defect is the false reason plus the retired
citation. Fix: say byte-identity is no longer the reason, and that first-write-wins is accepted
because both entries are valid outputs of the same Nx task hash. SERVE-REACHABLE: rebuild.

**D2. `publish-mirror.ts:551` -- the OBS-03 block's topic sentence asserts what the block retracts.**
Opens `// OBS-03: producer attribution as Release METADATA...`; five lines later the same block
states, correctly, that it names the PUBLISHING leg's OS and that "no comment, doc, summary or
threat-model line may say otherwise". The line a skimmer takes away -- and the only line that
survives a future trim -- asserts producer attribution. The retraction guard
(`docs-same-os-claims.spec.ts:811-819`) is a same-sentence co-occurrence check, so this sentence
sits in its known, deliberately-accepted blind spot. Fix: one word -- `publisher attribution`.

**D3. The 122-legacy-asset claim is false in FOUR places.** `release-asset-name.ts:11` says the
legacy branch "is the ONLY thing that can still prune the 122 assets already published under the
old shape"; `cleanup.ts:89` and `release-asset-name.spec.ts:125` repeat it; `release-asset-name.ts`
~`:130` adds "its 50 shipped instances are accepted dead weight bounded by the shard and the
retention window". `retention.ts:86-96` -- the CORRECTED sibling in this same PR -- records the
truth: the shard-tag prefix rename (`cache-mirror-` -> `nx-cache-`) made old-prefix shards
unreadable AND unprunable, and "they were removed by hand instead". `cleanup.ts:78` scopes on
`isShardTag` = `/^nx-cache-\d{6}$/`, so cleanup never visits a `cache-mirror-*` release at all, and
every `nx-cache-YYYYMM` shard postdates the asset rename so it can only hold `nx-cache-<hash>`
names. The branch is cheap, provably disjoint and harmless to KEEP -- do not delete it. Fix all
four wordings to restate it as defence-in-depth against any surviving old-shape asset rather than
as pruning a population that no longer exists. This is the same N-copy class as D1; sweep all four
in ONE commit.

**D4. `publish-mirror.ts:862-871` -- "Treat this branch as the live rotation signal" is false after
this PR's own D3 reorder.** The new pre-restore guard at `:635` skips shard-present entries with NO
restore attempted, so a mid-month cache-VERSION rotation's victims land in `alreadyPresent`, not
`readMisses`. Using the file's own measured figures (run `31305961054`: 112 enumerated, 43 misses,
attempted-only 43/53 so 59 skipped pre-restore), a full rotation gives roughly 53/112 -- the Wilson
bound lands near 0.38, under the 0.5 target rate, so the PARTIAL branch is silent; and the TOTAL
gate needs `readMisses === hashes.length && mirrored === 0`, so it is silent too. Both tripwires
silent, `failed` 0, leg GREEN having mirrored only what it wrote itself -- the exact OBS-04
silent-degradation state the two branches exist to detect. The file DOES carry a correct sibling
clause ("THE RECLASSIFICATION ... moves `readMisses` down in PARTIAL runs"), so the consequence was
corrected at the guard and not at the branch that depends on it -- N-copy again. Fix: retract the
"live rotation signal" claim and state the measured consequence (an entry already in the shard is
never restore-probed, so neither branch detects a mid-month rotation; the detectable window is the
first publish against a NEW month shard, which the message's own cause (4) already describes).
OPTIONAL and separate -- if a live signal is still wanted, fold `alreadyPresent` into the tripwire
(`alreadyPresent + readMisses === hashes.length`); do NOT switch the denominator to attempted-only,
which the file already MEASURED firing on both legs of a healthy run.

**D5. `docs/cross-os.md:111-116` -- section 1's verification list omits stderr-empty.**
Section 1 item `(c)` tells the reader to verify TWO things (non-empty token; differs per OS).
Section 3 (`:183-185`) says "The replacement command must clear the SAME bar section 1 sets" and
lists THREE, including stderr-empty. Section 1 mentions stderr only at item `(b)`, as an
explanation of why `--no-warnings` is pinned -- never as something to check. Section 1 explicitly
invites substitution, and a consumer who swaps in their own probe never reaches section 3 (scoped
to the arch/libc case). The document names the consequence itself: a PID-carrying warning gives a
permanent 100% MISS presenting as a portability failure. This is the most externally-visible
finding -- it is the consumer-facing recipe. Fix: add stderr-empty as a third item under section
1's `(c)`; section 3's cross-reference then becomes true as written.

**D6. `README.md` quickstart precondition -- omits that an UNSET `GITHUB_WORKSPACE` passes.**
README says the sidecar refuses to start unless `nx.json` is in the cwd "and that directory matches
`GITHUB_WORKSPACE`". `actions-cache-backend.ts:165` reads `process.env.GITHUB_WORKSPACE ?? ''` and
its own comment says `resolve('')` IS `resolve(cwd)`, so unset or blank passes naturally. Sends a
reader debugging a non-Actions runner down a wrong path. Fix: "...when that variable is set."

**D7. `ci.yml` -- roughly a dozen internal `:NNN` cross-references are stale.** Verified wrong:
`:1551-1552` and `:1811` -> `:943-946` (claims the permissions-REPLACES-grant trap; actually an Nx
run step -- really ~1190-1199); `:1533`/`:1820` -> `:170-172` (really ~216-219); `:1536` ->
`:392-393` (really 842-843); `:1540` -> `:399-404` (really 848-853); `:1792` -> `:926` (really
2296); `:1824` -> `:525-535` (really ~1586-1594); `:1834` -> `:121-131` (really 146-162) and ->
`:1043-1050` (really 2520-2543); `:1851` -> `:66-72` (really 74-100); `:2115` -> `:179-182` (really
277-280); `:1774` -> `nx.json:101` (really `nx.json:106`); `:1571` -> `nx.json:137` (really
`nx.json:151`). Some pointers ARE correct, which is what makes the wrong ones costly -- a reader
cannot tell the classes apart without resolving each. Several hang off load-bearing claims. The file
already legislates against this: `windows-regression-detector.yml:8-13` drops a count from a comment
because "an unguarded number in a comment rots, and a comment carrying a false claim is a documented
argument for undoing the work". Fix: replace numeric pointers with the job/step NAME, which the file
already does elsewhere and which does not rot.

**D8. `ci.yml:2283-2285` -- reproduction instruction names an asset shape this milestone deleted.**
"task hash 8059758544828235640 present ONLY under a `-windows` suffix". That is the legacy name
CORR-02 removed in this same milestone. The measurement stays a true historical fact but is
unfollowable as an instruction: the shard today holds `nx-cache-<hash>` with the OS in the
`mirrored-by` label. Every other legacy-shape reference in this PR carries a "pre-CORR-02"
qualifier; this one does not. Fix: qualify it in place.

**D9. `cache-key.ts:9-11,42-43` -- "the ONE authored source ... Never inline a second copy" no
longer matches the tree.** `retention.ts:56` authors a byte-identical `'nx-cache-'` as
`SHARD_TAG_PREFIX`, and `retention.ts:44-54` argues the disjointness well (two GitHub APIs, two
keyspaces) -- they SHOULD stay independently changeable. The acknowledgment is one-sided;
`cache-key.ts` does not point back. Fix: one sentence naming the deliberate second copy. Do NOT
alias them.

**D10. `release-asset-name.ts:5-14` and `:27-34` -- both survival annotations under-name their
consumers.** `CACHE_OS_VALUES`: the annotation says "Its live consumer is
`isLegacyOsSuffixedAssetName`" (singular), but `mirror-seed.ts:1` imports it as a VALUE and
`mirror-seed.ts:64` evaluates `CACHE_OS_VALUES.indexOf(os)` at runtime -- `mirror-seed.ts:20` says
so explicitly ("The runtime edge to CACHE_OS_VALUES is DELIBERATE"). The annotation names the
weaker of the two reasons and omits the load-bearing one. `cachePlatform`: names one consumer where
SIX call sites exist (this finding originally said "five" while listing six -- the
miscount propagated into the annotation itself and was corrected separately in `2b570b3`)
(`publish-mirror.ts:577`, `action/index.ts:348/394/451/487`,
`read-back.ts:373`). These annotations exist to tell `fallow dead-code` and the next reader why the
symbols survive; an under-naming is a latent deletion. Fix: name all consumers.

**D11. `ci.yml:1284` -- a fifth authored `nx-cache-` key, outside the guard that pins the other
four.** `key="nx-cache-${h_linux}"` in `o3-witness`. `cache-key.ts:27-35` says editing
`CACHE_KEY_PREFIX` "ORPHANS THE ENTIRE MIRROR" and `cache-key.spec.ts` enforces an authored-count of
1 -- but its file map covers only four `.ts` files and no assertion covers this shell copy. A shell
step cannot import `cacheKeyFor`, so this is NOT a deletion. Fix: one line of prose at the `ci.yml`
site naming it as the shell copy. (A17 handles the map itself.)

**D12. `.planning/` carries 391 non-ASCII characters across 19 files IN THE PR DIFF.**
(An earlier statement of this finding said "326 characters across 18 files" -- 326 was a count of
LINES carrying at least one such character, not of characters. The character count is 391.
SCOPE IS LOAD-BEARING: the whole tracked `.planning` tree carries 3462 characters across 90 files,
dominated by archived v0.0.1 box-drawing diagrams that are 100% fenced. A blanket tree-wide sweep
would be roughly NINE TIMES too large -- pin the sweep to the PR diff. Of the 391: 5 are fenced
vitest output, 12 are inside backticks as truncated assertion text, and 374 are authored prose.
Convert the 374; leave the 17 alone.)
Originally stated as: -- em dashes throughout, plus
emoji (U+2705, U+1F512, U+26A0+FE0F, U+274C, U+2B1C) concentrated in the Phase 13 PLAN and
VALIDATION artifacts, and U+2713/U+00D7/U+2026 in Phase 8/9 SUMMARY files. House rule is ASCII only
in all committed content. NOTE: some of these are VERBATIM captured tool output (vitest tick/cross
marks in SUMMARY files) -- converting those changes a recorded measurement, so prefer converting
PROSE em dashes and emoji and LEAVING verbatim captures alone, or note the exception. Lowest
priority; do it last or split it out.

## E. Simplification -- no behaviour change

**E1. `publish-mirror.ts:806-818` and `:937-948` -- the read-miss cause list is authored twice with
no recorded reason.** A byte-identical ~370-char span (note it is SPLIT ACROSS STRING CONCATENATION
at different wrap boundaries in the two literals, which is what makes the pair hard to eyeball in a
diff -- a contiguous grep will NOT find it). Two commits on this branch exist solely to repair this
pair in lockstep (`5a5ed82`, `e94c649`). Contrast `SEED_MARKER_WORDS` (`:221-231`), which records
its own duplication as ACCEPTED with the drift direction -- that is what a deliberate duplication
looks like here, and this one has no such note. Fix: one module-level `READ_MISS_CAUSES` constant
interpolated into both. Emitted bytes MUST be unchanged; every pinned substring
(`publish-mirror.spec.ts:1284,1288,1456-1457,1464,1591-1592,1598`) must survive verbatim.

**E2. `publish-mirror.ts:465` -- `publishMirror` is the repo's only NEWLY-INTRODUCED complexity
failure and is why `fallow audit` exits 1.** Cyclomatic 25, cognitive 36, 506 lines,
`introduced: true`. The extractable part is the TAIL, not the loop: `:779-950` is the two mutually
exclusive read-miss warning branches, reading only `readMisses`, `hashes.length` and `mirrored` --
all final by then, touching no loop state. Of ~170 lines roughly 160 are comment blocks. Fix: move
the span verbatim into a module-private `warnOnReadMisses(readMisses, scanned, mirrored): void`
called on one line where the block sits. With E1 this takes the function from 506 to roughly 330
lines. Keep it module-PRIVATE for the reason `wilsonLowerBound` already records at `:82-84`.
DO NOT touch the other fallow entries (`ensureShardRelease`, `shapeFault`, `compareHashParity`,
`cleanupMirror`, `action/index.ts:282` `run`, `capture-hashes.mjs`'s `parseArgs`/`diff`/
`assertGraphPremise`) -- they are flat ordered guard chains where every branch returns or throws a
DISTINCT named reason, several comment-lock their ordering by name, and their branch count IS the
diagnosis surface. Flattening any of them loses an explicit failure branch.

**E3. Three identical repo-file `read()` helpers.** `docs-adoption.spec.ts:26-34`,
`docs-cross-os.spec.ts:49-54` (new here), `docs-same-os-claims.spec.ts:707-709` (new here). Fix: one
`src/test/repo-file.ts` exporting `WORKSPACE_ROOT` and `readRepoFile(relativePath)`. CONSTRAINT: it
must import NOTHING from `vitest` -- `src/test/` is inside `tsconfig.lib.json`'s `src/**/*.ts`
include, so a vitest import emits a vitest require into `dist` (constraint already recorded at
`workspace-root-cwd.ts:12-15`). Depth becomes `../../../../`. Not serve-reachable.

**E4. The YAML comment-strip idiom is authored four times** --
`windows-regression-detector.spec.ts:49-54` (new), `dogfood-cross-os.spec.ts:50-54` (new),
`cleanup/cleanup-workflow.spec.ts:27-29`, `ppe/ppe-action.spec.ts:32-34`. Same shared home and
constraints as E3. CAVEAT that would break a blanket sweep: `dogfood-cross-os.spec.ts:1959-1962`
deliberately re-reads the RAW file because the stripped view drops shell comments inside `run:`
bodies and would blind the injection scan -- reason recorded at `:1954-1958`. That read MUST stay
raw; the shared helper covers the stripped view only.

## Explicitly REJECTED -- do not "fix" these

- Exporting `Hash` from the barrel. D2-02 forbids new package exports; the finding asks for the
  thing the milestone decided against.
- `expect(CORR_05_SITES).toEqual([])` at `lint-rules.spec.ts:794-796`. A documented placeholder
  whose 40-line comment already disclaims the repo-wide property.
- Stripping `/* */` in `lint-scope-drift.spec.ts`, and the retraction guard's empty-file case. Both
  verified NOT live.
- Deleting the legacy `<hash>-<os>` accept branch, `CACHE_OS_VALUES`, or `cachePlatform`. All have
  live consumers; only their ANNOTATIONS are wrong (D3, D10).
- The `is-entrypoint` 5-line duplication fallow reports. Pre-existing, and `lib/is-entrypoint.ts` is
  serve()-reachable so any edit incurs the ROBUST-04 rebuild cost to save six lines.
- Switching the D5 denominator to attempted-only. MEASURED to fire on both legs of a healthy run.

## Recorded, NOT fixed here

- `sync-gate.ts` validates `GITHUB_REF_NAME` against the default branch but `runPublish` passes raw
  `GITHUB_REF` to TRUST-10's `ref` scoping -- two different variables. Pre-existing, outside this
  diff, and producing the divergence needs `env:` control in a default-branch workflow (an
  already-privileged actor). Worth a follow-up issue.
- `compare.ts:397-405` requires only `a.meta.os !== b.meta.os`, so a linux+darwin pair would pass
  with no Windows leg captured. Reachable only via a matrix edit.
- Four unignored workspace-root CI artifacts: `payload.bin`, `roundtrip.bin`,
  `hash-parity-records/`, `integration-hash-records/`.
