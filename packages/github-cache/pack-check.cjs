'use strict';

/**
 * DOCS-06 / T-06-01-01: the npm tarball file-list guard (A1, Pitfall 2).
 *
 * Runs `npm pack --dry-run --json` for @op-nx/github-cache and asserts the
 * PUBLISHED tarball ships ONLY the consumer artifacts -- the CONSUMER subset of
 * dist/ + LICENSE + README.md + package.json -- and EXCLUDES every
 * repo/dogfood/CI internal: src/, .github/, .planning/, nx.json,
 * start-cache-server/, any .env, and this package's own dogfood files
 * (action.yml, pack-check.cjs, tsconfig*, the vitest config).
 *
 * dogfood-stays-local applies INSIDE dist/ too, not only at the repo root: the
 * `files` negated globs exclude dist/action (the internal dogfood action's built
 * main), dist/roundtrip (the CI round-trip bin), dist/test (spec-only helpers),
 * dist/hash-parity (the CORR-03 comparator and its CI bin), and the
 * *.tsbuildinfo / *.d.ts.map build metadata. tsc still EMITS all of it
 * (action.yml resolves dist/action/index.js from the repo checkout, ci.yml runs
 * dist/roundtrip/read-back.js and dist/hash-parity/assert-parity.js, specs
 * import dist/test) -- npm just does not PACK it. This guard proves both halves:
 * the internal subtrees are absent AND the genuine consumer entry points are
 * present, so an over-narrow `files` edit cannot silently ship an empty package
 * (T-06-01-01).
 *
 * This paragraph is the ONE place the subtree list is restated BY HAND. The
 * FORBIDDEN predicates and both operator-facing messages are derived from the
 * DIST_SUBTREES constant below, so they cannot disagree with what is enforced; a
 * comment cannot be derived at runtime, so this one is maintained manually and
 * says so rather than going quietly stale. Adding a fifth subtree means editing
 * DIST_SUBTREES and this sentence's list -- nothing else.
 *
 * Dependency-free (node builtins only), so CI can run
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

/**
 * Consumer artifacts that MUST be present in the tarball. Includes the real dist/
 * entry points so an over-narrow `files` edit (e.g. a negated glob that
 * accidentally excludes the barrel) cannot silently ship an empty package.
 */
const REQUIRED = [
  'LICENSE',
  'README.md',
  'package.json',
  'dist/index.js',
  'dist/index.d.ts',
  'dist/serve.js',
];

/**
 * dogfood-stays-local INSIDE dist/: these subtrees are built (tsc emits them so
 * the repo's own action.yml/ci.yml/specs resolve them) but must NOT ship to
 * consumers -- excluded via the `files` negated globs, asserted below so a
 * reintroduction fails the guard. An unasserted exclusion is how the first three
 * would have regressed.
 *
 * THE ONE AUTHORED SOURCE for that set. Three sites used to enumerate it
 * independently -- the FORBIDDEN predicates, the failure message and the success
 * message -- so a fourth subtree could be half-added and the printed sentence
 * would keep claiming three. All three now derive from here.
 * ponytail: a map and a join replace two hand-maintained enumerations. It buys
 * exactly one thing -- the fifth subtree cannot be half-added -- and the module
 * header above stays hand-written because a comment has no runtime.
 */
const DIST_SUBTREES = [
  {
    directory: 'dist/action',
    label: 'the internal dogfood action build output',
  },
  { directory: 'dist/roundtrip', label: 'the CI round-trip build output' },
  { directory: 'dist/test', label: 'test-support build output' },
  {
    directory: 'dist/hash-parity',
    label: 'the hash-parity comparator build output',
  },
];

/** The derived prose list, so no message can disagree with what is enforced. */
const DIST_SUBTREE_LIST = DIST_SUBTREES.map((s) => s.directory).join(', ');

/** Internal paths that MUST NOT ship; a match on any predicate is a leak. */
const FORBIDDEN = [
  { label: 'src/ sources', test: (p) => p.startsWith('src/') },
  { label: 'the dogfood action.yml', test: (p) => p === 'action.yml' },
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
  // Generated from DIST_SUBTREES (see its comment). Each predicate is the same
  // prefix test on the same string the hand-written ones used, so this is
  // behaviour-preserving for the first three and additive for the fourth.
  ...DIST_SUBTREES.map(({ directory, label }) => ({
    label,
    test: (p) => p.startsWith(`${directory}/`),
  })),
  {
    label: 'a tsbuildinfo build artifact',
    test: (p) => p.endsWith('.tsbuildinfo'),
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

  // `process.exitCode` plus a return, NEVER `process.exit()`. On POSIX both
  // std streams are ASYNCHRONOUS when they are PIPES, and `process.exit()` is
  // documented to discard pending writes -- so the failure path could lose exactly
  // the enumerated LEAK: / MISSING: list that makes a red job actionable. This
  // guard runs as `npm run pack:check` on ubuntu-24.04-arm, where the runner
  // captures step output through a pipe, so that is the live configuration and not
  // a hypothetical. `assert-parity.ts:34-38` reasons about the same hazard and
  // avoids it the same way; this file predates that reasoning.
  //
  // The exit code is still the gate: `main()` is straight-line, so setting
  // `exitCode` and returning is equivalent to exiting, minus the truncation. The
  // failure path was re-verified as exit 1 with the message intact after this
  // change -- an unproven `exitCode` assignment would be a guard that goes green
  // forever, which is worse than the truncation it replaces.
  if (problems.length > 0) {
    process.stderr.write(
      `pack-check: the ${PACKAGE_NAME} tarball file list is WRONG:\n` +
        problems.map((m) => '  - ' + m).join('\n') +
        '\n\nThe published package must ship ONLY the CONSUMER subset of dist/ + ' +
        'LICENSE + README.md + package.json; no src/, CI, or dogfood internals, ' +
        `and INSIDE dist/ no ${DIST_SUBTREE_LIST}, or build metadata ` +
        '(dogfood-stays-local applies inside dist/, not just at the repo ' +
        'root).\n',
    );
    process.exitCode = 1;

    return;
  }

  process.stdout.write(
    `pack-check: ${PACKAGE_NAME} tarball ships ${files.length} files -- ` +
      'the consumer subset of dist/ + LICENSE + README.md + package.json only; ' +
      `no internals leaked (${DIST_SUBTREE_LIST} excluded).\n`,
  );
}

main();
