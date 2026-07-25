# Quick 260725-rk4: Dogfood the Nx github-cache server in CI - Research

**Researched:** 2026-07-25
**Domain:** GitHub Actions CI wiring + Nx self-hosted remote cache client
**Confidence:** HIGH (in-repo proven pattern + verified Nx contract)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Sidecar launch:** use the shipped `./start-cache-server` JS action as a `background:` step (DOCS-06 pattern, proven live by `consumer-smoke`). Committed drift-guarded bundle => no prior build step. Pre-set `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` + `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` in a regular step, then the action adopts them; `cancel:` teardown at job end.
- **RW/RO:** let `selectBackend` decide per runtime context. No caller mode flag (TRUST-05).
- **Which tasks:** the cacheable Nx targets the repo runs in CI (resolve exact list via `nx show project` - do not hardcode). Non-Nx shell jobs are OUT.
- **Per-job background sidecar** (isolated runners; no shared process).
- **Cross-OS:** safe as-is (OS-namespaced store, JS action runs cross-OS).
- **Key-collision:** keep the repo's real Nx-task keys disjoint from the `nx-cache-<run_id>` dogfood/consumer/publish keys. Verify, not a blocker.

### Claude's Discretion
- Exact per-job YAML shape; whether to keep the dedicated proof jobs (recommended: keep); port selection.

### Deferred / Non-blocking
- Value vs latency on a small workspace: accepted; measure, don't narrow scope.
- PR reads useful only once push runs populate the cache: expected and correct.
</user_constraints>

## Summary

The mechanism is already proven in this repo: `consumer-smoke` (ci.yml:248-324) is a
working end-to-end template of the exact pattern needed. To dogfood the repo's own tasks,
replicate that wiring (pre-set env -> background `./start-cache-server` -> readiness poll ->
`nx run` -> `cancel:`) into the jobs that run cacheable `nx run-many` targets, pass
`GITHUB_TOKEN` to the sidecar step, and let `selectBackend` + GitHub's platform enforcement
handle RW-vs-RO. No new packages, no build-before-sidecar (committed bundle), no code changes.

**Cacheable targets (authoritative, via `nx show project github-cache`):** `build`,
`typecheck`, `test`, `integration` are all `cache: true`. **`format:check` and `fallow` are
NOT cacheable Nx project targets** (`nx format:check` is a workspace-level formatter command,
`fallow` is a shell tool) and there is **no `lint` target** in this workspace - so the
CONTEXT's "lint/format:check" guess drops out. The jobs to wire: **`build`, `typecheck`,
`test`, `integration`** (4 jobs; `integration` is a 2-leg ubuntu+windows matrix).

**Primary recommendation:** Add the consumer-smoke sidecar block to `build`/`typecheck`/`test`/
`integration`, pass `GITHUB_TOKEN`, use `shell: bash` on the shell steps (required for the
Windows `integration` leg), and generate the loopback token with `node` (portable) not
`openssl`. Do NOT gate these jobs to push-only - they should read on PRs and read+write on push.

## Finding 1: Nx client mechanics (the two NX_* vars)

[VERIFIED: nx.dev self-hosted-caching docs, v23] Setting `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`
makes the Nx task runner issue `GET /v1/cache/{hash}` before running a task (HIT => restore
outputs, skip execution; 404 => MISS => run the task) and `PUT /v1/cache/{hash}` after a
cache-miss task completes. `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` is the bearer token the
client presents; the server checks it. (`NODE_TLS_REJECT_UNAUTHORIZED=0` also exists but is
irrelevant on loopback HTTP.) The hash is Nx's own task hash - a long lowercase-hex string
matching the server's `^[a-f0-9]{1,512}$` validator (cache-key.ts:21).

Handshake requirement (why a regular step first): a `background:` step's `$GITHUB_ENV` writes
are only processed after the step *completes* (i.e. at `cancel:`), so the two NX_* vars MUST be
exported in a **prior regular step**; `serve()` then adopts the pre-set token + matching port
(start-cache-server/action.yml:5-24). The token is loopback-only auth between Nx and the
sidecar - mechanically required (blank/unset => server mints its own random token the client
does not have => 401 on every request => all-MISS + write failures) but not security-critical
on an isolated single-tenant runner.

## Finding 2: Exact per-job wiring (reusable block)

Order inside each target job: `checkout -> setup-node -> npm ci -> pre-set NX_* ->
start-cache-server (background) -> readiness poll -> npm run <target> -> cancel`. The sidecar
does not depend on `npm ci` (self-contained esbuild bundle), but the pre-set step must precede
it and both must precede the `nx run` step.

```yaml
      # after `- run: npm ci`
      - name: Pre-set the Nx cache client vars for the sidecar
        shell: bash
        run: |
          set -euo pipefail
          echo "NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:3000" >> "$GITHUB_ENV"
          # node is portable across ubuntu + windows-arm; openssl may be absent on
          # the Windows runner's Git Bash. Mask BEFORE writing $GITHUB_ENV.
          token="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
          echo "::add-mask::${token}"
          echo "NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=${token}" >> "$GITHUB_ENV"
      - uses: ./start-cache-server
        id: cache-server
        background: true
        with:
          port: '3000'                 # must match the pre-set SERVER url port
        env:
          # selectBackend needs a token (GH_TOKEN||GITHUB_TOKEN) to construct the
          # Actions-cache backend; by process inheritance, never via $GITHUB_ENV (D-06).
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Wait for the loopback sidecar
        shell: bash
        run: |
          set -euo pipefail
          auth="Authorization: Bearer ${NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN}"
          code=000
          for _ in $(seq 1 30); do
            # `|| true` NOT `|| echo 000` (the latter yields "000000" != "000" and
            # breaks the poll on iteration 1 - the consumer-smoke bug, ci.yml:298-302).
            code=$(curl -s -o /dev/null -w '%{http_code}' -H "${auth}" "${NX_SELF_HOSTED_REMOTE_CACHE_SERVER}/v1/cache/deadbeef" || true)
            [ "${code}" != "000" ] && break
            sleep 1
          done
          [ "${code}" != "000" ] || { echo "sidecar never bound after 30s" >&2; exit 1; }
      - run: npm run build          # or typecheck / test / integration
      - cancel: cache-server        # MANDATORY: else post-job wait hangs on serve() (Pitfall 3)
```

- **JS-action requirement (load-bearing):** the Actions-cache backend's `@actions/cache`
  save/restore needs `ACTIONS_RUNTIME_TOKEN`/`ACTIONS_RESULTS_URL`, which are injected **only
  into JS actions**. A plain `node serve.js &` / `run:` background step silently MISSes every
  read and no-ops every write (verified Phase 2; see ci.yml:335-337 publish comment). So the
  `./start-cache-server` JS action is required, not a convenience.
- **Port:** 3000 is fine reused across all four jobs - each runs on its own isolated runner
  (one sidecar per job), so there is no clash.
- **Readiness poll:** keep it. The runner launches the background action and proceeds to the
  next step immediately, so a bare `nx run` races the socket bind. Nx remote caching is
  best-effort ([ASSUMED] - not explicitly documented, but consistent with Nx's remote-cache
  design: a remote fault degrades to local execution, it does not fail the build), so the poll
  is belt-and-suspenders against a first-task MISS rather than strictly mandatory - but it is
  cheap (~1-2s), proven in-repo, and removes the flake entirely.

## Finding 3: RW-on-push vs RO-on-PR - the actual mechanism (correctness nuance)

The CONTEXT framing "on pull_request it is read-only" is correct in **effect** but the
**mechanism is not selectBackend**. Traced through the code:

`isWriteTrusted` (trust.ts:79-100): on `github.com`, `pull_request` is a HOST_GATED event and
`hostSupportsWidenedTrust` returns true, so **`isWriteTrusted` returns `{trusted:true}` for a
github.com PR**. Therefore `selectBackend` (select-backend.ts:29-60) returns the **writable
Actions-cache backend** on both push AND pull_request (given a resolvable token) - the four
outcomes are: untrusted-context => Releases read backend; trusted + malformed
`GITHUB_REPOSITORY` => throw; trusted + no token => empty read-only memory backend (all-MISS);
**trusted + token => writable Actions-cache backend**.

What actually enforces read-only on PRs is GitHub's platform, not this code:
1. **GitHub Actions cache scoping:** a PR run reads the base/default-branch cache but its
   *writes* land in the PR-ref scope, invisible to the default branch - so a PR write can never
   overwrite a default-branch entry (CREEP-safe by construction).
2. **The 2026-06-26 read-only-actions-cache-for-untrusted-triggers token:** for untrusted
   (fork) PRs, `saveCache` hits a read-only scope, returns `-1`, the backend's `lookupOnly`
   probe finds nothing, and it reports a benign `409` no-op with a `core.warning`
   (actions-cache-backend.ts:101-124). No build failure.

[VERIFIED: trust.ts + select-backend.ts + actions-cache-backend.ts, this session] The
in-code host gate is documented (CONCERNS.md, threat T-05-01-01, "accept residual") as
**fork-spoofable defense-in-depth ONLY**; GitHub's server-side enforcement is the load-bearing
control.

**Practical consequences for the wiring:**
- **Pass `GITHUB_TOKEN` to the sidecar step on PR jobs too** (not push-only). Without a token,
  selectBackend => empty memory backend (outcome 3) => the PR reads NOTHING from the
  default-branch cache. To get PR reads you need outcome 4 (the Actions-cache backend, which
  can restore base-branch entries). The Releases read backend (outcome 1) is only reached in
  *untrusted* context, which a github.com PR is not.
- **Do NOT add `if: github.event_name == 'push'`** to these four jobs (unlike dogfood/consumer/
  publish). They already run on both push and PR and should continue to - push writes, PR reads.
- `secrets.GITHUB_TOKEN` on a fork PR `pull_request` event is present but read-only; passing it
  is safe (writes no-op via the 409 path).

## Finding 4: Pitfalls to avoid

1. **Readiness-poll "000000" bug** (fixed once in consumer-smoke, ci.yml:298-302): use
   `|| true`, never `|| echo 000`. Replicated correctly in the Finding-2 block.
2. **Windows `integration` leg needs `shell: bash`.** GitHub's default shell on Windows runners
   is `pwsh`, not bash. The pre-set + poll steps use bash syntax (`$GITHUB_ENV`, `$(...)`,
   `seq`, `[ ... ]`) - without `shell: bash` they run under pwsh and fail on the
   `windows-11-arm` leg. `curl` and Git Bash are present on Windows runners; `node` for the
   token is more portable than `openssl` (which may be absent in the Windows Git Bash).
3. **`cancel:` is mandatory** (ci.yml:233-236, Pitfall 3): the implicit wait-all before post-job
   cleanup hangs forever on the never-exiting `serve()` without it. `cancel` sends SIGTERM ->
   serve() drains in-flight puts (ROBUST-04) -> clean exit.
4. **Key namespace stays disjoint (verify, not blocker).** Real Nx-task keys are
   `nx-cache-<nx-task-hash>` (long mixed-hex). The proof jobs use `nx-cache-<run_id>` and
   `nx-cache-cafe<run_id>` (short/decimal). Collision is not possible in practice (an Nx task
   hash equalling a bare decimal run_id) - confirm once, do not block.
5. **NEW interaction the plan MUST call out - the `publish` job now mirrors real task
   artifacts.** Today CI runs Nx on the LOCAL cache, so the only `nx-cache-*` Actions-cache
   entries that exist on a push are the run_id seeds (ci.yml:374-375 comment). Once real tasks
   write `nx-cache-<taskhash>` on push, the `publish` job's `getActionsCacheList` enumerates
   them and - because they pass `isServerProducedKey` (cache-key.ts:52-57) - **mirrors them to
   the GitHub Releases month-shard**. This is arguably the intended dogfooding outcome (the
   mirror now holds real task outputs), but it (a) makes the ci.yml:374 "only ones we seed"
   comment stale/misleading and (b) grows the Releases shard toward the 1000-asset/shard cap
   and adds publish wall-clock (~1 upload/sec throttle). Decide + document: acceptable, or scope
   `publish` to only the run_id seed. Not a blocker; it is a behavior change to acknowledge.
6. **Chicken-and-egg: confirmed absent.** `./start-cache-server` main is the committed,
   drift-guarded `index.js` esbuild bundle, resolved from the git ref (never npm, never after a
   build). The sidecar can start in the `build` job before `npm run build` runs. The
   `action-bundle-drift` job (check:action) guards the bundle's freshness.
7. **Never set the NX_* vars at workflow `env:` level.** That would leak the sidecar URL into
   the dogfood/consumer/publish proof jobs (which have no sidecar) and every one of their Nx
   invocations would try (and fail) to reach a non-existent server. Keep the vars strictly
   per-job in the regular pre-set step.

## Finding 5: Value/latency + how to observe a real cross-run HIT

**Value on this 1-project workspace is dogfooding proof, not speed.** Each target produces one
Nx task. Expect net-neutral-to-slightly-slower wall clock: every job now pays sidecar
startup (~0.5-1s) + poll (~1-2s) + per-task GET/PUT over loopback + `@actions/cache`
save/restore round-trips to GitHub's cache service. On the common MISS (source changed) you
pay a restore-attempt + a save on top of running the task. Two places real hits appear:
- **Cross-job within a push run (RW):** `typecheck` `dependsOn: [build]`, so `nx run-many -t
  typecheck` also runs `build`; if the `build` job saved `nx-cache-<buildhash>` first, the
  `typecheck` job gets a remote HIT for build instead of rebuilding. (Only on push - PR jobs
  do not write to shared scope.)
- **Cross-run (RO or RW):** run N+1 with unchanged build/test inputs HITs run N's entries.

**Observing a HIT (airtight signal):** a fresh CI runner has **no `.nx/cache`** -
`actions/setup-node` with `cache: 'npm'` restores only `~/.npm`, never the Nx local cache. So
on run N+1, **any task Nx reports as read-from-cache is necessarily a REMOTE hit** (there is no
local cache to hit on a fresh runner). Watch for the Nx end-of-run summary line:
`Nx read the output from the cache instead of running the command for X out of Y tasks` and/or
a per-task `[remote cache]` annotation ([ASSUMED] exact wording - confirm on the run; add
`--verbose` to the `nx run-many` for explicit remote-retrieval logging if the summary is
ambiguous). The fresh-runner reasoning is HIGH confidence; the exact log string is the only
ASSUMED part.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Nx remote caching is best-effort (a remote fault degrades to local run, does not fail the build) | Finding 1/2 | If it hard-fails, the readiness poll becomes mandatory (already included) - so no practical risk |
| A2 | Exact remote-hit log wording (`Nx read the output from the cache...` / `[remote cache]`) | Finding 5 | Only affects how you eyeball the proof; the fresh-runner=remote logic holds regardless. Add `--verbose` to confirm |
| A3 | `openssl` may be absent on windows-11-arm Git Bash | Finding 2/4 | Mitigated by using `node` for the token (guaranteed present after setup-node) |

## Sources

- [VERIFIED] `nx.dev/docs/guides/tasks--caching/self-hosted-caching` (v23) - NX_* env vars + OpenAPI contract (GET/PUT /v1/cache/{hash}, 200/401/403/404/409).
- [VERIFIED, this session] In-repo: ci.yml:248-324 (consumer-smoke template), ci.yml:326-393 (publish mirror + JS-action requirement), start-cache-server/action.yml (handshake + JS-action rationale), select-backend.ts / trust.ts / actions-cache-backend.ts (RW/RO mechanism), cache-key.ts (key namespace + isServerProducedKey), nx.json + `nx show project github-cache` (cacheable target enumeration), docs/configuration.md (env-knob contract), CONCERNS.md (fork-spoofable-gate acceptance, fragile cross-OS invariants).

## Metadata

- **Confidence:** Wiring HIGH (proven in-repo). RW/RO mechanism HIGH (code-traced). Target
  enumeration HIGH (`nx show project`). Nx best-effort + hit-log wording MEDIUM ([ASSUMED]).
- **No new packages** - Package Legitimacy Audit N/A. No external tool installs - Environment
  Availability N/A (node/curl/bash already present on runners).
- **Valid until:** ~30 days (stable; watch for Nx client behavior changes and GitHub cache
  token-scope policy changes).
