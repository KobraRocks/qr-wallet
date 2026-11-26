# Design verification

Acceptance for the Obsidian redesign. The definition of done is the GitHub
issues: each slice runs its own rows when it closes, and the full matrix runs
once at epic close. Nothing here is automated in CI; the screenshot and decode
harness exist so a human review is repeatable.

## Scan matrix (gate for the main view and every change to the QR Panel)

Two physical phones are required. Automated decoding cannot see glare, colour
rendering, or a camera's metering.

- Readers: **iOS Camera** (VisionKit), **Android Google Lens** (ML Kit), and one
  ZXing-based reader for the strict tier.
- 10 attempts per condition; **pass is 9/10** at each.
- Payloads: the seed Visit Card (short) and a **worst-case 800-byte Text Card**
  (QR version 23, 117 modules) created for the test.
- Brightness: 100%, 50%, 25%.
- Light: dim lounge (~50 lx), restaurant ambient, bright daylight.
- Distance: 15, 25, 40 cm.
- Angle: 0° and 20°.
- Display: Night Shift and True Tone on and off; matte screen protector on and
  off.

Record the date, device models, and results on the issue. A failure at any
condition blocks closing it.

## Decode proxy (run in the screenshot kit, not a substitute for the matrix)

The rendered screen is captured at 1×, then downscaled to **6, 4, 3, and 2 CSS
px per module**, given mild blur and JPEG quality 60, and decoded with
`zbarimg`. The code is expected to survive 4 px/module and to be reported at
3 px/module; 2 px/module is recorded, not required. Compute modules as
`QR_PANEL_PX / (code_modules + 8 quiet-zone modules)`.

## Screenshot kit

`npm run shots` (Chromium must be installed) drives the built app over the
Chrome DevTools Protocol with no added dependency, writing to
`.artifacts/screenshots/`:

- `main-visit` and `main-link` at 430×932, after one pager step;
- `card-menu-open` scrolled to the active row;
- `edit-sheet` and `edit-sheet-error`;
- `private-backup`;
- `main-single-card` (pager hidden), `empty-state`, and `main-dense` (an
  800-byte Text Card, the density worst case);
- the main view with `prefers-reduced-motion: reduce`, and at 390×844.

The Private Backup confirmation is not captured: it needs a real chosen Backup
file, so it is checked by hand. The script also prints the QR Panel's pixels per
module, the decode-proxy result at 6/4/3/2 px per module, and the pager and
Card Menu interaction results.

Screenshots are for review, not assertions. A reviewer compares them against
the contract in `design.md`, never against the mockups pixel for pixel.

## Visual and accessibility checklist (every slice)

- [ ] Every colour comes from a token; no raw hex in component rules.
- [ ] Body text ≥ 4.5:1, non-text UI ≥ 3:1, measured against the surface it
      sits on.
- [ ] Every interactive target is at least 44×44 CSS px.
- [ ] Focus is visible on every control as a solid 2px champagne ring, not only
      a glow, in both keyboard and pointer paths.
- [ ] The QR Panel is flat, square, unclipped, and at least as wide as the
      previous design's panel; no decoration touches the alabaster.
- [ ] Nothing but the QR Panel is bright; no light-themed surface survives.
- [ ] Text at 200% zoom does not clip or overlap the pager or the dock.
- [ ] `prefers-reduced-motion: reduce` removes the card-swap slide and every
      transition added by the redesign.
- [ ] Safe-area insets respected at the top bar and dock on a notched device.
- [ ] Screen reader: the pager announces "Card n of m", the menu rows announce
      their selected state, dialogs are named, focus returns to the trigger.
- [ ] Backdrop is dimmed, never blurred; the sheet keeps its own blur with an
      opaque fallback if `backdrop-filter` is unavailable.

## Product checklist

- [ ] Active Card restored on launch; swapping clamps at both ends.
- [ ] Choosing a Card in the menu closes it and shows that Card; focus returns.
- [ ] Backup is reachable only from the Card Menu footer.
- [ ] The vendored font is present offline; the app makes no network request at
      runtime (DevTools network log is empty after install).
- [ ] `npm run check:budget` passes both ceilings.
