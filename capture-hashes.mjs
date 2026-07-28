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
//       directly (`node capture-hashes.mjs`, the `capture:hashes` npm script,
//       the ci.yml capture job), never through `nx run`. The root package.json
//       declares `nx.includedScripts` as an EMPTY array, so adding that script
//       cannot create an Nx target -- D-01(b) is satisfied STRUCTURALLY, not by
//       discipline.
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
  const parsed = { installMode: undefined, out: undefined, diff: undefined };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];

    if (flag === '--install-mode') {
      parsed.installMode = argv[index + 1];
      index += 1;
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
        '  node capture-hashes.mjs --diff <recordA.json> <recordB.json>',
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

if (args.diff) {
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
