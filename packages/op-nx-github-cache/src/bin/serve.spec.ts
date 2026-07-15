import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvePort } from './serve.js';

describe('resolvePort', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses a valid integer port', () => {
    expect(resolvePort('8080')).toBe(8080);
  });

  it('treats unset as 0 (ephemeral) without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(resolvePort(undefined)).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('accepts an explicit 0 (ephemeral) without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(resolvePort('0')).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back to 0 and warns on invalid input instead of crashing listen', () => {
    // Each of these would make `server.listen(Number(x), ...)` throw
    // ERR_SOCKET_BAD_PORT; the resolver must instead fall back to an
    // ephemeral port and surface the misconfiguration.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(resolvePort('not-a-port')).toBe(0);
    expect(resolvePort('3000.5')).toBe(0);
    expect(resolvePort('-1')).toBe(0);
    expect(resolvePort('70000')).toBe(0);
    expect(warn).toHaveBeenCalledTimes(4);
  });
});
