import { describe, expect, it } from 'vitest';
import { dogfoodBody } from './dogfood-body.js';

/**
 * The DIFFERING-BYTES assertion below is the load-bearing one, and it is what turns
 * D-18 from a signature change into a behavioural one.
 *
 * VER-06's proof is that a Windows runner read a body a LINUX runner produced. The
 * verify leg makes that claim by comparing the restored bytes against
 * `dogfoodBody(hash, 'linux')`. If `producerOs` did not reach the payload, that
 * comparison would be true of EVERY body regardless of who produced it -- the
 * parameter would be decorative and the provenance claim empty, which is exactly the
 * presence-only pass VER-06 exists to rule out. So the two OS values MUST produce
 * different bytes, and that is asserted here rather than assumed from the signature.
 *
 * The determinism claim is per (hash, producerOs) PAIR, not per hash: the seed and
 * verify jobs share only a run id, so both axes must be stable or the verify leg
 * cannot reconstruct what the seed leg wrote.
 */
describe('dogfoodBody (F05 shared payload leaf)', () => {
  it('returns the same bytes for the same hash and the same producer OS', () => {
    expect(
      dogfoodBody('abc123', 'linux').equals(dogfoodBody('abc123', 'linux')),
    ).toBe(true);
    expect(
      dogfoodBody('abc123', 'windows').equals(dogfoodBody('abc123', 'windows')),
    ).toBe(true);
  });

  it('returns different bytes for different hashes', () => {
    expect(
      dogfoodBody('abc123', 'linux').equals(dogfoodBody('def456', 'linux')),
    ).toBe(false);
  });

  it('returns different bytes for different producer OSes -- the provenance claim (VER-06, D-18)', () => {
    expect(
      dogfoodBody('abc123', 'linux').equals(dogfoodBody('abc123', 'windows')),
    ).toBe(false);
  });

  // Structural, mirroring select-backend.spec.ts:298's `selectBackend.length` control.
  // Function.length counts parameters BEFORE the first default, so a default on
  // `producerOs` (`= cachePlatform()`) drops this to 1 and fails here. That is the
  // whole no-default rule of D-18: a default lets the verify leg silently compare
  // against its OWN OS, which is the vacuity trap. Without this assertion the rule
  // would be enforced by review alone.
  it('structural: dogfoodBody.length is 2 -- neither parameter carries a default (D-18)', () => {
    expect(dogfoodBody.length).toBe(2);
  });

  it('returns a Buffer', () => {
    expect(Buffer.isBuffer(dogfoodBody('abc123', 'linux'))).toBe(true);
  });
});
