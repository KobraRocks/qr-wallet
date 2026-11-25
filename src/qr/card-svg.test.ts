import { describe, expect, it } from 'vitest';
import type { Card } from '../domain/card';
import { cardQrSvg } from './card-svg';
import { renderQrSvg } from './render';

function card(source: Card['source']): Card {
  return { id: 'card-1', label: 'Example', source, updatedAt: '2026-01-01T00:00:00.000Z' };
}

describe('cardQrSvg', () => {
  it('is exactly the guarded SVG of a Link Payload', () => {
    const svg = cardQrSvg(card({ kind: 'link', url: 'https://example.com/sales-deck' }));

    expect(svg).toBe(renderQrSvg('https://example.com/sales-deck'));
  });

  it('is exactly the guarded SVG of a verbatim Text Payload', () => {
    const svg = cardQrSvg(card({ kind: 'text', text: 'Open 9–5' }));

    expect(svg).toBe(renderQrSvg('Open 9–5'));
  });

  it('is exactly the guarded SVG of a Visit Card vCard Payload', () => {
    const source = {
      kind: 'visit',
      firstName: 'Ada',
      lastName: 'Lovelace',
      organization: 'Analytical Engines',
      title: 'Mathematician',
      phone: '+44 20 7946 0958',
      email: 'ada@example.com',
      website: 'https://example.com/',
    } as const;
    const expectedPayload =
      'BEGIN:VCARD\r\n' +
      'VERSION:3.0\r\n' +
      'N:Lovelace;Ada;;;\r\n' +
      'FN:Ada Lovelace\r\n' +
      'ORG:Analytical Engines\r\n' +
      'TITLE:Mathematician\r\n' +
      'TEL;TYPE=CELL:+44 20 7946 0958\r\n' +
      'EMAIL;TYPE=INTERNET:ada@example.com\r\n' +
      'URL:https://example.com/\r\n' +
      'END:VCARD\r\n';

    expect(cardQrSvg(card(source))).toBe(renderQrSvg(expectedPayload));
  });

  it('never embeds the Payload in the shared markup', () => {
    const svg = cardQrSvg(card({ kind: 'text', text: '</svg><script>alert(1)</script>' }));

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('alert(1)');
  });
});
