import { describe, expect, it } from 'vitest';
import { serializeVisitCard, VisitCardNameError } from './vcard';
import type { VisitCardSource } from './card';

function visitCard(overrides: Partial<Omit<VisitCardSource, 'kind'>> = {}): VisitCardSource {
  return {
    kind: 'visit',
    firstName: '',
    lastName: '',
    organization: '',
    title: '',
    phone: '',
    email: '',
    website: '',
    ...overrides,
  };
}

describe('serializeVisitCard', () => {
  it('emits a vCard 3.0 document with the exact property order and CRLF line endings', () => {
    const source = visitCard({
      firstName: 'Ada',
      lastName: 'Lovelace',
      organization: 'Analytical Engines',
      title: 'Mathematician',
      phone: '+44 20 7946 0958',
      email: 'ada@example.com',
      website: 'https://example.com/',
    });

    const expected = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Lovelace;Ada;;;',
      'FN:Ada Lovelace',
      'ORG:Analytical Engines',
      'TITLE:Mathematician',
      'TEL;TYPE=CELL:+44 20 7946 0958',
      'EMAIL;TYPE=INTERNET:ada@example.com',
      'URL:https://example.com/',
      'END:VCARD',
      '',
    ].join('\r\n');

    expect(serializeVisitCard(source)).toBe(expected);
  });

  it('omits blank optional properties and still renders a card with only a last name', () => {
    const expected = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Lovelace;;;;',
      'FN:Lovelace',
      'END:VCARD',
      '',
    ].join('\r\n');

    expect(serializeVisitCard(visitCard({ lastName: 'Lovelace' }))).toBe(expected);
  });

  it('renders a card with only a first name', () => {
    const expected = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:;Ada;;;',
      'FN:Ada',
      'END:VCARD',
      '',
    ].join('\r\n');

    expect(serializeVisitCard(visitCard({ firstName: 'Ada' }))).toBe(expected);
  });

  it('escapes backslash, semicolon, comma, and newlines in property values', () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['Doe;Smith', 'Doe\\;Smith'],
      ['Doe,Smith', 'Doe\\,Smith'],
      ['Doe\\Smith', 'Doe\\\\Smith'],
      ['Doe\nSmith', 'Doe\\nSmith'],
      ['Doe\r\nSmith', 'Doe\\nSmith'],
    ];

    for (const [raw, escaped] of cases) {
      const payload = serializeVisitCard(visitCard({ lastName: raw, organization: raw }));
      expect(payload).toContain(`N:${escaped};;;;`);
      expect(payload).toContain(`FN:${escaped}`);
      expect(payload).toContain(`ORG:${escaped}`);
    }
  });

  it('preserves accented and non-Latin UTF-8 values', () => {
    const payload = serializeVisitCard(
      visitCard({
        firstName: 'Zoë',
        lastName: 'Müller',
        organization: 'Société Générale',
      }),
    );
    expect(payload).toContain('N:Müller;Zoë;;;');
    expect(payload).toContain('FN:Zoë Müller');
    expect(payload).toContain('ORG:Société Générale');

    const nonLatin = serializeVisitCard(visitCard({ firstName: '李', lastName: '雷' }));
    expect(nonLatin).toContain('N:雷;李;;;');
    expect(nonLatin).toContain('FN:李 雷');
  });

  it('rejects a Visit Card without a first or last name', () => {
    expect(() => serializeVisitCard(visitCard({ organization: 'No Name Ltd' }))).toThrow(
      VisitCardNameError,
    );
  });
});
