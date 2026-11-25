import './styles.css';
import { browserStorage } from './store/browser-storage';
import { WalletStore } from './store/wallet-store';
import { renderMainView } from './ui/main-view';

const root = document.querySelector<HTMLElement>('#app');
if (root === null) {
  throw new Error('QR Wallet could not find its #app root element.');
}

// The Wallet store is the only owner of loading, saving, and the active Card id,
// so a Pill tap persists the selection and the next launch restores it.
const store = new WalletStore(browserStorage);

renderMainView(root, store.load(), {
  onSelectCard: (cardId) => store.setActiveCard(cardId),
});
