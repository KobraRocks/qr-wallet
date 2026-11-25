import { describe, expect, it } from 'vitest';
import { MAX_LABEL_LENGTH, type Card } from './card';
import { derivePayload } from './payload';
import {
  type CardDraft,
  draftFromCard,
  newCardDraft,
  validateDraft,
  type VisitCardDraft,
} from './card-draft';

const identity = { id: 'card-1', updatedAt: '2026-01-01T00:00:00.000Z' };

function visitDraft(
  overrides: { label?: string } & Partial<VisitCardDraft> = {},
): CardDraft {
  const base = newCardDraft('visit');
  const { label, ...fields } = overrides;
  return {
    ...base,
    label: label ?? base.label,
    visit: { ...base.visit, ...fields },
  };
}

function savedVisitCard(overrides: Partial<Omit<VisitCardDraft, 'kind'>> = {}): Card {
  return {
    id: 'visit-1',
    label: 'Ada',
    updatedAt: '2026-01-01T00:00:00.000Z',
    source: {
      kind: 'visit',
      firstName: 'Ada',
      lastName: 'Lovelace',
      organization: 'Analytical Engines',
      title: '',
      phone: '',
      email: '',
      website: '',
      ...overrides,
    },
  };
}

describe('newCardDraft', () => {
  it('starts a Visit Card draft empty with a sensible default label', () => {
    const draft = newCardDraft('visit');

    expect(draft.kind).toBe('visit');
    expect(draft.label).toBe('Visit Card');
    expect(draft.visit).toEqual({
      firstName: '',
      lastName: '',
      organization: '',
      title: '',
      phone: '',
      email: '',
      website: '',
    });
  });

  it('keeps the default label distinct from labels already in the Wallet', () => {
    expect(newCardDraft('visit', ['Visit Card']).label).toBe('Visit Card 2');
    expect(newCardDraft('visit', ['Visit Card', 'Visit Card 2']).label).toBe('Visit Card 3');
    expect(newCardDraft('visit', ['Website', 'Sales Deck']).label).toBe('Visit Card');
  });
});

describe('draftFromCard', () => {
  it('pre-fills every Visit Card field from the saved Card', () => {
    const card = savedVisitCard({
      title: 'Mathematician',
      phone: '+44 20 7946 0958',
      email: 'ada@example.com',
      website: 'https://example.com/',
    });

    const draft = draftFromCard(card);

    expect(draft.kind).toBe('visit');
    expect(draft.label).toBe('Ada');
    expect(draft.visit).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      organization: 'Analytical Engines',
      title: 'Mathematician',
      phone: '+44 20 7946 0958',
      email: 'ada@example.com',
      website: 'https://example.com/',
    });
  });
});

describe('validateDraft labels', () => {
  it('accepts a draft and trims the label and every Visit Card value', () => {
    const result = validateDraft(
      visitDraft({ label: '  Ada  ', firstName: '  Ada ', lastName: ' Lovelace  ' }),
      identity,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected a valid draft');
    }
    expect(result.card.id).toBe(identity.id);
    expect(result.card.updatedAt).toBe(identity.updatedAt);
    expect(result.card.label).toBe('Ada');
    expect(result.card.source).toEqual({
      kind: 'visit',
      firstName: 'Ada',
      lastName: 'Lovelace',
      organization: '',
      title: '',
      phone: '',
      email: '',
      website: '',
    });
  });

  it('requires a label', () => {
    const result = validateDraft(visitDraft({ label: '   ', lastName: 'Lovelace' }), identity);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected an invalid draft');
    }
    expect(result.errors.label).toBeDefined();
  });

  it('limits the label to 40 characters and reports the count', () => {
    expect(MAX_LABEL_LENGTH).toBe(40);

    const result = validateDraft(
      visitDraft({ label: 'x'.repeat(41), lastName: 'Lovelace' }),
      identity,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected an invalid draft');
    }
    expect(result.errors.label).toContain('40');
    expect(result.errors.label).toContain('41');
    expect(validateDraft(visitDraft({ label: 'x'.repeat(40), lastName: 'Lovelace' }), identity).ok).toBe(
      true,
    );
  });
});

describe('validateDraft Visit Card name rule', () => {
  it('requires at least one of first or last name', () => {
    const result = validateDraft(visitDraft({ organization: 'No Name Ltd' }), identity);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected an invalid draft');
    }
    expect(result.errors.name).toBeDefined();
  });

  it('accepts a first name alone and a last name alone', () => {
    expect(validateDraft(visitDraft({ firstName: 'Ada' }), identity).ok).toBe(true);
    expect(validateDraft(visitDraft({ lastName: 'Lovelace' }), identity).ok).toBe(true);
  });
});

describe('validateDraft Visit Card website', () => {
  it('normalizes a website on save and keeps an explicit scheme', () => {
    const prepared = validateDraft(
      visitDraft({ lastName: 'Lovelace', website: 'example.com/contact' }),
      identity,
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      throw new Error('expected a valid draft');
    }
    expect(prepared.card.source).toMatchObject({ website: 'https://example.com/contact' });

    const explicit = validateDraft(
      visitDraft({ lastName: 'Lovelace', website: 'http://example.com/contact' }),
      identity,
    );
    expect(explicit.ok).toBe(true);
    if (!explicit.ok) {
      throw new Error('expected a valid draft');
    }
    expect(explicit.card.source).toMatchObject({ website: 'http://example.com/contact' });
  });

  it('rejects an invalid website inline', () => {
    const result = validateDraft(visitDraft({ lastName: 'Lovelace', website: 'not a url' }), identity);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected an invalid draft');
    }
    expect(result.errors.website).toBeDefined();
  });

  it('treats a blank website as omitted', () => {
    const result = validateDraft(visitDraft({ lastName: 'Lovelace', website: '   ' }), identity);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected a valid draft');
    }
    expect(result.card.source).toMatchObject({ website: '' });
  });
});

describe('validateDraft round trip into the Payload', () => {
  it('omits blank optional fields and keeps escaped characters and UTF-8 in the vCard', () => {
    const draft = visitDraft({
      firstName: 'Zoë',
      lastName: 'Müller',
      organization: 'Société; Générale, Inc\\Ltd',
      phone: '+44 20 7946 0958',
      email: 'zoe@example.com',
      title: '',
      website: 'example.com',
    });

    const result = validateDraft(draft, identity);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected a valid draft');
    }

    const expected = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Müller;Zoë;;;',
      'FN:Zoë Müller',
      'ORG:Société\\; Générale\\, Inc\\\\Ltd',
      'TEL;TYPE=CELL:+44 20 7946 0958',
      'EMAIL;TYPE=INTERNET:zoe@example.com',
      'URL:https://example.com/',
      'END:VCARD',
      '',
    ].join('\r\n');

    expect(derivePayload(result.card)).toBe(expected);
  });
});

describe('validateDraft Payload ceiling', () => {
  it('rejects a Visit Card whose Payload exceeds 800 UTF-8 bytes, reporting the byte count', () => {
    // The vCard frames 818 bytes: BEGIN(13) VERSION(13) N:;A;;;(9) FN:A(6)
    // ORG: + 760 bytes + CRLF (766) END(11).
    const result = validateDraft(
      visitDraft({ firstName: 'A', organization: 'x'.repeat(760) }),
      identity,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected an invalid draft');
    }
    expect(result.errors.payload).toContain('818');
    expect(result.errors.payload).toContain('800');
  });

  it('accepts a Payload of exactly 800 bytes or fewer', () => {
    // ORG: + 700 bytes + CRLF frames 758 bytes, under the ceiling.
    expect(validateDraft(visitDraft({ firstName: 'A', organization: 'x'.repeat(700) }), identity).ok).toBe(
      true,
    );
  });

  it('counts UTF-8 bytes, not characters, when enforcing the ceiling', () => {
    // 'é' is two UTF-8 bytes, so a 400-character organization frames 858 bytes.
    const result = validateDraft(
      visitDraft({ firstName: 'A', organization: 'é'.repeat(400) }),
      identity,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected an invalid draft');
    }
    expect(result.errors.payload).toContain('858');
  });
});
