import { createCardId, type Card } from '../domain/card';
import { WALLET_VERSION, type Wallet } from '../domain/wallet';

/**
 * The three placeholder Cards created on first launch only: Visit Card,
 * Website, and Sales Deck. They use example.com data so a first scan is
 * meaningful without the owner entering anything.
 */
export function createSeedWallet(now: () => string = () => new Date().toISOString()): Wallet {
  const updatedAt = now();

  const visitCard: Card = {
    id: createCardId(),
    label: 'Visit Card',
    updatedAt,
    source: {
      kind: 'visit',
      firstName: 'Ada',
      lastName: 'Lovelace',
      organization: 'Analytical Engines',
      title: 'Mathematician',
      phone: '+44 20 7946 0958',
      email: 'ada@example.com',
      website: 'https://example.com/',
    },
  };

  const website: Card = {
    id: createCardId(),
    label: 'Website',
    updatedAt,
    source: { kind: 'link', url: 'https://example.com/' },
  };

  const salesDeck: Card = {
    id: createCardId(),
    label: 'Sales Deck',
    updatedAt,
    source: { kind: 'link', url: 'https://example.com/sales-deck' },
  };

  return {
    version: WALLET_VERSION,
    cards: [visitCard, website, salesDeck],
    activeCardId: visitCard.id,
  };
}
