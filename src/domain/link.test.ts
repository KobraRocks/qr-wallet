import { describe, expect, it } from 'vitest';
import { InvalidUrlError, normalizeUrl } from './link';

describe('normalizeUrl', () => {
  it('prepends https:// when the input has no scheme', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
    expect(normalizeUrl('example.com/path?q=1')).toBe('https://example.com/path?q=1');
  });

  it('preserves an explicit web scheme', () => {
    expect(normalizeUrl('http://example.com/path')).toBe('http://example.com/path');
    expect(normalizeUrl('https://example.com/path?q=1#frag')).toBe(
      'https://example.com/path?q=1#frag',
    );
  });

  it('keeps explicit mailto: and tel: links', () => {
    expect(normalizeUrl('mailto:ada@example.com')).toBe('mailto:ada@example.com');
    expect(normalizeUrl('tel:+442079460958')).toBe('tel:+442079460958');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeUrl('  example.com  ')).toBe('https://example.com/');
  });

  it('rejects input that cannot be parsed as a URL', () => {
    expect(() => normalizeUrl('not a url')).toThrow(InvalidUrlError);
    expect(() => normalizeUrl('')).toThrow(InvalidUrlError);
    expect(() => normalizeUrl('   ')).toThrow(InvalidUrlError);
  });
});
