import { describe, expect, it } from 'vitest';
import { MAX_LABEL_LENGTH, type Card } from './card';
import { derivePayload } from './payload';
import {
  type CardDraft,
  DEFAULT_NEW_CARD_KIND,
  draftFromCard,
  newCardDraft,
  switchDraftKind,
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

function linkDraft(overrides: { label?: string; linkUrl?: string } = {}): CardDraft {
  const base = newCardDraft('link');
  return {
    ...base,
    label: overrides.label ?? base.label,
    linkUrl: overrides.linkUrl ?? base.linkUrl,
  };
}

function textDraft(overrides: { label?: string; text?: string } = {}): CardDraft {
  const base = newCardDraft('text');
  return {
    ...base,
    label: overrides.label ?? base.label,
    text: overrides.text ?? base.text,
  };
}

/** A draft carrying values for all three Card Kinds, as the dialog holds them while switching. */
function draftWithEveryKindFilled(): CardDraft {
  return {
    ...newCardDraft('visit'),
    label: 'Ada',
    visit: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      organization: 'Analytical Engines',
      title: 'Mathematician',
      phone: '+44 20 7946 0958',
      email: 'ada@example.com',
      website: 'example.com',
    },
    linkUrl: 'example.com/ada',
    text: 'Meet Ada at the Analytical Engines booth.',
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

  it('labels a new draft after its Card Kind', () => {
    expect(newCardDraft('visit').label).toBe('Visit Card');
    expect(newCardDraft('link').label).toBe('Link');
    expect(newCardDraft('text').label).toBe('Text');
  });

  it('defaults a new Card to a Link with a Link label', () => {
    expect(DEFAULT_NEW_CARD_KIND).toBe('link');

    const draft = newCardDraft(DEFAULT_NEW_CARD_KIND);

    expect(draft.kind).toBe('link');
    expect(draft.label).toBe('Link');
    expect(draft.linkUrl).toBe('');
    expect(draft.visit.firstName).toBe('');
    expect(draft.text).toBe('');
  });

  it('keeps a kind default label distinct from labels already in the Wallet', () => {
    expect(newCardDraft('link', ['Link']).label).toBe('Link 2');
    expect(newCardDraft('text', ['Text', 'Text 2']).label).toBe('Text 3');
  });
});

describe('switchDraftKind', () => {
  it('changes the selected Card Kind and keeps every kind’s draft values', () => {
    const filled = draftWithEveryKindFilled();

    const asLink = switchDraftKind(filled, 'link');

    expect(asLink.kind).toBe('link');
    expect(asLink.label).toBe('Ada');
    expect(asLink.visit).toEqual(filled.visit);
    expect(asLink.linkUrl).toBe('example.com/ada');
    expect(asLink.text).toBe('Meet Ada at the Analytical Engines booth.');

    const asText = switchDraftKind(asLink, 'text');

    expect(asText.kind).toBe('text');
    expect(asText.visit).toEqual(filled.visit);
    expect(asText.linkUrl).toBe('example.com/ada');
    expect(asText.text).toBe('Meet Ada at the Analytical Engines booth.');

    const backToVisit = switchDraftKind(asText, 'visit');

    expect(backToVisit.kind).toBe('visit');
    expect(backToVisit.visit).toEqual(filled.visit);
    expect(backToVisit.linkUrl).toBe('example.com/ada');
    expect(backToVisit.text).toBe('Meet Ada at the Analytical Engines booth.');
  });

  it('does not mutate the draft it is given', () => {
    const draft = newCardDraft('visit');

    const switched = switchDraftKind(draft, 'text');

    expect(draft.kind).toBe('visit');
    expect(switched).not.toBe(draft);
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

  it('pre-fills a Link draft from the saved Card', () => {
    const card: Card = {
      id: 'link-1',
      label: 'Website',
      updatedAt: '2026-01-01T00:00:00.000Z',
      source: { kind: 'link', url: 'https://example.com/contact' },
    };

    const draft = draftFromCard(card);

    expect(draft.kind).toBe('link');
    expect(draft.label).toBe('Website');
    expect(draft.linkUrl).toBe('https://example.com/contact');
    expect(draft.visit.firstName).toBe('');
    expect(draft.text).toBe('');
  });

  it('pre-fills a Text draft from the saved Card verbatim', () => {
    const card: Card = {
      id: 'text-1',
      label: 'Hours',
      updatedAt: '2026-01-01T00:00:00.000Z',
      source: { kind: 'text', text: '  Open 9–5\nClosed Sundays  ' },
    };

    const draft = draftFromCard(card);

    expect(draft.kind).toBe('text');
    expect(draft.label).toBe('Hours');
    expect(draft.text).toBe('  Open 9–5\nClosed Sundays  ');
    expect(draft.linkUrl).toBe('');
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

describe('validateDraft Link', () => {
  it('stores and encodes example.com as https://example.com/', () => {
    const result = validateDraft(linkDraft({ linkUrl: 'example.com' }), identity);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected a valid draft');
    }
    expect(result.card.source).toEqual({ kind: 'link', url: 'https://example.com/' });
    expect(derivePayload(result.card)).toBe('https://example.com/');
  });

  const explicitSchemes: ReadonlyArray<readonly [string, string]> = [
    ['https://example.com/path?q=1#frag', 'https://example.com/path?q=1#frag'],
    ['http://example.com/contact', 'http://example.com/contact'],
    ['mailto:ada@example.com', 'mailto:ada@example.com'],
    ['tel:+442079460958', 'tel:+442079460958'],
  ];

  it.each(explicitSchemes)('preserves the explicit scheme in %s', (raw, expected) => {
    const result = validateDraft(linkDraft({ linkUrl: raw }), identity);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected a valid draft');
    }
    expect(result.card.source).toEqual({ kind: 'link', url: expected });
    expect(derivePayload(result.card)).toBe(expected);
  });

  it('rejects an unparseable URL inline and saves nothing', () => {
    const result = validateDraft(linkDraft({ linkUrl: 'not a url' }), identity);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected an invalid draft');
    }
    expect(result.errors.url).toBeDefined();
  });

  it('requires a URL', () => {
    const result = validateDraft(linkDraft({ linkUrl: '   ' }), identity);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected an invalid draft');
    }
    expect(result.errors.url).toBeDefined();
  });

  it('enforces the 800-byte ceiling on the normalized Link Payload and reports its byte count', () => {
    // "https://example.com/" is 20 bytes, so a 780-byte path is exactly 800.
    const atCeiling = validateDraft(
      linkDraft({ linkUrl: `example.com/${'x'.repeat(780)}` }),
      identity,
    );
    expect(atCeiling.ok).toBe(true);

    const overCeiling = validateDraft(
      linkDraft({ linkUrl: `example.com/${'x'.repeat(781)}` }),
      identity,
    );
    expect(overCeiling.ok).toBe(false);
    if (overCeiling.ok) {
      throw new Error('expected an invalid draft');
    }
    expect(overCeiling.errors.payload).toContain('801');
    expect(overCeiling.errors.payload).toContain('800');
  });
});

describe('validateDraft Text', () => {
  it('stores and encodes Text verbatim, including whitespace and line breaks', () => {
    const raw = '  Open 9–5\nClosed Sundays  ';

    const result = validateDraft(textDraft({ text: raw }), identity);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected a valid draft');
    }
    expect(result.card.source).toEqual({ kind: 'text', text: raw });
    expect(derivePayload(result.card)).toBe(raw);
  });

  it('rejects whitespace-only Text inline', () => {
    const result = validateDraft(textDraft({ text: '  \n\t ' }), identity);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected an invalid draft');
    }
    expect(result.errors.text).toBeDefined();
  });

  it('enforces the 800-byte ceiling on Text and reports its byte count', () => {
    expect(validateDraft(textDraft({ text: 'a'.repeat(800) }), identity).ok).toBe(true);
    // 'é' is two UTF-8 bytes, so 400 characters is exactly 800 bytes.
    expect(validateDraft(textDraft({ text: 'é'.repeat(400) }), identity).ok).toBe(true);

    const overCeiling = validateDraft(textDraft({ text: 'a'.repeat(801) }), identity);
    expect(overCeiling.ok).toBe(false);
    if (overCeiling.ok) {
      throw new Error('expected an invalid draft');
    }
    expect(overCeiling.errors.payload).toContain('801');
    expect(overCeiling.errors.payload).toContain('800');
  });

  it('counts UTF-8 bytes, not characters, when enforcing the ceiling on Text', () => {
    // 267 three-byte characters is 801 bytes.
    const result = validateDraft(textDraft({ text: '李'.repeat(267) }), identity);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected an invalid draft');
    }
    expect(result.errors.payload).toContain('801');
  });
});

describe('validateDraft after switching Card Kind', () => {
  it('saves only the selected kind’s Payload and drops the Visit Card fields', () => {
    const visit = savedVisitCard({
      phone: '+44 20 7946 0958',
      email: 'ada@example.com',
      website: 'example.com',
    });
    const switched = switchDraftKind(draftFromCard(visit), 'link');
    const ready: CardDraft = { ...switched, linkUrl: 'example.com/ada' };

    const result = validateDraft(ready, identity);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected a valid draft');
    }
    expect(result.card.label).toBe('Ada');
    expect(result.card.source).toEqual({ kind: 'link', url: 'https://example.com/ada' });
    expect(derivePayload(result.card)).toBe('https://example.com/ada');
  });

  it('restores the Visit Card draft when switching back before saving', () => {
    const original = savedVisitCard({
      phone: '+44 20 7946 0958',
      email: 'ada@example.com',
      website: 'https://example.com/',
    });
    const opened = draftFromCard(original);
    const asLink = switchDraftKind({ ...opened, linkUrl: 'example.com/ada' }, 'link');
    const asText = switchDraftKind({ ...asLink, text: 'Meet Ada at the booth.' }, 'text');

    const backToVisit = switchDraftKind(asText, 'visit');
    const result = validateDraft(backToVisit, identity);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected a valid draft');
    }
    expect(result.card.source).toEqual(original.source);
    expect(derivePayload(result.card)).toBe(derivePayload(original));
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
