import type { Card } from '../domain/card';
import { derivePayload } from '../domain/payload';
import { cardQrSvg } from '../qr/card-svg';
import { qrSvgBlob, qrSvgFile, qrSvgFileName } from '../qr/file';
import { downloadBlob } from './download';
import type { Toast } from './toast';

/** What a Share action produced: the share sheet, a download fallback, or a cancel. */
export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/** The active Card's Copy and Share actions, mounted once for the whole app. */
export interface CardActions {
  /** Copies the Card's exact Payload and toasts success or failure. */
  copyPayload(card: Card): Promise<void>;
  /** Shares the Card's QR as an SVG file, falling back to a downloaded SVG. */
  shareQr(card: Card): Promise<ShareOutcome>;
}

/**
 * Whether a rejected Share means the owner dismissed the sheet.
 *
 * A user cancel is the only rejection that must do nothing: a hard rejection
 * (a permissions policy, a missing target) still owes the owner the code.
 */
export function isShareCancellation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

/** Writes the exact string to the system clipboard; rejects when the browser refuses. */
function writeClipboard(text: string): Promise<void> {
  const clipboard: Clipboard | undefined = navigator.clipboard;
  if (clipboard === undefined) {
    return Promise.reject(new Error('The Clipboard API is unavailable.'));
  }
  return clipboard.writeText(text);
}

/** Whether this browser can share the given data as a file through the share sheet. */
function supportsFileShare(data: ShareData): boolean {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return false;
  }
  try {
    return navigator.canShare(data);
  } catch {
    return false;
  }
}

/**
 * Creates the Copy and Share actions for the active Card.
 *
 * Copy writes the exact Payload the QR Panel encodes. Share offers the same
 * guarded SVG as an SVG file named from the Card label; when file sharing is
 * unavailable, or the share sheet rejects for a hard reason, the identical SVG
 * downloads under a safe slug filename. A user cancel downloads nothing. None
 * of these actions makes a network request.
 */
export function createCardActions(toast: Toast): CardActions {
  return {
    async copyPayload(card) {
      try {
        await writeClipboard(derivePayload(card));
      } catch {
        toast.show('The Payload could not be copied to the clipboard.', 'error');
        return;
      }
      toast.show('Payload copied.', 'success');
    },

    async shareQr(card) {
      const svg = cardQrSvg(card);
      const shareData: ShareData = {
        files: [qrSvgFile(svg, card.label)],
        title: card.label,
      };

      if (supportsFileShare(shareData)) {
        try {
          await navigator.share(shareData);
          return 'shared';
        } catch (error) {
          if (isShareCancellation(error)) {
            return 'cancelled';
          }
          // A hard rejection still owes the owner the code: fall through.
        }
      }

      downloadBlob(qrSvgBlob(svg), qrSvgFileName(card.label));
      toast.show('QR code downloaded.', 'success');
      return 'downloaded';
    },
  };
}
