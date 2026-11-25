import type { Wallet } from '../src/domain/wallet';

/** The in-memory fake Storage the Wallet store is tested against. */
export class InMemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

/** A Storage whose writes always fail, to prove write failures are surfaced. */
export class FailingStorage extends InMemoryStorage {
  override setItem(): void {
    throw new Error('storage write failed');
  }
}

/** Builds a valid empty Wallet for tests that need to start from one. */
export function emptyWallet(): Wallet {
  return { version: 1, cards: [], activeCardId: null };
}
