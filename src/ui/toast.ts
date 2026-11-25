/** How a toast reads: a success confirmation or an error the owner must notice. */
export type ToastTone = 'success' | 'error';

/** The mounted polite live region that reports the result of a short action. */
export interface Toast {
  /** Announces a short message, replacing any toast already on screen. */
  show(message: string, tone: ToastTone): void;
}

/** How long a toast stays on screen before it clears itself, in milliseconds. */
export const TOAST_DURATION_MS = 4000;

/**
 * Creates the app's single toast live region.
 *
 * Toasts are polite live regions: they never take focus, never interrupt a
 * screen reader, and carry no controls, so a Copy or Share result is announced
 * without pulling the owner away from the QR Panel. The region stays mounted
 * and only its text changes, which is what makes an announcement reliable.
 */
export function createToast(host: HTMLElement): Toast {
  const region = document.createElement('div');
  region.className = 'toast';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  host.append(region);

  let clearTimer: number | undefined;

  function show(message: string, tone: ToastTone): void {
    if (clearTimer !== undefined) {
      window.clearTimeout(clearTimer);
    }
    // Empty the region first so showing the same message twice is still a change
    // a screen reader can announce.
    region.textContent = '';
    region.classList.toggle('toast--error', tone === 'error');
    window.setTimeout(() => {
      region.textContent = message;
    }, 0);
    clearTimer = window.setTimeout(() => {
      region.textContent = '';
    }, TOAST_DURATION_MS);
  }

  return { show };
}
