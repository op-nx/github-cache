# Quick Task 260803-3g1 -- Research

**Researched:** 2026-08-03
**Scope:** Q1 createRelease 422; Q2 defect-class sweep; Q3 o3-witness Case-B; Q4 versioning.md drift
**Claim labels:** MEASURED (observed this session or cited from a measured artifact) /
DOCUMENTED (quoted from an official source, with URL) / INFERRED (reasoning, explicitly unproven)

Read-only session. Every GitHub call made was a GET. No source, workflow or doc was edited.

---

## Q1 -- what GitHub actually returns 422 for on `POST /repos/{owner}/{repo}/releases`

### The documented surface is thinner than `e96670e` assumed

DOCUMENTED (`docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28`, "Create a
release" -> "HTTP response status codes"). The endpoint documents exactly THREE codes:

```
201 - Created
404 - Not Found if the discussion category name is invalid
422 - Validation failed, or the endpoint has been spammed.
```

There is **no per-endpoint enumeration of `errors[].code`**, and `already_exists` is not named
anywhere on that page. So the premise carried up from `e96670e` -- *"already_exists is the sole
422 GitHub documents for this endpoint"* -- is not supported by the documentation for EITHER
endpoint. Treat any "only one 422 is possible here" reasoning as unfounded.

DOCUMENTED (`docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api`,
"Validation Failed"). The `errors[].code` enum is GLOBAL, not per-endpoint, and has six members:

| code | meaning |
|---|---|
| `missing` | A resource does not exist. |
| `missing_field` | A required parameter was not specified. |
| `invalid` | The formatting of a parameter is invalid. |
| `already_exists` | Another resource has the same value as one of your parameters. |
| `unprocessable` | The parameters that were provided were invalid. |
| `custom` | **Refer to the `message` property to diagnose the error.** |

**This is the single most actionable finding for the B1 fix.** Policy-shaped rejections (rulesets,
immutability, org settings) do not get their own code -- they arrive as `custom`, with the entire
diagnostic in `errors[].message` (and/or the top-level `message`). A reader that extracts only
`errors[].code` would print `code custom` and the next `main` window would still not name its own
reason. **`uploadFaultCode` must be widened to surface the message text as well as the code**, or
the window is spent for nothing.

### Does immutable releases 422 the CREATE path?

DOCUMENTED (`docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/immutable-releases`),
verbatim:

> **Git tags cannot be moved**: Once an immutable release is published, its associated Git tag is
> locked to a specific commit, cannot be changed, and cannot be deleted while the release exists.
> **If you delete the immutable release, you can delete the tag, but you cannot reuse the same tag
> name.**

> \[!NOTE] Immutable releases include protection against repository resurrection attacks. Even if
> you delete a repository and create a new one with the same name, you cannot reuse tags that were
> associated with immutable releases in the original repository.

MEASURED (debug E7): under immutability the CREATE **succeeded** -- `published_at 21:20:05Z`
matched the ubuntu leg's create to the second -- and only the asset uploads 422'd. So
"immutability is on" does NOT by itself explain a 422 on create. But the tag-name clause does.

### C1 (LEADING) -- the tag name `cache-mirror-202608` is permanently burned

INFERRED, from DOCUMENTED behaviour plus MEASURED history. The chain:

1. MEASURED (E7): `cache-mirror-202608` was created already-published with `immutable: true`.
2. MEASURED (ADDENDUM): the maintainer DELETED that release and then its tag ref.
3. DOCUMENTED (quote above): after deleting an immutable release you may delete the tag, but
   **the tag name cannot be reused**.
4. MEASURED (E10): the very next `main` push called `createRelease('cache-mirror-202608')`,
   got 422, and afterwards nothing existed -- no release, no tag ref, no draft.

This fits the measured signature with zero residue, and it is the only candidate that does.

**The debug session's own ADDENDUM is where this was lost.** E7 stated both halves of the doc
paragraph correctly. The ADDENDUM then falsified the FIRST half by measurement ("the immutable
release WAS deletable") and concluded *"Net: August is recoverable after all."* The second half --
the tag-name reuse ban -- was never tested and was never falsified. It was carried out with the
half that was. The 422 on the next run is that untested half arriving on schedule.

**Predicted body if C1 holds:** `422 Validation Failed`, `errors[0].field: "tag_name"`,
`errors[0].code: "custom"` (possibly `invalid` or `already_exists`), with the real reason in
`errors[0].message` / the top-level `message`. INFERRED -- the exact strings are not documented.

**Scope consequence, and it is the good news.** If C1 holds, only the ONE name is burned.
`cache-mirror-202609` was never associated with an immutable release, so September and every month
after it are clean. This would be an August-only problem, NOT the deferred design incompatibility,
and NOT a permissions problem the task cannot close.

### The other candidates, and why they rank below C1

| # | Candidate | Verdict |
|---|---|---|
| C2 | Org-level immutable-releases policy still ON (repo toggle does not cover it) | DOCUMENTED that an org-level control exists with `No policy / All repositories / Selected repositories` (`.../prevent-release-changes`), and MEASURED that it is unreadable here (`orgs/op-nx` exposes no `immutable`/`release` token; `orgs/op-nx/rulesets` -> 404, needs `admin:org`; token scopes still `gist, read:org, repo, workflow, write:packages`). **But it predicts the WRONG signature**: under immutability the create SUCCEEDS and the uploads fail (E7). Does not fit "422 on create, nothing created". Demoted. |
| C3 | Org ruleset "Restrict creations" targeting `cache-mirror-*` tags | DOCUMENTED that the rule exists (`.../available-rules-for-rulesets`: *"only users with bypass permissions can create branches or tags whose name matches the pattern you specify"*). MEASURED that the repo has ZERO rulesets (E8) and the org surface is unreadable. Would present as `code: custom`. Not eliminated, but requires a coincidental recent org change with no trigger event, where C1 has a dated, measured trigger. |
| C4 | Secondary rate limit / spam | DOCUMENTED for this endpoint specifically (*"This endpoint triggers notifications. Creating content too quickly ... may result in secondary rate limiting"*). Weak: the two legs failed three minutes apart and the run issues at most one create per leg. |
| C5 | Workflow-scope rejection (the branch edits `.github/workflows/ci.yml`) | **ELIMINATED, DOCUMENTED.** The create-release doc says a workflow-modifying `target_commitish` yields `404 Not Found` (or `403`), not 422. Also inapplicable: `target_commitish` is omitted, so it defaults to the default branch head, which during the window WAS the pushed tip -- no diff relative to itself. |

### The measurement that closes B2 WITHOUT spending a `main` window

MEASURED, current repo state, read-only GETs this session:

- Releases: `v0.0.1` (id 357731190, 0 assets) and `cache-mirror-202607` (id 354838660, 155 assets).
  `immutable` is **absent** on BOTH -- so field absence is not readable as `false`, and the field
  cannot be used as a detector of the setting.
- `git/matching-refs/tags/cache-mirror` -> only `refs/tags/cache-mirror-202607`.
- Repo object: no `immutable` / `release_polic` token (`rg` exit 1, positive control `releases_url`
  exit 0 -- the zero is real, not a failed command).
- Org object: no `immutable` / `release` token (`rg` exit 1, positive control `login` exit 0).

**Recommendation (highest value in this document): `createRelease` is not gated on being on
`main`.** A single authorized `gh api -X POST` prints the 422 body verbatim, immediately, with no
CI run and no `main` push. Run it as a PAIR so the result discriminates:

- TEST: `tag_name=cache-mirror-202608`, `draft=true`.
- CONTROL: `tag_name=<fresh throwaway name>`, `draft=true`.

| Outcome | Reading |
|---|---|
| TEST 422, CONTROL 201 | C1 confirmed -- the name is burned. August-only, fixable in code or by accepting one lost month. |
| BOTH 422 | A blanket policy blocks release/tag creation (C2/C3). Not fixable in code -- the terminal state U1 anticipates. |
| BOTH 201 | The 422 was transient, or is specific to the Actions token. Roll back the created drafts and reason further. |

**Stated confound:** the local `gh` PAT is not the Actions `GITHUB_TOKEN`. A POSITIVE result
(TEST fails, CONTROL succeeds) is decisive because a burned tag name is identity-independent. A
NEGATIVE result (both succeed) does NOT clear the CI path and must not be read as one.

`draft: true` is safe: a draft is unpublished, therefore not immutable, therefore deleting it
does not burn its tag name. This is a WRITE and needs maintainer authorization -- the standing
authorization in CONTEXT.md covers pushes and PRs, not release creation, so ask.

### Two design notes for the B1 fix beyond the `already_exists` gate

1. **Guard the re-GET even on a genuine `already_exists`.** Read-after-write against
   `getReleaseByTag` can 404 transiently right after another leg's create, and
   `getReleaseByTag` does not resolve DRAFT releases at all (DOCUMENTED behaviour of the
   get-by-tag endpoint; no draft path exists today, but the design note is one line). A bare
   uncaught `Not Found` is what killed run 30773689490. Wrap it and rethrow with the tag named.
2. **Let a non-`already_exists` 422 THROW; do not convert it to `failed++`.** Status quo already
   throws (`publish-mirror.ts:137`), so propagating is not a regression. A dead shard means every
   remaining item fails identically -- 32 identical warnings is noise, not signal. The file's own
   D-12 comment argues against mid-loop throws, so the planner should record WHY this one is
   different rather than leaving the two comments in apparent contradiction.

---

## Q2 -- complete defect-class sweep

Class definition used: *a branch that selects behaviour from an HTTP status without inspecting the
response body, where a wrong reading can be BENIGN* (i.e. can produce a silent success). A branch
that reads a status only to choose a failure MESSAGE, or that treats every non-success as fatal, is
not an instance -- it cannot silently pass.

MEASURED, `git grep -n "statusOf(error)" -- packages/` plus a widened sweep for
`status [=!]== <3 digits>` and every `} catch` in non-spec sources. Nine branch sites, all
accounted for.

| # | Site | Reads | Verdict |
|---|---|---|---|
| 1 | `publish-mirror.ts:121` `getReleaseByTag` | `!== 404 -> throw` | **SAFE** |
| 2 | `publish-mirror.ts:131` `createRelease` | `=== 422 -> re-GET` | **THE DEFECT (B1)** |
| 3 | `publish-mirror.ts:379` `uploadReleaseAsset` | `=== 422 && code === 'already_exists'` | **SAFE** (fixed by `e96670e`); one observability gap |
| 4 | `cleanup.ts:137` `deleteAsset` | `=== 404 -> pruned++` | **SAFE**, with one named residual |
| 5 | `releases-backend.ts:112` read port | logs status, does not branch | **NOT AN INSTANCE** |
| 6 | `releases-backend.ts:176` `assertOkOrAbsent` | `404 -> absent`, else throw | **SAFE** |
| 7 | `read-back.ts:154` shard walk | `404 -> try older shard` | **SAFE** |
| 8 | `action/index.ts:337, 386, 441` | `!== 200 -> setFailed` | **SAFE** |
| 9 | `action/index.ts:427` | `=== 404 -> better message` | **SAFE** |

### Written justification per surviving site

**1. `publish-mirror.ts:121`.** 404 is single-meaning in the REST contract (`missing`: the
resource does not exist), unlike 422, which multiplexes six distinct `code` values onto one status
-- that multiplexing IS the mechanism of the defect, and it does not apply to 404. The branch also
runs in the CONSERVATIVE direction: everything that is not 404 rethrows. The failure mode of a
wrong 404 reading is an attempted create, which lands on site 2 -- so it cannot produce a silent
success on its own. Residual, named not fixed: GitHub masks 403 as 404 on resources you cannot
see, so a token-scope regression would present here as "shard absent". The path still terminates
in a throw or the create's fault branch, never in green. No change.

**3. `publish-mirror.ts:379`.** Correct and fail-closed: an unreadable body yields `undefined`,
and `undefined` is counted as `failed`. **Observability gap, not a correctness gap:**
`uploadFaultCode` reads only `errors[].code`. Per the documented enum (Q1), a policy rejection
arrives as `code: 'custom'` with the diagnostic in `errors[].message`. The warning would print
`code custom` and still not name the reason. Widen the reader to surface the message text. The
classification stays correct either way -- `custom !== 'already_exists'`, so it already routes to
the fault branch.

**4. `cleanup.ts:137`.** The benign reading here is the DESIRED END STATE of a delete: a DELETE
whose target is absent is idempotently successful, and `pruned` means "N assets are now gone",
which stays true. There is no body to consult -- a DELETE 404 carries no `errors[]` array. Every
other status increments `failed` and routes into the aggregate `setFailed`. **Named residual, and
it is the one surviving site whose wrong reading produces SILENT GREEN rather than a loud fault:**
if the token's delete capability regressed and GitHub answered 404-instead-of-403, cleanup would
count every asset as `pruned` and exit 0 having deleted nothing -- structurally the same shape as
the publish bug, one subsystem over. INFERRED risk, unmeasured; the workflow declares
`contents: write` and a real scope loss is more likely to surface as 403. **Disposition: FLAG as a
watch item, do not fix in this task.** The cheap tripwire, if it is ever wanted, is "every expired
asset resolved via the 404 path and none via a 2xx" -- an all-404 delete batch, which is the
cleanup analogue of the all-restore-MISS warning this file already implements.

**5. `releases-backend.ts:112`.** Not an instance: the status is passed to `warnOnce` for
diagnosis and never used as a discriminator. Every fault degrades to MISS by design (D-11 /
SRV-05) so a read fault cannot break a build or yield wrong bytes.

**6. `releases-backend.ts:176`.** Same 404-is-single-meaning argument as site 1, and the fail-safe
direction: an "absent" verdict routes to "try the next shard", whose terminal outcome is a MISS (a
rebuild), never wrong bytes.

**7. `read-back.ts:154`.** Same shape, and this is the VERIFIER. A wrong 404 reading ends in the
loud "no shard in [...] holds an asset named ..." throw, not a pass.

**8. `action/index.ts:337, 386, 441`.** Strict equality to the expected success; every non-success
is fatal. The conservative direction by construction -- no body needed.

**9. `action/index.ts:427`.** 404 selects a better diagnostic only; BOTH branches call
`setFailed`. No benign path exists.

**Sweep completeness.** Thirteen `} catch` blocks exist in non-spec sources; four are bare
`catch {}` in `sync-gate.ts`, `trust.ts` and `server.ts` (parse/IO guards with no HTTP status
involved), the rest are the sites tabled above plus `actions-cache-backend.ts:359` and
`hash-parity/assert-parity.ts:65,107`, none of which branch on an HTTP status. `statusOf` has
exactly four non-spec call sites, all listed.

---

## Q3 -- o3-witness Case-B safety

### The actual mechanism, which the diagnosis states only in the abstract

MEASURED, reading `.github/workflows/ci.yml:1094-1298`. The failing jq is:

```
'first(.actions_caches[] | select(.key == $key and .ref == $ref) | .created_at) // empty'
```

with `$ref = $GITHUB_REF`. On a `pull_request` that is `refs/pull/N/merge`.

On a Case-A run the producers MISS and SAVE, so an entry for `nx-cache-<H_linux>` exists **on the
PR merge ref** and the strict equality matches. On a Case-B run (run 30768540898, MEASURED --
every ubuntu producer HIT, not one `Sent` line) nothing is written to the merge ref at all; the
entry the Windows legs restored lives in the DEFAULT-branch scope, `refs/heads/main`. The filter
finds nothing and the job takes the `[ -z "${created}" ]` branch: *"no cache entry whose key is
EXACTLY ${key} on ref ${GITHUB_REF}"*.

So the defect is precise: **`.ref == $ref` encodes the Case-A shape.** It is not the delta
assertion, not the step lookup, and not a flake. INFERRED from the code plus the measured run;
consistent with the EVIDENCE file's finding and one level more specific than it.

### Recommended fix -- widen the ref constraint, never drop it

The ref filter is load-bearing and its rationale is already recorded in the spec lock (see below):
*"ONE hash holds entries on TWO refs, so neither a count nor a key-only match is an existence
proof."* Dropping it would let an unrelated PR's merge-ref entry -- which the Windows leg could not
read -- satisfy the witness. That is the vacuity trap.

Widen to the **actual readable scope** instead. The Actions cache read scope for a run is
{ this ref } union { base branch } union { default branch }. So:

1. Build an allowed-ref set: `$GITHUB_REF`, plus `refs/heads/${GITHUB_BASE_REF}` when
   `GITHUB_BASE_REF` is non-empty (it is set on `pull_request` only).
2. Select the EARLIEST `created_at` across matches, not the first arbitrary one --
   `[.actions_caches[] | select(.key == $key and (.ref == $ref or .ref == $baseref)) | .created_at] | min // empty`.
   ISO-8601 sorts lexicographically so plain `min` is correct, and `min` of an empty array is
   `null`, which `// empty` still absorbs -- so the existing `// empty` lock composes unchanged.
3. PRINT the matched ref on the OK line, so the log records Case A vs Case B rather than hiding
   the distinction.
4. Correct the empty-result message to name BOTH causes (never existed / exists outside the
   readable scope) instead of only the first.

Everything else is untouched: an empty result still `exit 1`s, the `>= 30s` margin is unchanged,
and the anchored `grep -q` second signal stays. On a Case-B run the delta becomes hours or days,
which is fine -- the assertion is a lower bound, and a larger delta is stronger evidence of prior
existence, not weaker.

**Explicitly do NOT add** an "if nothing was created this run, skip" branch. That is exactly the
guard-green-because-it-asserts-nothing failure mode, and it would disable the witness on precisely
the runs it is hardest to satisfy.

### How the fix is mutation-proven

The repo already has the mechanism-lock idiom: `dogfood-cross-os.spec.ts`, describe block
`ci.yml o3-witness job exists and keeps its shape (XOS-03, TEST-09)`, whose header enumerates five
mutations that previously left the whole suite green. Five body clauses now pin the shell.

**Load-bearing plan input: one of those clauses pins the expression this fix must change.**

```js
.toMatch(/select\(\s*\.key == \$key and \.ref == \$ref\s*\)/)
```

Editing `ci.yml` alone turns `nx test github-cache` RED. That is the guard working -- the fix is a
TWO-FILE change, and the spec clause plus its reason string must be rewritten to pin the new
(still non-vacuous) expression, citing run 30768540898 as the measurement that motivated it.

Mutation proof, four mutations that must each turn the suite RED:

| # | Mutation | Caught by |
|---|---|---|
| M1 | Drop the ref constraint entirely (`select(.key == $key)`) | the REWRITTEN clause (must still require a ref constraint) |
| M2 | Delete `// empty` | existing clause (absence would read as the string `null` and PASS) |
| M3 | `-lt 30` -> `-lt 0` | existing clause |
| M4 | Add an early `exit 0` / skip when the cache query is empty | **NOTHING TODAY. This is the gap the fix itself opens.** |

**M4 is the whole point.** The vacuity this specific fix could introduce is a NEW mutation the five
existing clauses do not cover -- nothing currently forbids the empty-result branch from becoming a
skip. So the fix must ADD a sixth clause asserting the empty-result branch still fails, e.g.
`.toMatch(/if \[ -z "\$\{created\}" \]; then[\s\S]*?exit 1/)`. Without that clause the fix is not
mutation-proven, it is merely tested.

Live confirmation, once landed: a Case-B PR (touching no declared input) must show `o3-witness`
GREEN printing `refs/heads/main` as the matched ref, and a subsequent input-touching commit on the
same PR must show it GREEN printing `refs/pull/N/merge`. Both observable in one PR, no `main`
window needed.

---

## Q4 -- `docs/versioning.md` export drift

### The authoritative list, and the drift

MEASURED. Three places agree with each other and disagree with the doc:

- `packages/github-cache/src/index.ts`: value export `createCacheServer`; type exports
  `CacheBackend`, `GetHit`, `GetResult`, `PutResult`, `ReadableBackend`, `WritableBackend`.
- `public-surface.spec.ts` `EXPECTED_VALUE_EXPORTS` / `EXPECTED_TYPE_EXPORTS`: identical, and
  asserted for EXACT equality against the parsed barrel -- so this is the authoritative list.
- `docs/versioning.md:12-15`: *"`createCacheServer` and the `CacheBackend`, `GetHit`, `GetResult`,
  and `PutResult` port types."* -- **four of six. `ReadableBackend` and `WritableBackend` missing.**

### Why the guard did not catch it

MEASURED. `docs-adoption.spec.ts:76-85` is the ONLY thing that reads `docs/versioning.md`, and it
pins exactly one of the three contract groups:

```js
describe('versioning.md documents every consumer env knob (DOCS-02/DOCS-05)', () => {
  it.each(EXPECTED_ENV_KNOBS)('lists env knob %s', (knob) => {
    expect(versioning).toContain(knob);
  });
});
```

Group (a) env knobs only. Group (b) action inputs and group (c) package exports are unpinned
against the doc. `public-surface.spec.ts` pins group (c) against the CODE but never against the
prose, so the two can drift silently -- and did.

This is the same bug the existing block's own comment describes for a different group:
*"a knob could be present in the consumer-contract constant and configuration.md yet missing from
the versioning surface -- exactly what happened to `GITHUB_REPOSITORY`."* The lesson was applied to
one group and not generalized.

### Recommended fix -- both halves, no new abstraction

1. **Doc:** add `ReadableBackend` and `WritableBackend` to the group-1 sentence in
   `docs/versioning.md`.
2. **Guard:** move `EXPECTED_VALUE_EXPORTS` and `EXPECTED_TYPE_EXPORTS` out of
   `public-surface.spec.ts` into `src/test/consumer-contract.ts`, alongside `EXPECTED_ENV_KNOBS` --
   which already exists for exactly this reason ("the ONE source of truth both contract guards
   share, so the two can never drift"). Then add one `it.each` to the existing versioning describe
   in `docs-adoption.spec.ts`:
   `it.each([...EXPECTED_VALUE_EXPORTS, ...EXPECTED_TYPE_EXPORTS])('lists export %s', ...)`.
   Two arrays moved, one `it.each` added. `public-surface.spec.ts` keeps its inline sorted-literal
   self-check so an intentional surface change still lands as a reviewable diff there -- the same
   arrangement the env knobs already use.
3. **RED-first ordering:** add the guard clause BEFORE the doc fix. It must fail naming
   `ReadableBackend` and `WritableBackend`, then go green on the doc edit. Otherwise the guard is
   only asserted against an already-correct doc and its own detection power is unproven.

Two caveats worth one line each in the commit, not worth engineering around:

- `toContain` is a substring match, so `toContain('CacheBackend')` would also pass on
  `createCacheBackend`. This is the same weakness the env-knob guard already accepts; a presence
  guard is the right rung here.
- Scope the new clause to `versioning.md` only. It is the doc that CLAIMS to define the contract;
  widening to README/configuration.md would churn on ordinary prose edits.

Group (b), consumer action inputs (`port`), is also unpinned against `versioning.md`. INFERRED:
low value -- the doc does not enumerate inputs by name, so there is nothing to drift. Leave it.

---

## Sources

- `docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28` -- Create a release: body
  parameters and the three documented status codes.
- `docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api` -- the global
  Validation Failed `errors[].code` enum.
- `docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/immutable-releases`
  -- the tag-name reuse ban and the resurrection-protection note.
- `docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/prevent-release-changes`
  -- the repo AND org level controls, and "immutability will only apply to future releases".
- `docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets`
  -- "Restrict creations" for tags.
- Repo state read-only this session: `repos/op-nx/github-cache/releases`,
  `git/matching-refs/tags/cache-mirror`, `repos/op-nx/github-cache`, `orgs/op-nx`, token scopes.
- In-repo: `publish-mirror.ts`, `cleanup.ts`, `releases-backend.ts`, `read-back.ts`,
  `action/index.ts`, `octokit-status.ts`, `index.ts`, `public-surface.spec.ts`,
  `docs-adoption.spec.ts`, `test/consumer-contract.ts`, `dogfood-cross-os.spec.ts`,
  `.github/workflows/ci.yml`, `.planning/debug/publish-verify-422-empty-shard.md`,
  `.planning/quick/260802-toz-.../260802-toz-EVIDENCE.md`.

**Not verified, and unverifiable read-only:** the exact `errors[].code` / `message` GitHub returns
for `createRelease('cache-mirror-202608')`. Every candidate in Q1 is discriminated by the paired
`gh api` probe above, which needs one write and no `main` window.
