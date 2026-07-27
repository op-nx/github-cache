import { readFileSync } from 'node:fs';
import type { NxJsonConfiguration } from 'nx/src/config/nx-json.js';
import {
  extractPatternsFromFileSets,
  filterUsingGlobPatterns,
  splitInputsIntoSelfAndDependencies,
} from 'nx/src/hasher/task-hasher.js';
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
      .filter(([, target]) =>
        target.inputs.some(
          (input) => typeof input === 'object' && 'runtime' in input,
        ),
      )
      .map(([name]) => name);

    expect(targetsWithRuntimeInput).toEqual(['integration']);
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
  // spec-excluding inputs); this assertion is what stops a third.
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
