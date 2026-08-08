# Feature Research -- v0.0.2 OS-invariant cross-OS sharing

**Domain:** Cross-platform artifact sharing in content-addressed build caches
**Researched:** 2026-07-26
**Confidence:** HIGH for Q1/Q2 (every claim below is quoted from vendored source or primary docs,
fetched this session); MEDIUM-HIGH for Q3 (negative claim -- "no build cache detects portability
violations at serve time" -- is an absence-of-evidence argument over the five systems surveyed,
not an exhaustive proof).

> Carries forward `.planning/research/FEATURES.md` (v0.0.1). That document's landscape -- Nx HTTP
> contract, CREEP posture, retention, adoption ergonomics, competitor matrix -- is NOT repeated.
> This one answers only the cross-OS-sharing question. Where the two disagree, this document wins
> for v0.0.2 and the disagreement is called out explicitly (see `## Contradictions and sharpenings`).

---

## 1. Prior art: portability lives in the KEY, and the key is always DECLARED

### The headline

**No surveyed system infers portability. Every one of them is declaration-based.** They differ only
in (a) what the default declaration is, and (b) how much of the execution environment the substrate
happens to capture by accident. There is no system that computes "is this artifact portable?"

Three distinct mechanisms exist. They are not interchangeable, and conflating them is the trap:

| Mechanism | How portability is decided | Systems | Failure mode when wrong |
|-----------|---------------------------|---------|-------------------------|
| **A. Platform in the key, declared** | The task/action author declares the execution platform; it is hashed into the action key | Bazel (REAPI `Platform`), Nx (`runtime` input -- our CORR-04) | Over-partition = silent MISS. Under-declare = wrong artifact |
| **B. Content-derived implicit** | The key hashes the actual environment-varying content (compiler binary digest, preprocessed system headers), so a platform difference changes the key without anyone naming "platform" | ccache, sccache | Practically MISS-only: the differing content IS hashed, so a wrong hit needs a hash collision |
| **C. Author's cacheability declaration** | An annotation asserts the output is reproducible and relocatable; the key never mentions platform | Gradle `@CacheableTask` + `@PathSensitive` | Wrong artifact, silently. Correctness is 100% on the annotation |

**Nx is mechanism A with an empty default.** That is the single most important finding for this
milestone: Nx gives you the declaration slot but declares nothing for you (Section 2).

### Bazel -- platform IS in the action key, but only what you declare

Verified against the Remote Execution API proto (`bazelbuild/remote-apis`,
`build/bazel/remote/execution/v2/remote_execution.proto`, fetched at `main`).

The `Platform` message is documented as "a set of requirements, such as hardware, operating system,
or compiler toolchain, for an `Action`'s execution environment." The load-bearing sentence, verbatim
from the `Platform.Property` doc comment:

> "Note that the platform is implicitly part of the action digest, so even tiny changes in the names
> or values (like changing case) may result in different action cache entries."

And, on why ordering is normative:

> "In order to ensure that equivalent `Platform`s always hash to the same value, the properties MUST
> be lexicographically sorted by name, and then by value."

So the mechanism is real and the platform genuinely enters the cache key. **But Bazel's own caching
docs (https://bazel.build/remote/caching) document unsound cross-machine sharing anyway**, verbatim:

> "Bazel currently does not track tools outside a workspace. This can be a problem if, for example,
> an action uses a compiler from `/usr/bin/`. Then, two users with different compilers installed
> will wrongly share cache hits because the outputs are different but they have the same action hash."

and

> "An action definition contains environment variables. This can be a problem for sharing remote
> cache hits across machines. For example, environments with different `$PATH` variables won't share
> cache hits."

This pair is the most useful thing Bazel contributes to our milestone: **the strongest
platform-in-the-key system in the industry still ships a documented wrong-result hole**, because
the key only captures what was declared. Bazel's answer is hermeticity discipline (glossary: "A build
is hermetic if there are no external influences on its build and test operations"), not detection.

Bazel's glossary defines the action key as "computed based on action metadata, which might include
the command to be executed in the action, compiler flags, library locations, or system headers,
**depending on the action**" -- note "depending on the action", i.e. author-determined.

*UNVERIFIED / ASSUMED:* whether Bazel populates `Platform` with OS properties **by default** when
using `--remote_cache` without remote execution. The REAPI mechanism is verified; the default
population path was not traced. Do not cite Bazel as "OS is automatically in the key".

### Gradle -- portability is an annotation, and the docs say so plainly

Verified against `docs.gradle.org` (current).

Cache key components, verbatim from `build_cache_concepts.html`:

> "The following inputs contribute to the build cache key for a task: The task implementation, The
> task action implementations, The names of the output properties, The names and values of task
> inputs"

**No operating system, no platform, no architecture.** The page has no statement at all about
caching across different operating systems.

Declaration lives in the annotation. Verbatim from the `@CacheableTask` javadoc:

> "Attached to a task type to indicate that task output caching should be enabled by default for
> tasks of this type."
> "Only tasks that produce **reproducible and relocatable** output should be marked with
> `CacheableTask`."

Path sensitivity is the relocatability half, verbatim:

> "To allow cached results to be shared even when builds are executed from different root
> directories, Gradle needs to understand which inputs can be relocated and which cannot."
> "Task properties declared with `ABSOLUTE` path sensitivity are considered non-relocatable [...]
> Therefore, the path sensitivity for the sources of the `JavaCompile` task is `RELATIVE`."

**Direct relevance to VER-01.** Gradle's `ABSOLUTE`-is-non-relocatable rule is the same defect
VER-01 removes: an absolute `os.tmpdir()` string baked into the `@actions/cache` version is exactly
an `ABSOLUTE` path sensitivity, and the fix (a workspace-relative forward-slash literal) is exactly
Gradle's `RELATIVE`. v0.0.2's VER-01 is not a novel idea; it is the industry-standard relocatability
fix, and DOCS-07 can say so.

### Turborepo -- platform is genuinely ASSUMED (the one true "assumed" case)

Verified at source, not docs (`vercel/turborepo`, `crates/turborepo-hash/src/lib.rs`,
`crates/turborepo-task-hash/src/global_hash.rs`, fetched at HEAD).

`GlobalHashable` fields: `global_cache_key`, `global_file_hash_map`,
`root_external_dependencies_hash`, `root_internal_dependencies_hash`, `engines`, `env`,
`resolved_env_vars`, `pass_through_env`, `env_mode`, `framework_inference`, `global_configuration`.

`TaskHashable` fields: `global_hash`, `task_dependency_hashes`, `hash_of_files`,
`external_deps_hash`, `package_dir`, `task`, `outputs`, `pass_through_args`, `env`,
`resolved_env_vars`, `pass_through_env`, `env_mode`, `command_override`.

**No OS, no platform, no arch field in either struct.** The docs confirm the omission is not a
docs gap: the caching page enumerates the hash inputs and mentions no OS, and makes no statement
about cross-OS cache sharing. Turborepo is the closest structural analogue to Nx (JS monorepo task
cache, remote cache, same problem) and it simply assumes portability with no declaration slot and
no warning. **That is the ecosystem's weakest position, and it is the one v0.0.2 must NOT be
mistaken for.** Our CORR-04 discriminator is what separates us from Turborepo's posture.

### sccache and ccache -- mechanism B, correctness for free from content

sccache, verified at source (`mozilla/sccache`, `src/compiler/c.rs`). The hash key is, in order:
`compiler_digest`, a `plusplus` flag byte, `CACHE_VERSION`, `language`, all `arguments`,
`extra_hashes`, allowlisted `env_vars`, then the preprocessor output. `CACHE_VERSION` is
`b"12"`, guarded by the doc comment:

> "If you change any of the inputs to the hash, you should change `CACHE_VERSION`."

ccache, verified against the manual (`ccache.dev/manual/latest.html`):

> "The following information is always included in the hash: the extension used by the compiler for
> a file with preprocessor output [...], the compiler's size and modification time (or other
> compiler-specific information specified by compiler_check), the name of the compiler, the current
> directory (if hash_dir is enabled), contents of files specified by extra_files_to_hash"

**Neither hashes "the OS".** Platform reaches the key implicitly: a different OS means a different
compiler binary (hashed via digest/mtime+size) and different system headers (hashed via the
preprocessed source). ccache's explicit cross-machine guidance, verbatim:

> "It is recommended to use the same operating system version when using a shared cache. If
> operating system versions are different then system include files will likely be different and
> there will be few or no cache hits between the systems."

Read that carefully: the stated consequence is **"few or no cache hits"** -- a MISS problem, not a
wrong-result problem. ccache can afford to be relaxed because the thing that differs across OSes is
itself inside the hash.

Both also ship a relocatability knob mirroring Gradle's path sensitivity: ccache's `base_dir`
("Ccache will convert absolute paths under this directory to relative paths before hashing") and
sccache's `basedirs` ("This enables cache hits across different absolute paths (similar to ccache's
CCACHE_BASEDIR)"). Again: same defect class as VER-01.

### The asymmetry that matters most for us

**Nx has no mechanism-B safety net.** Nx's documented hash inputs are "All the source files of
`remixapp` and its dependencies / Relevant global configuration / Versions of external dependencies
/ Runtime values provisioned by the user such as the version of Node / CLI Command flags"
(`how-caching-works.mdoc`, Nx 23.1.0, local clone).

Everything in that list is **inside the workspace or explicitly declared**. The Node binary, the OS,
glibc-vs-musl, the arch -- none are hashed unless a `runtime` input names them. Where ccache
accidentally captures the toolchain by hashing preprocessed system headers, Nx captures nothing
outside your repo. So the ccache posture ("relax, you'll just get misses") **does not transfer to
Nx**, and DOCS-07 must not borrow it. Under Nx, an undeclared platform dependency is a
wrong-artifact bug, not a miss.

---

## 2. Ecosystem norm in Nx: trust-the-hash, confirmed, and nobody documents cross-OS

### `nx-remotecache-custom` -- CONFIRMED verbatim

Verified at source (`NiklasPor/nx-remotecache-custom`, `main`). `lib/get-file-name-from-hash.ts` in
full:

```ts
import { HASH_SUFFIX } from "./hash-suffix";

export function getFileNameFromHash(hash: string): string {
  return hash + HASH_SUFFIX;
}
```

`lib/hash-suffix.ts` in full -- and the comment confirms the suffix is a **format epoch**, exactly
as the research question framed it:

```ts
/**
 * Hash suffix will be modified whenever the archiving method is beeing updated.
 * This will prevent incorrect cache-hits with older versions.
 *
 * Examples:
 * - .zip
 * - .tar.gz
 * - -v2.tar.gz
 */
export const HASH_SUFFIX = ".tar.gz";
```

`hash + ".tar.gz"`, no OS component, and the only suffix concept is a scheme/format epoch. **D2-05's
premise is verified exactly as stated.**

### Survey of the other implementations

| Implementation | Status | Key derivation | OS in key? | Documents cross-OS? |
|---|---|---|---|---|
| `nx-remotecache-custom` (base lib) | Live, pushed 2025-06-11 | `hash + ".tar.gz"` | No | No |
| `nx-remotecache-azure` | Live, pushed 2025-06-11 | Passes `filename` straight through to `BlockBlobClient`; the adapter never touches the key | No | No |
| `nx-remotecache-minio` | Live (NiklasPor) | Same base lib | No | No |
| `nx-remotecache-gcs` (`wvanderdeijl`) | **Actively maintained, pushed 2026-07-24; current HTTP contract, not legacy runner** | `GET/PUT /v1/cache/:hash` -> GCS object `${prefix}${hash}`; `prefix` is an operator-set string with no OS awareness | No | No |
| `nx-remotecache-s3` (`robinpellegrims`) | **Archived 2026-04-11** | Same base lib | No | No |
| `@nx/azure-cache` / `@nx/s3-cache` / `@nx/gcs-cache` (1st-party Powerpack) | Deprecated May 2026, closed source | Not inspectable | Not documented | No |
| Nx Cloud | Closed SaaS | Not public | Unknown | No |

**Answer to "does ANY of them namespace by OS or document cross-OS correctness at all": no. Not
one.** The most recently maintained third-party implementation (`nx-remotecache-gcs`, four days
ago) is a bare `hash` -> object mapping.

### The protocol itself forecloses it

Verified against the Nx client (local clone at tag `23.1.0`,
`packages/nx/src/native/cache/http_remote_cache.rs`). `retrieve` builds
`format!("{}/v1/cache/{}", self.url, hash)` and sends `Accept: application/octet-stream` plus the
bearer token. **There is no OS field, no platform header, nothing but the hash on the wire.** A
self-hosted server can only namespace by OS by sniffing its own `process.platform` out of band --
which is precisely what v0.0.1's CORR-01 did, and precisely why it was invisible to Nx and cost
every cross-OS hit.

The Nx client also carries a comment that is the clearest statement of the trust-the-hash contract
in the whole ecosystem, verbatim from `store`:

> "We can change the creation of the tar in a future version without worrying about breaking
> existing user cache's, because when the user updates their task's hashes will be changed... so
> users retrieving old hashes will not be affected, and new entries will have distinct hashes."

Nx's position: **the hash is the entire key, and anything that should invalidate must be made to
change the hash.** Not the store.

### Nx documents nothing about OS -- verified by absence

Searched the Nx 23.1.0 docs tree (`astro-docs/src/content/docs/guides/Tasks & Caching/*`,
`concepts/how-caching-works.mdoc`) for `operating system`, `cross-os`, `cross-platform`,
`different machines`, `process.platform`. **Zero hits.**

The one adjacent statement is about replay fidelity, not correctness: "Captures stdout and stderr to
make sure the replayed output looks the same, including on Windows." (Relevant to TRUST-11 -- Nx
confirms terminal output is part of the stored entry.)

### Nx's own guidance already endorses DOCS-07's ordering

This is the most directly reusable finding for the recipe author. Verbatim from
`configure-inputs.mdoc` (Nx 23.1.0):

> "Nx errs on the side of caution when using inputs. Ideally, the "perfect" configuration of inputs
> will allow Nx to never re-run something when it does not need to. In practice though, it is better
> to play it safe and include more than strictly necessary in the inputs of a task. Forgetting to
> consider something during computation hash calculation may lead to negative consequences for end
> users. **Start safe and fine-tune your inputs when there are clear opportunities to improve the
> cache hit rate.**"

That is DOCS-07's mandated structure -- declare broadly first, remove per target only after proving
portability -- stated by Nx itself. **DOCS-07 should quote it.** It converts the recipe's primary
instruction from "this project's opinion" into "the framework's documented guidance".

The declaration mechanism is also already documented in the shape we use. Nx's canonical example
for a workspace-wide runtime input:

```jsonc
// nx.json
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "sharedGlobals": [{ "runtime": "node --version" }]
  }
}
```

Our platform discriminator is the same construct with a different command. DOCS-07 can present it
as "the documented `sharedGlobals` runtime-input pattern, applied to platform instead of Node
version" -- no novel concept to teach.

---

## 3. Detection and enforcement: the honest answer is "nobody does this"

**No surveyed build cache detects a portability violation at serve time.** Detection exists only in
reproducibility tooling adjacent to caches, and every instance works by **re-executing the task** --
which structurally defeats the purpose of a cache. That is not an implementation gap; it is the
shape of the problem.

| System | What it does | Detects | Cost | Cache-compatible? |
|---|---|---|---|---|
| **Nix `nix-store --realise --check`** | "This option allows you to check whether a derivation is deterministic. It rebuilds the specified derivation and checks whether the result is bitwise-identical with the existing outputs, printing an error if that's not the case." Requires "The outputs of the specified derivation must already exist." With `-K`, "the new output path is left in `/nix/store/name.check`". Dedicated exit code **104 Not deterministic** | Non-determinism / impurity vs an existing store path | Full rebuild | **No** -- rebuilds the thing you cached |
| **reprotest** (Debian) | "builds the same source code twice in different environments, and then checks the binaries produced by each build for differences. If any are found, then diffoscope(1) [...] is used to display them in detail". Default variations: `environment, build_path, kernel, aslr, num_cpus, time, user_group, fileordering, domain_host, home, locales, exec_path, timezone, umask` | Environment-sensitivity, by deliberate variation | Two builds | **No** -- double-build |
| **Develocity Build Validation Scripts** (Gradle) | Five scripted "experiments", incl. `04-validate-remote-build-caching-ci-ci.sh` ("when invoked from different CI agents") and `05-validate-remote-build-caching-ci-local.sh` ("when invoked on CI agent and local machine") | **MISSES only** -- cacheability/work-avoidance gaps across environments. Not wrong results | Two builds + Develocity | Partly -- it is a measurement harness, run out of band |
| **Bazel** | Documents the unsound-sharing hole (Section 1); offers `--experimental_guard_against_concurrent_changes` for input mutation *during* a build | Concurrent input changes. **Not** portability | Low | Yes, but wrong problem |
| **ccache / sccache** | Nothing. Correctness comes from mechanism B | n/a | n/a | n/a |

### The three conclusions the roadmapper needs

1. **The existing `## Out of Scope` call is correct and now has evidence.** "Empirical
   divergence-detection subsystem -- Disproportionate" is right: the entire industry agrees, and the
   reason is structural (detection requires execution). Keep the row; the justification can now cite
   Nix `--check` and reprotest rather than resting on proportionality alone.

2. **The circularity note in that same row is independently confirmed by Nix.** REQUIREMENTS.md
   already says "O4's green CI is the portability evidence" is circular "since a restored task does
   not execute." Nix's `--check` exists *precisely because* an existing store path proves nothing
   about reproducibility until you rebuild. Same argument, external corroboration.

3. **Develocity experiment 05 is a direct structural analogue of O1** ("invoked on CI agent and
   local machine"). Gradle -- the vendor with the most mature build-cache tooling -- ships a
   *scripted manual experiment* for exactly the scenario XOS-01 proves, rather than any automated
   store-side guarantee. **v0.0.2's TEST-08/TEST-10 recorded live proofs are the industry-standard
   answer, not a weak substitute for one.** Worth saying in the milestone record so a future reader
   does not mistake "we proved it by hand once" for a gap.

### The lazy version of the rejected subsystem (NOT recommended for v0.0.2)

If a sampled detector is ever wanted, the near-zero-complexity form already exists in Nx: a
scheduled CI leg running the shared targets with cache bypass on the non-producing OS and failing on
a red verdict. `skipNxCache` is a real flag in Nx 23.1.0 (verified: declared in
`packages/nx/src/command-line/yargs-utils/shared-options.ts:38,127`). That is Nix's `--check` model
sampled on a cron instead of on every read, and for `typecheck`/`test` -- which cache a **verdict**
-- comparing verdicts is far cheaper than comparing bytes.

**Complexity LOW (one scheduled workflow leg). Recommendation: do NOT add it to v0.0.2.** There are
zero adopters, XOS-04's Windows leg plus CORR-03's continuous hash assertion already cover the
milestone's outcomes, and adding a CI job that deliberately defeats the cache during the milestone
that is trying to prove the cache works muddies the O1 attribution evidence TEST-08 depends on.
Record it as a later-milestone trigger if an adopter with a non-arm64 or musl environment ever
appears -- those are exactly the axes DOCS-07 flags as unexercisable here.

---

## 4. Table stakes vs differentiator vs anti-feature (v0.0.2)

### Table stakes -- the ecosystem does these; not doing them is a defect

| Capability | Why table stakes | Complexity | Depends on (already built) | v0.0.2 reqs |
|---|---|---|---|---|
| **OS-invariant store key** | Universal. Every Nx implementation surveyed keys on bare `hash`; the Nx wire protocol has no OS field at all. v0.0.1's OS-namespaced store is the **ecosystem outlier** | LOW (a rename) | Releases reader/publisher, `CACHE_KEY_PREFIX` | CORR-02, RETAIN-04 |
| **A declared platform discriminator on non-portable targets** | Bazel = REAPI `Platform` in the action digest; Gradle = `@CacheableTask`; Nx = `runtime` input. The declaration is the *whole* correctness mechanism once the store is invariant | LOW (already exists on `integration`) | `nx.json` inputs | CORR-04, CORR-03 |
| **Relocatable (non-absolute) paths in the key** | Gradle `@PathSensitive(RELATIVE)`, ccache `base_dir`, sccache `basedirs`. An absolute path in a cache key is a named industry defect | LOW-MED | `cacheArchivePath()` single source of truth | VER-01..04 |
| **A bumpable scheme epoch / salt** | REAPI `Action.salt`, `HASH_SUFFIX`, sccache `CACHE_VERSION="12"`, Turborepo `GLOBAL_CACHE_KEY`. Universal | **ZERO -- already satisfied** | `CACHE_KEY_PREFIX` is already single-sourced | CORR-02 (implicitly) |
| **Mechanical enforcement of the portability strategy** | Not universal as tooling, but Gradle/Bazel both make the declaration a *compile-time-visible* artifact. A strategy enforced only by prose is the failure v0.0.2 is fixing | MED (new toolchain) | none (repo has no linter) | LINT-01..06, CORR-06 |
| **Cross-environment proof before trusting the cache** | Develocity ships five scripted experiments for it; Gradle does not assume | MED (live proofs) | CI matrix, sidecar | XOS-01..05, TEST-08..10 |

**On the epoch row -- a free win worth one doc line.** REAPI states the purpose exactly: the salt
"allows disowning an entire set of ActionResults that might have been poisoned by buggy software or
tool failures." v0.0.2 already gets this for free: CORR-02's rename from `<hash>-<os>` to
`nx-cache-<hash>` *is* a one-time epoch rotation (which is why OBS-04 correctly predicts a single
legitimate all-miss push). D2-03 rejected a *suffix accept-list*, which is right -- but the prefix
is the better epoch anyway, and it is already single-sourced. **Recommendation: DOCS-07 spends one
sentence naming `CACHE_KEY_PREFIX` as the poison-disowning epoch knob.** No code, no new
requirement, no scope change -- it just makes an existing capability legible, and it pre-answers
"what do we do if a bad artifact gets mirrored" without adding the signing that
`## Key Decisions` already rejected.

### Differentiators -- nobody else does these

| Capability | Value | Complexity | v0.0.2 reqs |
|---|---|---|---|
| **Producer-OS attribution outside the lookup key** (Release asset `label`) | **Genuinely novel.** No surveyed cache records producer provenance at all. Bazel/Gradle/Turborepo/ccache give you nothing when a bad artifact is served. Recovers exactly the incident-response capability CORR-02 removes, at zero correctness cost since `label` is not part of lookup | LOW | OBS-03 |
| **Enforcing the portability strategy with a linter** | Gradle relies on an annotation a human must remember; Bazel on hermeticity discipline. A rule that *fails the build* when a unit spec reads ambient platform state is stricter than any comparator | MED | LINT-02/03, CORR-06 |
| **Continuous cross-OS hash-parity assertion in CI** (CORR-03) | Develocity's equivalent is a manual script run out of band. Making it a **build-gating job with a non-vacuity control** is stronger than the industry norm | MED | CORR-03 |
| **Safe-by-default adoption recipe** | ccache tells you to use the same OS (and is wrong-by-analogy for Nx). Turborepo says nothing. A recipe that says "declare everywhere, then earn removals" is better guidance than any comparator ships | LOW-MED | DOCS-07 |

### Anti-features -- confirmed against the ecosystem

| Anti-feature | Why tempting | Why wrong | Evidence |
|---|---|---|---|
| **OS component in the store key** | "Obviously safer" | Buys nothing the declared input does not, costs every cross-OS hit, and is invisible to Nx (no OS on the wire). Zero of 7 surveyed Nx implementations do it | Section 2 survey; `http_remote_cache.rs` |
| **Empirical divergence-detection subsystem** | "Prove portability instead of declaring it" | Detection requires re-execution (Nix `--check`, reprotest). A cache that re-runs tasks is not a cache | Section 3 |
| **Ordering / first-write-wins as a correctness control** | "Linux writes first, so the Linux verdict wins" | Already REJECTED in PROJECT.md and REQUIREMENTS.md. Nothing in the ecosystem grounds correctness in write ordering; REAPI explicitly requires that *any* satisfying worker produce the same result ("the client SHOULD ensure that running the action on any such worker will have the same result") | REAPI `Action.platform` comment |
| **A per-target OS-invariance opt-out knob** | "Give adopters an exit" | D2-02, zero adopters. Note the comparators put the knob in the **task declaration** (`@CacheableTask`, `runtime` input), never in the **cache backend**. A backend-level knob would be an ecosystem inversion, not just YAGNI | Sections 1-2 |
| **Borrowing ccache's "same OS recommended" guidance into DOCS-07** | It is the only cross-OS advice in the comparator set | ccache can be relaxed because system headers are inside its hash. Nx hashes nothing outside the workspace. Copying the posture would be actively unsafe | Section 1, "the asymmetry" |

---

## Contradictions and sharpenings vs the locked v0.0.2 decisions

**No decision is contradicted.** Two are sharpened, one gap is named.

1. **D2-05 ("Ecosystem norm is trust-the-hash") -- VERIFIED, but the one-line framing under-sells
   its precondition.** Trust-the-hash is the norm *for the store*. It is not the norm for the
   *system*: Bazel puts platform in the action key, ccache/sccache capture it via content, Gradle
   requires an annotation. Only Turborepo genuinely assumes. The honest statement is **"trust the
   hash, having first made the hash trustworthy"** -- which is exactly the CORR-02 + CORR-04 pair.
   Recommend the roadmapper and DOCS-07 use the longer form, because the short form invites a reader
   to conclude the declaration is optional. It is the only thing standing between us and Turborepo's
   posture.

2. **D2-04 / VER-01 are better-supported than the requirement text claims.** REQUIREMENTS.md
   justifies the relative path via `@actions/cache` docs and gitignore mechanics. It is also the
   textbook relocatability fix (Gradle `ABSOLUTE` vs `RELATIVE`, ccache `base_dir`, sccache
   `basedirs`). Cheap credibility for DOCS-08.

3. **Gap, not contradiction: `## Out of Scope` "Executor portability classification -- Not knowable
   a priori and project-dependent."** True, and every comparator agrees -- but all of them still
   ship a *default posture* for it. Gradle: not cacheable unless annotated. Bazel: hermeticity
   required. Nx: "start safe [...] play it safe and include more than strictly necessary." **v0.0.2
   has the right posture (DOCS-07's declare-first ordering) but it currently lives only in a docs
   requirement.** That is a defensible call for a repo with zero adopters and a mechanically-enforced
   discriminator (CORR-04 + CORR-03 + LINT-02). Flagging it so the roadmapper records it as a
   deliberate choice rather than an oversight: **the default posture is documentation-only, and it
   is load-bearing.** If an adopter ever appears, that is the first thing to harden.

---

## Findings that should shape DOCS-07 (for the recipe author)

Ranked by usefulness.

1. **Quote Nx's own words for the primary instruction.** "Start safe and fine-tune your inputs when
   there are clear opportunities to improve the cache hit rate" (`configure-inputs.mdoc`). This is
   the recipe's ordering, stated by the framework. Lead with it.
2. **Present the discriminator as the documented `sharedGlobals` runtime-input pattern**, using Nx's
   own `{ "runtime": "node --version" }` example as the shape. Nothing new to teach.
3. **State the Nx-specific asymmetry explicitly, and do not let readers import ccache intuitions.**
   Nx's hash covers the workspace plus what you declare -- not the Node binary, not the OS, not
   libc, not the arch. Under ccache an undeclared platform dependency is a missed hit; under Nx it
   is a wrong artifact. This single paragraph is the strongest possible motivation for
   declare-first.
4. **Derive the portability checklist axes from the Reproducible Builds catalogue, filtered to what
   Nx tasks can actually hit.** The published 16 environment variations are: Archive Metadata,
   Architecture Information, Build ID, Build Path, Build Timestamp, File Encoding, Filesystem
   Ordering, File Permission, Locale, Package Dependency, Randomness, Reference to Memory Address,
   Snippet Encoding, System DNS Name, Uninitialized Memory, User Information. The ones that plausibly
   bite a JS/TS Nx task: **Architecture Information, Build Path, File Encoding (our CRLF history),
   Filesystem Ordering, File Permission, Locale, Package Dependency, Build Timestamp.**
   DOCS-07 mandates the checklist be derived from PARITY-01's root-cause record rather than
   prejudged -- so use this as a **cross-check for omissions after** PARITY-01 lands, not as the
   starting list. Note that `process.platform` covers none of Architecture, Locale, File Permission
   or Filesystem Ordering, which supports DOCS-07's requirement to name arch and libc as uncovered
   axes.
5. **Name `CACHE_KEY_PREFIX` as the epoch / poison-disowning knob** (one sentence). Cite the REAPI
   salt rationale if a rationale is wanted.
6. **Frame VER-01 as the standard relocatability fix**, with the Gradle/ccache/sccache parallel.
   Turns a repo-specific quirk into a recognisable pattern.
7. **Set expectations honestly on proof, using Develocity as cover.** Gradle's answer to "does my
   cache work across CI and local" is a manual scripted experiment (`05-validate-remote-build-
   caching-ci-local.sh`). Our recorded live proofs are the same class of evidence. Adopters should
   expect to run a proof, not to trust a guarantee.

---

## Sources

All fetched or read 2026-07-26.

| Source | Used for | Confidence |
|---|---|---|
| `bazelbuild/remote-apis` `remote_execution.proto` @ `main` (gh api, read verbatim) | Platform-in-action-digest; `Action.salt` | HIGH (source) |
| https://bazel.build/remote/caching | Unsound cross-machine sharing; `$PATH`; `/usr/bin` compiler hole | HIGH |
| https://bazel.build/reference/glossary | Action key, hermeticity definitions | HIGH |
| https://docs.gradle.org/current/userguide/build_cache_concepts.html | Cache key components; relocatability; path sensitivity | HIGH |
| https://docs.gradle.org/current/javadoc/org/gradle/api/tasks/CacheableTask.html | "reproducible and relocatable" declaration | HIGH |
| `gradle/develocity-build-validation-scripts` `Gradle.md` (gh api) | The five experiments; 04/05 cross-environment | HIGH (source) |
| `vercel/turborepo` `crates/turborepo-hash/src/lib.rs`, `crates/turborepo-task-hash/src/global_hash.rs` (gh api) | `GlobalHashable`/`TaskHashable` fields; `GLOBAL_CACHE_KEY` | HIGH (source) |
| https://turborepo.dev/docs/crafting-your-repository/caching | Documented hash inputs; absence of OS statement | HIGH |
| `mozilla/sccache` `src/compiler/c.rs` (gh api) | `compute()` hash inputs; `CACHE_VERSION`; `basedirs` | HIGH (source) |
| https://ccache.dev/manual/latest.html | Common hashed information; same-OS recommendation; `base_dir` | HIGH |
| `NiklasPor/nx-remotecache-custom` `lib/*` (gh api) | `hash + ".tar.gz"`; `HASH_SUFFIX` epoch comment | HIGH (source) |
| `NiklasPor/nx-remotecache-azure` `lib/index.ts` (gh api) | Adapter passes `filename` through untouched | HIGH (source) |
| `wvanderdeijl/nx-remotecache-gcs` `adapter.ts` (gh api) | Current-contract impl keys on bare `hash` + operator prefix | HIGH (source) |
| GitHub repo search (`nx-remotecache-*`) | Implementation survey, archived/live status | HIGH |
| Local Nx clone, tag `23.1.0`: `http_remote_cache.rs`, `how-caching-works.mdoc`, `configure-inputs.mdoc`, `shared-options.ts`; negative grep over the caching docs tree | Wire protocol has no OS field; documented hash inputs; "start safe" guidance; `sharedGlobals` runtime pattern; `skipNxCache`; zero cross-OS mentions | HIGH (source) |
| https://nix.dev/manual/nix/2.24/command-ref/nix-store/realise.html | `--check` semantics; exit code 104 | HIGH |
| https://manpages.debian.org/unstable/reprotest/reprotest.1.en.html | Two-build comparison; diffoscope; default variation list | HIGH |
| https://reproducible-builds.org/docs/env-variations/ | The 16 environment variation axes | HIGH |

**Note on the local Nx clone:** the working tree is checked out at tag **`23.0.2`**, not `23.1.0` as
the research brief stated. All Nx claims above were read via `git show 23.1.0:<path>` against the
`23.1.0` tag object, which is present in the clone -- so they are 23.1.0 facts. Flagging because
anything read from the working tree by another agent would be 23.0.2, and PARITY-04 records that the
23.0.2 -> 23.1.0 hash-planner rewrite makes cross-version measurements non-comparable.

**Not obtained:** `@nx/azure-cache` / `@nx/s3-cache` / `@nx/gcs-cache` key derivation (closed
source, deprecated May 2026) and Nx Cloud internals (closed SaaS). Their rows in the Section 2 table
are marked "Not documented" / "Unknown" rather than "No" for that reason. Neither gap is
load-bearing: the seven inspectable implementations plus the wire protocol settle the norm.

---
*Feature research for: v0.0.2 OS-invariant cross-OS cache sharing*
*Researched 2026-07-26. Carries forward `.planning/research/FEATURES.md` (v0.0.1) without repeating it.*
