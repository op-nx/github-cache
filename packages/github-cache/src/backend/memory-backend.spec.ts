import { describe, expect, it } from 'vitest';
import { createWritableMemoryBackend } from './memory-backend.js';

describe('createWritableMemoryBackend', () => {
  it('put stores a new hash and returns "stored"', async () => {
    const backend = createWritableMemoryBackend();

    const result = await backend.put('abc123', Buffer.from('tar-bytes'));

    expect(result).toBe('stored');
  });

  it('put of an already-stored hash returns "conflict"', async () => {
    const backend = createWritableMemoryBackend();
    await backend.put('abc123', Buffer.from('first'));

    const result = await backend.put('abc123', Buffer.from('second'));

    expect(result).toBe('conflict');
  });

  it('get of a stored hash returns a hit with the stored bytes', async () => {
    const backend = createWritableMemoryBackend();
    const bytes = Buffer.from('tar-bytes');
    await backend.put('abc123', bytes);

    const result = await backend.get('abc123');

    expect(result).toEqual({ kind: 'hit', bytes });
  });

  it('get of an absent hash returns a miss', async () => {
    const backend = createWritableMemoryBackend();

    const result = await backend.get('deadbeef');

    expect(result).toEqual({ kind: 'miss' });
  });
});
