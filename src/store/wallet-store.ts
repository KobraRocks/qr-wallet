import { resolveActiveCardId, type Wallet } from '../domain/wallet';
import { createSeedWallet } from './seed-wallet';
import { CORRUPT_WALLET_KEY, WALLET_KEY, type Storage } from './storage';
import { validateWallet, WalletValidationError } from './wallet-validation';

/** Loads, saves, validates, seeds, and remembers the active Card through an injected Storage. */
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

  /**
   * Makes the given Card active and saves the Wallet, returning the updated
   * Wallet. An id that does not resolve throws instead of silently repairing,
   * so a caller can never activate a Card that is no longer in the Wallet.
   */
  setActiveCard(cardId: string): Wallet {
    const wallet = this.load();
    if (!wallet.cards.some((card) => card.id === cardId)) {
      throw new WalletValidationError(`Card "${cardId}" does not exist in the Wallet.`);
    }
    return this.save({ ...wallet, activeCardId: cardId });
  }

  private seed(): Wallet {
    return this.save(createSeedWallet());
  }

  /**
   * Repairs a stored active id that does not resolve to the first Card (or to
   * null when the Wallet is empty) and persists the repair, so every launch
   * after the first already holds a resolvable active id.
   */
  private repairActiveCard(wallet: Wallet): Wallet {
    const activeCardId = resolveActiveCardId(wallet);
    if (activeCardId === wallet.activeCardId) {
      return wallet;
    }
    return this.save({ ...wallet, activeCardId });
  }
}
