import { readFileSync } from 'node:fs';

/**
 * The workspace root, and the ONE authored copy of the four-levels-up walk.
 *
 * Four levels from `src/test/`: `src/` -> `github-cache/` -> `packages/` -> the workspace
 * root. `workspace-root-cwd.ts` next door IMPORTS this rather than recomputing it -- a
 * second authored root constant while consolidating a duplication would be the same defect
 * this module exists to remove.
 *
 * A URL, not a path string, because every consumer feeds it straight to `new URL(..., base)`
 * or to `readFileSync`. The one caller that needs a path (`process.chdir`) converts it
 * itself.
 */
export const WORKSPACE_ROOT_URL = new URL('../../../../', import.meta.url);

/**
 * A repo-relative path as a URL, for the callers that must probe EXISTENCE before reading
 * -- `docs-cross-os.spec.ts` guards an optional doc and
 * `windows-regression-detector.spec.ts` an optional workflow, and both need the URL rather
 * than the contents.
 */
export function repoFileUrl(relativePath: string): URL {
  return new URL(relativePath, WORKSPACE_ROOT_URL);
}

/**
 * Read a repo-relative file as UTF-8. The three docs specs each authored this, byte for
 * byte, against three separately-computed roots.
 *
 * Anchored on `import.meta.url`, never on `process.cwd()`: under `nx test` the merged
 * target configuration sets the cwd to the PROJECT root, and `workspace-root-cwd.ts`
 * additionally chdirs for the specs that need it -- so a cwd-relative read would resolve
 * differently depending on which hooks a spec happened to install.
 */
export function readRepoFile(relativePath: string): string {
  return readFileSync(repoFileUrl(relativePath), 'utf8');
}

/**
 * A YAML source with every line-leading `#` comment removed, so a content guard cannot be
 * satisfied by a comment. This idiom was authored five times across the workflow and
 * action specs.
 *
 * IT IS NOT A BLANKET REPLACEMENT for reading a workflow. `dogfood-cross-os.spec.ts`
 * deliberately re-reads `ci.yml` RAW at its injection scan, because the stripped view also
 * drops SHELL comments inside `run:` bodies and would blind that scan -- the reason is
 * recorded at that site. This helper covers the stripped view only.
 *
 * NOTHING FROM VITEST is imported here, and that is a hard constraint recorded at
 * `workspace-root-cwd.ts`: `src/test/` is inside `tsconfig.lib.json`'s `src/**` include, so
 * a vitest import would start emitting a vitest require into `dist`. Each caller wires its
 * own assertions; this stays a plain module.
 */
export function stripYamlComments(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}
