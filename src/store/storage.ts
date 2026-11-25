/** The persistence boundary the Wallet store accepts. localStorage is the production default. */
export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The versioned storage key of the Wallet. */
export const WALLET_KEY = 'qr_wallet_v1';

/** Where a stored Wallet that cannot be read is preserved verbatim. */
export const CORRUPT_WALLET_KEY = 'qr_wallet_v1_corrupt';
