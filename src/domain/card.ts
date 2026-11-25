/** The payload format a card carries. */
export type CardKind = 'visit' | 'link' | 'text';

/** The fields a Visit Card carries; the vCard serializer derives its Payload. */
export interface VisitCardSource {
  readonly kind: 'visit';
  readonly firstName: string;
  readonly lastName: string;
  readonly organization: string;
  readonly title: string;
  readonly phone: string;
  readonly email: string;
  readonly website: string;
}

/** A Link card stores its normalized URL. */
export interface LinkSource {
  readonly kind: 'link';
  readonly url: string;
}

/** A Text card stores its content verbatim. */
export interface TextSource {
  readonly kind: 'text';
  readonly text: string;
}

/** The discriminated union that the Payload is derived from. */
export type PayloadSource = VisitCardSource | LinkSource | TextSource;

/** A saved Wallet entry: a label, a Card Kind, and the source of one Payload. */
export interface Card {
  readonly id: string;
  readonly label: string;
  readonly source: PayloadSource;
  /** ISO 8601 timestamp of the last edit. */
  readonly updatedAt: string;
}

/** The domain term for a card's kind, derived from its payload source. */
export function cardKind(card: Card): CardKind {
  return card.source.kind;
}

/** Generates a unique Card id. `crypto.randomUUID` is available in browsers and Node. */
export function createCardId(): string {
  return crypto.randomUUID();
}
