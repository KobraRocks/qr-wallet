# 0005 — The QR Panel is flat, square, and maximal

- **Status:** Accepted
- **Date:** 2026-11-26
- **Supersedes:** the spec's "pure white" QR Panel wording and its
  "black on white" story.

## Context

The mockups propose four changes to the surface a camera must read: a warm
alabaster ground, a subtle sheen across the inset, rounded inset corners, and
decorative viewfinder brackets sitting on the QR's corners. The spec instead
required a pure-white panel, pure black modules, and a four-module quiet zone.

Scannability evidence changes which of these are decorative and which are
functional:

- Black on `#F4F1EA` is **18.6:1** against 21:1 on white. The measured 95%
  success contrast floor is ~2:1, and warm cream is the empirically good ground.
  The colour is safe.
- A four-module quiet zone is mandatory (ISO/IEC 18004); finder patterns are
  located by a 1:1:3:1:1 dark/light run whose outer light run *is* the quiet
  zone. A dark bracket against it collapses the run and the symbol is never
  located, so error correction never runs. Touching a finder also corrupts the
  module-size estimate. Brackets on the code are not a style choice; they are a
  failure.
- A gradient blended over modules lowers local modulation, and "the code's
  worst-looking end decides the scan". A gradient on the ground *behind* opaque
  modules is harmless; one over them is not.
- A rounded inset of 14px eats the whole ~10px quiet zone at dense payloads,
  because the quiet zone is only four modules wide.
- Density, not warmth, is the binding constraint. An 800-byte payload at medium
  ECC is QR **version 23: 117 modules**. At the previous `min(78vw, 340px)` that
  is ~2.4–3.1 CSS px per module, at or below the measured ~3.3 px/module
  95%-success threshold; error correction level does not move that threshold.

## Decision

- The QR Panel ground is `#F4F1EA`; modules stay pure black.
- The inset is **square and flat**. No gradient, shadow, texture, or
  translucent layer sits above it, and no extra padding is added beyond the
  SVG's own quiet zone.
- Decoration — brackets, edge marks, glows — lives on the titanium frame
  outside the alabaster edge, at least 4px clear, and never overlaps the inset.
- The Card Face never clips the inset with a rounded corner.
- The inset spans the Card Face's inner width and is never smaller than the
  previous design's panel. Module size is maximised; chrome yields to the code.
- The 800-byte Payload ceiling stays. It is a data contract, and lowering it
  would invalidate stored Cards on read, which the strict validator treats as a
  corrupt Wallet.

## Alternatives considered

- **Pure white.** Rejected: the alabaster costs 11% contrast against a floor
  9× lower, and it is the only warmth in the design. White buys nothing.
- **Sheen across the code.** Rejected: it lowers modulation exactly where
  scanning is hardest and cannot be verified without a scanner in the loop.
- **Rounded inset corners.** Rejected: at dense payloads the radius exceeds the
  quiet zone.
- **Brackets on the corners.** Rejected: breaks finder detection outright.
- **Lowering the ceiling to ~500 bytes for comfortable density.** Rejected:
  stored Cards above the new ceiling would fail read-time validation and the
  Wallet would be preserved as corrupt — a real data-loss hazard for a geometry
  problem. If density needs a smaller ceiling later, stored Cards must be
  grandfathered in the same change.
- **Enlarging the panel by shrinking the page gutter to zero.** Rejected: the
  safe-area and 16px gutter keep the code clear of a case or curved edge, and
  the measured gain does not change the density class.

## Consequences

- The density risk at the 800-byte ceiling on small phones is acknowledged and
  covered by the two-phone scan matrix in `docs/design/verification.md`: the
  worst-case payload is tested explicitly, not assumed.
- Logos, branding, or any art inside the code remain out of scope, permanently
  for scannability reasons rather than taste.
- The former "QR Panel is pure white and never themed" decision becomes "the
  panel is alabaster and flat"; the QR's SVG still carries no colour of its own.
