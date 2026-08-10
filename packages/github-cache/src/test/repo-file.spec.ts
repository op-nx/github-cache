import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  readRepoFile,
  repoFileUrl,
  stripLineComments,
  stripYamlComments,
} from './repo-file.js';

/**
 * THE CONTROL SUITE FOR THE SHARED COMMENT STRIPPERS, and the reason it exists is the defect
 * it closes rather than coverage for its own sake.
 *
 * `stripLineComments` replaces five hand-authored copies of the same primitive. FOUR of them
 * carried a positive control of their own; the fifth -- the copy in `select-backend.spec.ts`
 * -- did not, and it backs the strongest claim in the package: that the guard reads the
 * comment-stripped source "so prose cannot satisfy or break it". A stripper with no control
 * is the same defect one layer down as a guard with no control: it reports "clean" exactly as
 * a correct file does.
 *
 * THREE FIXTURES, following `cache-archive-path.spec.ts`'s shape, plus the TRUNCATION controls
 * that make the opt-in trailing mode safe to offer at all. Those are not hypothetical, and
 * they run in BOTH directions: a blanket trailing `//` strip shortens any value carrying a URL
 * scheme, silently shrinking the text a clause matches against, while a strip that demands
 * whitespace before the marker leaves `code();// note` standing and lets prose satisfy a clause
 * with the code deleted. Both are false GREENs, both in the direction of the defect this
 * extraction is fixing, and each has its own clause below.
 */
const CODE_FIXTURE = [
  '// probeToken',
  '/* probeToken',
  ' * probeToken',
  ' */',
  "export const value = 'probeToken';",
].join('\n');

const COMMENT_ONLY_FIXTURE = [
  '// probeToken',
  '/* probeToken',
  ' * probeToken',
  ' */',
  'export const value = 1;',
].join('\n');

describe('stripLineComments keeps code and drops comments (T2-5)', () => {
  it('FIRES on a fixture carrying the token in CODE, even with the token also in comments', () => {
    expect(stripLineComments(CODE_FIXTURE)).toContain('probeToken');
  });

  it('stays SILENT when every occurrence is a comment -- the strip is real, not blind', () => {
    expect(stripLineComments(COMMENT_ONLY_FIXTURE)).not.toContain('probeToken');
  });

  it('keeps the code line itself, so a silent result is not an empty result', () => {
    expect(stripLineComments(COMMENT_ONLY_FIXTURE)).toContain(
      'export const value = 1;',
    );
  });

  it('drops every one of the four line-leading marker shapes', () => {
    const stripped = stripLineComments(
      ['// a', '/* b', ' * c', ' */', 'code();'].join('\n'),
    );

    expect(stripped).toBe('code();');
  });

  it('leaves a blank line behind for nothing, so a multi-line needle cannot match across one', () => {
    expect(
      stripLineComments(['code();', '', '// note', 'more();'].join('\n')),
    ).toBe(['code();', 'more();'].join('\n'));
  });
});

describe('stripLineComments does not TRUNCATE a value (T2-5 truncation controls)', () => {
  // THE CONTROL THAT MAKES THE OPT-IN MODE SAFE. Without the colon exception the trailing
  // strip cuts at the scheme separator, so a clause asserting on this line would be matching
  // against `const api = 'https:` -- shorter text than the file actually contains, which is a
  // false GREEN.
  const URL_LINE = "const api = 'https://api.github.com';";

  it('survives a URL scheme in the DEFAULT mode', () => {
    expect(stripLineComments(URL_LINE)).toBe(URL_LINE);
  });

  it('survives a URL scheme in the TRAILING mode too, because the marker excludes `://`', () => {
    expect(stripLineComments(URL_LINE, { trailing: true })).toBe(URL_LINE);
  });

  it('still removes a genuine trailing note in the TRAILING mode', () => {
    expect(
      stripLineComments("const flag = 'on'; // a legitimate note", {
        trailing: true,
      }),
    ).toBe("const flag = 'on';");
  });

  it('removes a trailing note that FOLLOWS a URL on the same line', () => {
    expect(
      stripLineComments(`${URL_LINE} // and a note`, { trailing: true }),
    ).toBe(URL_LINE);
  });

  it('leaves a trailing note alone in the DEFAULT mode, which four callers rely on', () => {
    const line = "const flag = 'on'; // a legitimate note";

    expect(stripLineComments(line)).toBe(line);
  });

  // THE OTHER DIRECTION, and it is the one that shipped uncontrolled. An earlier trailing
  // marker required a preceding SPACE, so this shape was not stripped at all -- and the caller
  // that opts in claims prose can neither satisfy NOR break its assertions. A comment naming
  // the very token that caller matches on, written with no space, would survive into the
  // "comment-stripped" view and satisfy the clause with the code deleted: the exact false
  // GREEN the trailing mode exists to close, one character away. The residual was held shut
  // only by `format:check` inserting the space, which is a load-bearing dependency on an
  // unrelated gate. Now it is held shut by this clause.
  it('removes a trailing note with NO space before the marker', () => {
    expect(
      stripLineComments("const flag = 'on';// a note with no leading space", {
        trailing: true,
      }),
    ).toBe("const flag = 'on';");
  });

  // The colon exception is what keeps the URL intact, so it is pinned as the DISCRIMINATOR
  // rather than left implicit in the URL clauses above: only `://` is spared, and a `//`
  // after any other character is a comment.
  it('strips after a non-whitespace, non-colon boundary but not after a colon', () => {
    expect(
      stripLineComments(
        ['const a = 1;// note', "const b = 'x://y';"].join('\n'),
        { trailing: true },
      ),
    ).toBe(['const a = 1;', "const b = 'x://y';"].join('\n'));
  });
});

describe('stripYamlComments does not TRUNCATE a hash-bearing value (T2-5)', () => {
  // The sibling primitive's own truncation control. It is LINE-LEADING only, which is exactly
  // what keeps a shell or YAML value carrying a hash character intact -- and this is the
  // clause that would redden if someone "improved" it into a trailing strip.
  it('keeps a value containing a hash character', () => {
    const line = '          key: nx-cache-#not-a-comment';

    expect(stripYamlComments(line)).toBe(line);
  });

  it('still drops a line-leading YAML comment', () => {
    expect(stripYamlComments(['# a note', 'key: value'].join('\n'))).toBe(
      'key: value',
    );
  });
});

describe('readRepoFile resolves from the workspace root (T4-6)', () => {
  // The positive control for the layer T4-6's docstring claims to be canonical FOR: a wrong
  // root throws rather than returning something plausible, so this reads a file only the
  // workspace root has.
  it('reads a workspace-root file, proving the four-levels-up walk lands where it claims', () => {
    expect(readRepoFile('nx.json')).toContain('targetDefaults');
  });
});

/**
 * The package source root, workspace-relative. Read through `repoFileUrl` rather than as a
 * cwd-relative literal, for the reason `readRepoFile`'s own docstring gives: this suite
 * installs no cwd hook, so a cwd-relative walk would resolve differently here than in the
 * specs that do.
 */
const PACKAGE_SOURCE_ROOT = 'packages/github-cache/src';

/**
 * The specs that author their OWN walk up to the workspace root instead of importing this
 * layer. Named ONCE, and set-asserted below rather than described in prose.
 *
 * THE LAYER IS NOT CLAIMED TO BE REPO-WIDE, and this list is what makes the scope honest
 * instead of merely stated. Each of these reaches a workspace-root file directly, and leaving
 * them alone was the deliberate call: the defect T4-6 fixed was a FALSE canonical claim plus a
 * duplicated READER, not a repo-wide sweep, and rewriting six unrelated specs to prove a
 * docstring is the speculative restructuring this project's retrospective penalises by name.
 *
 * WHY IT IS ASSERTED RATHER THAN WRITTEN DOWN. This set first shipped as a hand-authored count
 * plus a hand-authored list inside `WORKSPACE_ROOT_URL`'s docstring, and the list was wrong in
 * BOTH directions -- it named `docs-cross-os.spec.ts`, whose only occurrence of the idiom is
 * inside a comment (it routes through this layer), and it omitted
 * `lib/release-asset-name.spec.ts`, which authored a real four-level walk to read
 * `.gitattributes` while citing as its precedent a file this same pass had already routed
 * through the layer. A docstring whose stated purpose is that contributors trust it without
 * checking cannot carry an unguarded list. So the docstring points here, and this clause
 * derives the real set from the tree.
 */
const WORKSPACE_ROOT_WALK_EXCEPTIONS = [
  'consumer-action-runtime.spec.ts',
  'docs-trust.spec.ts',
  'governance-docs.spec.ts',
];

/**
 * Every `.ts` module under the package source root except this layer's own directory, as
 * workspace-relative paths with the separator normalised.
 *
 * The separator transform is a fixed, unconditional replace and deliberately NOT `node:path`'s
 * `sep`, which LINT-02/CORR-06 bans in a unit spec because it derives an expectation from the
 * running machine: `readdirSync` emits `\` on Windows and `/` elsewhere, so the same tree must
 * yield the same array either way.
 */
function packageModules(): string[] {
  return readdirSync(repoFileUrl(PACKAGE_SOURCE_ROOT), {
    encoding: 'utf8',
    recursive: true,
  })
    .map((entry) => entry.replaceAll('\\', '/'))
    .filter((file) => file.endsWith('.ts') && !file.startsWith('test/'));
}

/** How many `../` a module needs to reach the workspace root from its own directory. */
function levelsToWorkspaceRoot(file: string): number {
  return 3 + (file.split('/').length - 1);
}

describe('the layer names its own exceptions correctly (T4-6)', () => {
  // DERIVED FROM THE TREE, COMMENT-STRIPPED, and both halves matter. Derived, so the set cannot
  // rot the way the deleted hand-authored list did. Comment-stripped, because a PROSE mention of
  // the idiom is what put a false member on that list -- `docs-cross-os.spec.ts` describes the
  // walk in its header and routes through this layer in its code, and an unstripped scan reads
  // the description as the deed.
  it('lists exactly the specs that author their own workspace-root walk', () => {
    const authorsOwnWalk = packageModules()
      .filter((file) => {
        const code = stripLineComments(
          readRepoFile(`${PACKAGE_SOURCE_ROOT}/${file}`),
        );
        const walk = new RegExp(
          `new URL\\(\\s*(?:\`|')(?:\\.\\./){${levelsToWorkspaceRoot(file)}}`,
        );

        return walk.test(code);
      })
      .sort();

    expect(
      authorsOwnWalk,
      "The set of specs authoring their own workspace-root walk has changed, so WORKSPACE_ROOT_URL's " +
        'scoped canonical claim no longer matches the tree. If a spec was ROUTED through the ' +
        'layer, drop it from WORKSPACE_ROOT_WALK_EXCEPTIONS here in the same commit. If a NEW ' +
        'spec authored its own walk, prefer routing it through `readRepoFile`/`repoFileUrl` -- ' +
        'a fourth authored walk is the duplication T4-6 removed. Adding the name here to get ' +
        'green is the last resort and needs a stated reason, because this list IS the honesty ' +
        "of the docstring's scope.",
    ).toEqual([...WORKSPACE_ROOT_WALK_EXCEPTIONS].sort());
  });

  // NON-VACUITY, and it is not decoration: the derivation above walks the tree and builds a
  // regex per file, so a broken walk, a wrong root or an over-narrow pattern all produce an
  // EMPTY array -- which would compare equal to an emptied list and report the layer as
  // canonical everywhere. This clause fails first, and says which of the two went wrong.
  it('walks a non-empty tree, so an empty exception set cannot pass as agreement', () => {
    expect(
      packageModules().length,
      'the package source walk found no .ts modules at all, so every derived set below is ' +
        'vacuous -- fix the walk, never the expectation',
    ).toBeGreaterThan(0);
    expect(
      WORKSPACE_ROOT_WALK_EXCEPTIONS.length,
      'WORKSPACE_ROOT_WALK_EXCEPTIONS is empty. If the last authored walk was genuinely ' +
        "routed through this layer, then WORKSPACE_ROOT_URL's docstring can drop its scope " +
        'qualification and claim to be canonical outright -- do that deliberately rather than ' +
        'leaving a scoped claim with nothing to scope against.',
    ).toBeGreaterThan(0);
  });
});
