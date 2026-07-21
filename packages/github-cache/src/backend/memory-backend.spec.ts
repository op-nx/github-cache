import { describe, expect, it } from 'vitest';
import type { Hash } from '../lib/cache-key.js';
import {
  createReadOnlyMemoryBackend,
  createWritableMemoryBackend,
} from './memory-backend.js';

describe('createWritableMemoryBackend', () => {
  it('put stores a new hash and returns "stored"', async () => {
    const backend = createWritableMemoryBackend();

    const result = await backend.put(
      'abc123' as Hash,
      Buffer.from('tar-bytes'),
    );

    expect(result).toBe('stored');
  });

  it('put of an already-stored hash returns "conflict"', async () => {
    const backend = createWritableMemoryBackend();
    await backend.put('abc123' as Hash, Buffer.from('first'));

    const result = await backend.put('abc123' as Hash, Buffer.from('second'));

    expect(result).toBe('conflict');
  });

  it('get of a stored hash returns a hit with the stored bytes', async () => {
    const backend = createWritableMemoryBackend();
    const bytes = Buffer.from('tar-bytes');
    await backend.put('abc123' as Hash, bytes);

    const result = await backend.get('abc123' as Hash);

    expect(result).toEqual({ kind: 'hit', bytes });
  });

  it('get of an absent hash returns a miss', async () => {
    const backend = createWritableMemoryBackend();

    const result = await backend.get('deadbeef' as Hash);

    expect(result).toEqual({ kind: 'miss' });
  });
});

describe('createReadOnlyMemoryBackend', () => {
  it('put always yields "forbidden" (the 403 read-only seam, D-04)', async () => {
    const backend = createReadOnlyMemoryBackend();

    const result = await backend.put(
      'abc123' as Hash,
      Buffer.from('tar-bytes'),
    );

    expect(result).toBe('forbidden');
  });

  it('get still returns a valid GetResult (miss on an unseeded store)', async () => {
    const backend = createReadOnlyMemoryBackend();

    const result = await backend.get('deadbeef' as Hash);

    expect(result).toEqual({ kind: 'miss' });
  });
});
