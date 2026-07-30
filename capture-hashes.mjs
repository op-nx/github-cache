// Nx task-hash capture instrument (PARITY-02, PARITY-06, D-01, D-02, D-04, D-05).
// Computes the Nx task hash for the five D-05 targets using Nx's OWN arithmetic
// -- createProjectGraphAsync -> createTaskGraph -> createTaskHasher().hashTask()
// -- and emits the per-NODE `Hash.details.nodes` map plus the merged project
// configuration node. Nothing here re-derives a hash, so it cannot drift from
// Nx's behaviour. Its output is the raw material for
// `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md` and for the two-leg
// cross-OS comparison.
//
// WHY A ROOT-LEVEL DEV-ONLY SCRIPT RATHER THAN A MODULE OF THE PUBLISHED PACKAGE
// (D-01, two independent reasons; the second is the non-obvious one):
//   (a) it imports `nx/src/hasher/*`, and `nx` is a devDependency -- a shipped
//       module importing it would break every consumer install; and
//   (b) an Nx-CACHED instrument would REPLAY a stale record instead of
//       measuring, and a cached capture is not a capture. It is invoked
//       directly (`node capture-hashes.mjs`, the `capture:hashes` and
//       `assert:graph-premise` npm scripts, the ci.yml capture job), never
//       through `nx run`. The root package.json declares `nx.includedScripts` as
//       an EMPTY array, so adding those scripts cannot create an Nx target --
//       D-01(b) is satisfied STRUCTURALLY, not by discipline.
//
// WHERE EACH MODE IS EXECUTED, stated because a guard nothing runs is
// documentation and the reader has no other way to tell:
//   --install-mode  -- ci.yml's `hash-parity` job, both matrix legs.
//   --assert-graph-premise -- ci.yml's `hash-parity` job, both matrix legs, and
//       the `assert:graph-premise` npm script. It runs on BOTH legs on purpose:
//       the premise is about the WINDOWS leg's resolved graph (D-12, D-14 row 1),
//       so a ubuntu-only check would assert it on the wrong runner.
//   --diff  -- manual only, by design. It reads two already-captured records and
//       measures nothing, so there is nothing for CI to gate on.
//
// `nx/src/*` is an internal subpath with no semver guarantee. An Nx major could
// move it and break this file at IMPORT time. That is the desired failure mode:
// loud and immediate, never a silent pass. Same posture and precedent as
// `packages/github-cache/src/nx-target-inputs.spec.ts:35-37`.
//
// REJECTED ALTERNATIVE (D-03): `nx show target inputs`, and its programmatic
// form `HashPlanInspector.inspectTaskInputs()`. Both are built on the same NAPI
// inspector, whose own doc says "ProjectConfiguration is skipped for now. Cwd is
// skipped as it's ambient." (`node_modules/nx/dist/src/native/index.d.ts`), and
// both report declared file PATTERNS rather than content hashes. Both of
// v0.0.1's named suspects are therefore invisible to them, so a "no difference"
// result from that surface is NOT evidence. `.nx/cache/run.json` is the
// complementary TASK-level surface, not a substitute.
//
// NOT LINTED and NOT TYPECHECKED, deliberately: `lint` is project-scoped
// (`eslint.config.mjs:29-38` records that accepted deviation) and
// `tsconfig.action.json` covers only the esbuild-reachable graph. D-19 records
// that a typechecked spec cannot import an untyped root `.mjs`, which is why the
// two-record COMPARATOR lives in `packages/github-cache/src/hash-parity/`
// instead. This file's correctness is pinned by something stronger than a unit
// test over a mock: `08-ROOT-CAUSE.md` records its hash proven byte-identical to
// what Nx itself wrote into `.nx/cache/run.json` for the same task at the same
// commit.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { readNxJson } from 'nx/src/config/nx-json.js';
import { createTaskHasher } from 'nx/src/hasher/create-task-hasher.js';
import { getNativeFileCacheLocation } from 'nx/src/native/native-file-cache-location.js';
import { createProjectGraphAsync } from 'nx/src/project-graph/project-graph.js';
import { createTaskGraph } from 'nx/src/tasks-runner/create-task-graph.js';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory.js';

// A downstream reader that stops early (`| rg -q ...`, `| head`) closes the pipe
// while the record is still being written, and node's default is to emit an
// unhandled EPIPE and print a stack trace. That reads as a FAILED MEASUREMENT
// when the measurement in fact succeeded and the reader simply had enough --
// exactly the misattribution this whole phase exists to stamp out. Swallow EPIPE
// on stdout only; every other write error still throws. The `--out` path is
// unaffected (writeFileSync, not this stream).
process.stdout.on('error', (error) => {
  if (error.code !== 'EPIPE') {
    throw error;
  }
});

/**
 * The five targets D-05 requires. `lint` is here because Phase 7's D-35 hands it
 * over explicitly: STACK.md section 7 left "does @nx/eslint infer `lint`
 * identically on both OSes?" UNVERIFIED BY DESIGN, and Phase 8 is where that is
 * settled empirically rather than reasoned closed.
 */
const TARGETS = ['build', 'typecheck', 'test', 'integration', 'lint'];

/** Accepted `--install-mode` values. Pitfall 6: there is NO default. */
const INSTALL_MODES = ['ci', 'install'];

/**
 * The targets TEST-08's premise asserts are ABSENT from the Windows CI leg's
 * RESOLVED task graph. That absence is what licenses "any `build`, `typecheck`
 * or `test` hash in the store is Linux-produced" (D-12; D-14's attribution table
 * row 1, the only structural rather than observational means).
 */
const FORBIDDEN_TARGETS = ['build', 'typecheck', 'test'];

/**
 * D-13's mandatory negative control, and it is `typecheck` rather than `test`
 * DELIBERATELY. `test`'s `dependsOn` is `^build` -- DEPENDENCIES' build, of which
 * this single-project workspace has none -- so it resolves ONE task, clearing
 * bare vacuity without proving the resolver expands `dependsOn` at all.
 * `typecheck` carries an INFERRED `dependsOn: ["build", "^typecheck"]`
 * (`@nx/js/dist/src/plugins/typescript/plugin.js`, whose build branch fires
 * because `nx.json` supplies `plugins[].options.build`), so it resolves TWO
 * tasks, one of them a member of `FORBIDDEN_TARGETS`. That intersection is the
 * whole reason the absence assertion over the `integration` set means anything.
 *
 * Same lesson as `nx-target-inputs.spec.ts`'s two non-vacuity controls, whose
 * comments record that the discriminator has to be CHOSEN per target rather than
 * copied from a sibling.
 */
const CONTROL_TARGET = 'typecheck';

/**
 * The Nx project NAME, DERIVED not guessed (RESEARCH Pattern 2, trap 1).
 * Hardcoding the directory name produces a `TypeError` deep inside Nx's
 * `resolveConfiguration`; hardcoding the scoped name works but drifts silently
 * on a rename.
 */
const PROJECT = JSON.parse(
  readFileSync(
    new URL('./packages/github-cache/package.json', import.meta.url),
    'utf8',
  ),
).name;

/**
 * The INSTALLED Nx version, not the declared devDependency range: PARITY-06
 * wants what actually ran, and the 23.0.2 -> 23.1.0 hash-planner rewrite makes
 * cross-version measurements non-comparable.
 */
const NX_VERSION = JSON.parse(
  readFileSync(
    new URL('./node_modules/nx/package.json', import.meta.url),
    'utf8',
  ),
).version;

/**
 * Hand-rolled flag parsing over process.argv.
 * ponytail: three flags, no arg library.
 */
function parseArgs(argv) {
  const parsed = {
    installMode: undefined,
    out: undefined,
    diff: undefined,
    assertGraphPremise: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];

    if (flag === '--install-mode') {
      parsed.installMode = argv[index + 1];
      index += 1;
      continue;
    }

    // Consumes NO following argument -- the mode's only companion is `--out`.
    if (flag === '--assert-graph-premise') {
      parsed.assertGraphPremise = true;
      continue;
    }

    if (flag === '--out') {
      parsed.out = argv[index + 1];
      index += 1;
      continue;
    }

    if (flag === '--diff') {
      parsed.diff = [argv[index + 1], argv[index + 2]];
      index += 2;
      continue;
    }

    throw new Error(
      `capture-hashes: unrecognised argument \`${flag}\`. Usage:\n` +
        '  node capture-hashes.mjs --install-mode <ci|install> [--out <path>]\n' +
        '  node capture-hashes.mjs --diff <recordA.json> <recordB.json>\n' +
        '  node capture-hashes.mjs --assert-graph-premise [--out <path>]',
    );
  }

  return parsed;
}

/**
 * Directory existence + entry count, read BEFORE the project graph is built so
 * the verdict describes the state the measurement ran against.
 */
function directoryState(directory) {
  const exists = existsSync(directory);

  return {
    directory,
    exists,
    entries: exists ? readdirSync(directory).length : 0,
  };
}

/**
 * MEASURE the graph state; never accept it from a flag (D-04). Pitfall 1 is the
 * reason: `nx reset --onlyWorkspaceData` fails with EPERM on Windows when the
 * daemon holds the SQLite file open, which leaves a WARM graph sitting behind a
 * record that claims cold. There is deliberately NO graph-state CLI flag, and
 * the token is spelled out here rather than as a literal so that grepping this
 * file for the flag returns nothing -- the check for "the state was measured,
 * not asserted" must not be satisfiable by a comment.
 *
 * Both directories are recorded RAW, not forward-slash-normalised: a backslash
 * IS the Windows fact and this record is evidence. Recording the resolved paths
 * also makes an `NX_WORKSPACE_DATA_DIRECTORY` / `NX_NATIVE_FILE_CACHE_DIRECTORY`
 * redirect visible instead of silently reclassified -- the native file cache
 * lives in the OS temp directory, OUTSIDE the repo, so `rm -rf .nx/` does not
 * produce a cold state at all.
 *
 * The VERDICT is derived from the workspace-data directory ALONE, and that is a
 * correction to 08-RESEARCH.md's recommended snippet, which derived it from both
 * counts. Measured here: the "native file cache" is not a hash cache at all --
 * `native/index.js:96-107` uses it to hold ONE version-prefixed copy of the
 * `.node` addon binary ("we copy the file to a workspace-scoped tmp directory
 * ... to avoid stale files being loaded"), and this file's own static import of
 * `nx/src/project-graph/project-graph.js` puts it there before any measurement
 * can run. Requiring both counts to be zero would therefore make `cold`
 * UNREACHABLE and every record permanently `warm`, which is the same class of
 * silent-always-passes defect D-04 exists to prevent. The workspace-data
 * directory is the surface that actually persists the project graph, the file
 * map and the plugin caches -- including the `tsc-*.hash` inference result the
 * staleness axis is entirely about. The native count stays in the record as
 * evidence; it just cannot discriminate.
 */
function measureGraphState() {
  const workspaceData = directoryState(workspaceDataDirectory);
  const nativeFileCache = directoryState(getNativeFileCacheLocation());

  return {
    graphState: workspaceData.entries === 0 ? 'cold' : 'warm',
    graphStateBasis: 'workspaceDataEntries',
    workspaceDataDirectory: workspaceData.directory,
    workspaceDataEntries: workspaceData.entries,
    nativeFileCacheDirectory: nativeFileCache.directory,
    nativeFileCacheEntries: nativeFileCache.entries,
    // MEASURED, never forced. RESEARCH measured both daemon states agreeing to
    // the digit on all five targets, so the daemon is not an arithmetic hazard;
    // it is a fourth staleness surface with no inspectable file, which is why
    // the CALLER disables it and this records whether the caller did.
    daemonEnabled: process.env.NX_DAEMON !== 'false',
  };
}

/** Fixed-argument git read, shell false. Returns raw stdout. */
function git(...args) {
  return execFileSync('git', args, {
    cwd: fileURLToPath(new URL('./', import.meta.url)),
    encoding: 'utf8',
  });
}

/**
 * The declared platform discriminator, READ out of nx.json rather than
 * re-spelled (D-14 requires that string to stay byte-identical, and reading it
 * means this record cannot drift from the config).
 */
function readDiscriminatorCommand(nxJson) {
  const inputs = nxJson.targetDefaults?.integration?.inputs ?? [];
  const entry = inputs.find(
    (input) =>
      typeof input === 'object' &&
      input !== null &&
      typeof input.runtime === 'string',
  );

  if (!entry) {
    throw new Error(
      'capture-hashes: no `runtime` entry in nx.json targetDefaults.integration.inputs. ' +
        'CORR-04 and D-14 require exactly one declared platform discriminator there -- ' +
        'suspect a deleted input entry, a renamed target, or an nx.json edit that ' +
        'landed before this measurement.',
    );
  }

  return entry.runtime;
}

/**
 * Run the discriminator through a shell the way Nx's runtime hashing does, with
 * the streams captured SEPARATELY. Never `2>&1`: Nx hashes both streams, and a
 * shell-level merge destroys exactly the distinction CORR-03 asked for. The
 * strings are recorded VERBATIM including trailing newlines -- a trimmed value
 * is a different value.
 */
function runDiscriminator(command) {
  const result = spawnSync(command, {
    shell: true,
    encoding: 'utf8',
    cwd: fileURLToPath(new URL('./', import.meta.url)),
  });

  return {
    command,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
  };
}

/**
 * Hash every target with Nx's own hasher. The METHOD, not the free `hashTask`
 * from `nx/src/hasher/hash-task.js`: the free function mutates the task, returns
 * void, and writes to the task-details SQLite DB during a measurement.
 */
async function captureTargets(projectGraph, nxJson) {
  const targets = {};

  for (const target of TARGETS) {
    // The second argument is `extraTargetDependencies`, a target-to-array map.
    // Passing `nxJson.targetDefaults` there throws `flatMap is not a function`.
    const taskGraph = createTaskGraph(
      projectGraph,
      {},
      [PROJECT],
      [target],
      undefined,
      {},
    );
    const taskId = `${PROJECT}:${target}`;
    const task = taskGraph.tasks[taskId];

    if (!task) {
      // Pitfall 4, and the direct analogue of Phase 7's `nx run-many -t
      // <missing>` learning: a deleted inferred target must NEVER read as
      // "measured, no difference".
      throw new Error(
        `capture-hashes: no task ${taskId} in the task graph -- the target was renamed, ` +
          'deleted, or its inferring plugin is not registered. Available: ' +
          `${Object.keys(taskGraph.tasks).join(', ')}`,
      );
    }

    const hasher = createTaskHasher(projectGraph, nxJson);
    const hash = await hasher.hashTask(task, taskGraph, process.env);

    // `hash.details.runtime` is deliberately NOT read: in Nx 23.1.0
    // `createHashDetails` always emits it as an empty object, and the runtime
    // input lands in `nodes` under a key beginning `runtime:`.
    targets[target] = {
      hash: hash.value,
      command: hash.details.command,
      nodes: hash.details.nodes,
    };
  }

  return targets;
}

/** Capture mode: build the whole record and either print it or write it. */
async function capture(args) {
  if (!INSTALL_MODES.includes(args.installMode)) {
    throw new Error(
      'capture-hashes: --install-mode <ci|install> is REQUIRED and has NO default' +
        (args.installMode === undefined
          ? ' (it was missing)'
          : ` (got \`${args.installMode}\`)`) +
        '. `process.env.npm_config_*` is unavailable when this script is invoked ' +
        'directly, so a defaulted flag would record a GUESS as a measurement ' +
        '(PARITY-06, Pitfall 6). Pass the mode the install step actually ran.',
    );
  }

  // MEASURED BEFORE the project graph is built (Pitfall 1).
  const graph = measureGraphState();
  const nxJson = readNxJson();
  const discriminator = runDiscriminator(readDiscriminatorCommand(nxJson));

  // Measured BEFORE any output file is written, so a capture that writes into
  // the workspace does not report itself dirty.
  const workingTreeClean = git('status', '--porcelain').length === 0;
  const commit = git('rev-parse', 'HEAD').trim();

  const projectGraph = await createProjectGraphAsync({ exitOnError: false });
  const projectNode = projectGraph.nodes[PROJECT];

  if (!projectNode) {
    throw new Error(
      `capture-hashes: project ${PROJECT} is absent from the project graph -- suspect a ` +
        'renamed package, a workspaces glob that no longer matches, or a plugin that ' +
        `failed to load. Available: ${Object.keys(projectGraph.nodes).join(', ')}`,
    );
  }

  const targets = await captureTargets(projectGraph, nxJson);

  const record = {
    meta: {
      os: process.platform,
      arch: process.arch,
      nxVersion: NX_VERSION,
      nodeVersion: process.version,
      installMode: args.installMode,
      commit,
      workingTreeClean,
      // On a `pull_request` event actions/checkout resolves a MERGE commit whose
      // SHA no developer can reproduce. Recording both makes a
      // cross-observation-point SHA mismatch visible instead of hidden; plan
      // 08-03 pins the checkout so they agree, and this is how that is checked.
      githubSha: process.env.GITHUB_SHA ?? null,
      runnerOs: process.env.RUNNER_OS ?? null,
      capturedAt: new Date().toISOString(),
      ...graph,
    },
    targets,
    // The merged project node, `targetDefaults` already applied. The node map
    // carries exactly ONE `<project>:ProjectConfiguration` entry covering all
    // five targets, so a difference there cannot be localised to a field without
    // the merged node itself -- and localising it is precisely what PARITY-01
    // asks for. Note `metadata` inside this node is NOT hashed, so a difference
    // there is informational rather than a hash divergence.
    projectConfiguration: projectNode.data,
    discriminator,
  };

  const serialised = `${JSON.stringify(record, null, 2)}\n`;

  if (args.out) {
    writeFileSync(args.out, serialised);
    process.stderr.write(
      `capture-hashes: wrote ${TARGETS.length} target records for ${PROJECT} ` +
        `(${record.meta.os}/${record.meta.arch}, ${record.meta.graphState} graph) to ${args.out}\n`,
    );

    return;
  }

  process.stdout.write(serialised);
}

/**
 * The RESOLVED task-id set for a `run-many` over `targets`, sorted. This is the
 * SAME call `captureTargets` makes; the new mode just emits the value that
 * function only ever uses on its throw path. The second argument MUST stay `{}`
 * for the measured reason recorded at that call site.
 */
function resolvedTaskIds(projectGraph, targets) {
  const taskGraph = createTaskGraph(
    projectGraph,
    {},
    [PROJECT],
    targets,
    undefined,
    {},
  );

  return Object.keys(taskGraph.tasks).sort();
}

/**
 * The target segment of a task id: everything after the LAST colon. Splitting on
 * the last colon rather than substring-matching the id is load-bearing -- PROJECT
 * is SCOPED (`@op-nx/github-cache`), so an id already carries structure, and a
 * future `@op-nx/github-cache:build-deps` would false-positive an
 * `id.includes('build')`.
 */
function targetSegment(taskId) {
  return taskId.slice(taskId.lastIndexOf(':') + 1);
}

/**
 * TEST-08's mechanical premise assertion (D-12) with D-13's mandatory
 * non-vacuity control. THE CONTRACT, written down before the implementation.
 *
 * SIX CLAUSES, BUT NOT SIX INDEPENDENT ONES, and the correction matters in a
 * phase whose whole subject is guards that READ as coverage without being it. An
 * earlier revision of this block presented all six as independent and named
 * clause 5 as "the clause that makes assertion 2 meaningful rather than vacuous".
 * Clause 4 already discharges that. What follows is the MEASURED split.
 *
 * THREE CLAUSES OVER THE RESOLVER -- these are the ones a graph change can fire:
 *
 *   1. the `integration` set is NON-EMPTY. An empty set satisfies every absence
 *      assertion simultaneously -- Phase 7's `filterUsingGlobPatterns` lesson
 *      recurring, and the exact class of silent false pass D-13 exists to stop;
 *   2. no member of that set has a target segment in `FORBIDDEN_TARGETS`. This
 *      is the premise itself;
 *   3. the control set holds EXACTLY two members. The COUNT is asserted, not
 *      just the membership: it is a property of the RESOLVED graph, so an Nx
 *      upgrade that changes the inferred `dependsOn` must fail loud instead of
 *      quietly weakening the control;
 *   4. those two members are `<PROJECT>:build` and `<PROJECT>:<CONTROL_TARGET>`.
 *      This is what makes clause 2 non-vacuous: it PINS a forbidden segment into
 *      the control set, so the resolver is shown to put one there.
 *
 * TWO CLAUSES OVER THE CONSTANTS -- belt and braces, and they are RETAINED
 * deliberately rather than deleted, because a deleted clause is
 * indistinguishable from one that never existed. They cannot be fired by any
 * graph change:
 *
 *   5. the control set INTERSECTS `FORBIDDEN_TARGETS`. Unreachable while clause 4
 *      holds, since clause 4 pins `build` and `<CONTROL_TARGET>` into the set and
 *      both are members of `FORBIDDEN_TARGETS`. It is therefore a guard on the
 *      CONSTANT: it fires only if `FORBIDDEN_TARGETS` is edited to stop covering
 *      the control set. MEASURED both ways -- `FORBIDDEN_TARGETS = []` and
 *      `FORBIDDEN_TARGETS = ['zzz']` each make clause 5 the first to fail;
 *   6. the control set DIFFERS from the `integration` set. Unreachable FULL STOP,
 *      for ANY value of the constants, not merely under the current ones: clause
 *      2 passing means no `integration` member carries a forbidden segment, and
 *      clause 5 passing means some control member does, so the two sets cannot be
 *      equal. Its stated failure mode -- a resolver returning the same thing for
 *      every input -- fires on clause 2 first and with a better message. Kept as
 *      the written-down INTENT; do not read it as coverage.
 *
 * Every failure ENUMERATES both observed sets, mirroring `captureTargets`'s
 * missing-task throw. All six THROW; none warns. TEST-08 requires the assertion
 * OUTPUT captured as evidence, so the verdict lands in the `--out`/stdout JSON
 * rather than only in the stderr summary line.
 */
async function assertGraphPremise(args) {
  const commit = git('rev-parse', 'HEAD').trim();
  const projectGraph = await createProjectGraphAsync({ exitOnError: false });

  // The Windows CI leg's ACTUAL command is `npm run integration`, i.e.
  // `nx run-many -t integration`. `run-many` over every project in a
  // single-project workspace is `[PROJECT]`, which is what `resolvedTaskIds`
  // passes -- so this resolves the command the leg really runs, not a proxy.
  const premiseTargets = ['integration'];
  const controlTargets = [CONTROL_TARGET];
  const premiseCommand = `nx run-many -t ${premiseTargets.join(' ')}`;
  const controlCommand = `nx run-many -t ${controlTargets.join(' ')}`;
  const premiseIds = resolvedTaskIds(projectGraph, premiseTargets);
  const controlIds = resolvedTaskIds(projectGraph, controlTargets);

  // Built once and appended to every throw below, so no failure path can forget
  // to say what was actually observed.
  const observed =
    `Observed \`${premiseCommand}\` set (${premiseIds.length}): ` +
    `${premiseIds.join(', ') || '<empty>'}. ` +
    `Observed \`${controlCommand}\` control set (${controlIds.length}): ` +
    `${controlIds.join(', ') || '<empty>'}.`;
  const fail = (assertion, detail) => {
    throw new Error(
      `capture-hashes: --assert-graph-premise FAILED assertion ${assertion} -- ${detail} ${observed}`,
    );
  };

  if (premiseIds.length === 0) {
    fail(
      1,
      `the resolved task graph for \`${premiseCommand}\` is EMPTY, so every absence assertion ` +
        'below would pass trivially. Suspect a renamed target, a plugin that failed to load, or a ' +
        'project name that no longer matches.',
    );
  }

  const offenders = premiseIds.filter((taskId) =>
    FORBIDDEN_TARGETS.includes(targetSegment(taskId)),
  );

  if (offenders.length > 0) {
    fail(
      2,
      `\`${premiseCommand}\` resolves forbidden target(s) ${offenders.join(', ')}. TEST-08's ` +
        `premise is that the Windows CI leg resolves no ${FORBIDDEN_TARGETS.join('/')} task, so ` +
        'any such hash in the store is Linux-produced (D-12, D-14 row 1). With this false, that ' +
        'attribution is withdrawn.',
    );
  }

  if (controlIds.length !== 2) {
    fail(
      3,
      `the \`${CONTROL_TARGET}\` control resolved ${controlIds.length} task(s), wanted exactly 2. ` +
        `\`${CONTROL_TARGET}\`'s INFERRED dependsOn is ["build", "^${CONTROL_TARGET}"]; if an Nx ` +
        'upgrade changed that inference the control is weaker than D-13 requires and must be ' +
        're-chosen, not re-counted.',
    );
  }

  const expectedControlIds = [
    `${PROJECT}:build`,
    `${PROJECT}:${CONTROL_TARGET}`,
  ].sort();

  if (controlIds.join(',') !== expectedControlIds.join(',')) {
    fail(
      4,
      `the \`${CONTROL_TARGET}\` control set is not ${expectedControlIds.join(', ')}. The control ` +
        "is only strictly stronger than a `test` control while it resolves this project's own " +
        '`build` alongside it.',
    );
  }

  // BELT AND BRACES ON THE CONSTANT, not on the resolver -- see the contract
  // block. Assertion 4 has already pinned `build` and `<CONTROL_TARGET>` into
  // controlIds and both are FORBIDDEN_TARGETS members, so no graph change reaches
  // here; only an edit to FORBIDDEN_TARGETS does.
  if (
    !controlIds.some((taskId) =>
      FORBIDDEN_TARGETS.includes(targetSegment(taskId)),
    )
  ) {
    fail(
      5,
      `the \`${CONTROL_TARGET}\` control set intersects ${FORBIDDEN_TARGETS.join('/')} nowhere, so ` +
        'it does not demonstrate that this resolver EVER puts a forbidden task into a set. ' +
        'Assertion 2 would then be an absence over a set that never contains one.',
    );
  }

  // WRITTEN-DOWN INTENT, NOT COVERAGE -- see the contract block. Assertions 2 and
  // 5 together make this unreachable for ANY value of the constants: 2 says no
  // `integration` member carries a forbidden segment and 5 says some control
  // member does, so the sets cannot be equal. Retained because a deleted clause is
  // indistinguishable from one that never existed; do not count it as a guard.
  if (premiseIds.join(',') === controlIds.join(',')) {
    fail(
      6,
      'the control set is IDENTICAL to the `integration` set, which is what a resolver returning ' +
        'the same thing for every input looks like.',
    );
  }

  const record = {
    mode: 'assert-graph-premise',
    meta: {
      os: process.platform,
      arch: process.arch,
      nxVersion: NX_VERSION,
      nodeVersion: process.version,
      project: PROJECT,
      commit,
      capturedAt: new Date().toISOString(),
    },
    forbiddenTargets: FORBIDDEN_TARGETS,
    integration: { command: premiseCommand, taskIds: premiseIds },
    control: { command: controlCommand, taskIds: controlIds },
    verdict: 'PREMISE OK',
  };

  const serialised = `${JSON.stringify(record, null, 2)}\n`;

  if (args.out) {
    writeFileSync(args.out, serialised);
    process.stderr.write(
      `capture-hashes: premise ${record.verdict} for ${PROJECT} ` +
        `(${record.meta.os}/${record.meta.arch}, ${premiseIds.length} integration task(s), ` +
        `${controlIds.length} ${CONTROL_TARGET} control task(s)) written to ${args.out}\n`,
    );

    return;
  }

  process.stdout.write(serialised);
}

/** Flatten an object to dotted leaf paths with JSON-encoded leaf values. */
function flatten(value, prefix, out) {
  if (value === null || typeof value !== 'object') {
    out[prefix] = JSON.stringify(value);

    return out;
  }

  for (const [key, child] of Object.entries(value)) {
    flatten(child, prefix === '' ? key : `${prefix}.${key}`, out);
  }

  return out;
}

/**
 * The three-bucket partition RESEARCH prescribes. A raw diff drowns in the 422+
 * `npm:` keys, so `same` is reported as a COUNT only.
 *
 * This is the ONE node-partition implementation in the repo. The comparator in
 * `packages/github-cache/src/hash-parity/` cannot import it: this instrument
 * must be runnable immediately after `npm ci` with NO build step (the capture
 * job has none, by design), so it cannot import from `dist/`, and a typechecked
 * module cannot import an untyped root `.mjs` (D-19).
 * ponytail: two plain loops over Object.entries; no diffing library.
 */
function partition(a, b) {
  const onlyInA = [];
  const onlyInB = [];
  const valueChanged = [];
  let same = 0;

  for (const [key, value] of Object.entries(a)) {
    if (!(key in b)) {
      onlyInA.push(key);
      continue;
    }

    if (b[key] !== value) {
      valueChanged.push([key, value, b[key]]);
      continue;
    }

    same += 1;
  }

  for (const key of Object.keys(b)) {
    if (!(key in a)) {
      onlyInB.push(key);
    }
  }

  return { onlyInA, onlyInB, valueChanged, same };
}

/**
 * Print one partition. `only-in-*` LEADS, because it cannot arise from staleness
 * within a single machine and is the shape a differing platform-specific
 * optional-dependency set takes -- the cleanest cross-OS signal available.
 */
function printPartition(label, buckets) {
  process.stdout.write(`  ${label}\n`);
  process.stdout.write(
    `    only-in-A (${buckets.onlyInA.length}): ${buckets.onlyInA.join(', ') || '-'}\n`,
  );
  process.stdout.write(
    `    only-in-B (${buckets.onlyInB.length}): ${buckets.onlyInB.join(', ') || '-'}\n`,
  );
  process.stdout.write(`    value-changed (${buckets.valueChanged.length}):\n`);

  for (const [key, valueA, valueB] of buckets.valueChanged) {
    process.stdout.write(
      `        ${key}\n          A=${valueA}\n          B=${valueB}\n`,
    );
  }

  if (buckets.valueChanged.length === 0) {
    process.stdout.write('        -\n');
  }

  process.stdout.write(`    same: ${buckets.same}\n`);
}

/** Diff mode: partition two records' node maps per target, then their project nodes. */
function diff(paths) {
  const [pathA, pathB] = paths;

  if (!pathA || !pathB) {
    throw new Error(
      'capture-hashes: --diff needs TWO record paths (--diff <recordA.json> <recordB.json>).',
    );
  }

  const a = JSON.parse(readFileSync(pathA, 'utf8'));
  const b = JSON.parse(readFileSync(pathB, 'utf8'));

  process.stdout.write(`A = ${pathA}\nB = ${pathB}\n`);

  for (const target of TARGETS) {
    const recordA = a.targets?.[target];
    const recordB = b.targets?.[target];

    if (!recordA || !recordB) {
      process.stdout.write(
        `\n=== ${target} : MISSING from ${!recordA ? 'A' : 'B'} -- not a comparison ===\n`,
      );
      continue;
    }

    process.stdout.write(
      `\n=== ${target} : ${recordA.hash} (A) vs ${recordB.hash} (B) ===\n`,
    );
    process.stdout.write(
      `  command: ${recordA.command === recordB.command ? 'same' : 'DIFFERS'}\n`,
    );
    printPartition(
      `nodes: ${Object.keys(recordA.nodes).length} / ${Object.keys(recordB.nodes).length}`,
      partition(recordA.nodes, recordB.nodes),
    );
  }

  process.stdout.write('\n=== projectConfiguration (field level) ===\n');
  printPartition(
    'fields',
    partition(
      flatten(a.projectConfiguration ?? {}, '', {}),
      flatten(b.projectConfiguration ?? {}, '', {}),
    ),
  );
}

const args = parseArgs(process.argv.slice(2));

if (args.assertGraphPremise) {
  if (args.installMode !== undefined) {
    throw new Error(
      'capture-hashes: --assert-graph-premise is mutually exclusive with --install-mode. ' +
        'The mode resolves a task graph and measures no hash, so recording an install mode ' +
        'against it would make the record claim a provenance it never measured. --out IS ' +
        'accepted, and is the intended channel: TEST-08 requires the assertion OUTPUT captured ' +
        'as evidence, not discarded as a pre-flight check.',
    );
  }

  await assertGraphPremise(args);
} else if (args.diff) {
  if (args.installMode !== undefined || args.out !== undefined) {
    throw new Error(
      'capture-hashes: --diff is mutually exclusive with --install-mode and --out. ' +
        'Diff mode reads two already-captured records; it measures nothing.',
    );
  }

  diff(args.diff);
} else {
  await capture(args);
}
