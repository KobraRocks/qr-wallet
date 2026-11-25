import { describe, expect, it } from 'vitest';
import type { Card, PayloadSource } from './card';
import {
  assertPayloadFits,
  derivePayload,
  PAYLOAD_MAX_BYTES,
  PayloadTooLargeError,
  utf8ByteLength,
} from './payload';

function card(source: PayloadSource): Card {
  return {
    id: 'card-1',
    label: 'Example',
    source,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('derivePayload', () => {
  it('derives a vCard Payload for a Visit Card', () => {
    const payload = derivePayload(
      card({
        kind: 'visit',
        firstName: '',
        lastName: 'Lovelace',
        organization: '',
        title: '',
        phone: '',
        email: '',
        website: '',
      }),
    );

    const expected = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Lovelace;;;;',
      'FN:Lovelace',
      'END:VCARD',
      '',
    ].join('\r\n');

    expect(payload).toBe(expected);
  });

  it('uses a Link card normalized URL as its Payload', () => {
    expect(derivePayload(card({ kind: 'link', url: 'https://example.com/' }))).toBe(
      'https://example.com/',
    );
  });

  it('uses Text card content verbatim as its Payload', () => {
    expect(derivePayload(card({ kind: 'text', text: '  hello\nworld  ' }))).toBe(
      '  hello\nworld  ',
    );
  });
});

describe('utf8ByteLength', () => {
  it('counts UTF-8 bytes rather than characters', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('李')).toBe(3);
  });
});

describe('assertPayloadFits', () => {
  it('exposes an 800-byte ceiling', () => {
    expect(PAYLOAD_MAX_BYTES).toBe(800);
  });

  it('allows a Payload of exactly 800 bytes', () => {
    expect(() => assertPayloadFits('a'.repeat(800))).not.toThrow();
    expect(() => assertPayloadFits('é'.repeat(400))).not.toThrow();
  });

  it('rejects a Payload above 800 bytes and reports the byte count', () => {
    expect(() => assertPayloadFits('a'.repeat(801))).toThrow(PayloadTooLargeError);

    try {
      assertPayloadFits('李'.repeat(267));
      expect.unreachable('expected PayloadTooLargeError');
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadTooLargeError);
      expect((error as PayloadTooLargeError).bytes).toBe(801);
      expect((error as PayloadTooLargeError).message).toContain('801');
    }
  });
});
