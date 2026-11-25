/** The media type of the SVG files this app shares and downloads. */
export const QR_SVG_MIME_TYPE = 'image/svg+xml';

/** The stem used when a Card label yields no usable ASCII slug characters. */
const FALLBACK_SLUG = 'qr-code';

/** The longest slug in a filename; long labels must not produce unwieldy names. */
const MAX_SLUG_LENGTH = 60;

/**
 * A safe filename stem derived from a Card label: lowercase ASCII letters,
 * digits, and single hyphens. Accents are removed, unsupported scripts fall
 * back to a stable stem, and path separators can never appear.
 */
export function slugifyCardLabel(label: string): string {
  const ascii = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const capped = ascii.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, '');
  return capped === '' ? FALLBACK_SLUG : capped;
}

/** The download filename for a Card's QR code: `<slug>.svg`. */
export function qrSvgFileName(label: string): string {
  return `${slugifyCardLabel(label)}.svg`;
}

/** Wraps guarded QR SVG markup in a Blob for sharing or downloading. */
export function qrSvgBlob(svg: string): Blob {
  return new Blob([svg], { type: QR_SVG_MIME_TYPE });
}

/** Builds the shareable SVG File for a Card, named from its label. */
export function qrSvgFile(svg: string, label: string): File {
  return new File([qrSvgBlob(svg)], qrSvgFileName(label), { type: QR_SVG_MIME_TYPE });
}
