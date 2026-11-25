import './styles.css';
import type { Card } from './domain/card';
import type { Wallet } from './domain/wallet';
import { browserStorage } from './store/browser-storage';
import { WalletStore } from './store/wallet-store';
import { createCardDialog } from './ui/card-dialog';
import { renderMainView } from './ui/main-view';

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
});

// --- ticket #8: offline shell, persistent storage, and wake lock ---
startAppShell();
// --- end ticket #8 ---
