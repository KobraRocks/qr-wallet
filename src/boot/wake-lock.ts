/** The subset of the Screen Wake Lock sentinel the app uses. */
export interface WakeLockSentinelLike {
  release(): Promise<void>;
}

/** The subset of `navigator.wakeLock` the app uses. */
export interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

/** The subset of `document` the wake lock reacts to. */
export interface VisibilitySource {
  readonly visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

/** A started wake lock; `stop` releases it and stops watching visibility. */
export interface WakeLockHandle {
  stop(): void;
}

/**
 * Keeps the screen awake while the document is visible.
 *
 * Requests a screen wake lock on start (when visible), releases it when the
 * document becomes hidden, and requests a fresh one when it becomes visible
 * again. Every failure is swallowed: a browser without the Wake Lock API, a
 * denied request, an interrupted request, or a failed release must never reach
 * the rest of the app.
 */
export function startWakeLock(
  visibility: VisibilitySource,
  wakeLock: WakeLockLike | undefined,
): WakeLockHandle {
  if (wakeLock === undefined) {
    return { stop() {} };
  }
  const lock = wakeLock;

  /** The sentinel currently held, if any. Never a pending request. */
  let sentinel: WakeLockSentinelLike | null = null;
  /** Bumped whenever the lock is released, invalidating in-flight requests. */
  let generation = 0;
  let stopped = false;

  function releaseSentinel(): void {
    const current = sentinel;
    sentinel = null;
    if (current !== null) {
      void current.release().catch(() => {
        // The lock may already be gone; releasing is best-effort.
      });
    }
  }

  function acquire(): void {
    if (stopped || visibility.visibilityState !== 'visible' || sentinel !== null) {
      return;
    }
    const requestedGeneration = generation;

    let request: Promise<WakeLockSentinelLike>;
    try {
      request = lock.request('screen');
    } catch {
      // A synchronous throw means the lock is unavailable; stay unlocked.
      return;
    }

    request
      .then((next) => {
        if (stopped || requestedGeneration !== generation || sentinel !== null) {
          // Released or superseded while the request was in flight.
          void next.release().catch(() => {});
          return;
        }
        sentinel = next;
      })
      .catch(() => {
        // Unsupported, denied, or interrupted: continue without a lock.
      });
  }

  function release(): void {
    generation += 1;
    releaseSentinel();
  }

  function onVisibilityChange(): void {
    if (visibility.visibilityState === 'visible') {
      acquire();
    } else {
      release();
    }
  }

  acquire();
  visibility.addEventListener('visibilitychange', onVisibilityChange);

  return {
    stop() {
      stopped = true;
      visibility.removeEventListener('visibilitychange', onVisibilityChange);
      release();
    },
  };
}
