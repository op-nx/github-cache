# 260721-wtl - Schedule-payload probe (empirical evidence)

**Question:** Does the synthesized GitHub `schedule` event payload carry
`repository.default_branch` (the field `isSyncTrusted` reads)? A `schedule` event only
fires from the default branch and cannot be manually dispatched, so this required a real
scheduled run from `main`.

**Method:** A temporary probe workflow (`.github/workflows/_schedule-payload-probe.yml`,
`on: schedule (*/5) + workflow_dispatch`, `permissions: contents: read`, no `${{ }}`
interpolation into `run:`) was pushed to `main` (`ca2124b`), left to fire one real
scheduled run, then reverted (`c06664f`). `main` content is net-unchanged.

**Result (schedule run `29874290591`, 2026-07-21T22:35Z):**

```
event_name=schedule
ref=refs/heads/main
ref_name=main
GITHUB_ACTIONS=true
repository.default_branch (jq on $GITHUB_EVENT_PATH) = main    <-- PRESENT
payload contains a full "repository" object: yes
```

The first schedule run did not fire until ~58 min after the workflow landed on `main`
(GitHub delays newly-added scheduled workflows well beyond their cron interval).

**Conclusion:** `repository.default_branch` IS present in the schedule payload today, so
`isSyncTrusted` would not fail-closed on a real scheduled cleanup run. The gate still uses
the narrower `isTrustedSyncEvent` on robustness grounds: the synthesized schedule payload
is uncontracted ("present today" != guaranteed), and the default-branch check is redundant
for cleanup (schedule runs only on the default branch, confirmed `ref_name=main`). A
retention-LOCKED path must not depend on an unguaranteed field for zero added safety.
