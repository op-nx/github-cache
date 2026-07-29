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
