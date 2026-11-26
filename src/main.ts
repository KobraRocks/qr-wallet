import './styles.css';
import { startAppShell } from './boot/app-shell';
import type { Card } from './domain/card';
import type { Wallet } from './domain/wallet';
import { WalletBackup } from './store/backup';
import { browserStorage } from './store/browser-storage';
import { WalletStore } from './store/wallet-store';
import { createBackupDialog, downloadBackupFile } from './ui/backup-dialog';
import { createCardActions } from './ui/card-actions';
import { createCardDialog } from './ui/card-dialog';
import { createCardMenu } from './ui/card-menu';
import { renderMainView, type MainView } from './ui/main-view';
import { createRecoveryBanner } from './ui/recovery-banner';
import { createToast } from './ui/toast';

const root = document.querySelector<HTMLElement>('#app');
if (root === null) {
  throw new Error('QR Wallet could not find its #app root element.');
}

// The Wallet store is the only owner of loading, saving, and the active Card id,
// so a menu choice, a pager step, a save, and a delete are all persisted before
// the view re-renders.
const store = new WalletStore(browserStorage);

let wallet: Wallet = store.load();

// Assigned once the view is mounted; every dialog and the Card Menu reach it
// through their handlers, and none of them can fire before that.
let view: MainView;

/**
 * Where focus goes once the editor has closed after a save or delete. Cancel and
 * Esc keep the browser's native focus return, so nothing is moved for them.
 */
type FocusAfterClose =
  | { readonly kind: 'keep-native' }
  | { readonly kind: 'empty-state' }
  | { readonly kind: 'card'; readonly cardId: string };

/** The focus decision for the next editor close; reset once it has been applied. */
let focusAfterClose: FocusAfterClose = { kind: 'keep-native' };

/** Remembers where focus belongs after the editor saves or deletes a Card. */
function rememberFocusAfterClose(updated: Wallet): void {
  focusAfterClose =
    updated.activeCardId === null
      ? { kind: 'empty-state' }
      : { kind: 'card', cardId: updated.activeCardId };
}

/** Persists a new active Card and re-renders the main view in place. */
function selectCard(cardId: string): Wallet {
  wallet = store.setActiveCard(cardId);
  view.update(wallet);
  return wallet;
}

// Backup export/import and corrupt-state recovery. The Backup workflow is
// DOM-free at its seam (the store's injected Storage); this wiring only supplies
// the download sink and keeps the main view in step.
const backup = new WalletBackup(store, downloadBackupFile);
const backupDialog = createBackupDialog(document.body, {
  onExport: () => backup.exportWallet(),
  onPrepareImport: (contents) => backup.prepareImport(contents),
  onConfirmImport(imported) {
    wallet = backup.replaceWallet(imported);
    view.update(wallet);
  },
});

// The Card Menu is the Wallet's selector: a modal list that closes on a choice.
const cardMenu = createCardMenu(document.body, {
  onChoose: selectCard,
  onOpenBackup() {
    backupDialog.open();
  },
});

// The editor lives at document level, not inside #app: the main view owns and
// replaces its own markup, and the dialog belongs to the top layer.
const dialog = createCardDialog(document.body, {
  onSave(card: Card) {
    wallet = store.saveCard(card);
    view.update(wallet);
    rememberFocusAfterClose(wallet);
  },
  onDelete(cardId: string) {
    wallet = store.deleteCard(cardId);
    view.update(wallet);
    rememberFocusAfterClose(wallet);
  },
  onClosed() {
    // After a save or delete the trigger may have been re-rendered away, so the
    // app puts focus on the dock's Edit action, or on the empty state's create.
    if (focusAfterClose.kind === 'keep-native') {
      return;
    }
    view.focusAfterClose(focusAfterClose.kind === 'card' ? focusAfterClose.cardId : null);
    focusAfterClose = { kind: 'keep-native' };
  },
});

// Copy Payload and Share report their result through one polite live region.
const toast = createToast(document.body);
const cardActions = createCardActions(toast);

// A corrupt or unknown-version stored Wallet was preserved verbatim on load, so
// offer the raw copy for download before the owner dismisses the banner.
const corruptRecovery = store.takeCorruptRecovery();
if (corruptRecovery !== null) {
  createRecoveryBanner(document.body, () => backup.downloadCorrupt(corruptRecovery));
}

view = renderMainView(root, wallet, {
  onSelectCard(cardId) {
    wallet = store.setActiveCard(cardId);
    return wallet;
  },
  onNewCard() {
    dialog.openNew(wallet);
  },
  onOpenMenu() {
    cardMenu.open(wallet);
  },
  onEditCard(card) {
    dialog.openEdit(card);
  },
  // Copy and Share act on the same Card the QR Panel is showing.
  onCopyPayload(card) {
    void cardActions.copyPayload(card);
  },
  onShareCard(card) {
    void cardActions.shareQr(card);
  },
});

// Boot the offline shell: persistent storage, the wake lock, and the service
// worker with its update notice.
startAppShell();
