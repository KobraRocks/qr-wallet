# 0004 — The display face is vendored, not fetched

- **Status:** Accepted
- **Date:** 2026-11-26
- **Amends:** ADR-0002's constraint "no webfonts or external assets", and the
  spec's "No webfonts or external assets are used".

## Context

The identity needs an editorial serif for display type. The repository previously
had no webfonts at all: a 30 KB gzipped JavaScript + CSS budget, a privacy claim
that the app makes no runtime network requests, and a service worker that
precaches the complete shell.

Measured options (subset with `pyftsubset`, compressed with `woff2_compress`,
from the upstream variable TTF):

- Cormorant Garamond variable, ASCII + Latin-1 + Latin Extended-A + typographic
  punctuation: **37,297 bytes** as woff2; ASCII + Latin-1 only would be ~28 KB.
- Inter statics 400/600: ~31.5 KB; Geist statics 400/600: ~21 KB. Pairing a
  display serif with a UI sans costs 49–68 KB in total.
- A system serif stack costs nothing but is Safari-only for `ui-serif`; Android's
  `serif` has only 400 and 700; none of the three platforms looks like
  Garamond.
- woff2 is already Brotli-compressed, so HTTP compression saves nothing.

All three candidate faces are OFL-1.1 with no Reserved Font Name, so subsetting
may keep the name; the licence must ship, no in-UI attribution is required.

## Decision

Exactly one vendored font, for display type only.

- `public/fonts/cormorant-garamond.woff2` — Cormorant Garamond variable,
  weight 300–700, subset to ASCII, Latin-1, Latin Extended-A, general
  punctuation, `€`, `™`, and arrows. Committed, not built.
- `public/fonts/OFL.txt` ships with it.
- `@font-face` with `font-display: optional`, one family, one file, no
  preload. The service worker precaches it with the rest of the shell, so it is
  present offline and present at first paint after install.
- It is used for the Card Face Display Name and dialog titles, and nothing
  else. Field values, buttons, status text, and all UI text stay in the system
  stack.
- `check-budget.ts` now reports `.woff2` files and enforces a **64 KB combined
  ceiling** for JavaScript + CSS + fonts, alongside the existing 30 KB
  JavaScript + CSS budget.

## Alternatives considered

- **System serif stack, zero bytes.** Rejected: it loses the identity on
  Android and Windows, where the serif is generic or unavailable at medium
  weights, which is precisely the look being bought.
- **Cormorant + Inter or Geist for all UI text.** Rejected: 49–68 KB and a
  second family to maintain, for text the system stack already renders well.
  Revisit only if the system sans visibly fails to pair with the serif.
- **Lazy-loading the font.** Rejected: the first use would be a runtime network
  request, breaking both the privacy claim and offline behaviour on first
  launch.
- **No display face at all.** Rejected: it discards the design's only
  differentiating typographic decision and would leave the redesign as a
  palette swap.

## Consequences

- The precached shell grows by ~37 KB; the shipped CSS grows by a few lines of
  `@font-face` and a handful of `font-family` declarations, inside the existing
  budget.
- User-entered non-Latin names fall back per character on the Display Name
  line. This is accepted, and is why that line reserves its height.
- The licence obligation is a file in `dist/fonts/`, satisfied by the existing
  precache mechanism.
- Before the first install the font may not be used on the very first paint
  (`font-display: optional`); the layout must not shift because of it.
- Adding a second family later is a new decision with a new ceiling, not a
  quiet increment.
