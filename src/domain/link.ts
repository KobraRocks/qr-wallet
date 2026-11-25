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
 * Literal whitespace and control characters can never appear in a URL. The
 * browser's URL parser is more lenient than Node's — Chromium accepts
 * "https://not a url" as "https://not%20a%20url/" and both strip a tab — so
 * rejecting them here keeps save-time validation identical on both sides.
 */
const FORBIDDEN_URL_CHARACTERS = /[\s\u0000-\u001f\u007f]/;

/**
 * Normalizes a Link or a Visit Card website.
 *
 * An explicit scheme is preserved and otherwise `https://` is prepended. The
 * result must parse as a URL; the parsed, serialized value is what is
 * displayed, copied, and encoded.
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '' || FORBIDDEN_URL_CHARACTERS.test(trimmed)) {
    throw new InvalidUrlError(input);
  }

  const candidate = hasExplicitScheme(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new InvalidUrlError(input);
  }

  // A URL host cannot be percent-encoded; Chromium accepts one anyway
  // ("https://exa%20mple.com/"), Node rejects it. Reject it in one place.
  if (parsed.hostname.includes('%')) {
    throw new InvalidUrlError(input);
  }
  return parsed.toString();
}
