# 0002 — Offline comes from a cache-first, build-injected service worker

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

QR Wallet's core promise is that the active Card's code appears within seconds,
including where there is no reliable signal. The parent spec states the app
"works fully offline after first load", must open as an installed app with the
network disabled, and is a static site deployable at a domain root or any
subpath (Cloudflare Pages, GitHub Pages, or any HTTPS static folder). There is
no backend and no runtime network dependency.

The shell therefore has to be cached on the device, and the cache has to be
tied to the exact build that installed it so a new version becomes visible
without a forced reload. The constraints are:

- The complete shell — document, hashed JavaScript and CSS, manifest, icons —
  must be available offline after the first successful load.
- A new build must activate into a new cache and delete the old one.
- Updates must be offered, never forced: an owner mid-scan is not reloaded.
- The app must stay under a 30 KB gzipped JavaScript + CSS budget, with no
  webfonts or external assets.
- Deployment may be at a subpath, so every URL must be relative.

## Decision

The offline guarantee comes from a hand-written, cache-first service worker
whose precache manifest and cache name are injected at build time. Workbox is
not used.

- `src/sw/service-worker.js` is the readable, hand-written worker: install
  precaches every shell file and calls `skipWaiting`; activate deletes caches
  from earlier builds and claims clients; fetch is cache-first for same-origin
  GETs, with the cached shell document as the navigation fallback.
- A Vite plugin (`build/service-worker.ts`) derives a content hash from every
  emitted bundle file and every public file, then injects the hash and the
  relative precache manifest into the built `sw.js`. The cache name is
  `qr-wallet-<buildHash>`, so a new build cannot reuse an old cache.
- The build fails loudly if the injection placeholder is missing, the manifest
  is empty, or the hash is malformed. A worker that cannot cache the shell is
  not a degraded build; it is a broken product.
- The worker is registered only in production builds, beside the shell document
  so its scope follows the deployment subpath. On `controllerchange` for an
  already-controlled page, an unobtrusive polite live region offers a Reload
  button. It is the only reload path; nothing reloads automatically.
- Every precached URL is relative (`./…`), resolved against the worker's own
  URL, so the same build works at a domain root or a subpath.

## Alternatives considered

- **Workbox.** Rejected: it is a build-time dependency plus runtime library for
  a lifecycle that fits in about 70 lines; it would cost bundle budget the spec
  spends on the `qr` package, and its generated worker would be less auditable
  against the spec's exact lifecycle (skip waiting, claim, delete old caches,
  shell fallback). The spec explicitly puts Workbox out of scope.
- **Runtime caching as requests happen.** Rejected: the first visit could leave
  the shell incomplete, so the app would not be reliably offline after first
  load. The shell is small and known at build time — precache it whole.
- **Hashed service-worker filename.** Rejected: the browser fetches the worker
  by a stable URL to detect updates; only the cache name needs to change per
  build.
- **`version` from `package.json`.** Rejected: it changes only when someone
  remembers to bump it, whereas a content-derived hash changes exactly when the
  shipped bytes change.
- **Cache-then-network for the document on every load.** Rejected: cache-first
  is what makes an installed app open instantly and offline; the update path is
  the versioned worker and the reload notice, not a network race.
- **Forced reload on `controllerchange`.** Rejected: it interrupts scanning;
  the spec requires an offered reload.

## Consequences

- Offline behaviour is a build artifact: `dist/sw.js` always contains the exact
  hashed assets of that build, and a stale cache cannot silently serve old
  assets under a new name.
- The precache list is generated, so adding an icon or a manifest file to
  `public/` automatically includes it — no second place to update.
- Updates need both a new worker and user consent: the update notice appears
  after the new worker claims clients, and the user chooses when to reload.
- The service worker is not unit-tested (it is browser lifecycle code); the
  injection, hash, and manifest logic is unit-tested, and the end-to-end
  offline/install/update path is verified with a headless browser against
  `vite preview`.
- The worker is not part of the app bundle or its gzip budget; it is kept
  deliberately small and has no dependencies.
