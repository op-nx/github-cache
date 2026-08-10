import { readdirSync, readFileSync } from 'node:fs';

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
 * Successful reads, keyed on the relative path string exactly as the caller spelled it.
 *
 * NO INVALIDATION, and the soundness is MEASURED rather than assumed. `readRepoFile` is
 * anchored on `import.meta.url`, and the complete set of filesystem writers anywhere under
 * the package source tree is five files -- every one of which writes under `.nx/cache` or the
 * OS temp directory, both disjoint from the read set (`nx.json`, `package.json`, the package
 * manifests, `README.md`, `.gitattributes`, `ppe/action.yml`, the workflows, `docs/**`, and
 * `.ts` sources). Nothing under `.nx/` is ever read through here.
 *
 * THE ONE NEAR-MISS, named explicitly because it is the shape that would falsify the above:
 * one writer does create a file called `nx.json`, but it targets a `mkdtemp` directory under
 * `.nx/cache`, not the workspace-root `nx.json` that `readRepoFile('nx.json')` resolves.
 *
 * Every caller passes a constant literal, so no path normalisation is needed for the key to
 * be stable.
 *
 * SUCCESSFUL READS ONLY. See `readRepoFile` for why the miss path must stay uncached.
 */
const REPO_FILE_CACHE = new Map<string, string>();

/**
 * Read a repo-relative file as UTF-8. The three docs specs each authored this, byte for
 * byte, against three separately-computed roots -- and so did `lint-scope-drift.spec.ts` and
 * `public-surface.spec.ts`, which is why the claim above needed its scope stated. Both are
 * routed here now.
 *
 * MEMOIZED, because the callers are read-only content scans and several of them scan the
 * same tree: three specs loop over every package module, and `.github/workflows/ci.yml`
 * alone is read at four sites across four files.
 *
 * THE THROW ON A MISSING PATH IS PRESERVED, and it is load-bearing rather than incidental --
 * `docs-same-os-claims.spec.ts` documents relying on it. Caching SUCCESSFUL reads only is
 * what preserves it: a miss never enters the map, so the throw re-fires on every call. The
 * thrown error is deliberately NOT cached; that would be more code for no gain. Both
 * properties are pinned by controls in `repo-file.spec.ts`, added alongside this memo,
 * because a memo that cached a sentinel on the miss path would otherwise ship green.
 *
 * `repoFileUrl` is deliberately NOT memoized: it returns a MUTABLE `URL`, so handing one
 * instance to two callers would be a new aliasing hazard for no gain.
 *
 * Anchored on `import.meta.url`, never on `process.cwd()`: under `nx test` the merged
 * target configuration sets the cwd to the PROJECT root, and `workspace-root-cwd.ts`
 * additionally chdirs for the specs that need it -- so a cwd-relative read would resolve
 * differently depending on which hooks a spec happened to install.
 */
export function readRepoFile(relativePath: string): string {
  const cached = REPO_FILE_CACHE.get(relativePath);

  if (cached !== undefined) {
    return cached;
  }

  const contents = readFileSync(repoFileUrl(relativePath), 'utf8');

  REPO_FILE_CACHE.set(relativePath, contents);

  return contents;
}

/** The package source root, workspace-relative. */
export const PACKAGE_SOURCE_ROOT = 'packages/github-cache/src';

/**
 * Every entry under the package source root, recursively, as BARE root-relative paths with
 * the separator normalised, filtered by the caller's own predicate.
 *
 * THREE SPECS AUTHORED THIS WALK, and one of their own docstrings states the cost: three
 * copies of it are three chances to get the one correctness detail wrong in a way that makes
 * a guard silently scan nothing on one OS. The PREDICATE is the parameter because that is
 * where the three genuinely differ -- and they differ substantively, not by spelling: two
 * select non-spec `.ts`, the third selects every `.ts` outside this layer's own directory,
 * which is a DISJOINT set (it excludes non-spec modules here and includes every `.spec.ts`
 * elsewhere).
 *
 * ANCHORED ON `repoFileUrl`, so it does not depend on the process cwd. One of the three
 * copies walked a cwd-relative string literal and needed the workspace-root cwd hook to have
 * run; routing it here removes that dependency.
 *
 * BARE paths, not prefixed with the root. Two of the three callers want them bare; the one
 * that asserts on prefixed literals re-prefixes at its own call site, which is a smaller and
 * clearer contract than an options bag.
 *
 * The separator transform is a fixed, unconditional replace and deliberately NOT `node:path`'s
 * `sep`, which LINT-02/CORR-06 bans in a unit spec because it derives an expectation from the
 * running machine: `readdirSync` emits a backslash on Windows and a forward slash elsewhere,
 * so the same tree must yield the same array either way.
 */
export function packageSourceFiles(
  predicate: (file: string) => boolean,
): string[] {
  return readdirSync(repoFileUrl(PACKAGE_SOURCE_ROOT), {
    encoding: 'utf8',
    recursive: true,
  })
    .map((entry) => entry.replaceAll('\\', '/'))
    .filter(predicate);
}

/**
 * Every non-spec `.ts` module under the package source root -- the ONE predicate two of
 * `packageSourceFiles`'s callers share, authored once instead of twice.
 *
 * BARE root-relative paths, for the reason `packageSourceFiles` already records: the caller
 * that asserts on PREFIXED literals re-prefixes with `PACKAGE_SOURCE_ROOT` at its own call
 * sites, which is a smaller contract than an options bag. The two copies this replaces
 * differed by exactly that `.map`, so a shared helper had to pick a side; this is the side
 * the layer had already chosen.
 *
 * A FUNCTION, not a module-scope constant, because both callers walk lazily inside their own
 * `it` and nothing is gained by walking the tree at collection time.
 */
export function nonSpecModules(): string[] {
  return packageSourceFiles(
    (file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'),
  );
}

/**
 * Which of the FORBIDDEN import prefixes a leaf module's source actually imports from --
 * empty when the module really is a leaf.
 *
 * IT RETURNS THE MATCHES RATHER THAN ASSERTING, because nothing from vitest may be imported
 * here (the constraint the rest of this module records: `src/test/` is inside
 * `tsconfig.lib.json`'s `src/**` include). The caller asserts `toEqual([])`, which is the
 * conjunction of the per-prefix clauses it replaces and names the offending prefix on
 * failure instead of only the first one to trip.
 *
 * THE PREFIX LIST IS THE PARAMETER because that is where the two callers genuinely differ:
 * `mirror-seed.ts` forbids five prefixes, `cache-key.ts` four. A plain substring test, not a
 * regex, since every needle those copies used was a literal -- so there is no escaping to get
 * wrong.
 *
 * NOT A BLANKET REPLACEMENT for a leaf scan. `cache-archive-path.spec.ts` asserts an EXACT
 * import-list equality instead, which is strictly stronger -- it fails on a builder reached
 * through a module no forbidden list anticipated -- and is deliberately left alone.
 */
export function forbiddenLeafImports(
  source: string,
  forbiddenPrefixes: readonly string[],
): string[] {
  return forbiddenPrefixes.filter((prefix) =>
    source.includes(`from '${prefix}`),
  );
}

/**
 * The plain token a bracket-obfuscated needle is really looking for, DERIVED from the
 * needle's own source rather than spelled a second time.
 *
 * WHY THE DERIVATION EXISTS AT ALL. The callers assert that their subject does NOT contain
 * some token, and a guard like that is worthless if the needle has quietly stopped matching
 * anything. So each caller builds a non-vacuity fixture from this and checks the needle
 * trips on it. Deriving it means the fixture cannot drift away from the needle it is meant
 * to trip -- and the calling specs, whose whole discipline is that they spell nothing
 * verbatim, do not have to break that discipline to get a fixture.
 *
 * That discipline is why NO token is written out anywhere in this docstring either. The
 * helper now sits BETWEEN two specs that each carry the rule, so spelling an example here
 * would defeat both of them at once.
 *
 * TWO COPIES ARE REPLACED and this is the SUPERSET of them: same bracket removal, plus a
 * word-boundary-escape strip applied first. Measured before merging: neither needle in the
 * second caller contains a word-boundary escape, so the extra strip is a no-op there and both
 * derived tokens are byte-identical to what the local copy produced.
 *
 * ITS POSITIVE CONTROL LIVES AT THE CALL SITES, deliberately, and it already exists: each
 * caller has a clause asserting that its needle matches the token derived from itself. That
 * is a stronger control than anything this module could assert about a token it must not
 * name, and this module's stated discipline -- a primitive without a positive control is the
 * defect one layer down -- is satisfied by it.
 */
export function probeTokenOf(needle: RegExp): string {
  return needle.source
    .replaceAll('\\b', '')
    .replaceAll('[', '')
    .replaceAll(']', '');
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
 * THIS PRIMITIVE WAS RE-AUTHORED IN EVERY SPEC THAT NEEDED IT, with three different marker
 * sets, all line-leading, and the copy backing the strongest claim in the package had NO
 * positive control. It is a primitive rather than a fact about any one module, which is why it
 * belongs here beside `stripYamlComments` rather than in the spec that happens to need it most.
 * Compose it the way the YAML one already established:
 * `stripLineComments(readRepoFile(path))`. (No copy count is spelled out: the first version of
 * this docstring said "five", the consolidation then turned out to have missed one, and the
 * number answers no reader's question.)
 *
 * HOW THE VIEW DIFFERS FROM THE COPIES IT REPLACED, measured rather than asserted, because
 * four callers shipped a claim of BYTE-IDENTITY that is false. This one drops BLANK lines and
 * none of the copies did. MEASURED across every subject, old local view vs this one:
 * `vitest.config.mts` 741 -> 739 chars, `vitest.integration.config.mts` 397 -> 395,
 * `lib/cache-key.ts` 559 -> 552, `lib/cache-archive-path.ts` 210 -> 207,
 * `lib/select-backend.ts` 1846 -> 1837, `lib/compression-method.ts` 451 -> 446,
 * `backend/actions-cache-backend.ts` 3658 -> 3634. In EVERY case the difference is dropped
 * blank lines and nothing else -- verified by comparing the blank-stripped old view against
 * this one, which is equal on all seven. So no needle asserted through this helper changes
 * verdict TODAY, because every one of them is single-line. DO NOT ADD A NEEDLE THAT SPANS A
 * BLANK LINE and expect the file's line structure back: it is not preserved here.
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
