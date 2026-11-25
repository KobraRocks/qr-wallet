import { PayloadTooLargeError, utf8ByteLength } from '../domain/payload';
import { resolveActiveCardId, type Wallet } from '../domain/wallet';
import { validateWallet, WalletValidationError } from './wallet-validation';
import type { WalletStore } from './wallet-store';

/** The fixed filename of an exported Backup. */
export const BACKUP_FILENAME = 'qr-wallet-backup.json';

/** The fixed filename of a downloaded raw corrupt state. */
export const CORRUPT_FILENAME = 'qr-wallet-corrupt.json';

/** The maximum accepted Backup size in UTF-8 bytes. */
export const MAX_BACKUP_BYTES = 1024 * 1024;

/** A file the owner should download. */
export interface BackupFile {
  readonly filename: string;
  readonly contents: string;
}

/** Receives a file to download; the browser adapter clicks a temporary link. */
export type FileSink = (file: BackupFile) => void;

/** Raised when a Backup cannot be imported; the message is the first concrete reason. */
export class BackupImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupImportError';
  }
}

/**
 * Validates an entire Backup document without touching storage. The imported
 * active Card id is used when it resolves, otherwise the first Card; an empty
 * Wallet is valid. Raises BackupImportError naming the first concrete problem.
 */
export function readBackup(contents: string): Wallet {
  const bytes = utf8ByteLength(contents);
  if (bytes > MAX_BACKUP_BYTES) {
    throw new BackupImportError(
      `Backup is ${bytes} bytes; the maximum is ${MAX_BACKUP_BYTES} bytes.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new BackupImportError('Backup is not valid JSON.');
  }

  try {
    const wallet = validateWallet(parsed);
    return { ...wallet, activeCardId: resolveActiveCardId(wallet) };
  } catch (error) {
    if (error instanceof WalletValidationError || error instanceof PayloadTooLargeError) {
      throw new BackupImportError(error.message);
    }
    throw error;
  }
}

/** Serializes the complete Wallet, including the active Card id, as a Backup. */
export function createBackupFile(wallet: Wallet): BackupFile {
  return { filename: BACKUP_FILENAME, contents: JSON.stringify(wallet, null, 2) };
}

/**
 * Exports and imports Backups at the injected Storage seam.
 *
 * It is DOM-free: the browser passes a FileSink that downloads the file, while
 * tests pass a collector. Import validates the whole file before a single
 * atomic write, so a rejected Backup never touches the existing Wallet.
 */
export class WalletBackup {
  private readonly store: WalletStore;
  private readonly saveFile: FileSink;

  constructor(store: WalletStore, saveFile: FileSink) {
    this.store = store;
    this.saveFile = saveFile;
  }

  /** Downloads the current Wallet as a Backup file and returns what was written. */
  exportWallet(): BackupFile {
    const file = createBackupFile(this.store.load());
    this.saveFile(file);
    return file;
  }

  /** Validates the whole file before any write; throws BackupImportError. */
  prepareImport(contents: string): Wallet {
    return readBackup(contents);
  }

  /** Replaces the Wallet with a prepared import in one atomic write. */
  replaceWallet(wallet: Wallet): Wallet {
    return this.store.replaceWallet(wallet);
  }

  /** Downloads the raw unreadable state verbatim, so it can be recovered or reported. */
  downloadCorrupt(raw: string): BackupFile {
    const file: BackupFile = { filename: CORRUPT_FILENAME, contents: raw };
    this.saveFile(file);
    return file;
  }

  /** The validation-then-replace import used by tests and non-interactive callers. */
  importWallet(contents: string): Wallet {
    return this.replaceWallet(this.prepareImport(contents));
  }
}
