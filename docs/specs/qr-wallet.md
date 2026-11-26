# QR Wallet

## Problem Statement

A phone owner who hands over contact details in person needs the right scannable code on screen within seconds, often where there is no reliable signal. Today that means digging through screenshots, using an ad-supported QR app that may require a network or an account, or retyping a vCard or URL while someone waits. The results are the wrong code, a blurry code, or an apology — and the information being shown is personal, so uploading it to a service is undesirable.

## Solution

QR Wallet is an installable, local-only PWA that holds a small Wallet of named Cards. A Card is a Visit Card (a vCard 3.0 contact), a Link (a URL), or Text. The active Card's Payload is rendered as a high-contrast SVG QR Panel, sized for one-handed scanning, with the screen kept awake while it is visible. The active Card is restored on relaunch, the Wallet works fully offline after first load, and a Backup moves every Card to a new phone without a server.

## User Stories

1. As a first-time owner, I want the Wallet seeded with Visit Card, Website, and Sales Deck examples, so that I understand the workflow before entering my own details.
2. As a returning owner, I want my last active Card restored on launch, so that the code I need is already on screen.
3. As an owner, I want every Card in a vertical Card Menu, so that I can reach all my codes from one control.
4. As an owner meeting someone, I want to swap to the next or previous Card without opening the menu, so that the right code appears before the conversation pauses.
5. As an owner, I want the active Card's Display Name and a short subtitle naming its kind, so that I can confirm I am showing the right thing.
6. As an owner, I want a New Card control in the main view's top bar, so that creating a Card is discoverable.
7. As a recipient, I want a large, uncluttered, high-contrast QR code, so that my camera locks on quickly in poor light.
8. As an owner, I want the QR Panel to stay black on warm alabaster, so that the code never inverts and fails to scan.
9. As an owner, I want the QR to fit the screen without scrolling, so that I can hold the phone naturally at arm's length; on a viewport too short for the square QR Panel, the view scrolls rather than shrinking the code.
10. As an owner showing a code, I want the screen to stay awake, so that it does not dim while someone scans.
11. As an owner returning from another app, I want the wake lock reacquired, so that the code stays readable without toggling anything.
12. As an owner, I want a Visit Card with first name, last name, organization, title, phone, email, and website, so that one scan saves complete contact details.
13. As an owner, I want accented and non-Latin names preserved, so that the scanned contact looks correct.
14. As an owner, I want a Visit Card to require a first or last name, so that I cannot save a contact with nothing to identify it.
15. As an owner, I want blank optional contact fields omitted, so that the scanned contact has no empty clutter.
16. As an owner, I want semicolons, commas, and backslashes in field values escaped, so that the receiving parser does not split a value.
17. As an owner, I want the phone and email fields to use appropriate mobile keyboards, so that entry is faster and less error-prone.
18. As an owner, I want a website on a Visit Card normalized like a Link, so that scans open even if I omit the scheme.
19. As an owner, I want to create a Link card by typing `example.com`, so that the app stores a working URL without me typing the scheme.
20. As an owner, I want an explicit `mailto:` or `tel:` scheme kept, so that non-web links still work when scanned.
21. As an owner, I want a clear error when a URL cannot be parsed, so that I can fix it before saving.
22. As an owner, I want to create a Text card with arbitrary content, so that I can show short instructions or a non-URL string.
23. As an owner, I want a clear error when a Payload exceeds the scannable limit, so that I do not save a code nobody can read.
24. As an owner, I want to edit any Card's label and Payload, so that my Wallet stays current as my details change.
25. As an owner, I want to switch a Card's kind while editing, so that I can repurpose it instead of deleting and recreating it.
26. As an owner, I want Save to validate inline and keep the dialog open on error, so that I can correct one field without retyping everything.
27. As an owner, I want Cancel and Esc to discard unsaved edits, so that I can back out without changing the Wallet.
28. As an owner, I want to delete a Card only after a second confirmation, so that a stray tap cannot lose it.
29. As an owner, I want to delete every Card and see a clean empty state, so that I am not forced to keep a placeholder I do not want.
30. As an owner, I want the empty state to point me to creating a Card, so that I know how to recover.
31. As an owner, I want to copy the exact Payload with one tap, so that I can paste it into another tool or message.
32. As an owner, I want to share or download the QR as an SVG file, so that I can print it or send it to someone.
33. As an owner on a device that cannot share files, I want a download fallback, so that the action still produces the code.
34. As an owner, I want a footer control for Backup, so that export and import do not compete with scanning.
35. As an owner, I want to export the whole Wallet as one Backup file, so that I can recover from a lost or wiped phone.
36. As an owner moving to a new phone, I want to import that Backup and replace the Wallet in one step, so that all Cards arrive, including the active selection.
37. As an owner, I want an import confirmed before it replaces anything, so that I cannot overwrite Cards by accident.
38. As an owner, I want a corrupt or invalid Backup rejected without touching my Wallet, so that a bad file cannot destroy my data.
39. As an owner, I want to be told when my saved Wallet cannot be read and given a raw copy, so that I can recover or report the problem.
40. As an owner with no signal, I want the installed app to open and show every Card, so that airplane mode does not take my Wallet away.
41. As an owner, I want an update notice after a new version installs, so that I can move to it without a forced reload.
42. As an owner, I want my Cards to stay on the device and never be uploaded, so that personal contact details are not shared with a service.
43. As an owner, I want to use the app without an account or sign-in, so that I can start in seconds and keep my data private.
44. As an owner, I want the app to ask the browser to keep its data, so that storage eviction is less likely.
45. As an owner using a screen reader or keyboard, I want labeled controls and managed focus, so that I can manage Cards without guessing.
46. As an owner, I want one coherent obsidian interface regardless of my system setting, so that the app reads as a single object wherever I open it.
47. As an owner on a notched phone, I want controls clear of the safe areas, so that nothing hides behind the cutout or home indicator.
48. As an owner, I want short, required Card labels, so that Card Menu rows stay readable and identifiable.
49. As an owner, I want the Card Menu to close as soon as I choose a Card, so that the code is one tap away.
50. As an owner with several codes, I want to see which Card I am showing, so that I do not hand over the wrong one.

## Implementation Decisions

- **Modules.** A vCard serializer owns vCard formatting and escaping; a URL normalizer owns link rules; a Payload module is the single source of the encoded string; a Wallet store owns loading, saving, validation, seeding, and Backup; a QR renderer wraps the QR package; a UI module owns rendering and dialogs; a bootstrap module owns service-worker registration and Wake Lock; a build plugin owns precache injection.
- **Client-only architecture.** Vanilla TypeScript and Vite produce a static, installable PWA deployable at a domain root or subpath. There is no backend, account system, analytics, UI framework, CSS framework, or runtime network dependency.
- **Wallet model.** A Wallet is version 1 and holds an ordered list of Cards plus the active Card id. Each Card has an id, a required 1–40 character label, a Card Kind, a payload source, and a last-updated timestamp. The payload source is a discriminated union: a Visit Card carries vCard fields, while a Link or Text carries a single string. The Wallet holds at most 100 Cards. An empty Wallet is valid, with no active Card.
- **Seed Cards.** Visit Card, Website, and Sales Deck are created only when no Wallet has ever been stored. Once a Wallet exists, emptying it never re-seeds it.
- **Active Card.** The active Card is restored on launch. If the stored active id does not resolve, the first Card becomes active; if the Wallet is empty, there is no active Card.
- **vCard 3.0.** Payloads use CRLF line endings and the exact property order: BEGIN, VERSION 3.0, N, FN, ORG, TITLE, TEL;TYPE=CELL, EMAIL;TYPE=INTERNET, URL, END. Values are trimmed; optional properties are omitted when blank; backslash, semicolon, comma, and newlines are escaped per property value; UTF-8 is preserved. N is built as last;first;;; and FN as the trimmed join of first and last. A Visit Card requires at least one of first or last name. Line folding is deliberately not implemented.
- **Links.** Link Payloads and the Visit Card website are normalized on save: an explicit scheme is preserved, otherwise https:// is prepended, and the result must parse as a URL. The normalized value is what is displayed, copied, and encoded. Text Payloads are stored verbatim.
- **Payload ceiling.** Every Payload is limited to 800 UTF-8 bytes, enforced on save and import with a message reporting the byte count. The QR always uses the medium error-correction level; lowering it for long Payloads is deliberately rejected in favor of the ceiling.
- **Persistence.** The Wallet is stored under the versioned key qr_wallet_v1. Writes are single, atomic operations. A write failure is surfaced and never silently discarded. The persistence boundary accepts an injected Storage implementation, with localStorage as the production default.
- **Validation and recovery.** Stored state is strictly validated on read. Invalid JSON, an unknown version, or an invalid shape is preserved verbatim under qr_wallet_v1_corrupt, the Seed Cards are created, and a dismissible banner offers the raw copy. There is no speculative migration framework; version 1 is strict until a real v2 exists.
- **Backup.** Export writes the complete Wallet, including the active Card id, as qr-wallet-backup.json. Import is all-or-nothing: the entire file is validated first (version, shape, per-kind requirements, unique ids, Payload ceiling, at most 100 Cards, at most 1 MB), then the user confirms a replacement, then one atomic write replaces the Wallet. Errors leave the current Wallet untouched. The imported active Card is used when it resolves, otherwise the first Card; an empty Wallet is a valid import.
- **QR rendering.** QR codes are generated as inline SVG with the qr package at its medium ECC level and a 4-module quiet zone. The SVG string is guarded before insertion and never contains the Payload in markup. The library's scale option is not used; sizing comes from CSS. The SVG carries no colors: the QR Panel supplies a warm-alabaster background and pure black fill, so the QR is never themed or inverted.
- **QR Panel.** The Panel is square and flat: one warm-alabaster fill, no gradient, shadow, or overlay, and no padding beyond the SVG's own quiet zone, which nothing is allowed to touch. It spans the Card Face's inner width on every viewport, including at 200% zoom; it is never capped by viewport height, and a viewport too short for the square inset scrolls vertically rather than shrinking the code. The earlier min(78vw, 340px) floor is superseded because a zoomed viewport's inner width is itself below it. Decorative brackets live on the titanium frame outside it. It hosts a labeled, image-role SVG and is the only bright surface on the screen.
- **Copy and share.** Copy puts the exact Payload on the clipboard and reports success or failure. Share uses the Web Share API with an SVG file when file sharing is supported; a hard rejection falls back to downloading a slug-named SVG, while a user cancel is a no-op.
- **Main view.** A three-row grid: a top bar with the Card Menu button, a pager (`‹ n / m ›`, hidden for a single Card, clamping at the ends), and the New Card control; the Card Face showing the Display Name, a subtitle of kind (and organization for a Visit Card that has one), and the QR Panel; and a dock holding Edit, Copy Payload, and Share. The Card Menu is a modal list of every Card, reaching Backup in its footer. The empty state shows a single create call to action.
- **Editing.** Editing uses a native dialog opened modally. Fields depend on the selected Card Kind, with the kind switcher labeled Visit Card, Link, and Text. Changing kind on an existing Card is allowed; only the saved kind's payload is persisted, while draft values survive for the duration of the dialog. New Cards default to Link with a label matching the kind. Labels are required. Validation is inline and Save does not close the dialog on error. Cancel and Esc discard. The dialog closes on Esc but not on backdrop click, and focus returns to the trigger.
- **Deleting.** Delete is an inline two-step confirmation inside the edit dialog. Deleting the last Card is allowed and leaves the empty state; the Wallet is not re-seeded.
- **Theming and layout.** The app ships one obsidian theme, always; it does not follow the system light/dark setting and has no manual toggle. The layout uses 100dvh, safe-area insets, and no text selection on chrome. Toasts are polite live regions. Card Menu rows expose their selected state, the pager announces the position, and dialogs have accessible names. The visual contract lives in docs/design/design.md.
- **Wake Lock.** A screen wake lock is requested while the main QR view is visible, released when the document becomes hidden, and re-requested on visible. All calls are guarded so unsupported browsers continue without errors.
- **Service worker.** A hand-written service worker precaches the complete app shell: the shell document, hashed JavaScript and CSS, the manifest, and the icons. The cache name includes a build hash. Install calls skipWaiting; activate deletes old caches and claims clients. Same-origin GET requests are cache-first with a cached shell fallback for navigations. Registration happens only in production builds.
- **Updates.** When a new worker takes control, an unobtrusive notice offers a reload; the page is never force-reloaded. The app also makes a best-effort persistent-storage request on startup.
- **Manifest and icons.** The manifest declares the name, short name, relative start URL and scope, standalone display, portrait orientation, theme and background colors, and 192, 512, and maskable 512 PNG icons. The icons are generated by a script, checked in, and include an iOS touch icon and standalone meta tags.
- **Build and budget.** The build runs the type checker and Vite with a relative base. The asset manifest is injected into the service worker at build time, and the build fails if the injection placeholder is missing. The total shipped JavaScript and CSS stay under 30 KB gzipped, and JavaScript, CSS, and fonts together stay under 64 KB; both are measured by check:budget. Exactly one font is shipped, vendored and precached; no externally hosted fonts or assets are used.
- **Documentation.** The README covers local preview, deployment to Cloudflare Pages, GitHub Pages, or any HTTPS static folder, Add to Home Screen on Android and iOS, the Backup workflow, and the iOS storage-eviction caveat.

## Testing Decisions

- **What good tests check.** External behavior only: the exact Payload string produced for given fields, the Wallet that results from given stored or imported input, and the typed rejection for invalid input. Tests do not assert private helper structure, DOM class names, or the internals of the QR package.
- **One seam.** The persistence boundary: the Wallet store accepts an injected Storage implementation (localStorage in production, an in-memory fake in tests). All storage, seeding, validation, Backup, and recovery tests run in Node through that seam; no jsdom or DOM test environment is introduced.
- **Pure functions tested directly.** The vCard serializer, URL normalizer, Payload derivation, and the byte ceiling are pure and need no seam.
- **vCard tests.** Assert the exact multi-line CRLF output for a fully populated Visit Card, clean omission of blank optional properties, escaping of backslash, semicolon, comma, and newline per field, UTF-8 preservation for accented and non-Latin names, the N and FN derivations, and the at-least-one-name rule.
- **URL and Payload tests.** Assert scheme preservation, https autoprefixing, invalid URL rejection, verbatim Text, correct Payload selection per Card Kind, and the 800-byte ceiling at the boundary.
- **Wallet tests.** Assert seeding when storage is empty; no re-seeding after an intentional empty Wallet; round-trip load/save; active-id repair; rejection of malformed JSON, unknown versions, wrong shapes, duplicate ids, and oversized or over-count Wallets; preservation of corrupt raw state; and surfaced write failures.
- **Backup tests.** Assert a full export/import round trip, atomic replacement after successful validation, per-kind validation, the size and count ceilings, and that every rejection leaves the existing Wallet untouched. The confirmation prompt itself is UI behavior and is checked manually.
- **Prior art.** None yet in this repository; this spec establishes the fake-Storage, Node-only pattern.
- **Not unit-tested.** The DOM, the Card Menu and pager, dialogs, Wake Lock, share sheet, service-worker lifecycle, and icon generation. These are verified through the type check, the production build, the injected precache manifest, measured gzip output, and a manual offline preview reload. The visual contract is checked with the screenshot kit and the two-phone scan matrix in docs/design/verification.md; screenshots are review material, never assertions. On-device install and scanning remain a documented manual check.

## Out of Scope

- Backend, accounts, synchronization, cloud backup, analytics, and telemetry.
- UI or CSS frameworks, Workbox, externally hosted fonts, or CDN assets. One vendored display font ships with the app (ADR-0004).
- QR scanning, camera access, or reading codes.
- PNG rasterization for sharing; sharing produces SVG.
- vCard 4.0, line folding, custom ECC, QR logos, or branding.
- Card reordering, search, folders, tags, or favorites.
- Multiple Wallets, per-Card metadata beyond the label, or contact photos.
- Manual theme toggle, per-user settings, or a custom install prompt.
- Multi-tab live synchronization.
- Encryption at rest or a passcode.
- PDF export or print-specific layouts.
- Internationalization or right-to-left layout work.
- A browser E2E suite, CI pipeline, CSP, or app-store and native packaging.
- Wallets above 100 Cards or Payloads above 800 UTF-8 bytes.

## Further Notes

- The qr package's current API uses the levels low, medium, quartile, and high; "medium" is the default, and the literal `ecc: 'M'` from the original brief would throw. The implementation passes medium explicitly, with no ECC boost option (that option belongs to a different package).
- The SVG output is transparent and unstyled by design of the package; contrast is enforced by the QR Panel CSS. This also means the QR cannot inherit theme colors.
- Scannability is bounded by module size, not by colour: an 800-byte Payload at medium ECC is QR version 23 (117 modules), so the Panel is kept as large as the layout allows and the worst case is scanned on a real device as part of design verification (ADR-0005).
- The only font is Cormorant Garamond, vendored as a subset woff2 with its OFL licence and precached with the shell; it is display-only and loaded with font-display: optional (ADR-0004).
- backdrop-filter is used only on the dock and dialog sheets, prefixed for WebKit, over a dark underlay, and never on ::backdrop or over the QR Panel.
- Installed iOS home-screen apps did not support the Screen Wake Lock API before iOS 18.4; older versions degrade silently. iOS share targets accept SVG in Files, Mail, and Messages but not Photos.
- iOS can evict site data, including the Wallet and the offline shell, after a period of non-use. The persistent-storage request is best-effort only, so Backup is the real durability mechanism and the README says so.
- Two decisions meet the bar for ADRs and will be recorded alongside implementation: the Wallet is the local system of record with no backend, and the offline guarantee comes from a cache-first, build-injected service worker rather than Workbox.
- The gzip budget assumes the qr package's SVG path costs about 6.6 KB gzipped, leaving room for the app, CSS, and shell under the 30 KB ceiling.
