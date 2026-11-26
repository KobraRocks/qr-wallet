# QR Wallet — visual contract

The adopted interface: **Obsidian & Champagne**. This file is the contract the
code is reviewed against, not a proposal. The three mockups in `images/` are
**art direction**, not pixel specifications: they were rendered by a model and
contain details that would break the product, each recorded under
[Deviations](#deviations-from-the-mockups).

Read alongside [the spec](../specs/qr-wallet.md), [ADR-0003](../adr/0003-one-obsidian-theme.md),
[ADR-0004](../adr/0004-vendored-display-face.md), and
[ADR-0005](../adr/0005-qr-panel-is-flat-square-and-maximal.md).

## Identity

One theme, always dark: a matte obsidian canvas, machined titanium surfaces with
a hairline champagne edge, and a single warm-alabaster inset that exists only to
be scanned. Champagne is reserved for active state, primary action, and focus —
never for body text, never as decoration that competes with the code.

## Tokens

Declared in `:root` as custom properties. Component rules use tokens, never
literals.

| Token | Value | Role |
| --- | --- | --- |
| `--canvas` | `#070709` | Page background; also the PWA theme and background colour. |
| `--surface` | `#121316` | Card Face. |
| `--surface-raised` | `#17181C` | Dock, sheets, dialogs. |
| `--hairline` | `rgb(200 176 138 / 0.18)` | Machined edge on surfaces. Decorative only, never the sole indicator of state. |
| `--accent` | `#C8B08A` | Active state, gold text on dark, iconography. |
| `--accent-bright` | `#E2CFA8` | Primary CTA fill and focus ring. |
| `--alabaster` | `#F4F1EA` | QR Panel ground. Used nowhere else. |
| `--ink` | `#F4F1EA` | Primary text (16.3:1 on `--surface`). |
| `--ink-muted` | `#A9A49B` | Secondary text (7.5:1). |
| `--ink-faint` | `#8A857D` | Meta text and the pager count (4.9:1). |
| `--danger` | `#D46A6A` | Delete and destructive confirmation (5.3:1). |
| `--danger-edge` | `rgb(212 106 106 / 0.55)` | The crimson hairline around a destructive control. |
| `--focus-ring` | `#E2CFA8` | 2px solid ring plus a soft champagne glow. |
| `--on-accent` | `#141316` | Dark text on the champagne primary fill. |
| `--dock-tint` | `rgb(18 19 22 / 0.72)` | The Dock's frosted underlay. |
| `--dock-solid` | `#1B1C21` | The Dock's opaque fallback without `backdrop-filter`. |
| `--backdrop` | `rgb(3 3 4 / 0.72)` | Dimmed dialog backdrop. |
| `--radius-card` | `20px` | Card Face. |
| `--radius-sheet` | `24px` | Dialogs and the Card Menu. |
| `--gutter` | `16px` | Page gutter, before safe-area insets. |

Spacing, type scale, tracking, line widths, blur, and motion also resolve
through `:root` tokens (`--space-*`, `--type-*`, `--tracking-*`, `--motion-*`),
as do the element sizes (`--target-size`, `--field-size`, and friends); the
table above lists the design-significant colour and radius tokens.

Contrast floors: text is at least 4.5:1; non-text UI is at least 3:1; a
text-bearing surface never exceeds `#2A2B2E` in luminance, because champagne
falls to 5.3:1 against `#3A3B40` and AAA margins disappear on brushed
highlights. Gradients therefore stay subtle and never sit behind small text.

The focus ring is a solid 2px `--accent-bright` perimeter plus an optional
glow. The glow alone is insufficient: focus appearance counts only pixels that
change by at least 3:1.

## Typography

**Cormorant Garamond**, variable weight 300–700, vendored as a single woff2 in
`public/fonts/`, loaded with `font-display: optional`, precached by the service
worker, and accompanied by its OFL licence. It is a **display face only**:

| Role | Face | Size / treatment |
| --- | --- | --- |
| Card Face Display Name | Cormorant | `clamp(2rem, 9vw, 2.75rem)`, weight 500 |
| Dialog titles | Cormorant | `1.5rem`–`1.75rem`, weight 500 |
| Card Menu wordmark | UI face | `0.68rem`, uppercase, `letter-spacing: 0.28em`, `--ink-faint` |
| Small labels | UI face | `0.7rem`, uppercase, `letter-spacing: 0.12em`, `--ink-muted` |
| Everything else | UI face | `0.95rem`–`1rem` |

The UI face is the existing system stack. Cormorant's x-height is 0.386 em
against the system face's ~0.55 em, so a serif line needs roughly 1.35× the
nominal size to carry the same optical weight; `line-height` is set explicitly
on every serif rule so a fallback cannot reflow the layout.

Serif is never used for field values, buttons, status text, or any other
user-typed string except the Card Face's Display Name. Non-Latin names fall back
per character through the font stack; that is accepted and is the reason the
Display Name line reserves its height rather than hugging its text.

## QR Panel rules

These are product rules, not styling preferences. Each one is in
[ADR-0005](../adr/0005-qr-panel-is-flat-square-and-maximal.md) with its evidence.

1. The inset is **square and flat**: a single `--alabaster` fill with no
   gradient, shadow, texture, or translucent layer above it.
2. The SVG's own four-module quiet zone is the only margin. No extra padding is
   added inside the inset.
3. Nothing is drawn over the inset. Corner brackets, edge marks, and glows live
   on the titanium frame **outside** the alabaster edge, at least 4px clear of
   it, and never overlap it.
4. Modules stay pure black. The SVG is never recoloured, inverted, rotated, or
   animated.
5. The inset spans the Card Face's inner width on every viewport a phone can
   show, including at 200% zoom, and there is no viewport-height cap on it. A
   viewport too short for the square inset (landscape, or a zoomed view)
   scrolls vertically instead of shrinking the code. The previous design's
   `min(78vw, 340px)` floor is superseded: at 200% zoom the zoomed viewport's
   own inner width is below that floor, so the full inner width is the largest
   size that view can show.
6. The Card Face never clips the inset with a rounded corner; the Card Face
   radius applies to the titanium only.

## Layout

One view, a three-row grid at `100dvh` with safe-area padding:

```
┌ menu ····· ‹ 2 / 5 › ····· + ┐   top bar, 44px targets
│                              │
│   ┌──────────────────────┐   │
│   │   Ada Lovelace       │   │   Card Face: --surface, hairline,
│   │   VISIT CARD · ORG   │   │   radius 20, centered
│   │  ┌────────────────┐  │   │
│   │  │   QR Panel     │  │   │   square alabaster inset,
│   │  └────────────────┘  │   │   6px titanium reveal for brackets
│   └──────────────────────┘   │
│                              │
│   ╭──────────────────────╮   │
│   │ Edit   Copy   Share  │   │   dock: frosted, raised, 44px targets
│   ╰──────────────────────╯   │
└──────────────────────────────┘
```

## Components

**Top bar** — three items: the Card Menu button (left, `aria-haspopup="dialog"`),
the pager (centre, `nav` labelled "Card pager": previous button, a
`--ink-faint` count such as `2 / 5` in a polite live region, next button), and
the New Card button (right, `+`, accessible name "New Card"). The pager is
hidden when the Wallet holds a single Card; swapping clamps at the ends and
never wraps.

**Card Face** — one `article` labelled by its Display Name heading: the Display
Name in Cormorant, a tracked subtitle of `KIND · ORGANIZATION` (organization
only for a Visit Card that has one), then the QR Panel. It is the only surface
allowed to be bright.

**Dock** — a list of three actions: Edit, Copy, Share. Visible label "Copy" with
accessible name "Copy Payload". Frosted: `-webkit-backdrop-filter` plus
`backdrop-filter: blur(10px)` over a `rgb(18 19 22 / 0.72)` underlay, with an
opaque fallback that stays legible. Static: the filter is never animated.

**Card Menu** — a native modal `dialog` opened from the top bar, a list of every
Card: each row shows the label with its kind beneath, the active Card carrying
`aria-current="true"` and a champagne dot. The list scrolls and opens scrolled
to the active row. Choosing a row renders that Card and closes the menu; Esc,
the backdrop, and the close control also close it and return focus to the menu
button. The footer holds one row: **Backup**, which opens the Private Backup
sheet. Header: wordmark line plus a "Cards" heading.

**Editor sheet** — a native modal `dialog` titled `Edit <label>` in Cormorant. A
`fieldset` segmented control of Card Kinds, then the fields for the chosen kind.
Labels are the tracked small labels; inputs sit on a recessed `--surface` panel
with a `--hairline` border and switch to `--accent-bright` on focus. Delete Card
is a full-width crimson hairline; it reveals the existing inline two-step
confirmation. Cancel (outline) and Save (champagne fill, dark text) sit at the
bottom. Every existing behaviour stays: inline errors, Save does not close on
error, Esc cancels, backdrop click does not.

**Private Backup** — a `--surface-raised` sheet over a **dimmed** backdrop
(`rgb(3 3 4 / 0.72)`, no blur), an engraved vault glyph drawn as inline SVG, the
serif title **Private Backup**, the existing explanatory note, Export JSON as
the champagne primary, Import JSON outlined, and a quiet Close. The existing
status line, error line, and Replace Wallet confirmation are kept and styled in
place.

**Toast, recovery banner, update notice** — same tokens: raised surface,
hairline, `--ink` text, crimson edge for the recovery banner, champagne for the
notice's Reload action. Nothing light-themed survives.

## Motion

No ambient animation, no sensor input, no swipe paging, no spring overshoot. The
screen is held awake for minutes and a perpetual sheen costs battery for
nothing.

- Pressed and hover states: 120–160 ms colour and shadow transitions.
- Card swap: 160 ms, 8px lateral slide plus fade; instant under
  `prefers-reduced-motion: reduce`, which also disables every transition this
  file adds.
- Nothing animates `backdrop-filter`, the QR Panel, or layout properties.

## Deviations from the mockups

1. **Serif field values → UI face.** The mockup sets typed values in Cormorant;
   the contract uses the UI face for legibility and because user data is the
   worst case for a display serif's fallback.
2. **Sheen across the code → flat ground.** No gradient or glare overlays the QR
   Panel.
3. **Brackets on the code corners → brackets on the titanium frame.** Decoration
   inside the four-module quiet zone breaks finder detection outright.
4. **Gyroscope sheen and spring/slide between cards → explicit pager.** iOS
   requires a user-gesture permission prompt for orientation data, and a
   path-gesture-only swap would fail WCAG 2.5.1.
5. **Tab row → Card Menu.** A horizontal tab row does not survive the Wallet's
   100-Card ceiling; the menu does, and swapping stays one explicit control
   away.
6. **Blurred modal backdrop → dimmed backdrop.** `backdrop-filter` on
   `::backdrop` is unreliable in WebKit and expensive full-screen; only the
   small sheet is blurred.

## Budget

Shipped JavaScript, CSS, and fonts together stay under **64 KB**; JavaScript and
CSS alone stay under the existing **30 KB** gzipped budget. `npm run check:budget`
enforces both and prints every file, so the font cannot grow unnoticed.

## Verification

`docs/design/verification.md` holds the acceptance checklist: the two-phone
scan matrix, the decode proxy, and the screenshot kit.
