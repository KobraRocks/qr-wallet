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

  it('rejects literal whitespace inside a URL, where the browser host parser is lenient', () => {
    // Node and Chromium disagree about a space in a host: Chromium accepts
    // "https://exa mple.com" as "https://exa%20mple.com/", and both accept a
    // tab, which the URL parser strips. A literal character that can never
    // appear in a URL must be rejected before the parser sees it, so the store
    // and the editor agree.
    expect(() => normalizeUrl('https://exa mple.com')).toThrow(InvalidUrlError);
    expect(() => normalizeUrl('https://exa\tmple.com')).toThrow(InvalidUrlError);
    expect(() => normalizeUrl('mailto:ada lovelace@example.com')).toThrow(InvalidUrlError);
  });

  it('rejects a percent-encoded URL host, which Chromium tolerates', () => {
    expect(() => normalizeUrl('https://exa%20mple.com')).toThrow(InvalidUrlError);
  });
});
