# Phase 0 Teardown - Deferred / Out-of-Scope Items

Items discovered during execution that are outside the touching plan's scope.

## From plan 00-03 (de-prime stale docs)

- **Pre-existing non-ASCII in `.planning/STATE.md`**: lines carrying "Current focus", "Current Position", and "Last activity" use em-dash (U+2014) characters, which violate the project strict-ASCII rule. These were written by GSD state tooling in an earlier plan/session (they appear on unchanged context lines, not introduced by 00-03). Out of scope for 00-03 (which modifies `.prettierignore` and `README.md` only). `.planning/` is now prettier-ignored (D-07), so this does not affect the `nx format:check --all` CI gate. Fix opportunistically if a future plan authors STATE.md content, or via a one-time ASCII sweep of `.planning/`.
