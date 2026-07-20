'use strict';

/**
 * DOCS-06 / T-06-01-01: the npm tarball file-list guard (A1, Pitfall 2).
 *
 * Runs `npm pack --dry-run --json` for @op-nx/github-cache and asserts the
 * PUBLISHED tarball ships ONLY the consumer artifacts -- dist/ + LICENSE +
 * README.md + package.json -- and EXCLUDES every repo/dogfood/CI internal:
 * src/, .github/, .planning/, nx.json, start-cache-server/, any .env, and this
 * package's own dogfood files (action.yml, selfcheck.cjs, pack-check.cjs,
 * tsconfig*, the vitest config). This proves files:["dist"] keeps
 * dogfood-stays-local -- nothing authored for THIS repo's CI leaks into the
 * consumer package (T-06-01-01).
 *
 * Dependency-free (node builtins only), mirroring selfcheck.cjs, so CI can run
 * it right after `npm ci` with no extra install. Fail-loud: any violation exits
 * 1 with a clear stderr message; a clean tarball exits 0.
 *
 * ponytail: a fixed predicate list over the pack JSON -- no globbing library,
 * no .npmignore parsing; the allow-list (files:["dist"]) does the real work and
 * this just proves the outcome.
 */

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const PACKAGE_NAME = '@op-nx/github-cache';
const REPO_ROOT = path.join(__dirname, '..', '..');

/**
 * `npm pack --dry-run --json` scoped to the package, run from the repo root.
 * npm resolves to npm.cmd on Windows, which is not directly execFile-able there,
 * so route through the platform shell (the command is a fixed literal -- no
 * interpolated input -- so there is no injection surface).
 */
function packFileList() {
  const raw = execFileSync(
    'npm',
    ['pack', '--dry-run', '--json', '--workspace', PACKAGE_NAME],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      shell: true,
      maxBuffer: 32 * 1024 * 1024,
    },
  );

  const parsed = JSON.parse(raw);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;

  if (!entry || !Array.isArray(entry.files)) {
    throw new Error('pack-check: unexpected `npm pack --json` output shape');
  }

  // Normalize to forward slashes so the path predicates are OS-independent.
  return entry.files.map((file) => file.path.replace(/\\/g, '/'));
}

/** Consumer artifacts that MUST be present in the tarball. */
const REQUIRED = ['LICENSE', 'README.md', 'package.json'];

/** Internal paths that MUST NOT ship; a match on any predicate is a leak. */
const FORBIDDEN = [
  { label: 'src/ sources', test: (p) => p.startsWith('src/') },
  { label: 'the dogfood action.yml', test: (p) => p === 'action.yml' },
  { label: 'the selfcheck generator', test: (p) => p === 'selfcheck.cjs' },
  { label: 'this pack guard', test: (p) => p === 'pack-check.cjs' },
  { label: 'a tsconfig file', test: (p) => /^tsconfig.*\.json$/.test(p) },
  {
    label: 'a vite/vitest config',
    test: (p) => /^v(itest|ite)\.config\./.test(p),
  },
  {
    label: 'an .env file',
    test: (p) => p === '.env' || p.startsWith('.env') || p.endsWith('/.env'),
  },
  // The rest live at the repo root, never inside the package dir, so they can
  // only appear if files/cwd is badly misconfigured -- assert defensively.
  { label: '.github/ CI config', test: (p) => p.startsWith('.github/') },
  { label: '.planning/ docs', test: (p) => p.startsWith('.planning/') },
  { label: 'nx.json', test: (p) => p === 'nx.json' },
  {
    label: 'the start-cache-server action',
    test: (p) => p.startsWith('start-cache-server/'),
  },
];

function main() {
  const files = packFileList();
  const problems = [];

  if (!files.some((p) => p.startsWith('dist/'))) {
    problems.push(
      'MISSING: no dist/ entry -- files:["dist"] plus a build are required',
    );
  }

  for (const required of REQUIRED) {
    if (!files.includes(required)) {
      problems.push(`MISSING: ${required} is not in the tarball`);
    }
  }

  for (const file of files) {
    for (const rule of FORBIDDEN) {
      if (rule.test(file)) {
        problems.push(`LEAK: ${file} (${rule.label}) must not ship`);
      }
    }
  }

  if (problems.length > 0) {
    process.stderr.write(
      `pack-check: the ${PACKAGE_NAME} tarball file list is WRONG:\n` +
        problems.map((m) => '  - ' + m).join('\n') +
        '\n\nThe published package must ship ONLY dist/ + LICENSE + README.md + ' +
        'package.json (files:["dist"]); no src/, CI, or dogfood internals ' +
        '(dogfood-stays-local).\n',
    );
    process.exit(1);
  }

  process.stdout.write(
    `pack-check: ${PACKAGE_NAME} tarball ships ${files.length} files -- ` +
      'dist/ + LICENSE + README.md + package.json only; no internals leaked.\n',
  );
  process.exit(0);
}

main();
