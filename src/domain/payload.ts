import type { Card } from './card';
import { serializeVisitCard } from './vcard';

/** The maximum Payload size in UTF-8 bytes; larger Payloads scan unreliably. */
export const PAYLOAD_MAX_BYTES = 800;

const encoder = new TextEncoder();

/** Counts the UTF-8 bytes a string occupies. */
export function utf8ByteLength(value: string): number {
  return encoder.encode(value).length;
}

/** Raised when a Payload exceeds the 800-byte ceiling. */
export class PayloadTooLargeError extends Error {
  readonly bytes: number;

  constructor(bytes: number) {
    super(`Payload is ${bytes} bytes; the maximum is ${PAYLOAD_MAX_BYTES} bytes.`);
    this.name = 'PayloadTooLargeError';
    this.bytes = bytes;
  }
}

/** The single source of the exact string a card's QR code encodes. */
export function derivePayload(card: Card): string {
  switch (card.source.kind) {
    case 'visit':
      return serializeVisitCard(card.source);
    case 'link':
      return card.source.url;
    case 'text':
      return card.source.text;
  }
}

/** Enforces the 800-byte Payload ceiling. */
export function assertPayloadFits(payload: string): void {
  const bytes = utf8ByteLength(payload);
  if (bytes > PAYLOAD_MAX_BYTES) {
    throw new PayloadTooLargeError(bytes);
  }
}
