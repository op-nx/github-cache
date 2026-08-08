import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CACHE_ARCHIVE_DIR } from '../lib/cache-archive-path.js';

/**
 * VER-04's spec accommodation: enter the Nx workspace root as the process cwd and
 * ensure the archive directory exists, returning the symmetrical restore closure.
 *
 * A test fixture (kept alongside test/consumer-contract.ts and test/octokit-fault.ts),
 * NOT runtime surface -- imported only by the *.spec.ts files that construct the real
 * Actions-cache backend, never by the package barrel. It deliberately imports nothing
 * from vitest: each spec wires its own beforeAll/afterAll in two lines, so this stays a
 * plain module. `src/test/` is inside tsconfig.lib.json's `src/**\/*.ts` include, so a
 * vitest import here would start emitting a vitest require into `dist` -- and no
 * non-spec file in this package imports vitest today.
 *
 * WHY IT EXISTS. Under `nx test` the merged `test` target configuration carries
 * `options.cwd: "packages/github-cache"` (read via `nx show project`, i.e. the MERGED
 * config, not nx.json) and vitest.config.mts sets `root: __dirname`, so the cwd in every
 * unit spec is the PROJECT root. VER-04's guard probes `nx.json` at the cwd, which is
 * FALSE there, so all 21 real-backend construction sites throw without this hook.
 *
 * LOCK 1 -- THE LEAK HAZARD, and it is the reason the restore closure is not optional.
 * `process.chdir()` is process-GLOBAL and the vitest pool runs multiple spec FILES per
 * worker (MEASURED via a temporary probe spec: `pool=5 isWorkerThread=true`). A leaked
 * chdir silently changes what a LATER spec's relative reads resolve against, and the
 * failure would surface in a file that never opted into this hook. The eight-or-so specs
 * in this package whose subject is a file read (nx-target-inputs.spec.ts,
 * cleanup-workflow.spec.ts, ppe-action.spec.ts, pinned-deps.spec.ts,
 * lint-scope-drift.spec.ts, lint-rules.spec.ts) all resolve through
 * `new URL(..., import.meta.url)` and are therefore chdir-IMMUNE -- which is LUCK, not
 * design. Do not rely on it: capture the cwd first, restore it unconditionally.
 *
 * LOCK 2 -- WHY THIS REPO HAS NO ANALOG, and why the exception is FORCED rather than
 * preferred. Measured across `packages/github-cache`: zero `afterAll`, zero
 * `process.chdir`, zero `vi.stubEnv`/`vi.unstubAllEnvs`, zero save-and-restore of any
 * process global. That absence is itself a pattern -- the convention here is INJECTION,
 * not mutation: `selectBackend(env)` takes an env bag, `createReleasesReadBackend(client)`
 * takes its whole read seam as a parameter, `cleanupMirror(client, options)` takes the
 * client whose delete calls it would otherwise make for real, and vitest.config.mts
 * neutralises the consumer env vars in CONFIG rather than in a hook. (The example that
 * used to head that list was the sibling asset-name helper's platform parameter; CORR-02
 * DELETED it, so the example is replaced with live ones rather than left citing a
 * signature that no longer exists -- stale prose about a deleted signature is exactly the
 * class the Phase 9 regression came from.) VER-04's subject IS `process.cwd()`, which no injection seam can
 * reach without parameterising `createActionsCacheBackend()` -- and TRUST-05 forbids that
 * (select-backend.ts:36-37 comment-locks the factory staying zero-parameter and
 * synchronous). So the process-global mutation is the only remaining shape, not the
 * convenient one.
 *
 * LOCK 3 -- WHY `import.meta.url` IS LEGITIMATE HERE AND BANNED IN THE TWO PRODUCTION
 * FILES. esbuild.action.mjs:38 sets `define: { 'import.meta.url': '__actionImportMetaUrl' }`
 * and the emitted banner defines that shim as a file URL for a NEVER-EMITTED sibling
 * `start-cache-server/index.mjs`. The shim is deliberately WRONG: serve.ts:197's
 * `isEntrypoint(import.meta.url)` guard depends on the wrongness (a shim resolving to the
 * bundle's own path would run serve.ts's main() inside the action and print the bearer
 * token unmasked). The `define` applies ONLY to the bundle, so a spec-side use is sound,
 * while the same idiom inside cache-archive-path.ts or actions-cache-backend.ts would
 * resolve to the bundle directory inside the bundle and the source directory outside it --
 * two different wrong answers, neither the workspace root. `process.cwd()` is the only
 * sound anchor in production code.
 *
 * LOCK 4 -- WHY THE MKDIR IS HERE AND NOT LEFT TO THE CODE UNDER TEST.
 * actions-cache-backend.spec.ts pre-writes the archive at `cacheArchivePath(HASH)` on the
 * line BEFORE the construction that would create the directory, so it would ENOENT on a
 * fresh tree even with VER-07's mkdir-at-construction in place. Reordering the spec to
 * construct first would make one test's setup depend on the SIDE EFFECT of the code under
 * test -- the failure to avoid. The mkdir lands in this hook instead, and it uses the
 * CACHE_ARCHIVE_DIR constant rather than a second authored copy of the directory literal.
 *
 * LOCK 5 -- GITHUB_WORKSPACE IS PINNED HERE FOR THE SAME REASON THE CWD IS, and leaving it
 * ambient was a HOLE rather than a simplification. VER-04's guard is a CONJUNCTION: it probes
 * `nx.json` at the cwd AND compares `resolve(GITHUB_WORKSPACE)` against `resolve(cwd)`
 * (actions-cache-backend.ts). Entering the workspace root satisfies only the first conjunct, so
 * before this hook pinned the variable the three consuming specs read it straight out of the
 * ambient environment. MEASURED on this checkout: `nx test` passes 920/920 with the variable
 * unset (`resolve('')` is the cwd, so the comparison passes by accident) and fails 23 tests
 * across three files with `GITHUB_WORKSPACE` pointing anywhere else -- while
 * `capture-hashes.mjs` reports the `test` task hash BYTE-IDENTICAL in both environments
 * (12649867231869123682), because nx.json declares no `env` input for it.
 *
 * That is a task whose result is not a function of its declared inputs -- the exact defect
 * class this milestone exists to remove -- and XOS-04 makes it worse rather than academic: the
 * `test` entry is now cross-OS shareable, so a PASS computed under one GITHUB_WORKSPACE is
 * served verbatim to a run under another.
 *
 * THE FIX IS TO REMOVE THE DEPENDENCE, NOT TO DECLARE IT. Adding `{ "env":
 * "GITHUB_WORKSPACE" }` to `targetDefaults.test.inputs` would make the hash honest and the
 * cache useless: the variable is set on every runner and unset on every developer machine, so
 * local and CI could never share a `test` entry again -- surrendering the milestone's own
 * headline outcome to fix a spec-fixture gap. Pinning it here makes the specs hermetic
 * instead, which is what keeps the hash's OS- and host-invariance TRUE rather than merely
 * declared.
 *
 * The restore is exact rather than convenient: an originally-UNSET variable is `delete`d back
 * to unset, never written as `''`. The two are interchangeable to VER-04 (both `resolve` to
 * the cwd) and NOT interchangeable to anything else that reads the environment, and a fixture
 * that leaves a new key behind is the LOCK 1 leak in a different costume.
 *
 * REJECTED ALTERNATIVE, recorded so it is not silently re-litigated: a global `setupFiles`
 * entry in vitest.config.mts would fix all 35 spec files at once. NOT taken -- the measured
 * recommendation covers the three files that actually need it, while a global chdir changes
 * the effective cwd of the other 32 specs, whose behaviour under it has not been measured.
 */
export function enterWorkspaceRootCwd(): () => void {
  // Captured FIRST, before anything can throw -- see LOCK 1.
  const originalCwd = process.cwd();
  const originalGithubWorkspace = process.env.GITHUB_WORKSPACE;
  // Four levels up from src/test/: src/ -> github-cache/ -> packages/ -> workspace root.
  // The same idiom cleanup-workflow.spec.ts uses from src/cleanup/.
  const workspaceRoot = fileURLToPath(new URL('../../../../', import.meta.url));

  process.chdir(workspaceRoot);
  // LOCK 5. Pinned to the SAME resolved directory the chdir just entered, so VER-04's
  // second conjunct holds for a reason the spec controls rather than by accident.
  process.env.GITHUB_WORKSPACE = workspaceRoot;
  mkdirSync(CACHE_ARCHIVE_DIR, { recursive: true });

  return () => {
    process.chdir(originalCwd);

    if (originalGithubWorkspace === undefined) {
      delete process.env.GITHUB_WORKSPACE;

      return;
    }

    process.env.GITHUB_WORKSPACE = originalGithubWorkspace;
  };
}
