'use strict';

// Runnable self-check for index.cjs. No framework: `node start-cache-server/selfcheck.cjs`.
// Exercises the three behaviours GitHub's runner would, without a real runner:
//   1. trusted event + runtime env present -> spawns a (fake) server that
//      survives the action's exit, and hands the readiness var to $GITHUB_ENV.
//   2. trusted event + runtime env MISSING  -> the guard fails loudly (exit 1).
//   3. untrusted event                      -> skips; no server started.

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
const tmp = mkdtempSync(path.join(os.tmpdir(), 'occ-selfcheck-'));
const pids = [];

function alive(pid) {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
}

// A stand-in for serve.js: records its pid, masks a token, appends the
// readiness var, then stays alive so we can prove it outlived the action.
function makeFakeServe(pidfile) {
  const src = [
    "const fs = require('node:fs');",
    `fs.writeFileSync(${JSON.stringify(pidfile)}, String(process.pid));`,
    "console.log('::add-mask::deadbeefsecret');",
    "fs.appendFileSync(process.env.GITHUB_ENV, 'NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:12345\\n');",
    // Safety net: self-exit so a failed cleanup can't orphan this forever.
    'setTimeout(() => process.exit(0), 30000);',
    'setInterval(() => {}, 1 << 30);',
  ].join('\n');
  const file = path.join(tmp, 'fake-serve.cjs');
  writeFileSync(file, src);

  return file;
}

function runAction(overrides) {
  const envFile = path.join(
    tmp,
    `github-env-${Math.round(Date.now())}-${overrides.GITHUB_EVENT_NAME}`,
  );
  writeFileSync(envFile, '');

  const env = {
    ...process.env,
    GITHUB_ACTIONS: 'true',
    ACTIONS_RESULTS_URL: 'http://127.0.0.1:0/fake',
    ACTIONS_RUNTIME_TOKEN: 'fake-runtime-token',
    GITHUB_ENV: envFile,
    ...overrides,
  };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete env[key];
    }
  }

  const result = spawnSync(process.execPath, [ACTION], {
    env,
    encoding: 'utf8',
    timeout: 20000,
  });

  return { result, envFile };
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
  // Case 1: happy path. On POSIX (the action's target -- CI is ubuntu) this
  // asserts the full spawn/survival/handoff. On Windows `detached: true` +
  // `stdio: 'inherit'` is a documented quirk (a detached process gets its own
  // console and can't cleanly inherit the parent's handles), so the detached
  // child is flaky to observe; there we only confirm the action passed gate +
  // guard and entered the start phase. The end-to-end path is proven for real
  // by the CI cross-run cache hit.
  check(
    'trusted + env present: gate+guard pass, server starts and survives',
    () => {
      const pidfile = path.join(tmp, 'server-1.pid');
      const command = `node "${makeFakeServe(pidfile)}"`;
      const { result, envFile } = runAction({
        GITHUB_EVENT_NAME: 'push',
        INPUT_COMMAND: command,
      });

      // Platform-independent: on a trusted event with the runtime env present the
      // action must neither skip nor trip the guard.
      assert.doesNotMatch(
        result.stdout,
        /not a trusted write event/,
        'must not skip a trusted event',
      );
      assert.doesNotMatch(
        result.stdout,
        /missing Actions cache runtime env/,
        'guard must not fire when the env is present',
      );

      if (process.platform === 'win32') {
        console.log(
          '  (win32: detached-spawn path deferred to the CI cross-run check)',
        );

        return;
      }

      assert.strictEqual(
        result.status,
        0,
        `expected exit 0, got ${result.status}\n${result.stdout}${result.stderr}`,
      );
      assert.match(
        result.stdout,
        /cache server is ready/,
        'expected readiness log',
      );
      assert.match(
        result.stdout,
        /::add-mask::deadbeefsecret/,
        'expected the masked token to reach the step console',
      );
      assert.match(
        readFileSync(envFile, 'utf8'),
        /NX_SELF_HOSTED_REMOTE_CACHE_SERVER=/,
        'expected readiness var in $GITHUB_ENV',
      );
      assert.ok(existsSync(pidfile), 'expected the server to have started');

      const pid = Number(readFileSync(pidfile, 'utf8'));
      pids.push(pid);
      assert.ok(
        alive(pid),
        'expected the detached server to outlive the action',
      );
    },
  );

  // Case 2: the guard the whole action exists for.
  check('trusted + ACTIONS_RUNTIME_TOKEN missing: guard fails loudly', () => {
    const pidfile = path.join(tmp, 'server-2.pid');
    const command = `node "${makeFakeServe(pidfile)}"`;
    const { result } = runAction({
      GITHUB_EVENT_NAME: 'push',
      ACTIONS_RUNTIME_TOKEN: undefined,
      INPUT_COMMAND: command,
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
    assert.ok(
      !existsSync(pidfile),
      'guard must fail before starting the server',
    );
  });

  // Case 3: untrusted events skip.
  check('untrusted event (pull_request): skips, no server', () => {
    const pidfile = path.join(tmp, 'server-3.pid');
    const command = `node "${makeFakeServe(pidfile)}"`;
    const { result, envFile } = runAction({
      GITHUB_EVENT_NAME: 'pull_request',
      INPUT_COMMAND: command,
    });

    assert.strictEqual(
      result.status,
      0,
      `expected exit 0, got ${result.status}`,
    );
    assert.match(
      result.stdout,
      /not a trusted write event/,
      'expected the skip log',
    );
    assert.ok(!existsSync(pidfile), 'no server on untrusted events');
    assert.strictEqual(
      readFileSync(envFile, 'utf8'),
      '',
      'no readiness var on untrusted events',
    );
  });
} finally {
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }

  rmSync(tmp, { recursive: true, force: true });
}

if (failures > 0) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll checks passed.');
