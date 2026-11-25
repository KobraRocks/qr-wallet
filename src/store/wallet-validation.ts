import { MAX_LABEL_LENGTH, type Card, type PayloadSource } from '../domain/card';
import { InvalidUrlError, normalizeUrl } from '../domain/link';
import { assertPayloadFits, derivePayload } from '../domain/payload';
import { WALLET_VERSION, type Wallet } from '../domain/wallet';

const MAX_CARDS = 100;

/** Raised when stored or imported state is not a valid Wallet. */
export class WalletValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletValidationError';
  }
}

function fail(message: string): never {
  throw new WalletValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Version 1 is a strict shape: missing and unexpected properties are both invalid. */
function requireExactKeys(
  record: Record<string, unknown>,
  expected: readonly string[],
  context: string,
): void {
  for (const key of expected) {
    if (!(key in record)) {
      fail(`${context} is missing the "${key}" property.`);
    }
  }
  for (const key of Object.keys(record)) {
    if (!expected.includes(key)) {
      fail(`${context} has an unexpected "${key}" property.`);
    }
  }
}

function requireString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    fail(`${context} "${key}" must be a string.`);
  }
  return value;
}

function normalizeLinkValue(raw: string, context: string): string {
  try {
    return normalizeUrl(raw);
  } catch (error) {
    if (error instanceof InvalidUrlError) {
      fail(`${context} has an invalid URL: "${raw}".`);
    }
    throw error;
  }
}

function parseVisitSource(
  record: Record<string, unknown>,
  context: string,
): Extract<PayloadSource, { kind: 'visit' }> {
  const sourceContext = `${context} source`;
  requireExactKeys(
    record,
    ['kind', 'firstName', 'lastName', 'organization', 'title', 'phone', 'email', 'website'],
    sourceContext,
  );

  const firstName = requireString(record, 'firstName', sourceContext);
  const lastName = requireString(record, 'lastName', sourceContext);
  if (firstName.trim() === '' && lastName.trim() === '') {
    fail(`${context} is a Visit Card without a first or last name.`);
  }

  const rawWebsite = requireString(record, 'website', sourceContext).trim();
  return {
    kind: 'visit',
    firstName,
    lastName,
    organization: requireString(record, 'organization', sourceContext),
    title: requireString(record, 'title', sourceContext),
    phone: requireString(record, 'phone', sourceContext),
    email: requireString(record, 'email', sourceContext),
    website: rawWebsite === '' ? '' : normalizeLinkValue(rawWebsite, sourceContext),
  };
}

function parseSource(value: unknown, context: string): PayloadSource {
  if (!isRecord(value)) {
    fail(`${context} source must be an object.`);
  }

  switch (value.kind) {
    case 'visit':
      return parseVisitSource(value, context);
    case 'link': {
      const sourceContext = `${context} source`;
      requireExactKeys(value, ['kind', 'url'], sourceContext);
      return { kind: 'link', url: normalizeLinkValue(requireString(value, 'url', sourceContext), sourceContext) };
    }
    case 'text': {
      const sourceContext = `${context} source`;
      requireExactKeys(value, ['kind', 'text'], sourceContext);
      const text = requireString(value, 'text', sourceContext);
      // The editor rejects whitespace-only Text; stored and imported state must
      // agree, or a Backup could reintroduce a Card the editor forbids.
      if (text.trim() === '') {
        fail(`${context} is a Text Card with blank text.`);
      }
      return { kind: 'text', text };
    }
    default:
      fail(`${context} has an unknown Card Kind.`);
  }
}

function parseCard(value: unknown, index: number): Card {
  const context = `Card ${index + 1}`;
  if (!isRecord(value)) {
    fail(`${context} must be an object.`);
  }
  requireExactKeys(value, ['id', 'label', 'source', 'updatedAt'], context);

  const id = requireString(value, 'id', context).trim();
  if (id === '') {
    fail(`${context} has an empty id.`);
  }

  const label = requireString(value, 'label', context).trim();
  if (label === '') {
    fail(`${context} has a blank label.`);
  }
  if (label.length > MAX_LABEL_LENGTH) {
    fail(`${context} label is ${label.length} characters; the maximum is ${MAX_LABEL_LENGTH}.`);
  }

  const updatedAt = requireString(value, 'updatedAt', context);
  if (Number.isNaN(Date.parse(updatedAt))) {
    fail(`${context} has an invalid updatedAt timestamp.`);
  }

  return {
    id,
    label,
    source: parseSource(value.source, context),
    updatedAt,
  };
}

/**
 * Strictly validates and canonicalizes unknown stored state into a Wallet.
 *
 * Version 1 rejects unknown versions and shapes outright. Link urls and Visit
 * Card websites are normalized here so the stored value is the value displayed,
 * copied, and encoded. Every Payload is checked against the 800-byte ceiling.
 */
export function validateWallet(value: unknown): Wallet {
  if (!isRecord(value)) {
    fail('Wallet must be an object.');
  }
  requireExactKeys(value, ['version', 'cards', 'activeCardId'], 'Wallet');

  if (value.version !== WALLET_VERSION) {
    fail(`Wallet version must be ${WALLET_VERSION}.`);
  }

  if (!Array.isArray(value.cards)) {
    fail('Wallet cards must be an array.');
  }
  if (value.cards.length > MAX_CARDS) {
    fail(`Wallet holds ${value.cards.length} Cards; the maximum is ${MAX_CARDS}.`);
  }

  const cards = value.cards.map((card, index) => parseCard(card, index));

  const ids = new Set<string>();
  for (const card of cards) {
    if (ids.has(card.id)) {
      fail(`Wallet has a duplicate Card id "${card.id}".`);
    }
    ids.add(card.id);
  }

  const activeCardId = value.activeCardId;
  if (activeCardId !== null && typeof activeCardId !== 'string') {
    fail('Wallet activeCardId must be a string or null.');
  }

  for (const card of cards) {
    assertPayloadFits(derivePayload(card));
  }

  return { version: WALLET_VERSION, cards, activeCardId };
}
