import { describe, expect, it } from 'vitest';
import { requestPersistentStorage } from './persistent-storage';

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('requestPersistentStorage', () => {
  it('asks the browser to persist storage on startup', () => {
    let calls = 0;
    const storage = {
      persist() {
        calls += 1;
        return Promise.resolve(true);
      },
    };

    requestPersistentStorage(storage);

    expect(calls).toBe(1);
  });

  it('accepts a granted, denied, or missing answer without complaint', async () => {
    const answers = [Promise.resolve(true), Promise.resolve(false)];

    expect(() => {
      requestPersistentStorage({ persist: () => answers[0] ?? Promise.resolve(false) });
      requestPersistentStorage({ persist: () => answers[1] ?? Promise.resolve(false) });
      requestPersistentStorage(undefined);
      requestPersistentStorage({});
    }).not.toThrow();
    await settle();
  });

  it('swallows a rejected persistence request', async () => {
    requestPersistentStorage({ persist: () => Promise.reject(new Error('denied')) });

    await settle();
  });

  it('swallows a synchronous throw from the storage manager', () => {
    expect(() =>
      requestPersistentStorage({
        persist() {
          throw new Error('unavailable');
        },
      }),
    ).not.toThrow();
  });
});
