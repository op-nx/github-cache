import { fileURLToPath } from 'node:url';
import { ESLint, type Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

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
 * here would notice if `nx.json` never registered the plugin. That half is closed
 * separately -- by plan 07-03's target wiring and by the battery command itself --
 * and the split is deliberate, because this file must stay green in a commit where
 * no `lint` target exists yet.
 *
 * LINT-02 (the ambient-platform ban) and LINT-03 (its RED-before-GREEN proof over
 * the evasion shapes and the four extant CORR-05 sites) arrive in plan 07-02 and
 * extend this file. What is here today is the opt-out half plus the CORR-06
 * scoping control those assertions will depend on.
 */

// From `src/*.spec.ts` the workspace root is THREE levels up: `src/` ->
// `packages/github-cache/` -> `packages/` -> the root. Resolved from
// `import.meta.url`, never `__dirname` and never `process.cwd()` -- the house
// convention at five existing sites, and doubly load-bearing in this file, because
// an ambient `process.cwd()` read inside a unit spec is precisely the shape
// LINT-02 exists to ban.
const WORKSPACE_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

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
  // The mechanism that will force each of the four CORR-05 disables out TOGETHER
  // with its violation in Phases 9 and 10: delete the code but leave the disable
  // and the build goes red.
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
