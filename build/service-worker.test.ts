import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BUILD_HASH_PLACEHOLDER,
  PRECACHE_PLACEHOLDER,
  collectPrecacheUrls,
  collectPublicFiles,
  deriveBuildHash,
  injectServiceWorker,
  type BuildEntry,
} from './service-worker';

describe('deriveBuildHash', () => {
  it('is stable for the same content regardless of entry order', () => {
    const entries: BuildEntry[] = [
      { path: 'assets/app.js', contents: 'console.log(1);' },
      { path: 'index.html', contents: '<!doctype html>' },
    ];

    expect(deriveBuildHash(entries)).toBe(deriveBuildHash([...entries].reverse()));
  });

  it('changes when any output content changes', () => {
    const base: BuildEntry[] = [{ path: 'assets/app.js', contents: 'a' }];

    expect(deriveBuildHash(base)).not.toBe(
      deriveBuildHash([{ path: 'assets/app.js', contents: 'b' }]),
    );
    expect(deriveBuildHash(base)).not.toBe(
      deriveBuildHash([...base, { path: 'assets/app.css', contents: '' }]),
    );
  });

  it('is a short lowercase hex string', () => {
    expect(deriveBuildHash([])).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('collectPrecacheUrls', () => {
  const sources = {
    bundleFiles: [
      'assets/index-abc.js',
      'assets/index-def.css',
      'sw.js',
      'assets/index-abc.js.map',
    ],
    publicFiles: ['manifest.webmanifest', 'icons/icon-192.png'],
    serviceWorkerFile: 'sw.js',
  };

  it('lists the shell document, hashed assets, manifest, and icons relative to the worker', () => {
    expect(collectPrecacheUrls(sources)).toEqual([
      './assets/index-abc.js',
      './assets/index-def.css',
      './icons/icon-192.png',
      './index.html',
      './manifest.webmanifest',
    ]);
  });

  it('keeps the shell document even when the bundle already lists it, exactly once', () => {
    const urls = collectPrecacheUrls({ ...sources, bundleFiles: ['index.html', ...sources.bundleFiles] });

    expect(urls.filter((url) => url === './index.html')).toHaveLength(1);
  });

  it('excludes the service worker itself so the browser owns its updates', () => {
    expect(collectPrecacheUrls(sources)).not.toContain('./sw.js');
  });
});

describe('injectServiceWorker', () => {
  const injection = {
    buildHash: 'abc123def456',
    precacheUrls: ['./assets/index-abc.js', './index.html'],
  };

  const template = [
    'const BUILD_HASH = __BUILD_HASH__;',
    'const PRECACHE_URLS = __PRECACHE_URLS__;',
  ].join('\n');

  it('injects the build hash and precache list as JavaScript literals', () => {
    const source = injectServiceWorker(template, injection);

    expect(source).toContain('const BUILD_HASH = "abc123def456";');
    expect(source).toContain('const PRECACHE_URLS = ["./assets/index-abc.js","./index.html"];');
    expect(source).not.toContain(BUILD_HASH_PLACEHOLDER);
    expect(source).not.toContain(PRECACHE_PLACEHOLDER);
  });

  it('fails the build when the template lacks the build hash placeholder', () => {
    const withoutHash = `const PRECACHE_URLS = ${PRECACHE_PLACEHOLDER};`;

    expect(() => injectServiceWorker(withoutHash, injection)).toThrow(BUILD_HASH_PLACEHOLDER);
  });

  it('fails the build when the template lacks the precache placeholder', () => {
    const withoutPrecache = `const BUILD_HASH = ${BUILD_HASH_PLACEHOLDER};`;

    expect(() => injectServiceWorker(withoutPrecache, injection)).toThrow(PRECACHE_PLACEHOLDER);
  });

  it('rejects an empty precache manifest instead of shipping an empty shell', () => {
    expect(() => injectServiceWorker(template, { ...injection, precacheUrls: [] })).toThrow(
      /precache/i,
    );
  });
});

describe('collectPublicFiles', () => {
  const created: string[] = [];

  afterEach(() => {
    for (const directory of created.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  function makePublicDir(files: readonly string[]): string {
    mkdirSync(join(process.cwd(), '.artifacts'), { recursive: true });
    const root = mkdtempSync(join(process.cwd(), '.artifacts', 'public-'));
    created.push(root);
    for (const file of files) {
      const fullPath = join(root, file);
      mkdirSync(join(fullPath, '..'), { recursive: true });
      writeFileSync(fullPath, `contents of ${file}`);
    }
    return root;
  }

  it('lists files copied from the public directory with forward-slash paths', () => {
    const publicDir = makePublicDir(['manifest.webmanifest', 'icons/icon-192.png']);

    expect(collectPublicFiles(publicDir).map((file) => file.path)).toEqual([
      'icons/icon-192.png',
      'manifest.webmanifest',
    ]);
  });

  it('reads the contents so public files participate in the build hash', () => {
    const publicDir = makePublicDir(['manifest.webmanifest']);

    expect(new TextDecoder().decode(collectPublicFiles(publicDir)[0]?.contents)).toBe(
      'contents of manifest.webmanifest',
    );
  });

  it('returns nothing when the public directory does not exist', () => {
    expect(collectPublicFiles(join(process.cwd(), '.artifacts', 'missing-public-dir'))).toEqual([]);
  });
});
