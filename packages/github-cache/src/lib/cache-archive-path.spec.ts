import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cacheArchivePath } from './cache-archive-path.js';
import type { Hash } from './cache-key.js';

// VER-01/VER-02, non-vacuous: the expected path below is spelled out as a string
// literal ON PURPOSE, not rebuilt from the same `nx-github-cache-${hash}.tar`
// template the implementation uses. A reconstructed expectation would still pass
// after a cosmetic rename of the path template -- which is exactly the change that
// silently MISSes every @actions/cache restore, because the toolkit version-hashes
// the literal path string into the cache version (Pitfall 7). Pinning the literal
// here is the only assertion that fails on that rename instead of failing silently
// in CI. This is the same discipline as server.spec.ts's MAX_CACHE_BODY_BYTES
// pinned-value test. Only the VALUE moved in Phase 9; the discipline is unchanged.
//
// WHY CLAUSE 2 (the source scan) CARRIES THE REAL WEIGHT. The `test` target runs on
// ubuntu ONLY today (ci.yml:337; the Windows legs are XOS-04, Phase 12). On ubuntu a
// reintroduced path builder renders the SAME string as the hand-authored literal, so
// clause 1 CANNOT catch it -- it would go green on the one OS that runs it and rotate
// the cache version for Windows consumers. Clause 2a scans the subject's
// comment-stripped source for the builder names, and clause 2b pins the import list by
// EQUALITY so a builder reached through a module this list never anticipated fails too.
//
// CORR-05 site 1 left with this rewrite: the LINT-02 opt-out block, the
// `eslint-disable-next-line no-restricted-imports` directive and the platform-module
// import that directive covered are all gone, because the archive directory is no
// longer the running machine's temp directory and there is nothing ambient to read.
// Its row in lint-rules.spec.ts's CORR_05_SITES is deleted in the SAME commit
// (reportUnusedDisableDirectives: 'error' makes a left-behind directive a build
// failure, and lineIndexOf makes a left-behind row a test failure).

const SUBJECT_LINES = readFileSync(
  new URL('./cache-archive-path.ts', import.meta.url),
  'utf8',
).split('\n');

// All FOUR markers, not just `//`. The three in-repo instances of this idiom
// (lint-scope-drift.spec.ts:233-238, cleanup-workflow.spec.ts:16-20,
// ppe-action.spec.ts:20-25) drop only `//` lines, and the subject's lock is a `/** */`
// block whose interior lines begin with `*`. Widening the filter is the smaller change
// and keeps the subject readable.
//
// COMMENT-LOCKED, because narrowing it back silently VACATES clause 2a: the subject's
// own lock discusses the banned builders in prose deliberately, so an unstripped scan
// would redden on the documentation instead of the code. The intended consequence is the
// other half of the same fact -- the implementation IS free to name the builders in its
// comment, and only THIS FILE's regex source has to be contorted.
const COMMENT_MARKERS = ['//', '/*', '*/', '*'] as const;

function isCommentLine(line: string): boolean {
  const trimmed = line.trim();

  return COMMENT_MARKERS.some((marker) => trimmed.startsWith(marker));
}

// Concatenated with `reduce` rather than the obvious Array-to-string method, because
// that method's NAME is one of the tokens this file must never spell verbatim -- see
// the bracket lock on FORBIDDEN below. Same reason the assertions never say the words.
function strippedSourceOf(lines: readonly string[]): string {
  return lines
    .filter((line) => !isCommentLine(line))
    .reduce((all, line) => `${all}\n${line}`, '');
}

const strippedSubject = strippedSourceOf(SUBJECT_LINES);

// Every needle wraps ONE character in a single-character character class. `[o]` matches
// `o`, so each regex behaves identically to its plain form -- but this file's SOURCE
// never contains any of the tokens verbatim, so a repo-wide search for one of them still
// returns only REAL occurrences rather than this guard's own needles.
//
// COMMENT-LOCKED, and the lock is written without spelling the tokens either. Phase 8
// recorded this trap after hitting it TWICE in one plan -- once inside the very sentence
// claiming the token was absent. A reader who "tidies" a bracket pair away breaks the
// searchability property without breaking the assertion, which is the harmless direction;
// a reader who spells a token in the prose breaks it silently, which is not.
//
// THE LAST THREE CLOSE THE GAP THE FIRST ELEVEN LEFT, and it was the widest one. The
// original list bans the path BUILDERS and the two named temp-directory reads, but the
// subject's own lock forbids something broader -- "reaching for" any machine-dependent
// value -- and the single most obvious way to do that was unlisted. A direct
// ambient-platform read needs no import at all, so the exact-import-list check (clause
// 2b) cannot see it either, and NEITHER can the workspace lint rule: eslint.config.mjs
// scopes the ambient-platform ban to `**/*.{test,spec}.*`, which is this file and not its
// subject. So a one-line branch on the running platform inside the ONE module whose
// literal IS the @actions/cache cache version would have passed every guard standing over
// it -- and it rotates the version on exactly one OS, which is the silent
// half-the-matrix MISS that Phase 9 spent itself removing.
//
// The broad one is deliberately broad: this module is a true leaf that must read NOTHING
// ambient, so the whole global is banned rather than the two accessors on it. The two
// narrow ones are kept alongside it because a bare destructured or renamed import reaches
// the accessor without naming the global.
//
// NOTE the case-sensitivity that makes the narrow pair safe here: the subject spells
// `CACHE_ARCHIVE_DIR` and `cacheArchivePath`, whose `ARCH`/`Arch` do not match a
// lowercase word-bounded needle. That is why both carry `\b` AND stay lowercase.
const FORBIDDEN = [
  /\bj[o]in\b/,
  /\bre[s]olve\b/,
  /n[o]rmalize/,
  /\bs[e]p\b/,
  /delimite[r]/,
  /tm[p]dir/,
  /h[o]medir/,
  /n[o]de:path/,
  /n[o]de:os/,
  /RUNNER_TEM[P]/,
  /isAbs[o]lute/,
  /\bpr[o]cess\b/,
  /\bpl[a]tform\b/,
  /\bar[c]h\b/,
] as const;

// The probe token is DERIVED from the needle's own source by removing the brackets and
// the word-boundary escapes, so the non-vacuity fixture cannot drift away from the thing
// it is meant to trip -- and this file still spells nothing verbatim.
function probeTokenOf(needle: RegExp): string {
  return needle.source
    .replaceAll('\\b', '')
    .replaceAll('[', '')
    .replaceAll(']', '');
}

describe('cacheArchivePath (VER-01, VER-02)', () => {
  it('returns exactly .nx/cache/nx-github-cache-abc123.tar for hash abc123 (VER-01)', () => {
    expect(cacheArchivePath('abc123' as Hash)).toBe(
      '.nx/cache/nx-github-cache-abc123.tar',
    );
  });

  it('is byte-identical for the same hash and differs for a different hash (VER-01)', () => {
    expect(cacheArchivePath('abc123' as Hash)).toBe(
      cacheArchivePath('abc123' as Hash),
    );
    expect(cacheArchivePath('abc123' as Hash)).not.toBe(
      cacheArchivePath('def456' as Hash),
    );
  });
});

describe('cache-archive-path.ts names no path builder and reads nothing ambient (VER-02 clause 2a)', () => {
  it.each(FORBIDDEN)(
    'the comment-stripped source matches no %s',
    (needle: RegExp) => {
      expect(
        needle.test(strippedSubject),
        `cache-archive-path.ts's CODE now matches ${needle.source}. VER-01 forbids building the archive path with a path builder or reading any ambient platform or temp-directory value: the literal must be byte-identical on win32 and linux, because @actions/cache hashes it into the cache version. Comments are stripped before this scan, so the subject's own comment lock is free to discuss the banned names -- this is a real code occurrence.`,
      ).toBe(false);
    },
  );
});

describe('cache-archive-path.ts imports EXACTLY the type-only Hash (VER-02 clause 2b)', () => {
  // Equality, NOT a not.toContain: an exact import list fails on a builder reached
  // through a module the FORBIDDEN list never anticipated, which is what makes clause 2a
  // robust rather than merely thorough. `[^;]*` spans newlines, so a reformatted
  // multi-line import statement is still matched as one statement.
  it('has one import statement and it is the type-only Hash from ./cache-key.js', () => {
    const statements = (strippedSubject.match(/import[^;]*;/g) ?? []).map(
      (statement) => statement.replace(/\s+/g, ' ').trim(),
    );

    expect(statements).toEqual(["import type { Hash } from './cache-key.js';"]);
  });
});

describe('the scanner FIRES on a fixture carrying the forbidden shape (VER-02 clause 2c)', () => {
  // MANDATORY non-vacuity control: a broken regex, an over-eager comment filter or a
  // mis-derived probe all pass clause 2a SILENTLY. This is the
  // filterUsingGlobPatterns-returns-everything lesson (nx-target-inputs.spec.ts:150-161)
  // one mechanism over -- assert the instrument can fire before trusting its silence.
  it.each(FORBIDDEN)('%s matches its own derived probe token', (needle) => {
    expect(needle.test(probeTokenOf(needle))).toBe(true);
  });

  it.each(FORBIDDEN)(
    '%s fires on a fixture carrying the token in CODE, even with the token also in comments',
    (needle) => {
      const token = probeTokenOf(needle);
      const fixture = [
        `// ${token}`,
        `/* ${token}`,
        ` * ${token}`,
        ` */`,
        `export const probe = '${token}';`,
      ];

      expect(needle.test(strippedSourceOf(fixture))).toBe(true);
    },
  );

  it.each(FORBIDDEN)(
    '%s stays silent when EVERY occurrence is a comment -- so the strip is real, not the scan being blind',
    (needle) => {
      const token = probeTokenOf(needle);
      const fixture = [
        `// ${token}`,
        `/* ${token}`,
        ` * ${token}`,
        ` */`,
        'export const probe = 1;',
      ];

      expect(needle.test(strippedSourceOf(fixture))).toBe(false);
    },
  );
});
