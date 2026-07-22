import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createResilientOctokit } from './resilient-octokit.js';

// @actions/core is mocked so the throttle-callback warnings are spy-assertable and
// never touch a real workflow-command stream (D-14).
vi.mock('@actions/core', () => ({ warning: vi.fn() }));

// Capture the constructor options the helper passes, without reaching into Octokit's
// (private) internal state: the plugin returns a capturing subclass, and the two
// plugins are stubbed so their real wiring is out of scope here (their behavior is
// upstream's; this guards only what THIS helper passes). vi.hoisted so the capture
// state exists before the hoisted vi.mock factory AND before resilient-octokit.ts's
// top-level Octokit.plugin(...) runs at import.
const capture = vi.hoisted(() => ({
  options: {} as {
    auth?: string;
    throttle?: {
      onRateLimit: ThrottleCallback;
      onSecondaryRateLimit: ThrottleCallback;
    };
  },
  pluginArgs: [] as unknown[],
}));

vi.mock('@octokit/rest', () => {
  class FakeOctokit {
    constructor(options: Record<string, unknown>) {
      capture.options = options as typeof capture.options;
    }

    static plugin(...args: unknown[]) {
      capture.pluginArgs.push(...args);

      return FakeOctokit;
    }
  }

  return { Octokit: FakeOctokit };
});
vi.mock('@octokit/plugin-retry', () => ({ retry: { name: 'retry' } }));
vi.mock('@octokit/plugin-throttling', () => ({
  throttling: { name: 'throttling' },
}));

const warning = vi.mocked(core.warning);

type ThrottleCallback = (
  retryAfter: number,
  options: { method: string; url: string },
  octokit: unknown,
  retryCount: number,
) => boolean;

afterEach(() => {
  vi.clearAllMocks();
  capture.options = {};
});

describe('createResilientOctokit (F04)', () => {
  it('constructs an Octokit built from Octokit.plugin(retry, throttling)', () => {
    const client = createResilientOctokit('t0ken');

    expect(client).toBeInstanceOf(Octokit);
    // retry BEFORE throttling, mirroring upstream's composition order.
    expect(capture.pluginArgs).toEqual([retry, throttling]);
    expect(capture.options.auth).toBe('t0ken');
  });

  it('registers both throttle callbacks as functions', () => {
    createResilientOctokit('t0ken');

    expect(capture.options.throttle?.onRateLimit).toBeTypeOf('function');
    expect(capture.options.throttle?.onSecondaryRateLimit).toBeTypeOf(
      'function',
    );
  });

  it('retries once then gives up on each throttle callback (retryCount < 1)', () => {
    createResilientOctokit('t0ken');
    const throttle = capture.options.throttle!;
    const options = { method: 'GET', url: '/repos/o/r/releases' };

    for (const cb of [throttle.onRateLimit, throttle.onSecondaryRateLimit]) {
      expect(cb(1, options, undefined, 0)).toBe(true);
      expect(cb(1, options, undefined, 1)).toBe(false);
      expect(cb(1, options, undefined, 2)).toBe(false);
    }
  });

  it('warns with only the method and url, never the token', () => {
    createResilientOctokit('super-secret-token');
    const throttle = capture.options.throttle!;
    const options = { method: 'POST', url: '/repos/o/r/releases/1/assets' };

    throttle.onRateLimit(2, options, undefined, 0);
    throttle.onSecondaryRateLimit(2, options, undefined, 0);

    expect(warning).toHaveBeenCalledTimes(2);

    for (const call of warning.mock.calls) {
      const message = String(call[0]);

      expect(message).toContain(options.method);
      expect(message).toContain(options.url);
      expect(message).not.toContain('super-secret-token');
    }
  });
});
