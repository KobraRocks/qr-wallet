import type { Card } from '../domain/card';
import { derivePayload } from '../domain/payload';
import { renderQrSvg } from './render';

/**
 * The guarded inline SVG for a Card.
 *
 * The QR Panel inserts this markup and Share writes it to a file, so both
 * surfaces always show the same code: the Card's exact Payload, rendered with
 * medium error correction, four quiet modules, and no colours of its own.
 */
export function cardQrSvg(card: Card): string {
  return renderQrSvg(derivePayload(card));
}
