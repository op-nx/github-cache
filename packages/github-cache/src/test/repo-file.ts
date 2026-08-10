import { readFileSync } from 'node:fs';

/**
 * The workspace root: the ONE authored copy of the walk FOR THE SPECS THAT READ THROUGH THIS
 * LAYER.
 *
 * THE QUALIFICATION IS DELIBERATE and the unqualified claim was false. This docstring used to
 * assert flatly that it is the one authored copy while THREE constants of that name existed in
 * the package and two further sites re-implemented `readRepoFile`'s body verbatim. All five are
 * routed through here now, so the claim holds of this layer -- but six OTHER specs still author
 * a levels-up walk of their own (`capture-hashes-cli`, `consumer-action-runtime`,
 * `docs-cross-os`, `governance-docs`, `hash-parity/compare`,
 * `read-integration-hash.integration`), and they are deliberately out of scope: the defect was
 * the false claim plus the duplicate READER, not a repo-wide sweep. So the claim is scoped to
 * what it can honestly cover. Weakening it further -- or dropping the qualification and letting
 * it be false again -- is worse than no helper, because the next contributor believes the layer
 * is canonical and does not check.
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
 * byte, against three separately-computed roots -- and so did `lint-scope-drift.spec.ts` and
 * `public-surface.spec.ts`, which is why the claim above needed its scope stated. Both are
 * routed here now.
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

/**
 * The JS/TS comment markers a LINE-LEADING strip removes. The bare asterisk already subsumes
 * the block-comment CLOSER, since a trimmed line opening with the closer opens with an
 * asterisk -- which is why the five copies this replaces were equivalent despite spelling
 * three different marker sets. (The closer is not written out in this docstring for the
 * obvious reason.)
 */
const LINE_COMMENT_MARKERS = ['//', '/*', '*/', '*'] as const;

/** The trailing marker, and the one space that has to precede it. See `stripLineComments`. */
const TRAILING_COMMENT_MARKER = ' //';

/**
 * A JS/TS source with its comments removed, so a content guard cannot be satisfied -- or
 * broken -- by prose.
 *
 * THIS PRIMITIVE EXISTED IN FIVE COPIES with three different marker sets, all line-leading,
 * and the copy backing the strongest claim in the package had NO positive control. It is a
 * primitive rather than a fact about any one module, which is why it belongs here beside
 * `stripYamlComments` rather than in the spec that happens to need it most. Compose it the
 * way the YAML one already established: `stripLineComments(readRepoFile(path))`.
 *
 * LINE-LEADING IS THE DEFAULT, and that is a deliberate narrowing rather than the lazy
 * option. Four of the five copies need exactly this, and a blanket trailing strip is
 * DANGEROUS in the same direction as the defect being fixed: a trailing `//` strip truncates
 * any value containing a URL scheme, silently shortening the text a clause matches against,
 * which is a false GREEN.
 *
 * THE TRAILING MODE IS OPT-IN, and it requires the marker to be preceded by WHITESPACE. That
 * is what makes `https://example.com` survive intact while ` // a note` is removed, and it is
 * the whole reason the mode is safe to offer at all. A bare `//` needle would truncate at the
 * scheme separator. Only a caller whose CLAIM is that prose can neither satisfy nor break its
 * assertions needs this mode; everything else is better served by the default.
 *
 * Blank lines are dropped in both modes -- a line that was nothing but a comment must not
 * leave an empty line behind that a multi-line needle could match across.
 *
 * NOTHING FROM VITEST is imported here, the same hard constraint the rest of this module
 * records: `src/test/` is inside `tsconfig.lib.json`'s `src/**` include, so a vitest import
 * would start emitting a vitest require into `dist`.
 */
export function stripLineComments(
  source: string,
  { trailing = false }: { trailing?: boolean } = {},
): string {
  return source
    .split('\n')
    .map((line) => {
      if (!trailing) {
        return line;
      }

      const at = line.indexOf(TRAILING_COMMENT_MARKER);

      return at < 0 ? line : line.slice(0, at);
    })
    .filter((line) => {
      const trimmed = line.trim();

      return (
        trimmed !== '' &&
        !LINE_COMMENT_MARKERS.some((marker) => trimmed.startsWith(marker))
      );
    })
    .join('\n');
}
