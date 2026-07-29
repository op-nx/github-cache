---
phase: 10-os-invariant-releases-mirror
audited_tree: e939475
audited_range: 06019d4..HEAD
branch: gsd/v0.0.2-os-invariant-cross-os-sharing
audited_at: 2026-07-29
auditor: gsd-security-auditor
config:
  security_enforcement: true
  security_asvs_level: 1
  security_block_on: high
status: passed
blocker: false
threats_total: 31
threats_verified: 31
threats_partial: 0
threats_open: 0
severity_breakdown:
  high: 10
  medium: 11
  low: 10
severity_open:
  critical: 0
  high: 0
  medium: 0
  low: 0
disposition_breakdown:
  mitigate: 23
  accept: 8
register_authored_at_plan_time: true
unregistered_flags: 0
new_findings_total: 1
new_findings:
  - id: F-10-A
    severity: low
    category: repudiation
    title: three stale same-OS-restore prose sites survive in the publish engine and its spec
    state: open_informational
    file: packages/github-cache/src/publish/publish-mirror.ts
hygiene_scan:
  method: allowlist-inversion
  files_scanned: 43
  disallowed_maintainer_tokens: 0
  commits_checked: 35
  commit_identity_clean: true
edits_made: []
battery_reverified:
  - test
  - lint
  - check:action
requirements_closed_by_this_audit:
  - TRUST-13
---

# Phase 10 Security Audit -- OS-Invariant Releases Mirror

**Verdict: `passed`. 31 of 31 register rows verified against the implemented artifact.
Zero open threats at any severity, so nothing blocks phase advancement under
`security_block_on: high`.**

Method: for each row I read the stated mitigation and then read the artifact it names --
source, spec, workflow, config, or git history. No row was credited on a SUMMARY's or a
PLAN's claim. Nine rows were additionally confirmed by RUNNING something rather than by
reading: `npm run check:action` (exit 0, EMPTY bundle diff, in the MAIN tree), the unit
suite (`823 passed (823)` across `39 passed (39)` files, `--skip-nx-cache`), `npm run
lint` (exit 0), and six `git diff` / `git show` / `git log -S` observations re-run at HEAD
rather than transcribed from `10-TRUST-EVIDENCE.md`.

`10-TRUST-EVIDENCE.md` Part B was treated as a party's submission, per its own B0. I
adopted its Q1/Q2 proposal, on my own evidence and with two refinements it does not state
-- see section 1. B8's process constraint was honoured: the inline short-circuit was not
taken, and this file was authored by the auditor, not by the orchestrator.

---

## 1. TRUST-11 / TRUST-12, classified (this closes TRUST-13)

TRUST-13 (`.planning/REQUIREMENTS.md:445`) requires TRUST-11 and TRUST-12 to be
"classified by gsd-security-auditor in SECURITY.md, not self-certified", with the proposed
classification treated as INPUT. The proposal under evaluation, from
`10-TRUST-EVIDENCE.md` B2:

> Neither crosses a trust boundary, because the Actions cache's boundary is ref scope, not
> OS.

**I ADOPT that conclusion for both questions. I REFINE its ground: as stated it is
necessary but not sufficient for Q1, and for Q2 it is conditional on a control this phase
newly made load-bearing.** Both refinements are stated below because if either supporting
leg failed, the verdict would change -- and a one-sentence ground hides that.

### Q1 (TRUST-11) -- the first-write-wins race between two same-hash producers

**Classification: does NOT cross a trust boundary. Severity of the residual: LOW today,
re-priced by Phase 12. Not a Phase 10 gap.**

Two independent legs carry that verdict, and I verified each in code rather than accepting
either:

**Leg A -- no new principal gains write capability.** Who may write `nx-cache-<hash>` into
the Actions cache is decided by C1 (`lib/trust.ts`, `TRUSTED_EVENTS = ['push',
'schedule']`), by C2 (`lib/sync-gate.ts`, `isSyncTrusted`'s default-branch check), and by
GitHub's own per-ref cache scoping. All three are OS-blind. I re-ran the observation rather
than reading it: `git diff --stat 06019d4..HEAD` and `git diff --stat ff21b5f..HEAD` over
`lib/trust.ts` + `lib/sync-gate.ts` are BOTH empty at HEAD. Nothing in the C1-C18 ledger
(`.planning/THREAT-MODEL.md`) derives an authorization decision from an OS. Under
CVE-2025-36852's model the defended property is "only VCS-trusted principals may write",
and the race is between two legs of the SAME trusted workflow run on the SAME ref -- two
principals that were already mutually trusted before this milestone began. Phase 9's audit
reached the same conclusion from the other direction (`09-SECURITY.md` section 1: "the OS
partition was an accident of the version hash, never a security boundary"), and that is the
reframing that makes this assessable rather than alarming.

**Leg B -- in THIS phase the arbitration is over byte-identical payloads, so there is
nothing to arbitrate.** This is the leg B2's sentence omits, and it is what makes the
answer hold at the site CORR-02 actually changed. Read in
`packages/github-cache/src/publish/publish-mirror.ts`: `const entries = await
client.listCacheEntries();` is one snapshot before the loop; inside the loop `const
restored: GetResult = await actionsCache.get(hash);` then `const bytes = restored.bytes;`
then `client.uploadReleaseAsset(shard.id, name, bytes, label)`. There is no build, no
command spawn, and no regeneration anywhere on that path -- the bytes uploaded are the
bytes the Actions cache returned. For one key the Actions cache holds one entry, so both
legs upload the same bytes and the `shard.names.has(name)` skip and the 422 `already_exists`
catch are content-neutral no-ops. **B3's correction is right, and I verified its
precondition independently rather than accepting it:** `build` (`ci.yml:208`), `typecheck`
(`:282`) and `test` (`:338`) are all `runs-on: ubuntu-24.04-arm` single-leg, and the only
two-OS producer matrix, `integration` (`:415-419`), carries the `{ "runtime": "node -p
process.platform" }` discriminator in its own target inputs (`nx.json:102`, and
`git diff --stat 06019d4..HEAD -- nx.json` is empty), so its two legs compute DIFFERENT
hashes and cannot collide at `saveCache` either. Exactly one producer per hash exists
today.

**What the residual actually is, stated so Phase 12 inherits it as a question and not as a
reassurance.** The genuine race is two producers computing hash H on different OSes and
both calling `saveCache(nx-cache-H)`; the winner owns the entry INCLUDING its OS-specific
captured terminal output. That is a determinism and attribution property, not an
authorization one -- no reader receives bytes from an untrusted writer either way. It
becomes reachable when XOS-04 puts `build`/`typecheck`/`test` on a Windows leg, which is
the **XOS-05 write decision in Phase 12**. XOS-06 is satisfied here because no requirement
depends on the winner, NOT because the race does not exist, and the engine's own comments
say so in those terms (`publish-mirror.ts:165-176`, `:303-310`).

**One place the race is not content-neutral even today, and it is already priced.** The
`label` differs by winner (`mirrored-by: linux` vs `windows`), and the label is the sole
input to OBS-05's dead-leg detector. Concurrent legs would therefore redden
`publish-verify` on a CORRECT implementation. I agree with U-01's line (`10-RESEARCH.md`
`## U-01 Resolution`, `10-TRUST-EVIDENCE.md` B9): that is a guard's SENSITIVITY, not a
wrong-result guarantee, and it is acceptable with the dependency recorded. It is
comment-locked in both required places -- `roundtrip/read-back.ts:73-89` and
`ci.yml:1064-1083` -- and I read both.

### Q2 (TRUST-12) -- collapsing the asset namespace from `<hash>-<os>` to `<hash>`

**Classification: does NOT change the public-repo exposure surface. Phase 10's own delta
is an ATTRIBUTION change. The exposure delta belongs to Phase 9 and is BOUNDED. Not a
Phase 10 gap.**

What an anonymous reader can reach is a function of three things: which Actions-cache
entries a publish leg may ENUMERATE, which of those it can RESTORE, and the Release's
visibility. Phase 10 changes none of them.

- **Enumeration: unchanged.** The `ref` scoping and C16's `isServerProducedKey` filter both
  survive untouched. `git diff --unified=0 06019d4..HEAD -- lib/cache-key.ts` filtered to
  non-comment lines returns nothing (`rg` exit 1, a genuine no-match, positive-controlled
  by the same pipeline finding real code lines elsewhere), so `isServerProducedKey`'s
  accept/reject sets are byte-unchanged.
- **Restore: unchanged by this phase.** VER-01/VER-03 in Phase 9 are what made a single leg
  able to restore every OS's entries. That is the real exposure delta, it is live and
  measured (run `30400231720`: the same four all-decimal hashes crossing under both
  `-linux` and `-windows`), and it predates this phase's first commit.
- **Visibility: unchanged.** No `permissions` change anywhere. I established this the
  strong way rather than by reading the block: the ENTIRE non-comment diff of
  `.github/workflows/ci.yml` across the phase is exactly two lines --
  `needs: build` -> `needs: [build, typecheck, test, integration]`, and
  `operation: seed` -> `operation: mirror-seed`. Nothing else in that file changed except
  comments.

So the SET of bytes crossing into the anonymously-readable mirror is identical before and
after CORR-02; only the number of assets per hash falls (from one per publishing leg to
one) and the in-name OS token disappears. That token was itself public metadata, so its
removal publishes marginally LESS about the producing fleet, and OBS-03's `label`
republishes only the PUBLISHING leg's OS. Net exposure change: none.

**The refinement, which is the part I will not leave implicit.** "The boundary is ref scope,
not OS" is now a statement about a SINGLE argument in a SINGLE call. Phase 9 removed the
incidental OS narrowing, so the `ref` option on `octokit.paginate(...
getActionsCacheList)` is the only place the reachable set is still narrowed
(`action/index.ts:81-84`). `TRUSTED_EVENTS` admits `push` with no ref check, so entries
from a non-default-branch trusted write genuinely sit in the Actions cache awaiting
enumeration. Losing that one argument is an information-disclosure change that announces
itself as NOTHING -- no MISS, no red job, a mirror still reporting success. **Q2's "no
change" verdict is therefore conditional on T-10-02's control, and it is exactly because
Phase 10 pinned that control by spec, mutation-checked it, and comment-locked it that I can
close Q2 rather than open it.** This inherits `THREAT-MODEL.md`'s own recorded residual
("containment is single-layer ... gate correctness is load-bearing with no backstop"); see
residual note 3.

---

## 2. Row-by-row verdicts

All 31 rows `verified`. Evidence is the artifact read or the command run, never a
SUMMARY's claim. Rows are grouped by the plan that authored them; a row appearing in more
than one plan's `<threat_model>` is verified once, at its strongest site.

### The 10 HIGH rows -- the gate under `security_block_on: high`

| ID | Category | Evidence |
|---|---|---|
| T-10-01 | Tampering | Two separately named branches in `lib/release-asset-name.ts:108-166`, both from single-sourced `CACHE_KEY_PREFIX` / `HASH_PATTERN` / `CACHE_OS_VALUES`, zero re-authored regex, and NO third branch for the PoC-era family. Verbatim preservation independently proven, not accepted: `git show 06019d4:...release-asset-name.ts` prints the pre-phase `isServerProducedAssetName` body character-for-character equal to the current `isLegacyOsSuffixedAssetName` (same five statements, same order, `separator < 0` early return included), so the widening can only ADD. Disjointness asserted DIRECTLY over a 26-row adversarial table with the both-true count pinned to `[]` (`release-asset-name.spec.ts:310-316`), a `toHaveLength(26)` row-count pin, the three MECHANISM atoms plus the composed argument (`:207-244`), and a non-vacuity companion proving neither branch is dead (`:318-336`). Mixed-shard cleanup dry-run present and two-directional: `cleanup.spec.ts:295-339` asserts deleted-set EQUALITY against the prunable set, then per-retained-name non-containment, with fixture-shape locks asserted BEFORE the act. |
| T-10-02 | Information disclosure | The comment lock is at `action/index.ts:47-80` and carries every required clause: what the `ref` governs, BOTH supporting facts (`TRUSTED_EVENTS` admits `push` with no ref check; the OS-version barrier removed by VER-01/VER-03), the failure mode named as an INFORMATION-DISCLOSURE change and explicitly "not a cache MISS", and the guard named by describe so deleting the comment does not delete the protection. The pin is at `action/index.spec.ts:240-305`: a whole-`mock.calls[0]`-array `toEqual` against a named endpoint sentinel plus the full options object, driven by `it.each` with two distinct constructor refs (the second a non-default-branch ref), PLUS a separate `toHaveBeenCalledOnce()` case. Three regressions, three different reddening cases. |
| T-10-11 | Repudiation | `10-EVIDENCE-PRE-RENAME.md:116-152` records the VERBATIM Nx outcome lines (`Cache: 0/1 hit (0%)`, `Cache: 0/4 hit (0%)`, no `[remote cache]` marker) and `:24` records the MISS AS a MISS. No HIT is claimed at `06019d4`. The prior 2026-07-26 record is cited as a corroborating prior for the Nx-consumption half only (`:206-209`) and is explicitly NOT substituted for the fresh capture. Openness is disclosed as an inherited gate (`:210-216`) and as the phase's third Live-CI item. See correction 1 -- the register said "OPEN BLOCKER", the artifact records "OPEN PRECONDITION", and I accept the substitution with reasons. |
| T-10-16 | Repudiation | Verified at all three of its sites. `dogfood-cross-os.spec.ts:167-171` is a positive control scoping `jobBlock('publish')` to a real non-empty block via an `if:` expression unique to that job, so a wrong-block or empty-string extraction cannot pass; the superset hole is closed by four SEPARATE per-producer cases including the `build`-SURVIVES clause (`:173-189`), each anchored at `^ {4}needs:` so a step name cannot satisfy it. The destroyed non-vacuity proof's replacement was authored ONE COMMIT EARLIER, proven from history rather than prose: `git show 8fc9b64 -- releases-backend.spec.ts` contains the `CACHE_OS_VALUES`-looped replacement, and the `CORR_05_SITES` rows are deleted in `77f675c`. The emptied table is replaced by a positive assertion (`lint-rules.spec.ts`, `expect(CORR_05_SITES).toEqual([])`). Two independent mutation reproductions already exist in `10-VERIFICATION.md` (the `needs:` 3-of-4 split; the `cachePlatform` hoist, exactly 1 of 28). |
| T-10-18 | Tampering | The branch builds its OWN url: `action/index.ts:375-384` binds `producerOs`, `seedHash`, `seedUrl` and `body` INSIDE the branch; the shared `url` at `:308` is not referenced there and nothing is hoisted above the branches. Comment-locked with the exact failure mode at `:356-363` ("the PUT would still return 200 ... the break would surface only as a publish-verify MISS"). The spec pin is written so a substring cannot satisfy it: `action/index.spec.ts:542-545` asserts the WHOLE url by equality against the derived seed AND asserts the final path segment `not.toBe(RUN_ID)`. `it.each(CACHE_OS_VALUES)`, so all three legs are driven. |
| T-10-20 | Repudiation | `roundtrip/read-back.ts:96-185` reads the `mirrored-by` label of the asset THIS leg seeded and rejects on inequality, catching a different publisher, an EMPTY label and a null one in one comparison. It detects a dead publish path on EITHER leg under EITHER ordering -- the cross-producer matrix at `read-back.spec.ts:335-357` drives every ordered pair with the two differing, with the bytes deliberately correct so the fixture passes every other assertion in the file. Mutation-proven OFFLINE against a fake asset listing (`:309-313` states why: `publish` is push-gated, so a live demonstration would mean breaking `main`). The empty-label case is not hypothetical (`:359-375`, all 122 live shard assets predate OBS-03). The `max-parallel: 1` sensitivity exposure is comment-locked in BOTH places as sensitivity and never as a wrong-result guarantee: `read-back.ts:73-89` and `ci.yml:1064-1083`. |
| T-10-25 | Tampering | Verified by RUNNING it in the MAIN tree, not by reading a claim: `npm run check:action` exits 0 with an EMPTY `git diff` on `start-cache-server/index.js`. Same-commit rule proven from history: `git log --oneline 06019d4..HEAD -- start-cache-server/index.js` returns EXACTLY ONE commit, `77f675c`, which is the same commit as the `serve()`-reachable `release-asset-name.ts` edit (`git show --stat 77f675c` lists both, bundle at 13 lines). The standing CI guard exists and is PR-eligible: `ci.yml:99-108` `action-bundle-drift` carries NO `if:`, and that shape is itself asserted (`dogfood-cross-os.spec.ts:226+`). |
| T-10-26 | Tampering | The comment lock is at `lib/cache-key.ts:12-35` and names all FOUR consumers individually, the orphaning consequence ("editing this string ORPHANS THE ENTIRE MIRROR"), AND the clause the register requires -- that RETAIN-04's legacy branch does NOT cover the orphans because it only knows `<hash>-<os>`. The authored-occurrence guard is extended as claimed: `cache-key.spec.ts:108-158` pins `total` to 1, `cache-key.ts` to 1, and `release-asset-name.ts` to **0**, with spec files deliberately absent and that absence explained. I checked the fourth consumer separately: `cleanup/cleanup.ts` and `cleanup/index.ts` contain the literal only inside one comment, never authored. |
| T-10-29 | Repudiation | **I am the control, and this is the row closing by my independent classification rather than by anyone asserting it.** The plan-side half is in place -- `10-TRUST-EVIDENCE.md` B0 frames all of Part B as INPUT, B1 states both items as questions, B2 labels the proposal as INPUT and says in as many words that an auditor may reject it, and B8 records the process constraint by name. The auditor-side half is section 1 of this file: I reached the Q1/Q2 verdicts from artifacts I read and commands I ran, adopted B2's conclusion in my own words, and refined its ground in two places (Leg B for Q1; the conditionality on T-10-02 for Q2). The short-circuit at `secure-phase.md` was NOT taken; no orchestrator authored this verdict. |
| T-10-30 | Repudiation | `10-SC6-NOTES.md:14-83`. Both research corrections are present and BOTH are labelled as corrections under their own headings (`### CORRECTION 1 -- it depends on XOS-07's widened needs:`, `### CORRECTION 2 -- "ZERO assets" is false`), with `:23-24` stating plainly why the labelling exists. Both halves of the collapse argument sit side by side in one two-row table (`:65-68`), FOR and AGAINST. The second, non-expiring reason is recorded SEPARATELY under its own heading (`:73-83`) with an explicit note on how the two reasons age differently. The matching `ci.yml` publish-comment correction landed in `d4fc928` and I read the diff. |

### MEDIUM rows

| ID | Category | Disposition | Evidence |
|---|---|---|---|
| T-10-03 | Repudiation | mitigate | `publish-mirror.ts:230-256`. The value is comment-locked as the PUBLISHING leg's OS with the producing-OS claim explicitly retracted, on both stated grounds: `listCacheEntries` yields `{ key }` only so a producing-OS claim "could only ever be fabricated here, never derived"; and Phase 9 broke publisher-equals-producer. The retraction, not the label, is treated as the security-relevant half. |
| T-10-04 | Tampering | accept | Not reachable here, and I verified the reason structurally rather than accepting it (section 1, Leg B): one entry per hash, verbatim re-upload, no task re-execution, single producer per hash today. The byte-identity comments SURVIVE with a changed reason at BOTH required sites (`publish-mirror.ts:165-176` and `:303-310`), and both name T-10-04's residual as a later phase's write decision. Logged in section 3. |
| T-10-10 | Information disclosure | mitigate | `10-EVIDENCE-PRE-RENAME.md` records counts and names only and states at `:228-229` that no raw `gh api` payload was pasted because some fields carry committer identity. The resolved token is recorded as `len 40`, never a value (`:182`). I re-scanned the file for `ghp_` / `ghs_` / `gho_` / `github_pat_` / `X-Amz-` / `Signature=` / `Authorization:` / `uploader` / `node_id` / `"login"`: `rg` exit 1, a genuine no-match. |
| T-10-14 | Denial of service | mitigate | `ci.yml:1003-1019`. The rewritten comment NAMES the failure mode in the register's own terms: the `!cancelled()`-past-a-FAILED-`needs:` behaviour is marked CITED from GitHub docs and never reproduced in this repo, the downside is bounded in writing ("a recoverable GAP, never a wrong artifact reaching the world-readable mirror"), and the sentence "an operator diagnosing a missing mirror should find the cause written here" is present. The superseded `needs: build` argument is retained rather than deleted so it is not reconstructed. |
| T-10-15 | Information disclosure | accept | Verified the strong way: the ENTIRE non-comment `ci.yml` diff for the phase is two lines (`needs:` and `operation:`), so the set of tasks routed through the sidecar is provably UNCHANGED -- no target list, no sidecar `uses:` site, and no `env` moved. The governing invariant is unchanged. Logged in section 3. |
| T-10-17 | Tampering | mitigate | Structural, not probabilistic. `lib/mirror-seed.ts:59-61` emits `feed<index><runId>`; the marker contributes hex LETTERS while run ids and Nx task hashes are all-decimal. Disjointness from the shipped `cafe<run_id>` family asserted DIRECTLY (`mirror-seed.spec.ts:87-94`: `startsWith('cafe')` false AND `not.toBe('cafe'+RUN_ID)`), per-OS literals HAND-AUTHORED rather than rebuilt from the helper (`:44`, `:67`), `HASH_PATTERN` membership asserted (`:75`), injectivity by `new Set(seeds).size === CACHE_OS_VALUES.length` (`:101`), and the single-digit precondition PINNED not assumed: `expect(CACHE_OS_VALUES.length).toBeLessThan(10)` (`:112`), with the encoding consequence of a tenth member written out at `mirror-seed.ts:24-32`. |
| T-10-22 | Denial of service | mitigate | `read-back.ts:132-158` paginates the ASSETS endpoint with an explicit `per_page` and exits on a SHORT page, and the comment states why the release payload's inline `assets` snapshot is refused (first-page-capped; the live shard already holds 122). Pinned by a genuine multi-page case: `read-back.spec.ts:377-414` fills page one to EXACTLY the page size (a 99-row page would have proved nothing, and the comment says so), asserts two pages were requested in order `['1','2']`, and asserts `per_page` is the explicit value rather than the endpoint default of 30. Termination is pinned separately at `:416-430`. |
| T-10-23 | Repudiation | mitigate | Proven from git, not from prose: the replacement clause is in `8fc9b64` (`test(10-06)`) and the proof it replaces is deleted in `77f675c` (`feat(10-07)`) -- one commit later -- so the invariant never has zero guards. The replacement's shape is right too: `releases-backend.spec.ts` asserts `client.requested` deep-equals `[releaseAssetName(...)]` then loops the WHOLE `CACHE_OS_VALUES` tuple, never a hand-authored `'linux'`. The coverage cliff is converted to a positive assertion (`expect(CORR_05_SITES).toEqual([])`) and the HISTORICAL block with its two recorded miscounts survives. |
| T-10-24 | Denial of service | mitigate | ADD-only verified from history (`git show --stat 8fc9b64`: 284 insertions, no deletion column on any file; `10-06-SUMMARY.md:161` records `git diff --diff-filter=D HEAD~1 HEAD` empty). Every existing `eslint-disable` directive left in place. `reportUnusedDisableDirectives: 'error'` confirmed present at `eslint.config.mjs:185` -- which is what would otherwise turn a stray deletion into a build failure. `npm run lint` re-run at HEAD: exit 0. |
| T-10-27 | Repudiation | mitigate | Sequencing proven from the commit graph: the `mirrored-by` label landed in plan 10-02 (`21385b8`, `c555cb7`), which precede 10-07's rename (`77f675c`), so attribution never lapsed. The label names the PUBLISHING leg and the retraction is comment-locked at `release-asset-name.ts:61-66` and `publish-mirror.ts:235-248`, with a machine-enforced retraction guard (`docs-same-os-claims.spec.ts:441-455`, `/whose byte[s]/i`, written with a character class so the spec does not plant the phrase). See correction 2: that guard is 12-file-scoped, not "repo-wide" as the register text says. |
| T-10-28 | Repudiation | mitigate | Each control is recorded with the COMMAND and the OBSERVED result over a named base, and I re-ran the load-bearing ones at HEAD rather than transcribing: C1 + C2 empty diffs against BOTH bases (exit 0, no output); C16's Actions-cache side asserted at FUNCTION scope with the file-scoped trap named explicitly, and the comment-only claim reproduced by me (`rg` exit 1 on the non-comment filter); C9 recorded as EXTENDED, not unchanged, precisely because RETAIN-04 added a second accept branch to a DELETE path. That last distinction is the row's whole value and it is made correctly. |

### LOW rows

| ID | Category | Disposition | Evidence |
|---|---|---|---|
| T-10-05 | Information disclosure | accept | Recorded as a QUESTION for the auditor (`10-TRUST-EVIDENCE.md` B1 Q2, B4) and bounded by Phase 9's reframing, with the delta correctly attributed to Phase 9's commit range rather than this phase's. Classified by me in section 1, Q2. Logged in section 3. |
| T-10-06 | Spoofing | accept | The branch selects a verb and a key derivation only. Read-versus-write capability is derived inside `selectBackend`, and the TRUST-05 clause is preserved verbatim in force ABOVE the branches (`action/index.ts:318-323`) and restated in the new branch (`:372-374`). No new action input: the entire workflow-side change is `operation: seed` -> `operation: mirror-seed`, and `lib/select-backend.ts` has an empty phase diff. Logged in section 3. |
| T-10-07 | Elevation of privilege | accept | `needs:` gates ordering, never capability. The load-bearing gate is `isSyncTrusted` re-checking the default branch in-process, and `lib/sync-gate.ts` is byte-unchanged. The job-level `if: ${{ !cancelled() && github.event_name == 'push' }}` (`ci.yml:1036`) is intact, and the `permissions` block (`:1092-1094`, `contents: write` + `actions: read`) is provably untouched -- it does not appear in the phase's two-line non-comment `ci.yml` diff. Logged in section 3. |
| T-10-08 | Denial of service | accept | Unchanged by this phase: `RELEASE_ASSET_CAP = 1000` (`publish-mirror.ts:28`) and the cap branch still degrades to `core.warning` + `skipped++`, never a hard failure (`:293-301`). The measured occupancy (122 of 1000) and the 2026-08-01 shard rollover are the recorded bounding argument (`10-SC6-NOTES.md:96-103`). Logged in section 3. |
| T-10-09 | Information disclosure | mitigate | AVOIDED by construction, and verified as an absence rather than an intent: `GITHUB_API`, `FETCH_TIMEOUT_MS` and `ASSETS_PER_PAGE` are authored locally in `read-back.ts:21-31` with the ROBUST-04 reason stated, and the whole phase diff of `backend/releases-backend.ts` is COMMENT-ONLY (25 insertions / 8 deletions, every changed line prose -- checked line by line). The consumer read seam did not widen. |
| T-10-12 | Tampering | mitigate | Verified from the INSTALLED Octokit types, not from the comment that cites them: `node_modules/@octokit/plugin-rest-endpoint-methods/dist-types/generated/parameters-and-response-types.d.ts:3728-3730` declares `uploadReleaseAsset` over `POST {origin}/repos/{owner}/{repo}/releases/{release_id}/assets{?name,label}` -- `label` is a separate optional query param beside `name`, so it can influence neither the filename nor the download URL, and the 422 already-exists arbitration keyed on FILENAME is untouched. The value is derived from `cachePlatform()` (`publish-mirror.ts:256`), never user-supplied. |
| T-10-13 | Information disclosure | mitigate | Unchanged. Only asset NAMES, numeric byte counts and numeric statuses reach logs (`publish-mirror.ts:280-282`, `:295-297`, `:330-336`); restored cache bytes never do. The label is derived from `cachePlatform()` and carries no credential material. The dogfood path masks its bearer with `core.setSecret` as the first statement after the server starts (`action/index.ts:305`), before any branch can print. |
| T-10-19 | Information disclosure | accept | `dogfoodBody(seedHash, producerOs)` is a deterministic derived payload with no secret material, PUT to a loopback sidecar (`http://127.0.0.1:<port>`) behind a per-process bearer that is `setSecret`-masked at `action/index.ts:305`, which precedes every `fetch` in the file. Logged in section 3. |
| T-10-21 | Information disclosure | mitigate | Reuses the single-sourced `resolveLocalReadToken` / `resolveRepoIdentity` (`read-back.ts:9-12`, `:100-101`) -- no new credential path and no re-authored env read. It requests metadata endpoints only (`/releases/tags/<tag>`, `/releases/<id>/assets`), with `AbortSignal.timeout`. Restored cache bytes never reach a message: the failure strings carry only our own expectation and the observed label (`:176-184`), and the credential-absent path throws rather than silently skipping (`:103-113`), which the spec pins with `expect(fetchMock).not.toHaveBeenCalled()`. |
| T-10-SC | Tampering | accept | ZERO new packages, proven not asserted: `git diff --stat 06019d4..HEAD -- package.json package-lock.json packages/github-cache/package.json` is EMPTY. The helper is three lines of arithmetic over an existing tuple. Logged in section 3. |

---

## 3. Accepted risks log

Eight rows carry disposition `accept`. Each is recorded here so the acceptance is a
register entry rather than an omission.

| ID | Sev | Accepted risk | Bound on it |
|---|---|---|---|
| T-10-04 | medium | First-write-wins would arbitrate between NON-identical payloads if a second same-hash producer existed. | Not reachable in Phase 10 -- one Actions-cache entry per hash, verbatim re-upload, no task re-execution, and one producer per hash (`build`/`typecheck`/`test` single-leg; `integration`'s two legs carry distinct hashes via `nx.json:102`). Residual moves to Phase 12's XOS-05 write decision. Classified in section 1 Q1. |
| T-10-05 | low | The seed asset and every mirrored task's captured output cross into an anonymously-readable Releases mirror, and a single-OS leg can now mirror every OS's entries. | The Actions-cache boundary is ref scope plus this repo's own write gate, both OS-blind, so no new writer is admitted. The exposure delta belongs to Phase 9, is measured, and is narrowed in-repo by exactly one surviving control (the `ref` scoping) plus C16's key filter. Classified in section 1 Q2; see residual note 3. |
| T-10-06 | low | The widened `operation` seam is a new capability surface in principle. | The branch selects a verb and a key derivation only; read-vs-write capability is derived inside `selectBackend` and no action input can steer it (TRUST-05 clause preserved verbatim). No new action input; `select-backend.ts` byte-unchanged. |
| T-10-07 | low | The widened `publish` `needs:` list touches a job that holds `contents: write`. | `needs:` gates ordering, never capability. `isSyncTrusted`'s in-process default-branch check (C2) and the job-level push `if:` are both intact, and the `permissions` block is provably unchanged. |
| T-10-08 | low | The 1000-asset per-shard Release cap. | Unchanged by this phase; degrades to skip-and-warn, never a hard failure. Measured occupancy 122/1000 on a shard that rolls over 2026-08-01. Recorded rather than acted on. |
| T-10-15 | medium | More jobs gating `publish` means more task outputs reach the anonymously-readable mirror. | The set of tasks routed through the sidecar is UNCHANGED -- provable from the two-line non-comment `ci.yml` diff. The widening removes a timing race that was already resolving in favour of mirroring them. Governing invariant unchanged: no mirrored task ever prints a secret (NOT `::add-mask::`, which redacts logs and never a cache payload). |
| T-10-19 | low | The `mirror-seed` PUT body. | Deterministic derived payload, no secret material, loopback destination, per-process bearer masked by `core.setSecret` before any request can print it. |
| T-10-SC | low | Supply chain via npm / pip / cargo installs. | Zero new packages; empty dependency diff across both manifests and the lockfile. |

---

## 4. Unregistered flags

**None.**

Only `10-06-SUMMARY.md` and `10-07-SUMMARY.md` carry a `## Threat Flags` section and both
declare "None" for new boundary-crossing behaviour, then enumerate which register rows the
plan mitigates. I did not accept those declarations as a complete inventory -- per the
adversarial stance, that assumption is a named failure mode. Instead I bounded the new
surface myself:

- **New network egress:** one, the native `fetch` to `api.github.com` in `read-back.ts`.
  It IS registered, as T-10-21, so it is not unregistered.
- **New workflow surface:** the entire non-comment `ci.yml` diff for the phase is two
  lines. No new `uses:`, no new secret, no `permissions` change, no new event trigger.
- **New dependency surface:** none; empty diff over both manifests and the lockfile.
- **New action input:** none; the only input-space change is a third accepted `operation`
  VALUE, registered as T-10-06.
- **New credential path:** none; `read-back.ts` reuses the single-sourced resolvers.

### F-10-A -- three stale same-OS-restore prose sites survive in the publish engine (LOW, open, informational)

Not a register row and NOT a threats_open contributor. Found while verifying T-10-27's
scan-scope claim, and reported because an upstream artifact I was required to read already
named two of the three: `09-SECURITY.md` residual note 2 recorded them as surviving into
Phase 10 with the recommendation that "TRUST-11 / OBS-05 should pin all three together".

Two of that note's three sites WERE closed this phase -- the `publish-verify` job comment
(D-21, now stating the per-leg seed derivation and the publisher-not-producer distinction)
and the publish-job capacity block (corrected a third time in `d4fc928`). These survive:

| Site | Text | Why it is stale |
|---|---|---|
| `publish-mirror.ts:153` | "a foreign-OS or evicted entry MISSes its same-OS restore and is skipped" | Since VER-01 + VER-03 a foreign-OS entry does NOT miss. The `evicted` half stays true. |
| `publish-mirror.spec.ts:515` | "Every server-produced entry MISSes its same-OS restore" | Same falsified premise, in a spec comment. |
| `publish-mirror.spec.ts:244` | test title "skips a foreign-OS/evicted entry whose restore MISSes" | The branch is still real for an EVICTED entry; only "foreign-OS" as a cause is stale. |

Why LOW and why I left it: these are `//` and `*` prose, no executable logic reads them,
and no security control depends on them. `DOCS_08_SITES` carries no `forbidden` pattern for
`publish-mirror.ts`, so nothing guards them either -- which is exactly the class that
shipped Phase 9's `read-back.ts` regression, and is why it is worth a row rather than
silence. **I did not edit it: this phase's brief makes implementation files read-only for
me.** Recommendation: fold all three into Phase 11 alongside the same-OS sweep it already
inherits, and add a `publish-mirror.ts` row with a `forbidden` pattern to `DOCS_08_SITES`
in that commit so the guard covers the file rather than the phase.

---

## 5. Corrections to upstream artifacts (reported, not edited)

Four. None changes a verdict; all four are recorded because a phase record here has
repeatedly been found to carry a miscount and reporting it is expected.

1. **T-10-11's register text says a MISS is "flagged as an OPEN BLOCKER for XOS-02".** The
   artifact instead records it as an **OPEN PRECONDITION** and argues, with evidence, that
   flagging it as a blocker against the read path would be the mirror-image error --
   `10-EVIDENCE-PRE-RENAME.md:195-199` cites a 200 with a 410-byte payload on the prior
   record's hash `13758457399293023985`, in the same session, on the same machine, through
   the same process. **I accept the substitution.** The row's actual security property is
   "never record a HIT that was not observed", and it is honoured. The register's wording
   is what is off, not the artifact.
2. **T-10-27's register text says the retraction is "scanned repo-wide".** It is not. The
   guard is an explicit 12-file allowlist (`EDITED_FILES`,
   `docs-same-os-claims.spec.ts:393-406`). That is materially sufficient -- it includes
   every source file this phase edited, including the two that carry the label -- but
   "repo-wide" overstates it, and F-10-A is the concrete consequence of the difference.
3. **`10-TRUST-EVIDENCE.md`'s provenance section records "821 tests across 39 files".**
   Re-measured at HEAD: **823 passed (823)** across **39 passed (39)**. The record was
   written at `1c0b69a`; `d4fc928` then added 2 tests to `docs-same-os-claims.spec.ts`.
   Stale number, not a defect. Part A's own claims are unaffected -- I re-ran the
   load-bearing ones at HEAD and every one reproduced.
4. **My dispatch brief says "the 34 commits from planning base 06019d4 to HEAD".**
   `git rev-list --count 06019d4..HEAD` = **35**.

---

## 6. Public-repo email hygiene (allowlist-inversion)

Detection was by allowlist inversion throughout: assert the only email-shaped token present
is the approved gmail and flag everything else. **The forbidden value is written nowhere in
this report and was never used as a search needle.**

- **Phase files: clean.** All **43** files in `git diff --name-only 06019d4..HEAD`, scanned
  with `/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g`. Exactly one non-approved token,
  in `start-cache-server/index.js` inside the esbuild `Bundled license information` banner
  -- an upstream `ws` maintainer's own contact address. **Out of scope by project rule and
  correctly so:** an outside contributor's own contact details are theirs. Same finding and
  same disposition as Phase 9's audit.
- **Commit identity: clean.** All **35** commits in `06019d4..HEAD`; `%ae` and `%ce` reduce
  to a single distinct value, the approved gmail.

---

## 7. Residual notes (no action required for this phase)

1. **F-10-A** above -- three stale same-OS-restore prose sites in the publish engine and
   its spec, unguarded. Recommended owner: Phase 11, with a `DOCS_08_SITES` row so the
   guard follows the file.
2. **T-10-27's guard scope is a file allowlist, not repo-wide.** It is the right shape (a
   repo-wide content guard would fight the bundler's regenerated license banner, exactly the
   failure Phase 9's audit argued against for `governance-email.spec.ts`). The maintenance
   obligation it creates is real though: a NEW file carrying attribution prose is outside the
   guard until someone adds it, and the file's own comment records one instance of that lag
   already (`release-asset-name.integration.spec.ts` joined one commit late).
3. **The `ref` scoping is now single-layer, and that is a project-level posture note rather
   than a phase gap.** `THREAT-MODEL.md` already records "containment is single-layer ...
   gate correctness is load-bearing with no backstop" and defers the only genuine second
   layer (C7, reader-verified provenance attestation). Phase 9 removed the incidental OS
   narrowing; from here, one argument in one `octokit.paginate` call is the sole in-repo
   control keeping a non-default-branch trusted write out of a world-readable Release, and
   its failure mode is silent. Phase 10 did the right things about it (spec pin with a
   whole-array assertion, a separate call-count pin, mutation checks, a comment lock naming
   the failure mode as information disclosure). If a second layer is ever wanted, the
   cheapest shape that does not fight the bundler is an assertion in `publishMirror` that
   every enumerated key it is handed came from a default-branch enumeration -- but that is a
   requirement-sized change, not an audit fix, so I did not make it.
4. **OBS-05 stays correctly OPEN.** Its per-leg publish-verify read-back is push-gated to
   `main` and the branch is unpushed, so the live half cannot have run. Its code-level
   guard is fully verified above (T-10-20, T-10-22). Openness here is design, not a
   mitigation gap.
5. **`10-VALIDATION.md`'s `status: draft` / `nyquist_compliant: false` is correct
   sequencing.** `/gsd:validate-phase` owns those fields and runs after this audit.

---

## 8. Edits made in this audit

**None.** Implementation files, workflow files and specs were read-only for this audit by
brief. The only file written is this one. `git status --porcelain` after the audit shows no
source modification -- `npm run check:action` regenerated the bundle byte-identically, so it
left no diff.
