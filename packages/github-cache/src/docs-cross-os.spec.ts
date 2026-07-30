import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * DOCS-07 cross-OS adoption-recipe drift guard (D-11, D-12, D-13, D-15).
 *
 * `docs/cross-os.md` is this milestone's ONLY consumer-facing artifact: an outside
 * project copies its discriminator configuration into its own workspace. So the
 * command the doc RENDERS and the command this repo's own `nx.json` DECLARES have to
 * be ONE string (D-15), not two that happen to match today. This spec READS the
 * declared value out of `nx.json` and asserts the doc renders it. It never re-spells
 * the literal, because a copy here would make the guard agree with itself while the
 * config drifted away from both -- documenting a configuration the repo does not
 * itself run is the exact defect class DOCS-08 spent a phase correcting.
 *
 * HARD DEPENDENCY -- without it this guard replays a STALE cached PASS. `docs/` lives
 * OUTSIDE this project's graph, so `docs/cross-os.md` is wired into `nx.json`'s
 * `targetDefaults.test.inputs` (pinned by name in `nx-target-inputs.spec.ts`), and
 * that registration lands in the SAME COMMIT as the doc. `{workspaceRoot}/nx.json` is
 * itself a `test` input, so the entry is effective on its own commit and there is no
 * stale-pass window for anyone to remember to close. This repo has already shipped
 * that defect once, with `typecheck`; PARITY-08 is the record.
 *
 * The doc is resolved with `new URL('../../../docs/cross-os.md', import.meta.url)` --
 * THREE `../`, because this spec lives flat in `src/` -- and read behind an
 * `existsSync` guard so a missing doc yields `''` and a NAMED assertion failure
 * rather than a module-load crash that says nothing about which claim was lost. The
 * existence clause is asserted FIRST for the same reason: several clauses below pass
 * trivially against the empty string (an absent phrase index is -1 for both sides of
 * an order comparison), so the existence control is what makes the rest non-vacuous.
 *
 * EVERY PINNED PHRASE MUST FIT ON ONE LINE OF THE DOC. The read is raw text, so a
 * phrase spanning a hard wrap matches NOTHING and the clause is a silent false PASS
 * in the ADDITIVE direction -- the guard stays green while the doc loses the claim.
 * Each phrase below was measured against the written file with
 * `rg -o -F "<phrase>" docs/cross-os.md | wc -l` before being committed, never
 * predicted.
 *
 * Keyed on PHRASE, never on a line number: the doc, its `nx.json` registration and
 * both nav links land in ONE commit and therefore shift each other's lines.
 *
 * `forbidden` clauses are deliberately ABSENT from this file. DOCS-07's claims are
 * all PRESENCE claims, so an empty forbidden list is the honest default -- the
 * single-character character-class contortion in `docs-same-os-claims.spec.ts` exists
 * only because spelling a forbidden phrase plants it in the file that proves it gone.
 */
const docUrl = new URL('../../../docs/cross-os.md', import.meta.url);
const repoRoot = new URL('../../../', import.meta.url);

const doc = existsSync(docUrl) ? readFileSync(docUrl, 'utf8') : '';

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, repoRoot), 'utf8');
}

const nxJson = JSON.parse(
  readFileSync(new URL('nx.json', repoRoot), 'utf8'),
) as {
  targetDefaults: Record<string, { inputs?: readonly unknown[] }>;
};

/**
 * Every `{ runtime: ... }` command in an inputs list, in declaration order. The
 * `flatMap` shape is `nx-target-inputs.spec.ts`'s, deliberately: the two guards must
 * not be able to disagree about what counts as a runtime input.
 */
function runtimeInputsOf(inputs: readonly unknown[] | undefined): string[] {
  return (inputs ?? []).flatMap((input) =>
    typeof input === 'object' && input !== null && 'runtime' in input
      ? [String((input as { runtime: unknown }).runtime)]
      : [],
  );
}

const declaredDiscriminators = runtimeInputsOf(
  nxJson.targetDefaults.integration.inputs,
);

/**
 * D-11's ORDER is load-bearing rather than editorial, so both headings are pinned as
 * phrases and compared by INDEX. A reader who stops after section one must land on
 * the SAFE configuration: the unsafe one (no discriminator on a non-portable target)
 * is a WRONG-RESULT risk, not a performance one.
 */
const SAFE_DEFAULT_HEADING =
  '## 1. The safe default: declare the discriminator on every cacheable target';
const CHECKLIST_HEADING =
  '## 2. The portability checklist: how to EARN a removal';

const REWORD_ADVICE =
  'If the doc was legitimately reworded, update this phrase HERE in the SAME commit; do not delete the assertion to make the suite green.';

describe('docs/cross-os.md exists at all (DOCS-07)', () => {
  // FIRST, and it is the control that makes every later clause non-vacuous.
  it('the cross-os recipe is on disk', () => {
    expect(
      existsSync(docUrl),
      'docs/cross-os.md is missing. It is DOCS-07 itself -- the consumer cross-OS adoption recipe -- and every other clause in this file reads it as an empty string without this control.',
    ).toBe(true);
  });
});

describe('docs/cross-os.md renders the discriminator nx.json declares (D-15)', () => {
  // Exact LENGTH, not a containment: a SECOND runtime entry appearing on
  // `integration` is as much a CORR-04 event as the string changing, and it would
  // also make "the" discriminator ambiguous for the doc to render.
  it('nx.json declares exactly one cross-os runtime discriminator', () => {
    expect(
      declaredDiscriminators,
      'nx.json no longer declares exactly ONE runtime input on `integration`. The doc renders THE discriminator; with zero there is nothing to render, and with two the doc cannot be single-sourced. Reconcile nx.json and this guard in the SAME commit.',
    ).toHaveLength(1);
  });

  // An EXACT occurrence count, never a bare `toContain` and never a `>= 1` floor.
  // MEASURED, not predicted: the command renders TWICE in the doc -- once in the
  // copy-pasteable `nx.json` snippet (the configuration an adopter installs) and once
  // as the bare command in the verification fence (the thing they must RUN on each of
  // their operating systems). Those are two different jobs, so both have to survive.
  // A `>= 1` floor is exactly as HALF-LOCKING as the `toContain` it replaced: it is
  // satisfied by the first occurrence, so deleting the verification fence -- the half
  // that closes T-12-09, an adopter's discriminator silently collapsing to one value
  // with no gate of ours to catch it -- would leave this guard green (WR-09).
  //
  // `split(x).length - 1` counts NON-OVERLAPPING occurrences, which is the right
  // counter here: this command cannot overlap itself.
  //
  // A THIRD occurrence fails too, deliberately. If the doc legitimately grows another
  // rendering, update this expected count HERE in the SAME commit; do not relax it
  // back to a floor to make the suite green.
  const RENDERED_DISCRIMINATOR_SITES = 2;

  it('the cross-os doc renders that exact command, byte for byte, at both sites', () => {
    const command = declaredDiscriminators[0];

    expect(
      doc.split(command).length - 1,
      `docs/cross-os.md must render the discriminator nx.json declares (\`${command}\`) at BOTH sites: the copy-pasteable config snippet AND the verification fence. D-15 makes the DOCUMENTED command and the CONFIGURED command one string, single-sourced, so widening or re-spelling the config trips this until the doc is updated. Take the literal FROM nx.json; do not retype it. ${REWORD_ADVICE}`,
    ).toBe(RENDERED_DISCRIMINATOR_SITES);
  });
});

describe('docs/cross-os.md puts the safe default FIRST (D-11, cross-os section order)', () => {
  it('the safe-default section precedes the portability checklist', () => {
    const safeDefaultAt = doc.indexOf(SAFE_DEFAULT_HEADING);
    const checklistAt = doc.indexOf(CHECKLIST_HEADING);

    expect(
      safeDefaultAt,
      `docs/cross-os.md is missing the safe-default heading \`${SAFE_DEFAULT_HEADING}\`. ${REWORD_ADVICE}`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      checklistAt,
      `docs/cross-os.md is missing the checklist heading \`${CHECKLIST_HEADING}\`. ${REWORD_ADVICE}`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      safeDefaultAt,
      'docs/cross-os.md now leads with the portability checklist. D-11 fixes the ORDER: a reader who stops after section one must land on the SAFE configuration, because the unsafe one is a WRONG-RESULT risk rather than a performance one. Do not reorder these two sections to read better.',
    ).toBeLessThan(checklistAt);
  });

  it('no numbered cross-os section precedes the safe default', () => {
    const numberedHeadings = [...doc.matchAll(/^## \d+\. .*$/gm)].map(
      (match) => match[0],
    );

    expect(
      numberedHeadings[0],
      'the FIRST numbered section of docs/cross-os.md is no longer the safe default. Inserting a numbered section above it defeats D-11 just as surely as swapping sections 1 and 2 would.',
    ).toBe(SAFE_DEFAULT_HEADING);
  });
});

describe('docs/cross-os.md states the cross-os limits of the platform read (D-13)', () => {
  // ANCHORED SAME-SENTENCE, not three separate `toContain` calls. The three tokens
  // must be RELATED, not merely co-present: "we also support arm64" somewhere else in
  // the file would satisfy a co-presence check while saying the opposite of the
  // honest limit D-13 requires. `[^.!?]` bounds the match to one sentence.
  it('relates architecture, libc and the arm64-only limit in one sentence', () => {
    expect(
      doc,
      'docs/cross-os.md no longer names architecture AND libc AND the arm64-only limit in a single sentence. D-13 is the requirement\'s own wording: the reader is told where this project\'s evidence ENDS. Do not soften it into a "consider also" bullet and do not split the limit away from the axes it limits.',
    ).toMatch(/architecture[^.!?]{0,80}libc[^.!?]{0,80}arm64/i);
  });
});

describe('docs/cross-os.md carries the five inherited checklist items (D-12)', () => {
  // FIVE, and there is no sixth. The sixth entry of the source hand-off is STRUCK and
  // was measured FALSE, and its own text says what to document instead: nothing.
  // Adding a reassurance about a non-problem is worse than silence.
  it('the portability checklist has exactly five numbered items', () => {
    const afterHeading = doc.slice(
      doc.indexOf(CHECKLIST_HEADING) + CHECKLIST_HEADING.length,
    );
    const section = afterHeading.split(/^## /m)[0];
    const items = section.match(/^\d+\. /gm) ?? [];

    expect(
      items,
      'the portability checklist in docs/cross-os.md no longer has exactly five numbered items. Items 1-5 are INHERITED from 08-ROOT-CAUSE.md and are not re-derived; item 6 there is STRUCK, was measured FALSE, and must not be reconstructed. If an item was legitimately added or merged, update this count HERE in the SAME commit.',
    ).toHaveLength(5);
  });
});

describe('docs/cross-os.md is reachable (cross-os nav)', () => {
  it('README.md links it from the Documentation list', () => {
    expect(
      read('README.md'),
      "README.md's ## Documentation list no longer carries a `- [Title](docs/cross-os.md) -- <what it covers>` bullet. An unreachable recipe is not a consumer deliverable.",
    ).toMatch(/^- \[.+\]\(docs\/cross-os\.md\) -- /m);
  });

  it('docs/advanced.md cross-links it', () => {
    expect(
      read('docs/advanced.md'),
      'docs/advanced.md no longer links cross-os.md. The cross-link sits in the publish / sync section because that is where a reader hits the cross-OS question.',
    ).toContain('cross-os.md');
  });
});
