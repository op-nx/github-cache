import { describe, expect, it } from 'vitest';
import {
  readRepoFile,
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
