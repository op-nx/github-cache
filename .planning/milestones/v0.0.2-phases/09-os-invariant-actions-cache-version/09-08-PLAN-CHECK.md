---
phase: 09-os-invariant-actions-cache-version
plan: 08
check: plan-check
verdict: pass
verdict_qualifier: pass with two REQUIRED pins and three advisory amendments
checked_by: gsd-plan-checker
checked_at: 2026-07-29
head_at_check: 4296d1d
plan_under_review: .planning/phases/09-os-invariant-actions-cache-version/09-08-PLAN.md
vacuity_risk: none_found
guard_strength: preserved (relaxation is exactly two additional accepted byte strings)
required_amendments: 2
advisory_amendments: 3
---

# 09-08 Plan Check

**Verdict: `pass`.** The plan does NOT ship a weaker guard. The byte assertion stays a byte
assertion, the relaxation is exactly and provably two additional accepted payloads, and every
citation in the plan that I could check against the live tree held. Two small pins are REQUIRED
before execution because without them the plan's own `exactly three failures` acceptance
criterion is unreachable and the tempting reconciliation is to weaken it. Three further
amendments are advisory (accuracy of mutation predictions, completeness of the honesty
accounting, and one traceability pointer).

Nothing here is a nitpick dressed as a blocker, and nothing here changes the plan's design.

---

## 1. Vacuity -- PASSES. This is the strongest part of the plan.

The replacement is `CACHE_OS_VALUES.find((os) => result.bytes.equals(dogfoodBody(hash, os)))`.
Acceptance therefore still requires **exact byte equality against one of exactly three
derivable payloads**, each of which folds the hash into the bytes
(`packages/github-cache/src/lib/dogfood-body.ts:41`,
`` Buffer.from(`nx-github-cache-dogfood:${producerOs}:${hash}`) ``).

I measured the fixtures the plan names, rather than reasoning about them:

| fixture | bytes | matches any candidate? |
|---|---|---|
| `dogfoodBody('30400231720','windows')` | 43 | yes (windows) |
| `dogfoodBody('30400231720','macos')` | 41 | yes (macos) |
| `dogfoodBody('30400231720','linux')` | 41 | yes (linux) |
| B1 `'not a dogfood payload at all'` | 28 | **no -> throw** |
| B2 `dogfoodBody(...,'linux').subarray(0,12)` | 12 | **no -> throw** (`Buffer.equals` is length-first) |
| B3 `dogfoodBody('30400231721','linux')` | 41 | **no -> throw** (same length, different template) |

So garbage, a truncated/partial upload, an asset for a different hash, and a cross-run asset-name
collision all still fail. There is no presence check, no length check, and no HIT-only check
anywhere in the replacement. The exact delta versus the guard it replaces is
`{dogfoodBody(hash, os) : os != cachePlatform()}` -- **two specific byte strings, for this hash
only**. The plan states that delta and assigns it an owner (ROADMAP Phase 10 item 3 / OBS-05,
quoted accurately -- I read `.planning/ROADMAP.md:380-384`).

`assertion that must change`: none. The plan does not weaken any assertion.

### Advisory A1 -- one class is missing from the "no longer catches" list

An **OS-discriminator collapse within a single run** (a CORR-01 regression in
`releaseAssetName`) also stops being detectable by this job: a Windows reader that resolves the
ubuntu leg's asset now passes. Add it to the losses row, with the two reasons it is tolerable:

- Under today's shared run-scoped seed key that signal is **inseparable** from the false alarm
  being fixed -- both legs mirror the same linux-produced bytes, so the Windows leg's old-guard
  failure IS the collapse signal and IS the false alarm. You cannot keep one without the other.
- It is unit-pinned elsewhere: `release-asset-name.spec.ts` pins the exact produced name, and
  `releases-backend.spec.ts:103-118` is CORR-01's documented non-vacuity proof (named as such in
  `ROADMAP.md` Phase 10 item 2).

Note the new message's retained hypothesis "an asset-name discriminator colliding across **runs**"
stays accurate as written -- cross-RUN collision is still caught. Only the within-run cross-OS
case is lost.

---

## 2. Guard asymmetry preserved -- PASSES

Verified directly, not from the plan's summary:

- `packages/github-cache/src/action/index.ts:328` is `const expectedProducerOs = 'linux';`, and
  `:308-327` already carries the vacuity-condition comment block ("IF A WINDOWS dogfood-seed LEG
  IS EVER ADDED, THIS LITERAL IS WHAT MUST CHANGE").
- `packages/github-cache/src/dogfood-cross-os.spec.ts:97-108` pins `dogfood-seed` single-leg with
  `not.toMatch(/strategy:/)`, `not.toMatch(/matrix/)`, `toMatch(/runs-on:\s*ubuntu-24\.04-arm/)`.
- `.github/workflows/ci.yml:799` -- `dogfood-seed` is `if: github.event_name == 'push'`,
  `runs-on: ubuntu-24.04-arm`, no matrix.

So `dogfood-verify`'s `'linux'` literal is correct as-is, and the plan leaves it byte-unchanged:
`action/index.ts`, `dogfood-cross-os.spec.ts`, `dogfood-body.ts` and `ci.yml` are all listed
UNMODIFIED, enforced by a `git status --porcelain` acceptance criterion. The both-directions
comment lock is required in Task 2 STEP 4 and is keyed on job/clause names rather than line
numbers, which is right -- this phase measured `ci.yml` drifting ~220 lines inside one milestone.

The success-line idiom the plan borrows is real: `action/index.ts:375` emits
`` `matching a '${expectedProducerOs}'-produced payload.` ``, so Group A's
`stringContaining("'" + os + "'-produced")` shares one vocabulary across both jobs' logs.

---

## 3. Scope fence -- PASSES on OBS-05; one traceability pointer missing

The plan stays on making the GUARD correct. It does not restructure seeding, does not touch
`ci.yml`, and quotes Phase 10 item 3 correctly.

### Advisory A2 -- say out loud that this overrides a locked CONTEXT deferral

`09-CONTEXT.md:794` defers, verbatim:

> `ci.yml:1053-1061` / `read-back.ts`'s same-OS claims -- Phase 10 (TRUST-11 / OBS-05)

That is a **locked deferral naming `read-back.ts` itself**. This plan closes the `read-back.ts`
half of it in Phase 9, on the maintainer routing decision recorded in `09-EVIDENCE.md`'s ADDENDUM
("Routed to Phase 9 gap closure by maintainer decision"), which `09-VERIFICATION.md` explicitly
accepted as supplanting the deferral for this measured instance. That is legitimate -- but the
plan's `<gap_provenance>` argues only from DOCS-08 and never mentions the override.

Consequence if left unsaid: a Phase 10 executor diffing CONTEXT's deferral list against the tree
sees `read-back.ts` already changed and may close TRUST-11 while `ci.yml`'s `publish-verify`
comment (`:1098-1110`) still reads *"Each OS leg reads back ONLY its own-OS asset ... so this
proves the same-OS publisher->reader contract"* -- flatly false about what the code asserts after
this fix, and the exact stale-prose class this plan exists to fix.

Cheapest fix, and it fits the comment lock already required: have the `read-back.ts` lock name the
stale `ci.yml` `publish-verify` job comment as the remaining half, owned by Phase 10. Also record
the override in the SUMMARY.

Guard-safety of leaving `ci.yml` alone is confirmed: `docs-same-os-claims.spec.ts`'s two `ci.yml`
rows key on the `publish` job (site 2: `'an ubuntu leg CAN now restore a Windows-saved entry'`) and
the `integration` job (site 3: `'that hash is the SOLE separation'`) -- **neither keys on
`publish-verify`**. Nothing reddens.

Separately, `requirements: []` is factually justified. I read all six rows of
`docs-same-os-claims.spec.ts`: `docs/advanced.md` x3, `.github/workflows/ci.yml` x2, `README.md`,
`docs/trust-and-security.md`. No `.ts` path. Stretching DOCS-08 to cover `read-back.ts` would
falsify its own enumeration, exactly as the plan says.

---

## 4. Non-vacuous RED with an otherwise-clean tree -- ACHIEVABLE, with two REQUIRED pins

The clean-RED claim holds structurally. Each leg checked:

| Claim | Verified |
|---|---|
| RED is assertion-level, not a link error | Yes -- STEP 1 exports `run` in the SAME commit as the spec. |
| The spec's fake typechecks | Yes -- `backend/types.ts:23-25`: `ReadableBackend` has **exactly one** member, `get(hash: Hash): Promise<GetResult>`. `mockReturnValue({ get: vi.fn() })` needs no cast. This is why the RED tree compiles. |
| Importing the bin is inert | Yes -- `is-entrypoint.ts` compares `import.meta.url` to `pathToFileURL(process.argv[1]).href`; false under vitest. Same precedent as `cleanup/index.spec.ts`. |
| `build` unaffected | Yes -- `tsconfig.lib.json` `exclude` contains `src/**/*.spec.ts`. |
| `pack:check` unaffected | Yes -- specs never reach `dist/`, and `package.json` `files` carries `"!dist/roundtrip"` regardless. |
| `fallow:ci` green with a newly exported `run` | Yes -- `.fallowrc.jsonc` already declares `packages/github-cache/src/roundtrip/read-back.ts` as an entry, and both sibling bins already export a spec-only-consumed `run`. |
| `check:action` empty diff | Structurally yes (see section 8) -- and the plan requires OBSERVING it anyway. |
| All nine battery scripts exist | Yes -- `build`, `typecheck`, `typecheck:action`, `test`, `lint`, `fallow:ci`, `check:action`, `pack:check`, `format:check` are all in the root `package.json`. |
| Exactly three failures, machine-independently | Yes -- the matching-OS case passes no-throw and fails the `'<os>'-produced` log assertion (today's success line, `read-back.ts:77-79`, names no producer); the other two fail no-throw. Three on any machine. |
| Test-file arithmetic | Yes -- 37 unit spec files today (38 tracked `*.spec.ts` minus `public-server.integration.spec.ts`), so 38 after. The plan's `38 files` is right. |

### REQUIRED R1 -- name Group B's rejection substring

The plan requires B1-B3 GREEN at the RED commit (under the OLD message at `read-back.ts:70-73`)
**and** green after Task 2 rewrites that message, but never names the substring. Only a substring
present in BOTH messages satisfies both.

Pin it in Task 1: use **`'cache HIT for'`** for B1-B3 -- present in the old message and mandated
for the new one by Task 2 STEP 2's "keep naming the hash and the reading platform" -- and
**`'MISS'`** for B4. It still discriminates: the MISS branch says `cache MISS`, and no other
throw carries `cache HIT`.

Without this pin an executor reaching for a new-message phrase such as `"no known producer"` gets
6-7 failures at the RED commit, contradicting the "EXACTLY three failing tests" criterion, and the
cheapest-looking reconciliation is to relax that criterion -- i.e. to lose the very evidence that
Groups B and C were preserved rather than traded away.

### REQUIRED R2 -- use the repo's mock/env harness, not `vi.resetAllMocks()`

The plan specifies `afterEach: vi.resetAllMocks()` and no env restore. The repo's bin-spec harness
is different, in both files the plan cites as its pattern:

- `cleanup/index.spec.ts:42-51` -- `const ORIGINAL_ENV = process.env;`,
  `beforeEach(() => { vi.clearAllMocks(); process.env = { ...ORIGINAL_ENV }; })`,
  `afterEach(() => { process.env = ORIGINAL_ENV; })`
- `action/index.spec.ts:66-70` -- identical shape (and `:210-213`'s plain env assignment, which
  the plan cites, sits INSIDE that file-level restore).

Copy that. Two reasons it matters here:

1. `resetAllMocks` clears implementations. If `createReleasesReadBackend`'s `{ get }` fake is
   wired in the `vi.mock` factory rather than per-test, it evaporates after the first test and
   Groups B/C fail with a `TypeError` on `backend.get` -- failures on plumbing, not on merits,
   which again breaks the exactly-three claim.
2. C1 deletes `GITHUB_RUN_ID`. The file-level `process.env` save/restore is the existing guard
   against that leaking.

---

## 5. Mutation adequacy -- all four bite the right case; two predictions are narrower than reality, one will not compile as written

None of the four can pass vacuously: each names a specific test whose failure has a distinct
cause, and M2/M3 are precisely the vacuity mutations this check was asked to scrutinise.

### Advisory A3 -- correct three predictions

- **M1** will not run as written. Replacing the scan with
  `result.bytes.equals(dogfoodBody(hash, cachePlatform()))` deletes `producerOs`, which Task 2's
  success line references. The mutation must ALSO substitute `cachePlatform()` into the log line.
  With that substitution the plan's prediction is right: 2 red, machine-dependent, the own-OS case
  surviving because its log assertion is satisfied.
- **M2 (length-only) reddens TWO cases, not one.** B3 reddens as named -- verified arithmetically:
  the neighbour-hash linux payload is 41 bytes, matching the `macos` candidate's 41, so `.find`
  returns `'macos'`, defined, no throw. B1 (28) and B2 (12) stay green, exactly as predicted. But
  `dogfoodBody(hash,'macos')` and `dogfoodBody(hash,'linux')` are **both 41 bytes**, so a linux
  payload also resolves as `'macos'` and **Group A's `linux` case fails the `'linux'-produced` log
  assertion**. Predict `B3 + A[linux]`, or the executor reads the extra failure as a defect and
  starts debugging a correct mutation.
- **M3 (drop the throw) reddens THREE cases, not two.** B1 and B2 as named -- and B3 too, since a
  different-hash payload is equally a no-known-producer case. B4/C1 stay green (different
  branches), as predicted.
- **M4** is correct as written: all three Group A cases fail the log assertion while their
  no-throw assertions still pass. `producerOs` stays used by the `undefined` check, so nothing
  goes unused and the mutation compiles.

---

## 6. Machine independence / LINT-02 -- PASSES, verified against the config

- The ban object is `eslint.config.mjs:263-264`:
  `files: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']`,
  `ignores: ['**/*.integration.spec.{ts,mts,cts}']`. So it **does** apply to
  `roundtrip/read-back.spec.ts`. The plan is right that the ban is in force.
- The selectors are `MemberExpression[computed=false][object.name='process'][property.name=/^(platform|arch)$/]`
  (P1) plus a deliberately broad P2 banning **any** computed index of `process`.
- `it.each(CACHE_OS_VALUES)` needs neither: asserting acceptance for all three producers never
  computes "the OS that is not this one". No `process.platform` read is required anywhere in the
  spec.
- `process.env.GITHUB_RUN_ID` is safe: dot-accessed (so not P2) and its property is `env`, not
  `platform`/`arch` (so not P1).

The claim holds. `lint` will not break the clean-RED tree on this account.

---

## 7. Live-clause honesty -- PASSES

- `.github/workflows/ci.yml:3-7` -- `on: push: branches: [main]`, plus `pull_request`.
- `publish-verify` carries `if: github.event_name == 'push'` (`:1113`), `needs: publish`,
  `fail-fast: false`, matrix `[ubuntu-24.04-arm, windows-11-arm]`.

So the live green is genuinely not observable pre-merge. Every acceptance criterion in the plan is
a local command; the live green is carried in a `human_needed` section that says outright no
acceptance check may claim it (citing C-06, which `09-CONTEXT.md:530` confirms). It also names
where it will be read, what closes it, that it is re-samplable, and what it does NOT close
(OBS-05). That is the right shape and matches 09-05/09-06's precedent.

`action-bundle-drift` has no `if:` gate (`ci.yml:99-114`) and does run on `pull_request` -- the
plan's pre-merge observable is the local `check:action`, which is correct.

One supporting fact the plan asks the executor to verify, verified here: `ci.yml:1128` is a bare
`run: node packages/github-cache/dist/roundtrip/read-back.js` with no stdout grep, and
`git grep "not what the publisher wrote"` hits only `read-back.ts:71` plus `.planning` records. So
rewording the failure message breaks no contract. (Contrast `ci.yml:779`, where the hash-parity
job DOES `grep -q '^hash-parity: PARITY OK'` -- that asymmetry is real and the plan reads it
correctly.)

---

## 8. Bundle obligation -- PASSES, and the posture is right in both directions

`read-back.ts` is **NOT** `serve()`-reachable. Verified independently:

- `esbuild.action.mjs:32` -- `entryPoints: ['start-cache-server/entry.ts']`, a single entry.
- `start-cache-server/entry.ts` imports exactly `@actions/core` and
  `../packages/github-cache/src/serve.js`.
- `git grep` over the repo finds **no file importing `read-back.ts`** -- the only references are
  `ci.yml:1128` (the `node` invocation), `pack-check.cjs:19` (the tarball guard's prose),
  `.fallowrc.jsonc` (the entry declaration) and doc comments.

So a `check:action` diff is structurally impossible from this plan's edits. The plan nevertheless
requires OBSERVING the diff at both commits, cites D-26 and Phase 7's Q10 (an 88-line drift with no
source edit) as the reason, and instructs that a non-empty diff is a finding to investigate rather
than a file to stage. That is exactly right, and it satisfies the "verify rather than assume, in
either direction" requirement.

---

## Amendment list (apply before execution)

| # | Grade | Where | Change |
|---|---|---|---|
| R1 | REQUIRED | Task 1 STEP 2, Group B | Name the stable rejection substring: `'cache HIT for'` for B1-B3, `'MISS'` for B4. Say why: it must be present in BOTH the old and the Task-2 message, or the exactly-three-failures criterion is unreachable. |
| R2 | REQUIRED | Task 1 STEP 2, mocks | Replace `afterEach: vi.resetAllMocks()` with the repo harness: file-level `ORIGINAL_ENV`, `beforeEach: vi.clearAllMocks(); process.env = { ...ORIGINAL_ENV }`, `afterEach: process.env = ORIGINAL_ENV` (`cleanup/index.spec.ts:42-51`). |
| A1 | Advisory | `<design>` "no longer catches" + the comment lock | Add the within-run OS-discriminator collapse (CORR-01 regression); note it is inseparable from the false alarm under the shared run-scoped seed key, and unit-pinned by `release-asset-name.spec.ts` / `releases-backend.spec.ts:103-118`. |
| A2 | Advisory | `<gap_provenance>` + comment lock + SUMMARY | Record that this overrides `09-CONTEXT.md:794`'s Phase 10 deferral of `read-back.ts`'s same-OS claims on the maintainer routing decision, and that the `ci.yml` `publish-verify` comment half stays Phase 10 / TRUST-11. Point the code lock at that stale sibling by job name. |
| A3 | Advisory | Task 3 | M1 must also substitute `cachePlatform()` into the success line or it will not compile. M2's expected redness is `B3 + A[linux]` (macos and linux payloads are both 41 bytes). M3's is `B1 + B2 + B3`. |

None of the five changes the design, the task split, the commit structure, or any assertion.

---

## Bottom line

The plan replaces `producer == reader` with `producer is a member of CACHE_OS_VALUES, and name
which`. That is
the minimum honest relaxation: it admits exactly two more byte strings for this hash and nothing
else, keeps every corruption class red, converts the judgement it drops into a logged fact, and
schedules the one detection it genuinely loses to an existing Phase 10 requirement. The
non-vacuity contract is both test-enforced (Group B) and mutation-proven (M2, M3), and the
`human_needed` accounting refuses to claim a green it cannot observe.

`verdict: pass`.
