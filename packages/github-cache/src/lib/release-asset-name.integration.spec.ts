import { describe, expect, it } from 'vitest';
import { cachePlatform } from './release-asset-name.js';

// INTEGRATION (the real running platform, no mocks and no injected value): exercises
// `cachePlatform`'s DEFAULT-ARGUMENT contract, which is specified as "the no-argument
// call resolves the platform this process is actually running on". The running machine
// is the subject of the assertion here, not a value derived from it.
//
// Distinct from `release-asset-name.spec.ts`, which asserts the three OS MAPPINGS
// (win32 -> windows, darwin -> macos, everything else -> linux) with an INJECTED
// platform, and must keep doing so -- an injected parameter is what lets ONE CI leg
// assert every mapping. Neither file subsumes the other and they must not be collapsed:
// the mappings are machine-INDEPENDENT and belong at a unit path; the default argument
// is machine-DEPENDENT and is meaningless at one.
//
// Runs on ci.yml's `integration` matrix (ubuntu-24.04-arm + windows-11-arm), and that
// two-leg matrix is what makes this assertion BITE. Under the ubuntu-only `test` target
// the no-argument call and the running-platform call are indistinguishable, so the
// assertion samples at a rate of ZERO -- it can never fail, on any machine CI runs.
// Moving it here does not merely relocate an ambient read, it turns a guard that could
// not fail into one that can.
//
// Deliberately NOT framed as a public-surface contract, unlike the repo's other
// integration spec. `cachePlatform`'s default argument is INTERNAL; borrowing the
// public-surface language would imply a claim about the shipped consumer surface that
// this file does not make.
describe('cachePlatform default-argument contract (integration, real platform)', () => {
  it('resolves the running platform when called with no argument (CORR-01)', () => {
    expect(cachePlatform()).toBe(cachePlatform(process.platform));
  });
});
