import { describe, expect, it } from 'vitest';
import { QR_SVG_MIME_TYPE, qrSvgBlob, qrSvgFile, qrSvgFileName, slugifyCardLabel } from './file';

describe('slugifyCardLabel', () => {
  it('lowercases a plain label and hyphenates its words', () => {
    expect(slugifyCardLabel('Sales Deck')).toBe('sales-deck');
  });

  it('collapses punctuation, spacing, and path separators into single hyphens', () => {
    expect(slugifyCardLabel('  ../My  Website!!  ')).toBe('my-website');
  });

  it('strips accents so the filename stays portable ASCII', () => {
    expect(slugifyCardLabel('Café ☕')).toBe('cafe');
  });

  it('falls back to a stable stem when the label has no ASCII slug characters', () => {
    expect(slugifyCardLabel('連絡先')).toBe('qr-code');
    expect(slugifyCardLabel('!!!')).toBe('qr-code');
  });

  it('caps the stem and never leaves a trailing hyphen', () => {
    const stem = slugifyCardLabel(`${'a'.repeat(59)} b`);

    expect(stem.length).toBeLessThanOrEqual(60);
    expect(stem.endsWith('-')).toBe(false);
    expect(stem).toBe('a'.repeat(59));
  });

  it('always produces a safe single path segment', () => {
    for (const label of ['Visit Card', '../../etc/passwd', 'C:\\temp', 'a/b', '💳 Wallet']) {
      const stem = slugifyCardLabel(label);
      expect(stem).toMatch(/^[a-z0-9-]+$/);
      expect(stem.startsWith('-')).toBe(false);
      expect(stem.endsWith('-')).toBe(false);
    }
  });
});

describe('qrSvgFileName', () => {
  it('names the SVG from the Card label', () => {
    expect(qrSvgFileName('Website')).toBe('website.svg');
    expect(qrSvgFileName('Visit Card')).toBe('visit-card.svg');
  });

  it('still ends in .svg when the label has no usable characters', () => {
    expect(qrSvgFileName('連絡先')).toBe('qr-code.svg');
  });
});

describe('qrSvgBlob', () => {
  it('wraps the guarded SVG markup in an image/svg+xml Blob', async () => {
    const blob = qrSvgBlob('<svg></svg>');

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe(QR_SVG_MIME_TYPE);
    expect(blob.size).toBe(11);
    expect(await blob.text()).toBe('<svg></svg>');
  });

  it('counts size in UTF-8 bytes rather than characters', () => {
    expect(qrSvgBlob('é').size).toBe(2);
  });
});

describe('qrSvgFile', () => {
  it('builds a shareable SVG File named from the Card label', async () => {
    const file = qrSvgFile('<svg></svg>', 'Sales Deck');

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('sales-deck.svg');
    expect(file.type).toBe(QR_SVG_MIME_TYPE);
    expect(file.size).toBe(11);
    expect(await file.text()).toBe('<svg></svg>');
  });
});
