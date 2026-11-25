/** Raised when a Link value cannot be parsed as a URL. */
export class InvalidUrlError extends Error {
  constructor(input: string) {
    super(`"${input}" is not a valid URL.`);
    this.name = 'InvalidUrlError';
  }
}

/** An RFC 3986 scheme prefix: `https:`, `mailto:`, `sms:`, `web+app:`. */
const SCHEME_PREFIX = /^([a-z][a-z0-9+.-]*):/i;

/** A hostname that is a dotted name or `localhost`, never a scheme in practice. */
const HOST_NAME = /^(?:localhost|(?:[a-z0-9-]+\.)+[a-z0-9-]+)$/i;

/**
 * Whether a value names its own URL scheme.
 *
 * The spec rule is: an explicit scheme is preserved, otherwise `https://` is
 * prepended, and the result must parse as a URL. RFC 3986 allows any
 * `scheme:` prefix, so `mailto:`, `tel:`, `sms:`, `geo:`, and `web+app:` are all
 * preserved and handed to the URL parser — as is a slashed web scheme such as
 * `https:example.com`, which the parser canonicalizes to `https://example.com/`.
 *
 * The one exception is a bare `host:port`, which is not an opaque-scheme URL:
 * `example.com:8080` and `localhost:3000` must become `https://…`. A dotted
 * name or `localhost` before the colon is therefore always a host, and every
 * other RFC-3986 prefix is a scheme. A single-label intranet host such as
 * `intranet:8080` is inherently ambiguous and is read as the scheme RFC 3986
 * says it is; typing `https://intranet:8080` keeps it a URL.
 */
function hasExplicitScheme(value: string): boolean {
  const scheme = SCHEME_PREFIX.exec(value)?.[1];
  if (scheme === undefined) {
    return false;
  }
  // `scheme://…` is explicit even when the scheme name looks host-like.
  const rest = value.slice(scheme.length + 1);
  return rest.startsWith('//') || !HOST_NAME.test(scheme);
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
