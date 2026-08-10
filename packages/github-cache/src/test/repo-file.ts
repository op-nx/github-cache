import { readFileSync } from 'node:fs';

/**
 * The workspace root: the ONE authored copy of the walk FOR THE SPECS THAT READ THROUGH THIS
 * LAYER.
 *
 * THE QUALIFICATION IS DELIBERATE and the unqualified claim was false. This docstring used to
 * assert flatly that it is the one authored copy while THREE constants of that name existed in
 * the package and two further sites re-implemented `readRepoFile`'s body verbatim. All of those
 * are routed through here now, so the claim holds of this layer -- but a set of specs still
 * author a levels-up walk of their own, and they are deliberately out of scope: the defect was
 * the false claim plus the duplicate READER, not a repo-wide sweep. So the claim is scoped to
 * what it can honestly cover. Weakening it further -- or dropping the qualification and letting
 * it be false again -- is worse than no helper, because the next contributor believes the layer
 * is canonical and does not check.
 *
 * THAT EXCEPTION SET IS NOT SPELLED OUT HERE, and its absence is the point. The first version
 * of this paragraph hand-authored a count and a list, and the list was wrong in BOTH
 * directions: it named a file whose only occurrence of the idiom is inside a comment (so it
 * routes through this layer after all), and it omitted one that authored a real four-level walk
 * and never imported the layer at all -- exactly the reading a contributor would trust without
 * checking, which is this docstring's own stated hazard. A hand-authored list rots the same way
 * a hand-authored count does. The set is DERIVED BY SEARCH and asserted by set equality in
 * `repo-file.spec.ts`, which is where to look and which reddens naming which file drifted.
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

/**
 * The trailing marker: a `//` that is NOT preceded by a colon, plus any whitespace in front of
 * it and everything after it.
 *
 * THE DISCRIMINATOR IS THE COLON, not whitespace, and that correction closed a real
 * false-GREEN shape. Requiring a preceding SPACE kept `https://` intact -- but it also left
 * `code();// note` completely unstripped, which reopens the hole the trailing mode exists to
 * close: a comment naming the very token a caller's clause matches on would survive into the
 * "comment-stripped" view and satisfy the clause with the code gone. That shape was
 * uncontrolled and prevented today only by `format:check` (Prettier inserts the space), which
 * is a load-bearing dependency on an unrelated gate. The colon lookbehind needs no such help:
 * `://` is the URL scheme separator and is the only reason the whitespace rule was there.
 *
 * TWO RESIDUALS, stated rather than discovered: a PROTOCOL-RELATIVE URL literal (`'//cdn...'`)
 * is truncated, and a `//` written directly after a colon in non-URL code is not stripped.
 * Neither shape exists in any caller's subject, and `repo-file.spec.ts` pins both the URL
 * survival and the no-space strip so a regression in either direction reddens.
 */
const TRAILING_COMMENT = /\s*(?<!:)\/\/.*$/;

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
 * THE TRAILING MODE IS OPT-IN, and it strips any `//` NOT preceded by a colon. That is what
 * makes `https://example.com` survive intact while both ` // a note` and `;// a note` are
 * removed, and it is the whole reason the mode is safe to offer at all. A bare `//` needle
 * would truncate at the scheme separator; a whitespace-anchored one leaves the no-space shape
 * standing, which is a false GREEN in the other direction. See `TRAILING_COMMENT` for the two
 * residuals and the controls that pin them. Only a caller whose CLAIM is that prose can
 * neither satisfy nor break its assertions needs this mode; everything else is better served
 * by the default.
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
      return trailing ? line.replace(TRAILING_COMMENT, '') : line;
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
