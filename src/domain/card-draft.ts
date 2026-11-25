import { MAX_LABEL_LENGTH, type Card, type CardKind, type PayloadSource } from './card';
import { InvalidUrlError, normalizeUrl } from './link';
import { assertPayloadFits, derivePayload, PayloadTooLargeError } from './payload';

/** The Visit Card fields the editor owns, without the kind discriminant. */
export interface VisitCardDraft {
  firstName: string;
  lastName: string;
  organization: string;
  title: string;
  phone: string;
  email: string;
  website: string;
}

/**
 * One in-progress Card in the editor.
 *
 * Every Card Kind's fields are kept, so switching kind on an existing Card
 * preserves the drafts for the other kinds for the duration of the dialog.
 * Only the fields of the selected `kind` are validated and persisted.
 */
export interface CardDraft {
  readonly kind: CardKind;
  readonly label: string;
  readonly visit: VisitCardDraft;
  readonly linkUrl: string;
  readonly text: string;
}

/** The default label of a new Card, matching its Card Kind. */
const DEFAULT_LABEL_BY_KIND: Record<CardKind, string> = {
  visit: 'Visit Card',
  link: 'Link',
  text: 'Text',
};

function emptyVisitDraft(): VisitCardDraft {
  return {
    firstName: '',
    lastName: '',
    organization: '',
    title: '',
    phone: '',
    email: '',
    website: '',
  };
}

/** A default label that does not collide with a label the Wallet already holds. */
function distinctLabel(base: string, existingLabels: readonly string[]): string {
  if (!existingLabels.includes(base)) {
    return base;
  }
  let suffix = 2;
  while (existingLabels.includes(`${base} ${suffix}`)) {
    suffix += 1;
  }
  return `${base} ${suffix}`;
}

/** A fresh draft for a new Card of the given kind, with a sensible default label. */
export function newCardDraft(
  kind: CardKind,
  existingLabels: readonly string[] = [],
): CardDraft {
  return {
    kind,
    label: distinctLabel(DEFAULT_LABEL_BY_KIND[kind], existingLabels),
    visit: emptyVisitDraft(),
    linkUrl: '',
    text: '',
  };
}

/** A draft pre-filled from a saved Card so the dialog opens with its current values. */
export function draftFromCard(card: Card): CardDraft {
  const base = newCardDraft(card.source.kind);

  switch (card.source.kind) {
    case 'visit':
      return {
        ...base,
        label: card.label,
        visit: {
          firstName: card.source.firstName,
          lastName: card.source.lastName,
          organization: card.source.organization,
          title: card.source.title,
          phone: card.source.phone,
          email: card.source.email,
          website: card.source.website,
        },
      };
    case 'link':
      return { ...base, label: card.label, linkUrl: card.source.url };
    case 'text':
      return { ...base, label: card.label, text: card.source.text };
  }
}

/** The identity a validated draft keeps: a new Card gets a fresh id, an edit keeps its own. */
export interface DraftIdentity {
  readonly id: string;
  readonly updatedAt: string;
}

/** The form fields an inline validation message can attach to. */
export type DraftErrorKey = 'label' | 'name' | 'website' | 'url' | 'text' | 'payload';

/** Inline validation messages, keyed by the field they belong to. */
export type DraftErrors = Partial<Record<DraftErrorKey, string>>;

/** The outcome of validating a draft: the Card to save, or the inline errors to show. */
export type DraftValidation =
  | { readonly ok: true; readonly card: Card }
  | { readonly ok: false; readonly errors: DraftErrors };

/** The inline message shown when a URL cannot be parsed. */
const INVALID_URL_MESSAGE = 'Enter a valid URL, for example example.com.';

/**
 * Normalizes a website or Link URL on save: a blank value is omitted, an
 * explicit scheme is preserved, and otherwise https:// is prepended.
 */
function normalizedUrl(raw: string, errorKey: 'website' | 'url', errors: DraftErrors): string {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return '';
  }
  try {
    return normalizeUrl(trimmed);
  } catch (error) {
    if (error instanceof InvalidUrlError) {
      errors[errorKey] = INVALID_URL_MESSAGE;
      return '';
    }
    throw error;
  }
}

/** Builds the Payload source for the draft's selected kind, attaching kind-specific errors. */
function sourceFromDraft(draft: CardDraft, errors: DraftErrors): PayloadSource {
  switch (draft.kind) {
    case 'visit': {
      const firstName = draft.visit.firstName.trim();
      const lastName = draft.visit.lastName.trim();
      if (firstName === '' && lastName === '') {
        errors.name = 'Enter a first or last name.';
      }
      return {
        kind: 'visit',
        firstName,
        lastName,
        organization: draft.visit.organization.trim(),
        title: draft.visit.title.trim(),
        phone: draft.visit.phone.trim(),
        email: draft.visit.email.trim(),
        website: normalizedUrl(draft.visit.website, 'website', errors),
      };
    }
    case 'link': {
      const raw = draft.linkUrl.trim();
      if (raw === '') {
        errors.url = 'Enter a URL.';
        return { kind: 'link', url: '' };
      }
      return { kind: 'link', url: normalizedUrl(raw, 'url', errors) };
    }
    case 'text':
      if (draft.text.trim() === '') {
        errors.text = 'Enter some text.';
      }
      return { kind: 'text', text: draft.text };
  }
}

/**
 * Validates a draft and builds the Card to save.
 *
 * The label is required and limited to 1–40 characters, and a Visit Card needs
 * at least one of first or last name. Website and Link URLs are normalized.
 * Every Payload must fit the 800-byte ceiling. Inline errors are returned
 * rather than thrown so Save can keep the dialog open; nothing is persisted
 * until the caller saves the returned Card.
 */
export function validateDraft(draft: CardDraft, identity: DraftIdentity): DraftValidation {
  const errors: DraftErrors = {};

  const label = draft.label.trim();
  if (label === '') {
    errors.label = 'Enter a label.';
  } else if (label.length > MAX_LABEL_LENGTH) {
    errors.label = `Label must be ${MAX_LABEL_LENGTH} characters or fewer (currently ${label.length}).`;
  }

  const source = sourceFromDraft(draft, errors);
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const card: Card = { id: identity.id, label, source, updatedAt: identity.updatedAt };

  try {
    assertPayloadFits(derivePayload(card));
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return { ok: false, errors: { payload: error.message } };
    }
    throw error;
  }

  return { ok: true, card };
}
