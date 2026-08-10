# /simplify PR #16 -- triage ledger

8 review agents (4 lenses over the whole diff, 4 components in depth). Findings deduped by
MECHANISM, not by line. Scope excluded `.planning/`, `package-lock.json`, and the generated
`start-cache-server/index.js`.

Triage authorities, in precedence order:
1. A satisfied requirement in `REQUIREMENTS.md` (a finding that contradicts one is not a cleanup).
2. DEC-2 / `260810-bxj-deferred-items.md` -- seven structural items already deferred to v0.0.3.
   DEC-2 is a stated PR #16 decision, not just a planning note.
3. A recorded in-code decision (an argued retention is not dead code).
4. `260810-bxj` precedent: no guard is weakened; a guard that reddens gets the CODE changed.
5. Top Lesson #1: local gates cannot prove GitHub Actions runtime behaviour.

---

## ACCEPT -- 15 survivors

Local, behaviour-preserving, no guard weakened, no requirement contradicted.

| # | File | Change | Hits |
|---|------|--------|------|
| A1 | `src/test/repo-file.ts:58` | memoize `readRepoFile` in a module-scope Map | 1 (measured) |
| A2 | `src/dogfood-cross-os.spec.ts:59` | memoize `jobBlock`; hoist the per-line `new RegExp` | 4 |
| A3 | `capture-hashes.mjs:59-64` | six `nx/src/...` imports -> `await import()` in the 4 users | 1 (measured) |
| A4 | `capture-hashes.mjs:385` | hoist `createTaskHasher` out of the per-target loop | 2 |
| A5 | `compare.spec.ts:641`, `capture-hashes-cli.spec.ts:49`, `read-integration-hash.integration.spec.ts:91` | route through `repoFileUrl`; drop the 3 names from `WORKSPACE_ROOT_WALK_EXCEPTIONS` | 2 |
| A6 | `actions-cache-backend.spec.ts:747/782`, `cache-key.spec.ts:87/101`, `repo-file.spec.ts:171/211` | extract the package-source-tree walk into `test/repo-file.ts` | 1 |
| A7 | `docs-cross-os.spec.ts:142-167` | `SNIPPET_DISCRIMINATOR_SITES = 3` -> parse the JSON fence, assert per target key | 1 |
| A8 | `windows-regression-detector.spec.ts:72/154` | import `INVARIANT_TARGETS`; build both needles from it | 1 |
| A9 | `roundtrip/read-back.ts:185,501` | call `mirroredByLabel(readerOs)` instead of re-composing from the prefix | 1 |
| A10 | `cache-archive-path.spec.ts:118`, `compression-method.spec.ts:270` | dedupe `probeTokenOf`; the `\b`-stripping superset wins | 1 |
| A11 | `read-back.spec.ts:185`, `docs-same-os-claims.spec.ts:720` | delete two identity aliases | 1 |
| A12 | `compare.spec.ts:824` | delete the Prettier-import-shape assertion; keep the call-site one | 1 |
| A13 | `read-integration-hash.integration.spec.ts:145,159` | hoist the duplicated `read(ACCEPTED)` spawn | 1 |
| A14 | `eslint.config.mjs:333-372` | 6 `no-restricted-imports` entries -> flatMap over 3 pairs | 1 |
| A15 | `nx-target-inputs.spec.ts:850,948,985,1020,1027` | 5 identical assertions -> `it.each` (the stated objection is false: `it.each` names the row) | 1 |

A7 STRENGTHENS a guard (a count of 3 cannot prove three different target keys -- satisfiable by
deletion). A8's join products are byte-identical to today's literals, so no verdict changes.

---

## REJECT -- contradicts a satisfied requirement

- **Delete `lib/compression-method.ts`** (proposed by 3 agents) -- **VER-05** mandates it and
  pre-rejects the agents' reasoning: the value "is NOT readable from the library ... So this is an
  independent re-implementation and must mirror upstream EXACTLY." The `ACTIONS_STEP_DEBUG`
  alternative also fails VER-05, which requires it *surfaced in the publish summary*.
- **Delete the construction-time `mkdirSync`** (`actions-cache-backend.ts:183`) -- **VER-08**
  verbatim: it "live[s] in the shared read core; `put`'s second `mkdirSync` ... stay[s] on the write
  path unchanged and MUST NOT be 'unified' with the read path." The finding IS that unification.
- **Drop the `required`-phrase half of `docs-same-os-claims.spec.ts`** -- deletes DOCS-08 guards.

## REJECT -- overturns a recorded in-code decision

- **Delete `capture-hashes.mjs` clause 5** -- MEASURED reachable both ways (`FORBIDDEN_TARGETS = []`
  and `= ['zzz']` each make it fail first). The finding's premise is simply wrong.
- **Delete clause 6** -- unreachable, but the contract block argues the retention: "RETAINED
  deliberately rather than deleted, because a deleted clause is indistinguishable from one that
  never existed."

## REJECT -- already deferred to v0.0.3 (DEC-2)

| Finding cluster | Deferred item |
|---|---|
| composite-action extraction, `*-windows` matrix collapse, 19x checkout preamble, comment volume, `o3-witness` -> TypeScript, `npm ci` caching, build-artifact reuse | T4-1 |
| `publish-mirror.ts` restructure | T4-2 |
| split `dogfood-cross-os.spec.ts`; collapse the 3 byte-identical `*-windows` describes | T4-3 (its own note already cites the ~370 duplicated lines as the reason for the split) |
| `capture-hashes.mjs` mode-tail dedup / three-programs split | T4-4 |
| relocate the package-scope tree walks | T4-5 |
| `nx.json` `namedInputs` single-sourcing; the phantom `tools/eslint-rules/**/*` glob | T4-7a -- `nx.json` byte-unchanged is a stated PR decision |
| `ReadOnlyBackend` re-widening / four port names | T4-8 |

---

## UNRESOLVED -- recorded, NOT auto-decided

Each is HIGH-IMPACT and NOT-HIGH-CONFIDENCE: the `--auto` trap quadrant. Recorded per the standing
rule rather than auto-locked.

- **U1. Delete `isLegacyOsSuffixedAssetName` + the disjointness apparatus** (2 agents). Their
  public-surface objection is factually WRONG -- verified: `src/index.ts` exports only
  `createCacheServer` and the backend types. But it removes a DELETE-path guard, against the
  `260810-bxj` no-guard-weakened precedent, and two modules carry comment locks pointing at it.
- **U2. Replace the Wilson score interval with a flat ratio** (`publish-mirror.ts:54-103`). A
  behaviour change on a warning path; the file records that neither branch detects the rotation it
  was built for, which argues for revisiting the whole guard rather than its arithmetic.
- **U3. `SEED_MARKER_WORDS` leaks this repo's CI key families into the shipped publish engine.**
  CONFIRMED against `PROJECT.md:146` ("changes made for this repo's own CI/hashing must never leak
  into the consumer contract"). Genuine altitude defect; the fix relocates the filter to the
  `listCacheEntries` adapter seam -> NEW v0.0.3 item.
- **U4. Replace the `[remote cache]` log-grep gates with `run.json` `cacheStatus`** (2 agents). Better
  altitude -- per-task assertion retires the floor arithmetic, the `-a` text forcing, the shape
  `case` and the `|| true`. Needs a live runner to prove: Top Lesson #1.
- **U5. `read-back.ts` re-authors the REST walk `releases-backend.ts` has** (3 agents). Strongest
  evidence in the set: hardening has ALREADY landed per-copy -- the month-boundary fix and
  `MAX_ASSET_PAGES` exist in one copy only. Fix is a `lib/` leaf extraction -> NEW v0.0.3 item.
- **U6. Comment-to-code ratio 2.2:1, ~21 "comment about a previous comment" sites** (3 agents).
  Maintainer call on volume; no defect.
- **U7. `.gitignore` -> `/*.log`** (2 agents). Broadening the ignore set makes `capture-hashes.mjs`'s
  `workingTreeClean` probe MORE likely to report clean -- loosens a guard.
- **U8. `hash-parity/targets.json` to replace the regex-scrape lockstep** between `compare.spec.ts`
  and `capture-hashes.mjs` (3 mechanisms sharing one array). Touches the Phase 8/11 instrument.
- **U9. Windows `npm ci` costs ~180 s x4 new legs = ~12 min/push** (measured). Real, but every lever
  is a `ci.yml` restructure -> T4-1.

---

## Note for execution

`start-cache-server/index.js` is generated. None of A1-A15 touches a `serve()`-reachable source
(A9 touches `roundtrip/read-back.ts`, which is not in the `serve()` graph), so no bundle rebuild is
expected -- but `check:action` must confirm no drift before the final commit.
