/** The subset of `navigator.storage` the app uses. */
export interface StorageManagerLike {
  persist?: () => Promise<boolean>;
}

/**
 * Best-effort request that the browser keep the origin's data (the Wallet and
 * the offline shell) instead of evicting it under storage pressure.
 *
 * Persistence is a hint, not a guarantee, and not every browser implements it:
 * a missing API, a denial, or an error must never affect startup.
 */
export function requestPersistentStorage(storage: StorageManagerLike | undefined): void {
  const persist = storage?.persist;
  if (persist === undefined) {
    return;
  }
  try {
    void persist.call(storage).catch(() => {
      // Denied or unavailable: the Wallet store and Backup still work.
    });
  } catch {
    // Some implementations throw synchronously when the API is blocked.
  }
}
