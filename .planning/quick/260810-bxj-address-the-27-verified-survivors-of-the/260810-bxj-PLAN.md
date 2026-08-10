---
phase: 260810-bxj
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements:
  [
    T1-1, T1-2, T1-3, T1-4, T1-5, T1-6, T1-7, T1-8,
    T2-1, T2-2, T2-3, T2-4, T2-5, T2-6, T2-7,
    T3-1, T3-2, T3-3, T3-4, T3-5, T3-6, T3-7, T3-8, T3-9, T3-10,
    T4-6, T4-7,
  ]
files_modified:
  - .planning/quick/260810-bxj-address-the-27-verified-survivors-of-the/260810-bxj-deferred-items.md
  - .github/workflows/ci.yml
  - .gitignore
  - docs/advanced.md
  - docs/trust-and-security.md
  - eslint.config.mjs
  - packages/github-cache/src/action/index.spec.ts
  - packages/github-cache/src/backend/actions-cache-backend.spec.ts
  - packages/github-cache/src/backend/actions-cache-backend.ts
  - packages/github-cache/src/backend/memory-backend.ts
  - packages/github-cache/src/backend/releases-backend.spec.ts
  - packages/github-cache/src/backend/releases-backend.ts
  - packages/github-cache/src/backend/types.ts
  - packages/github-cache/src/capture-hashes-cli.spec.ts
  - packages/github-cache/src/cleanup/cleanup.ts
  - packages/github-cache/src/docs-same-os-claims.spec.ts
  - packages/github-cache/src/dogfood-cross-os.spec.ts
  - packages/github-cache/src/hash-parity/compare.ts
  - packages/github-cache/src/lib/compression-method.spec.ts
  - packages/github-cache/src/lib/compression-method.ts
  - packages/github-cache/src/lib/mirrored-by-label.ts
  - packages/github-cache/src/lib/octokit-fault-reason.spec.ts
  - packages/github-cache/src/lib/octokit-fault-reason.ts
  - packages/github-cache/src/lib/release-asset-name.integration.spec.ts
  - packages/github-cache/src/lib/release-asset-name.ts
  - packages/github-cache/src/lib/retention.ts
  - packages/github-cache/src/lib/select-backend.spec.ts
  - packages/github-cache/src/lib/select-backend.ts
  - packages/github-cache/src/lint-rules.spec.ts
  - packages/github-cache/src/lint-scope-drift.spec.ts
  - packages/github-cache/src/nx-target-inputs.spec.ts
  - packages/github-cache/src/pinned-deps.spec.ts
  - packages/github-cache/src/public-surface.spec.ts
  - packages/github-cache/src/publish/publish-mirror.spec.ts
  - packages/github-cache/src/publish/publish-mirror.ts
  - packages/github-cache/src/roundtrip/read-back.spec.ts
  - packages/github-cache/src/roundtrip/read-back.ts
  - packages/github-cache/src/test/repo-file.ts
  - start-cache-server/index.js

must_haves:
  truths:
    - "Every one of the 27 enumerated items (T1-1..T1-8, T2-1..T2-7, T3-1..T3-10, T4-6, T4-7) has a landed change."
    - "None of the seven DEFERRED items (T4-1, T4-2, T4-3, T4-4, T4-5, T4-8, T4-7a) is implemented; each is recorded with a written reason in `260810-bxj-deferred-items.md`."
    - "A 422 asset-upload body carrying a benign entry ALONGSIDE a non-benign sibling is now FATAL: `failed` rises, the aggregate `setFailed` fires, the leg goes RED (DEC-1)."
    - "`import { platform } from 'node:process'`, the bare-`process` form, the aliased default import, the namespace import, the dynamic import, and the five widened `process.env` keys are all reported by a test that FIRES against the REAL root config."
    - "`read-back.spec.ts` passes on every calendar day: its shard-window fixture reads a pinned clock, not the wall clock."
    - "The Windows read-only-knob guard is a PARTITION over a DERIVED job set -- a new non-conforming Windows job reddens it, a deleted leg reddens it, and a knob copied onto a producer reddens it, each separately attributable."
    - "SCOPE-CORRECTED (2026-08-10, from the code review): no replacement guard on the COUNT PIPELINE is a byte-pin, and no NEGATIVE assertion anywhere in `dogfood-cross-os.spec.ts` is indentation-anchored. The unqualified original -- \"no surviving assertion fails merely because whitespace or indentation moved\" -- was FALSE and was verified as true, which is the same defect class this task exists to close: 14 lines carrying a `^ {10}` anchor survive in that file deliberately, all of them POSITIVE. The distinction is load-bearing rather than cosmetic: a byte-pinned positive reddens loudly on a reindent, while a byte-pinned NEGATIVE goes VACUOUS -- and three of the survivors were negatives, so a leg could gain a second target with its exclusivity clause still green. Those three (six lines, two per leg) are now `^\\s+`; the positives stay anchored on purpose."
    - "No new hand-authored count appears in any comment; every count that survives is asserted programmatically in the same commit, and every count that is not is deleted."
    - "CORRECTED (2026-08-10, from the code review and the verification, which found this independently): `nx.json` is byte-unchanged; the ESLint `externalDependencies` drift is closed by pinning EACH SIDE to its own full set as a UNION -- `lint` set-equals the four ESLint names AND `test` set-equals those four UNION the test-runner name. The two arrays are NOT equal to each other (MEASURED), so a plain `lint`-equals-`test` assertion would be red on a correct tree. The earlier SUBTRACTION form (`test` minus `lint` equals the runner) was BLIND TO A REMOVAL -- MEASURED: dropping one ESLint package from `test`, or all four, left every clause GREEN, which is verbatim the stale-cache false PASS T4-7 exists to close. Still no element count on either side."
    - "Every commit that edits a `serve()`-reachable source stages the regenerated `start-cache-server/index.js` in that SAME commit; `check:action` is clean at every commit, run in the MAIN tree."
    - "No guard was relaxed, scoped down, skipped or deleted to reach green. Where a stricter guard went red, the CODE changed."
  artifacts:
    - ".planning/quick/260810-bxj-address-the-27-verified-survivors-of-the/260810-bxj-deferred-items.md"
    - "packages/github-cache/src/lib/mirrored-by-label.ts"
    - "A sibling-aware all-entries CODE predicate exported from packages/github-cache/src/lib/octokit-fault-reason.ts. It reads NO message: DEC-1's field-scoped textual anchor governs only the paths whose benign signal IS a message (ensureShardRelease's burned tag, where the first-message decoy bites). On the upload path the signal is a CODE, so a code-set conjunction satisfies DEC-1 structurally rather than literally, and a message read there would be the defect."
    - "New EVASION_SHAPES and FALSE_POSITIVE_CONTROLS rows in packages/github-cache/src/lib/../lint-rules.spec.ts covering the node:process family"
    - "A shared comment-stripper in packages/github-cache/src/test/repo-file.ts with its own positive-control suite"
  key_links:
    - "publish-mirror.ts upload catch -> octokit-fault-reason.ts predicate: the ONLY route by which a policy rejection can be classified benign."
    - "eslint.config.mjs ban object -> lint-rules.spec.ts lintFixture: the ban is proven only through the real root config, never by asserting config shape."
    - "ci.yml job census -> dogfood-cross-os.spec.ts derived Windows-leg set: the guard's predicate must stay the three-way conjunction (Windows AND sidecar AND portable target)."
    - "publish-mirror.ts writer + read-back.ts reader -> lib/mirrored-by-label.ts: one authored copy of the OBS-03 label."
    - "The bundled source set (enumerated by the `// packages/...` module markers in start-cache-server/index.js, NOT guessed) -> npm run check:action: a bundled-source edit and its regenerated bundle must land in one commit. Tasks 8 and 9 both edit bundled sources; task 3 edits none."
---

<objective>
Close the 27 verified survivors of the thermos multi-agent review of PR #16, and record the seven
deferred items so v0.0.3 does not re-derive them.

Purpose: the review found zero critical and zero high on the correctness axis -- v0.0.2's central
claim is intact. What survived is concentrated in this repo's two named recurring defect classes:
guards that read as coverage and are not, and prose that this PR's own changes falsified. One item
(T1-1) is a live silent-green publish path with an established root cause on a real runner.

Output: atomic commits grouped by tier and file, following quick `260809-uge`'s precedent; plus one
new planning artifact recording the deferred set.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/260810-bxj-address-the-27-verified-survivors-of-the/260810-bxj-CONTEXT.md
@.planning/quick/260810-bxj-address-the-27-verified-survivors-of-the/260810-bxj-RESEARCH.md
@AGENTS.md
</context>

<execution_rules>
Read these once. They apply to every task below.

1. **Main tree, no worktree isolation.** A junctioned worktree makes esbuild rewrite module paths
   with no source edit, so `check:action` returns a FALSE drift verdict there. This task touches a
   bundled source, so a trustworthy `check:action` is required.

2. **Bundle coupling.** The bundled set is enumerated in `start-cache-server/index.js` itself, as a
   `// packages/...` path comment above each inlined module. Do not guess it -- re-derive it with
   `rg -o -N '// [a-z0-9_./-]+\.ts$' start-cache-server/index.js | sort -u`. Measured at HEAD it is:
   `backend/actions-cache-backend.ts`, `backend/memory-backend.ts`, `backend/releases-backend.ts`,
   `backend/types.ts`, `lib/cache-archive-path.ts`, `lib/cache-key.ts`, `lib/github-identity.ts`,
   `lib/is-entrypoint.ts`, `lib/local-context.ts`, `lib/octokit-status.ts`,
   `lib/release-asset-name.ts`, `lib/retention.ts`, `lib/select-backend.ts`, `lib/trust.ts`,
   `lib/with-hash-lock.ts`, `serve.ts`, `server/server.ts`, plus `start-cache-server/entry.ts`.

   NOT bundled, verified the same way: `cleanup/cleanup.ts`, `hash-parity/compare.ts`,
   `lib/compression-method.ts`, `lib/mirror-seed.ts`, `lib/octokit-fault-reason.ts`,
   `publish/publish-mirror.ts`, `roundtrip/read-back.ts`. Do not claim otherwise in a commit
   message or a comment -- a false bundling claim inside a task about false claims is the defect
   this task exists to close.

   Any change to a bundled source needs `npm run build:action` and the regenerated
   `start-cache-server/index.js` staged in the SAME commit, or `check:action` fails that commit.
   Comment-only edits to a bundled source produce no bundle delta (esbuild strips comments) -- run
   `check:action` anyway rather than assuming. Tasks 8 and 9 both edit bundled sources
   (`select-backend.ts`, the four `backend/` modules, `lib/release-asset-name.ts`,
   `lib/retention.ts`), so `check:action` is mandatory in both.

3. **Atomic commits, grouped by tier and file.** One task below may produce several commits. Each
   commit must independently pass `npm run lint`, `npm run typecheck`, `npm run test`,
   `npm run format:check` and `npm run check:action`.

4. **Never introduce a new hand-authored count.** Three reviewers measured 29, 34 and 35 against a
   comment claiming 16. Delete the number, or assert it programmatically in the same commit. A
   fourth hand-authored number is a FAILED outcome.

5. **No replacement guard may be a byte-pin.** A guard must fail when the INVARIANT breaks, not
   when whitespace moves. Indentation-anchored regexes are the defect T2-2 exists to fix, not a
   pattern to copy.

6. **Where a fix is prose-deletion only, the check is that no surviving assertion depended on the
   deleted claim.** Verify that; do not invent a test for a comment. In particular
   `docs-same-os-claims.spec.ts` reads `ci.yml` RAW and asserts on comment prose -- inspect its
   `DOCS_08_SITES` rows keyed to a file BEFORE deleting prose from it.

7. **Do not add a dependency.** `yaml` and `js-yaml` exist only as transitive deps -- do not import
   them. Every workflow guard here uses regex over `stripYamlComments(readRepoFile(...))` text.

8. **Do not restructure the deferred files.** `ci.yml`, `publish-mirror.ts`,
   `dogfood-cross-os.spec.ts`, `capture-hashes.mjs`, `actions-cache-backend.spec.ts` and the
   `ReadOnlyBackend` union are OFF LIMITS for splitting (DEC-2). Edit them in place.

9. **If a battery or a repeat loop goes red, capture it before re-running.** Nx caches terminal
   output for SUCCESSFUL runs only, so the re-run destroys the evidence. Pipe through `tee` to a
   per-iteration log and capture `${PIPESTATUS[0]}` into a VARIABLE -- never `exit ${PIPESTATUS[0]}`
   inline, which terminates the loop after one iteration and returns 0.

10. **ASCII only** in every authored line: no emoji, no box-drawing, no em/en dashes, no curly
    quotes, no ellipsis character.
</execution_rules>

<tasks>

<task type="auto">
  <name>Task 1: Record the seven deferred items (DEC-2)</name>
  <files>.planning/quick/260810-bxj-address-the-27-verified-survivors-of-the/260810-bxj-deferred-items.md</files>
  <action>
Write the deferral record FIRST, so the scope boundary is explicit before any code is touched.

One section per item, seven in total, each with the measured size/finding count and the written
reason for deferral. The seven, with the reason each: T4-1 (`ci.yml` 2594 lines, five named seams;
`ci.yml` PRODUCED this milestone's O1-O4 live evidence, so restructuring it invalidates the
provenance of the evidence the PR rests on and needs fresh live windows on a maintainer-only push
path; also blocked by T2-2 by construction). T4-2 (`publish-mirror.ts` 1043 lines, 11 fallow
complexity findings; a quick task fixes defects, it does not restructure). T4-3
(`dogfood-cross-os.spec.ts` 2211 lines, 11 unrelated concerns, ~370 duplicated lines). T4-4
(`capture-hashes.mjs` 957 lines, three programs in one file). T4-5
(`actions-cache-backend.spec.ts` 1069 lines plus two misplaced package-scope tree walks). T4-8
(`ReadOnlyBackend` re-widened at three sites; four port names for two concepts). T4-7a (the
`nx.json` `namedInputs` single-sourcing half of T4-7).

T4-7a carries the sharpest reason and an ordering constraint -- state both. Research MEASURED that
the refactor rotates all five task hashes and makes
`.planning/phases/11-live-proofs-o1-o2-o3/11-hashes-{cold,warm}.json` non-reproducible from HEAD;
the rotation is caused by `nx.json`'s own BYTES, not by `namedInputs`, so it is unavoidable for any
`nx.json` edit whatsoever. `REQUIREMENTS.md:654` and `STATE.md:608` record that this milestone was
SEQUENCED to prevent exactly that class of change. The rotation is OS-uniform (`.gitattributes`
forces LF), gates nothing, and is semantically neutral -- the cost is to EVIDENCE PROVENANCE, not
to correctness. So T4-7a must land EARLY in v0.0.3, before any new hash record, and its landing
commit must carry the Phase 11 provenance note plus the LINT-04 guard repair through
`splitInputsIntoSelfAndDependencies` + `expandSingleProjectInputs` (split first -- `lint.inputs`
contains a `^`-prefixed entry and the expander throws on it).

Add a closing line stating the deferral lane (`ROADMAP.md:418`) and that the in-scope set is 27.

The record is UNTRACKED when written, so `git grep` cannot see it -- it operates on the index only
and returns a silent zero, which reads as a missing entry. Use `rg` for any check against this file,
as the verify below does; do not "simplify" it back to `git grep`.
  </action>
  <verify>
    <automated>D=.planning/quick/260810-bxj-address-the-27-verified-survivors-of-the/260810-bxj-deferred-items.md; test -f "$D" &amp;&amp; for id in T4-1 T4-2 T4-3 T4-4 T4-5 T4-8 T4-7a; do rg -q -F "$id" "$D" || { echo "MISSING $id"; exit 1; }; done; echo OK</automated>
  </verify>
  <done>All seven deferred items appear in the record, each with a written reason; T4-7a additionally carries the EARLY-in-v0.0.3 ordering constraint and the two companion actions its future landing requires.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: T1-1 -- a non-benign sibling in a 422 upload body is FATAL (DEC-1)</name>
  <files>packages/github-cache/src/lib/octokit-fault-reason.ts, packages/github-cache/src/lib/octokit-fault-reason.spec.ts, packages/github-cache/src/publish/publish-mirror.ts, packages/github-cache/src/publish/publish-mirror.spec.ts</files>
  <behavior>
    - A 422 whose `errors[]` holds ONLY the documented duplicate-name signature stays benign: `skipped` rises, `failed` stays 0.
    - A 422 whose `errors[]` holds that signature AHEAD of a `code: custom` policy rejection is FATAL: `failed` rises, the warning names the status, the code and GitHub's own message, and the aggregate `setFailed` fires. This is the measured run-30767511870 payload and it must go RED.
    - The SAME body with the two entries in the OPPOSITE order is also FATAL. Order-independence survives; what changes is the verdict both orders reach.
    - The `pre_receive` ruleset decoy stays fatal, excluded both structurally and by code.
    - An absent, unreadable or malformed body is FATAL, never a benign skip.
  </behavior>
  <action>
Mirror the house pattern already in this file at `publish-mirror.ts:366-395` onto the asset-upload
catch at `publish-mirror.ts:969-1005`. Per DEC-1: benign only on a positively recognised signature,
every other error code in the array FATAL.

Add ONE predicate to `octokit-fault-reason.ts` beside `hasFaultCode`, in that module's documented
style: it answers "is EVERY entry in `errors[]` this one code, on a non-empty array". That is the
conjunction the current call cannot express -- `hasFaultCode` asks whether ANY entry carries the
code, which is why a benign entry sitting ahead of a `custom` immutability rejection classifies the
whole rejection as a duplicate no-op. Non-empty is load-bearing: an absent or unreadable body must
return false and fall through to the fault branch, per this module's standing rule that undefined is
never benign. Keep `hasFaultCode` -- `ensureShardRelease` still needs it and its own semantics are
correct there.

Replace the upload branch's condition with status 422 AND the new all-entries predicate. Do NOT
introduce a message-substring read on this path. Per CONTEXT.md's DEC-1 clarification, the
field-scoped textual anchor governs only the paths whose benign signal IS a message -- that is
`ensureShardRelease`'s burned tag, where `faultReason().message` returns a decoy because it yields
the FIRST message-carrying entry. Here the signal is a CODE, so a code-set conjunction is
structurally immune to that decoy rather than merely careful about it, and it satisfies DEC-1
structurally rather than literally. State exactly that in the replacement comment, so the next
reader does not "restore" a field-scoped message read that has nothing to scope to.

Then correct the three comments that credit the whole-array scan with closing a hole it only widens:
`octokit-fault-reason.ts:161-180`, `publish-mirror.ts:989-995`, and the block above
`publish-mirror.spec.ts:513`. Each must state the actual property: the whole-array scan removed the
order-dependence of a FIRST-code read and widened the benign set in the process; the conjunction is
what narrows it back. `publish-mirror.ts:341` already says this correctly and is the model -- do not
edit it. Delete the retired-claim archaeology rather than layering another correction paragraph onto
it.

Rename the spec at `publish-mirror.spec.ts:513` to state what it asserts. Its current title claims
it proves masking does NOT occur while its body asserts `skipped:1, failed:0`, which proves masking
DOES occur -- so the assertion flips with this change and the title must be authored against the new
behaviour, not adjusted to keep the old one green.

**Its TWIN flips too, and the plan names it so you do not discover it at the first red run.**
`it('reaches the same verdict when already_exists is NOT the first entry')` at
`publish-mirror.spec.ts:539` throws a body of `[{code: custom, message: decoy}, {code: already_exists}]`
and asserts `skipped:1, failed:0` with no warning. Under the new rule that body is FATAL. Re-author
the body's expectations AND its comment: the comment currently argues the fatal outcome would be
WRONG -- "the genuine duplicate-upload race would be counted as a fault, and the publish job would
redden on a race D-05 defines as benign" -- which is one more falsified-prose instance, and left
standing it reads as an instruction to narrow the predicate.

CONTEXT.md records the accepted trade under DEC-1: a genuine duplicate race that arrives with a
non-benign sibling in the SAME body now fails closed. That is the deliberate cost of closing the
silent-green hole, and it is bounded -- the recorded exposure is a repository setting whose
re-enablement SHOULD be red per `STATE.md:482`. Do NOT narrow the predicate to keep either twin
green: order-independence is preserved (both orders reach the same verdict), and the verdict is what
changed. Keep the twin as the order-independence proof, with its title still true and its
expectations and prose authored against the new verdict.

Neither file is in the action bundle (verified), so no bundle regeneration is expected here -- run
`check:action` regardless.
  </action>
  <verify>
    <automated>cd packages/github-cache &amp;&amp; npx vitest run src/publish/publish-mirror.spec.ts src/lib/octokit-fault-reason.spec.ts</automated>
    <automated>cd packages/github-cache &amp;&amp; node -e "const fs=require('fs');const s=fs.readFileSync('src/publish/publish-mirror.ts','utf8');const i=s.indexOf('uploadReleaseAsset(shard.id');if(i<0){console.error('upload call site not found -- re-anchor this gate');process.exit(1)}const tail=s.slice(i).split(/\n\s*\}\s*\n/)[0];if(/faultMessageForField/.test(tail.replace(/\/\/[^\n]*/g,''))){console.error('the upload branch reads a message-scoped accessor; DEC-1 forbids it on this path');process.exit(1)}console.log('OK')"</automated>
  </verify>
  <done>The measured decoy payload makes the leg RED with `failed` incremented; the reversed-order twin reaches the same FATAL verdict with its title, expectations and prose re-authored; a lone duplicate-name 422 still counts `skipped` with `failed` 0; an unreadable body is fatal; the upload branch reads no message-scoped accessor; all three comments describe the property the code now has.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: T1-2, T1-4, T1-7, T1-8 -- consumer truth, determinism, one authored label, and the burned-tag hoist</name>
  <files>docs/advanced.md, packages/github-cache/src/roundtrip/read-back.spec.ts, packages/github-cache/src/lib/mirrored-by-label.ts, packages/github-cache/src/roundtrip/read-back.ts, packages/github-cache/src/publish/publish-mirror.ts, packages/github-cache/src/publish/publish-mirror.spec.ts, packages/github-cache/src/action/index.spec.ts, start-cache-server/index.js</files>
  <behavior>
    - T1-4: `read-back.spec.ts` passes with the system clock pinned to any date, including the 31st of a 31-day month.
    - T1-7: renaming the label prefix at the writer reddens a spec, without a live CI job.
    - T1-8: once the shard tag is burned, an OVERSIZED remaining entry counts as `skipped` with `failed` 0, and no further Actions-cache restore is issued for any remaining hash.
  </behavior>
  <action>
Four independent commits.

**T1-2, correct the DOC; do NOT widen `cleanup.ts`.** `retention.ts:87-96` records the deliberate
decision not to widen `isShardTag`, and that decision stands: a widened accepter must be maintained
forever, the affected shards were one hand-deleted release, and the tag scheme is not part of the
consumer contract. The defect is that `docs/advanced.md:118-120` tells a CONSUMER the opposite of
what `cleanup.ts:78` does. Rewrite those lines to state the truth plainly: shards under the
pre-rename tag scheme are NOT reachable by cleanup and must be removed by hand. On a public repo the
consequence of believing the current text is world-readable assets retained forever, so say that
consequence out loud rather than implying it. THREE specs read this file --
`docs-adoption.spec.ts`, `docs-cross-os.spec.ts` and `docs-same-os-claims.spec.ts` (measured with
`git grep -l -F advanced.md -- src`) -- so check all three for a row pinning the sentence you are
replacing, and run all three.

**T1-4, pin the clock.** Copy the sibling idiom verbatim from `cleanup.spec.ts:58-66` and
`releases-backend.spec.ts:83-92`: `vi.useFakeTimers()` then `vi.setSystemTime(PINNED_NOW)` in
`beforeEach` (before the existing `vi.clearAllMocks()`), `vi.useRealTimers()` FIRST in `afterEach`
ahead of the existing env restore and `vi.unstubAllGlobals()`. No `toFake` narrowing, no
`shouldAdvanceTime`, no `advanceTimersByTime` -- research measured 38 passed in 60ms with no hang,
because `AbortSignal.timeout` runs on an internal unref'd timer the fake clock does not drive and
`fetchMock` resolves synchronously. Pin to `2026-07-15T00:00:00Z`, the literal both siblings already
use: with the default 30-day window it yields exactly two DISTINCT shard tags, so the fixture's
intent (the current shard 404s, an OLDER shard holds the asset) holds by construction rather than by
calendar luck. Add one line naming the two tags the pin produces, as `releases-backend.spec.ts:83-87`
does -- that line is what makes the date auditable instead of arbitrary. Confirm the RED direction
once by temporarily pinning to the 31st of a 31-day month and observing exactly one failure, then
restore the pin; do not commit the temporary value.

**T1-7, single-source the OBS-03 label.** The `mirrored-by:` prefix is the only OS attribution the
mirror carries after CORR-02 dropped it from the asset name, and it is authored independently at
several sites, so a writer-side rename passes every spec. Add `lib/mirrored-by-label.ts` exporting a
function from `CacheOs` to the label string, following `lib/mirror-seed.ts`'s leaf shape -- that
precedent was chosen precisely because it is unreachable from `serve()` and contributes a provably
zero consumer-bundle delta.

**No count, an ENUMERATED LIST.** The census rule applies to this plan too: the review said six, my
first draft said four in one place and six in another, and the measured figure is SEVEN authoring
sites. So route these, by name: the writer (`publish-mirror.ts:821`), the reader's prefix constant
(`read-back.ts:43`), both re-authorings in `publish-mirror.spec.ts` (`:91`, `:408`), the helper in
`read-back.spec.ts:182`, and both literals in `action/index.spec.ts` (`:387`, `:402`). Then re-derive
the set rather than trusting that list: `git grep -n -F 'mirrored-by' -- src` also hits
`release-asset-name.ts`, `releases-backend.spec.ts` and `docs-same-os-claims.spec.ts`. Inspect each
-- a PROSE mention is not an authoring site and must not be rewritten into an import; an authoring
site is any expression that constructs the label. Route every authoring site found; leave prose
mentions alone. If the derived set differs from the seven above, the list was wrong and the search
wins.

Replace the consider-and-reject paragraph at `read-back.ts:34-41` with the reason the extraction now
holds: both files already import from `lib/release-asset-name.js`, so neither consumer's dependency
set grows. Neither `publish-mirror.ts` nor `read-back.ts` is bundled, so no delta is expected --
assert it with `check:action` rather than assuming the tree-shake, and if the bundle does move, stage
the regenerated `start-cache-server/index.js` in this same commit.

**T1-8, hoist the burned-tag short-circuit.** The `if (burnedShardTag)` block at
`publish-mirror.ts:920-924` sits BELOW the D-12 size check and below the restore, so its stated
"GREEN by design, `failed` stays 0" property is false for an oversized entry, and every remaining
hash pays a useless Actions-cache round-trip. Move it to the top of the loop body, immediately after
the asset name is derived. Confirm the D3 membership branch is unaffected: a burned tag means
`ensureShardRelease` returned undefined, so the shard never resolves and that branch cannot fire
while the sentinel is set -- state that in the comment so the hoist reads as order-only.

The replacement comment must state BOTH aggregate consequences, because this file's house rule is
that a reorder names the counts it moves and the sibling reorder at `:840-878` already does exactly
that. (1) The D-12 oversize branch's `core.error` and `failed++` no longer fire for a post-burn
oversized entry -- which is the point: it restores the "`failed` stays 0" property the block claims.
(2) `readMisses` stops incrementing for every post-burn entry, because the restore that classified
them is no longer reached. Consequence (2) is the one a reader will miss and the one that shifts a
reported number, so state it explicitly and state that it cannot affect the total-case gate: that
gate needs `readMisses === hashes.length`, and a burned tag means the shard never resolved, so no
entry was ever mirrored on that leg either.
  </action>
  <verify>
    <automated>cd packages/github-cache &amp;&amp; npx vitest run src/roundtrip/read-back.spec.ts src/publish/publish-mirror.spec.ts src/action/index.spec.ts src/docs-adoption.spec.ts src/docs-cross-os.spec.ts src/docs-same-os-claims.spec.ts src/lib</automated>
    <automated>npm run check:action</automated>
  </verify>
  <done>`docs/advanced.md` states the unreachable-by-cleanup truth and its public-repo consequence, and all three specs that read it pass; `read-back.spec.ts` is clock-pinned with the two produced tags named; exactly one module authors the label and every authoring site found by search imports it, with prose mentions left alone; the burned-tag sentinel is the first branch in the loop and its comment names both aggregate consequences.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: T1-3 -- close the ambient-platform-read ban family, proven by a test that FIRES</name>
  <files>eslint.config.mjs, packages/github-cache/src/lint-rules.spec.ts</files>
  <behavior>
    - Named import of a platform accessor from the prefixed specifier: reported.
    - Named import from the bare specifier: reported.
    - Aliased DEFAULT import: reported at the import site.
    - NAMESPACE import: reported at the import site.
    - Dynamic import of the module: reported by the syntax rule.
    - The five widened environment keys the reviewer found: reported by the syntax rule.
    - Controls that must stay legal: the already-caught direct member read, the benign CI env key, a relative local import.
    - Every row above is ALLOWED at the integration-spec path.
  </behavior>
  <action>
The measured gap is TWELVE evasion shapes, not the three the review named -- it also misses the
NAMESPACE import and the DYNAMIC import. Four edits, all inside the existing ban object; no new AST
selector is needed and none should be added.

Declare a banned-accessor list for the process family beside the existing os and path lists,
covering the synthetic default name plus the platform, arch and env accessors. Include the env
accessor: it is the only route that bypasses the environment-key selector entirely, and research
measured it clean. Add TWO `no-restricted-imports` `paths` entries after the four existing ones --
one per specifier prefix -- because `paths[].name` is an exact string lookup, so each prefix is an
independent key (already proven in-repo for the os/path pair). Widen the dynamic-import selector's
alternation by one token. Widen the environment-key selector's alternation by the five keys the
reviewer found; the sixth Windows sibling of one of them measured clean and is discretionary, take
it or leave it but do not leave it half-applied.

Do NOT add a hardcoded-alias selector for the aliased default import. Listing the synthetic default
name in `importNames` makes the rule report at the IMPORT SITE regardless of the local binding name,
which is the same mechanism `eslint.config.mjs:64-72` already documents for an aliased os import.
An alias selector here would be dead configuration.

Prove it in `lint-rules.spec.ts` using the harness that already exists: `new ESLint({ cwd, warnIgnored })`
plus `lintText(source, { filePath })` behind the mandatory `lintFixture` wrapper, which rejects the
ignored/unconfigured state so a zero-errors verdict cannot be vacuous. Do not pass
`overrideConfigFile` or `overrideConfig` -- the point is the REAL root config. Append the six
positive shapes to the `EVASION_SHAPES` table with `expected` as literal rule ids in report order,
and the three controls to `FALSE_POSITIVE_CONTROLS`. Each `EVASION_SHAPES` row is consumed by two
`it.each` loops, so one row buys both the caught-at-unit and allowed-at-integration directions.

Measure false positives on the real tree before committing: run the package's own lint gate and
require zero findings. Research measured exit 0 with the full widening applied, and `git grep`
confirms zero existing imports of that specifier anywhere under `packages/` or
`start-cache-server/` -- but an unmeasured widening surfaces as a red `lint` job on an unrelated
commit, so re-measure rather than trust the record.
  </action>
  <verify>
    <automated>cd packages/github-cache &amp;&amp; npx vitest run src/lint-rules.spec.ts src/lint-scope-drift.spec.ts</automated>
    <automated>cd packages/github-cache &amp;&amp; npx eslint .</automated>
  </verify>
  <done>All six new EVASION_SHAPES rows report the expected rule ids at the unit path and are silent at the integration path; the three controls stay legal; the package lint gate reports zero findings; no alias selector was added.</done>
</task>

<task type="auto">
  <name>Task 5: T1-6, T3-1, T3-2 and the jq element guard -- ci.yml prose and one shell fix</name>
  <files>.github/workflows/ci.yml, packages/github-cache/src/docs-same-os-claims.spec.ts</files>
  <action>
Four commits against `ci.yml`. Before deleting ANY prose here, inspect
`docs-same-os-claims.spec.ts`'s `DOCS_08_SITES` rows keyed to `ci.yml` -- that spec reads the file
RAW and asserts on comment text, so a prose deletion can redden it. Where a row pinned a claim you
are deleting, the row goes with the claim; where a row pinned a claim that survives, leave it alone.

**T1-6, the `cancel-in-progress` safety enumeration (`ci.yml:26-31`).** It claims a PR run's only
PUT is the run-id-keyed seed. The four non-push-gated sidecar jobs write task-hash-keyed entries on
PR runs, and the same file admits it at `:2441-2447`. The enumeration is flagged "READ PRECISELY"
and is wrong. Impact is bounded to a PR-scope MISS, so the CONCLUSION stands -- rewrite the premise
to match the file's own admission, or delete the enumeration and keep the conclusion. Do not restate
a second closed list; the file already has one that went stale.

**T3-1, the header counts (`ci.yml:12`).** Delete both numbers -- the job total and the
Windows-legs count. The measured figures are 8 Windows legs of roughly 27 legs, so the comment is a
COST argument that understates its own cost by five Windows legs. The argument never depended on
either number. Follow `windows-regression-detector.yml:7-13`, added in this same PR, which dropped
its own count for exactly this reason. `ci.yml:1469`'s hedged approximation is the same class; it is
tilde-hedged corroboration rather than a separate finding, so correcting or dropping it is
discretionary.

**T3-2, the seven-job sidecar invariant (`ci.yml:342-346`).** Both of its clauses are false: the
three Windows legs carry an extra environment-write line the ubuntu copies do not, they have a named
tee'd step plus an entire additional gate step rather than a final target line, and one Windows leg
carries extra comments too. The invariant is unguarded and the normalisation it invites would delete
the read-only knob, which by the file's own argument at `:565-577` silently un-sounds all three
gates. Restate it as an invariant that is TRUE: identical except for the read-only environment write
on the three consumer legs, which is load-bearing, plus the tee'd step and the gate step. Name the
consequence of deleting the knob so the invited repair is visibly forbidden.

**The folded jq fix (`ci.yml:1508`).** The jobs-API filter lacks the element type guard its sibling
at `:1445` has, though the two are presented as mirrored. The sibling's shape is
`.actions_caches[] | select(type == "object") | select(.key == ...)`. Apply the same shape to the
jobs extraction so a non-object element cannot reach the indexing step -- the pipeline dereferences
both `.jobs[]` and `.steps[]`, so guard the element it INDEXES, not merely the outer array (the
container check one line above already covers the array).

This is a real shell change, and it ships with NO check unless you add one. MEASURED: exactly one
clause in `dogfood-cross-os.spec.ts` pins an element type guard --
`it('rejects a non-object ROW before indexing it, not just a non-array response')` at `:668`, whose
`toMatch` is anchored to the CACHES pipeline's expression. ZERO clauses pin the jobs-API pipeline, so
"update a clause if one exists" is a no-op and the guard would be revertible in silence -- the exact
defect class this task closes. Add a NEW `it` to that same describe, modelled on the sibling clause:
assert the jobs-API extraction opens with the element type guard, with the same reasoning in the
assertion message (it must come FIRST, because after the key comparison it never runs since indexing
a scalar is what faults; and the container guard is not redundant with it). Anchor on the jq
expression, never on indentation.

**The coupling, and it is load-bearing.** That describe's header comment at `:624` carries a
spelled-out count of its cases, and the comment itself records that the count "HAS ALREADY GONE STALE
TWICE" and instructs a same-commit correction plus a sweep of the sibling count in the sink block
below. Adding an `it` invalidates both. Per the LOCKED census rule, do NOT increment either number to
the next word -- that is hand-authoring a fourth count in a file that has already rotted two.
DELETE both counts and keep the argument, which does not depend on them: each mechanism survives or
falls independently, so a combined assertion would report every regression identically. That is the
same disposition `windows-regression-detector.yml:7-13` took, and it removes the drift source the
comment admits to instead of feeding it. Both deletions land in the SAME commit as the new clause.
  </action>
  <verify>
    <automated>cd packages/github-cache &amp;&amp; npx vitest run src/docs-same-os-claims.spec.ts src/dogfood-cross-os.spec.ts</automated>
    <automated>node -e "const s=require('fs').readFileSync('.github/workflows/ci.yml','utf8');const c=s.split('\n').filter(l=>/^\s*#/.test(l)).join('\n');const n=(c.match(/\b(nineteen|twenty|twenty-one|twenty-two|twenty-three|twenty-five|twenty-six|twenty-seven)\b/gi)||[]);if(n.length){console.error('spelled-out job count survives in ci.yml comments:',n);process.exit(1)}console.log('OK')"</automated>
    <automated>node -e "const s=require('fs').readFileSync('.github/workflows/ci.yml','utf8');const m=s.match(/first\(\.jobs\[\][^\n]*/);if(!m){console.error('jobs-API extraction not found -- re-anchor this gate');process.exit(1)}if(!/\.jobs\[\]\s*\|\s*select\(type == \x22object\x22\)/.test(m[0])){console.error('the jobs-API extraction does not guard its element type:',m[0]);process.exit(1)}console.log('OK')"</automated>
  </verify>
  <done>The `cancel-in-progress` premise matches the file's own admission at `:2441-2447`; no spelled-out job count survives in a `ci.yml` comment, and the Windows-legs number in that same sentence is confirmed gone BY READING (the scan covers only the spelled-out totals); the sidecar invariant is stated in a form that is true and names the forbidden repair; the jobs-API filter carries its element type guard AND a new clause in `dogfood-cross-os.spec.ts` pins it; both spelled-out case counts in that describe are deleted in the same commit; every `DOCS_08_SITES` row still keyed to `ci.yml` is satisfied.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 6: T1-5, T2-2, T2-3 -- replace three non-localizing guards with localizing ones</name>
  <files>packages/github-cache/src/dogfood-cross-os.spec.ts</files>
  <behavior>
    - T1-5: a NEW Windows job that starts the sidecar and runs a portable target without the read-only knob reddens the in-set clause and NAMES the job.
    - T1-5: deleting one of the three conforming legs reddens the set-equality clause.
    - T1-5: copying the knob onto a producer job reddens the out-of-set clause.
    - T1-5: the four matrix Windows legs that run a portable target with NO sidecar stay GREEN and are NOT asked for the knob.
    - T2-2: reindenting the pinned shell by one space leaves every clause green; deleting the flag or the numeric-shape guard from the count pipeline reddens one.
    - T2-3: removing one sidecar block's mask directive reddens a clause that names which block.
  </behavior>
  <action>
**T1-5, replace `READ_ONLY_LEG_SITES` with a per-job PARTITION over a DERIVED set.** A cardinality
gate cannot localize: it is satisfiable by deletion and blind to a new Windows job.

THE PREDICATE IS A THREE-WAY CONJUNCTION -- Windows leg AND cache-server sidecar AND portable Nx
target. Research measured the census: eight Windows legs (three declaring the Windows runner
literally, five reaching it through a two-way OS matrix), and FOUR of the matrix Windows legs run a
portable target while correctly carrying NO knob, because they have no sidecar step and therefore
nothing to write -- `ci.yml:1709-1711` states this explicitly. A guard keyed on "Windows plus
portable target" alone would FALSELY DEMAND the knob on four conforming jobs. The integration leg is
the mirror case: sidecar on a Windows leg, but its target is OS-sensitive by design and not
portable, so zero knob sites is also correct.

Build it from the helpers that already exist: `readRepoFile` and `stripYamlComments` from
`src/test/repo-file.ts`, and `jobBlock` in this file (keep `jobBlock` here -- DEC-2 defers splitting
this file). SLICE the line array from the `jobs:` key to EOF BEFORE enumerating job keys: without the
slice the trigger keys under `on:` sit at the same indent with a bare colon and enter the census as
phantom jobs, which research measured. Derive per job: Windows-leg (the Windows runner literal in the
`runs-on:` value, OR a matrix-expression `runs-on` whose block's OS list names it -- both shapes are
required), sidecar present, portable target present, and the knob-site count.

Assert a partition: every job in the derived set carries at least one knob site AND writes it BEFORE
its sidecar step (drive the existing ordering clause off the derived list instead of three literal
names); every job NOT in the set has zero knob sites, which preserves everything the cardinality gate
protected including a hoist to a workflow-level environment block; and, as the non-vacuity control,
the derived set EQUALS the three expected job names -- a broken slice or a changed indent yields an
empty census that would make both clauses pass trivially. Set equality is the programmatic form the
census rule demands; it is NOT a hard-coded count and must not be written as one. Delete
`READ_ONLY_LEG_SITES` and its justification comment.

While in this region, fix the three orphaned rationale blocks the reviewer found: each is
immediately followed by another block comment, so `READ_ONLY_LEG_SITES` carried the neighbouring
constant's docstring and that neighbour carried none. Attach each surviving rationale to the
constant or describe it documents.

**T2-2, de-byte-pin the count-pipeline clauses.** Three clauses pin the gate shell
character-for-character with indentation-anchored regexes, so they assert the bytes are unchanged
rather than that the arithmetic is right -- the wrong text pins just as green, and the current text
WAS wrong once (a non-integer count tested false inside an `if`, where `set -e` is suspended, and
the step exited 0 while printing that it had gated). Drop the leading-indent anchors and split each
whole-line pin into assertions on the load-bearing tokens individually: the flag that makes the
count survive a NUL byte, the all-decimal shape guard that replaced the arithmetic test, and the
comparison against the leg's floor. Keep the floor value driven by the existing per-leg parameter
rather than re-authored per clause. Do not extract the shell to a script -- that is deferred seam B
inside T4-1.

**T2-3, localize the mask/write pairing.** The clause claims soundness in both failure directions
while pairing masks to writes by whole-file position, so one sidecar block can lose its mask
directive with the clause green. Re-derive it per sidecar block -- iterate the blocks, assert each
one's own mask directive, and let the failure message name the block. Delete the "sound in both
failure directions" claim if the replacement cannot honour it, rather than carrying it forward.

Prove each of the six `<behavior>` rows by MUTATION: apply the mutation, observe exactly the
expected clause redden, revert. Record the mutation results in the commit message.
  </action>
  <verify>
    <automated>cd packages/github-cache &amp;&amp; npx vitest run src/dogfood-cross-os.spec.ts</automated>
    <automated>cd packages/github-cache &amp;&amp; ! git grep -q -F "READ_ONLY_LEG_SITES" -- src/dogfood-cross-os.spec.ts</automated>
    <automated>cd packages/github-cache &amp;&amp; ! git grep -q -E '\^ \{[0-9]+\}count=' -- src/dogfood-cross-os.spec.ts</automated>
  </verify>
  <done>The derived Windows-leg set equals the three expected names; the four sidecar-less Windows legs are green and unasked; all six mutations produce exactly the expected red and are recorded; no indentation-anchored pin remains on the count pipeline; each mask assertion names its own sidecar block.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 7: T2-1, T2-4, T2-6, T2-7, T4-7 -- make four guard claims true and close the nx.json drift</name>
  <files>packages/github-cache/src/backend/actions-cache-backend.spec.ts, packages/github-cache/src/lib/select-backend.spec.ts, packages/github-cache/src/capture-hashes-cli.spec.ts, eslint.config.mjs, packages/github-cache/src/lint-scope-drift.spec.ts, packages/github-cache/src/lib/compression-method.ts, packages/github-cache/src/lib/compression-method.spec.ts, packages/github-cache/src/nx-target-inputs.spec.ts</files>
  <behavior>
    - T2-4: a key appearing on a DIFFERENT stdout line than its expected neighbour reddens the clause.
    - T2-6: dropping any one of the five global ignore entries reddens a clause.
    - T2-7: adding either of the two forbidden result members to the compression module reddens a clause; the scan also has a positive control proving it can fire.
    - T4-7: adding a package to the lint entry and not the test entry reddens a clause; adding one to the test entry and not the lint entry reddens a clause; the existing test-only test-runner entry stays legal.
  </behavior>
  <action>
Five commits.

**T2-1, delete the census claims.** `actions-cache-backend.spec.ts:91-106` states a hand-counted
total inside a block that titles itself a correction of a prior miscount, and is wrong by 18 -- three
reviewers independently measured three different totals. `select-backend.spec.ts:59-71` states a
count plus four line references that point at a comment fragment, two closing braces and another
comment. Delete both counts, all four dead line references, and the derived cross-file totals; keep
the hook rationale, which is required regardless of how many construction sites the file has. This
file's own convention two modules over already says to reference by NAME because a line range decays
on the next edit above it -- apply it. Do NOT author a replacement number and do not add a
programmatic count here: the number serves no reader, so deletion is the fix.

**T2-4, enforce the locality the comment claims.** `capture-hashes-cli.spec.ts:238` uses a
match-anything-including-newlines quantifier, so the key can match anywhere later in stdout while
the comment says it enforces same-line adjacency. Constrain the quantifier to exclude newlines, or
match per-line over the split output. Prove the RED direction with a fixture that puts the key on a
later line.

**T2-6, assert the control the comment claims.** `eslint.config.mjs:88-97` claims a control over
five global ignore entries; only one of the five has a committed assertion, so dropping another
reintroduces the documented stale-cache false PASS with nothing red. Add the assertion in
`lint-scope-drift.spec.ts`: compare the resolved global ignores against the expected five by SET
EQUALITY, not by count and not by membership of one. If instead you narrow the comment to the single
asserted entry, the guard stays weak -- prefer the assertion.

**T2-7, give the mechanically-checkable claim a scanner.** `compression-method.ts:87-94` calls the
absence of two result members "mechanically checkable" while nothing scans that file; all three
sibling modules using the same convention have a real scan, two of them added in this PR. Add the
scan following the closest sibling's shape, with a positive control proving it fires on a fixture
containing a forbidden member and stays silent on a comment-only fixture -- a scan without a control
is the same defect one layer down.

**T4-7, the drift guard, with ZERO `nx.json` bytes changed.** `nx.json` authors the four ESLint
external-dependency names twice, under `test` and under `lint`; add a plugin to `lint` only and
`test` stops rotating on ESLint upgrades, so `lint-rules.spec.ts` replays a cached PASS.

**Assert the SUBSET RELATION, not set equality.** The two arrays are NOT equal, MEASURED from
`nx.json`: `lint` carries the four ESLint names, `test` carries those four PLUS the test-runner name,
so `test` minus `lint` is exactly one element. CONTEXT.md's original set-equality instruction was
wrong and has been corrected there -- a plain equality assertion is RED on a correct tree. The clause
must assert two things: `lint`'s set EQUALS the four ESLint names, AND `test`'s set EQUALS those four
UNION the test-runner name. That is what makes an ESLint plugin added to one side and not the other
go red while leaving the deliberate asymmetry legal. **CORRECTED post-execution:** this instruction
originally said to assert `test` MINUS `lint` equals the runner, and that form is BLIND TO A REMOVAL
-- MEASURED, dropping one ESLint package from `test` or all four left every clause GREEN, which is
the exact stale-cache false PASS T4-7 exists to close. Pin each side to its own full set. Do NOT
assert a hard-coded element count on either side -- that is the T2-1 census defect one file over.
Validate the clause against every mutation it claims to catch BEFORE shipping it, and make the
failure message describe only the directions the assertion covers. Do NOT edit
`nx.json`: the `namedInputs` single-sourcing is deferred as T4-7a because any `nx.json` byte change
rotates all five task hashes and makes Phase 11's hash records non-reproducible from HEAD, and this
milestone was sequenced expressly to prevent that class of change. Note in the clause's own comment
that this is the drift-guard half of the house pattern and that the single-sourcing half is deferred
with an ordering constraint, so a future reader does not read the guard as the whole pattern.
  </action>
  <verify>
    <automated>cd packages/github-cache &amp;&amp; npx vitest run src/nx-target-inputs.spec.ts src/lint-scope-drift.spec.ts src/capture-hashes-cli.spec.ts src/lib/compression-method.spec.ts src/lib/select-backend.spec.ts src/backend/actions-cache-backend.spec.ts</automated>
    <!--
      RUN FROM THE REPOSITORY ROOT. This gate was declared immediately after a `cd
      packages/github-cache` in the line above, and in that shell state the pathspec resolves
      to a file that does not exist, so `git diff --exit-code` returns 0 REGARDLESS of what
      nx.json contains -- a vacuous gate, inside a plan whose whole subject is guards that read
      as coverage and are not. `git -C` is not used here because this project's shell rules ban
      it; the subshell keeps the `cd` above from leaking into this command.
    -->
    <automated>(cd "$(git rev-parse --show-toplevel)" &amp;&amp; git diff --exit-code -- nx.json)</automated>
  </verify>
  <done>Both census blocks carry no count and no dead line reference; the CLI clause enforces same-line locality with a proven RED; the five global ignores are pinned by set equality; the compression-module scan exists with a positive control; the `lint` external-dependency set is pinned equal to the four ESLint names and the `test` set is pinned equal to those four UNION the test-runner name (CORRECTED from the subtraction form, which was blind to a removal), with no element count on either side, every one of the five mutations measured, and `nx.json` byte-unchanged as verified FROM THE REPOSITORY ROOT.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 8: T2-5, T4-6 -- one comment stripper, one workspace root, and a claim that becomes true</name>
  <files>packages/github-cache/src/test/repo-file.ts, packages/github-cache/src/lib/select-backend.ts, packages/github-cache/src/lib/select-backend.spec.ts, packages/github-cache/src/lint-rules.spec.ts, packages/github-cache/src/lint-scope-drift.spec.ts, packages/github-cache/src/public-surface.spec.ts, packages/github-cache/src/nx-target-inputs.spec.ts, packages/github-cache/src/pinned-deps.spec.ts, packages/github-cache/src/lib/cache-key.spec.ts, packages/github-cache/src/lib/cache-archive-path.spec.ts, packages/github-cache/src/backend/actions-cache-backend.spec.ts</files>
  <behavior>
    - For the callers that opt into the trailing-comment mode: a legitimate trailing note on a correct line does not produce a false RED, and a forbidden token left only inside a trailing comment does not produce a false GREEN.
    - For every caller: a value containing a URL scheme, or a shell/YAML value containing a hash character, survives the strip intact.
    - ADDED post-execution (code review WR-08): and a trailing marker with NO whitespace before it IS stripped. The shipped marker required a preceding space, so `code();// note` survived into the "comment-stripped" view -- a false GREEN of the same class the trailing mode exists to close, held shut only by Prettier inserting the space. Both directions need a control; a claim about one file must not depend on `format:check`.
    - The stripper has a positive control proving it fires on a code fixture and stays silent on a comment-only fixture.
  </behavior>
  <action>
Two commits.

**T2-5, one stripper with one control suite.** The comment-stripper primitive exists in five copies
with three different marker sets, all line-leading-only, and the copy with NO positive control backs
the strongest claim in the package -- `select-backend.ts:36-39` says the guard reads the
comment-stripped source so prose cannot satisfy or break it. That is false for a trailing comment,
in BOTH directions: a legitimate trailing note on the knob branch survives the strip and reddens a
correct file, and deleting the knob branch while leaving any trailing comment containing the branch
text passes the positive clause with the knob gone.

Add the shared stripper to `src/test/repo-file.ts`, next to `stripYamlComments` where the sibling
primitive already lives, composing as `strip(readRepoFile(path))` in the shape the YAML one already
established.

**Do NOT give every caller a blanket trailing-comment strip.** A trailing `//` strip truncates any
value containing a URL scheme, and a trailing `#` strip truncates any shell or YAML value containing
a hash character -- either one silently shortens the text a clause matches against, which is a false
GREEN and exactly the class of defect this task is closing. So: keep line-leading stripping as the
DEFAULT, which is what four of the five copies need and already do, and expose the trailing mode as an
opt-in the caller requests. Only `select-backend.spec.ts` needs it, because only its claim asserts
that prose can neither satisfy nor break the clause. Name in the commit message which callers opted
in, and prove each opted-in caller's stripped view is unchanged for every line it asserts against
(diff the stripped output before and after -- the copies are byte-comparable today).

Give the stripper ONE control suite following `cache-archive-path.spec.ts:168-207`'s three-fixture
shape (fires on code, silent on comment-only, matches its own derived probe token), plus the two
truncation controls from `<behavior>`: a URL-scheme value and a hash-bearing value must survive.
Delete the other four copies and route their callers through it. The extraction pattern is already
accepted in this PR -- commit `56b5276` did exactly this for the repo-file read and the YAML strip --
and the argument at
`actions-cache-backend.spec.ts:676-680` that this is a fact about one module is about the wrong
thing: a comment stripper is a primitive, not a fact. Then correct the claim at
`select-backend.ts:36-39` to state the property the stripper now has.

**T4-6, make the ONE-authored-copy claim true.** `repo-file.ts:15` asserts it is the one authored
copy of the workspace-root walk while three constants of that name exist in the package and two
sites re-implement the reader's body verbatim. Route all six bypassing sites through
`readRepoFile` / the exported workspace-root constant: the two duplicate root constants
(`lint-rules.spec.ts:66`, `lint-scope-drift.spec.ts:83`), the two verbatim reader
re-implementations (`lint-scope-drift.spec.ts:233-238`, `public-surface.spec.ts:73-76`), and the two
raw reads (`nx-target-inputs.spec.ts:59` and `:80`, `pinned-deps.spec.ts:17` and `:96`). Where a
call site needs a transform, compose it with the shared stripper from the first commit rather than
inlining a filter. Do not weaken the docstring instead -- a helper whose docstring asserts canonical
status while three siblings author their own is worse than no helper, because the next contributor
believes the layer is canonical and does not check.

**Scope discipline, and it bounds the verify below.** ELEVEN files in `src` carry the four-levels-up
walk idiom (measured: `git grep -l -F "new URL('../../../" -- src`). Five of them are the T4-6 sites
above; the other six -- `capture-hashes-cli.spec.ts`, `consumer-action-runtime.spec.ts`,
`docs-cross-os.spec.ts`, `governance-docs.spec.ts`, `hash-parity/compare.spec.ts`,
`read-integration-hash.integration.spec.ts` -- are OUT of scope: T4-6's defect is the false
one-authored-copy claim plus the two verbatim reader re-implementations, not a repo-wide sweep, and
a wider diff buys nothing the docstring correction does not. Note also that
`docs-cross-os.spec.ts` carries the idiom inside a COMMENT, so a file-level absence gate over `src`
is unsatisfiable by construction -- the gate below is therefore scoped to the five named files.
Where the docstring must still describe reality, say "the one authored copy for the specs that read
through this layer" rather than an unqualified claim the six out-of-scope files would falsify.
  </action>
  <verify>
    <automated>cd packages/github-cache &amp;&amp; npx vitest run src</automated>
    <automated>cd packages/github-cache &amp;&amp; ! git grep -q -F "new URL('../../../" -- src/lint-rules.spec.ts src/lint-scope-drift.spec.ts src/public-surface.spec.ts src/nx-target-inputs.spec.ts src/pinned-deps.spec.ts</automated>
    <automated>npm run check:action</automated>
  </verify>
  <done>One stripper exists, in `src/test/repo-file.ts`, with a three-fixture positive control plus the two truncation controls, and the trailing mode is opt-in with its opting callers named and their stripped views proven unchanged; the four other copies are gone; none of the five named T4-6 sites authors a workspace-root walk or re-implements the reader; the six out-of-scope files are untouched and the docstring's claim is true of the layer it describes; `select-backend.ts`'s claim matches the stripper's actual behaviour; `check:action` clean (`select-backend.ts` is bundled).</done>
</task>

<task type="auto">
  <name>Task 9: T3-3..T3-10 and the .gitignore fold -- prose this PR's own changes falsified</name>
  <files>packages/github-cache/src/lib/select-backend.spec.ts, packages/github-cache/src/backend/actions-cache-backend.spec.ts, packages/github-cache/src/backend/actions-cache-backend.ts, packages/github-cache/src/backend/memory-backend.ts, packages/github-cache/src/backend/releases-backend.ts, packages/github-cache/src/backend/releases-backend.spec.ts, packages/github-cache/src/backend/types.ts, packages/github-cache/src/lib/release-asset-name.integration.spec.ts, packages/github-cache/src/lib/release-asset-name.ts, packages/github-cache/src/cleanup/cleanup.ts, packages/github-cache/src/lib/retention.ts, packages/github-cache/src/lib/compression-method.spec.ts, eslint.config.mjs, packages/github-cache/src/hash-parity/compare.ts, docs/trust-and-security.md, .gitignore, start-cache-server/index.js</files>
  <action>
Prose deletion, grouped into commits by file family. For each item the check is that no surviving
assertion depended on the deleted claim -- verify that; do not invent a test for a comment. Where a
deletion also warrants one line stating the current truth, use judgement; do not layer a correction
paragraph onto a retracted one.

**T3-3** `select-backend.spec.ts:369-397` claims the test drives the real put; the body calls the
selector and the narrowing predicate and stops. Correct the claim to describe the assertion that is
there. Keep the citation about not shipping a tautological security test -- but state honestly that
the non-vacuity comes from the narrowing, not from a put.

**T3-4** `select-backend.spec.ts:52-56` names the shared temp directory as the archive location;
this PR moved it into the repo-local cache directory (`cache-archive-path.ts:75`), which makes the
parallel-worker race the comment reasons about a different and slightly worse hazard. Correct it,
and correct the three test titles at `actions-cache-backend.spec.ts:286`, `:316` and `:325` that
carry the same stale word.

**T3-5** Six comments name the superseded port type at the sites where the new one is DECLARED,
which is the exact wrong place for it since the whole argument for the new type is that the
factories declare it: `actions-cache-backend.ts:75` and `:243`, `memory-backend.ts:51` and `:73`,
`releases-backend.ts:118`, `releases-backend.spec.ts:174`. Rename in prose only -- do not widen any
annotation (that re-widening is deferred as T4-8).

**T3-6** `types.ts:46-50`'s line citation was invalidated by a 37-line insertion in the same
changeset. Re-anchor by NAME, per this repo's own stated convention.

**T3-7** `release-asset-name.integration.spec.ts:28-42` describes a two-commit move as still in
progress; all three halves landed, the sites row is empty and the original is gone. Delete those
lines including the spelling lock for the finished transition; keep lines 4-26, which explain why
the integration path rather than the unit path and are load-bearing.

**T3-8** Three files each independently re-argue that the legacy asset-name branch cannot reach any
population: `release-asset-name.ts:146-158`, `cleanup.ts:93-102`, `retention.ts:88-96`. Collapse to
ONE canonical statement, in the module that owns the predicate, and leave pointers at the other two.
Keep the predicate itself and its spec coverage: deleting exported surface is a consumer-contract
change and out of scope for a quick task, and T1-2 forbids touching the accepter's reachability. Of
the three files, `release-asset-name.ts` and `retention.ts` ARE bundled and `cleanup/cleanup.ts` is
NOT (measured from the bundle's own module markers -- see execution rule 2). Run `check:action` and
stage the regenerated bundle if it moves.

**T3-9** `retention.ts:46-54` defends the reuse of a byte-identical prefix literal on an invariant no
test enforces, and omits the actual latent consequence: a six-decimal-digit shard tag satisfies the
current asset-name filter, so a shard tag is a syntactically valid current asset name. Fix the PROSE
to state the deliberate non-aliasing recorded at `release-asset-name.ts:101` and to name that
consequence. Do NOT single-source the prefix from the cache-key constant: quick `260803-fcd`
retracted that exact collision objection and the record documents the identical-bodied filters as
DELIBERATELY not aliased. Comment-only, so the bundle should not move -- confirm with
`check:action`.

**T3-10, four sub-items.** (a) `docs/trust-and-security.md:155-160` sends a consumer to a file that
mentions no Nx, no pin and no fixture; point at the file that actually documents the pin, or delete
the pointer. (b) `compression-method.spec.ts:45` rejects one spawn helper over a buffer ceiling the
accepted helper shares -- correct the reason or drop it. (c) `eslint.config.mjs:64-72` claims the ban
covers the whole machine-dependent surface; it is false for named imports of four further accessors.
Narrow the CLAIM to the accessors actually banned. Widening the accessor list instead is NOT measured
and is out of scope here -- if you take it, it needs its own EVASION_SHAPES rows and a clean package
lint run, exactly as task 4 required. (d) `compare.ts`'s one-line collapse helper carries 52 comment
lines of review narrative; cut the narrative about prior revisions, keep the invariant and the
tempting-alternative block.

**The `.gitignore` fold.** The file states it covers any untracked workspace-root artifact and
leaves four unignored: two record directories and two binary payload files. The first breaks the
clean-working-tree signal that `capture-hashes.mjs` records, which is how a local hash reproduction
loses its provenance. Add all four.
  </action>
  <verify>
    <automated>cd packages/github-cache &amp;&amp; npx vitest run src</automated>
    <automated>npm run check:action</automated>
    <automated>node -e "const s=require('fs').readFileSync('.gitignore','utf8');for(const p of ['hash-parity-records','integration-hash-records','payload.bin','roundtrip.bin']){if(!s.includes(p)){console.error('unignored:',p);process.exit(1)}}console.log('OK')"</automated>
  </verify>
  <done>Every falsified claim is deleted or restated true; no surviving assertion depended on a deleted claim; the legacy-branch reachability argument exists once with pointers; the prefix prose states the deliberate non-aliasing and the latent consequence without changing the code; all four artifact paths are ignored; `check:action` clean with any bundled-source edit's regenerated bundle staged in its own commit.</done>
</task>

<task type="auto">
  <name>Task 10: Acceptance battery in the main tree</name>
  <files>(no source changes; log files are scratch, never committed)</files>
  <action>
Run the full battery at HEAD, in the MAIN tree, uncached. `check:action` in particular must run in
the main tree: a junctioned worktree makes esbuild rewrite module paths and yields a FALSE drift
verdict.

Run, in order: the unit tests, lint, typecheck, format check, the action-bundle drift gate, and the
dead-code gate. Pipe each through `tee` to a log under the session scratchpad with a per-iteration
suffix, and capture `${PIPESTATUS[0]}` into a VARIABLE -- never `exit ${PIPESTATUS[0]}` inline,
which terminates the shell after one iteration and reports 0 over a battery that never ran. Keep the
per-iteration suffix on the log name: one-second timestamp resolution collapses fast iterations into
a single log holding only the last run.

The baseline at the start of this task was 1090 unit tests. RECONCILE the delta -- do not assert a
direction. Tasks 2, 4, 5, 6, 7 and 8 add cases; task 8 also CONSOLIDATES five comment-stripper copies
into one control suite, and task 5 may merge two case counts away, so the net can legitimately be
flat or even negative. What is not legitimate is an unexplained delta: account for every case added
and every case removed against the task that did it, and record the reconciliation in the SUMMARY. An
unaccounted-for DROP means a guard was deleted to reach green, which the success criteria forbid.

If anything is red, capture it BEFORE re-running -- Nx caches terminal output for successful runs
only, so the re-run destroys the failure's evidence. Then run the failing target once with the cache
skipped and streamed output before diagnosing.
  </action>
  <verify>
    <automated>npm run test</automated>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run format:check</automated>
    <automated>npm run check:action &amp;&amp; npm run fallow:ci</automated>
  </verify>
  <done>All six gates green at HEAD in the main tree; the unit-test delta against the 1090 baseline is reconciled case-by-case against the task that caused it, with no unaccounted-for drop; every commit is individually green; nothing under the scratchpad was committed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| GitHub REST 422 response body -> `publish-mirror.ts` upload classifier | Untrusted remote input decides whether a permanent policy rejection is a benign skip or a fatal fault (V5) |
| PR-triggered Windows runner -> default-branch Actions cache scope | The read-only knob is the control that keeps a consumer leg from writing; the T1-5 partition is what proves the knob is present (V4) |
| `process.env` / platform reads inside package source | The lint ban is the control that keeps OS-sensitive reads out of the cache-version inputs |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-bxj-01 | Spoofing | `publish-mirror.ts` 422 upload classifier | high | mitigate | Task 2: benign only when EVERY `errors[]` entry is the documented duplicate signature on a non-empty array; a decoy sibling, an absent body and an unreadable body are all fatal (DEC-1) |
| T-bxj-02 | Elevation of Privilege | Windows consumer legs in `ci.yml` | high | mitigate | Task 6: the partition's out-of-set clause keeps the knob off every producer, including via a workflow-level hoist; the in-set clause reddens a new non-conforming Windows job by name |
| T-bxj-03 | Information disclosure | Release assets on a public repo | medium | mitigate | Task 3: `docs/advanced.md` states plainly that pre-rename shards are unreachable by cleanup and must be removed by hand, so a consumer cannot believe they are pruned |
| T-bxj-04 | Tampering | ambient platform / environment reads | medium | mitigate | Task 4: the ban family is closed across all twelve measured shapes and proven by a test that FIRES against the real root config |
| T-bxj-05 | Tampering | `start-cache-server/index.js` action bundle | medium | mitigate | Every bundled-source edit stages its regenerated bundle in the same commit; `check:action` runs in the MAIN tree only |
| T-bxj-SC | Tampering | npm/pip/cargo installs | high | accept | No package is added by any of the 27 items (research verified), so the legitimacy gate has no subject |
</threat_model>

<source_audit>
## Multi-Source Coverage Audit

**GOAL** (quick-task description: address the 27 verified survivors) -- COVERED by tasks 2-9.

**REQ** -- no phase requirement IDs; this is a quick task. Requirement EXPOSURE is recorded in
CONTEXT.md: T1-1 to ROBUST-04/OBS, T1-2 to DOCS-07..10 + RETAIN, T1-3 to LINT-01..06, T1-5 to
XOS-09 + Phase 13, T1-7 to OBS-03 + CORR-02, T2-* to the TEST-08..11 coverage claims. No requirement
checkbox is falsified outright, so none is reopened.

**RESEARCH** -- Q1 (process ban) COVERED by task 4. Q2 (`namedInputs`) DEFERRED as T4-7a by CONTEXT
amendment; its drift-guard half COVERED by task 7. Q3 (fake timers) COVERED by task 3. Q4
(localizing guard) COVERED by task 6. The Don't-Hand-Roll table is honoured: no YAML parser, no
fourth root walk, no sixth stripper, no hand-rolled Nx input expander.

**CONTEXT** -- DEC-1 COVERED by task 2. DEC-2 COVERED by task 1 (the record) and by execution rule 8
(the boundary). The census rule COVERED by tasks 5, 6 and 7. The T1-5 localizing rule COVERED by
task 6. The T1-2 do-not-widen rule COVERED by task 3. The T1-3 family rule COVERED by task 4. The
"every fix carries a check that fails if the logic breaks" rule COVERED by the `<behavior>` blocks
and the mutation requirement in task 6. Commit granularity and main-tree execution COVERED by
execution rules 1-3.

**Item coverage, all 27:** T1-1 task 2. T1-2, T1-4, T1-7, T1-8 task 3. T1-3 task 4. T1-5 task 6.
T1-6 task 5. T2-1 task 7. T2-2, T2-3 task 6. T2-4, T2-6, T2-7 task 7. T2-5 task 8. T3-1, T3-2
task 5. T3-3 to T3-10 task 9. T4-6 task 8. T4-7 task 7.

**Exclusions (not gaps):** the seven deferred items (recorded, task 1); the zstd shim compression
inversion (documented ceiling, folded into T3-10c only as a claim narrowing); the
never-executed Windows regression detector (open by design).

No unplanned items.
</source_audit>

<verification>
1. All 27 items landed; the seven deferred items untouched and recorded.
2. Every commit independently green on lint, typecheck, test, format:check and check:action.
3. Unit-test delta against the 1090 baseline reconciled case-by-case; no unaccounted-for drop.
4. `nx.json` byte-unchanged (`git diff --exit-code -- nx.json`), RUN FROM THE REPOSITORY ROOT -- from
   the package directory the pathspec matches nothing and the gate returns 0 vacuously.
5. No surviving indentation-anchored pin on the count pipeline; no indentation-anchored NEGATIVE
   assertion anywhere in `dogfood-cross-os.spec.ts` (a byte-pinned negative goes vacuous rather than
   red); no new hand-authored count in any comment. The last of the three FAILED on the first pass --
   the T4-6 docstring introduced a count and a list, both wrong -- so the exception set it described
   is now derived by search and asserted by set equality in `repo-file.spec.ts` instead.
6. Every bundled-source edit paired with its regenerated bundle in the same commit.
7. The six mutations in task 6 each produced exactly the expected red, recorded in a commit message.
</verification>

<success_criteria>
- 27 of 27 items closed; 0 of 7 deferred items implemented.
- The measured run-30767511870 payload shape makes the publish leg RED.
- `read-back.spec.ts` is calendar-independent.
- The Windows read-only guard localizes all three failure modes the cardinality gate conflated.
- No guard relaxed, scoped down or deleted to reach green.
- Full acceptance battery green at HEAD in the main tree.
</success_criteria>

<output>
Create `.planning/quick/260810-bxj-address-the-27-verified-survivors-of-the/260810-bxj-SUMMARY.md`
when done.
</output>
