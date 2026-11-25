/** The Payload format a Card carries. */
export type CardKind = 'visit' | 'link' | 'text';

/** The longest allowed Card label, in characters. */
export const MAX_LABEL_LENGTH = 40;

/** The canonical human name of each Card Kind; also a new Card's default label. */
export const CARD_KIND_NAMES: Readonly<Record<CardKind, string>> = {
  visit: 'Visit Card',
  link: 'Link',
  text: 'Text',
};

/** The Card Kinds in the order the kind switcher offers them. */
export const CARD_KINDS: readonly CardKind[] = ['visit', 'link', 'text'];

/** The fields a Visit Card carries, independent of whether it is saved or edited. */
export interface VisitCardFields {
  readonly firstName: string;
  readonly lastName: string;
  readonly organization: string;
  readonly title: string;
  readonly phone: string;
  readonly email: string;
  readonly website: string;
}

/** A Visit Card's fields; the vCard serializer derives its Payload from them. */
export interface VisitCardSource extends VisitCardFields {
  readonly kind: 'visit';
}

/** A Link Card stores its normalized URL. */
export interface LinkSource {
  readonly kind: 'link';
  readonly url: string;
}

/** A Text Card stores its Payload verbatim. */
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

/** Generates a unique Card id. `crypto.randomUUID` is available in browsers and Node. */
export function createCardId(): string {
  return crypto.randomUUID();
}
