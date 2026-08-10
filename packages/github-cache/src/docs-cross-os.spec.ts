import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readRepoFile, repoFileUrl } from './test/repo-file.js';

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
const docUrl = repoFileUrl('docs/cross-os.md');

const doc = existsSync(docUrl) ? readRepoFile('docs/cross-os.md') : '';

const nxJson = JSON.parse(readRepoFile('nx.json')) as {
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

  // ASSERTED BY PARSING THE FENCE, PER TARGET KEY -- not by counting occurrences in it.
  //
  // WHAT THE CLAIM IS, and it is unchanged. Section 1's heading says "declare the
  // discriminator on every cacheable target", and the snippet under it used to declare the
  // discriminator on exactly ONE target -- `integration`, this repository's EARNED EXCEPTION --
  // so the only copy-pasteable artifact in the document demonstrated the opposite of its own
  // heading (CR-01). The per-target repetition is not incidental, it IS the claim.
  //
  // WHY THE COUNT WAS INSUFFICIENT, which is the correction. This clause used to assert
  // `snippet.split(command).length - 1 === 3` under a title claiming once per target. A count
  // of three over the fence BODY as a flat string never proved three DIFFERENT target keys:
  // deleting the `lint` key and adding a second runtime input under `build` keeps the total at
  // three, so the exact shape CR-01 was about is SATISFIABLE BY DELETION while the guard stays
  // green. That is this repository's own recorded lesson -- a green structural guard sitting
  // over a wrong payload -- reproduced in the guard written to close it. A cardinality gate
  // cannot localize; the real invariant is one level down and the fence is valid JSON, so it is
  // trivially reachable.
  //
  // THE EXACT-COUNT DISCIPLINE IS PRESERVED, not relaxed into a floor. `toEqual([command])`
  // per target pins BOTH presence and exactly-once, so a doubled entry under one target now
  // fails on that target's own clause, and a deleted target fails on the key set. A `toContain`
  // here would be the `>= 1` floor this file already rejects once.
  //
  // If the doc legitimately grows another target, add it to `SNIPPET_TARGETS` below in the
  // SAME commit. Do not relax either clause to make the suite green.

  /**
   * The targets section 1's snippet must declare. Named ONCE: the key-set equality and the
   * per-target clause below both derive from it, so a fourth target cannot be added to one
   * and missed by the other. Two independent literals here would reproduce, one file over,
   * the "hardcoded twice while a canonical constant exists" hole A8 was written to close in
   * `windows-regression-detector.spec.ts` -- a guard silently going three-of-N.
   */
  const SNIPPET_TARGETS = ['build', 'test', 'lint'] as const;

  /** Every fenced block opened with the given info string, bodies only. */
  function fencedBodies(infoString: string): string[] {
    return [
      ...doc.matchAll(
        new RegExp(`^\`\`\`${infoString}\\n([\\s\\S]*?)^\`\`\``, 'gm'),
      ),
    ].map((match) => match[1]);
  }

  it('the cross-os doc renders that exact command once per target in the config snippet', () => {
    const command = declaredDiscriminators[0];
    const snippets = fencedBodies('json');

    // The extraction is asserted before it is counted: a fence whose info string
    // changed would otherwise make the count below 0 and read as a doc regression.
    expect(
      snippets.length,
      `docs/cross-os.md must carry exactly one \`\`\`json fence -- the copy-pasteable nx.json snippet. ${REWORD_ADVICE}`,
    ).toBe(1);

    // BOTH DEREFERENCES BELOW ARE NAMED FIRST. `JSON.parse` and `Object.keys` each crash
    // anonymously on a doc edit an author would plausibly make -- a `//` comment inside the
    // fence (legal in nx.json, which IS JSONC, and this fence is an nx.json snippet), or a
    // fence narrowed to just the `targetDefaults` sub-object. Every other clause in this
    // file carries a REWORD_ADVICE-bearing message; a bare SyntaxError or "Cannot convert
    // undefined or null to object" is the unnamed crash `hash-parity/compare.ts` calls out
    // as a defect in its own right.
    let snippet: {
      targetDefaults?: Record<string, { inputs?: readonly unknown[] }>;
    };

    try {
      snippet = JSON.parse(snippets[0]) as typeof snippet;
    } catch (error) {
      throw new Error(
        "docs/cross-os.md's ```json fence must PARSE -- this guard reads the target " +
          'keys out of it rather than counting occurrences in it. nx.json accepts JSONC ' +
          `comments; this fence cannot carry them. ${REWORD_ADVICE} (${String(error)})`,
      );
    }

    expect(
      snippet.targetDefaults,
      `docs/cross-os.md's \`\`\`json fence must be a whole nx.json shape with a \`targetDefaults\` key -- narrowing it to the sub-object breaks the copy-pasteable claim section 1 makes. ${REWORD_ADVICE}`,
    ).toBeDefined();

    const targetDefaults = snippet.targetDefaults ?? {};

    // THE TARGET KEYS THEMSELVES, by set equality. This is what the occurrence count could
    // not do: a snippet that dropped `lint` and doubled `build` kept the count at three.
    expect(
      Object.keys(targetDefaults).sort(),
      `The copy-pasteable nx.json snippet in docs/cross-os.md must declare targetDefaults for exactly ${SNIPPET_TARGETS.join(', ')} -- section 1's heading is "declare the discriminator on every cacheable target", and a snippet naming fewer targets demonstrates the opposite of its own heading (CR-01). ${REWORD_ADVICE}`,
    ).toEqual([...SNIPPET_TARGETS].sort());

    // EACH key carries the discriminator, EXACTLY ONCE. `toEqual([command])` rather than
    // `toContain` so both presence and cardinality are pinned per target, which keeps the
    // exact-count discipline while moving it to a level that can localize.
    for (const target of SNIPPET_TARGETS) {
      expect(
        runtimeInputsOf(targetDefaults[target]?.inputs),
        `The \`${target}\` target in docs/cross-os.md's nx.json snippet must carry the discriminator nx.json declares (\`${command}\`) exactly once. D-15 makes the DOCUMENTED command and the CONFIGURED command one string, single-sourced, so widening or re-spelling the config trips this until the doc is updated. Take the literal FROM nx.json; do not retype it. ${REWORD_ADVICE}`,
      ).toEqual([command]);
    }
  });

  it('the cross-os doc renders that exact command in the adopter-facing verification fence', () => {
    const command = declaredDiscriminators[0];

    expect(
      fencedBodies('bash').filter((body) => body.includes(command)),
      `docs/cross-os.md must render the discriminator nx.json declares (\`${command}\`) inside a \`\`\`bash fence -- the command an adopter RUNS on each of their operating systems. That fence closes T-12-09: an adopter's discriminator silently collapsing to one value, with no gate of ours to catch it. It is a DIFFERENT job from the config snippet above, so no count over the snippet can stand in for it. ${REWORD_ADVICE}`,
    ).not.toHaveLength(0);
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
    // GUARDED BEFORE SLICING, and the guard belongs HERE rather than in the ordering `it`
    // above. `indexOf` returns -1 when the heading is reworded, so the old
    // `doc.slice(-1 + CHECKLIST_HEADING.length)` sliced from an arbitrary positive offset
    // and counted `^\d+\. ` matches over unrelated text -- reporting a COUNT MISMATCH for
    // what is actually a MISSING HEADING. The `>= 0` control for this heading does exist,
    // but it lives in a different `it`, so it does not stop this one computing against a
    // garbage slice. This file's own header states the opposite standard for the
    // `existsSync` guard: "a NAMED assertion failure rather than a module-load crash that
    // says nothing about which claim was lost" (IN-04).
    const checklistAt = doc.indexOf(CHECKLIST_HEADING);

    expect(
      checklistAt,
      `docs/cross-os.md is missing the checklist heading \`${CHECKLIST_HEADING}\`, so the item count below would be computed over unrelated text and would report a count mismatch instead of the heading that actually went missing. ${REWORD_ADVICE}`,
    ).toBeGreaterThanOrEqual(0);

    const afterHeading = doc.slice(checklistAt + CHECKLIST_HEADING.length);
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
      readRepoFile('README.md'),
      "README.md's ## Documentation list no longer carries a `- [Title](docs/cross-os.md) -- <what it covers>` bullet. An unreachable recipe is not a consumer deliverable.",
    ).toMatch(/^- \[.+\]\(docs\/cross-os\.md\) -- /m);
  });

  // A LINK-SHAPED assertion, matching the README sibling above rather than the bare
  // `toContain('cross-os.md')` this replaced (IN-05). A containment passes on ANY occurrence
  // of the substring, so it was satisfied by a prose mention, by an HTML comment, and by a
  // bare filename in a code span -- all three measured against this regex and all three now
  // rejected. Its own failure message also named a PLACEMENT the assertion never checked,
  // which is why the placement is stated below as the convention it is rather than as a
  // claim this clause enforces.
  //
  // KNOWN RESIDUAL, named rather than left for a reader to discover: a live link wrapped in
  // `~~` strikethrough still matches. Catching that needs a lookbehind for one exotic edit,
  // which is not worth the regex; the three realistic drift modes are closed.
  it('docs/advanced.md cross-links it as an actual markdown link', () => {
    expect(
      readRepoFile('docs/advanced.md'),
      'docs/advanced.md no longer carries a markdown LINK to cross-os.md. A bare mention is not a cross-link: an unreachable recipe is not a consumer deliverable, and this doc is the one place a reader hits the cross-OS question. By convention the link sits in the publish / sync section -- that placement is not asserted here, only the link itself.',
    ).toMatch(/\[[^\]]+\]\(cross-os\.md\)/);
  });
});
