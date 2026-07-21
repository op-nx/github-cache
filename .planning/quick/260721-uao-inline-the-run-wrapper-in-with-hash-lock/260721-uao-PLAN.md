---
quick_id: 260721-uao
slug: inline-the-run-wrapper-in-with-hash-lock
status: planned
date: 2026-07-21
---

# Quick Task 260721-uao: Inline the run wrapper in withHashLock

## Description

Apply the one triaged ponytail-review over-engineering finding from the PR #3
review pass. All four other candidates were rejected on read (documented
deliberate decisions, or an actively-wrong suggestion that would have introduced
an unhandled-rejection bug). This is the only survivor.

## Task

**File:** `packages/github-cache/src/lib/with-hash-lock.ts`

Remove the dead `run` indirection. The `const run = (): Promise<T> => fn();`
local existed only to forward to `fn`, which ignores the settled value/reason
`.then` passes it. Inline to `const result = prior.then(fn, fn);` and update the
adjacent comment to reference `fn`.

- **action:** delete the `run` local; call `prior.then(fn, fn)` directly.
- **verify:** `nx test github-cache` (includes `with-hash-lock.spec.ts` and
  `serve.spec.ts`) and `tsc --noEmit -p tsconfig.lib.json` both green.
- **done:** `run` local gone, tests + typecheck pass, behavior unchanged.

## Rationale

`prior` is `Promise<unknown>`; `fn: () => Promise<T>` is assignable to both the
onFulfilled and onRejected positions of `.then` (a function with fewer params is
assignable), so `prior.then(fn, fn)` is behaviorally identical and type-safe.
Dead indirection removed; no behavior change.

## Scope guard

Do NOT touch any other file or the four rejected findings.
