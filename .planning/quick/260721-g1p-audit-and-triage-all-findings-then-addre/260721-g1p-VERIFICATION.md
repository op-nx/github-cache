---
quick_id: 260721-g1p
status: passed
verified_head: 6d268ac14ed22440cc7fdb34b73010c6d8176829
pr: 3
branch: gsd/v0.0.1-greenfield-rebuild
verified_at: 2026-07-21
---

# Verification - Quick Task 260721-g1p

Goal (verbatim): "Audit and triage all findings then address the findings that
remain. Get to green CI checks, then update the PR body according to
/gsd-core:ship if relevant."

Verdict: **passed**. Goal-backward against the code on HEAD `6d268ac` (working
tree clean). Every substantive finding is fixed in code, CI is green on the exact
checked-out commit, and the two remaining items are deferred with a sound
rationale.

## Goal decomposition -> evidence

### 1. Audit and triage all findings -> DONE
The 6-aspect review (code, silent-failure, tests, types, comments, simplify) was
triaged into a per-finding table (SUMMARY.md) mapping each finding to a fix and an
atomic commit. Commit history (ff91e52..6d268ac) matches the table.

### 2. Address the findings that remain -> DONE (verified in code)
All spot-checks confirmed against HEAD, not taken on faith:

- **C1 (Critical) - fail-closed on swallowed Actions-cache write** - CONFIRMED.
  `backend/actions-cache-backend.ts` put() captures `saveCache`'s id; on `>0`
  returns 'stored'; on `-1` runs a `restoreCache([...], key, [], {lookupOnly:true})`
  existence probe; returns 'stored' only if the entry is present, otherwise
  `throw`s (fail-closed, server 500). It is NOT the old unconditional
  `return 'stored'`. Defense-in-depth ReserveCacheError -> 'stored' arm and
  finally-rm cleanup both present.
- **I3 stdin crash** - CONFIRMED. `lib/local-context.ts:114`
  `child.stdin?.on('error', () => {})` attached before `.end(stdin)`.
- **I4 2 GiB operator mismatch** - CONFIRMED. `publish/publish-mirror.ts:194`
  uses `bytes.byteLength > RELEASE_ASSET_MAX_BYTES` (`>`), aligned with the server
  body cap.
- **Branded Hash + parseHash** - CONFIRMED. `lib/cache-key.ts` defines
  `type Hash = string & { readonly __hash: unique symbol }` minted only via
  `parseHash` (HASH_PATTERN gate). Threaded into `CacheBackend.get/put`
  (`backend/types.ts`), all three backends, `publish-mirror` (mints from each
  server-produced key suffix), the server route, and read-back. Landed by commit
  `a9dfe69` (after the SUMMARY was written - see the note below).
- **trust/sync `{ trusted, reason }` union** - CONFIRMED. `lib/trust.ts` and
  `lib/sync-gate.ts` both return the discriminated union with typed reason enums.
  The refactor is complete, not half-done: callers `lib/select-backend.ts:32`
  (`!isWriteTrusted(env).trusted`) and `action/index.ts:125` (`!sync.trusted`,
  logs the reason) consume `.trusted`. Landed by commit `1a7ea70` (post-SUMMARY).
  Commit message pins the invariant: only the return SHAPE changed, the trust
  decision per input is byte-identical (42 + 21 gate specs pass unchanged).
- **Real integration target + spec (I1)** - CONFIRMED. `project.json` declares an
  `integration` target (`vitest run --config vitest.integration.config.mts`).
  `server/public-server.integration.spec.ts` exercises the public
  `createCacheServer` factory over a real loopback socket + real `fetch`:
  authenticated PUT->GET byte round-trip, 401 unauth, 404 miss. This replaces the
  previously-vacuous integration job and runs on the ubuntu+windows matrix.

### 3. Get to green CI -> DONE (first-hand)
- `gh pr view 3` check rollup on head `6d268ac` (== local HEAD): all 10 active
  pull_request jobs SUCCESS - format-check, fallow, action-bundle-drift,
  pack-check, ppe, build, typecheck, test, integration (ubuntu-24.04-arm),
  integration (windows-11-arm). The 5 SKIPPED jobs (dogfood-seed, consumer-smoke,
  publish, dogfood-verify, publish-verify) are push/publish-triggered, not
  pull_request gates.
- Local first-hand run: `npx nx run-many -t typecheck test integration
  --skip-nx-cache` -> exit 0, "Successfully ran targets typecheck, test,
  integration"; 342 tests passed (27 files) + integration green.

### 4. Update PR body per ship -> EXTERNAL CLAIM (not disk-checkable)
The PR body lives on GitHub, not in the repo, so it cannot be verified from the
working tree. Treated as an unverified external claim; not counted against the
verdict.

## Deferred items - rationale sanity-check (sound)

Two findings remain deliberately deferred (matches the task context's "two items
intentionally NOT done"):

- **Read-only backend put-less split (type-design #5)** - SOUND. The reviewer
  hedged ("current design is defensible"). A put-less variant would push the
  RW-vs-RO distinction back into the type surface, directly contradicting the
  deliberate D-01/TRUST-05 design where the backend factory takes NO mode argument
  and the upstream write gate owns that decision. The current read-only backend
  (put -> 'forbidden') is a valid, tested design; splitting it would degrade
  shipped, architecturally-motivated code. Deferral is correct.
- **package.json dependency split (code-reviewer #6)** - SOUND. This is a
  published package; splitting deps off the default entry changes the published
  consumer contract. Deferring a contract-breaking change mid-milestone rather
  than forcing it under a "get to green" task is the right call.

## Note - SUMMARY.md is stale (documentation, not a gap)

The SUMMARY frontmatter cites `verification: ... on 7413363` and its "Deferred"
section lists 7 items (incl. branded Hash, trust/sync union, code-simplifier
simplifications, supply-chain hygiene). Those were accurate when the SUMMARY was
written at commit `ebeb06b`/`7413363`. Work then continued: `e2c7160`
(simplifications), `3c8fb31` (code-reviewer #5/#7/#8 supply-chain + hygiene),
`a9dfe69` (branded Hash), `1a7ea70` (trust/sync union), `6d268ac` (bundle
rebuild) - shrinking the real deferred set from 7 to 2. Net effect: the code on
HEAD is MORE complete than the SUMMARY claims, and CI is green on the newer HEAD
`6d268ac` (run 29844203449) rather than the cited `7413363`. This is SUMMARY
staleness only; it does not affect goal achievement. Recommend refreshing the
SUMMARY's `verification:` sha and trimming its Deferred list to the two genuine
items.

## Verdict
**passed** - the goal (triage all findings, fix what remains, green CI) is met on
HEAD `6d268ac` with first-hand code + CI + local-run evidence. The only follow-up
is cosmetic: refresh the stale SUMMARY.md metadata.
