# QR Wallet

A local-only, installable web app that holds a small **Wallet** of named **Cards** and shows
the active Card's Payload as a large, high-contrast QR code — on screen in seconds, with no
account and no network. A Card is a **Visit Card** (a vCard 3.0 contact), a **Link** (a URL),
or **Text**. The active Card is remembered across launches, the Wallet works offline after
the first load, and a **Backup** moves every Card to a new phone.

The domain vocabulary lives in [GLOSSARY.md](GLOSSARY.md); the architecture decisions are
recorded in [docs/adr/](docs/adr/) and the product spec in [docs/specs/qr-wallet.md](docs/specs/qr-wallet.md).

## Requirements

- **Node.js >= 22.18** (declared in `package.json` `engines`) and npm.
- A modern browser with service-worker support for offline use. Add to Home Screen is offered
  by Chrome and Edge (Android and desktop) and by Safari on iOS and macOS; other browsers can
  still run the app but may not offer installation. Installing and offline use need a
  **secure context (HTTPS or localhost)**.

```sh
node --version   # must be >= 22.18
```

## Install and run

```sh
npm install          # install dependencies (or `npm ci` for the exact lockfile)
npm run dev          # Vite dev server; prints its local URL (http://localhost:5173/)
npm test             # Vitest, Node-only; all tests must pass
npm run build        # tsc --noEmit && vite build; writes dist/
npm run preview      # serve the built app so production behavior can be tested
npx vite preview     # equivalent to the line above
```

`dist/` is the complete deployable artifact: static HTML, hashed JS and CSS, the
manifest, the icons, and the service worker. There is no server-side code and no build-time
configuration, secrets, or runtime configuration.

Other scripts:

- `npm run icons` — regenerates the checked-in icons in `public/icons/`. It is deterministic,
  so running it should leave the working tree clean.
- `npm run check:budget` — run after `npm run build`; measures shipped JS + CSS gzipped
  against a 30 KB budget and JS + CSS + fonts against a 64 KB combined budget.
- `npm run shots` — captures the design-review screenshots into `.artifacts/screenshots/`
  using headless Chromium; see `docs/design/verification.md`.
- `npm run test:watch` — Vitest in watch mode.

The service worker is registered only in production builds, so `npm run dev` does not test
offline behavior. Use `npm run build && npm run preview` for that.

## Deploying

The build uses a **relative base** (`base: './'` in `vite.config.ts`), so the same `dist/`
works both at a domain root and under any subpath. All shell, manifest, icon, and service
worker URLs are relative. **Serve over HTTPS**: service workers and Add to Home Screen
require a secure context (`localhost` also counts while testing).

### Cloudflare Pages

1. Push the repository to GitHub or GitLab and create a Pages project connected to it.
2. Build command: `npm run build`. Output directory: `dist`.
3. Ensure the build image's Node.js version satisfies `>= 22.18` (set the `NODE_VERSION`
   environment variable if the default is older), then deploy.

The site is served at the project's root (for example `https://qr-wallet.pages.dev/`); no
redirects or rewrites are needed. Direct Upload works too: run `npm run build` locally and
upload the contents of `dist/`.

### GitHub Pages

1. Run `npm run build` and publish the **contents of `dist/`** (not the `dist/` folder) to
   the branch or folder that Pages serves, for example a `gh-pages` branch. Any static
   publishing method works; no CI workflow is checked in.
2. In the repository's **Settings → Pages**, set the source to that branch/folder.
3. Project pages are served from a subpath (`https://<user>.github.io/<repo>/`) — that works
   unchanged because the base is relative. User/org pages and custom domains (served from
   `/`) work the same way.

GitHub Pages serves over HTTPS and enables the service worker and install as-is.

### Any HTTPS static folder

Copy the contents of `dist/` to a web root or a subfolder of any HTTPS host. The build has no
server requirements; only make sure the host serves the files with sensible MIME types
(`.js` → `text/javascript`, `.css` → `text/css`, `.png` → `image/png`, `.webmanifest` →
`application/manifest+json`). Nothing needs to rewrite unknown paths — the app is a single
document with no client-side routes.

## Add to Home Screen

### Android (Chrome)

Open the deployed URL in Chrome and either accept Chrome's install prompt or open the ⋮ menu
and choose **Add to Home screen** / **Install app**. The icon is added to the home screen and
launches in a **standalone** window (no browser chrome), in portrait, with the wallet ready.

### iPhone and iPad (Safari)

Open the deployed URL in **Safari**, tap **Share**, then **Add to Home Screen** and confirm.
Launch the new icon: it opens standalone, with the installed apple-touch-icon. (Use Safari for
this; adding a home-screen icon from another iOS browser does not produce the same standalone
web-app experience.)

On devices that support it, the screen is kept awake while the QR Panel is visible. iOS
versions before 18.4 do not support the Screen Wake Lock API and simply skip it. After
installing, open the app once online so the offline shell is cached.

## Offline behavior and updates

After the first successful online load (or install), the service worker precaches the complete
shell: the document, the JS and CSS for that build, the display font and its licence, the
manifest, and the icons. From then on
the app opens and works with the network disabled — all Cards are available, switching,
creating, editing, copying, sharing/downloading, and Backup are local operations.

To try it locally: `npm run build && npm run preview`, open the app, then reload with the
browser's network throttling set to **Offline** (or stop the preview server).

When a new version is deployed and you next open the app online, it installs into a new cache
and shows a small notice offering **Reload**. Nothing reloads on its own — the page only
changes when you choose to reload — so a scan in progress is never interrupted.

## Backup and restore

The Wallet lives on this device only. A Backup is the way to move it to a new phone or to
recover after a lost or wiped device.

- **Export:** open the **Card Menu** (top-left) → **Backup** → **Export JSON**. The app
  downloads `qr-wallet-backup.json`, containing every Card and the active Card id.
- **Restore on a new phone:** install and open QR Wallet there (the first load needs a
  network), open the Card Menu → Backup → **Import JSON**, pick the backup file, and confirm
  **Replace Wallet**. The imported active Card is restored when it resolves, otherwise the
  first Card becomes active.
- **All-or-nothing:** the whole file is validated before anything is written. A corrupt,
  wrong-version, or oversized Backup is rejected with a message and the current Wallet is
  left untouched. A valid import **replaces** the entire Wallet in one atomic write; there is
  no merge, so export first if you want to keep both.

If the stored Wallet is ever unreadable, the app keeps the raw data and offers it as a
download (`qr-wallet-corrupt.json`) so it can be recovered or reported; the app starts with
fresh Seed Cards meanwhile.

## Storage on iOS — keep a Backup

iOS can evict a website's local data — including an installed home-screen app's Wallet and
cached offline shell — after a period of non-use or under storage pressure. The app asks the
browser for persistent storage on startup, but that request is best-effort and cannot
guarantee the data survives. **The Backup is the real durability mechanism**: export one
regularly and keep it somewhere safe (for example in your files or a personal cloud drive).

The same caveat applies in a milder form to all browsers: a Wallet without a Backup exists on
one device only.

## Privacy

There are no accounts, sign-ins, analytics, or telemetry, and the app makes **no network
requests at runtime** — no externally hosted fonts, scripts, images, or APIs are fetched from
anywhere. The one font is vendored in the repository and precached with the rest of the shell.
The Wallet is stored in the browser's `localStorage` on the device (`qr_wallet_v1`), and a Backup
is written only to a file you choose. Card data leaves the device only when you deliberately
share a QR SVG or copy a Payload.

## Design

The visual contract is [docs/design/design.md](docs/design/design.md): one obsidian theme,
titanium surfaces, a single warm-alabaster QR Panel, and display type in a vendored Cormorant
Garamond. Acceptance is [docs/design/verification.md](docs/design/verification.md) — a
two-phone scan matrix plus a screenshot kit; both are manual, and screenshots are review
material rather than assertions. The decisions behind the look are
[ADR-0003](docs/adr/0003-one-obsidian-theme.md),
[ADR-0004](docs/adr/0004-vendored-display-face.md), and
[ADR-0005](docs/adr/0005-qr-panel-is-flat-square-and-maximal.md).

## Verifying on a real phone

Some behavior can only be checked on a device: the browser's install prompt, a real camera
scanning the QR Panel in different lighting, the iOS/Android share sheet targets, and wake
lock. The build itself is checked by the type check, the test suite, the measured bundle, the
injected precache manifest, the production build, and a headless pass over the service worker,
offline reload, and subpath hosting. The single dark theme and the QR Panel are checked with
`npm run shots` and the scan matrix in [docs/design/verification.md](docs/design/verification.md).
