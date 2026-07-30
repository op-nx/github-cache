# Cross-OS caching

This document is the recipe for sharing one Nx remote cache across operating
systems. It renders values that live in configuration, never a re-typed
paraphrase: the platform discriminator below is read out of this repository's own
`nx.json`, and the `docs-cross-os` guard
(`packages/github-cache/src/docs-cross-os.spec.ts`) fails the build until this
file is back in sync with it. If this document and the configuration disagree,
the configuration wins.

## Single sources of truth

| Concern                            | Source                                                           |
| ---------------------------------- | ---------------------------------------------------------------- |
| The platform discriminator command | `nx.json`, `targetDefaults.integration.inputs` (this repository) |

## 1. The safe default: declare the discriminator on every cacheable target

Declare the platform discriminator on ALL cacheable targets, then remove it from
one target only after you have PROVEN that that target's output is portable.

The order matters because the two mistakes are not symmetric. Declaring the
discriminator where it was not needed costs you cache hits. Omitting it where it
was needed hands a Linux-produced result to a Windows consumer and reports a
cache hit -- a wrong result, not a slow one. Start from the safe side and earn
your way off it, target by target.

The discriminator is a `runtime` input: Nx runs the command and folds its output
into the task hash, so two operating systems compute different hashes for the
same target and never read each other's entries.

```json
{
  "targetDefaults": {
    "integration": {
      "inputs": [
        "default",
        "^production",
        { "runtime": "node --no-warnings -p process.platform" }
      ]
    }
  }
}
```

`targetDefaults.<target>.inputs` REPLACES the inferred input list rather than
merging into it, so declaring an input means ADDING A LINE to the whole list --
nothing your plugin inferred survives beside it. The same rule applies one layer
up: an `inputs` key declared in a project's own configuration sits ABOVE
`targetDefaults` and replaces the default's key wholesale, discriminator
included.

Verify the command on your own runners before you trust it. Do not paste it and
move on:

```bash
# (a) --no-warnings is a NODE flag, not a shell redirect, and that is
#     load-bearing. Nx runs a runtime input through exactly ONE shell per
#     operating system -- %COMSPEC% /C (cmd.exe) on Windows and sh -c
#     everywhere else -- so 2>/dev/null or 2>nul would BREAK the command on one
#     of them rather than merely read differently there. The flag is node's own
#     and behaves identically on both.
# (b) stderr is why the flag is there at all. Nx hashes the command's trimmed
#     stdout AND its trimmed stderr, concatenated with no separator between
#     them, so any non-empty stderr silently EXTENDS the hashed token. A node
#     warning's text carries the process PID, so a warning would not rotate the
#     hash once -- it would vary it on EVERY invocation, giving a permanent
#     100% MISS that presents as a portability failure rather than as a warning.
# (c) What you must VERIFY rather than assume: that the command prints a
#     NON-EMPTY token, and that the token DIFFERS on each operating system you
#     cache across. This repository catches a collapsed discriminator with a
#     build-gating two-leg comparison. You have no such gate, so a discriminator
#     that quietly collapsed to one value would make the target OS-invariant
#     again with no signal at all.
node --no-warnings -p process.platform
```

## 2. The portability checklist: how to EARN a removal

Removing the discriminator from a target is a claim that the target's output does
not depend on which operating system produced it. This checklist is how you earn
that claim; it is not a menu of reasons to skip section 1. Every item below is a
measured trap that has already made a correct configuration look broken.

1. **A warm local box does NOT compute the hash cold CI published.** Measured on
   all five targets at one commit -- same machine, same operating system, same Nx
   version, same Node version, same install mode, with persisted graph state the
   only variable -- and the answer was no on all five. A box carrying a stale
   persisted inference misses every remote entry CI produced, and no amount of
   cross-OS parity changes that. The mitigation is a FULL `nx reset`.

2. **The reset is needed AFTER pulling a fix, not only before it.** A persisted
   plugin cache does not self-heal when the configuration changes: the file hash
   still validates, so nothing re-derives what it implies, and a developer who
   does nothing after pulling keeps computing the pre-fix value. This is the
   single most likely way for a correct fix to look broken.

3. **Deleting the repository's `.nx/` directory does NOT produce a cold state.**
   The native file cache resolves under the operating system's temp directory,
   OUTSIDE the repository, so a recipe built on removing `.nx/` is measuring
   something it cannot name. The same applies inside a git worktree: at Nx 23.1.0
   the shared cache directory resolves the MAIN worktree root, so a worktree's
   "cold" reading is not cold either.

4. **Document the FULL `nx reset`, never the workspace-data-only form.** The
   narrow form does not stop the daemon, so on Windows it can fail with a
   permission error while the daemon still holds the workspace-data file open --
   leaving a WARM graph behind a claim of cold.

5. **To REPRODUCE the measurement rather than repair a box, redirect the cache
   directories instead of destroying state.** Point Nx's two cache-directory
   environment variables, `NX_WORKSPACE_DATA_DIRECTORY` and
   `NX_NATIVE_FILE_CACHE_DIRECTORY`, at a temporary directory. That is cold BY
   CONSTRUCTION -- an empty directory's emptiness is readable BEFORE the
   measurement, whereas a reset is an operation that can fail -- and it is
   non-destructive, which matters because the stale graph is itself a measurement
   subject and cannot be regenerated once cleared.

## 3. What `process.platform` does not cover

`process.platform` is an operating-system read and nothing more. It does not
cover CPU architecture and it does not cover libc, and this project cannot
exercise either -- every machine here is arm64.

So the coverage this recipe claims ends where this project's evidence ends. If
you cache across an x64 runner and an arm64 runner, or across a glibc image and a
musl image, the operating-system read alone does not separate them: you need an
input that names the axis you actually vary. The same `runtime` mechanism carries
it; only the command changes.

## 4. The one cross-OS hazard Nx already closes for you

Nx trims both streams before concatenating them, so a trailing-newline or
CRLF-versus-LF difference in the discriminator's OWN output cannot skew the hash.

That is worth stating because it is the one line-ending hazard on this path you
do not have to handle. Every other line-ending difference in your inputs is still
yours to manage.
