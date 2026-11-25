import { describe, expect, it } from 'vitest';
import { FailingStorage, InMemoryStorage } from '../../test/helpers';
import type { Card } from '../domain/card';
import type { Wallet } from '../domain/wallet';
import {
  BACKUP_FILENAME,
  type BackupFile,
  BackupImportError,
  CORRUPT_FILENAME,
  MAX_BACKUP_BYTES,
  WalletBackup,
} from './backup';
import { WalletStore } from './wallet-store';

function linkCard(id: string, url = 'https://example.com/'): Card {
  return {
    id,
    label: `Card ${id}`,
    updatedAt: '2026-01-01T00:00:00.000Z',
    source: { kind: 'link', url },
  };
}

function textCard(id: string, text: string): Card {
  return {
    id,
    label: `Card ${id}`,
    updatedAt: '2026-01-01T00:00:00.000Z',
    source: { kind: 'text', text },
  };
}

function visitCard(id: string): Card {
  return {
    id,
    label: `Card ${id}`,
    updatedAt: '2026-01-01T00:00:00.000Z',
    source: {
      kind: 'visit',
      firstName: 'Ada',
      lastName: 'Lovelace',
      organization: 'Analytical Engines',
      title: 'Mathematician',
      phone: '+44 20 7946 0958',
      email: 'ada@example.com',
      website: 'https://example.com/',
    },
  };
}

/** A sink that collects the files the Backup would have downloaded. */
function collectingSink(): { files: BackupFile[]; sink: (file: BackupFile) => void } {
  const files: BackupFile[] = [];
  return {
    files,
    sink(file) {
      files.push(file);
    },
  };
}

function firstFile(files: readonly BackupFile[]): BackupFile {
  const file = files[0];
  if (file === undefined) {
    throw new Error('expected a downloaded Backup file');
  }
  return file;
}

/** Saves a Wallet holding all three Card Kinds, with the second Card active. */
function walletWithEveryKind(store: WalletStore): Wallet {
  const visit = visitCard('visit-1');
  const link = linkCard('link-1', 'https://example.com/team');
  const text = textCard('text-1', 'Open 9–5');
  return store.save({
    version: 1,
    cards: [visit, link, text],
    activeCardId: link.id,
  });
}

describe('Backup export', () => {
  it('downloads the complete Wallet, including the active Card id, as qr-wallet-backup.json', () => {
    const store = new WalletStore(new InMemoryStorage());
    const wallet = walletWithEveryKind(store);
    const { files, sink } = collectingSink();
    const backup = new WalletBackup(store, sink);

    const file = backup.exportWallet();

    expect(file.filename).toBe('qr-wallet-backup.json');
    expect(BACKUP_FILENAME).toBe('qr-wallet-backup.json');
    expect(files).toEqual([file]);
    expect(JSON.parse(file.contents)).toEqual(wallet);
  });
});

describe('Backup import round trip', () => {
  it('restores a complete exported Wallet, including the active Card, into another Wallet', () => {
    const source = new WalletStore(new InMemoryStorage());
    const wallet = walletWithEveryKind(source);
    const { files, sink } = collectingSink();
    new WalletBackup(source, sink).exportWallet();
    const contents = firstFile(files).contents;

    const targetStorage = new InMemoryStorage();
    const target = new WalletStore(targetStorage);
    const imported = new WalletBackup(target, sink).importWallet(contents);

    expect(imported).toEqual(wallet);
    expect(imported.activeCardId).toBe('link-1');
    expect(new WalletStore(targetStorage).load()).toEqual(wallet);
  });
});

/** Storage that records how many writes the code under test performs. */
class CountingStorage extends InMemoryStorage {
  writes = 0;

  override setItem(key: string, value: string): void {
    this.writes += 1;
    super.setItem(key, value);
  }
}

/** A valid Backup document holding one Link Card, ready to be mutated per case. */
function validBackupValue(): Record<string, unknown> {
  return {
    version: 1,
    cards: [JSON.parse(JSON.stringify(linkCard('link-1'))) as Record<string, unknown>],
    activeCardId: 'link-1',
  };
}

/** JSON text for a Backup that is valid until a case mutates it. */
function backupJson(mutate: (value: Record<string, unknown>) => void = () => {}): string {
  const value = validBackupValue();
  mutate(value);
  return JSON.stringify(value);
}

/** The one Card in validBackupValue, for per-Card and per-kind mutations. */
function soleCard(value: Record<string, unknown>): Record<string, unknown> {
  const cards = value['cards'];
  if (!Array.isArray(cards) || cards[0] === undefined) {
    throw new Error('expected one Card in the test Backup');
  }
  return cards[0] as Record<string, unknown>;
}

interface RejectedImport {
  readonly reason: string;
  readonly contents: string;
  readonly message: RegExp;
}

const rejectedImports: readonly RejectedImport[] = [
  {
    reason: 'a file above the 1 MB ceiling',
    contents: 'x'.repeat(MAX_BACKUP_BYTES + 1),
    message: /Backup is 1048577 bytes; the maximum is 1048576 bytes\./,
  },
  {
    reason: 'malformed JSON',
    contents: '{not json',
    message: /Backup is not valid JSON\./,
  },
  {
    reason: 'a document that is not an object',
    contents: '[]',
    message: /Wallet must be an object\./,
  },
  {
    reason: 'an unknown version',
    contents: backupJson((value) => {
      value['version'] = 2;
    }),
    message: /Wallet version must be 1\./,
  },
  {
    reason: 'a missing Wallet property',
    contents: backupJson((value) => {
      delete value['cards'];
    }),
    message: /Wallet is missing the "cards" property\./,
  },
  {
    reason: 'an unexpected Wallet property',
    contents: backupJson((value) => {
      value['extra'] = true;
    }),
    message: /Wallet has an unexpected "extra" property\./,
  },
  {
    reason: 'a non-array cards field',
    contents: backupJson((value) => {
      value['cards'] = 'nope';
    }),
    message: /Wallet cards must be an array\./,
  },
  {
    reason: 'an active Card id that is not a string or null',
    contents: backupJson((value) => {
      value['activeCardId'] = 7;
    }),
    message: /Wallet activeCardId must be a string or null\./,
  },
  {
    reason: 'a Card that is not an object',
    contents: backupJson((value) => {
      value['cards'] = ['nope'];
    }),
    message: /Card 1 must be an object\./,
  },
  {
    reason: 'a Card missing a property',
    contents: backupJson((value) => {
      delete soleCard(value)['label'];
    }),
    message: /Card 1 is missing the "label" property\./,
  },
  {
    reason: 'an empty Card id',
    contents: backupJson((value) => {
      soleCard(value)['id'] = '   ';
    }),
    message: /Card 1 has an empty id\./,
  },
  {
    reason: 'duplicate Card ids',
    contents: backupJson((value) => {
      value['cards'] = [soleCard(value), soleCard(value)];
    }),
    message: /duplicate Card id "link-1"/,
  },
  {
    reason: 'a blank label',
    contents: backupJson((value) => {
      soleCard(value)['label'] = '   ';
    }),
    message: /Card 1 has a blank label\./,
  },
  {
    reason: 'a label longer than 40 characters',
    contents: backupJson((value) => {
      soleCard(value)['label'] = 'x'.repeat(41);
    }),
    message: /label is 41 characters; the maximum is 40\./,
  },
  {
    reason: 'an invalid updatedAt timestamp',
    contents: backupJson((value) => {
      soleCard(value)['updatedAt'] = 'yesterday';
    }),
    message: /Card 1 has an invalid updatedAt timestamp\./,
  },
  {
    reason: 'an unknown Card Kind',
    contents: backupJson((value) => {
      soleCard(value)['source'] = { kind: 'video', url: 'https://example.com/' };
    }),
    message: /Card 1 has an unknown Card Kind\./,
  },
  {
    reason: 'an invalid Link URL',
    contents: backupJson((value) => {
      soleCard(value)['source'] = { kind: 'link', url: 'not a url' };
    }),
    message: /Card 1 source has an invalid URL: "not a url"\./,
  },
  {
    reason: 'a Link source missing its url',
    contents: backupJson((value) => {
      soleCard(value)['source'] = { kind: 'link' };
    }),
    message: /Card 1 source is missing the "url" property\./,
  },
  {
    reason: 'a Text source missing its text',
    contents: backupJson((value) => {
      soleCard(value)['source'] = { kind: 'text' };
    }),
    message: /Card 1 source is missing the "text" property\./,
  },
  {
    reason: 'a Text Card whose text is only whitespace',
    contents: backupJson((value) => {
      soleCard(value)['source'] = { kind: 'text', text: '  \n\t ' };
    }),
    message: /Card 1 is a Text Card with blank text\./,
  },
  {
    reason: 'a Visit Card without a first or last name',
    contents: backupJson((value) => {
      soleCard(value)['source'] = {
        kind: 'visit',
        firstName: '',
        lastName: '',
        organization: '',
        title: '',
        phone: '',
        email: '',
        website: '',
      };
    }),
    message: /Card 1 is a Visit Card without a first or last name\./,
  },
  {
    reason: 'a Visit source missing a vCard field',
    contents: backupJson((value) => {
      soleCard(value)['source'] = {
        kind: 'visit',
        firstName: 'Ada',
        lastName: 'Lovelace',
        title: '',
        phone: '',
        email: '',
        website: '',
      };
    }),
    message: /Card 1 source is missing the "organization" property\./,
  },
  {
    reason: 'more than 100 Cards',
    contents: backupJson((value) => {
      value['cards'] = Array.from({ length: 101 }, (_, index) => linkCard(`card-${index}`));
    }),
    message: /Wallet holds 101 Cards; the maximum is 100\./,
  },
  {
    reason: 'a Payload above 800 UTF-8 bytes',
    contents: backupJson((value) => {
      soleCard(value)['source'] = { kind: 'text', text: '李'.repeat(267) };
    }),
    message: /Payload is 801 bytes; the maximum is 800 bytes\./,
  },
];

describe('Backup rejection', () => {
  it.each(rejectedImports)(
    'rejects $reason with the first concrete reason and leaves the Wallet byte-identical',
    ({ contents, message }) => {
      const storage = new CountingStorage();
      const store = new WalletStore(storage);
      walletWithEveryKind(store);
      const rawBefore = storage.getItem('qr_wallet_v1');
      const corruptBefore = storage.getItem('qr_wallet_v1_corrupt');
      const { sink } = collectingSink();
      const backup = new WalletBackup(store, sink);
      storage.writes = 0;

      let thrown: unknown;
      try {
        backup.importWallet(contents);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(BackupImportError);
      expect((thrown as BackupImportError).message).toMatch(message);
      expect(storage.getItem('qr_wallet_v1')).toBe(rawBefore);
      expect(storage.getItem('qr_wallet_v1_corrupt')).toBe(corruptBefore);
      expect(storage.writes).toBe(0);
    },
  );

  it('counts the 1 MB ceiling in UTF-8 bytes, not UTF-16 characters', () => {
    // 600,000 two-byte characters are 1.2 MB of UTF-8.
    const contents = 'é'.repeat(600_000);
    const backup = new WalletBackup(new WalletStore(new InMemoryStorage()), collectingSink().sink);

    expect(() => backup.importWallet(contents)).toThrow(
      /Backup is 1200000 bytes; the maximum is 1048576 bytes\./,
    );
  });

  it('accepts a file of exactly 1 MB at the size check and rejects its contents instead', () => {
    const contents = 'x'.repeat(MAX_BACKUP_BYTES);
    const backup = new WalletBackup(new WalletStore(new InMemoryStorage()), collectingSink().sink);

    expect(() => backup.importWallet(contents)).toThrow(/Backup is not valid JSON\./);
  });

  it('touches no storage at all when a rejected import lands on an empty device', () => {
    const storage = new CountingStorage();
    const backup = new WalletBackup(new WalletStore(storage), collectingSink().sink);

    expect(() => backup.importWallet('{not json')).toThrow(BackupImportError);
    expect(storage.getItem('qr_wallet_v1')).toBeNull();
    expect(storage.getItem('qr_wallet_v1_corrupt')).toBeNull();
    expect(storage.writes).toBe(0);
  });
});

describe('Backup import replacement', () => {
  it('validates the whole file first and replaces the Wallet in exactly one atomic write', () => {
    const storage = new CountingStorage();
    const store = new WalletStore(storage);
    walletWithEveryKind(store);
    const { sink } = collectingSink();
    const backup = new WalletBackup(store, sink);
    const contents = backupJson((value) => {
      const link = linkCard('link-a');
      const text = textCard('text-b', 'Replacement');
      value['cards'] = [link, text];
      value['activeCardId'] = 'text-b';
    });
    const rawBefore = storage.getItem('qr_wallet_v1');
    storage.writes = 0;

    const replaced = backup.importWallet(contents);

    expect(storage.writes).toBe(1);
    expect(storage.getItem('qr_wallet_v1')).toBe(JSON.stringify(replaced));
    expect(replaced.cards.map((card) => card.id)).toEqual(['link-a', 'text-b']);
    expect(replaced.activeCardId).toBe('text-b');
    expect(rawBefore).not.toBe(JSON.stringify(replaced));
  });

  it('uses the imported active Card id when it resolves', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    store.save({ version: 1, cards: [], activeCardId: null });
    const backup = new WalletBackup(store, collectingSink().sink);

    const imported = backup.importWallet(
      backupJson((value) => {
        value['cards'] = [linkCard('first'), linkCard('second')];
        value['activeCardId'] = 'second';
      }),
    );

    expect(imported.activeCardId).toBe('second');
    expect(new WalletStore(storage).load().activeCardId).toBe('second');
  });

  it('falls back to the first Card when the imported active id does not resolve', () => {
    const backup = new WalletBackup(new WalletStore(new InMemoryStorage()), collectingSink().sink);

    const imported = backup.importWallet(
      backupJson((value) => {
        value['cards'] = [linkCard('first'), linkCard('second')];
        value['activeCardId'] = 'missing';
      }),
    );

    expect(imported.activeCardId).toBe('first');
  });

  it('falls back to the first Card when the imported active id is null', () => {
    const backup = new WalletBackup(new WalletStore(new InMemoryStorage()), collectingSink().sink);

    const imported = backup.importWallet(
      backupJson((value) => {
        value['cards'] = [linkCard('first'), linkCard('second')];
        value['activeCardId'] = null;
      }),
    );

    expect(imported.activeCardId).toBe('first');
  });

  it('accepts an empty Wallet import and stores it without re-seeding', () => {
    const storage = new InMemoryStorage();
    const store = new WalletStore(storage);
    walletWithEveryKind(store);
    const backup = new WalletBackup(store, collectingSink().sink);

    const imported = backup.importWallet(
      backupJson((value) => {
        value['cards'] = [];
        value['activeCardId'] = null;
      }),
    );

    expect(imported).toEqual({ version: 1, cards: [], activeCardId: null });
    expect(new WalletStore(storage).load()).toEqual({ version: 1, cards: [], activeCardId: null });
  });

  it('accepts exactly 100 Cards and a Payload of exactly 800 bytes', () => {
    const backup = new WalletBackup(new WalletStore(new InMemoryStorage()), collectingSink().sink);
    const payload = 'a'.repeat(800);
    const contents = backupJson((value) => {
      value['cards'] = Array.from({ length: 100 }, (_, index) =>
        index === 0 ? textCard('card-0', payload) : linkCard(`card-${index}`),
      );
      value['activeCardId'] = 'card-99';
    });

    const imported = backup.importWallet(contents);

    expect(imported.cards).toHaveLength(100);
    expect(imported.cards[0]?.source).toEqual({ kind: 'text', text: payload });
    expect(imported.activeCardId).toBe('card-99');
  });

  it('normalizes imported Link urls and Visit Card websites like a saved Card', () => {
    const backup = new WalletBackup(new WalletStore(new InMemoryStorage()), collectingSink().sink);
    const visit = visitCard('visit-1');
    const contents = backupJson((value) => {
      value['cards'] = [visit, linkCard('link-1', 'example.com/team')];
      value['activeCardId'] = 'visit-1';
    });

    const imported = backup.importWallet(contents);

    expect(imported.cards[0]?.source).toEqual({ ...visit.source, website: 'https://example.com/' });
    expect(imported.cards[1]?.source).toEqual({ kind: 'link', url: 'https://example.com/team' });
  });

  it('exports without writing to storage', () => {
    const storage = new CountingStorage();
    const store = new WalletStore(storage);
    walletWithEveryKind(store);
    const backup = new WalletBackup(store, collectingSink().sink);
    storage.writes = 0;

    backup.exportWallet();

    expect(storage.writes).toBe(0);
  });

  it('keeps the Wallet untouched between preparing an import and confirming it', () => {
    const storage = new CountingStorage();
    const store = new WalletStore(storage);
    const current = walletWithEveryKind(store);
    const { sink } = collectingSink();
    const backup = new WalletBackup(store, sink);
    const contents = backupJson((value) => {
      value['cards'] = [linkCard('imported')];
      value['activeCardId'] = 'imported';
    });
    storage.writes = 0;

    const prepared = backup.prepareImport(contents);

    expect(prepared.cards.map((card) => card.id)).toEqual(['imported']);
    expect(storage.writes).toBe(0);
    expect(storage.getItem('qr_wallet_v1')).toBe(JSON.stringify(current));

    backup.replaceWallet(prepared);
    expect(storage.writes).toBe(1);
    expect(JSON.parse(storage.getItem('qr_wallet_v1') ?? '')).toEqual(prepared);
  });
});

describe('Backup write failures', () => {
  it('surfaces a storage failure while replacing instead of swallowing it', () => {
    const backup = new WalletBackup(new WalletStore(new FailingStorage()), collectingSink().sink);

    expect(() => backup.importWallet(backupJson())).toThrow('storage write failed');
  });

  it('surfaces a storage failure while exporting instead of swallowing it', () => {
    const backup = new WalletBackup(new WalletStore(new FailingStorage()), collectingSink().sink);

    expect(() => backup.exportWallet()).toThrow('storage write failed');
  });
});

describe('Corrupt-state copy', () => {
  it('downloads the raw corrupt state verbatim under the corrupt-state filename', () => {
    const { files, sink } = collectingSink();
    const backup = new WalletBackup(new WalletStore(new InMemoryStorage()), sink);
    const raw = '{"version":2,"cards":[],"activeCardId":null}';

    const file = backup.downloadCorrupt(raw);

    expect(file.filename).toBe(CORRUPT_FILENAME);
    expect(CORRUPT_FILENAME).toBe('qr-wallet-corrupt.json');
    expect(file.contents).toBe(raw);
    expect(files).toEqual([file]);
  });
});
