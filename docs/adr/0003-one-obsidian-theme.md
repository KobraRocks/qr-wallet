# 0003 — One obsidian theme, always

- **Status:** Accepted
- **Date:** 2026-11-26
- **Supersedes:** the then-light/dark guidance in the spec's story 46 and its
  "Theming and layout" decision.

## Context

The adopted visual identity is a matte obsidian canvas with titanium surfaces,
champagne accents, and a single warm-alabaster QR Panel. The spec previously
promised that the shell follows the system's light/dark preference while the QR
Panel stays bright, and the README's manual pass verified both themes.

Three facts push against carrying two themes:

- The design is dark-native. Champagne on obsidian is the identity; a light
  variant would be a second design system with no mockups, invented from
  scratch for three surfaces, five dialogs, a toast, a banner, and a notice.
- The QR Panel is the only bright surface by design. The scanning flow gains
  nothing from a light shell, and the product is explicitly used in dim lounges
  and restaurants.
- The design tokens floor text-bearing surfaces at a dark luminance so champagne
  keeps its contrast. A light palette would need a second set of chromatic
  relationships, not a colour swap.

## Decision

The app ships exactly one theme: obsidian, always.

- `color-scheme: dark`; no `prefers-color-scheme` branches in the shell's
  colours.
- One `theme-color` of `#070709` in `index.html`; manifest `theme_color` and
  `background_color` of `#070709`.
- No manual theme toggle and no per-user theme setting.
- The QR Panel stays alabaster-on-black in that single theme.
- Contrast floors live in the design contract and are checked per surface.

## Alternatives considered

- **Dual palette, system-following.** Rejected for now: it doubles the design
  surface with no reference for the light half, and it would ship an
  unreviewed second identity. A light theme is a future design project with its
  own ADR, not a token inversion.
- **Luxury treatment in dark only, today's zinc look in light.** Rejected: two
  identities in one binary, and the light path becomes untested chrome that no
  one designed.
- **Manual toggle.** Rejected: a setting for a single-user local app, another
  persisted value, and another state to verify.

## Consequences

- Story 46 is removed from the spec and the "Theming and layout" decision is
  rewritten; the README no longer documents a light/dark QR Panel pass and
  documents the single theme instead.
- Users who prefer a light interface lose that choice. WCAG does not require a
  theme preference, and the QR Panel stays high-contrast regardless.
- `color-scheme: dark` also opts the page out of Chrome's forced auto-dark,
  which would otherwise tint the titanium surfaces unpredictably.
- Adding a light theme later means writing this ADR's successor and designing
  the second palette, not flipping a media query.
