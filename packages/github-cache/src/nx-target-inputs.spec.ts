import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { NxJsonConfiguration } from 'nx/src/config/nx-json.js';
import type { TargetConfiguration } from 'nx/src/config/workspace-json-project-json.js';
import {
  extractPatternsFromFileSets,
  filterUsingGlobPatterns,
  splitInputsIntoSelfAndDependencies,
} from 'nx/src/hasher/task-hasher.js';
import { readTargetDefaultsForTarget } from 'nx/src/project-graph/utils/project-configuration/target-defaults.js';
import { mergeTargetConfigurations } from 'nx/src/project-graph/utils/project-configuration/target-merging.js';
import { describe, expect, it } from 'vitest';

/**
 * The `typecheck` target's command is `tsc --build tsconfig.json
 * --emitDeclarationOnly`, and `packages/github-cache/tsconfig.json` references
 * `./tsconfig.spec.json`, so the command DOES compile the spec files. Its inputs
 * used to start from the `production` named input, which excludes both
 * `*.spec.ts` and `tsconfig.spec.json` -- so a spec-only edit left the task hash
 * unchanged and Nx replayed a cached success. `npm run typecheck` exited 0 while
 * the REPLAYED output itself contained "Found 1 error.", and exit 0 is what any
 * `&&` chain or CI gate reads. Same false-pass class as T-06-03-02.
 *
 * This guard pins the INVARIANT (the spec sources are in the hashed fileset),
 * not the spelling. It delegates every glob decision to Nx's own resolver -- the
 * same three functions Nx's hasher uses (`getTargetInputs` composes
 * `splitInputsIntoSelfAndDependencies` + `extractPatternsFromFileSets`
 * identically) -- so it cannot drift from Nx's behaviour and it does not care
 * whether the fix is spelled `default`, a new named input, or an explicit
 * pattern list.
 *
 * Two limits of that delegation, both deliberate. `filterUsingGlobPatterns`
 * substitutes `{projectRoot}` ONLY, so probe paths must be project-relative -- a
 * `{workspaceRoot}` pattern survives literally and matches nothing here. And an
 * EMPTY pattern list makes it return every file it was handed, which is why the
 * non-vacuity control below is a negative assertion rather than another
 * toContain().
 *
 * `nx/src/*` is an internal subpath with no semver guarantee. An Nx major could
 * move it and break this file at IMPORT time. That is the desired failure mode:
 * loud and immediate, never a silent pass.
 *
 * Reading nx.json from a spec is only safe because `{workspaceRoot}/nx.json` is
 * a `test` input (asserted below). A target's `inputs` array and nx.json's root
 * `namedInputs` are NOT part of the ProjectConfiguration hash, so without that
 * wiring Nx would replay this guard's cached PASS after someone reopened the
 * hole -- the same bug, one level up.
 */
type TargetInputs = NonNullable<NxJsonConfiguration['namedInputs']>[string];

/** An object-form entry of nx.json's `plugins` array. The array also admits a
 * bare string (a plugin with no options), which is why the lookup below has to
 * narrow before reading `.plugin`. */
interface NxPluginRegistration {
  readonly plugin: string;
  readonly options?: { readonly targetName?: string };
}

const nxJson = JSON.parse(
  readFileSync(new URL('../../../nx.json', import.meta.url), 'utf8'),
) as {
  namedInputs: Record<string, TargetInputs>;
  plugins: readonly (string | NxPluginRegistration)[];
  targetDefaults: Record<string, { inputs: TargetInputs; outputs?: string[] }>;
};

/**
 * The project's OWN configuration file, read as its own layer. `nx.json`'s
 * `targetDefaults` is only the BASE of the merge -- `project.json` sits above it
 * and a key declared there REPLACES the default's key wholesale. The two CORR-04
 * guards below read `nx.json` alone, so the merged-configuration guard is the one
 * that needs this.
 *
 * Reading it from a spec is safe for the same reason reading `nx.json` is: it is
 * a `test` input. Not by a `{workspaceRoot}` entry this time but by `default` ->
 * `{projectRoot}/**\/*` (nx.json:4), which covers `packages/github-cache/project.json`
 * because the file sits at the project root. So editing it re-runs this file
 * instead of replaying a cached PASS.
 */
const projectJson = JSON.parse(
  readFileSync(new URL('../project.json', import.meta.url), 'utf8'),
) as { targets: Record<string, TargetConfiguration> };

/** Every `{ runtime: ... }` command in an inputs list, in declaration order. */
function runtimeInputsOf(inputs: TargetInputs | undefined): string[] {
  return (inputs ?? []).flatMap((input) =>
    typeof input === 'object' && 'runtime' in input ? [input.runtime] : [],
  );
}

function registrationFor(pluginName: string): NxPluginRegistration | undefined {
  return nxJson.plugins.find(
    (entry): entry is NxPluginRegistration =>
      typeof entry === 'object' && entry.plugin === pluginName,
  );
}

const PROJECT_ROOT = 'packages/github-cache';

// Probe paths, not file-existence assertions: `filterUsingGlobPatterns` is a
// pure glob filter over the list it is handed, so these represent the three
// classes of file the fix is about -- a lib source, a spec source, and the spec
// tsconfig. They deliberately do not name a real spec file, so renaming one
// cannot make this guard vacuous.
const PROBE_FILES = [
  `${PROJECT_ROOT}/src/index.ts`,
  `${PROJECT_ROOT}/src/index.spec.ts`,
  `${PROJECT_ROOT}/tsconfig.spec.json`,
  // Fourth class, added for `lint`'s negative control below: a real workspace-
  // root path OUTSIDE the project root. It is genuinely not linted (the phase-7
  // scope deviation) and it already appears in `test.inputs` as a
  // `{workspaceRoot}` string, so a reader can see the two frames side by side.
  // Safe for every assertion above: all of them are toContain / not.toContain
  // on a named path, none is a whole-array comparison.
  'start-cache-server/entry.ts',
];

function hashedFilesFor(target: string): string[] {
  const { selfInputs } = splitInputsIntoSelfAndDependencies(
    nxJson.targetDefaults[target].inputs,
    nxJson.namedInputs,
  );

  return filterUsingGlobPatterns(
    PROJECT_ROOT,
    PROBE_FILES.map((file) => ({ file, hash: 'probe' })),
    extractPatternsFromFileSets(selfInputs),
  ).map((entry) => entry.file);
}

describe('typecheck hashes everything its command compiles', () => {
  it('hashes the spec sources', () => {
    expect(hashedFilesFor('typecheck')).toContain(
      `${PROJECT_ROOT}/src/index.spec.ts`,
    );
  });

  it('hashes tsconfig.spec.json', () => {
    expect(hashedFilesFor('typecheck')).toContain(
      `${PROJECT_ROOT}/tsconfig.spec.json`,
    );
  });

  // Presence control: the lib sources must survive the fix, not just the specs.
  it('still hashes the lib sources', () => {
    expect(hashedFilesFor('typecheck')).toContain(
      `${PROJECT_ROOT}/src/index.ts`,
    );
  });

  // NON-VACUITY control, and it must be a NEGATIVE one. filterUsingGlobPatterns
  // starts with `if (positive.length === 0 && negative.length === 0) return files`
  // -- an empty pattern list returns the WHOLE probe list untouched. So every
  // toContain() above would pass together on a resolver that resolved nothing,
  // which is the same class of silent false pass this guard exists to prevent.
  // `build` is the discriminator: its inputs genuinely exclude specs, so this
  // assertion is true today and false the instant the filter stops filtering.
  it('does NOT hash the spec sources for build, proving the filter filters', () => {
    expect(hashedFilesFor('build')).not.toContain(
      `${PROJECT_ROOT}/src/index.spec.ts`,
    );
  });
});

describe('typecheck declares the outputs its command actually writes (PARITY-01, PARITY-03)', () => {
  // The value is chosen by MEASUREMENT, not by picking between two candidates.
  // `08-ROOT-CAUSE.md` ran the target's real command -- `tsc --build
  // tsconfig.json --emitDeclarationOnly` at cwd `packages/github-cache` -- on a
  // cleaned tree and enumerated what it wrote: 136 files. This seven-entry list
  // covers 136 of 136. The one-entry list `['{projectRoot}/tsconfig.tsbuildinfo']`
  // -- the other form `@nx/js/typescript` infers -- covers 0 of 136.
  //
  // Choosing by measurement rather than by stability is the whole point.
  // `outputs` is what Nx CACHES and RESTORES, not merely a hash input, so
  // pinning the one-entry list would be perfectly STABLE and would make
  // `typecheck` cache none of its declaration output and restore nothing on a
  // hit, while still reporting a cache hit -- a silent correctness regression in
  // the very cache this project exists to make trustworthy.
  //
  // Entry 1, `{projectRoot}/tsconfig.tsbuildinfo`, matches NOTHING at this
  // configuration: `packages/github-cache/tsconfig.json` is a solution file with
  // `"files": []` and `"include": []`, so `tsc --build` compiles only its two
  // references and writes no buildinfo for the solution itself. It is kept
  // DELIBERATELY, not by oversight -- it is what the plugin itself emits when the
  // references classify as internal, so keeping it verbatim keeps this override
  // aligned with the plugin instead of quietly diverging from it, and an output
  // pattern matching nothing is inert while dropping an entry a future tsconfig
  // WOULD populate is not.
  //
  // THREE OF THESE SEVEN ENTRIES ARE ALSO `build`'s OUTPUTS, and that overlap is
  // ACCEPTED rather than unnoticed. Measured on this tree, not inferred: Nx
  // resolves `build.outputs` to
  // `["{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
  // "{projectRoot}/dist/tsconfig.lib.tsbuildinfo"]`, so entries 2, 3 and 4 above
  // are subsets of it -- 31 `.d.ts` + 31 `.d.ts.map` + 1 buildinfo = 63 of
  // `typecheck`'s 136 output files declared as outputs of TWO cached targets in
  // one project, on a `dependsOn` edge (`typecheck` dependsOn `build`).
  //
  // The sharp end is the shared `dist/tsconfig.lib.tsbuildinfo`. `build` runs
  // `tsc --build tsconfig.lib.json` and writes it with `emitDeclarationOnly:
  // false`; `typecheck` runs `tsc --build tsconfig.json --emitDeclarationOnly` and
  // writes the same path with `true`. Two cached targets own one incremental-state
  // file and write mutually inconsistent contents, and because `typecheck` depends
  // on `build` its restore is always LAST -- leaving a buildinfo asserting "no JS
  // emitted" beside the 31 `.js` files `build` emitted.
  //
  // WHY THAT IS NOT DATA LOSS: `tsc` fingerprints its options INTO the buildinfo,
  // so a later `build` cache MISS detects the mismatch and rebuilds, and a `build`
  // cache HIT restores build's own consistent copy. The residual cost is a
  // declaration re-emit plus 63 files duplicated across two cache entries.
  //
  // WHY THE ENTRY IS NOT DROPPED, which is the obvious fix and is worse:
  //   1. `build.outputs` is PLUGIN-INFERRED -- nx.json declares no
  //      `targetDefaults.build.outputs` -- so the overlap is `@nx/js/typescript`'s
  //      OWN inference on both targets, not something this override introduced.
  //      Keeping the seven verbatim REPRODUCES the plugin; dropping one makes this
  //      pin diverge from it, which is precisely what the paragraph above says the
  //      verbatim list exists to avoid.
  //   2. It would not fix the stated cost. Dropping only the buildinfo leaves 62 of
  //      the 63 files still shared, so the duplication is untouched.
  //   3. It would leave `typecheck` declaring 135 of the 136 files it writes -- an
  //      output the target produces and does not cache, the same incompleteness the
  //      enumeration above was run to avoid.
  // The real fix is upstream, in how the plugin infers these two targets' outputs;
  // it is recorded as an accepted residual here, alongside the OS-dependent
  // classification `08-ROOT-CAUSE.md` hands to the same possible upstream report.
  //
  // WHY THE ENTRY EXISTS AT ALL: this one field is the entire cross-OS
  // divergence. `@nx/js/typescript` infers the seven-entry list on Linux and the
  // one-entry list on Windows, so the merged
  // `@op-nx/github-cache:ProjectConfiguration` node -- which covers ALL FIVE
  // targets -- differs cross-OS, and that single node is what makes `build`,
  // `typecheck`, `test` and `lint` diverge. A `targetDefaults` entry normalises
  // ITS field of the merged node regardless of what inference produced, which is
  // what makes the field OS-invariant. `nx.json` is strict JSON and holds no
  // comments, so this is where that rationale lives (D-13), in the same shape as
  // the `lint.outputs` pin below.
  it('declares the seven-entry outputs list the enumeration confirmed', () => {
    expect(nxJson.targetDefaults.typecheck.outputs).toEqual([
      '{projectRoot}/tsconfig.tsbuildinfo',
      '{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}',
      '{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}.map',
      '{projectRoot}/dist/tsconfig.lib.tsbuildinfo',
      '{projectRoot}/out-tsc/vitest/**/*.{d.ts,d.cts,d.mts}',
      '{projectRoot}/out-tsc/vitest/**/*.{d.ts,d.cts,d.mts}.map',
      '{projectRoot}/out-tsc/vitest/tsconfig.spec.tsbuildinfo',
    ]);
  });

  // THE PREMISE THE PIN ABOVE RESTS ON, asserted rather than assumed.
  //
  // The seven entries were enumerated from ONE project's tsconfig layout --
  // `packages/github-cache`, where they cover 136 of 136 emitted files. But
  // `targetDefaults` applies to EVERY project in the workspace. A second project
  // with a different `outDir` or `tsBuildInfoFile` would inherit this exact list,
  // and its `typecheck` HIT would then restore a strictly SMALLER set than its
  // command emits -- a silent partial restore, which is the same failure class
  // PARITY-01 fixed, wearing a green build.
  //
  // The list is a superset for the one project that exists, so this is a
  // forward-looking guard, not a live break. It is cheap because the premise is
  // mechanically checkable: `package.json` declares `workspaces: ["packages/*"]`,
  // so counting the project directories under `packages/` counts the projects that
  // can inherit the pin.
  //
  // WHEN THIS GOES RED, the fix is NOT to widen the list -- a union of two layouts
  // over-declares for both. Move the block to `packages/github-cache/project.json`,
  // where it applies to the project it was measured against, and let the new
  // project declare its own.
  //
  // CEILING, recorded rather than left to be discovered: this reads the filesystem,
  // and a sibling `packages/<new>/package.json` is NOT in this target's declared
  // inputs -- no `test` input covers another project's root. So the commit that
  // ADDS a second project can serve a cached PASS here, and the guard first bites
  // on the next cold run. That is the PARITY-08 staleness shape, accepted knowingly
  // and only here: the fact this asserts lives in the directory tree and in no
  // hashed file, so there is nothing better to key on. It still converts a silent
  // partial restore into a named failure, which is the whole gain.
  it('has exactly one project that can inherit the workspace-wide pin', () => {
    const packagesDir = new URL('../../', import.meta.url);
    const projects = readdirSync(packagesDir, {
      withFileTypes: true,
    })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          existsSync(new URL(`${entry.name}/package.json`, packagesDir)),
      )
      .map((entry) => entry.name);

    expect(projects).toEqual(['github-cache']);
  });
});

describe('the lint target EXISTS, not merely has defaults (LINT-01)', () => {
  // Everything else in this file asserts what `lint` does ONCE THERE IS ONE.
  // `targetDefaults.lint` is a default APPLIED to a target if one exists; it is
  // not evidence that one does. Nothing else in the repo closes that gap
  // either: `lint-scope-drift.spec.ts` imports `eslint.config.mjs`, so deleting
  // the FILE is caught, but deleting the four-line `plugins[]` entry is not --
  // the config still imports and that spec stays green.
  //
  // And the gate cannot see it. `npm run lint` is `nx run-many -t lint`, which
  // with no matching target ANYWHERE prints "NX No tasks were run" and EXITS 0
  // (measured). So a one-line deletion silently converts the whole lint leg
  // into a no-op that reports success -- for a phase whose thesis is "convert a
  // convention into a build failure that cannot be silenced without writing
  // down why", the exact defect class it exists to close.
  //
  // The target is INFERRED (D-01), so this registration is the only thing in
  // the tree that creates it, and pinning it is what makes the deletion RED.
  // The complementary half -- the plugin is registered, the config is present,
  // and the plugin STILL infers nothing on this runner, which is D-35's
  // deliberately UNVERIFIED cross-OS risk -- cannot be settled by reading
  // nx.json. That half is closed in ci.yml, whose lint job requires the run to
  // PRINT "Successfully ran target lint" instead of merely exiting 0.
  it('registers @nx/eslint/plugin, which is what infers the target', () => {
    expect(
      registrationFor('@nx/eslint/plugin'),
      'nx.json no longer registers @nx/eslint/plugin, so NO lint target is inferred -- and `nx run-many -t lint` exits 0 with "No tasks were run", so every other guard here and the CI leg would stay GREEN having linted nothing',
    ).toBeDefined();
  });

  // The target NAME is load-bearing separately from the registration: every
  // caller -- the root `lint` script, the CI job, `targetDefaults.lint` -- is
  // keyed on the literal string `lint`. Renaming it via `options.targetName`
  // leaves the plugin registered and still empties `run-many -t lint`.
  it('names the inferred target `lint`, which is what every caller is keyed on', () => {
    expect(registrationFor('@nx/eslint/plugin')?.options?.targetName).toBe(
      'lint',
    );
  });
});

describe('lint hashes everything it lints', () => {
  // `lint` runs `eslint .` from the project directory, and its inputs start
  // from `default` (`{projectRoot}/**/*`), so BOTH classes of project source
  // are in scope -- unlike `typecheck`, `lint` is supposed to hash specs.
  it('hashes the lib sources', () => {
    expect(hashedFilesFor('lint')).toContain(`${PROJECT_ROOT}/src/index.ts`);
  });

  it('hashes the spec sources', () => {
    expect(hashedFilesFor('lint')).toContain(
      `${PROJECT_ROOT}/src/index.spec.ts`,
    );
  });

  // NON-VACUITY control for `lint`, and its discriminator had to be CHOSEN
  // rather than copied. `build` -- the discriminator the typecheck probes use
  // -- is unusable here: `lint` starting from `default` means hashing a spec is
  // exactly what it is SUPPOSED to do, so a build-shaped negative would assert
  // something false about this target. The honest negative is a probe path
  // outside `{projectRoot}`. It discriminates for the same reason the `build`
  // one does: filterUsingGlobPatterns returns the WHOLE probe list untouched
  // when the resolved pattern list is empty, so both toContain()s above would
  // pass together on a resolver that resolved nothing -- and an out-of-project
  // path is dropped only if the filter genuinely filtered.
  it('does NOT hash a path outside the project root, proving the filter filters', () => {
    expect(hashedFilesFor('lint')).not.toContain('start-cache-server/entry.ts');
  });
});

describe('lint declares its full input set (LINT-04)', () => {
  // The inferred input list carries `{ externalDependencies: ['eslint'] }` and
  // nothing else, and `targetDefaults.<target>.inputs` REPLACES that list
  // rather than merging with it. Naming only the linter IS the stale-cache
  // hole: a typescript-eslint or comments-plugin bump changes what `eslint .`
  // reports while the `lint` hash never moves, so a cached PASS stands in for
  // an unrun gate.
  it('lists all four ESLint packages as external dependencies', () => {
    const externalDependencies = nxJson.targetDefaults.lint.inputs.flatMap(
      (input) =>
        typeof input === 'object' && 'externalDependencies' in input
          ? (input.externalDependencies ?? [])
          : [],
    );

    expect([...externalDependencies].sort()).toEqual([
      '@eslint-community/eslint-plugin-eslint-comments',
      '@eslint/js',
      'eslint',
      'typescript-eslint',
    ]);
  });

  // `eslint .` with no --output-file writes nothing, so an empty array is the
  // honest declaration -- and it drops the {options.outputFile} token from
  // hash_project_config entirely.
  it('declares no outputs', () => {
    expect(nxJson.targetDefaults.lint.outputs).toEqual([]);
  });

  // CORR-04: a platform discriminator makes a target's hash OS-sensitive, which
  // is a deliberate, single-target decision. `integration` owns it because it
  // exercises real per-OS behaviour; every other target -- `lint` included --
  // must stay OS-invariant or the cross-OS cache sharing this milestone exists
  // to protect silently stops working.
  it('integration is still the only target with a platform runtime input', () => {
    const targetsWithRuntimeInput = Object.entries(nxJson.targetDefaults)
      .filter(
        ([, target]) =>
          // `?.` even though the type declares `inputs` required. nx.json is
          // parsed from disk with a CAST, so that type is an ASSERTION about
          // the file, not a check of it. A future targetDefaults entry carrying
          // only `cache: true` would otherwise turn this guard into
          // `TypeError: Cannot read properties of undefined (reading 'some')`
          // -- a crash where a comprehensible assertion failure belongs, and in
          // the one guard whose job is to notice a new target quietly acquiring
          // a platform discriminator (CORR-04).
          target.inputs?.some(
            (input) => typeof input === 'object' && 'runtime' in input,
          ) ?? false,
      )
      .map(([name]) => name);

    expect(targetsWithRuntimeInput).toEqual(['integration']);
  });

  // The guard above proves exactly one target HAS a runtime input. It does NOT
  // prove the string was not RE-SPELLED, and two independent things break if it
  // is (D-14 requires it byte-identical for both):
  //
  //   1. After VER-03 this runtime input is the SOLE mechanism separating
  //      OS-sensitive targets from OS-invariant ones. Re-spelling it is a
  //      Core-Value regression even when the replacement reads equivalently --
  //      `node -e "console.log(process.platform)"` prints the same thing and
  //      hashes to a different node, and that phase's whole result was stated in
  //      terms of that node's identity.
  //   2. `capture-hashes.mjs` READS this string out of nx.json rather than
  //      re-spelling it (its `readDiscriminatorCommand`), precisely so the record
  //      cannot drift from the config. That means a re-spelling silently changes
  //      what the INSTRUMENT captures too, so the measurement and the thing being
  //      measured would move together and the change would leave no trace.
  //
  // BOTH POINTS ABOVE ARE SUPERSEDED FOR EXACTLY ONE RE-SPELLING, and are kept
  // visible rather than deleted, because a deletion is not a correction: a future
  // reader who found only the new literal would be left holding no record that
  // the byte-identity requirement was ever weighed. Phase 12 (DOCS-07, D-15)
  // re-spelled the string ONCE, by INSERTING `--no-warnings` immediately after
  // `node` and changing nothing else -- so the prior value is recoverable from
  // the pins below by deleting that one flag, and this note does not have to
  // reproduce it. (Not reproducing it is deliberate: the D-15 completeness sweep
  // greps the tree for the OLD spelling, and a copy planted in the very file
  // that records its retirement would make that sweep permanently non-zero. Same
  // reason `docs-same-os-claims.spec.ts` writes its forbidden phrases with a
  // single-character character class.) The requirement stands GOING FORWARD at
  // the new value; the pins below are what enforce it. The replacement reason,
  // in four parts:
  //
  //   (a) stderr IS hashed, which is the citation the original argument's era
  //       never had. Nx 23.1.0's
  //       `packages/nx/src/native/tasks/hashers/hash_runtime.rs:33-35` does
  //       `hash(&[std_out, std_err].concat())` with BOTH streams `.trim()`ed and
  //       NO separator between them, so any non-empty stderr silently EXTENDS the
  //       hashed token. Five in-repo documents asserted that premise uncited;
  //       it is now measured true at the installed version.
  //   (b) The dominant realistic stderr channel is node's WARNING channel, and
  //       its text carries the process PID -- `(node:29864) Warning: ...`. So a
  //       warning would not rotate the hash ONCE, it would vary it on EVERY
  //       invocation: a permanent 100% MISS on every target carrying the
  //       discriminator. Because a MISS is never self-evidencing here
  //       (fail-closed writes, best-effort reads), that presents as a phantom
  //       portability failure rather than as a one-time rotation -- strictly
  //       worse than the rotation byte-identity was protecting against.
  //   (c) `--no-warnings` closes that channel completely (measured: 100 bytes of
  //       stderr to 0) without touching stdout, and it is a NODE flag rather than
  //       a shell construct. That distinction is load-bearing: `hash_runtime`
  //       runs the string through exactly ONE shell per OS -- `%COMSPEC% /C`
  //       (default `cmd.exe`) on Windows, `sh -c` everywhere else -- so a
  //       redirect (`2>/dev/null` / `2>nul`) would BREAK the command on one OS
  //       rather than merely reading differently. Measured byte-identical stdout
  //       in all four shell-by-flag cells.
  //   (d) The RESIDUAL, stated rather than glossed so the claim is not
  //       overstated: node's STARTUP-ERROR channel (e.g. a rejected
  //       `NODE_OPTIONS` value) is NOT suppressed by `--no-warnings`, and its
  //       text is machine- and shell-specific. But that shape also empties stdout
  //       and exits non-zero, so it fails LOUD instead of silently
  //       re-partitioning the cache.
  //
  // Exact equality on the whole extracted list, not `toContain`: a second runtime
  // entry appearing on `integration` is as much a CORR-04 event as the string
  // changing, and a containment assertion would pass through it.
  it('integration declares exactly the byte-identical discriminator command', () => {
    const runtimeCommands = nxJson.targetDefaults.integration.inputs.flatMap(
      (input) =>
        typeof input === 'object' && 'runtime' in input ? [input.runtime] : [],
    );

    expect(runtimeCommands).toEqual(['node --no-warnings -p process.platform']);
  });
});

describe('the discriminator survives the MERGED project configuration (CORR-04)', () => {
  // The two guards above -- and `capture-hashes.mjs`'s `readDiscriminatorCommand`
  // -- all read `nx.json`'s `targetDefaults`. None of the three reads the
  // configuration Nx actually HASHES, which is `targetDefaults` merged UNDER
  // `packages/github-cache/project.json`. That file exists and declares
  // `integration` (with `command` and `options` only), and a target key declared
  // there REPLACES the default's key wholesale rather than merging into it.
  //
  // So adding an `"inputs"` array to `project.json`'s `integration` target would
  // drop the platform discriminator out of the effective hash while all three
  // existing reads stayed GREEN. That is not a MISS -- it is a WRONG RESULT: with
  // the discriminator gone `integration` becomes OS-invariant, and a
  // Linux-computed `integration` result becomes restorable on Windows.
  //
  // CI does catch it (`compare.ts`'s `integration-not-divergent` clause fails on
  // every run of `hash-parity-compare`, which carries no `continue-on-error`), so
  // the signal arrives LATE rather than never. This guard is the same signal in
  // the fastest feedback layer.
  //
  // It delegates the merge to Nx's OWN two functions -- the same
  // `readTargetDefaultsForTarget` + `mergeTargetConfigurations` pair the real
  // merge uses -- for the reason the header states about the glob resolver: a
  // hand-rolled "does project.json declare inputs" check would assert the
  // SPELLING of one particular way to break it, and would go red on a
  // `project.json` that declared an inputs list CARRYING the discriminator, which
  // is a legitimate configuration. `integration` is declared, never inferred, so
  // these two layers are the whole merge for this target.
  function mergedIntegration(
    projectTarget: TargetConfiguration,
  ): TargetConfiguration {
    return mergeTargetConfigurations(
      projectTarget,
      readTargetDefaultsForTarget('integration', nxJson.targetDefaults) ??
        undefined,
    );
  }

  it('keeps the byte-identical discriminator once project.json is merged over targetDefaults', () => {
    expect(
      runtimeInputsOf(
        mergedIntegration(projectJson.targets.integration).inputs,
      ),
    ).toEqual(['node --no-warnings -p process.platform']);
  });

  // NON-VACUITY control, and it has to be a negative one for the same reason the
  // glob probes above do. If `mergeTargetConfigurations` ignored the project layer
  // -- or if this spec merged the two arguments in the wrong order -- the
  // assertion above would pass on a merge that never consulted `project.json`,
  // and the hole it exists to close would be wide open behind a green test. The
  // mutation is applied to a LOCAL copy, never to the file: this asserts what the
  // merge does with a hostile `project.json`, so it must not require one.
  it('DROPS the discriminator when project.json declares its own inputs, proving the merge merges', () => {
    const hostile: TargetConfiguration = {
      ...projectJson.targets.integration,
      inputs: ['default'],
    };

    expect(runtimeInputsOf(mergedIntegration(hostile).inputs)).toEqual([]);
  });
});

describe('the guard cannot replay a stale pass', () => {
  // This one DOES pin a literal, deliberately: there is no resolver to delegate
  // to for a `{workspaceRoot}` entry, and the wiring IS the invariant. Its
  // limitation is honest -- if the entry is removed, this test only fires once
  // some other input busts the `test` hash. That is still the next unrelated
  // source edit, and stating the requirement in code beats leaving it implicit.
  it('nx.json is a test input, so editing it re-runs this file', () => {
    expect(nxJson.targetDefaults.test.inputs).toContain(
      '{workspaceRoot}/nx.json',
    );
  });

  // This one DOES pin a literal too, and for the same reason: the wiring IS the
  // invariant and there is no resolver to delegate to for a `{workspaceRoot}`
  // entry. The second-order hole it closes (D-25) is the one most likely to be
  // missed. `lint-rules.spec.ts` instantiates ESLint against the real root config
  // and asserts what the opt-out rules DO, so it is a `test`-target spec whose
  // result depends on a file outside its own project. Without this input, editing
  // a rule replays a cached `test` PASS -- and since editing rules is exactly the
  // activity the LINT-03 proof consists of, the false PASS would surface DURING
  // that proof and read as "the rule does not fire". This repo has shipped that
  // defect twice already (governance-email.spec.ts, and `typecheck`'s
  // spec-excluding inputs); this assertion is what stops a third, and the
  // PARITY-08 block at the end of this file stops a fourth -- `ci.yml` was
  // likewise a file that `test`-target specs assert on and that no `test` input
  // covered. Those two shipped incidents are the enumeration every literal pin in
  // this file refers back to; they are listed HERE and nowhere else, so a reader
  // who arrives at a later pin is pointed at one record rather than a copy.
  it('eslint.config.mjs is a test input, so editing a rule re-runs the lint guard', () => {
    expect(nxJson.targetDefaults.test.inputs).toContain(
      '{workspaceRoot}/eslint.config.mjs',
    );
  });

  // Same literal-pinning reason, one target over. The config lives OUTSIDE the
  // project root, so no `{projectRoot}` pattern can reach it and the resolver
  // has nothing to delegate to -- the entry IS the invariant. Without it,
  // editing a rule replays a cached `lint` PASS: the gate reports the OLD rule
  // set's verdict about the NEW one, which is the LINT-04 hole itself.
  it('eslint.config.mjs is a lint input, so editing a rule re-runs lint', () => {
    expect(nxJson.targetDefaults.lint.inputs).toContain(
      '{workspaceRoot}/eslint.config.mjs',
    );
  });

  // The custom-rule directory does not exist today. The entry is still declared
  // rather than deferred: the day someone adds a local rule, its authoring
  // commit must bust the lint hash, and remembering to wire the input at that
  // moment is exactly the kind of thing nobody remembers.
  it('the custom rule directory is a lint input', () => {
    expect(nxJson.targetDefaults.lint.inputs).toContain(
      '{workspaceRoot}/tools/eslint-rules/**/*',
    );
  });

  // The identical argument, one target over, and it was one entry short. D-10
  // permits `eslint.config.mjs` to import a helper from exactly this directory,
  // and `lint-rules.spec.ts` loads the REAL config -- so a `test`-target spec's
  // verdict can depend on a file in here. Declared for `lint` but not for
  // `test`, editing such a helper would re-run `lint` and REPLAY a cached
  // `test` PASS. That is D-25's class, one entry short, and this repo has
  // already shipped it twice (governance-email.spec.ts, and `typecheck`'s
  // spec-excluding inputs). Declared now rather than on the day the directory
  // first appears, for the same reason as the `lint` entry above.
  it('the custom rule directory is a test input too, for the same reason', () => {
    expect(nxJson.targetDefaults.test.inputs).toContain(
      '{workspaceRoot}/tools/eslint-rules/**/*',
    );
  });
});

describe('ci.yml is a test input, so no spec can assert on a replayed ci.yml (PARITY-08)', () => {
  // WHY THIS EXISTS, and why it landed FIRST in its phase rather than as a
  // tidy-up at the end. `test.inputs` listed `.github/workflows/cleanup.yml` and
  // NOT `ci.yml`, so a spec asserting on `ci.yml` CONTENT had no input covering
  // its own subject: editing `ci.yml` never moved the `test` hash, and Nx served
  // the verdict computed BEFORE the assertion's subject existed. Two specs in the
  // same phase as this entry do exactly that (`dogfood-cross-os.spec.ts`,
  // `docs-same-os-claims.spec.ts`), which is why the registration had to precede
  // them rather than follow them. Same class as the two incidents this repo has
  // already shipped -- enumerated once at the `eslint.config.mjs` pin above, not
  // re-listed here.
  //
  // The entry is effective on its OWN commit. `{workspaceRoot}/nx.json` is
  // already a `test` input (pinned above), so adding the line rotates the `test`
  // hash on the very run that introduces it -- there is no window in which a
  // later spec could still replay a pre-registration pass, and no ordering
  // instruction anyone has to remember.
  //
  // THE COMMENT LOCK (Phase 8 D-13's displacement). `nx.json` is strict JSON and
  // holds no comments, so the four facts that make the entry load-bearing live
  // here, in the guard that pins it -- the same displacement the
  // `typecheck.outputs` and `lint.outputs` pins above already use.
  //
  // 1. `targetDefaults.<target>.inputs` REPLACES the inferred list rather than
  //    merging into it (stated for `lint` above; it holds identically for
  //    `test`). The consequence for a reader editing this list: nothing
  //    `@nx/vitest` infers survives beside it, so every input `test` needs must
  //    be named here or it is not hashed at all. That is what makes the 25-entry
  //    list long, and what makes an omission from it silent.
  //
  // 2. That replacement is also the ONLY reason O1 is reachable for `test`, and
  //    nothing in this repo recorded it before this comment. `@nx/vitest`'s
  //    inferred `test` target carries `{ env: 'CI' }`
  //    (`node_modules/@nx/vitest/dist/src/plugins/plugin.js:246`, measured at
  //    `nx` and `@nx/vitest` 23.1.0 -- a version worth re-measuring on an Nx
  //    major rather than carrying forward as an assumption). `CI` is set on every
  //    GitHub runner and unset on a workstation, so an env-sensitive `test` hash
  //    cannot match across those two environments at all: O1 -- a local Windows
  //    dev getting `test` HITs produced by Linux CI -- would be STRUCTURALLY
  //    IMPOSSIBLE, not merely unlikely. The explicit list is what drops that
  //    input, so the milestone's headline outcome currently holds BY ACCIDENT of
  //    a decision taken for another reason. Written down here, beside the guard
  //    that keeps the list explicit, because a future "let the plugin infer the
  //    inputs, the override is redundant" cleanup is otherwise entirely
  //    reasonable-looking.
  //
  // 3. The entry is an explicit file path, NOT
  //    `{workspaceRoot}/.github/workflows/**`. Same call `start-cache-server/`
  //    already got in this list: its two entries name `action.yml` and `entry.ts`
  //    individually rather than globbing the directory, because that directory
  //    also holds the generated `index.js` bundle, which churns on every rebuild
  //    and would re-run `test` for no behavioural change. `.github/workflows/`
  //    holds only `ci.yml` and `cleanup.yml` today, so a glob would be equivalent
  //    NOW -- and would silently adopt whatever lands there next, which is the
  //    part that is not equivalent.
  //
  // 4. `packages/github-cache/project.json` EXISTS -- tracked since `7413363`,
  //    declaring `integration` -- which is why clause 2 below reads the MERGED
  //    configuration rather than trusting clause 1. Phase 8's D-12 ("No
  //    `project.json` (the workspace is deliberately free of them)") is FALSE,
  //    and is corrected here rather than repeated; Phase 8's own NF-02 finding is
  //    what caught it. ONE locked decision is falsified, not two: the plan for
  //    this work paired D-12 with Phase 7's D-02, but that attribution is wrong
  //    -- Phase 7's D-02 is about the five exact-pinned devDependencies, and the
  //    Phase 7 decision that does mention this file (D-01) describes it
  //    CORRECTLY.

  // Clause 1 -- the literal pin, with the same honest limit as the four pins
  // above: `filterUsingGlobPatterns` substitutes `{projectRoot}` ONLY, so a
  // `{workspaceRoot}` pattern survives literally and matches no probe path. There
  // is no resolver to delegate to here -- the entry IS the invariant -- so a
  // literal is the honest form rather than a weaker assertion dressed up as
  // delegation.
  it('nx.json declares ci.yml as a test input', () => {
    expect(nxJson.targetDefaults.test.inputs).toContain(
      '{workspaceRoot}/.github/workflows/ci.yml',
    );
  });

  // Clause 2 -- the configuration Nx actually HASHES (Phase 8 NF-02). Clause 1
  // reads `nx.json` alone, and `targetDefaults` is only the BASE of the merge: a
  // `targets.test.inputs` array in `project.json` REPLACES the whole list
  // wholesale, dropping this entry out of the effective hash while clause 1 stays
  // green. Phase 8 MEASURED that asymmetry -- the `project.json` mutation reddens
  // only the merged-configuration guard, and every `nx.json`-reading guard keeps
  // passing.
  //
  // Delegated to Nx's own `readTargetDefaultsForTarget` +
  // `mergeTargetConfigurations` pair for the reason this file's header gives about
  // the glob resolver: a hand-rolled "does project.json declare inputs" check
  // would pin the SPELLING of one particular way to break it, and would redden on
  // a `project.json` declaring an inputs list that CARRIES this entry, which is a
  // legitimate configuration.
  //
  // Two things differ from the `integration` merge above and neither is cosmetic.
  //
  // `projectJson.targets.test` is ABSENT -- `project.json` declares only
  // `integration` -- so `?? {}` is not defensive noise, it IS the shape of the
  // project layer today. A reader will otherwise assume the key exists, because
  // the `integration` version passes a key that does.
  //
  // And `test` has THREE merge layers, not two: `@nx/vitest` infers the base. The
  // two functions below are still the whole merge that MATTERS, but the reason is
  // PRECEDENCE, not absence -- `targetDefaults` REPLACES `inputs` (lock fact 1),
  // so the inferred layer is dominated and cannot be the hole. `project.json` is
  // the hole. The `integration` block's closing sentence ("declared, never
  // inferred, so these two layers are the whole merge") is FALSE here and is
  // deliberately not reused.
  function mergedTest(projectTarget: TargetConfiguration): TargetConfiguration {
    return mergeTargetConfigurations(
      projectTarget,
      readTargetDefaultsForTarget('test', nxJson.targetDefaults) ?? undefined,
    );
  }

  it('keeps the ci.yml entry once project.json is merged over targetDefaults', () => {
    expect(mergedTest(projectJson.targets.test ?? {}).inputs).toContain(
      '{workspaceRoot}/.github/workflows/ci.yml',
    );
  });

  // NON-VACUITY control, and it has to be a NEGATIVE one for the same reason the
  // `integration` one does: if `mergeTargetConfigurations` ignored the project
  // layer -- or if this spec merged its two arguments in the wrong order -- clause
  // 2 would pass on a merge that never consulted `project.json`, and the hole it
  // exists to close would be wide open behind a green test. That failure mode is
  // EASIER to hit here than for `integration`, because with `targets.test` absent
  // the higher-priority argument is `{}` and a broken merge looks exactly like a
  // plain read of `targetDefaults`. The mutation is applied to a LOCAL object,
  // never to the file: this asserts what the merge does with a hostile project
  // layer, so it must not require one to exist.
  //
  // The second assertion is what makes this control itself non-vacuous. A
  // `not.toContain` alone would also pass if `inputs` came back empty or absent
  // for some unrelated reason -- the same "passes because nothing was resolved"
  // shape the glob probes above guard against. Exact equality states the actual
  // mechanism: the project layer REPLACED the list, it did not filter one entry
  // out of it.
  it('DROPS the ci.yml entry when project.json declares its own test inputs, proving the merge merges', () => {
    const hostile: TargetConfiguration = {
      ...(projectJson.targets.test ?? {}),
      inputs: ['default'],
    };

    expect(mergedTest(hostile).inputs).not.toContain(
      '{workspaceRoot}/.github/workflows/ci.yml',
    );
    expect(mergedTest(hostile).inputs).toEqual(['default']);
  });

  // The same registration, one workflow file over, and it lands in the SAME
  // COMMIT as the guard that reads that file (D-09). PARITY-08's lesson is
  // that a brand-new workflow file starts out unregistered and repeats the
  // stale-PASS defect exactly: `windows-regression-detector.spec.ts` asserts
  // on the detector workflow's CONTENT, so without this entry an edit to that
  // workflow would not rotate the `test` hash and Nx would serve the verdict
  // computed before the assertion's subject existed. There is no ordering
  // instruction to remember -- `{workspaceRoot}/nx.json` is itself a `test`
  // input, so the line is effective on the run that introduces it.
  //
  // Explicit path, NOT `{workspaceRoot}/.github/workflows/**`, for the reason
  // stated in full at lock fact 3 above: a glob is equivalent NOW and would
  // silently adopt whatever workflow lands there next, which is the part that
  // is not equivalent. It is placed immediately after the ci.yml entry in
  // nx.json so the two workflow entries stay adjacent.
  //
  // The merged-configuration clause is NOT duplicated for this entry. Clauses
  // 2 and 3 above already discharge it for the WHOLE `test` list -- a
  // `project.json` `targets.test.inputs` array replaces the list wholesale, so
  // it drops every entry or none, and a second copy per new entry would test
  // the same mechanism again.
  it('nx.json declares the windows-regression-detector workflow as a test input', () => {
    expect(nxJson.targetDefaults.test.inputs).toContain(
      '{workspaceRoot}/.github/workflows/windows-regression-detector.yml',
    );
  });

  // The same registration one FILE TYPE over, and it lands in the SAME COMMIT as
  // the doc it covers (DOCS-07). `docs-cross-os.spec.ts` asserts on
  // `docs/cross-os.md`'s CONTENT -- that it renders the discriminator `nx.json`
  // declares, that the safe default precedes the portability checklist, and that
  // the checklist has five items -- and `docs/` lives OUTSIDE this project's
  // graph, so without this entry an edit to the doc would not rotate the `test`
  // hash and Nx would serve the verdict computed before the assertion's subject
  // existed. That is PARITY-08's defect exactly, and this repo has already
  // shipped it twice (enumerated once at the `eslint.config.mjs` pin above).
  //
  // Explicit path, NOT `{workspaceRoot}/docs/**`, for the reason stated in full
  // at lock fact 3 above: a glob is equivalent NOW and would silently adopt
  // whatever lands in `docs/` next. The six sibling docs entries are each named
  // individually for the same reason, and this one is placed immediately after
  // `docs/configuration.md` so the seven `docs/` entries stay one CONTIGUOUS
  // RUN.
  //
  // CONTIGUOUS, not alphabetical, and the distinction is worth the line because
  // this comment used to claim the latter (IN-02). MEASURED: the run reads
  // configuration, cross-os, advanced, trust-and-security, versioning,
  // examples/minimal-ci.yml, examples/README.md -- which is not alphabetical,
  // and was not alphabetical BEFORE this entry was inserted either
  // (configuration, advanced, ...). So the old wording described a convention
  // the file never had, and a reader "restoring" it would reorder five entries
  // for nothing. Adjacency is the real and useful invariant: it is what makes a
  // missing docs entry visible by reading one block.
  //
  // The merged-configuration clause is NOT duplicated here either: clauses 2 and
  // 3 above discharge it for the WHOLE `test` list, since a `project.json`
  // `targets.test.inputs` array replaces the list wholesale and so drops every
  // entry or none.
  it('nx.json declares the cross-os recipe doc as a test input', () => {
    expect(
      nxJson.targetDefaults.test.inputs,
      'nx.json no longer declares {workspaceRoot}/docs/cross-os.md as a `test` input, so docs-cross-os.spec.ts can replay a PASS computed before the doc it asserts on was edited. Restore the entry; do not weaken the guard.',
    ).toContain('{workspaceRoot}/docs/cross-os.md');
  });

  // THE TWO WORKSPACE-ROOT INSTRUMENTS, and they were the only registrations in
  // either list that no clause here read. Every sibling entry above is pinned;
  // these two arrived later, from a different direction -- each closing a
  // stale-cached-PASS hole its OWN spec had recorded against itself in a
  // STALENESS CAVEAT -- and the pin that keeps them from silently regressing did
  // not arrive with them.
  //
  // WHAT DELETING EITHER COSTS, and why the absence of a pin is worse for these
  // two than for a docs entry. `capture-hashes-cli.spec.ts` and
  // `read-integration-hash.integration.spec.ts` assert on the CLI BEHAVIOUR of
  // two workspace-root `.mjs` files: which argument combinations are refused,
  // and which guards throw. `nx.json` enumerates workspace-root inputs as
  // explicit paths and carries no `{workspaceRoot}/*.mjs` glob, so without these
  // entries a LONE edit to either instrument rotates no hash at all and Nx
  // replays the verdict computed before the edit. The instrument can be weakened
  // -- a refusal removed, a throw softened -- and its own spec never runs to say
  // so. That is PARITY-08's defect exactly, in the two files whose headers
  // describe it most precisely.
  //
  // The `integration` entry is the sharper of the two: `read-integration-hash.mjs`
  // feeds the O3 existence proof, so a replayed PASS there is a proof asserting
  // over a record its own reader may no longer produce.
  //
  // Two clauses, not one parameterised loop over the pair: they key on DIFFERENT
  // targets (`test` vs `integration`) and a combined failure would not say which
  // list lost its entry. The merged-configuration clause is not duplicated for
  // either, for the reason given twice above -- a `project.json` inputs array
  // replaces its list wholesale, so it drops every entry or none.
  it('nx.json declares capture-hashes.mjs as a test input', () => {
    expect(
      nxJson.targetDefaults.test.inputs,
      'nx.json no longer declares {workspaceRoot}/capture-hashes.mjs as a `test` input, so capture-hashes-cli.spec.ts can replay a PASS computed before the instrument it asserts on was edited -- the exact staleness its own header records as CLOSED. Restore the entry; do not weaken the guard.',
    ).toContain('{workspaceRoot}/capture-hashes.mjs');
  });

  it('nx.json declares read-integration-hash.mjs as an integration input', () => {
    expect(
      nxJson.targetDefaults.integration.inputs,
      'nx.json no longer declares {workspaceRoot}/read-integration-hash.mjs as an `integration` input, so read-integration-hash.integration.spec.ts can replay a PASS computed before the instrument it asserts on was edited -- the exact staleness its own header records as CLOSED, on the instrument the O3 proof reads. Restore the entry; do not weaken the guard.',
    ).toContain('{workspaceRoot}/read-integration-hash.mjs');
  });
});
