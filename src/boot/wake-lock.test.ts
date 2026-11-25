import { describe, expect, it } from 'vitest';
import {
  startWakeLock,
  type VisibilitySource,
  type WakeLockLike,
  type WakeLockSentinelLike,
} from './wake-lock';

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class FakeVisibility implements VisibilitySource {
  visibilityState: string;
  readonly listeners = new Set<() => void>();

  constructor(initial: string) {
    this.visibilityState = initial;
  }

  addEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.listeners.delete(listener);
  }

  set(state: string): void {
    this.visibilityState = state;
    for (const listener of [...this.listeners]) {
      listener();
    }
  }
}

interface FakeWakeLock extends WakeLockLike {
  readonly requests: Deferred<WakeLockSentinelLike>[];
  request(kind: 'screen'): Promise<WakeLockSentinelLike>;
}

interface FakeSentinel extends WakeLockSentinelLike {
  releases: number;
}

function createFakeWakeLock(): FakeWakeLock {
  const requests: Deferred<WakeLockSentinelLike>[] = [];
  return {
    requests,
    request(_kind: 'screen') {
      const pending = deferred<WakeLockSentinelLike>();
      requests.push(pending);
      return pending.promise;
    },
  };
}

function createFakeSentinel(): FakeSentinel {
  const sentinel = {
    releases: 0,
    release() {
      sentinel.releases += 1;
      return Promise.resolve();
    },
  };
  return sentinel;
}

/** Lets the queued promise callbacks run. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('startWakeLock', () => {
  it('requests a screen lock when the document starts visible', () => {
    const wakeLock = createFakeWakeLock();

    startWakeLock(new FakeVisibility('visible'), wakeLock);

    expect(wakeLock.requests).toHaveLength(1);
  });

  it('does not request a lock while the document starts hidden', () => {
    const wakeLock = createFakeWakeLock();

    startWakeLock(new FakeVisibility('hidden'), wakeLock);

    expect(wakeLock.requests).toHaveLength(0);
  });

  it('releases the lock when the document becomes hidden', async () => {
    const visibility = new FakeVisibility('visible');
    const wakeLock = createFakeWakeLock();
    startWakeLock(visibility, wakeLock);
    const sentinel = createFakeSentinel();
    wakeLock.requests[0]?.resolve(sentinel);
    await settle();

    visibility.set('hidden');
    await settle();

    expect(sentinel.releases).toBe(1);
  });

  it('requests a new lock when the document becomes visible again', async () => {
    const visibility = new FakeVisibility('visible');
    const wakeLock = createFakeWakeLock();
    startWakeLock(visibility, wakeLock);
    wakeLock.requests[0]?.resolve(createFakeSentinel());
    await settle();
    visibility.set('hidden');
    await settle();

    visibility.set('visible');

    expect(wakeLock.requests).toHaveLength(2);
  });

  it('does not request a second lock while one is held', async () => {
    const visibility = new FakeVisibility('visible');
    const wakeLock = createFakeWakeLock();
    startWakeLock(visibility, wakeLock);
    wakeLock.requests[0]?.resolve(createFakeSentinel());
    await settle();

    visibility.set('visible');

    expect(wakeLock.requests).toHaveLength(1);
  });

  it('swallows a rejected request and tries again when visible', async () => {
    const visibility = new FakeVisibility('visible');
    const wakeLock = createFakeWakeLock();
    startWakeLock(visibility, wakeLock);

    wakeLock.requests[0]?.reject(new Error('not allowed'));
    await settle();
    visibility.set('hidden');
    visibility.set('visible');

    expect(wakeLock.requests).toHaveLength(2);
  });

  it('releases a lock that resolves after the document became hidden', async () => {
    const visibility = new FakeVisibility('visible');
    const wakeLock = createFakeWakeLock();
    startWakeLock(visibility, wakeLock);
    visibility.set('hidden');

    const lateSentinel = createFakeSentinel();
    wakeLock.requests[0]?.resolve(lateSentinel);
    await settle();

    expect(lateSentinel.releases).toBe(1);
  });

  it('swallows a rejected release', async () => {
    const visibility = new FakeVisibility('visible');
    const wakeLock = createFakeWakeLock();
    startWakeLock(visibility, wakeLock);
    const sentinel = createFakeSentinel();
    sentinel.release = () => {
      sentinel.releases += 1;
      return Promise.reject(new Error('release failed'));
    };
    wakeLock.requests[0]?.resolve(sentinel);
    await settle();

    expect(() => visibility.set('hidden')).not.toThrow();
    await settle();
  });

  it('does nothing when the browser has no Wake Lock API', () => {
    const visibility = new FakeVisibility('visible');

    const handle = startWakeLock(visibility, undefined);

    expect(() => handle.stop()).not.toThrow();
    expect(visibility.listeners.size).toBe(0);
  });

  it('stops releasing and listening after stop', async () => {
    const visibility = new FakeVisibility('visible');
    const wakeLock = createFakeWakeLock();
    const handle = startWakeLock(visibility, wakeLock);
    const sentinel = createFakeSentinel();
    wakeLock.requests[0]?.resolve(sentinel);
    await settle();

    handle.stop();
    visibility.set('visible');

    expect(sentinel.releases).toBe(1);
    expect(wakeLock.requests).toHaveLength(1);
    expect(visibility.listeners.size).toBe(0);
  });
});
