import './styles.css';
import { browserStorage } from './store/browser-storage';
import { WalletStore } from './store/wallet-store';
import { renderMainView } from './ui/main-view';

const root = document.querySelector<HTMLElement>('#app');
if (root === null) {
  throw new Error('QR Wallet could not find its #app root element.');
}

const store = new WalletStore(browserStorage);
renderMainView(root, store.load());
