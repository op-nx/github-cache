import { describe, expect, it } from 'vitest';
import { faultMessageForField, faultReason } from './octokit-fault-reason.js';

/**
 * The body half of the fault contract, tested at its own leaf rather than only through the
 * two engines that consume it (`publish-mirror.spec.ts`, `cleanup.spec.ts`). Those exercise
 * it incidentally, on the payload shapes their own branches care about, which is how the
 * empty-string case below survived: neither engine had a reason to construct one.
 *
 * The module's governing rule is that undefined is NOT benign -- a status-only classifier
 * that guessed benign is the defect it exists to close -- so every case here is about
 * whether a READABLE reason survives to the caller, never about a convenient default.
 */
const bodyOf = (data: unknown) => ({ response: { data } });

describe("faultReason reads GitHub's own reason out of the body (ROBUST-01, D-04)", () => {
  // THE REGRESSION THIS SUITE WAS OPENED ON. `''` is not a readable reason, and both
  // consuming idioms treat it as present: `'' ?? x` short-circuits and
  // `.find(v => v !== undefined)` accepts it. So an empty message SHADOWED the top-level
  // fallback and the reader printed nothing at the one site that exists to print something.
  it('treats an EMPTY errors[].message as absent, so the data.message fallback still reads', () => {
    expect(
      faultReason(
        bodyOf({
          errors: [{ code: 'custom', message: '' }],
          message: 'Tag name cannot be reused under this ruleset',
        }),
      ),
    ).toEqual({
      code: 'custom',
      message: 'Tag name cannot be reused under this ruleset',
    });
  });

  // The asymmetry that made the above a BUG rather than a preference: null was always
  // handled, because it fails the typeof test. Kept as a live control so the two
  // empty-ish shapes cannot drift apart again.
  it('handles a null errors[].message the same way, which it always did', () => {
    expect(
      faultReason(
        bodyOf({
          errors: [{ code: 'custom', message: null }],
          message: 'Tag name cannot be reused under this ruleset',
        }),
      ),
    ).toEqual({
      code: 'custom',
      message: 'Tag name cannot be reused under this ruleset',
    });
  });

  it('treats an EMPTY errors[].code as absent rather than reporting a blank code', () => {
    expect(
      faultReason(
        bodyOf({ errors: [{ code: '' }, { code: 'already_exists' }] }),
      ).code,
    ).toBe('already_exists');
  });

  // The two lookups are INDEPENDENT: the message may come from a different entry than the
  // code. Binding one entry on its code and reading THAT entry's message is the shape the
  // module's own docstring rejects, and this row is what holds the line.
  it('reads the code and the message from DIFFERENT entries when that is where they are', () => {
    expect(
      faultReason(
        bodyOf({
          errors: [
            { code: 'custom' },
            {
              resource: 'Release',
              field: 'tag_name',
              message: 'immutable release',
            },
          ],
        }),
      ),
    ).toEqual({ code: 'custom', message: 'immutable release' });
  });

  it.each([
    ['an absent body', undefined],
    ['a null body', null],
    ['a body with no data', { response: {} }],
    ['errors that are not an array', bodyOf({ errors: 'nope' })],
    ['an empty errors array', bodyOf({ errors: [] })],
    ['a primitive entry', bodyOf({ errors: [42] })],
    ['a null entry', bodyOf({ errors: [null] })],
    ['a non-string message', bodyOf({ errors: [{ message: 7 }] })],
    ['an EMPTY top-level message', bodyOf({ errors: [], message: '' })],
  ])('reports nothing readable for %s, never a guess', (_shape, error) => {
    expect(faultReason(error)).toEqual({
      code: undefined,
      message: undefined,
    });
  });
});

describe('faultMessageForField scopes the lookup to one entry (ROBUST-01)', () => {
  // The measured createRelease payload: three entries, all `code: custom`, the FIRST a
  // generic pre_receive decoy. An unscoped read returns the decoy, which is why the
  // field-scoped accessor exists at all.
  const burnedTag = bodyOf({
    errors: [
      {
        resource: 'Release',
        code: 'custom',
        message: 'Repository rule violations found',
      },
      {
        resource: 'Release',
        code: 'custom',
        field: 'tag_name',
        message: 'immutable release',
      },
      { resource: 'Release', code: 'custom', message: 'Cannot create ref' },
    ],
  });

  it("returns the tag_name entry's message, not the first message in the array", () => {
    expect(faultMessageForField(burnedTag, 'tag_name')).toBe(
      'immutable release',
    );
    expect(faultReason(burnedTag).message).toBe(
      'Repository rule violations found',
    );
  });

  // Same empty-string rule, at the second accessor. An entry that carries the field but an
  // empty message must read as "GitHub did not say this", never as a match -- a caller's
  // substring test against '' would otherwise be deciding on nothing.
  it('treats an EMPTY message on a matching field as absent', () => {
    expect(
      faultMessageForField(
        bodyOf({ errors: [{ field: 'tag_name', message: '' }] }),
        'tag_name',
      ),
    ).toBeUndefined();
  });

  it.each([
    [
      'no entry with that field',
      bodyOf({ errors: [{ field: 'other', message: 'x' }] }),
    ],
    ['errors that are not an array', bodyOf({ errors: {} })],
    ['an absent body', undefined],
  ])(
    'returns undefined for %s, which a caller must not read as benign',
    (_shape, error) => {
      expect(faultMessageForField(error, 'tag_name')).toBeUndefined();
    },
  );
});
