import { describe, expect, it } from 'vitest';
import { inFlightHashCount, withHashLock } from './with-hash-lock.js';

// The lock map is MODULE-GLOBAL (D-03), so state leaks across `it` blocks unless
// each test uses a DISTINCT hash string and awaits full settlement before it ends.
// Eviction is asserted against a captured baseline (`before`) rather than an
// absolute size, so this suite stays correct even if another entry is in flight.

// A deferred lets the test drive settle order deterministically -- no timers, no
// setTimeout sequencing (TEST-02 forbids elapsed-time assertions).
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

// Flush a handful of microtask ticks so any queued chain/eviction callback runs.
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
}

describe('withHashLock', () => {
  it('serializes two operations on the same hash (TEST-02)', async () => {
    const order: string[] = [];
    const first = deferred<void>();

    const opA = withHashLock('serialize-hash', async () => {
      order.push('A-start');
      await first.promise;
      order.push('A-end');
    });

    const opB = withHashLock('serialize-hash', async () => {
      order.push('B-start');
    });

    await flushMicrotasks();

    // A has entered; B must NOT have started while A's deferred is unresolved.
    expect(order).toEqual(['A-start']);

    first.resolve();
    await Promise.all([opA, opB]);

    expect(order).toEqual(['A-start', 'A-end', 'B-start']);
  });

  it('runs two different hashes concurrently (TEST-02)', async () => {
    const order: string[] = [];
    const g1 = deferred<void>();
    const g2 = deferred<void>();

    const op1 = withHashLock('concurrent-h1', async () => {
      order.push('h1-start');
      await g1.promise;
      order.push('h1-end');
    });

    const op2 = withHashLock('concurrent-h2', async () => {
      order.push('h2-start');
      await g2.promise;
      order.push('h2-end');
    });

    await flushMicrotasks();

    // Both bodies entered before EITHER deferred resolved -- the concurrency proof.
    expect([...order].sort()).toEqual(['h1-start', 'h2-start']);
    expect(order).not.toContain('h1-end');
    expect(order).not.toContain('h2-end');

    g1.resolve();
    g2.resolve();
    await Promise.all([op1, op2]);

    expect(order).toContain('h1-end');
    expect(order).toContain('h2-end');
  });

  it('evicts a hash entry once its tail settles (TEST-02)', async () => {
    const before = inFlightHashCount();

    const op = withHashLock('evict-hash', async () => 'done');

    expect(inFlightHashCount()).toBe(before + 1);

    await op;
    await flushMicrotasks();

    expect(inFlightHashCount()).toBe(before);
  });

  it('does not evict a re-locked hash entry when a prior tail settles while a later op is still in flight (eviction identity, TEST-02)', async () => {
    // Guards the `inFlight.get(hash) === tail` identity check: when A settles but B
    // has already re-locked the same hash, A's eviction must NOT delete B's entry.
    // Without the identity check, A's evict would drop B's tail, so a third op C
    // would find no entry and run CONCURRENTLY with B -- breaking serialization on
    // the write hot path.
    const before = inFlightHashCount();
    const order: string[] = [];
    const aGate = deferred<void>();
    const bGate = deferred<void>();

    const opA = withHashLock('relock-hash', async () => {
      order.push('A-start');
      await aGate.promise;
      order.push('A-end');
    });
    const opB = withHashLock('relock-hash', async () => {
      order.push('B-start');
      await bGate.promise;
      order.push('B-end');
    });

    // One entry for the hash (B's tail replaced A's).
    expect(inFlightHashCount()).toBe(before + 1);

    // Let A fully settle. Its tail-eviction callback fires but must see B's tail as
    // the current entry and leave it in place.
    aGate.resolve();
    await opA;
    await flushMicrotasks();

    expect(inFlightHashCount()).toBe(before + 1);
    expect(order).toEqual(['A-start', 'A-end', 'B-start']);

    // C re-locks again; it must queue behind B, not run while B holds.
    const opC = withHashLock('relock-hash', async () => {
      order.push('C-start');
    });
    await flushMicrotasks();
    expect(order).not.toContain('C-start');

    bGate.resolve();
    await Promise.all([opB, opC]);
    await flushMicrotasks();

    expect(order).toEqual(['A-start', 'A-end', 'B-start', 'B-end', 'C-start']);
    expect(inFlightHashCount()).toBe(before);
  });

  it('does not wedge the queue when an operation rejects (TEST-02)', async () => {
    const rejected = withHashLock('no-wedge-hash', () =>
      Promise.reject(new Error('boom')),
    );
    const next = withHashLock('no-wedge-hash', () => Promise.resolve('ok'));

    // The rejection reaches ITS OWN caller, and the next same-hash op still runs.
    await expect(rejected).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');

    await flushMicrotasks();
  });
});
