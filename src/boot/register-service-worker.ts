/** The subset of `navigator.serviceWorker` the app uses. */
export interface ServiceWorkerContainerLike {
  readonly controller: unknown | null;
  register(scriptUrl: string | URL): Promise<unknown>;
  addEventListener(type: 'controllerchange', listener: () => void): void;
}

/** What the app knows and wants to do when it sets up offline support. */
export interface ServiceWorkerSetup {
  /**
   * Whether this is a production build. Registration is production-only: a
   * development server's worker would cache source files and fight HMR.
   */
  readonly production: boolean;
  readonly serviceWorker: ServiceWorkerContainerLike | undefined;
  /** The document's base URL, so the worker URL works under any subpath. */
  readonly documentBaseUrl: string;
  /** Called when a new worker takes control of an already controlled page. */
  readonly onUpdateReady: () => void;
}

/**
 * Registers the service worker in production builds and watches for updates.
 *
 * The worker is registered beside the shell document (`sw.js` next to
 * `index.html`), which also sets its scope to the deployment root even when the
 * app lives on a subpath. The update callback fires only on `controllerchange`
 * when the page was already controlled at startup: the first visit is not an
 * update, and the callback never reloads the page — it only offers to.
 *
 * Registration is progressive enhancement. A browser without service worker
 * support, or a failed registration, leaves the app fully usable.
 */
export function setUpServiceWorker(setup: ServiceWorkerSetup): Promise<void> {
  if (!setup.production) {
    return Promise.resolve();
  }
  const container = setup.serviceWorker;
  if (container === undefined) {
    return Promise.resolve();
  }

  const wasControlled = container.controller !== null;
  container.addEventListener('controllerchange', () => {
    if (wasControlled) {
      setup.onUpdateReady();
    }
  });

  return container.register(new URL('sw.js', setup.documentBaseUrl)).then(
    () => undefined,
    () => undefined,
  );
}
