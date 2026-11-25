import { describe, expect, it } from 'vitest';
import { emptyWallet, FailingStorage, InMemoryStorage } from '../../test/helpers';
import type { Card, VisitCardSource } from '../domain/card';
import { PayloadTooLargeError } from '../domain/payload';
import { activeCard, type Wallet } from '../domain/wallet';
import { CORRUPT_WALLET_KEY, WALLET_KEY } from './storage';
import { WalletValidationError } from './wallet-validation';
import { WalletStore } from './wallet-store';

const SEED_LABELS = ['Visit Card', 'Website', 'Sales Deck'];

function visitCard(
  id: string,
  overrides: Partial<Omit<VisitCardSource, 'kind'>> = {},
): Card {
  return {
    id,
    label: `Card ${id}`,
    updatedAt: '2026-01-01T00:00:00.000Z',
    source: {
      kind: 'visit',
      firstName: 'Ada',
      lastName: 'Lovelace',
      organization: '',
      title: '',
      phone: '',
      email: '',
      website: '',
      ...overrides,
    },
  };
}

function linkCard(id: string, url = 'https://example.com/'): Card {
  return {
    id,
    label: `Card ${id}`,
    updatedAt: '2026-01-01T00:00:00.000Z',
    source: { kind: 'link', url },
  };
}

function textCard(id: string, text: string): Card {
  return {
    id,
    label: `Card ${id}`,
    updatedAt: '2026-01-01T00:00:00.000Z',
    source: { kind: 'text', text },
  };
}

function walletWith(cards: readonly Card[]): Wallet {
  return { version: 1, cards, activeCardId: cards[0]?.id ?? null };
}

/** The active Card id as written to Storage, proving a repair or an activation was saved. */
function storedActiveId(storage: InMemoryStorage): unknown {
  const raw = storage.getItem(WALLET_KEY);
  return raw === null ? undefined : (JSON.parse(raw) as Record<string, unknown>)['activeCardId'];
}

describe('WalletStore first launch', () => {
  it('seeds Visit Card, Website, and Sales Deck when no Wallet exists', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);

    const wallet = store.load();

    expect(wallet.version).toBe(1);
    expect(wallet.cards.map((card) => card.label)).toEqual(SEED_LABELS);
    expect(wallet.cards.map((card) => card.source.kind)).toEqual(['visit', 'link', 'link']);

    const visitCard = wallet.cards.find((card) => card.label === 'Visit Card');
    expect(visitCard).toBeDefined();
    expect(wallet.activeCardId).toBe(visitCard?.id);
    expect(storage.getItem(WALLET_KEY)).not.toBeNull();
  });

  it('does not duplicate or re-seed the Seed Cards on a second load', () => {
    const storage = new InMemoryStorage();
    const firstLoad = new WalletStore(storage).load();
    const secondLoad = new WalletStore(storage).load();

    expect(secondLoad.cards.map((card) => card.id)).toEqual(firstLoad.cards.map((card) => card.id));
    expect(secondLoad.activeCardId).toBe(firstLoad.activeCardId);
  });

  it('does not re-seed an intentionally emptied Wallet', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    store.save({ version: 1, cards: [], activeCardId: null });

    expect(store.load()).toEqual({ version: 1, cards: [], activeCardId: null });
  });
});

describe('WalletStore round trip', () => {
  it('loads the Wallet it saved, including the active Card', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    const seeded = store.load();
    const [firstCard, secondCard] = seeded.cards;
    if (firstCard === undefined || secondCard === undefined) {
      throw new Error('expected at least two Seed Cards');
    }

    const saved = store.save({ ...seeded, activeCardId: secondCard.id });

    expect(saved.activeCardId).toBe(secondCard.id);
    expect(new WalletStore(storage).load()).toEqual(saved);
  });
});

describe('WalletStore active Card repair', () => {
  it('falls back to the first Card when the stored active id does not resolve, and persists it', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    const seeded = store.load();
    storage.setItem(WALLET_KEY, JSON.stringify({ ...seeded, activeCardId: 'missing-card' }));

    const loaded = store.load();

    expect(loaded.activeCardId).toBe(seeded.cards[0]?.id);
    expect(storedActiveId(storage)).toBe(seeded.cards[0]?.id);
  });

  it('clears an unresolvable active id in an empty Wallet', () => {
    const storage = new InMemoryStorage();
    storage.setItem(
      WALLET_KEY,
      JSON.stringify({ version: 1, cards: [], activeCardId: 'missing-card' }),
    );

    const loaded = new WalletStore(storage).load();

    expect(loaded.activeCardId).toBeNull();
    expect(activeCard(loaded)).toBeNull();
    expect(storedActiveId(storage)).toBeNull();
  });

  it('has no active Card in an empty Wallet', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    store.save({ version: 1, cards: [], activeCardId: null });

    const loaded = store.load();

    expect(loaded.activeCardId).toBeNull();
    expect(activeCard(loaded)).toBeNull();
  });
});

describe('WalletStore activating a Card', () => {
  it('persists the newly active Card and restores it on the next launch', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    const seeded = store.load();
    const [firstCard, , thirdCard] = seeded.cards;
    if (firstCard === undefined || thirdCard === undefined) {
      throw new Error('expected three Seed Cards');
    }
    expect(seeded.activeCardId).toBe(firstCard.id);

    const activated = store.setActiveCard(thirdCard.id);

    expect(activated.activeCardId).toBe(thirdCard.id);
    expect(activeCard(activated)?.id).toBe(thirdCard.id);
    expect(storedActiveId(storage)).toBe(thirdCard.id);
    expect(new WalletStore(storage).load().activeCardId).toBe(thirdCard.id);
  });

  it('rejects an id that is not in the Wallet without changing the stored active Card', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    const seeded = store.load();

    expect(() => store.setActiveCard('missing-card')).toThrow(WalletValidationError);
    expect(storedActiveId(storage)).toBe(seeded.activeCardId);
    expect(new WalletStore(storage).load().activeCardId).toBe(seeded.activeCardId);
  });

  it('cannot activate a Card in an empty Wallet', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    store.save({ version: 1, cards: [], activeCardId: null });

    expect(() => store.setActiveCard('missing-card')).toThrow(WalletValidationError);
    expect(storedActiveId(storage)).toBeNull();
  });
});

describe('WalletStore corrupt recovery', () => {
  const invalidStoredWallets: ReadonlyArray<readonly [string, unknown]> = [
    ['an unknown version', { version: 2, cards: [], activeCardId: null }],
    ['a non-array cards field', { version: 1, cards: 'nope', activeCardId: null }],
    [
      'duplicate Card ids',
      { version: 1, cards: [linkCard('same'), linkCard('same')], activeCardId: null },
    ],
    [
      'more than 100 Cards',
      {
        version: 1,
        cards: Array.from({ length: 101 }, (_, index) => linkCard(`card-${index}`)),
        activeCardId: null,
      },
    ],
    [
      'an oversized Payload',
      { version: 1, cards: [textCard('big', 'a'.repeat(801))], activeCardId: null },
    ],
    [
      'a blank label',
      { version: 1, cards: [{ ...linkCard('blank-label'), label: '   ' }], activeCardId: null },
    ],
    [
      'a Visit Card without a name',
      {
        version: 1,
        cards: [visitCard('nameless', { firstName: '', lastName: '' })],
        activeCardId: null,
      },
    ],
    [
      'an unparseable Link URL',
      { version: 1, cards: [linkCard('bad-link', 'not a url')], activeCardId: null },
    ],
  ];

  it.each(invalidStoredWallets)(
    'preserves the raw state and seeds a fresh Wallet when storage holds %s',
    (_label, invalidWallet) => {
      const raw = JSON.stringify(invalidWallet);
      const storage = new InMemoryStorage();
      storage.setItem(WALLET_KEY, raw);

      const wallet = new WalletStore(storage).load();

      expect(wallet.cards.map((card) => card.label)).toEqual(SEED_LABELS);
      expect(storage.getItem(CORRUPT_WALLET_KEY)).toBe(raw);
      expect(new WalletStore(storage).load()).toEqual(wallet);
    },
  );

  it('preserves malformed JSON verbatim and seeds a fresh Wallet', () => {
    const storage = new InMemoryStorage();
    storage.setItem(WALLET_KEY, '{not json');

    const wallet = new WalletStore(storage).load();

    expect(wallet.cards.map((card) => card.label)).toEqual(SEED_LABELS);
    expect(storage.getItem(CORRUPT_WALLET_KEY)).toBe('{not json');
  });

  it('accepts exactly 100 Cards', () => {
    const cards = Array.from({ length: 100 }, (_, index) => linkCard(`card-${index}`));
    const wallet = walletWith(cards);
    const storage = new InMemoryStorage();
    storage.setItem(WALLET_KEY, JSON.stringify(wallet));

    const loaded = new WalletStore(storage).load();

    expect(loaded.cards).toHaveLength(100);
    expect(loaded.activeCardId).toBe(cards[0]?.id);
    expect(storage.getItem(CORRUPT_WALLET_KEY)).toBeNull();
  });
});

describe('WalletStore validation on save', () => {
  it('rejects a label that is blank or longer than 40 characters', () => {
    const store = new WalletStore(new InMemoryStorage());

    expect(() =>
      store.save(walletWith([{ ...linkCard('blank'), label: '   ' }])),
    ).toThrow(WalletValidationError);
    expect(() =>
      store.save(walletWith([{ ...linkCard('long'), label: 'x'.repeat(41) }])),
    ).toThrow(WalletValidationError);
  });

  it('rejects a Visit Card without a first or last name', () => {
    const store = new WalletStore(new InMemoryStorage());

    expect(() =>
      store.save(
        walletWith([visitCard('nameless', { firstName: '', lastName: '', organization: 'Ltd' })]),
      ),
    ).toThrow(WalletValidationError);
  });

  it('rejects duplicate Card ids', () => {
    const store = new WalletStore(new InMemoryStorage());

    expect(() =>
      store.save(walletWith([linkCard('same'), linkCard('same', 'https://other.example/')])),
    ).toThrow(WalletValidationError);
  });

  it('rejects a Payload above the ceiling and reports its byte count', () => {
    const store = new WalletStore(new InMemoryStorage());
    // Three-byte characters: 267 * 3 = 801 bytes.
    const payload = '李'.repeat(267);

    expect(() => store.save(walletWith([textCard('big', payload)]))).toThrow(PayloadTooLargeError);
    try {
      store.save(walletWith([textCard('big', payload)]));
      expect.unreachable('expected PayloadTooLargeError');
    } catch (error) {
      expect((error as PayloadTooLargeError).bytes).toBe(801);
    }
  });

  it('rejects an unparseable Link URL', () => {
    const store = new WalletStore(new InMemoryStorage());

    expect(() => store.save(walletWith([linkCard('bad-link', 'not a url')]))).toThrow(
      WalletValidationError,
    );
  });

  it('surfaces storage write failures instead of discarding them', () => {
    const store = new WalletStore(new FailingStorage());

    expect(() => store.load()).toThrow('storage write failed');
    expect(() => store.save(emptyWallet())).toThrow('storage write failed');
  });
});

describe('WalletStore normalization on save', () => {
  it('normalizes Link urls and Visit Card websites', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    const visit = visitCard('visit-1', { website: 'example.com/contact' });
    const link = linkCard('link-1', 'example.com');
    const text = textCard('text-1', '  keep this verbatim  ');

    const saved = store.save({ version: 1, cards: [visit, link, text], activeCardId: visit.id });

    expect(saved.cards[0]?.source).toEqual({
      ...visit.source,
      website: 'https://example.com/contact',
    });
    expect(saved.cards[1]?.source).toEqual({ kind: 'link', url: 'https://example.com/' });
    expect(saved.cards[2]?.source).toEqual({ kind: 'text', text: '  keep this verbatim  ' });
    expect(new WalletStore(storage).load()).toEqual(saved);
  });
});

describe('WalletStore saving a Card', () => {
  it('adds a new Card at the end, makes it active, and persists both', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    const seeded = store.load();
    const card = visitCard('new-card', { firstName: 'Grace', lastName: 'Hopper' });

    const saved = store.saveCard(card);

    expect(saved.cards.map((candidate) => candidate.id)).toEqual([
      ...seeded.cards.map((candidate) => candidate.id),
      card.id,
    ]);
    expect(saved.activeCardId).toBe(card.id);
    expect(storedActiveId(storage)).toBe(card.id);
    expect(new WalletStore(storage).load()).toEqual(saved);
  });

  it('replaces an existing Card in place and keeps it active', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    const seeded = store.load();
    const target = seeded.cards[1];
    if (target === undefined) {
      throw new Error('expected Seed Cards');
    }
    const edited: Card = { ...target, label: 'Renamed' };

    const saved = store.saveCard(edited);

    expect(saved.cards).toHaveLength(seeded.cards.length);
    expect(saved.cards.map((candidate) => candidate.id)).toEqual(
      seeded.cards.map((candidate) => candidate.id),
    );
    expect(saved.cards[1]?.label).toBe('Renamed');
    expect(saved.activeCardId).toBe(edited.id);
    expect(new WalletStore(storage).load().cards[1]?.label).toBe('Renamed');
  });

  it('rejects a Card that cannot be saved and leaves the stored Wallet untouched', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    store.load();
    const rawBefore = storage.getItem(WALLET_KEY);

    expect(() =>
      store.saveCard({ ...linkCard('invalid'), label: 'x'.repeat(41) }),
    ).toThrow(WalletValidationError);
    expect(storage.getItem(WALLET_KEY)).toBe(rawBefore);
  });
});

describe('WalletStore across Card Kinds', () => {
  it('makes a saved Link or Text Card active and round-trips it', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    store.load();

    const afterLink = store.saveCard(linkCard('link-1', 'example.com'));
    expect(afterLink.activeCardId).toBe('link-1');
    expect(afterLink.cards[afterLink.cards.length - 1]?.source).toEqual({
      kind: 'link',
      url: 'https://example.com/',
    });

    const afterText = store.saveCard(textCard('text-1', '  shown verbatim  '));
    expect(afterText.activeCardId).toBe('text-1');
    expect(afterText.cards[afterText.cards.length - 1]?.source).toEqual({
      kind: 'text',
      text: '  shown verbatim  ',
    });
    expect(new WalletStore(storage).load()).toEqual(afterText);
  });

  it('replaces a Visit Card in place when its saved kind changes, dropping the vCard fields', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    const seeded = store.load();
    const visit = seeded.cards[0];
    if (visit === undefined) {
      throw new Error('expected Seed Cards');
    }

    const switched: Card = {
      id: visit.id,
      label: 'Now a Link',
      updatedAt: '2026-02-01T00:00:00.000Z',
      source: { kind: 'link', url: 'https://example.com/new' },
    };

    const saved = store.saveCard(switched);

    expect(saved.cards).toHaveLength(seeded.cards.length);
    expect(saved.cards[0]).toEqual(switched);
    expect(saved.activeCardId).toBe(visit.id);
    expect(new WalletStore(storage).load().cards[0]).toEqual(switched);
  });
});

describe('WalletStore deleting a Card', () => {
  it('removes a non-active Card and keeps the active Card', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    const seeded = store.load();
    const [activeCard, second] = seeded.cards;
    if (activeCard === undefined || second === undefined) {
      throw new Error('expected Seed Cards');
    }

    const saved = store.deleteCard(second.id);

    expect(saved.cards.map((candidate) => candidate.id)).toEqual(
      seeded.cards.filter((candidate) => candidate.id !== second.id).map((candidate) => candidate.id),
    );
    expect(saved.activeCardId).toBe(activeCard.id);
    expect(storedActiveId(storage)).toBe(activeCard.id);
    expect(new WalletStore(storage).load()).toEqual(saved);
  });

  it('activates the first remaining Card when the active Card is deleted', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    const seeded = store.load();
    const [first, second] = seeded.cards;
    if (first === undefined || second === undefined) {
      throw new Error('expected Seed Cards');
    }

    const saved = store.deleteCard(first.id);

    expect(saved.activeCardId).toBe(second.id);
    expect(storedActiveId(storage)).toBe(second.id);
  });

  it('deleting the last Card leaves a clean empty Wallet that is never re-seeded', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    const [only] = store.load().cards;
    if (only === undefined) {
      throw new Error('expected a Seed Card');
    }
    store.save({ version: 1, cards: [only], activeCardId: only.id });

    const saved = store.deleteCard(only.id);

    expect(saved.cards).toEqual([]);
    expect(saved.activeCardId).toBeNull();
    expect(activeCard(saved)).toBeNull();
    expect(storedActiveId(storage)).toBeNull();
    // A later launch reads the stored empty Wallet rather than re-seeding it.
    expect(new WalletStore(storage).load()).toEqual({ version: 1, cards: [], activeCardId: null });
    expect(storage.getItem(CORRUPT_WALLET_KEY)).toBeNull();
  });

  it('rejects deleting an id that is not in the Wallet without touching storage', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    store.load();
    const rawBefore = storage.getItem(WALLET_KEY);

    expect(() => store.deleteCard('missing-card')).toThrow(WalletValidationError);
    expect(storage.getItem(WALLET_KEY)).toBe(rawBefore);
  });
});

describe('WalletStore corrupt recovery handoff', () => {
  it('hands the raw unreadable state to the recovery banner exactly once', () => {
    const storage = new InMemoryStorage();
    storage.setItem(WALLET_KEY, '{not json');
    const store = new WalletStore(storage);

    store.load();

    expect(store.takeCorruptRecovery()).toBe('{not json');
    expect(store.takeCorruptRecovery()).toBeNull();
  });

  it('hands nothing when the stored Wallet loaded cleanly', () => {
    const store = new WalletStore(new InMemoryStorage());

    store.load();

    expect(store.takeCorruptRecovery()).toBeNull();
  });

  it('hands nothing on the launch after the Seed Cards were stored', () => {
    const storage = new InMemoryStorage();
    storage.setItem(WALLET_KEY, '{not json');
    new WalletStore(storage).load();
    const relaunched = new WalletStore(storage);

    relaunched.load();

    expect(relaunched.takeCorruptRecovery()).toBeNull();
    expect(relaunched.load().cards.map((card) => card.label)).toEqual(SEED_LABELS);
  });

  it('preserves an unknown-version Wallet byte-for-byte for the banner', () => {
    const raw = '{\n  "version": 2,\n  "cards": [],\n  "activeCardId": null\n}\n';
    const storage = new InMemoryStorage();
    storage.setItem(WALLET_KEY, raw);
    const store = new WalletStore(storage);

    const wallet = store.load();

    expect(wallet.cards.map((card) => card.label)).toEqual(SEED_LABELS);
    expect(storage.getItem(CORRUPT_WALLET_KEY)).toBe(raw);
    expect(store.takeCorruptRecovery()).toBe(raw);
  });
});
