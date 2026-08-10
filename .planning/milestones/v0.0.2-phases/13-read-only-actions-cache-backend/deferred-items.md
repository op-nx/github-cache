# Phase 13 deferred items

Out-of-scope discoveries logged rather than fixed, per the executor scope boundary (only auto-fix
what the current task's own changes caused).

## D1 -- a redundant untracked `.gitkeep` sits in this phase's directory

**Found:** plan 13-01, in the `git status --short` sweep the task commit protocol mandates.

`.planning/phases/13-read-only-actions-cache-backend/.gitkeep` is untracked. It predates this
plan's changes -- it was already present in the session's opening `git status` as part of the
untracked phase directory -- so the executor scope boundary excludes it.

It is also redundant on its own terms. A `.gitkeep` exists to keep an EMPTY directory in git, and
this directory holds eleven tracked files (`13-01-PLAN.md` through `13-VALIDATION.md`). No other
phase directory in this repo tracks one: `git ls-files ".planning/phases/*/.gitkeep"` returns
nothing, so committing this one would establish a convention of one.

**Impact: LOW, but not zero, and the non-zero part is why this is a row rather than silence.** An
untracked file under `.planning/` is the same hazard class this repo's `.gitignore` documents at
length for the workspace-root tee'd logs: `capture-hashes.mjs` records `workingTreeClean` from
`git status --porcelain`, so anything untracked sitting in a checkout that also takes a hash
capture pegs that field to false and destroys the signal it exists to carry. Phase 13 closes on
exactly that kind of measurement (13-06's pre-registered counts and proving run), so the field is
live for this phase rather than latent.

The larger instance of the same hazard WAS fixed here, because it is generated output that grows
with every probe rather than a one-off placeholder: `.planning/research/.cache/` is now gitignored
with its reasoning recorded in the file's established voice.

**Suggested fix:** delete the file. It guards an empty directory that is not empty. If GSD
re-creates it on the next phase scaffold, add `.planning/phases/*/.gitkeep` to `.gitignore` rather
than tracking one placeholder per phase.
