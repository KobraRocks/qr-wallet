/**
 * The dismissible recovery banner shown when the stored Wallet could not be
 * read. The raw value was already preserved under the corrupt-state key; the
 * banner offers that raw copy for download so the owner can recover or report
 * it before the Seeds become the only Wallet on the device.
 */
export interface RecoveryBanner {
  dismiss(): void;
}

/**
 * Mounts the recovery banner. `onDownload` writes the raw copy (the app passes
 * WalletBackup.downloadCorrupt), so the banner owns no storage access. A
 * download failure is shown inline rather than swallowed.
 */
export function createRecoveryBanner(
  host: HTMLElement,
  onDownload: () => void,
): RecoveryBanner {
  const banner = document.createElement('aside');
  banner.className = 'recovery-banner';
  banner.setAttribute('role', 'alert');
  banner.setAttribute('aria-label', 'Wallet recovery');

  const message = document.createElement('p');
  message.className = 'recovery-banner__message';
  message.textContent =
    'Your saved Wallet could not be read. The Seed Cards were restored so the app keeps working.';

  const error = document.createElement('p');
  error.className = 'recovery-banner__error';
  error.setAttribute('role', 'alert');
  error.hidden = true;

  const actions = document.createElement('div');
  actions.className = 'recovery-banner__actions';

  const download = document.createElement('button');
  download.type = 'button';
  download.className = 'recovery-banner__button';
  download.textContent = 'Download raw copy';

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'recovery-banner__button recovery-banner__button--quiet';
  dismiss.textContent = 'Dismiss';

  actions.append(download, dismiss);
  banner.append(message, error, actions);
  host.append(banner);

  function remove(): void {
    banner.remove();
  }

  download.addEventListener('click', () => {
    try {
      onDownload();
      error.textContent = '';
      error.hidden = true;
    } catch (cause) {
      error.textContent =
        cause instanceof Error ? cause.message : 'The raw copy could not be downloaded.';
      error.hidden = false;
    }
  });

  dismiss.addEventListener('click', remove);

  return { dismiss: remove };
}
