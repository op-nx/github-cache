# Phase 10 deferred items

Out-of-scope discoveries logged rather than fixed, per the executor scope boundary (only auto-fix
what the current task's own changes caused).

## D1 -- ROADMAP's descriptive plan list is 7 rows behind its checkbox list

**Found:** plan 10-08, while running `roadmap update-plan-progress 10`.

`.planning/ROADMAP.md` Phase 10 carries TWO plan lists. The first (`- [x] 10-01-PLAN.md` ...) is the
one `roadmap update-plan-progress` maintains, and it is fully ticked with the phase status now
reading `Complete`. The second is a descriptive list pairing each plan with its purpose
(`- [ ] \`10-02-PLAN.md\` - the \`mirrored-by\` label seam, ...`), and the tool does not touch it.
Only `10-01` is ticked there; `10-02` through `10-08` are all unticked even though all eight
`10-*-SUMMARY.md` files exist on disk.

**Why it was not fixed here.** Six of the seven stale rows belong to other plans, so ticking them
from 10-08 is outside this plan's scope. Ticking only `10-08`'s own row would leave `10-02` through
`10-07` unticked between two ticked rows, which reads as more broken than the current uniform state.

**Impact: cosmetic, and bounded.** The canonical machine-read list is the first one and it is
correct, as is the phase status. Nothing keys off the descriptive list.

**Suggested fix:** tick `10-02` through `10-08` in one pass at Phase 11's planning, or teach
`roadmap update-plan-progress` to update both lists.

## D2 -- three stale same-OS-restore prose sites survive in the publish engine, unguarded

**Found:** `/gsd:secure-phase 10`, by `gsd-security-auditor`, while verifying T-10-27's scan-scope
claim. Recorded in full as finding **F-10-A** in `10-SECURITY.md` section 4, which is authoritative
for the detail; this entry exists so Phase 11 planning finds it without reading the audit.

Three comments still assert the pre-VER-01/VER-03 world in which a foreign-OS entry MISSes its
same-OS restore: `packages/github-cache/src/publish/publish-mirror.ts:153`, and
`publish-mirror.spec.ts:515` plus the test title at `:244`. Since VER-01 + VER-03 a foreign-OS entry
does NOT miss; the `evicted` half of each claim stays true, so the code branch is still real and
only the stated CAUSE is stale.

**Why it was not fixed:** the auditor's brief made implementation files read-only, correctly -- an
auditor editing the tree it audits is the self-certification shape TRUST-13 exists to prevent.

**Impact: LOW, prose only.** No executable logic reads these comments and no security control
depends on them. The reason it is worth a row rather than silence: `DOCS_08_SITES` carries no
`forbidden` pattern for `publish-mirror.ts`, so nothing guards this file -- and an unguarded prose
site is exactly the class that shipped Phase 9's `read-back.ts` regression. Note `09-SECURITY.md`
residual note 2 named two of these three already; the other two sites from that note WERE closed
this phase, so this is a partial carry-forward, not a fresh discovery.

**Suggested fix:** fold all three into Phase 11's same-OS prose sweep, and in the same commit add a
`publish-mirror.ts` row with a `forbidden` pattern to `DOCS_08_SITES` so the guard covers the file
rather than the phase.
