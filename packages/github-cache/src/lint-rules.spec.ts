import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ESLint, type Linter } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * LINT-05 / LINT-06 / CORR-06: the opt-out discipline is LIVE, not merely
 * configured.
 *
 * The failure mode this closes is the gap between a rule appearing in
 * `eslint.config.mjs` and that rule actually reaching a file. A rule can be
 * present and still fire on nothing -- a glob written in the wrong frame, a
 * config object placed where a later one overrides it, a plugin referenced under
 * the legacy prefix instead of the scoped one. Every one of those reads, from the
 * outside, as a clean build. So this guard instantiates ESLint's Node API against
 * the REAL root config and asserts the verdicts, rather than asserting that the
 * config file contains some text.
 *
 * Why not the obvious alternative. Reading `eslint.config.mjs` off disk and
 * regex-ing it for rule names is the cheaper guard, and it is what several other
 * specs in this repo do for YAML configs -- but it is the wrong tool HERE, because
 * the whole class of defect above survives it: the rule name is present in the
 * file in every one of those cases. `lintText` is the only mechanism that answers
 * "does this rule produce an error on this shape at this path", which is the
 * question LINT-05 and LINT-06 actually ask.
 *
 * The guard's honest limitation: `lintText` proves the rule fires for a SYNTHETIC
 * path, not that the `lint` TARGET is wired to run over the real tree. Nothing
 * here would notice if `nx.json` never registered the plugin, and the split is
 * deliberate -- this file must stay green in a commit where no `lint` target
 * exists yet.
 *
 * That other half is NOT closed by "the battery command itself", which is what
 * this comment used to claim. `npm run lint` is `nx run-many -t lint`, and
 * run-many with no matching target ANYWHERE prints "NX No tasks were run" and
 * EXITS 0 -- the battery command is precisely the thing that cannot see a
 * missing target. It is closed instead by the two assertions that can:
 * `nx-target-inputs.spec.ts` pins the `@nx/eslint/plugin` registration the
 * target is inferred from, and ci.yml's lint job requires the run to PRINT
 * "Successfully ran target lint" rather than merely exiting 0.
 *
 * LINT-02 (the ambient-platform ban) and LINT-03 (its RED-before-GREEN proof over
 * the evasion shapes and the extant CORR-05 sites) are the second half,
 * added by plan 07-02 below the opt-out assertions. Both halves share the
 * constructor and the non-vacuity control declared here.
 */

// From `src/*.spec.ts` the workspace root is THREE levels up: `src/` ->
// `packages/github-cache/` -> `packages/` -> the root. Resolved from
// `import.meta.url`, never `__dirname` and never `process.cwd()` -- the house
// convention at five existing sites. The reason is invocation-independence: a
// cwd-relative read resolves differently depending on the directory the runner
// was started from, so the same spec passes locally and fails under a different
// invocation.
//
// It is NOT because LINT-02 bans it, which is what this comment used to say.
// Measured: `export const v = process.cwd();` at a unit spec path reports
// NOTHING -- no selector reaches a CALL on `process` (P1 is constrained to
// platform|arch, P2 to computed access). Nor should it: CORR-06 is about
// deriving an expectation from the running MACHINE, and the working directory
// is a property of the invocation, not of the OS. Overstating the control's
// coverage in the very file that documents the control is a defect in this
// house's terms, so the claim is stated as convention.
const WORKSPACE_ROOT_URL = new URL('../../../', import.meta.url);
const WORKSPACE_ROOT = fileURLToPath(WORKSPACE_ROOT_URL);

const eslint = new ESLint({
  // Pinned explicitly rather than inherited. `cwd` participates in
  // `path.resolve(cwd, filePath)` before the config's globs are matched, so an
  // inherited cwd would make every fixture path below ambiguous. Pinning it to the
  // workspace root puts the fixture paths in the SAME frame the config's globs are
  // matched in (`basePath = dirname(eslint.config.mjs)`), which is what lets a
  // fixture path and a config glob be read side by side. It also terminates
  // ESLint's upward config search on hop zero.
  cwd: WORKSPACE_ROOT,
  // Already the default; set explicitly because the non-vacuity control below is
  // meaningless without it, and a later reader must be able to see that it is on.
  warnIgnored: true,
  // Deliberately NOT passing `overrideConfigFile`: the entire point is to load the
  // REAL root config. Deliberately NOT passing `overrideConfig` either -- it would
  // add a config object the product run does not have, and this guard would quietly
  // stop testing the shipped rule set while still passing.
});

// Fixture paths sit INSIDE the real project tree. They need not exist on disk --
// ESLint's config-status check is a pure path match with no `existsSync` -- but
// keeping them in-tree means each fixture also proves the path SHAPE that the
// plan-07-02 ban will be scoped to, rather than only proving a rule exists.
const UNIT_PATH = 'packages/github-cache/src/__lint_fixture__.spec.ts';
const INTEGRATION_PATH =
  'packages/github-cache/src/__lint_fixture__.integration.spec.ts';
// A path under the global `ignores` block, used ONLY by the control's own
// self-test below.
const IGNORED_PATH = 'packages/github-cache/dist/__lint_fixture__.spec.ts';

const ANY_VIOLATION = 'export const value: any = 1;\n';

// One-time toolchain warm-up, deliberately OUTSIDE any test's budget.
//
// `new ESLint()` above is cheap -- it defers everything. The FIRST `lintText` call
// is what loads the flat config and instantiates the TypeScript parser, and it was
// measured at 590-910ms on an idle workstation. Left unpaid, that cost lands on
// whichever test happens to run first, so CPU contention (`nx run-many -t
// typecheck,test`, or a CI runner with a dogfooded background sidecar alongside
// the target) can time that one test out -- surfacing as a FLAKY failure at an
// arbitrary location rather than as a slow import. `lint-scope-drift.spec.ts` hit
// exactly this and carries the same hook; this file is the same exposure and gets
// the same fix pre-emptively, its measured first-call cost being the same order.
//
// NO explicit timeout argument, and that is the considered value rather than an
// omission. A `beforeAll` hook is budgeted by `hookTimeout`, which defaults to
// 10_000ms -- `resolved.hookTimeout ??= resolved.browser.enabled ? 3e4 : 1e4`,
// vitest 4.1.10. It is NOT the 5_000ms an earlier version of this comment cited:
// 5_000 is `testTimeout`, the per-TEST budget, which is the budget that applied
// BEFORE the boot was hoisted out of the tests. Citing it here described the bug
// the hoist fixed rather than the budget the fixed code runs under. Against a
// 590-910ms boot the untouched default is already ~10x headroom, the normal margin
// for a contention flake, so the explicit 30_000 this hook used to carry bought no
// margin that matters and tripled the time a genuinely wedged config import takes
// to fail.
//
// Deliberately NOT fixed by raising `testTimeout` in `vitest.config.mts`: that
// would mask this class for every test in the repo, which is the opposite of what
// a phase about mechanical enforcement should do.
//
// The source is trivially clean and the result is discarded -- this hook asserts
// nothing, it only pays the boot. A throw here still fails the suite loudly.
beforeAll(async () => {
  await eslint.lintText('export const value = 1;\n', { filePath: UNIT_PATH });
});

/**
 * The ignore-warning shape: ESLint reports a path it considers `ignored` or
 * `unconfigured` as a single message with `severity: 1`, a NULL rule id, and -- the
 * part that matters -- NO position, because the message describes the whole file
 * rather than a location inside it.
 *
 * The position check is not belt-and-braces, it is load-bearing, and it was added
 * because the first version of this control without it was itself vacuous. An
 * UNUSED-DIRECTIVE report also carries a null rule id, and at ESLint 9's DEFAULT
 * `reportUnusedDisableDirectives` severity it is a `warn` -- so `severity 1 + null
 * ruleId` alone matches it too, and the control would misread a real LINT-06
 * finding as "this file was never linted". That is the precise failure the control
 * exists to prevent, reproduced inside the control. Filtering on the absent
 * position separates them cleanly: an unused-directive report always has a `line`,
 * an ignore result never does.
 */
function ignoreWarnings(messages: Linter.LintMessage[]): Linter.LintMessage[] {
  return messages.filter(
    (message) =>
      message.severity === 1 &&
      message.ruleId === null &&
      message.line === undefined,
  );
}

/**
 * Every assertion in this file routes through here, and none may read a lint
 * result without it.
 *
 * Non-vacuity control for the whole guard. ESLint returns ZERO messages for a path
 * it considers `ignored` or `unconfigured`, which is indistinguishable from "the
 * rule did not fire". A single typo in a fixture path -- a wrong extension, a
 * missing directory -- therefore turns every "no error here" assertion into a pass
 * for entirely the wrong reason, while the paired "error here" assertion fails
 * loudly and sends the reader off fixing the wrong thing. `warnIgnored` surfaces
 * that state as a warning this control rejects. It cannot mask a real finding: a
 * genuine rule violation always carries a non-null rule id.
 */
async function lintFixture(
  source: string,
  filePath: string,
): Promise<Linter.LintMessage[]> {
  const [result] = await eslint.lintText(source, { filePath });

  expect(
    ignoreWarnings(result.messages),
    `${filePath} was not linted -- ESLint reported it as ignored or unconfigured, so every verdict below would be vacuous`,
  ).toEqual([]);

  return result.messages;
}

function ruleIdsOf(messages: Linter.LintMessage[]): (string | null)[] {
  return messages.map((message) => message.ruleId);
}

describe('the non-vacuity control can itself fail', () => {
  // A control that never rejects anything is worth nothing, and this repo has
  // already shipped one that was itself vacuous (quick 260726-gok). So the control
  // gets its own test: lint a path the global `ignores` block removes, and assert
  // the exact state `lintFixture` exists to reject is genuinely reachable and
  // genuinely detected. Note this deliberately does NOT call `lintFixture` -- it is
  // testing the predicate that helper is built on.
  it('detects a path ESLint refused to lint, which is what makes every verdict below real', async () => {
    const [result] = await eslint.lintText(ANY_VIOLATION, {
      filePath: IGNORED_PATH,
    });

    expect(ignoreWarnings(result.messages)).toHaveLength(1);
    expect(ruleIdsOf(result.messages)).toEqual([null]);
  });
});

describe('an opt-out must say why (LINT-05)', () => {
  it('errors on a bare eslint-disable-next-line', async () => {
    const messages = await lintFixture(
      '// eslint-disable-next-line @typescript-eslint/no-explicit-any\n' +
        ANY_VIOLATION,
      UNIT_PATH,
    );

    expect(ruleIdsOf(messages)).toEqual([
      '@eslint-community/eslint-comments/require-description',
    ]);
  });

  it('accepts a described eslint-disable-next-line, and the disable still suppresses', async () => {
    const messages = await lintFixture(
      '// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixture: a real violation to suppress\n' +
        ANY_VIOLATION,
      UNIT_PATH,
    );

    expect(ruleIdsOf(messages)).toEqual([]);
  });

  it('errors on a bare @ts-expect-error', async () => {
    const messages = await lintFixture(
      '// @ts-expect-error\nexport const value: string = 1;\n',
      UNIT_PATH,
    );

    expect(ruleIdsOf(messages)).toEqual(['@typescript-eslint/ban-ts-comment']);
  });

  it('accepts a described @ts-expect-error', async () => {
    const messages = await lintFixture(
      '// @ts-expect-error -- fixture: the described form is the admissible one\nexport const value: string = 1;\n',
      UNIT_PATH,
    );

    expect(ruleIdsOf(messages)).toEqual([]);
  });

  // D-30 bans @ts-ignore outright rather than merely requiring a description,
  // because unlike @ts-expect-error it does nothing when the underlying error goes
  // away -- it cannot go stale loudly, so a description would not keep it honest.
  // Asserting BOTH forms error is what pins that stronger reading of the config.
  it('errors on @ts-ignore whether or not it carries a description', async () => {
    const bare = await lintFixture(
      '// @ts-ignore\nexport const value: string = 1;\n',
      UNIT_PATH,
    );
    const described = await lintFixture(
      '// @ts-ignore -- fixture: still banned, described or not\nexport const value: string = 1;\n',
      UNIT_PATH,
    );

    expect(ruleIdsOf(bare)).toEqual(['@typescript-eslint/ban-ts-comment']);
    expect(ruleIdsOf(described)).toEqual(['@typescript-eslint/ban-ts-comment']);
  });
});

describe('a stale opt-out fails the build (LINT-06)', () => {
  // The mechanism that forces each CORR-05 disable out TOGETHER with its violation
  // in Phases 9 and 10: delete the code but leave the disable and the build goes red.
  // Phase 9 exercised it for real on cache-archive-path.spec.ts's site.
  //
  // This one cannot assert on a rule id, because there is none to assert on --
  // an unused-directive report is emitted by the linter itself rather than by a
  // rule, so it carries `ruleId: null`. The assertion is therefore structural
  // (severity 2 + null rule id) rather than prose-coupled: the only other
  // null-rule-id message ESLint produces is the severity-1 ignore warning, which
  // `lintFixture` has already rejected by the time this runs.
  it('errors on a described disable sitting over a line that violates nothing', async () => {
    const messages = await lintFixture(
      '// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixture: suppresses nothing\n' +
        'export const value = 1;\n',
      UNIT_PATH,
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].ruleId).toBeNull();
    expect(messages[0].severity).toBe(2);
  });
});

describe('integration specs are linted, not exempted wholesale (CORR-06)', () => {
  // THE control that makes plan 07-02's "no ban error at the integration path"
  // assertions non-vacuous. Those assertions expect ZERO messages, which is also
  // exactly what an un-linted path returns. `lintFixture`'s ignore-warning check
  // rules out one way of getting there; this rules out the other, by proving a
  // DIFFERENT rule still fires at the same path. Together they establish that an
  // integration spec is fully linted and merely exempt from one config object --
  // which is D-17's `ignores`-beside-`files` semantics, as opposed to a standalone
  // `ignores` object that would globally un-lint the file.
  it('a non-ban rule still errors at an *.integration.spec.ts path', async () => {
    const messages = await lintFixture(ANY_VIOLATION, INTEGRATION_PATH);

    expect(ruleIdsOf(messages)).toEqual(['@typescript-eslint/no-explicit-any']);
  });

  // Presence control for the pair above: the same source at the unit path must
  // behave identically today. Once plan 07-02 lands the ban, these two paths start
  // to differ for the platform-read shapes ONLY -- and this assertion is what shows
  // the difference is the ban's doing rather than a scoping accident.
  it('and errors identically at a unit *.spec.ts path', async () => {
    const messages = await lintFixture(ANY_VIOLATION, UNIT_PATH);

    expect(ruleIdsOf(messages)).toEqual(['@typescript-eslint/no-explicit-any']);
  });
});

// ===========================================================================
// LINT-02 / LINT-03 / CORR-06 -- the ambient-platform-read ban (plan 07-02)
// ===========================================================================

/**
 * The two core rules the ban is built from (D-15). Every verdict below is
 * filtered down to THESE ids rather than read off the whole message list: a
 * fixture may legitimately trip an unrelated rule -- an unused binding, an
 * explicit `any` -- and folding those into the verdict would make an assertion
 * fail for a reason that has nothing to do with the ban, which is the opposite
 * of an attributable failure.
 */
const BAN_RULE_IDS: readonly string[] = [
  'no-restricted-imports',
  'no-restricted-syntax',
];

function banErrorsOf(messages: Linter.LintMessage[]): Linter.LintMessage[] {
  return messages.filter((message) =>
    BAN_RULE_IDS.includes(message.ruleId ?? ''),
  );
}

function banRuleIdsOf(messages: Linter.LintMessage[]): (string | null)[] {
  return ruleIdsOf(banErrorsOf(messages));
}

/**
 * D-21: the ban is proven against the EVASION shapes, not only against the shapes
 * that happen to exist in the tree today. A rule proven only against the cases that
 * already exist is proven against the easy half.
 *
 * Explicit-assertion-list style (the `public-surface.spec.ts:18-23` house rule):
 * each row carries its expected verdict as literal rule ids in report order --
 * ESLint sorts messages by position, so an import-shape id precedes a
 * syntax-shape id when the import is on the earlier line. An intentional change
 * to the rule set edits a row here, and that edit IS the reviewable diff.
 */
const EVASION_SHAPES = [
  {
    shape: 'process.platform, the primary member-expression form (P1)',
    source: 'export const value = process.platform;\n',
    expected: ['no-restricted-syntax'],
  },
  {
    shape: 'destructuring the platform binding out of the process object (P3)',
    source: 'export const { platform } = process;\n',
    expected: ['no-restricted-syntax'],
  },
  {
    // P3 reports at the DECLARATOR rather than at the read, which is the better
    // location anyway: the alias is where the ambient dependency enters.
    shape:
      'aliasing the process object and reading the member off the alias (P3)',
    source: 'const alias = process;\nexport const value = alias.platform;\n',
    expected: ['no-restricted-syntax'],
  },
  {
    shape: 'a named import of a banned accessor from the os module',
    source: "import { tmpdir } from 'node:os';\nexport const dir = tmpdir();\n",
    expected: ['no-restricted-imports'],
  },
  {
    // CAUGHT TWICE, and the first half is the load-bearing one: the imports rule
    // reports a namespace specifier regardless of the LOCAL binding name, which
    // is why P4's hardcoded name list is defence in depth rather than the only
    // thing standing between a namespace import and the cache.
    shape: 'a namespace import of the os module, caught by BOTH rules',
    source: "import * as os from 'node:os';\nexport const dir = os.tmpdir();\n",
    expected: ['no-restricted-imports', 'no-restricted-syntax'],
  },
  {
    // ONE TOKEN from the row above, and before `'default'` was added to the
    // accessor lists it reported NOTHING -- neither rule saw it. The imports
    // rule maps a default specifier to the synthetic name `'default'`, which
    // was not in either list, and P4/P5 only reach bindings literally named
    // os/nodeOs/path/nodePath. Caught by the IMPORTS rule alone, deliberately:
    // the point of listing `'default'` is that the ban no longer depends on
    // guessing what the contributor called the binding.
    shape:
      'a DEFAULT import of the os module under a non-conventional binding name',
    source: "import osx from 'node:os';\nexport const dir = osx.tmpdir();\n",
    expected: ['no-restricted-imports'],
  },
  {
    // The path half of the same hole, and the BARE specifier half of it too --
    // `paths` is an exact string lookup, so `os`/`path` are independent keys
    // from `node:os`/`node:path` and a fix applied to only one pair would leave
    // the other open.
    shape:
      'a DEFAULT import of the bare path module under a non-conventional binding name',
    source: "import p from 'path';\nexport const s = p.sep;\n",
    expected: ['no-restricted-imports'],
  },
  {
    shape: 'computed access to the process object through a runtime key (P2)',
    source: "const key = 'platform';\nexport const value = process[key];\n",
    expected: ['no-restricted-syntax'],
  },
  {
    // P2 bans COMPUTED indexing of process and its message blesses the dotted
    // form, which is right for `process.env.CI` and wrong for the keys that
    // describe the machine. `process.env.OS` is `Windows_NT` on Windows. This
    // repo's own notes reach for `env:RUNNER_OS` as an OS discriminator, so it
    // is a shape a contributor here is primed to write.
    shape: 'a dotted environment read of an OS discriminator (P8)',
    source: 'export const value = process.env.OS;\n',
    expected: ['no-restricted-syntax'],
  },
  {
    shape: 'a dotted environment read of RUNNER_OS (P8)',
    source: 'export const value = process.env.RUNNER_OS;\n',
    expected: ['no-restricted-syntax'],
  },
  {
    // RESEARCH C1, BLOCKING: `no-restricted-imports` at 9.39.5 has visitors for
    // static import and export declarations ONLY -- it has no ImportExpression
    // visitor and cannot see either of these. P6 is the only thing that closes
    // the dynamic form, and this row is the assertion that proves it.
    shape: 'a dynamic import of the os module and of the path module (P6 only)',
    source:
      "export async function loadOs() {\n  return await import('node:os');\n}\n" +
      "export async function loadPath() {\n  return await import('node:path');\n}\n",
    expected: ['no-restricted-syntax', 'no-restricted-syntax'],
  },
] as const;

/**
 * The other half of D-21, and the half a ban is most likely to get wrong. A rule
 * set that errors on everything is as useless as one that errors on nothing, and
 * three of these rows guard a specific narrowing that would be tempting to drop:
 * P1's non-computed constraint, P4/P5's property-name lists, and P6's source
 * constraint. All measured clean in RESEARCH G2.
 */
const FALSE_POSITIVE_CONTROLS = [
  {
    shape: "the canonical ALLOWED shape, cachePlatform('win32') (D-18)",
    source:
      "import { cachePlatform } from './lib/release-asset-name.js';\n" +
      "export const value = cachePlatform('win32');\n",
  },
  {
    shape:
      'a plain object literal carrying a platform-named property, read back',
    source:
      "const config = { platform: 'win32' };\n" +
      'export const value = config.platform;\n',
  },
  {
    // P2 bans computed indexing of `process` WHOLESALE, including
    // `process['env']`. This row pins the other side of that deliberate blast
    // radius: the dotted form stays legitimate.
    shape: 'an environment variable read through the dotted form on process',
    source: 'export const value = process.env.CI;\n',
  },
  {
    // Deliberately a LOCAL object rather than a namespace import of node:path:
    // `import * as path from 'node:path'` is itself an error (the imports rule
    // reports a namespace specifier whenever the entry lists importNames), which
    // is asserted as an evasion shape above. Isolating P5's property-name list is
    // what this row is for.
    shape: 'a join call on a path-named object, which P5 must not reach',
    source:
      "const path = { join: (...parts: string[]) => parts.join('/') };\n" +
      "export const value = path.join('a', 'b');\n",
  },
  {
    shape: 'a named import of two NON-banned path accessors',
    source:
      "import { basename, dirname } from 'node:path';\n" +
      "export const value = basename(dirname('/a/b'));\n",
  },
  {
    shape: 'a dynamic import of a LOCAL module, which P6 must not reach',
    source:
      "export async function load() {\n  return await import('./local.js');\n}\n",
  },
  {
    // The other side of `'default'`'s blast radius. `paths` is keyed on the
    // module SOURCE, so listing `'default'` bans the default export of node:os
    // and node:path and nothing else -- it is not a blanket "no default
    // imports" rule. This row is what would go red if someone widened it into
    // one, which would flag most of the ecosystem.
    shape:
      'a default import of a LOCAL module, which the os/path ban must not reach',
    source: "import local from './local.js';\nexport const value = local;\n",
  },
] as const;

describe('the ambient-platform-read ban fires at a unit spec path (LINT-02, LINT-03, D-21)', () => {
  for (const { shape, source, expected } of EVASION_SHAPES) {
    it(`catches ${shape}`, async () => {
      const messages = await lintFixture(source, UNIT_PATH);

      expect(banRuleIdsOf(messages)).toEqual([...expected]);
    });
  }
});

describe('the ban leaves legitimate adjacent shapes alone (LINT-02 false-positive controls)', () => {
  for (const { shape, source } of FALSE_POSITIVE_CONTROLS) {
    it(`does not fire on ${shape}`, async () => {
      const messages = await lintFixture(source, UNIT_PATH);

      expect(banRuleIdsOf(messages)).toEqual([]);
    });
  }
});

describe('the identical source at an *.integration.spec.ts path is exempt from the ban ONLY (CORR-06)', () => {
  // The direction pair. On its own each row here is the weakest kind of
  // assertion -- "zero errors" is also what an un-linted path returns -- so it is
  // admissible only with its two controls attached: `lintFixture` rejects the
  // ignored/unconfigured state, and the "a non-ban rule still errors at an
  // *.integration.spec.ts path" assertion above proves the file is fully linted
  // and merely exempt from ONE config object. That is D-17's ignores-beside-files
  // semantics, and it is exactly CORR-06's "the same APIs stay ALLOWED in
  // integration" rather than "integration is not linted".
  for (const { shape, source } of EVASION_SHAPES) {
    it(`allows ${shape}`, async () => {
      const messages = await lintFixture(source, INTEGRATION_PATH);

      expect(banRuleIdsOf(messages)).toEqual([]);
    });
  }
});

// ===========================================================================
// The ban's WIDTH (LINT-02, ME-01) -- behavioural, one path shape at a time
// ===========================================================================

/**
 * ME-01 widened the ban from `**\/*.spec.{ts,mts,cts}` to
 * `**\/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}` -- two name families and
 * eight extensions -- because the narrower form left `*.test.ts`, `*.spec.tsx`
 * and `*.spec.cjs` running as unit tests with the ban silently OFF.
 *
 * Everything ABOVE this line lints exactly ONE of those sixteen shapes,
 * `*.spec.ts`. The width itself was checked only two ways, and neither is a
 * committed assertion about BEHAVIOUR:
 *
 *   - `lint-scope-drift.spec.ts` compares the ESLint globs to the vitest globs
 *     as TEXT. It deliberately drops the path anchor, and its own header defers
 *     the behavioural half to this file: "proven live by `lint-rules.spec.ts`,
 *     which lints real in-tree paths through the ESLint Node API". That deferral
 *     was only true for `.spec.ts`.
 *   - The ME-01 fix and the security audit each MEASURED all eight extensions by
 *     hand and recorded a table. A hand measurement in a markdown file does not
 *     re-run.
 *
 * So these rows are the width, asserted. They catch what glob-text comparison
 * structurally cannot: a per-extension CONFIG INTERACTION that silences the ban
 * at one shape while every glob still reads correct. That is not hypothetical
 * here -- `*.spec.cjs` matches BOTH the `**\/*.cjs` override (which rewrites
 * `sourceType` and turns a rule off) and the ban block, and the two composing
 * rather than colliding is a property of their ORDER in the exported array,
 * which no glob comparison can see.
 *
 * The two lists are LITERAL and must stay literal. Deriving them from
 * `eslint.config.mjs` would make the guard agree with whatever the config says,
 * which is the vacuity this whole file exists to avoid: narrowing the glob would
 * narrow the test with it and stay green.
 */
const BAN_NAME_FAMILIES = ['spec', 'test'] as const;
const BAN_EXTENSIONS = [
  'js',
  'mjs',
  'cjs',
  'ts',
  'mts',
  'cts',
  'jsx',
  'tsx',
] as const;

/**
 * Deliberately NOT `export const` and deliberately not TypeScript-flavoured: it
 * has to parse identically at all eight extensions, and three of them are not
 * `sourceType: 'module'` -- `**\/*.cjs` is `commonjs` under the D-13 override, so
 * a top-level `export` is a PARSE error there rather than a lint verdict. The
 * unused binding trips `no-unused-vars` at the TS extensions; that is filtered
 * out by `banRuleIdsOf`, which is what that filter is for.
 */
const AMBIENT_PLATFORM_READ = 'const platformValue = process.platform;\n';

/** The exempt rows can afford the stronger source: `{ts,mts,cts}` are all
 * modules, so the `export` parses, and pairing the platform read with a
 * NON-ban violation lets one assertion carry both directions -- the ban stayed
 * silent AND the file was genuinely linted. */
const EXEMPT_PROBE = `export ${AMBIENT_PLATFORM_READ}${ANY_VIOLATION}`;

function fixturePath(basename: string): string {
  return `packages/github-cache/src/__lint_fixture__.${basename}`;
}

describe('the ban fires at EVERY path shape that runs as a unit test (LINT-02, ME-01)', () => {
  const unitShapes = BAN_NAME_FAMILIES.flatMap((family) =>
    BAN_EXTENSIONS.map((extension) => `${family}.${extension}`),
  );

  it.each(unitShapes)('catches a platform read at *.%s', async (basename) => {
    const messages = await lintFixture(
      AMBIENT_PLATFORM_READ,
      fixturePath(basename),
    );

    expect(banRuleIdsOf(messages)).toEqual(['no-restricted-syntax']);
  });
});

/**
 * The other half of ME-01, and the half that is a DECISION rather than a
 * widening: `ignores` mirrors the unit runner's EXCLUDE, not its include, so it
 * stays at `*.integration.spec.{ts,mts,cts}` while `files` covers eight
 * extensions and two name families. The two globs are asymmetric on purpose and
 * `eslint.config.mjs` carries a header forbidding the "tidy" that would make
 * them match.
 *
 * These rows are what that decision BUYS. An `integration.spec.tsx` is not
 * collected by the integration runner and not caught by the unit runner's
 * exclude, so it runs as a UNIT test -- and must therefore be banned despite
 * carrying `integration` in its name. Same for the four other extensions, and
 * same for the `integration.test.ts` shape, which pins that the exemption is
 * keyed on the `spec` name family alone.
 *
 * Widening `ignores` to match `files` flips all six of these to exempt while
 * every glob still reads tidy. `lint-scope-drift.spec.ts` catches that too, by
 * comparison; these catch it by verdict.
 */
const INTEGRATION_EXEMPT_EXTENSIONS = ['ts', 'mts', 'cts'] as const;
const INTEGRATION_STILL_BANNED_BASENAMES = [
  'integration.spec.js',
  'integration.spec.mjs',
  'integration.spec.cjs',
  'integration.spec.jsx',
  'integration.spec.tsx',
  'integration.test.ts',
] as const;

describe('the exemption is exactly the integration suite, not everything named integration (CORR-06, ME-01)', () => {
  it.each(INTEGRATION_EXEMPT_EXTENSIONS)(
    'exempts *.integration.spec.%s, which the integration runner really collects',
    async (extension) => {
      const messages = await lintFixture(
        EXEMPT_PROBE,
        fixturePath(`integration.spec.${extension}`),
      );

      // Exactly the non-ban rule. Its presence proves the path was linted
      // rather than silently unconfigured; its being ALONE proves the ban was
      // the only thing lifted (D-17 ignores-beside-files, not a global unlint).
      expect(ruleIdsOf(messages)).toEqual([
        '@typescript-eslint/no-explicit-any',
      ]);
    },
  );

  it.each(INTEGRATION_STILL_BANNED_BASENAMES)(
    'still bans *.%s, which runs as a UNIT test despite the name',
    async (basename) => {
      const messages = await lintFixture(
        AMBIENT_PLATFORM_READ,
        fixturePath(basename),
      );

      expect(
        banRuleIdsOf(messages),
        `${basename} is collected by the UNIT runner (the integration runner takes only *.integration.spec.{ts,mts,cts}), so exempting it would be a unit spec with the ban off -- do not "tidy" ignores to match files`,
      ).toEqual(['no-restricted-syntax']);
    },
  );
});

/**
 * D-22: each extant CORR-05 violation is proven CAUGHT while it still exists.
 * Phases 9 and 10 remove the violations themselves; Phase 7 must NOT, or LINT-03 has
 * nothing to catch and the evidence is destroyed early.
 *
 * Keyed on FILE + EXPRESSION TEXT, never on a line number. That is not style:
 * inserting the four described disables shifts every later line in the very
 * commit that creates this table, so a line-number key would rot before it was
 * ever read. The position is located by searching the file content instead, and
 * a stripped disable is BLANKED rather than deleted so the numbering the
 * position assertion depends on survives the strip.
 *
 * REMOVAL SCHEDULE -- comment-locked so a Phase 9 or Phase 10 executor deletes
 * the ROW together with the SITE. A row whose site is gone fails loudly at
 * `lineIndexOf` below; a site whose disable is gone fails through
 * `reportUnusedDisableDirectives`. Neither can rot silently.
 *
 * There are now THREE sites and THREE error positions. There is NO fourth.
 *
 * HISTORICAL, and preserved rather than deleted, because a removed miscount lock is
 * indistinguishable from a miscount that never existed. Phase 7 authored this block with
 * FOUR sites and FOUR error positions, the fourth being
 * `cache-archive-path.spec.ts`'s `import { tmpdir } from 'node:os';`. Phase 9 removed it
 * under VER-02: the archive path became a workspace-relative literal, so there was no
 * ambient temp-directory read left to opt out of, and the import plus its
 * `eslint-disable-next-line` directive left together in ONE commit with this row --
 * exactly what `lineIndexOf`'s failure message below instructs, and what
 * `reportUnusedDisableDirectives: 'error'` (LINT-06) requires.
 *
 * The two miscounts Phase 7 recorded, both still worth knowing:
 * 1. That spec's bare `tmpdir()` CALL was never an error POSITION, only part of the
 *    SITE. In strict ESM the binding cannot exist without the import, the import is
 *    already the error, and a disable over the call would itself fail the build through
 *    the phase's own opt-out discipline. CONTEXT.md D-22 and REQUIREMENTS.md CORR-05
 *    both list the call alongside the import -- correct as a SITE (both lines did leave
 *    together, in Phase 9), wrong as an error position.
 * 2. ROADMAP SC3 says "three CORR-05 violations" where REQUIREMENTS, CONTEXT and
 *    RESEARCH all said FOUR. SC3 was a miscount AT THE TIME OF WRITING. It now happens
 *    to name the right number for the wrong reason -- do not read the coincidence as
 *    the document having been correct.
 */
const CORR_05_SITES = [
  {
    /** Removed by CORR-02, Phase 10. */
    file: 'packages/github-cache/src/backend/releases-backend.spec.ts',
    expression:
      "cachePlatform(process.platform) === 'windows' ? 'linux' : 'win32';",
    rule: 'no-restricted-syntax',
  },
  {
    /** Removed by CORR-02, Phase 10. */
    file: 'packages/github-cache/src/lib/release-asset-name.spec.ts',
    expression: "releaseAssetName('abc123' as Hash, process.platform),",
    rule: 'no-restricted-syntax',
  },
  {
    /**
     * Removed by NOTHING in this milestone. Phase 10 makes an explicit call; the
     * recommendation on record is moving this assertion to
     * `src/server/public-server.integration.spec.ts`, where LINT-02 allows it.
     */
    file: 'packages/github-cache/src/lib/release-asset-name.spec.ts',
    expression:
      'expect(cachePlatform()).toBe(cachePlatform(process.platform));',
    rule: 'no-restricted-syntax',
  },
] as const;

function readSiteLines(file: string): string[] {
  return readFileSync(new URL(file, WORKSPACE_ROOT_URL), 'utf8').split('\n');
}

function lineIndexOf(
  lines: string[],
  expression: string,
  file: string,
): number {
  const index = lines.findIndex((line) => line.trim() === expression);

  expect(
    index,
    `${file} no longer contains the exact expression \`${expression}\`. This table is keyed on FILE + EXPRESSION TEXT on purpose; if the site was legitimately removed by its scheduled requirement, delete its ROW here in the same commit.`,
  ).not.toBe(-1);

  return index;
}

describe('every extant CORR-05 violation is caught while it still exists (LINT-03, D-22)', () => {
  for (const { file, expression, rule } of CORR_05_SITES) {
    describe(`${file} -- ${expression}`, () => {
      it('is CAUGHT by the ban once its described disable is stripped', async () => {
        const lines = readSiteLines(file);
        const index = lineIndexOf(lines, expression, file);
        const stripped = [...lines];

        // BLANK, never splice. Deleting the directive line would shift every
        // later line by one and the position assertion below would then be
        // asserting the wrong number for every site whose disable precedes it.
        if (stripped[index - 1]?.includes('eslint-disable-next-line')) {
          stripped[index - 1] = '';
        }

        const messages = await lintFixture(stripped.join('\n'), file);

        // Exactly one, and AT the expression. The other sites in the same file
        // keep their own disables, so a second error here would mean the ban is
        // firing somewhere this table does not account for.
        expect(banRuleIdsOf(messages)).toEqual([rule]);
        expect(banErrorsOf(messages)[0]?.line).toBe(index + 1);
      });

      it('carries a described disable stating why the assertion cannot move to integration', () => {
        const lines = readSiteLines(file);
        const index = lineIndexOf(lines, expression, file);
        const directive = lines[index - 1] ?? '';

        expect(directive).toContain(`eslint-disable-next-line ${rule}`);

        // `--` may legitimately appear inside the prose, so everything after the
        // FIRST separator is the reason. A directive with `--` and nothing after
        // it still parses and still satisfies `require-description`, which is why
        // emptiness is asserted here rather than delegated to the rule.
        const reason = directive.split('--').slice(1).join('--').trim();

        expect(reason.length).toBeGreaterThan(0);

        // Strip any *.integration.spec.* FILENAME before looking for the word.
        // That strip IS this assertion, not a nicety around it. The one semantic
        // clause LINT-06 adds over LINT-05 is "say WHY the assertion cannot move
        // to integration" -- and a bare toContain('integration') is satisfied by
        // the substring sitting inside a path like
        // `public-server.integration.spec.ts`. Site 4's reason did exactly that
        // while ARGUING THE OPPOSITE: it recommended the move, i.e. conceded the
        // disable was unnecessary, and the guard passed it on a filename token.
        // A described disable whose description concedes it is unnecessary is
        // precisely the failure this control exists to prevent, so requiring the
        // word in the SURVIVING PROSE is what makes the clause mean anything.
        //
        // The extension part is `\w+`, not the `[cm]?ts` this used to carry
        // (security audit residual N-2). Keying on the integration runner's
        // collect set was the wrong frame: the token being stripped is a
        // FILENAME QUOTED IN PROSE, and prose can cite any name at all --
        // including one whose file would NOT be an integration spec, which is
        // precisely the case where the reason is misleading and the strip
        // matters most.
        //
        // Measured, so the residual is stated correctly rather than as the
        // security audit phrased it. `.tsx` was never the hole: `[cm]?ts`
        // matches the `ts` inside `.tsx` and strips the token anyway, leaving a
        // stray `x`. The four that LEAKED are the JS family --
        // `.js`, `.mjs`, `.cjs`, `.jsx` -- all four of which ME-01 brought into
        // the ban's `files` set, so all four are now real in-scope path shapes
        // rather than the theoretical one N-2 described.
        const prose = reason.replace(/\S+\.integration\.spec\.\w+/g, '');

        expect(
          prose,
          `${file}: this disable's reason mentions "integration" only inside a FILENAME. LINT-06 wants prose saying why the assertion cannot move to an integration spec -- not a path that happens to contain the word.`,
        ).toContain('integration');
      });
    });
  }
});
