import './styles.css';
import type { Card } from './domain/card';
import type { Wallet } from './domain/wallet';
import { WalletBackup } from './store/backup';
import { browserStorage } from './store/browser-storage';
import { WalletStore } from './store/wallet-store';
import { createBackupDialog, downloadBackupFile } from './ui/backup-dialog';
import { createCardActions } from './ui/card-actions';
import { createCardDialog } from './ui/card-dialog';
import { renderMainView } from './ui/main-view';
import { createRecoveryBanner } from './ui/recovery-banner';
import { createToast } from './ui/toast';

// --- ticket #8: offline shell, persistent storage, and wake lock ---
import { startAppShell } from './boot/app-shell';
// --- end ticket #8 ---

const root = document.querySelector<HTMLElement>('#app');
if (root === null) {
  throw new Error('QR Wallet could not find its #app root element.');
}

// The Wallet store is the only owner of loading, saving, and the active Card id,
// so a Pill tap, a save, and a delete are all persisted before the view re-renders.
const store = new WalletStore(browserStorage);

let wallet: Wallet = store.load();

/** The Card to focus once the editor has closed after a save or delete. */
let cardIdToFocus: string | null | undefined;

// The editor lives at document level, not inside #app: the main view owns and
// replaces the contents of its root, and the dialog belongs to the top layer.
const dialog = createCardDialog(document.body, {
  onSave(card: Card) {
    wallet = store.saveCard(card);
    view.update(wallet);
    cardIdToFocus = wallet.activeCardId;
  },
  onDelete(cardId: string) {
    wallet = store.deleteCard(cardId);
    view.update(wallet);
    cardIdToFocus = wallet.activeCardId;
  },
  onClosed() {
    // After a save or delete the trigger was re-rendered away, so the app puts
    // focus on the updated Card's Pill. Cancel and Esc keep native focus return.
    if (cardIdToFocus !== undefined) {
      view.focusCardPill(cardIdToFocus);
      cardIdToFocus = undefined;
    }
  },
});

// ticket #6: Copy Payload and Share, and the polite live region they report through.
const toast = createToast(document.body);
const cardActions = createCardActions(toast);

// --- ticket #7: Backup export/import and corrupt-state recovery -----------------
// The Backup workflow is DOM-free at its seam (the store's injected Storage); this
// wiring only supplies the download sink and keeps the main view in step.
const backup = new WalletBackup(store, downloadBackupFile);
const backupDialog = createBackupDialog(document.body, {
  onExport: () => backup.exportWallet(),
  onPrepareImport: (contents) => backup.prepareImport(contents),
  onConfirmImport(imported) {
    wallet = backup.replaceWallet(imported);
    view.update(wallet);
  },
});

// A corrupt or unknown-version stored Wallet was preserved verbatim on load, so
// offer the raw copy for download before the owner dismisses the banner.
const corruptRecovery = store.takeCorruptRecovery();
if (corruptRecovery !== null) {
  createRecoveryBanner(document.body, () => backup.downloadCorrupt(corruptRecovery));
}
// ---------------------------------------------------------------------------------

const view = renderMainView(root, wallet, {
  onSelectCard(cardId) {
    wallet = store.setActiveCard(cardId);
    return wallet;
  },
  onNewCard() {
    dialog.openNew(wallet);
  },
  onEditCard(card) {
    dialog.openEdit(card);
  },
  // ticket #6: Copy and Share act on the same Card the QR Panel is showing.
  onCopyPayload(card) {
    void cardActions.copyPayload(card);
  },
  onShareCard(card) {
    void cardActions.shareQr(card);
  },
  onOpenBackup() {
    backupDialog.open();
  },
});

// --- ticket #8: offline shell, persistent storage, and wake lock ---
startAppShell();
// --- end ticket #8 ---
