import { describe, expect, it } from 'vitest';
import {
  setUpServiceWorker,
  type ServiceWorkerContainerLike,
} from './register-service-worker';

interface FakeContainer extends ServiceWorkerContainerLike {
  readonly registrations: string[];
  readonly listenerCount: number;
  dispatchControllerChange(): void;
}

function createContainer(controller: unknown | null): FakeContainer {
  const registrations: string[] = [];
  const listeners: (() => void)[] = [];
  return {
    controller,
    registrations,
    get listenerCount() {
      return listeners.length;
    },
    register(scriptUrl: string | URL) {
      registrations.push(String(scriptUrl));
      return Promise.resolve(undefined);
    },
    addEventListener(_type: 'controllerchange', listener: () => void) {
      listeners.push(listener);
    },
    dispatchControllerChange() {
      for (const listener of [...listeners]) {
        listener();
      }
    },
  };
}

describe('setUpServiceWorker', () => {
  it('does not register the service worker in development builds', async () => {
    const container = createContainer(null);

    await setUpServiceWorker({
      production: false,
      serviceWorker: container,
      documentBaseUrl: 'https://example.com/sub/',
      onUpdateReady: () => {},
    });

    expect(container.registrations).toHaveLength(0);
    expect(container.listenerCount).toBe(0);
  });

  it('registers a worker beside the document in production builds', async () => {
    const container = createContainer(null);

    await setUpServiceWorker({
      production: true,
      serviceWorker: container,
      documentBaseUrl: 'https://example.com/sub/',
      onUpdateReady: () => {},
    });

    expect(container.registrations).toEqual(['https://example.com/sub/sw.js']);
  });

  it('swallows a failed registration so the app still runs', async () => {
    const container = createContainer(null);
    container.register = () => Promise.reject(new Error('registration failed'));

    await expect(
      setUpServiceWorker({
        production: true,
        serviceWorker: container,
        documentBaseUrl: 'https://example.com/',
        onUpdateReady: () => {},
      }),
    ).resolves.toBeUndefined();
  });

  it('does nothing when the browser has no service worker support', async () => {
    await expect(
      setUpServiceWorker({
        production: true,
        serviceWorker: undefined,
        documentBaseUrl: 'https://example.com/',
        onUpdateReady: () => {},
      }),
    ).resolves.toBeUndefined();
  });

  it('offers the update only when a new worker takes over an already controlled page', async () => {
    const controlled = createContainer({});
    let updates = 0;
    await setUpServiceWorker({
      production: true,
      serviceWorker: controlled,
      documentBaseUrl: 'https://example.com/',
      onUpdateReady: () => {
        updates += 1;
      },
    });

    controlled.dispatchControllerChange();
    expect(updates).toBe(1);

    const firstVisit = createContainer(null);
    let firstVisitUpdates = 0;
    await setUpServiceWorker({
      production: true,
      serviceWorker: firstVisit,
      documentBaseUrl: 'https://example.com/',
      onUpdateReady: () => {
        firstVisitUpdates += 1;
      },
    });

    firstVisit.dispatchControllerChange();
    expect(firstVisitUpdates).toBe(0);
  });
});
