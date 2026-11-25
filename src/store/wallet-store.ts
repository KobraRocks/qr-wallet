import type { Wallet } from '../domain/wallet';
import { createSeedWallet } from './seed-wallet';
import { CORRUPT_WALLET_KEY, WALLET_KEY, type Storage } from './storage';
import { validateWallet } from './wallet-validation';

/** Loads, saves, validates, and seeds the Wallet through an injected Storage. */
export class WalletStore {
  private readonly storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  load(): Wallet {
    const stored = this.storage.getItem(WALLET_KEY);
    if (stored === null) {
      return this.seed();
    }

    try {
      const parsed: unknown = JSON.parse(stored);
      return this.repairActiveCard(validateWallet(parsed));
    } catch {
      // Preserve the unreadable state verbatim, then start over from the Seed
      // Cards. The banner that offers the raw copy belongs to a later ticket.
      this.storage.setItem(CORRUPT_WALLET_KEY, stored);
      return this.seed();
    }
  }

  save(wallet: Wallet): Wallet {
    const validated = validateWallet(wallet);
    // One atomic write for the whole Wallet.
    this.storage.setItem(WALLET_KEY, JSON.stringify(validated));
    return validated;
  }

  private seed(): Wallet {
    return this.save(createSeedWallet());
  }

  private repairActiveCard(wallet: Wallet): Wallet {
    const ids = new Set(wallet.cards.map((card) => card.id));
    if (wallet.activeCardId !== null && ids.has(wallet.activeCardId)) {
      return wallet;
    }
    return { ...wallet, activeCardId: wallet.cards[0]?.id ?? null };
  }
}
