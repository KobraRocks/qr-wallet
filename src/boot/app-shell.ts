import { requestPersistentStorage } from './persistent-storage';
import { setUpServiceWorker, type ServiceWorkerContainerLike } from './register-service-worker';
import { createUpdateNotice } from './update-notice';
import { startWakeLock, type WakeLockLike } from './wake-lock';

/** `navigator.wakeLock` is missing on unsupported browsers; read it defensively. */
function wakeLockApi(): WakeLockLike | undefined {
  return (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
}

/** Reads `navigator.serviceWorker` without assuming service worker support. */
function serviceWorkerContainer(): ServiceWorkerContainerLike | undefined {
  return (navigator as Navigator & { serviceWorker?: ServiceWorkerContainerLike }).serviceWorker;
}

/**
 * Boots the installable, offline, wake-locked app shell.
 *
 * - Requests persistent storage best-effort, so an eviction is less likely.
 * - Holds a screen wake lock while the document is visible, releasing it when
 *   the document hides and re-requesting it on return.
 * - Registers the service worker in production builds only and shows the update
 *   notice when a new worker takes control.
 *
 * Every step is failure-tolerant: an old browser without Wake Lock, Storage
 * Manager, or service workers simply runs the Wallet without those extras.
 */
export function startAppShell(): void {
  requestPersistentStorage(navigator.storage);
  startWakeLock(document, wakeLockApi());
  void setUpServiceWorker({
    production: import.meta.env.PROD,
    serviceWorker: serviceWorkerContainer(),
    documentBaseUrl: document.baseURI,
    onUpdateReady: () => {
      createUpdateNotice(document).show();
    },
  });
}
