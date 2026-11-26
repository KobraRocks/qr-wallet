# Coding standards

Rules for every change to this repository, applied to new code and to any file a
change already touches. They are enforced in review, not by a linter.

## Semantic HTML first

Reach for the element that already means the thing. A `div` or `span` is a last
resort, used only when no semantic element fits.

- `header`, `nav`, `main`, `footer`, `article`, `section` for landmarks and
  document structure.
- `button` for anything that acts, `a` only for navigation to a URL.
- `ul`/`li` for every repeated thing. The Card Menu is a list of Cards; the
  action dock is a list of actions; a list item holds its own control.
- `fieldset`/`legend` for a group of related controls, as the Card Kind
  switcher already does.
- `dl`/`dt`/`dd` for label/value pairs, `figure`/`figcaption` for a code with a
  caption, `output` or a live region for changing status text.
- Headings in order: one `h1` per view, no skipped levels. A dialog names
  itself with `aria-labelledby` pointing at its heading.

Do not add a `role` that a native element already carries.

## CSS

- **Native nesting.** One class per component and a nested rule per element, not
  a class per element. Example:

  ```css
  .card-face {
    display: grid;

    & .card-face__name { … }

    &:focus-within { … }
  }
  ```

- **Declarations before nested rules** inside every block. Safari 16.5, the
  oldest browser this app supports, drops declarations written after a nested
  rule.
- **No utility framework, no CSS framework, no Tailwind.** Styles for a
  component live with that component in `src/styles.css`.
- **Tokens, not literals.** Colour, spacing, radius, and type scale come from
  custom properties declared in `:root`. A component rule contains no raw hex
  value.
- **No `!important`** to win a fight; fix the specificity instead.
- Layout may use `grid`, `flex`, `clamp()`, `env(safe-area-inset-*)`, and
  `100dvh`; nothing may depend on a browser feature newer than the support
  floor below.

## Support floor

Safari/iOS 16.5, Chrome 112, Firefox 117. This floor follows from CSS nesting
and `backdrop-filter`, and it rules out, among other things:

- `animation-timing-function: linear()` (Safari 17.2);
- the `scrollend` event (Safari 26);
- `@scope`, `view-transition`, and CSS `if()`.

`backdrop-filter` needs its `-webkit-` prefix; a surface that uses it must stay
legible without it.

## JavaScript and assets

- Vanilla TypeScript, no UI framework, no runtime dependency beyond `qr`.
- No network requests at runtime, no CDN, no externally hosted asset. Fonts and
  icons are vendored into the repository and precached by the service worker.
- The persistence boundary stays the only test seam; tests remain Node-only.
- The shipped JavaScript, CSS, and fonts together stay under the budget enforced
  by `npm run check:budget`.
