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

const nxJson = JSON.parse(
  readFileSync(new URL('../../../nx.json', import.meta.url), 'utf8'),
) as {
  namedInputs: Record<string, TargetInputs>;
  targetDefaults: Record<string, { inputs: TargetInputs }>;
};

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
});
