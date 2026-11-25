import type { Wallet } from '../domain/wallet';
import type { BackupFile } from '../store/backup';
import { downloadTextFile } from './download';

/** Callbacks the Backup dialog raises; the app owns the Wallet store and the main view. */
export interface BackupDialogHandlers {
  /** Downloads the current Wallet and returns the file that was written. */
  onExport(): BackupFile;
  /**
   * Validates the entire Backup file without writing anything. Throwing shows
   * the first concrete reason and keeps the current Wallet untouched.
   */
  onPrepareImport(contents: string): Wallet;
  /**
   * Replaces the Wallet with the prepared import in one write. Throwing is
   * surfaced in the dialog instead of being swallowed.
   */
  onConfirmImport(wallet: Wallet): void;
}

/** The mounted native modal Backup dialog. */
export interface BackupDialog {
  open(): void;
}

/** A short, human message for a download or store failure. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The Backup could not be completed.';
}

/**
 * Downloads a Backup file through the app's shared object-URL helper. This is
 * the only DOM code the Backup workflow needs; the backup module itself stays
 * DOM-free.
 */
export function downloadBackupFile(file: BackupFile): void {
  downloadTextFile(file, 'application/json');
}

function createButton(text: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  return button;
}

/**
 * Creates the native modal Backup dialog: Export JSON, Import JSON, and a short
 * data-locality note. `showModal()` supplies the focus trap, the Esc close, the
 * focus return to the footer gear, and the non-light-dismissing backdrop.
 *
 * Import is two-phase: the whole selected file is read and validated first, a
 * confirmation then names the number of Cards it would place, and only the
 * confirmed import writes the Wallet.
 */
export function createBackupDialog(
  host: HTMLElement,
  handlers: BackupDialogHandlers,
): BackupDialog {
  const dialog = document.createElement('dialog');
  dialog.className = 'backup-dialog';
  dialog.setAttribute('aria-labelledby', 'backup-dialog-title');

  const title = document.createElement('h2');
  title.className = 'backup-dialog__title';
  title.id = 'backup-dialog-title';
  title.textContent = 'Backup';

  const note = document.createElement('p');
  note.className = 'backup-dialog__note';
  note.textContent =
    'Your Wallet stays on this device. Export a Backup file to move it to another phone.';

  const status = document.createElement('p');
  status.className = 'backup-dialog__status';
  status.setAttribute('role', 'status');
  status.hidden = true;

  const error = document.createElement('p');
  error.className = 'backup-dialog__error';
  error.setAttribute('role', 'alert');
  error.hidden = true;

  const actions = document.createElement('div');
  actions.className = 'backup-dialog__actions';

  const exportButton = createButton(
    'Export JSON',
    'backup-dialog__button backup-dialog__button--primary',
  );
  const importButton = createButton('Import JSON', 'backup-dialog__button');
  const closeButton = createButton('Close', 'backup-dialog__button');

  actions.append(exportButton, importButton, closeButton);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.hidden = true;
  fileInput.tabIndex = -1;

  // The confirmation that gates a replacement; hidden until a file validates.
  const confirmZone = document.createElement('div');
  confirmZone.className = 'backup-dialog__confirm';
  confirmZone.setAttribute('role', 'group');
  confirmZone.hidden = true;

  const confirmation = document.createElement('p');
  confirmation.className = 'backup-dialog__confirm-question';
  confirmation.id = 'backup-dialog-confirm-question';

  const confirmActions = document.createElement('div');
  confirmActions.className = 'backup-dialog__actions backup-dialog__confirm-actions';

  const replaceButton = createButton(
    'Replace Wallet',
    'backup-dialog__button backup-dialog__button--primary',
  );
  const keepButton = createButton('Cancel', 'backup-dialog__button');

  confirmActions.append(replaceButton, keepButton);
  confirmZone.setAttribute('aria-labelledby', confirmation.id);
  confirmZone.append(confirmation, confirmActions);

  // The body is a separate element because `display` must not be set on the
  // <dialog> itself: that would override the UA rule that hides a closed dialog.
  const body = document.createElement('div');
  body.className = 'backup-dialog__body';
  body.append(title, note, status, error, actions, confirmZone, fileInput);

  dialog.append(body);
  host.append(dialog);

  /** The validated Wallet waiting for confirmation; null while none is pending. */
  let pendingImport: Wallet | null = null;

  function clearMessages(): void {
    status.textContent = '';
    status.hidden = true;
    error.textContent = '';
    error.hidden = true;
  }

  function showError(message: string): void {
    clearMessages();
    error.textContent = message;
    error.hidden = false;
  }

  function showStatus(message: string): void {
    clearMessages();
    status.textContent = message;
    status.hidden = false;
  }

  /** Back to Export/Import: no pending import, no confirmation. */
  function showActions(): void {
    pendingImport = null;
    confirmZone.hidden = true;
    actions.hidden = false;
  }

  /** Names the Cards the confirmed import would place, then asks before writing. */
  function showConfirmation(imported: Wallet): void {
    pendingImport = imported;
    const count = imported.cards.length;
    confirmation.textContent =
      count === 0
        ? 'Replace your Wallet with this empty Backup? Your current Cards will be removed.'
        : `Replace your Wallet with this Backup of ${count} ${
            count === 1 ? 'Card' : 'Cards'
          }? Your current Cards will be removed.`;
    actions.hidden = true;
    confirmZone.hidden = false;
    replaceButton.focus();
  }

  async function readAndPrepare(file: File): Promise<void> {
    importButton.disabled = true;
    try {
      const contents = await file.text();
      // The dialog may have been closed while the file was being read.
      if (!dialog.open) {
        return;
      }
      const prepared = handlers.onPrepareImport(contents);
      if (dialog.open) {
        clearMessages();
        showConfirmation(prepared);
      }
    } catch (cause) {
      if (dialog.open) {
        showError(errorMessage(cause));
      }
    } finally {
      importButton.disabled = false;
    }
  }

  exportButton.addEventListener('click', () => {
    try {
      showStatus(`Exported ${handlers.onExport().filename}.`);
    } catch (cause) {
      showError(errorMessage(cause));
    }
  });

  importButton.addEventListener('click', () => {
    clearMessages();
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.item(0) ?? null;
    // Clearing the value lets the owner pick the same file again after a rejection.
    fileInput.value = '';
    if (file !== null) {
      void readAndPrepare(file);
    }
  });

  replaceButton.addEventListener('click', () => {
    const imported = pendingImport;
    if (imported === null) {
      return;
    }
    try {
      handlers.onConfirmImport(imported);
    } catch (cause) {
      // Keep the confirmation open so the owner can retry or walk away.
      showError(errorMessage(cause));
      return;
    }
    const count = imported.cards.length;
    showActions();
    showStatus(`Imported ${count} ${count === 1 ? 'Card' : 'Cards'}.`);
    closeButton.focus();
  });

  keepButton.addEventListener('click', () => {
    clearMessages();
    showActions();
    importButton.focus();
  });

  closeButton.addEventListener('click', () => {
    dialog.close();
  });

  // Esc closes the dialog natively; a backdrop click is deliberately not
  // handled, so the dialog stays open unless Close, Esc, or Cancel closes it.
  dialog.addEventListener('close', () => {
    clearMessages();
    showActions();
    fileInput.value = '';
  });

  return {
    open() {
      clearMessages();
      showActions();
      fileInput.value = '';
      if (!dialog.open) {
        dialog.showModal();
      }
      exportButton.focus();
    },
  };
}
