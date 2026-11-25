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
