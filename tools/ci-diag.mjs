// Temporary CI diagnostic (remove after use). Prints, on each integration leg:
// node's process.platform, the exact stdout Nx's runtime hasher would capture
// for `node -p process.platform` (via the same cmd/C or sh -c shell path), and
// the actual `integration` task hash Nx computes on this runner. Lets us compare
// the runner's integration hash + runtime value against the local values.
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

console.log(
  'CIDIAG platform=%s arch=%s CI=%s NX_DAEMON=%s',
  process.platform,
  process.arch,
  process.env.CI,
  process.env.NX_DAEMON,
);

// Replicate Nx's runtime hasher shell path (cmd /C on win32, sh -c elsewhere).
try {
  const out = execSync('node -p process.platform', { encoding: 'utf8' });
  console.log('CIDIAG runtime-shell-output=%j', out.trim());
} catch (e) {
  console.log('CIDIAG runtime-shell-FAILED:', e.message);
}

// Compute the integration task hash exactly as nx does.
const base = process.cwd() + '/node_modules/nx/dist/src';
const imp = (p) => import(pathToFileURL(base + p).href);
const { createProjectGraphAsync } = await imp(
  '/project-graph/project-graph.js',
);
const { createTaskHasher } = await imp('/hasher/create-task-hasher.js');
const { createTaskGraph } = await imp('/tasks-runner/create-task-graph.js');
const { hashTask, getTaskDetails } = await imp('/hasher/hash-task.js');
const { readNxJson } = await imp('/config/nx-json.js');
const project = '@op-nx/github-cache';
const graph = await createProjectGraphAsync({ exitOnError: true });
const hasher = createTaskHasher(graph, readNxJson());
const taskGraph = createTaskGraph(
  graph,
  {},
  [project],
  ['integration'],
  undefined,
  {},
);
const task = taskGraph.tasks[project + ':integration'];
await hashTask(hasher, graph, taskGraph, task, process.env, getTaskDetails());
console.log('CIDIAG integration-hash=%s', task.hash);
