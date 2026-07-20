import { spawn } from 'node:child_process';
// Import from the ./github-identity.js leaf, NOT ./select-backend.js: these two
// symbols were extracted there precisely to break the former
// releases-backend -> local-context -> select-backend -> releases-backend cycle.
// The leaf imports nothing back into this graph, so there is no import cycle and
// no temporal-dead-zone hazard. (select-backend re-exports both for its own callers.)
import {
  GITHUB_REPOSITORY_PATTERN,
  resolveGitHubToken,
} from './github-identity.js';

/**
 * Upper bound (milliseconds) on any single credential/context helper spawn.
 * A locked keychain or a network-probing credential helper would otherwise wedge
 * the developer's build indefinitely; the safe direction on a slow helper is a
 * cache MISS, not a hang. Exported so it is tunable without hunting for it.
 */
export const HELPER_TIMEOUT_MS = 5000;

/**
 * The single hardened spawn wrapper. Every credential/context helper call site --
 * gh auth token, git credential fill, git remote get-url -- routes through it.
 * Resolves the child's trimmed stdout on a clean exit, or undefined when the tool
 * is absent, fails, times out, or prints nothing.
 *
 * Discrimination is STRUCTURAL ONLY: a clean exit (code 0) plus non-empty trimmed
 * stdout. No stderr listener is attached at all -- helper failure stderr is
 * LOCALIZED to the system language (it came back in Danish on the probe machine),
 * so any stderr sentinel silently misfires for every non-English developer, and
 * stderr can additionally carry credential-adjacent material.
 *
 * The child error code is never inspected to decide: it is a NUMBER for a non-zero
 * exit but the STRING 'ENOENT' when the binary is missing, so it is overloaded and
 * every failure means the same thing to the caller -- this tier yielded nothing,
 * try the next.
 *
 * ponytail: one spawn wrapper for all three call sites, not execFile for two and
 * spawn for the one that needs stdin -- git credential fill needs stdin regardless,
 * so consolidating on spawn means one hardening surface and one mock shape at no
 * cost; the four load-bearing options are identical either way.
 */
function runHelper(
  file: string,
  args: readonly string[],
  stdin?: string,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const child = spawn(file, [...args], {
      // shell false: injection-safe. An explicit argv array is passed, never an
      // interpolated command string, and a native binary resolves from PATH with
      // no quoting even when its directory contains spaces.
      shell: false,
      // timeout: a hung helper (locked keychain, network probe) is killed rather
      // than allowed to wedge the build; the tier then degrades to a MISS.
      timeout: HELPER_TIMEOUT_MS,
      // windowsHide: no console window flash per spawn on Windows.
      windowsHide: true,
      // All three env keys are load-bearing TOGETHER: disabling terminal prompts
      // alone still let git reach for its askpass executable in the verified probe,
      // which can pop a modal dialog on a desktop and block the build. Spread over
      // a COPY of process.env -- process.env itself is never mutated.
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: '',
        SSH_ASKPASS: '',
      },
    });

    let stdoutText = '';

    child.stdout?.on('data', (chunk) => {
      stdoutText += chunk;
    });

    // Deliberately no stderr listener (see the doc block): discrimination is
    // structural only, and stderr is localized and credential-adjacent.

    child.on('error', () => {
      // The missing-binary shape (code 'ENOENT'). Treated identically to any other
      // failure: this tier yielded nothing.
      resolve(undefined);
    });

    child.on('close', (code) => {
      if (code === 0) {
        // || undefined (not ??) so an empty result falls through exactly as the
        // repo's other credential chains do (Pitfall 8).
        resolve(stdoutText.trim() || undefined);

        return;
      }

      resolve(undefined);
    });

    if (stdin !== undefined) {
      child.stdin?.end(stdin);
    }
  });
}

/**
 * Resolve a GitHub token from the developer's existing local auth, in D-08's fixed
 * tier order: env, then the gh CLI, then the git credential helper. Injectable env
 * bag with a process.env default (repo convention; keeps Function.length at 0).
 *
 * Reaching the end means every tier is exhausted and the answer is undefined. There
 * is deliberately NO anonymous fallback (FOUND-02, D-09): an unauthenticated request
 * cannot see a private repo and would silently bind this package to the 60/hr tier,
 * so the reader MISSES instead.
 */
export async function resolveLocalReadToken(
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | undefined> {
  // Tier 1: env only. Delegates to the UNCHANGED resolveGitHubToken -- it is
  // env-only by design, shared with the CI write path, and its || (not ??)
  // fallthrough is pinned by TEST-01. The subprocess tiers are NOT added to it.
  const fromEnv = resolveGitHubToken(env);

  if (fromEnv) {
    return fromEnv;
  }

  // Tier 2: the gh CLI. A logged-in gh prints the token on stdout at exit 0.
  const fromGhCli = await runHelper('gh', ['auth', 'token']);

  if (fromGhCli) {
    return fromGhCli;
  }

  // Tier 3 is LAST: it is the slowest and the only tier that can touch a keychain.
  // git credential fill speaks a key=value line protocol on both stdin and stdout,
  // the request terminated by a blank line.
  const credential = await runHelper(
    'git',
    ['credential', 'fill'],
    'protocol=https\nhost=github.com\n\n',
  );

  if (credential !== undefined) {
    // Take the password field structurally with an anchored multiline match over
    // the returned key=value lines -- never by position, never from stderr.
    const password = /^password=(.*)$/m.exec(credential)?.[1]?.trim();

    if (password) {
      return password;
    }
  }

  // Every tier exhausted -> undefined (reader MISSES). No anonymous fallback.
  return undefined;
}

/**
 * Resolve this repository's owner/name identity for the local read (D-10), in
 * order: a well-formed GITHUB_REPOSITORY override, else the origin git remote.
 * Injectable env bag with a process.env default (keeps Function.length at 0).
 *
 * An unparseable or absent identity resolves undefined -- the read then MISSES and
 * the code NEVER guesses a repository: a guess would resolve into some OTHER
 * repository's cache namespace, the same fail-closed hazard select-backend.ts
 * guards against on the write side.
 */
export async function resolveRepoIdentity(
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | undefined> {
  // Env override first, reusing the exported GITHUB_REPOSITORY_PATTERN rather than
  // a second copy of the owner/name shape. GITHUB_REPOSITORY is runner-injected and
  // simply absent on a developer machine, which is what makes the git remote the
  // normal local path. An override that fails the shape is ignored, not trusted.
  const override = env.GITHUB_REPOSITORY;

  if (override && GITHUB_REPOSITORY_PATTERN.test(override)) {
    return override;
  }

  const url = await runHelper('git', ['remote', 'get-url', 'origin']);

  if (url === undefined) {
    return undefined;
  }

  // Anchored to the URL start AND the github.com host boundary, matching ONLY the
  // two remote forms D-10 supports, the .git suffix optional:
  //   https://github.com/owner/repo(.git)
  //   git@github.com:owner/repo(.git)
  // The host anchor (^https://github.com/ or ^git@github.com:) is load-bearing
  // (T-03-11): a bare github.com substring match would misparse a URL that merely
  // EMBEDS github.com as a path segment on ANOTHER host (a corporate proxy mirror,
  // a crafted .git/config) into that segment's owner/repo, silently reading into a
  // foreign cache namespace. No match -> undefined -> MISS; the code never guesses.
  const match =
    /^(?:https:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^/]+?)(?:\.git)?$/.exec(
      url,
    );

  if (match === null) {
    return undefined;
  }

  return `${match[1]}/${match[2]}`;
}
