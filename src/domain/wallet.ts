import type { Card } from './card';

/** The Wallet format version. Version 1 is strict until a real v2 exists. */
export const WALLET_VERSION = 1;

/** The complete set of Cards on one device. */
export interface Wallet {
  readonly version: typeof WALLET_VERSION;
  readonly cards: readonly Card[];
  readonly activeCardId: string | null;
}

/** The resolved active Card, or null when the Wallet is empty. */
export function activeCard(wallet: Wallet): Card | null {
  return wallet.cards.find((card) => card.id === wallet.activeCardId) ?? null;
}

/**
 * The active Card id the Wallet should hold: the stored id when it resolves,
 * otherwise the first Card's id, or null when the Wallet has no Cards.
 */
export function resolveActiveCardId(wallet: Wallet): string | null {
  return activeCard(wallet)?.id ?? wallet.cards[0]?.id ?? null;
}
