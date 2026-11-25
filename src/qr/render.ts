import { encodeQR } from 'qr';

/** The quiet zone around the symbol, in modules. */
export const QR_QUIET_ZONE_MODULES = 4;

const ERROR_CORRECTION = 'medium' as const;

/**
 * Markup that must never reach the DOM from the QR package. The package output
 * is a bare `<svg viewBox>` with one `<path>`; this guard makes that an asserted
 * invariant before insertion rather than an assumption.
 */
const UNSAFE_SVG_MARKUP = /<script|<foreignObject|<iframe|<object|<embed|javascript:|\son[a-z]+\s*=|style=|href=/i;

function assertSafeQrSvg(svg: string): void {
  if (!svg.startsWith('<svg')) {
    throw new Error('QR renderer produced a document that is not an SVG.');
  }
  if (UNSAFE_SVG_MARKUP.test(svg)) {
    throw new Error('QR renderer produced SVG markup that is unsafe to insert.');
  }
}

/**
 * Renders a Payload as an inline SVG QR code.
 *
 * Medium error correction and a four-module quiet zone are fixed by the spec.
 * The SVG carries no size or colour: the QR Panel supplies a pure white
 * background and pure black fill, so the code is never themed or inverted.
 */
export function renderQrSvg(payload: string): string {
  const svg = encodeQR(payload, 'svg', {
    ecc: ERROR_CORRECTION,
    border: QR_QUIET_ZONE_MODULES,
  });
  assertSafeQrSvg(svg);
  return svg;
}
