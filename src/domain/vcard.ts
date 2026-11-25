import type { VisitCardSource } from './card';

const CRLF = '\r\n';

/** Raised when a Visit Card has neither a first nor a last name. */
export class VisitCardNameError extends Error {
  constructor() {
    super('A Visit Card requires at least one of first or last name.');
    this.name = 'VisitCardNameError';
  }
}

/** Escapes one vCard 3.0 property value: backslash, semicolon, comma, newlines. */
function escapeValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Emits `NAME:value`, or omits the property entirely when the value is blank. */
function property(name: string, value: string): string | null {
  const escaped = escapeValue(value.trim());
  return escaped === '' ? null : `${name}:${escaped}`;
}

function joinFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter((part) => part !== '').join(' ');
}

/**
 * Serializes a Visit Card to a vCard 3.0 Payload.
 *
 * The exact property order is fixed: BEGIN, VERSION, N, FN, ORG, TITLE,
 * TEL;TYPE=CELL, EMAIL;TYPE=INTERNET, URL, END. Lines are joined with CRLF,
 * including a trailing CRLF after END:VCARD. Blank optional properties are
 * omitted. Line folding is deliberately not implemented.
 */
export function serializeVisitCard(source: VisitCardSource): string {
  const firstName = source.firstName.trim();
  const lastName = source.lastName.trim();
  if (firstName === '' && lastName === '') {
    throw new VisitCardNameError();
  }

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeValue(lastName)};${escapeValue(firstName)};;;`,
    `FN:${escapeValue(joinFullName(firstName, lastName))}`,
  ];

  const optionalProperties: ReadonlyArray<readonly [string, string]> = [
    ['ORG', source.organization],
    ['TITLE', source.title],
    ['TEL;TYPE=CELL', source.phone],
    ['EMAIL;TYPE=INTERNET', source.email],
    ['URL', source.website],
  ];
  for (const [name, value] of optionalProperties) {
    const line = property(name, value);
    if (line !== null) {
      lines.push(line);
    }
  }

  lines.push('END:VCARD');
  return `${lines.join(CRLF)}${CRLF}`;
}
