import { describe, expect, it } from 'vitest';
import { cardDisplayName, type Card } from './card';

function cardOf(source: Card['source'], label = 'Visit Card'): Card {
  return { id: 'card-1', label, source, updatedAt: '2026-11-26T00:00:00.000Z' };
}

const visitFields = {
  organization: 'Analytical Engines',
  title: 'Mathematician',
  phone: '',
  email: '',
  website: '',
} as const;

describe('cardDisplayName', () => {
  it('joins a trimmed first and last name', () => {
    const card = cardOf({
      kind: 'visit',
      firstName: '  Ada ',
      lastName: ' Lovelace ',
      ...visitFields,
    });

    expect(cardDisplayName(card)).toBe('Ada Lovelace');
  });

  it('falls back to the label when a Visit Card has no name', () => {
    const card = cardOf({ kind: 'visit', firstName: ' ', lastName: '', ...visitFields });

    expect(cardDisplayName(card)).toBe('Visit Card');
  });

  it('uses one name part when only one is present', () => {
    const card = cardOf({ kind: 'visit', firstName: 'Ada', lastName: '', ...visitFields });

    expect(cardDisplayName(card)).toBe('Ada');
  });

  it('uses the label for Link and Text Cards', () => {
    expect(cardDisplayName(cardOf({ kind: 'link', url: 'https://example.com/' }, 'Website'))).toBe(
      'Website',
    );
    expect(cardDisplayName(cardOf({ kind: 'text', text: 'Open 9–5' }, 'Hours'))).toBe('Hours');
  });
});
