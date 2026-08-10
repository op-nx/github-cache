# Pre-flight probe results -- v0.0.2

**Measured:** 2026-07-26
**Run:** `probe-crossos` 30220536303, PR #8 (throwaway, closed and deleted after recording)
**Commit probed:** `fe25a3f` (`origin/main`). No hashed input differs between it and local `main`;
the intervening commits touch `.planning/` only.
**Both legs:** success.

Answers the three MUST-MEASURE gaps left open by `SUMMARY.md` section 6.

---

## Q1 -- zstd and GNU tar on `windows-11-arm`: BOTH PRESENT. O4 is not blocked.

```
platform : win32-arm64
zstd     : PRESENT at /c/tools/zstd/zstd   ->  Zstandard CLI (64-bit) v1.5.7
tar      : /usr/bin/tar                    ->  tar (GNU tar) 1.35
```

`actions/cache#1622`'s last comment is correct; `actions/partner-runner-images`'
`arm-windows-11-image.md` listing zstd under "Omitted software" is STALE. XOS-05 is reachable at
the library level and Phase 12 keeps its primary deliverable. No `choco install zstandard` step
needed.

**Correction to `.planning/debug/windows-publish-one-asset.md` E9.** That report states the Windows
runner "now ships zstd (Git for Windows bundles it under `usr/bin`)". The bundling claim is FALSE:

```
/c/Program Files/Git/usr/bin/tar.exe    PRESENT (511486 bytes, Jul 10 15:30)
/c/Program Files/Git/usr/bin/zstd.exe   ABSENT
```

zstd comes from a separate install at `C:\tools\zstd`, not from Git for Windows. This matters for
risk, not for the verdict: a tool at `C:\tools` is a runner-image provisioning choice, which is
weaker than a Git-for-Windows guarantee. It STRENGTHENS the case for VER-05 surfacing the resolved
compression method rather than assuming it, since the thing supplying it is more likely to move
than previously believed.

---

## Q2 -- `cwd` vs `GITHUB_WORKSPACE`: identity HOLDS on both legs

```
windows-11-arm    cwd = C:\a\github-cache\github-cache
                  GITHUB_WORKSPACE = C:\a\github-cache\github-cache
                  resolved + case-normalised identity: HOLDS
```

Consistent with the static read that no job in `ci.yml` sets `working-directory`. VER-04's
assertion now has a measured baseline: it is a guard against future drift, not a fix for a live
break. Keep it -- nothing currently defends the identity, and PITFALLS B1 shows the failure is a
silent permanent all-MISS.

---

## Q3 -- cross-OS hashes with freshness CONTROLLED: the OS axis is real, AND it was confounded

Both legs ran `nx reset` first, so both are cold.

| target | ubuntu-24.04-arm | windows-11-arm | match |
|---|---|---|---|
| `build` | `3919282196916976507` | `9351058897283095552` | NO |
| `test` | `13619958981758949695` | `7684434396554539514` | NO |
| `typecheck` | `13760497641595851564` | `12047749006609736502` | NO |
| `integration` | `8865876519165210738` | `1822904335635353663` | NO -- **correct**, declared discriminator |

`integration` diverging is the DESIGNED behaviour (CORR-04's `{ "runtime": "node -p
process.platform" }`), so O3's mechanism is confirmed working at this commit.

### The finding that reframes Phase 8

Local Windows measurements at the same commit, taken immediately before the probe:

| state | `build` | `test` |
|---|---|---|
| local Windows, WARM (stale `.nx/workspace-data`) | `3919282196916976507` | `13619958981758949695` |
| **ubuntu-24.04-arm, cold** | **`3919282196916976507`** | **`13619958981758949695`** |
| local Windows, COLD (after `nx reset`) | `9351058897283095552` | `7684434396554539514` |
| **windows-11-arm, cold** | **`9351058897283095552`** | **`7684434396554539514`** |

**A warm Windows box computes ubuntu's hash exactly. A cold Windows box computes Windows' hash
exactly. Two targets, both directions, exact.** Not coincidence.

So there are TWO independent axes:

1. **A real OS axis** -- cold-ubuntu != cold-windows for every target.
2. **A freshness axis that perfectly masquerades as it** -- stale `.nx/workspace-data` on Windows
   reproduces the Linux inference result.

**Every prior cross-OS hash measurement in this repo read a confounded variable**, including the
pair recorded in `STATE.md` and attributed there to "ubuntu CI" vs "windows CI". It also explains
why this was invisible for so long: anyone measuring on an established Windows workstation saw
Linux's number and concluded parity.

The likely root cause is now much sharper than "cross-OS divergence": a **Windows-specific
inference difference that only manifests on a COLD graph**. That is the `@nx/vitest` /
`@nx/js/typescript` OS-dependent-ProjectConfiguration class recorded in v0.0.1's
`research/PITFALLS.md:329-331`, gated on freshness -- which is why the v0.0.1 fixes appeared to
hold.

`typecheck` carries a THIRD source of variance: four distinct values across the four measurements,
so local-vs-CI differs for it beyond the two axes above. Plausibly `npm install` vs `npm ci`
reaching it via `dependentTasksOutputFiles` or `externalDependencies`; PARITY-04 already requires
install mode to be recorded. Not root-caused here.

### Local determinism, established separately

Three consecutive local runs at HEAD: two independent cold runs produced byte-identical hashes, and
a warm re-run after the reset agreed with them. So the hash is NOT nondeterministic -- cold is a
stable, reproducible state. The divergent values came from a `.nx/workspace-data` that had gone
stale across the day's `nx.json` and docs changes and never self-healed.

---

## Consequences

| # | Consequence | Lands in |
|---|---|---|
| 1 | XOS-05 / Phase 12 unblocked; no zstd install step needed | Phase 12 |
| 2 | VER-05's rationale strengthened -- zstd's provenance is a runner-image choice at `C:\tools`, not a Git-for-Windows guarantee | Phase 9 |
| 3 | `windows-publish-one-asset.md` E9's "Git for Windows bundles it" claim corrected | debug record |
| 4 | VER-04 is a drift guard, not a live fix -- keep it, and say which it is | Phase 9 |
| 5 | **PARITY-01 must control the freshness axis before attributing anything to the OS**, and must state that prior measurements were confounded | Phase 8 |
| 6 | **PARITY-02's observation points each need a graph state**, and the Windows workstation needs BOTH | Phase 8 |
| 7 | The leading PARITY-01 hypothesis is now specific: a Windows-only inference difference visible only on a cold graph | Phase 8 |
| 8 | `typecheck` has a third variance source beyond OS and freshness | Phase 8 |
| 9 | O3's mechanism confirmed working at this commit -- `integration` diverges by declaration | Phase 11 (cite, do not re-derive) |
| 10 | DOCS-07 needs the "if your local box misses everything, `nx reset`" note; the symptom is a silent MISS with no error | Phase 12 |

---

## Method note

The probe deliberately did not start the cache sidecar; it measured the environment and the hashes
only. `nx run-many` was `|| true`-guarded so a failing task would still yield hashes. Per-task
hashes were read from `.nx/cache/run.json`, the surface STACK identified -- written unconditionally
by `StoreRunInformationLifeCycle` and overwritten by every `nx` invocation, so it must be read
immediately after the run that produced it.

`run.json` gives per-TASK hashes only. Naming the diverging hash NODE requires the per-node
`details` map (`TaskHashDetails.details`), which no CLI command prints -- that is PARITY-01's job,
and `nx-target-inputs.spec.ts` is the in-repo precedent for reaching into `nx/src/hasher/*`.
