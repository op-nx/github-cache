'use strict';

// Runnable self-check for index.cjs. No framework: `node publish-mirror/selfcheck.cjs`.
// publish-mirror is short-lived and run synchronously (no detached child), so
// unlike the cache-server action this exercises fully on every platform:
//   1. token + runtime env present -> runs the command with GH_TOKEN set,
//      mirrors its exit status.
//   2. no token                    -> guard fails loudly (exit 1).
//   3. no ACTIONS_RUNTIME_TOKEN     -> guard fails loudly (exit 1).
//   4. command exits non-zero       -> that status is propagated.

const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ACTION = path.join(__dirname, 'index.cjs');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'occ-pm-selfcheck-'));

// A stand-in for publish-mirror: records the GH_TOKEN it saw, then exits with a
// chosen code so we can assert both token plumbing and status propagation.
function makeFakeMirror(tokenSink, exitCode) {
  const src = [
    "const fs = require('node:fs');",
    `fs.writeFileSync(${JSON.stringify(tokenSink)}, process.env.GH_TOKEN || '');`,
    `process.exit(${exitCode});`,
  ].join('\n');
  const file = path.join(tmp, `fake-mirror-${exitCode}.cjs`);
  writeFileSync(file, src);

  return file;
}

function runAction(overrides) {
  const env = {
    ...process.env,
    ACTIONS_RESULTS_URL: 'http://127.0.0.1:0/fake',
    ACTIONS_RUNTIME_TOKEN: 'fake-runtime-token',
    INPUT_TOKEN: 'fake-gh-token',
    ...overrides,
  };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete env[key];
    }
  }

  return spawnSync(process.execPath, [ACTION], {
    env,
    encoding: 'utf8',
    timeout: 20000,
  });
}

let failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`[OK] ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`[FAIL] ${name}: ${error.message}`);
  }
}

try {
  check(
    'token + runtime env present: runs command with GH_TOKEN, exit 0',
    () => {
      const sink = path.join(tmp, 'token-seen.txt');
      const result = runAction({
        INPUT_COMMAND: `node "${makeFakeMirror(sink, 0)}"`,
      });

      assert.strictEqual(
        result.status,
        0,
        `expected exit 0, got ${result.status}\n${result.stdout}${result.stderr}`,
      );
      assert.ok(existsSync(sink), 'expected publish-mirror to have run');
      assert.strictEqual(
        readFileSync(sink, 'utf8'),
        'fake-gh-token',
        'expected GH_TOKEN handed to the command',
      );
    },
  );

  check('no token: guard fails loudly', () => {
    const result = runAction({
      INPUT_TOKEN: undefined,
      GH_TOKEN: undefined,
      GITHUB_TOKEN: undefined,
      INPUT_COMMAND: `node "${makeFakeMirror(path.join(tmp, 'x'), 0)}"`,
    });

    assert.strictEqual(
      result.status,
      1,
      `expected exit 1, got ${result.status}`,
    );
    assert.match(
      result.stdout,
      /::error::/,
      'expected an ::error:: annotation',
    );
    assert.match(result.stdout, /token/i, 'expected the token named');
  });

  check('no ACTIONS_RUNTIME_TOKEN: guard fails loudly', () => {
    const result = runAction({
      ACTIONS_RUNTIME_TOKEN: undefined,
      INPUT_COMMAND: `node "${makeFakeMirror(path.join(tmp, 'y'), 0)}"`,
    });

    assert.strictEqual(
      result.status,
      1,
      `expected exit 1, got ${result.status}`,
    );
    assert.match(
      result.stdout,
      /::error::/,
      'expected an ::error:: annotation',
    );
    assert.match(
      result.stdout,
      /ACTIONS_RUNTIME_TOKEN/,
      'expected the missing var named',
    );
  });

  check('command exits non-zero: status is propagated', () => {
    const result = runAction({
      INPUT_COMMAND: `node "${makeFakeMirror(path.join(tmp, 'z'), 7)}"`,
    });

    assert.strictEqual(
      result.status,
      7,
      `expected exit 7, got ${result.status}`,
    );
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (failures > 0) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll checks passed.');
