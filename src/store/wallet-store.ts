import type { Card } from '../domain/card';
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

  /**
   * Saves a new or edited Card in the Wallet and makes it active, so the QR
   * Panel and Pills show the Card the owner just saved. A new Card is appended;
   * an edited Card replaces its previous version without reordering the Wallet.
   * Appending, replacing, and the Payload ceiling are validated by save().
   */
  saveCard(card: Card): Wallet {
    const wallet = this.load();
    const exists = wallet.cards.some((candidate) => candidate.id === card.id);
    const cards = exists
      ? wallet.cards.map((candidate) => (candidate.id === card.id ? card : candidate))
      : [...wallet.cards, card];
    return this.save({ ...wallet, cards, activeCardId: card.id });
  }

  /**
   * Removes a Card and persists the Wallet. Deleting the active Card activates
   * the first remaining Card; deleting the last Card leaves an empty Wallet and
   * never re-seeds it. An unknown id throws without touching storage.
   */
  deleteCard(cardId: string): Wallet {
    const wallet = this.load();
    const cards = wallet.cards.filter((card) => card.id !== cardId);
    if (cards.length === wallet.cards.length) {
      throw new WalletValidationError(`Card "${cardId}" does not exist in the Wallet.`);
    }
    const next: Wallet = { ...wallet, cards };
    return this.save({ ...next, activeCardId: resolveActiveCardId(next) });
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
