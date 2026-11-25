/** Raised when a Link value cannot be parsed as a URL. */
export class InvalidUrlError extends Error {
  constructor(input: string) {
    super(`"${input}" is not a valid URL.`);
    this.name = 'InvalidUrlError';
  }
}

/**
 * A scheme is explicit only when it is followed by `//` (`https://`, `ftp://`…),
 * or when it is one of the non-web schemes a scan can act on (`mailto:`,
 * `tel:`). Without this rule `example.com:8080` and `localhost:3000` would be
 * mistaken for opaque-scheme URLs.
 */
function hasExplicitScheme(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^(mailto|tel):/i.test(value);
}

/**
 * Normalizes a Link or a Visit Card website.
 *
 * An explicit scheme is preserved and otherwise `https://` is prepended. The
 * result must parse as a URL; the parsed, serialized value is what is
 * displayed, copied, and encoded.
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '') {
    throw new InvalidUrlError(input);
  }

  const candidate = hasExplicitScheme(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate).toString();
  } catch {
    throw new InvalidUrlError(input);
  }
}
