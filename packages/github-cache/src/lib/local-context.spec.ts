import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HELPER_TIMEOUT_MS,
  resolveLocalReadToken,
  resolveRepoIdentity,
} from './local-context.js';

// Module mock, mirroring actions-cache-backend.spec.ts's justification register.
// The real helpers (gh auth token, git credential fill, git remote) touch a
// keychain, a network, and the developer's own login state, so a unit layer MUST
// mock them or the suite becomes machine-dependent and CI would fail on any runner
// without the gh CLI installed. An explicit factory is used, NOT a bare auto-mock:
// an auto-mocked spawn is a vi.fn() that never emits an event nor closes, so the
// wrapper awaiting it would hang the run forever. Each test drives its own child.
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

const spawnMock = vi.mocked(spawn);

interface Outcome {
  stdout?: string;
  stderr?: string;
  code?: number;
  errorEvent?: boolean;
}

interface FakeChild {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: { end: ReturnType<typeof vi.fn> };
  on(event: string, handler: (arg: unknown) => void): FakeChild;
}

// A minimal fake child: stdout/stderr are EventEmitters, stdin records what end()
// received, and on() captures the wrapper's error/close listeners. The events are
// driven on the next microtask so the wrapper has attached all of its listeners
// synchronously first (it does so immediately after spawn returns).
function fakeChild(outcome: Outcome): FakeChild {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const listeners = new Map<string, (arg: unknown) => void>();

  const child: FakeChild = {
    stdout,
    stderr,
    stdin: { end: vi.fn() },
    on(event, handler) {
      listeners.set(event, handler);

      return child;
    },
  };

  queueMicrotask(() => {
    if (outcome.errorEvent === true) {
      // The missing-binary shape: the error carries the STRING code 'ENOENT'.
      // The wrapper must treat it identically to a non-zero exit.
      const enoent = Object.assign(new Error('spawn ENOENT'), {
        code: 'ENOENT',
      });
      listeners.get('error')?.(enoent);

      return;
    }

    if (outcome.stderr !== undefined) {
      // Emitted to prove the wrapper never consults stderr: it attaches no 'data'
      // listener to stderr at all, so this content is dropped on the floor.
      stderr.emit('data', Buffer.from(outcome.stderr));
    }

    if (outcome.stdout !== undefined) {
      stdout.emit('data', Buffer.from(outcome.stdout));
    }

    const code = outcome.code === undefined ? 0 : outcome.code;
    listeners.get('close')?.(code);
  });

  return child;
}

function asChild(child: FakeChild): ChildProcess {
  return child as unknown as ChildProcess;
}

// Program the mocked spawn: the resolver maps each spawn (by file/args) to a fake
// child outcome. Returns nothing; tests that need the child capture it themselves.
function programSpawn(
  resolve: (file: string, args: readonly string[]) => FakeChild,
): void {
  spawnMock.mockImplementation(((file: string, args: readonly string[]) =>
    asChild(resolve(file, args))) as unknown as typeof spawn);
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('resolveLocalReadToken three-tier chain (FOUND-02)', () => {
  it('tier 1 wins: an env token resolves with no subprocess spawned at all (FOUND-02)', async () => {
    const token = await resolveLocalReadToken({ GH_TOKEN: 'ghp_x' });

    expect(token).toBe('ghp_x');
    // Non-vacuous: proves the SHORT-CIRCUIT, not merely the return value -- if
    // tier 1 did not early-return, spawn would have been called for gh.
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('tier 1 falls through a set-but-empty GH_TOKEN to GITHUB_TOKEN, still no spawn (FOUND-02)', async () => {
    const token = await resolveLocalReadToken({
      GH_TOKEN: '',
      GITHUB_TOKEN: 'ghp_y',
    });

    expect(token).toBe('ghp_y');
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('tier 2 wins: with no env token, the gh CLI token on stdout at exit 0 resolves (FOUND-02)', async () => {
    programSpawn((file) =>
      fakeChild(file === 'gh' ? { stdout: 'ghp_fromgh\n', code: 0 } : {}),
    );

    const token = await resolveLocalReadToken({});

    expect(token).toBe('ghp_fromgh');
  });

  it('tier 2 non-zero exit falls through to tier 3 (FOUND-02)', async () => {
    programSpawn((file) =>
      fakeChild(
        file === 'gh'
          ? { code: 1 }
          : { stdout: 'password=ghp_fromgit\n', code: 0 },
      ),
    );

    const token = await resolveLocalReadToken({});

    expect(token).toBe('ghp_fromgit');
  });

  it('tier 2 missing binary (ENOENT error event) falls through to tier 3 (FOUND-02)', async () => {
    programSpawn((file) =>
      fakeChild(
        file === 'gh'
          ? { errorEvent: true }
          : { stdout: 'password=ghp_fromgit\n', code: 0 },
      ),
    );

    const token = await resolveLocalReadToken({});

    expect(token).toBe('ghp_fromgit');
  });

  it('tier 2 exit 0 with rich stderr but EMPTY stdout falls through -- stderr is never consulted (FOUND-02)', async () => {
    // Non-vacuous: gh exits 0 but prints only stderr. If the wrapper read stderr
    // (or treated exit 0 as success regardless of stdout), the resolved token
    // would be the stderr text; it must instead fall through to tier 3.
    programSpawn((file) =>
      fakeChild(
        file === 'gh'
          ? {
              stderr: 'no oauth token found for github.com',
              stdout: '',
              code: 0,
            }
          : { stdout: 'password=ghp_fromgit\n', code: 0 },
      ),
    );

    const token = await resolveLocalReadToken({});

    expect(token).toBe('ghp_fromgit');
  });

  it('tier 3 wins: git credential fill password on stdout at exit 0 resolves (FOUND-02)', async () => {
    programSpawn((file) =>
      fakeChild(
        file === 'gh'
          ? { code: 1 }
          : {
              stdout:
                'protocol=https\nhost=github.com\nusername=x\npassword=ghp_cred\n',
              code: 0,
            },
      ),
    );

    const token = await resolveLocalReadToken({});

    expect(token).toBe('ghp_cred');
  });

  it('tier 3 exit 0 with no password= line resolves undefined -- all tiers exhausted (FOUND-02)', async () => {
    programSpawn((file) =>
      fakeChild(
        file === 'gh'
          ? { code: 1 }
          : {
              stdout: 'protocol=https\nhost=github.com\nusername=x\n',
              code: 0,
            },
      ),
    );

    const token = await resolveLocalReadToken({});

    expect(token).toBeUndefined();
  });

  it('every tier exhausted resolves undefined with no anonymous fallback, spawning only gh then git (FOUND-02, D-09)', async () => {
    programSpawn((file) =>
      fakeChild(file === 'gh' ? { code: 1 } : { code: 128 }),
    );

    const token = await resolveLocalReadToken({});

    expect(token).toBeUndefined();
    // Exactly two spawns: gh (tier 2) then git credential (tier 3). No third
    // attempt and no anonymous/network fallback after the chain is exhausted.
    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(spawnMock.mock.calls[0]?.[0]).toBe('gh');
    expect(spawnMock.mock.calls[1]?.[0]).toBe('git');
  });

  it('spawns git credential fill hardened: shell false, bounded numeric timeout, windowsHide, prompts and askpass neutralised (FOUND-02, T-03-10)', async () => {
    programSpawn((file) =>
      fakeChild(
        file === 'gh'
          ? { code: 1 }
          : { stdout: 'password=ghp_cred\n', code: 0 },
      ),
    );

    await resolveLocalReadToken({});

    const gitCall = spawnMock.mock.calls.find((call) => call[0] === 'git');

    expect(gitCall).toBeDefined();
    expect(gitCall?.[1]).toEqual(['credential', 'fill']);

    const options = gitCall?.[2] as {
      shell?: boolean;
      timeout?: number;
      windowsHide?: boolean;
      env?: Record<string, string>;
    };

    expect(options.shell).toBe(false);
    expect(typeof options.timeout).toBe('number');
    expect(options.timeout).toBe(HELPER_TIMEOUT_MS);
    expect(options.windowsHide).toBe(true);
    expect(options.env?.GIT_TERMINAL_PROMPT).toBe('0');
    expect(options.env?.GIT_ASKPASS).toBe('');
    expect(options.env?.SSH_ASKPASS).toBe('');
  });

  it('writes the git credential request as key-value lines terminated by a blank line (FOUND-02)', async () => {
    let gitChild: FakeChild | undefined;

    programSpawn((file) => {
      const child = fakeChild(
        file === 'gh'
          ? { code: 1 }
          : { stdout: 'password=ghp_cred\n', code: 0 },
      );

      if (file === 'git') {
        gitChild = child;
      }

      return child;
    });

    await resolveLocalReadToken({});

    expect(gitChild?.stdin.end).toHaveBeenCalledWith(
      'protocol=https\nhost=github.com\n\n',
    );
  });

  it('never mutates process.env while resolving through the subprocess tiers (FOUND-02)', async () => {
    const before = JSON.stringify(process.env);

    programSpawn((file) =>
      fakeChild(
        file === 'gh'
          ? { code: 1 }
          : { stdout: 'password=ghp_cred\n', code: 0 },
      ),
    );

    await resolveLocalReadToken({});
    await resolveLocalReadToken({ GH_TOKEN: 'ghp_x' });

    expect(JSON.stringify(process.env)).toBe(before);
  });
});

describe('resolveRepoIdentity origin remote and env override (FOUND-02)', () => {
  it('a well-formed GITHUB_REPOSITORY override wins with no git spawned (FOUND-02, D-10)', async () => {
    const repo = await resolveRepoIdentity({
      GITHUB_REPOSITORY: 'op-nx/github-cache',
    });

    expect(repo).toBe('op-nx/github-cache');
    // Non-vacuous: proves the override short-circuit -- a valid override never
    // consults the git remote.
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('an override failing the owner/name shape is ignored and the git remote is consulted instead (FOUND-02, D-10)', async () => {
    programSpawn(() =>
      fakeChild({
        stdout: 'https://github.com/op-nx/from-remote.git\n',
        code: 0,
      }),
    );

    const repo = await resolveRepoIdentity({ GITHUB_REPOSITORY: 'not-a-repo' });

    // Non-vacuous: the malformed override must NOT be returned; the parsed remote
    // identity is, proving the shape check gates the override rather than trusting it.
    expect(repo).toBe('op-nx/from-remote');
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it('parses an https origin remote to owner/name WITH the .git suffix (FOUND-02, D-10)', async () => {
    programSpawn(() =>
      fakeChild({
        stdout: 'https://github.com/op-nx/github-cache.git\n',
        code: 0,
      }),
    );

    const repo = await resolveRepoIdentity({});

    expect(repo).toBe('op-nx/github-cache');
  });

  it('parses an https origin remote to owner/name WITHOUT the .git suffix (FOUND-02, D-10)', async () => {
    programSpawn(() =>
      fakeChild({ stdout: 'https://github.com/op-nx/github-cache\n', code: 0 }),
    );

    const repo = await resolveRepoIdentity({});

    expect(repo).toBe('op-nx/github-cache');
  });

  it('parses an scp-like ssh origin remote to the same owner/name (FOUND-02, D-10)', async () => {
    programSpawn(() =>
      fakeChild({ stdout: 'git@github.com:op-nx/github-cache.git\n', code: 0 }),
    );

    const repo = await resolveRepoIdentity({});

    expect(repo).toBe('op-nx/github-cache');
  });

  it('resolves undefined for a remote whose host is not GitHub -- never a guess (FOUND-02, D-10)', async () => {
    // Non-vacuous: a non-GitHub host is well-formed as a URL but must not resolve
    // into another host's owner/name; guessing would read into a foreign namespace.
    programSpawn(() =>
      fakeChild({
        stdout: 'https://gitlab.com/op-nx/github-cache.git\n',
        code: 0,
      }),
    );

    const repo = await resolveRepoIdentity({});

    expect(repo).toBeUndefined();
  });

  it('resolves undefined when the git remote child exits non-zero (FOUND-02, D-10)', async () => {
    programSpawn(() => fakeChild({ code: 1 }));

    const repo = await resolveRepoIdentity({});

    expect(repo).toBeUndefined();
  });

  it('resolves undefined when the git binary is absent (ENOENT error event) (FOUND-02, D-10)', async () => {
    programSpawn(() => fakeChild({ errorEvent: true }));

    const repo = await resolveRepoIdentity({});

    expect(repo).toBeUndefined();
  });

  it('never mutates process.env across override and git-remote resolutions (FOUND-02)', async () => {
    const before = JSON.stringify(process.env);

    programSpawn(() =>
      fakeChild({
        stdout: 'https://github.com/op-nx/github-cache.git\n',
        code: 0,
      }),
    );

    await resolveRepoIdentity({ GITHUB_REPOSITORY: 'op-nx/github-cache' });
    await resolveRepoIdentity({});

    expect(JSON.stringify(process.env)).toBe(before);
  });
});
