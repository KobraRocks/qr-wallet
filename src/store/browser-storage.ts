import type { Storage } from './storage';

/** The production Storage: the browser's localStorage. */
export const browserStorage: Storage = {
  getItem(key) {
    return window.localStorage.getItem(key);
  },
  setItem(key, value) {
    window.localStorage.setItem(key, value);
  },
};
